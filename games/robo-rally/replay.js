// "What happened to me": the race screen's marks under each slot, and a replay of one slot on the
// real course, next to the line I planned. Reads the phone's story (rules.js, me.story):
//   me.story = { round, regs: [[step…] ×5] }, steps are compact arrays (paths flat [x, y, x, y…]):
//   ['s', x, y, d] pose · ['c', [types], path, turn] my card · ['x', from, to] my card was replaced
//   ['p', by, path, byPath] shoved by a robot · ['b', fast, path, turn] belt · ['g', spin] gear
//   ['k', path] push panel · ['l', src, x0, y0, d, n] laser (src 0: the board's) · ['d', sp, hw, src] damage
//   ['w'] bumped a wall · ['f', edge] fell · ['r', x, y, d] rebooted · ['cp', n] flag · ['e', n] energy · ['h'] shield
//   ['u', key, path, turn] an upgrade (not a card) moved or turned me. Unknown steps are skipped.
import { DX, DY } from './board.js';
import { drawCourse, drawGhostLine, C as COL } from './minimap.js';
import { drawCard, drawGlyph, drawRobot, svgGlyph, cardSvgHtml, robotSvg } from './glyphs.js';
import { mountAnim } from './demo.js';

const LIGHT = '#f4efe4';
const CORAL = '#ff7a6b';
const LASER = '#ff4a3a';
const STEP = 700;

// ---------- marks ----------

const PRIORITY = ['fall', 'dmg', 'pushed', 'flag', 'swap', 'shot', 'belt', 'gear', 'panel', 'energy', 'auto', 'wall'];

/** What one slot did to me, as marks: at most `max`, the most important first. */
export function marksFor(steps = [], { auto = false, max = 3 } = {}) {
  const found = new Map();
  for (const st of steps ?? []) {
    switch (st[0]) {
      case 'f': found.set('fall', { k: 'fall' }); break;
      case 'd': {
        const m = found.get('dmg') ?? { k: 'dmg', sp: 0, hw: 0 };
        m.sp += st[1] ?? 0;
        m.hw += st[2] ?? 0;
        found.set('dmg', m);
        break;
      }
      case 'p': if (!found.has('pushed')) found.set('pushed', { k: 'pushed', by: st[1] }); break;
      case 'cp': found.set('flag', { k: 'flag', n: st[1] }); break;
      case 'x': found.set('swap', { k: 'swap', from: st[1], to: st[2] }); break;
      case 'l': if (!found.has('shot')) found.set('shot', { k: 'shot', src: st[1] }); break;
      case 'b': if (!found.has('belt')) found.set('belt', { k: 'belt', fast: !!st[1] }); break;
      case 'g': found.set('gear', { k: 'gear', spin: st[1] }); break;
      case 'k': found.set('panel', { k: 'panel' }); break;
      case 'e': found.set('energy', { k: 'energy', n: st[1] }); break;
      case 'w': found.set('wall', { k: 'wall' }); break;
    }
  }
  if (auto) found.set('auto', { k: 'auto' });
  return PRIORITY.filter((k) => found.has(k)).map((k) => found.get(k)).slice(0, max);
}

/** Every step that did something to me, in order, as marks (the replay's cause row). */
export function causesFor(steps = [], { auto = false } = {}) {
  const out = [];
  if (auto) out.push({ k: 'auto' });
  for (const st of steps ?? []) {
    const m = marksFor([st], { max: 1 })[0];
    if (m) out.push(m);
  }
  return out;
}

