import crypto from 'node:crypto';
import { operatorConfig } from '../config/operator.js';

const digest = (value) => crypto.createHash('sha256').update(String(value || '')).digest();

// A separate credential boundary from user JWTs and admin accounts. Hashing both
// inputs to a fixed length lets timingSafeEqual run even for malformed keys.
export const requireOperator = (req, res, next) => {
  const config = operatorConfig();
  if (!config.key || !config.studioUsername) {
    return res.status(503).json({
      success: false,
      error: 'Operator access is not configured on this server'
    });
  }

  const supplied = req.headers['x-r5ops-key'] || '';
  if (!supplied || !crypto.timingSafeEqual(digest(supplied), digest(config.key))) {
    return res.status(401).json({ success: false, error: 'Invalid operator credentials' });
  }

  req.operator = config;
  next();
};
