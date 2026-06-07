// Postgres (Neon) access. Uses the serverless driver over HTTP so it works in
// Vercel's serverless/edge functions. When DATABASE_URL is not set (e.g. local
// dev or this sandbox) the app falls back to seed data — see lib/projects.ts.
import { neon } from "@neondatabase/serverless";

export function isDbEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

// Lazily create the SQL tag so importing this module never throws when the
// connection string is absent.
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
