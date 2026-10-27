// Robo Rally for Game Night. The rules themselves are in engine.js; this file connects them to the
// framework: phones' actions, deadlines so nobody can stall the game, and what each screen may see.
// It also keeps what the screens need to teach: who has never finished a race (the Briefing and the
// big screen's callouts are for them), and each robot's story of the last round, for its phone.
import { COURSES, getCourse } from './board.js';
import { cardType, UPGRADES } from './cards.js';
import * as E from './engine.js';

const START_MS = 40_000; // picking start spaces
const UPGRADE_MS = 60_000;
const RELAXED_MS = 300_000; // "no timer" still ends eventually, so one sleepy phone can't stop the race
const BRIEF_MS = 150_000; // the Briefing ends by itself after this, whatever happens
const HOLD_MS = 4000; // the most the big screen can hold one beat of the race (for a callout)
const STORY_STEPS = 40; // per register
const STORY_BYTES = 2500; // per robot, as JSON
const TIMERS = [0, 60, 120, 180];

/** Racers whose phone hasn't said it has finished a race before (a phone that never said hello counts). */
const fresh = (s) => s.order.filter((id) => !s.raced.includes(id));

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
    if (s.phase === 'start' && s.order.every((id) => s.picks[id] != null)) startRace(ctx);
    else if (s.phase === 'brief' && briefTally(ctx).won) leaveBrief(s);
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
  if (s.phase === 'over') ctx.timer('deadline', 90_000, finish);
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
 * Start pads are picked: the race begins. Round 1 has no shop, and a newcomer gets the Briefing first
 * (as does everyone, when the leader switched it on for this game).
 */
