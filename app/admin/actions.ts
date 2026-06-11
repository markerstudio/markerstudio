"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getSql, isDbEnabled } from "@/lib/db";
import { createSession, destroySession, getSession, type Role } from "@/lib/auth";
import { SEED_PROJECTS, toRow, type Project } from "@/lib/projects";
import { ensureClientSchema, EXAMPLE_CLIENT, blankClientData, slugify, resolveOrCreateClientByName, type ClientData } from "@/lib/clients";
import { fetchNotionPosts, fetchNotionClient, extractNotionId, listNotionClients } from "@/lib/notion";
import { snapshotForUndo } from "@/lib/undo";

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

// Import any seed projects that aren't already in the DB (by slug). Idempotent —
// safe to click repeatedly; only inserts what's missing. Lets newly-added seed
// case studies (e.g. brand books) appear on a DB-backed site without re-running setup.
export async function importSeedProjects() {
  if (!(await getSession())) redirect("/login");
  const sql = getSql();
  const existing = (await sql`SELECT slug FROM projects`) as unknown as { slug: string }[];
  const have = new Set(existing.map((r) => r.slug));
  let added = 0;
  let order = existing.length;
  for (const p of SEED_PROJECTS) {
    if (have.has(p.slug)) continue;
    const r = toRow(p);
    const json = JSON.stringify(r.data);
    await sql`
      INSERT INTO projects (slug, color, logo, year, data, sort_order)
      VALUES (${r.slug}, ${r.color}, ${r.logo}, ${r.year}, ${json}::jsonb, ${order++})
      ON CONFLICT (slug) DO NOTHING
    `;
    added++;
  }
  revalidatePath("/");
  revalidatePath("/admin/projects");
  redirect(`/admin/projects?imported=${added}`);
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
  redirect("/admin/projects");
}

export async function deleteProject(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, slug, color, logo, year, data, sort_order, created_at, updated_at FROM projects WHERE slug = ${slug} LIMIT 1
  `) as unknown as { data?: { name?: { en?: string } } }[];
  if (!rows[0]) redirect("/admin/projects");
  const undoId = await snapshotForUndo("project", rows[0].data?.name?.en || slug, { project: rows[0] });
  await sql`DELETE FROM projects WHERE slug = ${slug}`;
  revalidatePath("/");
  revalidatePath(`/work/${slug}`);
  redirect(`/admin/projects?undo=${undoId}`);
}

// --- Onboarding: connect a draft portal to an existing one -----------------

// Moves the onboarding draft's login(s) and brief onto an existing client, then
// deletes the draft — so a prospect who signed up through /onboarding ends up
// pointing at the portal you already manage.
export async function mergeOnboardingIntoClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const fromSlug = String(formData.get("fromSlug") || "").trim();
  const toSlug = String(formData.get("toSlug") || "").trim();
  if (!fromSlug || !toSlug || fromSlug === toSlug) redirect(`/admin/clients/${fromSlug}/edit?error=merge`);

  const sql = getSql();
  const fromRows = (await sql`SELECT id, data FROM clients WHERE slug = ${fromSlug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  const toRows = (await sql`SELECT id, data FROM clients WHERE slug = ${toSlug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!fromRows[0] || !toRows[0]) redirect("/admin/clients");
  const from = fromRows[0];
  const to = toRows[0];

  await sql`UPDATE users SET client_id = ${to.id} WHERE client_id = ${from.id}`;

  const toData = (to.data || {}) as ClientData;
  if (from.data?.onboarding) toData.onboarding = from.data.onboarding;
  await sql`UPDATE clients SET data = ${JSON.stringify(toData)}::jsonb, updated_at = now() WHERE id = ${to.id}`;

  await sql`DELETE FROM invites WHERE client_id = ${from.id}`;
  await sql`DELETE FROM clients WHERE id = ${from.id}`;

  revalidatePath("/admin/clients");
  revalidatePath(`/portal/${toSlug}`);
  redirect(`/admin/clients/${toSlug}/edit?ok=connected`);
}

// --- Proposal & agreement (studio-prepared, then sent to the client) --------

// Send / unsend the proposal to the client. Until sent, the client can't see it.
export async function sendProposal(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const send = String(formData.get("send") || "") === "1";
  const note = String(formData.get("note") || "").trim();

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");
  const data = (rows[0].data || {}) as ClientData;
  data.proposal = {
    ...data.proposal,
    published: send,
    note,
    sentAt: send ? data.proposal?.sentAt || new Date().toISOString() : data.proposal?.sentAt,
  };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=${send ? "proposal-sent" : "proposal-unsent"}`);
}

// Send / unsend the agreement (optionally with an agreed value) to the client.
export async function sendAgreement(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const send = String(formData.get("send") || "") === "1";
  const value = String(formData.get("value") || "").trim();

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");
  const data = (rows[0].data || {}) as ClientData;
  data.agreement = {
    ...data.agreement,
    published: send,
    value: value || data.agreement?.value, // preserve existing if not provided
    sentAt: send ? data.agreement?.sentAt || new Date().toISOString() : data.agreement?.sentAt,
  };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=${send ? "agreement-sent" : "agreement-unsent"}`);
}

// Save the itemised quote (one line per package / service). Shown on the
// proposal & agreement once present.
export async function savePricing(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const note = String(formData.get("note") || "").trim();
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    parsed = [];
  }
  const items = (Array.isArray(parsed) ? parsed : [])
    .map((i) => ({ label: String((i as { label?: unknown })?.label || "").trim(), amount: String((i as { amount?: unknown })?.amount || "").trim() }))
    .filter((i) => i.label || i.amount);

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");
  const data = (rows[0].data || {}) as ClientData;
  data.pricing = { items, note };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=pricing-saved`);
}

