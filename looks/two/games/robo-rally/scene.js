// The big screen's 3D world: a pop-up book. The course is printed on the open page; walls, lasers,
// push panels, flags, batteries and robots are cardboard pieces that pop up off it. Behind it, a
// cut-paper factory skyline. host.js (and the lobby's lessons) tell it what to show; this file
// draws and animates, and plays the sounds that go with what you see.
import * as THREE from './lib/three.module.min.js';
import { DX, DY, turn, getCourse, beltInputs, beamPath, wallEdges } from './board.js';
import { PAL, TAU, rand, canvas, grain, chevron, gearPath, bolt, FONT, EMOJI_FONT, drawCard, roundRect } from './paper.js';
import { makeStandee, STANDEE_H } from './standee.js';
import { sfx } from './sound.js';

const BOOK = 0.5; // thickness of the page block
const COVER = 0.07;
const GROUND = -BOOK - COVER;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const back = (t, s = 2.2) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

function tex(c, { repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const lambert = (opts) => new THREE.MeshLambertMaterial(opts);

// ---------- printed textures ----------

/** The page: every space printed in ink on cream card. Pits are cut out (transparent). */
function paintPage(c, S) {
  const cv = canvas(c.w * S, c.h * S);
  const g = cv.getContext('2d');
  const at = (x, y) => (x >= 0 && y >= 0 && x < c.w && y < c.h ? c.cells[y * c.w + x] : null);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const cell = at(x, y);
      if (!cell) continue;
      const X = x * S;
      const Y = y * S;
      const dock = c.boards[cell.b]?.dock;
      g.fillStyle = dock ? ((x + y) % 2 ? PAL.dock : PAL.dock2) : (x + y) % 2 ? PAL.paper : PAL.paper2;
      g.fillRect(X, Y, S, S);
    }
  }
  grain(g, 0, 0, cv.width, cv.height, 0.9);
  // grid lines, printed thin
  g.strokeStyle = 'rgba(38,37,49,.16)';
  g.lineWidth = Math.max(1, S * 0.012);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!at(x, y)) continue;
      g.strokeRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
    }
  }
  // seams between board pieces: a crease
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const a = at(x, y);
      if (!a) continue;
      for (const [nx, ny, sx, sy, ex, ey] of [[x + 1, y, 1, 0, 1, 1], [x, y + 1, 0, 1, 1, 1]]) {
        const b = at(nx, ny);
        if (!b || b.b === a.b) continue;
        g.strokeStyle = 'rgba(38,37,49,.35)';
        g.lineWidth = S * 0.03;
        g.beginPath();
        g.moveTo((x + sx) * S, (y + sy) * S);
        g.lineTo((x + ex) * S, (y + ey) * S);
        g.stroke();
      }
    }
  }
  // laser danger lines: dashed, so you know where the beams go
  for (const L of c.lasers) {
    const path = beamPath(c, L.x, L.y, L.d);
    const a = path[0];
    const b = path[path.length - 1];
    g.save();
    g.strokeStyle = 'rgba(226,85,59,.55)';
    g.lineWidth = S * 0.05;
    g.setLineDash([S * 0.12, S * 0.1]);
    g.lineCap = 'round';
    for (let i = 0; i < L.n; i++) {
      const off = (i - (L.n - 1) / 2) * S * 0.14;
      const ox = DY[L.d] !== 0 ? off : 0;
      const oy = DX[L.d] !== 0 ? off : 0;
      g.beginPath();
      g.moveTo((a.x + 0.5 - DX[L.d] * 0.4) * S + ox, (a.y + 0.5 - DY[L.d] * 0.4) * S + oy);
      g.lineTo((b.x + 0.5 + DX[L.d] * 0.45) * S + ox, (b.y + 0.5 + DY[L.d] * 0.45) * S + oy);
      g.stroke();
    }
    g.restore();
  }
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const cell = at(x, y);
      if (!cell) continue;
      const X = x * S;
      const Y = y * S;
      const cx = X + S / 2;
      const cy = Y + S / 2;
      if (cell.k === 'pit') {
        g.clearRect(X, Y, S, S);
      } else if (cell.k === 'belt') {
        paintBelt(g, c, x, y, cell, X, Y, S);
      } else if (cell.k === 'gear') {
        g.fillStyle = 'rgba(38,37,49,.16)';
        g.beginPath();
        g.arc(cx, cy, S * 0.47, 0, TAU);
        g.fill();
      } else if (cell.k === 'battery') {
        g.strokeStyle = 'rgba(185,128,15,.55)';
        g.lineWidth = S * 0.025;
        g.setLineDash([S * 0.05, S * 0.04]);
        g.beginPath();
        g.arc(cx, cy, S * 0.4, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      } else if (cell.k === 'start') {
        g.strokeStyle = PAL.ink;
        g.lineWidth = S * 0.035;
        g.beginPath();
        g.arc(cx, cy, S * 0.38, 0, TAU);
        g.stroke();
        g.fillStyle = PAL.ink;
        g.font = FONT(Math.round(S * 0.42), 800);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(cell.n), cx, cy + S * 0.03);
      }
    }
  }
  // push panels: which registers they push on, printed in front of them
  for (const p of c.pushers) {
    const into = turn(p.side, 2);
    const cx = (p.x + 0.5) * S + DX[p.side] * S * 0.14;
    const cy = (p.y + 0.5) * S + DY[p.side] * S * 0.14;
    g.fillStyle = PAL.ink;
    g.font = FONT(Math.round(S * 0.2), 800);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const horiz = p.side === 0 || p.side === 2;
    for (let i = 0; i < p.regs.length; i++) {
      const off = (i - (p.regs.length - 1) / 2) * S * 0.2;
      g.beginPath();
      g.fillStyle = PAL.mustard;
      const px = cx + (horiz ? off : 0);
      const py = cy + (horiz ? 0 : off);
      g.arc(px, py, S * 0.09, 0, TAU);
      g.fill();
      g.fillStyle = PAL.ink;
      g.fillText(String(p.regs[i]), px, py + S * 0.008);
    }
    // a push arrow
    g.fillStyle = 'rgba(38,37,49,.28)';
    g.save();
    g.translate((p.x + 0.5) * S + DX[into] * S * 0.12, (p.y + 0.5) * S + DY[into] * S * 0.12);
    g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][into]);
    chevron(g, 0, 0, S * 0.3, 0.3);
    g.fill();
    g.restore();
  }
  // checkpoints: a target ring under the flag
  for (const cp of c.checkpoints) {
    const cx = (cp.x + 0.5) * S;
    const cy = (cp.y + 0.5) * S;
    g.fillStyle = 'rgba(38,37,49,.1)';
    g.beginPath();
    g.arc(cx, cy, S * 0.44, 0, TAU);
    g.fill();
    g.strokeStyle = PAL.ink;
    g.lineWidth = S * 0.03;
    g.beginPath();
    g.arc(cx, cy, S * 0.44, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, S * 0.3, 0, TAU);
    g.stroke();
  }
  // reboot tokens: a circular arrow and the way you'll face
  for (const b of c.boards) {
    if (!b.reboot) continue;
    const cx = (b.reboot.x + 0.5) * S;
    const cy = (b.reboot.y + 0.5) * S;
    g.fillStyle = 'rgba(59,119,200,.16)';
    g.beginPath();
    g.arc(cx, cy, S * 0.44, 0, TAU);
    g.fill();
    g.strokeStyle = PAL.sky;
    g.lineWidth = S * 0.07;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, S * 0.25, -Math.PI * 0.35, Math.PI * 1.25);
    g.stroke();
    g.fillStyle = PAL.sky;
    const a0 = -Math.PI * 0.35;
    g.save();
    g.translate(cx + Math.cos(a0) * S * 0.25, cy + Math.sin(a0) * S * 0.25);
    g.rotate(a0 + Math.PI);
    g.beginPath();
    g.moveTo(-S * 0.11, 0);
    g.lineTo(S * 0.11, 0);
    g.lineTo(0, S * 0.13);
    g.closePath();
    g.fill();
    g.restore();
    const d = b.reboot.d;
    g.save();
    g.translate(cx + DX[d] * S * 0.4, cy + DY[d] * S * 0.4);
    g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][d]);
    chevron(g, 0, 0, S * 0.18, 0.4);
    g.fill();
    g.restore();
  }
  // a cut edge around every hole
  g.strokeStyle = 'rgba(38,37,49,.6)';
  g.lineWidth = S * 0.025;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (at(x, y)?.k !== 'pit') continue;
      for (let d = 0; d < 4; d++) {
        const n = at(x + DX[d], y + DY[d]);
        if (n?.k === 'pit') continue;
        const [x0, y0, x1, y1] = [[0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 1], [0, 0, 0, 1]][d];
        g.beginPath();
        g.moveTo((x + x0) * S, (y + y0) * S);
        g.lineTo((x + x1) * S, (y + y1) * S);
        g.stroke();
      }
    }
  }
  return cv;
}

function beltColors(fast) {
  return fast ? [PAL.sky, PAL.skyDark] : [PAL.leaf, PAL.leafDark];
}

