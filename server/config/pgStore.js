// Postgres system-of-record for the in-memory store. The app reads/writes an
// in-memory working set (see database.js); this module hydrates that set from
// Postgres on startup and write-throughs mutations. Only engaged when
// DATABASE_URL is set — local dev stays on the JSON file store.
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

// Server runs from app/ (npm run server), matching the R5C_DATA_DIR convention.
const SCHEMA_FILE = path.join(process.cwd(), 'server', 'config', 'schema.sql');

let pool = null;

export const getPool = () => pool;

// Create the connection pool (idempotent). Called before the first query.
export const connect = (databaseUrl) => {
  if (!pool) pool = new Pool({ connectionString: databaseUrl, max: 4 });
  return pool;
};

export const ping = async () => {
  await pool.query('SELECT 1');
  return true;
};

// Apply the schema (idempotent — every statement is IF NOT EXISTS).
export const ensureSchema = async () => {
  const ddl = fs.readFileSync(SCHEMA_FILE, 'utf8');
  await pool.query(ddl);
};

// Load all rows into the shared in-memory db object.
export const hydrate = async (db) => {
  const rows = async (table) => (await pool.query(`SELECT data FROM ${table}`)).rows.map(r => r.data);
  db.cards = await rows('cards');
  db.users = await rows('users');
  db.transactions = await rows('transactions');
  db.saves = await rows('saves');
  db.stars = await rows('stars');
  db.sets = await rows('sets');
  db.events = await rows('events');

  const singles = (await pool.query('SELECT key, data FROM singletons')).rows;
  for (const { key, data } of singles) {
    if (key === 'cloud') db.cloud = { ...db.cloud, ...data };
  }
};

const upsert = (client, table, id, row) =>
  client.query(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [id, JSON.stringify(row)]
  );

// Write-through the pending changes in one transaction. `dirty`/`removed` are
// { table: Set<id> }; `truncate` wipes everything first (admin clear). Counters
// and cloud are tiny, so they're rewritten every flush rather than tracked.
export const flush = async ({ db, dirty, removed, truncate }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (truncate) {
      await client.query('TRUNCATE cards, users, transactions, saves, stars, sets, events, singletons');
    } else {
      for (const [table, ids] of Object.entries(removed)) {
        for (const id of ids) await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      }
    }

    const source = {
      cards: db.cards,
      users: db.users,
      transactions: db.transactions,
      saves: db.saves,
      stars: db.stars,
      sets: db.sets,
      events: db.events
    };
    for (const [table, ids] of Object.entries(dirty)) {
      const list = source[table];
      for (const id of ids) {
        const row = list.find(x => x.id === id);
        if (row) await upsert(client, table, id, row);
      }
    }

    await client.query(
      `INSERT INTO singletons (key, data) VALUES ('cloud', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(db.cloud)]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const close = async () => {
  if (pool) await pool.end();
  pool = null;
};
