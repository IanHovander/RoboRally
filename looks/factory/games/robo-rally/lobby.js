// The factory entrance, shared by the big screen and phones. No connection or game state here.
import { mountDemo } from './demo.js';
import { getCourse } from './board.js';
import { drawCourse } from './minimap.js';

// The three lessons are animations only: a step number, a picture of what it's about, and a loop that
// shows it. (The labels are for screen readers.)
const LESSONS = [
  { demo: 'lobby-program', icon: '<span class="lesson-card">↑</span>', label: 'Your robot follows your five cards, from left to right.' },
  { demo: 'lobby-chaos', icon: '⚙️', label: 'After each move the factory moves too, and robots push each other.' },
  { demo: 'lobby-flags', icon: '🏁', label: 'Reach the numbered flags in order. First to the last flag wins.' },
];

export function mountLessons(root) {
  if (!root) return;
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'How to race');
  root.innerHTML = LESSONS.map((l, i) => `
    <figure class="lesson" role="listitem">
      <figcaption aria-hidden="true"><b>${i + 1}</b>${l.icon.startsWith('<') ? l.icon : `<i>${l.icon}</i>`}</figcaption>
      <canvas role="img" aria-label="${l.label}"></canvas>
    </figure>`).join('');
  root.querySelectorAll('canvas').forEach((canvas, i) => mountDemo(canvas, LESSONS[i].demo, '#ffc15a'));
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
