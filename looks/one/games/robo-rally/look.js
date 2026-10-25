// "Last Light": the palette and a few helpers shared by the big screen, the phones and the lobby.
// Player colors arrive from the room as bright UI colors; on screen they become paint: the same hue,
// a little deeper and less saturated, so eight robots sit together in one filmic palette.
import { design } from '../../js/avatar.js';

const PAINTS = {
  '#ff4d6d': '#d9483f', // signal red
  '#4dabf7': '#3f88c8', // petrol blue
  '#ffd43b': '#e0b13e', // ochre
  '#51cf66': '#5aad6b', // sage
  '#cc5de8': '#9d72d6', // violet
  '#ff922b': '#e8823a', // safety orange
  '#22d3ee': '#3dbac2', // teal
  '#f783ac': '#dc85a5', // rose
};

/** A player's color as paint (hex). */
export function paint(color) {
  const key = String(color ?? '').toLowerCase();
  if (PAINTS[key]) return PAINTS[key];
  const m = /^#([0-9a-f]{6})$/.exec(key);
  if (!m) return '#9a958c';
  const n = parseInt(m[1], 16);
  let [h, s, l] = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  s = Math.min(s, 0.7) * 0.82;
  l = Math.min(0.66, Math.max(0.5, l * 0.86));
  return hslToHex(h, s, l);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// The twelve avatar designs map onto the eight robot models the 3D scene builds.
const STYLES = [6, 1, 1, 7, 2, 5, 3, 4, 6, 6, 0, 6];
/** Which of the 8 robot models a player drives. */
export const modelOf = (player) => STYLES[design(player)] ?? 6;
/** For each model, the avatar id that selects it (the room stores avatar ids 0-11). */
export const AVATAR_FOR_MODEL = [10, 1, 4, 6, 7, 5, 0, 3];
/** The order models are offered in. */
export const MODEL_ORDER = [6, 0, 2, 5, 1, 3, 7, 4];

const IMG = (name) => new URL(`./img/${name}`, import.meta.url).href;

/**
 * The player's robot as a lit studio portrait in their paint: a rendered model (img/bot-N.webp)
 * with its painted parts tinted through a mask. Plain HTML, so it works in html`` templates.
 */
export function portrait(player, { model, cls = '', mood = '' } = {}) {
  const m = model ?? modelOf(player);
  const c = paint(player?.color);
  return `<span class="pt ${cls} ${mood}" style="--c:${c};--mask:url('${IMG(`bot-${m}-mask.webp`)}')"><img alt="" src="${IMG(`bot-${m}.webp`)}" draggable="false"><i></i></span>`;
}
