import { test, expect } from '@playwright/test';

// The full logged-in create journey, end to end through the new endpoints:
// begin → regenerate-rarity → confirm-start (private draft) → design → publish,
// landing on a public card page. Asserting on the network calls doubles as
// proof the /create page is wired to /api/cards/create/*.
test.describe('create flow (logged in)', () => {
  test('gamble → confirm-start → design → publish → public card', async ({ page }) => {
    const username = `e2e_pub_${Date.now()}`;

    // --- sign up ---
    await page.goto('/account');
    const form = page.locator('form').filter({ hasText: 'Create account' });
    await form.getByPlaceholder('Username').fill(username);
    await form.getByPlaceholder('Earth email address').fill(`${username}@earth.test`);
    await form.getByPlaceholder('Password (8+ characters)').fill('password123');
    await form.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText(username).first()).toBeVisible();

    // --- /create begins the rarity gamble on the server ---
    const begin = page.waitForResponse(r =>
      r.url().includes('/api/cards/create/begin') && r.request().method() === 'POST');
    await page.goto('/create');
    expect((await begin).ok()).toBeTruthy();
    await expect(page.getByText('Randomly generated Rarity Value:')).toBeVisible();

    // --- Regenerate once: a fresh Rarity Value for a fee ---
    const regen = page.waitForResponse(r =>
      r.url().includes('/api/cards/create/regenerate-rarity') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Regenerate/ }).click();
    expect((await regen).ok()).toBeTruthy();
    await expect(page.getByText(/1 regeneration/)).toBeVisible();

    // --- Start: confirm-start pays the create fee and mints a private draft ---
    const confirm = page.waitForResponse(r =>
      r.url().includes('/api/cards/create/confirm-start') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^Start/ }).click();
    const confirmRes = await confirm;
    expect(confirmRes.ok()).toBeTruthy();
    const draft = (await confirmRes.json()).data.draft;
    expect(draft.isPublic).toBe(false); // still private at this point

    // --- Design stage: prove it opened, and touch a control (switch tab) ---
    await expect(page.getByRole('button', { name: 'Holographic' })).toBeVisible();
    await page.getByRole('button', { name: 'Background' }).click();

    // --- move to the Publish stage ---
    await page.locator('.stage-next').click();

    // --- name + Publish: create/publish releases the same draft into the pool ---
    await page.getByPlaceholder('Card name').fill('E2E Published Card');
    const publish = page.waitForResponse(r =>
      r.url().includes('/api/cards/create/publish') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publishRes = await publish;
    expect(publishRes.ok()).toBeTruthy();
    const card = (await publishRes.json()).data.card;
    expect(card.id).toBe(draft.id);   // same card…
    expect(card.is_public).toBe(true); // …now public

    // --- UI confirms and the public card page opens ---
    await expect(page.getByText(/Published to the pool/)).toBeVisible();
    await page.getByRole('link', { name: /View your card/ }).click();
    await expect(page).toHaveURL(new RegExp(`/card/${draft.id}`));
  });
});
