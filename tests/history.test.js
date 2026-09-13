import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot, trendInfo, moversInfo, productSeries } from "../src/history.js";

const flat = { 1: { Normal: 10 }, 2: { Normal: 0.2 } };
test("snapshot replaces a same-day entry and caps the log", () => {
  let h = snapshot([], { 1: { Normal: 1 } }, flat, "2026-09-01");
  assert.deepEqual(h, [{ d: "2026-09-01", total: 10, pv: { 1: 10 } }]);
  h = snapshot(h, { 1: { Normal: 2 } }, flat, "2026-09-01");
  assert.equal(h.length, 1); assert.equal(h[0].total, 20);
  for (let i = 2; i <= 30; i++) h = snapshot(h, { 1: { Normal: i } }, flat, "2026-09-" + String(i).padStart(2, "0"));
  assert.equal(h.length, 24); assert.equal(h[0].d, "2026-09-07");
});
test("trendInfo / moversInfo / productSeries", () => {
  const h = [{ d: "2026-09-01", total: 10, pv: { 1: 10, 2: 0.2 } }, { d: "2026-09-02", total: 14, pv: { 1: 13.5, 2: 0.5 } }];
  assert.deepEqual(trendInfo(h), { diff: 4, fromDate: "2026-09-01", toDate: "2026-09-02", pct: 40 });
  assert.equal(trendInfo([h[0]]), null);
  const byId = new Map([["1", {}], ["2", {}]]);
  assert.deepEqual(moversInfo(h, byId), [{ pid: "1", diff: 3.5 }], "moves under $0.50 are ignored");
  assert.deepEqual(moversInfo(h, new Map()), [], "unknown products are skipped");
  assert.deepEqual(productSeries(h, 1).map((p) => p.v), [10, 13.5]);
});
