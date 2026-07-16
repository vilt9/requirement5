import {
  TIERS, ECONOMY, getTier, tierForScore, PRICE_BANDS,
  saveCostFor, drawYieldFor, rollPublishStake,
  savePriceFor, linkedSurchargeFor, dividendFor, round6, economyConfig,
  LINKED_SURCHARGE_BAND
} from '../services/economy.js';

describe('economy tiers', () => {
  test('score bands cover 0..1 with no gaps and no overlap — the bands ARE the odds', () => {
    const sorted = [...TIERS].sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);
    expect(sorted[0].scoreRange[0]).toBe(0);
    expect(sorted[sorted.length - 1].scoreRange[1]).toBe(1);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].scoreRange[0]).toBe(sorted[i - 1].scoreRange[1]);
    }
    // Total width is 1, so a uniform rollRarity() always lands in exactly one tier.
    const width = sorted.reduce((sum, t) => sum + (t.scoreRange[1] - t.scoreRange[0]), 0);
    expect(width).toBeCloseTo(1, 10);
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

  test('linked saves cost a per-card surcharge; the dividend is 70% of the price paid', () => {
    const id = 'some-card-id-123';
    const round2 = (n) => Math.round(n * 100) / 100;
    const base = saveCostFor(id);

    // Discovered save = base price; dividend is 70% of it.
    expect(savePriceFor(id, 'discovered')).toBe(base);
    expect(dividendFor(id, 'discovered')).toBe(round2(base * ECONOMY.DIVIDEND_RATE));

    // Linked save = base × a fixed per-card surcharge in the band; costs more.
    const mult = linkedSurchargeFor(id);
    expect(mult).toBeGreaterThanOrEqual(LINKED_SURCHARGE_BAND[0]);
    expect(mult).toBeLessThanOrEqual(LINKED_SURCHARGE_BAND[1]);
    const linked = savePriceFor(id, 'linked');
    expect(linked).toBe(round2(base * mult));
    expect(linked).toBeGreaterThan(base);
    // 'direct' is a legacy alias for 'linked'
    expect(savePriceFor(id, 'direct')).toBe(linked);
    // Dividend follows the higher price — the designer earns more on a linked save.
    expect(dividendFor(id, 'linked')).toBe(round2(linked * ECONOMY.DIVIDEND_RATE));
    expect(dividendFor(id, 'linked')).toBeGreaterThan(dividendFor(id, 'discovered'));
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
    expect(vmax.scoreRange).toEqual([0.98, 1.0]);
    // Deliberately absent: a wrong "1 : N" label was derived from these.
    expect(vmax.odds).toBeUndefined();
    expect(vmax.probability).toBeUndefined();
    expect(config.pricing.saveCost.min).toBe(PRICE_BANDS.saveCost[0]);
    expect(config.pricing.saveCost.max).toBe(PRICE_BANDS.saveCost[1]);
    expect(config.pricing.drawYield.max).toBe(PRICE_BANDS.drawYield[1]);
    expect(config.pricing.publishStake.min).toBe(PRICE_BANDS.publishStake[0]);
    expect(config.pricing.dividendRate).toBe(ECONOMY.DIVIDEND_RATE);
  });
});
