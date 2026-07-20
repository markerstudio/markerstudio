// Client portals — data model + access layer (DB-backed, Neon).
//
// Each client has a private portal (/portal/[slug]). Bilingual rich content
// lives in a JSONB `data` column shaped like ClientData below. Reads tolerate a
// missing table (pre-migration) by returning empty/undefined.
import { cache } from "react";
import { getSql, isDbEnabled } from "@/lib/db";
import { readSnapshot, isOutageError } from "@/lib/snapshot";
import type { AgreementDoc, ProposalDoc, ProposalSelection } from "@/lib/docs";
import { createNotionClientWithSource } from "@/lib/notion";
import { amountLabelToIls } from "@/lib/money";

export type LocalizedText = { en: string; ar: string };
export type Invoice = { cycle: string; desc: string; amount: string; status: "paid" | "due" | "overdue" };
export type SocialItem = { title: string; desc: string; tag?: string };
export type SocialContentType = "post" | "story" | "reel" | "carousel";
// Production pipeline for a content item — from idea to published. Distinct from
// `status` (kept for the client portal's planned/scheduled/posted pills); `status`
// is derived from `stage` on edit so the portal stays meaningful.
export type ContentStage = "idea" | "shoot" | "edit" | "scheduled" | "posted";
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
  // Content production pipeline + richer authoring fields (admin Plan & Content).
  stage?: ContentStage;
  fromShot?: string; // back-link to the PhotoTask (shot) this was scheduled from
  mediaUrl?: string; // thumbnail / asset (carried over from the shot)
  mediaKind?: "image" | "video";
  caption?: string;
  hook?: string;
  hashtags?: string;
  cta?: string;
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
// A client-facing file. `folder` groups it for sorting (empty = "Ungrouped");
// the array order is the sort order within a folder (drag-to-reorder).
export type DocItem = { title: string; type: string; url: string; folder?: string };
// One unit of stories work Ramzi tracks per client (e.g. "Produce 5 daily
// stories for the week"). Lives on the client so the partner portal can show
// Ramzi exactly what he has to do, independent of Marker's marketing work.
export type StoriesTask = { id: string; title: string; status: "todo" | "doing" | "done"; due?: string; at: string };
// A downloadable brand deliverable (final logo, post export, guideline PDF…).
// Lives alongside the proposal/agreement docs but is framed as a creative asset.
export type AssetItem = { title: string; type: string; url: string; size?: string; at?: string };

