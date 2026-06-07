// components/ui/cinematic-landing-hero.tsx
// Cinematic scroll-driven hero (GSAP). Adapted from a 21st.dev/Magic component
// to Marker Studio's brand: orange/charcoal palette, the phone mockup is a
// social-growth dashboard built from the studio's real Instagram numbers, the
// store buttons are project CTAs, and it speaks EN + AR (RTL-aware).
"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  /* Environment Overlays */
  .ch-film-grain {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50; opacity: 0.04; mix-blend-mode: multiply;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .ch-bg-grid {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, color-mix(in srgb, var(--marker-charcoal) 6%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, var(--marker-charcoal) 6%, transparent) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  /* OUTSIDE THE CARD: charcoal ink headline with soft physical shadow */
  .ch-text-ink {
      color: var(--marker-ink);
      text-shadow:
          0 10px 30px rgba(48, 48, 48, 0.18),
          0 2px 4px rgba(48, 48, 48, 0.10);
  }

  /* The signature: an orange gradient mark for the emphasised line */
  .ch-text-orange {
      background: linear-gradient(180deg, var(--marker-orange-soft) 0%, var(--marker-orange-deep) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 10px 20px rgba(255, 145, 0, 0.25))
          drop-shadow(0px 2px 4px rgba(224, 126, 0, 0.20));
  }

  /* INSIDE THE CARD: silver/white on the dark charcoal surface */
  .ch-text-card-silver {
      background: linear-gradient(180deg, #FFFFFF 0%, #B8B8B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 12px 24px rgba(0,0,0,0.7))
          drop-shadow(0px 4px 8px rgba(0,0,0,0.5));
  }

  /* Deep physical charcoal card with dynamic mouse lighting */
  .ch-depth-card {
      background: linear-gradient(145deg, #3A3A3A 0%, #1A1A1A 100%);
      box-shadow:
          0 40px 100px -20px rgba(0, 0, 0, 0.6),
          0 20px 40px -20px rgba(0, 0, 0, 0.5),
          inset 0 1px 2px rgba(255, 255, 255, 0.12),
          inset 0 -2px 4px rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;
  }

  .ch-card-sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
      background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,145,0,0.07) 0%, transparent 40%);
      mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  /* Realistic iPhone mockup hardware */
  .ch-iphone-bezel {
      background-color: #111;
      box-shadow:
          inset 0 0 0 2px #52525B,
          inset 0 0 0 7px #000,
          0 40px 80px -15px rgba(0,0,0,0.9),
          0 15px 25px -5px rgba(0,0,0,0.7);
      transform-style: preserve-3d;
  }

  .ch-hardware-btn {
      background: linear-gradient(90deg, #404040 0%, #171717 100%);
      box-shadow:
          -2px 0 5px rgba(0,0,0,0.8),
          inset -1px 0 1px rgba(255,255,255,0.15),
          inset 1px 0 2px rgba(0,0,0,0.8);
      border-left: 1px solid rgba(255,255,255,0.05);
  }

  .ch-screen-glare {
      background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
  }

  .ch-widget-depth {
      background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
      box-shadow:
          0 10px 20px rgba(0,0,0,0.3),
          inset 0 1px 1px rgba(255,255,255,0.05),
          inset 0 -1px 1px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.03);
  }

  .ch-floating-badge {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.6),
          inset 0 1px 1px rgba(255,255,255,0.2),
          inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .ch-progress-ring {
      transform: rotate(-90deg);
      transform-origin: center;
      stroke-dasharray: 402;
      stroke-dashoffset: 402;
      stroke-linecap: round;
  }
`;

type Badge = { icon: string; title: string; sub: string };

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  arrow?: string;
  phoneToday?: string;
  phoneTitle?: string;
  phoneInitials?: string;
  badges?: [Badge, Badge];
  dir?: "ltr" | "rtl";
}

export function CinematicHero({
  brandName = "Marker",
  tagline1 = "We mark the brands",
  tagline2 = "that matter.",
  cardHeading = "Marketing, measured.",
  cardDescription = "Marker runs your brand's social like a funnel — reach to profile-visit to follower to inquiry — and reports every number, every month.",
  metricValue = 445,
  metricLabel = "K Views · 60d",
  ctaHeading = "Ready to leave a mark?",
  ctaDescription = "Tell us what you're building. We reply to every brief within two working days.",
  ctaPrimary = "Start a project",
  ctaSecondary = "View work",
  arrow = "→",
  phoneToday = "Last 60 days",
  phoneTitle = "Reach",
  phoneInitials = "MS",
  badges = [
    { icon: "📈", title: "+1,353% Reach", sub: "vs prior 60 days" },
    { icon: "🤝", title: "+369 Followers", sub: "net, in 60 days" },
  ],
  dir = "ltr",
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  const isRtl = dir === "rtl";
  const display = isRtl ? "font-arabic-display" : "font-display";

  // 1. High-performance mouse interaction (requestAnimationFrame-driven)
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          mainCardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
          mainCardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);

          const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
          gsap.to(mockupRef.current, {
            rotationY: xVal * 12,
            rotationX: -yVal * 12,
            ease: "power3.out",
            duration: 1.2,
          });
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 2. Cinematic scroll timeline. Respects prefers-reduced-motion: when set, we
  //    reveal everything statically and skip the pinned scroll-jack entirely.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(
        [
          ".text-track",
          ".text-days",
          ".main-card",
          ".card-left-text",
          ".card-right-text",
          ".mockup-scroll-wrapper",
          ".floating-badge",
          ".phone-widget",
        ],
        { clearProps: "all", autoAlpha: 1, visibility: "visible" }
      );
      gsap.set(".cta-wrapper", { autoAlpha: 0 });
      return;
    }

    const isMobile = window.innerWidth < 768;

    const ctx = gsap.context(() => {
      gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.85, filter: "blur(20px)", rotationX: -20 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge", ".phone-widget"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.8, filter: "blur(30px)" });

      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", rotationX: 0, ease: "expo.out" })
        .to(".text-days", { duration: 1.4, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0");

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=7000",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTl
        .to([".hero-text-wrapper", ".ch-bg-grid"], { scale: 1.15, filter: "blur(20px)", opacity: 0.2, ease: "power2.inOut", duration: 2 }, 0)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 2 }, 0)
        .to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.5 })
        .fromTo(".mockup-scroll-wrapper",
          { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 }, "-=0.8"
        )
        .fromTo(".phone-widget", { y: 40, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.15, ease: "back.out(1.2)", duration: 1.5 }, "-=1.5")
        .to(".ch-progress-ring", { strokeDashoffset: 60, duration: 2, ease: "power3.inOut" }, "-=1.2")
        .to(".counter-val", { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 2, ease: "expo.out" }, "-=2.0")
        .fromTo(".floating-badge", { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 }, { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: "back.out(1.5)", duration: 1.5, stagger: 0.2 }, "-=2.0")
        .fromTo(".card-left-text", { x: isRtl ? 50 : -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=1.5")
        .fromTo(".card-right-text", { x: isRtl ? -50 : 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.5 }, "<")
        .to({}, { duration: 2.5 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1.5 })
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"], {
          scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: "power3.in", duration: 1.2, stagger: 0.05,
        })
        .to(".main-card", {
          width: isMobile ? "92vw" : "85vw",
          height: isMobile ? "92vh" : "85vh",
          borderRadius: isMobile ? "32px" : "40px",
          ease: "expo.inOut",
          duration: 1.8,
        }, "pullback")
        .to(".cta-wrapper", { scale: 1, filter: "blur(0px)", ease: "expo.inOut", duration: 1.8 }, "pullback")
        .to(".main-card", { y: -window.innerHeight - 300, ease: "power3.in", duration: 1.5 });
    }, containerRef);

    return () => ctx.revert();
  }, [metricValue, isRtl]);

  return (
    <div
      ref={containerRef}
      dir={dir}
      className={cn(
        "relative w-full h-screen overflow-hidden flex items-center justify-center bg-paper text-ink antialiased",
        display,
        className
      )}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="ch-film-grain" aria-hidden="true" />
      <div className="ch-bg-grid absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      {/* BACKGROUND LAYER: hero headline */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 will-change-transform [transform-style:preserve-3d]">
        <h1 className={cn("text-track gsap-reveal ch-text-ink text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2", display)}>
          {tagline1}
        </h1>
        <h1 className={cn("text-days gsap-reveal ch-text-orange text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter", display)}>
          {tagline2}
        </h1>
      </div>

      {/* BACKGROUND LAYER 2: CTA */}
      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 gsap-reveal pointer-events-auto will-change-transform">
        <h2 className={cn("text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight ch-text-orange", display)}>
          {ctaHeading}
        </h2>
        <p className="text-charcoal-60 text-lg md:text-xl mb-12 max-w-xl mx-auto font-body font-light leading-relaxed">
          {ctaDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="#contact" className="ms-btn ms-btn-primary" style={{ justifyContent: "center" }}>
            {ctaPrimary} <span>{arrow}</span>
          </a>
          <a href="#work" className="ms-btn ms-btn-outline" style={{ justifyContent: "center" }}>
            {ctaSecondary} <span>{arrow}</span>
          </a>
        </div>
      </div>

      {/* FOREGROUND LAYER: the physical charcoal card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card ch-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="ch-card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            {/* TOP (mobile) / RIGHT (desktop): brand name */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className={cn("text-6xl md:text-[6rem] lg:text-[8rem] font-black uppercase tracking-tighter ch-text-card-silver lg:mt-0", display)}>
                {brandName}
              </h2>
            </div>

            {/* MIDDLE: iPhone mockup — social results dashboard */}
            <div className="mockup-scroll-wrapper order-2 lg:order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
              <div className="relative w-full h-full flex items-center justify-center transform scale-[0.65] md:scale-[0.85] lg:scale-100">
                <div
                  ref={mockupRef}
                  className="relative w-[280px] h-[580px] rounded-[3rem] ch-iphone-bezel flex flex-col will-change-transform [transform-style:preserve-3d]"
                >
                  {/* hardware buttons */}
                  <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] ch-hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] ch-hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] ch-hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] ch-hardware-btn rounded-r-md z-0 scale-x-[-1]" aria-hidden="true" />

                  {/* screen */}
                  <div className="absolute inset-[7px] bg-[#161412] rounded-[2.5rem] overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,1)] text-white z-10" dir="ltr">
                    <div className="absolute inset-0 ch-screen-glare z-40 pointer-events-none" aria-hidden="true" />

                    {/* dynamic island */}
                    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3 shadow-[inset_0_-1px_2px_rgba(255,255,255,0.1)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange shadow-[0_0_8px_rgba(255,145,0,0.8)] animate-pulse" />
                    </div>

                    {/* app interface */}
                    <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col font-display">
                      <div className="phone-widget flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1">{phoneToday}</span>
                          <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">{phoneTitle}</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-200 flex items-center justify-center font-bold text-sm border border-white/10 shadow-lg shadow-black/50">{phoneInitials}</div>
                      </div>

                      <div className="phone-widget relative w-44 h-44 mx-auto flex items-center justify-center mb-8 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                          <circle cx="88" cy="88" r="64" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="12" />
                          <circle className="ch-progress-ring" cx="88" cy="88" r="64" fill="none" stroke="#FF9100" strokeWidth="12" />
                        </svg>
                        <div className="text-center z-10 flex flex-col items-center">
                          <span className="counter-val text-4xl font-extrabold tracking-tighter text-white">0</span>
                          <span className="text-[8px] text-orange-200 uppercase tracking-[0.1em] font-bold mt-0.5">{metricLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="phone-widget ch-widget-depth rounded-2xl p-3 flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange/20 to-orange-deep/5 flex items-center justify-center mr-3 border border-orange/20 shadow-inner">
                            <svg className="w-4 h-4 text-orange drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 17l6-6 4 4 8-8M21 7h-4M21 7v4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-20 bg-neutral-300 rounded-full mb-2 shadow-inner" />
                            <div className="h-1.5 w-12 bg-neutral-600 rounded-full shadow-inner" />
                          </div>
                        </div>
                        <div className="phone-widget ch-widget-depth rounded-2xl p-3 flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 flex items-center justify-center mr-3 border border-emerald-400/20 shadow-inner">
                            <svg className="w-4 h-4 text-emerald-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-16 bg-neutral-300 rounded-full mb-2 shadow-inner" />
                            <div className="h-1.5 w-24 bg-neutral-600 rounded-full shadow-inner" />
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    </div>
                  </div>
                </div>

                {/* floating glass badges */}
                <div className="floating-badge absolute flex top-6 lg:top-12 left-[-15px] lg:left-[-80px] ch-floating-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30" dir="ltr">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-orange/20 to-orange-deep/10 flex items-center justify-center border border-orange/30 shadow-inner">
                    <span className="text-base lg:text-xl drop-shadow-lg" aria-hidden="true">{badges[0].icon}</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">{badges[0].title}</p>
                    <p className="text-white/50 text-[10px] lg:text-xs font-medium">{badges[0].sub}</p>
                  </div>
                </div>

                <div className="floating-badge absolute flex bottom-12 lg:bottom-20 right-[-15px] lg:right-[-80px] ch-floating-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30" dir="ltr">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-orange/20 to-orange-deep/10 flex items-center justify-center border border-orange/30 shadow-inner">
                    <span className="text-base lg:text-lg drop-shadow-lg" aria-hidden="true">{badges[1].icon}</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">{badges[1].title}</p>
                    <p className="text-white/50 text-[10px] lg:text-xs font-medium">{badges[1].sub}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM (mobile) / LEFT (desktop): card copy */}
            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-start z-20 w-full lg:max-w-none px-4 lg:px-0">
              <h3 className={cn("text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight", display)}>
                {cardHeading}
              </h3>
              <p className="hidden md:block text-white/70 text-sm md:text-base lg:text-lg font-body font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">
                {cardDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
