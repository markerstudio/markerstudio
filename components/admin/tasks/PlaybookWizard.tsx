"use client";

// The playbook wizard — "+ Tasks" for a project. Three steps:
//   1. Which project is this for?
//   2. What does it need from you? (a playbook — onboarding, branding, the
//      monthly marketing cycle, a launch — or a free checkpoint brain-dump)
//   3. Tick the tasks, then let it schedule for you (smart offsets) or
//      back-plan everything to a delivery date you choose.
// Writes the whole batch in one action; mirrors to Notion unless turned off.
import { useEffect, useMemo, useState } from "react";
import { friendlyDue, parseTask, toISODate, type ProjectOption } from "@/lib/taskParse";
import { PLAYBOOKS, CHECKPOINT_PROMPTS, buildPlaybookTasks, type Playbook, type BuiltTask } from "@/lib/taskPlaybooks";
import { applyPlaybookTasks } from "@/app/admin/deliverables/actions";
import type { Deliverable } from "@/lib/clients";
import { PRIORITY_META } from "./types";

export default function PlaybookWizard({
  projects,
  notionConnected,
  initialProjectKey,
  onClose,
  onAdded,
}: {
  projects: ProjectOption[]; // clients + studio (Notion projects are reached via mirroring)
  notionConnected: boolean;
  initialProjectKey?: string;
  onClose: () => void;
  onAdded: (slug: string, listName: string, color: string, items: Deliverable[], mirrored: number) => void;
}) {
  const locals = useMemo(() => projects.filter((p) => p.kind !== "notion"), [projects]);
  const [project, setProject] = useState<ProjectOption | null>(
    () => locals.find((p) => p.key === initialProjectKey) || null
  );
  const [playbook, setPlaybook] = useState<Playbook | "checkpoint" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [start, setStart] = useState(() => toISODate(new Date()));
  const [mode, setMode] = useState<"smart" | "delivery">("smart");
  const [delivery, setDelivery] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dump, setDump] = useState("");
  const [mirror, setMirror] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const step = !project ? 1 : !playbook ? 2 : 3;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickPlaybook = (pb: Playbook | "checkpoint") => {
    setPlaybook(pb);
    if (pb !== "checkpoint") setSelected(new Set(pb.items.filter((i) => i.defaultOn !== false).map((i) => i.id)));
  };

  // Live-built task list for the preview + submit.
  const built: BuiltTask[] = useMemo(() => {
    if (!playbook) return [];
    if (playbook === "checkpoint") {
      return dump
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const p = parseTask(line, projects);
          return { title: p.title || line, due: p.due, priority: p.priority, kind: "milestone" as const };
        });
    }
    return buildPlaybookTasks(playbook, {
      start,
      deliveryDate: mode === "delivery" && delivery ? delivery : undefined,
      weeks,
      selected,
      counts,
    });
  }, [playbook, dump, projects, start, mode, delivery, weeks, selected, counts]);

  // What an item's title looks like with its stepper count applied — used for
  // both display and matching the built preview dates.
  const resolvedTitle = (item: { id: string; title: string; count?: { default: number; min: number; max: number } }) => {
    if (!item.count) return item.title;
    const n = Math.max(item.count.min, Math.min(item.count.max, counts[item.id] ?? item.count.default));
    return item.title.replace("{n}", String(n));
  };

  const submit = async () => {
    if (!project || !built.length || busy) return;
    setBusy(true);
    setError("");
    const res = await applyPlaybookTasks({
      slug: project.key,
      listName: project.name,
      tasks: built,
      mirror: mirror && notionConnected,
    });
    setBusy(false);
    if (!res.ok || !res.items) {
      setError(res.error || "Couldn’t add the tasks.");
      return;
    }
    onAdded(project.key, project.name, project.color || "#FF9100", res.items, res.mirrored ?? 0);
    onClose();
  };

  const dot = (p: ProjectOption) => (
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#FF9100" }} />
  );

  return (
    <>
      <div className="lq-scrim" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="lq-modal lq-chrome !w-[min(94vw,672px)] !max-h-[88dvh] !p-0 flex flex-col !overflow-hidden">
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-charcoal/10 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`w-5 h-5 rounded-full flex items-center justify-center ${step === n ? "bg-orange text-white" : step > n ? "bg-orange/15 text-orange-deep" : "bg-charcoal/5 text-charcoal-40"}`}>
                {step > n ? "✓" : n}
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-display font-bold tracking-tight text-ink truncate">
              {step === 1 && "Which project is this for?"}
              {step === 2 && (
                <>
                  <button type="button" onClick={() => setProject(null)} className="lq-press inline-flex items-center gap-1.5 me-2 text-charcoal-60 hover:text-orange-deep align-middle">
                    {project && dot(project)}
                    <span className="text-xs font-semibold">{project?.name}</span>
                  </button>
                  What does it need from you?
                </>
              )}
              {step === 3 && (
                <>
                  <button type="button" onClick={() => setPlaybook(null)} className="lq-press text-charcoal-60 hover:text-orange-deep text-xs font-semibold me-2 align-middle">
                    {playbook === "checkpoint" ? "🧠 Checkpoint" : `${(playbook as Playbook)?.icon} ${(playbook as Playbook)?.name}`} ‹
                  </button>
                  for {project?.name}
                </>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="lq-press w-7 h-7 rounded-full text-charcoal-40 hover:text-ink hover:bg-charcoal/5">✕</button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {locals.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setProject(p)}
                  className="lq-press flex items-center gap-3 rounded-2xl bg-white/60 border border-charcoal/10 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] px-4 py-3 text-start hover:bg-white hover:border-orange/50 transition-all"
                >
                  {dot(p)}
                  <span className="text-sm font-semibold text-charcoal-80 truncate">{p.name}</span>
                  {p.kind === "studio" && <span className="ms-auto text-[10px] font-semibold uppercase tracking-wide text-charcoal-40">internal</span>}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {PLAYBOOKS.map((pb) => (
                <button
                  key={pb.key}
                  type="button"
                  onClick={() => pickPlaybook(pb)}
                  className="lq-press group rounded-2xl bg-white/60 border border-charcoal/10 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] px-4 py-3.5 text-start hover:bg-white hover:border-orange/50 transition-all"
                >
                  <div className="text-xl">{pb.icon}</div>
                  <div className="mt-1 text-sm font-display font-bold tracking-tight text-ink group-hover:text-orange-deep">{pb.name}</div>
                  <div className="mt-0.5 text-xs text-charcoal-60 leading-snug">{pb.tagline}</div>
                  <div className="mt-1.5 text-[10px] font-semibold text-charcoal-40">{pb.items.length} tasks</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => pickPlaybook("checkpoint")}
                className="lq-press group sm:col-span-2 rounded-2xl border border-dashed border-charcoal/20 bg-white/40 px-4 py-3.5 text-start hover:bg-white hover:border-orange/50 transition-all"
              >
                <div className="text-xl">🧠</div>
                <div className="mt-1 text-sm font-display font-bold tracking-tight text-ink group-hover:text-orange-deep">Checkpoint — ask yourself</div>
                <div className="mt-0.5 text-xs text-charcoal-60">Brain-dump what this project needs, one line each — dates and priorities are picked up automatically, then it’s sorted for you.</div>
              </button>
            </div>
          )}

          {step === 3 && playbook === "checkpoint" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {CHECKPOINT_PROMPTS.map((q) => (
                  <span key={q} className="lq-chip !text-[11px]">{q}</span>
                ))}
              </div>
              <textarea
                autoFocus
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                rows={8}
                placeholder={"One task per line — try:\nsend revised brandbook tomorrow !high\nfollow up on the unpaid invoice friday\nplan the ramadan campaign in 2 weeks"}
                className="lq-input w-full text-sm leading-relaxed"
              />
              {built.length > 0 && (
                <ul className="space-y-1">
                  {built.map((t, i) => (
                    <li key={i} className="ms-task flex items-center gap-2 text-xs text-charcoal-60">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange shrink-0" />
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.priority && t.priority !== "normal" && <span className={`w-2 h-2 rounded-full ${PRIORITY_META[t.priority].dot}`} />}
                      {t.due && <span className="text-charcoal-40 font-semibold">{friendlyDue(t.due)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 3 && playbook && playbook !== "checkpoint" && (
            <div className="space-y-4">
              {/* scheduling */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <div className="lq-seg text-xs font-semibold">
                  <button type="button" onClick={() => setMode("smart")} className={`lq-seg__opt ${mode === "smart" ? "is-on" : ""}`}>
                    ✦ Sort it for me
                  </button>
                  <button type="button" onClick={() => setMode("delivery")} className={`lq-seg__opt ${mode === "delivery" ? "is-on" : ""}`}>
                    I have a delivery date
                  </button>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs text-charcoal-60">
                  starts
                  <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="lq-input !px-2 !py-1 !text-xs" />
                </label>
                {mode === "delivery" && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-charcoal-60">
                    deliver by
                    <input type="date" value={delivery} min={start} onChange={(e) => setDelivery(e.target.value)} className="lq-input !px-2 !py-1 !text-xs !border-orange/50" />
                  </label>
                )}
                {playbook.hasWeeks && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-charcoal-60">
                    for
                    <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="lq-input !px-2 !py-1 !text-xs">
                      {[2, 4, 6, 8].map((w) => <option key={w} value={w}>{w} weeks</option>)}
                    </select>
                  </label>
                )}
              </div>

              {/* checklist */}
              <ul className="lq-well !p-0 overflow-hidden divide-y divide-charcoal/5">
                {playbook.items.map((item) => {
                  const on = selected.has(item.id);
                  const shown = resolvedTitle(item);
                  const preview = built.find((b) => b.title === shown || b.title.startsWith(`${shown} ·`));
                  const n = item.count ? Math.max(item.count.min, Math.min(item.count.max, counts[item.id] ?? item.count.default)) : 0;
                  const bump = (d: number) =>
                    setCounts((c) => ({ ...c, [item.id]: Math.max(item.count!.min, Math.min(item.count!.max, n + d)) }));
                  return (
                    <li key={item.id} className="flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((s) => {
                            const set = new Set(s);
                            if (set.has(item.id)) set.delete(item.id); else set.add(item.id);
                            return set;
                          })
                        }
                        className={`lq-press flex-1 min-w-0 flex items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-white/70 ${on ? "" : "opacity-45"}`}
                      >
                        <span className={`ms-check w-[17px] h-[17px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${on ? "bg-orange border-orange text-white" : "border-neutral-300"}`}>
                          {on && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-charcoal-80 truncate">
                            {shown}
                            {item.recurring && <span className="lq-chip ms-1.5 !text-[9px] !px-1.5 !py-px uppercase align-middle">weekly</span>}
                          </span>
                          {item.detail && <span className="block text-[11px] text-charcoal-40 truncate">{item.detail}</span>}
                        </span>
                        {item.priority && item.priority !== "normal" && <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[item.priority].dot}`} title={PRIORITY_META[item.priority].label} />}
                        <span className="text-[11px] font-semibold text-charcoal-40 whitespace-nowrap tabular-nums">
                          {on && preview?.due ? friendlyDue(preview.due) : ""}
                        </span>
                      </button>
                      {item.count && on && (
                        <span className="flex items-center gap-1 pe-3 shrink-0" title={item.count.label}>
                          <button type="button" onClick={() => bump(-1)} disabled={n <= item.count.min} className="lq-press w-5 h-5 rounded-full border border-charcoal/15 text-charcoal-60 text-xs leading-none hover:border-orange hover:text-orange-deep disabled:opacity-30">−</button>
                          <span className="w-5 text-center text-xs font-bold tabular-nums text-ink">{n}</span>
                          <button type="button" onClick={() => bump(1)} disabled={n >= item.count.max} className="lq-press w-5 h-5 rounded-full border border-charcoal/15 text-charcoal-60 text-xs leading-none hover:border-orange hover:text-orange-deep disabled:opacity-30">＋</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* footer */}
        {step === 3 && (
          <div className="border-t border-charcoal/10 px-5 py-3 flex items-center gap-3 flex-wrap shrink-0">
            {notionConnected && (
              <label className="inline-flex items-center gap-2 text-xs text-charcoal-60 cursor-pointer">
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="custom-checkbox" />
                Also write to Notion
              </label>
            )}
            {error && <span className="text-xs text-rose-600">{error}</span>}
            <div className="flex-1" />
            <span className="text-xs text-charcoal-40 tabular-nums">{built.length} task{built.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={submit}
              disabled={busy || built.length === 0 || (mode === "delivery" && playbook !== "checkpoint" && !delivery)}
              className="lq-btn lq-btn--primary disabled:opacity-40"
            >
              {busy ? "Adding…" : `Add ${built.length || ""} task${built.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
