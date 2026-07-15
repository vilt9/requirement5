// The /t26 economy. Single source of truth for tiers, probabilities and amounts.
// See app/ECONOMY.md for the design rationale.

export const round1 = (n) => Math.round(n * 10) / 10;
export const round2 = (n) => Math.round(n * 100) / 100;
export const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Ordered rarest first. Score ranges match the renderer's existing rarity bands.
// Probabilities are draw probabilities; common takes the remainder.
// Names are plain scarcity words (set A). Keys stay stable so nothing else breaks.
// Rarity colours: the "Deep Sea" ramp — navy → ice cyan, brightening with rarity.
const RARE_TIERS = [
  { key: 'vmax',   name: 'Singular', probability: 0.0005, multiplier: 40, scoreRange: [0.98, 1.0],  color: '#9fe8ff' },
  { key: 'ultra',  name: 'Fine',     probability: 0.002,  multiplier: 18, scoreRange: [0.9, 0.98],  color: '#45d0f0' },
  { key: 'wowa',   name: 'Rare',     probability: 1 / 220, multiplier: 9, scoreRange: [0.85, 0.9],  color: '#1eb2ea' },
  { key: 'galaxy', name: 'Scarce',   probability: 1 / 90,  multiplier: 5, scoreRange: [0.8, 0.85],  color: '#2f8fd0' },
  { key: 'holo',   name: 'Uncommon', probability: 1 / 24,  multiplier: 2, scoreRange: [0.7, 0.8],   color: '#3f6fa0' }
];

const COMMON = {
  key: 'common',
  name: 'Common',
  probability: 1 - RARE_TIERS.reduce((sum, t) => sum + t.probability, 0),
  multiplier: 1,
  scoreRange: [0, 0.7],
  color: '#3b4a5a'
};

export const TIERS = [...RARE_TIERS, COMMON];

export const ECONOMY = {
  STARTING_GRANT: 50,
  DIVIDEND_RATE: 0.2,
  // Overdraft: you can spend into the red down to this floor; at it, spending
  // stops. A negative balance accrues interest, compounded daily.
  DEBT_FLOOR: -1000,
  DEBT_INTEREST_DAILY: 0.0147 // 1.47% / day
};

