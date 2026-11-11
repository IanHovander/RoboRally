// Robo Rally for Game Night. The rules themselves are in engine.js; this file connects them to the
// framework: phones' actions, deadlines so nobody can stall the game, and what each screen may see.
// It also keeps what the screens need to teach: who has never finished a race (the Briefing and the
// big screen's callouts are for them), who has driven the test drive (drills.js: newcomers who haven't get it
// after the Briefing's film), and each robot's story of the last round, for its phone.
// And it gives the race an ending: the finishing order, a few awards, the race's biggest moment to show again,
// and a rematch.
import { COURSES, getCourse, padsByFlag, stepsToFlag } from './board.js';
import { cardType, UPGRADES } from './cards.js';
import { readBeat } from './chaos.js';
import { DRILLS } from './drills.js';
import * as E from './engine.js';

const START_MS = 4000; // the draw: the big screen shows who starts where, then the race begins
const UPGRADE_MS = 60_000;
const RELAXED_MS = 300_000; // "no timer" still ends eventually, so one sleepy phone can't stop the race
const BRIEF_MS = 150_000; // the Briefing ends by itself after this, whatever happens
const PRACTICE_MS = 90_000; // ...and so does the test drive after its film
const HOLD_MS = 4000; // the most the big screen can hold one beat of the race (for a callout)
const OVER_MS = 120_000; // the ending stays up this long (the big screen's show takes about 20 s of it), then it's the lobby
const PLAY_MIN = 6; // how big a moment has to be to be shown again at the end (chaos.js scores: a fall off a belt is 6.5)
const PLAY_BYTES = 3000; // ...and how big it may be, as JSON (the big screen gets it in one message)
const STORY_STEPS = 40; // per register
const STORY_BYTES = 2500; // per robot, as JSON
const TIMERS = [0, 60, 120, 180];

/** Racers whose phone hasn't said it has finished a race before (a phone that never said hello counts). */
const fresh = (s) => s.order.filter((id) => !s.raced.includes(id));
/** Newcomers here now who haven't driven the test drive: the Briefing's practice stage waits for them. */
const needPractice = (ctx) => fresh(ctx.state).filter((id) => ctx.player(id)?.connected && !ctx.state.practiced.includes(id));

function env(ctx) {
  const s = ctx.state;
  return {
    course: getCourse(s.opts.course),
    connected: (id) => !!ctx.player(id)?.connected,
    now: () => Date.now(),
    name: (id) => ctx.player(id)?.name ?? 'A robot',
  };
}

/** Every robot whose phone is connected passes the test (and at least one phone is). */
function everyone(ctx, test) {
  const s = ctx.state;
  const live = E.robotList(s).filter((R) => ctx.player(R.id)?.connected);
  return live.length > 0 && live.every(test);
}

/** Move the game on when a phase is finished, then set the timers for the phase we're in. */
function drive(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  for (let i = 0; i < 6; i++) {
    const stamp = `${s.phase}:${s.round}`;
    if (s.phase === 'brief' && briefTally(ctx).won) skipBrief(ctx);
    else if (s.phase === 'brief' && s.brief.stage === 'practice' && !needPractice(ctx).length) leaveBrief(s);
    else if (s.phase === 'upgrade' && everyone(ctx, (R) => R.done)) E.startProgramming(s, e);
    else if (s.phase === 'program' && everyone(ctx, (R) => R.done)) activate(ctx);
    if (`${s.phase}:${s.round}` === stamp) break;
  }
  schedule(ctx);
}

function schedule(ctx) {
  const s = ctx.state;
  const stamp = `${s.phase}:${s.round}`;
  if (s.scheduled === stamp) return;
  s.scheduled = stamp;
  ctx.cancelTimer('deadline');
  const ms = { start: START_MS, brief: BRIEF_MS, upgrade: UPGRADE_MS, program: (s.opts.timer || 0) * 1000 || RELAXED_MS }[s.phase];
  s.deadline = ms ? Date.now() + ms : 0;
  if (ms) ctx.timer('deadline', ms, onDeadline);
  if (s.phase === 'activate') {
    s.beatDue = Date.now() + 500;
    ctx.timer('beat', 500, pump);
  }
  if (s.phase === 'over') ctx.timer('deadline', OVER_MS, finish);
}

function onDeadline(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  s.scheduled = null;
  if (s.phase === 'start') startRace(ctx);
  else if (s.phase === 'brief') leaveBrief(s);
  else if (s.phase === 'upgrade') E.startProgramming(s, e);
  else if (s.phase === 'program') activate(ctx);
  drive(ctx);
}

/**
 * The draw: nobody picks a start pad. The racers get the pads nearest the first flag (so nobody starts far behind
 * the rest, and round 1 is crowded), handed out at random. A phone that joins during the draw gets the nearest
 * pad that's left. In a rematch the pads go in reverse finishing order instead: whoever came last in the race
 * before gets the nearest one (someone new counts as last).
 */
