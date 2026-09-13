// Shared sort / filter logic + sheet markup for Search, Collection, Wishlist.
import { I } from "./icons.js";
import { esc, $ } from "./dom.js";
import { CAT_JP } from "../constants.js";
import { isHighValueRarity } from "../catalog.js";
import { productValue } from "../collection.js";
import { variantsFor, priceOf, primaryVariant } from "../pricing.js";

export const SORTS = { best: "Best match", "val-hi": "Value · high to low", "val-lo": "Value · low to high", name: "Name · A to Z", lang: "Language · English first", "date-new": "Release · newest", "date-old": "Release · oldest" };
export const LANGS = [["all", "All"], ["en", "English"], ["jp", "Japanese"]];

/** value used for sorting a catalog entry: owned value, else primary printing price */
export function cardValue(c, state) {
  const owned = productValue(state.owned, state.flatPrices, c.i);
  if (owned > 0) return owned;
  return priceOf(state.flatPrices, c.i, primaryVariant(state.flatPrices, c.i)) || 0;
}
export function applyFilters(list, f, state) {
  return list.filter((c) => {
    if (f.type === "cards" && c.sealed) return false;
    if (f.type === "sealed" && !c.sealed) return false;
    if (f.lang === "en" && c.cat === CAT_JP) return false;
    if (f.lang === "jp" && c.cat !== CAT_JP) return false;
    if (f.rarity && f.rarity.length && !f.rarity.includes(c.r || "")) return false;
    if (f.set && f.set.length && !f.set.includes(String(c.sid))) return false;
    return true;
  });
}
export function applySort(list, sort, state) {
  const d = (c) => state.setDates[String(c.sid)] || "";
  const by = {
    "val-hi": (a, b) => cardValue(b, state) - cardValue(a, state),
    "val-lo": (a, b) => cardValue(a, state) - cardValue(b, state),
    name: (a, b) => (a.n || "").localeCompare(b.n || ""),
    lang: (a, b) => ((a.cat === CAT_JP) - (b.cat === CAT_JP)) || (a.n || "").localeCompare(b.n || ""),
    "date-new": (a, b) => d(b).localeCompare(d(a)) || (a.n || "").localeCompare(b.n || ""),
    "date-old": (a, b) => d(a).localeCompare(d(b)) || (a.n || "").localeCompare(b.n || ""),
  }[sort];
  return by ? list.slice().sort(by) : list;
}
export function activeCount(f, hasType = true) { return (hasType && f.type !== "all" ? 1 : 0) + (f.lang !== "all" ? 1 : 0) + (f.rarity.length ? 1 : 0) + (f.set.length ? 1 : 0); }

/** sort sheet body */
export function sortHtml(f, keys) {
  return `<div class="stack">${keys.map((k) => `<button class="card vrow toggle ${f.sort === k ? "has" : ""}" data-action="sort" data-v="${k}"><div class="vi"><div class="vn">${SORTS[k]}</div></div><span class="vcheck"><i>${f.sort === k ? I.check : ""}</i></span></button>`).join("")}</div>`;
}
/** filters sheet body; `rarities` and `sets` are the options for this context */
export function filtersHtml(f, { rarities, sets, hasType = true, setQuery = "" }) {
  const chip = (act, v, cur, l) => `<button class="chip ${cur === v ? "on" : ""}" data-action="${act}" data-v="${v}">${l}</button>`;
  const ql = setQuery.trim().toLowerCase();
  const setList = sets.filter((s) => !ql || s.name.toLowerCase().includes(ql)).slice(0, 60);
  return `
    ${hasType ? `<div class="sec"><h2>Type</h2></div><div class="chips">${chip("type", "all", f.type, "All")}${chip("type", "cards", f.type, "Cards")}${chip("type", "sealed", f.type, "Sealed")}</div>` : ""}
    <div class="sec"><h2>Language</h2></div><div class="chips">${LANGS.map(([v, l]) => chip("lang", v, f.lang, l)).join("")}</div>
    <div class="sec"><h2>Rarity</h2>${f.rarity.length ? `<button class="more" data-action="clear-rarity">Clear</button>` : ""}</div>
    <div class="chips" style="flex-wrap:wrap">${rarities.map((r) => `<button class="chip ${f.rarity.includes(r) ? "on" : ""}" data-action="rarity" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>
    <div class="sec"><h2>Set</h2>${f.set.length ? `<button class="more" data-action="clear-set">Clear ${f.set.length}</button>` : ""}</div>
    <label class="search" style="height:44px">${I.search}<input data-region="setq" placeholder="Find a set…" value="${esc(setQuery)}" autocomplete="off"></label>
    <div class="stack">${setList.map((s) => `<button class="card vrow toggle ${f.set.includes(String(s.sid)) ? "has" : ""}" data-action="set" data-v="${esc(s.sid)}" style="min-height:48px"><div class="vi"><div class="vn" style="font-size:13px">${esc(s.name)}</div></div><span class="vcheck"><i>${f.set.includes(String(s.sid)) ? I.check : ""}</i></span></button>`).join("") || `<div class="empty">No sets match.</div>`}</div>
    <button class="btn ghost" data-action="reset">Reset filters</button>`;
}
/** wire the filters sheet: mutates f, then calls onChange() */
export function filterActions(f, onChange, hasType = true) {
  const tog = (arr, v) => { const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); };
  return {
    type: (el) => { f.type = el.dataset.v; onChange(); },
    lang: (el) => { f.lang = el.dataset.v; onChange(); },
    rarity: (el) => { tog(f.rarity, el.dataset.v); onChange(); },
    set: (el) => { tog(f.set, el.dataset.v); onChange(); },
    "clear-rarity": () => { f.rarity = []; onChange(); },
    "clear-set": () => { f.set = []; onChange(); },
    reset: () => { if (hasType) f.type = "all"; f.lang = "all"; f.rarity = []; f.set = []; onChange(); },
    sort: (el) => { f.sort = el.dataset.v; onChange(true); },
  };
}
export const raritiesOf = (list) => [...new Set(list.map((c) => c.r).filter(Boolean))].sort();
export const setsOf = (list, bySet) => { const m = new Map(); for (const c of list) if (!m.has(String(c.sid))) m.set(String(c.sid), { sid: String(c.sid), name: (bySet.get(String(c.sid)) || {}).name || c.s }); return [...m.values()].sort((a, b) => a.name.localeCompare(b.name)); };
