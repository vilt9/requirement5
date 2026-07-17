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

-- A user starring another user's collection. user_id is the starrer, owner_id
-- is the collection owner. Powers "Discover collections" star counts.
CREATE TABLE IF NOT EXISTS stars (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  user_id  text GENERATED ALWAYS AS (data ->> 'user_id') STORED,
  owner_id text GENERATED ALWAYS AS (data ->> 'owner_id') STORED
);
CREATE INDEX IF NOT EXISTS stars_user_idx  ON stars (user_id);
CREATE INDEX IF NOT EXISTS stars_owner_idx ON stars (owner_id);

-- A named set a creator groups their published cards into. The id IS the
-- namespaced name ("<username>_<label>"), so it's unique across the app for
-- free — usernames are already unique. owner_id is the creator; cards point at
-- a set by id (cards.data ->> 'set_id'). Set info lives here, once, so editing
-- it updates every card in the set.
CREATE TABLE IF NOT EXISTS sets (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  owner_id text GENERATED ALWAYS AS (data ->> 'owner_id') STORED
);
CREATE INDEX IF NOT EXISTS sets_owner_idx ON sets (owner_id);

-- Small key/value rows for the counters and the cloud (system treasury).
CREATE TABLE IF NOT EXISTS singletons (
  key   text PRIMARY KEY,
  data  jsonb NOT NULL
);

-- Lightweight usage events (generate clicks). Append-only, like transactions.
-- user_id is null for logged-out visitors — that's how the analytics roll-up
-- splits logged-in from logged-out usage.
CREATE TABLE IF NOT EXISTS events (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  type     text GENERATED ALWAYS AS (data ->> 'type') STORED,
  user_id  text GENERATED ALWAYS AS (data ->> 'user_id') STORED
);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);

-- User reports against a card (nudity, copyright, hate, …). Append-only. A
-- report also flips the reported card's data ->> 'moderation_status' to
-- 'flagged' (out of circulation) pending admin review at /admin.
CREATE TABLE IF NOT EXISTS reports (
  id       text PRIMARY KEY,
  data     jsonb NOT NULL,
  card_id  text GENERATED ALWAYS AS (data ->> 'card_id') STORED,
  status   text GENERATED ALWAYS AS (data ->> 'status') STORED
);
CREATE INDEX IF NOT EXISTS reports_card_idx   ON reports (card_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
