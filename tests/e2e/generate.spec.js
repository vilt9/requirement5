import { test, expect } from '@playwright/test';

// The core loop: pressing Generate surfaces the next card.
test.describe('generate', () => {
  test('Generate moves to a new card', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/card\//);
    const firstUrl = page.url();

    // Both the next-card and the save action live by the card.
    await expect(page.getByRole('button', { name: /Generate/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save/ })).toBeVisible();

    await page.getByRole('button', { name: /Generate/ }).click();
    await expect(page).not.toHaveURL(firstUrl);
    await expect(page).toHaveURL(/\/card\//);
  });
});
