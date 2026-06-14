// Client portals — data model + access layer (DB-backed, Neon).
//
// Each client has a private portal (/portal/[slug]). Bilingual rich content
// lives in a JSONB `data` column shaped like ClientData below. Reads tolerate a
// missing table (pre-migration) by returning empty/undefined.
import { getSql, isDbEnabled } from "@/lib/db";
import type { AgreementDoc, ProposalDoc, ProposalSelection } from "@/lib/docs";
import { createNotionClientWithSource } from "@/lib/notion";

export type LocalizedText = { en: string; ar: string };
export type Invoice = { cycle: string; desc: string; amount: string; status: "paid" | "due" | "overdue" };
export type SocialItem = { title: string; desc: string; tag?: string };
export type SocialContentType = "post" | "story" | "reel";
// A note left on a social post — by the studio or the client — so approvals
// carry a short conversation instead of a bare status flip.
export type SocialComment = { by: string; role: "studio" | "client"; text: string; at: string };
// `brief` is the type-aware long copy: post details / reel script / stories direction.
// `approval` is the client's sign-off on the planned post; `comments` is the
// thread attached to it (feedback both ways).
export type SocialPost = {
  date: string;
  platform: string;
  title: string;
  notes: string;
  status: "planned" | "scheduled" | "posted";
  type?: SocialContentType;
  brief?: string;
  approval?: "pending" | "approved" | "changes";
  comments?: SocialComment[];
};
export type TimelinePhase = { phase: string; duration?: string; detail?: string };
// One analytics stat: the number, an optional change badge, and what it means
// in plain words. (`before`/`after` are the deprecated old shape — when
// `value` is empty the portal falls back to `after`.)
export type MetricRow = { label: string; value?: string; delta?: string; note: string; before?: string; after?: string };
export type Campaign = {
  name: string; period: string; type: string; spend: string;
  reach: string; impressions: string; freq: string; cpm: string; desc: string;
};
export type StoryCard = { tag: string; value: string; desc: string };
export type Vital = { label: string; pct: number; note: string };
// AI-generated, bilingual analysis for the Analysis tab. The AI designs the
// whole thing as a self-contained HTML fragment (cards, inline SVG charts, …),
// one per language; the portal renders it (sanitized). See lib/aiPrompt.ts.
export type AiAnalysis = {
  html: LocalizedText;
  generatedAt: string;
};
export type DocItem = { title: string; type: string; url: string };
// A downloadable brand deliverable (final logo, post export, guideline PDF…).
// Lives alongside the proposal/agreement docs but is framed as a creative asset.
export type AssetItem = { title: string; type: string; url: string; size?: string; at?: string };
// One entry in the portal activity feed. `kind` drives the icon/accent; copy is
// bilingual. Studio-authored notes and client actions (approvals, signatures)
// both land here so the dashboard shows a live history.
export type ActivityItem = { at: string; kind: "note" | "approval" | "doc" | "post" | "finance"; title: LocalizedText; body?: LocalizedText };

// Captured by the public /onboarding flow (mirrors marker.ps/create). Stored on
// the client's data so the studio can read the full brief in the admin.
export type OnboardingBrief = {
  plan?: string; // branding package picked (e.g. "Growth Branding"), if any
  planFeatures?: string[]; // features of the branding package
  marketingPlan?: string; // marketing package picked (e.g. "Intensive"), if any
  marketingFeatures?: string[]; // features of the marketing package
  services?: string[]; // à-la-carte services picked instead of / alongside a package
  servicesOther?: string; // free-text "other" service request
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  brandName: string;
  brandDescription: string;
  logoLanguage: string[];
  products: string;
  competitors: string;
  businessGoals: string;
  audienceGender: string[];
  audienceAge: string[];
  onlinePresence: string;
  symbolShape: string;
  colorInMind: string;
  colorDetail: string;
  exactLogoText: string;
  tagline: string;
  existingDesign: string;
  additionalNotes: string;
  newsletter: boolean;
  lang: string;
  submittedAt: string;
};

