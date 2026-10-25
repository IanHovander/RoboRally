// The factory floor: board pieces, race courses, and questions about them (walls, belts, lasers).
// Shared by the rules (rules.js / engine.js), the phones (minimap) and the big screen (3D scene).
//
// Coordinates: x grows to the right, y grows down the screen. Directions: 0 north (up), 1 east,
// 2 south (toward the viewer), 3 west. Turning right adds 1.

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['north', 'east', 'south', 'west'];
export const turn = (d, n) => (((d + n) % 4) + 4) % 4;

const LETTER = { N: 0, E: 1, S: 2, W: 3 };
const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };

// ---------- board pieces ----------
// Each piece is drawn with the Docking Bay below it (south), robots driving north.
// Cells are two characters:
//   ..  floor            XX  pit              EE  battery
//   g^  green conveyor   b^  blue conveyor    (arrow = the way it carries you: ^ > v <)
//   G+  gear, turns right (green)             G-  gear, turns left (red)
//   S1  start space (Docking Bay only; robots start facing north)
// walls:   'x,y:NESW'          sides of that space with a wall
// lasers:  [x, y, 'dir', n]    a wall-mounted laser in space x,y shooting toward dir with n beams
// pushers: [x, y, 'side', [registers]]  a push panel on that side's wall, pushing robots away from it
// reboot:  [x, y, 'dir']       the Reboot token and its arrow
export const PIECES = {
  dock: {
    name: 'Loading Dock',
    dock: true,
    grid: [
      '.. .. .. .. .. .. .. .. .. ..',
      '.. S3 .. S5 .. .. S6 .. S4 ..',
      'S7 .. S1 .. EE EE .. S2 .. S8',
    ],
    walls: ['4,1:N', '5,1:N', '0,0:N', '9,0:N'],
  },

  garden: {
    name: 'Garden Center',
    grid: [
      '.. .. .. .. .. .. .. .. .. ..',
      '.. XX .. .. .. .. G+ .. .. ..',
      '.. .. .. EE .. .. .. .. XX ..',
      '.. .. .. .. .. g> g> gv .. ..',
      '.. G- .. .. .. g^ EE gv .. ..',
      '.. .. .. XX .. g^ g< g< .. EE',
      '.. .. .. .. .. .. .. .. .. ..',
      'EE .. .. .. .. .. XX .. G- ..',
      '.. .. XX .. .. .. .. .. .. ..',
      '.. .. .. .. G+ .. .. .. .. ..',
    ],
    walls: ['6,4:NS', '2,4:NE', '8,3:S', '3,7:E', '7,8:N', '0,3:E'],
    lasers: [[9, 7, 'W', 1]],
    reboot: [4, 6, 'E'],
  },

  lanes: {
    name: 'Checkout Lanes',
    grid: [
      '.. .. .. .. .. .. .. .. .. ..',
      '.. bv b< b< b< b< b< b< b< ..',
      '.. bv .. .. .. EE .. .. b^ ..',
      '.. b> b> b> b> b> b> b> b^ ..',
      '.. .. .. .. .. .. .. .. .. ..',
      'EE .. G+ .. .. .. .. G- EE ..',
      '.. .. .. XX .. .. XX .. g^ ..',
      '.. g> g> g> g> g> g> g> g^ ..',
      '.. .. .. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. .. .. ..',
    ],
    walls: ['2,1:N', '3,1:N', '4,1:N', '5,1:N', '6,1:N', '7,1:N', '2,3:S', '3,3:S', '6,3:S', '7,3:S', '4,3:S', '5,3:S'],
    lasers: [[9, 2, 'W', 1], [0, 7, 'E', 1]],
    pushers: [[4, 4, 'N', [2, 4]], [5, 4, 'N', [1, 3, 5]]],
    reboot: [5, 8, 'E'],
  },

  stockroom: {
    name: 'Stockroom',
    grid: [
      '.. .. .. XX .. .. .. .. .. ..',
      '.. G+ .. .. .. g> g> g> gv ..',
      '.. .. .. .. .. g^ .. .. gv ..',
      'XX .. EE .. .. g^ .. G- gv ..',
      '.. .. .. .. .. g^ g< g< g< ..',
      '.. .. .. .. .. .. .. .. .. ..',
      '.. bv .. G- .. .. .. .. EE ..',
      '.. bv .. .. .. XX XX .. .. ..',
      '.. b> b> b> b> b> b> b> .. ..',
      '.. .. .. .. .. .. .. .. .. ..',
    ],
    walls: ['3,1:E', '3,2:E', '6,6:N', '7,6:N', '2,4:S', '9,5:W', '4,8:S'],
    lasers: [[9, 2, 'W', 1], [0, 9, 'N', 1]],
    pushers: [[2, 5, 'N', [1, 3, 5]], [7, 5, 'S', [2, 4]]],
    reboot: [4, 6, 'E'],
  },

  electronics: {
    name: 'Electronics',
    grid: [
      '.. .. .. .. .. .. .. .. .. ..',
      '.. EE .. .. .. .. .. .. G- ..',
      '.. .. .. .. .. .. .. .. .. ..',
      '.. .. .. XX .. .. XX .. .. ..',
      'g> g> gv .. .. .. .. b< b< b<',
      '.. .. gv .. .. .. .. b^ .. ..',
      '.. .. g> g> g> g> g> b^ .. ..',
      '.. G+ .. .. .. .. .. .. EE ..',
      '.. .. .. XX .. .. XX .. .. ..',
      '.. .. .. .. .. .. .. .. .. ..',
    ],
    walls: ['1,1:NW', '8,8:ES', '6,2:W', '4,3:S', '5,7:N', '0,5:S'],
    lasers: [[4, 0, 'S', 1], [5, 9, 'N', 1], [0, 2, 'E', 2], [9, 7, 'W', 1]],
    pushers: [[9, 1, 'E', [1, 3, 5]], [0, 9, 'W', [2, 4]]],
    reboot: [5, 5, 'N'],
  },
};

