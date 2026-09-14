// PokéVault service worker.
//  - app shell: precached on install, served cache-first; bump VERSION on every
//    deploy so browsers pick up the new files (tests/sw.test.js checks the list)
//  - card images (cdn.tcgtracking.com): stale-while-revalidate, so anything
//    you've viewed loads offline and "Download images" can pre-warm a set
//  - API calls: network only (prices must be fresh; the catalog lives in IndexedDB)
const VERSION = "2026-09-14.5";
const SHELL = "pv-shell-" + VERSION, IMAGES = "pv-images-v1", FONTS = "pv-fonts-v1";
const SHELL_FILES = [
  "./app.html", "./manifest.webmanifest", "./styles/tokens.css", "./styles/app.css",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png",
  "./src/main.js", "./src/app.js", "./src/api.js", "./src/pricehist.js", "./src/catalog.js", "./src/collection.js", "./src/constants.js", "./src/crypto.js",
  "./src/history.js", "./src/pricing.js", "./src/search.js", "./src/storage.js", "./src/store.js", "./src/sync.js", "./src/util.js",
  "./src/ui/chart.js", "./src/ui/dialog.js", "./src/dev/demo.js", "./src/ui/dom.js", "./src/ui/filters.js", "./src/ui/icons.js", "./src/ui/index.js", "./src/ui/router.js", "./src/ui/sheet.js", "./src/ui/shell.js",
  "./src/ui/screens/cardSheet.js", "./src/ui/screens/collection.js", "./src/ui/screens/home.js", "./src/ui/screens/search.js",
  "./src/ui/screens/setDetail.js", "./src/ui/screens/sets.js", "./src/ui/screens/settings.js", "./src/ui/screens/wishlist.js",
];
const IMAGE_CAP = 6000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("pv-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: "window" });
    for (const c of cs) c.postMessage({ type: "activated", version: VERSION });
  })());
});
self.addEventListener("message", (e) => { if (e.data && e.data.type === "skipWaiting") self.skipWaiting(); });

const isShell = (url) => url.origin === self.location.origin;
const isImage = (url) => /cdn\.tcgtracking\.com$/.test(url.hostname) || /tcgplayer-cdn/.test(url.hostname);
const isFont = (url) => /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
const isApi = (url) => /tcgtracking\.com$/.test(url.hostname) && url.pathname.startsWith("/tcgapi/");
const isHist = (url) => /\/hist\/\d+\.json\.gz$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return;                                    // always live
  if (isHist(url)) { e.respondWith(networkFirst("pv-hist-v1", req)); return; }
  if (isImage(url)) { e.respondWith(staleWhileRevalidate(IMAGES, req, true)); return; }
  if (isFont(url)) { e.respondWith(staleWhileRevalidate(FONTS, req)); return; }
  if (isShell(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
      catch (err) { if (req.mode === "navigate") return (await cache.match("./app.html")) || Response.error(); throw err; }
    })());
  }
});
async function networkFirst(name, req) {
  const cache = await caches.open(name);
  try { const res = await fetch(req); if (res.ok) await cache.put(req, res.clone()); return res; }
  catch (e) { return (await cache.match(req)) || Response.error(); }
}
async function staleWhileRevalidate(name, req, opaqueOk = false) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const net = fetch(req).then(async (res) => { if (res && (res.ok || (opaqueOk && res.type === "opaque"))) { await cache.put(req, res.clone()); trim(cache); } return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
let trimming = false;
async function trim(cache) {
  if (trimming) return; trimming = true;
  try { const keys = await cache.keys(); if (keys.length > IMAGE_CAP) for (const k of keys.slice(0, keys.length - IMAGE_CAP)) await cache.delete(k); }
  finally { trimming = false; }
}
