/* おぼえがき Service Worker — オフライン起動＋プッシュ通知 */
const CACHE = "oboegaki-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ネット優先・失敗時はキャッシュ */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 外部（Supabase等）は素通し
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});

/* プッシュ通知の受信 → ロック画面に表示 */
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { title: "おぼえがき", body: e.data ? e.data.text() : "" }; }
  const title = data.title || "おぼえがき";
  const options = {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "./index.html" }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

/* 通知タップ → アプリを開く */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
