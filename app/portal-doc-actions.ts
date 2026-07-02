"use server";

// Client-side document actions — accepting a proposal (with the selected
// plans) and e-signing an agreement from the paged document views. These are
// called from client components, so they return instead of redirecting.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { ClientData } from "@/lib/clients";
import { agreementDocFromProposal, type ProposalSelection } from "@/lib/docs";

async function loadClient(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, name, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as {
    id: number;
    slug: string;
    name: string;
    data: ClientData;
  }[];
  return rows[0];
}

function parseSelection(raw: FormDataEntryValue | null): ProposalSelection | undefined {
  try {
    const s = JSON.parse(String(raw || ""));
    if (!s || !Array.isArray(s.items)) return undefined;
    return {
      items: s.items
        .map((i: { label?: unknown; price?: unknown; period?: unknown }) => ({
          label: String(i?.label || ""),
          price: Number(i?.price) || 0,
          period: i?.period === "mo" ? ("mo" as const) : ("once" as const),
        }))
        .filter((i: { label: string }) => i.label),
      monthly: Number(s.monthly) || 0,
      once: Number(s.once) || 0,
      currency: String(s.currency || "₪"),
    };
  } catch {
    return undefined;
  }
}

export async function acceptProposalDoc(fd: FormData): Promise<void> {
  const s = await getSession();
  if (!s) return;
  const slug = String(fd.get("slug") || "").trim();
  const c = await loadClient(slug);
  if (!c) return;
  if (s.role === "client" && s.clientId !== c.id) return;

  const data = (c.data || {}) as ClientData;
  if (s.role === "client" && !data.proposal?.published) return; // not sent yet

  const acceptedBy = String(fd.get("name") || "").trim();
  data.proposal = {
    ...data.proposal,
    acceptedAt: new Date().toISOString(),
    acceptedBy,
    acceptedTitle: String(fd.get("title") || "").trim(),
    acceptedNotes: String(fd.get("notes") || "").trim(),
    selection: parseSelection(fd.get("selection")),
  };
  data.updates = [
    { at: new Date().toISOString(), kind: "doc" as const, title: { en: "Proposal accepted", ar: "تم قبول العرض" }, body: acceptedBy ? { en: `by ${acceptedBy}`, ar: `بواسطة ${acceptedBy}` } : undefined },
    ...(data.updates ?? []),
  ].slice(0, 50);

  // Draft the agreement from the confirmed selection right away — it stays a
  // draft (unpublished, invisible to the client) until the studio reviews it
  // and hits "Send for signature". Never overwrite a doc the studio already
  // drafted or an agreement that is out for / past signature.
  if (!data.agreement?.doc && !data.agreement?.published && !data.agreement?.acceptedAt) {
    const agreementDoc = agreementDocFromProposal(c.name || c.slug, data);
    if (agreementDoc) {
      const value = agreementDoc.summary.rows.find((r) => r.label.en === "Agreement value")?.value.en;
      data.agreement = { ...data.agreement, doc: agreementDoc, ...(value ? { value } : {}) };
    }
  }

  await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/proposal`);
  revalidatePath("/admin/proposals");
  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/agreements/${slug}`);
}

export async function signAgreementDoc(fd: FormData): Promise<void> {
  const s = await getSession();
  if (!s) return;
  const slug = String(fd.get("slug") || "").trim();
  const signedName = String(fd.get("signedName") || "").trim();
  const agreed = String(fd.get("agree") || "") === "on";
  if (!agreed || signedName.length < 2) return;

  const c = await loadClient(slug);
  if (!c) return;
  if (s.role === "client" && s.clientId !== c.id) return;

  const data = (c.data || {}) as ClientData;
  if (s.role === "client" && !data.agreement?.published) return;

  data.agreement = { ...data.agreement, acceptedAt: new Date().toISOString(), signedName };
  data.updates = [
    { at: new Date().toISOString(), kind: "doc" as const, title: { en: "Agreement signed", ar: "تم توقيع الاتفاقية" }, body: { en: signedName, ar: signedName } },
    ...(data.updates ?? []),
  ].slice(0, 50);
  if (data.status === "pending") data.status = "active";
  await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/agreement`);
  revalidatePath("/admin/agreements");
}