function drawPads(s) {
  const waiting = s.order.filter((id) => s.picks[id] == null);
  const taken = Object.values(s.picks);
  // (shuffled, then sorted: pads equally far from the flag come in a random order)
  const free = E.shuffle(s, padsByFlag(getCourse(s.opts.course)).filter((p) => !taken.includes(p.n))).sort((a, b) => a.steps - b.steps);
  const pads = free.slice(0, waiting.length).map((p) => p.n);
  const was = s.last?.places;
  if (was) {
    // (shuffled, then sorted: robots that shared a place come in a random order)
    const who = E.shuffle(s, waiting).sort((a, b) => (was[b] ?? Infinity) - (was[a] ?? Infinity));
    who.forEach((id, i) => (s.picks[id] = pads[i]));
    return;
  }
  const mixed = E.shuffle(s, pads);
  waiting.forEach((id, i) => (s.picks[id] = mixed[i]));
}

/**
 * The draw is over: the race begins. Round 1 has no shop, and a newcomer gets the Briefing first
 * (as does everyone, when the leader switched it on for this game).
 */
function startRace(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  s.teach = fresh(s).length > 0 || !!s.opts.brief;
  E.startRace(s, e);
  if (s.phase === 'upgrade' && s.round === 1) E.startProgramming(s, e); // round 1: no shop (delete to bring it back)
  if (s.teach) {
    s.brief = { next: s.phase, votes: [], stage: 'film' };
    s.phase = 'brief';
  }
}

/** Briefing votes from connected racers, and whether they're a majority (1 of 1, 2 of 2, 2 of 3...). */
function briefTally(ctx) {
  const s = ctx.state;
  const live = s.order.filter((id) => ctx.player(id)?.connected);
  const votes = (s.brief?.votes ?? []).filter((id) => live.includes(id));
  const need = Math.floor(live.length / 2) + 1;
  return { votes, need, won: votes.length >= need };
}

function leaveBrief(s) {
  if (s.phase !== 'brief') return;
  s.phase = s.brief?.next ?? 'program';
  s.brief = null;
}

/**
 * The Briefing has two stages: the film on the big screen, then the test drive on the phones of newcomers who
 * haven't driven it (nobody: straight to the race). The votes start again for the second stage.
 */
function toPractice(ctx) {
  const s = ctx.state;
  s.brief.stage = 'practice';
  s.brief.votes = [];
  s.deadline = Date.now() + PRACTICE_MS;
  ctx.timer('deadline', PRACTICE_MS, onDeadline);
}

/** A skip (a majority of phones, or the big screen): past the film to the test drive, or past the test drive. */
function skipBrief(ctx) {
  const s = ctx.state;
  if (s.phase !== 'brief') return;
  if (s.brief.stage === 'film' && needPractice(ctx).length) toPractice(ctx);
  else leaveBrief(s);
}

/** The film played to its end on the big screen (said again during the test drive: nothing happens). */
function filmOver(ctx) {
  const s = ctx.state;
  if (s.phase !== 'brief' || s.brief.stage !== 'film') return;
  skipBrief(ctx);
  drive(ctx);
}

/** Programming is over: note which slots time filled at random, start a new story, and race. */
function activate(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  s.auto = {};
  for (const R of E.robotList(s)) {
    if (R.done) continue;
    const placed = R.draft?.regs.map((l) => l.join()) ?? [];
    E.autoProgram(s, e, R); // what beginActivation would do: fill the empty slots from the hand
    s.auto[R.id] = R.draft.regs.flatMap((l, i) => (l.length && !R.regs[i].locked && l.join() !== placed[i] ? [i] : []));
  }
  E.beginActivation(s, e);
  s.story = { round: s.round, regs: Object.fromEntries(E.robotList(s).map((R) => [R.id, [[], [], [], [], []]])), open: {}, later: {} };
}

/** Run the Activation Phase one beat at a time, so the big screen can animate each step. */
function pump(ctx) {
  const s = ctx.state;
  if (s.phase !== 'activate') return drive(ctx);
  const e = env(ctx);
  const before = s.story ? E.robotList(s).map((R) => R.regs.map((r) => (r.cards[0] ? cardType(r.cards[0]) : null))) : null;
  const stood = poses(s);
  const beat = E.step(s, e);
  if (beat) recordStory(s, beat, before);
  if (beat) noteBeat(s, e, beat, stood);
  if (s.prompt) {
    ctx.timer('prompt', Math.max(0, s.prompt.deadline - Date.now()), (c) => {
      E.timeoutPrompt(c.state, env(c));
      pump(c);
    });
    if (beat) ctx.cancelTimer('beat');
    return;
  }
  if (beat) {
    s.beatDue = Date.now() + beat.dur;
    return ctx.timer('beat', beat.dur, pump);
  }
  drive(ctx);
}

// ----- the story: what happened to each robot in each register, for its phone -----
// Steps are small arrays (see docs/teaching/design.md 4.2). Paths are flat [x, y, x, y...].

const PATH_AT = { c: [2], p: [2, 3], b: [2], k: [1], u: [2] }; // where each step keeps its paths
const quarter = (n) => [0, 1, 2, -1][((n % 4) + 4) % 4];

