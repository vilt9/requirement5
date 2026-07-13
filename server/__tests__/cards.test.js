import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

// Integration tests for the card CRUD + community endpoints, run against the real
// model and store (no mocks). Card creation/mutation now requires auth — every
// card has a real creator_id and only the owner can update or delete it.
let token, userId;

const signup = async (username) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ username, email: `${username}@earth.test`, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data; // { user, token }
};

beforeEach(async () => {
  memoryDb.clearDatabase();
  const me = await signup('creator1');
  token = me.token;
  userId = me.user.id;
});

const makeCard = async (overrides = {}) => {
  const res = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test card', stateData: { backgroundColor: '#ff0000' }, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('card CRUD', () => {
  test('POST / requires auth', async () => {
    const res = await request(app).post('/api/cards').send({ name: 'No auth' });
    expect(res.status).toBe(401);
  });

  test('POST / creates a card owned by the authenticated user (never anonymous)', async () => {
    const card = await makeCard();
    expect(card.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(card.name).toBe('Test card');
    expect(card.creator_id).toBe(userId);
    expect(card.creator_id).not.toBe('anonymous');
    expect(card.is_public).toBe(true);
    expect(card.state_data).toEqual({ backgroundColor: '#ff0000' });
  });

  test('POST / ignores a client-supplied creator_id', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Spoof', creatorId: 'someone_else', stateData: {} });
    expect(res.status).toBe(201);
    expect(res.body.data.creator_id).toBe(userId);
  });

  test('GET / returns all cards', async () => {
    await makeCard({ name: 'One' });
    await makeCard({ name: 'Two' });
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('GET /:id returns the card or 404', async () => {
    const card = await makeCard();
    const found = await request(app).get(`/api/cards/${card.id}`);
    expect(found.status).toBe(200);
    expect(found.body.data.id).toBe(card.id);

    const missing = await request(app).get('/api/cards/card_999');
    expect(missing.status).toBe(404);
  });

  test('owner can PUT /:id (update) and DELETE /:id (remove)', async () => {
    const card = await makeCard();
    const updated = await request(app)
      .put(`/api/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.card.name).toBe('Renamed');

    const deleted = await request(app)
      .delete(`/api/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect((await request(app).get(`/api/cards/${card.id}`)).status).toBe(404);
  });

  test('PUT/DELETE require auth and reject non-owners', async () => {
    const card = await makeCard();
    const other = await signup('creator2');

    expect((await request(app).put(`/api/cards/${card.id}`).send({ name: 'x' })).status).toBe(401);
    expect((await request(app).delete(`/api/cards/${card.id}`)).status).toBe(401);

    const putOther = await request(app)
      .put(`/api/cards/${card.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'hijack' });
    expect(putOther.status).toBe(403);

    const delOther = await request(app)
      .delete(`/api/cards/${card.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(delOther.status).toBe(403);
  });

  test('PUT /:id cannot rewrite creator_id', async () => {
    const card = await makeCard();
    const res = await request(app)
      .put(`/api/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed', creator_id: 'someone_else' });
    expect(res.status).toBe(200);
    expect(res.body.data.card.creator_id).toBe(userId);
  });

  test('GET /search/:property/:value searches state and fields', async () => {
    await makeCard({ name: 'Red', stateData: { backgroundColor: '#ff0000' } });
    await makeCard({ name: 'Green', stateData: { backgroundColor: '#00ff00' } });
    const res = await request(app).get('/api/cards/search/backgroundColor/%23ff0000');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Red');
  });
});

describe('community endpoints', () => {
  test('community/all returns only public cards', async () => {
    await makeCard({ name: 'Public' });
    await makeCard({ name: 'Private', isPublic: false });
    const res = await request(app).get('/api/cards/community/all');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Public');
  });

  test('community/random returns a card, 404 when empty', async () => {
    expect((await request(app).get('/api/cards/community/random')).status).toBe(404);
    await makeCard();
    const res = await request(app).get('/api/cards/community/random');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
  });

  test('collect requires auth, increments the counter; stats aggregate', async () => {
    const card = await makeCard();
    expect((await request(app).post(`/api/cards/${card.id}/collect`)).status).toBe(401);

    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post(`/api/cards/${card.id}/collect`).set(auth);
    await request(app).post(`/api/cards/${card.id}/collect`).set(auth);

    const stats = await request(app).get('/api/cards/community/stats');
    expect(stats.body.data.totalCards).toBe(1);
    expect(stats.body.data.totalCollections).toBe(2);
  });
});
