// Card detail sheet: art on a dark stage, price + 30-day line, printings, links.
import { I } from "../icons.js";
import { esc, money, delegate, haptic, imgUrl, sparkline, $ } from "../dom.js";
import { getQty, setQty, ownedTotal, isWished, toggleWish, cardFolders } from "../../collection.js";
import { isChaseRarity, patternOf, shortVariant } from "../../catalog.js";
import { variantsFor, priceOf, primaryVariant } from "../../pricing.js";
import { productSeries } from "../../history.js";
import { CAT_JP } from "../../constants.js";
import { mountSheet } from "../sheet.js";
import { askText } from "../dialog.js";
import { toggleCardFolder, addFolder, folderCount } from "../../collection.js";

export function mountCardSheet(host, ctx, pid) {
  const { state, store, app } = ctx;
  const c = state.byId.get(String(pid));
  host.innerHTML = `<div class="dim" data-action="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body" data-region="body"></div></div>`;
  const dim = $(".dim", host), sheet = $(".sheet", host);
  requestAnimationFrame(() => { dim.classList.add("open"); sheet.classList.add("open"); });
  document.body.style.overflow = "hidden";
  let loading = !!c && !state.priceCache[String(c.sid)];
  function paint() {
    const body = $("[data-region=body]", host);
    if (!c) { body.innerHTML = `<div class="empty">Card not found in the local catalog.</div>`; return; }
    const g = state.bySet.get(String(c.sid));
    const vs = variantsFor(state.flatPrices, c.i), pv = primaryVariant(state.flatPrices, c.i), px = priceOf(state.flatPrices, c.i, pv);
    const owned = ownedTotal(state.owned, c.i), chase = c.sealed || isChaseRarity(c.r);
    const series = productSeries(state.history, c.i).map((p) => p.v).filter((v) => v > 0);
    const first = series[0], last = series[series.length - 1];
    const delta = series.length > 1 && owned ? (last - first) / owned : null;
    const wished = isWished(state, c.i), folders = cardFolders(state, c.i);
    body.innerHTML = `
      <div class="stage"><div class="bigart" data-action="zoom"><img src="${esc(imgUrl(c, 400))}" alt="${esc(c.n)}"></div>
        <div class="sub">${esc(g ? g.name : c.s)}${c.nu ? " · #" + esc(c.nu) : ""}${c.r ? " · " + esc(c.r) : ""}</div>
        <div class="pills"><span>${c.cat === CAT_JP ? "Japanese" : "English"}</span>${owned ? `<span>Owned ${owned}</span>` : ""}${patternOf(c.n) ? `<span>${esc(patternOf(c.n))} pattern</span>` : ""}</div></div>
      <div class="title"><h3>${esc(c.n)}</h3>
        <button class="iconbtn boxed ${wished ? "on" : ""}" data-action="wish" aria-label="${wished ? "Remove from wishlist" : "Add to wishlist"}">${wished ? I.heartF : I.heart}</button>
        <button class="iconbtn boxed ${folders.length ? "on" : ""}" data-action="folders" aria-label="Wishlist folders">${I.folder}</button></div>
      <div class="card pricebox"><div><div class="pv num">${loading ? "…" : money(px)}</div><div class="pl">${loading ? "Loading prices" : px == null ? "No market price" : "Market" + (delta != null && Math.abs(delta) >= 0.01 ? " · " + (delta > 0 ? "▲" : "▼") + " " + money(Math.abs(delta)) + " over " + series.length + " days" : "")}</div></div>${series.length > 1 ? sparkline(series) : ""}</div>
      <div class="stack">${vs.map((v) => { const q = getQty(state.owned, c.i, v), p = priceOf(state.flatPrices, c.i, v);
        return chase
          ? `<div class="card vrow ${q ? "has" : ""}"><div class="vi"><div class="vn">${esc(shortVariant(v) === "Normal" && vs.length === 1 ? (c.sealed ? "Sealed" : v) : v)}</div><div class="vp num">${p != null ? money(p) + " each" : "price unavailable"}</div></div><div class="stepper"><button data-action="dec" data-v="${esc(v)}" aria-label="Remove one">−</button><span class="q num">${q}</span><button data-action="inc" data-v="${esc(v)}" aria-label="Add one">+</button></div></div>`
          : `<div class="card vrow toggle ${q ? "has" : ""}" data-action="tog" data-v="${esc(v)}"><div class="vi"><div class="vn">${esc(v)}</div><div class="vp num">${p != null ? money(p) : "price unavailable"}</div></div><span class="vcheck"><i>${q ? I.check : ""}</i></span></div>`; }).join("")}</div>
      ${g ? `<button class="btn ghost linkrow" data-action="openset">Open ${esc(g.name)} ${I.chevR}</button>` : ""}`;
  }
  const setq = (v, q) => { haptic(); store.update((s) => setQty(s.owned, c.i, v, q), "owned"); };
  const off = delegate(host, {
    close: () => ctx.back(),
    zoom: () => { const z = document.createElement("div"); z.className = "zoom"; z.innerHTML = `<img src="${esc(imgUrl(c, 400).replace(/_400w\./, "_1000w."))}" alt="${esc(c.n)}">`; z.onclick = () => z.remove(); document.body.appendChild(z); },
    wish: () => { haptic(); store.update((s) => toggleWish(s, c.i), "wishlist", "wishFolders"); ctx.toast(isWished(state, c.i) ? "Added to wishlist" : "Removed from wishlist"); },
    folders: () => ctx.router.setQuery({ sheet: "folders" }, { replace: false }),
    tog: (el) => setq(el.dataset.v, getQty(state.owned, c.i, el.dataset.v) > 0 ? 0 : 1),
    inc: (el) => setq(el.dataset.v, getQty(state.owned, c.i, el.dataset.v) + 1),
    dec: (el) => setq(el.dataset.v, getQty(state.owned, c.i, el.dataset.v) - 1),
    openset: () => { ctx.go("/sets/" + c.sid); },
  });
  // swipe down on the grip / stage closes
  let y0 = null;
  sheet.addEventListener("touchstart", (e) => { if ($(".body", host).scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchend", (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) ctx.back(); y0 = null; }, { passive: true });
  let picker = null;
  function pickerHtml() { return `<div class="stack">${state.wishFolders.map((f) => { const on = !!(f.items && f.items[String(c.i)]); return `<button class="card vrow toggle ${on ? "has" : ""}" data-action="tf" data-fid="${esc(f.id)}"><div class="vi"><div class="vn">${esc(f.name)}</div><div class="vp num">${folderCount(f)} card${folderCount(f) === 1 ? "" : "s"}</div></div><span class="vcheck"><i>${on ? I.check : ""}</i></span></button>`; }).join("")}<button class="btn ghost" data-action="nf">${I.plus} New folder</button></div>`; }
  function openPicker(on) {
    if (picker) picker.unmount(); picker = null;
    if (!on || !c) return;
    picker = mountSheet($("#sheets2"), ctx, { title: "Wishlist folders", html: pickerHtml(), actions: {
      tf: (el) => { haptic(); store.update((s) => toggleCardFolder(s, c.i, el.dataset.fid), "wishFolders", "wishlist"); picker.repaint(pickerHtml()); },
      nf: async () => { const nm = await askText({ title: "New folder", placeholder: "Folder name", ok: "Create" }); if (nm) store.update((s) => { const f = addFolder(s, nm); if (f) toggleCardFolder(s, c.i, f.id); }, "wishFolders", "wishlist"); if (picker) picker.repaint(pickerHtml()); },
    } });
  }
  paint();
  openPicker(ctx.route.query.sheet === "folders");
  if (loading) app.loadSetPricing(c.sid).catch(() => {}).finally(() => { loading = false; paint(); });
  return {
    route: (r) => openPicker(r.query.sheet === "folders"),
    update: (changed) => { if (changed.has("owned") || changed.has("flatPrices") || changed.has("wishlist") || changed.has("wishFolders")) paint(); },
    unmount: () => { off(); if (picker) picker.unmount(); dim.classList.remove("open"); sheet.classList.remove("open"); document.body.style.overflow = ""; setTimeout(() => { if (!sheet.classList.contains("open")) { sheet.remove(); dim.remove(); } }, 260); },
  };
}
