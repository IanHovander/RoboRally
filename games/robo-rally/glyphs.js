// Lumen's picture language, shared by the big screen (drawn on canvases) and the phones (SVG):
// card glyphs, the six robot forms, and small marks. Everything is a thin line of light.
import { cardType, HAYWIRE } from './cards.js';

// ---------- card glyphs (40 x 40 box, stroked unless marked fill) ----------

const chev = (y) => `M11 ${y + 6} L20 ${y - 3} L29 ${y + 6}`;
export const GLYPHS = {
  m1: [{ d: chev(17) }],
  m2: [{ d: chev(12) }, { d: chev(21) }],
  m3: [{ d: chev(8) }, { d: chev(16) }, { d: chev(24) }],
  bk: [{ d: 'M11 19 L20 28 L29 19' }, { d: 'M20 10 V21', dash: true }],
  rr: [{ d: 'M14 31 V22 a8 8 0 0 1 8 -8 H28' }, { d: 'M24 9 L29 14 L24 19' }],
  rl: [{ d: 'M26 31 V22 a8 8 0 0 0 -8 -8 H12' }, { d: 'M16 9 L11 14 L16 19' }],
  ut: [{ d: 'M13 31 V18 a7 7 0 0 1 14 0 V27' }, { d: 'M22 23 L27 28 L32 23' }],
  pu: [{ d: 'M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z', fill: true }],
  ag: [{ d: 'M29.5 14.5 A11 11 0 1 0 31 22.5' }, { d: 'M24.5 10 L30 14.6 L24.6 18.8' }, { d: 'M20 20 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0', fill: true }],
  sp: [{ d: 'M20 8 L33 31 H7 Z' }, { d: 'M20 16 V23' }, { d: 'M20 27 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0', fill: true }],
  abort: [{ d: 'M12 22 L20 12 L28 22 Z' }, { d: 'M12 28 H28' }],
  back: [{ d: 'M20 11 L29 20 L20 29 L11 20 Z' }],
  // small marks used around the game
  flag: [{ d: 'M13 33 V8' }, { d: 'M13 9 H28 L24 14.5 L28 20 H13', fill: true }],
  bolt: [{ d: 'M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z', fill: true }],
  check: [{ d: 'M11 21 L17.5 27.5 L30 13' }],
  cross: [{ d: 'M13 13 L27 27 M27 13 L13 27' }],
  play: [{ d: 'M15 11 L29 20 L15 29 Z', fill: true }],
  power: [{ d: 'M20 9 V19' }, { d: 'M13.2 13.5 A10 10 0 1 0 26.8 13.5' }],
  reboot: [{ d: 'M29 20 A9 9 0 1 1 26 13.3' }, { d: 'M27.5 8 L26.5 13.8 L32 15' }],
  swap: [{ d: 'M11 15 H28 M24 11 L28 15 L24 19' }, { d: 'M29 25 H12 M16 21 L12 25 L16 29' }],
  shop: [{ d: 'M11 15 H29 L27 31 H13 Z' }, { d: 'M16 15 V12 a4 4 0 0 1 8 0 V15' }],
  home: [{ d: 'M10 20 L20 11 L30 20' }, { d: 'M14 18 V30 H26 V18' }],
  plus: [{ d: 'M20 11 V29 M11 20 H29' }],
  minus: [{ d: 'M11 20 H29' }],
  undo: [{ d: 'M15 13 L10 18 L15 23' }, { d: 'M10.5 18 H23 a7 7 0 0 1 0 14 H17' }],
  edit: [{ d: 'M12 28 L13.5 22 L25 10.5 L29.5 15 L18 26.5 Z' }],
  timer: [{ d: 'M20 22 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0' }, { d: 'M20 22 V16' }, { d: 'M17 8 H23' }],
  inf: [{ d: 'M20 20 C16 14 9 14 9 20 C9 26 16 26 20 20 C24 14 31 14 31 20 C31 26 24 26 20 20' }],
  wall: [{ d: 'M9 30 H31' }, { d: 'M9 30 V12 M31 30 V12' }],
  edge: [{ d: 'M9 28 H24' }, { d: 'M28 28 L31 33', dash: true }],
  eye: [{ d: 'M8 20 C13 12 27 12 32 20 C27 28 13 28 8 20 Z' }, { d: 'M20 20 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', fill: true }],
  keep: [{ d: 'M12 10 H28 V31 L20 25 L12 31 Z' }],
  hand: [{ d: 'M11 13 h9 v18 h-9 z' }, { d: 'M20 13 h9 v18 h-9 z' }],
  sound: [{ d: 'M10 17 H15 L21 12 V28 L15 23 H10 Z', fill: true }, { d: 'M25 15 a7 7 0 0 1 0 10' }, { d: 'M28 11.5 a12 12 0 0 1 0 17' }],
  mute: [{ d: 'M10 17 H15 L21 12 V28 L15 23 H10 Z', fill: true }, { d: 'M25 16 L31 24 M31 16 L25 24' }],
  dots: [{ d: 'M12 20 h.01 M20 20 h.01 M28 20 h.01' }],
  left: [{ d: 'M23.5 11 L14.5 20 L23.5 29' }],
  right: [{ d: 'M16.5 11 L25.5 20 L16.5 29' }],
};

