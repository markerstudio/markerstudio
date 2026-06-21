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
    <div className="flex items-center gap-1.5 mb-5 border-b border-neutral-200 -mt-1">
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative -mb-px rounded-t-md px-3.5 py-2 text-sm font-semibold transition-colors ${
              active
                ? "text-charcoal border-b-2 border-orange"
                : "text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
