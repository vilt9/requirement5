import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import { ECONOMY, getTier, PRICE_BANDS, saveCostFor, drawYieldFor, creatorDividendFor, drawWeightFor, SYNTHETIC_DRAW_SHARE, round6 } from '../services/economy.js';
import { draw } from '../services/drawEngine.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const signup = async (username) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ username, email: `${username}@earth.test`, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data; // { user, token }
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// The guided creation flow (mirrors the web + CLI): begin → confirm-start →
// publish. `rarity` (with the user's id) forces a deterministic Rarity Value so
// tier/price assertions are stable; otherwise the server gamble is random.
const beginCreation = (token) => request(app).post('/api/cards/create/begin').set(auth(token));
const confirmStart = (token, body = {}) => request(app).post('/api/cards/create/confirm-start').set(auth(token)).send(body);
const releaseDraft = (token, body = {}) => request(app).post('/api/cards/create/publish').set(auth(token)).send(body);

const publishCard = async (token, { userId, rarity, name = 'Test card', tags = [], stateData = { customCard: { a: 1 } } } = {}) => {
  await beginCreation(token);
  if (rarity != null && userId) {
    const roll = memoryDb.getActiveRollByUser(userId);
    memoryDb.updateRoll(roll.id, { rarity_score: rarity });
  }
  const started = await confirmStart(token, { name, tags, stateData });
  const released = await releaseDraft(token);
  return { started, released, card: released.body.data?.card, createFee: started.body.data?.createFee };
};

describe('auth flow', () => {
  test('signup, login, me', async () => {
    const { token, user } = await signup('vex_haldane');
    expect(user.username).toBe('vex_haldane');
    expect(user.balance).toBe(ECONOMY.STARTING_GRANT);
    expect(user.password_hash).toBeUndefined();
    // Email is captured but private: it must never come back to the client.
    expect(user.email).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'vex_haldane', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.data.username).toBe('vex_haldane');
    expect(me.body.data.email).toBeUndefined();

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'vex_haldane', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);
  });

  // The whole point of capturing email: you can sign in with it OR the username.
  test('logs in with either username or email; email never leaks', async () => {
    // signup() sends email `${username}@earth.test`.
    await signup('mira_okonkwo');

    const byUsername = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'mira_okonkwo', password: 'password123' });
    expect(byUsername.status).toBe(200);
    expect(byUsername.body.data.user.username).toBe('mira_okonkwo');
    expect(byUsername.body.data.user.email).toBeUndefined();

    const byEmail = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'mira_okonkwo@earth.test', password: 'password123' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.user.username).toBe('mira_okonkwo');
    expect(byEmail.body.data.user.email).toBeUndefined();

    // Email match is case-insensitive (stored lowercased).
    const byEmailCaps = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'Mira_Okonkwo@Earth.Test', password: 'password123' });
    expect(byEmailCaps.status).toBe(200);

    // A wrong/unknown identifier is rejected.
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@earth.test', password: 'password123' });
    expect(unknown.status).toBe(401);
  });

  test('signup requires a valid email', async () => {
    const noEmail = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'no_mail_user', password: 'password123' });
    expect(noEmail.status).toBe(400);

    const badEmail = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'bad_mail_user', email: 'not-an-email', password: 'password123' });
    expect(badEmail.status).toBe(400);
  });
});

