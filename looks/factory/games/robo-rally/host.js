// The big screen: the 3D store with the race in it (scene.js), and around it what everyone needs to
// see from across the room: whose robot is whose, energy, checkpoints, the cards being revealed.
// Pictures and motion instead of words: a robot and its card, not "Dex plays Move 2".
import { html, raw } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';
import { COURSES, getCourse } from './board.js';
import { UPGRADES } from './cards.js';
import { drawCourse } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon } from './icons.js';
import { mountDemo } from './demo.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const TIMERS = [0, 60, 120, 180];
const PHASE_ICON = { setup: '⚙️', start: '📍', upgrade: '🛒', program: '🂠', activate: '▶', over: '🏆' };
// what the factory does after the robots move, in order: it lights up step by step during each register
const FACTORY = [
  { k: 'belt', fast: true, icon: '⏩', title: 'blue belts' },
  { k: 'belt', fast: false, icon: '▶', title: 'green belts' },
  { k: 'push', icon: '💥', title: 'push panels' },
  { k: 'gear', icon: '⚙️', title: 'gears' },
  { k: 'blaser', icon: '🔴', title: 'board lasers' },
  { k: 'rlaser', icon: '🎯', title: 'robot lasers' },
  { k: 'battery', icon: '⚡', title: 'batteries' },
  { k: 'cp', icon: '🏁', title: 'flags' },
];

