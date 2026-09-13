// Client-side encryption for cloud sync (Web Crypto). The passphrase never
// leaves the device; the server only ever holds ciphertext.
const subtle = () => {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error("Encryption needs a secure (https) context.");
  return c.subtle;
};
export function b64enc(bytes) {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64dec(str) { return Uint8Array.from(atob(str), (c) => c.charCodeAt(0)); }
/** PBKDF2 (100k, SHA-256, fixed salt) → AES-GCM-256 key */
export async function deriveKey(pass) {
  const enc = new TextEncoder();
  const base = await subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt: enc.encode("pokevault-sync-v1"), iterations: 100000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
/** row id = SHA-256 hex of "pokevault::" + passphrase */
export async function vaultId(pass) {
  const buf = await subtle().digest("SHA-256", new TextEncoder().encode("pokevault::" + pass));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** short fingerprint shown in Settings so two devices can confirm they typed the same passphrase */
export async function passFingerprint(pass) { return (await vaultId(pass)).slice(0, 6); }
/** base64( iv[12] ++ ciphertext ) */
export async function encryptBlob(obj, key) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  const both = new Uint8Array(iv.length + ct.byteLength);
  both.set(iv, 0); both.set(new Uint8Array(ct), iv.length);
  return b64enc(both);
}
export async function decryptBlob(b64, key) {
  const raw = b64dec(b64);
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}
