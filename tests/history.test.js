import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot, trendInfo, moversInfo, productSeries, rangeSeries } from "../src/history.js";
import { HISTORY_MAX, HISTORY_DETAIL_DAYS } from "../src/constants.js";

const flat = { 1: { Normal: 10 }, 2: { Normal: 0.2 } };
const day = (i) => { const d = new Date(Date.UTC(2025, 0, 1)); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };
test("snapshot replaces a same-day entry, records wishlist prices, caps and strips detail", () => {
  let h = snapshot([], { 1: { Normal: 1 } }, flat, "2026-09-01", { 2: 1 });
  assert.deepEqual(h, [{ d: "2026-09-01", total: 10, pv: { 1: 10 }, px: { 1: 10, 2: 0.2 } }]);
  h = snapshot(h, { 1: { Normal: 2 } }, flat, "2026-09-01");
  assert.equal(h.length, 1); assert.equal(h[0].total, 20);
  h = [];
  for (let i = 0; i < HISTORY_MAX + 10; i++) h = snapshot(h, { 1: { Normal: 1 } }, flat, day(i));
  assert.equal(h.length, HISTORY_MAX);
  assert.equal(h[0].d, day(10));
  assert.equal("px" in h[0], false, "old entries keep only the total");
  assert.equal("px" in h[h.length - HISTORY_DETAIL_DAYS], true, "recent entries keep per-card detail");
  assert.equal(productSeries(h, 1).length, HISTORY_DETAIL_DAYS);
});
test("rangeSeries keeps the last n days", () => {
  const s = [{ d: "2026-08-01", v: 1 }, { d: "2026-09-05", v: 2 }, { d: "2026-09-13", v: 3 }];
  assert.equal(rangeSeries(s, 7, "2026-09-13").length, 1);
  assert.equal(rangeSeries(s, 30, "2026-09-13").length, 2);
  assert.equal(rangeSeries(s, 0, "2026-09-13").length, 3);
});
test("trendInfo / moversInfo / productSeries", () => {
  const h = [{ d: "2026-09-01", total: 10, pv: { 1: 10, 2: 0.2 } }, { d: "2026-09-02", total: 14, pv: { 1: 13.5, 2: 0.5 }, px: { 1: 13.5 } }];
  assert.deepEqual(trendInfo(h), { diff: 4, fromDate: "2026-09-01", toDate: "2026-09-02", pct: 40 });
  assert.equal(trendInfo([h[0]]), null);
  const byId = new Map([["1", {}], ["2", {}]]);
  assert.deepEqual(moversInfo(h, byId), [{ pid: "1", diff: 3.5 }], "moves under $0.50 are ignored");
  assert.deepEqual(moversInfo(h, new Map()), [], "unknown products are skipped");
  assert.deepEqual(productSeries(h, 1).map((p) => p.v), [10, 13.5], "px when present, else pv");
});
