import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

describe('Private operator agent users', () => {
  const operatorKey = 'agent-user-test-key';

  beforeAll(() => {
    process.env.R5OPS_API_KEY = operatorKey;
    process.env.R5OPS_STUDIO_USERNAME = 'studio';
    process.env.R5OPS_MAX_OPENING_BALANCE = '1000';
  });

  beforeEach(() => {
    memoryDb.clearDatabase();
    memoryDb.createUser({ username: 'studio', password_hash: 'unused' });
  });

  const create = (body, key = operatorKey) => request(app)
    .post('/api/internal/agent-users')
    .set('x-r5ops-key', key)
    .send(body);

  test('creates a login-capable marked agent user and audits it', async () => {
    const password = 'generated-agent-password';
    const response = await create({
      username: 'growth_agent',
      password,
      openingBalance: 25
    }).expect(201);

    expect(response.body.data).toMatchObject({
      user: {
        username: 'growth_agent',
        balance: 25,
        bot_created: true,
        claimed_at: expect.any(String)
      },
      openingBalance: 25,
      balance: 25
    });
    expect(response.body.data.user).not.toHaveProperty('password_hash');

    const stored = memoryDb.getUserByUsername('growth_agent');
    expect(stored).toMatchObject({
      username: 'growth_agent',
      bot_created: true,
      operator_managed: true,
      source: 'operator_agent',
      opening_balance: 25,
      balance: 25
    });
    expect(stored).not.toHaveProperty('dob');
    expect(stored).not.toHaveProperty('terms_accepted_at');

    const login = await request(app).post('/api/auth/login').send({
      identifier: 'growth_agent',
      password
    }).expect(200);
    expect(login.body.data.user.username).toBe('growth_agent');
    expect(login.body.data.token).toEqual(expect.any(String));

    expect(memoryDb.getAllEvents()).toContainEqual(expect.objectContaining({
      type: 'operator_agent_user_created',
      user_id: stored.id,
      opening_balance: 25
    }));
  });

  test('requires operator access and rejects conflicts or invalid balances', async () => {
    await create({
      username: 'blocked_agent',
      password: 'generated-agent-password',
      openingBalance: 0
    }, 'wrong-key').expect(401);

    await create({
      username: 'same_agent',
      password: 'generated-agent-password',
      openingBalance: 0
    }).expect(201);
    await create({
      username: 'same_agent',
      password: 'different-agent-password',
      openingBalance: 0
    }).expect(409);

    await create({
      username: 'too_rich',
      password: 'generated-agent-password',
      openingBalance: 1001
    }).expect(400);
    expect(memoryDb.getUserByUsername('too_rich')).toBeUndefined();
  });
});
