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

/**
 * Draw a course. o: { tile, ox, oy, robots: [{x,y,d,color,on,me,avatar}], ghosts: [{x,y,d,n,fell,path}],
 * ghostColor, starts: {n: color}, cpNext, cpDone(n), glow (soft light effects; off for tiny previews) }
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

  // laser paths, faintly, so the danger is visible
  g.save();
  g.setLineDash([lw(0.05), lw(0.1)]);
  for (const L of course.lasers) {
    const path = beamPath(course, L.x, L.y, L.d);
    const a = path[0];
    const b = path[path.length - 1];
    g.strokeStyle = 'rgba(255,74,58,.7)';
    g.lineWidth = lw(0.03);
    g.beginPath();
    g.moveTo(px(a.x + 0.5) - DX[L.d] * T * 0.38, py(a.y + 0.5) - DY[L.d] * T * 0.38);
    g.lineTo(px(b.x + 0.5) + DX[L.d] * T * 0.47, py(b.y + 0.5) + DY[L.d] * T * 0.47);
    g.stroke();
  }
  g.restore();

  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const cx = px(x + 0.5);
      const cy = py(y + 0.5);
      if (cell.k === 'pit') {
        g.strokeStyle = 'rgba(244,239,228,.4)';
        g.lineWidth = lw(0.03);
        g.strokeRect(px(x) + T * 0.08, py(y) + T * 0.08, T * 0.84, T * 0.84);
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
      } else if (cell.k === 'battery') {
        g.save();
        if (glow) {
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

  // reboot marks
  for (const b of course.boards) {
    if (!b.reboot) continue;
    const cx = px(b.reboot.x + 0.5);
    const cy = py(b.reboot.y + 0.5);
    g.strokeStyle = C.reboot;
    g.lineWidth = lw(0.03);
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(cx, cy, T * 0.36, 0, Math.PI * 2);
    g.stroke();
    drawGlyph(g, 'reboot', cx, cy, T * 0.5, C.reboot, 2.8);
    pointer(g, cx, cy, b.reboot.d, T * 0.48, T * 0.09, C.reboot);
    g.globalAlpha = 1;
  }

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
  g.stroke();
  g.restore();
  for (const L of course.lasers) {
    const side = turn(L.d, 2);
    const cx = px(L.x + 0.5) + DX[side] * T * 0.38;
    const cy = py(L.y + 0.5) + DY[side] * T * 0.38;
    g.fillStyle = '#0d1014';
    g.beginPath();
    g.roundRect(cx - T * 0.14, cy - T * 0.14, T * 0.28, T * 0.28, T * 0.05);
    g.fill();
    g.save();
    if (glow) {
      g.shadowColor = C.laser;
      g.shadowBlur = T * 0.2;
    }
    g.fillStyle = C.laser;
    g.beginPath();
    g.arc(cx, cy, T * 0.07, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  for (const p of course.pushers) {
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
    const done = o.cpDone?.(cp.n);
    const next = o.cpNext === cp.n;
    g.save();
    if (glow && !done) {
      g.shadowColor = C.light;
      g.shadowBlur = T * (next ? 0.5 : 0.2);
    }
    g.fillStyle = next ? C.light : done ? 'rgba(244,239,228,.08)' : 'rgba(244,239,228,.12)';
    g.strokeStyle = done ? 'rgba(244,239,228,.3)' : C.light;
    g.lineWidth = lw(0.04);
    g.beginPath();
    g.arc(cx, cy, T * 0.38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = next ? '#0b0e13' : done ? 'rgba(244,239,228,.35)' : C.light;
    g.font = `${next ? 500 : 300} ${Math.round(T * 0.48)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(cp.n), cx, cy + T * 0.03);
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
  const marks = new Map();
  for (const gh of ghosts) {
    const key = `${gh.x},${gh.y}`;
    const m = marks.get(key) ?? { ...gh, ns: [] };
    m.ns.push(gh.n);
    Object.assign(m, { d: gh.d, fell: gh.fell, unknown: gh.unknown });
    marks.set(key, m);
  }
  const lastKey = `${ghosts.at(-1).x},${ghosts.at(-1).y}`;
  for (const [key, gh] of marks) {
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
    const end = key === lastKey;
    const r = T * (end ? 0.27 : 0.2);
    g.fillStyle = end && !o.dashed && !gh.unknown ? gc : '#0b0e13'; // a "?" stays readable: light on dark
    g.strokeStyle = gc;
    g.lineWidth = lw(0.05, 1.5);
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (end && !gh.unknown) pointer(g, cx, cy, gh.d, r + T * 0.15, T * 0.1, gc);
    const label = gh.unknown ? '?' : end || o.numbers === false ? '' : gh.ns.join('');
    if (label && T >= 16) {
      g.fillStyle = gc;
      g.font = `600 ${Math.round(T * (label.length > 2 ? 0.17 : 0.24))}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, cx, cy + T * 0.01);
    }
  }
  g.restore();
}

/** A little triangle just outside a circle, pointing the way d. */
function pointer(g, cx, cy, d, dist, s, color) {
  const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][d];
  const x = cx + Math.cos(a) * dist;
  const y = cy + Math.sin(a) * dist;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  g.lineTo(x + Math.cos(a + 2.3) * s, y + Math.sin(a + 2.3) * s);
  g.lineTo(x + Math.cos(a - 2.3) * s, y + Math.sin(a - 2.3) * s);
  g.closePath();
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
  for (let r = 0; r < 5 && !fell; r++) {
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
    ghosts.push({ x, y, d, n: r + 1, fell, path });
    path = [[x, y]];
  }
  return ghosts;
}
