"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MARKER_CONTENT } from "@/lib/content";
import { useLang } from "@/lib/useLang";
import { submitOnboarding, type OnboardingState } from "@/app/onboarding-actions";

/* Marker Glass form kit — labels/inputs/option tiles built from the lq-*
   classes in globals.css. Field names and values are unchanged: the whole
   wizard is ONE form; inactive steps are hidden with CSS (never unmounted)
   so every input still submits through the single submitOnboarding action. */
const label = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-2";
const input = "lq-input";
const area = "lq-input min-h-[96px] resize-y";
const optionCard =
  "lq-press relative flex cursor-pointer items-center gap-2.5 rounded-2xl border border-charcoal/10 bg-white/60 px-4 py-2.5 text-sm text-charcoal-80 transition select-none has-[:checked]:border-orange has-[:checked]:bg-orange/10 has-[:checked]:text-ink hover:border-charcoal/25";

const TXT = {
  en: {
    title: "Let's build your brand",
    sub: "A few quick steps and we'll set up your private portal — you'll be signed in the moment you finish.",
    servicesHeading: "What do you need?",
    servicesHint: "Pick a package, or choose individual services below — at least one.",
    branding: "Branding",
    marketing: "Marketing",
    include: "Include",
    orServices: "Or pick individual services",
    orServicesHint: "Prefer specific deliverables instead of a package? Select what you need.",
    otherPlaceholder: "Tell us what else you need…",
    atLeastOne: "Please pick at least one package or service to continue.",
    recommended: "recommended",
    sec1: "Your information",
    sec1Hint: "So we know who we're building for — and how to reach you.",
    sec2: "Brand details",
    sec2Hint: "Tell us about the brand itself.",
    sec3: "Design details",
    sec3Hint: "A few pointers for the design work.",
    sec4: "Anything else",
    sec4Hint: "Last step — anything we missed, then you're in.",
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
    // Wizard chrome
    next: "Next",
    prev: "Back",
    stepWord: "Step",
    ofWord: "of",
    stepServices: "Services",
    stepYou: "About you",
    stepBrand: "Your brand",
    stepDesign: "Design",
    stepFinal: "Finish",
    review: "Quick review",
    reviewHint: "Here's what we'll set up for you.",
    reviewName: "Name",
    reviewNothing: "Nothing selected yet — head back to step 1.",
  },
  ar: {
    title: "لنبنِ علامتك",
    sub: "خطوات سريعة قليلة وسنجهّز بوابتك الخاصة — ستُسجَّل دخولك فور الانتهاء.",
    servicesHeading: "ماذا تحتاج؟",
    orServices: "أو اختر خدمات مفردة",
    orServicesHint: "تفضّل خدمات محدّدة بدل باقة؟ اختر ما تحتاجه.",
    otherPlaceholder: "أخبرنا بما تحتاجه أيضاً…",
    servicesHint: "اختر باقة، أو خدمات مفردة أدناه — واحدة على الأقل.",
    branding: "البراندنج",
    marketing: "التسويق",
    include: "تضمين",
    atLeastOne: "يرجى تضمين خدمة واحدة على الأقل للمتابعة.",
    recommended: "موصى بها",
    sec1: "معلوماتك",
    sec1Hint: "لنعرف لمن نبني — وكيف نتواصل معك.",
    sec2: "تفاصيل العلامة",
    sec2Hint: "حدّثنا عن علامتك نفسها.",
    sec3: "تفاصيل التصميم",
    sec3Hint: "بعض الإرشادات لعملية التصميم.",
    sec4: "أي شيء آخر",
    sec4Hint: "الخطوة الأخيرة — أي شيء فاتنا، ثم تدخل بوابتك.",
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
    // Wizard chrome
    next: "التالي",
    prev: "السابق",
    stepWord: "الخطوة",
    ofWord: "من",
    stepServices: "الخدمات",
    stepYou: "عنك",
    stepBrand: "علامتك",
    stepDesign: "التصميم",
    stepFinal: "الختام",
    review: "مراجعة سريعة",
    reviewHint: "هذا ما سنجهّزه لك.",
    reviewName: "الاسم",
    reviewNothing: "لم تختر شيئاً بعد — عد إلى الخطوة الأولى.",
  },
} as const;

const AGES = ["0–18", "19–30", "31–50", "50+"];

