"use client";

import { memo, useCallback, useState, useTransition } from "react";
import { saveDeliverablesSection } from "@/app/admin/deliverables/actions";
import { ensureDeliverableIds, genId, suggestDeliverables, mergeSuggestions, ORDER, LABELS, progress } from "@/lib/deliverables";
import type { ClientData, ClientDeliverables, Deliverable } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

// One deliverable row — memoised + keyed by id so a keystroke re-renders only this
// row and editing/removing never scrambles focus (same strategy as PlanShootsEditor).
const Row = memo(function Row({ item, onChange, onRemove }: { item: Deliverable; onChange: (id: string, patch: Partial<Deliverable>) => void; onRemove: (id: string) => void }) {
  const id = item.id!;
  const isPending = !!(item.requestedByClient && item.pending);
  return (
    <div className={`border rounded-lg p-3 relative pr-16 ${isPending ? "border-amber-300 bg-amber-50/50" : "border-neutral-200"}`}>
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-medium text-neutral-400 hover:text-red-600">Remove</button>
      {isPending && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">Client request · pending</span>
          <button type="button" onClick={() => onChange(id, { pending: false })} className="text-[11px] font-semibold rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 hover:bg-emerald-100">Approve</button>
          <button type="button" onClick={() => onRemove(id)} className="text-[11px] font-semibold rounded-full border border-neutral-300 text-neutral-500 px-2.5 py-0.5 hover:border-red-300 hover:text-red-600">Reject</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-[1fr_150px_130px_130px] gap-3 items-end">
        <div>
          <label className={lbl}>Deliverable</label>
          <input className={input} value={item.title} placeholder="March content calendar" onChange={(e) => onChange(id, { title: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Due</label>
          <input type="date" className={input} value={item.due ?? ""} onChange={(e) => onChange(id, { due: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select className={input} value={item.status} onChange={(e) => onChange(id, { status: e.target.value as Deliverable["status"] })}>
            {ORDER.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Type</label>
          <select className={input} value={item.kind ?? "milestone"} onChange={(e) => onChange(id, { kind: e.target.value as Deliverable["kind"] })}>
            <option value="milestone">Milestone</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={lbl}>Note (optional)</label>
        <input className={input} value={item.detail ?? ""} onChange={(e) => onChange(id, { detail: e.target.value })} />
      </div>
    </div>
  );
});

// Per-client deliverables editor. Tracks what's owed + by when; can rule-generate
// dated to-dos from the plan cycle + proposal timeline (pure, client-side). Saves
// only the deliverables block (its own jsonb_set key) — independent of the rest.
export default function DeliverablesTab({ slug, data }: { slug: string; data: ClientData }) {
  const [block, setBlock] = useState<ClientDeliverables>(() => ensureDeliverableIds(data.deliverables));
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const items = block.items ?? [];
  const prog = progress(items);
  const mark = () => { setDirty(true); setMsg(""); };

  const change = useCallback((id: string, patch: Partial<Deliverable>) => {
    setBlock((b) => ({ ...b, items: (b.items ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
    mark();
  }, []);
  const remove = useCallback((id: string) => {
    setBlock((b) => ({ ...b, items: (b.items ?? []).filter((d) => d.id !== id) }));
    mark();
  }, []);
  const setToggle = (patch: Partial<ClientDeliverables>) => { setBlock((b) => ({ ...b, ...patch })); mark(); };
  const add = () => { setBlock((b) => ({ ...b, items: [...(b.items ?? []), { id: genId(), title: "", status: "todo", kind: "milestone", source: "manual", due: "" }] })); mark(); };

  function generate() {
    const before = items.length;
    const merged = mergeSuggestions(items, suggestDeliverables(data));
    setBlock((b) => ({ ...b, active: b.active ?? true, items: merged }));
    mark();
    const added = merged.length - before;
    setMsg(added > 0 ? `Added ${added} suggestion${added > 1 ? "s" : ""} — review dates, then Save.` : "No new suggestions — everything's already listed.");
  }

  function save() {
    startTransition(async () => {
      const res = await saveDeliverablesSection(slug, block);
      if (res.ok) { setDirty(false); setMsg("Saved ✓"); }
      else setMsg(res.error || "Save failed.");
    });
  }

  return (
    <div className="space-y-6">
      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Deliverables</legend>
        <p className="text-xs text-neutral-400 mb-4">What you owe this client and by when. Generate dated to-dos from the plan cycle + proposal timeline, then track them here and on the cross-client board.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!block.active} onChange={(e) => setToggle({ active: e.target.checked })} />
            <span className="leading-relaxed"><b>Track deliverables</b> for this client. Shows them on the studio&apos;s <b>What&apos;s due</b> board.</span>
          </label>
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!block.showToClient} onChange={(e) => setToggle({ showToClient: e.target.checked })} />
            <span className="leading-relaxed"><b>Show progress to the client.</b> Reveals a progress bar + list in the client&apos;s portal. Off = internal only.</span>
          </label>
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!block.allowClientRequests} onChange={(e) => setToggle({ allowClientRequests: e.target.checked })} />
            <span className="leading-relaxed"><b>Let the client request tasks.</b> They can submit a task with a date; it stays pending until you approve it here.</span>
          </label>
        </div>

        {items.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Progress</div>
            <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div className="h-full rounded-full bg-orange" style={{ width: `${prog.pct}%` }} />
            </div>
            <div className="text-sm font-bold tabular-nums text-neutral-900 w-24 text-right">{prog.done}/{prog.total} done</div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap mb-4">
          <button type="button" onClick={generate} className="bg-charcoal text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-ink transition-colors">✨ Generate from plan &amp; timeline</button>
          <button type="button" onClick={add} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add deliverable</button>
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-400">No deliverables yet. Generate them from the plan &amp; timeline, or add one.</p>
          ) : (
            items.map((d) => <Row key={d.id} item={d} onChange={change} onRemove={remove} />)
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={save} disabled={pending || !dirty} className="bg-orange text-white font-semibold rounded-md px-5 py-2 text-sm hover:bg-orange-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {pending ? "Saving…" : "Save deliverables"}
          </button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
          {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
        </div>
      </fieldset>
    </div>
  );
}
