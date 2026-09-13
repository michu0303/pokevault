// Persistence: localStorage (collection, prefs, prices, history) + IndexedDB
// (catalog). Keys are the ones the original single-file app used, so existing
// devices keep their data. `ls` is injectable for tests.
import { LS, IDB_NAME, IDB_STORE } from "./constants.js";
import { normFolders } from "./collection.js";

const DEFAULT_PREFS = { binder: true, cols: 4, setSort: "az", colRarity: "", colPerPage: 30, theme: "system", recent: [] };

export function readJSON(ls, k) { try { return JSON.parse(ls.getItem(k)); } catch (e) { return null; } }
export function writeJSON(ls, k, v) { try { ls.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

export function normalizePrefs(pf) {
  const p = { ...DEFAULT_PREFS };
  if (pf && typeof pf === "object") {
    p.binder = pf.binder !== false;
    p.cols = pf.cols === 3 ? 3 : 4;
    p.setSort = ["az", "new", "old"].includes(pf.setSort) ? pf.setSort : "az";
    p.colRarity = typeof pf.colRarity === "string" ? pf.colRarity : "";
    p.colPerPage = [10, 20, 30, 50, 100].includes(pf.colPerPage) ? pf.colPerPage : 30;
    p.theme = ["light", "dark", "system"].includes(pf.theme) ? pf.theme : "system";
    p.recent = Array.isArray(pf.recent) ? pf.recent.filter((x) => typeof x === "string").slice(0, 8) : [];
  }
  return p;
}

/** Load everything the app persists. Also migrates a v2 `pv2_collection` array once. */
export function loadAll(ls = globalThis.localStorage) {
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
  const out = {
    owned: obj(readJSON(ls, LS.OWNED)), wishlist: obj(readJSON(ls, LS.WISH)),
    wishFolders: normFolders(readJSON(ls, LS.WFOLDERS)),
    tracked: obj(readJSON(ls, LS.TRACKED)), favorites: obj(readJSON(ls, LS.FAV)),
    flatPrices: obj(readJSON(ls, LS.PRICES)), setDates: obj(readJSON(ls, LS.SETDATES)),
    history: (() => { const h = readJSON(ls, LS.HISTORY); return Array.isArray(h) ? h : []; })(),
    catalogMeta: readJSON(ls, LS.META) || null,
    prefs: normalizePrefs(readJSON(ls, LS.PREFS)),
    sync: (() => { const s = readJSON(ls, LS.SYNC); return s && typeof s === "object" ? { url: s.url || "", key: s.key || "", pass: s.pass || "" } : { url: "", key: "", pass: "" }; })(),
    dirty: ls.getItem(LS.DIRTY) === "1",
    pricesAt: +(ls.getItem(LS.PRICES_AT) || 0) || 0,
    migrated: false,
  };
  if (!Object.keys(out.owned).length) {
    const old = readJSON(ls, LS.LEGACY_COLLECTION);
    if (Array.isArray(old) && old.length) {
      for (const it of old) {
        if (!it || it.productId == null) continue;
        const pid = String(it.productId), v = it.variant || "Default", q = Math.max(1, it.qty | 0 || 1);
        out.owned[pid] = out.owned[pid] || {}; out.owned[pid][v] = (out.owned[pid][v] || 0) + q;
        if (it.marketPrice != null) { out.flatPrices[pid] = out.flatPrices[pid] || {}; if (out.flatPrices[pid][v] == null) out.flatPrices[pid][v] = it.marketPrice; }
      }
      out.migrated = true;
      writeJSON(ls, LS.OWNED, out.owned); writeJSON(ls, LS.PRICES, out.flatPrices);
    }
  }
  return out;
}

export const save = {
  owned: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.OWNED, v),
  wishlist: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.WISH, v),
  wishFolders: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.WFOLDERS, v),
  tracked: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.TRACKED, v),
  favorites: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.FAV, v),
  prices: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.PRICES, v),
  setDates: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.SETDATES, v),
  prefs: (v, ls = globalThis.localStorage) => writeJSON(ls, LS.PREFS, v),
  catalogMeta: (v, ls = globalThis.localStorage) => v ? writeJSON(ls, LS.META, v) : (ls.removeItem(LS.META), true),
  pricesAt: (v, ls = globalThis.localStorage) => { try { ls.setItem(LS.PRICES_AT, String(v)); } catch (e) {} },
  sync: (v, ls = globalThis.localStorage) => v && v.url ? writeJSON(ls, LS.SYNC, v) : (ls.removeItem(LS.SYNC), true),
  dirty: (on, ls = globalThis.localStorage) => { try { on ? ls.setItem(LS.DIRTY, "1") : ls.removeItem(LS.DIRTY); } catch (e) {} },
  /** history is the largest blob; on quota failure keep only totals for older entries */
  history: (h, ls = globalThis.localStorage) => {
    if (writeJSON(ls, LS.HISTORY, h)) return h;
    const slim = h.map((e, i) => i < h.length - 6 ? { d: e.d, total: e.total } : e);
    writeJSON(ls, LS.HISTORY, slim); return slim;
  },
};

/* ---------- IndexedDB catalog ---------- */
function idbOpen(idb = globalThis.indexedDB) {
  return new Promise((res, rej) => {
    const rq = idb.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "i" }); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error || new Error("idb"));
  });
}
export async function idbPutAll(items, idb) {
  const db = await idbOpen(idb);
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite"), st = tx.objectStore(IDB_STORE);
    for (const it of items) st.put(it);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error || new Error("idb write"));
  });
}
export async function idbGetAll(idb) {
  const db = await idbOpen(idb);
  return new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).getAll();
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error || new Error("idb read"));
  });
}
export async function idbClear(idb) {
  const db = await idbOpen(idb);
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite"); tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error || new Error("idb clear"));
  });
}
/** replace the stored catalog atomically-enough: clear then write */
export async function idbReplaceCatalog(items, idb) { await idbClear(idb); await idbPutAll(items, idb); }
