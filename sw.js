// DYAS Poker: aplicație instalabilă + notificări. API-ul nu trece niciodată prin cache.
const CACHE = "dyas-v3";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/logo.svg", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// întâi rețeaua (ca să vezi mereu ultima versiune), cache-ul doar fără internet
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && SHELL.includes(u.pathname)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match("/index.html"))));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: "DYAS Poker", body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "DYAS Poker", {
    body: d.body || "", icon: "/icon-192.png", badge: "/badge-96.png", tag: d.tag, renotify: true, data: { url: d.url || "/" }, vibrate: [120, 60, 120],
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin);
    if (c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
