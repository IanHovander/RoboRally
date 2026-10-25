// A phone: only what's private. Choosing the course (the leader), a start space, the upgrade shop,
// and programming your five registers with a map that shows where they'd take you. While the cards
// play, the phone goes quiet (your five cards, the one playing lit) so everyone looks up at the big
// screen; it wakes up only when you have a choice to make. Pictures do the explaining.
import { html, raw } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';
import { COURSES, getCourse } from './board.js';
import { cardType, isDamage, isHaywire, UPGRADES, HAYWIRE } from './cards.js';
import { drawCourse, previewProgram } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon } from './icons.js';
import { mountDemo, hasDemo } from './demo.js';
import { glyph } from './glyphs.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const TIMERS = [0, 60, 120, 180];
const g = (name) => raw(glyph(name));
const ARROW_DIR = ['up', 'right', 'down', 'left'];

export default function (root, api) {
  root.innerHTML = `
    <div class="rr-phone">
      <div class="rr-top"></div>
      <div class="rr-map"><canvas></canvas><button class="rr-map-btn" type="button"></button></div>
      <div class="rr-panel"></div>
      <div class="rr-sheet" hidden></div>
      <div class="rr-toast" hidden></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const phone = $('.rr-phone');
  const top = $('.rr-top');
  const mapBox = $('.rr-map');
  const canvas = $('canvas');
  const mapBtn = $('.rr-map-btn');
  const panel = $('.rr-panel');
  const sheet = $('.rr-sheet');
  const toast = $('.rr-toast');

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
  const bot = (r, mood) => (r ? html`<span class="rr-av" style="--c:${r.color}">${avatar({ ...r, connected: !r.away }, mood ? { mood } : undefined)}</span>` : '');

  /** A card: just its picture, on card stock colored by its kind. */
  function cardHtml(id, { cls = '', ui = null, n = '' } = {}) {
    const attrs = ui ? html`data-ui="${ui}" data-arg="${id}" data-n="${n}"` : '';
    return html`<span class="pcard ${cardKind(id)} ${cls}" ${attrs}>${raw(cardPicture(id))}</span>`;
  }

  /** A looping explanation. The canvas starts playing once it's on the page (startDemos). */
  const demo = (key, cls = '') => (hasDemo(key) ? html`<canvas class="rr-demo ${cls}" data-demo="${key}"></canvas>` : '');
  function startDemos(el) {
    for (const c of el.querySelectorAll('canvas[data-demo]:not([data-on])')) {
      c.dataset.on = '1';
      mountDemo(c, c.dataset.demo, api.you?.color ?? '#ff922b', { safeEdges: view?.opts.lessDeadly });
    }
  }

  const energy = (n) => html`<span class="rr-en">${g('energy')}<b>${n}</b></span>`;

  /** An upgrade: its animation, picture, name and cost. */
  function upgradeTile(key, extra = '') {
    const u = UPGRADES[key];
    return html`
      <div class="rr-up ${u.kind}">
        ${demo(key)}
        <div class="rr-up-info">
          <span class="rr-up-emoji">${upgradeIcon(key)}</span>
          <b>${u.name}</b>
          <span class="rr-up-meta">${energy(u.cost)}<span class="rr-up-kind ${u.kind}">${u.kind === 'perm' ? g('infinity') : '1×'}</span></span>
        </div>
        ${extra}
      </div>`;
  }

  // ---------- the map ----------

  let mapKey = null;
  function drawMap(force = false) {
    if (!view) return;
    const m = me();
    const showMap = ['start', 'program'].includes(view.phase) && view.inRace;
    mapBox.hidden = !showMap;
    if (!showMap) return;
    const key = JSON.stringify([mapMode, mapBox.clientWidth, mapBox.clientHeight, view.phase, view.opts.course, view.robots, m && [m.x, m.y, m.d, m.on, m.cp, m.done], prog.regs, prog.hw, prog.rebootDir]);
    if (!force && key === mapKey) return;
    mapKey = key;
    const c = course();
    const width = mapBox.clientWidth || 340;
    const maxH = mapBox.clientHeight || Math.round(width * 0.62);
    const fitTile = Math.floor(Math.min(width / c.w, maxH / c.h));
    mapMode ??= fitTile >= 26 ? 'all' : 'near';
    mapBtn.hidden = fitTile >= 30;
    mapBtn.innerHTML = glyph(mapMode === 'all' ? 'zoomIn' : 'zoomOut');
    const tile = mapMode === 'all' ? fitTile : Math.max(fitTile, 34);
    const height = Math.min(maxH, tile * c.h);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const gx = canvas.getContext('2d');
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.clearRect(0, 0, width, height);

    // center on what matters to me
    let focus = { x: c.w / 2, y: c.h / 2 };
    if (m?.on) focus = { x: m.x + 0.5, y: m.y + 0.5 };
    else if (m?.rb && m.rbAt) focus = { x: m.rbAt.x + 0.5, y: m.rbAt.y + 0.5 };
    else if (view.phase === 'start' || !m) focus = { x: (c.starts[0]?.x ?? 0) + 2, y: c.h / 2 };
    let ox = (width - tile * c.w) / 2;
    let oy = (height - tile * c.h) / 2;
    if (mapMode === 'near') {
      ox = Math.round(clamp(width / 2 - focus.x * tile, width - tile * c.w, 0));
      oy = Math.round(clamp(height / 2 - focus.y * tile, height - tile * c.h, 0));
    }

    const starts = {};
    for (const r of view.robots) if (r.pick != null) starts[r.pick] = r.color;
    // where my program would take me: from my robot, or from where it comes back after a reboot
    const from = m?.on ? m : m?.rb && m.rbAt ? { ...m.rbAt, d: prog.rebootDir } : null;
    const ghosts =
      view.phase === 'program' && from && !m.done && !m.mustReturn
        ? previewProgram(c, from, [0, 1, 2, 3, 4].map((i) => (m.regs[i].locked ? m.regs[i].cards : prog.regs[i]).flatMap(previewType)), { lessDeadly: view.opts.lessDeadly })
        : [];
    const robots = view.robots.filter((r) => r.x != null).map((r) => ({ ...r, me: r.id === api.you?.id }));
    if (from && !m.on && view.phase === 'program') robots.push({ ...from, on: true, me: true, color: api.you?.color ?? '#fff' });
    drawCourse(gx, c, {
      tile,
      ox,
      oy,
      starts: view.phase === 'start' ? starts : null,
      robots,
      ghosts,
      ghostColor: api.you?.color,
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
    prog.landed = i;
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
          head: g('power'),
          demo: 'shutdown',
          options: [
            { label: g('power'), run: () => send('lock', { shutdown: true, rebootDir: prog.rebootDir }) },
            { label: g('cross'), run: () => {} },
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
        // full: pick one to swap out
        return openSheet({
          head: html`<span class="rr-big">${upgradeIcon(arg)}</span>${g('swap')}`,
          options: [
            ...slots.map((k) => ({ label: html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k].name}</small>`, run: () => send('install', { card: arg, replace: k }) })),
            { label: g('cross'), run: () => {} },
          ],
        });
      }
      case 'uninstall':
        return openSheet({
          head: html`<span class="rr-big">${upgradeIcon(arg)}</span>${g('trash')}`,
          options: [
            { label: g('trash'), run: () => send('uninstall', { card: arg }) },
            { label: g('cross'), run: () => {} },
          ],
        });
      case 'use':
        if (arg === 're-initialize') {
          return openSheet({
            head: html`${g('priority')}`,
            demo: 're-initialize',
            options: [...view.robots.map((r) => ({ label: html`${bot(r)}<small>${r.name}</small>`, run: () => send('use', { card: arg, target: r.id }) })), { label: g('cross'), run: () => {} }],
          });
        }
        return send('use', { card: arg });
      case 'info':
        return openSheet({ head: html`<span class="rr-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg]?.name ?? ''}</small>`, demo: arg, note: UPGRADES[arg]?.text, options: [{ label: g('check'), run: () => {} }] });
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

  function openSheet(s) {
    localSheet = s;
    render();
  }

  // ---------- drawing ----------

  function render() {
    if (!view) return;
    const m = me();
    if (m && view.phase === 'program') syncProgram();
    phone.dataset.phase = view.inRace || view.phase === 'setup' ? view.phase : 'watch';
    set(top, renderTop(m));
    set(panel, renderPanel(m));
    if (prog.landed != null) {
      panel.querySelector(`.rr-reg[data-arg="${prog.landed}"] .pcard`)?.classList.add('land');
      prog.landed = null;
    }
    renderSheet();
    drawMap();
  }

  function renderTop(m) {
    const timed = ['start', 'upgrade', 'program'].includes(view.phase) && view.deadline && view.inRace;
    if (!m && !timed) return '';
    return html`
      ${m && html`<span class="rr-holes" aria-label="Flags">${Array.from({ length: view.cps }, (_, k) => html`<i class="${k < m.cp && 'got'}">${k + 1}</i>`)}</span>`}
      <span class="spacer"></span>
      ${m && m.spam > 0 && html`<span class="rr-stat spam">${g('damage')}<b>${m.spam}</b></span>`}
      ${m && view.opts.upgrades && html`<span class="rr-stat">${energy(m.en)}</span>`}
      ${timed && html`<span class="timer" data-deadline="${view.deadline}"></span>`}`;
  }

  function renderPanel(m) {
    if (!view.inRace && view.phase !== 'setup') return html`<div class="rr-idle">${bot(api.you)}<span class="rr-look">${g('eye')}</span></div>`;
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

  function renderSetup() {
    const o = view.opts;
    if (!api.you?.isVip) return html`<div class="rr-idle">${bot(api.you)}<span class="rr-dots">${g('dots')}</span></div>`;
    const courses = COURSES.filter((x) => x.id !== 'lab');
    const tog = (key, icon, demoKey) => html`
      <button class="rr-opt ${o[key] && 'on'}" data-ui="opt" data-arg="${key}=${String(!o[key])}" aria-pressed="${String(!!o[key])}">
        ${demo(demoKey)}<span class="rr-opt-ic">${g(icon)}</span><i>${g(o[key] ? 'check' : 'cross')}</i>
      </button>`;
    return html`
      <div class="rr-scroll">
        <div class="rr-courses">
          ${courses.map((x) => html`
            <button class="rr-course ${x.id === o.course && 'on'}" data-ui="opt" data-arg="course=${x.id}">
              <img alt="" src="${thumb(x.id)}">
              <span class="rr-course-meta"><span class="rr-pips">${[1, 2, 3, 4].map((n) => html`<i class="${n <= (LEVEL[x.level] ?? 1) && 'on'}"></i>`)}</span><span class="rr-flagn">${g('flag')}${x.checkpoints.length}</span></span>
            </button>`)}
        </div>
        <div class="rr-opts">
          ${tog('upgrades', 'energy', 'upgrades')}
          ${tog('lessDeadly', 'wall', 'safe-edges')}
          ${tog('lessSpam', 'damage', 'less-spam')}
        </div>
        <div class="rr-seg"><span>${g('timer')}</span>${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-ui="opt" data-arg="timer=${t}">${t ? `${t / 60}′` : g('infinity')}</button>`)}</div>
      </div>
      <div class="rr-bottom"><button class="btn btn-xl block" data-action="begin" aria-label="Start">${g('play')}</button></div>`;
  }

  function renderStart() {
    const c = course();
    const taken = new Map(view.robots.filter((r) => r.pick != null).map((r) => [r.pick, r]));
    return html`
      <div class="rr-starts">
        ${c.starts.map((st) => {
          const r = taken.get(st.n);
          const mine = r?.id === api.you?.id;
          return html`<button class="rr-start ${mine && 'mine'} ${r && !mine && 'taken'}" style="${r ? `--c:${r.color}` : ''}" ${r && !mine ? 'disabled' : ''} data-action="pick" data-payload="${JSON.stringify({ n: st.n })}">
            ${r ? bot(r) : html`<b>${st.n}</b>`}</button>`;
        })}
      </div>`;
  }

  function renderUpgrade(m) {
    if (m.done) return html`<div class="rr-idle done">${bot(api.you, 'happy')}<span class="rr-ok">${g('check')}</span></div>${renderInstalled(m, false)}`;
    const usable = m.up.temp.filter((k) => ['any', 'upgrade', 'program'].includes(UPGRADES[k].when));
    return html`
      <div class="rr-scroll">
        <div class="rr-shop">
          <div class="rr-energy-big">${g('energy')}<b>${m.en}</b></div>
          <button class="btn rr-draw" data-action="buy" ${m.bought || m.en < 1 ? 'disabled' : ''} aria-label="Draw an upgrade">${g('cards')}<span class="rr-cost">${g('energy')}1</span></button>
        </div>
        ${m.up.hand.length > 0 && html`
          <div class="rr-ups">
            ${m.up.hand.map((k) => upgradeTile(k, html`<button class="btn rr-install" data-ui="install" data-arg="${k}" ${m.installed || UPGRADES[k].cost > m.en ? 'disabled' : ''} aria-label="Install">${g('plus')}</button>`))}
          </div>`}
        ${renderInstalled(m, true, usable)}
      </div>
      <div class="rr-bottom"><button class="btn btn-xl block" data-action="done" aria-label="Done">${g('check')}</button></div>`;
  }

  function renderInstalled(m, editable, usable = []) {
    if (!m.up.perm.length && !m.up.temp.length) return '';
    return html`
      <div class="rr-installed">
        ${[...m.up.perm, ...m.up.temp].map((k) => html`
          <div class="rr-inst ${UPGRADES[k].kind}">
            <button class="rr-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button>
            ${usable.includes(k) && html`<button class="btn btn-sm" data-ui="use" data-arg="${k}" aria-label="Use">${g('play')}</button>`}
            ${k === 'deflector-shield' && html`<button class="btn btn-sm secondary" data-action="shield" data-payload="${JSON.stringify({ on: !m.autoShield })}">🛡️${g(m.autoShield ? 'check' : 'cross')}</button>`}
            ${editable && html`<button class="rr-x" data-ui="uninstall" data-arg="${k}" aria-label="Remove">${g('cross')}</button>`}
          </div>`)}
      </div>`;
  }

  function renderProgram(m) {
    if (m.done) {
      return html`
        <div class="rr-locked">
          ${!m.wantSd ? html`<div class="rr-regs locked">${prog.regs.map((l, i) => html`<div class="rr-reg"><i>${i + 1}</i>${(m.regs[i].locked ? m.regs[i].cards : l).map((id) => cardHtml(id))}</div>`)}</div>` : html`<span class="rr-big-ic">${g('power')}</span>`}
          <span class="rr-ok">${g('lock')}</span>
          <button class="btn secondary rr-unlock" data-action="unlock" aria-label="Change">${g('back')}</button>
        </div>`;
    }
    if (m.mustReturn) {
      return html`
        <div class="rr-scroll center">
          <span class="rr-return-ic">${g('cards')}${g('back')}</span>
          <div class="rr-hand">${m.hand.map((id) => cardHtml(id, { cls: prog.pick.includes(id) ? 'picked' : '', ui: 'card', n: prog.pick.indexOf(id) + 1 || '' }))}</div>
        </div>
        <div class="rr-bottom"><button class="btn btn-xl block" data-ui="return" ${prog.pick.length !== m.mustReturn ? 'disabled' : ''}>${g('check')} ${prog.pick.length}/${m.mustReturn}</button></div>`;
    }
    const used = placed();
    const nextTarget = prog.target ?? freeRegs()[0];
    const hasCrab = m.up.perm.includes('crab-legs');
    const hasMemory = m.up.perm.includes('memory-cards');
    const usable = m.up.temp.filter((k) => ['any', 'program'].includes(UPGRADES[k].when));
    const hwInRegs = [...new Set([...prog.regs.flat(), ...m.regs.flatMap((r) => (r.locked ? r.cards : []))])].filter((id) => HAYWIRE[cardType(id)]?.choice);
    const permsToInstall = m.up.hand.filter((k) => UPGRADES[k].kind === 'perm');
    const firstTime = view.round === 1 && !prog.regs.flat().length;
    return html`
      ${m.rb && html`
        <div class="rr-reboot">
          <span class="rr-spin-ic">${g('reboot')}</span>
          <div class="rr-dirs">${[0, 1, 2, 3].map((d) => html`<button class="${prog.rebootDir === d && 'on'}" data-ui="reboot" data-arg="${d}" aria-label="Face ${ARROW_DIR[d]}"><span style="transform:rotate(${d * 90}deg)">${g('play')}</span></button>`)}</div>
        </div>`}
      <div class="rr-regs">
        ${[0, 1, 2, 3, 4].map((i) => {
          const r = m.regs[i];
          const list = r.locked ? r.cards : prog.regs[i];
          const canStack = hasCrab && list.length === 1 && ['rl', 'rr'].includes(cardType(list[0]));
          return html`
            <div class="rr-reg ${nextTarget === i && !list.length && 'target'} ${r.locked && 'locked'} ${prog.stack === i && 'stacking'}" data-ui="reg" data-arg="${i}">
              <i>${i + 1}</i>
              ${list.length ? list.map((id) => cardHtml(id)) : ''}
              ${canStack && html`<button class="rr-crab" data-ui="crab" data-arg="${i}">🦀+</button>`}
            </div>`;
        })}
      </div>
      ${hwInRegs.map((id) => {
        const t = cardType(id);
        if (HAYWIRE[t].choice === 'side') {
          return html`<div class="rr-seg rr-hw">${cardHtml(id)}${['left', 'right'].map((s) => html`<button class="${(prog.hw[id] ?? 'right') === s && 'on'}" data-ui="hw" data-arg="${id}=${s}">${g(s === 'left' ? 'back' : 'next')}</button>`)}</div>`;
        }
        if (!permsToInstall.length) return '';
        return html`<div class="rr-seg rr-hw wrap">🔧${permsToInstall.map((k) => html`<button class="${(prog.hw[id] ?? permsToInstall[0]) === k && 'on'}" data-ui="hw" data-arg="${id}=${k}">${upgradeIcon(k)}</button>`)}</div>`;
      })}
      <div class="rr-hand ${firstTime && 'hint'} n${m.hand.length}">
        ${m.hand.map((id) => {
          if (used.has(id)) return html`<span class="rr-hand-slot empty"></span>`;
          const keepable = hasMemory && programFull() && !isDamage(id);
          return html`<span class="rr-hand-slot">
            ${cardHtml(id, { ui: 'card' })}
            ${keepable && html`<button class="rr-keep ${prog.keep.has(id) && 'on'}" data-ui="keep" data-arg="${id}">🗂️</button>`}
          </span>`;
        })}
      </div>
      ${m.peek && html`<div class="rr-peek">${g('eye')} ${cardHtml(m.peek)}</div>`}
      ${usable.length > 0 && html`<div class="rr-installed">${usable.map((k) => html`
        <div class="rr-inst temp"><button class="rr-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button><button class="btn btn-sm" data-ui="use" data-arg="${k}" aria-label="Use">${g('play')}</button></div>`)}</div>`}
      <div class="rr-bottom rr-actions">
        <button class="rr-mini" data-ui="shutdown" aria-label="Shut down">${g('power')}</button>
        <button class="btn btn-xl rr-lock" data-ui="lock" ${programFull() ? '' : 'disabled'} aria-label="Lock in">${g('lock')}</button>
        <button class="rr-mini" data-ui="clear" aria-label="Clear">${g('cross')}</button>
      </div>`;
  }

  function renderActivate(m) {
    const armable = m.canArm && m.on && m.up.temp.filter((k) => ['move', 'turn'].includes(UPGRADES[k].when));
    const state = m.sd ? 'power' : !m.on ? (m.rb ? 'reboot' : 'fall') : null;
    return html`
      <div class="rr-race">
        ${state && html`<span class="rr-race-state ${state}">${g(state)}</span>`}
        <div class="rr-regs small">
          ${m.regs.map((r, i) => html`
            <div class="rr-reg ${i === view.reg && 'now'} ${i < view.reg && 'past'}">
              <i>${i + 1}</i>${r.cards.map((id) => cardHtml(id))}
              ${r.next && html`<span class="rr-hw-next">${g('energy')}</span>`}
            </div>`)}
        </div>
        ${armable?.length > 0 && html`
          <button class="rr-arm ${m.armed && 'on'}" data-action="arm" data-payload="${JSON.stringify({ on: !m.armed })}">
            ${armable.map((k) => html`<span>${upgradeIcon(k)}</span>`)}<i>${g(m.armed ? 'check' : 'play')}</i>
          </button>`}
        ${view.waiting && html`<div class="rr-wait">${bot(robotById(view.waiting.id))}<span class="rr-big">${view.waiting.icon ? upgradeIcon(view.waiting.icon) : g('dots')}</span></div>`}
      </div>`;
  }

  function renderOver(m) {
    const w = robotById(view.winner);
    const won = view.winner === api.you?.id;
    return html`
      <div class="rr-over ${won && 'won'}">
        <span class="rr-trophy">${g('trophy')}</span>
        ${w && html`<div class="rr-winner" style="--c:${w.color}">${avatar({ ...w, connected: true }, { mood: 'happy' })}<b>${w.name}</b></div>`}
        ${m && html`<div class="rr-mystats">
          <span>${g('flag')}<b>${m.cp}/${view.cps}</b></span><span>${g('push')}<b>${m.stats.pushes}</b></span>
          <span>${g('hit')}<b>${m.stats.hits}</b></span><span>${g('fall')}<b>${m.stats.falls}</b></span></div>`}
      </div>
      ${api.you?.isVip && html`<div class="rr-bottom"><button class="btn btn-xl block" data-action="finish" aria-label="Back to the lobby">${g('home')}</button></div>`}`;
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
        <div class="rr-sheet-box">
          <div class="rr-sheet-head">${promptHead(p)}<span class="timer" data-deadline="${p.deadline}"></span></div>
          ${p.icon && demo(p.icon, 'wide')}
          <div class="rr-sheet-opts ${p.options.length > 3 && 'grid'}">
            ${p.options.map((o) => html`<button class="btn block ${['go', 'main', 'no', 'skip'].includes(o.v) ? 'secondary' : ''}" data-ui="answer" data-arg="${o.v}">${optionPicture(p, o)}</button>`)}
          </div>
        </div>`);
      return;
    }
    lastPromptKey = null;
    if (localSheet) {
      sheet.hidden = false;
      set(sheet, html`
        <div class="rr-sheet-box">
          <div class="rr-sheet-head"><span class="rr-big">${localSheet.head}</span></div>
          ${localSheet.demo && demo(localSheet.demo, 'wide')}
          ${localSheet.note && html`<p class="rr-note-text">${localSheet.note}</p>`}
          <div class="rr-sheet-opts ${localSheet.options.length > 3 && 'grid'}">
            ${localSheet.options.map((o, i) => html`<button class="btn block ${i === localSheet.options.length - 1 && localSheet.options.length > 1 ? 'secondary' : ''}" data-ui="sheet" data-arg="${i}">${o.label}</button>`)}
          </div>
        </div>`);
      return;
    }
    sheet.hidden = true;
    set(sheet, '');
  }

  function promptHead(p) {
    if (p.kind === 'window') return html`<span class="rr-big">${g('energy')}</span>${(p.card ?? []).map((t) => cardHtml(t))}`;
    if (p.kind === 'weapon') return html`<span class="rr-big">${g('hit')}</span>${bot(robotById(p.target))}`;
    return html`<span class="rr-big">${upgradeIcon(p.icon)}</span><small>${UPGRADES[p.icon]?.name ?? ''}</small>`;
  }

  const dirArrow = (d) => html`<span class="rr-dir" style="transform:rotate(${Number(d) * 90}deg)">${g('play')}</span>`;

  /** A choice as a picture (with a word only where a picture can't say it). */
  function optionPicture(p, o) {
    const [k, arg] = String(o.v).split(':');
    switch (p.kind) {
      case 'window':
        if (k === 'go') return html`${g('play')}${(p.card ?? []).map((t) => cardHtml(t))}`;
        if (k === 'after') return html`${g('play')}${g('next')}${g('energy')}`;
        if (k === 'skip') return html`${g('cross')}${g('energy')}`;
        if (k === 'boink') return html`<span class="rr-big">🦘</span>${dirArrow(arg)}`;
        if (k === 'zoop') return html`<span class="rr-big">🧭</span>${dirArrow(arg)}`;
        if (k === 'switch') return html`<span class="rr-big">🔀</span>${bot(robotById(arg))}`;
        if (k === 'abort') return html`<span class="rr-big">⏏️</span>`;
        if (k === 'lucky') return html`<span class="rr-big">🍀</span>`;
        return html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'brakes':
        return k === 'brake' ? html`<span class="rr-big">🛑</span>` : cardHtml('m1');
      case 'slide':
        return k === 'yes' ? dirArrow(0) : g('cross');
      case 'econv':
        return k === 'no' ? g('cross') : dirArrow(k === 'fwd' ? 0 : 2);
      case 'weapon':
        return k === 'main' ? html`${g('robotLaser')}` : html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'lucky':
        return k === 'use' ? cardHtml(p.data?.card ?? 'h01') : g('trash');
      case 'pierce':
        return k === 'no' ? g('cross') : dirArrow(arg);
      case 'chassis':
        return k === 'no' ? g('cross') : html`${bot(robotById(k))}<span class="rr-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg]?.name ?? ''}</small>`;
      case 'magnet':
        return k === 'yes' ? html`🤝${dirArrow(p.data?.d ?? 0)}` : g('cross');
      case 'selfdiag':
        return k === 'no' ? g('cross') : html`${cardHtml(k)}${g('trash')}`;
    }
    return html`${o.label}`;
  }

  const thumbs = new Map();
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
      const before = view;
      view = next;
      if (before?.phase !== next.phase) {
        localSheet = null;
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
