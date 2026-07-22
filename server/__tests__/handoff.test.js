import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

describe('Private operator handoff', () => {
  const operatorKey = 'handoff-test-key';
  let studio;

  beforeAll(() => {
    process.env.R5OPS_API_KEY = operatorKey;
    process.env.R5OPS_STUDIO_USERNAME = 'studio';
    process.env.R5OPS_MAX_OPENING_BALANCE = '1000';
  });

  beforeEach(() => {
    memoryDb.clearDatabase();
    studio = memoryDb.createUser({ username: 'studio', password_hash: 'unused' });
  });

  const operator = (req, key = operatorKey) => req.set('x-r5ops-key', key);
  const handoff = (body) => operator(request(app).post('/api/internal/handoffs')).send(body);

  test('operator routes require the separate configured key', async () => {
    await request(app).get('/api/internal/auth/check').expect(401);
    await operator(request(app).get('/api/internal/auth/check'), 'wrong').expect(401);
    const checked = await operator(request(app).get('/api/internal/auth/check')).expect(200);
    expect(checked.body.data).toMatchObject({
      authorized: true,
      studioUsername: 'studio',
      maxOpeningBalance: 1000
    });
  });

  test('operator routes are disabled unless both server settings exist', async () => {
    const key = process.env.R5OPS_API_KEY;
    delete process.env.R5OPS_API_KEY;
    await operator(request(app).get('/api/internal/auth/check')).expect(503);
    process.env.R5OPS_API_KEY = key;
  });

  test('transfers a batch, remaps its set, keeps cards private, and audits the action', async () => {
    const studioSet = memoryDb.upsertSet({
      id: 'studio_homes-of-tomorrow',
      owner_id: studio.id,
      label: 'homes-of-tomorrow',
      info: 'Googie-inspired homes.'
    });
    const first = memoryDb.createCard({
      name: 'Private home', creator_id: studio.id, is_public: false, set_id: studioSet.id,
      tier: 'common', rarity_score: 0.4
    });
    const second = memoryDb.createCard({
      name: 'Published home', creator_id: studio.id, is_public: true, set_id: studioSet.id,
      tier: 'galaxy', rarity_score: 0.82
    });

    const res = await handoff({
      username: 'Zenchilada', openingBalance: 500, cardIds: [first.id, second.id]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.username).toBe('zenchilada');
    expect(res.body.data.balance).toBe(500);
    expect(res.body.data.transferred).toEqual([first.id, second.id]);

    const target = memoryDb.getUserByUsername('zenchilada');
    for (const id of [first.id, second.id]) {
      expect(memoryDb.getCardById(id)).toMatchObject({
        creator_id: target.id,
        set_id: 'zenchilada_homes-of-tomorrow',
        is_public: false
      });
    }
    expect(memoryDb.getCommunityCards()).toEqual([]);
    expect(memoryDb.getSetById('zenchilada_homes-of-tomorrow')).toMatchObject({
      owner_id: target.id,
      label: 'homes-of-tomorrow',
      info: 'Googie-inspired homes.'
    });
    expect(memoryDb.getAllEvents()).toContainEqual(expect.objectContaining({
      type: 'operator_handoff',
      user_id: target.id,
      card_ids: [first.id, second.id]
    }));
  });

  test('a repeated handoff is idempotent', async () => {
    const card = memoryDb.createCard({ name: 'Card', creator_id: studio.id, is_public: false });
    const body = { username: 'repeatable', openingBalance: 250, cardIds: [card.id] };
    const first = await handoff(body);
    const second = await handoff(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.reused).toBe(true);
    expect(second.body.data.transferred).toEqual([]);
    expect(second.body.data.alreadyAssigned).toEqual([card.id]);
    expect(second.body.data.claimUrl).toBe(first.body.data.claimUrl);
    expect(second.body.data.balance).toBe(250);
    expect(memoryDb.getCardById(card.id).is_public).toBe(false);
  });

  test('claimed owner can edit a handed-off card before publishing it', async () => {
    const card = memoryDb.createCard({
      name: 'Original name', creator_id: studio.id, is_public: true,
      tier: 'common', rarity_score: 0.4
    });
    const prepared = await handoff({
      username: 'new_creator', openingBalance: 250, cardIds: [card.id]
    });
    const claimToken = prepared.body.data.claimUrl.split('/').pop();
    const claimed = await request(app).post('/api/auth/claim').send({
      token: claimToken,
      password: 'artistpass1',
      dob: '1990-01-01',
      acceptedTerms: true
    }).expect(200);
    const auth = { Authorization: `Bearer ${claimed.body.data.token}` };

    const edited = await request(app).put(`/api/cards/${card.id}`)
      .set(auth)
      .send({ name: 'Owner edit' })
      .expect(200);
    expect(edited.body.data.card).toMatchObject({ name: 'Owner edit', is_public: false });
    expect(memoryDb.getCommunityCards()).toEqual([]);

    const published = await request(app).post('/api/cards/create/publish')
      .set(auth)
      .send({ id: card.id })
      .expect(200);
    expect(published.body.data.card).toMatchObject({ name: 'Owner edit', is_public: true });
    expect(memoryDb.getCommunityCards().map(item => item.id)).toContain(card.id);
  });

  test('refuses card ownership, collector, username, and balance conflicts', async () => {
    const outsider = memoryDb.createUser({ username: 'outsider', password_hash: 'unused' });
    const wrongOwner = memoryDb.createCard({ name: 'Wrong', creator_id: outsider.id });
    expect((await handoff({ username: 'target1', openingBalance: 100, cardIds: [wrongOwner.id] })).status).toBe(409);

    const collected = memoryDb.createCard({ name: 'Collected', creator_id: studio.id });
    memoryDb.createSave({ user_id: outsider.id, card_id: collected.id, cost: 1 });
    expect((await handoff({ username: 'target2', openingBalance: 100, cardIds: [collected.id] })).status).toBe(409);

    memoryDb.createUser({ username: 'occupied', password_hash: 'unused' });
    const available = memoryDb.createCard({ name: 'Available', creator_id: studio.id });
    expect((await handoff({ username: 'occupied', openingBalance: 100, cardIds: [available.id] })).status).toBe(409);
    expect((await handoff({ username: 'target3', openingBalance: 1001, cardIds: [available.id] })).status).toBe(400);
  });

  test('validates the full batch before creating the destination account', async () => {
    const valid = memoryDb.createCard({ name: 'Valid', creator_id: studio.id });
    const res = await handoff({
      username: 'should_not_exist', openingBalance: 100, cardIds: [valid.id, 'missing-card']
    });
    expect(res.status).toBe(404);
    expect(memoryDb.getUserByUsername('should_not_exist')).toBeUndefined();
    expect(memoryDb.getCardById(valid.id).creator_id).toBe(studio.id);
  });
});
