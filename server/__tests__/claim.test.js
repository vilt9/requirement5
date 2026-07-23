import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import { signToken } from '../middleware/auth.js';
import { ECONOMY } from '../services/economy.js';

describe('Reserved account claim flow', () => {
  const operatorKey = 'test-operator-key';
  let studio;

  beforeAll(() => {
    process.env.R5OPS_API_KEY = operatorKey;
    process.env.R5OPS_STUDIO_USERNAME = 'studio';
  });

  beforeEach(() => {
    memoryDb.clearDatabase();
    studio = memoryDb.createUser({ username: 'studio', password_hash: 'unused' });
  });

  const reserve = async (username, openingBalance = 500) => {
    const card = memoryDb.createCard({
      name: `${username} card`,
      creator_id: studio.id,
      is_public: false
    });
    return request(app).post('/api/internal/handoffs')
      .set('x-r5ops-key', operatorKey)
      .send({ username, openingBalance, cardIds: [card.id] });
  };

  it('creates an unclaimed account with an exact balance and server claim link', async () => {
    const res = await reserve('Zenchilada', 500);
    expect(res.status).toBe(201);
    expect(res.body.data.user.username).toBe('Zenchilada');
    expect(res.body.data.user.claimed_at).toBeNull();
    expect(res.body.data.balance).toBe(500);
    expect(res.body.data.claimUrl).toMatch(/^http:\/\/localhost:5173\/claim\//);
    expect(res.body.data).not.toHaveProperty('claimToken');
    expect(res.body.data).not.toHaveProperty('token');
    expect(res.body.data.user).not.toHaveProperty('claim_token');
    expect(res.body.data.user).not.toHaveProperty('password_hash');
  });

  it('repeats safely without rotating the link or issuing currency again', async () => {
    const first = await reserve('repeat_artist');
    const card = memoryDb.createCard({ name: 'Second card', creator_id: studio.id, is_public: false });
    const second = await request(app).post('/api/internal/handoffs')
      .set('x-r5ops-key', operatorKey)
      .send({ username: 'repeat_artist', openingBalance: 500, cardIds: [card.id] });

    expect(second.status).toBe(200);
    expect(second.body.data.reused).toBe(true);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.claimUrl).toBe(first.body.data.claimUrl);
    expect(second.body.data.balance).toBe(500);
    const grants = memoryDb.getTransactionsByUser(first.body.data.user.id)
      .filter(txn => txn.type === 'operator_grant');
    expect(grants).toHaveLength(1);
  });

  it('lets the owner claim the account, burns the link, and invalidates old sessions', async () => {
    const reserved = await reserve('claim_me');
    const claimToken = reserved.body.data.claimUrl.split('/').pop();
    const rawUser = memoryDb.getUserByUsername('claim_me');
    const legacySession = signToken(rawUser);
    const adult = { dob: '1990-01-01', acceptedTerms: true };

    await request(app).post('/api/auth/claim')
      .send({ token: 'not-a-real-token', password: 'artistpass1', ...adult }).expect(404);
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'short', ...adult }).expect(400);
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', dob: '2015-01-01', acceptedTerms: true }).expect(400);
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', dob: '1990-01-01', acceptedTerms: false }).expect(400);

    const claimed = await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', ...adult }).expect(200);
    expect(claimed.body.data.user.username).toBe('claim_me');
    expect(claimed.body.data.user.claimed_at).toBeTruthy();
    expect(typeof claimed.body.data.token).toBe('string');

    await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${claimed.body.data.token}`).expect(200);

    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', ...adult }).expect(404);
    await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${legacySession}`).expect(401);

    const login = await request(app).post('/api/auth/login')
      .send({ username: 'claim_me', password: 'artistpass1' }).expect(200);
    expect(login.body.data.user.username).toBe('claim_me');
  });

  it('previews the unclaimed account and its cards without exposing its token', async () => {
    const reserved = await reserve('preview_artist');
    const claimToken = reserved.body.data.claimUrl.split('/').pop();
    const res = await request(app).get(`/api/auth/claim/${claimToken}`).expect(200);
    expect(res.body.data.username).toBe('preview_artist');
    expect(res.body.data.balance).toBe(500);
    expect(res.body.data.defaultBalance).toBe(ECONOMY.STARTING_GRANT);
    expect(res.body.data.cards).toHaveLength(1);
    expect(res.body.data.cards[0].is_public).toBe(false);
    expect(JSON.stringify(res.body.data)).not.toContain(claimToken);
  });

  it('refuses to hand off more cards after the account is claimed', async () => {
    const reserved = await reserve('already_claimed');
    const claimToken = reserved.body.data.claimUrl.split('/').pop();
    await request(app).post('/api/auth/claim').send({
      token: claimToken,
      password: 'artistpass1',
      dob: '1990-01-01',
      acceptedTerms: true
    }).expect(200);

    const card = memoryDb.createCard({ name: 'Too late', creator_id: studio.id, is_public: false });
    const again = await request(app).post('/api/internal/handoffs')
      .set('x-r5ops-key', operatorKey)
      .send({ username: 'already_claimed', openingBalance: 500, cardIds: [card.id] });
    expect(again.status).toBe(409);
  });
});
