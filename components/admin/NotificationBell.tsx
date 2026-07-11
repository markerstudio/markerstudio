"use client";

// The admin notification center. Polls /api/notifications (every minute + on
// focus), keeps per-user "seen" state in localStorage, and relays fresh items
// as system alerts: native notifications + a Dock badge in the desktop app
// (via the __MARKER_NATIVE__ bridge), or Web Notifications in a browser.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToPush } from "@/lib/pushClient";

type Notice = { id: string; kind: string; title: string; body?: string; href: string; at: string };

const ICONS: Record<string, string> = {
  inquiry: "✉️",
  application: "👋",
  "task-request": "🙋",
  "task-due": "⏰",
  "invoice-overdue": "💸",
  shoot: "📸",
};

type NativeBridge = {
  notify?: (title: string, body?: string) => Promise<void>;
  setBadge?: (count: number) => Promise<void>;
};
function native(): NativeBridge | undefined {
  return (window as { __MARKER_NATIVE__?: NativeBridge }).__MARKER_NATIVE__;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationBell({
  userKey,
  placement = "top",
}: {
  userKey: string;
  /** "rail" — trigger lives in the desktop glass rail (panel opens beside it);
      "top" — floating trigger near the top edge (panel drops below). */
  placement?: "rail" | "top";
}) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const alerted = useRef<Set<string>>(new Set());
  const loaded = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const SEEN_KEY = `marker:notif:seen:${userKey}`;
  const PREF_KEY = `marker:notif:alerts:${userKey}`;

  // hydrate seen-state + alert preference
  useEffect(() => {
    try {
      seen.current = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
      setAlertsOn(localStorage.getItem(PREF_KEY) === "1" || !!native());
    } catch { /* fresh profile */ }
  }, [SEEN_KEY, PREF_KEY]);

  const persistSeen = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen.current).slice(-500)));
    } catch { /* full/blocked storage — unread state just resets */ }
  }, [SEEN_KEY]);

  const fireAlerts = useCallback(
    (fresh: Notice[]) => {
      if (!fresh.length) return;
      const n = native();
      for (const item of fresh.slice(0, 4)) {
        if (alerted.current.has(item.id)) continue;
        alerted.current.add(item.id);
        if (n?.notify) {
          n.notify(item.title, item.body).catch(() => undefined);
        } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            const notif = new Notification(`Marker — ${item.title}`, { body: item.body, tag: item.id, icon: "/assets/logo-favicon.png" });
            // Tapping the toast should land on the item it's about — the exact
            // task, inquiry, invoice… — not wherever the app happens to be.
            notif.onclick = () => {
              window.focus();
              router.push(item.href);
              notif.close();
            };
          } catch { /* platform quirk — the bell badge still shows it */ }
        }
      }
    },
    [router]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notices: Notice[] };
      const list = data.notices || [];
      setNotices(list);
      const unread = list.filter((x) => !seen.current.has(x.id));
      // Skip alerting on the very first load (everything would be "new").
      if (loaded.current && alertsOn) fireAlerts(unread.filter((x) => !alerted.current.has(x.id)));
      if (!loaded.current) for (const x of unread) alerted.current.add(x.id);
      loaded.current = true;
      native()?.setBadge?.(unread.length).catch(() => undefined);
      if (unread.length) {
        setRing(true);
        setTimeout(() => setRing(false), 800);
      }
    } catch { /* offline — next poll will catch up */ }
  }, [alertsOn, fireAlerts]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const unread = notices.filter((x) => !seen.current.has(x.id));

  const markAllRead = () => {
    for (const x of notices) seen.current.add(x.id);
    persistSeen();
    setNotices((n) => [...n]); // re-render
    native()?.setBadge?.(0).catch(() => undefined);
  };

  const openItem = (item: Notice) => {
    seen.current.add(item.id);
    persistSeen();
    setOpen(false);
    native()?.setBadge?.(notices.filter((x) => !seen.current.has(x.id)).length).catch(() => undefined);
    router.push(item.href);
  };

  const enableAlerts = async () => {
    if (native()) {
      setAlertsOn(true);
      try { localStorage.setItem(PREF_KEY, "1"); } catch { /* ignore */ }
      return;
    }
    // Real Web Push first (works on phones with the site closed); falls back
    // to tab-local notifications when push isn't available/configured.
    const pushed = await subscribeToPush();
    if (pushed === "ok") {
      setAlertsOn(true);
      try { localStorage.setItem(PREF_KEY, "1"); } catch { /* ignore */ }
      return;
    }
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setAlertsOn(true);
      try { localStorage.setItem(PREF_KEY, "1"); } catch { /* ignore */ }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread.length ? `Notifications — ${unread.length} unread` : "Notifications"}
        className={`lq-press relative w-8 h-8 rounded-full flex items-center justify-center text-charcoal-60 hover:text-ink hover:bg-charcoal/5 ${ring ? "ms-bell-ring" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span className="ms-badge absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange text-white text-[9px] font-bold leading-4 text-center">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`ms-pop lq-chrome z-[80] max-h-[70vh] overflow-hidden flex flex-col rounded-3xl fixed inset-x-3 top-[4.2rem] sm:inset-x-auto sm:w-[340px] ${
            placement === "rail"
              ? "sm:absolute sm:bottom-0 sm:top-auto sm:start-full sm:ms-3"
              : "sm:absolute sm:end-0 sm:top-full sm:mt-2"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
            <span className="text-sm font-bold tracking-tight">Notifications</span>
            <div className="flex items-center gap-3">
              {!alertsOn && (
                <button type="button" onClick={enableAlerts} className="text-[11px] font-semibold text-neutral-400 hover:text-orange" title="Also alert me on this device">
                  Enable alerts
                </button>
              )}
              {unread.length > 0 && (
                <button type="button" onClick={markAllRead} className="text-[11px] font-semibold text-neutral-500 hover:text-orange">
                  Mark all read
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto">
            {notices.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-2xl mb-1.5">🔕</div>
                <p className="text-sm text-neutral-400">Quiet for now — you’re all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-50">
                {notices.map((item) => {
                  const isUnread = !seen.current.has(item.id);
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => openItem(item)} className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 ${isUnread ? "" : "opacity-55"}`}>
                        <span aria-hidden className="text-base leading-6 shrink-0">{ICONS[item.kind] || "•"}</span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-[13px] leading-snug ${isUnread ? "font-semibold text-neutral-900" : "text-neutral-600"}`}>{item.title}</span>
                          {item.body && <span className="block text-[11px] text-neutral-400 truncate mt-0.5">{item.body}</span>}
                        </span>
                        <span className="shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[10px] text-neutral-300 tabular-nums">{timeAgo(item.at)}</span>
                          {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-orange" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
