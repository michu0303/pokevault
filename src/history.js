// Daily collection-value snapshots: [{ d:"YYYY-MM-DD", total, pv:{ pid: value } }]. Pure.
import { HISTORY_MAX } from "./constants.js";
import { productValue, totalWorth } from "./collection.js";
import { today } from "./util.js";

/** returns a NEW history array with today's snapshot (replacing a same-day one), capped */
export function snapshot(history, owned, flatPrices, d = today()) {
  const total = totalWorth(owned, flatPrices), pv = {};
  for (const pid in owned) { const v = productValue(owned, flatPrices, pid); if (v > 0) pv[pid] = Math.round(v * 100) / 100; }
  const h = (history || []).slice();
  if (h.length && h[h.length - 1].d === d) h[h.length - 1] = { d, total, pv }; else h.push({ d, total, pv });
  return h.length > HISTORY_MAX ? h.slice(h.length - HISTORY_MAX) : h;
}
export function trendInfo(history) {
  const h = history || [];
  if (h.length < 2) return null;
  const last = h[h.length - 1], first = h[0], diff = last.total - first.total;
  return { diff, fromDate: first.d, toDate: last.d, pct: first.total > 0 ? diff / first.total * 100 : 0 };
}
/** the n products whose value moved most between the first and last snapshot */
export function moversInfo(history, byId, n = 3) {
  const h = history || [];
  if (h.length < 2) return [];
  const last = h[h.length - 1].pv || {}, first = h[0].pv || {};
  const out = [];
  for (const pid of new Set([...Object.keys(last), ...Object.keys(first)])) {
    const d = (last[pid] || 0) - (first[pid] || 0);
    if (Math.abs(d) >= 0.5 && (!byId || byId.has(String(pid)))) out.push({ pid, diff: d });
  }
  out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return out.slice(0, n);
}
/** per-product series for a sparkline: [{ d, v }] */
export function productSeries(history, pid) {
  pid = String(pid);
  return (history || []).map((e) => ({ d: e.d, v: (e.pv && e.pv[pid]) || 0 }));
}
/** compact series when only totals are needed */
export function totalSeries(history) { return (history || []).map((e) => ({ d: e.d, v: e.total || 0 })); }
