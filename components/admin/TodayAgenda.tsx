"use client";

/* The dashboard's "Today by client" strip — a dark glass card listing every
   ritual the agenda engine derived for today: invoices to chase, posts going
   live, shoots, check-ins, wrap-ups, onboarding reviews. Links to /admin/agenda
   for the full two-week picture. Presentation only. */

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Camera,
  Wallet,
  Megaphone,
  Sparkles,
  UserPlus,
  MessageCircle,
  Flag,
  ArrowRight,
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
};

export default function TodayAgenda({ agenda }: { agenda: Agenda }) {
  const items = agenda.all.filter((i) => i.urgency !== "soon").slice(0, 8);
  const extra = agenda.counts.overdue + agenda.counts.today - items.length;

  return (
    <section className="lq-dark lq-rise p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-display font-bold text-[16px] tracking-tight flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-orange-soft" />
          Today, per client
        </h2>
        <div className="flex items-center gap-2">
          {agenda.counts.overdue > 0 && (
            <span className="text-[10.5px] font-display font-bold uppercase tracking-wide bg-rose-500/25 text-rose-200 rounded-full px-2.5 py-1">
              {agenda.counts.overdue} overdue
            </span>
          )}
          <Link
            href="/admin/agenda"
            className="lq-press inline-flex items-center gap-1.5 text-[12px] font-display font-semibold text-white/80 hover:text-white no-underline bg-white/10 rounded-full px-3 py-1.5"
          >
            Full agenda <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      <p className="text-[12px] text-white/50 mb-3">
        Invoices to chase, posts going live, shoots, check-ins — computed from everything you already track.
      </p>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-4">
          <span className="w-8 h-8 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center">✓</span>
          <p className="text-[13px] text-white/70">
            Nothing owed to anyone today. Tomorrow&apos;s items are waiting on the{" "}
            <Link href="/admin/agenda" className="text-orange-soft font-semibold no-underline">agenda</Link>.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-1.5">
          {items.map((it: AgendaItem, i) => {
            const Icon = KIND_ICON[it.kind];
            return (
              <Link
                key={i}
                href={it.href}
                className="lq-press group flex items-center gap-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] px-3.5 py-2.5 no-underline"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    it.urgency === "overdue"
                      ? "bg-rose-500/25 text-rose-200"
                      : "bg-orange/25 text-orange-soft"
                  }`}
                >
                  <Icon className="w-4 h-4" />
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
            );
          })}
        </div>
      )}
      {extra > 0 && (
        <Link href="/admin/agenda" className="block text-center text-[11.5px] font-semibold text-white/50 hover:text-white/80 no-underline mt-3">
          + {extra} more today
        </Link>
      )}
    </section>
  );
}
