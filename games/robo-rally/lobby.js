// The lobby's rule film on the big screen. Three short scenes, played by the real rules (lessons.js) on
// Lumen's glass board, with a phone beside it so people see what their own phone will do:
//   1. Tap five cards into five slots. The robot runs them in order, to the flag.
//   2. After each card the board acts: belts carry, gears turn, lasers hit, pits swallow (and you come back).
//   3. Robots push each other. Flags in order. First to the last flag wins.
// Players who have joined star in it: their colors, their robots, their names.
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

export function mountLumenLobby(stage, ui) {
  let arena = null;
  let active = false;
  let loading = false;
  let gen = 0;
  let players = [];
  let index = 0;
  const runs = LESSONS.map((l, i) => runLesson(l, 11 + i));

  ui.innerHTML = `
    <div class="lf-phone">
      <div class="lf-slots">${'<i></i>'.repeat(5)}</div>
      <div class="lf-hand"></div>
      <div class="lf-lock">${svgGlyph('check')}</div>
      <div class="lf-finger"></div>
    </div>
    <div class="lf-dots">${LESSONS.map(() => '<i></i>').join('')}</div>`;
  const phone = ui.querySelector('.lf-phone');
  const slotsEl = ui.querySelector('.lf-slots');
  const hand = ui.querySelector('.lf-hand');
  const lock = ui.querySelector('.lf-lock');
  const finger = ui.querySelector('.lf-finger');
  const dots = [...ui.querySelectorAll('.lf-dots i')];

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
      arena.on((kind, d) => sceneSound(kind, d, (id) => Number(String(id).slice(1)) || 0));
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

  async function play(version) {
    const alive = () => active && version === gen && arena;
    while (alive()) {
      const lesson = LESSONS[index];
      const run = runs[index];
      dots.forEach((d, i) => d.classList.toggle('on', i === index));
      await playLesson(lesson, run, alive);
      if (!alive()) return;
      index = (index + 1) % LESSONS.length;
    }
  }

  async function playLesson(lesson, run, alive) {
    stage.style.opacity = '0';
    await sleep(700);
    if (!alive()) return;
    arena.focusOn = null;
    arena.setDim(0);
    arena.clearCards();
    arena.setCourse(lessonCourse(lesson));
    arena.syncRobots(robotsAt(run.start));
    stage.style.opacity = '1';
    resetPhone();
    await sleep(1400);
    let program = null;
    for (const st of run.steps) {
      if (!alive()) return;
      if (st.kind === 'program') {
        program = st.cards;
        await programPhone(st.cards[0], lesson.phone && program === run.steps[0].cards, alive);
        await sleep(500);
        continue;
      }
      const robots = robotsAt(st.robots);
      const b = st.beat;
      if (b.what?.k === 'reveal') {
        arena.showCards(robots.map((r, i) => ({ id: r.id, types: r.on ? [program[i][st.reg]] : [] })));
        litSlot(st.reg);
      }
      arena.playBeat(b, robots);
      arena.syncRobots(robots);
      await sleep(b.dur * 1.12 + (b.what?.k === 'reveal' ? 150 : 60));
      arena.syncRobots(robots);
    }
    litSlot(-1);
    await sleep(run.steps.at(-1)?.beat?.fx.some((f) => f.k === 'win') ? 4200 : 2200);
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
  async function programPhone(types, slow, alive) {
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
    await sleep(slow ? 1300 : 700);
    for (let k = 0; k < types.length; k++) {
      if (!alive()) return;
      const card = hand.querySelector(`[data-i="${k}"]`);
      const slot = slotsEl.children[k];
      if (!card) continue;
      if (slow) {
        await moveFinger(card);
        await sleep(380);
        finger.classList.add('press');
        await sleep(160);
        finger.classList.remove('press');
      }
      flyInto(card, slot, all[k]);
      await sleep(slow ? 520 : 170);
    }
    if (slow) {
      await moveFinger(lock);
      await sleep(380);
      finger.classList.add('press');
      await sleep(160);
      finger.classList.remove('press');
    }
    phone.classList.add('locked');
    finger.className = 'lf-finger';
    await sleep(slow ? 700 : 300);
    phone.classList.add('run');
  }

  function moveFinger(el) {
    const p = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    finger.style.transform = `translate(${r.left - p.left + r.width / 2}px, ${r.top - p.top + r.height * 0.6}px)`;
    finger.classList.add('on');
    return sleep(420);
  }

  function flyInto(card, slot, type) {
    const a = card.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    card.style.transform = `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px) scale(${b.width / a.width})`;
    card.classList.add('flying');
    setTimeout(() => {
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

