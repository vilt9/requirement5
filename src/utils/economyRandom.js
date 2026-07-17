// Per-card pricing, seeded from the card's id. EXACT mirror of the maths in
// server/services/economy.js — keep the two in sync: the price the page shows
// must be exactly the price the server charges. Price TRACKS rarity as a wide
// distribution: rarity slides the centre of a log-scale band up, an id-seeded
// Gaussian jitter spreads each card around it. Rarer cards cost more on average,
// but the spreads overlap heavily — a lucky Common can outprice an unlucky Fine,
// and occasionally a Singular lands at common-money (the "gem in the rough").

export const PRICE_BANDS = {
  saveCost: [1.5, 48],     // /t26 to save a card into your collection
  drawYield: [0.018, 0.63], // /t26 earned per generate
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

// Bell-shaped 0..1 (mean of three uniforms), mapped across a band on a log scale.
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

// Rarity → centre of the price band (position in [0,1] on the log scale). Anchors
// calibrated so each tier's MEAN save price hits target (Common ≈ 6.5 … Singular
// ≈ 30) under the Gaussian spread. EXACT mirror of server/services/economy.js.
const PRICE_SPREAD = 0.30;
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

export const saveCostFor = (cardId, rarity = 0.35) =>
  Math.round(logBand(
    clamp01(priceCentre(rarity) + PRICE_SPREAD * gauss(`${cardId}:save`)),
    PRICE_BANDS.saveCost
  ) * 100) / 100;

export const drawYieldFor = (seed) =>
  Math.round(logBand(bell01(`${seed}:yield`), PRICE_BANDS.drawYield) * 1e6) / 1e6;

// Create-flow pricing: linear base climbing with the reroll count. Each reroll
// adds its whole-number step plus a small mean-zero wobble drawn fresh from that
// reroll's index, so the pennies jump around as the price climbs while the
// average step is unchanged (+1.0 regen, +0.2 create). The wobble stays smaller
// than the step, so the price never ticks backwards. EXACT mirror of
// server/services/economy.js — the price shown must equal the price charged.
// Regenerate climbs steeply (the gambling tax); creating climbs gently, so
// fishing costs you at the reroll, not at the mint.
const rand01 = (seed) => mulberry32(fnv1a(seed))();
const WOBBLE = 0.4; // peak-to-peak jitter on each step; < the create step of 0.2*2
const climb = (start, slope, rolls, seed) => {
  let total = start + rand01(`${seed}:base`);
  for (let i = 1; i <= (Number(rolls) || 0); i++) {
    total += slope + WOBBLE * (rand01(`${seed}:${i}`) - 0.5);
  }
  return Math.round(total * 100) / 100;
};
export const regenCostFor = (rolls, seed) => climb(1, 1.0, rolls, `${seed}:regen`);
export const createCostFor = (rolls, seed) => climb(2, 0.2, rolls, `${seed}:create`);

// Linked-save surcharge — EXACT mirror of server/services/economy.js. A save
// reached via a shared link costs the base price times this per-card multiplier
// (a fixed, id-seeded value in a highish band). Discovered saves pay the base.
export const LINKED_SURCHARGE_BAND = [1.5, 3];
export const linkedSurchargeFor = (cardId) => {
  const [min, max] = LINKED_SURCHARGE_BAND;
  return Math.round((min + rand01(`${cardId}:linked`) * (max - min)) * 100) / 100;
};
export const savePriceFor = (cardId, provenance = 'discovered', rarity = 0.35) => {
  const base = saveCostFor(cardId, rarity);
  return (provenance === 'linked' || provenance === 'direct')
    ? Math.round(base * linkedSurchargeFor(cardId) * 100) / 100
    : base;
};

// Display: whole-ish amounts read with 2 decimals (3 for running totals, via
// dp); sub-1 amounts keep their full 6-decimal precision (that's the texture
// of the currency).
export const fmtT26 = (v, dp = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1) return n.toFixed(dp);
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
};
