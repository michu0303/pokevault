// In-app dialogs (native prompt()/confirm() are blocked in embedded browsers
// and iOS home-screen apps). Both return promises; Escape / backdrop cancel.
import { I } from "./icons.js";
import { esc, $ } from "./dom.js";
function host() { let h = $("#dialog"); if (!h) { h = document.createElement("div"); h.id = "dialog"; document.body.appendChild(h); } return h; }
function open(html) {
  const h = host();
  h.innerHTML = `<div class="dim" data-role="dim"></div><div class="sheet dialog" role="dialog" aria-modal="true"><div class="grip"></div><div class="body">${html}</div></div>`;
  const dim = $(".dim", h), sheet = $(".sheet", h);
  requestAnimationFrame(() => { dim.classList.add("open"); sheet.classList.add("open"); });
  return { h, dim, sheet, close() { dim.classList.remove("open"); sheet.classList.remove("open"); setTimeout(() => { dim.remove(); sheet.remove(); }, 220); } };
}
/** text input; resolves the trimmed string or null when cancelled */
export function askText({ title, placeholder = "", value = "", ok = "Save" }) {
  return new Promise((resolve) => {
    const d = open(`<div class="title"><h3>${esc(title)}</h3></div><div class="field"><input data-role="in" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></div><div class="row2"><button class="btn ghost" data-role="cancel">Cancel</button><button class="btn" data-role="ok">${esc(ok)}</button></div>`);
    const input = $("[data-role=in]", d.h);
    const done = (v) => { d.close(); resolve(v); };
    d.h.onclick = (e) => { const r = e.target.closest("[data-role]"); if (!r) return; if (r.dataset.role === "ok") done(input.value.trim() || null); else if (r.dataset.role === "cancel" || r.dataset.role === "dim") done(null); };
    input.onkeydown = (e) => { if (e.key === "Enter") done(input.value.trim() || null); if (e.key === "Escape") done(null); };
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}
/** confirmation; resolves true / false. `alt` adds a third, non-destructive choice that resolves "alt". */
export function askConfirm({ title, message = "", ok = "OK", cancel = "Cancel", danger = false, alt = "" }) {
  return new Promise((resolve) => {
    const d = open(`<div class="title"><h3>${esc(title)}</h3></div>${message ? `<p class="muted" style="margin:0;font-size:13.5px;line-height:1.5;white-space:pre-line">${esc(message)}</p>` : ""}<div class="stack"><button class="btn ${danger ? "danger" : ""}" data-role="ok">${esc(ok)}</button>${alt ? `<button class="btn ghost" data-role="alt">${esc(alt)}</button>` : ""}<button class="btn ghost" data-role="cancel">${esc(cancel)}</button></div>`);
    const done = (v) => { d.close(); resolve(v); };
    d.h.onclick = (e) => { const r = e.target.closest("[data-role]"); if (!r) return; done(r.dataset.role === "ok" ? true : r.dataset.role === "alt" ? "alt" : false); };
    const key = (e) => { if (e.key === "Escape") { document.removeEventListener("keydown", key); done(false); } };
    document.addEventListener("keydown", key);
  });
}
