"use client";

// The Tasks board — an interactive, optimistic to-do list across every client,
// the studio, and the Notion "Projects and Tasks" database. Everything edits in
// place: click the title to rename, the date chip to reschedule, the flag to
// re-prioritise; drag a row into another date group to move it. All writes are
// optimistic with rollback + toast on failure.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskPriority, Deliverable, DeliverableStatus } from "@/lib/clients";
import { friendlyDue, toISODate, type ProjectOption } from "@/lib/taskParse";
import { patchTask, createTask, deleteTask, restoreTask, reorderTasks, clearDoneTasks, approveRequest, rejectRequest, type TaskPatch } from "@/app/admin/deliverables/actions";
import TaskComposer, { type ComposerSubmit } from "./TaskComposer";
import PlaybookWizard from "./PlaybookWizard";
import { type BoardTask, PRIORITY_META, PRIORITY_WEIGHT, STUDIO_SLUG, NOTION_SLUG } from "./types";

type GroupKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate" | "done";

const GROUPS: { key: GroupKey; label: string; tone?: string }[] = [
  { key: "overdue", label: "Overdue", tone: "text-red-600" },
  { key: "today", label: "Today", tone: "text-orange-deep" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "nodate", label: "Someday" },
  { key: "done", label: "Done", tone: "text-emerald-700" },
];

const STATUS_LABEL: Record<DeliverableStatus, string> = { todo: "To do", doing: "In progress", review: "In review", done: "Done" };
const STATUS_NEXT: Record<DeliverableStatus, DeliverableStatus> = { todo: "doing", doing: "review", review: "todo", done: "done" };

function isoPlus(days: number): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

function groupOf(t: BoardTask, today: string, tomorrow: string, weekEnd: string): GroupKey {
  if (t.status === "done") return "done";
  if (!t.due) return "nodate";
  if (t.due < today) return "overdue";
  if (t.due === today) return "today";
  if (t.due === tomorrow) return "tomorrow";
  if (t.due <= weekEnd) return "week";
  return "later";
}

// Due date applied when a task is DROPPED into a group.
function dueForGroup(g: GroupKey, today: string, tomorrow: string, weekEnd: string): string | null | undefined {
  switch (g) {
    case "today": return today;
    case "tomorrow": return tomorrow;
    case "week": return weekEnd;
    case "later": return isoPlus(14);
    case "nodate": return null;
    default: return undefined; // overdue / done — not a reschedule target
  }
}

function sortTasks(a: BoardTask, b: BoardTask): number {
  if (a.status === "done" && b.status === "done") return (b.completedAt || "") < (a.completedAt || "") ? -1 : 1;
  const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (pw !== 0) return pw;
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  if ((a.due || "9999") !== (b.due || "9999")) return (a.due || "9999") < (b.due || "9999") ? -1 : 1;
  return (a.createdAt || "") < (b.createdAt || "") ? -1 : 1;
}

function toDeliverable(t: BoardTask): Deliverable {
  return {
    id: t.id, title: t.title, detail: t.detail, note: t.note, due: t.due, time: t.time,
    status: t.status, priority: t.priority, order: t.order, createdAt: t.createdAt,
    completedAt: t.completedAt, kind: t.kind, requestedByClient: t.requestedByClient,
    pending: t.pending, notionPageId: t.sourceKind === "notion" ? t.id : undefined,
  };
}

type Toast = { id: number; text: string; undo?: () => void };

