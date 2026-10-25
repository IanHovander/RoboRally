// The big screen's world: an old locomotive works in the last hour of sun. The course is a raised steel
// test deck in the middle of the hall; low sun pours through tall windows on the left, and each round
// it sinks a little further, until the hall lamps come on for the finish. Everything is lit, not painted:
// real light, real-ish materials, haze. host.js and lobby.js tell this file what to show.
import * as THREE from './lib/three.module.min.js';
import { EffectComposer } from './lib/effect-composer.js';
import { RenderPass } from './lib/render-pass.js';
import { UnrealBloomPass } from './lib/unreal-bloom-pass.js';
import { OutputPass } from './lib/output-pass.js';
import { ShaderPass } from './lib/shader-pass.js';
import { DX, DY, turn, getCourse, beltInputs, beamPath, wallEdges } from './board.js';
import { makeRobot } from './bots3d.js';
import { modelOf, paint } from './look.js';
import { cardFace } from './icons.js';

const TAU = Math.PI * 2;
const BOT_SCALE = 1.42;
const DECK_H = 0.7; // the test deck stands this high above the hall floor
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const smooth = (a, b, t) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const rand = (a, b) => a + Math.random() * (b - a);
// ?fixed keeps full quality even on a slow machine (for screenshots)
const FIXED_QUALITY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fixed');
const FONT = (weight, px) => `${weight} ${px}px Inter, "Segoe UI", system-ui, sans-serif`;

// ---------- procedural textures ----------

let maxAniso = 4;
function tex(canvas, { repeat = false, color = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function speckle(g, x, y, w, h, n, light = 0.05, dark = 0.08, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rand(0, light)})` : `rgba(0,0,0,${rand(0, dark)})`;
    g.fillRect(x + Math.random() * w, y + Math.random() * h, rand(0.6, size), rand(0.6, size));
  }
}
function blot(g, cx, cy, r, color, alpha) {
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, color.replace('A', String(alpha)));
  grad.addColorStop(1, color.replace('A', '0'));
  g.fillStyle = grad;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function hazard(g, x, y, w, h, size, a = '#d6a422', b = '#191919') {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = a;
  g.fillRect(x, y, w, h);
  g.fillStyle = b;
  for (let i = -h - w; i < w + h; i += size * 2) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + size, y + h);
    g.lineTo(x + i + size + h, y);
    g.lineTo(x + i + h, y);
    g.fill();
  }
  g.restore();
}

/** Polished concrete for the hall floor: color + roughness. */
function concreteMaps() {
  const N = 1024;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  g.fillStyle = '#5c5750';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 60; i++) blot(g, rand(0, N), rand(0, N), rand(60, 260), Math.random() < 0.5 ? 'rgba(40,34,28,A)' : 'rgba(150,140,124,A)', rand(0.05, 0.16));
  speckle(g, 0, 0, N, N, 26000, 0.07, 0.1, 2.4);
  for (let i = 0; i < 14; i++) blot(g, rand(0, N), rand(0, N), rand(18, 70), 'rgba(18,14,10,A)', rand(0.2, 0.45)); // oil
  // saw-cut joints
  g.strokeStyle = 'rgba(20,16,12,.55)';
  g.lineWidth = 2;
  for (const p of [0, N / 2]) {
    g.beginPath();
    g.moveTo(p + 1, 0);
    g.lineTo(p + 1, N);
    g.moveTo(0, p + 1);
    g.lineTo(N, p + 1);
    g.stroke();
  }
  // faint tyre arcs
  g.strokeStyle = 'rgba(15,12,10,.07)';
  for (let i = 0; i < 10; i++) {
    g.lineWidth = rand(6, 14);
    g.beginPath();
    g.arc(rand(0, N), rand(0, N), rand(150, 500), rand(0, TAU), rand(0, TAU));
    g.stroke();
  }
  const r = canvas(256, 256);
  const rg = r.getContext('2d');
  rg.fillStyle = '#5c5c5c';
  rg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) blot(rg, rand(0, 256), rand(0, 256), rand(10, 60), Math.random() < 0.6 ? 'rgba(20,20,20,A)' : 'rgba(230,230,230,A)', rand(0.2, 0.6));
  return { map: tex(c, { repeat: true }), rough: tex(r, { repeat: true, color: false }) };
}

/** Brick for the hall walls. */
function brickTex() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#3b2a22';
  g.fillRect(0, 0, 512, 512);
  const bw = 64;
  const bh = 22;
  for (let row = 0; row * bh < 512; row++) {
    for (let col = -1; col * bw < 512; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0);
      const tone = rand(0.75, 1.1);
      g.fillStyle = `rgb(${Math.round(118 * tone)},${Math.round(64 * tone)},${Math.round(46 * tone)})`;
      g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  speckle(g, 0, 0, 512, 512, 9000, 0.05, 0.12, 2);
  for (let i = 0; i < 18; i++) blot(g, rand(0, 512), rand(0, 512), rand(30, 120), 'rgba(10,8,6,A)', rand(0.15, 0.4));
  return tex(c, { repeat: true });
}

/** The test deck's surface: steel plates, one per space, plus everything painted on them. */
function deckMaps(course, S) {
  const W = course.w * S;
  const H = course.h * S;
  const col = canvas(W, H);
  const bmp = canvas(W, H);
  const rgh = canvas(W, H);
  const g = col.getContext('2d');
  const b = bmp.getContext('2d');
  const r = rgh.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, W, H);
  r.fillStyle = '#909090';
  r.fillRect(0, 0, W, H);

  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell) continue;
      const X = x * S;
      const Y = y * S;
      const dock = course.boards[cell.b]?.dock;
      if (dock) treadPlate(g, b, r, X, Y, S);
      else steelPlate(g, b, r, X, Y, S, (x + y) % 2);
      const cx = X + S / 2;
      const cy = Y + S / 2;
      if (cell.k === 'pit') {
        // a hazard-striped rim, then the hole itself (transparent: the 3D well shows through)
        const m = S * 0.13;
        hazard(g, X + 2, Y + 2, S - 4, S - 4, S * 0.09);
        g.clearRect(X + m, Y + m, S - 2 * m, S - 2 * m);
        b.fillStyle = '#9a9a9a';
        b.fillRect(X + 2, Y + 2, S - 4, S - 4);
        r.fillStyle = '#b0b0b0';
        r.fillRect(X + 2, Y + 2, S - 4, S - 4);
      } else if (cell.k === 'belt' || cell.k === 'gear') {
        g.fillStyle = '#26272a';
        g.fillRect(X + 3, Y + 3, S - 6, S - 6);
        b.fillStyle = '#404040';
        b.fillRect(X + 3, Y + 3, S - 6, S - 6);
      } else if (cell.k === 'battery') {
        paintRing(g, cx, cy, S * 0.36, S * 0.05, 'rgba(126,196,128,.9)');
        g.fillStyle = 'rgba(126,196,128,.85)';
        bolt(g, cx, cy, S * 0.22);
        r.fillStyle = '#b8b8b8';
        r.beginPath();
        r.arc(cx, cy, S * 0.4, 0, TAU);
        r.fill();
      } else if (cell.k === 'start') {
        bay(g, X, Y, S, cell.d ?? 0, cell.n);
      }
    }
  }
  // scorch marks along the wall lasers' paths
  for (const L of course.lasers) {
    const path = beamPath(course, L.x, L.y, L.d);
    const a = path[0];
    const z = path[path.length - 1];
    g.strokeStyle = 'rgba(30,14,8,.28)';
    g.lineWidth = S * 0.06 * L.n;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo((a.x + 0.5) * S, (a.y + 0.5) * S);
    g.lineTo((z.x + 0.5 + DX[L.d] * 0.4) * S, (z.y + 0.5 + DY[L.d] * 0.4) * S);
    g.stroke();
  }
  // reboot tokens: a painted circle with an arrow showing which way you'll face
  for (const bd of course.boards) {
    if (!bd.reboot) continue;
    const cx = (bd.reboot.x + 0.5) * S;
    const cy = (bd.reboot.y + 0.5) * S;
    const d = bd.reboot.d;
    g.save();
    g.globalAlpha = 0.9;
    paintRing(g, cx, cy, S * 0.3, S * 0.06, '#9cc2df', 0.5, TAU - 0.5);
    g.fillStyle = '#9cc2df';
    g.beginPath();
    g.moveTo(cx + DX[d] * S * 0.47, cy + DY[d] * S * 0.47);
    g.lineTo(cx + DX[d] * S * 0.24 + DY[d] * S * 0.15, cy + DY[d] * S * 0.24 - DX[d] * S * 0.15);
    g.lineTo(cx + DX[d] * S * 0.24 - DY[d] * S * 0.15, cy + DY[d] * S * 0.24 + DX[d] * S * 0.15);
    g.fill();
    g.beginPath();
    g.arc(cx, cy, S * 0.07, 0, TAU);
    g.fill();
    g.restore();
  }
  return {
    map: tex(col),
    bump: tex(bmp, { color: false }),
    rough: tex(rgh, { color: false }),
  };
}

function paintRing(g, cx, cy, rad, w, color, a0 = 0, a1 = TAU) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.arc(cx, cy, rad, a0, a1);
  g.stroke();
}
function bolt(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx + s * 0.15, cy - s);
  g.lineTo(cx - s * 0.55, cy + s * 0.12);
  g.lineTo(cx - s * 0.02, cy + s * 0.12);
  g.lineTo(cx - s * 0.18, cy + s);
  g.lineTo(cx + s * 0.55, cy - s * 0.15);
  g.lineTo(cx + s * 0.02, cy - s * 0.15);
  g.closePath();
  g.fill();
}

function steelPlate(g, b, r, X, Y, S, alt) {
  const base = alt ? [158, 153, 143] : [146, 142, 133];
  const tone = rand(0.96, 1.04);
  g.fillStyle = `rgb(${base.map((v) => Math.round(v * tone)).join(',')})`;
  g.fillRect(X, Y, S, S);
  // brushed grain
  const horiz = Math.random() < 0.5;
  for (let i = 0; i < 26; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.04)';
    const p = rand(0, S);
    if (horiz) g.fillRect(X, Y + p, S, rand(0.5, 1.6));
    else g.fillRect(X + p, Y, rand(0.5, 1.6), S);
  }
  speckle(g, X, Y, S, S, 120, 0.05, 0.08, 1.8);
  // wear: a lighter middle where wheels pass, darker grime toward the seams
  blot(g, X + S / 2 + rand(-8, 8), Y + S / 2 + rand(-8, 8), S * 0.55, 'rgba(255,248,236,A)', 0.07);
  const edge = g.createLinearGradient(X, Y, X + S, Y + S);
  edge.addColorStop(0, 'rgba(30,22,16,.10)');
  edge.addColorStop(0.5, 'rgba(30,22,16,0)');
  edge.addColorStop(1, 'rgba(30,22,16,.12)');
  g.fillStyle = edge;
  g.fillRect(X, Y, S, S);
  if (Math.random() < 0.3) blot(g, X + rand(0.1, 0.9) * S, Y + rand(0.1, 0.9) * S, S * rand(0.08, 0.2), 'rgba(110,52,22,A)', 0.22); // rust bloom
  if (Math.random() < 0.25) {
    g.strokeStyle = 'rgba(20,16,12,.12)'; // a scuff
    g.lineWidth = rand(2, 5);
    g.beginPath();
    g.arc(X + rand(0, S), Y + rand(0, S), rand(S * 0.3, S), rand(0, TAU), rand(0, TAU));
    g.stroke();
  }
  // seams
  g.strokeStyle = 'rgba(18,14,12,.85)';
  g.lineWidth = Math.max(2, S * 0.025);
  g.strokeRect(X + 1, Y + 1, S - 2, S - 2);
  g.strokeStyle = 'rgba(255,250,240,.12)';
  g.lineWidth = 1;
  g.strokeRect(X + S * 0.025 + 1.5, Y + S * 0.025 + 1.5, S - S * 0.05 - 3, S - S * 0.05 - 3);
  b.fillStyle = '#2a2a2a';
  b.fillRect(X, Y, S, Math.max(2, S * 0.025));
  b.fillRect(X, Y, Math.max(2, S * 0.025), S);
  r.fillStyle = `rgb(${Math.round(rand(120, 150))},0,0)`;
  r.fillStyle = `#${Math.round(rand(118, 150)).toString(16).repeat(3)}`;
  r.fillRect(X + 2, Y + 2, S - 4, S - 4);
  // bolts in the corners
  for (const [u, v] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
    const bx = X + u * S;
    const by = Y + v * S;
    const br = S * 0.028;
    g.fillStyle = 'rgba(40,36,32,.8)';
    g.beginPath();
    g.arc(bx, by, br * 1.25, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(190,184,172,.9)';
    g.beginPath();
    g.arc(bx - br * 0.2, by - br * 0.2, br * 0.85, 0, TAU);
    g.fill();
    b.fillStyle = '#e0e0e0';
    b.beginPath();
    b.arc(bx, by, br, 0, TAU);
    b.fill();
  }
}

function treadPlate(g, b, r, X, Y, S) {
  g.fillStyle = '#6d7073';
  g.fillRect(X, Y, S, S);
  speckle(g, X, Y, S, S, 90, 0.06, 0.08, 1.6);
  const n = 6;
  const s = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = X + (i + 0.5) * s;
      const cy = Y + (j + 0.5) * s;
      const ang = (i + j) % 2 ? 0.78 : -0.78;
      for (const [ctx, color] of [[g, 'rgba(214,214,212,.30)'], [b, '#d8d8d8']]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.36, s * 0.09, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  blot(g, X + S / 2, Y + S / 2, S * 0.6, 'rgba(20,16,12,A)', 0.12);
  g.strokeStyle = 'rgba(14,12,10,.9)';
  g.lineWidth = Math.max(2, S * 0.022);
  g.strokeRect(X + 1, Y + 1, S - 2, S - 2);
  r.fillStyle = '#6a6a6a';
  r.fillRect(X, Y, S, S);
}

/** A painted start bay: three sides of a box, open where the robot faces, and its number. */
function bay(g, X, Y, S, d, n) {
  const m = S * 0.12;
  const paintC = 'rgba(236,230,216,.88)';
  g.save();
  g.translate(X + S / 2, Y + S / 2);
  g.rotate(d * (Math.PI / 2));
  g.strokeStyle = paintC;
  g.lineWidth = S * 0.045;
  g.lineCap = 'butt';
  const h = S / 2 - m;
  g.beginPath();
  g.moveTo(-h, -h * 0.55);
  g.lineTo(-h, h);
  g.lineTo(h, h);
  g.lineTo(h, -h * 0.55);
  g.stroke();
  g.restore();
  g.save();
  g.fillStyle = paintC;
  g.font = FONT(600, Math.round(S * 0.44));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), X + S / 2, Y + S / 2 + S * 0.03);
  // worn paint: scratch some of it back to steel
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${rand(0.1, 0.5)})`;
    g.fillRect(X + rand(0, S), Y + rand(0, S), rand(1, 6), rand(1, 3));
  }
  g.restore();
  // put steel back under the scratches
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#6d7073';
  g.fillRect(X, Y, S, S);
  g.restore();
}

function beltTex(color, fast) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#1d1e20';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fillRect(0, y, 128, 2);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, y + 2, 128, 1);
  }
  speckle(g, 0, 0, 128, 128, 300, 0.05, 0.1, 1.5);
  g.fillStyle = color;
  const arrows = fast ? 2 : 1;
  for (let i = 0; i < arrows; i++) {
    const y = (i + 0.5) * (128 / arrows) + 12;
    const s = fast ? 0.8 : 1;
    g.beginPath();
    g.moveTo(64, y - 30 * s);
    g.lineTo(64 + 34 * s, y + 6 * s);
    g.lineTo(64 + 20 * s, y + 6 * s);
    g.lineTo(64, y - 14 * s);
    g.lineTo(64 - 20 * s, y + 6 * s);
    g.lineTo(64 - 34 * s, y + 6 * s);
    g.closePath();
    g.fill();
  }
  return tex(c, { repeat: true });
}

function curveTex(color, fromLeft) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#1d1e20';
  g.fillRect(0, 0, 128, 128);
  speckle(g, 0, 0, 128, 128, 300, 0.05, 0.1, 1.5);
  g.save();
  if (!fromLeft) {
    g.translate(128, 0);
    g.scale(-1, 1);
  }
  g.strokeStyle = 'rgba(255,255,255,.07)';
  g.lineWidth = 2;
  for (let a = 0; a < Math.PI / 2; a += 0.12) {
    g.beginPath();
    g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
    g.lineTo(Math.cos(a) * 124, Math.sin(a) * 124);
    g.stroke();
  }
  g.strokeStyle = color;
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, 64, 0.08, Math.PI / 2 - 0.3);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(64, 2);
  g.lineTo(88, 36);
  g.lineTo(40, 36);
  g.closePath();
  g.fill();
  g.restore();
  return tex(c);
}

function hazardTex() {
  const c = canvas(256, 32);
  hazard(c.getContext('2d'), 0, 0, 256, 32, 16, '#c9981f', '#1a1a1a');
  speckle(c.getContext('2d'), 0, 0, 256, 32, 400, 0.08, 0.2, 2);
  return tex(c, { repeat: true });
}

/** A name, as a crisp little label (tracked capitals). */
function labelSprite(text, color) {
  const font = 46;
  const c = canvas(8, 8);
  let g = c.getContext('2d');
  g.font = FONT(600, font);
  const label = String(text).toUpperCase();
  const track = font * 0.12;
  const tw = Math.ceil(g.measureText(label).width + track * label.length);
  c.width = tw + 60;
  c.height = 84;
  g = c.getContext('2d');
  g.font = FONT(600, font);
  g.fillStyle = 'rgba(12,11,10,.62)';
  g.beginPath();
  g.roundRect(4, 10, c.width - 8, 62, 10);
  g.fill();
  g.fillStyle = color;
  g.fillRect(20, 30, 6, 22);
  g.fillStyle = '#f3ede2';
  g.textBaseline = 'middle';
  let x = 38;
  for (const ch of label) {
    g.fillText(ch, x, 43);
    x += g.measureText(ch).width + track;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(0.34 * (c.width / c.height), 0.34, 1);
  s.renderOrder = 20;
  s.center.set(0, 0.5);
  return s;
}

/** A small floating picture (an emoji or symbol) for the rarer events. */
function iconSprite(text, size = 0.42) {
  const c = canvas(160, 128);
  const g = c.getContext('2d');
  g.font = `600 84px Inter, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.6)';
  g.shadowBlur = 12;
  g.fillStyle = '#f3ede2';
  g.fillText(text, 80, 68);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(size * 1.25, size, 1);
  s.renderOrder = 21;
  return s;
}

