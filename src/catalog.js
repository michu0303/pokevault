// Catalog model: normalising API products, sealed detection, card grouping,
// variant ordering and rarity classes. Pure — no DOM, no storage.
import { SEALED_RE, CHASE_RE, HIVALUE_RE, CAT } from "./constants.js";
import { cleanName, cmpNum } from "./util.js";

export function looksSealed(name) { return SEALED_RE.test(name || ""); }
/** The API gives every real card a rarity and leaves sealed products without
 *  one, so a non-empty rarity overrides the name regex ("Iron Bundle"). */
export function isSealedProduct(p) { return !p.r && looksSealed(p.n); }

/** In pattern-reverse sets the patterned reverses are their own products,
 *  "… (Poke Ball Pattern)" / "… (Energy Symbol Pattern)". Returns a short
 *  label for such a product, "" for a base card. */
export function patternOf(name) {
  const m = String(name || "").match(/\(([^()]*)\)\s*$/);
  if (!m) return "";
  if (/energy/i.test(m[1])) return "Energy";
  const b = m[1].match(/([A-Za-z]+)\s*ball\b/i);
  if (b) { const w = /^poke$/i.test(b[1]) ? "Poké" : b[1].charAt(0).toUpperCase() + b[1].slice(1).toLowerCase(); return w + " Ball"; }
  return "";
}
/** sort key inside a card group — base card, then Energy, then Ball patterns */
export function patSort(name) {
  const x = patternOf(name);
  return !x ? 0 : /energy/i.test(x) ? 1 : /master/i.test(x) ? 3 : 2;
}

/** API product → compact catalog entry (the shape stored in IndexedDB) */
export function normalizeProduct(p, set) {
  return {
    i: p.id, n: p.name || p.clean_name || "Unknown", s: p.set_name || set.name || "",
    sid: set.id, nu: p.number || "", r: p.rarity || "", g: p.image_url || p.image || "", cat: set.cat || CAT,
  };
}

/**
 * Index a catalog: annotates each entry (sealed flag + cached lowercase search
 * fields) and returns { byId, bySet }. Both maps are keyed by STRING ids.
 * bySet value: { name, cat, cards, sealed, groups }, where groups are cards
 * sharing a collector number (finish / pattern variants of one card).
 */
export function indexCatalog(catalog) {
  const byId = new Map(), bySet = new Map();
  for (const c of catalog) {
    c.sealed = isSealedProduct(c);
    c._nameLow = (c.n || "").toLowerCase();
    c._setLow = (c.s || "").toLowerCase();
    c._nuLow = String(c.nu || "").toLowerCase();
    c._hay = c._nameLow + " " + c._setLow + " " + c._nuLow;
    c._nameWords = c._nameLow.split(/\s+/);
    byId.set(String(c.i), c);
    const sid = String(c.sid);
    let g = bySet.get(sid);
    if (!g) { g = { sid, name: c.s || ("Set " + sid), cat: c.cat || CAT, cards: [], sealed: [], groups: [] }; bySet.set(sid, g); }
    if (c.s && !g.name) g.name = c.s;
    (c.sealed ? g.sealed : g.cards).push(c);
  }
  for (const g of bySet.values()) {
    const map = new Map();
    for (const c of g.cards) {
      const num = String(c.nu || "").trim();
      const key = num ? ("#" + num) : ("solo:" + c.i);
      let grp = map.get(key);
      if (!grp) { grp = { key, number: num, name: "", products: [] }; map.set(key, grp); g.groups.push(grp); }
      grp.products.push(c);
    }
    for (const grp of g.groups) {
      let base = grp.products[0];
      for (const p of grp.products) if (String(p.n || "").length < String(base.n || "").length) base = p;
      grp.name = cleanName(base.n) || base.n || ("Card " + (grp.number || ""));
      grp.products.sort((a, b) => patSort(a.n) - patSort(b.n));
    }
    g.groups.sort((a, b) => cmpNum(a.number, b.number));
  }
  return { byId, bySet };
}

/** display order: Normal, Holo, Reverse Holo, Energy, Poké Ball, Master Ball, other */
export function variantRank(v) {
  const s = String(v || "").toLowerCase();
  if (/master\s?ball/.test(s)) return 6;
  if (/pok[eé]\s?ball/.test(s)) return 5;
  if (/energy/.test(s)) return 4;
  if (/reverse/.test(s)) return 3;
  if (/normal/.test(s)) return 0;
  if (/holo|foil/.test(s)) return 1;
  return 7;
}
export function shortVariant(v) {
  const s = String(v || "");
  if (/reverse/i.test(s)) return "Reverse";
  if (/^normal$/i.test(s) || /^default$/i.test(s)) return "Normal";
  if (/master\s*ball/i.test(s)) return "Master";
  if (/pok[eé]\s*ball/i.test(s)) return "Poké Ball";
  if (/holo/i.test(s)) return "Holo";
  if (/energy/i.test(s)) return "Energy";
  return s.length > 9 ? s.slice(0, 9) : s;
}
export function isChaseRarity(r) { return CHASE_RE.test(String(r || "")); }
export function isHighValueRarity(r) { return HIVALUE_RE.test(String(r || "")); }

/** Flatten a card group into its (product, variant) printings.
 *  variantsFor: pid → ordered variant names (see pricing.js). */
export function groupPrintings(grp, variantsFor) {
  const out = [];
  for (const p of grp.products) {
    const pat = patternOf(p.n);
    for (const v of variantsFor(p.i)) out.push({ pid: p.i, variant: v, label: pat || shortVariant(v) });
  }
  return out;
}

export function findGroup(bySet, sid, key) {
  const g = bySet.get(String(sid));
  return g ? g.groups.find((x) => x.key === key) || null : null;
}
export function allSetsSorted(bySet) {
  return Array.from(bySet.values()).map((g) => ({ sid: g.sid, name: g.name, cat: g.cat })).sort((a, b) => a.name.localeCompare(b.name));
}
/** newest sets by release date when known, else by numeric id (release-order proxy) */
export function newestSets(bySet, setDates, n = 10) {
  return Array.from(bySet.values()).map((g) => ({ sid: g.sid, name: g.name, cat: g.cat, date: setDates[g.sid] || "" }))
    .sort((a, b) => (b.date.localeCompare(a.date)) || ((+b.sid || 0) - (+a.sid || 0)))
    .slice(0, n);
}
