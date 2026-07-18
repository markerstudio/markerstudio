"use client";

// Marky as a desktop creature: the content of the frameless, transparent,
// always-on-top pet window the DMG opens from the menu-bar tray. The blob
// sits bottom-right; the ⋮⋮ handle above it drags the window around the
// desktop (data-tauri-drag-region); clicking the blob toggles the chat and
// asks the shell (pet_expand) to grow/shrink the window, anchored to its
// bottom-right corner. Rendered by /pet on a transparent page.
import { useState } from "react";
import { usePetChat, PetChatBody } from "@/components/admin/petChat";

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

  return (
    <div className="fixed inset-0 flex flex-col items-end justify-end p-2 bg-transparent">
      {open && (
        <div className="lq-chrome rounded-3xl flex flex-col overflow-hidden w-[320px] mb-2" style={{ height: 380 }} role="dialog" aria-label="Marky chat">
          <PetChatBody chat={chat} />
        </div>
      )}
      {/* drag handle — the whole strip moves the window */}
      <div data-tauri-drag-region className="w-14 h-4 mb-0.5 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing" title="Drag Marky around">
        <span data-tauri-drag-region className="text-[10px] leading-none tracking-[0.2em] text-charcoal-40 select-none">⋯</span>
      </div>
      <button type="button" aria-label={open ? "Close Marky" : "Talk to Marky"} onClick={toggle} className="ms-pet lq-press relative w-[72px] h-[72px] rounded-full">
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
        </span>
      </button>
    </div>
  );
}
