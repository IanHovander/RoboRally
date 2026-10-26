// A tiny static server for the animation lab. It lays the repo out the way the game server does:
// /games/* from games/, /labs/* from labs/, /looks/<name>/* from that look, everything else from public/.
//   node labs/animations/serve.mjs [port]      then open http://localhost:<port>/labs/animations/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8' };

function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  let base = p.startsWith('/games/') || p.startsWith('/labs/') ? ROOT : path.join(ROOT, 'public');
  // an alternative look: /looks/<name>/games/* from looks/<name>/games, the rest from looks/<name>/public
  const look = p.match(/^\/looks\/([a-z0-9-]+)(\/.*)$/i);
  if (look) {
    base = path.join(ROOT, 'looks', look[1], look[2].startsWith('/games/') ? '' : 'public');
    p = look[2];
  }
  let file = path.join(base, p);
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return fs.existsSync(file) ? file : null;
}

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const file = resolve(req.url);
    if (!file) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await serve(Number(process.argv[2] ?? 8123));
  console.log(`Animation lab: http://localhost:${port}/labs/animations/`);
}
