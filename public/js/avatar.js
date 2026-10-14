// Every player gets a little robot in their own color. Same player, same robot, on every screen.
//   import { avatar } from '../../js/avatar.js';   (from a game's host.js / player.js)
//   html`${avatar(player)}`                  -> <svg class="bot">…</svg>
//   avatar(player, { mood: 'happy' })        -> squinty happy eyes (winners, "done")
//   avatar(player, { pose: 3 })              -> a particular robot (0-11) instead of the player's own
// Disconnected players nod off automatically. Size it with CSS (width/height on .bot).
// There are 12 robots, each in its own pose. The first 12 players to join all get different ones.
import { raw } from './ui.js';

const INK = '#1a1a1a';
const GREY = '#cccccc';
const RED = '#c80f14';
const OUT = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const r = (n) => Math.round(n * 10) / 10;

// ---------- parts ----------

/** An arm or leg along a path: an ink outline with grey metal inside. */
const limb = (d, w = 5, color = GREY) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5.5}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand = (x, y, size = 3.8) => `<circle cx="${x}" cy="${y}" r="${size}" fill="${GREY}" stroke="${INK}" stroke-width="2.6"/>`;
const foot = (x, y, w = 10) => `<rect x="${r(x - w / 2)}" y="${y - 3}" width="${w}" height="6" rx="3" fill="${INK}"/>`;
const treads = (x, y, w) =>
  `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${INK}"/>` +
  [0.15, 0.38, 0.62, 0.85].map((f) => `<circle cx="${r(x + w * f)}" cy="${y + 5}" r="2.3" fill="#555"/>`).join('');
const wheel = (x, y, size) =>
  `<circle cx="${x}" cy="${y}" r="${size}" fill="${INK}"/><circle cx="${x}" cy="${y}" r="${r(size * 0.38)}" fill="${GREY}"/>`;

/** The torso, in the player's color, with a little status light. */
function torso(x, y, w, h, rx = 4) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="currentColor" ${OUT}/>` +
    `<rect x="${x + 2}" y="${r(y + h * 0.62)}" width="${w - 4}" height="${r(h * 0.28)}" rx="1.5" fill="#000" fill-opacity=".2"/>` +
    `<rect x="${r(x + w / 2 - 5)}" y="${y + 3.5}" width="10" height="4" rx="1.3" fill="${INK}"/>` +
    `<rect x="${r(x + w / 2 - 3.5)}" y="${y + 4.6}" width="3.2" height="1.8" fill="${RED}"/>`
  );
}

// Things on top of the head. Each gets the head's box.
const TOPS = {
  mast: (x, y, w) => `<path d="M${x + w / 2} ${y + 1}v-8" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/><circle class="bot-light" cx="${x + w / 2}" cy="${y - 8}" r="3.6" fill="${RED}" ${OUT}/>`,
  ears: (x, y, w) =>
    `<path d="M${x + 1} ${y + 9}l2.5-13l12 7.5z" fill="currentColor" ${OUT}/><path d="M${x + w - 1} ${y + 9}l-2.5-13l-12 7.5z" fill="currentColor" ${OUT}/>` +
    `<path d="M${x + 4.5} ${y + 3}l1.3-5l4.6 3z M${x + w - 4.5} ${y + 3}l-1.3-5l-4.6 3z" fill="${INK}" fill-opacity=".45"/>`,
  bolt: (x, y, w) => `<path d="M${x + w / 2} ${y - 9}l5.5 3.2v6.4l-5.5 3.2l-5.5-3.2v-6.4z" fill="${GREY}" ${OUT}/>`,
  twin: (x, y, w) =>
    `<path d="M${x + w * 0.3} ${y + 1}l-4-8M${x + w * 0.7} ${y + 1}l4-8" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>` +
    `<circle class="bot-light" cx="${r(x + w * 0.3 - 4.5)}" cy="${y - 8}" r="3" fill="${RED}" ${OUT}/><circle cx="${r(x + w * 0.7 + 4.5)}" cy="${y - 8}" r="3" fill="${GREY}" ${OUT}/>`,
  prop: (x, y, w) =>
    `<path d="M${x + w / 2} ${y + 1}v-7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<g class="bot-prop" style="transform-origin:${x + w / 2}px ${y - 7}px"><ellipse cx="${x + w / 2}" cy="${y - 7}" rx="17" ry="3" fill="${GREY}" ${OUT}/></g>` +
    `<circle cx="${x + w / 2}" cy="${y - 7}" r="2.6" fill="${RED}" stroke="${INK}" stroke-width="2.2"/>`,
  none: () => '',
};

