import request from 'supertest';
import app from '../index.js';

// The "gift account" flow: adopt an artist account, publish under it, then let the
// artist claim it. Exercises the security properties that matter in prod.
describe('Gift-account adopt + claim flow', () => {
  const secret = 'test-adopt-secret';
  beforeAll(() => { process.env.R5C_ADOPT_SECRET = secret; });

  const adopt = (handle, extra = {}) =>
    request(app).post('/api/auth/adopt')
      .set('x-adopt-secret', secret)
      .send({ handle, ...extra });

  it('refuses adoption without the secret', async () => {
    const res = await request(app).post('/api/auth/adopt').send({ handle: 'someone' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('is disabled when no secret is configured on the server', async () => {
    const prev = process.env.R5C_ADOPT_SECRET;
    delete process.env.R5C_ADOPT_SECRET;
    const res = await request(app).post('/api/auth/adopt')
      .set('x-adopt-secret', 'anything').send({ handle: 'someone' });
    expect(res.status).toBe(503);
    process.env.R5C_ADOPT_SECRET = prev;
  });

  it('mints an unclaimed account with a sanitized username, a token, and a claim link', async () => {
    const res = await adopt('Cosmic-Painter!');
    expect(res.status).toBe(201);
    expect(res.body.data.user.username).toBe('cosmicpainter');
    expect(res.body.data.user.claimed_at).toBeNull();
    expect(res.body.data.user.balance).toBeGreaterThan(0);   // got the starting grant
    expect(typeof res.body.data.token).toBe('string');        // publishing token
    expect(res.body.data.claimUrl).toContain('/claim/');
    // The claim token is a bearer secret — it must never appear on the user object.
    expect(res.body.data.user).not.toHaveProperty('claim_token');
    expect(res.body.data.user).not.toHaveProperty('password_hash');
  });

  it('reuses an existing unclaimed account for the same handle and rotates its token', async () => {
    const first = await adopt('repeat_artist');
    const second = await adopt('repeat_artist');
    expect(second.status).toBe(200);
    expect(second.body.data.reused).toBe(true);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.claimToken).not.toBe(first.body.data.claimToken);
  });

  it('lets the artist claim the account, then burns the link', async () => {
    const adopted = await adopt('claim_me');
    const claimToken = adopted.body.data.claimToken;
    const adult = { dob: '1990-01-01', acceptedTerms: true };

    // Wrong token → 404.
    await request(app).post('/api/auth/claim')
      .send({ token: 'not-a-real-token', password: 'artistpass1', ...adult }).expect(404);

    // Too-short password → 400.
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'short', ...adult }).expect(400);

    // Under 18 → 400 (the claim-time age gate).
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', dob: '2015-01-01', acceptedTerms: true }).expect(400);

    // Not accepting the terms → 400.
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', dob: '1990-01-01', acceptedTerms: false }).expect(400);

    // Real claim → sets password, stamps claimed_at, logs them in.
    const claimed = await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', ...adult }).expect(200);
    expect(claimed.body.data.user.username).toBe('claim_me');
    expect(claimed.body.data.user.claimed_at).toBeTruthy();
    expect(typeof claimed.body.data.token).toBe('string');

    // The link is now dead.
    await request(app).post('/api/auth/claim')
      .send({ token: claimToken, password: 'artistpass1', ...adult }).expect(404);

    // The artist can log in with their new password.
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'claim_me', password: 'artistpass1' }).expect(200);
    expect(login.body.data.user.username).toBe('claim_me');
  });

  it('previews an unclaimed account (handle + balance) without revealing the token', async () => {
    const adopted = await adopt('preview_artist');
    const res = await request(app).get(`/api/auth/claim/${adopted.body.data.claimToken}`).expect(200);
    expect(res.body.data.username).toBe('preview_artist');
    expect(res.body.data.balance).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.cards)).toBe(true);
    expect(JSON.stringify(res.body.data)).not.toContain(adopted.body.data.claimToken);
  });

  it('404s the preview for a bad token', async () => {
    await request(app).get('/api/auth/claim/nope').expect(404);
  });

  it('refuses to re-adopt a claimed account', async () => {
    const adopted = await adopt('already_claimed');
    await request(app).post('/api/auth/claim')
      .send({ token: adopted.body.data.claimToken, password: 'artistpass1', dob: '1990-01-01', acceptedTerms: true }).expect(200);
    const again = await adopt('already_claimed');
    expect(again.status).toBe(409);
  });
});
