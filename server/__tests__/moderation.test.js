// Unit contract for the text safety screen. Two guarantees matter: real slurs
// and profanity are caught even when obfuscated, and innocent words that merely
// contain a banned substring (the "Scunthorpe problem") are NOT flagged.
import { screen, screenFields } from '../utils/moderation.js';

describe('screen()', () => {
  test('catches plain profanity and slurs', () => {
    for (const bad of ['fuck you', 'you piece of shit', 'what a bitch', 'a retard', 'porn site']) {
      expect(screen(bad).ok).toBe(false);
    }
  });

  test('sees through leetspeak and padding', () => {
    for (const bad of ['sh1t', 'f@ggot', 'fuuuuck', 'n1gger', 'p0rn0']) {
      expect(screen(bad).ok).toBe(false);
    }
  });

  test('does not flag innocent words that embed a banned substring', () => {
    for (const ok of ['classic grass', 'Scunthorpe', 'assassin', 'pass the class', 'grasshopper', 'analysis', 'Golden Fox']) {
      expect(screen(ok).ok).toBe(true);
    }
  });

  test('empty / non-string input is clean', () => {
    expect(screen('').ok).toBe(true);
    expect(screen(null).ok).toBe(true);
    expect(screen(undefined).ok).toBe(true);
  });
});

describe('screenFields()', () => {
  test('returns the first offending field with a message', () => {
    const bad = screenFields({ 'Card name': 'clean', Tags: ['nice', 'shit'] });
    expect(bad).not.toBeNull();
    expect(bad.field).toBe('Tags');
    expect(bad.message).toMatch(/Tags/);
  });

  test('null when every field is clean', () => {
    expect(screenFields({ 'Card name': 'Golden Fox', Tags: ['portrait', 'gold'] })).toBeNull();
  });

  test('ignores null/undefined values', () => {
    expect(screenFields({ 'Card info': null, 'Set name': undefined, 'Card name': 'ok' })).toBeNull();
  });
});
