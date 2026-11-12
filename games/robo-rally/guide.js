// The phone's Guide: one "?" button. It opens Help: what this screen wants from you now (a looping clip and a
// sentence), and the ways on: point at anything on the screen ("What's this?"), the game in four clips ("How to
// play"), the test drive (practice.js) and every rule by subject ("All rules": an index, then a page a subject).
// Anything pointed at (or long-pressed) answers with its own clips. New things are the coach's to point out
// (coach.js: a tip in words beside the thing); Help has the switch that turns its tips off.
//   in the game:  const guide = mountGuide(root, { getView, api, mapTopics, getPlanned, onTips });  guide.refresh() after each render
//   the lobby:    openBook({ context: 'lobby', color })   (Help, without the pointing)
// Anything with data-ask="topic[:arg]" can be pointed at; data-tap="ask" also opens it on a plain tap.
import { html, raw, loadCss } from '../../js/ui.js';
import { svgGlyph, cardSvgHtml, robotSvg, formOf, COURSE_TITLES } from './glyphs.js';
import { mountDemo, hasDemo, setDemoFocus, miniCourse, filmCount } from './demo.js';
import { drawCourse } from './minimap.js';
import { getCourse } from './board.js';
import { UPGRADES, HAYWIRE, cardType } from './cards.js';
import { TOPICS, SECTIONS, sectionTopics, bookTiles, cardTopic } from './topics.js';
import { mountReplay, ranCards, causesFor, markHtml } from './replay.js';
import { mountPractice } from './practice.js';
import { tipsOn, setTips } from './coach.js';

const g = (name, cls = '') => raw(svgGlyph(name, cls));
const card = (t, cls = '') => raw(cardSvgHtml(t, cls));
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};
// "How to play": the lobby film's scenes (demo.js film-1..4), a sentence each
const FILM_SAYS = [
  'Five cards, in order, drive your robot to the flag.',
  'After every card the floor moves too: belts carry, gears turn, lasers fire.',
  'Damage is junk cards. Junk clogs your hand. A Haywire jams a slot.',
  'Robots shove each other. Reach the flags in order: first to the last one wins.',
];
// what a screen wants from you: the topic Help leads with
const LEAD = { start: 'pad', brief: 'look-up', upgrade: 'shop', program: 'slots', activate: 'look-up', over: 'goal' };
let cssLoaded = null;
const loadStyles = () => (cssLoaded ??= loadCss(new URL('./guide.css', import.meta.url).href));

// ---------- pictures ----------

