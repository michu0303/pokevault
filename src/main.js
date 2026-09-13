// Entry point re-exported for the shell; allows a `?catalog=` override while
// the static asset is being set up, e.g. app.html?catalog=http://localhost:8080/dist/catalog.json.gz
import { createApp as create } from "./app.js";
export function createApp(opts = {}) {
  const q = new URLSearchParams(location.search).get("catalog");
  return create(q ? { ...opts, catalogUrl: q } : opts);
}
