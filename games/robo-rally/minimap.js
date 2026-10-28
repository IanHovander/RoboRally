// A flat, top-down drawing of a course in Lumen's style (smoked glass, lines of light): the phones'
// map, course previews, the rule animations, and the big screen's fallback without WebGL.
import { DX, DY, turn, beltInputs, beamPath, wallEdges, wallBetween } from './board.js';
import { drawGlyph, drawRobot, formOf } from './glyphs.js';

export const C = {
  bg: '#0b0e13',
  glass: '#1a2029',
  glass2: '#20272f',
  dock: '#252d38',
  cross: 'rgba(244,239,228,.22)',
  light: '#f4efe4',
  pit: '#020304',
  belt: '#5fe3b8',
  express: '#7aa8ff',
  right: '#7fe3c3',
  left: '#ff8fa3',
  laser: '#ff4a3a',
  energy: '#ffc56e',
  reboot: '#9cc8ff',
};
const FONT = 'Lumen, Roboto, sans-serif';
// a double laser's two beams sit this far apart (in squares), and never closer than DOUBLE_MIN_PX, so even on a
// small phone map they read as two lines, not one
const LASER_GAP = 0.3;
const DOUBLE_MIN_PX = 5;
const laserGap = (T) => Math.max(T * LASER_GAP, DOUBLE_MIN_PX);

/**
 * Draw a course. o: { tile, ox, oy, robots: [{x,y,d,color,on,me,avatar}], ghosts: [{x,y,d,n,fell,path}],
 * ghostColor, starts: {n: color}, cpNext, cpDone(n), glow (soft light effects; off for tiny previews),
 * perimeter (Map perimeter is on: a wall all round the course), inert (no upgrades: batteries do nothing, so they aren't drawn),
 * reboot (rebootFor(): the ring I'd come back on, lit in ghostColor; a planned fall gets a dotted link to it) }
 */
