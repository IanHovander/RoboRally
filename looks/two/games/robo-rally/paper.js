// The look of the pop-up paper world: one palette, printed paper drawn on canvases, card faces.
// Shared by the 3D scene (scene.js, standee.js) and anything else that paints on a canvas.
import { cardFace } from './icons.js';

export const PAL = {
  night: '#15282e', // the deep teal paper everything sits on
  night2: '#1d353c',
  night3: '#27464d',
  paper: '#f4ecdc', // cream card stock
  paper2: '#ece2cd',
  paperEdge: '#d6c8ac',
  dock: '#dfe3dc',
  dock2: '#d5dad2',
  ink: '#262531', // printing ink
  mustard: '#e3a63a', // walls
  mustardDark: '#b57f22',
  tomato: '#e2553b', // lasers, danger
  leaf: '#3e9a64', // green belts, gears that turn right
  leafDark: '#2b744a',
  sky: '#3b77c8', // blue belts, reboot
  skyDark: '#2a5796',
  gold: '#f0bd45', // energy
  plum: '#7a4590',
};

// The colors each kind of card prints in (cream card, colored picture), shared with the phones' CSS.
export const CARD_INK = { m1: '#2f5fa8', m2: '#2f5fa8', m3: '#2f5fa8', bk: '#2f5fa8', rr: '#20806f', rl: '#20806f', ut: '#7a4590', pu: '#b9800f', ag: '#4b5563' };

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);

/** Paper fibers and specks over whatever is on the canvas already (light, so print stays crisp). */
export function grain(g, x, y, w, h, amount = 1) {
  const n = Math.round((w * h) / 90 * amount);
  for (let i = 0; i < n; i++) {
    const dark = Math.random() < 0.55;
    g.fillStyle = dark ? `rgba(60,45,20,${rand(0.015, 0.06)})` : `rgba(255,255,255,${rand(0.03, 0.09)})`;
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    if (Math.random() < 0.12) {
      // a fiber
      g.save();
      g.translate(px, py);
      g.rotate(rand(0, TAU));
      g.fillRect(0, 0, rand(3, 9), 0.7);
      g.restore();
    } else g.fillRect(px, py, rand(0.6, 1.8), rand(0.6, 1.8));
  }
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** A chevron pointing up (centered on x,y), size s. */
export function chevron(g, x, y, s, thick = 0.42) {
  g.beginPath();
  g.moveTo(x, y - s * 0.5);
  g.lineTo(x + s * 0.55, y + s * 0.15);
  g.lineTo(x + s * 0.55, y + s * (0.15 + thick));
  g.lineTo(x, y - s * (0.5 - thick));
  g.lineTo(x - s * 0.55, y + s * (0.15 + thick));
  g.lineTo(x - s * 0.55, y + s * 0.15);
  g.closePath();
}

export function gearPath(g, cx, cy, r1, r2, teeth = 10) {
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const r = i % 2 ? r2 : r1;
    g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
  g.closePath();
}

export function bolt(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx + s * 0.12, cy - s * 0.5);
  g.lineTo(cx - s * 0.3, cy + s * 0.06);
  g.lineTo(cx - s * 0.02, cy + s * 0.06);
  g.lineTo(cx - s * 0.12, cy + s * 0.5);
  g.lineTo(cx + s * 0.3, cy - s * 0.08);
  g.lineTo(cx + s * 0.02, cy - s * 0.08);
  g.closePath();
}

export const FONT = (px, weight = 800) => `${weight} ${px}px Inter, "Segoe UI", system-ui, sans-serif`;
export const EMOJI_FONT = (px) => `${px}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;

// ---------- card faces (the same pictures the phones show) ----------

const faceCache = new Map();

/** The picture on a programming card as an <img> drawn in that card's ink (loads once). */
function faceImage(type) {
  if (faceCache.has(type)) return faceCache.get(type);
  const color = type === 'sp' ? PAL.paper : CARD_INK[type] ?? PAL.ink;
  const svg = cardFace(type).replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" style="color:${color}" `);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  faceCache.set(type, img);
  return img;
}
for (const t of ['m1', 'm2', 'm3', 'bk', 'rr', 'rl', 'ut', 'pu', 'ag', 'sp']) faceImage(t);

/** Draw one card (cream card, colored picture; SPAM is red, Haywire is ink). w:h is 5:7. */
export function drawCard(g, type, x, y, w, h) {
  const hay = /^h\d\d$/.test(type);
  const spam = type === 'sp';
  const r = w * 0.12;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.28)';
  g.shadowBlur = w * 0.08;
  g.shadowOffsetY = w * 0.04;
  g.fillStyle = spam ? PAL.tomato : hay ? PAL.ink : PAL.paper;
  roundRect(g, x, y, w, h, r);
  g.fill();
  g.restore();
  g.save();
  roundRect(g, x, y, w, h, r);
  g.clip();
  grain(g, x, y, w, h, 2);
  g.restore();
  g.strokeStyle = spam ? 'rgba(255,255,255,.55)' : hay ? PAL.gold : 'rgba(38,37,49,.22)';
  g.lineWidth = Math.max(1, w * 0.025);
  roundRect(g, x + w * 0.06, y + w * 0.06, w * 0.88, h - w * 0.12, r * 0.6);
  g.stroke();
  if (hay) {
    g.fillStyle = PAL.gold;
    bolt(g, x + w / 2, y + h / 2, w * 0.62);
    g.fill();
    return;
  }
  const img = faceImage(type);
  if (img.complete && img.naturalWidth) {
    const s = w * 0.82;
    g.drawImage(img, x + (w - s) / 2, y + (h - s) / 2, s, s);
  }
}

/** A cream paper tag with ink text (names over robots, numbers). Returns a canvas. */
export function tagCanvas(text, { font = 56, color = PAL.ink, bg = PAL.paper, pad = 18, weight = 750 } = {}) {
  const probe = canvas(4, 4).getContext('2d');
  probe.font = FONT(font, weight);
  const tw = Math.ceil(probe.measureText(text).width);
  const c = canvas(tw + pad * 2, font * 1.45);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  roundRect(g, 1, 1, c.width - 2, c.height - 2, c.height * 0.3);
  g.fill();
  grain(g, 0, 0, c.width, c.height, 1.5);
  g.font = FONT(font, weight);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2 + font * 0.04);
  return c;
}