// --- Photography (Ameer & co.) --------------------------------------------
// A scheduled shoot for the client. Lives on the client so the photographer
// portal can show the photographer exactly when and what to shoot, and so the
// client can (optionally) see their own shoot schedule. `brief` is the bilingual
// direction — what to capture, mood, references.
export type PhotoSessionStatus = "planned" | "confirmed" | "shot" | "delivered";
export type PhotoSession = {
  id?: string; // stable id — assigned on read/save; legacy rows fall back to index
  date: string; // ISO yyyy-mm-dd
  time?: string; // free text, e.g. "14:00" or "Afternoon"
  location?: string;
  title: string; // what the shoot is for
  brief?: LocalizedText; // direction / what to capture
  status: PhotoSessionStatus;
};
// One line of the photo-session to-do list (the "shot list") the photographer
// works through. Mirrors the social-post feedback model: the studio writes it in
// client settings, the photographer ticks items off from their portal.
export type PhotoTaskStatus = "todo" | "doing" | "done";
// A shot is also a planned content piece: it carries a content `type` and, once
// captured, an uploaded photo/reel (`mediaUrl`). The Plan & Content surface lets it
// be dragged onto the calendar to schedule a linked post.
export type PhotoTask = {
  id?: string;
  sessionId?: string; // links the shot to its PhotoSession.id (JSONB-additive; legacy rows lack it = unassigned/general)
  title: string;
  status: PhotoTaskStatus;
  due?: string;
  note?: string;
  type?: SocialContentType;
  mediaUrl?: string;
  mediaKind?: "image" | "video";
};
// The photography block on a client. `active` connects the client to the
// photographer portal (like storiesActive connects to Ramzi). The two share
// toggles are independent and both default off: sharePlan pushes the Marker plan
// to the photographer for context; showToClient reveals the shoot schedule and
// to-do in the client's own portal.
export type ClientPhoto = {
  active?: boolean; // connected to the photographer portal (Ameer sees this client)
  sharePlan?: boolean; // also push the Marker plan to the photographer
  showToClient?: boolean; // show shoots + to-do in the client's own portal
  sessions?: PhotoSession[];
  shots?: PhotoTask[]; // the photo-session to-do list ("shot list")
};
// --- Deliverables (smart to-do list) --------------------------------------
// What the studio owes a client and by when. A status-advancing to-do list that
// can be hand-authored or rule-generated from the plan cycle + proposal timeline
// (see lib/deliverables.ts). Lives on the client (own JSONB key) so it can be
// tracked per client, aggregated across clients ("what's due"), and optionally
// shown to the client as a progress view. Mirrors the photography block.
export type DeliverableStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type Deliverable = {
  id?: string; // stable id — assigned on read/save; legacy rows fall back to index
  title: string;
  detail?: string;
  due?: string; // ISO yyyy-mm-dd — generated from the timeline/cycle, or hand-set
  time?: string; // optional reminder time "HH:MM" (24h) on the due day
  status: DeliverableStatus;
  priority?: TaskPriority; // defaults to "normal" when absent
  note?: string; // free-form working note, admin-only
  order?: number; // manual sort key within a date group (lower first)
  createdAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp — stamped when status flips to done
  kind?: "recurring" | "milestone";
  source?: "manual" | "plan" | "timeline" | "client"; // provenance — drives dedupe on re-generate
  cycle?: string; // recurring dedupe key, "YYYY-MM"
  phaseKey?: string; // milestone dedupe key — the source timeline phase name
  requestedByClient?: boolean; // submitted from the client portal
  pending?: boolean; // awaiting admin approval (only meaningful for client requests)
  notionPageId?: string; // linked page in the Notion Tasks database (two-way sync)
};
export type ClientDeliverables = {
  active?: boolean; // tracked for this client (shows on the cross-client "what's due" view)
  showToClient?: boolean; // reveal a progress view in the client's own portal
  allowClientRequests?: boolean; // let the client submit task requests (pending until approved)
  items?: Deliverable[];
};

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
    progress: number; // % paid, combined (auto-derived; the money left lives on plan.balance)
    brandingFee?: string; // fixed branding fee (one-time, reference only)
    totalAgreed?: string; // total agreed value of the engagement — drives auto money-left / paid %
    storiesFee?: string; // daily stories fee collected for Ramzi (app-only, never synced to Notion); prefills the stories line when invoicing
    storiesActive?: boolean; // explicit "this client has stories" switch — when on, the client is connected to Ramzi's portal (stories work + collection) even before any payment
    storiesTotal?: string; // optional total agreed stories value, for Ramzi's reference

    /** @deprecated Money left is a single combined figure — no branding split. */
    brandingProgress?: number;
    /** @deprecated Money left is a single combined figure — no branding split. */
    brandingLeft?: string;
  };
  documents: DocItem[];
  docFolders?: string[]; // ordered folder names for sorting the Documents tab (empty folders persist here)
  photo?: ClientPhoto; // photography — shoot schedule + to-do shared with the photographer (and optionally the client)
  deliverables?: ClientDeliverables; // smart to-do list — what's owed and by when (own key; never in the form payload)
  storiesTasks?: StoriesTask[]; // Ramzi's stories work list for this client (managed from the partner portal)
  assets?: AssetItem[]; // downloadable brand deliverables (logos, exports, guidelines)
  updates?: ActivityItem[]; // portal activity feed — studio notes + client actions
  status?: "pending" | "active"; // "pending" = created via onboarding, awaiting review
  archived?: boolean; // hidden from the active admin list; blocks the client's portal access until restored
  owner?: "marker" | "ramzi"; // whose client this is — "ramzi" clients are walled off to the partner + super admin
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

