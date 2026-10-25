// The rules of Robo Rally, as plain functions on the game state. rules.js wires them to the
// framework (actions, timers, views); tests drive them directly.
//
// `s` is the game state (plain JSON). `env` is { course, connected(id), now() }.
// The Activation Phase runs as a queue of small tasks. Each task that visibly changes something
// becomes a "beat" ({ n, fx, dur, cap }) that the big screen animates before the next one runs.
// When a player has a choice (an upgrade that says "you may"), the queue pauses on `s.prompt`.

import { DX, DY, turn, cellAt, activeCell, wallBetween, inside, DIR_NAMES } from './board.js';
import { DECK, cardType, isDamage, isHaywire, HAYWIRE, PROGRAM, SPAM_COUNT, UPGRADES, UPGRADE_IDS, cardInfo } from './cards.js';

export const MAX_ENERGY = 10;
export const PROMPT_MS = 12000;
export const HAND_SIZE = 9;

// ---------- randomness (seeded, so tests can replay a game) ----------

export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle(s, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- a new game ----------

export function newGame({ order, opts = {}, seed = Date.now() }) {
  return {
    phase: 'setup', // setup -> start -> (upgrade -> program -> activate)* -> over
    opts: { course: 'closing-time', upgrades: true, timer: 120, lessDeadly: false, lessSpam: false, ...opts },
    order: [...order], // seats, clockwise
    prio: 0, // index in order of the Priority Token holder
    round: 0,
    reg: -1,
    robots: {},
    picks: {}, // start phase: player id -> start space number
    serial: 0,
    rng: seed | 0,
    damage: [],
    damageDiscard: [],
    upDeck: [],
    upDiscard: [],
    removed: [], // cards Self-Diagnostics took out of the game
    queue: [],
    beat: { n: 0, fx: [], dur: 0, cap: '' },
    prompt: null,
    winner: null,
    log: [],
    deadline: 0,
  };
}

const has = (R, key) => R.up.perm.includes(key);
const hasTemp = (R, key) => R.up.temp.includes(key);
export const robotList = (s) => s.order.map((id) => s.robots[id]).filter(Boolean);
const nameOf = (env, id) => env.name?.(id) ?? id;

function say(s, env, text) {
  s.log.push(text);
  if (s.log.length > 8) s.log.splice(0, s.log.length - 8);
}

/** Start the race: robots on their start spaces, decks shuffled, upgrades dealt. */
export function startRace(s, env) {
  const c = env.course;
  const free = c.starts.filter((st) => !Object.values(s.picks).includes(st.n));
  for (const id of s.order) {
    if (s.picks[id] == null) s.picks[id] = free.shift()?.n;
    const st = c.starts.find((x) => x.n === s.picks[id]) ?? c.starts[0];
    s.robots[id] = newRobot(s, id, st);
  }
  s.damage = shuffle(s, [
    ...Array.from({ length: SPAM_COUNT }, () => `sp.${++s.serial}`),
    ...Object.keys(HAYWIRE).map((t) => `${t}.${++s.serial}`),
  ]);
  s.upDeck = shuffle(s, UPGRADE_IDS);
  if (s.opts.upgrades) for (const R of robotList(s)) R.up.hand.push(...s.upDeck.splice(0, 3));
  s.prio = Math.floor(rand(s) * s.order.length);
  s.round = 1;
  say(s, env, `${nameOf(env, s.order[s.prio])} has the Priority Token`);
  s.opts.upgrades ? startUpgrade(s, env) : startProgramming(s, env);
}

function newRobot(s, id, st) {
  const deck = shuffle(s, DECK.flatMap(([t, n]) => Array.from({ length: n }, () => `${t}.${++s.serial}`)));
  return {
    id,
    x: st.x,
    y: st.y,
    d: st.d,
    on: true,
    reboot: null, // { b }: fell, comes back on board b at the start of next round
    lastBoard: null,
    archive: { x: st.x, y: st.y, d: st.d },
    start: st.n,
    energy: 3,
    cp: 0,
    deck,
    discard: [],
    hand: [],
    peek: null,
    regs: emptyRegs(),
    draft: null, // { regs: [[card]...5], keep: [] } while programming
    done: false,
    wantShutdown: false,
    shutdown: false,
    rebootDir: st.d,
    up: { perm: [], temp: [], hand: [] },
    bought: false,
    installed: false,
    tempPerm: [], // installed by a Haywire: gone at the end of the round
    memory: [],
    mustProgram: [],
    mustReturn: 0,
    hwChoice: {},
    armed: false,
    skipUp: false,
    afterWindow: false,
    autoShield: true,
    last: null,
    kata: false,
    storm: false,
    overcharge: 0,
    shieldReg: -1,
    weapon: null,
    stats: { pushes: 0, hits: 0, falls: 0, damage: 0 },
  };
}

const emptyRegs = () => Array.from({ length: 5 }, () => ({ cards: [], locked: false, next: null, up: false, extra: [] }));

// ---------- decks ----------

function drawProgram(s, R) {
  if (!R.deck.length && R.discard.length) R.deck = shuffle(s, R.discard.splice(0));
  return R.deck.shift() ?? null;
}

function drawDamage(s) {
  if (!s.damage.length && s.damageDiscard.length) s.damage = shuffle(s, s.damageDiscard.splice(0));
  return s.damage.shift() ?? null;
}

function drawUpgrade(s) {
  if (!s.upDeck.length && s.upDiscard.length) s.upDeck = shuffle(s, s.upDiscard.splice(0));
  return s.upDeck.shift() ?? null;
}

/** Where a card goes when it leaves a register or hand: Haywires to the damage pile, the rest (SPAM too) to your discard. */
function discardCard(s, R, card) {
  if (isHaywire(card)) s.damageDiscard.push(card);
  else R.discard.push(card);
}

function gainEnergy(s, env, R, n) {
  if (!s.opts.upgrades) return;
  const before = R.energy;
  R.energy = Math.min(MAX_ENERGY, R.energy + n);
  if (R.energy > before) fx(s, { k: 'en', id: R.id, n: R.energy - before });
}

// ---------- the Upgrade Phase ----------

export function startUpgrade(s, env) {
  s.phase = 'upgrade';
  s.reg = -1;
  for (const R of robotList(s)) {
    R.done = false;
    R.bought = false;
    R.installed = false;
    if (R.memory.length) R.hand.push(...R.memory.splice(0)); // Memory Cards
  }
}

export function buyUpgrade(s, env, R) {
  if (s.phase !== 'upgrade') return 'Only in the Upgrade Phase';
  if (R.bought) return 'You can draw 1 upgrade per round';
  if (R.energy < 1) return 'You need 1 Energy';
  const card = drawUpgrade(s);
  if (!card) return 'The upgrade deck is empty';
  R.energy -= 1;
  R.bought = true;
  R.up.hand.push(card);
  return null;
}

export function installUpgrade(s, env, R, card, replace) {
  if (s.phase !== 'upgrade') return 'Only in the Upgrade Phase';
  if (R.installed) return 'You can install 1 upgrade per round';
  if (!R.up.hand.includes(card)) return 'That upgrade is not in your collection';
  const info = UPGRADES[card];
  if (R.energy < info.cost) return `${info.name} costs ${info.cost} Energy`;
  const slots = info.kind === 'perm' ? R.up.perm : R.up.temp;
  if (slots.length >= 3) {
    if (!slots.includes(replace)) return `You already have 3 ${info.kind === 'perm' ? 'permanent' : 'temporary'} upgrades: pick one to replace`;
    slots.splice(slots.indexOf(replace), 1);
    s.upDiscard.push(replace);
  }
  R.energy -= info.cost;
  R.up.hand.splice(R.up.hand.indexOf(card), 1);
  slots.push(card);
  R.installed = true;
  say(s, env, `${nameOf(env, R.id)} installed ${info.name}`);
  return null;
}

export function uninstallUpgrade(s, env, R, card) {
  if (s.phase !== 'upgrade') return 'Only in the Upgrade Phase';
  for (const list of [R.up.perm, R.up.temp]) {
    const i = list.indexOf(card);
    if (i >= 0) {
      list.splice(i, 1);
      R.tempPerm = R.tempPerm.filter((k) => k !== card);
      s.upDiscard.push(card);
      return null;
    }
  }
  return 'Not installed';
}

/** Temporary upgrades used outside the Activation Phase. */
export function useTemp(s, env, R, card, payload = {}) {
  if (!hasTemp(R, card)) return 'You do not have that upgrade installed';
  const when = UPGRADES[card].when;
  const phase = s.phase;
  const allowed =
    when === 'any' ? phase === 'upgrade' || phase === 'program'
      : when === 'upgrade' ? phase === 'upgrade'
        : when === 'program' ? phase === 'program' || phase === 'upgrade'
          : false;
  if (!allowed) return when === 'upgrade' ? 'Only in the Upgrade Phase' : 'Use it on your turn during the race (arm your upgrades)';
  if (R.done && phase === 'program') return 'Unlock your program first';
  switch (card) {
    case 'recharge':
      R.energy = Math.min(MAX_ENERGY, R.energy + 3);
      break;
    case 're-initialize': {
      const i = s.order.indexOf(payload.target);
      if (i < 0) return 'Pick who gets the Priority Token';
      s.prio = i;
      say(s, env, `${nameOf(env, R.id)} gave the Priority Token to ${nameOf(env, payload.target)}`);
      break;
    }
    case 'calibration-protocol': {
      const dmg = R.hand.filter((c) => isDamage(c) && !R.mustProgram.includes(c));
      if (!dmg.length) return 'No damage cards in your hand';
      R.hand = R.hand.filter((c) => !dmg.includes(c));
      s.damageDiscard.push(...dmg);
      for (let i = 0; i < dmg.length; i++) {
        const c = drawProgram(s, R);
        if (c) R.hand.push(c);
      }
      cleanDraft(R);
      break;
    }
    case 'memory-swap':
      for (let i = 0; i < 3; i++) {
        const c = drawProgram(s, R);
        if (c) R.hand.push(c);
      }
      R.mustReturn = Math.min(3, R.hand.length);
      break;
    case 'rewire': {
      const hw = [];
      for (const reg of R.regs) {
        if (reg.locked && reg.cards.length) {
          hw.push(...reg.cards);
          reg.cards = [];
          reg.locked = false;
        }
      }
      if (!hw.length) return 'No Haywires in your registers';
      R.hand.push(...hw);
      R.mustProgram.push(...hw);
      break;
    }
    default:
      return 'Use it on your turn during the race';
  }
  R.up.temp.splice(R.up.temp.indexOf(card), 1);
  s.upDiscard.push(card);
  return null;
}

/** Memory Swap: put 3 cards from your hand on top of your deck (first = top). */
export function returnCards(s, env, R, cards) {
  if (!R.mustReturn) return 'Nothing to put back';
  if (!Array.isArray(cards) || cards.length !== R.mustReturn || new Set(cards).size !== cards.length) return `Pick ${R.mustReturn} cards`;
  if (!cards.every((c) => R.hand.includes(c))) return 'Pick cards from your hand';
  R.hand = R.hand.filter((c) => !cards.includes(c));
  R.deck.unshift(...cards);
  R.mustReturn = 0;
  cleanDraft(R);
  return null;
}

// ---------- the Programming Phase ----------

export function startProgramming(s, env) {
  s.phase = 'program';
  s.reg = -1;
  for (const R of robotList(s)) {
    const size = HAND_SIZE + (has(R, 'flash-drive') ? 1 : 0);
    while (R.hand.length < size) {
      const c = drawProgram(s, R);
      if (!c) break;
      R.hand.push(c);
    }
    if (has(R, 'spam-filter')) {
      if (!R.deck.length && R.discard.length) R.deck = shuffle(s, R.discard.splice(0));
      R.peek = R.deck[0] ?? null;
    } else R.peek = null;
    R.done = false;
    R.draft = null;
    R.wantShutdown = false;
    R.armed = false;
    R.skipUp = false;
    if (R.reboot) R.rebootDir ??= 1;
  }
}

/** Check a program: regs is 5 lists of card ids (empty for a register holding a face-down Haywire). */
export function checkProgram(R, regs, { partial = false } = {}) {
  if (!Array.isArray(regs) || regs.length !== 5) return 'Fill all 5 registers';
  const used = new Set();
  for (let i = 0; i < 5; i++) {
    const list = regs[i];
    if (!Array.isArray(list)) return 'Bad register';
    if (R.regs[i].locked) {
      if (list.length) return `Register ${i + 1} holds a Haywire`;
      continue;
    }
    if (!list.length) {
      if (partial) continue;
      return 'Fill all 5 registers';
    }
    if (list.length > 2) return 'Too many cards in one register';
    for (const c of list) {
      if (typeof c !== 'string' || !R.hand.includes(c)) return 'That card is not in your hand';
      if (used.has(c)) return 'Each card can only go in one register';
      used.add(c);
    }
    if (list.length === 2) {
      const types = list.map(cardType).sort();
      const ok = has(R, 'crab-legs') && types[0] === 'm1' && (types[1] === 'rl' || types[1] === 'rr');
      if (!ok) return 'Only Crab Legs lets you stack a Move 1 with a Rotate';
    }
  }
  if (!partial) {
    for (const c of R.mustProgram) if (!used.has(c)) return 'Program every Haywire you rewired';
  }
  return null;
}

/** Save what a phone has placed so far (used for the Act Fast fill-in if time runs out). */
export function saveDraft(s, R, regs) {
  if (s.phase !== 'program' || R.done) return 'Not now';
  const err = checkProgram(R, regs, { partial: true });
  if (err) return err;
  R.draft = { regs: regs.map((l) => [...l]), keep: R.draft?.keep ?? [] };
  return null;
}

export function lockProgram(s, env, R, p = {}) {
  if (s.phase !== 'program') return 'Programming is over';
  if (R.mustReturn) return `Put ${R.mustReturn} card${R.mustReturn === 1 ? '' : 's'} back on your deck first`;
  if (R.reboot && [0, 1, 2, 3].includes(p.rebootDir)) R.rebootDir = p.rebootDir;
  if (p.shutdown) {
    R.wantShutdown = true;
    R.draft = null;
    R.done = true;
    return null;
  }
  const err = checkProgram(R, p.regs);
  if (err) return err;
  const keep = Array.isArray(p.keep) && has(R, 'memory-cards') ? p.keep.filter((c) => R.hand.includes(c) && !isDamage(c) && !p.regs.flat().includes(c)) : [];
  R.hwChoice = {};
  for (const [card, choice] of Object.entries(p.hw ?? {})) {
    if (typeof choice === 'string' && choice.length < 40) R.hwChoice[card] = choice;
  }
  R.draft = { regs: p.regs.map((l) => [...l]), keep };
  R.wantShutdown = false;
  R.done = true;
  return null;
}

export function unlockProgram(s, R) {
  if (s.phase !== 'program') return 'Programming is over';
  R.done = false;
  R.wantShutdown = false;
  return null;
}

function cleanDraft(R) {
  if (!R.draft) return;
  R.draft.regs = R.draft.regs.map((l) => (l.every((c) => R.hand.includes(c)) ? l : []));
  R.draft.keep = (R.draft.keep ?? []).filter((c) => R.hand.includes(c));
}

/** Act Fast: time is up, so empty registers get random cards from the hand. */
export function autoProgram(s, env, R) {
  if (R.done) return;
  if (R.mustReturn) returnCards(s, env, R, R.hand.slice(-R.mustReturn));
  cleanDraft(R);
  const regs = R.draft && !checkProgram(R, R.draft.regs, { partial: true }) ? R.draft.regs.map((l) => [...l]) : [[], [], [], [], []];
  const used = new Set(regs.flat());
  const must = R.mustProgram.filter((c) => !used.has(c) && R.hand.includes(c));
  const pool = [...must, ...shuffle(s, R.hand.filter((c) => !used.has(c) && !must.includes(c)))];
  for (let i = 0; i < 5; i++) {
    if (R.regs[i].locked || regs[i].length) continue;
    const c = pool.shift();
    if (c) regs[i] = [c];
  }
  R.draft = { regs, keep: [] };
  R.done = true;
}

// ---------- the Activation Phase ----------

export function priorityOrder(s) {
  const n = s.order.length;
  return Array.from({ length: n }, (_, i) => s.order[(s.prio + i) % n]).filter((id) => s.robots[id]);
}

export function beginActivation(s, env) {
  for (const R of robotList(s)) {
    if (!R.done) autoProgram(s, env, R);
    finishProgramming(s, env, R);
  }
  s.phase = 'activate';
  s.reg = -1;
  s.queue = [];
  s.prompt = null;
  nextRegister(s, env);
}

function finishProgramming(s, env, R) {
  if (R.wantShutdown) {
    // Shutdown: every damage card (registers, hand, discard) goes back to the damage pile; the rest to the discard.
    for (const reg of R.regs) {
      for (const c of reg.cards) (isDamage(c) ? s.damageDiscard : R.discard).push(c);
      Object.assign(reg, { cards: [], locked: false, next: null, up: false, extra: [] });
    }
    for (const c of R.hand) (isDamage(c) ? s.damageDiscard : R.discard).push(c);
    R.hand = [];
    s.damageDiscard.push(...R.discard.filter(isDamage));
    R.discard = R.discard.filter((c) => !isDamage(c));
    R.shutdown = true;
    R.mustProgram = [];
    R.draft = null;
    say(s, env, `${nameOf(env, R.id)} shut down to clear their damage`);
    return;
  }
  const regs = R.draft?.regs ?? [[], [], [], [], []];
  for (let i = 0; i < 5; i++) {
    const reg = R.regs[i];
    if (reg.locked) continue;
    reg.cards = regs[i].filter((c) => R.hand.includes(c));
    R.hand = R.hand.filter((c) => !reg.cards.includes(c));
  }
  const keep = R.draft?.keep ?? [];
  R.memory = R.hand.filter((c) => keep.includes(c));
  const left = R.hand.filter((c) => !keep.includes(c));
  R.hand = [];
  for (const c of left) {
    if (isHaywire(c)) s.damageDiscard.push(c); // a rewired Haywire that wasn't programmed
    else if (cardType(c) === 'sp' && !s.opts.lessSpam) R.hand.push(c); // SPAM stays in your hand
    else R.discard.push(c);
  }
  R.mustProgram = [];
  R.draft = null;
}

function nextRegister(s, env) {
  s.reg++;
  if (s.reg >= 5) return endRound(s, env);
  for (const R of robotList(s)) {
    R.kata = false;
    R.storm = false;
    R.overcharge = 0;
    R.weapon = null;
    R.afterWindow = false;
  }
  s.queue = [
    { t: 'reveal' },
    ...priorityOrder(s).map((id) => ({ t: 'act', id })),
    { t: 'belts', fast: true },
    { t: 'belts', fast: false },
    { t: 'push' },
    { t: 'gears' },
    { t: 'blasers' },
    { t: 'rweapons' },
    { t: 'batteries' },
    { t: 'checkpoints' },
  ];
}

function endRound(s, env) {
  for (const R of robotList(s)) {
    for (const reg of R.regs) {
      for (const c of [...reg.cards, ...reg.extra]) {
        if (isDamage(c)) s.damageDiscard.push(c);
        else R.discard.push(c);
      }
      Object.assign(reg, { cards: reg.next ? [reg.next] : [], locked: !!reg.next, next: null, up: false, extra: [] });
    }
    for (const k of R.tempPerm) {
      const i = R.up.perm.indexOf(k);
      if (i >= 0) {
        R.up.perm.splice(i, 1);
        s.upDiscard.push(k);
      }
    }
    R.tempPerm = [];
    R.shutdown = false;
    R.wantShutdown = false;
    R.done = false;
    R.last = null;
    R.armed = false;
    R.skipUp = false;
  }
  s.prio = (s.prio + 1) % s.order.length;
  s.round++;
  s.reg = -1;
  s.queue = [];
  s.opts.upgrades ? startUpgrade(s, env) : startProgramming(s, env);
}

// ---------- running the queue ----------

function fx(s, f) {
  s.fxBuf?.push(f); // only while a task runs: effects outside the Activation Phase are not animated
}

/**
 * Run tasks until one makes a beat to show, a player has to choose, or the phase ends.
 * Returns the beat (or null).
 */
export function step(s, env) {
  for (let guard = 0; guard < 400; guard++) {
    if (s.phase !== 'activate' || s.prompt) return null;
    if (!s.queue.length) {
      nextRegister(s, env);
      continue;
    }
    const task = s.queue.shift();
    s.fxBuf = [];
    s.paths = {};
    s.cap = null;
    s.what = WHAT[task.t] ? { k: WHAT[task.t], fast: task.fast } : null;
    runTask(s, env, task);
    const list = [...Object.entries(s.paths).map(([id, path]) => ({ k: 'move', id, path })), ...s.fxBuf];
    const cap = s.cap;
    const what = s.what;
    delete s.fxBuf;
    delete s.paths;
    delete s.cap;
    delete s.what;
    if (list.length) {
      s.beat = { n: s.beat.n + 1, fx: list, dur: beatTime(list), cap: cap ?? s.beat.cap, reg: s.reg, what: what ?? s.beat.what ?? null };
      return s.beat;
    }
  }
  return null;
}

// what a task shows, for screens that draw it instead of saying it
const WHAT = { reveal: 'reveal', belts: 'belt', push: 'push', gears: 'gear', blasers: 'blaser', fire: 'rlaser', batteries: 'battery', checkpoints: 'cp' };

function beatTime(list) {
  let ms = 350;
  for (const f of list) {
    if (f.k === 'move') ms = Math.max(ms, 200 + (f.path.length - 1) * 330);
    else if (f.k === 'turn') ms = Math.max(ms, 600);
    else if (f.k === 'beam') ms = Math.max(ms, 1000);
    else if (f.k === 'fall') ms = Math.max(ms, 1300);
    else if (f.k === 'reveal') ms = Math.max(ms, 1300);
    else if (f.k === 'reboot') ms = Math.max(ms, 1100);
    else if (f.k === 'cp') ms = Math.max(ms, 1400);
    else if (f.k === 'win') ms = Math.max(ms, 3000);
    else if (f.k === 'replace') ms = Math.max(ms, 1200);
    else if (f.k === 'dmg') ms = Math.max(ms, 900);
    else ms = Math.max(ms, 700);
  }
  return ms;
}

function runTask(s, env, task) {
  const R = task.id ? s.robots[task.id] : null;
  switch (task.t) {
    case 'reveal': {
      for (const X of robotList(s)) if (X.on && !X.shutdown && X.regs[s.reg].cards.length) X.regs[s.reg].up = true;
      for (const X of robotList(s)) if (!X.on && X.reboot && X.reboot.round < s.round && s.reg === 0 && X.regs[0].cards.length) X.regs[0].up = true;
      s.cap = `Register ${s.reg + 1}`;
      fx(s, { k: 'reveal', reg: s.reg });
      return;
    }
    case 'act': return taskAct(s, env, R);
    case 'window': return openWindow(s, env, R, task.when);
    case 'card': return taskCard(s, env, R, task);
    case 'sub': return playCard(s, env, R, task.card, 'sub', task);
    case 'op': return runOp(s, env, R, task);
    case 'slide': {
      if (!R.on || R.shutdown) return;
      const name = UPGRADES[task.key].name;
      return ask(s, env, {
        id: R.id, kind: 'slide', icon: task.key, title: name, text: 'Move 1 space forward?',
        options: [{ v: 'yes', label: 'Slide forward' }, { v: 'no', label: 'Stay' }], def: 'no',
      });
    }
    case 'temp': return runTempMove(s, env, R, task.v);
    case 'belts': return void runBelts(s, env, task.fast, task.only, task.second);
    case 'push': return runPushers(s, env);
    case 'gears': return runGears(s, env);
    case 'blasers': return runBoardLasers(s, env);
    case 'econv': {
      if (!R.on || !has(R, 'energy-conversion')) return;
      return ask(s, env, {
        id: R.id, kind: 'econv', icon: 'energy-conversion', title: 'Energy Conversion', text: 'A board laser hit you. Move 1 space?',
        options: [{ v: 'fwd', label: 'Forward' }, { v: 'back', label: 'Back' }, { v: 'no', label: 'Stay' }], def: 'no',
      });
    }
    case 'rweapons': {
      const next = [];
      for (const id of priorityOrder(s)) {
        const X = s.robots[id];
        if (X.on && !X.shutdown && weaponOptions(s, env, X).length) next.push({ t: 'wchoice', id });
      }
      s.queue.unshift(...next, { t: 'fire' });
      return;
    }
    case 'wchoice': {
      const opts = R.on && !R.shutdown ? weaponOptions(s, env, R) : [];
      if (!opts.length) return;
      return ask(s, env, {
        id: R.id, kind: 'weapon', icon: null, target: opts.target, title: 'Robot weapons', text: `Your laser has ${nameOf(env, opts.target)} in its sights.`,
        options: [{ v: 'main', label: 'Main laser' }, ...opts.map((k) => ({ v: k, label: UPGRADES[k].name, sub: weaponHint(k) }))],
        def: 'main',
      });
    }
    case 'fire': return fireAll(s, env);
    case 'batteries': {
      if (!s.opts.upgrades) return;
      for (const X of robotList(s)) {
        if (X.on && !X.shutdown && activeCell(env.course, X.x, X.y)?.k === 'battery') gainEnergy(s, env, X, 1);
      }
      return;
    }
    case 'checkpoints': return runCheckpoints(s, env);
    case 'selfdiag': return askSelfDiag(s, env, R);
    case 'abort': {
      const reg = R.regs[s.reg];
      for (const c of reg.cards) discardCard(s, R, c);
      const top = drawProgram(s, R);
      reg.cards = top ? [top] : [];
      fx(s, { k: 'replace', id: R.id, from: 'abort', to: top ? cardType(top) : null });
      s.cap = `${nameOf(env, R.id)}: Abort Switch`;
      s.what = { k: 'upgrade', id: R.id, key: 'abort-switch' };
      return;
    }
    case 'drill': {
      const T = s.robots[task.target];
      if (!T) return;
      fx(s, { k: 'say', id: R.id, text: '🪛' });
      takeDamage(s, env, T, 1, 'drill');
      if (T.on) rotate(s, T, ((task.dir - T.d + 4) % 4 === 3 ? -1 : (task.dir - T.d + 4) % 4));
      return;
    }
    case 'pierce': return askPierce(s, env, R, task.targets);
    case 'chassis': return askChassis(s, env, R, task.targets);
    case 'magnet': return askMagnet(s, env, R, task);
  }
}

// ----- a robot's turn in the current register -----

function taskAct(s, env, R) {
  if (!R) return;
  if (s.reg === 0 && !R.on && R.reboot && R.reboot.round < s.round) reenter(s, env, R);
  if (!R.on || R.shutdown) return;
  if (!R.regs[s.reg].cards.length) return;
  const next = [];
  if (R.armed && !R.skipUp && windowOptions(s, env, R, 'before').length) next.push({ t: 'window', id: R.id, when: 'before' });
  next.push({ t: 'card', id: R.id });
  s.queue.unshift(...next);
}

function taskCard(s, env, R, task) {
  if (!R.on || R.shutdown) return;
  const reg = R.regs[s.reg];
  const cards = reg.cards;
  if (!cards.length) return;
  s.cap = `${nameOf(env, R.id)}: ${cards.map((c) => cardInfo(c).name).join(' + ')}`;
  s.what = { k: 'card', id: R.id, cards: cards.map(cardType) };
  fx(s, { k: 'play', id: R.id, cards: cards.map(cardType) });
  if (cards.length === 2) {
    // Crab Legs: a Move 1 stacked on a Rotate steps sideways without turning
    const rot = cards.find((c) => cardType(c) === 'rr' || cardType(c) === 'rl');
    R.last = { ops: [['mv', 0, 1]] }; // Again repeats only the second card
    s.queue.unshift({ t: 'op', id: R.id, op: ['mv', cardType(rot) === 'rr' ? 1 : 3, 1], card: true }, ...afterCard(R, null));
    fx(s, { k: 'say', id: R.id, text: '🦀' });
    return;
  }
  return playCard(s, env, R, cards[0], 'reg', task);
}

/** Run one programming/damage card. `where` is 'reg' (the register's own card) or 'sub' (Double Program). */
function playCard(s, env, R, card, where, task) {
  if (!R.on || R.shutdown) return;
  const t = cardType(card);
  const reg = R.regs[s.reg];
  if (t === 'sp' || (t === 'ag' && s.reg === 0)) {
    // SPAM (or Again in Register 1): out it goes, and the top card of the deck takes its place
    if (t === 'sp') {
      s.damageDiscard.push(card);
      if (s.reg < 3 && has(R, 'chaos-theory') && !task.repl) gainEnergy(s, env, R, 1);
    } else R.discard.push(card);
    const repl = drawProgram(s, R);
    if (where === 'reg') reg.cards = repl ? [repl] : [];
    else {
      reg.extra = reg.extra.filter((c) => c !== card);
      if (repl) reg.extra.push(repl);
    }
    fx(s, { k: 'replace', id: R.id, from: t, to: repl ? cardType(repl) : null });
    s.cap = `${nameOf(env, R.id)}: ${PROGRAM[t].name} → ${repl ? cardInfo(repl).name : 'nothing'}`;
    s.what = { k: 'card', id: R.id, cards: [t, repl ? cardType(repl) : null].filter(Boolean), replaced: true };
    if (repl) s.queue.unshift(where === 'reg' ? { t: 'card', id: R.id, repl: true } : { t: 'sub', id: R.id, card: repl, repl: true });
    return;
  }
  if (t === 'm1' && where === 'reg' && has(R, 'brakes') && task.braked === undefined) {
    return ask(s, env, {
      id: R.id, kind: 'brakes', icon: 'brakes', title: 'Brakes', text: 'Your Move 1 is up. Hit the brakes?',
      options: [{ v: 'go', label: 'Move 1' }, { v: 'brake', label: 'Brake (Move 0)' }], def: 'go',
    });
  }
  if (t === 'ag') {
    const ops = R.last?.ops ?? [];
    s.queue.unshift(...ops.map((op) => ({ t: 'op', id: R.id, op, card: true })), ...afterCard(R, null));
    fx(s, { k: 'say', id: R.id, text: '⟳' });
    return;
  }
  if (t === 'h10') {
    // Double Program: the top 2 cards of the deck go in this register and both run
    const a = drawProgram(s, R);
    const b = drawProgram(s, R);
    const both = [a, b].filter(Boolean);
    reg.extra.push(...both);
    fx(s, { k: 'say', id: R.id, text: '✌️' });
    s.queue.unshift(...both.map((c) => ({ t: 'sub', id: R.id, card: c })), ...afterCard(R, null));
    return;
  }
  const ops = cardOps(R, card, task.braked);
  R.last = { ops: t === 'm1' ? [['mv', 0, 1]] : ops };
  if (task.braked) fx(s, { k: 'say', id: R.id, text: '🛑' });
  const tasks = ops.map((op) => ({ t: 'op', id: R.id, op, card: true }));
  // a no-op card (Brakes) still shows a beat so everyone sees it was played
  if (!ops.length) fx(s, { k: 'say', id: R.id, text: '·' });
  if (t === 'rr' && has(R, 'power-slide')) tasks.push({ t: 'slide', id: R.id, key: 'power-slide' });
  if (t === 'rl' && has(R, 'drifting')) tasks.push({ t: 'slide', id: R.id, key: 'drifting' });
  s.queue.unshift(...tasks, ...(where === 'reg' ? afterCard(R, card) : []));
}

/** The "use after my card" upgrade window, if the player asked for it. */
function afterCard(R) {
  if (!R.afterWindow) return [];
  R.afterWindow = false;
  return [{ t: 'window', id: R.id, when: 'after' }];
}

function cardOps(R, card, braked) {
  const t = cardType(card);
  switch (t) {
    case 'm1': return braked ? [] : [['mv', 0, 1]];
    case 'm2': return [['mv', 0, 2]];
    case 'm3': return [['mv', 0, 3]];
    case 'bk': return [['mv', 2, 1]];
    case 'rr': return [['rt', 1]];
    case 'rl': return [['rt', -1]];
    case 'ut': return [['rt', 2]];
    case 'pu': return [['en', 1]];
  }
  const hw = HAYWIRE[t];
  if (!hw) return [];
  return hw.ops.map((op) => {
    if (op[0] === 'mv' && op[1] === 'side') return ['mv', R.hwChoice[card] === 'left' ? 3 : 1, op[2]];
    if (op[0] === 'install') return ['install', R.hwChoice[card] ?? null];
    return op;
  });
}

function runOp(s, env, R, task) {
  if (!R.on) return;
  const [kind, a, b, c] = task.op;
  switch (kind) {
    case 'mv':
      moveRobot(s, env, R, turn(R.d, a), b, { card: !!task.card, wallHurt: c === 'wallhurt' });
      return;
    case 'rt':
      rotate(s, R, a);
      if (a === 2 && has(R, 'laser-kata')) R.kata = true;
      return;
    case 'spin': {
      const d = Math.floor(rand(s) * 4);
      rotate(s, R, turn(d - R.d, 0) || 0);
      if (d === R.d) fx(s, { k: 'say', id: R.id, text: '🌀' });
      return;
    }
    case 'en':
      gainEnergy(s, env, R, a);
      if (!s.opts.upgrades) fx(s, { k: 'say', id: R.id, text: '⚡' });
      return;
    case 'dmg':
      takeDamage(s, env, R, a, 'haywire');
      return;
    case 'install': {
      const perms = R.up.hand.filter((k) => UPGRADES[k].kind === 'perm');
      const key = perms.includes(a) ? a : perms[0];
      if (!key) return fx(s, { k: 'say', id: R.id, text: '🔧✖' });
      R.up.hand.splice(R.up.hand.indexOf(key), 1);
      R.up.perm.push(key);
      R.tempPerm.push(key);
      fx(s, { k: 'say', id: R.id, text: '🔧', up: key });
      return;
    }
    case 'storm':
      R.storm = true;
      return fx(s, { k: 'say', id: R.id, text: '✴️' });
    case 'overcharge':
      R.overcharge = 2;
      return fx(s, { k: 'say', id: R.id, text: '🔥' });
    case 'swap': {
      const target = traceShot(s, env, R.x, R.y, R.d, {}).hits[0];
      if (!target) return fx(s, { k: 'say', id: R.id, text: '🔀✖' });
      swapRobots(s, env, R, target);
      return;
    }
    case 'emp': {
      fx(s, { k: 'emp', id: R.id });
      for (const X of adjacentRobots(s, env, R)) takeDamage(s, env, X, 1, 'haywire');
      return;
    }
    case 'mvabs': // Magnetic: tag along in an absolute direction
      moveRobot(s, env, R, a, b, {});
      return;
    case 'double':
      return; // handled in playCard
  }
}

function rotate(s, R, n) {
  if (!n) return;
  R.d = turn(R.d, n);
  fx(s, { k: 'turn', id: R.id, by: n === 3 ? -1 : n === -3 ? 1 : n });
}

// ----- moving and pushing -----

export function robotAt(s, x, y) {
  for (const id of s.order) {
    const R = s.robots[id];
    if (R?.on && R.x === x && R.y === y) return R;
  }
  return null;
}

/** A wall in the way, or (Less Deadly variant) the edge of the course. */
function blocked(s, env, x, y, d) {
  if (wallBetween(env.course, x, y, d)) return true;
  return s.opts.lessDeadly && !cellAt(env.course, x + DX[d], y + DY[d]);
}

function notePath(s, R) {
  const p = (s.paths[R.id] ??= [[R.x, R.y]]);
  return p;
}

/** Put a robot on a space (it has already been decided that it can go there). Falls if it should. */
function placeRobot(s, env, R, x, y, { hover = false } = {}) {
  notePath(s, R).push([x, y]);
  R.x = x;
  R.y = y;
  const cell = cellAt(env.course, x, y);
  if (!cell) return fall(s, env, R, 'edge');
  R.lastBoard = cell.b;
  if (cell.k === 'pit' && !hover) fall(s, env, R, 'pit');
}

/**
 * One space toward d, pushing any robots in the way. Returns
 * { ok, why: 'wall'|'push'|'robot', pushed: [ids it pushed or tried to push] }.
 */
function stepRobot(s, env, R, d, o = {}) {
  if (blocked(s, env, R.x, R.y, d)) return { ok: false, why: 'wall', pushed: [] };
  const nx = R.x + DX[d];
  const ny = R.y + DY[d];
  const Q = robotAt(s, nx, ny);
  if (!Q) {
    placeRobot(s, env, R, nx, ny, o);
    return { ok: true, pushed: [] };
  }
  if (o.noPush) return { ok: false, why: 'robot', pushed: [] };
  const chain = [Q];
  for (;;) {
    const last = chain[chain.length - 1];
    if (blocked(s, env, last.x, last.y, d)) {
      spiky(s, env, [R, ...chain]);
      return { ok: false, why: 'push', pushed: [Q.id] }; // a push into a wall: everyone stops
    }
    const A = robotAt(s, last.x + DX[d], last.y + DY[d]);
    if (!A) break;
    chain.push(A);
  }
  spiky(s, env, [R, ...chain]);
  for (let i = chain.length - 1; i >= 0; i--) {
    const X = chain[i];
    if (X.on) placeRobot(s, env, X, X.x + DX[d], X.y + DY[d]);
  }
  placeRobot(s, env, R, nx, ny, o);
  return { ok: true, pushed: [Q.id] };
}

/** Spiky: whoever moves (or is pushed) into a Spiky robot's space takes 1 damage. */
function spiky(s, env, line) {
  for (let i = 0; i + 1 < line.length; i++) {
    if (has(line[i + 1], 'spiky')) takeDamage(s, env, line[i], 1, 'spiky');
  }
}

/** Move n spaces toward d. Returns how many spaces it actually moved. */
function moveRobot(s, env, R, d, n, o = {}) {
  const from = { x: R.x, y: R.y };
  const hover = o.card && has(R, 'hover-unit');
  const pushed = new Set();
  let moved = 0;
  let hitWall = false;
  for (let i = 0; i < n && R.on; i++) {
    const res = stepRobot(s, env, R, d, { hover, noPush: o.noPush });
    for (const id of res.pushed) pushed.add(id);
    if (!res.ok) {
      hitWall = res.why === 'wall';
      break;
    }
    moved++;
  }
  if (!s.paths[R.id]) notePath(s, R); // even a bump shows
  if (hover && R.on && cellAt(env.course, R.x, R.y)?.k === 'pit') fall(s, env, R, 'pit');
  if (o.wallHurt && hitWall && R.on) takeDamage(s, env, R, 1, 'haywire');
  if (o.card && pushed.size) {
    R.stats.pushes += pushed.size;
    if (has(R, 'ramming-gear')) for (const id of pushed) takeDamage(s, env, s.robots[id], 1, 'ram');
    const after = [];
    if (hasTemp(R, 'piercing-drill') && R.on) after.push({ t: 'pierce', id: R.id, targets: [...pushed] });
    if (has(R, 'modular-chassis') && R.on) after.push({ t: 'chassis', id: R.id, targets: [...pushed] });
    s.queue.unshift(...after);
  }
  if (o.card && moved > 0) {
    // Magnetic: robots that were next to this one may tag along
    const tags = [];
    for (const M of robotList(s)) {
      if (M === R || !M.on || M.shutdown || !hasTemp(M, 'magnetic') || pushed.has(M.id)) continue;
      const dx = M.x - from.x;
      const dy = M.y - from.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const side = [0, 1, 2, 3].find((k) => DX[k] === dx && DY[k] === dy);
      if (wallBetween(env.course, from.x, from.y, side)) continue;
      tags.push({ t: 'magnet', id: M.id, leader: R.id, d, n: moved });
    }
    s.queue.unshift(...tags);
  }
  return moved;
}

function swapRobots(s, env, A, B) {
  const ax = A.x;
  const ay = A.y;
  notePath(s, A);
  notePath(s, B);
  placeRobot(s, env, A, B.x, B.y);
  placeRobot(s, env, B, ax, ay);
}

function adjacentRobots(s, env, R) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    if (wallBetween(env.course, R.x, R.y, d)) continue;
    const X = robotAt(s, R.x + DX[d], R.y + DY[d]);
    if (X) out.push(X);
  }
  return out;
}

