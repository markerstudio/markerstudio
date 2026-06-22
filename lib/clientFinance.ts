// The ONE client-facing money figure — used by both the portal dashboard and the
// statement so they can never disagree. Source of truth:
//   • Linked to Notion: Notion owns the marketing/branding side (Marker's books);
//     the app's stories are added on top → the client sees the combined total.
//   • Not linked: the app's own invoices (which already include stories lines).
// Notion stays Marker's internal books; this only shapes what the client sees.
import { getLiveNotionClient } from "@/lib/notion";
import { clientInvoiceFinanceIls, clientStoriesFinanceIls } from "@/lib/invoices";
import { amountLabelToIls } from "@/lib/money";
import type { Client } from "@/lib/clients";

export type ClientFacingMoney = {
  totalIls: number;
  paidIls: number;
  openIls: number; // "money left" — the headline figure
  progress: number; // paid %, 0–100
  balanceLabel: string; // openIls formatted, e.g. "1,800 ILS"
};

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
