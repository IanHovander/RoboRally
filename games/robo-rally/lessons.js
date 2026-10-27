// The rule film the lobby plays on the big screen, and the Briefing's scenes: tiny courses where robots
// run real programs through the real rules (engine.js), so what people watch is exactly how the game behaves.
//   LESSONS (the lobby film, wordless):
//     1. Five cards, in order, take your robot to the flag. It starts facing the camera, so its left
//        turn goes to the screen's right.
//     2. After every card the board moves too: belts carry, gears turn, lasers hit, pits swallow.
//     3. Damage is cards: a laser in the back sends a SPAM card to your phone, then a Haywire jams a slot.
//     4. Robots push each other; flags in order; the first to the last flag wins.
//   BRIEF (the Briefing's mechanics shots): a flag counts only if you stop on it; the order things
//   happen in; pushes, falls and the reboot.
// No DOM here at module level: the phones' clips (demo.js) import this file too.
import * as E from './engine.js';
import { cardType } from './cards.js';

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

const empty = (w, h) => Array.from({ length: h }, () => Array(w).fill('..').join(' '));

export const LESSONS = [
  {
    // five cards, one flag. The robot starts facing the camera (south): its Rotate Left turns it to the
    // screen's right, which is the "whose left?" trap, shown rather than told.
    id: 'lesson-program',
    phone: true,
    line: true, // a dotted path of light grows on the glass as each card is placed (the phone's light line)
    grid: empty(5, 4),
    flags: [[3, 0]],
    robots: [[0, 0, 'S']],
    rounds: [[['m2', 'rl', 'm3', 'rl', 'm2']]],
  },
  {
    // the board moves after every card. The wall laser and the fall give SPAM only (no Haywire nobody
    // explained), and round 2 is a sensible program; the scene stops at the reboot.
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
    damage: ['sp', 'sp', 'sp'],
    rounds: [[['m1', 'rr', 'm1', 'm1', 'm1']], [['m1', 'm1', 'rl', 'm1', 'm1']]],
    stopAfter: 'reboot',
  },
  {
    // damage is cards. L0 (the phone's robot) is shot in the back in register 1 (a SPAM card flies to
    // the phone) and in register 3 (a Haywire jams slot 3). Then L1 follows it, Move 1 twice, and hits it
    // after each card (lasers fire every register, not just when a robot turns to face you). Next round
    // L1 steps out of the way and the Haywire runs in slot 3.
    id: 'lesson-damage',
    phone: true,
    deck: true, // the phone shows its deck stack (where the SPAM lands)
    grid: empty(6, 3),
    robots: [[2, 1, 'E'], [0, 1, 'E']],
    damage: ['sp', 'h01', 'sp', 'sp'],
    rounds: [
      [['m1', 'rl', 'rr', 'm1', 'm1'], ['m1', 'rr', 'rl', 'm1', 'm1']],
      [['bk', 'ut', null, 'rl', 'm1'], ['rr', 'm1', 'rl', 'rl', 'rl']],
    ],
    slowRounds: [2], // round 2: the fingertip fills the slots around the locked one
    stopAt: { round: 2, reg: 4, before: true }, // once the Haywire has run in slot 3
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
    damage: ['sp', 'sp', 'sp', 'sp', 'sp', 'sp'], // junk only: no Haywire the film never explained
    rounds: [[
      ['m3', 'rr', 'm2', 'm3', 'm1'],
      ['m3', 'rr', 'm1', 'rl', 'm1'],
      ['m1', 'rl', 'm2', 'm1', 'm1'],
    ]],
  },
];

/** The Briefing's mechanics shots (section 3.2 of docs/teaching/design.md). */
export const BRIEF = {
  // a flag counts only if you stop on it: Move 3 drives over it, Move Back lands on it
  stop: {
    id: 'brief-stop',
    grid: empty(5, 3),
    flags: [[2, 1]],
    robots: [[0, 1, 'E']],
    rounds: [[['m3', 'bk', 'rl', 'rl', 'rl']]],
  },
  // everyone plays slot 1 in order (the robot marked 1 first), then the floor moves, then slot 2
  order: {
    id: 'brief-order',
    grid: ['.. .. .. .. .. ..', '.. .. .. .. .. ..', 'g> g> g> .. G+ ..', '.. .. .. .. .. ..'],
    robots: [[0, 3, 'N'], [3, 3, 'N'], [4, 3, 'N']],
    rounds: [[['m1', 'm1', 'm1', 'm1', 'm1'], ['m2', 'rl', 'm1', 'm1', 'm1'], ['m1', 'rl', 'm1', 'm1', 'm1']]],
    stopAt: { reg: 2 },
  },
  // robots shove robots into pits; the fallen one reboots on the blue ring next round
  push: {
    id: 'brief-push',
    grid: ['.. .. .. .. ..', '.. .. .. XX ..', '.. .. .. .. ..'],
    reboot: [4, 2, 'W'],
    robots: [[0, 1, 'E'], [2, 1, 'N']],
    damage: ['sp', 'sp'],
    rounds: [[['m2', 'rl', 'rl', 'rl', 'rl'], ['rl', 'rr', 'rl', 'rr', 'rl']], [['m1', 'm1', 'm1', 'm1', 'm1'], ['m1', 'm1', 'm1', 'm1', 'm1']]],
    stopAfter: 'reboot',
  },
};