// ----- falling and rebooting -----

function fall(s, env, R, kind) {
  if (!R.on) return;
  R.on = false;
  const b = cellAt(env.course, R.x, R.y)?.b ?? R.lastBoard ?? 0;
  R.reboot = { b, round: s.round };
  R.stats.falls++;
  fx(s, { k: 'fall', id: R.id, x: R.x, y: R.y, edge: kind === 'edge' });
  say(s, env, `${nameOf(env, R.id)} ${kind === 'edge' ? 'drove off the edge' : 'fell into a pit'}`);
  // The rest of this round's program is cancelled; registers and hand are emptied.
  for (const reg of R.regs) {
    for (const c of [...reg.cards, ...reg.extra]) discardCard(s, R, c);
    if (reg.next) s.damageDiscard.push(reg.next);
    Object.assign(reg, { cards: [], locked: false, next: null, up: false, extra: [] });
  }
  for (const c of R.hand) discardCard(s, R, c);
  R.hand = [];
  R.mustProgram = [];
  const n = kind === 'pit' && has(R, 'firewall') ? 0 : 2;
  takeDamage(s, env, R, n, 'reboot');
}

/** Where a robot that fell will come back: its board's Reboot token (the Docking Bay: its start space). */
export function rebootPoint(s, env, R) {
  return R.reboot ? rebootSpot(s, env, R, R.reboot.b) : null;
}

