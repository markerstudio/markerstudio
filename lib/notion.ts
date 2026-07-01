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
import { amountLabelToIls, usdIlsRateOn } from "@/lib/money";

// Accept a raw Notion id or a URL; return the 32-char id.
export function extractNotionId(s: string): string | null {
  const m = s.replace(/-/g, "").match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : null;
}

// Normalise anything date-shaped to "YYYY-MM-DD" (what Notion's date properties
// want). A Postgres DATE column surfaces as a string OR a JS Date depending on
// the driver — calling .slice() on a Date object is exactly the crash that
// silently broke the payment sync ("e.dueDate.slice is not a function"), so
// every date that reaches a Notion payload must pass through here.
export function isoDay(v: unknown): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

// A Notion write that fails partway can leave some Income rows created. We carry
// the ids that DID get written so a retry can archive them first and never
// duplicate a payment in the books.
export class NotionSyncError extends Error {
  created: string[];
  constructor(message: string, created: string[] = []) {
    super(message);
    this.name = "NotionSyncError";
    this.created = created;
  }
}

// Backoff between retries (ms). Kept short so a recorded payment's redirect
// isn't held up for long on a Notion outage — the reconciler heals the rest.
const RETRY_DELAYS_MS = [300, 700, 1500];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 408/429 and 5xx are transient (rate limit / Notion hiccup) — worth retrying.
// 4xx like 400/404 are our fault (bad property/archived page) — fail fast.
const isRetryableStatus = (s: number) => s === 408 || s === 429 || s >= 500;

