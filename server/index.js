import { exec, spawn } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import { Room } from '../public/js/core/room.js';
import { findGames, isPublicGameFile, loadGames } from './games.js';
import { isLocalNetwork, lanAddresses } from './network.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// npm start -- --port 4000 --url https://my-tunnel.example.com
const { values: opts } = parseArgs({
  options: {
    port: { type: 'string', short: 'p' },
    url: { type: 'string' }, // the address phones should use (e.g. a tunnel); shown as the QR code
    open: { type: 'boolean' }, // open the big screen in the browser
    online: { type: 'boolean' }, // start a free Cloudflare tunnel so phones can join over the internet
  },
  strict: false,
});
const PORT = Number(opts.port || process.env.PORT || 3000);

// A bug in one game shouldn't end game night: log it and keep going.
process.on('uncaughtException', (err) => console.error('[server] Unexpected error (still running):', err));
process.on('unhandledRejection', (err) => console.error('[server] Unexpected error (still running):', err));

const GAMES_DIR = path.join(ROOT, 'games');
const games = await loadGames(GAMES_DIR);

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache'); // always pick up edited game files on reload
  next();
});
// Settings that stay on this computer (*.local.json) are never sent, even if one ends up inside public/.
app.use((req, res, next) => {
  let p = req.path;
  try {
    p = decodeURIComponent(p);
  } catch {}
  return /\.local\.json$/i.test(p) ? res.status(404).end() : next();
});
// The same pages also work as a website (GitHub Pages), where the big screen's browser runs the
// game. Served from here they talk to this server instead.
app.get('/js/mode.js', (req, res) => res.type('text/javascript').send("export default 'server';\n"));
app.get('/games/index.json', (req, res) => res.json(findGames(GAMES_DIR).map(({ id, hasStyle }) => ({ id, hasStyle }))));
app.use('/games', (req, res, next) => (isPublicGameFile(req.path) ? next() : res.status(404).end()));
app.use('/games', express.static(path.join(ROOT, 'games'), { index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  // A phone that locks or loses signal is noticed within ~8 seconds (it rejoins in the same seat).
  pingInterval: 3_000,
  pingTimeout: 5_000,
  // Game updates are repetitive JSON, so compressing them shrinks what a hotspot has to upload.
  perMessageDeflate: { threshold: 512 },
});
const room = new Room(games);

io.on('connection', (socket) => {
  const auth = socket.handshake.auth ?? {};
  // How far behind this connection is; the room skips it until it catches up.
  socket.canSend = () => (socket.conn?.writeBuffer?.length ?? 0) < 32;
  if (auth.role !== 'host') {
    // A phone that has played before sends its token so it gets its seat back.
    return room.connect(socket, { role: 'player', token: auth.token, name: auth.name });
  }
  // The big screen can kick players and end games, so it only works from this computer or
  // the home network, never through the public internet link.
  if (!isLocalNetwork(socket.handshake.address, socket.handshake.headers)) {
    socket.emit('host-denied');
    socket.disconnect();
    return;
  }
  room.connect(socket, { role: 'host' });
});

const localUrl = `http://localhost:${PORT}`;
const lan = lanAddresses();
const lanUrl = lan.length ? `http://${lan[0].address}:${PORT}` : null;
const homeUrl = opts.url || process.env.PUBLIC_URL || lanUrl || localUrl;
await setJoinUrl(homeUrl);

async function setJoinUrl(url) {
  url = String(url).replace(/\/+$/, '');
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#14112aff', light: '#ffffffff' } });
  // When the QR code points at the internet, also show the Wi-Fi address: it's faster for people in the room.
  const local = lanUrl && url !== lanUrl ? lanUrl.replace(/^https?:\/\//, '') : null;
  room.setJoin({ url, text: url.replace(/^https?:\/\//, ''), qr, local });
}

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Is the game already running in another window?`);
    console.error(`  Close that one, or pick another port:  npm start -- --port ${PORT + 1}\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  const gameNames = [...games.values()].map((g) => g.name).join(', ') || '(none found in games/)';
  console.log('');
  console.log('  Game Night is running!');
  console.log('');
  console.log(`  Big screen:   ${localUrl}/host`);
  console.log(`  Phones join:  ${room.join.url}`);
  for (const extra of lan.slice(1)) console.log(`         (or)   http://${extra.address}:${PORT}   [${extra.name}]`);
  console.log('');
  console.log(`  Games: ${gameNames}`);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
  if (opts.open) openBrowser(`${localUrl}/host`);
  if (opts.online) startTunnel();
});

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/**
 * Free, no-account Cloudflare "quick tunnel": gives this server a public https address that
 * anyone can open. The game still runs here; Cloudflare just passes the traffic along.
 * The address is different every time.
 */
function startTunnel(attempt = 1) {
  const exe = findCloudflared();
  if (!exe) {
    console.log('  cloudflared is not installed, so there is no internet link (Wi-Fi still works).');
    console.log('  Install it once with:  winget install --id Cloudflare.cloudflared');
    console.log('  (Mac: brew install cloudflared). Then run  npm run online  again.\n');
    return;
  }
  if (attempt === 1) {
    console.log('  Opening an internet link with cloudflared (usually takes a few seconds, sometimes a minute)...\n');
    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
  }

  const child = spawn(exe, ['tunnel', '--no-autoupdate', '--url', localUrl], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let url = null;
  let registered = false;
  let started = false;
  let live = false;
  let retired = false; // replaced by a fresh tunnel
  let recent = []; // cloudflared's last few lines, shown if something goes wrong

  const watch = (chunk) => {
    const text = String(chunk);
    recent = [...recent, ...text.split(/\r?\n/).filter(Boolean)].slice(-12);
    url ??= text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0] ?? null;
    registered ||= /Registered tunnel connection/i.test(text);
    if (!url || !registered || started) return;
    started = true;
    goLive(url).then((ok) => {
      if (ok) {
        live = true;
        return;
      }
      retired = true;
      child.kill();
      if (attempt < 3) {
        console.log('  Cloudflare never finished setting up that address. Trying a fresh one...\n');
        startTunnel(attempt + 1);
      } else {
        console.log('  Gave up on the internet link after 3 tries. The Wi-Fi address still works.');
        console.log('  Try  npm run online  again in a few minutes.\n');
      }
    });
  };
  child.stdout.on('data', watch);
  child.stderr.on('data', watch);
  child.on('error', (err) => console.error('  cloudflared failed to start:', err.message));
  child.on('exit', (code) => {
    if (retired) return;
    if (live) {
      console.log('\n  The internet link closed. The QR code is back to the Wi-Fi address.\n');
      setJoinUrl(homeUrl);
    } else if (code !== null) {
      console.log(`  cloudflared stopped (exit code ${code}) before the link was ready. Its last words:`);
      for (const line of recent) console.log(`    ${line}`);
      console.log('');
    }
  });
  process.on('exit', () => child.kill());
}

/**
 * Point the QR code at the tunnel once its name exists. After cloudflared prints the address,
 * DNS can say "no such name" for a while (usually a second, sometimes over a minute), and a phone
 * that asks then is locked out for a minute. So keep asking Cloudflare's own nameservers, which
 * remember nothing, and only show the link once they know it.
 * Resolves false if the name never appears (then the caller tries a fresh tunnel).
 */
async function goLive(url) {
  const host = new URL(url).hostname;
  const found = await waitForName(host, 180_000);
  if (found === 'no') return false;
  // 'unknown': this network won't let us ask the nameservers directly, so just give it time.
  await sleep(found === 'yes' ? 1500 : 20_000);
  await setJoinUrl(url);
  console.log(`  Internet link ready:  ${url}`);
  console.log('  The QR code on the big screen now points there, so phones can join from anywhere.');
  console.log('  This address changes each time you start. The big screen itself only works on this computer or your Wi-Fi.\n');
  return true;
}

/** 'yes' once the name exists, 'no' if the nameservers kept saying it doesn't, 'unknown' if we couldn't ask them. */
async function waitForName(host, timeoutMs) {
  let authority;
  try {
    const nameservers = await dns.resolveNs(host.split('.').slice(-2).join('.'));
    const ips = (await Promise.all(nameservers.map((ns) => dns.resolve4(ns).catch(() => [])))).flat();
    if (!ips.length) return 'unknown';
    authority = new dns.Resolver({ timeout: 1500, tries: 1 });
    authority.setServers(ips);
  } catch {
    return 'unknown';
  }
  const start = Date.now();
  let answered = false;
  let nagged = false;
  while (Date.now() - start < timeoutMs) {
    try {
      await authority.resolve4(host);
      return 'yes';
    } catch (err) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') answered = true;
    }
    if (!nagged && Date.now() - start > 15_000) {
      nagged = true;
      console.log('  Still waiting for Cloudflare to publish the address...');
    }
    await sleep(1000);
  }
  return answered ? 'no' : 'unknown';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Look on the PATH, then where the installers put it (a terminal opened before installing won't have it on the PATH yet). */
function findCloudflared() {
  if (process.env.CLOUDFLARED) return process.env.CLOUDFLARED;
  const exe = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'win32') {
    dirs.push(
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'cloudflared'),
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'cloudflared'),
    );
  } else {
    dirs.push('/opt/homebrew/bin', '/usr/local/bin');
  }
  for (const dir of dirs) {
    const file = path.join(dir, exe);
    if (fs.existsSync(file)) return file;
  }
  return null;
}
