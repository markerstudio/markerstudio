"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useLang } from "@/lib/useLang";
import { submitApplication, type ApplicationState } from "@/app/careers-actions";

const label = "block text-sm font-medium text-neutral-900 mb-2";
const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange";

// Talent options — the stored value stays English; the label is bilingual.
const TALENTS: { value: string; en: string; ar: string }[] = [
  { value: "Design", en: "Design", ar: "تصميم" },
  { value: "Modeling", en: "Modeling", ar: "موديل" },
  { value: "Content Creation", en: "Content Creation", ar: "صناعة المحتوى" },
  { value: "Photography", en: "Photography", ar: "تصوير" },
  { value: "Video Editing", en: "Video Editing", ar: "مونتاج فيديو" },
  { value: "Motion Graphics", en: "Motion Graphics", ar: "موشن جرافيك" },
  { value: "Copy Writing", en: "Copy Writing", ar: "كتابة محتوى" },
];

const T = {
  en: {
    eyebrow: "Marker Careers",
    intro: "If you are a Model, Graphic Designer, Content Creator, or a Photographer… fill in your information below!",
    firstName: "First name",
    lastName: "Last name",
    gender: "Gender",
    genderOptions: [{ v: "Male", l: "Male" }, { v: "Female", l: "Female" }],
    select: "Select…",
    email: "Email",
    phone: "Phone / WhatsApp",
    address: "Address",
    talent: "Talent",
    rateSession: "Expected rate per session (90~120 minutes) in ILS",
    rate: "Rate (per project or per hour)",
    rateHint: "If modeling is chosen, keep it empty.",
    instagram: "Instagram account",
    work: "Show your work",
    workHint: "A link to your portfolio, drive, or reel.",
    required: "Required",
    submit: "Submit",
    sending: "Sending…",
    successTitle: "Application received",
    successBody: "Thanks — we've got your details. If there's a fit, we'll reach out.",
    backHome: "Back to site →",
  },
  ar: {
    eyebrow: "وظائف ماركر",
    intro: "إذا كنت موديل، أو مصمّم جرافيك، أو صانع محتوى، أو مصوّر… عبّئ معلوماتك بالأسفل!",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    gender: "الجنس",
    genderOptions: [{ v: "Male", l: "ذكر" }, { v: "Female", l: "أنثى" }],
    select: "اختر…",
    email: "البريد الإلكتروني",
    phone: "الهاتف / واتساب",
    address: "العنوان",
    talent: "الموهبة",
    rateSession: "السعر المتوقّع لكل جلسة (90~120 دقيقة) بالشيكل",
    rate: "السعر (لكل مشروع أو لكل ساعة)",
    rateHint: "إذا اخترت «موديل»، اتركه فارغاً.",
    instagram: "حساب إنستغرام",
    work: "اعرض أعمالك",
    workHint: "رابط لمعرض أعمالك أو درايف أو ريل.",
    required: "مطلوب",
    submit: "إرسال",
    sending: "جارٍ الإرسال…",
    successTitle: "تم استلام طلبك",
    successBody: "شكراً — وصلتنا معلوماتك. إذا كان هناك تطابق، سنتواصل معك.",
    backHome: "العودة إلى الموقع ←",
  },
} as const;

function SubmitButton({ text, sending }: { text: string; sending: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center rounded-md bg-orange px-6 text-sm font-semibold text-white transition-colors hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? sending : text}
    </button>
  );
}

export default function CareersForm() {
  const [lang, setLang] = useLang();
  const t = T[lang];
  const [talent, setTalent] = useState("");
  const [state, action] = useFormState(submitApplication, { ok: false } as ApplicationState);
  const dir = lang === "ar" ? "rtl" : "ltr";

  if (state.ok) {
    return (
      <div dir={dir} className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl text-white">✓</div>
        <h1 className="text-2xl font-bold text-neutral-900">{t.successTitle}</h1>
        <p className="mt-2 text-sm leading-7 text-neutral-600">{t.successBody}</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-orange hover:text-orange-deep">{t.backHome}</a>
      </div>
    );
  }

  const req = <span className="text-orange">*</span>;

  return (
    <form dir={dir} action={action} className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-9">
      <input type="hidden" name="lang" value={lang} />
      {/* Honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-orange">{t.eyebrow}</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{t.intro}</h1>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
          <button type="button" onClick={() => setLang("en")} className={lang === "en" ? "bg-neutral-900 px-2.5 py-1.5 text-white" : "px-2.5 py-1.5 text-neutral-600"}>EN</button>
          <button type="button" onClick={() => setLang("ar")} className={lang === "ar" ? "bg-neutral-900 px-2.5 py-1.5 text-white" : "px-2.5 py-1.5 text-neutral-600"}>ع</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={label}>{t.firstName} {req}</label>
          <input name="firstName" required className={input} />
        </div>
        <div>
          <label className={label}>{t.lastName} {req}</label>
          <input name="lastName" required className={input} />
        </div>
        <div>
          <label className={label}>{t.gender} {req}</label>
          <select name="gender" required defaultValue="" className={input}>
            <option value="" disabled>{t.select}</option>
            {t.genderOptions.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t.email} {req}</label>
          <input type="email" name="email" required className={input} placeholder="you@email.com" />
        </div>
        <div>
          <label className={label}>{t.phone} {req}</label>
          <input type="tel" name="phone" required className={input} placeholder="+970 5…" dir="ltr" />
        </div>
        <div>
          <label className={label}>{t.address} {req}</label>
          <input name="address" required className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t.talent} {req}</label>
          <select name="talent" required value={talent} onChange={(e) => setTalent(e.target.value)} className={input}>
            <option value="" disabled>{t.select}</option>
            {TALENTS.map((tt) => <option key={tt.value} value={tt.value}>{lang === "ar" ? tt.ar : tt.en}</option>)}
          </select>
        </div>

        {talent === "Modeling" && (
          <div className="sm:col-span-2">
            <label className={label}>{t.rateSession} {req}</label>
            <input name="rateSession" required className={input} placeholder="ILS" />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={label}>{t.rate}</label>
          <input name="rate" className={input} />
          <p className="mt-1.5 text-xs text-neutral-400">{t.rateHint}</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t.instagram}</label>
          <input name="instagram" className={input} placeholder="@username" dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t.work}</label>
          <input name="workUrl" className={input} placeholder="https://…" dir="ltr" />
          <p className="mt-1.5 text-xs text-neutral-400">{t.workHint}</p>
        </div>
      </div>

      {state.error && <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="mt-7">
        <SubmitButton text={t.submit} sending={t.sending} />
      </div>
    </form>
  );
}
