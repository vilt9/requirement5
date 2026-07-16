import { poolCardToCardData } from '../utils/poolCard';

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

  test('defaults rarity to 0.5 when absent or non-numeric', () => {
    expect(poolCardToCardData({ state_data: { customCard: {} } }).rarity).toBe(0.5);
    expect(poolCardToCardData({ state_data: { customCard: { rarity: 'x' } } }).rarity).toBe(0.5);
  });

  test('returns null when there is no customCard', () => {
    expect(poolCardToCardData(null)).toBeNull();
    expect(poolCardToCardData({})).toBeNull();
    expect(poolCardToCardData({ state_data: {} })).toBeNull();
  });
});

