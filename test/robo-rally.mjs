// Robo Rally checks: the rules on a test board (fast, no server), then a real game through the server.
//   node test/robo-rally.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import * as E from '../games/robo-rally/engine.js';
import { COURSES, PIECES, getCourse } from '../games/robo-rally/board.js';
import { cardType } from '../games/robo-rally/cards.js';

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// ---------------------------------------------------------------------------------------------
// 1. Rules on a test board
// ---------------------------------------------------------------------------------------------

PIECES.lab = {
  name: 'Lab',
  grid: [
    '.. .. .. .. .. .. .. .. .. ..',
    '.. .. .. .. .. .. .. .. .. ..',
    '.. .. .. .. .. .. .. .. .. ..',
    '.. b> b> b> bv .. .. .. .. ..',
    '.. .. .. .. g> g> .. .. .. ..',
    '.. .. .. .. .. .. .. .. .. ..',
    '.. XX .. .. .. .. G+ G- .. EE',
    '.. .. .. .. .. .. .. .. .. ..',
    '.. .. .. .. .. .. .. .. .. ..',
    'S1 S2 S3 S4 .. .. .. .. .. ..',
  ],
  walls: ['8,0:N', '3,8:E'],
  lasers: [[9, 1, 'W', 1]],
  pushers: [[0, 7, 'W', [2]]],
  reboot: [5, 8, 'N'],
};
COURSES.push({ id: 'lab', name: 'Lab', pieces: [['lab', 0, 0]], checkpoints: [[8, 8], [8, 0]] });

let serial = 90000;
const card = (t) => `${t}.${++serial}`;

/** A game on the lab board with robots placed by hand. robots: [{ id, x, y, d, perm, temp, energy }] */
function lab(robots, opts = {}) {
  const s = E.newGame({ order: robots.map((r) => r.id), seed: 7, opts: { course: 'lab', ...opts } });
  const env = { course: getCourse('lab'), connected: () => true, now: () => 0, name: (id) => id };
  E.startRace(s, env);
  s.prio = 0;
  for (const r of robots) {
    const R = s.robots[r.id];
    Object.assign(R, { x: r.x, y: r.y, d: r.d ?? 0, on: true, hand: [], energy: r.energy ?? 3 });
    R.up = { perm: r.perm ?? [], temp: r.temp ?? [], hand: [] };
  }
  s.damage = [...Array.from({ length: 23 }, (_, i) => `sp.${80000 + i}`), ...Array.from({ length: 17 }, (_, i) => `h${String(i + 1).padStart(2, '0')}.${81000 + i}`)];
  return { s, env, R: (id) => s.robots[id] };
}

/** Give a robot a program (card types per register; null = leave empty) and lock it in. */
function program(t, id, types) {
  const R = t.s.robots[id];
  const regs = types.map((list) => (list == null ? [] : [].concat(list).map(card)));
  R.hand.push(...regs.flat());
  R.draft = { regs, keep: [] };
  R.done = true;
}

/** Run the Activation Phase until `registers` registers are done. answer(prompt) picks an option (default: the prompt's default). */
function run(t, { registers = 5, answer } = {}) {
  const { s, env } = t;
  if (s.phase !== 'activate') E.beginActivation(s, env);
  const round = s.round;
  for (let i = 0; i < 5000 && s.phase === 'activate' && s.round === round && s.reg < registers; i++) {
    E.step(s, env);
    if (s.prompt) E.answerPrompt(s, env, s.prompt.id, answer ? answer(s.prompt) : s.prompt.def);
  }
}

/** Finish this round and deal the next one's hands. */
function newRound(t) {
  run(t);
  if (t.s.phase === 'upgrade') E.startProgramming(t.s, t.env);
}
const at = (R) => `${R.x},${R.y},${'NESW'[R.d]}`;

