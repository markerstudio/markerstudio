"use client";

// Marky — the studio's pet: a small orange blob bobbing in the corner of the
// admin. Click it and it opens a glass chat that answers from the studio's
// own data (via /api/pet — deterministic, zero AI credits). Session-local
// memory only; closing the panel keeps
// the thread, reloading forgets it. Hidden on print.
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const HELLO: Msg = {
  role: "assistant",
  content: "Hey! I'm Marky 🧡 Ask me things like “what's on fire today?”, “how much does everyone owe us?”, or “what's blocked on approvals?”",
};

export default function Pet() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy, open]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== HELLO) }),
      });
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", content: "Hmm, my thought got lost — try me again in a moment." }]);
      } else {
        const data = (await res.json()) as { text?: string };
        setMsgs((m) => [...m, { role: "assistant", content: data.text || "…" }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the studio brain — are we offline?" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print:hidden">
      {/* The blob — sits above the mobile tab bar, corner of the screen. */}
      <button
        type="button"
        aria-label={open ? "Close Marky" : "Talk to Marky, the studio pet"}
        onClick={() => setOpen((o) => !o)}
        className="ms-pet lq-press fixed z-[75] w-14 h-14 rounded-full"
        style={{ insetInlineEnd: 18, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
        </span>
      </button>

      {open && (
        <div
          className="lq-chrome fixed z-[76] rounded-3xl flex flex-col overflow-hidden w-[min(92vw,340px)]"
          style={{ insetInlineEnd: 14, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))", maxHeight: "min(60vh, 480px)" }}
          role="dialog"
          aria-label="Marky chat"
        >
          <div className="px-4 py-2.5 border-b border-charcoal/5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#FFA226] to-[#F57F00]" />
            <span className="font-display font-bold text-[13.5px] text-ink">Marky</span>
            <span className="text-[10.5px] text-charcoal-40">knows today&apos;s studio</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "ms-auto bg-gradient-to-br from-[#FFA226] to-[#F57F00] text-white"
                  : "me-auto bg-white/80 border border-charcoal/5 text-charcoal-80"
              }`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="me-auto bg-white/80 border border-charcoal/5 rounded-2xl px-3 py-2 text-[13px] text-charcoal-40">thinking…</div>}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t border-charcoal/5 flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Ask Marky…"
              className="lq-input flex-1 !py-2 !text-[13px]"
            />
            <button type="button" onClick={send} disabled={busy || !input.trim()} className="lq-btn lq-btn--primary lq-btn--sm disabled:opacity-50">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
