import { isDbEnabled } from "@/lib/db";
import { getClients, type Client } from "@/lib/clients";
import { listNotionClients } from "@/lib/notion";
import { getFinance, fmtILS } from "@/lib/finance";
import ClientsGrid, { type ClientCardData } from "@/components/admin/ClientsGrid";
import UndoBanner from "@/components/admin/UndoBanner";
import { quickCreateClient, quickCreateFromNotion, importAllNotionClients } from "../actions";
import { autofillPortals } from "../fill-actions";

export const dynamic = "force-dynamic";
// Bulk Notion import / autofill walk every client record; give actions headroom.
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
  const edit = `/portal/${c.slug}?edit=1`;
  const docStatus = (x?: { published?: boolean; acceptedAt?: string }) =>
    x?.acceptedAt ? "done" : x?.published ? "sent" : x ? "draft" : "empty";
  return [
    { key: "Hero", state: d.hero?.en || d.hero?.ar ? "done" : "empty", href: edit },
    { key: "Plan", state: d.plan?.name ? "done" : "empty", href: edit },
    { key: "Social", state: (d.social?.posts ?? []).length > 0 ? "done" : "empty", href: edit },
    {
      key: "Analysis",
      state: (d.analysis?.organic?.metrics ?? []).length > 0 || (d.analysis?.paid?.campaigns ?? []).length > 0 ? "done" : "empty",
      href: edit,
    },
    { key: "Finance", state: d.finance?.monthlyFee || d.plan?.balance ? "done" : "empty", href: edit },
    { key: "Proposal", state: docStatus(d.proposal), href: `/admin/proposals/${c.slug}` },
    { key: "Agreement", state: docStatus(d.agreement), href: `/admin/agreements/${c.slug}` },
  ] as const;
}

// Live combined client debt from the Budget Tracker (the source of truth) —
// raced against a timeout so a cold Notion fetch can't stall the page.
async function trackerDebt(): Promise<number | null> {
  if (!process.env.NOTION_TOKEN) return null;
  try {
    const f = await Promise.race([getFinance(), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
    return f && f.available ? f.totalDebt : null;
  } catch {
    return null;
  }
}

// Shape a client for the card grid (must stay serialisable — it crosses to a
// client component).
function toCard(c: Client): ClientCardData {
  const secs = portalSections(c);
  const filled = secs.filter((s) => s.state === "done" || s.state === "sent").length;
  return {
    slug: c.slug,
    name: c.name || c.slug,
    color: c.color || "#303030",
    logo: c.logo || "",
    planName: c.data?.plan?.name || "",
    balance: c.data?.plan?.balance || "",
    status: c.data?.status === "pending" ? "pending" : c.data?.plan?.active ? "active" : "inactive",
    notion: !!c.data?.notionPageId,
    sections: secs.map((s) => ({ key: s.key, state: s.state, href: s.href })),
    pct: Math.round((filled / secs.length) * 100),
  };
}

export default async function ClientsHome({
  searchParams,
}: {
  searchParams: { error?: string; bulk?: string; filled?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const dbOff = !isDbEnabled();
  const [clients, notionClients, debt] = await Promise.all([
    dbOff ? Promise.resolve([] as Client[]) : getClients(),
    listNotionClients(),
    trackerDebt(),
  ]);

  const norm = (s: string) => (s || "").replace(/-/g, "").toLowerCase();
  const linkedPages = new Set(clients.map((c) => norm(c.data?.notionPageId || "")).filter(Boolean));
  const notYetImported = notionClients.filter((n) => !linkedPages.has(norm(n.id)));

  const cards = clients.map(toCard);
  const pending = cards.filter((c) => c.status === "pending");
  const active = cards.filter((c) => c.status === "active");
  const inactive = cards.filter((c) => c.status === "inactive");

  // Fallback when the tracker is unreachable: sum of saved money-left figures
  // (can be stale — the tracker number is preferred and labelled accordingly).
  let savedBalances = 0;
  for (const c of clients) {
    const n = parseFloat((c.data?.plan?.balance || "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) savedBalances += n;
  }

  // ?bulk=imported.linked.skipped.failed / ?filled=touched.fields
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
  const filled = (searchParams.filled || "").split(".").map((n) => parseInt(n, 10));
  const filledMsg =
    filled.length === 2 && filled.every((n) => Number.isFinite(n))
      ? filled[0] === 0
        ? "Nothing to fill — every portal already has its basics."
        : `Auto-filled ${filled[1]} empty field${filled[1] === 1 ? "" : "s"} across ${filled[0]} portal${filled[0] === 1 ? "" : "s"} — review and adjust freely.`
      : "";

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client portals</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Search or filter to find anyone — what&apos;s filled, what&apos;s empty, and one click to fix it.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {!dbOff && clients.length > 0 && (
            <form action={autofillPortals}>
              <button
                className="bg-white border border-neutral-300 text-neutral-800 font-semibold rounded-md px-4 py-2 text-sm hover:border-orange hover:text-orange transition-colors"
                title="Fills empty basics (hero line, watermark, plan name from the brief, section headlines) on every portal — never overwrites filled fields"
              >
                ✨ Auto-fill blanks
              </button>
            </form>
          )}
          {notYetImported.length > 0 && (
            <form action={importAllNotionClients}>
              <button className="bg-charcoal text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-ink transition-colors">
                Import all from Notion ({notYetImported.length})
              </button>
            </form>
          )}
        </div>
      </div>

      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-5">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/clients" />
      {bulkMsg && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-5">Notion import finished — {bulkMsg}.</p>
      )}
      {filledMsg && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-5">{filledMsg}</p>
      )}
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-5">No database configured.</p>}

      {!dbOff && clients.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Active", value: String(active.length), note: "with a running plan", green: active.length > 0 },
            { label: "Pending review", value: String(pending.length), note: "from onboarding", accent: pending.length > 0 },
            { label: "Inactive", value: String(inactive.length), note: "paused or finished" },
            debt != null
              ? { label: "Clients owe us", value: fmtILS(debt), note: "live from the Budget Tracker" }
              : { label: "Clients owe us", value: savedBalances ? `${savedBalances.toLocaleString("en-US")} ₪` : "—", note: "sum of saved money-left figures (may be stale)" },
          ].map((s) => (
            <div key={s.label} className="adm-rise bg-white border border-neutral-200 rounded-xl px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${"green" in s && s.green ? "text-green-700" : "accent" in s && s.accent ? "text-orange-deep" : "text-neutral-900"}`}>
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

      {/* ---- Client cards: searchable, filterable grid ---- */}
      {!dbOff && <ClientsGrid clients={cards} />}
    </div>
  );
}
