import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCatalog, matchScore } from "../src/search.js";
import { catalogFrom } from "./helpers.js";

const { catalog } = catalogFrom("prismatic", "surging");
const names = (r) => r.map((c) => c.n);

test("empty / whitespace query → nothing", () => {
  assert.deepEqual(searchCatalog(catalog, ""), []);
  assert.deepEqual(searchCatalog(catalog, "   "), []);
});
test("exact name ranks first, then prefix matches; pattern variants follow the base card", () => {
  const r = names(searchCatalog(catalog, "exeggcute"));
  assert.equal(r[0], "Exeggcute");
  assert.deepEqual(r.slice(0, 3).sort(), ["Exeggcute", "Exeggcute (Master Ball Pattern)", "Exeggcute (Poke Ball Pattern)"]);
});
test("collector number search, with the /x suffix tolerated", () => {
  assert.equal(names(searchCatalog(catalog, "001/131"))[0], "Exeggcute");
  assert.equal(names(searchCatalog(catalog, "055/191"))[0], "Iron Bundle");
  assert.equal(searchCatalog(catalog, "238/191").some((c) => /Pikachu ex/.test(c.n) && c.nu === "238/191"), true);
});
test("searching a set name returns its whole contents", () => {
  const r = searchCatalog(catalog, "prismatic");
  assert.equal(r.length, 20);
  assert.equal(r.every((c) => c.sid === 23821), true);
});
test("multi-word queries require every word and reward whole-word hits", () => {
  const r = names(searchCatalog(catalog, "pikachu ex"));
  assert.ok(r.length >= 4);
  assert.equal(r.every((n) => /Pikachu ex/.test(n)), true);
  assert.ok(matchScore("pikachu ex", "s", ["pikachu", "ex"], "pikachu ex", ["pikachu", "ex"], "") > matchScore("pikachu exe", "s", ["pikachu", "ex"], "pikachu ex", ["pikachu", "exe"], ""));
});
test("result cap", () => {
  assert.equal(searchCatalog(catalog, "prismatic", 5).length, 5);
});
