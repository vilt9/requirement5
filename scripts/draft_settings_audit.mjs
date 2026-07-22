// Playwright audit for an existing private draft. It temporarily installs a
// complete design, exercises every mounted design control, verifies autosave +
// reload, checks image/layer rendering, then restores the original draft.
//
// Required: DRAFT_ID, AUDIT_USERNAME, AUDIT_PASSWORD, ALLOW_DRAFT_MUTATION=1
// Optional: APP_URL (5173), API_URL (4000), AUDIT_OUT (/tmp/r5-draft-audit)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173';
const API_URL = process.env.API_URL || 'http://127.0.0.1:4000';
const DRAFT_ID = process.env.DRAFT_ID;
const USERNAME = process.env.AUDIT_USERNAME;
const PASSWORD = process.env.AUDIT_PASSWORD;
const OUT = process.env.AUDIT_OUT || '/tmp/r5-draft-audit';

if (!DRAFT_ID || !USERNAME || !PASSWORD || process.env.ALLOW_DRAFT_MUTATION !== '1') {
  throw new Error('Set DRAFT_ID, AUDIT_USERNAME, AUDIT_PASSWORD, and ALLOW_DRAFT_MUTATION=1');
}
fs.mkdirSync(OUT, { recursive: true });

const call = async (route, { token, method = 'GET', body } = {}) => {
  const response = await fetch(`${API_URL}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(`${method} ${route}: ${response.status} ${payload.error || 'failed'}`);
  }
  return payload.data;
};

const valueAt = (object, dotted) => dotted.split('.').reduce((value, key) => value?.[key], object);
const sameValue = (actual, expected, type) => {
  if (type === 'checkbox') {
    const wanted = typeof expected === 'string' ? expected === 'extreme' : !!expected;
    return actual === wanted;
  }
  if (type === 'range' || type === 'number') return Number(actual) === Number(expected);
  return String(actual) === String(expected);
};

const pixelDiff = async (before, after) => {
  const a = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(after).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.data.length !== b.data.length) return Infinity;
  let total = 0;
  for (let i = 0; i < a.data.length; i++) total += Math.abs(a.data[i] - b.data[i]);
  return total / a.data.length;
};

const fixtureFor = (original) => ({
  ...original,
  imagePath: original.imagePath && original.imagePath !== 'default'
    ? original.imagePath
    : 'digital_race_2.webp',
  customHoloImageUrl: '/assets/new_shiny_imgs/illusion2.png',
  imageEffects: {
    ...(original.imageEffects || {}),
    opacity: 0.88,
    opacityHover: 0.72,
    contrast: 1.15,
    saturation: 1.3
  },
  effectParams: {
    ...(original.effectParams || {}),
    parallaxDepth: 0.42,
    customHoloBlendMode: 'screen',
    sheenAngle: 35,
    sheenSpace: 16,
    sheenShine: 0.75,
    veilPresence: 0.35,
    aberrationIntensity: 0.3,
    sheenBrightness: 1.1,
    sheenContrast: 1.2,
    sheenSaturate: 1.25,
    sheenDrift: 1.4
  },
  baseBackground: {
    type: 'radial',
    color1: '#184e68',
    color2: '#08151e',
    color3: '#d65a3a',
    useThird: true,
    angle: 145,
    posX: 42,
    posY: 58,
    fadeStart: 8,
    fadeEnd: 92,
    vignette: 0.28,
    grain: 0.14
  },
  borderEffects: {
    ...(original.borderEffects || {}),
    thickBorderEnabled: true,
    borderImageEnabled: true,
    color: 'rgb(236, 178, 70)',
    opacity: 0.35,
    colorHover: 'rgb(92, 220, 210)',
    opacityHover: 0.65,
    imageOpacity: 0.55,
    transitionDuration: 0.4,
    edgeColor1: 'rgba(255, 220, 120, 0.9)',
    edgeColor2: 'rgba(70, 220, 210, 0.2)'
  },
  holoEffects: {
    overlay: true,
    rareHolo: true,
    rareHoloGalaxy: true,
    wowaHolo: true,
    rareHoloVmax: true
  },
  rareHoloParams: {
    space: 1.8,
    hue: 24,
    saturation: 75,
    lightness: 55,
    intensity: 'extreme',
    filterStrength: 1.2,
    mouseSpeed: 1.4,
    blendMode: 'soft-light',
    backgroundImage: '/assets/new_shiny_imgs/angular.png',
    imagePresence: 0.45,
    imageBlendMode: 'screen',
    layerGradient: true,
    colors: ['rgb(255, 60, 80)', 'rgb(30, 220, 255)', 'rgb(255, 220, 70)']
  },
  rareHoloGalaxyParams: {
    space: 4.5,
    brightness: 0.9,
    contrast: 1.4,
    saturation: 1.7,
    blendMode: 'color-dodge',
    gradientSize: 450,
    gradientHeight: 900,
    smoothTransitions: 0.4,
    backgroundImage: '/assets/new_shiny_imgs/illusion.png',
    imagePresence: 0.5,
    imageBlendMode: 'overlay',
    layerGradient: true,
    colors: ['rgb(220, 190, 70)', 'rgb(60, 210, 190)', 'rgb(155, 70, 220)']
  },
  wowaHoloParams: {
    space: 4,
    angle: 55,
    brightness: 0.8,
    contrast: 1.4,
    backgroundImage: '/assets/new_shiny_imgs/geometric.png',
    imagePresence: 0.4,
    imageBlendMode: 'hard-light',
    layerGradient: true
  },
  rareHoloVmaxParams: {
    space: 6.5,
    angle: 125,
    brightness: 0.75,
    contrast: 2.2,
    backgroundImage: '/assets/new_shiny_imgs/crossover.png',
    imagePresence: 0.4,
    imageBlendMode: 'screen',
    layerGradient: true
  }
});

const main = async () => {
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD }
  });
  const token = login.token;
  const originalCard = await call(`/api/cards/${DRAFT_ID}`, { token });
  if (originalCard.is_public || originalCard.creator_id !== login.user.id) {
    throw new Error('Audit target must be a private draft owned by the audit user');
  }
  const originalState = originalCard.state_data;
  const fixture = fixtureFor(originalState?.customCard || {});
  let browser;

  try {
    await call(`/api/cards/${DRAFT_ID}`, {
      token,
      method: 'PUT',
      body: { stateData: { customCard: fixture, version: 'audit' }, tags: originalCard.tags || [] }
    });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await context.addInitScript(value => localStorage.setItem('r5c_token', value), token);
    const page = await context.newPage();
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(String(error)));

    await page.goto(`${APP_URL}/create?draft=${DRAFT_ID}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Holographic' }).waitFor();
    const pause = page.getByRole('button', { name: 'Pause card motion' });
    if (await pause.count()) await pause.click();

    const card = page.locator('.card-scene').first();
    const screenshotCard = () => card.screenshot({ animations: 'disabled' });
    const reports = [];
    const check = (name, ok, detail = '') => {
      reports.push({ name, ok, detail });
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
    };

    const selectTab = async (tab) => {
      await page.locator(`.customizer-tab[data-tab="${tab}"]`).click();
      await page.waitForTimeout(120);
    };

    const readControls = () => page.locator('.controls-inner [data-param]').evaluateAll(nodes => {
      const seen = new Set();
      return nodes.flatMap(node => {
        const param = node.dataset.param;
        if (!param || seen.has(param)) return [];
        // Prefer the range half of a range+number pair.
        if (node.type === 'number' && node.parentElement?.querySelector(`input[type="range"][data-param="${param}"]`)) return [];
        seen.add(param);
        return [{
          param,
          type: node.type || node.tagName.toLowerCase(),
          value: node.type === 'checkbox' ? node.checked : node.value,
          min: node.min,
          max: node.max,
          options: node.tagName === 'SELECT' ? [...node.options].map(option => option.value) : []
        }];
      });
    });

    const verifyBindings = async (expected, phase) => {
      let count = 0;
      for (const tab of ['image', 'holo', 'background', 'frame']) {
        await selectTab(tab);
        const controls = await readControls();
        for (const control of controls) {
          const wanted = valueAt(expected, control.param);
          check(`${phase}: ${control.param}`, sameValue(control.value, wanted, control.type), `${control.value}`);
          count += 1;
        }
      }
      return count;
    };

    const initialCount = await verifyBindings(fixture, 'initial');
    check('all expected control groups mounted', initialCount >= 55, `${initialCount} bound controls`);

    await selectTab('image');
    const baseImage = await page.locator('.upload-slot-main img').evaluate(img => ({
      src: img.src, width: img.naturalWidth, height: img.naturalHeight
    }));
    check('base image restored', baseImage.width > 0 && baseImage.src.includes(fixture.imagePath), baseImage.src);

    await selectTab('holo');
    const holoImages = await page.locator('.holo-image-input img').evaluateAll(images => images.map(img => ({
      src: img.src, width: img.naturalWidth, height: img.naturalHeight
    })));
    check('Veil + four system images restored', holoImages.length === 5 && holoImages.every(img => img.width > 0), `${holoImages.length} images`);
    const layers = await page.evaluate(() => ({
      veil: document.querySelectorAll('.custom-holo-effect').length,
      prism: document.querySelectorAll('.rare-holo-background').length,
      nebula: document.querySelectorAll('.rare-holo-galaxy-background').length,
      signal: document.querySelectorAll('.wowa-holo-background').length,
      pulse: document.querySelectorAll('.rare-holo-vmax-background').length
    }));
    check('all five holo layers mounted', Object.values(layers).every(value => value > 0), JSON.stringify(layers));

    const setHoloSystems = async (enabled) => {
      await selectTab('holo');
      for (const param of [
        'holoEffects.overlay', 'holoEffects.rareHolo', 'holoEffects.rareHoloGalaxy',
        'holoEffects.wowaHolo', 'holoEffects.rareHoloVmax'
      ]) {
        const locator = page.locator(`.controls-inner input[type="checkbox"][data-param="${param}"]`);
        if ((await locator.isChecked()) !== enabled) await locator.evaluate(element => element.click());
      }
    };

    // Drive every non-toggle control. Each tab gets a pixel comparison so a
    // correctly saved but visually disconnected panel is still caught.
    let changedControls = 0;
    for (const tab of ['image', 'holo', 'background', 'frame']) {
      // Isolate the base and frame from the five intentionally strong holo
      // image layers; otherwise a correct change can be fully occluded.
      if (tab === 'background') await setHoloSystems(false);
      await selectTab(tab);
      const before = await screenshotCard();
      const controls = (await readControls()).sort((a, b) => (
        (a.type === 'select-one' ? 1 : 0) - (b.type === 'select-one' ? 1 : 0)
      ));
      for (const control of controls) {
        if (control.type === 'checkbox') continue;
        const locator = page.locator(`.controls-inner [data-param="${control.param}"]`).first();
        if (control.type === 'range') {
          const current = Number(control.value);
          const min = Number(control.min);
          const max = Number(control.max);
          await locator.fill(String(current <= (min + max) / 2 ? max : min));
        } else if (control.type === 'select-one') {
          const next = control.options.find(option => option !== control.value);
          if (next !== undefined) await locator.selectOption(next);
        } else if (control.type === 'text') {
          await locator.fill('rgba(18, 210, 168, 0.82)');
        }
        changedControls += 1;
      }
      await page.waitForTimeout(250);
      const after = await screenshotCard();
      const diff = await pixelDiff(before, after);
      check(`${tab} controls change card pixels`, diff > 0.8, `mean delta ${diff.toFixed(2)}`);
    }
    await setHoloSystems(true);

    // Toggle every checkbox off and back on. Parent holo toggles must remount
    // their layer without losing the tuned parameter objects.
    for (const tab of ['holo', 'background', 'frame']) {
      await selectTab(tab);
      const toggles = (await readControls()).filter(control => control.type === 'checkbox');
      for (const toggle of toggles) {
        const query = `.controls-inner input[type="checkbox"][data-param="${toggle.param}"]`;
        await page.locator(query).evaluate(element => element.click());
        await page.locator(query).evaluate(element => element.click());
        check(`toggle round trip: ${toggle.param}`, await page.locator(query).isChecked() === toggle.value);
      }
    }

    await page.waitForTimeout(1500);
    const savedCard = await call(`/api/cards/${DRAFT_ID}`, { token });
    const saved = savedCard.state_data.customCard;
    const savedCount = await verifyBindings(saved, 'saved');
    check('every changed control reached server draft', savedCount >= initialCount - 2, `${savedCount} controls`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Holographic' }).waitFor();
    const reloadedCount = await verifyBindings(saved, 'reloaded');
    check('every saved control restored after reload', reloadedCount === savedCount, `${reloadedCount} controls`);

    await selectTab('holo');
    await page.screenshot({ path: path.join(OUT, 'draft-holo.png'), fullPage: true, animations: 'disabled' });
    await selectTab('image');
    await page.screenshot({ path: path.join(OUT, 'draft-image.png'), fullPage: true, animations: 'disabled' });

    check('no browser console/page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    const failed = reports.filter(item => !item.ok);
    const summary = { checks: reports.length, failed: failed.length, changedControls, layers, errors, reports };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(summary, null, 2));
    console.log(`SUMMARY ${summary.checks} checks, ${summary.failed} failed, ${changedControls} controls changed`);
    if (failed.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await call(`/api/cards/${DRAFT_ID}`, {
      token,
      method: 'PUT',
      body: { stateData: originalState, tags: originalCard.tags || [] }
    });
    console.log('Original draft restored.');
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 2;
});
