// Dev server: static files with Cache-Control: no-store so module edits show
// up on reload.   node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = process.cwd(), port = +(process.argv[2] || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".gz": "application/gzip", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "app.html";
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file); if (!s.isFile()) throw new Error();
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "Content-Length": s.size });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found"); }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/app.html`));
