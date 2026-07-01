import {
  generateCardAttributes,
  generateBaseBackground,
  generateSolidColorBackground,
} from '../utils/cardGenerator';

// The generator pulls a random image from the global catalogue the app seeds at
// boot; provide a minimal one so the happy path runs in tests.
beforeAll(() => {
  window.cardImagesData = [{ test_set: ['_1', '_2'] }];
  if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
    globalThis.crypto = { ...globalThis.crypto, randomUUID: () => 'test-uuid' };
  }
});

describe('generateCardAttributes', () => {
  test('produces a fully-formed card with all the fields the renderer reads', () => {
    const card = generateCardAttributes();
    const expectedFields = [
      'id', 'createdAt', 'rarity', 'patternInfo', 'backgroundColor', 'baseBackground',
      'imagePath', 'effectParams', 'imageEffects', 'borderEffects',
      'animationSpeed', 'pixelDensity',
    ];
    for (const field of expectedFields) {
      expect(card[field]).toBeDefined();
    }
    expect(card.rarity).toBeGreaterThanOrEqual(0);
    expect(card.rarity).toBeLessThanOrEqual(1);
    expect(card.imagePath).toMatch(/test_set/);
    expect(card.patternInfo.opacity).toBeGreaterThan(0);
  });

  test('respects an explicit rarityRange', () => {
    for (let i = 0; i < 20; i++) {
      const card = generateCardAttributes({ rarityRange: [0.8, 0.85] });
      expect(card.rarity).toBeGreaterThanOrEqual(0.8);
      expect(card.rarity).toBeLessThanOrEqual(0.85);
    }
  });
});

describe('generateBaseBackground', () => {
  test('returns a coherent, fully-specified background', () => {
    const bg = generateBaseBackground(200);
    expect(['linear', 'radial', 'conic', 'solid']).toContain(bg.type);
    expect(bg.color1).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(bg.color2).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(typeof bg.angle).toBe('number');
    expect(bg.fadeStart).toBeGreaterThanOrEqual(0);
    expect(bg.fadeEnd).toBeLessThanOrEqual(100);
    expect(bg.vignette).toBeGreaterThanOrEqual(0);
    expect(bg.vignette).toBeLessThanOrEqual(1);
  });
});

describe('generateSolidColorBackground', () => {
  test('exposes a base hue and a usable colour', () => {
    const bg = generateSolidColorBackground(120);
    expect(typeof bg.baseHue).toBe('number');
    expect(bg).toHaveProperty('color');
  });
});