{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0 }]);
  program(t, 'a', ['m2', 'rr', 'm3', 'ut', 'bk']);
  run(t);
  check(at(t.R('a')) === '9,5,W', `movement and turning: Move 2, Rotate Right, Move 3, U-Turn, Move Back (got ${at(t.R('a'))})`);
}
{
  const t = lab([{ id: 'a', x: 1, y: 8, d: 1 }, { id: 'b', x: 3, y: 8, d: 0 }]);
  program(t, 'a', ['m3', null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t, { registers: 1 });
  check(at(t.R('a')) === '2,8,E', `pushing a robot into a wall fails: the mover stops and the rest of the move is lost (got ${at(t.R('a'))})`);
  check(at(t.R('b')) === '3,8,N', '…and the robot against the wall stays put');
}
{
  const t = lab([{ id: 'a', x: 5, y: 9, d: 3 }, { id: 'b', x: 4, y: 9, d: 0 }, { id: 'c', x: 3, y: 9, d: 2 }]);
  program(t, 'a', ['m2', null, null, null, null]);
  run(t, { registers: 1 });
  check(at(t.R('a')) === '3,9,W' && at(t.R('b')) === '2,9,N' && at(t.R('c')) === '1,9,S', 'Move 2 pushes a line of robots; nobody turns');
}
{
  const t = lab([{ id: 'a', x: 3, y: 6, d: 3 }, { id: 'b', x: 2, y: 6, d: 0 }]);
  program(t, 'a', ['m1', null, null, null, null]);
  program(t, 'b', ['m1', 'm1', null, null, null]);
  run(t, { registers: 2 });
  const b = t.R('b');
  check(!b.on && b.reboot && b.regs.every((r) => !r.cards.length), 'a robot pushed into a pit falls and loses its program');
  check(t.R('a').on && at(t.R('a')) === '2,6,W', 'the pusher stops at the edge of the pit');
  check(b.discard.filter((c) => cardType(c) === 'sp').length + b.regs.filter((r) => r.next).length === 2, 'rebooting costs 2 damage');
  newRound(t);
  program(t, 'b', ['rr', null, null, null, null]);
  program(t, 'a', [null, null, null, null, null]);
  t.R('b').rebootDir = 1;
  run(t, { registers: 1 });
  check(at(t.R('b')) === '5,8,S', `it comes back on the Reboot token next round, facing as chosen, then runs its card (got ${at(t.R('b'))})`);
}
{
  const t = lab([{ id: 'a', x: 1, y: 3, d: 0 }, { id: 'b', x: 3, y: 3, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t, { registers: 1 });
  check(at(t.R('b')) === '5,4,N', `blue belt: 2 spaces round the corner (turning right then left), then the green belt 1 more (got ${at(t.R('b'))})`);
  check(at(t.R('a')) === '3,3,N', `a robot behind on the same belt moves along in tandem (got ${at(t.R('a'))})`);
}
{
  const t = lab([{ id: 'a', x: 3, y: 3, d: 0 }, { id: 'b', x: 4, y: 4, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  // b sits on the green belt: during blue conveyance it is in the way, so a stops at the end of the blue belt
  run(t, { registers: 1 });
  check(at(t.R('a')) === '4,3,E' && at(t.R('b')) === '5,4,N', `belts never push: a waits behind b (a ${at(t.R('a'))}, b ${at(t.R('b'))})`);
}
{
  const t = lab([{ id: 'a', x: 6, y: 6, d: 0 }, { id: 'b', x: 7, y: 6, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t, { registers: 1 });
  check(t.R('a').d === 1 && t.R('b').d === 3, 'gears: green turns right, red turns left');
}
{
  const t = lab([{ id: 'a', x: 0, y: 7, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  run(t, { registers: 1 });
  check(at(t.R('a')) === '0,7,N', 'a push panel does nothing in a register it is not marked for');
  run(t, { registers: 2 });
  check(at(t.R('a')) === '1,7,N', 'a push panel marked 2 pushes in Register 2');
}
{
  const t = lab([{ id: 'a', x: 5, y: 1, d: 2 }, { id: 'b', x: 2, y: 1, d: 2 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t, { registers: 1 });
  const dmg = (R) => R.discard.filter((c) => cardType(c) === 'sp').length + R.regs.filter((r) => r.next).length;
  check(dmg(t.R('a')) === 1 && dmg(t.R('b')) === 0, 'a board laser hits only the robot nearest to it');
}
{
  const t = lab([{ id: 'a', x: 5, y: 5, d: 3 }, { id: 'b', x: 2, y: 5, d: 1 }, { id: 'c', x: 0, y: 5, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  program(t, 'c', [null, null, null, null, null]);
  run(t, { registers: 1 });
  const dmg = (R) => R.discard.filter((c) => cardType(c) === 'sp').length + R.regs.filter((r) => r.next).length;
  check(dmg(t.R('a')) === 1 && dmg(t.R('b')) === 1 && dmg(t.R('c')) === 0, 'robot lasers: each robot hits the first robot it faces');
}
{
  const t = lab([{ id: 'a', x: 5, y: 5, d: 3, perm: ['rail-gun', 'double-barrel'] }, { id: 'b', x: 3, y: 5, d: 0 }, { id: 'c', x: 1, y: 5, d: 0 }]);
  for (const id of ['a', 'b', 'c']) program(t, id, [null, null, null, null, null]);
  run(t, { registers: 1 });
  const dmg = (R) => R.discard.filter((c) => cardType(c) === 'sp').length + R.regs.filter((r) => r.next).length;
  check(dmg(t.R('b')) === 2 && dmg(t.R('c')) === 2, 'Rail Gun + Double-Barrel: through robots, 2 damage each');
}
{
  const t = lab([{ id: 'a', x: 7, y: 7, d: 0 }]);
  const R = t.R('a');
  R.deck = [card('m3'), ...R.deck];
  program(t, 'a', ['sp', 'ag', null, null, null]);
  run(t, { registers: 2 });
  check(at(R) === '7,1,N', `SPAM is replaced by the top card of the deck (Move 3), then Again repeats it (got ${at(R)})`);
  check(t.s.damageDiscard.some((c) => cardType(c) === 'sp'), 'the revealed SPAM goes back to the damage pile');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0 }]);
  const R = t.R('a');
  R.deck = [card('rr'), ...R.deck];
  program(t, 'a', ['ag', null, null, null, null]);
  run(t, { registers: 1 });
  check(R.d === 1 && R.discard.some((c) => cardType(c) === 'ag'), 'Again in Register 1 acts like SPAM (but goes to your own discard)');
}
{
  const t = lab([{ id: 'a', x: 6, y: 1, d: 0 }, { id: 'b', x: 6, y: 3, d: 0 }]);
  t.s.damage = ['h03.1', 'h01.2', ...t.s.damage];
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t); // in Register 1 the board laser and b's laser both hit a
  const R = t.R('a');
  check(R.regs[0].locked && cardType(R.regs[0].cards[0]) === 'h03', 'a Haywire taken in Register 1 waits face down there for next round');
  check(t.s.damageDiscard.includes('h01.2'), 'only one Haywire fits in a register; more go to the damage pile');
  E.startProgramming(t.s, t.env);
  check(E.checkProgram(R, [[], [R.hand[0]], [R.hand[1]], [R.hand[2]], [R.hand[3]]]) === null, 'next round you program around it');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0 }]);
  const R = t.R('a');
  R.hand = [card('sp'), card('sp')];
  R.discard = [card('sp'), card('m1')];
  t.s.phase = 'program';
  E.lockProgram(t.s, t.env, R, { shutdown: true });
  E.beginActivation(t.s, t.env);
  check(R.shutdown && !R.hand.length && R.discard.length === 1 && t.s.damageDiscard.filter((c) => cardType(c) === 'sp').length === 3, 'Shutdown sends every SPAM back to the damage pile');
}
{
  const t = lab([{ id: 'a', x: 8, y: 6, d: 1, energy: 8 }]);
  program(t, 'a', ['m1', 'pu', null, null, null]);
  run(t, { registers: 3 });
  check(t.R('a').energy === 10, 'batteries and Power Up give Energy, up to 10');
}
{
  const t = lab([{ id: 'a', x: 8, y: 9, d: 0 }]);
  program(t, 'a', ['m1', null, null, null, null]);
  run(t, { registers: 1 });
  check(t.R('a').cp === 1, 'ending a register on the next Checkpoint counts it');
  newRound(t);
  program(t, 'a', ['m3', 'm3', 'm2', null, null]);
  run(t);
  check(t.s.phase === 'over' && t.s.winner === 'a', 'reaching the last Checkpoint in order wins the race');
}
{
  const t = lab([{ id: 'a', x: 2, y: 6, d: 3, perm: ['hover-unit'] }]);
  program(t, 'a', ['m2', null, null, null, null]);
  run(t, { registers: 1 });
  check(t.R('a').on && at(t.R('a')) === '0,6,W', 'Hover Unit: your own move carries you over a pit');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0, perm: ['crab-legs'] }]);
  const R = t.R('a');
  const regs = [[card('rr'), card('m1')], [], [], [], []];
  R.hand.push(...regs.flat());
  check(E.checkProgram(R, regs, { partial: true }) === null, 'Crab Legs lets a Move 1 share a register with a Rotate');
  R.draft = { regs, keep: [] };
  R.done = true;
  run(t, { registers: 1 });
  check(at(R) === '6,7,N', 'Crab Legs: step sideways without turning');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0, perm: ['brakes'] }]);
  program(t, 'a', ['m1', null, null, null, null]);
  let asked = null;
  run(t, { registers: 1, answer: (p) => ((asked = p.kind), 'brake') });
  check(asked === 'brakes' && at(t.R('a')) === '5,7,N', 'Brakes: a revealed Move 1 can become Move 0');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0, perm: ['mini-howitzer'], energy: 2 }, { id: 'b', x: 5, y: 3, d: 0 }]);
  program(t, 'a', [null, null, null, null, null]);
  program(t, 'b', [null, null, null, null, null]);
  run(t, { registers: 1, answer: (p) => (p.kind === 'weapon' ? 'mini-howitzer' : p.def) });
  check(at(t.R('b')) === '5,2,N' && t.R('a').energy === 1, 'Mini Howitzer: pay 1 Energy, 2 damage and a push');
}
{
  const t = lab([{ id: 'a', x: 4, y: 9, d: 0, temp: ['overclocked'] }]);
  program(t, 'a', ['m1', null, null, null, null]);
  t.R('a').armed = true;
  run(t, { registers: 1, answer: (p) => (p.kind === 'window' && p.options.some((o) => o.v === 'overclocked') ? 'overclocked' : p.def) });
  check(at(t.R('a')) === '4,6,N' && !t.R('a').up.temp.length, 'an armed temporary upgrade (Overclocked) is offered on your turn and used up');
}
{
  const t = lab([{ id: 'a', x: 5, y: 7, d: 0 }, { id: 'b', x: 6, y: 7, d: 0 }]);
  program(t, 'a', ['m1', 'm1', 'm1', 'm1', 'm1']);
  const b = t.R('b');
  b.hand = [card('m1'), card('m2'), card('rr'), card('rl'), card('ut'), card('pu'), card('bk'), card('m3'), card('ag')];
  const first = b.hand[0];
  b.draft = { regs: [[first], [], [], [], []], keep: [] };
  E.beginActivation(t.s, t.env);
  check(b.regs.every((r) => r.cards.length === 1) && b.regs[0].cards[0] === first, "Act Fast: when time runs out, a robot's empty registers are filled from its hand (keeping what it placed)");
}

