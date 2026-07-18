"use client";

// Marky — the studio's pet: a small orange blob bobbing in the corner of the
// admin. Click it and it opens a glass chat that answers from the studio's
// own data (via /api/pet — deterministic, zero AI credits). Session-local
// memory only. Hidden on print. The desktop app also runs Marky as a floating
// desktop creature + menu-bar item (see PetWindow.tsx / the Tauri shell).
import { useEffect, useState } from "react";
import { usePetChat, PetChatBody } from "@/components/admin/petChat";

export default function Pet() {
  const [open, setOpen] = useState(false);
  // In the desktop app Marky lives on the desktop + menu bar (PetWindow) —
  // showing the corner blob too meant two Markys. Browser only, mounted-gated
  // so SSR and the first client render agree.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!(window as { __MARKER_DESKTOP__?: boolean }).__MARKER_DESKTOP__);
  }, []);
  const chat = usePetChat();
  if (!show) return null;

  return (
    <div className="print:hidden">
      {/* The blob — sits above the mobile tab bar, corner of the screen. */}
      <button
        type="button"
        aria-label={open ? "Close Marky" : "Talk to Marky, the studio pet"}
        onClick={() => setOpen((o) => !o)}
        className={`ms-pet lq-press fixed z-[75] w-14 h-14 rounded-full ${chat.mood !== "idle" ? `is-${chat.mood}` : ""}`}
        style={{ insetInlineEnd: 18, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
          <span className="ms-pet__mouth" />
        </span>
      </button>

      {open && (
        <div
          className="lq-chrome fixed z-[76] rounded-3xl flex flex-col overflow-hidden w-[min(92vw,340px)]"
          style={{ insetInlineEnd: 14, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))", height: "min(60vh, 480px)" }}
          role="dialog"
          aria-label="Marky chat"
        >
          <PetChatBody chat={chat} />
        </div>
      )}
    </div>
  );
}
