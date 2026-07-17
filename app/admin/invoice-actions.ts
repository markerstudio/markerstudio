"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  createInvoice, getInvoice, updateInvoice, setInvoicePaid, setInvoiceStatus, deleteInvoice, setInvoiceArchived,
  invoiceCurrency,
  type InvoiceItem, type InvoiceStatus,
} from "@/lib/invoices";
import { resolveOrCreateClientByName, type ClientData } from "@/lib/clients";
import { recordInvoicePayment, deletePayment, getPayment, type PaymentMethod, type AllocationLine } from "@/lib/payments";
import { syncPaymentToNotion, reconcilePendingNotionPayments } from "@/lib/notionSync";
import { notionArchivePage } from "@/lib/notion";
import { usdIlsRateOn } from "@/lib/money";
import { snapshotForUndo, withParam } from "@/lib/undo";
import { notifyClientDevices } from "@/lib/clientNotify";

async function clientBySlug(slug: string) {
  const sql = getSql();
  const rows = (await sql`SELECT id, slug, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number; slug: string; data: ClientData }[];
  return rows[0];
}

// Payment → Notion mirroring now lives in lib/notionSync.ts, which records each
// payment's sync state and retries failures so a payment can never be silently
// lost. recordPaymentAction (below) calls syncPaymentToNotion with the new
// receipt's id; reconcilePendingNotionPayments re-pushes anything still pending.

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

// Record an at-creation deposit (the "already paid" amount on a new invoice) as
// a real, tracked payment — so it gets a receipt, lands in the ledger, and syncs
// to Notion durably (retried on failure) exactly like any other payment, instead
// of the old fire-and-forget write that could vanish silently.
async function recordDepositPayment(input: {
  invoiceId: number;
  slug: string;
  items: InvoiceItem[];
  amount: number;
  label: string;
  dueDate?: string | null;
}) {
  if (!(input.amount > 0)) return;
  const currency = invoiceCurrency(input.items);
  const { id: payId, number: payNumber } = await recordInvoicePayment({
    invoiceId: input.invoiceId,
    clientSlug: input.slug,
    amount: input.amount,
    currency,
  });
  await setInvoicePaid(input.invoiceId, input.amount);
  await syncPaymentToNotion({
    payId,
    slug: input.slug,
    amount: input.amount,
    items: input.items,
    label: input.label,
    currency,
    dueDate: input.dueDate || null,
    ref: payNumber,
  });
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

  const { id: invoiceId, number } = await createInvoice({ clientId: c.id, clientSlug: c.slug, items, note, dueDate: dueDate || undefined, source: "custom", vatRate });
  await recordDepositPayment({ invoiceId, slug, items, amount: paidAmount, label: `${number} deposit`, dueDate });
  await notifyClientDevices(c.id, { title: "Marker Studio — new invoice", body: `${number} is ready in your portal.`, url: `/portal/${slug}`, tag: `invoice-${number}` });
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

  const { number } = await createInvoice({ clientId: c.id, clientSlug: c.slug, items: [{ label, amount: fee }], note: plan?.note?.en || "", source: "notion" });
  await notifyClientDevices(c.id, { title: "Marker Studio — new invoice", body: `${number} — ${fee} — is ready in your portal.`, url: `/portal/${slug}`, tag: `invoice-${number}` });
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

  const { id: invoiceId, number } = await createInvoice({
    clientId: target.id,
    clientSlug: target.slug,
    items,
    note,
    dueDate: dueDate || undefined,
    source: "custom",
    vatRate,
  });
  await recordDepositPayment({ invoiceId, slug: target.slug, items, amount: paidAmount, label: `${number} deposit`, dueDate });
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
  const session = await getSession();
  if (!session) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const slug = String(formData.get("slug") || "").trim();
  const back = String(formData.get("back") || "").trim();
  const amount = parseFloat(String(formData.get("amount") || "0")) || 0;
  const methodRaw = String(formData.get("method") || "").trim();
  const method = (["cash", "bank", "card", "other"].includes(methodRaw) ? methodRaw : undefined) as PaymentMethod | undefined;
  const paidOn = String(formData.get("paidOn") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const allocation = parseAllocation(formData.get("allocation"));
  // Currency is chosen on the form (defaulting to the invoice's inferred
  // currency) so a USD/ILS invoice that the "$" heuristic gets wrong can be
  // corrected at record time — it drives both the receipt and the Notion row.
  const currencyRaw = String(formData.get("currency") || "").trim().toUpperCase();
  // "Also add to Notion records" — a checkbox (checked by default in the form),
  // so a present value means sync, absent means the admin unchecked it. Lets a
  // payment that's already in Notion (or shouldn't go there) skip the mirror.
  const toNotion = formData.get("toNotion") === "on";
  const inv = await getInvoice(id);
  // A partner-only admin (Ramzi) may record payments only on their own clients.
  if (inv && isPartnerOnly(session)) {
    const c = await clientBySlug(inv.client_slug);
    if (c?.data?.owner !== "ramzi") redirect("/admin/partner");
  }
  if (inv && amount > 0) {
    const currency = currencyRaw === "USD" || currencyRaw === "ILS" ? (currencyRaw as "ILS" | "USD") : invoiceCurrency(inv.items);
    // Cross-currency payment (e.g. $400 against an ILS invoice): what it's
    // worth in the INVOICE's currency, frozen at the pay-day exchange rate.
    // Same-currency payments apply 1:1. Without this, a $400 payment used to
    // knock only 400 ILS off an ILS invoice.
    const invCurrency = invoiceCurrency(inv.items);
    let applied = amount;
    if (currency !== invCurrency) {
      const rate = await usdIlsRateOn(paidOn || new Date().toISOString().slice(0, 10));
      applied = currency === "USD" ? Math.round(amount * rate) : Math.round(amount / rate);
    }
    const { id: payId, number: payNumber } = await recordInvoicePayment({
      invoiceId: id,
      clientSlug: slug,
      amount,
      currency,
      appliedAmount: applied,
      paidOn: paidOn || undefined,
      method,
      note: note || undefined,
      allocation: allocation.length ? allocation : undefined,
    });
    await setInvoicePaid(id, (Number(inv.paid_amount) || 0) + applied);
    // Mirror into Notion (unless the admin opted out) and record whether it
    // stuck; a failure here is saved on the payment and retried by the
    // reconciler, never silently dropped.
    if (toNotion) {
      await syncPaymentToNotion({
        payId,
        slug,
        amount,
        items: inv.items,
        label: `${inv.number} payment`,
        currency,
        dueDate: inv.due_date,
        allocation: allocation.length ? allocation : null,
        paidOn: paidOn || undefined,
        ref: payNumber,
      });
    }
    revalidatePath(`/portal/${slug}`);
    revalidatePath("/admin/invoices");
    revalidatePath("/admin");
    // Land on the receipt voucher (carry the admin's return path so the page
    // can offer a way back to the list).
    redirect(`/portal/${slug}/receipt/${payId}?back=${encodeURIComponent(back || "/admin/invoices")}`);
  }
  redirect(back || "/admin/invoices");
}

// Re-push any payments that haven't made it into Notion yet (failed write, or
// recorded while Notion was down). Safe to run anytime — it only touches the
// stragglers. Wired to the "Re-sync payments" button on the Finance page.
export async function resyncNotionPaymentsAction() {
  if (!(await getSession())) redirect("/login");
  // Manual click: ignore the automatic path's attempt cap and report how many
  // payments were actually processed — a silent no-op must never look like
  // success (that's how a broken sync went unnoticed for a week).
  const processed = await reconcilePendingNotionPayments(100, { ignoreAttemptCap: true });
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  redirect(`/admin/finance?ok=resynced&n=${processed}`);
}

// Void a recorded payment — deletes its receipt, rolls the amount back off the
// invoice's paid total (re-deriving the status), and archives the Notion Income
// rows it created so the books don't keep phantom income. A wrong payment is
// fixed by voiding it and recording the right one.
export async function deletePaymentAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const payId = Number(formData.get("payId") || 0);
  const back = String(formData.get("back") || "").trim();
  const pay = await getPayment(payId);
  if (pay) {
    // Remove the mirrored Income rows from Notion (best-effort) before deleting
    // the local receipt that remembers their ids.
    for (const pageId of pay.notion_page_ids || []) await notionArchivePage(pageId);
    await deletePayment(payId);
    const inv = await getInvoice(pay.invoice_id);
    if (inv) {
      // Roll back what was actually APPLIED to the invoice (the frozen
      // cross-currency value when the currencies differed), not the raw amount.
      const appliedBack = Number(pay.applied_amount ?? pay.amount) || 0;
      const newPaid = Math.max(0, (Number(inv.paid_amount) || 0) - appliedBack);
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
