// Route-level contract for signup/login. The model-level rules live in
// ledger.test.js; here we assert the HTTP surface — status codes and that the
// friendly error strings reach the client instead of a raw DB constraint (the
// `duplicate key value violates unique constraint "users_name_idx"` leak).
import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

const signup = (body) => request(app).post('/api/auth/signup').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const valid = (username) => ({ username, email: `${username}@earth.test`, password: 'password123' });

describe('POST /api/auth/signup', () => {
  test('creates a user, grants a starting balance, and returns a token', async () => {
    const res = await signup(valid('alice'));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('alice');
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.balance).toBeGreaterThan(0);
  });

  test('a duplicate username returns a clean 400 — never a raw DB constraint', async () => {
    await signup(valid('bob'));
    const res = await signup({ ...valid('bob'), email: 'other@earth.test' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Username is taken');
    // Regression guard for the leaked Postgres error the user actually hit.
    expect(res.body.error).not.toMatch(/constraint|duplicate key|users_name_idx/i);
  });

  test('duplicate detection is case-insensitive', async () => {
    await signup(valid('carol'));
    const res = await signup({ ...valid('carol2'), username: 'CAROL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username is taken');
  });

  test('a duplicate email returns a clean 400', async () => {
    await signup(valid('dave'));
    const res = await signup({ ...valid('dave2'), email: 'dave@earth.test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('That email is already registered');
  });

  test('validation failures come back as friendly 400s', async () => {
    const cases = [
      { ...valid('ok'), username: 'ab' },          // too short
      { ...valid('okname'), email: 'not-an-email' }, // bad email
      { ...valid('okname2'), password: 'short' }     // weak password
    ];
    for (const body of cases) {
      const res = await signup(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).not.toMatch(/constraint|duplicate key/i);
    }
  });

  test('concurrent signups for the same username yield exactly one winner', async () => {
    // The check-then-insert in User.create must be an atomic critical section:
    // fire several at once and only one may succeed, the rest get "Username is taken".
    const attempts = Array.from({ length: 6 }, (_, i) =>
      signup({ ...valid('racer'), email: `race${i}@earth.test` }));
    const results = await Promise.all(attempts);
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    for (const r of rejected) expect(r.body.error).toBe('Username is taken');
  });
});

describe('POST /api/auth/login', () => {
  test('a wrong password returns 401 "Invalid login or password"', async () => {
    await signup(valid('erin'));
    const res = await login({ identifier: 'erin', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid login or password');
  });

  test('login works by username or by email', async () => {
    await signup(valid('frank'));
    const byName = await login({ identifier: 'frank', password: 'password123' });
    const byEmail = await login({ identifier: 'frank@earth.test', password: 'password123' });
    expect(byName.status).toBe(200);
    expect(byEmail.status).toBe(200);
    expect(byName.body.data.token).toBeTruthy();
  });
});
