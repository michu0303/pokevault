// Appends today's prices to the per-set history files.
//   node scripts/build-prices.mjs <outDir> [prevDir] [--sets 24541,23821]
// prevDir holds yesterday's files (the checked-out catalog-data branch);
// outDir receives the updated ones. Run daily by the catalog workflow.
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
import { fetchSets, fetchSetPricing } from "../src/api.js";
import { flattenPricing } from "../src/pricing.js";
import { appendDay } from "../src/pricehist.js";
import { CATS } from "../src/constants.js";
import { withFillPrices } from "../src/gapfill.js";

const args = process.argv.slice(2);
const out = args[0] || "dist/hist", prev = args[1] && !args[1].startsWith("--") ? args[1] : out;
const only = (args.includes("--sets") ? args[args.indexOf("--sets") + 1] : "").split(",").filter(Boolean);
const day = new Date().toISOString().slice(0, 10);
mkdirSync(out, { recursive: true });
let sets = [];
for (const cat of CATS) { try { sets = sets.concat(await fetchSets(cat)); } catch (e) { if (cat === CATS[0]) throw e; } }
if (only.length) sets = sets.filter((s) => only.includes(String(s.id)));
// products the catalog build filled in from TCGplayer (they carry their own prices)
const fillBySet = {};
try {
  const cat = join(out, "..", "catalog.json.gz");
  if (existsSync(cat)) for (const c of JSON.parse(gunzipSync(readFileSync(cat)).toString()).products) if (c.fp) (fillBySet[String(c.sid)] ||= []).push(c);
} catch (e) {}
let done = 0, failed = 0, i = 0;
async function worker() {
  while (i < sets.length) {
    const s = sets[i++];
    try {
      const prices = withFillPrices(await fetchSetPricing(s.cat, s.id, undefined, { retries: 3 }), fillBySet[String(s.id)]);
      const flat = flattenPricing(prices);
      const file = join(prev, s.id + ".json.gz");
      const old = existsSync(file) ? JSON.parse(gunzipSync(readFileSync(file)).toString()) : null;
      const h = appendDay(old, day, flat); h.sid = s.id;
      writeFileSync(join(out, s.id + ".json.gz"), gzipSync(Buffer.from(JSON.stringify(h)), { level: 9 }));
    } catch (e) { failed++; }
    done++; if (done % 50 === 0 || done === sets.length) console.log(`${done}/${sets.length} sets · ${failed} failed`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
// A set whose prices could not be fetched today keeps the history it already
// has: every file of the previous run that was not rewritten is carried over.
let carried = 0;
if (prev !== out && existsSync(prev)) for (const f of readdirSync(prev)) {
  if (/^\d+\.json\.gz$/.test(f) && !existsSync(join(out, f))) { copyFileSync(join(prev, f), join(out, f)); carried++; }
}
if (carried) console.log(`carried over ${carried} history files unchanged`);
writeFileSync(join(out, "index.json"), JSON.stringify({ format: 1, day, sets: sets.length, failed }));
console.log(`price history for ${day}: ${done - failed} sets written to ${out}`);
