import express from 'express';
import { draw } from '../services/drawEngine.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// The generate button. Rolls a tier, serves a pool card (or a synthetic directive),
// credits the yield, returns full statistics.
router.post('/', requireAuth, (req, res) => {
  try {
    const result = draw(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Draw error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