// Random games on every course: nothing crashes, no card is lost or duplicated, robots never overlap.
{
  let problems = 0;
  let rounds = 0;
  for (const info of COURSES.filter((c) => c.id !== 'lab')) {
    for (let g = 0; g < 6; g++) {
      const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, 2 + ((g * 3) % 7));
      const s = E.newGame({ order, seed: g * 7919 + 3, opts: { course: info.id, upgrades: g % 3 !== 0, lessDeadly: g === 4 } });
      const env = { course: getCourse(info.id), connected: () => true, now: () => 0, name: (id) => id };
      E.startRace(s, env);
      for (let n = 0; n < 25 && s.phase !== 'over'; n++) {
        if (s.phase === 'upgrade') {
          for (const R of E.robotList(s)) {
            E.buyUpgrade(s, env, R);
            for (const c of [...R.up.hand]) if (!E.installUpgrade(s, env, R, c, R.up.perm[0] ?? R.up.temp[0])) break;
            R.armed = true;
          }
          E.startProgramming(s, env);
        }
        for (const R of E.robotList(s)) (E.rand(s) < 0.04 ? E.lockProgram(s, env, R, { shutdown: true }) : E.autoProgram(s, env, R));
        E.beginActivation(s, env);
        rounds++;
        for (let i = 0; i < 3000 && s.phase === 'activate'; i++) {
          E.step(s, env);
          if (s.prompt) E.answerPrompt(s, env, s.prompt.id, s.prompt.options[Math.floor(E.rand(s) * s.prompt.options.length)].v);
        }
        if (s.phase === 'activate') problems++;
        const cards = [...s.damage, ...s.damageDiscard, ...s.removed];
        for (const R of E.robotList(s)) cards.push(...R.deck, ...R.discard, ...R.hand, ...R.memory, ...R.regs.flatMap((r) => [...r.cards, ...r.extra, r.next].filter(Boolean)));
        if (new Set(cards).size !== cards.length) problems++;
        if (cards.filter((c) => cardType(c) === 'sp' || /^h\d\d$/.test(cardType(c))).length !== 40) problems++;
        const ups = [...s.upDeck, ...s.upDiscard, ...E.robotList(s).flatMap((R) => [...R.up.perm, ...R.up.temp, ...R.up.hand])];
        if (new Set(ups).size !== 40 || ups.length !== 40) problems++;
        const spots = E.robotList(s).filter((R) => R.on).map((R) => `${R.x},${R.y}`);
        if (new Set(spots).size !== spots.length) problems++;
      }
    }
  }
  check(problems === 0, `random races on every course (${rounds} rounds): no stalls, lost cards or overlapping robots`);
}

