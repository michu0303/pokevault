// Line chart for value / price history: area + line, min/max on the left,
// first/last date at the bottom, end-point dot. Pure SVG, tokens for colour.
import { esc, money } from "./dom.js";
/** compact axis money: $2.2k / $958 / $4.41 */
export const compact = (v) => v >= 10000 ? "$" + (v / 1000).toFixed(1) + "k" : v >= 1000 ? "$" + (v / 1000).toFixed(2) + "k" : v >= 100 ? "$" + Math.round(v) : money(v);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
export function lineChart(series, { w = 340, h = 120, pad = { l: 46, r: 12, t: 10, b: 20 }, format = compact } = {}) {
  const pts = (series || []).filter((p) => typeof p.v === "number");
  if (pts.length < 2) return "";
  const vs = pts.map((p) => p.v), max = Math.max(...vs), min = Math.min(...vs);
  const span = max - min || Math.max(max * 0.1, 1);
  const y0 = min === max ? min - span / 2 : min, y1 = min === max ? max + span / 2 : max;
  const X = (i) => pad.l + (i / (pts.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.v).toFixed(1)).join(" ");
  const last = pts[pts.length - 1], up = last.v >= pts[0].v;
  const stroke = up ? "var(--spark)" : "var(--neg)", fill = up ? "var(--spark-fill)" : "rgba(180,72,90,.12)";
  const grid = [y1, (y0 + y1) / 2, y0].map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--border)" stroke-dasharray="2 4"/><text x="${pad.l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="var(--sec)">${esc(format(v))}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Value over time">${grid}
    <polygon points="${X(0).toFixed(1)},${(h - pad.b).toFixed(1)} ${line} ${X(pts.length - 1).toFixed(1)},${(h - pad.b).toFixed(1)}" fill="${fill}"/>
    <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="4" fill="${stroke}" stroke="var(--surface)" stroke-width="2"/>
    <text x="${pad.l}" y="${h - 5}" font-size="9.5" font-weight="700" fill="var(--sec)">${esc(fmtDate(pts[0].d))}</text>
    <text x="${w - pad.r}" y="${h - 5}" text-anchor="end" font-size="9.5" font-weight="700" fill="var(--sec)">${esc(fmtDate(last.d))}</text></svg>`;
}
/** change over a series: { diff, pct, from, to } or null */
export function seriesDelta(series) {
  const pts = (series || []).filter((p) => typeof p.v === "number");
  if (pts.length < 2) return null;
  const a = pts[0].v, b = pts[pts.length - 1].v;
  return { diff: b - a, pct: a > 0 ? (b - a) / a * 100 : 0, from: pts[0].d, to: pts[pts.length - 1].d, days: pts.length };
}
export const RANGES = [["7", "7d"], ["30", "30d"], ["365", "1y"], ["0", "All"]];
export function rangeChips(cur, action = "range") { return `<div class="chips ranges">${RANGES.map(([v, l]) => `<button class="chip ${cur === v ? "on" : ""}" data-action="${action}" data-v="${v}">${l}</button>`).join("")}</div>`; }
export function deltaLine(delta, unit = "") {
  if (!delta || Math.abs(delta.diff) < 0.005) return `<span class="muted">No change over this period</span>`;
  return `<span style="font-weight:800;color:${delta.diff >= 0 ? "var(--pos-text)" : "var(--neg)"}">${delta.diff >= 0 ? "▲" : "▼"} ${money(Math.abs(delta.diff))}${unit} · ${Math.abs(delta.pct).toFixed(1)}%</span> <span class="muted">since ${fmtDate(delta.from)}</span>`;
}
