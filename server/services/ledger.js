// Append-only ledger over the transactions collection. Balances are cached on the
// user row; every transaction records balance_after. The cloud is the system
// treasury: credits from it count as issuance, payments to it as absorption.
import { memoryDb } from '../config/database.js';
import { round6, ECONOMY } from './economy.js';

const todayUTC = () => new Date().toISOString().slice(0, 10);
const DAY_MS = 86400000;

export class InsufficientFundsError extends Error {
  constructor(balance, amount) {
    super(`Debt limit reached (floor ${ECONOMY.DEBT_FLOOR} /t26): balance ${balance}, required ${amount}`);
    this.name = 'InsufficientFundsError';
    this.balance = balance;
    this.required = amount;
  }
}

// Settle interest on a debtor's balance up to now, compounding daily at the
// configured rate. No-op unless the balance is negative. Lazy: driven by the
// real time elapsed since the last settle (interest_at), so no scheduler is
// needed — the debt is brought current whenever the account is touched. Slivers
// under a cent aren't written (the clock keeps ticking until they add up).
export const accrueInterest = (userId) => {
  const user = memoryDb.getUserById(userId);
  if (!user) return user;

  if (user.balance >= 0) {
    if (user.interest_at) memoryDb.updateUser(userId, { interest_at: null });
    return memoryDb.getUserById(userId);
  }
  const now = Date.now();
  if (!user.interest_at) {
    return memoryDb.updateUser(userId, { interest_at: new Date(now).toISOString() });
  }
  const elapsedDays = (now - Date.parse(user.interest_at)) / DAY_MS;
  if (!(elapsedDays > 0)) return user;

  const factor = Math.pow(1 + ECONOMY.DEBT_INTEREST_DAILY, elapsedDays);
  const balance = round6(user.balance * factor);   // deeper into the red
  const interest = round6(balance - user.balance);  // the (negative) charge
  if (interest > -0.01) return user;                // let sub-cent slivers accrue

  memoryDb.updateUser(userId, { balance, interest_at: new Date(now).toISOString() });
  memoryDb.cloudAbsorb(-interest);                  // interest owed → treasury revenue
  memoryDb.createTransaction({
    user_id: userId, type: 'interest', amount: interest, balance_after: balance
  });
  return memoryDb.getUserById(userId);
};

// Credit a user from the cloud (grant, draw_yield). Settles any debt interest
// first so the credit pays down a current balance.
export const issue = (userId, type, amount, meta = {}) => {
  accrueInterest(userId);
  const user = memoryDb.getUserById(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const value = round6(amount);
  const balance = round6(user.balance + value);
  memoryDb.updateUser(userId, { balance });
  memoryDb.cloudIssue(value);
  // Climbed back to solvent → stop the debt clock.
  if (balance >= 0 && user.interest_at) memoryDb.updateUser(userId, { interest_at: null });
  return memoryDb.createTransaction({
    user_id: userId, type, amount: value, balance_after: balance, ...meta
  });
};

// Debit a user; the amount leaves circulation (publish_stake, the cloud's share
// of a save). Spending may run the balance negative, down to the debt floor —
// past it, the spend is refused.
export const absorb = (userId, type, amount, meta = {}) => {
  accrueInterest(userId);
  const user = memoryDb.getUserById(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const value = round6(amount);
  const balance = round6(user.balance - value);
  if (balance < ECONOMY.DEBT_FLOOR) throw new InsufficientFundsError(user.balance, value);
  memoryDb.updateUser(userId, { balance });
  memoryDb.cloudAbsorb(value);
  // Just crossed into the red → start the debt clock.
  if (balance < 0 && !user.interest_at) memoryDb.updateUser(userId, { interest_at: new Date().toISOString() });
  return memoryDb.createTransaction({
    user_id: userId, type, amount: -value, balance_after: balance, ...meta
  });
};

// Move /t26 between users (creator dividend). Stays in circulation.
export const transfer = (fromUserId, toUserId, type, amount, meta = {}) => {
  const from = memoryDb.getUserById(fromUserId);
  const to = memoryDb.getUserById(toUserId);
  if (!from) throw new Error(`Unknown user: ${fromUserId}`);
  const value = round6(amount);
  if (from.balance < value) throw new InsufficientFundsError(from.balance, value);

  const fromBalance = round6(from.balance - value);
  memoryDb.updateUser(fromUserId, { balance: fromBalance });
  const debit = memoryDb.createTransaction({
    user_id: fromUserId, type, amount: -value, balance_after: fromBalance,
    counterparty_id: toUserId, ...meta
  });

  // Creator may have deleted their account or be 'anonymous'; the amount is absorbed then.
  if (to) {
    const toBalance = round6(to.balance + value);
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
  const remaining = Math.max(0, round6(ECONOMY.DAILY_YIELD_CAP - usedToday));
  const credited = round6(Math.min(fullAmount, remaining));

  memoryDb.updateUser(userId, {
    yield_day: day,
    yield_today: round6(usedToday + credited)
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
  return Math.max(0, round6(ECONOMY.DAILY_YIELD_CAP - usedToday));
};
