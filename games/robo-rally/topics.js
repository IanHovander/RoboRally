// What the phone's Guide knows: every "?" topic (a picture, 1-3 looping clips, one sentence of fine
// print), the Book's sections, and what's on a square of the map. No DOM here, so tests can read it.
//   topic: { sec, pic, name?, clips: [[demoKey, caption]], fine, does? (what a Haywire does, step by step: said big),
//            cap? (the Book tile's caption when there's no clip) }
//   pic: { card: t } { g: glyph } { up: key } { cell: kind } { me: true } { robot: true } { slots: true }
//        { line: true } { badge: '1' } { strip: true } { stack: true } { pair: [t, t] } { arrows: true } { course: true }
import { UPGRADES, HAYWIRE, cardType, isHaywire } from './cards.js';
import { wallBetween, beamPath } from './board.js';

/** The Book's mechanics sections, in order: an icon and one word. */
export const SECTIONS = [
  { id: 'goal', icon: { g: 'flag' }, label: 'Goal' },
  { id: 'program', icon: { g: 'hand' }, label: 'Program' },
  { id: 'cards', icon: { g: 'm1' }, label: 'Cards' },
  { id: 'order', icon: { badge: '1' }, label: 'Order' },
  { id: 'board', icon: { g: 'm1', tone: 'belt' }, label: 'Board' },
  { id: 'robots', icon: { robot: true }, label: 'Robots' },
  { id: 'damage', icon: { card: 'sp' }, label: 'Damage' },
  { id: 'falling', icon: { g: 'reboot' }, label: 'Falling' },
  { id: 'shutdown', icon: { g: 'power' }, label: 'Shutdown' },
  { id: 'energy', icon: { g: 'bolt' }, label: 'Energy' },
  { id: 'options', icon: { g: 'timer' }, label: 'Options' },
  { id: 'upgrades', icon: { up: true }, label: 'Upgrades' },
  { id: 'haywire', icon: { card: 'hw' }, label: 'Haywire' },
];
/** The contextual sections that come first in the Book, when they apply. */
export const EXTRA_SECTIONS = {
  now: { id: 'now', icon: { g: 'eye' }, label: 'Now' },
  last: { id: 'last', icon: { g: 'undo' }, label: 'Last round' },
  film: { id: 'film', icon: { g: 'play' }, label: 'Film' },
};

const MOVE_FINE = (n) => `Move forward ${n}. You shove robots in the way; only walls stop you.`;
const TURN_FINE = (side) => `A quarter turn to the robot's own ${side}, on the spot. Trust the line.`;

