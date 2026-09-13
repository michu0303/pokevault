// Sets tab: tracked sets (in progress / complete) and the picker (all sets).
import { I } from "../icons.js";
import { esc, money, delegate, progressRing, setAbbr, haptic, imgTag, $ } from "../dom.js";
import { setStats, isTracked, toggleSetStar } from "../../collection.js";
import { allSetsSorted } from "../../catalog.js";
import { CAT_JP } from "../../constants.js";

export function mount(root, ctx) {
  const { state, store } = ctx;
  let seg = "progress", q = "";
  root.innerHTML = `
    <div class="topbar"><h1>Sets</h1><button class="iconbtn boxed" data-action="settings" aria-label="Settings">${I.gear}</button></div>
    <label class="search">${I.search}<input type="search" placeholder="Find a set to track…" autocomplete="off" autocorrect="off" spellcheck="false"><button class="clear hidden" data-action="clear">Clear</button></label>
    <div class="seg" data-region="seg"></div>
    <div class="stack group" data-region="list"></div>`;
  const input = $("input", root);
  const rows = (sets) => sets.map((s) => {
    const st = setStats(s.g, state.owned, state.flatPrices);
    const pct = st.total ? st.complete / st.total : 0, done = st.total > 0 && st.complete === st.total;
    const tracked = isTracked(state, s.sid);
    return `<div class="card setrow ${done ? "done" : ""}" data-action="open" data-sid="${esc(s.sid)}">
      <div class="logo">${esc(setAbbr(s.name))}${s.cat === CAT_JP ? '<span style="font-size:7px;display:block">JP</span>' : ""}</div>
      <div class="info"><div class="nm">${esc(s.name)}</div><div class="meta num">${tracked ? `${st.complete} of ${st.total} · ${Math.round(pct * 100)}%` : `${st.total} cards${st.owned ? " · " + st.owned + " owned" : ""}`}</div>${tracked ? `<div class="bar"><div style="width:${(pct * 100).toFixed(1)}%"></div></div>` : ""}</div>
      ${tracked ? `<div class="val"><b class="num">${money(st.value)}</b><span>${done ? "complete" : "value"}</span></div>` : ""}
      <button class="star ${tracked ? "on" : ""}" data-action="star" data-sid="${esc(s.sid)}" aria-label="${tracked ? "Untrack" : "Track"} set">${tracked ? I.star : I.starO}</button>
    </div>`;
  }).join("");
  function data() {
    const all = allSetsSorted(state.bySet).map((s) => ({ ...s, g: state.bySet.get(s.sid) }));
    const tracked = all.filter((s) => isTracked(state, s.sid));
    const complete = tracked.filter((s) => { const st = setStats(s.g, state.owned, state.flatPrices); return st.total > 0 && st.complete === st.total; });
    const progress = tracked.filter((s) => !complete.includes(s));
    return { all, tracked, complete, progress };
  }
  function paint() {
    const d = data();
    const ql = q.trim().toLowerCase();
    $("[data-region=seg]", root).innerHTML = [["progress", "In progress", d.progress.length], ["complete", "Complete", d.complete.length], ["all", "All", d.all.length]]
      .map(([k, l, n]) => `<button class="${seg === k ? "on" : ""}" data-action="seg" data-seg="${k}">${l} · ${n}</button>`).join("");
    let list = ql ? d.all.filter((s) => s.name.toLowerCase().includes(ql)) : (seg === "all" ? d.all : seg === "complete" ? d.complete : d.progress);
    if (!ql && seg === "all") list = list.slice(0, 200);
    const listEl = $("[data-region=list]", root);
    if (!state.catalog.length) listEl.innerHTML = `<div class="card empty"><b>No card database yet.</b><br>Download it once from Settings.<button class="btn" data-action="settings" style="margin-top:14px">Open Settings</button></div>`;
    else if (!list.length) listEl.innerHTML = ql ? `<div class="empty">No sets match “${esc(q)}”.</div>` : seg === "progress" ? `<div class="empty"><b>Nothing tracked yet.</b><br>Tap the star on any set to track it — search above or browse All.</div>` : `<div class="empty">No complete sets yet. Keep going!</div>`;
    else listEl.innerHTML = rows(list) + (seg === "all" && !ql && d.all.length > 200 ? `<div class="empty">Showing 200 of ${d.all.length} — search to find the rest.</div>` : "");
    $(".clear", root).classList.toggle("hidden", !q);
  }
  input.addEventListener("input", () => { q = input.value; paint(); });
  const off = delegate(root, {
    seg: (el) => { seg = el.dataset.seg; paint(); },
    clear: () => { q = ""; input.value = ""; paint(); input.focus(); },
    open: (el) => ctx.openSet(el.dataset.sid),
    star: (el, ev) => { ev.stopPropagation(); haptic(); store.update((s) => toggleSetStar(s, el.dataset.sid), "tracked", "favorites"); ctx.toast(isTracked(state, el.dataset.sid) ? "Tracking set" : "Set untracked"); },
    settings: () => ctx.go("/settings"),
  });
  paint();
  return { update: (changed) => { if (["owned", "tracked", "flatPrices", "catalog"].some((k) => changed.has(k))) paint(); }, unmount: off };
}
