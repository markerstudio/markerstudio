// Two-way link with the Notion "Projects and Tasks" page (the Tasks + Projects
// databases). Read: Notion tasks appear on the admin Tasks board next to the
// app's own items. Write: completing/editing/creating from the board updates
// Notion. Best-effort everywhere — Notion being down or unshared must never
// break the board; callers get [] / false and the UI shows a connect hint.
//
// Schema (the real workspace database):
//   Name (title) · Complete (checkbox) · Date (date, optionally with time)
//   Description (rich_text) · Priority (select: Low/Medium/High/Urgent)
//   Project (relation → Projects DB)
import { unstable_cache } from "next/cache";
import { notionGet, notionPost, notionPatch } from "@/lib/notion";
import type { TaskPriority } from "@/lib/clients";

// The Tasks / Projects databases under the "Projects and Tasks" page. These
// are the ids from the studio workspace; if they ever 404 (page moved, new
// workspace, different share), resolveDbs() falls back to searching the
// integration's accessible databases by title, so the sync self-heals.
const TASKS_DB = process.env.NOTION_TASKS_DB || "1dc2487b8e7e81f7ba2fe7b841c9a592";
const PROJECTS_DB = process.env.NOTION_PROJECTS_DB || "1dc2487b8e7e8164a427fff623bb9b53";

type ResolvedDbs = { tasks: string | null; projects: string | null; tasksTitle: string; projectsTitle: string };
let _resolved: ResolvedDbs | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
function titlePropOf(db: any): string {
  for (const [name, p] of Object.entries<any>(db?.properties || {})) {
    if (p?.type === "title") return name;
  }
  return "Name";
}

// Search the integration's accessible databases for one whose title matches.
async function discoverDb(titleRe: RegExp): Promise<{ id: string; title: string } | null> {
  try {
    const res = await notionPost(`/v1/search`, {
      filter: { value: "database", property: "object" },
      page_size: 50,
    });
    for (const db of res?.results || []) {
      const t = (db?.title || []).map((x: any) => x.plain_text).join("").trim();
      if (titleRe.test(t)) return { id: db.id as string, title: titlePropOf(db) };
    }
  } catch {
    /* search unavailable — stay with the configured ids */
  }
  return null;
}