// card glyphs (the same drawings as the phone's cards), drawn white on a canvas for the floor projector
const glyphCache = new Map();
function glyphTexture(type) {
  if (glyphCache.has(type)) return glyphCache.get(type);
  const N = 128;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const t = tex(c);
  glyphCache.set(type, t);
  g.save();
  g.scale(N / 40, N / 40);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (/^h\d\d$/.test(type)) {
    // a Haywire card: a jagged bolt
    g.fillStyle = '#fff';
    bolt(g, 20, 20, 15);
  } else {
    const doc = new DOMParser().parseFromString(cardFace(type).replace(/currentColor/g, '#ffffff'), 'image/svg+xml');
    for (const el of doc.querySelectorAll('path, circle')) {
      let p;
      if (el.tagName === 'circle') {
        p = new Path2D();
        p.arc(Number(el.getAttribute('cx')), Number(el.getAttribute('cy')), Number(el.getAttribute('r')), 0, TAU);
      } else p = new Path2D(el.getAttribute('d'));
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');
      g.globalCompositeOperation = fill === '#000' || stroke === '#000' ? 'destination-out' : 'source-over';
      if (fill && fill !== 'none') {
        g.fillStyle = '#fff';
        g.fill(p);
      }
      if (stroke && stroke !== 'none') {
        g.strokeStyle = '#fff';
        g.lineWidth = Number(el.getAttribute('stroke-width') ?? 3);
        g.setLineDash((el.getAttribute('stroke-dasharray') ?? '').split(' ').filter(Boolean).map(Number));
        g.stroke(p);
      }
    }
  }
  g.restore();
  t.needsUpdate = true;
  return t;
}

// ---------- shaders ----------

/** The final grade: warm highlights, cool shadows, a vignette and a little film grain. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.04 },
    uVignette: { value: 0.34 },
    uAspect: { value: 2 },
    uWarm: { value: 0.5 },
    uFade: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 600) },
    uBlur: { value: 1 },
    uFocus: { value: 0.7 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uAspect, uWarm, uFade, uBlur, uFocus; uniform vec2 uTexel;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    const vec2 TAP[12] = vec2[12](vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621), vec2(0.962,-0.195), vec2(0.473,-0.480),
      vec2(0.519,0.767), vec2(0.185,-0.893), vec2(0.507,0.064), vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
    vec3 lens(vec2 uv, float r) {
      // a long lens: the far hall and the very front go soft, with a touch of colour fringing at the edges
      vec2 d = uv - 0.5;
      float ca = dot(d, d) * 0.006;
      vec3 c;
      if (r < 0.4) {
        c = vec3(texture2D(tDiffuse, uv + d * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca).b);
      } else {
        c = texture2D(tDiffuse, uv).rgb;
        for (int i = 0; i < 12; i++) c += texture2D(tDiffuse, uv + TAP[i] * r * uTexel).rgb;
        c /= 13.0;
      }
      return c;
    }
    void main(){
      float r = uBlur * (smoothstep(uFocus, 1.0, vUv.y) * 5.0 + smoothstep(0.1, 0.0, vUv.y) * 2.5);
      vec3 c = lens(vUv, r);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.9, 0.99, 1.08);
      vec3 highTint = mix(vec3(1.03, 1.0, 0.95), vec3(1.08, 0.99, 0.88), uWarm);
      c *= mix(shadowTint, highTint, smoothstep(0.05, 0.65, l));
      c = mix(vec3(l), c, 0.95);
      c = c * 1.02 - 0.01;
      vec2 d = vUv - 0.5; d.x *= uAspect * 0.62;
      float v = smoothstep(0.95, 0.2, length(d));
      c *= mix(1.0 - uVignette, 1.0, v);
      float n = hash(vUv * 1024.0 + fract(uTime * 7.31) * 97.0) - 0.5;
      c += n * uGrain * (1.0 - l * 0.6);
      c *= 1.0 - uFade;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

function shaftMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0.12 }, uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uI, uTime, uSeed; varying vec2 vUv;
      float n(float x){ return sin(x) * 0.5 + 0.5; }
      void main(){
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float along = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.04, vUv.y);
        float drift = 0.75 + 0.25 * n(vUv.x * 9.0 + uTime * 0.21 + uSeed) * n(vUv.y * 5.0 - uTime * 0.13 + uSeed * 2.0);
        gl_FragColor = vec4(uColor * uI * edge * along * drift, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Sunlight through a steel window: bright panes, dark mullions, soft edges. */
