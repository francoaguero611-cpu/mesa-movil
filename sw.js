/* Service worker — Dashboard Lorenzo */
const VERSION = "dash-v10";
const SHELL = ["./", "index.html", "styles.css?v=10", "app.js?v=10", "demo.js?v=10", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const API_HOST = "tppcpnfzcxxusdhrlmdx.supabase.co";
const API_CACHE = "dash-api";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== API_CACHE && k !== "dash-fonts").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // nunca tocar escrituras
  const url = new URL(req.url);

  // API: red primero; si falla, la última respuesta guardada (solo lecturas).
  if (url.host === API_HOST) {
    const accion = url.searchParams.get("accion");
    if (!["dash", "dash_detalle"].includes(accion) || url.searchParams.has("dry")) return;
    const clave = new URL(url); clave.searchParams.delete("forzar");
    e.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const r = await fetch(req);
        if (r.ok) cache.put(clave.href, r.clone());
        return r;
      } catch (err) {
        const viejo = await cache.match(clave.href);
        if (!viejo) throw err;
        const h = new Headers(viejo.headers); h.set("x-sw-cache", "1"); h.set("x-sw-fecha", viejo.headers.get("date") || "");
        return new Response(await viejo.blob(), { status: 200, headers: h });
      }
    })());
    return;
  }

  // Fuentes de Google: lo guardado primero, actualizar en segundo plano.
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    e.respondWith(caches.open("dash-fonts").then(async (c) => {
      const hit = await c.match(req);
      const red = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || red;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegación: red primero (para que los deploys lleguen), shell guardado si no hay red.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put("index.html", c)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  // Shell: caché primero.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then((x) => x.put(req, c)); }
    return r;
  })));
});

// ---------- avisos push ----------
// payload: {title, body, tag, url, ev}. ev = qué hizo la regla (ver app.js, mostrarEvento).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Dashboard", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Dashboard", {
    body: d.body || "", tag: d.tag || undefined, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: d.url || "./", ev: d.ev || null },
  }));
});

// Al tocar el aviso: si la app está abierta, le paso el evento por mensaje; si no contesta, la navego; si no hay, la abro.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const destino = new URL(d.url || "./", self.registration.scope);
  destino.hash = d.ev ? "ev=" + encodeURIComponent(JSON.stringify(d.ev)) : "";
  const url = destino.href;
  const avisar = (c) => new Promise((ok) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => ok(false), 1500);
    ch.port1.onmessage = () => { clearTimeout(t); ok(true); };
    try { c.postMessage({ tipo: "ev", ev: d.ev }, [ch.port2]); } catch { clearTimeout(t); ok(false); }
  });
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const c = cs.find((x) => x.url.startsWith(self.registration.scope)) || null;
    if (c) {
      try { await c.focus(); } catch {}
      if (!d.ev || await avisar(c)) return;
      try { const n = await c.navigate(url); if (n) return; } catch {}
    }
    return self.clients.openWindow(url);
  })());
});
