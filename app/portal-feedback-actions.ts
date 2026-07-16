"use server";

// Client-facing feedback actions — approving (or asking for changes on) a
// planned social post, and leaving a comment on it. Called from the portal's
// calendar by both the client and the studio, so they return instead of
// redirecting and guard on session + ownership the same way the document
// actions do.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { updateDeliverablesBlock } from "@/lib/clients";
import { notifyClientDevices } from "@/lib/clientNotify";
import { genId } from "@/lib/deliverables";
import type { ActivityItem, ClientData, SocialPost } from "@/lib/clients";

type Result = { ok: boolean; error?: string };

async function loadClient(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as {
    id: number;
    slug: string;
    data: ClientData;
  }[];
  return rows[0];
}

// Newest-first cap so the feed never grows unbounded.
function pushUpdate(data: ClientData, item: ActivityItem) {
  data.updates = [item, ...(data.updates ?? [])].slice(0, 50);
}

// Studio → client: mark a planned post as awaiting the client's sign-off,
// log it on the portal's activity feed, and nudge the client's devices.
// Triggered from the admin calendar's day drawer ("Ask client to approve").
export async function requestPostApproval(slug: string, index: number): Promise<Result> {
  const s = await getSession();
  if (!s || s.role === "client") return { ok: false, error: "unauthorized" };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "not found" };

  const data = (c.data || {}) as ClientData;
  const post = data.social?.posts?.[index];
  if (!post) return { ok: false, error: "no post" };
  post.approval = "pending";
  const label = post.title || post.platform || "a planned post";
  pushUpdate(data, {
    at: new Date().toISOString(),
    kind: "approval",
    title: { en: "A post is waiting for your approval", ar: "منشور بانتظار موافقتك" },
    body: { en: label, ar: label },
  });

  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
  } catch {
    return { ok: false, error: "db" };
  }
  await notifyClientDevices(c.id, {
    title: "Marker Studio — approval needed",
    body: `“${label}” is waiting for your review.`,
    url: `/portal/${slug}`,
    tag: `approve-${slug}-${index}`,
  });
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}

export async function setPostApproval(slug: string, index: number, approval: SocialPost["approval"]): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "unauthorized" };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "not found" };
  if (s.role === "client" && s.clientId !== c.id) return { ok: false, error: "forbidden" };

  const data = (c.data || {}) as ClientData;
  const post = data.social?.posts?.[index];
  if (!post) return { ok: false, error: "no post" };
  post.approval = approval;

  const who = s.role === "client" ? "client" : "studio";
  const label = post.title || post.platform || "post";
  pushUpdate(data, {
    at: new Date().toISOString(),
    kind: "approval",
    title:
      approval === "approved"
        ? { en: `${s.name} approved a post`, ar: `${s.name} وافق على منشور` }
        : { en: `${s.name} requested changes`, ar: `${s.name} طلب تعديلات` },
    body: { en: label, ar: label },
  });
  // mark the author role on the post-level so the UI can attribute it
  void who;

  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}

// A client (or the studio) submits a task request from the portal. It lands on the
// client's deliverables block as a pending item until an admin approves it. Writes
// only the deliverables subtree (jsonb_set) so it can't clobber other edits.
export async function requestDeliverable(slug: string, input: { title: string; due?: string; detail?: string }): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "unauthorized" };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "not found" };
  if (s.role === "client" && s.clientId !== c.id) return { ok: false, error: "forbidden" };
  const data = (c.data || {}) as ClientData;
  if (!data.deliverables?.allowClientRequests) return { ok: false, error: "requests off" };
  const title = (input.title || "").trim();
  if (!title) return { ok: false, error: "empty" };
  const due = (input.due || "").trim();
  const detail = (input.detail || "").trim();
  const ok = await updateDeliverablesBlock(slug, (block) => {
    block.active = block.active ?? true;
    block.items = [
      ...(block.items ?? []),
      { id: genId(), title, due: due || undefined, detail: detail || undefined, status: "todo", kind: "milestone", source: "client", requestedByClient: true, pending: true },
    ];
  });
  if (!ok) return { ok: false, error: "db" };
  revalidatePath(`/portal/${slug}`);
  revalidatePath("/admin/deliverables");
  revalidatePath(`/admin/clients/${slug}/edit`);
  return { ok: true };
}

export async function addPostComment(slug: string, index: number, text: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "unauthorized" };
  const body = text.trim();
  if (!body) return { ok: false, error: "empty" };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "not found" };
  if (s.role === "client" && s.clientId !== c.id) return { ok: false, error: "forbidden" };

  const data = (c.data || {}) as ClientData;
  const post = data.social?.posts?.[index];
  if (!post) return { ok: false, error: "no post" };
  const role = s.role === "client" ? "client" : "studio";
  post.comments = [...(post.comments ?? []), { by: s.name || (role === "client" ? "Client" : "Studio"), role, text: body, at: new Date().toISOString() }];

  const label = post.title || post.platform || "post";
  pushUpdate(data, {
    at: new Date().toISOString(),
    kind: "post",
    title: { en: `${s.name} commented`, ar: `${s.name} علّق` },
    body: { en: `${label}: ${body}`, ar: `${label}: ${body}` },
  });

  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}
