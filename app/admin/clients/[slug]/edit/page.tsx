import Link from "next/link";
import { notFound } from "next/navigation";
import ClientForm from "@/components/admin/ClientForm";
import InviteList from "@/components/admin/InviteList";
import OnboardingBriefActions from "@/components/admin/OnboardingBriefActions";
import InvoiceEditor from "@/components/admin/InvoiceEditor";
import InvoiceStatusSelect from "@/components/admin/InvoiceStatusSelect";
import { listClientInvoices, invoiceGrandTotal, type Invoice } from "@/lib/invoices";
import { createInvoiceFromNotion, deleteInvoiceAction } from "../../../invoice-actions";
import { getClient, getClients, type OnboardingBrief } from "@/lib/clients";
import { getProjects } from "@/lib/projects";
import { getSql } from "@/lib/db";
import { createClientUser, deleteClientUser, deleteClient, createInvite, syncNotion, syncNotionClient, mergeOnboardingIntoClient } from "../../../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

const MSG: Record<string, { text: string; ok?: boolean }> = {
  saved: { text: "Client saved.", ok: true },
  imported: { text: "Imported from Notion ✓ — review and Save changes.", ok: true },
  login: { text: "Client login created.", ok: true },
  removed: { text: "Login removed.", ok: true },
  invite: { text: "Invite link created — copy it below and send it to your client.", ok: true },
  "invite-removed": { text: "Invite revoked.", ok: true },
  connected: { text: "Onboarding connected to this portal — the draft was merged in and removed.", ok: true },
  merge: { text: "Pick a different portal to connect this onboarding to." },
  "proposal-sent": { text: "Proposal sent — it now appears on the client's portal to review and accept.", ok: true },
  "proposal-unsent": { text: "Proposal hidden from the client.", ok: true },
  "timeline-saved": { text: "Timeline saved.", ok: true },
  "agreement-sent": { text: "Agreement sent — the client can now review and e-sign it.", ok: true },
  "agreement-unsent": { text: "Agreement hidden from the client.", ok: true },
  "pricing-saved": { text: "Pricing saved — it shows on the proposal and agreement.", ok: true },
  "invoice-created": { text: "Invoice created — it's in the client's portal under Invoices.", ok: true },
  "invoice-updated": { text: "Invoice status updated.", ok: true },
  "invoice-deleted": { text: "Invoice deleted.", ok: true },
  "invoice-empty": { text: "Add at least one line item to create an invoice." },
  "no-fee": { text: "No monthly fee found — sync the client from Notion first." },
  json: { text: "Portal content was not valid JSON — fix it and save again." },
  invalid: { text: "Enter a valid email and an 8+ character password." },
  exists: { text: "A user with that email already exists." },
  "notion-token": { text: "NOTION_TOKEN is not set. Add it in Vercel → Environment Variables and redeploy." },
  "notion-id": { text: "Couldn't read a Notion database ID from that — paste the database URL or 32-char ID." },
  "notion-fetch": { text: "Couldn't reach that Notion database. Check the ID and that it's shared with your integration." },
};

type ClientUser = { id: number; email: string; name: string };
type InviteRow = { id: number; token: string };

