import express from 'express';
import { memoryDb } from '../config/database.js';
import { economyConfig, TIERS, regenCostFor, createCostFor } from '../services/economy.js';
import { yieldRemainingToday, absorb, InsufficientFundsError } from '../services/ledger.js';
import { requireAuth } from '../middleware/auth.js';
import { storageInfo } from '../storage/index.js';

const router = express.Router();

// Public: tiers, probabilities, costs. The frontend renders all bands/odds from this.
router.get('/config', (req, res) => {
  res.json({ success: true, data: economyConfig() });
});

router.get('/balance', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      balance: req.user.balance,
      yieldRemainingToday: yieldRemainingToday(req.user)
    }
  });
});

// Charge a card regeneration (reroll) for the signed-in creator. The price is
// computed server-side from the reroll count + card seed (mirrored formula), so
// the client can't undercut it. Card generation itself is client-side; this is
// purely the /t26 charge. 402 when the balance can't cover it.
router.post('/reroll', requireAuth, (req, res) => {
  const rolls = Math.max(0, Math.min(9999, parseInt(req.body?.rolls, 10) || 0));
  const seed = String(req.body?.seed || '');
  const charged = regenCostFor(rolls, seed);
  try {
    absorb(req.user.id, 'reroll', charged);
    res.json({ success: true, data: { charged, balance: memoryDb.getUserById(req.user.id).balance } });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: 'Not enough /t26 to regenerate' });
    }
    console.error('Reroll charge error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Charge the create fee — pressing "Start" to commit a rolled card into the
// design flow. Priced server-side from (rolls, seed) via createCostFor (a gentle
// climb, unlike the reroll). 402 when the balance can't cover it.
router.post('/create', requireAuth, (req, res) => {
  const rolls = Math.max(0, Math.min(9999, parseInt(req.body?.rolls, 10) || 0));
  const seed = String(req.body?.seed || '');
  const charged = createCostFor(rolls, seed);
  try {
    absorb(req.user.id, 'create_stake', charged);
    res.json({ success: true, data: { charged, balance: memoryDb.getUserById(req.user.id).balance } });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: 'Not enough /t26 to create this card' });
    }
    console.error('Create charge error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
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
