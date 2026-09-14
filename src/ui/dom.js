export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
import { esc, money, cleanName } from "../util.js";
import { patternOf } from "../catalog.js";
export { esc, money };
/** "Pikachu ex - 238/191" → "Pikachu ex"; pattern products keep their pattern: "Exeggcute · Poké Ball" */
export function displayName(c) { const n = cleanName(c && c.n) || (c && c.n) || ""; const p = patternOf(c && c.n); return p ? n + " · " + p : n; }
export function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
let toastTimer = null;
export function toast(msg, { action, onAction, ms = 2400 } = {}) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
  t.classList.toggle("act", !!action); t.classList.add("show");
  if (action) $("button", t).onclick = () => { t.classList.remove("show"); if (onAction) onAction(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), action ? Math.max(ms, 4500) : ms);
}
/** long-press (≈450 ms, cancelled by movement) on elements matching selector inside root */
export function longPress(root, selector, handler, ms = 450) {
  let timer = null, el = null, x0 = 0, y0 = 0;
  const clear = () => { clearTimeout(timer); timer = null; el = null; };
  root.addEventListener("pointerdown", (e) => { const t = e.target.closest(selector); if (!t || !root.contains(t) || e.button) return; el = t; x0 = e.clientX; y0 = e.clientY; timer = setTimeout(() => { const target = el; clear(); target.dataset.lp = "1"; setTimeout(() => delete target.dataset.lp, 400); handler(target, e); }, ms); });
  root.addEventListener("pointermove", (e) => { if (timer && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) clear(); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) root.addEventListener(ev, clear);
  root.addEventListener("contextmenu", (e) => { if (e.target.closest(selector)) e.preventDefault(); });
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
/** fanned stack of up to three card images */
export function artFan(cards) {
  const cs = (cards || []).filter((c) => c && c.g).slice(0, 3);
  if (!cs.length) return `<div class="fan n1"><div class="fempty"></div></div>`;
  return `<div class="fan n${cs.length}">${cs.map((c) => `<div class="fimg">${imgTag(imgUrl(c), c.n)}</div>`).join("")}</div>`;
}
/** representative cards for a set: chase rarities first, then the first cards */
export function setSampleCards(g, n = 3) {
  if (!g) return [];
  const rank = (r) => /special illustration/i.test(r) ? 0 : /illustration rare/i.test(r) ? 1 : /hyper|secret|ultra/i.test(r) ? 2 : 9;
  const seen = new Set(), out = [];
  for (const c of g.cards.slice().sort((a, b) => rank(a.r) - rank(b.r))) { if (seen.has(c.nu)) continue; seen.add(c.nu); out.push(c); if (out.length === n) break; }
  return out;
}
export function relTime(ts) {
  if (!ts) return "";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
