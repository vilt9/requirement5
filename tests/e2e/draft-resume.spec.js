import { test, expect } from '@playwright/test';

// The draft round-trip: start a creation, check the rarity, tweak the design,
// leave WITHOUT publishing, then reopen the draft from the collection and land
// back on the same card mid-edit (its design was persisted to the server draft).
test.describe('draft resume', () => {
  test('start → design → reopen from collection → same draft mid-edit', async ({ page }) => {
    const username = `e2e_draft_${Date.now()}`;

    // --- sign up ---
    await page.goto('/account');
    const form = page.locator('form').filter({ hasText: 'Create account' });
    await form.getByPlaceholder('Username').fill(username);
    await form.getByPlaceholder('Earth email address').fill(`${username}@earth.test`);
    await form.getByPlaceholder('Password (8+ characters)').fill('password123');
    await form.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText(username).first()).toBeVisible();

    // --- start a creation; check the rarity is shown ---
    const begin = page.waitForResponse(r => r.url().includes('/api/cards/create/begin') && r.request().method() === 'POST');
    await page.goto('/create');
    await begin;
    await expect(page.getByText('Randomly generated Rarity Value:')).toBeVisible();
    const rarityText = await page.locator('.start-stage .score').first().textContent();
    const rarity = Number(rarityText);
    expect(rarity).toBeGreaterThanOrEqual(0);
    expect(rarity).toBeLessThanOrEqual(1);

    // --- Start: confirm-start mints the private draft, land in Design ---
    const confirm = page.waitForResponse(r => r.url().includes('/api/cards/create/confirm-start') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^Start/ }).click();
    const draftId = (await (await confirm).json()).data.draft.id;
    await expect(page.getByRole('button', { name: 'Holographic' })).toBeVisible();

    // --- make a change to the design (a slider) — the draft autosaves ---
    const slider = page.locator('input[type="range"]').first();
    await slider.scrollIntoViewIfNeeded();
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    const putResp = await page.waitForResponse(r => r.url().includes(`/api/cards/${draftId}`) && r.request().method() === 'PUT');
    const before = (await putResp.json()).data.card.state_data.customCard;
    expect(before).toBeTruthy();

    // --- leave WITHOUT publishing: go to the collection ---
    await page.goto(`/${username}/collection`);
    await expect(page.getByText(/Drafts:/)).toBeVisible();
    const editBtn = page.getByRole('button', { name: /Edit draft/ }).first();
    await expect(editBtn).toBeVisible();

    // --- reopen the draft: resumes mid-edit in the Design stage ---
    const getResp = page.waitForResponse(r => r.url().includes(`/api/cards/${draftId}`) && r.request().method() === 'GET');
    await editBtn.click();
    await expect(page).toHaveURL(new RegExp(`/create\\?draft=${draftId}`));
    const after = (await (await getResp).json()).data.state_data.customCard;

    // same card, mid-edit: we're in Design (not a fresh Start), rarity is locked,
    // and the design that was persisted matches what we left.
    await expect(page.getByRole('button', { name: 'Holographic' })).toBeVisible();
    await expect(page.getByText('Randomly generated Rarity Value:')).toHaveCount(0);
    expect(after).toEqual(before);
    // the displayed rarity is rounded to 3 dp; the stored value matches it
    expect(Number(after.rarity).toFixed(3)).toBe(rarityText.trim());
  });
});