// Validate the configured ids once per process; fall back to discovery. Also
// learns each database's title property name so writes never guess wrong.
async function resolveDbs(): Promise<ResolvedDbs> {
  if (_resolved) return _resolved;
  const out: ResolvedDbs = { tasks: null, projects: null, tasksTitle: "Name", projectsTitle: "Name" };
  try {
    const db = await notionGet(`/v1/databases/${TASKS_DB}`);
    out.tasks = TASKS_DB;
    out.tasksTitle = titlePropOf(db);
  } catch {
    const found = await discoverDb(/^tasks$/i);
    if (found) {
      out.tasks = found.id;
      out.tasksTitle = found.title;
    }
  }
  try {
    const db = await notionGet(`/v1/databases/${PROJECTS_DB}`);
    out.projects = PROJECTS_DB;
    out.projectsTitle = titlePropOf(db);
  } catch {
    const found = await discoverDb(/^projects$/i);
    if (found) {
      out.projects = found.id;
      out.projectsTitle = found.title;
    }
  }
  _resolved = out;
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type NotionTask = {
  pageId: string;
  title: string;
  done: boolean;
  due?: string; // yyyy-mm-dd
  time?: string; // "HH:MM" when the Notion date carries a time
  priority?: TaskPriority;
  detail?: string;
  projectId?: string;
  projectName?: string;
  url?: string; // notion.so link for "open in Notion"
  editedAt?: string;
};

export type NotionProject = { id: string; name: string };

const PRIORITY_FROM_NOTION: Record<string, TaskPriority> = { low: "low", medium: "normal", high: "high", urgent: "urgent" };
const PRIORITY_TO_NOTION: Record<TaskPriority, string> = { low: "Low", normal: "Medium", high: "High", urgent: "Urgent" };

export function isNotionTasksConfigured(): boolean {
  return !!process.env.NOTION_TOKEN;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapTask(pg: any, projects: Map<string, string>): NotionTask | null {
  const p = pg?.properties || {};
  const titleProp: any = Object.values(p).find((x: any) => x?.type === "title");
  const title = (titleProp?.title || []).map((t: any) => t.plain_text).join("").trim();
  if (!title) return null;
  const start: string = p.Date?.date?.start || "";
  const rel = (p.Project?.relation || [])[0]?.id as string | undefined;
  return {
    pageId: pg.id as string,
    title,
    done: !!p.Complete?.checkbox,
    due: start ? start.slice(0, 10) : undefined,
    time: /t\d{2}:\d{2}/i.test(start) ? start.slice(11, 16) : undefined,
    priority: PRIORITY_FROM_NOTION[(p.Priority?.select?.name || "").toLowerCase()],
    detail: (p.Description?.rich_text || []).map((t: any) => t.plain_text).join("").trim() || undefined,
    projectId: rel,
    projectName: rel ? projects.get(rel.replace(/-/g, "")) || projects.get(rel) : undefined,
    url: (pg.url as string) || undefined,
    editedAt: (pg.last_edited_time as string) || undefined,
  };
}

export async function fetchNotionProjects(): Promise<NotionProject[]> {
  if (!isNotionTasksConfigured()) return [];
  try {
    const { projects } = await resolveDbs();
    if (!projects) return [];
    const q = await notionPost(`/v1/databases/${projects}/query`, { page_size: 100 });
    return (q.results || [])
      .map((pg: any) => {
        // The title property of the Projects DB regardless of its name.
        const props = pg.properties || {};
        const titleProp: any = Object.values(props).find((x: any) => x?.type === "title");
        const name = (titleProp?.title || []).map((t: any) => t.plain_text).join("").trim();
        return name ? { id: pg.id as string, name } : null;
      })
      .filter(Boolean) as NotionProject[];
  } catch {
    return [];
  }
}

// Open tasks plus anything completed in the last two weeks (so checked-off items
// don't vanish from the Done group mid-week). Newest due first is sorted by the
// board itself.
async function fetchNotionTasksRaw(): Promise<{ tasks: NotionTask[]; projects: NotionProject[]; ok: boolean }> {
  if (!isNotionTasksConfigured()) return { tasks: [], projects: [], ok: false };
  try {
    const { tasks: tasksDb } = await resolveDbs();
    if (!tasksDb) return { tasks: [], projects: [], ok: false };
    const projects = await fetchNotionProjects();
    const pmap = new Map<string, string>();
    for (const pr of projects) {
      pmap.set(pr.id, pr.name);
      pmap.set(pr.id.replace(/-/g, ""), pr.name);
    }
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const q = await notionPost(`/v1/databases/${tasksDb}/query`, {
      filter: {
        or: [
          { property: "Complete", checkbox: { equals: false } },
          { timestamp: "last_edited_time", last_edited_time: { on_or_after: twoWeeksAgo } },
        ],
      },
      page_size: 100,
    });
    const tasks = ((q.results || []) as any[]).map((pg) => mapTask(pg, pmap)).filter(Boolean) as NotionTask[];
    return { tasks, projects, ok: true };
  } catch {
    return { tasks: [], projects: [], ok: false };
  }
}

// Board reads go through a short cache so navigation stays snappy; mutations
// bypass it (the board updates optimistically and reconciles on next load).
export const getNotionTasks = unstable_cache(fetchNotionTasksRaw, ["notion-tasks"], {
  revalidate: 60,
  tags: ["notion-tasks"],
});

function dateValue(due?: string | null, time?: string | null): any {
  if (!due) return { date: null };
  return { date: { start: time ? `${due}T${time}:00` : due } };
}

export type NotionTaskPatch = {
  title?: string;
  done?: boolean;
  due?: string | null; // null clears the date
  time?: string | null;
  priority?: TaskPriority;
  detail?: string;
};

export async function patchNotionTask(pageId: string, patch: NotionTaskPatch, current?: { due?: string; time?: string }): Promise<boolean> {
  if (!isNotionTasksConfigured() || !pageId) return false;
  const properties: Record<string, any> = {};
  if (patch.title !== undefined) {
    const { tasksTitle } = await resolveDbs();
    properties[tasksTitle] = { title: [{ text: { content: patch.title } }] };
  }
  if (patch.done !== undefined) properties.Complete = { checkbox: patch.done };
  if (patch.due !== undefined || patch.time !== undefined) {
    const due = patch.due !== undefined ? patch.due : current?.due ?? null;
    const time = patch.time !== undefined ? patch.time : current?.time ?? null;
    properties.Date = dateValue(due, time);
  }
  if (patch.priority !== undefined) properties.Priority = { select: { name: PRIORITY_TO_NOTION[patch.priority] } };
  if (patch.detail !== undefined) properties.Description = { rich_text: patch.detail ? [{ text: { content: patch.detail } }] : [] };
  if (!Object.keys(properties).length) return true;
  try {
    await notionPatch(`/v1/pages/${pageId}`, { properties });
    return true;
  } catch {
    return false;
  }
}

export async function createNotionTask(input: {
  title: string;
  due?: string;
  time?: string;
  priority?: TaskPriority;
  detail?: string;
  projectId?: string;
}): Promise<{ pageId: string; url?: string } | null> {
  if (!isNotionTasksConfigured() || !input.title.trim()) return null;
  try {
    const { tasks: tasksDb, tasksTitle } = await resolveDbs();
    if (!tasksDb) return null;
    const properties: Record<string, any> = {
      [tasksTitle]: { title: [{ text: { content: input.title.trim() } }] },
      Complete: { checkbox: false },
    };
    if (input.due) properties.Date = dateValue(input.due, input.time);
    if (input.priority) properties.Priority = { select: { name: PRIORITY_TO_NOTION[input.priority] } };
    if (input.detail) properties.Description = { rich_text: [{ text: { content: input.detail } }] };
    if (input.projectId) properties.Project = { relation: [{ id: input.projectId }] };
    const res = await notionPost(`/v1/pages`, { parent: { database_id: tasksDb }, properties });
    return res?.id ? { pageId: res.id as string, url: res.url as string | undefined } : null;
  } catch {
    return null;
  }
}

// Find the Notion project row for a client (by name), creating it when absent —
// so mirrored tasks always land under the right project in "Projects and
// Tasks". Cached per process; best-effort like everything Notion-side.
const _projectIdByName = new Map<string, string>();
export async function findOrCreateNotionProject(name: string): Promise<string | null> {
  const clean = (name || "").trim();
  if (!isNotionTasksConfigured() || !clean) return null;
  const cached = _projectIdByName.get(clean.toLowerCase());
  if (cached) return cached;
  try {
    const { projects, projectsTitle } = await resolveDbs();
    if (!projects) return null;
    const existing = (await fetchNotionProjects()).find((p) => p.name.trim().toLowerCase() === clean.toLowerCase());
    if (existing) {
      _projectIdByName.set(clean.toLowerCase(), existing.id);
      return existing.id;
    }
    const res = await notionPost(`/v1/pages`, {
      parent: { database_id: projects },
      properties: { [projectsTitle]: { title: [{ text: { content: clean } }] } },
    });
    if (res?.id) {
      _projectIdByName.set(clean.toLowerCase(), res.id as string);
      await bustNotionTasksCache();
      return res.id as string;
    }
  } catch {
    /* Notion unreachable — the task just stays local */
  }
  return null;
}

export async function archiveNotionTask(pageId: string): Promise<boolean> {
  if (!isNotionTasksConfigured() || !pageId) return false;
  try {
    await notionPatch(`/v1/pages/${pageId}`, { archived: true });
    return true;
  } catch {
    return false;
  }
}

// Used by actions after a write so the next board load re-reads Notion.
export async function bustNotionTasksCache(): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  try {
    revalidateTag("notion-tasks");
  } catch {
    /* outside a request scope — the 60s TTL will catch it */
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Quick reachability probe for the settings hint: distinguishes "no token" from
// "token set but the Tasks DB isn't shared with the integration".
export async function notionTasksStatus(): Promise<"off" | "unshared" | "ok"> {
  if (!isNotionTasksConfigured()) return "off";
  const { tasks } = await resolveDbs();
  return tasks ? "ok" : "unshared";
}
