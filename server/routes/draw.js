import express from 'express';
import { draw, drawMany } from '../services/drawEngine.js';
import { memoryDb } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const isSeed = (s) => typeof s === 'string' && /^[0-9a-f-]{10,64}$/i.test(s);

// The generate button. Everyone uses this one rarity-weighted lottery so auth
// state cannot change what cards appear. Signed-in yields go to the account;
// anonymous yields are returned for the browser's pre-signup stash. Pass
// `seeds: [uuid, …]` to refill the client queue in one round-trip, or `seed`
// for one card. Client-minted uuids seed synthetic yields.
router.post('/', optionalAuth, (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.user?.id || null;

    if (Array.isArray(body.seeds)) {
      const seeds = body.seeds.slice(0, 20).map(s => (isSeed(s) ? s : null));
      const draws = seeds.length ? drawMany(userId, seeds.length, Math.random, seeds) : [];
      const balance = draws.length
        ? draws[draws.length - 1].balance
        : (userId ? memoryDb.getUserById(userId).balance : null);
      return res.json({ success: true, data: { draws, balance } });
    }

    const seed = isSeed(body.seed) ? body.seed : null;
    const result = draw(userId, Math.random, seed);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Draw error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
