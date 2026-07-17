/* Marker Studio service worker — Web Push + offline resilience.

   Offline model (platform plan, phase 2):
   - Static assets (hashed /_next/static, /assets, /icons, fonts, images):
     cache-first — they're immutable or near-immutable.
   - Documents and RSC payloads: network-first; every good response is copied
     into the cache, so the LAST-LOADED version of every page you've visited
     still opens with no internet ("viewing your last-synced copy"). A page
     never visited falls back to a small branded offline screen.
   - Everything else (POSTs, server actions, APIs): network only — the in-app
     draft queue (useSectionAutosave) already journals edits offline and
     flushes them on reconnect.

   Push handlers are unchanged. */

const V = "ms-v2";
const STATIC_CACHE = `${V}-static`;
const PAGES_CACHE = `${V}-pages`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  )
);

/* ---------------- offline caching ---------------- */

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Offline — Marker Studio</title>
<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#F5F2EC;color:#303030;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}
.dot{width:14px;height:14px;border-radius:50%;background:#FF9100;margin:0 auto 16px;animation:p 1.1s ease-in-out infinite}
@keyframes p{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
h1{font-size:20px;margin:0 0 6px}p{font-size:14px;opacity:.7;margin:0}
button{margin-top:18px;border:0;border-radius:999px;background:#FF9100;color:#fff;font-weight:700;padding:10px 22px;font-size:14px;cursor:pointer}</style>
</head><body><div><div class="dot"></div><h1>You're offline</h1>
<p>This page hasn't been opened on this device yet, so there's no saved copy.<br/>Pages you've visited before still open offline.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/_next/image") ||
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(png|jpe?g|webp|avif|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname);

// RSC fetches share the page URL — key them separately so a client-side
// navigation never receives cached HTML (or a full load a flight payload).
const pageKey = (request, isRsc) => {
  const u = new URL(request.url);
  u.searchParams.delete("_rsc");
  if (isRsc) u.searchParams.set("__sw", "rsc");
  return u.toString();
};

async function networkFirstPage(request, isRsc) {
  const cache = await caches.open(PAGES_CACHE);
  const key = pageKey(request, isRsc);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    if (!isRsc) return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    throw err;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // actions & APIs stay network-only
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStatic(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (request.mode === "navigate" || isRsc) {
    event.respondWith(networkFirstPage(request, isRsc));
  }
});

/* ---------------- Web Push (unchanged) ---------------- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Marker Studio";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "auto",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
