// A flat, top-down drawing of a course: the phones' map, the course previews, and the big screen's
// fallback when WebGL isn't available. Draws onto a 2D canvas context.
import { DX, DY, turn, beltInputs, beamPath, wallEdges, wallBetween } from './board.js';

const C = {
  floorA: '#d9cdb4',
  floorB: '#b94a3c',
  floorLine: 'rgba(0,0,0,.18)',
  pit: '#0b0b0d',
  hazard: '#f2c230',
  wall: '#f2c230',
  wallEdge: '#1a1a1a',
  blue: '#3aa0ff',
  green: '#3ddc84',
  belt: '#26282c',
  gearR: '#e0483a',
  gearG: '#3ddc84',
  laser: '#ff2b2b',
  battery: '#7cff6b',
  dock: '#55585e',
  dockB: '#3d4045',
};

/**
 * Draw a course. o: { tile, ox, oy, robots: [{x,y,d,color,on,me,name}], ghosts: [{x,y,d,n}], starts: {n: color}, faint }
 * ox/oy: pixel offset of space 0,0.
 */
export function drawCourse(g, course, o = {}) {
  const T = o.tile ?? 32;
  const ox = o.ox ?? 0;
  const oy = o.oy ?? 0;
  const px = (x) => ox + x * T;
  const py = (y) => oy + y * T;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // floor
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const dock = course.boards[cell.b]?.dock;
      g.fillStyle = dock ? ((x + y) % 2 ? C.dock : C.dockB) : (x + y) % 2 ? C.floorA : C.floorB;
      g.fillRect(px(x), py(y), T, T);
      g.strokeStyle = C.floorLine;
      g.lineWidth = 1;
      g.strokeRect(px(x) + 0.5, py(y) + 0.5, T - 1, T - 1);
    }
  }

  // laser paths, faintly, so players can see the danger
  for (const L of course.lasers) {
    const path = beamPath(course, L.x, L.y, L.d);
    const a = path[0];
    const b = path[path.length - 1];
    g.strokeStyle = 'rgba(255,43,43,.55)';
    g.lineWidth = Math.max(1.5, T * 0.06 * L.n);
    g.beginPath();
    g.moveTo(px(a.x + 0.5) - DX[L.d] * T * 0.45, py(a.y + 0.5) - DY[L.d] * T * 0.45);
    g.lineTo(px(b.x + 0.5) + DX[L.d] * T * 0.45, py(b.y + 0.5) + DY[L.d] * T * 0.45);
    g.stroke();
  }

  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const cx = px(x + 0.5);
      const cy = py(y + 0.5);
      if (cell.k === 'pit') {
        g.fillStyle = C.hazard;
        g.fillRect(px(x) + T * 0.04, py(y) + T * 0.04, T * 0.92, T * 0.92);
        g.fillStyle = C.pit;
        g.fillRect(px(x) + T * 0.14, py(y) + T * 0.14, T * 0.72, T * 0.72);
      } else if (cell.k === 'belt') {
        drawBelt(g, course, x, y, cell, px(x), py(y), T);
      } else if (cell.k === 'gear') {
        g.fillStyle = cell.spin > 0 ? C.gearG : C.gearR;
        gearShape(g, cx, cy, T * 0.42, T * 0.33);
        g.fill();
        g.strokeStyle = '#111';
        g.lineWidth = Math.max(1, T * 0.05);
        g.stroke();
        g.strokeStyle = '#111';
        g.lineWidth = Math.max(1.5, T * 0.07);
        g.beginPath();
        const r = T * 0.17;
        if (cell.spin > 0) g.arc(cx, cy, r, -Math.PI * 0.9, Math.PI * 0.4);
        else g.arc(cx, cy, r, Math.PI * 0.6, -Math.PI * 0.1 + Math.PI * 2, false);
        g.stroke();
      } else if (cell.k === 'battery') {
        g.fillStyle = '#1d2a1b';
        roundRect(g, cx - T * 0.2, cy - T * 0.32, T * 0.4, T * 0.64, T * 0.08);
        g.fill();
        g.fillStyle = C.battery;
        g.fillRect(cx - T * 0.08, cy - T * 0.38, T * 0.16, T * 0.07);
        g.font = `bold ${Math.round(T * 0.42)}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('⚡', cx, cy + T * 0.02);
      } else if (cell.k === 'start') {
        g.strokeStyle = '#f4f4f4';
        g.lineWidth = Math.max(1, T * 0.06);
        gearShape(g, cx, cy, T * 0.42, T * 0.34);
        g.stroke();
        g.fillStyle = o.starts?.[cell.n] ?? '#f4f4f4';
        g.font = `${Math.round(T * 0.46)}px Teko, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(cell.n), cx, cy + T * 0.04);
      }
    }
  }

  // reboot tokens
  for (const b of course.boards) {
    if (!b.reboot) continue;
    const cx = px(b.reboot.x + 0.5);
    const cy = py(b.reboot.y + 0.5);
    g.strokeStyle = '#4dabf7';
    g.lineWidth = Math.max(1.5, T * 0.08);
    g.beginPath();
    g.arc(cx, cy, T * 0.3, 0, Math.PI * 2);
    g.stroke();
    arrow(g, cx, cy, b.reboot.d, T * 0.3, '#4dabf7');
  }

  // walls (with lasers and push panels on them)
  g.strokeStyle = C.wallEdge;
  for (const w of wallEdges(course)) {
    const [x0, y0, x1, y1] = w.side === 0 ? [w.x, w.y, w.x + 1, w.y] : [w.x, w.y, w.x, w.y + 1];
    g.lineWidth = Math.max(3, T * 0.16);
    g.strokeStyle = C.wallEdge;
    g.beginPath();
    g.moveTo(px(x0), py(y0));
    g.lineTo(px(x1), py(y1));
    g.stroke();
    g.lineWidth = Math.max(1.5, T * 0.08);
    g.strokeStyle = C.wall;
    g.stroke();
  }
  for (const L of course.lasers) {
    const side = turn(L.d, 2);
    const cx = px(L.x + 0.5) + DX[side] * T * 0.36;
    const cy = py(L.y + 0.5) + DY[side] * T * 0.36;
    g.fillStyle = '#222';
    g.fillRect(cx - T * 0.13, cy - T * 0.13, T * 0.26, T * 0.26);
    g.fillStyle = C.laser;
    g.beginPath();
    g.arc(cx, cy, T * 0.08, 0, Math.PI * 2);
    g.fill();
  }
  for (const p of course.pushers) {
    const cx = px(p.x + 0.5) + DX[p.side] * T * 0.36;
    const cy = py(p.y + 0.5) + DY[p.side] * T * 0.36;
    const horiz = p.side === 0 || p.side === 2;
    g.fillStyle = C.hazard;
    g.fillRect(cx - (horiz ? T * 0.36 : T * 0.1), cy - (horiz ? T * 0.1 : T * 0.36), horiz ? T * 0.72 : T * 0.2, horiz ? T * 0.2 : T * 0.72);
    g.fillStyle = '#111';
    g.font = `bold ${Math.round(T * 0.2)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = p.regs.join(' ');
    if (horiz) g.fillText(label, cx, cy + 1);
    else {
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI / 2);
      g.fillText(label, 0, 1);
      g.restore();
    }
  }

  // checkpoints
  for (const cp of course.checkpoints) {
    const cx = px(cp.x + 0.5);
    const cy = py(cp.y + 0.5);
    const done = o.cpDone?.(cp.n);
    const next = o.cpNext === cp.n;
    g.fillStyle = done ? 'rgba(60,60,60,.85)' : next ? '#ffffff' : '#ffd43b';
    g.strokeStyle = '#111';
    g.lineWidth = Math.max(1.5, T * 0.06);
    g.beginPath();
    g.arc(cx, cy, T * 0.36, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (next) {
      g.strokeStyle = '#ffd43b';
      g.lineWidth = Math.max(2, T * 0.08);
      g.beginPath();
      g.arc(cx, cy, T * 0.46, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = done ? '#bbb' : '#111';
    g.font = `${Math.round(T * 0.5)}px Teko, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(cp.n), cx, cy + T * 0.05);
  }

  // where my program would take me (registers that end on the same space share one marker)
  const marks = new Map();
  for (const gh of o.ghosts ?? []) {
    const x = Math.max(0, Math.min(course.w - 1, gh.x));
    const y = Math.max(0, Math.min(course.h - 1, gh.y));
    const key = `${x},${y}`;
    const m = marks.get(key) ?? { ...gh, x, y, ns: [] };
    m.ns.push(gh.n);
    Object.assign(m, { d: gh.d, fell: gh.fell, unknown: gh.unknown });
    marks.set(key, m);
  }
  for (const gh of marks.values()) {
    const cx = px(gh.x + 0.5);
    const cy = py(gh.y + 0.5);
    g.globalAlpha = 0.85;
    g.fillStyle = gh.fell ? 'rgba(255,40,40,.55)' : 'rgba(255,255,255,.25)';
    g.strokeStyle = gh.fell ? '#ff3b3b' : o.ghostColor ?? '#fff';
    g.lineWidth = Math.max(1.5, T * 0.06);
    g.setLineDash([T * 0.12, T * 0.08]);
    g.beginPath();
    g.arc(cx, cy, T * 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.setLineDash([]);
    if (!gh.fell) arrow(g, cx, cy, gh.d, T * 0.3, o.ghostColor ?? '#fff');
    const label = gh.fell ? '✖' : gh.unknown ? '?' : gh.ns.join('');
    g.fillStyle = gh.fell ? '#fff' : '#111';
    g.font = `bold ${Math.round(T * (label.length > 2 ? 0.22 : 0.3))}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, cx, cy);
    g.globalAlpha = 1;
  }

  // robots
  for (const r of o.robots ?? []) {
    if (!r.on) continue;
    const cx = px(r.x + 0.5);
    const cy = py(r.y + 0.5);
    if (r.me) {
      g.strokeStyle = '#fff';
      g.lineWidth = Math.max(2, T * 0.09);
      g.beginPath();
      g.arc(cx, cy, T * 0.46, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = r.color;
    g.strokeStyle = '#111';
    g.lineWidth = Math.max(1.5, T * 0.07);
    g.beginPath();
    // a rounded wedge pointing the way the robot faces
    const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][r.d];
    const R = T * 0.36;
    g.moveTo(cx + Math.cos(a) * R * 1.15, cy + Math.sin(a) * R * 1.15);
    g.arc(cx, cy, R * 0.85, a + 2.2, a - 2.2 + Math.PI * 2, false);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3, T * 0.08, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawBelt(g, course, x, y, cell, X, Y, T) {
  const color = cell.fast ? C.blue : C.green;
  g.fillStyle = C.belt;
  g.fillRect(X + T * 0.06, Y + T * 0.06, T * 0.88, T * 0.88);
  const ins = beltInputs(course, x, y);
  const back = turn(cell.d, 2);
  const side = ins.find((d) => d !== back);
  const cx = X + T / 2;
  const cy = Y + T / 2;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1.5, T * 0.09);
  if (side != null && !ins.includes(back)) {
    // a curve: from the side it comes in, round to the way out
    g.beginPath();
    g.moveTo(cx + DX[side] * T * 0.42, cy + DY[side] * T * 0.42);
    g.quadraticCurveTo(cx, cy, cx + DX[cell.d] * T * 0.2, cy + DY[cell.d] * T * 0.2);
    g.stroke();
    chevron(g, cx + DX[cell.d] * T * 0.22, cy + DY[cell.d] * T * 0.22, cell.d, T * 0.2);
  } else {
    if (side != null) {
      // a junction: show the side entry too
      g.globalAlpha = 0.6;
      g.beginPath();
      g.moveTo(cx + DX[side] * T * 0.42, cy + DY[side] * T * 0.42);
      g.quadraticCurveTo(cx, cy, cx + DX[cell.d] * T * 0.1, cy + DY[cell.d] * T * 0.1);
      g.stroke();
      g.globalAlpha = 1;
    }
    const n = cell.fast ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0.08 : -0.12 + i * 0.3;
      chevron(g, cx + DX[cell.d] * T * off, cy + DY[cell.d] * T * off, cell.d, T * 0.22);
    }
  }
}

function chevron(g, x, y, d, s) {
  const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][d];
  g.beginPath();
  g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  g.lineTo(x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s);
  g.lineTo(x + Math.cos(a) * s * 0.15, y + Math.sin(a) * s * 0.15);
  g.lineTo(x + Math.cos(a - 2.4) * s, y + Math.sin(a - 2.4) * s);
  g.closePath();
  g.fill();
}

function arrow(g, x, y, d, s, color) {
  g.fillStyle = color;
  chevron(g, x + DX[d] * s * 0.55, y + DY[d] * s * 0.55, d, s * 0.55);
}

function gearShape(g, x, y, r1, r2) {
  g.beginPath();
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? r2 : r1;
    g.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    g.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  }
  g.closePath();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * Where a program would take a robot, ignoring other robots and damage: a ghost per register.
 * Follows walls, pits, the board edge, conveyors, push panels and gears.
 */
export function previewProgram(course, start, regs, opts = {}) {
  let { x, y, d } = start;
  const ghosts = [];
  let last = null;
  let fell = false;
  const cell = (cx, cy) => (cx >= 0 && cy >= 0 && cx < course.w && cy < course.h ? course.cells[cy * course.w + cx] : null);
  const active = (cx, cy) => {
    const c = cell(cx, cy);
    if (!c) return null;
    return course.tokens.has(cy * course.w + cx) && c.k !== 'pit' ? { ...c, k: 'floor' } : c;
  };
  const step = (dir) => {
    if (wallBetween(course, x, y, dir)) return false;
    if (opts.lessDeadly && !cell(x + DX[dir], y + DY[dir])) return false;
    x += DX[dir];
    y += DY[dir];
    const c = cell(x, y);
    if (!c || c.k === 'pit') fell = true;
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
      ghosts.push({ x, y, d, n: r + 1, unknown: true });
      return ghosts; // a SPAM (or Again in Register 1) is a mystery: stop guessing
    }
    if (list.length === 2 && list.every((t) => typeof t === 'string')) list = [list.includes('rr') ? 'crabr' : 'crabl'];
    for (const [k, a, b] of ops(list)) {
      if (k === 'rt') d = turn(d, a);
      else for (let i = 0; i < b && !fell; i++) if (!step(turn(d, a))) break;
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
    ghosts.push({ x, y, d, n: r + 1, fell });
  }
  return ghosts;
}