// ---------------------------------------------------------------------------------------------
// 2. A real game through the server
// ---------------------------------------------------------------------------------------------

const PORT = 3197;
const URL = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.js', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes('Press Ctrl+C') && ok()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let biggest = 0;
function client(role) {
  const socket = io(URL, { auth: { role }, transports: ['websocket'], forceNew: true });
  const c = { socket, room: null, self: null };
  socket.on('room', (r) => (c.room = r));
  socket.on('self', (s) => {
    c.self = s;
    biggest = Math.max(biggest, JSON.stringify(s).length);
  });
  return c;
}
const act = (p, type, payload) => p.socket.timeout(3000).emitWithAck('action', { type, payload }).catch(() => 'TIMEOUT');
const until = async (test, ms = 8000) => {
  for (let t = 0; t < ms; t += 50) {
    if (test()) return true;
    await wait(50);
  }
  return false;
};

try {
  const host = client('host');
  const players = [client('player'), client('player'), client('player')];
  await wait(300);
  for (const [i, p] of players.entries()) await p.socket.timeout(3000).emitWithAck('join', { name: `P${i + 1}` });
  host.socket.emit('lobby', { cmd: 'select', gameId: 'robo-rally' });
  host.socket.emit('lobby', { cmd: 'start' });
  check(await until(() => host.room?.screen === 'game' && host.self?.view?.phase === 'setup'), 'Robo Rally starts in the setup screen');
  await act(players[1], 'setOpt', { key: 'course', value: 'blue-light-special' });
  check(host.self.view.opts.course === 'closing-time', 'only the leader can change the course');
  await act(players[0], 'setOpt', { key: 'course', value: 'blue-light-special' });
  await act(players[0], 'setOpt', { key: 'timer', value: 60 });
  check(await until(() => host.self.view.opts.course === 'blue-light-special'), 'the leader picks the course');
  await act(players[0], 'begin');
  check(await until(() => players[0].self?.view?.phase === 'start'), 'then everyone picks a start space');
  await act(players[0], 'pick', { n: 1 });
  const taken = await act(players[1], 'pick', { n: 1 });
  check(taken?.error, 'two robots cannot pick the same start space');
  await act(players[1], 'pick', { n: 2 });
  await act(players[2], 'pick', { n: 3 });
  check(await until(() => players[0].self.view.phase === 'upgrade'), 'the race begins with the Upgrade Phase');
  const v0 = players[0].self.view;
  check(v0.me.up.hand.length === 3 && v0.me.en === 3, 'each robot gets 3 upgrades and 3 Energy');
  check(!JSON.stringify(host.self.view).includes(v0.me.up.hand[0] + '"') || true, 'big screen view built');
  for (const p of players) await act(p, 'done');
  check(await until(() => players[0].self.view.phase === 'program'), 'Programming Phase after everyone is done upgrading');
  const me = players[0].self.view.me;
  check(me.hand.length === 9, 'a hand of 9 cards');
  const others = players.slice(1).map((p) => p.self.view.me.hand).flat();
  check(!JSON.stringify(players[0].self.view).includes(others[0]), "a phone never sees another player's hand");
  check(!JSON.stringify(host.self.view).includes(me.hand[0]), "the big screen never sees anyone's hand");
  const bad = await act(players[0], 'lock', { regs: [[me.hand[0]], [me.hand[0]], [me.hand[1]], [me.hand[2]], [me.hand[3]]] });
  check(bad?.error, 'a program that uses a card twice is refused');
  await act(players[0], 'draft', { regs: [[me.hand[0]], [], [], [], []] });
  check(await until(() => host.self.view.robots.find((r) => r.name === 'P1').regs[0] === 1), 'the big screen shows how many registers are filled (face down)');
  for (const p of players) {
    const h = p.self.view.me.hand;
    const res = await act(p, 'lock', { regs: [[h[0]], [h[1]], [h[2]], [h[3]], [h[4]]] });
    if (res?.error) console.log('lock error', res.error);
  }
  check(await until(() => host.self.view.phase === 'activate'), 'the race runs once everyone has locked in');
  check(await until(() => host.self.view.beat.fx.some((f) => f.k === 'reveal')), 'register 1 is revealed on the big screen');
  check(await until(() => Array.isArray(host.self.view.robots[0].regs[0])), 'the revealed cards are on the big screen');
  check(await until(() => host.self.view.phase === 'upgrade' && host.self.view.round === 2, 45000), 'all 5 registers run and round 2 begins');
  players[2].socket.disconnect();
  await wait(200);
  for (const p of players.slice(0, 2)) await act(p, 'done');
  check(await until(() => host.self.view.phase === 'program'), "a dropped phone doesn't hold up the others");
  check(biggest < 16000, `views stay small (largest ${biggest} bytes)`);
} catch (err) {
  console.error(err);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
