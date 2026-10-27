// Lumen: the big screen's world. A slab of smoked glass floats in a dark room and every board element
// is drawn with light: belts are streams of light under the glass, pits are holes where the light is
// missing, walls are bright fins, lasers are lines of light, checkpoints are columns of light.
// Robots are polished forms in their player's color that leave a fading trail of light where they go.
// host.js (and the lobby lessons) tell it what to show; this file draws and animates.
import * as THREE from './lib/three.module.min.js';
import { EffectComposer } from './lib/effect-composer.js';
import { RenderPass } from './lib/render-pass.js';
import { UnrealBloomPass } from './lib/unreal-bloom-pass.js';
import { OutputPass } from './lib/output-pass.js';
import { DX, DY, turn, getCourse, beltInputs, beamPath, wallEdges } from './board.js';
import { makeRobot, glowTexture } from './bots3d.js';
import { drawCard, drawGlyph, formOf } from './glyphs.js';
import { readBeat, clockU, clockTime, clockTotal, pathAt, lastTick } from './chaos.js';

const TAU = Math.PI * 2;
const LASER_GAP = 0.17; // how far apart a double laser's two beams (and its two lenses) sit, in squares
const FONT = 'Lumen';
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2; // overshoots a little, then settles
const smooth = (a, b, x) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return k * k * (3 - 2 * k);
};
const rand = (a, b) => a + Math.random() * (b - a);
const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const BOT_SCALE = 1.3;

export const PALETTE = {
  void: '#06080b',
  light: '#f4efe4',
  energy: '#ffc56e',
  laser: '#ff4a3a',
  belt: '#5fe3b8',
  express: '#7aa8ff',
  right: '#7fe3c3',
  left: '#ff8fa3',
  reboot: '#9cc8ff',
};

// ---------- canvas helpers ----------

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** A text label as a sprite: light text on a soft dark pill. */
function labelSprite(text, { color = '#f4efe4', height = 0.2, weight = 500, pill = true, size = 64, track = 0.06 } = {}) {
  const probe = canvas(8, 8).getContext('2d');
  probe.font = `${weight} ${size}px ${FONT}, sans-serif`;
  probe.letterSpacing = `${track * size}px`;
  const tw = Math.ceil(probe.measureText(text).width);
  const padX = size * 0.6;
  const c = canvas(tw + padX * 2, Math.ceil(size * 1.7));
  const g = c.getContext('2d');
  if (pill) {
    g.fillStyle = 'rgba(8,10,14,.62)';
    g.beginPath();
    g.roundRect(2, 2, c.width - 4, c.height - 4, c.height / 2);
    g.fill();
  }
  g.font = probe.font;
  g.letterSpacing = probe.letterSpacing;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2 + (track * size) / 2, c.height / 2 + size * 0.04);
  const t = tex(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(height * (c.width / c.height), height, 1);
  s.renderOrder = 20;
  return s;
}

/** A playing card as a floating sprite (the same lit slide the phones show). */
function cardSprite(types) {
  const n = types.length;
  const W = 120;
  const H = 150;
  const gap = 18;
  const pad = 30;
  const c = canvas(pad * 2 + n * W + (n - 1) * gap, H + pad * 2);
  const g = c.getContext('2d');
  types.forEach((t, i) => drawCard(g, t, pad + i * (W + gap), pad, W, H, { font: FONT }));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }));
  const h = 1.0;
  s.scale.set((h * c.width) / c.height, h, 1);
  s.renderOrder = 30;
  s.userData.aspect = c.width / c.height;
  return s;
}

