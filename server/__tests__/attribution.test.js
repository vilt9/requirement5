import {
  attributionSource,
  bucketSource,
  normalizeAttribution
} from '../services/attribution.js';

describe('first-touch attribution normalisation', () => {
  test('buckets known channels and keeps only safe bounded fields', () => {
    expect(normalizeAttribution({
      sessionId: 'session_12345678',
      source: 'Reddit',
      medium: 'creator reply',
      campaign: 'AI ART / JULY',
      content: 'Holo #1',
      landingPath: '/card/abc?secret=no',
      referrerHost: 'www.reddit.com'
    })).toEqual({
      session_id: 'session_12345678',
      source: 'reddit',
      medium: 'creator-reply',
      campaign: 'ai-art-july',
      content: 'holo-1',
      landing_path: '/card/abc',
      referrer_host: 'www.reddit.com'
    });
  });

  test('uses a small public source vocabulary', () => {
    expect(bucketSource('mystery-network')).toBe('other');
    expect(bucketSource(null, 'github.com')).toBe('github');
    expect(bucketSource('pin', null)).toBe('pinterest');
    expect(bucketSource(null, 'www.threads.net')).toBe('threads');
    expect(bucketSource(null, 'artist.tumblr.com')).toBe('tumblr');
    expect(bucketSource('DA', null)).toBe('deviantart');
    expect(bucketSource(null, 'facebook.com')).toBe('facebook');
    expect(bucketSource(null, null)).toBe('unattributed');
    expect(attributionSource({ source: 'bsky' })).toBe('bluesky');
  });

  test('rejects malformed session and referrer values', () => {
    const result = normalizeAttribution({
      sessionId: 'x',
      source: null,
      landingPath: 'not-a-path',
      referrerHost: 'evil host/with path'
    });
    expect(result.session_id).toBeNull();
    expect(result.referrer_host).toBeNull();
    expect(result.landing_path).toBe('/');
    expect(result.source).toBe('unattributed');
  });
});
