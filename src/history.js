// Daily collection-value snapshots: [{ d:"YYYY-MM-DD", total, pv:{ pid: value } }]. Pure.
import { HISTORY_MAX, HISTORY_DETAIL_DAYS } from "./constants.js";
import { productValue, totalWorth } from "./collection.js";
import { priceOf, primaryVariant } from "./pricing.js";
import { today } from "./util.js";

/**
 * Returns a NEW history array with today's snapshot (replacing a same-day one).
 * Entry: { d, total, pv: { pid: owned value }, px: { pid: primary price } } —
 * px covers owned AND wishlisted products so any card you care about gets a
 * price chart. Totals are kept for HISTORY_MAX days; pv/px only for the most
 * recent HISTORY_DETAIL_DAYS entries so the log stays small.
 */
export function snapshot(history, owned, flatPrices, d = today(), wishlist = {}) {
  const total = totalWorth(owned, flatPrices), pv = {}, px = {};
  for (const pid in owned) { const v = productValue(owned, flatPrices, pid); if (v > 0) pv[pid] = Math.round(v * 100) / 100; }
  for (const pid of new Set([...Object.keys(owned), ...Object.keys(wishlist || {})])) {
    const p = priceOf(flatPrices, pid, primaryVariant(flatPrices, pid)); if (p != null) px[pid] = Math.round(p * 100) / 100;
  }
  let h = (history || []).slice();
  const entry = { d, total: Math.round(total * 100) / 100, pv, px };
  if (h.length && h[h.length - 1].d === d) h[h.length - 1] = entry; else h.push(entry);
  if (h.length > HISTORY_MAX) h = h.slice(h.length - HISTORY_MAX);
  const cut = h.length - HISTORY_DETAIL_DAYS;
  for (let i = 0; i < cut; i++) if (h[i].pv || h[i].px) h[i] = { d: h[i].d, total: h[i].total };
  return h;
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
/** per-product price series [{ d, v }] — primary-printing price (px), falling back to owned value (pv) */
export function productSeries(history, pid) {
  pid = String(pid);
  const out = [];
  for (const e of history || []) {
    const v = e.px && e.px[pid] != null ? e.px[pid] : e.pv && e.pv[pid] != null ? e.pv[pid] : null;
    if (v != null) out.push({ d: e.d, v });
  }
  return out;
}
/** keep only entries within the last n days (n = 0 → all) */
export function rangeSeries(series, days, d = today()) {
  if (!days) return series;
  const from = new Date(d + "T00:00:00Z"); from.setUTCDate(from.getUTCDate() - days);
  const f = from.toISOString().slice(0, 10);
  return series.filter((p) => p.d >= f);
}
/** compact series when only totals are needed */
export function totalSeries(history) { return (history || []).map((e) => ({ d: e.d, v: e.total || 0 })); }
