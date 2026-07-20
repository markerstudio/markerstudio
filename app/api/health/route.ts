// Public outage-diagnosis endpoint: GET /api/health answers "which piece is
// broken?" from any browser, with no sign-in — exactly what you need when the
// admin shows only "a server-side exception has occurred" and the logs are a
// dashboard away. Reports whether the critical env vars are present and
// whether the database actually answers a query. No secrets ever leave: env
// vars are reported as booleans and error text is stripped of anything that
// looks like a connection string.
import { NextResponse } from "next/server";
import { getSql, isDbEnabled } from "@/lib/db";
import { snapshotStatus } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

// postgres://user:password@host/db (or any scheme://…@) → keep only the host.
function redact(message: string): string {
  return message.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s@]*@([^\s/]+)[^\s]*/gi, "<connection string to $1>");
}

export async function GET() {
  const env = {
    DATABASE_URL: isDbEnabled(),
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
  };

  let db: { ok: boolean; ms?: number; error?: string };
  if (!env.DATABASE_URL) {
    db = { ok: false, error: "DATABASE_URL is not set" };
  } else {
    const t0 = Date.now();
    try {
      await getSql()`SELECT 1`;
      db = { ok: true, ms: Date.now() - t0 };
    } catch (err) {
      db = { ok: false, ms: Date.now() - t0, error: redact(err instanceof Error ? err.message : String(err)) };
    }
  }

  const ok = db.ok && env.AUTH_SECRET;
  const snapshot = await snapshotStatus().catch(() => ({ available: false as const }));
  return NextResponse.json(
    {
      ok,
      db,
      env,
      // The outage fallback: while db.ok is false but a snapshot exists, the
      // admin and portal keep serving the last saved copy (read-only mode).
      snapshot,
      hint: ok
        ? undefined
        : !env.DATABASE_URL
          ? "Set DATABASE_URL in Vercel → Project → Settings → Environment Variables, then redeploy."
          : !db.ok
            ? `The database did not answer — check the Neon console (compute suspended? quota? outage?) and Vercel's runtime logs.${snapshot.available ? " The app is serving the last saved snapshot meanwhile (read-only)." : ""}`
            : "Set AUTH_SECRET in Vercel → Project → Settings → Environment Variables, then redeploy.",
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
