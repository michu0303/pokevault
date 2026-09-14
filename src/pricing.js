// Price normalisation. flatPrices: { pid: { variantName: price } }. Pure.
import { patternOf, variantRank } from "./catalog.js";

/** API /pricing response → { pid: { variant: price } }.
 *  Prefers variants that actually have a price (drops empty catalog subtypes);
 *  if none are priced keeps them all so nothing is lost; falls back to a
 *  manapool number as "Default". */
export function flattenPricing(prices) {
  const out = {};
  for (const pid in prices) {
    const tcg = (prices[pid] && prices[pid].tcg) || {};
    const all = {}, priced = {};
    for (const v in tcg) {
      const o = tcg[v];
      if (o && typeof o === "object") {
        const px = o.market != null ? o.market : (o.low != null ? o.low : null);
        all[v] = px;
        if (px != null) priced[v] = px;
      }
    }
    let vp = Object.keys(priced).length ? priced : all;
    const mp = prices[pid] && prices[pid].manapool;
    if (!Object.keys(vp).length && mp) { for (const k in mp) { if (typeof mp[k] === "number") { vp = { Default: mp[k] }; break; } } }
    if (Object.keys(vp).length) out[String(pid)] = vp;
  }
  return out;
}

/** Pattern-reverse sets: once a card group contains a pattern product, the
 *  base product's own "Reverse Holofoil" is the price API double-counting
 *  the same printing — drop it. Trainers (no pattern siblings) are untouched. */
export function dropPatternReverseDupes(flat, setGroup) {
  if (!setGroup) return flat;
  for (const grp of setGroup.groups) {
    if (!grp.products.some((p) => patternOf(p.n))) continue;
    for (const p of grp.products) {
      if (patternOf(p.n)) continue;
      const fp = flat[String(p.i)];
      if (!fp) continue;
      const ks = Object.keys(fp);
      if (ks.some((k) => !/reverse/i.test(k)))
        for (const k of ks) if (/^\s*reverse\s*holo/i.test(k)) delete fp[k];
    }
  }
  return flat;
}

/** Merge one set's pricing response into flatPrices (mutates + returns it). */
export function applySetPricing(flatPrices, prices, setGroup) {
  Object.assign(flatPrices, flattenPricing(prices));
  return dropPatternReverseDupes(flatPrices, setGroup);
}

/** ordered printings of a product. With no prices yet (offline, first open)
 *  fall back to the printings you already own so checks still show, then "Default". */
export function variantsFor(flatPrices, pid, owned) {
  const vp = flatPrices[String(pid)];
  let ks = vp ? Object.keys(vp) : [];
  if (!ks.length && owned && owned[String(pid)]) ks = Object.keys(owned[String(pid)]);
  if (!ks.length) return ["Default"];
  return ks.slice().sort((a, b) => variantRank(a) - variantRank(b) || a.localeCompare(b));
}
export function primaryVariant(flatPrices, pid, owned) {
  const vs = variantsFor(flatPrices, pid, owned);
  return vs.find((v) => !/reverse/i.test(v)) || vs[0];
}
export function priceOf(flatPrices, pid, variant) {
  const vp = flatPrices[String(pid)];
  if (!vp) return null;
  return vp[variant] != null ? vp[variant] : null;
}
/** low / market for one printing from a raw set pricing response (session cache) */
export function priceDetail(rawSetPrices, pid, variant) {
  const t = rawSetPrices && rawSetPrices[String(pid)] && rawSetPrices[String(pid)].tcg;
  const o = t && t[variant];
  return o && typeof o === "object" ? { low: o.low != null ? o.low : null, market: o.market != null ? o.market : null, mid: o.mid != null ? o.mid : null, high: o.high != null ? o.high : null } : null;
}
/** keep only the prices for products we care about (owned + wishlisted) */
export function prunePrices(flatPrices, owned, wishlist) {
  const sub = {};
  for (const pid of new Set([...Object.keys(owned), ...Object.keys(wishlist)])) if (flatPrices[pid]) sub[pid] = flatPrices[pid];
  return sub;
}
