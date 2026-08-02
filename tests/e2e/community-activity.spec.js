import { expect, test } from '@playwright/test';

const API = 'http://localhost:4099';

const signup = async (request, username) => {
  const response = await request.post(`${API}/api/auth/signup`, {
    data: {
      username,
      email: `${username}@earth.test`,
      password: 'password123',
      dob: '1990-01-01',
      acceptedTerms: true
    }
  });
  expect(response.ok()).toBeTruthy();
  return response.json().then(payload => payload.data);
};

test('the top-of-page community pulse shows another collector saving a card', async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-8);
  const creator = await signup(request, `pulseown${suffix}`);
  const collector = await signup(request, `pulsefan${suffix}`);

  const made = await request.post(`${API}/api/cards`, {
    headers: { Authorization: `Bearer ${creator.token}` },
    data: {
      name: 'E2E Community Bloom',
      stateData: {
        customCard: {
          imagePath: 'green_world_2.webp',
          backgroundColor: '#183122'
        }
      }
    }
  });
  expect(made.ok()).toBeTruthy();
  const card = (await made.json()).data;

  const saved = await request.post(`${API}/api/cards/${card.id}/save`, {
    headers: { Authorization: `Bearer ${collector.token}` }
  });
  expect(saved.ok()).toBeTruthy();

  await page.goto('/about');
  const pulse = page.getByRole('region', { name: 'Recent community activity' });
  await expect(pulse).toBeVisible();
  await expect(pulse.getByText('Community pulse')).toHaveCount(0);
  expect(await pulse.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(42);
  await expect(pulse.getByRole('link', {
    name: `${collector.user.username} saved E2E Community Bloom`
  })).toHaveAttribute('data-presentation', 'standard');
});

test('reactions, rare saves, and set completions use the special visual language', async ({ page }) => {
  const baseCard = {
    preview: { imagePath: 'green_world_2.webp', customImageUrl: null, backgroundColor: '#183122' }
  };
  const actor = username => ({ username, collectionPath: `/${username}/collection` });
  const common = { key: 'common', name: 'Common', color: '#3b4a5a', special: false };

  await page.route('**/api/cards/community/activity', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        refreshAfterMs: 60_000,
        activities: [
          {
            id: 'milestone', type: 'set_complete', signal: null,
            createdAt: new Date().toISOString(), relevance: null,
            actor: actor('setfinisher'),
            card: { ...baseCard, id: 'card-set', name: 'Final Orbit', rarity: common },
            set: { id: 'creator_orbits', label: 'Orbits', total: 4 }
          },
          {
            id: 'rare-save', type: 'save', signal: null,
            createdAt: new Date().toISOString(), relevance: null,
            actor: actor('rarefinder'),
            card: {
              ...baseCard, id: 'card-rare', name: 'Blue Comet',
              rarity: { key: 'vmax', name: 'Singular', color: '#9fe8ff', special: true }
            }
          },
          {
            id: 'reaction', type: 'reaction', signal: 'flame',
            createdAt: new Date().toISOString(), relevance: null,
            actor: actor('signalkeeper'),
            card: { ...baseCard, id: 'card-reaction', name: 'Solar Relay', rarity: common }
          },
          {
            id: 'standard', type: 'save', signal: null,
            createdAt: new Date().toISOString(), relevance: null,
            actor: actor('collector'),
            card: { ...baseCard, id: 'card-common', name: 'Quiet Field', rarity: common }
          }
        ]
      }
    })
  }));

  await page.goto('/about');
  const pulse = page.getByRole('region', { name: 'Recent community activity' });
  const milestone = pulse.getByRole('link', { name: 'setfinisher completed Orbits set' });
  const rare = pulse.getByRole('link', { name: 'rarefinder saved a Singular card Blue Comet' });
  const reaction = pulse.getByRole('link', { name: 'signalkeeper sent Fire to Solar Relay' });
  const standard = pulse.getByRole('link', { name: 'collector saved Quiet Field' });

  await expect(milestone).toHaveAttribute('data-presentation', 'milestone');
  await expect(rare).toHaveAttribute('data-presentation', 'rare');
  await expect(reaction).toHaveAttribute('data-presentation', 'reaction');
  await expect(standard).toHaveAttribute('data-presentation', 'standard');

  const presentation = await milestone.evaluate(element => {
    const rail = element.closest('[role="list"]');
    const style = getComputedStyle(element);
    return {
      borderStyle: style.borderStyle,
      radius: parseFloat(style.borderRadius),
      railGap: parseFloat(getComputedStyle(rail).gap)
    };
  });
  expect(presentation.borderStyle).toBe('solid');
  expect(presentation.radius).toBeGreaterThanOrEqual(4);
  expect(presentation.railGap).toBeGreaterThanOrEqual(4);

  for (const item of [milestone, rare, reaction, standard]) {
    expect(await item.evaluate(element => {
      const copy = element.querySelector('[data-activity-copy]');
      return copy.scrollWidth <= copy.clientWidth;
    })).toBeTruthy();
  }

  const glowOpacity = locator => locator.evaluate(element =>
    getComputedStyle(element, '::before').opacity);
  expect(await glowOpacity(milestone)).toBe('0.72');
  expect(await glowOpacity(rare)).toBe('0.72');
  expect(await glowOpacity(reaction)).toBe('0.72');
  expect(await glowOpacity(standard)).toBe('0');
});

test('the headless capture route neither renders nor fetches the community pulse', async ({ page }) => {
  let activityRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/cards/community/activity')) activityRequests += 1;
  });

  await page.goto('/capture/a37f9943-aeb5-416d-a432-5770843977d9');
  await page.waitForFunction(() => window.__captureReady === true);

  expect(activityRequests).toBe(0);
  await expect(page.getByRole('region', { name: 'Recent community activity' })).toHaveCount(0);
});
