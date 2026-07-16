import { memoryDb } from '../config/database.js';
import { ECONOMY } from '../services/economy.js';
import { BUNDLES, getBundle, fulfillCheckout, paymentsEnabled } from '../services/payments.js';
import User from '../models/User.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const makeUser = async (username = 'buyer') => {
  const result = await User.create({ username, email: `${username}@earth.test`, password: 'password123' });
  expect(result.success).toBe(true);
  return result.data;
};

// A minimal stand-in for a Stripe checkout.session.completed object.
const sessionFor = (userId, bundleId, id = 'cs_test_1') => ({
  id,
  client_reference_id: userId,
  metadata: { userId, bundleId, t26: String(getBundle(bundleId)?.t26) }
});

describe('bundle catalogue', () => {
  test('bundles have stable ids and matching dollar/t26 amounts', () => {
    expect(BUNDLES.map(b => b.id)).toEqual(['t26_300', 't26_1200', 't26_7000']);
    for (const b of BUNDLES) {
      expect(getBundle(b.id)).toBe(b);
      expect(b.usd).toBeGreaterThan(0);
      expect(b.t26).toBeGreaterThan(0);
    }
    expect(getBundle('nope')).toBeNull();
  });

  test('payments are disabled without a Stripe secret key', () => {
    // No STRIPE_SECRET_KEY in the test env.
    expect(paymentsEnabled()).toBe(false);
  });
});

describe('fulfillCheckout', () => {
  test('credits the bundle amount to the buyer and records a topup transaction', async () => {
    const user = await makeUser();
    const result = fulfillCheckout(sessionFor(user.id, 't26_1200'));

    expect(result).toEqual({ credited: 1200, alreadyProcessed: false });
    const fresh = memoryDb.getUserById(user.id);
    expect(fresh.balance).toBe(ECONOMY.STARTING_GRANT + 1200);

    const txns = memoryDb.getTransactionsByUser(user.id);
    const topup = txns.find(t => t.type === 'topup');
    expect(topup.amount).toBe(1200);
    expect(topup.stripe_session).toBe('cs_test_1');
    expect(memoryDb.getCloud().total_issued).toBe(ECONOMY.STARTING_GRANT + 1200);
  });

  test('is idempotent — a replayed session credits only once', async () => {
    const user = await makeUser();
    const session = sessionFor(user.id, 't26_300');

    const first = fulfillCheckout(session);
    const second = fulfillCheckout(session);

    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);
    expect(memoryDb.getUserById(user.id).balance).toBe(ECONOMY.STARTING_GRANT + 300);
    expect(memoryDb.getTransactionsByUser(user.id).filter(t => t.type === 'topup')).toHaveLength(1);
  });

  test('falls back to client_reference_id when metadata is absent', async () => {
    const user = await makeUser();
    const session = { id: 'cs_test_2', client_reference_id: user.id, metadata: { bundleId: 't26_300' } };
    const result = fulfillCheckout(session);
    expect(result.credited).toBe(300);
    expect(memoryDb.getUserById(user.id).balance).toBe(ECONOMY.STARTING_GRANT + 300);
  });

  test('ignores sessions with an unknown user or bundle without crediting', async () => {
    const user = await makeUser();
    expect(fulfillCheckout(sessionFor(user.id, 'bogus_bundle'))).toEqual({ credited: 0, alreadyProcessed: false });
    expect(fulfillCheckout(sessionFor('ghost-user', 't26_300'))).toEqual({ credited: 0, alreadyProcessed: false });
    expect(memoryDb.getUserById(user.id).balance).toBe(ECONOMY.STARTING_GRANT);
  });
});
