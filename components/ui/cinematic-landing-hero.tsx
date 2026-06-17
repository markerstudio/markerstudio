// components/ui/cinematic-landing-hero.tsx
// Cinematic scroll-driven hero (GSAP), Marker-styled: flat + crisp (no
// skeuomorphic shadows or glows), two-color orange/charcoal. The animated
// headline and CTA carry the signature orange brushstroke. The phone tells a
// two-in-one story — it starts PLAIN (unbranded) and gets MARKED: Marker
// branding stamps on, a real analytics dashboard appears, and the numbers
// explode in. Bilingual EN/AR + RTL aware; all copy comes from lib/content.ts.
"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const LOGO = "/assets/logo-primary-transparent.png";

// Heights (%) of the growth bars — plain is flat & dull, branded climbs.
const PLAIN_BARS = [26, 30, 24, 28, 32, 27, 30, 26, 31];
const BRAND_BARS = [22, 34, 28, 46, 40, 60, 54, 78, 100];

// Flat, crisp, on-brand. No drop-shadows, glows, glass blur, or inset highlights.
const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  /* Faint paper grid — texture only, no glow */
  .ch-bg-grid {
      background-size: 64px 64px;
      background-image:
          linear-gradient(to right, rgba(48,48,48,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(48,48,48,0.05) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 72%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 72%);
  }

  /* Flat type — colour does the work, not shadows */
  .ch-text-ink { color: var(--marker-ink); }
  .ch-text-card-silver { color: #fff; }

  /* Hero brushstroke — bolder, fuller mark so the signature stroke reads
     clearly under the large display type (the global .brushed is sized for
     body-scale headings and looks thin at this size). */
  .hero-text-wrapper .brushed,
  .cta-wrapper .brushed { overflow: visible; }
  .hero-text-wrapper .brushed::after,
  .cta-wrapper .brushed::after {
      left: -6%;
      right: -6%;
      bottom: -0.14em;
      height: 0.42em;
      background-size: 100% 100%;
  }

  /* Frosted-glass charcoal card — frosts the paper + grid behind it */
  .ch-depth-card {
      background: linear-gradient(150deg, rgba(48,48,48,0.86) 0%, rgba(26,26,26,0.90) 100%);
      backdrop-filter: blur(22px) saturate(1.15);
      -webkit-backdrop-filter: blur(22px) saturate(1.15);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 12px 28px rgba(48,48,48,0.10), 0 2px 6px rgba(48,48,48,0.04);
  }
  /* Barely-visible grid woven into the card */
  .ch-card-grid {
      background-image:
          linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 88%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 88%);
  }

  /* Phone — flat hardware, crisp bezel */
  .ch-iphone-bezel {
      background: #1A1A1A;
      border: 6px solid #0C0C0C;
      box-shadow: 0 14px 30px rgba(0,0,0,0.18);
  }
  .ch-hardware-btn { background: #0C0C0C; }

  /* Flat widget row + flat floating chip */
  .ch-widget { background: var(--marker-paper); border: 1px solid var(--marker-charcoal-10); }
  .ch-chip {
      background: #fff;
      border: 1px solid var(--marker-charcoal-10);
      box-shadow: 0 4px 12px rgba(48,48,48,0.08), 0 1px 2px rgba(48,48,48,0.04);
  }

  .ch-progress-ring {
      transform: rotate(-90deg);
      transform-origin: center;
      stroke-dasharray: 402;
      stroke-dashoffset: 402;
      stroke-linecap: round;
  }

  /* Scroll cue — a hint that the page is scroll-driven. It stays for the whole
     pinned animation (the orange reads on both the light hero and the dark card)
     and only fades at the finale. Desktop shows a mouse-wheel, mobile a swipe. */
  .ch-scroll-cue {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: var(--marker-orange, #FF9100);
      animation: ch-cue-nudge 2.2s ease-in-out infinite;
  }
  .ch-scroll-cue__label {
      font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
      text-shadow: 0 1px 6px rgba(0,0,0,0.18);
  }
  .ch-scroll-cue__mouse {
      width: 26px; height: 40px; border-radius: 13px;
      border: 2px solid currentColor; position: relative;
  }
  .ch-scroll-cue__wheel {
      position: absolute; top: 7px; left: 50%; width: 3px; height: 7px; border-radius: 2px;
      background: currentColor; transform: translateX(-50%);
      animation: ch-cue-wheel 1.6s ease-in-out infinite;
  }
  /* Mobile swipe-down: a fingertip gliding down a track */
  .ch-scroll-cue__swipe { width: 30px; height: 42px; }
  .ch-swipe-track { stroke: currentColor; stroke-opacity: 0.35; stroke-width: 2; stroke-linecap: round; }
  .ch-swipe-chevron { stroke: currentColor; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ch-swipe-dot { fill: currentColor; animation: ch-cue-swipe 1.6s ease-in-out infinite; }
  .ch-cue-mobile { display: none; }
  @media (max-width: 767px) {
      .ch-cue-desktop { display: none; }
      .ch-cue-mobile { display: inline-flex; }
  }
  @keyframes ch-cue-wheel {
      0% { opacity: 0; transform: translate(-50%, 0); }
      30% { opacity: 1; }
      60% { opacity: 1; transform: translate(-50%, 12px); }
      100% { opacity: 0; transform: translate(-50%, 12px); }
  }
  @keyframes ch-cue-swipe {
      0% { opacity: 0; transform: translateY(0); }
      25% { opacity: 1; }
      70% { opacity: 1; transform: translateY(16px); }
      100% { opacity: 0; transform: translateY(16px); }
  }
  @keyframes ch-cue-nudge {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(6px); }
  }
  @media (prefers-reduced-motion: reduce) {
      .ch-scroll-cue, .ch-scroll-cue__wheel, .ch-swipe-dot { animation: none; }
  }
`;

type Badge = { icon: string; title: string; sub: string };
type Stat = { label: string; value: string };

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  tagline2Brush?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaHeadingBrush?: string;
  ctaDescription?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  arrow?: string;
  phoneToday?: string;
  phoneTitle?: string;
  phoneChartLabel?: string;
  phoneInitials?: string;
  phonePlainTitle?: string;
  phoneStats?: [Stat, Stat];
  badges?: [Badge, Badge];
  scrollHint?: string;
  swipeHint?: string;
  dir?: "ltr" | "rtl";
}

export function CinematicHero({
  brandName = "Marker",
  tagline1 = "We mark the brands",
  tagline2 = "that",
  tagline2Brush = "matter.",
  cardHeading = "Marketing, measured.",
  cardDescription = "Marker runs your brand's social like a funnel — reach to profile-visit to follower to inquiry — and reports every number, every month.",
  metricValue = 445,
  metricLabel = "K Views · 60d",
  ctaHeading = "Ready to leave a",
  ctaHeadingBrush = "mark?",
  ctaDescription = "Tell us what you're building. We reply to every brief within two working days.",
  ctaPrimary = "Start a project",
  ctaSecondary = "View work",
  arrow = "→",
  phoneToday = "Last 60 days",
  phoneTitle = "Reach",
  phoneChartLabel = "Daily reach",
  phoneInitials = "MS",
  phonePlainTitle = "Your brand",
  phoneStats = [
    { label: "Reach", value: "+1,353%" },
    { label: "Followers", value: "+369" },
  ],
  badges = [
    { icon: "📈", title: "87,606", sub: "Accounts reached" },
    { icon: "✦", title: "6.9% CTR", sub: "Click-through" },
  ],
  scrollHint = "Scroll",
  swipeHint = "Swipe down",
  dir = "ltr",
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  const isRtl = dir === "rtl";
  const display = isRtl ? "font-arabic-display" : "font-display";

  // 1. Subtle phone tilt that follows the cursor (parallax only — no glow).
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        if (mockupRef.current) {
          const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
          gsap.to(mockupRef.current, {
            rotationY: xVal * 10,
            rotationX: -yVal * 10,
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

  // 2. Cinematic scroll timeline with the plain→branded transition + number
  //    explosion. Respects prefers-reduced-motion (reveals branded statically).
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
          ".phone-branded",
          ".brand-stamp",
          ".phone-stat",
          ".phone-bar",
          ".counter-num",
          ".ch-scroll-cue-wrapper",
        ],
        { clearProps: "all", autoAlpha: 1, visibility: "visible" }
      );
      gsap.set([".phone-plain", ".cta-wrapper"], { autoAlpha: 0 });
      const el = containerRef.current?.querySelector(".counter-val");
      if (el) el.textContent = String(metricValue);
      return;
    }

    const isMobile = window.innerWidth < 768;

    const ctx = gsap.context(() => {
      gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.85, filter: "blur(20px)", rotationX: -20 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge"], { autoAlpha: 0 });
      // Phone starts PLAIN: branded layer + its parts hidden, plain layer shown.
      gsap.set(".phone-plain", { autoAlpha: 1 });
      gsap.set([".phone-branded", ".brand-stamp", ".phone-stat", ".counter-num"], { autoAlpha: 0 });
      gsap.set(".phone-bar", { scaleY: 0, transformOrigin: "bottom" });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.8, filter: "blur(30px)" });
      gsap.set(".ch-scroll-cue-wrapper", { autoAlpha: 0, y: 10 });

      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", rotationX: 0, ease: "expo.out" })
        .to(".text-days", { duration: 1.4, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0")
        .to(".ch-scroll-cue-wrapper", { duration: 1, autoAlpha: 1, y: 0, ease: "power2.out" }, "-=0.4");

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
        // Plain phone rises into view
        .fromTo(".mockup-scroll-wrapper",
          { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 }, "-=0.8"
        )
        .to({}, { duration: 1 }) // hold on the plain, unbranded phone
        // THE MARK: branding stamps on, plain dissolves
        .to(".phone-plain", { autoAlpha: 0, scale: 1.04, ease: "power2.in", duration: 1 })
        .to(".phone-branded", { autoAlpha: 1, ease: "power2.out", duration: 1 }, "<0.2")
        .fromTo(".brand-stamp",
          { autoAlpha: 0, scale: 1.6, rotationZ: -4 },
          { autoAlpha: 1, scale: 1, rotationZ: 0, ease: "back.out(2.2)", duration: 1 }, "<0.1"
        )
        // Numbers EXPLODE: ring snaps round, counter bursts in and counts up
        .to(".ch-progress-ring", { strokeDashoffset: 60, duration: 1.2, ease: "power4.out" }, "-=0.4")
        .fromTo(".counter-num",
          { autoAlpha: 0, scale: 0.2 },
          { autoAlpha: 1, scale: 1, ease: "elastic.out(1.1, 0.45)", duration: 1.6 }, "<"
        )
        .to(".counter-val", { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 1.2, ease: "power2.out" }, "<")
        // Growth bars climb
        .to(".phone-bar", { scaleY: 1, ease: "back.out(1.7)", stagger: 0.05, duration: 0.9 }, "-=1.1")
        .fromTo(".phone-stat",
          { autoAlpha: 0, y: 24, scale: 0.85 },
          { autoAlpha: 1, y: 0, scale: 1, ease: "back.out(1.8)", stagger: 0.15, duration: 1.1 }, "-=0.8"
        )
        .fromTo(".floating-badge",
          { y: 80, autoAlpha: 0, scale: 0.7 },
          { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.6)", duration: 1.3, stagger: 0.2 }, "-=1.4"
        )
        .fromTo(".card-left-text", { x: isRtl ? 50 : -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=1.2")
        .fromTo(".card-right-text", { x: isRtl ? -50 : 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.5 }, "<")
        .to({}, { duration: 2.5 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1.5 })
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"], {
          scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: "power3.in", duration: 1.2, stagger: 0.05,
        })
        .to(".ch-scroll-cue-wrapper", { autoAlpha: 0, y: -10, ease: "power2.in", duration: 0.8 }, "pullback")
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
      <div className="ch-bg-grid absolute inset-0 z-0 pointer-events-none opacity-60" aria-hidden="true" />

      {/* BACKGROUND LAYER: hero headline (with the signature brushstroke) */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 will-change-transform [transform-style:preserve-3d]">
        <h1 className={cn("text-track gsap-reveal ch-text-ink text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2", display)}>
          {tagline1}
        </h1>
        <h1 className={cn("text-days gsap-reveal ch-text-ink text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter", display)}>
          {tagline2} <span className="brushed brushed--bold">{tagline2Brush}</span>
        </h1>
      </div>

      {/* BACKGROUND LAYER 2: CTA (brushstroke on the final word) */}
      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 gsap-reveal pointer-events-auto will-change-transform">
        <h2 className={cn("text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight ch-text-ink", display)}>
          {ctaHeading} <span className="brushed brushed--bold">{ctaHeadingBrush}</span>
        </h2>
        <p className="text-charcoal-60 text-lg md:text-xl mb-10 max-w-xl mx-auto font-body font-light leading-relaxed">
          {ctaDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="/onboarding" className="ms-btn ms-btn-primary" style={{ justifyContent: "center" }}>
            {ctaPrimary} <span>{arrow}</span>
          </a>
          <a href="#work" className="ms-btn ms-btn-outline" style={{ justifyContent: "center" }}>
            {ctaSecondary} <span>{arrow}</span>
          </a>
        </div>
      </div>

      {/* FOREGROUND LAYER: the flat charcoal card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          className="main-card ch-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          {/* barely-visible grid woven into the card */}
          <div className="ch-card-grid absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            {/* TOP (mobile) / RIGHT (desktop): brand name */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className={cn("text-6xl md:text-[6rem] lg:text-[8rem] font-black uppercase tracking-tighter ch-text-card-silver", display)}>
                {brandName}
              </h2>
            </div>

            {/* MIDDLE: iPhone mockup — plain → Marker-branded analytics */}
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
                  <div className="absolute inset-[6px] bg-white rounded-[2.4rem] overflow-hidden text-ink z-10">
                    {/* dynamic island */}
                    <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[96px] h-[26px] bg-[#0C0C0C] rounded-full z-50 flex items-center justify-end px-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
                    </div>

                    {/* PLAIN (unbranded) state */}
                    <div className="phone-plain absolute inset-0 pt-11 px-4 pb-6 flex flex-col">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-md bg-charcoal-10" />
                          <div className="flex flex-col gap-1.5">
                            <span className="h-2 w-8 bg-charcoal-10 rounded-full" />
                            <span className="text-sm font-bold text-charcoal-20">{phonePlainTitle}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-charcoal-10" />
                      </div>
                      <div className="relative w-28 h-28 mx-auto my-3 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160" aria-hidden="true">
                          <circle cx="80" cy="80" r="64" fill="none" stroke="var(--marker-charcoal-10)" strokeWidth="12" />
                        </svg>
                        <span className="text-3xl font-extrabold text-charcoal-20">—</span>
                      </div>
                      <div className="flex items-end justify-between gap-1 h-10 mb-1">
                        {PLAIN_BARS.map((h, i) => (
                          <span key={i} className="flex-1 rounded-sm bg-charcoal-10" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                      <div className="h-2 w-20 bg-charcoal-10 rounded-full mb-4" />
                      <div className="space-y-2 mt-auto">
                        {[0, 1].map((i) => (
                          <div key={i} className="ch-widget rounded-lg p-2.5 flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-md bg-charcoal-10" />
                            <div className="flex-1">
                              <div className="h-2 w-16 bg-charcoal-10 rounded-full mb-2" />
                              <div className="h-2 w-10 bg-charcoal-10 rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* BRANDED (Marker) analytics dashboard */}
                    <div className="phone-branded absolute inset-0 pt-11 px-4 pb-6 flex flex-col">
                      <div className="brand-stamp flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={LOGO} alt="Marker" className="h-5 w-auto" />
                          <div className="flex flex-col leading-none gap-1">
                            <span className="text-[8px] text-charcoal-60 uppercase tracking-widest font-bold">{phoneToday}</span>
                            <span className="text-sm font-bold text-ink">{phoneTitle}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-bold text-[11px]">{phoneInitials}</div>
                      </div>

                      {/* period selector */}
                      <div className="flex gap-1 mb-1" dir="ltr">
                        {["7d", "30d", "60d"].map((p) => (
                          <span
                            key={p}
                            className={cn(
                              "flex-1 text-center text-[9px] font-bold py-1 rounded-md",
                              p === "60d" ? "bg-orange text-white" : "bg-charcoal-10 text-charcoal-60"
                            )}
                          >
                            {p}
                          </span>
                        ))}
                      </div>

                      {/* metric ring */}
                      <div className="relative w-28 h-28 mx-auto my-2 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160" aria-hidden="true">
                          <circle cx="80" cy="80" r="64" fill="none" stroke="var(--marker-charcoal-10)" strokeWidth="12" />
                          <circle className="ch-progress-ring" cx="80" cy="80" r="64" fill="none" stroke="#FF9100" strokeWidth="12" />
                        </svg>
                        <div className="counter-num text-center flex flex-col items-center max-w-[80px]">
                          <span className="counter-val text-[2rem] leading-none font-extrabold tracking-tighter text-ink">0</span>
                          <span className="text-[8px] text-orange uppercase tracking-[0.08em] font-bold mt-1 whitespace-nowrap">{metricLabel}</span>
                        </div>
                      </div>

                      {/* growth bar chart */}
                      <div className="flex items-end justify-between gap-1 h-10 mb-1.5">
                        {BRAND_BARS.map((h, i) => (
                          <span
                            key={i}
                            className={cn("phone-bar flex-1 rounded-sm", i >= BRAND_BARS.length - 2 ? "bg-orange" : "bg-orange/45")}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between items-center mb-3" dir={dir}>
                        <span className="text-[8px] text-charcoal-60 uppercase tracking-wider font-bold">{phoneChartLabel}</span>
                        <span className="text-[9px] text-[#2BB673] font-bold" dir="ltr">▲ 1,353%</span>
                      </div>

                      {/* stat rows */}
                      <div className="space-y-2 mt-auto">
                        {phoneStats.map((s, i) => (
                          <div key={i} className="phone-stat ch-widget rounded-lg px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-md bg-orange-50 text-orange flex items-center justify-center">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  {i === 0 ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 17l6-6 4 4 8-8M21 7h-4M21 7v4" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8z" />
                                  )}
                                </svg>
                              </span>
                              <span className="text-[11px] font-semibold text-charcoal-60 uppercase tracking-wider">{s.label}</span>
                            </div>
                            <span className="text-sm font-extrabold text-ink" dir="ltr">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[110px] h-[4px] bg-charcoal-10 rounded-full z-40" />
                  </div>
                </div>

                {/* flat floating chips */}
                <div className="floating-badge ch-chip absolute flex top-6 lg:top-10 left-[-15px] lg:left-[-70px] rounded-lg p-3 items-center gap-3 z-30">
                  <span className="w-9 h-9 rounded-md bg-orange-50 text-orange flex items-center justify-center text-base" aria-hidden="true">{badges[0].icon}</span>
                  <div>
                    <p className="text-ink text-sm font-bold tracking-tight" dir="ltr">{badges[0].title}</p>
                    <p className="text-charcoal-60 text-[11px] font-medium">{badges[0].sub}</p>
                  </div>
                </div>

                <div className="floating-badge ch-chip absolute flex bottom-12 lg:bottom-16 right-[-15px] lg:right-[-70px] rounded-lg p-3 items-center gap-3 z-30">
                  <span className="w-9 h-9 rounded-md bg-orange-50 text-orange flex items-center justify-center text-base" aria-hidden="true">{badges[1].icon}</span>
                  <div>
                    <p className="text-ink text-sm font-bold tracking-tight" dir="ltr">{badges[1].title}</p>
                    <p className="text-charcoal-60 text-[11px] font-medium">{badges[1].sub}</p>
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

      {/* Scroll cue — stays through the whole animation, fades at the finale */}
      <div className="ch-scroll-cue-wrapper absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none gsap-reveal" aria-hidden="true">
        <div className="ch-scroll-cue">
          <span className="ch-scroll-cue__mouse ch-cue-desktop"><span className="ch-scroll-cue__wheel" /></span>
          <svg className="ch-scroll-cue__swipe ch-cue-mobile" viewBox="0 0 30 42" aria-hidden="true">
            <line className="ch-swipe-track" x1="15" y1="6" x2="15" y2="26" />
            <g className="ch-swipe-dot"><circle cx="15" cy="8" r="4.5" /></g>
            <path className="ch-swipe-chevron" d="M8 30 l7 6 l7 -6" />
          </svg>
          <span className="ch-scroll-cue__label ch-cue-desktop">{scrollHint}</span>
          <span className="ch-scroll-cue__label ch-cue-mobile">{swipeHint}</span>
        </div>
      </div>
    </div>
  );
}
