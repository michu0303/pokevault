// The shell: bottom nav, screen host, sheet host, theme. Screens are modules
// exporting mount(root, ctx) → { update(changed) }.
import { I } from "./icons.js";
import { $, delegate, toast } from "./dom.js";
import { createRouter } from "./router.js";
import { mountCardSheet } from "./screens/cardSheet.js";

const TABS = [["home", "Home", "home"], ["sets", "Sets", "sets"], ["search", "Search", "search"], ["collection", "Collection", "grid"], ["wishlist", "Wishlist", "heart"]];

export function applyTheme(pref) {
  const root = document.documentElement;
  root.removeAttribute("data-theme"); root.classList.remove("sys-dark");
  if (pref === "dark" || pref === "light") root.setAttribute("data-theme", pref);
  else if (matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("sys-dark");
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim();
}

export function mountShell(app, screens) {
  const { store, state } = app;
  const screenEl = $("#screen"), navEl = $("#nav"), sheetEl = $("#sheets");
  let active = null, activeKey = "", sheet = null, sheetKey = "";
  const router = createRouter(onRoute);
  const ctx = { app, store, state, router, toast,
    get route() { return router.route; },
    go: (p, q, o) => router.go(p, q, o), back: () => router.back(),
    openCard: (pid) => router.setQuery({ card: String(pid) }, { replace: false }),
    openSet: (sid) => router.go("/sets/" + sid),
  };

  applyTheme(state.prefs.theme);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(state.prefs.theme));

  navEl.innerHTML = TABS.map(([k, l, ic]) => `<button data-action="nav" data-tab="${k}" aria-label="${l}"><span class="nico">${I[ic]}${I[ic + "F"]}</span><span>${l}</span></button>`).join("");
  delegate(navEl, { nav: (el) => { const t = el.dataset.tab; if (router.route.tab === t && router.route.parts.length <= 1 && !router.route.query.card) { window.scrollTo({ top: 0, behavior: "smooth" }); return; } router.go("/" + t); } });

  function paintNav() {
    const tab = router.route.tab;
    for (const b of navEl.children) b.classList.toggle("on", b.dataset.tab === tab);
  }
  function onRoute(route) {
    const key = route.tab + "|" + route.parts.slice(1).join("/");
    const screen = screens[route.tab] || screens.home;
    if (key !== activeKey || !active) {
      if (active && active.unmount) active.unmount();
      screenEl.innerHTML = "";
      active = screen.mount(screenEl, ctx); activeKey = key;
      if (!route.query.card) window.scrollTo(0, 0);
    } else if (active.route) active.route(route);
    paintNav();
    // sheets: card detail
    const cardKey = route.query.card ? "card:" + route.query.card : "";
    if (cardKey !== sheetKey) {
      if (sheet && sheet.unmount) sheet.unmount();
      sheet = null; sheetKey = cardKey;
      if (route.query.card) sheet = mountCardSheet(sheetEl, ctx, route.query.card);
    } else if (sheet && sheet.route) sheet.route(route);
  }
  store.subscribe((s, changed) => {
    if (changed.has("prefs")) applyTheme(s.prefs.theme);
    // the catalog arrives asynchronously after boot — remount whatever is on screen
    if (changed.has("catalog")) { activeKey = ""; sheetKey = ""; onRoute(router.route); return; }
    if (active && active.update) active.update(changed);
    if (sheet && sheet.update) sheet.update(changed);
  });
  router.start();
  window.addEventListener("offline", () => toast("You’re offline — cached cards and prices only"));
  window.addEventListener("online", () => toast("Back online"));
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Update ready — it loads next time you open PokéVault"); }); });
    }).catch(() => {});
  }
  return { router, ctx };
}
