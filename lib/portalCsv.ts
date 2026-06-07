// Portal content <-> CSV. The CSV is a flat "field, en, ar, value" table so it
// can be filled in any spreadsheet (or pasted into any AI and filled there),
// then uploaded to populate the portal form. Bilingual fields use the en/ar
// columns; everything else uses the value column. Repeatable items are indexed
// with [n] — add more rows to add cards, campaigns, invoices, etc.
import type { ClientData } from "@/lib/clients";

// Scalar fields that carry English + Arabic (no arrays among these).
const BILINGUAL = new Set([
  "hero",
  "plan.note",
  "dashboard.headline",
  "dashboard.diagnosis",
  "social.headline",
  "analysis.organic.headline",
  "analysis.organic.reading",
  "analysis.paid.note",
]);

function esc(s: string): string {
  const v = s ?? "";
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function rowOf(field: string, en: string, ar: string, value: string): string {
  return [field, en, ar, value].map(esc).join(",");
}

// ---- Export -------------------------------------------------------------

export function toCSV(d: ClientData): string {
  const rows: string[] = ["field,en,ar,value"];
  const bi = (path: string, v?: { en: string; ar: string }) => rows.push(rowOf(path, v?.en ?? "", v?.ar ?? "", ""));
  const val = (path: string, v?: string | number | boolean) =>
    rows.push(rowOf(path, "", "", v === undefined || v === null ? "" : String(v)));

  bi("hero", d.hero);
  val("accent", d.accent);
  val("plan.name", d.plan?.name);
  val("plan.active", d.plan?.active);
  val("plan.start", d.plan?.start);
  val("plan.end", d.plan?.end);
  val("plan.notionUrl", d.plan?.notionUrl);
  bi("plan.note", d.plan?.note);

  bi("dashboard.headline", d.dashboard?.headline);
  bi("dashboard.diagnosis", d.dashboard?.diagnosis);
  const cards = d.dashboard?.cards?.length ? d.dashboard.cards : [{ tag: "", value: "", desc: "" }];
  cards.forEach((c, i) => {
    val(`dashboard.cards[${i}].tag`, c.tag);
    val(`dashboard.cards[${i}].value`, c.value);
    val(`dashboard.cards[${i}].desc`, c.desc);
  });
  const vitals = d.dashboard?.vitals?.length ? d.dashboard.vitals : [{ label: "", pct: 0, note: "" }];
  vitals.forEach((v, i) => {
    val(`dashboard.vitals[${i}].label`, v.label);
    val(`dashboard.vitals[${i}].pct`, v.pct);
    val(`dashboard.vitals[${i}].note`, v.note);
  });

  bi("social.headline", d.social?.headline);
  const items = d.social?.items?.length ? d.social.items : [{ title: "", desc: "", tag: "" }];
  items.forEach((s, i) => {
    val(`social.items[${i}].title`, s.title);
    val(`social.items[${i}].desc`, s.desc);
    val(`social.items[${i}].tag`, s.tag ?? "");
  });

  bi("analysis.organic.headline", d.analysis?.organic?.headline);
  bi("analysis.organic.reading", d.analysis?.organic?.reading);
  const metrics = d.analysis?.organic?.metrics?.length ? d.analysis.organic.metrics : [{ label: "", before: "", after: "", note: "" }];
  metrics.forEach((m, i) => {
    val(`analysis.organic.metrics[${i}].label`, m.label);
    val(`analysis.organic.metrics[${i}].before`, m.before);
    val(`analysis.organic.metrics[${i}].after`, m.after);
    val(`analysis.organic.metrics[${i}].note`, m.note);
  });

  val("analysis.paid.spend", d.analysis?.paid?.spend);
  bi("analysis.paid.note", d.analysis?.paid?.note);
  const camps = d.analysis?.paid?.campaigns?.length
    ? d.analysis.paid.campaigns
    : [{ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" }];
  const campKeys = ["name", "period", "type", "spend", "reach", "impressions", "freq", "cpm", "desc"] as const;
  camps.forEach((c, i) => campKeys.forEach((k) => val(`analysis.paid.campaigns[${i}].${k}`, c[k])));

  const invs = d.invoices?.length ? d.invoices : [{ cycle: "", desc: "", amount: "", status: "due" as const }];
  invs.forEach((inv, i) => {
    val(`invoices[${i}].cycle`, inv.cycle);
    val(`invoices[${i}].desc`, inv.desc);
    val(`invoices[${i}].amount`, inv.amount);
    val(`invoices[${i}].status`, inv.status);
  });

  const docs = d.documents?.length ? d.documents : [{ title: "", type: "", url: "" }];
  docs.forEach((doc, i) => {
    val(`documents[${i}].title`, doc.title);
    val(`documents[${i}].type`, doc.type);
    val(`documents[${i}].url`, doc.url);
  });

  return "﻿" + rows.join("\r\n"); // BOM so Excel reads Arabic correctly
}

// ---- Import -------------------------------------------------------------

function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* skip */ }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); out.push(row); }
  return out;
}