export default function (root, api) {
  root.innerHTML = `
    <div class="rr-host">
      <div class="rr-stage">
        <div class="rr-3d"></div>
        <div class="rr-hud-title"></div>
        <div class="rr-hud-caption"></div>
        <div class="rr-hud-center"></div>
        <div class="rr-hud-prompt"></div>
      </div>
      <aside class="rr-side"></aside>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const box3d = $('.rr-3d');
  const parts = {
    title: $('.rr-hud-title'),
    caption: $('.rr-hud-caption'),
    center: $('.rr-hud-center'),
    prompt: $('.rr-hud-prompt'),
    side: $('.rr-side'),
  };
  const shown = {};
  const set = (key, content) => {
    const text = String(content ?? '');
    if (shown[key] === text) return;
    shown[key] = text;
    parts[key].innerHTML = text;
    for (const c of parts[key].querySelectorAll('canvas[data-demo]')) mountDemo(c, c.dataset.demo, '#ff4d6d');
  };

  let view = null;
  let arena = null;
  let flat = null; // the 2D fallback
  let lastBeat = -1;
  const thumbs = new Map();

  // Load the 3D scene (it's big), once the fonts its textures use are ready.
  (async () => {
    try {
      await Promise.race([document.fonts.load('64px Teko'), new Promise((r) => setTimeout(r, 1500))]);
      const { Arena } = await import('./scene.js');
      if (!root.isConnected) return;
      arena = new Arena(box3d);
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

  function apply(v) {
    const robots = sceneRobots(v);
    if (arena) {
      arena.setCourse(v.opts.course);
      arena.camMode = v.phase === 'setup' ? 'orbit' : 'race';
      if (v.beat.n !== lastBeat) {
        lastBeat = v.beat.n;
        if (v.phase === 'activate' || v.phase === 'over') {
          arena.playBeat(v.beat, robots);
          bubbles(v);
        }
      }
      arena.syncRobots(robots);
      const picks = {};
      for (const r of v.robots) if (r.pick != null) picks[r.pick] = r.color;
      arena.showStarts(v.phase === 'start' ? picks : null);
      arena.focusOn = v.phase === 'over' ? v.winner : null;
    } else if (flat) drawFlat(v, robots);
  }

  /**
   * The big moments, over the robot itself so the whole room sees it: a robot reaching a flag gets a
   * gold bubble with the flag's number, and a robot falling into a pit (or off the edge) gets a hole.
   */
  function bubbles(v) {
    const stage = root.querySelector('.rr-stage');
    for (const f of v.beat.fx) {
      if (f.k !== 'cp' && f.k !== 'fall') continue;
      const r = robotById(v, f.id);
      if (!r) continue;
      const move = v.beat.fx.find((m) => m.k === 'move' && m.id === f.id);
      const delay = f.k === 'fall' && move ? (move.path.length - 1) * 330 + 250 : 0;
      setTimeout(() => {
        const at = arena?.toScreen(f.k === 'cp' ? f.id : null, { x: f.x, y: f.y });
        if (!at || !stage.isConnected) return;
        const el = document.createElement('div');
        el.className = `rr-bubble ${f.k}`;
        el.style.left = `${Math.min(Math.max(at.x, 90), stage.clientWidth - 90)}px`;
        el.style.top = `${Math.min(Math.max(at.y, 110), stage.clientHeight - 20)}px`;
        el.style.setProperty('--c', r.color);
        el.innerHTML = String(html`${avatar(r, { mood: f.k === 'cp' ? 'happy' : undefined })}<b>${f.k === 'cp' ? `🏁${f.n}` : '🕳️'}</b>`);
        stage.append(el);
        setTimeout(() => el.remove(), 2000);
      }, delay);
    }
  }

  function drawFlat(v, robots) {
    const c = getCourse(v.opts.course);
    const w = box3d.clientWidth;
    const h = box3d.clientHeight;
    const tile = Math.floor(Math.min((w - 40) / c.w, (h - 120) / c.h));
    const dpr = window.devicePixelRatio || 1;
    flat.width = w * dpr;
    flat.height = h * dpr;
    flat.style.width = `${w}px`;
    flat.style.height = `${h}px`;
    const g = flat.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0c0d10';
    g.fillRect(0, 0, w, h);
    drawCourse(g, c, { tile, ox: (w - tile * c.w) / 2, oy: (h - tile * c.h) / 2 + 30, robots });
  }

  // ---------- the HUD ----------

  const robotById = (v, id) => v.robots.find((r) => r.id === id);
  const bot = (r, mood) => (r ? html`<span class="rr-av" style="--c:${r.color}">${avatar(r, mood ? { mood } : undefined)}</span>` : '');
  const card = (t) => html`<span class="rr-card ${cardKind(t)}">${raw(cardPicture(t))}</span>`;

  function render(v) {
    const c = getCourse(v.opts.course);
    const timed = ['start', 'upgrade', 'program'].includes(v.phase) && v.deadline;
    set('title', html`
      <div class="rr-course-name">${c.name}</div>
      <div class="rr-sub">
        <span class="rr-pill">${PHASE_ICON[v.phase]}</span>
        ${timed && html`<span class="timer" data-deadline="${v.deadline}"></span>`}
        ${['upgrade', 'program', 'start'].includes(v.phase) && html`<button class="btn btn-sm secondary" data-action="hurry" title="Hurry up" aria-label="Hurry up">⏩</button>`}
      </div>`);
    set('caption', v.phase === 'activate' ? lineup(v) : '');

    const p = v.prompt;
    set('prompt', p ? html`<div class="rr-prompt-bar">${bot(robotById(v, p.id))}<span class="rr-big">${p.icon ? upgradeIcon(p.icon) : p.kind === 'weapon' ? '🎯' : '⚡?'}</span><span class="rr-wait-dots"><i>.</i><i>.</i><i>.</i></span><span class="timer" data-deadline="${p.deadline}"></span></div>` : '');
    set('center', renderCenter(v));
    set('side', renderSide(v));
    root.querySelector('.rr-host').dataset.phase = v.phase;
  }

  /** Who reached a flag or fell in the step being played: { flags: Map(id -> n), falls: Set(id) }. */
  function moments(v) {
    const fx = v.phase === 'activate' || v.phase === 'over' ? v.beat.fx ?? [] : [];
    return { flags: new Map(fx.filter((f) => f.k === 'cp').map((f) => [f.id, f.n])), falls: new Set(fx.filter((f) => f.k === 'fall').map((f) => f.id)) };
  }

  /**
   * The Activation Phase at the top of the screen, so the room can follow it: the register (1-5); every
   * robot's card for it, in the order they play (the cards flip over together when the register is
   * revealed, and the robot moving now stands out); then the factory, lighting up step by step.
   */
  function lineup(v) {
    const what = v.beat.what ?? {};
    const reveal = what.k === 'reveal';
    const at = v.robots.findIndex((r) => r.id === v.prio);
    const order = at > 0 ? [...v.robots.slice(at), ...v.robots.slice(0, at)] : v.robots;
    const actor = what.id ? order.findIndex((r) => r.id === what.id) : -1;
    const step = FACTORY.findIndex((f) => f.k === what.k && (f.fast == null || f.fast === !!what.fast));
    const { flags, falls } = moments(v);
    return html`
      <div class="rr-cap-row">
        <div class="rr-track">${[0, 1, 2, 3, 4].map((i) => html`<span class="${i === v.reg && 'now'} ${i < v.reg && 'done'}">${i + 1}</span>`)}</div>
        <div class="rr-factory">${FACTORY.map((f, i) => html`<span class="${i === step && 'now'} ${i < step && 'done'} ${f.k}" title="${f.title}">${f.icon}</span>`)}</div>
      </div>
      <div class="rr-lineup ${reveal && 'reveal'}">
        ${order.map((r, i) => {
          const reg = r.regs?.[v.reg];
          const cards = i === actor && what.k === 'card' ? what.cards : Array.isArray(reg) ? reg : [];
          const out = r.x == null || r.on === false || r.sd;
          const state = actor >= 0 ? (i < actor ? 'done' : i === actor ? 'now' : '') : step >= 0 ? 'done' : '';
          return html`
            <div class="rr-line ${state} ${out && 'out'} ${falls.has(r.id) && 'fell'} ${flags.has(r.id) && 'flag'}" style="--c:${r.color};--i:${i}">
              <span class="rr-line-card">${cards.length
                ? card(cards[cards.length - 1])
                : html`<span class="rr-card back">${r.sd ? '⏻' : r.rb ? '↻' : r.on === false ? '🕳️' : ''}</span>`}</span>
              <span class="rr-line-bot">${avatar(r, { mood: flags.has(r.id) ? 'happy' : undefined })}</span>
              ${i === actor && what.k === 'upgrade' && html`<b class="rr-line-pop up">${upgradeIcon(what.key)}</b>`}
              ${i === actor && what.k === 'reboot' && html`<b class="rr-line-pop">↻</b>`}
            </div>`;
        })}
      </div>`;
  }

  /** Everyone's robot, lit up once they're ready. */
  const readyRow = (v) => html`<div class="rr-ready">${v.robots.map((r) => html`<span class="${r.ready ? 'yes' : 'no'} ${r.away && 'away'}" style="--c:${r.color}">${avatar(r, { mood: r.ready ? 'happy' : undefined })}${r.ready ? html`<i>✔</i>` : html`<b class="rr-wait-dots"><i>.</i><i>.</i><i>.</i></b>`}</span>`)}</div>`;

  function renderCenter(v) {
    switch (v.phase) {
      case 'setup': {
        const o = v.opts;
        const tog = (key, icon, demoKey) => html`
          <button class="rr-opt ${o[key] && 'on'}" data-host="${key}=${String(!o[key])}">
            <canvas class="rr-demo small" data-demo="${demoKey}"></canvas><span class="rr-opt-ic">${icon}</span><i>${o[key] ? '✔' : '✖'}</i>
          </button>`;
        return html`
          <div class="rr-setup">
            <div class="rr-setup-courses">
              ${COURSES.filter((x) => x.id !== 'lab').map((x) => html`
                <button class="rr-setup-course ${x.id === o.course && 'on'}" data-host="course=${x.id}">
                  <img alt="" src="${thumb(x.id)}">
                  <span><b>${x.name}</b><small>${'★'.repeat(LEVEL[x.level] ?? 1)}${'☆'.repeat(4 - (LEVEL[x.level] ?? 1))} · 🏁${x.checkpoints.length}</small></span>
                </button>`)}
            </div>
            <div class="rr-opts">
              ${tog('upgrades', '⚡🛒', 'upgrades')}
              ${tog('lessDeadly', '🧱', 'safe-edges')}
              ${tog('lessSpam', '⚠️↘', 'less-spam')}
              <div class="rr-seg"><span class="rr-seg-ic">⏱</span>${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-host="timer=${t}">${t ? `${t / 60}′` : '∞'}</button>`)}</div>
            </div>
            <button class="btn btn-xl rr-go" data-action="begin" aria-label="Start">▶</button>
          </div>`;
      }
      case 'start':
        return html`<div class="rr-picto"><span class="rr-phone-ic">📱<i>👆</i></span><span class="rr-big">→ 📍</span></div>`;
      case 'upgrade':
        return html`<div class="rr-picto"><span class="rr-big rr-flow">⚡ → 🛒</span>${readyRow(v)}</div>`;
      case 'program':
        return html`<div class="rr-picto">${v.robots.length <= 5 && html`<span class="rr-slots">${[0, 1, 2, 3, 4].map((i) => html`<i style="--i:${i}"></i>`)}</span>`}${readyRow(v)}</div>`;
      case 'over': {
        const w = robotById(v, v.winner);
        const ranked = [...v.robots].sort((a, b) => (b.cp ?? 0) - (a.cp ?? 0));
        return html`
          <div class="rr-over ${v.robots.length > 5 && 'many'}">
            <div class="rr-over-head">
              <span class="rr-trophy">🏆</span>
              ${w && html`<div class="rr-over-bot" style="--c:${w.color}">${avatar(w, { mood: 'happy' })}<b>${w.name}</b></div>`}
            </div>
            <table class="rr-stats">
              <tr><th></th><th title="flags">🏁</th><th title="pushes">💥</th><th title="laser hits">🎯</th><th title="falls">🕳️</th><th title="damage">⚠️</th></tr>
              ${ranked.map((r) => html`<tr style="--c:${r.color}"><td class="pc">${bot(r)} <span>${r.name}</span></td><td>${r.cp ?? 0}/${v.cps}</td><td>${r.stats?.pushes ?? 0}</td><td>${r.stats?.hits ?? 0}</td><td>${r.stats?.falls ?? 0}</td><td>${r.stats?.damage ?? 0}</td></tr>`)}
            </table>
            <button class="btn btn-xl" data-action="finish" aria-label="Back to the lobby">🏠</button>
          </div>`;
      }
    }
    return '';
  }

  /** One row per robot: who, which flags, energy, the cards so far (and the one playing now, big). */
  function renderSide(v) {
    const n = v.robots.length;
    const { flags, falls } = moments(v);
    return html`
      <div class="rr-pcs ${n > 5 && 'many'} ${n <= 3 && 'few'} ${v.phase === 'activate' && v.beat.what?.k === 'reveal' && 'reveal'}">
        ${v.robots.map((r) => {
          const status = r.away ? '💤'
            : r.x == null ? (v.phase === 'start' ? (r.pick != null ? `📍${r.pick}` : '…') : '')
            : r.sd ? '⏻'
            : r.rb ? '↻'
            : v.phase === 'program' ? (r.ready ? (r.wantSd ? '⏻' : '🔒') : '…')
            : v.phase === 'upgrade' ? (r.ready ? '✔' : '🛒')
            : '';
          const regs = r.regs ?? [0, 0, 0, 0, 0];
          const now = v.phase === 'activate' ? regs[v.reg] : null;
          return html`
            <div class="rr-pc ${r.id === v.prio && 'prio'} ${r.away && 'away'} ${v.prompt?.id === r.id && 'deciding'} ${v.beat.what?.id === r.id && v.phase === 'activate' && 'acting'} ${falls.has(r.id) && 'fell'} ${flags.has(r.id) && 'flag'}" style="--c:${r.color}">
              <div class="rr-pc-bot">${avatar(r, { mood: r.id === v.winner ? 'happy' : undefined })}</div>
              <div class="rr-pc-main">
                <div class="rr-pc-name"><b>${r.name}</b>${r.id === v.prio && html`<span class="rr-prio" title="priority">🥇</span>`}${status && html`<span class="rr-status ${status === '…' && 'thinking'} ${status === '↻' && 'rr-spin'}">${status}</span>`}</div>
                <div class="rr-pc-stats">
                  <span class="rr-flags">${Array.from({ length: v.cps }, (_, i) => html`<i class="${i < (r.cp ?? 0) && 'got'} ${flags.get(r.id) === i + 1 && 'new'}">${i + 1}</i>`)}</span>
                  ${v.opts.upgrades && r.en != null && html`<span class="rr-en">⚡${r.en}</span>`}
                </div>
                ${r.x != null && html`<div class="rr-pc-regs">${regs.map((x, i) => html`<span class="${v.phase === 'activate' && i === v.reg && 'now'} ${Array.isArray(x) ? 'up' : x ? 'down' : ''} ${r.hw?.[i] && 'hw'}">${Array.isArray(x) && x.length ? raw(cardPicture(x[x.length - 1])) : ''}</span>`)}</div>`}
                ${(r.perm?.length > 0 || r.temp > 0) && html`<div class="rr-pc-ups">${(r.perm ?? []).map((k) => html`<span title="${UPGRADES[k].name}">${upgradeIcon(k)}</span>`)}${r.temp > 0 && html`<span class="temp">${'🂠'.repeat(r.temp)}</span>`}</div>`}
              </div>
              ${Array.isArray(now) && now.length > 0 && html`<div class="rr-pc-card">${card(now[now.length - 1])}</div>`}
            </div>`;
        })}
      </div>`;
  }

  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(6, Math.floor(220 / Math.max(c.w, c.h * 1.6)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile });
    const url = cv.toDataURL();
    thumbs.set(id, url);
    return url;
  }

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      view = next;
      apply(next);
      render(next);
    },
    destroy() {
      arena?.destroy();
    },
  };
}
