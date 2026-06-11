"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type SectionState = "done" | "sent" | "draft" | "empty";

export type ClientCardData = {
  slug: string;
  name: string;
  color: string;
  logo: string;
  planName: string;
  balance: string; // combined money left, already formatted ("600 ILS")
  status: "active" | "pending" | "inactive";
  notion: boolean; // linked to a Notion Clients Database record
  sections: { key: string; state: SectionState; href: string }[]; // fill matrix
  pct: number; // % of sections filled/sent
};

type Filter = "all" | "active" | "pending" | "inactive";

const STATUS_META: Record<ClientCardData["status"], { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  inactive: { label: "Inactive", cls: "bg-neutral-100 text-neutral-500", dot: "bg-neutral-300" },
};

const ORDER: Record<ClientCardData["status"], number> = { pending: 0, active: 1, inactive: 2 };

const DOT: Record<SectionState, string> = {
  done: "bg-green-500",
  sent: "bg-orange",
  draft: "bg-neutral-300",
  empty: "bg-neutral-200 border border-dashed border-neutral-300",
};

/* Clients as a classified card grid: filter chips with live counts, name
   search, and the fill matrix on every card. Pending sign-ups float to the
   top. Clicking the card opens the portal editor (the daily task); settings
   and portal preview are explicit actions on the card. Deleting a client
   lives at the bottom of its settings page — too destructive for a card. */
export default function ClientsGrid({ clients }: { clients: ClientCardData[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => c.status === "active").length,
      pending: clients.filter((c) => c.status === "pending").length,
      inactive: clients.filter((c) => c.status === "inactive").length,
    }),
    [clients]
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients
      .filter((c) => (filter === "all" ? true : c.status === filter))
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.slug.includes(needle))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  }, [clients, filter, q]);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "pending", label: "Pending" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div>
      {/* Toolbar — classification chips + search */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map((c) => {
            const on = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {c.key !== "all" && <span className={`w-2 h-2 rounded-full ${STATUS_META[c.key as ClientCardData["status"]].dot}`} />}
                {c.label}
                <span className={`tabular-nums text-xs ${on ? "text-white/60" : "text-neutral-400"}`}>{counts[c.key]}</span>
              </button>
            );
          })}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients…"
          autoComplete="off"
          className="ml-auto w-full sm:w-56 border border-neutral-200 bg-white rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
        />
      </div>

      {/* Fill-matrix legend */}
      <div className="flex items-center gap-3 text-[11px] text-neutral-500 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-full inline-block ${DOT.done}`} /> filled</span>
        <span className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-full inline-block ${DOT.sent}`} /> sent</span>
        <span className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-full inline-block ${DOT.draft}`} /> draft</span>
        <span className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-full inline-block ${DOT.empty}`} /> empty</span>
      </div>

      {/* Card grid */}
      {shown.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl px-4 py-12 text-center text-sm text-neutral-500">
          {clients.length === 0 ? "No clients yet — create one or import from Notion above." : "No clients match."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shown.map((c, i) => {
            const meta = STATUS_META[c.status];
            return (
              <div
                key={c.slug}
                className="adm-rise group relative bg-white border border-neutral-200 rounded-xl p-4 hover:border-orange hover:shadow-md hover:-translate-y-0.5 transition-all"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                {/* Whole-card link opens the portal editor; explicit actions sit above it */}
                <Link href={`/portal/${c.slug}?edit=1`} className="absolute inset-0 z-0" aria-label={`Fill ${c.name}'s portal`} />

                <div className="flex items-start justify-between gap-3 pointer-events-none">
                  <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg" style={{ background: c.color }}>
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo} alt="" className="max-w-[70%] max-h-[60%] object-contain invert brightness-0 opacity-90" />
                    ) : (
                      (c.name || c.slug).charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.cls}`}>{meta.label}</span>
                </div>

                <div className="mt-3 pointer-events-none">
                  <div className="font-bold text-neutral-900 truncate flex items-center gap-1.5">
                    {c.name}
                    {c.notion && (
                      <span title="Linked to Notion" className="shrink-0 w-4 h-4 rounded-sm bg-neutral-900 text-white text-[9px] font-bold flex items-center justify-center">
                        N
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 truncate mt-0.5">{c.planName || `/portal/${c.slug}`}</div>
                </div>

                {/* Fill matrix — each dot links to where that section is edited */}
                <div className="relative z-10 mt-3 flex items-center gap-1.5">
                  {c.sections.map((s) => (
                    <Link key={s.key} href={s.href} title={`${s.key}: ${s.state}`} className="group/dot">
                      <span className={`inline-block w-3.5 h-3.5 rounded-full transition-transform group-hover/dot:scale-125 ${DOT[s.state]}`} />
                    </Link>
                  ))}
                  <span className={`ml-auto tabular-nums text-xs font-bold ${c.pct === 100 ? "text-green-700" : c.pct >= 50 ? "text-neutral-700" : "text-orange-deep"}`}>
                    {c.pct}%
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <span className={`pointer-events-none text-xs font-semibold tabular-nums ${c.balance ? "text-orange-deep" : "text-neutral-300"}`}>
                    {c.balance ? `${c.balance} left` : "—"}
                  </span>
                  <span className="relative z-10 flex items-center gap-2.5">
                    <Link href={`/admin/clients/${c.slug}/edit`} className="text-xs font-semibold text-neutral-500 hover:text-orange">
                      Settings
                    </Link>
                    <Link href={`/portal/${c.slug}`} target="_blank" className="text-xs font-semibold text-neutral-500 hover:text-orange">
                      Portal ↗
                    </Link>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
