// The draw: a weighted lottery over the published pool where a card's chance
// falls off with its rarity value, plus a synthetic slice that keeps generating
// fresh cards. Credits the yield. Draws come in batches so the client can refill
// its prefetch queue in a single round-trip.
import { memoryDb } from '../config/database.js';
import {
  saveCostFor, creatorDividendFor, drawYieldFor, TIERS, getTier,
  drawWeightFor, pickWeightedIndex, SYNTHETIC_DRAW_SHARE
} from './economy.js';
import { creditDrawYield } from './ledger.js';
import crypto from 'node:crypto';

// Per-card statistics exposed with every draw. Deep game: everything visible.
export const cardStats = (card) => {
  const tier = TIERS.find(t => t.key === card.tier) || null;
  const poolPeers = card.tier ? memoryDb.getPublishedCardsByTier(card.tier).length : 0;
  const pool = memoryDb.getCommunityCards();
  const totalPublished = pool.length;
  // A card's true chance on a single draw: it must land in the pool half of the
  // draw (1 − synthetic share), then win the rarity-weighted lottery.
  const totalWeight = pool.reduce((s, c) => s + drawWeightFor(c.rarity_score), 0);
  const drawWeight = totalWeight > 0
    ? (1 - SYNTHETIC_DRAW_SHARE) * drawWeightFor(card.rarity_score) / totalWeight
    : null;
  return {
    tier: card.tier,
    tierName: tier ? tier.name : null,
    rarityScore: card.rarity_score,
    // probability this exact card comes up on a draw
    drawWeight,
    poolShare: totalPublished > 0 ? poolPeers / totalPublished : null,
    timesDrawn: card.times_drawn || 0,
    timesSaved: card.times_saved || 0,
    saveCost: saveCostFor(card.id, card.rarity_score),
    creatorDividend: creatorDividendFor(card.id, card.rarity_score),
    creatorId: card.creator_id
  };
};

// Shape one draw's result (pool card or synthetic directive) and credit its yield.
// `yieldSeed` is the id the amount is seeded from — the drawn card's id, or the
// client-minted uuid for a synthetic — so the amount shown equals the amount booked.
const buildResult = (userId, card, yieldSeed) => {
  const fullYield = drawYieldFor(yieldSeed);
  const credited = creditDrawYield(userId, fullYield, card ? { card_id: card.id } : {});
  const user = memoryDb.getUserById(userId);
  const tier = card ? getTier(card.tier) : null;
  return {
    source: card ? 'pool' : 'synthetic',
    tier: tier
      ? { key: tier.key, name: tier.name, scoreRange: tier.scoreRange, multiplier: tier.multiplier }
      : null,
    card: card || null,
    stats: card ? cardStats(card) : null,
    yield: { full: fullYield, credited, capped: credited < fullYield },
    balance: user.balance
  };
};

// Draw `count` cards in one pass. Pool cards are drawn WITHOUT replacement within
// the batch (a working copy of the pool is depleted as we go), so a refill never
// queues the same pool card twice in a row. `seeds[i]` seeds the i-th synthetic.
export const drawMany = (userId, count, rand = Math.random, seeds = []) => {
  const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)));
  const pool = memoryDb.getCommunityCards().slice(); // mutable working copy
  const results = [];
  for (let i = 0; i < n; i++) {
    let card = null;
    // Synthetic slice keeps generation fresh; an empty pool ⇒ always synthetic.
    if (pool.length > 0 && rand() >= SYNTHETIC_DRAW_SHARE) {
      const weights = pool.map(c => drawWeightFor(c.rarity_score));
      const idx = pickWeightedIndex(weights, rand());
      if (idx >= 0) {
        const picked = pool.splice(idx, 1)[0]; // remove ⇒ no repeats in this batch
        memoryDb.incrementCardCounter(picked.id, 'times_drawn');
        card = memoryDb.getCardById(picked.id);
      }
    }
    const yieldSeed = card ? card.id : (seeds[i] || crypto.randomUUID());
    results.push(buildResult(userId, card, yieldSeed));
  }
  return results;
};

// Single draw — the batch of one. Kept for callers (and tests) that want one card.
export const draw = (userId, rand = Math.random, seed = null) =>
  drawMany(userId, 1, rand, [seed])[0];
