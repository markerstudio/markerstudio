"use client";

import type { ReactNode } from "react";
import { amountLabelToIls } from "@/lib/money";
import { saveSection } from "@/app/admin/clients/section-actions";
import { input, lbl, fmtIls, splitAmount, joinAmount, Text, Rows, SaveButton } from "./fields";
import type { ClientData, Invoice } from "@/lib/clients";

// Client-safe mirror of computeClientFinance (lib/clients is server-only).
function computeFinance(data: ClientData) {
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

// Mirrors the portal's Finance tab. Fees + payment history are editable here; when
// the client is linked to Notion, money-left and paid% are owned by Notion (shown
// read-only at the page top) so this tab does NOT recompute/persist them.
export default function FinanceTab({
  slug,
  data,
  patch,
  linkedToNotion,
  invoicesSlot,
}: {
  slug: string;
  data: ClientData;
  patch: (p: Partial<ClientData>) => void;
  linkedToNotion: boolean;
  invoicesSlot?: ReactNode;
}) {
  const fin = computeFinance(data);
  const patchFinance = (p: Partial<ClientData["finance"]>) =>
    patch({ finance: { ...data.finance, monthlyFee: data.finance?.monthlyFee ?? "", progress: data.finance?.progress ?? 0, ...p } });

  function save() {
    if (linkedToNotion) return saveSection(slug, { finance: data.finance, invoices: data.invoices });
    return saveSection(slug, {
      plan: { ...data.plan, balance: fmtIls(fin.moneyLeftIls) },
      finance: { ...data.finance, progress: fin.paidPct },
      invoices: data.invoices,
    });
  }

  return (
    <div className="space-y-6">
      <fieldset className="lq-card p-5">
        <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Finance</legend>
        <p className="text-xs text-charcoal-40 mb-3">Money left and Paid % calculate themselves from the payments below (USD converted to ILS). Set Total agreed and mark each payment Paid as it comes in — leave Total blank to derive it from the rows. Stories fee is collected for Ramzi: it stays on the client&apos;s invoice but never counts as Marker income or syncs to Notion.</p>
        {linkedToNotion && (
          <div className="mb-4 lq-well px-4 py-3 text-sm text-charcoal-60 leading-relaxed">
            Linked to <b>Notion</b> — its Budget Tracker owns this client&apos;s money. <b>Money left</b> and <b>Paid&nbsp;%</b> come from <b>Refresh from Notion</b> (top of the page); the figures below are a local portal copy and saving here won&apos;t change them. The <b>Stories&nbsp;· Ramzi</b> fee is app-only and is managed here.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-5">
          <Text label="Monthly fee (marketing)" value={data.finance?.monthlyFee ?? ""} onChange={(monthlyFee) => patchFinance({ monthlyFee })} placeholder="e.g. 1,800 ILS" />
          <Text label="Branding fee (fixed)" value={data.finance?.brandingFee ?? ""} onChange={(brandingFee) => patchFinance({ brandingFee })} placeholder="e.g. 2,500 ILS" />
          <Text label="Total agreed" value={data.finance?.totalAgreed ?? ""} onChange={(totalAgreed) => patchFinance({ totalAgreed })} placeholder="e.g. 2,425 ILS" />
          <Text label="Stories fee · Ramzi" value={data.finance?.storiesFee ?? ""} onChange={(storiesFee) => patchFinance({ storiesFee })} placeholder="e.g. 30 ILS / day" />
          <div>
            <label className={lbl}>Money left · auto</label>
            <div className="w-full lq-well px-3 py-2 text-sm font-bold tabular-nums text-orange-deep">{fmtIls(fin.moneyLeftIls)}</div>
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm mb-5 lq-well px-4 py-3">
          <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!data.finance?.storiesActive} onChange={(e) => patchFinance({ storiesActive: e.target.checked })} />
          <span className="leading-relaxed"><b>This client has stories</b> (Ramzi). Turning this on connects them to <b>Ramzi&apos;s portal</b>, where he tracks the stories work and what&apos;s been collected. Stories money stays on the client&apos;s invoice and in the client&apos;s combined total, but is never Marker income or synced to Notion.</span>
        </label>
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <span className={lbl + " mb-0"}>Paid · auto</span>
            <span className="text-sm font-bold tabular-nums text-ink">{fin.paidPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-charcoal/5 overflow-hidden">
            <div className="h-full rounded-full bg-orange" style={{ width: `${fin.paidPct}%` }} />
          </div>
          <p className="text-[11px] text-charcoal-40 mt-1 tabular-nums">
            {fmtIls(fin.paidIls)} paid of {fmtIls(fin.totalIls)} total
            {fin.openIls > 0 ? ` · ${fmtIls(fin.openIls)} still due in rows` : ""}
          </p>
        </div>
        <label className={lbl}>Payment history</label>
        <Rows<Invoice> items={data.invoices} onChange={(invoices) => patch({ invoices })} blank={{ cycle: "", desc: "", amount: "", status: "paid" }} addLabel="Add payment"
          render={(inv, set) => {
            const { num, cur } = splitAmount(inv.amount);
            return (
              <div className="grid grid-cols-2 md:grid-cols-[1fr_120px_96px_110px] gap-3 pr-16 items-end">
                <div className="col-span-2 md:col-span-1"><Text label="Cycle" value={inv.cycle} onChange={(cycle) => set({ cycle })} placeholder="Cycle 01 · Feb → Mar" /></div>
                <div>
                  <label className={lbl}>Amount</label>
                  <input className={`${input} text-right tabular-nums`} inputMode="decimal" value={num} placeholder="1,800" onChange={(e) => set({ amount: joinAmount(e.target.value, cur) })} />
                </div>
                <div>
                  <label className={lbl}>Currency</label>
                  <select className={input} value={cur} onChange={(e) => set({ amount: joinAmount(num, e.target.value as "ILS" | "USD") })}>
                    <option value="ILS">ILS ₪</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={input} value={inv.status} onChange={(e) => set({ status: e.target.value as Invoice["status"] })}>
                    <option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-4"><Text label="Description (optional)" value={inv.desc} onChange={(desc) => set({ desc })} /></div>
              </div>
            );
          }} />
        <SaveButton onSave={save} label="Save finance" />
      </fieldset>

      {invoicesSlot}
    </div>
  );
}