// Save the proposal timeline — ordered phases shown on the client's proposal.
export async function saveProposalTimeline(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(String(formData.get("timeline") || "[]"));
  } catch {
    parsed = [];
  }
  const timeline = (Array.isArray(parsed) ? parsed : [])
    .map((p) => ({
      phase: String((p as { phase?: unknown })?.phase || "").trim(),
      duration: String((p as { duration?: unknown })?.duration || "").trim(),
      detail: String((p as { detail?: unknown })?.detail || "").trim(),
    }))
    .filter((p) => p.phase || p.detail);

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");
  const data = (rows[0].data || {}) as ClientData;
  data.proposal = { ...data.proposal, timeline };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=timeline-saved`);
}

// Start a proposal from the Proposals tab — pick a client from the dropdown
// or type a name (unknown names get a minimal portal created). Initializes a
// draft proposal and lands on the client's edit page to prepare it.
export async function createProposalFromTab(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim();

  let targetSlug = "";
  if (slug && slug !== "__new") {
    targetSlug = slug;
  } else if (clientName) {
    const c = await resolveOrCreateClientByName(clientName);
    if (c) targetSlug = c.slug;
  }
  if (!targetSlug) redirect("/admin/proposals?error=client");

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${targetSlug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/proposals?error=client");
  const data = (rows[0].data || {}) as ClientData;
  data.proposal = { published: false, ...data.proposal, archived: false };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;

  revalidatePath("/admin/proposals");
  redirect(`/admin/proposals/${targetSlug}`);
}

// Archive / restore a proposal from the Proposals tab. Archiving also unsends
// it, so an archived proposal can't linger visible in the client's portal.
export async function setProposalArchived(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const archived = String(formData.get("archived") || "") === "1";

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/proposals");
  const data = (rows[0].data || {}) as ClientData;
  data.proposal = { ...data.proposal, archived, ...(archived ? { published: false } : {}) };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;

  revalidatePath("/admin/proposals");
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/proposals${archived ? "" : "?archived=1"}`);
}

