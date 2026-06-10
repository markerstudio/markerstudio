// Studio finance — reads the Notion Budget Tracker and turns it into analysis
// for the admin: who owes what (debt leaderboard), who pays on time vs late
// (Due Date vs Pay Date on Income rows), bank balances, and overdue payments.
//
// Databases (override ids via env if the workspace changes):
//   Sources       — one row per income source: Monthly Income, Branding Cost,
//                   Extra, Settlements, "Money Left" (combined debt formula)
//                   and Paid rollups. Not every source is a client.
//   All Time Clients Debt — the tracker's own definition of client debt: its
//                   "Sources" relation curates WHICH sources count as client
//                   debt, and its "Rollup" sums their Money Left. The debt
//                   leaderboard follows this set rather than guessing.
//   Income        — individual payments with Due Date / Pay Date / ILS / USD
//   Bank Accounts — Starting Balance + income/expense rollups + Current Balance
//   Expenses      — spend rows with Date / ILS / USD
//
// Cached ~5 minutes (tag "finance"); the admin's "Sync now" busts the tag.
import { unstable_cache } from "next/cache";
import { notionPost, notionGet } from "@/lib/notion";
import { getSql, isDbEnabled } from "@/lib/db";

const SOURCES_DB = process.env.NOTION_SOURCES_DB || "1822487b8e7e81a2a412d3b1d6cc8108";
const INCOME_DB = process.env.NOTION_INCOME_DB || "1822487b8e7e81d4821bede793d640d5";
const BANKS_DB = process.env.NOTION_BANKS_DB || "1cb2487b8e7e8067a0f4d86d0efc5751";
const EXPENSES_DB = process.env.NOTION_EXPENSES_DB || "1822487b8e7e81479d0acbca4f3a19c5";
const DEBT_DB = process.env.NOTION_DEBT_DB || "1fd2487b8e7e80cd8ff0e1624470eba8";

// Days of slack before a payment counts as "late".
const GRACE_DAYS = 3;

export type BankAccount = {
  name: string;
  balance: number; // Current Balance formula (starting + income − expenses)
  totalIncome: number;
  totalExpenses: number;
};

export type DebtorBehavior = "on-time" | "mostly-on-time" | "often-late" | "no-data";

export type Debtor = {
  sourceId: string;
  name: string;
  notionUrl: string;
  debt: number; // combined "Money Left" — one number, no branding/marketing split
  paidPct: number; // combined paid percentage (0-100)
  monthlyFee: number;
  allTimePaid: number; // Paid Sum ILS rollup
  // Payment behaviour (from Income Due Date vs Pay Date)
  behavior: DebtorBehavior;
  onTime: number;
  late: number;
  avgDelayDays: number; // average days past due across late payments
  lastPaymentDate: string; // ISO date of most recent payment
  // Link into the app when the source maps to one of our client portals
  clientSlug: string | null;
};

export type OverduePayment = {
  name: string;
  sourceName: string;
  amountLabel: string;
  dueDate: string;
  daysOverdue: number;
  notionUrl: string;
  clientSlug: string | null;
};

export type FinanceData = {
  available: boolean; // NOTION_TOKEN present and the tracker reachable
  error?: string;
  banks: BankAccount[];
  bankTotal: number;
  debtors: Debtor[]; // sorted by debt, highest first
  totalDebt: number;
  overdue: OverduePayment[]; // unpaid rows past their due date, most overdue first
  overdueTotal: number;
  collectedThisMonthILS: number;
  expectedThisMonthILS: number; // unpaid rows due this month
  expensesThisMonthILS: number;
  syncedAt: string;
};

const EMPTY: FinanceData = {
  available: false,
  banks: [],
  bankTotal: 0,
  debtors: [],
  totalDebt: 0,
  overdue: [],
  overdueTotal: 0,
  collectedThisMonthILS: 0,
  expectedThisMonthILS: 0,
  expensesThisMonthILS: 0,
  syncedAt: "",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// Query a database, following pagination (capped, the tracker is small).
async function queryAll(dbId: string, body: any = {}, maxPages = 5): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const q = await notionPost(`/v1/databases/${dbId}/query`, {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...(q.results || []));
    if (!q.has_more || !q.next_cursor) break;
    cursor = q.next_cursor;
  }
  return out;
}

