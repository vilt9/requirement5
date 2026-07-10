import { test, expect } from '@playwright/test';

// Nav, routing, and the standing pages — the frame everything else hangs on.
test.describe('navigation & pages', () => {
  test('home draws a card (Generate gate → card page)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/card\//);
    await expect(page.getByRole('button', { name: /Generate/ })).toBeVisible();
  });

  test('top-menu links are present', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Discover', 'Collections', 'Create', 'About']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });

  test('About page shows the heading and logo', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: /About Requirement5/i })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Requirement5' })).toBeVisible();
  });

  test('Collections page loads (logged out prompts to log in)', async ({ page }) => {
    await page.goto('/collection');
    await expect(page.getByText(/account collection lives on the server/i)).toBeVisible();
  });

  test('/customize redirects to /create', async ({ page }) => {
    await page.goto('/customize');
    await expect(page).toHaveURL(/\/create$/);
  });
});
