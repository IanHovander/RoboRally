// The Briefing's film: a narrated show on the big screen between the draw for start pads and round 1 (the
// rules put the game in phase 'brief'). Floor Control, the store's after-hours computer, says one short line
// per shot over the right animation: the real course with the players' robots, and tiny lesson boards
// (lessons.js) run by the real rules.
// The big screen plays it when the leader's "Rules tutorial" option is on: the full rules (about 70 seconds),
// for everyone. Otherwise a newcomer gets the reel instead (sizzle.js), and learns the rest by doing: their
// phone gets the test drive (practice.js; the rules' practice stage), and the race's first-time callouts
// (teach.js) say each other rule the first time it happens.
// (Without that option this file still has its short cut, about half a minute: whose robot is whose, the
// flags in order, five cards in five slots, and that turns are the robot's own. Nothing plays it now.)
// A majority of phones, Esc / Space / Enter, or the ⏭ button skip it; → jumps to the next shot.
// It borrows the host's arena (one WebGL context) and hands it back as it found it.
// Script and storyboard: docs/teaching/design.md, section 3.2.
import { BRIEF, LESSONS, lessonCourse, runLesson, playRun } from './lessons.js';
import { getCourse } from './board.js';
import { spoken, NUMBER, junkCards, topMargin } from './teach.js';
import { riseCards } from './mimic.js';

