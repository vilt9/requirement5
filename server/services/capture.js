// Card → GIF/MP4 capture. Drives the live card through one deterministic
// transformation made for exported media:
// flat base → shiny orbit → restored flat base → logo.
//
// How it works: Playwright loads the chrome-free /capture/:id page (CaptureCard.jsx),
// then sends normalised pose states into the real Card component for every frame.
// Frames are screenshotted (clipped to #capture-frame) and stitched by ffmpeg into
// an MP4 or GIF. The card still owns its visual effects and authored reveal timing.
//
// Requires Playwright (with chromium) and ffmpeg on the host. CAPTURE_BASE_URL points at
// the running SPA (dev: the Vite server; prod: the deployed site).
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { capturePageUrl } from './renderVariant.js';

const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:5175';
const FRAME = { width: 380, height: 520 };

// The orbit eases out to a genuinely flat pose while still shiny. The following
// base hold lets the card-specific holo reveal reverse completely before the outro.
const DEFAULTS = {
  restFrames: 8,
  orbitFrames: 75,
  minBaseFrames: 18,
  returnPaddingFrames: 3,
  fadeFrames: 12,
  blackHoldFrames: 3,
  outroFadeFrames: 10,
  outroHoldFrames: 22,
  fps: 25, settleMs: 200
};

// One shared headless browser, launched lazily and reused across renders.
// Playwright is imported dynamically so merely importing this module (e.g. via the
// card routes in tests) doesn't pull in chromium — it's only needed to render.
let browserPromise = null;
const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = import('playwright')
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch(err => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
};

export const closeBrowser = async () => {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close();
  }
};

// Elliptical tilt path: the pointer orbits the card centre, sweeping the holo across
// the face and tilting it through a full loop. t in [0,1).
const poseFor = (t, box, radiusScale = 1) => {
  const theta = t * Math.PI * 2;
  // Stay inside the card so the tilt never maxes out flat. 0.34 of half-extent.
  const rx = box.width * 0.34 * radiusScale;
  const ry = box.height * 0.34 * radiusScale;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx + Math.sin(theta) * rx, y: cy - Math.cos(theta) * ry };
};

const smoothstep = (value) => {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
};

const durationSeconds = (value) => {
  const match = String(value || '').trim().match(/^([\d.]+)(ms|s)$/);
  if (!match) return 0;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return 0;
  return match[2] === 'ms' ? number / 1000 : number;
};