/** A small mark (glyph) as a sprite, for "+1 energy", a shield and so on. */
function glyphSprite(name, color, { text = '', height = 0.4 } = {}) {
  const c = canvas(text ? 256 : 128, 128);
  const g = c.getContext('2d');
  g.shadowColor = color;
  g.shadowBlur = 18;
  drawGlyph(g, name, text ? 64 : 64, 64, 84, color, 3.4);
  if (text) {
    g.font = `300 84px ${FONT}, sans-serif`;
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(text, 118, 70);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  s.scale.set((height * c.width) / c.height, height, 1);
  s.renderOrder = 31;
  return s;
}

// ---------- the comic moments' textures (made once, shared) ----------

const shared = new Map();
function sharedTex(key, paint) {
  if (!shared.has(key)) {
    const t = tex(paint());
    t.userData.shared = true;
    shared.set(key, t);
  }
  return shared.get(key);
}

/** A robot's face: eyes of light on a small disc of dark glass, so it reads over anything. */
function faceTexture(kind) {
  return sharedTex(`face-${kind}`, () => {
    const c = canvas(192, 192);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(96, 96, 30, 96, 96, 94);
    grad.addColorStop(0, 'rgba(6,8,11,.86)');
    grad.addColorStop(0.72, 'rgba(6,8,11,.72)');
    grad.addColorStop(1, 'rgba(6,8,11,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 192, 192);
    g.strokeStyle = 'rgba(244,239,228,.35)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(96, 96, 70, 0, TAU);
    g.stroke();
    g.shadowColor = PALETTE.light;
    g.shadowBlur = 16;
    drawGlyph(g, `face-${kind}`, 96, 98, 128, '#fffaf0', 3.2);
    g.shadowBlur = 4;
    drawGlyph(g, `face-${kind}`, 96, 98, 128, '#ffffff', 1.9);
    return c;
  });
}

/** A numeral of light (the order robots act in). */
function numeralTexture(n) {
  return sharedTex(`num-${n}`, () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    g.shadowColor = '#ffffff';
    g.shadowBlur = 12;
    g.fillStyle = '#ffffff';
    g.font = `300 104px ${FONT}, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
    return c;
  });
}

/** A four-point sparkle (dizzy stars, sparkles). */
function starTexture() {
  return sharedTex('star', () => {
    const c = canvas(96, 96);
    const g = c.getContext('2d');
    g.shadowColor = '#ffffff';
    g.shadowBlur = 14;
    drawGlyph(g, 'star', 48, 48, 66, '#ffffff');
    return c;
  });
}

/** An impact: a starburst of light spikes around a bright core. */
function burstTexture() {
  return sharedTex('burst', () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    g.translate(128, 128);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 60);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.35, 'rgba(255,255,255,.45)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(-128, -128, 256, 256);
    g.shadowColor = '#ffffff';
    g.shadowBlur = 10;
    g.fillStyle = '#ffffff';
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (i % 2) * 0.18;
      const r0 = 26 + (i % 3) * 6;
      const r1 = i % 2 ? 86 : 118;
      const w = i % 2 ? 0.07 : 0.09;
      g.beginPath();
      g.moveTo(Math.cos(a - w) * r0, Math.sin(a - w) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.lineTo(Math.cos(a + w) * r0, Math.sin(a + w) * r0);
      g.closePath();
      g.fill();
    }
    return c;
  });
}

// ---------- the board's textures ----------

/** The light drawn into the glass: seams, start pads, checkpoints, the reboot mark, laser paths. */
function paintLight(course, S, { inert = false } = {}) {
  const c = canvas(course.w * S, course.h * S);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height); // opaque: the glow map's colors must not depend on alpha
  const W = course.w;
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < W; x++) {
      const cell = course.cells[y * W + x];
      if (!cell) continue;
      const X = x * S;
      const Y = y * S;
      const dock = course.boards[cell.b]?.dock;
      if (cell.k === 'pit') {
        // the hole itself is cut out of the glass, so its rim is lit on the glass around it: a bright edge
        // where the glass breaks off, and a glow spilling back across the glass, so a pit reads from afar
        for (let d = 0; d < 4; d++) {
          const n = course.cells[(y + DY[d]) * W + x + DX[d]];
          if (x + DX[d] < 0 || x + DX[d] >= W || !n || n.k === 'pit') continue;
          // the strip of neighbor glass along this side: from the hole's edge outward
          const ex = d === 1 ? X + S : X;
          const ey = d === 2 ? Y + S : Y;
          const along = d % 2 === 0;
          const depth = S * 0.3;
          const ox = DX[d];
          const oy = DY[d];
          const grad = g.createLinearGradient(ex, ey, ex + ox * depth, ey + oy * depth);
          grad.addColorStop(0, 'rgba(244,239,228,.55)');
          grad.addColorStop(0.35, 'rgba(244,239,228,.14)');
          grad.addColorStop(1, 'rgba(244,239,228,0)');
          g.fillStyle = grad;
          if (along) g.fillRect(X, oy < 0 ? ey - depth : ey, S, depth);
          else g.fillRect(ox < 0 ? ex - depth : ex, Y, depth, S);
          // the edge
          g.fillStyle = 'rgba(255,250,240,.95)';
          const w = S * 0.035;
          if (along) g.fillRect(X, oy < 0 ? ey - w : ey, S, w);
          else g.fillRect(ox < 0 ? ex - w : ex, Y, w, S);
        }
        continue;
      }
      // seams, and a small registration cross at each corner (like a light table)
      // the glass glows faintly from inside; the dock a touch more
      g.fillStyle = dock ? 'rgba(150,170,200,.075)' : 'rgba(150,170,200,.045)';
      g.fillRect(X, Y, S, S);
      g.strokeStyle = 'rgba(200,215,235,.05)';
      g.lineWidth = Math.max(1, S * 0.01);
      g.strokeRect(X + 0.5, Y + 0.5, S - 1, S - 1);
      g.strokeStyle = 'rgba(244,239,228,.22)';
      g.lineWidth = Math.max(1.2, S * 0.014);
      const k = S * 0.06;
      g.beginPath();
      g.moveTo(X - k, Y);
      g.lineTo(X + k, Y);
      g.moveTo(X, Y - k);
      g.lineTo(X, Y + k);
      g.stroke();
      const cx = X + S / 2;
      const cy = Y + S / 2;
      if (cell.k === 'start') {
        g.strokeStyle = 'rgba(244,239,228,.42)';
        g.lineWidth = S * 0.018;
        g.beginPath();
        g.roundRect(X + S * 0.16, Y + S * 0.16, S * 0.68, S * 0.68, S * 0.1);
        g.stroke();
        g.fillStyle = 'rgba(244,239,228,.55)';
        g.font = `200 ${Math.round(S * 0.42)}px ${FONT}, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(cell.n), cx, cy + S * 0.03);
      } else if (cell.k === 'battery') {
        // no upgrades, no energy (the rulebook's lighter game): the battery is drawn faint and neutral, inert
        const ink = inert ? 'rgba(244,239,228,.16)' : PALETTE.energy;
        g.save();
        g.shadowColor = inert ? 'transparent' : PALETTE.energy;
        g.shadowBlur = inert ? 0 : S * 0.12;
        g.strokeStyle = ink;
        g.lineWidth = S * 0.028;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(cx, cy, S * 0.3, (i / 3) * TAU + 0.25, ((i + 1) / 3) * TAU - 0.25);
          g.stroke();
        }
        drawGlyph(g, 'bolt', cx, cy, S * 0.34, ink);
        g.restore();
      } else if (cell.k === 'gear') {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.arc(cx, cy, S * 0.44, 0, TAU);
        g.fill();
      }
    }
  }
  // laser paths: a dashed red beam with a soft glow, visible from across the room before it fires. A double laser
  // (2 damage) is two beams, set clearly apart, like its two lenses
  for (const L of course.lasers) {
    const path = beamPath(course, L.x, L.y, L.d);
    const a = path[0];
    const b = path[path.length - 1];
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < L.n; i++) {
      const off = (i - (L.n - 1) / 2) * S * LASER_GAP;
      const ox = DY[L.d] * off;
      const oy = DX[L.d] * off;
      const line = () => {
        g.beginPath();
        g.moveTo((a.x + 0.5 - DX[L.d] * 0.38) * S + ox, (a.y + 0.5 - DY[L.d] * 0.38) * S + oy);
        g.lineTo((b.x + 0.5 + DX[L.d] * 0.47) * S + ox, (b.y + 0.5 + DY[L.d] * 0.47) * S + oy);
        g.stroke();
      };
      // (the beam itself hangs in the air at its lens's height, built with the emitters; this is its glow on the glass)
      g.setLineDash([]);
      g.strokeStyle = 'rgba(255,74,58,.16)';
      g.lineWidth = S * 0.08;
      line();
    }
    g.restore();
  }
  // the edge of the glass catches the light
  g.strokeStyle = 'rgba(244,239,228,.38)';
  g.lineWidth = S * 0.022;
  g.beginPath();
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < W; x++) {
      if (!course.cells[y * W + x]) continue;
      const open = (dx, dy) => x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= course.h || !course.cells[(y + dy) * W + x + dx];
      const e = S * 0.012;
      if (open(0, -1)) { g.moveTo(x * S, y * S + e); g.lineTo((x + 1) * S, y * S + e); }
      if (open(0, 1)) { g.moveTo(x * S, (y + 1) * S - e); g.lineTo((x + 1) * S, (y + 1) * S - e); }
      if (open(-1, 0)) { g.moveTo(x * S + e, y * S); g.lineTo(x * S + e, (y + 1) * S); }
      if (open(1, 0)) { g.moveTo((x + 1) * S - e, y * S); g.lineTo((x + 1) * S - e, (y + 1) * S); }
    }
  }
  g.stroke();
  // walls leave a bright line on the glass
  g.strokeStyle = 'rgba(244,239,228,.55)';
  g.lineWidth = S * 0.03;
  for (const w of wallEdges(course)) {
    g.beginPath();
    if (w.side === 0) {
      g.moveTo(w.x * S, w.y * S);
      g.lineTo((w.x + 1) * S, w.y * S);
    } else {
      g.moveTo(w.x * S, w.y * S);
      g.lineTo(w.x * S, (w.y + 1) * S);
    }
    g.stroke();
  }
  // reboot marks
  for (const b of course.boards) {
    if (!b.reboot) continue;
    const cx = (b.reboot.x + 0.5) * S;
    const cy = (b.reboot.y + 0.5) * S;
    g.save();
    g.shadowColor = PALETTE.reboot;
    g.shadowBlur = S * 0.1;
    g.strokeStyle = 'rgba(156,200,255,.7)';
    g.lineWidth = S * 0.02;
    g.beginPath();
    g.arc(cx, cy, S * 0.36, 0, TAU);
    g.stroke();
    drawGlyph(g, 'reboot', cx, cy, S * 0.5, 'rgba(156,200,255,.9)', 2.6);
    const d = b.reboot.d;
    g.fillStyle = 'rgba(156,200,255,.9)';
    g.beginPath();
    g.moveTo(cx + DX[d] * S * 0.49, cy + DY[d] * S * 0.49);
    g.lineTo(cx + DX[d] * S * 0.4 + DY[d] * S * 0.07, cy + DY[d] * S * 0.4 - DX[d] * S * 0.07);
    g.lineTo(cx + DX[d] * S * 0.4 - DY[d] * S * 0.07, cy + DY[d] * S * 0.4 + DX[d] * S * 0.07);
    g.fill();
    g.restore();
  }
  // checkpoints: a ring and the number
  for (const cp of course.checkpoints) {
    const cx = (cp.x + 0.5) * S;
    const cy = (cp.y + 0.5) * S;
    g.save();
    g.shadowColor = PALETTE.light;
    g.shadowBlur = S * 0.15;
    g.strokeStyle = 'rgba(244,239,228,.9)';
    g.lineWidth = S * 0.025;
    g.beginPath();
    g.arc(cx, cy, S * 0.4, 0, TAU);
    g.stroke();
    g.fillStyle = 'rgba(244,239,228,.95)';
    g.font = `200 ${Math.round(S * 0.5)}px ${FONT}, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(cp.n), cx, cy + S * 0.035);
    g.restore();
  }
  return c;
}

/** The glass itself: smoky, a little lighter in the middle; holes where the pits are. */
function paintGlass(course, S) {
  const c = canvas(course.w * S, course.h * S);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(c.width / 2, c.height * 0.45, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
  grad.addColorStop(0, '#2e3542');
  grad.addColorStop(1, '#181c24');
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      const cell = course.cells[y * course.w + x];
      if (!cell || cell.k === 'pit') continue;
      const dock = course.boards[cell.b]?.dock;
      g.fillStyle = grad;
      g.fillRect(x * S, y * S, S, S);
      if (dock) {
        g.fillStyle = 'rgba(120,135,160,.10)';
        g.fillRect(x * S, y * S, S, S);
      }
    }
  }
  // a soft reflection across the glass, as if from a window high up
  g.globalCompositeOperation = 'source-atop';
  const sheen = g.createLinearGradient(0, 0, c.width, c.height);
  sheen.addColorStop(0.18, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.32, 'rgba(210,225,255,.07)');
  sheen.addColorStop(0.44, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.7, 'rgba(210,225,255,.04)');
  sheen.addColorStop(0.78, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function beltTexture(color, fast) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(4,6,9,.3)';
  g.fillRect(10, 0, 108, 128);
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const n = fast ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * (128 / n) + 14;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(34, y + 10);
    g.lineTo(64, y - 20);
    g.lineTo(94, y + 10);
    g.stroke();
  }
  // side rails of light
  g.shadowBlur = 6;
  g.lineWidth = 2;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.moveTo(12, 0);
  g.lineTo(12, 128);
  g.moveTo(116, 0);
  g.lineTo(116, 128);
  g.stroke();
  return tex(c, { repeat: true });
}

/**
 * A belt that turns: the same lane as a straight belt, bent. It comes in from the left (or right) and leaves through
 * the top; the rails bend round with it and the same chevrons follow the curve, so a robot riding it plainly turns
 * with it. `s` (pixels along the lane) moves the chevrons, redrawn every frame at the belt's speed.
 */
function drawCurve(g, color, fromLeft, fast, s) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, 128, 128);
  if (!fromLeft) {
    g.translate(128, 0);
    g.scale(-1, 1);
  }
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(4,6,9,.3)';
  g.beginPath();
  g.arc(0, 0, 118, 0, Math.PI / 2);
  g.arc(0, 0, 10, Math.PI / 2, 0, true);
  g.closePath();
  g.fill();
  // the chevrons, as on a straight belt (one a space, two on an express belt), along the lane's middle
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 7;
  // `s` is the straight belts' scroll (their texture offset): a chevron sits at the same fraction of the way
  // through a corner as it would through a straight piece, so chevrons pass from straight to curve and back
  // without a jump. (In beltTexture a chevron's middle is at canvas y = (i + .5) * 128 / n + 9.)
  const r = 64;
  const n = fast ? 2 : 1;
  const len = r * (Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const u = (((1 - ((i + 0.5) * (128 / n) + 9) / 128 - s) % 1) + 1) % 1; // 0 entering .. 1 leaving
    for (const w of [u - 1, u, u + 1]) {
      if (w < -0.3 || w > 1.3) continue;
      drawChevronOnCurve(g, r, Math.PI / 2 - (w * len) / r);
    }
  }
  // the side rails of light, bent round
  g.shadowBlur = 6;
  g.lineWidth = 2;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(0, 0, 12, 0, Math.PI / 2);
  g.moveTo(116, 0);
  g.arc(0, 0, 116, 0, Math.PI / 2);
  g.stroke();
  g.globalAlpha = 1;
}
/** A resting laser beam's dashes: lit, gap, repeated along the beam. */
let dashTex = null;
function laserDashTexture() {
  if (dashTex) return dashTex;
  const c = canvas(4, 32);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 4, 19);
  dashTex = tex(c, { repeat: true });
  return dashTex;
}

/** One chevron on a corner's middle line, at angle th, pointing the way the belt runs (as beltTexture draws it). */
function drawChevronOnCurve(g, r, th) {
  g.save();
  g.translate(r * Math.cos(th), r * Math.sin(th));
  g.rotate(th);
  g.beginPath();
  g.moveTo(-30, 15);
  g.lineTo(0, -15);
  g.lineTo(30, 15);
  g.stroke();
  g.restore();
}
function curveTexture(color, fromLeft, fast) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  drawCurve(g, color, fromLeft, fast, 0);
  const t = tex(c);
  t.draw = (s) => {
    drawCurve(g, color, fromLeft, fast, s);
    t.needsUpdate = true;
  };
  return t;
}

function gearTexture(color) {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.shadowColor = color;
  g.shadowBlur = 16;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 7;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
    g.lineTo(Math.cos(a) * 108, Math.sin(a) * 108);
    g.stroke();
  }
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 70, -Math.PI * 0.9, Math.PI * 0.55);
  g.stroke();
  // arrowhead at the end of the arc (clockwise)
  const a = Math.PI * 0.55;
  const ex = Math.cos(a) * 70;
  const ey = Math.sin(a) * 70;
  g.beginPath();
  g.moveTo(ex + 18, ey - 6);
  g.lineTo(ex, ey);
  g.lineTo(ex + 4, ey - 20);
  g.stroke();
  return tex(c);
}

/** A column of light, drawn on a plane that turns to face the camera: soft at the sides, fading upward. */
let columnTex = null;
function columnTexture() {
  if (columnTex) return columnTex;
  const W = 128;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = Math.pow(y / H, 1.6) * (0.35 + 0.65 * Math.pow(y / H, 6)); // canvas y grows down: bright at the foot
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2);
      const k = Math.min(1, (Math.exp(-dx * dx * 60) + Math.exp(-dx * dx * 5) * 0.35) * v);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(k * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  columnTex = tex(c);
  columnTex.userData.shared = true;
  return columnTex;
}

/** A start space's border, as paintLight draws it (a rounded square), but bolder: lit over it in the start phase. */
let padTex = null;
function padBorderTexture() {
  if (padTex) return padTex;
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  g.strokeStyle = '#ffffff';
  g.lineWidth = S * 0.04;
  g.beginPath();
  g.roundRect(S * 0.16, S * 0.16, S * 0.68, S * 0.68, S * 0.1);
  g.stroke();
  padTex = tex(c);
  padTex.userData.shared = true;
  return padTex;
}

/**
 * A flag's ring, lit over the one paintLight draws (radius .4 of a space): a crisp line in a soft glow.
 * On a plane FLAG_RING across, so the line falls at .4.
 */
const FLAG_RING = 1.3;
function flagRingTexture() {
  return sharedTex('flag-ring', () => {
    const W = 256;
    const c = canvas(W, W);
    const g = c.getContext('2d');
    const img = g.createImageData(W, W);
    const at = 0.4 / (FLAG_RING / 2); // the ring's radius, as a share of the plane's half
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - W / 2 + 0.5, y - W / 2 + 0.5) / (W / 2);
        const d = r - at;
        const k = Math.min(1, Math.exp(-((d / 0.035) ** 2)) + Math.exp(-((d / 0.16) ** 2)) * 0.3);
        const i = (y * W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(k * 255);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** A checkpoint's column of light: lit from its foot (a short soft start), fading towards the top. */
let liftedTex = null;
function liftedTexture() {
  if (liftedTex) return liftedTex;
  const W = 128;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const up = 1 - y / H; // 0 at the foot
    const v = Math.min(1, 0.55 + up / 0.12) * Math.pow(1 - up, 1.4); // lit right from the foot, fading out towards the top
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2);
      const k = Math.min(1, (Math.exp(-dx * dx * 60) + Math.exp(-dx * dx * 5) * 0.35) * v * 1.6);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(k * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  liftedTex = tex(c);
  liftedTex.userData.shared = true;
  return liftedTex;
}

/** The soft cross-section of a trail of light (bright in the middle). */
let trailTex = null;
function trailTexture() {
  if (trailTex) return trailTex;
  const c = canvas(4, 64);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  trailTex = tex(c);
  trailTex.userData.shared = true;
  return trailTex;
}

/** The room's background: a dark gradient with a little light above the board. */
function backgroundTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 210, 10, 256, 260, 380);
  grad.addColorStop(0, '#151b24');
  grad.addColorStop(0.55, '#0a0d12');
  grad.addColorStop(1, '#040507');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  return tex(c);
}

/** Soft studio light for reflections on the robots and the glass (a dark room with a few softboxes). */
function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x07090c, side: THREE.BackSide }));
  scene.add(room);
  const box = (w, h, x, y, z, k, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hdr(color, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  box(14, 4, 0, 12, 4, 2.4); // the big overhead softbox
  box(5, 9, -12, 5, -3, 0.9, 0xdfe8ff);
  box(5, 9, 12, 4, 2, 0.7, 0xfff0dc);
  box(30, 1.2, 0, -3, 0, 0.35); // a little light from below, like the glass glowing
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.03).texture;
  pm.dispose();
  scene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// ---------- the arena ----------

export class Arena {
  constructor(container, { quality = 'auto' } = {}) {
    this.container = container;
    // (a stencil buffer: the pits' shafts are drawn only where a hole is seen, see build())
    this.renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = backgroundTexture();
    this.scene.environment = studioEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.9;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 300);
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, stencilBuffer: true }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.useBloom = true;

    this.clock = new THREE.Clock();
    this.time = 0;
    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    this.bots = new Map();
    this.effects = [];
    this.belts = [];
    this.gears = new Map();
    this.pushers = new Map();
    this.columns = [];
    this.marks = new Map();
    this.targeting = false;
    this.course = null;
    this.camMode = 'race';
    this.focusOn = null;
    this.frame = { left: 0.04, right: 0.04, top: 0.1, bottom: 0.2 };
    this.frameTimes = [];
    this.dim = 0; // 0..1: the room's lights going down (the win)
    this.dimCur = 0;
    this.showNames = true;
    this.namesAlways = false; // round 1: name tags stay up, above any floating card
    this.tagsOnly = null; // a Set of ids: only these robots' name tags show (the Briefing's roll call)
    this.beamLinger = 0; // extra seconds a laser beam stays lit (a callout is talking about it)
    this.trace = null; // the board's light tracing on (the Briefing's first shot)
    this.boostT = -10; // the robots' lights brighten for a moment
    this.tempo = 1; // how fast the scene's time runs (the Briefing plays its lessons a little faster)
    this.listeners = new Set();
    // the comic moments: real time (the camera's), slow motion, a shake, a punch-in; mishaps per register
    this.realTime = 0;
    this.slow = null;
    this.quake = null;
    this.punchIn = null;
    this.mishaps = new Map();

    this.buildRoom();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frameLoop();
    };
    loop();
  }

  /** Something happened worth a sound: host.js listens (sound.js). */
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(kind, data = {}) {
    for (const fn of this.listeners) {
      try {
        fn(kind, data);
      } catch (err) {
        console.warn(err);
      }
    }
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const resources = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) resources.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m) continue;
        resources.add(m);
        for (const v of Object.values(m)) if (v?.isTexture && !v.userData?.shared) resources.add(v);
      }
    });
    for (const r of resources) r.dispose?.();
    this.scene.environment?.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers allow only a few live WebGL contexts: give this one back now
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.size = { w, h };
    this.fitCamera();
  }

  // ----- the room around the board -----

  buildRoom() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0x8090a8, 0x3a3f48, 0.55);
    s.add(this.hemi);
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-5, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    s.add(key, key.target);
    this.key = key;

    // the floor far below: dark, with the board's light spilling onto it
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x040507 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    s.add(floor);
    this.spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), color: hdr(0x9fb2cc, 0.16), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.spill.rotation.x = -Math.PI / 2;
    this.spill.position.y = -1.59;
    s.add(this.spill);

    // a few motes of light drifting in the dark
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-22, 22);
      pos[i * 3 + 1] = rand(-1, 9);
      pos[i * 3 + 2] = rand(-20, 14);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8e6, size: 0.035, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.motes);
  }

  // ----- the course -----

  pos(x, y) {
    return new THREE.Vector3(x + 0.5 - this.course.w / 2, 0, y + 0.5 - this.course.h / 2);
  }

  /**
   * Start over on a board: built afresh (even if it's the same one), no robots, nothing still glowing,
   * no cards. The next syncRobots() puts the robots back.
   */
  reset(idOrCourse = this.course) {
    if (idOrCourse) this.setCourse(idOrCourse, { fresh: true });
    this.focusOn = null;
    this.setDim(0);
  }

  /** Build the board for a course (an id from board.js, or a course object the lessons make). Same course: nothing to do, unless fresh. */
  setCourse(idOrCourse, { fresh = false } = {}) {
    const c = typeof idOrCourse === 'string' ? getCourse(idOrCourse) : idOrCourse;
    if (this.course === c && !fresh) return;
    this.course = c;
    // a new board: whatever was still glowing on the old one goes out
    this.epoch = (this.epoch ?? 0) + 1;
    for (const e of this.effects) e.end?.();
    this.effects = [];
    // the robots leave too (models, cards, faces and light trails), and come back with the next view
    for (const b of [...this.bots.values()]) this.removeBot(b);
    this.slow = this.quake = this.punchIn = null;
    this.mishaps.clear();
    for (const obj of [...this.board.children]) {
      this.board.remove(obj);
      obj.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m || m.userData?.shared) continue;
          for (const v of Object.values(m)) if (v?.isTexture && !v.userData?.shared) v.dispose();
          m.dispose?.();
        }
      });
    }
    this.lightLine = null; // (its mesh was on the board, just disposed)
    this.belts = [];
    this.gears.clear();
    this.pushers.clear();
    this.columns = [];
    this.batteries = [];
    this.emitters = [];
    const S = Math.min(112, Math.floor(4096 / Math.max(c.w, c.h)));

    // the slab of glass under each board piece: glowing edges, and no top, so a pit is a hole right through it
    // (the glass top covers the rest; under a pit there's only the drop to the floor far below)
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.25, metalness: 0, emissive: 0x6c7a90, emissiveIntensity: 0.32 });
    const openTop = new THREE.MeshBasicMaterial({ visible: false });
    for (const b of c.boards) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.36, b.h), [edgeMat, edgeMat, openTop, edgeMat, edgeMat, edgeMat]);
      slab.position.set(b.x + b.w / 2 - c.w / 2, -0.184, b.y + b.h / 2 - c.h / 2);
      slab.receiveShadow = true;
      this.board.add(slab);
    }
    // the light the board spills on the floor below
    this.spill.scale.set(c.w * 2.4, c.h * 2.4, 1);

    // the glass top: smoky color, light drawn into it, holes for the pits
    const glass = tex(paintGlass(c, S));
    const light = tex(paintLight(c, S, { inert: !!this.inertBatteries }));
    this.topMat = new THREE.MeshStandardMaterial({
      map: glass, alphaTest: 0.5, transparent: false, roughness: 0.2, metalness: 0.0,
      emissive: 0xffffff, emissiveMap: light, emissiveIntensity: 1.0, envMapIntensity: 0.9,
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), this.topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0;
    top.receiveShadow = true;
    this.board.add(top);

    // pits: a shaft through the glass, lit at the rim and falling away into the dark
    const pitWallTex = (() => {
      const cv = canvas(8, 64);
      const g = cv.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, 'rgba(190,200,220,1)');
      grad.addColorStop(0.03, 'rgba(70,82,100,1)');
      grad.addColorStop(0.2, 'rgba(10,12,16,1)');
      grad.addColorStop(0.45, 'rgba(0,0,0,1)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 8, 64);
      return tex(cv);
    })();
    // The shaft is drawn only through its hole: an invisible lid marks where the hole is seen (the stencil), and
    // the shaft's walls and floor draw only there. From any other angle (under the board's edge) it isn't there.
    const pitMaskMat = new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    });
    const throughHole = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp };
    const pitWallMat = new THREE.MeshBasicMaterial({ map: pitWallTex, side: THREE.DoubleSide, ...throughHole });
    const pitVoidMat = new THREE.MeshBasicMaterial({ color: 0x000000, ...throughHole });

    // belts, gears, batteries
    const beltMats = {};
    const beltMat = (fast) => {
      if (!beltMats[fast]) {
        const t = beltTexture(fast ? PALETTE.express : PALETTE.belt, fast);
        beltMats[fast] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: hdr(0xffffff, 1.25) });
        this.belts.push({ tex: t, speed: fast ? 1.0 : 0.5, fast, mat: beltMats[fast], pulse: 0 });
      }
      return beltMats[fast];
    };
    const curveMats = {};
    this.curveMats = [];
    const curveMat = (fast, left) => {
      const k = `${fast}${left}`;
      if (!curveMats[k]) {
        const t = curveTexture(fast ? PALETTE.express : PALETTE.belt, left, fast);
        curveMats[k] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: hdr(0xffffff, 1.25) });
        this.curveMats.push({ mat: curveMats[k], fast, tex: t, s: 0 });
      }
      return curveMats[k];
    };
    const gearTex = { 1: gearTexture(PALETTE.right), [-1]: gearTexture(PALETTE.left) };
    const batteryGlow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: hdr(PALETTE.energy, 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = c.cells[y * c.w + x];
        if (!cell) continue;
        const p = this.pos(x, y);
        if (cell.k === 'pit') {
          // a deep shaft, black below its rim, closed far down: looking in shows only dark (not the floor's light)
          const depth = 1.5;
          // the lid (drawn after the robots, so a robot in front of the hole hides it), then the shaft
          const lid = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pitMaskMat);
          lid.rotation.x = -Math.PI / 2;
          lid.position.set(p.x, 0, p.z);
          lid.renderOrder = 5;
          this.board.add(lid);
          const bottom = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pitVoidMat);
          bottom.rotation.x = -Math.PI / 2;
          bottom.position.set(p.x, -depth, p.z);
          bottom.renderOrder = 6;
          this.board.add(bottom);
          for (let d = 0; d < 4; d++) {
            const n = c.cells[(y + DY[d]) * c.w + x + DX[d]];
            if (n?.k === 'pit' && x + DX[d] >= 0 && x + DX[d] < c.w) continue; // pits side by side make one hole
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, depth), pitWallMat);
            wall.position.set(p.x + DX[d] * 0.5, -depth / 2, p.z + DY[d] * 0.5);
            wall.rotation.y = Math.atan2(-DX[d], -DY[d]);
            wall.renderOrder = 6;
            this.board.add(wall);
          }
        } else if (cell.k === 'belt') {
          const ins = beltInputs(c, x, y);
          const back = turn(cell.d, 2);
          const side = ins.find((d) => d !== back);
          const curve = side != null && !ins.includes(back);
          const left = side === turn(cell.d, 3);
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), curve ? curveMat(cell.fast, left) : beltMat(cell.fast));
          plate.rotation.x = -Math.PI / 2;
          plate.rotation.z = -cell.d * (Math.PI / 2);
          plate.position.set(p.x, 0.004, p.z);
          plate.renderOrder = 1;
          this.board.add(plate);
        } else if (cell.k === 'gear') {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ map: gearTex[cell.spin], transparent: true, depthWrite: false, color: hdr(0xffffff, 1.3) }));
          m.rotation.x = -Math.PI / 2;
          m.position.set(p.x, 0.005, p.z);
          if (cell.spin < 0) m.scale.x = -1;
          this.board.add(m);
          this.gears.set(`${x},${y}`, { mesh: m, spin: cell.spin, extra: 0, pulse: 0 });
        } else if (cell.k === 'battery' && !this.inertBatteries) {
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), batteryGlow);
          glow.rotation.x = -Math.PI / 2;
          glow.position.set(p.x, 0.006, p.z);
          this.board.add(glow);
          this.batteries.push(glow);
        }
      }
    }
    this.batteryMat = batteryGlow;

    // walls: fins of frosted glass with a bright top edge
    const finMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.2, metalness: 0, emissive: 0xdfe6f0, emissiveIntensity: 0.12, transparent: true, opacity: 0.8 });
    const capMat = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.light, 1.25) });
    this.wallMats = { finMat, capMat };
    for (const w of wallEdges(c)) this.board.add(this.wallFin(w));
    this.perimeterGroup = null;
    this.perimeterShown = null;
    this.buildPerimeter();

    // wall lasers: a small dark housing with a red eye
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.3, metalness: 0.3 });
    const lensMat = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.laser, 3) });
    for (const L of c.lasers) {
      const side = turn(L.d, 2);
      const p = this.pos(L.x, L.y);
      const g = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), housingMat);
      housing.castShadow = true;
      g.add(housing);
      for (let i = 0; i < L.n; i++) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set((i - (L.n - 1) / 2) * LASER_GAP, 0, -0.07);
        g.add(lens);
      }
      g.position.set(p.x + DX[side] * 0.4, 0.2, p.z + DY[side] * 0.4);
      g.rotation.y = -L.d * (Math.PI / 2);
      this.board.add(g);
      this.emitters.push(L);
      // its beams, dashed lines of light at the lens height, from each lens to where the beam stops
      this.board.updateMatrixWorld(true);
      const path = beamPath(c, L.x, L.y, L.d);
      const last = this.pos(path.at(-1).x, path.at(-1).y);
      for (const lens of g.children.slice(1)) {
        const from = this.board.worldToLocal(lens.getWorldPosition(new THREE.Vector3()));
        const to = new THREE.Vector3(L.d % 2 ? last.x + DX[L.d] * 0.47 : from.x, from.y, L.d % 2 ? from.z : last.z + DY[L.d] * 0.47);
        const len = from.distanceTo(to);
        if (len < 0.05) continue;
        const dashes = laserDashTexture().clone();
        dashes.repeat.set(1, len / 0.24);
        dashes.needsUpdate = true;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, len, 6, 1, true),
          new THREE.MeshBasicMaterial({ map: dashes, color: hdr(PALETTE.laser, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        beam.position.copy(from).add(to).multiplyScalar(0.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        this.board.add(beam);
      }
    }

    // push panels: a pale plate on the wall; five dots show the registers it pushes on
    for (const q of c.pushers) {
      const p = this.pos(q.x, q.y);
      const g = new THREE.Group();
      const dots = canvas(256, 64);
      const dg = dots.getContext('2d');
      dg.fillStyle = 'rgba(20,24,30,1)';
      dg.beginPath();
      dg.roundRect(0, 0, 256, 64, 16);
      dg.fill();
      for (let i = 1; i <= 5; i++) {
        const on = q.regs.includes(i);
        dg.fillStyle = on ? PALETTE.light : 'rgba(244,239,228,.18)';
        if (on) {
          dg.shadowColor = PALETTE.light;
          dg.shadowBlur = 10;
        } else dg.shadowBlur = 0;
        dg.beginPath();
        dg.arc(28 + (i - 1) * 50, 32, on ? 11 : 7, 0, TAU);
        dg.fill();
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.05), [housingMat, housingMat, housingMat, housingMat, new THREE.MeshBasicMaterial({ map: tex(dots), color: hdr(0xffffff, 1.4) }), housingMat]);
      g.add(back);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.6, emissive: 0x404650, emissiveIntensity: 0.4 }));
      plate.position.z = 0.05;
      plate.position.y = -0.0;
      g.add(plate);
      const into = turn(q.side, 2);
      g.position.set(p.x + DX[q.side] * 0.43, 0.16, p.z + DY[q.side] * 0.43);
      g.rotation.y = Math.atan2(DX[into], DY[into]);
      g.traverse((o) => (o.castShadow = true));
      this.board.add(g);
      this.pushers.set(`${q.x},${q.y}`, { plate, kick: null });
    }

    // checkpoints: a slender column of light standing on the far edge of the flag's ring, so from the camera
    // its foot just touches the top of the circle (the number below stays clear). frameLoop keeps it there.
    const colGeo = new THREE.PlaneGeometry(1.1, 3.8).translate(0, 1.9, 0);
    for (const cp of c.checkpoints) {
      const p = this.pos(cp.x, cp.y);
      const mat = new THREE.MeshBasicMaterial({ map: liftedTexture(), color: hdr(PALETTE.light, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const col = new THREE.Mesh(colGeo, mat);
      col.position.set(p.x, 0, p.z);
      col.userData.center = p.clone();
      col.renderOrder = 5;
      this.board.add(col);
      const inner = null;
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: glowTexture(), color: hdr(PALETTE.light, 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(p.x, 0.007, p.z);
      this.board.add(halo);
      const taken = new THREE.Group();
      taken.position.set(p.x, 0, p.z);
      this.board.add(taken);
      // someone's next flag: its ring breathes with its column (setTargets)
      const aura = new THREE.Mesh(new THREE.PlaneGeometry(FLAG_RING, FLAG_RING), new THREE.MeshBasicMaterial({ map: flagRingTexture(), color: hdr(PALETTE.light, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.rotation.x = -Math.PI / 2;
      aura.position.set(p.x, 0.012, p.z);
      aura.visible = false;
      this.board.add(aura);
      this.columns.push({ n: cp.n, col, inner, halo, mat, base: 0.9, flash: 0, flashColor: new THREE.Color(PALETTE.light), taken, takenKey: '', aura, aim: 0, tgt: 0, lead: 0 });
    }
    this.marks = new Map(); // robot id -> its mark at the flag it's heading for (setTargets)
    this.targeting = false;

    // the key light's shadows cover the course
    const r = Math.max(c.w, c.h) * 0.72;
    Object.assign(this.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 60 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.position.set(-c.w * 0.3, 16, c.h * 0.6);
    this.startTags = null;
    this.startKey = null;
    this.fitCamera();
  }

  // ----- the camera -----

  /**
   * Where the board should sit on screen: margins as fractions of the canvas. headroom: how high above the
   * far edge things float (cards over robots, names above them) that must stay inside the frame. With it,
   * that whole box is centred in the frame; without it (null), the glass alone is centred (2.3 is fitted).
   */
  setFrame(frame) {
    const key = JSON.stringify(frame);
    if (key === this.frameKey) return;
    this.frameKey = key;
    this.frame = { ...this.frame, ...frame };
    this.fitCamera();
  }

  fitCamera() {
    if (!this.course || !this.size) return;
    const c = this.course;
    const cam = this.camera;
    const f = this.frame;
    // on a tall screen (a phone held upright) a wide board turns a quarter: its long side runs up the screen,
    // seen from a little higher so the far end still reads
    const room = (this.size.w * (2 - f.left - f.right)) / (this.size.h * (2 - f.top - f.bottom)); // the frame's shape
    this.turned = room < 0.8 && c.w > c.h * 1.1;
    const az = this.turned ? -Math.PI / 2 : 0;
    const elev = THREE.MathUtils.degToRad(this.turned ? 70 : c.w > c.h * 1.7 ? 50 : 54);
    const target = new THREE.Vector3(0, 0, 0);
    const fw = 2 - f.left - f.right; // the frame's size in NDC (the whole view is 2 x 2)
    const fh = 2 - f.top - f.bottom;
    const corners = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // the far edge has robots with cards floating over them; the near edge, the slab's thickness
      const far = this.turned ? x > 0 : z < 0;
      corners.push(new THREE.Vector3((x * c.w) / 2, far ? f.headroom ?? 2.3 : 0.3, (z * c.h) / 2), new THREE.Vector3((x * c.w) / 2, -0.36, (z * c.h) / 2));
    }
    if (cam.view?.enabled) cam.clearViewOffset();
    let lo = 3;
    let hi = 200;
    for (let i = 0; i < 36; i++) {
      const dist = (lo + hi) / 2;
      cam.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let x0 = 9;
      let x1 = -9;
      let y0 = 9;
      let y1 = -9;
      for (const p of corners) {
        const v = p.clone().project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      if (x1 - x0 <= fw && y1 - y0 <= fh) hi = dist;
      else lo = dist;
    }
    this.camHome = { dist: hi, elev, az, target };
    this.camCur = null;
    // faces and stars grow with the board, so they read the same from across the room on any course
    this.faceScale = Math.max(1, Math.min(1.7, hi / 13));
  }

  /** The camera's wish for this moment: { az, el, d, tgt } */
  camWish(t) {
    const home = this.camHome;
    let az = home.az + Math.sin(t * 0.07) * 0.03;
    let d = home.dist;
    let el = home.elev;
    const tgt = home.target.clone();
    if (this.camMode === 'orbit') {
      az = home.az + Math.sin(t * 0.05) * 0.32;
      el = home.elev - 0.12;
      d = home.dist * 1.02;
    } else if (this.camMode === 'drift') {
      // while people program: the room breathes, the camera drifts slowly
      az = home.az + Math.sin(t * 0.045) * 0.11;
      el = home.elev - 0.03 + Math.sin(t * 0.03) * 0.02;
      d = home.dist * 1.03;
    } else if (this.camMode === 'lesson') {
      az = home.az + Math.sin(t * 0.06) * 0.18;
      el = home.elev - 0.08;
    } else if (this.camMode === 'start') {
      const dock = this.course.boards.find((b) => b.dock);
      if (dock) {
        tgt.set(dock.x + dock.w / 2 - this.course.w / 2, 0, dock.y + dock.h / 2 - this.course.h / 2);
        tgt.lerp(home.target, 0.5);
        d = home.dist * 0.84;
        el = home.elev + 0.04;
      }
    }
    if (this.focusOn) {
      const b = this.bots.get(this.focusOn);
      if (b) {
        tgt.copy(b.group.position).setY(0.35);
        d = Math.max(7, home.dist * 0.45);
        el = home.elev - 0.2;
        az = t * 0.1;
      }
    }
    return { az, el, d, tgt };
  }

  placeCamera(t, dt) {
    if (!this.camHome) return;
    const w = this.camWish(t);
    if (!this.camCur) this.camCur = { az: w.az, el: w.el, d: w.d, tgt: w.tgt.clone(), sx: 0, sy: 0 };
    const cc = this.camCur;
    const k = 1 - Math.exp(-dt * 1.6);
    cc.az += wrapAngle(w.az - cc.az) * k;
    cc.d += (w.d - cc.d) * k;
    cc.el += (w.el - cc.el) * k;
    cc.tgt.lerp(w.tgt, k);
    const cam = this.camera;
    // a punch-in on a big moment: quick in, a held beat, ease back out (in real time, even in slow motion)
    let punch = 0;
    const tgt = cc.tgt.clone();
    let dist = cc.d;
    if (this.punchIn) {
      const P = this.punchIn;
      const s = this.realTime - P.t0;
      punch = s < 0.22 ? easeOut(s / 0.22) : s < 0.22 + P.hold ? 1 : 1 - ease(Math.min(1, (s - 0.22 - P.hold) / 0.8));
      if (s > 1.02 + P.hold) this.punchIn = null;
      tgt.lerp(P.at, 0.7 * punch);
      dist *= 1 - P.k * punch;
    }
    cam.position.set(tgt.x + Math.sin(cc.az) * Math.cos(cc.el) * dist, tgt.y + Math.sin(cc.el) * dist, tgt.z + Math.cos(cc.az) * Math.cos(cc.el) * dist);
    cam.lookAt(tgt);
    // a shake: the camera jolts and settles
    if (this.quake) {
      const Q = this.quake;
      const s = (this.realTime - Q.t0) / Q.dur;
      if (s >= 1) this.quake = null;
      else {
        const a = Q.amp * (1 - s) ** 2 * dist * 0.006;
        const r = this.realTime * 70;
        cam.position.x += Math.sin(r * 1.13) * a;
        cam.position.y += Math.sin(r * 0.91 + 1.7) * a * 0.6;
        cam.position.z += Math.sin(r * 1.37 + 0.4) * a * 0.5;
        cam.lookAt(tgt);
        cam.rotateZ(Math.sin(r * 0.77) * Q.amp * (1 - s) ** 2 * 0.004);
      }
    }
    // slide the picture so the board sits in the middle of its frame
    const f = this.frame;
    const cx = (f.left - f.right) / 2; // where the frame's center is, in NDC
    const cy = (f.bottom - f.top) / 2;
    let sx = 0;
    let sy = 0;
    if (!this.focusOn && this.camMode !== 'start') {
      cam.updateMatrixWorld();
      if (cam.view?.enabled) cam.clearViewOffset();
      const c = this.course;
      let x0 = 9;
      let x1 = -9;
      let y0 = 9;
      let y1 = -9;
      // the board's glass sits in the middle of the frame; with a headroom, the whole box does (the glass and
      // the cards floating over its far edge), so the cards stay inside the frame too
      const room = f.headroom != null;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const far = this.turned ? x > 0 : z < 0;
        for (const h of room ? [far ? f.headroom : 0.3, -0.36] : [0]) {
          const v = new THREE.Vector3((x * c.w) / 2, h, (z * c.h) / 2).project(cam);
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
          y0 = Math.min(y0, v.y);
          y1 = Math.max(y1, v.y);
        }
      }
      sx = cx - (x0 + x1) / 2;
      sy = cy - (y0 + y1) / 2;
    } else {
      sx = cx;
      sy = cy;
    }
    cc.sx += (sx - cc.sx) * Math.min(1, k * 2);
    cc.sy += (sy - cc.sy) * Math.min(1, k * 2);
    // while punched in, the moment (not the whole board) is what sits in the middle of the frame
    const fx = cc.sx + (cx - cc.sx) * punch;
    const fy = cc.sy + (cy - cc.sy) * punch;
    const { w: W, h: H } = this.size;
    cam.setViewOffset(W, H, (-fx * W) / 2, (fy * H) / 2, W, H);
  }

  // ----- robots -----

  /** Make sure every robot exists and stands where the view says (unless it's mid-animation). */
  syncRobots(list) {
    const seen = new Set();
    for (const r of list) {
      if (r.x == null) continue;
      seen.add(r.id);
      let b = this.bots.get(r.id);
      const form = r.form ?? formOf(r);
      if (b && b.form !== form) {
        this.removeBot(b);
        b = null;
      }
      if (!b) {
        b = this.addBot(r, form);
        b.x = r.x;
        b.y = r.y;
        b.rot = -r.d * (Math.PI / 2);
        b.visible = r.on !== false;
        b.pop = this.time;
      }
      b.target = r;
      b.away = !!r.away;
      if (b.color !== r.color) {
        b.color = r.color;
        b.model.setColor(r.color);
      }
      if (b.name !== r.name) this.renameBot(b, r.name);
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
      const diff = wrapAngle(want - b.rot);
      if (Math.abs(diff) > 0.01) this.turnTo(b, b.rot + diff, 0.4);
    }
    for (const [id, b] of this.bots) if (!seen.has(id)) this.removeBot(b);
  }

  addBot(r, form) {
    const model = makeRobot(form, r.color);
    const g = model.group;
    this.scene.add(g);
    const b = {
      id: r.id, form, model, group: g, color: r.color, name: null, x: r.x, y: r.y, rot: 0, visible: true, busyUntil: 0, anims: [],
      pop: this.time, trail: [], trailMesh: null, phase: Math.random() * TAU, ready: false, deciding: false, acting: 0, hurt: 0, glitch: 0,
    };
    this.bots.set(r.id, b);
    this.renameBot(b, r.name);
    this.makeTrail(b);
    return b;
  }

  renameBot(b, name) {
    b.name = name;
    if (b.tag) {
      b.group.remove(b.tag);
      b.tag.material.map.dispose();
      b.tag.material.dispose();
    }
    b.tag = name ? labelSprite(String(name).toUpperCase(), { height: 0.24, weight: 500, track: 0.12 }) : null;
    if (b.tag) {
      b.tag.position.y = 0.86;
      b.group.add(b.tag);
    }
  }

  removeBot(b) {
    this.clearChaos(b);
    this.dropShutMark(b);
    this.scene.remove(b.group);
    if (b.card) {
      this.fxGroup.remove(b.card);
      b.card.material.map.dispose();
      b.card.material.dispose();
      b.card = null;
    }
    if (b.trailMesh) {
      this.fxGroup.remove(b.trailMesh);
      b.trailMesh.geometry.dispose();
      b.trailMesh.material.dispose();
    }
    b.model.dispose();
    b.tag?.material.map.dispose();
    b.tag?.material.dispose();
    this.bots.delete(b.id);
  }

  makeTrail(b) {
    const N = 90;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const uv = new Float32Array(N * 2 * 2);
    for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: trailTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    this.fxGroup.add(mesh);
    b.trailMesh = mesh;
    b.trailN = N;
  }

  updateTrail(b, t) {
    const life = 3.2;
    while (b.trail.length && t - b.trail[0].t > life) b.trail.shift();
    const mesh = b.trailMesh;
    const pts = b.trail;
    if (pts.length < 2) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }
    const n = Math.min(pts.length, b.trailN);
    const start = pts.length - n;
    const pos = mesh.geometry.attributes.position.array;
    const col = mesh.geometry.attributes.color.array;
    const color = new THREE.Color(b.color);
    for (let i = 0; i < n; i++) {
      const p = pts[start + i];
      const q = pts[start + Math.min(n - 1, i + 1)];
      const o = pts[start + Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const age = (t - p.t) / life;
      const fade = Math.max(0, 1 - age) ** 1.6 * Math.min(1, i / 3);
      const w = 0.16 + 0.06 * (1 - age);
      pos.set([p.x - dz * w, 0.008, p.z + dx * w, p.x + dz * w, 0.008, p.z - dx * w], i * 6);
      const k = fade * 1.8;
      col.set([color.r * k, color.g * k, color.b * k, color.r * k, color.g * k, color.b * k], i * 6);
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.color.needsUpdate = true;
    mesh.geometry.setDrawRange(0, (n - 1) * 6);
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

  /** Programming: who has locked in (their light brightens). */
  setReady(ids) {
    for (const b of this.bots.values()) b.ready = ids ? ids.has(b.id) : false;
    this.readyMode = !!ids;
  }

  /** A decision is pending on this robot's phone. */
  setDeciding(id) {
    for (const b of this.bots.values()) b.deciding = b.id === id;
  }

  /** Upgrades off: batteries do nothing, so they're drawn inert (faint, no glow). Rebuilds the board if it changes. */
  setBatteriesInert(on) {
    if (!!this.inertBatteries === !!on) return;
    this.inertBatteries = !!on;
    if (this.course?.cells.some((cell) => cell?.k === 'battery')) this.setCourse(this.course, { fresh: true });
  }

  /** One wall: a fin of frosted glass with a bright top edge, on edge {x, y, side} (side 0: north, 3: west of x,y). */
  wallFin(w) {
    const c = this.course;
    const { finMat, capMat } = this.wallMats;
    const g = new THREE.Group();
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.26, 0.035), finMat);
    fin.position.y = 0.13;
    fin.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.012, 0.038), capMat);
    cap.position.y = 0.262;
    g.add(fin, cap);
    if (w.side === 0) g.position.set(w.x + 0.5 - c.w / 2, 0, w.y - c.h / 2);
    else {
      g.position.set(w.x - c.w / 2, 0, w.y + 0.5 - c.h / 2);
      g.rotation.y = Math.PI / 2;
    }
    return g;
  }

  /**
   * "Map perimeter" (the lessDeadly option): a wall all the way round the course's outer edge, like any other
   * wall. course: the course it's on for (only that course gets it, not a lesson board borrowing the arena), or null.
   */
  setPerimeter(course) {
    this.perimeterFor = course ?? null;
    this.buildPerimeter();
  }

  buildPerimeter() {
    const c = this.course;
    const want = !!c && !!this.wallMats && this.perimeterFor === c;
    if (this.perimeterShown === want && (!want || this.perimeterGroup)) return;
    if (this.perimeterGroup) {
      this.board.remove(this.perimeterGroup);
      this.perimeterGroup.traverse((o) => o.geometry?.dispose());
      this.perimeterGroup = null;
    }
    this.perimeterShown = want;
    if (!want) return;
    const g = new THREE.Group();
    const has = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && !!c.cells[y * c.w + x];
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = c.cells[y * c.w + x];
        if (!cell) continue;
        for (let d = 0; d < 4; d++) {
          if (has(x + DX[d], y + DY[d]) || cell.walls & (1 << d)) continue; // inside, or a wall there already
          if (d === 0) g.add(this.wallFin({ x, y, side: 0 }));
          else if (d === 3) g.add(this.wallFin({ x, y, side: 3 }));
          else if (d === 1) g.add(this.wallFin({ x: x + 1, y, side: 3 }));
          else g.add(this.wallFin({ x, y: y + 1, side: 0 }));
        }
      }
    }
    this.perimeterGroup = g;
    this.board.add(g);
  }

  /** Which checkpoints each robot has (colored rings at the foot of each column). */
  setTaken(robots) {
    for (const col of this.columns) {
      const owners = robots.filter((r) => (r.cp ?? 0) >= col.n);
      const key = owners.map((r) => r.color).join();
      if (key === col.takenKey) continue;
      col.takenKey = key;
      for (const o of [...col.taken.children]) {
        col.taken.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
      owners.forEach((r, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: hdr(r.color, 1.8) }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.06 + i * 0.07;
        col.taken.add(ring);
      });
    }
  }

  /**
   * The flags the robots are heading for (the race). Each such flag's ring and column breathe together, slowly,
   * and a bead of light in each robot's color stands at the ring's rim, so the room sees who's heading where;
   * the race leader's flag (lead) breathes a little stronger. When a robot reaches its flag, its bead hops on to
   * the next one, once the flag's own flash has had its moment. A flag nobody is heading for stands still.
   * list: [{ id, color, n, lead }] in seat order, or null: nothing breathes (the lessons, setup, the win).
   */
  setTargets(list) {
    this.targeting = !!list;
    const want = new Map();
    (list ?? []).forEach((r, i) => {
      if (this.columns.some((c) => c.n === r.n)) want.set(r.id, { ...r, i });
    });
    for (const [id, m] of this.marks) if (!want.has(id)) m.leaving = true;
    for (const [id, r] of want) {
      let m = this.marks.get(id);
      if (!m || m.leaving) {
        if (m) this.dropMark(m);
        m = this.makeMark(r);
        this.marks.set(id, m);
      }
      m.i = r.i;
      m.lead = !!r.lead;
      if (m.color !== r.color) {
        m.color = r.color;
        m.core.material.color.copy(hdr(r.color, 1.7));
        m.glow.material.color.copy(hdr(r.color, 0.9));
      }
      const goal = m.next ?? m.n;
      if (r.n === goal) continue;
      if (r.n > goal) {
        // it reached a flag: the bead waits out the flag's flash, then hops on
        m.next = r.n;
        m.hopAt = this.realTime + (m.placed ? 1.1 : 0);
      } else {
        m.n = r.n; // (back to an earlier flag: a new race) it glides there
        m.next = null;
      }
    }
  }

  makeMark(r) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), new THREE.MeshBasicMaterial({ color: hdr(r.color, 1.7), transparent: true, opacity: 0 }));
    core.position.y = 0.11;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: glowTexture(), color: hdr(r.color, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.014;
    group.add(core, glow);
    group.visible = false;
    this.board.add(group);
    return { id: r.id, n: r.n, next: null, hopAt: 0, hop: null, color: r.color, lead: !!r.lead, i: 0, group, core, glow, k: 0, placed: false, leaving: false };
  }

  dropMark(m) {
    this.board.remove(m.group);
    m.core.geometry.dispose();
    m.core.material.dispose();
    m.glow.geometry.dispose();
    m.glow.material.dispose();
    if (this.marks.get(m.id) === m) this.marks.delete(m.id);
  }

  /** Every frame: the beads find their places round their flags' rings (the side facing the camera), hop, fade. */
  updateMarks(real) {
    if (!this.marks.size) return;
    const eye = this.board.worldToLocal(this.camera.position.clone());
    const now = this.realTime;
    for (const m of this.marks.values()) {
      if (m.next != null && now >= m.hopAt && !m.leaving) {
        m.hop = { t0: now, from: m.group.position.clone() };
        m.n = m.next;
        m.next = null;
      }
    }
    const at = new Map();
    for (const m of this.marks.values()) if (!m.leaving) (at.get(m.n) ?? at.set(m.n, []).get(m.n)).push(m);
    const slot = new THREE.Vector3();
    for (const m of [...this.marks.values()]) {
      const col = this.columns.find((c) => c.n === m.n);
      if (!col) {
        this.dropMark(m);
        continue;
      }
      const ctr = col.col.userData.center;
      const here = at.get(m.n) ?? [m];
      here.sort((a, b) => a.i - b.i);
      const j = Math.max(0, here.indexOf(m));
      // in a row along the ring's near side, centred on the camera's line of sight
      const front = Math.atan2(eye.z - ctr.z, eye.x - ctr.x);
      const step = here.length > 6 ? 0.37 : 0.45;
      const a = front + (j - (here.length - 1) / 2) * step;
      slot.set(ctr.x + Math.cos(a) * 0.58, 0, ctr.z + Math.sin(a) * 0.58);
      if (m.hop) {
        const d = m.hop.from.distanceTo(slot);
        const dur = Math.min(2.2, 0.9 + d * 0.09);
        const k = Math.min(1, (now - m.hop.t0) / dur);
        const e = ease(k);
        m.group.position.lerpVectors(m.hop.from, slot, e);
        m.group.position.y = Math.sin(Math.PI * k) * Math.min(2.4, 0.5 + d * 0.22);
        if (k >= 1) m.hop = null;
      } else if (!m.placed) {
        m.group.position.copy(slot);
        m.placed = true;
      } else m.group.position.lerp(slot, Math.min(1, real * 4));
      m.k += ((m.leaving ? 0 : 1) - m.k) * Math.min(1, real * 2.5);
      if (m.leaving && m.k < 0.02) {
        this.dropMark(m);
        continue;
      }
      const lit = 1 - this.dimCur;
      m.group.visible = m.k > 0.01;
      m.core.material.opacity = m.k;
      m.core.scale.setScalar(0.5 + 0.5 * m.k);
      // the glow stays on the glass while the bead is in the air, fainter the higher it goes
      m.glow.position.y = 0.014 - m.group.position.y;
      m.glow.material.opacity = m.k * (0.35 + 0.65 * lit) / (1 + m.group.position.y * 2);
    }
  }

  /** A wave of light across the whole board (a new round). */
  pulse(color = PALETTE.light) {
    if (!this.course) return;
    this.ring(new THREE.Vector3(0, 0, 0), color, Math.max(this.course.w, this.course.h) * 0.75, 0.03, 2.6);
  }

  /** The lights go down (0..1), e.g. for the winner. */
  setDim(k) {
    this.dim = k;
  }

  // ----- teaching: small helpers for the Briefing, the first-time callouts and the lobby film -----

  /** A point in the world, on screen: CSS px within the container. */
  project(v) {
    if (!this.size) return { x: 0, y: 0 };
    this.camera.updateMatrixWorld();
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.size.w, y: ((1 - p.y) / 2) * this.size.h };
  }

  /**
   * What's under a point on the screen (client px): { robot: id } for a robot's body, otherwise the square
   * { x, y, fx, fy } (fx, fy: where in the square, 0..1; x, y may be off the course), or null off the glass.
   */
  pick(clientX, clientY) {
    if (!this.course || !this.size) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    // a robot first: the nearest body within about half a space of the point
    let best = null;
    for (const [id, b] of this.bots) {
      if (!b.group.visible) continue;
      const c = b.group.position.clone();
      c.y += 0.3;
      const p = this.project(c);
      const edge = this.project(c.clone().add(new THREE.Vector3(0.42, 0, 0)));
      const r = Math.max(14, Math.hypot(edge.x - p.x, edge.y - p.y));
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < r && (!best || d < best.d)) best = { id, d };
    }
    if (best) return { robot: best.id };
    const ndc = new THREE.Vector2((sx / rect.width) * 2 - 1, -(sy / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    this.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
    this.board.updateMatrixWorld();
    const local = this.board.worldToLocal(hit);
    const gx = local.x + this.course.w / 2;
    const gy = local.z + this.course.h / 2;
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    if (x < -1 || y < -1 || x > this.course.w || y > this.course.h) return null;
    return { x, y, fx: gx - x, fy: gy - y };
  }

  /** Where a robot is on screen (its body), or null. */
  screenPos(id) {
    const b = this.bots.get(id);
    if (!b) return null;
    const p = b.group.position.clone();
    p.y += 0.45;
    return this.project(p);
  }

  /** Where a space of the course is on screen. */
  cellScreenPos(x, y, h = 0) {
    if (!this.course) return null;
    return this.project(this.pos(x, y).setY(h));
  }

  /**
   * A dotted line of light on the glass, with a numbered dot where each card ends: the phones' light line,
   * on the big screen. ghosts: [{ x, y, n, path: [[x, y]...] }] (minimap.previewProgram's shape; n null for
   * a plain dot). A longer line than before grows on from where the old one ended.
   */
  ghostPath(ghosts, color = PALETTE.light) {
    if (!this.course) return;
    const c = this.course;
    if (!this.lightLine) {
      const S = Math.max(40, Math.min(112, Math.floor(1800 / Math.max(c.w, c.h))));
      const cv = canvas(c.w * S, c.h * S);
      const t = tex(cv);
      const mat = new THREE.MeshBasicMaterial({ map: t, color: hdr(0xffffff, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
      m.renderOrder = 2;
      this.board.add(m);
      this.lightLine = { m, cv, t, S, mat, pts: [], cum: [0], marks: [], shown: 0, drawn: -1, fadeT: null };
    }
    const G = this.lightLine;
    // as the phones draw it (minimap.drawGhostLine): only the slots filled in a row from slot 1, up to the first
    // empty one (numbered ghosts; plain dots, n null, are all kept)
    const run = [];
    for (const gh of ghosts) {
      if (gh.n != null && gh.n !== run.length + 1) break;
      run.push(gh);
    }
    const pts = [];
    const marks = [];
    run.forEach((gh, i) => {
      for (const [x, y] of gh.path?.length ? gh.path : [[gh.x, gh.y]]) {
        const last = pts.at(-1);
        if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
      }
      // where it turned: given (previewProgram), or worked out (a new facing; the first slot: it didn't move)
      const prev = run[i - 1];
      const turned = gh.d == null ? false : gh.turned ?? (prev ? prev.d !== gh.d : (gh.path?.length ?? 1) <= 1);
      marks.push({ x: gh.x, y: gh.y, n: gh.n ?? null, d: gh.d ?? null, turned, at: pts.length - 1 });
    });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    Object.assign(G, { pts, cum, marks, color, fadeT: null, drawn: -1 });
    G.shown = Math.min(G.shown, cum.at(-1) ?? 0);
    G.mat.opacity = 1;
  }

  /** The light line fades away. */
  clearGhost() {
    if (this.lightLine && this.lightLine.fadeT == null) this.lightLine.fadeT = this.time;
  }

  updateGhost(dt) {
    const G = this.lightLine;
    if (!G) return;
    if (G.fadeT != null) {
      const k = (this.time - G.fadeT) / 0.45;
      G.mat.opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.board.remove(G.m);
        G.m.geometry.dispose();
        G.mat.dispose();
        G.t.dispose();
        this.lightLine = null;
      }
      return;
    }
    const len = G.cum.at(-1) ?? 0;
    if (G.shown < len) G.shown = Math.min(len, G.shown + dt * 7); // it grows at 7 spaces a second
    if (G.drawn === G.shown) return;
    G.drawn = G.shown;
    G.cv.width = G.cv.width; // a full reset (with canvas shadows, clearRect alone can leave the last glow behind)
    const g = G.cv.getContext('2d');
    const S = G.S;
    const X = (x) => (x + 0.5) * S;
    const Y = (y) => (y + 0.5) * S;
    g.save();
    g.shadowColor = G.color;
    g.shadowBlur = S * 0.14;
    g.strokeStyle = G.color;
    g.lineCap = 'round';
    g.lineWidth = S * 0.075;
    g.setLineDash([0.001, S * 0.19]);
    g.beginPath();
    g.moveTo(X(G.pts[0]?.[0] ?? 0), Y(G.pts[0]?.[1] ?? 0));
    for (let i = 1; i < G.pts.length; i++) {
      const [x0, y0] = G.pts[i - 1];
      const [x1, y1] = G.pts[i];
      if (G.cum[i] <= G.shown) g.lineTo(X(x1), Y(y1));
      else {
        const f = (G.shown - G.cum[i - 1]) / (G.cum[i] - G.cum[i - 1] || 1);
        if (f > 0) g.lineTo(X(x0 + (x1 - x0) * f), Y(y0 + (y1 - y0) * f));
        break;
      }
    }
    g.stroke();
    g.setLineDash([]);
    // one mark per square. A slot that only moved there: its number inside the dot. Where the robot turned (or
    // the line ends): an arrow out of the dot for each way it faced there, its slot numbers beside the arrow
    // ("1,3"); the last dot is filled, with a chevron inside for the final facing.
    const seen = new Map();
    for (const mk of G.marks) {
      if (G.cum[mk.at] > G.shown + 1e-6) continue;
      const key = `${mk.x},${mk.y}`;
      const m = seen.get(key) ?? { x: mk.x, y: mk.y, all: [], turn: false };
      m.all.push(mk);
      if (mk.turned) m.turn = true;
      seen.set(key, m);
    }
    const lastMk = G.marks.at(-1);
    const lastKey = lastMk ? `${lastMk.x},${lastMk.y}` : '';
    const ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const ink = '#06080b';
    const text = (label, x, y, size, halo) => {
      g.font = `600 ${Math.round(size * (label.length > 2 ? 0.75 : 1))}px ${FONT}, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowBlur = 0;
      if (halo) {
        g.strokeStyle = ink;
        g.lineWidth = Math.max(2.5, size * 0.3);
        g.strokeText(label, x, y);
      }
      g.fillStyle = G.color;
      g.fillText(label, x, y);
    };
    for (const [key, mk] of seen) {
      const end = key === lastKey && G.shown >= (G.cum.at(-1) ?? 0) - 1e-6;
      const cx = X(mk.x);
      const cy = Y(mk.y);
      const r = S * (end ? 0.2 : 0.17);
      g.shadowBlur = S * 0.12;
      g.fillStyle = end ? G.color : 'rgba(6,8,11,.9)';
      g.strokeStyle = G.color;
      g.lineWidth = S * 0.04;
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.fill();
      g.stroke();
      const facing = mk.all.filter((x) => x.d != null && x.n != null);
      const endD = end ? lastMk.d : null;
      if ((mk.turn || end) && facing.length) {
        const byD = new Map();
        for (const x of facing) byD.set(x.d, [...(byD.get(x.d) ?? []), x.n]);
        for (const [d, ns] of byD) {
          const a = ANG[d];
          const sz = S * (end && d === endD ? 0.1 : 0.08);
          const dist = r + sz * 1.05;
          const px = cx + Math.cos(a) * dist;
          const py = cy + Math.sin(a) * dist;
          // the arrow, outlined in dark so it reads on top of the line
          g.shadowBlur = 0;
          g.beginPath();
          g.moveTo(px + Math.cos(a) * sz, py + Math.sin(a) * sz);
          g.lineTo(px + Math.cos(a + 2.3) * sz, py + Math.sin(a + 2.3) * sz);
          g.lineTo(px + Math.cos(a - 2.3) * sz, py + Math.sin(a - 2.3) * sz);
          g.closePath();
          g.strokeStyle = ink;
          g.lineWidth = Math.max(1.5, sz * 0.35);
          g.stroke();
          g.fillStyle = G.color;
          g.fill();
          // the slot numbers just beside it
          const size = S * 0.2;
          const k = dist + sz * 0.1;
          const side = sz + size * 0.55;
          text(ns.join(','), cx + Math.cos(a) * k + Math.cos(a + Math.PI / 2) * side, cy + Math.sin(a) * k + Math.sin(a + Math.PI / 2) * side + size * 0.04, size, true);
        }
        if (end && endD != null) {
          // the final facing, a bold chevron inside the filled dot
          const a = ANG[endD];
          const c = r * 0.62;
          g.shadowBlur = 0;
          g.strokeStyle = ink;
          g.lineWidth = Math.max(1.5, c * 0.34);
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(cx + Math.cos(a + 2.4) * c, cy + Math.sin(a + 2.4) * c);
          g.lineTo(cx + Math.cos(a) * c * 0.75, cy + Math.sin(a) * c * 0.75);
          g.lineTo(cx + Math.cos(a - 2.4) * c, cy + Math.sin(a - 2.4) * c);
          g.stroke();
        }
      } else if (!end) {
        const label = mk.all.map((x) => x.n).filter((n) => n != null).join('');
        if (label) {
          g.shadowBlur = 0;
          g.fillStyle = G.color;
          g.font = `500 ${Math.round(S * (label.length > 1 ? 0.16 : 0.22))}px ${FONT}, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(label, cx, cy + S * 0.01);
        }
      }
    }
    g.restore();
    G.t.needsUpdate = true;
  }

  /**
   * The order robots act in: a numeral of light (1, 2, 3...) on the glass at each robot's feet, one after
   * another, for 1.4 s. ids: in turn order.
   */
  orderMarks(ids, { dur = 1.4 } = {}) {
    const cam = this.camera.position;
    ids.forEach((id, i) => {
      const b = this.bots.get(id);
      if (!b || !b.visible) return;
      const at = this.pos(b.x, b.y);
      const dir = new THREE.Vector3(cam.x - at.x, 0, cam.z - at.z).normalize();
      const mat = new THREE.MeshBasicMaterial({ map: numeralTexture(i + 1), color: hdr(PALETTE.light, 1.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), mat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 6;
      const holder = new THREE.Group();
      holder.add(m);
      holder.rotation.y = Math.atan2(dir.x, dir.z);
      holder.position.copy(at).addScaledVector(dir, 0.46).setY(0.02);
      this.fxGroup.add(holder);
      this.effects.push({
        t0: this.time + i * 0.16,
        dur,
        update: (k) => {
          mat.opacity = k < 0.1 ? k / 0.1 : k > 0.72 ? Math.max(0, (1 - k) / 0.28) : 1;
          const s = 0.7 + 0.3 * easeBack(Math.min(1, k * 6));
          m.scale.set(s, s, s);
        },
        end: () => {
          this.fxGroup.remove(holder);
          m.geometry.dispose();
          mat.dispose();
        },
      });
    });
  }

  /** A flag's column flashes (as when it's reached), without a robot. flicker: it stutters (a near miss). */
  flashFlag(n, color = PALETTE.light, { flicker = false, strength = 1 } = {}) {
    const col = this.columns.find((x) => x.n === n);
    if (!col) return;
    col.flash = this.time;
    col.flashColor = new THREE.Color(color);
    col.flashK = strength;
    col.flicker = flicker ? this.time : null;
  }

  /** The camera leans in on a space, and a ring of light marks it. */
  spotlight(x, y, { hold = 0.9, k = 0.3, color = PALETTE.light } = {}) {
    if (!this.course) return;
    const at = this.pos(x, y);
    this.punchIn = { t0: this.realTime, hold, k, at: at.clone().setY(0) };
    this.ring(at, color, 1.3, 0.04, 1.3);
  }

  /** A ring of light on a space. */
  ringAt(x, y, color = PALETTE.light, size = 1, dur = 1.1) {
    if (this.course) this.ring(this.pos(x, y), color, size, 0.04, dur);
  }

  /** A mark (glyph) rises over a space and fades. */
  popAt(x, y, name, color = PALETTE.light, text = '', opts = {}) {
    if (this.course) this.popGlyph({ group: { position: this.pos(x, y) } }, name, color, text, opts);
  }

  /** These robots are shut down: their lights at a third, a power mark floating over each. */
  setShutdown(ids) {
    const want = new Set(ids ?? []);
    for (const b of this.bots.values()) {
      const on = want.has(b.id);
      if (on === !!b.shut) continue;
      b.shut = on;
      if (on) {
        b.shutMark = glyphSprite('power', PALETTE.light, { height: 0.5 });
        b.shutMark.material.opacity = 0.8;
        this.fxGroup.add(b.shutMark);
      } else this.dropShutMark(b);
    }
  }

  dropShutMark(b) {
    if (!b.shutMark) return;
    this.fxGroup.remove(b.shutMark);
    b.shutMark.material.map.dispose();
    b.shutMark.material.dispose();
    b.shutMark = null;
  }

  /** Lift a robot a little off the glass (or set it back down). */
  raise(id, on = true) {
    const b = this.bots.get(id);
    if (b) b.raiseTo = on ? 0.15 : 0;
  }

  /** The board's light traces on from nothing, over dur seconds. */
  traceOn(dur = 2.4) {
    this.trace = { t0: this.time, dur };
  }

  /** Every robot's light brightens for a moment. */
  brighten() {
    this.boostT = this.time;
  }

  // ----- cards over the robots -----

  /** Register revealed: each robot's card floats over it. list: [{ id, types }] */
  showCards(list) {
    this.clearCards();
    // one robot alone: its card shows as it's played; turning it over first would only say it twice
    if (this.bots.size < 2) return;
    let k = 0;
    for (const { id, types } of list) {
      const b = this.bots.get(id);
      if (!b || !types?.length) continue;
      const sp = cardSprite(types);
      sp.userData.born = this.time + 0.09 * k++; // they turn over one after another
      sp.userData.base = sp.scale.clone();
      this.fxGroup.add(sp);
      b.card = sp;
    }
  }

  clearCards() {
    for (const b of this.bots.values()) {
      if (!b.card) continue;
      this.fxGroup.remove(b.card);
      b.card.material.map.dispose();
      b.card.material.dispose();
      b.card = null;
    }
  }

  /** This robot's card is the one being played right now. */
  playCard(b, types) {
    if (!b) return;
    if (!b.card || b.card.userData.key !== types.join()) {
      if (b.card) {
        this.fxGroup.remove(b.card);
        b.card.material.map.dispose();
        b.card.material.dispose();
      }
      b.card = cardSprite(types);
      b.card.userData.key = types.join();
      b.card.userData.born = this.time;
      b.card.userData.base = b.card.scale.clone();
      this.fxGroup.add(b.card);
    }
    b.card.userData.played = this.time;
    b.acting = this.time;
  }

  // ----- a beat of the Activation Phase -----

  /**
   * Play one beat. Every path in it runs on one clock of steps (chaos.js): each robot crosses a space
   * per step at full speed, and a pushed robot only starts to move at the step its pusher reaches it.
   * The beat's comic moments (a shove, a wall, a fall, a laser) are read first, so the biggest one gets
   * the camera and the rest stay small.
   */
  playBeat(beat, robots) {
    const byId = new Map(robots.map((r) => [r.id, r]));
    const what = beat.what;
    const read = readBeat(beat, { course: this.course, robots });
    const N = read.steps;
    const t0 = this.time;
    const when = (u) => clockTime(N, u); // seconds into the beat at which the clock reaches u steps
    const paths = new Map(beat.fx.filter((f) => f.k === 'move').map((f) => [f.id, f.path]));
    const ctx = { N, t0, when, paths, read, faces: new Set(), counted: new Set(), byId, beat };
    // faces for the few robots in the biggest moments, not for everyone at once
    for (const e of read.events) {
      if (ctx.faces.size < 3 || e.kind === 'fall') ctx.faces.add(e.id);
      if (e.kind === 'contact' && e.stuck && e.i === 0 && ctx.faces.size < 3) ctx.faces.add(e.by);
    }
    if (beat.fx.some((f) => f.k === 'reveal')) this.mishaps.clear();

    // pushed robots and the robots pushing them press together while they move
    const squeeze = new Map();
    const press = (id, s) => (squeeze.get(id) ?? squeeze.set(id, []).get(id)).push(s);
    for (const e of read.events) {
      if (e.kind !== 'contact' || e.stuck) continue;
      const u1 = Math.min(lastTick(paths.get(e.id)), lastTick(paths.get(e.by)));
      if (u1 <= e.at - 1) continue;
      press(e.id, { u0: e.at - 1, u1, dx: -DX[e.d], dz: -DY[e.d], amt: 0.09 });
      press(e.by, { u0: e.at - 1, u1, dx: DX[e.d], dz: DY[e.d], amt: 0.09 });
    }

    if (what?.k === 'belt') {
      for (const belt of this.belts) if (belt.fast === !!what.fast) belt.pulse = this.time;
      this.emit('belt', { fast: !!what.fast });
    }
    if (what?.k === 'gear') this.emit('gear');
    const handled = new Set(read.events.filter((e) => e.kind === 'bonk' || (e.kind === 'contact' && e.stuck)).flatMap((e) => [e.id, e.by]));
    for (const f of beat.fx) {
      const b = this.bots.get(f.id ?? f.src);
      switch (f.k) {
        case 'move': {
          if (!b) break;
          if (f.path.length < 2) {
            if (handled.has(b.id)) break; // a wall or a stuck push: its own moment below
            b.anims.push({ kind: 'bump', t0: this.time, dur: 0.3 });
            this.emit('bump', { id: b.id });
            break;
          }
          b.visible = true;
          b.x = f.path[0][0];
          b.y = f.path[0][1];
          const dur = clockTotal(N);
          b.busyUntil = Math.max(b.busyUntil, t0 + dur);
          b.anims.push({ kind: 'path', t0, dur, N, path: f.path, squeeze: squeeze.get(b.id) });
          const first = f.path[1][2] ?? 1;
          const n = lastTick(f.path) - first + 1;
          // a pushed robot's whoosh starts when it is hit, not before
          if (first <= 1) this.emit('move', { id: b.id, n, dur: n * 0.3, belt: what?.k === 'belt' });
          break;
        }
        case 'turn':
          if (b) {
            this.turnTo(b, b.rot - f.by * (Math.PI / 2), 0.45, f.at ? when(f.at - 1) : 0);
            this.emit('turn', { id: b.id, by: f.by });
          }
          break;
        case 'fall':
          if (b) this.fall(b, f, read.events.find((e) => e.kind === 'fall' && e.id === f.id), ctx);
          break;
        case 'reboot':
          if (b) this.reboot(b, f, byId.get(b.id));
          break;
        case 'beam':
          if (f.at) this.later(when(f.at), () => this.beam(f, this.bots.get(f.src)));
          else this.beam(f, b);
          break;
        case 'dmg':
          if (b) this.damage(b, f, ctx);
          break;
        case 'en':
          if (b) {
            this.motes3(b.group.position, PALETTE.energy, 14);
            this.popGlyph(b, 'bolt', PALETTE.energy, `+${f.n}`);
            this.emit('energy', { id: b.id, n: f.n });
          }
          break;
        case 'cp':
          if (b) this.checkpoint(b, f.n);
          break;
        case 'say':
          if (b) this.say(b, f);
          break;
        case 'play':
          if (b) {
            this.playCard(b, f.cards);
            this.emit('play', { id: b.id, cards: f.cards });
          }
          break;
        case 'replace':
          if (b) {
            this.playCard(b, [f.from === 'abort' ? 'abort' : f.from, f.to].filter(Boolean));
            this.glitch(b, f.from === 'sp' ? '#ff7a6b' : '#b99bff');
            this.emit('replace', { id: b.id });
          }
          break;
        case 'reveal':
          this.emit('reveal', { reg: f.reg });
          break;
        case 'shield':
          if (b) {
            this.ring(b.group.position, PALETTE.reboot, 0.7, 0.35);
            this.emit('shield', { id: b.id });
          }
          break;
        case 'emp':
          if (b) {
            this.ring(b.group.position, '#b99bff', 1.8, 0.1);
            this.emit('emp', { id: b.id });
          }
          break;
        case 'gear': {
          const g = this.gears.get(`${f.x},${f.y}`);
          if (g) {
            g.kick = { t0: this.time, from: g.extra, to: g.extra - f.spin * (Math.PI / 2) };
            g.pulse = this.time;
          }
          break;
        }
        case 'pusher': {
          const p = this.pushers.get(`${f.x},${f.y}`);
          if (p) p.kick = this.time;
          this.emit('push');
          // the robot it shoves gets a jolt and a flash where the plate hits it
          const d = turn(f.side, 2);
          for (const [id, path] of paths) {
            const R = this.bots.get(id);
            if (!R || path.length < 2 || path[0][0] !== f.x || path[0][1] !== f.y) continue;
            this.burst(this.at3(f.x - DX[d] * 0.4, f.y - DY[d] * 0.4, 0.2), PALETTE.light, 0.6);
            this.jolt(R, { dx: -DX[d], dz: -DY[d], lean: 0.45, squash: 0.2, dur: 0.6 });
          }
          break;
        }
        case 'win':
          if (b) this.win(b);
          break;
      }
    }

    // the comic moments
    for (const e of read.events) {
      const b = this.bots.get(e.id);
      if (!b) continue;
      if (e.kind === 'contact') this.contact(b, e, ctx);
      else if (e.kind === 'bonk') this.bonk(b, e, ctx);
      else if (e.kind === 'helped') this.helped(b, e, ctx);
      else if (e.kind === 'shot') this.shot(b, e, ctx);
    }
    // the biggest moment gets the camera: a punch-in, and slow motion when someone was pushed to their doom
    const top = read.top;
    if (top && top.score >= 6.5) {
      const tb = this.bots.get(top.id);
      const at = top.kind === 'fall' ? this.pos(top.x, top.y) : tb?.group.position.clone();
      const t = top.kind === 'fall' ? when(top.at) : top.kind === 'contact' ? when(top.at - 1) : 0.1;
      const hold = top.kind !== 'fall' ? 0.55 : top.edge ? 1.5 : 1.0; // off the edge: stay close until it lands far below
      if (at) this.later(Math.max(0, t - 0.15), () => this.punch(at, { hold, k: top.score >= 8 ? 0.36 : 0.26 }));
      if (top.kind === 'fall' && top.cause === 'push') this.later(Math.max(0, t - 0.1), () => this.slowmo(0.85, 0.3));
    }
  }

  // ----- the comic moments -----

  /** Run fn after `delay` seconds of the scene's time (which slows down in slow motion). */
  later(delay, fn) {
    if (delay <= 0) return fn();
    this.effects.push({ t0: this.time + delay, dur: 0, update: () => fn() }); // dur 0: runs exactly once
  }

  shake(amp, dur = 0.45) {
    if (this.calmWin) amp *= 0.5;
    if (this.quake && this.quake.amp * (1 - (this.realTime - this.quake.t0) / this.quake.dur) > amp) return;
    this.quake = { t0: this.realTime, dur, amp };
  }

  punch(at, { hold = 0.6, k = 0.28 } = {}) {
    if (this.calmWin || this.focusOn) return;
    this.punchIn = { t0: this.realTime, hold, k, at: at.clone().setY(0) };
  }

  slowmo(dur = 0.8, k = 0.3) {
    this.slow = { t0: this.realTime, dur, k };
    this.emit('slowmo');
  }

  /** How fast the scene's time runs right now (1, or less in slow motion). */
  timeScale() {
    const S = this.slow;
    if (!S) return 1;
    const s = this.realTime - S.t0;
    if (s >= S.dur) {
      this.slow = null;
      return 1;
    }
    const e = Math.min(smooth(0, 0.1, s), 1 - smooth(S.dur - 0.3, S.dur, s));
    return 1 - (1 - S.k) * e;
  }

  /** A body blow: the body leans (top toward world dx, dz), squashes and springs back. */
  jolt(b, { dx = 0, dz = 0, lean = 0.3, squash = 0.2, shake = 0, dur = 0.6, delay = 0 } = {}) {
    b.anims.push({ kind: 'jolt', t0: this.time + delay, dur, dx, dz, lean, squash, shake });
  }

  /** The robot's face pops up over it for a moment (shock, uhoh, dizzy, dead, happy, smug, ouch, grr). */
  face(b, kind, { delay = 0, dur = 1.3, ctx = null } = {}) {
    if (ctx && !ctx.faces.has(b.id)) return;
    this.later(delay, () => {
      if (!this.bots.has(b.id)) return;
      this.dropFace(b);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture(kind), transparent: true, depthWrite: false, depthTest: false }));
      s.renderOrder = 33;
      s.scale.setScalar(0.001);
      this.fxGroup.add(s);
      b.face = { s, t0: this.time, dur, kind };
    });
  }

  dropFace(b) {
    if (!b.face) return;
    this.fxGroup.remove(b.face.s);
    b.face.s.material.dispose();
    b.face = null;
  }

  /** Dizzy stars circling its head: one for each mishap this register. */
  dizzy(b, n, dur = 2.4) {
    b.stars = { n: Math.min(5, n), until: this.time + dur, t0: this.time };
  }

  clearChaos(b) {
    this.dropFace(b);
    for (const s of b.starSprites ?? []) {
      this.fxGroup.remove(s);
      s.material.dispose();
    }
    b.starSprites = [];
    b.stars = null;
  }

  /** One more thing went wrong for this robot in this register: two or more and its head spins. */
  mishap(b, delay, ctx) {
    if (ctx?.counted) {
      // one robot's whole story in a beat (shoved, then into the pit) is one mishap
      if (ctx.counted.has(b.id)) return this.mishaps.get(b.id) ?? 1;
      ctx.counted.add(b.id);
    }
    const n = (this.mishaps.get(b.id) ?? 0) + 1;
    this.mishaps.set(b.id, n);
    this.later(delay, () => this.emit('mishap', { id: b.id, n }));
    if (n < 2) return n;
    this.later(delay + 0.15, () => {
      this.dizzy(b, n);
      this.emit('combo', { id: b.id, n });
    });
    return n;
  }

  /** A flash of light where something hit something. */
  burst(at, color = PALETTE.light, size = 0.9, dur = 0.38) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTexture(), color: hdr(color, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.position.copy(at);
    s.renderOrder = 32;
    s.material.rotation = rand(0, TAU);
    this.fxGroup.add(s);
    const spin = rand(-1, 1) * 0.8;
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const sc = size * (0.35 + 0.65 * easeOut(Math.min(1, k * 3.5))) * (1 + k * 0.15);
        s.scale.set(sc, sc, 1);
        s.material.rotation += spin * 0.016;
        s.material.opacity = (1 - k) ** 1.4;
      },
      end: () => {
        this.fxGroup.remove(s);
        s.material.dispose();
      },
    });
  }

  /** Where a robot's body is, in the world, at a point of its path (grid x, y). */
  at3(x, y, h = 0.25) {
    return this.pos(x, y).setY(h);
  }

  /** Bumped by another robot. Small for one, bigger down a chain; a push into a wall strains. */
  contact(b, e, ctx) {
    const H = this.bots.get(e.by);
    const dx = DX[e.d];
    const dz = DY[e.d];
    const tc = ctx.when(e.at - 1);
    const path = ctx.paths.get(b.id);
    const [vx, vy] = path?.[0] ?? [b.x, b.y];
    const where = this.at3(vx - dx * 0.5, vy - dz * 0.5, 0.28);
    const big = 1 + e.i * 0.35;
    this.later(tc, () => {
      this.burst(where, PALETTE.light, 0.75 * big);
      this.emit('shove', { id: b.id, i: e.i, stuck: e.stuck });
      this.shake((e.stuck ? 0.35 : 0.25) + 0.15 * e.i, 0.4);
    });
    if (e.stuck) {
      // everyone presses, nobody moves: they squash together and strain
      this.jolt(b, { dx: -dx, dz: -dz, lean: 0.25, squash: 0.32, shake: 0.9, dur: 0.7, delay: tc });
      if (H && e.i === 0) this.jolt(H, { dx, dz, lean: 0.3, squash: 0.3, shake: 0.9, dur: 0.7, delay: tc });
      if (e.i === 0 && H) this.face(H, 'grr', { delay: tc, dur: 1.1, ctx });
      this.face(b, 'ouch', { delay: tc + 0.05, dur: 1.0, ctx });
      this.later(tc + 0.05, () => this.emit('strain', { id: b.id }));
    } else {
      // hit from behind: the body whips back, then it's carried along
      this.jolt(b, { dx: -dx, dz: -dz, lean: 0.5, squash: 0.18, dur: 0.7, delay: tc });
      if (H) this.jolt(H, { dx, dz, lean: 0.18, squash: 0.24, dur: 0.45, delay: tc });
      const n = this.mishap(b, tc, ctx);
      this.face(b, n >= 2 ? 'dizzy' : 'shock', { delay: tc, dur: Math.max(0.9, ctx.when(lastTick(path)) - tc + 0.45), ctx });
      return;
    }
    this.mishap(b, tc, ctx);
  }

  /** Drove into a wall (or a robot it couldn't push): the faster it was going, the funnier. */
  bonk(b, e, ctx) {
    const dx = DX[e.d];
    const dz = DY[e.d];
    let tc = ctx.when(Math.max(0, e.at - 1));
    const path = ctx.paths.get(b.id);
    const [x, y] = path?.at(-1) ?? [b.x, b.y];
    if (!e.moved) {
      // it hadn't moved yet: a little lunge forward, and the wall is still there
      b.anims.push({ kind: 'lunge', t0: this.time + tc, dur: 0.32, dx, dz });
      b.busyUntil = Math.max(b.busyUntil, this.time + tc + 0.32);
      tc += 0.13;
    }
    const hard = Math.min(2, e.moved);
    this.later(tc, () => {
      this.burst(this.at3(x + dx * 0.47, y + dz * 0.47, 0.22), PALETTE.light, 0.55 + hard * 0.18);
      this.emit('bonk', { id: b.id, n: hard, robot: e.why === 'robot' });
      this.shake(0.12 + hard * 0.1, 0.35);
    });
    this.jolt(b, { dx, dz, lean: 0.28 + hard * 0.1, squash: 0.28 + hard * 0.08, dur: 0.6, delay: tc });
    const n = this.mishap(b, tc, ctx);
    if (hard >= 2 && n < 2) {
      this.later(tc + 0.1, () => {
        this.dizzy(b, 2, 1.6);
        this.emit('combo', { id: b.id, n: 2 });
      });
    }
    this.face(b, hard >= 2 || n >= 2 ? 'dizzy' : 'ouch', { delay: tc, dur: 1.2, ctx });
  }

  /** A shove that did the shoved robot a favor: it lands nearer its next flag, and it's delighted. */
  helped(b, e, ctx) {
    const t = ctx.when(lastTick(ctx.paths.get(b.id))) + 0.08;
    this.face(b, 'happy', { delay: t, dur: 1.4 });
    this.later(t, () => {
      this.popGlyph(b, 'heart', PALETTE.left, '', { y: 1.6, height: 0.5 });
      if (e.jackpot) this.motes3(b.group.position, b.color, 30, 2);
      this.emit('yay', { id: b.id, big: e.jackpot });
    });
  }

  /** Hit by a laser: knocked back a little, sparks, and its light fizzles for a moment. */
  shot(b, e, ctx) {
    const th = 0.13 + (e.at ? ctx.when(e.at) : 0);
    const dx = DX[e.d];
    const dz = DY[e.d];
    const many = e.beams > 1;
    this.later(th, () => {
      const p = b.group.position.clone().setY(0.32);
      this.burst(p, e.board ? PALETTE.laser : this.bots.get(e.by)?.color ?? PALETTE.laser, 0.7 + 0.12 * e.n);
      b.soot = this.time;
      this.smoke(p, 6 + 3 * e.n);
      this.shake(many ? 0.45 : 0.18 + 0.06 * e.n, 0.35);
    });
    this.jolt(b, { dx, dz, lean: 0.32 + 0.06 * e.n, squash: 0.12, shake: 0.7, dur: 0.65, delay: th });
    if (many) {
      // crossfire: it spins right round
      b.anims.push({ kind: 'spin', t0: this.time + th, dur: 0.7, turns: 1 });
      b.busyUntil = Math.max(b.busyUntil, this.time + th + 0.7);
    }
    const n = this.mishap(b, th, ctx);
    this.face(b, many || n >= 2 ? 'dizzy' : 'ouch', { delay: th, dur: 1.15, ctx });
  }

  say(b, f) {
    const t = f.text;
    if (t === '·' || t === '⟳') return;
    if (t === '🛑') return this.popGlyph(b, 'cross', PALETTE.light);
    if (t === '✌️') return this.popGlyph(b, 'hand', PALETTE.light, '×2');
    if (t === '🌀') return this.ring(b.group.position, '#b99bff', 0.9, 0.2);
    if (t?.startsWith('🔧')) return this.popGlyph(b, 'plus', PALETTE.energy);
    if (t === '✴️' || t === '🔥') return this.ring(b.group.position, PALETTE.laser, 0.9, 0.25);
    if (t === '🪛') return this.glitch(b, PALETTE.laser);
    if (t?.includes('✖')) return this.popGlyph(b, 'cross', 'rgba(244,239,228,.8)');
    this.ring(b.group.position, b.color, 0.7, 0.2);
  }

  popGlyph(b, name, color, text = '', { y = 1.25, height = 0.38 } = {}) {
    const s = glyphSprite(name, color, { text, height });
    const base = b.group.position.clone();
    base.y = y;
    s.position.copy(base);
    this.fxGroup.add(s);
    this.effects.push({
      t0: this.time,
      dur: 1.4,
      update: (k) => {
        s.position.y = base.y + easeOut(k) * 0.45;
        s.material.opacity = k < 0.65 ? Math.min(1, k * 8) : 1 - (k - 0.65) / 0.35;
      },
      end: () => {
        this.fxGroup.remove(s);
        s.material.map.dispose();
        s.material.dispose();
      },
    });
  }

  /**
   * Falling. Off the edge: it sails past the edge, hangs in the air for a beat (scrambling back),
   * then drops to the floor far below. Into a pit: a wobble on the rim, then it's sucked down, spinning,
   * and the pit puffs out a little ghost. Whoever pushed it looks pleased with itself.
   */
  fall(b, f, e, ctx) {
    const cause = e?.cause ?? 'self';
    const big = cause === 'push' || cause === 'belt';
    const path = ctx.paths.get(b.id);
    const ta = path ? ctx.when(e?.at ?? lastTick(path)) : 0; // when it reaches the edge or the pit
    let dx = 0;
    let dz = 0;
    if (path?.length > 1) {
      const [x0, y0] = path.at(-2);
      const [x1, y1] = path.at(-1);
      dx = Math.sign(x1 - x0);
      dz = Math.sign(y1 - y0);
    } else {
      dx = -Math.sin(b.rot);
      dz = -Math.cos(b.rot);
    }
    const at = this.pos(f.x, f.y);
    b.trailCut = this.time + ta;
    this.later(ta, () => this.emit('fall', { id: b.id, edge: !!f.edge, cause }));
    if (f.edge) {
      const hang = big ? 0.36 : 0.3;
      const drop = 0.62;
      b.anims.push({ kind: 'plunge', t0: this.time + ta, dur: hang + drop + 0.3, hang, drop, dx, dz });
      b.busyUntil = Math.max(b.busyUntil, this.time + ta + hang + drop + 0.32);
      this.face(b, 'shock', { delay: ta, dur: hang + drop + 0.25 });
      this.later(ta, () => this.emit('teeter', { id: b.id, big }));
      this.later(ta + hang, () => {
        this.emit('plunge', { id: b.id });
        this.streak(b, b.color);
      });
      this.later(ta + hang + drop, () => {
        const floor = b.group.position.clone().setY(-1.57);
        this.ring(floor, b.color, 1.1, -1.57, 0.9);
        this.burst(floor.clone().setY(-1.45), b.color, 0.8, 0.4);
        this.emit('thud', { id: b.id });
        this.shake(0.3, 0.35);
      });
    } else {
      const teeter = big ? 0.3 : 0.24;
      const sink = 0.55;
      b.anims.push({ kind: 'gulp', t0: this.time + ta, dur: teeter + sink, teeter, sink });
      b.busyUntil = Math.max(b.busyUntil, this.time + ta + teeter + sink + 0.05);
      this.face(b, cause === 'self' ? 'uhoh' : 'shock', { delay: ta, dur: teeter + 0.35 });
      this.later(ta, () => this.emit('teeter', { id: b.id, big }));
      this.later(ta + teeter, () => this.emit('gulp', { id: b.id }));
      this.later(ta + teeter + sink * 0.8, () => {
        this.ring(at, b.color, 0.55, 0.05, 1.1);
        this.pillar(at, b.color, 1.3, 1.0);
        this.motes3(at, b.color, 18, 1.4);
        this.ghost(at, b.color);
        this.emit('poof', { id: b.id });
        this.shake(0.3, 0.35);
      });
    }
    // the culprit
    if (e?.by && e.by !== b.id) {
      const P = this.bots.get(e.by);
      if (P) this.face(P, 'smug', { delay: ta + (f.edge ? 0.5 : 0.35), dur: 1.4 });
    }
    this.mishap(b, ta, ctx);
  }

  /** A long-exposure streak of light behind a robot dropping off the edge. */
  streak(b, color) {
    const top = b.group.position.clone().setY(0.25);
    const geo = new THREE.CylinderGeometry(0.12, 0.05, 1, 12, 1, true).translate(0, -0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(top);
    m.renderOrder = 4;
    this.fxGroup.add(m);
    let low = top.y;
    this.effects.push({
      t0: this.time,
      dur: 1.3,
      update: (k) => {
        if (b.group.visible) {
          low = Math.min(low, b.group.position.y + 0.25);
          m.position.x = b.group.position.x;
          m.position.z = b.group.position.z;
        }
        m.scale.set(1 - k * 0.6, Math.max(0.01, top.y - low), 1 - k * 0.6);
        mat.opacity = (1 - k) ** 1.3;
      },
      end: () => {
        this.fxGroup.remove(m);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  /** The robot's little ghost floats up out of the pit (X X) and fades. */
  ghost(at, color) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture('dead'), transparent: true, depthWrite: false, depthTest: false }));
    s.renderOrder = 33;
    this.fxGroup.add(s);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: hdr(color, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.renderOrder = 32;
    this.fxGroup.add(glow);
    this.effects.push({
      t0: this.time,
      dur: 1.6,
      update: (k) => {
        const y = 0.2 + easeOut(k) * 1.5;
        const sway = Math.sin(k * 9) * 0.08;
        s.position.set(at.x + sway, y, at.z);
        glow.position.set(at.x + sway, y, at.z);
        const sc = 0.8 * (this.faceScale ?? 1) * easeBack(Math.min(1, k * 4));
        s.scale.set(sc, sc, 1);
        glow.scale.set(sc * 1.8, sc * 1.8, 1);
        const o = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        s.material.opacity = o * 0.9;
        glow.material.opacity = o * 0.7;
      },
      end: () => {
        this.fxGroup.remove(s, glow);
        s.material.dispose();
        glow.material.dispose();
      },
    });
  }

  /** A little smoke of dim light after a laser hit. */
  smoke(at, n) {
    this.particles(at, ['#8f99aa', '#5d6676', '#ff9a7a'], n, { speed: 0.25, up: 0.9, gravity: -0.4, size: 0.07, dur: 1.2 });
  }

  /** Back in: it drops out of the air onto the reboot space, squashes, shakes itself off, and its light flickers on. */
  reboot(b, f, r) {
    b.visible = true;
    b.x = f.x;
    b.y = f.y;
    b.rot = -(r?.d ?? 0) * (Math.PI / 2);
    b.pop = -10;
    b.trail = [];
    this.clearChaos(b);
    const fallT = 0.42;
    b.busyUntil = this.time + fallT + 0.8;
    b.anims.push({ kind: 'drop', t0: this.time, dur: fallT, h: 2.8 });
    const at = this.pos(f.x, f.y);
    this.pillar(at, PALETTE.reboot, 1.1);
    this.emit('reboot', { id: b.id });
    this.later(fallT, () => {
      this.ring(at, PALETTE.reboot, 0.9, 0.05);
      this.burst(at.clone().setY(0.1), PALETTE.reboot, 0.7, 0.3);
      this.emit('land', { id: b.id });
      this.shake(0.15, 0.3);
      b.boot = this.time;
    });
    this.jolt(b, { squash: 0.5, lean: 0, dur: 0.55, delay: fallT });
    b.anims.push({ kind: 'wiggle', t0: this.time + fallT + 0.32, dur: 0.45 });
  }

  damage(b, f, ctx) {
    const junk = { id: b.id, sp: f.sp ?? 0, hw: f.hw ?? 0, src: f.src };
    if (f.src === 'reboot') {
      // the fall itself is the show; its junk cards leave from where it fell, once it's gone
      const e = ctx.read.events.find((x) => x.kind === 'fall' && x.id === b.id);
      const path = ctx.paths.get(b.id);
      const ta = path ? ctx.when(e?.at ?? lastTick(path)) : 0;
      const fell = ctx.beat?.fx.find((x) => x.k === 'fall' && x.id === b.id);
      this.later(ta + 1.05, () => this.emit('junk', { ...junk, x: fell?.x ?? b.x, y: fell?.y ?? b.y }));
      return;
    }
    const laser = f.src === 'laser' || f.src === 'weapon';
    const delay = laser ? 0.13 : f.at ? ctx.when(Math.max(0, f.at - 0.5)) : 0;
    this.later(delay, () => {
      const color = f.hw && !f.sp ? '#b99bff' : '#ff7a6b';
      this.glitch(b, color);
      const p = b.group.position.clone();
      p.y = 0.35;
      this.shards(p, color, 10 + 6 * (f.sp + f.hw));
      this.emit(laser ? 'fizzle' : 'damage', { id: b.id, n: (f.sp ?? 0) + (f.hw ?? 0), hw: f.hw });
      // the junk cards themselves: host.js flies them to that player's token (or the film's phone)
      this.emit('junk', { ...junk, x: b.x, y: b.y });
    });
  }

  glitch(b, color) {
    b.hurt = this.time;
    b.hurtColor = new THREE.Color(color);
  }

  checkpoint(b, n) {
    const col = this.columns.find((x) => x.n === n);
    if (col) {
      col.flash = this.time;
      col.flashColor = new THREE.Color(b.color);
    }
    const at = b.group.position.clone();
    this.ring(at, b.color, 6, 0.02, 2.2);
    this.ring(at, PALETTE.light, 3, 0.03, 1.6);
    this.motes3(at, b.color, 40, 2.6);
    this.emit('checkpoint', { id: b.id, n });
  }

  win(b) {
    if (!this.calmWin) {
      this.focusOn = b.id;
      this.setDim(0.75);
    }
    this.pillar(b.group.position, b.color, 6, this.calmWin ? 2.4 : 0.6);
    const epoch = this.epoch;
    for (let i = 0; i < (this.calmWin ? 2 : 4); i++) {
      setTimeout(() => {
        if (!this.running || epoch !== this.epoch) return;
        this.ring(b.group.position, b.color, 8, 0.02, 2.6);
        this.motes3(b.group.position, i % 2 ? PALETTE.light : b.color, 60, 3.4);
      }, i * 650);
    }
    this.emit('win', { id: b.id });
  }

  beam(f, shooter) {
    let from;
    if (f.board) {
      const side = turn(f.d, 2);
      from = this.pos(f.x0, f.y0).add(new THREE.Vector3(DX[side] * 0.34, 0.2, DY[side] * 0.34));
    } else if (shooter) {
      shooter.model.muzzle.updateWorldMatrix(true, false);
      from = new THREE.Vector3().setFromMatrixPosition(shooter.model.muzzle.matrixWorld);
      shooter.recoil = this.time;
    } else from = this.pos(f.x0, f.y0).setY(0.25);
    const end = this.pos(f.x1, f.y1);
    const hit = f.hit?.length;
    if (!hit) end.add(new THREE.Vector3(DX[f.d] * 0.47, 0, DY[f.d] * 0.47));
    end.y = hit ? 0.25 : from.y;
    if (f.board) end.y = 0.2;
    const special = f.special;
    const color = f.board ? PALETTE.laser
      : special === 'tractor-beam' || special === 'pressor-beam' ? PALETTE.reboot
        : special === 'scrambler' ? '#b99bff'
          : special === 'mini-howitzer' ? PALETTE.energy
            : this.bots.get(f.src)?.color ?? PALETTE.laser;
    const len = from.distanceTo(end);
    if (len < 0.05) return;
    const mid = from.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(from).normalize();
    const group = new THREE.Group();
    const thick = 0.016 + 0.01 * (f.n ?? 1);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(thick * 2.2, thick * 2.2, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: hdr(color, 1.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.5, thick * 0.5, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(outer, core);
    group.position.copy(mid);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.scale.y = 0.001;
    this.fxGroup.add(group);
    const linger = this.beamLinger; // held at full brightness this much longer
    this.effects.push({
      t0: this.time,
      dur: 0.9 + linger,
      update: (kk) => {
        const s = kk * (0.9 + linger);
        const k = (s < 0.36 ? s : s < 0.36 + linger ? 0.36 : s - linger) / 0.9;
        const grow = Math.min(1, k * 6);
        group.scale.y = grow;
        group.position.copy(from).addScaledVector(dir, (len * grow) / 2);
        const fade = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
        outer.material.opacity = 0.5 * fade;
        core.material.opacity = fade;
        const th = 1 - k * 0.6;
        group.scale.x = group.scale.z = th;
      },
      end: () => {
        this.fxGroup.remove(group);
        outer.geometry.dispose();
        core.geometry.dispose();
        outer.material.dispose();
        core.material.dispose();
      },
    });
    if (hit) this.later(0.12, () => this.shards(end, color, 14));
    this.emit('laser', { board: !!f.board, hit: !!hit, src: f.src });
  }

  /** An expanding ring of light on the glass. */
  ring(at, color, size, y = 0.03, dur = 1.0) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: hdr(color, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(y);
    this.fxGroup.add(m);
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const s = 0.3 + easeOut(k) * size;
        m.scale.set(s, s, s);
        m.material.opacity = (1 - k) ** 1.5;
      },
      end: () => {
        this.fxGroup.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      },
    });
  }

  /** A column of light that rises and fades (reboots, the winner). */
  pillar(at, color, height = 2, dur = 1.2) {
    const geo = new THREE.PlaneGeometry(1.8, height).translate(0, height / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: columnTexture(), color: hdr(color, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(at).setY(0);
    this.fxGroup.add(m);
    const long = dur < 1; // the winner's column stays lit for as long as the result is shown
    const total = long ? 90 : dur;
    this.effects.push({
      t0: this.time,
      dur: total,
      update: (k) => {
        const s = k * total;
        m.rotation.y = Math.atan2(this.camera.position.x - m.position.x, this.camera.position.z - m.position.z);
        m.scale.y = long ? Math.min(1, s / 1.2) : easeOut(Math.min(1, k * 2));
        m.material.opacity = long ? (s < 1.5 ? 1 : 0.55 + Math.sin(s * 1.3) * 0.1) * (k < 0.97 ? 1 : (1 - k) / 0.03) : 1 - k;
      },
      end: () => {
        this.fxGroup.remove(m);
        geo.dispose();
        m.material.dispose();
      },
    });
  }

  particles(at, colors, n, { speed = 1.8, up = 1.6, gravity = 3, size = 0.05, dur = 1.0 } = {}) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      tmp.set(colors[i % colors.length]).multiplyScalar(1.6);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      const a = rand(0, TAU);
      const sp = rand(0.3, 1) * speed;
      vel.push([Math.cos(a) * sp, rand(0.4, 1) * up, Math.sin(a) * sp]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fxGroup.add(pts);
    let last = this.time;
    this.effects.push({
      t0: this.time,
      dur,
      update: (k) => {
        const dt = this.time - last;
        last = this.time;
        for (let i = 0; i < n; i++) {
          vel[i][1] -= gravity * dt;
          pos[i * 3] += vel[i][0] * dt;
          pos[i * 3 + 1] = Math.max(0.02, pos[i * 3 + 1] + vel[i][1] * dt);
          pos[i * 3 + 2] += vel[i][2] * dt;
        }
        geo.attributes.position.needsUpdate = true;
        pts.material.opacity = 1 - k * k;
      },
      end: () => {
        this.fxGroup.remove(pts);
        geo.dispose();
        pts.material.dispose();
      },
    });
  }

  shards(at, color, n) {
    this.particles(at, [color, '#ffffff'], n, { speed: 2.2, up: 1.8, gravity: 5, size: 0.045, dur: 0.8 });
  }

  /** Motes of light rising (energy, checkpoints, the win). */
  motes3(at, color, n, dur = 1.6) {
    const p = at.clone();
    p.y = 0.2;
    this.particles(p, [color, '#ffffff'], n, { speed: 0.7, up: 1.6, gravity: -0.3, size: 0.05, dur });
  }

  /**
   * The start phase: which start spaces are taken (picks: { n: color }), or null to hide. A free space's border
   * flashes fast (its number stays crisp: it's the glass's own drawing); a taken one's border is steady, in
   * its robot's color.
   */
  showStarts(picks) {
    if (!this.course) return;
    const key = JSON.stringify(picks);
    if (this.startKey === key) return;
    this.startKey = key;
    for (const s of this.startTags ?? []) {
      this.board.remove(s);
      s.geometry?.dispose();
      s.material.dispose();
    }
    this.startTags = [];
    if (!picks) return;
    for (const st of this.course.starts) {
      const taken = picks[st.n];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: padBorderTexture(), color: taken ? hdr(taken, 1.7) : hdr(PALETTE.light, 1.5), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(this.pos(st.x, st.y)).setY(0.012);
      m.renderOrder = 2;
      if (!taken) m.userData.flash = st.n;
      this.board.add(m);
      this.startTags.push(m);
    }
  }

  // ----- every frame -----

  frameLoop() {
    const real = Math.min(this.clock.getDelta(), 0.1);
    this.realTime += real;
    const dt = real * this.timeScale() * this.tempo; // the scene's time: slower in slow motion (faster in the Briefing's lessons)
    this.time += dt;
    const t = this.time;
    this.adapt(real);
    this.dimCur += (this.dim - this.dimCur) * Math.min(1, dt * 1.5);
    const lit = 1 - this.dimCur;

    // the Briefing's first shot: the board's light traces on from nothing
    const traced = this.trace ? smooth(0, 1, (t - this.trace.t0) / this.trace.dur) : 1;
    if (this.trace && traced >= 1) this.trace = null;
    if (this.topMat) this.topMat.emissiveIntensity = (0.35 + 0.65 * lit) * traced;
    for (const belt of this.belts) {
      belt.tex.offset.y = (belt.tex.offset.y - dt * belt.speed * (belt.pulse && t - belt.pulse < 1.2 ? 2.2 : 1)) % 1;
      const p = belt.pulse ? Math.max(0, 1 - (t - belt.pulse) / 1.2) : 0;
      belt.mat.color.setScalar((1.15 + p * 1.4) * (0.3 + 0.7 * lit));
    }
    for (const cm of this.curveMats ?? []) {
      // the bend's chevrons move in step with its straight belts' (the same scroll), so they pass between them seamlessly
      const belt = this.belts.find((b) => b.fast === cm.fast);
      cm.s = belt ? belt.tex.offset.y : (cm.s - dt * (cm.fast ? 1.0 : 0.5)) % 1;
      cm.tex.draw(cm.s);
      const p = belt?.pulse ? Math.max(0, 1 - (t - belt.pulse) / 1.2) : 0;
      cm.mat.color.setScalar((1.15 + p * 1.4) * (0.3 + 0.7 * lit));
    }
    for (const g of this.gears.values()) {
      if (g.kick) {
        const k = Math.min(1, (t - g.kick.t0) / 0.5);
        g.extra = g.kick.from + (g.kick.to - g.kick.from) * ease(k);
        if (k >= 1) g.kick = null;
      }
      g.mesh.rotation.z = g.extra * (g.spin < 0 ? -1 : 1) - t * 0.12 * g.spin * (g.spin < 0 ? -1 : 1);
      const p = g.pulse ? Math.max(0, 1 - (t - g.pulse) / 1) : 0;
      g.mesh.material.color.setScalar((1.2 + p * 1.5) * (0.3 + 0.7 * lit));
    }
    for (const p of this.pushers.values()) {
      const k = p.kick ? (t - p.kick) / 0.5 : 1;
      p.plate.position.z = 0.05 + (k < 1 ? Math.sin(k * Math.PI) * 0.32 : 0);
    }
    // the flags robots are heading for breathe, ring and column together, all in one slow breath
    const breath = 0.5 - 0.5 * Math.cos((this.realTime * TAU) / 3.6);
    const headed = new Map();
    for (const m of this.marks.values()) if (!m.leaving) headed.set(m.n, (headed.get(m.n) ?? false) || m.lead);
    for (const col of this.columns) {
      const flash = col.flash ? Math.max(0, 1 - (t - col.flash) / 2.4) : 0;
      col.tgt += ((headed.has(col.n) ? 1 : 0) - col.tgt) * Math.min(1, real * 1.5);
      col.lead += ((headed.get(col.n) ? 1 : 0) - col.lead) * Math.min(1, real * 1.5);
      const swell = col.tgt * (0.06 + breath * (0.4 + 0.4 * col.lead));
      const breathe = (this.targeting ? 0.82 : 0.85 + Math.sin(t * 1.1 + col.n) * 0.12) + swell;
      col.aura.visible = col.tgt > 0.003;
      if (col.aura.visible) {
        col.aura.material.color.set(PALETTE.light).multiplyScalar(col.tgt * (0.15 + breath * (0.75 + 0.55 * col.lead)) * (0.45 + 0.55 * lit) * traced);
        col.aura.scale.setScalar(1 + breath * 0.035 * col.tgt);
      }
      col.halo.material.color.set(PALETTE.light).multiplyScalar(0.12 + col.tgt * breath * (0.22 + 0.18 * col.lead));
      const base = new THREE.Color(PALETTE.light).lerp(col.flashColor, flash);
      const stutter = col.flicker != null && t - col.flicker < 1 ? (Math.sin((t - col.flicker) * 38) > 0 ? 1.3 : 0.15) : 1;
      col.mat.color.copy(base).multiplyScalar((breathe + flash * 2.2 * (col.flashK ?? 1)) * (0.45 + 0.55 * lit) * stutter * traced);
      col.col.scale.set(1 + flash * 0.8, 1 + flash * 0.15, 1);
      // stand on the ring's far edge (radius .4 of a space, as paintLight draws it), facing the camera
      const ctr = col.col.userData.center;
      if (ctr) {
        const eye = this.board.worldToLocal(this.camera.position.clone());
        const ax = ctr.x - eye.x;
        const az = ctr.z - eye.z;
        const len = Math.hypot(ax, az) || 1;
        col.col.position.set(ctr.x + (ax / len) * 0.4, 0, ctr.z + (az / len) * 0.4);
        col.col.rotation.y = Math.atan2(-ax, -az);
      } else col.col.rotation.y = Math.atan2(this.camera.position.x - col.col.position.x, this.camera.position.z - col.col.position.z);
    }
    if (this.batteryMat) this.batteryMat.color.set(PALETTE.energy).multiplyScalar((0.22 + Math.sin(t * 2.2) * 0.1) * lit);
    // free start spaces: their borders flash fast, all together (on, off, on...)
    const blink = (this.realTime * 2.4) % 1 < 0.55 ? 1 : 0.08;
    for (const s of this.startTags ?? []) if (s.userData.flash != null) s.material.opacity = blink;
    this.motes.rotation.y = t * 0.006;
    this.motes.position.y = Math.sin(t * 0.2) * 0.2;

    this.updateMarks(real);
    for (const b of this.bots.values()) this.animateBot(b, t, dt);
    if (this.namesAlways || this.tagsOnly) this.spreadTags(real);
    this.updateGhost(dt);
    // (an effect may start others: those land in the fresh list and join the ones still running)
    const kept = [];
    for (let pass = 0; pass < 4 && this.effects.length; pass++) {
      const running = this.effects;
      this.effects = [];
      for (const e of running) {
        if (t < e.t0) {
          kept.push(e);
          continue;
        }
        const k = e.dur > 0 ? Math.min(1, (t - e.t0) / e.dur) : 1;
        e.update(k);
        if (k >= 1) e.end?.();
        else kept.push(e);
      }
    }
    this.effects = kept.concat(this.effects);

    this.placeCamera(t, real);
    if (this.useBloom) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  animateBot(b, t, dt) {
    let px = b.x;
    let py = b.y;
    let rot = b.rot;
    let lift = 0;
    let tilt = 0;
    let scale = 1;
    let visible = b.visible;
    let fade = 1;
    let inPit = false; // sunk below the glass into a pit: seen only through its hole
    let moving = false;
    let ox = 0; // extra offset in the world, on top of the space it's on
    let oz = 0;
    let leanX = 0; // the body's top leans toward this world direction (radians per axis)
    let leanZ = 0;
    let squash = 0; // + squashed flat, - stretched tall
    let jitter = 0;
    let wide = 0; // its light, wide-eyed
    let falling = false;
    b.anims = b.anims.filter((an) => {
      if (t < an.t0) return true;
      const k = an.dur > 0 ? Math.min(1, (t - an.t0) / an.dur) : 1;
      const s = t - an.t0;
      switch (an.kind) {
        case 'move': {
          // a correction from the view (not a beat): eased in and out
          moving = true;
          const segs = an.path.length - 1;
          const pos = ease(k) * segs;
          const i = Math.min(segs - 1, Math.floor(pos));
          const f = pos - i;
          const [x0, y0] = an.path[i];
          const [x1, y1] = an.path[i + 1];
          px = x0 + (x1 - x0) * f;
          py = y0 + (y1 - y0) * f;
          if (k >= 1) {
            b.x = an.path[segs][0];
            b.y = an.path[segs][1];
            px = b.x;
            py = b.y;
          }
          break;
        }
        case 'path': {
          // a beat's path, on the beat's shared clock of steps
          const u = clockU(an.N, s);
          const p = pathAt(an.path, u);
          px = p.x;
          py = p.y;
          moving ||= p.moving;
          for (const q of an.squeeze ?? []) {
            const e = smooth(q.u0, q.u0 + 0.12, u) * (1 - smooth(q.u1, q.u1 + 0.35, u));
            ox += q.dx * q.amt * e;
            oz += q.dz * q.amt * e;
          }
          if (k >= 1) {
            const end = an.path.at(-1);
            b.x = end[0];
            b.y = end[1];
            px = b.x;
            py = b.y;
          }
          break;
        }
        case 'turn':
          an.from ??= b.rot;
          rot = an.from + (an.to - an.from) * ease(k) + (rot - b.rot);
          if (k >= 1) b.rot = an.to;
          break;
        case 'bump':
          tilt = Math.sin(k * Math.PI) * 0.14;
          break;
        case 'jolt': {
          // a spring: quick lean and squash, two wobbles, settled
          const decay = (1 - k) ** 2;
          leanX += an.dx * an.lean * Math.sin(k * Math.PI * 3) * decay;
          leanZ += an.dz * an.lean * Math.sin(k * Math.PI * 3) * decay;
          squash += an.squash * Math.cos(k * Math.PI * 3) * decay;
          jitter += an.shake * (1 - k);
          break;
        }
        case 'lunge': {
          const f = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (k < 0.62 ? 1 : 0);
          ox += an.dx * 0.17 * f;
          oz += an.dz * 0.17 * f;
          break;
        }
        case 'spin':
          rot += easeOut(k) * an.turns * TAU;
          break;
        case 'wiggle':
          // shaking itself off
          rot += Math.sin(k * Math.PI * 5) * 0.32 * (1 - k);
          break;
        case 'drop': {
          // back in: out of the air, stretched by the speed
          visible = true;
          lift += an.h * (1 - k * k);
          squash -= 0.28 * k;
          wide = 0;
          break;
        }
        case 'plunge': {
          visible = true;
          wide = 1;
          falling = true;
          if (s < an.hang) {
            // past the edge, over nothing, legs spinning: it hangs there, scrambling back toward the board
            const h = s / an.hang;
            ox += an.dx * 0.14 * easeOut(Math.min(1, h * 3));
            oz += an.dz * 0.14 * easeOut(Math.min(1, h * 3));
            rot += Math.sin(s * 40) * 0.17;
            leanX -= an.dx * 0.4 * Math.min(1, h * 4);
            leanZ -= an.dz * 0.4 * Math.min(1, h * 4);
            lift += 0.05 * Math.sin(h * Math.PI);
          } else if (s < an.hang + an.drop) {
            // ...and then it remembers gravity
            const f = (s - an.hang) / an.drop;
            ox += an.dx * (0.14 + 0.3 * f);
            oz += an.dz * (0.14 + 0.3 * f);
            lift = -1.58 * f * f;
            squash -= 0.32 * Math.min(1, f * 2.5);
            leanX += an.dx * f * 1.3;
            leanZ += an.dz * f * 1.3;
          } else {
            // far below: a flash on the floor, and it's gone
            const g = Math.min(1, (s - an.hang - an.drop) / 0.3);
            ox += an.dx * 0.44;
            oz += an.dz * 0.44;
            lift = -1.58;
            squash += 0.45 * (1 - g);
            fade = 1 - g;
          }
          if (k >= 1) {
            b.visible = false;
            visible = false;
          }
          break;
        }
        case 'gulp': {
          visible = true;
          wide = 1;
          falling = true;
          if (s < an.teeter) {
            // a wobble on the rim
            const h = s / an.teeter;
            lift += 0.08 * Math.sin(h * Math.PI);
            rot += Math.sin(s * 32) * 0.14;
            squash -= 0.1 * Math.sin(h * Math.PI);
          } else {
            // sucked down through the hole, spinning, and gone into the dark below
            const f = Math.min(1, (s - an.teeter) / an.sink);
            const e = f * f;
            rot += e * 9;
            lift = -1.5 * e;
            scale *= 1 - 0.45 * e;
            squash -= 0.3 * Math.min(1, f * 3);
            fade = 1 - f ** 2.4;
            inPit = lift < -0.45;
          }
          if (k >= 1) {
            b.visible = false;
            visible = false;
          }
          break;
        }
        case 'fall': {
          // (kept for anything that still asks for the plain fall)
          visible = true;
          if (an.edge) {
            lift = -k * k * 3;
            tilt = k * 1.6;
            fade = 1 - k;
          } else {
            lift = -easeOut(k) * 0.55;
            scale = 1 - k * 0.6;
            rot += k * 3;
            fade = 1 - k;
          }
          if (k >= 1) {
            b.visible = false;
            visible = false;
          }
          break;
        }
      }
      return k < 1;
    });
    const g = b.group;
    g.visible = visible;
    const p = this.course ? this.pos(px, py) : new THREE.Vector3();
    p.x += ox;
    p.z += oz;
    // the trail of light where it went
    if (visible && moving && fade > 0.5) {
      const last = b.trail[b.trail.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.04) b.trail.push({ x: p.x, z: p.z, t });
    } else if (!moving && b.trail.length) {
      const last = b.trail[b.trail.length - 1];
      if (Math.hypot(last.x - p.x, last.z - p.z) > 0.6) b.trail = []; // it was placed elsewhere
    }
    this.updateTrail(b, t);
    this.updateStars(b, p, lift, visible, t);
    if (!visible) {
      if (b.card) b.card.visible = false;
      if (b.face) this.dropFace(b);
      return;
    }
    const hover = b.model.hover ? Math.sin(t * 2.2 + b.phase) * 0.03 : 0;
    // raised a little (the Briefing's roll call: this one is yours)
    b.raise = (b.raise ?? 0) + ((b.raiseTo ?? 0) - (b.raise ?? 0)) * Math.min(1, dt * 7);
    lift += b.raise;
    g.position.set(p.x, lift, p.z);
    g.rotation.set(0, rot, 0);
    if (inPit !== !!b.inPit) {
      // drawn after the pits' lids, and only where a hole is seen (so it can't show under the board's edge)
      b.inPit = inPit;
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.renderOrder = inPit ? 7 : 0;
        for (const m of [].concat(o.material)) {
          m.stencilWrite = inPit;
          m.stencilRef = 1;
          m.stencilFunc = inPit ? THREE.EqualStencilFunc : THREE.AlwaysStencilFunc;
        }
      });
    }
    const body = b.model.body;
    body.position.y = hover + Math.sin(t * 2.6 + b.phase) * 0.006;
    // lean toward a world direction: turn it into the robot's own frame
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const lx = leanX * c - leanZ * sn;
    const lz = leanX * sn + leanZ * c;
    body.rotation.set(-tilt + lz, 0, -lx);
    const sq = Math.max(-0.45, Math.min(0.6, squash));
    body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    const pop = Math.max(0, Math.min(1, (t - b.pop) / 0.55));
    const popS = pop < 1 ? easeOut(pop) * (1 + Math.sin(pop * Math.PI) * 0.12) : 1;
    g.scale.setScalar(BOT_SCALE * scale * popS);
    const recoil = b.recoil ? Math.max(0, 1 - (t - b.recoil) / 0.25) : 0;
    body.position.z = recoil * 0.05 + (jitter ? (Math.random() - 0.5) * 0.06 * jitter : 0);

    // light: ready robots glow brighter while programming; someone deciding pulses; away dims
    const hurt = b.hurt ? Math.max(0, 1 - (t - b.hurt) / 0.7) : 0;
    const soot = b.soot ? Math.max(0, 1 - (t - b.soot) / 1.1) : 0; // a laser hit: its light sputters, its paint smokes
    const boot = b.boot != null ? (t - b.boot) / 0.6 : 2; // back in: the light flickers on like a tube
    let glow = 1;
    if (this.readyMode) glow = b.ready ? 1.25 : 0.45 + Math.sin(t * 2 + b.phase) * 0.12;
    if (b.deciding) glow = 1 + Math.sin(t * 7) * 0.5;
    if (b.away) glow = 0.25;
    if (b.shut) glow *= 0.35; // shut down: its lights at a third, a power mark over it
    glow *= 1 + 0.7 * Math.max(0, 1 - (t - this.boostT) / 1.6);
    glow *= fade;
    let eye = glow * (1 + wide * 0.8);
    if (hurt > 0 && Math.random() < 0.5) eye *= 0.2;
    if (soot > 0 && Math.random() < soot * 0.7) eye *= 0.1;
    if (boot < 0) eye = 0;
    else if (boot < 1) eye *= Math.random() < 0.35 + boot * 0.6 ? 1 : 0.05;
    b.model.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
    b.model.poolMat.opacity = 0.75 * glow * (0.6 + 0.4 * (1 - this.dimCur * (b.id === this.focusOn ? 0 : 1)));
    b.model.ringMat.opacity = 0.9 * Math.min(1, glow);
    if (hurt > 0) {
      b.model.paint.emissive.copy(b.hurtColor).multiplyScalar(1);
      b.model.paint.emissiveIntensity = 0.2 + hurt * (Math.random() < 0.5 ? 1.4 : 0.3);
      body.position.x = (Math.random() - 0.5) * 0.05 * hurt;
    } else {
      b.model.paint.emissive.set(b.color);
      b.model.paint.emissiveIntensity = 0.16 * (b.away ? 0.3 : 1) * (b.shut ? 0.35 : 1);
      body.position.x = jitter ? (Math.random() - 0.5) * 0.06 * jitter : 0;
    }
    if (soot > 0 || b.shut) {
      // sooty from a laser hit, or shut down: its paint goes dark too
      b.model.paint.color.set(b.color).multiplyScalar(Math.min(1 - 0.8 * soot, b.shut ? 0.4 : 1));
      b.sooted = true;
    } else if (b.sooted) {
      b.model.paint.color.set(b.color);
      b.sooted = false;
    }
    if (b.tag) {
      const cardUp = b.card?.visible && b.card.material.opacity > 0.05;
      b.tag.visible = this.tagsOnly
        ? this.tagsOnly.has(b.id) && !this.focusOn
        : this.showNames && !this.focusOn && (this.namesAlways || (!b.card && !b.face));
      b.tag.material.opacity = b.away ? 0.4 : 1;
      // round 1 (and the roll call): the name is stacked above the floating card, with a gap, and drawn over
      // every card and robot, so neither its own card nor a neighbour's can cover it
      const always = this.namesAlways || !!this.tagsOnly;
      b.tag.material.depthTest = !always;
      b.tag.renderOrder = always ? 36 : 20;
      const s = BOT_SCALE * scale * popS;
      const fs = this.faceScale ?? 1;
      const want = cardUp ? (b.card.position.y + b.card.scale.y / 2 + 0.3 - lift) / s : b.face ? (0.7 + 0.85 * fs + 0.28) / s : 0.86;
      if (always) {
        b.tagBase = (b.tagBase ?? want) + (want - (b.tagBase ?? want)) * Math.min(1, dt * 12);
        b.tag.position.y = b.tagBase + (b.tagLift ?? 0); // (spreadTags lifts it clear of a neighbour's name)
      } else {
        b.tag.position.y = 0.86; // (hidden while a card or a face is up: it comes back where it always was)
        b.tagBase = null;
        b.tagLift = 0;
      }
    }
    if (b.shutMark) {
      b.shutMark.visible = visible;
      b.shutMark.position.set(p.x, lift + 1.55 + Math.sin(t * 1.6 + b.phase) * 0.04, p.z);
      b.shutMark.material.opacity = 0.75 + Math.sin(t * 1.6 + b.phase) * 0.2;
    }
    // its face, when something comic is happening to it
    if (b.face) {
      const f = b.face;
      const k = (t - f.t0) / f.dur;
      if (k >= 1) this.dropFace(b);
      else {
        const fs = this.faceScale ?? 1;
        const sc = 0.86 * fs * easeBack(Math.min(1, k * (f.dur / 0.22))) * (k > 0.82 ? 1 - (k - 0.82) / 0.18 * 0.3 : 1);
        f.s.scale.set(sc, sc, 1);
        f.s.position.set(p.x, lift + 0.7 + 0.42 * fs + Math.sin(t * 9) * 0.015, p.z);
        f.s.material.opacity = (k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1) * Math.min(1, fade * 1.5);
      }
    }
    // its card floats above it; the one being played grows a little
    if (b.card) {
      const c = b.card;
      c.visible = !falling; // its card doesn't hang in the air after it
      const born = Math.max(0, Math.min(1, (t - c.userData.born) / 0.45));
      const played = c.userData.played ? Math.max(0, 1 - (t - c.userData.played) / 1.6) : 0;
      const s = (0.85 + 0.15 * easeOut(born)) * (1 + 0.28 * Math.min(1, played * 3));
      // the card turns over: its width opens from nothing, with a little overshoot
      const flip = born < 1 ? Math.sin(born * Math.PI * 0.5) * (1 + Math.sin(born * Math.PI) * 0.12) : 1;
      c.scale.set(c.userData.base.x * s * Math.max(0.02, flip), c.userData.base.y * s, 1);
      c.position.set(p.x, 1.72 + played * 0.1 + (1 - easeOut(born)) * 0.25 + (b.face ? 0.32 + 0.6 * ((this.faceScale ?? 1) - 1) : 0), p.z);
      c.material.opacity = Math.min(1, born * 3) * (this.focusOn ? 0 : 1);
    }
  }

  /**
   * Names that stay up (round 1, the roll call) never sit on top of each other: robots on neighbouring
   * spaces have their names stacked, the nearer one lowest, each farther one lifted just clear of it.
   */
  spreadTags(dt) {
    const tags = [];
    for (const b of this.bots.values()) {
      if (!b.tag?.visible || !b.group.visible || b.tagBase == null) continue;
      const s = b.group.scale.y;
      const base = new THREE.Vector3(b.group.position.x, b.group.position.y + b.tagBase * s, b.group.position.z);
      const p = this.project(base);
      const up = this.project(base.clone().setY(base.y + 1));
      const ppu = Math.max(1, p.y - up.y); // screen px per world unit, upward, at this depth
      tags.push({ b, s, x: p.x, y: p.y, ppu, w: b.tag.scale.x * s * ppu, h: b.tag.scale.y * s * ppu });
    }
    tags.sort((a, c) => c.y - a.y); // nearest (lowest on screen) first
    const placed = [];
    for (const T of tags) {
      let y = T.y;
      for (let pass = 0; pass < 8; pass++) {
        const hit = placed.find((P) => Math.abs(P.x - T.x) < (P.w + T.w) / 2 + 4 && Math.abs(P.y - y) < (P.h + T.h) / 2 + 2);
        if (!hit) break;
        y = hit.y - (hit.h + T.h) / 2 - 3;
      }
      placed.push({ ...T, y });
      const lift = (T.y - y) / T.ppu / T.s; // in the robot's own units
      T.b.tagLift = (T.b.tagLift ?? 0) + (lift - (T.b.tagLift ?? 0)) * Math.min(1, dt * 14);
      T.b.tag.position.y = T.b.tagBase + T.b.tagLift;
    }
  }

  /** Dizzy stars circling a robot's head. */
  updateStars(b, p, lift, visible, t) {
    const S = b.stars;
    const want = S && visible && t < S.until ? S.n : 0;
    b.starSprites ??= [];
    while (b.starSprites.length > want) {
      const s = b.starSprites.pop();
      this.fxGroup.remove(s);
      s.material.dispose();
    }
    if (!want) {
      if (S && t >= S.until) b.stars = null;
      return;
    }
    while (b.starSprites.length < want) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: hdr(PALETTE.energy, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      s.renderOrder = 34;
      this.fxGroup.add(s);
      b.starSprites.push(s);
    }
    const left = S.until - t;
    const o = Math.min(1, left / 0.4) * Math.min(1, (t - S.t0) / 0.15);
    b.starSprites.forEach((s, i) => {
      const a = t * 4.2 + (i / want) * TAU;
      const fs = this.faceScale ?? 1;
      s.position.set(p.x + Math.cos(a) * 0.36 * fs, lift + 0.78 + Math.sin(a * 2) * 0.03, p.z + Math.sin(a) * 0.36 * fs);
      const sc = (0.2 + 0.05 * Math.sin(t * 11 + i)) * fs;
      s.scale.set(sc, sc, 1);
      s.material.opacity = o;
    });
  }

  /** If the computer can't keep up: full resolution goes first, then shadows, a little more resolution, and last the glow. */
  adapt(dt) {
    if (document.hidden) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    this.frameTimes = [];
    if (med > 1 / 32) {
      if (this.pixelRatio > 1) {
        this.pixelRatio = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
      } else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
      } else if (this.pixelRatio > 0.8) {
        // a slightly softer picture before losing the glow, which is most of the look
        this.pixelRatio = 0.8;
        this.renderer.setPixelRatio(0.8);
        this.resize();
      } else if (this.useBloom) this.useBloom = false;
    }
  }
}
