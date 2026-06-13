import Link from "next/link";
import { listClientAccounts, listActiveResets } from "@/lib/accounts";
import { adminCreateResetLink, adminSetClientPassword } from "@/app/account-actions";
import { deleteClientUser } from "../actions";
import ResetLinkList from "@/components/admin/ResetLinkList";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

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
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Client accounts</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Every client login across all portals. Reset a password directly, or create a secure reset link to send — links
        expire after an hour. (Each portal&apos;s logins are also managed on its own page.)
      </p>

      {msg && (
        <p className={`text-sm rounded-md px-4 py-2.5 mb-6 border ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.text}
        </p>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 mb-8">
        {accounts.map((a) => (
          <div key={a.id} className="px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.name}</div>
              <div className="text-xs text-neutral-500 truncate">{a.email}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                <Link href={`/admin/clients/${a.client_slug}/edit`} className="hover:text-orange">{a.client_name || a.client_slug}</Link>
                {" · "}
                <Link href={`/portal/${a.client_slug}`} target="_blank" className="hover:text-orange">View portal ↗</Link>
              </div>
            </div>

            <form action={adminSetClientPassword} className="flex items-end gap-2">
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">New password</label>
                <input name="password" type="text" minLength={8} placeholder="8+ characters" className={`${inputCls} w-44`} autoComplete="off" />
              </div>
              <button className="bg-charcoal text-white font-semibold rounded-md px-3.5 py-2 text-sm hover:bg-ink transition-colors h-[34px]">Set</button>
            </form>

            <form action={adminCreateResetLink}>
              <input type="hidden" name="id" value={a.id} />
              <button className="bg-orange text-white font-semibold rounded-md px-3.5 py-2 text-sm hover:bg-orange-deep transition-colors whitespace-nowrap h-[34px]">
                Create reset link
              </button>
            </form>

            <form action={deleteClientUser}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="slug" value={a.client_slug} />
              <ConfirmButton
                message={`Remove ${a.name} (${a.email})? They won't be able to sign in — you'll get a chance to undo right after.`}
                className="text-sm font-medium text-neutral-400 hover:text-red-600 whitespace-nowrap"
              >
                Remove
              </ConfirmButton>
            </form>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-neutral-500">No client logins yet. Create one from a client&apos;s page.</div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-3xl">
        <h2 className="font-bold mb-1">Active reset links</h2>
        <p className="text-sm text-neutral-500 mb-4">Copy a link and send it to your client (WhatsApp, email). They expire after an hour.</p>
        <ResetLinkList resets={resets} />
      </div>
    </div>
  );
}
