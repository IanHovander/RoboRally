// The big screen during a race: the pop-up book (scene.js) fills it, and around it only what the
// whole room shares: a ticket for each player along the bottom (their robot, flags punched, energy,
// their card for this register), the five registers while cards play, and the clock.
// Pictures and motion instead of words.
import { html, raw } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';
import { COURSES, getCourse } from './board.js';
import { UPGRADES } from './cards.js';
import { drawCourse } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon } from './icons.js';
import { mountDemo } from './demo.js';
import { glyph } from './glyphs.js';
import { music, sfx } from './sound.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const TIMERS = [0, 60, 120, 180];
const STEPS = [['card', 'card'], ['belt', 'belt'], ['push', 'push'], ['gear', 'gear'], ['blaser', 'laser'], ['rlaser', 'robotLaser'], ['battery', 'energy'], ['cp', 'flag']];

export default function (root, api) {
  root.innerHTML = `
    <div class="rr-host">
      <div class="rr-3d"></div>
      <div class="rr-shade"></div>
      <div class="rr-top"><div class="rr-track"></div><div class="rr-clock"></div></div>
      <div class="rr-setup"></div>
      <div class="rr-over"></div>
      <div class="rr-rail"></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const host = $('.rr-host');
  const box3d = $('.rr-3d');
  const parts = { track: $('.rr-track'), clock: $('.rr-clock'), setup: $('.rr-setup'), over: $('.rr-over'), rail: $('.rr-rail') };
  const shown = {};
  const set = (key, content) => {
    const text = String(content ?? '');
    if (shown[key] === text) return false;
    shown[key] = text;
    parts[key].innerHTML = text;
    for (const c of parts[key].querySelectorAll('canvas[data-demo]')) mountDemo(c, c.dataset.demo, '#ff922b');
    return true;
  };

  let view = null;
  let arena = null;
  let flat = null; // the 2D fallback
  let lastBeat = -1;
  let lastPhase = null;
  let revealKey = null;
  let revealAt = 0;
  let overAt = 0;
  const thumbs = new Map();

  // Load the 3D scene (it's big), once the fonts its textures use are ready.
  (async () => {
    try {
      await Promise.race([document.fonts.load('800 64px Inter'), new Promise((r) => setTimeout(r, 1500))]);
      const { Arena } = await import('./scene.js');
      if (!root.isConnected) return;
      arena = new Arena(box3d);
      layout();
      if (view) {
        lastBeat = view.beat.n;
        apply(view);
      }
    } catch (err) {
      console.warn('3D view unavailable, using the flat map:', err);
      flat = document.createElement('canvas');
      flat.className = 'rr-flat';
      box3d.append(flat);
      if (view) apply(view);
    }
  })();

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-host]');
    if (!el) return;
    const [key, rawValue] = el.dataset.host.split('=');
    const value = rawValue === 'true' ? true : rawValue === 'false' ? false : /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue;
    api.send('setOpt', { key, value });
  });

  /** Keep the course clear of the HUD: the rail below, the track above, the setup panel to the left. */
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  function layout() {
    if (!arena) return;
    const rail = parts.rail.getBoundingClientRect();
    const setup = view?.phase === 'setup' ? parts.setup.getBoundingClientRect() : null;
    const H = host.clientHeight;
    const panel = view?.phase === 'over' ? parts.over.querySelector('.rr-over-panel.late') : null;
    arena.setInsets({
      bottom: rail.height ? H - rail.top + 6 : 0,
      top: rem() * 2.8, // the register track may overlap the far edge a little: the course gets more room
      left: setup?.width ? setup.right : 0,
      right: panel ? Math.max(0, host.clientWidth - panel.offsetLeft) : 0,
    });
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(parts.rail);
  ro.observe(parts.setup);
  ro.observe(host);

  /** Robots as the scene should show them; before the race, picked robots stand on their start spaces. */
  function sceneRobots(v) {
    const c = getCourse(v.opts.course);
    return v.robots
      .map((r) => {
        const mood = v.phase === 'over' && r.id === v.winner ? 'happy' : undefined;
        if (r.x != null) return { ...r, mood };
        if (v.phase !== 'start' || r.pick == null) return null;
        const st = c.starts.find((s) => s.n === r.pick);
        return st ? { ...r, x: st.x, y: st.y, d: st.d, on: true } : null;
      })
      .filter(Boolean);
  }

  function statuses(v) {
    const out = {};
    for (const r of v.robots) {
      if (r.away || r.x == null) continue;
      if (v.phase === 'program') out[r.id] = r.ready ? (r.wantSd ? 'off' : 'ready') : 'think';
      if (v.phase === 'upgrade') out[r.id] = r.ready ? 'ready' : 'think';
    }
    if (v.prompt) out[v.prompt.id] = { icon: v.prompt.icon ? upgradeIcon(v.prompt.icon) : v.prompt.kind === 'weapon' ? '🎯' : '⚡' };
    return out;
  }

  function apply(v) {
    const robots = sceneRobots(v);
    if (arena) {
      arena.setCourse(v.opts.course);
      arena.camMode = v.phase === 'setup' ? 'orbit' : 'race';
      if (v.beat.n !== lastBeat) {
        lastBeat = v.beat.n;
        if (v.phase === 'activate' || v.phase === 'over') arena.playBeat(v.beat, robots);
      }
      arena.syncRobots(robots);
      const picks = {};
      for (const r of v.robots) if (r.pick != null) picks[r.pick] = r.color;
      arena.showStarts(v.phase === 'start' ? picks : null);
      arena.focusOn = v.phase === 'over' ? v.winner : null;
      arena.setStatus(statuses(v));
      arena.showNames(v.phase !== 'activate');
      arena.idle = ['upgrade', 'program'].includes(v.phase);
    } else if (flat) drawFlat(v, robots);
  }

  function drawFlat(v, robots) {
    const c = getCourse(v.opts.course);
    const w = box3d.clientWidth;
    const h = box3d.clientHeight;
    const tile = Math.floor(Math.min((w - 40) / c.w, (h - 200) / c.h));
    const dpr = window.devicePixelRatio || 1;
    flat.width = w * dpr;
    flat.height = h * dpr;
    flat.style.width = `${w}px`;
    flat.style.height = `${h}px`;
    const g = flat.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    drawCourse(g, c, { tile, ox: (w - tile * c.w) / 2, oy: (h - tile * c.h) / 2 - 40, robots });
  }

  // ---------- sound that follows the phases ----------

  function phaseSounds(v) {
    if (v.phase !== lastPhase) {
      const was = lastPhase;
      lastPhase = v.phase;
      music({ setup: 'lobby', upgrade: 'think', program: 'think' }[v.phase] ?? null);
      if (was && ['start', 'upgrade', 'program'].includes(v.phase)) sfx.start();
      if (v.phase === 'over') overAt = Date.now();
    }
    // the cards turn over together at the start of each register
    const key = `${v.round}:${v.reg}`;
    if (v.phase === 'activate' && v.beat.what?.k === 'reveal' && revealKey !== key) {
      revealKey = key;
      revealAt = Date.now();
      v.robots.forEach((r, i) => Array.isArray(r.regs?.[v.reg]) && sfx.flip(0.05 + i * 0.09));
    }
  }

  let lastTick = 0;
  const tickTimer = setInterval(() => {
    const v = view;
    if (!v || !['start', 'upgrade', 'program'].includes(v.phase) || !v.deadline) return;
    const left = Math.ceil((v.deadline - api.now()) / 1000);
    if (left > 0 && left <= 10 && left !== lastTick) {
      lastTick = left;
      sfx.tick(left <= 5);
    }
    const ring = parts.clock.querySelector('.rr-ring-fill');
    if (ring) {
      const total = Number(ring.dataset.total) || 1;
      ring.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, (v.deadline - api.now()) / total)) * 100);
    }
  }, 200);

  // ---------- the HUD ----------

  const robotById = (v, id) => v.robots.find((r) => r.id === id);
  // things that just happened get a little animation once (the rail is redrawn often)
  const seen = new Set();
  const fresh = (key) => (seen.has(key) ? '' : (seen.add(key), 'fresh'));
  const bot = (r, mood) => (r ? html`<span class="rr-av" style="--c:${r.color}">${avatar({ ...r, connected: !r.away }, mood ? { mood } : undefined)}</span>` : '');
  const card = (t, cls = '') => html`<span class="pcard ${cardKind(t)} ${cls}">${raw(cardPicture(t))}</span>`;

  function render(v) {
    host.dataset.phase = v.phase;
    set('track', renderTrack(v));
    set('clock', renderClock(v));
    set('setup', v.phase === 'setup' ? renderSetup(v) : '');
    set('over', v.phase === 'over' ? renderOver(v) : '');
    set('rail', renderRail(v));
    layout();
  }

  function renderTrack(v) {
    if (v.phase !== 'activate') return '';
    const k = v.beat.what?.k;
    const step = k === 'reveal' || k === 'upgrade' || k === 'reboot' ? 'card' : k;
    return html`
      <div class="rr-regs">${[0, 1, 2, 3, 4].map((i) => html`<span class="rr-reg ${i === v.reg && 'now'} ${i < v.reg && 'done'}"><b>${i + 1}</b></span>`)}</div>
      <div class="rr-steps">${STEPS.map(([key, g]) => html`<span class="${key === step && 'on'}">${raw(glyph(g))}</span>`)}</div>`;
  }

  function renderClock(v) {
    const timed = ['start', 'upgrade', 'program'].includes(v.phase) && v.deadline;
    if (!timed) return '';
    const total = v.phase === 'start' ? 40000 : v.phase === 'upgrade' ? 60000 : (v.opts.timer || 300) * 1000;
    return html`
      <div class="rr-clockface">
        <svg viewBox="0 0 36 36" class="rr-ring"><circle cx="18" cy="18" r="15.9" pathLength="100" class="rr-ring-bg"/><circle cx="18" cy="18" r="15.9" pathLength="100" class="rr-ring-fill" data-total="${total}"/></svg>
        <span class="timer" data-deadline="${v.deadline}"></span>
      </div>
      <button class="rr-hurry" data-action="hurry" aria-label="Hurry up">${raw(glyph('hurry'))}</button>`;
  }

  function renderSetup(v) {
    const o = v.opts;
    const tog = (key, icon, demoKey) => html`
      <button class="rr-opt ${o[key] && 'on'}" data-host="${key}=${String(!o[key])}" aria-pressed="${String(!!o[key])}">
        <canvas class="rr-demo" data-demo="${demoKey}"></canvas><span class="rr-opt-ic">${raw(glyph(icon))}</span><i>${raw(glyph(o[key] ? 'check' : 'cross'))}</i>
      </button>`;
    return html`
      <div class="rr-courses">
        ${COURSES.filter((x) => x.id !== 'lab').map((x) => html`
          <button class="rr-course ${x.id === o.course && 'on'}" data-host="course=${x.id}">
            <img alt="" src="${thumb(x.id)}">
            <span class="rr-course-meta"><span class="rr-pips">${[1, 2, 3, 4].map((n) => html`<i class="${n <= (LEVEL[x.level] ?? 1) && 'on'}"></i>`)}</span><span class="rr-flagn">${raw(glyph('flag'))}${x.checkpoints.length}</span></span>
          </button>`)}
      </div>
      <div class="rr-opts">
        ${tog('upgrades', 'energy', 'upgrades')}
        ${tog('lessDeadly', 'wall', 'safe-edges')}
        ${tog('lessSpam', 'damage', 'less-spam')}
      </div>
      <div class="rr-seg"><span>${raw(glyph('timer'))}</span>${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-host="timer=${t}">${t ? `${t / 60}′` : raw(glyph('infinity'))}</button>`)}</div>
      <button class="btn btn-xl rr-go" data-action="begin" aria-label="Start">${raw(glyph('play'))}</button>`;
  }

  function renderOver(v) {
    const ranked = [...v.robots].sort((a, b) => (b.cp ?? 0) - (a.cp ?? 0) || (a.id === v.winner ? -1 : b.id === v.winner ? 1 : 0));
    const podium = [ranked[1], ranked[0], ranked[2]];
    const late = Date.now() - overAt > 3500;
    return html`
      <div class="rr-over-panel ${late && 'late'}">
        <div class="rr-podium">
          ${podium.map((r, i) => (r ? html`
            <div class="rr-step p${[2, 1, 3][i]}" style="--c:${r.color}">
              ${bot(r, i === 1 ? 'happy' : undefined)}
              <b>${r.name}</b>
              <div class="rr-block"><span class="rr-holes">${Array.from({ length: v.cps }, (_, k) => html`<i class="${k < (r.cp ?? 0) && 'got'}"></i>`)}</span><em>${[2, 1, 3][i]}</em></div>
            </div>` : html`<div class="rr-step empty"></div>`))}
        </div>
        <table class="rr-stats">
          <tr><th></th><th>${raw(glyph('push'))}</th><th>${raw(glyph('hit'))}</th><th>${raw(glyph('fall'))}</th><th>${raw(glyph('damage'))}</th></tr>
          ${ranked.map((r) => html`<tr style="--c:${r.color}"><td>${bot(r)}<span>${r.name}</span></td><td>${r.stats?.pushes ?? 0}</td><td>${r.stats?.hits ?? 0}</td><td>${r.stats?.falls ?? 0}</td><td>${r.stats?.damage ?? 0}</td></tr>`)}
        </table>
        <button class="btn btn-xl rr-home" data-action="finish" aria-label="Back to the lobby">${raw(glyph('home'))}</button>
      </div>`;
  }

  function renderRail(v) {
    const n = v.robots.length;
    return html`<div class="rr-tags n${Math.min(n, 8)}">${v.robots.map((r) => renderTag(v, r))}</div>`;
  }

  function renderTag(v, r) {
    const acting = v.phase === 'activate' && v.beat.what?.id === r.id;
    const deciding = v.prompt?.id === r.id;
    const regs = r.regs ?? [0, 0, 0, 0, 0];
    let side = '';
    if (r.away) side = html`<span class="rr-side-ic">${raw(glyph('sleep'))}</span>`;
    else if (v.phase === 'start') side = r.pick != null ? html`<span class="rr-pick ${fresh(`pick:${r.id}:${r.pick}`)}">${r.pick}</span>` : html`<span class="rr-side-ic dots">${raw(glyph('dots'))}</span>`;
    else if (v.phase === 'upgrade') side = r.ready ? html`<span class="rr-side-ic ok">${raw(glyph('check'))}</span>` : html`<span class="rr-side-ic dots">${raw(glyph('dots'))}</span>`;
    else if (v.phase === 'program') {
      side = r.wantSd
        ? html`<span class="rr-side-ic">${raw(glyph('power'))}</span>`
        : html`<span class="rr-minis ${r.ready && 'ready'}">${regs.map((x, i) => html`<i class="${x ? `on ${fresh(`mini:${r.id}:${v.round}:${i}`)}` : ''}"></i>`)}</span>`;
    } else if (v.phase === 'activate') {
      const now = regs[v.reg];
      if (r.sd) side = html`<span class="rr-side-ic">${raw(glyph('power'))}</span>`;
      else if (r.x != null && !r.on) side = html`<span class="rr-side-ic spin">${raw(glyph('reboot'))}</span>`;
      else if (Array.isArray(now) && now.length) side = html`<span class="rr-now-card">${card(now[now.length - 1], Date.now() - revealAt < 700 ? 'flip' : '')}</span>`;
      else if (now) side = html`<span class="rr-now-card">${html`<span class="pcard down"></span>`}</span>`;
    }
    const ups = [...(r.perm ?? [])];
    return html`
      <div class="rr-tag ${r.away && 'away'} ${acting && 'acting'} ${deciding && 'deciding'} ${r.id === v.prio && !['setup', 'start'].includes(v.phase) && 'prio'} ${r.id === v.winner && 'winner'}" style="--c:${r.color}">
        <div class="rr-tag-bot">${bot(r, r.id === v.winner ? 'happy' : undefined)}</div>
        <div class="rr-tag-main">
          <div class="rr-tag-name"><b>${r.name}</b>${r.id === v.prio && !['setup', 'start'].includes(v.phase) && html`<span class="rr-prio" aria-label="Priority">${raw(glyph('priority'))}</span>`}</div>
          <div class="rr-tag-meta">
            <span class="rr-holes">${Array.from({ length: v.cps }, (_, k) => html`<i class="${k < (r.cp ?? 0) && `got ${fresh(`cp:${r.id}:${k}`)}`}"></i>`)}</span>
            ${v.opts.upgrades && r.en != null && html`<span class="rr-en">${raw(glyph('energy'))}${r.en}</span>`}
          </div>
          ${(ups.length > 0 || r.temp > 0) && html`<div class="rr-tag-ups">${ups.map((k) => html`<span title="${UPGRADES[k]?.name}">${upgradeIcon(k)}</span>`)}${r.temp > 0 && html`<span class="temp">${r.temp}</span>`}</div>`}
        </div>
        <div class="rr-tag-side">${side}${deciding && html`<span class="timer" data-deadline="${v.prompt.deadline}"></span>`}</div>
      </div>`;
  }

  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(6, Math.floor(260 / Math.max(c.w, c.h * 1.6)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile });
    const url = cv.toDataURL();
    thumbs.set(id, url);
    return url;
  }

  // the podium slides in once the 3D celebration has had its moment
  const overTimer = setInterval(() => {
    const panel = view?.phase === 'over' && Date.now() - overAt > 3500 && parts.over.querySelector('.rr-over-panel:not(.late)');
    if (panel) {
      panel.classList.add('late');
      layout();
    }
  }, 500);

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      view = next;
      phaseSounds(next);
      apply(next);
      render(next);
    },
    destroy() {
      clearInterval(tickTimer);
      clearInterval(overTimer);
      ro.disconnect();
      music(null);
      arena?.destroy();
    },
  };
}