function flat(path) {
  const out = [];
  for (const [x, y] of path) if (out.at(-2) !== x || out.at(-1) !== y) out.push(x, y);
  return out;
}

function extend(into, more) {
  for (let i = 0; i + 1 < more.length; i += 2) if (into.at(-2) !== more[i] || into.at(-1) !== more[i + 1]) into.push(more[i], more[i + 1]);
}

/** One beat of the race, written into the story of every robot it touched. */
function recordStory(s, beat, before) {
  const st = s.story;
  const r = beat.reg;
  if (!st || !(r >= 0 && r < 5)) return;
  const fx = beat.fx;
  const what = beat.what ?? {};
  const robots = E.robotList(s);
  const touched = new Set();
  const add = (id, step) => {
    const list = st.regs[id]?.[r];
    if (!list || list.length >= STORY_STEPS) return undefined;
    touched.add(id);
    return list.push(step) - 1;
  };

  if (fx.some((f) => f.k === 'reveal')) {
    st.open = {};
    for (const R of robots) {
      const later = st.later[R.id]; // a card swapped last register (Scrambler)
      delete st.later[R.id];
      if (!R.on) continue;
      add(R.id, ['s', R.x, R.y, R.d]);
      if (later) add(R.id, later);
    }
    return;
  }

  const paths = {};
  const turns = {};
  const pushedBy = {};
  for (const f of fx) {
    if (f.k === 'move') paths[f.id] = flat(f.path);
    else if (f.k === 'turn') turns[f.id] = (turns[f.id] ?? 0) + f.by;
    else if (f.k === 'shove') for (const id of f.ids) pushedBy[id] ??= f.id;
  }

  robots.forEach((R, seat) => {
    const id = R.id;
    const list = st.regs[id]?.[r];
    if (!list) return;
    // the card it played, or the card that took its place
    const play = fx.find((f) => f.k === 'play' && f.id === id);
    const repl = fx.find((f) => f.k === 'replace' && f.id === id);
    if (repl) add(id, ['x', repl.from === 'abort' ? (before?.[seat]?.[r] ?? null) : repl.from, repl.to]);
    else if (play) {
      const open = list[st.open[id]];
      const again = open && st.open[id] === list.length - 1 && open[2].length <= 2 && !open[3] && open[1].join() === play.cards.join(); // Brakes asks, then plays it again
      if (!again) st.open[id] = add(id, ['c', play.cards, [R.x, R.y], 0]);
    }
    // how it moved
    const path = paths[id];
    const turn = turns[id] ?? 0;
    if (path || turn) {
      const p = path ?? [R.x, R.y];
      const by = pushedBy[id];
      const open = list[st.open[id]];
      const last = list.at(-1);
      if (by) add(id, ['p', by, p, paths[by] ?? []]);
      else if (what.k === 'card' && what.id === id && open) {
        extend(open[2], p);
        open[3] = quarter(open[3] + turn);
        touched.add(id);
      } else if (what.k === 'belt' && last?.[0] === 'b' && last[1] === !!what.fast) {
        extend(last[2], p); // a blue belt's second space
        last[3] = quarter(last[3] + turn);
        touched.add(id);
      } else if (what.k === 'belt') add(id, ['b', !!what.fast, p, quarter(turn)]);
      else if (what.k === 'push') add(id, ['k', p]);
      else if (what.k === 'gear') add(id, ['g', turn]);
      else if (what.k === 'reboot' && what.id !== id) add(id, ['p', what.id, p, []]); // made room on the reboot spot
      else if (what.k === 'rlaser') add(id, ['p', fx.find((f) => f.k === 'beam' && f.src && f.hit?.includes(id))?.src ?? 0, p, []]); // a weapon pushed or pulled it
      else if (what.k === 'card' && what.id !== id && p.length > 2) add(id, ['p', what.id, p, paths[what.id] ?? []]);
      else {
        const drill = fx.some((f) => f.k === 'say' && f.text === '🪛');
        add(id, ['u', what.k === 'upgrade' ? what.key : what.k === 'blaser' ? 'energy-conversion' : drill ? 'piercing-drill' : null, p, quarter(turn)]);
      }
    }
    // what happened to it, in order
    let bumped = false;
    for (const f of fx) {
      if (f.k === 'beam') {
        if (f.hit?.includes(id)) add(id, ['l', f.board ? 0 : f.src, f.x0, f.y0, f.d, f.n]);
        continue;
      }
      if (f.id !== id) continue;
      if ((f.k === 'bonk' || (f.k === 'shove' && f.stuck)) && !bumped) {
        bumped = true;
        add(id, ['w']);
      } else if (f.k === 'fall') add(id, ['f', !!f.edge]);
      else if (f.k === 'reboot') add(id, ['r', f.x, f.y, R.d]);
      else if (f.k === 'dmg') add(id, ['d', f.sp, f.hw, f.src]);
      else if (f.k === 'shield') add(id, ['h']);
      else if (f.k === 'en') add(id, ['e', f.n]);
      else if (f.k === 'cp') add(id, ['cp', f.n]);
    }
  });

  // Scrambler swapped the target's next card: it shows in that register, after the robot's pose
  for (const f of fx) {
    if (f.k !== 'beam' || f.special !== 'scrambler' || r > 3) continue;
    const T = s.robots[f.hit?.[0]];
    const seat = robots.indexOf(T);
    if (T && st.regs[T.id]) st.later[T.id] = ['x', before?.[seat]?.[r + 1] ?? null, T.regs[r + 1].cards[0] ? cardType(T.regs[r + 1].cards[0]) : null];
  }

  for (const id of touched) fitStory(st.regs[id], r);
}

