"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteClient } from "@/app/admin/actions";

export type ClientCardData = {
  slug: string;
  name: string;
  color: string;
  logo: string;
  planName: string;
  balance: string; // combined money left, already formatted ("600 ILS")
  status: "active" | "pending" | "inactive";
  notion: boolean; // linked to a Notion Clients Database record
};

type Filter = "all" | "active" | "pending" | "inactive";

const STATUS_META: Record<ClientCardData["status"], { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  inactive: { label: "Inactive", cls: "bg-neutral-100 text-neutral-500", dot: "bg-neutral-300" },
};

const ORDER: Record<ClientCardData["status"], number> = { pending: 0, active: 1, inactive: 2 };

/* Clients as a classified card grid: filter chips with live counts, name
   search, and per-card quick actions. Pending sign-ups float to the top. */
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
      <div className="flex items-center gap-3 flex-wrap mb-4">
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
          className="ml-auto w-full sm:w-56 border border-neutral-200 bg-white rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
        />
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
                {/* Whole-card link to edit; action buttons sit above it */}
                <Link href={`/admin/clients/${c.slug}/edit`} className="absolute inset-0 z-0" aria-label={`Edit ${c.name}`} />

                <div className="flex items-start justify-between gap-3 pointer-events-none">
                  <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg" style={{ background: c.color }}>
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo} alt="" className="max-w-[70%] max-h-[60%] object-contain invert brightness-0 opacity-90" />
                    ) : (
                      c.name.charAt(0).toUpperCase()
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

                <div className="mt-3 flex items-center justify-between gap-2 min-h-[26px]">
                  <span className={`pointer-events-none text-xs font-semibold tabular-nums ${c.balance ? "text-orange-deep" : "text-neutral-300"}`}>
                    {c.balance ? `${c.balance} left` : "—"}
                  </span>
                  <span className="relative z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Link href={`/portal/${c.slug}`} target="_blank" className="text-xs font-semibold text-neutral-500 hover:text-orange">
                      Portal ↗
                    </Link>
                    <form
                      action={deleteClient}
                      onSubmit={(e) => {
                        if (!confirm(`Delete ${c.name} and their portal? This can't be undone.`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="slug" value={c.slug} />
                      <button className="text-xs font-semibold text-neutral-400 hover:text-red-600" aria-label={`Delete ${c.name}`}>
                        Delete
                      </button>
                    </form>
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
