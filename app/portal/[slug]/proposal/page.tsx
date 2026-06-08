import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { acceptProposal } from "@/app/onboarding-actions";
import PortalTabs from "@/components/PortalTabs";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your proposal · Marker Studio", robots: { index: false, follow: false } };

const T = {
  en: {
    eyebrow: "Proposal",
    title: "Your proposal",
    preparedFor: "Prepared for",
    intro: "Here's what we'll build together, based on what you told us. Review it and accept when you're ready — we'll confirm pricing with you separately.",
    packageLabel: "Your package",
    includes: "Includes",
    scope: "How we'll work",
    steps: [
      { t: "Discover", d: "We study your brand, audience and goals from your brief." },
      { t: "Design", d: "We craft the identity and assets in your package, in Arabic & English." },
      { t: "Deliver", d: "You receive the files, with a round of refinement included." },
    ],
    investment: "Investment",
    investmentNote: "A tailored quote based on this scope — we'll confirm the exact figure with you before any work begins.",
    servicesLabel: "Services",
    totalLabel: "Total",
    recap: "What we captured",
    fields: { description: "Brand", products: "Products", goals: "Goals", audience: "Audience", presence: "Online presence", tagline: "Tagline" },
    acceptCta: "Accept proposal",
    acceptNote: "Accepting confirms this scope. Pricing is agreed separately before work starts.",
    acceptedTitle: "Proposal accepted",
    acceptedOn: "Accepted on",
    toPortal: "Continue to agreement →",
    toPortalPlain: "Go to your portal →",
  },
  ar: {
    eyebrow: "العرض",
    title: "عرضك",
    preparedFor: "أُعدّ لـ",
    intro: "هذا ما سنبنيه معاً، بناءً على ما أخبرتنا به. راجعه واقبله عندما تكون جاهزاً — سنؤكّد السعر معك بشكل منفصل.",
    packageLabel: "باقتك",
    includes: "يشمل",
    scope: "كيف سنعمل",
    steps: [
      { t: "اكتشاف", d: "ندرس علامتك وجمهورك وأهدافك من نموذجك." },
      { t: "تصميم", d: "نصمّم الهوية والأصول ضمن باقتك، بالعربية والإنجليزية." },
      { t: "تسليم", d: "تستلم الملفات، مع جولة تعديل واحدة مشمولة." },
    ],
    investment: "الاستثمار",
    investmentNote: "عرض سعر مفصّل حسب هذا النطاق — سنؤكّد الرقم النهائي معك قبل بدء أي عمل.",
    servicesLabel: "الخدمات",
    totalLabel: "الإجمالي",
    recap: "ما سجّلناه",
    fields: { description: "العلامة", products: "المنتجات", goals: "الأهداف", audience: "الجمهور", presence: "الوجود الرقمي", tagline: "الشعار" },
    acceptCta: "اقبل العرض",
    acceptNote: "قبولك يؤكّد هذا النطاق. يُتّفق على السعر بشكل منفصل قبل بدء العمل.",
    acceptedTitle: "تم قبول العرض",
    acceptedOn: "قُبل بتاريخ",
    toPortal: "تابع إلى الاتفاقية ←",
    toPortalPlain: "اذهب إلى بوابتك ←",
  },
} as const;

