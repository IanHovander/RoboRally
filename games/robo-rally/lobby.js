// The lobby's rule film on the big screen. Four short wordless scenes, played by the real rules (lessons.js)
// on Lumen's glass board, with a phone beside it (mimic.js) so people see what their own phone will do:
//   1. Tap five cards into five slots. The robot runs them in order, to the flag. It starts facing the
//      camera, so its left turn goes to the screen's right; a dotted line of light shows where it will go.
//   2. After each card the board acts: belts carry, gears turn, lasers hit, pits swallow (and you come back).
//   3. Damage is cards: a laser in the back sends a SPAM card to the phone, a Haywire jams slot 3 and runs there.
//   4. Robots push each other. Flags in order. First to the last flag wins.
// Every scene shows the race's 1-5 strip while its cards run, and numerals of light under the robots in
// the order they act. Players who have joined star in it: their colors, their robots, their names.
// The dots under the board are the scenes: the lit one fills as its scene plays. Clicking a dot (or ← →)
// jumps to that scene; the film carries on from there by itself. The lit one is also a scrub bar: click or
// drag along it to go back or ahead within the scene (the scene is rebuilt at the step at that moment).
import { LESSONS, lessonCourse, runLesson, playRun, runLength, holdFor } from './lessons.js';
import { createMimic } from './mimic.js';
import { sceneSound, setLevel } from './sound.js';

/** The leader's mark (the player who can start the game from their phone): a small crown of light. */
export const LEADER = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8.5 29 L6.5 13.5 L14.5 20.5 L20 9.5 L25.5 20.5 L33.5 13.5 L31.5 29 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 33.5 H31" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

