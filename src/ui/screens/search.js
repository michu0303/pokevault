// Search: relevance-ranked results, recent searches, sort + filter sheets,
// corner quick-own on tiles. Results are "plain" — no ownership greying.
import { I } from "../icons.js";
import { esc, money, delegate, imgTag, imgUrl, haptic, displayName, longPress, $ } from "../dom.js";
import { searchCatalog } from "../../search.js";
import { ownState, quickToggle, toggleWish, isWished } from "../../collection.js";
import { priceOf, primaryVariant } from "../../pricing.js";
import { applyFilters, applySort, activeCount, sortHtml, filtersHtml, filterActions, raritiesOf, setsOf, SORTS } from "../filters.js";
import { mountSheet } from "../sheet.js";
import { CAT_JP } from "../../constants.js";

export function mount(root, ctx) {
  const { state, store, app } = ctx;
  const f = state.ui.search;
  let results = [], timer = null, sheet = null, setQ = "";
  root.innerHTML = `
    <div class="topbar"><h1>Search</h1></div>
    <div class="sticky"><label class="search">${I.search}<input type="search" placeholder="Card name, set or number…" autocomplete="off" autocorrect="off" spellcheck="false" value="${esc(f.term)}"><button class="clear ${f.term ? "" : "hidden"}" data-action="clear">Clear</button></label>
    <div class="sec" data-region="head"></div></div>
    <div data-region="recent"></div>
    <div data-region="results"></div>`;
  const input = $("input", root);
  let warmToken = 0;
  /** fetch prices for the sets of the first results so tiles show real numbers */
  async function warmPrices(list) {
    const token = ++warmToken;
    const sids = [...new Set(list.slice(0, 36).map((c) => String(c.sid)))].filter((sid) => !state.priceCache[sid]).slice(0, 6);
    for (const sid of sids) { if (token !== warmToken) return; try { await app.loadSetPricing(sid); } catch (e) {} }
  }
  const run = () => { results = f.term.trim() ? searchCatalog(state.catalog, f.term) : []; paint(); if (results.length) warmPrices(applySort(applyFilters(results, f, state), f.sort, state)); };
  function paintRecent() {
    const r = $("[data-region=recent]", root);
    if (f.term.trim() || !state.prefs.recent.length) { r.innerHTML = ""; return; }
    r.innerHTML = `<div class="chips">${state.prefs.recent.map((t) => `<button class="chip" data-action="recent" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
  }
  function paint() {
    paintRecent();
    const head = $("[data-region=head]", root), out = $("[data-region=results]", root);
    $(".clear", root).classList.toggle("hidden", !f.term);
    if (!f.term.trim()) { head.innerHTML = ""; out.innerHTML = state.catalog.length ? `<div class="empty">Search any card by name, its set, or a collector number like <b>RC29</b>.</div>` : `<div class="card empty"><b>No card database yet.</b><br>Download it once from Settings.</div>`; return; }
    const list = applySort(applyFilters(results, f, state), f.sort, state);
    const n = activeCount(f);
    head.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--sec)">${list.length}${results.length >= 240 ? "+" : ""} results · ${SORTS[f.sort]}</span><div class="hdbtns"><button class="iconbtn boxed ${f.sort !== "best" ? "on" : ""}" data-action="sort" aria-label="Sort">${I.sort}</button><button class="iconbtn boxed ${n ? "on" : ""}" data-action="filters" aria-label="Filters">${I.filter}${n ? `<span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:var(--strong)"></span>` : ""}</button></div>`;
    out.innerHTML = list.length ? `<div class="grid3">${list.slice(0, 120).map(tile).join("")}</div>${list.length > 120 ? `<div class="empty">Showing 120 of ${list.length} — refine your search.</div>` : ""}` : `<div class="empty">Nothing matches with these filters.</div>`;
  }
  function tile(c) {
    const pv = primaryVariant(state.flatPrices, c.i), px = priceOf(state.flatPrices, c.i, pv);
    const st = ownState(state.owned, state.flatPrices, c.i);
    return `<div class="tile" data-pid="${c.i}"><div class="art" data-action="card" data-pid="${c.i}">${imgTag(imgUrl(c), c.n)}</div><span class="wl ${isWished(state, c.i) ? "" : "hidden"}" aria-label="On your wishlist">${I.heartF}</span>
      <div class="info"><div class="nm">${esc(displayName(c))}</div><div class="pr num">${px != null ? money(px) : "—"}</div><div class="set">${esc(c.s)}${c.nu ? " · " + esc(c.nu) : ""}${c.cat === CAT_JP ? " · JP" : ""}</div></div>
      <button class="quick ${st !== "none" ? "on" : ""}" data-action="quick" data-pid="${c.i}" aria-label="${st !== "none" ? "Owned — tap to clear" : "Mark owned"}"><i>${st !== "none" ? I.check : I.plus}</i></button></div>`;
  }
  function patchWish() { for (const t of root.querySelectorAll(".tile")) $(".wl", t).classList.toggle("hidden", !isWished(state, t.dataset.pid)); }
  function patchOwned() { for (const b of root.querySelectorAll(".quick")) { const st = ownState(state.owned, state.flatPrices, b.dataset.pid); b.classList.toggle("on", st !== "none"); $("i", b).innerHTML = st !== "none" ? I.check : I.plus; } }
  function patchPrices() { for (const t of root.querySelectorAll(".tile")) { const pid = $(".art", t).dataset.pid; const px = priceOf(state.flatPrices, pid, primaryVariant(state.flatPrices, pid, state.owned)); $(".pr", t).textContent = px != null ? money(px) : "—"; } }
  function remember(t) { t = t.trim(); if (!t) return; store.update((s) => { s.prefs.recent = [t, ...s.prefs.recent.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6); }, "prefs"); }
  longPress(root, ".tile .art", (el) => {
    const c = state.byId.get(el.dataset.pid); if (!c) return;
    haptic(12); store.update((s) => toggleWish(s, c.i), "wishlist", "wishFolders");
    ctx.toast(isWished(state, c.i) ? `${displayName(c)} added to wishlist` : `${displayName(c)} removed from wishlist`);
  });
  input.addEventListener("input", () => { f.term = input.value; clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener("change", () => remember(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { input.blur(); remember(input.value); } });
  function openSheet(name) {
    if (sheet) sheet.unmount(); sheet = null;
    if (!name) return;
    const onChange = (close) => { paint(); if (close) ctx.back(); else sheet.repaint(name === "sort" ? sortHtml(f, Object.keys(SORTS)) : filtersHtml(f, opts())); if (name === "filters") wireSetQ(); };
    const opts = () => ({ rarities: raritiesOf(results), sets: setsOf(results, state.bySet), setQuery: setQ });
    sheet = mountSheet($("#sheets2"), ctx, { title: name === "sort" ? "Sort" : "Filters", html: name === "sort" ? sortHtml(f, Object.keys(SORTS)) : filtersHtml(f, opts()), actions: filterActions(f, onChange) });
    if (name === "filters") wireSetQ();
  }
  function wireSetQ() { const i = $("[data-region=setq]", sheet.host); if (!i) return; i.addEventListener("input", () => { setQ = i.value; const list = $("[data-region=setq]", sheet.host).closest("[data-region=sheetbody]"); sheet.repaint(filtersHtml(f, { rarities: raritiesOf(results), sets: setsOf(results, state.bySet), setQuery: setQ })); const ni = $("[data-region=setq]", sheet.host); ni.focus(); ni.setSelectionRange(setQ.length, setQ.length); wireSetQ(); }); }
  const off = delegate(root, {
    clear: () => { f.term = ""; input.value = ""; run(); input.focus(); },
    recent: (el) => { f.term = el.dataset.v; input.value = f.term; run(); },
    card: (el) => { if (el.dataset.lp) return; ctx.openCard(el.dataset.pid); },
    quick: async (el) => {
      const c = state.byId.get(el.dataset.pid); if (!c) return;
      if (!state.priceCache[String(c.sid)]) { try { await app.loadSetPricing(c.sid); } catch (e) {} }
      haptic();
      const wasOwned = ownState(state.owned, state.flatPrices, c.i) !== "none", before = JSON.stringify(state.owned[String(c.i)] || null);
      let needSheet = false; store.update((s) => { if (!quickToggle(s.owned, s.flatPrices, c.i)) needSheet = true; }, "owned");
      if (needSheet) ctx.openCard(c.i);
      else if (wasOwned) ctx.toast("Removed from your collection", { action: "Undo", onAction: () => store.update((s) => { const o = JSON.parse(before); if (o) s.owned[String(c.i)] = o; }, "owned") });
    },
    sort: () => ctx.router.setQuery({ sheet: "sort" }, { replace: false }),
    filters: () => ctx.router.setQuery({ sheet: "filters" }, { replace: false }),
  });
  run();
  if (!f.term) setTimeout(() => input.focus(), 50);
  return {
    route: (r) => openSheet(r.query.sheet),
    update: (changed) => { if (changed.has("owned")) patchOwned(); if (changed.has("wishlist")) patchWish(); if (changed.has("flatPrices")) { if (f.sort.startsWith("val")) paint(); else patchPrices(); } if (changed.has("prefs")) paintRecent(); },
    unmount: () => { off(); if (sheet) sheet.unmount(); },
  };
}
