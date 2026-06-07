-- Marker Studio admin schema (Postgres / Neon).
-- /api/setup creates these automatically; this file is for manual setup or
-- reference. Run it once against your database (e.g. in the Neon SQL editor).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Admin',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  color       TEXT NOT NULL DEFAULT '#303030',
  logo        TEXT NOT NULL DEFAULT '',
  year        TEXT NOT NULL DEFAULT '',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- bilingual fields (name, tag, services, ...)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