function emptyData(): ClientData {
  return {
    hero: { en: "", ar: "" },
    accent: "",
    plan: { name: "", active: true, start: "", end: "", notionUrl: "", note: { en: "", ar: "" } },
    dashboard: { headline: { en: "", ar: "" }, diagnosis: { en: "", ar: "" }, cards: [], vitals: [] },
    social: { headline: { en: "", ar: "" }, items: [] },
    analysis: {
      organic: { headline: { en: "", ar: "" }, reading: { en: "", ar: "" }, metrics: [] },
      paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] },
    },
    invoices: [],
    documents: [],
  };
}

function tokens(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const seg of path.split(".")) {
    const re = /([^[\]]+)|\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      out.push(m[2] !== undefined ? Number(m[2]) : m[1]);
    }
  }
  return out;
}

function setPath(obj: Record<string, unknown>, path: string, en: string, ar: string, value: string) {
  const toks = tokens(path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let o: any = obj;
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i];
    if (o[t] == null) o[t] = typeof toks[i + 1] === "number" ? [] : {};
    o = o[t];
  }
  const last = toks[toks.length - 1];
  if (BILINGUAL.has(path)) o[last] = { en, ar };
  else if (path.endsWith(".pct")) o[last] = Math.max(0, Math.min(100, Number(value) || 0));
  else if (path === "plan.active") o[last] = /^(true|yes|1|نعم|نشط|active)$/i.test(value.trim());
  else if (path.endsWith(".status")) o[last] = ["paid", "due", "overdue"].includes(value.trim()) ? value.trim() : "due";
  else o[last] = value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pruneArrays(d: any): ClientData {
  const has = (o: Record<string, unknown>, keys: string[]) => keys.some((k) => String(o?.[k] ?? "").trim() !== "");
  const clean = <T extends Record<string, unknown>>(arr: T[] | undefined, keys: string[]) =>
    (arr ?? []).filter((x) => x && has(x, keys));
  d.dashboard.cards = clean(d.dashboard.cards, ["tag", "value", "desc"]);
  d.dashboard.vitals = clean(d.dashboard.vitals, ["label", "note"]);
  d.social.items = clean(d.social.items, ["title", "desc", "tag"]);
  d.analysis.organic.metrics = clean(d.analysis.organic.metrics, ["label", "before", "after", "note"]);
  d.analysis.paid.campaigns = clean(d.analysis.paid.campaigns, ["name", "period", "spend", "reach", "desc"]);
  d.invoices = clean(d.invoices, ["cycle", "desc", "amount"]);
  d.documents = clean(d.documents, ["title", "url"]);
  return d as ClientData;
}

export function fromCSV(text: string): ClientData {
  const rows = parseCSV(text).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  const data = emptyData() as unknown as Record<string, unknown>;
  for (const r of rows) {
    const [field, en = "", ar = "", value = ""] = r;
    const f = (field || "").trim();
    if (!f || f === "field") continue; // header / blank
    setPath(data, f, en, ar, value);
  }
  return pruneArrays(data);
}