function rebootSpot(s, env, R, b) {
  const board = env.course.boards[b];
  if (!board || board.dock || !board.reboot) return { ...R.archive };
  return { ...board.reboot };
}

/** Put a robot on a space that may be taken: the robot there is moved 1 space along the token's arrow. */
function landOn(s, env, R, spot) {
  const Q = robotAt(s, spot.x, spot.y);
  if (Q && Q !== R) {
    for (const k of [0, 1, 3, 2]) {
      const d = turn(spot.d, k);
      if (stepRobot(s, env, Q, d, {}).ok || !Q.on) break;
    }
  }
  let target = spot;
  if (robotAt(s, spot.x, spot.y)) target = nearestFree(s, env, spot) ?? spot;
  return target;
}

function nearestFree(s, env, from) {
  const c = env.course;
  const seen = new Set([`${from.x},${from.y}`]);
  const q = [from];
  while (q.length) {
    const p = q.shift();
    const cell = cellAt(c, p.x, p.y);
    if (cell && cell.k !== 'pit' && !robotAt(s, p.x, p.y)) return p;
    for (let d = 0; d < 4; d++) {
      const n = { x: p.x + DX[d], y: p.y + DY[d] };
      if (!inside(c, n.x, n.y) || seen.has(`${n.x},${n.y}`)) continue;
      seen.add(`${n.x},${n.y}`);
      q.push(n);
    }
  }
  return null;
}

