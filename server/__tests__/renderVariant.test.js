import {
  capturePageUrl,
  parseIncludeUrl,
  RENDER_REVISION,
  renderCacheKey,
  renderStorageStem,
  renderVariant
} from '../services/renderVariant.js';

describe('render outro variants', () => {
  test('defaults to including the Requirement5 URL', () => {
    expect(parseIncludeUrl(undefined)).toBe(true);
    expect(parseIncludeUrl('true')).toBe(true);
    expect(parseIncludeUrl('1')).toBe(true);
  });

  test('accepts an explicit no-URL request and rejects ambiguous values', () => {
    expect(parseIncludeUrl('false')).toBe(false);
    expect(parseIncludeUrl('0')).toBe(false);
    expect(parseIncludeUrl('no')).toBeNull();
  });

  test('keeps branded and no-URL media in separate caches and objects', () => {
    expect(renderVariant(true)).toBe('with-url');
    expect(renderVariant(false)).toBe('no-url');
    expect(renderCacheKey('card-1', 'mp4', null, true))
      .not.toBe(renderCacheKey('card-1', 'mp4', null, false));
    expect(renderStorageStem('card-1', true))
      .not.toBe(renderStorageStem('card-1', false));
  });

  test('versions moving media so choreography changes bypass old renders', () => {
    expect(RENDER_REVISION).toBe('cycle-v2');
    expect(renderCacheKey('card-1', 'gif', null, true)).toContain(RENDER_REVISION);
    expect(renderStorageStem('card-1', true)).toContain(RENDER_REVISION);
  });

  test('still-frame previews share a cache because they contain no outro', () => {
    expect(renderCacheKey('card-1', 'frames', 4, true))
      .toBe(renderCacheKey('card-1', 'frames', 4, false));
  });

  test('capture page receives an explicit URL-visibility contract', () => {
    expect(capturePageUrl('https://requirement5.com', 'card-1', true))
      .toBe('https://requirement5.com/capture/card-1?includeUrl=1');
    expect(capturePageUrl('https://requirement5.com', 'card-1', false))
      .toBe('https://requirement5.com/capture/card-1?includeUrl=0');
  });
});
