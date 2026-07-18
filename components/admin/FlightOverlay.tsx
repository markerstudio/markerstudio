"use client";

// Marky's flight stage — the content of the full-screen, transparent,
// permanently click-through overlay window (/pet?fly=1) the shell keeps
// warm behind the scenes. When a wander starts, the shell freezes the small
// clickable Marky, paints his frozen twin here at the same screen point,
// swaps window visibility (seamless), and hands this page the destination.
// From there the motion is entirely ours, at compositor smoothness:
//
//   wind-up  — squat-and-jiggle, gathering himself
//   flight   — a cubic bezier with a random bow (sometimes an S), a liquid
//              undulation riding the path normal, velocity-driven comet
//              stretch + heading rotation (spring-smoothed so the ink lags
//              the motion like real fluid), and an ink trail dropped in
//              SCREEN space — droplets hang in the air where he passed
//   landing  — overshoot splat, ground ripple, splash droplets, then a
//              frozen pose the shell swaps the clickable window back onto
//
// Phases arrive via window.__MARKY_FLY__(phase, a, b, c, d) evals from the
// shell: arm(x, y) → fly(ex, ey, ms, zoomy) → off(). All coordinates are
// logical px in this window (= screen coords minus monitor origin).
import { useEffect, useRef, useState } from "react";

type FlyWindow = Window & { __MARKY_FLY__?: (phase: string, a: number, b: number, c: number, d: number) => void };

const WINDUP_MS = 420; // mirrored by the shell's flight-thread timings
const BLOB = 72;

type Pose = "armed" | "wind" | "flying" | "landing";

