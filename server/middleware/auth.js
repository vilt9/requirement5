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
  req.user = user;
  next();
};

export const optionalAuth = (req, res, next) => {
  req.user = userFromHeader(req);
  next();
};
