// The ONE client-facing money figure — used by both the portal dashboard and the
// statement so they can never disagree. Source of truth:
//   • Linked to Notion: Notion owns the marketing/branding side (Marker's books);
//     the app's stories are added on top → the client sees the combined total.
//   • Not linked: the app's own invoices (which already include stories lines).
// Notion stays Marker's internal books; this only shapes what the client sees.
import { getLiveNotionClient } from "@/lib/notion";
import { clientInvoiceFinanceIls, clientStoriesFinanceIls } from "@/lib/invoices";
import { listClientPayments, ramziAmountOf } from "@/lib/payments";
import { amountLabelToIls } from "@/lib/money";
import type { Client, Invoice } from "@/lib/clients";

export type ClientFacingMoney = {
  totalIls: number;
  paidIls: number;
  openIls: number; // "money left" — the headline figure
  progress: number; // paid %, 0–100
  balanceLabel: string; // openIls formatted, e.g. "1,800 ILS"
};

// The ISO day a history entry belongs to, for ordering the merged list —
// entries carry it in their desc ("Due 2026-07-06 · Paid 2026-07-13").
function historyDay(desc: string): string {
  const m = /Paid (\d{4}-\d{2}-\d{2})/.exec(desc || "") || /Due (\d{4}-\d{2}-\d{2})/.exec(desc || "");
  return m ? m[1] : "";
}

// Layer the STORIES side of each recorded payment into a Notion-mirrored
// payment history. Notion's Income rows are Marker's books only — the stories
// portion is collected for Ramzi and deliberately dropped on sync — so a
// 2,000 payment split 1,200 plan / 800 stories reads as "Plan Payment 1,200"
// to the client, as if 800 vanished. The client must see the full money they
// handed over, so each payment's stories portion becomes its own "Stories"
// line (matching the per-category rows Notion already produces: a payment can
// already appear as Branding + Plan Payment). Merged newest-first, same as
// the Notion list. Best-effort: with no payments table it returns the history
// unchanged.
export async function withStoriesHistory(history: Invoice[], clientSlug: string): Promise<Invoice[]> {
  let stories: { inv: Invoice; d: string }[] = [];
  try {
    stories = (await listClientPayments(clientSlug))
      .map((p) => ({ p, ramzi: ramziAmountOf(p) }))
      .filter(({ ramzi }) => ramzi > 0)
      .map(({ p, ramzi }) => {
        const day = (p.paid_on || "").slice(0, 10);
        const n = Math.round(ramzi).toLocaleString("en-US");
        return {
          inv: {
            cycle: "Stories",
            desc: day ? `Paid ${day}` : "",
            amount: p.currency === "USD" ? `$${n}` : `${n} ILS`,
            status: "paid" as const,
          },
          d: day,
        };
      });
  } catch {
    stories = [];
  }
  if (!stories.length) return history;
  const merged = [...history.map((inv) => ({ inv, d: historyDay(inv.desc) })), ...stories];
  // Stable sort, newest first; a payment's Stories line lands right beside its
  // same-day Marker rows. Undated entries sink to the end.
  merged.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  return merged.map((x) => x.inv);
}

export async function clientFacingMoney(client: Client): Promise<ClientFacingMoney> {
  const d = client.data;

  if (d.notionPageId) {
    // Marker (marketing/branding) side from Notion — live, falling back to the
    // saved snapshot if the read fails.
    let markerLeft = amountLabelToIls(d.plan?.balance || "");
    let progress = d.finance?.progress || 0;
    try {
      const live = await getLiveNotionClient(d.notionPageId);
      if (live) {
        markerLeft = amountLabelToIls(live.balance || d.plan?.balance || "");
        progress = live.progress || progress;
      }
    } catch {
      /* keep the saved figures */
    }
    // Stories the client still owes come ONLY from real invoices (a stories
    // line billed but not collected) — the same way Ramzi's own page counts
    // them. The stories fee field is a recurring RATE, not an outstanding
    // balance, so it is never phantom-added here: doing so put the whole fee
    // on every stories client's money-left forever, because collection happens
    // in Ramzi's portal and the app never sees it. The client still sees one
    // combined figure; it just tracks what's actually been invoiced.
    const stories = await clientStoriesFinanceIls(client.id, client.slug);
    const p = Math.max(0, Math.min(100, progress));
    // Reconstruct Marker's paid from (left, progress%); clamp near p=100 so the
    // ratio can't explode. Money-left stays exact regardless.
    const markerPaid = p > 0 && p < 100 ? Math.min(markerLeft * 100, (markerLeft * p) / (100 - p)) : 0;
    const totalIls = Math.round(markerPaid + markerLeft + stories.billedIls);
    const paidIls = Math.round(markerPaid + stories.collectedIls);
    const openIls = Math.max(0, Math.round(markerLeft + stories.openIls));
    const prog = totalIls > 0 ? Math.max(0, Math.min(100, Math.round((paidIls / totalIls) * 100))) : p;
    return { totalIls, paidIls, openIls, progress: prog, balanceLabel: `${openIls.toLocaleString("en-US")} ILS` };
  }

  // Unlinked: the app's own invoices already carry every line (incl. stories).
  const app = await clientInvoiceFinanceIls(client.id);
  const progress = app.totalIls > 0 ? Math.round((app.paidIls / app.totalIls) * 100) : d.finance?.progress || 0;
  return {
    totalIls: app.totalIls,
    paidIls: app.paidIls,
    openIls: app.openIls,
    progress,
    balanceLabel: `${app.openIls.toLocaleString("en-US")} ILS`,
  };
}
