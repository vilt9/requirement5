// Working set lives in memory (single Node process → synchronous reads/writes,
// so the economy's multi-step updates stay atomic). Persistence is pluggable:
//   - NODE_ENV=test        → memory only, no persistence
//   - DATABASE_URL set      → Postgres system-of-record (write-through, see pgStore.js)
//   - otherwise             → JSON file at server/data/db.json (local dev, no DB needed)
// Reads never hit the backend, so no call site changed when Postgres was added.
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import process from 'node:process';
import {
  connect as pgConnect,
  ping as pgPing,
  ensureSchema as pgEnsureSchema,
  hydrate as pgHydrate,
  flush as pgFlush,
  close as pgClose
} from './pgStore.js';

// Server runs from app/ (npm run server / server:dev); override with R5C_DATA_DIR.
const DATA_DIR = process.env.R5C_DATA_DIR || path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const IS_TEST = process.env.NODE_ENV === 'test';
const DATABASE_URL = process.env.DATABASE_URL || null;
const USE_PG = !IS_TEST && !!DATABASE_URL;

const db = {
  cards: [],
  users: [],
  transactions: [],
  saves: [],
  // A user starring another user's collection (user_id starrer, owner_id owner).
  stars: [],
  // Named sets a creator groups their published cards into. id is the
  // namespaced name ("<username>_<label>"); cards point at one via set_id.
  sets: [],
  // Usage events (generate clicks). Append-only; user_id null when logged out.
  events: [],
  // User reports against a card (nudity, copyright, hate, …). Append-only; a
  // report also flips the card's moderation_status to 'flagged' (out of
  // circulation) pending admin review.
  reports: [],
  // In-progress rarity rolls (one active per user). Ephemeral — deliberately
  // NOT persisted: a restart just means designers re-roll. The server owns the
  // rolled rarity so neither the web nor the CLI can self-declare it.
  rolls: [],
  // The cloud (system treasury). total_issued counts grants + yields,
  // total_absorbed counts save remainders + publish stakes.
  cloud: { total_issued: 0, total_absorbed: 0 }
};

// ---------- Postgres write-through bookkeeping ----------
// Track which rows changed since the last flush so we only upsert the deltas
// (transactions are append-only and unbounded — a full-snapshot flush would grow
// linearly). Counters + cloud are tiny and rewritten every flush.
const dirty = { cards: new Set(), users: new Set(), transactions: new Set(), saves: new Set(), stars: new Set(), sets: new Set(), events: new Set(), reports: new Set() };
const removed = { cards: new Set(), users: new Set(), saves: new Set(), stars: new Set(), sets: new Set() };
let truncateRequested = false;

const markDirty = (table, id) => {
  if (!USE_PG) return;
  removed[table]?.delete(id);
  dirty[table].add(id);
};
const markRemoved = (table, id) => {
  if (!USE_PG) return;
  dirty[table].delete(id);
  removed[table].add(id);
};

let saveTimer = null;
let flushing = false;
let flushQueued = false;

const scheduleFlush = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(runFlush, 200);
};

const takeSnapshot = () => {
  const snap = { dirty: {}, removed: {}, truncate: truncateRequested };
  for (const t of Object.keys(dirty)) { snap.dirty[t] = dirty[t]; dirty[t] = new Set(); }
  for (const t of Object.keys(removed)) { snap.removed[t] = removed[t]; removed[t] = new Set(); }
  truncateRequested = false;
  return snap;
};

const requeue = (snap) => {
  for (const t of Object.keys(snap.dirty)) for (const id of snap.dirty[t]) dirty[t].add(id);
  for (const t of Object.keys(snap.removed)) for (const id of snap.removed[t]) removed[t].add(id);
  if (snap.truncate) truncateRequested = true;
};

const runFlush = async () => {
  if (flushing) { flushQueued = true; return; }
  flushing = true;
  const snap = takeSnapshot();
  try {
    await pgFlush({ db, ...snap });
  } catch (error) {
    console.error('Postgres flush failed, will retry:', error.message);
    requeue(snap);
    flushQueued = true;
  } finally {
    flushing = false;
    if (flushQueued) { flushQueued = false; scheduleFlush(); }
  }
};

