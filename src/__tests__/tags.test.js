import { normalizeTag, parseTags, formatTag, ensureTags } from '../utils/tags';

describe('normalizeTag', () => {
  test('lowercases, strips leading #, joins words with dashes', () => {
    expect(normalizeTag('#Neon Galaxy')).toBe('neon-galaxy');
    expect(normalizeTag('  Foo  ')).toBe('foo');
    expect(normalizeTag('##double')).toBe('double');
  });

  test('drops unsafe characters and collapses/​trims punctuation', () => {
    expect(normalizeTag('a!!b')).toBe('ab');
    expect(normalizeTag('a---b')).toBe('a-b');
    expect(normalizeTag('-edge-')).toBe('edge');
    expect(normalizeTag('keeps_under.score')).toBe('keeps_under.score');
  });

  test('returns empty string for nullish or junk-only input', () => {
    expect(normalizeTag(null)).toBe('');
    expect(normalizeTag(undefined)).toBe('');
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag('###')).toBe('');
  });
});

describe('parseTags', () => {
  test('splits on commas and whitespace into normalized tags', () => {
    expect(parseTags('neon, galaxy  sketch')).toEqual(['neon', 'galaxy', 'sketch']);
    expect(parseTags('Neon\nGalaxy')).toEqual(['neon', 'galaxy']);
  });

  test('dedupes while preserving first-seen order', () => {
    expect(parseTags('a, a, b, A')).toEqual(['a', 'b']);
  });

  test('accepts an array and normalizes each, dropping empties', () => {
    expect(parseTags(['#One', 'two two', '', null])).toEqual(['one', 'two-two']);
  });

  test('nullish input yields an empty array', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});

describe('formatTag', () => {
  test('prefixes a hash for display', () => {
    expect(formatTag('neon')).toBe('#neon');
    expect(formatTag('#neon')).toBe('#neon');
  });

  test('empty input formats to empty string (no lone hash)', () => {
    expect(formatTag('')).toBe('');
    expect(formatTag(null)).toBe('');
  });
});

describe('ensureTags', () => {
  test('normalizes arrays and rejects non-arrays', () => {
    expect(ensureTags(['#A', 'b'])).toEqual(['a', 'b']);
    expect(ensureTags('neon')).toEqual([]);
    expect(ensureTags(undefined)).toEqual([]);
    expect(ensureTags(null)).toEqual([]);
  });
});
