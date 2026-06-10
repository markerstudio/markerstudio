"use server";

// Admin document actions — saving, sending and resetting the paged proposal /
// agreement documents from the builders. Return values (not redirects) so the
// builder UIs can show inline save states.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { resolveOrCreateClientByName, type ClientData } from "@/lib/clients";
import type { AgreementDoc, ProposalDoc } from "@/lib/docs";

type Result = { ok: boolean; error?: string };

async function requireAdmin(): Promise<boolean> {
  const s = await getSession();
  return !!s && s.role === "admin";
}

async function loadClient(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as {
    id: number;
    slug: string;
    data: ClientData;
  }[];
  return rows[0];
}

async function saveData(id: number, data: ClientData) {
  await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${id}`;
}

function revalidateDocs(slug: string) {
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/proposal`);
  revalidatePath(`/portal/${slug}/agreement`);
  revalidatePath("/admin/proposals");
  revalidatePath("/admin/agreements");
}

export async function saveProposalDoc(slug: string, docJson: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  let doc: ProposalDoc;
  try {
    doc = JSON.parse(docJson);
    if (doc?.v !== 1) throw new Error("bad doc");
  } catch {
    return { ok: false, error: "Couldn't parse the document." };
  }
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  data.proposal = { published: false, ...data.proposal, doc };
  try {
    await saveData(c.id, data);
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
  revalidateDocs(slug);
  return { ok: true };
}

export async function saveAgreementDoc(slug: string, docJson: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  let doc: AgreementDoc;
  try {
    doc = JSON.parse(docJson);
    if (doc?.v !== 1) throw new Error("bad doc");
  } catch {
    return { ok: false, error: "Couldn't parse the document." };
  }
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  data.agreement = { published: false, ...data.agreement, doc };
  try {
    await saveData(c.id, data);
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
  revalidateDocs(slug);
  return { ok: true };
}

// Send / unsend from the builders (inline, no redirect).
export async function setProposalSent(slug: string, send: boolean): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  data.proposal = {
    ...data.proposal,
    published: send,
    archived: send ? false : data.proposal?.archived,
    sentAt: send ? data.proposal?.sentAt || new Date().toISOString() : data.proposal?.sentAt,
  };
  await saveData(c.id, data);
  revalidateDocs(slug);
  return { ok: true };
}

export async function setAgreementSent(slug: string, send: boolean): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  data.agreement = {
    ...data.agreement,
    published: send,
    archived: send ? false : data.agreement?.archived,
    sentAt: send ? data.agreement?.sentAt || new Date().toISOString() : data.agreement?.sentAt,
  };
  await saveData(c.id, data);
  revalidateDocs(slug);
  return { ok: true };
}

// Clear a recorded acceptance / signature so the document can be revised and
// re-sent (e.g. after agreeing changes with the client).
export async function resetProposalAcceptance(slug: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  if (data.proposal) {
    delete data.proposal.acceptedAt;
    delete data.proposal.acceptedBy;
    delete data.proposal.acceptedTitle;
    delete data.proposal.acceptedNotes;
    delete data.proposal.selection;
  }
  await saveData(c.id, data);
  revalidateDocs(slug);
  return { ok: true };
}

export async function resetAgreementSignature(slug: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Not signed in." };
  const c = await loadClient(slug);
  if (!c) return { ok: false, error: "Client not found." };
  const data = (c.data || {}) as ClientData;
  if (data.agreement) {
    delete data.agreement.acceptedAt;
    delete data.agreement.signedName;
  }
  await saveData(c.id, data);
  revalidateDocs(slug);
  return { ok: true };
}

// Start an agreement from the Agreements tab (mirrors createProposalFromTab).
export async function createAgreementFromTab(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim();

  let targetSlug = "";
  if (slug && slug !== "__new") {
    targetSlug = slug;
  } else if (clientName) {
    const c = await resolveOrCreateClientByName(clientName);
    if (c) targetSlug = c.slug;
  }
  if (!targetSlug) redirect("/admin/agreements?error=client");

  const c = await loadClient(targetSlug);
  if (!c) redirect("/admin/agreements?error=client");
  const data = (c.data || {}) as ClientData;
  data.agreement = { published: false, ...data.agreement, archived: false };
  await saveData(c.id, data);
  revalidatePath("/admin/agreements");
  redirect(`/admin/agreements/${targetSlug}`);
}

// Archive / restore an agreement (also unsends while archived).
export async function setAgreementArchived(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const archived = String(formData.get("archived") || "") === "1";
  const c = await loadClient(slug);
  if (!c) redirect("/admin/agreements");
  const data = (c.data || {}) as ClientData;
  data.agreement = { ...data.agreement, archived, ...(archived ? { published: false } : {}) };
  await saveData(c.id, data);
  revalidateDocs(slug);
  redirect(`/admin/agreements${archived ? "" : "?archived=1"}`);
}

export async function deleteAgreement(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const c = await loadClient(slug);
  if (!c) redirect("/admin/agreements");
  const data = (c.data || {}) as ClientData;
  delete data.agreement;
  await saveData(c.id, data);
  revalidateDocs(slug);
  redirect("/admin/agreements?ok=deleted");
}
