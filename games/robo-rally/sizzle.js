// The sizzle reel: 23.5 seconds on the big screen that make a room want to pick up their phones, and plant the
// three things a newcomer must know before round 1, in this order:
//   (a) your phone programs your robot: five cards, and they run in order;
//   (b) every robot runs at once, so they collide: shoves, lasers, pits;
//   (c) touch the flags in order; first to the last one wins.
// Everything else is taught later, in play (the test drive, the first-time callouts, Help).
//
// It is cut like a trailer: a cold open on a robot shoved into a pit, the phone, four quick shots of robots meeting
// (a crossfire, a shove, a belt into a pit, a chain off the edge), the flags and a win, the title. Every robot on
// screen is run by the real rules (lessons.js's runLesson, on tiny courses made here), wearing the racers' colors.
//
// Words: Floor Control says four lines it already has recordings of. A line that can't be heard (sound off or
// locked, the reel paused or sought) is two or three words on the glass instead, as the game's subtitles are
// (the line over the shoves and falls has none: those shots are what it says). The only words that are always
// on the glass are ALL AT ONCE, which no recorded line says, and the title.
//
// ONE timeline. sizzlePlan() lays the whole reel out as plain data: cues at fixed times (ms) and a few tracks
// that are pure functions of the time. startSizzle() plays that plan on the host's arena, and can seek to any
// time: it rebuilds the shot under that moment from its cut and runs the arena forward to it by hand, at once,
// with nothing drawn and nothing heard. So the frame at 8000 ms is the same frame every time, which is how the
// reel is checked (public/dev-sizzle.html?t=8000). While it has the arena it also owns the arena's clock; stop()
// gives everything back. Storyboard and how to hook it in: docs/teaching/sizzle.md.
import { LESSONS, runLesson } from './lessons.js';
import { cardSvgHtml } from './glyphs.js';
import { sfx } from './sound.js';

// ---------------------------------------------------------------------------------------------
// The scenes: tiny courses in lessons.js's notation, each written for one moment
// ---------------------------------------------------------------------------------------------

const empty = (w, h) => Array.from({ length: h }, () => Array(w).fill('..').join(' '));
const FILL = ['rl', 'rr', 'rl', 'rr']; // (the slots a shot never reaches)
// (No reboot rings on these boards: the reel never shows a robot coming back, and a ring is one more thing unexplained.)

export const SCENES = {
  // the cold open: a run-up of two squares, a shove, a pit
  pit: {
    id: 'sz-pit',
    grid: ['.. .. .. .. .. ..', '.. .. .. .. XX ..', '.. .. .. .. .. ..'],
    robots: [[0, 1, 'E'], [3, 1, 'N']],
    damage: ['sp', 'sp'],
    rounds: [[['m3', ...FILL], ['rl', ...FILL]]],
    stopAt: { reg: 2 },
  },
  // two robots turn to face the middle; a third steps between them, and both fire
  laser: {
    id: 'sz-laser',
    grid: empty(5, 3),
    robots: [[0, 1, 'N'], [4, 1, 'N'], [2, 2, 'N']],
    damage: ['sp', 'sp', 'sp', 'sp'],
    rounds: [[['rr', ...FILL], ['rl', ...FILL], ['m1', ...FILL]]],
    stopAt: { reg: 2 },
  },
  // four robots, four cards, one moment: two drive clear, the third drives into the fourth
  shove: {
    id: 'sz-shove',
    grid: empty(6, 4),
    robots: [[0, 3, 'N'], [5, 0, 'S'], [1, 2, 'E'], [3, 2, 'N']],
    damage: ['sp', 'sp', 'sp', 'sp'],
    rounds: [[['m2', ...FILL], ['m2', ...FILL], ['m2', ...FILL], ['m1', ...FILL]]],
    stopAt: { reg: 2 },
  },
  // one step toward a flag, onto a belt; the belt carries it sideways into a pit
  belt: {
    id: 'sz-belt',
    grid: ['.. .. .. .. ..', '.. g> g> XX ..', '.. .. .. .. ..'],
    flags: [[2, 0]],
    robots: [[2, 2, 'N']],
    damage: ['sp', 'sp'],
    rounds: [[['m1', 'm1', 'rl', 'rl', 'rl']]],
    stopAt: { reg: 2 },
  },
  // a chain: one robot drives three, the two in front of it slide, the front one goes off the edge
  edge: {
    id: 'sz-edge',
    grid: empty(5, 3),
    robots: [[0, 1, 'E'], [2, 1, 'N'], [3, 1, 'S']],
    damage: ['sp', 'sp'],
    rounds: [[['m3', ...FILL], ['rl', ...FILL], ['rr', ...FILL]]],
    stopAt: { reg: 2 },
  },
  // three flags in a row, taken one a slot; a rival steps into the lane before the last and is shoved past it
  flags: {
    id: 'sz-flags',
    grid: empty(8, 3),
    flags: [[2, 1], [4, 1], [6, 1]],
    robots: [[5, 2, 'N'], [0, 1, 'E']],
    damage: ['sp', 'sp', 'sp', 'sp'],
    rounds: [[['rl', 'rr', 'm1', 'rl', 'rl'], ['m2', 'm2', 'm2', 'rl', 'rl']]],
  },
};