function reenter(s, env, R) {
  const spot = rebootSpot(s, env, R, R.reboot.b);
  const at = landOn(s, env, R, spot);
  R.x = at.x;
  R.y = at.y;
  R.d = [0, 1, 2, 3].includes(R.rebootDir) ? R.rebootDir : spot.d;
  R.on = true;
  R.lastBoard = cellAt(env.course, at.x, at.y)?.b ?? R.lastBoard;
  R.reboot = null;
  fx(s, { k: 'reboot', id: R.id, x: R.x, y: R.y });
  s.cap = `${nameOf(env, R.id)} reboots`;
  s.what = { k: 'reboot', id: R.id };
}

// ----- damage -----

export function takeDamage(s, env, R, n, source) {
  if (n <= 0) return;
  if (source === 'laser' || source === 'weapon') {
    if (R.shieldReg === s.reg) return;
    if (has(R, 'deflector-shield') && R.autoShield && R.energy >= 1) {
      R.energy--;
      R.shieldReg = s.reg;
      fx(s, { k: 'shield', id: R.id });
      return;
    }
  }
  let sp = 0;
  let hw = 0;
  for (let i = 0; i < n; i++) {
    const card = drawDamage(s);
    if (!card) break; // the damage deck is empty: no damage
    if (isHaywire(card)) {
      const reg = R.regs[Math.max(0, s.reg)];
      if (reg.next) s.damageDiscard.push(card); // only 1 face-down Haywire per register
      else {
        reg.next = card;
        hw++;
      }
    } else {
      R.discard.push(card);
      sp++;
    }
  }
  R.stats.damage += sp + hw;
  if (sp + hw) fx(s, { k: 'dmg', id: R.id, sp, hw, src: source });
}

