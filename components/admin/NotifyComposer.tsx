"use client";

// The Notify panel's composer — write a push, pick the audience (with live
// device counts), send. Includes one-tap enrolment for THIS device and a test
// send, so the whole loop can be verified from a phone in under a minute.
import { useState } from "react";
import { sendPushAction } from "@/app/admin/notify/actions";
import { subscribeToPush, pushSupported } from "@/lib/pushClient";

type ClientOpt = { id: number; name: string; devices: number };

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
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("me");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [enrolled, setEnrolled] = useState<null | string>(null);

  const inputCls =
    "w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange";

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

  const send = async (t?: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const res = await sendPushAction({
      title: title || "Marker Studio",
      body,
      url,
      target: t || target,
    });
    setBusy(false);
    setNote(
      res.ok
        ? { tone: "ok", text: `Sent to ${res.sent}/${res.devices} device${res.devices === 1 ? "" : "s"}${res.failed ? ` · ${res.failed} failed` : ""}.` }
        : { tone: "err", text: res.error || "Couldn’t send." }
    );
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {!configured && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <b>One-time setup:</b> run <code className="font-mono text-[12px] bg-white/60 rounded px-1">npx web-push generate-vapid-keys</code>{" "}
          and add <code className="font-mono text-[12px]">VAPID_PUBLIC_KEY</code> + <code className="font-mono text-[12px]">VAPID_PRIVATE_KEY</code>{" "}
          (and optionally <code className="font-mono text-[12px]">VAPID_SUBJECT</code>) to the environment, then redeploy.
        </div>
      )}

      {/* this device */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5">
        <h2 className="font-bold tracking-tight text-sm">This device</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Subscribe the phone/computer you&apos;re holding, then send yourself a test.
          {pushSupported() ? "" : " (This browser doesn’t support push — on iPhone, add the site to the Home Screen first.)"}
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={enrol} className="rounded-full bg-charcoal text-white text-sm font-semibold px-4 py-2 hover:bg-black transition-colors">
            🔔 Enable on this device
          </button>
          <button
            type="button"
            onClick={() => send("me")}
            disabled={busy || !configured}
            className="rounded-full border border-neutral-300 text-sm font-semibold px-4 py-2 text-neutral-700 hover:border-orange hover:text-orange-deep transition-colors disabled:opacity-40"
          >
            Send me a test
          </button>
        </div>
        {enrolled && <p className="text-xs text-neutral-500 mt-2">{enrolled}</p>}
      </div>

      {/* composer */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Your July calendar is ready ✨" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={400} rows={3} placeholder="Open your portal to review and approve this month’s plan." className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Opens (optional)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/portal" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">To</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              <option value="me">Me — test on my devices</option>
              <option value="admins">The studio (all admins) · {counts.admins} device{counts.admins === 1 ? "" : "s"}</option>
              <option value="clients">All clients · {counts.clients} device{counts.clients === 1 ? "" : "s"}</option>
              {clients.map((c) => (
                <option key={c.id} value={`client:${c.id}`}>
                  {c.name} · {c.devices} device{c.devices === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || !configured || !title.trim()}
            className="rounded-full bg-orange text-white text-sm font-semibold px-6 py-2.5 hover:bg-orange-deep transition-colors disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send notification"}
          </button>
          {note && (
            <span className={`text-sm ${note.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>{note.text}</span>
          )}
        </div>
        <p className="text-[11px] text-neutral-400">
          Clients get a subtle “🔔 Get updates” button on their portal — a device only receives pushes after its owner taps it once.
          iPhones need the site added to the Home Screen (Share → Add to Home Screen) before enabling.
        </p>
      </div>
    </div>
  );
}