// the runs, worked out once (the same seed every time, so the reel is the same every time)
let RUNS = null;
const runs = () =>
  (RUNS ??= {
    program: runLesson(LESSONS[0], 11), // lessons.js's first scene: five cards to a flag
    ...Object.fromEntries(Object.entries(SCENES).map(([k, def]) => [k, runLesson(def, 11)])),
  });

// ---------------------------------------------------------------------------------------------
// The plan: the whole reel as data
// ---------------------------------------------------------------------------------------------

/** When each shot starts (ms). The cuts sit on a 250 ms grid: the sounds on them are the reel's beat. */
export const AT = { open: 0, phone: 3000, laser: 9000, shove: 10250, belt: 11500, edge: 12500, flags: 14750, title: 20500, end: 23500 };

/** The narrator's lines (recorded already: voice/clips.json). */
export const LINES = {
  phone: { text: 'Each round, your phone deals cards. Fill five slots.', id: 'brief-5' },
  meet: { text: 'Robots shove. Into pits. Off the edge.', id: 'brief-11' },
  flags: { text: 'Objective: the flags, in order.', id: 'brief-3' },
  win: { text: 'First to the last flag wins.', id: 'brief-3-end' },
};

/**
 * Which racer plays which robot of a scene: robot i wears racer (i + shift)'s colors (in seat order). With four
 * racers: the first shoves the second into the pit; the third's phone drives it to a flag; the second and third
 * shoot the fourth; the fourth shoves the first; the belt takes the third; the first goes off the edge; and the
 * second, who went down the pit at the start, takes the last flag. With five or more, everyone gets on screen.
 */
const SHIFT = { pit: 0, program: 2, laser: 1, shove: 1, belt: 2, edge: 2, flags: 0 };
const SHIFT_MANY = { pit: 0, program: 2, laser: 3, shove: 5, belt: 2, edge: 4, flags: 0 };

/** The robots a beat moves, turns, hits or drops. */
const touched = (b) => [...new Set(b.fx.flatMap((f) => [f.id, ...(f.ids ?? []), ...(f.hit ?? []), /^L\d+$/.test(f.src ?? '') ? f.src : null]).filter(Boolean))];
const isReveal = (st) => st.kind === 'beat' && st.beat.what?.k === 'reveal';
const hasFx = (st, k) => st.kind === 'beat' && st.beat.fx.some((f) => f.k === k);

/**
 * Lay steps [from, to) of a run on the plan, from t (ms). Told as a trailer tells it: turning the cards over is a
 * breath; a robot's card shows over it as it goes (not before); and robots that don't touch each other set off
 * `stagger` ms apart instead of waiting their turn, still in the order the rules play them. The board's own
 * moves (belts, lasers, flags) wait for everyone, as they do in the game.
 *   tempo      how fast the arena's time runs in this shot (a beat lasts its dur / tempo)
 *   hold       { step: ms } a beat held longer or shorter than that
 *   skip       steps left out (a volley of lasers between two things the shot is about)
 *   strip      effects left out of every beat ('win': the phone shot's flag is a flag, not the race)
 *   until      nothing is laid at or after this time (the next shot's cut)
 * Returns { end, reveals: [[t, reg]], starts: { step: t } }.
 */
function lay(P, t, scene, o = {}) {
  const run = P.R[scene];
  const { from = 1, to = run.steps.length, tempo = 1.6, reveal = 180, stagger = 110, hold = {}, skip = [], strip = [], until = Infinity } = o;
  const busy = new Map();
  const free = () => Math.max(t, ...busy.values());
  const put = (c) => c.t < until && P.cues.push(c);
  const reveals = [];
  const starts = {};
  let last = -Infinity;
  let play = null;
  let lastBeat = null;
  for (let i = from; i < to; i++) {
    const st = run.steps[i];
    if (st.kind !== 'beat' || skip.includes(i)) continue;
    const b = st.beat;
    if (isReveal(st)) {
      const at = free();
      put({ t: at, k: 'reveal', scene, i });
      reveals.push([at, st.reg]);
      starts[i] = at;
      t = at + reveal;
      busy.clear();
      last = -Infinity;
      continue;
    }
    if (b.fx.length && b.fx.every((f) => f.k === 'play')) {
      play = i; // (it rides on the beat it announces)
      continue;
    }
    const ids = touched(b);
    const card = b.what?.k === 'card';
    const start = card ? Math.max(t, last + stagger, ...ids.map((id) => busy.get(id) ?? 0)) : free();
    const len = hold[i] ?? b.dur / tempo;
    put({ t: start, k: 'beat', scene, i, play, strip });
    play = null;
    starts[i] = start;
    last = start;
    lastBeat = i;
    for (const id of ids) busy.set(id, start + len);
    if (!card) t = start + len;
  }
  const end = free();
  if (lastBeat != null) put({ t: Math.min(end, until - 1), k: 'sync', scene, i: lastBeat });
  return { end, reveals, starts };
}