const courses = new Map();
export function lessonCourse(lesson) {
  if (!courses.has(lesson.id)) courses.set(lesson.id, makeCourse(lesson.id, lesson));
  return courses.get(lesson.id);
}

/** Put these damage card types on top of the damage deck, in order (each a different card). */
function stackDamage(s, types) {
  const used = new Set();
  const top = [];
  for (const t of types) {
    const i = s.damage.findIndex((c, k) => !used.has(k) && cardType(c) === t);
    if (i < 0) continue;
    used.add(i);
    top.push(s.damage[i]);
  }
  s.damage = [...top, ...s.damage.filter((_, k) => !used.has(k))];
}

/**
 * Run a lesson through the rules. Returns { course, start: [robots], steps: [...] } where a step is
 *   { kind: 'program', round, cards: [[type|null ×5] per robot], locked: [[type|null ×5] per robot], shown }
 *     (cards: what each robot's player placed, null where a slot is locked; locked: the Haywire jammed
 *      in a slot; shown: the two merged, what each slot runs)
 *   { kind: 'beat', round, reg, beat, robots }   (robots: where everyone is after the beat)
 * def.damage: damage card types to put on top of the damage deck. A null in a round's cards leaves that
 * slot empty, and a slot locked by a Haywire keeps it (and runs it).
 * def.stopAfter: an fx kind; the run ends after the first beat with it.
 * def.stopAt: { reg, round = 1, before }; the run ends at the reveal of that register (the reveal
 * included, unless before).
 */
export function runLesson(lesson, seed = 7) {
  const course = lessonCourse(lesson);
  const ids = lesson.robots.map((_, i) => `L${i}`);
  const env = { course, connected: () => false, now: () => 0, name: (id) => id };
  const s = E.newGame({ order: ids, opts: { upgrades: false, timer: 0 }, seed });
  ids.forEach((id, i) => (s.picks[id] = i + 1));
  E.startRace(s, env);
  s.prio = 0;
  if (lesson.damage) stackDamage(s, lesson.damage);
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
    const locked = [];
    ids.forEach((id, i) => {
      const R = s.robots[id];
      const types = round[i] ?? round[0];
      const hand = types.map((t) => (t ? `${t}.${++serial}` : null));
      R.hand = hand.filter(Boolean);
      R.regs.forEach((r) => {
        if (!r.locked) Object.assign(r, { cards: [], locked: false, next: null, up: false, extra: [] });
      });
      locked.push(R.regs.map((r) => (r.locked && r.cards.length ? cardType(r.cards[0]) : null)));
      E.lockProgram(s, env, R, { regs: hand.map((c, k) => (c && !R.regs[k].locked ? [c] : [])) });
      cards.push(types.map((t, k) => (locked[i][k] ? null : t)));
    });
    const shown = cards.map((list, i) => list.map((t, k) => t ?? locked[i][k]));
    steps.push({ kind: 'program', round: s.round, cards, locked, shown, prio: s.prio });
    E.beginActivation(s, env);
    for (let guard = 0; guard < 300 && s.phase === 'activate'; guard++) {
      const beat = E.step(s, env);
      if (!beat) break;
      const at = lesson.stopAt;
      const atReveal = at && s.round === (at.round ?? 1) && beat.fx.some((f) => f.k === 'reveal' && f.reg === at.reg - 1);
      if (atReveal && at.before) return { course, start, steps };
      steps.push({ kind: 'beat', round: s.round, beat: JSON.parse(JSON.stringify(beat)), robots: snap(), reg: s.reg });
      if (lesson.stopAfter && beat.fx.some((f) => f.k === lesson.stopAfter)) return { course, start, steps };
      if (atReveal) return { course, start, steps };
    }
    if (s.phase === 'over') break;
  }
  return { course, start, steps };
}

// ---------------------------------------------------------------------------------------------
// Playing a run on the big screen's arena (the lobby film and the Briefing share this)
// ---------------------------------------------------------------------------------------------

/** How long a beat holds the stage (its own time, plus a breath). */
export const beatHold = (b) => b.dur * 1.12 + (b.what?.k === 'reveal' ? 150 : 60);

/** Who acts this register, in Priority order (the run gives L0 the Priority in round 1; it passes each round). */
const actingIds = (robots, prio = 0) => robots.map((_, k) => robots[(prio + k) % robots.length]).filter((r) => r.on !== false).map((r) => r.id);