describe('create flow', () => {
  test('confirm-start charges the create fee; publish assigns the rolled tier and is free', async () => {
    const { token, user } = await signup('creator');
    await beginCreation(token);
    const roll = memoryDb.getActiveRollByUser(user.id);
    memoryDb.updateRoll(roll.id, { rarity_score: 0.82 }); // force a galaxy roll

    const started = await confirmStart(token, { name: 'Test card', stateData: { customCard: { a: 1 } } });
    expect(started.status).toBe(201);
    const createFee = started.body.data.createFee;
    expect(createFee).toBeGreaterThan(0);
    expect(started.body.data.balance).toBeCloseTo(ECONOMY.STARTING_GRANT - createFee, 6);

    const released = await releaseDraft(token);
    expect(released.status).toBe(200);
    expect(released.body.data.card.tier).toBe('galaxy');
    expect(released.body.data.card.rarity_score).toBe(0.82);
    // publishing is free — balance unchanged from after confirm-start
    expect(released.body.data.balance).toBeCloseTo(ECONOMY.STARTING_GRANT - createFee, 6);
  });

  test('confirm-start needs a creation, publish needs a draft', async () => {
    const { token } = await signup('creator');
    const noCreation = await confirmStart(token, { stateData: { x: 1 } });
    expect(noCreation.status).toBe(404);

    await beginCreation(token);
    const noDraft = await releaseDraft(token);
    expect(noDraft.status).toBe(404);
  });

  test('confirm-start is refused when balance cannot cover the create fee', async () => {
    const { token, user } = await signup('broke');
    memoryDb.updateUser(user.id, { balance: ECONOMY.DEBT_FLOOR }); // at the floor
    await beginCreation(token);
    const res = await confirmStart(token, { stateData: { x: 1 } });
    expect(res.status).toBe(402);
  });

  test('a draft is private until published — not in the pool', async () => {
    const { token } = await signup('drafter');
    await beginCreation(token);
    const started = await confirmStart(token, { name: 'Hidden', stateData: { x: 1 } });
    const draftId = started.body.data.draft.id;
    expect(started.body.data.draft.isPublic).toBe(false);
    const poolBefore = await request(app).get('/api/cards/community/all');
    expect(poolBefore.body.data.some(c => c.id === draftId)).toBe(false);

    await releaseDraft(token);
    const poolAfter = await request(app).get('/api/cards/community/all');
    expect(poolAfter.body.data.some(c => c.id === draftId)).toBe(true);
  });

  test('tags round-trip through publish, the pool, and a saver\'s collection', async () => {
    const { token: creatorToken, user } = await signup('tagger');
    const { released } = await publishCard(creatorToken, {
      userId: user.id,
      rarity: 0.3,
      name: 'Tagged card',
      tags: ['neon', 'galaxy'],
      stateData: { customCard: { rarity: 0.3 } }
    });
    expect(released.status).toBe(200);
    expect(released.body.data.card.tags).toEqual(['neon', 'galaxy']);
    const cardId = released.body.data.card.id;

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
  test('synthetic draw when the pool is empty', async () => {
    const { user } = await signup('drawer');
    const result = draw(user.id, () => 0.5, 'abcd1234-seed-uuid'); // pool empty ⇒ synthetic
    expect(result.source).toBe('synthetic');
    // A synthetic draw carries no server tier now — the client mints the card
    // (with its own rarity) from the seed; only pool cards report a tier.
    expect(result.tier).toBeNull();
    expect(result.card).toBeNull();
    expect(result.yield.credited).toBe(drawYieldFor('abcd1234-seed-uuid'));
    expect(result.balance).toBeCloseTo(ECONOMY.STARTING_GRANT + result.yield.credited, 6);
  });

  test('pool draw serves a published card and counts it', async () => {
    const { token: creatorToken, user: creator } = await signup('creator');
    await publishCard(creatorToken, { userId: creator.id, rarity: 0.3, name: 'Pool card' });

    const { user } = await signup('drawer');
    const result = draw(user.id, () => 0.5);
    expect(result.source).toBe('pool');
    expect(result.card.name).toBe('Pool card');
    expect(result.card.times_drawn).toBe(1);
    // single card in the pool: it wins the non-synthetic slice outright
    expect(result.stats.drawWeight).toBeCloseTo(1 - SYNTHETIC_DRAW_SHARE, 10);
    expect(result.stats.saveCost).toBe(saveCostFor(result.card.id, result.card.rarity_score));
    // pool draws seed the yield from the served card's id
    expect(result.yield.full).toBe(drawYieldFor(result.card.id));
  });

  test('draw endpoint requires auth', async () => {
    const res = await request(app).post('/api/draw');
    expect(res.status).toBe(401);
  });
});

describe('save economics', () => {
  // Publish a card with a fixed rarity of 0.35 so saveCostFor(id) (its default
  // rarity) matches what the server charges (saveCostFor(id, rarity)).
  const publishAndDraw = async () => {
    const creator = await signup('creator');
    const { card, createFee } = await publishCard(creator.token, {
      userId: creator.user.id, rarity: 0.35, name: 'Galaxy card'
    });
    const saver = await signup('saver');
    return { creator, saver, card, stake: createFee };
  };

  test('save debits cost, pays the creator dividend, cloud absorbs the rest', async () => {
    const { creator, saver, card, stake } = await publishAndDraw();
    const cloudBefore = memoryDb.getCloud();

    const res = await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set(auth(saver.token));

    expect(res.status).toBe(201);
    const cost = saveCostFor(card.id);        // the card's own seeded price
    const dividend = creatorDividendFor(card.id);
    expect(res.body.data.cost).toBe(cost);
    expect(res.body.data.dividend).toBe(dividend);
    expect(res.body.data.balance).toBeCloseTo(ECONOMY.STARTING_GRANT - cost, 6);

    const creatorUser = memoryDb.getUserById(creator.user.id);
    // starting grant − publish stake + dividend
    expect(creatorUser.balance).toBeCloseTo(
      ECONOMY.STARTING_GRANT - stake + dividend, 6);

    const cloud = memoryDb.getCloud();
    expect(round6(cloud.total_absorbed - cloudBefore.total_absorbed)).toBeCloseTo(cost, 6);
    expect(round6(cloud.total_issued - cloudBefore.total_issued)).toBeCloseTo(dividend, 6);

    const fresh = memoryDb.getCardById(card.id);
    expect(fresh.times_saved).toBe(1);
  });

  test('cannot save the same card twice', async () => {
    const { saver, card } = await publishAndDraw();
    await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    const again = await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    expect(again.status).toBe(409);
  });

  test('save fails politely at the debt floor', async () => {
    const { saver, card } = await publishAndDraw();
    // At the overdraft floor, any further spend is refused.
    memoryDb.updateUser(saver.user.id, { balance: ECONOMY.DEBT_FLOOR });
    const res = await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));
    expect(res.status).toBe(402);
  });

  test('a save remembers what it cost, and the owner\'s copy is publicly visible', async () => {
    const { saver, card } = await publishAndDraw();
    await request(app).post(`/api/cards/${card.id}/save`).set(auth(saver.token));

    // The collection carries the price paid on each save record.
    const collection = await request(app)
      .get('/api/cards/collection/mine')
      .set(auth(saver.token));
    expect(collection.body.data[0].save.cost).toBe(saveCostFor(card.id));

    // The public save-of lookup powers /<username>/card/<id>.
    const savedOf = await request(app).get(`/api/cards/${card.id}/save-of/saver`);
    expect(savedOf.status).toBe(200);
    expect(savedOf.body.data.username).toBe('saver');
    expect(savedOf.body.data.cost).toBe(saveCostFor(card.id));
    expect(savedOf.body.data.saved_at).toBeTruthy();

    // Someone who never saved it (or doesn't exist) → 404.
    const notSaved = await request(app).get(`/api/cards/${card.id}/save-of/creator`);
    expect(notSaved.status).toBe(404);
    const noUser = await request(app).get(`/api/cards/${card.id}/save-of/ghost`);
    expect(noUser.status).toBe(404);
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
  test('costs the card\'s own seeded price, keeps natural rarity, stores privately', async () => {
    const { token, user } = await signup('drawer');
    const claimedId = '9f0e1d2c-3b4a-5968-8776-a5b4c3d2e1f0';
    const res = await request(app)
      .post('/api/cards/save-synthetic')
      .set(auth(token))
      .send({ id: claimedId, stateData: { customCard: { rarity: 0.75 } } });

    expect(res.status).toBe(201);
    expect(res.body.data.card.id).toBe(claimedId);
    // Price tracks the card's rarity now (as a wide distribution), so the cost
    // is seeded from BOTH the id and the natural rarity (0.75 here).
    const cost = saveCostFor(claimedId, 0.75);
    expect(res.body.data.cost).toBe(cost);
    expect(res.body.data.card.is_public).toBe(false);
    expect(res.body.data.card.creator_id).toBe('cloud');
    expect(res.body.data.card.rarity_score).toBe(0.75); // natural rarity kept
    expect(res.body.data.card.tier).toBe('holo');       // derived, not chosen
    expect(res.body.data.balance).toBeCloseTo(ECONOMY.STARTING_GRANT - cost, 6);

    // it lands in the collection but not the public pool
    const collection = await request(app).get('/api/cards/collection/mine').set(auth(token));
    expect(collection.body.data).toHaveLength(1);
    const pool = await request(app).get('/api/cards/community/all');
    expect(pool.body.data).toHaveLength(0);
  });

  test('a claimed draw is not used up: a second user saves the same card at the same price', async () => {
    const claimedId = '1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809';
    const first = await signup('firstsaver');
    await request(app)
      .post('/api/cards/save-synthetic')
      .set(auth(first.token))
      .send({ id: claimedId, stateData: { customCard: { rarity: 0.4 } } });

    const second = await signup('secondsaver');
    const res = await request(app)
      .post(`/api/cards/${claimedId}/save`)
      .set(auth(second.token));

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(saveCostFor(claimedId)); // same card, same price
    expect(res.body.data.dividend).toBe(0); // 'cloud' has no user account to pay

    const card = memoryDb.getCardById(claimedId);
    expect(card.times_saved).toBe(2);

    const collection = await request(app).get('/api/cards/collection/mine').set(auth(second.token));
    expect(collection.body.data).toHaveLength(1);
    expect(collection.body.data[0].card.id).toBe(claimedId);
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
    const { createFee } = await publishCard(token, { userId: user.id, rarity: 0.3, stateData: { x: 1 } });

    const res = await request(app).get('/api/economy/cloud');
    expect(res.body.data.totalIssued).toBe(ECONOMY.STARTING_GRANT);
    // the only /t26 absorbed is the create fee paid at confirm-start
    expect(res.body.data.totalAbsorbed).toBeCloseTo(createFee, 6);
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
