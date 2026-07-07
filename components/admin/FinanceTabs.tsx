"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Sub-navigation for the Finance section. Finance is one area with two
   surfaces — the money overview (cashflow, what's owed, payments) and the
   invoicing system — so they share this little tab bar instead of living as
   two unrelated top-level pages. */
const TABS = [
  { href: "/admin/finance", label: "Overview" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/payments/new", label: "Record payment" },
];

export default function FinanceTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="lq-seg mb-5" role="tablist">
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`lq-seg__opt no-underline whitespace-nowrap ${active ? "is-on" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
