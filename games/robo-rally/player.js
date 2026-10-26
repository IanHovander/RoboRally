// A phone in Lumen. Only what is private, as little as possible:
//   setup (the first player): choose the course · start: tap a glowing pad · upgrades: a small shop ·
//   program: tap five cards into five slots while a little light table draws where they'll take you ·
//   the race: your five slots, and under each one what happened to you (tap one to see it again) ·
//   decisions: a sheet. The "?" at the top right answers questions about anything on the screen (guide.js).
import { html, raw } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { cardType, isDamage, isHaywire, UPGRADES, HAYWIRE } from './cards.js';
import { drawCourse, previewProgram } from './minimap.js';
import { svgGlyph, cardSvgHtml, robotSvg, formOf, COURSE_TITLES, LEVELS } from './glyphs.js';
import { mountDemo, hasDemo } from './demo.js';
import { mountGuide } from './guide.js';
import { topicAtCell, cardTopic } from './topics.js';
import { marksFor, markHtml, mountFallen, ranCards } from './replay.js';

const TIMERS = [0, 60, 120, 180];
const ARROWS = ['m1', 'rr', 'bk', 'rl']; // a direction relative to you, as a card picture
const DICE_FACES = ['m1', 'm2', 'rr', 'rl', 'ut', 'm3', 'bk', 'pu'];
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};

