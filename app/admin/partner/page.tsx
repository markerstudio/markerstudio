import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeePartner } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listAllPayments, ramziAmountOf, type Payment } from "@/lib/payments";

export const dynamic = "force-dynamic";

function money(n: number, currency: string) {
  const v = Math.round(n).toLocaleString("en-US");
  return currency === "USD" ? `$${v}` : `${v} ILS`;
}

export default async function PartnerPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Walled off: only Ramzi and the super admin. Regular admins (Maram) can't.
  if (!canSeePartner(user)) redirect("/admin");

  if (!isDbEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ramzi</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4">No database configured.</p>
      </div>
    );
  }

  const [clients, payments] = await Promise.all([getClients(), listAllPayments()]);
  const nameBySlug = new Map(clients.map((c) => [c.slug, c.name || c.slug]));

  // Stories collected for Ramzi across every client, by payment.
  const collected = payments
    .map((p) => ({ p, amount: ramziAmountOf(p) }))
    .filter((x) => x.amount > 0);

  const totalsByCurrency = new Map<string, number>();
  const byClient = new Map<string, { ils: number; usd: number; count: number }>();
  for (const { p, amount } of collected) {
    totalsByCurrency.set(p.currency, (totalsByCurrency.get(p.currency) || 0) + amount);
    const b = byClient.get(p.client_slug) || { ils: 0, usd: 0, count: 0 };
    if (p.currency === "USD") b.usd += amount;
    else b.ils += amount;
    b.count++;
    byClient.set(p.client_slug, b);
  }
  const clientRows = Array.from(byClient.entries())
    .map(([slug, v]) => ({ slug, name: nameBySlug.get(slug) || slug, ...v }))
    .sort((a, b) => b.ils + b.usd - (a.ils + a.usd));

  const ramziClients = clients.filter((c) => c.data?.owner === "ramzi");
  const recent: { p: Payment; amount: number }[] = collected.slice(0, 12);
  const totalIls = totalsByCurrency.get("ILS") || 0;
  const totalUsd = totalsByCurrency.get("USD") || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ramzi</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Stories money collected on Ramzi&apos;s behalf and his own clients. Private — visible only to Ramzi and the super admin.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-charcoal text-white rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Collected for Ramzi</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-orange">{money(totalIls, "ILS")}</div>
          {totalUsd > 0 && <div className="mt-1 text-sm text-white/70 tabular-nums">+ {money(totalUsd, "USD")}</div>}
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Clients paying stories</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{clientRows.length}</div>
          <div className="text-xs text-neutral-400">{collected.length} payment{collected.length === 1 ? "" : "s"} total</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Ramzi&apos;s own clients</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{ramziClients.length}</div>
          <div className="text-xs text-neutral-400">walled off from other admins</div>
        </div>
      </div>

      {/* Stories collected, by client */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-bold tracking-tight mb-3">Stories collected — by client</h2>
        {clientRows.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Nothing collected for Ramzi yet. Add a Stories line to an invoice and record the payment.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {clientRows.map((r) => (
              <li key={r.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{r.name}</div>
                  <div className="text-[11px] text-neutral-500">{r.count} payment{r.count === 1 ? "" : "s"}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-neutral-900">
                  {r.ils > 0 ? money(r.ils, "ILS") : ""}
                  {r.ils > 0 && r.usd > 0 ? " · " : ""}
                  {r.usd > 0 ? money(r.usd, "USD") : ""}
                </span>
                <Link href={`/admin/clients/${r.slug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">→</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ramzi's own clients */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold tracking-tight">Ramzi&apos;s clients</h2>
          <Link href="/admin/clients/new" className="text-xs font-semibold text-neutral-500 hover:text-orange">+ New client</Link>
        </div>
        {ramziClients.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">No clients owned by Ramzi yet. Create one, or set a client&apos;s Owner to “Ramzi (partner)”.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {ramziClients.map((c) => (
              <li key={c.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{c.name || c.slug}</div>
                  <div className="text-[11px] text-neutral-500">/{c.slug}</div>
                </div>
                <Link href={`/admin/clients/${c.slug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">Edit →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent receipts that included Ramzi's stories */}
      {recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h2 className="font-bold tracking-tight mb-3">Recent stories receipts</h2>
          <ul className="divide-y divide-neutral-100">
            {recent.map(({ p, amount }) => (
              <li key={p.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{nameBySlug.get(p.client_slug) || p.client_slug}</div>
                  <div className="text-[11px] text-neutral-500">{new Date(p.paid_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {p.number}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-orange-deep">{money(amount, p.currency)}</span>
                <Link href={`/portal/${p.client_slug}/receipt/${p.id}`} className="text-xs font-semibold text-neutral-400 hover:text-orange">↗</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
