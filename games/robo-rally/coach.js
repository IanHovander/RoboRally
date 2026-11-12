// The coach: the phone tells you the one thing that matters now, in a few plain words, pointing at the thing it
// is about (tips.js has the words and when each is said). It is on until the player turns it off in Help, and
// each tip is said once per phone: it goes when you do what it says, or when you tap it.
//   const coach = createCoach(root, { onMore(topic), vibrate });   root: the screen the tips point into
//   coach.refresh(situation)   after every render · coach.hide() · coach.destroy()
import { TIPS, BASICS } from './tips.js';
import { svgGlyph } from './glyphs.js';

const SEEN = 'rr.tips.seen';
const OFF = 'rr.tips';
const READ_MS = 700; // a tip that was up at least this long has been seen (a blink of one hasn't: it comes again)
const GAP = 10; // px between a tip and what it points at
const ROW = 2; // tips on one screen (one round's programming, say), not counting the steps of a first program

const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};
function loadSeen() {
  try {
    const v = JSON.parse(store.get(SEEN) ?? '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
// (kept here too, so a phone that blocks storage still hears each tip once a visit)
const seen = loadSeen();
const markSeen = (id) => {
  if (seen.has(id)) return;
  seen.add(id);
  store.set(SEEN, JSON.stringify([...seen]));
};

/** Are tips on? (They are, until the player turns them off.) */
export const tipsOn = () => store.get(OFF) !== 'off';
export function setTips(on) {
  store.set(OFF, on ? 'on' : 'off');
}
/** Has this phone been given this tip? */
export const tipSeen = (id) => seen.has(id);
/** This phone has raced before: the steps of a first program aren't for it. */
export function skipBasics() {
  for (const id of BASICS) markSeen(id);
}

export function createCoach(root, o = {}) {
  let showing = null; // { tip, el, since }
  let last = null; // the situation of the last refresh (a resize places the tip again)
  let visit = { key: null, n: 0 }; // how many tips this screen has had
  const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null;

  // (a tip may name several things to point at: the first that's on the screen)
  const target = (tip) => [].concat(tip.at ?? []).map((sel) => root.querySelector(sel)).find(Boolean) ?? null;
  const visible = (el) => {
    const r = el?.getBoundingClientRect();
    return !!r && r.width > 0 && r.height > 0;
  };

  /** Put the tip beside what it points at (or at the top of the screen), inside the screen, its arrow on the target. */
  function place() {
    if (!showing) return;
    const { tip, el } = showing;
    const box = root.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const t = target(tip)?.getBoundingClientRect();
    let left = (box.width - w) / 2;
    let top = 64;
    let side = 'none';
    if (t) {
      const cx = t.left + t.width / 2 - box.left;
      left = Math.max(8, Math.min(box.width - w - 8, cx - w / 2));
      side = tip.side ?? 'above';
      if (side === 'above' && t.top - box.top - h - GAP < 4) side = 'below'; // (no room above it)
      if (side === 'below' && t.bottom - box.top + h + GAP > box.height - 4) side = 'above';
      top = side === 'above' ? t.top - box.top - h - GAP : side === 'below' ? t.bottom - box.top + GAP : t.bottom - box.top - h - GAP;
      el.style.setProperty('--ax', `${Math.max(14, Math.min(w - 14, cx - left))}px`);
    }
    el.dataset.side = side;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function show(tip) {
    const el = document.createElement('div');
    el.className = 'co-tip';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span></span>${tip.more && o.onMore ? `<button class="co-more" aria-label="More">${svgGlyph('ask')}</button>` : ''}`;
    el.firstElementChild.textContent = tip.say;
    // a tap anywhere on it: read. A tap on its "?": the rest, in Help
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const more = e.target.closest('.co-more');
      markSeen(tip.id);
      close();
      if (more) o.onMore(tip.more);
      else next(); // (the next thing to say, if there is one)
    });
    root.append(el);
    if (!tip.step) visit.n++;
    showing = { tip, el, since: performance.now(), screen: last?.screen, timer: 0 };
    // (a tip that nothing answers goes by itself, and the next one may come)
    if (tip.ms) showing.timer = setTimeout(() => showing?.tip === tip && (close(true), next()), tip.ms);
    place();
    // what it points at may still be settling (styles arriving, a card flying in): it follows
    watch?.disconnect();
    watch?.observe(root);
    const t = target(tip);
    if (t) watch?.observe(t);
    o.vibrate?.(6);
  }
  const next = () => setTimeout(() => last && !showing && refresh(last), 450);
  /** Take the tip away. done: the player did what it said (so it has been seen, however briefly it was up). */
  function close(done = false) {
    if (!showing) return;
    const { tip, el, since, timer } = showing;
    showing = null;
    clearTimeout(timer);
    watch?.disconnect();
    if (done || performance.now() - since >= READ_MS) markSeen(tip.id);
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }

  const fits = (tip, s) => tip.on.includes(s.screen) && tip.when(s, seen) && (!tip.at || visible(target(tip)));
  function refresh(s) {
    last = s;
    if (!s || !tipsOn()) return close();
    s.has ??= {};
    if (showing) {
      if (fits(showing.tip, s)) return place();
      // still on its screen, and it no longer applies: they did what it said (what it pointed at going away for a
      // moment isn't that)
      close(s.screen === showing.screen && !showing.tip.when(s, seen));
    }
    const key = `${s.screen}:${s.round ?? ''}:${s.level ?? ''}`;
    if (visit.key !== key) visit = { key, n: 0 };
    const tip = TIPS.find((t) => !seen.has(t.id) && (t.step || visit.n < ROW) && fits(t, s));
    if (tip) show(tip);
  }
  const onResize = () => last && refresh(last);
  window.addEventListener('resize', onResize);

  return {
    refresh,
    hide: close,
    get showing() {
      return showing?.tip.id ?? null;
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      watch?.disconnect();
      clearTimeout(showing?.timer);
      showing?.el.remove();
      showing = null;
    },
  };
}
