"use server";

import { isDbEnabled } from "@/lib/db";
import { ensureApplicationsTable, createApplication } from "@/lib/applications";

export type ApplicationState = { ok: boolean; error?: string };

// Public — called from the /careers form (no auth). Validates, drops obvious
// bots via a honeypot, and stores the application for the admin inbox.
export async function submitApplication(_prev: ApplicationState, formData: FormData): Promise<ApplicationState> {
  const ar = String(formData.get("lang") || "") === "ar";

  // Honeypot: real users never fill the hidden "company" field. Pretend success.
  if (String(formData.get("company") || "").trim()) return { ok: true };

  const get = (k: string) => String(formData.get(k) || "").trim();
  const firstName = get("firstName");
  const lastName = get("lastName");
  const email = get("email");
  const gender = get("gender");
  const phone = get("phone");
  const address = get("address");
  const talent = get("talent");
  const rateSession = get("rateSession");

  const err = (en: string, arMsg: string) => ({ ok: false as const, error: ar ? arMsg : en });

  if (!firstName || !lastName) return err("Please add your first and last name.", "يرجى إدخال الاسم الأول واسم العائلة.");
  if (!/.+@.+\..+/.test(email)) return err("Please add a valid email.", "يرجى إدخال بريد إلكتروني صحيح.");
  if (!gender) return err("Please select your gender.", "يرجى اختيار الجنس.");
  if (!phone) return err("Please add a phone / WhatsApp number.", "يرجى إدخال رقم الهاتف / واتساب.");
  if (!address) return err("Please add your address.", "يرجى إدخال العنوان.");
  if (!talent) return err("Please choose a talent.", "يرجى اختيار الموهبة.");
  if (talent === "Modeling" && !rateSession)
    return err("Please add your expected rate per session.", "يرجى إدخال السعر المتوقّع لكل جلسة.");

  if (!isDbEnabled()) {
    return err(
      "We couldn't reach our inbox right now. Please email create@marker.ps directly.",
      "تعذّر الإرسال الآن. يرجى مراسلتنا مباشرة على create@marker.ps."
    );
  }

  try {
    await ensureApplicationsTable();
    await createApplication({
      firstName,
      lastName,
      gender,
      email,
      phone,
      address,
      talent,
      rateSession: talent === "Modeling" ? rateSession : "",
      rate: get("rate"),
      instagram: get("instagram"),
      workUrl: get("workUrl"),
      lang: ar ? "ar" : "en",
    });
  } catch {
    return err("Something went wrong. Please email create@marker.ps.", "حدث خطأ ما. يرجى مراسلتنا على create@marker.ps.");
  }

  return { ok: true };
}
