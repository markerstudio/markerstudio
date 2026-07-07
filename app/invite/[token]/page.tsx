import { getSql, isDbEnabled } from "@/lib/db";
import { acceptInvite } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your portal — Marker Studio®", robots: { index: false, follow: false } };

const labelCls = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5";

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
    <div className="lq-app flex min-h-[100dvh] items-center justify-center p-6 font-display text-ink">
      <div className="lq-card lq-rise w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="mb-6 h-8 w-auto" />
        {valid ? (
          <>
            <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight text-ink">Join your portal</h1>
            <p className="mb-6 text-sm text-charcoal-60">
              You&apos;ve been invited to {clientName ? <b>{clientName}</b> : "your"}&apos;s private portal. Create your login.
            </p>
            {searchParams.error && (
              <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-700">
                {ERRORS[searchParams.error] || "Something went wrong."}
              </p>
            )}
            <form action={acceptInvite} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <div>
                <label className={labelCls}>Your name</label>
                <input name="name" className="lq-input" placeholder="Your name" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" type="email" required autoComplete="email" className="lq-input" />
              </div>
              <div>
                <label className={labelCls}>Choose a password</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className="lq-input" />
                <p className="mt-1 text-xs text-charcoal-40">At least 8 characters.</p>
              </div>
              <button className="lq-btn lq-btn--primary w-full !py-3.5">Create my login</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-2 font-display text-xl font-extrabold tracking-tight text-ink">Invite unavailable</h1>
            <p className="text-sm text-charcoal-60">This invite link is invalid or has already been used. Ask Marker Studio for a new one.</p>
          </>
        )}
      </div>
    </div>
  );
}