/* eslint-disable @typescript-eslint/no-explicit-any */
// Single entry point for every Notion REST call: injects auth, and retries
// transient failures with backoff instead of losing the write. Network errors
// (caught) and retryable statuses are retried; other 4xx throw immediately.
async function notionFetch(path: string, init: RequestInit): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not set");
  const url = `https://api.notion.com${path}`;
  const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", ...(init.headers || {}) };
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, cache: "no-store" });
    } catch (e) {
      // Network-level failure — retry while attempts remain.
      lastErr = e;
      if (attempt === RETRY_DELAYS_MS.length) throw e;
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (res.ok) return res.json();
    const detail = await res.text().catch(() => "");
    const err = new Error(`Notion ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    if (isRetryableStatus(res.status) && attempt < RETRY_DELAYS_MS.length) {
      lastErr = err;
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error("Notion request failed");
}

export async function notionGet(path: string): Promise<any> {
  return notionFetch(path, { method: "GET" });
}

export async function notionPost(path: string, body: any): Promise<any> {
  return notionFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Archive (soft-delete) a Notion page. Best-effort — used to clean up rows from
// a previous, partially-failed payment write before re-creating them, so a
// re-sync is idempotent and never doubles a payment.
export async function notionArchivePage(pageId: string): Promise<void> {
  if (!process.env.NOTION_TOKEN || !pageId) return;
  try {
    await notionFetch(`/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
  } catch {
    /* best-effort cleanup — a leftover row is better than blocking the retry */
  }
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

// Bank account pages in the Budget Tracker. A written-back payment is related to
// the matching account so the bank's running balance updates: ILS payments go to
// "Arab Bank - ILS" via the Income DB's "ILS Account" relation, USD payments go
// to "Arab Bank - USD" via its "Arab Bank USD" relation. Override per-workspace
// with env vars.
const ARAB_BANK_ILS = process.env.NOTION_ARAB_BANK_ILS || "1cb2487b8e7e80a0a743f56fdbe7bcdf";
const ARAB_BANK_USD = process.env.NOTION_ARAB_BANK_USD || "2232487b8e7e80048fbeebb5663894c6";

// The "All Time Clients Debt" row ("Clients Debts") that curates which sources
// count as client debt. A new client's source is attached to it via the Source's
// "All Time Clients Debt" relation so the client shows up in the debt leaderboard.
const DEBT_ROW = process.env.NOTION_DEBT_ROW || "1fd2487b8e7e80909d90f69244dbf83c";

// Parse a money string like "5,000 ILS" / "$1,200" into a number (0 if unparseable).
function moneyToNumber(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Map one Income row's properties to an invoice line.
function incomeRowToInvoice(ip: any): (Invoice & { _d: string }) {
  const ils = ip["ILS"]?.number;
  const usd = ip["USD"]?.number;
  // A single payment can carry both currencies (e.g. 150 ILS + $50). Show every
  // amount present rather than keeping only the first, so dollars never vanish.
  const amount = [
    ils != null ? `${ils.toLocaleString()} ILS` : "",
    usd != null ? `$${usd.toLocaleString()}` : "",
  ].filter(Boolean).join(" + ");
  const payDate = ip["Pay Date"]?.date?.start ? String(ip["Pay Date"].date.start).slice(0, 10) : "";
  const dueDate = ip["Due Date"]?.date?.start ? String(ip["Due Date"].date.start).slice(0, 10) : "";
  const nm = (ip["Name"]?.title || []).map((t: any) => t.plain_text).join("");

  return {
    cycle: nm || payDate || dueDate || "Payment",
    // Keep BOTH dates — the portal shows them, and "Invoice payment history"
    // uses them to backdate the generated invoice to the real timeline.
    desc: [dueDate ? `Due ${dueDate}` : "", payDate ? `Paid ${payDate}` : ""].filter(Boolean).join(" · "),
    amount,
    status: payDate ? "paid" : "due",
    _d: payDate || dueDate || "",
  };
}

// The Source rows (Budget Tracker) a client is linked to — the same per-client
// "Clients Database" relation we read finance from. Used to tag a written-back
// payment with the client's source so it lands under the right plan. Returns the
// page ids (newest-first is unimportant — callers take the first).
async function fetchClientSourceIds(clientPageId: string): Promise<string[]> {
  try {
    const q = await notionPost(`/v1/databases/${SOURCES_DB}/query`, {
      filter: { property: "Clients Database", relation: { contains: clientPageId } },
      page_size: 10,
    });
    return (q.results || []).map((r: any) => r.id as string).filter(Boolean);
  } catch {
    return [];
  }
}

// Write a payment back to the Notion Income database, mirroring an admin-recorded
// payment so the studio's books stay in sync both ways. Creates one Income row
// matching the convention of hand-entered rows:
//   - Clients Database → the client (the relation we read payments from)
//   - Pay Date → when the payment was taken; Due Date → the invoice's due date
//   - ILS + "ILS Account" → Arab Bank - ILS  /  USD + "Arab Bank USD" → Arab Bank - USD
//   - Source → the client's Budget Tracker source row (first match)
// Best-effort: returns the new page id, or null when Notion isn't configured or
// the call fails — the local invoice is always the source of truth, so we never
// block on Notion.
export async function createIncomePayment(input: {
  clientPageId: string;
  amount: number;
  currency: "ILS" | "USD";
  payDate?: string; // ISO yyyy-mm-dd; defaults to today
  dueDate?: string; // ISO yyyy-mm-dd; the invoice's due date
  name?: string;
}): Promise<string | null> {
  if (!(input.amount > 0)) return null;
  try {
    const ids = await createIncomePaymentLines({
      clientPageId: input.clientPageId,
      currency: input.currency,
      payDate: input.payDate,
      dueDate: input.dueDate,
      lines: [{ name: input.name || `Payment ${(input.payDate || "").slice(0, 10)}`.trim(), amount: input.amount }],
    });
    return ids[0] || null;
  } catch {
    return null; // best-effort wrapper — callers that need failures use createIncomePaymentLines
  }
}

// Optional destination-side idempotency. If the Income database has a rich_text
// property named "Ref" / "Reference" / "Receipt", we stamp each row with the app
// receipt number (REC-YYYY-NNN) and replace-by-ref on re-sync — so the same
// payment can never create two rows, even if local sync state is lost or a sync
// is triggered by hand. Fully opt-in: with no such property (the default) this is
// dormant and the sync behaves exactly as before. Detected once per process.
let _incomeRefProp: string | null | undefined;
async function getIncomeRefProp(): Promise<string | null> {
  if (_incomeRefProp !== undefined) return _incomeRefProp;
  try {
    const db = await notionGet(`/v1/databases/${INCOME_DB}`);
    let found: string | null = null;
    for (const [name, p] of Object.entries<any>(db?.properties || {})) {
      if (p?.type === "rich_text" && /^(ref|reference|receipt)$/i.test(String(name).trim())) {
        found = name;
        break;
      }
    }
    _incomeRefProp = found;
  } catch {
    _incomeRefProp = null; // can't read the schema → behave exactly as before
  }
  return _incomeRefProp;
}

// Optional frozen-rate column. If the Income DB has a number property named
// "USD in ILS" (or "ILS Equivalent"/"ILS Value"), every synced USD row also
// gets its shekel value at the PAY-DAY exchange rate — locked forever, so a
// later rate change can never re-value history. Sources can then roll this up
// ("Paid USD in ILS") and Money Left uses the rollup instead of USD × a
// hardcoded rate. Fully opt-in: without the column, the sync behaves exactly
// as before. Detected once per process, like the Ref property.
let _incomeUsdIlsProp: string | null | undefined;
async function getIncomeUsdIlsProp(): Promise<string | null> {
  if (_incomeUsdIlsProp !== undefined) return _incomeUsdIlsProp;
  try {
    const db = await notionGet(`/v1/databases/${INCOME_DB}`);
    let found: string | null = null;
    for (const [name, p] of Object.entries<any>(db?.properties || {})) {
      if (p?.type === "number" && /^(usd in ils|ils equivalent|ils value)$/i.test(String(name).trim())) {
        found = name;
        break;
      }
    }
    _incomeUsdIlsProp = found;
  } catch {
    _incomeUsdIlsProp = null;
  }
  return _incomeUsdIlsProp;
}

// Is this payment ALREADY in the Income DB — typically because the admin added
// it to Notion by hand after the automatic sync failed? The reconciler asks this
// before re-pushing a payment whose local state still reads "pending": if the
// money is already booked for this client on this pay date, pushing again would
// double it (exactly how a hand-entered payment gets duplicated and the client's
// "Money Left" drops below the truth).
//
// Conservative on purpose. It matches on client + pay date + currency and only
// reports "present" when the existing rows already cover the amount this payment
// would write — and it can't see a hand-entered row stamped with no Ref any other
// way, since a manual row carries none of our tracking. Returns the matched page
// ids so the payment can be linked to the rows that already exist. On any read
// failure it returns "not present" so a genuine gap is never left unfilled.
export async function incomeAlreadyRecorded(input: {
  clientPageId: string;
  payDate: string; // ISO yyyy-mm-dd
  currency: "ILS" | "USD";
  expected: number; // the Marker amount this payment would write to Notion
  ignorePageIds?: string[]; // rows from a prior failed attempt — archived, not counted
}): Promise<{ present: boolean; pageIds: string[] }> {
  if (!process.env.NOTION_TOKEN || !input.clientPageId || !(input.expected > 0)) {
    return { present: false, pageIds: [] };
  }
  try {
    const q = await notionPost(`/v1/databases/${INCOME_DB}/query`, {
      filter: {
        and: [
          { property: "Clients Database", relation: { contains: input.clientPageId } },
          { property: "Pay Date", date: { equals: isoDay(input.payDate) || new Date().toISOString().slice(0, 10) } },
        ],
      },
      page_size: 100,
    });
    const ignore = new Set(input.ignorePageIds || []);
    const field = input.currency === "USD" ? "USD" : "ILS";
    let sum = 0;
    const pageIds: string[] = [];
    for (const r of q.results || []) {
      if (!r?.id || ignore.has(r.id)) continue;
      const n = r.properties?.[field]?.number;
      if (typeof n === "number" && n > 0) {
        sum += n;
        pageIds.push(r.id as string);
      }
    }
    // Existing rows for this client+date already cover the amount → it's booked.
    // Half-unit slack absorbs the per-line rounding the sync itself applies.
    return { present: pageIds.length > 0 && sum + 0.5 >= input.expected, pageIds };
  } catch {
    return { present: false, pageIds: [] };
  }
}

// Archive any existing Income rows already stamped with this receipt ref, so a
// re-sync replaces rather than duplicates. Best-effort.
async function archiveIncomeByRef(refProp: string, ref: string): Promise<void> {
  try {
    const q = await notionPost(`/v1/databases/${INCOME_DB}/query`, {
      filter: { property: refProp, rich_text: { equals: ref } },
      page_size: 50,
    });
    for (const r of q.results || []) {
      if (r?.id) await notionArchivePage(r.id as string);
    }
  } catch {
    /* best-effort — falls back to the caller's local-id archiving */
  }
}

// Write one Income row PER LINE, so a payment lands in Notion categorised the
// way the budget formula expects — "Branding", "Plan Payment", "Extra" — rather
// than a single lump row. Each row links to the client and their Source. Callers
// must drop Ramzi/stories pass-through lines beforehand: those are never Marker
// income and must not touch the books.
//
// Returns the created page ids on success. Returns [] only when there's nothing
// to do (no token, no client, no positive lines). THROWS a NotionSyncError when
// a write genuinely fails after retries — so callers can record the failure and
// retry, instead of silently losing the payment. The error carries any ids that
// were written before the failure so a retry can archive them and avoid dupes.
export async function createIncomePaymentLines(input: {
  clientPageId: string;
  lines: { name: string; amount: number }[];
  currency: "ILS" | "USD";
  payDate?: string;
  dueDate?: string;
  ref?: string; // app receipt number (REC-YYYY-NNN) — enables Ref idempotency
}): Promise<string[]> {
  if (!process.env.NOTION_TOKEN || !input.clientPageId) return [];
  const lines = (input.lines || []).filter((l) => l.amount > 0);
  if (!lines.length) return [];
  const created: string[] = [];
  const payDate = isoDay(input.payDate) || new Date().toISOString().slice(0, 10);
  const dueDate = isoDay(input.dueDate);
  // Source — match the client's Budget Tracker source row (first one found).
  // Best-effort: a Source lookup failure must not abort the payment write.
  let sourceIds: string[] = [];
  try {
    sourceIds = await fetchClientSourceIds(input.clientPageId);
  } catch {
    sourceIds = [];
  }
  // Optional idempotency stamp (dormant unless the Income DB has a Ref property):
  // replace any rows already written for this receipt before re-creating them.
  const refProp = input.ref ? await getIncomeRefProp() : null;
  if (input.ref && refProp) await archiveIncomeByRef(refProp, input.ref);
  // Frozen-rate stamp for dollar payments (dormant unless the column exists):
  // the pay-day USD→ILS rate, fetched once for the whole payment.
  const usdIlsProp = input.currency === "USD" ? await getIncomeUsdIlsProp() : null;
  const usdRate = usdIlsProp ? await usdIlsRateOn(payDate) : 0;
  for (const line of lines) {
    const properties: Record<string, any> = {
      Name: { title: [{ text: { content: line.name || `Payment ${payDate}` } }] },
      "Pay Date": { date: { start: payDate } },
      "Clients Database": { relation: [{ id: input.clientPageId }] },
    };
    if (dueDate) properties["Due Date"] = { date: { start: dueDate } };
    // Amount + matching bank account, so the bank's running balance updates.
    if (input.currency === "USD") {
      properties.USD = { number: line.amount };
      properties["Arab Bank USD"] = { relation: [{ id: ARAB_BANK_USD }] };
      // Lock the shekel value at the pay-day rate so "Money Left" deducts the
      // real exchange value of the dollars — and never re-values it later.
      if (usdIlsProp && usdRate > 0) properties[usdIlsProp] = { number: Math.round(line.amount * usdRate) };
    } else {
      properties.ILS = { number: line.amount };
      properties["ILS Account"] = { relation: [{ id: ARAB_BANK_ILS }] };
    }
    if (sourceIds.length) properties.Source = { relation: [{ id: sourceIds[0] }] };
    if (input.ref && refProp) properties[refProp] = { rich_text: [{ text: { content: input.ref } }] };
    try {
      const res = await notionPost(`/v1/pages`, { parent: { database_id: INCOME_DB }, properties });
      if (res?.id) created.push(res.id as string);
    } catch (e) {
      // A line failed even after retries — surface it (with what we managed to
      // write) so the caller records the failure and retries later, rather than
      // silently dropping the payment from the books.
      throw new NotionSyncError(`Income write failed for "${line.name}": ${(e as Error)?.message || String(e)}`, created);
    }
  }
  return created;
}

// Create a client in Notion's Clients Database plus a matching Source row in the
// Budget Tracker, and attach that source to the "All Time Clients Debt" table so
// the client appears in the debt leaderboard. Mirrors how clients are set up by
// hand in Notion. Returns the new client + source page ids, or null when Notion
// isn't configured or the call fails — best-effort, so a Notion hiccup never
// blocks creating the local client (which is the source of truth).
export async function createNotionClientWithSource(input: {
  name: string;
  monthlyFee?: string; // e.g. "5,000 ILS" — becomes the Source's Monthly Income
  brandingFee?: string; // becomes the Source's Branding Cost
}): Promise<{ clientPageId: string; sourcePageId: string | null } | null> {
  if (!process.env.NOTION_TOKEN) return null;
  const name = (input.name || "").trim();
  if (!name) return null;
  try {
    // 1) Clients Database page.
    const client = await notionPost(`/v1/pages`, {
      parent: { database_id: CLIENTS_DB },
      properties: { Name: { title: [{ text: { content: name } }] } },
    });
    const clientPageId = client?.id as string;
    if (!clientPageId) return null;

    // 2) Source row, linked to the client and the All Time Clients Debt table.
    const sourceProps: Record<string, any> = {
      Name: { title: [{ text: { content: name } }] },
      "Clients Database": { relation: [{ id: clientPageId }] },
      "All Time Clients Debt": { relation: [{ id: DEBT_ROW }] },
    };
    const monthly = moneyToNumber(input.monthlyFee);
    const branding = moneyToNumber(input.brandingFee);
    if (monthly > 0) sourceProps["Monthly Income"] = { number: monthly };
    if (branding > 0) sourceProps["Branding Cost"] = { number: branding };

    let sourcePageId: string | null = null;
    try {
      const source = await notionPost(`/v1/pages`, {
        parent: { database_id: SOURCES_DB },
        properties: sourceProps,
      });
      sourcePageId = (source?.id as string) || null;
    } catch {
      /* client created, but the source failed — keep the client link */
    }

    return { clientPageId, sourcePageId };
  } catch {
    return null;
  }
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

// Per-client finance from the Budget Tracker's Sources DB. A client often has
// SEVERAL source rows (e.g. one for branding, one for monthly marketing) — so
// everything money-related is summed across ALL of them. Reading just the
// first row under-reported "Money left" whenever branding and marketing lived
// in separate sources.
async function fetchSourceFinance(clientPageId: string): Promise<{
  balance: string;
  balanceNum: number;
  monthlyFee: string;
  progress: number;
  brandingFee: string;
}> {
  const out = { balance: "", balanceNum: 0, monthlyFee: "", progress: 0, brandingFee: "" };
  try {
    const q = await notionPost(`/v1/databases/${SOURCES_DB}/query`, {
      filter: { property: "Clients Database", relation: { contains: clientPageId } },
      page_size: 50,
    });
    const rows = (q.results || []).map((r: any) => r.properties).filter(Boolean);
    if (rows.length === 0) return out;

    let owedSum = 0;
    let sawMoneyLeft = false;
    let brandingSum = 0;
    let feeSum = 0;
    const progresses: number[] = [];

    for (const props of rows) {
      // Branding (fixed) fee — any number/formula property mentioning "branding".
      for (const [name, prop] of Object.entries<any>(props)) {
        if (!/brand/i.test(name)) continue;
        const n = prop?.type === "formula" ? prop.formula?.number : prop?.number;
        if (typeof n === "number" && n > 0) {
          brandingSum += n;
          break;
        }
      }

      // Money Left — the tracker stores it NEGATIVE while the client owes.
      const ml = props["Money Left"];
      const mlNum = ml?.type === "formula" ? ml.formula?.number : ml?.number;
      if (mlNum != null) {
        sawMoneyLeft = true;
        owedSum += Math.max(0, -mlNum);
      }

      // Monthly fee — summed in case marketing is split across sources.
      const fee = props["Monthly Income"]?.number;
      if (typeof fee === "number" && fee > 0) feeSum += fee;

      // Per-source coverage formula, kept as a fallback for the combined figure.
      const pf = props["Progress"]?.formula ?? props["Paid Percentage"]?.formula;
      const pp = typeof pf?.number === "number"
        ? pf.number
        : typeof pf?.string === "string"
          ? parseFloat(pf.string.replace(/[^0-9.]/g, ""))
          : NaN;
      if (!Number.isNaN(pp)) progresses.push(Math.max(0, Math.min(100, Math.round(pp <= 1 ? pp * 100 : pp))));
    }

    if (sawMoneyLeft) {
      out.balanceNum = owedSum;
      out.balance = `${owedSum.toLocaleString()} ILS`;
    }
    if (brandingSum > 0) out.brandingFee = `${brandingSum.toLocaleString()} ILS`;
    if (feeSum > 0) out.monthlyFee = `${feeSum.toLocaleString()} ILS`;
    if (progresses.length) out.progress = Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
  } catch {
    /* ignore — no source linked, or query failed */
  }
  return out;
}

// Pull a single client record from the Clients Database (a page), plus its
// linked Income rows mapped to invoices. The balance ("Money Left") is the
// Budget Tracker's single combined figure — branding + marketing + extras −
// paid. We deliberately do NOT derive a separate branding-only balance.
export async function fetchNotionClient(pageId: string): Promise<{
  name: string; start: string; end: string; active: boolean; planName: string; note: string;
  balance: string; monthlyFee: string; progress: number; invoices: Invoice[];
  brandingFee: string;
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
  try {
    const q = await notionPost(`/v1/databases/${INCOME_DB}/query`, {
      filter: { property: "Clients Database", relation: { contains: pageId } },
      page_size: 100,
    });
    for (const r of q.results || []) {
      rows.push(incomeRowToInvoice(r.properties || {}));
    }
  } catch {
    /* Income query failed — fall back to the relation below */
  }
  if (rows.length === 0) {
    const rel = (p["Payments"]?.relation || []) as { id: string }[];
    for (const r of rel.slice(0, 80)) {
      try {
        const inc = await notionGet(`/v1/pages/${r.id}`);
        rows.push(incomeRowToInvoice(inc.properties || {}));
      } catch {
        /* skip a payment that can't be read */
      }
    }
  }
  rows.sort((a, b) => (a._d < b._d ? 1 : a._d > b._d ? -1 : 0)); // newest first
  const invoices: Invoice[] = rows.map(({ _d, ...inv }) => inv);

  // Combined "Paid %" from what actually happened: total ILS received across
  // paid income rows vs. what's still owed (Money Left summed over ALL the
  // client's sources — branding + marketing together). Falls back to the
  // sources' own averaged Progress formula when there are no payments yet.
  let progress = fin.progress;
  const paidSum = rows.reduce((sum, r) => {
    if (r.status !== "paid") return sum;
    return sum + amountLabelToIls(r.amount || ""); // counts ILS + any USD, in shekels
  }, 0);
  if (paidSum > 0 || fin.balanceNum > 0) {
    progress = Math.max(0, Math.min(100, Math.round((paidSum / Math.max(1, paidSum + fin.balanceNum)) * 100)));
  }

  return {
    name, start, end, active, planName, note,
    balance: fin.balance, monthlyFee: fin.monthlyFee, progress, invoices,
    brandingFee: fin.brandingFee,
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
