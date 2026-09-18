import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToProduct, csvPrices, findGaps, withFillPrices, trackFill } from "../src/gapfill.js";
import { fillCatalogGaps } from "../src/api.js";
import { flattenPricing, priceDetail } from "../src/pricing.js";
import { indexCatalog } from "../src/catalog.js";

const set = { id: 24722, name: "ME: 30th Celebration", cat: 3 };
const gengar = { productId: 717610, name: "Gengar ex - 154/128", imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/717610_200w.jpg",
  extendedData: [{ name: "Number", value: "154/128" }, { name: "Rarity", value: "Special Illustration Rare" }] };
const code = { productId: 9, name: "Code Card - 30th Celebration Booster Pack", extendedData: [{ name: "Rarity", value: "Code Card" }] };
const rows = [{ productId: 717610, lowPrice: 160, midPrice: 200.23, highPrice: 498, marketPrice: 164.62, subTypeName: "Holofoil" }, { productId: 5, lowPrice: null, marketPrice: null, subTypeName: "Normal" }];

test("csvToProduct maps a TCGplayer product onto the catalog shape", () => {
  assert.deepEqual(csvToProduct(gengar, set), { i: 717610, n: "Gengar ex", s: "ME: 30th Celebration", sid: 24722, nu: "154/128", r: "Special Illustration Rare", g: gengar.imageUrl, cat: 3, x: 1 });
  assert.equal(csvToProduct(code, set), null, "code cards are never added");
  assert.equal(csvToProduct({ name: "no id" }, set), null);
  assert.equal(csvToProduct({ productId: 1, name: "Booster Box" }, set).n, "Booster Box");
});
test("findGaps only returns what is missing, with prices attached", () => {
  const gaps = findGaps(new Set(["1"]), [{ productId: 1, name: "Have" }, gengar, code], set, csvPrices(rows));
  assert.equal(gaps.length, 1);
  assert.deepEqual(gaps[0].fp, { Holofoil: { low: 160, market: 164.62, mid: 200.23, high: 498 } });
  assert.equal(csvPrices(rows)["5"], undefined, "price-less rows are dropped");
});
test("fill prices behave like a live response, and the live response wins", () => {
  const [g] = findGaps(new Set(), [gengar], set, csvPrices(rows));
  const merged = withFillPrices({ 1: { tcg: { Normal: { market: 2 } } } }, [g]);
  assert.deepEqual(flattenPricing(merged), { 1: { Normal: 2 }, 717610: { Holofoil: 164.62 } });
  assert.equal(priceDetail(merged, 717610, "Holofoil").high, 498);
  const live = { 717610: { tcg: { Holofoil: { market: 170 } } } };
  assert.equal(withFillPrices(live, [g]), live, "untouched when the API already prices it");
  assert.deepEqual(withFillPrices({}, undefined), {});
});
test("a filled card groups into its set like any other", () => {
  const [g] = findGaps(new Set(), [gengar], set);
  const { bySet, byId } = indexCatalog([{ i: 1, n: "Gengar ex", s: set.name, sid: 24722, nu: "090/128", r: "Double Rare", g: "", cat: 3 }, g]);
  assert.equal(bySet.get("24722").cards.length, 2);
  assert.equal(byId.get("717610").r, "Special Illustration Rare");
});
test("trackFill keeps 'since', and reports a product only once the API really lists it", () => {
  const [g] = findGaps(new Set(), [gengar], set);
  const d1 = trackFill(null, [g], new Set(), "2026-09-18");
  assert.deepEqual(d1.fresh, ["717610"]); assert.equal(d1.open["717610"].since, "2026-09-18");
  const d2 = trackFill(d1, [g], new Set(), "2026-09-19");
  assert.equal(d2.open["717610"].since, "2026-09-18"); assert.deepEqual(d2.fresh, []);
  const gone = trackFill(d2, [], new Set(), "2026-09-20");
  assert.deepEqual(gone.newlyCaughtUp, [], "vanished from both sources ≠ caught up");
  const d3 = trackFill(d2, [], new Set(["717610"]), "2026-09-20");
  assert.equal(d3.newlyCaughtUp.length, 1); assert.equal(d3.newlyCaughtUp[0].on, "2026-09-20"); assert.deepEqual(d3.open, {});
  assert.equal(trackFill(d3, [], new Set(["717610"]), "2026-09-21").caughtUp.length, 1, "log is kept, not repeated");
});
test("fillCatalogGaps: sends a User-Agent, fetches prices only for sets with a gap, survives failures, never invents sets", async () => {
  const calls = [];
  const f = async (url, opts) => {
    calls.push(url); assert.ok(opts.headers["User-Agent"]);
    if (url.endsWith("/3/24722/products")) return { ok: true, json: async () => ({ results: [{ productId: 1, name: "Have" }, gengar] }) };
    if (url.endsWith("/3/24722/prices")) return { ok: true, json: async () => ({ results: rows }) };
    if (url.endsWith("/3/100/products")) return { ok: true, json: async () => ({ results: [{ productId: 2, name: "Also have" }] }) };
    return { ok: false, status: 503, json: async () => ({}) };
  };
  const sets = [set, { id: 100, name: "Full", cat: 3 }, { id: 200, name: "Down", cat: 3 }, { id: 300, name: "Empty upstream", cat: 3 }];
  const products = [{ i: 1, sid: 24722 }, { i: 2, sid: 100 }, { i: 3, sid: 200 }];
  const r = await fillCatalogGaps({ products, sets }, { fetch: f });
  assert.deepEqual(r.filled.map((c) => c.i), [717610]);
  assert.equal(r.filled[0].fp.Holofoil.market, 164.62);
  assert.equal(r.checked, 2); assert.equal(r.errors, 1);
  assert.equal(calls.filter((u) => u.endsWith("/prices")).length, 1);
  assert.ok(!calls.some((u) => u.includes("/300/")));
});