/** Keep one robot's story small: long paths keep only their ends, and a full story stops growing. */
function fitStory(regs, r) {
  const max = STORY_BYTES - 40; // room for { round, regs }
  if (JSON.stringify(regs).length <= max) return;
  for (const step of regs.flat()) {
    for (const i of PATH_AT[step[0]] ?? []) if (step[i].length > 4) step[i] = [...step[i].slice(0, 2), ...step[i].slice(-2)];
  }
  while (JSON.stringify(regs).length > max && regs[r].length > 1) regs[r].pop();
}

// ----- the ending: who came where, a few awards, the race's biggest moment, and a rematch -----

/** Where every robot stands, as the big screen needs it to put them back there. */
const poses = (s) => E.robotList(s).map((R) => ({ id: R.id, x: R.x, y: R.y, d: R.d, on: R.on, cp: R.cp }));

/**
 * After each beat of the race: who pushed whom to a fall (the awards, and each phone's nemesis), and the biggest
 * moment so far, kept with where the robots stood before and after it so the big screen can play it again.
 */
function noteBeat(s, e, beat, stood) {
  if (beat.fx.some((f) => f.k === 'win')) return;
  const read = readBeat(beat, { course: e.course, robots: E.robotList(s) });
  for (const ev of read.events) {
    if (ev.kind !== 'fall' || ev.cause !== 'push' || !ev.by || ev.by === ev.id) continue;
    const by = (s.doom[ev.id] ??= {});
    by[ev.by] = (by[ev.by] ?? 0) + 1;
  }
  if (read.drama < PLAY_MIN || read.drama <= (s.play?.drama ?? 0)) return;
  const kept = { fx: beat.fx, dur: beat.dur, reg: beat.reg, what: beat.what ?? null };
  if (JSON.stringify(kept).length > PLAY_BYTES) return;
  s.play = { drama: read.drama, round: s.round, beat: kept, before: stood, after: poses(s) };
}

/**
 * The finishing order: the most flags first; level on flags, whoever is nearer their next flag (the spaces a robot
 * walks; a fallen robot from where it comes back). Robots level on both share a place: [{ id, place }].
 */
function standings(s, e) {
  const c = e.course;
  const rows = E.robotList(s).map((R) => {
    const at = R.on ? R : E.rebootPoint(s, e, R) ?? R.archive;
    const steps = R.cp >= c.checkpoints.length ? 0 : stepsToFlag(c, R.cp + 1)[at.y * c.w + at.x] ?? Infinity;
    return { id: R.id, cp: R.cp, steps };
  });
  rows.sort((a, b) => b.cp - a.cp || a.steps - b.steps);
  return rows.map((r, i) => {
    const up = rows[i - 1];
    r.place = up && up.cp === r.cp && up.steps === r.steps ? up.place : i + 1;
    return { id: r.id, place: r.place };
  });
}

/** How many robots this one pushed to a fall. */
const doomed = (s, id) => Object.values(s.doom).reduce((n, by) => n + (by[id] ?? 0), 0);
// the awards, in the order the big screen gives them: what each one counts
const AWARDS = [
  ['shove', (s, R) => R.stats.pushes], // robots shoved
  ['zap', (s, R) => R.stats.hits], // laser hits on other robots
  ['doom', (s, R) => doomed(s, R.id)], // robots pushed into a pit or off the edge
  ['fall', (s, R) => R.stats.falls], // its own falls
];
/** Each award goes to the robot with the most (two level share it; nobody with any, or three or more level: not given). */
function awards(s) {
  const robots = E.robotList(s);
  if (robots.length < 2) return [];
  const out = [];
  for (const [k, count] of AWARDS) {
    const n = Math.max(...robots.map((R) => count(s, R)));
    const ids = robots.filter((R) => count(s, R) === n).map((R) => R.id);
    if (n > 0 && ids.length <= 2) out.push({ k, n, ids });
  }
  return out;
}

/** How the race ended (worked out once, the first time a screen needs it): { rows: [{ id, place }], awards: [{ k, n, ids }] }. */
function result(ctx) {
  const s = ctx.state;
  if (s.phase !== 'over') return null;
  return (s.result ??= { rows: standings(s, env(ctx)), awards: awards(s) });
}

