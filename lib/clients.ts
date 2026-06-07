// Client portals — data model + access layer (DB-backed, Neon).
//
// Each client has a private portal (/portal/[slug]). Bilingual rich content
// lives in a JSONB `data` column shaped like ClientData below. Reads tolerate a
// missing table (pre-migration) by returning empty/undefined.
import { getSql, isDbEnabled } from "@/lib/db";

export type LocalizedText = { en: string; ar: string };
export type Invoice = { cycle: string; desc: string; amount: string; status: "paid" | "due" | "overdue" };
export type SocialItem = { title: string; desc: string; tag?: string };
export type MetricRow = { label: string; before: string; after: string; note: string };
export type Campaign = {
  name: string; period: string; type: string; spend: string;
  reach: string; impressions: string; freq: string; cpm: string; desc: string;
};
export type StoryCard = { tag: string; value: string; desc: string };
export type Vital = { label: string; pct: number; note: string };

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
  };
  dashboard: {
    headline: LocalizedText;
    cards: StoryCard[];
    vitals: Vital[];
    diagnosis?: LocalizedText;
  };
  social: { headline: LocalizedText; items: SocialItem[] };
  analysis: {
    organic: { headline: LocalizedText; metrics: MetricRow[]; reading?: LocalizedText };
    paid: { spend: string; note: LocalizedText; campaigns: Campaign[] };
  };
  invoices: Invoice[];
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
}

export async function getClients(): Promise<Client[]> {
  if (!isDbEnabled()) return [];
  try {
    return (await getSql()`
      SELECT id, slug, name, logo, color, data FROM clients ORDER BY created_at ASC
    `) as unknown as ClientRow[];
  } catch {
    return [];
  }
}

export async function getClient(slug: string): Promise<Client | undefined> {
  if (!isDbEnabled()) return undefined;
  try {
    const rows = (await getSql()`
      SELECT id, slug, name, logo, color, data FROM clients WHERE slug = ${slug} LIMIT 1
    `) as unknown as ClientRow[];
    return rows[0];
  } catch {
    return undefined;
  }
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
      headline: { en: "The monthly content plan.", ar: "خطة المحتوى الشهرية." },
      items: [
        { title: "Educational Reels", desc: "Simple explanations of common problems — discovery-first.", tag: "Reels" },
        { title: "Daily Stories", desc: "Polls, FAQs, behind-the-scenes — relationship and presence.", tag: "Stories" },
        { title: "Trust posts", desc: "Clinic process, patient-friendly explanations, credibility.", tag: "Trust" },
        { title: "Paid testing", desc: "Test hooks with ads, then push what earns attention.", tag: "Paid" },
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
      { cycle: "Cycle 01 · Feb 26 → Mar 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
      { cycle: "Cycle 02 · Mar 26 → Apr 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
      { cycle: "Cycle 03 · Apr 26 → May 26", desc: "Monthly social media management", amount: "1,800 ILS", status: "paid" },
    ],
  },
};
