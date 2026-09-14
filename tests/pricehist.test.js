import { test } from "node:test";
import assert from "node:assert/strict";
import { appendDay, seriesOf, mergeSeries } from "../src/pricehist.js";

test("appendDay builds columns, keeps the primary printing, replaces same-day, caps", () => {
  let h = appendDay(null, "2026-09-01", { 1: { Normal: 1.5, "Reverse Holofoil": 3 }, 2: { Holofoil: 20 } });
  assert.deepEqual(h.days, ["2026-09-01"]); assert.deepEqual(h.v, { 1: "Normal", 2: "Holofoil" }); assert.deepEqual(h.p, { 1: [1.5], 2: [20] });
  h = appendDay(h, "2026-09-02", { 1: { Normal: 1.75 }, 3: { Normal: 0.1 } });
  assert.deepEqual(h.p, { 1: [1.5, 1.75], 2: [20, null], 3: [null, 0.1] }, "missing products get null, new ones are back-filled");
  h = appendDay(h, "2026-09-02", { 1: { Normal: 1.8 } });
  assert.deepEqual(h.p[1], [1.5, 1.8], "same day replaces the column");
  for (let i = 3; i <= 9; i++) h = appendDay(h, "2026-09-0" + i, { 1: { Normal: i } }, 5);
  assert.equal(h.days.length, 5); assert.equal(h.days[0], "2026-09-05"); assert.equal(h.p[1].length, 5);
  assert.deepEqual(seriesOf(h, 1).map((p) => p.v), [5, 6, 7, 8, 9]);
  assert.deepEqual(seriesOf(h, 2), [], "products with no prices in the window produce no points");
  assert.deepEqual(seriesOf(null, 1), []);
});
test("appendDay keeps days sorted when a backfill arrives after today", () => {
  let h = appendDay(null, "2026-09-14", { 1: { Normal: 5 } });
  h = appendDay(h, "2026-09-12", { 1: { Normal: 3 }, 2: { Normal: 1 } });
  h = appendDay(h, "2026-09-13", { 1: { Normal: 4 } });
  assert.deepEqual(h.days, ["2026-09-12", "2026-09-13", "2026-09-14"]);
  assert.deepEqual(h.p, { 1: [3, 4, 5], 2: [1, null, null] });
});
test("mergeSeries: server wins on shared days, union otherwise, sorted", () => {
  const m = mergeSeries([{ d: "2026-09-02", v: 2 }, { d: "2026-09-03", v: 3 }], [{ d: "2026-09-01", v: 1 }, { d: "2026-09-02", v: 9 }]);
  assert.deepEqual(m, [{ d: "2026-09-01", v: 1 }, { d: "2026-09-02", v: 2 }, { d: "2026-09-03", v: 3 }]);
});
