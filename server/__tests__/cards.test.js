import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

// Integration tests for the legacy card CRUD + community endpoints,
// run against the real model and store (no mocks). Replaces a stale
// mock-based suite written for an earlier version of the routes.
beforeEach(() => {
  memoryDb.clearDatabase();
});

const makeCard = async (overrides = {}) => {
  const res = await request(app).post('/api/cards').send({
    name: 'Test card',
    stateData: { backgroundColor: '#ff0000' },
    ...overrides
  });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('card CRUD', () => {
  test('POST / creates a card with defaults', async () => {
    const card = await makeCard();
    expect(card.id).toMatch(/^card_\d+$/);
    expect(card.name).toBe('Test card');
    expect(card.creator_id).toBe('anonymous');
    expect(card.is_public).toBe(true);
    expect(card.state_data).toEqual({ backgroundColor: '#ff0000' });
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

  test('PUT /:id updates, DELETE /:id removes', async () => {
    const card = await makeCard();
    const updated = await request(app)
      .put(`/api/cards/${card.id}`)
      .send({ name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Renamed');

    const deleted = await request(app).delete(`/api/cards/${card.id}`);
    expect(deleted.status).toBe(200);
    expect((await request(app).get(`/api/cards/${card.id}`)).status).toBe(404);
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

  test('collect increments the counter; stats aggregate', async () => {
    const card = await makeCard();
    await request(app).post(`/api/cards/${card.id}/collect`);
    await request(app).post(`/api/cards/${card.id}/collect`);

    const stats = await request(app).get('/api/cards/community/stats');
    expect(stats.body.data.totalCards).toBe(1);
    expect(stats.body.data.totalCollections).toBe(2);
  });
});
