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
    <div className="max-w-2xl space-y-5">
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Portal integrations</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Connect Facebook &amp; Instagram</h1>
        <p className="text-sm text-charcoal-60 mt-1">Pick the Page for this client&apos;s portal. We&apos;ll capture its long-lived token and the linked Instagram account automatically.</p>
      </header>

      {pages.length === 0 ? (
        <div className="lq-card lq-rise p-6">
          <p className="text-sm text-charcoal-60 mb-3">
            That account doesn&apos;t manage any Pages we can read. Make sure you authorized with an account that has access to the client&apos;s Page, then try again.
          </p>
          <Link href={`/admin/clients/${slug}/edit`} className="text-sm font-semibold text-orange hover:text-orange-deep no-underline">← Back</Link>
        </div>
      ) : (
        <form action={finishMetaConnect} className="lq-card lq-rise p-6 space-y-5">
          <input type="hidden" name="slug" value={slug} />

          <div>
            <div className="text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-2">Facebook Page</div>
            <div className="divide-y divide-charcoal/5">
              {pages.map((p, i) => (
                <label key={p.id} className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg transition-colors hover:bg-white/60">
                  <input type="radio" name="pageId" value={p.id} defaultChecked={i === 0} required className="accent-orange" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{p.name}</span>
                    <span className="block text-xs text-charcoal-60 truncate">
                      {p.igUsername ? `Instagram: @${p.igUsername}` : p.igId ? "Instagram linked" : "No Instagram linked"} · Page {p.id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Ad account (optional)</label>
            <select name="adAccountId" defaultValue={ads[0]?.id || ""} className="lq-input w-full">
              <option value="">None — organic only</option>
              {ads.map((a) => (
                <option key={a.id} value={a.id}>{a.name} (act_{a.id})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="lq-btn lq-btn--primary">Connect this portal</button>
            <Link href={`/admin/clients/${slug}/edit`} className="lq-btn lq-btn--ghost lq-btn--sm no-underline">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
