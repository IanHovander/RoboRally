// The big screen during a race: Lumen's glass board (scene.js) fills the screen, and a quiet layer of
// light on top says only what the room needs: whose robot is whose, who is ready, the card each robot
// is playing, the flags each has, and the time left. Sounds (sound.js) make heads turn at the big moments.
import { html, raw } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { drawCourse } from './minimap.js';
import { robotSvg, svgGlyph, cardSvgHtml, COURSE_TITLES, LEVELS, courseTitle } from './glyphs.js';
import { sfx, unlock, onState as onSound, setMuted, setLevel, sceneSound, state as soundState } from './sound.js';

const TIMERS = [0, 60, 120, 180];
const PHASE_MS = { start: 40_000, upgrade: 60_000 };

export default function (root, api) {
  root.innerHTML = `
    <div class="lm-host">
      <div class="lm-3d"></div>
      <div class="lm-veil"></div>
      <div class="lm-timer"><i></i><b></b></div>
      <div class="lm-regs"></div>
      <div class="lm-title"></div>
      <div class="lm-center"></div>
      <div class="lm-roster"></div>
      <div class="lm-corner">
        <button class="lm-icon-btn lm-hurry" data-hurry title="Hurry up" hidden>${svgGlyph('play')}${svgGlyph('play')}</button>
        <button class="lm-icon-btn lm-sound" data-sound title="Sound"></button>
      </div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const host = $('.lm-host');
  const box3d = $('.lm-3d');
  const timerEl = $('.lm-timer');
  const regsEl = $('.lm-regs');
  const titleEl = $('.lm-title');
  const centerEl = $('.lm-center');
  const rosterEl = $('.lm-roster');
  const soundBtn = $('[data-sound]');
  const hurryBtn = $('[data-hurry]');

  let view = null;
  let arena = null;
  let flat = null;
  let lastBeat = -1;
  let lastReg = -2;
  let prev = null; // the view before this one (to notice changes worth a sound)
  const thumbs = new Map();
  const shown = new Map();
  const set = (el, content) => {
    const text = String(content ?? '');
    if (shown.get(el) === text) return false;
    shown.set(el, text);
    el.innerHTML = text;
    return true;
  };

  // ----- sound -----
  setLevel(1);
  const offSound = onSound((st) => {
    soundBtn.innerHTML = svgGlyph(st === 'on' ? 'sound' : 'mute');
    soundBtn.classList.toggle('off', st !== 'on');
    soundBtn.title = st === 'locked' ? 'Click for sound' : st === 'muted' ? 'Sound off' : 'Sound on';
  });
  const gesture = () => unlock();
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
  soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // this button decides for itself
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const st = soundState();
    if (st === 'locked') unlock();
    else setMuted(st === 'on');
  });
  hurryBtn.addEventListener('click', () => api.send('hurry'));
  const seatOf = (id) => view?.robots.find((r) => r.id === id)?.seat ?? 0;
  const onArena = (kind, d) => {
    // a mishap on the board: that player's token at the bottom flinches too, so the room sees whose it was
    if (kind === 'mishap' || kind === 'fall') flinch(d.id, kind === 'fall' || d.n > 1);
    sceneSound(kind, d, seatOf);
  };
  function flinch(id, big) {
    const el = rosterEl.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
    if (!el) return;
    el.classList.remove('flinch', 'flinch-big');
    void el.offsetWidth; // restart the animation
    el.classList.add(big ? 'flinch-big' : 'flinch');
  }

  // ----- the 3D scene (it's big: load it once the font its labels use is ready) -----
  (async () => {
    try {
      await Promise.race([Promise.all([document.fonts.load('200 64px Lumen'), document.fonts.load('500 64px Lumen')]), new Promise((r) => setTimeout(r, 1500))]);
      const { Arena } = await import('./scene.js');
      if (!root.isConnected) return;
      arena = new Arena(box3d);
      arena.on(onArena);
      if (view) {
        lastBeat = view.beat.n;
        apply(view, true);
      }
    } catch (err) {
      console.warn('3D view unavailable, using the flat map:', err);
      flat = document.createElement('canvas');
      flat.className = 'lm-flat';
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

  const frameFor = (phase) =>
    phase === 'setup' ? { top: 0.12, bottom: 0.8, left: 0.1, right: 0.1 }
      : phase === 'over' ? { top: 0.1, bottom: 0.3, left: 0.05, right: 0.05 }
        : phase === 'start' ? { top: 0.34, bottom: 0.4, left: 0.04, right: 0.04 }
        : { top: 0.13, bottom: 0.4, left: 0.04, right: 0.04 };

  function apply(v, first = false) {
    const robots = sceneRobots(v);
    if (arena) {
      arena.setCourse(v.opts.course);
      arena.setFrame(frameFor(v.phase));
      arena.camMode = v.phase === 'setup' ? 'orbit' : ['start', 'upgrade', 'program'].includes(v.phase) ? 'drift' : 'race';
      if (!first && prev && prev.phase !== v.phase && (v.phase === 'program' || v.phase === 'activate')) arena.pulse();
      if (v.phase === 'activate' && v.reg !== lastReg) {
        lastReg = v.reg;
        arena.clearCards();
      }
      if (v.phase !== 'activate' && v.phase !== 'over' && lastReg !== -2) {
        lastReg = -2;
        arena.clearCards();
      }
      if (v.beat.n !== lastBeat) {
        lastBeat = v.beat.n;
        if (!first && (v.phase === 'activate' || v.phase === 'over')) {
          // the cards turn over above the robots, so everyone sees what's coming (alone, it would only repeat)
          if (v.beat.what?.k === 'reveal' && v.robots.length > 1) {
            arena.showCards(v.robots.filter((r) => Array.isArray(r.regs?.[v.reg]) && r.regs[v.reg].length).map((r) => ({ id: r.id, types: r.regs[v.reg] })));
          }
          arena.playBeat(v.beat, robots);
        }
      }
      arena.syncRobots(robots);
      const picks = {};
      for (const r of v.robots) if (r.pick != null) picks[r.pick] = r.color;
      arena.showStarts(v.phase === 'start' ? picks : null);
      arena.setReady(['program', 'upgrade'].includes(v.phase) ? new Set(v.robots.filter((r) => r.ready).map((r) => r.id)) : null);
      arena.setDeciding(v.prompt?.id ?? null);
      arena.setTaken(v.robots);
      arena.showNames = v.phase !== 'setup';
      if (v.phase === 'over') {
        arena.focusOn = v.winner;
        arena.setDim(0.72);
      } else {
        arena.focusOn = null;
        arena.setDim(v.phase === 'setup' ? 0.15 : 0);
      }
    } else if (flat) drawFlat(v, robots);
  }

  function drawFlat(v, robots) {
    const c = getCourse(v.opts.course);
    const w = box3d.clientWidth;
    const h = box3d.clientHeight;
    const tile = Math.floor(Math.min((w - 80) / c.w, (h * 0.62) / c.h));
    const dpr = window.devicePixelRatio || 1;
    flat.width = w * dpr;
    flat.height = h * dpr;
    flat.style.width = `${w}px`;
    flat.style.height = `${h}px`;
    const g = flat.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#06080b';
    g.fillRect(0, 0, w, h);
    drawCourse(g, c, { tile, ox: (w - tile * c.w) / 2, oy: h * 0.16, robots });
  }

  // ----- sounds for things that aren't beats -----
  function noticeChanges(v, p) {
    if (!p) return;
    if (v.phase !== p.phase) {
      if (v.phase === 'program') sfx.round();
      if (v.phase === 'activate') sfx.go();
    }
    for (const r of v.robots) {
      const before = p.robots.find((x) => x.id === r.id);
      if (!before) continue;
      if (v.phase === p.phase && ['program', 'upgrade'].includes(v.phase) && r.ready && !before.ready) sfx.ready(r.seat);
      if (v.phase === 'start' && r.pick != null && before.pick == null) sfx.join(r.seat);
    }
    if (v.prompt && v.prompt.deadline !== p.prompt?.deadline) sfx.ask();
  }

  // ----- the layer of light on top -----

  const robotById = (v, id) => v.robots.find((r) => r.id === id);
  const G = (name) => raw(svgGlyph(name));
  const flagBars = (v, r) => html`<span class="lm-flags">${Array.from({ length: v.cps }, (_, i) => html`<i class="${i < (r.cp ?? 0) && 'on'}"></i>`)}</span>`;

  /** What a robot's token shows above its name, by phase. */
  function tokenTop(v, r) {
    if (r.away) return html`<span class="lm-zz">${G('dots')}</span>`;
    switch (v.phase) {
      case 'start':
        return r.pick != null ? html`<span class="lm-pad">${r.pick}</span>` : html`<span class="lm-think"><i></i><i></i><i></i></span>`;
      case 'upgrade':
        return r.ready ? html`<span class="lm-ok">${G('check')}</span>` : html`<span class="lm-shop">${G('shop')}</span>`;
      case 'program': {
        if (r.ready && r.wantSd) return html`<span class="lm-ok">${G('power')}</span>`;
        const regs = r.regs ?? [0, 0, 0, 0, 0];
        return html`<span class="lm-slots ${r.ready && 'ready'}">${regs.map((x, i) => html`<i class="${(x || r.hw?.[i]) && 'on'}"></i>`)}</span>`;
      }
      case 'activate': {
        if (r.sd) return html`<span class="lm-state">${G('power')}</span>`;
        if (r.rb || r.on === false) return html`<span class="lm-state">${G('reboot')}</span>`;
        const now = r.regs?.[v.reg];
        if (Array.isArray(now) && now.length) return html`${now.map((t) => raw(cardSvgHtml(t, 'xs')))}`;
        return html`<span class="lm-card-back"></span>`;
      }
      case 'over':
        return '';
    }
    return '';
  }

  function renderRoster(v) {
    const ids = v.robots.map((r) => r.id).join();
    if (rosterEl.dataset.ids !== ids) {
      rosterEl.dataset.ids = ids;
      rosterEl.innerHTML = v.robots.map((r) => `<div class="lm-tok" data-id="${r.id}"><div class="lm-tok-top"></div><div class="lm-tok-bot"></div><div class="lm-tok-name"></div><div class="lm-tok-meta"></div></div>`).join('');
      rosterEl.style.setProperty('--n', v.robots.length);
    }
    const acting = v.phase === 'activate' ? v.beat.what?.id : null;
    for (const r of v.robots) {
      const el = rosterEl.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      if (!el) continue;
      el.style.setProperty('--c', r.color);
      el.classList.toggle('away', !!r.away);
      el.classList.toggle('ready', !!r.ready && ['program', 'upgrade'].includes(v.phase));
      el.classList.toggle('deciding', v.prompt?.id === r.id);
      el.classList.toggle('acting', acting === r.id);
      el.classList.toggle('prio', r.id === v.prio && !['setup', 'start', 'over'].includes(v.phase));
      el.classList.toggle('winner', v.phase === 'over' && r.id === v.winner);
      set(el.children[0], tokenTop(v, r));
      set(el.children[1], robotSvg(r, { dim: r.away }));
      set(el.children[2], html`${r.name}`);
      const ups = (r.perm?.length ?? 0) + (r.temp ?? 0);
      set(el.children[3], html`${flagBars(v, r)}${v.opts.upgrades && r.en != null && html`<span class="lm-en">${G('bolt')}${r.en}</span>`}${ups > 0 && html`<span class="lm-ups">${(r.perm ?? []).map(() => html`<i></i>`)}${Array.from({ length: r.temp ?? 0 }, () => html`<i class="t"></i>`)}</span>`}`);
    }
  }

  function renderRegs(v) {
    if (v.phase !== 'activate') return set(regsEl, '');
    set(regsEl, html`${[0, 1, 2, 3, 4].map((i) => html`<i class="${i === v.reg && 'now'} ${i < v.reg && 'done'}">${i + 1}</i>`)}`);
  }

  function renderTitle(v) {
    if (v.phase === 'setup' || v.phase === 'over') return set(titleEl, '');
    // the course's name, briefly, when the race begins; then nothing
    set(titleEl, v.phase === 'start' ? html`<h1>${courseTitle(v.opts.course)}</h1>` : '');
  }

  function renderCenter(v) {
    switch (v.phase) {
      case 'setup': {
        const o = v.opts;
        const sel = COURSES.find((x) => x.id === o.course) ?? COURSES[0];
        const lvl = LEVELS[sel.level] ?? 1;
        const toggle = (key, glyph) => html`<button class="lm-opt ${o[key] && 'on'}" data-host="${key}=${String(!o[key])}" title="${key}">${raw(svgGlyph(glyph))}</button>`;
        return set(centerEl, html`
          <div class="lm-setup">
            <h1 class="lm-course-name">${courseTitle(sel.id)}</h1>
            <div class="lm-course-meta"><span class="lm-dots">${[1, 2, 3, 4].map((i) => html`<i class="${i <= lvl && 'on'}"></i>`)}</span><span class="lm-flagcount">${raw(svgGlyph('flag'))}${sel.checkpoints.length}</span></div>
            <div class="lm-courses">
              ${COURSES.map((x) => html`
                <button class="lm-course ${x.id === o.course && 'on'}" data-host="course=${x.id}">
                  <img alt="" src="${thumb(x.id)}">
                  <span>${COURSE_TITLES[x.id] ?? x.name}</span>
                </button>`)}
            </div>
            <div class="lm-opts">
              ${toggle('upgrades', 'bolt')}
              ${toggle('lessDeadly', 'wall')}
              ${toggle('lessSpam', 'sp')}
              <span class="lm-seg">${raw(svgGlyph('timer'))}${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-host="timer=${t}">${t ? t / 60 : raw(svgGlyph('inf'))}</button>`)}</span>
              <button class="lm-go" data-action="begin" title="Start">${raw(svgGlyph('play'))}</button>
            </div>
          </div>`);
      }
      case 'over': {
        const w = robotById(v, v.winner);
        return set(centerEl, w ? html`
          <div class="lm-over" style="--c:${w.color}">
            <div class="lm-over-name">${w.name}</div>
            <div class="lm-over-flags">${Array.from({ length: v.cps }, () => html`<i></i>`)}</div>
            <button class="lm-home" data-action="finish" title="Back to the lobby">${raw(svgGlyph('home'))}</button>
          </div>` : html`<div class="lm-over"><button class="lm-home" data-action="finish">${raw(svgGlyph('home'))}</button></div>`);
      }
      case 'program':
        // round one: a reminder of what the phones are for (cards dropping into five slots)
        return set(centerEl, v.round === 1 ? html`<div class="lm-hint"><span class="lm-hint-slots"><i></i><i></i><i></i><i></i><i></i></span><span class="lm-hint-card">${raw(cardSvgHtml('m1', 'xs'))}</span></div>` : '');
    }
    return set(centerEl, '');
  }

  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(6, Math.floor(260 / Math.max(c.w, c.h * 1.5)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile, glow: true });
    const url = cv.toDataURL();
    thumbs.set(id, url);
    return url;
  }

  // ----- the timer: a thin line of light across the top that shrinks to nothing -----
  let timerTotal = 0;
  let timerDeadline = 0;
  let lastTick = -1;
  let raf = 0;
  function timerLoop() {
    raf = requestAnimationFrame(timerLoop);
    const v = view;
    const timed = v && ['start', 'upgrade', 'program'].includes(v.phase) && v.deadline;
    const left = timed ? v.deadline - api.now() : 0;
    const relaxed = v?.phase === 'program' && !v.opts.timer;
    const visible = timed && (!relaxed || left < 30_000) && left > 0;
    timerEl.classList.toggle('on', !!visible);
    if (!visible) return;
    if (v.deadline !== timerDeadline) {
      timerDeadline = v.deadline;
      timerTotal = Math.max(left, 1000);
      const planned = v.phase === 'program' ? (v.opts.timer || 0) * 1000 : PHASE_MS[v.phase];
      if (planned && Math.abs(planned - left) < 3000) timerTotal = planned;
    }
    const frac = Math.max(0, Math.min(1, left / timerTotal));
    timerEl.firstElementChild.style.transform = `scaleX(${frac})`;
    const secs = Math.ceil(left / 1000);
    timerEl.lastElementChild.textContent = secs;
    timerEl.classList.toggle('low', secs <= 10);
    if (secs <= 5 && secs !== lastTick && secs > 0) {
      lastTick = secs;
      sfx.tick(secs <= 2);
    }
  }
  timerLoop();

  function render(v) {
    host.dataset.phase = v.phase;
    host.classList.toggle('upgrades', !!v.opts.upgrades);
    renderRoster(v);
    renderRegs(v);
    renderTitle(v);
    renderCenter(v);
    hurryBtn.hidden = !['start', 'upgrade', 'program'].includes(v.phase);
  }

  // for test scripts: what the big screen sees
  window.lumenHost = { view: () => view, arena: () => arena };

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      prev = view;
      view = next;
      apply(next);
      render(next);
      noticeChanges(next, prev);
    },
    destroy() {
      cancelAnimationFrame(raf);
      offSound();
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      arena?.destroy();
    },
  };
}
