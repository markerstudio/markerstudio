"use client";

/* The Agenda — the studio's daily ritual, two ways:
   · "By client" — every client that needs something, as a glass card with
     its chips (tasks, posts, invoice chasing, shoots, check-ins, wrap-ups).
   · "Timeline" — a two-week day strip; pick a day, see what lands on it.
   A lens row (Tasks / Content / Money / Clients) narrows both views to one
   kind of work. Pure presentation over lib/agenda.ts — "today" comes from
   the engine so the browser's clock can't disagree with the server's. */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellOff,
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
  NotebookPen,
  X,
} from "lucide-react";
import { Seg, EmptyState, SectionHead, useToast } from "@/components/ui/glass";
import { snoozeAgendaItem, unsnoozeAgendaItem } from "@/app/admin/agenda/actions";
import type { Agenda, AgendaItem, AgendaKind, ClientAgenda } from "@/lib/agenda";

const KIND_ICON: Record<AgendaKind, React.ComponentType<{ className?: string }>> = {
  task: CheckCircle2,
  post: Megaphone,
  prep: NotebookPen,
  approval: Clock,
  invoice: Wallet,
  shoot: Camera,
  checkin: MessageCircle,
  wrap: Flag,
  onboard: UserPlus,
  stories: Sparkles,
  note: NotebookPen,
};

const KIND_TONE: Record<AgendaKind, string> = {
  task: "lq-chip--blue",
  post: "lq-chip--orange",
  prep: "lq-chip--orange",
  approval: "lq-chip--orange",
  invoice: "lq-chip--red",
  shoot: "lq-chip--blue",
  checkin: "",
  wrap: "lq-chip--green",
  onboard: "lq-chip--green",
  stories: "lq-chip--orange",
  note: "lq-chip--blue",
};

/* The lenses — every kind belongs to exactly one, "all" shows everything. */
type Lens = "all" | "tasks" | "content" | "money" | "clients";
const KIND_LENS: Record<AgendaKind, Exclude<Lens, "all">> = {
  task: "tasks",
  stories: "tasks",
  post: "content",
  prep: "content",
  approval: "content",
  shoot: "content",
  invoice: "money",
  checkin: "clients",
  wrap: "clients",
  onboard: "clients",
  note: "clients",
};
const LENS_LABEL: Record<Exclude<Lens, "all">, string> = {
  tasks: "Tasks",
  content: "Content",
  money: "Money",
  clients: "Clients",
};

function dayLabel(dateIso: string, todayIso: string): { top: string; big: string } {
  if (dateIso === todayIso) return { top: "Today", big: dateIso.slice(8, 10) };
  const d = new Date(`${dateIso}T12:00:00Z`);
  return {
    top: d.toLocaleDateString("en-GB", { weekday: "short" }),
    big: dateIso.slice(8, 10),
  };
}