// Delete a proposal outright (the client record and its pricing stay).
export async function deleteProposal(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  if (!rows[0]) redirect("/admin/proposals");
  const data = (rows[0].data || {}) as ClientData;
  delete data.proposal;
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${rows[0].id}`;

  revalidatePath("/admin/proposals");
  revalidatePath(`/portal/${slug}`);
  redirect("/admin/proposals?ok=deleted");
}

// --- Inquiries (contact-form submissions) ----------------------------------

export async function markInquiryRead(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  await getSql()`UPDATE inquiries SET read_at = now() WHERE id = ${id}`;
  revalidatePath("/admin/inquiries");
  redirect("/admin/inquiries");
}

export async function markAllInquiriesRead() {
  if (!(await getSession())) redirect("/login");
  await getSql()`UPDATE inquiries SET read_at = now() WHERE read_at IS NULL`;
  revalidatePath("/admin/inquiries");
  redirect("/admin/inquiries");
}

export async function deleteInquiry(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, email, phone, brand, service, message, lang, created_at, read_at FROM inquiries WHERE id = ${id} LIMIT 1
  `) as unknown as { name: string; email: string }[];
  if (!rows[0]) redirect("/admin/inquiries");
  const undoId = await snapshotForUndo("inquiry", `inquiry from ${rows[0].name || rows[0].email}`, { inquiry: rows[0] });
  await sql`DELETE FROM inquiries WHERE id = ${id}`;
  revalidatePath("/admin/inquiries");
  redirect(`/admin/inquiries?undo=${undoId}`);
}

// --- Applications (careers / "work with us" submissions) -------------------

export async function markApplicationRead(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  await getSql()`UPDATE applications SET read_at = now() WHERE id = ${id}`;
  revalidatePath("/admin/applications");
  redirect("/admin/applications");
}

export async function markAllApplicationsRead() {
  if (!(await getSession())) redirect("/login");
  await getSql()`UPDATE applications SET read_at = now() WHERE read_at IS NULL`;
  revalidatePath("/admin/applications");
  redirect("/admin/applications");
}

export async function deleteApplication(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const sql = getSql();
  const rows = (await sql`
    SELECT id, first_name, last_name, gender, email, phone, address, talent, rate_session, rate, instagram, work_url, lang, created_at, read_at
    FROM applications WHERE id = ${id} LIMIT 1
  `) as unknown as { first_name: string; last_name: string; email: string }[];
  if (!rows[0]) redirect("/admin/applications");
  const name = `${rows[0].first_name} ${rows[0].last_name}`.trim() || rows[0].email;
  const undoId = await snapshotForUndo("application", `application from ${name}`, { application: rows[0] });
  await sql`DELETE FROM applications WHERE id = ${id}`;
  revalidatePath("/admin/applications");
  redirect(`/admin/applications?undo=${undoId}`);
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
  const rows = (await sql`
    SELECT id, email, name, password_hash, role, client_id, created_at FROM users WHERE id = ${id} LIMIT 1
  `) as unknown as { email: string }[];
  if (!rows[0]) redirect("/admin/users");
  const undoId = await snapshotForUndo("user", rows[0].email, { user: rows[0] });
  await sql`DELETE FROM users WHERE id = ${id}`;
  redirect(`/admin/users?undo=${undoId}`);
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
  if (original && original !== slug) revalidatePath(`/portal/${original}`);
  redirect(`/admin/clients/${slug}/edit?ok=saved`);
}

export async function deleteClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, slug, name, logo, color, data, created_at, updated_at FROM clients WHERE slug = ${slug} LIMIT 1
  `) as unknown as { id: number; name: string }[];
  if (!rows[0]) redirect("/admin/clients");
  const users = await sql`SELECT id, email, name, password_hash, role, client_id, created_at FROM users WHERE client_id = ${rows[0].id}`;
  const undoId = await snapshotForUndo("client", rows[0].name || slug, { client: rows[0], users });
  await sql`DELETE FROM users WHERE client_id = ${rows[0].id}`;
  await sql`DELETE FROM clients WHERE slug = ${slug}`;
  revalidatePath(`/portal/${slug}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients?undo=${undoId}`);
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
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?${dup ? "error=exists" : "ok=login"}`);
}