/**
 * The reel, laid out: { duration, shots: [{ name, t0, t1 }], cues: [{ t, k, ... }] in order, words, phone, regs, R }.
 * Cues (k): cut (a shot starts: its board and robots, as they stand), reveal, beat, sync (the rules' steps),
 * line / unline (the phone shot's line of light), tempo, spot (the camera leans in on a space), snd (a sound.js
 * chime), vo (a narrator's line).
 * No DOM and no arena here: test scripts and the storyboard read it as it is.
 */
export function sizzlePlan() {
  const R = runs();
  const P = { R, duration: AT.end, shots: [], cues: [], words: [], phone: null, regs: [] };
  const shot = (name, t0, cut = {}) => {
    P.shots.push({ name, t0 });
    P.cues.push({ t: t0, k: 'cut', name, ...cut });
  };
  const snd = (t, s, ...a) => P.cues.push({ t, k: 'snd', s, a });
  const vo = (t, key, chirp = false) => P.cues.push({ t, k: 'vo', key, chirp });
  // words on the glass: for a line of the narrator's (key), only when that line isn't heard; with no key, always
  const word = (t0, t1, text, key = null) => P.words.push({ t0, t1, text, key });
  const cueAt = (t, k, rest = {}) => P.cues.push({ t, k, ...rest });
  const step = (scene, pred) => R[scene].steps.findIndex(pred);

  // 1. Cold open. No card turned over, no number, nothing explained: a robot charges, another goes down a pit.
  shot('open', AT.open, { scene: 'pit', frame: 'wide', tempo: 1.3 });
  snd(AT.open + 260, 'note', 0, 0.1);
  lay(P, AT.open + 300, 'pit', { from: 2, to: 4, tempo: 1.3, hold: { 3: 2600 }, until: AT.phone });

  // 2. The phone. Five cards drop into five slots (a note each, a line of light growing on the glass); it locks;
  //    the robot runs them, the lit slot and the 1-5 strip walking along with it, onto the flag.
  {
    const t0 = AT.phone;
    const types = R.program.steps[0].cards[0];
    shot('phone', t0, { scene: 'program', frame: 'phone', tempo: 2.3, calm: true, phone: true });
    snd(t0, 'round');
    vo(t0 + 150, 'phone', true);
    word(t0 + 300, t0 + 2300, 'Your phone', 'phone');
    const fills = types.map((_, k) => t0 + 2400 + k * 170);
    fills.forEach((t, k) => {
      P.cues.push({ t, k: 'line', n: k + 1 });
      snd(t, 'note', k, 0.13);
    });
    const lock = fills.at(-1) + 240;
    const go = lock + 200;
    snd(lock, 'ready', 0);
    snd(go, 'go');
    const flag = step('program', (st) => hasFx(st, 'cp'));
    const ran = lay(P, go + 40, 'program', { from: 1, tempo: 2.3, reveal: 50, strip: ['win'], hold: { [flag]: 900 }, until: AT.laser });
    for (const [t] of ran.reveals) snd(t, 'tick');
    P.cues.push({ t: ran.starts[flag], k: 'unline' });
    P.phone = { t0, t1: AT.laser, types, deal: t0 + 800, fills, lock, go, lit: ran.reveals };
    P.regs.push(...ran.reveals, [AT.laser, null]);
  }

  // 3-6. Everyone at once. Four quick shots; the last, the fall off the edge, is held.
  //    A tick on every eighth note runs under them, and each cut lands on a note a step higher.
  for (let t = AT.laser; t < AT.flags; t += 250) snd(t, 'tick', t % 500 === 0);
  shot('laser', AT.laser, { scene: 'laser', frame: 'wide', tempo: 1.7 });
  snd(AT.laser, 'note', 2, 0.12);
  word(AT.laser + 100, AT.shove - 50, 'All at once'); // (no recorded line says it, and it is the rule the game turns on)
  lay(P, AT.laser + 60, 'laser', { tempo: 1.7, to: step('laser', (st) => hasFx(st, 'beam')) + 1, until: AT.shove });

  shot('shove', AT.shove, { scene: 'shove', frame: 'wide', tempo: 1.7 });
  snd(AT.shove, 'note', 3, 0.12);
  vo(AT.shove + 150, 'meet'); // "Robots shove." on this shot, "Into pits." on the next, "Off the edge." on the third
  // (unheard, that line has no words standing in for it: the three shots are what it says)
  lay(P, AT.shove + 50, 'shove', { tempo: 1.7, to: step('shove', (st) => hasFx(st, 'beam')), until: AT.belt });

  shot('belt', AT.belt, { scene: 'belt', frame: 'wide', tempo: 2 });
  snd(AT.belt, 'note', 4, 0.12);
  lay(P, AT.belt + 40, 'belt', { from: 2, to: step('belt', (st) => hasFx(st, 'fall')) + 1, tempo: 2, until: AT.edge });

  shot('edge', AT.edge, { scene: 'edge', frame: 'wide', tempo: 1.35 });
  snd(AT.edge, 'note', 6, 0.12);
  lay(P, AT.edge + 60, 'edge', { from: 2, to: 4, tempo: 1.35, hold: { 3: 2200 }, until: AT.flags });

  // 7. The flags, in order, and the win. One board, no cut: flag 1, flag 2, then a rival in the way of flag 3.
  {
    const t0 = AT.flags;
    const run = R.flags;
    const cps = run.steps.map((st, i) => (hasFx(st, 'cp') ? i : -1)).filter((i) => i >= 0);
    const win = step('flags', (st) => hasFx(st, 'win'));
    const lasers = run.steps.map((st, i) => (hasFx(st, 'beam') ? i : -1)).filter((i) => i >= 0);
    shot('flags', t0, { scene: 'flags', frame: 'wide', tempo: 1.9, calm: true }); // (calm: the board stays whole in the frame)
    snd(t0, 'note', 4, 0.12);
    vo(t0 + 150, 'flags');
    vo(t0 + 2550, 'win');
    word(t0 + 300, t0 + 2300, 'Flags in order', 'flags');
    word(t0 + 2650, t0 + 5150, 'Last flag wins', 'win');
    const hold = Object.fromEntries(cps.map((i) => [i, i === win ? 3000 : 480]));
    const ran = lay(P, t0 + 50, 'flags', { tempo: 1.9, to: win + 1, skip: lasers, hold, until: AT.title });
    // the win: the scene's time back to its own pace (the pillar of light stands its full time), the camera leaning in
    const last = run.course.checkpoints.at(-1);
    cueAt(ran.starts[win], 'tempo', { v: 1 });
    cueAt(ran.starts[win], 'spot', { x: last.x, y: last.y, hold: 1.7, zoom: 0.3 });
  }

  // 8. The title, on black.
  shot('title', AT.title);
  snd(AT.title + 100, 'round');

  P.cues.forEach((c, k) => (c.seq = k));
  P.cues.sort((a, b) => a.t - b.t || (b.k === 'cut') - (a.k === 'cut') || a.seq - b.seq);
  P.shots.forEach((s, i) => (s.t1 = P.shots[i + 1]?.t0 ?? P.duration));
  return P;
}

