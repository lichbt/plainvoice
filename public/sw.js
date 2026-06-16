// Plainvoice service worker — hand-rolled (vite-plugin-pwa doesn't yet support Astro 6).
// Strategy: runtime caching of same-origin GET requests so the app works offline after
// the first visit. The data itself is local-first (IndexedDB) and never touches the SW.
const CACHE = "plainvoice-v13";
// NOTE: Cloudflare Pages serves these routes with a trailing slash (/new 308→
// /new/). Precaching the slash form avoids caching a redirect (which fails) and
// avoids a redirect hop on launch.
const APP_SHELL = ["/", "/new/", "/app/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin (fonts CDN, etc.)

  // Navigations: cache-first (stale-while-revalidate) so an installed PWA opens
  // INSTANTLY from the cached app shell, then refreshes it in the background for
  // next launch. Falls back to the network (then the /new shell) when there's no
  // cached copy. Page data lives in IndexedDB, so a one-launch-stale shell is safe.
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => { cachePut(req, res.clone()); return res; })
          .catch(() => cached || caches.match("/new/"));
        return cached || network;
      }),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => { cachePut(req, res.clone()); return res; }).catch(() => cached);
      return cached || network;
    }),
  );
});

function cachePut(req, res) {
  if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res));
}
