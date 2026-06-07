"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSql, isDbEnabled } from "@/lib/db";
import { createSession, destroySession, getSession, type Role } from "@/lib/auth";
import { SEED_PROJECTS, toRow, type Project } from "@/lib/projects";
import { ensureClientSchema, EXAMPLE_CLIENT } from "@/lib/clients";

type UserRow = { id: number; email: string; name: string; password_hash: string; role: Role; client_id: number | null };

async function ensureTables() {
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
}

// First-run setup from the web (no terminal): creates the tables, the first
// admin account, and imports the seed projects. Becomes inert once any user
// exists, so it needs no secret.
export async function setupFirstUser(formData: FormData) {
  if (!isDbEnabled()) redirect("/admin/setup?error=nodb");
  if (!process.env.AUTH_SECRET) redirect("/admin/setup?error=nosecret");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "Admin").trim() || "Admin";
  if (!email || password.length < 8) redirect("/admin/setup?error=invalid");

  await ensureTables();
  await ensureClientSchema();
  const sql = getSql();

  const users = (await sql`SELECT count(*)::int AS n FROM users`) as unknown as { n: number }[];
  if (users[0].n > 0) redirect("/login");

  const hash = await bcrypt.hash(password, 10);
  await sql`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})`;

  const proj = (await sql`SELECT count(*)::int AS n FROM projects`) as unknown as { n: number }[];
  if (proj[0].n === 0) {
    for (let i = 0; i < SEED_PROJECTS.length; i++) {
      const r = toRow(SEED_PROJECTS[i]);
      const json = JSON.stringify(r.data);
      await sql`
        INSERT INTO projects (slug, color, logo, year, data, sort_order)
        VALUES (${r.slug}, ${r.color}, ${r.logo}, ${r.year}, ${json}::jsonb, ${i})
      `;
    }
  }

  revalidatePath("/");
  redirect("/login?setup=1");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const sql = getSql();
  try {
    await ensureClientSchema(); // make sure role/client_id columns exist
  } catch {
    /* ignore */
  }
  const rows = (await sql`
    SELECT id, email, name, password_hash, role, client_id FROM users WHERE email = ${email} LIMIT 1
  `) as unknown as UserRow[];
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    redirect("/login?error=1");
  }
  await createSession({
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role as Role) || "admin",
    clientId: u.client_id ?? null,
  });
  redirect(u.role === "client" ? "/portal" : "/admin");
}

export async function logout() {
  destroySession();
  redirect("/login");
}

