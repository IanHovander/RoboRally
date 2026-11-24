// Capture the Flag, passing the flag: the three ways to play it (games/robo-rally/passing.js), on the real map.
//   node test/passing.mjs
import * as E from '../games/robo-rally/engine.js';
import rules from '../games/robo-rally/rules.js';
import { getCourse } from '../games/robo-rally/board.js';
import { previewProgram } from '../games/robo-rally/minimap.js';
import { handTo, throwPath, sightTo, homeSteps } from '../games/robo-rally/passing.js';

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// The map (12 x 6 as the big screen shows it): team 1 (a, a~2) starts top left and hunts flag 1 at 11,0;
// team 2 (b, b~2) starts bottom right and hunts flag 2 at 0,5.
const course = getCourse('capture-the-flag');
let serial = 70000;
const card = (t) => `${t}.${++serial}`;

/** A race with two robots each, placed by hand. at: { id: [x, y, d] }; carry: the robot holding its flag. */
function ctf(pass, at, { carry = null } = {}) {
  const s = E.newGame({ order: ['a', 'b'], seed: 3, opts: { course: 'capture-the-flag', upgrades: false, pass } });
  s.bots = ['a', 'a~2', 'b', 'b~2'];
  s.picks = { a: 1, 'a~2': 3, b: 2, 'b~2': 4 };
  const env = { course, connected: () => true, now: () => 0, name: (id) => id };
  E.startRace(s, env);
  s.prio = 0;
  for (const [id, [x, y, d]] of Object.entries(at)) Object.assign(s.robots[id], { x, y, d, on: true, hand: [] });
  if (carry) s.robots[carry].cp = 1;
  return { s, env, R: (id) => s.robots[id] };
}
function program(t, id, types, passAt = null) {
  const R = t.s.robots[id];
  const regs = types.map((list) => (list == null ? [] : [].concat(list).map(card)));
  R.hand.push(...regs.flat());
  R.draft = { regs, keep: [] };
  R.done = true;
  R.passAt = passAt;
}
const idle = [null, null, null, null, null];
function run(t, registers = 5) {
  const { s, env } = t;
  for (const id of s.bots) if (!s.robots[id].done) program(t, id, idle);
  E.beginActivation(s, env);
  const fx = [];
  for (let i = 0; i < 5000 && s.phase === 'activate' && s.reg < registers; i++) {
    const b = E.step(s, env);
    if (b) fx.push(...b.fx);
    if (s.prompt) E.answerPrompt(s, env, s.prompt.id, s.prompt.def);
  }
  return fx;
}
const passes = (fx) => fx.filter((f) => f.k === 'pass');

// ---------- the questions (passing.js) ----------
check(homeSteps(course, 1, 0, 0) === 0 && homeSteps(course, 1, 3, 3) === 5, 'home is the nearest of the team\'s start pads');
check(handTo(course, { x: 5, y: 2 }, [{ x: 6, y: 3 }]) && handTo(course, { x: 5, y: 2 }, [{ x: 5, y: 1 }]) && !handTo(course, { x: 5, y: 2 }, [{ x: 7, y: 2 }]), 'hand-off: any of the eight squares around the carrier, and no farther');
check(!handTo(course, { x: 7, y: 2 }, [{ x: 6, y: 2 }]), 'hand-off: not through a wall');
{
  const thrower = { id: 'a', x: 7, y: 0, d: 3, hunt: 1 };
  const t1 = throwPath(course, thrower, [thrower, { id: 'a~2', x: 4, y: 0, hunt: 1 }]);
  check(t1.end === 'catch' && t1.to.id === 'a~2' && t1.path.length === 4, 'throw: the teammate in the way catches it');
  const t2 = throwPath(course, thrower, [thrower, { id: 'b', x: 5, y: 0, hunt: 2 }, { id: 'a~2', x: 4, y: 0, hunt: 1 }]);
  check(t2.end === 'block' && t2.to.id === 'b', 'throw: an opponent in the way blocks it first');
  const t3 = throwPath(course, thrower, [thrower]);
  check(t3.end === 'land' && t3.x === 3 && t3.y === 0, `throw: nobody in the way, it lands 4 squares ahead (got ${t3.x},${t3.y})`);
  check(throwPath(course, { id: 'a', x: 1, y: 0, d: 0, hunt: 1 }, []).end === 'out', 'throw: over the edge');
  check(throwPath(course, { id: 'a', x: 7, y: 2, d: 3, hunt: 1 }, []).end === 'wall', 'throw: a wall right in front stops it leaving');
}
{
  const from = { x: 7, y: 0, hunt: 1 };
  check(sightTo(course, from, [{ x: 4, y: 0 }]), 'line of sight: a teammate in the same row, nearer home');
  check(!sightTo(course, from, [{ x: 9, y: 0 }]), 'line of sight: never away from home');
  check(!sightTo(course, from, [{ x: 2, y: 0 }]), 'line of sight: no more than 4 squares');
  check(!sightTo(course, from, [{ x: 4, y: 0 }], [{ x: 5, y: 0 }]), 'line of sight: a robot between blocks it');
  check(!sightTo(course, from, [{ x: 6, y: 1 }]), 'line of sight: a straight line only');
}

