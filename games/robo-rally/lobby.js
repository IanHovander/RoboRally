// The lobby's rule film on the big screen. Three short scenes, played by the real rules (lessons.js) on
// Lumen's glass board, with a phone beside it so people see what their own phone will do:
//   1. Tap five cards into five slots. The robot runs them in order, to the flag.
//   2. After each card the board acts: belts carry, gears turn, lasers hit, pits swallow (and you come back).
//   3. Robots push each other. Flags in order. First to the last flag wins.
// Players who have joined star in it: their colors, their robots, their names.
// The dots under the board are the scenes: the lit one fills as its scene plays. Clicking a dot (or ← →)
// jumps to that scene; the film carries on from there by itself.
import { LESSONS, lessonCourse, runLesson } from './lessons.js';
import { cardSvgHtml, svgGlyph } from './glyphs.js';
import { sceneSound, setLevel } from './sound.js';

const DEMO = [
  { id: 'demo-a', name: '', color: '#ff4d6d', avatar: 0 },
  { id: 'demo-b', name: '', color: '#4dabf7', avatar: 3 },
  { id: 'demo-c', name: '', color: '#ffd43b', avatar: 1 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DECOYS = ['bk', 'ut', 'm1', 'rl', 'rr', 'm2'];
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

  ui.innerHTML = `
    <div class="lf-phone" aria-hidden="true">
      <div class="lf-slots">${'<i></i>'.repeat(5)}</div>
      <div class="lf-hand"></div>
      <div class="lf-lock">${svgGlyph('check')}</div>
      <div class="lf-finger"></div>
    </div>
    <div class="lf-dots">${LESSONS.map((_, i) => `<button class="lf-dot" data-i="${i}" aria-label="Scene ${i + 1}"><i><b></b></i></button>`).join('')}</div>`;
  const phone = ui.querySelector('.lf-phone');
  const slotsEl = ui.querySelector('.lf-slots');
  const hand = ui.querySelector('.lf-hand');
  const lock = ui.querySelector('.lf-lock');
  const finger = ui.querySelector('.lf-finger');
  const dots = [...ui.querySelectorAll('.lf-dot')];

  ui.querySelector('.lf-dots').addEventListener('click', (e) => {
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

  function layout() {
    if (!arena) return;
    const wide = innerWidth / innerHeight > 1.5;
    // board between the phone (left) and the join column (right)
    arena.setFrame(wide ? { left: 0.52, right: 0.66, top: 0.42, bottom: 0.36 } : { left: 0.56, right: 0.68, top: 0.46, bottom: 0.4 });
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

  /** How long a scene plays: playLesson's pauses, added up. */
  function lessonLength(lesson, run) {
    let ms = FADE_MS + 1400;
    for (const st of run.steps) {
      if (st.kind === 'program') {
        const n = st.cards[0].length;
        ms += (lesson.phone && st === run.steps[0] ? 1300 + n * 1480 + 960 + 700 : 700 + n * 170 + 300) + 500;
      } else ms += st.beat.dur * 1.12 + (st.beat.what?.k === 'reveal' ? 150 : 60);
    }
    return ms + (run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? 4200 : 2200);
  }

  async function playLesson(lesson, run, pause) {
    // out: the board and the phone fade together (the scene may still be moving: it fades as it is)
    stage.style.opacity = '0';
    phone.classList.remove('show');
    finger.className = 'lf-finger';
    await pause(Math.max(FADE_MS, SETTLE_MS - (performance.now() - lastBeatAt)));
    // a clean start: robots at their start spaces, nothing left glowing from the last scene
    resetPhone();
    arena.clearCards(); // (first: a robot's card isn't removed with the robot)
    arena.syncRobots([]); // the robots leave, with their light trails
    arena.focusOn = null;
    arena.setDim(0);
    const course = lessonCourse(lesson);
    if (arena.course === course) arena.course = null; // the same scene again: its board is built afresh too
    arena.setCourse(course); // a new board clears the old one's effects and cards
    arena.syncRobots(robotsAt(run.start));
    hush = false;
    stage.style.opacity = '1';
    await pause(1400);
    let program = null;
    for (const st of run.steps) {
      if (st.kind === 'program') {
        program = st.cards;
        await programPhone(st.cards[0], lesson.phone && program === run.steps[0].cards, pause);
        await pause(500);
        continue;
      }
      const robots = robotsAt(st.robots);
      const b = st.beat;
      if (b.what?.k === 'reveal') {
        arena.showCards(robots.map((r, i) => ({ id: r.id, types: r.on ? [program[i][st.reg]] : [] })));
        litSlot(st.reg);
      }
      lastBeatAt = performance.now();
      arena.playBeat(b, robots);
      arena.syncRobots(robots);
      await pause(b.dur * 1.12 + (b.what?.k === 'reveal' ? 150 : 60));
      arena.syncRobots(robots);
    }
    litSlot(-1);
    await pause(run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? 4200 : 2200);
  }

  // ----- the phone beside the board -----

  function resetPhone() {
    phone.classList.remove('locked', 'show', 'run');
    for (const s of slotsEl.children) {
      s.className = '';
      s.innerHTML = '';
    }
    hand.innerHTML = '';
    finger.className = 'lf-finger';
  }

  /** Deal the hand, then (slowly, with a fingertip) or (quickly) put the five cards in the slots. */
  async function programPhone(types, slow, pause) {
    const color = cast(0).color;
    phone.style.setProperty('--c', color);
    phone.classList.remove('locked', 'run');
    for (const s of slotsEl.children) {
      s.className = '';
      s.innerHTML = '';
    }
    const decoys = DECOYS.filter((t) => !types.includes(t)).slice(0, 2);
    const handTypes = [...types];
    // a stable shuffle so the hand doesn't look sorted
    const order = [3, 0, 5, 1, 6, 2, 4].filter((i) => i < types.length + decoys.length);
    const all = [...handTypes, ...decoys];
    hand.innerHTML = order.map((i, n) => `<span class="lf-card" data-i="${i}" style="--n:${n}">${cardSvgHtml(all[i])}</span>`).join('');
    phone.classList.add('show');
    await pause(slow ? 1300 : 700);
    for (let k = 0; k < types.length; k++) {
      const card = hand.querySelector(`[data-i="${k}"]`);
      const slot = slotsEl.children[k];
      if (!card) continue;
      if (slow) await tap(card, pause);
      flyInto(card, slot, all[k]);
      await pause(slow ? 520 : 170);
    }
    if (slow) await tap(lock, pause);
    phone.classList.add('locked');
    finger.className = 'lf-finger';
    await pause(slow ? 700 : 300);
    phone.classList.add('run');
  }

  /** The fingertip glides to el and presses it. */
  async function tap(el, pause) {
    const p = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    finger.style.transform = `translate(${r.left - p.left + r.width / 2}px, ${r.top - p.top + r.height * 0.6}px)`;
    finger.classList.add('on');
    await pause(420 + 380);
    finger.classList.add('press');
    await pause(160);
    finger.classList.remove('press');
  }

  function flyInto(card, slot, type) {
    const a = card.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    card.style.transform = `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px) scale(${b.width / a.width})`;
    card.classList.add('flying');
    const version = gen;
    setTimeout(() => {
      if (version !== gen) return; // another scene took over meanwhile
      slot.innerHTML = cardSvgHtml(type);
      slot.className = 'full';
      card.classList.add('gone');
    }, 430);
  }

  function litSlot(i) {
    [...slotsEl.children].forEach((s, k) => {
      s.classList.toggle('now', k === i);
      s.classList.toggle('done', i >= 0 && k < i);
    });
  }

  function release() {
    ++gen;
    hush = false;
    if (arena) {
      arena.destroy();
      arena = null;
    }
    stage.replaceChildren();
    resetPhone();
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
