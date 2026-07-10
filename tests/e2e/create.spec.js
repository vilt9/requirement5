import { test, expect } from '@playwright/test';

// The create flow's Start stage: the rarity roll. Logged out, rerolls are free
// (client-side) — enough to exercise the roll → design path without an account.
test.describe('create flow (logged out)', () => {
  test('Start stage shows the rarity roll + controls', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByText('Randomly generated Rarity Value:')).toBeVisible();
    await expect(page.getByText('RV:')).toBeVisible();
    await expect(page.getByRole('button', { name: /Regenerate/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
  });

  test('Regenerate bumps the reroll counter', async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /Regenerate/ }).click();
    await expect(page.getByText(/1 regeneration/)).toBeVisible();
  });

  test('Start moves into the Design stage', async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /^Start/ }).click();
    // Design stage: the tabs + the collapsible base-set loader appear.
    await expect(page.getByRole('button', { name: 'Holographic' })).toBeVisible();
    await expect(page.getByText('Load a base set')).toBeVisible();
  });
});
