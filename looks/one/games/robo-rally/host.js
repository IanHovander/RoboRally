// The big screen during a race: a letterboxed film of the hall. The black bars are the only HUD:
// on top, the course, the clock and the five registers; along the bottom, the cast (each robot, its flags,
// its energy, and the card it's playing right now). Everything else is in the picture.
import { html, raw } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { UPGRADES } from './cards.js';
import { drawCourse } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon } from './icons.js';
import { mountDemo } from './demo.js';
import { paint, portrait } from './look.js';
import * as audio from './audio.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const TIMERS = [0, 60, 120, 180];
const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M10.5 18.5h3" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z" fill="currentColor"/></svg>',
  hurry: '<svg viewBox="0 0 24 24"><path d="M3 5l8 7-8 7zM12 5l8 7-8 7z" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M5 3l16 9-16 9z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  reboot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/></svg>',
  push: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h11M10 7l5 5-5 5"/><rect x="17" y="6" width="4" height="12" rx="1"/></svg>',
  hit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>',
  fall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="17" rx="8" ry="3.5"/><path d="M12 3v9M8.5 8.5 12 12l3.5-3.5"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 2.5v19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 3.5h12l-3 4 3 4H6z" fill="currentColor"/></svg>',
};

export default function (root, api) {
  root.innerHTML = `
    <div class="ll-host">
      <div class="ll-bar top ll-top">
        <div class="ll-t-left"></div>
        <div class="ll-t-mid"></div>
        <div class="ll-t-right"></div>
      </div>
      <div class="ll-frame">
        <div class="ll-3d"></div>
        <div class="ll-overlay"></div>
      </div>
      <div class="ll-bar bottom ll-castbar"></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const host = $('.ll-host');
  const box3d = $('.ll-3d');
  const parts = { left: $('.ll-t-left'), mid: $('.ll-t-mid'), right: $('.ll-t-right'), overlay: $('.ll-overlay'), cast: $('.ll-castbar') };
  const shown = {};
  const set = (key, content) => {
    const text = String(content ?? '');
    if (shown[key] === text) return false;
    shown[key] = text;
    parts[key].innerHTML = text;
    for (const c of parts[key].querySelectorAll('canvas[data-demo]')) mountDemo(c, c.dataset.demo, '#f0a54a');
    return true;
  };

  let view = null;
  let arena = null;
  let flat = null;
  let lastBeat = -1;
  let lastPhase = null;
  let readySeen = new Set();
  const thumbs = new Map();

  (async () => {
    try {
      await Promise.race([document.fonts.load('600 40px Inter'), new Promise((r) => setTimeout(r, 1500))]);
      if (new URLSearchParams(location.search).has('flat')) throw new Error('flat view requested');
      const { Arena } = await import('./scene.js');
      if (!root.isConnected) return;
      arena = new Arena(box3d);
      arena.sound = (name, o) => audio.play(name, o);
      audio.setLevel?.(1);
      if (view) {
        lastBeat = view.beat.n;
        apply(view);
      }
    } catch (err) {
      console.warn('3D view unavailable, using the flat map:', err);
      flat = document.createElement('canvas');
      flat.className = 'll-flat';
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

  // the last seconds of a clock tick on the big screen
  let lastTick = null;
  const ticker = setInterval(() => {
    if (!view || !['start', 'upgrade', 'program'].includes(view.phase) || !view.deadline) return;
    const left = Math.ceil((view.deadline - api.now()) / 1000);
    if (left !== lastTick && left <= 10 && left > 0 && (view.phase !== 'program' || view.opts.timer)) audio.play('tick', { last: left <= 3 });
    lastTick = left;
  }, 200);

  /** Robots as the scene should show them; before the race, picked robots stand on their start spaces. */
  function sceneRobots(v) {
    const c = getCourse(v.opts.course);
    return v.robots
      .map((r) => {
        if (r.x != null) return r;
        if (v.phase !== 'start' || r.pick == null) return null;
        const st = c.starts.find((s) => s.n === r.pick);
        return st ? { ...r, x: st.x, y: st.y, d: st.d, on: true } : null;
      })
      .filter(Boolean);
  }

  /** The sun goes down as the race goes on. */
  const dayFor = (v) => (v.phase === 'over' ? 1 : v.phase === 'setup' || v.phase === 'start' ? 0.08 : 0.08 + 0.62 * (1 - Math.exp(-(Math.max(1, v.round) - 1) / 4)));

  function apply(v) {
    const robots = sceneRobots(v);
    if (arena) {
      arena.setDay(dayFor(v));
      arena.setCourse(v.opts.course);
      arena.setMode(v.phase);
      if (v.beat.n !== lastBeat) {
        lastBeat = v.beat.n;
        if (v.phase === 'activate' || v.phase === 'over') arena.playBeat(v.beat, robots);
      }
      if (v.phase !== 'activate') arena.actor = null;
      arena.syncRobots(robots);
      const picks = {};
      for (const r of v.robots) if (r.pick != null) picks[r.pick] = r.color;
      arena.showStarts(v.phase === 'start' ? picks : null);
      if (v.phase === 'over') arena.focusOn = v.winner;
      audio.setLamps(v.phase === 'over' ? 1 : 0);
    } else if (flat) drawFlat(v, robots);
  }

  function drawFlat(v, robots) {
    const c = getCourse(v.opts.course);
    const w = box3d.clientWidth;
    const h = box3d.clientHeight;
    const tile = Math.floor(Math.min((w - 40) / c.w, (h - 40) / c.h));
    const dpr = window.devicePixelRatio || 1;
    flat.width = w * dpr;
    flat.height = h * dpr;
    flat.style.width = `${w}px`;
    flat.style.height = `${h}px`;
    const g = flat.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1b1915';
    g.fillRect(0, 0, w, h);
    drawCourse(g, c, { tile, ox: (w - tile * c.w) / 2, oy: (h - tile * c.h) / 2, robots: robots.map((r) => ({ ...r, color: paint(r.color) })) });
  }

  /** Sounds that belong to the story rather than to one beat. */
  function cues(v) {
    if (v.phase !== lastPhase) {
      if (v.phase === 'program' && lastPhase) audio.play('cue');
      if (v.phase === 'over') audio.play('win');
      if (v.phase !== 'program' && v.phase !== 'upgrade' && v.phase !== 'start') readySeen = new Set();
      lastPhase = v.phase;
      if (['program', 'upgrade'].includes(v.phase)) readySeen = new Set(v.robots.filter((r) => r.ready).map((r) => r.id));
    }
    if (['program', 'upgrade'].includes(v.phase)) {
      for (const r of v.robots) {
        if (r.ready && !readySeen.has(r.id)) {
          readySeen.add(r.id);
          audio.play('lock');
        } else if (!r.ready) readySeen.delete(r.id);
      }
    }
    if (v.phase === 'start') {
      for (const r of v.robots) {
        if (r.pick != null && !readySeen.has(r.id)) {
          readySeen.add(r.id);
          audio.play('join');
        }
      }
    }
  }

  // ---------- the bars ----------

  const robotById = (v, id) => v.robots.find((r) => r.id === id);
  const card = (t, cls = '') => html`<span class="ll-card ${cardKind(t)} ${cls}">${raw(cardPicture(t))}</span>`;

  function render(v) {
    const c = getCourse(v.opts.course);
    host.dataset.phase = v.phase;
    const lvl = LEVEL[c.level] ?? 1;
    set('left', html`<span class="ll-title tc">${c.name}</span>`);

    const timed = ['start', 'upgrade', 'program'].includes(v.phase) && v.deadline && (v.phase !== 'program' || v.opts.timer);
    let mid = '';
    if (v.phase === 'activate') {
      mid = html`<div class="ll-regs">${[0, 1, 2, 3, 4].map((i) => html`<i class="${i === v.reg ? 'now' : i < v.reg ? 'past' : ''}"><b>${i + 1}</b></i>`)}</div>`;
    } else if (['start', 'upgrade', 'program'].includes(v.phase)) {
      const ready = v.robots.filter((r) => (v.phase === 'start' ? r.pick != null : r.ready)).length;
      mid = html`<div class="ll-clock">
        <span class="ll-ph">${raw(ICON.phone)}</span>
        ${timed ? html`<span class="ll-time" data-clock="${v.deadline}"></span>` : html`<span class="ll-count">${ready}<small>/${v.robots.filter((r) => !r.away).length}</small></span>`}
      </div>`;
    } else if (v.phase === 'setup') {
      mid = html`<span class="ll-level">${[1, 2, 3, 4].map((i) => html`<i class="${i <= lvl && 'on'}"></i>`)}</span>`;
    }
    set('mid', mid);
    set('right', ['start', 'upgrade', 'program'].includes(v.phase) ? html`<button class="ll-icon-btn ll-hurry" data-action="hurry" title="Hurry up" aria-label="Hurry up">${raw(ICON.hurry)}</button>` : '');
    set('overlay', renderOverlay(v));
    set('cast', renderCast(v));
    tickClocks();
  }

  function renderCast(v) {
    if (v.phase === 'setup') return renderSetupBar(v);
    const many = v.robots.length > 5;
    const act = v.phase === 'activate' ? v.beat.what?.id : null;
    return html`
      <div class="ll-cast ${many && 'many'} ${v.robots.length > 6 && 'crowd'}">
        ${v.robots.map((r) => {
          const regs = r.regs ?? [0, 0, 0, 0, 0];
          const now = v.phase === 'activate' ? regs[v.reg] : null;
          const shown = Array.isArray(now) && now.length ? now[now.length - 1] : null;
          const state = r.away ? 'away'
            : v.phase === 'start' ? (r.pick != null ? 'ready' : 'thinking')
            : ['program', 'upgrade'].includes(v.phase) ? (r.ready ? 'ready' : 'thinking')
            : '';
          const deciding = v.prompt?.id === r.id;
          return html`
            <div class="ll-plate cp ${state} ${act === r.id && 'acting'} ${deciding && 'deciding'} ${r.rb && 'rb'} ${r.sd && 'off'} ${v.winner === r.id && 'won'}" style="--c:${paint(r.color)}">
              ${r.id === v.prio && v.phase !== 'over' && html`<i class="cp-prio" title="first"></i>`}
              ${raw(portrait(r, { cls: r.away ? 'away' : '' }))}
              <div class="cp-info">
                <span class="nm">${r.name}</span>
                ${v.phase === 'over' ? statsLine(r, v) : html`<span class="cp-meta">
                  <span class="cp-flags">${Array.from({ length: v.cps }, (_, i) => html`<i class="${i < (r.cp ?? 0) && 'got'}"></i>`)}</span>
                  ${v.opts.upgrades && r.en != null && html`<span class="cp-en">${raw(ICON.bolt)}${r.en}</span>`}
                </span>`}
              </div>
              ${v.phase === 'activate' && html`<span class="cp-slot">${shown ? card(shown, 'flip') : regs[v.reg] ? html`<span class="ll-card back"></span>` : ''}</span>`}
              ${state === 'ready' && html`<i class="cp-ok">${raw(ICON.check)}</i>`}
              ${state === 'thinking' && html`<i class="cp-dots"><b></b><b></b><b></b></i>`}
              ${r.rb && v.phase !== 'over' && html`<i class="cp-st">${raw(ICON.reboot)}</i>`}
              ${r.sd && v.phase !== 'over' && html`<i class="cp-st">${raw(ICON.power)}</i>`}
              ${deciding && html`<i class="cp-ring" style="--t:${Math.max(1, (v.prompt.deadline - api.now()) / 1000)}s"></i>`}
            </div>`;
        })}
      </div>
      ${v.phase === 'over' && html`<button class="ll-go ll-home" data-action="finish" title="Back to the lobby" aria-label="Back to the lobby">${raw(ICON.home)}</button>`}`;
  }

  function statsLine(r, v) {
    const s = r.stats ?? {};
    return html`<span class="cp-meta stats">
      <span>${raw(ICON.flag)}${r.cp ?? 0}</span><span>${raw(ICON.push)}${s.pushes ?? 0}</span><span>${raw(ICON.hit)}${s.hits ?? 0}</span><span>${raw(ICON.fall)}${s.falls ?? 0}</span>
    </span>`;
  }

  /** Setup: the courses as little maps, the options as looping pictures, and go. */
  function renderSetupBar(v) {
    const o = v.opts;
    const tog = (key, demoKey) => html`
      <button class="ll-opt ${o[key] && 'on'}" data-host="${key}=${String(!o[key])}" title="${key}">
        <canvas class="ll-demo" data-demo="${demoKey}"></canvas><i></i>
      </button>`;
    return html`
      <div class="ll-setup">
        <div class="ll-courses">
          ${COURSES.filter((x) => x.id !== 'lab').map((x) => html`
            <button class="ll-course ${x.id === o.course && 'on'}" data-host="course=${x.id}" title="${x.name}">
              <img alt="" src="${thumb(x.id)}">
            </button>`)}
        </div>
        <div class="ll-opts">
          ${tog('upgrades', 'upgrades')}
          ${tog('lessDeadly', 'safe-edges')}
          ${tog('lessSpam', 'less-spam')}
          <div class="ll-seg">${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-host="timer=${t}">${t ? `${t / 60}′` : '∞'}</button>`)}</div>
        </div>
      </div>
      <button class="ll-go" data-action="begin" title="Start" aria-label="Start">${raw(ICON.play)}</button>`;
  }

  function renderOverlay(v) {
    if (v.phase === 'over') {
      const w = robotById(v, v.winner);
      return w ? html`
        <div class="ll-credit" style="--c:${paint(w.color)}">
          <div class="ll-credit-name">${w.name}</div>
          <div class="ll-credit-flags">${Array.from({ length: v.cps }, () => html`<i></i>`)}</div>
        </div>` : '';
    }
    if (v.phase === 'activate' && v.prompt) {
      const r = robotById(v, v.prompt.id);
      return r ? html`<div class="ll-deciding" style="--c:${paint(r.color)}">${raw(portrait(r))}<span class="ll-q">${v.prompt.icon ? upgradeIcon(v.prompt.icon) : v.prompt.kind === 'weapon' ? '🎯' : '?'}</span><span class="ll-time" data-clock="${v.prompt.deadline}"></span></div>` : '';
    }
    if (v.phase === 'upgrade') {
      // what everyone has installed, small, in the corner of the frame
      const any = v.robots.some((r) => r.perm?.length || r.temp);
      return any ? html`<div class="ll-kit">${v.robots.filter((r) => r.perm?.length || r.temp).map((r) => html`<span style="--c:${paint(r.color)}"><i></i>${(r.perm ?? []).map((k) => html`<b title="${UPGRADES[k].name}">${upgradeIcon(k)}</b>`)}${r.temp > 0 && html`<b class="t">${r.temp}</b>`}</span>`)}</div>` : '';
    }
    return '';
  }

  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(6, Math.floor(180 / Math.max(c.w, c.h * 1.4)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile });
    const url = cv.toDataURL();
    thumbs.set(id, url);
    return url;
  }

  // clocks (mm:ss) count down by themselves
  function tickClocks() {
    for (const el of root.querySelectorAll('[data-clock]')) {
      const left = Math.max(0, Math.ceil((Number(el.dataset.clock) - api.now()) / 1000));
      const text = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : String(left);
      if (el.textContent !== text) el.textContent = text;
      el.classList.toggle('low', left <= 10);
    }
  }
  const clockTimer = setInterval(tickClocks, 250);

  return {
    update(next) {
      if (!next?.opts) return;
      view = next;
      cues(next);
      apply(next);
      render(next);
    },
    destroy() {
      clearInterval(ticker);
      clearInterval(clockTimer);
      arena?.destroy();
    },
  };
}
