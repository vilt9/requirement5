import express from 'express';
import { draw } from '../services/drawEngine.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// The generate button. Rolls a tier, serves a pool card (or a synthetic directive),
// credits the yield, returns full statistics.
router.post('/', requireAuth, (req, res) => {
  try {
    // Optional client-minted uuid for a synthetic result — seeds the yield.
    const seed = typeof req.body?.seed === 'string' && /^[0-9a-f-]{10,64}$/i.test(req.body.seed)
      ? req.body.seed : null;
    const result = draw(req.user.id, Math.random, seed);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Draw error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