export function drawCourse(g, course, o = {}) {
  const T = o.tile ?? 32;
  const ox = o.ox ?? 0;
  const oy = o.oy ?? 0;
  const px = (x) => ox + x * T;
  const py = (y) => oy + y * T;
  const glow = o.glow ?? T >= 14;
  const lw = (k, min = 1) => Math.max(min, T * k);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // the glass
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const dock = course.boards[cell.b]?.dock;
      g.fillStyle = cell.k === 'pit' ? C.pit : dock ? C.dock : (x + y) % 2 ? C.glass : C.glass2;
      g.fillRect(px(x), py(y), T + 0.5, T + 0.5);
    }
  }
  // small registration crosses where tiles meet
  if (T >= 12) {
    g.strokeStyle = C.cross;
    g.lineWidth = lw(0.025);
    g.beginPath();
    for (let y = 0; y <= course.h; y++) {
      for (let x = 0; x <= course.w; x++) {
        const k = T * 0.07;
        g.moveTo(px(x) - k, py(y));
        g.lineTo(px(x) + k, py(y));
        g.moveTo(px(x), py(y) - k);
        g.lineTo(px(x), py(y) + k);
      }
    }
    g.stroke();
  }
  pitDark(g, course, px, py, T);

  // whose ground is whose when you fall: each board piece faintly lit from its reboot ring, a thin border in the
  // ring's blue round it (a seam where pieces meet); the dock, start-pad ground, has a dashed white one
  if (o.areas ?? glow) drawAreas(g, course, { T, px, py, lit: o.areaLit });

  // laser paths, faintly, so the danger is visible
  g.save();
  g.setLineDash([lw(0.05), lw(0.1)]);
  for (const L of course.lasers) {
    const path = beamPath(course, L.x, L.y, L.d);
    const a = path[0];
    const b = path[path.length - 1];
    g.strokeStyle = 'rgba(255,80,62,.8)';
    g.lineWidth = lw(0.038, 1.2);
    // one line per beam: a double laser is two lines, clearly apart (as its two lenses)
    for (let i = 0; i < L.n; i++) {
      const off = (i - (L.n - 1) / 2) * laserGap(T);
      const ox = DY[L.d] * off;
      const oy = DX[L.d] * off;
      g.beginPath();
      g.moveTo(px(a.x + 0.5) - DX[L.d] * T * 0.38 + ox, py(a.y + 0.5) - DY[L.d] * T * 0.38 + oy);
      g.lineTo(px(b.x + 0.5) + DX[L.d] * T * 0.47 + ox, py(b.y + 0.5) + DY[L.d] * T * 0.47 + oy);
      g.stroke();
    }
  }
  g.restore();

  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const cx = px(x + 0.5);
      const cy = py(y + 0.5);
      if (cell.k === 'pit') {
        drawPit(g, course, x, y, px(x), py(y), T);
      } else if (cell.k === 'belt') {
        drawBelt(g, course, x, y, cell, px(x), py(y), T, glow);
      } else if (cell.k === 'gear') {
        const col = cell.spin > 0 ? C.right : C.left;
        g.save();
        if (glow) {
          g.shadowColor = col;
          g.shadowBlur = T * 0.15;
        }
        g.strokeStyle = col;
        g.lineWidth = lw(0.05);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * T * 0.34, cy + Math.sin(a) * T * 0.34);
          g.lineTo(cx + Math.cos(a) * T * 0.42, cy + Math.sin(a) * T * 0.42);
          g.stroke();
        }
        g.beginPath();
        const r = T * 0.22;
        const s = cell.spin;
        const a0 = -Math.PI * 0.85;
        const a1 = Math.PI * 0.45;
        g.arc(cx, cy, r, s > 0 ? a0 : Math.PI - a1, s > 0 ? a1 : Math.PI - a0);
        g.stroke();
        const ea = s > 0 ? a1 : Math.PI - a1;
        const ex = cx + Math.cos(ea) * r;
        const ey = cy + Math.sin(ea) * r;
        const tx = -Math.sin(ea) * s;
        const ty = Math.cos(ea) * s;
        g.beginPath();
        g.moveTo(ex - tx * T * 0.1 + Math.cos(ea) * T * 0.08, ey - ty * T * 0.1 + Math.sin(ea) * T * 0.08);
        g.lineTo(ex + tx * T * 0.04, ey + ty * T * 0.04);
        g.lineTo(ex - tx * T * 0.1 - Math.cos(ea) * T * 0.08, ey - ty * T * 0.1 - Math.sin(ea) * T * 0.08);
        g.stroke();
        g.restore();
      } else if (cell.k === 'battery' && !o.inert) {
        g.save();
        if (glow && !o.inert) {
          g.shadowColor = C.energy;
          g.shadowBlur = T * 0.15;
        }
        g.strokeStyle = C.energy;
        g.lineWidth = lw(0.04);
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(cx, cy, T * 0.3, (i / 3) * Math.PI * 2 + 0.3, ((i + 1) / 3) * Math.PI * 2 - 0.3);
          g.stroke();
        }
        drawGlyph(g, 'bolt', cx, cy, T * 0.38, C.energy);
        g.restore();
      } else if (cell.k === 'start' && !o.noStarts) {
        const taken = o.starts?.[cell.n];
        g.strokeStyle = taken ?? 'rgba(244,239,228,.55)';
        g.lineWidth = lw(taken ? 0.05 : 0.03);
        g.beginPath();
        g.roundRect(px(x) + T * 0.15, py(y) + T * 0.15, T * 0.7, T * 0.7, T * 0.12);
        g.stroke();
        if (T >= 12) {
          g.fillStyle = taken ?? 'rgba(244,239,228,.75)';
          g.font = `300 ${Math.round(T * 0.42)}px ${FONT}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(cell.n), cx, cy + T * 0.03);
        }
      }
    }
  }

  // reboot marks. With o.reboot (the ring I'd come back on), that one is lit in my color and the rest step back.
  const mine = o.reboot;
  for (const b of course.boards) {
    if (!b.reboot || (mine && b.reboot.x === mine.x && b.reboot.y === mine.y)) continue;
    rebootMark(g, px(b.reboot.x + 0.5), py(b.reboot.y + 0.5), b.reboot.d, T, C.reboot, mine ? 0.3 : 0.8);
  }
  if (mine) rebootMark(g, px(mine.x + 0.5), py(mine.y + 0.5), mine.d, T, o.ghostColor ?? C.reboot, 1, glow);

  // walls: bright lines of light
  g.save();
  if (glow) {
    g.shadowColor = C.light;
    g.shadowBlur = T * 0.12;
  }
  g.strokeStyle = C.light;
  g.lineWidth = lw(0.075, 2);
  g.beginPath();
  for (const w of wallEdges(course)) {
    const [x0, y0, x1, y1] = w.side === 0 ? [w.x, w.y, w.x + 1, w.y] : [w.x, w.y, w.x, w.y + 1];
    g.moveTo(px(x0), py(y0));
    g.lineTo(px(x1), py(y1));
  }
  if (o.perimeter) {
    // Map perimeter: every side of the floor that has no floor beyond it is a wall
    const floor = (x, y) => x >= 0 && y >= 0 && x < course.w && y < course.h && !!course.cells[y * course.w + x];
    for (let y = 0; y < course.h; y++) {
      for (let x = 0; x < course.w; x++) {
        if (!floor(x, y)) continue;
        if (!floor(x, y - 1)) { g.moveTo(px(x), py(y)); g.lineTo(px(x + 1), py(y)); }
        if (!floor(x + 1, y)) { g.moveTo(px(x + 1), py(y)); g.lineTo(px(x + 1), py(y + 1)); }
        if (!floor(x, y + 1)) { g.moveTo(px(x), py(y + 1)); g.lineTo(px(x + 1), py(y + 1)); }
        if (!floor(x - 1, y)) { g.moveTo(px(x), py(y)); g.lineTo(px(x), py(y + 1)); }
      }
    }
  }
  g.stroke();
  g.restore();
  for (const L of course.lasers) {
    const side = turn(L.d, 2);
    const cx = px(L.x + 0.5) + DX[side] * T * 0.38;
    const cy = py(L.y + 0.5) + DY[side] * T * 0.38;
    // the housing: wide enough for both lenses on a double laser (along the wall, across the beams)
    const half = T * 0.14;
    const along = L.n > 1 ? Math.max(half, laserGap(T) / 2 + T * 0.11) : half;
    const hw = L.d % 2 ? half : along; // a beam going N/S: lenses side by side in x
    const hh = L.d % 2 ? along : half;
    g.fillStyle = '#0d1014';
    g.beginPath();
    g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, T * 0.05);
    g.fill();
    g.save();
    if (glow) {
      g.shadowColor = C.laser;
      g.shadowBlur = T * 0.2;
    }
    g.fillStyle = C.laser;
    for (let i = 0; i < L.n; i++) {
      const off = (i - (L.n - 1) / 2) * laserGap(T);
      g.beginPath();
      g.arc(cx + DY[L.d] * off, cy + DX[L.d] * off, Math.max(1.6, T * 0.07), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  for (const p of course.pushers) {
    // the shove: a bold arrow of light out from the panel, across its square, the way it pushes
    const to = turn(p.side, 2);
    const mx = px(p.x + 0.5);
    const my = py(p.y + 0.5);
    const x0 = mx + DX[p.side] * T * 0.26;
    const y0 = my + DY[p.side] * T * 0.26;
    const hx = mx + DX[to] * T * 0.42; // the arrow's tip
    const hy = my + DY[to] * T * 0.42;
    const bx = mx + DX[to] * T * 0.12; // the head's back
    const by = my + DY[to] * T * 0.12;
    const nx = DY[to]; // across
    const ny = DX[to];
    g.save();
    const grad = g.createLinearGradient(x0, y0, hx, hy);
    grad.addColorStop(0, 'rgba(244,239,228,.15)');
    grad.addColorStop(1, 'rgba(244,239,228,.8)');
    g.fillStyle = grad;
    if (glow) {
      g.shadowColor = 'rgba(244,239,228,.6)';
      g.shadowBlur = T * 0.12;
    }
    const sw = T * 0.05;
    g.beginPath();
    g.moveTo(x0 + nx * sw, y0 + ny * sw);
    g.lineTo(bx + nx * sw, by + ny * sw);
    g.lineTo(bx + nx * T * 0.2, by + ny * T * 0.2);
    g.lineTo(hx, hy);
    g.lineTo(bx - nx * T * 0.2, by - ny * T * 0.2);
    g.lineTo(bx - nx * sw, by - ny * sw);
    g.lineTo(x0 - nx * sw, y0 - ny * sw);
    g.closePath();
    g.fill();
    g.restore();
    const cx = px(p.x + 0.5) + DX[p.side] * T * 0.36;
    const cy = py(p.y + 0.5) + DY[p.side] * T * 0.36;
    const horiz = p.side === 0 || p.side === 2;
    g.fillStyle = '#c9ced6';
    g.beginPath();
    g.roundRect(cx - (horiz ? T * 0.38 : T * 0.09), cy - (horiz ? T * 0.09 : T * 0.38), horiz ? T * 0.76 : T * 0.18, horiz ? T * 0.18 : T * 0.76, T * 0.05);
    g.fill();
    if (T >= 16) {
      for (let i = 1; i <= 5; i++) {
        const on = p.regs.includes(i);
        const k = (i - 3) * T * 0.13;
        g.fillStyle = on ? '#14171c' : 'rgba(20,23,28,.25)';
        g.beginPath();
        g.arc(cx + (horiz ? k : 0), cy + (horiz ? 0 : k), T * (on ? 0.045 : 0.03), 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // checkpoints
  for (const cp of course.checkpoints) {
    const cx = px(cp.x + 0.5);
    const cy = py(cp.y + 0.5);
    // every flag looks the same until you've reached it; then it's filled with your color
    const done = o.cpDone?.(cp.n);
    const mine = o.ghostColor ?? C.light;
    g.save();
    if (glow) {
      g.shadowColor = done ? mine : C.light;
      g.shadowBlur = T * (done ? 0.4 : 0.2);
    }
    g.fillStyle = done ? mine : 'rgba(244,239,228,.12)';
    g.strokeStyle = done ? mine : C.light;
    g.lineWidth = lw(0.04);
    g.beginPath();
    g.arc(cx, cy, T * 0.38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = done ? '#0b0e13' : C.light;
    g.font = `${done ? 500 : 300} ${Math.round(T * 0.48)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(cp.n), cx, cy + T * 0.03);
  }

  // a planned fall: a faint dotted link from its cross to the ring I'd come back on
  if (mine?.fall) {
    const fx = px(Math.max(-0.4, Math.min(course.w - 0.6, mine.fall.x)) + 0.5);
    const fy = py(Math.max(-0.4, Math.min(course.h - 0.6, mine.fall.y)) + 0.5);
    const rx = px(mine.x + 0.5);
    const ry = py(mine.y + 0.5);
    const len = Math.hypot(rx - fx, ry - fy);
    const gap = T * 0.5; // start clear of the cross, stop at the ring
    if (len > gap * 2) {
      const ux = (rx - fx) / len;
      const uy = (ry - fy) / len;
      g.save();
      g.strokeStyle = o.ghostColor ?? C.reboot;
      g.globalAlpha = 0.6;
      g.lineWidth = lw(0.05, 2);
      g.lineCap = 'round';
      g.setLineDash([0.1, lw(0.16, 6)]);
      g.beginPath();
      g.moveTo(fx + ux * gap * 0.6, fy + uy * gap * 0.6);
      g.lineTo(rx - ux * gap, ry - uy * gap);
      g.stroke();
      g.restore();
    }
  }

  // where my program would take me: a line of light through the spaces, a dot per register
  if (o.ghosts?.length) drawGhostLine(g, course, o.ghosts, { tile: T, ox, oy, color: o.ghostColor, glow });

  // robots
  for (const r of o.robots ?? []) {
    if (r.on === false) continue;
    const cx = px(r.x + 0.5);
    const cy = py(r.y + 0.5);
    if (r.me && glow) {
      g.save();
      g.globalAlpha = 0.35;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, T * 0.75);
      grad.addColorStop(0, r.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(cx - T, cy - T, T * 2, T * 2);
      g.restore();
    }
    drawRobot(g, r.form ?? formOf(r), cx, cy, T * 0.36, (r.d ?? 0) * (Math.PI / 2), r.color, { glow, me: r.me, alpha: r.away ? 0.45 : 1 });
  }
  g.restore();
}