export default async function ProposalPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const brief = client.data.onboarding;
  if (!brief) redirect(`/portal/${client.slug}`);
  // Clients only see the proposal once the studio has sent it; admins can preview.
  if (s.role === "client" && !client.data.proposal?.published) redirect(`/portal/${client.slug}`);

  const lang = brief.lang === "ar" ? "ar" : "en";
  const t = T[lang];
  const isAdmin = s.role === "admin";
  const acceptedAt = client.data.proposal?.acceptedAt;
  const agreementSent = !!client.data.agreement?.published;
  const showProposalTab = isAdmin || !!client.data.proposal?.published;
  const showAgreementTab = isAdmin || !!client.data.agreement?.published;
  const services: { name: string; features: string[] }[] = [];
  if (brief.plan) services.push({ name: brief.plan, features: brief.planFeatures || [] });
  if (brief.marketingPlan) services.push({ name: brief.marketingPlan, features: brief.marketingFeatures || [] });
  const extraServices = [
    ...(brief.services || []).filter((sv) => sv !== "Other"),
    ...(brief.servicesOther ? [brief.servicesOther] : []),
  ];
  const pricing = client.data.pricing;
  const pricingTotal = (pricing?.items || []).reduce((sum, it) => {
    const n = parseFloat((it.amount || "").replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const recap: { label: string; value: string }[] = [];
  const push = (label: string, v?: string | string[]) => {
    const val = Array.isArray(v) ? v.join(", ") : v;
    if (val) recap.push({ label, value: val });
  };
  push(t.fields.description, brief.brandDescription);
  push(t.fields.products, brief.products);
  push(t.fields.goals, brief.businessGoals);
  push(t.fields.audience, [...(brief.audienceGender || []), ...(brief.audienceAge || [])]);
  push(t.fields.tagline, brief.tagline);

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
          <PrintButton label={lang === "ar" ? "تحميل PDF" : "Download PDF"} />
        </div>

        <PortalTabs slug={client.slug} current="proposal" showProposal={showProposalTab} showAgreement={showAgreementTab} lang={lang} />
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-gradient-to-b from-orange-50 to-white px-6 py-8 sm:px-9">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">{t.eyebrow}</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">{t.title}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {t.preparedFor} <span className="font-semibold text-neutral-700">{brief.brandName}</span>
            </p>
          </div>

          <div className="px-6 py-7 sm:px-9">
            {acceptedAt && (
              <div className="mb-7 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white">✓</span>
                <div className="text-sm">
                  <div className="font-semibold text-green-800">{t.acceptedTitle}</div>
                  <div className="text-green-700">{t.acceptedOn} {new Date(acceptedAt).toLocaleString(lang === "ar" ? "ar" : "en-GB")}</div>
                </div>
              </div>
            )}

            <p className="text-sm leading-7 text-neutral-600 whitespace-pre-wrap">{client.data.proposal?.note || t.intro}</p>

            {/* Packages — branding and/or marketing */}
            {services.map((svc) => (
              <div key={svc.name} className="mt-4 rounded-xl border border-orange/30 bg-orange-50/40 p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange">{t.packageLabel}</div>
                <div className="mt-1 text-xl font-bold text-neutral-900">{svc.name}</div>
                {svc.features.length > 0 && (
                  <>
                    <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{t.includes}</div>
                    <ul className="space-y-2">
                      {svc.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-neutral-700">
                          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-orange" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}

            {/* À-la-carte services */}
            {extraServices.length > 0 && (
              <div className="mt-4 rounded-xl border border-neutral-200 p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange">{t.servicesLabel}</div>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {extraServices.map((sv) => (
                    <li key={sv} className="flex items-start gap-2 text-sm text-neutral-700">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-orange" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
                      <span>{sv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scope */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">{t.scope}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {t.steps.map((st, i) => (
                  <div key={st.t} className="rounded-lg border border-neutral-200 p-4">
                    <div className="text-xs font-bold text-orange">0{i + 1}</div>
                    <div className="mt-1 font-semibold text-neutral-900">{st.t}</div>
                    <p className="mt-1 text-sm text-neutral-500">{st.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Investment */}
            <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t.investment}</div>
              {pricing?.items?.length ? (
                <>
                  <dl className="mt-3 divide-y divide-neutral-200">
                    {pricing.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 py-2 text-sm">
                        <dt className="text-neutral-700">{it.label}</dt>
                        <dd className="font-semibold text-neutral-900">{it.amount}</dd>
                      </div>
                    ))}
                    {pricingTotal > 0 && (
                      <div className="flex items-center justify-between gap-4 pt-2 text-sm">
                        <dt className="font-semibold text-neutral-900">{t.totalLabel}</dt>
                        <dd className="font-bold text-neutral-900">{pricingTotal.toLocaleString("en-US")}</dd>
                      </div>
                    )}
                  </dl>
                  {pricing.note && <p className="mt-3 text-xs text-neutral-500">{pricing.note}</p>}
                </>
              ) : (
                <p className="mt-1 text-sm text-neutral-700">{t.investmentNote}</p>
              )}
            </div>

            {/* Recap */}
            {recap.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">{t.recap}</h2>
                <dl className="mt-3 divide-y divide-neutral-100">
                  {recap.map((r) => (
                    <div key={r.label} className="grid grid-cols-3 gap-3 py-2.5">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{r.label}</dt>
                      <dd className="col-span-2 text-sm text-neutral-700 whitespace-pre-wrap">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Accept */}
            <div className="mt-9 border-t border-neutral-100 pt-7">
              {acceptedAt ? (
                <Link
                  href={agreementSent ? `/portal/${client.slug}/agreement` : `/portal/${client.slug}`}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-900 px-6 text-sm font-semibold text-white hover:bg-black"
                >
                  {agreementSent ? t.toPortal : t.toPortalPlain}
                </Link>
              ) : (
                <form action={acceptProposal} className="flex flex-col items-start gap-3">
                  <input type="hidden" name="slug" value={client.slug} />
                  <button className="inline-flex h-12 items-center justify-center rounded-md bg-orange px-8 text-base font-semibold text-white transition-colors hover:bg-orange-deep">
                    {t.acceptCta}
                  </button>
                  <p className="text-xs text-neutral-500">{t.acceptNote}</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
