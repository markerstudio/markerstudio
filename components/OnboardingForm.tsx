"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MARKER_CONTENT } from "@/lib/content";
import { useLang } from "@/lib/useLang";
import { submitOnboarding, type OnboardingState } from "@/app/onboarding-actions";

/* Tailwind class kits — a shadcn-style form rendered with the utilities that
   already work in this project (accented in Marker orange). */
const label = "block text-sm font-medium text-neutral-900 mb-2";
const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange";
const area = `${input} min-h-[96px] resize-y`;
const sep = "my-9 h-px w-full bg-neutral-200";
const sectionTitle = "text-base font-semibold text-neutral-900";
const optionCard =
  "relative flex cursor-pointer items-center gap-2.5 rounded-md border border-neutral-300 px-4 py-2.5 text-sm text-neutral-800 transition select-none has-[:checked]:border-orange has-[:checked]:bg-orange-50 has-[:checked]:text-neutral-900 hover:border-neutral-400";

const TXT = {
  en: {
    title: "Let's build your brand",
    sub: "Fill this in and we'll set up your private portal — you'll be signed in the moment you finish.",
    pkgHeading: "Your package",
    pkgHint: "Confirm the package you'd like — switch if you change your mind.",
    included: "What's included",
    recommended: "recommended",
    sec1: "Your information",
    sec2: "Brand details",
    sec3: "Design details",
    sec4: "Anything else",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    location: "Country | City",
    password: "Create a password",
    passwordHelp: "You'll use this to sign in to your portal.",
    brandName: "Name of brand | company",
    brandDescription: "Describe your brand / company",
    logoLanguage: "Logo language",
    arabic: "Arabic",
    english: "English",
    other: "Other",
    products: "Describe your products",
    competitors: "Competitors",
    businessGoals: "Business goals",
    audienceGender: "Target audience — gender",
    female: "Female",
    male: "Male",
    both: "Both",
    audienceAge: "Target audience — age range",
    onlinePresence: "Online presence — a website or social media?",
    yes: "Yes",
    no: "No",
    symbolShape: "Do you have a symbol or shape in mind?",
    colorInMind: "Do you have a colour in mind?",
    colorDetail: "Which colour(s)?",
    exactLogoText: "Exact logo text",
    tagline: "Tagline | Slogan",
    existingDesign: "Any existing designs?",
    additionalNotes: "Anything else you want to tell us?",
    newsletter: "Yes, subscribe me to your newsletter.",
    submit: "Create my portal",
    sending: "Creating…",
    back: "← Back to site",
    optional: "optional",
  },
  ar: {
    title: "لنبنِ علامتك",
    sub: "املأ النموذج وسنجهّز بوابتك الخاصة — ستُسجَّل دخولك فور الانتهاء.",
    pkgHeading: "باقتك",
    pkgHint: "أكّد الباقة التي تريدها — بإمكانك تغييرها.",
    included: "ما تشمله",
    recommended: "موصى بها",
    sec1: "معلوماتك",
    sec2: "تفاصيل العلامة",
    sec3: "تفاصيل التصميم",
    sec4: "أي شيء آخر",
    firstName: "الاسم",
    lastName: "اسم العائلة",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    location: "الدولة | المدينة",
    password: "أنشئ كلمة مرور",
    passwordHelp: "ستستخدمها لتسجيل الدخول إلى بوابتك.",
    brandName: "اسم العلامة أو الشركة",
    brandDescription: "اشرح قليلاً عن علامتك أو شركتك",
    logoLanguage: "لغة اللوجو",
    arabic: "عربي",
    english: "إنجليزي",
    other: "أخرى",
    products: "اشرح قليلاً عن منتجاتك",
    competitors: "من هم منافسوك؟",
    businessGoals: "ما هو هدف مشروعك؟",
    audienceGender: "الجمهور المستهدف — الجنس",
    female: "أنثى",
    male: "ذكر",
    both: "الكل",
    audienceAge: "الجمهور المستهدف — الفئة العمرية",
    onlinePresence: "هل لديك وجود على الإنترنت؟ (موقع أو سوشال ميديا)",
    yes: "نعم",
    no: "لا",
    symbolShape: "هل يوجد شكل معيّن تحب وجوده في الهوية؟",
    colorInMind: "هل تريد أن نأخذ بعين الاعتبار لوناً معيّناً؟",
    colorDetail: "أي لون؟",
    exactLogoText: "النص الحرفي للوجو",
    tagline: "ما هو شعار علامتك؟",
    existingDesign: "هل قمت بعمل تصاميم من قبل؟",
    additionalNotes: "هل تريد إضافة معلومات أخرى؟",
    newsletter: "نعم، اشترك لي في نشرتكم البريدية.",
    submit: "أنشئ بوابتي",
    sending: "جارٍ الإنشاء…",
    back: "→ العودة للموقع",
    optional: "اختياري",
  },
} as const;

