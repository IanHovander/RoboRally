// The rule film the lobby plays on the big screen: three tiny courses where robots run real programs
// through the real rules (engine.js), so what people watch is exactly how the game behaves.
//   1. Five cards, in order, take your robot to the flag.
//   2. After every card the board moves too: belts carry, gears turn, lasers hit, pits swallow.
//   3. Robots push each other; flags in order; the first to the last flag wins.
import * as E from './engine.js';

const LETTER = { N: 0, E: 1, S: 2, W: 3 };
const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };
const turn = (d, n) => (((d + n) % 4) + 4) % 4;

/** A small course in board.js's notation (no rotation, one board). */
function makeCourse(id, def) {
  const h = def.grid.length;
  const w = def.grid[0].trim().split(/\s+/).length;
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = def.grid[y].trim().split(/\s+/);
    for (let x = 0; x < w; x++) {
      const code = row[x];
      const cell = { k: 'floor', walls: 0, b: 0 };
      if (code === 'XX') cell.k = 'pit';
      else if (code === 'EE') cell.k = 'battery';
      else if (code === 'G+' || code === 'G-') Object.assign(cell, { k: 'gear', spin: code === 'G+' ? 1 : -1 });
      else if (code[0] === 'g' || code[0] === 'b') Object.assign(cell, { k: 'belt', fast: code[0] === 'b', d: ARROW[code[1]] });
      cells.push(cell);
    }
  }
  for (const spec of def.walls ?? []) {
    const [pos, sides] = spec.split(':');
    const [x, y] = pos.split(',').map(Number);
    for (const ch of sides) cells[y * w + x].walls |= 1 << LETTER[ch];
  }
  const lasers = (def.lasers ?? []).map(([x, y, d, n]) => ({ x, y, d: LETTER[d], n }));
  for (const l of lasers) cells[l.y * w + l.x].walls |= 1 << turn(l.d, 2);
  const checkpoints = (def.flags ?? []).map(([x, y], i) => ({ x, y, n: i + 1 }));
  const starts = def.robots.map(([x, y, d], i) => ({ x, y, d: LETTER[d], n: i + 1 }));
  const reboot = def.reboot ? { x: def.reboot[0], y: def.reboot[1], d: LETTER[def.reboot[2]] } : null;
  const course = {
    id, name: id, w, h, cells, lasers, pushers: [], checkpoints, starts,
    boards: [{ name: id, dock: false, x: 0, y: 0, w, h, reboot }],
  };
  course.tokens = new Map();
  for (const cp of checkpoints) course.tokens.set(cp.y * w + cp.x, 'checkpoint');
  if (reboot) course.tokens.set(reboot.y * w + reboot.x, 'reboot');
  return course;
}

export const LESSONS = [
  {
    // five cards, one flag
    id: 'lesson-program',
    phone: true,
    grid: [
      '.. .. .. .. ..',
      '.. .. .. .. ..',
      '.. .. .. .. ..',
      '.. .. .. .. ..',
    ],
    flags: [[3, 0]],
    robots: [[0, 3, 'N']],
    rounds: [[['m2', 'rr', 'm3', 'rl', 'm1']]],
  },
  {
    // the board moves after every card
    id: 'lesson-board',
    grid: [
      '.. .. .. .. .. .. ..',
      '.. g> g> g> G+ .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. .. .. XX .. ..',
    ],
    lasers: [[6, 2, 'W', 1]],
    reboot: [6, 0, 'W'],
    robots: [[1, 2, 'N']],
    rounds: [[['m1', 'rr', 'm1', 'm1', 'm1']], [['rl', 'rl', 'rl', 'rl', 'rl']]],
    stopAfter: 'reboot',
  },
  {
    // a race: pushing, flags in order, a winner
    id: 'lesson-race',
    grid: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. XX .. ..',
      '.. .. .. .. .. ..',
    ],
    flags: [[2, 1], [5, 1]],
    robots: [[0, 4, 'N'], [2, 4, 'N'], [5, 4, 'N']],
    rounds: [[
      ['m3', 'rr', 'm2', 'm3', 'm1'],
      ['m3', 'rr', 'm1', 'rl', 'm1'],
      ['m1', 'rl', 'm2', 'm1', 'm1'],
    ]],
  },
];

const courses = new Map();
export function lessonCourse(lesson) {
  if (!courses.has(lesson.id)) courses.set(lesson.id, makeCourse(lesson.id, lesson));
  return courses.get(lesson.id);
}

/**
 * Run a lesson through the rules. Returns { course, start: [robots], steps: [...] } where a step is
 * { kind: 'program', cards: [[types]...] } or { kind: 'beat', beat, robots, reg }.
 */
export function runLesson(lesson, seed = 7) {
  const course = lessonCourse(lesson);
  const ids = lesson.robots.map((_, i) => `L${i}`);
  const env = { course, connected: () => false, now: () => 0, name: (id) => id };
  const s = E.newGame({ order: ids, opts: { upgrades: false, timer: 0 }, seed });
  ids.forEach((id, i) => (s.picks[id] = i + 1));
  E.startRace(s, env);
  s.prio = 0;
  const snap = () => ids.map((id) => {
    const R = s.robots[id];
    return { id, x: R.x, y: R.y, d: R.d, on: R.on, cp: R.cp };
  });
  const start = snap();
  const steps = [];
  let serial = 1000;
  for (const round of lesson.rounds) {
    if (s.phase !== 'program') break;
    const cards = [];
    ids.forEach((id, i) => {
      const R = s.robots[id];
      const types = round[i] ?? round[0];
      const hand = types.map((t) => `${t}.${++serial}`);
      R.hand = [...hand];
      R.regs.forEach((r) => Object.assign(r, { cards: [], locked: false, next: null, up: false, extra: [] }));
      E.lockProgram(s, env, R, { regs: hand.map((c) => [c]) });
      cards.push(types);
    });
    steps.push({ kind: 'program', cards });
    E.beginActivation(s, env);
    for (let guard = 0; guard < 300 && s.phase === 'activate'; guard++) {
      const beat = E.step(s, env);
      if (!beat) break;
      steps.push({ kind: 'beat', beat: JSON.parse(JSON.stringify(beat)), robots: snap(), reg: s.reg });
      if (lesson.stopAfter && beat.fx.some((f) => f.k === lesson.stopAfter)) return { course, start, steps };
    }
    if (s.phase === 'over') break;
  }
  return { course, start, steps };
}

