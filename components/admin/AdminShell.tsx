"use client";

/* The admin app shell — Marker Glass. No top bar anywhere:
   · Desktop (≥900px): a floating liquid-glass rail on the inline-start side
     with grouped navigation, the notification bell and the account cluster.
   · Mobile: a floating glass tab bar (Home · Tasks · Clients · Money · More)
     plus a floating bell chip; "More" opens a bottom sheet with the rest.
   Pure chrome — data (badges, role flags) comes in as props from the
   server layout; the signed-in pages render inside `.lq-main`. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Briefcase,
  Camera,
  KeyRound,
  FileText,
  FileSignature,
  ShieldCheck,
  Wallet,
  Banknote,
  Inbox,
  Mail,
  Send,
  Settings,
  LogOut,
  ExternalLink,
  MoreHorizontal,
  Fingerprint,
  Sparkles,
  CalendarDays,
  NotebookPen,
} from "lucide-react";
import NotificationBell from "@/components/admin/NotificationBell";
import Pet from "@/components/admin/Pet";
import CommandK, { type PaletteClient } from "@/components/admin/CommandK";
import { Sheet } from "@/components/ui/glass";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};
type NavGroup = { title?: string; items: NavItem[] };

export default function AdminShell({
  email,
  unreadInquiries,
  unreadApplications,
  showPartner = false,
  partnerOnly = false,
  showPhotographer = false,
  photographerOnly = false,
  showDeliverables = false,
  paletteClients = [],
  logout,
  children,
}: {
  email: string;
  unreadInquiries: number;
  unreadApplications: number;
  showPartner?: boolean;
  partnerOnly?: boolean;
  showPhotographer?: boolean;
  photographerOnly?: boolean;
  showDeliverables?: boolean;
  paletteClients?: PaletteClient[];
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the More sheet whenever navigation happens.
  useEffect(() => setMoreOpen(false), [pathname]);

  const groups: NavGroup[] = useMemo(() => {
    if (photographerOnly)
      return [{ items: [{ href: "/admin/photographer", label: "Photography", icon: Camera }] }];
    if (partnerOnly)
      return [{ items: [{ href: "/admin/partner", label: "Ramzi", icon: Sparkles }] }];
    return [
      {
        items: [
          { href: "/admin", label: "Today", icon: LayoutDashboard },
          { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
        ],
      },
      {
        title: "Work",
        items: [
          { href: "/admin/clients", label: "Clients", icon: Users },
          ...(showDeliverables
            ? [{ href: "/admin/deliverables", label: "Tasks", icon: ListChecks } as NavItem]
            : []),
          { href: "/admin/notes", label: "Notes", icon: NotebookPen },
          { href: "/admin/projects", label: "Projects", icon: Briefcase },
          ...(showPhotographer
            ? [{ href: "/admin/photographer", label: "Photography", icon: Camera } as NavItem]
            : []),
          { href: "/admin/accounts", label: "Accounts", icon: KeyRound },
        ],
      },
      {
        title: "Documents",
        items: [
          { href: "/admin/proposals", label: "Proposals", icon: FileText },
          { href: "/admin/agreements", label: "Agreements", icon: FileSignature },
          { href: "/admin/consents", label: "Consents", icon: ShieldCheck },
        ],
      },
      {
        title: "Money",
        items: [
          { href: "/admin/finance", label: "Finance", icon: Wallet },
          ...(showPartner
            ? [{ href: "/admin/partner", label: "Ramzi", icon: Banknote } as NavItem]
            : []),
        ],
      },
      {
        title: "Inbox",
        items: [
          { href: "/admin/inquiries", label: "Inquiries", icon: Inbox, badge: unreadInquiries },
          { href: "/admin/applications", label: "Applications", icon: Mail, badge: unreadApplications },
        ],
      },
      {
        title: "System",
        items: [
          { href: "/admin/notify", label: "Notify", icon: Send },
          { href: "/admin/users", label: "Users", icon: Settings },
        ],
      },
    ];
  }, [photographerOnly, partnerOnly, showDeliverables, showPhotographer, showPartner, unreadInquiries, unreadApplications]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    if (
      href === "/admin/finance" &&
      (pathname.startsWith("/admin/invoices") || pathname.startsWith("/admin/payments"))
    )
      return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const restricted = photographerOnly || partnerOnly;

  // Mobile tab bar: the 4 anchors + More. Restricted roles get their single tab.
  const tabs: NavItem[] = restricted
    ? groups[0].items
    : [
        { href: "/admin", label: "Today", icon: LayoutDashboard },
        ...(showDeliverables
          ? [{ href: "/admin/deliverables", label: "Tasks", icon: ListChecks } as NavItem]
          : []),
        { href: "/admin/clients", label: "Clients", icon: Users },
        { href: "/admin/finance", label: "Money", icon: Wallet },
      ];

  const flatItems = groups.flatMap((g) => g.items);
  const moreItems = flatItems.filter((i) => !tabs.some((t) => t.href === i.href));
  const moreBadge = moreItems.reduce((n, i) => n + (i.badge || 0), 0);
  const moreActive = moreItems.some((i) => isActive(i.href));

  return (
    <>
      {/* ---------- Desktop rail ---------- */}
      <aside className="lq-rail lq-chrome" aria-label="Admin navigation">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 px-2.5 pb-3 no-underline lq-press rounded-2xl"
        >
          <span className="w-9 h-9 rounded-full overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_16px_-4px_rgba(255,145,0,.55)] flex items-center justify-center bg-gradient-to-br from-[#FFA226] to-[#F57F00]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-favicon.png" alt="Marker Studio" className="w-full h-full object-cover" />
          </span>
          <span className="font-display font-extrabold tracking-tight text-[15px] text-ink leading-none">
            Marker
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-charcoal-40 mt-1">
              Studio OS
            </span>
          </span>
        </Link>

        {!restricted && <CommandK clients={paletteClients} />}

        <nav className="lq-rail__nav">
          {groups.map((g, gi) => (
            <div key={gi} className="contents">
              {g.title && <div className="lq-rail__group">{g.title}</div>}
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`lq-navlink ${active ? "is-active" : ""}`}
                  >
                    <Icon />
                    {item.label}
                    {!!item.badge && <span className="lq-navlink__badge">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom cluster — bell, site, account, sign out */}
        <div className="pt-2 mt-1 border-t border-charcoal/5 flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-2 py-1">
            <NotificationBell userKey={email} placement="rail" />
            <Link
              href="/"
              target="_blank"
              title="View site"
              className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-60 hover:text-ink hover:bg-charcoal/5 lq-press"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              href="/account/security"
              title="Face ID / Touch ID"
              className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-60 hover:text-ink hover:bg-charcoal/5 lq-press"
            >
              <Fingerprint className="w-4 h-4" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Sign out"
                className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-60 hover:text-rose-700 hover:bg-rose-500/10 lq-press"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
          <p className="px-2.5 pb-1 text-[10.5px] text-charcoal-40 truncate" title={email}>
            {email}
          </p>
        </div>
      </aside>

      {/* ---------- Mobile top bar — real chrome from y=0, so in standalone/
          translucent-status-bar mode content never scrolls visibly under the
          clock. Purely decorative: the bell must NOT live inside it
          (backdrop-filter would trap its fixed panel). ---------- */}
      <header className="lq-topbar lq-chrome min-[900px]:hidden" aria-hidden>
        <span className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#FFA226] to-[#F57F00] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-favicon.png" alt="" className="w-full h-full object-cover" />
        </span>
        <b className="font-display font-extrabold tracking-tight text-[13px] text-ink leading-none">
          Marker <span className="text-charcoal-40 font-bold text-[9px] uppercase tracking-[0.16em]">Studio OS</span>
        </b>
      </header>

      {/* ---------- Mobile floating bell ----------
          NOT .lq-chrome: backdrop-filter turns this wrapper into the containing
          block for the bell's fixed-position panel, trapping it inside the chip
          (= "notifications don't show on mobile"). Solid glass look instead.
          Rides on the top bar, clear of the iOS status bar / notch. */}
      <div
        className="fixed top-[calc(env(safe-area-inset-top,0px)+5px)] z-[65] rounded-full p-1 min-[900px]:hidden bg-white/90 border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_10px_28px_-10px_rgba(48,48,48,.28)]"
        style={{ insetInlineEnd: 12 }}
      >
        <NotificationBell userKey={email} placement="top" />
      </div>

      {/* ---------- Mobile tab bar ---------- */}
      <nav className="lq-tabbar lq-chrome" aria-label="Admin navigation">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} className={`lq-tab ${active ? "is-active" : ""}`}>
              <Icon />
              {t.label}
            </Link>
          );
        })}
        {!restricted && (
          <button
            type="button"
            className={`lq-tab ${moreActive && !moreOpen ? "is-active" : ""}`}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal />
            More
            {moreBadge > 0 && <span className="lq-tab__dot" />}
          </button>
        )}
      </nav>

      {/* ---------- More sheet (mobile) ---------- */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {moreItems.map((item, i) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`lq-press relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 no-underline text-[11.5px] font-display font-semibold ${
                  active
                    ? "text-white bg-gradient-to-br from-[#FFA226] to-[#F57F00] shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_-6px_rgba(255,145,0,.55)]"
                    : "text-charcoal-80 bg-white/60 border border-charcoal/5"
                }`}
                style={{ animationDelay: `${i * 24}ms` }}
              >
                <Icon className={`w-5 h-5 ${active ? "" : "text-charcoal-60"}`} />
                {item.label}
                {!!item.badge && (
                  <span className="absolute top-2 end-2 min-w-[17px] h-[17px] px-1 rounded-full bg-orange text-white text-[9.5px] font-bold leading-[17px] text-center shadow">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-charcoal/5 pt-3 mt-1">
          <p className="text-[11px] text-charcoal-40 truncate">{email}</p>
          <div className="flex items-center gap-1.5">
            <Link href="/" target="_blank" className="lq-btn lq-btn--glass lq-btn--sm no-underline">
              <ExternalLink className="w-3.5 h-3.5" /> Site
            </Link>
            <Link href="/account/security" className="lq-btn lq-btn--glass lq-btn--sm no-underline">
              <Fingerprint className="w-3.5 h-3.5" /> Face ID
            </Link>
            <form action={logout}>
              <button type="submit" className="lq-btn lq-btn--glass lq-btn--sm text-rose-700">
                <LogOut className="w-3.5 h-3.5" /> Out
              </button>
            </form>
          </div>
        </div>
      </Sheet>

      {/* ---------- Marky, the studio pet (admins only) ---------- */}
      {!restricted && <Pet />}

      {/* ---------- Page ---------- */}
      <main className="lq-main">
        <div key={pathname} className="mx-auto max-w-[1240px] lq-rise">
          {children}
        </div>
      </main>
    </>
  );
}
