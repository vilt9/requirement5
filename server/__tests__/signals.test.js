import request from 'supertest';
import { beforeEach, describe, expect, test } from '@jest/globals';
import app from '../index.js';
import { memoryDb } from '../config/database.js';

const signup = async (username) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      username,
      email: `${username}@earth.test`,
      password: 'password123',
      dob: '1990-01-01',
      acceptedTerms: true
    });
  return res.body.data;
};

describe('card signals and notifications', () => {
  let creator;
  let viewer;
  let card;

  beforeEach(async () => {
    memoryDb.clearDatabase();
    creator = await signup('signalcreator');
    viewer = await signup('signalviewer');
    const made = await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'Signal test', stateData: {} });
    card = made.body.data;
  });

  test('a viewer can leave several persistent reactions', async () => {
    const auth = { Authorization: `Bearer ${viewer.token}` };
    const first = await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set(auth)
      .send({ signal: 'scan' });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ mine: ['scan'], total: 1 });
    expect(first.body.data.counts.scan).toBe(1);

    const added = await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set(auth)
      .send({ signal: 'atom' });
    expect(added.body.data).toMatchObject({ mine: ['scan', 'atom'], total: 2 });
    expect(added.body.data.counts.scan).toBe(1);
    expect(added.body.data.counts.atom).toBe(1);

    const publicView = await request(app).get(`/api/cards/${card.id}/signals`);
    expect(publicView.body.data).toMatchObject({ mine: [], total: 2 });
  });

  test('anonymous visitors can signal with a stable device identity', async () => {
    const guestId = '7d5d5e2b-df20-4c6f-a508-f5254d7a4ac1';
    const signalled = await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .send({ signal: 'scan', guestId });
    expect(signalled.status).toBe(200);
    expect(signalled.body.data).toMatchObject({ mine: ['scan'], total: 1 });

    const sameVisitor = await request(app)
      .get(`/api/cards/${card.id}/signals?guestId=${guestId}`);
    expect(sameVisitor.body.data.mine).toEqual(['scan']);

    const removed = await request(app)
      .delete(`/api/cards/${card.id}/signals`)
      .send({ signal: 'scan', guestId });
    expect(removed.body.data).toMatchObject({ mine: [], total: 0 });
  });

  test('signals validate the vocabulary and reject creator self-signals', async () => {
    expect((await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .send({ signal: 'atom' })).status).toBe(400);

    expect((await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ signal: 'heart' })).status).toBe(400);

    expect((await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ signal: 'atom' })).status).toBe(400);
  });

  test('the creator receives and can read signal notifications', async () => {
    await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ signal: 'flame' });

    const auth = { Authorization: `Bearer ${creator.token}` };
    const before = await request(app).get('/api/cards/notifications/mine').set(auth);
    expect(before.body.data.unread).toBe(1);
    expect(before.body.data.notifications[0]).toMatchObject({
      type: 'reaction',
      signal: 'flame',
      actor: 'signalviewer',
      actorCollection: '/signalviewer/collection',
      card: { id: card.id, name: 'Signal test' }
    });

    expect((await request(app).post('/api/cards/notifications/read').set(auth)).status).toBe(200);
    const after = await request(app).get('/api/cards/notifications/mine').set(auth);
    expect(after.body.data.unread).toBe(0);
  });

  test('clicking the active signal can remove it', async () => {
    const auth = { Authorization: `Bearer ${viewer.token}` };
    await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set(auth)
      .send({ signal: 'growth' });
    const removed = await request(app)
      .delete(`/api/cards/${card.id}/signals`)
      .set(auth)
      .send({ signal: 'growth' });
    expect(removed.body.data).toMatchObject({ mine: [], total: 0 });
  });

  test('a save reports the saver, collection link, and exact creator credit', async () => {
    const saved = await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ provenance: 'discovered' });
    expect(saved.status).toBe(201);

    const feed = await request(app)
      .get('/api/cards/notifications/mine')
      .set('Authorization', `Bearer ${creator.token}`);
    expect(feed.body.data.notifications[0]).toMatchObject({
      type: 'save',
      amount: saved.body.data.dividend,
      actor: 'signalviewer',
      actorCollection: '/signalviewer/collection',
      card: { id: card.id, name: 'Signal test' }
    });
  });

  test('collection influence is attributed and consolidated per card and day', async () => {
    const relay = await signup('signalrelay');
    const second = await signup('signalsecond');
    await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ provenance: 'discovered' });

    for (const saver of [relay, second]) {
      const response = await request(app)
        .post(`/api/cards/${card.id}/save`)
        .set('Authorization', `Bearer ${saver.token}`)
        .send({ provenance: 'linked', sourceUsername: 'signalviewer' });
      expect(response.status).toBe(201);
    }

    const feed = await request(app)
      .get('/api/cards/notifications/mine')
      .set('Authorization', `Bearer ${viewer.token}`);
    const influence = feed.body.data.notifications.filter(item => item.type === 'collection_influence');
    expect(influence).toHaveLength(1);
    expect(influence[0]).toMatchObject({
      data: { count: 2 },
      card: { id: card.id }
    });
  });

  test('collectors receive one per-card reaction report with an icon breakdown', async () => {
    const reactor = await signup('signalreactor');
    await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ provenance: 'discovered' });

    for (const signal of ['flame', 'launch']) {
      await request(app)
        .put(`/api/cards/${card.id}/signals`)
        .set('Authorization', `Bearer ${reactor.token}`)
        .send({ signal });
    }

    const feed = await request(app)
      .get('/api/cards/notifications/mine')
      .set('Authorization', `Bearer ${viewer.token}`);
    const activity = feed.body.data.notifications.filter(item => item.type === 'collection_reaction');
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      data: { total: 2, counts: { flame: 1, launch: 1 } },
      card: { id: card.id }
    });
  });

  test('creator releases are limited to one report per creator each week', async () => {
    await request(app)
      .post(`/api/cards/${card.id}/save`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ provenance: 'discovered' });

    let newest;
    for (const name of ['Second issue', 'Third issue']) {
      const made = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${creator.token}`)
        .send({ name, stateData: {} });
      expect(made.status).toBe(201);
      newest = made.body.data;
    }

    const feed = await request(app)
      .get('/api/cards/notifications/mine')
      .set('Authorization', `Bearer ${viewer.token}`);
    const releases = feed.body.data.notifications.filter(item => item.type === 'creator_activity');
    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({
      actor: 'signalcreator',
      card: { id: newest.id, name: 'Third issue' }
    });
  });
});