/** The robot that pushed this one to the most falls: { id, n }, or null. */
function nemesis(s, id) {
  const [by, n] = Object.entries(s.doom[id] ?? {}).sort((a, b) => b[1] - a[1])[0] ?? [];
  return by ? { id: by, n } : null;
}

/**
 * Again: back to setting up, with the same racers, map and options (the full tutorial isn't repeated). Everyone
 * who raced has now finished a race, and the next draw goes in reverse finishing order (drawPads).
 */
function rematch(ctx) {
  const s = ctx.state;
  if (s.phase !== 'over') return;
  const places = Object.fromEntries(result(ctx).rows.map((r) => [r.id, r.place]));
  ctx.cancelTimer('deadline');
  ctx.state = {
    ...newState(ctx.players.map((p) => p.id), Math.floor(E.rand(s) * 2 ** 31), { ...s.opts, brief: false }),
    raced: [...new Set([...s.raced, ...s.order])],
    practiced: s.practiced,
    prefs: s.prefs,
    optsBase: s.optsBase,
    touched: Object.fromEntries(['course', ...PREF_KEYS].map((k) => [k, true])), // the options stay as they were
    last: { places },
    away: s.order.filter((id) => !ctx.player(id)?.connected),
  };
}

function finish(ctx) {
  const s = ctx.state;
  const name = ctx.player(s.winner)?.name;
  ctx.end(name ? `${name} won the race!` : 'Race over');
}

const robotOf = (ctx, player) => ctx.state.robots[player.id] ?? null;
const errorOr = (err) => (err ? { error: err } : undefined);

function setOpt(ctx, payload) {
  const s = ctx.state;
  if (s.phase !== 'setup' || !payload || typeof payload !== 'object') return;
  const { key, value } = payload;
  if (key === 'course' && COURSES.some((c) => c.id === value)) {
    if (value !== s.opts.course) s.browse = null; // a new map is chosen: the carousel's slide is over
    s.opts.course = value;
  }
  if (['upgrades', 'lessDeadly', 'lessSpam', 'brief'].includes(key) && typeof value === 'boolean') s.opts[key] = value;
  if (key === 'timer' && TIMERS.includes(value)) s.opts.timer = value;
  if (s.touched) s.touched[key] = true;
}

const PREF_KEYS = ['upgrades', 'timer', 'lessDeadly', 'lessSpam', 'brief'];
/**
 * Setting up: the options start where the leader left them last game (taken once, from the first leader whose
 * phone has them, so a leader leaving doesn't switch them), and upgrades start off while anyone is new.
 * Whatever the leader sets by hand stays as they set it.
 */
function autoOpts(ctx) {
  const s = ctx.state;
  if (s.phase !== 'setup' || !s.touched) return;
  if (!s.optsBase) {
    const vip = ctx.players.find((p) => p.isVip);
    if (vip && s.prefs[vip.id]) s.optsBase = s.prefs[vip.id];
  }
  // a first game (anyone new): no shop, edges deadly, SPAM stays in hand, 2 minutes
  const someoneNew = fresh(s).some((id) => ctx.player(id));
  const base = someoneNew ? FIRST_GAME : { ...FIRST_GAME, upgrades: true, ...(s.optsBase ?? {}) };
  for (const k of PREF_KEYS) if (!s.touched[k]) s.opts[k] = base[k];
}
const FIRST_GAME = { upgrades: false, timer: 120, lessDeadly: false, lessSpam: false, brief: false }; // (a newcomer brings the Briefing anyway)

/**
 * The leader is sliding the phone's map carousel: offset is how far the strip has moved, in maps (negative: to the
 * left, toward the next map). Only the big screen sees it (hostView), so it follows the finger without costing the
 * phones anything; `t` (the phone's own clock, when it was there) lets it replay the slide exactly as it moved, and
 * `at` (the server's clock) stands in for a phone that doesn't send it. null: the slide is over.
 */
function browse(ctx, payload) {
  const s = ctx.state;
  if (s.phase !== 'setup') return;
  const o = payload === null || payload === undefined ? null : payload.offset;
  if (o === null || o === undefined) {
    s.browse = null;
    return;
  }
  if (typeof o !== 'number' || !Number.isFinite(o)) return;
  const t = typeof payload.t === 'number' && Number.isFinite(payload.t) ? payload.t : null;
  s.browse = { offset: Math.round(Math.max(-1.5, Math.min(1.5, o)) * 1000) / 1000, course: s.opts.course, at: Date.now(), t };
}

function begin(ctx) {
  const s = ctx.state;
  if (s.phase !== 'setup') return;
  const course = getCourse(s.opts.course);
  // (a rematch: someone whose phone was gone when it was called, and still is, has left; their robot stays out)
  const order = s.order.filter((id) => ctx.player(id) && (ctx.player(id).connected || !s.away.includes(id))).slice(0, course.starts.length);
  if (!order.length) return;
  s.browse = null;
  s.order = order;
  s.phase = 'start';
  s.picks = {};
  drawPads(s);
  drive(ctx);
}

