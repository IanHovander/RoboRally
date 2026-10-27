// Robo Rally checks: the rules on a test board (fast, no server), then a real game through the server.
//   node test/robo-rally.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import * as E from '../games/robo-rally/engine.js';
import rules from '../games/robo-rally/rules.js';
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
// 1b. The room around the rules (rules.js): the Briefing, round 1, holds, each phone's story
// ---------------------------------------------------------------------------------------------

/** A game through rules.js with fake phones: the real actions, views and timers (fired by hand). */
function room(n, { raced = [], opts = {}, begin = true } = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `q${i}`, name: `Q${i}`, color: '#336699', connected: true, isVip: i === 0 }));
  const timers = new Map();
  const ctx = {
    state: null,
    players,
    player: (id) => players.find((p) => p.id === id) ?? null,
    timer: (name, ms, fn) => timers.set(name, { ms, fn }),
    cancelTimer: (name) => timers.delete(name),
    after: () => () => {},
    end: () => {},
  };
  rules.setup(ctx);
  const t = {
    ctx,
    players,
    timers,
    get s() {
      return ctx.state;
    },
    act: (i, type, payload) => rules.actions[type](ctx, players[i], payload),
    host: (type, payload) => rules.hostActions[type](ctx, payload),
    fire(name) {
      const tm = timers.get(name);
      if (!tm) return false;
      timers.delete(name);
      tm.fn(ctx);
      return true;
    },
    hv: () => rules.hostView(ctx),
    pv: (i) => rules.playerView(ctx, players[i]),
    /** Run the race beat by beat (answering prompts) until `stop()` or the phase changes. */
    race(stop = () => false, answer = (p) => p.def) {
      for (let i = 0; i < 5000 && ctx.state.phase === 'activate' && !stop(); i++) {
        const p = ctx.state.prompt;
        if (p) t.act(players.findIndex((x) => x.id === p.id), 'answer', { v: answer(p) });
        else if (!t.fire('beat')) break;
      }
    },
  };
  for (const i of raced) t.act(i, 'hello', { raced: true });
  for (const [key, value] of Object.entries(opts)) t.act(0, 'setOpt', { key, value });
  if (begin) t.act(0, 'begin');
  return t;
}
const pickAll = (t) => t.players.forEach((p, i) => t.act(i, 'pick', { n: i + 1 }));
const everyone = (n) => Array.from({ length: n }, (_, i) => i);

/** Move a card of type t into a robot's hand (from its hand, deck or discard; SPAM from the damage pile). */
function grab(s, R, t) {
  for (const pile of [R.hand, R.deck, R.discard, s.damage]) {
    const i = pile.findIndex((c) => cardType(c) === t);
    if (i < 0) continue;
    const [c] = pile.splice(i, 1);
    R.hand.push(c);
    return c;
  }
  throw new Error(`no ${t} card`);
}
/** Lock in a program of card types (null: leave that slot empty). */
function plan(s, id, types) {
  const R = s.robots[id];
  R.draft = { regs: types.map((t) => (t ? [grab(s, R, t)] : [])), keep: [] };
  R.done = true;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** True if a view is plain JSON: no Sets, Maps, class instances or undefined in arrays. */
function plain(v) {
  if (v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v)) return true;
  if (Array.isArray(v)) return v.every((x) => x !== undefined && plain(x));
  return Object.getPrototypeOf(v) === Object.prototype && Object.values(v).every(plain);
}

