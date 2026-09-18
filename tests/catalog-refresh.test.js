import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogIsStale, fetchCatalogMeta } from "../src/api.js";
import { createApp } from "../src/app.js";
import { fakeFetch, fakeLS } from "./helpers.js";

test("catalogIsStale is conservative: only a strictly newer, valid remote counts", () => {
  const local = { builtAt: "2026-09-14T07:00:00.000Z", count: 63145 };
  assert.equal(catalogIsStale(local, { builtAt: "2026-09-17T11:39:54.716Z", count: 63285 }), true);
  assert.equal(catalogIsStale(local, { builtAt: "2026-09-14T07:00:00.000Z", count: 63145 }), false, "same build");
  assert.equal(catalogIsStale(local, { builtAt: "2026-09-10T00:00:00.000Z", count: 70000 }), false, "older remote never wins");
  assert.equal(catalogIsStale(local, null), false);
  assert.equal(catalogIsStale(local, { builtAt: "2026-09-17T00:00:00Z", count: 0 }), false, "empty remote is ignored");
  assert.equal(catalogIsStale(null, { builtAt: "2026-09-17T00:00:00Z", count: 5 }), true, "no local metadata → refresh");
  assert.equal(catalogIsStale({ count: 5 }, { builtAt: "2026-09-17T00:00:00Z", count: 5 }), true, "local without a date → refresh");
});
test("fetchCatalogMeta never throws and rejects malformed metadata", async () => {
  const ok = { format: 1, builtAt: "2026-09-17T11:39:54.716Z", count: 63285 };
  assert.deepEqual(await fetchCatalogMeta("https://x/catalog-meta.json", fakeFetch({ "catalog-meta.json": ok })), ok);
  assert.equal(await fetchCatalogMeta("https://x/catalog-meta.json", fakeFetch({})), null, "404");
  assert.equal(await fetchCatalogMeta("https://x/catalog-meta.json", fakeFetch({ "catalog-meta.json": { format: 2, builtAt: "x", count: 1 } })), null);
  assert.equal(await fetchCatalogMeta("https://x/catalog-meta.json", async () => { throw new Error("offline"); }), null);
  assert.equal(await fetchCatalogMeta("", fakeFetch({})), null);
});
test("refreshCatalogIfStale does nothing without a local catalog and never throws", async () => {
  const app = createApp({ ls: fakeLS(), idb: undefined, fetch: async () => { throw new Error("offline"); }, catalogUrl: "https://x/catalog.json.gz" });
  assert.deepEqual(await app.refreshCatalogIfStale({ force: true }), { updated: false });
});