/** One glyph as an SVG string. */
export function svgGlyph(name, cls = '') {
  const parts = GLYPHS[name] ?? GLYPHS.back;
  const body = parts
    .map((p) => (p.fill ? `<path d="${p.d}" fill="currentColor"/>` : `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"${p.dash ? ' stroke-dasharray="1 5"' : ''}/>`))
    .join('');
  return `<svg class="lm-g ${cls}" viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
}

/** Draw a glyph on a 2D canvas: centered at x,y, size px tall. */
export function drawGlyph(g, name, x, y, size, color, width = 3.2) {
  const parts = GLYPHS[name] ?? GLYPHS.back;
  g.save();
  g.translate(x - size / 2, y - size / 2);
  g.scale(size / 40, size / 40);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const p of parts) {
    const path = new Path2D(p.d);
    if (p.fill) g.fill(path);
    else {
      g.setLineDash(p.dash ? [1, 5] : []);
      g.stroke(path);
    }
  }
  g.restore();
}

// ---------- cards ----------

/** How a card looks: 'prog' (light slide), 'spam' (coral), 'hay' (violet). */
export function cardTone(idOrType) {
  const t = cardType(idOrType);
  if (t === 'sp') return 'spam';
  if (HAYWIRE[t]) return 'hay';
  return 'prog';
}

/** A Haywire card as the little moves it makes, in order. Returns glyph names (or short marks). */
export function haywireParts(type) {
  const hw = HAYWIRE[type];
  if (!hw) return ['back'];
  const out = [];
  for (const [k, a, b] of hw.ops) {
    if (k === 'mv') {
      if (a === 0) out.push(...(b <= 3 ? [`m${b}`] : ['m1', `×${b}`]));
      else if (a === 2) out.push(...(b > 1 ? ['bk', `×${b}`] : ['bk']));
      else out.push(a === 3 ? 'side-l' : a === 1 ? 'side-r' : 'side');
    } else if (k === 'rt') out.push(a === 1 ? 'rr' : a === -1 ? 'rl' : 'ut');
    else if (k === 'en') out.push('pu');
    else out.push(k);
  }
  return out;
}

const HW_MARK = { 'm3+': '5', side: '⇆', 'side-l': '⇤', 'side-r': '⇥', install: '+', storm: '✶', double: '×2', spin: '?', swap: '⇄', emp: '◎', overcharge: '+2', dmg: '!' };

/** The inner picture of a card (SVG markup, no frame). */
export function cardInner(idOrType) {
  const t = cardType(idOrType);
  if (!HAYWIRE[t]) return svgGlyph(t);
  return `<span class="lm-hw">${haywireParts(t)
    .map((p) => (GLYPHS[p] ? svgGlyph(p, 'sm') : p.startsWith('bk×') ? `${svgGlyph('bk', 'sm')}<b>×${p.slice(3)}</b>` : `<b>${HW_MARK[p] ?? p}</b>`))
    .join('')}</span>`;
}

/** A whole card (frame + picture). */
export function cardSvgHtml(idOrType, cls = '') {
  return `<span class="lm-card ${cardTone(idOrType)} t-${cardType(idOrType)} ${cls}">${cardInner(idOrType)}</span>`;
}

/** Draw a card on a canvas (for the big screen's floating cards). Returns nothing; w x h at x,y (top-left). */
export function drawCard(g, idOrType, x, y, w, h, { font = 'Lumen' } = {}) {
  const t = cardType(idOrType);
  const tone = cardTone(t);
  const bg = tone === 'spam' ? '#ff7a6b' : tone === 'hay' ? '#b99bff' : '#f4f1ea';
  const ink = tone === 'prog' ? (t === 'pu' ? '#c98a12' : t === 'ag' ? '#6b6f78' : '#15181d') : '#15181d';
  g.save();
  g.shadowColor = tone === 'spam' ? 'rgba(255,110,90,.9)' : tone === 'hay' ? 'rgba(170,130,255,.9)' : 'rgba(255,250,235,.85)';
  g.shadowBlur = w * 0.18;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(x, y, w, h, w * 0.16);
  g.fill();
  g.restore();
  if (HAYWIRE[t]) {
    const parts = haywireParts(t);
    const s = Math.min(h * 0.56, (w * 0.92) / parts.length);
    parts.forEach((p, i) => {
      const cx = x + w / 2 + (i - (parts.length - 1) / 2) * s;
      if (GLYPHS[p]) drawGlyph(g, p, cx, y + h / 2, s, ink, 3.6);
      else {
        g.fillStyle = ink;
        g.font = `600 ${Math.round(s * 0.6)}px ${font}, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(p.startsWith('bk×') ? `×${p.slice(3)}` : HW_MARK[p] ?? p, cx, y + h / 2);
      }
    });
  } else drawGlyph(g, t, x + w / 2, y + h / 2, Math.min(w, h) * 0.78, ink, 3.6);
}

