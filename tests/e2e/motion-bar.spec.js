import { test, expect, devices } from '@playwright/test';

const CARD_PATH = '/card/00000000-0000-4000-8000-000000000001';

const expectUsableMotionBar = async (page) => {
  await page.goto(CARD_PATH);

  const bar = page.locator('.scrub-track');
  const track = bar.locator('.track');
  const pause = bar.getByRole('button', { name: /^(Pause|Play) card motion$/ });

  await expect(bar).toBeVisible();
  await expect(bar).toBeInViewport();
  await expect(track).toBeVisible();
  await expect(pause).toBeVisible();
  await expect(pause).toBeInViewport();

  // Ancestor overflow can leave a control with a nominal layout box while
  // making it completely unhittable. Probe the painted centre of both the
  // line and button so this catches the card-show regression, not just DOM
  // presence.
  for (const locator of [track, pause]) {
    const hitTestable = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return !!hit && (hit === element || element.contains(hit));
    });
    expect(hitTestable).toBe(true);
  }

  const initialLabel = await pause.getAttribute('aria-label');
  await pause.click();
  await expect(pause).toHaveAttribute(
    'aria-label',
    initialLabel === 'Pause card motion' ? 'Play card motion' : 'Pause card motion'
  );
};

test.describe('card show motion bar — desktop', () => {
  test('is visible and pause/play remains usable', async ({ page }) => {
    await expectUsableMotionBar(page);
  });
});

test.describe('card show motion bar — mobile', () => {
  test.use({
    viewport: devices['iPhone 13'].viewport,
    userAgent: devices['iPhone 13'].userAgent,
    deviceScaleFactor: devices['iPhone 13'].deviceScaleFactor,
    isMobile: devices['iPhone 13'].isMobile,
    hasTouch: devices['iPhone 13'].hasTouch
  });

  test('is visible and pause/play remains usable', async ({ page }) => {
    await expectUsableMotionBar(page);
  });
});
