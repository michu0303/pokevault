// Settings: theme, catalog, prices, backup, cloud sync.
import { I } from "../icons.js";
import { esc, delegate, relTime, $ } from "../dom.js";
import { exportPayload, parseImport } from "../../collection.js";
import { passFingerprint } from "../../crypto.js";
import { syncConfigured } from "../../sync.js";
import { today } from "../../util.js";
import { APP_VERSION } from "../../constants.js";
import { askConfirm } from "../dialog.js";

export function mount(root, ctx) {
  const { state, store, app } = ctx;
  let refreshing = null, fp = "", warming = null, showPass = false;
  function paint() {
    const m = state.catalogMeta, b = state.build;
    root.innerHTML = `
      <div class="topbar tight sticky"><button class="iconbtn back" data-action="back" aria-label="Back">${I.back}</button><h1 class="sm">Settings</h1></div>
      <div class="card panel"><h3>Appearance</h3><div class="seg">${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button class="${state.prefs.theme === k ? "on" : ""}" data-action="theme" data-theme="${k}">${l}</button>`).join("")}</div></div>
      <div class="card panel"><h3>Card database</h3>
        <p>${m ? `${(m.count || state.catalog.length).toLocaleString()} products · built ${m.builtAt ? new Date(m.builtAt).toLocaleDateString() : "—"}${m.source ? " · " + (m.source === "static" ? "pre-built download" : "crawled from the API") : ""}` : "Not downloaded on this device yet. It's about 1 MB and takes a few seconds."}</p>
        ${state.building ? `<div class="status"><div class="spinner"></div>${b.source === "api" ? `Crawling the API: ${b.done} of ${b.total} sets · ${b.products.toLocaleString()} products` : "Downloading the pre-built catalog…"}</div>` : `<button class="btn ${m ? "ghost" : ""}" data-action="build">${m ? "Rebuild card database" : "Download card database"}</button>`}</div>
      <div class="card panel"><h3>Prices</h3><p>Prices load per set as you open sets and cards. Refresh everything you own or want at once here.</p>
        <button class="btn ghost" data-action="refresh" ${refreshing ? "disabled" : ""}>${refreshing ? `Refreshing ${refreshing.done} / ${refreshing.total}…` : "Refresh all values"}</button></div>
      <div class="card panel"><h3>Offline</h3><p>Your catalog and collection already work offline. This also downloads the card images for everything you own, want, or track (${app.offlineImageUrls().length.toLocaleString()} images, roughly ${Math.max(1, Math.round(app.offlineImageUrls().length * 0.02))} MB) so they show at a card show with no signal. Wi-Fi recommended.</p>
        <button class="btn ghost" data-action="warm" ${warming || !("serviceWorker" in navigator) ? "disabled" : ""}>${warming ? `Downloading ${warming.done} / ${warming.total}…` : "Download images for offline use"}</button>${"serviceWorker" in navigator ? "" : `<p>Needs the app to be opened over https.</p>`}</div>
      <div class="card panel"><h3>Backup</h3><p>A JSON file with your collection, wishlist, folders and tracked sets. Import replaces what's on this device.</p>
        <div class="row2"><button class="btn ghost" data-action="export">Export</button><button class="btn ghost" data-action="import">Import…</button></div><input type="file" accept="application/json,.json" class="hidden" data-region="file"></div>
      <div class="card panel"><h3>Cloud sync</h3>${syncPanel()}</div>
      <div class="card panel"><h3>Danger zone</h3><div class="row2"><button class="btn danger" data-action="clear-col">Clear collection</button><button class="btn danger" data-action="clear-wl">Clear wishlist</button></div></div>
      <div class="card panel"><h3>About</h3><p>PokéVault <b class="num">${APP_VERSION}</b>${"serviceWorker" in navigator ? " · installed for offline use" : ""}</p><button class="btn ghost" data-action="update">Check for updates</button></div>
      <p class="muted" style="text-align:center;font-size:11.5px;line-height:1.5;padding:0 8px">Card data and prices from the TCGTracking Open TCG API. Not affiliated with Nintendo or The Pokémon Company.</p>`;
    const pi = $("input[data-f=pass]", root);
    if (pi) { let t = null; pi.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => { const el = $("[data-region=fp]", root); if (!el) return; el.innerHTML = pi.value ? `Fingerprint <b class="num" style="color:var(--strong)">${esc(await passFingerprint(pi.value))}</b> — must match the other device's` : "Fingerprint appears here as you type — it must match the other device's."; }, 150); }); }
    const file = $("[data-region=file]", root);
    file.addEventListener("change", () => { const f = file.files[0]; if (f) importFile(f); file.value = ""; });
  }
  function syncPanel() {
    const s = state.sync;
    if (syncConfigured(s)) {
      const st = state.syncStatus;
      return `<p>Connected to <b>${esc(s.url.replace(/^https?:\/\//, ""))}</b> · passphrase fingerprint <b class="num">${fp || "…"}</b></p>
        <p>${st === "ok" ? "Up to date · synced " + relTime(state.syncedAt) : st === "syncing" ? "Syncing…" : st === "pending" ? "Changes waiting to upload" : st === "error" ? "Problem: " + esc(state.syncError) : state.dirty ? "Unsynced changes on this device" : "Idle"}</p>
        <div class="row2"><button class="btn ghost" data-action="sync-now">Sync now</button><button class="btn danger" data-action="sync-off">Disconnect</button></div>
        <details><summary class="muted" style="font-size:12.5px;font-weight:700;cursor:pointer;min-height:44px;display:flex;align-items:center">Sync details — copy these to another device</summary>
          <div class="stack" style="margin-top:8px">
            <div class="field"><label>Project URL</label><div class="row2"><input readonly value="${esc(s.url)}"><button class="btn ghost sm" data-action="copy" data-v="${esc(s.url)}">Copy</button></div></div>
            <div class="field"><label>Anon key</label><div class="row2"><input readonly value="${esc(s.key)}"><button class="btn ghost sm" data-action="copy" data-v="${esc(s.key)}">Copy</button></div></div>
            <div class="field"><label>Passphrase</label><div class="row2"><input readonly type="${showPass ? "text" : "password"}" value="${esc(s.pass)}"><button class="btn ghost sm" data-action="reveal">${showPass ? "Hide" : "Show"}</button></div></div>
          </div></details>`;
    }
    return `<p>Optional. Encrypted on this device with a passphrase; only ciphertext reaches your own free Supabase project. Use the exact same passphrase on every device — a different one opens a different, empty vault.</p>
      <div class="field"><label>Supabase project URL</label><input data-f="url" placeholder="https://xxxx.supabase.co" autocapitalize="off"></div>
      <div class="field"><label>Anon or publishable key</label><input data-f="key" autocapitalize="off" autocomplete="off" placeholder="sb_publishable_… or eyJ…"></div>
      <div class="field"><label>Passphrase</label><input data-f="pass" type="password" autocapitalize="off" autocomplete="off"><span class="muted" style="font-size:12px;font-weight:700" data-region="fp">Fingerprint appears here as you type — it must match the other device's.</span></div>
      <button class="btn" data-action="sync-on">Connect</button>
      <details><summary class="muted" style="font-size:12.5px;font-weight:700;cursor:pointer">One-time Supabase setup</summary><p style="margin-top:8px">1. Create a free project. 2. In the SQL Editor run the snippet below. 3. Copy the Project URL and anon key from Project Settings → API.</p>
      <pre style="font:10.5px/1.5 ui-monospace,Menlo,monospace;background:var(--soft);padding:10px;border-radius:8px;overflow-x:auto">create table if not exists vault (
  id text primary key, data text, updated_at timestamptz default now());
alter table vault enable row level security;
drop policy if exists "pv" on vault;
create policy "pv" on vault for all to anon using (true) with check (true);
grant all on table vault to anon;
notify pgrst, 'reload schema';</pre></details>`;
  }
  async function importFile(f) {
    try {
      const d = parseImport(await f.text());
      if (!(await askConfirm({ title: "Import this backup?", message: "It replaces your collection, wishlist, folders and tracked sets on this device.", ok: "Import", danger: true }))) return;
      store.update((s) => { s.owned = d.owned; s.wishlist = d.wishlist; s.tracked = d.tracked; s.favorites = d.favorites; s.wishFolders = d.wishFolders; if (d.history) s.history = d.history; }, "owned", "wishlist", "tracked", "favorites", "wishFolders", "history");
      ctx.toast("Backup imported");
    } catch (e) { ctx.toast("Couldn’t read that file — is it a PokéVault backup?"); }
  }
  const off = delegate(root, {
    back: () => ctx.back(),
    theme: (el) => store.update((s) => { s.prefs.theme = el.dataset.theme; }, "prefs"),
    build: async () => { if (state.catalogMeta && !(await askConfirm({ title: "Rebuild the card database?", message: "This re-downloads the full catalog.", ok: "Rebuild" }))) return; app.buildCatalog().then((n) => ctx.toast("Card database ready — " + n.toLocaleString() + " products")).catch((e) => ctx.toast(e.message)); },
    refresh: async () => { refreshing = { done: 0, total: 0 }; paint(); const r = await app.refreshValues((p) => { refreshing = p; paint(); }); refreshing = null; paint(); ctx.toast(r.failed ? `Values updated (${r.failed} set${r.failed === 1 ? "" : "s"} failed)` : r.done ? "Values updated" : "Nothing to refresh"); },
    warm: async () => { warming = { done: 0, total: 0 }; paint(); let last = 0; const r = await app.warmImages((p) => { if (Date.now() - last > 250) { last = Date.now(); warming = p; paint(); } }); warming = null; paint(); ctx.toast(r.total ? `${r.done - r.failed} images ready offline${r.failed ? ` · ${r.failed} failed` : ""}` : "Nothing to download yet — track a set or add cards first"); },
    export: () => { const blob = new Blob([JSON.stringify(exportPayload(state, state.history), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pokevault-backup-" + today() + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); ctx.toast("Backup file downloaded"); },
    import: () => $("[data-region=file]", root).click(),
    "clear-col": async () => { if (await askConfirm({ title: "Clear collection?", message: "Removes every owned card from this device.", ok: "Clear collection", danger: true })) store.update((s) => { s.owned = {}; }, "owned"); },
    "clear-wl": async () => { if (await askConfirm({ title: "Clear wishlist?", message: "Removes every wishlisted card and all folders.", ok: "Clear wishlist", danger: true })) store.update((s) => { s.wishlist = {}; s.wishFolders = []; }, "wishlist", "wishFolders"); },
    "sync-on": async () => {
      const v = (f) => ($(`input[data-f=${f}]`, root).value || "").trim();
      const cfg = { url: v("url"), key: v("key"), pass: v("pass") };
      if (!cfg.url || !cfg.key || !cfg.pass) { ctx.toast("Fill in all three fields"); return; }
      if (!/^https?:\/\//i.test(cfg.url)) { ctx.toast("The project URL should start with https://"); return; }
      try {
        const { remote } = await app.connectSync(cfg);
        const haveLocal = Object.keys(state.owned).length > 0 || Object.keys(state.wishlist).length > 0;
        let useRemote = !!remote;
        if (remote && haveLocal) { const r = await askConfirm({ title: "This vault already has a collection", message: "Which one should win?", ok: "Use the cloud copy (replaces this device)", alt: "Upload this device's collection", cancel: "Cancel" }); if (r === false) { app.disconnectSync(); paint(); return; } useRemote = r === true; }
        if (!remote) ctx.toast("New vault created for this passphrase");
        await app.finishConnect(useRemote, remote); ctx.toast("Cloud sync connected");
      } catch (e) { ctx.toast(e.message || "Couldn’t connect"); }
      await loadFp(); paint();
    },
    copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.v); ctx.toast("Copied"); } catch (e) { ctx.toast("Couldn’t copy — long-press the field to select it"); } },
    reveal: () => { showPass = !showPass; paint(); },
    update: async () => { try { const reg = await navigator.serviceWorker.getRegistration(); if (!reg) { location.reload(); return; } await reg.update(); if (reg.installing || reg.waiting) ctx.toast("Update found — installing, the app will reload"); else ctx.toast("You’re on the latest version"); } catch (e) { location.reload(); } },
    "sync-now": () => app.pushNow().then(() => ctx.toast(state.syncStatus === "ok" ? "Synced" : state.syncError || "Sync failed")),
    "sync-off": async () => { if (await askConfirm({ title: "Stop syncing on this device?", message: "Your collection stays here and the cloud copy is untouched.", ok: "Disconnect", danger: true })) { app.disconnectSync(); paint(); } },
  });
  async function loadFp() { try { fp = syncConfigured(state.sync) ? await passFingerprint(state.sync.pass) : ""; } catch (e) { fp = ""; } }
  loadFp().then(paint);
  paint();
  return { update: (changed) => { if (["prefs", "build", "catalog", "catalogMeta", "sync", "owned", "wishlist"].some((k) => changed.has(k))) paint(); }, unmount: off };
}