// ---------- robots ----------

export const FORMS = ['Pebble', 'Orb', 'Prism', 'Capsule', 'Cube', 'Spire'];
/** Which of the six forms a player's robot is (from the framework's 0-11 avatar choice). */
export const formOf = (p) => {
  const a = Number.isInteger(p?.avatar) ? p.avatar : hashStr(p?.id ?? p?.name ?? '');
  return ((a % FORMS.length) + FORMS.length) % FORMS.length;
};
function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

// Top-down silhouettes, facing up. The light mark (eye) is drawn on top in white.
const FORM_SVG = [
  // pebble: a rounded arrowhead
  { body: 'M24 5 C30 5 41 31 40 37 C39 43 31 44 24 41 C17 44 9 43 8 37 C7 31 18 5 24 5 Z', eye: 'M19.5 16 Q24 13.6 28.5 16' },
  // orb: a sphere over its ring
  { body: 'M24 24 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0', ring: 'M24 24 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', eye: 'M20.5 13.5 Q24 12 27.5 13.5' },
  // prism: a triangle with its ridge
  { body: 'M24 5 L42 40 Q43 42 41 42 H7 Q5 42 6 40 Z', ridge: 'M24 9 V40', eye: 'M22 15 L24 11 L26 15' },
  // capsule: a pill with its visor
  { body: 'M24 5 C32 5 35 11 35 17 V31 C35 37 32 43 24 43 C16 43 13 37 13 31 V17 C13 11 16 5 24 5 Z', eye: 'M17.5 13 Q24 9.5 30.5 13' },
  // cube: a rounded square
  { body: 'M14 7 H34 Q41 7 41 14 V34 Q41 41 34 41 H14 Q7 41 7 34 V14 Q7 7 14 7 Z', eye: 'M14 13 H34' },
  // spire: a cone seen from above, leaning forward
  { body: 'M24 24 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0', ridge: 'M24 6 L31 26 L24 31 L17 26 Z', eye: 'M24 9 V16' },
];