// Read-only display of the brief captured by /onboarding.
function OnboardingBriefPanel({ brief }: { brief: OnboardingBrief }) {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | string[] | boolean) => {
    if (value === undefined || value === null || value === "") return;
    const v = Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : value;
    if (v) rows.push({ label, value: v });
  };
  add("Branding package", brief.plan);
  add("Branding features", brief.planFeatures);
  add("Marketing package", brief.marketingPlan);
  add("Marketing features", brief.marketingFeatures);
  add("Services", brief.services);
  add("Other service", brief.servicesOther);
  add("Contact", `${brief.firstName} ${brief.lastName}`.trim());
  add("Email", brief.email);
  add("Phone", brief.phone);
  add("Location", brief.location);
  add("Brand / company", brief.brandName);
  add("Description", brief.brandDescription);
  add("Logo language", brief.logoLanguage);
  add("Products", brief.products);
  add("Competitors", brief.competitors);
  add("Business goals", brief.businessGoals);
  add("Audience gender", brief.audienceGender);
  add("Audience age", brief.audienceAge);
  add("Online presence", brief.onlinePresence);
  add("Symbol / shape", brief.symbolShape);
  add("Colour in mind", brief.colorInMind);
  add("Which colour", brief.colorDetail);
  add("Exact logo text", brief.exactLogoText);
  add("Tagline / slogan", brief.tagline);
  add("Existing designs", brief.existingDesign);
  add("Additional notes", brief.additionalNotes);
  add("Newsletter", brief.newsletter);

  const submitted = brief.submittedAt ? new Date(brief.submittedAt).toLocaleString("en-GB") : "";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-bold">Onboarding brief</h2>
        {submitted && <span className="text-xs text-neutral-400">{submitted}</span>}
      </div>
      <p className="text-sm text-neutral-500 mb-4">Submitted through the public onboarding form.</p>
      <dl className="divide-y divide-neutral-100">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-3 gap-3 py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{r.label}</dt>
            <dd className="col-span-2 text-sm text-neutral-800 whitespace-pre-wrap">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  const brief = client.data.onboarding;
  const pending = client.data.status === "pending";
  const others = brief ? (await getClients()).filter((c) => c.slug !== client.slug) : [];
  const projectLogos = (await getProjects().catch(() => [])).map((p) => ({ slug: p.slug, name: p.name.en, logo: p.logo }));

  // Seed the pricing editor from what the client selected (once saved, use that).
  const seededPricing = client.data.pricing?.items?.length
    ? client.data.pricing.items
    : [
        ...(brief?.plan ? [{ label: brief.plan, amount: "" }] : []),
        ...(brief?.marketingPlan ? [{ label: brief.marketingPlan, amount: "" }] : []),
        ...((brief?.services || []).map((sv) => ({ label: sv, amount: "" }))),
        ...(brief?.servicesOther ? [{ label: brief.servicesOther, amount: "" }] : []),
      ];

  let clientInvoices: Invoice[] = [];
  try {
    clientInvoices = await listClientInvoices(client.id);
  } catch {
    clientInvoices = [];
  }
  const monthlyFee = client.data.finance?.monthlyFee || "";

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
        <h1 className="text-2xl font-bold tracking-tight">
          Edit · {client.name}
          {pending && (
            <span className="ml-2 align-middle text-xs font-semibold bg-orange text-white rounded-full px-2 py-0.5">New · onboarding</span>
          )}
        </h1>
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

      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back={`/admin/clients/${client.slug}/edit`} />

      {brief && (client.data.proposal?.acceptedAt || client.data.agreement?.acceptedAt) && (
        <div className="text-sm rounded-md px-4 py-3 mb-6 border text-green-700 bg-green-50 border-green-200 max-w-2xl space-y-1">
          {client.data.proposal?.acceptedAt && (
            <div>✓ Proposal accepted on {new Date(client.data.proposal.acceptedAt).toLocaleString("en-GB")}.</div>
          )}
          {client.data.agreement?.acceptedAt && (
            <div>
              ✓ Agreement e-signed by <b>{client.data.agreement.signedName}</b> on {new Date(client.data.agreement.acceptedAt).toLocaleString("en-GB")}.
            </div>
          )}
        </div>
      )}

      {brief && <OnboardingBriefPanel brief={brief} />}

      {brief && <OnboardingBriefActions brief={brief} />}

      {client && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 max-w-2xl">
          <h2 className="font-bold mb-1">Proposal &amp; agreement</h2>
          <p className="text-sm text-neutral-500 mb-5">
            Both are paged, bilingual documents prepared in their builders. They only appear on the client&apos;s portal once sent.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                {
                  label: "Proposal",
                  doc: client.data.proposal,
                  doneLabel: "Accepted",
                  builder: `/admin/proposals/${client.slug}`,
                  view: `/portal/${client.slug}/proposal`,
                },
                {
                  label: "Agreement",
                  doc: client.data.agreement,
                  doneLabel: "Signed",
                  builder: `/admin/agreements/${client.slug}`,
                  view: `/portal/${client.slug}/agreement`,
                },
              ] as const
            ).map((x) => (
              <div key={x.label} className="border border-neutral-200 rounded-lg p-4">
                <div className="font-semibold text-sm mb-2">
                  {x.label}{" "}
                  {x.doc?.acceptedAt ? (
                    <span className="ml-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">{x.doneLabel}</span>
                  ) : x.doc?.published ? (
                    <span className="ml-1 text-xs font-semibold text-orange-deep bg-orange-50 rounded-full px-2 py-0.5">Sent</span>
                  ) : (
                    <span className="ml-1 text-xs font-semibold text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">Draft</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link href={x.builder} className="bg-charcoal text-white font-semibold rounded-md px-3.5 py-2 text-sm hover:bg-ink transition-colors">
                    Open builder →
                  </Link>
                  <Link href={x.view} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">
                    Client view ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {client && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 max-w-2xl">
          <h2 className="font-bold mb-1">Invoices</h2>
          <p className="text-sm text-neutral-500 mb-4">Auto-numbered (INV-{new Date().getFullYear()}-NNN). They appear in the client&apos;s portal under Invoices.</p>

          {monthlyFee && (
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-orange/40 bg-orange-50/50 px-4 py-3 mb-4">
              <div className="text-sm">
                <div className="font-semibold text-neutral-900">This client&apos;s month is due</div>
                <div className="text-neutral-600">Monthly fee from Notion: <b>{monthlyFee}</b>{client.data.plan?.end ? ` · cycle ends ${client.data.plan.end}` : ""}</div>
              </div>
              <form action={createInvoiceFromNotion}>
                <input type="hidden" name="slug" value={client.slug} />
                <button className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">Draft monthly invoice</button>
              </form>
            </div>
          )}

          {clientInvoices.length > 0 && (
            <div className="divide-y divide-neutral-100 mb-5">
              {clientInvoices.map((inv) => {
                const rate = Number(inv.vat_rate) || 0;
                const total = invoiceGrandTotal(inv.items, rate);
                const paid = Number(inv.paid_amount) || 0;
                const left = Math.max(0, total - paid);
                return (
                  <div key={inv.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <a href={`/portal/${client.slug}/invoice/${inv.id}`} target="_blank" className="font-mono text-sm font-semibold text-neutral-800 hover:text-orange">{inv.number}</a>
                      <span className="ml-2 text-xs text-neutral-400">{new Date(inv.issued_date).toLocaleDateString("en-GB")}{rate > 0 ? ` · +${inv.vat_rate}% VAT` : ""}</span>
                    </div>
                    <span className="tabular-nums text-sm font-semibold text-neutral-900 text-right">
                      {total.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      {paid > 0 && <span className="block text-xs font-medium text-orange-deep">{left.toLocaleString("en-US", { maximumFractionDigits: 2 })} left</span>}
                    </span>
                    <InvoiceStatusSelect id={inv.id} slug={client.slug} status={inv.status} />
                    <a href={`/portal/${client.slug}/invoice/${inv.id}`} target="_blank" className="text-xs font-medium text-neutral-600 hover:text-orange">PDF ↗</a>
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="slug" value={client.slug} />
                      <input type="hidden" name="id" value={inv.id} />
                      <ConfirmButton
                        message={`Delete invoice ${inv.number}? You'll get a chance to undo right after.`}
                        className="text-xs font-medium text-neutral-300 hover:text-red-600"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          <InvoiceEditor slug={client.slug} seed={(client.data.pricing?.items || []).length ? client.data.pricing!.items : seededPricing} />
        </div>
      )}

      {brief && others.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-8 max-w-2xl">
          <h2 className="font-bold mb-1">Connect to an existing portal</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Already manage this brand? Move this onboarding&apos;s login and brief onto an existing portal — this draft is then removed.
          </p>
          <form action={mergeOnboardingIntoClient} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="fromSlug" value={client.slug} />
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Existing portal</label>
              <select name="toSlug" required className={inputCls}>
                <option value="">Choose a portal…</option>
                {others.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name} (/{c.slug})</option>
                ))}
              </select>
            </div>
            <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors h-[38px]">
              Connect →
            </button>
          </form>
          <p className="text-xs text-neutral-500 mt-3">
            To connect with a <b>Notion</b> client instead, use the Notion sync panel below — it stays available for this portal anytime.
          </p>
        </div>
      )}

      <ClientForm client={client} projectLogos={projectLogos} />

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

      <div className="bg-white border border-red-200 rounded-xl p-6 mt-6 max-w-2xl">
        <h2 className="font-bold mb-1 text-red-700">Danger zone</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Deletes this portal and its client logins. You&apos;ll get a chance to undo right after.
        </p>
        <form action={deleteClient}>
          <input type="hidden" name="slug" value={client.slug} />
          <ConfirmButton
            message={`Delete ${client.name || client.slug} and their portal, including all client logins? You'll get an Undo option right after.`}
            className="border border-red-300 text-red-600 font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-red-600 hover:border-red-600 hover:text-white transition-colors"
          >
            Delete this client…
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
