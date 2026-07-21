import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { memoryDb } from '../config/database.js';
import { ECONOMY } from '../services/economy.js';
import { issue } from '../services/ledger.js';
import { screen } from '../utils/moderation.js';
import { isAdminEmail } from '../config/admin.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
// Deliberately loose: enough to reject obvious non-addresses, not to police RFC
// edge cases. We don't verify the address (no mail is sent yet), just capture it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Whole years between a birth date and now (UTC). Returns null for anything that
// isn't a real date. Used to enforce the 18+ gate at signup.
const ageFromDob = (dob) => {
  const d = new Date(String(dob || '').trim());
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
};

// A Reddit/X handle → a matching, valid, unclaimed R5c username: lowercased,
// non-username chars dropped, clamped to the 24-char limit. Empty/garbage handles
// fall back to a random generic username so we never produce an invalid one.
export const usernameForHandle = (handle) => {
  const clean = String(handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length >= 3) return clean.slice(0, 24);
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = clean ? `${clean}_${suffix}` : `artist_${suffix}`;
  return base.slice(0, 24);
};

export const publicUser = (user) => {
  if (!user) return null;
  // Strip everything private: password_hash, the claim_token bearer secret,
  // email, and date of birth. These are captured server-side but never sent to
  // the client. `is_admin` is derived from the (stripped) email so the frontend
  // can show the admin surface without ever seeing the address itself.
  const { password_hash, claim_token, email, dob, ...rest } = user;
  return { ...rest, is_admin: isAdminEmail(email) };
};

export default class User {
  static async create({ username, email, password, dob, acceptedTerms }) {
    if (!USERNAME_RE.test(username || '')) {
      return { success: false, error: 'Username must be 3-24 characters: letters, numbers, underscore' };
    }
    if (!screen(username).ok) {
      return { success: false, error: 'Please choose a different username' };
    }
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail)) {
      return { success: false, error: 'A valid email address is required' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }
    // 18+ gate. Requirement5 has real-money top-ups and a paid randomised
    // re-roll, so the account holder must confirm they're an adult with a real
    // date of birth (not a yes/no box) — see the Terms, clause 2.
    const age = ageFromDob(dob);
    if (age == null || age < 0 || age > 120) {
      return { success: false, error: 'A valid date of birth is required' };
    }
    if (age < 18) {
      return { success: false, error: 'You must be 18 or over to use Requirement5' };
    }
    if (acceptedTerms !== true) {
      return { success: false, error: 'You must accept the Terms and Privacy Policy to sign up' };
    }
    if (memoryDb.getUserByUsername(username)) {
      return { success: false, error: 'Username is taken' };
    }
    if (memoryDb.getUserByEmail(cleanEmail)) {
      return { success: false, error: 'That email is already registered' };
    }
    const user = memoryDb.createUser({
      username,
      email: cleanEmail,
      password_hash: bcrypt.hashSync(password, 10),
      dob: String(dob).trim(),
      terms_accepted_at: new Date().toISOString()
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
  static async claim({ token, password, dob, acceptedTerms }) {
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters', code: 400 };
    }
    // Claiming a gifted account is where a real person takes it over, so the
    // same 18+ gate and Terms acceptance as a fresh signup apply here too.
    const age = ageFromDob(dob);
    if (age == null || age < 0 || age > 120) {
      return { success: false, error: 'A valid date of birth is required', code: 400 };
    }
    if (age < 18) {
      return { success: false, error: 'You must be 18 or over to use Requirement5', code: 400 };
    }
    if (acceptedTerms !== true) {
      return { success: false, error: 'You must accept the Terms and Privacy Policy to claim this account', code: 400 };
    }
    const user = memoryDb.getUserByClaimToken(token);
    if (!user) {
      return { success: false, error: 'This claim link is invalid or has already been used', code: 404 };
    }
    const updated = memoryDb.updateUser(user.id, {
      password_hash: bcrypt.hashSync(password, 10),
      dob: String(dob).trim(),
      terms_accepted_at: new Date().toISOString(),
      claim_token: null,
      claimed_at: new Date().toISOString()
    });
    return { success: true, data: publicUser(updated) };
  }

  // Log in with either a username or an email address — whichever the visitor
  // typed into the single identifier field. `username` is still accepted as a
  // fallback so older callers (e.g. the CLI) keep working unchanged.
  static async authenticate({ identifier, username, password }) {
    const id = String(identifier ?? username ?? '').trim();
    const user = memoryDb.getUserByUsername(id) || memoryDb.getUserByEmail(id);
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return { success: false, error: 'Invalid login or password' };
    }
    if (user.banned) {
      return { success: false, error: 'This account has been suspended. Contact hi@requirement5.com.' };
    }
    return { success: true, data: publicUser(user) };
  }

  static async findById(id) {
    const user = memoryDb.getUserById(id);
    if (!user) return { success: false, error: 'User not found' };
    return { success: true, data: publicUser(user) };
  }
}