export default function TasksBoard({
  initial,
  projects,
  notionConnected,
  notionHint,
}: {
  initial: BoardTask[];
  projects: ProjectOption[];
  notionConnected: boolean;
  notionHint?: string;
}) {
  const [tasks, setTasks] = useState<BoardTask[]>(initial);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<string>("all"); // "all" | `${kind}:${key}`
  const [prioFilter, setPrioFilter] = useState<TaskPriority | "all">("all");
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(new Set<GroupKey>(["done"]));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ key: string; kind: "due" | "prio" } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ group: GroupKey; beforeKey: string | null } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const toastId = useRef(0);

  // Server refreshes (revalidation) hand us new props — adopt them, but keep
  // any in-flight optimistic rows (matched by key).
  useEffect(() => setTasks(initial), [initial]);

  // Collapse state persists across visits.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("marker:tasks:collapsed");
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch { /* first visit */ }
  }, []);
  const toggleGroup = (g: GroupKey) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g); else n.add(g);
      try { localStorage.setItem("marker:tasks:collapsed", JSON.stringify(Array.from(n))); } catch { /* ignore */ }
      return n;
    });

  const toast = useCallback((text: string, undo?: () => void) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { id, text, undo }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), undo ? 6500 : 3200);
  }, []);

  // ---- optimistic mutation helpers ----------------------------------------

  const mutate = useCallback(
    async (key: string, patch: TaskPatch & { time?: string | null }) => {
      const prev = tasks;
      const target = prev.find((t) => t.key === key);
      if (!target) return;
      setTasks((ts) =>
        ts.map((t) =>
          t.key === key
            ? {
                ...t,
                ...(patch.title !== undefined ? { title: patch.title } : null),
                ...(patch.note !== undefined ? { note: patch.note } : null),
                ...(patch.detail !== undefined ? { detail: patch.detail } : null),
                ...(patch.due !== undefined ? { due: patch.due ?? undefined } : null),
                ...(patch.time !== undefined ? { time: patch.time ?? undefined } : null),
                ...(patch.priority !== undefined ? { priority: patch.priority } : null),
                ...(patch.order !== undefined ? { order: patch.order } : null),
                ...(patch.status !== undefined
                  ? { status: patch.status, completedAt: patch.status === "done" ? new Date().toISOString() : undefined }
                  : null),
              }
            : t
        )
      );
      const res = await patchTask(target.slug, target.id, patch);
      if (!res.ok) {
        setTasks(prev);
        toast(res.error || "Couldn’t save that.");
      }
    },
    [tasks, toast]
  );

  const complete = useCallback(
    (key: string, done: boolean) => mutate(key, { status: done ? "done" : "todo" }),
    [mutate]
  );

  const remove = useCallback(
    async (key: string) => {
      const target = tasks.find((t) => t.key === key);
      if (!target) return;
      const prev = tasks;
      setTasks((ts) => ts.filter((t) => t.key !== key));
      const res = await deleteTask(target.slug, target.id);
      if (!res.ok) {
        setTasks(prev);
        toast(res.error || "Couldn’t delete.");
        return;
      }
      toast(`Deleted “${target.title.slice(0, 40)}”`, async () => {
        setTasks((ts) => (ts.some((t) => t.key === key) ? ts : [...ts, target]));
        const r = await restoreTask(target.slug, toDeliverable(target));
        if (!r.ok) {
          setTasks((ts) => ts.filter((t) => t.key !== key));
          toast(r.error || "Couldn’t restore.");
        }
      });
    },
    [tasks, toast]
  );

  const add = useCallback(
    async (c: ComposerSubmit): Promise<boolean> => {
      const slug = c.project.kind === "notion" ? NOTION_SLUG : c.project.key;
      const tempId = `tmp_${Date.now()}`;
      const temp: BoardTask = {
        key: `${slug}:${tempId}`,
        slug,
        id: tempId,
        listName: c.project.kind === "notion" ? c.project.name : c.project.name,
        color: c.project.color || "#FF9100",
        sourceKind: c.project.kind,
        title: c.title,
        due: c.due,
        time: c.time,
        status: "todo",
        priority: c.priority || "normal",
        createdAt: new Date().toISOString(),
      };
      setTasks((ts) => [...ts, temp]);
      const res = await createTask({
        slug,
        title: c.title,
        due: c.due,
        time: c.time,
        priority: c.priority,
        notionProjectId: c.project.kind === "notion" && c.project.key !== "notion" ? c.project.key : undefined,
        listName: c.project.kind === "notion" ? undefined : c.project.name,
      });
      if (!res.ok || !res.item) {
        setTasks((ts) => ts.filter((t) => t.key !== temp.key));
        toast(res.error || "Couldn’t add the task.");
        return false;
      }
      const real = res.item;
      setTasks((ts) =>
        ts.map((t) =>
          t.key === temp.key
            ? { ...temp, id: real.id || tempId, key: `${slug}:${real.id || tempId}`, notionUrl: res.notionUrl, priority: real.priority || temp.priority }
            : t
        )
      );
      return true;
    },
    [toast]
  );

  const sweepDone = useCallback(async () => {
    const doneLocal = tasks.filter((t) => t.status === "done" && t.sourceKind !== "notion");
    if (!doneLocal.length) return;
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => !(t.status === "done" && t.sourceKind !== "notion")));
    const res = await clearDoneTasks();
    if (!res.ok) {
      setTasks(prev);
      toast(res.error || "Couldn’t clear.");
    } else {
      toast(`Cleared ${res.cleared ?? doneLocal.length} done task${(res.cleared ?? doneLocal.length) === 1 ? "" : "s"}.`);
    }
  }, [tasks, toast]);

  // Playbook wizard finished — merge the batch into the board.
  const onPlaybookAdded = useCallback(
    (slug: string, listName: string, color: string, items: Deliverable[], mirrored: number) => {
      const sourceKind: BoardTask["sourceKind"] = slug === STUDIO_SLUG ? "studio" : "client";
      setTasks((ts) => [
        ...ts,
        ...items.map((item) => ({
          key: `${slug}:${item.id}`,
          slug,
          id: item.id!,
          listName,
          color,
          sourceKind,
          title: item.title,
          detail: item.detail,
          due: item.due,
          time: item.time,
          status: item.status,
          priority: item.priority || ("normal" as const),
          kind: item.kind,
          createdAt: item.createdAt,
          notionPageId: item.notionPageId,
        })),
      ]);
      toast(
        `Added ${items.length} task${items.length === 1 ? "" : "s"} for ${listName}${mirrored ? ` · ${mirrored} in Notion` : ""}.`
      );
    },
    [toast]
  );

  const decideRequest = useCallback(
    async (key: string, approve: boolean) => {
      const target = tasks.find((t) => t.key === key);
      if (!target) return;
      const prev = tasks;
      setTasks((ts) => (approve ? ts.map((t) => (t.key === key ? { ...t, pending: false } : t)) : ts.filter((t) => t.key !== key)));
      const res = approve ? await approveRequest(target.slug, target.id) : await rejectRequest(target.slug, target.id);
      if (!res.ok) {
        setTasks(prev);
        toast(res.error || "Couldn’t update the request.");
      }
    },
    [tasks, toast]
  );

  // ---- derived view ---------------------------------------------------------

  const today = toISODate(new Date());
  const tomorrow = isoPlus(1);
  const weekEnd = isoPlus(((5 - new Date().getDay() + 7) % 7) || 7); // upcoming Friday

  const pendingRequests = tasks.filter((t) => t.requestedByClient && t.pending);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.requestedByClient && t.pending) return false;
      if (listFilter !== "all" && `${t.sourceKind}:${t.slug === NOTION_SLUG ? "notion" : t.slug}` !== listFilter && !(listFilter === "notion:notion" && t.sourceKind === "notion")) return false;
      if (prioFilter !== "all" && t.priority !== prioFilter) return false;
      if (q && !`${t.title} ${t.note || ""} ${t.detail || ""} ${t.listName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, query, listFilter, prioFilter]);

  const grouped = useMemo(() => {
    const map = new Map<GroupKey, BoardTask[]>();
    for (const g of GROUPS) map.set(g.key, []);
    for (const t of visible) map.get(groupOf(t, today, tomorrow, weekEnd))!.push(t);
    for (const arr of Array.from(map.values())) arr.sort(sortTasks);
    return map;
  }, [visible, today, tomorrow, weekEnd]);

  const open = visible.filter((t) => t.status !== "done");
  const overdueCount = grouped.get("overdue")!.length;
  const todayCount = grouped.get("today")!.length;
  const doneThisWeek = tasks.filter((t) => t.status === "done" && (t.completedAt || "") >= new Date(Date.now() - 7 * 86400000).toISOString()).length;
  const weekTotal = doneThisWeek + open.filter((t) => t.due && t.due <= weekEnd).length;
  const weekPct = weekTotal ? Math.round((doneThisWeek / weekTotal) * 100) : 0;

  // ---- drag & drop ----------------------------------------------------------

  const onDrop = useCallback(
    async (group: GroupKey, beforeKey: string | null) => {
      const key = dragKey;
      setDragKey(null);
      setDropHint(null);
      if (!key) return;
      const target = tasks.find((t) => t.key === key);
      if (!target || group === "done") return;
      const arr = (grouped.get(group) || []).filter((t) => t.key !== key);
      const idx = beforeKey ? arr.findIndex((t) => t.key === beforeKey) : arr.length;
      const at = idx < 0 ? arr.length : idx;
      const before = arr[at - 1]?.order;
      const after = arr[at]?.order;
      const order =
        before !== undefined && after !== undefined ? (before + after) / 2
        : before !== undefined ? before + 1
        : after !== undefined ? after - 1
        : 0;
      const newDue = dueForGroup(group, today, tomorrow, weekEnd);
      const prev = tasks;
      setTasks((ts) =>
        ts.map((t) => (t.key === key ? { ...t, order, ...(newDue !== undefined ? { due: newDue ?? undefined } : null) } : t))
      );
      const res = await reorderTasks([{ slug: target.slug, id: target.id, order, ...(newDue !== undefined ? { due: newDue } : null) }]);
      if (!res.ok) {
        setTasks(prev);
        toast("Couldn’t move that.");
      }
    },
    [dragKey, tasks, grouped, today, tomorrow, weekEnd, toast]
  );

  // ---- row rendering --------------------------------------------------------

  const row = (t: BoardTask) => {
    const done = t.status === "done";
    const meta = PRIORITY_META[t.priority];
    const editing = editingKey === t.key;
    const noteOpen = openNoteKey === t.key;
    const overdue = !done && t.due && t.due < today;
    return (
      <li
        key={t.key}
        draggable={!editing}
        onDragStart={(e) => {
          setDragKey(t.key);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragKey(null);
          setDropHint(null);
        }}
        onDragOver={(e) => {
          if (!dragKey || dragKey === t.key) return;
          e.preventDefault();
          setDropHint({ group: groupOf(t, today, tomorrow, weekEnd), beforeKey: t.key });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(groupOf(t, today, tomorrow, weekEnd), t.key);
        }}
        className={`ms-task group relative rounded-xl transition-all duration-200 ${dragKey === t.key ? "opacity-40" : ""} ${
          dropHint?.beforeKey === t.key ? "ms-drop-before" : ""
        } ${t.priority === "urgent" && !done ? "bg-red-50/40" : "hover:bg-neutral-50"}`}
      >
        <div className="flex items-start gap-3 px-2.5 py-2">
          {/* check */}
          <button
            type="button"
            onClick={() => complete(t.key, !done)}
            aria-label={done ? "Mark as not done" : "Mark as done"}
            className={`ms-check mt-0.5 shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              done ? "bg-orange border-orange text-white" : overdue ? "border-red-300 hover:border-orange" : "border-neutral-300 hover:border-orange"
            }`}
          >
            {done && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            {/* title (inline edit) */}
            {editing ? (
              <input
                autoFocus
                defaultValue={t.title}
                onBlur={(e) => {
                  setEditingKey(null);
                  const v = e.target.value.trim();
                  if (v && v !== t.title) mutate(t.key, { title: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    (e.target as HTMLInputElement).value = t.title;
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full bg-white border border-orange/50 rounded-md px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30"
              />
            ) : (
              <button
                type="button"
                onClick={() => !done && setEditingKey(t.key)}
                className={`text-left text-sm leading-snug transition-colors ${done ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-900 hover:text-orange-deep"}`}
                title={done ? undefined : "Click to rename"}
              >
                {t.title}
                {t.kind === "recurring" && <span className="ml-1.5 align-middle text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-px bg-neutral-100 text-neutral-500">↻</span>}
              </button>
            )}
            {/* meta line */}
            <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-neutral-400">
              <span className="inline-flex items-center gap-1.5 font-medium text-neutral-500">
                {t.sourceKind === "notion" ? (
                  <span className="w-3 h-3 rounded-[3px] bg-neutral-900 text-white text-[8px] font-bold leading-3 text-center">N</span>
                ) : (
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                )}
                {t.listName}
              </span>
              {t.detail && <span className="truncate max-w-[280px]">{t.detail}</span>}
              {t.notionUrl && (
                <a href={t.notionUrl} target="_blank" rel="noreferrer" className="hover:text-orange font-medium">
                  Open in Notion ↗
                </a>
              )}
              {t.note && !noteOpen && (
                <button type="button" onClick={() => setOpenNoteKey(t.key)} className="hover:text-orange">
                  📝 note
                </button>
              )}
            </div>
            {/* note editor */}
            {noteOpen && (
              <textarea
                autoFocus
                defaultValue={t.note || ""}
                placeholder="Add a note…"
                rows={2}
                onBlur={(e) => {
                  setOpenNoteKey(null);
                  const v = e.target.value.trim();
                  if (v !== (t.note || "")) mutate(t.key, { note: v });
                }}
                className="mt-1.5 w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            )}
          </div>

          {/* right controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* status pill (todo→doing→review) */}
            {!done && t.status !== "todo" && (
              <button
                type="button"
                onClick={() => mutate(t.key, { status: STATUS_NEXT[t.status] })}
                className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${
                  t.status === "doing" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-sky-700 bg-sky-50 border-sky-200"
                }`}
                title="Tap to advance"
              >
                {STATUS_LABEL[t.status]}
              </button>
            )}
            {!done && t.status === "todo" && (
              <button
                type="button"
                onClick={() => mutate(t.key, { status: "doing" })}
                className="hidden group-hover:inline-block text-[10px] font-semibold rounded-full border border-neutral-200 text-neutral-400 px-2 py-0.5 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200"
                title="Start"
              >
                Start
              </button>
            )}

            {/* due chip + popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPopover(popover?.key === t.key && popover.kind === "due" ? null : { key: t.key, kind: "due" });
                }}
                className={`text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors ${
                  overdue ? "text-red-600 bg-red-50" : t.due === today ? "text-orange-deep bg-orange/10" : t.due ? "text-neutral-500 hover:bg-neutral-100" : "text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {t.due ? `${friendlyDue(t.due)}${t.time ? ` · ${t.time}` : ""}` : "＋ date"}
              </button>
              {popover?.key === t.key && popover.kind === "due" && (
                <div onClick={(e) => e.stopPropagation()} className="ms-pop absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-neutral-200 bg-white shadow-xl p-2 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { l: "Today", v: today },
                      { l: "Tmrw", v: tomorrow },
                      { l: "+1w", v: isoPlus(7) },
                    ].map((o) => (
                      <button key={o.l} type="button" onClick={() => { setPopover(null); mutate(t.key, { due: o.v }); }} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-[11px] font-semibold text-neutral-600 hover:border-orange hover:text-orange-deep">
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    defaultValue={t.due || ""}
                    onChange={(e) => { if (e.target.value) { setPopover(null); mutate(t.key, { due: e.target.value }); } }}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange"
                  />
                  <input
                    type="time"
                    defaultValue={t.time || ""}
                    onChange={(e) => mutate(t.key, { time: e.target.value || null })}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange"
                    title="Reminder time"
                  />
                  {t.due && (
                    <button type="button" onClick={() => { setPopover(null); mutate(t.key, { due: null, time: null }); }} className="w-full text-[11px] text-neutral-400 hover:text-red-600 py-0.5">
                      Clear date
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* priority flag + popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPopover(popover?.key === t.key && popover.kind === "prio" ? null : { key: t.key, kind: "prio" });
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-neutral-100 ${t.priority === "normal" || done ? "opacity-0 group-hover:opacity-100" : ""}`}
                title={`Priority: ${meta.label}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
              </button>
              {popover?.key === t.key && popover.kind === "prio" && (
                <div onClick={(e) => e.stopPropagation()} className="ms-pop absolute right-0 top-full mt-1 z-30 w-36 rounded-xl border border-neutral-200 bg-white shadow-xl p-1.5">
                  {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                    <button key={p} type="button" onClick={() => { setPopover(null); mutate(t.key, { priority: p }); }} className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-neutral-50 ${t.priority === p ? "font-bold" : "text-neutral-600"}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_META[p].dot}`} />
                      {PRIORITY_META[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* note toggle */}
            {!t.note && (
              <button type="button" onClick={() => setOpenNoteKey(noteOpen ? null : t.key)} className="w-6 h-6 rounded-full text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 opacity-0 group-hover:opacity-100 transition-opacity text-xs" title="Add note">
                📝
              </button>
            )}
            {/* delete */}
            <button type="button" onClick={() => remove(t.key)} className="w-6 h-6 rounded-full text-neutral-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs" title="Delete">
              ✕
            </button>
          </div>
        </div>
      </li>
    );
  };

  const listOptions = useMemo(() => {
    const seen = new Map<string, { label: string; color?: string; kind: string }>();
    for (const t of tasks) {
      const k = t.sourceKind === "notion" ? "notion:notion" : `${t.sourceKind}:${t.slug}`;
      if (!seen.has(k)) seen.set(k, { label: t.sourceKind === "notion" ? "Notion" : t.listName, color: t.color, kind: t.sourceKind });
    }
    return Array.from(seen.entries());
  }, [tasks]);

  return (
    <div className="space-y-5" onClick={() => popover && setPopover(null)}>
      {/* header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Everything you owe — across clients, the studio{notionConnected ? " and Notion" : ""}. Type naturally: dates, times, <span className="font-mono text-[12px]">!priority</span> and <span className="font-mono text-[12px]">@client</span> are picked up as you write.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-charcoal text-white text-sm font-semibold pl-3.5 pr-4 py-2 hover:bg-black transition-colors shadow-sm"
            title="Add a whole playbook of tasks — onboarding, branding, monthly marketing…"
          >
            <span className="text-orange">✦</span> Playbook
          </button>
          {/* week progress ring */}
          <div className="flex items-center gap-2.5 bg-white border border-neutral-200 rounded-full pl-1.5 pr-4 py-1.5">
            <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#EEE9E2" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="#FF9100" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(weekPct / 100) * 94.2} 94.2`}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tabular-nums">{weekPct}%</div>
              <div className="text-[10px] text-neutral-400 -mt-0.5">this week</div>
            </div>
          </div>
          {notionConnected ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 bg-white border border-neutral-200 rounded-full px-3 py-1.5" title="Two-way sync with the Notion Tasks database">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-neutral-900 text-white text-[9px] font-bold leading-[14px] text-center">N</span>
              Synced with Notion
            </span>
          ) : notionHint ? (
            <span className="text-[11px] text-neutral-400 max-w-[220px]" title={notionHint}>⚠ {notionHint}</span>
          ) : null}
        </div>
      </div>

      {/* composer */}
      <TaskComposer projects={projects} defaultProject={projects.find((p) => p.kind === "studio") || projects[0]} onSubmit={add} />

      {/* filter bar */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search tasks…"
            className="w-52 border border-neutral-200 bg-white rounded-full pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-300 text-xs">⌕</span>
        </div>
        <select value={listFilter} onChange={(e) => setListFilter(e.target.value)} className="border border-neutral-200 bg-white rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-orange">
          <option value="all">All lists</option>
          {listOptions.map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value as TaskPriority | "all")} className="border border-neutral-200 bg-white rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-orange">
          <option value="all">Any priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <span className="text-xs text-neutral-400">
          {overdueCount > 0 && <b className="text-red-600">{overdueCount} overdue · </b>}
          {todayCount > 0 && <b className="text-orange-deep">{todayCount} today · </b>}
          {open.length} open
        </span>
        {tasks.some((t) => t.status === "done" && t.sourceKind !== "notion") && (
          <button type="button" onClick={sweepDone} className="text-xs font-semibold text-neutral-400 hover:text-red-600">
            Clear done
          </button>
        )}
      </div>

      {/* client requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-bold tracking-tight text-amber-800 text-sm mb-2">
            Client requests <span className="font-medium text-amber-600">· {pendingRequests.length} waiting</span>
          </h2>
          <ul className="divide-y divide-amber-200/60">
            {pendingRequests.map((t) => (
              <li key={t.key} className="py-2 flex items-center gap-3 flex-wrap">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{t.title}</div>
                  <div className="text-[11px] text-neutral-500">{t.listName}{t.due ? ` · wants it by ${friendlyDue(t.due)}` : ""}{t.detail ? ` · ${t.detail}` : ""}</div>
                </div>
                <button type="button" onClick={() => decideRequest(t.key, true)} className="text-xs font-semibold rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1 hover:bg-emerald-100">Approve</button>
                <button type="button" onClick={() => decideRequest(t.key, false)} className="text-xs font-semibold rounded-full border border-neutral-300 text-neutral-500 px-3 py-1 hover:border-red-300 hover:text-red-600">Reject</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* groups */}
      {visible.length === 0 && pendingRequests.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl px-6 py-14 text-center">
          <div className="text-3xl mb-2">☀️</div>
          <p className="text-sm font-semibold text-neutral-700">All clear.</p>
          <p className="text-xs text-neutral-400 mt-1">Add a task above — try “Post reel for @vivid tomorrow at 5pm !high”.</p>
          <button type="button" onClick={() => setWizardOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-orange hover:text-orange-deep transition-colors">
            <span className="text-orange">✦</span> Start from a playbook
          </button>
        </div>
      ) : (
        GROUPS.map(({ key: g, label, tone }) => {
          const items = grouped.get(g)!;
          if (!items.length && g !== "today") return null;
          const isCollapsed = collapsed.has(g);
          return (
            <section
              key={g}
              onDragOver={(e) => {
                if (!dragKey || g === "done") return;
                e.preventDefault();
                if (!dropHint || dropHint.group !== g) setDropHint({ group: g, beforeKey: null });
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(g, dropHint?.group === g ? dropHint.beforeKey : null);
              }}
              className={`bg-white border rounded-2xl px-3 py-2.5 transition-colors ${dropHint?.group === g && dragKey ? "border-orange bg-orange/[0.03]" : "border-neutral-200"}`}
            >
              <button type="button" onClick={() => toggleGroup(g)} className="w-full flex items-center gap-2 px-1.5 py-1 select-none">
                <span className={`text-[13px] font-bold tracking-tight ${tone || "text-neutral-800"}`}>{label}</span>
                <span className="text-[11px] font-semibold text-neutral-300 tabular-nums">{items.length}</span>
                {g === "done" && items.length > 0 && <span className="text-[10px] text-neutral-300">· kept 2 weeks</span>}
                <span className={`ml-auto text-neutral-300 text-[10px] transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}>▼</span>
              </button>
              {!isCollapsed && (
                <ul className="mt-0.5">
                  {items.length === 0 ? (
                    <li className="px-2 py-2.5 text-xs text-neutral-300">Nothing due today — drag something here or add one above.</li>
                  ) : (
                    items.map(row)
                  )}
                </ul>
              )}
            </section>
          );
        })
      )}

      {/* playbook wizard */}
      {wizardOpen && (
        <PlaybookWizard
          projects={projects}
          notionConnected={notionConnected}
          initialProjectKey={listFilter.startsWith("client:") ? listFilter.slice(7) : listFilter.startsWith("studio:") ? STUDIO_SLUG : undefined}
          onClose={() => setWizardOpen(false)}
          onAdded={onPlaybookAdded}
        />
      )}

      {/* toasts */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="ms-toast pointer-events-auto flex items-center gap-3 bg-charcoal text-white text-sm rounded-full pl-4 pr-2 py-2 shadow-xl">
            {t.text}
            {t.undo && (
              <button
                type="button"
                onClick={() => {
                  t.undo!();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
                className="font-bold text-orange bg-white/10 rounded-full px-3 py-1 hover:bg-white/20"
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