function paintBelt(g, c, x, y, cell, X, Y, S) {
  const [col, dark] = beltColors(cell.fast);
  const ins = beltInputs(c, x, y);
  const backDir = turn(cell.d, 2);
  const side = ins.find((d) => d !== backDir);
  const curve = side != null && !ins.includes(backDir);
  const m = S * 0.08;
  g.save();
  g.translate(X + S / 2, Y + S / 2);
  g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][cell.d]); // now "up" is the way the belt goes
  if (!curve) {
    g.fillStyle = dark;
    g.fillRect(-S / 2 + m, -S / 2, S - 2 * m, S);
    g.fillStyle = col;
    g.fillRect(-S / 2 + m * 1.6, -S / 2, S - 3.2 * m, S);
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 6; i++) g.fillRect(-S / 2 + m * 1.6, -S / 2 + (i * S) / 6, S - 3.2 * m, S * 0.03);
    if (side != null) {
      // a side belt joins here
      const rel = (side - cell.d + 4) % 4; // 1 = from the right, 3 = from the left
      g.fillStyle = col;
      g.fillRect(rel === 1 ? S * 0.1 : -S / 2, -S * 0.2, S * 0.4, S * 0.4);
    }
  } else {
    // a curve: in from the side, out the top
    const rel = (side - cell.d + 4) % 4;
    if (rel === 3) g.scale(-1, 1);
    const R = S / 2;
    g.lineCap = 'butt';
    g.strokeStyle = dark;
    g.lineWidth = S - 2 * m;
    g.beginPath();
    g.arc(R, -R, R, Math.PI / 2, Math.PI);
    g.stroke();
    g.strokeStyle = col;
    g.lineWidth = S - 3.2 * m;
    g.stroke();
    g.fillStyle = '#fffaf0';
    chevron(g, -S * 0.0, -S * 0.3, S * 0.3, 0.38);
    g.fill();
    g.save();
    g.translate(S * 0.18, S * 0.12);
    g.rotate(-Math.PI / 4);
    chevron(g, 0, 0, S * 0.26, 0.38);
    g.fill();
    g.restore();
  }
  g.restore();
}

/** Chevrons for the moving belt overlay (transparent around them). */
function beltArrowTex(fast) {
  const S = 128;
  const cv = canvas(S, S);
  const g = cv.getContext('2d');
  g.fillStyle = '#fffaf0';
  const n = fast ? 2 : 1;
  for (let i = 0; i < n; i++) {
    chevron(g, S / 2, (i + 0.5) * (S / n) + 6, fast ? 46 : 56, 0.4);
    g.fill();
  }
  const t = tex(cv, { repeat: true });
  return t;
}

/** The book's page edges: many thin sheets. */
function pageEdgeTex() {
  const cv = canvas(64, 128);
  const g = cv.getContext('2d');
  g.fillStyle = '#e9dec6';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 3) {
    g.fillStyle = `rgba(120,95,55,${rand(0.08, 0.22)})`;
    g.fillRect(0, y, 64, 1);
  }
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,.15)');
  grad.addColorStop(1, 'rgba(60,40,20,.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  const t = tex(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function wallTex() {
  const cv = canvas(256, 96);
  const g = cv.getContext('2d');
  g.fillStyle = PAL.mustard;
  g.fillRect(0, 0, 256, 96);
  grain(g, 0, 0, 256, 96, 2);
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let x = -96; x < 256; x += 22) {
    g.beginPath();
    g.moveTo(x, 96);
    g.lineTo(x + 11, 96);
    g.lineTo(x + 107, 0);
    g.lineTo(x + 96, 0);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.16)';
  g.fillRect(0, 80, 256, 16);
  g.strokeStyle = PAL.ink;
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 88);
  return tex(cv);
}

/** A checkered flag with its number on a cream disc. */
function flagTex(n) {
  const W = 256;
  const H = 176;
  const cv = canvas(W, H);
  const g = cv.getContext('2d');
  const sq = 32;
  for (let y = 0; y < H; y += sq) {
    for (let x = 0; x < W; x += sq) {
      g.fillStyle = (x / sq + y / sq) % 2 ? PAL.ink : '#f7f1e4';
      g.fillRect(x, y, sq, sq);
    }
  }
  grain(g, 0, 0, W, H, 1.5);
  g.fillStyle = PAL.paper;
  g.beginPath();
  g.arc(W / 2, H / 2, H * 0.4, 0, TAU);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = PAL.ink;
  g.stroke();
  g.fillStyle = PAL.ink;
  g.font = FONT(118, 900);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), W / 2, H / 2 + 6);
  return tex(cv);
}

function batteryTex() {
  const cv = canvas(128, 160);
  const g = cv.getContext('2d');
  // a die-cut card with a battery printed on it
  g.fillStyle = '#fbf6ec';
  roundRect(g, 6, 6, 116, 148, 22);
  g.fill();
  g.strokeStyle = '#cbbd9f';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = PAL.ink;
  roundRect(g, 46, 14, 36, 14, 4);
  g.fill();
  g.fillStyle = PAL.gold;
  roundRect(g, 26, 24, 76, 118, 14);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = PAL.ink;
  g.stroke();
  g.fillStyle = PAL.ink;
  bolt(g, 64, 84, 70);
  g.fill();
  return tex(cv);
}

/** A paper starburst (pushes, hits). */
function burstTex(color) {
  const S = 128;
  const cv = canvas(S, S);
  const g = cv.getContext('2d');
  g.beginPath();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const r = i % 2 ? S * 0.26 : S * (0.44 + (i % 4 === 0 ? 0.04 : 0));
    g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = PAL.ink;
  g.stroke();
  return tex(cv);
}

/** A speech bubble with a picture (emoji or drawn) inside. */
function bubbleCanvas(kind, icon) {
  const W = 160;
  const H = 150;
  const cv = canvas(W, H);
  const g = cv.getContext('2d');
  g.fillStyle = '#fbf6ec';
  g.strokeStyle = PAL.ink;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(8, 8, W - 16, H - 40, 40);
  g.moveTo(W / 2 - 16, H - 33);
  g.lineTo(W / 2, H - 8);
  g.lineTo(W / 2 + 16, H - 33);
  g.fill();
  g.stroke();
  g.fillStyle = '#fbf6ec';
  g.fillRect(W / 2 - 13, H - 40, 26, 10);
  const cx = W / 2;
  const cy = (H - 32) / 2 + 4;
  if (kind === 'think') {
    g.fillStyle = PAL.ink;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(cx - 30 + i * 30, cy, 9, 0, TAU);
      g.fill();
    }
  } else if (kind === 'ready') {
    g.strokeStyle = PAL.leaf;
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(cx - 28, cy + 2);
    g.lineTo(cx - 8, cy + 22);
    g.lineTo(cx + 30, cy - 20);
    g.stroke();
  } else if (kind === 'off') {
    g.strokeStyle = PAL.ink;
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy + 4, 26, -Math.PI * 0.3, Math.PI * 1.3);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, cy - 30);
    g.lineTo(cx, cy + 2);
    g.stroke();
  } else {
    g.font = EMOJI_FONT(64);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = PAL.ink;
    g.fillText(icon ?? '?', cx, cy + 4);
  }
  return cv;
}

