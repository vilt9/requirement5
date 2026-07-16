import request from 'supertest';
import app from '../index.js';
import { memoryDb } from '../config/database.js';
import { normalizeSetLabel, setNameFor, setLabelOf } from '../utils/setName.js';

// Sets: the named groupings a creator publishes cards into. The set name is
// identity-bearing (it's the sets table's primary key and what cards point at),
// so these tests pin the server's ownership of its canonical form.
let token, username;

const signup = async (name) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ username: name, email: `${name}@earth.test`, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data;
};

beforeEach(async () => {
  memoryDb.clearDatabase();
  username = 'setmaker';
  const me = await signup(username);
  token = me.token;
});

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

// Walk a card from gamble to published, the way both clients do.
const publishCard = async (body = {}) => {
  await auth(request(app).post('/api/cards/create/begin')).send({});
  await auth(request(app).post('/api/cards/create/confirm-start')).send({});
  const res = await auth(request(app).post('/api/cards/create/publish'))
    .send({ name: 'A card', stateData: { customCard: {} }, ...body });
  return res;
};

const listSets = async () => {
  const res = await auth(request(app).get('/api/cards/sets/mine'));
  expect(res.status).toBe(200);
  return res.body.data.sets;
};

describe('set name normalization', () => {
  test('a typed label becomes a username-namespaced, url-safe name', () => {
    expect(setNameFor('Alice', 'Deep Sea')).toBe('alice_deep-sea');
    expect(setNameFor('alice', '  The   TRENCH!!  ')).toBe('alice_the-trench');
  });

  test("underscores fold to dashes, so the namespace delimiter stays unambiguous", () => {
    expect(normalizeSetLabel('deep_sea')).toBe('deep-sea');
    expect(setNameFor('alice', 'deep_sea')).toBe('alice_deep-sea');
  });

  test('a label that normalizes to nothing means "no set"', () => {
    expect(setNameFor('alice', '   ')).toBeNull();
    expect(setNameFor('alice', '!!!')).toBeNull();
  });

  test('the label reads back out even when the username contains an underscore', () => {
    expect(setLabelOf('od_d_deep-sea', 'od_d')).toBe('deep-sea');
  });
});

describe('publishing into a set', () => {
  test('a card with no setName has no set, and lists no sets', async () => {
    const res = await publishCard();
    expect(res.status).toBe(200);
    expect(res.body.data.card.set_id).toBeNull();
    expect(await listSets()).toEqual([]);
  });

  test('setName creates the set and points the card at it', async () => {
    const res = await publishCard({ setName: 'Deep Sea', setInfo: 'From the trench.' });
    expect(res.status).toBe(200);
    expect(res.body.data.card.set_id).toBe(`${username}_deep-sea`);

    const sets = await listSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      name: `${username}_deep-sea`,
      label: 'deep-sea',
      info: 'From the trench.',
      cardCount: 1
    });
  });

  test('a differently-typed label lands in the SAME set rather than a near-duplicate', async () => {
    await publishCard({ setName: 'Deep Sea' });
    await publishCard({ setName: '  deep   sea  ' });
    await publishCard({ setName: 'DEEP_SEA' });

    const sets = await listSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].cardCount).toBe(3);
  });

  test('set info is sticky — rejoining without setInfo keeps the existing blurb', async () => {
    await publishCard({ setName: 'Deep Sea', setInfo: 'From the trench.' });
    await publishCard({ setName: 'Deep Sea' }); // no setInfo this time

    const sets = await listSets();
    expect(sets[0].info).toBe('From the trench.');
    expect(sets[0].cardCount).toBe(2);
  });

  test('a new setInfo updates the set for every card in it', async () => {
    await publishCard({ setName: 'Deep Sea', setInfo: 'From the trench.' });
    await publishCard({ setName: 'Deep Sea', setInfo: 'Brackish water.' });

    const sets = await listSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].info).toBe('Brackish water.');
  });

  test('card info is stored on the card, independent of the set', async () => {
    const res = await publishCard({ info: 'A blurb.', setName: 'Deep Sea' });
    expect(res.body.data.card.info).toBe('A blurb.');
  });

  test("another creator's identical label is a separate set", async () => {
    await publishCard({ setName: 'Deep Sea' });
    const other = await signup('rival');
    token = other.token;
    await publishCard({ setName: 'Deep Sea' });

    const rivalSets = await listSets();
    expect(rivalSets).toHaveLength(1);
    expect(rivalSets[0].name).toBe('rival_deep-sea');
    expect(rivalSets[0].cardCount).toBe(1); // not 2 — the sets don't share cards
  });

  test('sets/mine only ever lists your own sets', async () => {
    await publishCard({ setName: 'Mine' });
    const other = await signup('nosy');
    token = other.token;
    expect(await listSets()).toEqual([]);
  });
});

describe('update honours set fields', () => {
  // Regression: setName/setInfo used to fall through PUT's `...rest` passthrough
  // and get written onto the card as junk keys while set_id never moved.
  test('update moves a draft into a set, and stores no raw request keys', async () => {
    await auth(request(app).post('/api/cards/create/begin')).send({});
    const started = await auth(request(app).post('/api/cards/create/confirm-start')).send({});
    const draftId = started.body.data.draft.id;

    const res = await auth(request(app).put(`/api/cards/${draftId}`))
      .send({ name: 'Salt Marsh', info: 'A blurb.', setName: 'Wetlands', setInfo: 'Low places.' });
    expect(res.status).toBe(200);

    const card = res.body.data.card;
    expect(card.set_id).toBe(`${username}_wetlands`);
    expect(card.info).toBe('A blurb.');
    // The request-shaped keys must never land on the stored document.
    expect(card.setName).toBeUndefined();
    expect(card.setInfo).toBeUndefined();
  });

  test('update can move a card from one set to another', async () => {
    const published = await publishCard({ name: 'Drifter', setName: 'Wetlands' });
    const id = published.body.data.card.id;

    const res = await auth(request(app).put(`/api/cards/${id}`)).send({ setName: 'Deep Sea' });
    expect(res.body.data.card.set_id).toBe(`${username}_deep-sea`);

    const sets = await listSets();
    const bySet = Object.fromEntries(sets.map(s => [s.label, s.cardCount]));
    expect(bySet['deep-sea']).toBe(1);
    expect(bySet['wetlands']).toBe(0);
  });
});

describe('set card counts', () => {
  test('a private draft does not count until it is published', async () => {
    await auth(request(app).post('/api/cards/create/begin')).send({});
    await auth(request(app).post('/api/cards/create/confirm-start'))
      .send({ name: 'Pending', setName: 'Wetlands' });

    // The draft carries the set, but the set must read as empty until release.
    let sets = await listSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].cardCount).toBe(0);

    await auth(request(app).post('/api/cards/create/publish')).send({ name: 'Pending' });
    sets = await listSets();
    expect(sets[0].cardCount).toBe(1);
  });
});

describe('a published card must be named', () => {
  test('a blank name is rejected', async () => {
    const res = await publishCard({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  test('the draft placeholder does not count as a name', async () => {
    await auth(request(app).post('/api/cards/create/begin')).send({});
    await auth(request(app).post('/api/cards/create/confirm-start')).send({});
    // No name anywhere: the draft is sitting on confirm-start's placeholder.
    const res = await auth(request(app).post('/api/cards/create/publish')).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  test('a real name publishes', async () => {
    const res = await publishCard({ name: 'Abyssal Drifter' });
    expect(res.status).toBe(200);
    expect(res.body.data.card.name).toBe('Abyssal Drifter');
  });
});
