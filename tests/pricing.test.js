import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenPricing, dropPatternReverseDupes, applySetPricing, variantsFor, primaryVariant, priceOf, prunePrices } from "../src/pricing.js";
import { fixture, catalogFrom } from "./helpers.js";

test("flattenPricing reads market (then low) per variant from a real response", () => {
  const f = fixture("prismatic");
  const flat = flattenPricing(f.prices);
  assert.deepEqual(flat["610356"], { Normal: 0.04, "Reverse Holofoil": 0.16 });
  assert.equal(Object.keys(flat).length, 19, "the Display Case has an empty tcg list and is dropped");
  assert.equal(flat["635011"], undefined);
});
test("flattenPricing drops unpriced variants only when another variant is priced", () => {
  const flat = flattenPricing({
    1: { tcg: { Normal: { market: 1.5 }, "Reverse Holofoil": { market: null, low: null } } },
    2: { tcg: { Normal: { market: null }, Holofoil: { market: null } } },
    3: { tcg: {}, manapool: { nm: 4.2 } },
    4: { tcg: { Normal: { low: 0.3 } } },
  });
  assert.deepEqual(flat["1"], { Normal: 1.5 });
  assert.deepEqual(flat["2"], { Normal: null, Holofoil: null }, "nothing priced → keep all so nothing is lost");
  assert.deepEqual(flat["3"], { Default: 4.2 });
  assert.deepEqual(flat["4"], { Normal: 0.3 }, "low is the fallback");
});
test("pattern-reverse dedupe removes the base card's redundant Reverse Holofoil", () => {
  const f = fixture("prismatic");
  const { bySet } = catalogFrom("prismatic");
  const flat = applySetPricing({}, f.prices, bySet.get("23821"));
  assert.deepEqual(Object.keys(flat["610356"]), ["Normal"], "Exeggcute keeps Normal only");
  const pokeBall = f.products.find((p) => p.name === "Exeggcute (Poke Ball Pattern)").id;
  assert.ok(flat[String(pokeBall)], "pattern product keeps its own price");
  // a trainer-like product with no pattern siblings is untouched
  const lone = { groups: [{ products: [{ i: 9, n: "Boss's Orders" }] }] };
  assert.deepEqual(dropPatternReverseDupes({ 9: { Normal: 1, "Reverse Holofoil": 2 } }, lone)["9"], { Normal: 1, "Reverse Holofoil": 2 });
});
test("variantsFor / primaryVariant / priceOf", () => {
  const flat = { 7: { "Reverse Holofoil": 2, Normal: 1, "Master Ball": 9 } };
  assert.deepEqual(variantsFor(flat, 7), ["Normal", "Reverse Holofoil", "Master Ball"]);
  assert.deepEqual(variantsFor(flat, 8), ["Default"], "unknown product → Default");
  assert.equal(primaryVariant(flat, 7), "Normal");
  assert.equal(primaryVariant({ 1: { "Reverse Holofoil": 3 } }, 1), "Reverse Holofoil");
  assert.equal(priceOf(flat, 7, "Master Ball"), 9);
  assert.equal(priceOf(flat, 7, "Holo"), null);
  assert.equal(priceOf(flat, 99, "Normal"), null);
});
test("prunePrices keeps owned + wishlisted only", () => {
  const out = prunePrices({ 1: { a: 1 }, 2: { a: 2 }, 3: { a: 3 } }, { 1: { a: 1 } }, { 3: 1 });
  assert.deepEqual(Object.keys(out), ["1", "3"]);
});
