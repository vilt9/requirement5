import { memoryDb } from '../config/database.js';
import { issue, absorb, InsufficientFundsError, creditDrawYield, yieldRemainingToday } from '../services/ledger.js';
import { ECONOMY } from '../services/economy.js';
import User from '../models/User.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const makeUser = async (username = 'tester') => {
  const result = await User.create({ username, password: 'password123' });
  expect(result.success).toBe(true);
  return result.data;
};

describe('signup grant', () => {
  test('new users receive the starting grant from the cloud', async () => {
    const user = await makeUser();
    expect(user.balance).toBe(ECONOMY.STARTING_GRANT);
    const txns = memoryDb.getTransactionsByUser(user.id);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('grant');
    expect(txns[0].amount).toBe(ECONOMY.STARTING_GRANT);
    expect(txns[0].balance_after).toBe(ECONOMY.STARTING_GRANT);
    expect(memoryDb.getCloud().total_issued).toBe(ECONOMY.STARTING_GRANT);
  });

  test('rejects duplicate usernames, short passwords, bad usernames', async () => {
    await makeUser('dupe');
    expect((await User.create({ username: 'dupe', password: 'password123' })).success).toBe(false);
    expect((await User.create({ username: 'DUPE', password: 'password123' })).success).toBe(false);
    expect((await User.create({ username: 'ok_name', password: 'short' })).success).toBe(false);
    expect((await User.create({ username: 'x', password: 'password123' })).success).toBe(false);
    expect((await User.create({ username: 'has space', password: 'password123' })).success).toBe(false);
  });
});

describe('issue and absorb', () => {
  test('issue credits and records issuance', async () => {
    const user = await makeUser();
    issue(user.id, 'dividend', 4, { card_id: 'card_9' });
    const fresh = memoryDb.getUserById(user.id);
    expect(fresh.balance).toBe(54);
    expect(memoryDb.getCloud().total_issued).toBe(54);
  });

  test('absorb debits and records absorption; rejects overdraft', async () => {
    const user = await makeUser();
    absorb(user.id, 'save', 20, { card_id: 'card_9' });
    expect(memoryDb.getUserById(user.id).balance).toBe(30);
    expect(memoryDb.getCloud().total_absorbed).toBe(20);
    expect(() => absorb(user.id, 'save', 160)).toThrow(InsufficientFundsError);
    // balance untouched by the failed debit
    expect(memoryDb.getUserById(user.id).balance).toBe(30);
  });

  test('amounts round to one decimal', async () => {
    const user = await makeUser();
    issue(user.id, 'dividend', 0.8);
    issue(user.id, 'dividend', 0.8);
    issue(user.id, 'dividend', 0.8);
    expect(memoryDb.getUserById(user.id).balance).toBe(52.4);
  });
});

describe('daily yield cap', () => {
  test('credits until the cap, then records zero-yield draws', async () => {
    const user = await makeUser();
    // burn through the cap with big yields
    expect(creditDrawYield(user.id, 40)).toBe(40);
    expect(creditDrawYield(user.id, 40)).toBe(40);
    expect(creditDrawYield(user.id, 40)).toBe(20); // capped at 100 total
    expect(creditDrawYield(user.id, 5)).toBe(0);

    const fresh = memoryDb.getUserById(user.id);
    expect(fresh.balance).toBe(ECONOMY.STARTING_GRANT + ECONOMY.DAILY_YIELD_CAP);
    expect(yieldRemainingToday(fresh)).toBe(0);

    const capped = memoryDb.getTransactionsByUser(user.id).find(t => t.capped);
    expect(capped).toBeDefined();
    expect(capped.amount).toBe(0);
  });

  test('cap resets on a new day', async () => {
    const user = await makeUser();
    creditDrawYield(user.id, 100);
    expect(yieldRemainingToday(memoryDb.getUserById(user.id))).toBe(0);
    // simulate yesterday
    memoryDb.updateUser(user.id, { yield_day: '2000-01-01' });
    expect(yieldRemainingToday(memoryDb.getUserById(user.id))).toBe(ECONOMY.DAILY_YIELD_CAP);
    expect(creditDrawYield(user.id, 5)).toBe(5);
  });
});
