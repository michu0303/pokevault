import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { fetchSets, crawlCatalog, buildStaticDocument, loadStaticCatalog, fetchSetDates } from "../src/api.js";
import { fixture, fakeFetch } from "./helpers.js";

const pre = fixture("prismatic"), ssp = fixture("surging");
const routes = {
  "/3/sets": { sets: [{ id: 23821, name: pre.set.name, published_on: "2025-01-17" }, { id: 23651, name: ssp.set.name, published_on: "2024-11-08T00:00:00Z" }, { id: 1, name: "Broken" }] },
  "/85/sets": { sets: [{ id: 900, name: "JP Set", published_on: "2025-03-01" }] },
  "/3/sets/23821": { products: pre.products.map((p) => ({ ...p, set_name: pre.set.name })) },
  "/3/sets/23651": { products: ssp.products },
  "/3/sets/1": { status: 500, body: "boom" },
  "/85/sets/900": { products: [{ id: 5, name: "JP card", number: "1/10", rarity: "C" }] },
};

test("fetchSets normalises ids, names and dates", async () => {
  const sets = await fetchSets(3, fakeFetch(routes));
  assert.deepEqual(sets[1], { id: 23651, name: ssp.set.name, cat: 3, date: "2024-11-08" });
  assert.equal(sets[2].date, "");
});
test("crawlCatalog walks both categories, tags cat, counts failures, reports progress", async () => {
  const progress = [];
  const r = await crawlCatalog({ fetch: fakeFetch(routes), onProgress: (p) => progress.push(p), concurrency: 2 });
  assert.equal(r.sets.length, 4);
  assert.equal(r.failed, 1);
  assert.equal(r.products.length, 20 + 5 + 1);
  assert.equal(r.products.find((p) => p.i === 5).cat, 85);
  assert.equal(r.products.find((p) => p.i === 610356).s, pre.set.name);
  assert.deepEqual(r.setDates, { 23821: "2025-01-17", 23651: "2024-11-08", 900: "2025-03-01" });
  assert.equal(progress.at(-1).done, 4);
  assert.deepEqual(await fetchSetDates(fakeFetch(routes)), r.setDates);
});
test("crawlCatalog fails loudly when English sets are unavailable", async () => {
  await assert.rejects(crawlCatalog({ fetch: fakeFetch({ "/3/sets": { status: 503, body: "" } }) }), /API error \(503\)/);
});
test("static catalog: build → gzip → load (DecompressionStream path) and validation", async () => {
  const r = await crawlCatalog({ fetch: fakeFetch(routes) });
  const doc = buildStaticDocument(r, "2026-09-13T06:17:00Z");
  assert.equal(doc.format, 1); assert.equal(doc.count, 26); assert.equal(doc.sets.length, 4);
  const gz = new Uint8Array(gzipSync(Buffer.from(JSON.stringify(doc))));
  const loaded = await loadStaticCatalog("https://example.test/catalog.json.gz", fakeFetch({ "catalog.json.gz": gz }));
  assert.equal(loaded.builtAt, "2026-09-13T06:17:00Z");
  assert.equal(loaded.products.length, 26);
  assert.deepEqual(loaded.setDates, r.setDates);
  await assert.rejects(loadStaticCatalog("https://example.test/x.json.gz", fakeFetch({ "x.json.gz": { format: 0, products: [] } })), /not valid/);
  await assert.rejects(loadStaticCatalog("https://example.test/y.json.gz", fakeFetch({})), /404/);
  await assert.rejects(loadStaticCatalog("", fakeFetch({})), /no static catalog/);
});
