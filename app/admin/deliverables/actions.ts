"use server";

import { revalidatePath } from "next/cache";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import {
  updateDeliverablesBlock,
  saveDeliverablesBlock,
  type ClientDeliverables,
  type Deliverable,
  type DeliverableStatus,
  type TaskPriority,
} from "@/lib/clients";
import { updateStudioDeliverables, STUDIO_SLUG } from "@/lib/studio";
import { genId } from "@/lib/deliverables";
import {
  patchNotionTask,
  createNotionTask,
  archiveNotionTask,
  bustNotionTasksCache,
} from "@/lib/notionTasks";

// Sentinel slug for tasks that live in the Notion Tasks database rather than in
// the app's own store. For those, `id` is the Notion page id.
const NOTION_SLUG = "__notion__";

const STATES: DeliverableStatus[] = ["todo", "doing", "review", "done"];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

type Result = { ok: boolean; error?: string };

async function guard(): Promise<Result | null> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!canSeeDeliverables(user)) return { ok: false, error: "No access." };
  return null;
}

// Everywhere a task's state is shown: the board, the dashboard widget, the
// client's portal progress view, and the admin client editor.
function revalidateTask(slug: string) {
  revalidatePath("/admin/deliverables");
  revalidatePath("/admin");
  if (slug && slug !== STUDIO_SLUG && slug !== NOTION_SLUG) {
    revalidatePath(`/portal/${slug}`);
    revalidatePath(`/admin/clients/${slug}/edit`);
  }
}

