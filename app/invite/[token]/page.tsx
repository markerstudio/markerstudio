import { getSql, isDbEnabled } from "@/lib/db";
import { acceptInvite } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your portal — Marker Studio®", robots: { index: false, follow: false } };

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

const ERRORS: Record<string, string> = {
  input: "Enter your email and a password of at least 8 characters.",
  invalid: "This invite link is invalid or has already been used.",
  "email-taken": "An account with that email already exists — try signing in instead.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  let clientName = "";
  let valid = false;
  if (isDbEnabled()) {
    try {
      const rows = (await getSql()`
        SELECT i.used_at, c.name FROM invites i JOIN clients c ON c.id = i.client_id WHERE i.token = ${params.token} LIMIT 1
      `) as unknown as { used_at: string | null; name: string }[];
      if (rows[0]) {
        valid = !rows[0].used_at;
        clientName = rows[0].name;
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
            <h1 className="text-2xl font-bold mb-1">Join your portal</h1>
            <p className="text-sm text-neutral-500 mb-6">
              You&apos;ve been invited to {clientName ? <b>{clientName}</b> : "your"}&apos;s private portal. Create your login.
            </p>
            {searchParams.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
                {ERRORS[searchParams.error] || "Something went wrong."}
              </p>
            )}
            <form action={acceptInvite} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Your name</label>
                <input name="name" className={inputCls} placeholder="Your name" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
                <input name="email" type="email" required autoComplete="email" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Choose a password</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
                <p className="text-xs text-neutral-400 mt-1">At least 8 characters.</p>
              </div>
              <button className="w-full bg-orange text-white font-semibold rounded-md py-3 hover:bg-orange-deep transition-colors">
                Create my login
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">Invite unavailable</h1>
            <p className="text-sm text-neutral-500">This invite link is invalid or has already been used. Ask Marker Studio for a new one.</p>
          </>
        )}
      </div>
    </div>
  );
}
