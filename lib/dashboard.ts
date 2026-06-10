// Admin dashboard — aggregates studio-wide numbers from the existing tables
// (invoices, clients, inquiries, applications, projects) into one snapshot.
// Every read tolerates a missing table / no DB so the dashboard always renders.
import { getSql, isDbEnabled } from "@/lib/db";
import { invoiceGrandTotal, invoiceRemaining, type Invoice } from "@/lib/invoices";
import { type ClientData } from "@/lib/clients";
import { type Inquiry } from "@/lib/inquiries";

export type MonthBar = {
  label: string; // "Jan"
  billed: number; // grand total of invoices issued that month
  collected: number; // paid_amount across those invoices
};

export type AttentionItem = {
  kind: "overdue" | "due-soon" | "pending-client" | "proposal" | "agreement" | "inquiries" | "applications";
  text: string;
  href: string;
  count?: number;
};

export type ClientPulse = {
  slug: string;
  name: string;
  color: string;
  planName: string;
  active: boolean;
  pending: boolean;
};

export type DashboardData = {
  dbOff: boolean;
  needsSetup: boolean;
  // KPIs
  outstanding: number; // still owed across due/partial invoices
  overdueCount: number;
  overdueTotal: number;
  collectedYear: number; // paid across invoices issued this calendar year
  thisMonthBilled: number;
  thisMonthCollected: number;
  activeClients: number;
  totalClients: number;
  unreadInquiries: number;
  unreadApplications: number;
  projectCount: number;
  // Sections
  months: MonthBar[]; // last 6 months, oldest first
  attention: AttentionItem[];
  recentInquiries: Inquiry[];
  recentInvoices: Invoice[];
  clients: ClientPulse[];
  invoiceStatusCounts: { draft: number; due: number; partial: number; paid: number };
};

const EMPTY: DashboardData = {
  dbOff: true,
  needsSetup: false,
  outstanding: 0,
  overdueCount: 0,
  overdueTotal: 0,
  collectedYear: 0,
  thisMonthBilled: 0,
  thisMonthCollected: 0,
  activeClients: 0,
  totalClients: 0,
  unreadInquiries: 0,
  unreadApplications: 0,
  projectCount: 0,
  months: [],
  attention: [],
  recentInquiries: [],
  recentInvoices: [],
  clients: [],
  invoiceStatusCounts: { draft: 0, due: 0, partial: 0, paid: 0 },
};

