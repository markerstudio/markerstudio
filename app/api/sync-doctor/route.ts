// Sync doctor — one-page diagnosis of the payment→Notion mirror.
//
// Answers, from INSIDE the live app (its real env vars, token, and database),
// the questions that can't be answered from outside:
//   1. What do the recent payment rows actually say (synced_at / page_ids /
//      error / attempts)?
//   2. Which Notion database id is the app actually writing to, and can the
//      app's token read AND write it right now? (Performs a real test write,
//      then archives it.)
//   3. Why is / isn't the Finance page's red banner showing (pending counts
//      under each filter)?
//
// Admin-only, read-mostly (the only write is the archived test row).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSql, isDbEnabled } from "@/lib/db";
import { notionGet, notionPost, notionPatch, notionArchivePage } from "@/lib/notion";
import { notionSyncHealth } from "@/lib/payments";

export const dynamic = "force-dynamic";

const INCOME_DB = process.env.NOTION_INCOME_DB || "1822487b8e7e81d4821bede793d640d5";
const ARAB_BANK_ILS = process.env.NOTION_ARAB_BANK_ILS || "1cb2487b8e7e80a0a743f56fdbe7bcdf";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // One-time helper: ?fillUsdIls=3.5 fills the "USD in ILS" column for every
  // Income row that has dollars but no frozen value yet, at USD × the given
  // rate. Used to baseline HISTORICAL dollar payments at the legacy formula
  // rate so old balances stay exactly as they were — new payments get the real
  // pay-day rate stamped automatically and are never touched here (only empty
  // cells are filled, so this is idempotent and can't overwrite anything).
  const fillRate = parseFloat(new URL(req.url).searchParams.get("fillUsdIls") || "");
  if (Number.isFinite(fillRate) && fillRate >= 0.5 && fillRate <= 10) {
    const filled: { name: string; usd: number; ilsValue: number }[] = [];
    const errors: string[] = [];
    try {
      const q = await notionPost(`/v1/databases/${INCOME_DB}/query`, {
        filter: {
          and: [
            { property: "USD", number: { is_not_empty: true } },
            { property: "USD in ILS", number: { is_empty: true } },
          ],
        },
        page_size: 100,
      });
      for (const r of q.results || []) {
        const usd = r?.properties?.USD?.number;
        if (!r?.id || !(typeof usd === "number" && usd > 0)) continue;
        const ilsValue = usd * fillRate;
        try {
          await notionPatch(`/v1/pages/${r.id}`, { properties: { "USD in ILS": { number: ilsValue } } });
          filled.push({
            name: ((r.properties?.Name?.title || []) as any[]).map((t) => t.plain_text).join("") || "?",
            usd,
            ilsValue,
          });
        } catch (e) {
          errors.push(`${r.id}: ${(e as Error)?.message || String(e)}`);
        }
      }
      return NextResponse.json({ action: "fillUsdIls", rate: fillRate, filledCount: filled.length, filled, errors });
    } catch (e) {
      return NextResponse.json({ action: "fillUsdIls", error: String((e as Error)?.message || e) }, { status: 500 });
    }
  }

  const out: Record<string, any> = {
    env: {
      hasNotionToken: !!process.env.NOTION_TOKEN,
      notionTokenPrefix: (process.env.NOTION_TOKEN || "").slice(0, 8) || null,
      incomeDbUsed: INCOME_DB,
      incomeDbOverridden: !!process.env.NOTION_INCOME_DB,
      dbEnabled: isDbEnabled(),
    },
  };

  // ---- 1. Local ledger state ------------------------------------------------
  try {
    const sql = getSql();
    out.payments = (await sql`
      SELECT p.id, p.number, p.client_slug, p.amount::float AS amount, p.currency,
             p.paid_on::text AS paid_on, p.created_at::text AS created_at,
             p.notion_synced_at::text AS synced_at, p.notion_page_ids AS page_ids,
             p.notion_error AS error, p.notion_sync_attempts AS attempts,
             COALESCE(c.data->>'notionPageId', '') AS client_notion_page,
             COALESCE(c.data->>'owner', '') AS client_owner
      FROM invoice_payments p
      LEFT JOIN clients c ON c.slug = p.client_slug
      ORDER BY p.id DESC LIMIT 25
    `) as unknown as any[];

    // Pending counts under each filter, to explain exactly why the red banner
    // does or doesn't show.
    const counts = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE p.notion_synced_at IS NULL) AS pending_any,
        COUNT(*) FILTER (WHERE p.notion_synced_at IS NULL AND p.amount > 0) AS pending_positive,
        COUNT(*) FILTER (
          WHERE p.notion_synced_at IS NULL AND p.amount > 0
            AND COALESCE(c.data->>'notionPageId', '') <> ''
            AND COALESCE(c.data->>'owner', '') <> 'ramzi'
        ) AS pending_linked,
        COUNT(*) FILTER (
          WHERE p.notion_synced_at IS NULL AND p.amount > 0
            AND COALESCE(c.data->>'notionPageId', '') <> ''
            AND COALESCE(c.data->>'owner', '') <> 'ramzi'
            AND p.paid_on > CURRENT_DATE - INTERVAL '365 days'
        ) AS pending_banner
      FROM invoice_payments p
      LEFT JOIN clients c ON c.slug = p.client_slug
    `) as unknown as any[];
    out.pendingCounts = counts[0];
    out.health = await notionSyncHealth();
  } catch (e) {
    out.dbError = String((e as Error)?.message || e);
  }

  // ---- 2. Can the app's token read the Income DB it writes to? --------------
  try {
    const db = await notionGet(`/v1/databases/${INCOME_DB}`);
    out.notionRead = {
      ok: true,
      dbTitle: (db?.title || []).map((t: any) => t.plain_text).join(""),
      dbId: db?.id,
    };
  } catch (e) {
    out.notionRead = { ok: false, error: String((e as Error)?.message || e) };
  }

  // ---- 3. Can it WRITE? Real test rows, archived immediately. ---------------
  try {
    const res = await notionPost(`/v1/pages`, {
      parent: { database_id: INCOME_DB },
      properties: { Name: { title: [{ text: { content: "SYNC DOCTOR TEST — safe to delete" } }] } },
    });
    out.notionWriteMinimal = { ok: true, pageId: res?.id || null };
    if (res?.id) await notionArchivePage(res.id);
  } catch (e) {
    out.notionWriteMinimal = { ok: false, error: String((e as Error)?.message || e) };
  }

  // Full-shape write — same properties a real payment sync uses, so a
  // relation-specific failure (e.g. the bank-account page) shows up here.
  try {
    const res = await notionPost(`/v1/pages`, {
      parent: { database_id: INCOME_DB },
      properties: {
        Name: { title: [{ text: { content: "SYNC DOCTOR TEST (full) — safe to delete" } }] },
        "Pay Date": { date: { start: new Date().toISOString().slice(0, 10) } },
        ILS: { number: 1 },
        "ILS Account": { relation: [{ id: ARAB_BANK_ILS }] },
      },
    });
    out.notionWriteFull = { ok: true, pageId: res?.id || null };
    if (res?.id) await notionArchivePage(res.id);
  } catch (e) {
    out.notionWriteFull = { ok: false, error: String((e as Error)?.message || e) };
  }

  return NextResponse.json(out);
}
