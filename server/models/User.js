import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { memoryDb } from '../config/database.js';
import { ECONOMY } from '../services/economy.js';
import { issue } from '../services/ledger.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

// A Reddit/X handle → a valid, unclaimed R5c username: `mj_<handle>`, lowercased,
// non-username chars dropped, clamped to the 24-char limit. Empty/garbage handles
// fall back to a random suffix so we never produce an invalid username.
export const usernameForHandle = (handle) => {
  const clean = String(handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const base = clean ? `mj_${clean}` : `mj_${crypto.randomBytes(4).toString('hex')}`;
  return base.slice(0, 24);
};

export const publicUser = (user) => {
  if (!user) return null;
  // claim_token is a bearer secret (the claim link) — never expose it.
  const { password_hash, claim_token, ...rest } = user;
  return rest;
};

export default class User {
  static async create({ username, password }) {
    if (!USERNAME_RE.test(username || '')) {
      return { success: false, error: 'Username must be 3-24 characters: letters, numbers, underscore' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }
    if (memoryDb.getUserByUsername(username)) {
      return { success: false, error: 'Username is taken' };
    }
    const user = memoryDb.createUser({
      username,
      password_hash: bcrypt.hashSync(password, 10)
    });
    issue(user.id, 'grant', ECONOMY.STARTING_GRANT);
    return { success: true, data: publicUser(memoryDb.getUserById(user.id)) };
  }

  // Create an unclaimed "gift" account for an artist we found on Reddit/X. The bot
  // holds the returned JWT to publish cards under it; the artist later takes it over
  // with the claim_token. Idempotent per handle: an existing *unclaimed* gift account
  // is reused (so we can add more cards to it), but a claimed one is never touched.
  static async adopt({ handle, source }) {
    const username = usernameForHandle(handle);
    const existing = memoryDb.getUserByUsername(username);
    if (existing) {
      if (existing.claimed_at || !existing.bot_created) {
        return { success: false, error: 'That account already exists and is claimed', code: 409 };
      }
      // Reuse the unclaimed gift account; rotate its claim token so old links die.
      const claim_token = crypto.randomBytes(24).toString('base64url');
      const updated = memoryDb.updateUser(existing.id, { claim_token });
      return { success: true, data: { user: updated, claim_token, reused: true } };
    }
    const claim_token = crypto.randomBytes(24).toString('base64url');
    const user = memoryDb.createUser({
      username,
      // Random hash: nobody can log in until the artist claims and sets a password.
      password_hash: bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10),
      bot_created: true,
      claimed_at: null,
      claim_token,
      source: source || (handle ? `reddit:${handle}` : 'bot')
    });
    issue(user.id, 'grant', ECONOMY.STARTING_GRANT);
    return { success: true, data: { user: memoryDb.getUserById(user.id), claim_token, reused: false } };
  }

  // An artist redeems a claim link: sets a real password, the token is burned, and
  // the account (with its cards + balance) is theirs. Returns the user so the caller
  // can log them straight in.
  static async claim({ token, password }) {
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters', code: 400 };
    }
    const user = memoryDb.getUserByClaimToken(token);
    if (!user) {
      return { success: false, error: 'This claim link is invalid or has already been used', code: 404 };
    }
    const updated = memoryDb.updateUser(user.id, {
      password_hash: bcrypt.hashSync(password, 10),
      claim_token: null,
      claimed_at: new Date().toISOString()
    });
    return { success: true, data: publicUser(updated) };
  }

  static async authenticate({ username, password }) {
    const user = memoryDb.getUserByUsername(username || '');
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return { success: false, error: 'Invalid username or password' };
    }
    return { success: true, data: publicUser(user) };
  }

  static async findById(id) {
    const user = memoryDb.getUserById(id);
    if (!user) return { success: false, error: 'User not found' };
    return { success: true, data: publicUser(user) };
  }
}
