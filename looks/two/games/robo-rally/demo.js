// Little looping animations that explain a card, an upgrade or a rule without words.
// A demo is a tiny board, some robots and a list of steps; mountDemo() plays it on a canvas, forever.
//   mountDemo(canvas, 'crab-legs', '#ff4d6d')
import { DX, DY, turn } from './board.js';
import { drawCourse } from './minimap.js';
import { HAYWIRE } from './cards.js';

const LETTER = { N: 0, E: 1, S: 2, W: 3 };
const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };
const OTHER = ['#4dabf7', '#ffd43b', '#51cf66'];
const STEP_MS = 650;

// ---------- the demos ----------
// bots: { id: [x, y, 'dir'] }, a is "you" (your color). grid rows use the board codes (.. XX EE g> b^ G+ G-).
// Steps: ['move', id, dir, n]  dir: F B L R (relative) or N E S W
//        ['turn', id, q]  ['face', id, dir]  ['card', id, glyph]  ['pop', id, text]
//        ['shoot', id, { dirs: 'F'|'FB'|'all', through, color }]  ['zap', x, y, dir]  ['hit', id]
//        ['shield', id]  ['fall', id]  ['tp', id, x, y]  ['swap', a, b]  ['off', id]  ['on', id]
//        ['belts']  ['gears']  ['wait', ms]  [[step], [step]] runs steps together
const D = {
  'lobby-program': { size: [5, 4], bots: { a: [0, 3, 'N'] }, steps: [['card', 'a', '↑'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2], ['card', 'a', '↺'], ['turn', 'a', -1], ['card', 'a', '↑'], ['move', 'a', 'F', 1]] },
  'lobby-flags': { size: [5, 3], flags: [[1, 2], [3, 2], [3, 0]], bots: { a: [0, 2, 'E'] }, steps: [['move', 'a', 'F', 1], ['pop', 'a', '⚑ 1 ✓'], ['move', 'a', 'F', 2], ['pop', 'a', '⚑ 2 ✓'], ['turn', 'a', -1], ['move', 'a', 'F', 2], ['pop', 'a', '⚑ 3 🏆']] },
  // ----- permanent upgrades -----
  'brakes': { bots: { a: [1, 1, 'E'] }, steps: [['card', 'a', '⬆'], ['pop', 'a', '🛑'], ['wait', 500]] },
  'chaos-theory': { bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '⚠️'], ['pop', 'a', '⚡+1'], ['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2]] },
  'crab-legs': { bots: { a: [1, 2, 'N'] }, steps: [['card', 'a', '↻+⬆'], ['move', 'a', 'R', 1], ['card', 'a', '↺+⬆'], ['move', 'a', 'L', 1]] },
  'deflector-shield': { bots: { a: [3, 1, 'W'], b: [0, 1, 'E'] }, steps: [[['shoot', 'b', {}], ['shield', 'a']], ['pop', 'a', '⚡-1']] },
  'double-barrel': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['shoot', 'a', { color: '#ff7b2e', thick: 2 }], ['pop', 'b', '⚠️⚠️']] },
  'drifting': { bots: { a: [2, 2, 'N'] }, steps: [['card', 'a', '↺'], ['turn', 'a', -1], ['move', 'a', 'F', 1]] },
  'energy-conversion': { size: [5, 3], lasers: [[4, 1, 'W', 1]], bots: { a: [2, 1, 'N'] }, steps: [['zap', 4, 1, 'W'], ['move', 'a', 'F', 1]] },
  'firewall': { grid: ['.. .. .. .. ..', '.. .. XX .. ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'E'] }, steps: [['move', 'a', 'F', 2], ['wait', 500], ['tp', 'a', 4, 2], ['pop', 'a', '0 ⚠️']] },
  'flash-drive': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '🂠 9→10'], ['wait', 700]] },
  'hover-unit': { grid: ['.. .. .. .. ..', '.. .. XX .. ..', '.. .. .. .. ..'], bots: { a: [1, 1, 'E'] }, steps: [['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2], ['wait', 300]] },
  'laser-kata': { bots: { a: [2, 1, 'E'], b: [2, 0, 'S'], c: [0, 1, 'E'] }, steps: [['card', 'a', '⟲'], ['turn', 'a', 2], ['shoot', 'a', { dirs: 'all' }]] },
  'memory-cards': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '🂠🂠 → 🗂️'], ['wait', 300], ['pop', 'a', '🗂️ → ✋']] },
  'mini-howitzer': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['pop', 'a', '⚡-1'], ['shoot', 'a', { color: '#ff9a2e', thick: 3 }], [['pop', 'b', '⚠️⚠️'], ['move', 'b', 'E', 1]]] },
  'modular-chassis': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], [['pop', 'a', '🔧⇄'], ['pop', 'b', '⇄🔧']]] },
  'power-slide': { bots: { a: [2, 2, 'N'] }, steps: [['card', 'a', '↻'], ['turn', 'a', 1], ['move', 'a', 'F', 1]] },
  'pressor-beam': { bots: { a: [0, 1, 'E'], b: [2, 1, 'W'] }, steps: [['shoot', 'a', { color: '#7cc7ff', thick: 2 }], ['move', 'b', 'E', 1]] },
  'rail-gun': { walls: ['1,1:E'], bots: { a: [0, 1, 'E'], b: [2, 1, 'N'], c: [4, 1, 'N'] }, steps: [['shoot', 'a', { through: true }], [['hit', 'b'], ['hit', 'c']]] },
  'ramming-gear': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], ['hit', 'b']] },
  'rear-laser': { bots: { a: [2, 1, 'E'], b: [4, 1, 'N'], c: [0, 1, 'N'] }, steps: [['shoot', 'a', { dirs: 'FB' }]] },
  'scrambler': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['shoot', 'a', { color: '#d57bff', thick: 2 }], ['pop', 'b', '🂠 ⇄ 🂠']] },
  'self-diagnostics': { flags: [[3, 1]], bots: { a: [1, 1, 'E'] }, steps: [['move', 'a', 'F', 2], ['pop', 'a', '🏁'], ['pop', 'a', '⚠️ 🗑️']] },
  'spam-filter': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '🂠 👁'], ['wait', 500]] },
  'spiky': { bots: { a: [3, 1, 'W'], b: [1, 1, 'E'] }, steps: [['move', 'b', 'F', 1], ['hit', 'b']] },
  'tractor-beam': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['shoot', 'a', { color: '#7cc7ff', thick: 2 }], ['move', 'b', 'W', 1]] },
  // ----- one-use upgrades -----
  'abort-switch': { bots: { a: [2, 2, 'N'] }, steps: [['card', 'a', '⬆⬆⬆'], ['pop', 'a', '⏏️'], ['card', 'a', '↻'], ['turn', 'a', 1]] },
  'all-aboard': { grid: ['.. .. .. .. ..', 'b> b> b> g> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'] }, steps: [['pop', 'a', '🚂'], ['belts'], ['belts'], ['belts']] },
  'boink': { bots: { a: [2, 1, 'N'] }, steps: [['move', 'a', 'L', 1], ['move', 'a', 'R', 1]] },
  'calibration-protocol': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '⚠️⚠️ → 🂠🂠'], ['wait', 600]] },
  'displacing-blast': { reboot: [4, 2, 'N'], bots: { a: [0, 0, 'E'], b: [3, 0, 'W'] }, steps: [['shoot', 'a', { color: '#9ff7ff', thick: 2 }], ['tp', 'b', 4, 2]] },
  'lucky-booster': { bots: { a: [1, 2, 'N'] }, steps: [['card', 'a', '⬆'], ['pop', 'a', '🍀'], ['card', 'a', '⬆↻⬆'], ['move', 'a', 'F', 1], ['turn', 'a', 1], ['move', 'a', 'F', 1]] },
  'magnetic': { bots: { a: [1, 1, 'E'], b: [1, 2, 'E'] }, steps: [['card', 'b', '⬆⬆'], [['move', 'b', 'F', 2], ['move', 'a', 'E', 2]]] },
  'memory-swap': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '+🂠🂠🂠'], ['pop', 'a', '🂠🂠🂠 ⤒']] },
  'overclocked': { bots: { a: [0, 1, 'E'] }, steps: [['pop', 'a', '🚀'], ['move', 'a', 'F', 2]] },
  'piercing-drill': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], [['hit', 'b'], ['turn', 'b', 2]]] },
  'pressure-release': { bots: { a: [4, 1, 'E'], b: [0, 1, 'N'] }, steps: [['move', 'a', 'B', 3], ['wait', 300]] },
  're-initialize': { bots: { a: [1, 1, 'N'], b: [3, 1, 'N'] }, steps: [['pop', 'a', '🥇'], ['pop', 'b', '🥇']] },
  'recharge': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '⚡+3'], ['wait', 400]] },
  'rewire': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '⚡🂠 → ✋'], ['wait', 500]] },
  'switch': { bots: { a: [1, 1, 'E'], b: [2, 1, 'S'] }, steps: [['swap', 'a', 'b'], ['wait', 300], ['swap', 'a', 'b']] },
  'zoop': { bots: { a: [2, 1, 'N'] }, steps: [['turn', 'a', 1], ['turn', 'a', 2], ['turn', 'a', 1]] },

  // ----- rules -----
  spam: { bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '⚠️'], ['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2]] },
  reboot: { grid: ['.. .. .. .. ..', '.. .. XX .. ..', '.. .. .. .. ..'], reboot: [4, 0, 'S'], bots: { a: [0, 1, 'E'] }, steps: [['move', 'a', 'F', 2], ['wait', 500], [['tp', 'a', 4, 0], ['pop', 'a', '⚠️⚠️']]] },
  shutdown: { lasers: [[4, 1, 'W', 1]], bots: { a: [2, 1, 'E'] }, steps: [['off', 'a'], ['pop', 'a', '⚠️⚠️⚠️ ✖'], ['zap', 4, 1, 'W'], ['on', 'a']] },
  upgrades: { grid: ['.. .. .. .. ..', '.. EE .. .. ..', '.. .. .. .. ..'], bots: { a: [1, 1, 'E'] }, steps: [['pop', 'a', '⚡+1'], ['pop', 'a', '⚡ → 🛡️']] },
  'safe-edges': { size: [4, 3], bots: { a: [1, 1, 'E'] }, steps: [['move', 'a', 'F', 3], ['wait', 300]] },
  'less-spam': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '✋⚠️⚠️'], ['pop', 'a', '⚠️ ↘ 🗑️']] },
  program: { bots: { a: [0, 2, 'N'] }, steps: [['card', 'a', '⬆'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1], ['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2]] },
  belts: { grid: ['.. .. .. .. ..', 'b> b> b> g> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'] }, steps: [['belts'], ['belts'], ['belts']] },
};

// Haywire demos: the card's own moves, from a spot where they make sense.
const HW_SETUP = {
  h01: { size: [5, 4], bots: { a: [1, 3, 'N'] } },
  h02: { size: [5, 3], bots: { a: [1, 1, 'N'] } },
  h03: { size: [6, 3], bots: { a: [0, 1, 'E'] } },
  h04: { size: [7, 3], walls: ['3,1:E'], bots: { a: [0, 1, 'E'] } },
  h05: { bots: { a: [2, 1, 'N'] } },
  h06: { size: [5, 4], bots: { a: [3, 3, 'N'] } },
  h07: { bots: { a: [3, 1, 'E'] } },
  h08: { size: [6, 3], bots: { a: [4, 1, 'E'] } },
  h09: { bots: { a: [2, 1, 'E'], b: [2, 0, 'S'], c: [0, 1, 'E'] } },
  h10: { size: [5, 4], bots: { a: [1, 3, 'N'] } },
  h11: { bots: { a: [1, 1, 'N'] } },
  h12: { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] } },
  h13: { bots: { a: [2, 1, 'N'] } },
  h14: { bots: { a: [2, 1, 'N'], b: [1, 1, 'E'], c: [3, 1, 'W'] } },
  h15: { size: [5, 4], bots: { a: [2, 3, 'N'] } },
  h16: { size: [5, 4], bots: { a: [1, 3, 'N'] } },
  h17: { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] } },
};
for (const [t, hw] of Object.entries(HAYWIRE)) {
  const steps = [];
  for (const [k, a, b, flag] of hw.ops) {
    if (k === 'mv') {
      steps.push(['move', 'a', a === 'side' ? 'R' : ['F', 'R', 'B', 'L'][a], b]);
      if (flag === 'wallhurt') steps.push(['hit', 'a']);
    } else if (k === 'rt') steps.push(['turn', 'a', a]);
    else if (k === 'spin') steps.push(['pop', 'a', '🌀'], ['turn', 'a', 1]);
    else if (k === 'en') steps.push(['pop', 'a', `⚡+${a}`]);
    else if (k === 'dmg') steps.push(['hit', 'a']);
    else if (k === 'storm') steps.push(['shoot', 'a', { dirs: 'all' }]);
    else if (k === 'overcharge') steps.push(['shoot', 'a', { color: '#ff7b2e', thick: 3 }], ['pop', 'b', '⚠️⚠️⚠️']);
    else if (k === 'swap') steps.push(['shoot', 'a', { color: '#9ff7ff' }], ['swap', 'a', 'b']);
    else if (k === 'emp') steps.push(['pop', 'a', '💥'], [['hit', 'b'], ['hit', 'c']]);
    else if (k === 'install') steps.push(['pop', 'a', '🔧 +🛡️']);
    else if (k === 'double') steps.push(['pop', 'a', '🂠🂠'], ['card', 'a', '⬆'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1]);
  }
  D[t] = { ...HW_SETUP[t], steps };
}

