export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (n) => (n == null || isNaN(n)) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtSigned(n) { if (n == null || isNaN(n)) return "—"; return (n < 0 ? "-$" : "+$") + Math.abs(n).toFixed(2); }
export const today = (d = new Date()) => d.toISOString().slice(0, 10);
export const normSid = (s) => (s != null && s !== "" && !isNaN(+s)) ? +s : s;

/** "Pikachu ex - 238/191" → "Pikachu ex"; "Foo (Poke Ball Pattern)" → "Foo" */
export function cleanName(n) {
  return String(n || "").replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*[-–—]\s*\d[\w/]*\s*$/, "").trim();
}
/** compare set IDs — numeric where possible (release-order proxy) */
export function cmpSid(a, b) {
  const an = +a, bn = +b;
  if (!isNaN(an) && !isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}
/** natural compare of collector numbers: "001/131" < "010/131", "RC29" < "RC30", empty last */
export function cmpNum(a, b) {
  if (!a && !b) return 0; if (!a) return 1; if (!b) return -1;
  const ax = String(a).split("/")[0].match(/\d+|\D+/g) || [];
  const bx = String(b).split("/")[0].match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const aa = ax[i], bb = bx[i];
    if (aa == null) return -1; if (bb == null) return 1;
    if (/^\d+$/.test(aa) && /^\d+$/.test(bb)) { const d = parseInt(aa, 10) - parseInt(bb, 10); if (d) return d; }
    else { const d = String(aa).localeCompare(String(bb)); if (d) return d; }
  }
  return 0;
}
