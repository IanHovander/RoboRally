// What the phone's Guide knows: every "?" topic (a picture, 1-3 looping clips, one sentence that says it),
// the Book's subjects, and what's on a square of the map. No DOM here, so tests can read it.
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

const MOVE_FINE = (n) => `Forward ${n}. You shove any robot in the way. Only a wall stops you.`;
const TURN_FINE = (side) => `Turn to the robot’s own ${side}, without moving. If unsure, check the line.`;

/** The hand-written topics. Upgrades and Haywires are added below, from cards.js. */
export const TOPICS = {
  // ----- goal -----
  goal: { sec: 'goal', pic: { g: 'flag' }, clips: [['goal-flags', 'In order'], ['flag-stop', 'Stop on it']], fine: 'Touch the flags in order. End a slot on a flag for it to count. First to the last flag wins.' },
  flag: { sec: 'goal', pic: { cell: 'flag' }, clips: [['flag-stop', 'Stop on it'], ['goal-flags', 'In order']], fine: 'A flag. Take them in number order. The rings at its foot show who has it.' },
  // the ending: where you came, the awards, and racing again
  place: { sec: 'goal', pic: { g: 'flag' }, clips: [], cap: 'Your place', fine: 'Where you finished. Most flags first; level on flags, whoever is nearer their next one.' },
  'award-shove': { sec: 'goal', pic: { g: 'star' }, clips: [['award-shove', 'Most shoves']], fine: 'An award: you shoved more robots than anyone else this race.' },
  'award-zap': { sec: 'goal', pic: { g: 'star' }, clips: [['award-zap', 'Most laser hits']], fine: 'An award: your laser hit other robots more often than anyone else’s.' },
  'award-doom': { sec: 'goal', pic: { g: 'star' }, clips: [['award-doom', 'Most pushed off']], fine: 'An award: you pushed more robots into a pit or off the edge than anyone else.' },
  'award-fall': { sec: 'goal', pic: { g: 'star' }, clips: [['award-fall', 'Most falls']], fine: 'An award: you fell into a pit or off the edge more often than anyone else.' },
  nemesis: { sec: 'goal', pic: { robot: true }, clips: [], cap: 'Your nemesis', fine: 'The robot that pushed you into a pit or off the edge the most, and how many times.' },
  rematch: { sec: 'goal', pic: { g: 'rematch' }, clips: [], cap: 'Race again', fine: 'Same players, map and options. Whoever finished last starts nearest flag 1.' },
  // ----- program -----
  slots: { sec: 'program', pic: { slots: true }, clips: [['program-fill', 'Fill five']], fine: 'Tap a card to fill the next slot. Slot 1 runs first. Tap a slot to take its card back.' },
  line: { sec: 'program', pic: { line: true }, clips: [['line-preview', 'Where you’ll go'], ['line-bumped', 'Robots change it']], fine: 'Where your cards take you if no other robot interferes. ✕ marks a fall. ? marks a slot nobody can predict.' },
  lock: { sec: 'program', pic: { g: 'check', lockAnim: true }, clips: [], cap: 'Lock in', fine: 'Lock in when all five slots are full. Tap again to change your cards, until everyone has locked in.' },
  clear: { sec: 'program', pic: { g: 'undo' }, clips: [['clear', 'All back']], fine: 'Takes all your cards back.' },
  timer: { sec: 'program', pic: { g: 'timer' }, clips: [['timeout', 'At zero']], fine: 'At zero, empty slots are filled with random cards from your hand. Cards you placed stay.' },
  me: { sec: 'program', pic: { me: true }, clips: [['facing', 'Your front']], fine: 'Your robot has the white outline. Its pointed end is the front. The map is the big screen from above.' },
  deck: { sec: 'program', pic: { g: 'deck' }, clips: [], cap: 'Your deck', fine: 'The cards you draw from. Tap it to see what is left. When it runs out, your used cards are shuffled back in.' },
  discard: { sec: 'program', pic: { card: 'back' }, clips: [], cap: 'Discard pile', fine: 'Cards you have used. They are shuffled back into your deck when it runs out.' },
  // ----- cards -----
  m1: { sec: 'cards', pic: { card: 'm1' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(1) },
  m2: { sec: 'cards', pic: { card: 'm2' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(2) },
  m3: { sec: 'cards', pic: { card: 'm3' }, clips: [['card-move', 'Forward'], ['push', 'Into a robot']], fine: MOVE_FINE(3) },
  bk: { sec: 'cards', pic: { card: 'bk' }, clips: [['card-bk', 'No turn']], fine: 'Back one square. You keep facing the same way.' },
  rr: { sec: 'cards', pic: { card: 'rr' }, clips: [['card-turn', 'Stays put'], ['turn-own-left', 'Whose left?']], fine: TURN_FINE('right') },
  rl: { sec: 'cards', pic: { card: 'rl' }, clips: [['turn-own-left', 'Whose left?'], ['card-turn', 'Stays put']], fine: TURN_FINE('left') },
  ut: { sec: 'cards', pic: { card: 'ut' }, clips: [['card-ut', 'Turn around']], fine: 'Turn to face the other way, without moving.' },
  pu: { sec: 'cards', pic: { card: 'pu' }, clips: [['card-pu', 'Energy']], fine: 'Gain 1 energy. You don’t move. With upgrades off, this card isn’t in the deck.' },
  ag: { sec: 'cards', pic: { card: 'ag' }, clips: [['again', 'Repeat'], ['again-first', 'In slot 1']], fine: 'Does the slot before it again. In slot 1 there is nothing to repeat, so it runs a random card.' },
  // ----- order -----
  registers: { sec: 'order', pic: { strip: true }, clips: [['order-registers', 'Slot by slot']], fine: 'Every robot runs slot 1. Then belts, gears and lasers act. Then every robot runs slot 2, and so on.' },
  priority: { sec: 'order', pic: { badge: '1' }, clips: [['order-priority', 'Who’s first']], fine: 'The robot marked 1 moves first in every slot this round, then the others in seat order. The mark moves on each round.' },
  'look-up': { sec: 'order', pic: { g: 'eye' }, clips: [['order-registers', 'Look up']], fine: 'Your robot runs your cards by itself. Watch the big screen. The lit slot is the one running now.' },
  watch: { sec: 'order', pic: { g: 'eye' }, clips: [['order-registers', 'Look up']], fine: 'Look at the big screen. If the race had already begun when you joined, you are in the next one.' },
  // ----- board -----
  'belt-green': { sec: 'board', pic: { cell: 'belt-green' }, clips: [['belt-green', 'One a slot'], ['belt-curve', 'Curves']], fine: 'Moves you 1 square after every slot. A curve turns you only if the belt carries you round it.' },
  'belt-blue': { sec: 'board', pic: { cell: 'belt-blue' }, clips: [['belt-blue', 'Two a slot']], fine: 'Moves you 2 squares after every slot.' },
  gear: { sec: 'board', pic: { cell: 'gear' }, clips: [['gear', 'Turns you']], fine: 'Green turns you right, red turns you left, after every slot you end on it.' },
  pusher: { sec: 'board', pic: { cell: 'pusher' }, clips: [['pusher', 'Lit slots only']], fine: 'Shoves you one square the way its arrow points, but only after the slots whose dots are lit.' },
  pit: { sec: 'board', pic: { cell: 'pit' }, clips: [['reboot', 'In it goes']], fine: 'Drive in or get pushed in, and you fall.' },
  edge: { sec: 'board', pic: { g: 'edge' }, clips: [['edge', 'Off the edge']], fine: 'Going off the edge is a fall too, unless Map perimeter is on.' },
  wall: { sec: 'board', pic: { g: 'wall' }, clips: [['wall', 'Stops you'], ['wall-laser', 'Stops lasers']], fine: 'A wall stops robots, shoves and lasers. Driving into one does no damage.' },
  'board-laser': { sec: 'board', pic: { cell: 'laser' }, clips: [['board-laser', 'First robot only']], fine: 'Fires after every slot and hits the first robot in its line: 1 junk card. A double laser gives 2.' },
  'double-laser': { sec: 'board', long: true, pic: { cell: 'laser' }, clips: [['board-laser', 'First robot only']], cap: 'Double laser', fine: 'Two beams, so double the damage. It fires after every slot and hits the first robot in its line with 2 junk cards. Walls and robots block it.' },
  battery: { sec: 'board', pic: { cell: 'battery' }, clips: [['battery', 'Every slot']], fine: 'End a slot here for 1 energy. Stay, and you get 1 more after the next slot.' },
  dock: { sec: 'board', pic: { cell: 'dock' }, clips: [['battery', 'Batteries too']], fine: 'Where everyone starts. If you fall from inside its dashed edge, you come back on your start pad.' },
  pad: { sec: 'board', pic: { cell: 'pad' }, clips: [['facing', 'Your front']], fine: 'Your start pad, drawn from those nearest flag 1. In a rematch, last place gets the nearest. Fall on the dock and you return here.' },
  // ----- robots -----
  robot: { sec: 'robots', pic: { robot: true }, clips: [['push', 'Shove'], ['robot-laser', 'Laser']], fine: 'Another robot. Its cards are secret. Robots shove and shoot each other, but nobody is ever knocked out of the race.' },
  rival: { sec: 'robots', pic: { robot: true }, clips: [], cap: 'Look closer', fine: 'Tap a robot on your map to see its flags, energy and upgrades. Its cards stay secret.' },
  decide: { sec: 'robots', pic: { robot: true, dots: true }, clips: [], cap: 'Choosing', fine: 'That player has a choice to make on their phone. The race waits up to 12 seconds.' },
  // ----- damage -----
  sp: { sec: 'damage', name: 'SPAM', pic: { card: 'sp' }, clips: [['damage-spam', 'Where from'], ['spam-play', 'Play it?']], fine: 'Junk from being hit. Play it and it is gone for good, but that slot runs a random card. Unplayed, it stays in your hand.' },
  'haywire-slot': { sec: 'damage', name: 'Haywire', pic: { card: 'hw', slot: true }, clips: [['damage-haywire', 'Jammed slot']], fine: 'A hit jammed this slot with a Haywire card. It runs here this round and can’t be moved. Fill the other slots.' },
  'spam-count': { sec: 'damage', pic: { stack: true }, clips: [['damage-spam', 'Junk cards']], fine: 'All the junk cards you own: in your hand, your deck and your used cards.' },
  damage: { sec: 'damage', pic: { pair: ['sp', 'hw'] }, clips: [['damage-cards', 'No health'], ['shutdown', 'Clear it']], fine: 'There is no health. Damage is junk cards. Get rid of them by playing them, or by shutting down for a round.' },
  // ----- falling -----
  fall: { sec: 'falling', pic: { g: 'reboot' }, clips: [['reboot', 'Pit'], ['edge', 'Edge']], fine: 'You sit out the rest of the round and take 2 junk cards. Next round you return on the blue ring. You keep your flags.' },
  'reboot-ring': { sec: 'falling', long: true, name: 'Respawn point', pic: { cell: 'reboot' }, clips: [['reboot', 'Back here']], fine: 'Where you come back after a fall, facing its arrow. If there are several, it is the one whose blue area you fell in. Yours glows in your color.' },
  'reboot-dir': { sec: 'falling', pic: { arrows: true }, clips: [['reboot-face', 'Pick a way']], fine: 'Choose which way you’ll face when you come back.' },
  // ----- shutdown -----
  shutdown: { sec: 'shutdown', pic: { g: 'power' }, clips: [['shutdown', 'Sit out']], fine: 'Skip a round to clear your junk: every junk card in your hand, slots and used cards goes. Robots can still shove and shoot you.' },
  // ----- energy -----
  energy: { sec: 'energy', pic: { g: 'bolt' }, clips: [['upgrades', 'Earn, spend'], ['battery', 'Batteries']], fine: 'Energy buys upgrades. You get it from batteries and the Power Up card. You can hold 10.' },
  shop: { sec: 'energy', pic: { g: 'shop' }, clips: [['upgrades', 'Earn, spend']], fine: 'Optional, from round 2. Tap + to draw an upgrade for 1 energy. Tap one to install it at its price. Only installed upgrades work.' },
  draw: { sec: 'energy', pic: { g: 'plus' }, clips: [['upgrades', 'Draw one']], fine: 'Draws a random upgrade into your collection. It isn’t installed yet.' },
  kind: { sec: 'energy', pic: { kind: true }, clips: [], cap: 'Kept or once', fine: '∞ stays on for the whole race. 1× works once, then it is gone. You can hold 3 of each.' },
  arm: { sec: 'energy', pic: { g: 'play', arm: true }, clips: [['boink', 'Arm, then use']], fine: 'Tap it during the race to arm it. At your next turn your phone asks before your card runs.' },
  'your-upgrades': { sec: 'energy', pic: { up: true }, clips: [], cap: 'Yours', fine: '' }, // filled in from what you have installed
  // ----- options (the leader's toggles) -----
  start: { sec: 'options', pic: { g: 'play' }, clips: [], cap: 'Start', fine: 'Starts the race: everyone is given a start pad, at random. Nobody can join once it has begun.' },
  course: { sec: 'options', pic: { course: true }, clips: [], cap: 'Course', fine: 'The bars show how hard the map is. The flag number is how many flags it has: more flags, a longer race.' },
  'opt-upgrades': { sec: 'options', pic: { g: 'bolt' }, clips: [['upgrades', 'Upgrades']], fine: 'Off: no shop and no energy. Batteries do nothing and Power Up leaves the deck. A simpler game.' },
  'opt-safe': { sec: 'options', name: 'Map perimeter', pic: { g: 'wall' }, clips: [['safe-edges', 'Map perimeter']], fine: 'A wall all the way round the map, so nobody goes off the edge. Pits are still pits.' },
  'opt-lessspam': { sec: 'options', name: 'Spam in hand discards', pic: { card: 'sp' }, clips: [['less-spam', 'Spam in hand discards']], fine: 'Each round, when you lock in, any junk left in your hand goes to your used cards instead of staying.' },
  'opt-brief': { sec: 'options', name: 'Rules tutorial', pic: { g: 'tutorial' }, clips: [], cap: 'Rules tutorial', fine: 'On: the full narrated rules before round 1, for everyone. Off: a short reel and a test drive, when someone is new.' },
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
const HIDDEN_IN_BOOK = new Set(['your-upgrades', 'deck', 'discard', 'decide', 'watch', 'start', 'course', 'lock', 'kind', 'look-up', 'place', 'award-shove', 'award-zap', 'award-doom', 'award-fall', 'nemesis', 'rematch']);

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