// ---------------------------------------------------------------------------------------------
// Playing it
// ---------------------------------------------------------------------------------------------

const PALETTE = ['#ff4d6d', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b', '#22d3ee', '#f783ac'];
const DECOYS = ['bk', 'ut', 'm1', 'rr'];
const HAND_ORDER = [3, 0, 5, 1, 6, 2, 4]; // (mimic.js's: a hand that doesn't look sorted)
const STEP_MS = 20; // a frame of the arena's time when the reel is run forward by hand (a seek)
const tall = () => innerWidth < innerHeight;
// where the board sits (scene.js's setFrame: margins of a 2 x 2 view). A phone held upright: the board above, the phone under it.
const FRAMES = {
  wide: () => (tall() ? { top: 0.56, bottom: 0.64, left: 0.08, right: 0.08 } : { top: 0.34, bottom: 0.3, left: 0.2, right: 0.2 }),
  phone: () => (tall() ? { top: 0.36, bottom: 0.8, left: 0.08, right: 0.08 } : { top: 0.3, bottom: 0.44, left: 0.62, right: 0.08 }),
};
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ramp = (T, a, b) => clamp01((T - a) / (b - a));
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** The light line for the first n cards of a program (as lessons.js's playRun grows it; it isn't exported there). */
function lightLine(course, start, cards) {
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  let { x, y, d } = start;
  return cards.map((t, r) => {
    const path = [[x, y]];
    const n = { m1: 1, m2: 2, m3: 3, bk: -1 }[t];
    if (n) {
      const dir = n < 0 ? (d + 2) % 4 : d;
      for (let k = 0; k < Math.abs(n); k++) {
        const nx = x + dx[dir];
        const ny = y + dy[dir];
        if (nx < 0 || ny < 0 || nx >= course.w || ny >= course.h) break;
        x = nx;
        y = ny;
        path.push([x, y]);
      }
    } else if (t === 'rr') d = (d + 1) % 4;
    else if (t === 'rl') d = (d + 3) % 4;
    else if (t === 'ut') d = (d + 2) % 4;
    return { x, y, d, n: r + 1, path };
  });
}

/**
 * Start the reel. o (the shape of briefing.js's startBriefing; it uses what it needs):
 *   arena                  the host's scene (scene.js). The reel has it, and its clock, until stop().
 *   layer                  the host's overlay layer: the reel's words, title and black go in it
 *   view()                 the latest host view: the racers' colors (optional; or cast: [{ color, avatar }])
 *   robots()               the players' robots as the scene shows them: stop() puts them back (optional)
 *   mimic                  the phone beside the board (mimic.js); without it, the phone shot is the board alone
 *   voice                  the narrator (voice.js); without it, or unheard, the words stand in
 *   regs(n | null)         the race's 1-5 strip, register n lit (optional)
 *   done()                 it played to the end (the arena is already handed back)
 *   skip()                 if given, the reel listens for Esc / Space / Enter itself: it stops, then calls this.
 *                          (host.js's own keys already skip the Briefing: there, leave this out.)
 *   loop, at, paused       play round and round; start at this time (ms); start paused
 *   vo                     false: never speak. words: 'auto' (the default: only for a line that isn't heard),
 *                          'always' or 'never'
 *   title                  the last card's words (default: Robo Rally)
 *   frames                 { wide(), phone() }: where the board sits, if not the whole screen (scene.js's setFrame)
 * Returns { stop(), next(), seek(ms), play(), pause(), duration, shots, time, playing, shot, events }.
 */
export function startSizzle(o) {
  const { arena, layer } = o;
  const mimic = o.mimic ?? null;
  const voice = o.voice ?? null;
  // (the shell's loader, fetched here so that the plan above stays readable by test scripts, which have no shell)
  import('../../js/ui.js').then(({ loadCss }) => loadCss(new URL('./sizzle.css', import.meta.url).href));
  const P = sizzlePlan();
  const R = P.R;
  const wordsMode = o.words ?? 'auto';

  // ----- the cast: the racers' colors, in seat order; spare colors when a scene has more robots than racers -----
  const racers = (o.cast ?? o.view?.()?.robots ?? []).filter((r) => r?.color).map((r, i) => ({ color: r.color, avatar: r.avatar ?? i }));
  const spare = PALETTE.filter((c) => !racers.some((r) => String(r.color).toLowerCase() === c)).map((color, i) => ({ color, avatar: racers.length + i }));
  const actor = (k) => racers[k] ?? spare[(k - racers.length) % Math.max(1, spare.length)] ?? { color: PALETTE[k % PALETTE.length], avatar: k };
  const dress = (list, scene) => {
    const n = Math.max(list.length, racers.length);
    const shift = (racers.length > 4 ? SHIFT_MANY : SHIFT)[scene] ?? 0;
    return list.map((r, i) => ({ ...r, name: '', ...actor((i + shift) % n), seat: i }));
  };
  const snapshot = (run, i) => (i <= 0 ? run.start : [...run.steps.slice(0, i)].reverse().find((st) => st.robots)?.robots ?? run.start);
  const programBefore = (run, i) => [...run.steps.slice(0, i)].reverse().find((st) => st.kind === 'program');
  const phoneColor = dress(R.program.start, 'program')[0].color;

  // ----- what the arena was like, to give back -----
  const before = {
    course: arena.course, tempo: arena.tempo, camMode: arena.camMode, calmWin: arena.calmWin, tagsOnly: arena.tagsOnly,
    dim: arena.dim, focusOn: arena.focusOn, frame: { ...arena.frame }, clock: arena.clock,
  };
  arena.tagsOnly = new Set(); // no names: these aren't the players' own robots

  // ----- the reel's own layer: black, the words, the title -----
  const hostEl = layer.closest('.lm-host') ?? layer.parentElement ?? layer;
  const root = document.createElement('div');
  root.className = 'sz';
  root.innerHTML = '<div class="sz-black"></div><p class="sz-word"></p><div class="sz-title"><h1></h1></div>';
  root.querySelector('h1').textContent = o.title ?? 'Robo Rally';
  layer.append(root);
  hostEl.classList.add('sz-on');
  const blackEl = root.children[0];
  const wordEl = root.children[1];
  const titleEl = root.children[2];
  const phoneEl = mimic?.el ?? null;
  phoneEl?.classList.add('sz-phone');

  // ----- the clock: the reel's time T (ms) is the only one. The arena's time is T's, frame by frame. -----
  let T = 0;
  let arenaT = 0; // how far the arena has been run
  let ci = 0; // the next cue
  let playing = false;
  let seeking = false;
  let stopped = false;
  let byHand = null; // a frame run by hand lasts this long (s)
  let quietDepth = 0;
  const events = []; // what the arena said happened, and when (for test scripts): [{ t, kind, id }]
  const said = new Set(); // the narrator's lines said aloud on this pass
  let spoke = false;
  const voAt = Object.fromEntries(P.cues.filter((c) => c.k === 'vo').map((c) => [c.key, c.t]));
  const canSpeak = () => o.vo !== false && !!voice?.audible;
  /** Is this line heard on this pass: said already, or still to come with the narrator audible? (Its words stay off the glass.) */
  const hears = (key) => said.has(key) || (playing && canSpeak() && voAt[key] > T);
  arena.clock = {
    getDelta() {
      if (byHand != null) return byHand;
      const d = Math.max(0, (T - arenaT) / 1000);
      arenaT = T;
      return d;
    },
  };
  const note = (kind, d) => {
    if (events.length > 400) events.shift();
    events.push({ t: Math.round(T), kind, id: d?.id ?? null });
  };
  const offNote = arena.on(note);

  /** Run fn with the arena silent and unseen: nothing drawn, nothing emitted (so nothing heard), no checks on the picture. */
  function quiet(fn) {
    if (quietDepth++) {
      try {
        return fn();
      } finally {
        quietDepth--;
      }
    }
    const render = arena.renderer.render;
    arena.renderer.render = () => {};
    arena.composer.render = () => {};
    arena.emit = note;
    arena.adapt = () => {};
    arena.checkPicture = () => {};
    try {
      return fn();
    } finally {
      quietDepth--;
      arena.renderer.render = render;
      delete arena.composer.render;
      delete arena.emit;
      delete arena.adapt;
      delete arena.checkPicture;
    }
  }
  /** n frames of the arena, by hand, each dt seconds long (the scene's own time stands still if frozen). */
  function frames(n, dt, frozen = false) {
    const tempo = arena.tempo;
    if (frozen) arena.tempo = 0;
    byHand = dt;
    try {
      for (let i = 0; i < n; i++) arena.frameLoop();
    } finally {
      byHand = null;
      arena.tempo = tempo;
    }
  }

  // ----- the cues -----
  let cur = null; // the scene on the glass
  const say = {
    cut(c) {
      o.regs?.(null);
      shown.regs = null;
      cur = c.scene ?? null;
      if (phoneEl) {
        mimic.reset();
        phoneEl.style.opacity = '0';
        hand = null;
        if (c.phone) dealHand();
      }
      if (!c.scene) return; // (the title: the board stays as it is, under the black)
      const run = R[c.scene];
      arena.reset(run.course);
      arena.syncRobots(dress(snapshot(run, c.at ?? 0), c.scene));
      for (const b of arena.bots.values()) b.pop = -10; // a cut: they are there already (no popping in)
      arena.calmWin = !!c.calm; // (calm: a flag is rings of light, no camera move)
      arena.camMode = 'lesson';
      arena.tempo = c.tempo ?? 1.6;
      const kind = c.frame === 'phone' && !phoneEl ? 'wide' : c.frame ?? 'wide'; // (no phone to make room for)
      arena.setFrame({ ...(o.frames?.[kind] ?? FRAMES[kind])(), headroom: null });
      arena.dimCur = 0;
      // the camera is where it will stay from the first frame (it would slide the board into its frame otherwise)
      quiet(() => frames(14, 0.1, true));
    },
    reveal(c) {
      const run = R[c.scene];
      const st = run.steps[c.i];
      const robots = dress(st.robots, c.scene);
      const program = programBefore(run, c.i);
      arena.showCards(robots.map((r, k) => ({ id: r.id, types: r.on ? [program.shown[k][st.reg]].filter(Boolean) : [] })));
      const acting = robots.map((_, k) => robots[(program.prio + k) % robots.length]).filter((r) => r.on !== false).map((r) => r.id);
      if (acting.length > 1) arena.orderMarks(acting, { dur: 0.9 });
      arena.playBeat(st.beat, robots);
      arena.syncRobots(robots);
    },
    beat(c) {
      const run = R[c.scene];
      const st = run.steps[c.i];
      const robots = dress(st.robots, c.scene);
      if (c.play != null) arena.playBeat(run.steps[c.play].beat, robots); // its card, over it as it goes
      arena.playBeat(c.strip?.length ? { ...st.beat, fx: st.beat.fx.filter((f) => !c.strip.includes(f.k)) } : st.beat, robots);
      arena.syncRobots(robots);
    },
    sync(c) {
      arena.syncRobots(dress(R[c.scene].steps[c.i].robots, c.scene));
    },
    line(c) {
      const run = R.program;
      arena.ghostPath(lightLine(run.course, run.start[0], run.steps[0].cards[0].slice(0, c.n)), phoneColor);
    },
    unline() {
      arena.clearGhost();
    },
    snd(c) {
      if (!seeking) sfx[c.s]?.(...c.a);
    },
    tempo(c) {
      arena.tempo = c.v;
    },
    spot(c) {
      arena.spotlight(c.x, c.y, { hold: c.hold, k: c.zoom });
    },
    vo(c) {
      if (seeking || !canSpeak()) return;
      const line = LINES[c.key];
      said.add(c.key);
      spoke = true;
      voice.say(line.text, { id: line.id, chirp: c.chirp });
    },
  };
  function fire() {
    while (ci < P.cues.length && P.cues[ci].t <= T) {
      const c = P.cues[ci++];
      if (c.scene && c.k !== 'cut' && c.scene !== cur) continue;
      try {
        say[c.k](c);
      } catch (err) {
        console.warn('sizzle:', c.k, c.scene ?? '', err);
      }
    }
  }

  // ----- the tracks: what the layer and the phone look like at T, and nothing else -----
  const shown = { black: null, word: null, wordK: null, title: null, regs: undefined, phone: null, slots: [] };
  const cuts = P.shots.map((s) => s.t0).filter((t) => t > 0 && t < AT.title);
  const BLINK = 0; // ms of black on each cut (0: a plain cut)
  function blackAt(t) {
    let k = Math.max(1 - ramp(t, 120, 380), ramp(t, AT.title - 300, AT.title - 20));
    if (BLINK) for (const c of cuts) if (t >= c - BLINK / 2 && t < c + BLINK / 2) k = 1;
    return k;
  }
  const set = (key, v, fn) => {
    if (shown[key] === v) return;
    shown[key] = v;
    fn(v);
  };
  let hand = null; // the phone's cards this shot: [{ el, slot, dx, dy, s, n }]
  const slotEls = phoneEl ? [...phoneEl.querySelectorAll('.lf-slots i')] : [];
  function dealHand() {
    const ph = P.phone;
    const real = ph.types;
    const all = [...real, ...DECOYS.filter((t) => !real.includes(t)).slice(0, 2)];
    const order = HAND_ORDER.filter((i) => i < all.length);
    const handEl = phoneEl.querySelector('.lf-hand');
    handEl.innerHTML = order.map((i, n) => `<span class="lf-card" data-i="${i}" style="--n:${n}">${cardSvgHtml(all[i])}</span>`).join('');
    mimic.setColor(phoneColor);
    phoneEl.classList.add('show');
    shown.phone = null;
    shown.slots = [];
    hand = order.map((i, n) => {
      const el = handEl.children[n];
      const slot = i < real.length ? slotEls[i] : null;
      const g = { el, i, n, slot, dx: 0, dy: 0, s: 1 };
      if (slot) {
        g.dx = slot.offsetLeft + slot.offsetWidth / 2 - (el.offsetLeft + el.offsetWidth / 2);
        g.dy = slot.offsetTop + slot.offsetHeight / 2 - (el.offsetTop + el.offsetHeight / 2);
        g.s = slot.offsetWidth / (el.offsetWidth || 1);
      }
      return g;
    });
  }
  function drawPhone() {
    const ph = P.phone;
    const on = T >= ph.t0 && T < ph.t1 && !!hand;
    set('phone', on ? 1 : 0, (v) => (phoneEl.style.opacity = String(v)));
    if (!on) return;
    const FLY = 300;
    for (const g of hand) {
      const dealt = easeOut(ramp(T, ph.deal + g.n * 55, ph.deal + g.n * 55 + 280));
      const p = g.slot ? ramp(T, ph.fills[g.i] - FLY, ph.fills[g.i]) : 0;
      const e = easeInOut(p);
      const st = g.el.style;
      st.opacity = p >= 1 ? '0' : dealt.toFixed(3);
      st.zIndex = p > 0 ? '3' : '';
      st.transform = p > 0
        ? `translate(${(g.dx * e).toFixed(1)}px, ${(g.dy * e - Math.sin(p * Math.PI) * 14).toFixed(1)}px) scale(${(1 + (g.s - 1) * e).toFixed(3)})`
        : `translateY(${((1 - dealt) * 24).toFixed(1)}px)`;
    }
    let lit = -1;
    for (const [t, reg] of ph.lit) if (T >= t) lit = reg;
    slotEls.forEach((el, k) => {
      const full = T >= ph.fills[k];
      const key = `${full ? 1 : 0}${k === lit ? 'n' : k < lit ? 'd' : ''}`;
      if (shown.slots[k] !== key) {
        shown.slots[k] = key;
        el.className = `${full ? 'full' : ''} ${k === lit ? 'now' : ''} ${lit >= 0 && k < lit ? 'done' : ''}`;
        el.innerHTML = full ? cardSvgHtml(ph.types[k]) : '';
      }
      // a card lands: the slot gives a little, and settles
      el.style.scale = full ? (1 + 0.22 * (1 - easeOut(ramp(T, ph.fills[k], ph.fills[k] + 220)))).toFixed(3) : '';
    });
    phoneEl.classList.toggle('locked', T >= ph.lock);
    phoneEl.classList.toggle('run', T >= ph.go);
  }
  function draw() {
    set('black', blackAt(T).toFixed(3), (v) => (blackEl.style.opacity = v));
    // the words: one line at a time; those standing in for a narrator's line, only while nobody hears that line
    const w = wordsMode === 'never' ? null : P.words.find((x) => T >= x.t0 && T < x.t1 && (wordsMode === 'always' || !x.key || !hears(x.key)));
    set('word', w?.text ?? '', (v) => (wordEl.textContent = v));
    const wk = w ? `${(ramp(T, w.t0, w.t0 + 160) * (1 - ramp(T, w.t1 - 180, w.t1))).toFixed(3)}|${(1.3 - 0.3 * easeOut(ramp(T, w.t0, w.t0 + 900))).toFixed(3)}` : '0|1';
    set('wordK', wk, (v) => {
      const [a, k] = v.split('|');
      wordEl.style.opacity = a;
      wordEl.style.setProperty('--k', k);
    });
    const tt = `${(ramp(T, AT.title + 150, AT.title + 800) * (1 - ramp(T, AT.end - 500, AT.end - 60))).toFixed(3)}|${(1.6 - 0.6 * easeOut(ramp(T, AT.title + 150, AT.title + 2600))).toFixed(3)}`;
    set('title', tt, (v) => {
      const [a, k] = v.split('|');
      titleEl.style.opacity = a;
      titleEl.style.setProperty('--k', k);
    });
    if (o.regs) {
      let n = null;
      for (const [t, reg] of P.regs) if (T >= t) n = reg;
      if (shown.regs !== n) {
        shown.regs = n;
        o.regs(n);
      }
    }
    if (phoneEl && P.phone) drawPhone();
  }

  // ----- playing, pausing, seeking -----
  const shotAt = (ms) => [...P.shots].reverse().find((s) => s.t0 <= ms) ?? P.shots[0];
  function hush() {
    said.clear();
    if (spoke) voice?.cancel();
    spoke = false;
  }
  /** Go to ms: the shot under it is built from its cut, and run forward to that moment, at once, unseen and unheard. */
  function seek(ms) {
    if (stopped) return;
    ms = Math.max(0, Math.min(P.duration, Number(ms) || 0));
    hush();
    const s = shotAt(Math.min(ms, P.duration - 1));
    seeking = true;
    try {
      quiet(() => {
        ci = P.cues.findIndex((c) => c.k === 'cut' && c.t === s.t0);
        T = s.t0;
        fire();
        while (T < ms) {
          const dt = Math.min(STEP_MS, ms - T);
          T += dt;
          fire();
          frames(1, dt / 1000);
        }
      });
    } finally {
      seeking = false;
    }
    arenaT = T;
    last = performance.now();
    draw();
  }
  let last = performance.now();
  let raf = 0;
  function tick(now) {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(100, now - last);
    last = now;
    if (!playing) return;
    T = Math.min(P.duration, T + dt);
    fire();
    draw();
    if (T >= P.duration) end();
  }
  function end() {
    if (o.loop) return seek(0);
    api.stop({ fade: true }); // the arena goes back under the reel's last black, which then lifts
    o.done?.();
  }
  function play() {
    if (stopped) return;
    if (T >= P.duration) seek(0);
    playing = true;
    last = performance.now();
    hostEl.classList.remove('sz-still');
  }
  function pause() {
    playing = false;
    hush();
    hostEl.classList.add('sz-still'); // (nothing is left half-way through a CSS transition)
    draw();
  }

  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, dialog, button')) return;
    if (e.key !== 'Escape' && e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    api.stop();
    o.skip();
  };
  if (o.skip) addEventListener('keydown', onKey);
  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => !stopped && seek(T), 120); // (the frames and the phone's place depend on the screen's shape)
  };
  addEventListener('resize', onResize);

  const api = {
    duration: P.duration,
    shots: P.shots.map((s) => ({ ...s })),
    events,
    get time() {
      return T;
    },
    get playing() {
      return playing;
    },
    get shot() {
      return stopped ? null : shotAt(T).name;
    },
    seek,
    play,
    pause,
    /** On to the next shot now (the Briefing's → key). */
    next() {
      const s = P.shots.find((x) => x.t0 > T);
      if (s) seek(s.t0);
    },
    /**
     * It's over (played out, skipped, or the phase moved on): the arena goes back as it was found (its clock, pace,
     * camera, lights, names, frame, course and the players' robots), and the reel's layer goes.
     */
    stop({ fade = false } = {}) {
      if (stopped) return;
      stopped = true;
      playing = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeT);
      removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      hush();
      offNote();
      o.regs?.(null);
      if (phoneEl) {
        mimic.reset();
        phoneEl.classList.remove('sz-phone');
        phoneEl.style.opacity = '';
        for (const el of slotEls) el.style.scale = '';
      }
      hostEl.classList.remove('sz-on', 'sz-still');
      arena.tempo = before.tempo;
      arena.camMode = before.camMode;
      arena.calmWin = before.calmWin;
      arena.tagsOnly = before.tagsOnly;
      try {
        // (a picture that has gone wrong is being replaced by its owner: nothing to put back on it)
        if (!arena.broken && arena.running) {
          arena.clearCards();
          arena.clearGhost();
          if (before.course) arena.reset(before.course); // (also: nobody in focus, the lights up)
          arena.focusOn = before.focusOn;
          arena.setDim(before.dim);
          arena.setFrame(before.frame);
          const robots = o.robots?.();
          if (robots) arena.syncRobots(robots);
          quiet(() => frames(14, 0.1, true)); // (the camera already where it stays, as on a cut)
        }
      } catch (err) {
        console.warn('sizzle: handing the arena back:', err);
      }
      arena.clock = before.clock;
      before.clock.getDelta?.(); // (the time it missed is nobody's)
      if (fade) {
        root.classList.add('sz-out');
        setTimeout(() => root.remove(), 600);
      } else root.remove();
    },
  };

  seek(o.at ?? 0);
  if (o.paused) pause();
  else play();
  raf = requestAnimationFrame(tick);
  return api;
}
