// Working set lives in memory (single Node process → synchronous reads/writes,
// so the economy's multi-step updates stay atomic). Persistence is pluggable:
//   - NODE_ENV=test        → memory only, no persistence
//   - DATABASE_URL set      → Postgres system-of-record (write-through, see pgStore.js)
//   - otherwise             → JSON file at server/data/db.json (local dev, no DB needed)
// Reads never hit the backend, so no call site changed when Postgres was added.
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
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
  // The cloud (system treasury). total_issued counts grants + yields,
  // total_absorbed counts save remainders + publish stakes.
  cloud: { total_issued: 0, total_absorbed: 0 }
};

// ---------- Postgres write-through bookkeeping ----------
// Track which rows changed since the last flush so we only upsert the deltas
// (transactions are append-only and unbounded — a full-snapshot flush would grow
// linearly). Counters + cloud are tiny and rewritten every flush.
const dirty = { cards: new Set(), users: new Set(), transactions: new Set(), saves: new Set() };
const removed = { cards: new Set(), users: new Set(), saves: new Set() };
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
    for (const key of ['cards', 'users', 'transactions', 'saves']) {
      if (Array.isArray(loaded[key])) db[key] = loaded[key];
    }
    if (loaded.cloud) db.cloud = { ...db.cloud, ...loaded.cloud };
  } catch (error) {
    console.error('Failed to load database file, starting empty:', error);
  }
};

const now = () => new Date().toISOString();

// Retained for import compatibility; real pooling lives in pgStore.js.
const pool = {
  query: async () => ({ rows: [], rowCount: 0 }),
  end: async () => {}
};

const dbConfig = { type: USE_PG ? 'postgres' : 'json-file', file: DB_FILE };

const memoryDb = {
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

  getCommunityCards: () => db.cards.filter(card => card.is_public),

  getPublishedCardsByTier: (tier) =>
    db.cards.filter(card => card.is_public && card.tier === tier),

  getRandomCommunityCard: () => {
    const publicCards = db.cards.filter(card => card.is_public);
    if (publicCards.length === 0) return null;
    return publicCards[Math.floor(Math.random() * publicCards.length)];
  },

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
    const publicCards = db.cards.filter(card => card.is_public);
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
      yield_today: 0,
      yield_day: null,
      created_at: now()
    };
    db.users.push(newUser);
    markDirty('users', newUser.id);
    persistSoon();
    return newUser;
  },

  getUserById: (id) => db.users.find(u => u.id === id),

  getUserByUsername: (username) =>
    db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase()),

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

  // ---------- cloud ----------
  getCloud: () => ({ ...db.cloud }),

  cloudIssue: (amount) => {
    db.cloud.total_issued = Math.round((db.cloud.total_issued + amount) * 10) / 10;
    persistSoon();
  },

  cloudAbsorb: (amount) => {
    db.cloud.total_absorbed = Math.round((db.cloud.total_absorbed + amount) * 10) / 10;
    persistSoon();
  },

  // ---------- admin ----------
  clearDatabase: () => {
    db.cards.length = 0;
    db.users.length = 0;
    db.transactions.length = 0;
    db.saves.length = 0;
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
