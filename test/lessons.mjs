// The big screen's teaching scenes, checked through the real rules: every lobby film scene (LESSONS) and
// every Briefing scene (BRIEF) runs through engine.js, and each shows what it is meant to show. Then the
// race's first-time callouts (teach.js): who hears them, how often, and how long they hold the race.
//   node test/lessons.mjs
import { LESSONS, BRIEF, runLesson, lessonCourse } from '../games/robo-rally/lessons.js';
import { getCourse } from '../games/robo-rally/board.js';

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

const beats = (run) => run.steps.filter((st) => st.kind === 'beat');
const fxOf = (run, pred) => beats(run).flatMap((st) => st.beat.fx.filter(pred).map((f) => ({ ...f, round: st.round, reg: st.reg, st })));

// every scene runs, through the same seeds the film uses
const runs = {};
LESSONS.forEach((l, i) => (runs[l.id] = runLesson(l, 11 + i)));
for (const [k, l] of Object.entries(BRIEF)) runs[`BRIEF.${k}`] = runLesson(l, 11);
for (const [name, run] of Object.entries(runs)) {
  check(run.steps.length > 1 && run.steps[0].kind === 'program', `${name} runs through the rules (${run.steps.length} steps)`);
}
check(LESSONS.length === 4, 'the lobby film has four scenes');
check(LESSONS.map((l) => l.id).join() === 'lesson-program,lesson-board,lesson-damage,lesson-race', 'in order: program, board, damage, race');

// 1. Program: starts facing the camera (south); its Rotate Left turns it east (the screen's right); wins in register 5
{
  const run = runs['lesson-program'];
  const lesson = LESSONS[0];
  check(lesson.robots[0][2] === 'S', 'lesson-program: the robot starts facing the camera');
  const afterTurn = beats(run).find((st) => st.reg === 1 && st.beat.fx.some((f) => f.k === 'turn'));
  check(afterTurn?.robots[0].d === 1, "lesson-program: its Rotate Left turns it to face east (the screen's right)");
  const win = fxOf(run, (f) => f.k === 'win');
  check(win.length === 1 && win[0].reg === 4, 'lesson-program wins in register 5');
}

// 2. Board: round 2 is a sensible program, and nothing but SPAM is dealt (no unexplained Haywire)
{
  const run = runs['lesson-board'];
  const programs = run.steps.filter((st) => st.kind === 'program');
  check(programs.length === 2 && programs[1].cards[0].join() === 'm1,m1,rl,m1,m1', 'lesson-board: round 2 programs m1 m1 rl m1 m1');
  const dmg = fxOf(run, (f) => f.k === 'dmg');
  check(dmg.length >= 2 && dmg.every((f) => f.hw === 0), 'lesson-board: the wall laser and the fall give SPAM only');
  check(dmg.some((f) => f.src === 'laser') && dmg.some((f) => f.src === 'reboot'), 'lesson-board: the wall laser hits, the robot falls');
  check(beats(run).at(-1).beat.fx.some((f) => f.k === 'reboot'), 'lesson-board stops after the reboot');
}

// 3. Damage: L0 gets SPAM in register 1, a Haywire (h01) locks slot 3, and it runs there in round 2
{
  const run = runs['lesson-damage'];
  const dmg = fxOf(run, (f) => f.k === 'dmg' && f.id === 'L0');
  check(dmg.some((f) => f.round === 1 && f.reg === 0 && f.sp === 1 && f.hw === 0), 'lesson-damage gives L0 a SPAM card in register 1');
  check(dmg.some((f) => f.round === 1 && f.reg === 2 && f.hw === 1), 'lesson-damage gives L0 a Haywire in register 3');
  const p2 = run.steps.filter((st) => st.kind === 'program')[1];
  check(p2?.locked[0][2] === 'h01', 'lesson-damage locks h01 in slot 3 for round 2');
  check(p2?.cards[0].join() === 'bk,ut,,rl,m1', 'lesson-damage: round 2 fills the slots around the locked one');
  const ran = beats(run).find((st) => st.round === 2 && st.reg === 2 && st.beat.what?.k === 'card' && st.beat.what.id === 'L0');
  check(ran?.beat.what.cards.includes('h01'), 'lesson-damage runs h01 in round 2 register 3');
  const moves = beats(run).filter((st) => st.round === 2 && st.reg === 2 && st.beat.what?.id === 'L0');
  const path = moves.map((st) => `${st.robots[0].x},${st.robots[0].y},${'NESW'[st.robots[0].d]}`);
  check(path.join(' ') === '4,1,W 3,1,W 3,1,N 3,0,N', `lesson-damage: the Haywire moves 1, turns right, moves 1 (${path.join(' ')})`);
  check(beats(run).at(-1).round === 2 && beats(run).at(-1).reg === 2, 'lesson-damage ends once the Haywire has run');
}

// 4. Race: robots push robots; flags in order; a winner
{
  const run = runs['lesson-race'];
  check(fxOf(run, (f) => f.k === 'shove').length > 0, 'lesson-race has a push');
  check(fxOf(run, (f) => f.k === 'win').length === 1, 'lesson-race has a winner');
  check(fxOf(run, (f) => f.k === 'dmg').every((f) => f.hw === 0), 'lesson-race deals SPAM only');
}

