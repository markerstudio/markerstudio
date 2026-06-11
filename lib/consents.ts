// Photo/video consent forms — data model + access layer (DB-backed, Neon).
//
// A consent form is a shareable signing link for one shoot, session, or
// client. Each person who signs it (typed name + a hand-drawn signature
// captured on a canvas) becomes a consent_signatures row, so one link can be
// passed around an iPad at a photoshoot or sent to a client. The signed
// records are only readable from the admin; the public token page never
// shows previous signatures.
import { getSql, isDbEnabled } from "@/lib/db";

export type ConsentLang = "en" | "ar";

export type ConsentForm = {
  id: number;
  token: string;
  label: string; // internal label, e.g. "Bethlehem shoot — June 2026"
  lang: ConsentLang; // default language the signing page opens in
  created_at: string;
};

export type ConsentSignature = {
  id: number;
  form_id: number;
  name: string;
  contact: string; // phone / email (optional on the form)
  lang: ConsentLang; // language the signer viewed when signing
  signature: string; // hand-drawn signature as a PNG data URL
  signed_at: string;
};

export type ConsentFormWithStats = ConsentForm & {
  signatures: number;
  last_signed_at: string | null;
};

// Idempotent migration — safe to call repeatedly from write paths.
export async function ensureConsentSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS consent_forms (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      lang TEXT NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS consent_signatures (
      id SERIAL PRIMARY KEY,
      form_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '',
      lang TEXT NOT NULL DEFAULT 'en',
      signature TEXT NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function getConsentForms(): Promise<ConsentFormWithStats[]> {
  if (!isDbEnabled()) return [];
  try {
    return (await getSql()`
      SELECT f.id, f.token, f.label, f.lang, f.created_at,
             count(s.id)::int AS signatures,
             max(s.signed_at) AS last_signed_at
      FROM consent_forms f
      LEFT JOIN consent_signatures s ON s.form_id = f.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `) as unknown as ConsentFormWithStats[];
  } catch {
    return []; // table may not exist yet (pre-migration)
  }
}

export async function getConsentFormByToken(token: string): Promise<ConsentForm | undefined> {
  if (!isDbEnabled() || !token) return undefined;
  try {
    const rows = (await getSql()`
      SELECT id, token, label, lang, created_at FROM consent_forms WHERE token = ${token} LIMIT 1
    `) as unknown as ConsentForm[];
    return rows[0];
  } catch {
    return undefined;
  }
}

export async function getConsentSignatures(formId: number): Promise<ConsentSignature[]> {
  if (!isDbEnabled()) return [];
  try {
    return (await getSql()`
      SELECT id, form_id, name, contact, lang, signature, signed_at
      FROM consent_signatures WHERE form_id = ${formId} ORDER BY signed_at DESC
    `) as unknown as ConsentSignature[];
  } catch {
    return [];
  }
}

export async function getConsentSignature(id: number): Promise<(ConsentSignature & { form_label: string; form_token: string }) | undefined> {
  if (!isDbEnabled()) return undefined;
  try {
    const rows = (await getSql()`
      SELECT s.id, s.form_id, s.name, s.contact, s.lang, s.signature, s.signed_at,
             f.label AS form_label, f.token AS form_token
      FROM consent_signatures s JOIN consent_forms f ON f.id = s.form_id
      WHERE s.id = ${id} LIMIT 1
    `) as unknown as (ConsentSignature & { form_label: string; form_token: string })[];
    return rows[0];
  } catch {
    return undefined;
  }
}
