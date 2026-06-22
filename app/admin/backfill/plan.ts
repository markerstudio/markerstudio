// One-off retroactive backfill of the 2026 stories payments collected for Ramzi.
// Plain data + helpers (no "use server"), shared by the preview page and the
// apply action. These are RAMZI's stories collections only — never Marker income
// and never synced to Notion. Safe to delete this folder once the backfill ran.

export type BackfillEntry = {
  name: string;
  slug?: string; // pin to an existing client when the name is ambiguous
  fee: number; // ILS per cycle
  dates: string[]; // "YYYY-MM-DD" — one received payment per cycle
};

// Cycles already paid (received). Open/unpaid cycles are intentionally NOT here:
// Al Qanater's outstanding cycle is already covered by an existing Marker invoice.
export const STORIES_BACKFILL_2026: BackfillEntry[] = [
  { name: "You Burger", fee: 650, dates: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"] },
  { name: "You Booza", fee: 650, dates: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"] },
  { name: "Tamashi", fee: 700, dates: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"] },
  { name: "Gardenia", fee: 700, dates: ["2026-03-26", "2026-04-26", "2026-05-26"] },
  { name: "Al Qanater", fee: 1000, dates: ["2026-03-14", "2026-04-14"] },
  { name: "Jack Sabat", slug: "jack-sabat", fee: 800, dates: ["2026-03-26", "2026-04-26"] },
  { name: "Blok", fee: 800, dates: ["2026-06-02"] },
];

// "YYYY-MM" from a date string or Date (local parts; tolerant of driver types).
export function ymKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 7);
  const d = v instanceof Date ? v : new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Dedup key: a stories payment is "the same" if it's the same client, month and
// amount — so a cycle already registered (even on a slightly different day) is
// skipped rather than duplicated.
export function dedupKey(ym: string, amount: number): string {
  return `${ym}|${Math.round(amount)}`;
}

export function monthLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
