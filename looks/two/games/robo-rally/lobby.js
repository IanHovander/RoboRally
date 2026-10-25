// The big screen's lobby: a little pop-up stage that teaches the whole game with no words, while
// everyone who joins pops up on the front row. The lesson is a loop of short scenes acted out with
// the real game's pieces and effects (scene.js), so what people learn here is exactly what they'll
// see in the race. A strip at the top shows the cards behind each move.
import { html, raw } from '../../js/ui.js';
import { DX, DY, turn, beltInputs } from './board.js';
import { cardFace } from './icons.js';
import { glyph } from './glyphs.js';
import { sfx, sfxLevel } from './sound.js';

// ---------- the lesson's page ----------
// codes as in board.js: .. floor, XX pit, EE battery, g^ green belt, b> blue belt, G+ G- gears, S1 start

// rows 0-4 are the stage, row 5 is left clear (the players' robots stand in front of it), row 6 is where they stand
const GRID = [
  'b> b> b> b> .. .. .. .. .. ..',
  '.. G- .. .. .. .. .. .. .. ..',
  '.. EE .. .. .. G+ .. .. .. ..',
  '.. .. .. .. .. g^ .. .. XX ..',
  '.. .. .. .. .. g^ .. .. .. ..',
  '.. .. .. .. .. .. .. .. .. ..',
  '.. S1 S2 S3 S4 S5 S6 S7 S8 ..',
];
const WALLS = ['0,3:E', '7,4:N', '3,1:S'];
const LASERS = [[9, 1, 'W', 1]];
const FLAGS = [[8, 2], [8, 0]];
const REBOOT = { x: 9, y: 4, d: 3 };

function buildCourse() {
  const LETTER = { N: 0, E: 1, S: 2, W: 3 };
  const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };
  const h = GRID.length;
  const w = GRID[0].split(' ').length;
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = GRID[y].split(' ');
    for (let x = 0; x < w; x++) {
      const code = row[x];
      const cell = { k: 'floor', walls: 0, b: y === h - 1 ? 1 : 0 };
      if (code === 'XX') cell.k = 'pit';
      else if (code === 'EE') cell.k = 'battery';
      else if (code[0] === 'G') Object.assign(cell, { k: 'gear', spin: code[1] === '+' ? 1 : -1 });
      else if (code[0] === 'g' || code[0] === 'b') Object.assign(cell, { k: 'belt', fast: code[0] === 'b', d: ARROW[code[1]] });
      else if (code[0] === 'S') Object.assign(cell, { k: 'start', n: Number(code[1]), d: 0 });
      cells.push(cell);
    }
  }
  for (const spec of WALLS) {
    const [pos, sides] = spec.split(':');
    const [x, y] = pos.split(',').map(Number);
    for (const ch of sides) cells[y * w + x].walls |= 1 << LETTER[ch];
  }
  const lasers = LASERS.map(([x, y, d, n]) => ({ x, y, d: LETTER[d], n }));
  for (const l of lasers) cells[l.y * w + l.x].walls |= 1 << turn(l.d, 2);
  const starts = [];
  cells.forEach((c, i) => c.k === 'start' && starts.push({ x: i % w, y: Math.floor(i / w), d: 2, n: c.n }));
  const course = {
    id: 'lesson', name: '', w, h, cells, lasers, pushers: [], starts,
    checkpoints: FLAGS.map(([x, y], i) => ({ x, y, n: i + 1 })),
    boards: [{ name: '', dock: false, x: 0, y: 0, w, h: h - 1, reboot: REBOOT }, { name: '', dock: true, x: 0, y: h - 1, w, h: 1, reboot: null }],
  };
  course.tokens = new Map();
  for (const cp of course.checkpoints) course.tokens.set(cp.y * w + cp.x, 'checkpoint');
  course.tokens.set(REBOOT.y * w + REBOOT.x, 'reboot');
  return course;
}

// ---------- the scenes ----------
// The two actors: "you" (orange) and another robot (blue).
const ACTORS = {
  A: { id: 'lesson-a', name: '', color: '#ff922b', avatar: 0 },
  B: { id: 'lesson-b', name: '', color: '#4dabf7', avatar: 1 },
};

