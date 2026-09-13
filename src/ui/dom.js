export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
import { esc, money } from "../util.js";
export { esc, money };
export function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
let toastTimer = null;
export function toast(msg) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
/** delegate data-action clicks inside root to handlers[action](el, ev) */
export function delegate(root, handlers) {
  const fn = (ev) => {
    const el = ev.target.closest("[data-action]"); if (!el || !root.contains(el)) return;
    const h = handlers[el.dataset.action]; if (!h) return;
    ev.preventDefault(); h(el, ev);
  };
  root.addEventListener("click", fn);
  return () => root.removeEventListener("click", fn);
}
/** card image URL; the API serves _200w thumbnails, _400w for detail */
export function imgUrl(c, size = 200) { const u = (c && c.g) || ""; return size === 200 ? u : u.replace(/_200w\./, "_" + size + "w."); }
/** <img> that fades in once loaded (skeleton stays visible until then) */
export function imgTag(src, alt = "") { return src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="this.classList.add('ld')">` : ""; }
export function progressRing(pct, size = 56, stroke = 6) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--soft)" stroke-width="${stroke}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--bar)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}
export function sparkline(values, { w = 110, h = 36, stroke = "var(--spark)", fill = "var(--spark-fill)" } = {}) {
  const pts = values.filter((v) => typeof v === "number");
  if (pts.length < 2) return "";
  const max = Math.max(...pts), min = Math.min(...pts), n = pts.length;
  const xy = pts.map((v, i) => [(i / (n - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const line = xy.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${h} ${line} ${w},${h}" fill="${fill}"/><polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/** set abbreviation for the neutral set badge: "SV: Prismatic Evolutions" → "PRE" */
export function setAbbr(name) {
  const n = String(name || "").replace(/^[A-Z0-9]+\s*[:\-–]\s*/, "").replace(/[()\[\]]/g, "");
  const words = n.split(/\s+/).filter((w) => w && !/^(the|of|and|&)$/i.test(w));
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return n.slice(0, 3).toUpperCase();
}
export function relTime(ts) {
  if (!ts) return "";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
