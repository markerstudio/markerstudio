"use client";

/* The Agenda — the studio's daily ritual, two ways:
   · "By client" — every client that needs something, as a glass card with
     its chips (tasks, posts, invoice chasing, shoots, check-ins, wrap-ups).
   · "Timeline" — a two-week day strip; pick a day, see what lands on it.
   Pure presentation over lib/agenda.ts. */

import Link from "next/link";
import { useMemo, useState } from "react";
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
  PartyPopper,
} from "lucide-react";
import { Seg, EmptyState, SectionHead } from "@/components/ui/glass";
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

const KIND_TONE: Record<AgendaKind, string> = {
  task: "lq-chip--blue",
  post: "lq-chip--orange",
  approval: "lq-chip--orange",
  invoice: "lq-chip--red",
  shoot: "lq-chip--blue",
  checkin: "",
  wrap: "lq-chip--green",
  onboard: "lq-chip--green",
  stories: "lq-chip--orange",
};

function dayLabel(dateIso: string, todayIso: string): { top: string; big: string } {
  if (dateIso === todayIso) return { top: "Today", big: dateIso.slice(8, 10) };
  const d = new Date(`${dateIso}T12:00:00Z`);
  return {
    top: d.toLocaleDateString("en-GB", { weekday: "short" }),
    big: dateIso.slice(8, 10),
  };
}

function UrgencyDot({ u }: { u: AgendaItem["urgency"] }) {
  const cls =
    u === "overdue" ? "bg-rose-500" : u === "today" ? "bg-orange" : "bg-charcoal-20";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
}

