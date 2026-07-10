import express from 'express';
import { memoryDb } from '../config/database.js';
import { economyConfig, TIERS, regenCostFor, createCostFor, rollRarity, tierForScore } from '../services/economy.js';
import { yieldRemainingToday, absorb, accrueInterest, InsufficientFundsError } from '../services/ledger.js';
import { requireAuth } from '../middleware/auth.js';
import { storageInfo } from '../storage/index.js';

const router = express.Router();

// Public: tiers, probabilities, costs. The frontend renders all bands/odds from this.
router.get('/config', (req, res) => {
  res.json({ success: true, data: economyConfig() });
});

router.get('/balance', requireAuth, (req, res) => {
  // Bring any debt interest current before reporting the balance.
  const user = accrueInterest(req.user.id) || req.user;
  res.json({
    success: true,
    data: {
      balance: user.balance,
      yieldRemainingToday: yieldRemainingToday(user),
      inDebt: user.balance < 0
    }
  });
});

// ---------- Rarity rolls (server-authoritative; shared by web + CLI) ----------
// The server owns the rolled rarity. You get one free roll per card; rerolling
// for a better number costs (steeply); committing to design costs the (gentle)
// create fee. The roll is consumed when a card is published (see cards.js).

// The client-facing view of a roll + the next reroll/create prices.
const rollView = (roll, balance) => {
  const tier = tierForScore(roll.rarity_score);
  return {
    roll: {
      id: roll.id,
      rarityScore: roll.rarity_score,
      rerolls: roll.rerolls,
      committed: !!roll.committed,
      tier: tier ? { key: tier.key, name: tier.name } : null
    },
    prices: {
      reroll: regenCostFor(roll.rerolls, roll.id),
      create: createCostFor(roll.rerolls, roll.id)
    },
    balance
  };
};

// Start (or fetch) the active rarity roll. Free — but idempotent: an existing
// active roll is returned rather than handing out a fresh free one (so you
// can't dodge the reroll fee by asking for a new free roll).
router.post('/roll', requireAuth, (req, res) => {
  accrueInterest(req.user.id);
  let roll = memoryDb.getActiveRollByUser(req.user.id);
  if (!roll) roll = memoryDb.createRoll({ user_id: req.user.id, rarity_score: rollRarity() });
  res.json({ success: true, data: rollView(roll, memoryDb.getUserById(req.user.id).balance) });
});

// Reroll the active roll: a fresh random rarity, charged the steep reroll fee.
// Un-commits the roll (a new gamble means the create fee applies again).
router.post('/roll/reroll', requireAuth, (req, res) => {
  const roll = memoryDb.getActiveRollByUser(req.user.id);
  if (!roll) return res.status(404).json({ success: false, error: 'No active roll — start one first' });
  const charged = regenCostFor(roll.rerolls, roll.id);
  try {
    absorb(req.user.id, 'reroll', charged);
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: 'Debt limit reached — pay down /t26 before rerolling' });
    }
    console.error('Reroll error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
  const updated = memoryDb.updateRoll(roll.id, {
    rarity_score: rollRarity(), rerolls: roll.rerolls + 1, committed: false
  });
  res.json({ success: true, data: { ...rollView(updated, memoryDb.getUserById(req.user.id).balance), charged } });
});

// Commit the active roll — pay the gentle create fee to lock the rarity in for
// designing. Idempotent: already committed → no extra charge.
router.post('/roll/commit', requireAuth, (req, res) => {
  const roll = memoryDb.getActiveRollByUser(req.user.id);
  if (!roll) return res.status(404).json({ success: false, error: 'No active roll — start one first' });
  let charged = 0;
  if (!roll.committed) {
    charged = createCostFor(roll.rerolls, roll.id);
    try {
      absorb(req.user.id, 'create_stake', charged);
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        return res.status(402).json({ success: false, error: 'Debt limit reached — pay down /t26 before creating' });
      }
      console.error('Commit error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
    memoryDb.updateRoll(roll.id, { committed: true });
  }
  const updated = memoryDb.getRollById(roll.id);
  res.json({ success: true, data: { ...rollView(updated, memoryDb.getUserById(req.user.id).balance), charged } });
});

router.get('/transactions', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const txns = memoryDb.getTransactionsByUser(req.user.id).slice(0, limit);
  res.json({ success: true, data: txns });
});

// Public: the cloud's books + pool composition. Deep game, open books.
router.get('/cloud', (req, res) => {
  const cloud = memoryDb.getCloud();
  const published = memoryDb.getCommunityCards();
  const tierCounts = {};
  for (const tier of TIERS) {
    tierCounts[tier.key] = published.filter(c => c.tier === tier.key).length;
  }
  res.json({
    success: true,
    data: {
      totalIssued: cloud.total_issued,
      totalAbsorbed: cloud.total_absorbed,
      inCirculation: Math.round((cloud.total_issued - cloud.total_absorbed) * 1e6) / 1e6,
      publishedCards: published.length,
      tierCounts,
      storage: storageInfo()
    }
  });
});

export default router;