/** A race about to be set up: the engine's game, and what this file keeps beside it. */
function newState(order, seed, opts) {
  return {
    ...E.newGame({ order, seed, opts }),
    raced: [], // players whose phone says it has finished a race before (hello)
    practiced: [], // players whose phone has driven the test drive, before or here (hello, practice)
    practice: {}, // id -> how many of its drills that phone has done here (the big screen shows it)
    teach: null, // a newcomer is racing: decided when the draw is over and the race begins
    brief: null, // the Briefing: { next phase, votes to skip it, stage: 'film' | 'practice' }
    story: null, // what happened to each robot last round: { round, regs: { id: [5 lists of steps] } }
    auto: {}, // id -> the slots time filled at random last programming phase
    beatDue: 0, // when the current beat of the race ends
    prefs: {}, // id -> that phone's settings from its last game (hello)
    optsBase: null, // the leader's last-game settings, once taken (a new leader doesn't replace them)
    touched: {}, // options the leader has set by hand this game: never changed for them
    browse: null, // setting up: the leader is sliding the phone's map carousel ({ offset, course, at }; browse())
    doom: {}, // id -> { the robot that pushed it to a fall: how many times }
    play: null, // the race's biggest moment so far: { drama, round, beat, before, after } (noteBeat)
    result: null, // how the race ended, once it has: { rows, awards } (result())
    last: null, // a rematch: the race before this one ({ places: { id: place } })
    away: [], // a rematch: racers whose phone was gone when it was called (still gone when the race starts: left out)
  };
}

