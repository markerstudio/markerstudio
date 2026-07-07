"use client";

// Dashboard "Today" widget — the day's tasks (overdue first), check-off in
// place, plus the same smart composer in compact form. A slice of the full
// board, sharing its actions and optimistic style.
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { friendlyDue, toISODate, type ProjectOption } from "@/lib/taskParse";
import { patchTask, createTask } from "@/app/admin/deliverables/actions";
import TaskComposer, { type ComposerSubmit } from "./TaskComposer";
import { type BoardTask, PRIORITY_META, PRIORITY_WEIGHT, NOTION_SLUG } from "./types";

export default function TodayTasks({ initial, projects }: { initial: BoardTask[]; projects: ProjectOption[] }) {
  const [tasks, setTasks] = useState<BoardTask[]>(initial);
  const [error, setError] = useState("");
  const today = toISODate(new Date());

  const list = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done" && !(t.requestedByClient && t.pending));
    const overdue = open.filter((t) => t.due && t.due < today);
    const due = open.filter((t) => t.due === today);
    const urgent = open.filter((t) => (!t.due || t.due > today) && t.priority === "urgent");
    const sort = (a: BoardTask, b: BoardTask) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || ((a.due || "9999") < (b.due || "9999") ? -1 : 1);
    return [...overdue.sort(sort), ...due.sort(sort), ...urgent.sort(sort)].slice(0, 6);
  }, [tasks, today]);

  const doneToday = tasks.filter((t) => t.status === "done" && (t.completedAt || "").slice(0, 10) === today).length;

  const complete = useCallback(
    async (t: BoardTask) => {
      const prev = tasks;
      setTasks((ts) => ts.map((x) => (x.key === t.key ? { ...x, status: "done", completedAt: new Date().toISOString() } : x)));
      const res = await patchTask(t.slug, t.id, { status: "done" });
      if (!res.ok) {
        setTasks(prev);
        setError(res.error || "Couldn’t save.");
        setTimeout(() => setError(""), 3000);
      }
    },
    [tasks]
  );

  const add = useCallback(
    async (c: ComposerSubmit): Promise<boolean> => {
      const slug = c.project.kind === "notion" ? NOTION_SLUG : c.project.key;
      const res = await createTask({
        slug,
        title: c.title,
        due: c.due || toISODate(new Date()), // dashboard adds default to today
        time: c.time,
        priority: c.priority,
        notionProjectId: c.project.kind === "notion" && c.project.key !== "notion" ? c.project.key : undefined,
        listName: c.project.kind === "notion" ? undefined : c.project.name,
      });
      if (!res.ok || !res.item) {
        setError(res.error || "Couldn’t add.");
        setTimeout(() => setError(""), 3000);
        return false;
      }
      const item = res.item;
      setTasks((ts) => [
        ...ts,
        {
          key: `${slug}:${item.id}`,
          slug,
          id: item.id!,
          listName: c.project.name,
          color: c.project.color || "#FF9100",
          sourceKind: c.project.kind,
          title: item.title,
          due: item.due,
          time: item.time,
          status: "todo",
          priority: item.priority || "normal",
          createdAt: item.createdAt,
        },
      ]);
      return true;
    },
    []
  );

  return (
    <div className="lq-card lq-rise p-5 flex flex-col" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">
          Today{" "}
          {doneToday > 0 && <span className="text-xs font-semibold text-emerald-600 ms-1">✓ {doneToday} done</span>}
        </h2>
        <Link href="/admin/deliverables" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">
          All tasks →
        </Link>
      </div>

      {error && <p className="text-xs text-rose-700 lq-well !border-rose-300/40 rounded-md px-2.5 py-1.5 mb-2">{error}</p>}

      {list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6 text-center">
          <span className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center">✓</span>
          <p className="text-sm text-charcoal-60">Nothing due today.</p>
        </div>
      ) : (
        <ul className="flex-1 -mx-2.5 mb-3">
          {list.map((t) => {
            const overdue = t.due && t.due < today;
            return (
              <li key={t.key} className="ms-task group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors hover:bg-white/70">
                <button
                  type="button"
                  onClick={() => complete(t)}
                  aria-label="Mark as done"
                  className={`ms-check shrink-0 w-[17px] h-[17px] rounded-full border-2 transition-colors ${overdue ? "border-rose-300" : "border-neutral-300"} hover:border-orange`}
                />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} title={t.listName} />
                <span className="flex-1 min-w-0 text-sm text-charcoal-80 truncate">{t.title}</span>
                {t.priority !== "normal" && <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[t.priority].dot}`} title={PRIORITY_META[t.priority].label} />}
                <span className={`text-[11px] font-semibold whitespace-nowrap ${overdue ? "text-rose-600" : "text-charcoal-40"}`}>
                  {t.due ? friendlyDue(t.due) : ""}
                  {t.time ? ` ${t.time}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <TaskComposer projects={projects} defaultProject={projects.find((p) => p.kind === "studio") || projects[0]} onSubmit={add} compact autoFocusKey={false} />
    </div>
  );
}
