import express from 'express';
import User, { publicUser } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { issue } from '../services/ledger.js';
import { memoryDb } from '../config/database.js';
import { ECONOMY } from '../services/economy.js';

const router = express.Router();

// Logged-out visitors earn a local "stash" per generate; it rides along on
// signup/login and is credited here. Client-claimed, so clamp it to one day's
// yield cap — the stakes are toy, the clamp keeps them that way.
const claimStash = (userId, stash) => {
  const amount = Math.min(ECONOMY.DAILY_YIELD_CAP, Math.max(0, Math.floor(Number(stash) || 0)));
  if (amount > 0) issue(userId, 'claimed_yield', amount);
  return memoryDb.getUserById(userId);
};

router.post('/signup', async (req, res) => {
  try {
    const result = await User.create(req.body || {});
    if (!result.success) return res.status(400).json(result);
    const fresh = claimStash(result.data.id, req.body?.stash);
    res.status(201).json({
      success: true,
      data: { user: publicUser(fresh), token: signToken(result.data) }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await User.authenticate(req.body || {});
    if (!result.success) return res.status(401).json(result);
    const fresh = claimStash(result.data.id, req.body?.stash);
    res.json({
      success: true,
      data: { user: publicUser(fresh), token: signToken(result.data) }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

export default router;
