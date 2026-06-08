"use server";

import { isDbEnabled } from "@/lib/db";
import { ensureInquiriesTable, createInquiry } from "@/lib/inquiries";

export type InquiryState = { ok: boolean; error?: string };

// Public — called from the site's contact form (no auth). Validates, drops
// obvious bots via a honeypot, and stores the lead for the admin inbox.
export async function submitInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const ar = String(formData.get("lang") || "") === "ar";

  // Honeypot: real users never fill the hidden "company" field. Pretend success.
  if (String(formData.get("company") || "").trim()) return { ok: true };

  const get = (k: string) => String(formData.get(k) || "").trim();
  const name = get("name");
  const email = get("email");

  if (!name || !/.+@.+\..+/.test(email)) {
    return {
      ok: false,
      error: ar ? "يرجى إدخال اسمك وبريد إلكتروني صحيح." : "Please add your name and a valid email.",
    };
  }

  if (!isDbEnabled()) {
    return {
      ok: false,
      error: ar
        ? "تعذّر الإرسال الآن. يرجى مراسلتنا مباشرة على create@marker.ps."
        : "We couldn't reach our inbox right now. Please email create@marker.ps directly.",
    };
  }

  try {
    await ensureInquiriesTable();
    await createInquiry({
      name,
      email,
      phone: get("phone"),
      brand: get("brand"),
      service: get("service"),
      message: get("message"),
      lang: ar ? "ar" : "en",
    });
  } catch {
    return {
      ok: false,
      error: ar
        ? "حدث خطأ ما. يرجى مراسلتنا على create@marker.ps."
        : "Something went wrong. Please email create@marker.ps.",
    };
  }

  return { ok: true };
}
