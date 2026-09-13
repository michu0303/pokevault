// Collection state operations. Every function here is pure over plain data:
//   owned:       { pid: { variantName: qty } }
//   wishlist:    { pid: 1 }
//   wishFolders: [{ id, name, items: { pid: 1 } }]
//   tracked / favorites: { setId: 1 }
// `col` bundles those five. Functions mutate the object they are given and
// return it, so a store can persist exactly the slice that changed.
import { variantsFor, priceOf } from "./pricing.js";

export function emptyCollection() { return { owned: {}, wishlist: {}, wishFolders: [], tracked: {}, favorites: {} }; }

/* ---------- ownership ---------- */
export function getQty(owned, pid, variant) { const o = owned[String(pid)]; return (o && o[variant]) || 0; }
export function ownedTotal(owned, pid) { const o = owned[String(pid)]; if (!o) return 0; let s = 0; for (const v in o) s += o[v]; return s; }
/** "none" | "partial" (some printings) | "complete" (≥1 of every printing) */
export function ownState(owned, flatPrices, pid) {
  const variants = variantsFor(flatPrices, pid, owned);
  let have = 0;
  for (const v of variants) if (getQty(owned, pid, v) > 0) have++;
  if (have === 0) return "none";
  return have >= variants.length ? "complete" : "partial";
}
/** same, rolled up across every product in a same-number card group */
export function groupState(owned, flatPrices, grp) {
  let none = true, all = true;
  for (const p of grp.products) {
    const s = ownState(owned, flatPrices, p.i);
    if (s !== "none") none = false;
    if (s !== "complete") all = false;
  }
  return none ? "none" : all ? "complete" : "partial";
}
export function setQty(owned, pid, variant, qty) {
  pid = String(pid); qty = Math.max(0, Math.floor(qty) || 0);
  if (!owned[pid]) owned[pid] = {};
  if (qty <= 0) delete owned[pid][variant]; else owned[pid][variant] = qty;
  if (!Object.keys(owned[pid]).length) delete owned[pid];
  return owned;
}
/** Tap-to-toggle a whole product: complete → clear all printings; otherwise
 *  → one of every printing. Returns false (and changes nothing) when a
 *  printing has qty > 1, because clearing it would silently lose a count. */
export function quickToggle(owned, flatPrices, pid) {
  const o = owned[String(pid)] || {};
  const variants = variantsFor(flatPrices, pid, owned);
  if (ownState(owned, flatPrices, pid) === "complete") {
    if (Object.keys(o).some((v) => o[v] > 1)) return false;
    for (const v of variants) setQty(owned, pid, v, 0);
  } else {
    for (const v of variants) if (getQty(owned, pid, v) < 1) setQty(owned, pid, v, 1);
  }
  return true;
}
/** same for a card group — every printing of every version */
export function quickToggleGroup(owned, flatPrices, grp) {
  for (const p of grp.products) { const o = owned[String(p.i)] || {}; if (Object.keys(o).some((v) => o[v] > 1)) return false; }
  const complete = groupState(owned, flatPrices, grp) === "complete";
  for (const p of grp.products) for (const v of variantsFor(flatPrices, p.i, owned)) {
    if (complete) setQty(owned, p.i, v, 0); else if (getQty(owned, p.i, v) < 1) setQty(owned, p.i, v, 1);
  }
  return true;
}
export function productValue(owned, flatPrices, pid) {
  const o = owned[String(pid)]; if (!o) return 0;
  let s = 0; for (const v in o) s += o[v] * (priceOf(flatPrices, pid, v) || 0);
  return s;
}
export function totalWorth(owned, flatPrices) { let v = 0; for (const pid in owned) v += productValue(owned, flatPrices, pid); return v; }
/** progress for one set (a bySet value). "owned" counts groups with ≥1 printing;
 *  "complete" counts groups where every printing is owned (the master-set definition). */
export function setStats(setGroup, owned, flatPrices) {
  const groups = (setGroup && setGroup.groups) || [];
  let total = groups.length, own = 0, complete = 0, value = 0;
  for (const grp of groups) {
    let go = false;
    for (const p of grp.products) { if (ownedTotal(owned, p.i) > 0) go = true; value += productValue(owned, flatPrices, p.i); }
    if (go) own++;
    if (groupState(owned, flatPrices, grp) === "complete") complete++;
  }
  const seal = (setGroup && setGroup.sealed) || [];
  let sealedOwned = 0, sealedVal = 0;
  for (const c of seal) if (ownedTotal(owned, c.i) > 0) { sealedOwned++; sealedVal += productValue(owned, flatPrices, c.i); }
  return { total, owned: own, complete, value, sealedTotal: seal.length, sealedOwned, sealedVal };
}

