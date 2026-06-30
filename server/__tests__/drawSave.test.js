import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import { ECONOMY, getTier } from '../services/economy.js';
import { draw } from '../services/drawEngine.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const signup = async (username) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data; // { user, token }
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth flow', () => {
  test('signup, login, me', async () => {
    const { token, user } = await signup('vex_haldane');
    expect(user.username).toBe('vex_haldane');
    expect(user.balance).toBe(ECONOMY.STARTING_GRANT);
    expect(user.password_hash).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vex_haldane', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.data.username).toBe('vex_haldane');

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vex_haldane', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);
  });
});

describe('publish', () => {
  test('publishing stakes /t26 and assigns the tier', async () => {
    const { token } = await signup('creator');
    const res = await request(app)
      .post('/api/cards/publish')
      .set(auth(token))
      .send({ name: 'Test card', tier: 'galaxy', stateData: { customCard: { a: 1 } } });

    expect(res.status).toBe(201);
    expect(res.body.data.card.tier).toBe('galaxy');
    expect(res.body.data.card.rarity_score).toBeGreaterThanOrEqual(0.8);
    expect(res.body.data.card.rarity_score).toBeLessThanOrEqual(0.85);
    expect(res.body.data.balance).toBe(ECONOMY.STARTING_GRANT - ECONOMY.PUBLISH_STAKE);
  });

  test('rejects bad tiers and missing state', async () => {
    const { token } = await signup('creator');
    const badTier = await request(app)
      .post('/api/cards/publish')
      .set(auth(token))
      .send({ tier: 'mythic', stateData: {} });
    expect(badTier.status).toBe(400);

    const noState = await request(app)
      .post('/api/cards/publish')
      .set(auth(token))
      .send({ tier: 'common' });
    expect(noState.status).toBe(400);
  });

  test('rejects publish when balance cannot cover the stake', async () => {
    const { token, user } = await signup('broke');
    memoryDb.updateUser(user.id, { balance: 5 });
    const res = await request(app)
      .post('/api/cards/publish')
      .set(auth(token))
      .send({ tier: 'common', stateData: { x: 1 } });
    expect(res.status).toBe(402);
  });

  test('tags round-trip through publish, the pool, and a saver\'s collection', async () => {
    const { token: creatorToken } = await signup('tagger');
    const pub = await request(app)
      .post('/api/cards/publish')
      .set(auth(creatorToken))
      .send({
        name: 'Tagged card',
        tier: 'common',
        tags: ['neon', 'galaxy'],
        stateData: { customCard: { rarity: 0.3 } }
      });
    expect(pub.status).toBe(201);
    expect(pub.body.data.card.tags).toEqual(['neon', 'galaxy']);
    const cardId = pub.body.data.card.id;

    // Visible in the public pool with its tags
    const pool = await request(app).get('/api/cards/community/all');
    const inPool = pool.body.data.find(c => c.id === cardId);
    expect(inPool.tags).toEqual(['neon', 'galaxy']);

    // And carried through to a saver's collection
    const { token: saverToken } = await signup('saver');
    const save = await request(app).post(`/api/cards/${cardId}/save`).set(auth(saverToken));
    expect(save.status).toBe(201);
    const mine = await request(app).get('/api/cards/collection/mine').set(auth(saverToken));
    expect(mine.body.data[0].card.tags).toEqual(['neon', 'galaxy']);
  });
});

describe('draw engine', () => {
  test('synthetic draw when the pool is empty in the rolled tier', async () => {
    const { user } = await signup('drawer');
    const result = draw(user.id, () => 0.5); // rolls common; pool empty
    expect(result.source).toBe('synthetic');
    expect(result.tier.key).toBe('common');
    expect(result.card).toBeNull();
    expect(result.yield.credited).toBe(1);
    expect(result.balance).toBe(ECONOMY.STARTING_GRANT + 1);
  });

  test('pool draw serves a published card of the rolled tier and counts it', async () => {
    const { token: creatorToken } = await signup('creator');
    await request(app)
      .post('/api/cards/publish')
      .set(auth(creatorToken))
      .send({ name: 'Pool card', tier: 'common', stateData: { x: 1 } });

    const { user } = await signup('drawer');
    const result = draw(user.id, () => 0.5);
    expect(result.source).toBe('pool');
    expect(result.card.name).toBe('Pool card');
    expect(result.card.times_drawn).toBe(1);
    expect(result.stats.drawWeight).toBeCloseTo(getTier('common').probability, 10);
    expect(result.stats.saveCost).toBe(4);
  });

  test('draw endpoint requires auth', async () => {
    const res = await request(app).post('/api/draw');
    expect(res.status).toBe(401);
  });
});

