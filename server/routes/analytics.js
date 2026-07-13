// Public analytics endpoint. No auth — the payload is aggregate cohort counts
// only (no usernames, no per-user rows), so it's safe to serve to anyone. The
// footer banner and the /analytics page both read from here.
import express from 'express';
import { computeAnalytics } from '../services/analytics.js';
import { memoryDb } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Event types the client is allowed to log. Saves and card-creates already
// leave their own rows, so the only UI-only signal is the generate click.
const EVENT_TYPES = new Set(['generate']);

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: computeAnalytics() });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to compute analytics' });
  }
});

// Log a usage event. Public and fire-and-forget: optionalAuth tags it with the
// user when a token rides along, otherwise it's a logged-out visitor (user_id
// null). Unknown types are ignored so the endpoint can't be used to spam
// arbitrary buckets.
router.post('/event', optionalAuth, (req, res) => {
  const type = req.body?.type;
  if (!EVENT_TYPES.has(type)) {
    return res.status(400).json({ success: false, error: 'Unknown event type' });
  }
  memoryDb.createEvent({ type, user_id: req.user?.id || null });
  res.json({ success: true });
});

export default router;