// ---------- the races ----------
{
  // Hand-off at slot 2: a~2 stands beside the carrier when slot 2 ends
  const t = ctf('hand', { a: [7, 0, 3], 'a~2': [5, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', [null, null, null, null, null], 1);
  program(t, 'a~2', [null, 'm1', null, null, null]);
  const fx = run(t, 2);
  check(t.R('a').cp === 0 && t.R('a~2').cp === 1, 'hand-off: the flag changes hands at the marked slot');
  check(passes(fx).length === 1 && passes(fx)[0].to === 'a~2', '…as one pass the big screen shows');
}
{
  // Hand-off with nobody beside: the carrier keeps it
  const t = ctf('hand', { a: [7, 0, 3], 'a~2': [2, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  const fx = run(t, 1);
  check(t.R('a').cp === 1 && passes(fx)[0]?.end === 'none', 'hand-off: nobody beside the carrier, it keeps the flag');
}
{
  // Hand-off: both robots marked the same slot. The flag goes once, not there and back.
  const t = ctf('hand', { a: [7, 0, 3], 'a~2': [8, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  program(t, 'a~2', idle, 0);
  run(t, 1);
  check(t.R('a~2').cp === 1 && t.R('a').cp === 0, 'hand-off: one pass a slot, never straight back');
}
{
  // Hand-off onto a home pad scores
  const t = ctf('hand', { a: [1, 0, 3], 'a~2': [0, 1, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  run(t, 1);
  check(t.s.phase === 'over' && t.s.winner === 'a~2', 'hand-off: caught on a home pad, it\'s a capture');
}
{
  // Throw to a teammate
  const t = ctf('throw', { a: [7, 0, 3], 'a~2': [4, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  run(t, 1);
  check(t.R('a~2').cp === 1 && t.R('a').cp === 0, 'throw: caught by the teammate 3 squares ahead');
}
{
  // Throw blocked by an opponent: back to its corner
  const t = ctf('throw', { a: [7, 0, 3], 'a~2': [3, 0, 1], b: [5, 0, 2], 'b~2': [11, 4, 3] }, { carry: 'a' }); // (b faces away: its own laser would drop the flag first)
  program(t, 'a', idle, 0);
  const fx = run(t, 1);
  check(t.R('a').cp === 0 && t.R('a~2').cp === 0 && !t.s.loose[1], 'throw: an opponent in the way sends the flag home');
  check(passes(fx)[0]?.end === 'block' && passes(fx)[0]?.back, '…and the big screen sees it fly back');
}
{
  // Throw to the floor; the teammate picks it up later; a defender would send it home
  const t = ctf('throw', { a: [7, 0, 3], 'a~2': [0, 3, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  run(t, 1);
  check(t.R('a').cp === 0 && t.s.loose[1]?.x === 3 && t.s.loose[1]?.y === 0, `throw: nobody to catch it, it lands on the floor (got ${JSON.stringify(t.s.loose[1])})`);
  check(E.flagSpot(t.s, t.env, 1)?.x === 3, 'the flag is where it landed, not in its corner');
  t.s.auto = {};
  const v = rules.playerView({ state: t.s, player: () => ({ name: 'x', connected: true }), players: [] }, { id: 'a' });
  check(v.loose?.[1]?.x === 3, 'the phones see the flag on the floor');
}
{
  const t = ctf('throw', { a: [7, 0, 3], 'a~2': [3, 3, 0], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  program(t, 'a~2', [null, 'm3', null, null, null]);
  run(t, 2);
  check(t.R('a~2').cp === 1 && !t.s.loose[1], 'a teammate ending a slot on the thrown flag picks it up');
}
{
  const t = ctf('throw', { a: [7, 0, 3], 'a~2': [0, 3, 1], b: [3, 3, 0], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  program(t, 'b', [null, 'm3', null, null, null]);
  const fx = run(t, 2);
  check(!t.s.loose[1] && fx.some((f) => f.k === 'flagback' && f.from), 'a defender ending a slot on the thrown flag sends it home');
}
{
  // Throw with a wall right in front: it keeps the flag
  const t = ctf('throw', { a: [7, 2, 3], 'a~2': [0, 3, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  run(t, 1);
  check(t.R('a').cp === 1, 'throw: a wall right in front, the carrier keeps the flag');
}
{
  // Line of sight: no marking needed
  const t = ctf('sight', { a: [7, 0, 3], 'a~2': [4, 0, 2], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  const fx = run(t, 1);
  check(t.R('a~2').cp === 1 && passes(fx).length === 1, 'line of sight: the flag goes to the teammate nearer home by itself');
  // ...and doesn't come back: a~2 is nearer home now
  run(t, 3);
  check(t.R('a~2').cp === 1, '…and stays there (never passed away from home)');
}
{
  // No passing option: nothing changes
  const t = ctf(undefined, { a: [7, 0, 3], 'a~2': [8, 0, 2], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  program(t, 'a', idle, 0);
  run(t, 1);
  check(t.R('a').cp === 1 && !t.s.queue.some((q) => q.t === 'pass'), 'without the option, nobody passes');
}
{
  // setPass: only for marked kinds, while programming
  const t = ctf('sight', { a: [7, 0, 3] });
  t.s.phase = 'program';
  check(E.setPass(t.s, t.env, t.R('a'), 2) !== null, 'line of sight has no slot to mark');
  const u = ctf('hand', { a: [7, 0, 3] });
  u.s.phase = 'program';
  check(E.setPass(u.s, u.env, u.R('a'), 2) === null && u.R('a').passAt === 2, 'hand-off: a slot is marked');
  check(E.setPass(u.s, u.env, u.R('a'), 7) !== null && E.setPass(u.s, u.env, u.R('a'), null) === null && u.R('a').passAt === null, '…a bad slot is refused, and the mark comes off');
}
// the phone's light line and the rules agree on where a robot stands at the end of each slot (the preview is built on it)
{
  const ghosts = previewProgram(course, { x: 4, y: 2, d: 1 }, [['m1'], ['m1']]);
  check(ghosts[1].x === 6 && ghosts[1].y === 2, 'the light line ends each slot where the rules do');
}

// with passing on, teammates don't shoot each other (a team game); without it, they still do
{
  const t = ctf('hand', { a: [7, 0, 3], 'a~2': [4, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  run(t, 1);
  check(t.R('a').cp === 1 && !t.R('a').discard.some((c) => c.startsWith('sp')), 'passing on: my other robot facing me doesn\'t shoot me (and I keep the flag)');
  const u = ctf(undefined, { a: [7, 0, 3], 'a~2': [4, 0, 1], b: [11, 5, 3], 'b~2': [11, 4, 3] }, { carry: 'a' });
  run(u, 1);
  check(u.R('a').cp === 0, 'passing off: the race is as it was (teammates\' lasers hit)');
}

// through the rules (rules.js): a phone marks the slot, for both its robots; the phone sees its other robot's plan
{
  const players = [{ id: 'a', name: 'Ana', color: '#51cf66', connected: true, isVip: true }, { id: 'b', name: 'Ben', color: '#ff4d6d', connected: true }];
  const timers = new Map();
  const ctx = { state: null, players, player: (id) => players.find((p) => p.id === id) ?? null, timer: (n, ms, fn) => timers.set(n, fn), cancelTimer: (n) => timers.delete(n), after: () => () => {}, end: () => {} };
  rules.setup(ctx);
  for (const p of players) rules.actions.hello(ctx, p, { raced: true, practiced: true });
  rules.hostActions.setOpt(ctx, { key: 'course', value: 'capture-the-flag' });
  rules.hostActions.setOpt(ctx, { key: 'pass', value: 'throw' });
  rules.hostActions.setOpt(ctx, { key: 'pass', value: 'sideways' });
  check(ctx.state.opts.pass === 'throw', 'the passing option takes only its three values');
  rules.hostActions.setOpt(ctx, { key: 'upgrades', value: false });
  rules.actions.begin(ctx, players[0]);
  timers.get('deadline')?.(ctx);
  const s = ctx.state;
  check(s.phase === 'program', `the race is programming (got ${s.phase})`);
  const R1 = s.robots.a;
  rules.actions.draft(ctx, players[0], { regs: [[R1.hand[0]], [], [], [], []], pass: 3 });
  check(s.robots.a.passAt === 3 && s.robots['a~2'].passAt === 3 && s.robots.b.passAt == null, 'a pass mark is the team\'s: both my robots, not theirs');
  const v = rules.playerView(ctx, players[0]);
  const mate = v.team.find((t) => t.id === 'a~2');
  check(v.pass === 'throw' && v.me.passAt === 3 && mate && Array.isArray(mate.plan) && mate.plan.length === 5, 'my phone sees the passing kind, the mark, and my other robot\'s plan');
  rules.actions.focus(ctx, players[0], { robot: 'a~2' });
  rules.actions.draft(ctx, players[0], { regs: [[s.robots['a~2'].hand[0]], [], [], [], []] });
  const v2 = rules.playerView(ctx, players[0]);
  check(v2.team.find((t) => t.id === 'a~2').plan[0].length === 1 && v2.team.find((t) => t.id === 'a').plan[0].length === 1, '…both plans, whichever robot the phone drives');
  const vb = rules.playerView(ctx, players[1]);
  check(!vb.team.some((t) => t.id.startsWith('a')), 'the other player never sees my plans');
  check(rules.hostView(ctx).pass === 'throw', 'the big screen knows the passing kind');
}

// random races: nobody breaks the flag's rules (one carrier at a time; a flag on the floor has no carrier)
for (const pass of ['hand', 'throw', 'sight']) {
  let bad = null;
  let passed = 0;
  let wins = 0;
  for (let game = 0; game < 25 && !bad; game++) {
    const s = E.newGame({ order: ['a', 'b'], seed: 100 + game, opts: { course: 'capture-the-flag', upgrades: game % 2 === 0, pass } });
    s.bots = ['a', 'a~2', 'b', 'b~2'];
    s.picks = { a: 1, 'a~2': 3, b: 2, 'b~2': 4 };
    const env = { course, connected: () => true, now: () => 0, name: (id) => id };
    E.startRace(s, env);
    // (a running start: both teams already have the flag, and the robots are scattered over the floor)
    const free = [];
    for (let y = 0; y < course.h; y++) for (let x = 0; x < course.w; x++) if (course.cells[y * course.w + x].k !== 'pit') free.push([x, y]);
    for (const id of s.bots) {
      const [x, y] = free.splice(Math.floor(E.rand(s) * free.length), 1)[0];
      Object.assign(s.robots[id], { x, y, d: Math.floor(E.rand(s) * 4) });
    }
    s.robots.a.cp = 1;
    s.robots.b.cp = 1;
    for (let round = 0; round < 30 && s.phase !== 'over' && !bad; round++) {
      if (s.phase === 'upgrade') E.startProgramming(s, env);
      for (const id of s.bots) {
        const R = s.robots[id];
        R.passAt = Math.floor(E.rand(s) * 6) < 5 ? Math.floor(E.rand(s) * 5) : null;
        E.autoProgram(s, env, R);
      }
      E.beginActivation(s, env);
      for (let i = 0; i < 3000 && s.phase === 'activate'; i++) {
        let b;
        try {
          b = E.step(s, env);
        } catch (e) {
          bad = `${e.message} (game ${game})`;
          break;
        }
        if (s.prompt) E.answerPrompt(s, env, s.prompt.id, s.prompt.def);
        if (b?.fx.some((f) => f.k === 'pass' && f.end !== 'none' && f.end !== 'wall')) passed++;
        for (const n of [1, 2]) {
          const carriers = s.bots.filter((id) => s.robots[id].hunt === n && s.robots[id].cp === 1);
          if (carriers.length > 1) bad = `two robots carry flag ${n}`;
          if (carriers.length && s.loose?.[n]) bad = `flag ${n} is carried and on the floor`;
        }
        if (!b && !s.prompt && s.phase === 'activate' && !s.queue.length) break;
      }
      if (s.phase === 'over') wins++;
    }
  }
  check(!bad, `${pass}: 25 random races keep the flag's rules${bad ? ` (${bad})` : ''} (${passed} passes, ${wins} captures)`);
}

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
