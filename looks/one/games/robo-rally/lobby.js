// The lobby: the hall at golden hour, a small test set, and a trailer that teaches the whole game
// without a word. On a phone (drawn in the corner) five cards drop into five frames; a robot plays them
// out; a belt carries it, a laser burns it, a gear turns it, a flag rings; another robot gets shoved into
// a pit and comes back; flag 2 wins. Players who join roll onto the loading dock on the left.
import { DX, DY, turn } from './board.js';
import { cardFace } from './icons.js';
import * as audio from './audio.js';

const A = 'demo-a';
const B = 'demo-b';
const LOBBY_DAY = 0.16;

// ---------- the test set ----------
// x 0-1: the loading dock (eight bays, robots face east); x 2-11: the test floor.
const GRID = [
  // 0   1   2   3   4   5   6   7   8   9   10  11
  'S7 S1 .. .. .. .. .. .. .. .. .. ..',
  '.. S2 .. .. .. .. .. .. XX .. .. ..',
  '.. S3 .. .. .. g^ .. .. .. .. .. ..',
  '.. S4 .. .. .. g^ .. .. .. .. .. ..',
  '.. S5 .. .. .. g^ .. G- .. .. .. ..',
  'S8 S6 .. .. .. .. .. .. .. .. .. ..',
];
const LASER = { x: 11, y: 2, d: 3, n: 1 };
const FLAGS = [[5, 1], [9, 4]];
const REBOOT = { x: 10, y: 0, d: 2 };

export function lessonCourse() {
  const h = GRID.length;
  const w = GRID[0].trim().split(/\s+/).length;
  const cells = [];
  const starts = [];
  GRID.forEach((row, y) => row.trim().split(/\s+/).forEach((code, x) => {
    const b = x < 2 ? 0 : 1;
    const cell = { k: 'floor', walls: 0, b };
    if (code === 'XX') cell.k = 'pit';
    else if (code === 'G-') Object.assign(cell, { k: 'gear', spin: -1 });
    else if (code === 'G+') Object.assign(cell, { k: 'gear', spin: 1 });
    else if (code[0] === 'g' || code[0] === 'b') Object.assign(cell, { k: 'belt', fast: code[0] === 'b', d: { '^': 0, '>': 1, v: 2, '<': 3 }[code[1]] });
    else if (code[0] === 'S') {
      Object.assign(cell, { k: 'start', n: Number(code[1]), d: 1 });
      starts.push({ x, y, d: 1, n: Number(code[1]) });
    }
    cells[y * w + x] = cell;
  }));
  cells[LASER.y * w + LASER.x].walls |= 1 << turn(LASER.d, 2);
  starts.sort((a, b) => a.n - b.n);
  const course = {
    id: 'lesson',
    name: '',
    w,
    h,
    cells,
    lasers: [LASER],
    pushers: [],
    checkpoints: FLAGS.map(([x, y], i) => ({ x, y, n: i + 1 })),
    starts,
    boards: [
      { name: 'dock', dock: true, x: 0, y: 0, w: 2, h, reboot: null },
      { name: 'floor', dock: false, x: 2, y: 0, w: w - 2, h, reboot: REBOOT },
    ],
  };
  course.tokens = new Map();
  for (const cp of course.checkpoints) course.tokens.set(cp.y * w + cp.x, 'checkpoint');
  course.tokens.set(REBOOT.y * w + REBOOT.x, 'reboot');
  return course;
}

// ---------- the trailer ----------
// Two rounds. Each round: the phone deals A's five cards into five frames, then each register plays out.

const HAND = [
  ['m1', 'pu', 'rr', 'm3', 'm2', 'bk', 'rl', 'ag', 'm1'],
  ['rr', 'm2', 'sp', 'rr', 'm3', 'm1', 'rl', 'm2', 'ut'],
];
const PICKS = [[0, 2, 4, 6, 8], [0, 1, 3, 4, 7]]; // which hand cards go into frames 1-5

