import Link from "next/link";
import { notFound } from "next/navigation";
import ClientForm from "@/components/admin/ClientForm";
import InviteList from "@/components/admin/InviteList";
import { getClient } from "@/lib/clients";
import { getSql } from "@/lib/db";
import { createClientUser, deleteClientUser, createInvite, syncNotion, syncNotionClient } from "../../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

const MSG: Record<string, { text: string; ok?: boolean }> = {
  saved: { text: "Client saved.", ok: true },
  imported: { text: "Example imported.", ok: true },
  login: { text: "Client login created.", ok: true },
  removed: { text: "Login removed.", ok: true },
  invite: { text: "Invite link created — copy it below and send it to your client.", ok: true },
  "invite-removed": { text: "Invite revoked.", ok: true },
  json: { text: "Portal content was not valid JSON — fix it and save again." },
  invalid: { text: "Enter a valid email and an 8+ character password." },
  exists: { text: "A user with that email already exists." },
  "notion-token": { text: "NOTION_TOKEN is not set. Add it in Vercel → Environment Variables and redeploy." },
  "notion-id": { text: "Couldn't read a Notion database ID from that — paste the database URL or 32-char ID." },
  "notion-fetch": { text: "Couldn't reach that Notion database. Check the ID and that it's shared with your integration." },
};

type ClientUser = { id: number; email: string; name: string };
type InviteRow = { id: number; token: string };

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  let logins: ClientUser[] = [];
  let invites: InviteRow[] = [];
  try {
    logins = (await getSql()`SELECT id, email, name FROM users WHERE client_id = ${client.id} ORDER BY created_at ASC`) as unknown as ClientUser[];
    invites = (await getSql()`SELECT id, token FROM invites WHERE client_id = ${client.id} AND used_at IS NULL ORDER BY created_at ASC`) as unknown as InviteRow[];
  } catch {
    logins = [];
  }

  const okKey = searchParams.ok;
  const msg = okKey?.startsWith("synced-")
    ? { text: `Synced ${okKey.slice(7)} posts from Notion into the Social calendar.`, ok: true }
    : okKey?.startsWith("client-synced-")
    ? { text: `Pulled the client record from Notion (plan, dates, status + ${okKey.slice(14)} invoices). Review below.`, ok: true }
    : okKey
    ? MSG[okKey]
    : searchParams.error
    ? MSG[searchParams.error]
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Edit · {client.name}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/portal/${client.slug}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">View portal ↗</Link>
          <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">← Back</Link>
        </div>
      </div>

      {msg && (
        <p className={`text-sm rounded-md px-4 py-2.5 mb-6 border ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.text}
        </p>
      )}

      <ClientForm client={client} />

      <div className="bg-white border border-neutral-200 rounded-xl p-6 mt-8 max-w-2xl">
        <h2 className="font-bold mb-1">Client logins</h2>
        <p className="text-sm text-neutral-500 mb-4">People who can sign in and see only this portal.</p>

        <div className="divide-y divide-neutral-100 mb-5">
          {logins.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.name}</div>
                <div className="text-xs text-neutral-500 truncate">{u.email}</div>
              </div>
              <form action={deleteClientUser}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="slug" value={client.slug} />
                <button className="text-sm font-medium text-neutral-400 hover:text-red-600">Remove</button>
              </form>
            </div>
          ))}
          {logins.length === 0 && <div className="py-3 text-sm text-neutral-500">No client logins yet.</div>}
        </div>

        <form action={createClientUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <input type="hidden" name="slug" value={client.slug} />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Name</label>
            <input name="name" className={inputCls} placeholder="Client contact" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
            <input name="email" type="email" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors h-[38px]">
            Add login
          </button>
        </form>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 mt-6 max-w-2xl">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-bold">Invite links</h2>
          <form action={createInvite}>
            <input type="hidden" name="slug" value={client.slug} />
            <button className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">Create invite</button>
          </form>
        </div>
        <p className="text-sm text-neutral-500 mb-4">Send a link to your client; they set their own password and get access — no need to type it for them.</p>
        <InviteList invites={invites} slug={client.slug} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 mt-6 max-w-2xl">
        <h2 className="font-bold mb-1">Notion sync</h2>
        <p className="text-sm text-neutral-500 mb-5">Pull live data from your Notion workspace. Share the relevant database/page with your Notion integration first.</p>

        <div className="border border-neutral-200 rounded-lg p-4 mb-4">
          <div className="font-semibold text-sm mb-1">Client record → plan, dates, status &amp; invoices</div>
          <p className="text-xs text-neutral-500 mb-3">Paste the client&apos;s row (page) from your <b>Clients Database</b>. Maps Name, Marketing Start/End dates, Status (Active), Notes, and the linked Income payments → invoices.</p>
          <form action={syncNotionClient} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="slug" value={client.slug} />
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Clients Database page URL or ID</label>
              <input name="notionPageId" defaultValue={client.data.notionPageId || ""} className={inputCls} placeholder="https://www.notion.so/…" />
            </div>
            <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors h-[38px]">Pull client record</button>
          </form>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="font-semibold text-sm mb-1">Content calendar → social posts</div>
          <p className="text-xs text-neutral-500 mb-3">Paste a Notion <b>content-calendar database</b>. Maps Date → day, Title → post, and Platform / Status if present.</p>
          <form action={syncNotion} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="slug" value={client.slug} />
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Content calendar database URL or ID</label>
              <input name="notionDbId" defaultValue={client.data.notionDbId || ""} className={inputCls} placeholder="https://www.notion.so/…?v=…" />
            </div>
            <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors h-[38px]">Pull calendar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
