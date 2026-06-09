"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { createInvoice, setInvoiceStatus, deleteInvoice, type InvoiceItem, type InvoiceStatus } from "@/lib/invoices";
import type { ClientData } from "@/lib/clients";

async function clientBySlug(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; slug: string; data: ClientData }[];
  return rows[0];
}

function parseItems(raw: FormDataEntryValue | null): InvoiceItem[] {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(String(raw || "[]"));
  } catch {
    parsed = [];
  }
  return (Array.isArray(parsed) ? parsed : [])
    .map((i) => ({ label: String((i as { label?: unknown })?.label || "").trim(), amount: String((i as { amount?: unknown })?.amount || "").trim() }))
    .filter((i) => i.label || i.amount);
}

// Custom invoice built from line items (seeded from the priced quote).
export async function createInvoiceAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  const items = parseItems(formData.get("items"));
  const addVat = String(formData.get("addVat") || "") === "on";
  const vatRate = addVat ? parseFloat(String(formData.get("vatRate") || "16")) || 16 : 0;
  const paidAmount = parseFloat(String(formData.get("paidAmount") || "0")) || 0;

  const c = await clientBySlug(slug);
  if (!c) redirect("/admin/clients");
  if (items.length === 0) redirect(`/admin/clients/${slug}/edit?error=invoice-empty`);

  await createInvoice({ clientId: c.id, clientSlug: c.slug, items, note, dueDate: dueDate || undefined, source: "custom", vatRate, paidAmount });
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invoice-created`);
}

// Draft a monthly invoice from the Notion-synced plan (fee + cycle).
export async function createInvoiceFromNotion(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const c = await clientBySlug(slug);
  if (!c) redirect("/admin/clients");

  const fee = c.data.finance?.monthlyFee || "";
  if (!fee) redirect(`/admin/clients/${slug}/edit?error=no-fee`);
  const plan = c.data.plan;
  const cycle = plan?.start || plan?.end ? ` (${plan?.start || ""}${plan?.end ? ` → ${plan.end}` : ""})` : "";
  const label = `Monthly — ${plan?.name || "Social media management"}${cycle}`;

  await createInvoice({ clientId: c.id, clientSlug: c.slug, items: [{ label, amount: fee }], note: plan?.note?.en || "", source: "notion" });
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invoice-created`);
}

export async function setInvoiceStatusAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const status = String(formData.get("status") || "draft") as InvoiceStatus;
  await setInvoiceStatus(id, status);
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invoice-updated`);
}

export async function deleteInvoiceAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  await deleteInvoice(id);
  revalidatePath(`/portal/${slug}`);
  redirect(`/admin/clients/${slug}/edit?ok=invoice-deleted`);
}