const move = (id, ...path) => ({ k: 'move', id, path });
const card = (id, t) => [{ k: 'play', id, cards: [t] }];

/** Every register: a list of beats [fx, ms, what]. */
const ROUNDS = [
  [
    [[[...card(A, 'm1'), move(A, [3, 5], [3, 4])], 800, { k: 'card', id: A }], [[...card(B, 'm1'), move(B, [6, 5], [6, 4])], 800, { k: 'card', id: B }]],
    [[[...card(A, 'rr'), { k: 'turn', id: A, by: 1 }], 750, { k: 'card', id: A }], [[...card(B, 'm1'), move(B, [6, 4], [6, 3])], 800, { k: 'card', id: B }]],
    [
      [[...card(A, 'm2'), move(A, [3, 4], [4, 4], [5, 4])], 1000, { k: 'card', id: A }],
      [[...card(B, 'm2'), move(B, [6, 3], [6, 2], [6, 1])], 1000, { k: 'card', id: B }],
      [[move(A, [5, 4], [5, 3])], 900, { k: 'belt' }],
    ],
    [
      [[...card(A, 'rl'), { k: 'turn', id: A, by: -1 }], 750, { k: 'card', id: A }],
      [[...card(B, 'rr'), { k: 'turn', id: B, by: 1 }], 750, { k: 'card', id: B }],
      [[move(A, [5, 3], [5, 2])], 900, { k: 'belt' }],
      [[{ k: 'beam', board: true, x0: 11, y0: 2, x1: 5, y1: 2, d: 3, n: 1, hit: [A] }, { k: 'dmg', id: A, sp: 1 }], 1300, { k: 'blaser' }],
    ],
    [
      [[...card(A, 'm1'), move(A, [5, 2], [5, 1])], 800, { k: 'card', id: A }],
      [[...card(B, 'pu'), { k: 'en', id: B, n: 1 }], 700, { k: 'card', id: B }],
      [[{ k: 'cp', id: A, n: 1 }], 1700, { k: 'cp' }],
    ],
  ],
  [
    [
      [[...card(A, 'rr'), { k: 'turn', id: A, by: 1 }], 750, { k: 'card', id: A }],
      [[...card(B, 'rl'), { k: 'turn', id: B, by: -1 }], 750, { k: 'card', id: B }],
      [[{ k: 'beam', src: A, x0: 5, y0: 1, x1: 6, y1: 1, d: 1, n: 1, hit: [B] }, { k: 'dmg', id: B, sp: 1 }], 1200, { k: 'rlaser' }],
    ],
    [
      [[...card(A, 'm2'), move(A, [5, 1], [6, 1], [7, 1]), move(B, [6, 1], [7, 1], [8, 1]), { k: 'fall', id: B, x: 8, y: 1, edge: false }], 1900, { k: 'card', id: A }],
    ],
    [[[...card(A, 'rr'), { k: 'turn', id: A, by: 1 }], 800, { k: 'card', id: A }]],
    [
      [[...card(A, 'm3'), move(A, [7, 1], [7, 2], [7, 3], [7, 4])], 1150, { k: 'card', id: A }],
      [[{ k: 'gear', x: 7, y: 4, spin: -1 }, { k: 'turn', id: A, by: -1 }], 1000, { k: 'gear' }],
    ],
    [
      [[...card(A, 'm2'), move(A, [7, 4], [8, 4], [9, 4])], 1000, { k: 'card', id: A }],
      [[{ k: 'cp', id: A, n: 2 }], 1500, { k: 'cp' }],
    ],
  ],
];
const FINALE = [[{ k: 'win', id: A }], 2200, null];
const COMEBACK = [[{ k: 'reboot', id: B, x: REBOOT.x, y: REBOOT.y }], 1600, null];

const glyph = (t) => (t === 'sp' ? cardFace('sp') : cardFace(t));

