// Deliverables helpers — pure, client-safe (NO db/server imports). Types live in
// lib/clients.ts and are pulled in type-only (erased at build), so importing this
// file never drags the DB layer into a client bundle. Holds the rule-based
// suggestion engine plus the shared status maps + progress math.
import type { ClientData, ClientDeliverables, Deliverable, DeliverableStatus } from "@/lib/clients";

// Stable id for a deliverable (crypto.randomUUID where available, else random+time).
export function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Assign ids in memory to any item missing one (non-destructive; persists on save).
export function ensureDeliverableIds(block: ClientDeliverables | undefined | null): ClientDeliverables {
  const b = block ?? {};
  return { ...b, items: (b.items ?? []).map((d) => (d.id ? d : { ...d, id: genId() })) };
}

// ---- Status maps (mirror lib/photo) ----
export const ORDER: DeliverableStatus[] = ["todo", "doing", "review", "done"];
export const LABELS: Record<DeliverableStatus, string> = { todo: "To do", doing: "In progress", review: "In review", done: "Delivered" };
export const BADGES: Record<DeliverableStatus, string> = {
  todo: "text-neutral-600 bg-neutral-100 border-neutral-200",
  doing: "text-amber-700 bg-amber-50 border-amber-200",
  review: "text-sky-700 bg-sky-50 border-sky-200",
  done: "text-emerald-700 bg-emerald-50 border-emerald-200",
};
// Bilingual labels for the client-facing portal.
export const LABELS_AR: Record<DeliverableStatus, string> = { todo: "قيد الانتظار", doing: "قيد التنفيذ", review: "قيد المراجعة", done: "تم التسليم" };

export function progress(items: Deliverable[] | undefined): { done: number; total: number; pct: number } {
  const list = items ?? [];
  const total = list.length;
  const done = list.filter((d) => d.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

// ---- Date helpers ----
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Tolerant parse of the free-text plan/accept dates: ISO ("2026-03-01"), month+year
// ("Feb 2026", "Feb 26", "February 2026"), quarter ("Q2 2026"), or anything Date.parse
// understands. Returns a midnight Date or null.
function parseAnchor(s?: string): Date | null {
  if (!s) return null;
  const str = s.trim();
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const q = str.match(/^Q([1-4])\s*(\d{4})$/i);
  if (q) return new Date(+q[2], (+q[1] - 1) * 3, 1);
  const mn = str.match(/^([A-Za-z]{3,})\.?\s*(\d{2,4})$/);
  if (mn) {
    const mi = MONTHS.indexOf(mn[1].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      let y = +mn[2];
      if (y < 100) y += 2000;
      return new Date(y, mi, 1);
    }
  }
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : new Date(t);
}

const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const addWeeks = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7);
const maxDate = (a: Date, b: Date) => (a > b ? a : b);
const minDate = (a: Date, b: Date) => (a < b ? a : b);
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthLabel = (d: Date) => `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;

// Turn a timeline phase's free-text duration into a week count.
// "Week 1" → 1 · "Weeks 1–3"/"1 to 3" → 3 · "2 weeks" → 2 · "≈1 month" → 4 · fallback 1.
function parseWeeks(text?: string): number {
  if (!text) return 1;
  const t = text.toLowerCase();
  const range = t.match(/(\d+)\s*(?:[–-]|to)\s*(\d+)/);
  if (range) { const a = +range[1], b = +range[2]; if (b >= a) return Math.max(1, b - a + 1); }
  const months = t.match(/(\d+(?:\.\d+)?)\s*month/);
  if (months) return Math.max(1, Math.round(parseFloat(months[1]) * 4));
  if (/month/.test(t)) return 4;
  const weeks = t.match(/(\d+(?:\.\d+)?)\s*week/);
  if (weeks) return Math.max(1, Math.round(parseFloat(weeks[1])));
  if (/week/.test(t)) return 1;
  const bare = t.match(/^\s*(\d+)\s*$/);
  if (bare) return Math.max(1, +bare[1]);
  return 1;
}

// Rule-based suggestions from the plan cycle + proposal timeline. Returns candidates
// (no ids); callers merge non-duplicates via mergeSuggestions. Pure — no DB, no writes.
export function suggestDeliverables(data: ClientData): Deliverable[] {
  const out: Deliverable[] = [];
  const anchor =
    parseAnchor(data.agreement?.acceptedAt) ||
    parseAnchor(data.proposal?.acceptedAt) ||
    parseAnchor(data.plan?.start) ||
    startOfToday();

  // Recurring: one per month over the active cycle, capped to the next 3 months.
  if (data.plan?.active) {
    const now = startOfToday();
    const end = parseAnchor(data.plan?.end);
    const cap = firstOfMonth(addMonths(now, 3));
    const upper = end ? minDate(firstOfMonth(end), cap) : cap;
    const planName = (data.plan?.name || "").trim() || "Monthly delivery";
    let cur = firstOfMonth(maxDate(anchor, now));
    let guard = 0;
    while (cur <= upper && guard++ < 24) {
      const cycle = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      const due = toISO(new Date(cur.getFullYear(), cur.getMonth() + 1, 0)); // last day of month
      out.push({ title: `${planName} — ${monthLabel(cur)}`, due, status: "todo", kind: "recurring", source: "plan", cycle });
      cur = addMonths(cur, 1);
    }
  }

  // Milestones: each timeline phase, due at the end of its (cumulative) duration.
  let acc = 0;
  for (const ph of data.proposal?.timeline || []) {
    if (!ph?.phase) continue;
    acc += parseWeeks(ph.duration);
    out.push({ title: ph.phase, detail: ph.detail, due: toISO(addWeeks(anchor, acc)), status: "todo", kind: "milestone", source: "timeline", phaseKey: ph.phase });
  }
  return out;
}

// Merge suggestions into existing items, skipping ones already present by their
// dedupe key (cycle for recurring, phaseKey for milestones). Re-running is safe.
export function mergeSuggestions(items: Deliverable[], suggestions: Deliverable[]): Deliverable[] {
  const haveCycle = new Set(items.filter((i) => i.cycle).map((i) => i.cycle));
  const havePhase = new Set(items.filter((i) => i.phaseKey).map((i) => i.phaseKey));
  const additions = suggestions
    .filter((s) => (s.cycle ? !haveCycle.has(s.cycle) : s.phaseKey ? !havePhase.has(s.phaseKey) : true))
    .map((s) => ({ ...s, id: genId() }));
  return [...items, ...additions];
}