// ----- board elements -----

function runBelts(s, env, fast, only, second) {
  const c = env.course;
  const plans = [];
  for (const R of robotList(s)) {
    if (!R.on || (only && !only.includes(R.id))) continue;
    const cell = activeCell(c, R.x, R.y);
    if (cell?.k !== 'belt' || cell.fast !== fast) continue;
    const d = cell.d;
    plans.push({ R, d, x: R.x + DX[d], y: R.y + DY[d], ok: !blocked(s, env, R.x, R.y, d) });
  }
  if (!plans.length) return [];
  // Settle conflicts: a robot only moves if its way is clear once everyone else has (or hasn't) moved.
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of plans) {
      if (!p.ok) continue;
      const rival = plans.find((q) => q !== p && q.ok && q.x === p.x && q.y === p.y);
      const occupant = robotAt(s, p.x, p.y);
      const occPlan = occupant && plans.find((q) => q.R === occupant);
      const headOn = occPlan && occPlan.ok && occPlan.x === p.R.x && occPlan.y === p.R.y;
      if (rival || (occupant && (!occPlan || !occPlan.ok)) || headOn) {
        p.ok = false;
        if (rival) rival.ok = false;
        if (headOn) occPlan.ok = false;
        changed = true;
      }
    }
  }
  const movers = plans.filter((p) => p.ok);
  // move everyone at once: take them all off first so they don't bump into each other
  for (const p of movers) {
    notePath(s, p.R);
    p.R.x = -100;
  }
  for (const p of movers) {
    placeRobot(s, env, p.R, p.x, p.y);
    const to = activeCell(c, p.x, p.y);
    if (p.R.on && to?.k === 'belt' && to.d !== p.d) rotate(s, p.R, turn(to.d - p.d, 0) === 1 ? 1 : -1);
  }
  if (fast && !second) {
    // blue belts carry a robot a second space if the first one went from blue belt to blue belt
    const again = movers.filter((p) => p.R.on && activeCell(c, p.R.x, p.R.y)?.k === 'belt' && activeCell(c, p.R.x, p.R.y).fast);
    if (again.length) s.queue.unshift({ t: 'belts', fast: true, only: again.map((p) => p.R.id), second: true });
  }
  return movers;
}

