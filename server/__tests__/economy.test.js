import {
  TIERS, ECONOMY, getTier, tierForScore, rollTier, PRICE_BANDS,
  saveCostFor, drawYieldFor, rollPublishStake, creatorDividendFor,
  saveValueFor, dividendFor, round6, economyConfig
} from '../services/economy.js';

describe('economy tiers', () => {
  test('probabilities sum to 1', () => {
    const total = TIERS.reduce((sum, t) => sum + t.probability, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  test('score ranges cover 0..1 without gaps', () => {
    const sorted = [...TIERS].sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);
    expect(sorted[0].scoreRange[0]).toBe(0);
    expect(sorted[sorted.length - 1].scoreRange[1]).toBe(1);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].scoreRange[0]).toBeCloseTo(sorted[i - 1].scoreRange[1], 10);
    }
  });

  test('tierForScore maps bands to the expected tiers', () => {
    expect(tierForScore(0.99).key).toBe('vmax');
    expect(tierForScore(0.95).key).toBe('ultra');
    expect(tierForScore(0.87).key).toBe('wowa');
    expect(tierForScore(0.82).key).toBe('galaxy');
    expect(tierForScore(0.75).key).toBe('holo');
    expect(tierForScore(0.3).key).toBe('common');
    // boundaries go to the rarer tier
    expect(tierForScore(0.98).key).toBe('vmax');
    expect(tierForScore(0.7).key).toBe('holo');
  });

  test('rollTier honours band boundaries', () => {
    // cumulative bands in TIERS order: vmax, ultra, wowa, galaxy, holo, common
    expect(rollTier(() => 0.0).key).toBe('vmax');
    expect(rollTier(() => 0.0004).key).toBe('vmax');
    expect(rollTier(() => 0.001).key).toBe('ultra');
    expect(rollTier(() => 0.003).key).toBe('wowa');
    expect(rollTier(() => 0.008).key).toBe('galaxy');
    expect(rollTier(() => 0.02).key).toBe('holo');
    expect(rollTier(() => 0.5).key).toBe('common');
    expect(rollTier(() => 0.999999).key).toBe('common');
  });

  test('rollTier distribution roughly matches probabilities', () => {
    // deterministic LCG so the test cannot flake
    let seed = 42;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const counts = {};
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const tier = rollTier(lcg);
      counts[tier.key] = (counts[tier.key] || 0) + 1;
    }
    expect(counts.common / n).toBeCloseTo(getTier('common').probability, 1);
    expect(counts.holo / n).toBeCloseTo(getTier('holo').probability, 1);
    // rare tiers: within a factor of 3 of expectation at this sample size
    expect(counts.galaxy / n).toBeGreaterThan(getTier('galaxy').probability / 3);
    expect(counts.galaxy / n).toBeLessThan(getTier('galaxy').probability * 3);
  });
});

describe('economy amounts (per-card pricing)', () => {
  test('prices are deterministic per id and stay inside their bands', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `card-${i}-abcdef`);
    for (const id of ids) {
      const cost = saveCostFor(id);
      expect(cost).toBe(saveCostFor(id)); // same id → same price, always
      expect(cost).toBeGreaterThanOrEqual(PRICE_BANDS.saveCost[0]);
      expect(cost).toBeLessThanOrEqual(PRICE_BANDS.saveCost[1]);

      const y = drawYieldFor(id);
      expect(y).toBe(drawYieldFor(id));
      expect(y).toBeGreaterThanOrEqual(PRICE_BANDS.drawYield[0]);
      expect(y).toBeLessThanOrEqual(PRICE_BANDS.drawYield[1]);
    }
  });

  test('prices actually vary between cards', () => {
    const costs = new Set(Array.from({ length: 100 }, (_, i) => saveCostFor(`v-${i}`)));
    expect(costs.size).toBeGreaterThan(50);
  });

  test('publish stake rolls inside its band', () => {
    for (let i = 0; i < 200; i++) {
      const stake = rollPublishStake();
      expect(stake).toBeGreaterThanOrEqual(PRICE_BANDS.publishStake[0]);
      expect(stake).toBeLessThanOrEqual(PRICE_BANDS.publishStake[1]);
    }
  });

  test('dividend is the dividend rate of the card price, scaled by provenance', () => {
    const id = 'some-card-id-123';
    const cost = saveCostFor(id);
    const round2 = (n) => Math.round(n * 100) / 100;
    expect(creatorDividendFor(id)).toBe(round2(cost * ECONOMY.DIVIDEND_RATE));
    // provenance weight applies to the (already-rounded) dividend
    expect(dividendFor(id, 'direct')).toBe(round2(creatorDividendFor(id) * 0.5));
    expect(saveValueFor(id, 'discovered')).toBe(cost);
    expect(saveValueFor(id, 'direct')).toBe(round2(cost * 0.5));
  });

  test('round6 keeps six decimals', () => {
    expect(round6(0.1234567)).toBe(0.123457);
  });

  test('config exposes everything the frontend needs', () => {
    const config = economyConfig();
    expect(config.currency.symbol).toBe('/t26');
    expect(config.tiers).toHaveLength(6);
    expect(config.startingGrant).toBe(ECONOMY.STARTING_GRANT);
    expect(config.erosion).toBe('suppressed');
    const vmax = config.tiers.find(t => t.key === 'vmax');
    expect(vmax.odds).toBe(2000);
    expect(config.pricing.saveCost.min).toBe(PRICE_BANDS.saveCost[0]);
    expect(config.pricing.saveCost.max).toBe(PRICE_BANDS.saveCost[1]);
    expect(config.pricing.drawYield.max).toBe(PRICE_BANDS.drawYield[1]);
    expect(config.pricing.publishStake.min).toBe(PRICE_BANDS.publishStake[0]);
    expect(config.pricing.dividendRate).toBe(ECONOMY.DIVIDEND_RATE);
  });
});