/** Eyes, centered on the visor. */
function eyes(kind, cx, cy, vw, vh) {
  const d = r(vw * 0.21);
  const e = r(vh * 0.3);
  switch (kind) {
    case 'happy':
      return `<path d="M${r(cx - d - 4)} ${r(cy + 2)}q4-6.5 8 0M${r(cx + d - 4)} ${r(cy + 2)}q4-6.5 8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    case 'sleep':
      return `<path d="M${r(cx - d - 4)} ${cy + 1}h8M${r(cx + d - 4)} ${cy + 1}h8" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`;
    case 'wide':
      return `<circle cx="${r(cx - d)}" cy="${cy}" r="${r(e * 1.25)}" fill="#fff"/><circle cx="${r(cx + d)}" cy="${cy}" r="${r(e * 1.25)}" fill="#fff"/><circle cx="${r(cx - d + 1)}" cy="${r(cy - 1.4)}" r="1.9" fill="${INK}"/><circle cx="${r(cx + d + 1)}" cy="${r(cy - 1.4)}" r="1.9" fill="${INK}"/>`;
    case 'bar':
      return `<rect x="${r(cx - vw * 0.36)}" y="${r(cy - 2.6)}" width="${r(vw * 0.72)}" height="5.2" rx="2.6" fill="#fff"/><rect x="${r(cx + vw * 0.02)}" y="${r(cy - 2.6)}" width="${r(vw * 0.22)}" height="5.2" rx="2.6" fill="${RED}"/>`;
    case 'cyclops':
      return `<circle cx="${cx}" cy="${cy}" r="${r(vh * 0.38)}" fill="#fff"/><circle cx="${r(cx + 1.8)}" cy="${r(cy - 1.2)}" r="${r(vh * 0.16)}" fill="${INK}"/>`;
    case 'square':
      return `<rect x="${r(cx - d - 3.5)}" y="${r(cy - 4)}" width="7" height="8" rx="1.5" fill="#fff"/><rect x="${r(cx + d - 3.5)}" y="${r(cy - 4)}" width="7" height="8" rx="1.5" fill="#fff"/>`;
    case 'fierce':
      return `<path d="M${r(cx - d - 4.5)} ${r(cy - 3.5)}l9 3v4.5h-9zM${r(cx + d + 4.5)} ${r(cy - 3.5)}l-9 3v4.5h9z" fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`;
    case 'wink':
      return `<circle cx="${r(cx - d)}" cy="${cy}" r="${e}" fill="#fff"/><circle cx="${r(cx - d + 1)}" cy="${r(cy - 1)}" r="1.4" fill="${INK}"/><path d="M${r(cx + d - 4)} ${r(cy + 1)}q4-5 8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    case 'side': // looking off to the side, plotting
      return `<rect x="${r(cx - d - 4)}" y="${r(cy - 1.5)}" width="8" height="4" rx="2" fill="#fff"/><rect x="${r(cx + d - 4)}" y="${r(cy - 1.5)}" width="8" height="4" rx="2" fill="#fff"/><circle cx="${r(cx - d + 2.2)}" cy="${r(cy + 0.5)}" r="1.5" fill="${INK}"/><circle cx="${r(cx + d + 2.2)}" cy="${r(cy + 0.5)}" r="1.5" fill="${INK}"/>`;
    default: // round
      return `<circle cx="${r(cx - d)}" cy="${cy}" r="${e}" fill="#fff"/><circle cx="${r(cx + d)}" cy="${cy}" r="${e}" fill="#fff"/><circle cx="${r(cx - d + 1.2)}" cy="${r(cy - 1)}" r="1.4" fill="${INK}"/><circle cx="${r(cx + d + 1.2)}" cy="${r(cy - 1)}" r="1.4" fill="${INK}"/>`;
  }
}

/** A head: the player's color, a dark visor, eyes, and something on top. Rotates around its middle. */
function head({ x, y, w = 36, h = 27, rot = 0, look = 'round', top = 'mast' }, mood) {
  const vx = r(x + w * 0.14), vy = r(y + h * 0.27), vw = r(w * 0.72), vh = r(h * 0.5);
  return (
    `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">` +
    TOPS[top](x, y, w, h) +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r(h * 0.34)}" fill="currentColor" ${OUT}/>` +
    `<path d="M${x + 6} ${y + 6.5}q1.6-3.2 6.5-3.2h${r(w * 0.3)}" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="${r(vh * 0.45)}" fill="${INK}"/>` +
    eyes(mood ?? look, r(vx + vw / 2), r(vy + vh / 2), vw, vh) +
    `</g>`
  );
}

