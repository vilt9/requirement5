import express from 'express';
import User, { publicUser } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const result = await User.create(req.body || {});
    if (!result.success) return res.status(400).json(result);
    res.status(201).json({
      success: true,
      data: { user: result.data, token: signToken(result.data) }
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
    res.json({
      success: true,
      data: { user: result.data, token: signToken(result.data) }
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