// Mutate the right store: the studio (no-client) list or a client's block.
async function mutateItems(slug: string, mutate: (items: Deliverable[]) => void): Promise<boolean> {
  if (slug === STUDIO_SLUG) return updateStudioDeliverables(mutate);
  return updateDeliverablesBlock(slug, (block) => {
    block.active = block.active ?? true;
    block.items = block.items ?? [];
    mutate(block.items);
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type TaskPatch = {
  title?: string;
  detail?: string;
  note?: string;
  due?: string | null; // null clears
  time?: string | null;
  status?: DeliverableStatus;
  priority?: TaskPriority;
  order?: number;
};

function cleanPatch(patch: TaskPatch): TaskPatch | null {
  const p: TaskPatch = {};
  if (patch.title !== undefined) {
    const t = String(patch.title).trim();
    if (!t) return null;
    p.title = t.slice(0, 300);
  }
  if (patch.detail !== undefined) p.detail = String(patch.detail).trim().slice(0, 2000);
  if (patch.note !== undefined) p.note = String(patch.note).trim().slice(0, 4000);
  if (patch.due !== undefined) {
    if (patch.due === null || patch.due === "") p.due = null;
    else if (DATE_RE.test(patch.due)) p.due = patch.due;
    else return null;
  }
  if (patch.time !== undefined) {
    if (patch.time === null || patch.time === "") p.time = null;
    else if (TIME_RE.test(patch.time)) p.time = patch.time;
    else return null;
  }
  if (patch.status !== undefined) {
    if (!STATES.includes(patch.status)) return null;
    p.status = patch.status;
  }
  if (patch.priority !== undefined) {
    if (!PRIORITIES.includes(patch.priority)) return null;
    p.priority = patch.priority;
  }
  if (patch.order !== undefined && Number.isFinite(patch.order)) p.order = patch.order;
  return p;
}

function applyPatch(item: Deliverable, p: TaskPatch) {
  if (p.title !== undefined) item.title = p.title;
  if (p.detail !== undefined) item.detail = p.detail || undefined;
  if (p.note !== undefined) item.note = p.note || undefined;
  if (p.due !== undefined) item.due = p.due ?? undefined;
  if (p.time !== undefined) item.time = p.time ?? undefined;
  if (p.priority !== undefined) item.priority = p.priority;
  if (p.order !== undefined) item.order = p.order;
  if (p.status !== undefined) {
    const was = item.status;
    item.status = p.status;
    if (p.status === "done" && was !== "done") item.completedAt = new Date().toISOString();
    if (p.status !== "done") item.completedAt = undefined;
  }
}

// ---- The board API ---------------------------------------------------------

export async function patchTask(slug: string, id: string, patch: TaskPatch): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!slug || !id) return { ok: false, error: "Missing task." };
  const p = cleanPatch(patch);
  if (!p) return { ok: false, error: "Invalid change." };

  if (slug === NOTION_SLUG) {
    const ok = await patchNotionTask(id, {
      title: p.title,
      detail: p.detail,
      due: p.due,
      time: p.time,
      priority: p.priority,
      done: p.status === undefined ? undefined : p.status === "done",
    });
    if (ok) await bustNotionTasksCache();
    return ok ? { ok: true } : { ok: false, error: "Notion didn’t accept the change." };
  }

  let found = false;
  const ok = await mutateItems(slug, (items) => {
    const item = items.find((x) => x.id === id);
    if (item) {
      applyPatch(item, p);
      found = true;
    }
  });
  if (!ok) return { ok: false, error: "Save failed — no database." };
  if (!found) return { ok: false, error: "Task not found — refresh the board." };
  revalidateTask(slug);
  return { ok: true };
}

export type CreateTaskInput = {
  slug: string; // client slug, STUDIO_SLUG, or "__notion__"
  title: string;
  due?: string;
  time?: string;
  priority?: TaskPriority;
  detail?: string;
  kind?: "milestone" | "recurring";
  notionProjectId?: string; // when slug === "__notion__"
};

export async function createTask(input: CreateTaskInput): Promise<Result & { item?: Deliverable; notionUrl?: string }> {
  const denied = await guard();
  if (denied) return denied;
  const title = String(input.title || "").trim().slice(0, 300);
  if (!title) return { ok: false, error: "Write the task first." };
  const due = input.due && DATE_RE.test(input.due) ? input.due : undefined;
  const time = input.time && TIME_RE.test(input.time) ? input.time : undefined;
  const priority = input.priority && PRIORITIES.includes(input.priority) ? input.priority : undefined;

  if (input.slug === NOTION_SLUG) {
    const created = await createNotionTask({
      title,
      due,
      time,
      priority,
      detail: input.detail?.trim() || undefined,
      projectId: input.notionProjectId,
    });
    if (!created) return { ok: false, error: "Couldn’t reach Notion — task not added." };
    await bustNotionTasksCache();
    const item: Deliverable = {
      id: created.pageId,
      title,
      due,
      time,
      priority,
      status: "todo",
      source: "manual",
      createdAt: new Date().toISOString(),
      notionPageId: created.pageId,
    };
    return { ok: true, item, notionUrl: created.url };
  }

  const slug = input.slug || STUDIO_SLUG;
  const item: Deliverable = {
    id: genId(),
    title,
    due,
    time,
    priority,
    detail: input.detail?.trim() || undefined,
    status: "todo",
    kind: input.kind === "recurring" ? "recurring" : "milestone",
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  const ok = await mutateItems(slug, (items) => {
    items.push(item);
  });
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateTask(slug);
  return { ok: true, item };
}

export async function deleteTask(slug: string, id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!slug || !id) return { ok: false, error: "Missing task." };
  if (slug === NOTION_SLUG) {
    const ok = await archiveNotionTask(id);
    if (ok) await bustNotionTasksCache();
    return ok ? { ok: true } : { ok: false, error: "Couldn’t archive in Notion." };
  }
  const ok = await mutateItems(slug, (items) => {
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) items.splice(i, 1);
  });
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateTask(slug);
  return { ok: true };
}

// Undo for a just-deleted task — restores the full item as it was.
export async function restoreTask(slug: string, item: Deliverable): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!slug || !item?.title) return { ok: false, error: "Nothing to restore." };
  if (slug === NOTION_SLUG) {
    // Un-archive the original page so relations/history survive the undo.
    try {
      const { notionPatch } = await import("@/lib/notion");
      await notionPatch(`/v1/pages/${item.id}`, { archived: false });
      await bustNotionTasksCache();
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn’t restore in Notion." };
    }
  }
  const ok = await mutateItems(slug, (items) => {
    if (!items.some((x) => x.id === item.id)) items.push(item);
  });
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateTask(slug);
  return { ok: true };
}

