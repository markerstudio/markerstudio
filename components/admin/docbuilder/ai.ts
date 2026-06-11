// AI fill for the document builders — mirrors the copy-prompt → paste-reply
// workflow used for analytics & the social calendar (ClientForm), but over the
// whole ProposalDoc / AgreementDoc JSON: copy one prompt, hand it to ChatGPT /
// Claude together with any raw material (brief, old proposal HTML, notes),
// paste the returned JSON back and the entire document fills in one apply.

import type { OnboardingBrief } from "@/lib/clients";
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

const SHARED_RULES = `Rules:
- Output ONLY the JSON document — no commentary, no markdown fences, nothing before or after it.
- Keep the exact same structure and keys. Keep "v": 1. Keep "theme" and "docId" unchanged.
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

export function agreementAiPrompt(doc: AgreementDoc, clientName: string, brief: string): string {
  return `You are preparing a service agreement for Marker Studio® — a bilingual (English + Arabic) creative studio in Beit Sahour, Palestine. The agreement is stored as a JSON document and rendered as a paged A4 contract (cover → summary → numbered terms → signature page).

Personalise the JSON below for THIS client. The numbered terms are the studio's standard contract: keep their legal meaning intact — adjust only client-specific details (parties, purpose, scope of work, package names, payment schedule) and improve the Arabic where it reads stiffly.

${SHARED_RULES}
- "summary.rows": fill Client, Representative, Agreement value and Package confirmation with the client's real details.
- The "Parties", "Project Purpose" and "Agreed Scope of Work" sections must name the client and list the actual agreed deliverables.
- "schedule": if the material includes agreed pricing, set "enabled": true and list the payment lines (label + amount as written, e.g. "2,500 ₪"); otherwise leave "enabled": false.
- Do NOT weaken or remove protective clauses (revisions, exclusions, ownership, cancellation).

=== CLIENT MATERIAL (brief, accepted proposal, pricing — use everything) ===
${brief}

[paste any extra material here — the accepted proposal, package details, agreed totals…]

=== JSON DOCUMENT TO REWRITE ===
${JSON.stringify(doc, null, 1)}`;
}

// Parse the AI reply — tolerant of code fences and stray prose around the JSON.
export function parseAiDoc<T extends { v: number }>(raw: string): T | null {
  let s = (raw || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1);
  try {
    const d = JSON.parse(s) as T;
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
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