// ---- Per-card pricing -------------------------------------------------------
// Price TRACKS rarity, but as a wide distribution, not a fixed number. Rarity
// slides the CENTRE of a log-scale band up (a Singular centres far higher than a
// Common); a seeded Gaussian jitter (owned by the card's id) then spreads each
// card around that centre. So rarer cards cost more ON AVERAGE, but the spreads
// overlap heavily — a lucky Common can outprice an unlucky Fine, and once in a
// while a Singular lands at common-money (the "gem in the rough"). The identical
// math lives in src/utils/economyRandom.js — keep them in sync: the price the
// page shows must be exactly the price the server charges.
export const PRICE_BANDS = {
  saveCost: [1.5, 48],     // /t26 to save a card into your collection
  drawYield: [0.01, 0.35], // /t26 earned per generate
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
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

// Standard-normal noise seeded from the card's id (Box–Muller over the same
// mulberry32 stream). Deterministic, so client and server agree bit-for-bit.
const gauss = (seed) => {
  const r = mulberry32(fnv1a(seed));
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Rarity → centre of the price band, as a position in [0,1] on the log scale.
// The anchors were calibrated so each tier's MEAN save price hits its target
// (Common ≈ 6.5 /t26 … Singular ≈ 30) under the Gaussian spread below. Piecewise
// linear through each tier's mid-rarity; flat past the ends.
const PRICE_SPREAD = 0.30; // width of the Gaussian jitter — controls the overlap
const PRICE_MID_RARITIES = [0.35, 0.75, 0.825, 0.875, 0.94, 0.99];
const PRICE_ANCHORS = [0.23019, 0.39971, 0.49042, 0.61776, 0.68766, 0.8744];
const priceCentre = (rarity) => {
  const r = clamp01(rarity);
  const xs = PRICE_MID_RARITIES, ys = PRICE_ANCHORS;
  if (r <= xs[0]) return ys[0];
  if (r >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (r <= xs[i + 1]) {
      const t = (r - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
};

// A card's save price: rarity sets the centre, the id-seeded Gaussian spreads it.
export const saveCostFor = (cardId, rarity = 0.35) =>
  round2(logBand(
    clamp01(priceCentre(rarity) + PRICE_SPREAD * gauss(`${cardId}:save`)),
    PRICE_BANDS.saveCost
  ));

export const drawYieldFor = (seed) =>
  round6(logBand(bell01(`${seed}:yield`), PRICE_BANDS.drawYield));

// Create-flow pricing: a linear base that climbs with the reroll count, plus a
// seeded uniform fraction so the /t26 reads in the currency's fractional style.
// Mirrored in src/utils/economyRandom.js — keep the two in sync.
// Regenerate climbs steeply (+1 per reroll — the gambling tax); creating climbs
// gently (+0.2 per reroll), so fishing costs you at the reroll, not at the mint.
const rand01 = (seed) => mulberry32(fnv1a(seed))();
export const regenCostFor = (rolls, seed) =>
  round2(1 + 1.0 * (Number(rolls) || 0) + rand01(`${seed}:regen`));   // 1.xx, 2.xx, 3.xx …
export const createCostFor = (rolls, seed) =>
  round2(2 + 0.2 * (Number(rolls) || 0) + rand01(`${seed}:create`));  // 2.xx, then slow

// The rarity gamble: a uniform 0..1 draw the SERVER owns, so neither the web
// nor the CLI can self-declare a card's rarity. The tier follows from the score.
export const rollRarity = () => round6(Math.random());

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

// ---- Draw weighting ---------------------------------------------------------
// A published card's chance of being DRAWN falls off with its rarity value:
// weight = e^(-k·rarity), so a rarer card surfaces less. The pool draw picks in
// proportion to these weights, normalised over whatever is currently published —
// so a newly published card just joins the lottery and every share re-balances on
// the next draw (no cron, no stored distribution). A fixed share of every draw
// still mints a brand-new synthetic card, so generating stays generative however
// big the pool grows.
export const DRAW_RARITY_FALLOFF = 8;    // steepness: 0.3→0.9 is ~120× rarer
export const SYNTHETIC_DRAW_SHARE = 0.5; // fraction of draws that mint fresh

export const drawWeightFor = (rarityScore) =>
  Math.exp(-DRAW_RARITY_FALLOFF * clamp01(rarityScore));

// Pick an index in proportion to weights, given a uniform u in [0,1). Returns -1
// when the weights are empty or sum to zero. Pure and deterministic — the draw
// engine and its tests both drive it.
export const pickWeightedIndex = (weights, u) => {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  if (!(total > 0)) return -1;
  let r = u * total;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0) r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
};

export const creatorDividendFor = (cardId, rarity = 0.35) =>
  round2(saveCostFor(cardId, rarity) * ECONOMY.DIVIDEND_RATE);

// Save provenance — how the saver reached the card. A "discovered" save (you
// pressed Generate and the card surfaced) is worth more than a "direct" save
// (you opened a shared link). The weight scales the save's value and the creator
// dividend, so link-hopping to save is deliberately worth less than discovery.
// Default is 'discovered' so the existing generate→save flow is unchanged.
export const DISCOVERY_WEIGHTS = { discovered: 1, direct: 0.5 };

export const normalizeProvenance = (p) => (p === 'direct' ? 'direct' : 'discovered');

// A save's "worth": the card's own price scaled by provenance.
export const saveValueFor = (cardId, provenance = 'discovered', rarity = 0.35) =>
  round2(saveCostFor(cardId, rarity) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

// The creator dividend for a save, scaled by provenance.
export const dividendFor = (cardId, provenance = 'discovered', rarity = 0.35) =>
  round2(creatorDividendFor(cardId, rarity) * DISCOVERY_WEIGHTS[normalizeProvenance(provenance)]);

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
  debtFloor: ECONOMY.DEBT_FLOOR,
  debtInterestDaily: ECONOMY.DEBT_INTEREST_DAILY,
  erosion: 'suppressed'
});
