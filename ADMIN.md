# Marker Studio — Admin panel

A database-backed admin for managing the work / case-study projects, with login.

- **Public site** reads projects from the database (with ISR, 30s). If
  `DATABASE_URL` is **not** set, it falls back to the seed data in
  `lib/projects.ts`, so the site always builds and runs.
- **Admin** lives at `/admin` (login at `/admin/login`), guarded by
  `middleware.ts`. Sessions are signed JWTs in an httpOnly cookie; passwords are
  bcrypt-hashed.

## Stack
- **DB:** Postgres (Neon / Vercel Postgres) via `@neondatabase/serverless`.
- **Auth:** `jose` (session JWT) + `bcryptjs` (password hashing). User accounts
  live in the `users` table.

## One-time setup

1. **Create a database.** In Vercel → Storage, add **Postgres** (Neon), or create
   a free project at neon.tech. Copy the **pooled** connection string.

2. **Set environment variables** (Vercel → Settings → Environment Variables, and
   `.env.local` for local dev) — see `.env.example`:
   - `DATABASE_URL` — the Postgres connection string
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `SETUP_SECRET` — any long random string (used once, then delete it)

3. **Deploy** (or run `npm run dev` locally with the vars set).

4. **Initialise** — creates the tables, your first admin user, and imports the
   5 seed projects:
   ```bash
   curl -X POST https://YOUR-SITE/api/setup \
     -H "x-setup-secret: $SETUP_SECRET" \
     -H "content-type: application/json" \
     -d '{"email":"you@marker.ps","password":"your-strong-password","name":"Elias"}'
   ```
   (Tables can also be created manually from `db/schema.sql`.)

5. **Remove `SETUP_SECRET`** from the environment so the route can't be re-run.

6. Visit **`/admin`**, log in, and manage projects.

## Adding more admin users
The first user is created by `/api/setup`. To add more, either insert into the
`users` table directly (bcrypt the password) or ask me to add a small
"invite/add user" screen — say the word and I'll build it.

## Notes / next steps
- **Image uploads:** projects currently reference image **URLs** (logo + gallery).
  File uploads need a blob store (e.g. Vercel Blob) — easy to add later.
- **Metrics:** the per-project metrics strip is supported by the data model and
  the page, but isn't in the admin form yet (kept v1 lean). Can be added.
- I can't connect to a live database from the build sandbox, so the DB/auth
  flow above was implemented and type-checked but verified against Postgres only
  in your environment. Ping me if anything errors on first setup.
