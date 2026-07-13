import express from 'express';
import { draw, drawMany } from '../services/drawEngine.js';
import { memoryDb } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const isSeed = (s) => typeof s === 'string' && /^[0-9a-f-]{10,64}$/i.test(s);

// The generate button. A rarity-weighted lottery over the pool (rarer cards
// surface less), with a synthetic slice for fresh cards; credits the yield and
// returns full statistics. Pass `seeds: [uuid, …]` to draw a whole batch in one
// round-trip (the client refills its prefetch queue this way); or a single
// `seed` for one card. Client-minted uuids seed the synthetic yields.
router.post('/', requireAuth, (req, res) => {
  try {
    const body = req.body || {};

    if (Array.isArray(body.seeds)) {
      const seeds = body.seeds.slice(0, 20).map(s => (isSeed(s) ? s : null));
      const draws = seeds.length ? drawMany(req.user.id, seeds.length, Math.random, seeds) : [];
      const balance = draws.length
        ? draws[draws.length - 1].balance
        : memoryDb.getUserById(req.user.id).balance;
      return res.json({ success: true, data: { draws, balance } });
    }

    const seed = isSeed(body.seed) ? body.seed : null;
    const result = draw(req.user.id, Math.random, seed);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Draw error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