// ---------- JSON file persistence (local dev) ----------
const persistFile = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db));
    } catch (error) {
      console.error('Failed to persist database:', error);
    }
  }, 200);
};

const persistSoon = () => {
  if (IS_TEST) return;
  if (USE_PG) return scheduleFlush();
  persistFile();
};

const load = () => {
  if (IS_TEST || !fs.existsSync(DB_FILE)) return;
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const key of ['cards', 'users', 'transactions', 'saves', 'stars', 'sets', 'events', 'reports']) {
      if (Array.isArray(loaded[key])) db[key] = loaded[key];
    }
    if (loaded.cloud) db.cloud = { ...db.cloud, ...loaded.cloud };
  } catch (error) {
    console.error('Failed to load database file, starting empty:', error);
  }
};

const now = () => new Date().toISOString();

// A published card is "in circulation" — eligible for the pool, draws, the
// tag/set walls, and saving — only while its moderation_status is clear. A user
// report flips it to 'flagged'; an admin can 'remove' it. Drafts (is_public
// false) are never in circulation regardless. Cards minted before this field
// existed have no moderation_status, which reads as clear.
const inCirculation = (card) =>
  !!card && card.is_public &&
  card.moderation_status !== 'flagged' && card.moderation_status !== 'removed';

// Retained for import compatibility; real pooling lives in pgStore.js.
const pool = {
  query: async () => ({ rows: [], rowCount: 0 }),
  end: async () => {}
};

const dbConfig = { type: USE_PG ? 'postgres' : 'json-file', file: DB_FILE };

