import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getReset } from "@/lib/accounts";
import { submitReset } from "@/app/account-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set a new password — Marker Studio®", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  input: "Choose a password of at least 8 characters.",
  invalid: "This reset link is invalid or has expired. Ask Marker Studio for a new one.",
};

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  let valid = false;
  let email = "";
  if (isDbEnabled()) {
    try {
      const reset = await getReset(params.token);
      if (reset) {
        valid = reset.valid;
        email = reset.email;
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper text-ink font-display p-6">
      <div className="lq-card lq-rise w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto mb-6" />
        {valid ? (
          <>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink mb-1">Set a new password</h1>
            <p className="text-sm text-charcoal-60 mb-6">For <b>{email}</b>. You&apos;ll be signed in after.</p>
            {searchParams.error && (
              <p className="lq-well text-sm text-rose-700 !border-rose-300/40 px-3 py-2 mb-4">
                {ERRORS[searchParams.error] || "Something went wrong."}
              </p>
            )}
            <form action={submitReset} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">New password</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className="lq-input w-full" />
                <p className="text-xs text-charcoal-40 mt-1">At least 8 characters.</p>
              </div>
              <button className="lq-btn lq-btn--primary w-full justify-center py-3">
                Save new password
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display font-extrabold text-xl tracking-tight text-ink mb-2">Reset link unavailable</h1>
            <p className="text-sm text-charcoal-60 mb-4">
              {ERRORS.invalid}
            </p>
            <Link href="/forgot" className="text-sm font-semibold text-orange hover:text-orange-deep no-underline">Request a new link →</Link>
          </>
        )}
      </div>
    </div>
  );
}