{
  const t = room(3, { raced: [0, 1, 2] });
  pickAll(t);
  check(t.s.phase === 'program' && t.s.round === 1 && !t.hv().teach && t.hv().brief === null, 'no newcomer: no Briefing, programming starts');
}
{
  // setting up: upgrades start off while anyone is new; otherwise the leader's last-game settings
  const t = room(3, { begin: false });
  check(t.s.opts.upgrades === false, 'setting up with newcomers: upgrades start off');
  t.act(0, 'hello', { raced: true, prefs: { upgrades: true, timer: 60, lessDeadly: true, lessSpam: false } });
  t.act(1, 'hello', { raced: true, prefs: { upgrades: false, timer: 180 } });
  check(t.s.opts.upgrades === false && t.s.opts.timer === 120 && t.s.opts.lessDeadly === false && t.s.opts.lessSpam === false, 'one phone is still new: a first game (no shop, deadly edges, SPAM stays, 2 minutes)');
  t.act(2, 'hello', { raced: true });
  check(t.s.opts.upgrades === true && t.s.opts.timer === 60 && t.s.opts.lessDeadly === true, "everyone has raced: the leader's last game's settings");
  t.act(2, 'hello', { raced: false });
  check(t.s.opts.upgrades === false && t.s.opts.timer === 120, 'a newcomer: back to a first game');
  t.act(0, 'setOpt', { key: 'upgrades', value: true });
  check(t.s.opts.upgrades === true, 'the leader turns upgrades on by hand, newcomer or not');
  t.act(2, 'hello', { raced: true });
  // the leader leaves: the settings stay (the new leader's own last game doesn't replace them)
  t.players[0].connected = false;
  t.players[0].isVip = false;
  t.players[1].isVip = true;
  rules.onDisconnect(t.ctx, t.players[0]);
  check(t.s.opts.timer === 60 && t.s.opts.upgrades === true, 'the leader leaves while setting up: the settings stay as they were');
}
{
  // a phone sees what's in its own piles (counts, not order), and everyone's installed upgrades
  const t = room(2, { raced: [0, 1] });
  pickAll(t);
  const me = t.pv(0).me;
  const inDeck = Object.values(me.deckCards).reduce((a, b) => a + b, 0);
  check(inDeck === me.deck && me.discardCards && Array.isArray(t.pv(0).robots[1].ups), "a phone's view: what's in its deck and discard, and every robot's installed upgrades");
}
{
  const t = room(3, { raced: [0, 1, 2] });
  t.s.opts.brief = true; // the leader's Briefing toggle (setOpt, in setup)
  check(t.hv().teach === true, 'the Briefing toggle: the big screen teaches even with no newcomer');
  pickAll(t);
  check(t.s.phase === 'brief' && t.s.round === 1, `the Briefing toggle: veterans get the Briefing too (got ${t.s.phase})`);
}
{
  const t = room(3, { raced: [0, 1] });
  check(t.hv().teach === true, 'a phone that never says hello counts as a newcomer');
  t.act(2, 'hello', { raced: true });
  check(t.hv().teach === false, '...until it says it has raced');
  t.act(2, 'hello', { raced: false });
  pickAll(t);
  const hv = t.hv();
  check(t.s.phase === 'brief' && t.s.round === 1 && hv.teach && same(hv.brief, { votes: [], need: 2 }), `a newcomer is racing: the Briefing runs after the start pads (got ${t.s.phase})`);
  check(same(t.pv(0).brief, { votes: 0, need: 2, mine: false }), "the phone's Briefing view: votes, votes needed, mine");
  t.act(2, 'hello', { raced: true });
  check(t.hv().teach === true, 'who is new is decided when the start pads are picked');
  check(t.timers.get('deadline')?.ms === 150_000, 'the Briefing has a 150 s deadline');
  check(t.act(0, 'lock', { regs: t.s.robots.q0.hand.slice(0, 5).map((c) => [c]) })?.error && t.act(0, 'buy')?.error, 'nobody can program or shop during the Briefing');
}
for (const [n, k] of [[1, 1], [2, 2], [3, 2], [5, 3]]) {
  const t = room(n);
  pickAll(t);
  for (let i = 0; i < k - 1; i++) t.act(i, 'skip', { on: true });
  const still = t.s.phase === 'brief' && t.hv().brief.votes.length === k - 1 && t.hv().brief.need === k;
  t.act(k - 1, 'skip', { on: true });
  check(still && t.s.phase === 'program', `${k} of ${n} votes skip the Briefing (and ${k - 1} don't)`);
}
{
  const t = room(3);
  pickAll(t);
  t.act(0, 'skip', { on: true });
  const voted = t.pv(0).brief.mine && t.pv(1).brief.votes === 1 && same(t.hv().brief.votes, ['q0']);
  t.act(0, 'skip', { on: false });
  t.act(1, 'skip', { on: true });
  check(voted && t.s.phase === 'brief' && !t.pv(0).brief.mine && t.hv().brief.votes.length === 1, 'a second tap takes the vote back');
  t.players[2].connected = false;
  rules.onDisconnect(t.ctx, t.players[2]);
  check(t.s.phase === 'brief' && t.hv().brief.need === 2, 'a dropped phone lowers the votes needed (2 of 2 left)');
  t.act(0, 'skip', { on: true });
  check(t.s.phase === 'program', '...and the remaining phones can still skip it');
}
for (const how of ['briefDone', 'briefSkip', 'deadline']) {
  const t = room(2);
  pickAll(t);
  if (how === 'deadline') t.fire('deadline');
  else t.host(how);
  check(t.s.phase === 'program' && t.s.brief === null && t.timers.get('deadline')?.ms === 120_000, `${how} ends the Briefing and starts the programming timer`);
}
{
  const t = room(2, { raced: [0, 1] });
  pickAll(t);
  const v = t.pv(0);
  check(t.s.phase === 'program' && v.me.up.hand.length === 3 && v.me.en === 3 && v.me.hand.length === 9, 'round 1 has no shop: straight to programming, with 3 upgrades and 3 Energy kept');
  t.fire('deadline');
  t.race();
  check(t.s.phase === 'upgrade' && t.s.round === 2, `round 2 opens the shop (got ${t.s.phase} round ${t.s.round})`);
  const u = room(1, { raced: [0], opts: { upgrades: false } });
  pickAll(u);
  u.fire('deadline');
  u.race();
  check(u.s.phase === 'program' && u.s.round === 2, 'without upgrades every round is programming');
}
{
  const t = room(2, { raced: [0, 1] });
  pickAll(t);
  t.host('hold', { ms: 3000 });
  check(!t.timers.has('beat'), 'hold does nothing outside the race');
  t.fire('deadline');
  t.fire('beat');
  const before = t.timers.get('beat').ms;
  t.host('hold', { ms: 60_000 });
  const due = t.s.beatDue - Date.now();
  check(t.timers.get('beat').ms === 4000 && due > 3900 && due <= 4000, `hold extends the current beat, at most 4 s (was ${before} ms)`);
  t.host('hold', { ms: 500 });
  check(t.timers.get('beat').ms === 4000, 'a shorter hold never shortens it');
  t.s.prompt = { id: 'q0', deadline: Date.now() + 9000 };
  t.timers.delete('beat');
  t.host('hold', { ms: 3000 });
  check(!t.timers.has('beat'), 'hold is ignored while someone is choosing');
}
{
  // Act Fast: which slots the timer filled at random
  const t = room(2, { raced: [0, 1] });
  pickAll(t);
  const R = t.s.robots.q0;
  const hw = t.s.damage.find((c) => /^h/.test(cardType(c)));
  t.s.damage.splice(t.s.damage.indexOf(hw), 1);
  Object.assign(R.regs[3], { cards: [hw], locked: true });
  t.act(0, 'draft', { regs: [[R.hand[0]], [R.hand[1]], [], [], []] });
  const h = t.s.robots.q1.hand;
  t.act(1, 'lock', { regs: [[h[0]], [h[1]], [h[2]], [h[3]], [h[4]]] });
  t.fire('deadline');
  check(same(t.pv(0).me.auto, [2, 4]) && same(t.hv().robots[0].auto, [2, 4]), `auto: the empty, unlocked slots time filled (got ${JSON.stringify(t.pv(0).me.auto)})`);
  check(same(t.pv(1).me.auto, []) && same(t.hv().robots[1].auto, []), 'auto: nothing for a phone that locked in');
}
{
  // A scripted round on the lab board: a push into a pit, a SPAM swap, a belt ride, robot lasers
  const t = room(4, { raced: everyone(4), opts: { course: 'lab', upgrades: false } });
  pickAll(t);
  const s = t.s;
  s.prio = 0;
  s.damage.sort((a, b) => (cardType(a) === 'sp' ? 0 : 1) - (cardType(b) === 'sp' ? 0 : 1));
  const put = (id, x, y, d) => Object.assign(s.robots[id], { x, y, d, on: true });
  put('q0', 3, 6, 3); // A shoves B into the pit
  put('q1', 2, 6, 0);
  put('q2', 0, 3, 1); // C plays SPAM, gets Move 1, onto the blue belt; C and D shoot each other
  put('q3', 6, 3, 3);
  plan(s, 'q0', ['m1', null, null, null, null]);
  plan(s, 'q1', [null, null, null, null, null]);
  plan(s, 'q2', ['sp', null, null, null, null]);
  plan(s, 'q3', [null, null, null, null, null]);
  const C = s.robots.q2;
  const top = grab(s, C, 'm1');
  C.hand.splice(C.hand.indexOf(top), 1);
  C.deck.unshift(top);
  t.fire('deadline');
  t.race(() => s.reg >= 1);
  const story = (i) => t.pv(i).me.story;
  const want = {
    q0: [['s', 3, 6, 3], ['c', ['m1'], [3, 6, 2, 6], 0]],
    q1: [['s', 2, 6, 0], ['p', 'q0', [2, 6, 1, 6], [3, 6, 2, 6]], ['f', false], ['d', 2, 0, 'reboot']],
    q2: [['s', 0, 3, 1], ['x', 'sp', 'm1'], ['c', ['m1'], [0, 3, 1, 3], 0], ['b', true, [1, 3, 2, 3, 3, 3], 0], ['l', 'q3', 6, 3, 3, 1], ['d', 1, 0, 'laser']],
    q3: [['s', 6, 3, 3], ['l', 'q2', 3, 3, 1, 1], ['d', 1, 0, 'laser']],
  };
  check(story(0)?.round === 1 && story(0).regs.length === 5, 'each phone gets its own story of the round: 5 registers');
  check(same(story(0).regs[0], want.q0), `story: my card and the path it took (got ${JSON.stringify(story(0).regs[0])})`);
  check(same(story(1).regs[0], want.q1), `story: pushed by a robot (its path too), fell, took reboot damage (got ${JSON.stringify(story(1).regs[0])})`);
  check(same(story(2).regs[0], want.q2), `story: SPAM replaced, the new card, a blue belt's 2 spaces, a robot laser and its damage (got ${JSON.stringify(story(2).regs[0])})`);
  check(same(story(3).regs[0], want.q3), `story: shot by a robot (got ${JSON.stringify(story(3).regs[0])})`);
  check(same(story(1).regs[1], []) && story(0).regs[1][0][0] === 's', 'story: a fallen robot has nothing in the registers after its fall');
  t.race();
  check(t.s.phase === 'program' && story(2).round === 1 && story(2).regs[4].length > 0, 'story: kept through the next programming phase');
  t.fire('deadline');
  check(story(2).round === 2 && story(2).regs.every((r) => !r.length), 'story: a new one starts when the race does');
}
{
  // board lasers, a gear and a wall: one robot on the lab board
  const t = room(1, { raced: [0], opts: { course: 'lab', upgrades: false } });
  pickAll(t);
  const s = t.s;
  s.damage.sort((a, b) => (cardType(a) === 'sp' ? 0 : 1) - (cardType(b) === 'sp' ? 0 : 1));
  Object.assign(s.robots.q0, { x: 5, y: 1, d: 2 }); // in the wall laser's beam
  plan(s, 'q0', [null, null, null, null, null]);
  t.fire('deadline');
  t.race(() => s.reg >= 1);
  const regs = () => t.pv(0).me.story.regs;
  check(same(regs()[0], [['s', 5, 1, 2], ['l', 0, 9, 1, 3, 1], ['d', 1, 0, 'laser']]), `story: a board laser's source is 0 (got ${JSON.stringify(regs()[0])})`);
}
{
  const t = room(1, { raced: [0], opts: { course: 'lab', upgrades: false } });
  pickAll(t);
  const s = t.s;
  Object.assign(s.robots.q0, { x: 6, y: 7, d: 0 });
  plan(s, 'q0', ['m1', null, null, null, null]); // onto the green gear
  t.fire('deadline');
  t.race(() => s.reg >= 1);
  const r = t.pv(0).me.story.regs;
  check(same(r[0], [['s', 6, 7, 0], ['c', ['m1'], [6, 7, 6, 6], 0], ['g', 1]]), `story: a gear turned me (got ${JSON.stringify(r[0])})`);
}
{
  const t = room(1, { raced: [0], opts: { course: 'lab', upgrades: false } });
  pickAll(t);
  const s = t.s;
  Object.assign(s.robots.q0, { x: 8, y: 2, d: 0 });
  plan(s, 'q0', ['m3', null, null, null, null]);
  t.fire('deadline');
  t.race(() => s.reg >= 1);
  const r = t.pv(0).me.story.regs;
  check(same(r[0], [['s', 8, 2, 0], ['c', ['m3'], [8, 2, 8, 1, 8, 0], 0], ['w']]), `story: a wall stopped me (got ${JSON.stringify(r[0])})`);
}
{
  // The busiest case: 8 robots, upgrades, the longest course, 10 rounds. Every phone's view stays small.
  const t = room(8, { raced: everyone(8), opts: { course: 'everything-must-go', upgrades: true } });
  t.s.rng = 20261025;
  pickAll(t);
  let views = 0;
  let stories = 0;
  let clean = true;
  let rounds = 0;
  const pick = (list) => list[Math.floor(E.rand(t.s) * list.length)];
  const measure = () => {
    for (let i = 0; i < 8; i++) {
      const v = t.pv(i);
      views = Math.max(views, JSON.stringify(v).length);
      stories = Math.max(stories, JSON.stringify(v.me.story ?? null).length);
    }
  };
  while (rounds < 10 && t.s.phase !== 'over') {
    if (t.s.phase === 'upgrade') {
      for (let i = 0; i < 8; i++) {
        const R = t.s.robots[`q${i}`];
        t.act(i, 'buy');
        for (const c of [...R.up.hand]) if (!t.act(i, 'install', { card: c, replace: R.up.perm[0] ?? R.up.temp[0] })) break;
        t.act(i, 'done');
      }
    }
    for (let i = 0; i < 8; i++) {
      const R = t.s.robots[`q${i}`];
      t.act(i, 'arm', { on: true });
      const hand = [...R.hand];
      if (E.rand(t.s) < 0.05) t.act(i, 'lock', { shutdown: true });
      else if (E.rand(t.s) < 0.5) t.act(i, 'lock', { regs: R.regs.map((r) => (r.locked || !hand.length ? [] : [hand.shift()])) });
    }
    if (t.s.phase === 'program') t.fire('deadline'); // the rest are filled at random (Act Fast)
    measure();
    clean &&= plain(t.hv()) && plain(t.pv(0));
    for (let i = 0; i < 3000 && t.s.phase === 'activate'; i++) {
      const p = t.s.prompt;
      if (p) t.act(t.players.findIndex((x) => x.id === p.id), 'answer', { v: pick(p.options).v });
      else if (!t.fire('beat')) break;
      measure();
    }
    clean &&= plain(t.hv()) && plain(t.pv(0));
    rounds++;
  }
  check(rounds === 10, `the 8-robot race ran 10 rounds (${rounds})`);
  check(views < 16_000, `the largest phone view stays under 16 KB (${views} bytes)`);
  check(stories < 2500, `every story stays under 2.5 KB (${stories} bytes)`);
  check(clean, 'the views are plain JSON (no Sets or Maps)');
}

