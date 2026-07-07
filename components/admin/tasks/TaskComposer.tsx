"use client";

// The smart quick-add. One input that understands plain language: as you type,
// dates, times, priorities and @projects light up in place (a highlight layer
// under the text) and pop out as live glass chips underneath. Chips are
// dismissible; the destination list can be picked by hand or by typing "@…";
// a Things-style "When" popover offers quick days + a mini month grid.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { parseTask, type ParsedTask, type ParsedTokenKind, type ProjectOption } from "@/lib/taskParse";
import type { TaskPriority } from "@/lib/clients";
import { PRIORITY_META } from "./types";

export type ComposerSubmit = {
  title: string;
  due?: string;
  time?: string;
  priority?: TaskPriority;
  project: ProjectOption;
};

const TOKEN_TINT: Record<ParsedTokenKind, string> = {
  due: "rgba(255,145,0,0.20)",
  time: "rgba(255,145,0,0.20)",
  priority: "rgba(239,68,68,0.16)",
  project: "rgba(48,48,48,0.10)",
};

const KIND_ICON: Record<ParsedTokenKind, string> = { due: "📅", time: "⏰", priority: "⚑", project: "＠" };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export default function TaskComposer({
  projects,
  defaultProject,
  onSubmit,
  compact = false,
  autoFocusKey = true,
}: {
  projects: ProjectOption[];
  defaultProject: ProjectOption;
  onSubmit: (t: ComposerSubmit) => Promise<boolean>; // resolve false → keep text
  compact?: boolean;
  autoFocusKey?: boolean; // bind the global "n" / "/" focus shortcut
}) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<Set<ParsedTokenKind>>(new Set());
  const [pickedProject, setPickedProject] = useState<ProjectOption | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [whenMonth, setWhenMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const whenRef = useRef<HTMLDivElement>(null);

  const parsed: ParsedTask = useMemo(() => parseTask(text, projects), [text, projects]);
  const activeTokens = parsed.tokens.filter((t) => !ignored.has(t.kind));
  const due = ignored.has("due") ? undefined : parsed.due;
  const time = ignored.has("time") ? undefined : parsed.time;
  const priority = ignored.has("priority") ? undefined : parsed.priority;
  const project = pickedProject ?? (!ignored.has("project") && parsed.project ? parsed.project : defaultProject);

  // Global focus shortcut: "n" or "/" jumps to the composer.
  useEffect(() => {
    if (!autoFocusKey) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocusKey]);

  // Close popovers on outside click.
  useEffect(() => {
    if (!listOpen && !whenOpen) return;
    const close = (e: MouseEvent) => {
      if (listOpen && !listRef.current?.contains(e.target as Node)) setListOpen(false);
      if (whenOpen && !whenRef.current?.contains(e.target as Node)) setWhenOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [listOpen, whenOpen]);

  // Title = the raw text minus only the ACTIVE tokens — a dismissed chip's
  // words stay in the title ("prepare tomorrow's agenda" keeps its "tomorrow"
  // once the date chip is removed).
  const finalTitle = useMemo(() => {
    let title = text;
    for (const tok of [...activeTokens].sort((a, b) => b.start - a.start)) {
      title = title.slice(0, tok.start) + " " + title.slice(tok.end);
    }
    return title.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  }, [text, activeTokens]);

  const submit = useCallback(async () => {
    const title = finalTitle || text.trim();
    if (!title || busy) return;
    setBusy(true);
    const ok = await onSubmit({ title, due, time, priority, project });
    setBusy(false);
    if (ok) {
      setText("");
      setIgnored(new Set());
      setPickedProject(null);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 700);
      inputRef.current?.focus();
    }
  }, [finalTitle, text, busy, onSubmit, due, time, priority, project]);

  // Highlight layer — the same text, transparent, with tinted pills behind the
  // recognised fragments. Sits underneath the real input so the caret and
  // typing stay 100% native.
  const highlighted = useMemo(() => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let pos = 0;
    for (const tok of activeTokens) {
      if (tok.start >= tok.end || tok.start < pos) continue;
      if (tok.start > pos) parts.push(<span key={`p${pos}`}>{text.slice(pos, tok.start)}</span>);
      parts.push(
        <span key={`t${tok.start}`} className="rounded-[6px] transition-colors duration-150" style={{ background: TOKEN_TINT[tok.kind], boxDecorationBreak: "clone" }}>
          {text.slice(tok.start, tok.end)}
        </span>
      );
      pos = tok.end;
    }
    if (pos < text.length) parts.push(<span key={`p${pos}`}>{text.slice(pos)}</span>);
    return parts;
  }, [text, activeTokens]);

  // Append a phrase the parser understands, waking the "due" token back up.
  const appendPhrase = useCallback((phrase: string) => {
    setIgnored((s) => {
      const n = new Set(s);
      n.delete("due");
      return n;
    });
    setText((t) => `${t.trimEnd()} ${phrase}`.trimStart());
    inputRef.current?.focus();
  }, []);

  const chip = (kind: ParsedTokenKind, label: string) => (
    <button
      key={kind + label}
      type="button"
      onClick={() => setIgnored((s) => new Set(s).add(kind))}
      title="Click to remove"
      className="ms-chip lq-press group inline-flex items-center gap-1.5 rounded-full border border-charcoal/10 bg-white/80 ps-2 pe-1.5 py-1 text-[12px] font-display font-semibold text-charcoal-80 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_6px_rgba(48,48,48,.06)]"
    >
      <span aria-hidden className="text-[11px] leading-none">{KIND_ICON[kind]}</span>
      {label}
      <span className="w-3.5 h-3.5 rounded-full bg-charcoal/10 text-charcoal-40 group-hover:bg-charcoal/15 group-hover:text-charcoal-80 text-[9px] leading-[14px] text-center">✕</span>
    </button>
  );

  const quickDate = (label: string, phrase?: string) => (
    <button
      key={label}
      type="button"
      onClick={() => appendPhrase((phrase || label).toLowerCase())}
      className="lq-press rounded-full px-2.5 py-1 text-[12px] font-medium text-charcoal-40 hover:text-charcoal-80 hover:bg-charcoal/5 transition-colors"
    >
      {label}
    </button>
  );

  // ---- the Things-style "When" mini calendar ----
  const todayIso = new Date();
  const monthDays = useMemo(() => {
    const first = new Date(whenMonth.y, whenMonth.m, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const count = new Date(whenMonth.y, whenMonth.m + 1, 0).getDate();
    return { startPad, count };
  }, [whenMonth]);

  const pickDay = (day: number) => {
    setWhenOpen(false);
    appendPhrase(`${MONTHS[whenMonth.m]} ${day}`);
  };

  return (
    <div
      className={`relative rounded-[26px] transition-all duration-200 ${justAdded ? "ms-composer-flash" : ""}
        bg-gradient-to-b from-white/95 to-white/80 border border-charcoal/10
        shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_34px_-14px_rgba(48,48,48,.16)]
        focus-within:border-orange/50 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_14px_40px_-12px_rgba(255,145,0,0.35)] focus-within:ring-4 focus-within:ring-orange/10`}
    >
      <div className={`flex items-center gap-3 ${compact ? "px-3.5 py-2" : "px-4 py-3"}`}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !(finalTitle || text.trim())}
          aria-label="Add task"
          className={`lq-press shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${compact ? "w-6 h-6 text-sm" : "w-7 h-7 text-base"} ${
            finalTitle || text.trim()
              ? "bg-gradient-to-br from-[#FFA226] to-[#F57F00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_14px_-4px_rgba(255,145,0,.6)] scale-100"
              : "bg-charcoal/5 text-charcoal-40 scale-90"
          }`}
        >
          +
        </button>
        <div className="relative flex-1 min-w-0">
          {/* highlight layer */}
          <div
            aria-hidden
            className={`absolute inset-0 whitespace-pre overflow-hidden text-transparent select-none pointer-events-none ${compact ? "text-sm" : "text-[15px]"}`}
            style={{ font: "inherit" }}
          >
            {highlighted}
          </div>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) {
                setIgnored(new Set());
                setPickedProject(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
            placeholder={compact ? "Add a task — try “call Rami tomorrow 5pm”" : "Add a task — try “Send moodboard @vivid tomorrow at 5pm !high”"}
            className={`relative w-full bg-transparent focus:outline-none placeholder:text-charcoal-40/70 text-ink ${compact ? "text-sm" : "text-[15px]"}`}
            enterKeyHint="done"
          />
        </div>

        {/* When — Things-style date popover */}
        <div className="relative shrink-0" ref={whenRef}>
          <button
            type="button"
            onClick={() => setWhenOpen((o) => !o)}
            title="When is this due?"
            aria-label="Pick a date"
            className={`lq-press inline-flex items-center justify-center rounded-full transition-colors ${compact ? "w-6 h-6" : "w-7 h-7"} ${
              due ? "bg-orange/15 text-orange-deep" : "bg-charcoal/5 text-charcoal-40 hover:text-charcoal-80"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="4" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
          {whenOpen && (
            <div className="lq-pop lq-chrome absolute end-0 top-full mt-2 z-30 w-[248px] p-3">
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {[
                  { label: "Today", phrase: "today" },
                  { label: "Tomorrow", phrase: "tomorrow" },
                  { label: "This weekend", phrase: "sat" },
                  { label: "Next week", phrase: "next week" },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setWhenOpen(false);
                      appendPhrase(q.phrase);
                    }}
                    className="lq-press rounded-xl bg-white/70 border border-charcoal/5 px-2.5 py-2 text-[12px] font-display font-semibold text-charcoal-80 hover:bg-white text-start"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between px-1 pb-1.5">
                <button
                  type="button"
                  className="lq-press w-6 h-6 rounded-full hover:bg-charcoal/5 text-charcoal-60"
                  onClick={() => setWhenMonth((s) => (s.m === 0 ? { y: s.y - 1, m: 11 } : { y: s.y, m: s.m - 1 }))}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="text-[11.5px] font-display font-bold text-ink capitalize">
                  {MONTHS[whenMonth.m]} {whenMonth.y}
                </span>
                <button
                  type="button"
                  className="lq-press w-6 h-6 rounded-full hover:bg-charcoal/5 text-charcoal-60"
                  onClick={() => setWhenMonth((s) => (s.m === 11 ? { y: s.y + 1, m: 0 } : { y: s.y, m: s.m + 1 }))}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className="text-[9px] font-display font-bold text-charcoal-40 py-0.5">{d}</span>
                ))}
                {Array.from({ length: monthDays.startPad }).map((_, i) => (
                  <span key={`pad${i}`} />
                ))}
                {Array.from({ length: monthDays.count }).map((_, i) => {
                  const day = i + 1;
                  const isPast =
                    new Date(whenMonth.y, whenMonth.m, day, 23, 59) < todayIso;
                  const isToday =
                    whenMonth.y === todayIso.getFullYear() && whenMonth.m === todayIso.getMonth() && day === todayIso.getDate();
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPast && !isToday}
                      onClick={() => pickDay(day)}
                      className={`lq-press h-7 rounded-lg text-[11.5px] font-semibold tabular-nums ${
                        isToday
                          ? "bg-gradient-to-br from-[#FFA226] to-[#F57F00] text-white"
                          : isPast
                          ? "text-charcoal-20"
                          : "text-charcoal-80 hover:bg-orange/15 hover:text-orange-deep"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* destination list picker */}
        <div className="relative shrink-0" ref={listRef}>
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="lq-press inline-flex items-center gap-1.5 rounded-full border border-charcoal/10 bg-white/70 ps-2 pe-2.5 py-1 text-[12px] font-display font-semibold text-charcoal-80 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] max-w-[104px] sm:max-w-[160px]"
            title="Where this task goes"
          >
            {project.kind === "notion" ? (
              <span className="w-3.5 h-3.5 rounded-[4px] bg-charcoal text-white text-[9px] font-bold leading-[14px] text-center shrink-0">N</span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: project.color || "#FF9100" }} />
            )}
            <span className="truncate">{project.name}</span>
            <span className="text-charcoal-40 text-[9px]">▾</span>
          </button>
          {listOpen && (
            <div className="lq-pop lq-chrome absolute end-0 top-full mt-2 z-30 w-56 max-h-72 overflow-y-auto p-1.5">
              {projects.map((p) => (
                <button
                  key={`${p.kind}-${p.key}`}
                  type="button"
                  onClick={() => {
                    setPickedProject(p);
                    setListOpen(false);
                    inputRef.current?.focus();
                  }}
                  className={`lq-press w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] text-start hover:bg-white/70 ${
                    p.key === project.key && p.kind === project.kind ? "font-semibold text-ink" : "text-charcoal-60"
                  }`}
                >
                  {p.kind === "notion" ? (
                    <span className="w-3.5 h-3.5 rounded-[4px] bg-charcoal text-white text-[9px] font-bold leading-[14px] text-center shrink-0">N</span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#FF9100" }} />
                  )}
                  <span className="truncate flex-1">{p.name}</span>
                  {p.key === project.key && p.kind === project.kind && <span className="text-orange text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* live chips: what the input understood */}
      {text.trim() && (
        <div className={`flex items-center gap-1.5 flex-wrap ${compact ? "px-3.5 pb-2" : "px-4 pb-3"}`}>
          {due && chip("due", activeTokens.find((t) => t.kind === "due")?.label || due)}
          {time && chip("time", time)}
          {priority && priority !== "normal" && chip("priority", PRIORITY_META[priority].label)}
          {!pickedProject && !ignored.has("project") && parsed.project && chip("project", parsed.project.name)}
          {!due && (
            <span className="inline-flex items-center gap-0.5 ms-0.5">
              {quickDate("Today")}
              {quickDate("Tomorrow")}
              {quickDate("Next week")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