export default {
  name: 'Robo Rally',
  description: 'Program your robot with cards, then watch the chaos unfold. First to tag every checkpoint wins.',
  minPlayers: 1,
  maxPlayers: 8,

  setup(ctx) {
    ctx.state = newState(ctx.players.map((p) => p.id), Math.floor(Math.random() * 2 ** 31));
    autoOpts(ctx);
  },

  onJoin(ctx, player) {
    const s = ctx.state;
    if ((s.phase !== 'setup' && s.phase !== 'start') || s.order.length >= 8) return false;
    if (!s.order.includes(player.id)) s.order.push(player.id);
    if (s.phase === 'start') drawPads(s); // (it joined during the draw)
    autoOpts(ctx);
  },

  onDisconnect(ctx, player) {
    const s = ctx.state;
    s.browse = null; // (it may be the leader's phone, gone mid-slide: the big screen's map settles; a live slide sends it again)
    if (s.prompt?.id === player.id) {
      ctx.cancelTimer('prompt');
      E.timeoutPrompt(s, env(ctx));
      return pump(ctx);
    }
    autoOpts(ctx); // (a newcomer left while setting up: upgrades can come back on)
    drive(ctx);
  },

  actions: {
    // ----- every phone, once it's on: has it finished a race before? -----
    hello(ctx, player, payload) {
      const s = ctx.state;
      s.raced = s.raced.filter((id) => id !== player.id);
      if (payload?.raced === true) s.raced.push(player.id);
      if (payload?.practiced === true && !s.practiced.includes(player.id)) s.practiced.push(player.id);
      const p = payload?.prefs;
      if (p && typeof p === 'object') {
        const ok = {};
        for (const k of ['upgrades', 'lessDeadly', 'lessSpam', 'brief']) if (typeof p[k] === 'boolean') ok[k] = p[k];
        if (TIMERS.includes(p.timer)) ok.timer = p.timer;
        s.prefs[player.id] = ok;
      }
      autoOpts(ctx);
    },

    // ----- setting up (the leader's phone) -----
    setOpt(ctx, player, payload) {
      if (player.isVip) setOpt(ctx, payload);
    },
    browse(ctx, player, payload) {
      if (player.isVip) browse(ctx, payload);
    },
    begin(ctx, player) {
      if (player.isVip) begin(ctx);
    },

    // ----- the Briefing: a vote to skip it (or take the vote back) -----
    skip(ctx, player, payload) {
      const s = ctx.state;
      if (s.phase !== 'brief' || !s.order.includes(player.id)) return;
      s.brief.votes = s.brief.votes.filter((id) => id !== player.id);
      if (payload?.on) s.brief.votes.push(player.id);
      drive(ctx);
    },

    // ----- the test drive: how far this phone has got, and when it's through (done, or it chose to skip it) -----
    practice(ctx, player, payload) {
      const s = ctx.state;
      const n = Math.floor(Number(payload?.level));
      if (n >= 0 && n <= DRILLS.length) s.practice[player.id] = n;
      if (payload?.done === true && !s.practiced.includes(player.id)) s.practiced.push(player.id);
      drive(ctx);
    },

    // ----- the Upgrade Phase -----
    buy(ctx, player) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.buyUpgrade(ctx.state, env(ctx), R));
    },
    install(ctx, player, payload) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.installUpgrade(ctx.state, env(ctx), R, String(payload?.card), payload?.replace == null ? null : String(payload.replace)));
    },
    uninstall(ctx, player, payload) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.uninstallUpgrade(ctx.state, env(ctx), R, String(payload?.card)));
    },
    use(ctx, player, payload) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.useTemp(ctx.state, env(ctx), R, String(payload?.card), { target: String(payload?.target ?? '') }));
    },
    ret(ctx, player, payload) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.returnCards(ctx.state, env(ctx), R, payload?.cards));
    },
    done(ctx, player) {
      const R = robotOf(ctx, player);
      if (!R || ctx.state.phase !== 'upgrade') return;
      R.done = true;
      drive(ctx);
    },

    // ----- the Programming Phase -----
    draft(ctx, player, payload) {
      const R = robotOf(ctx, player);
      if (!R) return;
      if (R.reboot && [0, 1, 2, 3].includes(payload?.rebootDir)) R.rebootDir = payload.rebootDir;
      return errorOr(E.saveDraft(ctx.state, R, payload?.regs));
    },
    lock(ctx, player, payload) {
      const R = robotOf(ctx, player);
      if (!R) return;
      const err = E.lockProgram(ctx.state, env(ctx), R, payload && typeof payload === 'object' ? payload : {});
      if (err) return { error: err };
      drive(ctx);
    },
    unlock(ctx, player) {
      const R = robotOf(ctx, player);
      return R && errorOr(E.unlockProgram(ctx.state, R));
    },
    shield(ctx, player, payload) {
      const R = robotOf(ctx, player);
      if (R) R.autoShield = !!payload?.on;
    },
    arm(ctx, player, payload) {
      const R = robotOf(ctx, player);
      if (!R) return;
      R.armed = !!payload?.on;
      if (R.armed) R.skipUp = false;
    },

    // ----- the Activation Phase -----
    answer(ctx, player, payload) {
      const s = ctx.state;
      const err = E.answerPrompt(s, env(ctx), player.id, String(payload?.v));
      if (err) return { error: err };
      ctx.cancelTimer('prompt');
      pump(ctx);
    },

    // ----- the end (the leader's phone): race again, or back to the lobby -----
    rematch(ctx, player) {
      if (player.isVip) rematch(ctx);
    },
    finish(ctx, player) {
      if (player.isVip && ctx.state.phase === 'over') finish(ctx);
    },
  },

  hostActions: {
    setOpt: (ctx, payload) => setOpt(ctx, payload),
    begin: (ctx) => begin(ctx),
    rematch: (ctx) => rematch(ctx),
    finish(ctx) {
      if (ctx.state.phase === 'over') finish(ctx);
    },
    /** "Hurry up": the current deadline drops to 15 seconds. */
    hurry(ctx) {
      const s = ctx.state;
      if (!['upgrade', 'program'].includes(s.phase)) return;
      const left = s.deadline - Date.now();
      if (s.deadline && left <= 15_000) return;
      s.deadline = Date.now() + 15_000;
      ctx.timer('deadline', 15_000, onDeadline);
    },
    /** The Briefing's film played to the end, or someone at the big screen skipped (the film, then the test drive). */
    briefDone: (ctx) => filmOver(ctx),
    briefSkip(ctx) {
      skipBrief(ctx);
      drive(ctx);
    },
    /** A callout is speaking: the current beat of the race lasts at least `ms` more (at most 4 s). */
    hold(ctx, payload) {
      const s = ctx.state;
      if (s.phase !== 'activate' || s.prompt) return;
      const ms = Math.min(HOLD_MS, Math.max(0, Number(payload?.ms) || 0));
      if (Date.now() + ms <= s.beatDue) return;
      s.beatDue = Date.now() + ms;
      ctx.timer('beat', ms, pump);
    },
  },

  hostView(ctx) {
    const s = ctx.state;
    const course = getCourse(s.opts.course);
    const tally = s.brief && briefTally(ctx);
    const end = result(ctx);
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      browse: s.phase === 'setup' ? s.browse ?? null : null, // (the big screen only: the phones never see it)
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
      teach: s.teach ?? (fresh(s).length > 0 || !!s.opts.brief),
      // (practice: drills done by each racer still driving the test drive; the stage waits for them)
      brief: tally ? { votes: tally.votes, need: tally.need, stage: s.brief.stage, drills: DRILLS.length, practice: Object.fromEntries(needPractice(ctx).map((id) => [id, s.practice[id] ?? 0])) } : null,
      robots: s.order.map((id, seat) => publicRobot(ctx, id, seat, true)),
      beat: s.beat,
      prompt: s.prompt && { id: s.prompt.id, kind: s.prompt.kind, icon: s.prompt.icon ?? null, title: s.prompt.title, deadline: s.prompt.deadline },
      winner: s.winner,
      // the ending: the finishing order, each robot's place, the awards, and the moment to play again
      result: end && {
        order: end.rows.map((r) => r.id),
        places: Object.fromEntries(end.rows.map((r) => [r.id, r.place])),
        awards: end.awards,
        play: s.play && { round: s.play.round, beat: s.play.beat, before: s.play.before, after: s.play.after },
      },
      log: s.log.slice(-4),
    };
  },

  playerView(ctx, player) {
    const s = ctx.state;
    const R = s.robots[player.id];
    const course = getCourse(s.opts.course);
    const p = s.prompt;
    const tally = s.brief && briefTally(ctx);
    const story = s.story?.regs[player.id];
    const end = R && result(ctx);
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
      inRace: s.order.includes(player.id),
      // (practice: this phone drives the test drive now, from drill `level`)
      brief: tally ? { votes: tally.votes.length, need: tally.need, mine: tally.votes.includes(player.id), stage: s.brief.stage, practice: s.brief.stage === 'practice' && needPractice(ctx).includes(player.id), level: s.practice[player.id] ?? 0 } : null,
      robots: s.order.map((id, seat) => publicRobot(ctx, id, seat, false)),
      me: R
        ? {
          ...privateRobot(R),
          rbAt: E.rebootPoint(s, env(ctx), R),
          story: story ? { round: s.story.round, regs: story } : null,
          auto: s.auto[player.id] ?? [],
        }
        : null,
      prompt: p?.id === player.id ? { kind: p.kind, icon: p.icon ?? null, title: p.title, text: p.text, options: p.options, deadline: p.deadline, card: p.card, target: p.target, leader: p.leader, data: p.data } : null,
      waiting: p && p.id !== player.id ? { id: p.id, kind: p.kind, icon: p.icon ?? null, deadline: p.deadline } : null,
      beat: { n: s.beat.n, what: s.beat.what ?? null, reg: s.beat.reg },
      winner: s.winner,
      // the ending, for this robot: its place (of how many), its awards, and the robot that pushed it to the most falls
      result: end && {
        place: end.rows.find((r) => r.id === player.id)?.place ?? null,
        of: end.rows.length,
        awards: end.awards.filter((a) => a.ids.includes(player.id)).map((a) => ({ k: a.k, n: a.n })),
        nemesis: nemesis(s, player.id),
      },
      log: s.log.slice(-3),
    };
  },
};

