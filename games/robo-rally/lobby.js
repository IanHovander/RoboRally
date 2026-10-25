// The factory entrance, shared by the big screen and phones. No connection or game state here.
import { mountDemo } from './demo.js';
import { getCourse } from './board.js';
import { drawCourse } from './minimap.js';

const LESSONS = [
  { title: 'Pick five moves', demo: 'lobby-program', symbols: '↑  ↻  ↑↑  ↺  ↑', detail: 'Your robot follows your cards, from left to right.' },
  { title: 'Expect a little chaos', demo: 'belts', symbols: '▶  ⚙  ⇢', detail: 'After each move, the factory moves too. Robots can push each other.' },
  { title: 'Race to the flags', demo: 'lobby-flags', symbols: '⚑ 1 → ⚑ 2 → ⚑ 3', detail: 'Reach the numbered flags in order. First to the last flag wins.' },
];

export function mountLessons(root) {
  if (!root) return;
  root.innerHTML = `<nav class="lesson-tabs" aria-label="How to race">${LESSONS.map((l, i) => `<button type="button" data-lesson="${i}" aria-label="${l.title}">${i + 1}<span>${['Program', 'Play', 'Win'][i]}</span></button>`).join('')}</nav>
    <div class="lesson-body"><canvas role="img"></canvas><div class="lesson-copy"><div class="lesson-symbols" aria-hidden="true"></div><h2></h2><details><summary>A little more</summary><p></p></details></div></div>`;
  let index = 0, stop;
  const select = (n) => {
    index = n;
    const l = LESSONS[n];
    root.querySelector('h2').textContent = l.title;
    root.querySelector('p').textContent = l.detail;
    root.querySelector('.lesson-symbols').textContent = l.symbols;
    root.querySelector('canvas').setAttribute('aria-label', l.detail);
    for (const b of root.querySelectorAll('[data-lesson]')) b.setAttribute('aria-pressed', String(Number(b.dataset.lesson) === n));
    stop?.();
    stop = mountDemo(root.querySelector('canvas'), l.demo, '#ffc15a');
  };
  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-lesson]');
    if (button) select(Number(button.dataset.lesson));
  });
  // Keep a chosen lesson in place while someone reads or interacts with it.
  let touched = false;
  root.addEventListener('pointerdown', () => { touched = true; });
  root.addEventListener('focusin', () => { touched = true; });
  const timer = setInterval(() => {
    if (!root.isConnected) { clearInterval(timer); stop?.(); }
    else if (!touched && root.offsetParent !== null && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) select((index + 1) % LESSONS.length);
  }, 10500);
  select(0);
}

export function mountFactoryLobby(root) {
  let arena, active = false, loading = false, generation = 0, players = [];
  const course = getCourse('closing-time');
  const robots = () => (players.length ? players.slice(0, 8) : [
    { id: 'preview-a', name: '', color: '#ffc15a' },
    { id: 'preview-b', name: '', color: '#59cddd' },
    { id: 'preview-c', name: '', color: '#d587ff' },
  ]).map((p, seat) => {
    const start = course.starts[seat];
    return { ...p, seat, x: start.x, y: start.y, d: start.d, on: true };
  });
  const fallback = () => {
    root.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.width = course.w * 48;
    canvas.height = course.h * 48;
    canvas.className = 'factory-flat';
    root.append(canvas);
    drawCourse(canvas.getContext('2d'), course, { tile: 48 });
  };
  async function start() {
    if (loading || arena || !active) return;
    loading = true;
    const version = ++generation;
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { fallback(); return; }
      await document.fonts.ready;
      const { Arena } = await import('./scene.js');
      if (!active || version !== generation) return;
      root.replaceChildren();
      arena = new Arena(root);
      arena.setCourse(course.id);
      arena.syncRobots(robots());
    } catch (err) {
      console.warn('Factory preview unavailable:', err);
      if (active) fallback();
    } finally { loading = false; if (active && version !== generation) start(); }
  }
  function release() {
    ++generation;
    if (arena) {
      // Dispose the preview before the game creates its own scene.
      const resources = new Set();
      arena.scene.traverse((o) => {
        if (o.geometry) resources.add(o.geometry);
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!mat) continue;
          resources.add(mat);
          for (const v of Object.values(mat)) if (v?.isTexture) resources.add(v);
        }
      });
      arena.destroy();
      arena.composer?.dispose();
      for (const resource of resources) resource.dispose();
      arena = null;
    }
    root.replaceChildren();
  }
  return {
    setActive(value, roster = []) {
      players = roster;
      if (value !== active) { active = value; if (!active) release(); }
      if (active) { if (arena) arena.syncRobots(robots()); else start(); }
    },
  };
}
