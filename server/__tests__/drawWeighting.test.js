import request from 'supertest';
import crypto from 'node:crypto';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import {
  drawWeightFor, pickWeightedIndex, tierForScore,
  DRAW_RARITY_FALLOFF, SYNTHETIC_DRAW_SHARE
} from '../services/economy.js';
import { drawMany } from '../services/drawEngine.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const signup = async (username) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ username, email: `${username}@earth.test`, password: 'password123', dob: '1990-01-01', acceptedTerms: true });
  expect(res.status).toBe(201);
  return res.body.data; // { user, token }
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Seed a published pool card of a given rarity, straight into the store.
const poolCard = (rarity, id) => memoryDb.createCard({
  id: id || crypto.randomUUID(),
  is_public: true,
  creator_id: 'cloud',
  tier: tierForScore(rarity).key,
  rarity_score: rarity,
  state_data: { customCard: { rarity } }
});

// ---- The weighting maths (pure, deterministic) ------------------------------

describe('draw weighting maths', () => {
  test('weight falls off with rarity value', () => {
    // Strictly decreasing: a rarer card always weighs less.
    const rs = [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1];
    const ws = rs.map(drawWeightFor);
    for (let i = 1; i < ws.length; i++) expect(ws[i]).toBeLessThan(ws[i - 1]);
    // The ratio matches e^(k·Δ): a 0.3 card vs a 0.9 card.
    const ratio = drawWeightFor(0.3) / drawWeightFor(0.9);
    expect(ratio).toBeCloseTo(Math.exp(DRAW_RARITY_FALLOFF * 0.6), 5);
  });

  test('rarity is clamped, so out-of-range scores never explode the weight', () => {
    expect(drawWeightFor(-1)).toBe(drawWeightFor(0));
    expect(drawWeightFor(2)).toBe(drawWeightFor(1));
    expect(drawWeightFor(undefined)).toBe(drawWeightFor(0));
  });

  test('pickWeightedIndex is proportional and handles the edges', () => {
    expect(pickWeightedIndex([], 0.5)).toBe(-1);
    expect(pickWeightedIndex([0, 0], 0.5)).toBe(-1);
    // weights [10, 1, 1]: u just above 0 lands in bucket 0; near 1 lands last.
    expect(pickWeightedIndex([10, 1, 1], 0)).toBe(0);
    expect(pickWeightedIndex([10, 1, 1], 0.99)).toBe(2);
    // Over many uniforms the shares track the weights (~10 : 1 : 1).
    const counts = [0, 0, 0];
    const N = 60000;
    for (let i = 0; i < N; i++) counts[pickWeightedIndex([10, 1, 1], (i + 0.5) / N)]++;
    expect(counts[0] / N).toBeGreaterThan(0.78); // ~0.833
    expect(counts[0] / N).toBeLessThan(0.88);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(0);
  });

  test('a low-rarity card wins the lottery far more than a high-rarity one', () => {
    const weights = [drawWeightFor(0.1), drawWeightFor(0.95)];
    let low = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (pickWeightedIndex(weights, (i + 0.5) / N) === 0) low++;
    // 0.1 should dominate the pool picks overwhelmingly.
    expect(low / N).toBeGreaterThan(0.98);
  });
});

// ---- The batch draw (integration) -------------------------------------------

describe('batch draw', () => {
  test('POST /api/draw with seeds returns one result per seed + a balance', async () => {
    const { token } = await signup('drawer_batch');
    const seeds = Array.from({ length: 5 }, () => crypto.randomUUID());
    const res = await request(app).post('/api/draw').set(auth(token)).send({ seeds });
    expect(res.status).toBe(200);
    expect(res.body.data.draws).toHaveLength(5);
    expect(typeof res.body.data.balance).toBe('number');
    res.body.data.draws.forEach(d => {
      expect(['pool', 'synthetic']).toContain(d.source);
      expect(typeof d.yield.credited).toBe('number');
    });
  });

  test('single seed still returns a single draw (back-compat)', async () => {
    const { token } = await signup('drawer_single');
    const res = await request(app).post('/api/draw').set(auth(token)).send({ seed: crypto.randomUUID() });
    expect(res.status).toBe(200);
    expect(res.body.data.draws).toBeUndefined();
    expect(['pool', 'synthetic']).toContain(res.body.data.source);
  });

  test('an empty pool means every draw is synthetic', async () => {
    const { token, user } = await signup('drawer_empty');
    const results = drawMany(user.id, 6, Math.random, []);
    expect(results).toHaveLength(6);
    results.forEach(r => expect(r.source).toBe('synthetic'));
  });

  test('pool cards are drawn without replacement within a batch, then it falls back to synthetic', async () => {
    const { user } = await signup('drawer_norepeat');
    poolCard(0.2, 'aaaaaaaa-0001');
    poolCard(0.4, 'aaaaaaaa-0002');
    poolCard(0.6, 'aaaaaaaa-0003');
    // rand() = 0.9 ≥ SYNTHETIC_DRAW_SHARE, so every draw prefers the pool.
    const results = drawMany(user.id, 4, () => 0.9, []);
    const poolIds = results.filter(r => r.source === 'pool').map(r => r.card.id);
    expect(new Set(poolIds).size).toBe(poolIds.length); // no repeats
    expect(poolIds.length).toBe(3);                     // the whole pool, once each
    expect(results[3].source).toBe('synthetic');        // pool exhausted → synthetic
  });

  test('drawing marks pool cards as drawn and credits a yield each time', async () => {
    const { user } = await signup('drawer_counts');
    poolCard(0.15, 'bbbbbbbb-0001');
    const before = memoryDb.getUserById(user.id).balance;
    // Two SEPARATE draws (two Generate taps). Without-replacement is per batch,
    // so the same card can surface again on a later draw — as here.
    const r1 = drawMany(user.id, 1, () => 0.9, [])[0];
    const r2 = drawMany(user.id, 1, () => 0.9, [])[0];
    expect(r1.source).toBe('pool');
    expect(r2.source).toBe('pool');
    expect(memoryDb.getCardById('bbbbbbbb-0001').times_drawn).toBe(2);
    const after = memoryDb.getUserById(user.id).balance;
    expect(after).toBeGreaterThan(before); // yield credited
  });

  test('SYNTHETIC_DRAW_SHARE keeps a real slice of draws synthetic even with a pool', async () => {
    const { user } = await signup('drawer_slice');
    for (let i = 0; i < 8; i++) poolCard(0.3, `cccccccc-000${i}`);
    // Over many single draws with real randomness, a meaningful share are synthetic.
    let synth = 0;
    const N = 400;
    for (let i = 0; i < N; i++) if (drawMany(user.id, 1, Math.random, [])[0].source === 'synthetic') synth++;
    // Expected ≈ SYNTHETIC_DRAW_SHARE; assert it's clearly non-trivial.
    expect(synth / N).toBeGreaterThan(SYNTHETIC_DRAW_SHARE - 0.15);
    expect(synth / N).toBeLessThan(SYNTHETIC_DRAW_SHARE + 0.15);
  });
});
