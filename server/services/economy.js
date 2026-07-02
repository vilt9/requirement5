// The /t26 economy. Single source of truth for tiers, probabilities and amounts.
// See app/ECONOMY.md for the design rationale.

export const round1 = (n) => Math.round(n * 10) / 10;
export const round2 = (n) => Math.round(n * 100) / 100;
export const round6 = (n) => Math.round(n * 1e6) / 1e6;

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
  DIVIDEND_RATE: 0.2,
  DAILY_YIELD_CAP: 100
};

// ---- Per-card pricing -------------------------------------------------------
// Prices are DECOUPLED from rarity: every card rolls its own price from its id,
// on a wide log-scale bell — most cards land near the band's geometric middle,
// the occasional one is very cheap or very expensive. A rare-LOOKING card can
// be a bargain (the diamond in the rough), and a plain one can carry a price.
// The identical math lives in src/utils/economyRandom.js — keep them in sync:
// the price the page shows must be exactly the price the server charges.
export const PRICE_BANDS = {
  saveCost: [1.5, 48],     // /t26 to save a card into your collection
  drawYield: [0.002, 1.8], // /t26 earned per generate
  publishStake: [1, 4]     // /t26 to publish a card into the pool
};

const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Bell-shaped 0..1 (mean of three uniforms), mapped across a band on a log
// scale so the spread feels multiplicative rather than additive.
const bell01 = (seed) => {
  const r = mulberry32(fnv1a(seed));
  return (r() + r() + r()) / 3;
};

const logBand = (n, [min, max]) => min * Math.pow(max / min, n);

export const saveCostFor = (cardId) =>
  round2(logBand(bell01(`${cardId}:save`), PRICE_BANDS.saveCost));

export const drawYieldFor = (seed) =>
  round6(logBand(bell01(`${seed}:yield`), PRICE_BANDS.drawYield));

export const rollPublishStake = (rand = Math.random) =>
  round2(logBand((rand() + rand() + rand()) / 3, PRICE_BANDS.publishStake));

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

export const creatorDividendFor = (cardId) =>
  round2(saveCostFor(cardId) * ECONOMY.DIVIDEND_RATE);

// Save provenance — how the saver reached the card. A "discovered" save (you
// pressed Generate and the card surfaced) is worth more than a "direct" save
// (you opened a shared link). The weight scales the save's value and the creator
// dividend, so link-hopping to save is deliberately worth less than discovery.
// Default is 'discovered' so the existing generate→save flow is unchanged.
export const DISCOVERY_WEIGHTS = { discovered: 1, direct: 0.5 };

export const normalizeProvenance = (p) => (p === 'direct' ? 'direct' : 'discovered');

// A save's "worth": the card's own price scaled by provenance.
export const saveValueFor = (cardId, provenance = 'discovered') =>
  round2(saveCostFor(cardId) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

// The creator dividend for a save, scaled by provenance.
export const dividendFor = (cardId, provenance = 'discovered') =>
  round2(creatorDividendFor(cardId) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

// Everything the frontend needs to render odds, costs and bands. Tiers carry
// rarity/odds only — prices are per-card (see PRICE_BANDS).
export const economyConfig = () => ({
  currency: { name: 'Slash_T2.6', symbol: '/t26', smallestUnit: 0.000001 },
  tiers: TIERS.map(t => ({
    key: t.key,
    name: t.name,
    probability: t.probability,
    odds: t.key === 'common' ? null : Math.round(1 / t.probability),
    multiplier: t.multiplier,
    scoreRange: t.scoreRange,
    color: t.color
  })),
  pricing: {
    saveCost: { min: PRICE_BANDS.saveCost[0], max: PRICE_BANDS.saveCost[1] },
    drawYield: { min: PRICE_BANDS.drawYield[0], max: PRICE_BANDS.drawYield[1] },
    publishStake: { min: PRICE_BANDS.publishStake[0], max: PRICE_BANDS.publishStake[1] },
    dividendRate: ECONOMY.DIVIDEND_RATE
  },
  startingGrant: ECONOMY.STARTING_GRANT,
  dailyYieldCap: ECONOMY.DAILY_YIELD_CAP,
  erosion: 'suppressed'
});
