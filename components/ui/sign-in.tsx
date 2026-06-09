"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Adapted from a 21st.dev sign-in component to Marker Studio: brand colours
// (orange/charcoal/cream), wired to a server action via `action`, and with the
// Google/OAuth + public "create account" paths removed (we use email/password
// accounts created in the admin).

const LOGO = "/assets/logo-primary-transparent.png";

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  error?: string;
  notice?: string;
  action?: (formData: FormData) => void; // server action
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-charcoal-20 bg-white transition-colors focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/25">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/40 p-4 w-64 shadow-lg`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-xl" alt="" />
    <div className="text-sm leading-snug">
      <p className="font-semibold text-ink">{testimonial.name}</p>
      <p className="text-charcoal-60">{testimonial.handle}</p>
      <p className="mt-1 text-ink/80">{testimonial.text}</p>
    </div>
  </div>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-semibold text-ink tracking-tight">Welcome back</span>,
  description = "Sign in to your Marker Studio portal.",
  heroImageSrc,
  testimonials = [],
  error,
  notice,
  action,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row font-display w-full bg-paper text-ink">
      {/* Left: form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Marker Studio" className="animate-element animate-delay-100 h-9 w-auto self-start" />
            <h1 className="animate-element animate-delay-200 text-4xl md:text-5xl font-semibold leading-tight">{title}</h1>
            <p className="animate-element animate-delay-300 text-charcoal-60">{description}</p>

            {error && (
              <p className="animate-element text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            {notice && (
              <p className="animate-element text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>
            )}

            <form className="space-y-5" action={action}>
              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-charcoal-60">Email address</label>
                <GlassInputWrapper>
                  <input name="email" type="email" required autoComplete="email" placeholder="you@brand.com" className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none text-ink" />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500">
                <label className="text-sm font-medium text-charcoal-60">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-xl focus:outline-none text-ink" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="w-5 h-5 text-charcoal-60 hover:text-ink transition-colors" /> : <Eye className="w-5 h-5 text-charcoal-60 hover:text-ink transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-600 flex items-center text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="rememberMe" defaultChecked className="custom-checkbox" />
                  <span className="text-ink/90">Keep me signed in</span>
                </label>
              </div>

              <button type="submit" className="animate-element animate-delay-700 w-full rounded-xl bg-orange py-4 font-semibold text-white hover:bg-orange-deep transition-colors">
                Sign in
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Right: hero image + optional testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }} />
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl" style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,145,0,.10), transparent 60%), linear-gradient(180deg, transparent 60%, rgba(12,10,8,.45))" }} />
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
