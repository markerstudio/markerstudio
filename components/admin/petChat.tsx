"use client";

// Marky's shared chat pieces — used by the in-app corner pet (Pet.tsx) and
// the desktop floating pet window (PetWindow.tsx). Talks to /api/pet, which
// answers deterministically from studio data (zero AI credits).
import { useEffect, useRef, useState } from "react";

export type PetMsg = { role: "user" | "assistant"; content: string };

export const PET_HELLO: PetMsg = {
  role: "assistant",
  content: "Hey! I'm Marky 🧡 Ask me things like “what's on fire today?”, “how much does everyone owe us?”, or “what's blocked on approvals?”",
};

export function usePetChat() {
  const [msgs, setMsgs] = useState<PetMsg[]>([PET_HELLO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const next: PetMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== PET_HELLO) }),
      });
      if (res.status === 401) {
        setMsgs((m) => [...m, { role: "assistant", content: "I don't recognise you — open Marker Studio and sign in first, then talk to me again 🧡" }]);
      } else if (!res.ok) {
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

  return { msgs, input, setInput, busy, send };
}

export function PetChatBody({ chat }: { chat: ReturnType<typeof usePetChat> }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.msgs, chat.busy]);
  return (
    <>
      <div className="px-4 py-2.5 border-b border-charcoal/5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#FFA226] to-[#F57F00]" />
        <span className="font-display font-bold text-[13.5px] text-ink">Marky</span>
        <span className="text-[10.5px] text-charcoal-40">knows today&apos;s studio</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {chat.msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "ms-auto bg-gradient-to-br from-[#FFA226] to-[#F57F00] text-white"
                : "me-auto bg-white/80 border border-charcoal/5 text-charcoal-80"
            }`}
          >
            {m.content}
          </div>
        ))}
        {chat.busy && (
          <div className="me-auto bg-white/80 border border-charcoal/5 rounded-2xl px-3 py-2 text-[13px] text-charcoal-40">thinking…</div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-charcoal/5 flex gap-1.5">
        <input
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") chat.send();
          }}
          placeholder="Ask Marky…"
          className="lq-input flex-1 !py-2 !text-[13px]"
        />
        <button type="button" onClick={chat.send} disabled={chat.busy || !chat.input.trim()} className="lq-btn lq-btn--primary lq-btn--sm disabled:opacity-50">
          →
        </button>
      </div>
    </>
  );
}
