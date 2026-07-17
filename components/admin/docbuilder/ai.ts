// AI fill for the document builders — mirrors the copy-prompt → paste-reply
// workflow used for analytics & the social calendar (editor tabs), but over the
// whole ProposalDoc / AgreementDoc JSON: copy one prompt, hand it to ChatGPT /
// Claude together with any raw material (brief, old proposal HTML, notes),
// paste the returned JSON back and the entire document fills in one apply.

import type { ClientData, OnboardingBrief } from "@/lib/clients";
import type { AgreementDoc, ProposalDoc } from "@/lib/docs";

// Human-readable summary of the onboarding brief, embedded in the prompt so
// the AI already knows the client without any extra pasting.
export function briefText(name: string, brief?: OnboardingBrief): string {
  if (!brief) return `Client name: ${name}. (No onboarding brief on file — use the material pasted below.)`;
  const row = (label: string, v?: string | string[] | boolean) => {
    const s = Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v;
    return s ? `${label}: ${s}` : "";
  };
  return [
    row("Client / brand", brief.brandName || name),
    row("Contact", `${brief.firstName} ${brief.lastName}`.trim()),
    row("Location", brief.location),
    row("Description", brief.brandDescription),
    row("Products / services", brief.products),
    row("Business goals", brief.businessGoals),
    row("Audience", [...(brief.audienceGender || []), ...(brief.audienceAge || [])]),
    row("Competitors", brief.competitors),
    row("Online presence", brief.onlinePresence),
    row("Branding package picked", brief.plan),
    row("Branding features", brief.planFeatures),
    row("Marketing package picked", brief.marketingPlan),
    row("Marketing features", brief.marketingFeatures),
    row("Other services picked", brief.services),
    row("Tagline", brief.tagline),
    row("Notes", brief.additionalNotes),
    row("Preferred language", brief.lang === "ar" ? "Arabic" : "English"),
  ]
    .filter(Boolean)
    .join("\n");
}

// Summary of the packages agreed on the proposal — the selection the client
// confirmed on acceptance when there is one, else the plans pre-selected on
// the proposal document, else the legacy itemised quote. Embedded in the
// agreement prompt so the AI names the real packages and prices.
export function proposalPackagesText(data?: ClientData): string {
  const p = data?.proposal;
  const doc = p?.doc;
  const per = (period: "mo" | "once") => (period === "mo" ? "/ month" : "one-time");

  // Selection items only carry the plan title (in whichever language the
  // client was viewing) — match back to the proposal's plans for features.
  const plans = doc?.investment?.groups?.flatMap((g) => g.plans) || [];
  const featuresOf = (plan?: { features: { en: string; ar: string }[] }) =>
    (plan?.features || []).map((f) => f.en || f.ar).filter(Boolean).map((f) => `  · ${f}`);

  const lines: string[] = [];
  const sel = p?.selection;
  if (sel?.items?.length) {
    const when = p?.acceptedAt ? ` (accepted ${p.acceptedAt.slice(0, 10)}${p.acceptedBy ? ` by ${p.acceptedBy}` : ""})` : "";
    lines.push(`Packages the client CONFIRMED on the proposal${when}:`);
    for (const it of sel.items) {
      lines.push(`- ${it.label} — ${it.price} ${sel.currency} ${per(it.period)}`);
      lines.push(...featuresOf(plans.find((pl) => pl.title.en === it.label || pl.title.ar === it.label)));
    }
    if (sel.monthly) lines.push(`Monthly total: ${sel.monthly} ${sel.currency} / month`);
    if (sel.once) lines.push(`One-time total: ${sel.once} ${sel.currency}`);
    return lines.join("\n");
  }
  const preselected = plans.filter((pl) => pl.selected);
  if (preselected.length) {
    lines.push("Packages pre-selected on the proposal (the client has not accepted it yet):");
    for (const pl of preselected) {
      lines.push(`- ${pl.title.en || pl.title.ar} — ${pl.price} ${doc?.currency || "₪"} ${per(pl.period)}`);
      lines.push(...featuresOf(pl));
    }
    return lines.join("\n");
  }
  const pricing = data?.pricing?.items?.filter((it) => it.label) || [];
  if (pricing.length) {
    lines.push("Itemised quote on file:");
    for (const it of pricing) lines.push(`- ${it.label}${it.amount ? ` — ${it.amount}` : ""}`);
  }
  return lines.join("\n");
}