// ---------- race courses ----------
// Pieces are placed at x,y (in spaces) with rot quarter-turns clockwise. Checkpoints use the same
// coordinates. A tall course is turned on its side afterwards so it fits a wide TV, Docking Bay on the left.
export const COURSES = [
  {
    id: 'closing-time',
    name: 'Closing Time',
    level: 'Starter',
    length: 'Short',
    blurb: 'One open floor, two flags. Learn to drive before the lights go out.',
    pieces: [['garden', 0, 0], ['dock', 0, 10]],
    checkpoints: [[8, 6], [3, 1]],
  },
  {
    id: 'blue-light-special',
    name: 'Blue Light Special',
    level: 'Beginner',
    length: 'Medium',
    blurb: 'Express checkout belts loop the middle of the store. Ride them or get taken for a ride.',
    pieces: [['lanes', 0, 0], ['dock', 0, 10]],
    checkpoints: [[9, 4], [0, 2], [5, 0]],
  },
  {
    id: 'inventory-day',
    name: 'Inventory Day',
    level: 'Intermediate',
    length: 'Medium',
    blurb: 'Shelves, push panels and a conveyor loop guarding the back room.',
    pieces: [['stockroom', 0, 0], ['dock', 0, 10]],
    checkpoints: [[9, 7], [6, 2], [1, 4]],
  },
  {
    id: 'aisle-nine',
    name: 'Aisle Nine',
    level: 'Intermediate',
    length: 'Medium',
    blurb: 'The electronics department still has power. All of it. Mind the lasers.',
    pieces: [['electronics', 0, 0], ['dock', 0, 10]],
    checkpoints: [[8, 5], [1, 3], [6, 0]],
  },
  {
    id: 'everything-must-go',
    name: 'Everything Must Go',
    level: 'Advanced',
    length: 'Long',
    blurb: 'Through the checkout lanes and into the stockroom. Four flags, two boards, no refunds.',
    pieces: [['stockroom', 0, 0], ['lanes', 0, 10], ['dock', 0, 20]],
    checkpoints: [[9, 14], [6, 2], [0, 12], [2, 0]],
  },
  {
    id: 'grand-reopening',
    name: 'Grand Re-Opening',
    level: 'Advanced',
    length: 'Long',
    blurb: 'Electronics and the Garden Center side by side. Criss-cross the whole store.',
    pieces: [['electronics', 0, 0], ['garden', 10, 0], ['dock', 5, 10]],
    checkpoints: [[18, 6], [1, 3], [13, 1]],
  },
];

export const courseInfo = (id) => COURSES.find((c) => c.id === id) ?? COURSES[0];

// ---------- building a course ----------

