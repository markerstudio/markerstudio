import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyMetaState, listManagedPages, listAdAccounts, type ManagedPage, type AdAccount } from "@/lib/meta";
import { finishMetaConnect } from "@/app/meta-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect Meta — Marker Studio®", robots: { index: false, follow: false } };

// Step 2 of "Continue with Facebook": after consent, the studio picks which
// Page (and optionally which ad account) belongs to this client's portal.
export default async function ConnectMetaPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const raw = cookies().get("meta_oauth")?.value;
  const decoded = raw ? await verifyMetaState<{ slug: string; ut: string }>(raw) : null;
  if (!decoded || decoded.slug !== slug) redirect(`/admin/clients/${slug}/edit?error=meta-oauth`);

  let pages: ManagedPage[] = [];
  let ads: AdAccount[] = [];
  try {
    pages = await listManagedPages(decoded.ut);
    ads = await listAdAccounts(decoded.ut);
  } catch {
    redirect(`/admin/clients/${slug}/edit?error=meta-fetch`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Connect Facebook &amp; Instagram</h1>
      <p className="text-sm text-neutral-500 mb-6">Pick the Page for this client&apos;s portal. We&apos;ll capture its long-lived token and the linked Instagram account automatically.</p>

      {pages.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <p className="text-sm text-neutral-600 mb-3">
            That account doesn&apos;t manage any Pages we can read. Make sure you authorized with an account that has access to the client&apos;s Page, then try again.
          </p>
          <Link href={`/admin/clients/${slug}/edit`} className="text-sm font-semibold text-orange hover:text-orange-deep">← Back</Link>
        </div>
      ) : (
        <form action={finishMetaConnect} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
          <input type="hidden" name="slug" value={slug} />

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Facebook Page</div>
            <div className="divide-y divide-neutral-100">
              {pages.map((p, i) => (
                <label key={p.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <input type="radio" name="pageId" value={p.id} defaultChecked={i === 0} required className="accent-orange" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{p.name}</span>
                    <span className="block text-xs text-neutral-500 truncate">
                      {p.igUsername ? `Instagram: @${p.igUsername}` : p.igId ? "Instagram linked" : "No Instagram linked"} · Page {p.id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Ad account (optional)</label>
            <select name="adAccountId" defaultValue={ads[0]?.id || ""} className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange">
              <option value="">None — organic only</option>
              {ads.map((a) => (
                <option key={a.id} value={a.id}>{a.name} (act_{a.id})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">Connect this portal</button>
            <Link href={`/admin/clients/${slug}/edit`} className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
