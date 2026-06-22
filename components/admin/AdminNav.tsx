"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

/* Admin navigation — client component so the current section can be
   highlighted. Scrolls horizontally on narrow screens instead of wrapping. */
export default function AdminNav({
  unreadInquiries,
  unreadApplications,
  showPartner = false,
  partnerOnly = false,
}: {
  unreadInquiries: number;
  unreadApplications: number;
  showPartner?: boolean;
  partnerOnly?: boolean;
}) {
  const pathname = usePathname();

  // Partner-only accounts (Ramzi) see just their own area.
  const groups: Item[][] = partnerOnly
    ? [[{ href: "/admin/partner", label: "Ramzi" }]]
    : // Grouped into clusters so 12 flat tabs read as a handful of scannable areas:
      // Overview · Clients & work · Documents · Money · Intake · System.
      [
    [{ href: "/admin", label: "Dashboard" }],
    [
      { href: "/admin/clients", label: "Clients" },
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/accounts", label: "Accounts" },
    ],
    [
      { href: "/admin/proposals", label: "Proposals" },
      { href: "/admin/agreements", label: "Agreements" },
      { href: "/admin/consents", label: "Consents" },
    ],
    [
      { href: "/admin/finance", label: "Finance" },
      ...(showPartner ? [{ href: "/admin/partner", label: "Ramzi" } as Item] : []),
    ],
    [
      { href: "/admin/inquiries", label: "Inquiries", badge: unreadInquiries },
      { href: "/admin/applications", label: "Applications", badge: unreadApplications },
    ],
    [{ href: "/admin/users", label: "Users" }],
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    // Invoices & Record-payment live inside the Finance section, so Finance
    // stays lit there.
    if (href === "/admin/finance" && (pathname.startsWith("/admin/invoices") || pathname.startsWith("/admin/payments"))) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none -mx-1 px-1">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <span className="mx-1.5 h-5 w-px bg-neutral-200 shrink-0" aria-hidden />}
          {group.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  active ? "bg-charcoal text-white" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                {item.label}
                {!!item.badge && (
                  <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none bg-orange text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
