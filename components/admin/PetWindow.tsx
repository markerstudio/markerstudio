"use client";

// Marky as a desktop creature: the content of the frameless, transparent,
// always-on-top pet window the DMG opens from the menu-bar tray. The blob
// sits bottom-right; the ⋮⋮ handle above it drags the window around the
// desktop (data-tauri-drag-region); clicking the blob toggles the chat and
// asks the shell (pet_expand) to grow/shrink the window, anchored to its
// bottom-right corner. The ✕ in the chat header closes the chat but keeps
// Marky around. While the chat is closed he lives his own life: every so
// often the shell glides the whole window somewhere else on screen
// (pet_wander), and good news sends him on a fast celebration flight.
// Rendered by /pet on a transparent page.
import { useEffect, useRef, useState } from "react";
import { usePetChat, PetChatBody, PetConfetti, petFaceClass } from "@/components/admin/petChat";

function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const w = window as {
    __TAURI__?: { core?: { invoke?: (c: string, a?: unknown) => Promise<unknown> } };
    __TAURI_INTERNALS__?: { invoke?: (c: string, a?: unknown) => Promise<unknown> };
  };
  const fn = w.__TAURI__?.core?.invoke || w.__TAURI_INTERNALS__?.invoke;
  return fn ? Promise.resolve(fn(cmd, args)) : Promise.reject(new Error("no ipc"));
}

export default function PetWindow() {
  const [open, setOpen] = useState(false);
  const chat = usePetChat();
  const openRef = useRef(open);
  openRef.current = open;

  const toggle = () => {
    const next = !open;
    // Resize first when growing (so the panel has room), after when shrinking.
    if (next) {
      invoke("pet_expand", { expanded: true }).catch(() => undefined);
      setOpen(true);
    } else {
      setOpen(false);
      invoke("pet_expand", { expanded: false }).catch(() => undefined);
    }
  };

  // Free-roaming: every 30–90s, if the chat is closed, drift somewhere else
  // on screen (1-in-4 flights are fast zoomies). The shell skips the call
  // whenever the window is expanded, so this can never yank the chat away.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = () => {
      t = setTimeout(() => {
        if (!alive) return;
        if (!openRef.current) invoke("pet_wander", { zoomy: Math.random() < 0.25 }).catch(() => undefined);
        loop();
      }, 30_000 + Math.random() * 60_000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  // Good news → confetti (in the markup below) + a victory lap when closed.
  useEffect(() => {
    if (chat.celebrating && !openRef.current) invoke("pet_wander", { zoomy: true }).catch(() => undefined);
  }, [chat.celebrating]);

  return (
    <div className="fixed inset-0 flex flex-col items-end justify-end p-2 bg-transparent">
      {open && (
        <div className="lq-chrome rounded-3xl flex flex-col overflow-hidden w-[320px] mb-2" style={{ height: 380 }} role="dialog" aria-label="Marky chat">
          <PetChatBody chat={chat} onClose={toggle} />
        </div>
      )}
      {/* drag handle — the whole strip moves the window; grabbing it also
          cancels any glide mid-flight so Marky never fights the hand */}
      <div
        data-tauri-drag-region
        onPointerDown={() => invoke("pet_rest").catch(() => undefined)}
        className="w-14 h-4 mb-0.5 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        title="Drag Marky around"
      >
        <span data-tauri-drag-region className="text-[10px] leading-none tracking-[0.2em] text-charcoal-40 select-none">⋯</span>
      </div>
      <button type="button" aria-label={open ? "Close Marky" : "Talk to Marky"} onClick={toggle} className={`ms-pet lq-press relative w-[72px] h-[72px] rounded-full ${petFaceClass(chat)}`}>
        <span className="ms-pet__shadow" aria-hidden />
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
          <span className="ms-pet__mouth" />
        </span>
        {chat.celebrating && <PetConfetti />}
      </button>
    </div>
  );
}
