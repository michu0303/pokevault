import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCollection, getQty, ownedTotal, ownState, groupState, setQty, quickToggle, quickToggleGroup, productValue, totalWorth, setStats,
  normFolders, toggleWish, isWished, addFolder, renameFolder, deleteFolder, toggleCardFolder, cardFolders, folderCount, unsortedWishlist,
  toggleTracked, toggleSetStar, exportPayload, parseImport } from "../src/collection.js";
import { applySetPricing } from "../src/pricing.js";
import { fixture, catalogFrom } from "./helpers.js";

const setup = () => {
  const f = fixture("prismatic");
  const { bySet } = catalogFrom("prismatic");
  const g = bySet.get("23821");
  const flat = applySetPricing({}, f.prices, g);
  return { g, flat, col: emptyCollection() };
};

test("setQty / getQty / ownedTotal keep the owned map tidy", () => {
  const owned = {};
  setQty(owned, 610356, "Normal", 2);
  setQty(owned, "610356", "Reverse Holofoil", 1.7);
  assert.deepEqual(owned, { 610356: { Normal: 2, "Reverse Holofoil": 1 } });
  assert.equal(getQty(owned, 610356, "Normal"), 2);
  assert.equal(ownedTotal(owned, 610356), 3);
  setQty(owned, 610356, "Normal", 0); setQty(owned, 610356, "Reverse Holofoil", -3);
  assert.deepEqual(owned, {}, "empty products are removed");
});
test("ownState / groupState use the master-set definition", () => {
  const { g, flat, col } = setup();
  const grp = g.groups[0]; // Exeggcute: base(Normal) + Poké Ball + Master Ball products
  assert.equal(groupState(col.owned, flat, grp), "none");
  setQty(col.owned, 610356, "Normal", 1);
  assert.equal(ownState(col.owned, flat, 610356), "complete", "base card has one printing after dedupe");
  assert.equal(groupState(col.owned, flat, grp), "partial");
  for (const p of grp.products) for (const v of Object.keys(flat[String(p.i)])) setQty(col.owned, p.i, v, 1);
  assert.equal(groupState(col.owned, flat, grp), "complete");
});
test("quickToggle fills every printing, clears it again, and refuses to drop counts > 1", () => {
  const { g, flat, col } = setup();
  const grp = g.groups[0];
  assert.equal(quickToggleGroup(col.owned, flat, grp), true);
  assert.equal(groupState(col.owned, flat, grp), "complete");
  assert.equal(quickToggleGroup(col.owned, flat, grp), true);
  assert.equal(groupState(col.owned, flat, grp), "none");
  setQty(col.owned, 610356, "Normal", 3);
  assert.equal(quickToggle(col.owned, flat, 610356), false, "would lose a count — refuse");
  assert.equal(getQty(col.owned, 610356, "Normal"), 3);
});
test("values and set stats", () => {
  const { g, flat, col } = setup();
  setQty(col.owned, 610356, "Normal", 2);                // 2 × 0.04
  const lea = g.groups[5].products[0];                    // Leafeon ex
  const leaV = Object.keys(flat[String(lea.i)])[0];
  setQty(col.owned, lea.i, leaV, 1);
  assert.ok(Math.abs(productValue(col.owned, flat, 610356) - 0.08) < 1e-9);
  assert.ok(totalWorth(col.owned, flat) > 0.08);
  const st = setStats(g, col.owned, flat);
  assert.equal(st.total, 6);
  assert.equal(st.owned, 2, "groups with ≥1 printing");
  assert.equal(st.complete, 1, "only Leafeon ex (single printing) is complete");
  assert.equal(st.sealedTotal, 4); assert.equal(st.sealedOwned, 0);
});
test("wishlist + folders: filing wishlists, un-wishlisting unfiles everywhere", () => {
  const col = emptyCollection();
  const f1 = addFolder(col, "  Card show  "), f2 = addFolder(col, "Grails");
  assert.equal(f1.name, "Card show");
  assert.equal(addFolder(col, "   "), null);
  toggleCardFolder(col, 610356, f1.id); toggleCardFolder(col, 610356, f2.id);
  assert.equal(isWished(col, 610356), true, "filing wishlists the card");
  assert.deepEqual(cardFolders(col, 610356).map((f) => f.id), [f1.id, f2.id]);
  toggleWish(col, 999);
  assert.deepEqual(unsortedWishlist(col), ["999"]);
  toggleWish(col, 610356);
  assert.equal(isWished(col, 610356), false);
  assert.equal(folderCount(f1), 0); assert.equal(folderCount(f2), 0);
  renameFolder(col, f1.id, "Show list"); renameFolder(col, f1.id, " ");
  assert.equal(f1.name, "Show list");
  deleteFolder(col, f2.id);
  assert.deepEqual(col.wishFolders.map((f) => f.id), [f1.id]);
});
test("normFolders is defensive", () => {
  const out = normFolders([{ id: 1, name: "x", items: { 5: 1 } }, null, "junk", { items: [1, 2] }]);
  assert.equal(out.length, 2, "null and non-objects are dropped");
  assert.deepEqual(out[0], { id: "1", name: "x", items: { 5: 1 } });
  assert.equal(out[1].name, "Folder"); assert.deepEqual(out[1].items, {}); assert.match(out[1].id, /^f/);
  assert.deepEqual(normFolders("nope"), []);
});
test("tracked / star keep tracked and favorites in sync", () => {
  const col = emptyCollection();
  toggleTracked(col, 23821);
  assert.deepEqual(col.tracked, { 23821: 1 });
  toggleSetStar(col, 23651);
  assert.deepEqual(col.tracked, { 23821: 1, 23651: 1 }); assert.deepEqual(col.favorites, { 23651: 1 });
  toggleSetStar(col, 23651);
  assert.deepEqual(col.tracked, { 23821: 1 }); assert.deepEqual(col.favorites, {});
});
test("export → import round-trip, including folders; legacy v2 array import; garbage rejected", () => {
  const col = emptyCollection();
  setQty(col.owned, 1, "Normal", 2); toggleWish(col, 2); const f = addFolder(col, "A"); toggleCardFolder(col, 3, f.id); toggleTracked(col, 9);
  const payload = exportPayload(col, [{ d: "2026-09-13", total: 1, pv: {} }], "2026-09-13T00:00:00Z");
  assert.equal(payload.version, 4);
  const back = parseImport(JSON.stringify(payload));
  assert.deepEqual(back.owned, { 1: { Normal: 2 } });
  assert.deepEqual(back.wishlist, { 2: 1, 3: 1 });
  assert.deepEqual(back.wishFolders, [{ id: f.id, name: "A", items: { 3: 1 } }]);
  assert.deepEqual(back.tracked, { 9: 1 }); assert.equal(back.history.length, 1);
  const legacy = parseImport({ collection: [{ productId: 5, variant: "Holofoil", qty: 2 }, { productId: 5 }, { junk: true }] });
  assert.deepEqual(legacy.owned, { 5: { Holofoil: 2, Default: 1 } });
  assert.throws(() => parseImport("{}")); assert.throws(() => parseImport("[]")); assert.throws(() => parseImport("not json"));
});
