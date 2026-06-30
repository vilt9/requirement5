// Append-only ledger over the transactions collection. Balances are cached on the
// user row; every transaction records balance_after. The cloud is the system
// treasury: credits from it count as issuance, payments to it as absorption.
import { memoryDb } from '../config/database.js';
import { round1, ECONOMY } from './economy.js';

const todayUTC = () => new Date().toISOString().slice(0, 10);

export class InsufficientFundsError extends Error {
  constructor(balance, amount) {
    super(`Insufficient /t26: balance ${balance}, required ${amount}`);
    this.name = 'InsufficientFundsError';
    this.balance = balance;
    this.required = amount;
  }
}

// Credit a user from the cloud (grant, draw_yield).
export const issue = (userId, type, amount, meta = {}) => {
  const user = memoryDb.getUserById(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const value = round1(amount);
  const balance = round1(user.balance + value);
  memoryDb.updateUser(userId, { balance });
  memoryDb.cloudIssue(value);
  return memoryDb.createTransaction({
    user_id: userId, type, amount: value, balance_after: balance, ...meta
  });
};

// Debit a user; the amount leaves circulation (publish_stake, the cloud's share of a save).
export const absorb = (userId, type, amount, meta = {}) => {
  const user = memoryDb.getUserById(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const value = round1(amount);
  if (user.balance < value) throw new InsufficientFundsError(user.balance, value);
  const balance = round1(user.balance - value);
  memoryDb.updateUser(userId, { balance });
  memoryDb.cloudAbsorb(value);
  return memoryDb.createTransaction({
    user_id: userId, type, amount: -value, balance_after: balance, ...meta
  });
};

// Move /t26 between users (creator dividend). Stays in circulation.
export const transfer = (fromUserId, toUserId, type, amount, meta = {}) => {
  const from = memoryDb.getUserById(fromUserId);
  const to = memoryDb.getUserById(toUserId);
  if (!from) throw new Error(`Unknown user: ${fromUserId}`);
  const value = round1(amount);
  if (from.balance < value) throw new InsufficientFundsError(from.balance, value);

  const fromBalance = round1(from.balance - value);
  memoryDb.updateUser(fromUserId, { balance: fromBalance });
  const debit = memoryDb.createTransaction({
    user_id: fromUserId, type, amount: -value, balance_after: fromBalance,
    counterparty_id: toUserId, ...meta
  });

  // Creator may have deleted their account or be 'anonymous'; the amount is absorbed then.
  if (to) {
    const toBalance = round1(to.balance + value);
    memoryDb.updateUser(toUserId, { balance: toBalance });
    memoryDb.createTransaction({
      user_id: toUserId, type: 'dividend', amount: value, balance_after: toBalance,
      counterparty_id: fromUserId, ...meta
    });
  } else {
    memoryDb.cloudAbsorb(value);
  }
  return debit;
};

// Daily yield accounting. Returns the actually-credited amount (0 past the cap).
export const creditDrawYield = (userId, fullAmount, meta = {}) => {
  const user = memoryDb.getUserById(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const day = todayUTC();
  const usedToday = user.yield_day === day ? user.yield_today : 0;
  const remaining = Math.max(0, round1(ECONOMY.DAILY_YIELD_CAP - usedToday));
  const credited = round1(Math.min(fullAmount, remaining));

  memoryDb.updateUser(userId, {
    yield_day: day,
    yield_today: round1(usedToday + credited)
  });

  if (credited > 0) {
    issue(userId, 'draw_yield', credited, meta);
  } else {
    // Record the capped draw so the ledger tells the whole story.
    const fresh = memoryDb.getUserById(userId);
    memoryDb.createTransaction({
      user_id: userId, type: 'draw_yield', amount: 0,
      balance_after: fresh.balance, capped: true, ...meta
    });
  }
  return credited;
};

export const yieldRemainingToday = (user) => {
  const usedToday = user.yield_day === todayUTC() ? user.yield_today : 0;
  return Math.max(0, round1(ECONOMY.DAILY_YIELD_CAP - usedToday));
};