/**
 * Play steps [from, to) of a lesson run on an arena (scene.js).
 *   pause(ms)       every wait goes through here (it may throw to stop the run)
 *   cast(i)         { name, color, avatar } for lesson robot i (players' colors, in seat order)
 *   mimic           the phone beside the board (mimic.js), or null: it programs, lights the running
 *                   slot, and receives L0's junk cards
 *   slow(step)      whether this program step is filled slowly, by a fingertip
 *   fast            the fingertip runs at the Briefing's quicker pace
 *   line            grow a dotted path of light on the glass as each card is placed (robot 0)
 *   regs(n)         show the register strip with register n lit (null hides it)
 *   onBeat(st, i)   called as each beat starts (for a shot's extra effects)
 *   winHold         the most a win's beat holds the stage (ms)
 *   tempo           the arena's time runs this much faster (arena.tempo): the holds shrink to match
 * Returns when the last step's beat has had its time.
 */
export async function playRun(arena, run, o = {}) {
  const { pause, cast = () => ({}), mimic = null, slow = () => false, line = false, regs = null, onBeat = null } = o;
  const from = o.from ?? 0;
  const to = o.to ?? run.steps.length;
  const robotsAt = (list) => list.map((r, i) => ({ ...r, ...cast(i), seat: i }));
  let program = null;
  for (let i = from - 1; i >= 0 && !program; i--) if (run.steps[i].kind === 'program') program = run.steps[i];
  let reg = -1;
  // L0's junk cards land on the phone beside the board, when the scene shows them landing
  const off = mimic
    ? arena.on((kind, d) => {
        if (kind === 'junk' && d.id === 'L0') mimic.junk({ sp: d.sp, hw: d.hw, reg, from: arena.screenPos('L0') });
      })
    : null;
  try {
    for (let i = from; i < to; i++) {
      const st = run.steps[i];
      if (st.kind === 'program') {
        program = st;
        regs?.(null);
        if (mimic) {
          const start = i === 0 ? run.start[0] : run.steps[i - 1].robots?.[0] ?? run.start[0];
          await mimic.program(st.cards[0], {
            slow: slow(st),
            fast: o.fast,
            locked: st.locked[0],
            pause,
            color: cast(0).color,
            onPlace: line ? (placed) => arena.ghostPath(placedGhosts(run, start, placed), cast(0).color) : null,
          });
        } else await pause(700);
        await pause(400 / (o.tempo ?? 1));
        continue;
      }
      const robots = robotsAt(st.robots);
      const b = st.beat;
      if (b.what?.k === 'reveal') {
        reg = st.reg;
        arena.showCards(robots.map((r, k) => ({ id: r.id, types: r.on ? [program.shown[k][st.reg]].filter(Boolean) : [] })));
        const acting = actingIds(robots, program.prio);
        if (acting.length > 1) arena.orderMarks(acting);
        mimic?.lit(st.reg, program.locked[0]?.[st.reg]);
        regs?.(st.reg);
      }
      arena.playBeat(b, robots);
      arena.syncRobots(robots);
      onBeat?.(st, i);
      // one robot alone: its card shows as it's played, so its reveal is only a breath
      let hold = holdFor(st, o);
      await pause(hold / (o.tempo ?? 1));
      arena.syncRobots(robots);
    }
  } finally {
    off?.();
  }
}

/** The light line for the cards placed so far (robot 0, ignoring other robots), as minimap.previewProgram draws it. */
function placedGhosts(run, start, placed) {
  // lazily imported shape: { x, y, d, n, path } per register, the same the phones draw
  const ghosts = [];
  let { x, y, d } = start;
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  const course = run.course;
  placed.forEach((t, r) => {
    const path = [[x, y]];
    if (!t) return;
    const n = { m1: 1, m2: 2, m3: 3, bk: -1 }[t];
    if (n) {
      const dir = n < 0 ? turn(d, 2) : d;
      for (let k = 0; k < Math.abs(n); k++) {
        const nx = x + dx[dir];
        const ny = y + dy[dir];
        if (nx < 0 || ny < 0 || nx >= course.w || ny >= course.h) break;
        x = nx;
        y = ny;
        path.push([x, y]);
      }
    } else if (t === 'rr') d = turn(d, 1);
    else if (t === 'rl') d = turn(d, -1);
    else if (t === 'ut') d = turn(d, 2);
    ghosts.push({ x, y, d, n: r + 1, path });
  });
  return ghosts;
}

/**
 * How long playRun holds a beat step: a lone robot's reveal is a breath; revealHold and winHold (optional) cap a
 * card reveal and a win.
 */
export function holdFor(st, o = {}) {
  const b = st.beat;
  let hold = b.what?.k === 'reveal' && st.robots.length < 2 ? 300 : beatHold(b);
  if (b.what?.k === 'reveal' && o.revealHold != null) hold = Math.min(hold, o.revealHold);
  if (b.fx.some((f) => f.k === 'win')) hold = Math.min(hold, o.winHold ?? Infinity);
  return hold;
}

/** A run's length in ms if played straight through by playRun (for the film's progress dots). */
export function runLength(run, { programMs = () => 1100, revealHold, winHold } = {}) {
  let ms = 0;
  for (const st of run.steps) ms += st.kind === 'program' ? programMs(st) + 400 : holdFor(st, { revealHold, winHold });
  return ms;
}
