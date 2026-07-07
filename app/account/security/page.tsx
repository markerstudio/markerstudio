import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { listUserCredentials } from "@/lib/webauthn";
import { AddPasskeyButton } from "@/components/auth/PasskeyManager";
import { removePasskey } from "@/app/passkey-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Face ID / Touch ID — Marker Studio", robots: { index: false, follow: false } };

export default async function SecurityPage({ searchParams }: { searchParams: { added?: string; removed?: string } }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const back = user.role === "client" ? "/portal" : "/admin";
  const passkeys = user && isDbEnabled() ? await listUserCredentials(user.id) : [];

  return (
    <main className="min-h-screen bg-cream px-6 py-12 text-charcoal">
      <div className="mx-auto max-w-xl lq-rise">
        <Link href={back} className="lq-btn lq-btn--glass lq-btn--sm no-underline">← Back</Link>
        <p className="mt-6 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Account security</p>
        <h1 className="mt-1 font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight">Face ID / Touch ID</h1>
        <p className="mt-2 text-charcoal-60">
          Add a passkey and you can sign in with your device’s Face ID, Touch ID, or fingerprint instead of typing your
          password. The biometric never leaves your device — Marker Studio only stores a public key.
        </p>

        {searchParams.added && (
          <p className="lq-card mt-4 px-4 py-2.5 text-sm text-emerald-800 !border-emerald-300/40">
            Passkey added — next time, use “Sign in with Face ID / Touch ID” on the login screen.
          </p>
        )}
        {searchParams.removed && (
          <p className="lq-card mt-4 px-4 py-2.5 text-sm text-charcoal-60">Passkey removed.</p>
        )}

        {!isDbEnabled() && (
          <p className="lq-card mt-6 px-4 py-2.5 text-sm text-amber-800 !border-amber-300/40">
            Passkeys need the database to be configured (DATABASE_URL). They’re unavailable in this environment.
          </p>
        )}

        <div className="mt-8">
          <AddPasskeyButton />
        </div>

        <h2 className="mt-10 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Your passkeys</h2>
        {passkeys.length === 0 ? (
          <p className="mt-3 text-charcoal-60">No passkeys yet. Add one above to enable biometric sign-in.</p>
        ) : (
          <ul className="lq-card mt-3 divide-y divide-charcoal/5 overflow-hidden">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-white/60">
                <span className="font-medium text-ink">{p.device_label || "Device"}</span>
                <form action={removePasskey}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm font-medium text-rose-600 hover:text-rose-700">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
