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

-- Short-lived client password-reset tokens (see lib/accounts.ts; created
-- automatically by ensureResetsTable). Mirrors the invite-link pattern.
CREATE TABLE IF NOT EXISTS password_resets (
  id          SERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  user_id     INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
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

-- Photo/video consent forms (see lib/consents.ts; created automatically by
-- ensureConsentSchema). A form is a shareable signing link; each person who
-- signs it becomes a consent_signatures row.
CREATE TABLE IF NOT EXISTS consent_forms (
  id          SERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  lang        TEXT NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Undo snapshots for destructive admin actions (see lib/undo.ts; created
-- automatically by ensureUndoTable). Deleted rows are stowed here as JSON so
-- the admin can undo right after; pruned after 24 hours.
CREATE TABLE IF NOT EXISTS undo_snapshots (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,                       -- client | invoice | project | user | inquiry | application
  label       TEXT NOT NULL DEFAULT '',            -- human-readable, shown in the undo banner
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- the deleted row(s)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_signatures (
  id          SERIAL PRIMARY KEY,
  form_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  contact     TEXT NOT NULL DEFAULT '',
  lang        TEXT NOT NULL DEFAULT 'en',
  signature   TEXT NOT NULL,  -- hand-drawn signature as a PNG data URL
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
