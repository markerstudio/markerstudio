// Notion sync — pull a content-calendar database into the portal's social posts.
// Uses an internal integration token (NOTION_TOKEN). Share the database with the
// integration in Notion first. We map flexibly:
//   - the Date property        → post date
//   - the Title property       → post title
//   - a "Platform" property    → platform (select / multi-select / text)
//   - a "Status"/"Stage" prop  → status (posted / scheduled / planned)
//   - a "Notes"/"Caption" prop → notes (rich text)
import { unstable_cache } from "next/cache";
import type { SocialPost, Invoice } from "@/lib/clients";

// Accept a raw Notion id or a URL; return the 32-char id.
export function extractNotionId(s: string): string | null {
  const m = s.replace(/-/g, "").match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function notionGet(path: string): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not set");
  const res = await fetch(`https://api.notion.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  return res.json();
}

async function notionPost(path: string, body: any): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not set");
  const res = await fetch(`https://api.notion.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  return res.json();
}

// The "Sources" database (Budget Tracker) holds the per-client "Money Left"
// formula and links back to the client via its "Clients Database" relation.
const SOURCES_DB = process.env.NOTION_SOURCES_DB || "1822487b8e7e81a2a412d3b1d6cc8108";

// The Clients Database — used to list clients for the import dropdown.
const CLIENTS_DB = process.env.NOTION_CLIENTS_DB || "16c2487b8e7e806bbe28da2772e3bb43";

// The Income database — payments. Clients link to it via its "Clients Database"
// relation, which is the reliable way to read a client's payments (the reverse
// "Payments" relation on the client page is often a separate, empty one-way link).
const INCOME_DB = process.env.NOTION_INCOME_DB || "1822487b8e7e81d4821bede793d640d5";

// Map one Income row's properties to an invoice + whether it's a "branding" payment.
function incomeRowToInvoice(ip: any): (Invoice & { _d: string; branding: boolean; ilsPaid: number }) {
  const ils = ip["ILS"]?.number;
  const usd = ip["USD"]?.number;
  const amount = ils != null ? `${ils.toLocaleString()} ILS` : usd != null ? `$${usd.toLocaleString()}` : "";
  const payDate = ip["Pay Date"]?.date?.start ? String(ip["Pay Date"].date.start).slice(0, 10) : "";
  const dueDate = ip["Due Date"]?.date?.start ? String(ip["Due Date"].date.start).slice(0, 10) : "";
  const nm = (ip["Name"]?.title || []).map((t: any) => t.plain_text).join("");

  // A payment is "branding" if its name, or any select/status/multi-select value, mentions branding.
  const branding = /brand/i.test(nm) || Object.values<any>(ip).some((pr) => {
    const v = pr?.type === "select" ? pr.select?.name
      : pr?.type === "status" ? pr.status?.name
      : pr?.type === "multi_select" ? (pr.multi_select || []).map((x: any) => x.name).join(" ")
      : "";
    return /brand/i.test(v || "");
  });

  return {
    cycle: nm || payDate || dueDate || "Payment",
    desc: payDate ? `Paid ${payDate}` : dueDate ? `Due ${dueDate}` : "",
    amount,
    status: payDate ? "paid" : "due",
    _d: payDate || dueDate || "",
    branding,
    ilsPaid: branding && payDate && typeof ils === "number" ? ils : 0,
  };
}

// List clients from the Notion Clients Database (for the import dropdown).
export async function listNotionClients(): Promise<{ id: string; name: string }[]> {
  if (!process.env.NOTION_TOKEN) return [];
  try {
    const q = await notionPost(`/v1/databases/${CLIENTS_DB}/query`, { page_size: 100 });
    return (q.results || [])
      .map((pg: any) => {
        const t = pg.properties?.["Name"]?.title || [];
        return { id: pg.id as string, name: t.map((x: any) => x.plain_text).join("") };
      })
      .filter((c: { name: string }) => c.name)
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function fetchSourceFinance(clientPageId: string): Promise<{ balance: string; monthlyFee: string; progress: number; brandingFee: string }> {
  const out = { balance: "", monthlyFee: "", progress: 0, brandingFee: "" };
  try {
    const q = await notionPost(`/v1/databases/${SOURCES_DB}/query`, {
      filter: { property: "Clients Database", relation: { contains: clientPageId } },
      page_size: 1,
    });
    const props = q.results?.[0]?.properties;
    if (!props) return out;

    // Branding (fixed) fee — a number/formula property whose name mentions "branding".
    for (const [name, prop] of Object.entries<any>(props)) {
      if (!/brand/i.test(name)) continue;
      const n = prop?.type === "formula" ? prop.formula?.number : prop?.number;
      if (typeof n === "number" && n > 0) { out.brandingFee = `${n.toLocaleString()} ILS`; break; }
    }

    // Money Left = how much of the current period is still owed (can exceed one
    // month when payments are overdue).
    const ml = props["Money Left"];
    const mlNum = ml?.type === "formula" ? ml.formula?.number : ml?.number;
    if (mlNum != null) out.balance = `${mlNum.toLocaleString()} ILS`;
    else if (ml?.formula?.string) out.balance = ml.formula.string;

    // Monthly fee.
    const fee = props["Monthly Income"]?.number;
    if (fee != null) out.monthlyFee = `${fee.toLocaleString()} ILS`;

    // Coverage of the current month: (fee - left) / fee. Overdue (left ≥ fee) → 0%.
    if (typeof fee === "number" && fee > 0 && typeof mlNum === "number") {
      out.progress = Math.max(0, Math.min(100, Math.round(((fee - mlNum) / fee) * 100)));
    } else {
      const pp = props["Paid Percentage"]?.formula?.number ?? props["Progress"]?.formula?.number;
      if (typeof pp === "number") out.progress = Math.max(0, Math.min(100, Math.round(pp <= 1 ? pp * 100 : pp)));
    }
  } catch {
    /* ignore — no source linked, or query failed */
  }
  return out;
}

// Pull a single client record from the Clients Database (a page), plus its
// linked Income rows mapped to invoices.
export async function fetchNotionClient(pageId: string): Promise<{
  name: string; start: string; end: string; active: boolean; planName: string; note: string;
  balance: string; monthlyFee: string; progress: number; invoices: Invoice[];
  brandingFee: string; brandingProgress: number; brandingLeft: string;
}> {
  const page = await notionGet(`/v1/pages/${pageId}`);
  const p = page.properties || {};
  const title = (k: string) => (p[k]?.title || []).map((t: any) => t.plain_text).join("");
  const date = (k: string) => (p[k]?.date?.start ? String(p[k].date.start).slice(0, 10) : "");
  const rich = (k: string) => (p[k]?.rich_text || []).map((t: any) => t.plain_text).join("");

  const name = title("Name");
  const start = date("Marketing Start Date");
  const end = date("End Date");
  const active = (p["Status"]?.select?.name || "").toLowerCase() === "active";
  const planName = (p["Service"]?.multi_select || []).map((x: any) => x.name).join(" · ");
  const note = rich("Notes");

  // Money Left + Monthly fee + coverage from the linked Source row (Budget Tracker).
  const fin = await fetchSourceFinance(pageId);

  // Payment history. Primary path: query the Income DB for rows whose "Clients
  // Database" relation points back to this client (reliable, one request).
  // Fallback: the client page's own "Payments" relation (one GET per row).
  const rows: ReturnType<typeof incomeRowToInvoice>[] = [];
  let brandingPaid = 0; // sum of paid payments marked "branding"
  try {
    const q = await notionPost(`/v1/databases/${INCOME_DB}/query`, {
      filter: { property: "Clients Database", relation: { contains: pageId } },
      page_size: 100,
    });
    for (const r of q.results || []) {
      const row = incomeRowToInvoice(r.properties || {});
      brandingPaid += row.ilsPaid;
      rows.push(row);
    }
  } catch {
    /* Income query failed — fall back to the relation below */
  }
  if (rows.length === 0) {
    const rel = (p["Payments"]?.relation || []) as { id: string }[];
    for (const r of rel.slice(0, 80)) {
      try {
        const inc = await notionGet(`/v1/pages/${r.id}`);
        const row = incomeRowToInvoice(inc.properties || {});
        brandingPaid += row.ilsPaid;
        rows.push(row);
      } catch {
        /* skip a payment that can't be read */
      }
    }
  }
  rows.sort((a, b) => (a._d < b._d ? 1 : a._d > b._d ? -1 : 0)); // newest first
  const invoices: Invoice[] = rows.map(({ _d, branding, ilsPaid, ...inv }) => inv);

  // Branding coverage: branding payments against the fixed branding fee.
  const bFee = parseFloat((fin.brandingFee || "").replace(/[^0-9.]/g, "")) || 0;
  let brandingProgress = 0;
  let brandingLeft = "";
  if (bFee > 0) {
    brandingProgress = Math.max(0, Math.min(100, Math.round((brandingPaid / bFee) * 100)));
    brandingLeft = `${Math.max(0, bFee - brandingPaid).toLocaleString()} ILS`;
  }

  return {
    name, start, end, active, planName, note,
    balance: fin.balance, monthlyFee: fin.monthlyFee, progress: fin.progress, invoices,
    brandingFee: fin.brandingFee, brandingProgress, brandingLeft,
  };
}

// Live, lightly-cached read of a client's Notion record for auto-refresh on
// portal view. Cached ~5 min per page id so loads stay fast and we don't hammer
// the Notion API on every request. Returns null on any failure (fall back to
// the saved snapshot).
export const getLiveNotionClient = unstable_cache(
  async (pageId: string) => {
    if (!process.env.NOTION_TOKEN) return null;
    try {
      return await fetchNotionClient(pageId);
    } catch {
      return null;
    }
  },
  ["notion-live-client"],
  { revalidate: 300, tags: ["notion-live"] },
);

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchNotionPosts(dbId: string): Promise<SocialPost[]> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not set");

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  const json = await res.json();

  const posts: SocialPost[] = [];
  for (const page of json.results || []) {
    const props = page.properties || {};
    let date = "";
    let title = "";
    let platform = "";
    let notes = "";
    let status: SocialPost["status"] = "planned";

    for (const [name, prop] of Object.entries<any>(props)) {
      const type = prop?.type;
      if (type === "date" && prop.date?.start && !date) {
        date = String(prop.date.start).slice(0, 10);
      } else if (type === "title") {
        title = (prop.title || []).map((t: any) => t.plain_text).join("");
      } else if (/platform|channel/i.test(name)) {
        if (type === "select") platform = prop.select?.name || "";
        else if (type === "multi_select") platform = (prop.multi_select || []).map((x: any) => x.name).join(", ");
        else if (type === "rich_text") platform = (prop.rich_text || []).map((t: any) => t.plain_text).join("");
      } else if (/status|stage|state/i.test(name)) {
        const s = type === "status" ? prop.status?.name : type === "select" ? prop.select?.name : "";
        const low = (s || "").toLowerCase();
        status = /post|publish|done|live/.test(low) ? "posted" : /sched/.test(low) ? "scheduled" : "planned";
      } else if (/note|caption|content/i.test(name) && type === "rich_text") {
        notes = (prop.rich_text || []).map((t: any) => t.plain_text).join("");
      }
    }

    if (date || title) posts.push({ date, platform, title, notes, status });
  }

  posts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return posts;
}
