import { redirect } from "next/navigation";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getBoardData } from "@/lib/taskBoard";
import TasksBoard from "@/components/admin/tasks/TasksBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeeDeliverables(user)) redirect("/admin");

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Everything the studio owes</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Tasks</h1>
      </div>
    </header>
  );

  if (!isDbEnabled()) {
    return (
      <div className="space-y-5">
        {header}
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>
      </div>
    );
  }

  const { tasks, projects, notionConnected, notionHint } = await getBoardData();
  return (
    <div className="space-y-5">
      {header}
      <TasksBoard initial={tasks} projects={projects} notionConnected={notionConnected} notionHint={notionHint} />
    </div>
  );
}