const memoryDb = {
  // Run a synchronous group of mutations as one in-memory unit. Persistence is
  // debounced, so a thrown error can restore both the working data and the
  // Postgres dirty bookkeeping before any backend flush observes partial state.
  atomic: (work) => {
    // The store is JSON-shaped by design; a JSON round-trip also works in the
    // Jest/jsdom environment where the Node structuredClone global is absent.
    const dataSnapshot = JSON.parse(JSON.stringify(db));
    const dirtySnapshot = Object.fromEntries(
      Object.entries(dirty).map(([table, ids]) => [table, new Set(ids)])
    );
    const removedSnapshot = Object.fromEntries(
      Object.entries(removed).map(([table, ids]) => [table, new Set(ids)])
    );
    const truncateSnapshot = truncateRequested;

    try {
      return work();
    } catch (error) {
      for (const key of Object.keys(db)) db[key] = dataSnapshot[key];
      for (const table of Object.keys(dirty)) dirty[table] = dirtySnapshot[table];
      for (const table of Object.keys(removed)) removed[table] = removedSnapshot[table];
      truncateRequested = truncateSnapshot;
      persistSoon();
      throw error;
    }
  },

  // ---------- cards ----------
  createCard: (card) => {
    const newCard = {
      tier: card.tier || null,
      rarity_score: card.rarity_score ?? null,
      times_drawn: card.times_drawn || 0,
      times_saved: card.times_saved || 0,
      ...card,
      id: card.id || crypto.randomUUID(),
      created_at: card.created_at || now(),
      updated_at: card.updated_at || now(),
      creator_id: card.creator_id || 'anonymous',
      is_public: card.is_public !== false,
      collection_count: card.collection_count || 0,
      tags: card.tags || []
    };
    db.cards.push(newCard);
    markDirty('cards', newCard.id);
    persistSoon();
    return newCard;
  },

  getAllCards: () => [...db.cards],

  getCardById: (id) => db.cards.find(card => card.id === id),

  updateCard: (id, updateData) => {
    const index = db.cards.findIndex(card => card.id === id);
    if (index !== -1) {
      db.cards[index] = { ...db.cards[index], ...updateData };
      markDirty('cards', id);
      persistSoon();
      return db.cards[index];
    }
    return null;
  },

  deleteCard: (id) => {
    const index = db.cards.findIndex(card => card.id === id);
    if (index !== -1) {
      const deletedCard = db.cards[index];
      db.cards.splice(index, 1);
      markRemoved('cards', id);
      persistSoon();
      return deletedCard;
    }
    return null;
  },

  searchCards: (property, value) => {
    return db.cards.filter(card => {
      if (property === 'creator_id') return card.creator_id === value;
      if (property === 'is_public') return card.is_public === (value === 'true');
      if (property === 'tags') return card.tags && card.tags.includes(value);
      if (card.state_data && card.state_data[property]) {
        return String(card.state_data[property]).includes(value);
      }
      return false;
    });
  },

  // Public reads exclude anything out of circulation (flagged/removed) so a
  // reported card vanishes from the pool, draws, and tag/set walls at once.
  getCommunityCards: () => db.cards.filter(inCirculation),

  getPublishedCardsByTier: (tier) =>
    db.cards.filter(card => inCirculation(card) && card.tier === tier),

  getRandomCommunityCard: () => {
    const publicCards = db.cards.filter(inCirculation);
    if (publicCards.length === 0) return null;
    return publicCards[Math.floor(Math.random() * publicCards.length)];
  },

  // Cards taken out of circulation by a report, for the admin review queue.
  getFlaggedCards: () => db.cards.filter(c => c.moderation_status === 'flagged'),

  isCirculating: (card) => inCirculation(card),

  incrementCollectionCount: (cardId) => {
    const card = db.cards.find(c => c.id === cardId);
    if (card) {
      card.collection_count = (card.collection_count || 0) + 1;
      card.updated_at = now();
      markDirty('cards', cardId);
      persistSoon();
      return card;
    }
    return null;
  },

  incrementCardCounter: (cardId, field) => {
    const card = db.cards.find(c => c.id === cardId);
    if (card) {
      card[field] = (card[field] || 0) + 1;
      card.updated_at = now();
      markDirty('cards', cardId);
      persistSoon();
      return card;
    }
    return null;
  },

  getCommunityStats: () => {
    const publicCards = db.cards.filter(inCirculation);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return {
      totalCards: publicCards.length,
      activeCreators: new Set(publicCards.map(card => card.creator_id)).size,
      recentActivity: publicCards.filter(card => new Date(card.created_at) >= oneDayAgo).length,
      totalCollections: publicCards.reduce((sum, card) => sum + (card.collection_count || 0), 0)
    };
  },

  // ---------- users ----------
  createUser: (user) => {
    const newUser = {
      ...user,
      id: user.id || crypto.randomUUID(),
      balance: user.balance || 0,
      created_at: now()
    };
    db.users.push(newUser);
    markDirty('users', newUser.id);
    persistSoon();
    return newUser;
  },

  getUserById: (id) => db.users.find(u => u.id === id),

  // A card enriched for public display. Cards store only the creator's uuid and a
  // set_id; a viewer needs the human username and the set's label. Returns a
  // shallow copy — the stored record is never mutated.
  withCreatorAndSet: (card) => {
    if (!card) return card;
    const creator = card.creator_id && card.creator_id !== 'cloud'
      ? db.users.find(u => u.id === card.creator_id)
      : null;
    const set = card.set_id ? db.sets.find(s => s.id === card.set_id) : null;
    return {
      ...card,
      creator_username: creator?.username || null,
      set: set ? { id: set.id, label: set.label, info: set.info || null } : null
    };
  },

  getUserByUsername: (username) =>
    db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase()),

  getUserByEmail: (email) =>
    email ? db.users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase()) : undefined,

  getUserByClaimToken: (token) =>
    token ? db.users.find(u => u.claim_token && u.claim_token === token) : undefined,

  updateUser: (id, updateData) => {
    const index = db.users.findIndex(u => u.id === id);
    if (index !== -1) {
      db.users[index] = { ...db.users[index], ...updateData };
      markDirty('users', id);
      persistSoon();
      return db.users[index];
    }
    return null;
  },

  // ---------- transactions ----------
  createTransaction: (txn) => {
    const newTxn = {
      ...txn,
      id: crypto.randomUUID(),
      created_at: now()
    };
    db.transactions.push(newTxn);
    markDirty('transactions', newTxn.id);
    persistSoon();
    return newTxn;
  },

  getTransactionsByUser: (userId) =>
    db.transactions.filter(t => t.user_id === userId).slice().reverse(),

  // Whole-collection reads — used by the public analytics roll-up, which needs
  // to sweep every row rather than a single user's slice. Copies so callers
  // can't mutate the working set.
  getAllUsers: () => [...db.users],
  getAllTransactions: () => [...db.transactions],
  getAllSaves: () => [...db.saves],
  getAllStars: () => [...db.stars],

  // ---------- events (usage: generate clicks) ----------
  createEvent: (event) => {
    const newEvent = {
      user_id: null,
      ...event,
      id: crypto.randomUUID(),
      created_at: now()
    };
    db.events.push(newEvent);
    markDirty('events', newEvent.id);
    persistSoon();
    return newEvent;
  },
  getAllEvents: () => [...db.events],

  // ---------- reports (user flags against a card) ----------
  createReport: (report) => {
    const newReport = {
      status: 'open',
      reporter_id: null,
      detail: null,
      ...report,
      id: crypto.randomUUID(),
      created_at: now()
    };
    db.reports.push(newReport);
    markDirty('reports', newReport.id);
    persistSoon();
    return newReport;
  },
  getAllReports: () => [...db.reports],
  getReportsForCard: (cardId) => db.reports.filter(r => r.card_id === cardId),
  // Mark every open report on a card resolved (called when an admin acts on it).
  resolveReportsForCard: (cardId, resolution) => {
    for (const r of db.reports) {
      if (r.card_id === cardId && r.status === 'open') {
        r.status = resolution || 'resolved';
        r.resolved_at = now();
        markDirty('reports', r.id);
      }
    }
    persistSoon();
  },

  // ---------- saves (a user's collection of pool cards) ----------
  createSave: (save) => {
    const newSave = {
      ...save,
      id: crypto.randomUUID(),
      created_at: now()
    };
    db.saves.push(newSave);
    markDirty('saves', newSave.id);
    persistSoon();
    return newSave;
  },

  getSavesByUser: (userId) => db.saves.filter(s => s.user_id === userId),

  getSave: (userId, cardId) =>
    db.saves.find(s => s.user_id === userId && s.card_id === cardId),

  deleteSave: (userId, cardId) => {
    const index = db.saves.findIndex(s => s.user_id === userId && s.card_id === cardId);
    if (index !== -1) {
      const deleted = db.saves[index];
      db.saves.splice(index, 1);
      markRemoved('saves', deleted.id);
      persistSoon();
      return deleted;
    }
    return null;
  },

  // Owners of collections with more than `min` saved cards — the pool the
  // "Discover collections" strip samples from. Returns [{ userId, count }].
  getCollectionOwners: (min = 0) => {
    const counts = new Map();
    for (const s of db.saves) counts.set(s.user_id, (counts.get(s.user_id) || 0) + 1);
    return [...counts.entries()]
      .filter(([, count]) => count > min)
      .map(([userId, count]) => ({ userId, count }));
  },

  // ---------- stars (a user starring another user's collection) ----------
  createStar: (userId, ownerId) => {
    const existing = db.stars.find(s => s.user_id === userId && s.owner_id === ownerId);
    if (existing) return existing;
    const star = { id: crypto.randomUUID(), user_id: userId, owner_id: ownerId, created_at: now() };
    db.stars.push(star);
    markDirty('stars', star.id);
    persistSoon();
    return star;
  },

  getStar: (userId, ownerId) =>
    db.stars.find(s => s.user_id === userId && s.owner_id === ownerId),

  deleteStar: (userId, ownerId) => {
    const index = db.stars.findIndex(s => s.user_id === userId && s.owner_id === ownerId);
    if (index === -1) return null;
    const [deleted] = db.stars.splice(index, 1);
    markRemoved('stars', deleted.id);
    persistSoon();
    return deleted;
  },

  countStarsForOwner: (ownerId) => db.stars.filter(s => s.owner_id === ownerId).length,

  getStarsByUser: (userId) => db.stars.filter(s => s.user_id === userId),

  // ---------- sets (named groupings of a creator's published cards) ----------
  // The id IS the namespaced name ("<username>_<label>") — see utils/setName.js.
  getSetById: (id) => db.sets.find(s => s.id === id),

  getSetsByOwner: (ownerId) =>
    db.sets.filter(s => s.owner_id === ownerId).sort((a, b) => a.id.localeCompare(b.id)),

  // Create-or-update by name. `info` only overwrites when a non-null value is
  // given, so publishing into an existing set without retyping its info keeps
  // the info the set already had.
  upsertSet: ({ id, owner_id, label, info }) => {
    const existing = db.sets.find(s => s.id === id);
    if (existing) {
      if (info != null && info !== existing.info) {
        existing.info = info;
        existing.updated_at = now();
        markDirty('sets', existing.id);
        persistSoon();
      }
      return existing;
    }
    const set = {
      id,
      owner_id,
      label,
      info: info ?? null,
      created_at: now(),
      updated_at: now()
    };
    db.sets.push(set);
    markDirty('sets', set.id);
    persistSoon();
    return set;
  },

  // Published cards only — a set groups what's in the pool, so a private draft
  // must not inflate the count (it would read as "my publish landed" when it
  // hasn't). Drafts still carry set_id and join the count once released.
  countCardsInSet: (setId) => db.cards.filter(c => c.set_id === setId && c.is_public).length,

  // ---------- rolls (in-progress rarity gamble; ephemeral, not persisted) ----
  createRoll: (roll) => {
    const newRoll = {
      rerolls: 0,
      committed: false,
      ...roll,
      id: roll.id || crypto.randomUUID(),
      created_at: now(),
      updated_at: now()
    };
    db.rolls.push(newRoll);
    return newRoll;
  },

  getRollById: (id) => db.rolls.find(r => r.id === id),

  // The user's single active (unconsumed) roll, if any.
  getActiveRollByUser: (userId) => db.rolls.find(r => r.user_id === userId),

  updateRoll: (id, updateData) => {
    const index = db.rolls.findIndex(r => r.id === id);
    if (index === -1) return null;
    db.rolls[index] = { ...db.rolls[index], ...updateData, updated_at: now() };
    return db.rolls[index];
  },

  deleteRoll: (id) => {
    const index = db.rolls.findIndex(r => r.id === id);
    if (index === -1) return null;
    const [deleted] = db.rolls.splice(index, 1);
    return deleted;
  },

  // ---------- cloud ----------
  getCloud: () => ({ ...db.cloud }),

  cloudIssue: (amount) => {
    db.cloud.total_issued = Math.round((db.cloud.total_issued + amount) * 1e6) / 1e6;
    persistSoon();
  },

  cloudAbsorb: (amount) => {
    db.cloud.total_absorbed = Math.round((db.cloud.total_absorbed + amount) * 1e6) / 1e6;
    persistSoon();
  },

  // ---------- admin ----------
  clearDatabase: () => {
    db.cards.length = 0;
    db.users.length = 0;
    db.transactions.length = 0;
    db.saves.length = 0;
    db.stars.length = 0;
    db.sets.length = 0;
    db.events.length = 0;
    db.reports.length = 0;
    db.rolls.length = 0;
    db.cloud = { total_issued: 0, total_absorbed: 0 };
    if (USE_PG) {
      truncateRequested = true;
      for (const t of Object.keys(dirty)) dirty[t].clear();
      for (const t of Object.keys(removed)) removed[t].clear();
    }
    persistSoon();
    return true;
  }
};

const testConnection = async () => {
  if (!USE_PG) return true;
  try {
    pgConnect(DATABASE_URL);
    await pgPing();
    return true;
  } catch (error) {
    console.error('Postgres connection failed:', error.message);
    return false;
  }
};

const initializeDatabase = async () => {
  if (USE_PG) {
    await pgEnsureSchema();
    await pgHydrate(db);
  } else {
    load();
  }
  console.log(`Database ready (${dbConfig.type}): ${db.cards.length} cards, ${db.users.length} users`);
  return true;
};

// Flush any pending write-through and close the pool (graceful shutdown).
const shutdownDatabase = async () => {
  if (!USE_PG) return;
  clearTimeout(saveTimer);
  await runFlush();
  if (flushQueued) { flushQueued = false; await runFlush(); }
  await pgClose();
};

export { pool, dbConfig, testConnection, initializeDatabase, shutdownDatabase, memoryDb };