// Auto-derived client finance, all in ILS (USD payment rows converted via
// amountLabelToIls). Paid = sum of paid rows. The total is the "Total agreed"
// when set, else paid + still-open rows, else paid + the last-known balance —
// so the figures match the synced number until a total is entered. Money left
// and Paid % follow from that, so neither is ever hand-edited.
export function computeClientFinance(data: ClientData): {
  paidIls: number;
  openIls: number;
  totalIls: number;
  moneyLeftIls: number;
  paidPct: number;
} {
  const invs = data.invoices || [];
  const paidIls = invs.filter((i) => i.status === "paid").reduce((s, i) => s + amountLabelToIls(i.amount || ""), 0);
  const openIls = invs.filter((i) => i.status !== "paid").reduce((s, i) => s + amountLabelToIls(i.amount || ""), 0);
  const totalAgreed = amountLabelToIls(data.finance?.totalAgreed || "");
  const storedLeft = amountLabelToIls(data.plan?.balance || "");
  const totalIls = totalAgreed > 0 ? totalAgreed : openIls > 0 ? paidIls + openIls : paidIls + storedLeft;
  const moneyLeftIls = Math.max(0, totalIls - paidIls);
  const paidPct = totalIls > 0 ? Math.max(0, Math.min(100, Math.round((paidIls / totalIls) * 100))) : 0;
  return { paidIls, openIls, totalIls, moneyLeftIls, paidPct };
}

// A client is "connected to Ramzi" for stories when the explicit Stories switch
// is on. Drives the partner portal: any such client shows up there (with its
// work list) so Ramzi knows what he has to do — even before any money is paid.
export function hasStories(data: ClientData | undefined | null): boolean {
  return !!data?.finance?.storiesActive;
}

// A client is "connected to the photographer" when the Photography switch is on.
// Drives the photographer portal: any such client shows up there with its shoot
// schedule and shot to-do, so Ameer (and any other photographer) sees exactly
// what to shoot — independent of Marker's marketing or Ramzi's stories work.
export function hasPhotography(data: ClientData | undefined | null): boolean {
  return !!data?.photo?.active;
}

// Read–mutate–write a client's JSONB data in one place. Loads the current data,
// lets the caller mutate it, and persists the whole object back. Used for small
// targeted edits (e.g. Ramzi's stories tasks) that don't go through the big
// client form. Best-effort: a missing client / DB is a silent no-op.
export async function updateClientData(slug: string, mutate: (d: ClientData) => void): Promise<void> {
  if (!isDbEnabled()) return;
  const sql = getSql();
  const rows = (await sql`SELECT data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { data: ClientData }[];
  if (!rows[0]) return;
  const data = (rows[0].data || {}) as ClientData;
  mutate(data);
  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
}

// Write ONE top-level key of a client's JSONB `data` in a single atomic statement
// (jsonb_set merges against the live row, not a stale in-memory snapshot). This is
// the per-section save primitive: two editors touching different keys — e.g. the
// settings form (social/finance/…) and the photographer portal (photo) — can no
// longer clobber each other. Same-key writes remain last-write-wins, bounded to
// that subtree. Best-effort: a missing client / DB is a silent no-op.
export async function setClientDataPath<K extends keyof ClientData>(
  slug: string,
  key: K,
  value: ClientData[K],
): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const sql = getSql();
  await sql`
    UPDATE clients
    SET data = jsonb_set(COALESCE(data, '{}'::jsonb), ARRAY[${key as string}]::text[], ${JSON.stringify(value)}::jsonb, true),
        updated_at = now()
    WHERE slug = ${slug}
  `;
  return true;
}

// Save just the photography block (shoot schedule + shot list + share toggles)
// without touching the rest of the client. Used by the per-section Plan & Shoots
// editor and (via updatePhotoBlock) the photographer portal status buttons.
export async function savePhotoBlock(slug: string, photo: ClientPhoto): Promise<boolean> {
  return setClientDataPath(slug, "photo", photo);
}

// Shallow-merge a partial ClientData into the live row (Postgres `||` merges
// top-level keys). The per-section save primitive for the tabbed editor: a tab
// sends only the keys it owns, so saving one section never overwrites another's
// keys — or a concurrent photographer edit (the photo key isn't in the payload).
export async function mergeClientData(slug: string, fields: Partial<ClientData>): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const sql = getSql();
  await sql`
    UPDATE clients
    SET data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify(fields)}::jsonb,
        updated_at = now()
    WHERE slug = ${slug}
  `;
  return true;
}

// Read–mutate–write only the photo subtree (one targeted status flip, etc.) and
// persist it via jsonb_set so a concurrent settings save can't be clobbered.
export async function updatePhotoBlock(slug: string, mutate: (photo: ClientPhoto) => void): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const sql = getSql();
  const rows = (await sql`SELECT data->'photo' AS photo FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { photo: ClientPhoto | null }[];
  if (!rows[0]) return false;
  const photo = (rows[0].photo || {}) as ClientPhoto;
  mutate(photo);
  return savePhotoBlock(slug, photo);
}

