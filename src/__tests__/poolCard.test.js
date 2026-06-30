import { poolCardToCardData, asOdds } from '../utils/poolCard';

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

describe('asOdds', () => {
  test('renders a probability as 1 : N', () => {
    expect(asOdds(0.5)).toBe('1 : 2');
    expect(asOdds(0.004)).toBe('1 : 250');
  });

  test('returns null for zero / negative / nullish probabilities', () => {
    expect(asOdds(0)).toBeNull();
    expect(asOdds(-0.1)).toBeNull();
    expect(asOdds(null)).toBeNull();
    expect(asOdds(undefined)).toBeNull();
  });
});
