"use client";

// Marky as a desktop creature: the content of the frameless, transparent,
// always-on-top pet window the DMG opens from the menu-bar tray. The blob
// sits bottom-right; the ⋮⋮ handle above it drags the window around the
// desktop (data-tauri-drag-region); clicking the blob toggles the chat and
// asks the shell (pet_expand) to grow/shrink the window, anchored to its
// bottom-right corner. The ✕ in the chat header closes the chat but keeps
// Marky around.
//
// While the chat is closed he lives his own life. Every so often the shell
// flies the whole window to a quiet corner of the screen (pet_wander) and
// streams flight telemetry back in via window.__MARKY_FLY__(phase, angle,
// speed). This component choreographs the liquid side of that flight:
//   wind  — squat-and-jiggle wind-up while the shell swaps to the roomy
//           flight frame (blob recentred, window ghost to the cursor)
//   move  — the blob melts into an ink comet: rotated to its heading,
//           stretched by speed, trailing droplets that hang in the air
//   land  — back in the small frame: splat squash + ink ripple
//   end   — flight over, normal life resumes
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

type FlyPhase = "wind" | "fly" | "land";
type FlyWindow = Window & { __MARKY_FLY__?: (phase: string, angle: number, speed: number) => void };

// Centre of the flight window (PET_FLY 220×220 in the shell).
const FLY_CENTER = 110;

export default function PetWindow() {
  const [open, setOpen] = useState(false);
  const [fly, setFly] = useState<FlyPhase | null>(null);
  const chat = usePetChat();
  const openRef = useRef(open);
  openRef.current = open;
  const rotRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

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

  // The shell narrates the flight into this global; heading + speed go
  // straight onto CSS vars (30×/s — no React churn), phases through state.
  useEffect(() => {
    const angle = { current: 0 };
    const speed = { current: 0 };
    let trailTimer: ReturnType<typeof setInterval> | null = null;
    const stopTrail = () => {
      if (trailTimer) clearInterval(trailTimer);
      trailTimer = null;
    };
    const spawnDrop = () => {
      const host = trailRef.current;
      if (!host) return;
      const a = (angle.current * Math.PI) / 180;
      const back = 42 + Math.random() * 14; // just behind the comet's tail
      const size = 4 + Math.random() * 6;
      const d = document.createElement("i");
      d.className = "ms-fly-drop";
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${FLY_CENTER - Math.cos(a) * back + (Math.random() * 12 - 6)}px`;
      d.style.top = `${FLY_CENTER - Math.sin(a) * back + (Math.random() * 12 - 6)}px`;
      // Drift further backwards while fading — ink left hanging in the air.
      d.style.setProperty("--dx", `${-Math.cos(a) * (28 + speed.current * 60)}px`);
      d.style.setProperty("--dy", `${-Math.sin(a) * (28 + speed.current * 60)}px`);
      d.addEventListener("animationend", () => d.remove());
      host.appendChild(d);
    };
    (window as FlyWindow).__MARKY_FLY__ = (phase, a, s) => {
      if (phase === "wind") {
        angle.current = a;
        speed.current = 0;
        setFly("wind");
      } else if (phase === "move") {
        angle.current = a;
        speed.current = s;
        setFly((f) => (f === "fly" ? f : "fly"));
        const el = rotRef.current;
        if (el) {
          el.style.setProperty("--fly-rot", `${a}deg`);
          el.style.setProperty("--squish", `${s}`);
        }
        if (!trailTimer) trailTimer = setInterval(spawnDrop, 90);
      } else if (phase === "land") {
        stopTrail();
        setFly("land");
      } else {
        stopTrail();
        setFly(null);
      }
    };
    return () => {
      stopTrail();
      delete (window as FlyWindow).__MARKY_FLY__;
    };
  }, []);

  // Free-roaming: every 30–90s, if the chat is closed, fly to a quiet corner
  // (1-in-4 flights are fast zoomies). The shell skips the call whenever the
  // window is expanded, so this can never yank the chat away. Respects
  // reduced-motion — no flights at all.
  useEffect(() => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

  // Airborne: the roomy flight frame — just the comet, centred, plus trail.
  if (fly === "wind" || fly === "fly") {
    return (
      <div className="fixed inset-0 bg-transparent ms-fly">
        <div ref={trailRef} className="absolute inset-0 pointer-events-none" aria-hidden />
        <div ref={rotRef} className="ms-fly__rot">
          <div className={`ms-pet is-flight ${fly === "wind" ? "is-wind" : ""} relative w-[72px] h-[72px] rounded-full`}>
            <span className="ms-pet__shadow" aria-hidden />
            <span className="ms-pet__body">
              <span className="ms-pet__eye" />
              <span className="ms-pet__eye" />
              <span className="ms-pet__mouth" />
            </span>
          </div>
        </div>
      </div>
    );
  }

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
      <button
        type="button"
        aria-label={open ? "Close Marky" : "Talk to Marky"}
        onClick={toggle}
        className={`ms-pet lq-press relative w-[72px] h-[72px] rounded-full ${fly === "land" ? "is-land" : petFaceClass(chat)}`}
      >
        <span className="ms-pet__shadow" aria-hidden />
        <span className="ms-pet__body">
          <span className="ms-pet__eye" />
          <span className="ms-pet__eye" />
          <span className="ms-pet__mouth" />
        </span>
        {fly === "land" && <span className="ms-ripple" aria-hidden />}
        {chat.celebrating && !fly && <PetConfetti />}
      </button>
    </div>
  );
}