export const buildCaptureStates = ({ restFrames, orbitFrames, baseFrames }) => {
  const rest = Array.from({ length: restFrames }, () => ({
    nx: 0, ny: 0, shiny: false, scale: 0.95
  }));
  const orbit = Array.from({ length: orbitFrames }, (_, index) => {
    const progress = orbitFrames <= 1 ? 1 : index / (orbitFrames - 1);
    const ramp = 0.14;
    const envelope = smoothstep(progress / ramp) * smoothstep((1 - progress) / ramp);
    const angle = progress * Math.PI * 2;
    return {
      nx: Math.sin(angle) * 0.6 * envelope,
      ny: Math.cos(angle) * 0.45 * envelope,
      shiny: true,
      scale: 0.95 + envelope * 0.05
    };
  });
  const base = Array.from({ length: baseFrames }, () => ({
    nx: 0, ny: 0, shiny: false, scale: 0.95
  }));
  return [...rest, ...orbit, ...base];
};

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  p.stderr.on('data', d => { stderr += d; });
  p.on('error', reject);
  p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`)));
});

// Capture `format` ('gif' | 'mp4') for card `id`. Returns a Buffer.
export const renderCard = async (id, { format = 'gif', includeUrl = true, ...opts } = {}) => {
  const {
    restFrames, orbitFrames, minBaseFrames, returnPaddingFrames,
    fadeFrames, blackHoldFrames, outroFadeFrames, outroHoldFrames,
    fps, settleMs
  } = { ...DEFAULTS, ...opts };
  const browser = await getBrowser();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `r5c-cap-${id}-`));
  const context = await browser.newContext({
    viewport: { width: FRAME.width, height: FRAME.height },
    deviceScaleFactor: 2 // crisp output
  });
  const page = await context.newPage();

  try {
    // Not networkidle: the Vite dev server keeps an HMR socket open, so the network
    // never goes idle. The page's own __captureReady flag is the real signal.
    await page.goto(capturePageUrl(BASE_URL, id, includeUrl), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__captureReady === true, { timeout: 20000 });

    const frame = page.locator('#capture-frame');
    const scene = page.locator('.card-scene');
    if (await scene.count() !== 1) throw new Error('card scene not found on capture page');

    const revealDuration = await page.locator('.card-container').evaluate(el => (
      getComputedStyle(el).getPropertyValue('--holo-reveal-duration')
    ));
    const baseFrames = Math.max(
      minBaseFrames,
      Math.ceil(durationSeconds(revealDuration) * fps) + returnPaddingFrames
    );
    const captureStates = buildCaptureStates({ restFrames, orbitFrames, baseFrames });
    const total = captureStates.length + fadeFrames +
      blackHoldFrames + outroFadeFrames + outroHoldFrames;
    const pad = String(total).length;
    let f = 0;
    const shoot = async () => {
      await frame.screenshot({ path: path.join(tmp, `f${String(f).padStart(pad, '0')}.png`) });
      f++;
    };

    // Flat base → one shiny orbit → flat base. There is deliberately no plain
    // rotating stretch: the orbit returns to zero tilt before holo disengages.
    // Waiting one output-frame between poses lets reveal transitions advance.
    await page.waitForTimeout(settleMs);
    for (const state of captureStates) {
      await page.evaluate(value => window.__setCapturePose(value), state);
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }

    // Fade the now-flat base card to black.
    for (let i = 0; i < fadeFrames; i++) {
      const opacity = Math.max(0, 1 - (i + 1) / fadeFrames).toFixed(3);
      await page.evaluate(o => {
        const el = document.querySelector('.card-scene');
        if (el) el.style.opacity = o;
      }, opacity);
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }

    // End card. A short black breath, then the R5c wordmark fades in and
    // holds. Public-site exports include requirement5.com; operator outreach can
    // omit the URL while retaining the mark and Join the Resistance.
    const setOutro = (o) => page.evaluate(v => {
      const el = document.querySelector('#capture-outro');
      if (el) el.style.opacity = v;
    }, String(o));

    for (let i = 0; i < blackHoldFrames; i++) {
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }
    for (let i = 0; i < outroFadeFrames; i++) {
      await setOutro(Math.min(1, (i + 1) / outroFadeFrames).toFixed(3));
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }
    await setOutro(1);
    for (let i = 0; i < outroHoldFrames; i++) {
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }

    const pattern = path.join(tmp, `f%0${pad}d.png`);
    const out = path.join(tmp, `out.${format}`);

    if (format === 'mp4') {
      await run('ffmpeg', [
        '-y', '-framerate', String(fps), '-i', pattern,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        // h264 needs even dimensions
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        out
      ]);
    } else {
      // Two-pass GIF. Two non-obvious details, both learned the hard way:
      //   format=rgb24 after the lanczos scale: lanczos overshoots at the stark
      //   logo edge, pushing values out of [0,255]; unclamped they wrap (white→black)
      //   and the end-card badge inverts. format=rgb24 clamps before paletteuse.
      //   stats_mode=full (not diff): the held end card is near-static, so a
      //   diff-weighted palette under-represents its black/white/amber.
      const palette = path.join(tmp, 'palette.png');
      await run('ffmpeg', ['-y', '-framerate', String(fps), '-i', pattern,
        '-vf', 'scale=380:-1:flags=lanczos,format=rgb24,palettegen=stats_mode=full', palette]);
      await run('ffmpeg', ['-y', '-framerate', String(fps), '-i', pattern, '-i', palette,
        '-lavfi', 'scale=380:-1:flags=lanczos,format=rgb24[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', out]);
    }

    return fs.readFileSync(out);
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

// Capture `count` still PNGs of the card: one at rest, the others along the
// same orbit the GIF uses, holo awake. Cheap relative to a full render (no
// ffmpeg, ~a dozen frames instead of ~130) — meant for agents that want to
// SEE a card (or a draft) without pulling a whole GIF apart.
export const renderStills = async (id, { count = 4, settleMs = 250 } = {}) => {
  const n = Math.max(1, Math.min(8, count));
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: FRAME.width, height: FRAME.height },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/capture/${id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__captureReady === true, { timeout: 20000 });

    const frame = page.locator('#capture-frame');
    const scene = page.locator('.card-scene');
    const box = await scene.boundingBox();
    if (!box) throw new Error('card scene not found on capture page');

    const buffers = [];
    // Still 1: at rest — pointer off the card, holo dormant.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(settleMs);
    buffers.push(await frame.screenshot());

    // Remaining stills: poses along the orbit, holo awake. Spread over one
    // loop, skipping t=0 so the first orbit pose differs from rest visibly.
    for (let i = 1; i < n; i++) {
      const { x, y } = poseFor((i / n) * 0.9 + 0.05, box);
      await page.mouse.move(x, y);
      await page.waitForTimeout(settleMs);
      buffers.push(await frame.screenshot());
    }
    return buffers;
  } finally {
    await context.close().catch(() => {});
  }
};

export const MIME = { gif: 'image/gif', mp4: 'video/mp4', png: 'image/png' };