/** The hand-written topics. Upgrades and Haywires are added below, from cards.js. */
export const TOPICS = {
  // ----- goal -----
  goal: { sec: 'goal', pic: { g: 'flag' }, clips: [['goal-flags', 'In order'], ['flag-stop', 'Stop on it']], fine: 'Reach the numbered flags in order. A flag counts only if you’re on it when a slot ends. First to the last flag wins.' },
  flag: { sec: 'goal', pic: { cell: 'flag' }, clips: [['flag-stop', 'Stop on it'], ['goal-flags', 'In order']], fine: 'A numbered flag. Rings at its foot show who has it.' },
  // ----- program -----
  slots: { sec: 'program', pic: { slots: true }, clips: [['program-fill', 'Fill five']], fine: 'Tap cards to fill the five slots. Slot 1 runs first. Tap a filled slot to take its card back.' },
  line: { sec: 'program', pic: { line: true }, clips: [['line-preview', 'Where you’ll go'], ['line-bumped', 'Robots change it']], fine: 'Where your cards take you if nothing gets in the way. ✕: you’d fall. ?: can’t be known.' },
  lock: { sec: 'program', pic: { g: 'check', lockAnim: true }, clips: [], cap: 'Lock in', fine: 'Lights up when all five slots are full. Until the race starts, tap it again to change your cards.' },
  clear: { sec: 'program', pic: { g: 'undo' }, clips: [['clear', 'All back']], fine: 'Empties all five slots.' },
  timer: { sec: 'program', pic: { g: 'timer' }, clips: [['timeout', 'At zero']], fine: 'At zero, empty slots get random cards from your hand. Cards you placed stay. On by default.' },
  me: { sec: 'program', pic: { me: true }, clips: [['facing', 'Your front']], fine: 'Yours has the white outline. The point is its front. The map is the big screen, seen from above.' },
  deck: { sec: 'program', pic: { g: 'deck' }, clips: [], cap: 'Your deck', fine: 'Your draw pile. Tap the deck up top to see what’s in it, not the order. Empty: your discard pile is shuffled in.' },
  discard: { sec: 'program', pic: { card: 'back' }, clips: [], cap: 'Discard pile', fine: 'Cards you’ve played or not used this round. When your draw pile runs out, these are shuffled into it.' },
  // ----- cards -----
  m1: { sec: 'cards', pic: { card: 'm1' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(1) },
  m2: { sec: 'cards', pic: { card: 'm2' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(2) },
  m3: { sec: 'cards', pic: { card: 'm3' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(3) },
  bk: { sec: 'cards', pic: { card: 'bk' }, clips: [['card-bk', 'No turn']], fine: 'Move back one space, still facing the same way.' },
  rr: { sec: 'cards', pic: { card: 'rr' }, clips: [['card-turn', 'Stays put'], ['turn-own-left', 'Whose left?']], fine: TURN_FINE('right') },
  rl: { sec: 'cards', pic: { card: 'rl' }, clips: [['turn-own-left', 'Whose left?'], ['card-turn', 'Stays put']], fine: TURN_FINE('left') },
  ut: { sec: 'cards', pic: { card: 'ut' }, clips: [['card-ut', 'Turn around']], fine: 'Turn around, on the spot.' },
  pu: { sec: 'cards', pic: { card: 'pu' }, clips: [['card-pu', 'Energy']], fine: 'Gain 1 energy. You don’t move. (With upgrades off, it isn’t in the deck.)' },
  ag: { sec: 'cards', pic: { card: 'ag' }, clips: [['again', 'Repeat'], ['again-first', 'In slot 1']], fine: 'Repeats what your previous slot did. In slot 1 there’s nothing to repeat: it becomes a random card.' },
  // ----- order -----
  registers: { sec: 'order', pic: { strip: true }, clips: [['order-registers', 'Slot by slot']], fine: 'Every robot plays slot 1, then the board moves, then everyone plays slot 2, and so on.' },
  priority: { sec: 'order', pic: { badge: '1' }, clips: [['order-priority', 'Who’s first']], fine: 'The robot marked 1 goes first in every slot this round, then in seat order. The mark moves one seat each round.' },
  'look-up': { sec: 'order', pic: { g: 'eye' }, clips: [['order-registers', 'Look up']], fine: 'Your robot runs your cards by itself. Watch the big screen; the lit slot is the one running now.' },
  watch: { sec: 'order', pic: { g: 'eye' }, clips: [['order-registers', 'Look up']], fine: 'The leader is choosing the course; look at the big screen. (Late joiner: you’ll be in the next race.)' },
  // ----- board -----
  'belt-green': { sec: 'board', pic: { cell: 'belt-green' }, clips: [['belt-green', 'One a slot'], ['belt-curve', 'Curves']], fine: 'Carries you 1 space after every slot. A curve turns you only if the belt carries you round it.' },
  'belt-blue': { sec: 'board', pic: { cell: 'belt-blue' }, clips: [['belt-blue', 'Two a slot']], fine: 'Carries you 2 spaces after every slot.' },
  gear: { sec: 'board', pic: { cell: 'gear' }, clips: [['gear', 'Turns you']], fine: 'Green turns you right, red turns you left, after every slot you end on it.' },
  pusher: { sec: 'board', pic: { cell: 'pusher' }, clips: [['pusher', 'Lit slots only']], fine: 'Shoves you one space the way its arrow points, but only in the slots whose dots are lit.' },
  pit: { sec: 'board', pic: { cell: 'pit' }, clips: [['reboot', 'In it goes']], fine: 'Drive or get pushed in, and you fall (see Falling).' },
  edge: { sec: 'board', pic: { g: 'edge' }, clips: [['edge', 'Off the edge']], fine: 'Off the edge is a fall too (unless Map perimeter is on).' },
  wall: { sec: 'board', pic: { g: 'wall' }, clips: [['wall', 'Stops you'], ['wall-laser', 'Stops lasers']], fine: 'Walls stop robots, pushes and lasers. Hitting one doesn’t hurt.' },
  'board-laser': { sec: 'board', pic: { cell: 'laser' }, clips: [['board-laser', 'First robot only']], fine: 'After every slot, it hits the first robot in its line: 1 SPAM per beam. Two lines side by side: a double laser, 2 SPAM.' },
  'double-laser': { sec: 'board', pic: { cell: 'laser' }, clips: [['board-laser', 'First robot only']], cap: 'Double laser', fine: 'Two beams: double damage. After every slot it hits the first robot in its line with 2 SPAM.' },
  battery: { sec: 'board', pic: { cell: 'battery' }, clips: [['battery', 'Every slot']], fine: 'End a slot here: +1 energy. Stay, and get +1 again next slot.' },
  dock: { sec: 'board', pic: { cell: 'dock' }, clips: [['battery', 'Batteries too']], fine: 'Where everyone starts. Fall from here (inside its dashed edge): back on your start pad. Walls, edges and batteries work as anywhere.' },
  pad: { sec: 'board', pic: { cell: 'pad' }, clips: [['facing', 'Your front']], fine: 'Pick any free pad. You’ll face the board. Avoid sitting in a line behind others.' },
  // ----- robots -----
  robot: { sec: 'robots', pic: { robot: true }, clips: [['push', 'Shove'], ['robot-laser', 'Laser']], fine: 'Other robots’ cards are secret. Robots shove and shoot each other; damage never knocks anyone out.' },
  rival: { sec: 'robots', pic: { robot: true }, clips: [], cap: 'Look closer', fine: 'Tap a robot on your map, or in your deck’s sheet, to see its flags, energy and installed upgrades. Its cards stay secret.' },
  decide: { sec: 'robots', pic: { robot: true, dots: true }, clips: [], cap: 'Choosing', fine: 'That player’s upgrade is asking them something. The race waits up to 12 seconds.' },
  // ----- damage -----
  sp: { sec: 'damage', name: 'SPAM', pic: { card: 'sp' }, clips: [['damage-spam', 'Where from'], ['spam-play', 'Play it?']], fine: 'Junk from being hit. Played, it’s gone for good, but that slot runs a random card from your deck. Unplayed, it stays in your hand.' },
  'haywire-slot': { sec: 'damage', name: 'Haywire', pic: { card: 'hw', slot: true }, clips: [['damage-haywire', 'Jammed slot']], fine: 'A Haywire landed in this slot when you were hit. It runs here this round and can’t be moved. Fill the others.' },
  'spam-count': { sec: 'damage', pic: { stack: true }, clips: [['damage-spam', 'Junk cards']], fine: 'All the SPAM you own: in your hand, deck and discard pile.' },
  damage: { sec: 'damage', pic: { pair: ['sp', 'hw'] }, clips: [['damage-cards', 'No health'], ['shutdown', 'Clear it']], fine: 'There’s no health. Damage is junk cards. Clear it by playing SPAM or shutting down.' },
  // ----- falling -----
  fall: { sec: 'falling', pic: { g: 'reboot' }, clips: [['reboot', 'Pit'], ['edge', 'Edge']], fine: 'You sit out the rest of the round, take 2 junk cards, and return on the blue ring next round. Flags, energy and upgrades stay.' },
  'reboot-ring': { sec: 'falling', pic: { cell: 'reboot' }, clips: [['reboot', 'Back here']], fine: 'Fall anywhere inside its blue edge, come back here next round. Your map lights yours in your color. From the dock: your start pad.' },
  'reboot-dir': { sec: 'falling', pic: { arrows: true }, clips: [['reboot-face', 'Pick a way']], fine: 'Choose which way you’ll face when you come back.' },
  // ----- shutdown -----
  shutdown: { sec: 'shutdown', pic: { g: 'power' }, clips: [['shutdown', 'Sit out']], fine: 'Instead of programming, sit out a round: all junk in your hand, slots and discard pile goes. Pushes and lasers still reach you.' },
  // ----- energy -----
  energy: { sec: 'energy', pic: { g: 'bolt' }, clips: [['upgrades', 'Earn, spend'], ['battery', 'Batteries']], fine: 'Energy (max 10) buys upgrades. Earn it on batteries and with Power Up.' },
  shop: { sec: 'energy', pic: { g: 'shop' }, clips: [['upgrades', 'Earn, spend']], fine: 'Optional, from round 2. + draws an upgrade (⚡1, once a round); tap one to install (its price, one a round). Only installed ones work.' },
  draw: { sec: 'energy', pic: { g: 'plus' }, clips: [['upgrades', 'Draw one']], fine: 'Draws a random upgrade into your collection. It isn’t installed yet.' },
  kind: { sec: 'energy', pic: { kind: true }, clips: [], cap: 'Kept or once', fine: '∞ is permanent: always on, 3 slots. 1× is one use, then gone: 3 slots.' },
  arm: { sec: 'energy', pic: { g: 'play', arm: true }, clips: [['boink', 'Arm, then use']], fine: 'Tap the bar during the race to arm it; at your next turn your phone asks before your card.' },
  'your-upgrades': { sec: 'energy', pic: { up: true }, clips: [], cap: 'Yours', fine: '' }, // filled in from what you have installed
  // ----- options (the leader's toggles) -----
  start: { sec: 'options', pic: { g: 'play' }, clips: [], cap: 'Start', fine: 'Starts the race. Nobody can join once start pads are being picked.' },
  course: { sec: 'options', pic: { course: true }, clips: [], cap: 'Course', fine: 'Dots: difficulty. Flag number: how many flags (more is longer).' },
  'opt-upgrades': { sec: 'options', pic: { g: 'bolt' }, clips: [['upgrades', 'Upgrades']], fine: 'Off: no shop and no energy; batteries and Power Up do nothing (the rulebook’s lighter game).' },
  'opt-safe': { sec: 'options', name: 'Map perimeter', pic: { g: 'wall' }, clips: [['safe-edges', 'Map perimeter']], fine: 'A wall all the way round the map: nobody drives or gets pushed off the edge. Pits still swallow.' },
  'opt-lessspam': { sec: 'options', name: 'Spam in hand discards', pic: { card: 'sp' }, clips: [['less-spam', 'Spam in hand discards']], fine: 'SPAM in your hand goes to your discard pile after programming instead of clogging your hand.' },
  'opt-brief': { sec: 'options', name: 'Rules tutorial', pic: { g: 'tutorial' }, clips: [], cap: 'Rules tutorial', fine: 'On: a rules tutorial before round 1, for everyone. Off: only when someone is new.' },
  'opt-timer': { sec: 'options', pic: { g: 'timer' }, clips: [['timeout', 'At zero']], fine: 'Minutes to program each round (2 by default). ∞: no timer on the phones.' },
};

// What some upgrades look like in play, where the card's own text doesn't say it.
const UPGRADE_EXTRA = {
  'deflector-shield': 'Pays automatically; switch it off in its sheet.',
  'brakes': 'Your phone asks each time.',
  'crab-legs': 'Tap + on a turn slot.',
  'memory-cards': 'Tap the bookmark on a card.',
  'spam-filter': 'The eye chip shows it.',
  'mini-howitzer': 'Your phone asks each slot.',
  'pressor-beam': 'Your phone asks each slot.',
  'tractor-beam': 'Your phone asks each slot.',
  'scrambler': 'Your phone asks each slot.',
};
/** How many words a string has (fine print stays at 25 or fewer). */
export const words = (text) => String(text).trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w) || w === '+').length;
// Haywires with a proper name (the rest are named by what they do, which the card face already shows).
const named = (t) => !!HAYWIRE[t].text;
/**
 * What each Haywire does, step by step, checked against engine.js (runOp, moveRobot, fireAll) and its clip.
 * does: the plain sentence the Guide shows big; fine: the small print under it.
 */
export const HAYWIRE_DOES = {
  h01: { does: 'Move 1, turn right, move 1.' },
  h02: { does: 'Slide 2 spaces sideways, still facing the same way.', fine: 'You pick left or right while programming (right if you don’t).' },
  h03: { does: 'Move 3, then turn around.' },
  h04: { does: 'Move 5. If a wall stops you, take 1 damage.', fine: 'Robots in the way are shoved. Stopped by a stuck robot instead: no damage.' },
  h05: { does: 'Install a permanent upgrade from your collection, free, even past 3.', fine: 'You pick it while programming. At the round’s end it’s discarded. No permanent upgrade in your collection: nothing happens.' },
  h06: { does: 'Move 1, turn left, move 1.' },
  h07: { does: 'Turn around, then move 2.' },
  h08: { does: 'Back up 3 spaces, still facing the same way.' },
  h09: { does: 'At this slot’s end your laser fires 4 ways: front, back, left and right.', fine: 'Each beam hits the first robot in its line.' },
  h10: { does: 'Run the top 2 cards of your deck here, one after the other.', fine: 'Again in the next slot repeats only the second.' },
  h11: { does: 'Turn to a random facing (maybe the same one), then move 2.' },
  h12: { does: 'Swap places with the first robot in front of you. Nobody turns.', fine: 'The robot your laser would hit; walls block it. Nobody there: nothing happens.' },
  h13: { does: 'Gain 3 energy, then take 1 damage.', fine: 'Energy stops at 10. With upgrades off there’s no energy: only the damage.' },
  h14: { does: 'Every robot right next to yours takes 1 damage.', fine: 'Not through walls.' },
  h15: { does: 'Move 2, turn left, move 1.' },
  h16: { does: 'Move 1, step 1 right without turning, move 1.' },
  h17: { does: 'At this slot’s end your laser deals 2 extra damage: 3 instead of 1.', fine: 'Only your main laser, not a weapon upgrade.' },
};

const ups = Object.keys(UPGRADES);
const perm = ups.filter((k) => UPGRADES[k].kind === 'perm').sort((a, b) => UPGRADES[a].cost - UPGRADES[b].cost || ups.indexOf(a) - ups.indexOf(b));
const temp = ups.filter((k) => UPGRADES[k].kind === 'temp').sort((a, b) => UPGRADES[a].cost - UPGRADES[b].cost || ups.indexOf(a) - ups.indexOf(b));
/** Upgrade keys in the Book's order: permanent first, then one-use, each by cost. */
export const UPGRADE_ORDER = [...perm, ...temp];
for (const k of UPGRADE_ORDER) {
  const u = UPGRADES[k];
  const extra = UPGRADE_EXTRA[k] && words(`${u.text} ${UPGRADE_EXTRA[k]}`) <= 25 ? ` ${UPGRADE_EXTRA[k]}` : '';
  TOPICS[k] = { sec: 'upgrades', name: u.name, pic: { up: k }, clips: [[k, '']], fine: u.text + extra, generated: true };
}
for (const [t, hw] of Object.entries(HAYWIRE)) {
  const say = HAYWIRE_DOES[t] ?? { does: hw.text ?? `${hw.name}.` };
  TOPICS[t] = { sec: 'haywire', name: named(t) ? hw.name : undefined, pic: { card: t }, clips: [[t, '']], does: say.does, fine: say.fine ?? '', generated: true };
}

/** A topic by id (an upgrade key, a Haywire type, a card type…), or null. */
export const topic = (id) => TOPICS[id] ?? null;

/** The topic for a card in your hand or a slot: its type (SPAM 'sp', a Haywire 'h05'). */
export const cardTopic = (id) => cardType(id);

/** Every topic id in a section, in Book order. */
export function sectionTopics(sec) {
  if (sec === 'upgrades') return [...UPGRADE_ORDER];
  if (sec === 'haywire') return Object.keys(HAYWIRE);
  return Object.keys(TOPICS).filter((id) => TOPICS[id].sec === sec && !TOPICS[id].generated && !HIDDEN_IN_BOOK.has(id));
}
// contextual topics: they make sense only for something on your screen (they're in "Now" when they apply)
const HIDDEN_IN_BOOK = new Set(['your-upgrades', 'deck', 'discard', 'decide', 'watch', 'start', 'course', 'lock', 'kind', 'look-up']);

/** The Book tile's caption: the first clip's caption, or the name (upgrades, named Haywires), or its own cap. */
export function tileCaption(id) {
  const t = TOPICS[id];
  if (!t) return '';
  if (t.generated || id === 'sp' || id === 'haywire-slot') return t.name ?? '';
  return t.clips[0]?.[1] || t.cap || t.name || '';
}

/**
 * The Book's tiles for one section: each clip shows once. A topic whose first clip is already there uses
 * its next one (rr: "Whose left?", then rl: "Stays put"); a topic with every clip already shown is left
 * out (Move 3, after Move 1 and Move 2). Topics without clips (a picture tile) always stay.
 * asks: topic ids (or "id:arg"); clipsOf(ask) -> its clips ([[key, caption]], already filtered to existing demos).
 * Returns [{ ask, id, clip: [key, caption] | null, cap }].
 */
export function bookTiles(asks, clipsOf = (ask) => TOPICS[ask.split(':')[0]]?.clips ?? []) {
  const used = new Set();
  const out = [];
  for (const ask of asks) {
    const id = ask.split(':')[0];
    const t = TOPICS[id];
    if (!t || out.some((x) => x.ask === ask)) continue;
    const clips = clipsOf(ask) ?? [];
    const clip = clips.find(([k]) => !used.has(k)) ?? null;
    if (clips.length && !clip) continue;
    if (clip) used.add(clip[0]);
    const named = t.generated || id === 'sp' || id === 'haywire-slot';
    out.push({ ask, id, clip, cap: named ? t.name ?? '' : clip?.[1] || t.cap || t.name || '' });
  }
  return out;
}

/**
 * What's on square (x, y) of a course, for a tap at (fx, fy) inside it (0..1): topic ids, the first one
 * first (the rest are "also here"). o: { robots: [{x, y, on, me}], ghosts: [{x, y, path}], ring: {x, y} (my lit reboot spot) }
 */
export function topicAtCell(course, x, y, fx = 0.5, fy = 0.5, o = {}) {
  const out = [];
  const add = (id) => {
    if (id && !out.includes(id)) out.push(id);
  };
  const inside = x >= 0 && y >= 0 && x < course.w && y < course.h;
  const cell = inside ? course.cells[y * course.w + x] : null;
  // 1. a robot
  const r = (o.robots ?? []).find((q) => q.x === x && q.y === y && q.on !== false);
  if (r) add(r.me ? 'me' : 'robot');
  // 2. the light line
  if ((o.ghosts ?? []).some((gh) => (gh.x === x && gh.y === y) || (gh.path ?? []).some(([gx, gy]) => gx === x && gy === y))) add('line');
  // 3. near a side with a wall, or a push panel
  if (cell) {
    const near = [fy < 0.22, fx > 0.78, fy > 0.78, fx < 0.22]; // N E S W
    for (let d = 0; d < 4; d++) {
      if (!near[d]) continue;
      if (wallBetween(course, x, y, d)) add('wall');
      if ((course.pushers ?? []).some((p) => p.x === x && p.y === y && p.side === d)) add('pusher');
    }
  }
  // 4. a flag, the reboot ring
  if (course.checkpoints.some((cp) => cp.x === x && cp.y === y)) add('flag');
  if (course.boards.some((b) => b.reboot && b.reboot.x === x && b.reboot.y === y)) add('reboot-ring');
  if (o.ring && o.ring.x === x && o.ring.y === y) add('reboot-ring'); // my start pad, lit as the spot I'd come back on
  // 5. on a board laser's line
  const onLaser = course.lasers.filter((L) => beamPath(course, L.x, L.y, L.d).some((p) => p.x === x && p.y === y));
  if (inside && onLaser.some((L) => L.n > 1)) add('double-laser');
  if (inside && onLaser.some((L) => L.n === 1)) add('board-laser');
  // 6-8. the square itself
  if (!cell) add('edge');
  else {
    if (cell.k === 'belt') add(cell.fast ? 'belt-blue' : 'belt-green');
    else if (cell.k === 'gear') add('gear');
    else if (cell.k === 'pit') add('pit');
    else if (cell.k === 'battery') add('battery');
    if (course.boards[cell.b]?.dock) add('dock');
  }
  return out;
}

/** Topic ids the code may ask for besides the static ones: every card type and upgrade has a topic. */
export function allTopicIds() {
  return Object.keys(TOPICS);
}

export { isHaywire };