/* ---------- wishlist & folders ---------- */
export function genId() { return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function normFolders(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((f) => f && typeof f === "object").map((f) => ({
    id: String(f.id || genId()), name: String(f.name || "Folder"),
    items: (f.items && typeof f.items === "object" && !Array.isArray(f.items)) ? f.items : {},
  }));
}
export function isWished(col, pid) { return !!col.wishlist[String(pid)]; }
export function toggleWish(col, pid) {
  pid = String(pid);
  if (col.wishlist[pid]) { delete col.wishlist[pid]; removeFromAllFolders(col, pid); }
  else col.wishlist[pid] = 1;
  return col;
}
export function findFolder(col, id) { return col.wishFolders.find((f) => f.id === id) || null; }
export function cardFolders(col, pid) { pid = String(pid); return col.wishFolders.filter((f) => f.items && f.items[pid]); }
export function folderCount(f) { return f && f.items ? Object.keys(f.items).length : 0; }
export function addFolder(col, name) {
  name = (name || "").trim(); if (!name) return null;
  const f = { id: genId(), name, items: {} };
  col.wishFolders.push(f); return f;
}
export function renameFolder(col, id, name) { name = (name || "").trim(); const f = findFolder(col, id); if (f && name) f.name = name; return col; }
export function deleteFolder(col, id) { col.wishFolders = col.wishFolders.filter((f) => f.id !== id); return col; }
/** file / unfile a card; filing also wishlists it */
export function toggleCardFolder(col, pid, fid) {
  pid = String(pid); const f = findFolder(col, fid); if (!f) return col;
  if (!f.items) f.items = {};
  if (f.items[pid]) delete f.items[pid];
  else { f.items[pid] = 1; col.wishlist[pid] = 1; }
  return col;
}
export function removeFromAllFolders(col, pid) {
  pid = String(pid);
  for (const f of col.wishFolders) if (f.items && f.items[pid]) delete f.items[pid];
  return col;
}
/** wishlisted cards that are in no folder */
export function unsortedWishlist(col) {
  const filed = new Set(); for (const f of col.wishFolders) for (const pid in (f.items || {})) filed.add(pid);
  return Object.keys(col.wishlist).filter((pid) => !filed.has(pid));
}

/* ---------- tracked / favourite sets ---------- */
export function isTracked(col, sid) { return !!col.tracked[String(sid)]; }
export function toggleTracked(col, sid) { sid = String(sid); if (col.tracked[sid]) delete col.tracked[sid]; else col.tracked[sid] = 1; return col; }
export function isFav(col, sid) { return !!col.favorites[String(sid)]; }
export function toggleFav(col, sid) { sid = String(sid); if (col.favorites[sid]) delete col.favorites[sid]; else col.favorites[sid] = 1; return col; }
/** the star: tracks AND pins in one tap; on-state is `tracked` */
export function toggleSetStar(col, sid) {
  sid = String(sid);
  const on = !col.tracked[sid];
  if (on) { col.tracked[sid] = 1; col.favorites[sid] = 1; } else { delete col.tracked[sid]; delete col.favorites[sid]; }
  return col;
}

/* ---------- backup ---------- */
export function exportPayload(col, history, exportedAt = new Date().toISOString()) {
  return { app: "PokéVault", version: 4, exportedAt, owned: col.owned, wishlist: col.wishlist, tracked: col.tracked,
    favorites: col.favorites, wishFolders: col.wishFolders, history: history || [] };
}
/** Parse a backup (v4 object, or the v2 `collection` array). Throws on garbage. */
export function parseImport(input) {
  const d = typeof input === "string" ? JSON.parse(input) : input;
  if (!d || typeof d !== "object") throw new Error("not a backup");
  let owned = d.owned;
  if (!owned && Array.isArray(d.collection)) {
    owned = {};
    for (const it of d.collection) {
      if (!it || it.productId == null) continue;
      const pid = String(it.productId), v = it.variant || "Default";
      owned[pid] = owned[pid] || {}; owned[pid][v] = (owned[pid][v] || 0) + (it.qty | 0 || 1);
    }
  }
  if (!owned || typeof owned !== "object" || Array.isArray(owned)) throw new Error("not a backup");
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
  return {
    owned, wishlist: obj(d.wishlist), tracked: obj(d.tracked), favorites: obj(d.favorites),
    wishFolders: normFolders(d.wishFolders), history: Array.isArray(d.history) ? d.history : null,
  };
}
