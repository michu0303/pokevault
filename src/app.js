// Application bootstrap: load persisted state, open the catalog, wire sync.
// UI code subscribes to the store; this module owns the lifecycle only.
import { CATALOG_URL, CAT } from "./constants.js";
import { loadAll, idbGetAll, idbReplaceCatalog } from "./storage.js";
import { createStore } from "./store.js";
import { indexCatalog } from "./catalog.js";
import { crawlCatalog, loadStaticCatalog, fetchSetDates, fetchSetPricing } from "./api.js";
import { applySetPricing } from "./pricing.js";
import { snapshot } from "./history.js";
import { createSyncClient, syncConfigured, pickVault, applyVault } from "./sync.js";

export function createApp({ ls = globalThis.localStorage, idb = globalThis.indexedDB, fetch: fetchImpl = globalThis.fetch, catalogUrl = CATALOG_URL } = {}) {
  const persisted = loadAll(ls);
  const store = createStore({
    ...persisted,
    catalog: [], byId: new Map(), bySet: new Map(), priceCache: {},
    building: false, build: { done: 0, total: 0, products: 0, failed: 0, source: "" },
    syncStatus: "", syncError: "", syncedAt: 0,
    ui: { search: { term: "", sort: "best", type: "all", lang: "all", rarity: [], set: [] }, col: { sort: "val-hi", lang: "all", rarity: [], set: [], shown: 30 }, wl: { sort: "val-hi", lang: "all", rarity: [], set: [] } },
  }, { ls, onDirty: () => schedulePush() });
  const { state } = store;

  function adoptCatalog(products, setDates, meta) {
    state.catalog = products;
    Object.assign(state, indexCatalog(products));
    if (setDates && Object.keys(setDates).length) { state.setDates = { ...state.setDates, ...setDates }; store.update(() => {}, "setDates"); }
    if (meta) { state.catalogMeta = meta; store.update(() => {}, "catalogMeta"); }
    store.touch("catalog");
  }

  /** open the locally stored catalog (fast path on every launch) */
  async function openCatalog() {
    if (!state.catalogMeta) return false;
    try {
      const items = await idbGetAll(idb);
      if (items && items.length) { adoptCatalog(items, null, null); return true; }
    } catch (e) {}
    state.catalogMeta = null; store.update(() => {}, "catalogMeta");
    return false;
  }

  /** download the pre-built catalog; fall back to crawling the API */
  async function buildCatalog({ force = false } = {}) {
    if (state.building) return;
    state.building = true; state.build = { done: 0, total: 0, products: 0, failed: 0, source: "static" }; store.touch("build");
    let products, setDates, builtAt, source = "static";
    try {
      const doc = await loadStaticCatalog(catalogUrl, fetchImpl);
      products = doc.products; setDates = doc.setDates; builtAt = doc.builtAt;
    } catch (e) {
      source = "api"; state.build.source = "api"; store.touch("build");
      const r = await crawlCatalog({ fetch: fetchImpl, onProgress: (p) => { state.build = { ...p, source: "api" }; store.touch("build"); } })
        .catch((err) => { state.building = false; store.touch("build"); throw err; });
      products = r.products; setDates = r.setDates; builtAt = new Date().toISOString();
    }
    try { await idbReplaceCatalog(products, idb); }
    catch (e) { state.building = false; store.touch("build"); throw new Error("Couldn’t save the catalog to storage."); }
    adoptCatalog(products, setDates, { count: products.length, builtAt, source });
    state.building = false; store.touch("build");
    return products.length;
  }

  /** ensure prices for one set are loaded (cached per session) */
  async function loadSetPricing(sid, force = false) {
    sid = String(sid);
    if (!force && state.priceCache[sid]) return state.priceCache[sid];
    const g = state.bySet.get(sid);
    const prices = await fetchSetPricing((g && g.cat) || CAT, sid, fetchImpl);
    state.priceCache[sid] = prices;
    store.update((s) => { applySetPricing(s.flatPrices, prices, g); s.pricesAt = Date.now(); }, "flatPrices");
    return prices;
  }
  /** refresh prices for every set that has an owned or wishlisted card */
  async function refreshValues(onProgress) {
    const ids = new Set();
    for (const pid of [...Object.keys(state.owned), ...Object.keys(state.wishlist)]) { const e = state.byId.get(pid); if (e) ids.add(String(e.sid)); }
    let done = 0, failed = 0;
    for (const sid of ids) {
      try { await loadSetPricing(sid, true); } catch (e) { failed++; }
      done++; if (onProgress) onProgress({ done, total: ids.size, failed });
      await new Promise((r) => setTimeout(r, 80));
    }
    logSnapshot();
    return { done, failed };
  }
  function logSnapshot() { store.update((s) => { s.history = snapshot(s.history, s.owned, s.flatPrices, undefined, s.wishlist); }, "history"); }

  /* ---------- sync ---------- */
  let pushTimer = null;
  const client = () => createSyncClient(state.sync, fetchImpl);
  function setSync(status, error = "") { state.syncStatus = status; state.syncError = error; if (status === "ok") state.syncedAt = Date.now(); store.touch("sync"); }
  function schedulePush() {
    if (!syncConfigured(state.sync)) return;
    clearTimeout(pushTimer); setSync("pending");
    pushTimer = setTimeout(pushNow, 1600);
  }
  async function pushNow() {
    if (!syncConfigured(state.sync)) return;
    setSync("syncing");
    try { await client().push(pickVault(state)); store.clearDirty(); setSync("ok"); }
    catch (e) { setSync("error", e.message || "sync failed"); }
  }
  function adoptVault(blob) {
    store.update((s) => applyVault(blob, s), "owned", "wishlist", "tracked", "favorites", "wishFolders");
    store.clearDirty(); setSync("ok");
  }
  /** on launch: dirty → push local; else pull and adopt remote */
  async function initSync() {
    if (!syncConfigured(state.sync)) return;
    setSync("syncing");
    try {
      if (state.dirty) { await client().push(pickVault(state)); store.clearDirty(); }
      else { const blob = await client().pull(); if (blob) adoptVault(blob); else await client().push(pickVault(state)); }
      setSync("ok");
    } catch (e) { setSync("error", e.message || "sync failed"); }
  }
  /** connect: returns { remote: blob|null } so the UI can ask which side wins */
  async function connectSync(cfg) {
    state.sync = { url: cfg.url, key: cfg.key, pass: cfg.pass }; store.update(() => {}, "sync");
    setSync("syncing");
    try { const blob = await client().pull(); return { remote: blob }; }
    catch (e) { setSync("error", e.message || "sync failed"); throw e; }
  }
  async function finishConnect(useRemote, blob) {
    try {
      if (useRemote && blob) adoptVault(blob); else { await client().push(pickVault(state)); store.clearDirty(); }
      setSync("ok");
    } catch (e) { setSync("error", e.message || "sync failed"); throw e; }
  }
  function disconnectSync() { state.sync = { url: "", key: "", pass: "" }; store.update(() => {}, "sync"); setSync(""); }

  /** cards worth having offline: owned + wishlisted + every card of tracked sets */
  function offlineImageUrls() {
    const urls = new Set();
    const add = (c) => { if (c && c.g) urls.add(c.g); };
    for (const pid of [...Object.keys(state.owned), ...Object.keys(state.wishlist)]) add(state.byId.get(pid));
    for (const sid of Object.keys(state.tracked)) { const g = state.bySet.get(String(sid)); if (g) for (const c of g.cards) add(c); }
    return [...urls];
  }
  /** fetch each image once through the service worker so it lands in the image cache */
  async function warmImages(onProgress, concurrency = 6) {
    const urls = offlineImageUrls(); let i = 0, done = 0, failed = 0;
    async function worker() { while (i < urls.length) { const u = urls[i++]; try { await fetchImpl(u, { mode: "no-cors" }); } catch (e) { failed++; } done++; if (onProgress) onProgress({ done, total: urls.length, failed }); } }
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
    return { done, failed, total: urls.length };
  }

  async function boot() {
    const had = await openCatalog();
    if (had && !Object.keys(state.setDates).length) fetchSetDates(fetchImpl).then((m) => { if (Object.keys(m).length) store.update((s) => { s.setDates = { ...s.setDates, ...m }; }, "setDates"); }).catch(() => {});
    logSnapshot();
    initSync();
    return had;
  }

  return { store, state, boot, openCatalog, buildCatalog, loadSetPricing, refreshValues, logSnapshot, initSync, pushNow, connectSync, finishConnect, disconnectSync, offlineImageUrls, warmImages };
}
