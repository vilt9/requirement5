// Card → GIF/MP4 capture. Drives the live holographic card through a deterministic
// tilt orbit and records it, so a card can be posted as a moving image on social.
//
// How it works: Playwright loads the chrome-free /capture/:id page (CaptureCard.jsx),
// then for each frame dispatches a synthetic mousemove onto the real .card-scene at a
// point on an elliptical path. The card's own handler turns that into tilt + holo, so
// we record exactly the live effect — no animation logic is duplicated here. Frames are
// screenshotted (clipped to #capture-frame) and stitched by ffmpeg into an MP4 and GIF.
//
// Requires Playwright (with chromium) and ffmpeg on the host. CAPTURE_BASE_URL points at
// the running SPA (dev: the Vite server; prod: the deployed site).
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:5175';
const FRAME = { width: 380, height: 520 };

// Render defaults. The clip has a small arc: it opens on the card at rest (holo
// dormant, flat), then the pointer crosses on — the holo wakes — and the card orbits;
// the tail fades to black, then the R5c end card fades in and holds. The card portion
// is ~3.1s; the outro adds ~1.4s. All at 25fps for smooth motion at a modest file size.
const DEFAULTS = {
  restFrames: 12, moveFrames: 66, fadeFrames: 18,           // card: rest → wake+orbit → fade
  blackHoldFrames: 3, outroFadeFrames: 10, outroHoldFrames: 22, // end card: breath → fade in → hold
  fps: 25, settleMs: 200
};

// One shared headless browser, launched lazily and reused across renders.
let browserPromise = null;
const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch(err => {
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
const poseFor = (t, box) => {
  const theta = t * Math.PI * 2;
  // Stay inside the card so the tilt never maxes out flat. 0.34 of half-extent.
  const rx = box.width * 0.34;
  const ry = box.height * 0.34;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx + Math.sin(theta) * rx, y: cy - Math.cos(theta) * ry };
};

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  p.stderr.on('data', d => { stderr += d; });
  p.on('error', reject);
  p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`)));
});

// Capture `format` ('gif' | 'mp4') for card `id`. Returns a Buffer.
export const renderCard = async (id, { format = 'gif', ...opts } = {}) => {
  const {
    restFrames, moveFrames, fadeFrames,
    blackHoldFrames, outroFadeFrames, outroHoldFrames,
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
    await page.goto(`${BASE_URL}/capture/${id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__captureReady === true, { timeout: 20000 });

    const frame = page.locator('#capture-frame');
    const scene = page.locator('.card-scene');
    const box = await scene.boundingBox();
    if (!box) throw new Error('card scene not found on capture page');

    const total = restFrames + moveFrames + blackHoldFrames + outroFadeFrames + outroHoldFrames;
    const pad = String(total).length;
    let f = 0;
    const shoot = async () => {
      await frame.screenshot({ path: path.join(tmp, `f${String(f).padStart(pad, '0')}.png`) });
      f++;
    };

    // Phase 1 — at rest: pointer parked off the card, holo dormant, card flat.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(settleMs);
    for (let i = 0; i < restFrames; i++) {
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }

    // Phase 2 — the pointer crosses onto the card (hover wakes the holo over its
    // 0.3s bloom) and orbits; the last fadeFrames ramp the card's opacity to black
    // while it keeps moving.
    const fadeStart = moveFrames - fadeFrames;
    for (let i = 0; i < moveFrames; i++) {
      const { x, y } = poseFor(i / moveFrames, box);
      await page.mouse.move(x, y); // first iteration is the rest→hover crossing
      if (i >= fadeStart) {
        const opacity = Math.max(0, 1 - (i - fadeStart + 1) / fadeFrames).toFixed(3);
        await page.evaluate(o => {
          const el = document.querySelector('.card-scene');
          if (el) el.style.opacity = o;
        }, opacity);
      }
      // let the holo transition catch up to the new pose before the shot
      await page.waitForTimeout(1000 / fps);
      await shoot();
    }

    // Phase 3 — end card. A short black breath, then the R5c wordmark fades in and
    // holds, so every clip closes on requirement5.com / Join the Resistance.
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

export const MIME = { gif: 'image/gif', mp4: 'video/mp4' };