function startRace(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  s.teach = fresh(s).length > 0 || !!s.opts.brief;
  E.startRace(s, e);
  if (s.phase === 'upgrade' && s.round === 1) E.startProgramming(s, e); // round 1: no shop (delete to bring it back)
  if (s.teach) {
    s.brief = { next: s.phase, votes: [] };
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

function endBrief(ctx) {
  if (ctx.state.phase !== 'brief') return;
  leaveBrief(ctx.state);
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
  const beat = E.step(s, e);
  if (beat) recordStory(s, beat, before);
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
  if (key === 'course' && COURSES.some((c) => c.id === value)) s.opts.course = value;
  if (['upgrades', 'lessDeadly', 'lessSpam', 'brief'].includes(key) && typeof value === 'boolean') s.opts[key] = value;
  if (key === 'timer' && TIMERS.includes(value)) s.opts.timer = value;
  if (s.touched) s.touched[key] = true;
}

const PREF_KEYS = ['upgrades', 'timer', 'lessDeadly', 'lessSpam'];
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
  const base = s.optsBase ?? {};
  for (const k of PREF_KEYS) if (!s.touched[k] && base[k] !== undefined) s.opts[k] = base[k];
  if (!s.touched.upgrades) {
    const someoneNew = fresh(s).some((id) => ctx.player(id));
    s.opts.upgrades = someoneNew ? false : base.upgrades ?? true;
  }
}

function begin(ctx) {
  const s = ctx.state;
  if (s.phase !== 'setup') return;
  const course = getCourse(s.opts.course);
  s.order = s.order.filter((id) => ctx.player(id)).slice(0, course.starts.length);
  s.phase = 'start';
  s.picks = {};
  drive(ctx);
}

export default {
  name: 'Robo Rally',
  description: 'Program your robot with cards, then watch the chaos unfold. First to tag every checkpoint wins.',
  minPlayers: 1,
  maxPlayers: 8,

  setup(ctx) {
    ctx.state = {
      ...E.newGame({ order: ctx.players.map((p) => p.id), seed: Math.floor(Math.random() * 2 ** 31) }),
      raced: [], // players whose phone says it has finished a race before (hello)
      teach: null, // a newcomer is racing: decided when the start pads are picked
      brief: null, // the Briefing: { next phase, votes to skip it }
      story: null, // what happened to each robot last round: { round, regs: { id: [5 lists of steps] } }
      auto: {}, // id -> the slots time filled at random last programming phase
      beatDue: 0, // when the current beat of the race ends
      prefs: {}, // id -> that phone's settings from its last game (hello)
      optsBase: null, // the leader's last-game settings, once taken (a new leader doesn't replace them)
      touched: {}, // options the leader has set by hand this game: never changed for them
    };
    autoOpts(ctx);
  },

  onJoin(ctx, player) {
    const s = ctx.state;
    if ((s.phase !== 'setup' && s.phase !== 'start') || s.order.length >= 8) return false;
    if (!s.order.includes(player.id)) s.order.push(player.id);
    autoOpts(ctx);
  },

  onDisconnect(ctx, player) {
    const s = ctx.state;
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
      const p = payload?.prefs;
      if (p && typeof p === 'object') {
        const ok = {};
        for (const k of ['upgrades', 'lessDeadly', 'lessSpam']) if (typeof p[k] === 'boolean') ok[k] = p[k];
        if (TIMERS.includes(p.timer)) ok.timer = p.timer;
        s.prefs[player.id] = ok;
      }
      autoOpts(ctx);
    },

    // ----- setting up (the leader's phone) -----
    setOpt(ctx, player, payload) {
      if (player.isVip) setOpt(ctx, payload);
    },
    begin(ctx, player) {
      if (player.isVip) begin(ctx);
    },
    pick(ctx, player, payload) {
      const s = ctx.state;
      const n = Number(payload?.n);
      if (s.phase !== 'start' || !s.order.includes(player.id)) return;
      if (!getCourse(s.opts.course).starts.some((st) => st.n === n)) return;
      if (Object.entries(s.picks).some(([id, m]) => m === n && id !== player.id)) return { error: 'Someone just took that one' };
      s.picks[player.id] = n;
      drive(ctx);
    },

    // ----- the Briefing: a vote to skip it (or take the vote back) -----
    skip(ctx, player, payload) {
      const s = ctx.state;
      if (s.phase !== 'brief' || !s.order.includes(player.id)) return;
      s.brief.votes = s.brief.votes.filter((id) => id !== player.id);
      if (payload?.on) s.brief.votes.push(player.id);
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

    // ----- the end -----
    finish(ctx, player) {
      if (player.isVip && ctx.state.phase === 'over') finish(ctx);
    },
  },

  hostActions: {
    setOpt: (ctx, payload) => setOpt(ctx, payload),
    begin: (ctx) => begin(ctx),
    finish(ctx) {
      if (ctx.state.phase === 'over') finish(ctx);
    },
    /** "Hurry up": the current deadline drops to 15 seconds. */
    hurry(ctx) {
      const s = ctx.state;
      if (!['start', 'upgrade', 'program'].includes(s.phase)) return;
      const left = s.deadline - Date.now();
      if (s.deadline && left <= 15_000) return;
      s.deadline = Date.now() + 15_000;
      ctx.timer('deadline', 15_000, onDeadline);
    },
    /** The Briefing played to the end, or someone at the big screen skipped it. */
    briefDone: (ctx) => endBrief(ctx),
    briefSkip: (ctx) => endBrief(ctx),
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
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
      teach: s.teach ?? (fresh(s).length > 0 || !!s.opts.brief),
      brief: tally ? { votes: tally.votes, need: tally.need } : null,
      robots: s.order.map((id, seat) => publicRobot(ctx, id, seat, true)),
      beat: s.beat,
      prompt: s.prompt && { id: s.prompt.id, kind: s.prompt.kind, icon: s.prompt.icon ?? null, title: s.prompt.title, deadline: s.prompt.deadline },
      winner: s.winner,
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
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
      inRace: s.order.includes(player.id),
      brief: tally ? { votes: tally.votes.length, need: tally.need, mine: tally.votes.includes(player.id) } : null,
      robots: s.order.map((id, seat) => publicRobot(ctx, id, seat, false)),
      me: R
        ? {
          ...privateRobot(R),
          rbAt: E.rebootPoint(s, env(ctx), R),
          story: story ? { round: s.story.round, regs: story } : null,
          auto: s.auto[player.id] ?? [],
        }
        : null,
      myPick: s.picks[player.id] ?? null,
      prompt: p?.id === player.id ? { kind: p.kind, icon: p.icon ?? null, title: p.title, text: p.text, options: p.options, deadline: p.deadline, card: p.card, target: p.target, leader: p.leader, data: p.data } : null,
      waiting: p && p.id !== player.id ? { id: p.id, kind: p.kind, icon: p.icon ?? null, deadline: p.deadline } : null,
      beat: { n: s.beat.n, what: s.beat.what ?? null, reg: s.beat.reg },
      winner: s.winner,
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
