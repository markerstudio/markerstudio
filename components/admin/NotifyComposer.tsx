"use client";

// The Notify panel's composer — write a push, pick the audience (with live
// device counts), send. Includes one-tap enrolment for THIS device and a test
// send, so the whole loop can be verified from a phone in under a minute.
//
// Audience is a clear four-way choice (me / studio / all clients / one client)
// rather than a long dropdown; the single-client mode is searchable so a big
// roster is easy to find. The link a push opens defaults to /portal — which
// always lands each recipient on THEIR OWN portal — so the studio never has to
// think about slugs.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Seg } from "@/components/ui/glass";
import { sendPushAction } from "@/app/admin/notify/actions";
import { subscribeToPush, pushSupported } from "@/lib/pushClient";

type ClientOpt = { id: number; name: string; devices: number };
type Audience = "me" | "admins" | "clients" | "one";

export default function NotifyComposer({
  clients,
  counts,
  configured,
}: {
  clients: ClientOpt[];
  counts: { admins: number; clients: number };
  configured: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Default: open the recipient's own portal. /portal redirects each signed-in
  // client to /portal/<their-slug>, so one slug-free link works for everyone.
  const [url, setUrl] = useState("/portal");
  const [audience, setAudience] = useState<Audience>("me");
  const [clientId, setClientId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [enrolled, setEnrolled] = useState<null | string>(null);

  const inputCls = "lq-input w-full";
  const labelCls = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
    return list;
  }, [clients, query]);
  const selectedClient = clients.find((c) => c.id === clientId) || null;

  // Resolve the four-way picker into the action's target string.
  function resolveTarget(override?: Audience): string | null {
    const a = override || audience;
    if (a === "me") return "me";
    if (a === "admins") return "admins";
    if (a === "clients") return "clients";
    if (a === "one") return clientId != null ? `client:${clientId}` : null;
    return null;
  }

  const enrol = async () => {
    setEnrolled("…");
    const r = await subscribeToPush();
    setEnrolled(
      r === "ok"
        ? "✓ This device is subscribed."
        : r === "denied"
        ? "Notifications are blocked for this site — allow them in the browser settings."
        : r === "unsupported"
        ? "This browser can’t do push. On iPhone: add the site to the Home Screen first (Share → Add to Home Screen), then enable from the installed app."
        : r === "unconfigured"
        ? "Push isn’t configured on the server yet (VAPID keys)."
        : "Couldn’t subscribe — try again."
    );
  };

  const send = async (override?: Audience) => {
    if (busy) return;
    const target = resolveTarget(override);
    if (!target) {
      setNote({ tone: "err", text: "Pick a client to notify." });
      return;
    }
    setBusy(true);
    setNote(null);
    const res = await sendPushAction({
      title: title || "Marker Studio",
      body,
      url,
      target,
    });
    setBusy(false);
    setNote(
      res.ok
        ? { tone: "ok", text: `Sent to ${res.sent}/${res.devices} device${res.devices === 1 ? "" : "s"}${res.failed ? ` · ${res.failed} failed` : ""}.` }
        : { tone: "err", text: res.error || "Couldn’t send." }
    );
  };

  // The label under the "Send" button, so it's always obvious who gets it.
  const audienceLabel =
    audience === "me"
      ? "your devices"
      : audience === "admins"
      ? `the studio · ${counts.admins} device${counts.admins === 1 ? "" : "s"}`
      : audience === "clients"
      ? `all clients · ${counts.clients} device${counts.clients === 1 ? "" : "s"}`
      : selectedClient
      ? `${selectedClient.name} · ${selectedClient.devices} device${selectedClient.devices === 1 ? "" : "s"}`
      : "one client — pick below";

  return (
    <div className="space-y-5 max-w-2xl lq-stagger">
      {!configured && (
        <div className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40" style={{ "--i": 0 } as React.CSSProperties}>
          <b>One-time setup:</b> run <code className="font-mono text-[12px] bg-white/60 rounded px-1">npx web-push generate-vapid-keys</code>{" "}
          and add <code className="font-mono text-[12px]">VAPID_PUBLIC_KEY</code> + <code className="font-mono text-[12px]">VAPID_PRIVATE_KEY</code>{" "}
          (and optionally <code className="font-mono text-[12px]">VAPID_SUBJECT</code>) to the environment, then redeploy.
        </div>
      )}

      {/* this device */}
      <div className="lq-card p-5" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">This device</h2>
        <p className="text-xs text-charcoal-60 mt-1">
          Subscribe the phone/computer you&apos;re holding, then send yourself a test.
          {pushSupported() ? "" : " (This browser doesn’t support push — on iPhone, add the site to the Home Screen first.)"}
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={enrol} className="lq-btn lq-btn--dark">
            🔔 Enable on this device
          </button>
          <button
            type="button"
            onClick={() => send("me")}
            disabled={busy || !configured}
            className="lq-btn lq-btn--glass disabled:opacity-40"
          >
            Send me a test
          </button>
        </div>
        {enrolled && <p className="text-xs text-charcoal-60 mt-2">{enrolled}</p>}
      </div>

      {/* composer */}
      <div className="lq-card p-5 space-y-4" style={{ "--i": 2 } as React.CSSProperties}>
        <div>
          <label className={labelCls}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Your July calendar is ready ✨" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={400} rows={3} placeholder="Open your portal to review and approve this month’s plan." className={inputCls} />
        </div>

        {/* audience — an obvious four-way choice, with a searchable list for one client */}
        <div>
          <label className={labelCls}>Notify</label>
          <Seg<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { value: "me", label: "Me" },
              { value: "admins", label: "Studio" },
              { value: "clients", label: `All clients${counts.clients ? ` · ${counts.clients}` : ""}` },
              { value: "one", label: "One client" },
            ]}
          />
          {audience === "one" && (
            <div className="mt-3">
              <div className="relative">
                <Search aria-hidden size={15} className="absolute inset-y-0 my-auto left-3 text-charcoal-40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search clients…"
                  className={`${inputCls} !pl-9`}
                  autoFocus
                />
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-charcoal/10 divide-y divide-charcoal/5">
                {filtered.length === 0 && (
                  <p className="text-sm text-charcoal-40 px-3 py-3">No clients match “{query}”.</p>
                )}
                {filtered.map((c) => {
                  const on = c.id === clientId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors ${on ? "bg-orange/10" : "hover:bg-charcoal/[0.03]"}`}
                    >
                      <span className={`text-sm truncate ${on ? "font-display font-bold text-ink" : "text-charcoal-80"}`}>
                        {on ? "✓ " : ""}{c.name}
                      </span>
                      <span className="text-[11px] text-charcoal-40 shrink-0">{c.devices} device{c.devices === 1 ? "" : "s"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Opens</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/portal" className={inputCls} />
          <p className="text-[11px] text-charcoal-40 mt-1">Defaults to each recipient’s own portal — no slug needed. Change only for a specific page (must start with /).</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || !configured || !title.trim() || (audience === "one" && clientId == null)}
            className="lq-btn lq-btn--primary disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send notification"}
          </button>
          <span className="text-xs text-charcoal-60">→ {audienceLabel}</span>
          {note && (
            <span className={`text-sm ${note.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{note.text}</span>
          )}
        </div>
        <p className="text-[11px] text-charcoal-40">
          Clients get a subtle “🔔 Get updates” button on their portal — a device only receives pushes after its owner taps it once.
          iPhones need the site added to the Home Screen (Share → Add to Home Screen) before enabling.
        </p>
      </div>
    </div>
  );
}
