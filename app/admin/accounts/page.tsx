import Link from "next/link";
import { listClientAccounts, listActiveResets } from "@/lib/accounts";
import { adminCreateResetLink, adminSetClientPassword } from "@/app/account-actions";
import { deleteClientUser } from "../actions";
import ResetLinkList from "@/components/admin/ResetLinkList";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { EmptyState } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

const inputCls = "lq-input w-full";

const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  link: { text: "Reset link created — copy it below and send it to your client.", ok: true },
  pw: { text: "Password updated.", ok: true },
  revoked: { text: "Reset link revoked.", ok: true },
  invalid: { text: "Enter a password of at least 8 characters." },
};

export default async function AccountsPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const accounts = await listClientAccounts();
  const resets = await listActiveResets();
  const msg = searchParams.ok ? MESSAGES[searchParams.ok] : searchParams.error ? MESSAGES[searchParams.error] : null;

  return (
    <div className="space-y-5">
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Access &amp; passwords</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Client accounts</h1>
        <p className="text-sm text-charcoal-60 mt-1.5 max-w-2xl">
          Every client login across all portals. Reset a password directly, or create a secure reset link to send — links
          expire after an hour. (Each portal&apos;s logins are also managed on its own page.)
        </p>
      </header>

      {msg && (
        <p className={`lq-card text-sm px-4 py-3 ${msg.ok ? "text-emerald-700 !border-emerald-300/40" : "text-rose-700 !border-rose-300/40"}`}>
          {msg.text}
        </p>
      )}

      <div className="lq-card lq-rise divide-y divide-charcoal/5" style={{ animationDelay: "60ms" }}>
        {accounts.map((a) => (
          <div key={a.id} className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink truncate">{a.name}</div>
              <div className="text-xs text-charcoal-60 truncate">{a.email}</div>
              <div className="text-xs text-charcoal-40 mt-0.5">
                <Link href={`/admin/clients/${a.client_slug}/edit`} className="hover:text-orange-deep no-underline">{a.client_name || a.client_slug}</Link>
                {" · "}
                <Link href={`/portal/${a.client_slug}`} target="_blank" className="hover:text-orange-deep no-underline">View portal ↗</Link>
              </div>
            </div>

            <form action={adminSetClientPassword} className="flex items-end gap-2">
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">New password</label>
                <input name="password" type="text" minLength={8} placeholder="8+ characters" className={`${inputCls} w-44`} autoComplete="off" />
              </div>
              <button className="lq-btn lq-btn--dark lq-btn--sm">Set</button>
            </form>

            <form action={adminCreateResetLink}>
              <input type="hidden" name="id" value={a.id} />
              <button className="lq-btn lq-btn--primary lq-btn--sm whitespace-nowrap">
                Create reset link
              </button>
            </form>

            <form action={deleteClientUser}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="slug" value={a.client_slug} />
              <ConfirmButton
                message={`Remove ${a.name} (${a.email})? They won't be able to sign in — you'll get a chance to undo right after.`}
                className="text-sm font-medium text-charcoal-40 hover:text-rose-700 whitespace-nowrap"
              >
                Remove
              </ConfirmButton>
            </form>
          </div>
        ))}
        {accounts.length === 0 && (
          <EmptyState
            icon="🔑"
            title="No client logins yet"
            sub={<>Create one from a client&apos;s page.</>}
          />
        )}
      </div>

      <div className="lq-card lq-rise p-5 max-w-3xl" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Active reset links</h2>
        <p className="text-sm text-charcoal-60 mb-4">Copy a link and send it to your client (WhatsApp, email). They expire after an hour.</p>
        <ResetLinkList resets={resets} />
      </div>
    </div>
  );
}
