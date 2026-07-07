"use client";

/* The "Now" panel's agenda rows — every ritual the agenda engine derived for
   today (overdue first, then today): invoices to chase, posts going live,
   shoots, check-ins, wrap-ups, onboarding reviews. Renders as a fragment of
   rows so it can live inside the dashboard's shared dark panel (the panel
   itself — title, divider, tasks slice — is composed in app/admin/page.tsx).
   Presentation only. */

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  CheckCircle2,
  Clock,
  Camera,
  Wallet,
  Megaphone,
  Sparkles,
  UserPlus,
  MessageCircle,
  Flag,
  NotebookPen,
} from "lucide-react";
import type { Agenda, AgendaItem, AgendaKind } from "@/lib/agenda";

const KIND_ICON: Record<AgendaKind, React.ComponentType<{ className?: string }>> = {
  task: CheckCircle2,
  post: Megaphone,
  approval: Clock,
  invoice: Wallet,
  shoot: Camera,
  checkin: MessageCircle,
  wrap: Flag,
  onboard: UserPlus,
  stories: Sparkles,
  note: NotebookPen,
};

export default function TodayAgenda({ agenda }: { agenda: Agenda }) {
  const items = agenda.all.filter((i) => i.urgency !== "soon").slice(0, 8);
  const extra = agenda.counts.overdue + agenda.counts.today - items.length;

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-white/60 py-1">
        Nothing owed to anyone today. Tomorrow&apos;s items are waiting on the{" "}
        <Link href="/admin/agenda" className="text-orange-soft font-semibold no-underline">agenda</Link>.
      </p>
    );
  }

  return (
    <>
      <ul className="lq-stagger divide-y divide-white/10">
        {items.map((it: AgendaItem, i) => {
          const Icon = KIND_ICON[it.kind];
          return (
            <li key={i} style={{ "--i": i } as CSSProperties}>
              <Link
                href={it.href}
                className="lq-press group flex items-center gap-3 py-2 -mx-1 px-1 rounded-lg hover:bg-white/[0.06] no-underline min-w-0"
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    it.urgency === "overdue"
                      ? "bg-rose-500/25 text-rose-200"
                      : "bg-orange/25 text-orange-soft"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white leading-snug truncate">
                    {it.title}
                  </span>
                  <span className="block text-[11px] text-white/50 truncate mt-0.5">
                    {[it.clientName, it.sub].filter(Boolean).join(" · ") || "Studio"}
                  </span>
                </span>
                {it.time && (
                  <span className="text-[11px] font-semibold text-white/60 tabular-nums shrink-0">{it.time}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <Link
          href="/admin/agenda"
          className="block text-center text-[11.5px] font-semibold text-white/50 hover:text-white/80 no-underline mt-2"
        >
          + {extra} more today
        </Link>
      )}
    </>
  );
}
