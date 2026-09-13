import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAll, save, normalizePrefs } from "../src/storage.js";
import { createStore } from "../src/store.js";
import { LS } from "../src/constants.js";
import { setQty, toggleWish } from "../src/collection.js";
import { fakeLS } from "./helpers.js";

test("loadAll defaults on an empty device", () => {
  const s = loadAll(fakeLS());
  assert.deepEqual(s.owned, {}); assert.deepEqual(s.wishFolders, []); assert.equal(s.dirty, false);
  assert.equal(s.prefs.colPerPage, 30); assert.equal(s.prefs.theme, "system"); assert.equal(s.catalogMeta, null);
});
test("loadAll reads the original app's keys unchanged", () => {
  const ls = fakeLS();
  ls.setItem(LS.OWNED, JSON.stringify({ 5: { Normal: 2 } }));
  ls.setItem(LS.WFOLDERS, JSON.stringify([{ id: "f1", name: "A", items: { 5: 1 } }]));
  ls.setItem(LS.PREFS, JSON.stringify({ colPerPage: 50, theme: "dark", cols: 3, setSort: "bogus" }));
  ls.setItem(LS.SYNC, JSON.stringify({ url: "u", key: "k", pass: "p" }));
  ls.setItem(LS.DIRTY, "1");
  const s = loadAll(ls);
  assert.deepEqual(s.owned, { 5: { Normal: 2 } });
  assert.equal(s.wishFolders[0].name, "A");
  assert.deepEqual(s.prefs, { binder: true, cols: 3, setSort: "az", colRarity: "", colPerPage: 50, theme: "dark", recent: [] });
  assert.deepEqual(s.sync, { url: "u", key: "k", pass: "p" }); assert.equal(s.dirty, true);
  assert.equal(normalizePrefs(null).theme, "system");
});
test("loadAll migrates a v2 collection once", () => {
  const ls = fakeLS();
  ls.setItem(LS.LEGACY_COLLECTION, JSON.stringify([{ productId: 9, variant: "Holofoil", qty: 2, marketPrice: 3.5 }, { productId: 9 }]));
  const s = loadAll(ls);
  assert.equal(s.migrated, true);
  assert.deepEqual(s.owned, { 9: { Holofoil: 2, Default: 1 } });
  assert.deepEqual(s.flatPrices, { 9: { Holofoil: 3.5 } });
  assert.deepEqual(JSON.parse(ls.getItem(LS.OWNED)), s.owned, "migration is written back");
  assert.equal(loadAll(ls).migrated, false);
});
test("history save degrades gracefully when storage is full", () => {
  const ls = fakeLS(300);
  const h = Array.from({ length: 10 }, (_, i) => ({ d: "2026-09-" + String(i + 1).padStart(2, "0"), total: i, pv: { 1: i, 2: i, 3: i, 4: i } }));
  const kept = save.history(h, ls);
  assert.equal(kept.length, 10);
  assert.equal("pv" in kept[0], false, "older entries lose per-product detail");
  assert.equal("pv" in kept[9], true);
});
test("store persists the slices named in update() and marks dirty", () => {
  const ls = fakeLS();
  const st = createStore({ ...loadAll(ls), flatPrices: { 1: { Normal: 4 }, 2: { Normal: 1 } } }, { ls });
  const seen = [];
  st.subscribe((_, changed) => seen.push([...changed]));
  st.update((s) => setQty(s.owned, 1, "Normal", 1), "owned");
  st.update((s) => toggleWish(s, 2), "wishlist");
  assert.deepEqual(JSON.parse(ls.getItem(LS.OWNED)), { 1: { Normal: 1 } });
  assert.deepEqual(JSON.parse(ls.getItem(LS.WISH)), { 2: 1 });
  assert.deepEqual(JSON.parse(ls.getItem(LS.PRICES)), { 1: { Normal: 4 }, 2: { Normal: 1 } }, "prices pruned to owned + wishlist");
  assert.equal(ls.getItem(LS.DIRTY), "1"); assert.equal(st.state.dirty, true);
  assert.deepEqual(seen, [["owned"], ["wishlist"]]);
  st.clearDirty(); assert.equal(ls.getItem(LS.DIRTY), null);
});
