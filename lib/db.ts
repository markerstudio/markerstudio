// Postgres (Neon) access. Uses the serverless driver over HTTP so it works in
// Vercel's serverless/edge functions. When no connection string is configured
// (e.g. local dev or this sandbox) the app falls back to seed data — see
// lib/projects.ts.
import { neon, neonConfig } from "@neondatabase/serverless";

// Local end-to-end testing: point the driver's HTTP endpoint at a plain
// Postgres via a tiny shim (never set in production).
if (process.env.NEON_LOCAL_HTTP) {
  neonConfig.fetchEndpoint = process.env.NEON_LOCAL_HTTP;
}

// Accept whichever variable the host set — Vercel's native Postgres/Neon
// integration may expose DATABASE_URL or POSTGRES_URL (and unpooled variants).
function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

export function isDbEnabled(): boolean {
  return !!connectionString();
}

// Lazily create the SQL tag so importing this module never throws when the
// connection string is absent. `cache: "no-store"` matters: Next patches the
// global fetch the driver uses, and without it query responses can be served
// from Next's fetch cache — stale reads, and a dead database that still
// "answers".
export function getSql() {
  const url = connectionString();
  if (!url) throw new Error("No database connection string is set (DATABASE_URL / POSTGRES_URL)");
  return neon(url, { fetchOptions: { cache: "no-store" } });
}