const CHAPTERS = [
  { icon: 'cards', shot: { x: -0.8, z: -0.6, zoom: 0.95 } },
  { icon: 'belt', shot: { x: 0.2, z: -0.6, zoom: 0.95 } },
  { icon: 'push', shot: { x: 0, z: -1, zoom: 0.95 } },
  { icon: 'laser', shot: { x: 0.6, z: -1, zoom: 0.95 } },
  { icon: 'fall', shot: { x: 0.8, z: -0.4, zoom: 0.95 } },
  { icon: 'flag', shot: { x: 0.8, z: -1, zoom: 0.95 } },
  { icon: 'energy', shot: { x: -0.8, z: -0.6, zoom: 0.95 } },
];

export function mountLobby(sceneRoot, uiRoot) {
  const course = buildCourse();
  let arena = null;
  let active = false;
  let loading = false;
  let generation = 0;
  let players = [];
  let run = 0; // bumps to cancel the running lesson
  let chapter = 0;
  const actors = {}; // id -> { x, y, d, on }

  uiRoot.innerHTML = html`
    <div class="lesson-strip" hidden>
      <div class="lesson-phone">${raw(glyph('phone'))}</div>
      <div class="lesson-slots">${[0, 1, 2, 3, 4].map((i) => html`<div class="lesson-slot" data-i="${i}"><i>${i + 1}</i></div>`)}</div>
    </div>
    <nav class="lesson-dots">${CHAPTERS.map((c, i) => html`<button class="lesson-dot" data-chapter="${i}" aria-label="Lesson ${i + 1}">${raw(glyph(c.icon))}</button>`)}</nav>`;
  const strip = uiRoot.querySelector('.lesson-strip');
  const slots = [...uiRoot.querySelectorAll('.lesson-slot')];
  uiRoot.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chapter]');
    if (b) play(Number(b.dataset.chapter));
  });

  const wait = (ms, token) => new Promise((resolve, reject) => setTimeout(() => (token === run ? resolve() : reject(new Error('stop'))), ms));

  function robots() {
    const list = [];
    for (const [key, a] of Object.entries(actors)) if (a.on) list.push({ ...ACTORS[key], x: a.x, y: a.y, d: a.d, on: true, mood: a.mood });
    players.slice(0, 8).forEach((p, i) => {
      const st = course.starts[i];
      list.push({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, away: !p.connected, x: st.x, y: st.y, d: 2, on: true, scale: 0.86 });
    });
    return list;
  }
  const sync = () => arena?.syncRobots(robots());
  const beat = (fx, what = null) => arena?.playBeat({ fx, what }, robots());
  const place = (key, x, y, d) => {
    const was = actors[key];
    if (was?.on && (was.x !== x || was.y !== y)) {
      was.on = false; // vanish and pop up in the new spot instead of sliding there
      sync();
    }
    actors[key] = { x, y, d, on: true };
    sync();
  };
  const hide = (key) => {
    if (actors[key]) actors[key].on = false;
    sync();
  };

  // ----- the program strip -----
  function showProgram(cards) {
    strip.hidden = !cards;
    slots.forEach((s, i) => {
      s.classList.remove('now', 'done', 'in');
      s.querySelector('.lcard')?.remove();
      const t = cards?.[i];
      if (!t) return;
      s.insertAdjacentHTML('beforeend', `<div class="lcard pcard t-${t}" style="--i:${i}">${cardFace(t)}</div>`);
    });
  }
  async function dealProgram(cards, token) {
    showProgram(cards);
    for (let i = 0; i < cards.length; i++) {
      await wait(i ? 260 : 400, token);
      slots[i].classList.add('in');
      sfx.flip();
    }
    await wait(500, token);
  }
  const markSlot = (i) => slots.forEach((s, k) => {
    s.classList.toggle('now', k === i);
    s.classList.toggle('done', k < i);
  });

  /** A robot plays a card: the strip lights it, the card shows over the robot, and it acts. */
  async function card(i, key, type, token, act) {
    markSlot(i);
    const id = ACTORS[key].id;
    beat([{ k: 'play', id, cards: [type] }], { k: 'card', id, cards: [type] });
    await wait(450, token);
    await act();
  }

  async function move(key, dist, token, { back = false, what = 'card' } = {}) {
    const a = actors[key];
    const d = back ? turn(a.d, 2) : a.d;
    const path = [[a.x, a.y]];
    for (let i = 0; i < dist; i++) path.push([a.x + DX[d] * (i + 1), a.y + DY[d] * (i + 1)]);
    a.x = path.at(-1)[0];
    a.y = path.at(-1)[1];
    beat([{ k: 'move', id: ACTORS[key].id, path }], { k: what });
    await wait(260 + dist * 340, token);
    sync();
  }
  async function rotate(key, by, token) {
    actors[key].d = turn(actors[key].d, by);
    beat([{ k: 'turn', id: ACTORS[key].id, by }]);
    await wait(650, token);
    sync();
  }

  // ----- the chapters -----
  const SCENES = [
    // 1. five cards from your phone; your robot does what they say, in order
    async (token) => {
      hide('B');
      place('A', 2, 3, 0);
      await wait(700, token);
      const prog = ['m1', 'rr', 'm2', 'rl', 'm1'];
      await dealProgram(prog, token);
      await card(0, 'A', 'm1', token, () => move('A', 1, token));
      await card(1, 'A', 'rr', token, () => rotate('A', 1, token));
      await card(2, 'A', 'm2', token, () => move('A', 2, token));
      await card(3, 'A', 'rl', token, () => rotate('A', -1, token));
      await card(4, 'A', 'm1', token, () => move('A', 1, token));
      markSlot(5);
      await wait(1200, token);
    },
    // 2. after every card, the factory moves: belts carry you, gears turn you
    async (token) => {
      hide('B');
      place('A', 4, 3, 1);
      await wait(700, token);
      await dealProgram(['m1'], token);
      await card(0, 'A', 'm1', token, () => move('A', 1, token));
      await wait(300, token);
      markSlot(5);
      // the belt
      const a = actors.A;
      const path = [[a.x, a.y], [a.x, a.y - 1]];
      a.y -= 1;
      beat([{ k: 'move', id: ACTORS.A.id, path }], { k: 'belt' });
      await wait(900, token);
      sync();
      // the gear
      a.d = turn(a.d, 1);
      beat([{ k: 'gear', x: 5, y: 2, spin: 1 }, { k: 'turn', id: ACTORS.A.id, by: 1 }], { k: 'gear' });
      await wait(1600, token);
      sync();
    },
    // 3. robots push each other
    async (token) => {
      place('A', 2, 1, 1);
      place('B', 4, 1, 2);
      await wait(800, token);
      await dealProgram(['m3'], token);
      markSlot(0);
      beat([{ k: 'play', id: ACTORS.A.id, cards: ['m3'] }], { k: 'card', id: ACTORS.A.id });
      await wait(450, token);
      const pathA = [[2, 1], [3, 1], [4, 1], [5, 1]];
      const pathB = [[4, 1], [5, 1], [6, 1]];
      actors.A.x = 5;
      actors.B.x = 6;
      beat([{ k: 'move', id: ACTORS.A.id, path: pathA }, { k: 'move', id: ACTORS.B.id, path: pathB }], { k: 'card', id: ACTORS.A.id });
      await wait(1500, token);
      sync();
      markSlot(5);
      await wait(800, token);
    },
    // 4. lasers: the wall's, then every robot shoots straight ahead. Each hit is a damage card
    async (token) => {
      place('A', 5, 1, 1);
      place('B', 6, 1, 2);
      showProgram(null);
      await wait(900, token);
      beat([{ k: 'beam', board: true, x0: 9, y0: 1, x1: 6, y1: 1, d: 3, n: 1, hit: [ACTORS.B.id] }, { k: 'dmg', id: ACTORS.B.id, sp: 1 }], { k: 'blaser' });
      await wait(1700, token);
      beat([{ k: 'beam', src: ACTORS.A.id, x0: 5, y0: 1, x1: 6, y1: 1, d: 1, n: 1, hit: [ACTORS.B.id] }, { k: 'dmg', id: ACTORS.B.id, sp: 1 }], { k: 'rlaser' });
      await wait(1700, token);
    },
    // 5. off the page or into a hole: you come back at the reboot spot with damage
    async (token) => {
      hide('B');
      place('A', 6, 3, 1);
      await wait(800, token);
      await dealProgram(['m2'], token);
      markSlot(0);
      beat([{ k: 'play', id: ACTORS.A.id, cards: ['m2'] }], { k: 'card', id: ACTORS.A.id });
      await wait(450, token);
      actors.A.x = 8;
      beat([{ k: 'move', id: ACTORS.A.id, path: [[6, 3], [7, 3], [8, 3]] }, { k: 'fall', id: ACTORS.A.id, x: 8, y: 3, edge: false }], { k: 'card', id: ACTORS.A.id });
      await wait(2000, token);
      markSlot(5);
      Object.assign(actors.A, { x: REBOOT.x, y: REBOOT.y, d: REBOOT.d });
      beat([{ k: 'reboot', id: ACTORS.A.id, x: REBOOT.x, y: REBOOT.y }, { k: 'dmg', id: ACTORS.A.id, sp: 2 }], { k: 'reboot', id: ACTORS.A.id });
      await wait(400, token);
      sync();
      await wait(1600, token);
    },
    // 6. touch the flags in order; the last one wins
    async (token) => {
      hide('B');
      place('A', 6, 2, 1);
      await wait(800, token);
      await dealProgram(['m2', 'rl', 'm2'], token);
      await card(0, 'A', 'm2', token, () => move('A', 2, token));
      beat([{ k: 'cp', id: ACTORS.A.id, n: 1 }], { k: 'cp' });
      await wait(1300, token);
      await card(1, 'A', 'rl', token, () => rotate('A', -1, token));
      await card(2, 'A', 'm2', token, () => move('A', 2, token));
      markSlot(5);
      actors.A.mood = 'happy';
      beat([{ k: 'cp', id: ACTORS.A.id, n: 2 }, { k: 'win', id: ACTORS.A.id }], { k: 'cp' });
      sync();
      await wait(3600, token);
      if (arena) arena.focusOn = null;
      actors.A.mood = undefined;
      sync();
      await wait(600, token);
    },
    // 7. batteries give energy; energy buys upgrades
    async (token) => {
      hide('B');
      place('A', 0, 2, 1);
      await wait(800, token);
      await dealProgram(['m1'], token);
      await card(0, 'A', 'm1', token, () => move('A', 1, token));
      markSlot(5);
      beat([{ k: 'en', id: ACTORS.A.id, n: 1 }], { k: 'battery' });
      await wait(1100, token);
      beat([{ k: 'say', id: ACTORS.A.id, text: '⚡ → 🛡️' }]);
      await wait(1800, token);
    },
  ];

  async function play(start) {
    const token = ++run;
    chapter = start;
    try {
      for (;;) {
        if (!arena) return;
        uiRoot.querySelectorAll('.lesson-dot').forEach((d, i) => d.classList.toggle('on', i === chapter));
        arena.focusOn = null;
        arena.shot(CHAPTERS[chapter].shot);
        showProgram(null);
        await SCENES[chapter](token);
        chapter = (chapter + 1) % SCENES.length;
      }
    } catch (err) {
      if (err?.message !== 'stop') console.warn(err);
    }
  }

  async function start() {
    if (loading || arena || !active) return;
    loading = true;
    const version = ++generation;
    try {
      await Promise.race([document.fonts.load('800 64px Inter'), new Promise((r) => setTimeout(r, 1500))]);
      const { Arena } = await import('./scene.js');
      if (!active || version !== generation) return;
      sceneRoot.replaceChildren();
      arena = new Arena(sceneRoot);
      arena.camMode = 'lesson';
      layout();
      arena.setCourseData(course);
      sync();
      sfxLevel(0.45);
      play(chapter);
    } catch (err) {
      console.warn('Lesson unavailable:', err);
    } finally {
      loading = false;
      if (active && version !== generation) start();
    }
  }

  /** Keep the stage clear of the join ticket (right) and the program strip (top). */
  function layout() {
    if (!arena) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    arena.setInsets({ right: rem * 19, top: rem * 9, bottom: rem * 2.6, left: rem * 1 });
  }
  window.addEventListener('resize', layout);

  function release() {
    ++generation;
    ++run;
    if (arena) {
      arena.destroy();
      arena = null;
    }
    sceneRoot.replaceChildren();
    sfxLevel(1);
  }

  return {
    setActive(value, roster = []) {
      players = roster;
      if (value !== active) {
        active = value;
        if (!active) release();
      }
      if (active) {
        if (arena) sync();
        else start();
      }
    },
  };
}
