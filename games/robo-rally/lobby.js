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
// jumps to that scene; the film carries on from there by itself.
import { LESSONS, lessonCourse, runLesson, playRun, runLength } from './lessons.js';
import { createMimic } from './mimic.js';
import { sceneSound, setLevel } from './sound.js';

const DEMO = [
  { id: 'demo-a', name: '', color: '#ff4d6d', avatar: 0 },
  { id: 'demo-b', name: '', color: '#4dabf7', avatar: 3 },
  { id: 'demo-c', name: '', color: '#ffd43b', avatar: 1 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STOP = Symbol('another scene took over');
const FADE_MS = 700; // the board fades out, then in, between scenes (.lesson-stage's opacity transition)
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
  ui.append(regsEl, dotsEl);
  const dots = [...dotsEl.children];

  dotsEl.addEventListener('click', (e) => {
    const dot = e.target.closest('.lf-dot');
    if (dot) jumpTo(Number(dot.dataset.i));
  });
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
      arena.on((kind, d) => hush || sceneSound(kind, d, (id) => Number(String(id).slice(1)) || 0));
      arena.camMode = 'lesson';
      arena.calmWin = true; // a flag reached in a lesson: rings of light, no camera move
      layout();
      play(version);
    } catch (err) {
      console.warn('Rule film unavailable:', err);
    } finally {
      loading = false;
    }
  }

  // board between the phone (left) and the join column (right)
  const frame = () => (innerWidth / innerHeight > 1.5 ? { left: 0.52, right: 0.66, top: 0.42, bottom: 0.36 } : { left: 0.56, right: 0.68, top: 0.46, bottom: 0.4 });
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

  async function play(version) {
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
        await playLesson(LESSONS[index], runs[index], pause);
        index = (index + 1) % LESSONS.length;
      }
    } catch (err) {
      if (err !== STOP) console.warn('Rule film stopped:', err);
    }
  }

  /** Which program steps the fingertip fills slowly (the rest fill quickly). */
  const slowStep = (lesson) => (st) => !!lesson.phone && (lesson.slowRounds ?? [1]).includes(st.round);

  /** How long a scene plays: playLesson's pauses, added up. */
  function lessonLength(lesson, run) {
    const slow = slowStep(lesson);
    const ms = FADE_MS + 1400 + runLength(run, { programMs: (st) => mimic.programMs(st.cards[0].filter(Boolean).length, slow(st)) });
    return ms + (run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? 4200 : 2200);
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
    arena.reset(lessonCourse(lesson)); // the board built afresh (even the same one), robots and effects gone
    arena.syncRobots(robotsAt(run.start));
    hush = false;
    stage.style.opacity = '1';
    await pause(1400);
    await playRun(arena, run, {
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
    await pause(run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? 4200 : 2200);
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
