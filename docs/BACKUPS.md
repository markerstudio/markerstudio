# Database backups & restore

Nightly encrypted dumps of the whole Postgres database, produced by
`.github/workflows/db-backup.yml` and stored as GitHub Actions artifacts for
30 days. This exists so a provider-side cutoff (like the July 2026 Neon
network-transfer suspension) can never hold the studio's data hostage again.

## One-time setup

In GitHub → repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | The Neon **unpooled/direct** connection string (Vercel → Storage → the database → `.env.local` tab → `DATABASE_URL_UNPOOLED`). |
| `BACKUP_PASSPHRASE` | Any long random string (e.g. `openssl rand -base64 32`). **Save it in a password manager** — without it, backups cannot be decrypted. The repo is public, so dumps are always encrypted before upload. |

Then run the workflow once by hand (Actions tab → *DB backup (nightly)* →
*Run workflow*) and check it goes green.

## Restoring

1. Download the newest `db-backup-…` artifact from the Actions tab and unzip
   it — inside is `marker-YYYY-MM-DD.dump.enc`.
2. Decrypt (uses the same passphrase as above):

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -pass pass:'YOUR_PASSPHRASE' \
     -in marker-2026-07-20.dump.enc -out marker.dump
   ```

3. Restore into any empty Postgres (Neon, Supabase, RDS, a VPS — anything):

   ```bash
   pg_restore --no-owner --no-privileges -d "$NEW_DATABASE_URL" marker.dump
   ```

4. Point the app at the new database: set `DATABASE_URL` in Vercel →
   Project → Settings → Environment Variables and redeploy. Verify with
   `/api/health`.

That's the whole disaster plan: decrypt, restore, repoint, redeploy.