// ---------------------------------------------------------------------------------------------
// 2. A real game through the server
// ---------------------------------------------------------------------------------------------

const PORT = Number(process.env.TEST_PORT) + 1 || 3197; // (TEST_PORT: see smoke.mjs)
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
  const catalog = await (await fetch(URL + '/games/index.json')).json();
  check(catalog.length === 1 && catalog[0].id === 'robo-rally', 'this edition serves only Robo Rally');
  check(host.room.games.length === 1 && host.room.selectedGameId === 'robo-rally', 'Robo Rally is selected automatically');
  for (const [i, p] of players.entries()) await p.socket.timeout(3000).emitWithAck('join', { name: `P${i + 1}` });
  host.socket.emit('lobby', { cmd: 'select', gameId: 'tap-race' });
  await wait(100);
  check(host.room.selectedGameId === 'robo-rally', 'a client cannot select an unavailable game');
  host.socket.emit('lobby', { cmd: 'start' });
  check(await until(() => host.room?.screen === 'game' && host.self?.view?.phase === 'setup'), 'Robo Rally starts in the setup screen');
  await act(players[1], 'setOpt', { key: 'course', value: 'blue-light-special' });
  check(host.self.view.opts.course === 'closing-time', 'only the leader can change the course');
  await act(players[0], 'setOpt', { key: 'course', value: 'blue-light-special' });
  await act(players[0], 'setOpt', { key: 'timer', value: 60 });
  check(host.self.view.opts.upgrades === false, 'newcomers racing: upgrades start off');
  await act(players[0], 'setOpt', { key: 'upgrades', value: true });
  check(await until(() => host.self.view.opts.course === 'blue-light-special' && host.self.view.opts.upgrades === true), 'the leader picks the course, and turns upgrades on');
  await act(players[0], 'begin');
  check(await until(() => players[0].self?.view?.phase === 'start'), 'then everyone picks a start space');
  await act(players[0], 'pick', { n: 1 });
  const taken = await act(players[1], 'pick', { n: 1 });
  check(taken?.error, 'two robots cannot pick the same start space');
  await act(players[1], 'pick', { n: 2 });
  await act(players[2], 'pick', { n: 3 });
  // these phones never said hello, so they count as newcomers: the Briefing comes first
  check(await until(() => players[0].self.view.phase === 'brief' && host.self.view.phase === 'brief'), 'newcomers racing: the Briefing starts after the start pads');
  check(host.self.view.teach === true && host.self.view.brief?.need === 2, 'the big screen knows to teach, and that 2 of 3 votes skip the Briefing');
  await act(players[0], 'skip', { on: true });
  check(await until(() => host.self.view.brief?.votes.length === 1 && players[0].self.view.brief?.mine), 'a phone votes to skip');
  await act(players[1], 'skip', { on: true });
  check(await until(() => players[0].self.view.phase === 'program' && players[0].self.view.round === 1), 'a majority skips it, and round 1 goes straight to programming (no shop)');
  const v0 = players[0].self.view;
  check(v0.me.up.hand.length === 3 && v0.me.en === 3, 'each robot gets 3 upgrades and 3 Energy');
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
  host.socket.emit('action', { type: 'hold', payload: { ms: 1500 } });
  check(await until(() => host.self.view.phase === 'upgrade' && host.self.view.round === 2, 45000), 'all 5 registers run and round 2 opens the shop');
  const story = players[0].self.view.me.story;
  check(story?.round === 1 && story.regs.length === 5 && story.regs[0][0]?.[0] === 's' &&!JSON.stringify(host.self.view).includes('"story"'), "each phone gets the story of its round (and the big screen doesn't)");
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
