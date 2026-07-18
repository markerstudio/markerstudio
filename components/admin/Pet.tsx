"use client";

// Marky — the studio's pet: a still, marker-drawn ink mark sitting in the
// corner of the admin (he reacts, he never roams — see the .ms-pet styles).
// Click it and it opens a glass chat that answers from the studio's
// own data (via /api/pet — deterministic, zero AI credits) and captures
// tasks/notes. Session-local memory only. Hidden on print. Opens with a bare
// “m” keypress (outside inputs) or a "marky:open" event (the ⌘K palette),
// so he works as a keyboard shortcut, not just a mascot. The desktop app
// runs Marky as a floating desktop creature + menu-bar item instead (see
// PetWindow.tsx / the Tauri shell).
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePetChat, PetChatBody, PetConfetti, petFaceClass } from "@/components/admin/petChat";
import { pagePersona, pageQuip, petCharacter } from "@/lib/petBrain";

export default function Pet() {
  const [open, setOpen] = useState(false);
  // In the desktop app Marky lives on the desktop + menu bar (PetWindow) —
  // showing the corner blob too meant two Markys. Browser only, mounted-gated
  // so SSR and the first client render agree.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!(window as { __MARKER_DESKTOP__?: boolean }).__MARKER_DESKTOP__);
  }, []);
  const pathname = usePathname();
  const page = useMemo(() => pagePersona(pathname || ""), [pathname]);
  const chat = usePetChat(page);

  // He notices where you are: navigating to a new section gets a quick
  // look-around, and — the first time a section is visited this session —
  // a little speech bubble with a landing quip. No bubble on initial load
  // (page-load noise) or while the chat is open (he's already talking).
  const [bubble, setBubble] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const lastKey = useRef<string | null | undefined>(undefined);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const key = page?.key ?? null;
    const prev = lastKey.current;
    lastKey.current = key;
    if (prev === undefined || prev === key || !page) return;
    chat.react();
    if (openRef.current || seen.current.has(key!)) return;
    seen.current.add(key!);
    setBubble(`${petCharacter().emoji} ${pageQuip(page)}`);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 5200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  // “m” toggles Marky from anywhere in the admin (GitHub-style single-key
  // shortcut — never while typing); the ⌘K palette dispatches "marky:open".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "m" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("marky:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("marky:open", onOpen);
    };
  }, []);
  if (!show) return null;

  return (
    <div className="print:hidden">
      {/* Landing quip — a tap opens the chat; it fades on its own. */}
      {bubble && !open && (
        <button
          type="button"
          onClick={() => {
            setBubble(null);
            setOpen(true);
          }}
          className="lq-chrome lq-pop fixed z-[75] rounded-2xl px-3 py-2 text-[12px] leading-snug text-charcoal-80 max-w-[230px] text-start"
          style={{ insetInlineEnd: 16, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))" }}
        >
          {bubble}
        </button>
      )}
      {/* The blob — sits above the mobile tab bar, corner of the screen. */}
      <button
        type="button"
        aria-label={open ? "Close Marky" : "Talk to Marky, the studio pet"}
        title={open ? "Close Marky (M)" : "Talk to Marky (M)"}
        onClick={() => setOpen((o) => !o)}
        className={`ms-pet lq-press fixed z-[75] w-14 h-14 rounded-full ${petFaceClass(chat)}`}
        style={{ insetInlineEnd: 18, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
          <span className="ms-pet__mouth" />
        </span>
        {chat.celebrating && <PetConfetti />}
      </button>

      {open && (
        <div
          className="lq-chrome fixed z-[76] rounded-3xl flex flex-col overflow-hidden w-[min(92vw,340px)]"
          style={{ insetInlineEnd: 14, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))", height: "min(60vh, 480px)" }}
          role="dialog"
          aria-label="Marky chat"
        >
          <PetChatBody chat={chat} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
