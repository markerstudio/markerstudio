"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  createInvoice, getInvoice, updateInvoice, setInvoicePaid, setInvoiceStatus, deleteInvoice, setInvoiceArchived,
  invoiceCurrency, invoiceTotal, lineAmount, isRamziLine, inferKind, notionNameForKind,
  type InvoiceItem, type InvoiceStatus, type LineKind,
} from "@/lib/invoices";
import { resolveOrCreateClientByName, type ClientData } from "@/lib/clients";
import { recordInvoicePayment, deletePayment, getPayment, type PaymentMethod, type AllocationLine } from "@/lib/payments";
import { createIncomePaymentLines } from "@/lib/notion";
import { snapshotForUndo, withParam } from "@/lib/undo";

async function clientBySlug(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; slug: string; data: ClientData }[];
  return rows[0];
}

// Mirror an admin-recorded payment into the client's Notion Income database so
// the books stay in sync both ways. Best-effort — only runs when the client is
// linked to a Notion page, and a Notion failure never blocks the local record.
async function syncPaymentToNotion(
  slug: string,
  amount: number,
  items: InvoiceItem[],
  label: string,
  dueDate?: string | null,
  allocation?: AllocationLine[]
) {
  if (!(amount > 0)) return;
  try {
    const c = await clientBySlug(slug);
    const pageId = c?.data?.notionPageId;
    if (!pageId) return;
    const currency = invoiceCurrency(items);

    // One Notion row per Marker line, named by category so the budget formula
    // classifies it. Ramzi/stories lines are pass-through — collected for Ramzi,
    // never written to Marker's books — so they're dropped here.
    let lines: { name: string; amount: number }[];
    if (allocation && allocation.length) {
      // Use exactly how the admin split this payment across the lines.
      lines = allocation
        .filter((a) => !(a.owner === "ramzi" || a.kind === "stories"))
        .map((a) => ({
          name: notionNameForKind((a.kind as LineKind) || inferKind({ label: a.label, amount: String(a.amount) })),
          amount: Math.round(a.amount),
        }))
        .filter((l) => l.amount > 0);
    } else {
      // No explicit split — apportion the payment across lines by invoice share.
      const clientTotal = invoiceTotal(items);
      lines = (items || [])
        .filter((it) => !isRamziLine(it))
        .map((it) => {
          const share = clientTotal > 0 ? lineAmount(it.amount) / clientTotal : 0;
          return { name: notionNameForKind(inferKind(it)), amount: Math.round(amount * share) };
        })
        .filter((l) => l.amount > 0);
    }

    // Fall back to a single row when there are no usable line amounts.
    const payload = lines.length ? lines : [{ name: label, amount: Math.round(amount) }];
    await createIncomePaymentLines({ clientPageId: pageId, lines: payload, currency, dueDate: dueDate || undefined });
  } catch {
    /* never block the local record on a Notion write */
  }
}

// Read the optional per-line allocation a payment form may post (a JSON array
// of { label, kind, owner, amount }). Returns [] when absent or unparseable.
function parseAllocation(raw: FormDataEntryValue | null): AllocationLine[] {
  try {
    const arr = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((a) => ({
        label: String((a as AllocationLine)?.label || ""),
        kind: (a as AllocationLine)?.kind ? String((a as AllocationLine).kind) : undefined,
        owner: (a as AllocationLine)?.owner ? String((a as AllocationLine).owner) : undefined,
        amount: Number((a as AllocationLine)?.amount) || 0,
      }))
      .filter((a) => a.amount > 0);
  } catch {
    return [];
  }
}

