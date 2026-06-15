import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceGrandTotal, invoiceRemaining, type Invoice } from "@/lib/invoices";
import InvoiceCreateFromTab from "@/components/admin/InvoiceCreateFromTab";
import FinanceTabs from "@/components/admin/FinanceTabs";
import InvoiceStatusSelect from "@/components/admin/InvoiceStatusSelect";
import ConfirmButton from "@/components/admin/ConfirmButton";
import RecordPayment from "@/components/admin/RecordPayment";
import UndoBanner from "@/components/admin/UndoBanner";
import { setInvoiceArchivedAction, deleteInvoiceAction, duplicateInvoiceAction } from "../invoice-actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  empty: "Add at least one line item.",
  client: "Pick a client or type a name.",
};

const FILTERS = ["all", "draft", "due", "partial", "paid", "overdue"] as const;
type Filter = (typeof FILTERS)[number];

export default async function InvoicesAdmin({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string; archived?: string; f?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const dbOff = !isDbEnabled();
  const showArchived = searchParams.archived === "1";
  const filter: Filter = (FILTERS as readonly string[]).includes(searchParams.f || "") ? ((searchParams.f || "all") as Filter) : "all";
  let invoices: Invoice[] = [];
  let clients: { slug: string; name: string }[] = [];
  let failed = false;
  if (!dbOff) {
    try {
      await ensureInvoicesTable();
      const [inv, cls] = await Promise.all([listInvoices(), getClients()]);
      invoices = inv;
      clients = cls.map((c) => ({ slug: c.slug, name: c.name || c.slug }));
    } catch {
      failed = true;
    }
  }

  const now = new Date();
  const isOverdue = (inv: Invoice) =>
    (inv.status === "due" || inv.status === "partial") && !!inv.due_date && new Date(inv.due_date) < now;

  // ---- money summary across active (non-archived) invoices ----
  const live = invoices.filter((i) => !i.archived_at);
  let outstanding = 0;
  let overdueTotal = 0;
  let overdueCount = 0;
  let collectedThisMonth = 0;
  // Per-client open balance, shown while creating a new invoice so you can see
  // what's already left to pay without checking elsewhere.
  const clientBalances: Record<string, { open: number; count: number }> = {};
  for (const inv of live) {
    const vat = Number(inv.vat_rate) || 0;
    const paid = Number(inv.paid_amount) || 0;
    if (inv.status === "due" || inv.status === "partial") {
      const rem = invoiceRemaining(inv.items, vat, paid);
      outstanding += rem;
      if (rem > 0) {
        const b = clientBalances[inv.client_slug] || { open: 0, count: 0 };
        b.open += rem;
        b.count++;
        clientBalances[inv.client_slug] = b;
      }
      if (isOverdue(inv)) {
        overdueTotal += rem;
        overdueCount++;
      }
    }
    const issued = new Date(inv.issued_date);
    if (issued.getFullYear() === now.getFullYear() && issued.getMonth() === now.getMonth()) collectedThisMonth += paid;
  }

  const archivedCount = invoices.filter((i) => i.archived_at).length;
  const base = invoices.filter((i) => (showArchived ? i.archived_at : !i.archived_at));
  const shown = base.filter((i) => {
    if (filter === "all") return true;
    if (filter === "overdue") return isOverdue(i);
    return i.status === filter;
  });
  const counts: Record<Filter, number> = {
    all: base.length,
    draft: base.filter((i) => i.status === "draft").length,
    due: base.filter((i) => i.status === "due").length,
    partial: base.filter((i) => i.status === "partial").length,
    paid: base.filter((i) => i.status === "paid").length,
    overdue: base.filter(isOverdue).length,
  };
  const backHref = `/admin/invoices?${showArchived ? "archived=1&" : ""}${filter !== "all" ? `f=${filter}` : ""}`.replace(/[?&]$/, "");
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div>
      <FinanceTabs />
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Create, send, track payments — printable from the portal.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/invoices"
            className={`rounded-full px-3 py-1.5 font-semibold ${!showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/invoices?archived=1"
            className={`rounded-full px-3 py-1.5 font-semibold ${showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </div>

      {searchParams.ok && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">
          Invoice <b className="font-mono">{searchParams.ok}</b> created.
        </p>
      )}
      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-6">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back={backHref || "/admin/invoices"} />
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>}
      {failed && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">Database connected, but not initialised yet.</p>}

      {!dbOff && !failed && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Outstanding", value: fmt(outstanding), note: "still owed on open invoices", accent: outstanding > 0 },
            { label: "Overdue", value: overdueCount ? `${overdueCount} · ${fmt(overdueTotal)}` : "None", note: "past their due date", red: overdueCount > 0 },
            { label: "Collected this month", value: fmt(collectedThisMonth), note: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) },
            { label: "Open invoices", value: String(counts.due + counts.partial), note: `${counts.draft} draft${counts.draft === 1 ? "" : "s"} waiting` },
          ].map((s) => (
            <div key={s.label} className="adm-rise bg-white border border-neutral-200 rounded-xl px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.red ? "text-red-600" : s.accent ? "text-orange-deep" : "text-neutral-900"}`}>
                {s.value}
              </div>
              <div className="text-xs text-neutral-400">{s.note}</div>
            </div>
          ))}
        </div>
      )}

      {!dbOff && !failed && (
        <details className="bg-white border border-neutral-200 rounded-xl mb-6 group" open={searchParams.error === "empty" || searchParams.error === "client"}>
          <summary className="cursor-pointer select-none px-4 py-3.5 font-semibold text-sm flex items-center gap-2 text-neutral-800 hover:text-orange transition-colors">
            <span className="inline-flex w-5 h-5 rounded-full bg-orange text-white items-center justify-center text-sm leading-none group-open:rotate-45 transition-transform">+</span>
            New invoice
          </summary>
          <div className="px-4 pb-4 border-t border-neutral-100 pt-4">
            <InvoiceCreateFromTab clients={clients} balances={clientBalances} />
          </div>
        </details>
      )}

      {!dbOff && !failed && base.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/invoices?${showArchived ? "archived=1&" : ""}${f === "all" ? "" : `f=${f}`}`.replace(/[?&]$/, "")}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? f === "overdue"
                    ? "bg-red-600 text-white"
                    : "bg-charcoal text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {f} <span className="tabular-nums opacity-60">{counts[f]}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {shown.map((inv) => {
          const vat = Number(inv.vat_rate) || 0;
          const paid = Number(inv.paid_amount) || 0;
          const total = invoiceGrandTotal(inv.items, vat);
          const remaining = invoiceRemaining(inv.items, vat, paid);
          const overdue = isOverdue(inv);
          return (
            <div key={inv.id} className={`flex items-center gap-4 px-4 py-3 flex-wrap ${overdue ? "bg-red-50/40" : ""}`}>
              <div className="flex-1 min-w-[160px]">
                <div className="font-mono text-sm font-semibold text-neutral-900">
                  {inv.number}
                  {overdue && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                      Overdue
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  <Link href={`/admin/clients/${inv.client_slug}/edit`} className="hover:text-orange">/{inv.client_slug}</Link>
                  {" · "}{new Date(inv.issued_date).toLocaleDateString("en-GB")}
                  {inv.due_date ? (
                    <span className={overdue ? "text-red-600 font-semibold" : ""}>
                      {" "}· due {new Date(inv.due_date).toLocaleDateString("en-GB")}
                    </span>
                  ) : null}
                  {vat > 0 ? ` · +${vat}% VAT` : ""}
                  {inv.source === "notion" ? " · from Notion" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular-nums font-semibold text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                {remaining > 0 && remaining < total && (
                  <div className="text-[11px] tabular-nums text-orange-deep">{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })} left</div>
                )}
              </div>
              <InvoiceStatusSelect id={inv.id} slug={inv.client_slug} status={inv.status} back={backHref || "/admin/invoices"} />
              {inv.status !== "paid" && !inv.archived_at && (
                <RecordPayment id={inv.id} slug={inv.client_slug} back={backHref || "/admin/invoices"} remaining={remaining} />
              )}
              <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">PDF ↗</Link>
              <form action={duplicateInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="text-sm font-medium text-neutral-500 hover:text-charcoal" title="Duplicate as a fresh draft — handy for monthly cycles">
                  Duplicate
                </button>
              </form>
              <form action={setInvoiceArchivedAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="archived" value={inv.archived_at ? "" : "1"} />
                <button className="text-sm font-medium text-neutral-500 hover:text-charcoal">{inv.archived_at ? "Restore" : "Archive"}</button>
              </form>
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="slug" value={inv.client_slug} />
                <input type="hidden" name="back" value={backHref || "/admin/invoices"} />
                <ConfirmButton
                  message={`Delete invoice ${inv.number}? You'll get a chance to undo right after — archiving keeps it for your records instead.`}
                  className="text-sm font-medium text-neutral-400 hover:text-red-600"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {!dbOff && !failed && shown.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">
            {showArchived ? "No archived invoices." : filter !== "all" ? `No ${filter} invoices.` : "No invoices yet — create one above."}
          </div>
        )}
      </div>
    </div>
  );
}
