// Set detail: progress, filters, list view (44px printing checks) and the
// 3×3 binder. View state lives in the route query so back/forward work.
import { I } from "../icons.js";
import { esc, money, delegate, progressRing, haptic, imgTag, imgUrl, displayName, $ } from "../dom.js";
import { setStats, groupState, ownState, getQty, setQty, ownedTotal, isTracked, toggleSetStar } from "../../collection.js";
import { groupPrintings, isChaseRarity } from "../../catalog.js";
import { variantsFor, priceOf, primaryVariant } from "../../pricing.js";
import { CAT_JP } from "../../constants.js";

const PAGE = 9;
export function mount(root, ctx) {
  const { state, store, app } = ctx;
  const sid = String(ctx.route.parts[1] || "");
  const g = state.bySet.get(sid);
  if (!g) { root.innerHTML = `<div class="topbar tight"><button class="iconbtn back" data-action="back">${I.back}</button><h1 class="sm">Set</h1></div><div class="empty">This set isn't in the local catalog.</div>`; delegate(root, { back: () => ctx.back() }); return {}; }
  let route = ctx.route;
  const qv = () => ({ view: route.query.view || (state.prefs.binder ? "binder" : "list"), f: route.query.f || "all", r: route.query.r || "", sec: route.query.sec || "cards", page: Math.max(0, parseInt(route.query.page || "0", 10) || 0) });
  let pricesLoading = !state.priceCache[sid];
  // Black Bolt / White Flare: the user collects only the IR / SIR chase from these two English sets
  const restricted = g.cat !== CAT_JP && /black bolt|white flare/i.test(g.name);
  const vf = (pid) => variantsFor(state.flatPrices, pid, state.owned);

  root.innerHTML = `
    <div class="topbar tight sticky"><button class="iconbtn back" data-action="back" aria-label="Back">${I.back}</button><h1 class="sm">${esc(g.name)}</h1><button class="iconbtn star" data-action="star" aria-label="Track set"></button></div>
    <div class="card prog" data-region="prog"></div>
    ${g.sealed.length ? `<div class="seg secseg" data-region="secseg"></div>` : ""}
    <div class="filtrow sticky below" data-region="filters"></div>
    <div data-region="body"></div>`;

  function groups() {
    let all = g.groups;
    if (restricted) all = all.filter((grp) => grp.products.some((p) => /illustration rare/i.test(p.r)));
    const { r, f } = qv();
    if (r) all = all.filter((grp) => grp.products.some((p) => (p.r || "") === r));
    const og = (grp) => groupState(state.owned, state.flatPrices, grp) === "complete";
    if (f === "owned") all = all.filter(og); else if (f === "missing") all = all.filter((grp) => !og(grp));
    return all;
  }
  function paintProg() {
    const { sec } = qv();
    const st = setStats({ ...g, groups: restricted ? g.groups.filter((grp) => grp.products.some((p) => /illustration rare/i.test(p.r))) : g.groups }, state.owned, state.flatPrices);
    const total = sec === "sealed" ? st.sealedTotal : st.total, done = sec === "sealed" ? st.sealedOwned : st.complete;
    const pct = total ? done / total : 0;
    const partial = sec === "sealed" ? 0 : g.groups.filter((grp) => groupState(state.owned, state.flatPrices, grp) === "partial").length;
    $("[data-region=prog]", root).innerHTML = `<div class="ring">${progressRing(pct)}<b class="num">${Math.round(pct * 100)}%</b></div>
      <div class="pi"><div class="pt num">${done} / ${total} ${sec === "sealed" ? "sealed" : "cards"}</div><div class="ps num">${total - done} missing${partial ? " · " + partial + " partial" : ""}</div><div class="pv num">${money(sec === "sealed" ? st.sealedVal : st.value)} collected${pricesLoading ? " · loading prices…" : ""}</div></div>
`;
    const tracked = isTracked(state, sid);
    const star = $("[data-action=star]", root); star.innerHTML = tracked ? I.star : I.starO; star.style.color = tracked ? "var(--gold)" : "";
  }
  function paintFilters() {
    const { view, f, r, sec } = qv();
    const ss = $("[data-region=secseg]", root);
    if (ss) ss.innerHTML = `<button class="${sec !== "sealed" ? "on" : ""}" data-action="sec" data-sec="cards">Cards · ${g.groups.length}</button><button class="${sec === "sealed" ? "on" : ""}" data-action="sec" data-sec="sealed">Sealed · ${g.sealed.length}</button>`;
    if (sec === "sealed") { $("[data-region=filters]", root).innerHTML = ""; return; }
    const rars = [...new Set(g.cards.map((p) => p.r).filter(Boolean))].sort();
    $("[data-region=filters]", root).innerHTML = `<div class="chips">
        ${[["all", "All"], ["owned", "Owned"], ["missing", "Missing"]].map(([k, l]) => `<button class="chip ${f === k ? "on" : ""}" data-action="f" data-f="${k}">${l}</button>`).join("")}
        <span class="chip dd fdrop">${esc(r || "All rarities")} ${I.chevD}<select data-action="rarity" aria-label="Rarity"><option value="">All rarities</option>${rars.map((x) => `<option ${x === r ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></span>
      </div>
      <div class="seg compact icons"><button class="${view === "list" ? "on" : ""}" data-action="view" data-view="list" aria-label="List">${I.list}</button><button class="${view === "binder" ? "on" : ""}" data-action="view" data-view="binder" aria-label="Binder">${I.grid}</button></div>`;
    $("select", root).addEventListener("change", (e) => ctx.router.setQuery({ r: e.target.value, page: "" }));
  }
  const badge = (grp) => { const s = groupState(state.owned, state.flatPrices, grp); return `<span class="badge ${s === "complete" ? "full" : s === "partial" ? "part" : ""}">${s === "complete" ? I.check : s === "partial" ? I.dash : I.plus}</span>`; };
  function paintBody() {
    const { view, sec, page } = qv();
    const body = $("[data-region=body]", root);
    if (sec === "sealed") {
      body.innerHTML = `<div class="stack group">${g.sealed.map((p) => { const q = ownedTotal(state.owned, p.i), v = vf(p.i)[0], px = priceOf(state.flatPrices, p.i, v);
        return `<div class="card crow"><div class="tap" data-action="card" data-pid="${p.i}"><div class="thumb">${imgTag(imgUrl(p), p.n)}</div><div class="info"><div class="nm">${esc(displayName(p))}</div><div class="meta num">${px != null ? money(px) + " each" : "price unavailable"}</div></div></div>
          <div class="stepper"><button data-action="dec" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Remove one">−</button><span class="q num">${q}</span><button data-action="inc" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Add one">+</button></div></div>`; }).join("") || `<div class="empty">No sealed products in this set.</div>`}</div>`;
      return;
    }
    const grs = groups();
    if (!grs.length) { body.innerHTML = `<div class="empty">${qv().f === "owned" ? "Nothing complete here yet." : qv().f === "missing" ? "<b>Set complete!</b> Nothing missing." : "No cards match."}</div>`; return; }
    if (view === "list") {
      body.innerHTML = `<div class="stack group">${grs.map((grp) => {
        const base = grp.products[0], chase = grp.products.some((p) => isChaseRarity(p.r));
        const printings = groupPrintings(grp, vf);
        const togs = chase
          ? grp.products.map((p) => { const v = vf(p.i)[0], q = getQty(state.owned, p.i, v); return `<div class="stepper"><button data-action="dec" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Remove one">−</button><span class="q num">${q}</span><button data-action="inc" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Add one">+</button></div>`; }).join("")
          : printings.map((pr) => { const on = getQty(state.owned, pr.pid, pr.variant) > 0; return `<button class="vtog ${on ? "on" : ""}" data-action="tog" data-pid="${pr.pid}" data-v="${esc(pr.variant)}" aria-label="${esc(pr.label)} ${on ? "owned" : "not owned"}"><span class="c">${on ? I.check : ""}</span><span class="l">${esc(pr.label.replace(/^Master Ball$/, "Master"))}</span></button>`; }).join("");
        const bp = priceOf(state.flatPrices, base.i, primaryVariant(state.flatPrices, base.i, state.owned));
        return `<div class="card lrow"><div class="tap" data-action="card" data-pid="${base.i}"><div class="thumb">${imgTag(imgUrl(base), grp.name)}</div><div class="info"><div class="nm">${esc(grp.name)}</div><div class="meta">#${esc(grp.number || "—")}${base.r ? " · " + esc(base.r) : ""}${bp != null ? ` · <b class="num" data-price="${base.i}">${money(bp)}</b>` : `<b class="num" data-price="${base.i}"></b>`}</div></div></div><div class="togs">${togs}</div></div>`;
      }).join("")}</div>`;
      return;
    }
    const pages = Math.max(1, Math.ceil(grs.length / PAGE)), pg = Math.min(page, pages - 1);
    const slice = grs.slice(pg * PAGE, pg * PAGE + PAGE);
    body.innerHTML = `<div class="binder" data-region="binder">${slice.map((grp) => { const base = grp.products[0], st = groupState(state.owned, state.flatPrices, grp);
        const bp = priceOf(state.flatPrices, base.i, primaryVariant(state.flatPrices, base.i, state.owned));
        return `<div class="pocket ${st === "none" ? "miss" : ""}" data-action="card" data-pid="${base.i}">${imgTag(imgUrl(base), grp.name)}<span class="pno">${esc(grp.number || "")}</span>${bp != null ? `<span class="pp num">${money(bp)}</span>` : ""}${badge(grp)}</div>`; }).join("")}</div>
      <div class="pager"><button class="iconbtn" data-action="page" data-d="-1" ${pg === 0 ? "disabled" : ""} aria-label="Previous page">${I.back}</button><div class="pagerc"><span class="pg num">Page ${pg + 1} of ${pages}</span><div class="dots">${Array.from({ length: Math.min(pages, 7) }, (_, i) => `<i class="${i === Math.min(pg, 6) ? "on" : ""}"></i>`).join("")}</div></div><button class="iconbtn" data-action="page" data-d="1" ${pg >= pages - 1 ? "disabled" : ""} aria-label="Next page">${I.chevR}</button></div>`;
    // swipe between binder pages
    const b = $("[data-region=binder]", root); let x0 = null;
    b.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    b.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) flip(dx < 0 ? 1 : -1); }, { passive: true });
  }
  function flip(d) { const { page } = qv(); const pages = Math.max(1, Math.ceil(groups().length / PAGE)); const np = Math.max(0, Math.min(pages - 1, page + d)); if (np !== page) { ctx.router.setQuery({ page: np ? String(np) : "" }); } }
  function paint() { paintProg(); paintFilters(); paintBody(); }
  /** ownership changed: patch checks, steppers and badges in place (no image reloads, no lost scroll) */
  function patchOwned() {
    for (const b of root.querySelectorAll(".vtog")) { const on = getQty(state.owned, b.dataset.pid, b.dataset.v) > 0; b.classList.toggle("on", on); $(".c", b).innerHTML = on ? I.check : ""; }
    for (const st of root.querySelectorAll(".stepper")) { const btn = $("[data-action=inc]", st); if (btn) $(".q", st).textContent = getQty(state.owned, btn.dataset.pid, btn.dataset.v); }
    const { f, view } = qv();
    if (view === "binder" || f !== "all") { paintBody(); return; }
  }
  const setq = (pid, v, q) => { haptic(); store.update((s) => setQty(s.owned, pid, v, q), "owned"); };
  const off = delegate(root, {
    back: () => ctx.back(),
    star: () => { haptic(); store.update((s) => toggleSetStar(s, sid), "tracked", "favorites"); ctx.toast(isTracked(state, sid) ? "Tracking " + g.name : "Untracked"); },
    sec: (el) => ctx.router.setQuery({ sec: el.dataset.sec === "cards" ? "" : "sealed", page: "" }),
    f: (el) => ctx.router.setQuery({ f: el.dataset.f === "all" ? "" : el.dataset.f, page: "" }),
    view: (el) => { ctx.router.setQuery({ view: el.dataset.view }); store.update((s) => { s.prefs.binder = el.dataset.view === "binder"; }, "prefs"); },
    page: (el) => flip(+el.dataset.d),
    card: (el) => ctx.openCard(el.dataset.pid),
    tog: (el) => setq(el.dataset.pid, el.dataset.v, getQty(state.owned, el.dataset.pid, el.dataset.v) > 0 ? 0 : 1),
    inc: (el) => setq(el.dataset.pid, el.dataset.v, getQty(state.owned, el.dataset.pid, el.dataset.v) + 1),
    dec: (el) => setq(el.dataset.pid, el.dataset.v, getQty(state.owned, el.dataset.pid, el.dataset.v) - 1),
  });
  paint();
  if (pricesLoading) app.loadSetPricing(sid).catch(() => ctx.toast("Couldn’t load prices — showing cached values")).finally(() => { pricesLoading = false; paint(); });
  return {
    route: (r) => { route = r; paint(); window.scrollTo(0, 0); },
    update: (changed) => {
      if (changed.has("flatPrices")) { paintProg(); paintBody(); return; }
      if (changed.has("owned")) { paintProg(); patchOwned(); }
      if (changed.has("tracked")) paintProg();
    },
    unmount: off,
  };
}
