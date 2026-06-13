// Meta (Facebook + Instagram) sync — pulls live organic insights and paid ad
// performance into a client's portal Analysis tab.
//
// Security: each client's long-lived Page access token lives in the
// `client_meta` table and is read ONLY on the server (sync actions + the cached
// on-view fetch). It is never placed on `ClientData`, so it never reaches the
// browser — only the derived numbers do.
//
// The studio is an admin of its clients' Pages, so it generates a long-lived
// Page/System-User token per client and pastes it in the admin. No app secret
// is needed to call the Graph API with that token.
//
// NOTE: exact metric names/periods vary by Graph API version and account type.
// Mapping here is deliberately defensive — a missing metric is skipped, never
// fatal — so this degrades to the manually-entered metrics. Tune metric names
// to your Graph version as needed (same spirit as the flexible Notion mapping).
import { unstable_cache } from "next/cache";
import { SignJWT, jwtVerify } from "jose";
import { getSql, isDbEnabled } from "@/lib/db";
import type { Campaign, MetricRow } from "@/lib/clients";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// --- Facebook Login (OAuth) ------------------------------------------------
// One-click "Continue with Facebook": the studio (or client) authorizes the
// app, and we capture a long-lived Page token + discover the IG/ad-account IDs.
export const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "ads_read",
  "business_management",
].join(",");

// One-click flow is available only when the app credentials are set; otherwise
// the admin falls back to pasting IDs + a token by hand.
export function metaAppConfigured(): boolean {
  return !!(META_APP_ID && META_APP_SECRET);
}

function stateSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET || META_APP_SECRET || "marker-meta-state");
}
// Signed, expiring blobs used for the OAuth `state` param and the short-lived
// cookie that carries the user token between the callback and the picker.
export async function signMetaState(payload: Record<string, unknown>, exp = "10m"): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(stateSecret());
}
export async function verifyMetaState<T = Record<string, unknown>>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload as T;
  } catch {
    return null;
  }
}

export function oauthDialogUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES);
  return url.toString();
}

// Full connection — includes the secret token (server-side use only).
export type MetaConnection = {
  clientId: number;
  fbPageId: string;
  igUserId: string;
  adAccountId: string;
  pageToken: string;
};
// Safe-to-display summary for the admin UI — no token, just whether one is set.
export type MetaConnectionInfo = { fbPageId: string; igUserId: string; adAccountId: string; hasToken: boolean; updatedAt?: string };
export type MetaAnalysis = { organic: MetricRow[]; campaigns: Campaign[]; spend: string };

