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

  if (!isDbEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4">No database configured.</p>
      </div>
    );
  }

  const { tasks, projects, notionConnected, notionHint } = await getBoardData();
  return <TasksBoard initial={tasks} projects={projects} notionConnected={notionConnected} notionHint={notionHint} />;
}