type ClientRow = { id: number; slug: string; name: string; color: string; data: ClientData };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!isDbEnabled()) return { ...EMPTY, months: emptyMonths() };
  const sql = getSql();

  // If the core table is missing the install hasn't been set up yet.
  const ready = await safe(async () => {
    await sql`SELECT 1 FROM users LIMIT 1`;
    return true;
  }, false);
  if (!ready) return { ...EMPTY, dbOff: false, needsSetup: true, months: emptyMonths() };

  const [invoices, clients, inquiries, unreadApps, projectCount, unreadInquiries] = await Promise.all([
    safe(
      async () =>
        (await sql`
          SELECT id, number, client_id, client_slug, issued_date, due_date, items, note, status, source, vat_rate, paid_amount, created_at
          FROM invoices ORDER BY created_at DESC LIMIT 500
        `) as unknown as Invoice[],
      [] as Invoice[]
    ),
    safe(
      async () => (await sql`SELECT id, slug, name, color, data FROM clients ORDER BY updated_at DESC`) as unknown as ClientRow[],
      [] as ClientRow[]
    ),
    safe(
      async () =>
        (await sql`
          SELECT id, name, email, phone, brand, service, message, lang, created_at, read_at
          FROM inquiries ORDER BY created_at DESC LIMIT 6
        `) as unknown as Inquiry[],
      [] as Inquiry[]
    ),
    safe(async () => {
      const r = (await sql`SELECT count(*)::int AS n FROM applications WHERE read_at IS NULL`) as unknown as { n: number }[];
      return r[0]?.n ?? 0;
    }, 0),
    safe(async () => {
      const r = (await sql`SELECT count(*)::int AS n FROM projects`) as unknown as { n: number }[];
      return r[0]?.n ?? 0;
    }, 0),
    safe(async () => {
      const r = (await sql`SELECT count(*)::int AS n FROM inquiries WHERE read_at IS NULL`) as unknown as { n: number }[];
      return r[0]?.n ?? 0;
    }, 0),
  ]);

  // ---- Invoice money math -------------------------------------------------
  const now = new Date();
  const thisYear = now.getFullYear();
  const soonCutoff = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  let outstanding = 0;
  let overdueTotal = 0;
  let collectedYear = 0;
  let thisMonthBilled = 0;
  let thisMonthCollected = 0;
  const statusCounts = { draft: 0, due: 0, partial: 0, paid: 0 };
  const months = emptyMonths();
  const overdue: Invoice[] = [];
  const dueSoon: { inv: Invoice; remaining: number }[] = [];

  for (const inv of invoices) {
    if (inv.archived_at) continue;
    const vat = Number(inv.vat_rate) || 0;
    const paid = Number(inv.paid_amount) || 0;
    const grand = invoiceGrandTotal(inv.items, vat);
    const issued = new Date(inv.issued_date);

    if (inv.status === "due" || inv.status === "partial") {
      const remaining = invoiceRemaining(inv.items, vat, paid);
      outstanding += remaining;
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        if (due < now) {
          overdue.push(inv);
          overdueTotal += remaining;
        } else if (due <= soonCutoff) {
          dueSoon.push({ inv, remaining });
        }
      }
    }
    if (issued.getFullYear() === thisYear) collectedYear += paid;
    if (issued.getFullYear() === thisYear && issued.getMonth() === now.getMonth()) {
      thisMonthBilled += grand;
      thisMonthCollected += paid;
    }
    if (inv.status in statusCounts) statusCounts[inv.status as keyof typeof statusCounts]++;

    const idx = monthIndex(issued, now);
    if (idx >= 0 && idx < 6) {
      months[idx].billed += grand;
      months[idx].collected += paid;
    }
  }
  dueSoon.sort((a, b) => (a.inv.due_date! < b.inv.due_date! ? -1 : 1));

  // ---- Client pipeline ----------------------------------------------------
  const pulses: ClientPulse[] = clients.map((c) => ({
    slug: c.slug,
    name: c.name || c.slug,
    color: c.color || "#303030",
    planName: c.data?.plan?.name || "",
    active: !!c.data?.plan?.active && c.data?.status !== "pending",
    pending: c.data?.status === "pending",
  }));
  const pendingClients = pulses.filter((p) => p.pending);
  const activeClients = pulses.filter((p) => p.active).length;

  const proposalsAwaiting = clients.filter(
    (c) => c.data?.proposal?.published && !c.data?.proposal?.acceptedAt
  );
  const agreementsAwaiting = clients.filter(
    (c) => c.data?.agreement?.published && !c.data?.agreement?.acceptedAt
  );

  // ---- "Needs attention" feed --------------------------------------------
  const attention: AttentionItem[] = [];
  if (overdue.length) {
    attention.push({
      kind: "overdue",
      text: `${overdue.length} invoice${overdue.length === 1 ? " is" : "s are"} past due — ${fmtMoney(overdueTotal)} outstanding`,
      href: "/admin/invoices?f=overdue",
      count: overdue.length,
    });
  }
  for (const { inv, remaining } of dueSoon.slice(0, 3)) {
    const days = Math.max(0, Math.ceil((new Date(inv.due_date!).getTime() - now.getTime()) / (24 * 3600 * 1000)));
    attention.push({
      kind: "due-soon",
      text: `${inv.number} (/${inv.client_slug}) — ${fmtMoney(remaining)} due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`,
      href: "/admin/invoices?f=due",
    });
  }
  for (const c of pendingClients.slice(0, 3)) {
    attention.push({
      kind: "pending-client",
      text: `${c.name} signed up via onboarding — review the brief`,
      href: `/admin/clients/${c.slug}/edit`,
    });
  }
  if (proposalsAwaiting.length) {
    attention.push({
      kind: "proposal",
      text: `${proposalsAwaiting.length} proposal${proposalsAwaiting.length === 1 ? "" : "s"} sent, awaiting client acceptance`,
      href: "/admin/proposals",
      count: proposalsAwaiting.length,
    });
  }
  if (agreementsAwaiting.length) {
    attention.push({
      kind: "agreement",
      text: `${agreementsAwaiting.length} agreement${agreementsAwaiting.length === 1 ? "" : "s"} out for signature`,
      href: "/admin/agreements",
      count: agreementsAwaiting.length,
    });
  }
  if (unreadInquiries) {
    attention.push({
      kind: "inquiries",
      text: `${unreadInquiries} unread inquir${unreadInquiries === 1 ? "y" : "ies"}`,
      href: "/admin/inquiries",
      count: unreadInquiries,
    });
  }
  if (unreadApps) {
    attention.push({
      kind: "applications",
      text: `${unreadApps} unread job application${unreadApps === 1 ? "" : "s"}`,
      href: "/admin/applications",
      count: unreadApps,
    });
  }

  return {
    dbOff: false,
    needsSetup: false,
    outstanding,
    overdueCount: overdue.length,
    overdueTotal,
    collectedYear,
    thisMonthBilled,
    thisMonthCollected,
    activeClients,
    totalClients: pulses.length,
    unreadInquiries,
    unreadApplications: unreadApps,
    projectCount,
    months,
    attention,
    recentInquiries: inquiries,
    recentInvoices: invoices.slice(0, 5),
    clients: pulses.slice(0, 8),
    invoiceStatusCounts: statusCounts,
  };
}

// Index 0..5 = five months ago .. this month; -1 when outside the window.
function monthIndex(d: Date, now: Date): number {
  const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return diff >= 0 && diff < 6 ? 5 - diff : -1;
}

function emptyMonths(): MonthBar[] {
  const now = new Date();
  const out: MonthBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), billed: 0, collected: 0 });
  }
  return out;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}
