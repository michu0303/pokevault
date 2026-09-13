// TCGTracking Open TCG API + the pre-built static catalog. Environment-neutral:
// runs in the browser and in Node (scripts/build-catalog.mjs). Parses
// responses defensively — the live API cannot be reached from every sandbox.
import { API, CATS, CATALOG_URL } from "./constants.js";
import { normalizeProduct } from "./catalog.js";

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** GET + JSON. Retries 429 / 5xx / network errors with backoff (the crawler
 *  hits the API hard; the daily build must not publish a half-empty catalog). */
export async function apiGet(path, fetchImpl = globalThis.fetch, { retries = 0, backoff = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(backoff * attempt * attempt);
    let res;
    try { res = await fetchImpl(API + path); }
    catch (e) { lastErr = new ApiError("Network error — you appear to be offline.", 0); continue; }
    if (res.ok) return res.json();
    lastErr = new ApiError("API error (" + res.status + ")", res.status);
    if (res.status === 429 || res.status >= 500) continue;
    break;
  }
  throw lastErr;
}
const setDateOf = (s) => { const d = s.published_on || s.release_date || s.released_on || ""; return d ? String(d).slice(0, 10) : ""; };

/** [{ id, name, cat, date }] for one category */
export async function fetchSets(cat, fetchImpl) {
  const r = await apiGet(`/${cat}/sets`, fetchImpl);
  const out = [];
  for (const s of (r.sets || r.data || [])) {
    const id = s.id != null ? s.id : s.set_id;
    if (id != null) out.push({ id, name: s.name || s.set_name || "", cat, date: setDateOf(s) });
  }
  return out;
}
export async function fetchSetProducts(set, fetchImpl, opts) {
  const r = await apiGet(`/${set.cat}/sets/${set.id}`, fetchImpl, opts);
  return (r.products || r.data || []).filter((p) => p && p.id != null).map((p) => normalizeProduct(p, set));
}
export async function fetchSetPricing(cat, setId, fetchImpl) {
  const r = await apiGet(`/${cat}/sets/${setId}/pricing`, fetchImpl);
  return r.prices || r.data || {};
}
/** set release dates for every category — small, separate from the catalog */
export async function fetchSetDates(fetchImpl) {
  const map = {};
  for (const cat of CATS) {
    try { for (const s of await fetchSets(cat, fetchImpl)) if (s.date) map[String(s.id)] = s.date; } catch (e) {}
  }
  return map;
}

/**
 * Crawl the whole catalog (both categories, ~250 sets). English is required;
 * Japanese is best-effort. Resolves { products, setDates, sets, failed }.
 */
export async function crawlCatalog({ fetch: fetchImpl, onProgress, concurrency = 8, retries = 2 } = {}) {
  let sets = await fetchSets(CATS[0], fetchImpl);
  if (!sets.length) throw new Error("No sets returned by the API.");
  for (const cat of CATS.slice(1)) { try { sets = sets.concat(await fetchSets(cat, fetchImpl)); } catch (e) {} }
  const products = [], setDates = {}, failedSets = []; let cur = 0, done = 0;
  for (const s of sets) if (s.date) setDates[String(s.id)] = s.date;
  async function worker() {
    while (cur < sets.length) {
      const set = sets[cur++];
      try { for (const p of await fetchSetProducts(set, fetchImpl, { retries })) products.push(p); }
      catch (e) { failedSets.push({ id: set.id, cat: set.cat, name: set.name, status: e.status || 0, error: e.message }); }
      done++; if (onProgress) onProgress({ done, total: sets.length, products: products.length, failed: failedSets.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sets.length) }, worker));
  if (!products.length) throw new Error("No card data downloaded.");
  return { products, setDates, sets, failed: failedSets.length, failedSets };
}

/* ---------- static catalog asset ---------- */
/** the JSON document the daily build publishes (gzipped) */
export function buildStaticDocument({ products, setDates, sets, failed }, builtAt = new Date().toISOString()) {
  return { format: 1, builtAt, count: products.length, failed, sets: sets.map((s) => ({ id: s.id, name: s.name, cat: s.cat, date: s.date })), setDates, products };
}
async function gunzipResponse(res) {
  const enc = (res.headers && res.headers.get && res.headers.get("content-encoding")) || "";
  const url = res.url || "";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const isGz = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGz || /gzip/i.test(enc)) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't decompress the catalog.");
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}
/** Download the pre-built catalog. Resolves the static document, or throws. */
export async function loadStaticCatalog(url = CATALOG_URL, fetchImpl = globalThis.fetch) {
  if (!url) throw new Error("no static catalog configured");
  let res;
  try { res = await fetchImpl(url, { cache: "no-store" }); } catch (e) { throw new Error("Network error — you appear to be offline."); }
  if (!res.ok) throw new Error("Catalog download failed (" + res.status + ")");
  const doc = JSON.parse(await gunzipResponse(res));
  if (!doc || doc.format !== 1 || !Array.isArray(doc.products) || !doc.products.length) throw new Error("Catalog file is not valid.");
  return doc;
}
