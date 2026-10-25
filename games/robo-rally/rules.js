// Robo Rally for Game Night. The rules themselves are in engine.js; this file connects them to the
// framework: phones' actions, deadlines so nobody can stall the game, and what each screen may see.
import { COURSES, getCourse } from './board.js';
import { cardType, UPGRADES } from './cards.js';
import * as E from './engine.js';

const START_MS = 40_000; // picking start spaces
const UPGRADE_MS = 60_000;
const RELAXED_MS = 300_000; // "no timer" still ends eventually, so one sleepy phone can't stop the race
const TIMERS = [0, 60, 120, 180];

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
    if (s.phase === 'start' && s.order.every((id) => s.picks[id] != null)) E.startRace(s, e);
    else if (s.phase === 'upgrade' && everyone(ctx, (R) => R.done)) E.startProgramming(s, e);
    else if (s.phase === 'program' && everyone(ctx, (R) => R.done)) E.beginActivation(s, e);
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
  const ms = { start: START_MS, upgrade: UPGRADE_MS, program: (s.opts.timer || 0) * 1000 || RELAXED_MS }[s.phase];
  s.deadline = ms ? Date.now() + ms : 0;
  if (ms) ctx.timer('deadline', ms, onDeadline);
  if (s.phase === 'activate') ctx.timer('beat', 500, pump);
  if (s.phase === 'over') ctx.timer('deadline', 90_000, finish);
}

function onDeadline(ctx) {
  const s = ctx.state;
  const e = env(ctx);
  s.scheduled = null;
  if (s.phase === 'start') E.startRace(s, e);
  else if (s.phase === 'upgrade') E.startProgramming(s, e);
  else if (s.phase === 'program') E.beginActivation(s, e);
  drive(ctx);
}

/** Run the Activation Phase one beat at a time, so the big screen can animate each step. */
function pump(ctx) {
  const s = ctx.state;
  if (s.phase !== 'activate') return drive(ctx);
  const e = env(ctx);
  const beat = E.step(s, e);
  if (s.prompt) {
    ctx.timer('prompt', Math.max(0, s.prompt.deadline - Date.now()), (c) => {
      E.timeoutPrompt(c.state, env(c));
      pump(c);
    });
    if (beat) ctx.cancelTimer('beat');
    return;
  }
  if (beat) return ctx.timer('beat', beat.dur, pump);
  drive(ctx);
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
  if (['upgrades', 'lessDeadly', 'lessSpam'].includes(key) && typeof value === 'boolean') s.opts[key] = value;
  if (key === 'timer' && TIMERS.includes(value)) s.opts.timer = value;
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
    ctx.state = E.newGame({ order: ctx.players.map((p) => p.id), seed: Math.floor(Math.random() * 2 ** 31) });
  },

  onJoin(ctx, player) {
    const s = ctx.state;
    if ((s.phase !== 'setup' && s.phase !== 'start') || s.order.length >= 8) return false;
    if (!s.order.includes(player.id)) s.order.push(player.id);
  },

  onDisconnect(ctx, player) {
    const s = ctx.state;
    if (s.prompt?.id === player.id) {
      ctx.cancelTimer('prompt');
      E.timeoutPrompt(s, env(ctx));
      return pump(ctx);
    }
    drive(ctx);
  },

  actions: {
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
  },

  hostView(ctx) {
    const s = ctx.state;
    const course = getCourse(s.opts.course);
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
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
    return {
      phase: s.phase,
      round: s.round,
      reg: s.reg,
      opts: s.opts,
      deadline: s.deadline,
      prio: s.order[s.prio] ?? null,
      cps: course.checkpoints.length,
      inRace: s.order.includes(player.id),
      robots: s.order.map((id, seat) => publicRobot(ctx, id, seat, false)),
      me: R ? { ...privateRobot(R), rbAt: E.rebootPoint(s, env(ctx), R) } : null,
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
  const base = { id, seat, name: p?.name ?? '?', color: p?.color ?? '#888888', away: !p?.connected };
  if (!R) return { ...base, pick: s.picks[id] ?? null };
  const out = { ...base, x: R.x, y: R.y, d: R.d, on: R.on, rb: !!R.reboot, sd: R.shutdown, cp: R.cp, en: R.energy, ready: R.done };
  if (!forHost) return out;
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
