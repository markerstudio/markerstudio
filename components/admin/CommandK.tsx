"use client";

/* ⌘K — the admin command palette. Keyboard-first navigation and actions:
   jump to any section, any client, or fire a quick action, all from one
   glass panel. Local, instant filtering — no server round-trip.
   Open with ⌘K / Ctrl+K (or the rail's search button). */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  LayoutDashboard,
  CalendarDays,
  Users,
  ListChecks,
  Briefcase,
  Camera,
  KeyRound,
  FileText,
  FileSignature,
  ShieldCheck,
  Wallet,
  Inbox,
  Mail,
  Send,
  Settings,
  Plus,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

export type PaletteClient = { slug: string; name: string; color: string };

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Actions" | "Go to" | "Clients";
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  newTab?: boolean;
  keywords?: string;
  color?: string;
};

const NAV: Omit<Cmd, "group">[] = [
  { id: "home", label: "Today", icon: LayoutDashboard, href: "/admin", keywords: "dashboard home overview" },
  { id: "agenda", label: "Agenda", icon: CalendarDays, href: "/admin/agenda", keywords: "calendar today reminders rituals" },
  { id: "clients", label: "Clients", icon: Users, href: "/admin/clients" },
  { id: "tasks", label: "Tasks", icon: ListChecks, href: "/admin/deliverables", keywords: "todo deliverables board" },
  { id: "projects", label: "Projects", icon: Briefcase, href: "/admin/projects", keywords: "case studies work" },
  { id: "photo", label: "Photography", icon: Camera, href: "/admin/photographer", keywords: "shoots ameer" },
  { id: "accounts", label: "Accounts", icon: KeyRound, href: "/admin/accounts", keywords: "logins invites" },
  { id: "proposals", label: "Proposals", icon: FileText, href: "/admin/proposals" },
  { id: "agreements", label: "Agreements", icon: FileSignature, href: "/admin/agreements", keywords: "contracts" },
  { id: "consents", label: "Consents", icon: ShieldCheck, href: "/admin/consents" },
  { id: "finance", label: "Finance", icon: Wallet, href: "/admin/finance", keywords: "money books" },
  { id: "inquiries", label: "Inquiries", icon: Inbox, href: "/admin/inquiries", keywords: "leads contact" },
  { id: "applications", label: "Applications", icon: Mail, href: "/admin/applications", keywords: "jobs careers" },
  { id: "notify", label: "Notify", icon: Send, href: "/admin/notify", keywords: "push notifications broadcast" },
  { id: "users", label: "Users", icon: Settings, href: "/admin/users", keywords: "admins team" },
];

const ACTIONS: Omit<Cmd, "group">[] = [
  { id: "new-invoice", label: "New invoice", hint: "I", icon: Plus, href: "/admin/invoices", keywords: "bill create" },
  { id: "new-payment", label: "Record payment", hint: "P", icon: Plus, href: "/admin/payments/new", keywords: "paid money in" },
  { id: "new-client", label: "New client", hint: "C", icon: Plus, href: "/admin/clients/new", keywords: "portal add" },
  { id: "new-proposal", label: "New proposal", icon: Plus, href: "/admin/proposals" },
  { id: "new-task", label: "Add a task", hint: "T", icon: Plus, href: "/admin/deliverables", keywords: "todo quick add" },
  { id: "view-site", label: "View site", icon: ExternalLink, href: "/", newTab: true, keywords: "marketing website public" },
];

function score(cmd: Cmd, q: string): number {
  if (!q) return 1;
  const hay = `${cmd.label} ${cmd.keywords || ""}`.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (hay.startsWith(needle)) return 4;
  if (hay.includes(` ${needle}`)) return 3;
  if (hay.includes(needle)) return 2;
  // loose subsequence match ("inv" → "invoices", "nwc" → "new client")
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length ? 1 : 0;
}

export default function CommandK({ clients }: { clients: PaletteClient[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      ...ACTIONS.map((c) => ({ ...c, group: "Actions" as const })),
      ...NAV.map((c) => ({ ...c, group: "Go to" as const })),
      ...clients.map((c) => ({
        id: `client-${c.slug}`,
        label: c.name,
        group: "Clients" as const,
        icon: Users,
        href: `/admin/clients/${c.slug}/edit`,
        keywords: c.slug,
        color: c.color,
      })),
    ];
    const scored = base
      .map((c) => ({ c, s: score(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 12).map((x) => x.c);
  }, [clients, q]);

  useEffect(() => setSel(0), [q]);

  const run = useCallback(
    (cmd: Cmd) => {
      setOpen(false);
      if (cmd.newTab) window.open(cmd.href, "_blank");
      else router.push(cmd.href);
    },
    [router]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, cmds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && cmds[sel]) {
      e.preventDefault();
      run(cmds[sel]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // keep selection in view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Search & commands — ⌘K"
        className="lq-press hidden min-[900px]:flex fixed top-5 z-40 items-center gap-2 lq-chrome rounded-full ps-3.5 pe-3 py-2 text-[12px] font-display font-semibold text-charcoal-60 hover:text-ink"
        style={{ insetInlineEnd: 20 }}
      >
        <Search className="w-3.5 h-3.5" />
        Search
        <kbd className="font-mono text-[10px] bg-charcoal/8 rounded-md px-1.5 py-0.5">⌘K</kbd>
      </button>
    );

  return (
    <>
      <div className="lq-scrim" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="lq-chrome lq-pop fixed z-[110] inset-inline-0 mx-auto top-[12vh] w-[min(94vw,580px)] overflow-hidden !rounded-[26px]"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-charcoal/5">
          <Search className="w-4.5 h-4.5 w-[18px] h-[18px] text-charcoal-40 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to a client, a page, or an action…"
            className="flex-1 bg-transparent outline-none text-[15px] font-medium text-ink placeholder:text-charcoal-40"
          />
          <kbd className="font-mono text-[10px] text-charcoal-40 bg-charcoal/8 rounded-md px-1.5 py-0.5">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2" onKeyDown={onKey}>
          {cmds.length === 0 ? (
            <p className="text-center text-[13px] text-charcoal-40 py-8">Nothing matches — try fewer letters.</p>
          ) : (
            (["Actions", "Go to", "Clients"] as const).map((group) => {
              const inGroup = cmds.filter((c) => c.group === group);
              if (!inGroup.length) return null;
              return (
                <div key={group}>
                  <p className="px-3 pt-2.5 pb-1 text-[9.5px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-40">
                    {group}
                  </p>
                  {inGroup.map((cmd) => {
                    const idx = cmds.indexOf(cmd);
                    const Icon = cmd.icon;
                    const active = idx === sel;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        data-idx={idx}
                        onClick={() => run(cmd)}
                        onMouseMove={() => setSel(idx)}
                        className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start ${
                          active ? "bg-gradient-to-r from-[#FFA226] to-[#F57F00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.4)]" : "text-charcoal-80"
                        }`}
                      >
                        {cmd.color ? (
                          <span className="w-5 h-5 rounded-full shrink-0" style={{ background: cmd.color }} />
                        ) : (
                          <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-charcoal-40"}`} />
                        )}
                        <span className="flex-1 text-[13.5px] font-semibold truncate">{cmd.label}</span>
                        {cmd.hint && (
                          <kbd className={`font-mono text-[10px] rounded-md px-1.5 py-0.5 ${active ? "bg-white/20 text-white" : "bg-charcoal/8 text-charcoal-60"}`}>
                            {cmd.hint}
                          </kbd>
                        )}
                        <ArrowRight className={`w-3.5 h-3.5 ${active ? "opacity-90" : "opacity-0"}`} />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
