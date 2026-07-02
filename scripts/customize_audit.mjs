// End-to-end audit (npm run test:e2e). Drives every interactive control on
// /customize, then checks the card preview DOM actually changed; also covers the
// tags + preset-sets flow. Reports per-control pass/fail plus any console/page
// errors. Exit code is non-zero on any failure, so it's CI-usable.
//
// Prerequisites: the Vite dev server and API must already be running
//   npm run dev       (front end, default :5174 — override with APP_URL)
//   npm run server    (API, :4000 — override with API_URL)
// Then: npm run test:e2e
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = process.env.APP_URL || 'http://localhost:5174';
const API_URL = process.env.API_URL || 'http://localhost:4000';
const SHOTS = '/tmp/customize_audit';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const report = (control, action, changed, note = '') => {
  results.push({ control, action, changed, note });
  const mark = changed === true ? 'OK ' : changed === false ? 'FAIL' : 'INFO';
  console.log(`[${mark}] ${control} — ${action}${note ? ` (${note})` : ''}`);
};

// Fresh user so publish/save flows are live.
const signup = async () => {
  const username = `audit_${Date.now().toString(36)}`;
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' })
  });
  const body = await res.json();
  if (!body.success) throw new Error(`signup failed: ${body.error}`);
  return body.data;
};