const STOP = Symbol('briefing shot over');
const TEMPO = 1.7; // lessons play this much faster than the race (the voice sets the pace here)
const GAP = 300; // a breath between shots
const FADE = 350; // a lesson board fades out, then the next fades in (teach.css: .lm-host.briefing .lm-3d)
const LIGHT = '#f4efe4';
const AMBER = '#ffc56e';
const DEMO_COLORS = ['#ff4d6d', '#4dabf7', '#ffd43b', '#69db7c'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// the lesson runs, worked out once (the same seeds every time, so every Briefing looks the same)
let RUNS = null;
const runs = () =>
  (RUNS ??= {
    stop: runLesson(BRIEF.stop, 11),
    order: runLesson(BRIEF.order, 11),
    push: runLesson(BRIEF.push, 11),
    program: runLesson(LESSONS[0], 11),
    damage: runLesson(LESSONS[2], 13),
  });

// where the board sits: the whole course, or a small lesson board; shifted right while the phone shows
const FRAMES = {
  real: { top: 0.2, bottom: 0.4, left: 0.04, right: 0.04, headroom: 2.95 }, // (host.js's race frame)
  realPhone: { top: 0.2, bottom: 0.4, left: 0.42, right: 0.04, headroom: 2.95 },
  lesson: { top: 0.34, bottom: 0.52, left: 0.5, right: 0.5, headroom: null },
  lessonPhone: { top: 0.34, bottom: 0.52, left: 0.78, right: 0.26, headroom: null },
  // a phone held upright: the phone lies under the board, above the robots along the bottom
  tallPhone: { bottom: 0.84, left: 0.04, right: 0.04 },
};
const tall = () => innerWidth < innerHeight;

/**
 * Start the Briefing. ctx:
 *   arena                  the host's scene (scene.js)
 *   view()                 the latest host view
 *   robots()               the players' robots as the scene shows them (on their pads)
 *   voice, line            the narrator (voice.js) and its line of light (teach.js)
 *   mimic                  the phone beside the board (mimic.js)
 *   layer                  the host's overlay layer (cards rising)
 *   box3d                  the 3D view's box (it fades between boards)
 *   blackout(on, ms)       the screen to black (on) or up from it
 *   regs(n | null)         the race's 1-5 strip, register n lit
 *   roster                 { light(id, on), prioTo(id), prioPulse(), shop() }
 *   done()                 it played to the end
 * Returns { stop(), next() }.
 */
export function startBriefing(ctx) {
  const { arena, voice, line, mimic, layer, box3d } = ctx;
  const v0 = ctx.view();
  const real = getCourse(v0.opts.course);
  const R = runs();
  let stopped = false;
  let gen = 0;
  const pending = new Set(); // the current shot's waits: a jump or a stop ends them at once
  let continuous = false; // the last shot ended normally, so a shot that continues it can carry on as is

  const sleep = (ms) =>
    new Promise((resolve, reject) => {
      const my = gen;
      const rec = { reject };
      pending.add(rec);
      rec.t = setTimeout(() => {
        pending.delete(rec);
        if (stopped || my !== gen) reject(STOP);
        else resolve();
      }, ms);
    });
  const abortShot = () => {
    gen++;
    for (const rec of pending) {
      clearTimeout(rec.t);
      rec.reject(STOP);
    }
    pending.clear();
    voice.cancel();
  };
  const alive = (my) => !stopped && my === gen;

  /** Say a line (with the line of light rippling). Resolves when it's said, or read, or cut. */
  async function say(text, { id, chirp = true, onStart } = {}) {
    const my = gen;
    if (!alive(my)) return;
    line.speaking(true);
    await voice.say(text, { id, chirp, onStart, onWord: () => line.word() });
    if (alive(my)) line.speaking(false);
  }

  // lesson robot i wears racer i's colors (seat order), no names: they're not the players' own robots
  const cast = (i) => {
    const r = v0.robots[i];
    return r ? { name: '', color: r.color, avatar: r.avatar ?? i } : { name: '', color: DEMO_COLORS[i % DEMO_COLORS.length], avatar: i };
  };
  const robotsAt = (list) => list.map((r, i) => ({ ...r, ...cast(i), seat: i }));
  const snapshot = (run, i) => robotsAt(i <= 0 ? run.start : [...run.steps.slice(0, i)].reverse().find((st) => st.robots)?.robots ?? run.start);

  /** Put a board on the glass: the real course with the players' robots, or a lesson at step `from`. */
  async function board({ course, robots, frame, cam = 'drift', calm = false, keep = false }) {
    if (!(keep && arena.course === course)) {
      box3d.style.opacity = '0';
      await sleep(FADE);
      arena.reset(course);
      arena.syncRobots(robots);
    }
    arena.calmWin = calm;
    arena.camMode = cam;
    arena.tempo = course === real ? 1 : TEMPO;
    arena.setFrame(frame);
    arena.setShutdown(null);
    box3d.style.opacity = '1';
  }
  // the real course: framed as in the race (lower still while subtitles show, so they never sit on it)
  const realFrame = (phone) => ({ ...(phone ? FRAMES.realPhone : FRAMES.real), ...(phone && tall() ? FRAMES.tallPhone : {}), top: topMargin(true) });
  const realBoard = (o = {}) => board({ course: real, robots: ctx.robots(), frame: realFrame(o.phone), cam: o.cam ?? 'drift', keep: o.keep ?? true });
  const lessonBoard = (def, run, from, o = {}) =>
    board({ course: lessonCourse(def), robots: snapshot(run, from), frame: o.phone ? { ...FRAMES.lessonPhone, ...(tall() ? FRAMES.tallPhone : {}) } : FRAMES.lesson, cam: 'lesson', calm: true, keep: o.keep });
  /** Show the real course if the arena isn't on it (a fade), without rebuilding it if it is. */
  const toReal = async (o = {}) => {
    if (arena.course !== real) return realBoard({ ...o, keep: false });
    arena.calmWin = false;
    arena.tempo = 1;
    arena.camMode = o.cam ?? 'drift';
    arena.setFrame(realFrame(o.phone));
    box3d.style.opacity = '1';
  };
  const phone = (on) => (on ? mimic.show() : mimic.hide());
  const play = (run, o = {}) => {
    arena.tempo = o.tempo ?? TEMPO;
    return playRun(arena, run, { pause: sleep, cast, winHold: 1500, tempo: TEMPO, ...o });
  };
  const stepIndex = (run, pred) => run.steps.findIndex(pred);

  // ----- the shots (section 3.2) -----
  const v = v0;
  const shots = [];
  const shot = (name, run, when = true) => when && shots.push({ name, run });
  const full = !!v.opts.brief; // the leader's "Rules tutorial": every shot (otherwise only the ones a first race needs)
  const toDrive = Object.keys(v.brief?.practice ?? {}).length > 0; // someone's phone gets the test drive after this

  // A shot's line starts as its board fades in: `ready` is the board, `after(ready, fn)` its animation.
  const after = async (ready, fn) => {
    await ready;
    await fn();
  };

  shot('online', async () => {
    ctx.blackout(true, 0);
    arena.tagsOnly = new Set(); // no names yet: the roll call gives each robot its name
    await toReal({ cam: 'orbit' });
    arena.traceOn(2.4);
    line.show({ progress: 0, drawIn: true });
    await sleep(80);
    ctx.blackout(false, 2000);
    await Promise.all([say('Floor Control online. Store closed. Robot race: engaged.', { id: 'brief-1' }), sleep(3000)]);
  });

  shot('roll call', async () => {
    await toReal({ cam: 'drift' });
    arena.tagsOnly ??= new Set();
    ctx.roster.rollCall(true);
    await say('Robots on the dock.', { id: 'brief-2' });
    let prev = null;
    for (const r of v.robots) {
      if (r.x == null) continue;
      await say(spoken(r.name, r.seat), {
        id: 'brief-2-name',
        chirp: false,
        onStart: () => {
          if (prev) arena.raise(prev, false);
          arena.raise(r.id, true);
          arena.tagsOnly?.add(r.id);
          ctx.roster.light(r.id);
          prev = r.id;
        },
      });
    }
    if (prev) arena.raise(prev, false);
    ctx.roster.light(null);
    await say('Find yours.', { id: 'brief-2-end', chirp: false });
    ctx.roster.rollCall(false);
  });

  shot('flags', async () => {
    await toReal({ cam: 'drift' });
    const cps = [...real.checkpoints].sort((a, b) => a.n - b.n);
    const starts = real.starts;
    const dock = { x: Math.round(starts.reduce((s, p) => s + p.x, 0) / starts.length), y: Math.round(starts.reduce((s, p) => s + p.y, 0) / starts.length) };
    const upTo = (n) => cps.slice(0, n).map((cp, i) => ({ x: cp.x, y: cp.y, n: null, path: [i ? [cps[i - 1].x, cps[i - 1].y] : [dock.x, dock.y], [cp.x, cp.y]] }));
    await say('Objective: the flags, in order.', { id: 'brief-3' });
    for (const cp of cps) {
      await say(`${cap(NUMBER[cp.n] ?? String(cp.n))}.`, {
        id: 'brief-3-n',
        chirp: false,
        onStart: () => {
          arena.spotlight(cp.x, cp.y, { hold: 0.45, k: 0.12 });
          arena.flashFlag(cp.n, LIGHT, { strength: 1.4 });
          arena.ghostPath(upTo(cp.n), LIGHT);
        },
      });
    }
    const last = cps.at(-1);
    await say('First to the last flag wins.', {
      id: 'brief-3-end',
      chirp: false,
      onStart: () => setTimeout(() => !stopped && arena.flashFlag(last.n, '#ffffff', { strength: 2.4 }), 1100),
    });
    arena.clearGhost();
  });

  shot('stop', async () => {
    const run = R.stop;
    const flag = lessonCourse(BRIEF.stop).checkpoints[0];
    const ready = lessonBoard(BRIEF.stop, run, 1);
    await Promise.all([
      say("Stop on a flag, or it doesn't count.", { id: 'brief-4' }),
      after(ready, () =>
        play(run, {
          from: 1,
          winHold: 1000,
          onBeat: (st) => {
            // Move 3 drives over the flag: it stutters, and a cross pops over it
            if (st.reg === 0 && st.beat.fx.some((f) => f.k === 'move' && f.path.some(([x, y]) => x === flag.x && y === flag.y))) {
              setTimeout(() => {
                if (stopped) return;
                arena.flashFlag(flag.n, LIGHT, { flicker: true });
                arena.popAt(flag.x, flag.y, 'cross', LIGHT, '', { y: 1.9, height: 0.5 });
              }, 650);
            }
          },
        }),
      ),
    ]);
  }, full);

  const slot2 = stepIndex(R.program, (st) => st.kind === 'beat' && st.reg === 1 && st.beat.what?.k === 'reveal');

  shot('program', async () => {
    const run = R.program;
    const ready = lessonBoard(LESSONS[0], run, 0, { phone: true });
    mimic.reset();
    phone(true);
    await Promise.all([
      (async () => {
        await say('Each round, your phone deals cards. Fill five slots.', { id: 'brief-5' });
        await say('Slot one runs first.', { id: 'brief-5b', chirp: false, onStart: () => mimic.lit(0) });
      })(),
      after(ready, () => play(run, { to: slot2, mimic, slow: () => true, fast: true, line: true })),
    ]);
  });

  shot('own left', async () => {
    const run = R.program;
    let ready = null;
    if (!continuous || arena.course !== lessonCourse(LESSONS[0])) {
      ready = (async () => {
        await lessonBoard(LESSONS[0], run, slot2, { phone: true });
        mimic.reset();
        phone(true);
        await mimic.program(run.steps[0].cards[0], { pause: sleep, color: cast(0).color });
      })();
    }
    await Promise.all([say("Left and right are the robot's own. Trust the line on your phone.", { id: 'brief-6' }), after(ready, () => play(run, { from: slot2, mimic, winHold: 1000 }))]);
    arena.clearGhost();
    mimic.lit(-1);
  });

  shot('order', async () => {
    phone(false);
    const run = R.order;
    const ready = lessonBoard(BRIEF.order, run, 1);
    await Promise.all([say('Everyone plays slot one, the robot marked one first. Then the floor moves. Then slot two.', { id: 'brief-7' }), after(ready, () => play(run, { from: 1, regs: ctx.regs }))]);
    ctx.regs(null);
  }, full);

  shot('priority', async () => {
    const ready = toReal();
    const ids = v.robots.map((r) => r.id);
    const holder = ctx.view().prio ?? ids[0];
    const next = ids[(ids.indexOf(holder) + 1) % ids.length];
    await Promise.all([
      say('The mark passes each round.', { id: 'brief-8' }),
      after(ready, async () => {
        ctx.roster.prioPulse();
        await sleep(650);
        if (next !== holder) {
          ctx.roster.prioTo(next);
          await sleep(900);
          ctx.roster.prioTo(holder);
          await sleep(400);
        }
      }),
    ]);
  }, full);

  const reg2 = stepIndex(R.damage, (st) => st.kind === 'beat' && st.round === 1 && st.reg === 1 && st.beat.what?.k === 'reveal');
  const hit3 = stepIndex(R.damage, (st) => st.kind === 'beat' && st.round === 1 && st.reg === 2 && st.beat.fx.some((f) => f.k === 'dmg'));

  shot('damage', async () => {
    const run = R.damage;
    const ready = lessonBoard(LESSONS[2], run, 0, { phone: true });
    mimic.reset();
    mimic.showDeck(true);
    phone(true);
    await Promise.all([
      say('Lasers fire on their own, straight ahead. No health. Damage is junk cards, sent to your phone.', { id: 'brief-9' }),
      after(ready, async () => {
        await play(run, { to: reg2, mimic, regs: ctx.regs });
        await sleep(600); // the SPAM lands on the phone
      }),
    ]);
  }, full);

  shot('haywire', async () => {
    const run = R.damage;
    let ready = null;
    if (!continuous || arena.course !== lessonCourse(LESSONS[2])) {
      ready = (async () => {
        await lessonBoard(LESSONS[2], run, reg2, { phone: true });
        mimic.reset();
        mimic.showDeck(true);
        phone(true);
        await mimic.program(run.steps[0].cards[0], { pause: sleep, color: cast(0).color });
      })();
    }
    await Promise.all([
      say('Junk clogs your hand. Haywire jams the slot you were hit in.', { id: 'brief-10' }),
      after(ready, async () => {
        await play(run, { from: reg2, to: hit3 + 1, mimic, regs: ctx.regs, tempo: TEMPO * 1.25 });
        await sleep(450); // the Haywire locks the slot
      }),
    ]);
    ctx.regs(null);
  }, full);

  const fall = stepIndex(R.push, (st) => st.kind === 'beat' && st.beat.fx.some((f) => f.k === 'fall'));
  const round2 = stepIndex(R.push, (st) => st.kind === 'beat' && st.round === 2);

  shot('push', async () => {
    phone(false);
    const run = R.push;
    const ready = lessonBoard(BRIEF.push, run, 1);
    await Promise.all([say('Robots shove. Into pits. Off the edge.', { id: 'brief-11' }), after(ready, () => play(run, { from: 1, to: fall + 1 }))]);
  }, full);

  shot('reboot', async () => {
    const run = R.push;
    const ready = !continuous || arena.course !== lessonCourse(BRIEF.push) ? lessonBoard(BRIEF.push, run, round2) : null;
    await Promise.all([
      say('Fallen robots sit out the round. Reboot next round, on the blue ring.', { id: 'brief-12' }),
      after(ready, async () => {
        await play(run, {
          from: round2,
          onBeat: (st) => {
            if (!st.beat.fx.some((f) => f.k === 'reboot')) return;
            // two junk cards rise from it as it lands: that's what the fall cost
            setTimeout(() => !stopped && riseCards(layer, junkCards({ sp: 2 }), arena.screenPos('L1')), 450);
          },
        });
        await sleep(600);
      }),
    ]);
  }, full);

  shot('timer', async () => {
    const ready = toReal({ phone: true });
    mimic.reset();
    phone(true);
    await Promise.all([say('At zero, empty slots fill at random.', { id: 'brief-13' }), after(ready, () => mimic.timeout(sleep))]);
  }, full && (v.opts.timer ?? 0) > 0);

  shot('energy', async () => {
    phone(false);
    const ready = toReal();
    const docks = real.boards.filter((b) => b.dock);
    const inDock = (x, y) => docks.some((b) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
    const cells = [];
    real.cells.forEach((c, i) => c?.k === 'battery' && cells.push({ x: i % real.w, y: Math.floor(i / real.w) }));
    await Promise.all([
      say('Batteries charge energy. From round two, energy buys upgrades.', { id: 'brief-14' }),
      after(ready, async () => {
        for (const c of cells) {
          arena.ringAt(c.x, c.y, AMBER, 0.9, 1.2);
          if (inDock(c.x, c.y)) arena.popAt(c.x, c.y, 'bolt', AMBER, '', { height: 0.45 });
          await sleep(Math.max(120, Math.min(320, 2000 / cells.length)));
        }
        ctx.roster.shop();
        await sleep(1200);
      }),
    ]);
  }, full && !!v.opts.upgrades);

  // the hand-over to the phones: the fingertip fills five slots, as theirs are about to
  shot('your turn', async () => {
    phone(false);
    const ready = toReal({ phone: true });
    mimic.reset();
    await Promise.all([
      say('Your turn. Drive your robot to the flag.', { id: 'brief-drive' }),
      after(ready, () => mimic.program(R.program.steps[0].cards[0], { slow: true, fast: true, pause: sleep, color: cast(0).color })),
    ]);
    phone(false);
    arena.setFrame(realFrame(false));
    arena.brighten();
    line.collapse();
    await sleep(600);
  }, toDrive);

  shot('questions', async () => {
    const ready = toReal({ phone: true });
    mimic.reset();
    phone(true);
    await Promise.all([say('Questions? Tap the question mark on your phone. Floor Control out.', { id: 'brief-15' }), after(ready, () => mimic.tapAsk(sleep))]);
    phone(false);
    arena.setFrame(realFrame(false));
    arena.brighten();
    line.collapse();
    await sleep(800);
  }, !toDrive);

  // ----- running them -----
  let index = 0;
  (async () => {
    for (index = 0; index < shots.length && !stopped; index++) {
      line.setProgress(index / shots.length);
      const my = gen;
      try {
        await shots[index].run();
        if (my !== gen) throw STOP; // it was cut short (→): the next shot can't carry on from it
        await sleep(GAP);
        continuous = true;
      } catch (err) {
        if (err !== STOP) console.warn('Briefing shot failed:', shots[index].name, err);
        continuous = false;
        if (stopped) return;
        if (my === gen) abortShot(); // it failed by itself: move on cleanly
      }
    }
    if (stopped) return;
    line.setProgress(1);
    stopped = true;
    ctx.done?.();
  })();

  return {
    get shot() {
      return shots[index]?.name ?? null;
    },
    get shots() {
      return shots.map((s) => s.name);
    },
    /** → : on to the next shot now. */
    next() {
      if (!stopped) abortShot();
    },
    /** It's over (skipped, or the phase moved on): stop talking, stop moving. The host restores the arena. */
    stop() {
      if (stopped && !pending.size) return;
      stopped = true;
      abortShot();
      line.hide(0);
      line.caption(null);
      mimic.hide();
    },
  };
}
