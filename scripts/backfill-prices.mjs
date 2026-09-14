// Backfills per-set price history from TCGCSV's daily TCGplayer archives
// (https://tcgcsv.com/faq — "Are there any past prices available?"), which
// use the same product / set ids as TCGTracking. One archive per day (~4 MB,
// every category); we extract only Pokémon (3) and Pokémon Japan (85).
//   node scripts/backfill-prices.mjs <histDir> --from 2024-02-08 [--to 2026-09-13] [--sets 24541,…]
// Requires 7z / 7zz on PATH. Existing files in histDir are updated in place.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, mkdtempSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { appendDay } from "../src/pricehist.js";
import { CATS } from "../src/constants.js";

const args = process.argv.slice(2);
const dir = args[0] && !args[0].startsWith("--") ? args[0] : "dist/hist";
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from"), to = opt("--to", new Date().toISOString().slice(0, 10));
const only = new Set((opt("--sets", "") || "").split(",").filter(Boolean));
if (!from) { console.error("usage: backfill-prices.mjs <histDir> --from YYYY-MM-DD [--to YYYY-MM-DD] [--sets a,b]"); process.exit(2); }
const SEVEN = ["7zz", "7z", "7za"].find((b) => { try { execFileSync(b, ["i"], { stdio: "ignore" }); return true; } catch (e) { return false; } });
if (!SEVEN) { console.error("7-Zip not found on PATH (brew install sevenzip / apt install p7zip-full)"); process.exit(2); }
mkdirSync(dir, { recursive: true });

// load existing history files once; write once at the end
const hist = new Map();
for (const f of readdirSync(dir)) if (/^\d+\.json\.gz$/.test(f)) hist.set(f.replace(".json.gz", ""), JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()));
const days = []; for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
console.log(`backfilling ${days.length} days into ${dir} (${hist.size} existing sets)`);
const work = mkdtempSync(join(tmpdir(), "pvbf-"));
let ok = 0, missing = 0;
for (const day of days) {
  const url = `https://tcgcsv.com/archive/tcgplayer/prices-${day}.ppmd.7z`, file = join(work, "a.7z");
  const res = await fetch(url);
  if (!res.ok) { missing++; continue; }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const out = join(work, "x"); rmSync(out, { recursive: true, force: true });
  try { execFileSync(SEVEN, ["x", "-y", "-o" + out, file, ...CATS.map((c) => `${day}/${c}/*`)], { stdio: "ignore" }); } catch (e) { missing++; continue; }
  for (const cat of CATS) {
    const base = join(out, day, String(cat)); if (!existsSync(base)) continue;
    for (const sid of readdirSync(base)) {
      if (only.size && !only.has(sid)) continue;
      const pf = join(base, sid, "prices"); if (!existsSync(pf)) continue;
      let j; try { j = JSON.parse(readFileSync(pf, "utf8")); } catch (e) { continue; }
      const flat = {};
      for (const r of j.results || []) {
        const px = r.marketPrice != null ? r.marketPrice : r.midPrice != null ? r.midPrice : r.lowPrice;
        if (px == null || r.productId == null) continue;
        (flat[String(r.productId)] ||= {})[r.subTypeName || "Normal"] = px;
      }
      if (!Object.keys(flat).length) continue;
      const h = appendDay(hist.get(sid), day, flat); h.sid = +sid; hist.set(sid, h);
    }
  }
  ok++; if (ok % 10 === 0) console.log(`${day} · ${ok} days done · ${missing} missing`);
}
for (const [sid, h] of hist) writeFileSync(join(dir, sid + ".json.gz"), gzipSync(Buffer.from(JSON.stringify(h)), { level: 9 }));
rmSync(work, { recursive: true, force: true });
console.log(`done: ${ok} days applied, ${missing} missing, ${hist.size} set files written`);
