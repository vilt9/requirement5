import express from 'express';
import { requireOperator } from '../middleware/operator.js';
import { createHandoff, HandoffError } from '../services/handoff.js';

const router = express.Router();
router.use(requireOperator);

router.get('/auth/check', (req, res) => {
  res.json({
    success: true,
    data: {
      authorized: true,
      studioUsername: req.operator.studioUsername,
      maxOpeningBalance: req.operator.maxOpeningBalance
    }
  });
});

router.post('/handoffs', (req, res) => {
  try {
    const data = createHandoff(req.body || {}, req.operator);
    res.status(data.reused ? 200 : 201).json({ success: true, data });
  } catch (error) {
    if (error instanceof HandoffError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    console.error('Operator handoff error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
