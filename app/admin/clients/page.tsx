import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients, type Client } from "@/lib/clients";
import { listNotionClients } from "@/lib/notion";
import ClientsGrid, { type ClientCardData } from "@/components/admin/ClientsGrid";
import { quickCreateClient, quickCreateFromNotion, importAllNotionClients } from "../actions";

export const dynamic = "force-dynamic";
// Bulk Notion import walks every client record; give the action headroom.
export const maxDuration = 60;

const ERR: Record<string, string> = {
  name: "Enter a client name.",
  "notion-token": "NOTION_TOKEN isn't set. Add it in Vercel → Environment Variables and redeploy.",
  "notion-id": "Couldn't read a Notion page ID — paste the Clients Database row URL or its 32-char ID.",
  "notion-fetch": "Couldn't reach Notion. Check NOTION_TOKEN and that the Clients Database is shared with your integration.",
};

// Which parts of a portal are actually filled in — drives the fill matrix so
// empty sections are visible at a glance and one click away from editing.
function portalSections(c: Client) {
  const d = c.data;
  const edit = (tab?: string) => `/portal/${c.slug}?edit=1${tab ? `#${tab}` : ""}`;
  const docStatus = (x?: { published?: boolean; acceptedAt?: string }) =>
    x?.acceptedAt ? "done" : x?.published ? "sent" : x ? "draft" : "empty";
  return [
    { key: "Hero", state: d.hero?.en || d.hero?.ar ? "done" : "empty", href: edit() },
    { key: "Plan", state: d.plan?.name ? "done" : "empty", href: edit() },
    { key: "Social", state: (d.social?.posts ?? []).length > 0 ? "done" : "empty", href: edit() },
    {
      key: "Analysis",
      state: (d.analysis?.organic?.metrics ?? []).length > 0 || (d.analysis?.paid?.campaigns ?? []).length > 0 ? "done" : "empty",
      href: edit(),
    },
    { key: "Finance", state: d.finance?.monthlyFee || d.plan?.balance ? "done" : "empty", href: edit() },
    { key: "Docs", state: (d.documents ?? []).length > 0 ? "done" : "empty", href: edit() },
    { key: "Proposal", state: docStatus(d.proposal), href: `/admin/proposals/${c.slug}` },
    { key: "Agreement", state: docStatus(d.agreement), href: `/admin/agreements/${c.slug}` },
  ] as const;
}

const DOT: Record<string, string> = {
  done: "bg-green-500",
  sent: "bg-orange",
  draft: "bg-neutral-300",
  empty: "bg-neutral-200 border border-dashed border-neutral-300",
};