/** A mark as a small picture (HTML). robots: the view's robots, for who pushed or shot me. */
export function markHtml(m, robots = []) {
  const who = (id) => robots.find((r) => r.id === id);
  const g = (name, cls = '') => svgGlyph(name, cls);
  switch (m.k) {
    case 'fall': return `<i class="rp-mark fall">${g('cross')}</i>`;
    case 'dmg': return `<i class="rp-mark dmg">${m.hw ? cardSvgHtml('hw', 'mini') : ''}${m.sp ? cardSvgHtml('sp', 'mini') : ''}</i>`;
    case 'pushed': return `<i class="rp-mark pushed">${who(m.by) ? robotSvg(who(m.by)) : g('dots')}</i>`;
    case 'flag': return `<i class="rp-mark flag">${g('flag')}</i>`;
    case 'swap': return `<i class="rp-mark swap">${g('swap')}</i>`;
    case 'shot': return `<i class="rp-mark shot" style="--c:${m.src && who(m.src) ? who(m.src).color : LASER}"><b></b></i>`;
    case 'belt': return `<i class="rp-mark belt ${m.fast ? 'fast' : ''}">${g('m1')}</i>`;
    case 'gear': return `<i class="rp-mark gear ${m.spin > 0 ? 'right' : 'left'}">${g(m.spin > 0 ? 'rr' : 'rl')}</i>`;
    case 'panel': return `<i class="rp-mark panel">${g('wall')}</i>`;
    case 'energy': return `<i class="rp-mark energy">${g('bolt')}</i>`;
    case 'auto': return `<i class="rp-mark auto">${g('dice')}</i>`;
    case 'wall': return `<i class="rp-mark wall">${g('wall')}</i>`;
  }
  return '';
}

/** The cards that ran in a slot: [{ t, was }] (a replaced card first, greyed: was = true). */
export function ranCards(steps = [], fallback = []) {
  const out = [];
  for (const st of steps ?? []) {
    if (st[0] === 'x') out.push({ t: st[1], was: true });
    if (st[0] === 'c') for (const t of st[1] ?? []) out.push({ t, was: false });
  }
  if (!out.some((c) => !c.was)) for (const t of fallback) out.push({ t, was: false });
  return out;
}

// ---------- the replay ----------

const pts = (flat) => {
  const out = [];
  for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
};

/** Turn a slot's steps into timed segments, starting from my pose. */
export function replayPlan(steps = [], start) {
  let pose = start ? { ...start, a: (start.d ?? 0) * 90, vis: true } : null;
  const segs = [];
  let lastDir = pose?.d ?? 0;
  for (const st of steps ?? []) {
    const k = st[0];
    if (k === 's') {
      pose = { x: st[1], y: st[2], d: st[3], a: st[3] * 90, vis: true };
      lastDir = st[3];
      continue;
    }
    if (!pose) {
      // no pose at the reveal (I came back in this register, or wasn't on the board): start where the first step does
      if (k === 'r') pose = { x: st[1], y: st[2], d: st[3] ?? 0, a: (st[3] ?? 0) * 90, vis: false };
      else {
        const p = pts(k === 'k' ? st[1] : st[2])[0];
        pose = p ? { x: p[0], y: p[1], d: 0, a: 0, vis: true } : { x: 0, y: 0, d: 0, a: 0, vis: true };
      }
    }
    const from = { ...pose };
    const seg = { k, from, ms: STEP, st };
    const follow = (flat, turnBy = 0) => {
      const path = pts(flat);
      seg.path = path.length ? path : [[pose.x, pose.y]];
      const end = seg.path.at(-1);
      if (seg.path.length > 1) {
        const [ax, ay] = seg.path.at(-2);
        const dx = Math.sign(end[0] - ax);
        const dy = Math.sign(end[1] - ay);
        lastDir = [0, 1, 2, 3].find((d) => DX[d] === dx && DY[d] === dy) ?? lastDir;
      }
      pose = { ...pose, x: end[0], y: end[1], d: (((pose.d + turnBy) % 4) + 4) % 4, a: pose.a + turnBy * 90 };
    };
    switch (k) {
      case 'c': case 'u': follow(st[2], st[3] ?? 0); seg.ms = 400 + Math.max(1, seg.path.length - 1) * 220; break;
      case 'p': follow(st[2]); seg.by = st[1]; seg.byPath = pts(st[3]); break;
      case 'b': follow(st[2], st[3] ?? 0); seg.fast = !!st[1]; break;
      case 'k': follow(st[1]); break;
      case 'g': pose = { ...pose, d: (((pose.d + st[1]) % 4) + 4) % 4, a: pose.a + st[1] * 90 }; break;
      case 'l': seg.src = st[1]; seg.x0 = st[2]; seg.y0 = st[3]; seg.d = st[4]; seg.ms = 650; break;
      case 'd': seg.sp = st[1] ?? 0; seg.hw = st[2] ?? 0; seg.ms = 800; break;
      case 'w': seg.d = lastDir; seg.ms = 450; break;
      case 'f': pose = { ...pose, vis: false }; seg.ms = 800; break;
      case 'r': {
        const d = st[3] ?? pose.d;
        let diff = (d - pose.d + 4) % 4;
        if (diff === 3) diff = -1;
        pose = { ...pose, x: st[1], y: st[2], d, a: pose.a + diff * 90, vis: true };
        break;
      }
      case 'x': seg.ms = 800; break;
      case 'cp': case 'e': case 'h': seg.ms = 650; break;
      default: continue;
    }
    seg.to = { ...pose };
    segs.push(seg);
  }
  return { start: segs[0]?.from ?? pose, segs, end: pose };
}

