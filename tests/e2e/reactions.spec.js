import { devices, expect, test } from '@playwright/test';

const { defaultBrowserType: _defaultBrowserType, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

test('mobile reaction picker closes from the trigger or a reaction', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'React to this card' });
  const picker = page.getByRole('grid', { name: 'Choose reactions' });

  await expect(trigger).toBeVisible();

  await trigger.tap();
  await expect(picker).toBeVisible();

  await trigger.tap();
  await expect(picker).toBeHidden();

  await trigger.tap();
  const reactionSaved = page.waitForResponse(response =>
    response.url().includes('/signals') &&
    response.request().method() === 'PUT'
  );
  await page.getByRole('gridcell', { name: 'Fire' }).tap();

  await expect(picker).toBeHidden();
  expect((await reactionSaved).ok()).toBeTruthy();
});
