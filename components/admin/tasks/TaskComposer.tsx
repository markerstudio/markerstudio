"use client";

// The smart quick-add. One input that understands plain language: as you type,
// dates, times, priorities and @projects light up in place (a highlight layer
// under the text) and pop out as live chips underneath — Apple Reminders
// energy, Marker branding. Chips are dismissible; the destination list can be
// picked by hand or by typing "@…".
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
  due: "rgba(255,145,0,0.18)",
  time: "rgba(255,145,0,0.18)",
  priority: "rgba(239,68,68,0.14)",
  project: "rgba(48,48,48,0.10)",
};

const KIND_ICON: Record<ParsedTokenKind, string> = { due: "📅", time: "⏰", priority: "⚑", project: "＠" };

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
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Close the list picker on outside click.
  useEffect(() => {
    if (!listOpen) return;
    const close = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node)) setListOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [listOpen]);

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

  const chip = (kind: ParsedTokenKind, label: string) => (
    <button
      key={kind + label}
      type="button"
      onClick={() => setIgnored((s) => new Set(s).add(kind))}
      title="Click to remove"
      className="ms-chip group inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-2 pr-1.5 py-1 text-[12px] font-semibold text-neutral-700 shadow-sm hover:border-neutral-300"
    >
      <span aria-hidden className="text-[11px] leading-none">{KIND_ICON[kind]}</span>
      {label}
      <span className="w-3.5 h-3.5 rounded-full bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200 group-hover:text-neutral-600 text-[9px] leading-[14px] text-center">✕</span>
    </button>
  );

  const quickDate = (label: string) => (
    <button
      key={label}
      type="button"
      onClick={() => {
        setIgnored((s) => {
          const n = new Set(s);
          n.delete("due");
          return n;
        });
        setText((t) => `${t.trimEnd()} ${label.toLowerCase()}`);
        inputRef.current?.focus();
      }}
      className="rounded-full px-2.5 py-1 text-[12px] font-medium text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div
      className={`ms-composer relative rounded-2xl border bg-white transition-all duration-200 ${
        justAdded ? "ms-composer-flash" : ""
      } border-neutral-200 focus-within:border-orange focus-within:shadow-[0_8px_30px_-8px_rgba(255,145,0,0.35)] focus-within:ring-4 focus-within:ring-orange/10`}
    >
      <div className={`flex items-center gap-3 ${compact ? "px-3.5 py-2" : "px-4 py-3"}`}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !(finalTitle || text.trim())}
          aria-label="Add task"
          className={`shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${compact ? "w-6 h-6 text-sm" : "w-7 h-7 text-base"} ${
            finalTitle || text.trim() ? "bg-orange text-white hover:bg-orange-deep scale-100" : "bg-neutral-100 text-neutral-400 scale-90"
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
            className={`relative w-full bg-transparent focus:outline-none placeholder:text-neutral-300 text-neutral-900 ${compact ? "text-sm" : "text-[15px]"}`}
            enterKeyHint="done"
          />
        </div>

        {/* destination list picker */}
        <div className="relative shrink-0" ref={listRef}>
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 pl-2 pr-2.5 py-1 text-[12px] font-semibold text-neutral-600 hover:border-neutral-300 transition-colors max-w-[104px] sm:max-w-[160px]"
            title="Where this task goes"
          >
            {project.kind === "notion" ? (
              <span className="w-3.5 h-3.5 rounded-[4px] bg-neutral-900 text-white text-[9px] font-bold leading-[14px] text-center shrink-0">N</span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: project.color || "#FF9100" }} />
            )}
            <span className="truncate">{project.name}</span>
            <span className="text-neutral-400 text-[9px]">▾</span>
          </button>
          {listOpen && (
            <div className="ms-pop absolute right-0 top-full mt-1.5 z-30 w-56 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl p-1.5">
              {projects.map((p) => (
                <button
                  key={`${p.kind}-${p.key}`}
                  type="button"
                  onClick={() => {
                    setPickedProject(p);
                    setListOpen(false);
                    inputRef.current?.focus();
                  }}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left hover:bg-neutral-50 ${
                    p.key === project.key && p.kind === project.kind ? "font-semibold text-neutral-900" : "text-neutral-600"
                  }`}
                >
                  {p.kind === "notion" ? (
                    <span className="w-3.5 h-3.5 rounded-[4px] bg-neutral-900 text-white text-[9px] font-bold leading-[14px] text-center shrink-0">N</span>
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
            <span className="inline-flex items-center gap-0.5 ml-0.5">
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