// Deliverables block — same per-subtree pattern as photo, so the to-do list saves
// independently of the rest of the client (no clobber across sections).
export async function saveDeliverablesBlock(slug: string, deliverables: ClientDeliverables): Promise<boolean> {
  return setClientDataPath(slug, "deliverables", deliverables);
}

export async function updateDeliverablesBlock(slug: string, mutate: (d: ClientDeliverables) => void): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const sql = getSql();
  const rows = (await sql`SELECT data->'deliverables' AS deliverables FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { deliverables: ClientDeliverables | null }[];
  if (!rows[0]) return false;
  const block = (rows[0].deliverables || {}) as ClientDeliverables;
  mutate(block);
  return saveDeliverablesBlock(slug, block);
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
    photo: { active: false, sharePlan: false, showToClient: false, sessions: [], shots: [] },
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

// Like retry(), but the second failure propagates so the caller can decide
// (e.g. fall back to the studio snapshot instead of an empty result).
async function retryOrThrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

// cache() = one query per request no matter how many callers (layout, page,
// agenda engine, notifications) ask during the same render. This is the
// heaviest read in the app — every client's full data blob — so request-level
// dedupe is a straight network-transfer saving with zero staleness: the cache
// dies with the request.
//
// When the database is unreachable (suspended, quota, outage) the read falls
// back to the encrypted studio snapshot (lib/snapshot) — the portal and the
// admin keep showing the last saved copy instead of erroring.
export const getClients = cache(async function getClients(): Promise<Client[]> {
  if (!isDbEnabled()) return [];
  try {
    return await retryOrThrow(async () => {
      return (await getSql()`
        SELECT id, slug, name, logo, color, data FROM clients ORDER BY created_at ASC
      `) as unknown as ClientRow[];
    });
  } catch (e) {
    console.error("[clients] DB read failed:", e);
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      if (snap) return snap.clients as Client[];
    }
    return [];
  }
});

export type ClientPaletteRow = { slug: string; name: string; color: string; archived: boolean };

// The ⌘K palette needs names only, but the admin layout was pulling every
// client's full data blob on EVERY admin navigation to get them. This slim
// select fetches just the columns the palette shows.
export async function getClientsPalette(): Promise<ClientPaletteRow[]> {
  if (!isDbEnabled()) return [];
  return retry(async () => {
    const rows = (await getSql()`
      SELECT slug, name, color, COALESCE((data->>'archived')::boolean, false) AS archived
      FROM clients ORDER BY created_at ASC
    `) as unknown as ClientPaletteRow[];
    return rows;
  }, []);
}

export async function getClient(slug: string): Promise<Client | undefined> {
  if (!isDbEnabled()) return undefined;
  try {
    return await retryOrThrow(async () => {
      const rows = (await getSql()`
        SELECT id, slug, name, logo, color, data FROM clients WHERE slug = ${slug} LIMIT 1
      `) as unknown as ClientRow[];
      return rows[0];
    });
  } catch (e) {
    console.error("[clients] DB read failed:", e);
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      const hit = (snap?.clients as Client[] | undefined)?.find((c) => c.slug === slug);
      if (hit) return hit;
    }
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
