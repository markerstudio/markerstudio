"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSql, isDbEnabled } from "@/lib/db";
import { createSession, getSession } from "@/lib/auth";
import { ensureClientSchema, blankClientData, slugify, type OnboardingBrief, type ClientData } from "@/lib/clients";

export type OnboardingState = { ok: boolean; error?: string };

// Public — the /onboarding flow. Creates a draft client portal (status
// "pending") with the full brief, a client login, signs the prospect in, and
// drops them on their new portal.
export async function submitOnboarding(_prev: OnboardingState, fd: FormData): Promise<OnboardingState> {
  const ar = String(fd.get("lang") || "") === "ar";
  const t = (en: string, arMsg: string) => (ar ? arMsg : en);

  // Honeypot — bots fill the hidden "website" field; humans never do.
  if (String(fd.get("website") || "").trim()) return { ok: true };

  const g = (k: string) => String(fd.get(k) || "").trim();
  const all = (k: string) => fd.getAll(k).map((v) => String(v)).filter(Boolean);

  const firstName = g("firstName");
  const lastName = g("lastName");
  const email = g("email").toLowerCase();
  const phone = g("phone");
  const location = g("location");
  const password = String(fd.get("password") || "");
  const brandName = g("brandName");

  if (!firstName || !lastName || !/.+@.+\..+/.test(email) || !phone || !brandName) {
    return { ok: false, error: t("Please fill in your name, email, phone, and brand name.", "يرجى تعبئة الاسم والبريد والهاتف واسم العلامة.") };
  }
  if (password.length < 8) {
    return { ok: false, error: t("Choose a password of at least 8 characters.", "اختر كلمة مرور من ٨ أحرف على الأقل.") };
  }
  if (!isDbEnabled() || !process.env.AUTH_SECRET) {
    return { ok: false, error: t("We couldn't create your portal right now. Please email create@marker.ps.", "تعذّر إنشاء بوابتك الآن. يرجى مراسلتنا على create@marker.ps.") };
  }

  const sql = getSql();
  try {
    // Make sure the core tables exist even on a fresh database.
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL DEFAULT 'Admin',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await ensureClientSchema();
  } catch {
    return { ok: false, error: t("Setup error. Please email create@marker.ps.", "خطأ في الإعداد. يرجى مراسلتنا على create@marker.ps.") };
  }

  // Reject duplicate emails up front so we never orphan a client row.
  const dup = (await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`) as unknown as unknown[];
  if (dup.length) {
    return { ok: false, error: t("That email already has an account — please log in instead.", "هذا البريد لديه حساب بالفعل — يرجى تسجيل الدخول.") };
  }

  const brief: OnboardingBrief = {
    plan: g("plan"),
    planFeatures: all("planFeatures"),
    firstName, lastName, email, phone, location,
    brandName,
    brandDescription: g("brandDescription"),
    logoLanguage: all("logoLanguage"),
    products: g("products"),
    competitors: g("competitors"),
    businessGoals: g("businessGoals"),
    audienceGender: all("audienceGender"),
    audienceAge: all("audienceAge"),
    onlinePresence: g("onlinePresence"),
    symbolShape: g("symbolShape"),
    colorInMind: g("colorInMind"),
    colorDetail: g("colorDetail"),
    exactLogoText: g("exactLogoText"),
    tagline: g("tagline"),
    existingDesign: g("existingDesign"),
    additionalNotes: g("additionalNotes"),
    newsletter: g("newsletter") === "on" || g("newsletter") === "true",
    lang: ar ? "ar" : "en",
    submittedAt: new Date().toISOString(),
  };

  const data = blankClientData();
  data.status = "pending";
  data.onboarding = brief;
  data.accent = (brandName.split(/\s+/)[0] || brandName).toUpperCase().slice(0, 10);
  if (brief.brandDescription) {
    data.hero = ar ? { en: "", ar: brief.brandDescription } : { en: brief.brandDescription, ar: "" };
  }
  if (brief.plan) data.plan.name = brief.plan;

  // Unique slug from the brand name.
  const base = slugify(brandName);
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = (await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as unknown[];
    if (r.length === 0) break;
    slug = `${base}-${n++}`;
  }

  let clientId: number;
  try {
    const ins = (await sql`
      INSERT INTO clients (slug, name, color, data)
      VALUES (${slug}, ${brandName}, '#303030', ${JSON.stringify(data)}::jsonb)
      RETURNING id
    `) as unknown as { id: number }[];
    clientId = ins[0].id;
  } catch {
    return { ok: false, error: t("Couldn't save your brand. Please try again.", "تعذّر حفظ علامتك. حاول مرة أخرى.") };
  }

  const hash = await bcrypt.hash(password, 10);
  let userId: number;
  try {
    const u = (await sql`
      INSERT INTO users (email, name, password_hash, role, client_id)
      VALUES (${email}, ${`${firstName} ${lastName}`}, ${hash}, 'client', ${clientId})
      RETURNING id
    `) as unknown as { id: number }[];
    userId = u[0].id;
  } catch {
    return { ok: false, error: t("That email already has an account — please log in.", "هذا البريد لديه حساب بالفعل — يرجى تسجيل الدخول.") };
  }

  await createSession({ id: userId, email, name: `${firstName} ${lastName}`, role: "client", clientId });
  revalidatePath("/admin/clients");
  redirect(`/portal/${slug}/proposal`);
}

// Client (or admin) accepts the proposal generated from their onboarding brief.
export async function acceptProposal(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim();
  const s = await getSession();
  if (!s) redirect("/login");

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  const c = rows[0];
  if (!c) redirect("/portal");
  if (s.role === "client" && s.clientId !== c.id) redirect("/portal");

  const data = (c.data || {}) as ClientData;
  data.proposal = { ...(data.proposal || {}), acceptedAt: new Date().toISOString() };
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/proposal`);
  revalidatePath("/admin/clients");
  redirect(`/portal/${slug}/agreement`);
}

// Client (or admin) e-signs the service agreement.
export async function signAgreement(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim();
  const signedName = String(formData.get("signedName") || "").trim();
  const agreed = formData.get("agree");
  const s = await getSession();
  if (!s) redirect("/login");

  const sql = getSql();
  const rows = (await sql`SELECT id, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; data: ClientData }[];
  const c = rows[0];
  if (!c) redirect("/portal");
  if (s.role === "client" && s.clientId !== c.id) redirect("/portal");
  if (!agreed || signedName.length < 2) redirect(`/portal/${slug}/agreement?error=1`);

  const data = (c.data || {}) as ClientData;
  data.agreement = { acceptedAt: new Date().toISOString(), signedName };
  if (data.status === "pending") data.status = "active";
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/agreement`);
  revalidatePath("/admin/clients");
  redirect(`/portal/${slug}?welcome=1`);
}
