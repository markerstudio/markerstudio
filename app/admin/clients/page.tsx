import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
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
        <h1 className="text-2xl font-bold tracking-tight">Client portals</h1>
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

      <ClientsGrid clients={cards} />
    </div>
  );
}