/** Every square a replay touches (for cropping). */
function cellsOf(plan, planned) {
  const out = [];
  const add = (x, y) => out.push([x, y]);
  if (plan.start) add(plan.start.x, plan.start.y);
  for (const s of plan.segs) {
    add(s.from.x, s.from.y);
    add(s.to.x, s.to.y);
    for (const [x, y] of s.path ?? []) add(x, y);
    for (const [x, y] of s.byPath ?? []) add(x, y);
    if (s.k === 'l') add(s.x0, s.y0);
  }
  for (const gh of planned ?? []) for (const [x, y] of gh.path ?? [[gh.x, gh.y]]) add(x, y);
  return out;
}

/**
 * Where a view of the course sits, along one axis: as near `want` (the offset that centres what matters)
 * as it can be without showing anything beyond the course's edges.
 */
function clampAxis(want, view, size) {
  return size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, want));
}

/**
 * The crop: the box around everything that happened (on the course), one square of margin; tiles 28-56 px,
 * never so small that the course stops filling the frame. The window shifts to stay inside the course.
 */
export function cropFor(course, cells, W, H, focus) {
  const on = cells.filter(([x, y]) => x >= 0 && y >= 0 && x < course.w && y < course.h);
  const xs = on.map((c) => c[0]);
  const ys = on.map((c) => c[1]);
  let [x0, x1, y0, y1] = on.length
    ? [Math.max(0, Math.min(...xs) - 1), Math.min(course.w - 1, Math.max(...xs) + 1), Math.max(0, Math.min(...ys) - 1), Math.min(course.h - 1, Math.max(...ys) + 1)]
    : [0, course.w - 1, 0, course.h - 1];
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  let tile = Math.min(56, W / bw, H / bh);
  if (tile < 28) tile = 28;
  tile = Math.max(tile, W / course.w, H / course.h); // the course fills the frame
  // centre the box; where it doesn't fit, centre on my robot instead
  const fx = focus && focus.x >= 0 && focus.x < course.w ? focus.x + 0.5 : (x0 + x1 + 1) / 2;
  const fy = focus && focus.y >= 0 && focus.y < course.h ? focus.y + 0.5 : (y0 + y1 + 1) / 2;
  const cx = bw * tile <= W ? (x0 + x1 + 1) / 2 : fx;
  const cy = bh * tile <= H ? (y0 + y1 + 1) / 2 : fy;
  return { tile, ox: clampAxis(W / 2 - cx * tile, W, course.w * tile), oy: clampAxis(H / 2 - cy * tile, H, course.h * tile) };
}

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const along = (path, k) => {
  if (path.length < 2) return path[0] ?? [0, 0];
  const n = path.length - 1;
  const f = Math.min(n - 1e-6, k * n);
  const i = Math.floor(f);
  const t = f - i;
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
};

/**
 * Replay one slot of my race on a canvas, looping. o: { course, steps, planned (ghosts), color, form,
 * robots, lazy }. Returns a stop function.
 */
