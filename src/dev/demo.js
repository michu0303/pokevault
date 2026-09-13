// Demo data for previews: `app.html?demo=1` seeds 90 days of history (a
// random walk that ends at today's real values), tracks a few sets and
// wishlists some chase cards. `?demo=clear` removes the history again.
import { priceOf, primaryVariant } from "../pricing.js";
import { totalWorth, toggleSetStar, toggleCardFolder } from "../collection.js";
import { isChaseRarity } from "../catalog.js";
import { today } from "../util.js";

function walk(end, days, vol, seed) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const out = new Array(days); let v = end;
  for (let i = days - 1; i >= 0; i--) { out[i] = Math.max(0, v); v = v / (1 + (rnd() - 0.48) * vol); }
  return out;
}
export function seedDemo(app) {
  const { state, store } = app;
  const days = 90, d0 = new Date(today() + "T00:00:00Z");
  const date = (i) => { const d = new Date(d0); d.setUTCDate(d.getUTCDate() - (days - 1 - i)); return d.toISOString().slice(0, 10); };
  // wishlist a few chase cards from the newest tracked/owned sets and file them
  const ownedSets = [...new Set(Object.keys(state.owned).map((pid) => String((state.byId.get(pid) || {}).sid)).filter((x) => x !== "undefined"))];
  const pool = ownedSets.flatMap((sid) => (state.bySet.get(sid) || { cards: [] }).cards).filter((c) => isChaseRarity(c.r) && !state.owned[String(c.i)]);
  const picks = pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / 6)) === 0).slice(0, 6);
  store.update((s) => {
    for (const sid of ownedSets.slice(0, 3)) if (!s.tracked[sid]) toggleSetStar(s, sid);
    picks.forEach((c, i) => { s.wishlist[String(c.i)] = 1; const f = s.wishFolders[i % Math.max(1, s.wishFolders.length)]; if (f) toggleCardFolder(s, c.i, f.id); });
  }, "tracked", "favorites", "wishlist", "wishFolders");
  // history: totals + per-card prices
  const total = totalWorth(state.owned, state.flatPrices);
  const totals = walk(total, days, 0.06, 7);
  const ids = [...new Set([...Object.keys(state.owned), ...Object.keys(state.wishlist)])];
  const series = {};
  ids.forEach((pid, i) => { const p = priceOf(state.flatPrices, pid, primaryVariant(state.flatPrices, pid, state.owned)); if (p != null) series[pid] = walk(p, days, 0.09, 11 + i); });
  const h = [];
  for (let i = 0; i < days; i++) {
    const e = { d: date(i), total: Math.round(totals[i] * 100) / 100 };
    if (i >= days - 60) { e.px = {}; e.pv = {}; for (const pid in series) { e.px[pid] = Math.round(series[pid][i] * 100) / 100; const o = state.owned[pid]; if (o) e.pv[pid] = Math.round(Object.values(o).reduce((a, q) => a + q, 0) * series[pid][i] * 100) / 100; } }
    h.push(e);
  }
  store.update((s) => { s.history = h; }, "history");
  return { days, tracked: ownedSets.slice(0, 3).length, wishlisted: picks.length };
}
export function clearDemo(app) { app.store.update((s) => { s.history = []; }, "history"); }
