// Collection: owned products by value, Cards / Sealed, sort + filters, "show more".
import { I } from "../icons.js";
import { esc, money, delegate, imgTag, imgUrl, relTime, displayName, $ } from "../dom.js";
import { ownedTotal, productValue, totalWorth } from "../../collection.js";
import { applyFilters, applySort, activeCount, sortHtml, filtersHtml, filterActions, raritiesOf, setsOf, SORTS } from "../filters.js";
import { mountSheet } from "../sheet.js";
import { CAT_JP } from "../../constants.js";

export function mount(root, ctx) {
  const { state, store } = ctx;
  const f = state.ui.col;
  let seg = "cards", sheet = null, setQ = "";
  root.innerHTML = `<div class="topbar"><h1>Collection</h1></div><div class="seg" data-region="seg"></div><div class="card summary" data-region="sum"></div><div class="sec" data-region="head"></div><div class="stack" data-region="list"></div>`;
  const ownedList = () => Object.keys(state.owned).map((pid) => state.byId.get(pid)).filter(Boolean);
  function paint() {
    const all = ownedList(), cards = all.filter((c) => !c.sealed), sealed = all.filter((c) => c.sealed);
    $("[data-region=seg]", root).innerHTML = `<button class="${seg === "cards" ? "on" : ""}" data-action="seg" data-seg="cards">Cards · ${cards.length}</button><button class="${seg === "sealed" ? "on" : ""}" data-action="seg" data-seg="sealed">Sealed · ${sealed.length}</button>`;
    const base = seg === "cards" ? cards : sealed;
    const val = base.reduce((a, c) => a + productValue(state.owned, state.flatPrices, c.i), 0);
    const sets = new Set(base.map((c) => String(c.sid)));
    $("[data-region=sum]", root).innerHTML = `<div class="l">${seg === "cards" ? "Card" : "Sealed"} value</div><div class="v num">${money(val)}</div><div class="s">${base.length} ${seg === "cards" ? "cards" : "products"} across ${sets.size} set${sets.size === 1 ? "" : "s"}${state.pricesAt ? " · prices " + relTime(state.pricesAt) : ""}</div>`;
    const list = applySort(applyFilters(base, { ...f, type: "all" }, state), f.sort, state);
    const n = activeCount(f, false);
    $("[data-region=head]", root).innerHTML = `<h2>${seg === "cards" ? "Card" : "Sealed"} values</h2><div class="hdbtns"><button class="iconbtn boxed ${f.sort !== "val-hi" ? "on" : ""}" data-action="sort" aria-label="Sort">${I.sort}</button><button class="iconbtn boxed ${n ? "on" : ""}" data-action="filters" aria-label="Filters">${I.filter}</button></div>`;
    const el = $("[data-region=list]", root);
    if (!all.length) { el.innerHTML = `<div class="card empty"><b>Nothing owned yet.</b><br>Open a set and tap the checks, or use the + on search results.</div>`; return; }
    if (!list.length) { el.innerHTML = `<div class="empty">Nothing matches these filters.</div>`; return; }
    el.innerHTML = list.slice(0, f.shown).map((c) => {
      const o = state.owned[String(c.i)] || {}, qty = ownedTotal(state.owned, c.i);
      const printings = Object.keys(o).map((v) => v + (o[v] > 1 ? " ×" + o[v] : "")).join(", ");
      return `<div class="card crow"><div class="tap" data-action="card" data-pid="${c.i}"><div class="thumb">${imgTag(imgUrl(c), c.n)}</div><div class="info"><div class="nm">${esc(displayName(c))}</div><div class="meta">${esc(c.s)}${c.nu ? " · " + esc(c.nu) : ""}${c.cat === CAT_JP ? " · JP" : ""} · ${esc(printings)}</div></div></div><div class="val"><b class="num">${money(productValue(state.owned, state.flatPrices, c.i))}</b><span class="num">${qty} owned</span></div></div>`;
    }).join("") + (list.length > f.shown ? `<button class="btn ghost" data-action="more">Show more · ${list.length - f.shown} left</button>` : "");
  }
  function openSheet(name) {
    if (sheet) sheet.unmount(); sheet = null;
    if (!name) return;
    const base = ownedList().filter((c) => (seg === "cards") !== !!c.sealed);
    const opts = () => ({ rarities: raritiesOf(base), sets: setsOf(base, state.bySet), hasType: false, setQuery: setQ });
    const html = () => name === "sort" ? sortHtml(f, Object.keys(SORTS).filter((k) => k !== "best")) : filtersHtml(f, opts());
    const onChange = (close) => { f.shown = 30; paint(); if (close) ctx.back(); else { sheet.repaint(html()); wire(); } };
    sheet = mountSheet($("#sheets2"), ctx, { title: name === "sort" ? "Sort" : "Filters", html: html(), actions: filterActions(f, onChange, false) });
    const wire = () => { const i = $("[data-region=setq]", sheet.host); if (!i) return; i.addEventListener("input", () => { setQ = i.value; sheet.repaint(html()); const ni = $("[data-region=setq]", sheet.host); ni.focus(); ni.setSelectionRange(setQ.length, setQ.length); wire(); }); };
    wire();
  }
  const off = delegate(root, {
    seg: (el) => { seg = el.dataset.seg; f.shown = 30; paint(); },
    card: (el) => ctx.openCard(el.dataset.pid),
    more: () => { f.shown += 30; paint(); },
    sort: () => ctx.router.setQuery({ sheet: "sort" }, { replace: false }),
    filters: () => ctx.router.setQuery({ sheet: "filters" }, { replace: false }),
  });
  paint();
  return { route: (r) => openSheet(r.query.sheet), update: (changed) => { if (changed.has("owned") || changed.has("flatPrices")) paint(); }, unmount: () => { off(); if (sheet) sheet.unmount(); } };
}