export function mountReplay(canvas, o) {
  const plan = replayPlan(o.steps, o.start);
  const segs = plan.segs;
  const HOLD = 500;
  const total = HOLD + segs.reduce((s, x) => s + x.ms, 0) + 1000;
  const state = { bg: null, key: '' };
  const paint = (t) => {
    const W = canvas.clientWidth || 300;
    const H = canvas.clientHeight || 190;
    const dpr = Math.min(window.devicePixelRatio || 1, o.lazy ? 1.5 : 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      state.bg = null;
    }
    const crop = cropFor(o.course, cellsOf(plan, o.planned), W, H, plan.start);
    const { tile: T, ox, oy } = crop;
    if (!state.bg) {
      state.bg = document.createElement('canvas');
      state.bg.width = canvas.width;
      state.bg.height = canvas.height;
      const bg = state.bg.getContext('2d');
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg.fillStyle = '#0b0e13';
      bg.fillRect(0, 0, W, H);
      drawCourse(bg, o.course, { tile: T, ox, oy, glow: true, perimeter: o.perimeter, inert: o.inert });
      if (o.planned?.length) drawGhostLine(bg, o.course, o.planned, { tile: T, ox, oy, color: o.color, alpha: 0.45, dashed: true, numbers: false });
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(state.bg, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = (x) => ox + (x + 0.5) * T;
    const py = (y) => oy + (y + 0.5) * T;
    // where are we
    let seg = null;
    let k = 0;
    let rest = t - HOLD;
    let doneSegs = [];
    if (rest >= 0) {
      for (const s of segs) {
        if (rest < s.ms) {
          seg = s;
          k = rest / s.ms;
          break;
        }
        rest -= s.ms;
        doneSegs.push(s);
      }
    }
    if (!seg && rest >= 0) doneSegs = segs;
    const pose = seg ? seg.from : doneSegs.length ? doneSegs.at(-1).to : plan.start;
    if (!pose) return;
    let x = pose.x;
    let y = pose.y;
    let a = pose.a;
    let alpha = pose.vis === false ? 0 : 1;
    let scale = 1;
    const e = ease(k);
    // trails of what already moved me this slot
    g.save();
    g.strokeStyle = o.color;
    g.globalAlpha = 0.35;
    g.lineWidth = Math.max(2, T * 0.1);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of [...doneSegs, ...(seg ? [seg] : [])]) {
      if (!s.path || s.path.length < 2) continue;
      const until = s === seg ? e : 1;
      g.beginPath();
      g.moveTo(px(s.path[0][0]), py(s.path[0][1]));
      const n = s.path.length - 1;
      for (let i = 1; i <= n; i++) {
        if ((i - 1) / n >= until) break;
        const [qx, qy] = i / n <= until ? s.path[i] : along(s.path, until);
        g.lineTo(px(qx), py(qy));
      }
      g.stroke();
    }
    g.restore();
    // the others that acted on me
    const other = (id) => (o.robots ?? []).find((r) => r.id === id);
    if (seg?.k === 'p' && other(seg.by) && seg.byPath.length) {
      const r = other(seg.by);
      const bp = seg.byPath;
      const [bx, by] = along(bp, e);
      const dir = bp.length > 1 ? Math.atan2(bp.at(-1)[1] - bp[0][1], bp.at(-1)[0] - bp[0][0]) + Math.PI / 2 : 0;
      drawRobot(g, r.form ?? 0, px(bx), py(by), T * 0.34, dir, r.color, { alpha: 0.95 });
    }
    if (seg?.k === 'l' && seg.src && other(seg.src)) {
      const r = other(seg.src);
      drawRobot(g, r.form ?? 0, px(seg.x0), py(seg.y0), T * 0.34, (seg.d ?? 0) * (Math.PI / 2), r.color, { alpha: 0.95 });
    }
    // belts I rode pulse
    if (seg?.k === 'b') {
      g.save();
      g.globalAlpha = 0.25 * Math.sin(k * Math.PI);
      g.fillStyle = seg.fast ? COL.express : COL.belt;
      for (const [cx, cy] of seg.path) g.fillRect(ox + cx * T, oy + cy * T, T, T);
      g.restore();
    }
    if (seg) {
      if (seg.path) {
        const [qx, qy] = along(seg.path, e);
        x = qx;
        y = qy;
      }
      a = seg.from.a + (seg.to.a - seg.from.a) * e;
      if (seg.k === 'f') {
        scale = 1 - e * 0.85;
        alpha = 1 - e * 0.8;
      }
      if (seg.k === 'r') {
        x = seg.to.x;
        y = seg.to.y;
        scale = e;
        alpha = 1;
      }
      if (seg.k === 'w') {
        const b = Math.sin(k * Math.PI) * 0.14;
        x += DX[seg.d] * b;
        y += DY[seg.d] * b;
      }
    }
    if (alpha > 0) drawRobot(g, o.form ?? 0, px(x), py(y), T * 0.36 * scale, (a * Math.PI) / 180, o.color, { alpha, me: true });
    // effects on top
    if (!seg) return;
    const cx = px(x);
    const cy = py(y);
    const sz = Math.max(12, T * 0.42);
    g.save();
    if (seg.k === 'c' && seg.st[1]?.length) {
      g.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
      const types = seg.st[1];
      types.forEach((tp, i) => drawCard(g, tp, cx - (types.length * sz * 0.9) / 2 + i * sz * 0.9 + sz * 0.03, cy - T * 0.7 - sz * 1.1, sz * 0.84, sz * 1.1));
    } else if (seg.k === 'u') {
      g.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
      upTile(g, cx, cy - T * 0.7 - sz * 0.5, sz);
    } else if (seg.k === 'x') {
      const t2 = k < 0.55 ? (Math.floor(k * 16) % 2 ? seg.st[1] : 'sp') : seg.st[2] ?? 'back';
      drawCard(g, t2, cx - sz * 0.42, cy - T * 0.7 - sz * 1.1, sz * 0.84, sz * 1.1);
    } else if (seg.k === 'l') {
      const col = seg.src && other(seg.src) ? other(seg.src).color : LASER;
      g.strokeStyle = col;
      g.shadowColor = col;
      g.shadowBlur = T * 0.3;
      g.lineWidth = Math.max(1.5, T * 0.06);
      g.globalAlpha = 1 - k * 0.6;
      g.beginPath();
      const sx = seg.src ? px(seg.x0) : px(seg.x0) - DX[seg.d] * T * 0.45;
      const sy = seg.src ? py(seg.y0) : py(seg.y0) - DY[seg.d] * T * 0.45;
      const reach = Math.min(1, k * 2.5);
      g.moveTo(sx, sy);
      g.lineTo(sx + (cx - sx) * reach, sy + (cy - sy) * reach);
      g.stroke();
      if (reach >= 1) burst(g, cx, cy, T, (k - 0.4) / 0.6);
    } else if (seg.k === 'd') {
      const list = [...Array(seg.hw).fill('hw'), ...Array(seg.sp).fill('sp')];
      list.forEach((tp, i) => {
        const kk = Math.max(0, Math.min(1, k * 1.4 - i * 0.2));
        g.globalAlpha = kk < 0.8 ? 1 : (1 - kk) / 0.2;
        drawCard(g, tp, cx - sz * 0.42 + (i - (list.length - 1) / 2) * sz * 0.7, cy - T * 0.4 - kk * T * 0.9 - sz * 0.55, sz * 0.84, sz * 1.1);
      });
    } else if (seg.k === 'cp' || seg.k === 'h' || (seg.k === 'r' && k > 0.3)) {
      g.strokeStyle = seg.k === 'h' || seg.k === 'r' ? COL.reboot : LIGHT;
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = T * 0.3;
      g.lineWidth = Math.max(1.5, T * 0.05);
      g.globalAlpha = 1 - k;
      g.beginPath();
      g.arc(cx, cy, T * (0.35 + k * 0.5), 0, Math.PI * 2);
      g.stroke();
      if (seg.k === 'cp') {
        g.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        drawGlyph(g, 'flag', cx, cy - T * 0.75 - k * T * 0.2, sz, LIGHT);
      }
    } else if (seg.k === 'e') {
      g.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
      drawGlyph(g, 'bolt', cx, cy - T * 0.7 - k * T * 0.3, sz, COL.energy);
    } else if (seg.k === 'g') {
      g.strokeStyle = (seg.st[1] > 0 ? COL.right : COL.left);
      g.lineWidth = Math.max(1.5, T * 0.05);
      g.globalAlpha = Math.sin(k * Math.PI);
      g.beginPath();
      g.arc(cx, cy, T * 0.5, 0, Math.PI * 2);
      g.stroke();
    } else if (seg.k === 'k') {
      g.fillStyle = LIGHT;
      g.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      g.beginPath();
      g.arc(px(seg.from.x), py(seg.from.y), T * 0.45, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };
  return mountAnim(canvas, { total, paint, lazy: !!o.lazy, root: o.root ?? null, onStill: () => (state.bg = null) });
}

/** A small upgrade tile: an amber frame with a diamond. */
function upTile(g, x, y, s) {
  g.save();
  g.strokeStyle = COL.energy;
  g.fillStyle = 'rgba(255,197,110,.16)';
  g.lineWidth = Math.max(1.2, s * 0.07);
  g.beginPath();
  g.roundRect(x - s / 2, y - s / 2, s, s, s * 0.2);
  g.fill();
  g.stroke();
  g.fillStyle = COL.energy;
  g.beginPath();
  g.moveTo(x, y - s * 0.24);
  g.lineTo(x + s * 0.24, y);
  g.lineTo(x, y + s * 0.24);
  g.lineTo(x - s * 0.24, y);
  g.closePath();
  g.fill();
  g.restore();
}

function burst(g, x, y, T, k) {
  if (k <= 0 || k >= 1) return;
  g.save();
  g.strokeStyle = CORAL;
  g.shadowBlur = 0;
  g.lineWidth = Math.max(1.5, T * 0.04);
  g.globalAlpha = 1 - k;
  for (let r = 0; r < 8; r++) {
    const an = (r / 8) * Math.PI * 2;
    const r0 = T * (0.25 + k * 0.3);
    g.beginPath();
    g.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0);
    g.lineTo(x + Math.cos(an) * (r0 + T * 0.12), y + Math.sin(an) * (r0 + T * 0.12));
    g.stroke();
  }
  g.restore();
}

/**
 * The fallen state: the real course around my reboot ring. My robot's ghost drops onto the ring, two
 * junk cards rise from it, and a sweep of light fills the ring ("next round"). o: { course, at, color, form }
 */
export function mountFallen(canvas, o) {
  const total = 3600;
  const state = { bg: null };
  const paint = (t) => {
    const W = canvas.clientWidth || 300;
    const H = canvas.clientHeight || 190;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      state.bg = null;
    }
    const at = o.at ?? { x: 0, y: 0, d: 0 };
    const T = Math.max(30, Math.min(52, W / 7), W / o.course.w, H / o.course.h);
    // my ring in the middle, unless that would show space beyond the course: then the view shifts
    const ox = clampAxis(W / 2 - (at.x + 0.5) * T, W, o.course.w * T);
    const oy = clampAxis(H / 2 - (at.y + 0.5) * T, H, o.course.h * T);
    const cx = ox + (at.x + 0.5) * T;
    const cy = oy + (at.y + 0.5) * T;
    if (!state.bg) {
      state.bg = document.createElement('canvas');
      state.bg.width = canvas.width;
      state.bg.height = canvas.height;
      const bg = state.bg.getContext('2d');
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg.fillStyle = '#0b0e13';
      bg.fillRect(0, 0, W, H);
      drawCourse(bg, o.course, { tile: T, ox, oy, glow: true, perimeter: o.perimeter, inert: o.inert });
      // the rest of the course fades out at the edges
      const grad = bg.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.max(W, H) * 0.62);
      grad.addColorStop(0, 'rgba(11,14,19,0)');
      grad.addColorStop(1, 'rgba(11,14,19,.92)');
      bg.fillStyle = grad;
      bg.fillRect(0, 0, W, H);
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(state.bg, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k1 = Math.min(1, t / 900); // the ghost drops in
    const k2 = Math.max(0, Math.min(1, (t - 900) / 1100)); // junk rises
    const k3 = Math.max(0, Math.min(1, (t - 2000) / 1200)); // the ring fills: next round
    // the ring filling
    g.save();
    g.strokeStyle = COL.reboot;
    g.shadowColor = COL.reboot;
    g.shadowBlur = T * 0.4;
    g.lineWidth = Math.max(2, T * 0.07);
    g.beginPath();
    g.arc(cx, cy, T * 0.48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k3);
    g.stroke();
    g.restore();
    // the ghost of my robot
    const e = ease(k1);
    drawRobot(g, o.form ?? 0, cx, cy, T * 0.36 * (1.7 - 0.7 * e), (at.d ?? 0) * (Math.PI / 2), o.color, { alpha: 0.25 + 0.35 * e + (k3 >= 1 ? 0.3 : 0) });
    // two junk cards rise from it
    const sz = Math.max(12, T * 0.42);
    for (let i = 0; i < 2; i++) {
      const kk = Math.max(0, Math.min(1, k2 * 1.3 - i * 0.3));
      if (kk <= 0) continue;
      g.save();
      g.globalAlpha = kk < 0.8 ? 1 : (1 - kk) / 0.2;
      drawCard(g, 'sp', cx - sz * 0.42 + (i - 0.5) * sz * 0.9, cy - T * 0.4 - kk * T * 0.9 - sz * 0.55, sz * 0.84, sz * 1.1);
      g.restore();
    }
  };
  return mountAnim(canvas, { total, paint });
}
