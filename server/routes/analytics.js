// Public analytics endpoint. No auth — the payload is aggregate cohort counts
// only (no usernames, no per-user rows), so it's safe to serve to anyone. The
// footer banner and the /analytics page both read from here.
import express from 'express';
import { computeAnalytics } from '../services/analytics.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: computeAnalytics() });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to compute analytics' });
  }
});

export default router;