// Drag-reorder (optionally with a due-date change when dropped into another
// date group). Notion rows have no order column — their order/due changes are
// applied as date patches only.
export async function reorderTasks(
  entries: { slug: string; id: string; order: number; due?: string | null }[]
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const list = (entries || []).slice(0, 200);
  const bySlug = new Map<string, { id: string; order: number; due?: string | null }[]>();
  for (const e of list) {
    if (!e?.slug || !e?.id || !Number.isFinite(e.order)) continue;
    if (e.due !== undefined && e.due !== null && !DATE_RE.test(e.due)) continue;
    const arr = bySlug.get(e.slug) || [];
    arr.push({ id: e.id, order: e.order, due: e.due });
    bySlug.set(e.slug, arr);
  }
  for (const [slug, arr] of Array.from(bySlug.entries())) {
    if (slug === NOTION_SLUG) {
      for (const e of arr) {
        if (e.due !== undefined) await patchNotionTask(e.id, { due: e.due });
      }
      await bustNotionTasksCache();
      continue;
    }
    await mutateItems(slug, (items) => {
      for (const e of arr) {
        const item = items.find((x) => x.id === e.id);
        if (!item) continue;
        item.order = e.order;
        if (e.due !== undefined) item.due = e.due ?? undefined;
      }
    });
    revalidateTask(slug);
  }
  return { ok: true };
}

// Sweep every delivered/completed task off the board (all clients + studio).
// Notion completes are left in Notion — they disappear from the board's pull
// window on their own and remain Notion's history.
export async function clearDoneTasks(): Promise<Result & { cleared?: number }> {
  const denied = await guard();
  if (denied) return denied;
  const { getClients } = await import("@/lib/clients");
  let cleared = 0;
  const clients = await getClients();
  for (const c of clients) {
    const items = c.data.deliverables?.items ?? [];
    const keep = items.filter((x) => x.status !== "done");
    if (keep.length !== items.length) {
      cleared += items.length - keep.length;
      await mutateItems(c.slug, (arr) => {
        arr.splice(0, arr.length, ...keep);
      });
      revalidateTask(c.slug);
    }
  }
  await updateStudioDeliverables((items) => {
    const keep = items.filter((x) => x.status !== "done");
    cleared += items.length - keep.length;
    items.splice(0, items.length, ...keep);
  });
  revalidateTask(STUDIO_SLUG);
  return { ok: true, cleared };
}

// Approve a client-requested task — it becomes a normal tracked deliverable.
export async function approveRequest(slug: string, id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!slug || slug === STUDIO_SLUG || slug === NOTION_SLUG || !id) return { ok: false, error: "Missing request." };
  const ok = await updateDeliverablesBlock(slug, (block) => {
    const item = (block.items ?? []).find((x) => x.id === id);
    if (item) item.pending = false;
  });
  if (!ok) return { ok: false, error: "Save failed." };
  revalidateTask(slug);
  return { ok: true };
}

// Reject a client request — removed silently (the client just sees it disappear).
export async function rejectRequest(slug: string, id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!slug || slug === STUDIO_SLUG || slug === NOTION_SLUG || !id) return { ok: false, error: "Missing request." };
  const ok = await updateDeliverablesBlock(slug, (block) => {
    block.items = (block.items ?? []).filter((x) => x.id !== id);
  });
  if (!ok) return { ok: false, error: "Save failed." };
  revalidateTask(slug);
  return { ok: true };
}

// Save the whole deliverables block for a client (from the editor tab). Generation
// happens client-side (lib/deliverables is pure), so this just persists the result.
export async function saveDeliverablesSection(slug: string, block: ClientDeliverables): Promise<Result> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const ok = await saveDeliverablesBlock(slug, block);
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateTask(slug);
  return { ok: true };
}
