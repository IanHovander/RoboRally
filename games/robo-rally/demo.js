// Little looping animations that explain a card, an upgrade or a rule without words.
// A demo is a tiny board, some robots and a list of steps; mountDemo() plays it on a canvas, forever.
//   mountDemo(canvas, 'crab-legs', '#ff4d6d')
//   mountDemo(canvas, 'gear', color, { lazy: true })   (animates only while in view; the Book)
// One scheduler plays every demo (and the race replays, through mountAnim): at most 16 animate at once.
import { DX, DY, turn } from './board.js';
import { drawCourse, drawGhostLine, previewProgram } from './minimap.js';
import { drawCard, drawGlyph, drawRobot } from './glyphs.js';
import { HAYWIRE } from './cards.js';

const LETTER = { N: 0, E: 1, S: 2, W: 3 };
const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };
const OTHER = ['#7aa8ff', '#ffd43b', '#5fe3b8'];
const STEP_MS = 650;
const LIGHT = '#f4efe4';
const CORAL = '#ff7a6b';
const VIOLET = '#b99bff';
const ENERGY = '#ffc56e';

// ---------- the demos ----------
// bots: { id: [x, y, 'dir'] }, a is "you" (your color). grid rows use the board codes (.. XX EE g> b^ G+ G-).
// def options: size [w,h] · grid · walls ['x,y:NESW'] · lasers [[x,y,dir,n]] · flags [[x,y]] · reboot [x,y,dir]
//   strip [t ×5]: a five-slot strip along the bottom (a card type, 'hw' face down, or null) · hand: a phone
//   outline at the bottom right (where cards fly) · pushers [[x, y, side, [regs]]]
// Steps: ['move', id, dir, n]  dir: F B L R (relative) or N E S W
//        ['turn', id, q]  ['face', id, dir]  ['card', id, glyph]  ['pop', id, text]
//        ['shoot', id, { dirs: 'F'|'FB'|'all', through, color }]  ['zap', x, y, dir]  ['hit', id]
//        ['shield', id]  ['fall', id]  ['tp', id, x, y]  ['swap', a, b]  ['off', id]  ['on', id]
//        ['belts', 'blue'|'green'|'only:<id>'?]  ['gears']  ['wait', ms]  [[step], [step]] runs steps together
//        the strip: ['lit', i] ['slot', i, t] ['swapcard', i, t] ['lock', i] ['flipslot', i, t] ['newround']
//                   ['dice', [i…], [t…]]
//        ['fly', t, from, to]  t: a card type, 'sp', 'hw', 'up' (an upgrade); from/to: bot:<id> slot:<i> hand deck
//        ['line', id, [t…]] … ['unline']  the light line · ['side', id, 'L'|'R'|'F'] which side is whose
//        ['token', id] the priority "1" · ['reg', n] the register's numeral · ['flag', id] · ['win', id]
//        ['panel', r] push panels of register r · ['spin', id, q?] · ['clock'] · ['ring', id, color?]
const D = {
  'lobby-program': { size: [5, 4], bots: { a: [0, 3, 'N'] }, steps: [['card', 'a', '↑'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2], ['card', 'a', '↺'], ['turn', 'a', -1], ['card', 'a', '↑'], ['move', 'a', 'F', 1]] },
  // ----- permanent upgrades -----
  'brakes': { bots: { a: [1, 1, 'E'] }, steps: [['card', 'a', '↑'], ['pop', 'a', '✖'], ['wait', 500]] },
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
  'memory-cards': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '🂠🂠 → 🔖'], ['wait', 300], ['pop', 'a', '🔖 → ✋']] },
  'mini-howitzer': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['pop', 'a', '⚡-1'], ['shoot', 'a', { color: '#ff9a2e', thick: 3 }], [['pop', 'b', '⚠️⚠️'], ['move', 'b', 'E', 1]]] },
  'modular-chassis': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], [['fly', 'up', 'bot:a', 'bot:b'], ['fly', 'up', 'bot:b', 'bot:a']], ['wait', 300]] },
  'power-slide': { bots: { a: [2, 2, 'N'] }, steps: [['card', 'a', '↻'], ['turn', 'a', 1], ['move', 'a', 'F', 1]] },
  'pressor-beam': { bots: { a: [0, 1, 'E'], b: [2, 1, 'W'] }, steps: [['shoot', 'a', { color: '#7cc7ff', thick: 2 }], ['move', 'b', 'E', 1]] },
  'rail-gun': { walls: ['1,1:E'], bots: { a: [0, 1, 'E'], b: [2, 1, 'N'], c: [4, 1, 'N'] }, steps: [['shoot', 'a', { through: true }], [['hit', 'b'], ['hit', 'c']]] },
  'ramming-gear': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], ['hit', 'b']] },
  'rear-laser': { bots: { a: [2, 1, 'E'], b: [4, 1, 'N'], c: [0, 1, 'N'] }, steps: [['shoot', 'a', { dirs: 'FB' }]] },
  'scrambler': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['shoot', 'a', { color: '#d57bff', thick: 2 }], ['pop', 'b', '🂠 ⇄ 🂠']] },
  'self-diagnostics': { flags: [[3, 1]], bots: { a: [1, 1, 'E'] }, steps: [['move', 'a', 'F', 2], ['pop', 'a', '🏁'], ['pop', 'a', '⚠️ 🗑️']] },
  'spam-filter': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '👁 🂠'], ['wait', 500]] },
  // stopping next to a Spiky robot does nothing; driving into it pushes it, and the one who pushed is hurt
  'spiky': { bots: { a: [3, 1, 'W'], b: [1, 1, 'E'] }, steps: [['card', 'b', '↑'], ['move', 'b', 'F', 1], ['wait', 500], ['card', 'b', '↑'], ['move', 'b', 'F', 1], ['hit', 'b']] },
  'tractor-beam': { bots: { a: [0, 1, 'E'], b: [3, 1, 'W'] }, steps: [['shoot', 'a', { color: '#7cc7ff', thick: 2 }], ['move', 'b', 'W', 1]] },
  // ----- one-use upgrades -----
  'abort-switch': { bots: { a: [2, 2, 'N'] }, steps: [['card', 'a', '⬆⬆⬆'], ['pop', 'a', '⏏'], ['card', 'a', '↻'], ['turn', 'a', 1]] },
  'all-aboard': { grid: ['b> b> b> g> ..', 'b> b> b> g> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'], b: [0, 0, 'N'] }, steps: [['pop', 'a', '◆'], ['belts', 'only:a'], ['belts', 'only:a']] },
  'boink': { bots: { a: [2, 1, 'N'] }, steps: [['move', 'a', 'L', 1], ['move', 'a', 'R', 1]] },
  'calibration-protocol': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '⚠️⚠️ → 🂠🂠'], ['wait', 600]] },
  'displacing-blast': { reboot: [4, 2, 'N'], bots: { a: [0, 0, 'E'], b: [3, 0, 'W'] }, steps: [['shoot', 'a', { color: '#9ff7ff', thick: 2 }], ['tp', 'b', 4, 2]] },
  'lucky-booster': { bots: { a: [1, 2, 'N'] }, steps: [['card', 'a', '⬆'], ['pop', 'a', '🂠🂠'], ['card', 'a', '⬆↻⬆'], ['move', 'a', 'F', 1], ['turn', 'a', 1], ['move', 'a', 'F', 1]] },
  'magnetic': { bots: { a: [1, 1, 'E'], b: [1, 2, 'E'] }, steps: [['card', 'b', '⬆⬆'], [['move', 'b', 'F', 2], ['move', 'a', 'E', 2]]] },
  'memory-swap': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '+🂠🂠🂠'], ['pop', 'a', '🂠🂠🂠 ⤒']] },
  'overclocked': { bots: { a: [0, 1, 'E'] }, steps: [['pop', 'a', '◆'], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2]] },
  'piercing-drill': { bots: { a: [1, 1, 'E'], b: [2, 1, 'N'] }, steps: [['move', 'a', 'F', 1], [['hit', 'b'], ['turn', 'b', 2]]] },
  'pressure-release': { bots: { a: [4, 1, 'E'], b: [0, 1, 'N'] }, steps: [['move', 'a', 'B', 3], ['wait', 300]], stopBeforeRobots: true },
  're-initialize': { bots: { a: [1, 1, 'N'], b: [3, 1, 'N'] }, steps: [['token', 'a'], ['wait', 500], ['token', 'b']] },
  'recharge': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '⚡+3'], ['wait', 400]] },
  'rewire': { strip: [null, null, 'hw', null, null], hand: true, bots: { a: [2, 1, 'N'] }, steps: [['fly', 'hw', 'slot:2', 'hand'], ['newround'], ['slot', 0, 'h01'], ['wait', 500]] },
  'switch': { bots: { a: [1, 1, 'E'], b: [2, 1, 'S'] }, steps: [['swap', 'a', 'b'], ['wait', 300], ['swap', 'a', 'b']] },
  'zoop': { bots: { a: [2, 1, 'N'] }, steps: [['turn', 'a', 1], ['turn', 'a', 2], ['turn', 'a', 1]] },

  // ----- rules -----
  spam: { bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '⚠️'], ['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2]] },
  reboot: { grid: ['.. .. .. .. ..', '.. .. XX .. ..', '.. .. .. .. ..'], reboot: [4, 0, 'S'], bots: { a: [0, 1, 'E'] }, steps: [['move', 'a', 'F', 2], ['wait', 500], [['tp', 'a', 4, 0], ['pop', 'a', '⚠️⚠️']]] },
  shutdown: { lasers: [[4, 1, 'W', 1]], bots: { a: [2, 1, 'E'] }, steps: [['off', 'a'], ['pop', 'a', '⚠️⚠️⚠️ ✖'], ['zap', 4, 1, 'W'], ['on', 'a']] },
  upgrades: { grid: ['.. .. .. .. ..', '.. EE .. .. ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'E'] }, steps: [['move', 'a', 'F', 1], ['pop', 'a', '⚡+1'], ['pop', 'a', '⚡ → ◆']] },
  'safe-edges': { size: [4, 3], bots: { a: [1, 1, 'E'] }, steps: [['move', 'a', 'F', 3], ['wait', 300]], safeEdges: true },
  'less-spam': { bots: { a: [2, 1, 'N'] }, steps: [['pop', 'a', '✋⚠️⚠️'], ['pop', 'a', '⚠️ ↘ 🗑️']] },
  program: { bots: { a: [0, 2, 'N'] }, steps: [['card', 'a', '⬆'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1], ['card', 'a', '⬆⬆'], ['move', 'a', 'F', 2]] },
  belts: { grid: ['.. .. .. .. ..', 'b> b> b> g> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'] }, steps: [['belts'], ['belts'], ['belts']] },

  // ----- the Guide's clips: one natural question each -----
  'goal-flags': { size: [5, 3], flags: [[1, 2], [3, 2], [3, 0]], bots: { a: [0, 2, 'E'] }, steps: [['move', 'a', 'F', 1], ['flag', 'a'], ['move', 'a', 'F', 2], ['flag', 'a'], ['turn', 'a', -1], ['move', 'a', 'F', 2], [['flag', 'a'], ['win', 'a']]] },
  'flag-stop': { size: [5, 3], flags: [[2, 1]], bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '↑↑↑'], ['move', 'a', 'F', 3], ['pop', 'a', '⚑ ✖'], ['card', 'a', '⬇'], ['move', 'a', 'B', 1], ['flag', 'a']] },
  'program-fill': { size: [5, 3], strip: [null, null, null, null, null], bots: { a: [0, 2, 'N'] }, steps: [['slot', 0, 'm1'], ['slot', 1, 'rr'], ['slot', 2, 'm2'], ['slot', 3, 'rl'], ['slot', 4, 'm1'], ['wait', 300], [['lit', 0], ['move', 'a', 'F', 1]], [['lit', 1], ['turn', 'a', 1]], [['lit', 2], ['move', 'a', 'F', 2]], [['lit', 3], ['turn', 'a', -1]], [['lit', 4], ['move', 'a', 'F', 1]]] },
  'line-preview': { size: [5, 4], strip: ['m2', 'rr', 'm2', null, null], bots: { a: [0, 3, 'N'] }, steps: [['line', 'a', ['m2', 'rr', 'm2']], ['wait', 600], [['lit', 0], ['move', 'a', 'F', 2]], [['lit', 1], ['turn', 'a', 1]], [['lit', 2], ['move', 'a', 'F', 2]], ['wait', 400], ['unline']] },
  'line-bumped': { size: [4, 3], bots: { a: [1, 2, 'N'], b: [0, 2, 'E'] }, steps: [['line', 'a', ['m1']], ['wait', 500], [['pop', 'b', '1'], ['pop', 'a', '2']], ['card', 'b', '↑'], ['move', 'b', 'F', 1], ['card', 'a', '↑'], ['move', 'a', 'F', 1], ['wait', 700], ['unline']] },
  clear: { size: [5, 3], strip: ['m1', 'rr', 'm2', null, null], hand: true, bots: { a: [1, 1, 'N'] }, steps: [['wait', 300], [['fly', 'm1', 'slot:0', 'hand'], ['fly', 'rr', 'slot:1', 'hand'], ['fly', 'm2', 'slot:2', 'hand']], ['newround'], ['wait', 300]] },
  timeout: { size: [5, 2], strip: ['m1', 'rr', null, 'm2', null], bots: { a: [1, 1, 'N'] }, steps: [['clock'], ['dice', [2, 4], ['rl', 'm1']], ['wait', 500]] },
  facing: { size: [3, 3], bots: { a: [1, 1, 'N'] }, steps: [['side', 'a', 'F'], ['turn', 'a', 1], ['side', 'a', 'F'], ['turn', 'a', 1], ['side', 'a', 'F']] },
  'turn-own-left': { size: [4, 3], bots: { a: [1, 2, 'N'], b: [2, 0, 'S'] }, steps: [[['card', 'a', '↺'], ['card', 'b', '↺']], [['side', 'a', 'L'], ['side', 'b', 'L']], [['turn', 'a', -1], ['turn', 'b', -1]], [['move', 'a', 'F', 1], ['move', 'b', 'F', 1]], ['wait', 300]] },
  'card-move': { size: [5, 3], bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '↑'], ['move', 'a', 'F', 1], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2]] },
  'card-turn': { size: [3, 3], bots: { a: [1, 1, 'N'] }, steps: [['card', 'a', '↻'], ['turn', 'a', 1], ['card', 'a', '↺'], ['turn', 'a', -1]] },
  'card-bk': { size: [5, 3], bots: { a: [2, 1, 'E'] }, steps: [['card', 'a', '⬇'], ['move', 'a', 'B', 1]] },
  'card-ut': { size: [3, 3], bots: { a: [1, 1, 'N'] }, steps: [['card', 'a', '⟲'], ['turn', 'a', 2]] },
  'card-pu': { size: [3, 3], bots: { a: [1, 1, 'N'] }, steps: [['card', 'a', '⚡'], ['pop', 'a', '⚡+1']] },
  push: { size: [4, 3], bots: { a: [0, 1, 'E'], b: [2, 1, 'N'] }, steps: [['card', 'a', '↑↑↑'], ['move', 'a', 'F', 3], ['wait', 300]] },
  again: { size: [4, 3], strip: ['m1', 'rr', 'ag', null, null], bots: { a: [1, 2, 'N'] }, steps: [[['lit', 0], ['move', 'a', 'F', 1]], [['lit', 1], ['turn', 'a', 1]], [['lit', 2], ['card', 'a', '⟳']], ['turn', 'a', 1]] },
  'again-first': { size: [4, 3], strip: ['ag', null, null, null, null], bots: { a: [1, 2, 'N'] }, steps: [[['lit', 0], ['card', 'a', '⟳']], ['swapcard', 0, 'm2'], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2]] },
  'spam-play': { size: [5, 3], strip: ['sp', null, null, null, null], bots: { a: [0, 1, 'E'] }, steps: [[['lit', 0], ['card', 'a', '⚠️']], ['swapcard', 0, 'm2'], ['card', 'a', '↑↑'], ['move', 'a', 'F', 2]] },
  'damage-spam': { size: [5, 3], hand: true, bots: { a: [3, 1, 'N'], b: [0, 1, 'E'] }, steps: [['shoot', 'b', {}], ['fly', 'sp', 'bot:a', 'hand'], ['wait', 400]] },
  'damage-haywire': { size: [5, 3], strip: ['rr', 'rl', 'm1', 'rr', 'm1'], bots: { a: [1, 1, 'E'], b: [4, 1, 'W'] }, steps: [[['lit', 0], ['turn', 'a', 1]], [['lit', 1], ['turn', 'a', -1]], [['lit', 2], ['move', 'a', 'F', 1]], ['shoot', 'b', {}], ['fly', 'hw', 'bot:a', 'slot:2'], ['wait', 500], ['newround'], [['lit', 2], ['flipslot', 2, 'h01']], ['move', 'a', 'F', 1], ['turn', 'a', 1], ['move', 'a', 'F', 1], ['wait', 300]] },
  'damage-cards': { size: [5, 3], hand: true, bots: { a: [2, 1, 'N'], b: [0, 1, 'E'] }, steps: [['shoot', 'b', {}], ['fly', 'sp', 'bot:a', 'hand'], ['move', 'a', 'F', 1], ['wait', 300], ['turn', 'a', 1], ['shoot', 'b', {}], ['wait', 400]] },
  'order-registers': { grid: ['.. .. .. .. .. ..', 'g> g> g> .. .. ..', '.. .. .. .. .. ..'], bots: { a: [0, 2, 'N'], b: [3, 2, 'N'], c: [5, 2, 'N'] }, steps: [['reg', 1], [['pop', 'a', '1'], ['move', 'a', 'F', 1]], [['pop', 'b', '2'], ['move', 'b', 'F', 1]], [['pop', 'c', '3'], ['move', 'c', 'F', 1]], ['belts'], ['reg', 2], ['move', 'a', 'F', 1], ['move', 'b', 'F', 1], ['move', 'c', 'F', 1]] },
  'order-priority': { size: [5, 3], bots: { a: [0, 2, 'N'], b: [2, 2, 'N'], c: [4, 2, 'N'] }, steps: [['token', 'a'], ['move', 'a', 'F', 1], ['move', 'b', 'F', 1], ['move', 'c', 'F', 1], ['token', 'b'], ['move', 'b', 'F', 1], ['move', 'c', 'F', 1], ['move', 'a', 'F', 1]] },
  'belt-green': { grid: ['.. .. .. .. ..', 'g> g> g> g> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'] }, steps: [[['reg', 1], ['belts', 'green']], [['reg', 2], ['belts', 'green']], [['reg', 3], ['belts', 'green']]] },
  'belt-blue': { grid: ['.. .. .. .. ..', 'b> b> b> b> ..', '.. .. .. .. ..'], bots: { a: [0, 1, 'N'] }, steps: [[['reg', 1], ['belts', 'blue']], [['reg', 2], ['belts', 'blue']]] },
  'belt-curve': { grid: ['.. .. .. ..', '.. g> gv ..', '.. .. gv ..', '.. .. .. ..'], bots: { a: [1, 1, 'N'], b: [3, 1, 'W'] }, steps: [['belts'], ['belts'], ['belts'], ['card', 'b', '↑'], ['move', 'b', 'F', 1], ['wait', 300], ['belts']] },
  gear: { grid: ['.. .. .. .. ..', '.. G+ .. G- ..', '.. .. .. .. ..'], bots: { a: [1, 1, 'N'], b: [3, 1, 'N'] }, steps: [['gears'], ['gears']] },
  pusher: { size: [5, 3], walls: ['2,0:N'], pushers: [[2, 0, 'N', [2, 4]]], bots: { a: [2, 0, 'E'] }, steps: [[['reg', 1], ['panel', 1]], [['reg', 2], ['panel', 2]], ['wait', 300]] },
  edge: { size: [4, 3], reboot: [3, 2, 'N'], bots: { a: [1, 1, 'W'] }, steps: [['card', 'a', '↑↑'], ['move', 'a', 'F', 2], ['wait', 500], [['tp', 'a', 3, 2], ['pop', 'a', '⚠️⚠️']]] },
  wall: { size: [5, 3], walls: ['2,1:E'], lasers: [[4, 1, 'W', 1]], bots: { a: [0, 1, 'E'] }, steps: [['card', 'a', '↑↑↑'], ['move', 'a', 'F', 3], ['zap', 4, 1, 'W']] },
  'wall-laser': { size: [5, 3], walls: ['2,1:E'], lasers: [[4, 1, 'W', 1]], bots: { a: [1, 1, 'N'] }, steps: [['zap', 4, 1, 'W'], ['wait', 300], ['zap', 4, 1, 'W']] },
  'board-laser': { size: [5, 3], lasers: [[4, 1, 'W', 1]], bots: { a: [2, 1, 'N'], b: [0, 1, 'N'] }, steps: [['zap', 4, 1, 'W'], ['wait', 400]] },
  'robot-laser': { size: [5, 3], bots: { a: [0, 1, 'E'], b: [2, 1, 'N'], c: [4, 1, 'N'] }, steps: [['shoot', 'a', {}], ['wait', 400]] },
  battery: { grid: ['.. .. ..', '.. EE ..', '.. .. ..'], bots: { a: [0, 1, 'E'] }, steps: [[['reg', 1], ['move', 'a', 'F', 1]], ['pop', 'a', '⚡+1'], ['reg', 2], ['pop', 'a', '⚡+1']] },
  'reboot-face': { size: [3, 3], reboot: [1, 1, 'N'], bots: { a: [1, 1, 'N'] }, steps: [['off', 'a'], ['face', 'a', 'E'], ['wait', 400], ['face', 'a', 'S'], ['wait', 400], ['on', 'a'], ['move', 'a', 'F', 1]] },
};
D['lobby-flags'] = D['goal-flags']; // the old name

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
    else if (k === 'spin') steps.push(['spin', 'a']);
    else if (k === 'en') steps.push(['pop', 'a', `⚡+${a}`]);
    else if (k === 'dmg') steps.push(['hit', 'a']);
    else if (k === 'storm') steps.push(['shoot', 'a', { dirs: 'all' }]);
    else if (k === 'overcharge') steps.push(['shoot', 'a', { color: '#ff7b2e', thick: 3 }], ['pop', 'b', '⚠️⚠️⚠️']);
    else if (k === 'swap') steps.push(['shoot', 'a', { color: '#9ff7ff' }], ['swap', 'a', 'b']);
    else if (k === 'emp') steps.push(['ring', 'a', '#9ff7ff'], [['hit', 'b'], ['hit', 'c']]);
    else if (k === 'install') steps.push(['pop', 'a', '+◆'], ['wait', 300]);
    else if (k === 'double') steps.push(['pop', 'a', '🂠🂠'], ['card', 'a', '⬆'], ['move', 'a', 'F', 1], ['card', 'a', '↻'], ['turn', 'a', 1]);
  }
  D[t] = { ...HW_SETUP[t], steps };
}

