// The test drive: the tutorial you do instead of watch. A phone gets the programming screen itself (the same
// cards, five slots, light line and lock) on three tiny courses (drills.js), and the robot runs what was
// programmed by the real rules. A wrong program runs too, then the cards come back and the next right card bobs.
// Nothing to read: a card bobs when you're stuck, the lock lights when five slots are full.
//   const p = mountPractice(box, { color, form, level, vibrate, onLevel(n), onDone(), onSkip() });  p.destroy()
// Shown while waiting (the leader is choosing a map), in the Briefing's practice stage, and from "?" (guide.js).
import { html, raw, loadCss } from '../../js/ui.js';
import { cardSvgHtml, svgGlyph } from './glyphs.js';
import { lessonFrames, paintComp } from './demo.js';
import { DRILLS, drillCourse, drillStart, drillLine, drillHint, tryDrill } from './drills.js';

const SPEED = 1.3; // the run's clock runs this much faster than a rule clip's
const IDLE_MS = 5000; // nothing tapped for this long: a nudge
const GUIDED_MS = 450; // after a program that failed, the nudges lead the way
const g = (name) => raw(svgGlyph(name));
const card = (t) => raw(cardSvgHtml(t));
let css = null;
// (the phones' own styles too: in the lobby the game's stylesheet isn't loaded yet)
const styles = () => (css ??= Promise.all(['style.css', 'practice.css'].map((f) => loadCss(new URL(`./${f}`, import.meta.url).href))));

/** How many drills there are (the big screen shows each player's progress through them). */
export const DRILL_COUNT = DRILLS.length;

/**
 * Put the test drive in `box` (it fills it). o: { color, form (the robot's shape), level (drills already done),
 * vibrate(pattern), onLevel(n) (n drills done), onDone() (all of them), onSkip() (shows a skip button) }.
 * Returns { destroy(), level }.
 */
