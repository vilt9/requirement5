import express from 'express';
import User, { publicUser } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { issue } from '../services/ledger.js';
import { memoryDb } from '../config/database.js';

const router = express.Router();

// Anti-abuse ceiling on the client-claimed logged-out stash. Generating itself
// is uncapped, but this value is reported by an untrusted client, so we clamp
// the one-time claim to keep a forged stash from minting silly amounts.
const STASH_CLAIM_CAP = 100;

// Logged-out visitors earn a local "stash" per generate; it rides along on
// signup/login and is credited here.
const claimStash = (userId, stash) => {
  // Stashes are fractional (each generate earns a small random amount).
  const amount = Math.min(STASH_CLAIM_CAP,
    Math.max(0, Math.round((Number(stash) || 0) * 1e6) / 1e6));
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

// Public: preview an unclaimed account behind a claim link — its handle and the
// cards waiting on it — so the claim page can show them before a password
// is set. Deliberately reveals nothing sensitive (no token echo, no email).
router.get('/claim/:token', (req, res) => {
  const user = memoryDb.getUserByClaimToken(req.params.token);
  if (!user || user.claimed_at) {
    return res.status(404).json({ success: false, error: 'This claim link is invalid or has already been used' });
  }
  const cards = memoryDb.searchCards('creator_id', user.id)
    .map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      rarity_score: c.rarity_score,
      is_public: !!c.is_public
    }));
  res.json({ success: true, data: { username: user.username, balance: user.balance, cards } });
});

// Public: the account owner redeems a claim link, sets a password, and is logged in.
router.post('/claim', async (req, res) => {
  try {
    const { token, password, dob, acceptedTerms } = req.body || {};
    const result = await User.claim({ token, password, dob, acceptedTerms });
    if (!result.success) return res.status(result.code || 400).json(result);
    res.json({
      success: true,
      data: { user: result.data, token: signToken(result.data) }
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
