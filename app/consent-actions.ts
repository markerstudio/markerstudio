"use server";

// Public — submitting a signature on a /consent/[token] page. Anyone with the
// link can sign (that's the point: the iPad gets passed around at a shoot),
// but every record is validated and only readable from the admin.

import { revalidatePath } from "next/cache";
import { getSql, isDbEnabled } from "@/lib/db";
import { ensureConsentSchema, getConsentFormByToken } from "@/lib/consents";

export type ConsentSignState = { ok: boolean; error?: string };

// A drawn signature arrives as a canvas PNG data URL. Keep a generous size
// cap so a detailed signature fits but the column can't be abused as storage.
const SIGNATURE_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const SIGNATURE_MAX = 400_000;

export async function signConsent(_prev: ConsentSignState, fd: FormData): Promise<ConsentSignState> {
  const ar = String(fd.get("lang") || "") === "ar";
  const t = (en: string, arMsg: string) => (ar ? arMsg : en);

  const token = String(fd.get("token") || "").trim();
  const name = String(fd.get("name") || "").trim();
  const contact = String(fd.get("contact") || "").trim();
  const signature = String(fd.get("signature") || "");

  if (name.length < 2) {
    return { ok: false, error: t("Please enter your full name.", "يرجى إدخال الاسم الكامل.") };
  }
  if (!signature) {
    return { ok: false, error: t("Please draw your signature before submitting.", "يرجى رسم توقيعك قبل الإرسال.") };
  }
  if (!SIGNATURE_RE.test(signature) || signature.length > SIGNATURE_MAX) {
    return { ok: false, error: t("The signature couldn't be read — clear it and try again.", "تعذّرت قراءة التوقيع — امسحه وحاول مرة أخرى.") };
  }
  if (!isDbEnabled()) {
    return { ok: false, error: t("Signing is unavailable right now. Please contact create@marker.ps.", "التوقيع غير متاح الآن. يرجى مراسلة create@marker.ps.") };
  }

  const form = await getConsentFormByToken(token);
  if (!form) {
    return { ok: false, error: t("This consent link is invalid or has been removed.", "رابط الموافقة هذا غير صالح أو تمت إزالته.") };
  }

  try {
    await ensureConsentSchema();
    await getSql()`
      INSERT INTO consent_signatures (form_id, name, contact, lang, signature)
      VALUES (${form.id}, ${name.slice(0, 200)}, ${contact.slice(0, 200)}, ${ar ? "ar" : "en"}, ${signature})
    `;
  } catch {
    return { ok: false, error: t("Saving failed — please try again.", "فشل الحفظ — يرجى المحاولة مرة أخرى.") };
  }

  revalidatePath("/admin/consents");
  return { ok: true };
}
