// The test drive's three drills (practice.js plays them on the phone): tiny courses where a newcomer programs a
// robot for real and watches it run by the real rules (lessons.js runs them through engine.js).
//   1. five cards, in order, take your robot to the flag;
//   2. left and right are the robot's own (it starts facing you, so its left is the screen's right);
//   3. the floor moves after every card (a belt carries you further than your cards do).
// Each has a hand of seven cards and one known route (the nudges follow it); any program that ends a slot on
// the flag wins. No DOM here, so tests can run every drill.
import { runLesson, lessonCourse } from './lessons.js';
import { previewProgram, filledRun } from './minimap.js';

const empty = (w, h) => Array.from({ length: h }, () => Array(w).fill('..').join(' '));

export const DRILLS = [
  {
    id: 'drill-go',
    grid: empty(5, 4),
    flags: [[3, 1]],
    robots: [[1, 3, 'N']],
    hand: ['m2', 'rr', 'm2', 'm1', 'rl', 'm1', 'ut'],
    solution: ['m2', 'rr', 'm2', 'm1', 'rl'],
  },
  {
    id: 'drill-left',
    grid: empty(5, 4),
    flags: [[4, 2]],
    robots: [[1, 0, 'S']],
    hand: ['m2', 'rl', 'm3', 'rr', 'm1', 'rr', 'bk'],
    solution: ['m2', 'rl', 'm3', 'rr', 'm1'],
  },
  {
    id: 'drill-belt',
    grid: ['.. .. .. .. ..', '.. .. .. .. ..', 'g> g> g> .. ..', '.. .. .. .. ..'],
    flags: [[4, 2]],
    robots: [[0, 3, 'N']],
    hand: ['m1', 'rr', 'm1', 'm1', 'rl', 'ut', 'bk'],
    solution: ['m1', 'rr', 'm1', 'm1', 'rl'],
  },
];

export const drillCourse = (d) => lessonCourse(d);
/** Where the drill's robot starts: { x, y, d }. */
export const drillStart = (d) => {
  const { x, y, d: dir } = lessonCourse(d).starts[0];
  return { x, y, d: dir };
};

/**
 * The light line for the cards placed so far, as the programming screen draws it (slots filled from slot 1
 * without a gap), cut at the slot that ends on the flag: the race is won there, so the rest never runs.
 * types: five card types (null: an empty slot). Returns { ghosts, wins }.
 */
export function drillLine(d, types) {
  const course = lessonCourse(d);
  const n = filledRun(types.map((t) => !!t));
  const ghosts = previewProgram(course, drillStart(d), types.slice(0, n).map((t) => [t]));
  const flag = course.checkpoints.at(-1);
  const at = ghosts.findIndex((g) => !g.fell && !g.unknown && g.x === flag.x && g.y === flag.y);
  return { ghosts: at >= 0 ? ghosts.slice(0, at + 1) : ghosts, wins: at >= 0 };
}

/** Run five cards through the real rules: { run (as lessons.js gives it), won, fell }. */
export function tryDrill(d, types) {
  const run = runLesson({ ...d, rounds: [[types]] }, 7);
  const fx = run.steps.flatMap((st) => (st.kind === 'beat' ? st.beat.fx : []));
  return { run, won: fx.some((f) => f.k === 'win'), fell: fx.some((f) => f.k === 'fall') };
}

/**
 * What to nudge when the player is stuck: { card: i } (tap this card of the hand), { slot: i } (take this slot's
 * card back: it leaves the known route) or { lock: true }. slots: five hand indexes (null: empty).
 */
export function drillHint(d, slots) {
  const types = slots.map((i) => (i == null ? null : d.hand[i]));
  const used = new Set(slots.filter((i) => i != null));
  const free = types.findIndex((t) => !t);
  const spare = d.hand.findIndex((_, i) => !used.has(i));
  // a line that already ends on the flag only needs its five slots filled
  if (drillLine(d, types).wins) return free < 0 ? { lock: true } : { card: spare };
  const bad = types.findIndex((t, i) => t && t !== d.solution[i]);
  if (bad >= 0) return { slot: bad };
  if (free < 0) return { lock: true };
  const want = d.hand.findIndex((t, i) => !used.has(i) && t === d.solution[free]);
  return { card: want >= 0 ? want : spare };
}
