"use server";

// Admin consent-form actions — creating signing links and managing the
// signed records collected on /consent/[token].

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { ensureConsentSchema } from "@/lib/consents";

export async function createConsentForm(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const label = String(formData.get("label") || "").trim().slice(0, 200);
  const lang = String(formData.get("lang") || "en") === "ar" ? "ar" : "en";
  if (!label) redirect("/admin/consents?error=label");

  await ensureConsentSchema();
  const token = randomBytes(24).toString("base64url");
  await getSql()`INSERT INTO consent_forms (token, label, lang) VALUES (${token}, ${label}, ${lang})`;
  revalidatePath("/admin/consents");
  redirect("/admin/consents?ok=created");
}

// Deletes the form and every signature collected on it.
export async function deleteConsentForm(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  if (id) {
    const sql = getSql();
    await sql`DELETE FROM consent_signatures WHERE form_id = ${id}`;
    await sql`DELETE FROM consent_forms WHERE id = ${id}`;
  }
  revalidatePath("/admin/consents");
  redirect("/admin/consents?ok=deleted");
}

export async function deleteConsentSignature(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  if (id) await getSql()`DELETE FROM consent_signatures WHERE id = ${id}`;
  revalidatePath("/admin/consents");
  redirect("/admin/consents?ok=signature-deleted");
}
