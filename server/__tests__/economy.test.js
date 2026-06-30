import {
  TIERS, ECONOMY, getTier, tierForScore, rollTier,
  drawYield, saveCost, creatorDividend, cloudShare, round1, economyConfig
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

describe('economy amounts', () => {
  test('yields, costs and dividends derive from multipliers', () => {
    expect(drawYield('common')).toBe(1);
    expect(drawYield('vmax')).toBe(40);
    expect(saveCost('common')).toBe(4);
    expect(saveCost('galaxy')).toBe(20);
    expect(saveCost('vmax')).toBe(160);
    expect(creatorDividend('common')).toBe(0.8);
    expect(creatorDividend('galaxy')).toBe(4);
    expect(creatorDividend('vmax')).toBe(32);
  });

  test('dividend + cloud share equals the save cost for every tier', () => {
    for (const tier of TIERS) {
      expect(round1(creatorDividend(tier.key) + cloudShare(tier.key)))
        .toBe(saveCost(tier.key));
    }
  });

  test('config exposes everything the frontend needs', () => {
    const config = economyConfig();
    expect(config.currency.symbol).toBe('/t26');
    expect(config.tiers).toHaveLength(6);
    expect(config.startingGrant).toBe(ECONOMY.STARTING_GRANT);
    expect(config.erosion).toBe('suppressed');
    const vmax = config.tiers.find(t => t.key === 'vmax');
    expect(vmax.odds).toBe(2000);
    expect(vmax.saveCost).toBe(160);
  });
});
