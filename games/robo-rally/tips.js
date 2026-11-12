// What the phone's coach says, and when (coach.js shows it): one short sentence at a time, at the moment it is
// useful, pointing at the thing it is about. Tips are on until the player turns them off (Help), and each is said
// once per phone. Also here: what could go wrong with a planned line because the board isn't empty (planRisks).
// No DOM here, so tests can read it.
//   tip: { id, step (one of the steps of a first program: they follow each other; of the rest, no more than two
//          come up on one screen), on: [screens], when(s, seen), say, at (a selector for what it points at, or
//          several: the first that's there; none: the top of the screen), side: 'above' | 'below' | 'inside',
//          more (the Help topic that says the rest), ms (it goes by itself after this long; otherwise when what
//          it asks for is done, or on a tap) }
//   s (the situation, from the screen): { screen: 'drive' | 'program' | 'run' | 'shop', round, placed (slots I
//      filled), moved (my line leaves my square), full, done (locked in), running, level (drills done),
//      veteran (this phone raced before today), has: { spam, again, haywire, reboot, timerLow, fallen, arm, hit } }
import { beamPath } from './board.js';

const planning = (s) => !s.done && !s.running;
// the first program, wherever it happens: the test drive, or round 1 for a phone that skipped it
const first = (s) => s.screen === 'drive' || !s.veteran;

export const TIPS = [
  // ----- the first program: four steps -----
  { step: true, id: 'card', on: ['drive', 'program'], when: (s) => first(s) && planning(s) && s.placed === 0, say: 'Tap a card. It goes in slot 1.', at: ['.pl-hand .pl-card.hint', '.pl-hand .pl-card:not(.used)'], side: 'above' },
  { step: true, id: 'line', on: ['drive', 'program'], when: (s) => first(s) && planning(s) && s.moved && !s.full, say: 'This line is where your robot will go.', at: '.pl-map', side: 'inside', ms: 4000 },
  { step: true, id: 'five', on: ['drive', 'program'], when: (s) => first(s) && planning(s) && s.placed >= 2 && !s.full, say: 'Fill all five. Slot 1 runs first.', at: '.pl-slot.target', side: 'below' },
  { step: true, id: 'lock', on: ['drive', 'program'], when: (s) => first(s) && planning(s) && s.full, say: 'Lock in when the line looks right.', at: '.pl-lock', side: 'above' },
  // ----- the test drive's second and third courses: one thing each -----
  { id: 'own-left', on: ['drive'], when: (s) => planning(s) && s.level === 1 && s.placed === 0, say: 'Left and right are the robot’s own. Trust the line.', at: '.pl-map', side: 'inside' },
  { id: 'floor', on: ['drive'], when: (s) => planning(s) && s.level === 2 && s.placed === 0, say: 'A belt carries you after every card. The line shows it.', at: '.pl-map', side: 'inside' },
  // ----- the first race -----
  { id: 'watch', on: ['run'], when: (s) => !s.veteran && !s.has.fallen, say: 'Look up. Your robot runs the cards by itself.', at: '.pl-look-box', side: 'inside', ms: 7000 },
  // ----- the first time each of these comes up: what needs doing now first -----
  { id: 'reboot', on: ['program'], when: (s) => planning(s) && s.has.reboot, say: 'You fell. Pick which way to face when you come back.', at: '.pl-reboot', side: 'below', more: 'reboot-dir' },
  { id: 'haywire', on: ['program'], when: (s) => planning(s) && s.has.haywire, say: 'A hit jammed this slot. It runs this round. Fill the others.', at: '.pl-slot.locked', side: 'below', more: 'haywire-slot' },
  { id: 'timer', on: ['program'], when: (s) => planning(s) && s.has.timerLow && !s.full, say: 'At zero, empty slots get random cards.', at: '[data-ask="timer"]', side: 'below', more: 'timer' },
  { id: 'others', on: ['program'], when: (s) => planning(s) && s.round >= 2, say: 'The line shows only you. Other robots can shove you off it.', at: '.pl-map', side: 'inside', ms: 9000 },
  { id: 'spam', on: ['program'], when: (s) => planning(s) && s.has.spam, say: 'Junk from a hit. Put it in a slot to get rid of it.', at: '.pl-hand [data-ask="sp"]:not(.used)', side: 'above', more: 'sp' },
  { id: 'again', on: ['program'], when: (s) => planning(s) && s.has.again, say: '×2 repeats the slot before it.', at: '.pl-hand [data-ask="ag"]:not(.used)', side: 'above', more: 'ag' },
  { id: 'tips', on: ['program'], when: (s, seen) => planning(s) && s.round >= 2 && seen.has('others'), say: 'Tips come up when something is new. Turn them off here.', at: '[data-guide="ask"]', side: 'below', ms: 8000 },
  { id: 'shop', on: ['shop'], when: (s) => !s.done, say: 'Upgrades are optional. Tap the tick when you’re done.', at: '.pl-energy', side: 'below', more: 'shop' },
  { id: 'fallen', on: ['run'], when: (s) => s.has.fallen, say: 'You fell. You’re back next round, with two junk cards.', at: '.pl-look-box', side: 'inside', more: 'fall', ms: 9000 },
  { id: 'hit', on: ['run'], when: (s) => s.has.hit, say: 'You were hit. Damage is junk cards in your deck.', at: '.pl-deckstack', side: 'above', more: 'damage', ms: 7000 },
  { id: 'arm', on: ['run'], when: (s) => s.has.arm, say: 'Tap to arm it. Your phone asks before your next card.', at: '.pl-arm', side: 'above', more: 'arm' },
];
/** The four steps of a first program: a phone that has raced before doesn't need them (or to be told to look up). */
export const BASICS = ['card', 'line', 'five', 'lock', 'watch'];