const lines = (d) => `<path d="${d}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;

// ---------- the twelve robots (80 x 80, standing on y = 75) ----------
// Each returns [svg, air]: air = true when it's off the ground (floats more).

const DESIGNS = [
  // 1. waving hello
  (m) => [
    treads(20, 64, 40) +
    limb('M27 52Q19 56 17 63') + hand(17, 63) +
    torso(24, 45, 32, 20) +
    head({ x: 20, y: 18, w: 40, h: 28, rot: -7, look: 'round', top: 'mast' }, m) +
    limb('M53 50Q61 46 64 35') + hand(64, 33, 4.4) +
    lines('M70 24q4 4 3 10M74 21q5 6 3 14'),
  ],
  // 2. flexing
  (m) => [
    limb('M34 63v8') + limb('M46 63v8') + foot(33, 72) + foot(47, 72) +
    limb('M25 50H12V37') + hand(12, 35, 4.6) +
    limb('M55 50H68V37') + hand(68, 35, 4.6) +
    `<circle cx="13" cy="49" r="3.3" fill="${GREY}" stroke="${INK}" stroke-width="2.4"/><circle cx="67" cy="49" r="3.3" fill="${GREY}" stroke="${INK}" stroke-width="2.4"/>` +
    torso(22, 43, 36, 22, 6) +
    head({ x: 22, y: 16, w: 36, h: 27, look: 'fierce', top: 'bolt' }, m),
  ],
  // 3. mid-jump
  (m) => [
    limb('M34 59Q28 64 33 69') + limb('M46 59Q52 64 47 69') +
    limb('M29 45L16 28') + hand(15, 26) + limb('M51 45L64 28') + hand(65, 26) +
    torso(27, 41, 26, 19) +
    head({ x: 23, y: 15, w: 34, h: 26, look: 'wide', top: 'twin' }, m) +
    lines('M30 73l-3 4M40 74v4M50 73l3 4'),
    true,
  ],
  // 4. sprinting
  (m) => [
    lines('M3 30h10M1 40h13M4 50h9') +
    `<g transform="rotate(12 40 62)">` +
    limb('M37 62L28 69L22 67') + limb('M45 62L52 70H59') +
    limb('M30 49L20 57') + hand(20, 57) +
    torso(28, 43, 24, 20) +
    head({ x: 23, y: 17, w: 35, h: 26, look: 'fierce', top: 'ears' }, m) +
    limb('M50 48L61 41') + hand(62, 40) +
    `</g>`,
  ],
  // 5. balancing on a unicycle
  (m) => [
    wheel(40, 66, 8.5) +
    `<g transform="rotate(-9 40 66)">` +
    limb('M40 57V66', 3.5) +
    limb('M33 41L16 37') + hand(14, 37) + limb('M47 41L64 45') + hand(66, 45) +
    torso(31, 35, 18, 23) +
    head({ x: 26, y: 10, w: 28, h: 25, look: 'cyclops', top: 'mast' }, m) +
    `</g>`,
  ],
  // 6. hovering drone
  (m) => [
    limb('M24 49Q17 54 19 61') + hand(19, 62) + limb('M56 49Q63 54 61 61') + hand(61, 62) +
    `<path d="M33 58h14l-3 6h-8z" fill="${INK}"/><path d="M36 64h8l-4 6z" fill="${RED}" fill-opacity=".85"/>` +
    head({ x: 19, y: 25, w: 42, h: 34, look: 'round', top: 'prop' }, m) +
    lines('M28 74h6M46 74h6'),
    true,
  ],
  // 7. FRC bot lifting a hexagon game piece
  (m) => [
    `<rect x="14" y="59" width="52" height="12" rx="4" fill="currentColor" ${OUT}/><rect x="17" y="62.5" width="46" height="4" rx="2" fill="#fff" fill-opacity=".35"/>` +
    wheel(23, 72, 4) + wheel(57, 72, 4) +
    limb('M28 46L21 25') + limb('M52 46L59 25') +
    head({ x: 24, y: 34, w: 32, h: 25, look: 'square', top: 'none' }, m) +
    `<path d="M40 2l11 6.4v12.8L40 27.6l-11-6.4V8.4z" fill="#fff" ${OUT}/><circle cx="40" cy="14.8" r="6.2" fill="${RED}" stroke="${INK}" stroke-width="2.4"/>` +
    `<path d="M17 24q4-5 8 0M55 24q4-5 8 0" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M17 24q4-5 8 0M55 24q4-5 8 0" stroke="${GREY}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  ],
  // 8. panther cub, ready to pounce
  (m) => [
    `<path d="M20 55Q6 48 9 34Q11 28 16 30" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M20 55Q6 48 9 34Q11 28 16 30" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>` +
    limb('M24 63L19 71') + limb('M32 64L30 72') + foot(19, 72, 9) + foot(30, 72, 9) +
    `<g transform="rotate(-8 38 58)">` + torso(17, 49, 40, 17, 7) + `</g>` +
    limb('M52 63L63 69') + hand(66, 70, 4.2) +
    head({ x: 38, y: 26, w: 35, h: 26, rot: 9, look: 'fierce', top: 'ears' }, m),
  ],
  // 9. thinking it over (or plotting)
  (m) => [
    limb('M36 63L34 71') + limb('M44 63L46 71') + foot(33, 72) + foot(47, 72) +
    limb('M30 50L21 55L28 60') +
    torso(28, 44, 24, 20) +
    head({ x: 21, y: 17, w: 36, h: 27, rot: -9, look: 'side', top: 'mast' }, m) +
    limb('M50 50Q60 49 55 42') + hand(53, 41) +
    `<circle cx="64" cy="20" r="2" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="69" cy="13" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="74.5" cy="5" r="4" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
  ],
  // 10. dancing
  (m) => [
    `<path d="M10 16v-9l6-1.5v9" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="8.2" cy="16.4" r="2.3" fill="${INK}"/><circle cx="14.2" cy="14.9" r="2.3" fill="${INK}"/>` +
    `<g transform="rotate(-10 40 70)">` +
    limb('M38 63V72') + foot(38, 73) + limb('M44 61L56 66') + hand(58, 67, 3.4) +
    limb('M30 49L20 57') + hand(19, 58) +
    torso(28, 43, 24, 20) +
    head({ x: 23, y: 17, w: 34, h: 26, rot: -6, look: 'happy', top: 'twin' }, m) +
    limb('M50 47L61 32') + hand(62, 30) +
    `</g>`,
  ],
  // 11. popping a wheelie
  (m) => [
    `<circle cx="10" cy="70" r="3" fill="${GREY}" stroke="${INK}" stroke-width="2"/><circle cx="16" cy="66" r="2.2" fill="${GREY}" stroke="${INK}" stroke-width="2"/>` +
    `<g transform="rotate(-15 30 66)">` +
    wheel(29, 66, 9) + wheel(54, 66, 7) +
    torso(21, 48, 38, 15, 5) +
    limb('M28 50L22 33') + hand(21, 31) + limb('M52 50L58 33') + hand(59, 31) +
    head({ x: 24, y: 23, w: 32, h: 25, look: 'wide', top: 'bolt' }, m) +
    `</g>`,
  ],
  // 12. carrying the team flag
  (m) => [
    limb('M58 66V6', 2.8) +
    `<path d="M59 7Q68 4 76 10Q69 14 71 20Q64 17 59 21z" fill="${RED}" ${OUT}/><path d="M66 9.5l3 1.7v3.4l-3 1.7l-3-1.7v-3.4z" fill="#fff"/>` +
    limb('M36 63L33 71') + limb('M44 63L48 70') + foot(32, 72) + foot(49, 71) +
    limb('M30 50L21 44') + hand(20, 43) +
    torso(28, 44, 24, 20) +
    head({ x: 21, y: 18, w: 34, h: 26, rot: -5, look: 'round', top: 'ears' }, m) +
    limb('M50 50L57 47') + hand(58, 46),
  ],
];

// The room hands out colors in this order, so the first 12 players get 12 different robots.
const COLOR_ORDER = ['#ff4d6d', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b', '#22d3ee', '#f783ac', '#a9e34b', '#9775fa', '#20c997', '#ffa8a8'];

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Which of the 12 robots this player is. */
export function design(player) {
  const slot = COLOR_ORDER.indexOf(String(player?.color).toLowerCase());
  return slot >= 0 ? slot : hash(player?.id ?? player?.name ?? '') % DESIGNS.length;
}

export function avatar(player, { mood, pose } = {}) {
  const h = hash(player?.id ?? player?.name ?? '');
  const color = /^#[0-9a-f]{3,8}$/i.test(player?.color ?? '') ? player.color : GREY;
  const [body, air] = DESIGNS[pose ?? design(player)](mood ?? (player?.connected === false ? 'sleep' : undefined));
  return raw(
    `<svg class="bot${air ? ' bot-air' : ''}" viewBox="0 0 80 80" style="color:${color};--bob:${(h % 9) / 10}s" aria-hidden="true">` +
    `<ellipse cx="40" cy="76" rx="${air ? 13 : 22}" ry="2.8" fill="#000" fill-opacity="${air ? 0.2 : 0.35}"/>` +
    `<g class="bot-body">${body}</g></svg>`,
  );
}
