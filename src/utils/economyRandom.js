// Per-card pricing, seeded from the card's id. EXACT mirror of the maths in
// server/services/economy.js — keep the two in sync: the price the page shows
// must be exactly the price the server charges. Prices are decoupled from
// rarity on purpose (a rare-looking card can be cheap — the diamond in the
// rough); each card rolls its own price on a wide log-scale bell.

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

// Bell-shaped 0..1 (mean of three uniforms), mapped across a band on a log scale.
const bell01 = (seed) => {
  const r = mulberry32(fnv1a(seed));
  return (r() + r() + r()) / 3;
};

const logBand = (n, [min, max]) => min * Math.pow(max / min, n);

export const saveCostFor = (cardId) =>
  Math.round(logBand(bell01(`${cardId}:save`), PRICE_BANDS.saveCost) * 100) / 100;

export const drawYieldFor = (seed) =>
  Math.round(logBand(bell01(`${seed}:yield`), PRICE_BANDS.drawYield) * 1e6) / 1e6;

// Display: whole-ish amounts read with 2 decimals; sub-1 amounts keep their
// full 6-decimal precision (that's the texture of the currency).
export const fmtT26 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
};