function list(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseProject(fd: FormData): Project {
  const g = (k: string) => String(fd.get(k) || "").trim();
  return {
    slug: g("slug"),
    color: g("color") || "#303030",
    logo: g("logo"),
    year: g("year"),
    name: { en: g("name_en"), ar: g("name_ar") },
    tag: { en: g("tag_en"), ar: g("tag_ar") },
    services: { en: list(fd.get("services_en")), ar: list(fd.get("services_ar")) },
    deliverables: { en: list(fd.get("deliverables_en")), ar: list(fd.get("deliverables_ar")) },
    summary: { en: g("summary_en"), ar: g("summary_ar") },
    challenge: { en: g("challenge_en"), ar: g("challenge_ar") },
    approach: { en: g("approach_en"), ar: g("approach_ar") },
    results: { en: g("results_en"), ar: g("results_ar") },
    gallery: list(fd.get("gallery")),
  };
}

export async function saveProject(formData: FormData) {
  if (!(await getSession())) redirect("/login");

  const p = parseProject(formData);
  const { slug, color, logo, year, ...data } = p;
  const original = String(formData.get("originalSlug") || "").trim();
  const json = JSON.stringify(data);
  const sql = getSql();

  if (original) {
    await sql`
      UPDATE projects
      SET slug = ${slug}, color = ${color}, logo = ${logo}, year = ${year}, data = ${json}::jsonb, updated_at = now()
      WHERE slug = ${original}
    `;
  } else {
    await sql`
      INSERT INTO projects (slug, color, logo, year, data, sort_order)
      VALUES (${slug}, ${color}, ${logo}, ${year}, ${json}::jsonb, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects))
    `;
  }

  revalidatePath("/");
  revalidatePath(`/work/${slug}`);
  if (original && original !== slug) revalidatePath(`/work/${original}`);
  redirect("/admin");
}

export async function deleteProject(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  await sql`DELETE FROM projects WHERE slug = ${slug}`;
  revalidatePath("/");
  revalidatePath(`/work/${slug}`);
  redirect("/admin");
}

// --- User management -------------------------------------------------------

export async function createUser(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || "Admin";
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/admin/users?error=invalid");

  const sql = getSql();
  const hash = await bcrypt.hash(password, 10);
  let duplicate = false;
  try {
    await sql`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})`;
  } catch {
    duplicate = true; // unique-violation on email (or other write error)
  }
  redirect(duplicate ? "/admin/users?error=exists" : "/admin/users?ok=added");
}

export async function deleteUser(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const sql = getSql();
  const count = (await sql`SELECT count(*)::int AS n FROM users WHERE role = 'admin' OR role IS NULL`) as unknown as { n: number }[];
  if (count[0].n <= 1) redirect("/admin/users?error=last"); // never remove the last admin
  await sql`DELETE FROM users WHERE id = ${id}`;
  redirect("/admin/users?ok=removed");
}

// --- Client portals --------------------------------------------------------

export async function saveClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  const slug = String(formData.get("slug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const logo = String(formData.get("logo") || "").trim();
  const color = String(formData.get("color") || "#303030").trim();
  const original = String(formData.get("originalSlug") || "").trim();

  let data: unknown;
  try {
    data = JSON.parse(String(formData.get("data") || "{}"));
  } catch {
    redirect(`/admin/clients/${original || "new"}/edit?error=json`);
  }
  const json = JSON.stringify(data);
  const sql = getSql();

  if (original) {
    await sql`
      UPDATE clients SET slug = ${slug}, name = ${name}, logo = ${logo}, color = ${color}, data = ${json}::jsonb, updated_at = now()
      WHERE slug = ${original}
    `;
  } else {
    await sql`
      INSERT INTO clients (slug, name, logo, color, data) VALUES (${slug}, ${name}, ${logo}, ${color}, ${json}::jsonb)
    `;
  }
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=saved`);
}

export async function deleteClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  const rows = (await sql`SELECT id FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number }[];
  if (rows[0]) await sql`DELETE FROM users WHERE client_id = ${rows[0].id}`;
  await sql`DELETE FROM clients WHERE slug = ${slug}`;
  redirect("/admin/clients");
}

export async function createClientUser(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  const slug = String(formData.get("slug") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || "Client";
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect(`/admin/clients/${slug}/edit?error=invalid`);

  const sql = getSql();
  const rows = (await sql`SELECT id FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number }[];
  if (!rows[0]) redirect("/admin/clients");

  const hash = await bcrypt.hash(password, 10);
  let dup = false;
  try {
    await sql`INSERT INTO users (email, name, password_hash, role, client_id) VALUES (${email}, ${name}, ${hash}, 'client', ${rows[0].id})`;
  } catch {
    dup = true;
  }
  redirect(`/admin/clients/${slug}/edit?${dup ? "error=exists" : "ok=login"}`);
}

export async function deleteClientUser(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  await getSql()`DELETE FROM users WHERE id = ${id} AND role = 'client'`;
  redirect(`/admin/clients/${slug}/edit?ok=removed`);
}

export async function importExampleClient() {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  const sql = getSql();
  const e = EXAMPLE_CLIENT;
  const exists = (await sql`SELECT 1 FROM clients WHERE slug = ${e.slug} LIMIT 1`) as unknown as unknown[];
  if (exists.length === 0) {
    await sql`
      INSERT INTO clients (slug, name, logo, color, data)
      VALUES (${e.slug}, ${e.name}, ${e.logo}, ${e.color}, ${JSON.stringify(e.data)}::jsonb)
    `;
  }
  redirect(`/admin/clients/${e.slug}/edit?ok=imported`);
}
