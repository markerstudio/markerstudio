"use client";

// Agreement builder — same two-pane pattern as the proposal builder: edit the
// cover, summary, payment schedule and numbered terms on the left, live paged
// preview on the right.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AgreementDoc } from "@/lib/docs";
import { saveAgreementDoc, setAgreementSent, resetAgreementSignature } from "@/app/admin/doc-actions";
import AgreementDocument from "@/components/docs/AgreementDocument";
import AiFill from "./AiFill";
import { agreementAiPrompt, mergeAiDoc, normalizeAgreementDoc, parseAiDoc } from "./ai";
import { Acc, AddBtn, ItemCard, ItemTools, LInput, Lbl, TextInput, ThemePicker, Toggle } from "./ui";

const blankL = { en: "", ar: "" };

export default function AgreementBuilder({
  slug,
  clientName,
  initialDoc,
  status,
  signed,
  sentAt,
  briefText = "",
  packagesText = "",
}: {
  slug: string;
  clientName: string;
  initialDoc: AgreementDoc;
  status: "draft" | "sent" | "signed";
  signed: { at: string; by: string } | null;
  sentAt?: string;
  briefText?: string;
  packagesText?: string; // packages agreed on the proposal, for the AI prompt
}) {
  const [doc, setDoc] = useState<AgreementDoc>(initialDoc);
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "error">("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(status !== "draft");
  const [errMsg, setErrMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

  const up = (fn: (d: AgreementDoc) => void) => {
    setDoc((prev) => {
      const c = JSON.parse(JSON.stringify(prev)) as AgreementDoc;
      fn(c);
      return c;
    });
    setDirty(true);
    setSaving("");
  };

  async function save(): Promise<boolean> {
    setSaving("saving");
    setErrMsg("");
    const r = await saveAgreementDoc(slug, JSON.stringify(doc));
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
    const r = await setAgreementSent(slug, !sent);
    if (r.ok) setSent(!sent);
    else setErrMsg(r.error || "Couldn't update send state.");
    setSending(false);
    router.refresh();
  }

  async function resetSig() {
    if (!window.confirm("Clear the client's recorded signature so the agreement can be revised and re-signed?")) return;
    await resetAgreementSignature(slug);
    router.refresh();
  }

  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };

  const statusPill = useMemo(() => {
    if (signed) return <span className="lq-chip lq-chip--green !text-[11px]">Signed ✓</span>;
    if (sent) return <span className="lq-chip lq-chip--orange !text-[11px]">Sent — awaiting signature</span>;
    return <span className="lq-chip !text-[11px]">Draft — hidden from client</span>;
  }, [signed, sent]);

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-charcoal/10 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/admin/agreements" className="text-sm font-medium text-charcoal-60 hover:text-ink no-underline">← Agreements</Link>
        <div className="font-display font-bold tracking-tight text-ink">{clientName}</div>
        {statusPill}
        {sentAt && <span className="text-[11px] text-charcoal-40">sent {new Date(sentAt).toLocaleDateString("en-GB")}</span>}
        <div className="flex-1" />
        {errMsg && <span className="text-xs font-medium text-rose-600">{errMsg}</span>}
        {signed && (
          <button onClick={resetSig} className="text-xs font-semibold text-charcoal-40 hover:text-rose-600">
            Reset signature
          </button>
        )}
        <a href={`/portal/${slug}/agreement`} target="_blank" className="text-sm font-semibold text-charcoal-60 hover:text-orange-deep no-underline">
          Client view ↗
        </a>
        <button
          onClick={save}
          className={`lq-btn lq-btn--sm ${dirty ? "lq-btn--dark" : "lq-btn--glass"}`}
        >
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved ✓" : saving === "error" ? "Retry save" : dirty ? "Save changes" : "Saved"}
        </button>
        <button
          onClick={toggleSend}
          disabled={sending}
          className={`lq-btn lq-btn--sm disabled:opacity-60 ${sent ? "lq-btn--glass" : "lq-btn--primary"}`}
        >
          {sending ? "…" : sent ? "Unsend" : "Send for signature →"}
        </button>
      </div>

      <div className="grid lg:grid-cols-[440px_1fr]">
        <div className="p-4 sm:p-5 space-y-3 lg:h-[calc(100vh-130px)] lg:overflow-y-auto bg-neutral-50/60 border-r border-neutral-200">
          <AiFill
            label="agreement"
            buildPrompt={() => agreementAiPrompt(doc, clientName, briefText, packagesText)}
            onApply={(raw) => {
              const parsed = parseAiDoc<AgreementDoc>(raw);
              if (!parsed) return false;
              setDoc((prev) => normalizeAgreementDoc(mergeAiDoc(prev, parsed)));
              setDirty(true);
              setSaving("");
              return true;
            }}
          />
          <Acc title="Theme & cover" defaultOpen>
            <ThemePicker theme={doc.theme} onChange={(t) => up((d) => (d.theme = t))} />
            <TextInput label="Document ID" value={doc.docId} onChange={(v) => up((d) => (d.docId = v))} />
            <TextInput label="Currency symbol" value={doc.currency} onChange={(v) => up((d) => (d.currency = v))} />
            <LInput label="Eyebrow" value={doc.cover.eyebrow} onChange={(v) => up((d) => (d.cover.eyebrow = v))} />
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

          <Acc title="01 · Summary" hint="parties & structure at a glance">
            <LInput label="Kicker" value={doc.summary.kicker} onChange={(v) => up((d) => (d.summary.kicker = v))} />
            <LInput label="Title" value={doc.summary.title} onChange={(v) => up((d) => (d.summary.title = v))} />
            <LInput label="Intro" area rows={2} value={doc.summary.intro} onChange={(v) => up((d) => (d.summary.intro = v))} />
            {doc.summary.rows.map((r, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label="Label" value={r.label} onChange={(v) => up((d) => (d.summary.rows[i].label = v))} />
                    <LInput label="Value" area rows={2} value={r.value} onChange={(v) => up((d) => (d.summary.rows[i].value = v))} />
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.summary.rows, i, -1))}
                    onDown={() => up((d) => move(d.summary.rows, i, 1))}
                    onDel={() => up((d) => void d.summary.rows.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.summary.rows.push({ label: { ...blankL }, value: { ...blankL } }))}>Row</AddBtn>
          </Acc>

          <Acc title="Payment schedule" hint="optional itemised payments">
            <Toggle label="Show payment schedule" checked={doc.schedule.enabled} onChange={(v) => up((d) => (d.schedule.enabled = v))} />
            <LInput label="Title" value={doc.schedule.title} onChange={(v) => up((d) => (d.schedule.title = v))} />
            {doc.schedule.items.map((it, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label="Label" value={it.label} onChange={(v) => up((d) => (d.schedule.items[i].label = v))} />
                    <TextInput label="Amount" value={it.amount} onChange={(v) => up((d) => (d.schedule.items[i].amount = v))} />
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.schedule.items, i, -1))}
                    onDown={() => up((d) => move(d.schedule.items, i, 1))}
                    onDel={() => up((d) => void d.schedule.items.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.schedule.items.push({ label: { ...blankL }, amount: "" }))}>Payment line</AddBtn>
            <LInput label="Note" value={doc.schedule.note} onChange={(v) => up((d) => (d.schedule.note = v))} />
          </Acc>

          <Acc title="02 · Terms" hint={`${doc.sections.length} numbered sections`}>
            {doc.sections.map((s, i) => (
              <ItemCard key={i}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <LInput label={`§${i + 1} title`} value={s.title} onChange={(v) => up((d) => (d.sections[i].title = v))} />
                    <Lbl>Paragraphs</Lbl>
                    {s.body.map((b, bi) => (
                      <div className="flex items-start gap-2" key={bi}>
                        <div className="flex-1">
                          <LInput area rows={3} value={b} onChange={(v) => up((d) => (d.sections[i].body[bi] = v))} />
                        </div>
                        <ItemTools onDel={() => up((d) => void d.sections[i].body.splice(bi, 1))} />
                      </div>
                    ))}
                    <AddBtn onClick={() => up((d) => d.sections[i].body.push({ ...blankL }))}>Paragraph</AddBtn>
                    <Lbl>Bulleted list</Lbl>
                    {s.list.map((b, bi) => (
                      <div className="flex items-start gap-2" key={bi}>
                        <div className="flex-1">
                          <LInput area rows={2} value={b} onChange={(v) => up((d) => (d.sections[i].list[bi] = v))} />
                        </div>
                        <ItemTools onDel={() => up((d) => void d.sections[i].list.splice(bi, 1))} />
                      </div>
                    ))}
                    <AddBtn onClick={() => up((d) => d.sections[i].list.push({ ...blankL }))}>List item</AddBtn>
                  </div>
                  <ItemTools
                    onUp={() => up((d) => move(d.sections, i, -1))}
                    onDown={() => up((d) => move(d.sections, i, 1))}
                    onDel={() => up((d) => void d.sections.splice(i, 1))}
                  />
                </div>
              </ItemCard>
            ))}
            <AddBtn onClick={() => up((d) => d.sections.push({ title: { ...blankL }, body: [{ ...blankL }], list: [] }))}>Section</AddBtn>
          </Acc>

          <Acc title="03 · Signature page">
            <LInput label="Kicker" value={doc.acceptance.kicker} onChange={(v) => up((d) => (d.acceptance.kicker = v))} />
            <LInput label="Title" value={doc.acceptance.title} onChange={(v) => up((d) => (d.acceptance.title = v))} />
            <LInput label="Body" area rows={3} value={doc.acceptance.body} onChange={(v) => up((d) => (d.acceptance.body = v))} />
            <LInput label="Stamp line" value={doc.acceptance.stampLine} onChange={(v) => up((d) => (d.acceptance.stampLine = v))} />
          </Acc>

          {signed && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-sm text-green-900">
              <div className="font-bold">Signed</div>
              <div>
                {signed.by} · {new Date(signed.at).toLocaleString("en-GB")}
              </div>
            </div>
          )}
        </div>

        <div className="lg:h-[calc(100vh-130px)] lg:overflow-y-auto bg-[#33312e]">
          <AgreementDocument doc={doc} clientName={clientName} clientSlug={slug} mode="preview" status={signed ? "signed" : sent ? "sent" : "draft"} signed={signed} />
        </div>
      </div>
    </div>
  );
}
