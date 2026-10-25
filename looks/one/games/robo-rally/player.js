// A phone during the race: a graphite storyboard. You deal cards from your hand into five film frames;
// a small map shows where they'll take you; lock, then look up. During the race the phone goes nearly
// dark (only the frame that's playing lights up), so everyone watches the big screen together.
// Shared information (who's ready, everyone's cards) lives on the big screen, not here.
import { html, raw } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { cardType, isDamage, isHaywire, UPGRADES, HAYWIRE } from './cards.js';
import { drawCourse, previewProgram } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon, ARROW } from './icons.js';
import { mountDemo, hasDemo } from './demo.js';
import { paint, portrait } from './look.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const TIMERS = [0, 60, 120, 180];
const I = {
  lock: '<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M6 3l15 9-15 9z" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z" fill="currentColor"/></svg>',
  reboot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
  up: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="14" width="52" height="30" rx="3"/><path d="M24 54h16M32 44v10"/><path d="M32 36V22M26 28l6-6 6 6"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  push: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h11M10 7l5 5-5 5"/><rect x="17" y="6" width="4" height="12" rx="1"/></svg>',
  hit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>',
  fall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="17" rx="8" ry="3.5"/><path d="M12 3v9M8.5 8.5 12 12l3.5-3.5"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></svg>',
};