export function mountLobby(sceneRoot, lessonRoot) {
  let arena = null;
  let active = false;
  let loading = false;
  let gen = 0;
  let players = [];
  let known = new Set();
  const course = lessonCourse();
  const demo = {};
  const resetDemo = () => {
    demo[A] = { id: A, name: '', color: '#d8d1c2', paint: '#d4cdbd', avatar: 10, x: 3, y: 5, d: 0, on: true };
    demo[B] = { id: B, name: '', color: '#55595f', paint: '#5b5f66', avatar: 7, x: 6, y: 5, d: 0, on: true };
  };
  resetDemo();

  // the phone in the corner of the frame
  lessonRoot.innerHTML = `
    <div class="lp-phone">
      <div class="lp-frames">${[0, 1, 2, 3, 4].map((i) => `<i class="lp-f" data-i="${i}"><b></b></i>`).join('')}</div>
      <div class="lp-hand">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i class="lp-c" data-i="${i}"></i>`).join('')}</div>
      <div class="lp-lock"><svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/></svg></div>
      <i class="lp-tap"></i>
    </div>`;
  const phone = lessonRoot.querySelector('.lp-phone');
  const frames = [...lessonRoot.querySelectorAll('.lp-f')];
  const hand = [...lessonRoot.querySelectorAll('.lp-c')];
  const lock = lessonRoot.querySelector('.lp-lock');
  const tap = lessonRoot.querySelector('.lp-tap');

  const robots = () => {
    const list = [demo[A], demo[B]];
    players.slice(0, 8).forEach((p, i) => {
      const st = course.starts[i];
      list.push({ ...p, x: st.x, y: st.y, d: st.d, on: true, away: !p.connected });
    });
    return list;
  };
  const sync = () => arena?.syncRobots(robots());

  /** Keep our idea of where the demo robots are in step with what we told the scene. */
  function track(fx) {
    for (const f of fx) {
      const r = demo[f.id];
      if (!r) continue;
      if (f.k === 'move') [r.x, r.y] = f.path[f.path.length - 1];
      else if (f.k === 'turn') r.d = turn(r.d, f.by);
      else if (f.k === 'fall') r.on = false;
      else if (f.k === 'reboot') Object.assign(r, { x: f.x, y: f.y, d: REBOOT.d, on: true });
    }
  }

  async function runTrailer(my) {
    const alive = () => my === gen && active && arena;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let n = 0;
    while (alive()) {
      // the demo robots leave and come back to their marks
      arena.syncRobots(robots().filter((r) => r.id !== A && r.id !== B));
      await wait(250);
      if (!alive()) return;
      resetDemo();
      sync();
      phone.className = 'lp-phone';
      for (const f of frames) f.className = 'lp-f';
      await wait(1200);
      for (let round = 0; round < ROUNDS.length && alive(); round++) {
        // deal: nine cards into the hand, five of them into the frames, lock
        phone.className = 'lp-phone deal';
        for (const f of frames) {
          f.className = 'lp-f';
          f.querySelector('b').innerHTML = '';
        }
        hand.forEach((h, i) => {
          h.className = `lp-c ${HAND[round][i] === 'sp' ? 'spam' : ''}`;
          h.innerHTML = glyph(HAND[round][i]);
        });
        await wait(700);
        for (let k = 0; k < 5 && alive(); k++) {
          const h = hand[PICKS[round][k]];
          pointAt(h);
          await wait(260);
          h.classList.add('used');
          frames[k].querySelector('b').innerHTML = h.innerHTML;
          frames[k].classList.add('set');
          await wait(330);
        }
        if (!alive()) return;
        pointAt(lock);
        await wait(260);
        phone.classList.add('locked');
        lock.classList.add('on');
        await wait(700);
        lock.classList.remove('on');
        phone.classList.add('run');
        tap.className = 'lp-tap';
        // the registers
        for (let reg = 0; reg < 5 && alive(); reg++) {
          frames.forEach((f, i) => f.classList.toggle('now', i === reg));
          if (reg > 0) frames[reg - 1].classList.add('past');
          arena.playBeat({ fx: [{ k: 'reveal', reg }], what: { k: 'reveal' } }, robots());
          await wait(650);
          for (const [fx, ms, what] of ROUNDS[round][reg]) {
            if (!alive()) return;
            track(fx);
            arena.playBeat({ fx, what }, robots());
            const focus = fx.find((f) => ['cp', 'fall', 'beam', 'gear'].includes(f.k));
            if (focus) {
              const at = focus.k === 'beam' ? { x: focus.x1, y: focus.y1 } : focus.k === 'cp' ? demo[focus.id] : focus;
              arena.punchIn(arena.pos(at.x, at.y), ms / 1000 + 0.5);
            }
            await wait(ms);
            sync();
          }
        }
        frames[4].classList.add('past');
        frames.forEach((f) => f.classList.remove('now'));
        await wait(500);
        phone.className = 'lp-phone';
      }
      if (!alive()) return;
      // the win: the hall lights find the winner; the robot that fell comes back
      arena.heroId = A;
      arena.playBeat({ fx: FINALE[0], what: null }, robots());
      audio.play('bell', { n: 3 });
      await wait(FINALE[1]);
      if (!alive()) return;
      track(COMEBACK[0]);
      arena.playBeat({ fx: COMEBACK[0], what: null }, robots());
      await wait(COMEBACK[1] + 1600);
      if (!alive()) return;
      arena.heroId = null;
      n++;
    }
  }

  function pointAt(el) {
    const pr = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    tap.style.left = `${r.left - pr.left + r.width / 2}px`;
    tap.style.top = `${r.top - pr.top + r.height / 2}px`;
    tap.className = 'lp-tap';
    void tap.offsetWidth;
    tap.className = 'lp-tap go';
  }

  async function start() {
    if (loading || arena || !active) return;
    loading = true;
    const my = ++gen;
    try {
      await Promise.race([document.fonts.load('600 40px Inter'), new Promise((r) => setTimeout(r, 1500))]);
      if (new URLSearchParams(location.search).has('flat')) throw new Error('flat view requested');
      const { Arena } = await import('./scene.js');
      if (!active || my !== gen) return;
      sceneRoot.replaceChildren();
      arena = new Arena(sceneRoot, { lobby: true });
      arena.sound = (name, o) => audio.play(name, o);
      audio.setLevel?.(0.4);
      arena.setDay(LOBBY_DAY);
      arena.setCourse(course);
      arena.setMode('lobby');
      sync();
      lessonRoot.hidden = false;
      runTrailer(my);
    } catch (err) {
      console.warn('Lobby scene unavailable:', err);
      lessonRoot.hidden = true;
      // a flat drawing of the test set instead
      const cv = document.createElement('canvas');
      cv.className = 'll-flat';
      sceneRoot.replaceChildren(cv);
      const w = sceneRoot.clientWidth || 800;
      const h = sceneRoot.clientHeight || 400;
      const tile = Math.floor(Math.min((w * 0.62) / course.w, (h * 0.8) / course.h));
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = '#1b1915';
      g.fillRect(0, 0, w, h);
      const { drawCourse } = await import('./minimap.js');
      drawCourse(g, course, { tile, ox: w * 0.06, oy: (h - tile * course.h) / 2 });
    } finally {
      loading = false;
      if (active && !arena && my !== gen) start();
    }
  }

  function release() {
    ++gen;
    arena?.destroy();
    arena = null;
    sceneRoot.replaceChildren();
  }

  return {
    setActive(value, roster = []) {
      const fresh = roster.filter((p) => !known.has(p.id));
      for (const p of roster) known.add(p.id);
      players = roster;
      if (value !== active) {
        active = value;
        if (!active) release();
      }
      if (!active) return;
      if (arena) {
        sync();
        if (fresh.length) audio.play('join');
      } else start();
    },
  };
}
