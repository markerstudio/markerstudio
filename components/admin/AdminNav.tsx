"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

/* Admin navigation — client component so the current section can be
   highlighted. Scrolls horizontally on narrow screens instead of wrapping. */
export default function AdminNav({ unreadInquiries, unreadApplications }: { unreadInquiries: number; unreadApplications: number }) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/projects", label: "Projects" },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/accounts", label: "Accounts" },
    { href: "/admin/proposals", label: "Proposals" },
    { href: "/admin/agreements", label: "Agreements" },
    { href: "/admin/consents", label: "Consents" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/finance", label: "Finance" },
    { href: "/admin/inquiries", label: "Inquiries", badge: unreadInquiries },
    { href: "/admin/applications", label: "Applications", badge: unreadApplications },
    { href: "/admin/users", label: "Users" },
  ];

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none -mx-1 px-1">
      {items.map((item) => {
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
    </nav>
  );
}
