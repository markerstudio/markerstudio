"use client";

// Marky's shared chat pieces — used by the in-app corner pet (Pet.tsx) and
// the desktop floating pet window (PetWindow.tsx). Talks to /api/pet, which
// answers deterministically from studio data (zero AI credits) and executes
// capture commands ("task …" / "note …"). Marky is a shortcut both ways:
// quick-ask chips + linkified answers for output, quick capture for input.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { petCharacter } from "@/lib/petBrain";

export type PetMsg = { role: "user" | "assistant"; content: string };

// The hello is generated at mount (client-only — the chat never renders
// during SSR) so it can know the time of day and today's character.
function makeHello(): PetMsg {
  const ch = petCharacter();
  const h = new Date().getHours();
  const tod = h < 5 ? "Up late?" : h < 12 ? "Good morning!" : h < 17 ? "Good afternoon!" : "Good evening!";
  return {
    role: "assistant",
    content: `${tod} ${ch.emoji} ${ch.name} here — ${ch.vibe}\nAsk about money, approvals, shoots or tasks — or capture something with “task …” / “note …”`,
  };
}

export type PetMood = "idle" | "thinking" | "happy" | "alert" | "sleepy";
export type PetQuirk = "wiggle" | "spin" | "stretch" | "look";

const QUIRKS: PetQuirk[] = ["wiggle", "spin", "stretch", "look"];

// What a reply does to Marky's face: fire/overdue → alert shake, good news
// (including a successful capture) → happy hop, otherwise back to idle.
// Momentary moods decay after ~4s.
function moodOf(text: string): PetMood {
  if (/🔥|overdue|late|متأخر/i.test(text)) return "alert";
  if (/🎉|✨|🧡|✅|nothing|no open|all caught|noted|added|هادي|تمام/i.test(text)) return "happy";
  return "idle";
}

export function usePetChat() {
  const [msgs, setMsgs] = useState<PetMsg[]>(() => [makeHello()]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<PetMood>("idle");
  // A random little bit of personality (wiggle / spin / stretch / look-around)
  // that fires every so often while he's idle; `celebrating` turns on for a
  // moment when good news lands and drives the confetti burst.
  const [quirk, setQuirk] = useState<PetQuirk | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any interaction wakes him; 90s of nothing and he dozes off.
  const poke = useCallback(() => {
    setMood((m) => (m === "sleepy" ? "idle" : m));
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => setMood((m) => (m === "idle" ? "sleepy" : m)), 90_000);
  }, []);
  useEffect(() => {
    poke();
    return () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      if (moodTimer.current) clearTimeout(moodTimer.current);
      if (partyTimer.current) clearTimeout(partyTimer.current);
    };
  }, [poke]);

  // Quirk clock: every 14–40s, if he's just idling, do something silly.
  const idleRef = useRef(true);
  idleRef.current = mood === "idle" && !busy;
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        if (!alive) return;
        if (idleRef.current) {
          setQuirk(QUIRKS[Math.floor(Math.random() * QUIRKS.length)]);
          setTimeout(() => alive && setQuirk(null), 1700);
        }
        loop();
      }, 14_000 + Math.random() * 26_000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const feel = useCallback((m: PetMood) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    if (m === "happy" || m === "alert") moodTimer.current = setTimeout(() => setMood("idle"), 4000);
    if (m === "happy") {
      setCelebrating(true);
      if (partyTimer.current) clearTimeout(partyTimer.current);
      partyTimer.current = setTimeout(() => setCelebrating(false), 2600);
    }
  }, []);

  // `preset` lets the quick-ask chips send without touching the input box.
  async function send(preset?: string) {
    const q = (preset ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const next: PetMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    feel("thinking");
    poke();
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // msgs[0] is always the local hello — the server never needs it.
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      if (res.status === 401) {
        setMsgs((m) => [...m, { role: "assistant", content: "I don't recognise you — open Marker Studio and sign in first, then talk to me again 🧡" }]);
      } else if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", content: "Hmm, my thought got lost — try me again in a moment." }]);
      } else {
        const data = (await res.json()) as { text?: string };
        const text = data.text || "…";
        setMsgs((m) => [...m, { role: "assistant", content: text }]);
        feel(moodOf(text));
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the studio brain — are we offline?" }]);
    } finally {
      setBusy(false);
      setMood((m) => (m === "thinking" ? "idle" : m));
    }
  }

  return { msgs, input, setInput, busy, send, mood, quirk, celebrating, poke };
}

// The blob's mood + quirk classes in one place, so the in-app corner pet and
// the desktop window stay in sync.
export function petFaceClass(chat: Pick<ReturnType<typeof usePetChat>, "mood" | "quirk">): string {
  return `${chat.mood !== "idle" ? `is-${chat.mood}` : ""} ${chat.quirk ? `q-${chat.quirk}` : ""}`.trim();
}