export async function ensureMetaSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS client_meta (
      client_id     INTEGER PRIMARY KEY,
      fb_page_id    TEXT NOT NULL DEFAULT '',
      ig_user_id    TEXT NOT NULL DEFAULT '',
      ad_account_id TEXT NOT NULL DEFAULT '',
      page_token    TEXT NOT NULL DEFAULT '',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

type MetaRow = { client_id: number; fb_page_id: string; ig_user_id: string; ad_account_id: string; page_token: string; updated_at: string };

// Full connection (with token). Returns null if no row or no token saved.
export async function getMetaConnection(clientId: number): Promise<MetaConnection | null> {
  if (!isDbEnabled()) return null;
  try {
    await ensureMetaSchema();
    const rows = (await getSql()`SELECT * FROM client_meta WHERE client_id = ${clientId} LIMIT 1`) as unknown as MetaRow[];
    const r = rows[0];
    if (!r || !r.page_token) return null;
    return { clientId, fbPageId: r.fb_page_id, igUserId: r.ig_user_id, adAccountId: r.ad_account_id, pageToken: r.page_token };
  } catch {
    return null;
  }
}

// Non-secret summary for the admin panel.
export async function getMetaConnectionInfo(clientId: number): Promise<MetaConnectionInfo | null> {
  if (!isDbEnabled()) return null;
  try {
    await ensureMetaSchema();
    const rows = (await getSql()`SELECT * FROM client_meta WHERE client_id = ${clientId} LIMIT 1`) as unknown as MetaRow[];
    const r = rows[0];
    if (!r) return null;
    return { fbPageId: r.fb_page_id, igUserId: r.ig_user_id, adAccountId: r.ad_account_id, hasToken: !!r.page_token, updatedAt: r.updated_at };
  } catch {
    return null;
  }
}

// Upsert a connection. A blank token keeps the existing one, so the studio can
// edit the IDs without re-pasting the token.
export async function saveMetaConnection(
  clientId: number,
  input: { fbPageId: string; igUserId: string; adAccountId: string; pageToken: string },
): Promise<void> {
  await ensureMetaSchema();
  const sql = getSql();
  const adAccount = input.adAccountId.trim();
  if (input.pageToken) {
    await sql`
      INSERT INTO client_meta (client_id, fb_page_id, ig_user_id, ad_account_id, page_token, updated_at)
      VALUES (${clientId}, ${input.fbPageId.trim()}, ${input.igUserId.trim()}, ${adAccount}, ${input.pageToken}, now())
      ON CONFLICT (client_id) DO UPDATE SET
        fb_page_id = EXCLUDED.fb_page_id, ig_user_id = EXCLUDED.ig_user_id,
        ad_account_id = EXCLUDED.ad_account_id, page_token = EXCLUDED.page_token, updated_at = now()
    `;
  } else {
    await sql`
      INSERT INTO client_meta (client_id, fb_page_id, ig_user_id, ad_account_id, updated_at)
      VALUES (${clientId}, ${input.fbPageId.trim()}, ${input.igUserId.trim()}, ${adAccount}, now())
      ON CONFLICT (client_id) DO UPDATE SET
        fb_page_id = EXCLUDED.fb_page_id, ig_user_id = EXCLUDED.ig_user_id,
        ad_account_id = EXCLUDED.ad_account_id, updated_at = now()
    `;
  }
}

export async function deleteMetaConnection(clientId: number): Promise<void> {
  await ensureMetaSchema();
  await getSql()`DELETE FROM client_meta WHERE client_id = ${clientId}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// `token` may be empty for OAuth endpoints (client_secret goes in params).
// Insights reads pass { revalidate } to cache; token exchanges and account
// listings stay fresh (no-store) since codes are one-time and tokens change.
async function graphGet(path: string, params: Record<string, string>, token: string, opts: { revalidate?: number } = {}): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set("access_token", token);
  const init: RequestInit = opts.revalidate != null ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" };
  const res = await fetch(url.toString(), init);
  if (!res.ok) throw new Error(`Meta ${res.status}`);
  return res.json();
}

// Exchange the OAuth `code` for a short-lived user token, then upgrade it to a
// long-lived one (~60 days). Page tokens derived from it then don't expire.
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const j = await graphGet("oauth/access_token", { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: redirectUri, code }, "");
  return String(j.access_token || "");
}
export async function longLivedUserToken(shortToken: string): Promise<string> {
  const j = await graphGet("oauth/access_token", { grant_type: "fb_exchange_token", client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: shortToken }, "");
  return String(j.access_token || "");
}

export type ManagedPage = { id: string; name: string; token: string; igId: string; igUsername: string };
export type AdAccount = { id: string; name: string };

// Pages the authorizing user manages, each with its (long-lived) Page token and
// any linked Instagram Business account — the candidates for a portal.
export async function listManagedPages(userToken: string): Promise<ManagedPage[]> {
  const j = await graphGet("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "200" }, userToken);
  return (j.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name || p.id,
    token: p.access_token || "",
    igId: p.instagram_business_account?.id || "",
    igUsername: p.instagram_business_account?.username || "",
  }));
}
export async function listAdAccounts(userToken: string): Promise<AdAccount[]> {
  const j = await graphGet("me/adaccounts", { fields: "account_id,name", limit: "200" }, userToken);
  return (j.data ?? []).map((a: any) => ({ id: a.account_id, name: a.name || a.account_id }));
}

// Read a single value out of an insights entry, tolerating both the legacy
// time-series shape (values[].value) and the newer total_value shape.
function readInsight(entry: any): number | null {
  if (!entry) return null;
  if (entry.total_value && typeof entry.total_value.value === "number") return entry.total_value.value;
  const vals = entry.values;
  if (Array.isArray(vals) && vals.length) {
    const v = vals[vals.length - 1]?.value;
    if (typeof v === "number") return v;
  }
  return null;
}
const byName = (data: any[], name: string) => (Array.isArray(data) ? data.find((d) => d?.name === name) : undefined);
const fmt = (n: number | null | undefined) => (typeof n === "number" ? n.toLocaleString("en-US") : "");

async function instagramMetrics(igUserId: string, token: string): Promise<MetricRow[]> {
  const out: MetricRow[] = [];
  // Profile-level counts.
  try {
    const profile = await graphGet(igUserId, { fields: "followers_count,media_count,username" }, token, { revalidate: 900 });
    if (typeof profile.followers_count === "number")
      out.push({ label: "Instagram followers", value: fmt(profile.followers_count), note: "Total audience on Instagram." });
  } catch {
    /* skip */
  }
  // Account insights for the last 28 days.
  try {
    const ins = await graphGet(
      `${igUserId}/insights`,
      { metric: "reach,profile_views,website_clicks", period: "days_28", metric_type: "total_value" },
      token,
      { revalidate: 900 },
    );
    const data = ins?.data ?? [];
    const reach = readInsight(byName(data, "reach"));
    const views = readInsight(byName(data, "views")) ?? readInsight(byName(data, "impressions"));
    const profileViews = readInsight(byName(data, "profile_views"));
    const clicks = readInsight(byName(data, "website_clicks"));
    if (reach != null) out.push({ label: "Reach", value: fmt(reach), note: "Accounts reached on Instagram · 28 days." });
    if (views != null) out.push({ label: "Views", value: fmt(views), note: "Content views on Instagram · 28 days." });
    if (profileViews != null) out.push({ label: "Profile visits", value: fmt(profileViews), note: "Instagram profile visits · 28 days." });
    if (clicks != null) out.push({ label: "Link clicks", value: fmt(clicks), note: "Website taps from Instagram · 28 days." });
  } catch {
    /* skip */
  }
  return out;
}

async function facebookMetrics(pageId: string, token: string): Promise<MetricRow[]> {
  const out: MetricRow[] = [];
  try {
    const ins = await graphGet(
      `${pageId}/insights`,
      { metric: "page_impressions_unique,page_post_engagements,page_fans", period: "days_28" },
      token,
      { revalidate: 900 },
    );
    const data = ins?.data ?? [];
    const reach = readInsight(byName(data, "page_impressions_unique"));
    const engagements = readInsight(byName(data, "page_post_engagements"));
    const fans = readInsight(byName(data, "page_fans"));
    if (fans != null) out.push({ label: "Facebook followers", value: fmt(fans), note: "Total Page followers." });
    if (reach != null) out.push({ label: "Facebook reach", value: fmt(reach), note: "People reached on Facebook · 28 days." });
    if (engagements != null) out.push({ label: "Facebook engagement", value: fmt(engagements), note: "Post engagements · 28 days." });
  } catch {
    /* skip */
  }
  return out;
}

async function adCampaigns(adAccountId: string, token: string): Promise<{ campaigns: Campaign[]; spend: string }> {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const res = await graphGet(
      `${act}/insights`,
      { level: "campaign", date_preset: "last_30d", fields: "campaign_name,spend,reach,impressions,frequency,cpm" },
      token,
      { revalidate: 900 },
    );
    const data: any[] = res?.data ?? [];
    let total = 0;
    const campaigns: Campaign[] = data.map((row) => {
      const spendNum = Number(row.spend) || 0;
      total += spendNum;
      return {
        name: row.campaign_name || "Campaign",
        period: "Last 30 days",
        type: "",
        spend: spendNum ? `$${spendNum.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "",
        reach: fmt(Number(row.reach) || 0),
        impressions: fmt(Number(row.impressions) || 0),
        freq: row.frequency ? Number(row.frequency).toFixed(2) : "",
        cpm: row.cpm ? `$${Number(row.cpm).toFixed(2)}` : "",
        desc: "",
      };
    });
    return { campaigns, spend: total ? `$${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "" };
  } catch {
    return { campaigns: [], spend: "" };
  }
}

// Pull everything we can for a connection. Each section is best-effort.
export async function fetchMetaAnalysis(conn: MetaConnection): Promise<MetaAnalysis> {
  const organic: MetricRow[] = [];
  if (conn.igUserId) organic.push(...(await instagramMetrics(conn.igUserId, conn.pageToken)));
  if (conn.fbPageId) organic.push(...(await facebookMetrics(conn.fbPageId, conn.pageToken)));
  const { campaigns, spend } = conn.adAccountId ? await adCampaigns(conn.adAccountId, conn.pageToken) : { campaigns: [], spend: "" };
  return { organic, campaigns, spend };
}

// Cached on-view fetch (15 min) — the token is read inside and never returned,
// so the cache holds only derived numbers. Returns null on any failure, so the
// portal falls back to the saved/manual metrics.
export const getLiveMetaAnalysis = unstable_cache(
  async (clientId: number): Promise<MetaAnalysis | null> => {
    const conn = await getMetaConnection(clientId);
    if (!conn) return null;
    try {
      return await fetchMetaAnalysis(conn);
    } catch {
      return null;
    }
  },
  ["meta-live-analysis"],
  { revalidate: 900, tags: ["meta-live"] },
);
