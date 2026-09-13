// Wishlist: folder strip + unsorted cards; /wishlist/<folderId> is a folder.
import { I } from "../icons.js";
import { esc, money, delegate, imgTag, imgUrl, haptic, $ } from "../dom.js";
import { toggleWish, unsortedWishlist, findFolder, folderCount, addFolder, renameFolder, deleteFolder } from "../../collection.js";
import { applyFilters, applySort, activeCount, sortHtml, filtersHtml, filterActions, raritiesOf, setsOf, SORTS, cardValue } from "../filters.js";
import { mountSheet } from "../sheet.js";
import { askText, askConfirm } from "../dialog.js";
import { CAT_JP } from "../../constants.js";

export function mount(root, ctx) {
  const { state, store } = ctx;
  const f = state.ui.wl;
  const fid = ctx.route.parts[1] || null;
  let sheet = null, setQ = "";
  const folder = () => (fid ? findFolder(state, fid) : null);
  const cards = () => (fid ? Object.keys((folder() || {}).items || {}) : unsortedWishlist(state)).map((pid) => state.byId.get(pid)).filter(Boolean);
  const row = (c) => `<div class="card crow"><div class="tap" data-action="card" data-pid="${c.i}"><div class="thumb">${imgTag(imgUrl(c), c.n)}</div><div class="info"><div class="nm">${esc(c.n)}</div><div class="meta">${esc(c.s)}${c.nu ? " · " + esc(c.nu) : ""}${c.cat === CAT_JP ? " · JP" : ""}</div></div></div><div class="val"><b class="num">${money(cardValue(c, state) || null)}</b></div><button class="heartbtn" data-action="unwish" data-pid="${c.i}" aria-label="Remove from wishlist">${I.heartF}</button></div>`;
  function paint() {
    const fo = folder();
    if (fid && !fo) { root.innerHTML = `<div class="topbar tight"><button class="iconbtn" data-action="back">${I.back}</button><h1 class="sm">Folder</h1></div><div class="empty">This folder no longer exists.</div>`; return; }
    const list = applySort(applyFilters(cards(), { ...f, type: "all" }, state), f.sort, state);
    const n = activeCount(f, false);
    const total = list.reduce((a, c) => a + (cardValue(c, state) || 0), 0);
    const hd = `<div class="hdbtns"><button class="iconbtn boxed ${f.sort !== "val-hi" ? "on" : ""}" data-action="sort" aria-label="Sort">${I.sort}</button><button class="iconbtn boxed ${n ? "on" : ""}" data-action="filters" aria-label="Filters">${I.filter}</button></div>`;
    if (fo) {
      root.innerHTML = `<div class="topbar tight"><button class="iconbtn" data-action="back" aria-label="Back">${I.back}</button><h1 class="sm">${esc(fo.name)}</h1><button class="iconbtn" data-action="menu" aria-label="Folder options">${I.dots}</button></div>
        <div class="card summary" style="padding:12px 16px"><div class="l">${folderCount(fo)} card${folderCount(fo) === 1 ? "" : "s"}</div><div class="v num" style="font-size:26px">${money(total)}</div><div class="s">${SORTS[f.sort]}</div></div>
        <div class="sec"><h2>Cards</h2>${hd}</div><div class="stack">${list.map(row).join("") || `<div class="empty">Nothing in this folder yet. Open a card and use the folder button.</div>`}</div>`;
      return;
    }
    const strip = state.wishFolders.map((x) => { const v = Object.keys(x.items || {}).map((pid) => state.byId.get(pid)).filter(Boolean).reduce((a, c) => a + (cardValue(c, state) || 0), 0); return `<button class="card fcard" data-action="open" data-fid="${esc(x.id)}"><div class="fn">${esc(x.name)}</div><div class="fc num">${folderCount(x)} card${folderCount(x) === 1 ? "" : "s"} · ${money(v)}</div></button>`; }).join("");
    root.innerHTML = `<div class="topbar"><h1>Wishlist</h1><button class="btn ghost sm" data-action="new">${I.plus} Folder</button></div>
      ${state.wishFolders.length ? `<div class="fstrip chips">${strip}</div>` : ""}
      <div class="sec"><h2>Unsorted · ${cards().length}</h2>${hd}</div>
      <div class="stack">${list.map(row).join("") || (Object.keys(state.wishlist).length ? `<div class="empty">Every wishlisted card is filed in a folder.</div>` : `<div class="card empty"><b>Your wishlist is empty.</b><br>Search for a card and tap the heart.</div>`)}</div>`;
  }
  function openSheet(name) {
    if (sheet) sheet.unmount(); sheet = null;
    if (!name) return;
    if (name === "menu") {
      sheet = mountSheet($("#sheets2"), ctx, { title: (folder() || {}).name || "Folder", html: `<div class="stack"><button class="btn ghost" data-action="rename">Rename folder</button><button class="btn danger" data-action="delete">Delete folder</button></div>`, actions: {
        rename: async () => { const nm = await askText({ title: "Rename folder", value: folder().name, ok: "Rename" }); if (nm) store.update((s) => renameFolder(s, fid, nm), "wishFolders"); ctx.back(); },
        delete: async () => { if (await askConfirm({ title: "Delete this folder?", message: "The cards stay on your wishlist.", ok: "Delete folder", danger: true })) { store.update((s) => deleteFolder(s, fid), "wishFolders"); history.go(-2); } },
      } });
      return;
    }
    const base = cards();
    const opts = () => ({ rarities: raritiesOf(base), sets: setsOf(base, state.bySet), hasType: false, setQuery: setQ });
    const html = () => name === "sort" ? sortHtml(f, Object.keys(SORTS).filter((k) => k !== "best")) : filtersHtml(f, opts());
    const onChange = (close) => { paint(); if (close) ctx.back(); else { sheet.repaint(html()); wire(); } };
    sheet = mountSheet($("#sheets2"), ctx, { title: name === "sort" ? "Sort" : "Filters", html: html(), actions: filterActions(f, onChange, false) });
    const wire = () => { const i = $("[data-region=setq]", sheet.host); if (!i) return; i.addEventListener("input", () => { setQ = i.value; sheet.repaint(html()); const ni = $("[data-region=setq]", sheet.host); ni.focus(); ni.setSelectionRange(setQ.length, setQ.length); wire(); }); };
    wire();
  }
  const off = delegate(root, {
    back: () => ctx.back(),
    open: (el) => ctx.go("/wishlist/" + el.dataset.fid),
    new: async () => { const nm = await askText({ title: "New folder", placeholder: "Folder name", ok: "Create" }); if (nm) store.update((s) => addFolder(s, nm), "wishFolders"); },
    card: (el) => ctx.openCard(el.dataset.pid),
    unwish: (el) => { haptic(); store.update((s) => toggleWish(s, el.dataset.pid), "wishlist", "wishFolders"); ctx.toast("Removed from wishlist"); },
    menu: () => ctx.router.setQuery({ sheet: "menu" }, { replace: false }),
    sort: () => ctx.router.setQuery({ sheet: "sort" }, { replace: false }),
    filters: () => ctx.router.setQuery({ sheet: "filters" }, { replace: false }),
  });
  paint();
  return { route: (r) => openSheet(r.query.sheet), update: (changed) => { if (["wishlist", "wishFolders", "flatPrices", "owned"].some((k) => changed.has(k))) paint(); }, unmount: () => { off(); if (sheet) sheet.unmount(); } };
}
