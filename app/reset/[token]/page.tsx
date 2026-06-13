import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getReset } from "@/lib/accounts";
import { submitReset } from "@/app/account-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set a new password — Marker Studio®", robots: { index: false, follow: false } };

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

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
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto mb-6" />
        {valid ? (
          <>
            <h1 className="text-2xl font-bold mb-1">Set a new password</h1>
            <p className="text-sm text-neutral-500 mb-6">For <b>{email}</b>. You&apos;ll be signed in after.</p>
            {searchParams.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
                {ERRORS[searchParams.error] || "Something went wrong."}
              </p>
            )}
            <form action={submitReset} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">New password</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
                <p className="text-xs text-neutral-400 mt-1">At least 8 characters.</p>
              </div>
              <button className="w-full bg-orange text-white font-semibold rounded-md py-3 hover:bg-orange-deep transition-colors">
                Save new password
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">Reset link unavailable</h1>
            <p className="text-sm text-neutral-500 mb-4">
              {ERRORS.invalid}
            </p>
            <Link href="/forgot" className="text-sm font-semibold text-orange hover:text-orange-deep">Request a new link →</Link>
          </>
        )}
      </div>
    </div>
  );
}
