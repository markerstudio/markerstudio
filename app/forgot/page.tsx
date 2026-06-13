import Link from "next/link";
import { requestReset } from "@/app/account-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password — Marker Studio®", robots: { index: false, follow: false } };

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

export default function ForgotPage({ searchParams }: { searchParams: { sent?: string } }) {
  const sent = searchParams.sent === "1";
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper text-ink font-display p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto mb-6" />
        {sent ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Check with the studio</h1>
            <p className="text-sm text-neutral-600 mb-6">
              If an account exists for that email, we&apos;ve created a secure reset link. Marker Studio will send it to
              you shortly — links expire after an hour.
            </p>
            <Link href="/login" className="text-sm font-semibold text-orange hover:text-orange-deep">← Back to sign in</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
            <p className="text-sm text-neutral-500 mb-6">Enter the email on your portal account and we&apos;ll start a reset.</p>
            <form action={requestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
                <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@brand.com" />
              </div>
              <button className="w-full bg-orange text-white font-semibold rounded-md py-3 hover:bg-orange-deep transition-colors">
                Send reset link
              </button>
            </form>
            <p className="text-xs text-neutral-400 mt-4">
              <Link href="/login" className="hover:text-neutral-700">← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
