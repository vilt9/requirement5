import {
  clearAttributionForTests,
  markGrowthEventOnce,
  readAttribution
} from '../utils/attribution';

beforeEach(() => {
  sessionStorage.clear();
  clearAttributionForTests();
  window.history.replaceState({}, '', '/?utm_source=reddit&utm_medium=reply&utm_campaign=ai-art');
});

test('captures first-touch campaign data once per tab session', () => {
  const first = readAttribution();
  window.history.replaceState({}, '', '/about?utm_source=github');
  const second = readAttribution();

  expect(first.sessionId).toBeTruthy();
  expect(first.source).toBe('reddit');
  expect(first.medium).toBe('reply');
  expect(first.campaign).toBe('ai-art');
  expect(first.landingPath).toBe('/');
  expect(second).toEqual(first);
});

test('marks funnel events once per session', () => {
  expect(markGrowthEventOnce('visit')).toBe(true);
  expect(markGrowthEventOnce('visit')).toBe(false);
  expect(markGrowthEventOnce('account_intent')).toBe(true);
});
