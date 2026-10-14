// Serves dist/ the way GitHub Pages will: under /game-night/, as plain files.
// For trying the website version on this computer:  npm run site  ->  http://localhost:4000/game-night/
// Only this computer can reach it. It also offers the relay login from relay.local.json (in the
// project folder, ignored by git) so the big screen can use the relay while testing here.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(PROJECT, 'dist');
const RELAY_LOGIN = path.join(PROJECT, 'relay.local.json');
const BASE = '/game-night/';
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.md': 'text/plain',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      return res.end();
    }
    const rel = decodeURIComponent(url.pathname.slice(BASE.length));
    if (rel === 'js/relay.local.json') {
      if (!fs.existsSync(RELAY_LOGIN)) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return fs.createReadStream(RELAY_LOGIN).pipe(res);
    }
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Website version: http://localhost:${PORT}${BASE}host.html (big screen)`);
    console.log(fs.existsSync(RELAY_LOGIN) ? '  Using the relay login from relay.local.json' : '  No relay.local.json: the big screen has no relay unless set up with its Relay button');
  });
