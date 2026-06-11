import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients, type Client } from "@/lib/clients";
import { listNotionClients } from "@/lib/notion";
import { getFinance, fmtILS } from "@/lib/finance";
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

const DOT: Record<string, string> = {
  done: "bg-green-500",
  sent: "bg-orange",
  draft: "bg-neutral-300",
  empty: "bg-neutral-200 border border-dashed border-neutral-300",
};

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

function ClientTable({ clients, emptyText }: { clients: Client[]; emptyText: string }) {
  if (clients.length === 0) return <p className="px-4 py-6 text-sm text-neutral-400">{emptyText}</p>;
  return (
    <table className="w-full text-sm min-w-[820px]">
      <thead>
        <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
          <th className="text-left px-4 py-2 font-bold">Client</th>
          <th className="text-left px-2 py-2 font-bold">Plan</th>
          <th className="text-right px-2 py-2 font-bold">Money left</th>
          {portalSections(clients[0]).map((s) => (
            <th key={s.key} className="px-1.5 py-2 text-center font-bold">{s.key}</th>
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
                <Link href={`/portal/${c.slug}?edit=1`} className="font-semibold text-neutral-800 hover:text-orange inline-flex items-center gap-2.5">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" className="w-6 h-6 rounded-full object-contain bg-neutral-900 shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full inline-block shrink-0" style={{ background: c.color || "#303030" }} />
                  )}
                  <span className="truncate max-w-[180px]">{c.name || c.slug}</span>
                </Link>
                {c.data?.notionPageId && <span className="ml-2 text-[10px] text-neutral-300 align-middle" title="Linked to Notion">◆</span>}
              </td>
              <td className="px-2 py-2.5 text-xs text-neutral-500 truncate max-w-[150px]">{c.data?.plan?.name || "—"}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-xs font-semibold text-neutral-700 whitespace-nowrap">
                {c.data?.plan?.balance || "—"}
              </td>
              {secs.map((s) => (
                <td key={s.key} className="px-1.5 py-2.5 text-center">
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
  );
}

export default async function ClientsHome({ searchParams }: { searchParams: { error?: string; bulk?: string; filled?: string } }) {
  const dbOff = !isDbEnabled();
  const [clients, notionClients, debt] = await Promise.all([
    dbOff ? Promise.resolve([] as Client[]) : getClients(),
    listNotionClients(),
    trackerDebt(),
  ]);

  const norm = (s: string) => (s || "").replace(/-/g, "").toLowerCase();
  const linkedPages = new Set(clients.map((c) => norm(c.data?.notionPageId || "")).filter(Boolean));
  const notYetImported = notionClients.filter((n) => !linkedPages.has(norm(n.id)));

  const byName = (a: Client, b: Client) => (a.name || a.slug).localeCompare(b.name || b.slug);
  const pending = clients.filter((c) => c.data?.status === "pending").sort(byName);
  const active = clients.filter((c) => c.data?.status !== "pending" && c.data?.plan?.active).sort(byName);
  const inactive = clients.filter((c) => c.data?.status !== "pending" && !c.data?.plan?.active).sort(byName);

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
          <p className="text-sm text-neutral-500 mt-0.5">Grouped by status — what&apos;s filled, what&apos;s empty, and one click to fix it.</p>
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

      {/* ---- Grouped portals: Active → Pending → Inactive ---- */}
      {!dbOff &&
        (
          [
            { title: "Active", tone: "text-green-700", dot: "bg-green-500", list: active, empty: "No active clients yet." },
            { title: "Pending review", tone: "text-amber-700", dot: "bg-amber-400", list: pending, empty: "" },
            { title: "Inactive", tone: "text-neutral-500", dot: "bg-neutral-300", list: inactive, empty: "" },
          ] as const
        )
          .filter((g) => g.list.length > 0 || g.title === "Active")
          .map((g) => (
            <div key={g.title} className="adm-rise bg-white border border-neutral-200 rounded-xl mb-5 overflow-x-auto">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-bold tracking-tight flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${g.dot}`} />
                  {g.title} <span className={`tabular-nums text-sm font-bold ${g.tone}`}>{g.list.length}</span>
                </h2>
                {g.title === "Active" && (
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> filled</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-orange inline-block" /> sent</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-neutral-300 inline-block" /> draft</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-neutral-200 border border-dashed border-neutral-300 inline-block" /> empty</span>
                  </div>
                )}
              </div>
              <ClientTable clients={[...g.list]} emptyText={g.empty || "None."} />
            </div>
          ))}
    </div>
  );
}
