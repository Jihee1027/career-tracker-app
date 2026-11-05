const TRACKER = "https://claude.ai/artifact/Hj2o6snf5KzLEMLBAbJSY8";
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("tracker", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("alerts")) d.createObjectStore("alerts", { keyPath: "id", autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function put(store, val, key) {
  const d = await openDb();
  return new Promise((res, rej) => {
    const t = d.transaction(store, "readwrite");
    if (key === undefined) t.objectStore(store).put(val); else t.objectStore(store).put(val, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function trimAlerts(max) {
  const d = await openDb();
  return new Promise((res) => {
    const t = d.transaction("alerts", "readwrite"), s = t.objectStore("alerts");
    const rq = s.getAllKeys();
    rq.onsuccess = () => { const keys = rq.result || []; keys.slice(0, Math.max(0, keys.length - max)).forEach(k => s.delete(k)); };
    t.oncomplete = () => res();
    t.onerror = () => res();
  });
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.mode === "navigate" || (req.method === "GET" && new URL(req.url).pathname.endsWith("/index.html"))) {
    e.respondWith(fetch(req, { cache: "no-store" }).catch(() => fetch(req)));
  }
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const title = d.title || "Career Tracker", body = d.body || "";
    try {
      if (d.type === "key" && d.key) await put("kv", d.key, "snapKey");
      await put("alerts", { title, body, at: new Date().toISOString() });
      await trimAlerts(100);
    } catch (_) {}
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    cs.forEach(c => c.postMessage({ type: "alert" }));
    await self.registration.showNotification(title, {
      body, icon: "icon-192.png", badge: "icon-192.png",
      tag: d.tag || ("t" + Date.now()), data: { url: "./#alerts" }
    });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) { if ("focus" in c) { c.postMessage({ type: "open", tab: "alerts" }); return c.focus(); } }
    return self.clients.openWindow("./#alerts");
  })());
});
