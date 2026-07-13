import { memoryDb } from '../config/database.js';
import { computeAnalytics, isoWeek } from '../services/analytics.js';

beforeEach(() => {
  memoryDb.clearDatabase();
});

// Backdate a just-created row. createUser/createTransaction/etc. stamp created_at
// with now(); they return the live object in the working set, so mutating its
// created_at here rewrites history for the analytics sweep to read.
const at = (row, iso) => { row.created_at = iso; return row; };

// Fixed ISO weeks used across the specs (all Mondays for clarity).
const W1 = '2026-06-01T12:00:00.000Z'; // 2026-W23
const W2 = '2026-06-08T12:00:00.000Z'; // 2026-W24
const W3 = '2026-06-15T12:00:00.000Z'; // 2026-W25

const K1 = isoWeek(new Date(W1));
const K2 = isoWeek(new Date(W2));
const K3 = isoWeek(new Date(W3));

const makeUser = (username, createdAt, extra = {}) =>
  at(memoryDb.createUser({ username, ...extra }), createdAt);

const draw = (userId, createdAt, balanceAfter = 10) =>
  at(memoryDb.createTransaction({ user_id: userId, type: 'draw_yield', amount: 1, balance_after: balanceAfter }), createdAt);

describe('isoWeek', () => {
  test('keys are contiguous, sortable, and split on the week boundary', () => {
    expect(K1).toBe('2026-W23');
    expect(K2).toBe('2026-W24');
    expect(K1 < K2 && K2 < K3).toBe(true);
    // Sunday and the following Monday fall in different weeks.
    expect(isoWeek(new Date('2026-06-07T23:00:00Z'))).toBe('2026-W23');
    expect(isoWeek(new Date('2026-06-08T01:00:00Z'))).toBe('2026-W24');
  });
});

describe('feature 1 — signup-cohort retention', () => {
  test('groups users by signup week and counts who returns later', () => {
    const a = makeUser('alice', W1);
    const b = makeUser('bob', W1);
    makeUser('carol', W1);          // signs up, never comes back
    const d = makeUser('dave', W2); // a later cohort

    draw(a.id, W1);                 // active in birth week
    draw(a.id, W2);                 // and retained into week 2
    draw(b.id, W2);                 // bob only returns in week 2
    draw(d.id, W2);

    const { retention } = computeAnalytics();
    const c1 = retention.cohorts.find(c => c.cohort_week === K1);
    const c2 = retention.cohorts.find(c => c.cohort_week === K2);

    expect(c1.size).toBe(3);
    expect(c1.active[K1]).toBe(1);  // only alice active in birth week
    expect(c1.active[K2]).toBe(2);  // alice + bob retained into week 2
    expect(c1.active[K3]).toBeUndefined();
    expect(c2.size).toBe(1);
    expect(c2.active[K2]).toBe(1);
  });

  test('an action before a user existed never counts toward retention', () => {
    const a = makeUser('late', W2);
    draw(a.id, W1); // stray earlier-dated action
    const c = computeAnalytics().retention.cohorts.find(c => c.cohort_week === K2);
    expect(c.active[K1]).toBeUndefined();
  });

  test('unclaimed bot-gift accounts are excluded; claimed ones count', () => {
    makeUser('gift', W1, { bot_created: true, claimed_at: null });
    makeUser('claimed', W1, { bot_created: true, claimed_at: W1 });
    makeUser('human', W1);
    const { totals } = computeAnalytics();
    expect(totals.users).toBe(2); // gift excluded, claimed + human counted
  });
});

describe('feature 2 — activity intensity', () => {
  test('events count every action while active counts distinct people', () => {
    const a = makeUser('a', W1);
    draw(a.id, W2); draw(a.id, W2); draw(a.id, W2); // three actions, one person
    const c = computeAnalytics().retention.cohorts.find(c => c.cohort_week === K1);
    expect(c.active[K2]).toBe(1);
    expect(c.events[K2]).toBe(3);
  });

  test('saves, stars and card-creates all count as activity (no double count)', () => {
    const a = makeUser('a', W1);
    const card = at(memoryDb.createCard({ creator_id: a.id }), W1);
    at(memoryDb.createSave({ user_id: a.id, card_id: card.id }), W1);
    const owner = makeUser('owner', W1);
    at(memoryDb.createStar(a.id, owner.id), W1);
    const c = computeAnalytics().retention.cohorts.find(c => c.cohort_week === K1);
    // create + save + star = 3 actions for alice in her birth week
    expect(c.events[K1]).toBe(3);
  });
});