export async function deleteClientUser(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, password_hash, role, client_id, created_at FROM users WHERE id = ${id} AND role = 'client' LIMIT 1
  `) as unknown as { email: string }[];
  if (!rows[0]) redirect(`/admin/clients/${slug}/edit`);
  const undoId = await snapshotForUndo("user", `login ${rows[0].email}`, { user: rows[0] });
  await sql`DELETE FROM users WHERE id = ${id} AND role = 'client'`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?undo=${undoId}`);
}

// One-step create: just a name. Generates a unique slug, blank content, and
// drops you onto the new portal in edit mode.
export async function quickCreateClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/clients?error=name");

  const sql = getSql();
  const base = slugify(name);
  let slug = base;
  let n = 2;
  // ensure unique slug
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = (await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as unknown[];
    if (rows.length === 0) break;
    slug = `${base}-${n++}`;
  }
  await sql`INSERT INTO clients (slug, name, color, data) VALUES (${slug}, ${name}, '#303030', ${JSON.stringify(blankClientData())}::jsonb)`;
  redirect(`/admin/clients/${slug}/edit`);
}

// Create a new client directly from a Notion Clients Database page.
export async function quickCreateFromNotion(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  if (!process.env.NOTION_TOKEN) redirect("/admin/clients?error=notion-token");
  const pageId = extractNotionId(String(formData.get("notionPageId") || ""));
  if (!pageId) redirect("/admin/clients?error=notion-id");

  let info;
  try {
    info = await fetchNotionClient(pageId);
  } catch {
    redirect("/admin/clients?error=notion-fetch");
  }

  const name = info.name || "Client";
  const sql = getSql();
  const base = slugify(name);
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = (await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as unknown[];
    if (r.length === 0) break;
    slug = `${base}-${n++}`;
  }

  const data = blankClientData();
  data.notionPageId = pageId;
  data.plan = {
    name: info.planName || "",
    active: info.active,
    start: info.start || "",
    end: info.end || "",
    notionUrl: "",
    note: { en: info.note || "", ar: "" },
    balance: info.balance || "",
  };
  data.finance = {
    monthlyFee: info.monthlyFee || "",
    progress: info.progress || 0,
    brandingFee: info.brandingFee || "",
  };
  if (info.invoices.length) data.invoices = info.invoices;

  await sql`INSERT INTO clients (slug, name, color, data) VALUES (${slug}, ${name}, '#303030', ${JSON.stringify(data)}::jsonb)`;
  redirect(`/admin/clients/${slug}/edit?ok=imported`);
}

// Save portal content from in-place editing (called programmatically, not a form).
export async function updateClientData(slug: string, dataJson: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJson);
  } catch {
    return { ok: false, error: "bad json" };
  }
  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(parsed)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}

