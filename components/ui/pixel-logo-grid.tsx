"use client";

import { cn } from "@/lib/utils";
import type { ClientItem } from "@/lib/content";
import { useCallback, useEffect, useRef } from "react";

/* -----------------------------------------------------------------------------
 * Pixel canvas
 * Animated grid of pixels that ripples in from the center on hover and fades
 * out on leave. Tinted in the Marker orange palette.
 * -------------------------------------------------------------------------- */

type Pixel = {
  x: number;
  y: number;
  color: string;
  ctx: CanvasRenderingContext2D;
  speed: number;
  size: number;
  sizeStep: number;
  minSize: number;
  maxSizeInt: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isIdle: boolean;
  isReverse: boolean;
  isShimmer: boolean;
  draw: () => void;
  appear: () => void;
  disappear: () => void;
  shimmer: () => void;
};

function createPixel(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  color: string,
  baseSpeed: number,
  delay: number
): Pixel {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  const p: Pixel = {
    x, y, color, ctx,
    speed: rand(0.1, 0.9) * baseSpeed,
    size: 0,
    sizeStep: Math.random() * 0.4,
    minSize: 0.5,
    maxSizeInt: 2,
    maxSize: rand(0.5, 2),
    delay,
    counter: 0,
    counterStep: Math.random() * 4 + (canvas.width + canvas.height) * 0.01,
    isIdle: false,
    isReverse: false,
    isShimmer: false,
    draw() {
      const offset = p.maxSizeInt * 0.5 - p.size * 0.5;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + offset, p.y + offset, p.size, p.size);
    },
    appear() {
      p.isIdle = false;
      if (p.counter <= p.delay) {
        p.counter += p.counterStep;
        return;
      }
      if (p.size >= p.maxSize) p.isShimmer = true;
      if (p.isShimmer) p.shimmer();
      else p.size += p.sizeStep;
      p.draw();
    },
    disappear() {
      p.isShimmer = false;
      p.counter = 0;
      if (p.size <= 0) {
        p.isIdle = true;
        return;
      }
      p.size -= 0.1;
      p.draw();
    },
    shimmer() {
      if (p.size >= p.maxSize) p.isReverse = true;
      else if (p.size <= p.minSize) p.isReverse = false;
      if (p.isReverse) p.size -= p.speed;
      else p.size += p.speed;
    },
  };

  return p;
}

type PixelCanvasProps = {
  colors: string[];
  gap?: number;
  speed?: number;
};

function PixelCanvas({ colors, gap = 5, speed = 30 }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef(performance.now());
  const reducedMotionRef = useRef(false);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = wrap.getBoundingClientRect();
    const w = Math.floor(width);
    const h = Math.floor(height);
    // Hidden cards (e.g. the responsive layout not in use) report 0 size — skip
    // them so we never spin up an animation for something off-screen.
    if (w === 0 || h === 0) {
      pixelsRef.current = [];
      return;
    }
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const effectiveSpeed = reducedMotionRef.current ? 0 : Math.min(speed, 100) * 0.001;
    const pixels: Pixel[] = [];

    // Each pixel's delay is its distance from the canvas center, so the
    // animation ripples outward from the middle on hover.
    for (let x = 0; x < w; x += gap) {
      for (let y = 0; y < h; y += gap) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const dx = x - w / 2;
        const dy = y - h / 2;
        const delay = reducedMotionRef.current ? 0 : Math.sqrt(dx * dx + dy * dy);
        pixels.push(createPixel(ctx, canvas, x, y, color, effectiveSpeed, delay));
      }
    }

    pixelsRef.current = pixels;
  }, [colors, gap, speed]);

  const animate = useCallback((mode: "appear" | "disappear") => {
    cancelAnimationFrame(animationRef.current);
    const frameInterval = 1000 / 60;

    const loop = () => {
      animationRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      const elapsed = now - lastFrameRef.current;
      if (elapsed < frameInterval) return;
      lastFrameRef.current = now - (elapsed % frameInterval);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pixels = pixelsRef.current;
      for (const pixel of pixels) pixel[mode]();

      if (pixels.every((p) => p.isIdle)) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    animationRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    init();

    const resizeObserver = new ResizeObserver(() => init());
    if (wrapRef.current) resizeObserver.observe(wrapRef.current);

    // Hover is tracked on the parent card, not the canvas, so that the canvas
    // itself never blocks pointer events on the logo above it.
    const card = wrapRef.current?.parentElement;
    const handleEnter = () => animate("appear");
    const handleLeave = () => animate("disappear");
    card?.addEventListener("mouseenter", handleEnter);
    card?.addEventListener("mouseleave", handleLeave);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationRef.current);
      card?.removeEventListener("mouseenter", handleEnter);
      card?.removeEventListener("mouseleave", handleLeave);
    };
  }, [init, animate]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Logo card
 * A single client logo over the pixel shimmer. At rest the logo is the muted
 * grayscale "trusted by" treatment; on hover it returns to full colour, scales
 * up slightly, and the card gains an orange-tinted glow as the pixels ripple.
 * -------------------------------------------------------------------------- */

// Marker's signature orange, sampled across the brand palette for the shimmer.
const PIXEL_COLORS = ["#FF9100", "#FFB347", "#FFCB80"];

function LogoCard({ logo }: { logo: ClientItem }) {
  return (
    <div
      className={cn(
        "group relative grid place-items-center overflow-hidden bg-paper cursor-pointer select-none isolate",
        "transition-shadow duration-300 hover:z-[2]",
        "hover:shadow-[0_8px_24px_-8px_rgba(255,145,0,0.28),0_0_0_1px_rgba(255,145,0,0.45)]"
      )}
    >
      <PixelCanvas colors={PIXEL_COLORS} gap={5} speed={30} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.logo}
        alt={logo.name}
        loading="lazy"
        className={cn(
          "relative z-[1] w-auto max-w-[78%] max-h-[56px] object-contain transition-all duration-300",
          "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-[1.06]"
        )}
      />
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Component
 * Client showcase: a tight grid of brand logos around a centered text block,
 * each card carrying the orange pixel-shimmer hover. The text block sits in the
 * middle on desktop (5 columns) and becomes a full-width banner on mobile.
 * -------------------------------------------------------------------------- */

export type PixelLogoGridProps = {
  /** Small eyebrow label above the heading. */
  badge?: string;
  /** Main heading text. */
  heading?: string;
  /** Client brands to display. */
  items: ClientItem[];
};

export function PixelLogoGrid({
  badge = "Trusted by",
  heading = "Brands that asked us to leave a mark.",
  items,
}: PixelLogoGridProps) {
  return (
    <section className="ms-clients" aria-label={heading}>
      <div className="ms-container">
        <div
          className="grid grid-cols-2 md:grid-cols-5 gap-px bg-charcoal-10 border border-charcoal-10 rounded-[var(--r-md)] overflow-hidden"
          style={{ gridAutoRows: "96px" }}
        >
          {/* Centered text block: full-width banner on mobile, middle of the
              grid (cols 2–4, rows 2–3) on desktop. Rendered first so the logo
              cards auto-flow around it. */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4 bg-paper px-4 text-center",
              "col-span-2 row-span-2",
              "md:col-start-2 md:col-end-5 md:row-start-2 md:row-end-4"
            )}
          >
            <span className="ms-section__eyebrow" style={{ marginBottom: 0 }}>
              {badge}
            </span>
            <h2 className="ms-clients__title" style={{ maxWidth: "20ch", margin: 0 }}>
              {heading}
            </h2>
          </div>

          {items.map((logo) => (
            <LogoCard key={logo.name} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}