const SHARED_RULES = `Rules:
- Output ONLY the JSON document — no commentary, no markdown fences, nothing before or after it.
- The reply must be STRICTLY valid JSON. Never put an unescaped double quote (") inside a string value — write \\" or use “ ”, « » or ' instead. Line breaks inside a string must be written \\n, never a literal line break.
- Keep the same structure and key names. Keep "theme" and "docId" unchanged.
- If the full document would make your reply too long, you may return a PARTIAL document containing only the keys you changed — omitted keys keep their current value. Never stop in the middle of the JSON; close every bracket.
- Every { "en": …, "ar": … } pair must have BOTH languages filled — natural, fluent Arabic (not a literal translation).
- In any text you may wrap one key phrase in *single stars* for the brand accent colour, and **double stars** for bold. Use them sparingly, like a designer would.
- In multi-line title fields, a \\n splits display lines.
- You may add or remove items inside arrays (paragraphs, cards, bullets, phases, plans, features, sections) so the document fits this client — but keep each item's shape identical to its siblings.`;

export function proposalAiPrompt(doc: ProposalDoc, clientName: string, brief: string): string {
  return `You are writing a client proposal for Marker Studio® — a bilingual (English + Arabic) creative branding & marketing studio in Beit Sahour, Palestine. Voice: warm, clear, confident; care made visible; no buzzword filler.

The proposal is stored as a JSON document and rendered as a paged A4 file (cover → overview → the project → scope → work plan → investment → why Marker → acceptance).

Rewrite the JSON below so every line speaks specifically about THIS client. Replace all generic template copy.

${SHARED_RULES}
- "cover.title": the client's name split over lines, with the accent on part of it (e.g. "Catherine\\n*Qubrusi*").
- "cover.meta": fill Field/Scope with the client's real field and scope; keep the Date value as it is.
- "understanding.cards": real strengths / challenges / audience for this client, each bullet starting with a short **bold** lead-in.
- "workplan.phases[].cells": one number per week column — 0 = empty, 1 = solid bar, 2 = light bar. Make the bars overlap like a believable schedule, and set "workplan.weeks" to the number of columns.
- "investment.groups": realistic plans for this client. "price" is a number only (the currency symbol is separate). "period" is "mo" (monthly) or "once" (one-time). "mode": "single" = the client picks exactly one (keep exactly one plan "selected": true); "multi" = pick any. "badge" like Recommended on at most one plan, otherwise { "en": "", "ar": "" }.
- Keep contact details, team names and stats real if they're already filled; refine wording only.

=== CLIENT MATERIAL (brief, old proposal, meeting notes — use everything) ===
${brief}

[paste any extra material here — an old proposal HTML, pricing notes, call summary…]

=== JSON DOCUMENT TO REWRITE ===
${JSON.stringify(doc, null, 1)}`;
}

export function agreementAiPrompt(doc: AgreementDoc, clientName: string, brief: string, packages = ""): string {
  return `You are preparing a service agreement for Marker Studio® — a bilingual (English + Arabic) creative studio in Beit Sahour, Palestine. The agreement is stored as a JSON document and rendered as a paged A4 contract (cover → summary → numbered terms → signature page).

Personalise the JSON below for THIS client. The numbered terms are the studio's standard contract: keep their legal meaning intact — adjust only client-specific details (parties, purpose, scope of work, package names, payment schedule) and improve the Arabic where it reads stiffly.

${SHARED_RULES}
- "summary.rows": fill Client, Representative, Agreement value and Package confirmation with the client's real details.
- The "Parties", "Project Purpose" and "Agreed Scope of Work" sections must name the client and list the actual agreed deliverables.
- Build the Package cover box, "Package confirmation", "Agreed Scope of Work" and the payment schedule from the packages agreed on the proposal (listed below) — use their exact names, deliverables and prices.
- "schedule": if the material includes agreed pricing, set "enabled": true and list the payment lines (label + amount as written, e.g. "2,500 ₪"); otherwise leave "enabled": false.
- Do NOT weaken or remove protective clauses (revisions, exclusions, ownership, cancellation).

=== PACKAGES AGREED ON THE PROPOSAL ===
${packages || "(No proposal selection on file — take the package names and pricing from the material below.)"}

=== CLIENT MATERIAL (brief, accepted proposal, pricing — use everything) ===
${brief}

[paste any extra material here — the accepted proposal, package details, agreed totals…]

=== JSON DOCUMENT TO REWRITE ===
${JSON.stringify(doc, null, 1)}`;
}

