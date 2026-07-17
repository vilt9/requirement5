import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import { signToken } from '../middleware/auth.js';
import User from '../models/User.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

describe('GET /api/analytics', () => {
  it('serves a well-formed payload with no auth', async () => {
    const res = await request(app).get('/api/analytics').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('retention');
    expect(res.body.data).toHaveProperty('usage');
  });
});

describe('POST /api/analytics/event', () => {
  it('logs a logged-out generate click (user_id null)', async () => {
    await request(app).post('/api/analytics/event').send({ type: 'generate' }).expect(200);
    const events = memoryDb.getAllEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'generate', user_id: null });
  });

  it('tags the click with the user when a token rides along', async () => {
    const { data: user } = await User.create({ username: 'clicker', email: 'c@earth.test', password: 'password123', dob: '1990-01-01', acceptedTerms: true });
    const token = signToken(user);
    await request(app)
      .post('/api/analytics/event')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'generate' })
      .expect(200);
    expect(memoryDb.getAllEvents()[0].user_id).toBe(user.id);
  });

  it('rejects unknown event types', async () => {
    await request(app).post('/api/analytics/event').send({ type: 'nonsense' }).expect(400);
    expect(memoryDb.getAllEvents()).toHaveLength(0);
  });
});
