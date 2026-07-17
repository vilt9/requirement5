// End-to-end HTTP contract for the safety surface: the 18+ signup gate, the
// bad-word screen on card publishing, the report → out-of-circulation flow, the
// admin review queue (restore / remove), the admin-only gate, and user bans.
import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

const ADMIN_EMAIL = 'admin@requirement5.com';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const signup = (over = {}) =>
  request(app).post('/api/auth/signup').send({
    username: 'user_one', email: 'user_one@earth.test', password: 'password123',
    dob: '1990-01-01', acceptedTerms: true, ...over
  });

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Take a fresh account all the way to one published, in-circulation card.
const publishCard = async (token, name = 'Golden Fox') => {
  await request(app).post('/api/cards/create/begin').set(auth(token)).send({});
  await request(app).post('/api/cards/create/confirm-start').set(auth(token)).send({ name });
  const res = await request(app).post('/api/cards/create/publish').set(auth(token))
    .send({ name, stateData: { customCard: {} } });
  return res.body.data.card;
};

describe('18+ signup gate', () => {
  test('rejects a date of birth under 18', async () => {
    const res = await signup({ dob: '2015-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/18 or over/i);
  });

  test('rejects a missing / invalid date of birth', async () => {
    expect((await signup({ dob: undefined })).status).toBe(400);
    expect((await signup({ dob: 'not-a-date' })).status).toBe(400);
  });

  test('rejects signup without accepting the terms', async () => {
    const res = await signup({ acceptedTerms: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accept the Terms/i);
  });

  test('an adult who accepts the terms can sign up', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.data.user.username).toBe('user_one');
    // The DOB and email never come back to the client.
    expect(res.body.data.user.dob).toBeUndefined();
    expect(res.body.data.user.email).toBeUndefined();
  });
});

describe('bad-word screen on publishing', () => {
  test('a profane card name is rejected at publish', async () => {
    const { body } = await signup();
    const token = body.data.token;
    await request(app).post('/api/cards/create/begin').set(auth(token)).send({});
    await request(app).post('/api/cards/create/confirm-start').set(auth(token)).send({ name: 'draft' });
    const res = await request(app).post('/api/cards/create/publish').set(auth(token))
      .send({ name: 'total shit card', stateData: { customCard: {} } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/language we don't allow/i);
  });

  test('a profane username is rejected at signup', async () => {
    const res = await signup({ username: 'fuck_you', email: 'x@earth.test' });
    expect(res.status).toBe(400);
  });
});

describe('report → out of circulation', () => {
  test('a reported card leaves the pool and 404s for the public', async () => {
    const { body } = await signup();
    const card = await publishCard(body.data.token);

    // In circulation to start with.
    let all = await request(app).get('/api/cards/community/all');
    expect(all.body.data.some(c => c.id === card.id)).toBe(true);

    const rep = await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'nudity' });
    expect(rep.status).toBe(201);
    expect(rep.body.data.status).toBe('flagged');

    // Gone from the pool…
    all = await request(app).get('/api/cards/community/all');
    expect(all.body.data.some(c => c.id === card.id)).toBe(false);
    // …and the public card page 404s.
    expect((await request(app).get(`/api/cards/${card.id}`)).status).toBe(404);
    // …and it can no longer be saved.
    const other = await signup({ username: 'user_two', email: 'user_two@earth.test' });
    const saveRes = await request(app).post(`/api/cards/${card.id}/save`)
      .set(auth(other.body.data.token)).send({});
    expect(saveRes.status).toBe(404);
  });

  test('an unknown report reason is rejected', async () => {
    const { body } = await signup();
    const card = await publishCard(body.data.token);
    const res = await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'banana' });
    expect(res.status).toBe(400);
  });
});

describe('admin review queue', () => {
  const makeAdmin = () => signup({ username: 'boss', email: ADMIN_EMAIL });

  test('non-admins are refused', async () => {
    const { body } = await signup();
    const res = await request(app).get('/api/admin/flagged').set(auth(body.data.token));
    expect(res.status).toBe(403);
  });

  test('admin sees flagged cards and can restore them', async () => {
    const creator = await signup();
    const card = await publishCard(creator.body.data.token);
    await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'hate' });

    const admin = await makeAdmin();
    const adminTok = admin.body.data.token;
    expect(admin.body.data.user.is_admin).toBe(true);

    const queue = await request(app).get('/api/admin/flagged').set(auth(adminTok));
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.some(i => i.card.id === card.id)).toBe(true);

    const restore = await request(app).post(`/api/admin/cards/${card.id}/restore`).set(auth(adminTok));
    expect(restore.status).toBe(200);

    // Back in circulation.
    const all = await request(app).get('/api/cards/community/all');
    expect(all.body.data.some(c => c.id === card.id)).toBe(true);
  });

  test('admin can remove a card for good', async () => {
    const creator = await signup();
    const card = await publishCard(creator.body.data.token);
    await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'illegal' });

    const admin = await makeAdmin();
    await request(app).post(`/api/admin/cards/${card.id}/remove`).set(auth(admin.body.data.token));

    const all = await request(app).get('/api/cards/community/all');
    expect(all.body.data.some(c => c.id === card.id)).toBe(false);
    // A later report does not resurrect an admin-removed card.
    await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'other' });
    const still = await request(app).get('/api/cards/community/all');
    expect(still.body.data.some(c => c.id === card.id)).toBe(false);
  });
});

describe('user bans', () => {
  test('a banned user cannot log in or act, and cannot be the admin', async () => {
    const victim = await signup({ username: 'troll', email: 'troll@earth.test' });
    const admin = await signup({ username: 'boss', email: ADMIN_EMAIL });
    const adminTok = admin.body.data.token;
    const victimId = victim.body.data.user.id;

    const ban = await request(app).post(`/api/admin/users/${victimId}/ban`).set(auth(adminTok));
    expect(ban.status).toBe(200);
    expect(ban.body.data.banned).toBe(true);

    // Old token is now refused on an authed action.
    const begin = await request(app).post('/api/cards/create/begin').set(auth(victim.body.data.token)).send({});
    expect(begin.status).toBe(403);

    // Fresh login refused too.
    const login = await request(app).post('/api/auth/login').send({ identifier: 'troll', password: 'password123' });
    expect(login.status).toBe(401);

    // The admin account itself can't be banned.
    const adminId = admin.body.data.user.id;
    const selfBan = await request(app).post(`/api/admin/users/${adminId}/ban`).set(auth(adminTok));
    expect(selfBan.status).toBe(400);

    // Unban restores access.
    await request(app).post(`/api/admin/users/${victimId}/unban`).set(auth(adminTok));
    const relogin = await request(app).post('/api/auth/login').send({ identifier: 'troll', password: 'password123' });
    expect(relogin.status).toBe(200);
  });
});