/** Text or emoji that floats up from a robot. */
function floatCanvas(text, color) {
  const probe = canvas(4, 4).getContext('2d');
  const font = 64;
  probe.font = `800 ${font}px Inter, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  const w = Math.ceil(probe.measureText(text).width) + 30;
  const cv = canvas(w, font * 1.5);
  const g = cv.getContext('2d');
  g.font = probe.font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.strokeStyle = '#fbf6ec';
  g.strokeText(text, w / 2, cv.height / 2);
  g.fillStyle = color;
  g.fillText(text, w / 2, cv.height / 2);
  return cv;
}

/** The cut-paper factory skyline: one layer, seeded so it stays the same. */
function skylineTex(seed, color, opts = {}) {
  const shape = skylineShape(seed, '#fff', opts);
  const { w, h } = shape;
  const cv = canvas(w, h);
  const g = cv.getContext('2d');
  // a light rim along the tops (lamplight on the cut edge), then the color, then a little grain
  const rim = canvas(w, h);
  const rg = rim.getContext('2d');
  rg.drawImage(shape, 0, 0);
  rg.globalCompositeOperation = 'source-in';
  rg.fillStyle = new THREE.Color(color).lerp(new THREE.Color('#f2d9a0'), 0.35).getStyle();
  rg.fillRect(0, 0, w, h);
  g.drawImage(rim, 0, 0);
  const body = canvas(w, h);
  const bg = body.getContext('2d');
  bg.drawImage(shape, 0, 5);
  bg.globalCompositeOperation = 'source-in';
  bg.fillStyle = color;
  bg.fillRect(0, 0, w, h);
  g.save();
  g.drawImage(body, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(shape, 0, 0);
  g.restore();
  g.globalCompositeOperation = 'source-atop';
  grain(g, 0, 0, w, h, 0.25);
  if (opts.windows) {
    // a few lit windows: the factory town is still awake
    let s = seed * 7 + 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sx = shape.getContext('2d').getImageData(0, 0, w, h).data;
    for (let i = 0; i < opts.windows; i++) {
      const x = Math.floor(rnd() * (w - 20));
      const y = Math.floor(h * 0.42 + rnd() * h * 0.5);
      if (sx[((y - 14) * w + x) * 4 + 3] < 128) continue; // only inside a building
      g.fillStyle = rnd() < 0.8 ? 'rgba(243,196,107,.85)' : 'rgba(243,196,107,.4)';
      g.fillRect(x, y, 9, 13);
      if (rnd() < 0.5) g.fillRect(x + 14, y, 9, 13);
    }
  }
  const t = tex(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function skylineShape(seed, color, { w = 2048, h = 512, height = 0.6, chimneys = 4, gears = 2 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cv = canvas(w, h);
  const g = cv.getContext('2d');
  g.fillStyle = color;
  const base = h * (1 - height * 0.35);
  g.fillRect(0, base, w, h - base);
  let x = 0;
  while (x < w) {
    const bw = 90 + rnd() * 220;
    const bh = h * height * (0.25 + rnd() * 0.5);
    const top = h - bh;
    const kind = rnd();
    g.beginPath();
    if (kind < 0.4) {
      // sawtooth factory roof
      g.moveTo(x, h);
      g.lineTo(x, top + 30);
      const teeth = 2 + Math.floor(rnd() * 3);
      const tw = bw / teeth;
      for (let i = 0; i < teeth; i++) {
        g.lineTo(x + i * tw, top);
        g.lineTo(x + (i + 1) * tw, top + 30);
      }
      g.lineTo(x + bw, h);
    } else if (kind < 0.7) {
      g.moveTo(x, h);
      g.lineTo(x, top);
      g.lineTo(x + bw, top);
      g.lineTo(x + bw, h);
    } else {
      // a tank with a domed top
      g.moveTo(x, h);
      g.lineTo(x, top + bw * 0.25);
      g.quadraticCurveTo(x + bw / 2, top - bw * 0.12, x + bw, top + bw * 0.25);
      g.lineTo(x + bw, h);
    }
    g.closePath();
    g.fill();
    x += bw + rnd() * 30;
  }
  for (let i = 0; i < chimneys; i++) {
    const cx = rnd() * w;
    const cw = 22 + rnd() * 18;
    const ch = h * height * (0.7 + rnd() * 0.35);
    g.fillRect(cx, h - ch, cw, ch);
    g.fillRect(cx - 5, h - ch, cw + 10, 10);
  }
  for (let i = 0; i < gears; i++) {
    const gx = rnd() * w;
    const r = 50 + rnd() * 50;
    gearPath(g, gx, h - h * height * 0.55, r, r * 0.82, 12);
    g.fill();
  }
  cv.w = w;
  cv.h = h;
  return cv;
}

function smokeTex() {
  const cv = canvas(128, 128);
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  for (const [x, y, r] of [[64, 70, 34], [40, 78, 24], [88, 80, 22], [64, 46, 24]]) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  return tex(cv);
}

function groundTex() {
  const cv = canvas(512, 512);
  const g = cv.getContext('2d');
  g.fillStyle = PAL.night;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rand(0.01, 0.035)})` : `rgba(0,0,0,${rand(0.03, 0.08)})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, rand(1, 3), rand(1, 2));
  }
  const t = tex(cv, { repeat: true });
  t.repeat.set(12, 12);
  return t;
}

function coverTex() {
  // book cloth: a woven deep red
  const cv = canvas(256, 256);
  const g = cv.getContext('2d');
  g.fillStyle = '#7d3129';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = `rgba(0,0,0,${rand(0.04, 0.12)})`;
    g.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    g.fillStyle = `rgba(255,255,255,${rand(0.01, 0.04)})`;
    g.fillRect(x, 0, 1, 256);
  }
  const t = tex(cv, { repeat: true });
  return t;
}

// ---------- the arena ----------

export class Arena {
  constructor(container) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    r.setPixelRatio(this.pixelRatio);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    container.append(r.domElement);
    this.maxTex = r.capabilities.maxTextureSize || 4096;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PAL.night);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    this.bots = new Map();
    this.effects = [];
    this.popups = [];
    this.gears = new Map();
    this.pushers = new Map();
    this.flags = [];
    this.course = null;
    this.camMode = 'race';
    this.focusOn = null;
    this.attention = null;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.frameTimes = [];
    this.statuses = new Map();
    this.namesOn = true;
    this.texCache = new Map();

    this.buildWorld();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const b of this.bots.values()) b.fig.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m) continue;
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // free the GPU now: the lobby and the race each make their own
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.size = { w, h };
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  /** Room the HUD takes at each side, in CSS pixels; the course is framed in what's left. */
  setInsets(insets) {
    const next = { top: 0, bottom: 0, left: 0, right: 0, ...insets };
    if (JSON.stringify(next) === JSON.stringify(this.insets)) return;
    this.insets = next;
    this.fitCamera();
  }

  // ----- the world around the book -----

  buildWorld() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xd6e8ea, 0x2b4d55, 0.8));
    const key = new THREE.SpotLight(0xffe4c0, 260, 0, 0.5, 0.75, 1.15);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 4;
    s.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0x9fd6e0, 0.55);
    rim.position.set(10, 6, -14);
    s.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lambert({ map: groundTex(), color: 0xffffff }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND;
    ground.receiveShadow = true;
    s.add(ground);
    this.ground = ground;
    // the lamp's warm pool of light on the table around the book
    const poolCv = canvas(256, 256);
    const pg = poolCv.getContext('2d');
    const rg = pg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,214,150,.30)');
    rg.addColorStop(0.45, 'rgba(255,200,130,.14)');
    rg.addColorStop(1, 'rgba(255,200,130,0)');
    pg.fillStyle = rg;
    pg.fillRect(0, 0, 256, 256);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(poolCv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = GROUND + 0.01;
    s.add(this.pool);

    // the skyline: cut-paper layers far behind, lighter toward the horizon
    this.sky = new THREE.Group();
    s.add(this.sky);
    const skyCv = canvas(8, 256);
    const sg = skyCv.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0d1b21');
    grad.addColorStop(0.55, '#1f3d44');
    grad.addColorStop(1, '#4f7f7a');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 8, 256);
    const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 90), new THREE.MeshBasicMaterial({ map: tex(skyCv), fog: false, depthWrite: false }));
    skyPlane.position.set(0, GROUND + 45 - 2, -150);
    this.sky.add(skyPlane);
    this.skyPlane = skyPlane;
    // a low paper moon
    const moonCv = canvas(256, 256);
    const mg = moonCv.getContext('2d');
    mg.fillStyle = '#f2d68e';
    mg.beginPath();
    mg.arc(128, 128, 120, 0, TAU);
    mg.fill();
    grain(mg, 0, 0, 256, 256, 3);
    const moon = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ map: tex(moonCv), transparent: true, depthWrite: false }));
    moon.position.set(-22, GROUND + 15, -140);
    this.sky.add(moon);
    this.moon = moon;
    // cut-paper flats standing behind the book, nearest first (darkest), farthest lightest
    this.layers = [];
    const tones = ['#1b3339', '#26464c', '#33585b', '#44706f'];
    tones.forEach((color, i) => {
      const t = skylineTex(1234 + i * 77, color, { height: 0.5 + i * 0.12, chimneys: 2 + i, gears: i % 2 ? 2 : 1, windows: [90, 60, 30, 0][i] });
      const mat = i === 0 ? lambert({ map: t, alphaTest: 0.4 }) : new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.receiveShadow = i === 0;
      m.userData.depth = i;
      this.sky.add(m);
      this.layers.push(m);
    });
  }

  /** Put the skyline behind the course (depends on its size). */
  placeSky(c) {
    const back = -c.h / 2 - 0.8;
    this.layers.forEach((m, i) => {
      const gap = [1.6, 4.5, 9, 16][i];
      const h = [3.4, 5.6, 8.5, 13][i] * (0.75 + Math.min(c.w, 24) / 48);
      const w = c.w + 18 + gap * 3.4;
      m.scale.set(w, h, 1);
      m.material.map.repeat.set(w / (h * 4), 1);
      m.position.set((i % 2 ? -1 : 1) * i * 1.3, GROUND + h / 2 - 0.02, back - gap);
    });
  }

  // ----- the course -----

  pos(x, y) {
    return new THREE.Vector3(x + 0.5 - this.course.w / 2, 0, y + 0.5 - this.course.h / 2);
  }

  setCourse(id) {
    if (this.course?.id === id) return;
    this.setCourseData(getCourse(id));
  }

  /** Build a course on the page (any object shaped like getCourse()'s), and pop it up. */
  setCourseData(c) {
    this.course = c;
    for (const obj of [...this.board.children]) {
      this.board.remove(obj);
      obj.traverse((o) => {
        o.geometry?.dispose?.();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
        o.customDepthMaterial?.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
    }
    this.popups = [];
    this.gears.clear();
    this.pushers.clear();
    this.flags = [];
    this.beltMats = [];
    const at = (x, y) => (x >= 0 && y >= 0 && x < c.w && y < c.h ? c.cells[y * c.w + x] : null);
    const S = Math.max(48, Math.min(128, Math.floor(Math.min(4096, this.maxTex) / Math.max(c.w, c.h))));

    // the printed page
    const pageTex = tex(paintPage(c, S));
    const page = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), lambert({ map: pageTex, alphaTest: 0.5 }));
    page.rotation.x = -Math.PI / 2;
    page.receiveShadow = true;
    this.board.add(page);

    // page edges around the outline, and the walls of every hole
    const edgePos = [];
    const edgeUv = [];
    const wellPos = [];
    const wellCol = [];
    const quad = (list, uv, a, b, cc, d, uvs) => {
      list.push(...a, ...b, ...cc, ...a, ...cc, ...d);
      if (uv) uv.push(...uvs);
    };
    const top = new THREE.Color('#9a8a6a');
    const bottom = new THREE.Color('#0d1013');
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = at(x, y);
        if (!cell) continue;
        const x0 = x - c.w / 2;
        const z0 = y - c.h / 2;
        for (let d = 0; d < 4; d++) {
          const n = at(x + DX[d], y + DY[d]);
          // corners of this side, as seen from outside, left to right
          const sides = [
            [[x0 + 1, z0], [x0, z0]],
            [[x0 + 1, z0 + 1], [x0 + 1, z0]],
            [[x0, z0 + 1], [x0 + 1, z0 + 1]],
            [[x0, z0], [x0, z0 + 1]],
          ];
          const [[ax, az], [bx, bz]] = sides[d];
          if (!n && cell.k !== 'pit') {
            quad(edgePos, edgeUv, [ax, 0, az], [bx, 0, bz], [bx, -BOOK, bz], [ax, -BOOK, az], [0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
          }
          if (cell.k === 'pit' && n?.k !== 'pit') {
            // the wall of the hole, facing inward: walk the side the other way round
            const D = BOOK - 0.02;
            wellPos.push(bx, 0, bz, ax, 0, az, ax, -D, az, bx, 0, bz, ax, -D, az, bx, -D, bz);
            for (const k of [0, 0, 1, 0, 1, 1]) {
              const col = top.clone().lerp(bottom, k ? 1 : 0);
              wellCol.push(col.r, col.g, col.b);
            }
          }
        }
        if (cell.k === 'pit') {
          const D = BOOK - 0.02;
          wellPos.push(x0, -D, z0, x0, -D, z0 + 1, x0 + 1, -D, z0 + 1, x0, -D, z0, x0 + 1, -D, z0 + 1, x0 + 1, -D, z0);
          for (let i = 0; i < 6; i++) wellCol.push(bottom.r, bottom.g, bottom.b);
        }
      }
    }
    if (edgePos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(edgeUv, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, lambert({ map: pageEdgeTex(), side: THREE.FrontSide }));
      m.receiveShadow = true;
      m.castShadow = true;
      this.board.add(m);
    }
    if (wellPos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(wellPos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(wellCol, 3));
      geo.computeVertexNormals();
      this.board.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }

    // the hard cover under each board's pages, a little bigger
    const cov = coverTex();
    cov.repeat.set(0.35, 0.35);
    const coverMat = lambert({ map: cov });
    for (const b of c.boards) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.7, COVER, b.h + 0.7), coverMat);
      cover.position.set(b.x + b.w / 2 - c.w / 2, -BOOK - COVER / 2, b.y + b.h / 2 - c.h / 2);
      cover.receiveShadow = true;
      cover.castShadow = true;
      this.board.add(cover);
    }

    // conveyor chevrons that move (straight belts), two instanced meshes
    const straight = { false: [], true: [] };
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = at(x, y);
        if (cell?.k !== 'belt') continue;
        const ins = beltInputs(c, x, y);
        const backDir = turn(cell.d, 2);
        const side = ins.find((d) => d !== backDir);
        if (side != null && !ins.includes(backDir)) continue; // curves are printed
        straight[cell.fast].push({ x, y, d: cell.d });
      }
    }
    const plane = new THREE.PlaneGeometry(0.62, 1);
    plane.rotateX(-Math.PI / 2);
    for (const fast of [false, true]) {
      const list = straight[fast];
      if (!list.length) continue;
      const t = beltArrowTex(fast);
      const mat = lambert({ map: t, transparent: true, alphaTest: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 });
      const inst = new THREE.InstancedMesh(plane, mat, list.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach((b, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.d * (Math.PI / 2));
        m4.compose(this.pos(b.x, b.y).setY(0.004), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, m4);
      });
      inst.receiveShadow = true;
      this.board.add(inst);
      this.beltMats.push({ tex: t, mat, speed: fast ? 1.0 : 0.5, fast, glow: 0 });
    }

    // gears: cut card pinned with a brass fastener
    const gearMats = { 1: lambert({ color: new THREE.Color(PAL.leaf) }), [-1]: lambert({ color: new THREE.Color(PAL.tomato) }) };
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.35 });
    const arrowMat = lambert({ color: new THREE.Color('#fffaf0') });
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = at(x, y);
        if (cell?.k !== 'gear') continue;
        const gm = gearMesh(gearMats[cell.spin], cell.spin, brass, arrowMat);
        gm.position.copy(this.pos(x, y));
        this.board.add(gm);
        this.gears.set(`${x},${y}`, { mesh: gm, spin: cell.spin, extra: 0 });
      }
    }

    // walls: card strips that fold up from the page
    const wMat = lambert({ map: wallTex() });
    const wGeo = new THREE.BoxGeometry(1.04, 0.36, 0.06);
    wGeo.translate(0, 0.18, 0);
    const tabGeo = new THREE.BoxGeometry(1.0, 0.012, 0.14);
    tabGeo.translate(0, 0.006, 0.07);
    const tabMat = lambert({ color: new THREE.Color(PAL.mustardDark) });
    for (const w of wallEdges(c)) {
      const holder = new THREE.Group();
      const m = new THREE.Mesh(wGeo, wMat);
      m.castShadow = true;
      m.receiveShadow = true;
      const tab = new THREE.Mesh(tabGeo, tabMat);
      holder.add(tab);
      let px;
      let pz;
      let yaw;
      if (w.side === 0) {
        px = w.x + 0.5 - c.w / 2;
        pz = w.y - c.h / 2;
        yaw = 0;
      } else {
        px = w.x - c.w / 2;
        pz = w.y + 0.5 - c.h / 2;
        yaw = Math.PI / 2;
      }
      this.addPopup(m, new THREE.Vector3(px, 0, pz), yaw, holder);
    }

    // wall lasers
    const housing = lambert({ color: new THREE.Color(PAL.ink) });
    const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.tomato) });
    this.emitters = [];
    for (const L of c.lasers) {
      const side = turn(L.d, 2);
      const p = this.pos(L.x, L.y);
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.16), housing);
      box.position.y = 0.2;
      box.castShadow = true;
      g.add(box);
      for (let i = 0; i < L.n; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), lens);
        l.rotation.x = Math.PI / 2;
        l.position.set((i - (L.n - 1) / 2) * 0.13, 0.2, 0.085);
        g.add(l);
      }
      // the housing hangs on the wall and points along the beam
      this.addPopup(g, new THREE.Vector3(p.x + DX[side] * 0.38, 0, p.z + DY[side] * 0.38), Math.atan2(DX[L.d], DY[L.d]));
      this.emitters.push(L);
    }

    // push panels: an accordion fold in front of the wall
    for (const q of c.pushers) {
      const p = this.pos(q.x, q.y);
      const into = turn(q.side, 2);
      const g = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.05), lambert({ color: new THREE.Color(PAL.mustard) }));
      plate.position.set(0, 0.17, 0.06);
      plate.castShadow = true;
      const folds = new THREE.Group();
      const foldMat = lambert({ color: new THREE.Color('#d39732') });
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.02), foldMat);
        f.position.set(0, 0.17, 0.0);
        f.castShadow = true;
        folds.add(f);
      }
      g.add(plate, folds);
      this.addPopup(g, new THREE.Vector3(p.x + DX[q.side] * 0.44, 0, p.z + DY[q.side] * 0.44), Math.atan2(DX[into], DY[into]));
      this.pushers.set(`${q.x},${q.y}`, { plate, folds, kick: -10 });
    }

    // batteries: little printed cards standing on the space
    const batMat = lambert({ map: batteryTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    const batGeo = new THREE.PlaneGeometry(0.34, 0.425);
    batGeo.translate(0, 0.2125, 0);
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        if (at(x, y)?.k !== 'battery') continue;
        const m = new THREE.Mesh(batGeo, batMat);
        m.castShadow = true;
        m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: batMat.map, alphaTest: 0.5 });
        const p = this.pos(x, y);
        this.addPopup(m, new THREE.Vector3(p.x + 0.26, 0, p.z - 0.26), 0);
      }
    }

    // checkpoint flags
    const poleMat = lambert({ color: new THREE.Color(PAL.ink) });
    for (const cp of c.checkpoints) {
      const p = this.pos(cp.x, cp.y);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.45, 8), poleMat);
      pole.position.set(-0.3, 0.725, 0);
      pole.castShadow = true;
      g.add(pole);
      const geo = new THREE.PlaneGeometry(0.66, 0.454, 8, 2);
      geo.translate(0.33, 0, 0);
      const flag = new THREE.Mesh(geo, lambert({ map: flagTex(cp.n), side: THREE.DoubleSide }));
      flag.position.set(-0.3, 1.18, 0);
      flag.castShadow = true;
      g.add(flag);
      this.addPopup(g, p.clone(), 0);
      this.flags.push({ g, flag, geo, base: geo.attributes.position.array.slice(), n: cp.n, flash: -10 });
    }

    this.camCur = null; // a new course: start the camera where it belongs
    this.viewIns = null;
    this.fitCamera();
    this.placeLight(c);
    this.placeSky(c);
    this.popAll();
    for (const b of this.bots.values()) b.pop = this.time + 0.4 + Math.random() * 0.3;
  }

  /** Something that stands up off the page: it pops up with a spring when the course appears. */
  addPopup(obj, at, yaw, holder = new THREE.Group()) {
    const pivot = new THREE.Group();
    pivot.position.copy(at);
    pivot.rotation.y = yaw;
    const hinge = new THREE.Group();
    hinge.add(obj);
    pivot.add(holder);
    holder.add(hinge);
    this.board.add(pivot);
    this.popups.push({ hinge, at: at.clone(), t0: 0 });
    return pivot;
  }

  popAll() {
    const t = this.time;
    let n = 0;
    const order = [...this.popups].sort((a, b) => a.at.length() - b.at.length());
    for (const p of order) {
      p.t0 = t + 0.25 + p.at.length() * 0.045 + Math.random() * 0.08;
      p.hinge.rotation.x = -Math.PI / 2;
      if (n++ % 3 === 0) sfx.pop(p.t0 - t, 0.9 + Math.random() * 0.3);
    }
  }

  placeLight(c) {
    const span = Math.max(c.w, c.h);
    this.pool.scale.set(c.w * 2.2 + 8, c.h * 2.2 + 8, 1);
    this.key.position.set(-span * 0.75, span * 1.0 + 5, span * 0.45 + 3);
    this.key.target.position.set(0, 0, 0);
    const dist = this.key.position.length();
    this.key.angle = Math.atan((span * 1.05) / dist);
    this.key.penumbra = 0.6;
    this.key.distance = 0;
    this.key.intensity = 3.3 * dist * dist; // the same brightness on the page for any size of course
    this.key.decay = 2;
    this.key.shadow.camera.near = dist * 0.5;
    this.key.shadow.camera.far = dist * 1.6;
    this.key.shadow.camera.updateProjectionMatrix();
  }

  /** Back the camera off until the whole course fits in the space the HUD leaves. */
  fitCamera() {
    if (!this.course || !this.size) return;
    const c = this.course;
    const cam = this.camera;
    const { w, h } = this.size;
    const ins = this.insets;
    const fw = Math.max(100, w - ins.left - ins.right);
    const fh = Math.max(100, h - ins.top - ins.bottom);
    const elev = THREE.MathUtils.degToRad(this.camMode === 'lesson' ? 40 : c.w > c.h * 2 ? 42 : 47);
    const target = new THREE.Vector3(0, 0, 0.15);
    const corners = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corners.push(new THREE.Vector3((x * c.w) / 2, 0, (z * c.h) / 2), new THREE.Vector3((x * c.w) / 2, z < 0 ? 1.5 : 0.9, (z * c.h) / 2));
      corners.push(new THREE.Vector3((x * (c.w + 0.8)) / 2, -BOOK - COVER, (z * (c.h + 0.8)) / 2));
    }
    // fit into a camera with the free area's aspect ratio, then shift the view into that area
    const probe = cam.clone();
    probe.fov = 30;
    probe.aspect = fw / fh;
    probe.clearViewOffset();
    probe.updateProjectionMatrix();
    let lo = 3;
    let hi = 200;
    for (let i = 0; i < 32; i++) {
      const dist = (lo + hi) / 2;
      probe.position.set(target.x, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * dist);
      probe.lookAt(target);
      probe.updateMatrixWorld();
      const fits = corners.every((p) => {
        const v = p.clone().project(probe);
        return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.92;
      });
      if (fits) hi = dist;
      else lo = dist;
    }
    // the camera renders the full canvas but only fw x fh of it is "ours": scale the distance so
    // the course has the same size, then offset the view so it lands in the free area
    this.camHome = { dist: hi, elev, target, fw, fh };
  }

  placeCamera(t, dt) {
    if (!this.camHome) return;
    const { dist, elev, target, fw, fh } = this.camHome;
    const { w, h } = this.size;
    let az = Math.sin(t * 0.11) * 0.03;
    if (this.idle) az = Math.sin(t * 0.06) * 0.13; // while everyone programs, the camera drifts slowly
    let d = dist;
    let tgt = target.clone();
    let el = elev;
    if (this.camMode === 'orbit') {
      az = Math.sin(t * 0.07) * 0.28;
      d = dist * 1.02;
    }
    if (this.camMode === 'lesson' && this.shotSpec) {
      const s = this.shotSpec;
      tgt = new THREE.Vector3(s.x ?? 0, 0, s.z ?? 0);
      d = dist * (s.zoom ?? 1);
      az = (s.az ?? 0) + Math.sin(t * 0.1) * 0.04;
      el = elev + (s.el ?? 0);
    }
    if (this.attention && this.attention.until > t && this.camMode === 'race') {
      tgt.lerp(this.attention.at, 0.22);
      d *= 0.93;
    }
    if (this.focusOn) {
      const b = this.bots.get(this.focusOn);
      if (b) {
        tgt = b.fig.group.position.clone().setY(0.6);
        d = Math.min(dist * (this.camMode === 'lesson' ? 0.72 : 0.55), 12);
        el = elev - 0.1;
        az = Math.sin(t * 0.2) * 0.3;
      }
    }
    const k = 1 - Math.exp(-dt * 2.2);
    if (!this.camCur) this.camCur = { az, d, tgt: tgt.clone(), el };
    const cc = this.camCur;
    cc.az += (az - cc.az) * k;
    cc.d += (d - cc.d) * k;
    cc.el += (el - cc.el) * k;
    cc.tgt.lerp(tgt, k);
    // shake (falls, big hits)
    let sx = 0;
    let sy = 0;
    if (this.shakeUntil > t) {
      const a = (this.shakeUntil - t) * 0.12;
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    const cam = this.camera;
    // the course was fitted for an fw x fh view: use that field of view vertically, and offset the
    // full-size render so the free area is centered on the course
    // the free area eases to its new size when the HUD changes (setup panel, rail)
    if (!this.viewIns) this.viewIns = { ...this.insets };
    const vi = this.viewIns;
    for (const key of ['top', 'bottom', 'left', 'right']) vi[key] += (this.insets[key] - vi[key]) * k;
    const ins = vi;
    const fov = 30;
    const scale = h / Math.max(100, h - vi.top - vi.bottom);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * scale));
    if (Math.abs(cam.fov - vfov) > 0.001) {
      cam.fov = vfov;
      cam.updateProjectionMatrix();
    }
    const offX = (ins.left - ins.right) / 2;
    const offY = (ins.top - ins.bottom) / 2;
    if (Math.abs(offX) > 0.5 || Math.abs(offY) > 0.5) cam.setViewOffset(w, h, -offX, -offY, w, h);
    else if (cam.view?.enabled) cam.clearViewOffset();
    cam.position.set(
      cc.tgt.x + Math.sin(cc.az) * Math.cos(cc.el) * cc.d + sx,
      cc.tgt.y + Math.sin(cc.el) * cc.d + sy,
      cc.tgt.z + Math.cos(cc.az) * Math.cos(cc.el) * cc.d,
    );
    cam.lookAt(cc.tgt.x + sx, cc.tgt.y + sy, cc.tgt.z);
    this.camAz = cc.az;
    // keep the skyline behind, following the camera sideways a little (parallax)
    if (this.layers) this.sky.position.x = cc.tgt.x * 0.6;
  }

  /** The lobby's lessons frame part of the page: { x, z, zoom, az, el }. */
  shot(spec) {
    this.shotSpec = spec;
  }

  // ----- robots -----

  /** Make sure every robot exists and stands where the view says (unless it's mid-animation). */
  syncRobots(list) {
    const seen = new Set();
    for (const r of list) {
      if (r.x == null) continue;
      seen.add(r.id);
      let b = this.bots.get(r.id);
      if (!b) {
        b = this.addBot(r);
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.visible = r.on !== false;
      }
      b.target = r;
      b.size = r.scale ?? 1;
      b.fig.setColor(r.color, r.avatar);
      b.fig.setMood(r.away ? 'sleep' : r.mood);
      b.fig.setName(r.name);
      if (b.busyUntil > this.time) continue;
      if (r.on === false) {
        b.visible = false;
        continue;
      }
      if (!b.visible) {
        b.visible = true;
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.pop = this.time;
      }
      if (b.x !== r.x || b.y !== r.y) this.tween(b, [[b.x, b.y], [r.x, r.y]], 0.4);
      const want = -r.d * (Math.PI / 2);
      const diff = wrap(want - b.rot);
      if (Math.abs(diff) > 0.01) this.turnTo(b, b.rot + diff, 0.4);
    }
    for (const [id, b] of this.bots) {
      if (!seen.has(id)) {
        this.scene.remove(b.fig.group);
        b.fig.dispose();
        this.bots.delete(id);
        this.statuses.delete(id);
      }
    }
  }

  addBot(r) {
    const fig = makeStandee(r);
    this.scene.add(fig.group);
    const b = { id: r.id, fig, x: r.x, y: r.y, rot: 0, visible: true, busyUntil: 0, anims: [], pop: this.time + 0.1, seed: Math.random() * 10, bubble: null, bubbleKey: null };
    this.bots.set(r.id, b);
    return b;
  }

  /** Over each robot: thinking dots, a check when it's locked in, or what it's deciding. */
  setStatus(map) {
    this.statuses = new Map(Object.entries(map ?? {}));
  }

  showNames(on) {
    this.namesOn = !!on;
  }

  tween(b, path, dur, delay = 0) {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'move', t0, dur, path });
  }

  turnTo(b, to, dur, delay = 0) {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'turn', t0, dur, from: null, to });
  }

  // ----- a beat of the Activation Phase -----

  playBeat(beat, robots) {
    const byId = new Map(robots.map((r) => [r.id, r]));
    const moveEnd = new Map();
    const what = beat.what;
    const STEP = 0.33;
    // who moved where (to spot pushes)
    const moves = beat.fx.filter((f) => f.k === 'move' && f.path.length > 1);
    for (const f of beat.fx) {
      const b = this.bots.get(f.id ?? f.src);
      switch (f.k) {
        case 'move': {
          if (!b) break;
          if (f.path.length < 2) {
            this.bump(b);
            break;
          }
          const dur = Math.max(0.2, (f.path.length - 1) * STEP);
          b.visible = true;
          b.x = f.path[0][0];
          b.y = f.path[0][1];
          const belt = what && (what.k === 'belt' || what.k === 'push');
          this.tween(b, f.path, dur);
          b.anims[b.anims.length - 1].slide = belt;
          moveEnd.set(b.id, dur);
          if (belt) sfx.slide(0, what.fast);
          else for (let i = 1; i < f.path.length; i++) sfx.step(i * STEP * 0.95 - 0.05);
          break;
        }
        case 'turn':
          if (b) {
            this.turnTo(b, b.rot - f.by * (Math.PI / 2), 0.5, 0);
            sfx.turn();
          }
          break;
        case 'fall':
          if (b) this.fall(b, f, moveEnd.get(b.id) ?? 0);
          break;
        case 'reboot':
          if (b) {
            b.visible = true;
            b.x = f.x;
            b.y = f.y;
            b.rot = -(byId.get(b.id)?.d ?? 0) * (Math.PI / 2);
            b.pop = this.time;
            b.busyUntil = this.time + 0.7;
            this.ring(this.pos(f.x, f.y), PAL.sky, 0.9);
            sfx.reboot();
          }
          break;
        case 'beam':
          this.beam(f, b);
          break;
        case 'dmg':
          if (b) {
            const n = Math.min(4, (f.sp ?? 0) + (f.hw ?? 0));
            this.cardsOut(b, [...Array(Math.min(4, f.sp ?? 0)).fill('sp'), ...Array(Math.min(2, f.hw ?? 0)).fill('h01')].slice(0, Math.max(1, n)), 0.15);
            b.hurt = this.time;
            sfx.hit(0.05);
          }
          break;
        case 'en':
          if (b) {
            this.float(b.fig.group.position, `+${f.n}`, PAL.gold, 0, '⚡');
            sfx.energy();
          }
          break;
        case 'cp':
          if (b) {
            this.confetti(b.fig.group.position, [PAL.gold, '#fffaf0', b.fig.color, PAL.tomato], 70);
            const flag = this.flags.find((x) => x.n === f.n);
            if (flag) flag.flash = this.time;
            sfx.flag(f.n, 0.1);
          }
          break;
        case 'say':
          if (b) this.float(b.fig.group.position, f.text, PAL.ink);
          break;
        case 'play':
          if (b) {
            this.showCard(b, f.cards);
            sfx.card();
            this.attention = { at: b.fig.group.position.clone(), until: this.time + 1.4 };
          }
          break;
        case 'replace':
          if (b) this.showCard(b, [f.from, f.to].filter(Boolean));
          break;
        case 'shield':
          if (b) {
            this.ring(b.fig.group.position, PAL.sky, 0.6, 0.5);
            sfx.shield();
          }
          break;
        case 'emp':
          if (b) this.ring(b.fig.group.position, '#9ff7ff', 1.6);
          break;
        case 'gear': {
          const g = this.gears.get(`${f.x},${f.y}`);
          if (g) g.kick = { t0: this.time, from: g.extra, to: g.extra - f.spin * (Math.PI / 2) };
          sfx.gear(f.spin);
          break;
        }
        case 'pusher': {
          const p = this.pushers.get(`${f.x},${f.y}`);
          if (p) p.kick = this.time;
          sfx.pusher();
          break;
        }
        case 'win':
          if (b) {
            this.focusOn = b.id;
            for (let i = 0; i < 5; i++) {
              this.later(i * 0.45, () => this.confetti(b.fig.group.position, [PAL.gold, '#fffaf0', PAL.tomato, PAL.sky, PAL.leaf, b.fig.color], 110, 1.4));
            }
            sfx.win();
          }
          break;
      }
    }
    // a robot shoving another: a paper burst where they meet
    if (what?.k === 'card' && moves.length > 1) {
      const actor = moves.find((m) => m.id === what.id);
      for (const m of moves) {
        if (m === actor || !actor) continue;
        const [x0, y0] = m.path[0];
        const i = actor.path.findIndex(([x, y]) => Math.abs(x - x0) + Math.abs(y - y0) === 1);
        const delay = Math.max(0, i) * STEP + STEP * 0.5;
        const at = this.pos(x0, y0).add(this.pos(actor.path[Math.max(0, i)][0], actor.path[Math.max(0, i)][1])).multiplyScalar(0.5);
        this.later(delay, () => {
          this.burst(at.setY(0.45), '#fffaf0', 0.7);
          sfx.bump();
        });
      }
    }
    // board elements light up when they run
    if (what?.k === 'belt') for (const bm of this.beltMats ?? []) if (bm.fast === !!what.fast || !what.fast) bm.glow = this.time;
  }

  later(sec, fn) {
    this.effects.push({ t0: this.time + sec, dur: 0.001, update: () => {}, end: fn });
  }

  /** The card a robot is playing, standing over its head for a moment. */
  showCard(b, types) {
    const W = 120;
    const H = 168;
    const gap = 16;
    const cv = canvas(types.length * W + (types.length - 1) * gap + 20, H + 24);
    const g = cv.getContext('2d');
    types.forEach((t, i) => drawCard(g, t, 10 + i * (W + gap), 6, W, H));
    const sp = this.sprite(cv, 1.25);
    sp.center.set(0.5, 0);
    this.effects.push({
      t0: this.time,
      dur: 1.35,
      update: (k) => {
        sp.visible = true;
        const p = b.fig.group.position;
        sp.position.set(p.x, p.y + STANDEE_H + 0.15 + easeOut(Math.min(1, k * 5)) * 0.12, p.z);
        sp.material.opacity = k < 0.82 ? Math.min(1, k * 7) : 1 - (k - 0.82) / 0.18;
        const s = 0.85 + 0.15 * back(Math.min(1, k * 5));
        sp.scale.set(sp.userData.w * s, sp.userData.h * s, 1);
      },
      end: () => this.dropSprite(sp),
    });
  }

  /** Damage cards popping out of a robot. */
  cardsOut(b, types, delay = 0) {
    types.forEach((t, i) => {
      const cv = canvas(140, 192);
      drawCard(cv.getContext('2d'), t, 10, 8, 120, 168);
      const sp = this.sprite(cv, 0.6);
      const dir = (i - (types.length - 1) / 2) * 0.35;
      this.effects.push({
        t0: this.time + delay + i * 0.08,
        dur: 1.2,
        update: (k) => {
          sp.visible = true;
          const p = b.fig.group.position;
          sp.position.set(p.x + dir * easeOut(k), p.y + 0.6 + Math.sin(k * Math.PI) * 0.6 + k * 0.3, p.z + 0.1);
          sp.material.rotation = dir * k * 0.8;
          sp.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        },
        end: () => this.dropSprite(sp),
      });
    });
  }

  sprite(cv, height) {
    const t = tex(cv, { aniso: 4 });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
    sp.userData.w = (height * cv.width) / cv.height;
    sp.userData.h = height;
    sp.scale.set(sp.userData.w, height, 1);
    sp.renderOrder = 20;
    sp.visible = false;
    this.fxGroup.add(sp);
    return sp;
  }

  dropSprite(sp) {
    this.fxGroup.remove(sp);
    sp.material.map.dispose();
    sp.material.dispose();
  }

  bump(b) {
    b.anims.push({ kind: 'bump', t0: this.time, dur: 0.3 });
    sfx.bump(0.05);
  }

  fall(b, f, delay) {
    b.busyUntil = this.time + delay + 1.25;
    b.anims.push({ kind: 'fall', t0: this.time + delay, dur: 1.1, edge: f.edge, dir: f.edge ? edgeDir(this.course, f.x, f.y) : null });
    sfx.fall(delay);
    this.later(delay + 0.75, () => {
      this.shakeUntil = this.time + 0.35;
    });
  }

  beam(f, shooter) {
    let from;
    if (f.board) {
      const side = turn(f.d, 2);
      from = this.pos(f.x0, f.y0).add(new THREE.Vector3(DX[side] * 0.3, 0.2, DY[side] * 0.3));
    } else if (shooter) {
      from = shooter.fig.group.position.clone().setY(0.42);
      from.x += DX[f.d] * 0.2;
      from.z += DY[f.d] * 0.2;
      shooter.recoil = this.time;
    } else from = this.pos(f.x0, f.y0).setY(0.42);
    const end = this.pos(f.x1, f.y1);
    const hit = f.hit?.length;
    if (!hit) end.add(new THREE.Vector3(DX[f.d] * 0.47, 0, DY[f.d] * 0.47));
    end.y = from.y;
    if (hit) end.add(new THREE.Vector3(-DX[f.d] * 0.12, 0, -DY[f.d] * 0.12));
    const special = f.special;
    const color = f.board ? PAL.tomato : special === 'tractor-beam' || special === 'pressor-beam' ? '#7cc7ff' : special === 'scrambler' ? '#d57bff' : special === 'mini-howitzer' ? '#ffa040' : this.bots.get(f.src)?.fig.color ?? PAL.tomato;
    const len = from.distanceTo(end);
    const mid = from.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(from).normalize();
    const group = new THREE.Group();
    const thick = 0.03 + 0.014 * (f.n ?? 1);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.9, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.4, thick * 0.4, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(thick * 3, thick * 3, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(glow, outer, core);
    group.position.copy(mid);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.scale.y = 0.01;
    this.fxGroup.add(group);
    const grow = 0.12;
    this.effects.push({
      t0: this.time,
      dur: 0.9,
      update: (k) => {
        const t = k * 0.9;
        const g = clamp01(t / grow);
        // grow from the muzzle
        group.scale.set(1 - clamp01((t - 0.5) / 0.4) * 0.7, Math.max(0.01, g), 1 - clamp01((t - 0.5) / 0.4) * 0.7);
        group.position.copy(from).addScaledVector(dir, (len * g) / 2);
        const fade = 1 - clamp01((t - 0.55) / 0.35);
        outer.material.opacity = 0.9 * fade;
        core.material.opacity = fade;
        glow.material.opacity = 0.25 * fade * (0.8 + Math.random() * 0.2);
      },
      end: () => {
        this.fxGroup.remove(group);
        for (const m of [outer, core, glow]) {
          m.geometry.dispose();
          m.material.dispose();
        }
      },
    });
    sfx.laser(0, (f.n ?? 1) > 1);
    if (hit) {
      this.later(grow, () => {
        this.burst(end.clone(), PAL.gold, 0.55);
        this.sparks(end.clone(), color, 18);
      });
    }
  }

  float(at, text, color = PAL.ink, delay = 0, icon = '') {
    if (!text) return;
    const cv = floatCanvas(icon ? `${icon}${text}` : text, color);
    const sp = this.sprite(cv, 0.42);
    const base = at.clone();
    base.y = Math.max(base.y, 0) + STANDEE_H + 0.1;
    this.effects.push({
      t0: this.time + delay,
      dur: 1.6,
      update: (k) => {
        sp.visible = true;
        sp.position.set(base.x, base.y + easeOut(k) * 0.6, base.z);
        sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      },
      end: () => this.dropSprite(sp),
    });
  }

  burst(at, color, size = 0.6) {
    const key = `burst${color}`;
    if (!this.texCache.has(key)) this.texCache.set(key, burstTex(color));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texCache.get(key), transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 19;
    sp.position.copy(at);
    this.fxGroup.add(sp);
    const spin = rand(-1, 1);
    this.effects.push({
      t0: this.time,
      dur: 0.45,
      update: (k) => {
        const s = size * (0.4 + back(Math.min(1, k * 2.5)) * 0.6) * (1 - Math.max(0, k - 0.6) * 0.8);
        sp.scale.set(s, s, 1);
        sp.material.rotation = spin * k;
        sp.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      },
      end: () => {
        this.fxGroup.remove(sp);
        sp.material.dispose();
      },
    });
  }

  ring(at, color, size, height = 0.03) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(height);
    this.fxGroup.add(m);
    this.effects.push({
      t0: this.time,
      dur: 0.9,
      update: (k) => {
        m.scale.setScalar(0.5 + easeOut(k) * size * 2);
        m.material.opacity = 1 - k;
      },
      end: () => {
        this.fxGroup.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      },
    });
  }

  sparks(at, color, n) {
    this.confetti(at, [color, '#fffaf0'], n, 0.5, { speed: 2.4, up: 1.6, gravity: 7, size: 0.05, dur: 0.6 });
  }

  /** Paper confetti: little rectangles that flutter down. */
  confetti(at, colors, n, power = 1, o = {}) {
    const { speed = 2.2 * power, up = 4.2 * power, gravity = 5, size = 0.085, dur = 2.2 } = o;
    const geo = new THREE.PlaneGeometry(size, size * 1.6);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const parts = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      tmp.set(colors[i % colors.length]);
      inst.setColorAt(i, tmp);
      const a = rand(0, TAU);
      const sp = rand(0.3, 1) * speed;
      parts.push({
        p: new THREE.Vector3(at.x, Math.max(0.3, at.y + 0.5), at.z),
        v: new THREE.Vector3(Math.cos(a) * sp, rand(0.5, 1) * up, Math.sin(a) * sp),
        r: new THREE.Euler(rand(0, TAU), rand(0, TAU), rand(0, TAU)),
        w: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        flutter: rand(0, TAU),
      });
    }
    inst.renderOrder = 18;
    this.fxGroup.add(inst);
    let last = this.time;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const dt = Math.min(0.05, this.time - last);
        last = this.time;
        parts.forEach((pt, i) => {
          pt.v.y -= gravity * dt;
          pt.v.multiplyScalar(1 - dt * 1.6); // air drag: paper floats
          if (pt.v.y < -1.2) pt.v.y = -1.2;
          pt.p.addScaledVector(pt.v, dt);
          pt.p.x += Math.sin(this.time * 6 + pt.flutter) * dt * 0.4;
          if (pt.p.y < 0.02) {
            pt.p.y = 0.02;
            pt.v.set(0, 0, 0);
          }
          pt.r.x += pt.w.x * dt;
          pt.r.y += pt.w.y * dt;
          pt.r.z += pt.w.z * dt;
          q.setFromEuler(pt.r);
          m4.compose(pt.p, q, one);
          inst.setMatrixAt(i, m4);
        });
        inst.instanceMatrix.needsUpdate = true;
        mat.opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      },
      end: () => {
        this.fxGroup.remove(inst);
        geo.dispose();
        mat.dispose();
        inst.dispose();
      },
    });
  }

  /** The free start spaces glow (start phase). picks: { n: color } */
  showStarts(picks) {
    if (!this.course) return;
    const key = JSON.stringify(picks);
    if (this.startKey === key) return;
    this.startKey = key;
    for (const m of this.startTags ?? []) {
      this.fxGroup.remove(m);
      m.geometry.dispose();
    }
    this.startTags = [];
    if (!picks) return;
    this.startMat ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.mustard), transparent: true, depthWrite: false });
    for (const st of this.course.starts) {
      if (picks[st.n]) continue;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 40), this.startMat);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(this.pos(st.x, st.y)).setY(0.006);
      m.userData.bob = st.n * 0.7;
      this.fxGroup.add(m);
      this.startTags.push(m);
    }
  }

  // ----- every frame -----

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    const t = this.time;
    this.adapt(dt);

    for (const p of this.popups) {
      const k = clamp01((t - p.t0) / 0.6);
      if (k <= 0) p.hinge.rotation.x = -Math.PI / 2;
      else if (k < 1 || p.hinge.rotation.x !== 0) p.hinge.rotation.x = -Math.PI / 2 * (1 - back(k, 2.6));
      if (k >= 1) p.hinge.rotation.x = 0;
    }
    for (const bm of this.beltMats ?? []) {
      const glow = Math.max(0, 1 - (t - bm.glow) / 0.8);
      bm.tex.offset.y = (bm.tex.offset.y - dt * bm.speed * (1 + glow * 2)) % 1;
      bm.mat.emissiveIntensity = 0.12 + glow * 0.5;
    }
    for (const g of this.gears.values()) {
      if (g.kick) {
        const k = Math.min(1, (t - g.kick.t0) / 0.55);
        g.extra = g.kick.from + (g.kick.to - g.kick.from) * back(k, 1.6);
        if (k >= 1) {
          g.extra = g.kick.to;
          g.kick = null;
        }
      }
      g.mesh.rotation.y = g.extra - g.spin * t * 0.12;
    }
    for (const p of this.pushers.values()) {
      const k = (t - p.kick) / 0.55;
      const out = k >= 0 && k < 1 ? Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.45) / 0.55) : 0;
      p.plate.position.z = 0.06 + out * 0.42;
      p.folds.children.forEach((f, i) => {
        f.position.z = 0.02 + (out * 0.42 * (i + 0.5)) / 4;
        f.rotation.x = (i % 2 ? 1 : -1) * (1 - out) * 0.9;
      });
    }
    for (const f of this.flags) {
      const arr = f.geo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = f.base[i];
        arr[i + 2] = f.base[i + 2] + Math.sin(x * 7 - t * 3 + f.n) * 0.035 * x;
      }
      f.geo.attributes.position.needsUpdate = true;
      const flash = Math.max(0, 1 - (t - f.flash) / 1.2);
      f.g.rotation.y = flash > 0 ? (1 - flash) * TAU * 2 : (this.camAz ?? 0);
      f.flag.position.y = 1.18 + Math.sin(flash * Math.PI) * 0.2;
    }
    for (const s of this.startTags ?? []) s.scale.setScalar(1 + Math.sin(t * 3 + s.userData.bob) * 0.08);
    if (this.startMat) this.startMat.opacity = 0.65 + Math.sin(t * 3) * 0.3;

    for (const b of this.bots.values()) this.animateBot(b, t);
    // effects can start other effects when they end (a laser's spark): those join the next frame
    const running = this.effects;
    this.effects = [];
    const keep = [];
    for (const e of running) {
      if (t < e.t0) {
        keep.push(e);
        continue;
      }
      const k = Math.min(1, (t - e.t0) / e.dur);
      e.update(k);
      if (k >= 1) e.end?.();
      else keep.push(e);
    }
    this.effects = keep.concat(this.effects);

    this.sky.visible = this.camMode !== 'race';
    this.placeCamera(t, dt);
    this.renderer.render(this.scene, this.camera);
  }

  animateBot(b, t) {
    let px = b.x;
    let py = b.y;
    let rot = b.rot;
    let lift = 0;
    let tilt = 0; // lean (toward the camera is negative)
    let roll = 0;
    let scale = 1;
    let sink = 0;
    let visible = b.visible;
    b.anims = b.anims.filter((an) => {
      if (t < an.t0) return true;
      const k = Math.min(1, (t - an.t0) / an.dur);
      if (an.kind === 'move') {
        const segs = an.path.length - 1;
        const pos = (an.slide ? ease(k) : k) * segs;
        const i = Math.min(segs - 1, Math.floor(pos));
        const f = pos - i;
        const [x0, y0] = an.path[i];
        const [x1, y1] = an.path[i + 1];
        const e = an.slide ? f : ease(f);
        px = x0 + (x1 - x0) * e;
        py = y0 + (y1 - y0) * e;
        if (!an.slide) lift = Math.sin(f * Math.PI) * 0.14;
        if (k >= 1) {
          b.x = an.path[segs][0];
          b.y = an.path[segs][1];
          px = b.x;
          py = b.y;
        }
      } else if (an.kind === 'turn') {
        an.from ??= b.rot;
        rot = an.from + (an.to - an.from) * back(k, 1.2);
        lift = Math.max(lift, Math.sin(k * Math.PI) * 0.06);
        if (k >= 1) b.rot = an.to;
      } else if (an.kind === 'bump') {
        roll = Math.sin(k * Math.PI * 3) * 0.12 * (1 - k);
      } else if (an.kind === 'fall') {
        visible = true;
        if (an.edge) {
          // tip over the edge and drop
          const d = an.dir ?? 2;
          px += DX[d] * easeOut(Math.min(1, k * 2)) * 0.5;
          py += DY[d] * easeOut(Math.min(1, k * 2)) * 0.5;
          lift = -k * k * 2.2;
          roll = (DX[d] || 1) * k * 1.6;
          tilt = -DY[d] * k * 1.4;
        } else {
          // drop down the hole, spinning
          sink = easeOut(Math.min(1, k * 1.3)) * 0.1;
          lift = -k * k * 0.9 - sink;
          rot += k * 5;
          scale = 1 - k * 0.45;
        }
        if (k >= 1) {
          b.visible = false;
          visible = false;
        }
      }
      return k < 1;
    });
    // the winner turns to the room and jumps for joy
    if (this.focusOn === b.id && !b.anims.length) {
      const az0 = this.camAz ?? 0;
      b.cheer = (b.cheer ?? 0) + (1 - (b.cheer ?? 0)) * 0.05;
      rot = rot + wrap(az0 + Math.PI - rot) * b.cheer;
      lift = Math.abs(Math.sin(t * 5)) * 0.3 * b.cheer;
    } else b.cheer = 0;
    const fig = b.fig;
    fig.group.visible = visible;
    if (!visible) {
      if (b.bubble) b.bubble.visible = false;
      return;
    }
    const p = this.pos(px, py);
    fig.group.position.set(p.x, lift, p.z);
    fig.group.scale.setScalar(b.size ?? 1);
    fig.base.rotation.y = rot;
    // the cutout faces the camera, turned toward where the robot faces; its back shows facing away
    const az = this.camAz ?? 0;
    const a = wrap(rot - az - Math.PI);
    const abs = Math.abs(a);
    const side = 0.62; // how far a robot facing sideways turns its cutout (radians)
    const yaw = abs <= Math.PI / 2 ? (side * a) / (Math.PI / 2) : Math.sign(a) * (side + ((abs - Math.PI / 2) / (Math.PI / 2)) * (Math.PI - side));
    // pop up (spawn / reboot) like the page pieces
    const pk = clamp01((t - b.pop) / 0.6);
    const popTilt = -Math.PI / 2 * (1 - back(pk, 2.4));
    const breathe = Math.sin(t * 2.2 + b.seed) * 0.02;
    fig.card.rotation.order = 'YXZ';
    fig.card.rotation.set(popTilt + tilt + breathe * 0.5, az + yaw, roll);
    const recoil = b.recoil ? Math.max(0, 1 - (t - b.recoil) / 0.25) : 0;
    const hurt = b.hurt ? Math.max(0, 1 - (t - b.hurt) / 0.5) : 0;
    fig.card.position.x = Math.sin(t * 60) * hurt * 0.04;
    fig.card.position.z = -recoil * 0.05;
    const sq = 1 + (lift > 0.01 ? lift * 0.6 : 0);
    fig.card.scale.set(scale / Math.sqrt(sq), scale * sq, scale);
    fig.base.scale.setScalar(scale);
    if (fig.tag) fig.tag.visible = this.namesOn && pk >= 1;
    this.updateBubble(b, t);
  }

  updateBubble(b, t) {
    const st = this.statuses.get(b.id);
    const key = st ? (typeof st === 'string' ? st : `i:${st.icon}`) : null;
    if (key !== b.bubbleKey) {
      b.bubbleKey = key;
      if (b.bubble) {
        this.dropSprite(b.bubble);
        b.bubble = null;
      }
      if (key) {
        const cv = typeof st === 'string' ? bubbleCanvas(st) : bubbleCanvas('icon', st.icon);
        b.bubble = this.sprite(cv, typeof st === 'string' ? 0.62 : 0.95);
        b.bubble.center.set(0.5, 0);
        b.bubble.material.depthTest = true;
        b.bubbleT = t;
        if (st === 'ready') sfx.lock();
        if (typeof st === 'object') sfx.ask();
      }
    }
    if (!b.bubble) return;
    const p = b.fig.group.position;
    const k = clamp01((t - b.bubbleT) / 0.4);
    const s = back(k, 2.5);
    const bob = Math.sin(t * 3 + b.seed) * 0.03;
    b.bubble.visible = true;
    b.bubble.position.set(p.x + 0.28, p.y + STANDEE_H + 0.05 + bob, p.z);
    b.bubble.scale.set(b.bubble.userData.w * s, b.bubble.userData.h * s, 1);
    if (b.bubbleKey === 'think') b.bubble.material.opacity = 0.75 + Math.sin(t * 4 + b.seed) * 0.25;
  }

  /** If the computer can't keep up, use fewer pixels, then simpler shadows, then none. */
  adapt(dt) {
    if (document.hidden) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1 / 30) {
      if (this.pixelRatio > 1) {
        this.pixelRatio = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
      } else if (this.key.shadow.mapSize.x > 1024) {
        this.key.shadow.mapSize.set(1024, 1024);
        this.key.shadow.map?.dispose();
        this.key.shadow.map = null;
      } else if (this.renderer.shadowMap.type !== THREE.BasicShadowMap && this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.needsUpdate = true;
        this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
      } else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
      } else if (this.pixelRatio > 0.75) {
        this.pixelRatio = 0.75;
        this.renderer.setPixelRatio(0.75);
        this.resize();
      }
    }
  }
}

/** Which way is off the board from x,y (for a robot driving off the edge). */
function edgeDir(c, x, y) {
  if (x < 0) return 3;
  if (x >= c.w) return 1;
  if (y < 0) return 0;
  if (y >= c.h) return 2;
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h || !c.cells[ny * c.w + nx]) return d;
  }
  return 2;
}

function gearMesh(mat, spin, brass, arrowMat) {
  const shape = new THREE.Shape();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const r = i % 2 ? 0.35 : 0.43;
    const pt = (a) => [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) shape.moveTo(...pt(a0));
    else shape.lineTo(...pt(a0));
    shape.lineTo(...pt(a1));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  // a printed arrow showing which way it turns
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 4, 28, Math.PI * 1.25), arrowMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.y = 0.04;
  arc.scale.y = 1;
  g.add(arc);
  const tipShape = new THREE.Shape();
  tipShape.moveTo(-0.08, 0);
  tipShape.lineTo(0.08, 0);
  tipShape.lineTo(0, 0.12);
  tipShape.closePath();
  const tipGeo = new THREE.ShapeGeometry(tipShape);
  tipGeo.rotateX(-Math.PI / 2);
  const tip = new THREE.Mesh(tipGeo, arrowMat);
  const end = Math.PI * 1.25;
  tip.position.set(Math.cos(end) * 0.22, 0.041, -Math.sin(end) * 0.22);
  tip.rotation.y = end + Math.PI;
  g.add(tip);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8, 0, TAU, 0, Math.PI / 2), brass);
  pin.position.y = 0.035;
  pin.castShadow = true;
  g.add(pin);
  if (spin < 0) g.scale.x = -1;
  return g;
}
