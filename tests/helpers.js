import { readFileSync } from "node:fs";
import { normalizeProduct, indexCatalog } from "../src/catalog.js";

export const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

/** fake localStorage backed by a Map (with an optional quota for failure tests) */
export function fakeLS(quota = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (String(v).length > quota) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(), get size() { return m.size; }, keys: () => [...m.keys()],
  };
}
/** build + index a catalog from one or more fixtures (fresh objects every call) */
export function catalogFrom(...names) {
  const catalog = [];
  for (const n of names) { const f = fixture(n); for (const p of f.products) catalog.push(normalizeProduct(p, f.set)); }
  const idx = indexCatalog(catalog);
  return { catalog, ...idx };
}
export const byName = (catalog, name) => catalog.find((c) => c.n === name);
/** fake fetch: routes[pathSuffixOrRegex] → body (object) or {status, body} */
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [k, v] of Object.entries(routes)) {
      const hit = k.startsWith("re:") ? new RegExp(k.slice(3)).test(url) : url.endsWith(k);
      if (!hit) continue;
      const r = typeof v === "function" ? v(url, opts) : v;
      const status = r && r.status ? r.status : 200, body = r && r.status !== undefined ? r.body : r;
      return { ok: status < 300, status, url, headers: { get: () => null },
        json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
        arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new TextEncoder().encode(JSON.stringify(body)).buffer) };
    }
    return { ok: false, status: 404, url, headers: { get: () => null }, json: async () => ({}), text: async () => "not found", arrayBuffer: async () => new ArrayBuffer(0) };
  };
  fn.calls = calls;
  return fn;
}