describe('save economics', () => {
  const publishAndDraw = async () => {
    const creator = await signup('creator');
    const publish = await request(app)
      .post('/api/cards/publish')
      .set(auth(creator.token))
      .send({ name: 'Galaxy card', tier: 'galaxy', stateData: { x: 1 } });
    const saver = await signup('saver');
    return { creator, saver, card: publish.body.data.card };
  };

  test('save debits cost, pays the creator dividend, cloud absorbs the rest', async () => {
    const { creator, saver, card } = await publishAndDraw();
    const cloudBefore = memoryDb.getCloud();

    const res = await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set(auth(saver.token));

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(20);       // galaxy: 4 × 5
    expect(res.body.data.dividend).toBe(4);    // 20%
    expect(res.body.data.balance).toBe(ECONOMY.STARTING_GRANT - 20);

    const creatorUser = memoryDb.getUserById(creator.user.id);
    // 50 − 10 stake + 4 dividend
    expect(creatorUser.balance).toBe(44);

    const cloud = memoryDb.getCloud();
    expect(cloud.total_absorbed - cloudBefore.total_absorbed).toBe(20);
    expect(cloud.total_issued - cloudBefore.total_issued).toBe(4);

    const fresh = memoryDb.getCardById(card.id);
    expect(fresh.times_saved).toBe(1);
  });

  test('cannot save the same card twice', async () => {
    const { saver, card } = await publishAndDraw();
    await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    const again = await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    expect(again.status).toBe(409);
  });

  test('save fails politely with insufficient funds', async () => {
    const { saver, card } = await publishAndDraw();
    memoryDb.updateUser(saver.user.id, { balance: 3 });
    const res = await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    expect(res.status).toBe(402);
  });

  test('collection lists saved cards; removal gives no refund', async () => {
    const { saver, card } = await publishAndDraw();
    await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));

    const collection = await request(app)
      .get('/api/cards/collection/mine')
      .set(auth(saver.token));
    expect(collection.body.data).toHaveLength(1);
    expect(collection.body.data[0].card.id).toBe(card.id);

    const balanceBefore = memoryDb.getUserById(saver.user.id).balance;
    const remove = await request(app)
      .delete(`/api/cards/collection/${card.id}`)
      .set(auth(saver.token));
    expect(remove.status).toBe(200);
    expect(memoryDb.getUserById(saver.user.id).balance).toBe(balanceBefore);

    const after = await request(app)
      .get('/api/cards/collection/mine')
      .set(auth(saver.token));
    expect(after.body.data).toHaveLength(0);
  });
});

describe('save-synthetic', () => {
  test('costs the tier save price, stores privately, fully absorbed', async () => {
    const { token, user } = await signup('drawer');
    const res = await request(app)
      .post('/api/cards/save-synthetic')
      .set(auth(token))
      .send({ tier: 'holo', stateData: { customCard: { rarity: 0.75 } } });

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(8); // holo: 4 × 2
    expect(res.body.data.card.is_public).toBe(false);
    expect(res.body.data.card.creator_id).toBe('cloud');
    expect(res.body.data.card.rarity_score).toBe(0.75);
    expect(res.body.data.balance).toBe(ECONOMY.STARTING_GRANT - 8);

    // it lands in the collection but not the public pool
    const collection = await request(app).get('/api/cards/collection/mine').set(auth(token));
    expect(collection.body.data).toHaveLength(1);
    const pool = await request(app).get('/api/cards/community/all');
    expect(pool.body.data).toHaveLength(0);
  });
});

describe('economy endpoints', () => {
  test('config is public and complete', async () => {
    const res = await request(app).get('/api/economy/config');
    expect(res.status).toBe(200);
    expect(res.body.data.tiers).toHaveLength(6);
  });

  test('cloud books balance issuance against absorption', async () => {
    const { token, user } = await signup('solo');
    await request(app)
      .post('/api/cards/publish')
      .set(auth(token))
      .send({ tier: 'common', stateData: { x: 1 } });

    const res = await request(app).get('/api/economy/cloud');
    expect(res.body.data.totalIssued).toBe(ECONOMY.STARTING_GRANT);
    expect(res.body.data.totalAbsorbed).toBe(ECONOMY.PUBLISH_STAKE);
    expect(res.body.data.inCirculation).toBe(memoryDb.getUserById(user.id).balance);
    expect(res.body.data.tierCounts.common).toBe(1);
  });

  test('balance endpoint reports balance and the daily yield headroom', async () => {
    const { token } = await signup('walleter');
    const res = await request(app).get('/api/economy/balance').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(ECONOMY.STARTING_GRANT);
    expect(res.body.data.yieldRemainingToday).toBe(ECONOMY.DAILY_YIELD_CAP);
  });

  test('balance endpoint requires auth', async () => {
    const res = await request(app).get('/api/economy/balance');
    expect(res.status).toBe(401);
  });

  test('transactions endpoint returns the ledger newest-first', async () => {
    const { token } = await signup('historian');
    // signup grant + one draw_yield => at least two ledger lines
    await request(app).post('/api/draw').set(auth(token));

    const res = await request(app).get('/api/economy/transactions').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].type).toBe('draw_yield');   // most recent first
    expect(res.body.data.every(t => 'balance_after' in t)).toBe(true);
  });
});