// Parse the AI reply — very tolerant. Strips code fences and prose around the
// JSON, removes trailing commas, escapes unescaped quotes / line breaks inside
// string values, repairs truncated replies (unterminated strings / unclosed
// brackets), and falls back to progressively cutting the tail until something
// parses. A partial document is fine — mergeAiDoc overlays it on the current
// one, so omitted keys keep their value.
export function parseAiDoc<T>(raw: string): T | null {
  let s = (raw || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (fence && fence[1].trim().length > s.length * 0.5) s = fence[1].trim();
  const a = s.indexOf("{");
  if (a < 0) return null;
  s = s.slice(a);
  const b = s.lastIndexOf("}");
  const full = b > 0 ? s.slice(0, b + 1) : s;

  const noTrailingCommas = (x: string) => x.replace(/,\s*([}\]])/g, "$1");
  const attempt = (x: string): T | null => {
    try {
      const d = JSON.parse(x);
      return d && typeof d === "object" && !Array.isArray(d) ? (d as T) : null;
    } catch {
      return null;
    }
  };

  // 1) as-is, then with trailing commas stripped, then with in-string quotes
  //    and line breaks escaped, then bracket-repaired.
  for (const c of [
    full,
    noTrailingCommas(full),
    noTrailingCommas(repairStrings(full)),
    noTrailingCommas(repairJson(s)),
    noTrailingCommas(repairJson(repairStrings(s))),
  ]) {
    const d = attempt(c);
    if (d) return d;
  }
  // 2) progressively drop the (likely truncated) tail back to the previous
  //    complete value, repairing and retrying each time.
  let cur = s;
  for (let i = 0; i < 60 && cur.length > 2; i++) {
    const cutAt = Math.max(
      cur.lastIndexOf("}", cur.length - 2),
      cur.lastIndexOf("]", cur.length - 2),
      cur.lastIndexOf('"', cur.length - 2)
    );
    if (cutAt <= 0) break;
    cur = cur.slice(0, cutAt + 1);
    const d = attempt(noTrailingCommas(repairJson(cur))) || attempt(noTrailingCommas(repairJson(repairStrings(cur))));
    if (d) return d;
  }
  return null;
}

// AI replies often carry unescaped double quotes inside string values —
// e.g. `"فلسطين ("الاستوديو")، و…"` — which is invalid JSON. Walk the string:
// inside a value, a `"` only closes it when the next non-space character
// continues the JSON (`,` `:` `}` `]` or end of input); any other `"` is
// content and gets escaped. Literal line breaks / tabs inside a string are
// escaped too. Heuristic — used as an extra parse attempt, never on its own.
function repairStrings(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    if (esc) {
      esc = false;
      out += ch;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      out += ch;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      const closes = j >= s.length || s[j] === "," || s[j] === ":" || s[j] === "}" || s[j] === "]";
      if (closes) inStr = false;
      out += closes ? ch : '\\"';
    } else if (ch === "\n") {
      out += "\\n";
    } else if (ch === "\r") {
      // dropped — \n (if any) follows
    } else if (ch === "\t") {
      out += "\\t";
    } else {
      out += ch;
    }
  }
  return out;
}

// Best-effort close of a truncated JSON string: terminate an open string,
// finish a dangling `"key":` with an empty value, drop a dangling comma, then
// close every bracket that's still open.
function repairJson(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack[stack.length - 1] === ch) stack.pop();
    }
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  out = out.replace(/:\s*$/, ': ""');
  while (stack.length) out += stack.pop();
  return out;
}