export default async function ClientsHome({ searchParams }: { searchParams: { error?: string; bulk?: string } }) {
  const dbOff = !isDbEnabled();
  const clients = dbOff ? [] : await getClients();
  const notionClients = await listNotionClients();

  const norm = (s: string) => (s || "").replace(/-/g, "").toLowerCase();
  const linkedPages = new Set(clients.map((c) => norm(c.data?.notionPageId || "")).filter(Boolean));
  const notYetImported = notionClients.filter((n) => !linkedPages.has(norm(n.id)));

  const cards: ClientCardData[] = clients.map((c) => ({
    slug: c.slug,
    name: c.name || c.slug,
    color: c.color || "#303030",
    logo: c.logo || "",
    planName: c.data?.plan?.name || "",
    balance: c.data?.plan?.balance || "",
    status: c.data?.status === "pending" ? "pending" : c.data?.plan?.active ? "active" : "inactive",
    notion: !!c.data?.notionPageId,
  }));

  // Header stats — portals, activity and the combined money still out there.
  const activeCount = cards.filter((c) => c.status === "active").length;
  const pendingCount = cards.filter((c) => c.status === "pending").length;
  let balanceTotal = 0;
  for (const c of clients) {
    const n = parseFloat((c.data?.plan?.balance || "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) balanceTotal += n;
  }

  // ?bulk=imported.linked.skipped.failed from the bulk import action.
  const bulk = (searchParams.bulk || "").split(".").map((n) => parseInt(n, 10));
  const bulkMsg =
    bulk.length === 4 && bulk.every((n) => Number.isFinite(n))
      ? [
          bulk[0] ? `${bulk[0]} imported` : "",
          bulk[1] ? `${bulk[1]} linked to existing portals` : "",
          bulk[2] ? `${bulk[2]} already set up` : "",
          bulk[3] ? `${bulk[3]} failed` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client portals</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Every portal, what&apos;s filled, and what still needs your hand.</p>
        </div>
        {notYetImported.length > 0 && (
          <form action={importAllNotionClients}>
            <button className="bg-charcoal text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-ink transition-colors">
              Import all from Notion ({notYetImported.length})
            </button>
          </form>
        )}
      </div>

      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-5">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {bulkMsg && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-5">
          Notion import finished — {bulkMsg}.
        </p>
      )}
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-5">No database configured.</p>}

      {!dbOff && clients.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Portals", value: String(cards.length), note: "total client portals" },
            { label: "Active", value: String(activeCount), note: "with a running plan", green: activeCount > 0 },
            { label: "Pending review", value: String(pendingCount), note: "from onboarding", accent: pendingCount > 0 },
            { label: "Balances out", value: balanceTotal ? `${balanceTotal.toLocaleString("en-US")} ₪` : "—", note: "sum of money-left figures" },
          ].map((s) => (
            <div key={s.label} className="adm-rise bg-white border border-neutral-200 rounded-xl px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.green ? "text-green-700" : s.accent ? "text-orange-deep" : "text-neutral-900"}`}>
                {s.value}
              </div>
              <div className="text-xs text-neutral-400">{s.note}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <form action={quickCreateClient} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">New client — just the name</label>
            <input name="name" required placeholder="e.g. Dr. Jack Sabat" className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange" />
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">Create →</button>
        </form>

        <form action={quickCreateFromNotion} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Or import one from Notion</label>
            {notionClients.length > 0 ? (
              <select name="notionPageId" required className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange">
                <option value="">Choose a client…</option>
                {notionClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {linkedPages.has(norm(c.id)) ? " ✓ imported" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input name="notionPageId" required placeholder="Clients Database row URL / ID" className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange" />
            )}
          </div>
          <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors">Import →</button>
        </form>
      </div>

      {notionClients.length === 0 && (
        <p className="text-xs text-neutral-500 -mt-3 mb-6">
          Tip: to import clients here, set <code>NOTION_TOKEN</code> in Vercel and share your <b>Clients Database</b> with the integration (Notion → ••• → Connections).
        </p>
      )}

      {/* ---- Portal fill matrix — see and fill every section from one place ---- */}
      {!dbOff && clients.length > 0 && (
        <div className="adm-rise bg-white border border-neutral-200 rounded-xl mb-6 overflow-x-auto">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
            <h2 className="font-bold tracking-tight">Portal fill — what&apos;s live, what&apos;s empty</h2>
            <div className="flex items-center gap-3 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> filled</span>
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-orange inline-block" /> sent</span>
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-neutral-300 inline-block" /> draft</span>
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-neutral-200 border border-dashed border-neutral-300 inline-block" /> empty</span>
            </div>
          </div>
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                <th className="text-left px-4 py-2 font-bold">Client</th>
                {portalSections(clients[0]).map((s) => (
                  <th key={s.key} className="px-2 py-2 text-center font-bold">{s.key}</th>
                ))}
                <th className="px-3 py-2 text-right font-bold">Filled</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {clients.map((c) => {
                const secs = portalSections(c);
                const filled = secs.filter((s) => s.state === "done" || s.state === "sent").length;
                const pct = Math.round((filled / secs.length) * 100);
                return (
                  <tr key={c.slug} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/portal/${c.slug}?edit=1`} className="font-semibold text-neutral-800 hover:text-orange inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: c.color || "#303030" }} />
                        {c.name || c.slug}
                      </Link>
                      {c.data?.status === "pending" && (
                        <span className="ml-2 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5">Pending</span>
                      )}
                    </td>
                    {secs.map((s) => (
                      <td key={s.key} className="px-2 py-2.5 text-center">
                        <Link href={s.href} title={`${s.key}: ${s.state}`} className="inline-block group">
                          <span className={`inline-block w-3.5 h-3.5 rounded-full transition-transform group-hover:scale-125 ${DOT[s.state]}`} />
                        </Link>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <span className={`tabular-nums text-xs font-bold ${pct === 100 ? "text-green-700" : pct >= 50 ? "text-neutral-700" : "text-orange-deep"}`}>{pct}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link href={`/portal/${c.slug}?edit=1`} className="text-xs font-semibold text-neutral-500 hover:text-orange">Fill ✎</Link>
                      <Link href={`/admin/clients/${c.slug}/edit`} className="ml-3 text-xs font-semibold text-neutral-500 hover:text-orange">Settings</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ClientsGrid clients={cards} />
    </div>
  );
}