function ItemRow({ item }: { item: AgendaItem }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <Link
      href={item.href}
      className="lq-press group flex items-center gap-3 rounded-2xl px-3 py-2.5 no-underline hover:bg-white/70"
    >
      <span className={`lq-chip ${KIND_TONE[item.kind]} !p-0 w-8 h-8 justify-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] leading-snug truncate font-semibold ${
            item.urgency === "overdue" ? "text-rose-800" : "text-ink"
          }`}
        >
          {item.title}
        </span>
        {(item.sub || item.clientName) && (
          <span className="block text-[11px] text-charcoal-60 truncate mt-0.5">
            {[item.clientName, item.sub].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0 text-[11px] font-semibold text-charcoal-60 tabular-nums">
        <UrgencyDot u={item.urgency} />
        {item.time || (item.urgency === "overdue" ? "late" : item.urgency === "today" ? "today" : item.date.slice(5))}
      </span>
    </Link>
  );
}

export default function AgendaView({ agenda }: { agenda: Agenda }) {
  const [mode, setMode] = useState<"clients" | "timeline">("clients");
  const todayIso = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(todayIso);

  const days = useMemo(() => {
    const out: string[] = [];
    const base = new Date(`${todayIso}T12:00:00Z`).getTime();
    for (let i = 0; i < 14; i++) out.push(new Date(base + i * 86400000).toISOString().slice(0, 10));
    return out;
  }, [todayIso]);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of agenda.all) {
      const key = it.date < todayIso ? todayIso : it.date; // overdue rides on today
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return m;
  }, [agenda.all, todayIso]);

  const dayItems = byDay.get(day) ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Your rituals, computed
          </p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">
            Agenda
          </h1>
        </div>
        {/* One composed count strip instead of a row of separate chips. */}
        <div className="lq-well px-4 py-2 flex items-center text-[12.5px] font-semibold tabular-nums [&>*+*]:border-s [&>*+*]:border-charcoal/10">
          {agenda.counts.overdue > 0 && (
            <span className="pe-3 text-rose-700">{agenda.counts.overdue} overdue</span>
          )}
          <span className="px-3 first:ps-0 text-orange-deep">{agenda.counts.today} today</span>
          <span className="ps-3 text-charcoal-60">{agenda.counts.soon} coming up</span>
        </div>
      </header>

      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { value: "clients", label: "By client" },
          { value: "timeline", label: "Timeline" },
        ]}
      />

      {mode === "clients" ? (
        agenda.clients.length === 0 && agenda.studio.length === 0 ? (
          <div className="lq-card">
            <EmptyState
              icon={<PartyPopper className="w-5 h-5" />}
              title="Nothing owed to anyone"
              sub="No tasks due, no invoices to chase, no posts waiting. Enjoy it — it won't last."
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lq-stagger">
            {agenda.clients.map((c, i) => (
              <section
                key={c.slug}
                className="lq-card p-4"
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center gap-2.5 px-1 pb-2">
                  <span
                    className="w-7 h-7 rounded-full shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.4)]"
                    style={{ background: c.color }}
                  />
                  <Link
                    href={`/admin/clients/${c.slug}/edit`}
                    className="font-display font-bold text-[14.5px] text-ink no-underline hover:text-orange-deep truncate"
                  >
                    {c.name}
                  </Link>
                  <span className="ms-auto flex items-center gap-1.5">
                    {c.overdue > 0 && <span className="lq-chip lq-chip--red !px-2 !py-1">{c.overdue}</span>}
                    {c.today > 0 && <span className="lq-chip lq-chip--orange !px-2 !py-1">{c.today}</span>}
                  </span>
                </div>
                <div className="flex flex-col">
                  {c.items.slice(0, 6).map((it, j) => (
                    <ItemRow key={j} item={it} />
                  ))}
                  {c.items.length > 6 && (
                    <p className="text-[11px] text-charcoal-40 px-3 pt-1">
                      + {c.items.length - 6} more this fortnight
                    </p>
                  )}
                </div>
              </section>
            ))}
            {agenda.studio.length > 0 && (
              <section className="lq-dark p-4" style={{ "--i": agenda.clients.length } as React.CSSProperties}>
                <div className="flex items-center gap-2.5 px-1 pb-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFA226] to-[#F57F00] shrink-0" />
                  <span className="font-display font-bold text-[14.5px]">Studio</span>
                </div>
                <div className="flex flex-col [&_a]:hover:bg-white/10 [&_.text-ink]:text-white [&_.text-charcoal-60]:text-white/60">
                  {agenda.studio.slice(0, 6).map((it, j) => (
                    <ItemRow key={j} item={it} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Day strip */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {days.map((d) => {
              const { top, big } = dayLabel(d, todayIso);
              const count = (byDay.get(d) ?? []).length;
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`lq-press shrink-0 w-[54px] rounded-2xl px-1 py-2.5 flex flex-col items-center gap-0.5 border ${
                    on
                      ? "text-white bg-gradient-to-b from-[#FFA226] to-[#F57F00] border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_-6px_rgba(255,145,0,.55)]"
                      : "bg-white/60 border-charcoal/5 text-charcoal-80"
                  }`}
                >
                  <span className={`text-[9.5px] font-display font-bold uppercase tracking-wide ${on ? "text-white/85" : "text-charcoal-40"}`}>
                    {top}
                  </span>
                  <span className="font-display font-extrabold text-[17px] leading-none">{big}</span>
                  <span
                    className={`mt-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center ${
                      count === 0
                        ? "opacity-0"
                        : on
                        ? "bg-white/25 text-white"
                        : "bg-orange/15 text-orange-deep"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lq-card p-3">
            <SectionHead
              className="px-2 pt-1 pb-2"
              title={day === todayIso ? "Today" : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              sub={`${dayItems.length} item${dayItems.length === 1 ? "" : "s"}${day === todayIso && agenda.counts.overdue ? ` · includes ${agenda.counts.overdue} overdue` : ""}`}
            />
            {dayItems.length === 0 ? (
              <EmptyState title="Clear day" sub="Nothing lands here yet." />
            ) : (
              <div className="flex flex-col">
                {dayItems.map((it, i) => (
                  <ItemRow key={i} item={it} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