export default function (root, api) {
  root.innerHTML = `
    <div class="pl">
      <header class="pl-top"></header>
      <div class="pl-body"></div>
      <div class="pl-sheet" hidden></div>
      <div class="pl-toast" hidden></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const pl = $('.pl');
  const top = $('.pl-top');
  const body = $('.pl-body');
  const sheet = $('.pl-sheet');
  const toast = $('.pl-toast');

  let view = null;
  let layoutKey = null; // which phase layout is built in body
  const shown = new Map();
  const set = (el, content) => {
    if (!el) return false;
    const text = String(content ?? '');
    if (shown.get(el) === text) return false;
    shown.set(el, text);
    el.innerHTML = text;
    startDemos(el);
    return true;
  };
  let localSheet = null; // { head, demo, note, options: [{ label, run, primary, hold }] }
  let lastPromptKey = null;
  const prog = { key: null, regs: [[], [], [], [], []], target: null, stack: null, keep: new Set(), hw: {}, rebootDir: 1, pick: [] };
  let draftTimer = null;
  let flip = null; // a card on its way from the hand to a slot: { rect, slot }
  let flyBack = null; // cards on their way back to the hand (undo): [{ id, rect }]
  const planned = new Map(); // round -> the light line as it was when I locked in (for the replays)
  const maps = new WeakMap(); // canvas -> how it's drawn (tile, ox, oy, robots, ghosts), to know what a tap hit

  // the Guide: "?", Point mode, the Book, first-time cues
  const guide = mountGuide(root, { getView: () => view, api, mapTopics, getPlanned });

  // this phone tells the rules whether it has finished a race before (newcomers get the Briefing). Each game
  // keeps its own list, so it's said again at every phase change (saying it twice is harmless).
  const hello = () => api.send('hello', { raced: store.get('rr.raced') === '1' });
  hello();

  // ---------- helpers ----------

  function say(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(say.t);
    say.t = setTimeout(() => (toast.hidden = true), 2600);
  }

  async function send(type, payload) {
    const res = await api.send(type, payload);
    if (res?.error) {
      say(res.error);
      api.vibrate([40, 40, 40]);
    }
    return res;
  }

  const me = () => view?.me;
  const course = () => getCourse(view.opts.course);
  const robotById = (id) => view?.robots.find((r) => r.id === id);
  const bot = (r, cls = '') => (r ? raw(robotSvg(r, { cls })) : '');
  const g = (name, cls = '') => raw(svgGlyph(name, cls));
  const card = (id, cls = '') => raw(cardSvgHtml(id, cls));
  const demo = (key, cls = '') => (hasDemo(key) ? html`<canvas class="pl-demo ${cls}" data-demo="${key}"></canvas>` : '');
  function startDemos(el) {
    for (const c of el.querySelectorAll('canvas[data-demo]:not([data-on])')) {
      c.dataset.on = '1';
      mountDemo(c, c.dataset.demo, api.you?.color ?? '#f4efe4', { safeEdges: view?.opts.lessDeadly, form: formOf(api.you) });
    }
  }
  const flagsHtml = (m, cls = '') => html`<span class="pl-flags glyphs ${cls}" data-ask="goal" data-tap="ask">${Array.from({ length: view.cps }, (_, i) => html`<i class="${i < (m?.cp ?? 0) ? 'on' : i === (m?.cp ?? 0) ? 'next' : ''}">${g('flag')}</i>`)}</span>`;

  // ---------- the light table (my map) ----------

  let mapZoom = null; // 'all' | 'near'
  let mapKey = null;
  /** Where I'd start this round's program from (my robot, or my reboot spot facing the way I chose). */
  function programStart(m) {
    return m?.on ? m : m?.rb && m.rbAt ? { ...m.rbAt, d: prog.rebootDir } : null;
  }
  function ghostsFor(m) {
    const from = programStart(m);
    if (!from || m.mustReturn) return [];
    return previewProgram(course(), from, [0, 1, 2, 3, 4].map((i) => (m.regs[i].locked ? m.regs[i].cards : prog.regs[i]).flatMap(previewType)), { lessDeadly: view.opts.lessDeadly, hover: m.up.perm.includes('hover-unit') });
  }
  function drawMap(canvas, { force = false, near = null } = {}) {
    if (!view || !canvas) return;
    const box = canvas.parentElement;
    const m = me();
    const width = box.clientWidth || 340;
    const height = box.clientHeight || 260;
    const key = JSON.stringify([mapZoom, width, height, view.phase, view.opts.course, view.robots.map((r) => [r.x, r.y, r.d, r.on, r.away]), m && [m.x, m.y, m.d, m.on, m.cp, m.done, m.up.perm], prog.regs, prog.hw, prog.rebootDir]);
    if (!force && key === mapKey && canvas.dataset.drawn) return;
    mapKey = key;
    canvas.dataset.drawn = '1';
    const c = course();
    const fit = Math.min(width / c.w, height / c.h);
    const zoom = near ?? mapZoom ?? (fit >= 22 ? 'all' : 'near');
    const tile = zoom === 'all' ? fit : Math.max(30, Math.min(40, width / 8));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // center on what matters to me
    let focus = { x: c.w / 2, y: c.h / 2 };
    const from = programStart(m);
    if (from) focus = { x: from.x + 0.5, y: from.y + 0.5 };
    let ox = (width - tile * c.w) / 2;
    let oy = (height - tile * c.h) / 2;
    if (zoom === 'near') {
      ox = Math.round(clamp(width / 2 - focus.x * tile, width - tile * c.w, 0));
      oy = Math.round(clamp(height / 2 - focus.y * tile, height - tile * c.h, 0));
    }
    const ghosts = view.phase === 'program' && from ? ghostsFor(m) : [];
    const robots = view.robots.filter((r) => r.x != null && r.on !== false).map((r) => ({ ...r, me: r.id === api.you?.id }));
    if (from && !m.on && view.phase === 'program') robots.push({ ...from, on: true, me: true, color: api.you?.color ?? '#fff', avatar: api.you?.avatar });
    drawCourse(ctx, c, { tile, ox, oy, robots, ghosts, ghostColor: api.you?.color, cpNext: m ? m.cp + 1 : null, cpDone: (n) => (m ? n <= m.cp : false) });
    canvas.dataset.zoom = zoom;
    maps.set(canvas, { tile, ox, oy, robots, ghosts });
    canvas.dataset.xform = `${tile},${ox},${oy}`; // for test scripts
    return { tile, ox, oy, zoom, fit };
  }

  /** The Guide asks: what's on the map where this tap landed? */
  function mapTopics(el, x, y) {
    const canvas = el.tagName === 'CANVAS' ? el : el.querySelector('canvas');
    const t = canvas && maps.get(canvas);
    if (!t || !view) return [];
    const r = canvas.getBoundingClientRect();
    const cx = (x - r.left - t.ox) / t.tile;
    const cy = (y - r.top - t.oy) / t.tile;
    const gx = Math.floor(cx);
    const gy = Math.floor(cy);
    const ids = topicAtCell(course(), gx, gy, cx - gx, cy - gy, { robots: t.robots, ghosts: t.ghosts });
    const other = t.robots.find((q) => q.x === gx && q.y === gy && !q.me);
    if (!ids.length) return ['me']; // plain floor: what the map is (the big screen, from above; yours has the outline)
    return ids.map((id) => (id === 'robot' && other?.id ? `robot:${other.id}` : id));
  }

  /**
   * The light line I planned for one slot of a round: the line as it was when I locked in. If that line
   * never reached this slot (it stopped at a "?"), or this phone didn't lock that round in (a reload),
   * the card I placed there, from where that slot really began.
   */
  function getPlanned(round, reg) {
    const gh = planned.get(round)?.find((x) => x.n === reg + 1);
    if (gh) return [gh];
    const m = me();
    const steps = m?.story?.round === round ? m.story.regs?.[reg] ?? [] : [];
    const s0 = steps.find((st) => st[0] === 's') ?? steps.find((st) => st[0] === 'r');
    if (!s0) return [];
    const x = steps.find((st) => st[0] === 'x');
    const c = steps.find((st) => st[0] === 'c');
    const types = x ? [x[1]] : c ? c[1] : (m.regs[reg]?.cards ?? []).map(cardType);
    if (!types.length) return [];
    const one = previewProgram(course(), { x: s0[1], y: s0[2], d: s0[3] ?? 0 }, [types.flatMap(previewType)], { lessDeadly: view.opts.lessDeadly, hover: m.up.perm.includes('hover-unit') });
    return one.slice(0, 1).map((g1) => ({ ...g1, n: reg + 1 }));
  }

  /** What the preview should assume a card does. Unknown things (SPAM, a spin, a swap) stop the preview with "?". */
  function previewType(id) {
    const t = cardType(id);
    if (!isHaywire(id)) return [t];
    const hw = HAYWIRE[t];
    if (hw.ops.some((op) => ['spin', 'double', 'swap'].includes(op[0]))) return ['?'];
    if (hw.ops.some((op) => !['mv', 'rt'].includes(op[0]))) return [['noop']];
    return hw.ops.map((op) => (op[0] === 'mv' && op[1] === 'side' ? ['mv', prog.hw[id] === 'left' ? 3 : 1, op[2]] : op));
  }

  // ---------- programming, kept on the phone so taps feel instant ----------

  function syncProgram() {
    const m = me();
    const key = `${view.round}:${view.phase}`;
    if (prog.key !== key) {
      prog.key = key;
      prog.regs = m.draft?.regs?.map((l) => [...l]) ?? [[], [], [], [], []];
      prog.target = null;
      prog.stack = null;
      prog.keep = new Set(m.draft?.keep ?? []);
      prog.hw = { ...m.hwChoice };
      prog.rebootDir = m.rebootDir ?? 1;
      prog.pick = [];
    }
    prog.regs = prog.regs.map((l, i) => (m.regs[i].locked ? [] : l.filter((c) => m.hand.includes(c))));
    for (const c of [...prog.keep]) if (!m.hand.includes(c)) prog.keep.delete(c);
  }

  const placed = () => new Set(prog.regs.flat());
  const freeRegs = () => [0, 1, 2, 3, 4].filter((i) => !me().regs[i].locked && !prog.regs[i].length);
  const programFull = () => freeRegs().length === 0;

  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => send('draft', { regs: prog.regs, rebootDir: prog.rebootDir }), 250);
  }

  function placeCard(id, el) {
    const m = me();
    if (m.done) return;
    const hasCrab = m.up.perm.includes('crab-legs');
    if (prog.stack != null) {
      const i = prog.stack;
      prog.stack = null;
      if (hasCrab && cardType(id) === 'm1' && prog.regs[i].length === 1 && ['rl', 'rr'].includes(cardType(prog.regs[i][0]))) {
        prog.regs[i] = [prog.regs[i][0], id];
        return changed();
      }
    }
    const i = prog.target ?? freeRegs()[0];
    if (i == null) {
      api.vibrate([30, 30, 30]);
      return;
    }
    if (el) flip = { rect: el.getBoundingClientRect(), slot: i };
    prog.regs[i] = [id];
    prog.target = null;
    api.vibrate(8);
    changed();
  }

  function tapRegister(i) {
    const m = me();
    if (m.done || m.regs[i].locked) return;
    if (prog.regs[i].length) {
      prog.regs[i] = [];
      prog.target = i;
    } else prog.target = prog.target === i ? null : i;
    changed();
  }

  function changed() {
    saveDraft();
    render();
  }

  async function lockIn() {
    const m = me();
    if (!programFull()) {
      api.vibrate([30, 30, 30]);
      return;
    }
    const hw = {};
    for (const id of [...prog.regs.flat(), ...m.regs.flatMap((r) => r.cards)]) if (isHaywire(id) && prog.hw[id]) hw[id] = prog.hw[id];
    const ghosts = ghostsFor(m);
    const res = await send('lock', { regs: prog.regs, keep: [...prog.keep], hw, rebootDir: prog.rebootDir });
    if (!res?.error) {
      planned.set(view.round, ghosts);
      api.vibrate([10, 40, 10]);
    }
  }

  // ---------- taps ----------

  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-ui]');
    if (!el || !root.contains(el)) return;
    const { ui, arg } = el.dataset;
    const m = me();
    switch (ui) {
      case 'opt': {
        const [key, rawValue] = arg.split('=');
        const value = rawValue === 'true' ? true : rawValue === 'false' ? false : /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue;
        api.vibrate(6);
        return send('setOpt', { key, value });
      }
      case 'course': {
        const i = COURSES.findIndex((x) => x.id === view.opts.course);
        const next = COURSES[(i + Number(arg) + COURSES.length) % COURSES.length];
        api.vibrate(6);
        return send('setOpt', { key: 'course', value: next.id });
      }
      case 'card':
        if (view.phase === 'program' && m.mustReturn) {
          const i = prog.pick.indexOf(arg);
          if (i >= 0) prog.pick.splice(i, 1);
          else if (prog.pick.length < m.mustReturn) prog.pick.push(arg);
          return render();
        }
        return placeCard(arg, el);
      case 'reg':
        return tapRegister(Number(arg));
      case 'crab':
        e.stopPropagation();
        prog.stack = Number(arg);
        return render();
      case 'keep':
        prog.keep.has(arg) ? prog.keep.delete(arg) : prog.keep.add(arg);
        return changed();
      case 'hw': {
        const [c, choice] = arg.split('=');
        prog.hw[c] = choice;
        return changed();
      }
      case 'reboot':
        prog.rebootDir = Number(arg);
        saveDraft();
        return render();
      case 'clear': {
        // the placed cards fly back into the hand
        flyBack = [];
        body.querySelectorAll('.pl-regs .pl-slot').forEach((s, i) => {
          const id = prog.regs[i]?.[0];
          const c = s.querySelector('.lm-card');
          if (id && c && !m.regs[i].locked) flyBack.push({ id, rect: c.getBoundingClientRect() });
        });
        prog.regs = prog.regs.map(() => []);
        prog.target = null;
        return changed();
      }
      case 'lock':
        return lockIn();
      case 'zoom':
        mapZoom = (body.querySelector('.pl-map canvas')?.dataset.zoom ?? 'all') === 'all' ? 'near' : 'all';
        return render();
      case 'shutdown':
        return openSheet({
          head: html`<span class="pl-sheet-ic" data-ask="shutdown">${g('power')}</span>`,
          demo: 'shutdown',
          options: [
            { label: g('power'), primary: true, hold: true, run: () => send('lock', { shutdown: true, rebootDir: prog.rebootDir }) },
            { label: g('cross'), run: () => {} },
          ],
        });
      case 'skip':
        api.vibrate(10);
        return send('skip', { on: !view.brief?.mine });
      case 'return':
        if (prog.pick.length !== m.mustReturn) return;
        await send('ret', { cards: prog.pick });
        prog.pick = [];
        return;
      case 'up': // an upgrade in my collection: see it, install it
        return openUpgrade(arg);
      case 'inst': // an installed upgrade: see it, use it, remove it
        return openInstalled(arg);
      case 'answer':
        api.vibrate(10);
        lastPromptKey = null;
        sheet.hidden = true;
        return send('answer', { v: arg });
      case 'sheet': {
        const opt = localSheet?.options[Number(arg)];
        localSheet = null;
        render();
        return opt?.run();
      }
      case 'hold': // press and hold (see below); a plain tap only wiggles it
        return;
      case 'close':
        localSheet = null;
        return render();
    }
  });

  // press and hold for 800 ms (shutting down is easy to hit by mistake): a ring fills, then it happens
  let hold = null;
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-ui="hold"]');
    if (!el) return;
    clearTimeout(hold?.t);
    el.classList.remove('wiggle');
    el.classList.add('holding');
    hold = {
      el,
      t: setTimeout(() => {
        hold = null;
        el.classList.remove('holding');
        api.vibrate([10, 30, 10]);
        const opt = localSheet?.options[Number(el.dataset.arg)];
        localSheet = null;
        render();
        opt?.run();
      }, 800),
    };
  });
  const letGo = () => {
    if (!hold) return;
    clearTimeout(hold.t);
    const { el } = hold;
    hold = null;
    el.classList.remove('holding');
    void el.offsetWidth;
    el.classList.add('wiggle');
    api.vibrate(6);
  };
  root.addEventListener('pointerup', letGo);
  root.addEventListener('pointercancel', letGo);
  root.addEventListener('pointerout', (e) => hold && e.target.closest?.('[data-ui="hold"]') === hold.el && !hold.el.contains(e.relatedTarget) && letGo());

  function openSheet(s) {
    localSheet = s;
    render();
  }

  const kindMark = (u) => html`<span class="pl-kind ${u.kind}" data-ask="kind">${u.kind === 'perm' ? '∞' : '1×'}</span>`;

  function openUpgrade(key) {
    const m = me();
    const u = UPGRADES[key];
    const slots = u.kind === 'perm' ? m.up.perm : m.up.temp;
    const afford = m.en >= u.cost && !m.installed;
    const install = slots.length < 3
      ? [{ label: html`${g('plus')}<span class="pl-cost">${g('bolt')}${u.cost}</span>`, primary: true, disabled: !afford, run: () => send('install', { card: key }) }]
      : slots.map((k) => ({ label: html`${g('swap')}<span class="pl-opt-name">${UPGRADES[k].name}</span>`, disabled: !afford, run: () => send('install', { card: key, replace: k }) }));
    openSheet({ head: html`<b class="pl-up-title" data-ask="${key}">${u.name}</b>${kindMark(u)}`, demo: key, note: u.text, options: [...install, { label: g('cross'), run: () => {} }] });
  }

  function openInstalled(key) {
    const m = me();
    const u = UPGRADES[key];
    const usable = view.phase === 'upgrade' ? ['any', 'upgrade', 'program'] : view.phase === 'program' ? ['any', 'program'] : [];
    const opts = [];
    if (u.kind === 'temp' && usable.includes(u.when)) {
      if (key === 're-initialize') {
        for (const r of view.robots) opts.push({ label: html`${bot(r)}<span class="pl-opt-name">${r.name}</span>`, run: () => send('use', { card: key, target: r.id }) });
      } else opts.push({ label: g('play'), primary: true, run: () => send('use', { card: key }) });
    }
    if (key === 'deflector-shield') opts.push({ label: html`${g(m.autoShield ? 'check' : 'cross')}<span class="pl-opt-name">auto</span>`, run: () => send('shield', { on: !m.autoShield }) });
    if (view.phase === 'upgrade') opts.push({ label: html`${g('minus')}`, run: () => send('uninstall', { card: key }) });
    opts.push({ label: g('cross'), run: () => {} });
    openSheet({ head: html`<b class="pl-up-title" data-ask="${key}">${u.name}</b>${kindMark(u)}`, demo: key, note: u.text, options: opts });
  }

  // ---------- drawing ----------

  function render() {
    if (!view) return;
    const m = me();
    if (m && view.phase === 'program') syncProgram();
    pl.dataset.phase = view.phase;
    pl.classList.toggle('vip', !!api.you?.isVip);
    renderTop(m);
    renderBody(m);
    renderSheet();
    guide.refresh();
  }

  function renderTop(m) {
    const timed = ['start', 'upgrade', 'program'].includes(view.phase) && view.deadline && (view.phase !== 'program' || view.opts.timer);
    set(top, html`
      ${api.you && html`<span class="pl-me-wrap" data-ask="me">${raw(robotSvg(api.you, { cls: 'pl-me' }))}</span>`}
      ${m && flagsHtml(m)}
      <span class="pl-spacer"></span>
      ${m && view.opts.upgrades && view.phase === 'program' && html`<span class="pl-en" data-ask="energy" data-tap="ask">${g('bolt')}${m.en}</span>`}
      ${m && m.spam > 0 && ['upgrade', 'program'].includes(view.phase) && html`<span class="pl-spam" data-ask="spam-count" data-tap="ask"><span class="pl-stack">${card('sp', 'xs')}${card('sp', 'xs')}</span><b>${m.spam}</b></span>`}
      ${timed && html`<span class="pl-timer timer" data-ask="timer" data-deadline="${view.deadline}"></span>`}
      <button class="pl-ask" data-guide="ask" aria-label="Help">${g('ask')}</button>`);
  }

  function renderBody(m) {
    if (!view.inRace && view.phase !== 'setup') return layout('watch', () => html`<div class="pl-watch"><span data-ask="watch">${g('eye')}</span></div>`);
    switch (view.phase) {
      case 'setup': return renderSetup();
      case 'start': return renderStart();
      case 'brief': return renderBrief();
      case 'upgrade': return renderUpgrade(m);
      case 'program': return renderProgram(m);
      case 'activate': return renderRun(m);
      case 'over': return renderOver(m);
    }
  }

  /** Build a phase's skeleton once; parts update in place. */
  function layout(key, build) {
    if (layoutKey === key) return false;
    layoutKey = key;
    shown.clear();
    shown.set(top, null);
    body.innerHTML = String(build());
    startDemos(body);
    return true;
  }

  // ----- setup: the first player chooses the course -----
  let shownOpts = null;
  let optClipTimer = null;
  function renderSetup() {
    if (!api.you?.isVip) {
      return layout('setup-wait', () => html`<div class="pl-watch"><span data-ask="watch">${g('eye')}</span></div>`);
    }
    const fresh = layout('setup', () => html`
      <div class="pl-setup">
        <div class="pl-course">
          <button class="pl-arrow" data-ui="course" data-arg="-1" data-ask="course" aria-label="Previous course">${g('left')}</button>
          <div class="pl-course-card" data-ask="course"></div>
          <button class="pl-arrow next" data-ui="course" data-arg="1" data-ask="course" aria-label="Next course">${g('right')}</button>
        </div>
        <div class="pl-opts-wrap"><div class="pl-optclip" hidden></div><div class="pl-opts"></div></div>
        <button class="pl-cta" data-action="begin" data-ask="start" aria-label="Start">${g('play')}</button>
      </div>`);
    const o = view.opts;
    const sel = COURSES.find((x) => x.id === o.course) ?? COURSES[0];
    const lvl = LEVELS[sel.level] ?? 1;
    set(body.querySelector('.pl-course-card'), html`
      <img alt="" src="${thumb(sel.id)}">
      <b>${COURSE_TITLES[sel.id] ?? sel.name}</b>
      <span class="pl-course-meta"><span class="pl-dots">${[1, 2, 3, 4].map((i) => html`<i class="${i <= lvl && 'on'}"></i>`)}</span><span>${g('flag')}${sel.checkpoints.length}</span></span>`);
    const ask = { upgrades: 'opt-upgrades', lessDeadly: 'opt-safe', lessSpam: 'opt-lessspam', brief: 'opt-brief' };
    const tog = (key, glyph) => html`<button class="pl-opt ${o[key] && 'on'}" data-ui="opt" data-arg="${key}=${String(!o[key])}" data-ask="${ask[key]}" aria-pressed="${String(!!o[key])}">${g(glyph)}</button>`;
    set(body.querySelector('.pl-opts'), html`
      ${tog('upgrades', 'bolt')}${tog('lessDeadly', 'wall')}${tog('lessSpam', 'sp')}${tog('brief', 'sound')}
      <span class="pl-seg" data-ask="opt-timer"><span class="pl-seg-ic">${g('timer')}</span>${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-ui="opt" data-arg="timer=${t}">${t ? t / 60 : g('inf')}</button>`)}</span>`);
    // an option just changed: its clip plays above the row for a few seconds
    if (shownOpts && !fresh) {
      const changedKey = ['upgrades', 'lessDeadly', 'lessSpam', 'timer'].find((k) => shownOpts[k] !== o[k]);
      if (changedKey) showOptClip(changedKey, o[changedKey]);
    }
    shownOpts = { ...o };
  }
  function showOptClip(key, value) {
    const box = body.querySelector('.pl-optclip');
    if (!box) return;
    const clip = {
      upgrades: ['upgrades', !value, null],
      lessDeadly: [value ? 'safe-edges' : 'edge', false, null],
      lessSpam: ['less-spam', !value, null],
      timer: ['timeout', false, value ? String(value / 60) : '∞'],
    }[key];
    if (!clip) return; // (the Briefing toggle has no clip: the Briefing itself is the explanation)
    const [k, crossed, numeral] = clip;
    box.innerHTML = String(html`<canvas data-demo="${k}"></canvas>${crossed && html`<i class="pl-optx">${g('cross')}</i>`}${numeral && html`<b class="pl-optnum">${numeral === '∞' ? g('inf') : numeral}</b>`}`);
    box.hidden = false;
    box.classList.remove('out');
    startDemos(box);
    clearTimeout(optClipTimer);
    optClipTimer = setTimeout(() => {
      box.classList.add('out');
      setTimeout(() => (box.hidden = true), 400);
    }, 4000);
  }

  const thumbs = new Map();
  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(8, Math.floor(320 / Math.max(c.w, c.h * 1.3)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile, glow: true });
    thumbs.set(id, cv.toDataURL());
    return thumbs.get(id);
  }

  // ----- start: tap a glowing pad on the dock (the whole course above, so you know where you're going) -----
  function renderStart() {
    layout('start', () => html`<div class="pl-start">
      <div class="pl-overview" data-ask="course"><canvas></canvas></div>
      <div class="pl-dock-box"><div class="pl-dock-wrap" data-ask="map"><canvas class="pl-dock"></canvas><div class="pl-pads"></div></div></div></div>`);
    const c = course();
    const mine = view.robots.find((r) => r.id === api.you?.id)?.pick;
    drawOverview(body.querySelector('.pl-overview canvas'), c, mine);
    const cv = body.querySelector('canvas.pl-dock');
    const box = body.querySelector('.pl-dock-box');
    const dock = c.boards.find((b) => b.dock) ?? { x: 0, y: 0, w: c.w, h: c.h };
    // the dock and a little of the floor beside it
    const tall = dock.h > dock.w;
    const view0 = tall ? { x: dock.x, y: dock.y, w: dock.w + 2, h: dock.h } : { x: dock.x, y: dock.y - 2, w: dock.w, h: dock.h + 2 };
    const W = box.clientWidth || 340;
    const H = box.clientHeight || 500;
    const tile = Math.max(40, Math.floor(Math.min(W / view0.w, H / view0.h, 72)));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = tile * view0.w;
    const ch = tile * view0.h;
    const ox = -view0.x * tile;
    const oy = -view0.y * tile;
    const key = JSON.stringify([W, H, c.id]);
    if (cv.dataset.key !== key) {
      cv.dataset.key = key;
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCourse(ctx, c, { tile, ox, oy, noStarts: true });
    }
    maps.set(cv, { tile, ox, oy, robots: [], ghosts: [] });
    // each start space is a button: free ones glow, taken ones show their robot
    const taken = new Map(view.robots.filter((r) => r.pick != null).map((r) => [r.pick, r]));
    set(body.querySelector('.pl-pads'), html`${c.starts.map((st) => {
      const r = taken.get(st.n);
      const isMe = r && r.id === api.you?.id;
      const style = `left:${ox + st.x * tile}px;top:${oy + st.y * tile}px;width:${tile}px;height:${tile}px;${r ? `--c:${r.color}` : ''}`;
      return html`<button class="pl-pad ${r ? (isMe ? 'mine' : 'taken') : 'free'} ${mine != null && !r && 'quiet'}" style="${style}" ${r && !isMe ? 'disabled' : ''} data-action="pick" data-ask="pad" data-payload="${JSON.stringify({ n: st.n })}" aria-label="Start ${st.n}">
        ${r ? bot(r) : html`<span>${st.n}</span>`}
      </button>`;
    })}`);
  }

  /** The whole course, small: flag numbers, the dock outlined, my pad lit. Not a control. */
  function drawOverview(cv, c, mine) {
    const box = cv.parentElement;
    const W = box.clientWidth || 340;
    const maxH = Math.round(window.innerHeight * 0.22);
    const tile = Math.min(W / c.w, maxH / c.h);
    const w = Math.round(tile * c.w);
    const h = Math.round(tile * c.h);
    const key = JSON.stringify([W, maxH, c.id, mine, api.you?.color]);
    if (cv.dataset.key === key) return;
    cv.dataset.key = key;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCourse(ctx, c, { tile, glow: tile >= 8 });
    const dock = c.boards.find((b) => b.dock);
    if (dock) {
      ctx.strokeStyle = 'rgba(244,239,228,.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(dock.x * tile + 0.75, dock.y * tile + 0.75, dock.w * tile - 1.5, dock.h * tile - 1.5);
      ctx.setLineDash([]);
    }
    const st = c.starts.find((s) => s.n === mine);
    if (st) {
      ctx.fillStyle = api.you?.color ?? '#fff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = tile;
      ctx.beginPath();
      ctx.arc((st.x + 0.5) * tile, (st.y + 0.5) * tile, Math.max(3, tile * 0.42), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // flag numbers, big enough to read
    for (const cp of c.checkpoints) {
      const x = (cp.x + 0.5) * tile;
      const y = (cp.y + 0.5) * tile;
      const r = Math.max(6, tile * 0.6);
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0e13';
      ctx.font = `600 ${Math.round(r * 1.25)}px Lumen, Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cp.n), x, y + r * 0.06);
    }
  }

  // ----- the Briefing: look up; skip if most of you want to -----
  function renderBrief() {
    layout('brief', () => html`<div class="pl-brief"><div class="pl-look big" data-ask="look-up">${g('eye')}</div><button class="pl-cta pl-skip" data-ui="skip" aria-label="Skip"></button></div>`);
    const b = view.brief ?? { votes: 0, need: 1, mine: false };
    const btn = body.querySelector('.pl-skip');
    btn.classList.toggle('on', !!b.mine);
    set(btn, html`${g('skip')}<span class="pl-tally">${Array.from({ length: Math.max(b.need, b.votes) }, (_, i) => html`<i class="${i < b.votes && 'on'}"></i>`)}</span>`);
  }

  // ----- upgrades: a small shop -----
  function renderUpgrade(m) {
    if (m.done) {
      layout('upgrade-done', () => html`<div class="pl-done"><div class="pl-done-mark" data-ask="shop">${g('check')}</div><div class="pl-installed"></div></div>`);
      set(body.querySelector('.pl-installed'), installed(m));
      return;
    }
    layout('upgrade', () => html`
      <div class="pl-shop">
        <div class="pl-shop-head"><span class="pl-energy" data-ask="energy" data-tap="ask">${g('bolt')}<b></b></span></div>
        <div class="pl-ups"></div>
        <div class="pl-installed"></div>
        <button class="pl-cta" data-action="done" data-ask="shop" aria-label="Done">${g('check')}</button>
      </div>`);
    set(body.querySelector('.pl-energy b'), m.en);
    const canDraw = !m.bought && m.en >= 1;
    set(body.querySelector('.pl-ups'), html`
      <button class="pl-draw" data-action="buy" data-ask="draw" ${canDraw ? '' : 'disabled'} aria-label="Draw an upgrade">
        <span class="pl-draw-card">${g('plus')}</span><span class="pl-cost">${g('bolt')}1</span>
      </button>
      ${m.up.hand.map((k) => {
        const u = UPGRADES[k];
        const can = !m.installed && m.en >= u.cost;
        return html`<button class="pl-up ${u.kind} ${!can && 'cant'}" data-ui="up" data-arg="${k}" data-ask="${k}">
          ${demo(k)}<span class="pl-up-name">${u.name}</span><span class="pl-cost">${g('bolt')}${u.cost}</span>
        </button>`;
      })}`);
    set(body.querySelector('.pl-installed'), installed(m));
  }

  /** My installed upgrades: three permanent slots, three one-use slots. */
  function installed(m) {
    if (!m.up.perm.length && !m.up.temp.length) return '';
    const slot = (k, kind) => (k
      ? html`<button class="pl-slot-up ${kind}" data-ui="inst" data-arg="${k}" data-ask="${k}">${demo(k, 'tiny')}<span>${UPGRADES[k].name}</span></button>`
      : html`<span class="pl-slot-up empty ${kind}" data-ask="kind"></span>`);
    return html`
      <div class="pl-inst-row">${[0, 1, 2].map((i) => slot(m.up.perm[i], 'perm'))}</div>
      <div class="pl-inst-row">${[0, 1, 2].map((i) => slot(m.up.temp[i], 'temp'))}</div>`;
  }

  // ----- programming -----
  function renderProgram(m) {
    if (m.mustReturn) {
      layout('return', () => html`<div class="pl-return"><div class="pl-return-head">${g('hand')}<b></b></div><div class="pl-hand"></div><button class="pl-cta" data-ui="return">${g('check')}</button></div>`);
      set(body.querySelector('.pl-return-head b'), `${prog.pick.length}/${m.mustReturn}`);
      set(body.querySelector('.pl-hand'), html`${m.hand.map((id) => html`<button class="pl-card ${prog.pick.includes(id) && 'picked'}" data-ui="card" data-arg="${id}" data-ask="${cardTopic(id)}">${card(id)}${prog.pick.includes(id) && html`<i class="pl-pick-n">${prog.pick.indexOf(id) + 1}</i>`}</button>`)}`);
      body.querySelector('.pl-cta').disabled = prog.pick.length !== m.mustReturn;
      return;
    }
    const fresh = layout('program', () => html`
      <div class="pl-prog">
        <div class="pl-regs"></div>
        <div class="pl-map" data-ask="map"><canvas></canvas><div class="pl-reboot" data-ask="reboot-dir"></div><button class="pl-zoom" data-ui="zoom" aria-label="Zoom">${g('zoom')}</button></div>
        <div class="pl-extra"></div>
        <div class="pl-hand"></div>
        <div class="pl-actions">
          <button class="pl-small" data-ui="clear" data-ask="clear" aria-label="Clear">${g('undo')}</button>
          <button class="pl-lock" data-ui="lock" data-ask="lock" aria-label="Lock in">${g('check')}</button>
          <button class="pl-small" data-ui="shutdown" data-ask="shutdown" aria-label="Shut down">${g('power')}</button>
        </div>
      </div>`);
    const done = m.done;
    pl.classList.toggle('locked', !!done);
    const hasCrab = m.up.perm.includes('crab-legs');
    const nextTarget = done ? null : prog.target ?? freeRegs()[0];
    set(body.querySelector('.pl-regs'), html`${[0, 1, 2, 3, 4].map((i) => {
      const r = m.regs[i];
      const list = r.locked ? r.cards : prog.regs[i];
      const canStack = !done && hasCrab && list.length === 1 && ['rl', 'rr'].includes(cardType(list[0]));
      const ask = r.locked ? `haywire-slot:${cardType(r.cards[0] ?? 'hw')}` : 'slots';
      return html`<button class="pl-slot ${nextTarget === i && 'target'} ${r.locked && 'locked'} ${list.length && 'full'} ${prog.stack === i && 'stacking'}" data-ui="reg" data-arg="${i}" data-ask="${ask}" ${r.locked ? raw('data-tap="ask"') : ''}>
        ${list.length ? list.map((id) => card(id, list.length > 1 ? 'half' : '')) : html`<i>${i + 1}</i>`}
        ${canStack && html`<span class="pl-crab" data-ui="crab" data-arg="${i}" data-ask="crab-legs">${g('plus')}</span>`}
      </button>`;
    })}`);
    // reboot: choose which way to face when coming back
    set(body.querySelector('.pl-reboot'), m.rb ? html`${[0, 1, 2, 3].map((d) => html`<button class="pl-dir d${d} ${prog.rebootDir === d && 'on'}" data-ui="reboot" data-arg="${d}" aria-label="Face ${['north', 'east', 'south', 'west'][d]}">${g('m1')}</button>`)}` : '');
    // Haywire choices, a peek at the deck (SPAM Filter), one-use upgrades for now
    const hwIn = [...new Set([...prog.regs.flat(), ...m.regs.flatMap((r) => (r.locked ? r.cards : []))])].filter((id) => HAYWIRE[cardType(id)]?.choice);
    const perms = m.up.hand.filter((k) => UPGRADES[k].kind === 'perm');
    const usable = m.up.temp.filter((k) => ['any', 'program'].includes(UPGRADES[k].when));
    set(body.querySelector('.pl-extra'), html`
      ${hwIn.map((id) => HAYWIRE[cardType(id)].choice === 'side'
        ? html`<span class="pl-chip" data-ask="${cardTopic(id)}">${card(id, 'xs')}${['left', 'right'].map((s) => html`<button class="${(prog.hw[id] ?? 'right') === s && 'on'}" data-ui="hw" data-arg="${id}=${s}">${g(s === 'left' ? 'rl' : 'rr')}</button>`)}</span>`
        : perms.length ? html`<span class="pl-chip" data-ask="${cardTopic(id)}">${card(id, 'xs')}${perms.map((k) => html`<button class="${(prog.hw[id] ?? perms[0]) === k && 'on'}" data-ui="hw" data-arg="${id}=${k}">${UPGRADES[k].name}</button>`)}</span>` : '')}
      ${m.peek && html`<span class="pl-chip peek" data-ask="spam-filter" data-tap="ask">${g('eye')}${card(m.peek, 'xs')}</span>`}
      ${usable.map((k) => html`<button class="pl-chip" data-ui="inst" data-arg="${k}" data-ask="${k}">${demo(k, 'tiny')}<span>${UPGRADES[k].name}</span></button>`)}`);
    const used = placed();
    const hasMemory = m.up.perm.includes('memory-cards');
    set(body.querySelector('.pl-hand'), html`${m.hand.map((id, n) => {
      const isUsed = used.has(id);
      const keepable = hasMemory && programFull() && !isDamage(id) && !isUsed;
      return html`<span class="pl-hand-slot">
        <button class="pl-card ${isUsed && 'used'} ${view.round === 1 && n === 0 && !used.size && 'hint'}" data-ui="card" data-arg="${id}" data-ask="${cardTopic(id)}" ${isUsed || done ? 'disabled' : ''}>${card(id)}</button>
        ${keepable && html`<button class="pl-keep ${prog.keep.has(id) && 'on'}" data-ui="keep" data-arg="${id}" data-ask="memory-cards" aria-label="Keep">${g('keep')}</button>`}
      </span>`;
    })}`);
    const lock = body.querySelector('.pl-lock');
    lock.classList.toggle('live', programFull() && !done);
    lock.classList.toggle('done', !!done);
    lock.dataset.ui = done ? '' : 'lock';
    if (done) {
      lock.setAttribute('data-action', 'unlock');
      lock.innerHTML = String(g(m.wantSd ? 'power' : 'edit'));
      shown.delete(lock);
    } else {
      lock.removeAttribute('data-action');
      lock.innerHTML = String(g('check'));
    }
    for (const b of body.querySelectorAll('.pl-small')) b.disabled = !!done;
    const canvas = body.querySelector('.pl-map canvas');
    drawMap(canvas, { force: fresh });
    // the card I just tapped flies into its slot
    if (flip) {
      const slotCard = body.querySelectorAll('.pl-slot')[flip.slot]?.querySelector('.lm-card');
      if (slotCard) {
        const to = slotCard.getBoundingClientRect();
        const from = flip.rect;
        slotCard.animate([
          { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
          { transform: 'none' },
        ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      flip = null;
    }
    // undo: every placed card flies back to its place in the hand
    if (flyBack) {
      flyBack.forEach(({ id, rect }, n) => {
        const el = body.querySelector(`.pl-hand .pl-card[data-arg="${CSS.escape(id)}"] .lm-card`);
        if (!el) return;
        const to = el.getBoundingClientRect();
        el.animate([
          { transform: `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width})`, opacity: 1 },
          { transform: 'none', opacity: 1 },
        ], { duration: 260, delay: n * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
      flyBack = null;
    }
    tickDice();
  }

  // the last 10 seconds: empty slots flicker through random faces, like dice (time's up: random cards)
  function tickDice() {
    const m = me();
    const left = view?.deadline ? view.deadline - api.now() : Infinity;
    const on = view?.phase === 'program' && view.opts.timer && m && !m.done && !m.mustReturn && left <= 10_000 && left > 0;
    for (const s of body.querySelectorAll('.pl-regs .pl-slot')) {
      const empty = on && !s.classList.contains('full') && !s.classList.contains('locked');
      let d = s.querySelector('.pl-dice');
      if (!empty) {
        d?.remove();
        continue;
      }
      if (!d) {
        d = document.createElement('span');
        d.className = 'pl-dice';
        s.append(d);
      }
      d.innerHTML = cardSvgHtml(DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]);
    }
  }
  const diceTimer = setInterval(() => view?.phase === 'program' && tickDice(), 120);

  // ----- the race: your slots, and what happened to you in each -----
  const race = { key: null, spam: null, seenNext: new Set(), fellAt: null, midKey: null, cued: false };
  function renderRun(m) {
    const fresh = layout('run', () => html`
      <div class="pl-run">
        <div class="pl-regs run"></div>
        <div class="pl-look-box"></div>
        <div class="pl-run-foot">
          <div class="pl-deckstack" data-ask="spam-count" data-tap="ask"></div>
          <div class="pl-run-extra"></div>
        </div>
      </div>`);
    const roundKey = `${view.round}`;
    if (race.key !== roundKey) Object.assign(race, { key: roundKey, spam: m.spam, seenNext: new Set(), fellAt: null, midKey: null });
    const story = m.story?.round === view.round ? m.story : null;
    const auto = m.auto ?? [];
    // where I fell: marks stop there, and the slots after it crumble
    let fell = null;
    story?.regs?.forEach((steps, i) => {
      if (fell == null && steps?.some((st) => st[0] === 'f')) fell = i;
    });
    if (fell == null && !m.on && race.fellAt == null) race.fellAt = view.reg;
    if (fell == null) fell = race.fellAt;
    const arriving = [];
    set(body.querySelector('.pl-regs'), html`${m.regs.map((r, i) => {
      const past = i < view.reg;
      const now = i === view.reg;
      const gone = fell != null && i > fell;
      const nextKey = r.next ? `${i}:${r.next}` : null;
      const arrive = nextKey && !race.seenNext.has(nextKey);
      if (arrive) arriving.push(nextKey);
      const marks = past || (now && fell === i) ? marksFor(story?.regs?.[i], { auto: auto.includes(i) }) : [];
      const ask = (past || now) && !gone ? `replay:${i}` : 'slots';
      // a fall empties my slots: the cards that ran are still in the story
      const shownCards = r.cards.length ? r.cards : ranCards(story?.regs?.[i]).filter((c) => !c.was && c.t).map((c) => c.t);
      return html`<div class="pl-col">
        <span class="pl-slot ${now && 'now'} ${past && 'past'} ${shownCards.length && 'full'} ${gone && 'gone'}" data-ask="${ask}" ${(past || now) && !gone ? raw('data-tap="ask"') : ''}>
          ${shownCards.length ? shownCards.map((id) => card(id, shownCards.length > 1 ? 'half' : '')) : html`<i>${i + 1}</i>`}
          ${r.next && html`<span class="pl-next ${arrive && 'arrive'}" data-ask="haywire-slot:${cardType(r.next)}" data-tap="ask">${card(r.next, 'xs')}</span>`}
        </span>
        <span class="pl-marks">${!gone && raw(marks.map((x) => markHtml(x, view.robots)).join(''))}</span>
      </div>`;
    })}`);
    for (const k of arriving) race.seenNext.add(k);
    if (arriving.length) guide.cue('damage', { card: 'hw' }, 'damage');
    // the middle: look up, or (when I've fallen) the way back in
    const lookBox = body.querySelector('.pl-look-box');
    const midKey = m.on ? 'look' : `fallen:${JSON.stringify(m.rbAt)}`;
    if (race.midKey !== midKey) {
      race.midKey = midKey;
      if (m.on) lookBox.innerHTML = String(html`<div class="pl-look" data-ask="look-up">${g('eye')}</div>`);
      else {
        lookBox.innerHTML = String(html`<div class="pl-fallen" data-ask="fall" data-tap="ask"><canvas></canvas></div>`);
        mountFallen(lookBox.querySelector('canvas'), { course: course(), at: m.rbAt ?? { x: m.x ?? 0, y: m.y ?? 0, d: m.d ?? 0 }, color: api.you?.color ?? '#fff', form: formOf(api.you) });
      }
    }
    // my junk, bottom left: a SPAM card drops in when one arrives
    const stackEl = body.querySelector('.pl-deckstack');
    const grew = race.spam != null && m.spam > race.spam;
    set(stackEl, html`<span class="pl-stack ${!m.spam && 'empty'}">${card('sp', 'xs')}${card('sp', 'xs')}</span><b class="${grew && 'tick'}">${m.spam}</b>`);
    if (grew) {
      dropSpam(stackEl);
      guide.cue('damage', { card: 'sp' }, 'damage');
    }
    race.spam = m.spam;
    const armable = m.canArm && m.on && m.up.temp.filter((k) => ['move', 'turn'].includes(UPGRADES[k].when));
    const waiting = view.waiting && robotById(view.waiting.id);
    set(body.querySelector('.pl-run-extra'), html`
      ${m.sd && html`<div class="pl-state" data-ask="shutdown" data-tap="ask">${g('power')}</div>`}
      ${waiting && html`<div class="pl-waiting" data-ask="decide:${waiting.id}" data-tap="ask">${bot(waiting)}<span class="pl-think"><i></i><i></i><i></i></span></div>`}
      ${armable?.length > 0 && html`
        <button class="pl-arm ${m.armed && 'on'}" data-action="arm" data-ask="arm" data-payload="${JSON.stringify({ on: !m.armed })}">
          ${armable.map((k) => html`<span class="pl-arm-up">${UPGRADES[k].name}</span>`)}<span class="pl-arm-state">${g(m.armed ? 'check' : 'play')}</span>
        </button>`}`);
    if (fresh) race.spam = m.spam;
  }
  /** A coral card drops from the top of the screen into my junk stack. */
  function dropSpam(stackEl) {
    const to = stackEl.querySelector('.pl-stack')?.getBoundingClientRect();
    if (!to) return;
    const el = document.createElement('span');
    el.className = 'pl-drop';
    el.innerHTML = cardSvgHtml('sp');
    pl.append(el);
    const r = pl.getBoundingClientRect();
    el.style.left = `${to.left - r.left}px`;
    el.style.top = `${to.top - r.top}px`;
    el.animate([
      { transform: `translate(${r.width / 2 - (to.left - r.left)}px, ${-(to.top - r.top) - 40}px) scale(1.6) rotate(-12deg)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: 'none', opacity: 1 },
    ], { duration: 280 + 300, easing: 'cubic-bezier(.3,.7,.2,1)' }).finished.then(() => el.remove(), () => el.remove());
  }

  // ----- the end -----
  function renderOver(m) {
    if (view.inRace) store.set('rr.raced', '1');
    layout('over', () => html`<div class="pl-over"></div>`);
    const w = robotById(view.winner);
    const won = view.winner === api.you?.id;
    set(body.querySelector('.pl-over'), html`
      ${w && html`<div class="pl-winner ${won && 'me'}" style="--c:${w.color}" data-ask="goal">${bot(w, 'big')}<b>${w.name}</b>
        <span class="pl-flags glyphs big">${Array.from({ length: view.cps }, () => html`<i class="on">${g('flag')}</i>`)}</span></div>`}
      ${m && !won && html`<div class="pl-mine">${flagsHtml(m)}</div>`}
      ${api.you?.isVip && html`<button class="pl-cta" data-action="finish" aria-label="Back to the lobby">${g('home')}</button>`}`);
  }

  // ----- decisions -----
  function renderSheet() {
    const p = view.prompt;
    if (p) {
      const key = `${p.kind}:${p.deadline}`;
      if (key !== lastPromptKey) {
        lastPromptKey = key;
        api.vibrate([30, 60, 30]);
      }
      sheet.hidden = false;
      const askOf = (v) => (UPGRADES[String(v).split(':')[0]] ? String(v).split(':')[0] : null);
      set(sheet, html`
        <div class="pl-sheet-box">
          <div class="pl-sheet-head" data-ask="${promptAsk(p)}">${promptHead(p)}<span class="pl-sheet-timer timer" data-deadline="${p.deadline}"></span></div>
          ${p.icon && demo(p.icon, 'wide')}
          <div class="pl-sheet-opts ${p.options.length > 3 && 'grid'}">
            ${p.options.map((o) => html`<button class="pl-choice ${['go', 'main'].includes(o.v) && 'main'} ${['no', 'skip'].includes(o.v) && 'quiet'}" data-ui="answer" data-arg="${o.v}" ${askOf(o.v) ? raw(`data-ask="${askOf(o.v)}"`) : ''}>${optionPicture(p, o)}</button>`)}
          </div>
        </div>`);
      return;
    }
    lastPromptKey = null;
    if (localSheet) {
      sheet.hidden = false;
      const n = localSheet.options.length;
      set(sheet, html`
        <div class="pl-sheet-box">
          <div class="pl-sheet-head">${localSheet.head}</div>
          ${localSheet.demo && demo(localSheet.demo, 'wide')}
          ${localSheet.note && html`<p class="pl-note">${localSheet.note}</p>`}
          <div class="pl-sheet-opts ${n > 3 && 'grid'}">
            ${localSheet.options.map((o, i) => html`<button class="pl-choice ${o.primary && 'main'} ${o.hold && 'pl-hold'} ${i === n - 1 && n > 1 && 'quiet'}" data-ui="${o.hold ? 'hold' : 'sheet'}" data-arg="${i}" ${o.disabled ? 'disabled' : ''}>${o.hold && html`<span class="pl-hold-ring"></span>`}${o.label}</button>`)}
          </div>
        </div>`);
      return;
    }
    sheet.hidden = true;
    set(sheet, '');
  }

  /** The topic a decision is about (its upgrade). */
  function promptAsk(p) {
    if (p.kind === 'weapon') return p.options.map((o) => String(o.v)).find((k) => UPGRADES[k]) ?? 'robot';
    if (p.kind === 'window') return 'arm';
    return UPGRADES[p.icon] ? p.icon : 'decide';
  }

  function promptHead(p) {
    if (p.kind === 'window') return html`${(p.card ?? []).map((t) => card(t))}<span class="pl-q">${g('dots')}</span>`;
    if (p.kind === 'weapon') return html`<span class="pl-beam"></span>${bot(robotById(p.target))}`;
    return html`<b class="pl-up-title">${UPGRADES[p.icon]?.name ?? p.title ?? ''}</b>`;
  }

  /** A choice as a picture, with a word only where no picture can say it. */
  function optionPicture(p, o) {
    const [k, arg] = String(o.v).split(':');
    const rel = (d) => (Number(d) - (me()?.d ?? 0) + 4) % 4;
    const word = (t) => html`<span class="pl-opt-name">${t}</span>`;
    switch (p.kind) {
      case 'window':
        if (k === 'go') return html`${g('play')}${(p.card ?? []).map((t) => card(t, 'xs'))}`;
        if (k === 'after') return html`${(p.card ?? []).map((t) => card(t, 'xs'))}${g('play')}${g('dots')}`;
        if (k === 'skip') return g('cross');
        if (k === 'boink') return html`${card(ARROWS[rel(arg)], 'xs')}${word(o.label)}`;
        if (k === 'zoop') return html`${card(['m1', 'rr', 'ut', 'rl'][rel(arg)], 'xs')}${word(o.label)}`;
        if (k === 'switch') return html`${g('swap')}${bot(robotById(arg))}`;
        return html`${demo(k, 'tiny')}${word(o.label)}`;
      case 'brakes':
        return k === 'brake' ? html`${g('cross')}${word('0')}` : card('m1', 'xs');
      case 'slide':
        return k === 'yes' ? card('m1', 'xs') : g('cross');
      case 'econv':
        return k === 'no' ? g('cross') : card(k === 'fwd' ? 'm1' : 'bk', 'xs');
      case 'weapon':
        return k === 'main' ? html`<span class="pl-beam"></span>` : html`${demo(k, 'tiny')}${word(o.label)}`;
      case 'lucky':
        return k === 'use' ? card(p.data?.card ?? 'h01', 'xs') : g('cross');
      case 'pierce':
        return k === 'no' ? g('cross') : card(ARROWS[rel(arg)], 'xs');
      case 'chassis':
        return k === 'no' ? g('cross') : html`${bot(robotById(k))}${word(UPGRADES[arg]?.name ?? '')}`;
      case 'magnet':
        return k === 'yes' ? html`${bot(robotById(p.leader))}${card(ARROWS[rel(p.data?.d ?? 0)], 'xs')}` : g('cross');
      case 'selfdiag':
        return k === 'no' ? g('cross') : html`${card(k, 'xs')}${g('minus')}`;
    }
    return word(o.label);
  }

  // for test scripts: what this phone sees
  window.lumenPhone = { view: () => view, course: () => view && course(), guide };

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      const before = view;
      view = next;
      if (before?.phase !== next.phase) {
        if (before) hello();
        localSheet = null;
        pl.classList.remove('locked');
        if (next.phase === 'program' || next.phase === 'start') api.vibrate(20);
      }
      render();
    },
    destroy() {
      clearTimeout(draftTimer);
      clearInterval(diceTimer);
      guide.destroy();
    },
  };
}

function clamp(v, lo, hi) {
  return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v));
}
