// Home: worth, top cards, in-progress sets, latest sets.
import { I } from "../icons.js";
import { esc, money, delegate, imgTag, imgUrl, setAbbr, sparkline, relTime, $ } from "../dom.js";
import { productValue, totalWorth, setStats, isTracked } from "../../collection.js";
import { totalSeries, trendInfo } from "../../history.js";
import { newestSets } from "../../catalog.js";
import { syncConfigured } from "../../sync.js";
import { CAT_JP } from "../../constants.js";

export function mount(root, ctx) {
  const { state } = ctx;
  function paint() {
    const worth = totalWorth(state.owned, state.flatPrices);
    const series = totalSeries(state.history).map((p) => p.v);
    const tr = trendInfo(state.history);
    const top = Object.keys(state.owned).map((pid) => ({ c: state.byId.get(pid), v: productValue(state.owned, state.flatPrices, pid) })).filter((x) => x.c && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
    const tracked = Object.keys(state.tracked).map((sid) => state.bySet.get(String(sid))).filter(Boolean)
      .map((g) => ({ g, st: setStats(g, state.owned, state.flatPrices) })).filter((x) => x.st.total && x.st.complete < x.st.total)
      .sort((a, b) => (b.st.complete / b.st.total) - (a.st.complete / a.st.total)).slice(0, 3);
    const latest = newestSets(state.bySet, state.setDates, 8);
    const sync = syncConfigured(state.sync) ? (state.syncStatus === "error" ? `<span style="font-size:11px;font-weight:700;color:var(--neg)">Sync issue</span>` : state.syncStatus === "syncing" || state.syncStatus === "pending" ? `<span style="font-size:11px;font-weight:700;color:var(--sec)">Syncing…</span>` : `<span style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--pos-text)">${I.cloud} Synced</span>`) : "";
    root.innerHTML = `
      <div class="topbar">${I.logo}<h1>PokéVault</h1>${sync}<button class="iconbtn boxed" data-action="settings" aria-label="Settings">${I.gear}</button></div>
      ${state.catalog.length ? "" : `<div class="card empty"><b>Welcome!</b><br>Download the card database once, then search any card or track a set.<button class="btn" data-action="settings">Open Settings</button></div>`}
      <div class="card summary"><div class="l">Collection worth</div><div class="v num" style="font-size:34px">${money(worth)}</div>
        <div class="s" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${tr && Math.abs(tr.diff) >= 0.01 ? `<span style="font-weight:800;color:${tr.diff >= 0 ? "var(--pos-text)" : "var(--neg)"}">${tr.diff >= 0 ? "▲" : "▼"} ${money(Math.abs(tr.diff))} · ${Math.abs(tr.pct).toFixed(1)}% since ${tr.fromDate.slice(5)}</span>` : `<span>${Object.keys(state.owned).length} products owned</span>`}${state.pricesAt ? `<span style="display:inline-flex;align-items:center;gap:4px">${I.clock.replace('class="ico"', 'class="ico" style="width:13px;height:13px"')} prices ${relTime(state.pricesAt)}</span>` : ""}</div>
        ${series.length > 1 ? `<div style="margin-top:8px">${sparkline(series, { w: 320, h: 34 })}</div>` : ""}</div>
      ${top.length ? `<div class="sec"><h2>Top cards</h2><button class="more" data-action="go" data-to="/collection">Collection ${I.chevR}</button></div>
      <div class="grid3">${top.map(({ c, v }) => `<div class="tile"><div class="art" data-action="card" data-pid="${c.i}">${imgTag(imgUrl(c), c.n)}</div><div class="info"><div class="nm">${esc(c.n)}</div><div class="pr num">${money(v)}</div><div class="set">${esc(c.s)}</div></div></div>`).join("")}</div>` : ""}
      <div class="sec"><h2>In progress</h2><button class="more" data-action="go" data-to="/sets">All sets ${I.chevR}</button></div>
      ${tracked.length ? `<div class="stack">${tracked.map(({ g, st }) => `<div class="card setrow" data-action="set" data-sid="${esc(g.sid)}"><div class="logo">${esc(setAbbr(g.name))}${g.cat === CAT_JP ? '<span style="font-size:7px;display:block">JP</span>' : ""}</div><div class="info"><div class="nm">${esc(g.name)}</div><div class="meta num">${st.complete} of ${st.total} cards · ${Math.round(st.complete / st.total * 100)}%</div><div class="bar"><div style="width:${(st.complete / st.total * 100).toFixed(1)}%"></div></div></div><div class="val"><b class="num">${money(st.value)}</b><span>value</span></div></div>`).join("")}</div>`
        : `<div class="card empty">Track a set from the Sets tab and its progress shows up here.</div>`}
      ${latest.length ? `<div class="sec"><h2>Latest sets</h2></div><div class="chips" style="gap:10px">${latest.map((s) => `<button class="card fcard" data-action="set" data-sid="${esc(s.sid)}" style="height:auto;gap:6px;text-align:left"><div class="logo" style="width:100%;height:32px;border-radius:8px;font-size:11px">${esc(setAbbr(s.name))}</div><div class="fn">${esc(s.name.replace(/^[A-Z0-9]+\s*[:\-–]\s*/, ""))}</div><div class="fc">${s.date ? new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " : ""}${s.cat === CAT_JP ? "JP" : "EN"}</div></button>`).join("")}</div>` : ""}`;
  }
  const off = delegate(root, { settings: () => ctx.go("/settings"), go: (el) => ctx.go(el.dataset.to), set: (el) => ctx.openSet(el.dataset.sid), card: (el) => ctx.openCard(el.dataset.pid) });
  paint();
  return { update: (changed) => { if (["owned", "flatPrices", "tracked", "history", "sync", "catalog", "setDates"].some((k) => changed.has(k))) paint(); }, unmount: off };
}
