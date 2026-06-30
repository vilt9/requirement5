// The draw: roll a tier, serve a published card from the pool if one exists,
// otherwise direct the client to synthesise one in that tier. Credits the yield.
import { memoryDb } from '../config/database.js';
import { rollTier, drawYield, saveCost, creatorDividend, TIERS } from './economy.js';
import { creditDrawYield } from './ledger.js';

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
    saveCost: card.tier ? saveCost(card.tier) : null,
    creatorDividend: card.tier ? creatorDividend(card.tier) : null,
    creatorId: card.creator_id
  };
};

export const draw = (userId, rand = Math.random) => {
  const tier = rollTier(rand);
  const fullYield = drawYield(tier.key);

  const pool = memoryDb.getPublishedCardsByTier(tier.key);
  let card = null;
  if (pool.length > 0) {
    card = pool[Math.floor(rand() * pool.length)];
    memoryDb.incrementCardCounter(card.id, 'times_drawn');
    card = memoryDb.getCardById(card.id);
  }

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
