// Five Dice service worker: keeps the app working offline and delivers updates.
//
// RELEASES: bump VERSION whenever any app file changes. Phones only pick up new
// files when this file changes; the new version downloads in the background and
// the app shows an "Update ready" button to switch to it.
const VERSION = "five-dice-v4";
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

// Save a complete copy of this version. "reload" skips the browser's HTTP cache,
// so a version saved right after a release isn't mixed with older files.
// Versions before v4 had no "Update ready" button, so their pages can't ask to switch.
const LEGACY = ["five-dice-v1", "five-dice-v2", "five-dice-v3"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" })));
    // On first install there's nothing to replace, so the browser activates it right away.
    // Replacing a pre-button version: take over now (as those versions always did).
    // Otherwise wait until the app asks, via the "Update ready" button.
    const keys = await caches.keys();
    if (keys.some((k) => LEGACY.includes(k))) await self.skipWaiting();
  })());
});

// The app sends this when the player taps "Update ready".
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Drop copies saved by older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve this version's saved files (works offline); fall back to the network
// for anything not saved.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); }
    catch { return new Response("Offline", { status: 503, statusText: "Offline" }); }
  })());
});
