// Builds the static catalog asset the app downloads on first run instead of
// making ~250 API calls. Run daily by .github/workflows/catalog.yml.
//   node scripts/build-catalog.mjs [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { crawlCatalog, buildStaticDocument } from "../src/api.js";

const out = process.argv[2] || "dist";
mkdirSync(out, { recursive: true });
let last = 0;
const result = await crawlCatalog({
  onProgress: (p) => { if (Date.now() - last > 2000 || p.done === p.total) { last = Date.now(); console.log(`${p.done}/${p.total} sets · ${p.products} products · ${p.failed} failed`); } },
});
if (result.failedSets.length) {
  const byStatus = {}; for (const f of result.failedSets) byStatus[f.status] = (byStatus[f.status] || 0) + 1;
  console.log("failed sets by status:", JSON.stringify(byStatus));
  for (const f of result.failedSets.slice(0, 12)) console.log("  ", f.cat, f.id, f.name, "→", f.error);
}
// Sets that 404 are simply empty on the API side; anything else failing in bulk means the crawl is unreliable.
const hardFailed = result.failedSets.filter((f) => f.status !== 404).length;
if (hardFailed > result.sets.length * 0.05) { console.error(`Too many failed sets (${hardFailed}/${result.sets.length}); not publishing.`); process.exit(1); }
const doc = buildStaticDocument(result);
const json = JSON.stringify(doc);
const gz = gzipSync(Buffer.from(json), { level: 9 });
writeFileSync(join(out, "catalog.json.gz"), gz);
writeFileSync(join(out, "catalog-meta.json"), JSON.stringify({ format: 1, builtAt: doc.builtAt, count: doc.count, sets: doc.sets.length, failed: doc.failed, bytes: gz.length }, null, 2));
console.log(`wrote ${out}/catalog.json.gz (${(gz.length / 1048576).toFixed(2)} MB, ${doc.count} products, ${doc.sets.length} sets)`);
