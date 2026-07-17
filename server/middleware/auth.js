import jwt from 'jsonwebtoken';
import { memoryDb } from '../config/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'r5c-dev-secret-set-JWT_SECRET-in-prod';
const TOKEN_TTL = '30d';

export const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });

const userFromHeader = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    return memoryDb.getUserById(payload.sub) || null;
  } catch {
    return null;
  }
};

export const requireAuth = (req, res, next) => {
  const user = userFromHeader(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  // A ban takes effect immediately, even on a token issued before it: every
  // authenticated action is refused until the ban is lifted.
  if (user.banned) {
    return res.status(403).json({ success: false, error: 'This account has been suspended. Contact hi@requirement5.com.' });
  }
  req.user = user;
  next();
};

// Like requireAuth but does not reject a banned user — used only by the admin
// router, which does its own admin check. A non-admin banned user still can't
// reach anything here because the admin-email check fails first.
export const optionalAuth = (req, res, next) => {
  const user = userFromHeader(req);
  // Out of an abundance of caution, don't attach a banned identity to public
  // read routes either — they behave as logged-out for a banned token.
  req.user = user && !user.banned ? user : null;
  next();
};