// Every id in a relation property. Page objects cap relation arrays at 25
// (has_more) — the curated debt list is longer, so follow the property-items
// endpoint for the rest.
async function fullRelationIds(pageId: string, prop: any): Promise<string[]> {
  const out = new Set<string>(((prop?.relation || []) as { id: string }[]).map((r) => r.id.replace(/-/g, "")));
  if (prop?.has_more && prop?.id) {
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const q = await notionGet(
        `/v1/pages/${pageId}/properties/${encodeURIComponent(prop.id)}?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
      );
      for (const it of q.results || []) {
        const id = it?.relation?.id;
        if (id) out.add(String(id).replace(/-/g, ""));
      }
      if (!q.has_more || !q.next_cursor) break;
      cursor = q.next_cursor;
    }
  }
  return Array.from(out);
}

const title = (p: any, k: string) => ((p?.[k]?.title || []) as any[]).map((t) => t.plain_text).join("");
const num = (p: any, k: string): number => {
  const prop = p?.[k];
  if (!prop) return 0;
  const v =
    prop.type === "number" ? prop.number
    : prop.type === "formula" ? prop.formula?.number
    : prop.type === "rollup" ? prop.rollup?.number
    : null;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};
// Formula properties sometimes yield a string ("1,200 ILS") instead of a
// number — accept both, like lib/notion.ts does for Money Left.
const numLoose = (p: any, k: string): number => {
  const direct = num(p, k);
  if (direct) return direct;
  const s = p?.[k]?.formula?.string ?? p?.[k]?.rollup?.string;
  if (typeof s === "string") {
    const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
};
const dateOf = (p: any, k: string): string => (p?.[k]?.date?.start ? String(p[k].date.start).slice(0, 10) : "");
const relIds = (p: any, k: string): string[] => ((p?.[k]?.relation || []) as { id: string }[]).map((r) => r.id.replace(/-/g, ""));

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

// Our portal clients that are linked to Notion, for "create invoice" shortcuts.
async function linkedClients(): Promise<{ slug: string; name: string; pageId: string }[]> {
  if (!isDbEnabled()) return [];
  try {
    const rows = (await getSql()`SELECT slug, name, data->>'notionPageId' AS page_id FROM clients`) as unknown as {
      slug: string;
      name: string;
      page_id: string | null;
    }[];
    return rows.map((r) => ({ slug: r.slug, name: (r.name || "").toLowerCase(), pageId: (r.page_id || "").replace(/-/g, "") }));
  } catch {
    return [];
  }
}

async function fetchFinance(): Promise<FinanceData> {
  if (!process.env.NOTION_TOKEN) return { ...EMPTY, error: "Notion isn't connected (NOTION_TOKEN not set)." };

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  let sources: any[] = [];
  let incomes: any[] = [];
  let banks: any[] = [];
  let expenses: any[] = [];
  try {
    [sources, incomes, banks, expenses] = await Promise.all([
      queryAll(SOURCES_DB),
      queryAll(INCOME_DB),
      queryAll(BANKS_DB),
      queryAll(EXPENSES_DB),
    ]);
  } catch {
    return { ...EMPTY, error: "Couldn't reach the Budget Tracker in Notion. Check sharing/permissions for the integration." };
  }

  // The tracker's own client-debt definition: the "All Time Clients Debt"
  // row(s) relate to exactly the sources that count as client debt. If that
  // table can't be read, fall back to treating every source as in-scope.
  const debtSet = new Set<string>();
  try {
    for (const r of await queryAll(DEBT_DB)) {
      for (const id of await fullRelationIds(r.id, (r.properties || {})["Sources"])) debtSet.add(id);
    }
  } catch {
    /* fall back below */
  }

  const clients = await linkedClients();

  // ---- Per-source payment behaviour from Income rows ----------------------
  type Beh = { onTime: number; late: number; delaySum: number; lastPay: string };
  const behavior = new Map<string, Beh>();
  const overdue: OverduePayment[] = [];
  let collectedThisMonthILS = 0;
  let expectedThisMonthILS = 0;

  // Source id → name/url for overdue rows (filled in the sources pass below,
  // so build a quick lookup first).
  const sourceMeta = new Map<string, { name: string; url: string }>();
  for (const s of sources) {
    sourceMeta.set(String(s.id).replace(/-/g, ""), {
      name: title(s.properties, "Name") || "Untitled",
      url: s.url || "",
    });
  }

  for (const r of incomes) {
    const p = r.properties || {};
    const pay = dateOf(p, "Pay Date");
    const due = dateOf(p, "Due Date");
    const ils = num(p, "ILS");
    const usd = num(p, "USD");
    const srcIds = relIds(p, "Source");
    const clientIds = relIds(p, "Clients Database");

    if (pay && pay >= monthStart && pay <= today) collectedThisMonthILS += ils;
    if (!pay && due && due >= monthStart && due <= `${today.slice(0, 8)}31`) expectedThisMonthILS += ils;

    if (pay && due) {
      const delay = daysBetween(pay, due);
      for (const sid of srcIds) {
        const b = behavior.get(sid) || { onTime: 0, late: 0, delaySum: 0, lastPay: "" };
        if (delay > GRACE_DAYS) {
          b.late++;
          b.delaySum += delay;
        } else {
          b.onTime++;
        }
        if (pay > b.lastPay) b.lastPay = pay;
        behavior.set(sid, b);
      }
    } else if (pay) {
      for (const sid of srcIds) {
        const b = behavior.get(sid) || { onTime: 0, late: 0, delaySum: 0, lastPay: "" };
        if (pay > b.lastPay) b.lastPay = pay;
        behavior.set(sid, b);
      }
    } else if (due && due < today) {
      // Unpaid and past due — currently overdue.
      const sid = srcIds[0];
      const meta = sid ? sourceMeta.get(sid) : undefined;
      const cid = clientIds[0];
      const match = clients.find((c) => c.pageId && c.pageId === cid);
      overdue.push({
        name: title(p, "Name") || "Payment",
        sourceName: meta?.name || "",
        amountLabel: ils ? `${ils.toLocaleString()} ILS` : usd ? `$${usd.toLocaleString()}` : "—",
        dueDate: due,
        daysOverdue: daysBetween(today, due),
        notionUrl: r.url || "",
        clientSlug: match?.slug ?? null,
      });
    }
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ---- Debt leaderboard — only sources in the tracker's client-debt set ----
  const debtors: Debtor[] = [];
  let rawMoneyLeftSum = 0; // raw sum, matching the tracker's Total Debt rollup
  for (const s of sources) {
    if (debtSet.size && !debtSet.has(String(s.id).replace(/-/g, ""))) continue;
    const p = s.properties || {};
    const name = title(p, "Name") || "Untitled";
    // Sign convention in the tracker: Money Left is NEGATIVE when the client
    // owes us (e.g. -2000 = 2,000 ILS of debt). Positive/zero = nothing owed.
    const moneyLeft = numLoose(p, "Money Left");
    rawMoneyLeftSum += moneyLeft;
    const debt = Math.max(0, -moneyLeft);
    let paidPct = numLoose(p, "Paid Percentage") || numLoose(p, "Progress");
    if (paidPct > 0 && paidPct <= 1) paidPct *= 100;
    paidPct = Math.max(0, Math.min(100, Math.round(paidPct)));

    const sid = String(s.id).replace(/-/g, "");
    const b = behavior.get(sid);
    const considered = (b?.onTime || 0) + (b?.late || 0);
    const latePct = considered ? (b!.late / considered) * 100 : 0;
    const beh: DebtorBehavior = !considered
      ? "no-data"
      : latePct === 0
      ? "on-time"
      : latePct < 34
      ? "mostly-on-time"
      : "often-late";

    const clientIds = relIds(p, "Clients Database");
    const match = clients.find((c) => c.pageId && clientIds.includes(c.pageId)) || clients.find((c) => c.name && c.name === name.toLowerCase());

    debtors.push({
      sourceId: sid,
      name,
      notionUrl: s.url || "",
      debt,
      paidPct,
      monthlyFee: num(p, "Monthly Income"),
      allTimePaid: num(p, "Paid Sum ILS"),
      behavior: beh,
      onTime: b?.onTime || 0,
      late: b?.late || 0,
      avgDelayDays: b?.late ? Math.round(b.delaySum / b.late) : 0,
      lastPaymentDate: b?.lastPay || "",
      clientSlug: match?.slug ?? null,
    });
  }
  debtors.sort((a, b) => b.debt - a.debt);

  // ---- Bank accounts -------------------------------------------------------
  const bankAccounts: BankAccount[] = banks.map((b) => {
    const p = b.properties || {};
    const totalIncome = num(p, "Total Income");
    const totalExpenses = num(p, "Total Expenses");
    const starting = num(p, "Starting Balance");
    const formulaBalance = num(p, "Current Balance");
    return {
      name: title(p, "Account Name") || "Account",
      balance: formulaBalance || starting + totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
    };
  });

  let expensesThisMonthILS = 0;
  for (const e of expenses) {
    const p = e.properties || {};
    const dt = dateOf(p, "Date");
    if (dt && dt >= monthStart && dt <= today) expensesThisMonthILS += num(p, "ILS");
  }

  return {
    available: true,
    banks: bankAccounts,
    bankTotal: bankAccounts.reduce((s, b) => s + b.balance, 0),
    debtors,
    // Mirror the tracker's "Total Debt Amount" rollup: raw Money Left summed
    // (clients in credit offset it), sign flipped to read as money owed.
    totalDebt: Math.max(0, -rawMoneyLeftSum),
    overdue,
    overdueTotal: overdue.reduce((s, o) => s + (parseFloat(o.amountLabel.replace(/[^0-9.]/g, "")) || 0), 0),
    collectedThisMonthILS,
    expectedThisMonthILS,
    expensesThisMonthILS,
    syncedAt: new Date().toISOString(),
  };
}

// Cached read — keeps the admin snappy and off Notion's rate limits.
export const getFinance = unstable_cache(
  async () => {
    try {
      return await fetchFinance();
    } catch {
      return { ...EMPTY, error: "Finance sync failed unexpectedly." };
    }
  },
  ["studio-finance"],
  { revalidate: 300, tags: ["finance"] }
);

export function fmtILS(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} ILS`;
}
