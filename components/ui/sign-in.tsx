"use client";

import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PasskeyLoginButton } from "@/components/auth/PasskeyLoginButton";

// Remember the last email used to sign in (not sensitive — just the address) so
// the field is pre-filled next time and people don't retype it on every visit.
const LAST_EMAIL_KEY = "marker:lastEmail";

// The desktop app's native bridge (injected by the Tauri shell). When present,
// the sign-in can be saved to the macOS Keychain and filled back behind a
// Touch ID / Face ID check — the app-side answer to "remember my password".
type NativeBridge = {
  saveCredentials?: (email: string, password: string) => Promise<void>;
  getCredentials?: () => Promise<{ email: string; password: string }>;
  hasCredentials?: () => Promise<boolean>;
  clearCredentials?: () => Promise<void>;
};
function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as { __MARKER_DESKTOP__?: boolean; __MARKER_NATIVE__?: NativeBridge };
  return w.__MARKER_DESKTOP__ && w.__MARKER_NATIVE__ ? w.__MARKER_NATIVE__ : null;
}

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
  heroLogos?: { name: string; logo: string }[]; // client logos tiled in a grid
  heroTagline?: string;
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
  heroLogos = [],
  heroTagline = "We mark the brands that matter.",
  testimonials = [],
  error,
  notice,
  action,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [ipcOk, setIpcOk] = useState<boolean | null>(null); // can the app bridge actually reach native code?
  const [hasSaved, setHasSaved] = useState(false);
  const [rememberInApp, setRememberInApp] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const savedThisSubmit = useRef(false);

  // Pre-fill the remembered email once, on the client, after hydration.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* localStorage unavailable (private mode) — no prefill, no harm */
    }
    // In the desktop app: offer the Keychain-saved sign-in when one exists.
    // hasCredentials doubles as a live probe of the native bridge — if the
    // IPC is dead (old app build, blocked origin) we show a clear hint
    // instead of silently promising a Keychain that can't be reached.
    const bridge = nativeBridge();
    if (bridge?.hasCredentials) {
      setIsDesktop(true);
      bridge
        .hasCredentials()
        .then((v) => {
          setIpcOk(true);
          setHasSaved(!!v);
        })
        .catch(() => setIpcOk(false));
    }
  }, []);

  // Touch ID → fill from the Keychain → submit.
  const signInWithSaved = async () => {
    const bridge = nativeBridge();
    if (!bridge?.getCredentials) return;
    try {
      const creds = await bridge.getCredentials();
      if (!creds?.email) return;
      setEmail(creds.email);
      setPassword(creds.password);
      savedThisSubmit.current = true; // already saved — don't rewrite
      // Let React commit the values into the inputs before submitting.
      setTimeout(() => formRef.current?.requestSubmit(), 30);
    } catch {
      /* Touch ID cancelled — quietly stay on the form */
    }
  };

  const forgetSaved = async () => {
    try {
      await nativeBridge()?.clearCredentials?.();
      setHasSaved(false);
    } catch {
      /* ignore */
    }
  };

  // Before the form's server action runs, stash the credentials in the
  // Keychain (desktop only, opt-out via the checkbox). preventDefault → save →
  // resubmit, with a flag so the second pass goes straight through.
  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isDesktop || !ipcOk || !rememberInApp || savedThisSubmit.current) {
      savedThisSubmit.current = false;
      return;
    }
    const bridge = nativeBridge();
    if (!bridge?.saveCredentials) return;
    e.preventDefault();
    savedThisSubmit.current = true;
    const fd = new FormData(e.currentTarget);
    bridge
      .saveCredentials(String(fd.get("email") || ""), String(fd.get("password") || ""))
      .catch(() => undefined)
      .finally(() => {
        setHasSaved(true);
        formRef.current?.requestSubmit();
      });
  };

  // Tile the client logos so the grid always fills the tall panel.
  const tiledLogos =
    heroLogos.length > 0
      ? Array.from({ length: 40 }, (_, i) => heroLogos[i % heroLogos.length])
      : [];

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

            {/* Desktop app: one-tap sign-in with the Keychain-saved account. */}
            {isDesktop && hasSaved && (
              <div className="animate-element flex items-center gap-3">
                <button
                  type="button"
                  onClick={signInWithSaved}
                  className="flex-1 rounded-xl border-2 border-orange/60 bg-orange/5 py-3.5 font-semibold text-orange-deep hover:bg-orange/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span aria-hidden>👆</span> Sign in with Touch ID
                </button>
                <button type="button" onClick={forgetSaved} className="text-xs text-charcoal-60 hover:text-red-600 whitespace-nowrap" title="Remove the saved sign-in from this Mac's Keychain">
                  Forget
                </button>
              </div>
            )}

            <form ref={formRef} className="space-y-5" action={action} onSubmit={onFormSubmit}>
              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-charcoal-60">Email address</label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    required
                    // `username` (not `email`) is what macOS Keychain / Apple
                    // Passwords and other managers pair with the password field
                    // below to offer to save and autofill the login.
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      try {
                        localStorage.setItem(LAST_EMAIL_KEY, e.target.value);
                      } catch {
                        /* ignore */
                      }
                    }}
                    placeholder="you@brand.com"
                    className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none text-ink"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500">
                <label className="text-sm font-medium text-charcoal-60">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-sm p-4 pr-12 rounded-xl focus:outline-none text-ink" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="w-5 h-5 text-charcoal-60 hover:text-ink transition-colors" /> : <Eye className="w-5 h-5 text-charcoal-60 hover:text-ink transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-600 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="rememberMe" defaultChecked className="custom-checkbox" />
                  <span className="text-ink/90">Keep me signed in</span>
                </label>
                <a href="/forgot" className="font-medium text-orange hover:text-orange-deep">Forgot password?</a>
              </div>

              {/* Desktop app: save the sign-in to the Mac's Keychain, filled
                  back later behind Touch ID / Face ID. Only offered when the
                  native bridge is confirmed reachable. */}
              {isDesktop && ipcOk && (
                <label className="animate-element flex items-center gap-3 cursor-pointer text-sm -mt-2">
                  <input type="checkbox" checked={rememberInApp} onChange={(e) => setRememberInApp(e.target.checked)} className="custom-checkbox" />
                  <span className="text-ink/90">Remember password in this Mac&apos;s Keychain <span className="text-charcoal-60">(fills with Touch ID)</span></span>
                </label>
              )}
              {isDesktop && ipcOk === false && (
                <p className="animate-element text-xs text-charcoal-60 bg-cream border border-charcoal-20 rounded-lg px-3 py-2 -mt-2">
                  Touch ID sign-in needs a newer app —{" "}
                  <a href="https://github.com/markerstudio/markerstudio/releases/latest" target="_blank" rel="noreferrer" className="font-semibold text-orange hover:text-orange-deep">
                    download the latest Marker Studio.dmg
                  </a>
                  . Your password still works below.
                </p>
              )}

              <button type="submit" className="animate-element animate-delay-700 w-full rounded-xl bg-orange py-4 font-semibold text-white hover:bg-orange-deep transition-colors">
                Sign in
              </button>
            </form>

            {/* Biometric sign-in (self-hides where passkeys aren't supported). */}
            <PasskeyLoginButton />
          </div>
        </div>
      </section>

      {/* Right: a grid of the brands we've marked (or an image fallback) */}
      {(tiledLogos.length > 0 || heroImageSrc) && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl overflow-hidden bg-ink">
            {tiledLogos.length > 0 ? (
              <div className="absolute inset-0 grid grid-cols-4">
                {tiledLogos.map((c, i) => (
                  <div key={i} className="flex aspect-[4/3] items-center justify-center border-b border-r border-white/[0.06] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.logo} alt="" loading="lazy" className="max-h-9 max-w-[72%] object-contain opacity-45 brightness-0 invert" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }} />
            )}
            {/* glow + vignette so the wordmark/tagline reads over the grid */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(120% 75% at 50% 0%, rgba(255,145,0,.18), transparent 55%), linear-gradient(180deg, rgba(12,10,8,.25) 0%, transparent 30%, rgba(12,10,8,.78) 100%)" }} />
            <div className="absolute inset-x-0 bottom-0 p-9 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Marker Studio" className="mx-auto h-8 w-auto brightness-0 invert" />
              <p className="mt-3 text-sm font-medium tracking-wide text-white/75">{heroTagline}</p>
            </div>
          </div>
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
