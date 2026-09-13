import { mountShell } from "./shell.js";
import * as sets from "./screens/sets.js";
import * as setDetail from "./screens/setDetail.js";
import * as settings from "./screens/settings.js";
import { placeholder } from "./screens/placeholder.js";

/** route tab → screen; "sets/<id>" is chosen inside a wrapper so the tab stays "sets" */
export function mountUI(app) {
  const setsTab = { mount(root, ctx) { return (ctx.route.parts[1] ? setDetail : sets).mount(root, ctx); } };
  return mountShell(app, {
    home: placeholder("Home"), sets: setsTab, search: placeholder("Search"), collection: placeholder("Collection"), wishlist: placeholder("Wishlist"), settings,
  });
}
