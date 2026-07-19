/* Service worker — bump VERSION on every deploy so visitors get the new files */
const VERSION = "v1.0.1";
const CACHE = `dinghy-lab-${VERSION}`;
const CORE = [
  "./",
  "./index.html",
  "./simulator.html",
  "./game.html",
  "./about.html",
  "./privacy.html",
  "./terms.html",
  "./404.html",
  "./sim.css",
  "./game.css",
  "./hub.css",
  "./i18n.js",
  "./site-config.js",
  "./ads.js",
  "./pwa.js",
  "./simulator-i18n.js",
  "./simulator.js",
  "./game-i18n.js",
  "./game.js",
  "./manifest.webmanifest",
  "./assets/hero-dinghy.png",
  "./assets/logo.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // ads/analytics pass through
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match("./index.html"))
    )
  );
});
