// The draw: roll a tier, serve a published card from the pool if one exists,
// otherwise direct the client to synthesise one in that tier. Credits the yield.
import { memoryDb } from '../config/database.js';
import { rollTier, saveCostFor, creatorDividendFor, drawYieldFor, TIERS } from './economy.js';
import { creditDrawYield } from './ledger.js';
import crypto from 'node:crypto';

// Per-card statistics exposed with every draw. Deep game: everything visible.
export const cardStats = (card) => {
  const tier = TIERS.find(t => t.key === card.tier) || null;
  const poolPeers = card.tier ? memoryDb.getPublishedCardsByTier(card.tier).length : 0;
  const totalPublished = memoryDb.getCommunityCards().length;
  return {
    tier: card.tier,
    tierName: tier ? tier.name : null,
    rarityScore: card.rarity_score,
    // probability this exact card comes up on a draw
    drawWeight: tier && poolPeers > 0 ? tier.probability / poolPeers : null,
    poolShare: totalPublished > 0 ? poolPeers / totalPublished : null,
    timesDrawn: card.times_drawn || 0,
    timesSaved: card.times_saved || 0,
    saveCost: saveCostFor(card.id),
    creatorDividend: creatorDividendFor(card.id),
    creatorId: card.creator_id
  };
};

// `seed` is the uuid the client pre-minted for a synthetic result — the yield
// is seeded from the id of whatever card the draw lands on, so the amount the
// page shows for a card is the amount the ledger recorded.
export const draw = (userId, rand = Math.random, seed = null) => {
  const tier = rollTier(rand);

  const pool = memoryDb.getPublishedCardsByTier(tier.key);
  let card = null;
  if (pool.length > 0) {
    card = pool[Math.floor(rand() * pool.length)];
    memoryDb.incrementCardCounter(card.id, 'times_drawn');
    card = memoryDb.getCardById(card.id);
  }

  const yieldSeed = card ? card.id : (seed || crypto.randomUUID());
  const fullYield = drawYieldFor(yieldSeed);
  const credited = creditDrawYield(userId, fullYield, card ? { card_id: card.id } : {});
  const user = memoryDb.getUserById(userId);

  return {
    source: card ? 'pool' : 'synthetic',
    tier: {
      key: tier.key,
      name: tier.name,
      probability: tier.probability,
      scoreRange: tier.scoreRange,
      multiplier: tier.multiplier
    },
    card: card || null,
    stats: card ? cardStats(card) : null,
    yield: { full: fullYield, credited, capped: credited < fullYield },
    balance: user.balance
  };
};
