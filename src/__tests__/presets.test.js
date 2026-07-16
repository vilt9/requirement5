import { extractDesign, extractImages, makePreset, applyPreset, presetHasImages, DESIGN_FIELDS } from '../utils/presets';

const sampleCard = () => ({
  id: 'card-123',
  rarity: 0.42,
  baseBackground: { type: 'linear', color1: '#101', color2: '#202' },
  backgroundColor: { baseHue: 200 },
  effectParams: { shineIntensity: 0.8 },
  borderEffects: { borderColor: '#fff' },
  holoEffects: { rareHolo: true },
  animationSpeed: 0.7,
  pixelDensity: 6,
  // card-specific things that must NOT travel into a preset
  customImageUrl: 'data:image/png;base64,AAAA',
  customHoloImageUrl: 'data:image/png;base64,BBBB',
  tags: ['#Neon', 'galaxy'],
});

describe('extractDesign', () => {
  test('keeps only defined design fields and excludes image + identity', () => {
    const design = extractDesign(sampleCard());
    expect(design.baseBackground).toBeDefined();
    expect(design.rarity).toBe(0.42);
    expect(design.effectParams).toEqual({ shineIntensity: 0.8 });
    // excluded
    expect(design.customImageUrl).toBeUndefined();
    expect(design.customHoloImageUrl).toBeUndefined();
    expect(design.id).toBeUndefined();
    expect(design.tags).toBeUndefined();
  });

  test('only the design keys appear (no extras)', () => {
    const design = extractDesign(sampleCard());
    for (const key of Object.keys(design)) {
      expect(DESIGN_FIELDS).toContain(key);
    }
  });

  test('handles a null card', () => {
    expect(extractDesign(null)).toEqual({});
  });
});

describe('extractImages', () => {
  test('captures only the image-identity fields', () => {
    const images = extractImages(sampleCard());
    expect(images.customImageUrl).toBe('data:image/png;base64,AAAA');
    expect(images.customHoloImageUrl).toBe('data:image/png;base64,BBBB');
    expect(images.rarity).toBeUndefined();
  });
});

describe('makePreset', () => {
  test('captures name, normalized tags, and the design; no images by default', () => {
    const preset = makePreset('  My Set  ', sampleCard());
    expect(preset.name).toBe('My Set');
    expect(preset.tags).toEqual(['neon', 'galaxy']);
    expect(preset.design.baseBackground).toBeDefined();
    expect(preset.design.customImageUrl).toBeUndefined();
    expect(preset.images).toBeUndefined();        // off by default
    expect(presetHasImages(preset)).toBe(false);
    expect(typeof preset.id).toBe('string');
    expect(preset.id.length).toBeGreaterThan(0);
  });

  test('captures images when includeImages is set', () => {
    const preset = makePreset('With pics', sampleCard(), { includeImages: true });
    expect(presetHasImages(preset)).toBe(true);
    expect(preset.images.customImageUrl).toBe('data:image/png;base64,AAAA');
    expect(preset.images.customHoloImageUrl).toBe('data:image/png;base64,BBBB');
  });

  test('falls back to a default name and empty tags', () => {
    const preset = makePreset('', { rarity: 0.1 });
    expect(preset.name).toBe('Untitled template');
    expect(preset.tags).toEqual([]);
  });
});

describe('applyPreset', () => {
  test('overlays design, replaces tags, keeps current image when set has none', () => {
    const card = sampleCard();
    const preset = makePreset('Look', {
      ...sampleCard(),
      rarity: 0.9,
      customImageUrl: 'data:image/png;base64,ZZZZ', // ignored: includeImages off
      tags: ['minimal'],
    });

    const next = applyPreset(card, preset);
    expect(next.rarity).toBe(0.9);            // design overlaid
    expect(next.tags).toEqual(['minimal']);    // tags replaced by preset's
    expect(next.id).toBe('card-123');          // identity kept
    expect(next.customImageUrl).toBe(card.customImageUrl); // current image kept
  });

  test('overlays the set\'s images when it carries them', () => {
    const card = { ...sampleCard(), customImageUrl: 'data:image/png;base64,OLD' };
    const preset = makePreset('Look', {
      ...sampleCard(),
      customImageUrl: 'data:image/png;base64,NEW',
      customHoloImageUrl: 'data:image/png;base64,HOLO',
    }, { includeImages: true });

    const next = applyPreset(card, preset);
    expect(next.customImageUrl).toBe('data:image/png;base64,NEW');
    expect(next.customHoloImageUrl).toBe('data:image/png;base64,HOLO');
    expect(next.id).toBe('card-123'); // identity still kept
  });

  test('returns the card unchanged when preset is missing', () => {
    const card = sampleCard();
    expect(applyPreset(card, null)).toBe(card);
  });
});
