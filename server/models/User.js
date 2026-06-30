import bcrypt from 'bcryptjs';
import { memoryDb } from '../config/database.js';
import { ECONOMY } from '../services/economy.js';
import { issue } from '../services/ledger.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export const publicUser = (user) => {
  if (!user) return null;
  const { password_hash, ...rest } = user;
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
