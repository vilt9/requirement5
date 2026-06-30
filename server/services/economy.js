// The /t26 economy. Single source of truth for tiers, probabilities and amounts.
// See app/ECONOMY.md for the design rationale.

export const round1 = (n) => Math.round(n * 10) / 10;

// Ordered rarest first. Score ranges match the renderer's existing rarity bands.
// Probabilities are draw probabilities; common takes the remainder.
// Names are plain scarcity words (set A). Keys stay stable so nothing else breaks.
const RARE_TIERS = [
  { key: 'vmax',   name: 'Singular', probability: 0.0005, multiplier: 40, scoreRange: [0.98, 1.0],  color: '#f80e7b' },
  { key: 'ultra',  name: 'Fine',     probability: 0.002,  multiplier: 18, scoreRange: [0.9, 0.98],  color: '#eedf10' },
  { key: 'wowa',   name: 'Rare',     probability: 1 / 220, multiplier: 9, scoreRange: [0.85, 0.9],  color: '#0dbde9' },
  { key: 'galaxy', name: 'Scarce',   probability: 1 / 90,  multiplier: 5, scoreRange: [0.8, 0.85],  color: '#c929f1' },
  { key: 'holo',   name: 'Uncommon', probability: 1 / 24,  multiplier: 2, scoreRange: [0.7, 0.8],   color: '#21e985' }
];

const COMMON = {
  key: 'common',
  name: 'Common',
  probability: 1 - RARE_TIERS.reduce((sum, t) => sum + t.probability, 0),
  multiplier: 1,
  scoreRange: [0, 0.7],
  color: '#888888'
};

export const TIERS = [...RARE_TIERS, COMMON];

export const ECONOMY = {
  STARTING_GRANT: 50,
  DRAW_YIELD_BASE: 1,
  SAVE_COST_BASE: 4,
  DIVIDEND_RATE: 0.2,
  PUBLISH_STAKE: 10,
  DAILY_YIELD_CAP: 100
};

export const getTier = (key) => TIERS.find(t => t.key === key) || null;

export const tierForScore = (score) => {
  const s = Math.max(0, Math.min(1, Number(score) || 0));
  return TIERS.find(t => s >= t.scoreRange[0] && s <= t.scoreRange[1] &&
    // ranges share boundaries; rarest tier wins the boundary by order
    true) || COMMON;
};

// Roll a tier. rand is injectable for tests; defaults to Math.random.
export const rollTier = (rand = Math.random) => {
  const roll = rand();
  let cumulative = 0;
  for (const tier of RARE_TIERS) {
    cumulative += tier.probability;
    if (roll < cumulative) return tier;
  }
  return COMMON;
};

export const drawYield = (tierKey) =>
  round1(ECONOMY.DRAW_YIELD_BASE * getTier(tierKey).multiplier);

export const saveCost = (tierKey) =>
  round1(ECONOMY.SAVE_COST_BASE * getTier(tierKey).multiplier);

export const creatorDividend = (tierKey) =>
  round1(saveCost(tierKey) * ECONOMY.DIVIDEND_RATE);

export const cloudShare = (tierKey) =>
  round1(saveCost(tierKey) - creatorDividend(tierKey));

// Save provenance — how the saver reached the card. A "discovered" save (you
// pressed Generate and the card surfaced) is worth more than a "direct" save
// (you opened a shared link). The weight scales the save's value and the creator
// dividend, so link-hopping to save is deliberately worth less than discovery.
// Default is 'discovered' so the existing generate→save flow is unchanged.
export const DISCOVERY_WEIGHTS = { discovered: 1, direct: 0.5 };

export const normalizeProvenance = (p) => (p === 'direct' ? 'direct' : 'discovered');

// A save's "worth": the tier's save cost scaled by provenance.
export const saveValue = (tierKey, provenance = 'discovered') =>
  round1(saveCost(tierKey) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

// The creator dividend for a save, scaled by provenance.
export const dividendFor = (tierKey, provenance = 'discovered') =>
  round1(creatorDividend(tierKey) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

// Everything the frontend needs to render odds, costs and bands.
export const economyConfig = () => ({
  currency: { name: 'Slash_T2.6', symbol: '/t26', smallestUnit: 0.1 },
  tiers: TIERS.map(t => ({
    key: t.key,
    name: t.name,
    probability: t.probability,
    odds: t.key === 'common' ? null : Math.round(1 / t.probability),
    multiplier: t.multiplier,
    scoreRange: t.scoreRange,
    color: t.color,
    drawYield: drawYield(t.key),
    saveCost: saveCost(t.key),
    creatorDividend: creatorDividend(t.key)
  })),
  startingGrant: ECONOMY.STARTING_GRANT,
  publishStake: ECONOMY.PUBLISH_STAKE,
  dailyYieldCap: ECONOMY.DAILY_YIELD_CAP,
  erosion: 'suppressed'
});
