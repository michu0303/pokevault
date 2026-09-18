// TCGTracking lags TCGplayer's own product list, typically by the chase cards
// of a brand-new set. The daily catalog build fills those gaps from TCGCSV
// (a mirror of TCGplayer that uses the same product and group ids). Pure.
// A filled product carries `x: 1` and its prices in `fp` (raw API shape:
// { variant: { low, market, mid, high } }) because TCGTracking's pricing
// endpoint does not know the product yet either. Once TCGTracking lists the
// product, its own record wins and the marker disappears by itself.
import { productKind } from "./catalog.js";

const ext = (p, name) => { const e = (p.extendedData || []).find((x) => x && x.name === name); return e && e.value != null ? String(e.value) : ""; };

/** TCGCSV product → the app's catalog entry; null for things the app never lists. */
export function csvToProduct(p, set) {
  if (!p || p.productId == null) return null;
  const nu = ext(p, "Number");
  let n = String(p.name || p.cleanName || "Unknown");
  if (nu) n = n.split(" - " + nu).join("").trim() || n;          // "Gengar ex - 154/128" → "Gengar ex"
  const out = { i: p.productId, n, s: set.name || "", sid: set.id, nu, r: ext(p, "Rarity"), g: p.imageUrl || "", cat: set.cat, x: 1 };
  return productKind(out) === "code" ? null : out;
}
/** TCGCSV price rows → { pid: { variant: { low, market, mid, high } } } */
export function csvPrices(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r || r.productId == null) continue;
    const o = { low: r.lowPrice ?? null, market: r.marketPrice ?? null, mid: r.midPrice ?? null, high: r.highPrice ?? null };
    if (o.low == null && o.market == null) continue;
    (out[String(r.productId)] ||= {})[r.subTypeName || "Normal"] = o;
  }
  return out;
}
/** The products of one set that TCGplayer lists and `have` (a Set of string ids) lacks. */
export function findGaps(have, csvProducts, set, prices = {}) {
  const out = [];
  for (const p of csvProducts || []) {
    if (!p || p.productId == null || have.has(String(p.productId))) continue;
    const c = csvToProduct(p, set); if (!c) continue;
    if (prices[String(c.i)]) c.fp = prices[String(c.i)];
    out.push(c);
  }
  return out;
}
/** Overlay the build-time prices of filled products onto a live pricing response (live always wins). */
export function withFillPrices(prices, products) {
  let out = prices;
  for (const c of products || []) {
    if (!c.fp || (prices && prices[String(c.i)])) continue;
    if (out === prices) out = { ...(prices || {}) };
    out[String(c.i)] = { tcg: c.fp };
  }
  return out;
}
/**
 * The running record of what is being filled: { pid: { sid, set, n, nu, since } }
 * plus a log of products TCGTracking has since picked up.
 * → { open, caughtUp: [{ pid, …, since, on }], fresh: [pid] }
 */
export function trackFill(prev, filled, haveAll, day) {
  const open = {}, caughtUp = [], fresh = [];
  const was = (prev && prev.open) || {};
  for (const c of filled) {
    const id = String(c.i);
    open[id] = was[id] || { sid: String(c.sid), set: c.s, n: c.n, nu: c.nu, since: day };
    if (!was[id]) fresh.push(id);
  }
  for (const id in was) if (!open[id] && haveAll.has(id)) caughtUp.push({ pid: id, ...was[id], on: day });
  const log = ((prev && prev.caughtUp) || []).concat(caughtUp).slice(-500);
  return { format: 1, day, open, caughtUp: log, fresh, newlyCaughtUp: caughtUp };
}