export default function (root, api) {
  root.innerHTML = `
    <div class="pp">
      <div class="pp-top"></div>
      <div class="pp-map"><canvas></canvas><button class="pp-map-btn" type="button" aria-label="Zoom">${I.zoom}</button></div>
      <div class="pp-body"></div>
      <div class="pp-sheet" hidden></div>
      <div class="pp-toast" hidden></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const shell = $('.pp');
  const top = $('.pp-top');
  const mapBox = $('.pp-map');
  const canvas = $('canvas');
  const mapBtn = $('.pp-map-btn');
  const body = $('.pp-body');
  const sheet = $('.pp-sheet');
  const toast = $('.pp-toast');

  let view = null;
  let mapMode = null; // 'all' | 'near'
  const shown = new Map(); // element -> the HTML it shows, so unchanged parts aren't rebuilt (taps survive updates)
  const set = (el, content) => {
    const text = String(content ?? '');
    if (shown.get(el) === text) return false;
    shown.set(el, text);
    el.innerHTML = text;
    startDemos(el);
    return true;
  };
  let lastPromptKey = null;
  let localSheet = null; // { head, demo, note, options: [{ label, run }] }
  // the program being built, kept on the phone so tapping feels instant
  const prog = { key: null, regs: [[], [], [], [], []], target: null, stack: null, keep: new Set(), hw: {}, rebootDir: 1, pick: [] };
  let draftTimer = null;

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
  const face = (r, cls = '') => (r ? raw(portrait(r, { cls })) : '');

  /** A card: its picture on card stock, coloured by type. */
  function cardHtml(id, { cls = '', ui = null, n = '' } = {}) {
    const attrs = ui ? html`data-ui="${ui}" data-arg="${id}" data-n="${n}"` : '';
    return html`<span class="pp-card ${cardKind(id)} ${cls}" ${attrs}>${raw(cardPicture(id))}</span>`;
  }

  /** A looping explanation. The canvas starts playing once it's on the page. */
  const demo = (key, cls = '') => (hasDemo(key) ? html`<canvas class="pp-demo ${cls}" data-demo="${key}"></canvas>` : '');
  function startDemos(el) {
    for (const c of el.querySelectorAll('canvas[data-demo]:not([data-on])')) {
      c.dataset.on = '1';
      mountDemo(c, c.dataset.demo, paint(api.you?.color ?? '#f0a54a'), { safeEdges: view?.opts.lessDeadly });
    }
  }

  function upgradeTile(key, extra = '') {
    const u = UPGRADES[key];
    return html`
      <div class="pp-up ${u.kind}">
        ${demo(key)}
        <div class="pp-up-info">
          <div class="pp-up-head"><span class="pp-up-ic">${upgradeIcon(key)}</span><b>${u.name}</b></div>
          <div class="pp-up-meta"><span class="pp-cost">${raw(I.bolt)}${u.cost}</span><span class="pp-kind">${u.kind === 'perm' ? '∞' : '1×'}</span></div>
        </div>
        ${extra}
      </div>`;
  }

  // ---------- the map ----------

  let mapKey = null;
  function drawMap(force = false) {
    if (!view || mapBox.hidden) return;
    const m = me();
    const key = JSON.stringify([mapMode, mapBox.clientWidth, mapBox.clientHeight, view.phase, view.opts.course, view.robots, m && [m.x, m.y, m.d, m.on, m.cp, m.done], prog.regs, prog.hw, prog.rebootDir]);
    if (!force && key === mapKey) return;
    mapKey = key;
    const c = course();
    const width = mapBox.clientWidth || 340;
    const boxH = mapBox.clientHeight || 220;
    const fitTile = Math.min(width / c.w, boxH / c.h);
    mapMode ??= fitTile >= 22 ? 'all' : 'near';
    mapBtn.hidden = fitTile >= 28;
    const tile = mapMode === 'all' ? Math.floor(fitTile) : Math.max(30, Math.floor(fitTile * 1.6));
    const height = boxH;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    let focus = { x: c.w / 2, y: c.h / 2 };
    if (m?.on) focus = { x: m.x + 0.5, y: m.y + 0.5 };
    else if (m?.rb && m.rbAt) focus = { x: m.rbAt.x + 0.5, y: m.rbAt.y + 0.5 };
    let ox = (width - tile * c.w) / 2;
    let oy = (height - tile * c.h) / 2;
    if (mapMode === 'near') {
      ox = Math.round(clamp(width / 2 - focus.x * tile, width - tile * c.w, 0));
      oy = Math.round(clamp(height / 2 - focus.y * tile, height - tile * c.h, 0));
    }
    const from = m?.on ? m : m?.rb && m.rbAt ? { ...m.rbAt, d: prog.rebootDir } : null;
    const ghosts =
      view.phase === 'program' && from && !m.done && !m.mustReturn
        ? previewProgram(c, from, [0, 1, 2, 3, 4].map((i) => (m.regs[i].locked ? m.regs[i].cards : prog.regs[i]).flatMap(previewType)), { lessDeadly: view.opts.lessDeadly })
        : [];
    const robots = view.robots.filter((r) => r.x != null).map((r) => ({ ...r, color: paint(r.color), me: r.id === api.you?.id }));
    if (from && !m.on && view.phase === 'program') robots.push({ ...from, on: true, me: true, color: paint(api.you?.color) });
    drawCourse(g, c, {
      tile,
      ox,
      oy,
      robots,
      ghosts,
      ghostColor: paint(api.you?.color ?? '#fff'),
      cpNext: m ? m.cp + 1 : null,
      cpDone: (n) => (m ? n <= m.cp : false),
    });
  }

  /** What the preview should assume a card does. Unknown things (SPAM) stop the preview. */
  function previewType(id) {
    const t = cardType(id);
    if (!isHaywire(id)) return [t];
    const hw = HAYWIRE[t];
    if (hw.ops.some((op) => !['mv', 'rt'].includes(op[0]))) return [['noop']];
    return hw.ops.map((op) => (op[0] === 'mv' && op[1] === 'side' ? ['mv', prog.hw[id] === 'left' ? 3 : 1, op[2]] : op));
  }

  mapBtn.addEventListener('click', () => {
    mapMode = mapMode === 'all' ? 'near' : 'all';
    drawMap(true);
  });
  new ResizeObserver(() => drawMap(true)).observe(mapBox);
  document.fonts?.ready.then(() => drawMap(true));

  // ---------- programming (local) ----------

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
    // cards can leave the hand (Memory Swap, Calibration Protocol)
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

  function placeCard(id) {
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
    prog.regs[i] = [id];
    prog.target = null;
    api.vibrate(8);
    justPlaced = i;
    changed();
  }
  let justPlaced = -1;

  function tapRegister(i) {
    const m = me();
    if (m.done || m.regs[i].locked) return;
    if (prog.regs[i].length) {
      prog.regs[i] = [];
      prog.target = i;
    } else prog.target = prog.target === i ? null : i;
    api.vibrate(6);
    changed();
  }

  function changed() {
    saveDraft();
    render();
  }

  async function lockIn() {
    const m = me();
    const hw = {};
    for (const id of [...prog.regs.flat(), ...m.regs.flatMap((r) => r.cards)]) if (isHaywire(id) && prog.hw[id]) hw[id] = prog.hw[id];
    const res = await send('lock', { regs: prog.regs, keep: [...prog.keep], hw, rebootDir: prog.rebootDir });
    if (!res?.error) api.vibrate([10, 40, 10]);
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
        return send('setOpt', { key, value });
      }
      case 'card':
        if (view.phase === 'program' && m.mustReturn) {
          const i = prog.pick.indexOf(arg);
          if (i >= 0) prog.pick.splice(i, 1);
          else if (prog.pick.length < m.mustReturn) prog.pick.push(arg);
          return render();
        }
        return placeCard(arg);
      case 'reg':
        return tapRegister(Number(arg));
      case 'crab':
        prog.stack = Number(arg);
        return render();
      case 'keep':
        prog.keep.has(arg) ? prog.keep.delete(arg) : prog.keep.add(arg);
        return changed();
      case 'hw': {
        const [card, choice] = arg.split('=');
        prog.hw[card] = choice;
        return changed();
      }
      case 'reboot':
        prog.rebootDir = Number(arg);
        saveDraft(); // the facing travels with the draft, in case time runs out
        return render();
      case 'clear':
        prog.regs = prog.regs.map(() => []);
        prog.target = null;
        return changed();
      case 'lock':
        return lockIn();
      case 'shutdown':
        return openSheet({
          head: raw(`<span class="pp-big">${I.power}</span>`),
          demo: 'shutdown',
          options: [
            { label: raw(`<span class="pp-big">${I.power}</span>`), main: true, run: () => send('lock', { shutdown: true, rebootDir: prog.rebootDir }) },
            { label: raw(`<span class="pp-big">${I.clear}</span>`), run: () => {} },
          ],
        });
      case 'return':
        if (prog.pick.length !== m.mustReturn) return;
        await send('ret', { cards: prog.pick });
        prog.pick = [];
        return;
      case 'install': {
        const u = UPGRADES[arg];
        const slots = u.kind === 'perm' ? m.up.perm : m.up.temp;
        if (slots.length < 3) return send('install', { card: arg });
        return openSheet({
          head: html`<span class="pp-big">${upgradeIcon(arg)}</span><span class="pp-big">⇄</span>`,
          options: [
            ...slots.map((k) => ({ label: html`<span class="pp-big">${upgradeIcon(k)}</span><small>${UPGRADES[k].name}</small>`, run: () => send('install', { card: arg, replace: k }) })),
            { label: raw(`<span class="pp-big">${I.clear}</span>`), run: () => {} },
          ],
        });
      }
      case 'uninstall':
        return openSheet({
          head: html`<span class="pp-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg].name}</small>`,
          options: [
            { label: raw(`<span class="pp-big">${I.trash}</span>`), main: true, run: () => send('uninstall', { card: arg }) },
            { label: raw(`<span class="pp-big">${I.clear}</span>`), run: () => {} },
          ],
        });
      case 'use':
        if (arg === 're-initialize') {
          return openSheet({
            head: html`<span class="pp-big">${upgradeIcon(arg)}</span>`,
            demo: 're-initialize',
            options: [...view.robots.map((r) => ({ label: html`${face(r)}<small>${r.name}</small>`, run: () => send('use', { card: arg, target: r.id }) })), { label: raw(`<span class="pp-big">${I.clear}</span>`), run: () => {} }],
          });
        }
        return send('use', { card: arg });
      case 'info':
        return openSheet({ head: html`<span class="pp-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg]?.name ?? ''}</small>`, demo: arg, note: UPGRADES[arg]?.text, options: [{ label: raw(`<span class="pp-big">${I.check}</span>`), main: true, run: () => {} }] });
      case 'cardinfo':
        return openSheet({ head: cardHtml(arg, { cls: 'pp-card-lg' }), demo: cardType(arg), note: HAYWIRE[cardType(arg)]?.text ?? HAYWIRE[cardType(arg)]?.name, options: [{ label: raw(`<span class="pp-big">${I.check}</span>`), main: true, run: () => {} }] });
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
    }
  });

  // hold a haywire card in your hand to see what it does
  let pressT = null;
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.pp-card.haywire[data-ui="card"]');
    if (!el) return;
    pressT = setTimeout(() => {
      pressT = null;
      el.dataset.held = '1';
      openSheet({ head: cardHtml(el.dataset.arg, { cls: 'pp-card-lg' }), demo: cardType(el.dataset.arg), note: HAYWIRE[cardType(el.dataset.arg)]?.text, options: [{ label: raw(`<span class="pp-big">${I.check}</span>`), main: true, run: () => {} }] });
    }, 550);
  });
  const cancelPress = () => {
    clearTimeout(pressT);
    pressT = null;
  };
  root.addEventListener('pointerup', cancelPress);
  root.addEventListener('pointercancel', cancelPress);
  root.addEventListener('click', (e) => {
    const held = e.target.closest('[data-held]');
    if (held) {
      delete held.dataset.held;
      e.stopImmediatePropagation();
    }
  }, true);

  function openSheet(s) {
    localSheet = s;
    render();
  }

  // ---------- drawing ----------

  function render() {
    if (!view) return;
    const m = me();
    if (m && view.phase === 'program') syncProgram();
    shell.dataset.phase = view.phase;
    const showMap = view.inRace && m && view.phase === 'program' && !m.done && !m.mustReturn;
    shell.classList.toggle('with-map', !!showMap);
    mapBox.hidden = !showMap;
    renderTop(m);
    set(body, renderBody(m));
    renderSheet();
    if (showMap) drawMap();
    justPlaced = -1;
  }

  function renderTop(m) {
    const timed = ['start', 'upgrade', 'program'].includes(view.phase) && view.deadline && (view.phase !== 'program' || view.opts.timer);
    const quiet = view.phase === 'activate' || view.phase === 'over' || view.phase === 'setup';
    set(top, html`
      ${m && !quiet && html`<span class="pp-flags">${Array.from({ length: view.cps }, (_, i) => html`<i class="${i < m.cp && 'got'} ${i === m.cp && 'next'}">${i + 1}</i>`)}</span>`}
      ${m && view.opts.upgrades && !quiet && html`<span class="pp-stat en">${raw(I.bolt)}${m.en}</span>`}
      ${m && m.spam > 0 && !quiet && html`<span class="pp-stat spam"><i></i>${m.spam}</span>`}
      <span class="pp-spacer"></span>
      ${timed && html`<span class="pp-time" data-deadline="${view.deadline}"></span>`}`);
  }

  function renderBody(m) {
    if (!view.inRace && view.phase !== 'setup') return lookUp();
    switch (view.phase) {
      case 'setup': return renderSetup();
      case 'start': return renderStart();
      case 'upgrade': return renderUpgrade(m);
      case 'program': return renderProgram(m);
      case 'activate': return renderActivate(m);
      case 'over': return renderOver(m);
    }
    return '';
  }

  const lookUp = (extra = '') => html`<div class="pp-rest">${extra}<span class="pp-lookup">${raw(I.up)}</span></div>`;

  function renderSetup() {
    const o = view.opts;
    if (!api.you?.isVip) return html`<div class="pp-rest">${face(api.you, 'pp-face')}<i class="ph-pulse"></i></div>`;
    const tog = (key, demoKey) => html`
      <button class="pp-opt ${o[key] && 'on'}" data-ui="opt" data-arg="${key}=${String(!o[key])}">${demo(demoKey)}<i></i></button>`;
    return html`
      <div class="pp-setup">
        <div class="pp-courses">
          ${COURSES.filter((x) => x.id !== 'lab').map((x) => html`
            <button class="pp-course ${x.id === o.course && 'on'}" data-ui="opt" data-arg="course=${x.id}">
              <img alt="" src="${thumb(x.id)}">
              <span class="pp-course-name">${x.name}</span>
              <span class="pp-course-meta"><span class="pp-level">${[1, 2, 3, 4].map((i) => html`<i class="${i <= (LEVEL[x.level] ?? 1) && 'on'}"></i>`)}</span><span class="pp-cps">${x.checkpoints.length}</span></span>
            </button>`)}
        </div>
        <div class="pp-opts">
          ${tog('upgrades', 'upgrades')}
          ${tog('lessDeadly', 'safe-edges')}
          ${tog('lessSpam', 'less-spam')}
        </div>
        <div class="pp-seg">${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-ui="opt" data-arg="timer=${t}">${t ? `${t / 60}′` : '∞'}</button>`)}</div>
      </div>
      <div class="pp-foot"><button class="pp-go" data-action="begin" aria-label="Start">${raw(I.play)}</button></div>`;
  }

  /** The loading dock, laid out the way it sits on the big screen: tap a bay. */
  function renderStart() {
    const c = course();
    const taken = new Map(view.robots.filter((r) => r.pick != null).map((r) => [r.pick, r]));
    // the bays where they sit on the dock (empty rows and columns squeezed out); a wide dock stands up
    const xs = [...new Set(c.starts.map((s) => s.x))].sort((a, b) => a - b);
    const ys = [...new Set(c.starts.map((s) => s.y))].sort((a, b) => a - b);
    const tall = xs.length <= 4;
    const cols = tall ? xs.length : ys.length;
    const rows = tall ? ys.length : xs.length;
    const at = (st) => (tall ? [xs.indexOf(st.x) + 1, ys.indexOf(st.y) + 1] : [ys.indexOf(st.y) + 1, xs.indexOf(st.x) + 1]);
    return html`
      <div class="pp-dock" style="--cols:${cols};--rows:${rows}">
        ${c.starts.map((st) => {
          const r = taken.get(st.n);
          const mine = r?.id === api.you?.id;
          const [gc, gr] = at(st);
          return html`<button class="pp-bay ${mine && 'mine'} ${r && !mine && 'taken'}" style="grid-column:${gc};grid-row:${gr};${r ? `--c:${paint(r.color)}` : ''}" ${r && !mine ? 'disabled' : ''} data-action="pick" data-payload="${JSON.stringify({ n: st.n })}">
            <b>${st.n}</b>${r ? face(r) : ''}</button>`;
        })}
      </div>`;
  }

  function renderUpgrade(m) {
    if (m.done) return html`${renderInstalled(m, false)}${lookUp(html`<span class="pp-done">${raw(I.check)}</span>`)}`;
    const usable = m.up.temp.filter((k) => ['any', 'upgrade', 'program'].includes(UPGRADES[k].when));
    return html`
      <div class="pp-shop">
        <div class="pp-energy">${raw(I.bolt)}<b>${m.en}</b></div>
        <button class="pp-draw" data-action="buy" ${m.bought || m.en < 1 ? 'disabled' : ''}>
          <span class="pp-card back"></span><span class="pp-draw-plus">${raw(I.plus)}</span><span class="pp-cost">${raw(I.bolt)}1</span>
        </button>
      </div>
      ${m.up.hand.length > 0 && html`
        <div class="pp-ups">
          ${m.up.hand.map((k) => upgradeTile(k, html`<button class="pp-add" data-ui="install" data-arg="${k}" ${m.installed || UPGRADES[k].cost > m.en ? 'disabled' : ''} aria-label="Install">${raw(I.plus)}</button>`))}
        </div>`}
      ${renderInstalled(m, true, usable)}
      <div class="pp-foot"><button class="pp-go" data-action="done" aria-label="Done">${raw(I.check)}</button></div>`;
  }

  function renderInstalled(m, editable, usable = []) {
    if (!m.up.perm.length && !m.up.temp.length) return '';
    return html`
      <div class="pp-installed">
        ${[...m.up.perm, ...m.up.temp].map((k) => html`
          <div class="pp-inst ${UPGRADES[k].kind}">
            <button class="pp-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button>
            <small>${UPGRADES[k].name}</small>
            ${usable.includes(k) && html`<button class="pp-mini" data-ui="use" data-arg="${k}" aria-label="Use">${raw(I.play)}</button>`}
            ${k === 'deflector-shield' && html`<button class="pp-mini ${m.autoShield && 'on'}" data-action="shield" data-payload="${JSON.stringify({ on: !m.autoShield })}">🛡️</button>`}
            ${editable && html`<button class="pp-mini x" data-ui="uninstall" data-arg="${k}" aria-label="Remove">${raw(I.clear)}</button>`}
          </div>`)}
      </div>`;
  }

  /** The five frames of your program. */
  function strip(m, { live = false, now = -1, small = false } = {}) {
    const nextTarget = live ? prog.target ?? freeRegs()[0] : null;
    const hasCrab = m.up.perm.includes('crab-legs');
    return html`
      <div class="pp-strip ${small && 'small'}">
        ${[0, 1, 2, 3, 4].map((i) => {
          const r = m.regs[i];
          const list = live ? (r.locked ? r.cards : prog.regs[i]) : r.cards.length ? r.cards : prog.regs[i];
          const canStack = live && hasCrab && list.length === 1 && ['rl', 'rr'].includes(cardType(list[0]));
          return html`
            <div class="pp-frame ${nextTarget === i && !list.length && 'target'} ${r.locked && 'locked'} ${prog.stack === i && 'stacking'} ${i === now && 'now'} ${now > i && 'past'} ${list.length && 'full'} ${justPlaced === i && 'drop'}" ${live ? html`data-ui="reg" data-arg="${i}"` : ''}>
              ${list.length ? html`<span class="pp-stack n${list.length}">${list.map((id) => cardHtml(id))}</span>` : html`<i>${i + 1}</i>`}
              ${r.next && html`<span class="pp-hw-next">${raw(I.bolt)}</span>`}
              ${canStack && html`<button class="pp-crab" data-ui="crab" data-arg="${i}">🦀</button>`}
            </div>`;
        })}
      </div>`;
  }

  function renderProgram(m) {
    if (m.done) {
      return html`
        ${!m.wantSd ? strip(m) : html`<div class="pp-rest"><span class="pp-big">${raw(I.power)}</span></div>`}
        ${lookUp(html`<span class="pp-done">${raw(I.lock)}</span>`)}
        <div class="pp-foot"><button class="pp-ghost" data-action="unlock" aria-label="Change">${raw(I.edit)}</button></div>`;
    }
    if (m.mustReturn) {
      return html`
        <div class="pp-return">
          <span class="pp-return-head">${Array.from({ length: m.mustReturn }, () => html`<span class="pp-card back"></span>`)}<span class="pp-up-arrow">↑</span></span>
          <div class="pp-hand">${m.hand.map((id) => cardHtml(id, { cls: prog.pick.includes(id) ? 'picked' : '', ui: 'card', n: prog.pick.indexOf(id) + 1 || '' }))}</div>
        </div>
        <div class="pp-foot"><button class="pp-go" data-ui="return" ${prog.pick.length !== m.mustReturn ? 'disabled' : ''} aria-label="Done">${raw(I.check)}</button></div>`;
    }
    const used = placed();
    const hasMemory = m.up.perm.includes('memory-cards');
    const usable = m.up.temp.filter((k) => ['any', 'program'].includes(UPGRADES[k].when));
    const hwInRegs = [...new Set([...prog.regs.flat(), ...m.regs.flatMap((r) => (r.locked ? r.cards : []))])].filter((id) => HAYWIRE[cardType(id)]?.choice);
    const permsToInstall = m.up.hand.filter((k) => UPGRADES[k].kind === 'perm');
    const firstTime = view.round === 1 && !prog.regs.flat().length;
    const full = programFull();
    return html`
      ${m.rb && html`
        <div class="pp-reboot">
          <span class="pp-reboot-ic">${raw(I.reboot)}</span>
          <div class="pp-dirs">${[0, 1, 2, 3].map((d) => html`<button class="${prog.rebootDir === d && 'on'}" data-ui="reboot" data-arg="${d}">${ARROW[d]}</button>`)}</div>
        </div>`}
      ${strip(m, { live: true })}
      ${hwInRegs.map((id) => {
        const t = cardType(id);
        if (HAYWIRE[t].choice === 'side') {
          return html`<div class="pp-choice">${cardHtml(id)}${['left', 'right'].map((s) => html`<button class="${(prog.hw[id] ?? 'right') === s && 'on'}" data-ui="hw" data-arg="${id}=${s}">${s === 'left' ? '⬅' : '➡'}</button>`)}</div>`;
        }
        if (!permsToInstall.length) return '';
        return html`<div class="pp-choice">${cardHtml(id)}${permsToInstall.map((k) => html`<button class="${(prog.hw[id] ?? permsToInstall[0]) === k && 'on'}" data-ui="hw" data-arg="${id}=${k}">${upgradeIcon(k)}</button>`)}</div>`;
      })}
      <div class="pp-hand ${full && 'full'}">
        ${m.hand.map((id, n) => {
          if (used.has(id)) return html`<span class="pp-slot"></span>`;
          const keepable = hasMemory && full && !isDamage(id);
          return html`<span class="pp-slot">
            ${cardHtml(id, { ui: 'card', cls: firstTime && n === 0 ? 'hint' : '' })}
            ${keepable && html`<button class="pp-keep ${prog.keep.has(id) && 'on'}" data-ui="keep" data-arg="${id}">🗂️</button>`}
          </span>`;
        })}
      </div>
      ${m.peek && html`<div class="pp-peek"><span>👁</span>${cardHtml(m.peek)}</div>`}
      ${usable.length > 0 && html`<div class="pp-installed">${usable.map((k) => html`
        <div class="pp-inst temp"><button class="pp-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button><small>${UPGRADES[k].name}</small><button class="pp-mini" data-ui="use" data-arg="${k}" aria-label="Use">${raw(I.play)}</button></div>`)}</div>`}
      <div class="pp-foot pp-actions">
        <button class="pp-ghost" data-ui="clear" aria-label="Clear" ${prog.regs.flat().length ? '' : 'disabled'}>${raw(I.clear)}</button>
        <button class="pp-go pp-lock" data-ui="lock" ${full ? '' : 'disabled'} aria-label="Lock in">${raw(I.lock)}</button>
        <button class="pp-ghost" data-ui="shutdown" aria-label="Shut down">${raw(I.power)}</button>
      </div>`;
  }

  /** The race: nearly dark. Only the frame that's playing lights up. */
  function renderActivate(m) {
    const armable = m.canArm && m.on && m.up.temp.filter((k) => ['move', 'turn'].includes(UPGRADES[k].when));
    const state = !m.on ? (m.rb ? 'rb' : 'fell') : m.sd ? 'off' : '';
    return html`
      <div class="pp-rest dim ${state}">
        ${state === 'rb' || state === 'fell' ? html`<span class="pp-big pp-spin">${raw(I.reboot)}</span>` : state === 'off' ? html`<span class="pp-big">${raw(I.power)}</span>` : html`<span class="pp-lookup">${raw(I.up)}</span>`}
      </div>
      ${armable?.length > 0 && html`
        <button class="pp-arm ${m.armed && 'on'}" data-action="arm" data-payload="${JSON.stringify({ on: !m.armed })}">
          ${armable.map((k) => html`<span>${upgradeIcon(k)}</span>`)}<i>${m.armed ? raw(I.check) : ''}</i>
        </button>`}
      ${strip(m, { now: view.reg, small: true })}`;
  }

  function renderOver(m) {
    const w = robotById(view.winner);
    const won = view.winner === api.you?.id;
    return html`
      <div class="pp-over ${won && 'won'}" style="--c:${paint(w?.color)}">
        ${w && html`${face(w, 'pp-winner')}<div class="pp-winner-name">${w.name}</div>`}
        ${won && html`<span class="pp-trophy">${raw(I.trophy)}</span>`}
        ${m && html`<div class="pp-mystats"><span><i class="f"></i>${m.cp}/${view.cps}</span><span>${raw(I.push)}${m.stats.pushes}</span><span>${raw(I.hit)}${m.stats.hits}</span><span>${raw(I.fall)}${m.stats.falls}</span></div>`}
      </div>
      ${api.you?.isVip && html`<div class="pp-foot"><button class="pp-go" data-action="finish" aria-label="Back to the lobby">${raw(I.home)}</button></div>`}`;
  }

  function renderSheet() {
    const p = view.prompt;
    if (p) {
      const key = `${p.kind}:${p.deadline}`;
      if (key !== lastPromptKey) {
        lastPromptKey = key;
        api.vibrate([30, 60, 30]);
      }
      sheet.hidden = false;
      set(sheet, html`
        <div class="pp-sheet-box">
          <div class="pp-sheet-head">${promptHead(p)}<span class="pp-time" data-deadline="${p.deadline}"></span></div>
          ${p.icon && demo(p.icon, 'wide')}
          <div class="pp-sheet-opts ${p.options.length > 3 && 'grid'}">
            ${p.options.map((o) => html`<button class="pp-opt-btn ${['go', 'main', 'no', 'skip'].includes(o.v) && 'quiet'}" data-ui="answer" data-arg="${o.v}">${optionPicture(p, o)}</button>`)}
          </div>
        </div>`);
      return;
    }
    lastPromptKey = null;
    if (localSheet) {
      sheet.hidden = false;
      set(sheet, html`
        <div class="pp-sheet-box">
          <div class="pp-sheet-head">${localSheet.head}</div>
          ${localSheet.demo && demo(localSheet.demo, 'wide')}
          ${localSheet.note && html`<p class="pp-note">${localSheet.note}</p>`}
          <div class="pp-sheet-opts ${localSheet.options.length > 3 && 'grid'}">
            ${localSheet.options.map((o, i) => html`<button class="pp-opt-btn ${o.main && 'main'}" data-ui="sheet" data-arg="${i}">${o.label}</button>`)}
          </div>
        </div>`);
      return;
    }
    sheet.hidden = true;
    set(sheet, '');
  }

  function promptHead(p) {
    if (p.kind === 'window') return html`<span class="pp-big">${raw(I.bolt)}</span>${(p.card ?? []).map((t) => cardHtml(t))}`;
    if (p.kind === 'weapon') return html`<span class="pp-big">🎯</span>${face(robotById(p.target))}`;
    return html`<span class="pp-big">${upgradeIcon(p.icon)}</span><small>${UPGRADES[p.icon]?.name ?? ''}</small>`;
  }

  /** A choice as a picture (with a word only where a picture can't say it). */
  function optionPicture(p, o) {
    const [k, arg] = String(o.v).split(':');
    const rel = (d) => ARROW[d];
    const no = raw(`<span class="pp-big">${I.clear}</span>`);
    switch (p.kind) {
      case 'window':
        if (k === 'go') return html`<span class="pp-big">${raw(I.play)}</span>${(p.card ?? []).map((t) => cardHtml(t))}`;
        if (k === 'after') return html`<span class="pp-big">${raw(I.play)} → ${raw(I.bolt)}</span>`;
        if (k === 'skip') return no;
        if (k === 'boink') return html`<span class="pp-big">🦘${rel(Number(arg))}</span>`;
        if (k === 'zoop') return html`<span class="pp-big">🧭${rel(Number(arg))}</span>`;
        if (k === 'switch') return html`<span class="pp-big">🔀</span>${face(robotById(arg))}`;
        if (k === 'abort') return html`<span class="pp-big">⏏️</span>`;
        if (k === 'lucky') return html`<span class="pp-big">🍀</span>`;
        return html`<span class="pp-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'brakes':
        return k === 'brake' ? html`<span class="pp-big">🛑</span>` : cardHtml('m1');
      case 'slide':
        return k === 'yes' ? html`<span class="pp-big">⬆</span>` : no;
      case 'econv':
        return k === 'no' ? no : html`<span class="pp-big">${{ fwd: '⬆', back: '⬇' }[k]}</span>`;
      case 'weapon':
        return k === 'main' ? html`<span class="pp-big pp-laser"></span>` : html`<span class="pp-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'lucky':
        return k === 'use' ? cardHtml(p.data?.card ?? 'h01') : raw(`<span class="pp-big">${I.trash}</span>`);
      case 'pierce':
        return k === 'no' ? no : html`<span class="pp-big">${ARROW[Number(arg)]}</span>`;
      case 'chassis':
        return k === 'no' ? no : html`${face(robotById(k))}<span class="pp-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg]?.name ?? ''}</small>`;
      case 'magnet':
        return k === 'yes' ? html`<span class="pp-big">🤝${ARROW[p.data?.d ?? 0]}</span>` : no;
      case 'selfdiag':
        return k === 'no' ? no : html`${cardHtml(k)}<span class="pp-big">${raw(I.trash)}</span>`;
    }
    return html`${o.label}`;
  }

  const thumbs = new Map();
  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(5, Math.floor(150 / Math.max(c.w, c.h * 1.4)));
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
      if (!next?.opts) return;
      const before = view;
      view = next;
      if (before?.phase !== next.phase) {
        localSheet = null;
        if (next.phase === 'program' || next.phase === 'start') api.vibrate(20);
      }
      if (before && next.phase === 'activate' && before.reg !== next.reg && next.reg >= 0) api.vibrate(6);
      render();
    },
    destroy() {
      clearTimeout(draftTimer);
    },
  };
}

function clamp(v, lo, hi) {
  return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v));
}
