// One first-touch record per browser tab/session. This is deliberately
// sessionStorage rather than a persistent cookie or localStorage identifier:
// enough to connect a visit to generation/signup, but not to follow someone
// across unrelated browsing sessions.
const ATTRIBUTION_KEY = 'r5c_attribution_v1';
const EVENT_PREFIX = 'r5c_growth_event_v1:';

const clean = (value, max = 80) => {
  const result = String(value || '').trim().slice(0, max);
  return result || null;
};

const randomSessionId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `r5-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
};

const referrerHost = () => {
  if (!document.referrer) return null;
  try {
    return new URL(document.referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const createAttribution = () => {
  const params = new URLSearchParams(window.location.search);
  const referrer = referrerHost();
  return {
    sessionId: randomSessionId(),
    source: clean(params.get('utm_source')) || referrer || 'direct',
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
    landingPath: window.location.pathname || '/',
    referrerHost: referrer
  };
};

export const readAttribution = () => {
  try {
    const existing = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (existing) return JSON.parse(existing);
    const attribution = createAttribution();
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return createAttribution();
  }
};

// Returns true once per session for a named event. Marking before the network
// request prevents SPA route changes from multiplying visits or account intent.
export const markGrowthEventOnce = (event) => {
  try {
    const key = `${EVENT_PREFIX}${event}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
};

export const clearAttributionForTests = () => {
  try {
    sessionStorage.removeItem(ATTRIBUTION_KEY);
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(EVENT_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // no storage in this environment
  }
};
