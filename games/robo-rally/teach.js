// How the big screen teaches during the race (and the narrator's look, which the Briefing shares):
//   - the voice line: Floor Control's only visual, a line of light at the top that ripples as it speaks,
//     with subtitles under it only when the voice can't be heard (voice.js decides);
//   - the first-time callouts: when a newcomer is racing (view.teach), the first laser hit, the first
//     damage, the first fall... each gets one short spoken line, once per big-screen session, and the race
//     holds for a moment so the room can take it in;
//   - the junk-card flight: every time a robot takes damage, its junk cards fly from the robot to that
//     player's token at the bottom (always on, for everyone);
//   - explanations: press and hold the mouse on anything on the board or the roster (createExplainer).
import { readBeat } from './chaos.js';
import { HAYWIRE, UPGRADES } from './cards.js';
import { cardSvgHtml, svgGlyph, robotSvg, formOf } from './glyphs.js';
import { flyCard, hwBack } from './mimic.js';
import { TOPICS, topicAtCell } from './topics.js';
import { mountDemo, hasDemo, miniCourse } from './demo.js';
import { drawCourse } from './minimap.js';

const TAU = Math.PI * 2;
export const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * The race's top margin (a fraction of the screen, as scene.js's setFrame takes it): room for the 1-5 strip
 * and the narrator's line, and, while subtitles show, for them too, so they never sit on the board.
 */
export const topMargin = (voice) => (voice.captions ? 0.3 : 0.2);