const CELL_DEFS = {
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
function drawCellPics(el) {
  for (const cv of el.querySelectorAll('canvas[data-cell]:not([data-on])')) {
    cv.dataset.on = '1';
    const def = CELL_DEFS[cv.dataset.cell];
    if (!def) continue;
    const c = miniCourse(def);
    const w = cv.clientWidth || 38;
    const h = cv.clientHeight || 38;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = Math.min(w / c.w, h / c.h);
    drawCourse(ctx, c, { tile: T, ox: (w - T * c.w) / 2, oy: (h - T * c.h) / 2, glow: true, cpNext: 1 });
  }
}

const thumbs = new Map();
function courseThumb(id) {
  if (thumbs.has(id)) return thumbs.get(id);
  const c = getCourse(id);
  const tile = Math.max(6, Math.floor(240 / Math.max(c.w, c.h * 1.3)));
  const cv = document.createElement('canvas');
  cv.width = c.w * tile;
  cv.height = c.h * tile;
  drawCourse(cv.getContext('2d'), c, { tile, glow: true });
  thumbs.set(id, cv.toDataURL());
  return thumbs.get(id);
}

// ---------- one guide per screen ----------

/**
 * o: { getView() -> the phone's view, api, mapTopics(el, clientX, clientY) -> [topic ids],
 *      getPlanned(round, reg) -> the light line planned for that slot (ghosts), shell: true on the lobby screen }
 */
export function mountGuide(root, o = {}) {
  loadStyles();
  const getView = o.getView ?? (() => null);
  const you = () => o.api?.you ?? null;
  const color = () => you()?.color ?? (getComputedStyle(document.documentElement).getPropertyValue('--me').trim() || '#f4efe4');
  const layer = document.createElement('div');
  layer.className = 'gd';
  (o.shell ? document.body : root).append(layer);
  const pl = () => root.querySelector('.pl') ?? root;
  // where the layer is (the whole window on a phone; the phone's column on a laptop): a rect from the page, in its terms
  const local = (r) => {
    const f = layer.getBoundingClientRect();
    return { left: r.left - f.left, top: r.top - f.top, right: r.right - f.left, bottom: r.bottom - f.top, width: r.width, height: r.height };
  };

  let pointing = false;
  let outlined = [];
  let sheet = null; // { el, kind: 'entry' | 'replay', from }
  let book = null; // { el, body, sec (the subject on its page, or null: the index), viaIndex }
  let home = null; // Help's first sheet: { el }
  let films = null; // "How to play": { el }
  let driving = null; // the test drive, over everything: { el, ui }
  let lastPhase = null;
  let pressed = null;
  let swallow = false;
  const stack = []; // what's open, for the back gesture
  let ignorePops = 0;
  const cued = new Set(parseList(store.get('rr.cued')));
  const session = new Set(); // cues fired on this page load (for the Guide's own reminders)

  const opened = () => store.get('rr.opened') === '1';
  const markOpened = () => store.set('rr.opened', '1');

  // ----- the back gesture closes whatever is on top -----
  // Each open layer has a place in the browser's history. A layer that closes as another opens (Help to pointing,
  // a sheet to the Book) hands its place over, so the history is never gone back through and added to in the same
  // moment (the two can cross, and a later "back" would then leave the game's page).
  let spare = 0; // places left by layers closed just now
  let spareTimer = 0;
  function pushLayer(name) {
    stack.push(name);
    if (spare > 0) {
      spare--;
      return;
    }
    try {
      history.pushState({ gd: stack.length }, '');
    } catch {}
  }
  function popLayer(name, fromHistory) {
    const i = stack.lastIndexOf(name);
    if (i < 0) return;
    stack.splice(i, 1);
    if (fromHistory) return;
    spare++;
    clearTimeout(spareTimer);
    spareTimer = setTimeout(() => {
      // nothing took these places: back through them (one step, one popstate, ignored)
      const n = spare;
      spare = 0;
      if (!n) return;
      ignorePops++;
      try {
        history.go(-n);
      } catch {
        ignorePops--;
      }
    }, 0);
  }
  const onPop = () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const top = stack.at(-1);
    if (top === 'point') closePoint(true);
    else if (top === 'sheet') closeSheet(true);
    else if (top === 'drive') closeDrive(true);
    else if (top === 'films') closeFilms(true);
    else if (top === 'book') backInBook(true);
    else if (top === 'help') closeHelp(true);
  };
  /** Only what's on top animates: the test drive, a sheet, the films, the Book, Help. */
  const refocus = () => setDemoFocus(driving?.el ?? sheet?.el ?? films?.el ?? book?.el ?? home?.el ?? null);
  window.addEventListener('popstate', onPop);

  // ----- where the "?" is -----
  const askBtn = () => (o.shell ? document.getElementById('ask-btn') : root.querySelector('[data-guide="ask"]'));
  function askRect() {
    const b = askBtn();
    const r = b?.getBoundingClientRect();
    return r && r.width ? r : { left: innerWidth - 50, right: innerWidth - 6, top: 6, bottom: 50, width: 44, height: 44 };
  }

  // ----- pictures -----
  function pic(p, arg) {
    if (!p) return '';
    const v = getView();
    if (p.card) return html`<span class="gd-pic ${p.slot && 'slot'}">${card(p.slot && arg ? arg : p.card)}</span>`;
    if (p.g) return html`<span class="gd-pic g g-${p.g} ${p.tone} ${p.lockAnim && 'lock'} ${p.arm && 'arm'}">${g(p.g)}</span>`;
    if (p.up) {
      if (typeof p.up === 'string') return html`<span class="gd-pic up ${UPGRADES[p.up]?.kind}"><canvas data-demo="${p.up}"></canvas></span>`;
      return html`<span class="gd-pic up perm"><i class="gd-diamond"></i></span>`;
    }
    if (p.cell) return html`<span class="gd-pic"><canvas class="gd-cell" data-cell="${p.cell}"></canvas></span>`;
    if (p.me) return html`<span class="gd-pic bot">${raw(robotSvg(you() ?? { color: color() }))}</span>`;
    if (p.robot) {
      const r = v?.robots?.find((q) => q.id === arg) ?? v?.robots?.find((q) => q.id !== you()?.id) ?? { color: '#7aa8ff', avatar: 2 };
      return html`<span class="gd-pic bot">${raw(robotSvg(r))}${p.dots && html`<span class="gd-think"><i></i><i></i><i></i></span>`}</span>`;
    }
    if (p.slots) return html`<span class="gd-pic slots">${[1, 2, 3, 4, 5].map(() => html`<i></i>`)}</span>`;
    if (p.line) return html`<span class="gd-pic line"><i></i><i></i><i></i></span>`;
    if (p.badge) return html`<span class="gd-pic badge"><b>${p.badge}</b></span>`;
    if (p.strip) return html`<span class="gd-pic strip">${[1, 2, 3, 4, 5].map((n) => html`<i class="${n === 1 && 'now'}">${n}</i>`)}</span>`;
    if (p.stack) return html`<span class="gd-pic stack">${card('sp')}${card('sp')}</span>`;
    if (p.pair) return html`<span class="gd-pic pair">${p.pair.map((t) => card(t))}</span>`;
    if (p.arrows) return html`<span class="gd-pic arrows">${[0, 1, 2, 3].map((d) => html`<i class="d${d}">${g('m1')}</i>`)}</span>`;
    if (p.course) return html`<span class="gd-pic course"><img alt="" src="${courseThumb(v?.opts?.course ?? 'closing-time')}"></span>`;
    if (p.kind) return html`<span class="gd-pic kind"><b>∞</b><b class="t">1×</b></span>`;
    return '';
  }
  const iconHtml = (ic) => {
    if (ic.g) return html`<span class="gd-ic ${ic.tone}">${g(ic.g)}</span>`;
    if (ic.card) return html`<span class="gd-ic">${card(ic.card, 'ic')}</span>`;
    if (ic.badge) return html`<span class="gd-ic badge">${ic.badge}</span>`;
    if (ic.robot) return html`<span class="gd-ic">${raw(robotSvg({ color: color(), avatar: formOf(you() ?? {}) }))}</span>`;
    if (ic.up) return html`<span class="gd-ic"><i class="gd-diamond"></i></span>`;
    return '';
  };
  function mountClips(el) {
    for (const cv of el.querySelectorAll('canvas[data-demo]:not([data-on])')) {
      cv.dataset.on = '1';
      mountDemo(cv, cv.dataset.demo, color(), { safeEdges: getView()?.opts?.lessDeadly, form: formOf(you() ?? {}), lazy: cv.dataset.lazy === '1' });
    }
    drawCellPics(el);
  }

  // ----- what a topic says, here and now -----
  function resolve(id, arg) {
    const t = TOPICS[id];
    if (!t) return null;
    const v = getView();
    const m = v?.me;
    const out = { ...t, id, arg, clips: [...t.clips] };
    if (id === 'haywire-slot') {
      const hw = arg && HAYWIRE[cardType(arg)] ? cardType(arg) : null;
      if (hw) {
        // the card in this slot: exactly what it will do, first; what a Haywire slot is, in the small print
        out.clips.unshift([hw, 'What it does']);
        out.name = TOPICS[hw].name;
        out.does = TOPICS[hw].does;
        // during the race it's the card waiting under a slot: it runs there next round
        if (v?.phase === 'activate') out.fine = 'It landed under this slot when you were hit. Next round it runs here and can’t be moved.';
      }
    } else if (id === 'your-upgrades') {
      const list = m ? [...m.up.perm, ...m.up.temp] : [];
      out.clips = list.slice(0, 6).map((k) => [k, UPGRADES[k].name]);
      out.fine = list.length === 1 ? UPGRADES[list[0]].text : '';
    } else if (id === 'course') out.name = COURSE_TITLES[v?.opts?.course] ?? '';
    else if ((id === 'deck' || id === 'discard') && m) out.counts = { deck: m.deck, discard: m.discard };
    else if (id === 'robot' && arg) {
      // a robot on the map: its name, and its installed upgrades (face up for everyone, as in the board game)
      const r = v?.robots?.find((q) => q.id === arg);
      if (r) {
        out.name = r.name;
        out.clips = [...(r.ups ?? []).slice(0, 6).map((k) => [k, UPGRADES[k].name]), ...out.clips];
      }
    }
    else if (id === 'flag' && arg) out.fine = t.fine;
    else if (id === 'battery' && v?.opts && !v.opts.upgrades) out.fine = 'With upgrades off there’s no energy: batteries do nothing.';
    return out;
  }

  /** What "?" opens when a decision is waiting: that upgrade. */
  function promptTopic(p) {
    if (p.kind === 'weapon') return p.options.map((x) => String(x.v)).find((k) => UPGRADES[k]) ?? 'robot-laser';
    if (p.kind === 'window') return 'arm';
    if (UPGRADES[p.icon]) return p.icon;
    return 'decide';
  }

  // ----- Point mode -----
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return null;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return hit && (el.contains(hit) || hit.contains(el) || hit.closest?.('[data-ask]') === el) ? r : null;
  };
  function openPoint() {
    if (pointing) return closePoint();
    closeHelp();
    markOpened();
    pointing = true;
    layer.classList.add('pointing');
    pl().classList.add('gd-pointing');
    layer.querySelector('.gd-point')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'gd-point';
    wrap.innerHTML = String(html`
      <div class="gd-dim"></div><div class="gd-outlines"></div><div class="gd-capture"></div>
      <div class="gd-tray"><span class="gd-tray-say">${g('tap')}Tap anything</span><button class="gd-round" data-gd="close-point" aria-label="Close">${g('cross')}</button></div>`);
    layer.append(wrap);
    wrap.querySelector('.gd-capture').addEventListener('click', onPointTap);
    outline(true);
    pushLayer('point');
    o.api?.vibrate?.(6);
  }
  function outline(breathe) {
    const wrap = layer.querySelector('.gd-point');
    if (!wrap) return;
    const cap = wrap.querySelector('.gd-capture');
    cap.style.pointerEvents = 'none';
    const els = [...pl().querySelectorAll('[data-ask]')];
    outlined = [];
    for (const el of els) {
      const r = visible(el);
      if (r) outlined.push({ el, r });
    }
    cap.style.pointerEvents = '';
    const ask = askRect();
    const holes = [...outlined.map((x) => x.r), ask].map(local);
    const { width: W, height: H } = layer.getBoundingClientRect();
    wrap.querySelector('.gd-dim').innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><mask id="gd-mask"><rect width="${W}" height="${H}" fill="#fff"/>${holes.map((r) => `<rect x="${r.left - 2}" y="${r.top - 2}" width="${r.width + 4}" height="${r.height + 4}" rx="8" fill="#000"/>`).join('')}</mask></defs><rect width="${W}" height="${H}" fill="rgba(3,4,7,.65)" mask="url(#gd-mask)"/></svg>`;
    wrap.querySelector('.gd-outlines').innerHTML = outlined.map(({ r }) => local(r)).map((r) => `<i class="${breathe ? 'breathe' : ''}" style="left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px"></i>`).join('');
  }
  function onPointTap(e) {
    const x = e.clientX;
    const y = e.clientY;
    const a = askRect();
    if (x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) return closePoint();
    const cap = e.currentTarget;
    cap.style.pointerEvents = 'none';
    const hits = document.elementsFromPoint(x, y);
    cap.style.pointerEvents = '';
    let el = null;
    for (const h of hits) {
      if (layer.contains(h)) continue;
      el = h.closest?.('[data-ask]');
      if (el) break;
    }
    if (!el) {
      // nothing here: the nearest outlined thing within 24 px
      let best = 25;
      for (const { el: q, r } of outlined) {
        const dx = Math.max(r.left - x, 0, x - r.right);
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = Math.hypot(dx, dy);
        if (d < best) {
          best = d;
          el = q;
        }
      }
    }
    if (el) openFor(el, x, y, 'point');
  }
  function closePoint(fromHistory) {
    if (!pointing) return;
    pointing = false;
    layer.classList.remove('pointing');
    pl().classList.remove('gd-pointing');
    layer.querySelector('.gd-point')?.remove();
    popLayer('point', fromHistory);
  }

  /** Open whatever an element with data-ask is about. */
  function openFor(el, x, y, from) {
    const ask = el.dataset.ask ?? '';
    if (ask === 'map') {
      const ids = o.mapTopics?.(el, x, y) ?? [];
      if (ids.length) openEntry(ids[0], { also: ids.slice(1), from });
      return;
    }
    const [id, arg] = ask.split(':');
    if (id === 'replay') return openReplay(Number(arg), from);
    openEntry(id, { arg, from });
  }

  // ----- the entry sheet -----
  function openEntry(ask, { arg, also = [], from = null } = {}) {
    let id = ask;
    if (arg == null && ask.includes(':')) [id, arg] = ask.split(':');
    const t = resolve(id, arg);
    if (!t) return;
    markOpened();
    const replacing = !!sheet;
    closeSheet(false, true);
    const el = document.createElement('div');
    el.className = 'gd-sheet';
    const clips = t.clips.filter(([k]) => hasDemo(k));
    const many = clips.length > 3;
    el.innerHTML = String(html`
      <div class="gd-sheet-box">
        <div class="gd-head">${pic(t.pic, arg)}${t.name && html`<b class="gd-name">${t.name}</b>`}
          ${t.counts && html`<span class="gd-counts"><span>${g('deck')}<b>${t.counts.deck}</b></span><span class="discard">${card('back', 'mini')}<b>${t.counts.discard}</b></span></span>`}</div>
        ${also.length > 0 && html`<div class="gd-also">${also.map((a) => html`<button class="gd-also-chip" data-gd="also" data-arg="${a}" data-also="${JSON.stringify([ask, ...also.filter((b) => b !== a)])}">${pic(TOPICS[a.split(':')[0]]?.pic, a.split(':')[1])}</button>`)}</div>`}
        ${clips.length > 0 && html`<div class="gd-clips n${Math.min(clips.length, 3)} ${many && 'many'}">${clips.map(([key, cap]) => html`<figure class="gd-clip"><canvas data-demo="${key}"></canvas>${cap && html`<figcaption>${cap}</figcaption>`}</figure>`)}</div>`}
        ${t.does && html`<p class="gd-does">${t.does.replace(/ (?=\d)/g, '\u00a0')}</p>`}
        ${t.fine && html`<p class="gd-fine">${t.fine}</p>`}
        <div class="gd-row"><button class="gd-pill" data-gd="book" data-arg="${id}" aria-label="Book">${g('book')}</button><button class="gd-x" data-gd="close-sheet" aria-label="Close">${g('cross')}</button></div>
      </div>`);
    layer.append(el);
    el.dataset.topic = arg != null ? `${id}:${arg}` : id;
    el.dataset.also = also.join(' ');
    sheet = { el, kind: 'entry', from, id };
    mountClips(el);
    refocus();
    swipeToClose(el.querySelector('.gd-sheet-box'), closeSheet);
    if (!replacing) pushLayer('sheet');
    o.api?.vibrate?.(6);
  }
  function closeSheet(fromHistory, replacing) {
    if (!sheet) return;
    sheet.el.remove();
    const was = sheet;
    sheet = null;
    if (!replacing) {
      popLayer('sheet', fromHistory);
      refocus();
      if (was.from === 'point' && pointing) outline(false);
    }
  }
  function swipeToClose(box, close) {
    let y0 = null;
    box.addEventListener('touchstart', (e) => {
      y0 = box.scrollTop <= 0 ? e.touches[0].clientY : null;
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      box.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
    }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = (e.changedTouches[0]?.clientY ?? y0) - y0;
      box.style.transform = '';
      y0 = null;
      if (dy > 90) close();
    });
  }

  // ----- the replay of one slot -----
  function openReplay(reg, from = null) {
    const v = getView();
    const m = v?.me;
    if (!v || !m || !(reg >= 0 && reg < 5)) return;
    markOpened();
    const replacing = !!sheet;
    closeSheet(false, true);
    const story = m.story;
    const steps = story?.regs?.[reg] ?? [];
    const auto = (m.auto ?? []).includes(reg);
    const fallback = (m.regs?.[reg]?.cards ?? []).map(cardType);
    const cards = ranCards(steps, story?.round === v.round || v.phase === 'activate' ? fallback : []);
    const robots = v.robots.map((r) => ({ ...r, form: formOf(r) }));
    const el = document.createElement('div');
    el.className = 'gd-sheet replay';
    el.innerHTML = String(html`
      <div class="gd-sheet-box">
        <div class="gd-head"><span class="gd-num">${reg + 1}</span><span class="gd-ran">${cards.map((c) => card(c.t, c.was ? 'was' : ''))}</span></div>
        <div class="gd-replay"><canvas></canvas></div>
        <div class="gd-causes">${raw(causesFor(steps, { auto }).map((x) => markHtml(x, robots)).join(''))}</div>
        <div class="gd-row nav">
          <button class="gd-round" data-gd="replay" data-arg="${reg - 1}" ${reg <= 0 ? 'disabled' : ''} aria-label="Previous slot">${g('left')}</button>
          <button class="gd-round" data-gd="replay" data-arg="${reg + 1}" ${reg >= 4 ? 'disabled' : ''} aria-label="Next slot">${g('right')}</button>
          <button class="gd-x" data-gd="close-sheet" aria-label="Close">${g('cross')}</button>
        </div>
      </div>`);
    layer.append(el);
    sheet = { el, kind: 'replay', from, reg };
    const ghosts = plannedFor(story?.round, reg);
    mountReplay(el.querySelector('canvas'), { course: getCourse(v.opts.course), steps, planned: ghosts, color: color(), form: formOf(you() ?? {}), robots, perimeter: !!v.opts.lessDeadly, inert: !v.opts.upgrades });
    refocus();
    swipeToClose(el.querySelector('.gd-sheet-box'), closeSheet);
    if (!replacing) pushLayer('sheet');
  }
  function plannedFor(round, reg) {
    return round != null ? o.getPlanned?.(round, reg) ?? [] : [];
  }

  // ----- Help: what this screen wants from you now, and the ways on -----
  /** The topics of what's on the screen I came from (Help's strip). */
  function nowTopics() {
    const v = getView();
    const m = v?.me;
    const out = [];
    const add = (ask) => {
      if (ask && !out.includes(ask) && TOPICS[ask.split(':')[0]]) out.push(ask);
    };
    if (o.shell) return out;
    if (pl().querySelector('.pr')) {
      // the test drive is on the screen: its slots, its line
      add('slots');
      add('line');
      return out;
    }
    if (v?.phase === 'program' && m && !m.mustReturn) {
      // programming: the slots, the line, the lock, the timer, each kind of card in my hand, what's special now
      add('slots');
      add('line');
      add('lock');
      if (v.opts.timer) add('timer');
      for (const id of m.hand) add(cardTopic(id));
      m.regs.forEach((r) => r.locked && add(`haywire-slot:${cardType(r.cards[0] ?? 'hw')}`));
      if (m.rb) add('reboot-dir');
    } else {
      for (const el of pl().querySelectorAll('[data-ask]')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || el.closest('.pl-sheet[hidden]')) continue;
        const ask = el.dataset.ask;
        if (ask === 'map') add('me');
        else if (ask.startsWith('robot:') || ask.startsWith('decide:')) add(ask.split(':')[0]);
        else if (!ask.startsWith('replay:')) add(ask);
      }
    }
    if (m && ['program', 'activate'].includes(v.phase)) {
      if (m.up.perm.length + m.up.temp.length) add('your-upgrades');
      add('deck');
    }
    return out;
  }
  /** What this screen is for: the topic Help leads with. */
  function leadTopic() {
    const v = getView();
    if (o.shell || !v) return 'goal';
    if (pl().querySelector('.pr')) return 'slots';
    if (!v.inRace && v.phase !== 'setup') return 'watch';
    if (v.phase === 'setup') return you()?.isVip ? 'goal' : 'watch';
    if (v.phase === 'activate' && v.me && !v.me.on) return 'fall';
    return LEAD[v.phase] ?? 'goal';
  }
  const clipsOf = (ask) => resolve(...ask.split(':'))?.clips.filter(([k]) => hasDemo(k)) ?? [];
  /** A tile: a topic's looping clip (or its picture) and a caption of a few words. Tapping it opens the topic. */
  const tileHtml = ({ ask, id, clip, cap }) => {
    const arg = ask.split(':')[1];
    const t = resolve(id, arg);
    return html`<button class="gd-tile" data-gd="tile" data-arg="${ask}" data-topic="${id}" data-clip="${clip?.[0] ?? ''}">
      ${clip ? html`<canvas data-demo="${clip[0]}" data-lazy="1"></canvas>` : html`<span class="gd-tile-pic">${pic(t.pic, arg)}</span>`}
      <span class="gd-cap">${t.sec === 'haywire' && !t.name ? card(id, 'ic') : html`${t.sec === 'cards' && card(id, 'ic')}${cap}`}</span></button>`;
  };
  /** Start the lazy clips (and my last round's replays) in a layer; root: its scroll box. */
  function mountLazy(el, root) {
    const v = getView();
    for (const cv of el.querySelectorAll('canvas[data-demo][data-lazy]:not([data-on])')) {
      cv.dataset.on = '1';
      mountDemo(cv, cv.dataset.demo, color(), { safeEdges: v?.opts?.lessDeadly, form: formOf(you() ?? {}), lazy: true, root });
    }
    const story = v?.me?.story;
    if (story) {
      const robots = v.robots.map((r) => ({ ...r, form: formOf(r) }));
      for (const cv of el.querySelectorAll('canvas[data-replay]:not([data-on])')) {
        cv.dataset.on = '1';
        const i = Number(cv.dataset.replay);
        mountReplay(cv, { course: getCourse(v.opts.course), steps: story.regs?.[i] ?? [], planned: plannedFor(story.round, i), color: color(), form: formOf(you() ?? {}), robots, lazy: true, root, perimeter: !!v.opts.lessDeadly, inert: !v.opts.upgrades });
      }
    }
    mountClips(el);
  }

  function openHelp() {
    markOpened();
    closePoint();
    closeSheet();
    if (home) home.el.remove();
    else pushLayer('help');
    const v = getView();
    const lead = leadTopic();
    const [first, ...rest] = bookTiles([lead, ...nowTopics().filter((a) => a !== lead)], clipsOf);
    const t = resolve(lead);
    // last round: a replay per slot I was on the board for (an empty slot would replay nothing)
    const story = v?.me?.story;
    const showLast = !o.shell && !!story && ((v.phase === 'program' && v.round >= 2) || v.phase === 'activate');
    const replays = showLast ? [0, 1, 2, 3, 4].filter((i) => story.regs?.[i]?.length) : [];
    const el = document.createElement('div');
    el.className = 'gd-sheet gd-help';
    el.innerHTML = String(html`
      <div class="gd-sheet-box gd-home">
        ${t && html`<button class="gd-now" data-gd="tile" data-arg="${lead}" data-topic="${lead}">
          ${first?.clip ? html`<canvas data-demo="${first.clip[0]}"></canvas>` : html`<span class="gd-tile-pic">${pic(t.pic)}</span>`}
          <span class="gd-say">${t.does ?? t.fine}</span></button>`}
        <div class="gd-menu">
          ${!o.shell && html`<button class="gd-act" data-gd="point">${g('tap')}<span>What’s this?</span></button>`}
          <button class="gd-act" data-gd="films">${g('play')}<span>How to play</span></button>
          <button class="gd-act" data-gd="drive">${g('flag')}<span>Practice</span></button>
          <button class="gd-act" data-gd="book">${g('book')}<span>All rules</span></button>
        </div>
        <button class="gd-tips ${tipsOn() && 'on'}" data-gd="tips" role="switch" aria-checked="${String(tipsOn())}"><span>Tips while you play</span><i></i></button>
        ${rest.length > 0 && html`<div class="gd-strip"><span class="gd-strip-ic">${g('eye')}</span>${rest.slice(0, 10).map(tileHtml)}</div>`}
        ${replays.length > 0 && html`<div class="gd-strip last"><span class="gd-strip-ic">${g('undo')}</span>${replays.map((i) => html`<button class="gd-tile" data-gd="replay" data-arg="${i}"><canvas data-replay="${i}"></canvas><span class="gd-cap">${i + 1}</span></button>`)}</div>`}
        <div class="gd-row"><button class="gd-x" data-gd="close-help" aria-label="Close">${g('cross')}</button></div>
      </div>`);
    layer.append(el);
    home = { el };
    const box = el.querySelector('.gd-sheet-box');
    mountLazy(el, box);
    refocus();
    swipeToClose(box, closeHelp);
    o.api?.vibrate?.(6);
  }
  function closeHelp(fromHistory) {
    if (!home) return;
    home.el.remove();
    home = null;
    popLayer('help', fromHistory);
    refocus();
  }

  // ----- "How to play": the game in four clips, one at a time (swipe), a sentence under each -----
  async function openFilms() {
    const n = await filmCount();
    if (!n) return;
    if (films) films.el.remove();
    else pushLayer('films');
    const el = document.createElement('div');
    el.className = 'gd-book gd-films';
    const a = askRect();
    el.innerHTML = String(html`
      <header class="gd-book-top"><span class="gd-book-ic">${g('play')}</span><button class="gd-book-x" data-gd="close-films" aria-label="Close" style="right:${Math.max(4, layer.getBoundingClientRect().right - a.right)}px">${g('cross')}</button></header>
      <div class="gd-reel">${Array.from({ length: n }, (_, i) => html`<figure class="gd-film"><canvas data-film="${i + 1}"></canvas><figcaption><b>${i + 1}</b><span>${FILM_SAYS[i] ?? ''}</span></figcaption></figure>`)}</div>
      <nav class="gd-dots">${Array.from({ length: n }, (_, i) => html`<button data-gd="film" data-arg="${i}" aria-label="Clip ${i + 1}"><i></i></button>`)}</nav>`);
    layer.append(el);
    const reel = el.querySelector('.gd-reel');
    const canvases = [...el.querySelectorAll('canvas[data-film]')];
    const dots = [...el.querySelectorAll('.gd-dots button')];
    const stops = canvases.map(() => null);
    let at = -1;
    // the clip in view plays from its start; the others hold still
    const show = () => {
      const i = Math.max(0, Math.min(n - 1, Math.round(reel.scrollLeft / Math.max(1, reel.clientWidth))));
      dots.forEach((b, k) => b.classList.toggle('on', k === i));
      if (i === at) return;
      at = i;
      canvases.forEach((cv, k) => {
        stops[k]?.();
        stops[k] = mountDemo(cv, `film-${k + 1}`, color(), { form: formOf(you() ?? {}), lazy: k !== i, root: reel });
      });
    };
    reel.addEventListener('scroll', show, { passive: true });
    films = { el, reel };
    refocus();
    show();
  }
  function closeFilms(fromHistory) {
    if (!films) return;
    films.el.remove();
    films = null;
    popLayer('films', fromHistory);
    refocus();
  }

  // ----- the test drive (practice.js), from Help: any time, as often as you like -----
  function openDrive() {
    if (driving) return;
    const el = document.createElement('div');
    el.className = 'gd-book gd-drive';
    const a = askRect();
    el.innerHTML = String(html`
      <header class="gd-book-top"><span class="gd-book-ic">${g('flag')}</span><button class="gd-book-x" data-gd="close-drive" aria-label="Close" style="right:${Math.max(4, layer.getBoundingClientRect().right - a.right)}px">${g('cross')}</button></header>
      <div class="gd-drive-box"></div>`);
    layer.append(el);
    const ui = mountPractice(el.querySelector('.gd-drive-box'), {
      color: color(),
      form: formOf(you() ?? {}),
      vibrate: (p) => o.api?.vibrate?.(p),
      onDone() {
        // this phone has driven it: the Briefing's practice stage won't wait for it
        store.set('rr.practiced', '1');
        o.api?.send?.('practice', { level: ui.level, done: true });
        setTimeout(() => driving?.ui === ui && closeDrive(), 1500);
      },
    });
    driving = { el, ui };
    pushLayer('drive');
    refocus();
  }
  function closeDrive(fromHistory) {
    if (!driving) return;
    driving.ui.destroy();
    driving.el.remove();
    driving = null;
    popLayer('drive', fromHistory);
    refocus();
  }

  // ----- the Book: every rule, by subject. An index of the subjects, then a page of clips for one -----
  function openBook({ scrollTo = null } = {}) {
    markOpened();
    closePoint();
    if (book) book.el.remove();
    else pushLayer('book');
    const el = document.createElement('div');
    el.className = 'gd-book';
    const a = askRect();
    el.innerHTML = String(html`
      <header class="gd-book-top"><button class="gd-book-back" data-gd="book-index" aria-label="Back">${g('left')}</button><span class="gd-book-ic">${g('book')}</span><b class="gd-book-title"></b>
        <button class="gd-book-x" data-gd="close-book" aria-label="Close" style="right:${Math.max(4, layer.getBoundingClientRect().right - a.right)}px">${g('cross')}</button></header>
      <nav class="gd-index">${SECTIONS.map((s) => html`<button class="gd-idx" data-gd="sec" data-arg="${s.id}">${iconHtml(s.icon)}<span>${s.label}</span></button>`)}</nav>
      <div class="gd-book-body"></div>`);
    layer.append(el);
    book = { el, body: el.querySelector('.gd-book-body'), title: el.querySelector('.gd-book-title'), sec: null, viaIndex: false };
    // from a topic (an entry's book): straight to its subject's page, that tile pulsing
    const sec = TOPICS[scrollTo?.split(':')[0]]?.sec;
    if (sec && SECTIONS.some((x) => x.id === sec)) showSection(sec, scrollTo);
    else showIndex();
    refocus();
  }
  function showIndex() {
    if (!book) return;
    book.sec = null;
    book.viaIndex = false;
    book.el.dataset.view = 'index';
    book.body.innerHTML = '';
    book.title.innerHTML = '';
  }
  function showSection(id, pulse = null) {
    const s = SECTIONS.find((x) => x.id === id);
    if (!book || !s) return;
    book.viaIndex = book.el.dataset.view === 'index';
    book.sec = id;
    book.el.dataset.view = 'sec';
    book.body.dataset.sec = id;
    book.title.innerHTML = String(html`${iconHtml(s.icon)}<span>${s.label}</span>`);
    // each clip once: a topic whose clip is already there shows its next one, or no tile
    book.body.innerHTML = String(html`<div class="gd-tiles">${bookTiles(sectionTopics(id), clipsOf).map(tileHtml)}</div>`);
    book.body.scrollTop = 0;
    mountLazy(book.el, book.body);
    if (!pulse) return;
    const topic = pulse.split(':')[0];
    const tile = book.body.querySelector(`.gd-tile[data-arg="${CSS.escape(pulse)}"]`) ?? book.body.querySelector(`.gd-tile[data-topic="${CSS.escape(topic)}"]`);
    if (!tile) return;
    tile.scrollIntoView({ block: 'center' });
    tile.classList.add('pulse');
    setTimeout(() => tile.classList.remove('pulse'), 1600);
  }
  /** Back: from a subject's page to the index it was opened from; otherwise the Book closes. */
  function backInBook(fromHistory) {
    if (!book?.sec || !book.viaIndex) return closeBook(fromHistory);
    showIndex();
    if (fromHistory) {
      // (the back gesture used up the Book's place in the history: it's still open, so it gets it back)
      try {
        history.pushState({ gd: stack.length }, '');
      } catch {}
    }
  }
  function closeBook(fromHistory) {
    if (!book) return;
    book.el.remove();
    book = null;
    popLayer('book', fromHistory);
    refocus();
  }

  // ----- clicks inside the guide's own layers -----
  layer.addEventListener('click', (e) => {
    // a tap anywhere outside the sheet (on the dimmed backdrop) closes it
    if (sheet && e.target === sheet.el) {
      e.stopPropagation();
      return closeSheet();
    }
    if (home && e.target === home.el) {
      e.stopPropagation();
      return closeHelp();
    }
    const b = e.target.closest('[data-gd]');
    if (!b) return;
    e.stopPropagation();
    const arg = b.dataset.arg;
    switch (b.dataset.gd) {
      case 'close-point': return closePoint();
      case 'close-sheet': return closeSheet();
      case 'close-book': return closeBook();
      case 'close-help': return closeHelp();
      case 'close-films': return closeFilms();
      case 'close-drive': return closeDrive();
      case 'point': return openPoint();
      case 'films': return openFilms();
      case 'drive': return openDrive();
      case 'tips': {
        // the coach's tips, on or off (the screen behind draws again: a tip goes, or the next one comes)
        setTips(!tipsOn());
        b.classList.toggle('on', tipsOn());
        b.setAttribute('aria-checked', String(tipsOn()));
        o.api?.vibrate?.(6);
        return o.onTips?.(tipsOn());
      }
      case 'film': return films?.reel.scrollTo({ left: Number(arg) * films.reel.clientWidth, behavior: 'smooth' });
      case 'book-index': return backInBook();
      case 'book': {
        const from = sheet?.id ?? arg ?? null;
        closeSheet();
        return openBook({ scrollTo: from });
      }
      case 'also': return openEntry(arg, { also: JSON.parse(b.dataset.also ?? '[]'), from: sheet?.from });
      case 'tile': {
        const [id, a] = arg.split(':');
        return openEntry(id, { arg: a, from: book ? 'book' : 'help' });
      }
      case 'replay': return openReplay(Number(arg), sheet?.from ?? (book ? 'book' : home ? 'help' : null));
      case 'sec': return showSection(arg);
    }
  });

  // ----- the game screen: "?" taps, plain taps on passive things, long-presses -----
  const onClick = (e) => {
    if (swallow) {
      swallow = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (e.target.closest('[data-guide="ask"]')) {
      e.stopPropagation();
      const v = getView();
      if (v?.prompt) return openEntry(promptTopic(v.prompt), {}); // a decision is waiting: what it's about
      if (pointing) return closePoint();
      return home ? closeHelp() : openHelp();
    }
    const passive = e.target.closest('[data-tap="ask"][data-ask]');
    if (passive && !pointing) {
      e.stopPropagation();
      e.preventDefault();
      openFor(passive, e.clientX, e.clientY, null);
    }
  };
  const onDown = (e) => {
    if (pointing || e.button > 0) return;
    if (e.isPrimary === false) {
      // a second finger (a pinch on the map) isn't a long press
      clearTimeout(pressed?.t);
      pressed = null;
      return;
    }
    const el = e.target.closest?.('[data-ask]');
    if (!el) return;
    clearTimeout(pressed?.t);
    const x = e.clientX;
    const y = e.clientY;
    pressed = {
      x, y,
      t: setTimeout(() => {
        swallow = true;
        setTimeout(() => (swallow = false), 700);
        o.api?.vibrate?.(8);
        openFor(el, x, y, null);
      }, 450),
    };
  };
  const onMove = (e) => {
    if (pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 10) {
      clearTimeout(pressed.t);
      pressed = null;
    }
  };
  const onUp = () => {
    clearTimeout(pressed?.t);
    pressed = null;
  };
  if (!o.shell) {
    root.addEventListener('click', onClick, true);
    root.addEventListener('pointerdown', onDown, true);
    root.addEventListener('pointermove', onMove, true);
    root.addEventListener('pointerup', onUp, true);
    root.addEventListener('pointercancel', onUp, true);
    root.addEventListener('contextmenu', (e) => e.target.closest?.('[data-ask]') && e.preventDefault());
  }
  const onResize = () => pointing && outline(false);
  window.addEventListener('resize', onResize);

  // ----- the Guide's own reminder: the "?" pulses (what is new on the screen is the coach's to say: coach.js) -----
  function ring(rect, times = 2, cls = '') {
    if (!rect || !rect.width) return;
    rect = local(rect);
    const i = document.createElement('i');
    i.className = `gd-ring ${cls}`;
    i.style.cssText = `left:${rect.left - 3}px;top:${rect.top - 3}px;width:${rect.width + 6}px;height:${rect.height + 6}px;animation-iteration-count:${times}`;
    layer.append(i);
    setTimeout(() => i.remove(), times * 900 + 200);
  }
  function pulseAsk(times = 3) {
    ring(askRect(), times, 'round');
  }
  function fire(id, { el, times = 2, always = false } = {}) {
    if (!always && cued.has(id)) return false;
    if (always && session.has(id)) return false;
    session.add(id);
    if (!always) {
      cued.add(id);
      store.set('rr.cued', JSON.stringify([...cued]));
    }
    if (el === 'ask') pulseAsk(times);
    else if (el) ring(el.getBoundingClientRect(), times);
    return true;
  }
  function checkCues(v) {
    const m = v?.me;
    if (!v || !m || o.shell) return;
    const phase = v.phase;
    // on a phone that never opened it, every new page; else once ever
    if (phase === 'program' && !m.mustReturn) fire('guide', { el: 'ask', times: 3, always: !opened() });
    if (lastPhase === 'brief' && phase !== 'brief') fire('brief-end', { el: 'ask', times: 3, always: !opened() });
  }

  return {
    /** Call after every render: keeps Point mode's outlines in place and checks its own reminders. */
    refresh() {
      const v = getView();
      if (v?.phase !== lastPhase && pointing) closePoint();
      if (pointing) requestAnimationFrame(() => outline(false));
      checkCues(v);
      lastPhase = v?.phase ?? null;
    },
    open: (ask) => {
      const [id, arg] = ask.split(':');
      return id === 'replay' ? openReplay(Number(arg)) : openEntry(id, { arg });
    },
    openHelp,
    openBook,
    openReplay,
    get busy() {
      return pointing || !!sheet || !!book || !!home || !!films || !!driving;
    },
    destroy() {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('resize', onResize);
      driving?.ui.destroy();
      layer.remove();
      setDemoFocus(null);
    },
  };
}

function parseList(text) {
  try {
    const v = JSON.parse(text ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------- the lobby's waiting screen (the shell): Help, without the pointing (nothing there to point at) ----------
let shellGuide = null;
const shellApi = { you: null, vibrate: (p) => { try { navigator.vibrate?.(p); } catch {} } };
/** Open Help from outside the game (public/js/play.js calls it openBook). o: { context: 'lobby', color, you } */
export function openBook(o = {}) {
  if (o.color) document.documentElement.style.setProperty('--me', o.color);
  shellApi.you = o.you ?? (o.color ? { color: o.color } : null);
  shellGuide ??= mountGuide(document.body, { shell: true, getView: () => null, api: shellApi });
  return shellGuide.openHelp();
}