function runPushers(s, env) {
  for (const p of env.course.pushers) {
    if (!p.regs.includes(s.reg + 1)) continue;
    const R = robotAt(s, p.x, p.y);
    if (!R) continue;
    fx(s, { k: 'pusher', x: p.x, y: p.y, side: p.side });
    stepRobot(s, env, R, turn(p.side, 2), {});
  }
}

function runGears(s, env) {
  for (const R of robotList(s)) {
    if (!R.on) continue;
    const cell = activeCell(env.course, R.x, R.y);
    if (cell?.k !== 'gear') continue;
    rotate(s, R, cell.spin);
    fx(s, { k: 'gear', x: R.x, y: R.y, spin: cell.spin });
  }
}

/** The robots a beam from x,y toward d would hit: the first one (or all of them with throughRobots). */
export function traceShot(s, env, x, y, d, { includeStart = false, throughWalls = false, throughRobots = false } = {}) {
  const c = env.course;
  const hits = [];
  let cx = x;
  let cy = y;
  let end = { x, y };
  if (includeStart) {
    const R = robotAt(s, x, y);
    if (R) {
      hits.push(R);
      if (!throughRobots) return { hits, end };
    }
  }
  for (let i = 0; i < 64; i++) {
    if (!throughWalls && wallBetween(c, cx, cy, d)) break;
    cx += DX[d];
    cy += DY[d];
    if (!inside(c, cx, cy)) break;
    end = { x: cx, y: cy };
    const R = robotAt(s, cx, cy);
    if (R) {
      hits.push(R);
      if (!throughRobots) break;
    }
  }
  return { hits, end };
}

function runBoardLasers(s, env) {
  const hit = [];
  for (const L of env.course.lasers) {
    const { hits, end } = traceShot(s, env, L.x, L.y, L.d, { includeStart: true });
    fx(s, { k: 'beam', board: true, x0: L.x, y0: L.y, x1: end.x, y1: end.y, d: L.d, n: L.n, hit: hits.map((r) => r.id) });
    for (const R of hits) {
      takeDamage(s, env, R, L.n, 'laser');
      hit.push(R.id);
    }
  }
  // only show the beat if somebody was standing in a beam
  if (!hit.length) s.fxBuf = s.fxBuf.filter((f) => f.k !== 'beam');
  else s.cap = 'Board lasers';
  const conv = [...new Set(hit)].filter((id) => has(s.robots[id], 'energy-conversion') && s.robots[id].on);
  s.queue.unshift(...conv.map((id) => ({ t: 'econv', id })));
}

// ----- robot weapons -----

function weaponOptions(s, env, R) {
  const target = traceShot(s, env, R.x, R.y, R.d, {}).hits[0];
  const out = [];
  if (!target) return out;
  if (has(R, 'mini-howitzer') && R.energy >= 1) out.push('mini-howitzer');
  if (has(R, 'pressor-beam')) out.push('pressor-beam');
  if (has(R, 'scrambler') && s.reg < 4) out.push('scrambler');
  if (has(R, 'tractor-beam') && Math.abs(target.x - R.x) + Math.abs(target.y - R.y) > 1) out.push('tractor-beam');
  if (hasTemp(R, 'displacing-blast')) out.push('displacing-blast');
  out.target = target.id;
  return out;
}

const weaponHint = (k) =>
  ({
    'mini-howitzer': '1 Energy: 2 damage + push',
    'pressor-beam': 'Push it 1 space away',
    'scrambler': 'Scramble its next register',
    'tractor-beam': 'Pull it 1 space closer',
    'displacing-blast': 'Send it to the Reboot token (one use)',
  })[k] ?? '';

