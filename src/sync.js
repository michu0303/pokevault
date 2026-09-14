// Cloud sync against a user-owned Supabase project via PostgREST — plain fetch,
// no SDK. Table: vault(id text pk, data text, updated_at timestamptz).
import { deriveKey, vaultId, encryptBlob, decryptBlob } from "./crypto.js";
import { normFolders } from "./collection.js";

export function normalizeSupabaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
}
export function syncConfigured(cfg) { return !!(cfg && cfg.url && cfg.key && cfg.pass); }

/** the slice of state that syncs — the catalog stays local on each device */
export function pickVault(col) {
  return { owned: col.owned, wishlist: col.wishlist, tracked: col.tracked, favorites: col.favorites, wishFolders: col.wishFolders };
}
/** adopt a remote blob into a collection object (defensive; mutates + returns col) */
export function applyVault(blob, col) {
  const obj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (obj(blob.owned)) col.owned = blob.owned;
  if (obj(blob.wishlist)) col.wishlist = blob.wishlist;
  if (obj(blob.tracked)) col.tracked = blob.tracked;
  if (obj(blob.favorites)) col.favorites = blob.favorites;
  if (Array.isArray(blob.wishFolders)) col.wishFolders = normFolders(blob.wishFolders);
  return col;
}

export function createSyncClient(cfg, fetchImpl = globalThis.fetch) {
  const base = normalizeSupabaseUrl(cfg.url);
  // Legacy anon keys are JWTs and go in both headers; the newer publishable
  // keys (sb_publishable_…) are not JWTs — the apikey header alone sets the anon role.
  const auth = /^sb_/i.test(cfg.key || "") ? {} : { Authorization: "Bearer " + cfg.key };
  async function sb(path, opts = {}) {
    const res = await fetchImpl(base + "/rest/v1/" + path, { ...opts,
      headers: { apikey: cfg.key, ...auth, ...(opts.headers || {}) } });
    if (!res.ok) {
      let detail = "";
      try { detail = ((await res.text()) || "").replace(/\s+/g, " ").trim().slice(0, 160); } catch (e) {}
      throw new Error("Cloud error " + res.status + (detail ? (": " + detail) : ""));
    }
    return res;
  }
  return {
    /** null when this passphrase has no vault yet */
    async pull() {
      const id = await vaultId(cfg.pass);
      const res = await sb("vault?id=eq." + encodeURIComponent(id) + "&select=data,updated_at", { method: "GET" });
      const rows = await res.json();
      if (!rows || !rows.length) return null;
      try { return await decryptBlob(rows[0].data, await deriveKey(cfg.pass)); }
      catch (e) { throw new Error("Wrong passphrase for this vault."); }
    },
    /** true when a vault row exists (without decrypting) — for the empty-vault warning */
    async exists() {
      const id = await vaultId(cfg.pass);
      const res = await sb("vault?id=eq." + encodeURIComponent(id) + "&select=id", { method: "GET" });
      const rows = await res.json();
      return !!(rows && rows.length);
    },
    async push(blob) {
      const id = await vaultId(cfg.pass);
      const data = await encryptBlob(blob, await deriveKey(cfg.pass));
      await sb("vault", { method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }) });
    },
  };
}