const AGES = ["0–18", "19–30", "31–50", "50+"];

function Check({ className = "h-4 w-4 shrink-0 text-orange" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Req() {
  return <span className="text-red-500">*</span>;
}

function SubmitButton({ label: text, sending }: { label: string; sending: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-md bg-orange px-6 text-sm font-semibold text-white transition-colors hover:bg-orange-deep disabled:opacity-60"
    >
      {pending ? sending : text}
    </button>
  );
}

export default function OnboardingForm({ pkg }: { pkg: number }) {
  const [lang, setLang] = useLang();
  const t = TXT[lang];

  const branding = MARKER_CONTENT[lang].pricing.categories.find((c) => c.key === "branding");
  const plans = branding?.plans ?? [];
  const initial = Number.isInteger(pkg) && pkg >= 0 && pkg < plans.length ? pkg : Math.min(1, plans.length - 1);
  const [sel, setSel] = useState(initial);
  const selected = plans[sel];

  const [state, action] = useFormState(submitOnboarding, { ok: false } as OnboardingState);

  return (
    <form action={action} className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-9">
      {/* Hidden state carried into the submission */}
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="plan" value={selected?.name ?? ""} />
      {(selected?.features ?? []).map((f) => (
        <input key={f} type="hidden" name="planFeatures" value={f} />
      ))}
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />

      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t.title}</h1>
          <p className="mt-1.5 text-sm leading-6 text-neutral-500">{t.sub}</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
          <button type="button" onClick={() => setLang("en")} className={lang === "en" ? "bg-neutral-900 px-2.5 py-1.5 text-white" : "px-2.5 py-1.5 text-neutral-600"}>EN</button>
          <button type="button" onClick={() => setLang("ar")} className={lang === "ar" ? "bg-neutral-900 px-2.5 py-1.5 text-white" : "px-2.5 py-1.5 text-neutral-600"}>ع</button>
        </div>
      </div>

      {/* Package selector — prefilled from the package they clicked */}
      {plans.length > 0 && (
        <section>
          <h2 className={sectionTitle}>{t.pkgHeading} <Req /></h2>
          <p className="mt-1 mb-4 text-sm text-neutral-500">{t.pkgHint}</p>
          <div className="space-y-3">
            {plans.map((plan, i) => (
              <label
                key={plan.name}
                className={`relative block cursor-pointer rounded-lg border p-4 transition ${
                  sel === i ? "border-orange ring-2 ring-orange/20" : "border-neutral-300 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="__pkg"
                  className="sr-only"
                  checked={sel === i}
                  onChange={() => setSel(i)}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-neutral-900">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${sel === i ? "border-orange" : "border-neutral-400"}`}>
                      {sel === i && <span className="h-2 w-2 rounded-full bg-orange" />}
                    </span>
                    {plan.name}
                  </span>
                  {plan.featured && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-deep">{t.recommended}</span>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5 ps-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-neutral-600">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className={sep} />

      {/* Your information */}
      <section>
        <h2 className={sectionTitle}>{t.sec1}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{t.firstName} <Req /></label>
            <input name="firstName" required className={input} placeholder="Elias" />
          </div>
          <div>
            <label className={label}>{t.lastName} <Req /></label>
            <input name="lastName" required className={input} placeholder="Boulos" />
          </div>
          <div>
            <label className={label}>{t.email} <Req /></label>
            <input name="email" type="email" required className={input} placeholder="you@brand.com" />
          </div>
          <div>
            <label className={label}>{t.phone} <Req /></label>
            <input name="phone" type="tel" required className={input} placeholder="+970 5…" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t.location} <Req /></label>
            <input name="location" required className={input} placeholder="Palestine | Beit Sahour" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t.password} <Req /></label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
            <p className="mt-1.5 text-xs text-neutral-500">{t.passwordHelp}</p>
          </div>
        </div>
      </section>

      <div className={sep} />

      {/* Brand details */}
      <section>
        <h2 className={sectionTitle}>{t.sec2}</h2>
        <div className="mt-4 space-y-5">
          <div>
            <label className={label}>{t.brandName} <Req /></label>
            <input name="brandName" required className={input} placeholder="Aurora Goods" />
          </div>
          <div>
            <label className={label}>{t.brandDescription}</label>
            <textarea name="brandDescription" className={area} />
          </div>
          <div>
            <span className={label}>{t.logoLanguage}</span>
            <div className="grid grid-cols-3 gap-3">
              {[t.arabic, t.english, t.other].map((opt) => (
                <label key={opt} className={`${optionCard} justify-center`}>
                  <input type="checkbox" name="logoLanguage" value={opt} className="sr-only" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>{t.products}</label>
            <textarea name="products" className={area} />
          </div>
          <div>
            <label className={label}>{t.competitors}</label>
            <input name="competitors" className={input} />
          </div>
          <div>
            <label className={label}>{t.businessGoals}</label>
            <textarea name="businessGoals" className={area} />
          </div>
          <div>
            <span className={label}>{t.audienceGender}</span>
            <div className="grid grid-cols-3 gap-3">
              {[t.female, t.male, t.both].map((opt) => (
                <label key={opt} className={`${optionCard} justify-center`}>
                  <input type="checkbox" name="audienceGender" value={opt} className="sr-only" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>{t.audienceAge}</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {AGES.map((opt) => (
                <label key={opt} className={`${optionCard} justify-center`}>
                  <input type="checkbox" name="audienceAge" value={opt} className="sr-only" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>{t.onlinePresence}</span>
            <div className="grid grid-cols-2 gap-3">
              {[{ v: "yes", l: t.yes }, { v: "no", l: t.no }].map((o) => (
                <label key={o.v} className={`${optionCard} justify-center`}>
                  <input type="radio" name="onlinePresence" value={o.v} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={sep} />

      {/* Design details */}
      <section>
        <h2 className={sectionTitle}>{t.sec3}</h2>
        <div className="mt-4 space-y-5">
          <div>
            <label className={label}>{t.symbolShape}</label>
            <textarea name="symbolShape" className={area} />
          </div>
          <div>
            <span className={label}>{t.colorInMind}</span>
            <div className="grid grid-cols-2 gap-3">
              {[{ v: "yes", l: t.yes }, { v: "no", l: t.no }].map((o) => (
                <label key={o.v} className={`${optionCard} justify-center`}>
                  <input type="radio" name="colorInMind" value={o.v} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </div>
            <input name="colorDetail" className={`${input} mt-3`} placeholder={t.colorDetail} />
          </div>
          <div>
            <label className={label}>{t.exactLogoText}</label>
            <input name="exactLogoText" className={input} />
          </div>
          <div>
            <label className={label}>{t.tagline}</label>
            <input name="tagline" className={input} />
          </div>
          <div>
            <span className={label}>{t.existingDesign}</span>
            <div className="grid grid-cols-2 gap-3">
              {[{ v: "yes", l: t.yes }, { v: "no", l: t.no }].map((o) => (
                <label key={o.v} className={`${optionCard} justify-center`}>
                  <input type="radio" name="existingDesign" value={o.v} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={sep} />

      {/* Anything else */}
      <section>
        <h2 className={sectionTitle}>{t.sec4}</h2>
        <div className="mt-4 space-y-4">
          <textarea name="additionalNotes" className={area} placeholder={t.additionalNotes} />
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-700">
            <input type="checkbox" name="newsletter" defaultChecked className="h-4 w-4 rounded border-neutral-300 text-orange focus:ring-orange/30" />
            {t.newsletter}
          </label>
        </div>
      </section>

      {state.error && (
        <p className="mt-7 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{state.error}</p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <a href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">{t.back}</a>
        <SubmitButton label={t.submit} sending={t.sending} />
      </div>
    </form>
  );
}
