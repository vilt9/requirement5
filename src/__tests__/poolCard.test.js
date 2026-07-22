jest.mock('../utils/api', () => ({ apiBase: 'http://localhost:4000' }));

import { cardArtworkUrl, poolCardToCardData, resolveImageUrl } from '../utils/poolCard';

describe('poolCardToCardData', () => {
  test('unwraps a server record (state_data) into render props with defaults', () => {
    const record = {
      id: 'card_1',
      state_data: { customCard: { rarity: 0.7, patternInfo: { type: 'hex' } } },
    };
    const data = poolCardToCardData(record);
    expect(data.rarity).toBe(0.7);
    expect(data.patternInfo).toEqual({ type: 'hex' });
    expect(data.imagePath).toBe('default');       // default filled in
    expect(data.effectParams).toEqual({});         // missing objects defaulted
    expect(data.holoEffects).toEqual({});
  });

  test('also accepts the client-side stateData spelling', () => {
    const data = poolCardToCardData({ stateData: { customCard: { rarity: 0.2 } } });
    expect(data.rarity).toBe(0.2);
  });

  test('accepts legacy card fields stored directly in state_data', () => {
    const data = poolCardToCardData({
      rarity_score: 0.61,
      state_data: { backgroundColor: '#c45532', imagePath: 'green_world_3.webp' }
    });
    expect(data.backgroundColor).toBe('#c45532');
    expect(data.imagePath).toBe('green_world_3.webp');
    expect(data.rarity).toBe(0.61);
  });

  test('defaults rarity to 0.5 when absent or non-numeric', () => {
    expect(poolCardToCardData({ state_data: { customCard: {} } }).rarity).toBe(0.5);
    expect(poolCardToCardData({ state_data: { customCard: { rarity: 'x' } } }).rarity).toBe(0.5);
  });

  test('returns null when there is no renderable card state', () => {
    expect(poolCardToCardData(null)).toBeNull();
    expect(poolCardToCardData({})).toBeNull();
    expect(poolCardToCardData({ state_data: {} })).toBeNull();
  });

  test('resolves uploaded and bundled artwork on their correct origins', () => {
    expect(cardArtworkUrl({ imagePath: 'digital_race_2.webp' }))
      .toBe('/assets/card_images/digital_race_2.webp');
    expect(cardArtworkUrl({ imagePath: 'custom_image', customImageUrl: 'https://images.test/card.webp' }))
      .toBe('https://images.test/card.webp');
    expect(resolveImageUrl('/uploads/card-images/card.webp'))
      .toBe('http://localhost:4000/uploads/card-images/card.webp');
    expect(resolveImageUrl('/r5c_card_back.png')).toBe('/r5c_card_back.png');
  });
});
