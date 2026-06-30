// File-backed JSON store. In-memory collections with write-through persistence
// to server/data/db.json. Tests (NODE_ENV=test) stay memory-only.
// A pg adapter can replace this behind the same API when DATABASE_URL is set up.
import fs from 'fs';
import path from 'path';

// Server runs from app/ (npm run server / server:dev); override with R5C_DATA_DIR.
const DATA_DIR = process.env.R5C_DATA_DIR || path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const IS_TEST = process.env.NODE_ENV === 'test';

const db = {
  cards: [],
  users: [],
  transactions: [],
  saves: [],
  counters: { card: 1, user: 1, txn: 1, save: 1 },
  // The cloud (system treasury). total_issued counts grants + yields,
  // total_absorbed counts save remainders + publish stakes.
  cloud: { total_issued: 0, total_absorbed: 0 }
};

let saveTimer = null;
const persistSoon = () => {
  if (IS_TEST) return;
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

const load = () => {
  if (IS_TEST || !fs.existsSync(DB_FILE)) return;
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const key of ['cards', 'users', 'transactions', 'saves']) {
      if (Array.isArray(loaded[key])) db[key] = loaded[key];
    }
    if (loaded.counters) db.counters = { ...db.counters, ...loaded.counters };
    if (loaded.cloud) db.cloud = { ...db.cloud, ...loaded.cloud };
  } catch (error) {
    console.error('Failed to load database file, starting empty:', error);
  }
};

const now = () => new Date().toISOString();

// Mock pool object kept for compatibility with the planned pg migration
const pool = {
  query: async () => ({ rows: [], rowCount: 0 }),
  end: async () => {}
};

const dbConfig = { type: 'json-file', file: DB_FILE };

const memoryDb = {
  // ---------- cards ----------
  createCard: (card) => {
    const newCard = {
      tier: card.tier || null,
      rarity_score: card.rarity_score ?? null,
      times_drawn: card.times_drawn || 0,
      times_saved: card.times_saved || 0,
      ...card,
      id: card.id || `card_${db.counters.card++}`,
      created_at: card.created_at || now(),
      updated_at: card.updated_at || now(),
      creator_id: card.creator_id || 'anonymous',
      is_public: card.is_public !== false,
      collection_count: card.collection_count || 0,
      tags: card.tags || []
    };
    db.cards.push(newCard);
    persistSoon();
    return newCard;
  },

  getAllCards: () => [...db.cards],

  getCardById: (id) => db.cards.find(card => card.id === id),

  updateCard: (id, updateData) => {
    const index = db.cards.findIndex(card => card.id === id);
    if (index !== -1) {
      db.cards[index] = { ...db.cards[index], ...updateData };
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
      id: user.id || `user_${db.counters.user++}`,
      balance: user.balance || 0,
      yield_today: 0,
      yield_day: null,
      created_at: now()
    };
    db.users.push(newUser);
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
      persistSoon();
      return db.users[index];
    }
    return null;
  },

  // ---------- transactions ----------
  createTransaction: (txn) => {
    const newTxn = {
      ...txn,
      id: `txn_${db.counters.txn++}`,
      created_at: now()
    };
    db.transactions.push(newTxn);
    persistSoon();
    return newTxn;
  },

  getTransactionsByUser: (userId) =>
    db.transactions.filter(t => t.user_id === userId).slice().reverse(),

  // ---------- saves (a user's collection of pool cards) ----------
  createSave: (save) => {
    const newSave = {
      ...save,
      id: `save_${db.counters.save++}`,
      created_at: now()
    };
    db.saves.push(newSave);
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
    db.counters = { card: 1, user: 1, txn: 1, save: 1 };
    db.cloud = { total_issued: 0, total_absorbed: 0 };
    persistSoon();
    return true;
  }
};

const testConnection = async () => {
  return true;
};

const initializeDatabase = async () => {
  load();
  console.log(`Database ready (${dbConfig.type}): ${db.cards.length} cards, ${db.users.length} users`);
  return true;
};

export { pool, dbConfig, testConnection, initializeDatabase, memoryDb };
