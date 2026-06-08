import Link from "next/link";

// Shared tab bar across the client portal: Portal · Proposal · Agreement.
// Proposal/Agreement tabs only show when available to the viewer.
export default function PortalTabs({
  slug,
  current,
  showProposal,
  showAgreement,
  lang = "en",
}: {
  slug: string;
  current: "portal" | "proposal" | "agreement";
  showProposal: boolean;
  showAgreement: boolean;
  lang?: string;
}) {
  const ar = lang === "ar";
  const tabs = [
    { key: "portal", label: ar ? "البوابة" : "Portal", href: `/portal/${slug}` },
    ...(showProposal ? [{ key: "proposal", label: ar ? "العرض" : "Proposal", href: `/portal/${slug}/proposal` }] : []),
    ...(showAgreement ? [{ key: "agreement", label: ar ? "الاتفاقية" : "Agreement", href: `/portal/${slug}/agreement` }] : []),
  ];

  if (tabs.length < 2) return null;

  return (
    <nav dir={ar ? "rtl" : "ltr"} className="print:hidden mx-auto mb-6 flex max-w-3xl gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-sm font-medium shadow-sm">
      {tabs.map((tb) => (
        <Link
          key={tb.key}
          href={tb.href}
          className={`flex-1 rounded-md px-4 py-2 text-center transition ${
            current === tb.key ? "bg-orange text-white" : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          {tb.label}
        </Link>
      ))}
    </nav>
  );
}
