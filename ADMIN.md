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

## Meta (Facebook + Instagram) live data

Each client's portal Analysis tab can show **live** Instagram + Facebook
insights and ad-campaign performance, pulled from the Meta Graph API.

### One-click: Continue with Facebook (recommended)

Set **`META_APP_ID`** and **`META_APP_SECRET`** (create an app at
developers.facebook.com → add the **Facebook Login** product → register
`https://YOUR-SITE/api/meta/callback` under **Valid OAuth Redirect URIs**).

Then, per client, on **Admin → Clients → (client) → Meta**, click **Continue
with Facebook**, authorize, and pick the Page (and optionally an ad account).
The app captures a **long-lived Page token** and discovers the Instagram +
ad-account IDs automatically — no copying tokens by hand. The token is stored
server-side in `client_meta` and **never sent to the client's browser**.

Finally click **Pull from Meta** to load a snapshot; after that the portal also
refreshes live on view (cached ~15 min).

### Manual fallback

If you'd rather not set up the app, expand **Enter IDs manually instead** and
paste the **Facebook Page ID**, **Instagram Business ID**, **Ad Account ID**
(`act_…`), and a **long-lived Page access token**.

## AI reading (Analysis tab)

Set **`ANTHROPIC_API_KEY`** (from console.anthropic.com) and a **"Generate with
AI"** button appears at the top of each client's **Analysis** tab. It sends the
client's own numbers (organic metrics, paid campaigns, social cadence, plan,
finance) to **Claude Opus 4.8**, which writes a sharp, bilingual (EN/AR)
strategic reading — headline, summary, three insights, and next steps — stored
on the portal and shown to the client. Click **Regenerate** to refresh it after
new data lands. Without the key the button is inert and nothing AI shows.

The token needs `read_insights`, `instagram_basic`,
`instagram_manage_insights`, `pages_read_engagement`, and `ads_read`. Metric
names/periods vary by Graph API version — the mapping is defensive (a missing
metric is skipped, never fatal) and falls back to the manually-entered metrics.
Set `META_GRAPH_VERSION` to override the API version. Implemented and
type-checked here, but verify against your live Pages — tell me which metrics
you want surfaced and I'll tune the mapping.

## Sign-in: saved email, password autofill & Face ID / Touch ID

Three sign-in improvements (all on the shared `/login` screen):

- **Email is remembered.** The last email used to sign in is saved in the
  browser's `localStorage` and pre-filled next time, so nobody retypes it on
  every visit. Sessions already last 30 days (`lib/auth.ts`), so a normal
  refresh keeps you signed in.
- **Apple Passwords / Keychain.** The email field is marked
  `autocomplete="username"` and the password field `current-password`, the pair
  macOS (and 1Password/Chrome/etc.) look for to offer to **save** and
  **autofill** the login — including inside the Mac app's window.
- **Biometric sign-in.** Two complementary paths:
  - **In a browser (Safari/Chrome):** add a **passkey** from **Face ID / Touch
    ID** in the header (admin) or portal sidebar (clients) → `/account/security`.
    The login screen then shows **“Sign in with Face ID / Touch ID.”** The
    biometric unlocks a private key that never leaves the device; we only store
    the public key in `webauthn_credentials` (created on first use). Password
    sign-in stays as the fallback.
  - **In the Mac app:** the app itself is **locked behind the Mac's Touch ID /
    Face ID on every launch** (native, in `desktop/src-tauri/src/lib.rs`) — the
    window stays hidden until the device owner authenticates. Web passkeys are
    hidden inside the app (the WKWebView can't use them unless the app is
    code-signed and domain-associated), so the native unlock is the biometric
    there. If the Mac has no biometrics enrolled, the app opens normally rather
    than locking anyone out. See `desktop/README.md`.

WebAuthn’s domain (`rpID`) and origin are derived from the request, so this
works on `localhost` in dev and on `marker.ps` in production; override with
`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` if ever needed. Passkeys require
`DATABASE_URL`; without it the page explains they're unavailable and password
login is unaffected. Built and type-checked here — verify the biometric prompt
on a real Touch ID / Face ID device, since that can't be exercised in the build
sandbox.
