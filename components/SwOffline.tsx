"use client";

// Registers the service worker (offline cache + web push live in /sw.js) and
// shows a banner while the connection is down. Mounted once in the root
// layout, so the admin, the portal, and the desktop shell all get it.
import { useEffect, useState } from "react";

export default function SwOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* unsupported webview */ });
    }
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    // Some webviews (and emulated networks) flip navigator.onLine without
    // firing the events — a light poll keeps the banner truthful regardless.
    const poll = setInterval(sync, 3000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      clearInterval(poll);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="ms-offline" role="status">
      <i aria-hidden />
      Offline — viewing your last-synced copy; edits will sync when you&apos;re back
      <span dir="rtl">· بلا إنترنت — تُعرض آخر نسخة محفوظة</span>
    </div>
  );
}