function parseItems(raw: FormDataEntryValue | null): InvoiceItem[] {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(String(raw || "[]"));
  } catch {
    parsed = [];
  }
  const KINDS = ["branding", "plan", "stories", "extra"];
  const OWNERS = ["marker", "ramzi"];
  return (Array.isArray(parsed) ? parsed : [])
    .map((i) => {
      const o = i as { label?: unknown; amount?: unknown; kind?: unknown; owner?: unknown };
      const item: InvoiceItem = {
        label: String(o?.label || "").trim(),
        amount: String(o?.amount || "").trim(),
      };
      // Preserve the line's category/owner when the form sends them; a stories
      // line is always Ramzi's pass-through.
      if (typeof o?.kind === "string" && KINDS.includes(o.kind)) item.kind = o.kind as InvoiceItem["kind"];
      if (typeof o?.owner === "string" && OWNERS.includes(o.owner)) item.owner = o.owner as InvoiceItem["owner"];
      if (item.kind === "stories") item.owner = "ramzi";
      return item;
    })
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

  const { number } = await createInvoice({ clientId: c.id, clientSlug: c.slug, items, note, dueDate: dueDate || undefined, source: "custom", vatRate, paidAmount });
  await syncPaymentToNotion(slug, paidAmount, items, `${number} deposit`, dueDate || undefined);
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
  await syncPaymentToNotion(target.slug, paidAmount, items, `${number} deposit`, dueDate || undefined);
  revalidatePath(`/portal/${target.slug}`);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?ok=${encodeURIComponent(number)}`);
}

// Edit an existing invoice's lines / VAT / due date / note from the edit page.
export async function updateInvoiceAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const back = String(formData.get("back") || "").trim();
  const inv = await getInvoice(id);
  if (!inv) redirect("/admin/invoices");
  const items = parseItems(formData.get("items"));
  if (items.length === 0) redirect(`/admin/invoices/${id}/edit?error=empty`);
  const addVat = String(formData.get("addVat") || "") === "on";
  const vatRate = addVat ? parseFloat(String(formData.get("vatRate") || "16")) || 16 : 0;
  const note = String(formData.get("note") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  await updateInvoice(id, { items, note, dueDate: dueDate || null, vatRate });
  revalidatePath(`/portal/${inv.client_slug}`);
  revalidatePath("/admin/invoices");
  redirect(back || "/admin/invoices");
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

// Record a payment against an invoice — logs a numbered receipt voucher, adds
// to what's already been paid and re-derives the status (due → partial → paid).
// On success it redirects to the receipt so it can be viewed/printed/shared.
export async function recordPaymentAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const back = String(formData.get("back") || "").trim();
  const amount = parseFloat(String(formData.get("amount") || "0")) || 0;
  const methodRaw = String(formData.get("method") || "").trim();
  const method = (["cash", "bank", "card", "other"].includes(methodRaw) ? methodRaw : undefined) as PaymentMethod | undefined;
  const paidOn = String(formData.get("paidOn") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const allocation = parseAllocation(formData.get("allocation"));
  const inv = await getInvoice(id);
  if (inv && amount > 0) {
    const currency = invoiceCurrency(inv.items);
    const { id: payId } = await recordInvoicePayment({
      invoiceId: id,
      clientSlug: slug,
      amount,
      currency,
      paidOn: paidOn || undefined,
      method,
      note: note || undefined,
      allocation: allocation.length ? allocation : undefined,
    });
    await setInvoicePaid(id, (Number(inv.paid_amount) || 0) + amount);
    await syncPaymentToNotion(slug, amount, inv.items, `${inv.number} payment`, inv.due_date, allocation.length ? allocation : undefined);
    revalidatePath(`/portal/${slug}`);
    revalidatePath("/admin/invoices");
    revalidatePath("/admin");
    // Land on the receipt voucher (carry the admin's return path so the page
    // can offer a way back to the list).
    redirect(`/portal/${slug}/receipt/${payId}?back=${encodeURIComponent(back || "/admin/invoices")}`);
  }
  redirect(back || "/admin/invoices");
}

// Void a recorded payment — deletes its receipt and rolls the amount back off
// the invoice's paid total, re-deriving the status. A wrong payment is fixed by
// voiding it and recording the right one. (Any Notion income row it created is
// not auto-removed; delete that in Notion if needed.)
export async function deletePaymentAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const payId = Number(formData.get("payId") || 0);
  const back = String(formData.get("back") || "").trim();
  const pay = await getPayment(payId);
  if (pay) {
    await deletePayment(payId);
    const inv = await getInvoice(pay.invoice_id);
    if (inv) {
      const newPaid = Math.max(0, (Number(inv.paid_amount) || 0) - (Number(pay.amount) || 0));
      await setInvoicePaid(inv.id, newPaid);
      revalidatePath(`/portal/${pay.client_slug}`);
      revalidatePath("/admin/invoices");
      revalidatePath("/admin");
    }
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
