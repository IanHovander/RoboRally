// Pictures instead of words: card faces as SVG, Haywire cards drawn as the moves they make,
// an emoji for every upgrade, and small status symbols. Everything uses currentColor.
import { cardType, HAYWIRE, UPGRADES } from './cards.js';

const svg = (body, cls = '') => `<svg class="rr-ic ${cls}" viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

const chevrons = (n) => {
  const gap = n === 1 ? 0 : n === 2 ? 9 : 8;
  const top = 20 - ((n - 1) * gap) / 2 - 4;
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = top + i * gap;
    d += `M9 ${y + 9} L20 ${y} L31 ${y + 9} `;
  }
  return `<path d="${d}" ${S} stroke-width="5.5"/>`;
};

const FACES = {
  m1: () => chevrons(1),
  m2: () => chevrons(2),
  m3: () => chevrons(3),
  bk: () => `<path d="M9 16 L20 27 L31 16" ${S} stroke-width="5.5"/><path d="M20 7 V22" ${S} stroke-width="3" stroke-dasharray="3 4"/>`,
  rr: () => `<path d="M12 30 V20 a8 8 0 0 1 8 -8 h6" ${S} stroke-width="5"/><path d="M24 5 L32 12 L24 19 Z" fill="currentColor"/>`,
  rl: () => `<path d="M28 30 V20 a8 8 0 0 0 -8 -8 h-6" ${S} stroke-width="5"/><path d="M16 5 L8 12 L16 19 Z" fill="currentColor"/>`,
  ut: () => `<path d="M12 33 V17 a8 8 0 0 1 16 0 V24" ${S} stroke-width="5"/><path d="M21 22 L28 32 L35 22 Z" fill="currentColor"/>`,
  pu: () => `<path d="M23 4 L10 22 H19 L16 36 L30 16 H21 Z" fill="currentColor"/>`,
  ag: () => `<path d="M30 15 A11 11 0 1 0 31 24" ${S} stroke-width="4.5"/><path d="M24 9 L32 15 L25 21 Z" fill="currentColor"/><circle cx="20" cy="20" r="3" fill="currentColor"/>`,
  sp: () => `<path d="M20 5 L36 33 H4 Z" fill="currentColor"/><path d="M20 14 V23" stroke="#000" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="28.5" r="2.4" fill="#000"/>`,
  back: () => `<rect x="7" y="5" width="26" height="30" rx="4" ${S} stroke-width="3"/><path d="M13 12 L27 28 M27 12 L13 28" ${S} stroke-width="2.5" opacity=".5"/>`,
};

// Haywire specials get a picture of their own.
const HW_EMOJI = { install: '🔧', storm: '✴️', double: '✌️', spin: '🌀', swap: '🔀', emp: '💥', overcharge: '🔥', en: '⚡', dmg: '⚠️' };

/** One programming card's face (an icon, no words). */
export function cardFace(type) {
  return svg((FACES[type] ?? FACES.back)());
}

/** A Haywire card: the moves it makes, left to right, as little pictures. */
export function haywireFace(type) {
  const hw = HAYWIRE[type];
  if (!hw) return cardFace('back');
  const parts = [];
  for (const op of hw.ops) {
    const [k, a, b] = op;
    if (k === 'mv') {
      const dirIcon = a === 0 ? `m${Math.min(3, b)}` : a === 2 ? 'bk' : null;
      if (a === 'side') parts.push(`<span class="rr-hw-txt">⇆${b}</span>`);
      else if (a === 1 || a === 3) parts.push(`<span class="rr-hw-txt">${a === 1 ? '⇥' : '⇤'}${b}</span>`);
      else if (b > 3 || (a === 2 && b > 1)) parts.push(`${cardFaceSmall(dirIcon)}<span class="rr-hw-txt">×${b}</span>`);
      else parts.push(cardFaceSmall(dirIcon));
    } else if (k === 'rt') parts.push(cardFaceSmall(a === 1 ? 'rr' : a === -1 ? 'rl' : 'ut'));
    else if (k === 'en') parts.push(`<span class="rr-hw-txt">⚡+${a}</span>`);
    else if (k === 'dmg') parts.push(`<span class="rr-hw-txt">⚠️</span>`);
    else parts.push(`<span class="rr-hw-txt">${HW_EMOJI[k] ?? '?'}</span>`);
  }
  return `<span class="rr-hw-seq">${parts.join('')}</span>`;
}

const cardFaceSmall = (type) => svg((FACES[type] ?? FACES.back)(), 'sm');

/** Any card id or type, as its picture. */
export function cardPicture(idOrType) {
  const t = cardType(idOrType);
  return HAYWIRE[t] ? haywireFace(t) : cardFace(t);
}

/** CSS class for a card's color. */
export function cardKind(idOrType) {
  const t = cardType(idOrType);
  return t === 'sp' ? 'spam' : HAYWIRE[t] ? 'haywire' : `t-${t}`;
}

export const UPGRADE_EMOJI = {
  'brakes': '🛑',
  'chaos-theory': '🌀',
  'crab-legs': '🦀',
  'deflector-shield': '🛡️',
  'double-barrel': '🔥',
  'drifting': '🏎️',
  'energy-conversion': '♻️',
  'firewall': '🧱',
  'flash-drive': '💾',
  'hover-unit': '🛸',
  'laser-kata': '🥋',
  'memory-cards': '🗂️',
  'mini-howitzer': '💣',
  'modular-chassis': '🔧',
  'power-slide': '🛹',
  'pressor-beam': '💨',
  'rail-gun': '🎯',
  'ramming-gear': '🐏',
  'rear-laser': '🔙',
  'scrambler': '📡',
  'self-diagnostics': '🩺',
  'spam-filter': '🔍',
  'spiky': '🦔',
  'tractor-beam': '🧲',
  'abort-switch': '⏏️',
  'all-aboard': '🚂',
  'boink': '🦘',
  'calibration-protocol': '🎛️',
  'displacing-blast': '🌪️',
  'lucky-booster': '🍀',
  'magnetic': '🤝',
  'memory-swap': '🔄',
  'overclocked': '🚀',
  'piercing-drill': '🪛',
  'pressure-release': '🧯',
  're-initialize': '🥇',
  'recharge': '🔌',
  'rewire': '🪢',
  'switch': '🔀',
  'zoop': '🧭',
};

export const upgradeIcon = (key) => UPGRADE_EMOJI[key] ?? '❔';
export const upgradeName = (key) => UPGRADES[key]?.name ?? key;

/** Small symbols the screens use instead of words. */
export const SYMBOL = {
  energy: '⚡',
  flag: '🏁',
  spam: '⚠️',
  ready: '✔',
  away: '💤',
  shutdown: '⏻',
  reboot: '↻',
  shop: '🛒',
  priority: '🥇',
  push: '💥',
  hit: '🎯',
  fall: '🕳️',
  trophy: '🏆',
};

/** Arrow for an absolute direction (0 north … 3 west). */
export const ARROW = ['⬆', '➡', '⬇', '⬅'];