/** A player's robot as a small SVG (fill = their color). */
export function robotSvg(p, { cls = '', dim = false } = {}) {
  const form = formOf(p);
  const f = FORM_SVG[form];
  const c = /^#[0-9a-f]{3,8}$/i.test(p?.color ?? '') ? p.color : '#9aa0aa';
  const id = `lmr${c.slice(1)}${form}`;
  // a polished body: lighter toward the top left; a ring of light on the floor with a pointer in front
  return `<svg class="lm-bot ${cls}" viewBox="0 0 48 48" aria-hidden="true" style="--c:${c}">
    <defs><radialGradient id="${id}" cx="34%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient></defs>
    <circle cx="24" cy="24" r="22.4" fill="none" stroke="${c}" stroke-opacity="${dim ? 0.2 : 0.55}" stroke-width="1.4"/>
    <path d="M24 -.6 L27 3.4 L21 3.4 Z" fill="${c}" fill-opacity="${dim ? 0.3 : 0.9}"/>
    <g transform="translate(24 24) scale(.8) translate(-24 -24)" ${dim ? 'opacity=".4"' : ''}>
      ${f.ring ? `<path d="${f.ring}" fill="none" stroke="${c}" stroke-opacity=".6" stroke-width="2.4"/>` : ''}
      <path d="${f.body}" fill="${c}"/>
      <path d="${f.body}" fill="url(#${id})"/>
      ${f.ridge ? `<path d="${f.ridge}" fill="#fff" fill-opacity=".22"/>` : ''}
      <path d="${f.eye}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

/** Draw a robot form flat on a canvas (the phones' map, the lessons). x,y center, r ~ half size, ang radians (0 = up). */
export function drawRobot(g, form, x, y, r, ang, color, { alpha = 1, glow = true, me = false } = {}) {
  const f = FORM_SVG[form] ?? FORM_SVG[0];
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(ang);
  const s = (r * 2) / 48;
  g.scale(s, s);
  g.translate(-24, -24);
  if (glow) {
    g.shadowColor = color;
    g.shadowBlur = 14;
  }
  if (f.ring) {
    g.strokeStyle = color;
    g.globalAlpha = alpha * 0.6;
    g.lineWidth = 2.2;
    g.stroke(new Path2D(f.ring));
    g.globalAlpha = alpha;
  }
  g.fillStyle = color;
  g.fill(new Path2D(f.body));
  g.shadowBlur = 0;
  if (me) {
    g.strokeStyle = '#fff';
    g.lineWidth = 2.4;
    g.stroke(new Path2D(f.body));
  }
  if (f.ridge) {
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.fill(new Path2D(f.ridge));
  }
  g.strokeStyle = '#fff';
  g.lineWidth = 3.2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke(new Path2D(f.eye));
  g.restore();
}

/** Each robot has its own note (lobby chimes, checkpoints): a pentatonic step by seat. */
export const SEAT_NOTES = [0, 2, 4, 7, 9, 12, 14, 16];

// ---------- courses ----------
// Lumen's own short names for the courses in board.js (by id), and how hard each one is (1-4).
export const COURSE_TITLES = {
  'closing-time': 'First Light',
  'blue-light-special': 'Current',
  'inventory-day': 'Lattice',
  'aisle-nine': 'Prism',
  'everything-must-go': 'Meridian',
  'grand-reopening': 'Horizon',
};
export const LEVELS = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
export const courseTitle = (c) => COURSE_TITLES[c?.id ?? c] ?? c?.name ?? '';
