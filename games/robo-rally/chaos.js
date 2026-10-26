// Reading a beat for its comedy: who shoved whom, who fell where (and whose fault it was), who drove
// into a wall, who got shot. The big screen (scene.js) plays every moment; this decides how big each
// one is, so the biggest gets the camera and the others stay small. No 3D here, just the facts.
//
// Every path of a beat runs on one clock of steps: a path point is [x, y, step], the step at which
// the robot reached it (engine.js), and a robot moves from one point to the next during that step.

export const STEP = 0.3; // seconds to cross one space, for every robot, all the time
export const RAMP = 0.1; // seconds to get up to speed at the start of a beat, and to stop at the end

const tickOf = (path, i) => path[i]?.[2] ?? i;
export const lastTick = (path) => (path?.length > 1 ? tickOf(path, path.length - 1) : 0);

/** How many steps the beat's clock runs: its longest path, and any bump that ends it. */
export function beatSteps(fx) {
  let n = 0;
  for (const f of fx) {
    if (f.k === 'move') n = Math.max(n, lastTick(f.path));
    else if (f.k === 'bonk' || f.k === 'shove') n = Math.max(n, f.at ?? 1);
  }
  return n;
}

// The clock: up to full speed (1 space per STEP) in RAMP, full speed, down to a stop in RAMP.
export const clockTotal = (N) => (N > 0 ? N * STEP + RAMP : 0);

/** Steps covered after `tau` seconds of an N-step beat. */
export function clockU(N, tau) {
  if (N <= 0 || tau <= 0) return 0;
  const T = clockTotal(N);
  if (tau >= T) return N;
  const v = 1 / STEP;
  if (tau < RAMP) return (v * tau * tau) / (2 * RAMP);
  if (tau < T - RAMP) return v * (tau - RAMP / 2);
  const r = T - tau;
  return N - (v * r * r) / (2 * RAMP);
}

/** Seconds into an N-step beat at which `u` steps are covered (the inverse of clockU). */
export function clockTime(N, u) {
  if (N <= 0 || u <= 0) return 0;
  const T = clockTotal(N);
  if (u >= N) return T;
  const v = 1 / STEP;
  const ua = (v * RAMP) / 2;
  if (u < ua) return Math.sqrt((2 * RAMP * u) / v);
  if (u < N - ua) return u / v + RAMP / 2;
  return T - Math.sqrt((2 * RAMP * (N - u)) / v);
}

/** Where a path is (grid x, y, fractional) after u steps; `moving` while between two points. */
export function pathAt(path, u) {
  let x = path[0][0];
  let y = path[0][1];
  let moving = false;
  for (let i = 1; i < path.length; i++) {
    const end = tickOf(path, i);
    const start = Math.max(end - 1, tickOf(path, i - 1));
    if (u >= end) {
      x = path[i][0];
      y = path[i][1];
      continue;
    }
    if (u > start) {
      const f = (u - start) / (end - start || 1);
      x = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f;
      y = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f;
      moving = true;
    }
    break;
  }
  return { x, y, moving };
}

const dist = (a, b) => Math.abs(a[0] - b.x) + Math.abs(a[1] - b.y);

/**
 * The moments in a beat, biggest first:
 *   { kind: 'contact', id: victim, by: the robot that hit it, at, d, i: place in the chain, stuck }
 *   { kind: 'fall', id, at, edge, cause: 'push' | 'belt' | 'self' | 'other', by }
 *   { kind: 'bonk', id, at, d, moved, why }
 *   { kind: 'helped', id, by, jackpot }   a push that took it toward its next flag
 *   { kind: 'shot', id, by, board, n, beams }
 *   { kind: 'reboot', id }
 * Each has a score (a bump is about 1, a three-robot chain off the edge is well over 10).
 * robots: the robots after the beat ({ id, x, y, on, cp }); course: for the flags.
 */
export function readBeat(beat, { course, robots = [] } = {}) {
  const fx = beat?.fx ?? [];
  const what = beat?.what ?? null;
  const out = [];
  const paths = new Map(fx.filter((f) => f.k === 'move').map((f) => [f.id, f.path]));
  const byId = new Map(robots.map((r) => [r.id, r]));

  // contacts: the first step at which each robot is shoved, and by whom (the robot right behind it)
  const shoved = new Map();
  for (const f of fx) {
    if (f.k !== 'shove') continue;
    f.ids.forEach((id, i) => {
      if (shoved.has(id)) return;
      const c = { kind: 'contact', id, by: i ? f.ids[i - 1] : f.id, root: f.id, at: f.at ?? 1, d: f.d, i, chain: f.ids.length, stuck: !!f.stuck };
      c.score = c.stuck ? 2.5 : 2 + 1.5 * i;
      shoved.set(id, c);
      out.push(c);
    });
  }

  // falls, and whose fault they were
  const falls = fx.filter((f) => f.k === 'fall');
  for (const f of falls) {
    const c = shoved.get(f.id);
    const at = f.at ?? lastTick(paths.get(f.id));
    const pushed = c && !c.stuck && c.at <= at;
    const cause = pushed ? 'push' : what?.k === 'belt' ? 'belt' : what?.id === f.id ? 'self' : 'other';
    const base = { push: 8, belt: 6.5, self: 5, other: 5 }[cause] + (f.edge ? 1.5 : 0); // off the edge is the bigger show
    out.push({ kind: 'fall', id: f.id, at, x: f.x, y: f.y, edge: !!f.edge, cause, by: pushed ? c.root : null, score: base + (falls.length - 1) * 1.5 });
  }

  // a wall in the face (the faster, the funnier)
  for (const f of fx) {
    if (f.k !== 'bonk') continue;
    out.push({ kind: 'bonk', id: f.id, at: f.at ?? 1, d: f.d, moved: f.moved ?? 0, why: f.why, score: 1 + Math.min(2, f.moved ?? 0) * 0.6 });
  }

  // a push that helped: the pushed robot ended up nearer its next flag
  for (const c of shoved.values()) {
    if (c.stuck || falls.some((f) => f.id === c.id)) continue;
    const R = byId.get(c.id);
    const path = paths.get(c.id);
    if (!R || R.on === false || !path || path.length < 2 || !course?.checkpoints) continue;
    const next = course.checkpoints.find((cp) => cp.n === (R.cp ?? 0) + 1);
    if (!next) continue;
    const before = dist(path[0], next);
    const after = dist(path.at(-1), next);
    if (after < before) out.push({ kind: 'helped', id: c.id, by: c.root, jackpot: after === 0, score: after === 0 ? 4 : 3 });
  }

  // lasers that hit a robot
  const shots = new Map();
  for (const f of fx) {
    if (f.k !== 'beam' || !f.hit?.length) continue;
    for (const id of f.hit) {
      const s = shots.get(id) ?? { kind: 'shot', id, by: f.board ? null : f.src, board: !!f.board, n: 0, beams: 0, d: f.d, at: f.at ?? 0 };
      s.n += f.n ?? 1;
      s.beams++;
      shots.set(id, s);
    }
  }
  for (const s of shots.values()) {
    s.score = (s.board ? 2 : 3) + (s.n - 1) * 0.8 + (s.beams > 1 ? 2.5 : 0);
    out.push(s);
  }

  for (const f of fx) if (f.k === 'reboot') out.push({ kind: 'reboot', id: f.id, score: 1.5 });

  out.sort((a, b) => b.score - a.score);
  return { events: out, top: out[0] ?? null, drama: out.reduce((sum, e, i) => sum + (i ? e.score * 0.4 : e.score), 0), steps: beatSteps(fx) };
}
