import { test } from "node:test";
import assert from "node:assert/strict";
import { looksSealed, isSealedProduct, patternOf, patSort, normalizeProduct, indexCatalog, variantRank, shortVariant, isChaseRarity, isHighValueRarity, groupPrintings, newestSets, findGroup } from "../src/catalog.js";
import { cleanName, cmpNum, cmpSid } from "../src/util.js";
import { fixture, catalogFrom, byName } from "./helpers.js";

test("looksSealed: sealed keywords, but 'bundle' only with a sealed prefix", () => {
  assert.equal(looksSealed("Prismatic Evolutions Booster Bundle"), true);
  assert.equal(looksSealed("Surging Sparks Elite Trainer Box"), true);
  assert.equal(looksSealed("Prismatic Evolutions 2-Pack Blister [Eevee]"), true);
  assert.equal(looksSealed("Iron Bundle"), false);
  assert.equal(looksSealed("Pikachu ex"), false);
});
test("isSealedProduct: rarity is the primary signal", () => {
  const ssp = fixture("surging");
  const ib = normalizeProduct(ssp.products[0], ssp.set);
  assert.equal(ib.n, "Iron Bundle");
  assert.equal(isSealedProduct(ib), false);
  assert.equal(isSealedProduct({ n: "Prismatic Evolution Booster Bundle Display Case", r: "" }), true);
  assert.equal(isSealedProduct({ n: "Some Box", r: "Common" }), false, "a rarity-bearing card is never sealed");
});
test("patternOf / patSort", () => {
  assert.equal(patternOf("Exeggcute (Poke Ball Pattern)"), "Poké Ball");
  assert.equal(patternOf("Exeggcute (Master Ball Pattern)"), "Master Ball");
  assert.equal(patternOf("Grass Energy (Energy Symbol Pattern)"), "Energy");
  assert.equal(patternOf("Exeggcute"), "");
  assert.equal(patternOf("Pikachu (Cosmos Holo)"), "", "unknown parenthetical is not a pattern");
  assert.deepEqual(["Exeggcute (Master Ball Pattern)", "Exeggcute", "X (Energy Symbol Pattern)", "Exeggcute (Poke Ball Pattern)"].sort((a, b) => patSort(a) - patSort(b)),
    ["Exeggcute", "X (Energy Symbol Pattern)", "Exeggcute (Poke Ball Pattern)", "Exeggcute (Master Ball Pattern)"]);
});
test("normalizeProduct maps the API shape to the compact entry", () => {
  const f = fixture("prismatic");
  const e = normalizeProduct(f.products[0], f.set);
  assert.deepEqual(e, { i: 610356, n: "Exeggcute", s: "SV: Prismatic Evolutions", sid: 23821, nu: "001/131", r: "Common", g: "https://cdn.tcgtracking.com/product/610356_200w.jpg", cat: 3 });
});
test("indexCatalog groups by collector number, base card first, sealed separated", () => {
  const { bySet, byId } = catalogFrom("prismatic");
  const g = bySet.get("23821");
  assert.ok(g, "bySet is keyed by string set id");
  assert.equal(g.name, "SV: Prismatic Evolutions");
  assert.equal(g.sealed.length, 4);
  assert.equal(g.cards.length, 16);
  assert.equal(g.groups.length, 6, "six collector numbers");
  const first = g.groups[0];
  assert.equal(first.key, "#001/131");
  assert.equal(first.name, "Exeggcute");
  assert.deepEqual(first.products.map((p) => p.n), ["Exeggcute", "Exeggcute (Poke Ball Pattern)", "Exeggcute (Master Ball Pattern)"]);
  assert.equal(g.groups[5].name, "Leafeon ex", "'Leafeon ex - 006/131' is cleaned");
  assert.equal(byId.get("610356").sealed, false);
  assert.equal(byId.get("610356")._hay.includes("001/131"), true, "search haystack includes the number");
  assert.equal(findGroup(bySet, 23821, "#002/131").name, "Exeggutor");
});
test("variantRank order and shortVariant labels", () => {
  const vs = ["Master Ball", "Reverse Holofoil", "Holofoil", "Normal", "Poke Ball", "1st Edition Holofoil"];
  assert.deepEqual(vs.slice().sort((a, b) => variantRank(a) - variantRank(b)), ["Normal", "Holofoil", "1st Edition Holofoil", "Reverse Holofoil", "Poke Ball", "Master Ball"]);
  assert.equal(shortVariant("Reverse Holofoil"), "Reverse");
  assert.equal(shortVariant("Default"), "Normal");
  assert.equal(shortVariant("Master Ball"), "Master");
  assert.equal(shortVariant("Poke Ball"), "Poké Ball");
  assert.equal(shortVariant("Unlimited Holofoil"), "Holo");
});
test("rarity classes", () => {
  assert.equal(isChaseRarity("Double Rare"), true);
  assert.equal(isChaseRarity("Special Illustration Rare"), true);
  assert.equal(isChaseRarity("Common"), false);
  assert.equal(isChaseRarity("Rare"), false);
  assert.equal(isHighValueRarity("Ultra Rare"), true);
  assert.equal(isHighValueRarity("Double Rare"), false);
});
test("groupPrintings flattens a group into labelled printings", () => {
  const { bySet } = catalogFrom("prismatic");
  const grp = bySet.get("23821").groups[0];
  const variantsFor = (pid) => (String(pid) === "610356" ? ["Normal", "Reverse Holofoil"] : ["Reverse Holofoil"]);
  assert.deepEqual(groupPrintings(grp, variantsFor).map((p) => p.label), ["Normal", "Reverse", "Poké Ball", "Master Ball"]);
});
test("newestSets prefers release dates, falls back to id", () => {
  const { bySet } = catalogFrom("prismatic", "surging");
  assert.deepEqual(newestSets(bySet, { 23821: "2025-01-17", 23651: "2024-11-08" }, 2).map((s) => s.sid), ["23821", "23651"]);
  assert.deepEqual(newestSets(bySet, {}, 2).map((s) => s.sid), ["23821", "23651"]);
});
test("util: cleanName, cmpNum, cmpSid", () => {
  assert.equal(cleanName("Pikachu ex - 238/191"), "Pikachu ex");
  assert.equal(cleanName("Exeggcute (Poke Ball Pattern)"), "Exeggcute");
  assert.ok(cmpNum("001/131", "010/131") < 0);
  assert.ok(cmpNum("RC29", "RC30") < 0);
  assert.ok(cmpNum("", "1") > 0, "empty numbers sort last");
  assert.ok(cmpSid("23821", 23651) > 0);
});
