// Set detail: progress, filters, list view (44px printing checks) and the
// 3×3 binder. View state lives in the route query so back/forward work.
import { I } from "../icons.js";
import { esc, money, delegate, progressRing, haptic, imgTag, imgUrl, displayName, longPress, $ } from "../dom.js";
import { askText, askConfirm } from "../dialog.js";
import { quickToggleGroup } from "../../collection.js";
import { setStats, groupState, ownState, getQty, setQty, ownedTotal, isTracked, toggleSetStar } from "../../collection.js";
import { groupPrintings } from "../../catalog.js";
import { variantsFor, priceOf, primaryVariant } from "../../pricing.js";
import { CAT_JP } from "../../constants.js";

const PAGE_OF = (cols) => (cols === 4 ? 12 : 9);   // 3×3 or 4×3 pockets per binder page
export function mount(root, ctx) {
  const { state, store, app } = ctx;
  const sid = String(ctx.route.parts[1] || "");
  const g = state.bySet.get(sid);
  if (!g) { root.innerHTML = `<div class="topbar tight"><button class="iconbtn back" data-action="back">${I.back}</button><h1 class="sm">Set</h1></div><div class="empty">This set isn't in the local catalog.</div>`; delegate(root, { back: () => ctx.back() }); return {}; }
  let route = ctx.route;
  const PAGE = () => PAGE_OF(state.prefs.cols);
  const qv = () => ({ view: route.query.view || (state.prefs.binder ? "binder" : "list"), f: route.query.f || "all", r: route.query.r || "", sec: route.query.sec || "cards", page: Math.max(0, parseInt(route.query.page || "0", 10) || 0) });
  let pricesLoading = !state.priceCache[sid];
  let q = "";                                       // find-in-set (name or number)
  const matchQ = (grp) => { const t = q.trim().toLowerCase(); if (!t) return true; return grp.name.toLowerCase().includes(t) || String(grp.number || "").toLowerCase().includes(t) || grp.products.some((p) => (p.n || "").toLowerCase().includes(t)); };
  // Black Bolt / White Flare: the user collects only the IR / SIR chase from these two English sets
  const restricted = g.cat !== CAT_JP && /black bolt|white flare/i.test(g.name);
  const vf = (pid) => variantsFor(state.flatPrices, pid, state.owned);

  root.innerHTML = `
    <div class="topbar tight sticky"><button class="iconbtn back" data-action="back" aria-label="Back">${I.back}</button><h1 class="sm">${esc(g.name)}</h1><button class="iconbtn star" data-action="star" aria-label="Track set"></button></div>
    <div class="card prog" data-region="prog"></div>
    ${g.sealed.length ? `<div class="seg secseg" data-region="secseg"></div>` : ""}
    <div class="filtrow sticky below findrow"><label class="search" style="height:44px">${I.search}<input type="search" placeholder="Find in set — name or number" autocomplete="off" autocorrect="off" spellcheck="false" data-region="q"><button class="clear hidden" data-action="clearq">Clear</button></label><div class="filtinner" data-region="filters"></div></div>
    <div data-region="body"></div>`;

  function groups() {
    let all = g.groups;
    if (restricted) all = all.filter((grp) => grp.products.some((p) => /illustration rare/i.test(p.r)));
    const { r, f } = qv();
    if (r) all = all.filter((grp) => grp.products.some((p) => (p.r || "") === r));
    const og = (grp) => groupState(state.owned, state.flatPrices, grp) === "complete";
    if (f === "owned") all = all.filter(og); else if (f === "missing") all = all.filter((grp) => !og(grp));
    if (q.trim()) all = all.filter(matchQ);
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
    $("[data-region=q]", root).placeholder = sec === "sealed" ? "Find a sealed product" : "Find in set — name or number";
    if (sec === "sealed") { $("[data-region=filters]", root).innerHTML = ""; return; }
    const rars = [...new Set(g.cards.map((p) => p.r).filter(Boolean))].sort();
    $("[data-region=filters]", root).innerHTML = `<div class="chips">
        ${[["all", "All"], ["owned", "Owned"], ["missing", "Missing"]].map(([k, l]) => `<button class="chip ${f === k ? "on" : ""}" data-action="f" data-f="${k}">${l}</button>`).join("")}
        <span class="chip dd fdrop">${esc(r || "All rarities")} ${I.chevD}<select data-action="rarity" aria-label="Rarity"><option value="">All rarities</option>${rars.map((x) => `<option ${x === r ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></span>
      </div>
      <div class="seg compact icons"><button class="${view === "list" ? "on" : ""}" data-action="view" data-view="list" aria-label="List">${I.list}</button><button class="${view === "binder" ? "on" : ""}" data-action="view" data-view="binder" aria-label="Binder">${I.grid}</button></div>
`;
    $("select", root).addEventListener("change", (e) => ctx.router.setQuery({ r: e.target.value, page: "" }));
  }
  const badge = (grp) => { const s = groupState(state.owned, state.flatPrices, grp); return `<span class="badge ${s === "complete" ? "full" : s === "partial" ? "part" : ""}">${s === "complete" ? I.check : s === "partial" ? I.dash : I.plus}</span>`; };
  function paintBody() {
    const { view, sec, page } = qv();
    const body = $("[data-region=body]", root);
    if (sec === "sealed") {
      const sealedList = g.sealed.filter((p) => !q.trim() || (p.n || "").toLowerCase().includes(q.trim().toLowerCase()));
      body.innerHTML = `<div class="stack group">${sealedList.map((p) => { const q = ownedTotal(state.owned, p.i), v = vf(p.i)[0], px = priceOf(state.flatPrices, p.i, v);
        return `<div class="card crow"><div class="tap" data-action="card" data-pid="${p.i}"><div class="thumb">${imgTag(imgUrl(p), p.n)}</div><div class="info"><div class="nm">${esc(displayName(p))}</div><div class="meta num">${px != null ? money(px) + " each" : "price unavailable"}</div></div></div>
          <div class="stepper"><button data-action="dec" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Remove one">−</button><span class="q num">${q}</span><button data-action="inc" data-pid="${p.i}" data-v="${esc(v)}" aria-label="Add one">+</button></div></div>`; }).join("") || `<div class="empty">No sealed products in this set.</div>`}</div>`;
      return;
    }
    const grs = groups();
    if (!grs.length) { body.innerHTML = `<div class="empty">${q.trim() ? `Nothing in this set matches “${esc(q.trim())}”.` : qv().f === "owned" ? "Nothing complete here yet." : qv().f === "missing" ? "<b>Set complete!</b> Nothing missing." : "No cards match."}</div>`; return; }
    if (view === "list") {
      body.innerHTML = `<div class="stack group">${grs.map((grp) => {
        const base = grp.products[0];
        const printings = groupPrintings(grp, vf);
        // master-set view: every printing is a check, chase cards included; counts live in Collection / Search
        const togs = printings.map((pr) => { const q = getQty(state.owned, pr.pid, pr.variant), on = q > 0; return `<button class="vtog ${on ? "on" : ""}" data-action="tog" data-pid="${pr.pid}" data-v="${esc(pr.variant)}" aria-label="${esc(pr.label)} ${on ? "owned" : "not owned"}"><span class="c">${on ? I.check : ""}</span><span class="l">${esc(pr.label.replace(/^Master Ball$/, "Master"))}</span></button>`; }).join("");
        const bp = priceOf(state.flatPrices, base.i, primaryVariant(state.flatPrices, base.i, state.owned));
        return `<div class="card lrow"><div class="tap" data-action="card" data-pid="${base.i}"><div class="thumb">${imgTag(imgUrl(base), grp.name)}</div><div class="info"><div class="nm">${esc(grp.name)}</div><div class="meta">#${esc(grp.number || "—")}${base.r ? " · " + esc(base.r) : ""}${bp != null ? ` · <b class="num" data-price="${base.i}">${money(bp)}</b>` : `<b class="num" data-price="${base.i}"></b>`}</div></div></div><div class="togs">${togs}</div></div>`;
      }).join("")}</div>`;
      return;
    }
    const PER = PAGE(), pages = Math.max(1, Math.ceil(grs.length / PER)), pg = Math.min(page, pages - 1);
    const pocketsHtml = (p) => grs.slice(p * PER, p * PER + PER).map((grp) => { const base = grp.products[0], st = groupState(state.owned, state.flatPrices, grp);
        const bp = priceOf(state.flatPrices, base.i, primaryVariant(state.flatPrices, base.i, state.owned));
        return `<div class="pocket ${st === "none" ? "miss" : ""}" data-action="card" data-pid="${base.i}">${imgTag(imgUrl(base), grp.name)}<span class="pno">${esc(grp.number || "")}</span>${bp != null ? `<span class="pp num">${money(bp)}</span>` : ""}${badge(grp)}</div>`; }).join("");
    const layoutSeg = `<div class="seg compact" style="margin-left:auto"><button class="${state.prefs.cols !== 4 ? "on" : ""}" data-action="cols" data-cols="3" aria-label="3 by 3 pockets">3×3</button><button class="${state.prefs.cols === 4 ? "on" : ""}" data-action="cols" data-cols="4" aria-label="4 by 3 pockets">4×3</button></div>`;
    const pagerHtml = (p) => `<button class="iconbtn" data-action="page" data-d="-1" ${p === 0 ? "disabled" : ""} aria-label="Previous page">${I.back}</button><button class="pg num pgbtn" data-action="jump" aria-label="Go to a page or card number">Page ${p + 1} of ${pages} ${I.chevD}</button><button class="iconbtn" data-action="page" data-d="1" ${p >= pages - 1 ? "disabled" : ""} aria-label="Next page">${I.chevR}</button>${layoutSeg}`;
    body.innerHTML = `<div class="binder ${state.prefs.cols === 4 ? "c4" : ""}" data-region="binder">${pocketsHtml(pg)}</div>
      <div class="pager" data-region="pager">${pagerHtml(pg)}</div>
      ${pages > 1 ? `<input type="range" class="scrub" min="0" max="${pages - 1}" value="${pg}" aria-label="Binder page" data-region="scrub">` : ""}`;
    const sc = $("[data-region=scrub]", root);
    if (sc) {
      // live while dragging: repaint pockets + label only (the slider itself stays put); commit to the URL on release
      sc.addEventListener("input", () => { const p = +sc.value; $("[data-region=binder]", root).innerHTML = pocketsHtml(p); $("[data-region=pager]", root).innerHTML = pagerHtml(p); });
      sc.addEventListener("change", () => ctx.router.setQuery({ page: sc.value === "0" ? "" : sc.value }));
    }
    // swipe between binder pages
    const b = $("[data-region=binder]", root); let x0 = null;
    b.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    b.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) flip(dx < 0 ? 1 : -1); }, { passive: true });
  }
  function flip(d) { const { page } = qv(); const pages = Math.max(1, Math.ceil(groups().length / PAGE())); const np = Math.max(0, Math.min(pages - 1, page + d)); if (np !== page) { ctx.router.setQuery({ page: np ? String(np) : "" }); } }
  function paint() { paintProg(); paintFilters(); paintBody(); }
  /** ownership changed: patch checks, steppers and badges in place (no image reloads, no lost scroll) */
  function patchOwned() {
    for (const b of root.querySelectorAll(".vtog")) { const q = getQty(state.owned, b.dataset.pid, b.dataset.v), on = q > 0; b.classList.toggle("on", on); $(".c", b).innerHTML = on ? I.check : ""; }
    for (const st of root.querySelectorAll(".stepper")) { const btn = $("[data-action=inc]", st); if (btn) $(".q", st).textContent = getQty(state.owned, btn.dataset.pid, btn.dataset.v); }
    const { f, view } = qv();
    if (view === "binder" || f !== "all") { paintBody(); return; }
  }
  const setq = (pid, v, n) => {
    const before = getQty(state.owned, pid, v);
    haptic(); store.update((s) => setQty(s.owned, pid, v, n), "owned");
    if (before > 0 && n === 0) ctx.toast(before > 1 ? `Removed all ${before} copies` : "Removed from your collection", { action: "Undo", onAction: () => store.update((s) => setQty(s.owned, pid, v, before), "owned") });
  };
  /** long-press a pocket / row: own every printing of the card, or clear it (with undo) */
  function quickOwn(el) {
    const grp = g.groups.find((x) => String(x.products[0].i) === String(el.dataset.pid)); if (!grp) return;
    const before = JSON.stringify(grp.products.map((p) => state.owned[String(p.i)] || null));
    const wasComplete = groupState(state.owned, state.flatPrices, grp) === "complete";
    let ok = true; store.update((s) => { ok = quickToggleGroup(s.owned, s.flatPrices, grp); }, "owned");
    haptic(12);
    if (!ok) { ctx.toast("You own several copies of a printing — tap its check to remove one or all"); return; }
    if (wasComplete) ctx.toast(`${grp.name} cleared`, { action: "Undo", onAction: () => store.update((s) => { JSON.parse(before).forEach((o, i) => { const pid = String(grp.products[i].i); if (o) s.owned[pid] = o; else delete s.owned[pid]; }); }, "owned") });
    else ctx.toast(`${grp.name} — every printing owned`);
  }
  longPress(root, ".pocket, .lrow .tap", quickOwn);
  $("[data-region=q]", root).addEventListener("input", (e) => { q = e.target.value; $(".clear", $(".findrow", root)).classList.toggle("hidden", !q); if (qv().page) ctx.router.setQuery({ page: "" }); else paintBody(); });
  const off = delegate(root, {
    back: () => ctx.back(),
    star: () => { haptic(); store.update((s) => toggleSetStar(s, sid), "tracked", "favorites"); ctx.toast(isTracked(state, sid) ? "Tracking " + g.name : "Untracked"); },
    sec: (el) => ctx.router.setQuery({ sec: el.dataset.sec === "cards" ? "" : "sealed", page: "" }),
    f: (el) => ctx.router.setQuery({ f: el.dataset.f === "all" ? "" : el.dataset.f, page: "" }),
    view: (el) => { ctx.router.setQuery({ view: el.dataset.view }); store.update((s) => { s.prefs.binder = el.dataset.view === "binder"; }, "prefs"); },
    cols: (el) => {
      // keep the first visible card on screen when the page size changes
      const { page } = qv(); const firstIdx = page * PAGE(); const cols = +el.dataset.cols;
      store.update((s) => { s.prefs.cols = cols; }, "prefs");
      const np = Math.floor(firstIdx / PAGE_OF(cols)); ctx.router.setQuery({ page: np ? String(np) : "" }); paintBody();
    },
    page: (el) => flip(+el.dataset.d),
    card: (el) => { if (el.dataset.lp) return; ctx.openCard(el.dataset.pid); },
    clearq: () => { q = ""; const i = $("[data-region=q]", root); i.value = ""; $(".clear", $(".findrow", root)).classList.add("hidden"); paintBody(); i.focus(); },
    jump: async () => {
      const pages = Math.max(1, Math.ceil(groups().length / PAGE()));
      const v = await askText({ title: "Go to", placeholder: `Page 1–${pages}, or a card number like 150`, ok: "Go" }); if (!v) return;
      const grs = groups(); const byNum = grs.findIndex((grp) => String(grp.number || "").replace(/^0+/, "").split("/")[0] === v.replace(/^#?0*/, "").split("/")[0]);
      let pg = byNum > -1 ? Math.floor(byNum / PAGE()) : parseInt(v, 10) - 1;
      if (isNaN(pg)) { ctx.toast("Type a page or a card number"); return; }
      pg = Math.max(0, Math.min(pages - 1, pg)); ctx.router.setQuery({ page: pg ? String(pg) : "" });
    },
    tog: async (el) => {
      const pid = el.dataset.pid, v = el.dataset.v, q = getQty(state.owned, pid, v);
      if (q <= 1) { setq(pid, v, q > 0 ? 0 : 1); return; }
      // several copies: a set page only knows yes / no, so ask what un-checking should mean
      const r = await askConfirm({ title: `You have ${q} copies`, message: "Set pages only track yes or no. Removing one keeps this card checked; the exact count lives in Collection.", ok: "Remove one", alt: "Remove all", cancel: "Cancel" });
      if (r === true) { haptic(); store.update((s) => setQty(s.owned, pid, v, q - 1), "owned"); ctx.toast(`${q - 1} left — check the count in Collection`, { action: "Undo", onAction: () => store.update((s) => setQty(s.owned, pid, v, q), "owned") }); }
      else if (r === "alt") setq(pid, v, 0);
    },
    inc: (el) => setq(el.dataset.pid, el.dataset.v, getQty(state.owned, el.dataset.pid, el.dataset.v) + 1),
    dec: (el) => setq(el.dataset.pid, el.dataset.v, getQty(state.owned, el.dataset.pid, el.dataset.v) - 1),
  });
  paint();
  if (pricesLoading) app.loadSetPricing(sid).catch(() => ctx.toast("Couldn’t load prices — showing cached values")).finally(() => { pricesLoading = false; paint(); });
  return {
    route: (r) => {
      // stay where you are on page flips (slider, swipe, arrows); only a section switch jumps to the top
      const jump = (r.query.sec || "") !== (route.query.sec || "");
      route = r; paint(); if (jump) window.scrollTo(0, 0);
    },
    update: (changed) => {
      if (changed.has("flatPrices")) { paintProg(); paintBody(); return; }
      if (changed.has("wishlist")) return;
      if (changed.has("owned")) { paintProg(); patchOwned(); }
      if (changed.has("tracked")) paintProg();
    },
    unmount: off,
  };
}