// A one-shot burst of brand-ink confetti (mounted only while celebrating).
// Pure transforms + opacity — no shadows/filters, so it renders the same in
// the transparent desktop pet window.
export function PetConfetti() {
  const parts = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: `${Math.round(-64 + Math.random() * 128)}px`,
        y: `${Math.round(-84 + Math.random() * 120)}px`,
        r: `${Math.round(-260 + Math.random() * 520)}deg`,
        c: ["#F57F00", "#FFA226", "#FFD79A", "#2b2b2b", "#ffffff"][i % 5],
        d: `${Math.round(Math.random() * 260)}ms`,
      })),
    []
  );
  return (
    <span className="ms-confetti" aria-hidden>
      {parts.map((p, i) => (
        <i key={i} style={{ "--x": p.x, "--y": p.y, "--r": p.r, "--c": p.c, "--d": p.d } as CSSProperties} />
      ))}
    </span>
  );
}

// Marky's answers reference admin pages by path — make those paths tappable.
// In the browser a plain anchor navigates the admin; in the desktop pet
// window (Tauri, where navigating would kill the pet) the link opens in a
// native preview window via the shell's open_preview command.
const PATH_RE = /(\/(?:admin|portal)(?:\/[A-Za-z0-9\-_/]*)?)/g;

function openInDesktop(path: string): boolean {
  const w = window as {
    __TAURI__?: { core?: { invoke?: (c: string, a?: unknown) => Promise<unknown> } };
    __TAURI_INTERNALS__?: { invoke?: (c: string, a?: unknown) => Promise<unknown> };
  };
  const fn = w.__TAURI__?.core?.invoke || w.__TAURI_INTERNALS__?.invoke;
  if (!fn) return false;
  Promise.resolve(fn("open_preview", { url: new URL(path, location.origin).href, title: "Marker Studio" })).catch(() => undefined);
  return true;
}

function AssistantText({ text }: { text: string }) {
  const parts = text.split(PATH_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <a
            key={i}
            href={p}
            onClick={(e) => {
              if (openInDesktop(p)) e.preventDefault();
            }}
            className="font-semibold text-[#F57F00] underline decoration-[#F57F00]/40 underline-offset-2 hover:decoration-[#F57F00]"
          >
            {p}
          </a>
        ) : (
          p
        )
      )}
    </>
  );
}

// Quick-ask chips — the output half of the shortcut, one tap from anywhere.
// `fill` chips pre-type a capture command instead of sending.
const SUGGESTIONS: { label: string; q?: string; fill?: string }[] = [
  { label: "🔥 Today", q: "what's on fire today?" },
  { label: "💸 Owed", q: "how much does everyone owe?" },
  { label: "💰 Income", q: "what did we collect this month?" },
  { label: "🗓️ Week", q: "what's coming this week?" },
  { label: "⏳ Approvals", q: "what's blocked on approvals?" },
  { label: "➕ Task", fill: "task " },
  { label: "🗒️ Note", fill: "note " },
];

export function PetChatBody({ chat, onClose }: { chat: ReturnType<typeof usePetChat>; onClose?: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ch = petCharacter();
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.msgs, chat.busy]);
  // Land ready to type — but only where a keyboard won't pop over the chat.
  useEffect(() => {
    if (typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);
  return (
    <>
      <div className="px-4 py-2.5 border-b border-charcoal/5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#FFA226] to-[#F57F00]" />
        <span className="font-display font-bold text-[13.5px] text-ink">{ch.name} {ch.emoji}</span>
        <span className="text-[10.5px] text-charcoal-40">knows today&apos;s studio</span>
        {onClose && (
          <button
            type="button"
            aria-label="Close chat — Marky stays"
            title="Close chat (Marky stays)"
            onClick={onClose}
            className="ms-auto w-6 h-6 rounded-full grid place-items-center text-charcoal-40 hover:text-ink hover:bg-charcoal/5 text-[13px] leading-none"
          >
            ✕
          </button>
        )}
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
            {m.role === "assistant" ? <AssistantText text={m.content} /> : m.content}
          </div>
        ))}
        {chat.busy && (
          <div className="me-auto bg-white/80 border border-charcoal/5 rounded-2xl px-3 py-2 text-[13px] text-charcoal-40">thinking…</div>
        )}
        <div ref={endRef} />
      </div>
      {chat.msgs.length <= 1 && (
        <div className="px-2 pb-1.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                if (s.q) chat.send(s.q);
                else if (s.fill) {
                  chat.setInput(s.fill);
                  inputRef.current?.focus();
                }
              }}
              className="lq-press rounded-full bg-charcoal/5 hover:bg-charcoal/10 px-2.5 py-1 text-[11.5px] font-display font-semibold text-charcoal-60 hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="p-2 border-t border-charcoal/5 flex gap-1.5">
        <input
          ref={inputRef}
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") chat.send();
          }}
          placeholder="Ask — or “task …” / “note …”"
          className="lq-input flex-1 !py-2 !text-[13px]"
        />
        <button type="button" onClick={() => chat.send()} disabled={chat.busy || !chat.input.trim()} className="lq-btn lq-btn--primary lq-btn--sm disabled:opacity-50">
          →
        </button>
      </div>
    </>
  );
}