function parsePiece(def) {
  const h = def.grid.length;
  const w = def.grid[0].trim().split(/\s+/).length;
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = def.grid[y].trim().split(/\s+/);
    if (row.length !== w) throw new Error(`${def.name}: row ${y} has ${row.length} cells, expected ${w}`);
    for (let x = 0; x < w; x++) cells.push(parseCell(row[x], def));
  }
  for (const spec of def.walls ?? []) {
    const [pos, sides] = spec.split(':');
    const [x, y] = pos.split(',').map(Number);
    for (const ch of sides) cells[y * w + x].walls |= 1 << LETTER[ch];
  }
  const lasers = (def.lasers ?? []).map(([x, y, d, n]) => ({ x, y, d: LETTER[d], n }));
  const pushers = (def.pushers ?? []).map(([x, y, side, regs]) => ({ x, y, side: LETTER[side], regs }));
  // a laser or push panel hangs on a wall
  for (const l of lasers) cells[l.y * w + l.x].walls |= 1 << turn(l.d, 2);
  for (const p of pushers) cells[p.y * w + p.x].walls |= 1 << p.side;
  const reboot = def.reboot ? { x: def.reboot[0], y: def.reboot[1], d: LETTER[def.reboot[2]] } : null;
  return { name: def.name, dock: !!def.dock, w, h, cells, lasers, pushers, reboot };
}

function parseCell(code, def) {
  const cell = { k: 'floor', walls: 0 };
  if (code === '..') return cell;
  if (code === 'XX') return { ...cell, k: 'pit' };
  if (code === 'EE') return { ...cell, k: 'battery' };
  if (code === 'G+') return { ...cell, k: 'gear', spin: 1 };
  if (code === 'G-') return { ...cell, k: 'gear', spin: -1 };
  if (code[0] === 'g' || code[0] === 'b') return { ...cell, k: 'belt', fast: code[0] === 'b', d: ARROW[code[1]] };
  if (code[0] === 'S') return { ...cell, k: 'start', n: Number(code[1]), d: 0 };
  throw new Error(`${def.name}: unknown cell "${code}"`);
}

/** Turn a parsed piece a quarter-turn clockwise, `times` times. */
function rotatePiece(p, times) {
  let cur = p;
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
    const { w, h } = cur;
    const map = (x, y) => [h - 1 - y, x]; // clockwise
    const cells = new Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [nx, ny] = map(x, y);
        cells[ny * h + nx] = rotateCell(cur.cells[y * w + x]);
      }
    }
    const pt = (o) => {
      const [nx, ny] = map(o.x, o.y);
      return { ...o, x: nx, y: ny };
    };
    cur = {
      ...cur,
      w: h,
      h: w,
      cells,
      lasers: cur.lasers.map((l) => ({ ...pt(l), d: turn(l.d, 1) })),
      pushers: cur.pushers.map((q) => ({ ...pt(q), side: turn(q.side, 1) })),
      reboot: cur.reboot ? { ...pt(cur.reboot), d: turn(cur.reboot.d, 1) } : null,
    };
  }
  return cur;
}

function rotateCell(c) {
  let walls = 0;
  for (let d = 0; d < 4; d++) if (c.walls & (1 << d)) walls |= 1 << turn(d, 1);
  const out = { ...c, walls };
  if ('d' in c) out.d = turn(c.d, 1);
  return out;
}

const cache = new Map();

/**
 * The full course, ready to play on:
 * { id, name, w, h, cells[], lasers[], pushers[], checkpoints[], starts[], boards[] }
 * cells[i] is null where there's no floor at all (falling off the edge). Each cell knows which board
 * it belongs to (`b`), so a robot that falls reboots on the right board.
 */
