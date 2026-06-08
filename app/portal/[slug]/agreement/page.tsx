import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { buildAgreement } from "@/lib/agreement";
import AgreementSign from "@/components/AgreementSign";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Agreement · Marker Studio", robots: { index: false, follow: false } };

const T = {
  en: {
    eyebrow: "Service Agreement",
    title: "Service Agreement",
    intro: "Please read the terms below, then sign electronically to accept.",
    summaryTitle: "Agreement summary",
    client: "Client",
    representative: "Client representative",
    provider: "Service provider",
    value: "Agreement value",
    pkg: "Package confirmation",
    payment: "Payment method",
    pricingTitle: "Pricing",
    totalLabel: "Total",
    acceptance: "Acceptance",
    acceptanceBody: "By signing below, both parties confirm that they understand and accept the scope, package value, phase-based payment terms, responsibilities, and conditions of this Agreement.",
    agreeLabel: "I have read and accept the terms and conditions of this Agreement.",
    signLabel: "Type your full name to sign",
    signHint: "This serves as your electronic signature.",
    signaturePreview: "Signature",
    submit: "Sign & accept agreement",
    errorText: "Please tick the box and type your full name to sign.",
    signedTitle: "Agreement signed",
    signedBy: "Signed by",
    on: "on",
    toPortal: "Go to your portal →",
    contact: "Marker Studio® · create@marker.ps · www.marker.ps · +970 568 08 14 08",
  },
  ar: {
    eyebrow: "اتفاقية الخدمة",
    title: "اتفاقية الخدمة",
    intro: "يرجى قراءة الشروط أدناه، ثم التوقيع إلكترونياً للقبول.",
    summaryTitle: "ملخّص الاتفاقية",
    client: "العميل",
    representative: "ممثّل العميل",
    provider: "مزوّد الخدمة",
    value: "قيمة الاتفاقية",
    pkg: "تأكيد الباقة",
    payment: "طريقة الدفع",
    pricingTitle: "التسعير",
    totalLabel: "الإجمالي",
    acceptance: "القبول",
    acceptanceBody: "بالتوقيع أدناه، يؤكّد الطرفان فهمهما وقبولهما للنطاق وقيمة الباقة وشروط الدفع على مراحل والمسؤوليات وشروط هذه الاتفاقية.",
    agreeLabel: "لقد قرأت وأوافق على شروط وأحكام هذه الاتفاقية.",
    signLabel: "اكتب اسمك الكامل للتوقيع",
    signHint: "يُعتبر هذا توقيعك الإلكتروني.",
    signaturePreview: "التوقيع",
    submit: "وقّع واقبل الاتفاقية",
    errorText: "يرجى تحديد المربع وكتابة اسمك الكامل للتوقيع.",
    signedTitle: "تم توقيع الاتفاقية",
    signedBy: "وقّعها",
    on: "بتاريخ",
    toPortal: "اذهب إلى بوابتك ←",
    contact: "ماركر استديو® · create@marker.ps · www.marker.ps · +970 568 08 14 08",
  },
} as const;

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const brief = client.data.onboarding;
  // Clients only see the agreement once the studio has sent it; admins can preview.
  if (s.role === "client" && !client.data.agreement?.published) redirect(`/portal/${client.slug}`);

  const lang = brief?.lang === "ar" ? "ar" : "en";
  const t = T[lang];
  const signed = client.data.agreement?.acceptedAt;

  const pricing = client.data.pricing;
  const pricingTotal = (pricing?.items || []).reduce((sum, it) => {
    const n = parseFloat((it.amount || "").replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const extraServices = [
    ...((brief?.services || []).filter((sv) => sv !== "Other")),
    ...(brief?.servicesOther ? [brief.servicesOther] : []),
  ];
  // Scope/package come from the brief when present, else from the priced line items.
  const packageName = [brief?.plan, brief?.marketingPlan, ...extraServices].filter(Boolean).join(" + ")
    || (pricing?.items || []).map((it) => it.label).join(" + ");
  const scope = [...(brief?.planFeatures || []), ...(brief?.marketingFeatures || []), ...extraServices];
  const scopeFinal = scope.length ? scope : (pricing?.items || []).map((it) => it.label).filter(Boolean);
  const phone = brief?.phone || "";

  const ag = buildAgreement({
    clientName: brief?.brandName || client.name,
    representative: brief ? `${brief.firstName} ${brief.lastName}`.trim() : "",
    phone,
    packageName,
    scope: scopeFinal,
    purpose: brief?.brandDescription || "",
  });
  if (pricing?.items?.length) {
    ag.summary.value = pricing.note || (pricingTotal > 0 ? pricingTotal.toLocaleString("en-US") : ag.summary.value);
  } else if (client.data.agreement?.value) {
    ag.summary.value = client.data.agreement.value;
  }

  const summaryRows = [
    { label: t.client, value: ag.summary.client },
    { label: t.representative, value: `${ag.summary.representative}${phone ? ` · ${phone}` : ""}`.trim() || "—" },
    { label: t.provider, value: ag.summary.provider },
    { label: t.value, value: ag.summary.value },
    { label: t.pkg, value: ag.summary.packageConfirmation },
    { label: t.payment, value: ag.summary.paymentNote },
  ];

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          <a href={`/portal/${client.slug}`} aria-label="Portal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
          </a>
          <div className="flex items-center gap-3">
            <a href={`/portal/${client.slug}`} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              {lang === "ar" ? "→ البوابة" : "← Portal"}
            </a>
            <PrintButton label={lang === "ar" ? "تحميل PDF" : "Download PDF"} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="bg-orange px-6 py-8 text-white sm:px-9">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{t.eyebrow}</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-2 text-sm text-white/85">{t.intro}</p>
          </div>

          <div className="px-6 py-7 sm:px-9">
            {signed && (
              <div className="mb-7 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white">✓</span>
                <div className="text-sm">
                  <div className="font-semibold text-green-800">{t.signedTitle}</div>
                  <div className="text-green-700">
                    {t.signedBy} {client.data.agreement?.signedName} · {t.on} {new Date(signed).toLocaleString(lang === "ar" ? "ar" : "en-GB")}
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <h2 className="text-lg font-bold text-neutral-900">{t.summaryTitle}</h2>
            <dl className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
              {summaryRows.map((r, i) => (
                <div key={r.label} className={`grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-3 ${i % 2 ? "bg-white" : "bg-neutral-50"}`}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-orange">{r.label}</dt>
                  <dd className="text-sm text-neutral-800 sm:col-span-2">{r.value}</dd>
                </div>
              ))}
            </dl>

            {/* Pricing breakdown */}
            {pricing?.items?.length ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-neutral-900">{t.pricingTitle}</h2>
                <dl className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                  {pricing.items.map((it, i) => (
                    <div key={i} className={`flex items-center justify-between gap-4 px-4 py-2.5 text-sm ${i % 2 ? "bg-white" : "bg-neutral-50"}`}>
                      <dt className="text-neutral-700">{it.label}</dt>
                      <dd className="font-semibold text-neutral-900">{it.amount}</dd>
                    </div>
                  ))}
                  {pricingTotal > 0 && (
                    <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-2.5 text-sm">
                      <dt className="font-bold text-neutral-900">{t.totalLabel}</dt>
                      <dd className="font-bold text-neutral-900">{pricingTotal.toLocaleString("en-US")}</dd>
                    </div>
                  )}
                </dl>
                {pricing.note && <p className="mt-2 text-xs text-neutral-500">{pricing.note}</p>}
              </div>
            ) : null}

            {/* Sections */}
            <div className="mt-8 space-y-6">
              {ag.sections.map((sec) => (
                <section key={sec.n}>
                  <h3 className="font-bold text-neutral-900">
                    <span className="text-orange">{sec.n}</span> {sec.title}
                  </h3>
                  {sec.body?.map((p, i) => (
                    <p key={i} className="mt-1.5 text-sm leading-7 text-neutral-600">{p}</p>
                  ))}
                  {sec.list && (
                    <ul className="mt-2 space-y-1.5">
                      {sec.list.map((li) => (
                        <li key={li} className="flex items-start gap-2 text-sm leading-6 text-neutral-600">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {/* Acceptance */}
            <div className="mt-9 border-t border-neutral-100 pt-7">
              <h3 className="font-bold text-neutral-900">
                <span className="text-orange">14</span> {t.acceptance}
              </h3>
              <p className="mt-1.5 text-sm leading-7 text-neutral-600">{t.acceptanceBody}</p>

              {signed ? (
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 px-5 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{t.signaturePreview}</div>
                    <div className="mt-1 text-2xl italic text-neutral-900" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
                      {client.data.agreement?.signedName}
                    </div>
                  </div>
                  <Link href={`/portal/${client.slug}`} className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-900 px-6 text-sm font-semibold text-white hover:bg-black">
                    {t.toPortal}
                  </Link>
                </div>
              ) : (
                <AgreementSign
                  slug={client.slug}
                  t={{
                    agreeLabel: t.agreeLabel,
                    signLabel: t.signLabel,
                    signHint: t.signHint,
                    signaturePreview: t.signaturePreview,
                    submit: t.submit,
                    error: searchParams.error === "1",
                    errorText: t.errorText,
                  }}
                />
              )}
            </div>

            <p className="mt-9 border-t border-neutral-100 pt-5 text-center text-xs text-neutral-400">{t.contact}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
