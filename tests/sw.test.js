import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
test("sw.js VERSION matches APP_VERSION", async () => {
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  const { APP_VERSION } = await import("../src/constants.js");
  assert.equal(sw.match(/const VERSION = "([^"]+)"/)[1], APP_VERSION, "bump both together");
});
test("service worker precache list covers every module and stylesheet", () => {
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  const listed = new Set([...sw.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]));
  const files = [...walk(join(root, "src")), ...walk(join(root, "styles"))].map((p) => p.slice(root.length)).filter((p) => /\.(js|css)$/.test(p));
  const missing = files.filter((f) => !listed.has(f));
  assert.deepEqual(missing, [], "add these to SHELL_FILES in sw.js (and bump VERSION)");
  for (const f of listed) if (/\.(js|css|html|webmanifest|png|svg)$/.test(f)) assert.doesNotThrow(() => statSync(join(root, f)), f + " is listed but missing");
});
