// Five Dice service worker: keeps the app working offline.
// Bump VERSION whenever app files change so phones pick up the new copy.
const VERSION = "five-dice-v2";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "scoring.js",
  "profiles.js",
  "match.js",
  "game.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

// Save every app file when the service worker is installed.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// Drop copies saved by older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve the saved copy right away (works offline), and refresh it in the
// background when online so the next launch gets any update.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const key = req.mode === "navigate" ? "index.html" : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => null);
      if (cached) { event.waitUntil(fresh); return cached; }
      return (await fresh) || new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