// The Briefing's scenes
{
  const stop = runs['BRIEF.stop'];
  const cps = fxOf(stop, (f) => f.k === 'cp');
  check(!cps.some((f) => f.reg === 0), 'BRIEF.stop has no flag in register 1 (Move 3 drives over it)');
  check(cps.some((f) => f.reg === 1), 'BRIEF.stop reaches the flag in register 2 (Move Back stops on it)');
  const crossed = beats(stop).find((st) => st.reg === 0 && st.beat.fx.some((f) => f.k === 'move' && f.path.some(([x, y]) => x === 2 && y === 1)));
  check(!!crossed && crossed.robots[0].x === 3, 'BRIEF.stop: register 1 crosses the flag and ends past it');

  const push = runs['BRIEF.push'];
  const falls = fxOf(push, (f) => f.k === 'fall');
  check(falls.some((f) => f.round === 1 && f.reg === 0 && f.id === 'L1'), 'BRIEF.push has a fall in round 1 register 1 (L1, shoved)');
  check(fxOf(push, (f) => f.k === 'shove' && f.id === 'L0').some((f) => f.round === 1 && f.reg === 0), 'BRIEF.push: L0 is the one shoving');
  check(fxOf(push, (f) => f.k === 'reboot').some((f) => f.round === 2 && f.id === 'L1'), 'BRIEF.push has a reboot in round 2');
  const course = lessonCourse(BRIEF.push);
  const rb = fxOf(push, (f) => f.k === 'reboot')[0];
  check(rb && rb.x === course.boards[0].reboot.x && rb.y === course.boards[0].reboot.y, 'BRIEF.push: the robot reboots on the blue ring');

  const order = runs['BRIEF.order'];
  const last = beats(order).at(-1);
  check(last.beat.fx.some((f) => f.k === 'reveal' && f.reg === 1) && last.round === 1, 'BRIEF.order ends at the register 2 reveal');
  const kinds = beats(order).map((st) => st.beat.what?.k);
  check(kinds.includes('belt') && kinds.includes('gear'), 'BRIEF.order has a belt beat and a gear beat');
  check(kinds.indexOf('belt') < kinds.lastIndexOf('reveal') && kinds.indexOf('gear') < kinds.lastIndexOf('reveal'), 'BRIEF.order: the floor moves before slot 2');
  const plays = beats(order).filter((st) => st.reg === 0 && st.beat.fx.some((f) => f.k === 'play')).map((st) => st.beat.what.id);
  check(plays.join() === 'L0,L1,L2', `BRIEF.order: slot 1 plays in order, the robot marked 1 first (${plays.join()})`);
}

// The race's first-time callouts (teach.js), fed views by hand: no newcomer, no callouts (but the winner);
// a newcomer: each moment said once, holds of at most 4 s, and a second race in the session repeats nothing.
{
  const { createCallouts, spoken } = await import('../games/robo-rally/teach.js');
  const said = [];
  const holds = [];
  const voice = { say: async (text, o) => (said.push(o.id), await new Promise((r) => setTimeout(r, 2)), { spoken: true }), cancel() {} };
  const line = { show() {}, speaking() {}, word() {}, hide() {} };
  const arena = new Proxy({}, { get: () => () => {}, set: () => true });
  const course = getCourse('closing-time');
  const make = () => createCallouts({ voice, line, send: (t, p) => holds.push(p.ms), arena: () => arena, course: () => course });
  const robots = [{ id: 'a', name: 'Ada 🤖', seat: 0, x: 1, y: 1, on: true, cp: 0 }, { id: 'b', name: '', seat: 1, x: 2, y: 2, on: true, cp: 0 }];
  const view = (o) => ({ phase: 'activate', round: 1, reg: 0, opts: { timer: 60 }, teach: true, robots, beat: { n: 1, fx: [], what: null }, ...o });
  const beats = [
    { what: { k: 'reveal' }, fx: [{ k: 'reveal', reg: 0 }] },
    { what: { k: 'rlaser' }, fx: [{ k: 'beam', src: 'b', hit: ['a'] }, { k: 'dmg', id: 'a', sp: 1, hw: 0, src: 'laser' }] },
    { what: { k: 'belt' }, fx: [{ k: 'move', id: 'a', path: [[1, 1], [2, 1]] }] },
    { what: { k: 'card', id: 'b' }, fx: [{ k: 'fall', id: 'b', x: 2, y: 3 }] },
  ];
  const settle = () => new Promise((r) => setTimeout(r, 20));
  const race = async (teach) => {
    const c = make();
    for (const [n, b] of beats.entries()) {
      c.beat(view({ teach, beat: { n, ...b } }));
      await settle();
    }
    c.view(view({ teach, phase: 'over', winner: 'a' }), view({ teach }));
    await settle();
  };
  check(spoken('Ada 🤖', 0) === 'Ada' && spoken('', 1) === 'Unit 2', 'callouts: names are said without emoji; an empty one is "Unit n"');
  await race(false);
  check(said.join() === 'call-win', `callouts: no newcomer racing, only the winner is announced (${said.join()})`);
  said.length = 0;
  await race(true);
  check(['order', 'shot', 'damage', 'board', 'fall', 'win'].every((id) => said.includes(`call-${id}`)), `callouts: a newcomer hears each first time (${said.join()})`);
  check(new Set(said).size === said.length, 'callouts: nothing is said twice in a race');
  check(holds.length > 0 && holds.every((ms) => ms <= 4000), `callouts: each hold is at most 4 s (${holds.join()})`);
  said.length = 0;
  await race(true);
  check(said.join() === 'call-win', `callouts: a second race in the session repeats nothing but the winner (${said.join()})`);
}

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