export const hasDemo = (key) => !!D[key];
export const compileDemo = (key) => compile(D[key], key === 'safe-edges');

// ---------- building and playing ----------

function miniCourse(def) {
  const [w, h] = def.size ?? (def.grid ? [def.grid[0].trim().split(/\s+/).length, def.grid.length] : [5, 3]);
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = def.grid?.[y]?.trim().split(/\s+/) ?? [];
    for (let x = 0; x < w; x++) {
      const code = row[x] ?? '..';
      const cell = { k: 'floor', walls: 0, b: 0 };
      if (code === 'XX') cell.k = 'pit';
      else if (code === 'EE') cell.k = 'battery';
      else if (code === 'G+' || code === 'G-') Object.assign(cell, { k: 'gear', spin: code === 'G+' ? 1 : -1 });
      else if (code[0] === 'g' || code[0] === 'b') Object.assign(cell, { k: 'belt', fast: code[0] === 'b', d: ARROW[code[1]] });
      cells.push(cell);
    }
  }
  for (const spec of def.walls ?? []) {
    const [pos, sides] = spec.split(':');
    const [x, y] = pos.split(',').map(Number);
    for (const ch of sides) cells[y * w + x].walls |= 1 << LETTER[ch];
  }
  const lasers = (def.lasers ?? []).map(([x, y, d, n]) => ({ x, y, d: LETTER[d], n }));
  for (const l of lasers) cells[l.y * w + l.x].walls |= 1 << turn(l.d, 2);
  const reboot = def.reboot ? { x: def.reboot[0], y: def.reboot[1], d: LETTER[def.reboot[2]] } : null;
  return {
    w, h, cells, lasers, pushers: [],
    checkpoints: (def.flags ?? []).map(([x, y], i) => ({ x, y, n: i + 1 })),
    boards: [{ dock: false, reboot }],
    tokens: new Map(),
  };
}

