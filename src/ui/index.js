import { mountShell } from "./shell.js";
import * as home from "./screens/home.js";
import * as sets from "./screens/sets.js";
import * as setDetail from "./screens/setDetail.js";
import * as search from "./screens/search.js";
import * as collection from "./screens/collection.js";
import * as wishlist from "./screens/wishlist.js";
import * as settings from "./screens/settings.js";

export function mountUI(app) {
  const setsTab = { mount(root, ctx) { return (ctx.route.parts[1] ? setDetail : sets).mount(root, ctx); } };
  return mountShell(app, { home, sets: setsTab, search, collection, wishlist, settings });
}