const FILMS = ['film-1', 'film-2', 'film-3', 'film-4'];
export const hasDemo = (key) => !!D[key] || FILMS.includes(key);
export const demoKeys = () => [...Object.keys(D), ...FILMS];
export const compileDemo = (key, opts = {}) => compile(D[key], !!(D[key]?.safeEdges || opts.safeEdges));

// ---------- building ----------

/** A tiny course object (the shape board.js gives drawCourse) from a demo's def. */
export function miniCourse(def) {
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
      else if (code === 'DD') cell.b = 1; // dock floor
      else if (/^S\d$/.test(code)) Object.assign(cell, { k: 'start', n: Number(code[1]), d: 1, b: 1 });
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
  const pushers = (def.pushers ?? []).map(([x, y, side, regs]) => ({ x, y, side: LETTER[side], regs }));
  const reboot = def.reboot ? { x: def.reboot[0], y: def.reboot[1], d: LETTER[def.reboot[2]] } : null;
  return {
    w, h, cells, lasers, pushers,
    checkpoints: (def.flags ?? []).map(([x, y], i) => ({ x, y, n: i + 1 })),
    boards: [{ dock: false, reboot }, { dock: true, reboot: null }],
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
const blankUi = (def) => ({
  strip: def.strip ? def.strip.map((t) => (t ? { t, locked: t === 'hw' } : null)) : null,
  under: [null, null, null, null, null], lit: -1, line: null, token: null, reg: 0,
});
const cloneUi = (u) => ({ ...u, strip: u.strip && u.strip.map((s) => s && { ...s }), under: [...u.under] });

/** Turn a demo into keyframes: [{ bots, fx: [...], ms, ui }]. bots[id] = { x, y, d, a (angle), vis, scale, alpha } */
function compile(def, safeEdges) {
  const c = miniCourse(def);
  let bots = {};
  for (const [id, [x, y, d]] of Object.entries(def.bots ?? {})) bots[id] = { x, y, d: LETTER[d], a: LETTER[d] * 90, vis: true, scale: 1, alpha: 1 };
  const ui = blankUi(def);
  const cps = {};
  const frames = [{ bots: clone(bots), fx: [], ms: 500, ui: cloneUi(ui) }];
  const occupant = (x, y, not) => Object.entries(bots).find(([k, b]) => k !== not && b.vis && b.x === x && b.y === y)?.[0];
  const idOf = (m) => Object.keys(bots).find((x) => bots[x] === m);
  for (const raw of def.steps) {
    const group = Array.isArray(raw[0]) ? raw : [raw];
    const fx = [];
    let ms = 0;
    for (const st of group) {
      const [k, id, p, q] = st;
      const b = bots[id];
      let sms = STEP_MS;
      switch (k) {
        case 'move': {
          const d = dirOf(b, p);
          for (let i = 0; i < q && b.vis; i++) {
            if (wall(c, b.x, b.y, d)) {
              fx.push({ k: 'bump', id, d });
              break;
            }
            const chain = [];
            let cx = b.x + DX[d];
            let cy = b.y + DY[d];
            let o;
            while ((o = occupant(cx, cy, id))) {
              chain.push(o);
              cx += DX[d];
              cy += DY[d];
            }
            if (def.stopBeforeRobots && chain.length) break; // Pressure Release stops before a robot
            const last = chain.length ? bots[chain.at(-1)] : b;
            if (wall(c, last.x, last.y, d)) {
              fx.push({ k: 'bump', id, d });
              break;
            }
            if (safeEdges && !at(c, last.x + DX[d], last.y + DY[d])) {
              fx.push({ k: 'bump', id, d });
              break;
            }
            for (const m of [...chain.reverse().map((x) => bots[x]), b]) {
              m.x += DX[d];
              m.y += DY[d];
              const cell = at(c, m.x, m.y);
              if (!cell || (cell.k === 'pit' && !(def === D['hover-unit'] && m === b && i < q - 1))) {
                m.vis = false;
                fx.push({ k: 'fall', id: idOf(m) });
              }
            }
          }
          sms = 300 + q * 260;
          break;
        }
        case 'turn':
          b.d = turn(b.d, p);
          b.a += p * 90;
          break;
        case 'face': {
          const d = LETTER[p];
          let diff = (d - b.d + 4) % 4;
          if (diff === 3) diff = -1;
          b.d = d;
          b.a += diff * 90;
          break;
        }
        case 'card':
          fx.push({ k: 'card', id, text: p });
          sms = 700;
          break;
        case 'pop':
          fx.push({ k: 'pop', id, text: p });
          sms = 900;
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
          sms = 800;
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
          // no argument: every belt carries 1 space. 'green' / 'blue' (2 spaces): only those belts.
          // 'only:<id>': that robot alone rides blue belts (2), then green ones (1).
          const only = typeof id === 'string' && id.startsWith('only:') ? id.slice(5) : null;
          const kinds = only ? [true, false] : id === 'blue' ? [true] : id === 'green' ? [false] : [null];
          for (const fast of kinds) {
            for (let s = 0; s < (fast ? 2 : 1); s++) {
              for (const [mid, m] of Object.entries(bots)) {
                if (only && mid !== only) continue;
                const cell = at(c, m.x, m.y);
                if (cell?.k !== 'belt' || !m.vis) continue;
                if (fast != null && cell.fast !== fast) continue;
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
            }
          }
          fx.push({ k: 'beltpulse', only, kinds });
          sms = id === 'blue' || only ? 900 : STEP_MS;
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
          sms = id;
          break;
        // ----- the strip of five slots -----
        case 'lit':
          ui.lit = id;
          sms = 300;
          break;
        case 'slot':
          ui.strip[id] = { t: p, locked: false };
          fx.push({ k: 'flip', i: id });
          sms = 380;
          break;
        case 'swapcard':
          fx.push({ k: 'glitch', i: id, from: ui.strip[id]?.t });
          ui.strip[id] = { ...(ui.strip[id] ?? {}), t: p };
          sms = 750;
          break;
        case 'lock':
          ui.strip[id] = { t: 'hw', locked: true };
          fx.push({ k: 'lockglow', i: id });
          sms = 600;
          break;
        case 'flipslot':
          ui.strip[id] = { t: p, locked: true };
          fx.push({ k: 'flip', i: id });
          sms = 650;
          break;
        case 'newround':
          fx.push({ k: 'clear', was: ui.strip.map((s) => s && { ...s }) });
          ui.strip = ui.strip.map((s, i) => (ui.under[i] ? { t: ui.under[i], locked: true } : s?.locked ? s : null));
          ui.under = [null, null, null, null, null];
          ui.lit = -1;
          sms = 450;
          break;
        case 'fly': {
          const [, t, from, to] = st;
          fx.push({ k: 'fly', t, from, to, n: fx.filter((f) => f.k === 'fly').length });
          if (from.startsWith('slot:') && ui.strip) ui.strip[Number(from.slice(5))] = null;
          if (to.startsWith('slot:') && ui.strip) {
            const i = Number(to.slice(5));
            if (ui.strip[i]) ui.under[i] = t; // it tucks under the card already there
            else ui.strip[i] = { t, locked: t === 'hw' };
          }
          sms = 850;
          break;
        }
        case 'dice': {
          const [, is, ts] = st;
          fx.push({ k: 'dice', is });
          is.forEach((i, n) => (ui.strip[i] = { t: ts[n], locked: false }));
          sms = 900;
          break;
        }
        // ----- marks of light -----
        case 'line':
          ui.line = previewProgram(c, { x: b.x, y: b.y, d: b.d }, p.map((t) => [t]));
          fx.push({ k: 'linein' });
          sms = 500;
          break;
        case 'unline':
          ui.line = null;
          sms = 300;
          break;
        case 'side':
          fx.push({ k: 'side', id, s: p });
          sms = 800;
          break;
        case 'token':
          fx.push({ k: 'token', from: ui.token, to: id });
          ui.token = id;
          sms = 600;
          break;
        case 'reg':
          ui.reg = id;
          sms = 300;
          break;
        case 'flag':
          cps[id] = (cps[id] ?? 0) + 1;
          fx.push({ k: 'rings', id, n: 1 }, { k: 'pop', id, text: `⚑ ${cps[id]} ✓` });
          sms = 900;
          break;
        case 'win':
          fx.push({ k: 'rings', id, n: 3, win: true });
          sms = 1400;
          break;
        case 'panel':
          for (const P of c.pushers) {
            if (!P.regs.includes(id)) continue;
            fx.push({ k: 'panel', x: P.x, y: P.y, side: P.side });
            const who = occupant(P.x, P.y);
            const d = turn(P.side, 2);
            if (who && !wall(c, P.x, P.y, d) && at(c, P.x + DX[d], P.y + DY[d]) && !occupant(P.x + DX[d], P.y + DY[d])) {
              bots[who].x += DX[d];
              bots[who].y += DY[d];
            }
          }
          break;
        case 'spin': {
          const n = p ?? 1;
          b.d = turn(b.d, n);
          b.a += 360 + n * 90;
          fx.push({ k: 'pop', id, text: '?' });
          sms = 950;
          break;
        }
        case 'clock':
          fx.push({ k: 'clock' });
          sms = 1200;
          break;
        case 'ring':
          fx.push({ k: 'rings', id, n: 1, color: p });
          sms = 700;
          break;
      }
      ms = Math.max(ms, sms);
    }
    frames.push({ bots: clone(bots), fx, ms: ms || STEP_MS, ui: cloneUi(ui) });
  }
  frames.push({ bots: clone(bots), fx: [], ms: 900, ui: cloneUi(ui) }); // a pause before it starts over
  return { c, frames, total: frames.reduce((s, f) => s + f.ms, 0), meId: 'a', hand: !!def.hand };
}

/**
 * A lesson (lessons.js) run through the real rules, as a demo: each beat becomes a frame.
 * run = runLesson(lesson): { course, start: [robots], steps: [{ kind: 'program', cards } | { kind: 'beat', beat, robots, reg }] }
 */
export function lessonFrames(run) {
  const c = run.course;
  const ids = run.start.map((r) => r.id);
  let bots = Object.fromEntries(run.start.map((r) => [r.id, { x: r.x, y: r.y, d: r.d, a: r.d * 90, vis: r.on !== false, scale: 1, alpha: 1 }]));
  const ui = { strip: null, under: [], lit: -1, line: null, token: null, reg: 0 };
  const frames = [{ bots: clone(bots), fx: [], ms: 700, ui: cloneUi(ui) }];
  const cps = {};
  let cards = null;
  for (const st of run.steps) {
    if (st.kind === 'program') {
      cards = st.cards;
      continue;
    }
    const next = {};
    for (const r of st.robots) {
      const b = bots[r.id];
      let diff = (r.d - b.d + 4) % 4;
      if (diff === 3) diff = -1;
      next[r.id] = { ...b, x: r.x, y: r.y, d: r.d, a: b.a + diff * 90, vis: r.on !== false };
    }
    const fx = [];
    for (const f of st.beat.fx ?? []) {
      if (f.k === 'reveal') {
        ui.reg = (f.reg ?? st.reg ?? 0) + 1;
        ids.forEach((id, i) => {
          const t = cards?.[i]?.[f.reg ?? st.reg];
          if (t && next[id]?.vis) fx.push({ k: 'card', id, type: t });
        });
      } else if (f.k === 'beam') {
        fx.push({ k: 'beam', x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, color: f.board ? '#ff3b30' : '#ff4a3a', thick: 1 });
        for (const h of f.hit ?? []) fx.push({ k: 'burst', id: h });
      } else if (f.k === 'dmg') {
        fx.push({ k: 'burst', id: f.id }, { k: 'pop', id: f.id, text: `${'⚠️'.repeat(f.sp ?? 0)}${'▣'.repeat(f.hw ?? 0)}` });
      } else if (f.k === 'fall') fx.push({ k: 'fall', id: f.id });
      else if (f.k === 'reboot') fx.push({ k: 'appear', id: f.id });
      else if (f.k === 'cp') {
        cps[f.id] = f.n;
        fx.push({ k: 'rings', id: f.id, n: 1 }, { k: 'pop', id: f.id, text: `⚑ ${f.n} ✓` });
      } else if (f.k === 'win') fx.push({ k: 'rings', id: f.id, n: 3, win: true });
      else if (f.k === 'en') fx.push({ k: 'pop', id: f.id, text: `⚡+${f.n ?? 1}` });
    }
    // a robot that fell is drawn shrinking from where it was
    for (const f of fx) if (f.k === 'fall' && next[f.id]) Object.assign(next[f.id], { x: bots[f.id].x, y: bots[f.id].y });
    const busy = fx.some((f) => ['card', 'pop', 'rings'].includes(f.k));
    frames.push({ bots: next, fx, ms: Math.max(busy ? 700 : 380, Math.min(1100, (st.beat.dur ?? 600) * 0.8)), ui: cloneUi(ui) });
    bots = next;
  }
  frames.push({ bots: clone(bots), fx: [], ms: 1200, ui: cloneUi(ui) });
  return { c, frames, total: frames.reduce((s, f) => s + f.ms, 0), meId: ids[0], hand: false };
}

let lessonsMod = null;
async function filmComp(key) {
  lessonsMod ??= import('./lessons.js').catch(() => null);
  const L = await lessonsMod;
  const lesson = L?.LESSONS?.[FILMS.indexOf(key)];
  if (!lesson) return null;
  try {
    return lessonFrames(L.runLesson(lesson));
  } catch (err) {
    console.warn('film', key, err);
    return null;
  }
}
/** How many lobby-film scenes there are (lessons.js decides). */
export async function filmCount() {
  lessonsMod ??= import('./lessons.js').catch(() => null);
  return Math.min(FILMS.length, (await lessonsMod)?.LESSONS?.length ?? 0);
}

// ---------- the scheduler: every looping canvas on the page ----------

const MAX_LIVE = 16;
const live = new Set();
let raf = 0;
let focus = null;
let rankAt = 0;
let chosen = new Set();
const stats = { animating: 0, mounted: 0 };
const byCanvas = new WeakMap();

/** How many canvases animate right now (and how many are mounted). A debug counter for the Book. */
export const demoStats = () => ({ ...stats });
if (typeof window !== 'undefined') window.rrDemoStats = demoStats;

/** While set, only canvases inside this element animate (the Book, an entry sheet); the rest hold still. */
export function setDemoFocus(el) {
  focus = el ?? null;
  for (const a of live) a.still = false;
  kick();
}

const observers = new Map(); // scroll container (or null: the page) -> IntersectionObserver
function observer(root = null) {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!observers.has(root)) {
    observers.set(root, new IntersectionObserver((entries) => {
      for (const e of entries) {
        const a = byCanvas.get(e.target);
        if (a) {
          a.inView = e.isIntersecting;
          a.still = false;
        }
      }
      rankAt = 0;
      kick();
    }, { root, rootMargin: '100px' }));
  }
  return observers.get(root);
}

function kick() {
  if (!raf && live.size && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick);
}

/**
 * Loop any drawing on a canvas: anim = { total (ms), paint(t), lazy, onStill? }. paint(t) draws time t
 * of the loop. Returns a stop function. (Demos and the race replays both use this.)
 */
export function mountAnim(canvas, anim) {
  const a = Object.assign(anim, { canvas, t0: performance.now(), inView: !anim.lazy, still: false });
  live.add(a);
  byCanvas.set(canvas, a);
  stats.mounted = live.size;
  if (a.lazy) {
    a.io = observer(a.root?.isConnected ? a.root : null);
    if (a.io) a.io.observe(canvas);
    else a.inView = true;
  }
  kick();
  return () => drop(a);
}

function drop(a) {
  live.delete(a);
  chosen.delete(a);
  a.io?.unobserve(a.canvas);
  stats.mounted = live.size;
}

function tick(now) {
  raf = 0;
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cand = [];
  for (const a of live) {
    if (!a.canvas.isConnected) {
      drop(a);
      continue;
    }
    if (!a.total) continue; // not ready yet (a film still loading)
    const shown = a.canvas.offsetParent !== null;
    if (!shown || !a.inView) continue;
    const allowed = !focus || focus.contains(a.canvas);
    if (allowed && !reduce) cand.push(a);
    else if (!a.still) {
      a.paint(a.total / 2);
      a.still = true;
      a.onStill?.();
    }
  }
  // too many: the ones nearest the middle of the screen move, the rest hold a still frame
  if (cand.length > MAX_LIVE) {
    if (now - rankAt > 300 || [...chosen].some((a) => !cand.includes(a))) {
      rankAt = now;
      const mid = window.innerHeight / 2;
      const dist = (a) => {
        const r = a.canvas.getBoundingClientRect();
        return Math.abs(r.top + r.height / 2 - mid);
      };
      chosen = new Set(cand.map((a) => [a, dist(a)]).sort((x, y) => x[1] - y[1]).slice(0, MAX_LIVE).map(([a]) => a));
    }
  } else chosen = new Set(cand);
  for (const a of cand) {
    if (chosen.has(a)) {
      a.still = false;
      // the Book's small tiles move at 30 frames a second: smooth enough, and half the work while scrolling
      if (a.lazy && now - (a.last ?? 0) < 30) continue;
      a.last = now;
      a.paint((now - a.t0) % a.total);
    } else if (!a.still) {
      a.paint(a.total / 2);
      a.still = true;
      a.onStill?.();
    }
  }
  stats.animating = chosen.size;
  if (live.size) raf = requestAnimationFrame(tick);
}

/**
 * Play a demo on a canvas until the canvas leaves the page. opts: { safeEdges, form, lazy, root }
 * (lazy: animate only while in view of root, the scroll box; out of view it holds a still). Returns a stop function.
 */
export function mountDemo(canvas, key, color = '#ff4d6d', opts = {}) {
  if (!hasDemo(key)) return () => {};
  const demo = { canvas, color, form: opts.form ?? 0, comp: null, board: null, lazy: !!opts.lazy, perimeter: !!(D[key]?.safeEdges || opts.safeEdges) };
  const anim = { lazy: demo.lazy, root: opts.root ?? null, total: 0, paint: (t) => draw(demo, t), onStill: () => (demo.board = null) };
  if (demo.lazy) canvas.width = canvas.height = 1;
  if (D[key]) {
    demo.comp = compile(D[key], !!(D[key].safeEdges || opts.safeEdges));
    anim.total = demo.comp.total;
  } else {
    filmComp(key).then((comp) => {
      if (!comp) return;
      demo.comp = comp;
      anim.total = comp.total;
      kick();
    });
  }
  return mountAnim(canvas, anim);
}

// ---------- drawing ----------

// card text used by the demo steps -> card types
const CARD_OF = { '⬆': 'm1', '↑': 'm1', '⬆⬆': 'm2', '↑↑': 'm2', '⬆⬆⬆': 'm3', '↑↑↑': 'm3', '⬇': 'bk', '↻': 'rr', '↺': 'rl', '⟲': 'ut', '⚠️': 'sp', '⚡': 'pu', '⟳': 'ag' };

/** A small upgrade tile: an amber frame with a diamond in it. */
function drawUpTile(g, x, y, s, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = ENERGY;
  g.fillStyle = 'rgba(255,197,110,.16)';
  g.lineWidth = Math.max(1.2, s * 0.07);
  g.shadowColor = ENERGY;
  g.shadowBlur = s * 0.3;
  g.beginPath();
  g.roundRect(x - s / 2, y - s / 2, s, s, s * 0.2);
  g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = ENERGY;
  g.beginPath();
  g.moveTo(x, y - s * 0.24);
  g.lineTo(x + s * 0.24, y);
  g.lineTo(x, y + s * 0.24);
  g.lineTo(x - s * 0.24, y);
  g.closePath();
  g.fill();
  g.restore();
}

/** Pop-up text as Lumen marks: a bolt, a SPAM card, a flag, a hand…; numbers stay; other emoji are left out. */
function drawPop(g, text, x, y, size) {
  const tokens = [];
  const re = /(⚡|⚠️|⚠|🏁|⚑|🂠|▣|✓|✔|✖|🗑️|→|⇄|✋|👁️|👁|🗂️|🔖|◆|🛡️|⤒|↘|\?|⟳|⏏️|⏏|🥇|[+\-×]?\d+|\+|[A-Za-z]+)/gu;
  let m;
  while ((m = re.exec(text))) tokens.push(m[0]);
  if (!tokens.length) return false;
  const w = size * 0.95;
  const isNum = (t) => /^[+\-×]?\d+$/.test(t);
  const widthOf = (t) => (isNum(t) ? w * 0.55 * t.length : t === '+' || t === '?' ? w * 0.6 : w);
  const total = tokens.reduce((s, t) => s + widthOf(t), 0);
  let cx = x - total / 2;
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const card = (type, mx) => drawCard(g, type, mx - size * 0.32, y - size * 0.42, size * 0.64, size * 0.84);
  for (const t of tokens) {
    const tw = widthOf(t);
    const mx = cx + tw / 2;
    if (t === '⚡') drawGlyph(g, 'bolt', mx, y, size, ENERGY);
    else if (t === '⚠️' || t === '⚠') card('sp', mx);
    else if (t === '▣') card('hw', mx);
    else if (t === '🏁' || t === '⚑') drawGlyph(g, 'flag', mx, y, size, LIGHT);
    else if (t === '🂠') card('back', mx);
    else if (t === '✓' || t === '✔') drawGlyph(g, 'check', mx, y, size, '#5fe3b8');
    else if (t === '✖' || t === '🗑️') drawGlyph(g, 'cross', mx, y, size * 0.8, CORAL);
    else if (t === '→' || t === '⇄') drawGlyph(g, t === '→' ? 'play' : 'swap', mx, y, size * 0.6, 'rgba(244,239,228,.7)');
    else if (t === '✋') drawGlyph(g, 'hand', mx, y, size * 0.9, LIGHT);
    else if (t === '👁' || t === '👁️') drawGlyph(g, 'eye', mx, y, size, LIGHT);
    else if (t === '🗂️' || t === '🔖') drawGlyph(g, 'keep', mx, y, size * 0.85, LIGHT);
    else if (t === '◆') drawUpTile(g, mx, y, size * 0.8);
    else if (t === '🛡️') {
      g.save();
      g.strokeStyle = '#9cc8ff';
      g.lineWidth = Math.max(1.5, size * 0.08);
      g.shadowColor = '#9cc8ff';
      g.shadowBlur = size * 0.3;
      g.beginPath();
      g.arc(mx, y, size * 0.36, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else if (t === '⤒') {
      card('back', mx);
      drawGlyph(g, 'm1', mx, y - size * 0.62, size * 0.6, LIGHT);
    } else if (t === '↘') {
      g.save();
      g.translate(mx, y);
      g.rotate(Math.PI / 4);
      drawGlyph(g, 'play', 0, 0, size * 0.6, 'rgba(244,239,228,.7)');
      g.restore();
    } else if (t === '⟳') drawGlyph(g, 'ag', mx, y, size * 0.9, LIGHT);
    else if (t === '⏏' || t === '⏏️') drawGlyph(g, 'abort', mx, y, size * 0.9, LIGHT);
    else if (t === '🥇') drawBadge(g, mx, y, size * 0.36);
    else {
      g.font = `500 ${Math.round(size * 0.72)}px Lumen, Roboto, sans-serif`;
      g.fillStyle = LIGHT;
      g.fillText(t, mx, y + size * 0.04);
    }
    cx += tw;
  }
  g.restore();
  return true;
}

/** The priority mark: a circle of light with an ink "1". */
function drawBadge(g, x, y, r) {
  g.save();
  g.fillStyle = LIGHT;
  g.shadowColor = LIGHT;
  g.shadowBlur = r * 1.2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#0b0e13';
  g.font = `600 ${Math.round(r * 1.35)}px Lumen, Roboto, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('1', x, y + r * 0.08);
  g.restore();
}

/** Where things are on this canvas: the board, the strip, the phone. */
function layoutOf(comp, cssW, cssH, def) {
  const strip = !!comp.frames[0].ui.strip;
  const hand = comp.hand;
  const bw = hand ? cssW * 0.8 : cssW;
  const bh = strip ? cssH * 0.74 : cssH;
  const T = Math.min(bw / comp.c.w, bh / comp.c.h);
  const ox = (bw - T * comp.c.w) / 2;
  const oy = (bh - T * comp.c.h) / 2;
  const stripBox = strip ? { x: 0, y: bh, w: bw, h: cssH - bh } : null;
  const pw = Math.min(cssW * 0.13, cssH * 0.34);
  const handBox = hand ? { x: cssW - pw - cssW * 0.035, y: cssH - pw * 1.75 - cssH * 0.06, w: pw, h: pw * 1.75 } : null;
  return { T, ox, oy, stripBox, handBox, def };
}

function slotRect(L, i) {
  const S = L.stripBox;
  const h = S.h * 0.8;
  const w = h * 0.74;
  const gap = Math.min(w * 0.28, (S.w - w * 5) / 6);
  const total = w * 5 + gap * 4;
  return { x: S.x + (S.w - total) / 2 + i * (w + gap), y: S.y + (S.h - h) / 2, w, h };
}

const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const FACES = ['m1', 'rr', 'm2', 'rl', 'ut', 'm3', 'bk', 'pu'];

function draw(demo, t) {
  const { canvas, comp } = demo;
  if (!comp) return;
  const { c } = comp;
  const cssW = canvas.clientWidth || 120;
  const cssH = canvas.clientHeight || 72;
  const dpr = Math.min(window.devicePixelRatio || 1, demo.lazy ? 1.5 : 2);
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    demo.board = null;
  }
  const L = layoutOf(comp, cssW, cssH);
  const { T, ox, oy } = L;
  const g = canvas.getContext('2d');
  if (!demo.board) {
    demo.board = document.createElement('canvas');
    demo.board.width = canvas.width;
    demo.board.height = canvas.height;
    const bg = demo.board.getContext('2d');
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCourse(bg, c, { tile: T, ox, oy, perimeter: demo.perimeter });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(demo.board, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  // which transition are we in: hold frame 0, then frames[i-1] -> frames[i] over frames[i].ms
  const F = comp.frames;
  let from = F[0];
  let to = F[0];
  let k = 1;
  t %= comp.total;
  if (t >= F[0].ms) {
    t -= F[0].ms;
    let i = 1;
    while (i < F.length - 1 && t >= F[i].ms) {
      t -= F[i].ms;
      i++;
    }
    from = F[i - 1];
    to = F[i];
    k = Math.min(1, t / to.ms);
  }
  const ease = easeIO(k);
  const px = (x) => ox + (x + 0.5) * T;
  const py = (y) => oy + (y + 0.5) * T;
  const names = Object.keys(to.bots);
  const others = names.filter((id) => id !== comp.meId);
  const colorOf = (id) => (id === comp.meId ? demo.color : OTHER[others.indexOf(id) % OTHER.length]);
  const formOf = (id) => (id === comp.meId ? demo.form : (others.indexOf(id) + 2) % 6);

  // the light line, under the robots
  if (to.ui.line) drawGhostLine(g, c, to.ui.line, { tile: T, ox, oy, color: demo.color, alpha: from.ui.line ? 1 : ease, glow: T >= 14 });
  // belts that just ran glow a little
  const beltFx = to.fx.find((f) => f.k === 'beltpulse');
  if (beltFx && k < 1) {
    g.save();
    g.globalAlpha = 0.18 * Math.sin(k * Math.PI);
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const cell = c.cells[y * c.w + x];
        if (cell?.k !== 'belt' || (beltFx.kinds[0] != null && !beltFx.kinds.includes(cell.fast))) continue;
        g.fillStyle = cell.fast ? '#7aa8ff' : '#5fe3b8';
        g.fillRect(ox + x * T, oy + y * T, T, T);
      }
    }
    g.restore();
  }
  for (const f of to.fx) {
    if (f.k !== 'panel' || k >= 1) continue;
    g.save();
    g.globalAlpha = Math.sin(k * Math.PI);
    g.fillStyle = LIGHT;
    g.shadowColor = LIGHT;
    g.shadowBlur = T * 0.4;
    const cx = px(f.x) + DX[f.side] * T * 0.36;
    const cy = py(f.y) + DY[f.side] * T * 0.36;
    const horiz = f.side === 0 || f.side === 2;
    g.fillRect(cx - (horiz ? T * 0.38 : T * 0.09), cy - (horiz ? T * 0.09 : T * 0.38), horiz ? T * 0.76 : T * 0.18, horiz ? T * 0.18 : T * 0.76);
    g.restore();
  }

  const pos = {};
  for (const id of names) {
    const a = from.bots[id] ?? to.bots[id];
    const b = to.bots[id];
    let x = a.x + (b.x - a.x) * ease;
    let y = a.y + (b.y - a.y) * ease;
    let scale = 1;
    let alpha = a.alpha + (b.alpha - a.alpha) * ease;
    let vis = a.vis;
    const falling = to.fx.some((f) => f.k === 'fall' && f.id === id);
    const appearing = to.fx.some((f) => f.k === 'appear' && f.id === id);
    if (falling) {
      scale = 1 - ease * 0.85;
      alpha *= 1 - ease * 0.7;
    }
    if (appearing) {
      vis = true;
      x = b.x;
      y = b.y;
      scale = ease;
    }
    if (!vis && !falling) continue;
    const bumpFx = to.fx.find((f) => f.k === 'bump' && f.id === id);
    const bump = bumpFx ? Math.sin(k * Math.PI) * 0.12 : 0;
    const ang = ((a.a + (b.a - a.a) * ease) * Math.PI) / 180;
    const bd = bumpFx?.d ?? b.d;
    pos[id] = { x: px(x), y: py(y), ang };
    const color = colorOf(id);
    // a short trail of light behind a moving robot
    if ((a.x !== b.x || a.y !== b.y) && !falling && !appearing) {
      g.save();
      g.strokeStyle = color;
      g.globalAlpha = 0.5;
      g.lineWidth = Math.max(2, T * 0.12);
      g.lineCap = 'round';
      g.shadowColor = color;
      g.shadowBlur = T * 0.3;
      g.beginPath();
      g.moveTo(px(a.x), py(a.y));
      g.lineTo(px(x), py(y));
      g.stroke();
      g.restore();
    }
    drawRobot(g, formOf(id), px(x) + DX[bd] * bump * T, py(y) + DY[bd] * bump * T, T * 0.36 * scale, ang, color, { alpha });
  }

  // the priority mark: it slides from one robot to the next
  if (to.ui.token) {
    const tf = to.fx.find((f) => f.k === 'token');
    const dest = pos[to.ui.token];
    const src = tf?.from ? pos[tf.from] : null;
    if (dest) {
      const kk = tf ? ease : 1;
      const bx = src ? src.x + (dest.x - src.x) * kk : dest.x;
      const by = (src ? src.y + (dest.y - src.y) * kk : dest.y) - T * 0.62 - (src ? Math.sin(kk * Math.PI) * T * 0.3 : 0);
      g.save();
      g.globalAlpha = src || !tf ? 1 : ease;
      drawBadge(g, bx, by, Math.max(5, T * 0.17));
      g.restore();
    }
  }

  for (const f of to.fx) {
    const p = pos[f.id];
    if (f.k === 'beam') {
      g.save();
      g.globalAlpha = 1 - k * 0.8;
      g.strokeStyle = f.color === '#ff3b30' ? '#ff4a3a' : f.color;
      g.lineWidth = Math.max(1.5, T * 0.05 * f.thick);
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = T * 0.3;
      g.beginPath();
      g.moveTo(px(f.x0), py(f.y0));
      g.lineTo(px(f.x1), py(f.y1));
      g.stroke();
      g.restore();
    } else if (f.k === 'burst' && p) {
      g.save();
      g.strokeStyle = CORAL;
      g.lineWidth = Math.max(1.5, T * 0.04);
      g.globalAlpha = 1 - k;
      for (let r = 0; r < 8; r++) {
        const an = (r / 8) * Math.PI * 2;
        const r0 = T * (0.25 + k * 0.3);
        g.beginPath();
        g.moveTo(p.x + Math.cos(an) * r0, p.y + Math.sin(an) * r0);
        g.lineTo(p.x + Math.cos(an) * (r0 + T * 0.12), p.y + Math.sin(an) * (r0 + T * 0.12));
        g.stroke();
      }
      g.restore();
    } else if (f.k === 'shield' && p) {
      g.save();
      g.strokeStyle = '#9cc8ff';
      g.lineWidth = Math.max(1.5, T * 0.05);
      g.shadowColor = '#9cc8ff';
      g.shadowBlur = T * 0.3;
      g.globalAlpha = 1 - k * 0.5;
      g.beginPath();
      g.arc(p.x, p.y, T * 0.52, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else if (f.k === 'rings' && p) {
      const color = f.color ?? (f.win ? colorOf(f.id) : LIGHT);
      g.save();
      g.strokeStyle = color;
      g.shadowColor = color;
      g.shadowBlur = T * 0.3;
      for (let r = 0; r < f.n; r++) {
        const kk = clamp01(k * (1 + f.n * 0.25) - r * 0.25);
        if (kk <= 0 || kk >= 1) continue;
        g.globalAlpha = 1 - kk;
        g.lineWidth = Math.max(1.5, T * 0.05);
        g.beginPath();
        g.arc(p.x, p.y, T * (0.35 + kk * (f.win ? 0.9 : 0.55)), 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    } else if (f.k === 'side' && p) {
      drawSide(g, p, T, f.s, k);
    } else if ((f.k === 'pop' || f.k === 'card') && p) {
      const rise = f.k === 'pop' ? k * T * 0.3 : 0;
      const sz = Math.max(12, T * 0.42);
      g.save();
      g.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      const yy = p.y - T * 0.7 - rise;
      const type = f.type ?? CARD_OF[f.text];
      if (f.k === 'card' && type) drawCard(g, type, p.x - sz * 0.42, yy - sz * 0.55, sz * 0.84, sz * 1.1);
      else if (f.k === 'card') {
        // a stacked or Haywire card: its moves as small marks on a light slide
        const text = f.text.replace(/⬆/g, '↑').replace(/️/g, '');
        const w = Math.max(sz * 1.2, sz * 0.62 * [...text].length);
        g.fillStyle = LIGHT;
        g.beginPath();
        g.roundRect(p.x - w / 2, yy - sz * 0.55, w, sz * 1.1, sz * 0.15);
        g.fill();
        g.fillStyle = '#15181d';
        g.font = `600 ${Math.round(sz * 0.62)}px Lumen, Roboto, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, p.x, yy + sz * 0.03);
      } else drawPop(g, f.text, p.x, yy, sz);
      g.restore();
    }
  }

  // the register's numeral, faint, top left
  if (to.ui.reg) {
    g.save();
    g.globalAlpha = 0.28;
    g.fillStyle = LIGHT;
    g.font = `200 ${Math.round(Math.min(cssH * 0.3, T * 1.1))}px Lumen, Roboto, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(String(to.ui.reg), cssW * 0.03, cssH * 0.03);
    g.restore();
  }
  // the countdown ring, top right
  const clock = to.fx.find((f) => f.k === 'clock');
  if (clock) {
    const r = Math.min(cssW, cssH) * 0.08;
    const cx = cssW - r * 1.6;
    const cy = r * 1.6;
    g.save();
    g.strokeStyle = k > 0.85 ? CORAL : LIGHT;
    g.lineWidth = Math.max(1.5, r * 0.18);
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = r;
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k));
    g.stroke();
    g.restore();
  }

  if (L.stripBox) drawStrip(g, L, from, to, k);
  if (L.handBox) drawHand(g, L, to, k);
  // cards and upgrades in flight
  for (const f of to.fx) {
    if (f.k !== 'fly') continue;
    const kk = clamp01((k - f.n * 0.12) / 0.76);
    if (kk <= 0 || kk >= 1) continue;
    const A = placeOf(f.from, L, pos, T, px, py, from);
    const B = placeOf(f.to, L, pos, T, px, py, to);
    if (!A || !B) continue;
    const e = easeIO(kk);
    const x = A.x + (B.x - A.x) * e;
    const y = A.y + (B.y - A.y) * e - Math.sin(e * Math.PI) * Math.min(cssH * 0.25, T);
    const s = A.s + (B.s - A.s) * e;
    if (f.t === 'up') drawUpTile(g, x, y, s * 0.9);
    else drawCard(g, f.t, x - s * 0.37, y - s * 0.5, s * 0.74, s);
  }
}

/** A point (and a card size) for 'bot:a', 'slot:2', 'hand', 'deck'. */
function placeOf(spec, L, pos, T, px, py, frame) {
  if (spec.startsWith('bot:')) {
    const id = spec.slice(4);
    const p = pos[id] ?? (frame.bots[id] && { x: px(frame.bots[id].x), y: py(frame.bots[id].y) });
    return p && { x: p.x, y: p.y - T * 0.2, s: T * 0.55 };
  }
  if (spec.startsWith('slot:') && L.stripBox) {
    const r = slotRect(L, Number(spec.slice(5)));
    return { x: r.x + r.w / 2, y: r.y + r.h / 2, s: r.h };
  }
  if (spec === 'hand' && L.handBox) {
    const h = L.handBox;
    return { x: h.x + h.w / 2, y: h.y + h.h * 0.55, s: h.w * 0.6 };
  }
  if (spec === 'deck') return { x: L.ox + T * 0.5, y: L.oy + T * 0.5, s: T * 0.6 };
  return null;
}

/** An arrow of light from a robot's front, bending to its own left or right (like the turn cards); or a pulse at its front. */
function drawSide(g, p, T, side, k) {
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.ang);
  g.strokeStyle = LIGHT;
  g.fillStyle = LIGHT;
  g.shadowColor = LIGHT;
  g.shadowBlur = T * 0.3;
  g.lineWidth = Math.max(1.5, T * 0.07);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
  if (side === 'F') {
    const r = T * (0.08 + 0.12 * Math.sin(k * Math.PI));
    g.beginPath();
    g.arc(0, -T * 0.42, r, 0, Math.PI * 2);
    g.fill();
  } else {
    const s = side === 'L' ? -1 : 1;
    const grow = Math.min(1, k * 1.8);
    const len = T * 1.05;
    g.setLineDash([len * grow, len]);
    g.beginPath();
    g.moveTo(0, -T * 0.4);
    g.quadraticCurveTo(0, -T * 0.78, s * T * 0.42, -T * 0.78);
    g.stroke();
    g.setLineDash([]);
    if (grow >= 1) {
      const h = T * 0.13;
      const x = s * T * 0.5;
      const y = -T * 0.78;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - s * h, y - h);
      g.lineTo(x - s * h, y + h);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

/** The five slots along the bottom, like the phone's race slots. */
function drawStrip(g, L, from, to, k) {
  const S = to.ui.strip;
  if (!S) return;
  const lit = to.ui.lit;
  for (let i = 0; i < 5; i++) {
    const r = slotRect(L, i);
    const s = S[i];
    const fx = (kind) => to.fx.find((f) => f.k === kind && (f.i === i || f.is?.includes(i)));
    const flip = fx('flip');
    const glitch = fx('glitch');
    const dice = fx('dice');
    const lockglow = fx('lockglow');
    const clear = to.fx.find((f) => f.k === 'clear');
    const flyIn = to.fx.find((f) => f.k === 'fly' && f.to === `slot:${i}` && !from.ui.strip?.[i]);
    const flyOut = to.fx.find((f) => f.k === 'fly' && f.from === `slot:${i}`);
    g.save();
    if (lit >= 0 && i < lit) g.globalAlpha = 0.3;
    // the empty frame
    g.strokeStyle = 'rgba(244,239,228,.3)';
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, r.w * 0.16);
    g.stroke();
    g.setLineDash([]);
    if (clear && clear.was[i] && !s && k < 1) {
      g.globalAlpha *= 1 - k;
      drawCard(g, clear.was[i].t, r.x, r.y, r.w, r.h);
    } else if (dice && k < 1) {
      g.globalAlpha *= 0.4;
      drawCard(g, FACES[(Math.floor(k * 900 / 120) + i * 3) % FACES.length], r.x, r.y, r.w, r.h);
    } else if (flyOut && k <= flyOut.n * 0.12 + 0.01) {
      drawCard(g, flyOut.t, r.x, r.y, r.w, r.h);
    } else if (s && !(flyIn && k < 0.95)) {
      let w = r.w;
      if (flip && k < 1) w = r.w * Math.abs(Math.cos((1 - k) * Math.PI / 2));
      const type = glitch && k < 0.7 ? (Math.floor(k * 14) % 2 ? glitch.from ?? s.t : 'sp') : s.t;
      if (s.locked) {
        g.save();
        g.shadowColor = VIOLET;
        g.shadowBlur = r.w * (lockglow && k < 1 ? 0.9 * Math.sin(k * Math.PI) + 0.4 : 0.45);
        g.fillStyle = 'rgba(185,155,255,.25)';
        g.beginPath();
        g.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, r.w * 0.18);
        g.fill();
        g.restore();
      }
      drawCard(g, type, r.x + (r.w - w) / 2, r.y, w, r.h);
    }
    // a Haywire tucked under this slot's card
    if (to.ui.under[i] && !(to.fx.some((f) => f.k === 'fly' && f.to === `slot:${i}`) && k < 0.95)) drawCard(g, to.ui.under[i], r.x + r.w * 0.45, r.y + r.h * 0.55, r.w * 0.6, r.h * 0.6);
    g.restore();
    if (lit === i) {
      g.save();
      g.strokeStyle = LIGHT;
      g.lineWidth = 2;
      g.shadowColor = LIGHT;
      g.shadowBlur = r.w * 0.5;
      g.globalAlpha = from.ui.lit === i ? 1 : easeIO(k);
      g.beginPath();
      g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, r.w * 0.2);
      g.stroke();
      g.restore();
    }
  }
}

/** A small phone at the bottom right: where your cards go. */
function drawHand(g, L, to, k) {
  const h = L.handBox;
  const landing = to.fx.some((f) => f.k === 'fly' && (f.to === 'hand' || f.from === 'hand')) && k > 0.8;
  g.save();
  g.strokeStyle = landing ? LIGHT : 'rgba(244,239,228,.45)';
  g.lineWidth = 1.4;
  if (landing) {
    g.shadowColor = LIGHT;
    g.shadowBlur = h.w * 0.5;
  }
  g.beginPath();
  g.roundRect(h.x, h.y, h.w, h.h, h.w * 0.2);
  g.stroke();
  g.fillStyle = 'rgba(244,239,228,.08)';
  g.fillRect(h.x + h.w * 0.15, h.y + h.h * 0.12, h.w * 0.7, h.h * 0.76);
  g.restore();
}