/** A name as the narrator says it: as typed, without emoji; an empty one is "Unit n". */
export function spoken(name, seat = 0) {
  const clean = String(name ?? '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️]/gu, (ch) => (/[0-9#*]/.test(ch) ? ch : ''))
    .replace(/\s+/g, ' ')
    .trim();
  return clean || `Unit ${seat + 1}`;
}

// ---------------------------------------------------------------------------------------------
// The voice line and subtitles
// ---------------------------------------------------------------------------------------------

/**
 * The narrator's line of light (top centre) and the subtitles under it. parent: the big screen's layer.
 *   show({ progress, drawIn })   progress 0..1 lights that much of it (the Briefing); null: all of it
 *   word()                       a ripple for a spoken word
 *   speaking(on)                 its centre ripples while on
 *   hide(delay)                  fades out
 *   collapse()                   shrinks to a dot and goes out (the Briefing's end)
 *   caption(text | null)         the subtitles
 */
export function createVoiceLine(parent) {
  const el = document.createElement('div');
  el.className = 'tc-voice';
  el.innerHTML = '<canvas></canvas>';
  const sub = document.createElement('div');
  sub.className = 'tc-sub';
  sub.setAttribute('aria-live', 'polite');
  sub.innerHTML = '<span></span>'; // (the box holds a soft dark halo; the span, the words)
  parent.append(el, sub);
  const cv = el.firstElementChild;
  const st = { visible: false, alpha: 0, draw: 1, drawTo: 1, progress: null, shown: null, amp: 0, ampTo: 0, phase: 0, hideAt: 0, collapsing: false };
  let raf = 0;
  let last = 0;

  function loop(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (st.hideAt && now >= st.hideAt) {
      st.visible = false;
      st.hideAt = 0;
    }
    st.alpha += ((st.visible ? 1 : 0) - st.alpha) * Math.min(1, dt * (st.visible ? 6 : 3.5));
    st.draw += (st.drawTo - st.draw) * Math.min(1, dt * (st.collapsing ? 3.2 : 2.6));
    if (st.collapsing && st.draw < 0.02) {
      st.collapsing = false;
      st.visible = false;
    }
    st.amp += (st.ampTo - st.amp) * Math.min(1, dt * 5);
    st.phase += dt * 9;
    if (st.progress != null) st.shown = st.shown == null ? st.progress : st.shown + (st.progress - st.shown) * Math.min(1, dt * 3);
    draw();
    if (st.visible || st.alpha > 0.01) raf = requestAnimationFrame(loop);
    else last = 0;
  }
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  function draw() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(el.clientWidth * dpr);
    const h = Math.round(el.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    el.style.opacity = st.alpha.toFixed(3);
    if (st.alpha < 0.01) return;
    const mid = h / 2;
    const half = (w / 2 - 6 * dpr) * st.draw;
    const x0 = w / 2 - half;
    const x1 = w / 2 + half;
    const lit = st.shown == null ? x1 : x0 + (x1 - x0) * Math.max(0, Math.min(1, st.shown));
    const sigma = w * 0.11;
    const yAt = (x) => mid + st.amp * dpr * Math.exp(-(((x - w / 2) / sigma) ** 2)) * Math.sin((x / w) * TAU * 5 - st.phase);
    g.lineCap = 'round';
    g.lineWidth = 2 * dpr;
    // (its glow is a CSS drop-shadow on the canvas: canvas shadows can pile up frame after frame in some browsers)
    if (half < 3 * dpr) {
      // a dot
      g.fillStyle = '#f4efe4';
      g.beginPath();
      g.arc(w / 2, mid, 2.6 * dpr, 0, TAU);
      g.fill();
      return;
    }
    const seg = (a, b, style) => {
      if (b - a < 1) return;
      g.strokeStyle = style;
      g.beginPath();
      for (let x = a; x <= b; x += 2 * dpr) {
        const y = yAt(x);
        if (x === a) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineTo(b, yAt(b));
      g.stroke();
    };
    seg(lit, x1, 'rgba(244,239,228,.22)');
    seg(x0, lit, '#f4efe4');
  }

  return {
    show({ progress = null, drawIn = false } = {}) {
      st.visible = true;
      st.hideAt = 0;
      st.collapsing = false;
      st.progress = progress;
      if (progress == null) st.shown = null;
      if (drawIn) st.draw = 0;
      st.drawTo = 1;
      wake();
    },
    setProgress(p) {
      st.progress = p;
      wake();
    },
    speaking(on) {
      st.ampTo = on ? 7 : 0;
      wake();
    },
    word() {
      st.amp = Math.max(st.amp, 10);
      st.ampTo = Math.max(st.ampTo, 6.5);
      wake();
    },
    hide(delay = 0) {
      st.ampTo = 0;
      st.hideAt = performance.now() + delay;
      wake();
    },
    collapse() {
      st.ampTo = 0;
      st.progress = st.progress == null ? null : 1;
      st.drawTo = 0;
      st.collapsing = true;
      wake();
    },
    caption(text) {
      if (text) {
        sub.firstElementChild.textContent = text;
        sub.classList.add('on');
      } else sub.classList.remove('on');
    },
    destroy() {
      cancelAnimationFrame(raf);
      el.remove();
      sub.remove();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Junk cards flying to a player's token
// ---------------------------------------------------------------------------------------------

/** The cards a damage event is made of: coral SPAM, violet face-down Haywires. */
export const junkCards = ({ sp = 0, hw = 0 }) => [...Array.from({ length: sp }, () => cardSvgHtml('sp')), ...Array.from({ length: hw }, () => hwBack())];

/**
 * Fly a robot's junk cards from `from` (screen point in layer) to its token at the bottom; onLand once the
 * first lands (the token flinches). big: drawn at 1.5x (the first time, while the narrator explains it).
 */
export function flyJunk(layer, cards, from, tokenEl, { big = false, onLand } = {}) {
  if (!from || !tokenEl || !cards.length) return;
  const L = layer.getBoundingClientRect();
  const r = (tokenEl.querySelector('.lm-tok-bot') ?? tokenEl).getBoundingClientRect();
  const to = { x: r.left - L.left + r.width / 2, y: r.top - L.top + r.height * 0.45 };
  let landed = false;
  cards.forEach((html, i) => {
    flyCard(layer, html, from, to, { delay: i * 130, size: big ? 3.3 : 2.2, endScale: 0.55, spin: (i % 2 ? 1 : -1) * 12, rise: 90 }).then(() => {
      if (landed) return;
      landed = true;
      onLand?.();
    });
  });
}

// ---------------------------------------------------------------------------------------------
// The first-time callouts
// ---------------------------------------------------------------------------------------------

const fired = new Set(); // once per big-screen page session: survives races, resets on reload

/**
 * The race's first-time moments, said once each (section 2.3 of docs/teaching/design.md).
 *   voice, line              voice.js and the voice line
 *   send(type, payload)      host actions (hold)
 *   arena()                  the scene (may be null)
 *   course()                 the course being raced
 * Call beat(v) for each new beat (before the arena plays it), view(v, prev) for each view, tick(v, left)
 * every frame while programming. Callouts fire only when v.teach (the winner's line always does).
 */
export function createCallouts({ voice, line, send, arena, course }) {
  let playing = null;
  let queued = null;
  let alive = true;
  let regWatch = null; // this register: each robot's next flag and whether its path crossed it
  let bigJunk = null; // whose junk cards fly big (the first damage, while the narrator explains it)
  const robotOf = (v, id) => v.robots.find((r) => r.id === id);

  function fire(id, text, { hold = 0, visual = null, always = false } = {}) {
    if (!alive || (!always && fired.has(id))) return;
    const item = { id, text, hold, visual };
    if (playing) {
      queued = item; // one at a time, at most one waiting: the newest wins
      return;
    }
    play(item);
  }

  async function play(item) {
    playing = item;
    fired.add(item.id);
    if (item.hold) send('hold', { ms: Math.min(4000, item.hold) });
    try {
      item.visual?.();
    } catch (err) {
      console.warn(err);
    }
    line.show({ progress: null });
    line.speaking(true);
    await voice.say(item.text, { id: `call-${item.id}`, onWord: () => line.word() });
    line.speaking(false);
    line.hide(600);
    playing = null;
    const next = queued;
    queued = null;
    if (next && alive && (next.id === 'win' || !fired.has(next.id))) play(next);
  }

  /** At a register's reveal: who will need to stop on which flag. */
  function watchRegister(v) {
    const c = course();
    regWatch = new Map();
    for (const r of v.robots) {
      if (r.x == null || r.on === false) continue;
      const cp = c?.checkpoints.find((x) => x.n === (r.cp ?? 0) + 1);
      if (cp) regWatch.set(r.id, { n: cp.n, x: cp.x, y: cp.y, crossed: false, reached: false });
    }
  }

  /** The register is over: someone drove over their flag without stopping on it? */
  function checkNearMiss(v) {
    if (!regWatch) return;
    for (const [id, w] of regWatch) {
      const r = robotOf(v, id);
      if (!w.crossed || w.reached || !r || r.on === false || (r.cp ?? 0) >= w.n) continue;
      regWatch = null;
      return fire('nearmiss', 'Close. Stop on the flag, or it doesn\'t count.', {
        hold: 1500,
        visual: () => {
          arena()?.flashFlag(w.n, '#f4efe4', { flicker: true });
          arena()?.popAt(w.x, w.y, 'cross', '#f4efe4', '', { y: 1.9, height: 0.5 });
        },
      });
    }
    regWatch = null;
  }

  return {
    /** Has this callout been said this session? */
    said: (id) => fired.has(id),

    /** Should this robot's junk cards fly big (once: the first damage)? */
    bigJunk(id) {
      if (bigJunk !== id) return false;
      bigJunk = null;
      return true;
    },

    /** A new beat (call before the arena plays it). */
    beat(v) {
      const b = v.beat;
      if (!b?.fx) return;
      const fx = b.fx;
      const reveal = fx.find((f) => f.k === 'reveal');
      if (reveal) {
        if (v.teach) checkNearMiss(v);
        watchRegister(v);
      }
      // the near miss: a path over the robot's next flag, and no flag for it
      if (regWatch) {
        for (const f of fx) {
          const w = regWatch.get(f.id);
          if (!w) continue;
          if (f.k === 'move' && f.path.slice(1).some(([x, y]) => x === w.x && y === w.y)) w.crossed = true;
          if (f.k === 'cp' && f.n === w.n) w.reached = true;
          if (f.k === 'fall') regWatch.delete(f.id);
        }
      }
      if (!v.teach) return;
      const a = arena();
      if (reveal && v.round === 1 && reveal.reg === 0 && v.robots.filter((r) => r.on !== false && !r.sd).length > 1) {
        fire('order', 'Slot one. Robots move one at a time. Number one first.', { hold: 2500 });
      }
      if (reveal && reveal.reg === 0) {
        const sd = v.robots.find((r) => r.sd);
        if (sd) fire('shutdown', 'Powered down. Sitting out a round to dump its damage.', { hold: 1500 });
      }
      if (['belt', 'push', 'gear'].includes(b.what?.k) && fx.some((f) => (f.k === 'move' && f.path.length > 1) || f.k === 'turn')) {
        fire('board', 'The floor moves after every slot.', { hold: 1800 });
      }
      const beam = fx.find((f) => f.k === 'beam' && f.hit?.length);
      if (beam && !fired.has('shot')) {
        if (a) {
          a.beamLinger = 0.6;
          setTimeout(() => arena() && (arena().beamLinger = 0), 2500);
        }
        fire('shot', beam.board ? 'Wall lasers fire after every slot.' : 'Lasers fire on their own. Straight ahead.', { hold: 1800 });
      }
      const dmg = fx.find((f) => f.k === 'dmg' && f.src !== 'reboot');
      if (dmg && !fired.has('damage')) {
        bigJunk = dmg.id; // its cards fly big this time
        fire('damage', "No health here. Damage is junk cards, sent to that robot's phone.", { hold: 3000 });
      }
      if (!fired.has('shove') && fx.some((f) => f.k === 'shove')) {
        if (readBeat(b, { course: course(), robots: v.robots }).events.some((e) => e.kind === 'contact')) fire('shove', 'Shove. Robots push robots.', { hold: 1500 });
      }
      const fall = fx.find((f) => f.k === 'fall');
      if (fall) {
        fire('fall', 'Robot down. Back next round, on the blue ring.', {
          hold: 2500,
          visual: () => {
            const at = rebootSpot(course(), fall, robotOf(v, fall.id));
            const color = robotOf(v, fall.id)?.color ?? '#9cc8ff';
            if (at) [0, 700, 1400].forEach((ms) => setTimeout(() => arena()?.ringAt(at.x, at.y, color, 1.1, 1.2), 900 + ms));
          },
        });
      }
      const cp = fx.find((f) => f.k === 'cp' && !fx.some((w) => w.k === 'win' && w.id === f.id));
      if (cp) {
        const total = course()?.checkpoints.length ?? 0;
        if (cp.n < total) {
          fire('flag', `Flag ${NUMBER[cp.n] ?? cp.n}. Next target: flag ${NUMBER[cp.n + 1] ?? cp.n + 1}.`, {
            hold: 1500,
            visual: () => setTimeout(() => arena()?.flashFlag(cp.n + 1, robotOf(v, cp.id)?.color ?? '#f4efe4'), 1600),
          });
        }
      }
      const rep = fx.find((f) => f.k === 'replace');
      if (rep?.from === 'sp') fire('spam', 'Junk card. Swapped for a random card.', { hold: 1500 });
      if (rep?.from === 'ag') fire('again', 'Again in slot one has nothing to repeat. Random card.', { hold: 1500 });
      if (b.what?.k === 'card' && b.what.cards?.some((t) => HAYWIRE[t]) && !b.what.replaced) {
        fire('haywire', "Haywire. Jammed in by last round's damage.", { hold: 1500 });
      }
    },

    /** Phase-level moments: the shop, a decision, the end of a register (near miss), the win. */
    view(v, prev) {
      if (!prev) return;
      if (prev.phase === 'activate' && v.phase !== 'activate' && v.teach) checkNearMiss(v);
      if (v.phase === 'over' && prev.phase !== 'over' && v.winner) {
        fire('win', 'Race complete. We have a winner.', { always: true });
      }
      if (!v.teach) return;
      if (v.phase === 'upgrade' && prev.phase !== 'upgrade') fire('shop', 'Shop open. Energy buys upgrades. Optional.');
      if (v.prompt && v.prompt.deadline !== prev.prompt?.deadline) fire('decide', 'A robot is choosing. Stand by.');
    },

    /** Every frame: the programming clock. */
    tick(v, left) {
      if (!v?.teach || fired.has('clock') || v.phase !== 'program' || !(v.opts?.timer > 0)) return;
      if (left > 0 && left <= 10_000 && v.robots.some((r) => !r.ready && !r.away)) fire('clock', 'Ten seconds. Empty slots fill at random.');
    },

    /** Stop (the race screen is going away). */
    stop() {
      alive = false;
      queued = null;
      if (playing) voice.cancel();
    },
  };
}

/** Where a robot that fell will come back: its board's blue ring, or its start pad on the dock. */
export function rebootSpot(c, fall, robot) {
  if (!c) return null;
  const inBoard = (b, x, y) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
  const near = (b) => Math.max(b.x - fall.x, 0, fall.x - (b.x + b.w - 1)) + Math.max(b.y - fall.y, 0, fall.y - (b.y + b.h - 1));
  const board = c.boards.find((b) => inBoard(b, fall.x, fall.y)) ?? [...c.boards].sort((a, b) => near(a) - near(b))[0];
  if (board?.reboot) return { x: board.reboot.x, y: board.reboot.y };
  const pad = c.starts.find((s) => s.n === robot?.pick);
  return pad ? { x: pad.x, y: pad.y } : null;
}

// ---------------------------------------------------------------------------------------------
// The big screen's explanations: press and hold the mouse on something (a square of the board, a robot, a
// player's token) and a panel in the corner explains it, as the phone's Guide entry does: the picture,
// 1-3 looping clips, one line of fine print. It reads the phone guide's catalog (topics.js) and plays its
// clips (demo.js). Clicking anywhere else, or Esc, closes it.
// ---------------------------------------------------------------------------------------------

// a square's own picture, as the Guide draws it (a tiny course made of that one thing)
const CELL_PICS = {
  'belt-green': { grid: ['g>'] },
  'belt-blue': { grid: ['b>'] },
  gear: { grid: ['G+'] },
  pit: { grid: ['XX'] },
  battery: { grid: ['EE'] },
  pusher: { size: [1, 1], pushers: [[0, 0, 'W', [1, 3, 5]]] },
  laser: { size: [1, 1], lasers: [[0, 0, 'W', 1]] },
  flag: { size: [1, 1], flags: [[0, 0]] },
  reboot: { size: [1, 1], reboot: [0, 0, 'N'] },
  dock: { grid: ['DD'] },
  pad: { grid: ['S1'] },
};
const HOLD_MS = 450;

/**
 * host: the big screen's root layer. o: { getView(), course(), pick(clientX, clientY) -> arena.pick result,
 * tokenAt(clientX, clientY) -> robot id of the roster token there, or null }. Returns { destroy() }.
 */
export function createExplainer(host, o) {
  const panel = document.createElement('div');
  panel.className = 'tc-explain';
  panel.hidden = true;
  host.append(panel);
  let hold = 0;
  let down = null;
  let swallowClick = false;
  let stops = [];

  const view = () => o.getView();
  function topicsAt(e) {
    const v = view();
    const tokenId = o.tokenAt(e.clientX, e.clientY);
    if (tokenId) return { ids: ['robot'], robot: tokenId };
    const hit = o.pick(e.clientX, e.clientY);
    if (!hit) return null;
    if (hit.robot) return { ids: ['robot'], robot: hit.robot };
    const c = o.course();
    if (!c) return null;
    const robots = (v?.robots ?? []).filter((r) => r.x != null).map((r) => ({ x: r.x, y: r.y, on: r.on }));
    const ids = topicAtCell(c, hit.x, hit.y, hit.fx, hit.fy, { robots });
    const cell = hit.x >= 0 && hit.y >= 0 && hit.x < c.w && hit.y < c.h ? c.cells[hit.y * c.w + hit.x] : null;
    if (cell?.k === 'start' && !ids.includes('pad')) ids.unshift('pad');
    // a plain square of a starting board says "dock" only after what's on it
    return ids.length ? { ids } : null;
  }

  function resolve(id, robotId) {
    const t = TOPICS[id];
    if (!t) return null;
    const v = view();
    const out = { ...t, id, clips: [...t.clips] };
    if (id === 'robot' && robotId) {
      const r = v?.robots?.find((q) => q.id === robotId);
      if (r) {
        out.name = r.name;
        out.robot = r;
        out.clips = [...(r.perm ?? r.ups ?? []).slice(0, 2).filter((k) => UPGRADES[k]).map((k) => [k, UPGRADES[k].name]), ...out.clips];
      }
    }
    if (id === 'battery' && v?.opts && !v.opts.upgrades) out.fine = 'With upgrades off there’s no energy: batteries do nothing.';
    if (id === 'edge' && v?.opts?.lessDeadly) out.fine = 'Map perimeter is on: a wall runs all the way round, so nobody falls off the edge.';
    return out;
  }

  function picHtml(t) {
    const p = t.pic ?? {};
    if (t.robot) return robotSvg(t.robot);
    if (p.cell && CELL_PICS[p.cell]) return `<canvas class="tc-ex-cell" data-cell="${p.cell}"></canvas>`;
    if (p.card) return cardSvgHtml(p.card);
    if (p.g) return svgGlyph(p.g);
    if (p.robot) return robotSvg({ color: '#7aa8ff', avatar: 2 });
    return '';
  }

  function show(found) {
    close();
    const [first, ...also] = found.ids;
    const t = resolve(first, found.robot);
    if (!t) return;
    const clips = t.clips.filter(([k]) => hasDemo(k)).slice(0, 3);
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    panel.innerHTML = `
      <div class="tc-ex-head"><span class="tc-ex-pic">${picHtml(t)}</span>${t.name ? `<b class="tc-ex-name">${esc(t.name)}</b>` : ''}
        ${also.length ? `<span class="tc-ex-also">${also.map((a) => `<button data-ex="${esc(a)}">${picHtml(resolve(a) ?? {})}</button>`).join('')}</span>` : ''}</div>
      ${clips.length ? `<div class="tc-ex-clips n${clips.length}">${clips.map(([k, cap]) => `<figure><canvas data-demo="${esc(k)}"></canvas>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      ${t.fine ? `<p class="tc-ex-fine">${esc(t.fine)}</p>` : ''}`;
    panel.hidden = false;
    panel.classList.remove('in');
    void panel.offsetWidth;
    panel.classList.add('in');
    const color = t.robot?.color ?? '#ff4d6d';
    const safe = !!view()?.opts?.lessDeadly;
    for (const cv of panel.querySelectorAll('canvas[data-demo]')) stops.push(mountDemo(cv, cv.dataset.demo, color, { safeEdges: safe, form: t.robot ? formOf(t.robot) : 0 }));
    for (const cv of panel.querySelectorAll('canvas[data-cell]')) drawCell(cv);
    for (const b of panel.querySelectorAll('[data-ex]')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        show({ ids: [b.dataset.ex, first, ...also.filter((a) => a !== b.dataset.ex)], robot: found.robot });
      });
    }
  }

  function drawCell(cv) {
    const c = miniCourse(CELL_PICS[cv.dataset.cell]);
    const w = cv.clientWidth || 48;
    const h = cv.clientHeight || 48;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = Math.min(w / c.w, h / c.h);
    drawCourse(g, c, { tile: T, ox: (w - T * c.w) / 2, oy: (h - T * c.h) / 2, glow: true, cpNext: 1 });
  }

  function close() {
    for (const stop of stops) stop?.();
    stops = [];
    panel.hidden = true;
    panel.innerHTML = '';
  }

  // ----- press and hold -----
  const cancel = () => {
    clearTimeout(hold);
    hold = 0;
    host.classList.remove('tc-holding');
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    if (!panel.hidden && !panel.contains(e.target)) {
      close(); // a click anywhere else closes it (and does nothing else)
      swallowClick = true;
      return;
    }
    if (panel.contains(e.target) || e.target.closest('button, a, input, .lm-corner')) return;
    // what's under the pointer as it goes down (the camera drifts: by the time the hold is long enough, the
    // board may have moved a little under a still pointer)
    const found = topicsAt(e);
    if (!found) return;
    down = { x: e.clientX, y: e.clientY };
    cancel();
    host.classList.add('tc-holding');
    hold = setTimeout(() => {
      host.classList.remove('tc-holding');
      hold = 0;
      swallowClick = true;
      show(found);
    }, HOLD_MS);
  };
  const onMove = (e) => {
    if (hold && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) cancel();
  };
  const onUp = () => cancel();
  const onClick = (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.stopImmediatePropagation();
      close();
    }
  };
  host.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  host.addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);
  host.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    close,
    get open() {
      return !panel.hidden;
    },
    destroy() {
      cancel();
      close();
      host.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', onKey, true);
      panel.remove();
    },
  };
}
