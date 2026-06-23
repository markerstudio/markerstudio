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
      <div className="mx-auto max-w-xl">
        <Link href={back} className="text-sm text-neutral-500 hover:text-charcoal">← Back</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Face ID / Touch ID</h1>
        <p className="mt-2 text-neutral-600">
          Add a passkey and you can sign in with your device’s Face ID, Touch ID, or fingerprint instead of typing your
          password. The biometric never leaves your device — Marker Studio only stores a public key.
        </p>

        {searchParams.added && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Passkey added — next time, use “Sign in with Face ID / Touch ID” on the login screen.
          </p>
        )}
        {searchParams.removed && (
          <p className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">Passkey removed.</p>
        )}

        {!isDbEnabled() && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Passkeys need the database to be configured (DATABASE_URL). They’re unavailable in this environment.
          </p>
        )}

        <div className="mt-8">
          <AddPasskeyButton />
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">Your passkeys</h2>
        {passkeys.length === 0 ? (
          <p className="mt-3 text-neutral-600">No passkeys yet. Add one above to enable biometric sign-in.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-medium">{p.device_label || "Device"}</span>
                <form action={removePasskey}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm font-medium text-red-600 hover:text-red-700">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