export function getCourse(id) {
  if (cache.has(id)) return cache.get(id);
  const info = courseInfo(id);
  const placed = info.pieces.map(([pid, x, y, rot = 0]) => ({ x, y, piece: rotatePiece(parsePiece(PIECES[pid]), rot) }));
  let w = Math.max(...placed.map((p) => p.x + p.piece.w));
  let h = Math.max(...placed.map((p) => p.y + p.piece.h));
  let cells = new Array(w * h).fill(null);
  let lasers = [];
  let pushers = [];
  const boards = [];
  placed.forEach((p, b) => {
    const { piece } = p;
    for (let y = 0; y < piece.h; y++) {
      for (let x = 0; x < piece.w; x++) cells[(p.y + y) * w + p.x + x] = { ...piece.cells[y * piece.w + x], b };
    }
    lasers.push(...piece.lasers.map((l) => ({ ...l, x: l.x + p.x, y: l.y + p.y })));
    pushers.push(...piece.pushers.map((q) => ({ ...q, x: q.x + p.x, y: q.y + p.y })));
    boards.push({
      name: piece.name,
      dock: piece.dock,
      x: p.x,
      y: p.y,
      w: piece.w,
      h: piece.h,
      reboot: piece.reboot ? { x: piece.reboot.x + p.x, y: piece.reboot.y + p.y, d: piece.reboot.d } : null,
    });
  });
  let checkpoints = info.checkpoints.map(([x, y], i) => ({ x, y, n: i + 1 }));

  // Tall courses lie down: one quarter-turn clockwise puts the Docking Bay on the left.
  if (h > w) {
    const map = (x, y) => [h - 1 - y, x];
    const rotated = new Array(w * h).fill(null);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = cells[y * w + x];
        const [nx, ny] = map(x, y);
        rotated[ny * h + nx] = c && rotateCell(c);
      }
    }
    const pt = (o) => {
      const [nx, ny] = map(o.x, o.y);
      return { ...o, x: nx, y: ny };
    };
    lasers = lasers.map((l) => ({ ...pt(l), d: turn(l.d, 1) }));
    pushers = pushers.map((q) => ({ ...pt(q), side: turn(q.side, 1) }));
    checkpoints = checkpoints.map(pt);
    for (const b of boards) {
      const [x0, y0] = map(b.x, b.y + b.h - 1);
      Object.assign(b, { x: x0, y: y0, w: b.h, h: b.w });
      if (b.reboot) b.reboot = { ...pt(b.reboot), d: turn(b.reboot.d, 1) };
    }
    cells = rotated;
    [w, h] = [h, w];
  }

  const starts = [];
  cells.forEach((c, i) => {
    if (c?.k === 'start') starts.push({ x: i % w, y: Math.floor(i / w), d: c.d, n: c.n });
  });
  starts.sort((a, b) => a.n - b.n);
  const course = { id: info.id, name: info.name, level: info.level, length: info.length, w, h, cells, lasers, pushers, checkpoints, starts, boards };
  course.tokens = new Map(); // space index -> 'checkpoint' | 'reboot': board elements under a token don't work
  for (const cp of checkpoints) course.tokens.set(cp.y * w + cp.x, 'checkpoint');
  for (const b of boards) if (b.reboot) course.tokens.set(b.reboot.y * w + b.reboot.x, 'reboot');
  cache.set(id, course);
  return course;
}

// ---------- questions about a course ----------

export const inside = (c, x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h;
export const cellAt = (c, x, y) => (inside(c, x, y) ? c.cells[y * c.w + x] : null);

/** The board element that works on this space (nothing under a Checkpoint or Reboot token). */
export function activeCell(c, x, y) {
  const cell = cellAt(c, x, y);
  if (!cell) return null;
  if (c.tokens.has(y * c.w + x) && cell.k !== 'pit') return { ...cell, k: 'floor' };
  return cell;
}

/** Is there a wall between space x,y and its neighbor in direction d? */
export function wallBetween(c, x, y, d) {
  const a = cellAt(c, x, y);
  if (a && a.walls & (1 << d)) return true;
  const b = cellAt(c, x + DX[d], y + DY[d]);
  return !!(b && b.walls & (1 << turn(d, 2)));
}

/** Which board a space belongs to (or null off the edge). */
export const boardOf = (c, x, y) => {
  const cell = cellAt(c, x, y);
  return cell ? cell.b : null;
};

/** Every wall edge once: [{x, y, side}] with side 0 (north) or 3 (west) of x,y, or the outer south/east edges. */
export function wallEdges(c) {
  const seen = new Set();
  const out = [];
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const cell = c.cells[y * c.w + x];
      if (!cell) continue;
      for (let d = 0; d < 4; d++) {
        if (!(cell.walls & (1 << d))) continue;
        // name each edge by the space to its south / east side, so both sides agree
        let ex = x;
        let ey = y;
        let side = d;
        if (d === 1) [ex, side] = [x + 1, 3];
        if (d === 2) [ey, side] = [y + 1, 0];
        const key = `${ex},${ey},${side}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x: ex, y: ey, side });
      }
    }
  }
  return out;
}

/** Which belts feed into this belt space (for drawing curves): directions the feeders come from. */
export function beltInputs(c, x, y) {
  const ins = [];
  for (let d = 0; d < 4; d++) {
    const n = cellAt(c, x + DX[d], y + DY[d]);
    if (n?.k === 'belt' && n.d === turn(d, 2) && !wallBetween(c, x, y, d)) ins.push(d);
  }
  return ins;
}

/** The space a laser beam lights up from (x,y) toward d: [{x,y}] up to (not through) a wall or the edge. */
export function beamPath(c, x, y, d, { includeStart = true, throughWalls = false } = {}) {
  const path = [];
  let cx = x;
  let cy = y;
  if (includeStart) path.push({ x: cx, y: cy });
  for (let i = 0; i < 64; i++) {
    if (!throughWalls && wallBetween(c, cx, cy, d)) break;
    cx += DX[d];
    cy += DY[d];
    if (!inside(c, cx, cy)) break;
    path.push({ x: cx, y: cy });
  }
  return path;
}
