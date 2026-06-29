import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, isPartnerOnly } from "@/lib/auth";
import ClientEditor from "@/components/admin/editor/ClientEditor";
import InviteList from "@/components/admin/InviteList";
import OnboardingBriefActions from "@/components/admin/OnboardingBriefActions";
import InvoiceEditor from "@/components/admin/InvoiceEditor";
import InvoiceStatusSelect from "@/components/admin/InvoiceStatusSelect";
import { listClientInvoices, invoiceGrandTotal, type Invoice } from "@/lib/invoices";
import { createInvoiceFromNotion, deleteInvoiceAction } from "../../../invoice-actions";
import { getClient, getClients, type OnboardingBrief } from "@/lib/clients";
import { getMetaConnectionInfo, metaAppConfigured } from "@/lib/meta";
import { isAiEnabled } from "@/lib/ai";
import { getProjects } from "@/lib/projects";
import { getSql } from "@/lib/db";
import { createClientUser, deleteClientUser, deleteClient, createInvite, syncNotion, syncNotionClient, createInNotion, setClientArchived, mergeOnboardingIntoClient } from "../../../actions";
import { connectMeta, syncMetaNow, disconnectMeta } from "@/app/meta-actions";
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
  "notion-created": { text: "Created in Notion ✓ — a Clients Database page and Budget Tracker source are now linked. Pull the client record to fill plan & finance.", ok: true },
  "notion-exists": { text: "This client is already linked to Notion." },
  "notion-ramzi": { text: "This client is owned by Ramzi — it's kept out of Marker's Notion books, so it isn't created there." },
  "notion-create": { text: "Couldn't create the client in Notion. Check NOTION_TOKEN and that the integration can edit your Clients Database." },
  archived: { text: "Client archived — hidden from the active list and their portal is blocked until you restore.", ok: true },
  unarchived: { text: "Client restored — back in the active list and their portal works again.", ok: true },
  "meta-saved": { text: "Meta connection saved. Click “Pull from Meta” to load live numbers.", ok: true },
  "meta-connected": { text: "Connected to Facebook & Instagram ✓ — click “Pull from Meta” to load live numbers.", ok: true },
  "meta-removed": { text: "Meta connection removed.", ok: true },
  "meta-none": { text: "No Meta connection yet — connect with Facebook first." },
  "meta-fetch": { text: "Couldn't reach the Meta Graph API. Check the connection and its permissions." },
  "meta-app": { text: "Meta app isn't configured — set META_APP_ID and META_APP_SECRET to enable one-click connect." },
  "meta-denied": { text: "Facebook connection was cancelled." },
  "meta-oauth": { text: "That connection step expired — start “Continue with Facebook” again." },
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
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
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
  searchParams: { ok?: string; error?: string; undo?: string; restored?: string; undoError?: string; tab?: string };
}) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  const brief = client.data.onboarding;
  const pending = client.data.status === "pending";
  // Ramzi-owned clients are the partner's own — kept entirely out of Marker's Notion.
  const ramziOwned = client.data.owner === "ramzi";
  // A partner-only admin (Ramzi) may open ONLY their own clients.
  if (isPartnerOnly(await getSession()) && !ramziOwned) redirect("/admin/partner");
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

  const metaInfo = await getMetaConnectionInfo(client.id);

  // Manual fallback (paste IDs + token) — shown collapsed when one-click connect
  // is available, or as the only option when the Meta app isn't configured.
  const metaManualForm = (
    <form action={connectMeta} className="space-y-3">
      <input type="hidden" name="slug" value={client.slug} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Facebook Page ID</label>
          <input name="fbPageId" defaultValue={metaInfo?.fbPageId || ""} className={inputCls} placeholder="1234567890" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Instagram Business ID</label>
          <input name="igUserId" defaultValue={metaInfo?.igUserId || ""} className={inputCls} placeholder="17841400000000000" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Ad Account ID</label>
          <input name="adAccountId" defaultValue={metaInfo?.adAccountId || ""} className={inputCls} placeholder="act_1234567890" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Page access token {metaInfo?.hasToken && <span className="text-neutral-400 normal-case">· leave blank to keep</span>}
          </label>
          <input name="pageToken" type="password" autoComplete="off" className={inputCls} placeholder={metaInfo?.hasToken ? "•••••••• (saved)" : "Long-lived token"} />
        </div>
      </div>
      <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors">Save connection</button>
      <p className="text-xs text-neutral-400">
        Needs <code>read_insights</code>, <code>instagram_basic</code>, <code>instagram_manage_insights</code>,
        <code> pages_read_engagement</code>, <code>ads_read</code>. Metric names can vary by Graph API version.
      </p>
    </form>
  );

  const okKey = searchParams.ok;
  const msg = okKey?.startsWith("synced-")
    ? { text: `Synced ${okKey.slice(7)} posts from Notion into the Social calendar.`, ok: true }
    : okKey?.startsWith("client-synced-")
    ? { text: `Pulled the client record from Notion (plan, dates, status + ${okKey.slice(14)} invoices). Review below.`, ok: true }
    : okKey?.startsWith("meta-synced-")
    ? { text: `Pulled ${okKey.slice(12)} live metrics & campaigns from Meta into the Analysis tab.`, ok: true }
    : okKey
    ? MSG[okKey]
    : searchParams.error
    ? MSG[searchParams.error]
    : null;

  // ---- Server-rendered slots fed into the tabbed editor --------------------

  // Documents tab: proposal & agreement builders.
  const docsSlot = (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
      <h2 className="font-bold mb-1">Proposal &amp; agreement</h2>
      <p className="text-sm text-neutral-500 mb-5">
        Both are paged, bilingual documents prepared in their builders. They only appear on the client&apos;s portal once sent.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            { label: "Proposal", doc: client.data.proposal, doneLabel: "Accepted", builder: `/admin/proposals/${client.slug}`, view: `/portal/${client.slug}/proposal` },
            { label: "Agreement", doc: client.data.agreement, doneLabel: "Signed", builder: `/admin/agreements/${client.slug}`, view: `/portal/${client.slug}/agreement` },
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
              <Link href={x.builder} className="bg-charcoal text-white font-semibold rounded-md px-3.5 py-2 text-sm hover:bg-ink transition-colors">Open builder →</Link>
              <Link href={x.view} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">Client view ↗</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Finance tab: auto-numbered invoices + the invoice editor.
  const invoicesSlot = (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
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
                {inv.status !== "paid" && (
                  <a href={`/admin/payments/new?invoice=${inv.id}`} className="text-xs font-semibold text-green-700 hover:text-green-800">+ Payment</a>
                )}
                <a href={`/admin/invoices/${inv.id}/edit`} className="text-xs font-medium text-neutral-600 hover:text-orange">Edit</a>
                <a href={`/portal/${client.slug}/invoice/${inv.id}`} target="_blank" className="text-xs font-medium text-neutral-600 hover:text-orange">PDF ↗</a>
                <form action={deleteInvoiceAction}>
                  <input type="hidden" name="slug" value={client.slug} />
                  <input type="hidden" name="id" value={inv.id} />
                  <ConfirmButton message={`Delete invoice ${inv.number}? You'll get a chance to undo right after.`} className="text-xs font-medium text-neutral-300 hover:text-red-600">Delete</ConfirmButton>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <InvoiceEditor slug={client.slug} seed={(client.data.pricing?.items || []).length ? client.data.pricing!.items : seededPricing} storiesFee={client.data.finance?.storiesFee || ""} />
    </div>
  );

  // Settings tab: onboarding, access, integrations, danger zone.
  const sectionHead = (text: string) => <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1 pt-2">{text}</h2>;
  const settingsSlot = (
    <div className="space-y-6">
      {brief && (client.data.proposal?.acceptedAt || client.data.agreement?.acceptedAt) && (
        <div className="text-sm rounded-md px-4 py-3 border text-green-700 bg-green-50 border-green-200 space-y-1">
          {client.data.proposal?.acceptedAt && <div>✓ Proposal accepted on {new Date(client.data.proposal.acceptedAt).toLocaleString("en-GB")}.</div>}
          {client.data.agreement?.acceptedAt && <div>✓ Agreement e-signed by <b>{client.data.agreement.signedName}</b> on {new Date(client.data.agreement.acceptedAt).toLocaleString("en-GB")}.</div>}
        </div>
      )}

      {brief && <OnboardingBriefPanel brief={brief} />}
      {brief && <OnboardingBriefActions brief={brief} />}

      {brief && others.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold mb-1">Connect to an existing portal</h2>
          <p className="text-sm text-neutral-500 mb-4">Already manage this brand? Move this onboarding&apos;s login and brief onto an existing portal — this draft is then removed.</p>
          <form action={mergeOnboardingIntoClient} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="fromSlug" value={client.slug} />
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Existing portal</label>
              <select name="toSlug" required className={inputCls}>
                <option value="">Choose a portal…</option>
                {others.map((c) => (<option key={c.slug} value={c.slug}>{c.name} (/{c.slug})</option>))}
              </select>
            </div>
            <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors h-[38px]">Connect →</button>
          </form>
        </div>
      )}

      {sectionHead("Access")}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
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
            <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors h-[38px]">Add login</button>
          </form>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
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
      </div>

      {sectionHead("Integrations")}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold mb-1">Notion sync</h2>
          <p className="text-sm text-neutral-500 mb-5">Pull live data from your Notion workspace. Share the relevant database/page with your Notion integration first.</p>

          {!client.data.notionPageId && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 mb-4">
              <div className="font-semibold text-sm mb-1">Not linked to Notion yet</div>
              <p className="text-xs text-neutral-600 mb-3">Onboarding portals aren&apos;t added to Notion automatically. Create the client&apos;s <b>Clients Database</b> page and <b>Budget Tracker</b> source (attached to the debt table) and link it here in one click — then pull the record below to fill plan &amp; finance.</p>
              <form action={createInNotion}>
                <input type="hidden" name="slug" value={client.slug} />
                <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors h-[38px]">Create in Notion</button>
              </form>
            </div>
          )}

          <div className="border border-neutral-200 rounded-lg p-4 mb-4">
            <div className="font-semibold text-sm mb-1">Linked Notion page (Clients Database)</div>
            <p className="text-xs text-neutral-500 mb-3">This is where the <b>Plan &amp; finance</b> shown at the top of the page comes from. Once linked, use <b>Refresh from Notion</b> up top to re-pull. Paste a different Clients Database page below to link or change it.</p>
            <form action={syncNotionClient} className="flex items-end gap-3 flex-wrap">
              <input type="hidden" name="slug" value={client.slug} />
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Clients Database page URL or ID</label>
                <input name="notionPageId" defaultValue={client.data.notionPageId || ""} className={inputCls} placeholder="https://www.notion.so/…" />
              </div>
              <button className="bg-neutral-800 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-neutral-900 transition-colors h-[38px]">{client.data.notionPageId ? "Re-link & pull" : "Link & pull"}</button>
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

        <details className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm" {...(metaInfo?.hasToken ? { open: true } : {})}>
          <summary className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="font-bold">Live data · Facebook &amp; Instagram</span>
            {metaInfo?.hasToken ? (
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Connected</span>
            ) : (
              <span className="text-xs font-medium text-neutral-400">Optional</span>
            )}
          </summary>
          <p className="text-sm text-neutral-500 mt-3 mb-5">Connect the client&apos;s Facebook Page + Instagram so the portal&apos;s Analysis tab shows live reach, views, followers, and ad-campaign performance — refreshed automatically. The token is stored securely and never shown to the client. Until you connect this, the Analysis tab uses the numbers you type in.</p>

          {metaAppConfigured() ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <a href={`/api/meta/connect?slug=${client.slug}`} className="inline-flex items-center gap-2 bg-[#1877F2] text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-[#0f6ae0] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
                  {metaInfo?.hasToken ? "Reconnect with Facebook" : "Continue with Facebook"}
                </a>
                {metaInfo?.hasToken && (
                  <form action={syncMetaNow}>
                    <input type="hidden" name="slug" value={client.slug} />
                    <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">Pull from Meta</button>
                  </form>
                )}
                {metaInfo?.hasToken && (
                  <form action={disconnectMeta}>
                    <input type="hidden" name="slug" value={client.slug} />
                    <button className="text-sm font-medium text-neutral-400 hover:text-red-600">Disconnect</button>
                  </form>
                )}
              </div>
              {metaInfo?.hasToken && (
                <p className="text-xs text-neutral-500 mt-3">
                  Page <b>{metaInfo.fbPageId || "—"}</b>
                  {metaInfo.igUserId ? <> · Instagram <b>{metaInfo.igUserId}</b></> : null}
                  {metaInfo.adAccountId ? <> · Ads <b>act_{metaInfo.adAccountId}</b></> : null}
                </p>
              )}
              <details className="mt-4">
                <summary className="text-sm font-medium text-neutral-600 cursor-pointer hover:text-neutral-900">Enter IDs manually instead</summary>
                <div className="mt-3">{metaManualForm}</div>
              </details>
            </>
          ) : (
            <>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">Set <code>META_APP_ID</code> and <code>META_APP_SECRET</code> to enable one-click “Continue with Facebook”. Until then, connect by pasting IDs + a token:</p>
              {metaManualForm}
            </>
          )}
        </details>
      </div>

      {sectionHead("Danger zone")}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold mb-1">{client.data.archived ? "Archived" : "Archive client"}</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {client.data.archived
            ? "This client is archived — hidden from the active list and the client can't open their portal. Everything is kept; restore it anytime."
            : "Hide this client from the active list and block their portal access, without deleting anything. Use it for a dropped or changed-mind prospect you may want back. Restore anytime."}
        </p>
        <form action={setClientArchived}>
          <input type="hidden" name="slug" value={client.slug} />
          <input type="hidden" name="archived" value={client.data.archived ? "" : "1"} />
          <button className="border border-neutral-300 text-neutral-700 font-semibold rounded-md px-5 py-2.5 text-sm hover:border-neutral-400 hover:bg-neutral-50 transition-colors">{client.data.archived ? "Restore client" : "Archive client"}</button>
        </form>
      </div>

      <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold mb-1 text-red-700">Delete</h2>
        <p className="text-sm text-neutral-500 mb-4">Deletes this portal and its client logins. You&apos;ll get a chance to undo right after.</p>
        <form action={deleteClient}>
          <input type="hidden" name="slug" value={client.slug} />
          <ConfirmButton message={`Delete ${client.name || client.slug} and their portal, including all client logins? You'll get an Undo option right after.`} className="border border-red-300 text-red-600 font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-red-600 hover:border-red-600 hover:text-white transition-colors">Delete this client…</ConfirmButton>
        </form>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">← All clients</Link>

      {/* Identity header — brand-tinted, with status and quick actions. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-6 shadow-sm">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-2xl" style={{ background: client.color }} aria-hidden />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0 overflow-hidden">
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logo} alt="" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <span className="text-lg font-bold">{(client.name || "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Client portal</div>
              <h1 className="text-2xl font-bold tracking-tight truncate">{client.name || client.slug}</h1>
              <div className="text-sm text-white/50 truncate">/portal/{client.slug}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {pending && <span className="text-xs font-semibold bg-orange text-white rounded-full px-2.5 py-0.5">New · onboarding</span>}
              {client.data.proposal?.acceptedAt && <span className="text-xs font-semibold bg-green-500/20 text-green-200 rounded-full px-2.5 py-0.5">Proposal accepted</span>}
              {client.data.agreement?.acceptedAt && <span className="text-xs font-semibold bg-green-500/20 text-green-200 rounded-full px-2.5 py-0.5">Agreement signed</span>}
              {metaInfo?.hasToken && <span className="text-xs font-semibold bg-sky-500/20 text-sky-200 rounded-full px-2.5 py-0.5">Meta connected</span>}
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/portal/${client.slug}`} target="_blank" className="rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm font-medium transition-colors">View portal ↗</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Plan & finance — owned by Notion, shown read-only here so it's always
          clear WHERE the real numbers live and how to update them. */}
      <div className="rounded-2xl bg-white border border-neutral-200 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">Plan &amp; finance</h2>
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-neutral-900 text-white">{ramziOwned ? "Ramzi-owned" : "From Notion"}</span>
          </div>
          {ramziOwned ? null : client.data.notionPageId ? (
            <div className="flex items-center gap-3">
              <a
                href={`https://www.notion.so/${client.data.notionPageId.replace(/-/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 whitespace-nowrap"
              >
                Open in Notion ↗
              </a>
              <form action={syncNotionClient}>
                <input type="hidden" name="slug" value={client.slug} />
                <input type="hidden" name="notionPageId" value={client.data.notionPageId} />
                <button className="bg-charcoal text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-ink transition-colors whitespace-nowrap">
                  Refresh from Notion
                </button>
              </form>
            </div>
          ) : (
            <a href={`/admin/clients/${client.slug}/edit?tab=settings`} className="text-sm font-semibold text-orange hover:text-orange-deep whitespace-nowrap">
              Set up Notion link →
            </a>
          )}
        </div>

        {ramziOwned ? (
          <p className="text-sm text-neutral-600">
            This is <b>Ramzi&apos;s</b> client — kept out of Marker&apos;s Notion books. Manage its plan, fees and payments in the portal form below; nothing here syncs to Notion.
          </p>
        ) : client.data.notionPageId ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              {[
                { label: "Plan", value: client.data.plan?.name || "—" },
                { label: "Status", value: client.data.plan?.active ? "Active" : "Inactive" },
                { label: "Cycle", value: [client.data.plan?.start, client.data.plan?.end].filter(Boolean).join(" → ") || "—" },
                { label: "Monthly fee", value: client.data.finance?.monthlyFee || "—" },
                { label: "Money left", value: client.data.plan?.balance || "—" },
                { label: "Paid", value: `${client.data.finance?.progress ?? 0}%` },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{s.label}</div>
                  <div className="text-base font-semibold tracking-tight mt-0.5 truncate">{s.value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-4">
              These live in Notion — edit them there, then <b>Refresh</b>. They aren&apos;t editable here.
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-600">
            Not linked to Notion yet. Plan &amp; finance live in your Notion Budget Tracker — set up the link under{" "}
            <a href={`/admin/clients/${client.slug}/edit?tab=settings`} className="font-semibold text-orange hover:text-orange-deep">Settings → Integrations</a>.
          </p>
        )}
      </div>

      {msg && (
        <p className={`text-sm rounded-md px-4 py-2.5 border ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.text}
        </p>
      )}

      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back={`/admin/clients/${client.slug}/edit`} />

      <ClientEditor
        client={client}
        projectLogos={projectLogos}
        apiEnabled={isAiEnabled()}
        linkedToNotion={!!client.data.notionPageId}
        initialTab={searchParams.tab}
        docsSlot={docsSlot}
        invoicesSlot={invoicesSlot}
        settingsSlot={settingsSlot}
      />
    </div>
  );
}
