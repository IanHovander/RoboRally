// Load test: fake players join and play Tap Race over and over, while we watch data use and lag.
//   node test/load.mjs --join https://xxxx.trycloudflare.com --bots 25 --seconds 300
// --join   where the fake phones connect (e.g. the internet link)
// --local  where the fake big screen connects (default http://localhost:3000; it must be this computer)
import { parseArgs } from 'node:util';
import { io } from 'socket.io-client';

const { values: opts } = parseArgs({
  options: {
    join: { type: 'string' },
    local: { type: 'string', default: 'http://localhost:3000' },
    bots: { type: 'string', default: '25' },
    seconds: { type: 'string', default: '120' },
  },
});
const JOIN = opts.join ?? opts.local;
const BOTS = Number(opts.bots);
const SECONDS = Number(opts.seconds);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const host = io(opts.local, { auth: { role: 'host' }, transports: ['websocket'] });
let hostRoom = null;
let hostView = null;
host.on('room', (r) => (hostRoom = r));
host.on('self', (s) => (hostView = s.view));

let bytes = 0;
let messages = 0;
const rtts = [];
const bots = [];
for (let i = 0; i < BOTS; i++) {
  const socket = io(JOIN, { auth: { role: 'player' }, transports: ['websocket'] });
  const bot = { socket, view: null };
  for (const ev of ['room', 'self']) {
    socket.on(ev, (value) => {
      bytes += JSON.stringify(value).length;
      messages++;
      if (ev === 'self') bot.view = value.view;
    });
  }
  socket.on('connect', () => socket.emit('join', { name: `Bot${i + 1}` }, () => {}));
  bots.push(bot);
}

await wait(4000);
console.log(`${hostRoom?.players.filter((p) => p.connected).length ?? 0} of ${BOTS} bots joined via ${JOIN}`);
host.emit('lobby', { cmd: 'select', gameId: 'tap-race' });
host.emit('lobby', { cmd: 'start' });

// Each bot taps ~6 times a second while a race is on. Every 10th tap is timed (send -> server ack).
let tapCount = 0;
const tappers = bots.map((bot) =>
  setInterval(() => {
    if (bot.view?.phase !== 'go') return;
    if (tapCount++ % 10 === 0) {
      const t = Date.now();
      bot.socket.timeout(5000).emit('action', { type: 'tap' }, (err) => !err && rtts.push(Date.now() - t));
    } else {
      bot.socket.emit('action', { type: 'tap' });
    }
  }, 150 + Math.random() * 60),
);

const start = Date.now();
let lastBytes = 0;
let races = 0;
const pct = (list, p) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) * p)] : 0);
while (Date.now() - start < SECONDS * 1000) {
  await wait(10_000);
  if (hostView?.phase === 'done') {
    races++;
    host.emit('lobby', { cmd: 'restart' }); // next race
  }
  const window = rtts.splice(0);
  const kbps = Math.round(((bytes - lastBytes) * 8) / 1000 / 10);
  lastBytes = bytes;
  const t = Math.round((Date.now() - start) / 1000);
  console.log(
    `${String(t).padStart(4)}s  phones receive ${String(kbps).padStart(4)} kbps  ` +
      `tap round trip: median ${pct(window, 0.5)} ms, 95% ${pct(window, 0.95)} ms, worst ${pct(window, 1)} ms  ` +
      `(${hostRoom?.players.filter((p) => p.connected).length} connected, ${races} races finished)`,
  );
}

const totalSecs = (Date.now() - start) / 1000;
console.log(`\nTotal: ${(bytes / 1e6).toFixed(1)} MB of game data to ${BOTS} phones in ${Math.round(totalSecs)} s ` +
  `(${Math.round((bytes * 8) / 1000 / totalSecs)} kbps average, ${messages} messages). Compression on the wire makes it smaller.`);
tappers.forEach(clearInterval);
for (const b of bots) b.socket.close();
host.close();
process.exit(0);
