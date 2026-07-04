// Server-side assembly for the Tasks board and the dashboard Today widget:
// every client's deliverables + the studio list + the Notion "Projects and
// Tasks" database, flattened into one BoardTask list with the project options
// the smart composer offers.
import { getClients, saveDeliverablesBlock, type Deliverable } from "@/lib/clients";
import { ensureDeliverableIds } from "@/lib/deliverables";
import { getStudioDeliverables, saveStudioDeliverables, STUDIO_SLUG } from "@/lib/studio";
import { getNotionTasks, isNotionTasksConfigured } from "@/lib/notionTasks";
import type { BoardTask } from "@/components/admin/tasks/types";
import type { ProjectOption } from "@/lib/taskParse";

const NOTION_SLUG = "__notion__";

function flat(slug: string, listName: string, color: string, sourceKind: BoardTask["sourceKind"], item: Deliverable): BoardTask {
  return {
    key: `${slug}:${item.id}`,
    slug,
    id: item.id!,
    listName,
    color,
    sourceKind,
    title: item.title,
    detail: item.detail,
    note: item.note,
    due: item.due,
    time: item.time,
    status: item.status,
    priority: item.priority || "normal",
    order: item.order,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    kind: item.kind,
    requestedByClient: item.requestedByClient,
    pending: item.pending,
  };
}

export type BoardData = {
  tasks: BoardTask[];
  projects: ProjectOption[];
  notionConnected: boolean;
  notionHint?: string;
};

export async function getBoardData(): Promise<BoardData> {
  const clients = await getClients();
  const tasks: BoardTask[] = [];
  const projects: ProjectOption[] = [{ key: STUDIO_SLUG, name: "Studio", kind: "studio", color: "#303030" }];

  for (const c of clients) {
    if (c.data?.archived) continue;
    const name = c.name || c.slug;
    projects.push({ key: c.slug, name, kind: "client", color: c.color || "#FF9100" });
    const block = c.data.deliverables;
    if (!block?.items?.length) continue;
    const ensured = ensureDeliverableIds(block);
    // Legacy rows had no id, which made them un-editable (fix-by-id actions
    // silently no-oped). Persist the assigned ids once so every row is durable.
    if ((block.items ?? []).some((i) => !i.id)) await saveDeliverablesBlock(c.slug, ensured);
    for (const item of ensured.items ?? []) tasks.push(flat(c.slug, name, c.color || "#FF9100", "client", item));
  }

  const studioRaw = await getStudioDeliverables();
  const studio = ensureDeliverableIds({ items: studioRaw }).items ?? [];
  if (studioRaw.some((i) => !i.id)) await saveStudioDeliverables(studio);
  for (const item of studio) tasks.push(flat(STUDIO_SLUG, "Studio", "#303030", "studio", item));

  // Notion "Projects and Tasks" — pulled live (cached ~60s), best-effort.
  let notionConnected = false;
  let notionHint: string | undefined;
  if (isNotionTasksConfigured()) {
    const { tasks: ntasks, projects: nprojects, ok } = await getNotionTasks();
    notionConnected = ok;
    if (!ok) notionHint = "Notion tasks unreachable — share the “Projects and Tasks” page with the Marker integration.";
    for (const p of nprojects) projects.push({ key: p.id, name: p.name, kind: "notion" });
    if (ok && !nprojects.length) projects.push({ key: "notion", name: "Notion", kind: "notion" });
    for (const nt of ntasks) {
      tasks.push({
        key: `${NOTION_SLUG}:${nt.pageId}`,
        slug: NOTION_SLUG,
        id: nt.pageId,
        listName: nt.projectName ? `Notion · ${nt.projectName}` : "Notion",
        color: "#1A1A1A",
        sourceKind: "notion",
        notionUrl: nt.url,
        title: nt.title,
        detail: nt.detail,
        due: nt.due,
        time: nt.time,
        status: nt.done ? "done" : "todo",
        priority: nt.priority || "normal",
        completedAt: nt.done ? nt.editedAt : undefined,
        createdAt: nt.editedAt,
      });
    }
  }

  return { tasks, projects, notionConnected, notionHint };
}