function fireAll(s, env) {
  let shots = 0;
  for (const id of priorityOrder(s)) {
    const R = s.robots[id];
    if (!R.on || R.shutdown) continue;
    const dmg = 1 + (has(R, 'double-barrel') ? 1 : 0) + R.overcharge;
    const rail = has(R, 'rail-gun');
    const dirs = R.kata || R.storm ? [0, 1, 2, 3].map((k) => turn(R.d, k)) : [R.d];
    for (const d of dirs) {
      if (d === R.d && R.weapon && R.weapon !== 'main') {
        shots += fireSpecial(s, env, R, R.weapon);
        continue;
      }
      const { hits, end } = traceShot(s, env, R.x, R.y, d, { throughWalls: rail, throughRobots: rail });
      if (!hits.length) continue; // a laser that hits nothing isn't worth showing
      fx(s, { k: 'beam', src: R.id, x0: R.x, y0: R.y, x1: rail ? end.x : hits[0].x, y1: rail ? end.y : hits[0].y, d, n: dmg, hit: hits.map((h) => h.id) });
      for (const X of hits) {
        if (!X.on) continue;
        takeDamage(s, env, X, dmg, 'laser');
        R.stats.hits++;
      }
      shots++;
    }
    if (has(R, 'rear-laser')) {
      const d = turn(R.d, 2);
      const { hits } = traceShot(s, env, R.x, R.y, d, {});
      if (hits.length) {
        fx(s, { k: 'beam', src: R.id, x0: R.x, y0: R.y, x1: hits[0].x, y1: hits[0].y, d, n: 1, hit: [hits[0].id], rear: true });
        takeDamage(s, env, hits[0], 1, 'laser');
        R.stats.hits++;
        shots++;
      }
    }
  }
  if (shots) s.cap = 'Robot lasers';
}

function fireSpecial(s, env, R, key) {
  const T = traceShot(s, env, R.x, R.y, R.d, {}).hits[0];
  if (!T) return 0;
  fx(s, { k: 'beam', src: R.id, x0: R.x, y0: R.y, x1: T.x, y1: T.y, d: R.d, n: 1, hit: [T.id], special: key });
  R.stats.hits++;
  switch (key) {
    case 'mini-howitzer':
      if (R.energy < 1) return 1;
      R.energy--;
      takeDamage(s, env, T, 2, 'weapon');
      if (T.on) stepRobot(s, env, T, R.d, {});
      break;
    case 'pressor-beam':
      stepRobot(s, env, T, R.d, {});
      break;
    case 'tractor-beam':
      stepRobot(s, env, T, turn(R.d, 2), {});
      break;
    case 'scrambler': {
      const reg = T.regs[s.reg + 1];
      if (!reg) break;
      const top = drawProgram(s, T);
      for (const c of reg.cards) (isDamage(c) ? s.damageDiscard : T.discard).push(c);
      reg.cards = top ? [top] : [];
      reg.locked = false;
      fx(s, { k: 'say', id: T.id, text: '📡' });
      break;
    }
    case 'displacing-blast': {
      R.up.temp.splice(R.up.temp.indexOf(key), 1);
      s.upDiscard.push(key);
      const b = cellAt(env.course, T.x, T.y)?.b ?? 0;
      const spot = rebootSpot(s, env, T, b);
      notePath(s, T);
      T.x = -100;
      const at = landOn(s, env, T, spot);
      placeRobot(s, env, T, at.x, at.y);
      break;
    }
  }
  return 1;
}

// ----- end of register -----

function runCheckpoints(s, env) {
  const total = env.course.checkpoints.length;
  for (const id of priorityOrder(s)) {
    const R = s.robots[id];
    if (!R.on || R.shutdown) continue;
    const cp = env.course.checkpoints.find((p) => p.x === R.x && p.y === R.y);
    if (!cp || cp.n !== R.cp + 1) continue;
    R.cp = cp.n;
    fx(s, { k: 'cp', id, n: cp.n });
    say(s, env, `${nameOf(env, id)} reached Checkpoint ${cp.n}`);
    if (R.cp >= total) {
      s.winner = id;
      s.phase = 'over';
      s.queue = [];
      s.prompt = null;
      fx(s, { k: 'win', id });
      s.cap = `${nameOf(env, id)} wins!`;
      say(s, env, `${nameOf(env, id)} wins the race!`);
      return;
    }
    if (has(R, 'self-diagnostics')) s.queue.unshift({ t: 'selfdiag', id });
  }
}

// ---------- choices ("you may…") ----------

function ask(s, env, p) {
  if (!env.connected(p.id)) return resolvePrompt(s, env, p, p.def); // nobody's there to ask
  s.prompt = { ...p, deadline: env.now() + PROMPT_MS };
}

export function answerPrompt(s, env, pid, v) {
  const p = s.prompt;
  if (!p || p.id !== pid) return 'Too late';
  if (!p.options.some((o) => o.v === v)) return 'Pick one of the options';
  s.prompt = null;
  resolvePrompt(s, env, p, v);
  return null;
}

export function timeoutPrompt(s, env) {
  const p = s.prompt;
  if (!p) return;
  s.prompt = null;
  resolvePrompt(s, env, p, p.def);
}

function resolvePrompt(s, env, p, v) {
  const R = s.robots[p.id];
  if (!R) return;
  switch (p.kind) {
    case 'brakes':
      s.queue.unshift({ t: 'card', id: R.id, braked: v === 'brake' });
      return;
    case 'slide':
      if (v === 'yes') s.queue.unshift({ t: 'op', id: R.id, op: ['mv', 0, 1] });
      return;
    case 'econv':
      if (v !== 'no') s.queue.unshift({ t: 'op', id: R.id, op: ['mv', v === 'fwd' ? 0 : 2, 1] });
      return;
    case 'weapon':
      R.weapon = v;
      return;
    case 'window':
      return resolveWindow(s, env, R, p, v);
    case 'lucky': {
      const hw = p.data.card;
      const reg = R.regs[s.reg];
      if (v === 'use') {
        for (const c of reg.cards) discardCard(s, R, c);
        reg.cards = [hw];
        s.cap = `${nameOf(env, R.id)}: Lucky Booster`;
      } else s.damageDiscard.push(hw);
      return;
    }
    case 'pierce': {
      if (v === 'no') return;
      const [tid, dir] = v.split(':');
      R.up.temp.splice(R.up.temp.indexOf('piercing-drill'), 1);
      s.upDiscard.push('piercing-drill');
      s.queue.unshift({ t: 'drill', id: R.id, target: tid, dir: Number(dir) });
      return;
    }
    case 'chassis': {
      if (v === 'no') return;
      const [tid, key] = v.split(':');
      const T = s.robots[tid];
      if (!T) return;
      const tl = T.up.perm.includes(key) ? T.up.perm : T.up.temp;
      if (!tl.includes(key)) return;
      tl.splice(tl.indexOf(key), 1);
      (UPGRADES[key].kind === 'perm' ? R.up.perm : R.up.temp).push(key);
      R.up.perm.splice(R.up.perm.indexOf('modular-chassis'), 1);
      T.up.perm.push('modular-chassis');
      say(s, env, `${nameOf(env, R.id)} took ${UPGRADES[key].name} from ${nameOf(env, T.id)}`);
      return;
    }
    case 'magnet':
      if (v === 'yes') {
        R.up.temp.splice(R.up.temp.indexOf('magnetic'), 1);
        s.upDiscard.push('magnetic');
        s.queue.unshift({ t: 'op', id: R.id, op: ['mvabs', p.data.d, p.data.n] });
      }
      return;
    case 'selfdiag': {
      if (v === 'no') return;
      for (const pile of [R.discard, R.hand]) {
        const i = pile.findIndex((c) => cardType(c) === v);
        if (i >= 0) {
          s.removed.push(...pile.splice(i, 1));
          say(s, env, `${nameOf(env, R.id)} deleted a ${cardInfo(v).name} card`);
          return;
        }
      }
      return;
    }
  }
}