// À-la-carte services — the canonical English label is submitted; the Arabic
// label is display-only. "Other" reveals a free-text field.
const SERVICES: { en: string; ar: string; icon: string }[] = [
  { en: "Website", ar: "موقع إلكتروني", icon: "🌐" },
  { en: "Menu design", ar: "تصميم منيو", icon: "🍽️" },
  { en: "Catalog design", ar: "تصميم كتالوج", icon: "📖" },
  { en: "App design", ar: "تصميم تطبيق", icon: "📱" },
  { en: "Packaging design", ar: "تصميم تغليف", icon: "📦" },
  { en: "Print & stationery", ar: "مطبوعات وقرطاسية", icon: "🖨️" },
  { en: "Social media kit", ar: "حزمة سوشال ميديا", icon: "✦" },
  { en: "Other", ar: "أخرى", icon: "➕" },
];

type Plan = { name: string; features: string[]; featured?: boolean };
type StepKey = "services" | "you" | "brand" | "design" | "final";

function Check({ className = "h-4 w-4 shrink-0 text-orange" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Round check badge — filled orange when on, hollow when off.
function CheckBadge({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        on ? "border-orange bg-orange text-white shadow-[0_4px_10px_-3px_rgba(255,145,0,0.6)]" : "border-charcoal/20 bg-white/70 text-transparent"
      }`}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

function Req() {
  return <span className="text-rose-500">*</span>;
}

function SubmitButton({ label: text, sending, disabled }: { label: string; sending: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="lq-btn lq-btn--primary min-w-[160px]">
      {pending ? sending : text}
    </button>
  );
}

// A toggleable service block: big selectable glass tile — check badge in the
// header, and (when on) its plan radio cards.
function ServiceBlock({
  name,
  includeLabel,
  recommended,
  on,
  setOn,
  plans,
  sel,
  setSel,
  group,
}: {
  name: string;
  includeLabel: string;
  recommended: string;
  on: boolean;
  setOn: (v: boolean) => void;
  plans: Plan[];
  sel: number;
  setSel: (i: number) => void;
  group: string;
}) {
  return (
    <div className={`lq-card p-4 sm:p-5 transition ${on ? "!border-orange/50 ring-2 ring-orange/15" : ""}`}>
      <label className="lq-press flex cursor-pointer items-center justify-between gap-3 select-none">
        <span className="font-display font-bold text-[16px] tracking-tight text-ink">{name}</span>
        <span className="flex items-center gap-2.5 text-sm text-charcoal-60">
          {includeLabel}
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="sr-only" />
          <CheckBadge on={on} />
        </span>
      </label>

      {on && (
        <div className="mt-4 space-y-3">
          {plans.map((plan, i) => (
            <label
              key={plan.name}
              className={`lq-press relative block cursor-pointer rounded-2xl border bg-white/80 p-4 transition ${
                sel === i ? "border-orange ring-2 ring-orange/20" : "border-charcoal/10 hover:border-charcoal/25"
              }`}
            >
              <input type="radio" name={group} className="sr-only" checked={sel === i} onChange={() => setSel(i)} />
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-display font-semibold text-ink">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${sel === i ? "border-orange" : "border-charcoal/25"}`}>
                    {sel === i && <span className="h-2 w-2 rounded-full bg-orange" />}
                  </span>
                  {plan.name}
                </span>
                {plan.featured && <span className="lq-chip lq-chip--orange !text-[10.5px]">{recommended}</span>}
              </div>
              <ul className="mt-3 space-y-1.5 ps-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-charcoal-60">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OnboardingForm({ branding, marketing }: { branding: number; marketing: number }) {
  const [lang, setLang] = useLang();
  const t = TXT[lang];

  const cats = MARKER_CONTENT[lang].pricing.categories;
  const brandingPlans = (cats.find((c) => c.key === "branding")?.plans ?? []) as Plan[];
  const marketingPlans = (cats.find((c) => c.key === "marketing")?.plans ?? []) as Plan[];

  const bInit = Number.isInteger(branding) && branding >= 0;
  const mInit = Number.isInteger(marketing) && marketing >= 0;

  // Whichever package they clicked is on + selected; default to branding when
  // someone opens /onboarding directly with no package.
  const [brandingOn, setBrandingOn] = useState(bInit || (!bInit && !mInit));
  const [marketingOn, setMarketingOn] = useState(mInit);
  const [bSel, setBSel] = useState(bInit ? branding : Math.min(1, Math.max(0, brandingPlans.length - 1)));
  const [mSel, setMSel] = useState(mInit ? marketing : Math.min(1, Math.max(0, marketingPlans.length - 1)));
  const [svc, setSvc] = useState<string[]>([]);
  const toggleSvc = (key: string) => setSvc((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  const noService = !brandingOn && !marketingOn && svc.length === 0;
  const [state, action] = useFormState(submitOnboarding, { ok: false } as OnboardingState);

  const bPlan = brandingPlans[bSel];
  const mPlan = marketingPlans[mSel];

  /* ---- Wizard scaffolding ---- */
  // Design details only exists while branding is included — same condition as
  // the old single-page form. Branding is only toggled on step 1, so the list
  // can't shrink underneath a later step (we clamp anyway).
  const stepKeys: StepKey[] = brandingOn ? ["services", "you", "brand", "design", "final"] : ["services", "you", "brand", "final"];
  const [step, setStep] = useState(0);
  const idx = Math.min(step, stepKeys.length - 1);
  const activeKey = stepKeys[idx];
  const formRef = useRef<HTMLFormElement>(null);

  const stepPill: Record<StepKey, string> = {
    services: t.stepServices,
    you: t.stepYou,
    brand: t.stepBrand,
    design: t.stepDesign,
    final: t.stepFinal,
  };

  // Mirrors of a few key inputs (they stay uncontrolled) for the review card.
  const [mirror, setMirror] = useState({ firstName: "", lastName: "", email: "", brandName: "" });
  const reflect = (k: keyof typeof mirror) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMirror((m) => ({ ...m, [k]: e.target.value }));

  const scrollTop = () => {
    try {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      formRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } catch {
      /* ignore */
    }
  };

  // Validate only the visible step's fields (native bubbles), then advance.
  // This keeps `required` honest even though later steps are display:none at
  // submit time — every field was checked on the way through.
  const goNext = () => {
    if (activeKey === "services" && noService) return;
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-step="${activeKey}"]`);
    if (panel) {
      const controls = panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
      for (const el of Array.from(controls)) {
        if (!el.checkValidity()) {
          el.reportValidity();
          return;
        }
      }
    }
    setStep(Math.min(idx + 1, stepKeys.length - 1));
    scrollTop();
  };
  const goBack = () => {
    setStep(Math.max(idx - 1, 0));
    scrollTop();
  };

  // Enter mid-wizard should feel like tapping Next, not submitting early.
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || activeKey === "final") return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA") return;
    e.preventDefault();
    goNext();
  };

  // Panels stay mounted; the inactive ones are display:none. Re-adding
  // .lq-rise when a panel becomes active restarts its entrance animation.
  const panelCls = (k: StepKey) => (k === activeKey ? "lq-rise" : "hidden");

  // Review card content — everything the wizard will submit, at a glance.
  const chosen: string[] = [
    ...(brandingOn && bPlan ? [`${t.branding} — ${bPlan.name}`] : []),
    ...(marketingOn && mPlan ? [`${t.marketing} — ${mPlan.name}`] : []),
    ...svc.map((s) => {
      const item = SERVICES.find((x) => x.en === s);
      return item ? (lang === "ar" ? item.ar : item.en) : s;
    }),
  ];

  return (
    <form
      ref={formRef}
      action={action}
      onKeyDown={onKeyDown}
      className="lq-card lq-rise mx-auto max-w-3xl scroll-mt-6 p-6 sm:p-9"
    >
      <input type="hidden" name="lang" value={lang} />
      {brandingOn && bPlan && (
        <>
          <input type="hidden" name="brandingPlan" value={bPlan.name} />
          {bPlan.features.map((f) => (
            <input key={f} type="hidden" name="brandingFeatures" value={f} />
          ))}
        </>
      )}
      {marketingOn && mPlan && (
        <>
          <input type="hidden" name="marketingPlan" value={mPlan.name} />
          {mPlan.features.map((f) => (
            <input key={f} type="hidden" name="marketingFeatures" value={f} />
          ))}
        </>
      )}
      {svc.map((sname) => (
        <input key={sname} type="hidden" name="services" value={sname} />
      ))}
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] h-px w-px opacity-0" />

      {/* ---- Header + glass step indicator ---- */}
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">
              {t.stepWord} {idx + 1} {t.ofWord} {stepKeys.length}
            </p>
            <h1 className="mt-1 font-display font-extrabold text-[26px] leading-tight tracking-tight text-ink">{t.title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-charcoal-60">{t.sub}</p>
          </div>
          <div className="lq-seg shrink-0">
            <button type="button" onClick={() => setLang("en")} className={`lq-seg__opt ${lang === "en" ? "is-on" : ""}`}>EN</button>
            <button type="button" onClick={() => setLang("ar")} className={`lq-seg__opt ${lang === "ar" ? "is-on" : ""}`}>ع</button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {stepKeys.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => i < idx && setStep(i)}
              disabled={i > idx}
              aria-current={i === idx ? "step" : undefined}
              className={`lq-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-[11.5px] font-semibold transition ${
                i === idx
                  ? "border-orange/40 bg-orange/15 text-orange-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  : i < idx
                  ? "border-charcoal/10 bg-white/70 text-charcoal-80"
                  : "border-charcoal/5 bg-transparent text-charcoal-40"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9.5px] font-bold ${
                  i < idx ? "bg-orange text-white" : i === idx ? "bg-orange/25 text-orange-deep" : "bg-charcoal/10 text-charcoal-60"
                }`}
              >
                {i < idx ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {stepPill[k]}
            </button>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-charcoal/10" role="presentation">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FFA226] to-[#F57F00] shadow-[0_2px_8px_rgba(255,145,0,0.5)] transition-[width] duration-500 ease-[cubic-bezier(0.34,1.45,0.5,1)]"
            style={{ width: `${((idx + 1) / stepKeys.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ---- Step 1 · Services — branding and/or marketing ---- */}
      <section data-step="services" className={panelCls("services")}>
        <h2 className="font-display font-bold text-[18px] tracking-tight text-ink">
          {t.servicesHeading} <Req />
        </h2>
        <p className="mt-1 mb-4 text-sm text-charcoal-60">{t.servicesHint}</p>
        <div className="space-y-4">
          <ServiceBlock name={t.branding} includeLabel={t.include} recommended={t.recommended} on={brandingOn} setOn={setBrandingOn} plans={brandingPlans} sel={bSel} setSel={setBSel} group="__branding" />
          <ServiceBlock name={t.marketing} includeLabel={t.include} recommended={t.recommended} on={marketingOn} setOn={setMarketingOn} plans={marketingPlans} sel={mSel} setSel={setMSel} group="__marketing" />
        </div>

        {/* À-la-carte services */}
        <div className="mt-6">
          <div className="mb-1 font-display font-bold text-[14px] tracking-tight text-ink">{t.orServices}</div>
          <p className="mb-3 text-sm text-charcoal-60">{t.orServicesHint}</p>
          <div className="lq-stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SERVICES.map((s, i) => {
              const on = svc.includes(s.en);
              return (
                <button
                  type="button"
                  key={s.en}
                  onClick={() => toggleSvc(s.en)}
                  aria-pressed={on}
                  style={{ "--i": i } as React.CSSProperties}
                  className={`lq-press flex items-center gap-2.5 rounded-2xl border px-3.5 py-3.5 text-start text-sm transition ${
                    on
                      ? "border-orange bg-orange/10 text-ink shadow-[0_8px_20px_-10px_rgba(255,145,0,0.55)]"
                      : "border-charcoal/10 bg-white/60 text-charcoal-80 hover:border-charcoal/25 hover:bg-white/85"
                  }`}
                >
                  <span className="text-lg leading-none">{s.icon}</span>
                  <span className="flex-1 font-medium">{lang === "ar" ? s.ar : s.en}</span>
                  <CheckBadge on={on} />
                </button>
              );
            })}
          </div>
          {svc.includes("Other") && (
            <input name="servicesOther" className={`${input} mt-3`} placeholder={t.otherPlaceholder} />
          )}
        </div>

        {noService && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-medium text-rose-700">{t.atLeastOne}</p>}
      </section>

      {/* ---- Step 2 · Your information ---- */}
      <section data-step="you" className={panelCls("you")}>
        <h2 className="font-display font-bold text-[18px] tracking-tight text-ink">{t.sec1}</h2>
        <p className="mt-1 text-sm text-charcoal-60">{t.sec1Hint}</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{t.firstName} <Req /></label>
            <input name="firstName" required className={input} placeholder="Elias" onChange={reflect("firstName")} />
          </div>
          <div>
            <label className={label}>{t.lastName} <Req /></label>
            <input name="lastName" required className={input} placeholder="Boulos" onChange={reflect("lastName")} />
          </div>
          <div>
            <label className={label}>{t.email} <Req /></label>
            <input name="email" type="email" required className={input} placeholder="you@brand.com" onChange={reflect("email")} />
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
            <p className="mt-1.5 text-xs text-charcoal-60">{t.passwordHelp}</p>
          </div>
        </div>
      </section>

      {/* ---- Step 3 · Brand details — applies to both services ---- */}
      <section data-step="brand" className={panelCls("brand")}>
        <h2 className="font-display font-bold text-[18px] tracking-tight text-ink">{t.sec2}</h2>
        <p className="mt-1 text-sm text-charcoal-60">{t.sec2Hint}</p>
        <div className="mt-5 space-y-5">
          <div>
            <label className={label}>{t.brandName} <Req /></label>
            <input name="brandName" required className={input} placeholder="Aurora Goods" onChange={reflect("brandName")} />
          </div>
          <div>
            <label className={label}>{t.brandDescription}</label>
            <textarea name="brandDescription" className={area} />
          </div>
          {brandingOn && (
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
          )}
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

      {/* ---- Step 4 · Design details — only when branding is included ---- */}
      {brandingOn && (
        <section data-step="design" className={panelCls("design")}>
          <h2 className="font-display font-bold text-[18px] tracking-tight text-ink">{t.sec3}</h2>
          <p className="mt-1 text-sm text-charcoal-60">{t.sec3Hint}</p>
          <div className="mt-5 space-y-5">
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
      )}

      {/* ---- Step 5 · Anything else + review ---- */}
      <section data-step="final" className={panelCls("final")}>
        <h2 className="font-display font-bold text-[18px] tracking-tight text-ink">{t.sec4}</h2>
        <p className="mt-1 text-sm text-charcoal-60">{t.sec4Hint}</p>
        <div className="mt-5 space-y-4">
          <textarea name="additionalNotes" className={area} placeholder={t.additionalNotes} />
          <label className="lq-press flex w-fit cursor-pointer items-center gap-2.5 text-sm text-charcoal-80">
            <input type="checkbox" name="newsletter" defaultChecked className="custom-checkbox" />
            {t.newsletter}
          </label>

          {/* Review — what the wizard is about to submit */}
          <div className="lq-well p-4 sm:p-5">
            <h3 className="font-display font-bold text-[14px] tracking-tight text-ink">{t.review}</h3>
            <p className="mt-0.5 text-xs text-charcoal-60">{t.reviewHint}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chosen.length > 0 ? (
                chosen.map((c) => (
                  <span key={c} className="lq-chip lq-chip--orange">{c}</span>
                ))
              ) : (
                <span className="text-sm font-medium text-rose-700">{t.reviewNothing}</span>
              )}
            </div>
            {(mirror.firstName || mirror.email || mirror.brandName) && (
              <dl className="mt-3 space-y-1 border-t border-charcoal/5 pt-3 text-sm">
                {(mirror.firstName || mirror.lastName) && (
                  <div className="flex gap-2">
                    <dt className="text-charcoal-60">{t.reviewName}:</dt>
                    <dd className="font-semibold text-ink">{`${mirror.firstName} ${mirror.lastName}`.trim()}</dd>
                  </div>
                )}
                {mirror.email && (
                  <div className="flex gap-2">
                    <dt className="text-charcoal-60">{t.email}:</dt>
                    <dd className="font-semibold text-ink" dir="ltr">{mirror.email}</dd>
                  </div>
                )}
                {mirror.brandName && (
                  <div className="flex gap-2">
                    <dt className="text-charcoal-60">{t.brandName}:</dt>
                    <dd className="font-semibold text-ink">{mirror.brandName}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>

        {state.error && (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-medium text-rose-700">{state.error}</p>
        )}
      </section>

      {/* ---- Wizard nav ---- */}
      <div className="mt-8 flex items-center justify-between gap-4 border-t border-charcoal/5 pt-6">
        {idx === 0 ? (
          <a href="/" className="lq-btn lq-btn--ghost no-underline">{t.back}</a>
        ) : (
          <button type="button" onClick={goBack} className="lq-btn lq-btn--glass">{t.prev}</button>
        )}
        {activeKey === "final" ? (
          <SubmitButton label={t.submit} sending={t.sending} disabled={noService} />
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={activeKey === "services" && noService}
            className="lq-btn lq-btn--primary min-w-[120px]"
          >
            {t.next}
          </button>
        )}
      </div>
    </form>
  );
}