const at = (c, x, y) => (x >= 0 && y >= 0 && x < c.w && y < c.h ? c.cells[y * c.w + x] : null);
const wall = (c, x, y, d) => {
  const a = at(c, x, y);
  if (a && a.walls & (1 << d)) return true;
  const b = at(c, x + DX[d], y + DY[d]);
  return !!(b && b.walls & (1 << turn(d, 2)));
};
const dirOf = (bot, dir) => (dir in LETTER ? LETTER[dir] : turn(bot.d, { F: 0, R: 1, B: 2, L: 3 }[dir]));
const clone = (bots) => Object.fromEntries(Object.entries(bots).map(([k, b]) => [k, { ...b }]));

/** Turn a demo into keyframes: [{ bots, fx: [...], ms }]. bots[id] = { x, y, d, a (angle), vis, scale, alpha } */
function compile(def, safeEdges) {
  const c = miniCourse(def);
  let bots = {};
  for (const [id, [x, y, d]] of Object.entries(def.bots ?? {})) bots[id] = { x, y, d: LETTER[d], a: LETTER[d] * 90, vis: true, scale: 1, alpha: 1 };
  const frames = [{ bots: clone(bots), fx: [], ms: 500 }];
  const occupant = (x, y, not) => Object.entries(bots).find(([k, b]) => k !== not && b.vis && b.x === x && b.y === y)?.[0];
  for (const raw of def.steps) {
    const group = Array.isArray(raw[0]) ? raw : [raw];
    const fx = [];
    let ms = STEP_MS;
    for (const st of group) {
      const [k, id, p, q] = st;
      const b = bots[id];
      switch (k) {
        case 'move': {
          const d = dirOf(b, p);
          for (let i = 0; i < q && b.vis; i++) {
            if (wall(c, b.x, b.y, d)) break;
            const chain = [];
            let cx = b.x + DX[d];
            let cy = b.y + DY[d];
            let o;
            while ((o = occupant(cx, cy, id))) {
              chain.push(o);
              cx += DX[d];
              cy += DY[d];
            }
            if (def === D['pressure-release'] && chain.length) break; // Pressure Release stops before a robot
            const last = chain.length ? bots[chain.at(-1)] : b;
            if (wall(c, last.x, last.y, d)) break;
            if (safeEdges && !at(c, last.x + DX[d], last.y + DY[d])) {
              fx.push({ k: 'bump', id });
              break;
            }
            for (const m of [...chain.reverse().map((x) => bots[x]), b]) {
              m.x += DX[d];
              m.y += DY[d];
              const cell = at(c, m.x, m.y);
              if (!cell || (cell.k === 'pit' && !(def === D['hover-unit'] && m === b && i < q - 1))) {
                m.vis = false;
                fx.push({ k: 'fall', id: Object.keys(bots).find((x) => bots[x] === m) });
              }
            }
          }
          ms = Math.max(ms, 300 + q * 260);
          break;
        }
        case 'turn':
          b.d = turn(b.d, p);
          b.a += p * 90;
          break;
        case 'face': {
          const d = LETTER[p];
          let diff = ((d - b.d + 4) % 4);
          if (diff === 3) diff = -1;
          b.d = d;
          b.a += diff * 90;
          break;
        }
        case 'card':
          fx.push({ k: 'card', id, text: p });
          ms = Math.max(ms, 700);
          break;
        case 'pop':
          fx.push({ k: 'pop', id, text: p });
          ms = Math.max(ms, 900);
          break;
        case 'hit':
          fx.push({ k: 'burst', id }, { k: 'pop', id, text: '⚠️' });
          break;
        case 'shield':
          fx.push({ k: 'shield', id });
          break;
        case 'shoot': {
          const o = p ?? {};
          const dirs = o.dirs === 'all' ? [0, 1, 2, 3] : o.dirs === 'FB' ? [0, 2] : [0];
          for (const r of dirs) {
            const d = turn(b.d, r);
            let x = b.x;
            let y = b.y;
            const hits = [];
            for (let i = 0; i < 12; i++) {
              if (!o.through && wall(c, x, y, d)) break;
              if (!at(c, x + DX[d], y + DY[d])) break;
              x += DX[d];
              y += DY[d];
              const hit = occupant(x, y, id);
              if (hit) {
                hits.push(hit);
                if (!o.through) break;
              }
            }
            fx.push({ k: 'beam', x0: b.x, y0: b.y, x1: x + (hits.length && !o.through ? 0 : DX[d] * 0.45), y1: y + (hits.length && !o.through ? 0 : DY[d] * 0.45), color: o.color ?? '#ff3b30', thick: o.thick ?? 1 });
            for (const h of hits) fx.push({ k: 'burst', id: h });
          }
          break;
        }
        case 'zap': {
          const d = LETTER[q];
          let x = id;
          let y = p;
          let hit = occupant(x, y);
          while (!hit && at(c, x + DX[d], y + DY[d]) && !wall(c, x, y, d)) {
            x += DX[d];
            y += DY[d];
            hit = occupant(x, y);
          }
          fx.push({ k: 'beam', x0: id - DX[d] * 0.45, y0: p - DY[d] * 0.45, x1: x, y1: y, color: '#ff3b30', thick: 1 });
          if (hit) fx.push({ k: 'burst', id: hit }, { k: 'pop', id: hit, text: '⚠️' });
          break;
        }
        case 'fall':
          b.vis = false;
          fx.push({ k: 'fall', id });
          ms = 800;
          break;
        case 'tp':
          Object.assign(b, { x: p, y: q, vis: true, scale: 1, alpha: 1 });
          fx.push({ k: 'appear', id });
          break;
        case 'swap': {
          const o = bots[p];
          [b.x, o.x] = [o.x, b.x];
          [b.y, o.y] = [o.y, b.y];
          break;
        }
        case 'off':
          b.alpha = 0.35;
          break;
        case 'on':
          b.alpha = 1;
          break;
        case 'belts': {
          for (const m of Object.values(bots)) {
            const cell = at(c, m.x, m.y);
            if (cell?.k !== 'belt') continue;
            const nx = m.x + DX[cell.d];
            const ny = m.y + DY[cell.d];
            if (!at(c, nx, ny) || occupant(nx, ny)) continue;
            m.x = nx;
            m.y = ny;
            const to = at(c, nx, ny);
            if (to?.k === 'belt' && to.d !== cell.d) {
              const q2 = turn(to.d - cell.d, 0) === 1 ? 1 : -1;
              m.d = turn(m.d, q2);
              m.a += q2 * 90;
            }
          }
          break;
        }
        case 'gears':
          for (const m of Object.values(bots)) {
            const cell = at(c, m.x, m.y);
            if (cell?.k === 'gear') {
              m.d = turn(m.d, cell.spin);
              m.a += cell.spin * 90;
            }
          }
          break;
        case 'wait':
          ms = id;
          break;
      }
    }
    frames.push({ bots: clone(bots), fx, ms });
  }
  frames.push({ bots: clone(bots), fx: [], ms: 900 }); // a pause before it starts over
  return { c, frames, total: frames.reduce((s, f) => s + f.ms, 0) };
}

