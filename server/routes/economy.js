import express from 'express';
import { memoryDb } from '../config/database.js';
import { economyConfig, TIERS } from '../services/economy.js';
import { yieldRemainingToday, accrueInterest } from '../services/ledger.js';
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

// The rarity gamble + card creation live under /api/cards/create/* (see
// cards.js) — the same endpoints serve the web and the CLI.

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