// ---- normalization — AI replies can drop keys inside array items; fill them
// back with safe defaults so the renderer never sees a hole. ----
type Lx = { en: string; ar: string };
const L = (v?: Partial<Lx> | null): Lx => ({ en: String(v?.en ?? ""), ar: String(v?.ar ?? "") });
const S = (v: unknown): string => (v == null ? "" : String(v));
const N = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeProposalDoc(d: ProposalDoc): ProposalDoc {
  d.cover.meta = arr<{ label?: Lx; value?: Lx }>(d.cover.meta).map((m) => ({ label: L(m?.label), value: L(m?.value) }));
  d.overview.paras = arr<Lx>(d.overview.paras).map((p) => L(p));
  d.overview.stats = arr<{ n?: Lx; d?: Lx }>(d.overview.stats).map((s) => ({ n: L(s?.n), d: L(s?.d) }));
  d.overview.team = arr<{ name?: string; role?: Lx }>(d.overview.team).map((t) => ({ name: S(t?.name), role: L(t?.role) }));
  d.understanding.cards = arr<{ no?: string; title?: Lx; sub?: Lx; bullets?: Lx[] }>(d.understanding.cards).map((c, i) => ({
    no: S(c?.no) || `2.${i + 1}`,
    title: L(c?.title),
    sub: L(c?.sub),
    bullets: arr<Lx>(c?.bullets).map((b) => L(b)),
  }));
  d.scope.cards = arr<{ no?: string; flag?: Lx; title?: Lx; sub?: Lx; desc?: Lx; bullets?: Lx[] }>(d.scope.cards).map((c, i) => ({
    no: S(c?.no) || String(i + 1).padStart(2, "0"),
    flag: L(c?.flag),
    title: L(c?.title),
    sub: L(c?.sub),
    desc: L(c?.desc),
    bullets: arr<Lx>(c?.bullets).map((b) => L(b)),
  }));
  d.workplan.weeks = Math.max(1, Math.min(12, Math.round(N(d.workplan.weeks) || 6)));
  d.workplan.phases = arr<{ name?: Lx; alt?: Lx; cells?: unknown[] }>(d.workplan.phases).map((p) => {
    const cells = arr<unknown>(p?.cells).map((c) => [0, 1, 2].includes(Number(c)) ? Number(c) : 0);
    while (cells.length < d.workplan.weeks) cells.push(0);
    cells.length = d.workplan.weeks;
    return { name: L(p?.name), alt: L(p?.alt), cells };
  });
  d.workplan.foot = arr<{ label?: Lx; value?: Lx }>(d.workplan.foot).map((f) => ({ label: L(f?.label), value: L(f?.value) }));
  d.investment.groups = arr<{ title?: Lx; sub?: Lx; mode?: string; plans?: unknown[] }>(d.investment.groups).map((g, gi) => ({
    title: L(g?.title),
    sub: L(g?.sub),
    mode: g?.mode === "multi" ? "multi" : "single",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plans: arr<any>(g?.plans).map((p, pi) => ({
      key: S(p?.key) || `plan-${gi}-${pi}`,
      title: L(p?.title),
      sub: L(p?.sub),
      desc: L(p?.desc),
      features: arr<Lx>(p?.features).map((f) => L(f)),
      price: N(p?.price),
      oldPrice: N(p?.oldPrice) || undefined,
      period: p?.period === "once" ? ("once" as const) : ("mo" as const),
      badge: L(p?.badge),
      selected: !!p?.selected,
    })),
  }));
  // single-mode groups must keep exactly one pre-selected plan
  for (const g of d.investment.groups) {
    if (g.mode === "single" && g.plans.length && !g.plans.some((p) => p.selected)) g.plans[0].selected = true;
  }
  d.why.paras = arr<Lx>(d.why.paras).map((p) => L(p));
  d.acceptance.terms = arr<Lx>(d.acceptance.terms).map((t) => L(t));
  return d;
}

export function normalizeAgreementDoc(d: AgreementDoc): AgreementDoc {
  d.cover.meta = arr<{ label?: Lx; value?: Lx }>(d.cover.meta).map((m) => ({ label: L(m?.label), value: L(m?.value) }));
  d.summary.rows = arr<{ label?: Lx; value?: Lx }>(d.summary.rows).map((r) => ({ label: L(r?.label), value: L(r?.value) }));
  d.schedule.items = arr<{ label?: Lx; amount?: string }>(d.schedule.items).map((it) => ({ label: L(it?.label), amount: S(it?.amount) }));
  d.schedule.enabled = !!d.schedule.enabled;
  d.sections = arr<{ title?: Lx; body?: Lx[]; list?: Lx[] }>(d.sections).map((s) => ({
    title: L(s?.title),
    body: arr<Lx>(s?.body).map((b) => L(b)),
    list: arr<Lx>(s?.list).map((b) => L(b)),
  }));
  return d;
}

// Overlay the AI's document on the current one so a missing key can never
// break the renderer: objects merge recursively, arrays and primitives are
// taken from the AI when present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeAiDoc<T>(base: T, ai: any): T {
  if (ai === undefined || ai === null) return base;
  if (Array.isArray(base) || Array.isArray(ai)) return (Array.isArray(ai) ? ai : base) as T;
  if (typeof base === "object" && base !== null && typeof ai === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(base as Record<string, unknown>)) {
      out[k] = mergeAiDoc((base as Record<string, unknown>)[k], ai[k]);
    }
    return out as T;
  }
  return (typeof ai === typeof base ? ai : base) as T;
}
