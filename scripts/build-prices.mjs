// Appends today's prices to the per-set history files.
//   node scripts/build-prices.mjs <outDir> [prevDir] [--sets 24541,23821]
// prevDir holds yesterday's files (the checked-out catalog-data branch);
// outDir receives the updated ones. Run daily by the catalog workflow.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
import { fetchSets, fetchSetPricing } from "../src/api.js";
import { flattenPricing } from "../src/pricing.js";
import { appendDay } from "../src/pricehist.js";
import { CATS } from "../src/constants.js";

const args = process.argv.slice(2);
const out = args[0] || "dist/hist", prev = args[1] && !args[1].startsWith("--") ? args[1] : out;
const only = (args.includes("--sets") ? args[args.indexOf("--sets") + 1] : "").split(",").filter(Boolean);
const day = new Date().toISOString().slice(0, 10);
mkdirSync(out, { recursive: true });
let sets = [];
for (const cat of CATS) { try { sets = sets.concat(await fetchSets(cat)); } catch (e) { if (cat === CATS[0]) throw e; } }
if (only.length) sets = sets.filter((s) => only.includes(String(s.id)));
let done = 0, failed = 0, i = 0;
async function worker() {
  while (i < sets.length) {
    const s = sets[i++];
    try {
      const prices = await fetchSetPricing(s.cat, s.id);
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
writeFileSync(join(out, "index.json"), JSON.stringify({ format: 1, day, sets: sets.length, failed }));
console.log(`price history for ${day}: ${done - failed} sets written to ${out}`);
