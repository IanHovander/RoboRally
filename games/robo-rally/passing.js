// Capture the Flag: passing the flag between a team's two robots. Three ways to play it (opts.pass), to try
// side by side:
//   hand   Hand-off. Mark one slot with the flag. When that slot ends, the carrier hands the flag to its teammate
//          if the teammate stands on one of the eight squares around it (no wall between). Otherwise nothing happens.
//   throw  Throw. Mark one slot with the flag. When that slot ends, the carrier throws the flag straight ahead, the
//          way it faces, up to 4 squares. Walls stop it. The first robot in its way catches it: a teammate takes it,
//          an opponent knocks it back to its corner. If nobody catches it, it lands on the floor, where either hunter
//          picks it up by ending a slot on it. A defender who ends a slot on it sends it home, and so does a pit or
//          the board's edge.
//   sight  Line of sight. Nothing to mark. Whenever a slot ends with the carrier's teammate in a clear straight line
//          (same row or column, up to 4 squares, no wall or robot between) and nearer home, the flag goes to it.
// The rules (engine.js) and the phone's preview of a plan (player.js) both ask these questions, so they agree.
import { DX, DY, wallBetween, cellAt } from './board.js';

export const PASS_KINDS = ['hand', 'throw', 'sight'];
export const PASS_RANGE = 4;
export const PASS_NAMES = { hand: 'Hand-off', throw: 'Throw', sight: 'Line of sight' };
/** Does this way of passing ask the player to mark a slot? */
export const planned = (kind) => kind === 'hand' || kind === 'throw';

/** A team's home pads: the start pads it scores on (odd pads hunt flag 1, even pads flag 2). */
const homes = (course, hunt) => course.starts.filter((st) => ((st.n - 1) % 2) + 1 === hunt);

/** How far a square is from its team's nearest home pad, counted in squares across and down. */
export function homeSteps(course, hunt, x, y) {
  return Math.min(...homes(course, hunt).map((st) => Math.abs(st.x - x) + Math.abs(st.y - y)));
}

/** Can a flag go straight from a square to a neighboring one (orthogonal or diagonal) without crossing a wall? */
function reach(course, x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const dirX = dx > 0 ? 1 : 3;
  const dirY = dy > 0 ? 2 : 0;
  if (!dy) return !wallBetween(course, x, y, dirX);
  if (!dx) return !wallBetween(course, x, y, dirY);
  // diagonal: either way round the corner will do
  return (!wallBetween(course, x, y, dirX) && !wallBetween(course, x + DX[dirX], y, dirY))
    || (!wallBetween(course, x, y, dirY) && !wallBetween(course, x, y + DY[dirY], dirX));
}

/** Hand-off: the teammate on one of the eight squares around the carrier, or null. mates: [{ x, y }] */
export function handTo(course, from, mates) {
  return mates.find((m) => m.x != null && Math.max(Math.abs(m.x - from.x), Math.abs(m.y - from.y)) === 1 && reach(course, from.x, from.y, m.x, m.y)) ?? null;
}

/**
 * Throw: where the flag goes, thrown from `from` the way it faces (from.d). robots: everyone on the board ({ id, x, y,
 * hunt }, the thrower among them). Returns { path: [[x, y]...], end, to, x, y }: end is 'catch' (a teammate, `to`),
 * 'block' (an opponent, `to`), 'land' (on the floor at x, y), 'pit', 'out' (over the edge), or 'wall' (a wall right in
 * front: it never leaves the carrier's hands).
 */
export function throwPath(course, from, robots) {
  const d = from.d;
  let x = from.x;
  let y = from.y;
  const path = [[x, y]];
  for (let i = 0; i < PASS_RANGE; i++) {
    if (wallBetween(course, x, y, d)) break;
    x += DX[d];
    y += DY[d];
    path.push([x, y]);
    if (!cellAt(course, x, y)) return { path, end: 'out', to: null, x, y };
    const X = robots.find((r) => r.x === x && r.y === y && r !== from && r.id !== from.id);
    if (X) return { path, end: X.hunt === from.hunt ? 'catch' : 'block', to: X, x, y };
  }
  if (path.length === 1) return { path, end: 'wall', to: null, x, y };
  return { path, end: cellAt(course, x, y).k === 'pit' ? 'pit' : 'land', to: null, x, y };
}

/**
 * Line of sight: the teammate the flag goes to, or null: in the carrier's row or column, at most PASS_RANGE squares
 * away, with no wall and no robot (others: [{ x, y }]) between, and nearer its home pads than the carrier.
 */
export function sightTo(course, from, mates, others = []) {
  for (const m of mates) {
    if (m.x == null || (m.x !== from.x && m.y !== from.y)) continue;
    const n = Math.abs(m.x - from.x) + Math.abs(m.y - from.y);
    if (n < 1 || n > PASS_RANGE) continue;
    if (homeSteps(course, from.hunt, m.x, m.y) >= homeSteps(course, from.hunt, from.x, from.y)) continue;
    const d = m.x > from.x ? 1 : m.x < from.x ? 3 : m.y > from.y ? 2 : 0;
    let x = from.x;
    let y = from.y;
    let clear = true;
    for (let i = 0; i < n && clear; i++) {
      if (wallBetween(course, x, y, d)) clear = false;
      x += DX[d];
      y += DY[d];
      if (i < n - 1 && others.some((o) => o.x === x && o.y === y)) clear = false;
    }
    if (clear) return m;
  }
  return null;
}