export type ClientData = {
  hero: LocalizedText; // hero subtitle
  accent?: string; // big watermark word in the hero
  plan: {
    name: string;
    active: boolean;
    start: string; // free text or ISO date
    end: string;
    notionUrl?: string;
    note?: LocalizedText;
    balance?: string; // "money left" / outstanding balance
  };
  dashboard: {
    headline: LocalizedText;
    cards: StoryCard[];
    vitals: Vital[];
    diagnosis?: LocalizedText;
  };
  social: { headline: LocalizedText; posts: SocialPost[] };
  analysis: {
    organic: { headline: LocalizedText; metrics: MetricRow[]; reading?: LocalizedText };
    paid: { spend: string; note: LocalizedText; campaigns: Campaign[] };
    ai?: AiAnalysis; // Claude-generated reading of the numbers
  };
  invoices: Invoice[]; // payment history
  finance: {
    monthlyFee: string; // monthly marketing fee
    progress: number; // % paid, combined (the combined money left lives on plan.balance)
    brandingFee?: string; // fixed branding fee (one-time, reference only)
    /** @deprecated Money left is a single combined figure — no branding split. */
    brandingProgress?: number;
    /** @deprecated Money left is a single combined figure — no branding split. */
    brandingLeft?: string;
  };
  documents: DocItem[];
  assets?: AssetItem[]; // downloadable brand deliverables (logos, exports, guidelines)
  updates?: ActivityItem[]; // portal activity feed — studio notes + client actions
  status?: "pending" | "active"; // "pending" = created via onboarding, awaiting review
  onboarding?: OnboardingBrief; // the brief captured at signup
  // Proposal & agreement are prepared by the studio and only shown to the
  // client once `published` is set (sent). They are not auto-generated to the client.
  proposal?: {
    published?: boolean;
    sentAt?: string;
    acceptedAt?: string;
    note?: string;
    timeline?: TimelinePhase[];
    archived?: boolean;
    // The paged document (see lib/docs.ts). When absent, a default is built
    // from the client's data so previews always work.
    doc?: ProposalDoc;
    // Captured on acceptance from the document's form.
    acceptedBy?: string;
    acceptedTitle?: string;
    acceptedNotes?: string;
    selection?: ProposalSelection;
  };
  agreement?: {
    published?: boolean;
    sentAt?: string;
    acceptedAt?: string;
    signedName?: string;
    value?: string;
    doc?: AgreementDoc;
    archived?: boolean;
  };
  // Itemised quote — one line per package / service, shown on the proposal & agreement.
  pricing?: { items: { label: string; amount: string }[]; note?: string };
  notionDbId?: string;
  notionPageId?: string;
};

export type Client = {
  id: number;
  slug: string;
  name: string;
  logo: string;
  color: string;
  data: ClientData;
};

type ClientRow = { id: number; slug: string; name: string; logo: string; color: string; data: ClientData };

