// Builds the static catalog asset the app downloads on first run instead of
// making ~250 API calls. Run daily by .github/workflows/catalog.yml.
//   node scripts/build-catalog.mjs [outDir] [prevDir] [--no-fill]
// prevDir holds the previous run's catalog-fill.json (the record of products
// filled in from TCGCSV), so the build can report when TCGTracking catches up.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { crawlCatalog, buildStaticDocument, fillCatalogGaps } from "../src/api.js";
import { trackFill } from "../src/gapfill.js";

const argv = process.argv.slice(2), pos = argv.filter((a) => !a.startsWith("--"));
const out = pos[0] || "dist", prevDir = pos[1] || out;
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

// Fill what TCGTracking has not synced yet from TCGplayer's own list, and keep
// a running record so every build re-checks whether the API has caught up.
const haveAll = new Set(result.products.map((p) => String(p.i)));
let fill = { filled: [], checked: 0, errors: 0 }, last2 = 0;
if (!argv.includes("--no-fill")) {
  try {
    fill = await fillCatalogGaps(result, { onProgress: (p) => { if (Date.now() - last2 > 2000 || p.done === p.total) { last2 = Date.now(); console.log(`gap check ${p.done}/${p.total} sets · ${p.filled} filled · ${p.errors} errors`); } } });
  } catch (e) { console.log("gap fill skipped:", e.message); }
}
const prevFile = join(prevDir, "catalog-fill.json");
let prevFill = null; try { if (existsSync(prevFile)) prevFill = JSON.parse(readFileSync(prevFile, "utf8")); } catch (e) {}
// when TCGCSV was unreachable, keep yesterday's record rather than declaring everything caught up
const track = fill.checked ? trackFill(prevFill, fill.filled, haveAll, new Date().toISOString().slice(0, 10)) : prevFill;
for (const c of fill.filled) result.products.push(c);
if (track) {
  const bySet = {}; for (const id in track.open) { const o = track.open[id]; bySet[o.set] = (bySet[o.set] || 0) + 1; }
  console.log(`filled from TCGplayer: ${Object.keys(track.open).length} products in ${Object.keys(bySet).length} sets`);
  for (const [n, c] of Object.entries(bySet).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log("   ", c, n);
  for (const c of track.newlyCaughtUp || []) console.log(`caught up: TCGTracking now lists ${c.n} ${c.nu} (${c.set}) — filled since ${c.since}`);
  const { fresh, newlyCaughtUp, ...keep } = track;
  writeFileSync(join(out, "catalog-fill.json"), JSON.stringify(keep));
}
const doc = buildStaticDocument(result);
const json = JSON.stringify(doc);
const gz = gzipSync(Buffer.from(json), { level: 9 });
writeFileSync(join(out, "catalog.json.gz"), gz);
writeFileSync(join(out, "catalog-meta.json"), JSON.stringify({ format: 1, builtAt: doc.builtAt, count: doc.count, sets: doc.sets.length, failed: doc.failed, filled: fill.filled.length, bytes: gz.length }, null, 2));
console.log(`wrote ${out}/catalog.json.gz (${(gz.length / 1048576).toFixed(2)} MB, ${doc.count} products, ${doc.sets.length} sets)`);