// The "upgrade window": a player armed their temporary upgrades, and their turn has come.
export function windowOptions(s, env, R, when) {
  const o = [];
  if (!R.on) return o;
  if (when === 'before') {
    if (hasTemp(R, 'abort-switch')) o.push({ v: 'abort', label: 'Abort Switch', sub: 'Redraw this register' });
    if (hasTemp(R, 'lucky-booster')) o.push({ v: 'lucky', label: 'Lucky Booster', sub: 'Find a Haywire to run instead' });
  }
  if (hasTemp(R, 'overclocked')) o.push({ v: 'overclocked', label: 'Overclocked', sub: 'Move 2' });
  if (hasTemp(R, 'pressure-release')) o.push({ v: 'pressure-release', label: 'Pressure Release', sub: 'Back up to 5' });
  if (hasTemp(R, 'all-aboard')) o.push({ v: 'all-aboard', label: 'All Aboard', sub: 'Ride the conveyors' });
  if (hasTemp(R, 'boink')) {
    for (let k = 0; k < 4; k++) {
      const d = turn(R.d, k);
      const nx = R.x + DX[d];
      const ny = R.y + DY[d];
      if (!wallBetween(env.course, R.x, R.y, d) && cellAt(env.course, nx, ny) && !robotAt(s, nx, ny)) {
        o.push({ v: `boink:${d}`, label: 'Boink', sub: ['Hop forward', 'Hop right', 'Hop back', 'Hop left'][k] });
      }
    }
  }
  if (hasTemp(R, 'zoop')) {
    for (const k of [1, 3, 2]) o.push({ v: `zoop:${turn(R.d, k)}`, label: 'Zoop', sub: { 1: 'Face right', 3: 'Face left', 2: 'Turn around' }[k] });
  }
  if (hasTemp(R, 'switch')) {
    for (const X of adjacentRobots(s, env, R)) o.push({ v: `switch:${X.id}`, label: 'Switch', sub: `Swap with ${nameOf(env, X.id)}` });
  }
  return o;
}

function openWindow(s, env, R, when) {
  if (!R.on || R.shutdown || R.skipUp) return;
  const opts = windowOptions(s, env, R, when);
  if (!opts.length) return;
  const moves = opts.some((o) => !['abort', 'lucky'].includes(o.v));
  const reg = R.regs[s.reg];
  ask(s, env, {
    id: R.id,
    kind: 'window',
    icon: null,
    card: reg.cards.map(cardType),
    when,
    title: when === 'before' ? 'Your turn' : 'After your card',
    text: when === 'before' ? `Up next: ${reg.cards.map((c) => cardInfo(c).name).join(' + ') || 'nothing'}. Use an upgrade first?` : 'Use an upgrade now?',
    options: [
      { v: 'go', label: when === 'before' ? 'Run my card' : 'Done' },
      ...opts,
      ...(when === 'before' && moves ? [{ v: 'after', label: 'After my card…', sub: 'Ask me again once it runs' }] : []),
      { v: 'skip', label: 'No more this round' },
    ],
    def: 'go',
  });
}

function resolveWindow(s, env, R, p, v) {
  if (v === 'go') {
    R.armed = false;
    return;
  }
  if (v === 'skip') {
    R.skipUp = true;
    R.armed = false;
    return;
  }
  if (v === 'after') {
    R.afterWindow = true;
    R.armed = false;
    return;
  }
  const consume = (key) => {
    R.up.temp.splice(R.up.temp.indexOf(key), 1);
    s.upDiscard.push(key);
  };
  if (v === 'abort') {
    consume('abort-switch');
    s.queue.unshift({ t: 'abort', id: R.id }, { t: 'window', id: R.id, when: p.when });
    return;
  }
  if (v === 'lucky') {
    consume('lucky-booster');
    let found = null;
    for (let i = 0; i < 40 && !found; i++) {
      const c = drawDamage(s);
      if (!c) break;
      if (isHaywire(c)) found = c;
      else s.damageDiscard.push(c);
    }
    if (!found) return;
    return ask(s, env, {
      id: R.id, kind: 'lucky', icon: 'lucky-booster', data: { card: found }, title: 'Lucky Booster',
      text: `You found "${cardInfo(found).name}"${HAYWIRE[cardType(found)].text ? `: ${HAYWIRE[cardType(found)].text}` : ''}. Run it instead of your card?`,
      options: [{ v: 'use', label: 'Run the Haywire' }, { v: 'no', label: 'Discard it' }], def: 'no',
    });
  }
  const [key] = v.split(':');
  consume(key);
  s.queue.unshift({ t: 'temp', id: R.id, v }, { t: 'window', id: R.id, when: p.when });
}

function runTempMove(s, env, R, v) {
  if (!R.on) return;
  const [key, arg] = v.split(':');
  s.cap = `${nameOf(env, R.id)}: ${UPGRADES[key].name}`;
  s.what = { k: 'upgrade', id: R.id, key };
  switch (key) {
    case 'overclocked':
      moveRobot(s, env, R, R.d, 2, {});
      return;
    case 'pressure-release':
      moveRobot(s, env, R, turn(R.d, 2), 5, { noPush: true });
      return;
    case 'boink': {
      const d = Number(arg);
      if (!wallBetween(env.course, R.x, R.y, d) && !robotAt(s, R.x + DX[d], R.y + DY[d])) placeRobot(s, env, R, R.x + DX[d], R.y + DY[d]);
      else fx(s, { k: 'say', id: R.id, text: '🦘✖' });
      return;
    }
    case 'zoop': {
      const by = turn(Number(arg) - R.d, 0);
      rotate(s, R, by === 3 ? -1 : by);
      return;
    }
    case 'switch': {
      const X = s.robots[arg];
      if (X?.on && adjacentRobots(s, env, R).includes(X)) swapRobots(s, env, R, X);
      return;
    }
    case 'all-aboard': {
      // blue belts (which queue their own second step), then green, for this robot only
      const i = s.queue.length;
      runBelts(s, env, true, [R.id]);
      const added = s.queue.splice(0, s.queue.length - i);
      s.queue.unshift(...added, { t: 'belts', fast: false, only: [R.id] });
      return;
    }
  }
}

function askSelfDiag(s, env, R) {
  const types = new Map();
  for (const c of [...R.hand, ...R.discard]) types.set(cardType(c), (types.get(cardType(c)) ?? 0) + 1);
  if (!types.size) return;
  const order = ['sp', 'ag', 'bk', 'ut', 'rl', 'rr', 'm1', 'pu', 'm2', 'm3'];
  const options = [...types.keys()]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((t) => ({ v: t, label: `Delete ${cardInfo(t).name}`, sub: `${types.get(t)} in hand/discard` }));
  ask(s, env, {
    id: R.id, kind: 'selfdiag', icon: 'self-diagnostics', title: 'Self-Diagnostics', text: 'Checkpoint! Remove one card from your deck for good?',
    options: [...options, { v: 'no', label: 'Keep everything' }], def: types.has('sp') ? 'sp' : 'no',
  });
}

function askPierce(s, env, R, targets) {
  if (!hasTemp(R, 'piercing-drill')) return;
  const T = targets.map((id) => s.robots[id]).find((X) => X?.on);
  if (!T) return;
  ask(s, env, {
    id: R.id, kind: 'pierce', icon: 'piercing-drill', target: T.id, title: 'Piercing Drill', text: `You pushed ${nameOf(env, T.id)}. Drill them (1 damage) and turn them?`,
    options: [
      ...[0, 1, 2, 3].map((d) => ({ v: `${T.id}:${d}`, label: `Face ${DIR_NAMES[d]}`, sub: d === T.d ? 'no turn' : '' })),
      { v: 'no', label: 'Save it' },
    ],
    def: 'no',
  });
}

function askChassis(s, env, R, targets) {
  if (!has(R, 'modular-chassis')) return;
  const options = [];
  for (const id of targets) {
    const T = s.robots[id];
    for (const key of [...T.up.perm, ...T.up.temp]) options.push({ v: `${id}:${key}`, label: `Take ${UPGRADES[key].name}`, sub: `from ${nameOf(env, id)}` });
  }
  if (!options.length) return;
  ask(s, env, {
    id: R.id, kind: 'chassis', icon: 'modular-chassis', title: 'Modular Chassis', text: 'Trade your Modular Chassis for one of their upgrades?',
    options: [...options, { v: 'no', label: 'No trade' }], def: 'no',
  });
}

function askMagnet(s, env, R, task) {
  if (!R.on || !hasTemp(R, 'magnetic')) return;
  ask(s, env, {
    id: R.id, kind: 'magnet', icon: 'magnetic', data: { d: task.d, n: task.n }, leader: task.leader, title: 'Magnetic',
    text: `${nameOf(env, task.leader)} moved ${task.n} space${task.n === 1 ? '' : 's'} ${DIR_NAMES[task.d]}. Stick with them?`,
    options: [{ v: 'yes', label: 'Move with them' }, { v: 'no', label: 'Stay put' }], def: 'no',
  });
}
