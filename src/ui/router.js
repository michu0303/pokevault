// Hash router. Every screen state that the back button should undo lives in
// the URL: "#/sets/23821?view=binder&page=2&card=610356". Sheets are query
// params on top of the current route, so hardware back closes them.
export function parseHash(hash = location.hash) {
  const h = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart = ""] = h.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const query = {};
  for (const kv of queryPart.split("&")) { if (!kv) continue; const [k, v = ""] = kv.split("="); query[decodeURIComponent(k)] = decodeURIComponent(v); }
  return { path: "/" + parts.join("/"), parts, tab: parts[0] || "home", query };
}
export function buildHash(path, query = {}) {
  const q = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
  return "#" + (path.startsWith("/") ? path : "/" + path) + (q ? "?" + q : "");
}
export function createRouter(onChange) {
  let current = parseHash();
  const handler = () => { current = parseHash(); onChange(current); };
  window.addEventListener("hashchange", handler);
  return {
    get route() { return current; },
    /** navigate; replace=true swaps the current entry (filters, pages) instead of pushing */
    go(path, query = {}, { replace = false } = {}) {
      const h = buildHash(path, query);
      if (h === location.hash) return;
      if (replace) history.replaceState(null, "", h); else location.hash = h;
      if (replace) handler();
    },
    /** merge query params onto the current route */
    setQuery(patch, { replace = true } = {}) {
      const q = { ...current.query, ...patch };
      for (const k in q) if (q[k] === null || q[k] === undefined || q[k] === "") delete q[k];
      this.go(current.path, q, { replace });
    },
    back() { if (history.length > 1) history.back(); else this.go("/home"); },
    start() { handler(); },
  };
}
