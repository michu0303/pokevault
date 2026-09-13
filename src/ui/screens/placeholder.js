import { I } from "../icons.js";
import { delegate } from "../dom.js";
export const placeholder = (title) => ({
  mount(root, ctx) {
    root.innerHTML = `<div class="topbar"><h1>${title}</h1>${title === "Home" ? `<button class="iconbtn boxed" data-action="settings" aria-label="Settings">${I.gear}</button>` : ""}</div><div class="card empty"><b>${title}</b> is being rebuilt.<br>Use the Sets tab for now.</div>`;
    const off = delegate(root, { settings: () => ctx.go("/settings") });
    return { unmount: off };
  },
});