const DEMO = [
  { id: 'demo-a', name: '', color: '#ff4d6d', avatar: 0 },
  { id: 'demo-b', name: '', color: '#4dabf7', avatar: 3 },
  { id: 'demo-c', name: '', color: '#ffd43b', avatar: 1 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STOP = Symbol('another scene took over');
const FADE_MS = 700; // the board fades out, then in, between scenes (.lesson-stage's opacity transition)
// the film's pacing: a breath to see the new board before anything moves, a short beat after the scene's last move
// (a flag's own celebration already holds the stage, so after one only a moment), card reveals kept brisk
const PREROLL_MS = 700;
const TAIL_MS = 1200;
const WIN_TAIL_MS = 700;
const PACE = { revealHold: 1000, winHold: 2600 };
const tailOf = (run) => (run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? WIN_TAIL_MS : TAIL_MS);
const SETTLE_MS = 1600; // a beat can still fire delayed effects (a fall's ring, its sound) this long after it starts

export function mountLumenLobby(stage, ui) {
  let arena = null;
  let active = false;
  let loading = false;
  let gen = 0;
  let players = [];
  let index = 0;
  let hush = false; // between scenes: sounds the old scene still has scheduled stay silent
  let lastBeatAt = 0;
  const runs = LESSONS.map((l, i) => runLesson(l, 11 + i));

  const mimic = createMimic(ui);
  const regsEl = document.createElement('div');
  regsEl.className = 'lf-regs';
  regsEl.innerHTML = [1, 2, 3, 4, 5].map((n) => `<i>${n}</i>`).join('');
  const dotsEl = document.createElement('div');
  dotsEl.className = 'lf-dots';
  dotsEl.innerHTML = LESSONS.map((_, i) => `<button class="lf-dot" data-i="${i}" aria-label="Scene ${i + 1}"><i><b></b></i></button>`).join('');
  // when the browser won't make a 3D view (too many open, graphics off): say so, and try again later
  const no3d = document.createElement('button');
  no3d.className = 'lf-no3d';
  no3d.hidden = true;
  no3d.innerHTML = '<b>3D graphics are off in this browser.</b><span>Close other tabs or restart the browser. Click to try again.</span>';
  no3d.addEventListener('click', () => start());
  ui.append(regsEl, dotsEl, no3d);
  const retry = () => document.visibilityState === 'visible' && !no3d.hidden && start();
  document.addEventListener('visibilitychange', retry);
  addEventListener('focus', retry);
  const dots = [...dotsEl.children];

  dotsEl.addEventListener('click', (e) => {
    const dot = e.target.closest('.lf-dot');
    // the lit dot's bar seeks on the pointer (below); a key press on it (Enter) starts its scene over
    if (dot && (!dot.classList.contains('on') || e.detail === 0)) jumpTo(Number(dot.dataset.i));
  });

  // Scrubbing: press on the lit bar, drag, let go. While held, the film holds still and the bar follows the
  // pointer; on release the scene is rebuilt at that moment and plays on.
  let scrub = null;
  const barAt = (dot, x) => {
    const r = dot.querySelector('i').getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  };
  dotsEl.addEventListener('pointerdown', (e) => {
    const dot = e.target.closest('.lf-dot.on');
    if (!dot || !arena || e.button > 0) return;
    e.preventDefault();
    try { dot.setPointerCapture(e.pointerId); } catch {}
    scrub = { dot, p: barAt(dot, e.clientX) };
    dot.classList.add('scrub');
    ++gen; // the scene stops at its next wait
    hush = true;
    showDot(index, scrub.p);
  });
  dotsEl.addEventListener('pointermove', (e) => {
    const dot = scrub?.dot ?? e.target.closest('.lf-dot.on');
    if (!dot) return;
    const p = barAt(dot, e.clientX);
    dot.style.setProperty('--h', p);
    if (!scrub) return;
    scrub.p = p;
    showDot(index, p);
  });
  const endScrub = (e) => {
    if (!scrub) return;
    const { dot, p } = scrub;
    scrub = null;
    dot.classList.remove('scrub');
    try { dot.releasePointerCapture(e.pointerId); } catch {}
    seek(p);
  };
  dotsEl.addEventListener('pointerup', endScrub);
  dotsEl.addEventListener('pointercancel', endScrub);
  addEventListener('keydown', (e) => {
    if (!active || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, dialog')) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) jumpTo((index + step + LESSONS.length) % LESSONS.length);
  });

  /** Lesson robot i wears joined player i's colors (or a demo robot's). */
  const cast = (i) => {
    const p = players.filter((x) => x.connected !== false)[i] ?? DEMO[i % DEMO.length];
    return { name: p.name ?? '', color: p.color, avatar: p.avatar ?? i };
  };
  const robotsAt = (list) => list.map((r, i) => ({ ...r, ...cast(i), seat: i }));

  async function start() {
    if (loading || arena || !active) return;
    loading = true;
    const version = ++gen;
    try {
      await Promise.race([Promise.all([document.fonts.load('200 64px Lumen'), document.fonts.load('500 64px Lumen')]), sleep(1500)]);
      const { Arena } = await import('./scene.js');
      if (!active || version !== gen) return;
      stage.replaceChildren();
      arena = new Arena(stage);
      arena.on((kind, d) => (kind === 'broken' ? rebuild(d.arena) : hush || sceneSound(kind, d, (id) => Number(String(id).slice(1)) || 0)));
      arena.camMode = 'lesson';
      arena.calmWin = true; // a flag reached in a lesson: rings of light, no camera move
      no3d.hidden = true;
      layout();
      play(version);
    } catch (err) {
      console.warn('Rule film unavailable:', err);
      if (active && version === gen) no3d.hidden = false;
    } finally {
      loading = false;
    }
  }

  // board between the phone (left) and the join column (right); on a phone held upright the join band is
  // above, so the board takes the space right of the (narrower) phone
  const frame = () => (innerWidth < innerHeight ? { left: 0.06, right: 0.06, top: 0.24, bottom: 0.95 } : innerWidth / innerHeight > 1.5 ? { left: 0.52, right: 0.66, top: 0.42, bottom: 0.36 } : { left: 0.56, right: 0.68, top: 0.46, bottom: 0.4 });
  function layout() {
    const f = frame();
    // the strip sits centered over the board's frame, just above it
    regsEl.style.left = `${((1 + (f.left - f.right) / 2) / 2) * 100}%`;
    regsEl.style.top = `calc(${(f.top / 2) * 100}% - 2.2rem)`;
    arena?.setFrame(f);
  }
  addEventListener('resize', layout);

  /** Go to scene i now: the scene playing stops where it is and fades out, and scene i starts clean. */
  function jumpTo(i) {
    if (!(i >= 0 && i < LESSONS.length)) return;
    index = i;
    showDot(i, 0);
    if (!arena) return; // still loading: the film will start with this scene
    hush = true;
    play(++gen);
  }

  /** Go to fraction p (0..1) of the scene playing now: rebuilt at the step under that moment, playing on. */
  function seek(p) {
    if (!arena) return;
    hush = true;
    play(++gen, p);
  }

  /** Light dot i; its bar fills to p (0..1) over `ms`. */
  function showDot(i, p, ms = 0) {
    dots.forEach((d, k) => {
      d.classList.toggle('on', k === i);
      if (k === i) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
      const bar = d.querySelector('b');
      bar.style.transition = k === i && ms > 0 ? `transform ${ms}ms linear` : 'none';
      bar.style.transform = `scaleX(${k === i ? p : 0})`;
    });
  }

  /** The strip of registers: n lit (0-based), earlier ones done; null hides it. */
  function showRegs(n) {
    regsEl.classList.toggle('on', n != null);
    [...regsEl.children].forEach((el, k) => {
      el.classList.toggle('now', n != null && k === n);
      el.classList.toggle('done', n != null && k < n);
    });
  }

  async function play(version, seekP = null) {
    const alive = () => active && version === gen && arena;
    let planned = 0;
    let total = 1;
    // Every wait in a scene goes through here: it moves the dot's bar along, and it ends the scene
    // (throws STOP) if another scene has taken over or the film has stopped.
    const pause = async (ms) => {
      planned += ms;
      showDot(index, Math.min(1, planned / total), ms);
      await sleep(ms);
      if (!alive()) throw STOP;
    };
    try {
      for (;;) {
        planned = 0;
        total = lessonLength(LESSONS[index], runs[index]);
        if (seekP != null) {
          const at = seekP * total;
          seekP = null;
          await seekLesson(LESSONS[index], runs[index], at, (ms) => (planned = ms), pause, alive);
        } else await playLesson(LESSONS[index], runs[index], pause);
        index = (index + 1) % LESSONS.length;
      }
    } catch (err) {
      if (err !== STOP) console.warn('Rule film stopped:', err);
    }
  }

  /** Which program steps the fingertip fills slowly (the rest fill quickly). */
  const slowStep = (lesson) => (st) => !!lesson.phone && (lesson.slowRounds ?? [1]).includes(st.round);
  const quick = (lesson) => lesson !== LESSONS[0]; // (only the first scene teaches the fingertip at full slowness)

  /** How long a scene plays: playLesson's pauses, added up. */
  function lessonLength(lesson, run) {
    const slow = slowStep(lesson);
    const ms = FADE_MS + PREROLL_MS + runLength(run, { ...PACE, programMs: (st) => mimic.programMs(st.cards[0].filter(Boolean).length, slow(st), quick(lesson)) });
    return ms + tailOf(run);
  }

  /** When each step of a scene starts (ms from the scene's start, as lessonLength counts), and when the steps end. */
  function stepTimes(lesson, run) {
    const slow = slowStep(lesson);
    let t = FADE_MS + PREROLL_MS;
    const starts = run.steps.map((st) => {
      const at = t;
      t += st.kind === 'program'
        ? mimic.programMs(st.cards[0].filter(Boolean).length, slow(st), quick(lesson)) + 400
        : holdFor(st, PACE);
      return at;
    });
    return { starts, end: t };
  }

  /**
   * Play a scene from `at` ms in: build it as it stands at the start of the step under that moment (robots
   * where they are, the phone's cards in their slots, the register lit), then play on from that step.
   */
  async function seekLesson(lesson, run, at, setPlanned, pause, alive) {
    const { starts, end } = stepTimes(lesson, run);
    let i = 0;
    while (i < starts.length && starts[i] <= at) i++;
    i = Math.max(0, i - 1);
    if (at >= end) i = run.steps.length;
    if (at < FADE_MS + PREROLL_MS) i = 0;
    const instant = async () => {
      if (!alive()) throw STOP;
    };
    mimic.reset();
    mimic.showDeck(!!lesson.deck);
    arena.reset(lessonCourse(lesson));
    stage.style.opacity = '1';
    showRegs(null);
    let before = run.start;
    for (let k = i - 1; k >= 0; k--) if (run.steps[k].robots) { before = run.steps[k].robots; break; }
    arena.syncRobots(robotsAt(before));
    // the phone: the last program before this step, its cards placed at once (and its line of light)
    let prog = -1;
    for (let k = i - 1; k >= 0 && prog < 0; k--) if (run.steps[k].kind === 'program') prog = k;
    if (prog >= 0) {
      await playRun(arena, run, { pause: instant, cast, mimic, slow: () => false, line: !!lesson.line, from: prog, to: prog + 1 });
      // what happened since: the register running, junk cards on the phone, a flag already reached
      let reg = null;
      for (let k = prog + 1; k < i; k++) {
        const st = run.steps[k];
        if (st.beat?.what?.k === 'reveal') reg = st.reg;
        for (const f of st.beat?.fx ?? []) {
          if (f.k === 'damage' && f.id === 'L0') mimic.junkNow({ sp: f.sp ?? 0, hw: f.hw ?? 0, reg: reg ?? 0 });
          if (f.k === 'win' && lesson.line) arena.clearGhost();
        }
      }
      arena.syncRobots(robotsAt(before));
      if (reg != null && i < run.steps.length && run.steps[i].kind !== 'program') {
        const program = run.steps[prog];
        const robots = robotsAt(before);
        arena.showCards(robots.map((r, k) => ({ id: r.id, types: r.on ? [program.shown[k][reg]].filter(Boolean) : [] })));
        mimic.lit(reg, program.locked[0]?.[reg]);
        showRegs(reg);
      }
    }
    hush = false;
    setPlanned(i < starts.length ? starts[i] : at);
    if (i < run.steps.length) {
      await pause(250);
      await playRun(arena, run, {
        ...PACE,
        fast: quick(lesson),
        pause,
        cast,
        mimic,
        slow: slowStep(lesson),
        line: !!lesson.line,
        regs: showRegs,
        from: i,
        onBeat: (st) => {
          lastBeatAt = performance.now();
          if (lesson.line && st.beat.fx.some((f) => f.k === 'win')) arena.clearGhost();
        },
      });
    }
    showRegs(null);
    mimic.lit(-1);
    await pause(Math.max(300, end + tailOf(run) - Math.max(at, end)));
  }

  async function playLesson(lesson, run, pause) {
    // out: the board and the phone fade together (the scene may still be moving: it fades as it is)
    stage.style.opacity = '0';
    mimic.hide();
    showRegs(null);
    await pause(Math.max(FADE_MS, SETTLE_MS - (performance.now() - lastBeatAt)));
    // a clean start: robots at their start spaces, nothing left glowing from the last scene
    mimic.reset();
    mimic.showDeck(!!lesson.deck);
    // the board, robots and effects gone; a board built ahead (while the last scene played) just steps on stage
    const course = lessonCourse(lesson);
    if (arena.course !== course && arena.ready?.(course)) arena.setCourse(course);
    else arena.reset(course);
    arena.syncRobots(robotsAt(run.start));
    const next = LESSONS[(LESSONS.indexOf(lesson) + 1) % LESSONS.length];
    if (next !== lesson) arena.preload?.([lessonCourse(next)]);
    hush = false;
    stage.style.opacity = '1';
    await pause(PREROLL_MS);
    await playRun(arena, run, {
      ...PACE,
      fast: quick(lesson),
      pause,
      cast,
      mimic,
      slow: slowStep(lesson),
      line: !!lesson.line,
      regs: showRegs,
      onBeat: (st) => {
        lastBeatAt = performance.now();
        // the robot reached the end of its line of light: the line has said what it had to say
        if (lesson.line && st.beat.fx.some((f) => f.k === 'win')) arena.clearGhost();
      },
    });
    showRegs(null);
    mimic.lit(-1);
    await pause(tailOf(run));
  }

  // the picture went wrong (Arena.broke): the film starts again on a fresh view (a few times at most)
  let rebuilt = 0;
  function rebuild(old) {
    if (arena !== old || !active || ++rebuilt > 3) return;
    release();
    start();
  }

  function release() {
    ++gen;
    hush = false;
    if (arena) {
      arena.destroy();
      arena = null;
    }
    stage.replaceChildren();
    mimic.reset();
    showRegs(null);
    no3d.hidden = true;
  }

  return {
    setActive(value, roster = []) {
      players = roster;
      setLevel(value ? 0.45 : 1);
      if (value !== active) {
        active = value;
        if (!active) release();
      }
      if (active && !arena) start();
    },
  };
}