/**
 * The light line: where a program goes, a dot per register (its number), a pointer at the end,
 * a cross where it falls, "?" where it can't be known. o: { tile, ox, oy, color, glow, alpha, dashed, numbers }
 */
export function drawGhostLine(g, course, ghosts, o = {}) {
  if (!ghosts?.length) return;
  const T = o.tile ?? 32;
  const ox = o.ox ?? 0;
  const oy = o.oy ?? 0;
  const px = (x) => ox + x * T;
  const py = (y) => oy + y * T;
  const lw = (k, min = 1) => Math.max(min, T * k);
  const gc = o.color ?? C.light;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = o.alpha ?? 1;
  g.save();
  if (o.glow ?? T >= 14) {
    g.shadowColor = gc;
    g.shadowBlur = T * 0.25;
  }
  g.strokeStyle = gc;
  g.lineWidth = lw(o.dashed ? 0.05 : 0.07, 2);
  if (o.dashed) g.setLineDash([lw(0.1, 3), lw(0.12, 4)]);
  g.globalAlpha = (o.alpha ?? 1) * 0.9;
  g.beginPath();
  let first = true;
  for (const gh of ghosts) {
    for (const [x, y] of gh.path ?? [[gh.x, gh.y]]) {
      if (first) g.moveTo(px(x + 0.5), py(y + 0.5));
      else g.lineTo(px(x + 0.5), py(y + 0.5));
      first = false;
    }
  }
  g.stroke();
  g.restore();
  // one mark per square. A slot that only moved there: its number inside the dot. Where the robot turned (or
  // the line ends): an arrow out of the dot for each way it faced there, its slot number beside the arrow.
  const marks = new Map();
  const last = ghosts.at(-1);
  for (const gh of ghosts) {
    const key = `${gh.x},${gh.y}`;
    const m = marks.get(key) ?? { x: gh.x, y: gh.y, all: [], end: false, fell: false, unknown: false, turn: false };
    if (gh.fell) m.fell = true;
    else if (gh.unknown) m.unknown = true;
    else m.all.push(gh);
    if (gh.turned) m.turn = true;
    if (gh === last) {
      m.end = true;
      m.d = gh.d;
    }
    marks.set(key, m);
  }
  const label = (text, x, y, size, halo = false) => {
    // the game's own type, as on the flags' numbers; outside the dot a soft dark glow (not a hard outline)
    // keeps it readable where it crosses the line
    g.font = `500 ${Math.round(size * (text.length > 2 ? 0.75 : 1))}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    if (halo) {
      g.shadowColor = 'rgba(11,14,19,.95)';
      g.shadowBlur = Math.max(3, size * 0.45);
      g.fillStyle = gc;
      g.fillText(text, x, y);
    }
    g.shadowBlur = 0;
    g.fillStyle = gc;
    g.fillText(text, x, y);
    g.restore();
  };
  for (const gh of marks.values()) {
    const cx = px(Math.max(-0.4, Math.min(course.w - 0.6, gh.x)) + 0.5);
    const cy = py(Math.max(-0.4, Math.min(course.h - 0.6, gh.y)) + 0.5);
    if (gh.fell) {
      g.strokeStyle = C.laser;
      g.lineWidth = lw(0.08, 2);
      const k = T * 0.17;
      g.beginPath();
      g.moveTo(cx - k, cy - k);
      g.lineTo(cx + k, cy + k);
      g.moveTo(cx + k, cy - k);
      g.lineTo(cx - k, cy + k);
      g.stroke();
      continue;
    }
    const end = gh.end && !gh.unknown;
    const solid = end && !o.dashed;
    const r = T * (end ? 0.25 : 0.2);
    // the last dot (as on the big screen): a ring drawn out to a point the way the robot will face, filled
    // softly so a flag's number under it still reads
    const point = end && gh.d != null;
    const tipR = r * 1.6;
    const outline = () => {
      g.beginPath();
      if (point) {
        const a = ANG[gh.d];
        const t = Math.acos(1 / 1.6); // where the sides leave the ring (they meet it tangentially)
        g.arc(cx, cy, r, a + t, a - t + Math.PI * 2);
        g.lineTo(cx + Math.cos(a) * tipR, cy + Math.sin(a) * tipR);
        g.closePath();
      } else g.arc(cx, cy, r, 0, Math.PI * 2);
    };
    g.fillStyle = '#0b0e13'; // (the line doesn't show through; a "?" stays readable: light on dark)
    outline();
    g.fill();
    if (solid) {
      g.save();
      g.globalAlpha *= 0.35;
      g.fillStyle = gc;
      g.fill();
      g.restore();
    }
    g.strokeStyle = gc;
    g.lineWidth = lw(0.05, 1.5);
    g.stroke();
    const words = o.numbers !== false && T >= 14;
    if (gh.unknown) {
      if (T >= 16) label('?', cx, cy + T * 0.01, T * 0.24);
    } else if (gh.turn || gh.end) {
      // the way it faces, slot by slot: an arrow per heading, the slot numbers beside it
      const byD = new Map();
      for (const x of gh.all) byD.set(x.d, [...(byD.get(x.d) ?? []), x.n]);
      for (const [d, ns] of byD) {
        const isEnd = point && d === gh.d; // the dot's own point is this arrow
        const s = T * 0.1;
        const dist = r + s * 1.05;
        if (!isEnd) pointer(g, cx, cy, d, dist, s, gc, true);
        if (words) {
          const a = ANG[d];
          const size = Math.max(10, T * 0.27);
          const k = isEnd ? tipR - T * 0.04 : dist + s * 0.1;
          const side = s + size * 0.55;
          label(ns.join(','), cx + Math.cos(a) * k + Math.cos(a + Math.PI / 2) * side, cy + Math.sin(a) * k + Math.sin(a + Math.PI / 2) * side + size * 0.04, size, true);
        }
      }
    } else if (words) label(gh.all.map((x) => x.n).join(''), cx, cy + T * 0.01, T * 0.24);
  }
  g.restore();
}

const ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const RING_RGB = '156,200,255'; // C.reboot
const PAD_RGB = '244,239,228'; // C.light: the start pads' white

/**
 * Which ground each reboot ring serves (engine.js rebootSpot): a board piece with a ring is washed faintly in its
 * blue from the ring outward and edged in it (two pieces meeting make a seam); the dock (and a piece without a
 * ring) sends you to your start pad, so it's edged in the pads' white, dashed. lit: a board index, shown strongly.
 */
function drawAreas(g, course, { T, px, py, lit = null }) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < course.w && y < course.h ? course.cells[y * course.w + x] : null);
  course.boards.forEach((b, i) => {
    if (!(b?.w > 0 && b.h > 0)) return; // (a lesson's or a picture's little course may not say)
    const on = lit === i;
    const ring = !b.dock && b.reboot;
    const rgb = ring ? RING_RGB : PAD_RGB;
    g.save();
    // the wash: only on this piece's floor (not its pits)
    g.beginPath();
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const c = at(x, y);
        if (c && c.b === i && c.k !== 'pit') g.rect(px(x), py(y), T + 0.5, T + 0.5);
      }
    }
    g.clip();
    if (ring) {
      const cx = px(b.reboot.x + 0.5);
      const cy = py(b.reboot.y + 0.5);
      const grad = g.createRadialGradient(cx, cy, T * 0.45, cx, cy, T * Math.hypot(b.w, b.h) * 0.6);
      grad.addColorStop(0, `rgba(${rgb},${on ? 0.26 : 0.075})`);
      grad.addColorStop(1, `rgba(${rgb},${on ? 0.12 : 0.012})`);
      g.fillStyle = grad;
      g.fillRect(px(b.x), py(b.y), b.w * T, b.h * T);
    } else if (on) {
      g.fillStyle = `rgba(${rgb},.1)`;
      g.fillRect(px(b.x), py(b.y), b.w * T, b.h * T);
    }
    g.restore();
    // the edge, just inside the piece
    const k = T * 0.06;
    g.save();
    g.strokeStyle = `rgba(${rgb},${on ? 0.95 : ring ? 0.3 : 0.2})`;
    g.lineWidth = Math.max(1, T * (on ? 0.055 : 0.025));
    if (!ring) g.setLineDash([T * 0.16, T * 0.12]);
    if (on) {
      g.shadowColor = `rgb(${rgb})`;
      g.shadowBlur = T * 0.3;
    }
    g.beginPath();
    g.roundRect(px(b.x) + k, py(b.y) + k, b.w * T - 2 * k, b.h * T - 2 * k, T * 0.14);
    g.stroke();
    g.restore();
  });
}

/** The board piece whose reboot ring is on (x, y), or -1. */
export function ringBoard(course, x, y) {
  return course.boards.findIndex((b) => !b.dock && b.reboot && b.reboot.x === x && b.reboot.y === y);
}

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A pit, seen from above, as on the big screen: a hole into the dark. Light pours over its far rim (the top, the
 * wall the big screen's camera looks at) as a soft sheet that breaks into fine threads, thinning into the black;
 * the side walls catch a little of it; a fine lip marks where the glass breaks. Pits side by side are one hole,
 * and their threads run on across it. Tiny maps get the hole and the sheet only.
 */
function pitRims(course, x, y) {
  return [0, 1, 2, 3].map((d) => {
    const nx = x + DX[d];
    const ny = y + DY[d];
    return !(nx >= 0 && ny >= 0 && nx < course.w && ny < course.h && course.cells[ny * course.w + nx]?.k === 'pit');
  });
}

/** The pits' dark again, over the registration crosses: a pixel over into a pit beside it, so no seam shows. */
function pitDark(g, course, px, py, T) {
  g.fillStyle = C.pit;
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      if (course.cells[y * course.w + x]?.k !== 'pit') continue;
      const o = pitRims(course, x, y).map((r) => (r ? 0 : 1));
      g.fillRect(px(x) - o[3], py(y) - o[0], T + o[3] + o[1], T + o[0] + o[2]);
    }
  }
}

function drawPit(g, course, x, y, X, Y, T) {
  const rim = pitRims(course, x, y); // pits side by side are one hole
  if (T < 6) return;
  const L = (a) => `rgba(244,239,228,${a})`;
  g.save();
  const h = T * 0.52; // how far down the hole the light is seen
  if (rim[0]) {
    // the sheet, brightest where it bends over the lip
    const sheet = g.createLinearGradient(0, Y, 0, Y + h);
    sheet.addColorStop(0, L(0.42));
    sheet.addColorStop(0.16, L(0.14));
    sheet.addColorStop(0.6, L(0.03));
    sheet.addColorStop(1, L(0));
    g.fillStyle = sheet;
    g.fillRect(X, Y, T, h);
    // the threads: evenly set (a little jittered), each its own length and brightness
    if (T >= 14) {
      const n = T >= 30 ? 6 : T >= 20 ? 5 : 4;
      g.lineWidth = Math.max(1, T * 0.026);
      for (let i = 0; i < n; i++) {
        const c = x * n + i; // columns counted across the course: a wide hole's threads run on unbroken
        const fx = X + ((i + 0.5 + (hash(c * 0.73 + 4.2) - 0.5) * 0.45) / n) * T;
        const len = h * (0.4 + 0.6 * hash(c * 1.37 + 3.1));
        const gr = g.createLinearGradient(0, Y, 0, Y + len);
        gr.addColorStop(0, L(0.85 * (0.45 + 0.55 * hash(c * 2.11 + 1.7))));
        gr.addColorStop(0.5, L(0.3 * (0.45 + 0.55 * hash(c * 2.11 + 1.7))));
        gr.addColorStop(1, L(0));
        g.strokeStyle = gr;
        g.beginPath();
        g.moveTo(fx, Y);
        g.lineTo(fx, Y + len);
        g.stroke();
      }
    }
  }
  // the side walls, seen edge-on: only a soft glow along them, fading down as the far wall's does
  for (const d of [1, 3]) {
    if (!rim[d]) continue;
    const ex = d === 1 ? X + T : X;
    const w = T * 0.09;
    const gr = g.createLinearGradient(ex, 0, ex - DX[d] * w, 0);
    gr.addColorStop(0, L(rim[0] ? 0.2 : 0.12));
    gr.addColorStop(1, L(0));
    g.fillStyle = gr;
    g.fillRect(d === 1 ? ex - w : ex, Y, w, T);
  }
  // the lip, just inside the rim, lit as the big screen's is (one solid color, so where two sides meet it doesn't
  // double up)
  if (T >= 10) {
    const lw = Math.max(1, T * 0.025);
    g.fillStyle = '#56637a';
    if (rim[0]) g.fillRect(X, Y, T, lw);
    if (rim[2]) g.fillRect(X, Y + T - lw, T, lw);
    if (rim[3]) g.fillRect(X, Y, lw, T);
    if (rim[1]) g.fillRect(X + T - lw, Y, lw, T);
  }
  g.restore();
}

/** A reboot ring: a circle, the reboot glyph, a pointer the way you'd face. Lit: thicker, glowing, filled faintly. */
function rebootMark(g, cx, cy, d, T, color, alpha, lit = false) {
  g.save();
  if (lit) {
    g.shadowColor = color;
    g.shadowBlur = T * 0.35;
    g.fillStyle = color;
    g.globalAlpha = 0.18;
    g.beginPath();
    g.arc(cx, cy, T * 0.44, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = Math.max(lit ? 2 : 1, T * (lit ? 0.06 : 0.03));
  g.beginPath();
  g.arc(cx, cy, T * (lit ? 0.42 : 0.36), 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  drawGlyph(g, 'reboot', cx, cy, T * 0.5, color, lit ? 3.4 : 2.8);
  pointer(g, cx, cy, d, T * (lit ? 0.54 : 0.48), T * (lit ? 0.11 : 0.09), color);
  g.restore();
}

/**
 * The reboot ring I'd come back on (engine.js rebootSpot): the ring of the board my robot is on, or, when my
 * planned line ends in a fall, of the board where it falls (off the edge: the last board it was over). The
 * docking bay, or a board without a ring: my archive spot (my start pad).
 * Returns { x, y, d, archive, fall: {x, y} | null }, or null.
 */
export function rebootFor(course, from, ghosts = [], archive = null) {
  if (!from) return null;
  const at = (x, y) => (x >= 0 && y >= 0 && x < course.w && y < course.h ? course.cells[y * course.w + x] : null);
  const last = ghosts.at(-1);
  const fall = last?.fell ? last : null;
  let b = at(from.x, from.y)?.b;
  if (fall) {
    const pts = [[from.x, from.y], ...ghosts.flatMap((gh) => gh.path ?? [[gh.x, gh.y]]), [fall.x, fall.y]];
    for (let i = pts.length - 1; i >= 0; i--) {
      const c = at(pts[i][0], pts[i][1]);
      if (c) {
        b = c.b;
        break;
      }
    }
  }
  const board = course.boards[b];
  const ring = board && !board.dock ? board.reboot : null;
  const spot = ring ?? archive;
  if (!spot) return null;
  return { x: spot.x, y: spot.y, d: spot.d ?? 0, archive: !ring, fall: fall ? { x: fall.x, y: fall.y } : null };
}

/** A little triangle just outside a circle, pointing the way d (outlined in dark so it reads on top of the line). */
function pointer(g, cx, cy, d, dist, s, color, outline = false) {
  const a = ANG[d];
  const x = cx + Math.cos(a) * dist;
  const y = cy + Math.sin(a) * dist;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  g.lineTo(x + Math.cos(a + 2.3) * s, y + Math.sin(a + 2.3) * s);
  g.lineTo(x + Math.cos(a - 2.3) * s, y + Math.sin(a - 2.3) * s);
  g.closePath();
  if (outline) {
    g.save();
    g.shadowBlur = 0;
    g.strokeStyle = '#0b0e13';
    g.lineWidth = Math.max(1.5, s * 0.35);
    g.stroke();
    g.restore();
  }
  g.fill();
}

function drawBelt(g, course, x, y, cell, X, Y, T, glow) {
  const color = cell.fast ? C.express : C.belt;
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fillRect(X + T * 0.08, Y + T * 0.08, T * 0.84, T * 0.84);
  const ins = beltInputs(course, x, y);
  const back = turn(cell.d, 2);
  const side = ins.find((d) => d !== back);
  const cx = X + T / 2;
  const cy = Y + T / 2;
  g.save();
  if (glow) {
    g.shadowColor = color;
    g.shadowBlur = T * 0.15;
  }
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.5, T * 0.06);
  if (side != null && !ins.includes(back)) {
    g.beginPath();
    g.moveTo(cx + DX[side] * T * 0.42, cy + DY[side] * T * 0.42);
    g.quadraticCurveTo(cx, cy, cx + DX[cell.d] * T * 0.2, cy + DY[cell.d] * T * 0.2);
    g.stroke();
    chevron(g, cx + DX[cell.d] * T * 0.2, cy + DY[cell.d] * T * 0.2, cell.d, T * 0.18);
  } else {
    if (side != null) {
      g.globalAlpha = 0.6;
      g.beginPath();
      g.moveTo(cx + DX[side] * T * 0.42, cy + DY[side] * T * 0.42);
      g.quadraticCurveTo(cx, cy, cx + DX[cell.d] * T * 0.1, cy + DY[cell.d] * T * 0.1);
      g.stroke();
      g.globalAlpha = 1;
    }
    const n = cell.fast ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0.06 : -0.14 + i * 0.3;
      chevron(g, cx + DX[cell.d] * T * off, cy + DY[cell.d] * T * off, cell.d, T * 0.2);
    }
  }
  g.restore();
}

function chevron(g, x, y, d, s) {
  const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][d];
  g.beginPath();
  g.moveTo(x + Math.cos(a + 2.3) * s, y + Math.sin(a + 2.3) * s);
  g.lineTo(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7);
  g.lineTo(x + Math.cos(a - 2.3) * s, y + Math.sin(a - 2.3) * s);
  g.stroke();
}

/**
 * Where a program would take a robot, ignoring other robots and damage: a ghost per register.
 * Follows walls, pits, the board edge, conveyors, push panels and gears.
 * opts: { lessDeadly (safe edges), hover (Hover Unit: the robot's own moves cross pits it doesn't stop on) }
 */
export function previewProgram(course, start, regs, opts = {}) {
  let { x, y, d } = start;
  const ghosts = [];
  let path = [[x, y]];
  let last = null;
  let fell = false;
  const cell = (cx, cy) => (cx >= 0 && cy >= 0 && cx < course.w && cy < course.h ? course.cells[cy * course.w + cx] : null);
  const active = (cx, cy) => {
    const c = cell(cx, cy);
    if (!c) return null;
    return course.tokens.has(cy * course.w + cx) && c.k !== 'pit' ? { ...c, k: 'floor' } : c;
  };
  // own: a step of the robot's own card (Hover Unit carries it over pits it doesn't stop on)
  const step = (dir, own = false) => {
    if (wallBetween(course, x, y, dir)) return false;
    if (opts.lessDeadly && !cell(x + DX[dir], y + DY[dir])) return false;
    x += DX[dir];
    y += DY[dir];
    path.push([x, y]);
    const c = cell(x, y);
    if (!c || (c.k === 'pit' && !(own && opts.hover))) fell = true;
    return true;
  };
  const ops = (types) => {
    const out = [];
    for (const t of types) {
      if (t === 'm1') out.push(['mv', 0, 1]);
      else if (t === 'm2') out.push(['mv', 0, 2]);
      else if (t === 'm3') out.push(['mv', 0, 3]);
      else if (t === 'bk') out.push(['mv', 2, 1]);
      else if (t === 'rr') out.push(['rt', 1]);
      else if (t === 'rl') out.push(['rt', -1]);
      else if (t === 'ut') out.push(['rt', 2]);
      else if (t === 'crabr') out.push(['mv', 1, 1]);
      else if (t === 'crabl') out.push(['mv', 3, 1]);
      else if (Array.isArray(t)) out.push(t);
    }
    return out;
  };
  for (let r = 0; r < Math.min(5, regs.length) && !fell; r++) {
    const d0 = d;
    let list = regs[r] ?? [];
    if (list.length === 1 && list[0] === 'ag') list = r === 0 ? ['?'] : last ?? [];
    if (list.includes('sp') || list.includes('?')) {
      ghosts.push({ x, y, d, n: r + 1, unknown: true, path });
      return ghosts; // a SPAM (or Again in Register 1) is a mystery: stop guessing
    }
    if (list.length === 2 && list.every((t) => typeof t === 'string')) list = [list.includes('rr') ? 'crabr' : 'crabl'];
    for (const [k, a, b] of ops(list)) {
      if (k === 'rt') d = turn(d, a);
      else {
        for (let i = 0; i < b && !fell; i++) if (!step(turn(d, a), true)) break;
        if (opts.hover && !fell && cell(x, y)?.k === 'pit') fell = true; // hovering ends on a pit: in it goes
      }
    }
    last = list;
    // board elements
    for (const fast of [true, false]) {
      for (let s = 0; s < (fast ? 2 : 1) && !fell; s++) {
        const c = active(x, y);
        if (c?.k !== 'belt' || c.fast !== fast) break;
        if (wallBetween(course, x, y, c.d)) break;
        x += DX[c.d];
        y += DY[c.d];
        path.push([x, y]);
        const to = active(x, y);
        if (!cell(x, y) || cell(x, y).k === 'pit') fell = true;
        else if (to?.k === 'belt' && to.d !== c.d) d = turn(d, turn(to.d - c.d, 0) === 1 ? 1 : -1);
        if (!(to?.k === 'belt' && to.fast)) break;
      }
    }
    if (!fell) {
      const p = course.pushers.find((q) => q.x === x && q.y === y && q.regs.includes(r + 1));
      if (p) step(turn(p.side, 2));
    }
    if (!fell) {
      const c = active(x, y);
      if (c?.k === 'gear') d = turn(d, c.spin);
    }
    ghosts.push({ x, y, d, n: r + 1, fell, path, turned: d !== d0 });
    path = [[x, y]];
  }
  return ghosts;
}

/**
 * How many slots, from slot 1, are filled without a gap (the light line goes no further than that).
 * filled: five booleans (a locked Haywire slot counts as filled).
 */
export function filledRun(filled) {
  let n = 0;
  while (n < 5 && filled[n]) n++;
  return n;
}
