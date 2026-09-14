// Server-side price history. The daily build appends one column per day to a
// per-set file: { format:1, sid, days:["YYYY-MM-DD",…], v:{pid:variant},
// p:{pid:[price|null per day]} }. Only the primary printing is tracked — the
// same number the app shows. Pure functions; used by the build and the app.
import { primaryVariant } from "./pricing.js";
export const HIST_DAYS = 365;

/** append (or replace) today's column from a flattened set pricing map */
export function appendDay(hist, day, flat, cap = HIST_DAYS) {
  const h = hist && hist.format === 1 ? { format: 1, sid: hist.sid, days: hist.days.slice(), v: { ...hist.v }, p: {} } : { format: 1, sid: undefined, days: [], v: {}, p: {} };
  for (const pid in (hist && hist.p) || {}) h.p[pid] = hist.p[pid].slice();
  let col = h.days.indexOf(day);
  if (col < 0) {                                   // insert in date order (backfills arrive out of order)
    col = h.days.findIndex((d) => d > day); if (col < 0) col = h.days.length;
    h.days.splice(col, 0, day); for (const pid in h.p) h.p[pid].splice(col, 0, null);
  }
  for (const pid in flat) {
    const v = h.v[pid] || primaryVariant(flat, pid);
    const px = flat[pid][v] != null ? flat[pid][v] : null;
    if (!h.p[pid]) { h.p[pid] = new Array(h.days.length).fill(null); h.v[pid] = v; }
    h.p[pid][col] = px == null ? null : Math.round(px * 100) / 100;
  }
  if (h.days.length > cap) { const drop = h.days.length - cap; h.days = h.days.slice(drop); for (const pid in h.p) h.p[pid] = h.p[pid].slice(drop); }
  return h;
}
/** [{ d, v }] for one product, skipping days without a price */
export function seriesOf(hist, pid) {
  if (!hist || !hist.p || !hist.p[String(pid)]) return [];
  const row = hist.p[String(pid)], out = [];
  for (let i = 0; i < hist.days.length; i++) if (row[i] != null) out.push({ d: hist.days[i], v: row[i] });
  return out;
}
/** merge server + local series by date; server wins on the same day */
export function mergeSeries(server, local) {
  const m = new Map();
  for (const p of local || []) m.set(p.d, p.v);
  for (const p of server || []) m.set(p.d, p.v);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ d, v }));
}
