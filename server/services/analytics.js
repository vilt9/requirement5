// Public cohort analytics — a read-only roll-up over the working set.
//
// Nothing here writes; every number is derived by sweeping users, the ledger,
// saves, stars and cards and bucketing by ISO week. The output is aggregate
// counts only (cohort sizes, active counts, medians) — no per-user rows and no
// usernames — so the payload is safe to serve on a public page.
//
// Four views, all keyed off the week a person signed up (their "cohort"):
//   1. retention   — how many of each cohort come back and do *something* later
//   2. intensity   — same grid, but total actions (so the UI can show
//                    actions-per-active-member, not just alive/dead)
//   3. economy     — each cohort's balance health over time (median, % in debt)
//   4. segments    — retention split by behaviour: creators vs collectors
//
// "Real" users only: an unclaimed bot-gift account (bot_created && !claimed_at)
// is a seeded shell with no human behind it, so it would flatline every
// retention curve. Those are excluded from cohorts; a claimed gift account is a
// real person and stays in.
import { memoryDb } from '../config/database.js';
import { ECONOMY } from './economy.js';

const DAY_MS = 86400000;

// Ledger types that represent a deliberate user action. Draws are the only
// action with no table of their own, so they're read from the ledger; saves and
// card-creates are read from their own tables instead (a free save or free
// create writes no transaction), which is why 'save'/'create_stake' are absent
// here — counting them from both places would double-count.
const DRAW_TYPES = new Set(['draw_yield', 'claimed_yield']);