// ---------- drawing ----------

const live = new Set();
let raf = 0;

/** Play a demo on a canvas until the canvas leaves the page. Returns a stop function. */
export function mountDemo(canvas, key, color = '#ff4d6d', opts = {}) {
  const def = D[key];
  if (!def) return () => {};
  const demo = { canvas, color, comp: compile(def, key === 'safe-edges' || opts.safeEdges), t0: performance.now(), board: null };
  live.add(demo);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => live.delete(demo);
}

function tick(now) {
  raf = 0;
  for (const demo of live) {
    if (!demo.canvas.isConnected) {
      live.delete(demo);
      continue;
    }
    if (demo.canvas.offsetParent !== null) draw(demo, matchMedia('(prefers-reduced-motion: reduce)').matches ? demo.t0 + 1000 : now);
  }
  if (live.size) raf = requestAnimationFrame(tick);
}

function draw(demo, now) {
  const { canvas, comp } = demo;
  const { c } = comp;
  const cssW = canvas.clientWidth || 120;
  const cssH = canvas.clientHeight || 72;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(cssW * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    demo.board = null;
  }
  const T = Math.min(cssW / c.w, cssH / c.h);
  const ox = (cssW - T * c.w) / 2;
  const oy = (cssH - T * c.h) / 2;
  const g = canvas.getContext('2d');
  // the board doesn't move: draw it once
  if (!demo.board) {
    demo.board = document.createElement('canvas');
    demo.board.width = canvas.width;
    demo.board.height = canvas.height;
    const bg = demo.board.getContext('2d');
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCourse(bg, c, { tile: T, ox, oy });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(demo.board, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  // where are we in the loop?
  let t = (now - demo.t0) % comp.total;
  let i = 0;
  while (i < comp.frames.length - 1 && t >= comp.frames[i].ms) {
    t -= comp.frames[i].ms;
    i++;
  }
  const from = comp.frames[i];
  const to = comp.frames[Math.min(i + 1, comp.frames.length - 1)];
  const k = Math.min(1, t / from.ms);
  const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const px = (x) => ox + (x + 0.5) * T;
  const py = (y) => oy + (y + 0.5) * T;
  const names = Object.keys(to.bots);
  const pos = {};
  names.forEach((id, n) => {
    const a = from.bots[id];
    const b = to.bots[id];
    let x = a.x + (b.x - a.x) * ease;
    let y = a.y + (b.y - a.y) * ease;
    let scale = 1;
    let alpha = a.alpha + (b.alpha - a.alpha) * ease;
    let vis = a.vis;
    const falling = to.fx.some((f) => f.k === 'fall' && f.id === id);
    const appearing = to.fx.some((f) => f.k === 'appear' && f.id === id);
    if (falling) scale = 1 - ease * 0.85;
    if (appearing) {
      vis = true;
      x = b.x;
      y = b.y;
      scale = ease;
    }
    if (!vis && !falling) return;
    const bump = to.fx.some((f) => f.k === 'bump' && f.id === id) ? Math.sin(k * Math.PI) * 0.12 : 0;
    const ang = ((a.a + (b.a - a.a) * ease) * Math.PI) / 180;
    pos[id] = { x: px(x), y: py(y) };
    bot(g, px(x) + Math.sin(ang) * bump * T, py(y) - Math.cos(ang) * bump * T, ang, n === 0 ? demo.color : OTHER[(n - 1) % OTHER.length], T * 0.36 * scale, alpha);
  });

  // effects of the step being played
  for (const f of to.fx) {
    const p = pos[f.id];
    if (f.k === 'beam') {
      g.globalAlpha = 1 - k * 0.8;
      g.strokeStyle = f.color;
      g.lineWidth = T * 0.07 * f.thick;
      g.shadowColor = f.color;
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(px(f.x0), py(f.y0));
      g.lineTo(px(f.x1), py(f.y1));
      g.stroke();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    } else if (f.k === 'burst' && p) {
      g.strokeStyle = '#ffb347';
      g.lineWidth = 2;
      for (let r = 0; r < 8; r++) {
        const an = (r / 8) * Math.PI * 2;
        const r0 = T * (0.2 + k * 0.3);
        g.globalAlpha = 1 - k;
        g.beginPath();
        g.moveTo(p.x + Math.cos(an) * r0, p.y + Math.sin(an) * r0);
        g.lineTo(p.x + Math.cos(an) * (r0 + T * 0.18), p.y + Math.sin(an) * (r0 + T * 0.18));
        g.stroke();
      }
      g.globalAlpha = 1;
    } else if (f.k === 'shield' && p) {
      g.strokeStyle = '#7cc7ff';
      g.lineWidth = 3;
      g.globalAlpha = 1 - k * 0.5;
      g.beginPath();
      g.arc(p.x, p.y, T * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    } else if ((f.k === 'pop' || f.k === 'card') && p) {
      const rise = f.k === 'pop' ? k * T * 0.35 : 0;
      const sz = Math.max(11, T * 0.42);
      g.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      g.font = `bold ${sz}px system-ui, "Segoe UI Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const yy = p.y - T * 0.62 - rise;
      if (f.k === 'card') {
        const w = Math.max(sz * 1.3, g.measureText(f.text).width + sz * 0.6);
        g.fillStyle = '#f4ecdc';
        g.strokeStyle = '#262531';
        g.lineWidth = 1.5;
        g.beginPath();
        g.roundRect(p.x - w / 2, yy - sz * 0.75, w, sz * 1.5, 4);
        g.fill();
        g.stroke();
      } else {
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,.75)';
        g.strokeText(f.text, p.x, yy);
      }
      g.fillStyle = f.k === 'card' ? '#2f5fa8' : '#fff';
      g.fillText(f.text, p.x, yy);
      g.globalAlpha = 1;
    }
  }
}

function bot(g, x, y, ang, color, R, alpha) {
  if (R <= 0.5) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = color;
  g.strokeStyle = '#262531';
  g.lineWidth = Math.max(1.5, R * 0.18);
  g.beginPath();
  g.moveTo(0, -R * 1.15);
  g.arc(0, 0, R * 0.85, -Math.PI / 2 + 2.2, -Math.PI / 2 - 2.2 + Math.PI * 2, false);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.moveTo(0, -R * 0.95);
  g.lineTo(R * 0.32, -R * 0.35);
  g.lineTo(-R * 0.32, -R * 0.35);
  g.closePath();
  g.fill();
  g.restore();
}
