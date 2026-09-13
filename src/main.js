// Entry point re-exported for the shell; allows a `?catalog=` override while
// the static asset is being set up, e.g. app.html?catalog=http://localhost:8080/dist/catalog.json.gz
import { createApp as create } from "./app.js";
export function createApp(opts = {}) {
  const params = new URLSearchParams(location.search);
  const q = params.get("catalog");
  const app = create(q ? { ...opts, catalogUrl: q } : opts);
  const demo = params.get("demo");
  if (demo) {
    const origBoot = app.boot;
    app.boot = async () => { const had = await origBoot(); const m = await import("./dev/demo.js"); if (demo === "clear") m.clearDemo(app); else if (had) console.log("demo data", m.seedDemo(app)); return had; };
  }
  return app;
}
