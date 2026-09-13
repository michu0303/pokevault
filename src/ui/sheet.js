// Generic bottom sheet (filters, sort, folder pickers). Opened by putting
// ?sheet=<name> in the route so hardware back closes it; the owning screen
// mounts/unmounts it from its route() handler.
import { I } from "./icons.js";
import { $, delegate } from "./dom.js";
export function mountSheet(host, ctx, { title, html, actions = {}, onClose }) {
  host.innerHTML = `<div class="dim" data-action="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body"><div class="title"><h3>${title}</h3><button class="iconbtn" data-action="close" aria-label="Close">${I.x}</button></div><div data-region="sheetbody">${html}</div></div></div>`;
  const dim = $(".dim", host), sheet = $(".sheet", host);
  requestAnimationFrame(() => { dim.classList.add("open"); sheet.classList.add("open"); });
  document.body.style.overflow = "hidden";
  const api = {
    host, body: () => $("[data-region=sheetbody]", host),
    repaint(h) { $("[data-region=sheetbody]", host).innerHTML = h; },
    unmount() { off(); dim.classList.remove("open"); sheet.classList.remove("open"); document.body.style.overflow = ""; setTimeout(() => { if (!sheet.classList.contains("open")) { sheet.remove(); dim.remove(); } }, 260); if (onClose) onClose(); },
  };
  const off = delegate(host, { close: () => ctx.back(), ...Object.fromEntries(Object.entries(actions).map(([k, f]) => [k, (el, ev) => f(el, ev, api)])) });
  return api;
}
