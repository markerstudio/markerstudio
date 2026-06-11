"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { createInvoice, getInvoice, setInvoicePaid, setInvoiceStatus, deleteInvoice, setInvoiceArchived, type InvoiceItem, type InvoiceStatus } from "@/lib/invoices";
import { resolveOrCreateClientByName, type ClientData } from "@/lib/clients";
import { snapshotForUndo, withParam } from "@/lib/undo";

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

// New invoice straight from the Invoices tab. The client comes from the
// dropdown (slug) or a free-typed name — an unknown name gets a minimal
// portal created on the spot.
export async function createInvoiceFromTab(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  const items = parseItems(formData.get("items"));
  const addVat = String(formData.get("addVat") || "") === "on";
  const vatRate = addVat ? parseFloat(String(formData.get("vatRate") || "16")) || 16 : 0;
  const paidAmount = parseFloat(String(formData.get("paidAmount") || "0")) || 0;

  if (items.length === 0) redirect("/admin/invoices?error=empty");

  let target: { id: number; slug: string } | null = null;
  if (slug && slug !== "__new") {
    const c = await clientBySlug(slug);
    if (c) target = { id: c.id, slug: c.slug };
  } else if (clientName) {
    target = await resolveOrCreateClientByName(clientName);
  }
  if (!target) redirect("/admin/invoices?error=client");

  const { number } = await createInvoice({
    clientId: target.id,
    clientSlug: target.slug,
    items,
    note,
    dueDate: dueDate || undefined,
    source: "custom",
    vatRate,
    paidAmount,
  });
  revalidatePath(`/portal/${target.slug}`);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?ok=${encodeURIComponent(number)}`);
}

export async function setInvoiceStatusAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const back = String(formData.get("back") || "").trim();
  const status = String(formData.get("status") || "draft") as InvoiceStatus;
  await setInvoiceStatus(id, status);
  revalidatePath(`/portal/${slug}`);
  revalidatePath("/admin/invoices");
  redirect(back || `/admin/clients/${slug}/edit?ok=invoice-updated`);
}

// Archive / restore from the Invoices tab (kept for records, hidden by default).
export async function setInvoiceArchivedAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const archived = String(formData.get("archived") || "") === "1";
  await setInvoiceArchived(id, archived);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices${archived ? "" : "?archived=1"}`);
}

// Record a payment against an invoice — adds to what's already been paid and
// re-derives the status (due → partial → paid).
export async function recordPaymentAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const back = String(formData.get("back") || "").trim();
  const amount = parseFloat(String(formData.get("amount") || "0")) || 0;
  const inv = await getInvoice(id);
  if (inv && amount > 0) {
    await setInvoicePaid(id, (Number(inv.paid_amount) || 0) + amount);
    revalidatePath(`/portal/${slug}`);
    revalidatePath("/admin/invoices");
    revalidatePath("/admin");
  }
  redirect(back || "/admin/invoices");
}

// Duplicate an invoice as a fresh draft (new number, today's date, nothing paid).
// Handy for the monthly billing cycle.
export async function duplicateInvoiceAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const inv = await getInvoice(id);
  if (!inv) redirect("/admin/invoices");
  const { number } = await createInvoice({
    clientId: inv.client_id,
    clientSlug: inv.client_slug,
    items: inv.items,
    note: inv.note || undefined,
    source: "custom",
    vatRate: Number(inv.vat_rate) || 0,
    status: "draft",
  });
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?ok=${encodeURIComponent(number)}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const back = String(formData.get("back") || "").trim() || `/admin/clients/${slug}/edit`;
  const inv = await getInvoice(id);
  if (!inv) redirect(back);
  const undoId = await snapshotForUndo("invoice", `invoice ${inv.number}`, { invoice: inv });
  await deleteInvoice(id);
  revalidatePath(`/portal/${slug}`);
  revalidatePath("/admin/invoices");
  redirect(withParam(back, "undo", String(undoId)));
}