/** What everyone may know about a robot. The big screen also sees each register as it's revealed. */
function publicRobot(ctx, id, seat, forHost) {
  const s = ctx.state;
  const p = ctx.player(id);
  const R = s.robots[id];
  const base = { id, seat, name: p?.name ?? '?', color: p?.color ?? '#888888', avatar: p?.avatar, away: !p?.connected };
  if (forHost) base.auto = s.auto[id] ?? []; // the slots time filled at random
  if (!R) return { ...base, pick: s.picks[id] ?? null };
  const out = { ...base, x: R.x, y: R.y, d: R.d, on: R.on, rb: !!R.reboot, sd: R.shutdown, cp: R.cp, en: R.energy, ready: R.done };
  if (!forHost) return { ...out, ups: [...R.up.perm, ...R.up.temp] }; // installed upgrades are face up for all to see
  // each register: the revealed card types, or 1 for a face-down card (placed, or a waiting Haywire), or 0
  out.regs = R.regs.map((r, i) => {
    if (r.up) return r.cards.map(cardType);
    return r.cards.length || (s.phase === 'program' && R.draft?.regs[i]?.length) ? 1 : 0;
  });
  out.hw = R.regs.map((r) => (r.next || (r.locked && !r.up) ? 1 : 0));
  out.pick = R.start; // its start pad: where it comes back if it falls on the dock (teach.js rebootSpot)
  out.perm = R.up.perm;
  out.temp = R.up.temp.length;
  out.hand = R.hand.length;
  out.wantSd = s.phase === 'program' && R.done && R.wantShutdown;
  out.stats = s.phase === 'over' ? R.stats : undefined;
  return out;
}

/** { cardType: how many } for a pile of cards. */
function countTypes(cards) {
  const out = {};
  for (const c of cards) {
    const t = cardType(c);
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function privateRobot(R) {
  return {
    x: R.x,
    y: R.y,
    d: R.d,
    on: R.on,
    rb: !!R.reboot,
    sd: R.shutdown,
    en: R.energy,
    cp: R.cp,
    hand: R.hand,
    regs: R.regs.map((r) => ({ cards: r.cards, locked: r.locked, up: r.up, next: r.next })),
    deck: R.deck.length,
    discard: R.discard.length,
    // what's in each pile (as in the board game: you may look through your own cards, but not their order)
    archive: R.archive, // where I come back if I fall on the dock or a board without a reboot ring (my start pad)
    deckCards: countTypes(R.deck),
    discardCards: countTypes(R.discard),
    spam: [...R.deck, ...R.discard, ...R.hand].filter((c) => cardType(c) === 'sp').length,
    peek: R.peek,
    up: R.up,
    done: R.done,
    bought: R.bought,
    installed: R.installed,
    draft: R.draft,
    rebootDir: R.rebootDir,
    wantSd: R.wantShutdown,
    armed: R.armed,
    skipUp: R.skipUp,
    autoShield: R.autoShield,
    memory: R.memory,
    mustProgram: R.mustProgram,
    mustReturn: R.mustReturn,
    hwChoice: R.hwChoice,
    stats: R.stats,
    canArm: R.up.temp.some((k) => ['move', 'turn'].includes(UPGRADES[k].when)),
  };
}