// ISO-8601 week key, e.g. "2026-W28". Weeks start Monday; the year is the one
// that owns the week's Thursday. Zero-padded so keys sort lexically in time
// order. UTC throughout so a visitor's timezone can't shift their cohort.
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;        // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);      // hop to this week's Thursday
  const thursday = d.getTime();
  d.setUTCMonth(0, 1);                            // Jan 1 of the week-owning year
  if (d.getUTCDay() !== 4) {
    d.setUTCMonth(0, 1 + ((4 - d.getUTCDay()) + 7) % 7); // → first Thursday
  }
  const week = 1 + Math.round((thursday - d.getTime()) / (7 * DAY_MS));
  return `${new Date(thursday).getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Every distinct ISO week from the earliest to the latest date, contiguous, so
// the cohort triangle has no gaps even in weeks where nothing happened. Steps a
// day at a time (cheap, and immune to week-boundary arithmetic).
function enumerateWeeks(minDate, maxDate) {
  if (!minDate || !maxDate || maxDate < minDate) return [];
  const weeks = [];
  const seen = new Set();
  let t = Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate());
  const end = maxDate.getTime();
  while (t <= end) {
    const w = isoWeek(new Date(t));
    if (!seen.has(w)) { seen.add(w); weeks.push(w); }
    t += DAY_MS;
  }
  return weeks;
}

const isRealUser = (u) => !(u.bot_created && !u.claimed_at);
const parseDate = (iso) => (iso ? new Date(iso) : null);

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Collect the raw activity stream: one { userId, week } per deliberate action,
// unioned across all sources with no double counting (see DRAW_TYPES note).
function collectActivity(txns, saves, stars, cards) {
  const events = [];
  const push = (userId, iso) => {
    if (!userId || userId === 'anonymous' || !iso) return;
    events.push({ userId, week: isoWeek(new Date(iso)) });
  };
  for (const t of txns) {
    if (DRAW_TYPES.has(t.type) || t.type === 'reroll') push(t.user_id, t.created_at);
  }
  for (const s of saves) push(s.user_id, s.created_at);
  for (const s of stars) push(s.user_id, s.created_at);
  for (const c of cards) push(c.creator_id, c.created_at);
  return events;
}

// Turn the flat event stream into per-user, per-week counts:
//   byUser.get(userId).get(week) -> number of actions that user took that week
function activityByUser(events) {
  const byUser = new Map();
  for (const e of events) {
    let weeks = byUser.get(e.userId);
    if (!weeks) { weeks = new Map(); byUser.set(e.userId, weeks); }
    weeks.set(e.week, (weeks.get(e.week) || 0) + 1);
  }
  return byUser;
}

// The retention/intensity triangle for a set of users. Each cohort reports its
// size (people who signed up that week) plus, per later week, how many were
// active (came back and did anything) and how many actions they took in total.
function buildCohorts(users, byUser) {
  const cohorts = new Map();
  for (const u of users) {
    const cohortWeek = isoWeek(new Date(u.created_at));
    let c = cohorts.get(cohortWeek);
    if (!c) { c = { cohort_week: cohortWeek, size: 0, active: {}, events: {} }; cohorts.set(cohortWeek, c); }
    c.size += 1;
    const weeks = byUser.get(u.id);
    if (!weeks) continue;
    for (const [week, count] of weeks) {
      if (week < cohortWeek) continue; // a stray pre-signup action can't retain a cohort
      c.active[week] = (c.active[week] || 0) + 1;
      c.events[week] = (c.events[week] || 0) + count;
    }
  }
  return [...cohorts.values()].sort((a, b) => (a.cohort_week < b.cohort_week ? -1 : 1));
}

// Reconstruct a user's end-of-week balance across the whole timeline by
// carrying the last recorded balance_after forward through quiet weeks.
// Returns Map week -> balance for every week from the user's first transaction.
function balanceTimeline(userTxns, weeks) {
  const lastByWeek = new Map();
  for (const t of userTxns) {
    if (typeof t.balance_after !== 'number') continue;
    lastByWeek.set(isoWeek(new Date(t.created_at)), t.balance_after); // asc order → last wins
  }
  const out = new Map();
  let carried = null;
  for (const w of weeks) {
    if (lastByWeek.has(w)) carried = lastByWeek.get(w);
    if (carried !== null) out.set(w, carried);
  }
  return out;
}

// Feature 3: each cohort's money health over time. For every week from the
// cohort's birth onward, take each member's carried balance and report the
// median, how many are underwater, and how many have hit the debt floor.
function buildEconomy(users, txns, weeks) {
  const txnsByUser = new Map();
  for (const t of txns) {
    let arr = txnsByUser.get(t.user_id);
    if (!arr) { arr = []; txnsByUser.set(t.user_id, arr); }
    arr.push(t);
  }
  for (const arr of txnsByUser.values()) {
    arr.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }

  const timelines = new Map();
  for (const u of users) timelines.set(u.id, balanceTimeline(txnsByUser.get(u.id) || [], weeks));

  const floorEdge = ECONOMY.DEBT_FLOOR + 1; // "at the floor" = within 1 of the hard limit
  const cohorts = new Map();
  for (const u of users) {
    const cohortWeek = isoWeek(new Date(u.created_at));
    let c = cohorts.get(cohortWeek);
    if (!c) { c = { cohort_week: cohortWeek, size: 0, members: [] }; cohorts.set(cohortWeek, c); }
    c.size += 1;
    c.members.push(u.id);
  }

  const result = [];
  for (const c of [...cohorts.values()].sort((a, b) => (a.cohort_week < b.cohort_week ? -1 : 1))) {
    const series = [];
    for (const w of weeks) {
      if (w < c.cohort_week) continue;
      const balances = [];
      for (const id of c.members) {
        const bal = timelines.get(id)?.get(w);
        if (typeof bal === 'number') balances.push(bal);
      }
      if (!balances.length) continue;
      series.push({
        week: w,
        members: balances.length,
        median: Math.round(median(balances) * 100) / 100,
        inDebt: balances.filter(b => b < 0).length,
        atFloor: balances.filter(b => b <= floorEdge).length
      });
    }
    result.push({ cohort_week: c.cohort_week, size: c.size, series });
  }
  return result;
}

// Feature 5: usage breakdown — three deliberate actions counted per week.
// Generate clicks split logged-in vs logged-out (user_id null); saves and
// card-creates come from their own tables. Every week key is present in all
// four series (0-filled) so the UI can render aligned columns.
function buildUsage(events, saves, cards, weeks) {
  const gen = { in: {}, out: {} };
  const savesByWeek = {};
  const created = {};
  for (const w of weeks) { gen.in[w] = 0; gen.out[w] = 0; savesByWeek[w] = 0; created[w] = 0; }

  for (const e of events) {
    if (e.type !== 'generate' || !e.created_at) continue;
    const w = isoWeek(new Date(e.created_at));
    if (!(w in gen.in)) continue;
    (e.user_id ? gen.in : gen.out)[w] += 1;
  }
  for (const s of saves) {
    if (!s.created_at) continue;
    const w = isoWeek(new Date(s.created_at));
    if (w in savesByWeek) savesByWeek[w] += 1;
  }
  for (const c of cards) {
    if (!c.created_at) continue;
    const w = isoWeek(new Date(c.created_at));
    if (w in created) created[w] += 1;
  }
  const total = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
  return {
    generate: { in: gen.in, out: gen.out },
    saves: savesByWeek,
    created,
    totals: {
      generateIn: total(gen.in),
      generateOut: total(gen.out),
      saves: total(savesByWeek),
      created: total(created)
    }
  };
}

export function computeAnalytics() {
  const allUsers = memoryDb.getAllUsers();
  const users = allUsers.filter(isRealUser);
  const txns = memoryDb.getAllTransactions();
  const saves = memoryDb.getAllSaves();
  const stars = memoryDb.getAllStars();
  const cards = memoryDb.getAllCards();
  const usageEvents = memoryDb.getAllEvents();
  const userIds = new Set(users.map(u => u.id));

  // --- timeline scaffold: the contiguous week axis every triangle aligns to ---
  const dates = [];
  for (const u of users) { const d = parseDate(u.created_at); if (d) dates.push(d); }
  for (const t of txns) { const d = parseDate(t.created_at); if (d) dates.push(d); }
  for (const c of cards) { const d = parseDate(c.created_at); if (d) dates.push(d); }
  for (const s of saves) { const d = parseDate(s.created_at); if (d) dates.push(d); }
  for (const s of stars) { const d = parseDate(s.created_at); if (d) dates.push(d); }
  for (const e of usageEvents) { const d = parseDate(e.created_at); if (d) dates.push(d); }
  const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  const weeks = enumerateWeeks(minDate, maxDate);

  // --- activity stream, shared by retention (1), intensity (2), segments (4) ---
  const events = collectActivity(txns, saves, stars, cards);
  const byUser = activityByUser(events);

  // --- behaviour segments: a creator has published a card; a collector has
  //     saved one but never created; everyone else is neither (feature 4) ---
  const creatorIds = new Set(cards.map(c => c.creator_id).filter(id => userIds.has(id)));
  const saverIds = new Set(saves.map(s => s.user_id).filter(id => userIds.has(id)));
  const creators = users.filter(u => creatorIds.has(u.id));
  const collectors = users.filter(u => saverIds.has(u.id) && !creatorIds.has(u.id));

  // --- banner: live top-line + per-week new/active for a sparkline ---
  const newUsers = {}, activeUsers = {}, cardsPerWeek = {};
  for (const u of users) {
    const w = isoWeek(new Date(u.created_at));
    newUsers[w] = (newUsers[w] || 0) + 1;
  }
  const activeSets = {};
  for (const e of events) {
    if (!userIds.has(e.userId)) continue;
    (activeSets[e.week] = activeSets[e.week] || new Set()).add(e.userId);
  }
  for (const w of Object.keys(activeSets)) activeUsers[w] = activeSets[w].size;
  for (const c of cards) {
    if (!c.created_at) continue;
    const w = isoWeek(new Date(c.created_at));
    cardsPerWeek[w] = (cardsPerWeek[w] || 0) + 1;
  }

  const cloud = memoryDb.getCloud();
  const circulating = Math.round(users.reduce((s, u) => s + (u.balance || 0), 0) * 100) / 100;
  const publicCards = cards.filter(c => c.is_public).length;

  return {
    generated: new Date().toISOString(),
    weeks,
    totals: {
      users: users.length,
      creators: creators.length,
      collectors: collectors.length,
      totalCards: cards.length,
      publicCards,
      circulating,
      cloudIssued: cloud.total_issued,
      cloudAbsorbed: cloud.total_absorbed
    },
    weekly: { newUsers, activeUsers, cards: cardsPerWeek },
    usage: buildUsage(usageEvents, saves, cards, weeks),
    retention: { cohorts: buildCohorts(users, byUser) },
    economy: { cohorts: buildEconomy(users, txns, weeks) },
    segments: {
      creator: { cohorts: buildCohorts(creators, byUser) },
      collector: { cohorts: buildCohorts(collectors, byUser) }
    }
  };
}
