import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceGrandTotal, invoiceRemaining, type Invoice } from "@/lib/invoices";
import InvoiceCreateFromTab from "@/components/admin/InvoiceCreateFromTab";
import FinanceTabs from "@/components/admin/FinanceTabs";
import InvoiceStatusSelect from "@/components/admin/InvoiceStatusSelect";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";
import { StatTile, EmptyState } from "@/components/ui/glass";
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
    <div className="space-y-5">
      <FinanceTabs />
      <header className="lq-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Billing</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Invoices</h1>
          <p className="text-sm text-charcoal-60 mt-1">Create, send, track payments — printable from the portal.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/payments/new" className="lq-btn lq-btn--primary lq-btn--sm no-underline">
            + Record payment
          </Link>
          <Link
            href="/admin/invoices"
            className={`lq-btn lq-btn--sm no-underline ${!showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/invoices?archived=1"
            className={`lq-btn lq-btn--sm no-underline ${showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </header>

      {searchParams.ok && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-2.5 !border-emerald-300/40">
          Invoice <b className="font-mono">{searchParams.ok}</b> created.
        </p>
      )}
      {searchParams.error && (
        <p className="lq-card text-sm text-rose-700 px-4 py-2.5 !border-rose-300/40">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back={backHref || "/admin/invoices"} />
      {dbOff && <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>}
      {failed && <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">Database connected, but not initialised yet.</p>}

      {!dbOff && !failed && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile label="Outstanding" value={fmt(outstanding)} sub="still owed on open invoices" tone={outstanding > 0 ? "accent" : "neutral"} delay={40} />
          <StatTile
            label="Overdue"
            value={overdueCount ? `${overdueCount} · ${fmt(overdueTotal)}` : "None"}
            sub="past their due date"
            tone={overdueCount > 0 ? "bad" : "good"}
            delay={90}
          />
          <StatTile label="Collected this month" value={fmt(collectedThisMonth)} sub={now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} delay={140} />
          <StatTile label="Open invoices" value={String(counts.due + counts.partial)} sub={`${counts.draft} draft${counts.draft === 1 ? "" : "s"} waiting`} delay={190} />
        </div>
      )}

      {!dbOff && !failed && (
        <details className="lq-card lq-rise group" open={searchParams.error === "empty" || searchParams.error === "client"}>
          <summary className="cursor-pointer select-none px-5 py-4 font-display font-bold text-[15px] tracking-tight flex items-center gap-2.5 text-ink hover:text-orange-deep transition-colors">
            <span className="inline-flex w-6 h-6 rounded-full bg-orange text-white items-center justify-center text-sm leading-none shadow-[0_4px_10px_-4px_rgba(255,145,0,.6)] group-open:rotate-45 transition-transform">+</span>
            New invoice
          </summary>
          <div className="px-5 pb-5 border-t border-charcoal/5 pt-4">
            <InvoiceCreateFromTab clients={clients} balances={clientBalances} />
          </div>
        </details>
      )}

      {!dbOff && !failed && base.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/invoices?${showArchived ? "archived=1&" : ""}${f === "all" ? "" : `f=${f}`}`.replace(/[?&]$/, "")}
              className={`lq-press rounded-full px-3 py-1 text-xs font-semibold capitalize no-underline transition-colors ${
                filter === f
                  ? f === "overdue"
                    ? "bg-rose-600 text-white shadow-[0_4px_12px_-6px_rgba(225,29,72,.6)]"
                    : "bg-charcoal text-white shadow-[0_4px_12px_-6px_rgba(31,31,31,.5)]"
                  : "bg-white/60 border border-charcoal/10 text-charcoal-60 hover:bg-white"
              }`}
            >
              {f} <span className="tabular-nums opacity-60">{counts[f]}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="lq-card lq-rise divide-y divide-charcoal/5 overflow-hidden">
        {shown.map((inv) => {
          const vat = Number(inv.vat_rate) || 0;
          const paid = Number(inv.paid_amount) || 0;
          const total = invoiceGrandTotal(inv.items, vat);
          const remaining = invoiceRemaining(inv.items, vat, paid);
          const overdue = isOverdue(inv);
          return (
            <div key={inv.id} className={`flex items-center gap-4 px-5 py-3 flex-wrap transition-colors hover:bg-white/60 ${overdue ? "bg-rose-50/50" : ""}`}>
              <div className="flex-1 min-w-[160px]">
                <div className="font-mono text-sm font-semibold text-ink">
                  {inv.number}
                  {overdue && (
                    <span className="lq-chip lq-chip--red ms-2 uppercase !text-[9.5px] !px-2 !py-0.5">
                      Overdue
                    </span>
                  )}
                </div>
                <div className="text-xs text-charcoal-60">
                  <Link href={`/admin/clients/${inv.client_slug}/edit`} className="hover:text-orange-deep no-underline">/{inv.client_slug}</Link>
                  {" · "}{new Date(inv.issued_date).toLocaleDateString("en-GB")}
                  {inv.due_date ? (
                    <span className={overdue ? "text-rose-600 font-semibold" : ""}>
                      {" "}· due {new Date(inv.due_date).toLocaleDateString("en-GB")}
                    </span>
                  ) : null}
                  {vat > 0 ? ` · +${vat}% VAT` : ""}
                  {inv.source === "notion" ? " · from Notion" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular-nums font-semibold text-ink">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                {remaining > 0 && remaining < total && (
                  <div className="text-[11px] tabular-nums text-orange-deep">{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })} left</div>
                )}
              </div>
              <InvoiceStatusSelect id={inv.id} slug={inv.client_slug} status={inv.status} back={backHref || "/admin/invoices"} />
              {inv.status !== "paid" && !inv.archived_at && (
                <Link
                  href={`/admin/payments/new?invoice=${inv.id}`}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap no-underline"
                >
                  + Payment
                </Link>
              )}
              <Link href={`/admin/invoices/${inv.id}/edit`} className="text-sm font-medium text-charcoal-60 hover:text-orange-deep no-underline">Edit</Link>
              <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-sm font-medium text-charcoal-60 hover:text-orange-deep no-underline">PDF ↗</Link>
              <form action={duplicateInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="text-sm font-medium text-charcoal-40 hover:text-ink" title="Duplicate as a fresh draft — handy for monthly cycles">
                  Duplicate
                </button>
              </form>
              <form action={setInvoiceArchivedAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="archived" value={inv.archived_at ? "" : "1"} />
                <button className="text-sm font-medium text-charcoal-40 hover:text-ink">{inv.archived_at ? "Restore" : "Archive"}</button>
              </form>
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="slug" value={inv.client_slug} />
                <input type="hidden" name="back" value={backHref || "/admin/invoices"} />
                <ConfirmButton
                  message={`Delete invoice ${inv.number}? You'll get a chance to undo right after — archiving keeps it for your records instead.`}
                  className="text-sm font-medium text-charcoal-40 hover:text-rose-600"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {!dbOff && !failed && shown.length === 0 && (
          <EmptyState
            icon="🧾"
            title={showArchived ? "No archived invoices" : filter !== "all" ? `No ${filter} invoices` : "No invoices yet"}
            sub={showArchived ? "Archived invoices will land here." : filter !== "all" ? "Try another filter." : "Create one above — it's printable from the portal."}
          />
        )}
      </div>
    </div>
  );
}
