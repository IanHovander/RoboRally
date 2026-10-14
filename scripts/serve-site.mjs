// Serves dist/ the way GitHub Pages will: under /game-night/, as plain files.
// For trying the website version on this computer:  npm run site  ->  http://localhost:4000/game-night/
// Only this computer can reach it.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BASE = '/game-night/';
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.md': 'text/plain',
  '.woff2': 'font/woff2', '.txt': 'text/plain',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      return res.end();
    }
    let file = path.join(ROOT, decodeURIComponent(url.pathname.slice(BASE.length)));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Website version: http://localhost:${PORT}${BASE}host.html (big screen)`));