export function mountPractice(box, o = {}) {
  styles();
  const color = o.color ?? '#f4efe4';
  box.innerHTML = String(html`
    <div class="pr" style="--me:${color}">
      <div class="pr-prog">
        <div class="pl-regs"></div>
        <div class="pl-map pr-map"><canvas></canvas><div class="pr-pips"></div></div>
        <div class="pl-hand"></div>
        <div class="pl-actions">
          <button class="pl-small" data-pr="clear" aria-label="Clear">${g('undo')}</button>
          <button class="pl-lock" data-pr="lock" aria-label="Lock in">${g('check')}</button>
          ${o.onSkip ? html`<button class="pl-small" data-pr="skip" aria-label="Skip">${g('skip')}</button>` : html`<span></span>`}
        </div>
      </div>
    </div>`);
  const root = box.firstElementChild;
  const regsEl = root.querySelector('.pl-regs');
  const mapEl = root.querySelector('.pr-map');
  const canvas = mapEl.querySelector('canvas');
  const pipsEl = root.querySelector('.pr-pips');
  const handEl = root.querySelector('.pl-hand');
  const lockEl = root.querySelector('[data-pr="lock"]');
  const clearEl = root.querySelector('[data-pr="clear"]');

  let level = Math.max(0, Math.min(DRILLS.length, o.level ?? 0)); // drills done
  let d = DRILLS[Math.min(level, DRILLS.length - 1)];
  let slots = [null, null, null, null, null]; // which card of the hand is in each slot
  let mode = 'plan'; // 'plan' | 'run' | 'won' | 'done'
  let guided = false;
  let hint = null;
  let idle = 0;
  let raf = 0;
  let alive = true;
  let runAt = 0;
  let won = false;
  let fly = null; // a card on its way into a slot: { rect, slot }
  let back = null; // cards on their way back to the hand: [{ i, rect }]
  const paint = { canvas, comp: null, color, form: o.form ?? 0, board: null, lazy: false, perimeter: false };

  const types = () => slots.map((i) => (i == null ? null : d.hand[i]));
  const full = () => slots.every((i) => i != null);
  const buzz = () => o.vibrate?.([30, 30, 30]);

  // ----- the map: my robot where it starts, and the light line of the cards placed so far -----
  function planComp() {
    const s = drillStart(d);
    const { ghosts } = drillLine(d, types());
    const bots = { L0: { x: s.x, y: s.y, d: s.d, a: s.d * 90, vis: true, scale: 1, alpha: 1 } };
    const ui = { strip: null, under: [], lit: -1, line: ghosts.length ? ghosts : null, token: null, reg: 0 };
    return { c: drillCourse(d), frames: [{ bots, fx: [], ms: 1000, ui }], total: 1000, meId: 'L0', hand: false };
  }
  function drawPlan() {
    paint.comp = planComp();
    paintComp(paint, 0);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => alive && mode !== 'run' && paintComp(paint, mode === 'plan' ? 0 : Infinity)) : null;
  ro?.observe(mapEl);

  // ----- slots, hand, lock -----
  function render() {
    const running = mode !== 'plan';
    const target = running ? -1 : slots.indexOf(null);
    regsEl.classList.toggle('run', running);
    regsEl.innerHTML = String(html`${slots.map((h, i) => html`<button class="pl-slot ${i === target && 'target'} ${h != null && 'full'} ${hint?.slot === i && 'pr-hint'}" data-pr="slot" data-i="${i}" aria-label="Slot ${i + 1}">${h != null ? card(d.hand[h]) : html`<i>${i + 1}</i>`}</button>`)}`);
    handEl.innerHTML = String(html`${d.hand.map((t, i) => {
      const used = slots.includes(i);
      return html`<span class="pl-hand-slot"><button class="pl-card ${used && 'used'} ${hint?.card === i && 'hint'}" data-pr="card" data-i="${i}" ${used || running ? 'disabled' : ''}>${card(t)}</button></span>`;
    })}`);
    lockEl.classList.toggle('live', full() && !running);
    lockEl.classList.toggle('pr-hint', !!hint?.lock && !running);
    lockEl.disabled = running;
    clearEl.disabled = running || slots.every((i) => i == null);
    pipsEl.innerHTML = DRILLS.map((_, i) => `<i class="${i < level ? 'on' : i === level ? 'now' : ''}"></i>`).join('');
    // the card just tapped flies into its slot; cards taken back fly to their place in the hand
    if (fly) {
      const c = regsEl.children[fly.slot]?.querySelector('.lm-card');
      if (c) {
        const to = c.getBoundingClientRect();
        const from = fly.rect;
        c.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      fly = null;
    }
    if (back) {
      back.forEach(({ i, rect }, n) => {
        const c = handEl.querySelector(`[data-i="${i}"] .lm-card`);
        if (!c) return;
        const to = c.getBoundingClientRect();
        c.animate([
          { transform: `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width})`, opacity: 1 },
          { transform: 'none', opacity: 1 },
        ], { duration: 260, delay: n * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
      back = null;
    }
  }

  // ----- nudges: the next card of the known route bobs (or a card that leaves it wiggles, or the lock pulses) -----
  function acted() {
    hint = null;
    clearTimeout(idle);
    if (mode === 'plan') idle = setTimeout(nudge, guided ? GUIDED_MS : IDLE_MS);
  }
  function nudge() {
    if (!alive || mode !== 'plan') return;
    hint = drillHint(d, slots);
    render();
  }

  /** Where each placed card is on the screen now (to fly it back from there). */
  const placedRects = () => slots.flatMap((i, s) => {
    const c = i == null ? null : regsEl.children[s]?.querySelector('.lm-card');
    return c ? [{ i, rect: c.getBoundingClientRect() }] : [];
  });

  function place(i, el) {
    const s = slots.indexOf(null);
    if (mode !== 'plan' || s < 0 || slots.includes(i)) return buzz();
    fly = { rect: el.getBoundingClientRect(), slot: s };
    slots[s] = i;
    o.vibrate?.(8);
    changed();
  }
  function take(s) {
    if (mode !== 'plan' || slots[s] == null) return;
    back = placedRects().filter((x) => x.i === slots[s]);
    slots[s] = null;
    changed();
  }
  function clear() {
    if (mode !== 'plan') return;
    back = placedRects();
    slots = slots.map(() => null);
    changed();
  }
  function changed() {
    acted();
    render();
    drawPlan();
  }

  // ----- lock in: the robot runs the program, by the real rules -----
  function lock() {
    if (mode !== 'plan') return;
    if (!full()) return buzz();
    const res = tryDrill(d, types());
    const { ghosts } = drillLine(d, types());
    const comp = lessonFrames(res.run);
    comp.frames.forEach((f, i) => {
      f.ui.line = ghosts.length ? ghosts : null; // the line stays while the robot runs along it
      // brisker than a rule clip: a card shows for a moment, a beat where nothing moves is a breath, short holds at the ends
      const still = i > 0 && JSON.stringify(f.bots) === JSON.stringify(comp.frames[i - 1].bots);
      if (i === 0) f.ms = 350;
      else if (i === comp.frames.length - 1) f.ms = 500;
      else if (f.fx.some((x) => x.k === 'card')) f.ms = 450;
      else if (still && !f.fx.length) f.ms = 100;
    });
    comp.total = comp.frames.reduce((s, f) => s + f.ms, 0);
    paint.comp = comp;
    won = res.won;
    mode = 'run';
    hint = null;
    clearTimeout(idle);
    runAt = performance.now();
    o.vibrate?.([10, 40, 10]);
    render();
    tick();
  }
  function tick() {
    if (!alive || mode !== 'run') return;
    const comp = paint.comp;
    const t = (performance.now() - runAt) * SPEED;
    paintComp(paint, t);
    // the slot that's running now is lit, as on the race screen
    let acc = 0;
    let reg = 0;
    for (const f of comp.frames) {
      acc += f.ms;
      reg = f.ui.reg || reg;
      if (t < acc) break;
    }
    [...regsEl.children].forEach((el, i) => {
      el.classList.toggle('now', i === reg - 1);
      el.classList.toggle('past', i < reg - 1);
    });
    if (t >= comp.total) return ended();
    raf = requestAnimationFrame(tick);
  }
  function ended() {
    if (won) {
      mode = 'won';
      level++;
      mapEl.classList.add('won');
      o.vibrate?.([10, 40, 10, 40, 30]);
      render();
      o.onLevel?.(level);
      setTimeout(() => {
        if (!alive) return;
        mapEl.classList.remove('won');
        if (level >= DRILLS.length) finish();
        else begin();
      }, 900);
      return;
    }
    // it didn't end on the flag: the cards come back, and from here the nudges lead the way
    mode = 'plan';
    guided = true;
    buzz();
    mapEl.classList.remove('miss');
    void mapEl.offsetWidth;
    mapEl.classList.add('miss');
    back = placedRects();
    slots = slots.map(() => null);
    changed();
  }

  function begin() {
    d = DRILLS[level];
    slots = slots.map(() => null);
    guided = false;
    mode = 'plan';
    paint.board = null;
    acted();
    if (level === 0) hint = drillHint(d, slots); // the very first card bobs straight away
    mapEl.classList.remove('swap');
    void mapEl.offsetWidth;
    mapEl.classList.add('swap');
    render();
    drawPlan();
  }
  function finish() {
    mode = 'done';
    clearTimeout(idle);
    root.classList.add('done');
    const mark = document.createElement('div');
    mark.className = 'pr-done';
    mark.innerHTML = svgGlyph('check');
    mapEl.append(mark);
    render();
    o.onDone?.();
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-pr]');
    if (!el || !root.contains(el)) return;
    e.stopPropagation();
    const i = Number(el.dataset.i);
    switch (el.dataset.pr) {
      case 'card': return place(i, el);
      case 'slot': return take(i);
      case 'clear': return clear();
      case 'lock': return lock();
      case 'skip': return o.onSkip?.();
    }
  });

  if (level >= DRILLS.length) {
    level = 0; // done before: once more from the start
    d = DRILLS[0];
  }
  begin();

  return {
    get level() {
      return level;
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      ro?.disconnect();
      root.remove();
    },
  };
}
