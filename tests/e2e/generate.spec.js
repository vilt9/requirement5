import { test, expect } from '@playwright/test';

// The core loop: pressing Generate surfaces the next card.
test.describe('generate', () => {
  test('Generate moves to a new card', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/card\//);
    const firstUrl = page.url();

    // Both the next-card and the save action live by the card.
    await expect(page.getByRole('button', { name: /Generate/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Keep this card/ })).toBeVisible();

    await page.getByRole('button', { name: /Generate/ }).click();
    await expect(page).not.toHaveURL(firstUrl);
    await expect(page).toHaveURL(/\/card\//);
  });

  test('anonymous discoverer gets a clear preserve-and-return invitation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/card\//);

    const preserve = page.getByRole('button', { name: /Keep this card/ });
    await expect(preserve).toBeVisible();
    await expect(preserve).toContainText('free account');

    await preserve.click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText('Preserve this card')).toBeVisible();
    await expect(page.getByText(/return to the card and save it/i)).toBeVisible();
  });
});
