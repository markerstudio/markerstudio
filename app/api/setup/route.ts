import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getSql, isDbEnabled } from "@/lib/db";
import { SEED_PROJECTS, toRow } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-time onboarding: creates the tables (idempotent), the first admin user,
// and imports the seed projects. Guarded by the SETUP_SECRET env var.
//
//   curl -X POST https://YOUR-SITE/api/setup \
//     -H "x-setup-secret: $SETUP_SECRET" \
//     -H "content-type: application/json" \
//     -d '{"email":"you@marker.ps","password":"…","name":"Elias"}'
export async function POST(req: NextRequest) {
  if (!isDbEnabled()) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
  }
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.headers.get("x-setup-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "Admin").trim();
  if (!email || password.length < 8) {
    return NextResponse.json({ error: "email and password (8+ chars) required" }, { status: 400 });
  }

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT 'Admin',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#303030',
      logo TEXT NOT NULL DEFAULT '',
      year TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const existingUsers = (await sql`SELECT count(*)::int AS n FROM users`) as unknown as { n: number }[];
  let userCreated = false;
  if (existingUsers[0].n === 0) {
    const hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})`;
    userCreated = true;
  }

  const existingProjects = (await sql`SELECT count(*)::int AS n FROM projects`) as unknown as { n: number }[];
  let projectsImported = 0;
  if (existingProjects[0].n === 0) {
    for (let i = 0; i < SEED_PROJECTS.length; i++) {
      const r = toRow(SEED_PROJECTS[i]);
      const json = JSON.stringify(r.data);
      await sql`
        INSERT INTO projects (slug, color, logo, year, data, sort_order)
        VALUES (${r.slug}, ${r.color}, ${r.logo}, ${r.year}, ${json}::jsonb, ${i})
      `;
      projectsImported++;
    }
  }

  return NextResponse.json({
    ok: true,
    userCreated,
    projectsImported,
    note: userCreated ? "Admin user created." : "A user already existed; no user created.",
  });
}