export default function FlightOverlay() {
  const [pose, setPose] = useState<Pose | null>(null);
  const posRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const setXY = (x: number, y: number) => {
      const el = posRef.current;
      if (el) el.style.transform = `translate3d(${x - BLOB / 2}px, ${y - BLOB / 2}px, 0)`;
    };
    const setInk = (angleDeg: number, squish: number) => {
      const el = rotRef.current;
      if (el) {
        el.style.setProperty("--fly-rot", `${angleDeg}deg`);
        el.style.setProperty("--squish", `${squish}`);
      }
    };
    const drop = (x: number, y: number, size: number, life: number, drift?: { dx: number; dy: number }) => {
      const host = trailRef.current;
      if (!host) return;
      const d = document.createElement("i");
      d.className = "ms-fly-drop";
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${x - size / 2}px`;
      d.style.top = `${y - size / 2}px`;
      d.style.animationDuration = `${life}ms`;
      // Trail ink barely moves (it was left behind); splash ink flies out.
      d.style.setProperty("--dx", `${drift?.dx ?? 0}px`);
      d.style.setProperty("--dy", `${drift?.dy ?? (4 + Math.random() * 8)}px`);
      d.addEventListener("animationend", () => d.remove());
      host.appendChild(d);
    };

    let sx = 0;
    let sy = 0;

    const flyTo = (ex: number, ey: number, ms: number, zoomy: boolean) => {
      // Path: cubic bezier bowed off the straight line; sometimes an S-curve.
      const dx = ex - sx;
      const dy = ey - sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bow = (Math.random() < 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.22) * Math.min(len, 520);
      const sTwist = Math.random() < 0.4 ? -0.7 : 0.6;
      const p1x = sx + dx * 0.3 + nx * bow;
      const p1y = sy + dy * 0.3 + ny * bow;
      const p2x = sx + dx * 0.72 + nx * bow * sTwist;
      const p2y = sy + dy * 0.72 + ny * bow * sTwist;
      const point = (t: number) => {
        const u = 1 - t;
        const x = u * u * u * sx + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * ex;
        const y = u * u * u * sy + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * ey;
        // Liquid undulation riding the path normal, silent at both ends.
        const wig = Math.sin(t * Math.PI * (zoomy ? 2 : 3)) * (zoomy ? 12 : 8) * Math.sin(t * Math.PI);
        return { x: x + nx * wig, y: y + ny * wig };
      };
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const vFull = zoomy ? 1.3 : 0.55; // px/ms that reads as full stretch

      const t0 = performance.now();
      let prev = { x: sx, y: sy, t: t0 };
      let rot = 0;
      let hasRot = false;
      let squish = 0;
      let sinceDrop = 0;
      const spacing = zoomy ? 20 : 27;

      setPose("wind");
      const step = (now: number) => {
        const flightT = now - t0 - WINDUP_MS;
        if (flightT < 0) {
          raf.current = requestAnimationFrame(step);
          return;
        }
        setPose((p) => (p === "flying" ? p : "flying"));
        const p = Math.min(1, flightT / ms);
        const { x, y } = point(ease(p));
        const dt = Math.max(1, now - prev.t);
        const vx = (x - prev.x) / dt;
        const vy = (y - prev.y) / dt;
        const speed = Math.hypot(vx, vy);
        if (speed > 0.02) {
          const target = (Math.atan2(vy, vx) * 180) / Math.PI;
          if (!hasRot) {
            rot = target;
            hasRot = true;
          } else {
            // shortest-way spring toward the heading — the ink lags the turn
            rot += (((target - rot + 540) % 360) - 180) * 0.22;
          }
        }
        squish += (Math.min(1, speed / vFull) - squish) * 0.18;
        setXY(x, y);
        setInk(rot, squish);
        sinceDrop += Math.hypot(x - prev.x, y - prev.y);
        if (sinceDrop > spacing && speed > 0.1) {
          sinceDrop = 0;
          const a = (rot * Math.PI) / 180;
          const back = 38 + Math.random() * 10;
          drop(
            x - Math.cos(a) * back + (Math.random() * 10 - 5),
            y - Math.sin(a) * back + (Math.random() * 10 - 5),
            3.5 + Math.random() * 5.5 + squish * 3,
            520 + Math.random() * 320
          );
        }
        prev = { x, y, t: now };
        if (p < 1) {
          raf.current = requestAnimationFrame(step);
          return;
        }
        // Touchdown: splat + ripple + splash ink kicked out sideways.
        setXY(ex, ey);
        setInk(0, 0);
        setPose("landing");
        for (let i = 0; i < 3; i++) {
          const sa = Math.PI * (1.15 + Math.random() * 0.7); // upward-ish fan
          const power = 18 + Math.random() * 26;
          drop(ex + (Math.random() * 24 - 12), ey + 18, 4 + Math.random() * 4, 420 + Math.random() * 160, {
            dx: Math.cos(sa) * power,
            dy: Math.sin(sa) * power,
          });
        }
      };
      raf.current = requestAnimationFrame(step);
    };

    (window as FlyWindow).__MARKY_FLY__ = (phase, a, b, c, d) => {
      cancelAnimationFrame(raf.current);
      if (phase === "arm") {
        sx = a;
        sy = b;
        setPose("armed");
        setXY(a, b);
        setInk(0, 0);
      } else if (phase === "fly") {
        if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
          // No theatrics: appear at the destination, tiny settle.
          setXY(a, b);
          setPose("landing");
          return;
        }
        flyTo(a, b, Math.max(300, c), d >= 0.5);
      } else if (phase === "off") {
        setPose(null);
        const host = trailRef.current;
        if (host) host.textContent = "";
      }
    };
    return () => {
      cancelAnimationFrame(raf.current);
      delete (window as FlyWindow).__MARKY_FLY__;
    };
  }, []);

  if (!pose) return null;
  const inkClass =
    pose === "flying" ? "is-flight" : pose === "wind" ? "is-flight is-wind" : pose === "landing" ? "is-land" : "is-frozen";
  return (
    <div className="fixed inset-0 bg-transparent overflow-hidden pointer-events-none" aria-hidden>
      <div ref={trailRef} className="absolute inset-0" />
      <div ref={posRef} className="absolute left-0 top-0 will-change-transform">
        <div ref={rotRef} className="ms-fly__rot">
          <div className={`ms-pet relative w-[72px] h-[72px] rounded-full ${inkClass}`}>
            <span className="ms-pet__shadow" />
            <span className="ms-pet__body">
              <span className="ms-pet__eye" />
              <span className="ms-pet__eye" />
              <span className="ms-pet__mouth" />
            </span>
            {pose === "landing" && <span className="ms-ripple" />}
          </div>
        </div>
      </div>
    </div>
  );
}