const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

/**
 * What could go wrong with a planned line because of what else is on the board. The line (minimap.js,
 * previewProgram) is one robot alone; this reads it against the other robots where they stand now and against
 * the wall lasers. ghosts: the line; others: [{ id, x, y, on }] (not me). Returns the worst first:
 *   { kind: 'block', by, n, x, y }   a robot stands on a square my slot n drives through (x, y: that robot)
 *   { kind: 'laser', n, x, y }       slot n ends in a wall laser's beam (x, y: where I'd stop)
 *   { kind: 'near', by, n, x, y }    in slot 1 or 2 I pass within two squares of a robot (x, y: that robot)
 * One per robot (the worst), and one laser (the first).
 */
export function planRisks(course, ghosts, others) {
  const robots = (others ?? []).filter((r) => r.x != null && r.on !== false);
  const out = [];
  const taken = new Set(); // robots already warned about
  const beams = (course.lasers ?? []).flatMap((L) => beamPath(course, L.x, L.y, L.d));
  for (const gh of ghosts ?? []) {
    if (gh.unknown) break;
    const entered = (gh.path ?? []).slice(1);
    for (const [x, y] of entered) {
      const r = robots.find((q) => q.x === x && q.y === y && !taken.has(q.id));
      if (!r) continue;
      taken.add(r.id);
      out.push({ kind: 'block', by: r.id, n: gh.n, x: r.x, y: r.y });
    }
    if (gh.fell) break;
    if (!out.some((r) => r.kind === 'laser') && beams.some((p) => p.x === gh.x && p.y === gh.y)) out.push({ kind: 'laser', n: gh.n, x: gh.x, y: gh.y });
    if (gh.n > 2) continue;
    for (const r of robots) {
      if (taken.has(r.id)) continue;
      if (![...entered, [gh.x, gh.y]].some(([x, y]) => dist(x, y, r.x, r.y) <= 2)) continue;
      taken.add(r.id);
      out.push({ kind: 'near', by: r.id, n: gh.n, x: r.x, y: r.y });
    }
  }
  const rank = { block: 0, laser: 1, near: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.n - b.n);
}

/** One risk in a few words (name: the robot's name). */
export function riskText(risk, name = 'A robot') {
  if (risk.kind === 'block') return `${name} is in your way`;
  if (risk.kind === 'laser') return 'You stop in a laser: 1 junk card';
  return `${name} is close. You may be shoved or shot`;
}