describe('feature 3 — economy health per cohort', () => {
  test('carries balance forward and reports median, debt and floor counts', () => {
    const a = makeUser('a', W1);
    const b = makeUser('b', W1);
    at(memoryDb.createTransaction({ user_id: a.id, type: 'grant', amount: 50, balance_after: 50 }), W1);
    at(memoryDb.createTransaction({ user_id: b.id, type: 'grant', amount: 50, balance_after: 50 }), W1);
    // b spends into debt in week 2; a is quiet (balance carries forward at 50)
    at(memoryDb.createTransaction({ user_id: b.id, type: 'save', amount: -60, balance_after: -10 }), W2);

    const cohort = computeAnalytics().economy.cohorts.find(c => c.cohort_week === K1);
    const wk1 = cohort.series.find(s => s.week === K1);
    const wk2 = cohort.series.find(s => s.week === K2);

    expect(wk1.median).toBe(50);
    expect(wk1.inDebt).toBe(0);
    expect(wk2.members).toBe(2);      // a carried forward even with no week-2 txn
    expect(wk2.median).toBe(20);      // median of [50, -10]
    expect(wk2.inDebt).toBe(1);       // b underwater
  });

  test('flags members that have hit the debt floor', () => {
    const a = makeUser('a', W1);
    at(memoryDb.createTransaction({ user_id: a.id, type: 'save', amount: -1000, balance_after: -1000 }), W1);
    const cohort = computeAnalytics().economy.cohorts.find(c => c.cohort_week === K1);
    expect(cohort.series.find(s => s.week === K1).atFloor).toBe(1);
  });
});

describe('feature 4 — creator vs collector segments', () => {
  test('classifies by behaviour and builds a retention grid per segment', () => {
    const creator = makeUser('creator', W1);
    const collector = makeUser('collector', W1);
    makeUser('lurker', W1); // neither creates nor saves

    const card = at(memoryDb.createCard({ creator_id: creator.id, is_public: true }), W1);
    at(memoryDb.createSave({ user_id: collector.id, card_id: card.id }), W2);

    const { segments, totals } = computeAnalytics();
    expect(totals.creators).toBe(1);
    expect(totals.collectors).toBe(1); // collector saved but never created; creator excluded

    const creatorCohort = segments.creator.cohorts.find(c => c.cohort_week === K1);
    const collectorCohort = segments.collector.cohorts.find(c => c.cohort_week === K1);
    expect(creatorCohort.size).toBe(1);
    expect(creatorCohort.active[K1]).toBe(1);        // created in birth week
    expect(collectorCohort.active[K2]).toBe(1);      // saved (retained) in week 2
  });
});

describe('banner totals', () => {
  test('sums circulating balance, cards, and per-week new/active users', () => {
    const a = makeUser('a', W1, { balance: 30 });
    const b = makeUser('b', W2, { balance: 12.5 });
    at(memoryDb.createCard({ creator_id: a.id, is_public: true }), W1);
    at(memoryDb.createCard({ creator_id: a.id, is_public: false }), W1);
    draw(a.id, W1);

    const { totals, weekly } = computeAnalytics();
    expect(totals.users).toBe(2);
    expect(totals.circulating).toBe(42.5);
    expect(totals.totalCards).toBe(2);
    expect(totals.publicCards).toBe(1);
    expect(weekly.newUsers[K1]).toBe(1);
    expect(weekly.newUsers[K2]).toBe(1);
    expect(weekly.activeUsers[K1]).toBe(1);
  });

  test('empty database yields a well-formed, empty payload', () => {
    const out = computeAnalytics();
    expect(out.weeks).toEqual([]);
    expect(out.totals.users).toBe(0);
    expect(out.retention.cohorts).toEqual([]);
    expect(out.economy.cohorts).toEqual([]);
  });
});
