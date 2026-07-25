// The admin surface. Everything here is gated by requireAdmin: a valid session
// whose account email matches ADMIN_EMAIL (server/config/admin.js). One operator
// today (admin@requirement5.com); override with ADMIN_EMAIL in prod.
//
// What it's for: review cards that users have flagged (a flag takes a card out
// of circulation immediately — see cards.js POST /:id/report), then either put
// them back or remove them for good; and suspend (ban) or restore user accounts.
import express from 'express';
import { memoryDb } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdminEmail } from '../config/admin.js';
import { cardStats } from '../services/drawEngine.js';

const router = express.Router();

// requireAuth first (also rejects banned tokens), then the admin-email check.
const requireAdmin = (req, res, next) => {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ success: false, error: 'Admins only' });
  }
  next();
};
router.use(requireAuth, requireAdmin);

// A user row for the admin table. The admin is privileged, so this DOES include
// the email — but never the password hash or the claim-token bearer secret.
const adminUserView = (user) => {
  if (!user) return null;
  const { password_hash, claim_token, ...rest } = user;
  const cards = memoryDb.getAllCards().filter(c => c.creator_id === user.id);
  return {
    ...rest,
    is_admin: isAdminEmail(user.email),
    published_count: cards.filter(c => c.is_public).length,
    saved_count: memoryDb.getSavesByUser(user.id).length
  };
};

// A flagged card plus the open reports against it, ready for the review queue.
const reviewItem = (card) => ({
  card: memoryDb.withCreatorAndSet(card),
  stats: cardStats(card),
  reports: memoryDb.getReportsForCard(card.id)
    .filter(r => r.status === 'open')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
});

// Dashboard counts.
router.get('/overview', (req, res) => {
  const flagged = memoryDb.getFlaggedCards();
  const users = memoryDb.getAllUsers();
  const openReports = memoryDb.getAllReports().filter(r => r.status === 'open');
  res.json({
    success: true,
    data: {
      flaggedCards: flagged.length,
      openReports: openReports.length,
      users: users.length,
      bannedUsers: users.filter(u => u.banned).length
    }
  });
});

// The review queue: every card currently out of circulation via a flag, newest
// flag first, each with the reports that put it there.
router.get('/flagged', (req, res) => {
  const items = memoryDb.getFlaggedCards()
    .map(reviewItem)
    .sort((a, b) => {
      const at = a.reports[0]?.created_at || '';
      const bt = b.reports[0]?.created_at || '';
      return bt.localeCompare(at);
    });
  res.json({ success: true, data: { items } });
});

// Every report, newest first, with the reported card's name + current status —
// a fuller audit view than the flagged queue (includes already-resolved ones).
router.get('/reports', (req, res) => {
  const reports = memoryDb.getAllReports()
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .map(r => {
      const card = memoryDb.getCardById(r.card_id);
      return { ...r, card_name: card?.name || null, card_status: card?.moderation_status || 'active' };
    });
  res.json({ success: true, data: { reports } });
});

// Put a flagged card back in circulation (a false alarm). Its open reports are
// marked dismissed.
router.post('/cards/:id/restore', (req, res) => {
  const card = memoryDb.getCardById(req.params.id);
  if (!card) return res.status(404).json({ success: false, error: 'Card not found' });
  memoryDb.updateCard(card.id, { moderation_status: 'active' });
  memoryDb.resolveReportsForCard(card.id, 'dismissed');
  res.json({ success: true, data: { id: card.id, moderation_status: 'active' } });
});

// Remove a card for good — it stays out of circulation and its open reports are
// marked actioned. (Kept in the DB rather than hard-deleted so the audit trail
// and any collections that already hold it don't break.)
router.post('/cards/:id/remove', (req, res) => {
  const card = memoryDb.getCardById(req.params.id);
  if (!card) return res.status(404).json({ success: false, error: 'Card not found' });
  memoryDb.updateCard(card.id, { moderation_status: 'removed' });
  memoryDb.resolveReportsForCard(card.id, 'actioned');
  res.json({ success: true, data: { id: card.id, moderation_status: 'removed' } });
});

// All users, newest first, for the account-management table.
router.get('/users', (req, res) => {
  const users = memoryDb.getAllUsers()
    .map(adminUserView)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json({ success: true, data: { users } });
});

// Suspend an account. A ban blocks login and every authenticated action at once
// (see middleware/auth.js). The admin account itself can't be banned — that
// would lock the operator out of this very surface.
router.post('/users/:id/ban', (req, res) => {
  const user = memoryDb.getUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (isAdminEmail(user.email)) {
    return res.status(400).json({ success: false, error: "You can't ban the admin account" });
  }
  const updated = memoryDb.updateUser(user.id, { banned: true, banned_at: new Date().toISOString() });
  res.json({ success: true, data: adminUserView(updated) });
});

// Lift a suspension.
router.post('/users/:id/unban', (req, res) => {
  const user = memoryDb.getUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const updated = memoryDb.updateUser(user.id, { banned: false, banned_at: null });
  res.json({ success: true, data: adminUserView(updated) });
});

export default router;
