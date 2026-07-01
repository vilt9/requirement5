-- R5c persistence schema (Postgres system-of-record).
--
-- The app keeps its working set in memory (single Node process, synchronous,
-- atomic economy) and write-throughs to these tables. Rows are stored as JSONB
-- documents so the in-memory shape round-trips without column-mapping drift; the
-- generated columns exist only so ops can query/index common fields from psql.
--
-- Apply manually with:  psql "$DATABASE_URL" -f server/config/schema.sql
-- (the server also runs this idempotently on startup when DATABASE_URL is set).

CREATE TABLE IF NOT EXISTS cards (
  id          text  PRIMARY KEY,
  data        jsonb NOT NULL,
  creator_id  text  GENERATED ALWAYS AS (data ->> 'creator_id') STORED,
  is_public   boolean GENERATED ALWAYS AS ((data ->> 'is_public')::boolean) STORED
);
CREATE INDEX IF NOT EXISTS cards_creator_idx ON cards (creator_id);
CREATE INDEX IF NOT EXISTS cards_public_idx  ON cards (is_public);

CREATE TABLE IF NOT EXISTS users (
  id        text PRIMARY KEY,
  data      jsonb NOT NULL,
  username  text GENERATED ALWAYS AS (data ->> 'username') STORED
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS transactions (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  user_id  text GENERATED ALWAYS AS (data ->> 'user_id') STORED
);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id);

CREATE TABLE IF NOT EXISTS saves (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  user_id  text GENERATED ALWAYS AS (data ->> 'user_id') STORED,
  card_id  text GENERATED ALWAYS AS (data ->> 'card_id') STORED
);
CREATE INDEX IF NOT EXISTS saves_user_idx ON saves (user_id);

-- Small key/value rows for the counters and the cloud (system treasury).
CREATE TABLE IF NOT EXISTS singletons (
  key   text PRIMARY KEY,
  data  jsonb NOT NULL
);
