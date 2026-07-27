// Privacy-conscious first-touch attribution.
//
// The client keeps one random ID in sessionStorage (not a long-lived cookie or
// cross-site identifier) and sends only campaign slugs, the landing path and the
// referrer's hostname. The server normalises every field and buckets source into
// a small public vocabulary so arbitrary query strings can never become public
// analytics labels.

const SOURCE_ALIASES = new Map([
  ['direct', 'direct'],
  ['reddit', 'reddit'],
  ['redd.it', 'reddit'],
  ['instagram', 'instagram'],
  ['ig', 'instagram'],
  ['tiktok', 'tiktok'],
  ['discord', 'discord'],
  ['github', 'github'],
  ['x', 'x'],
  ['twitter', 'x'],
  ['bluesky', 'bluesky'],
  ['bsky', 'bluesky'],
  ['mastodon', 'mastodon'],
  ['youtube', 'youtube'],
  ['linkedin', 'linkedin'],
  ['email', 'email'],
  ['newsletter', 'email'],
  ['unattributed', 'unattributed']
]);

const cleanSlug = (value, max = 64) => {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return cleaned || null;
};

const cleanSessionId = (value) => {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(id) ? id : null;
};

const cleanLandingPath = (value) => {
  const path = String(value || '').trim().split('?')[0].slice(0, 160);
  return path.startsWith('/') ? path : '/';
};

const cleanHost = (value) => {
  const host = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .slice(0, 120);
  return /^[a-z0-9.-]+$/.test(host) ? host : null;
};

const sourceFromHost = (host) => {
  if (!host) return null;
  if (host === 'requirement5.com' || host.endsWith('.requirement5.com')) return 'direct';
  if (host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'redd.it') return 'reddit';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'discord.com' || host.endsWith('.discord.com') || host === 'discord.gg') return 'discord';
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com') return 'x';
  if (host === 'bsky.app' || host.endsWith('.bsky.app')) return 'bluesky';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
  return 'other';
};

export const bucketSource = (rawSource, referrerHost = null) => {
  const source = cleanSlug(rawSource, 40);
  if (source && SOURCE_ALIASES.has(source)) return SOURCE_ALIASES.get(source);
  if (source) {
    const fromSourceHost = sourceFromHost(source);
    if (fromSourceHost && fromSourceHost !== 'other') return fromSourceHost;
    return 'other';
  }
  return sourceFromHost(cleanHost(referrerHost)) || 'unattributed';
};

export const normalizeAttribution = (value) => {
  const input = value && typeof value === 'object' ? value : {};
  const referrerHost = cleanHost(input.referrerHost ?? input.referrer_host);
  return {
    session_id: cleanSessionId(input.sessionId ?? input.session_id),
    source: bucketSource(input.source, referrerHost),
    medium: cleanSlug(input.medium, 40),
    campaign: cleanSlug(input.campaign, 64),
    content: cleanSlug(input.content, 64),
    landing_path: cleanLandingPath(input.landingPath ?? input.landing_path),
    referrer_host: referrerHost
  };
};

export const attributionSource = (value) => {
  if (value && typeof value === 'object') {
    return bucketSource(value.source, value.referrer_host);
  }
  return bucketSource(value);
};
