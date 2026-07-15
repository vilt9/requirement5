import { memoryDb } from '../config/database.js';
import { issue, absorb, InsufficientFundsError, creditDrawYield } from '../services/ledger.js';
import { ECONOMY } from '../services/economy.js';
import User from '../models/User.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const makeUser = async (username = 'tester') => {
  const result = await User.create({ username, email: `${username}@earth.test`, password: 'password123' });
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

  test('rejects duplicate usernames/emails, short passwords, bad usernames, missing/bad email', async () => {
    await makeUser('dupe'); // registers dupe@earth.test
    const ok = (username) => ({ username, email: `${username}@earth.test`, password: 'password123' });
    // Each case fails for exactly one reason; the others are valid.
    expect((await User.create(ok('dupe'))).success).toBe(false);            // username taken
    expect((await User.create({ ...ok('caps'), username: 'DUPE' })).success).toBe(false); // username taken (case)
    expect((await User.create({ ...ok('dupe_mail'), email: 'dupe@earth.test' })).success).toBe(false); // email taken
    expect((await User.create({ ...ok('ok_name'), password: 'short' })).success).toBe(false); // short password
    expect((await User.create(ok('x'))).success).toBe(false);               // username too short
    expect((await User.create({ ...ok('spacey'), username: 'has space' })).success).toBe(false); // bad username
    expect((await User.create({ username: 'no_mail', password: 'password123' })).success).toBe(false); // missing email
    expect((await User.create({ ...ok('bad_mail'), email: 'not-an-email' })).success).toBe(false); // bad email
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

  test('absorb debits, allows overdraft to the floor, and refuses to breach it', async () => {
    const user = await makeUser();
    absorb(user.id, 'save', 20, { card_id: 'card_9' });
    expect(memoryDb.getUserById(user.id).balance).toBe(30);
    expect(memoryDb.getCloud().total_absorbed).toBe(20);

    // Spending may run the balance negative — down to the debt floor (-1000).
    absorb(user.id, 'save', 160);
    expect(memoryDb.getUserById(user.id).balance).toBe(-130);
    expect(memoryDb.getCloud().total_absorbed).toBe(180);

    // A debit that would push past the floor is refused; the absorption counter
    // stays put — proof the debit never applied.
    expect(() => absorb(user.id, 'save', 900)).toThrow(InsufficientFundsError);
    expect(memoryDb.getCloud().total_absorbed).toBe(180);
    expect(memoryDb.getUserById(user.id).balance).toBeCloseTo(-130, 2);
  });

  test('amounts round to one decimal', async () => {
    const user = await makeUser();
    issue(user.id, 'dividend', 0.8);
    issue(user.id, 'dividend', 0.8);
    issue(user.id, 'dividend', 0.8);
    expect(memoryDb.getUserById(user.id).balance).toBe(52.4);
  });
});

describe('draw yield', () => {
  test('credits the full yield every time — generating is uncapped', async () => {
    const user = await makeUser();
    // Big yields that would have blown past the old 100/day cap all credit in full.
    expect(creditDrawYield(user.id, 40)).toBe(40);
    expect(creditDrawYield(user.id, 40)).toBe(40);
    expect(creditDrawYield(user.id, 40)).toBe(40);
    expect(creditDrawYield(user.id, 5)).toBe(5);

    const fresh = memoryDb.getUserById(user.id);
    expect(fresh.balance).toBe(ECONOMY.STARTING_GRANT + 125);
    // no capped / zero-yield records exist any more
    expect(memoryDb.getTransactionsByUser(user.id).some(t => t.capped)).toBe(false);
  });
});
