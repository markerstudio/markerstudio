import Link from "next/link";
import { isDbEnabled, getSql } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { deleteClient, importExampleClient, quickCreateClient } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClientsHome() {
  const dbOff = !isDbEnabled();
  let needsSetup = false;
  let clients: Awaited<ReturnType<typeof getClients>> = [];
  if (!dbOff) {
    try {
      await getSql()`SELECT 1 FROM users LIMIT 1`;
      clients = await getClients();
    } catch {
      needsSetup = true;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Client portals</h1>
        <div className="flex items-center gap-2">
          <form action={importExampleClient}>
            <button className="border border-neutral-300 rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-50">Import example</button>
          </form>
        </div>
      </div>

      <form action={quickCreateClient} className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">New client — just the name</label>
          <input name="name" required placeholder="e.g. Dr. Jack Sabat" className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange" />
        </div>
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">Create &amp; edit portal →</button>
      </form>

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>
      )}
      {needsSetup && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          Database not initialised yet. <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {clients.map((c) => (
          <div key={c.slug} className="flex items-center gap-4 px-4 py-3">
            <span className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.logo && <img src={c.logo} alt="" className="max-w-[70%] max-h-[60%] object-contain invert brightness-0 opacity-90" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-xs text-neutral-500 truncate">/portal/{c.slug}</div>
            </div>
            <Link href={`/portal/${c.slug}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">View ↗</Link>
            <Link href={`/admin/clients/${c.slug}/edit`} className="text-sm font-medium text-neutral-700 hover:text-orange">Edit</Link>
            <form action={deleteClient}>
              <input type="hidden" name="slug" value={c.slug} />
              <button className="text-sm font-medium text-neutral-400 hover:text-red-600">Delete</button>
            </form>
          </div>
        ))}
        {!dbOff && !needsSetup && clients.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">
            No clients yet — create one, or click <b>Import example</b> to load the Dr. Jack demo.
          </div>
        )}
      </div>
    </div>
  );
}