// Idempotent migration: clients table + role/client_id on users. Safe to call
// repeatedly; run from auth/admin write paths so existing installs upgrade.
export async function ensureClientSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#303030',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id INTEGER`;
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      used_at TIMESTAMPTZ
    )
  `;
}

// Empty portal content for a brand-new client.
export function blankClientData(): ClientData {
  return {
    hero: { en: "", ar: "" },
    accent: "",
    plan: { name: "", active: true, start: "", end: "", notionUrl: "", note: { en: "", ar: "" }, balance: "" },
    dashboard: { headline: { en: "", ar: "" }, diagnosis: { en: "", ar: "" }, cards: [], vitals: [] },
    social: { headline: { en: "", ar: "" }, posts: [] },
    analysis: {
      organic: { headline: { en: "", ar: "" }, reading: { en: "", ar: "" }, metrics: [] },
      paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] },
    },
    invoices: [],
    finance: { monthlyFee: "", progress: 0, brandingFee: "" },
    documents: [],
    assets: [],
    updates: [],
    notionDbId: "",
  };
}

// URL-safe slug from a free-text name.
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "client"
  );
}

// Find a client by name (or its slug form); create a minimal portal if none
// exists. Lets invoices/proposals be started from a free-typed client name.
export async function resolveOrCreateClientByName(name: string): Promise<{ id: number; slug: string } | null> {
  const trimmed = name.trim();
  if (!trimmed || !isDbEnabled()) return null;
  const sql = getSql();
  await ensureClientSchema();
  const base = slugify(trimmed);
  const existing = (await sql`
    SELECT id, slug FROM clients WHERE slug = ${base} OR lower(name) = ${trimmed.toLowerCase()} LIMIT 1
  `) as unknown as { id: number; slug: string }[];
  if (existing[0]) return existing[0];

  let slug = base;
  let n = 2;
  for (;;) {
    const r = (await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as unknown[];
    if (r.length === 0) break;
    slug = `${base}-${n++}`;
  }
  // Auto-create the client + source in Notion (attached to All Time Clients Debt)
  // and save the link, so a client first seen on an invoice still syncs. Best-effort.
  const data = blankClientData();
  try {
    const made = await createNotionClientWithSource({ name: trimmed });
    if (made?.clientPageId) data.notionPageId = made.clientPageId;
  } catch {
    /* never block client creation on a Notion write */
  }
  const ins = (await sql`
    INSERT INTO clients (slug, name, color, data)
    VALUES (${slug}, ${trimmed}, '#303030', ${JSON.stringify(data)}::jsonb)
    RETURNING id, slug
  `) as unknown as { id: number; slug: string }[];
  return ins[0] ?? null;
}

async function retry<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === 1) {
        console.error("[clients] DB read failed:", e);
        return fallback;
      }
    }
  }
  return fallback;
}

export async function getClients(): Promise<Client[]> {
  if (!isDbEnabled()) return [];
  return retry(async () => {
    return (await getSql()`
      SELECT id, slug, name, logo, color, data FROM clients ORDER BY created_at ASC
    `) as unknown as ClientRow[];
  }, []);
}

export async function getClient(slug: string): Promise<Client | undefined> {
  if (!isDbEnabled()) return undefined;
  return retry(async () => {
    const rows = (await getSql()`
      SELECT id, slug, name, logo, color, data FROM clients WHERE slug = ${slug} LIMIT 1
    `) as unknown as ClientRow[];
    return rows[0];
  }, undefined);
}

export async function getClientById(id: number): Promise<Client | undefined> {
  if (!isDbEnabled()) return undefined;
  try {
    const rows = (await getSql()`
      SELECT id, slug, name, logo, color, data FROM clients WHERE id = ${id} LIMIT 1
    `) as unknown as ClientRow[];
    return rows[0];
  } catch {
    return undefined;
  }
}

// A full example portal (Dr. Jack Sabat) — importable from the admin so the
// studio sees a complete, real portal immediately.
export const EXAMPLE_CLIENT: { slug: string; name: string; logo: string; color: string; data: ClientData } = {
  slug: "dr-jack-sabat",
  name: "Dr. Jack Sabat",
  logo: "https://static.wixstatic.com/media/cf380e_5f07630cafcd4d3395bf084438d9e5e4~mv2.png",
  color: "#303030",
  data: {
    accent: "JACK",
    hero: {
      en: "A clear portal showing what changed since Marker Studio® started managing awareness and engagement campaigns in March.",
      ar: "بوابة خاصة توضّح التغيير الذي حدث منذ بداية عمل ماركر استديو على حملات الوعي والتفاعل من شهر آذار.",
    },
    plan: {
      name: "Monthly social media management",
      active: true,
      start: "Feb 26",
      end: "May 26",
      notionUrl: "",
      note: {
        en: "The next monthly plan will be prepared together after this review.",
        ar: "الخطة الشهرية القادمة ستُحضّر معاً بعد هذه المراجعة.",
      },
      balance: "600 ILS",
    },
    dashboard: {
      headline: { en: "The account changed behavior.", ar: "الحساب غيّر سلوكه." },
      diagnosis: {
        en: "The awareness work succeeded: more people saw Dr. Jack, visited the page, followed, and clicked. But interactions did not grow at the same speed as visibility — the next strategy should build connection, clarity, and trust.",
        ar: "نجح العمل على الوعي: شاهد المزيد من الناس دكتور جاك، وزاروا الصفحة، وتابعوا، وضغطوا. لكن التفاعل لم ينمُ بنفس سرعة الظهور — على الاستراتيجية القادمة أن تبني العلاقة والوضوح والثقة.",
      },
      cards: [
        { tag: "Before March", value: "Quiet", desc: "Low discovery, low action. The account existed but wasn't moving." },
        { tag: "From March", value: "Active", desc: "Campaigns pushed the account into wider awareness and visibility." },
        { tag: "May Peak", value: "Action", desc: "Views, visits, follows, and link clicks became much stronger." },
        { tag: "Next Focus", value: "Trust", desc: "Convert visibility into deeper interaction and patient trust." },
      ],
      vitals: [
        { label: "Visibility", pct: 96, note: "Strong" },
        { label: "Discovery", pct: 94, note: "Strong" },
        { label: "Visits", pct: 78, note: "Good" },
        { label: "Clicks", pct: 86, note: "Rising" },
        { label: "Trust", pct: 52, note: "Next" },
      ],
    },
    social: {
      headline: { en: "This month's content calendar.", ar: "روزنامة المحتوى لهذا الشهر." },
      posts: [
        { date: "2026-06-03", platform: "Instagram", title: "Educational Reel — common myths", notes: "Reels-first, discovery", status: "posted" },
        { date: "2026-06-07", platform: "Instagram", title: "Story poll + Q&A", notes: "Engagement", status: "scheduled" },
        { date: "2026-06-12", platform: "TikTok", title: "Clinic behind-the-scenes", notes: "Trust", status: "planned" },
        { date: "2026-06-18", platform: "Instagram", title: "Patient-friendly explainer", notes: "Education", status: "planned" },
        { date: "2026-06-24", platform: "Instagram", title: "Before/after carousel", notes: "Proof", status: "planned" },
      ],
    },
    analysis: {
      organic: {
        headline: { en: "Before vs after Marker.", ar: "قبل وبعد ماركر." },
        reading: {
          en: "Only 8 Reels generated 171,560 views — the strongest reach engine. 50 Stories generated 1,283 interactions — better for relationship and daily presence.",
          ar: "٨ ريلز فقط حقّقت ١٧١٬٥٦٠ مشاهدة — أقوى محرّك وصول. و٥٠ ستوري حقّقت ١٬٢٨٣ تفاعلاً — أفضل للعلاقة والحضور اليومي.",
        },
        metrics: [
          { label: "Views", before: "7,260", after: "301,274", note: "From quiet visibility to mass discovery." },
          { label: "Viewers", before: "2,938", after: "215,924", note: "The audience pool became much larger." },
          { label: "Visits", before: "771", after: "5,638", note: "People started checking the page, not just seeing content." },
          { label: "Follows", before: "11", after: "238", note: "Attention began converting into audience growth." },
          { label: "Link clicks", before: "1", after: "1,182", note: "Action went from near-zero to measurable." },
          { label: "Interactions", before: "669", after: "1,708", note: "Improved — but slower than visibility. The next focus." },
        ],
      },
      paid: {
        spend: "$292.22",
        note: {
          en: "Campaigns worked as a sequence: awareness → profile curiosity → action → follower growth.",
          ar: "اشتغلت الحملات كتسلسل: وعي ← فضول للملف ← فعل ← نمو المتابعين.",
        },
        campaigns: [
          { name: "Athlete/Player Video — Engagement", type: "Engagement", period: "Mar 13–19", spend: "$59.55", reach: "85,000", impressions: "116,247", freq: "1.37", cpm: "$0.51", desc: "First strong push. Introduced Dr. Jack via a lifestyle/athlete angle, not a cold medical ad." },
          { name: "Profile Visits", type: "Profile Visits", period: "Apr 5–11", spend: "$59.93", reach: "95,613", impressions: "115,894", freq: "1.21", cpm: "$0.52", desc: "Turned visibility into curiosity — drove the April jump in page visits." },
          { name: "May Traffic", type: "Traffic", period: "May 2–5", spend: "$59.94", reach: "78,784", impressions: "97,603", freq: "1.24", cpm: "$0.61", desc: "Moved the account from awareness to action; built the click behavior." },
          { name: "May Engagement", type: "Engagement", period: "May 20–26", spend: "$59.74", reach: "44,755", impressions: "50,456", freq: "1.13", cpm: "$1.18", desc: "More focused; tested reactions after the account had visibility." },
          { name: "Followers Reel", type: "Followers", period: "May 24–29", spend: "$53.06", reach: "88,690", impressions: "117,685", freq: "1.33", cpm: "$0.45", desc: "Most efficient visibility campaign; supported follower growth." },
        ],
      },
    },
    invoices: [
      { cycle: "Branding · Visual identity", desc: "Fixed branding fee — paid", amount: "2,500 ILS", status: "paid" },
      { cycle: "Cycle 01 · Feb 26 → Mar 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
      { cycle: "Cycle 02 · Mar 26 → Apr 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
      { cycle: "Cycle 03 · Apr 26 → May 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
    ],
    finance: { monthlyFee: "1,800 ILS", progress: 67, brandingFee: "2,500 ILS" },
    documents: [
      { title: "Proposal", type: "PDF", url: "" },
      { title: "Service agreement", type: "PDF", url: "" },
    ],
  },
};
