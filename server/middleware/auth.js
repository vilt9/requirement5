import jwt from 'jsonwebtoken';
import process from 'node:process';
import { memoryDb } from '../config/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'r5c-dev-secret-set-JWT_SECRET-in-prod';
const TOKEN_TTL = '30d';

export const signToken = (user) => {
  // Auth routes return a sanitized public user, so read the version from the
  // canonical record. This matters immediately after claim, when the version
  // has just been incremented to invalidate every pre-claim session.
  const stored = memoryDb.getUserById(user.id);
  const version = stored?.auth_version ?? user.auth_version ?? 0;
  return jwt.sign(
    { sub: user.id, ver: version },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
};

const userFromHeader = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = memoryDb.getUserById(payload.sub) || null;
    if (!user || (payload.ver ?? 0) !== (user.auth_version || 0)) return null;
    return user;
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
