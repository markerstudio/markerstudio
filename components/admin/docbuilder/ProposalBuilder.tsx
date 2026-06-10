"use client";

// Proposal builder — edit every section of the paged document on the left,
// watch the real document re-render live on the right. Saves to the client's
// JSONB data; send/unsend controls what the client can see.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GanttPhase, ProposalDoc } from "@/lib/docs";
import { saveProposalDoc, setProposalSent, resetProposalAcceptance } from "@/app/admin/doc-actions";
import ProposalDocument, { type ProposalAcceptedInfo } from "@/components/docs/ProposalDocument";
import { Acc, AddBtn, ItemCard, ItemTools, LInput, Lbl, NumInput, TextInput, ThemePicker, Toggle } from "./ui";

const blankL = { en: "", ar: "" };

export default function ProposalBuilder({
  slug,
  clientName,
  initialDoc,
  status,
  accepted,
  sentAt,
}: {
  slug: string;
  clientName: string;
  initialDoc: ProposalDoc;
  status: "draft" | "sent" | "accepted";
  accepted: ProposalAcceptedInfo | null;
  sentAt?: string;
}) {
  const [doc, setDoc] = useState<ProposalDoc>(initialDoc);
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "error">("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(status !== "draft");
  const [errMsg, setErrMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

  // Deep-clone update — keeps the editor code terse and the doc immutable.
  const up = (fn: (d: ProposalDoc) => void) => {
    setDoc((prev) => {
      const c = JSON.parse(JSON.stringify(prev)) as ProposalDoc;
      fn(c);
      return c;
    });
    setDirty(true);
    setSaving("");
  };

  async function save(): Promise<boolean> {
    setSaving("saving");
    setErrMsg("");
    const r = await saveProposalDoc(slug, JSON.stringify(doc));
    if (r.ok) {
      setSaving("saved");
      setDirty(false);
      setTimeout(() => setSaving(""), 1800);
      return true;
    }
    setSaving("error");
    setErrMsg(r.error || "Save failed.");
    return false;
  }

  async function toggleSend() {
    setSending(true);
    setErrMsg("");
    if (dirty && !(await save())) {
      setSending(false);
      return;
    }
    const r = await setProposalSent(slug, !sent);
    if (r.ok) setSent(!sent);
    else setErrMsg(r.error || "Couldn't update send state.");
    setSending(false);
    router.refresh();
  }

  async function resetAcceptance() {
    if (!window.confirm("Clear the client's recorded acceptance so the proposal can be revised and re-accepted?")) return;
    await resetProposalAcceptance(slug);
    router.refresh();
  }

  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };

  const statusPill = useMemo(() => {
    if (accepted) return <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-green-100 text-green-800">Accepted ✓</span>;
    if (sent) return <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-orange-100 text-orange-deep">Sent — awaiting acceptance</span>;
    return <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-neutral-100 text-neutral-600">Draft — hidden from client</span>;
  }, [accepted, sent]);

  return (
    <div className="-mx-4 sm:-mx-6">
      {/* ---- builder toolbar ---- */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/admin/proposals" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">← Proposals</Link>
        <div className="font-bold tracking-tight">{clientName}</div>
        {statusPill}
        {sentAt && <span className="text-[11px] text-neutral-400">sent {new Date(sentAt).toLocaleDateString("en-GB")}</span>}
        <div className="flex-1" />
        {errMsg && <span className="text-xs font-medium text-red-600">{errMsg}</span>}
        {accepted && (
          <button onClick={resetAcceptance} className="text-xs font-semibold text-neutral-400 hover:text-red-600">
            Reset acceptance
          </button>
        )}
        <a href={`/portal/${slug}/proposal`} target="_blank" className="text-sm font-semibold text-neutral-600 hover:text-orange">
          Client view ↗
        </a>
        <button
          onClick={save}
          className={`text-sm font-semibold rounded-md px-4 py-2 border transition-colors ${
            dirty ? "bg-charcoal text-white border-charcoal hover:bg-ink" : "bg-white text-neutral-500 border-neutral-200"
          }`}
        >
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved ✓" : saving === "error" ? "Retry save" : dirty ? "Save changes" : "Saved"}
        </button>
        <button
          onClick={toggleSend}
          disabled={sending}
          className={`text-sm font-semibold rounded-md px-4 py-2 transition-colors disabled:opacity-60 ${
            sent ? "bg-white border border-neutral-300 text-neutral-700 hover:border-neutral-500" : "bg-orange text-white hover:bg-orange-deep"
          }`}
        >
          {sending ? "…" : sent ? "Unsend" : "Send to client →"}
        </button>
      </div>

      <div className="grid lg:grid-cols-[440px_1fr]">
        {/* ---- editor panel ---- */}
        <div className="p-4 sm:p-5 space-y-3 lg:h-[calc(100vh-130px)] lg:overflow-y-auto bg-neutral-50/60 border-r border-neutral-200">
          <Acc title="Theme & cover" hint="look, colours, title" defaultOpen>
            <ThemePicker theme={doc.theme} onChange={(t) => up((d) => (d.theme = t))} />
            <TextInput label="Document ID" value={doc.docId} onChange={(v) => up((d) => (d.docId = v))} />
            <TextInput label="Currency symbol" value={doc.currency} onChange={(v) => up((d) => (d.currency = v))} />
            <LInput label="Eyebrow (document type)" value={doc.cover.eyebrow} onChange={(v) => up((d) => (d.cover.eyebrow = v))} />
            <LInput label="Prepared for line" value={doc.cover.preparedFor} onChange={(v) => up((d) => (d.cover.preparedFor = v))} />
            <LInput label="Big title (new line = line break, *accent*)" area rows={2} value={doc.cover.title} onChange={(v) => up((d) => (d.cover.title = v))} />
            <LInput label="Cover paragraph" area rows={3} value={doc.cover.sub} onChange={(v) => up((d) => (d.cover.sub = v))} />
            <Lbl>Cover meta (4 boxes)</Lbl>
            {doc.cover.meta.map((m, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput value={m.label} onChange={(v) => up((d) => (d.cover.meta[i].label = v))} />
                    <LInput value={m.value} onChange={(v) => up((d) => (d.cover.meta[i].value = v))} />
                  </div>
                  <ItemTools onDel={() => up((d) => void d.cover.meta.splice(i, 1))} />
                </div>
              </ItemCard>
            ))}
            {doc.cover.meta.length < 4 && (
              <AddBtn onClick={() => up((d) => d.cover.meta.push({ label: { ...blankL }, value: { ...blankL } }))}>Meta box</AddBtn>
            )}
          </Acc>

          <Acc title="01 · Overview" hint="intro, team, glance stats">
            <Toggle label="Include this page" checked={doc.overview.enabled} onChange={(v) => up((d) => (d.overview.enabled = v))} />
            <LInput label="Kicker" value={doc.overview.kicker} onChange={(v) => up((d) => (d.overview.kicker = v))} />
            <LInput label="Title" value={doc.overview.title} onChange={(v) => up((d) => (d.overview.title = v))} />
            <Lbl>Paragraphs</Lbl>
            {doc.overview.paras.map((p, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <LInput area rows={3} value={p} onChange={(v) => up((d) => (d.overview.paras[i] = v))} />
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.overview.paras, i, -1))}
                    onDown={() => up((d) => move(d.overview.paras, i, 1))}
                    onDel={() => up((d) => void d.overview.paras.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.overview.paras.push({ ...blankL }))}>Paragraph</AddBtn>
            <LInput label="Glance panel title" value={doc.overview.glanceTitle} onChange={(v) => up((d) => (d.overview.glanceTitle = v))} />
            <Lbl>Glance stats</Lbl>
            {doc.overview.stats.map((st, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label="Number" value={st.n} onChange={(v) => up((d) => (d.overview.stats[i].n = v))} />
                    <LInput label="Caption" area rows={2} value={st.d} onChange={(v) => up((d) => (d.overview.stats[i].d = v))} />
                  </div>
                  <ItemTools onDel={() => up((d) => void d.overview.stats.splice(i, 1))} />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.overview.stats.push({ n: { ...blankL }, d: { ...blankL } }))}>Stat</AddBtn>
            <Lbl>Team</Lbl>
            {doc.overview.team.map((m, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <TextInput label="Name" value={m.name} onChange={(v) => up((d) => (d.overview.team[i].name = v))} />
                    <LInput label="Role" value={m.role} onChange={(v) => up((d) => (d.overview.team[i].role = v))} />
                  </div>
                  <ItemTools onDel={() => up((d) => void d.overview.team.splice(i, 1))} />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.overview.team.push({ name: "", role: { ...blankL } }))}>Team member</AddBtn>
            <LInput label="Signature label" value={doc.overview.signLabel} onChange={(v) => up((d) => (d.overview.signLabel = v))} />
            <TextInput label="Signature names" value={doc.overview.signNames} onChange={(v) => up((d) => (d.overview.signNames = v))} />
            <LInput label="Signature role line" value={doc.overview.signRole} onChange={(v) => up((d) => (d.overview.signRole = v))} />
            <TextInput label="Contact line" value={doc.overview.contact} onChange={(v) => up((d) => (d.overview.contact = v))} />
          </Acc>

          <Acc title="02 · The project" hint="strengths / challenges / audience">
            <Toggle label="Include this page" checked={doc.understanding.enabled} onChange={(v) => up((d) => (d.understanding.enabled = v))} />
            <LInput label="Kicker" value={doc.understanding.kicker} onChange={(v) => up((d) => (d.understanding.kicker = v))} />
            <LInput label="Title" value={doc.understanding.title} onChange={(v) => up((d) => (d.understanding.title = v))} />
            {doc.understanding.cards.map((c, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-[64px_1fr] gap-1.5">
                      <TextInput label="No." value={c.no} onChange={(v) => up((d) => (d.understanding.cards[i].no = v))} />
                      <LInput label="Card title" value={c.title} onChange={(v) => up((d) => (d.understanding.cards[i].title = v))} />
                    </div>
                    <LInput label="Subtitle (other language)" value={c.sub} onChange={(v) => up((d) => (d.understanding.cards[i].sub = v))} />
                    <Lbl>Bullets</Lbl>
                    {c.bullets.map((b, j) => (
                      <div className="flex items-start gap-2" key={j}>
                        <div className="flex-1">
                          <LInput area rows={2} value={b} onChange={(v) => up((d) => (d.understanding.cards[i].bullets[j] = v))} />
                        </div>
                        <ItemTools onDel={() => up((d) => void d.understanding.cards[i].bullets.splice(j, 1))} />
                      </div>
                    ))}
                    <AddBtn onClick={() => up((d) => d.understanding.cards[i].bullets.push({ ...blankL }))}>Bullet</AddBtn>
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.understanding.cards, i, -1))}
                    onDown={() => up((d) => move(d.understanding.cards, i, 1))}
                    onDel={() => up((d) => void d.understanding.cards.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.understanding.cards.push({ no: `2.${d.understanding.cards.length + 1}`, title: { ...blankL }, sub: { ...blankL }, bullets: [{ ...blankL }] }))}>
              Card
            </AddBtn>
          </Acc>

          <Acc title="03 · Scope" hint="the workstreams">
            <Toggle label="Include this page" checked={doc.scope.enabled} onChange={(v) => up((d) => (d.scope.enabled = v))} />
            <LInput label="Kicker" value={doc.scope.kicker} onChange={(v) => up((d) => (d.scope.kicker = v))} />
            <LInput label="Title" value={doc.scope.title} onChange={(v) => up((d) => (d.scope.title = v))} />
            <LInput label="Intro paragraph" area rows={3} value={doc.scope.intro} onChange={(v) => up((d) => (d.scope.intro = v))} />
            {doc.scope.cards.map((c, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-[64px_1fr] gap-1.5">
                      <TextInput label="No." value={c.no} onChange={(v) => up((d) => (d.scope.cards[i].no = v))} />
                      <LInput label="Title" value={c.title} onChange={(v) => up((d) => (d.scope.cards[i].title = v))} />
                    </div>
                    <LInput label="Flag (e.g. Recommended start — blank = none)" value={c.flag} onChange={(v) => up((d) => (d.scope.cards[i].flag = v))} />
                    <LInput label="Subtitle (other language)" value={c.sub} onChange={(v) => up((d) => (d.scope.cards[i].sub = v))} />
                    <LInput label="Description" area rows={3} value={c.desc} onChange={(v) => up((d) => (d.scope.cards[i].desc = v))} />
                    <Lbl>Bullets</Lbl>
                    {c.bullets.map((b, j) => (
                      <div className="flex items-start gap-2" key={j}>
                        <div className="flex-1">
                          <LInput value={b} onChange={(v) => up((d) => (d.scope.cards[i].bullets[j] = v))} />
                        </div>
                        <ItemTools onDel={() => up((d) => void d.scope.cards[i].bullets.splice(j, 1))} />
                      </div>
                    ))}
                    <AddBtn onClick={() => up((d) => d.scope.cards[i].bullets.push({ ...blankL }))}>Bullet</AddBtn>
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.scope.cards, i, -1))}
                    onDown={() => up((d) => move(d.scope.cards, i, 1))}
                    onDel={() => up((d) => void d.scope.cards.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.scope.cards.push({ no: String(d.scope.cards.length + 1).padStart(2, "0"), flag: { ...blankL }, title: { ...blankL }, sub: { ...blankL }, desc: { ...blankL }, bullets: [{ ...blankL }] }))}>
              Scope card
            </AddBtn>
          </Acc>

          <Acc title="04 · Work plan" hint="the gantt">
            <Toggle label="Include this page" checked={doc.workplan.enabled} onChange={(v) => up((d) => (d.workplan.enabled = v))} />
            <LInput label="Kicker" value={doc.workplan.kicker} onChange={(v) => up((d) => (d.workplan.kicker = v))} />
            <LInput label="Title" value={doc.workplan.title} onChange={(v) => up((d) => (d.workplan.title = v))} />
            <NumInput
              label="Weeks (columns)"
              value={doc.workplan.weeks}
              onChange={(v) =>
                up((d) => {
                  d.workplan.weeks = Math.max(1, Math.min(12, Math.round(v)));
                  d.workplan.phases.forEach((p) => {
                    while (p.cells.length < d.workplan.weeks) p.cells.push(0);
                    p.cells.length = d.workplan.weeks;
                  });
                })
              }
            />
            {doc.workplan.phases.map((p, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label="Phase" value={p.name} onChange={(v) => up((d) => (d.workplan.phases[i].name = v))} />
                    <LInput label="Small line under it" value={p.alt} onChange={(v) => up((d) => (d.workplan.phases[i].alt = v))} />
                    <Lbl>Bars — click a week to cycle empty → solid → soft</Lbl>
                    <div className="flex gap-1">
                      {Array.from({ length: doc.workplan.weeks }, (_, w) => {
                        const cell = p.cells[w] || 0;
                        return (
                          <button
                            key={w}
                            type="button"
                            title={`W${w + 1}`}
                            onClick={() => up((d) => (d.workplan.phases[i].cells[w] = ((d.workplan.phases[i].cells[w] || 0) + 1) % 3))}
                            className={`h-6 flex-1 rounded-sm border text-[9px] font-bold ${
                              cell === 1
                                ? "bg-orange border-orange text-white"
                                : cell === 2
                                ? "bg-orange-100 border-orange-100 text-orange-deep"
                                : "bg-white border-neutral-200 text-neutral-300"
                            }`}
                          >
                            {w + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.workplan.phases, i, -1))}
                    onDown={() => up((d) => move(d.workplan.phases, i, 1))}
                    onDel={() => up((d) => void d.workplan.phases.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn
              onClick={() =>
                up((d) => {
                  const cells = Array.from({ length: d.workplan.weeks }, () => 0) as number[];
                  d.workplan.phases.push({ name: { ...blankL }, alt: { ...blankL }, cells } as GanttPhase);
                })
              }
            >
              Phase
            </AddBtn>
            <Lbl>Footer boxes</Lbl>
            {doc.workplan.foot.map((f, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput value={f.label} onChange={(v) => up((d) => (d.workplan.foot[i].label = v))} />
                    <LInput value={f.value} onChange={(v) => up((d) => (d.workplan.foot[i].value = v))} />
                  </div>
                  <ItemTools onDel={() => up((d) => void d.workplan.foot.splice(i, 1))} />
                </div>
              </ItemCard>
            ))}
            {doc.workplan.foot.length < 3 && (
              <AddBtn onClick={() => up((d) => d.workplan.foot.push({ label: { ...blankL }, value: { ...blankL } }))}>Footer box</AddBtn>
            )}
          </Acc>

          <Acc title="05 · Investment" hint="plans & pricing — client can select">
            <Toggle label="Include this page" checked={doc.investment.enabled} onChange={(v) => up((d) => (d.investment.enabled = v))} />
            <LInput label="Kicker" value={doc.investment.kicker} onChange={(v) => up((d) => (d.investment.kicker = v))} />
            <LInput label="Title" value={doc.investment.title} onChange={(v) => up((d) => (d.investment.title = v))} />
            <LInput label="Selection note (summary bar)" area rows={2} value={doc.investment.hint} onChange={(v) => up((d) => (d.investment.hint = v))} />
            {doc.investment.groups.map((g, gi) => (
              <ItemCard key={gi}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label="Group title" value={g.title} onChange={(v) => up((d) => (d.investment.groups[gi].title = v))} />
                    <LInput label="Group subtitle" value={g.sub} onChange={(v) => up((d) => (d.investment.groups[gi].sub = v))} />
                    <div>
                      <Lbl>Selection mode</Lbl>
                      <div className="flex gap-1.5">
                        {(["single", "multi"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => up((d) => (d.investment.groups[gi].mode = m))}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                              g.mode === m ? "bg-charcoal text-white border-charcoal" : "bg-white text-neutral-600 border-neutral-200"
                            }`}
                          >
                            {m === "single" ? "Choose one" : "Choose any"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {g.plans.map((p, pi) => (
                      <div key={p.key} className="border border-neutral-200 rounded-lg p-2.5 space-y-2 bg-white">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <LInput label="Plan title" value={p.title} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].title = v))} />
                            <LInput label="Small line (other language)" value={p.sub} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].sub = v))} />
                            <LInput label="Description" area rows={2} value={p.desc} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].desc = v))} />
                            <div className="grid grid-cols-3 gap-1.5">
                              <NumInput label="Price" value={p.price} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].price = v))} />
                              <NumInput label="Old price (0 = none)" value={p.oldPrice || 0} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].oldPrice = v || undefined))} />
                              <div>
                                <Lbl>Billing</Lbl>
                                <div className="flex gap-1">
                                  {(["mo", "once"] as const).map((per) => (
                                    <button
                                      key={per}
                                      type="button"
                                      onClick={() => up((d) => (d.investment.groups[gi].plans[pi].period = per))}
                                      className={`px-2 py-1.5 rounded-md text-xs font-semibold border flex-1 ${
                                        p.period === per ? "bg-charcoal text-white border-charcoal" : "bg-white text-neutral-600 border-neutral-200"
                                      }`}
                                    >
                                      {per === "mo" ? "/mo" : "once"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <LInput label="Badge (e.g. Recommended — blank = none)" value={p.badge} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].badge = v))} />
                            <Toggle label="Pre-selected" checked={p.selected} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].selected = v))} />
                            <Lbl>Features</Lbl>
                            {p.features.map((f, fi) => (
                              <div className="flex items-start gap-2" key={fi}>
                                <div className="flex-1">
                                  <LInput value={f} onChange={(v) => up((d) => (d.investment.groups[gi].plans[pi].features[fi] = v))} />
                                </div>
                                <ItemTools onDel={() => up((d) => void d.investment.groups[gi].plans[pi].features.splice(fi, 1))} />
                              </div>
                            ))}
                            <AddBtn onClick={() => up((d) => d.investment.groups[gi].plans[pi].features.push({ ...blankL }))}>Feature</AddBtn>
                          </div>
                          <ItemTools
                            onUp={() => up((d) => move(d.investment.groups[gi].plans, pi, -1))}
                            onDown={() => up((d) => move(d.investment.groups[gi].plans, pi, 1))}
                            onDel={() => up((d) => void d.investment.groups[gi].plans.splice(pi, 1))}
                          />
                        </div>
                      </div>
                    ))}
                    <AddBtn
                      onClick={() =>
                        up((d) =>
                          d.investment.groups[gi].plans.push({
                            key: `plan-${Date.now()}`,
                            title: { ...blankL },
                            sub: { ...blankL },
                            desc: { ...blankL },
                            features: [],
                            price: 0,
                            period: "mo",
                            badge: { ...blankL },
                            selected: false,
                          })
                        )
                      }
                    >
                      Plan / line item
                    </AddBtn>
                  </div>
                  <ItemTools onDel={() => up((d) => void d.investment.groups.splice(gi, 1))} />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.investment.groups.push({ title: { ...blankL }, sub: { ...blankL }, mode: "multi", plans: [] }))}>
              Pricing group
            </AddBtn>
            <LInput label="Fine print" area rows={3} value={doc.investment.note} onChange={(v) => up((d) => (d.investment.note = v))} />
          </Acc>

          <Acc title="06 · Why Marker" hint="the editorial page">
            <Toggle label="Include this page" checked={doc.why.enabled} onChange={(v) => up((d) => (d.why.enabled = v))} />
            <LInput label="Kicker" value={doc.why.kicker} onChange={(v) => up((d) => (d.why.kicker = v))} />
            <LInput label="Title" value={doc.why.title} onChange={(v) => up((d) => (d.why.title = v))} />
            {doc.why.paras.map((p, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <LInput area rows={3} value={p} onChange={(v) => up((d) => (d.why.paras[i] = v))} />
                  </div>
                  <ItemTools onDel={() => up((d) => void d.why.paras.splice(i, 1))} />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.why.paras.push({ ...blankL }))}>Paragraph</AddBtn>
            <LInput label="Quote" area rows={2} value={doc.why.quote} onChange={(v) => up((d) => (d.why.quote = v))} />
            <LInput label="Quote (other language)" value={doc.why.quoteSub} onChange={(v) => up((d) => (d.why.quoteSub = v))} />
            <TextInput label="Quote attribution" value={doc.why.quoteMark} onChange={(v) => up((d) => (d.why.quoteMark = v))} />
          </Acc>

          <Acc title="07 · Acceptance" hint="terms & the form">
            <LInput label="Kicker" value={doc.acceptance.kicker} onChange={(v) => up((d) => (d.acceptance.kicker = v))} />
            <LInput label="Title" value={doc.acceptance.title} onChange={(v) => up((d) => (d.acceptance.title = v))} />
            <LInput label="Body" area rows={3} value={doc.acceptance.body} onChange={(v) => up((d) => (d.acceptance.body = v))} />
            <Lbl>Terms</Lbl>
            {doc.acceptance.terms.map((tm, i) => (
              <div className="flex items-start gap-2" key={i}>
                <div className="flex-1">
                  <LInput area rows={2} value={tm} onChange={(v) => up((d) => (d.acceptance.terms[i] = v))} />
                </div>
                <ItemTools onDel={() => up((d) => void d.acceptance.terms.splice(i, 1))} />
              </div>
            ))}
            <AddBtn onClick={() => up((d) => d.acceptance.terms.push({ ...blankL }))}>Term</AddBtn>
            <LInput label="Stamp line" value={doc.acceptance.stampLine} onChange={(v) => up((d) => (d.acceptance.stampLine = v))} />
          </Acc>

          {accepted && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-sm text-green-900 space-y-1">
              <div className="font-bold">Client acceptance</div>
              <div>
                {accepted.by || "—"}
                {accepted.title ? ` · ${accepted.title}` : ""} · {new Date(accepted.at).toLocaleString("en-GB")}
              </div>
              {accepted.selection && accepted.selection.items.length > 0 && (
                <div>
                  Selected: {accepted.selection.items.map((i) => `${i.label} (${i.price.toLocaleString("en-US")} ${accepted.selection?.currency}${i.period === "mo" ? "/mo" : ""})`).join(" · ")}
                </div>
              )}
              {accepted.notes && <div className="text-green-800">“{accepted.notes}”</div>}
            </div>
          )}
        </div>

        {/* ---- live preview ---- */}
        <div className="lg:h-[calc(100vh-130px)] lg:overflow-y-auto bg-[#33312e]">
          <ProposalDocument doc={doc} clientName={clientName} clientSlug={slug} mode="preview" status={accepted ? "accepted" : sent ? "sent" : "draft"} accepted={accepted} />
        </div>
      </div>
    </div>
  );
}
