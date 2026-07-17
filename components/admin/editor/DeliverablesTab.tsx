"use client";

import { memo, useCallback, useState } from "react";
import { saveDeliverablesSection } from "@/app/admin/deliverables/actions";
import { useSectionAutosave, SyncPill } from "./useSectionAutosave";
import { ensureDeliverableIds, genId, suggestDeliverables, mergeSuggestions, ORDER, LABELS, progress } from "@/lib/deliverables";
import { EmptyState, Toggle } from "@/components/ui/glass";
import type { ClientData, ClientDeliverables, Deliverable } from "@/lib/clients";

const input = "lq-input";
const lbl = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

// One deliverable row — memoised + keyed by id so a keystroke re-renders only this
// row and editing/removing never scrambles focus (same strategy as PlanShootsEditor).
const Row = memo(function Row({ item, onChange, onRemove }: { item: Deliverable; onChange: (id: string, patch: Partial<Deliverable>) => void; onRemove: (id: string) => void }) {
  const id = item.id!;
  const isPending = !!(item.requestedByClient && item.pending);
  return (
    <div className={`border rounded-2xl p-3 relative pr-16 ${isPending ? "border-amber-300/60 bg-amber-50/60" : "border-charcoal/5 bg-white/60"}`}>
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-semibold text-charcoal-40 hover:text-rose-700">Remove</button>
      {isPending && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="lq-chip lq-chip--orange !text-[11px]">Client request · pending</span>
          <button type="button" onClick={() => onChange(id, { pending: false })} className="lq-chip lq-chip--green lq-press !text-[11px] cursor-pointer">Approve</button>
          <button type="button" onClick={() => onRemove(id)} className="lq-chip lq-press !text-[11px] cursor-pointer hover:text-rose-700">Reject</button>
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
  const [msg, setMsg] = useState("");

  // Auto-save + offline drafts — the shared per-section contract.
  const sync = useSectionAutosave({
    slug,
    section: "deliverables",
    payload: { block },
    save: (p) => saveDeliverablesSection(slug, p.block),
    onRestore: (d) => { setBlock(ensureDeliverableIds(d.block)); setMsg("Restored unsaved changes — saving…"); },
  });

  const items = block.items ?? [];
  const prog = progress(items);
  const mark = () => setMsg("");

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
    setMsg(added > 0 ? `Added ${added} suggestion${added > 1 ? "s" : ""} — review the dates; changes save automatically.` : "No new suggestions — everything's already listed.");
  }

  return (
    <div className="space-y-6">
      {/* 1 — Who sees the task list. */}
      <section className="lq-card p-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Tracking &amp; visibility</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-3">These switches save together with the task list below.</p>
        <div className="divide-y divide-charcoal/5">
          <div className="py-1.5">
            <Toggle
              label="Track deliverables for this client"
              sub="Shows them on the studio's What's due board."
              checked={!!block.active}
              onChange={(e) => setToggle({ active: e.target.checked })}
            />
          </div>
          <div className="py-1.5">
            <Toggle
              label="Show progress to the client"
              sub="Reveals a progress bar + list in the client's portal. Off = internal only."
              checked={!!block.showToClient}
              onChange={(e) => setToggle({ showToClient: e.target.checked })}
            />
          </div>
          <div className="py-1.5">
            <Toggle
              label="Let the client request tasks"
              sub="They can submit a task with a date; it stays pending until you approve it here."
              checked={!!block.allowClientRequests}
              onChange={(e) => setToggle({ allowClientRequests: e.target.checked })}
            />
          </div>
        </div>
      </section>

      {/* 2 — The task list itself. */}
      <section className="lq-card p-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Task list</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-4">What you owe this client and by when. Generate dated to-dos from the plan cycle + proposal timeline, then track them here and on the cross-client board.</p>

        {items.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 w-20">Progress</div>
            <div className="flex-1 h-2 rounded-full bg-charcoal/5 overflow-hidden">
              <div className="h-full rounded-full bg-orange" style={{ width: `${prog.pct}%` }} />
            </div>
            <div className="text-sm font-bold tabular-nums text-ink w-24 text-right">{prog.done}/{prog.total} done</div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap mb-4">
          <button type="button" onClick={generate} className="lq-btn lq-btn--dark lq-btn--sm">✨ Generate from plan &amp; timeline</button>
          <button type="button" onClick={add} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add deliverable</button>
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <EmptyState icon="📦" title="No deliverables yet" sub="Generate them from the plan & timeline, or add one." />
          ) : (
            items.map((d) => <Row key={d.id} item={d} onChange={change} onRemove={remove} />)
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <SyncPill {...sync} />
          {msg && <span className="text-sm text-charcoal-60">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
