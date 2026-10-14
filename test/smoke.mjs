// End-to-end checks for the room: starts a real server and drives it with fake phones.
//   npm test                 (starts its own server on port 3199)
//   URL=https://... npm test (runs against a server that's already running, e.g. through a tunnel)
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3199;
let URL = process.env.URL;
let server = null;
let failures = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

if (!URL) {
  URL = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['server/index.js', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('Press Ctrl+C') && resolve());
    server.on('exit', (code) => reject(new Error(`server exited (${code})`)));
  });
}

const stats = { biggest: 0 };
const clients = [];
function client(auth) {
  const socket = io(URL, { auth, transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { socket, room: null, self: null, token: null, events: [], counts: { room: 0, self: 0 }, bytes: 0 };
  const track = (value) => {
    const size = JSON.stringify(value).length;
    c.bytes += size;
    stats.biggest = Math.max(stats.biggest, size);
  };
  socket.on('room', (r) => { c.room = r; c.counts.room++; track(r); });
  socket.on('self', (s) => { c.self = s; c.counts.self++; track(s); });
  socket.on('session', (s) => (c.token = s.token));
  socket.on('join-info', (j) => (c.join = j));
  for (const ev of ['kicked', 'replaced']) socket.on(ev, () => c.events.push(ev));
  clients.push(c);
  return c;
}
const join = (c, name, token) => c.socket.timeout(3000).emitWithAck('join', { name, token }).catch(() => 'TIMEOUT');
const act = (c, type, payload) => c.socket.timeout(3000).emitWithAck('action', { type, payload }).catch(() => 'TIMEOUT');
const lobby = (c, cmd, extra) => c.socket.emit('lobby', { cmd, ...extra });
const view = (c) => c.self?.view;
const you = (c) => c.self?.you;

try {
  // --- files: pages, games, and the rule that server-only files are never sent ---
  for (const [path, want] of [
    ['/games/odd-one-out/rules.js', 200], ['/games/odd-one-out/words.js', 200], ['/games/odd-one-out/player.js', 200],
    ['/games/tap-race/style.css', 200], ['/host', 200], ['/host.html', 200], ['/', 200], ['/js/core/room.js', 200],
    ['/games/x/server.js', 404], ['/games/x/secret.server.js', 404], ['/games/x/%73erver.js', 404], ['/games/x/server.js.', 404],
    ['/games/x/..%2fx%2fserver.js', 404], ['/games/_template/rules.js', 200],
    ['/relay.local.json', 404], ['/js/relay.local.json', 404], ['/js/relay%2elocal.json', 404], ['/js/config.js', 200],
  ]) {
    const res = await fetch(URL + path);
    check(res.status === want, `GET ${path} -> ${res.status} (want ${want})`);
  }
  const modeJs = await (await fetch(URL + '/js/mode.js')).text();
  check(modeJs.includes("'server'"), 'the laptop server tells pages they are in server mode');
  const list = await (await fetch(URL + '/games/index.json')).json();
  check(list.map((g) => g.id).join() === 'odd-one-out,tap-race' && list.every((g) => g.hasStyle), 'games/index.json lists the games');

  // --- joining ---
  const host = client({ role: 'host' });
  const a = client({ role: 'player' });
  const b = client({ role: 'player' });
  await wait(300);
  check(host.join?.qr?.startsWith('data:image/png'), 'host gets QR code');
  check(a.room && a.self && a.self.you === null, 'unjoined phone gets room + self with you=null');
  const t0 = Date.now();
  const serverNow = await a.socket.timeout(2000).emitWithAck('clock').catch(() => null);
  check(typeof serverNow === 'number' && Math.abs(serverNow - t0) < 2000, 'clock answers with the server time');
  check((await join(a, '  Alice  ')).ok, 'Alice joins');
  check(!(await join(b, 'alice')).ok, 'duplicate name (case-insensitive) rejected');
  check(!(await join(b, '   ')).ok, 'blank name rejected');
  check((await join(b, 'Bob<script>')).ok, 'Bob joins');
  await wait(150);
  check(you(a).name === 'Alice' && you(a).isVip, 'Alice is VIP with trimmed name');
  check(you(b).name === 'Bobscript', 'angle brackets stripped from names');
  check(host.room.players.length === 2, 'host sees 2 players');

  // --- a rescanned QR code (new tab, no session token) takes back its own seat by name + last token ---
  const a2 = client({ role: 'player' });
  await wait(150);
  check(!(await join(a2, 'Alice')).ok, 'same name without the token is still rejected');
  check((await join(a2, 'Alice', a.token)).ok, 'same name WITH this phone\'s last token takes the seat back');
  await wait(200);
  check(a.events.includes('replaced') && you(a2)?.id === you(a)?.id, 'old tab told it was replaced; same seat');
  const alice = a2;

  // --- odd one out needs 3 ---
  lobby(host, 'select', { gameId: 'odd-one-out' });
  await wait(150);
  check(host.room.startProblem?.includes('at least 3'), 'start blocked with 2 players: ' + host.room.startProblem);
  const c = client({ role: 'player' });
  await wait(200);
  await join(c, 'Cara');
  await wait(150);
  check(host.room.startProblem === null, 'start allowed with 3');

  lobby(b, 'start');
  await wait(150);
  check(host.room.screen === 'lobby', 'non-VIP phone cannot start');
  lobby(alice, 'start');
  await wait(200);
  check(host.room.screen === 'game' && host.room.game.id === 'odd-one-out', 'VIP starts odd-one-out');

  const players = [alice, b, c];
  const spy = players.find((p) => view(p).isSpy);
  const nonSpies = players.filter((p) => p !== spy);
  check(players.filter((p) => view(p).isSpy).length === 1, 'exactly one spy');
  check(view(spy).word === null, 'spy does not get the word');
  const word = view(nonSpies[0]).word;
  check(word && view(nonSpies[1]).word === word, `non-spies share the word "${word}"`);
  check(!JSON.stringify(host.self).includes(word) && !JSON.stringify(host.room).includes(word), 'host never sees the word');
  check(!JSON.stringify(nonSpies[0].self).includes('"isSpy":true'), 'no spy flag for others');

  for (const p of players) await act(p, 'ready');
  await wait(150);
  check(view(host).phase === 'clue' && view(host).deadline > Date.now(), 'all ready -> clue phase with deadline');

  const giveaway = await act(nonSpies[0], 'clue', { clue: word.toUpperCase() });
  check(giveaway?.error, 'clue equal to the word is rejected: ' + giveaway?.error);
  check((await act(nonSpies[0], 'clue', { clue: 'hmm' }))?.ok, 'normal clue accepted');
  await wait(100);
  check(view(host).players.every((p) => p.clue === null), 'clues hidden on host during clue phase');
  await act(nonSpies[1], 'clue', { clue: 'yes' });
  await act(spy, 'clue', { clue: 'maybe' });
  await wait(150);
  check(view(host).phase === 'vote', 'all clues -> vote');
  check(view(host).players.filter((p) => p.clue).length === 3, 'clues shown on host during vote');
  check(view(alice).choices.length === 2 && !view(alice).choices.some((x) => x.id === you(alice).id), 'vote choices exclude yourself');

  // disconnect a non-spy before voting; the other two vote -> advances
  const spyId = you(spy).id;
  const leaver = nonSpies.find((p) => p !== alice); // keep Alice (the leader) for later steps
  const voter = nonSpies.find((p) => p !== leaver);
  const leaverId = you(leaver).id;
  leaver.socket.disconnect();
  await wait(200);
  check(view(host).players.find((p) => p.id === leaverId).connected === false, 'host sees leaver as away');
  await act(voter, 'vote', { playerId: spyId });
  await act(spy, 'vote', { playerId: you(voter).id });
  await wait(150);
  check(view(host).phase === 'result', 'remaining players voted -> result');
  check(view(host).result.word === word && view(host).result.spy.id === spyId, 'result reveals word + spy');
  check(view(spy).secretWord === word, 'spy learns the word at the end');

  // reconnect with token gets the same seat
  const back = client({ role: 'player', token: leaver.token, name: 'whatever' });
  await wait(300);
  check(you(back)?.id === leaverId && back.self.inGame, 'reconnect with token reclaims seat + stays in game');
  check(view(back)?.phase === 'result', 'reconnected player sees current phase');

  await act(back, 'next');
  await wait(150);
  check(view(host).phase === 'result', 'non-VIP cannot start next round');
  await act(host, 'next');
  await wait(150);
  check(view(host).phase === 'reveal' && view(host).round === 2, 'host starts round 2');
  await act(host, 'skip');
  await wait(150);
  check(view(host).phase === 'clue', 'host skip advances phase');
  check((await act(alice, 'constructor')) === null, 'unknown/prototype action ignored');

  // --- tap race ---
  lobby(host, 'end');
  await wait(150);
  check(host.room.screen === 'lobby', 'back to lobby');
  lobby(host, 'select', { gameId: 'tap-race' });
  lobby(host, 'start');
  await wait(200);
  check(view(alice).phase === 'countdown', 'tap race counts down');
  await act(alice, 'tap');
  await wait(3100);
  check(view(alice).phase === 'go', 'tap race goes after 3s');
  check(view(alice).taps === 0, 'taps during countdown ignored');
  for (let i = 0; i < 50; i++) act(alice, 'tap');
  await wait(500);
  check(view(alice).phase === 'done' && view(alice).won, 'Alice wins at 50 taps');
  check(view(host).winner?.name === 'Alice', 'host shows winner');

  const d = client({ role: 'player' });
  await wait(150);
  await join(d, 'Dev');
  await wait(150);
  check(d.self.inGame === true, 'late joiner allowed into tap race (onJoin)');

  const before = host.room.game.session;
  lobby(host, 'restart');
  await wait(150);
  check(host.room.game.session === before + 1 && view(alice).phase === 'countdown', 'restart creates a fresh session');

  lobby(host, 'end');
  await wait(100);
  lobby(host, 'kick', { playerId: you(d).id });
  await wait(200);
  check(d.events.includes('kicked') && !host.room.players.some((p) => p.name === 'Dev'), 'host can kick');

  // same-name rejoin of a disconnected player takes over their seat
  const bobId = you(b).id;
  for (const s of [b, back]) if (you(s)?.id === bobId) s.socket.disconnect();
  await wait(200);
  const b2 = client({ role: 'player' });
  await wait(150);
  check((await join(b2, 'BOBSCRIPT')).ok, 'rejoining with the same name (no token) works once the old one is gone');
  await wait(150);
  check(you(b2).id === bobId, 'and gets the old seat');

  // --- a big group: 32 players ---
  const crowd = [];
  const have = host.room.players.filter((p) => p.connected).length;
  for (let i = have; i < 32; i++) crowd.push(client({ role: 'player' }));
  await wait(400);
  const results = await Promise.all(crowd.map((p, i) => join(p, `Bot${i + 1}`)));
  check(results.every((r) => r.ok), `${crowd.length} more join (32 in total)`);
  const extra = client({ role: 'player' });
  await wait(150);
  check((await join(extra, 'OneTooMany')).error?.includes('full'), 'player 33 is told the room is full');
  await wait(200);
  check(host.room.players.filter((p) => p.connected).length === 32, 'host sees 32 connected players');
  lobby(host, 'select', { gameId: 'odd-one-out' });
  await wait(150);
  check(host.room.startProblem?.includes('at most 24'), 'Odd One Out refuses 32: ' + host.room.startProblem);

  lobby(host, 'select', { gameId: 'tap-race' });
  lobby(host, 'start');
  await wait(3400);
  const racers = clients.filter((p) => p.socket.connected && p.self?.inGame);
  check(racers.length === 32 && view(alice).phase === 'go', `32-player tap race is on (${racers.length} racing)`);

  // Everyone taps ~6 times a second for 3 seconds; measure what the phones receive.
  const watcher = crowd[0];
  const startCounts = { self: watcher.counts.self, room: watcher.counts.room, host: host.counts.self };
  const startBytes = racers.reduce((sum, p) => sum + p.bytes, 0);
  const t1 = Date.now();
  const tapping = racers.map((p) => setInterval(() => p.socket.emit('action', { type: 'tap' }), 160 + Math.random() * 40));
  await wait(3000);
  tapping.forEach(clearInterval);
  const secs = (Date.now() - t1) / 1000;
  await wait(200);
  const phoneRate = (watcher.counts.self - startCounts.self) / secs;
  const hostRate = (host.counts.self - startCounts.host) / secs;
  const kbps = ((racers.reduce((sum, p) => sum + p.bytes, 0) - startBytes) * 8) / 1000 / secs;
  check(phoneRate <= 16.5, `a phone gets at most ~15 updates a second (${phoneRate.toFixed(1)}/s)`);
  check(hostRate <= 31, `the big screen gets at most ~30 a second (${hostRate.toFixed(1)}/s)`);
  check(watcher.counts.room === startCounts.room, 'room info is not re-sent while only the game changes');
  check(kbps < 1000, `all 32 phones together receive under 1 Mbps (${Math.round(kbps)} kbps of game data, before compression)`);
  check(stats.biggest < 15000, `largest message is ${stats.biggest} bytes (WebRTC limit is 16 KB)`);
} catch (err) {
  console.error(err);
  failures++;
} finally {
  for (const c of clients) c.socket.close();
  server?.kill();
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
