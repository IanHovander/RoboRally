// A phone in Lumen. Only what is private, as little as possible:
//   setup (the first player): choose the course · start: tap a glowing pad · upgrades: a small shop ·
//   program: tap five cards into five slots while a little light table draws where they'll take you ·
//   the race: nearly empty (your five cards, the current one lit), so everyone looks up · decisions: a sheet.
import { html, raw } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { cardType, isDamage, isHaywire, UPGRADES, HAYWIRE } from './cards.js';
import { drawCourse, previewProgram } from './minimap.js';
import { svgGlyph, cardSvgHtml, robotSvg, formOf, COURSE_TITLES, LEVELS } from './glyphs.js';
import { mountDemo, hasDemo } from './demo.js';

const TIMERS = [0, 60, 120, 180];
const ARROWS = ['m1', 'rr', 'bk', 'rl']; // a direction relative to you, as a card picture

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
  let localSheet = null; // { head, demo, note, options: [{ label, run, primary }] }
  let lastPromptKey = null;
  const prog = { key: null, regs: [[], [], [], [], []], target: null, stack: null, keep: new Set(), hw: {}, rebootDir: 1, pick: [] };
  let draftTimer = null;
  let flip = null; // a card on its way from the hand to a slot: { rect, slot }

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

  // ---------- the light table (my map) ----------

  let mapZoom = null; // 'all' | 'near'
  let mapKey = null;
  function drawMap(canvas, { force = false, near = null } = {}) {
    if (!view || !canvas) return;
    const box = canvas.parentElement;
    const m = me();
    const width = box.clientWidth || 340;
    const height = box.clientHeight || 260;
    const key = JSON.stringify([mapZoom, width, height, view.phase, view.opts.course, view.robots.map((r) => [r.x, r.y, r.d, r.on, r.away]), m && [m.x, m.y, m.d, m.on, m.cp, m.done], prog.regs, prog.hw, prog.rebootDir]);
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
    const from = m?.on ? m : m?.rb && m.rbAt ? { ...m.rbAt, d: prog.rebootDir } : null;
    if (from) focus = { x: from.x + 0.5, y: from.y + 0.5 };
    let ox = (width - tile * c.w) / 2;
    let oy = (height - tile * c.h) / 2;
    if (zoom === 'near') {
      ox = Math.round(clamp(width / 2 - focus.x * tile, width - tile * c.w, 0));
      oy = Math.round(clamp(height / 2 - focus.y * tile, height - tile * c.h, 0));
    }
    const ghosts = view.phase === 'program' && from && !m.mustReturn
      ? previewProgram(c, from, [0, 1, 2, 3, 4].map((i) => (m.regs[i].locked ? m.regs[i].cards : prog.regs[i]).flatMap(previewType)), { lessDeadly: view.opts.lessDeadly })
      : [];
    const robots = view.robots.filter((r) => r.x != null && r.on !== false).map((r) => ({ ...r, me: r.id === api.you?.id }));
    if (from && !m.on && view.phase === 'program') robots.push({ ...from, on: true, me: true, color: api.you?.color ?? '#fff', avatar: api.you?.avatar });
    drawCourse(ctx, c, { tile, ox, oy, robots, ghosts, ghostColor: api.you?.color, cpNext: m ? m.cp + 1 : null, cpDone: (n) => (m ? n <= m.cp : false) });
    canvas.dataset.zoom = zoom;
    return { tile, ox, oy, zoom, fit };
  }

  /** What the preview should assume a card does. Unknown things (SPAM) stop the preview. */
  function previewType(id) {
    const t = cardType(id);
    if (!isHaywire(id)) return [t];
    const hw = HAYWIRE[t];
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
      case 'clear':
        prog.regs = prog.regs.map(() => []);
        prog.target = null;
        return changed();
      case 'lock':
        return lockIn();
      case 'zoom':
        mapZoom = (body.querySelector('.pl-map canvas')?.dataset.zoom ?? 'all') === 'all' ? 'near' : 'all';
        return render();
      case 'shutdown':
        return openSheet({
          head: html`<span class="pl-sheet-ic">${g('power')}</span>`,
          demo: 'shutdown',
          options: [
            { label: g('power'), primary: true, run: () => send('lock', { shutdown: true, rebootDir: prog.rebootDir }) },
            { label: g('cross'), run: () => {} },
          ],
        });
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
      case 'close':
        localSheet = null;
        return render();
    }
  });

  function openSheet(s) {
    localSheet = s;
    render();
  }

  function openUpgrade(key) {
    const m = me();
    const u = UPGRADES[key];
    const slots = u.kind === 'perm' ? m.up.perm : m.up.temp;
    const afford = m.en >= u.cost && !m.installed;
    const install = slots.length < 3
      ? [{ label: html`${g('plus')}<span class="pl-cost">${g('bolt')}${u.cost}</span>`, primary: true, disabled: !afford, run: () => send('install', { card: key }) }]
      : slots.map((k) => ({ label: html`${g('swap')}<span class="pl-opt-name">${UPGRADES[k].name}</span>`, disabled: !afford, run: () => send('install', { card: key, replace: k }) }));
    openSheet({ head: html`<b class="pl-up-title">${u.name}</b><span class="pl-kind ${u.kind}">${u.kind === 'perm' ? '∞' : '1×'}</span>`, demo: key, note: u.text, options: [...install, { label: g('cross'), run: () => {} }] });
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
    openSheet({ head: html`<b class="pl-up-title">${u.name}</b><span class="pl-kind ${u.kind}">${u.kind === 'perm' ? '∞' : '1×'}</span>`, demo: key, note: u.text, options: opts });
  }

  // ---------- drawing ----------

  function render() {
    if (!view) return;
    const m = me();
    if (m && view.phase === 'program') syncProgram();
    pl.dataset.phase = view.phase;
    renderTop(m);
    renderBody(m);
    renderSheet();
  }

  function renderTop(m) {
    const timed = ['start', 'upgrade', 'program'].includes(view.phase) && view.deadline && (view.phase !== 'program' || view.opts.timer);
    set(top, html`
      ${api.you && raw(robotSvg(api.you, { cls: 'pl-me' }))}
      ${m && html`<span class="pl-flags">${Array.from({ length: view.cps }, (_, i) => html`<i class="${i < m.cp && 'on'}"></i>`)}</span>`}
      <span class="pl-spacer"></span>
      ${m && view.opts.upgrades && view.phase === 'program' && html`<span class="pl-en">${g('bolt')}${m.en}</span>`}
      ${m && m.spam > 0 && ['upgrade', 'program'].includes(view.phase) && html`<span class="pl-spam">${card('sp', 'xs')}<b>${m.spam}</b></span>`}
      ${timed && html`<span class="pl-timer timer" data-deadline="${view.deadline}"></span>`}`);
  }

  function renderBody(m) {
    if (!view.inRace && view.phase !== 'setup') return layout('watch', () => html`<div class="pl-watch">${g('eye')}</div>`);
    switch (view.phase) {
      case 'setup': return renderSetup();
      case 'start': return renderStart();
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
  function renderSetup() {
    if (!api.you?.isVip) {
      return layout('setup-wait', () => html`<div class="pl-watch">${g('eye')}</div>`);
    }
    layout('setup', () => html`
      <div class="pl-setup">
        <div class="pl-course">
          <button class="pl-arrow" data-ui="course" data-arg="-1" aria-label="Previous course">${g('left')}</button>
          <div class="pl-course-card"></div>
          <button class="pl-arrow next" data-ui="course" data-arg="1" aria-label="Next course">${g('right')}</button>
        </div>
        <div class="pl-opts"></div>
        <button class="pl-cta" data-action="begin" aria-label="Start">${g('play')}</button>
      </div>`);
    const o = view.opts;
    const sel = COURSES.find((x) => x.id === o.course) ?? COURSES[0];
    const lvl = LEVELS[sel.level] ?? 1;
    set(body.querySelector('.pl-course-card'), html`
      <img alt="" src="${thumb(sel.id)}">
      <b>${COURSE_TITLES[sel.id] ?? sel.name}</b>
      <span class="pl-course-meta"><span class="pl-dots">${[1, 2, 3, 4].map((i) => html`<i class="${i <= lvl && 'on'}"></i>`)}</span><span>${g('flag')}${sel.checkpoints.length}</span></span>`);
    const tog = (key, glyph) => html`<button class="pl-opt ${o[key] && 'on'}" data-ui="opt" data-arg="${key}=${String(!o[key])}" aria-pressed="${String(!!o[key])}">${g(glyph)}</button>`;
    set(body.querySelector('.pl-opts'), html`
      ${tog('upgrades', 'bolt')}${tog('lessDeadly', 'wall')}${tog('lessSpam', 'sp')}
      <span class="pl-seg">${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-ui="opt" data-arg="timer=${t}">${t ? t / 60 : g('inf')}</button>`)}</span>`);
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

  // ----- start: tap a glowing pad on the dock -----
  function renderStart() {
    layout('start', () => html`<div class="pl-start"><div class="pl-dock-box"><div class="pl-dock-wrap"><canvas class="pl-dock"></canvas><div class="pl-pads"></div></div></div></div>`);
    const cv = body.querySelector('canvas.pl-dock');
    const box = body.querySelector('.pl-dock-box');
    const c = course();
    const dock = c.boards.find((b) => b.dock) ?? { x: 0, y: 0, w: c.w, h: c.h };
    // the dock and a little of the floor beside it
    const tall = dock.h > dock.w;
    const view0 = tall ? { x: dock.x, y: dock.y, w: dock.w + 2, h: dock.h } : { x: dock.x, y: dock.y - 2, w: dock.w, h: dock.h + 2 };
    const W = box.clientWidth || 340;
    const H = box.clientHeight || 500;
    const tile = Math.floor(Math.min(W / view0.w, H / view0.h, 72));
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
    // each start space is a button: free ones glow, taken ones show their robot
    const taken = new Map(view.robots.filter((r) => r.pick != null).map((r) => [r.pick, r]));
    const mine = view.robots.find((r) => r.id === api.you?.id)?.pick;
    set(body.querySelector('.pl-pads'), html`${c.starts.map((st) => {
      const r = taken.get(st.n);
      const isMe = r && r.id === api.you?.id;
      const style = `left:${ox + st.x * tile}px;top:${oy + st.y * tile}px;width:${tile}px;height:${tile}px;${r ? `--c:${r.color}` : ''}`;
      return html`<button class="pl-pad ${r ? (isMe ? 'mine' : 'taken') : 'free'} ${mine != null && !r && 'quiet'}" style="${style}" ${r && !isMe ? 'disabled' : ''} data-action="pick" data-payload="${JSON.stringify({ n: st.n })}" aria-label="Start ${st.n}">
        ${r ? bot(r) : html`<span>${st.n}</span>`}
      </button>`;
    })}`);
  }

  // ----- upgrades: a small shop -----
  function renderUpgrade(m) {
    if (m.done) {
      layout('upgrade-done', () => html`<div class="pl-done"><div class="pl-done-mark">${g('check')}</div><div class="pl-installed"></div></div>`);
      set(body.querySelector('.pl-installed'), installed(m));
      return;
    }
    layout('upgrade', () => html`
      <div class="pl-shop">
        <div class="pl-shop-head"><span class="pl-energy">${g('bolt')}<b></b></span></div>
        <div class="pl-ups"></div>
        <div class="pl-installed"></div>
        <button class="pl-cta" data-action="done" aria-label="Done">${g('check')}</button>
      </div>`);
    set(body.querySelector('.pl-energy b'), m.en);
    const canDraw = !m.bought && m.en >= 1;
    set(body.querySelector('.pl-ups'), html`
      <button class="pl-draw" data-action="buy" ${canDraw ? '' : 'disabled'} aria-label="Draw an upgrade">
        <span class="pl-draw-card">${g('plus')}</span><span class="pl-cost">${g('bolt')}1</span>
      </button>
      ${m.up.hand.map((k) => {
        const u = UPGRADES[k];
        const can = !m.installed && m.en >= u.cost;
        return html`<button class="pl-up ${u.kind} ${!can && 'cant'}" data-ui="up" data-arg="${k}">
          ${demo(k)}<span class="pl-up-name">${u.name}</span><span class="pl-cost">${g('bolt')}${u.cost}</span>
        </button>`;
      })}`);
    set(body.querySelector('.pl-installed'), installed(m));
  }

  /** My installed upgrades: three permanent slots, three one-use slots. */
  function installed(m) {
    if (!m.up.perm.length && !m.up.temp.length) return '';
    const slot = (k, kind) => (k
      ? html`<button class="pl-slot-up ${kind}" data-ui="inst" data-arg="${k}">${demo(k, 'tiny')}<span>${UPGRADES[k].name}</span></button>`
      : html`<span class="pl-slot-up empty ${kind}"></span>`);
    return html`
      <div class="pl-inst-row">${[0, 1, 2].map((i) => slot(m.up.perm[i], 'perm'))}</div>
      <div class="pl-inst-row">${[0, 1, 2].map((i) => slot(m.up.temp[i], 'temp'))}</div>`;
  }

  // ----- programming -----
  function renderProgram(m) {
    if (m.mustReturn) {
      layout('return', () => html`<div class="pl-return"><div class="pl-return-head">${g('hand')}<b></b></div><div class="pl-hand"></div><button class="pl-cta" data-ui="return">${g('check')}</button></div>`);
      set(body.querySelector('.pl-return-head b'), `${prog.pick.length}/${m.mustReturn}`);
      set(body.querySelector('.pl-hand'), html`${m.hand.map((id) => html`<button class="pl-card ${prog.pick.includes(id) && 'picked'}" data-ui="card" data-arg="${id}">${card(id)}${prog.pick.includes(id) && html`<i class="pl-pick-n">${prog.pick.indexOf(id) + 1}</i>`}</button>`)}`);
      body.querySelector('.pl-cta').disabled = prog.pick.length !== m.mustReturn;
      return;
    }
    const fresh = layout('program', () => html`
      <div class="pl-prog">
        <div class="pl-regs"></div>
        <div class="pl-map"><canvas></canvas><div class="pl-reboot"></div><button class="pl-zoom" data-ui="zoom" aria-label="Zoom">${g('eye')}</button></div>
        <div class="pl-extra"></div>
        <div class="pl-hand"></div>
        <div class="pl-actions">
          <button class="pl-small" data-ui="clear" aria-label="Clear">${g('undo')}</button>
          <button class="pl-lock" data-ui="lock" aria-label="Lock in">${g('check')}</button>
          <button class="pl-small" data-ui="shutdown" aria-label="Shut down">${g('power')}</button>
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
      return html`<button class="pl-slot ${nextTarget === i && 'target'} ${r.locked && 'locked'} ${list.length && 'full'} ${prog.stack === i && 'stacking'}" data-ui="reg" data-arg="${i}">
        ${list.length ? list.map((id) => card(id, list.length > 1 ? 'half' : '')) : html`<i>${i + 1}</i>`}
        ${canStack && html`<span class="pl-crab" data-ui="crab" data-arg="${i}">${g('plus')}</span>`}
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
        ? html`<span class="pl-chip">${card(id, 'xs')}${['left', 'right'].map((s) => html`<button class="${(prog.hw[id] ?? 'right') === s && 'on'}" data-ui="hw" data-arg="${id}=${s}">${g(s === 'left' ? 'rl' : 'rr')}</button>`)}</span>`
        : perms.length ? html`<span class="pl-chip">${card(id, 'xs')}${perms.map((k) => html`<button class="${(prog.hw[id] ?? perms[0]) === k && 'on'}" data-ui="hw" data-arg="${id}=${k}">${UPGRADES[k].name}</button>`)}</span>` : '')}
      ${m.peek && html`<span class="pl-chip peek">${g('eye')}${card(m.peek, 'xs')}</span>`}
      ${usable.map((k) => html`<button class="pl-chip" data-ui="inst" data-arg="${k}">${demo(k, 'tiny')}<span>${UPGRADES[k].name}</span></button>`)}`);
    const used = placed();
    const hasMemory = m.up.perm.includes('memory-cards');
    set(body.querySelector('.pl-hand'), html`${m.hand.map((id, n) => {
      const isUsed = used.has(id);
      const keepable = hasMemory && programFull() && !isDamage(id) && !isUsed;
      return html`<span class="pl-hand-slot">
        <button class="pl-card ${isUsed && 'used'} ${view.round === 1 && n === 0 && !used.size && 'hint'}" data-ui="card" data-arg="${id}" ${isUsed || done ? 'disabled' : ''}>${card(id)}</button>
        ${keepable && html`<button class="pl-keep ${prog.keep.has(id) && 'on'}" data-ui="keep" data-arg="${id}" aria-label="Keep">${g('keep')}</button>`}
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
  }

  // ----- the race: nearly nothing, so you look up -----
  function renderRun(m) {
    layout('run', () => html`
      <div class="pl-run">
        <div class="pl-regs run"></div>
        <div class="pl-look">${g('eye')}</div>
        <div class="pl-run-extra"></div>
      </div>`);
    set(body.querySelector('.pl-regs'), html`${m.regs.map((r, i) => html`
      <span class="pl-slot ${i === view.reg && 'now'} ${i < view.reg && 'past'} ${r.cards.length && 'full'}">
        ${r.cards.length ? r.cards.map((id) => card(id, r.cards.length > 1 ? 'half' : '')) : html`<i>${i + 1}</i>`}
        ${r.next && html`<span class="pl-next">${card('h01', 'xs')}</span>`}
      </span>`)}`);
    const armable = m.canArm && m.on && m.up.temp.filter((k) => ['move', 'turn'].includes(UPGRADES[k].when));
    const waiting = view.waiting && robotById(view.waiting.id);
    set(body.querySelector('.pl-run-extra'), html`
      ${!m.on && html`<div class="pl-state">${g('reboot')}</div>`}
      ${m.sd && html`<div class="pl-state">${g('power')}</div>`}
      ${waiting && html`<div class="pl-waiting">${bot(waiting)}<span class="pl-think"><i></i><i></i><i></i></span></div>`}
      ${armable?.length > 0 && html`
        <button class="pl-arm ${m.armed && 'on'}" data-action="arm" data-payload="${JSON.stringify({ on: !m.armed })}">
          ${armable.map((k) => html`<span class="pl-arm-up">${UPGRADES[k].name}</span>`)}<span class="pl-arm-state">${g(m.armed ? 'check' : 'play')}</span>
        </button>`}`);
  }

  // ----- the end -----
  function renderOver(m) {
    layout('over', () => html`<div class="pl-over"></div>`);
    const w = robotById(view.winner);
    const won = view.winner === api.you?.id;
    set(body.querySelector('.pl-over'), html`
      ${w && html`<div class="pl-winner ${won && 'me'}" style="--c:${w.color}">${bot(w, 'big')}<b>${w.name}</b>
        <span class="pl-flags big">${Array.from({ length: view.cps }, () => html`<i class="on"></i>`)}</span></div>`}
      ${m && !won && html`<div class="pl-mine"><span class="pl-flags">${Array.from({ length: view.cps }, (_, i) => html`<i class="${i < m.cp && 'on'}"></i>`)}</span></div>`}
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
      set(sheet, html`
        <div class="pl-sheet-box">
          <div class="pl-sheet-head">${promptHead(p)}<span class="pl-sheet-timer timer" data-deadline="${p.deadline}"></span></div>
          ${p.icon && demo(p.icon, 'wide')}
          <div class="pl-sheet-opts ${p.options.length > 3 && 'grid'}">
            ${p.options.map((o) => html`<button class="pl-choice ${['go', 'main'].includes(o.v) && 'main'} ${['no', 'skip'].includes(o.v) && 'quiet'}" data-ui="answer" data-arg="${o.v}">${optionPicture(p, o)}</button>`)}
          </div>
        </div>`);
      return;
    }
    lastPromptKey = null;
    if (localSheet) {
      sheet.hidden = false;
      set(sheet, html`
        <div class="pl-sheet-box">
          <div class="pl-sheet-head">${localSheet.head}</div>
          ${localSheet.demo && demo(localSheet.demo, 'wide')}
          ${localSheet.note && html`<p class="pl-note">${localSheet.note}</p>`}
          <div class="pl-sheet-opts ${localSheet.options.length > 3 && 'grid'}">
            ${localSheet.options.map((o, i) => html`<button class="pl-choice ${o.primary && 'main'} ${i === localSheet.options.length - 1 && localSheet.options.length > 1 && 'quiet'}" data-ui="sheet" data-arg="${i}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`)}
          </div>
        </div>`);
      return;
    }
    sheet.hidden = true;
    set(sheet, '');
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
        return word(o.label);
      case 'brakes':
        return k === 'brake' ? html`${g('cross')}${word('0')}` : card('m1', 'xs');
      case 'slide':
        return k === 'yes' ? card('m1', 'xs') : g('cross');
      case 'econv':
        return k === 'no' ? g('cross') : card(k === 'fwd' ? 'm1' : 'bk', 'xs');
      case 'weapon':
        return k === 'main' ? html`<span class="pl-beam"></span>` : word(o.label);
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
  window.lumenPhone = { view: () => view, course: () => view && course() };

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      const before = view;
      view = next;
      if (before?.phase !== next.phase) {
        localSheet = null;
        pl.classList.remove('locked');
        if (next.phase === 'program' || next.phase === 'start') api.vibrate(20);
      }
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
