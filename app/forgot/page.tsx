import Link from "next/link";
import { requestReset } from "@/app/account-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password — Marker Studio®", robots: { index: false, follow: false } };

export default function ForgotPage({ searchParams }: { searchParams: { sent?: string } }) {
  const sent = searchParams.sent === "1";
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper text-ink font-display p-6">
      <div className="lq-card lq-rise w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto mb-6" />
        {sent ? (
          <>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink mb-2">Check with the studio</h1>
            <p className="text-sm text-charcoal-60 mb-6">
              If an account exists for that email, we&apos;ve created a secure reset link. Marker Studio will send it to
              you shortly — links expire after an hour.
            </p>
            <Link href="/login" className="text-sm font-semibold text-orange hover:text-orange-deep no-underline">← Back to sign in</Link>
          </>
        ) : (
          <>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink mb-1">Forgot your password?</h1>
            <p className="text-sm text-charcoal-60 mb-6">Enter the email on your portal account and we&apos;ll start a reset.</p>
            <form action={requestReset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Email</label>
                <input name="email" type="email" required autoComplete="email" className="lq-input w-full" placeholder="you@brand.com" />
              </div>
              <button className="lq-btn lq-btn--primary w-full justify-center py-3">
                Send reset link
              </button>
            </form>
            <p className="text-xs text-charcoal-40 mt-4">
              <Link href="/login" className="hover:text-charcoal-80 no-underline">← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
