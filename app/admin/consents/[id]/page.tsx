import Link from "next/link";
import { notFound } from "next/navigation";
import { getConsentSignature } from "@/lib/consents";
import { CONSENT_COPY, CONSENT_FOOTER } from "@/lib/consent-copy";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// A single signed consent record, rendered as the full release document with
// the drawn signature — print it (browser "Save as PDF") for archiving or to
// hand the participant a copy.
export default async function ConsentRecordPage({ params }: { params: { id: string } }) {
  const sig = await getConsentSignature(Number(params.id) || 0);
  if (!sig) notFound();

  const lang = sig.lang === "ar" ? "ar" : "en";
  const copy = CONSENT_COPY[lang];
  const signedDate = new Date(sig.signed_at).toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hide the admin chrome when printing so only the record prints. */}
      <style>{`@media print { header { display: none !important; } }`}</style>

      <div className="print:hidden mb-5 flex items-center justify-between gap-3 lq-rise">
        <Link href="/admin/consents" className="lq-btn lq-btn--glass lq-btn--sm no-underline">
          ← Consent forms
        </Link>
        <PrintButton label="Save PDF" basename={`consent-${params.id}`} />
      </div>

      <div
        data-doc
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="rounded-2xl border border-neutral-200 bg-white p-8 sm:p-10 shadow-[0_24px_60px_-28px_rgba(31,31,31,.28)] print:shadow-none print:border-0 print:rounded-none"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto" />
          <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            {lang === "ar" ? "موقّع" : "Signed"}
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-snug">{copy.title}</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600">
          {copy.paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mt-7 grid gap-x-8 gap-y-4 border-t border-neutral-100 pt-6 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{copy.nameLabel}</div>
            <div className="mt-1 font-semibold text-neutral-900">{sig.name}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{copy.dateLabel}</div>
            <div className="mt-1 font-semibold text-neutral-900">{signedDate}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{copy.contactLabel}</div>
            <div className="mt-1 text-sm text-neutral-700">{sig.contact || "—"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{copy.signLabel}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sig.signature} alt={`${sig.name} signature`} className="mt-2 h-28 max-w-full object-contain object-left" />
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4 text-xs text-neutral-400" dir="ltr">
          <div>
            {sig.form_label} · Recorded {new Date(sig.signed_at).toLocaleString("en-GB")}
          </div>
          <div className="mt-1 text-center text-[11px]">{CONSENT_FOOTER}</div>
        </div>
      </div>
    </div>
  );
}