function windowPatchTex() {
  const c = canvas(256, 512);
  const g = c.getContext('2d');
  g.filter = 'blur(5px)';
  g.fillStyle = '#ffffff';
  const cols = 4;
  const rows = 6;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) g.fillRect(14 + (i * 228) / cols + 5, 14 + (j * 484) / rows + 5, 228 / cols - 10, 484 / rows - 10);
  }
  g.filter = 'none';
  return tex(c);
}

function softDotTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

function smokeTexture() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) blot(g, 64 + rand(-26, 26), 64 + rand(-26, 26), rand(22, 46), 'rgba(255,255,255,A)', rand(0.12, 0.3));
  return tex(c);
}

// ---------- the arena ----------

export class Arena {
  /**
   * container: the element to draw in. opts.lobby: the lobby's slow establishing shots.
   * The host sets `sound` to a function(name, opts) to hear what happens.
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.sound = () => {};
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    container.append(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15130f);
    this.scene.fog = new THREE.FogExp2(0x4a4036, 0.012);
    this.camera = new THREE.PerspectiveCamera(26, 2, 0.1, 260);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.4);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.useBloom = true;

    this.clock = new THREE.Clock();
    this.time = 0;
    this.day = 0; // 0 = late afternoon ... 1 = dusk, lamps on
    this.dayShown = -1;
    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    this.bots = new Map();
    this.effects = [];
    this.belts = [];
    this.gears = new Map();
    this.pushers = new Map();
    this.flags = [];
    this.beams = [];
    this.bays = new Map();
    this.course = null;
    this.mode = opts.lobby ? 'lobby' : 'race';
    this.focusOn = null;
    this.actor = null;
    this.punch = null;
    this.labelsOn = false;
    this.frameTimes = [];
    this.dot = softDotTexture();
    this.smokeTex = smokeTexture();

    this.sunDir = new THREE.Vector3(0.75, -0.5, 0.4).normalize();
    this.buildEnvironment();
    this.buildHall();
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
    const resources = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) resources.add(o.geometry);
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!mat) continue;
        resources.add(mat);
        for (const v of Object.values(mat)) if (v?.isTexture) resources.add(v);
      }
    });
    for (const r of resources) r.dispose?.();
    this.envTex?.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // free the GL context now: the lobby and the race take turns
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setSize(w, h);
    this.bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.grade.uniforms.uAspect.value = w / h;
    this.grade.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.fitCamera();
  }

  // ----- light and the room -----

  /** A small invisible room the metal and paint can reflect: a bright strip of windows, a dim roof. */
  buildEnvironment() {
    const env = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 40), new THREE.MeshBasicMaterial({ color: 0x2c2722, side: THREE.BackSide }));
    env.add(box);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x3b352e }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7.9;
    env.add(floor);
    this.envWindows = [];
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.6, 2.6) }));
      w.position.set(-19.9, 1, -14 + i * 7);
      w.rotation.y = Math.PI / 2;
      env.add(w);
    }
    // high clerestory glass on the back wall: the steel deck catches it as a warm sheen
    const clere = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.3) }));
    clere.position.set(0, 5.2, -19.9);
    env.add(clere);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(30, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.95, 1.2) }));
    sky.rotation.x = Math.PI / 2;
    sky.position.y = 7.9;
    env.add(sky);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.5;
  }

  buildHall() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xa8bad2, 0x3a2c22, 0.55);
    s.add(this.hemi);
    // The sun: a far-off spotlight, so it lights the deck in a soft pool and the hall falls away into shade
    // around it (where the window light lands in patches). Parallel enough to read as sunlight.
    const sun = new THREE.SpotLight(0xffdcb0, 3, 0, 0.3, 0.5, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.02;
    s.add(sun, sun.target);
    this.sun = sun;
    this.fill = new THREE.DirectionalLight(0x9fb6d8, 0.35);
    this.fill.position.set(10, 12, 16);
    s.add(this.fill);

    // the hall floor: polished concrete
    const conc = concreteMaps();
    conc.map.repeat.set(9, 9);
    conc.rough.repeat.set(30, 30);
    this.floorMat = new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.rough, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -DECK_H;
    floor.receiveShadow = true;
    s.add(floor);

    // a dark roof far above
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x14120f, roughness: 1 }));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = 14;
    s.add(roof);

    this.hall = new THREE.Group();
    s.add(this.hall);

    // drifting dust
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-26, 22);
      pos[i * 3 + 1] = rand(-0.5, 10);
      pos[i * 3 + 2] = rand(-22, 14);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe2b8, map: this.dot, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.dust);

    // the lamps that come on at dusk, and the winner's spotlight
    this.lamps = [];
    this.lampLights = [];
    for (const x of [-1, 1]) {
      const l = new THREE.SpotLight(0xffc98a, 0, 40, 0.75, 0.6, 1.4);
      l.position.set(x * 4, 11, 1);
      l.target.position.set(x * 4, 0, 0);
      s.add(l, l.target);
      this.lampLights.push(l);
    }
    this.hero = new THREE.SpotLight(0xffe2bd, 0, 30, 0.13, 0.8, 1.2);
    this.hero.position.set(0, 12, 2);
    this.hero.castShadow = false;
    s.add(this.hero, this.hero.target);
    this.flash = new THREE.PointLight(0xff6a3a, 0, 6, 2);
    s.add(this.flash);
  }

  /** The walls, windows, columns and props, sized to the course. */
  buildRoom(c) {
    for (const o of [...this.hall.children]) {
      this.hall.remove(o);
      o.traverse((x) => x.geometry?.dispose());
    }
    const g = this.hall;
    const hw = c.w / 2;
    const hh = c.h / 2;
    const left = -hw - 10;
    const back = -hh - 11;
    this.room = { left, back, hw, hh };
    const brick = (this.brickTex ??= brickTex());
    const brickMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.92, color: 0xb8a89a });
    const steel = (this.steelMat ??= new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.8 }));
    const rusty = (this.rustMat ??= new THREE.MeshStandardMaterial({ color: 0x5b3a26, roughness: 0.85, metalness: 0.4 }));

    // left wall: brick piers between tall steel windows (the sun comes through these)
    this.windows = [];
    const winW = 3.4;
    const winY0 = 2.2;
    const winY1 = 10.5;
    const span = [back + 2, hh + 12];
    const count = Math.max(4, Math.round((span[1] - span[0]) / 6.2));
    const step = (span[1] - span[0]) / count;
    this.glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 2.6), fog: false });
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.7, metalness: 0.6 });
    for (let i = 0; i <= count; i++) {
      const z = span[0] + i * step;
      // pier
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, step - winW), brickMat);
      brick.repeat.set(1, 4);
      pier.position.set(left - 0.5, 6, z - step / 2);
      if (i > 0) g.add(pier);
      if (i === count) break;
      const wz = z + step / 2;
      // sill and lintel bricks
      for (const [y0, y1] of [[-DECK_H, winY0], [winY1, 14]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, y1 - y0, winW + 0.02), brickMat);
        m.position.set(left - 0.5, (y0 + y1) / 2, wz);
        g.add(m);
      }
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winY1 - winY0), this.glassMat);
      glass.position.set(left - 0.6, (winY0 + winY1) / 2, wz);
      glass.rotation.y = Math.PI / 2;
      g.add(glass);
      // mullions: a grid of thin steel bars
      for (let k = 1; k < 4; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, winY1 - winY0, 0.07), mullionMat);
        bar.position.set(left - 0.5, (winY0 + winY1) / 2, wz - winW / 2 + (k * winW) / 4);
        g.add(bar);
      }
      for (let k = 1; k < 6; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, winW), mullionMat);
        bar.position.set(left - 0.5, winY0 + (k * (winY1 - winY0)) / 6, wz);
        g.add(bar);
      }
      this.windows.push({ z: wz, w: winW, y0: winY0, y1: winY1, x: left - 0.4 });
    }

    // back wall: brick with a high strip of clerestory glass and a big sliding door
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(90, 15), brickMat.clone());
    backWall.material.map = brick.clone();
    backWall.material.map.needsUpdate = true;
    backWall.material.map.repeat.set(14, 2.4);
    backWall.position.set(0, 6.8, back);
    g.add(backWall);
    for (let i = 0; i < 9; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), this.glassMat);
      pane.position.set(left + 4 + i * 4.6, 11.4, back + 0.05);
      g.add(pane);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(7, 6.5, 0.2), rusty);
    door.position.set(hw * 0.4 + 2, 2.55, back + 0.15);
    g.add(door);
    for (let k = 0; k < 7; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.1), steel);
      rib.position.set(door.position.x, 0 + k * 0.9, back + 0.3);
      g.add(rib);
    }

    // steel columns with rivets, down both sides and across the back, holding the crane rails
    const col = (x, z) => {
      const grp = new THREE.Group();
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.12, 14.8, 0.6), steel);
      const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14.8, 0.08), steel);
      const f2 = f1.clone();
      f1.position.z = 0.3;
      f2.position.z = -0.3;
      grp.add(web, f1, f2);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 }));
      foot.position.y = -7.25;
      grp.add(foot);
      grp.position.set(x, 6.7, z);
      grp.traverse((o) => (o.castShadow = true));
      g.add(grp);
    };
    for (let z = back + 3; z < hh + 14; z += 6.5) {
      col(left + 2.2, z);
      col(hw + 7.5, z);
    }
    for (let x = left + 8; x < hw + 6; x += 7) col(x, back + 1.5);
    // crane rails along both sides, a bridge parked at the back
    for (const x of [left + 2.2, hw + 7.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 60), steel);
      rail.position.set(x, 10.2, 0);
      g.add(rail);
    }
    const bridgeLen = hw + 7.5 - (left + 2.2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x8c6a1e, roughness: 0.6, metalness: 0.5 }));
    bridge.position.set((hw + 7.5 + left + 2.2) / 2, 10.9, back + 4);
    g.add(bridge);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.5, 6), steel);
    chain.position.set(-2, 7.9, back + 4);
    g.add(chain);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI * 1.4), steel);
    hook.position.set(-2, 5.05, back + 4);
    g.add(hook);

    // pendant lamps over the deck (dark until dusk)
    this.bulbs = [];
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2f4136, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
    for (const lx of [-hw * 0.55, 0, hw * 0.55]) {
      for (const lz of [-hh * 0.45, hh * 0.35]) {
        const lamp = new THREE.Group();
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 24, 1, true), shadeMat);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0x222222, fog: false });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bulbMat);
        bulb.position.y = -0.12;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4, 4), steel);
        cord.position.y = 1.2;
        lamp.add(shade, bulb, cord);
        lamp.position.set(lx, 12.2, lz);
        g.add(lamp);
        this.bulbs.push({ mat: bulbMat, on: 0, at: 0.62 + Math.random() * 0.3 });
      }
    }
    for (const [i, l] of this.lampLights.entries()) {
      l.position.set((i ? 1 : -1) * hw * 0.4, 11, 0);
      l.target.position.set((i ? 1 : -1) * hw * 0.4, 0, 0);
      l.angle = Math.atan((Math.max(c.w, c.h) * 0.55) / 11);
    }

    // a few things left on the floor around the deck: drums, a tool cart, pallets, a cable drum
    const prop = (mesh, x, z, rotY = rand(0, TAU)) => {
      mesh.position.set(x, mesh.position.y - DECK_H, z);
      mesh.rotation.y = rotY;
      mesh.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      g.add(mesh);
      // a soft contact shadow
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: this.dot, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(x, -DECK_H + 0.01, z);
      g.add(blob);
    };
    const drumMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.5 });
    const drum = (color) => {
      const d = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 24), drumMat(color));
      body.position.y = 0.44;
      d.add(body);
      for (const y of [0.25, 0.63]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.015, 6, 24), drumMat(color));
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = y;
        d.add(hoop);
      }
      return d;
    };
    prop(drum(0x2d4a63), -hw - 1.9, -hh + 1.2);
    prop(drum(0x7a2b1f), -hw - 2.5, -hh + 1.75);
    prop(drum(0x2d4a63), -hw - 1.7, -hh + 2.2);
    prop(drum(0x6b6b5f), hw + 2.1, hh - 1.2);
    // tool cart
    const cart = new THREE.Group();
    const cartRed = new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.4, metalness: 0.4 });
    const bodyC = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.55), cartRed);
    bodyC.position.y = 0.55;
    cart.add(bodyC);
    for (let k = 0; k < 4; k++) {
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.012, 0.02), steel);
      drawer.position.set(0, 0.3 + k * 0.17, 0.285);
      cart.add(drawer);
    }
    prop(cart, hw + 2.2, -hh + 1.5, -0.4);
    // pallets with crates
    const pallet = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7d6446, roughness: 0.9 });
    const deckP = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), wood);
    deckP.position.y = 0.07;
    pallet.add(deckP);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.85 }));
    crate.position.y = 0.5;
    pallet.add(crate);
    prop(pallet, -hw - 2.4, hh - 0.8, 0.3);
    // cable drum
    const spool = new THREE.Group();
    for (const zz of [-0.32, 0.32]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 28), wood);
      flange.rotation.x = Math.PI / 2;
      flange.position.set(0, 0.55, zz);
      spool.add(flange);
    }
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }));
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.55;
    spool.add(coil);
    prop(spool, hw + 2.6, 0.4, 1.2);
    for (const bulb of this.bulbs) bulb.mat.userData = { keep: true };
    mergeStatic(g);
  }

  /** Sun shafts through each window: a few soft additive sheets per window, along the sun's direction. */
  buildShafts() {
    for (const s of this.shafts ?? []) {
      this.hall.remove(s.mesh);
      s.mesh.geometry.dispose();
    }
    this.shafts = [];
    if (!this.windows) return;
    const dir = this.sunDir.clone();
    const len = 30;
    for (const w of this.windows) {
      for (let k = 0; k < 4; k++) {
        const z = w.z - w.w / 2 + ((k + 0.5) * w.w) / 4;
        const a = new THREE.Vector3(w.x, w.y1, z);
        const b = new THREE.Vector3(w.x, w.y0, z);
        const geo = new THREE.BufferGeometry();
        const pts = [a, b, b.clone().addScaledVector(dir, len), a.clone().addScaledVector(dir, len)];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([1, 0, 0, 0, 0, 1, 1, 1], 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new THREE.Mesh(geo, (this.shaftMat ??= shaftMaterial(0xffc58a)));
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
        this.hall.add(mesh);
        this.shafts.push({ mesh });
      }
      // the window's shape, thrown onto the hall floor
      const floorY = -DECK_H + 0.012;
      const land = (y, z) => {
        const p = new THREE.Vector3(w.x, y, z);
        return p.addScaledVector(dir, (y - floorY) / -dir.y);
      };
      const quad = [land(w.y1, w.z - w.w / 2), land(w.y0, w.z - w.w / 2), land(w.y0, w.z + w.w / 2), land(w.y1, w.z + w.w / 2)];
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(quad.flatMap((p) => [p.x, floorY, p.z]), 3));
      pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
      pg.setIndex([0, 1, 2, 0, 2, 3]);
      const patch = new THREE.Mesh(pg, (this.patchMat ??= new THREE.MeshBasicMaterial({ map: windowPatchTex(), color: 0xffb877, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
      patch.renderOrder = 2;
      this.hall.add(patch);
      this.shafts.push({ mesh: patch });
    }
  }

  /** Time of day, 0 (late afternoon) .. 1 (dusk). The sun sinks and warms; at the end the lamps come on. */
  setDay(p) {
    this.dayTarget = Math.max(0, Math.min(1, p));
  }

  applyDay(p) {
    const el = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(33, 10, p));
    const az = THREE.MathUtils.degToRad(-32); // from the left, a little in front: faces toward the camera catch it
    this.sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), -Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    const c = this.course;
    const r = c ? Math.hypot(c.w, c.h) * 0.5 + 0.6 : 12;
    const SUN_D = 48;
    this.sun.position.copy(this.sunDir).multiplyScalar(-SUN_D);
    this.sun.target.position.set(0, 0, 0);
    this.sun.angle = Math.atan((r + 1.5) / SUN_D);
    this.sun.penumbra = 0.55;
    const warm = new THREE.Color(0xffe0b8).lerp(new THREE.Color(0xff9a52), smooth(0.2, 1, p));
    this.sun.color.copy(warm);
    this.sun.intensity = THREE.MathUtils.lerp(3.4, 1.8, smooth(0.3, 1, p));
    this.hemi.intensity = THREE.MathUtils.lerp(0.28, 0.18, p);
    this.hemi.color.set(0xa8bad2).lerp(new THREE.Color(0x56649a), p);
    this.fill.intensity = THREE.MathUtils.lerp(0.35, 0.22, p);
    this.scene.fog.color.set(0x4a4036).lerp(new THREE.Color(0x1f1c24), smooth(0.2, 1, p));
    this.scene.background.copy(this.scene.fog.color).multiplyScalar(0.8);
    this.glassMat?.color.setRGB(...new THREE.Color(6, 4.2, 2.6).lerp(new THREE.Color(4.2, 1.9, 0.9), p).toArray());
    if (this.shaftMat) {
      this.shaftMat.uniforms.uColor.value.set(0xffc58a).lerp(new THREE.Color(0xff8a4a), p);
      this.shaftMat.uniforms.uI.value = THREE.MathUtils.lerp(0.13, 0.09, p);
    }
    this.sun.shadow.camera.near = SUN_D - r - 6;
    this.sun.shadow.camera.far = SUN_D + r + 8;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.grade.uniforms.uWarm.value = 0.35 + p * 0.5;
    this.buildShafts();
  }

  // ----- the course -----

  pos(x, y) {
    return new THREE.Vector3(x + 0.5 - this.course.w / 2, 0, y + 0.5 - this.course.h / 2);
  }

  setCourse(idOrCourse) {
    const c = typeof idOrCourse === 'string' ? getCourse(idOrCourse) : idOrCourse;
    if (this.course === c) return;
    this.course = c;
    for (const obj of [...this.board.children]) {
      this.board.remove(obj);
      obj.traverse((o) => {
        o.geometry?.dispose();
        if (o.material && !o.material.shared) {
          for (const v of Object.values(o.material)) if (v?.isTexture && !glyphCacheHas(v)) v.dispose();
          o.material.dispose?.();
        }
      });
    }
    this.belts = [];
    this.gears.clear();
    this.pushers.clear();
    this.flags = [];
    this.beams = [];
    this.bays.clear();
    const S = Math.min(128, Math.floor(3200 / Math.max(c.w, c.h)));

    // the deck: steel skirts per board piece, hazard tape on the edge, the plated surface on top
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.55, metalness: 0.75 });
    const tape = hazardTex();
    for (const bd of c.boards) {
      const cx = bd.x + bd.w / 2 - c.w / 2;
      const cz = bd.y + bd.h / 2 - c.h / 2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(bd.w, DECK_H - 0.02, bd.h), skirtMat);
      body.position.set(cx, -DECK_H / 2 - 0.02, cz);
      body.receiveShadow = true;
      this.board.add(body);
      for (const [w, d, x, z] of [[bd.w + 0.02, 0.012, cx, cz + bd.h / 2], [bd.w + 0.02, 0.012, cx, cz - bd.h / 2], [0.012, bd.h + 0.02, cx - bd.w / 2, cz], [0.012, bd.h + 0.02, cx + bd.w / 2, cz]]) {
        const t = tape.clone();
        t.needsUpdate = true;
        t.repeat.set(Math.max(w, d) * 1.5, 1);
        const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
        band.position.set(x, -0.07, z);
        this.board.add(band);
      }
    }
    const maps = deckMaps(c, S);
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(c.w, c.h),
      new THREE.MeshStandardMaterial({ map: maps.map, bumpMap: maps.bump, bumpScale: 1.2, roughnessMap: maps.rough, roughness: 1, metalness: 0.35, alphaTest: 0.5, envMapIntensity: 0.7 }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    this.board.add(deck);

    // pits: dark wells
    const wellMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.BackSide });
    const pitFloor = new THREE.MeshBasicMaterial({ color: 0x000000 });
    // belts
    const mats = {};
    const beltMat = (fast) => {
      const k = fast ? 'b' : 'g';
      if (!mats[k]) {
        const t = beltTex(fast ? '#62a8de' : '#78c08e', fast);
        mats[k] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.82 });
        this.belts.push({ tex: t, speed: fast ? 1.1 : 0.55 });
      }
      return mats[k];
    };
    const curveMat = (fast, lft) => {
      const k = `${fast}${lft}`;
      if (!mats[k]) {
        const t = curveTex(fast ? '#62a8de' : '#78c08e', lft);
        mats[k] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.82 });
      }
      return mats[k];
    };
    const railMat = new THREE.MeshStandardMaterial({ color: 0xa9adb2, metalness: 1, roughness: 0.3 });
    const gearMats = {
      1: new THREE.MeshStandardMaterial({ color: 0x3e4a3f, metalness: 0.7, roughness: 0.45 }),
      [-1]: new THREE.MeshStandardMaterial({ color: 0x4a3a36, metalness: 0.7, roughness: 0.45 }),
    };
    this.batteryMat = new THREE.MeshStandardMaterial({ color: 0x0a120a, emissive: 0x8be08f, emissiveIntensity: 1.2 });

    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = c.cells[y * c.w + x];
        if (!cell) continue;
        const p = this.pos(x, y);
        if (cell.k === 'pit') {
          const well = new THREE.Mesh(new THREE.BoxGeometry(0.74, DECK_H - 0.04, 0.74), wellMat);
          well.position.set(p.x, -DECK_H / 2, p.z);
          this.board.add(well);
          const bottom = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), pitFloor);
          bottom.rotation.x = -Math.PI / 2;
          bottom.position.set(p.x, -DECK_H + 0.05, p.z);
          this.board.add(bottom);
        } else if (cell.k === 'belt') {
          const ins = beltInputs(c, x, y);
          const back = turn(cell.d, 2);
          const side = ins.find((d) => d !== back);
          const curve = side != null && !ins.includes(back);
          const lft = side === turn(cell.d, 3);
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), curve ? curveMat(cell.fast, lft) : beltMat(cell.fast));
          plate.rotation.x = -Math.PI / 2;
          plate.rotation.z = -cell.d * (Math.PI / 2);
          plate.position.set(p.x, 0.014, p.z);
          plate.receiveShadow = true;
          this.board.add(plate);
          if (!curve) {
            for (const sd of [turn(cell.d, 1), turn(cell.d, 3)]) {
              if (ins.includes(sd)) continue;
              const rail = new THREE.Mesh(new THREE.BoxGeometry(DX[sd] ? 0.045 : 1, 0.06, DX[sd] ? 1 : 0.045), railMat);
              rail.position.set(p.x + DX[sd] * 0.475, 0.03, p.z + DY[sd] * 0.475);
              rail.castShadow = true;
              this.board.add(rail);
            }
          }
        } else if (cell.k === 'gear') {
          const gm = gearMesh(gearMats[cell.spin], cell.spin);
          gm.position.set(p.x, 0, p.z);
          this.board.add(gm);
          gm.userData.keep = true;
          this.gears.set(`${x},${y}`, { mesh: gm, spin: cell.spin, extra: 0 });
        } else if (cell.k === 'battery') {
          const grp = new THREE.Group();
          const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.42, 20), new THREE.MeshStandardMaterial({ color: 0x2b2f2c, metalness: 0.8, roughness: 0.35 }));
          shell.position.y = 0.21;
          grp.add(shell);
          for (const by of [0.14, 0.24, 0.34]) {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 20), this.batteryMat);
            band.position.y = by;
            grp.add(band);
          }
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), railMat);
          cap.position.y = 0.45;
          grp.add(cap);
          grp.traverse((o) => (o.castShadow = true));
          grp.position.set(p.x + 0.33, 0, p.z - 0.33);
          this.board.add(grp);
        } else if (cell.k === 'start') {
          const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.bayGlowTex(), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(p.x, 0.02, p.z);
          this.board.add(ring);
          this.bays.set(cell.n, { ring, want: 0 });
        }
      }
    }

    // walls: steel barrier sections with hazard tops
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.45, metalness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ map: tape, roughness: 0.6 });
    for (const w of wallEdges(c)) {
      const grp = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.4, 0.08), wallMat);
      slab.position.y = 0.2;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.03, 0.06, 0.1), capMat);
      cap.position.y = 0.42;
      grp.add(slab, cap);
      if (w.side === 0) grp.position.set(w.x + 0.5 - c.w / 2, 0, w.y - c.h / 2);
      else {
        grp.position.set(w.x - c.w / 2, 0, w.y + 0.5 - c.h / 2);
        grp.rotation.y = Math.PI / 2;
      }
      grp.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      this.board.add(grp);
    }

    // wall lasers: an emitter with glowing lenses, and a faint beam always hanging in the haze
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a14, emissiveIntensity: 4 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x8b8e92, metalness: 0.9, roughness: 0.35 });
    for (const L of c.lasers) {
      const sideD = turn(L.d, 2);
      const p = this.pos(L.x, L.y);
      const grp = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.18), housingMat);
      housing.castShadow = true;
      grp.add(housing);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.19), new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.5 }));
      stripe.position.y = 0.1;
      grp.add(stripe);
      for (let i = 0; i < L.n; i++) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 14), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set((i - (L.n - 1) / 2) * 0.11, -0.02, -0.1);
        grp.add(lens);
      }
      grp.position.set(p.x + DX[sideD] * 0.38, 0.28, p.z + DY[sideD] * 0.38);
      grp.rotation.y = -L.d * (Math.PI / 2);
      this.board.add(grp);
      // the standing beam
      const path = beamPath(c, L.x, L.y, L.d);
      const end = path[path.length - 1];
      const from = p.clone().add(new THREE.Vector3(DX[sideD] * 0.3, 0.26, DY[sideD] * 0.3));
      const to = this.pos(end.x, end.y).add(new THREE.Vector3(DX[L.d] * 0.47, 0.26, DY[L.d] * 0.47));
      const beam = beamMesh(from, to, 0.012 * (1 + L.n * 0.4), 0xff3a22);
      beam.userData.base = 0.22;
      beam.userData.keep = true;
      beam.traverse((o) => o.material && (o.material.opacity = 0.22));
      this.board.add(beam);
      this.beams.push({ L, mesh: beam, flare: 0 });
    }

    // push panels: a pneumatic ram on a wall, with the registers it fires on stencilled on it
    for (const q of c.pushers) {
      const p = this.pos(q.x, q.y);
      const grp = new THREE.Group();
      const backC = canvas(128, 64);
      const bg = backC.getContext('2d');
      hazard(bg, 0, 0, 128, 64, 10, '#c9981f', '#1a1a1a');
      bg.fillStyle = '#16171a';
      bg.fillRect(22, 14, 84, 36);
      bg.fillStyle = '#e9e2d4';
      bg.font = FONT(700, 30);
      bg.textAlign = 'center';
      bg.textBaseline = 'middle';
      bg.fillText(q.regs.join(' '), 64, 33);
      const backM = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.36, 0.06), new THREE.MeshStandardMaterial({ map: tex(backC), roughness: 0.6 }));
      grp.add(backM);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.26, 0.05), new THREE.MeshStandardMaterial({ color: 0xa9adb2, metalness: 1, roughness: 0.28 }));
      plate.position.z = 0.06;
      plate.userData.keep = true;
      grp.add(plate);
      const into = turn(q.side, 2);
      grp.position.set(p.x + DX[q.side] * 0.42, 0.22, p.z + DY[q.side] * 0.42);
      grp.rotation.y = Math.atan2(DX[into], DY[into]);
      grp.traverse((o) => (o.castShadow = true));
      this.board.add(grp);
      this.pushers.set(`${q.x},${q.y}`, { plate });
    }

    // checkpoints: a slender pole, a numbered cloth flag, a brass ring set in the deck
    for (const cp of c.checkpoints) {
      const p = this.pos(cp.x, cp.y);
      const grp = new THREE.Group();
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.3, emissive: 0xffc070, emissiveIntensity: 0 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 8, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      grp.add(ring);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.9, 10), railMat);
      pole.position.set(-0.3, 0.95, 0.3);
      pole.castShadow = true;
      grp.add(pole);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), railMat);
      knob.position.set(-0.3, 1.91, 0.3);
      grp.add(knob);
      const fc = canvas(256, 160);
      const fg = fc.getContext('2d');
      fg.fillStyle = '#ece4d3';
      fg.fillRect(0, 0, 256, 160);
      speckle(fg, 0, 0, 256, 160, 800, 0.03, 0.06, 2);
      fg.fillStyle = '#c23b2c';
      fg.fillRect(0, 0, 256, 18);
      fg.fillRect(0, 142, 256, 18);
      fg.fillStyle = '#1b1a18';
      fg.font = FONT(800, 124);
      fg.textAlign = 'center';
      fg.textBaseline = 'middle';
      fg.fillText(String(cp.n), 128, 86);
      const flagGeo = new THREE.PlaneGeometry(0.95, 0.6, 14, 5);
      flagGeo.translate(0.475, 0, 0);
      // printed on both sides, so the number reads the right way round from anywhere
      const front = tex(fc);
      const backTex = front.clone();
      backTex.wrapS = THREE.RepeatWrapping;
      backTex.repeat.x = -1;
      backTex.offset.x = 1;
      backTex.needsUpdate = true;
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: front, side: THREE.FrontSide, roughness: 0.85 }));
      const flagBack = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: backTex, side: THREE.BackSide, roughness: 0.85 }));
      for (const m of [flag, flagBack]) {
        m.position.set(-0.3, 1.58, 0.3);
        m.castShadow = true;
        m.userData.keep = true;
        grp.add(m);
      }
      grp.position.set(p.x, 0, p.z);
      this.board.add(grp);
      this.flags.push({ flag, geo: flagGeo, base: flagGeo.attributes.position.array.slice(), ringMat, n: cp.n, flash: 0 });
    }

    mergeStatic(this.board);
    this.buildRoom(c);
    this.applyDay(this.dayShown = this.dayTarget ?? 0);
    this.fitCamera();
    this.camCur = null; // jump straight to the new shot
  }

  bayGlowTex() {
    if (this.bayTex) return this.bayTex;
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,.0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,.15)');
    grad.addColorStop(0.85, 'rgba(255,255,255,.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.bayTex = tex(c);
    return this.bayTex;
  }

  // ----- the camera: a crew, not a game camera -----

  /** The home shot: a long lens, high three-quarter view, the whole course in the frame. */
  fitCamera() {
    if (!this.course) return;
    const c = this.course;
    const cam = this.camera;
    const lobby = this.mode === 'lobby';
    const elev = THREE.MathUtils.degToRad(lobby ? 40 : c.w / c.h > 1.7 ? 50 : 54);
    const sx = lobby ? 0.74 : 0.94;
    const sy = lobby ? 0.82 : 1;
    cam.fov = 26;
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    const target = new THREE.Vector3(0, 0, 0.15);
    const corners = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corners.push(new THREE.Vector3((x * c.w) / 2, 0, (z * c.h) / 2), new THREE.Vector3((x * c.w) / 2, 1.0, (z * c.h) / 2));
    }
    corners.push(new THREE.Vector3(0, -DECK_H, c.h / 2));
    let lo = 4;
    let hi = 160;
    for (let i = 0; i < 32; i++) {
      const dist = (lo + hi) / 2;
      cam.position.set(target.x, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const fits = corners.every((p) => {
        const v = p.clone().project(cam);
        return Math.abs(v.x) < sx && v.y < 0.9 * sy && v.y > -0.94 * sy;
      });
      if (fits) hi = dist;
      else lo = dist;
    }
    this.home = { dist: hi, elev, target, fov: 26 };
  }

  /** Where the camera wants to be right now. */
  wantShot(t) {
    const h = this.home;
    const shot = { target: h.target.clone(), dist: h.dist, el: h.elev, az: 0, fov: h.fov, k: 1.6 };
    const m = this.mode;
    if (m === 'lobby') {
      shot.az = Math.sin(t * 0.045) * 0.14 + 0.05;
      shot.el = h.elev + Math.sin(t * 0.031) * 0.05;
      shot.dist = h.dist * (1 + Math.sin(t * 0.027) * 0.04);
      shot.k = 0.7;
      if (this.punch && this.punch.until > t) {
        shot.target.lerp(this.punch.at, 0.4);
        shot.dist = h.dist * 0.8;
        shot.k = 1.1;
      }
      if (this.heroId && this.bots.get(this.heroId)) {
        shot.target.lerp(this.bots.get(this.heroId).group.position, 0.5);
        shot.dist = h.dist * 0.66;
        shot.k = 0.9;
      }
    } else if (m === 'setup') {
      shot.az = t * 0.05;
      shot.el = h.elev - 0.2;
      shot.dist = h.dist * 1.18;
      shot.k = 0.8;
    } else if (m === 'over' && this.focusOn && this.bots.get(this.focusOn)) {
      const b = this.bots.get(this.focusOn);
      shot.target.copy(b.group.position).add(new THREE.Vector3(0, 0.45, 0));
      shot.dist = Math.max(5.6, h.dist * 0.3);
      shot.el = 0.44;
      shot.az = 0.5 + t * 0.09;
      shot.fov = 30;
      shot.k = 0.9;
    } else {
      shot.az = Math.sin(t * 0.06) * 0.035;
      shot.dist = h.dist * (1 + Math.sin(t * 0.045) * 0.012);
      if (m === 'activate') {
        if (this.actor) {
          const b = this.bots.get(this.actor);
          if (b?.group.visible) shot.target.lerp(b.group.position, 0.07);
        }
        if (this.punch && this.punch.until > t) {
          shot.target.lerp(this.punch.at, 0.62);
          shot.dist = h.dist * 0.6;
          shot.el = h.elev - 0.06;
          shot.k = 2.6;
        }
      }
      if (m === 'start' && this.startFocus && this.startFocus.until > t) {
        shot.target.lerp(this.startFocus.at, 0.55);
        shot.dist = h.dist * 0.62;
        shot.k = 2;
      }
    }
    return shot;
  }

  placeCamera(t, dt) {
    if (!this.home) return;
    const want = this.wantShot(t);
    if (!this.camCur) this.camCur = { ...want, target: want.target.clone() };
    const cc = this.camCur;
    const a = 1 - Math.exp(-dt * want.k);
    cc.az += wrapAngle(want.az - cc.az) * a;
    cc.dist += (want.dist - cc.dist) * a;
    cc.el += (want.el - cc.el) * a;
    cc.fov += (want.fov - cc.fov) * a;
    cc.target.lerp(want.target, a);
    // a camera operator's hands: tiny, slow drift
    const sway = 0.0025;
    const ox = Math.sin(t * 0.7) * sway + Math.sin(t * 1.3) * sway * 0.5;
    const oy = Math.cos(t * 0.6) * sway;
    this.camera.position.set(
      cc.target.x + Math.sin(cc.az) * Math.cos(cc.el) * cc.dist,
      cc.target.y + Math.sin(cc.el) * cc.dist,
      cc.target.z + Math.cos(cc.az) * Math.cos(cc.el) * cc.dist,
    );
    if (Math.abs(this.camera.fov - cc.fov) > 0.01) {
      this.camera.fov = cc.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(cc.target);
    this.camera.rotateX(oy);
    this.camera.rotateY(ox);
    // the lobby leaves room for the ticket on the right: slide the picture a little left
    const shift = this.mode === 'lobby' ? 0.11 : 0;
    this.shiftCur = (this.shiftCur ?? shift) + (shift - (this.shiftCur ?? shift)) * Math.min(1, dt * 2);
    const { width, height } = this.renderer.domElement;
    if (Math.abs(this.shiftCur) > 0.001) this.camera.setViewOffset(width, height, width * this.shiftCur, 0, width, height);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
  }

  /** host.js: which phase we're in, for the camera and the labels. */
  setMode(mode) {
    if (this.mode === mode) return;
    const refit = (mode === 'lobby') !== (this.mode === 'lobby');
    this.mode = mode;
    if (refit) this.fitCamera();
    this.labelsOn = ['upgrade', 'program'].includes(mode);
    if (mode !== 'over') this.focusOn = null;
  }

  /** A short push-in on something worth seeing (a fall, a flag, a hit). */
  punchIn(at, secs = 1.6) {
    if (this.mode !== 'activate' && this.mode !== 'lobby') return;
    const now = this.time;
    if (this.punch && this.punch.until > now + 0.3) return;
    this.punch = { at: at.clone(), until: now + secs };
  }

  // ----- robots -----

  syncRobots(list) {
    const seen = new Set();
    for (const r of list) {
      if (r.x == null) continue;
      seen.add(r.id);
      let b = this.bots.get(r.id);
      const style = modelOf(r);
      if (b && b.style !== style) {
        this.removeBot(b);
        b = null;
      }
      if (!b) {
        b = this.addBot(r, style);
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.visible = r.on !== false;
      }
      b.target = r;
      b.away = !!r.away;
      b.off = !!r.sd;
      if (b.color !== r.color || b.name !== r.name) this.relabel(b, r);
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
      if (b.x !== r.x || b.y !== r.y) this.tween(b, [[b.x, b.y], [r.x, r.y]], 0.45);
      const want = -r.d * (Math.PI / 2);
      const diff = wrapAngle(want - b.rot);
      if (Math.abs(diff) > 0.01) this.turnTo(b, b.rot + diff, 0.45);
    }
    for (const [id, b] of this.bots) if (!seen.has(id)) this.removeBot(b);
  }

  addBot(r, style) {
    const color = r.paint ?? paint(r.color);
    const model = makeRobot(style, color);
    const g = model.group;
    if (model.eye) model.eye.userData.keep = true;
    for (const sp of model.spin) sp.parent.userData.keep = true;
    for (const child of g.children) mergeStatic(child);
    g.scale.setScalar(BOT_SCALE);
    this.scene.add(g);
    const b = { id: r.id, style, model, group: g, color: r.color, name: r.name, x: r.x, y: r.y, rot: 0, visible: true, busyUntil: 0, anims: [], pop: this.time, label: null, labelA: 0, introUntil: this.time + 5 };
    this.bots.set(r.id, b);
    this.relabel(b, r);
    return b;
  }

  removeBot(b) {
    this.scene.remove(b.group);
    if (b.label) {
      this.scene.remove(b.label);
      b.label.material.map.dispose();
      b.label.material.dispose();
    }
    this.bots.delete(b.id);
  }

  relabel(b, r) {
    b.color = r.color;
    b.name = r.name;
    const c = r.paint ?? paint(r.color);
    b.model.paint.color.set(c);
    b.model.glow.emissive.set(c);
    if (b.label) {
      this.scene.remove(b.label);
      b.label.material.map.dispose();
      b.label.material.dispose();
    }
    b.label = r.name ? labelSprite(r.name, c) : null;
    if (b.label) {
      b.label.material.opacity = 0;
      this.scene.add(b.label);
    }
  }

  tween(b, path, dur, delay = 0, how = 'ease') {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'move', t0, dur, path, how });
  }

  turnTo(b, to, dur, delay = 0) {
    const t0 = this.time + delay;
    b.busyUntil = Math.max(b.busyUntil, t0 + dur);
    b.anims.push({ kind: 'turn', t0, dur, from: null, to });
  }

  /** Show the start bays (start phase). picks: { n: color } */
  showStarts(picks) {
    for (const [n, bay] of this.bays) bay.want = picks ? (picks[n] ? 0 : 1) : 0;
    const key = JSON.stringify(picks);
    if (picks && this.startKey && key !== this.startKey) {
      // someone just took a bay: a quick look at them
      const before = JSON.parse(this.startKey) ?? {};
      for (const n of Object.keys(picks)) {
        if (!before[n] && this.course) {
          const st = this.course.starts.find((s) => String(s.n) === String(n));
          if (st) this.startFocus = { at: this.pos(st.x, st.y), until: this.time + 1.8 };
        }
      }
    }
    this.startKey = key;
  }

  // ----- a beat of the Activation Phase -----

  playBeat(beat, robots) {
    const byId = new Map(robots.map((r) => [r.id, r]));
    const moveEnd = new Map();
    const what = beat.what;
    this.actor = what?.id ?? null;
    const glide = what?.k === 'belt';
    for (const f of beat.fx) {
      const b = this.bots.get(f.id ?? f.src);
      switch (f.k) {
        case 'move': {
          if (!b) break;
          const steps = f.path.length - 1;
          const dur = glide ? Math.max(0.3, steps * 0.42) : Math.max(0.2, steps * 0.31);
          if (steps < 1) {
            this.bump(b);
            this.sound('clunk');
            break;
          }
          b.visible = true;
          b.x = f.path[0][0];
          b.y = f.path[0][1];
          this.tween(b, f.path, dur, 0, glide ? 'linear' : 'ease');
          moveEnd.set(b.id, dur);
          if (!glide) this.sound('servo', { steps, pan: this.pan(b) });
          break;
        }
        case 'turn':
          if (b) {
            this.turnTo(b, b.rot - f.by * (Math.PI / 2), 0.5, 0);
            if (what?.k !== 'gear') this.sound('turn', { pan: this.pan(b) });
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
            b.anims = [];
            b.rot = -(byId.get(b.id)?.d ?? 0) * (Math.PI / 2);
            b.pop = this.time;
            b.busyUntil = this.time + 0.8;
            this.powerOn(this.pos(f.x, f.y));
            this.sound('reboot');
          }
          break;
        case 'beam':
          this.beam(f, b);
          break;
        case 'dmg':
          if (b) {
            const p = b.group.position.clone();
            p.y += 0.45;
            this.sparks(p, 0xffa24a, 26);
            this.smoke(p, 3, 0.35);
            b.hurt = this.time;
            this.sound('spark');
          }
          break;
        case 'en':
          if (b) {
            b.charge = this.time;
            this.sound('charge');
          }
          break;
        case 'cp':
          if (b) {
            const flag = this.flags.find((x) => x.n === f.n);
            if (flag) flag.flash = this.time;
            b.cheer = this.time;
            this.sparks(b.group.position.clone().setY(0.9), 0xffd89a, 18, { up: 2.4, speed: 1 });
            this.punchIn(b.group.position, 1.5);
            this.sound('bell', { n: f.n });
          }
          break;
        case 'say':
          if (b) this.floatIcon(b.group.position, f.text);
          break;
        case 'play':
          if (b) this.project(b, f.cards);
          break;
        case 'replace':
          if (b) this.project(b, [f.to ?? f.from].filter(Boolean));
          break;
        case 'shield':
          if (b) this.shieldFx(b);
          break;
        case 'emp':
          if (b) this.shockwave(b.group.position);
          break;
        case 'gear': {
          const gr = this.gears.get(`${f.x},${f.y}`);
          if (gr) gr.kick = { t0: this.time, from: gr.extra, to: gr.extra - f.spin * (Math.PI / 2) };
          this.sound('gear');
          break;
        }
        case 'pusher': {
          const p = this.pushers.get(`${f.x},${f.y}`);
          if (p) p.kick = this.time;
          this.sound('pusher');
          break;
        }
        case 'reveal':
          this.sound('slate');
          break;
        case 'win':
          if (b) {
            this.focusOn = b.id;
            b.cheer = this.time;
          }
          break;
      }
    }
    if (what?.k === 'belt') this.sound('belt', { fast: what.fast });
  }

  pan(b) {
    if (!this.course) return 0;
    return Math.max(-1, Math.min(1, (b.group.position.x / (this.course.w / 2)) * 0.7));
  }

  /** The card a robot is playing, thrown onto the floor ahead of it by its own projector. */
  project(b, types) {
    const t = types[types.length - 1];
    if (!t) return;
    const map = glyphTexture(t);
    const color = new THREE.Color(paint(b.color)).lerp(new THREE.Color(0xffffff), 0.35);
    const mat = new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 6;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), new THREE.MeshBasicMaterial({ map: this.dot, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    pool.renderOrder = 5;
    const grp = new THREE.Group();
    grp.add(pool, m);
    this.fxGroup.add(grp);
    const rot = b.rot;
    this.effects.push({
      t0: this.time,
      dur: 1.25,
      update: (k) => {
        const p = b.group.position;
        grp.position.set(p.x - Math.sin(rot) * 0.78, Math.max(0.03, p.y + 0.03), p.z - Math.cos(rot) * 0.78);
        grp.rotation.y = rot;
        const a = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        mat.opacity = a * 0.95;
        pool.material.opacity = a * 0.35;
      },
      end: () => {
        this.fxGroup.remove(grp);
        m.geometry.dispose();
        pool.geometry.dispose();
        mat.dispose();
        pool.material.dispose();
      },
    });
  }

  bump(b) {
    b.anims.push({ kind: 'bump', t0: this.time, dur: 0.3 });
  }

  fall(b, f, delay) {
    const edge = f.edge;
    b.busyUntil = this.time + delay + 1.3;
    b.anims.push({ kind: 'fall', t0: this.time + delay, dur: 1.2, edge });
    const at = this.pos(f.x, f.y);
    setTimeout(() => {
      if (!this.running) return;
      this.smoke(at.clone().setY(edge ? -DECK_H + 0.1 : 0.05), 6, 0.6);
      if (edge) this.sparks(at.clone().setY(-DECK_H + 0.2), 0xffb070, 20);
      this.sound(edge ? 'crash' : 'drop');
    }, delay * 1000 + (edge ? 650 : 250));
    this.punchIn(at, 1.8);
    this.sound('fall');
  }

  powerOn(at) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 48), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(0.03);
    this.fxGroup.add(ring);
    this.effects.push({
      t0: this.time,
      dur: 1.1,
      update: (k) => {
        ring.scale.setScalar(1 + k * 0.8);
        ring.material.opacity = Math.sin(k * Math.PI) * 0.8 * (Math.random() < 0.15 ? 0.3 : 1);
      },
      end: () => {
        this.fxGroup.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      },
    });
  }

  shieldFx(b) {
    const sph = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8ccfff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fxGroup.add(sph);
    this.effects.push({
      t0: this.time,
      dur: 0.9,
      update: (k) => {
        sph.position.copy(b.group.position).setY(b.group.position.y + 0.4);
        sph.material.opacity = Math.sin(k * Math.PI) * 0.35;
      },
      end: () => {
        this.fxGroup.remove(sph);
        sph.geometry.dispose();
        sph.material.dispose();
      },
    });
    this.sound('shield');
  }

  shockwave(at) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 48), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(0.1);
    this.fxGroup.add(ring);
    this.effects.push({
      t0: this.time,
      dur: 0.7,
      update: (k) => {
        ring.scale.setScalar(1 + k * 6);
        ring.material.opacity = 1 - k;
      },
      end: () => {
        this.fxGroup.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      },
    });
    this.sound('emp');
  }

  beam(f, shooter) {
    let from;
    if (f.board) {
      const sideD = turn(f.d, 2);
      from = this.pos(f.x0, f.y0).add(new THREE.Vector3(DX[sideD] * 0.3, 0.26, DY[sideD] * 0.3));
      const standing = this.beams.find((x) => x.L.x === f.x0 && x.L.y === f.y0 && x.L.d === f.d);
      if (standing) standing.flare = this.time;
    } else if (shooter) {
      shooter.model.muzzle.updateWorldMatrix(true, false);
      from = new THREE.Vector3().setFromMatrixPosition(shooter.model.muzzle.matrixWorld);
      shooter.recoil = this.time;
    } else from = this.pos(f.x0, f.y0).setY(0.35);
    const hit = f.hit?.length;
    const end = this.pos(f.x1, f.y1);
    if (!hit) end.add(new THREE.Vector3(DX[f.d] * 0.47, 0, DY[f.d] * 0.47));
    end.y = f.board ? 0.26 : hit ? 0.38 : from.y;
    const special = f.special;
    const color = special === 'tractor-beam' || special === 'pressor-beam' ? 0x8ccfff : special === 'scrambler' ? 0xc79cff : special === 'mini-howitzer' ? 0xffa64a : 0xff3a22;
    const mesh = beamMesh(from, end, 0.022 + 0.01 * (f.n ?? 1), color);
    this.fxGroup.add(mesh);
    this.effects.push({
      t0: this.time,
      dur: 0.8,
      update: (k) => {
        const flick = 0.8 + Math.random() * 0.2;
        mesh.traverse((o) => o.material && (o.material.opacity = (1 - k) ** 1.4 * flick));
        mesh.scale.set(1 - k * 0.4, 1, 1 - k * 0.4);
      },
      end: () => {
        this.fxGroup.remove(mesh);
        mesh.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      },
    });
    this.flash.color.set(color);
    this.flash.position.copy(end);
    this.flash.userData.t0 = this.time;
    if (hit) {
      this.sparks(end, 0xffa24a, 22);
      if (!f.board) this.punchIn(end, 1.1);
    }
    this.sound(f.board ? 'boardLaser' : 'laser', { hit: !!hit });
  }

  floatIcon(at, text) {
    if (!text) return;
    const s = iconSprite(text);
    const base = at.clone();
    base.y = Math.max(base.y, 0) + 1.15;
    s.position.copy(base);
    s.visible = false;
    this.fxGroup.add(s);
    this.effects.push({
      t0: this.time,
      dur: 1.5,
      update: (k) => {
        s.visible = true;
        s.position.y = base.y + k * 0.4;
        s.material.opacity = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      },
      end: () => {
        this.fxGroup.remove(s);
        s.material.map.dispose();
        s.material.dispose();
      },
    });
  }

  particles(at, colors, n, { speed = 2.2, up = 2.5, gravity = 7, size = 0.05, dur = 0.9, additive = true, map = this.dot, opacity = 1 } = {}) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      tmp.set(colors[i % colors.length]);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      const a = rand(0, TAU);
      const sp = rand(0.25, 1) * speed;
      vel.push([Math.cos(a) * sp, rand(0.3, 1) * up, Math.sin(a) * sp]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }));
    this.fxGroup.add(pts);
    let last = this.time;
    const floor = at.y < -0.1 ? -DECK_H + 0.02 : 0.02;
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const dt = this.time - last;
        last = this.time;
        for (let i = 0; i < n; i++) {
          vel[i][1] -= gravity * dt;
          pos[i * 3] += vel[i][0] * dt;
          pos[i * 3 + 1] += vel[i][1] * dt;
          pos[i * 3 + 2] += vel[i][2] * dt;
          if (pos[i * 3 + 1] < floor) {
            pos[i * 3 + 1] = floor;
            vel[i][1] *= -0.35;
            vel[i][0] *= 0.6;
            vel[i][2] *= 0.6;
          }
        }
        geo.attributes.position.needsUpdate = true;
        pts.material.opacity = opacity * (1 - k * k);
      },
      end: () => {
        this.fxGroup.remove(pts);
        geo.dispose();
        pts.material.dispose();
      },
    });
  }

  sparks(at, color, n, o = {}) {
    this.particles(at, [color, 0xfff2d8, color], n, { speed: 2.4, up: 2.4, size: 0.055, ...o });
    this.flash.color.set(color);
    this.flash.position.copy(at);
    this.flash.userData.t0 = this.time;
  }

  smoke(at, n, size) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: 0x5d5853, transparent: true, opacity: 0, depthWrite: false }));
      sp.position.copy(at).add(new THREE.Vector3(rand(-0.15, 0.15), rand(0, 0.15), rand(-0.15, 0.15)));
      sp.userData.v = new THREE.Vector3(rand(-0.2, 0.2), rand(0.25, 0.6), rand(-0.2, 0.2));
      sp.userData.s = size * rand(0.6, 1.1);
      this.fxGroup.add(sp);
      list.push(sp);
    }
    let last = this.time;
    this.effects.push({
      t0: this.time,
      dur: 2.2,
      update: (k) => {
        const dt = this.time - last;
        last = this.time;
        for (const sp of list) {
          sp.position.addScaledVector(sp.userData.v, dt);
          sp.scale.setScalar(sp.userData.s * (1 + k * 2.2));
          sp.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.55;
        }
      },
      end: () => {
        for (const sp of list) {
          this.fxGroup.remove(sp);
          sp.material.dispose();
        }
      },
    });
  }

  // ----- every frame -----

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    const t = this.time;
    this.adapt(dt);

    // the sun moves slowly toward where the race says it should be
    if (this.dayTarget != null && Math.abs(this.dayTarget - this.dayShown) > 0.002) {
      this.dayShown += (this.dayTarget - this.dayShown) * Math.min(1, dt * 0.35);
      if (Math.abs(this.dayTarget - this.dayShown) < 0.003) this.dayShown = this.dayTarget;
      this.dayAccum = (this.dayAccum ?? 0) + dt;
      if (this.dayAccum > 0.25 || this.dayShown === this.dayTarget) {
        this.dayAccum = 0;
        this.applyDay(this.dayShown);
      }
    }
    // hall lamps clank on one by one at dusk
    const lampsOn = this.dayShown > 0.6 || this.mode === 'over';
    let lit = 0;
    for (const bulb of this.bulbs ?? []) {
      const want = lampsOn && this.dayShown >= bulb.at - (this.mode === 'over' ? 1 : 0) ? 1 : 0;
      if (want && !bulb.on) {
        bulb.on = t;
        this.sound('lamp');
      } else if (!want) bulb.on = 0;
      const k = bulb.on ? Math.min(1, (t - bulb.on) / 0.4) : 0;
      const flick = bulb.on && t - bulb.on < 0.5 && Math.random() < 0.4 ? 0.2 : 1;
      bulb.mat.color.setRGB(0.13 + k * 3.8 * flick, 0.12 + k * 2.6 * flick, 0.1 + k * 1.3 * flick);
      lit += k;
    }
    const lampK = this.bulbs?.length ? lit / this.bulbs.length : 0;
    for (const l of this.lampLights) l.intensity = lampK * 70;

    if (this.shaftMat) this.shaftMat.uniforms.uTime.value = t;
    // the long lens: in the race the whole deck stays sharp; establishing and closing shots go softer
    const soft = this.mode === 'lobby' || this.mode === 'over' || this.mode === 'setup';
    const gu = this.grade.uniforms;
    gu.uBlur.value += ((soft ? 1 : 0.45) - gu.uBlur.value) * Math.min(1, dt * 2);
    gu.uFocus.value += ((soft ? 0.7 : 0.9) - gu.uFocus.value) * Math.min(1, dt * 2);
    this.grade.uniforms.uTime.value = t;
    for (const belt of this.belts) belt.tex.offset.y = (belt.tex.offset.y - dt * belt.speed) % 1;
    for (const gr of this.gears.values()) {
      if (gr.kick) {
        const k = Math.min(1, (t - gr.kick.t0) / 0.5);
        gr.extra = gr.kick.from + (gr.kick.to - gr.kick.from) * ease(k);
        if (k >= 1) gr.kick = null;
      }
      gr.mesh.rotation.y = gr.extra - gr.spin * t * 0.12;
    }
    for (const p of this.pushers.values()) {
      const k = p.kick ? (t - p.kick) / 0.45 : 1;
      p.plate.position.z = 0.06 + (k < 1 ? Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.36 : 0);
    }
    for (const f of this.flags) {
      const arr = f.geo.attributes.position.array;
      const flash = f.flash ? Math.max(0, 1 - (t - f.flash) / 2.5) : 0;
      const wind = 0.035 + flash * 0.05;
      for (let i = 0; i < arr.length; i += 3) {
        const x = f.base[i];
        arr[i + 2] = f.base[i + 2] + Math.sin(x * 8 - t * (3 + flash * 4) + f.n) * wind * x * 2.2;
      }
      f.geo.attributes.position.needsUpdate = true;
      f.geo.computeVertexNormals();
      f.ringMat.emissiveIntensity = flash * 3;
    }
    for (const bm of this.beams) {
      const k = bm.flare ? Math.max(0, 1 - (t - bm.flare) / 0.8) : 0;
      const o = 0.16 + Math.sin(t * 3 + bm.L.x) * 0.03 + k * 0.84;
      bm.mesh.traverse((x) => x.material && (x.material.opacity = o));
    }
    if (this.batteryMat) this.batteryMat.emissiveIntensity = 1 + Math.sin(t * 2.4) * 0.35;
    for (const [, bay] of this.bays) {
      const o = bay.want ? 0.35 + Math.sin(t * 3) * 0.2 : 0;
      bay.ring.material.opacity += (o - bay.ring.material.opacity) * Math.min(1, dt * 4);
    }
    this.dust.rotation.y = t * 0.004;
    this.dust.position.y = Math.sin(t * 0.1) * 0.2;
    const f0 = this.flash.userData.t0;
    this.flash.intensity = f0 != null ? Math.max(0, 1 - (t - f0) / 0.35) * 18 : 0;

    for (const b of this.bots.values()) this.animateBot(b, t, dt);
    this.effects = this.effects.filter((e) => {
      if (t < e.t0) return true;
      const k = Math.min(1, (t - e.t0) / e.dur);
      e.update(k);
      if (k >= 1) {
        e.end?.();
        return false;
      }
      return true;
    });

    // the winner's spotlight
    const hb = this.heroId ? this.bots.get(this.heroId) : this.mode === 'over' && this.focusOn ? this.bots.get(this.focusOn) : null;
    const heroWant = hb ? (this.mode === 'over' ? 55 : 14) : 0;
    this.hero.intensity += (heroWant - this.hero.intensity) * Math.min(1, dt * 1.5);
    if (hb) {
      this.hero.position.set(hb.group.position.x - 1.5, 11, hb.group.position.z + 2);
      this.hero.target.position.copy(hb.group.position);
    }

    this.placeCamera(t, dt);
    if (this.useBloom) this.composer.render(dt);
    else {
      // without bloom, still grade the picture
      this.composer.passes[1].enabled = false;
      this.composer.render(dt);
    }
  }

  animateBot(b, t, dt) {
    let px = b.x;
    let py = b.y;
    let rot = b.rot;
    let lift = 0;
    let pitch = 0;
    let roll = 0;
    let scale = 1;
    let visible = b.visible;
    b.anims = b.anims.filter((an) => {
      if (t < an.t0) return true;
      const k = Math.min(1, (t - an.t0) / an.dur);
      if (an.kind === 'move') {
        const segs = an.path.length - 1;
        const pos = (an.how === 'linear' ? k : ease(k)) * segs;
        const i = Math.min(segs - 1, Math.floor(pos));
        const f = pos - i;
        const [x0, y0] = an.path[i];
        const [x1, y1] = an.path[i + 1];
        px = x0 + (x1 - x0) * f;
        py = y0 + (y1 - y0) * f;
        if (an.how !== 'linear') {
          // weight: the nose lifts as it pulls away and dips as it brakes
          const dx = an.path[segs][0] - an.path[0][0];
          const dy = an.path[segs][1] - an.path[0][1];
          const fwd = -Math.sin(b.rot) * dx + -Math.cos(b.rot) * dy;
          const dir = Math.abs(fwd) > 0.01 ? Math.sign(fwd) : 0;
          pitch = Math.sin(k * TAU) * 0.07 * dir;
        }
        if (k >= 1) {
          b.x = an.path[segs][0];
          b.y = an.path[segs][1];
          px = b.x;
          py = b.y;
        }
      } else if (an.kind === 'turn') {
        an.from ??= b.rot;
        rot = an.from + (an.to - an.from) * ease(k);
        roll = Math.sin(k * Math.PI) * 0.05 * Math.sign(an.to - an.from);
        if (k >= 1) b.rot = an.to;
      } else if (an.kind === 'bump') {
        pitch = -Math.sin(k * Math.PI) * 0.16;
      } else if (an.kind === 'fall') {
        visible = true;
        if (an.edge) {
          const kk = Math.min(1, k * 1.15);
          lift = kk < 0.35 ? 0 : -(((kk - 0.35) / 0.65) ** 2) * (DECK_H + 0.4);
          pitch = -Math.min(1.4, kk * 2.2);
        } else {
          lift = -(k ** 2) * 1.2;
          scale = 1 - k * 0.5;
          pitch = k * 0.6;
        }
        if (k >= 1) {
          b.visible = false;
          visible = false;
        }
      }
      return k < 1;
    });
    const g = b.group;
    g.visible = visible;
    if (b.label) {
      const want = visible && (this.labelsOn || t < (b.introUntil ?? 0)) && this.mode !== 'over' ? 1 : 0;
      b.labelA += (want - b.labelA) * Math.min(1, dt * 5);
      b.label.material.opacity = b.labelA;
      b.label.visible = b.labelA > 0.01;
    }
    if (!visible) return;
    const p = this.pos(px, py);
    const hover = b.model.body.userData.hover ? 0.08 + Math.sin(t * 2.4 + b.id.length) * 0.03 : 0;
    g.position.set(p.x, lift + hover, p.z);
    g.rotation.set(0, rot, 0);
    const cheer = b.cheer ? Math.max(0, 1 - (t - b.cheer) / 1.6) : 0;
    b.model.body.rotation.set(pitch, cheer ? Math.sin(cheer * 18) * 0.25 * cheer : 0, roll);
    const pop = Math.min(1, (t - b.pop) / 0.5);
    g.scale.setScalar(BOT_SCALE * scale);
    b.model.body.position.y = Math.sin(t * 3 + b.id.length) * 0.006 + (1 - ease(pop)) * 0.25 + cheer * Math.abs(Math.sin(cheer * 9)) * 0.08;
    const recoil = b.recoil ? Math.max(0, 1 - (t - b.recoil) / 0.25) : 0;
    b.model.body.position.z = recoil * 0.06;
    for (const s of b.model.spin) s.rotation.y = t * 20;
    if (b.model.eye?.material) {
      const hurt = b.hurt ? Math.max(0, 1 - (t - b.hurt) / 0.7) : 0;
      const flick = hurt > 0 && Math.random() < 0.35 ? 0.1 : 1;
      const dim = b.off ? 0.15 : b.away ? 0.35 : 1;
      b.model.eye.material.emissiveIntensity = (2.2 + Math.sin(t * 4) * 0.2) * dim * flick * Math.min(1, pop * 1.5);
    }
    const charge = b.charge ? Math.max(0, 1 - (t - b.charge) / 1) : 0;
    const acting = this.actor === b.id && this.mode === 'activate' ? 1 : 0;
    b.model.glow.emissiveIntensity = (b.off ? 0.2 : 1.1) + acting * 1.2 + charge * 3;
    if (b.label) b.label.position.set(p.x + 0.42, lift + 0.62, p.z);
  }

  /** If the computer can't keep up, give up resolution, then the glow, then shadows and haze. */
  adapt(dt) {
    if (FIXED_QUALITY) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1 / 28) {
      if (this.pixelRatio > 1) {
        this.pixelRatio = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
      } else if (this.useBloom) this.useBloom = false;
      else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
      } else if (this.dust.visible) {
        this.dust.visible = false;
        for (const s of this.shafts ?? []) s.mesh.visible = false;
      } else if (this.pixelRatio > 0.75) {
        this.pixelRatio = 0.75;
        this.renderer.setPixelRatio(0.75);
        this.resize();
      }
    }
  }
}