const main = async () => {
  const { token, user } = await signup();
  console.log(`auditing as ${user.username} (balance ${user.balance} /t26)\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await context.addInitScript(t => localStorage.setItem('r5c_token', t), token);
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', err => errors.push(`pageerror: ${String(err).slice(0, 200)}`));

  await page.goto(`${APP_URL}/customize`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card-preview-section', { timeout: 10000 });
  await page.waitForTimeout(800);
  // The preview's auto motion continuously mutates the card's inline styles,
  // which would make every before/after snapshot diff spuriously — rest it.
  await page.locator('.preview-tools button[data-motion=off]').click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '0_initial.png'), fullPage: true });

  // Snapshot of the preview card: inline styles + generated classes change when params do.
  const snapshot = () => page.evaluate(() => {
    const el = document.querySelector('.card-preview-section');
    return el ? el.innerHTML : '';
  });

  // Is this element inside the publish panel? (tested separately)
  const markPublish = (el) => {
    let node = el;
    while (node && !node.classList?.contains('controls-inner')) {
      if (node.textContent?.startsWith('Publish to the pool')) return true;
      node = node.parentElement;
    }
    return false;
  };

  const describeControls = () => page.evaluate(([markPublishSrc]) => {
    const markPublish = eval(markPublishSrc);
    const scope = document.querySelector('.controls-inner') || document;
    const describe = (el) => {
      // Walk up looking for the control group's label, then the section heading.
      let node = el;
      for (let i = 0; i < 5 && node; i++) {
        const label = node.querySelector?.('label');
        if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 50);
        node = node.parentElement;
      }
      const section = el.closest('section, [class*=Section]');
      const heading = section?.querySelector('h2, h3, h4')?.textContent?.trim();
      return (heading || el.name || el.type || 'unlabelled').slice(0, 50);
    };
    const grab = (selector, kind) =>
      [...scope.querySelectorAll(selector)].map((el, i) => ({
        kind,
        index: i,
        label: describe(el),
        inPublish: markPublish(el),
        value: el.value,
        min: el.min, max: el.max,
        checked: el.checked,
        options: el.tagName === 'SELECT' ? [...el.options].map(o => o.value) : undefined
      }));
    // number inputs are paired twins of the sliders — testing both double-counts
    return [
      ...grab('input[type=range]', 'range'),
      ...grab('input[type=checkbox]', 'checkbox'),
      ...grab('select', 'select'),
      ...grab('input[type=file]', 'file')
    ];
  }, [markPublish.toString()]);

  // Drive a control with React-compatible synthetic events.
  const drive = (kind, index, value) => page.evaluate(([kind, index, value]) => {
    const scope = document.querySelector('.controls-inner') || document;
    const selectorByKind = {
      range: 'input[type=range]',
      checkbox: 'input[type=checkbox]',
      select: 'select',
      number: 'input[type=number]'
    };
    const el = [...scope.querySelectorAll(selectorByKind[kind])][index];
    if (!el) return false;
    if (kind === 'checkbox') {
      el.click();
      return true;
    }
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [kind, index, value]);

  // Toggle a checkbox on by its exact label (no-op if already on).
  const enableToggle = (name) => page.evaluate((name) => {
    const scope = document.querySelector('.controls-inner');
    const lab = [...scope.querySelectorAll('label')].find(l => l.textContent.trim() === name);
    if (!lab) return false;
    let g = lab.parentElement, cb = null;
    for (let i = 0; i < 5 && g && !cb; i++) { cb = g.querySelector('input[type=checkbox]'); g = g.parentElement; }
    if (cb && !cb.checked) { cb.click(); return true; }
    return !!cb;
  }, name);

  const tested = new Set();
  const TABS = ['image', 'holo', 'frame', 'background'];

  // The customizer is staged (start → design → publish); pick the stage first.
  const selectStage = async (key) => {
    await page.click(`.customizer-stage[data-stage=${key}]`).catch(() => {});
    await page.waitForTimeout(300);
  };
  // The controls are split across tabs (design stage); switch tab and let its DOM mount.
  const selectTab = async (key) => {
    await page.click(`.customizer-tab[data-tab=${key}]`).catch(() => {});
    await page.waitForTimeout(300);
  };
  // Hover the card steadily so hover-only variables (effect intensity, mouse
  // response speed) are live; keep the cursor fixed so only the driven control moves.
  const hoverCard = async () => {
    const box = await page.locator('.card-scene').first().boundingBox();
    if (box) await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForTimeout(150);
  };

  // Read a control's live value right before driving it. React's value-tracker
  // suppresses onChange when the value set equals the input's *current* value, so
  // a stale target (captured at describe time, since changed by an earlier control)
  // can be silently ignored. Re-reading guarantees we pick a value that differs.
  const liveValue = (kind, index) => page.evaluate(([kind, index]) => {
    const sel = { range: 'input[type=range]', number: 'input[type=number]', select: 'select' }[kind];
    const el = [...document.querySelector('.controls-inner').querySelectorAll(sel)][index];
    return el ? el.value : null;
  }, [kind, index]);

  const kindOrder = { range: 0, number: 1, select: 2, checkbox: 3 };
  const sweep = async () => {
    const controls = (await describeControls())
      .sort((a, b) => (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9)); // checkboxes last so they don't hide untested controls
    for (const control of controls) {
      if (control.inPublish || control.kind === 'file') continue;
      const key = `${control.kind}|${control.label}`;
      if (tested.has(key)) continue;
      tested.add(key);
      const id = `${control.kind} · ${control.label}`;

      let target;
      if (control.kind === 'range' || control.kind === 'number') {
        const min = parseFloat(control.min || 0), max = parseFloat(control.max || 1);
        const current = parseFloat(await liveValue(control.kind, control.index));
        target = Math.abs(current - max) >= Math.abs(current - min) ? max : min;
        if (target === current) target = current === max ? min : max; // guarantee a real change
        target = String(target);
      } else if (control.kind === 'select') {
        const current = await liveValue(control.kind, control.index);
        target = control.options.find(o => o !== current) ?? current;
      }

      const before = await snapshot();
      await drive(control.kind, control.index, target);
      await page.waitForTimeout(220);
      const after = await snapshot();
      report(id, control.kind === 'checkbox' ? 'toggled' : `set to ${target}`, before !== after);
      // Restore checkboxes so toggling a parent (e.g. "Enable Panel") off doesn't
      // leave dependent controls (e.g. "Enable Panel Image") inert for later tests.
      if (control.kind === 'checkbox') {
        await drive(control.kind, control.index, null);
        await page.waitForTimeout(120);
      }
    }
  };

  // Rarity only selects the auto holo class when NO explicit holo toggle is on, so
  // test it on the holo tab before setup enables the toggles that override it.
  await selectStage('design');
  await selectTab('holo');
  {
    const before = await snapshot();
    const moved = await page.evaluate(() => {
      const scope = document.querySelector('.controls-inner');
      const lab = [...scope.querySelectorAll('label')].find(l => l.textContent.includes('Rarity'));
      if (!lab) return false;
      let g = lab.parentElement, el = null;
      for (let i = 0; i < 5 && g && !el; i++) { el = g.querySelector('input[type=range]'); g = g.parentElement; }
      if (!el) return false;
      const target = parseFloat(el.value) > 0.5 ? '0' : '1';
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, target);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return target;
    });
    if (moved !== false) {
      await page.waitForTimeout(250);
      report('range · Rarity (Affects Holo Visibility)', `set to ${moved} (no toggles)`, before !== (await snapshot()));
      tested.add('range|Rarity (Affects Holo Visibility)');
    }
  }

  // Setup: a control only affects the preview when its effect layer is live, so
  // upload a main image (image tab) and enable every effect (holo + frame tabs)
  // before sweeping. Otherwise tier-specific sliders look "broken".
  console.log('— setup: upload image + enable all effects —');
  const sampleImage = path.resolve(process.cwd(), '..', 'card_images', 'wolf_toys_1.png');
  await selectStage('design');
  await selectTab('image');
  const mainFile = page.locator('.image-picker input[type=file]').first();
  if (await mainFile.count()) { await mainFile.setInputFiles(sampleImage); await page.waitForTimeout(800); }
  await selectTab('holo');
  for (const name of ['Rare Holo Galaxy', 'Rare Holo VMAX', 'Wowa Holo', 'Rare Holo']) {
    await enableToggle(name);
    await page.waitForTimeout(150);
  }
  await selectTab('frame');
  for (const name of ['Enable Panel', 'Enable Panel Image']) {
    await enableToggle(name);
    await page.waitForTimeout(150);
  }

  // Sweep every tab: switch, hover, then drive each control (deduped by label).
  console.log('\n— sweep: every control across all tabs —');
  for (const tab of TABS) {
    await selectTab(tab);
    await hoverCard();
    console.log(`  · tab: ${tab}`);
    await sweep();
    await sweep(); // re-describe to catch anything a toggle revealed
  }
  await page.screenshot({ path: path.join(SHOTS, '1_after_sweep.png'), fullPage: true });

  // Phase 3: color pickers (react-color portals), per tab.
  console.log('\n— phase 3: color pickers —');
  const closePicker = async () => {
    await page.mouse.click(5, 500).catch(() => {});
    await page.waitForSelector('.sketch-picker', { state: 'detached', timeout: 1500 }).catch(() => {});
  };
  // react-color re-renders on change, invalidating cached element handles, so
  // re-query the i-th swatch fresh each iteration and ensure any open picker closes.
  const colorSweepTab = async () => {
    const swatchCount = await page.evaluate(() => {
      const scope = document.querySelector('.controls-inner');
      return [...scope.querySelectorAll('div')].filter(d =>
        d.style?.backgroundColor && d.previousElementSibling === null &&
        d.parentElement?.previousElementSibling?.querySelector?.('label')).length;
    });
    for (let i = 0; i < swatchCount; i++) {
      await closePicker();
      const label = await page.evaluate(i => {
        const scope = document.querySelector('.controls-inner');
        const swatches = [...scope.querySelectorAll('div')].filter(d =>
          d.style?.backgroundColor && d.previousElementSibling === null &&
          d.parentElement?.previousElementSibling?.querySelector?.('label'));
        window.__sw = swatches[i];
        return swatches[i]?.closest('div').parentElement?.querySelector('label')?.textContent?.trim() || `swatch ${i}`;
      }, i);
      // Unlabelled hits are non-interactive display swatches (e.g. gradient preview).
      if (/^swatch \d+$/.test(label)) continue;
      if (tested.has(`color|${label}`)) continue;
      tested.add(`color|${label}`);
      const before = await snapshot();
      await page.evaluate(() => window.__sw?.click());
      await page.waitForTimeout(250);
      const hexInput = page.locator('.sketch-picker input').first();
      if (await hexInput.count()) {
        const cur = (await hexInput.inputValue()).replace('#', '').toLowerCase();
        const next = cur === 'ff0066' ? '00ff88' : 'ff0066';
        await hexInput.fill(next);
        await hexInput.press('Enter');
        await page.waitForTimeout(300);
        report(`color picker: ${label}`, `set #${next}`, before !== (await snapshot()));
        await closePicker();
      } else {
        report(`color picker: ${label}`, 'open picker', false, 'SketchPicker did not open');
      }
    }
  };
  for (const tab of ['frame', 'background', 'holo']) {
    await selectTab(tab);
    await colorSweepTab();
  }

  // Phase 4: image uploads (design stage; base on the image tab, holo on the
  // holo tab). Use a DIFFERENT image than setup's so the input registers a
  // real change (re-uploading the same file is a no-op).
  console.log('\n— phase 4: image uploads + library —');
  await selectStage('design');
  const altImage = path.resolve(process.cwd(), '..', 'card_images', 'bed_elephant_1.png');
  for (const [tab, slot] of [['image', 'main'], ['holo', 'holo']]) {
    await selectTab(tab);
    const input = page.locator(`.image-picker-${slot} input[type=file]`);
    if (!(await input.count())) {
      report(`file input (${slot})`, 'find', false, `no picker on ${tab} tab`);
      continue;
    }
    const before = await snapshot();
    await input.setInputFiles(altImage);
    await page.waitForTimeout(900);
    report(`file input (${slot})`, 'uploaded bed_elephant_1.png', before !== (await snapshot()));
  }
  // Uploads must land in the reusable image library, and tapping an entry must
  // apply it to this tab's slot (base, on the image tab).
  // The library is collapsed by default — pop it open first.
  await selectTab('image');
  await page.locator('.image-picker-main .library-toggle').click().catch(() => {});
  await page.waitForTimeout(200);
  const libCount = await page.locator('.image-picker-main .library-item').count();
  report('image library', 'uploads appear in library', libCount > 0, `${libCount} item(s)`);
  if (libCount > 0) {
    // The newest entry IS the current base image (just uploaded), so applying it
    // is a no-op; use the oldest entry to guarantee a real change.
    const before = await snapshot();
    await page.locator('.image-picker-main .library-item .use').last().click();
    await page.waitForTimeout(600);
    report('image library', 'tap-to-use updates preview', before !== (await snapshot()));
  }
  await page.screenshot({ path: path.join(SHOTS, '3_after_uploads.png'), fullPage: true });

  // Phase 5/6: publish flow (publish stage)
  console.log('\n— phase 5: publish —');
  await selectStage('publish');
  const nameInput = page.locator('input[placeholder="Card name"]');
  if (await nameInput.count()) {
    await nameInput.fill('Audit card');
    const tierSelect = page.locator('select').last();
    await tierSelect.selectOption('galaxy');
    const balanceBefore = await page.evaluate(() => document.querySelector('nav')?.textContent || '');
    await page.locator('button', { hasText: /^Publish \(/ }).click();
    const published = await page.waitForSelector('text=/Published to the pool/', { timeout: 8000 }).catch(() => null);
    const balanceAfter = await page.evaluate(() => document.querySelector('nav')?.textContent || '');
    report('publish panel', 'published galaxy card', !!published,
      published ? `nav balance: "${balanceBefore.match(/[\d.]+ \/t26/)?.[0]}" → "${balanceAfter.match(/[\d.]+ \/t26/)?.[0]}"` : 'no success message');
  } else {
    report('publish panel', 'find form', false, 'name input not found (logged out?)');
  }
  await page.screenshot({ path: path.join(SHOTS, '4_final.png'), fullPage: true });

  // Phase 7: tags + preset sets. Tags + "save set" live in the publish stage;
  // "load a set" lives in the start stage.
  console.log('\n— phase 7: tags + presets —');
  await selectStage('publish');
  const tagInput = page.locator('.tag-section input');
  if (await tagInput.count()) {
    await tagInput.fill('audittag');
    await tagInput.press('Enter');
    const chip = await page.locator('.tag-section').locator('text=#audittag').count();
    report('tag input', 'add #audittag', chip > 0, chip > 0 ? 'chip rendered' : 'no chip');

    await page.locator('.preset-name').fill('Audit set');
    await page.locator('.preset-save').click();
    await page.waitForTimeout(300);
    await selectStage('start');
    const optionExists = await page.locator('.preset-select option', { hasText: 'Audit set' }).count();
    report('preset save', 'save "Audit set"', optionExists > 0, optionExists > 0 ? 'in dropdown' : 'missing');

    // Reload gives a fresh card (no tags); loading the preset must restore them.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.selectOption('.preset-select', { label: 'Audit set' }).catch(() => {});
    await page.waitForTimeout(300);
    await selectStage('publish');
    const restored = await page.locator('.tag-section').locator('text=#audittag').count();
    report('preset load', 'restores tags after reload', restored > 0, restored > 0 ? '#audittag restored' : 'tags not restored');
  } else {
    report('tag input', 'find', false, 'tag section not found (logged out?)');
  }

  await browser.close();

  console.log('\n— summary —');
  const failed = results.filter(r => r.changed === false);
  console.log(`${results.length} checks, ${failed.length} failed`);
  if (errors.length) {
    console.log(`\n${errors.length} page errors:`);
    [...new Set(errors)].slice(0, 10).forEach(e => console.log('  ' + e));
  } else {
    console.log('no console/page errors');
  }
  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(`screenshots + report: ${SHOTS}`);
  process.exit(failed.length ? 1 : 0);
};

main().catch(err => { console.error(err); process.exit(2); });
