import { test, expect } from '@playwright/test';

// Signing up, seeing the balance, and getting a server-backed roll on /create.
test.describe('account', () => {
  test('sign up → balance in nav → logged-in roll', async ({ page }) => {
    const username = `e2e_${Date.now()}`;
    await page.goto('/account');

    const form = page.locator('form').filter({ hasText: 'Create account' });
    await form.getByPlaceholder('Username').fill(username);
    await form.getByPlaceholder('Password (8+ characters)').fill('password123');
    await form.getByRole('button', { name: 'Sign up' }).click();

    // Nav shows the new account and a /t26 total.
    await expect(page.getByText(username).first()).toBeVisible();
    await expect(page.getByText('/t26').first()).toBeVisible();

    // Create page rolls a rarity from the server for the logged-in user.
    await page.goto('/create');
    await expect(page.getByText('Randomly generated Rarity Value:')).toBeVisible();
    await expect(page.getByRole('button', { name: /Regenerate/ })).toBeVisible();
  });
});