/**
 * Fewer draw calls: merge the still meshes under `root` that share a material into one mesh each.
 * Anything marked userData.keep (or inside something marked) stays as it is, so it can still move.
 */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.userData?.keep) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts = list.map((o) => {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return geo;
    });
    if (!parts.every((p) => p.attributes.position && p.attributes.normal)) {
      for (const p of parts) p.dispose();
      continue;
    }
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      if (!parts.every((p) => p.attributes[name])) continue;
      const size = parts[0].attributes[name].itemSize;
      const arr = new Float32Array(parts.reduce((n, p) => n + p.attributes[name].count * size, 0));
      let off = 0;
      for (const p of parts) {
        arr.set(p.attributes[name].array, off);
        off += p.attributes[name].count * size;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    root.add(mesh);
    for (const o of list) {
      o.parent.remove(o);
      o.geometry.dispose();
    }
    for (const p of parts) p.dispose();
  }
}

function glyphCacheHas(t) {
  for (const v of glyphCache.values()) if (v === t) return true;
  return false;
}

function wrapAngle(a) {
  return ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** A laser: a hot white core inside a colored glow, additive. */
function beamMesh(from, to, thick, color) {
  const len = from.distanceTo(to);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from).normalize();
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(thick * 2.2, thick * 2.2, len, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.5, thick * 0.5, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.7), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(outer, core);
  group.position.copy(mid);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.renderOrder = 8;
  return group;
}

function gearMesh(mat, spin) {
  const shape = new THREE.Shape();
  const teeth = 12;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const r = i % 2 ? 0.37 : 0.44;
    const pt = (a) => [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) shape.moveTo(...pt(a0));
    else shape.lineTo(...pt(a0));
    shape.lineTo(...pt(a1));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.08, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  // a painted arrow ring on top showing which way it turns
  const paintMat = new THREE.MeshStandardMaterial({ color: spin > 0 ? 0x6fbf7f : 0xd0574a, roughness: 0.6, emissive: spin > 0 ? 0x2f6a3a : 0x6a221a, emissiveIntensity: 0.6 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 32, Math.PI * 1.35), paintMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.y = 0.095;
  g.add(arc);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 12), paintMat);
  const end = Math.PI * 1.35;
  tip.position.set(Math.cos(end) * 0.24, 0.095, -Math.sin(end) * 0.24);
  tip.rotation.x = Math.PI / 2;
  tip.rotation.z = spin > 0 ? -end : end;
  g.add(tip);
  if (spin < 0) g.scale.x = -1;
  return g;
}