// Manual "Sync now" from the portal — pulls the client record (finance, plan,
// invoices) and, if linked, the content calendar, in one go. Busts the
// auto-refresh cache so the change shows immediately. Returns a status string.
export async function resyncFromNotion(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  if (!process.env.NOTION_TOKEN) return { ok: false, error: "Notion isn't connected (NOTION_TOKEN not set)." };

  const sql = getSql();
  const rows = (await sql`SELECT data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { data: ClientData }[];
  if (!rows[0]) return { ok: false, error: "Client not found." };
  const data = rows[0].data;
  if (!data.notionPageId && !data.notionDbId) return { ok: false, error: "This client isn't linked to Notion yet — set it up in Edit." };

  try {
    if (data.notionPageId) {
      const info = await fetchNotionClient(data.notionPageId);
      data.plan = {
        name: info.planName || data.plan?.name || "",
        active: info.active,
        start: info.start || data.plan?.start || "",
        end: info.end || data.plan?.end || "",
        notionUrl: data.plan?.notionUrl ?? "",
        note: { en: info.note || data.plan?.note?.en || "", ar: data.plan?.note?.ar || "" },
        balance: info.balance || data.plan?.balance || "",
      };
      data.finance = {
        monthlyFee: info.monthlyFee || data.finance?.monthlyFee || "",
        progress: info.progress || data.finance?.progress || 0,
        brandingFee: info.brandingFee || data.finance?.brandingFee || "",
      };
      if (info.invoices.length) data.invoices = info.invoices;
    }
    if (data.notionDbId) {
      const posts = await fetchNotionPosts(data.notionDbId);
      data.social = { headline: data.social?.headline ?? { en: "", ar: "" }, posts };
    }
  } catch {
    return { ok: false, error: "Couldn't reach Notion. Check sharing/permissions and try again." };
  }

  try {
    await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
  } catch {
    return { ok: false, error: "Saved sync failed (database)." };
  }
  revalidateTag("notion-live");
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}

// Pull a Notion content-calendar database into this client's social calendar.
export async function syncNotion(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const raw = String(formData.get("notionDbId") || "").trim();
  if (!process.env.NOTION_TOKEN) redirect(`/admin/clients/${slug}/edit?error=notion-token`);
  const dbId = extractNotionId(raw);
  if (!dbId) redirect(`/admin/clients/${slug}/edit?error=notion-id`);

  const sql = getSql();
  const rows = (await sql`SELECT data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");

  let posts;
  try {
    posts = await fetchNotionPosts(dbId);
  } catch {
    redirect(`/admin/clients/${slug}/edit?error=notion-fetch`);
  }

  const data = rows[0].data;
  data.notionDbId = dbId;
  data.social = { headline: data.social?.headline ?? { en: "", ar: "" }, posts };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=synced-${posts.length}`);
}

// Pull the client record (name, plan dates/status/note + invoices) from a
// Clients Database page in Notion.
export async function syncNotionClient(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const raw = String(formData.get("notionPageId") || "").trim();
  if (!process.env.NOTION_TOKEN) redirect(`/admin/clients/${slug}/edit?error=notion-token`);
  const pageId = extractNotionId(raw);
  if (!pageId) redirect(`/admin/clients/${slug}/edit?error=notion-id`);

  const sql = getSql();
  const rows = (await sql`SELECT data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");

  let info;
  try {
    info = await fetchNotionClient(pageId);
  } catch {
    redirect(`/admin/clients/${slug}/edit?error=notion-fetch`);
  }

  const data = rows[0].data;
  data.notionPageId = pageId;
  data.plan = {
    name: info.planName || data.plan?.name || "",
    active: info.active,
    start: info.start || data.plan?.start || "",
    end: info.end || data.plan?.end || "",
    notionUrl: data.plan?.notionUrl ?? "",
    note: { en: info.note || data.plan?.note?.en || "", ar: data.plan?.note?.ar || "" },
    balance: info.balance || data.plan?.balance || "",
  };
  data.finance = {
    monthlyFee: info.monthlyFee || data.finance?.monthlyFee || "",
    progress: info.progress || data.finance?.progress || 0,
    brandingFee: info.brandingFee || data.finance?.brandingFee || "",
  };
  if (info.invoices.length) data.invoices = info.invoices;

  const name = info.name || undefined;
  if (name) {
    await sql`UPDATE clients SET name = ${name}, data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
  } else {
    await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
  }
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=client-synced-${info.invoices.length}`);
}

// Import EVERY client from the Notion Clients Database in one click.
// - Already-imported clients (matched by notionPageId) are left alone.
// - A manually-created portal with the same name/slug gets LINKED to its
//   Notion record (plan/finance/invoices synced onto it) instead of duplicated.
// - Everyone else gets a fresh portal, same as quickCreateFromNotion.
export async function importAllNotionClients() {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  if (!process.env.NOTION_TOKEN) redirect("/admin/clients?error=notion-token");

  const list = await listNotionClients();
  if (list.length === 0) redirect("/admin/clients?error=notion-fetch");

  const sql = getSql();
  type Row = { id: number; slug: string; name: string; data: ClientData };
  const existing = (await sql`SELECT id, slug, name, data FROM clients`) as unknown as Row[];
  const norm = (s: string) => (s || "").replace(/-/g, "").toLowerCase();
  const linkedPages = new Set(existing.map((e) => norm(e.data?.notionPageId || "")).filter(Boolean));
  const slugs = new Set(existing.map((e) => e.slug));

  let imported = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of list) {
    const pageId = extractNotionId(c.id);
    if (!pageId) { failed++; continue; }
    if (linkedPages.has(norm(pageId))) { skipped++; continue; }

    let info: Awaited<ReturnType<typeof fetchNotionClient>>;
    try {
      info = await fetchNotionClient(pageId);
    } catch {
      failed++;
      continue;
    }
    const name = info.name || c.name || "Client";
    const base = slugify(name);

    // Existing portal made by hand (no Notion link yet) with the same identity?
    const match = existing.find(
      (e) => !e.data?.notionPageId && (e.slug === base || e.name.trim().toLowerCase() === name.trim().toLowerCase())
    );

    const apply = (data: ClientData): ClientData => {
      data.notionPageId = pageId;
      data.plan = {
        name: info.planName || data.plan?.name || "",
        active: info.active,
        start: info.start || data.plan?.start || "",
        end: info.end || data.plan?.end || "",
        notionUrl: data.plan?.notionUrl ?? "",
        note: { en: info.note || data.plan?.note?.en || "", ar: data.plan?.note?.ar || "" },
        balance: info.balance || data.plan?.balance || "",
      };
      data.finance = {
        monthlyFee: info.monthlyFee || data.finance?.monthlyFee || "",
        progress: info.progress || data.finance?.progress || 0,
        brandingFee: info.brandingFee || data.finance?.brandingFee || "",
      };
      if (info.invoices.length) data.invoices = info.invoices;
      return data;
    };

    if (match) {
      const data = apply((match.data || blankClientData()) as ClientData);
      await sql`UPDATE clients SET name = ${name}, data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${match.id}`;
      linkedPages.add(norm(pageId));
      linked++;
      continue;
    }

    let slug = base;
    let n = 2;
    while (slugs.has(slug)) slug = `${base}-${n++}`;
    slugs.add(slug);
    const data = apply(blankClientData());
    await sql`INSERT INTO clients (slug, name, color, data) VALUES (${slug}, ${name}, '#303030', ${JSON.stringify(data)}::jsonb)`;
    linkedPages.add(norm(pageId));
    imported++;
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients?bulk=${imported}.${linked}.${skipped}.${failed}`);
}

// --- Finance (Notion Budget Tracker) ----------------------------------------

// Bust the cached Budget Tracker read so /admin/finance refetches from Notion.
export async function syncFinance() {
  if (!(await getSession())) redirect("/login");
  revalidateTag("finance");
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  redirect("/admin/finance?ok=synced");
}

// --- Invite links ----------------------------------------------------------

export async function createInvite(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  await ensureClientSchema();
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  const rows = (await sql`SELECT id FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number }[];
  if (!rows[0]) redirect("/admin/clients");
  const token = randomBytes(24).toString("base64url");
  await sql`INSERT INTO invites (token, client_id) VALUES (${token}, ${rows[0].id})`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invite`);
}

export async function deleteInvite(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "");
  await getSql()`DELETE FROM invites WHERE id = ${id}`;
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invite-removed`);
}

// Public: a client accepts an invite by choosing an email + password.
export async function acceptInvite(formData: FormData) {
  await ensureClientSchema();
  const token = String(formData.get("token") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || "Client";
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect(`/invite/${token}?error=input`);

  const sql = getSql();
  const rows = (await sql`SELECT id, client_id, used_at FROM invites WHERE token = ${token} LIMIT 1`) as unknown as { id: number; client_id: number; used_at: string | null }[];
  const inv = rows[0];
  if (!inv || inv.used_at) redirect(`/invite/${token}?error=invalid`);

  const hash = await bcrypt.hash(password, 10);
  let userId: number | undefined;
  try {
    const ins = (await sql`
      INSERT INTO users (email, name, password_hash, role, client_id)
      VALUES (${email}, ${name}, ${hash}, 'client', ${inv.client_id}) RETURNING id
    `) as unknown as { id: number }[];
    userId = ins[0].id;
  } catch {
    redirect(`/invite/${token}?error=email-taken`);
  }
  await sql`UPDATE invites SET used_at = now() WHERE id = ${inv.id}`;
  await createSession({ id: userId as number, email, name, role: "client", clientId: inv.client_id });
  redirect("/portal");
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
