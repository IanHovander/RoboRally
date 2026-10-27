// The phone's Guide: one "?" button. Tap it, then tap anything on the screen (a card, a slot, a square
// of the map): that thing's questions are answered with looping clips. One tap deeper, the Book shows
// every clip under mechanics headers. New things flag themselves once (a pulse, a chip under the "?").
//   in the game:  const guide = mountGuide(root, { getView, api, mapTopics, getPlanned });  guide.refresh() after each render
//   the lobby:    openBook({ context: 'lobby', color })
// Anything with data-ask="topic[:arg]" can be pointed at; data-tap="ask" also opens it on a plain tap.
import { html, raw, loadCss } from '../../js/ui.js';
import { svgGlyph, cardSvgHtml, robotSvg, formOf, COURSE_TITLES } from './glyphs.js';
import { mountDemo, hasDemo, setDemoFocus, miniCourse, filmCount } from './demo.js';
import { drawCourse } from './minimap.js';
import { getCourse } from './board.js';
import { UPGRADES, HAYWIRE, cardType } from './cards.js';
import { TOPICS, SECTIONS, EXTRA_SECTIONS, sectionTopics, bookTiles, cardTopic } from './topics.js';
import { mountReplay, ranCards, causesFor, markHtml } from './replay.js';

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

  let pointing = false;
  let outlined = [];
  let sheet = null; // { el, kind: 'entry' | 'replay', from }
  let book = null; // { el }
  let chip = null; // { el, open, timer, phase }
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
  function pushLayer(name) {
    stack.push(name);
    try {
      history.pushState({ gd: stack.length }, '');
    } catch {}
  }
  function popLayer(name, fromHistory) {
    const i = stack.lastIndexOf(name);
    if (i < 0) return;
    stack.splice(i, 1);
    if (!fromHistory) {
      ignorePops++;
      try {
        history.back();
      } catch {
        ignorePops--;
      }
    }
  }
  const onPop = () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const top = stack.at(-1);
    if (top === 'point') closePoint(true);
    else if (top === 'sheet') closeSheet(true);
    else if (top === 'book') closeBook(true);
  };
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
    const v = getView();
    if (v?.prompt) return openEntry(promptTopic(v.prompt), {});
    if (pointing) return closePoint();
    markOpened();
    pointing = true;
    layer.classList.add('pointing');
    pl().classList.add('gd-pointing');
    layer.querySelector('.gd-point')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'gd-point';
    wrap.innerHTML = String(html`
      <div class="gd-dim"></div><div class="gd-outlines"></div><div class="gd-capture"></div>
      <div class="gd-tray"><button class="gd-pill" data-gd="book" aria-label="Book">${g('book')}</button><button class="gd-round" data-gd="close-point" aria-label="Close">${g('cross')}</button></div>`);
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
    const holes = [...outlined.map((x) => x.r), ask];
    const W = innerWidth;
    const H = innerHeight;
    wrap.querySelector('.gd-dim').innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><mask id="gd-mask"><rect width="${W}" height="${H}" fill="#fff"/>${holes.map((r) => `<rect x="${r.left - 2}" y="${r.top - 2}" width="${r.width + 4}" height="${r.height + 4}" rx="8" fill="#000"/>`).join('')}</mask></defs><rect width="${W}" height="${H}" fill="rgba(3,4,7,.65)" mask="url(#gd-mask)"/></svg>`;
    wrap.querySelector('.gd-outlines').innerHTML = outlined.map(({ r }) => `<i class="${breathe ? 'breathe' : ''}" style="left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px"></i>`).join('');
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
        <div class="gd-row"><button class="gd-pill" data-gd="book" data-arg="${id}" aria-label="Book">${g('book')}</button><button class="gd-x" data-gd="close-sheet" aria-label="Close">${g('cross')}</button><span></span></div>
      </div>`);
    layer.append(el);
    el.dataset.topic = arg != null ? `${id}:${arg}` : id;
    el.dataset.also = also.join(' ');
    sheet = { el, kind: 'entry', from, id };
    mountClips(el);
    setDemoFocus(el);
    swipeToClose(el.querySelector('.gd-sheet-box'));
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
      setDemoFocus(book?.el ?? null);
      if (was.from === 'point' && pointing) outline(false);
    }
  }
  function swipeToClose(box) {
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
      if (dy > 90) closeSheet();
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
          <button class="gd-x" data-gd="close-sheet" aria-label="Close">${g('cross')}</button>
          <button class="gd-round" data-gd="replay" data-arg="${reg + 1}" ${reg >= 4 ? 'disabled' : ''} aria-label="Next slot">${g('right')}</button>
        </div>
      </div>`);
    layer.append(el);
    sheet = { el, kind: 'replay', from, reg };
    const ghosts = plannedFor(story?.round, reg);
    mountReplay(el.querySelector('canvas'), { course: getCourse(v.opts.course), steps, planned: ghosts, color: color(), form: formOf(you() ?? {}), robots, perimeter: !!v.opts.lessDeadly, inert: !v.opts.upgrades });
    setDemoFocus(el);
    swipeToClose(el.querySelector('.gd-sheet-box'));
    if (!replacing) pushLayer('sheet');
  }
  function plannedFor(round, reg) {
    return round != null ? o.getPlanned?.(round, reg) ?? [] : [];
  }

  // ----- the Book -----
  function nowTopics() {
    const v = getView();
    const m = v?.me;
    const out = [];
    const add = (ask) => {
      if (ask && !out.includes(ask) && TOPICS[ask.split(':')[0]]) out.push(ask);
    };
    if (chip?.open) add(chip.open);
    if (o.shell) return out;
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
  async function openBook({ scrollTo = null } = {}) {
    markOpened();
    closePoint();
    const v = getView();
    const lobby = o.shell || !v || !v.inRace || (v.phase === 'setup' && !you()?.isVip);
    const story = v?.me?.story;
    const showLast = !!story && ((v.phase === 'program' && v.round >= 2) || v.phase === 'activate');
    const films = lobby ? await filmCount() : 0;
    const now = lobby && o.shell ? [] : nowTopics();
    const secs = [];
    if (now.length) secs.push({ ...EXTRA_SECTIONS.now, tiles: now });
    // last round: a replay per slot I was on the board for (an empty slot would replay nothing)
    const replays = showLast ? [0, 1, 2, 3, 4].filter((i) => story.regs?.[i]?.length) : [];
    if (replays.length) secs.push({ ...EXTRA_SECTIONS.last, replays });
    if (films) secs.push({ ...EXTRA_SECTIONS.film, films });
    for (const s of SECTIONS) secs.push({ ...s, tiles: sectionTopics(s.id) });
    if (book) book.el.remove();
    const el = document.createElement('div');
    el.className = 'gd-book';
    const a = askRect();
    // each clip once per section: a topic whose clip is already there shows its next one, or no tile
    const clipsOf = (ask) => resolve(...ask.split(':'))?.clips.filter(([k]) => hasDemo(k)) ?? [];
    const tile = ({ ask, id, clip, cap }) => {
      const arg = ask.split(':')[1];
      const t = resolve(id, arg);
      return html`<button class="gd-tile" data-gd="tile" data-arg="${ask}" data-topic="${id}" data-clip="${clip?.[0] ?? ''}">
        ${clip ? html`<canvas data-demo="${clip[0]}" data-lazy="1"></canvas>` : html`<span class="gd-tile-pic">${pic(t.pic, arg)}</span>`}
        <span class="gd-cap">${t.sec === 'haywire' && !t.name ? card(id, 'ic') : html`${t.sec === 'cards' && card(id, 'ic')}${cap}`}</span></button>`;
    };
    el.innerHTML = String(html`
      <header class="gd-book-top"><span class="gd-book-ic">${g('book')}</span><button class="gd-book-x" data-gd="close-book" aria-label="Close" style="right:${Math.max(4, innerWidth - a.right)}px">${g('cross')}</button></header>
      <nav class="gd-chips">${secs.map((s) => html`<button data-gd="sec" data-arg="${s.id}">${iconHtml(s.icon)}<span>${s.label}</span></button>`)}</nav>
      <div class="gd-book-body">${secs.map((s) => html`
        <section class="gd-sec" data-sec="${s.id}">
          <h3>${iconHtml(s.icon)}<span>${s.label}</span></h3>
          <div class="gd-tiles">
            ${s.tiles && bookTiles(s.tiles, clipsOf).map(tile)}
            ${s.replays && s.replays.map((i) => html`<button class="gd-tile" data-gd="replay" data-arg="${i}"><canvas data-replay="${i}"></canvas><span class="gd-cap">${i + 1}</span></button>`)}
            ${s.films && Array.from({ length: s.films }, (_, i) => html`<button class="gd-tile film"><canvas data-demo="film-${i + 1}" data-lazy="1"></canvas><span class="gd-cap">${i + 1}</span></button>`)}
          </div>
        </section>`)}</div>`);
    layer.append(el);
    const body = el.querySelector('.gd-book-body');
    book = { el, body };
    // lazy clips: only those in view animate
    for (const cv of el.querySelectorAll('canvas[data-demo]')) {
      cv.dataset.on = '1';
      mountDemo(cv, cv.dataset.demo, color(), { safeEdges: v?.opts?.lessDeadly, form: formOf(you() ?? {}), lazy: true, root: body });
    }
    if (showLast) {
      const robots = v.robots.map((r) => ({ ...r, form: formOf(r) }));
      for (const cv of el.querySelectorAll('canvas[data-replay]')) {
        const i = Number(cv.dataset.replay);
        mountReplay(cv, { course: getCourse(v.opts.course), steps: story.regs?.[i] ?? [], planned: plannedFor(story.round, i), color: color(), form: formOf(you() ?? {}), robots, lazy: true, root: body, perimeter: !!v.opts.lessDeadly, inert: !v.opts.upgrades });
      }
    }
    drawCellPics(el);
    setDemoFocus(el);
    if (!stack.includes('book')) pushLayer('book');
    // the chip of the section in view is lit
    const chips = [...el.querySelectorAll('.gd-chips button')];
    const sections = [...el.querySelectorAll('.gd-sec')];
    const light = () => {
      const top = body.getBoundingClientRect().top + 12;
      let cur = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top <= top) cur = s;
      for (const c of chips) {
        const on = c.dataset.arg === cur?.dataset.sec;
        if (on && !c.classList.contains('on')) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        c.classList.toggle('on', on);
      }
    };
    body.addEventListener('scroll', light, { passive: true });
    light();
    if (scrollTo) {
      const target = el.querySelector(`.gd-tile[data-arg="${CSS.escape(scrollTo)}"]`) ?? el.querySelector(`.gd-tile[data-topic="${CSS.escape(scrollTo.split(':')[0])}"]`);
      if (target) {
        // the mechanics section's tile, not "Now"
        const deep = [...el.querySelectorAll(`.gd-tile[data-topic="${CSS.escape(scrollTo.split(':')[0])}"]`)].find((t) => !t.closest('[data-sec="now"]')) ?? target;
        deep.scrollIntoView({ block: 'center' });
        deep.classList.add('pulse');
        setTimeout(() => deep.classList.remove('pulse'), 1600);
      }
    }
  }
  function closeBook(fromHistory) {
    if (!book) return;
    book.el.remove();
    book = null;
    popLayer('book', fromHistory);
    setDemoFocus(sheet?.el ?? null);
  }

  // ----- clicks inside the guide's own layers -----
  layer.addEventListener('click', (e) => {
    // a tap anywhere outside the sheet (on the dimmed backdrop) closes it
    if (sheet && e.target === sheet.el) {
      e.stopPropagation();
      return closeSheet();
    }
    const b = e.target.closest('[data-gd]');
    if (!b) return;
    e.stopPropagation();
    const arg = b.dataset.arg;
    switch (b.dataset.gd) {
      case 'close-point': return closePoint();
      case 'close-sheet': return closeSheet();
      case 'close-book': return closeBook();
      case 'book': {
        const from = sheet?.id ?? arg ?? null;
        closeSheet();
        return openBook({ scrollTo: from });
      }
      case 'also': return openEntry(arg, { also: JSON.parse(b.dataset.also ?? '[]'), from: sheet?.from });
      case 'tile': {
        const [id, a] = arg.split(':');
        return openEntry(id, { arg: a, from: 'book' });
      }
      case 'replay': return openReplay(Number(arg), sheet?.from ?? (book ? 'book' : null));
      case 'sec': {
        const s = book?.el.querySelector(`.gd-sec[data-sec="${arg}"]`);
        if (s) book.body.scrollTo({ top: s.offsetTop - 4, behavior: 'smooth' });
        return;
      }
      case 'chip': {
        const open = chip?.open;
        foldChip();
        if (open) openEntry(open.split(':')[0], { arg: open.split(':')[1] });
        return;
      }
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
      return openPoint();
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

  // ----- first-time cues: a pulse on the new thing, a chip under the "?" -----
  function ring(rect, times = 2, cls = '') {
    if (!rect || !rect.width) return;
    const i = document.createElement('i');
    i.className = `gd-ring ${cls}`;
    i.style.cssText = `left:${rect.left - 3}px;top:${rect.top - 3}px;width:${rect.width + 6}px;height:${rect.height + 6}px;animation-iteration-count:${times}`;
    layer.append(i);
    setTimeout(() => i.remove(), times * 900 + 200);
  }
  function pulseAsk(times = 3) {
    ring(askRect(), times, 'round');
  }
  function showChip(picHtml, open) {
    foldChip();
    const a = askRect();
    const el = document.createElement('button');
    el.className = 'gd-chip';
    el.dataset.gd = 'chip';
    el.style.cssText = `top:${a.bottom + 2}px;right:${Math.max(4, innerWidth - a.right)}px`;
    el.innerHTML = String(html`${picHtml}<i>${g('ask')}</i>`);
    layer.append(el);
    mountClips(el);
    chip = { el, open, phase: getView()?.phase, timer: setTimeout(foldChip, 12000) };
  }
  function foldChip() {
    if (!chip) return;
    clearTimeout(chip.timer);
    const el = chip.el;
    el.classList.add('fold');
    setTimeout(() => el.remove(), 350);
    chip = null;
  }
  function fire(id, { el, chipPic, open, times = 2, always = false } = {}) {
    if (!always && cued.has(id)) return false;
    if (always && session.has(id)) return false;
    session.add(id);
    if (!always) {
      cued.add(id);
      store.set('rr.cued', JSON.stringify([...cued]));
    }
    if (el === 'ask') pulseAsk(times);
    else if (el) ring(el.getBoundingClientRect(), times);
    if (chipPic) showChip(chipPic, open);
    return true;
  }
  const q = (sel) => pl().querySelector(sel);
  function checkCues(v) {
    const m = v?.me;
    if (!v || !m || o.shell) return;
    const phase = v.phase;
    const prog = phase === 'program' && !m.mustReturn;
    if (prog) {
      // the Guide's own reminder: on a phone that never opened it, every new page; else once ever
      fire('guide', { el: 'ask', times: 3, always: !opened() });
      const sp = q('.pl-hand [data-ask="sp"]');
      if (sp) fire('spam-hand', { el: sp, chipPic: pic({ card: 'sp' }), open: 'sp' });
      const ag = q('.pl-hand [data-ask="ag"]');
      if (ag) fire('again', { el: ag, chipPic: pic({ card: 'ag' }), open: 'ag' });
      const hw = q('.pl-slot.locked');
      if (hw) fire('haywire-slot', { el: hw, chipPic: pic({ card: 'hw' }), open: hw.dataset.ask });
      const rb = q('.pl-reboot');
      if (m.rb && rb?.children.length) fire('reboot-dir', { el: rb, chipPic: pic({ g: 'reboot' }), open: 'reboot-dir' });
      const left = v.deadline ? v.deadline - (o.api?.now?.() ?? Date.now()) : Infinity;
      if (v.opts.timer && left <= 10_000 && left > 0 && !m.done && q('.pl-regs .pl-slot:not(.full):not(.locked)')) fire('timer', { el: q('[data-ask="timer"]'), chipPic: pic({ g: 'timer' }), open: 'timer' });
    }
    if (phase === 'upgrade' && !m.done) fire('shop', { el: q('.pl-energy'), chipPic: pic({ g: 'bolt' }), open: 'shop' });
    if (phase === 'activate') {
      const arm = q('.pl-arm');
      if (m.canArm && arm) {
        const k = m.up.temp.find((x) => ['move', 'turn'].includes(UPGRADES[x].when));
        fire('arm', { el: arm, chipPic: pic({ up: k }), open: 'arm' });
      }
      if (!m.on) fire('fallen', { chipPic: pic({ g: 'reboot' }), open: 'fall' });
    }
    if (lastPhase === 'brief' && phase !== 'brief') fire('brief-end', { el: 'ask', times: 3, always: !opened() });
  }

  return {
    /** Call after every render: keeps Point mode's outlines in place and checks the first-time cues. */
    refresh() {
      const v = getView();
      if (v?.phase !== lastPhase) {
        if (pointing) closePoint();
        if (chip && chip.phase !== v?.phase) foldChip();
      }
      if (pointing) requestAnimationFrame(() => outline(false));
      checkCues(v);
      lastPhase = v?.phase ?? null;
    },
    /** A cue the screen itself noticed (damage arriving on the race screen). */
    cue(id, picSpec, open) {
      fire(id, { chipPic: pic(picSpec), open });
    },
    open: (ask) => {
      const [id, arg] = ask.split(':');
      return id === 'replay' ? openReplay(Number(arg)) : openEntry(id, { arg });
    },
    openBook,
    openReplay,
    get busy() {
      return pointing || !!sheet || !!book;
    },
    destroy() {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('resize', onResize);
      foldChip();
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

// ---------- the lobby's waiting screen (the shell): the Book, straight away ----------
let shellGuide = null;
const shellApi = { you: null, vibrate: (p) => { try { navigator.vibrate?.(p); } catch {} } };
/** Open the Book from outside the game (public/js/play.js). o: { context: 'lobby', color, you } */
export function openBook(o = {}) {
  if (o.color) document.documentElement.style.setProperty('--me', o.color);
  shellApi.you = o.you ?? (o.color ? { color: o.color } : null);
  shellGuide ??= mountGuide(document.body, { shell: true, getView: () => null, api: shellApi });
  return shellGuide.openBook();
}
