import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveKey, vaultId, encryptBlob, decryptBlob, passFingerprint, b64enc, b64dec } from "../src/crypto.js";
import { createSyncClient, normalizeSupabaseUrl, pickVault, applyVault, syncConfigured } from "../src/sync.js";
import { emptyCollection } from "../src/collection.js";
import { fakeFetch } from "./helpers.js";

test("base64 round-trip on large buffers", () => {
  const big = new Uint8Array(70000).map((_, i) => i % 251);
  assert.deepEqual(b64dec(b64enc(big)), big);
});
test("encrypt → decrypt round-trip; wrong passphrase fails; ids are stable", async () => {
  const key = await deriveKey("correct horse");
  const blob = { owned: { 1: { Normal: 2 } }, wishlist: {} };
  const ct = await encryptBlob(blob, key);
  assert.notEqual(ct, await encryptBlob(blob, key), "fresh IV every time");
  assert.deepEqual(await decryptBlob(ct, key), blob);
  await assert.rejects(decryptBlob(ct, await deriveKey("wrong")));
  const id = await vaultId("correct horse");
  assert.match(id, /^[0-9a-f]{64}$/); assert.equal(id, await vaultId("correct horse"));
  assert.equal((await passFingerprint("correct horse")).length, 6);
});
test("url normalisation and config check", () => {
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl(" https://abc.supabase.co// "), "https://abc.supabase.co");
  assert.equal(syncConfigured({ url: "u", key: "k", pass: "" }), false);
});
test("sync client: pull null on empty vault, push upserts with the anon headers, pull decrypts", async () => {
  const cfg = { url: "https://abc.supabase.co/", key: "anon-key", pass: "pw" };
  let stored = null;
  const fetch = fakeFetch({
    "re:/rest/v1/vault\\?id=eq\\.": () => stored ? [stored] : [],
    "re:/rest/v1/vault$": (url, opts) => { stored = JSON.parse(opts.body); return { status: 201, body: "" }; },
  });
  const c = createSyncClient(cfg, fetch);
  assert.equal(await c.pull(), null);
  assert.equal(await c.exists(), false);
  await c.push({ owned: { 7: { Normal: 1 } } });
  const call = fetch.calls.find((x) => x.opts.method === "POST");
  assert.equal(call.url, "https://abc.supabase.co/rest/v1/vault");
  assert.equal(call.opts.headers.apikey, "anon-key");
  assert.equal(call.opts.headers.Authorization, "Bearer anon-key");
  assert.match(call.opts.headers.Prefer, /merge-duplicates/);
  assert.equal(stored.id, await vaultId("pw"));
  assert.equal(await c.exists(), true);
  assert.deepEqual(await c.pull(), { owned: { 7: { Normal: 1 } } });
  await assert.rejects(createSyncClient({ ...cfg, pass: "other" }, fakeFetch({ "re:vault": () => [stored] })).pull(), /Wrong passphrase/);
  await assert.rejects(createSyncClient(cfg, fakeFetch({ "re:vault": { status: 401, body: "bad key" } })).pull(), /Cloud error 401: bad key/);
});
test("pickVault / applyVault", () => {
  const col = emptyCollection(); col.owned = { 1: { Normal: 1 } };
  assert.deepEqual(Object.keys(pickVault(col)), ["owned", "wishlist", "tracked", "favorites", "wishFolders"]);
  applyVault({ owned: { 2: { Normal: 1 } }, wishlist: "junk", wishFolders: [{ name: "x" }] }, col);
  assert.deepEqual(col.owned, { 2: { Normal: 1 } });
  assert.deepEqual(col.wishlist, {}, "junk is ignored");
  assert.equal(col.wishFolders[0].name, "x");
});