function fmtDate(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function UrgencyDot({ u }: { u: AgendaItem["urgency"] }) {
  const cls =
    u === "overdue" ? "bg-rose-500" : u === "today" ? "bg-orange" : "bg-charcoal-20";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
}

function ItemRow({
  item,
  showClient = true,
  onSnooze,
}: {
  item: AgendaItem;
  showClient?: boolean;
  onSnooze: (item: AgendaItem, days: 1 | 7) => void;
}) {
  const [asking, setAsking] = useState(false);
  const Icon = KIND_ICON[item.kind];
  const sub = [showClient ? item.clientName : null, item.sub].filter(Boolean).join(" · ");
  // The whole row is a Link; the snooze controls live inside it, so they
  // must swallow the click before it navigates.
  const press = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
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
        {sub && (
          <span className="block text-[11px] text-charcoal-60 truncate mt-0.5">
            {sub}
          </span>
        )}
      </span>
      {asking ? (
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={press(() => onSnooze(item, 1))}
            className="lq-press lq-chip lq-chip--orange !px-2 !py-1 !text-[10.5px]"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={press(() => onSnooze(item, 7))}
            className="lq-press lq-chip lq-chip--orange !px-2 !py-1 !text-[10.5px]"
          >
            1 week
          </button>
          <button
            type="button"
            aria-label="Cancel snooze"
            onClick={press(() => setAsking(false))}
            className="lq-press p-1 text-charcoal-40 hover:text-ink"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2 shrink-0 text-[11px] font-semibold text-charcoal-60 tabular-nums">
          <UrgencyDot u={item.urgency} />
          {item.time || (item.urgency === "overdue" ? "late" : item.urgency === "today" ? "today" : fmtDate(item.date))}
          <button
            type="button"
            aria-label="Snooze this item"
            title="Snooze — hide until it's due again"
            onClick={press(() => setAsking(true))}
            className="lq-press p-1 -my-1 text-charcoal-20 hover:text-orange-deep sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <BellOff className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
    </Link>
  );
}

/* One client's card (Studio rides on the same shape) — collapsed to six rows,
   the "+ n more" line is a real button now instead of a dead caption. */
function AgendaCard({
  title,
  titleHref,
  swatch,
  items,
  dark = false,
  index,
  onSnooze,
}: {
  title: string;
  titleHref?: string;
  swatch: React.ReactNode;
  items: AgendaItem[];
  dark?: boolean;
  index: number;
  onSnooze: (item: AgendaItem, days: 1 | 7) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overdue = items.filter((i) => i.urgency === "overdue").length;
  const today = items.filter((i) => i.urgency === "today").length;
  const shown = expanded ? items : items.slice(0, 6);
  return (
    <section
      className={`${dark ? "lq-dark" : "lq-card"} p-4 min-w-0`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5 px-1 pb-2">
        {swatch}
        {titleHref ? (
          <Link
            href={titleHref}
            className="font-display font-bold text-[14.5px] text-ink no-underline hover:text-orange-deep truncate"
          >
            {title}
          </Link>
        ) : (
          <span className="font-display font-bold text-[14.5px] truncate">{title}</span>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {overdue > 0 && <span className="lq-chip lq-chip--red !px-2 !py-1">{overdue}</span>}
          {today > 0 && <span className="lq-chip lq-chip--orange !px-2 !py-1">{today}</span>}
        </span>
      </div>
      <div
        className={`flex flex-col ${
          dark
            ? "[&_a]:hover:bg-white/10 [&_.text-ink]:text-white [&_.text-charcoal-60]:text-white/60 [&_.text-rose-800]:text-rose-300 [&_.text-charcoal-20]:text-white/30 [&_.text-charcoal-40]:text-white/50"
            : ""
        }`}
      >
        {shown.map((it) => (
          <ItemRow key={it.id} item={it} showClient={false} onSnooze={onSnooze} />
        ))}
      </div>
      {items.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`lq-press block w-full text-start text-[11px] font-semibold px-3 pt-1.5 pb-0.5 ${
            dark ? "text-white/50 hover:text-white/80" : "text-charcoal-40 hover:text-orange-deep"
          }`}
        >
          {expanded ? "Show less" : `+ ${items.length - 6} more this fortnight`}
        </button>
      )}
    </section>
  );
}

export default function AgendaView({ agenda }: { agenda: Agenda }) {
  const [mode, setMode] = useState<"clients" | "timeline">("clients");
  const [lens, setLens] = useState<Lens>("all");
  const todayIso = agenda.today;
  const [day, setDay] = useState(todayIso);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Optimistic: a snoozed row vanishes immediately; the server refresh that
  // follows makes it official (or brings it back if the save failed).
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const unhide = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const onSnooze = (item: AgendaItem, days: 1 | 7) => {
    setHidden((prev) => new Set(prev).add(item.id));
    startTransition(async () => {
      const res = await snoozeAgendaItem(item.id, days);
      if (!res.ok) {
        unhide(item.id);
        toast({ text: res.error || "Couldn’t snooze that." });
        router.refresh();
        return;
      }
      toast({
        text: days === 7 ? "Snoozed for a week" : "Snoozed until tomorrow",
        action: {
          label: "Undo",
          run: () => {
            unhide(item.id);
            void unsnoozeAgendaItem(item.id).then(() => router.refresh());
          },
        },
      });
      router.refresh();
    });
  };

  const lensCounts = useMemo(() => {
    const counts: Record<Exclude<Lens, "all">, number> = { tasks: 0, content: 0, money: 0, clients: 0 };
    for (const it of agenda.all) if (!hidden.has(it.id)) counts[KIND_LENS[it.kind]]++;
    return counts;
  }, [agenda.all, hidden]);

  const inLens = useMemo(
    () => (it: AgendaItem) => !hidden.has(it.id) && (lens === "all" || KIND_LENS[it.kind] === lens),
    [lens, hidden]
  );

  const filteredAll = useMemo(() => agenda.all.filter(inLens), [agenda.all, inLens]);
  const filteredClients: ClientAgenda[] = useMemo(
    () =>
      agenda.clients
        .map((c) => ({ ...c, items: c.items.filter(inLens) }))
        .filter((c) => c.items.length > 0),
    [agenda.clients, inLens]
  );
  const filteredStudio = useMemo(() => agenda.studio.filter(inLens), [agenda.studio, inLens]);

  // Day strip: today plus the full two-week horizon the engine computed.
  const days = useMemo(() => {
    const out: string[] = [];
    const base = new Date(`${todayIso}T12:00:00Z`).getTime();
    for (let i = 0; i <= 14; i++) out.push(new Date(base + i * 86400000).toISOString().slice(0, 10));
    return out;
  }, [todayIso]);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of filteredAll) {
      const key = it.date < todayIso ? todayIso : it.date; // overdue rides on today
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return m;
  }, [filteredAll, todayIso]);

  const dayItems = byDay.get(day) ?? [];
  const dayOverdue = day === todayIso ? dayItems.filter((i) => i.urgency === "overdue").length : 0;
  const hasAnything = agenda.all.length > 0;

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
          {agenda.snoozed > 0 && (
            <span className="ps-3 text-charcoal-40">{agenda.snoozed} snoozed</span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: "clients", label: "By client" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
        {/* The lens row — narrow the whole page to one kind of work. */}
        {hasAnything && (
          <div className="flex flex-wrap items-center gap-1.5 ms-auto">
            <button
              type="button"
              onClick={() => setLens("all")}
              className={`lq-press lq-chip !px-2.5 !py-1 ${lens === "all" ? "lq-chip--orange" : ""}`}
            >
              All
            </button>
            {(Object.keys(LENS_LABEL) as Exclude<Lens, "all">[]).map(
              (l) =>
                lensCounts[l] > 0 && (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLens(l)}
                    className={`lq-press lq-chip !px-2.5 !py-1 ${lens === l ? "lq-chip--orange" : ""}`}
                  >
                    {LENS_LABEL[l]} <span className="opacity-60 tabular-nums">{lensCounts[l]}</span>
                  </button>
                )
            )}
          </div>
        )}
      </div>

      {mode === "clients" ? (
        filteredClients.length === 0 && filteredStudio.length === 0 ? (
          <div className="lq-card">
            {hasAnything ? (
              <EmptyState
                title="Nothing under this lens"
                sub="Switch back to All — the rest of the agenda is still there."
              />
            ) : (
              <EmptyState
                icon={<PartyPopper className="w-5 h-5" />}
                title="Nothing owed to anyone"
                sub="No tasks due, no invoices to chase, no posts waiting. Enjoy it — it won't last."
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lq-stagger">
            {filteredClients.map((c, i) => (
              <AgendaCard
                key={c.slug}
                index={i}
                title={c.name}
                titleHref={`/admin/clients/${c.slug}/edit`}
                items={c.items}
                onSnooze={onSnooze}
                swatch={
                  <span
                    className="w-7 h-7 rounded-full shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.4)]"
                    style={{ background: c.color }}
                  />
                }
              />
            ))}
            {filteredStudio.length > 0 && (
              <AgendaCard
                index={filteredClients.length}
                title="Studio"
                items={filteredStudio}
                dark
                onSnooze={onSnooze}
                swatch={<span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFA226] to-[#F57F00] shrink-0" />}
              />
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
              sub={`${dayItems.length} item${dayItems.length === 1 ? "" : "s"}${dayOverdue ? ` · includes ${dayOverdue} overdue` : ""}`}
            />
            {dayItems.length === 0 ? (
              <EmptyState title="Clear day" sub="Nothing lands here yet." />
            ) : (
              <div className="flex flex-col">
                {dayItems.map((it) => (
                  <ItemRow key={it.id} item={it} onSnooze={onSnooze} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
