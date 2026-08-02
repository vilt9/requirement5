import request from 'supertest';
import { beforeEach, describe, expect, test } from '@jest/globals';
import app from '../index.js';
import { MAX_COMMUNITY_ACTIVITIES, memoryDb } from '../config/database.js';

const signup = async (username) => {
  const response = await request(app)
    .post('/api/auth/signup')
    .send({
      username,
      email: `${username}@earth.test`,
      password: 'password123',
      dob: '1990-01-01',
      acceptedTerms: true
    });
  expect(response.status).toBe(201);
  return response.body.data;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const makeCard = async (owner, name) => {
  const response = await request(app)
    .post('/api/cards')
    .set(auth(owner.token))
    .send({ name, stateData: { customCard: { backgroundColor: '#182030' } } });
  expect(response.status).toBe(201);
  return response.body.data;
};

describe('community activity feed', () => {
  beforeEach(() => memoryDb.clearDatabase());

  test('a save appears publicly but not in the saver\'s own feed', async () => {
    const alice = await signup('activityalice');
    const bob = await signup('activitybob');
    const made = await request(app)
      .post('/api/cards')
      .set(auth(alice.token))
      .send({
        name: 'Signal Garden',
        stateData: {
          customCard: {
            imagePath: 'digital_race_2.webp',
            backgroundColor: '#182030'
          }
        }
      });

    const saved = await request(app)
      .post(`/api/cards/${made.body.data.id}/save`)
      .set(auth(bob.token));
    expect(saved.status).toBe(201);

    const publicFeed = await request(app).get('/api/cards/community/activity');
    expect(publicFeed.status).toBe(200);
    expect(publicFeed.headers.vary).toContain('Authorization');
    expect(publicFeed.body.data.activities).toEqual([
      expect.objectContaining({
        type: 'save',
        actor: {
          username: 'activitybob',
          collectionPath: '/activitybob/collection'
        },
        card: expect.objectContaining({
          id: made.body.data.id,
          name: 'Signal Garden',
          preview: {
            imagePath: 'digital_race_2.webp',
            customImageUrl: null,
            backgroundColor: '#182030'
          }
        })
      })
    ]);
    expect(publicFeed.body.data.activities[0]).not.toHaveProperty('actorId');
    expect(publicFeed.body.data.activities[0].card).not.toHaveProperty('creatorId');

    const bobFeed = await request(app)
      .get('/api/cards/community/activity')
      .set(auth(bob.token));
    expect(bobFeed.status).toBe(200);
    expect(bobFeed.body.data.activities).toEqual([]);
  });

  test('only signed-in reactions to stored cards enter the feed, once', async () => {
    const alice = await signup('reactionalice');
    const bob = await signup('reactionbob');
    const card = await makeCard(alice, 'Reaction Field');

    const signedIn = () => request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set(auth(bob.token))
      .send({ signal: 'flame' });
    expect((await signedIn()).status).toBe(200);
    expect((await signedIn()).status).toBe(200);

    await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .send({ signal: 'scan', guestId: '1c2f8ce3-02ad-47e3-84a9-b64a31edbfca' });
    await request(app)
      .put('/api/cards/a37f9943-aeb5-416d-a432-5770843977d9/signals')
      .send({ signal: 'launch', guestId: '7d5d5e2b-df20-4c6f-a508-f5254d7a4ac1' });

    const feed = await request(app).get('/api/cards/community/activity');
    expect(feed.body.data.activities).toHaveLength(1);
    expect(feed.body.data.activities[0]).toMatchObject({
      type: 'reaction',
      signal: 'flame',
      actor: { username: 'reactionbob' },
      card: { id: card.id, name: 'Reaction Field' }
    });
  });

  test('the preview exposes only bounded artwork paths and plain colours', async () => {
    const alice = await signup('previewalice');
    const bob = await signup('previewbob');
    const made = await request(app)
      .post('/api/cards')
      .set(auth(alice.token))
      .send({
        name: 'Unsafe Preview',
        stateData: {
          customCard: {
            imagePath: '../../privacy',
            customImageUrl: 'javascript:alert(1)',
            backgroundColor: 'url(https://tracker.test/pixel)'
          }
        }
      });
    await request(app).post(`/api/cards/${made.body.data.id}/save`).set(auth(bob.token));

    const feed = await request(app).get('/api/cards/community/activity');
    expect(feed.body.data.activities[0].card.preview).toEqual({
      imagePath: null,
      customImageUrl: null,
      backgroundColor: null
    });
  });

  test('activity on created and collected cards is prioritized ahead of newer general activity', async () => {
    const viewer = await signup('priorityviewer');
    const creator = await signup('prioritymaker');
    const actor = await signup('priorityactor');
    const owned = await makeCard(viewer, 'Viewer Original');
    const collected = await makeCard(creator, 'Shared Favourite');
    const general = await makeCard(creator, 'Passing Signal');

    await request(app).post(`/api/cards/${collected.id}/save`).set(auth(viewer.token));
    await request(app).post(`/api/cards/${owned.id}/save`).set(auth(actor.token));
    await request(app)
      .put(`/api/cards/${collected.id}/signals`)
      .set(auth(actor.token))
      .send({ signal: 'sparkle' });
    await request(app).post(`/api/cards/${general.id}/save`).set(auth(actor.token));

    const feed = await request(app)
      .get('/api/cards/community/activity')
      .set(auth(viewer.token));
    expect(feed.body.data.activities.map(item => [item.card.name, item.relevance])).toEqual([
      ['Viewer Original', 'created'],
      ['Shared Favourite', 'collected'],
      ['Passing Signal', null]
    ]);
  });

  test('a Rare-or-better save carries canonical rarity styling metadata', async () => {
    const creator = await signup('rarecreator');
    const collector = await signup('rarecollector');
    const card = await makeCard(creator, 'Singular Current');
    memoryDb.updateCard(card.id, { tier: 'vmax', rarity_score: 0.99 });

    await request(app).post(`/api/cards/${card.id}/save`).set(auth(collector.token));
    const feed = await request(app).get('/api/cards/community/activity');

    expect(feed.body.data.activities[0]).toMatchObject({
      type: 'save',
      card: {
        id: card.id,
        rarity: {
          key: 'vmax',
          name: 'Singular',
          color: '#9fe8ff',
          special: true
        }
      }
    });
  });

  test('saving the final card emits one set-completion milestone', async () => {
    const creator = await signup('setcreator');
    const collector = await signup('setcollector');
    const first = await makeCard(creator, 'Set Alpha');
    const final = await makeCard(creator, 'Set Omega');
    const set = memoryDb.upsertSet({
      id: 'setcreator_constellation',
      owner_id: creator.user.id,
      label: 'Constellation',
      info: null
    });
    memoryDb.updateCard(first.id, { set_id: set.id });
    memoryDb.updateCard(final.id, { set_id: set.id });

    await request(app).post(`/api/cards/${first.id}/save`).set(auth(collector.token));
    await request(app).post(`/api/cards/${final.id}/save`).set(auth(collector.token));

    const completed = await request(app).get('/api/cards/community/activity');
    expect(completed.body.data.activities).toEqual([
      expect.objectContaining({
        type: 'set_complete',
        actor: expect.objectContaining({ username: 'setcollector' }),
        card: expect.objectContaining({ id: final.id }),
        set: { id: set.id, label: 'Constellation', total: 2 }
      }),
      expect.objectContaining({ type: 'save', card: expect.objectContaining({ id: first.id }) })
    ]);

    // Expanding the set invalidates the old completion. Saving the new final
    // card produces one current milestone rather than reviving duplicates.
    const encore = await makeCard(creator, 'Set Encore');
    memoryDb.updateCard(encore.id, { set_id: set.id });
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities
      .some(activity => activity.type === 'set_complete')).toBe(false);

    await request(app).post(`/api/cards/${encore.id}/save`).set(auth(collector.token));
    const recompleted = await request(app).get('/api/cards/community/activity');
    const milestones = recompleted.body.data.activities
      .filter(activity => activity.type === 'set_complete');
    expect(milestones).toHaveLength(1);
    expect(milestones[0]).toMatchObject({
      card: { id: encore.id },
      set: { id: set.id, label: 'Constellation', total: 3 }
    });
  });

  test('removed activity and activity on a newly flagged card disappear', async () => {
    const alice = await signup('removalalice');
    const bob = await signup('removalbob');
    const card = await makeCard(alice, 'Temporary Pulse');

    await request(app).post(`/api/cards/${card.id}/save`).set(auth(bob.token));
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities).toHaveLength(1);

    await request(app).delete(`/api/cards/collection/${card.id}`).set(auth(bob.token));
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities).toEqual([]);

    await request(app)
      .put(`/api/cards/${card.id}/signals`)
      .set(auth(bob.token))
      .send({ signal: 'growth' });
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities).toHaveLength(1);

    await request(app)
      .delete(`/api/cards/${card.id}/signals`)
      .set(auth(bob.token))
      .send({ signal: 'growth' });
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities).toEqual([]);

    await request(app).post(`/api/cards/${card.id}/save`).set(auth(bob.token));
    await request(app).post(`/api/cards/${card.id}/report`).send({ reason: 'spam' });
    expect((await request(app).get('/api/cards/community/activity')).body.data.activities).toEqual([]);
  });

  test('the activity store stays bounded and rolls back with its source unit', () => {
    for (let index = 0; index < MAX_COMMUNITY_ACTIVITIES + 4; index += 1) {
      memoryDb.createActivity({
        source_type: 'save',
        source_id: `source-${index}`,
        actor_id: 'actor',
        card_id: 'card',
        type: 'save',
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
      });
    }

    const retained = memoryDb.getActivities();
    expect(retained).toHaveLength(MAX_COMMUNITY_ACTIVITIES);
    expect(retained[0].source_id).toBe(`source-${MAX_COMMUNITY_ACTIVITIES + 3}`);
    expect(retained.at(-1).source_id).toBe('source-4');

    memoryDb.clearDatabase();
    expect(() => memoryDb.atomic(() => {
      memoryDb.createActivity({
        source_type: 'save', source_id: 'rolled-back', actor_id: 'actor',
        card_id: 'card', type: 'save'
      });
      throw new Error('source mutation failed');
    })).toThrow('source mutation failed');
    expect(memoryDb.getActivities()).toEqual([]);
  });
});
