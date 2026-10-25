// A phone: setup (the leader), picking a start space, the upgrade shop, programming your registers
// with a map that shows where your program would take you, and decisions during the race.
// Pictures and little animations do the explaining; words only name things.
// The phone holds only what is private: your hand, your program, your choices. Everything the room
// shares (the race, who's ready, who won) is on the big screen, and the phone points up at it.
import { html, raw } from '../../js/ui.js';
import { avatar } from '../../js/avatar.js';
import { COURSES, getCourse } from './board.js';
import { cardType, isDamage, isHaywire, UPGRADES, HAYWIRE } from './cards.js';
import { drawCourse, previewProgram } from './minimap.js';
import { cardPicture, cardKind, upgradeIcon, ARROW } from './icons.js';
import { mountDemo, hasDemo } from './demo.js';

const LEVEL = { Starter: 1, Beginner: 2, Intermediate: 3, Advanced: 4 };
const UP = '<svg viewBox="0 0 40 40" class="rr-up-arrow" aria-hidden="true"><path d="M8 21 L20 9 L32 21 M8 33 L20 21 L32 33" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TIMERS = [0, 60, 120, 180];

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
  let localSheet = null; // { title, demo, options: [{ label, run }] }
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
  const bot = (r) => (r ? html`<span class="rr-av" style="--c:${r.color}">${avatar(r)}</span>` : '');

  /** A card: just its picture, colored by type. */
  function cardHtml(id, { cls = '', ui = null, n = '' } = {}) {
    const attrs = ui ? html`data-ui="${ui}" data-arg="${id}" data-n="${n}"` : '';
    return html`<span class="rr-card ${cardKind(id)} ${cls}" ${attrs}>${raw(cardPicture(id))}</span>`;
  }

  /** A looping explanation. The canvas starts playing once it's on the page (startDemos). */
  const demo = (key, cls = '') => (hasDemo(key) ? html`<canvas class="rr-demo ${cls}" data-demo="${key}"></canvas>` : '');
  function startDemos(el) {
    for (const c of el.querySelectorAll('canvas[data-demo]:not([data-on])')) {
      c.dataset.on = '1';
      mountDemo(c, c.dataset.demo, api.you?.color ?? '#ff4d6d', { safeEdges: view?.opts.lessDeadly });
    }
  }

  /** An upgrade tile: its animation, picture, name and cost. */
  function upgradeTile(key, extra = '') {
    const u = UPGRADES[key];
    return html`
      <div class="rr-up ${u.kind}">
        ${demo(key)}
        <div class="rr-up-info">
          <div class="rr-up-head"><span class="rr-up-emoji">${upgradeIcon(key)}</span><b>${u.name}</b></div>
          <div class="rr-up-meta"><span class="rr-up-cost">⚡${u.cost}</span><span class="rr-up-kind" title="${u.kind === 'perm' ? 'stays' : 'one use'}">${u.kind === 'perm' ? '∞' : '1×'}</span></div>
          ${extra}
        </div>
      </div>`;
  }

  // ---------- the map ----------

  let mapKey = null;
  function drawMap(force = false) {
    if (!view) return;
    const m = me();
    const key = JSON.stringify([mapMode, mapBox.clientWidth, view.phase, view.opts.course, view.robots, m && [m.x, m.y, m.d, m.on, m.cp, m.done], prog.regs, prog.hw, prog.rebootDir]);
    if (!force && key === mapKey) return;
    mapKey = key;
    const c = course();
    const width = mapBox.clientWidth || 340;
    const fitTile = Math.floor(width / c.w);
    // on a short phone the whole course would push the cards off the screen: start zoomed in on your robot
    const maxH = Math.max(180, Math.round(window.innerHeight * 0.36));
    const fits = fitTile * c.h <= maxH;
    mapMode ??= fitTile >= 24 && fits ? 'all' : 'near';
    mapBtn.hidden = fitTile >= 30 && fits;
    mapBtn.textContent = mapMode === 'all' ? '🔍＋' : '🔍－';
    const tile = mapMode === 'all' ? fitTile : 34;
    const height = mapMode === 'all' ? tile * c.h : Math.min(tile * c.h, Math.round(width * 0.78), maxH);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#121214';
    g.fillRect(0, 0, width, height);

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
    drawCourse(g, c, {
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
    // the program is full: bring the lock button into view (on a short phone it can be below the hand)
    if (programFull()) root.querySelector('.rr-lock:not(:disabled)')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function lockIn() {
    const m = me();
    const hw = {};
    for (const id of [...prog.regs.flat(), ...m.regs.flatMap((r) => r.cards)]) if (isHaywire(id) && prog.hw[id]) hw[id] = prog.hw[id];
    const res = await send('lock', { regs: prog.regs, keep: [...prog.keep], hw, rebootDir: prog.rebootDir });
    if (!res?.error) api.vibrate([10, 40, 10]);
  }

  // ---------- clicks ----------

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
          head: '⏻',
          demo: 'shutdown',
          options: [
            { label: html`<span class="rr-big">⏻</span>`, run: () => send('lock', { shutdown: true, rebootDir: prog.rebootDir }) },
            { label: html`<span class="rr-big">✖</span>`, run: () => {} },
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
          head: html`${upgradeIcon(arg)} ⇄ ?`,
          options: [
            ...slots.map((k) => ({ label: html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k].name}</small>`, run: () => send('install', { card: arg, replace: k }) })),
            { label: html`<span class="rr-big">✖</span>`, run: () => {} },
          ],
        });
      }
      case 'uninstall':
        return openSheet({
          head: html`${upgradeIcon(arg)} → 🗑️`,
          options: [
            { label: html`<span class="rr-big">🗑️</span>`, run: () => send('uninstall', { card: arg }) },
            { label: html`<span class="rr-big">✖</span>`, run: () => {} },
          ],
        });
      case 'use':
        if (arg === 're-initialize') {
          return openSheet({
            head: '🥇 →',
            demo: 're-initialize',
            options: [...view.robots.map((r) => ({ label: html`${bot(r)}<small>${r.name}</small>`, run: () => send('use', { card: arg, target: r.id }) })), { label: html`<span class="rr-big">✖</span>`, run: () => {} }],
          });
        }
        return send('use', { card: arg });
      case 'info':
        return openSheet({ head: html`${upgradeIcon(arg)} <small>${UPGRADES[arg]?.name ?? ''}</small>`, demo: arg, note: UPGRADES[arg]?.text, options: [{ label: html`<span class="rr-big">✔</span>`, run: () => {} }] });
      case 'cardinfo':
        return openSheet({ head: raw(cardPicture(arg)), demo: arg, options: [{ label: html`<span class="rr-big">✔</span>`, run: () => {} }] });
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
    root.firstElementChild.dataset.phase = view.phase;

    // the clock, in the header's corner, while it's running for you
    const timed = ['start', 'upgrade', 'program'].includes(view.phase) && view.deadline && view.inRace && !m?.done;
    set(top, timed ? html`<span class="timer" data-deadline="${view.deadline}"></span>` : '');
    // the map is for planning: picking a start space and programming (and the leader choosing a course)
    const planning = view.inRace && ((view.phase === 'program' && m && !m.done && !m.mustReturn) || view.phase === 'start');
    root.firstElementChild.dataset.map = planning || (view.phase === 'setup' && api.you?.isVip) ? 'on' : 'off';

    set(panel, renderPanel(m));
    renderSheet();
    if (root.firstElementChild.dataset.map === 'on') drawMap();
  }

  function renderPanel(m) {
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

  function renderSetup() {
    const o = view.opts;
    const courses = COURSES.filter((x) => x.id !== 'lab');
    if (!api.you?.isVip) return lookUp();
    const tog = (key, icon, demoKey) => html`
      <button class="rr-opt ${o[key] && 'on'}" data-ui="opt" data-arg="${key}=${String(!o[key])}">
        ${demo(demoKey, 'small')}<span class="rr-opt-ic">${icon}</span><i>${o[key] ? '✔' : '✖'}</i>
      </button>`;
    return html`
      <div class="rr-courses">
        ${courses.map((x) => html`
          <button class="rr-course ${x.id === o.course && 'selected'}" data-ui="opt" data-arg="course=${x.id}">
            <b>${x.name}</b>
            <span>${'★'.repeat(LEVEL[x.level] ?? 1)}${'☆'.repeat(4 - (LEVEL[x.level] ?? 1))} · 🏁${x.checkpoints.length}</span>
          </button>`)}
      </div>
      <div class="rr-opts">
        ${tog('upgrades', '⚡🛒', 'upgrades')}
        ${tog('lessDeadly', '🧱', 'safe-edges')}
        ${tog('lessSpam', '⚠️↘', 'less-spam')}
      </div>
      <div class="rr-seg">
        <span class="rr-seg-ic">⏱</span>
        ${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-ui="opt" data-arg="timer=${t}">${t ? `${t / 60}′` : '∞'}</button>`)}
      </div>
      <button class="btn btn-xl block rr-go" data-action="begin">▶</button>`;
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
            <b>${st.n}</b>${r ? bot(r) : ''}</button>`;
        })}
      </div>`;
  }

  function renderUpgrade(m) {
    if (m.done) return html`<div class="rr-block center rr-done"><span class="rr-big">✔</span></div>${renderInstalled(m, false)}${lookUp()}`;
    const usable = m.up.temp.filter((k) => ['any', 'upgrade', 'program'].includes(UPGRADES[k].when));
    return html`
      <div class="rr-shop">
        <div class="rr-energy"><span>⚡</span><b>${m.en}</b></div>
        <button class="btn rr-draw" data-action="buy" ${m.bought || m.en < 1 ? 'disabled' : ''}>🂠＋ <small>⚡1</small></button>
      </div>
      ${m.up.hand.length > 0 && html`
        <div class="rr-ups">
          ${m.up.hand.map((k) => upgradeTile(k, html`<button class="btn btn-sm" data-ui="install" data-arg="${k}" ${m.installed || UPGRADES[k].cost > m.en ? 'disabled' : ''}>＋</button>`))}
        </div>`}
      ${renderInstalled(m, true, usable)}
      <button class="btn btn-xl block rr-go" data-action="done">✔</button>`;
  }

  function renderInstalled(m, editable, usable = []) {
    if (!m.up.perm.length && !m.up.temp.length) return '';
    return html`
      <div class="rr-installed">
        ${[...m.up.perm, ...m.up.temp].map((k) => html`
          <div class="rr-inst ${UPGRADES[k].kind}">
            <button class="rr-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button>
            <small>${UPGRADES[k].name}</small>
            ${usable.includes(k) && html`<button class="btn btn-sm" data-ui="use" data-arg="${k}">▶</button>`}
            ${k === 'deflector-shield' && html`<button class="btn btn-sm secondary" data-action="shield" data-payload="${JSON.stringify({ on: !m.autoShield })}">🛡️${m.autoShield ? '✔' : '✖'}</button>`}
            ${editable && html`<button class="rr-x" data-ui="uninstall" data-arg="${k}">✖</button>`}
          </div>`)}
      </div>`;
  }

  /** An arrow bouncing up toward the big screen: nothing more to do here, the show is up there. */
  const lookUp = () => html`<div class="rr-lookup" aria-label="Watch the big screen">${raw(UP)}<span aria-hidden="true">📺</span></div>`;

  function renderProgram(m) {
    if (m.done) {
      return html`
        <div class="rr-block center rr-done">
          <span class="rr-big">${m.wantSd ? '⏻' : '🔒'}</span>
          ${!m.wantSd && html`<div class="rr-regs small">${prog.regs.map((l, i) => html`<div class="rr-reg"><i>${i + 1}</i>${(m.regs[i].locked ? m.regs[i].cards : l).map((id) => cardHtml(id))}</div>`)}</div>`}
          <button class="btn secondary rr-unlock" data-action="unlock" aria-label="Change my program">✎</button>
        </div>
        ${lookUp()}`;
    }
    if (m.mustReturn) {
      return html`
        <div class="rr-block center">
          <span class="rr-big">🂠🂠🂠 ⤒</span>
          <div class="rr-hand">${m.hand.map((id) => cardHtml(id, { cls: prog.pick.includes(id) ? 'picked' : '', ui: 'card', n: prog.pick.indexOf(id) + 1 || '' }))}</div>
          <button class="btn btn-xl block" data-ui="return" ${prog.pick.length !== m.mustReturn ? 'disabled' : ''}>✔ ${prog.pick.length}/${m.mustReturn}</button>
        </div>`;
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
          <span class="rr-big rr-spin">↻</span>
          <div class="rr-dirs">${[0, 1, 2, 3].map((d) => html`<button class="${prog.rebootDir === d && 'on'}" data-ui="reboot" data-arg="${d}">${ARROW[d]}</button>`)}</div>
        </div>`}
      <div class="rr-regs">
        ${[0, 1, 2, 3, 4].map((i) => {
          const r = m.regs[i];
          const list = r.locked ? r.cards : prog.regs[i];
          const canStack = hasCrab && list.length === 1 && ['rl', 'rr'].includes(cardType(list[0]));
          return html`
            <div class="rr-reg ${nextTarget === i && !list.length && 'target'} ${r.locked && 'locked'} ${prog.stack === i && 'stacking'}" data-ui="reg" data-arg="${i}">
              <i>${i + 1}</i>
              ${list.length ? list.map((id) => cardHtml(id)) : html`<span class="rr-empty"></span>`}
              ${canStack && html`<button class="rr-crab" data-ui="crab" data-arg="${i}">🦀＋</button>`}
            </div>`;
        })}
      </div>
      ${hwInRegs.map((id) => {
        const t = cardType(id);
        if (HAYWIRE[t].choice === 'side') {
          return html`<div class="rr-seg">${raw(cardPicture(id))}${['left', 'right'].map((s) => html`<button class="${(prog.hw[id] ?? 'right') === s && 'on'}" data-ui="hw" data-arg="${id}=${s}">${s === 'left' ? '⬅' : '➡'}</button>`)}</div>`;
        }
        if (!permsToInstall.length) return '';
        return html`<div class="rr-seg wrap">🔧${permsToInstall.map((k) => html`<button class="${(prog.hw[id] ?? permsToInstall[0]) === k && 'on'}" data-ui="hw" data-arg="${id}=${k}">${upgradeIcon(k)}</button>`)}</div>`;
      })}
      <div class="rr-hand">
        ${m.hand.map((id, n) => {
          if (used.has(id)) return '';
          const keepable = hasMemory && programFull() && !isDamage(id);
          return html`<div class="rr-hand-slot">
            ${cardHtml(id, { ui: 'card', cls: firstTime && n === 0 ? 'hint' : '' })}
            ${keepable && html`<button class="rr-keep ${prog.keep.has(id) && 'on'}" data-ui="keep" data-arg="${id}">🗂️${prog.keep.has(id) ? '✔' : ''}</button>`}
          </div>`;
        })}
      </div>
      ${m.peek && html`<div class="rr-peek">🔍 ${cardHtml(m.peek)}</div>`}
      <div class="rr-actions">
        <button class="btn btn-xl rr-lock" data-ui="lock" ${programFull() ? '' : 'disabled'}>🔒</button>
        <button class="btn secondary" data-ui="clear" aria-label="clear">✖</button>
        <button class="btn secondary" data-ui="shutdown" aria-label="shut down">⏻</button>
      </div>
      ${usable.length > 0 && html`<div class="rr-installed">${usable.map((k) => html`
        <div class="rr-inst temp"><button class="rr-inst-ic" data-ui="info" data-arg="${k}">${upgradeIcon(k)}</button><small>${UPGRADES[k].name}</small><button class="btn btn-sm" data-ui="use" data-arg="${k}">▶</button></div>`)}</div>`}`;
  }

  /**
   * The race is on the big screen. The phone shows only your card for this register (it bounces while
   * your robot plays it), a switch if you have an upgrade to arm, and an arrow pointing up.
   */
  function renderActivate(m) {
    const reg = m.regs[Math.max(0, Math.min(view.reg, 4))]; // reg is -1 for a moment before register 1
    const what = view.beat.what;
    const playing = what?.id === api.you?.id && ['card', 'upgrade'].includes(what.k);
    const state = m.sd ? '⏻' : !m.on ? (m.rb ? '↻' : '🕳️') : '';
    const armable = m.canArm && m.on && m.up.temp.filter((k) => ['move', 'turn'].includes(UPGRADES[k].when));
    return html`
      <div class="rr-act">
        <div class="rr-pips">${[0, 1, 2, 3, 4].map((i) => html`<i class="${i === view.reg && 'now'} ${i < view.reg && 'done'}">${i + 1}</i>`)}</div>
        <div class="rr-act-card ${playing && 'playing'} ${state && 'off'}">
          ${reg.cards.length ? reg.cards.map((id) => cardHtml(id)) : html`<span class="rr-card rr-card-empty"></span>`}
          ${reg.next && html`<span class="rr-hw-next">⚡</span>`}
          ${state && html`<span class="rr-act-state ${state === '↻' && 'rr-spin'}">${state}</span>`}
        </div>
        ${armable?.length > 0 && html`
          <button class="rr-arm ${m.armed && 'on'}" data-action="arm" data-payload="${JSON.stringify({ on: !m.armed })}">
            ${armable.map((k) => html`<span>${upgradeIcon(k)}</span>`)}<i>${m.armed ? '✔' : '▶?'}</i>
          </button>`}
        ${lookUp()}
      </div>`;
  }

  /** The winner gets a trophy and a happy robot; everyone else looks up at the results. */
  function renderOver(m) {
    const won = view.winner === api.you?.id;
    return html`
      ${won ? html`<div class="rr-block center rr-over won"><span class="rr-big">🏆</span><div class="rr-winner" style="--c:${api.you.color}">${avatar(api.you, { mood: 'happy' })}</div></div>` : lookUp()}
      ${api.you?.isVip && html`<button class="btn btn-xl block rr-home" data-action="finish" aria-label="Back to the lobby">🏠</button>`}`;
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
          <div class="rr-sheet-opts ${p.options.length > 4 && 'grid'}">
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
          <div class="rr-sheet-opts ${localSheet.options.length > 4 && 'grid'}">
            ${localSheet.options.map((o, i) => html`<button class="btn block ${i === localSheet.options.length - 1 && localSheet.options.length > 1 ? 'secondary' : ''}" data-ui="sheet" data-arg="${i}">${o.label}</button>`)}
          </div>
        </div>`);
      return;
    }
    sheet.hidden = true;
    set(sheet, '');
  }

  function promptHead(p) {
    if (p.kind === 'window') return html`<span class="rr-big">⚡?</span>${(p.card ?? []).map((t) => cardHtml(t))}`;
    if (p.kind === 'weapon') return html`<span class="rr-big">🎯</span>${bot(robotById(p.target))}`;
    return html`<span class="rr-big">${upgradeIcon(p.icon)}</span><small>${UPGRADES[p.icon]?.name ?? ''}</small>`;
  }

  /** A choice as a picture (with a word only where a picture can't say it). */
  function optionPicture(p, o) {
    const [k, arg] = String(o.v).split(':');
    const rel = (d) => ARROW[d];
    switch (p.kind) {
      case 'window':
        if (k === 'go') return html`<span class="rr-big">▶</span>${(p.card ?? []).map((t) => cardHtml(t))}`;
        if (k === 'after') return html`<span class="rr-big">▶ → ⚡</span>`;
        if (k === 'skip') return html`<span class="rr-big">✖⚡</span>`;
        if (k === 'boink') return html`<span class="rr-big">🦘${rel(Number(arg))}</span>`;
        if (k === 'zoop') return html`<span class="rr-big">🧭${rel(Number(arg))}</span>`;
        if (k === 'switch') return html`<span class="rr-big">🔀</span>${bot(robotById(arg))}`;
        if (k === 'abort') return html`<span class="rr-big">⏏️</span>`;
        if (k === 'lucky') return html`<span class="rr-big">🍀</span>`;
        return html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'brakes':
        return k === 'brake' ? html`<span class="rr-big">🛑</span>` : cardHtml('m1');
      case 'slide':
        return html`<span class="rr-big">${k === 'yes' ? '⬆' : '✖'}</span>`;
      case 'econv':
        return html`<span class="rr-big">${{ fwd: '⬆', back: '⬇', no: '✖' }[k]}</span>`;
      case 'weapon':
        return k === 'main' ? html`<span class="rr-big">🔴━</span>` : html`<span class="rr-big">${upgradeIcon(k)}</span><small>${UPGRADES[k]?.name ?? ''}</small>`;
      case 'lucky':
        return k === 'use' ? cardHtml(p.data?.card ?? 'h01') : html`<span class="rr-big">🗑️</span>`;
      case 'pierce':
        return k === 'no' ? html`<span class="rr-big">✖</span>` : html`<span class="rr-big">${ARROW[Number(arg)]}</span>`;
      case 'chassis':
        return k === 'no' ? html`<span class="rr-big">✖</span>` : html`${bot(robotById(k))}<span class="rr-big">${upgradeIcon(arg)}</span><small>${UPGRADES[arg]?.name ?? ''}</small>`;
      case 'magnet':
        return html`<span class="rr-big">${k === 'yes' ? `🤝${ARROW[p.data?.d ?? 0]}` : '✖'}</span>`;
      case 'selfdiag':
        return k === 'no' ? html`<span class="rr-big">✖</span>` : html`${cardHtml(k)}<span class="rr-big">🗑️</span>`;
    }
    return html`${o.label}`;
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
