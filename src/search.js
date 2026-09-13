// Search: loose substring match for inclusion, ranked by matchScore. Pure.
import { SEARCH_LIMIT } from "./constants.js";

/** relevance score — higher is better. Rewards exact / whole-word hits in the
 *  card name so "Eevee V" surfaces "Eevee V" / "Eevee VMAX" above plain Eevees. */
export function matchScore(name, setn, words, full, nameWords, num) {
  let s = 0;
  if (name === full) s += 1000;                                     // exact name
  else if (num && num === full) s += 900;                           // exact collector number
  else if (name.indexOf(full) === 0) s += 480;                      // name starts with query
  else if (full.indexOf(" ") > -1 && name.indexOf(full) > -1) s += 240; // full phrase inside name
  const nw = nameWords || name.split(/\s+/);
  for (const w of words) {
    if (nw.indexOf(w) > -1) s += 120;                               // query word IS a name word
    else if (nw.some((x) => x.indexOf(w) === 0)) s += 70;           // a name word starts with it
    else if (name.indexOf(w) > -1) s += 22;                         // loose substring in name
    else if (num && num === w) s += 200;                            // word IS the collector number
    else if (num && num.indexOf(w) > -1) s += 45;                   // partial number match
    else if (setn.indexOf(w) > -1) s += 8;                          // only in the set name
  }
  s -= Math.min(name.length, 40) * 0.1;                             // tie-break: shorter names first
  return s;
}

/** Search an indexed catalog (entries must carry the _hay fields from indexCatalog). */
export function searchCatalog(catalog, term, limit = SEARCH_LIMIT) {
  const t = String(term || "").trim().toLowerCase(); if (!t) return [];
  // "RC29/RC32" → "rc29": the slash form is printed on the card, only the front half is stored
  const words = t.split(/\s+/).filter(Boolean).map((w) => w.indexOf("/") > -1 ? w.split("/")[0] : w).filter(Boolean);
  const fullScore = words.length === 1 ? words[0] : t;
  const scored = [];
  for (const c of catalog) {
    const hay = c._hay; if (!hay) continue;
    if (words.every((w) => hay.indexOf(w) > -1))
      scored.push({ c, sc: matchScore(c._nameLow, c._setLow, words, fullScore, c._nameWords, c._nuLow) });
  }
  scored.sort((a, b) => b.sc - a.sc || (a.c.n || "").localeCompare(b.c.n || ""));
  return scored.slice(0, limit).map((x) => x.c);
}
