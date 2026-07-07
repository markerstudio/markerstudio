"use client";

import type { CSSProperties } from "react";
import { SectionHead } from "@/components/ui/glass";
import type { Client, ClientData } from "@/lib/clients";
import type { TabId } from "./ClientEditor";

/* The landing view when opening a client: who they are, what their portal
   currently shows, and the handful of numbers the studio checks first.
   Everything is READ-ONLY and derived from the shared `data` prop — each row
   links to the tab that owns the field, so there are no duplicate forms and
   no extra save paths here. */

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function OnOff({ on, onLabel = "On", offLabel = "Off" }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return on ? (
    <span className="lq-chip lq-chip--green !text-[11px] uppercase">{onLabel}</span>
  ) : (
    <span className="lq-chip !text-[11px] uppercase">{offLabel}</span>
  );
}

export default function OverviewTab({
  client,
  data,
  onNavigate,
}: {
  client: Client;
  data: ClientData;
  onNavigate: (tab: TabId) => void;
}) {
  const slug = client.slug;
  const pending = data.status === "pending";

  // ---- derived, read-only figures -----------------------------------------
  const tasks = data.deliverables?.items ?? [];
  const openTasks = tasks.filter((t) => t.status !== "done" && !(t.requestedByClient && t.pending));
  const pendingRequests = tasks.filter((t) => t.requestedByClient && t.pending);

  const today = new Date().toISOString().slice(0, 10);
  const nextShoot = (data.photo?.sessions ?? [])
    .filter((s) => s.date && s.date >= today && s.status !== "delivered")
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const lastActivity = [...(data.updates ?? [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""))[0];

  const cycle = [data.plan.start, data.plan.end].filter(Boolean).join(" → ");

  // What the client (and photographer) can currently see — the same underlying
  // fields the owning tabs save. Managed there, only reported here.
  const visibility: { label: string; sub: string; on: boolean; onLabel?: string; tab: TabId; manage: string }[] = [
    {
      label: "Plan shown as active",
      sub: "The plan card on the client's dashboard.",
      on: !!data.plan.active,
      tab: "content",
      manage: "Plan & Content",
    },
    {
      label: "Shoots visible to the client",
      sub: "Shoot schedule appears in their portal.",
      on: !!data.photo?.showToClient,
      tab: "photography",
      manage: "Photography",
    },
    {
      label: "Task progress visible",
      sub: "Progress bar + task list in their portal.",
      on: !!data.deliverables?.showToClient,
      tab: "tasks",
      manage: "Tasks",
    },
    {
      label: "Client can request tasks",
      sub: "Requests stay pending until you approve them.",
      on: !!data.deliverables?.allowClientRequests,
      tab: "tasks",
      manage: "Tasks",
    },
    {
      label: "Proposal on the portal",
      sub: "Only appears once sent from its builder.",
      on: !!data.proposal?.published,
      onLabel: data.proposal?.acceptedAt ? "Accepted" : "Sent",
      tab: "documents",
      manage: "Documents",
    },
    {
      label: "Agreement on the portal",
      sub: "Only appears once sent; the client e-signs it.",
      on: !!data.agreement?.published,
      onLabel: data.agreement?.acceptedAt ? "Signed" : "Sent",
      tab: "documents",
      manage: "Documents",
    },
  ];

  // The numbers the studio checks first, each with a jump to its owning tab.
  const glance: { label: string; value: string; sub?: string; tab: TabId; manage: string }[] = [
    {
      label: "Plan",
      value: data.plan.name || "—",
      sub: cycle || "No cycle dates yet",
      tab: "content",
      manage: "Plan & Content",
    },
    {
      label: "Money left",
      value: data.plan.balance || "—",
      sub: `${data.finance?.progress ?? 0}% paid${data.finance?.monthlyFee ? ` · ${data.finance.monthlyFee}/mo` : ""}`,
      tab: "money",
      manage: "Money",
    },
    {
      label: "Open tasks",
      value: String(openTasks.length),
      sub: pendingRequests.length
        ? `${pendingRequests.length} client request${pendingRequests.length > 1 ? "s" : ""} waiting`
        : tasks.length
        ? `${tasks.filter((t) => t.status === "done").length}/${tasks.length} done`
        : "Nothing tracked yet",
      tab: "tasks",
      manage: "Tasks",
    },
    {
      label: "Next shoot",
      value: nextShoot ? fmtDate(nextShoot.date) : "—",
      sub: nextShoot ? nextShoot.title || nextShoot.location || nextShoot.status : "Nothing scheduled",
      tab: "photography",
      manage: "Photography",
    },
    {
      label: "Last activity",
      value: lastActivity ? fmtDate(lastActivity.at) : "—",
      sub: lastActivity ? lastActivity.title.en || lastActivity.title.ar || lastActivity.kind : "No portal activity yet",
      tab: "portal",
      manage: "Portal content",
    },
  ];

  return (
    <div className="space-y-6 lq-stagger">
      {/* ---- Identity strip -------------------------------------------------- */}
      <div className="lq-card lq-rise p-5" style={{ "--i": 0 } as CSSProperties}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden ring-1 ring-charcoal/10"
              style={{ background: client.color || "#303030" }}
            >
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logo} alt="" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <span className="text-lg font-display font-bold text-white">
                  {(client.name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-extrabold text-[20px] tracking-tight text-ink leading-tight truncate">
                  {client.name || slug}
                </h2>
                {data.archived ? (
                  <span className="lq-chip lq-chip--red !text-[10px] uppercase">Archived</span>
                ) : pending ? (
                  <span className="lq-chip lq-chip--orange !text-[10px] uppercase">New · onboarding</span>
                ) : data.plan.active ? (
                  <span className="lq-chip lq-chip--green !text-[10px] uppercase">Active</span>
                ) : (
                  <span className="lq-chip !text-[10px] uppercase">Inactive</span>
                )}
              </div>
              <div className="text-[12.5px] text-charcoal-60 truncate">/portal/{slug}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/portal/${slug}`} target="_blank" rel="noreferrer" className="lq-btn lq-btn--primary no-underline">
              Open portal ↗
            </a>
            <button type="button" onClick={() => onNavigate("money")} className="lq-btn lq-btn--glass">
              New invoice
            </button>
            <a href={`/admin/agreements/${slug}`} className="lq-btn lq-btn--glass no-underline">
              Agreement
            </a>
          </div>
        </div>
      </div>

      {/* ---- What the client sees -------------------------------------------- */}
      <div className="lq-card lq-rise p-5" style={{ "--i": 1 } as CSSProperties}>
        <SectionHead
          title="What the client sees"
          sub="Live from the portal switches — flip them in the tab that owns each one."
          className="mb-2"
        />
        <div className="divide-y divide-charcoal/5">
          {visibility.map((row) => (
            <div key={row.label} className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink leading-snug">{row.label}</div>
                <div className="text-[12px] text-charcoal-60 mt-0.5">{row.sub}</div>
              </div>
              <OnOff on={row.on} onLabel={row.onLabel} />
              <button
                type="button"
                onClick={() => onNavigate(row.tab)}
                className="text-[13px] font-semibold text-orange hover:text-orange-deep whitespace-nowrap lq-press"
              >
                {row.manage} →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ---- At a glance ------------------------------------------------------ */}
      <div className="lq-card lq-rise p-5" style={{ "--i": 2 } as CSSProperties}>
        <SectionHead title="At a glance" sub="Read-only — jump in to change anything." className="mb-4" />
        <div className="grid grid-cols-2 min-[900px]:grid-cols-3 gap-3">
          {glance.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => onNavigate(g.tab)}
              className="lq-well lq-press p-4 text-start flex flex-col gap-1 min-w-0"
              title={`Open ${g.manage}`}
            >
              <span className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">
                {g.label}
              </span>
              <span className="font-display font-extrabold text-[19px] leading-tight tracking-tight text-ink truncate w-full">
                {g.value}
              </span>
              {g.sub && <span className="text-[11.5px] font-medium text-charcoal-60 leading-snug truncate w-full">{g.sub}</span>}
              <span className="text-[11px] font-semibold text-orange mt-1">{g.manage} →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
