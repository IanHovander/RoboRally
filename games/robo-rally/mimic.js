// The phone beside the board on the big screen: a small drawing of a player's phone that does what a real
// phone does while the board shows the result. The lobby film (lobby.js) and the Briefing (briefing.js)
// both use it. A fingertip taps cards into the five slots; the running slot lights; junk cards fly in from
// the robot (SPAM onto the deck stack, a Haywire into the slot it jams); the "?" glows. No words.
// Styles: lobby.css (the shell loads it on the big screen page, so it's there during the game too).
import { cardSvgHtml, svgGlyph } from './glyphs.js';

const DECOYS = ['bk', 'ut', 'm1', 'rl', 'rr', 'm2'];
const FACES = ['m1', 'm2', 'rr', 'rl', 'm3', 'ut', 'bk', 'pu'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A face-down Haywire: violet, no picture. */
export const hwBack = (cls = '') => `<span class="lm-card hay lf-back ${cls}"></span>`;

/**
 * A card flies across the screen: from a point to a point (CSS px in `layer`), on a curve that rises
 * first, 700 ms by default. html: the card's markup. Resolves when it lands (the element is removed
 * unless keep).
 */
export function flyCard(layer, html, from, to, { dur = 700, size = 2.2, rise = 70, delay = 0, keep = false, spin = 0, endScale = 1 } = {}) {
  const el = document.createElement('div');
  el.className = 'lf-fly';
  el.style.setProperty('--s', `${size}rem`);
  el.innerHTML = html;
  layer.append(el);
  const w = el.offsetWidth || 32;
  const h = el.offsetHeight || 42;
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - rise - Math.abs(to.x - from.x) * 0.12;
  const frames = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
    const s = 0.55 + 0.45 * Math.min(1, t * 5) * (1 - t * (1 - endScale));
    frames.push({ transform: `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${(spin * t).toFixed(1)}deg) scale(${s.toFixed(3)})`, opacity: t < 0.08 ? t / 0.08 : 1, offset: t });
  }
  el.style.transform = frames[0].transform;
  el.style.opacity = '0';
  return new Promise((resolve) => {
    const go = () => {
      const anim = el.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
      anim.onfinish = () => {
        if (!keep) el.remove();
        resolve(el);
      };
      anim.oncancel = () => {
        el.remove();
        resolve(null);
      };
    };
    if (delay > 0) setTimeout(go, delay);
    else go();
  });
}

/** Cards rise out of a point and fade (junk cards leaving a robot that fell). */
export function riseCards(layer, htmls, from, { dur = 1300 } = {}) {
  htmls.forEach((html, i) => {
    const el = document.createElement('div');
    el.className = 'lf-fly';
    el.innerHTML = html;
    layer.append(el);
    const w = el.offsetWidth || 32;
    const h = el.offsetHeight || 42;
    const dx = (i - (htmls.length - 1) / 2) * 34;
    const x = from.x - w / 2;
    const y = from.y - h / 2;
    el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x + dx * 0.6}px, ${y - 40}px) scale(1) rotate(${dx / 6}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x + dx}px, ${y - 95}px) scale(1) rotate(${dx / 4}deg)`, opacity: 0 },
      ],
      { duration: dur, delay: i * 140, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    ).onfinish = () => el.remove();
  });
}

/**
 * The phone. parent: the full-screen layer it lives in (its coordinates match the arena's container).
 */
export function createMimic(parent) {
  const phone = document.createElement('div');
  phone.className = 'lf-phone';
  phone.setAttribute('aria-hidden', 'true');
  phone.innerHTML = `
    <div class="lf-ask">?</div>
    <div class="lf-clock"><i></i></div>
    <div class="lf-slots">${'<i></i>'.repeat(5)}</div>
    <div class="lf-hand"></div>
    <div class="lf-bottom"><div class="lf-deck"><b></b><b></b><span class="lf-top"></span></div><div class="lf-lock">${svgGlyph('check')}</div><i></i></div>
    <div class="lf-finger"></div>`;
  parent.append(phone);
  const $ = (s) => phone.querySelector(s);
  const slotsEl = $('.lf-slots');
  const slots = [...slotsEl.children];
  const hand = $('.lf-hand');
  const lock = $('.lf-lock');
  const finger = $('.lf-finger');
  const deck = $('.lf-deck');
  const deckTop = $('.lf-top');
  const ask = $('.lf-ask');
  const clock = $('.lf-clock');
  let gen = 0; // bumps on reset: anything still scheduled from before does nothing

  const rel = (el) => {
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2 };
  };

  function clearSlots(keepLocked = false) {
    for (const s of slots) {
      if (keepLocked && s.classList.contains('locked')) {
        s.classList.remove('now', 'done', 'flip');
        continue;
      }
      s.className = '';
      s.innerHTML = '';
      delete s.dataset.hw;
    }
  }

  /** The fingertip glides to el and presses it. */
  async function tap(el, pause, fast) {
    const p = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    finger.style.transitionDuration = fast ? '.24s, .3s, .15s' : '';
    finger.style.transform = `translate(${r.left - p.left + r.width / 2}px, ${r.top - p.top + r.height * 0.6}px)`;
    finger.classList.add('on');
    await pause(fast ? 260 + 60 : 420 + 380);
    finger.classList.add('press');
    await pause(fast ? 110 : 160);
    finger.classList.remove('press');
  }

  function flyInto(card, slot, type) {
    const a = card.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    card.style.transform = `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px) scale(${b.width / a.width})`;
    card.classList.add('flying');
    const version = gen;
    setTimeout(() => {
      if (version !== gen) return; // reset meanwhile
      slot.innerHTML = cardSvgHtml(type);
      slot.className = 'full';
      card.classList.add('gone');
    }, 430);
  }

  const api = {
    el: phone,
    show() {
      phone.classList.add('show');
    },
    hide() {
      phone.classList.remove('show');
      finger.className = 'lf-finger';
    },
    /** Everything off: empty slots, no hand, no deck, no junk. */
    reset() {
      gen++;
      phone.classList.remove('locked', 'show', 'run', 'deck', 'timing', 'asking');
      clearSlots();
      hand.innerHTML = '';
      deckTop.innerHTML = '';
      deck.classList.remove('hit');
      finger.className = 'lf-finger';
      ask.classList.remove('glow');
      clock.firstElementChild.style.transition = 'none';
      clock.firstElementChild.style.transform = '';
    },
    setColor(c) {
      if (c) phone.style.setProperty('--c', c);
    },
    /** Show the deck stack (where SPAM lands). */
    showDeck(on = true) {
      phone.classList.toggle('deck', on);
    },
    /** How long program() takes for n cards (for progress bars). */
    programMs(n, slow, fast) {
      if (!slow) return 700 + n * 170 + 300;
      return fast ? 500 + n * 550 + 430 + 250 : 1300 + n * 1480 + 960 + 700;
    },

    /**
     * Deal a hand, then put the cards in the slots: slowly with a fingertip, or quickly. types: [type|null ×5]
     * (null: a slot that's locked, left alone). locked: [type|null ×5], the Haywire face down in a slot.
     * onPlace(placed): after each card lands, with the types placed so far.
     */
    async program(types, { slow = false, fast = false, locked = [], pause = sleep, color, onPlace } = {}) {
      api.setColor(color);
      phone.classList.remove('locked', 'run');
      clearSlots(true);
      locked.forEach((t, k) => {
        if (!t || slots[k].classList.contains('locked')) return;
        slots[k].className = 'locked';
        slots[k].innerHTML = hwBack();
        slots[k].dataset.hw = t;
      });
      const real = types.filter(Boolean);
      const decoys = DECOYS.filter((t) => !real.includes(t)).slice(0, 2);
      const all = [...real, ...decoys];
      // a stable shuffle so the hand doesn't look sorted
      const order = [3, 0, 5, 1, 6, 2, 4].filter((i) => i < all.length);
      hand.innerHTML = order.map((i, n) => `<span class="lf-card" data-i="${i}" style="--n:${n}">${cardSvgHtml(all[i])}</span>`).join('');
      phone.classList.add('show');
      await pause(slow ? (fast ? 500 : 1300) : 700);
      let r = 0;
      const placed = [];
      for (let k = 0; k < 5; k++) {
        if (!types[k]) {
          placed.push(null);
          continue;
        }
        const card = hand.querySelector(`[data-i="${r++}"]`);
        if (!card) continue;
        if (slow) await tap(card, pause, fast);
        flyInto(card, slots[k], types[k]);
        placed.push(types[k]);
        onPlace?.([...placed]);
        await pause(slow ? (fast ? 120 : 520) : 170);
      }
      if (slow) await tap(lock, pause, fast);
      phone.classList.add('locked');
      finger.className = 'lf-finger';
      await pause(slow ? (fast ? 250 : 700) : 300);
      phone.classList.add('run');
    },

    /** Slot i is running now (earlier ones done; -1: none). A locked slot turns face up as it runs. */
    lit(i, lockedType) {
      slots.forEach((s, k) => {
        s.classList.toggle('now', k === i);
        s.classList.toggle('done', i >= 0 && k < i);
      });
      const s = slots[i];
      if (s?.classList.contains('locked') && !s.classList.contains('flip')) {
        s.classList.add('flip');
        const version = gen;
        setTimeout(() => {
          if (version === gen) s.innerHTML = cardSvgHtml(lockedType ?? s.dataset.hw ?? 'h01');
        }, 220);
      }
    },

    /**
     * Junk cards from the robot: SPAM flies onto the deck stack (and stays on top of it, coral); a
     * Haywire flies into slot reg, turns face down and locks it (a violet glow). from: the robot on screen.
     */
    junk({ sp = 0, hw = 0, reg = 0, from }) {
      if (!from || !phone.classList.contains('show')) return;
      const version = gen;
      for (let i = 0; i < sp; i++) {
        phone.classList.add('deck');
        flyCard(parent, cardSvgHtml('sp'), from, rel(deck), { delay: i * 160, size: 2.4, endScale: 0.7, spin: -8 }).then(() => {
          if (version !== gen) return;
          deckTop.innerHTML = cardSvgHtml('sp');
          deck.classList.remove('hit');
          void deck.offsetWidth;
          deck.classList.add('hit');
        });
      }
      if (hw) {
        const slot = slots[Math.max(0, Math.min(4, reg))];
        flyCard(parent, hwBack(), from, rel(slot), { delay: sp * 160, size: 2.4, endScale: 0.8, spin: 10 }).then(() => {
          if (version !== gen) return;
          slot.className = 'locked landed';
          slot.innerHTML = hwBack();
          slot.dataset.hw = slot.dataset.hw ?? 'h01';
        });
      }
    },

    /**
     * The same junk, already there (no flight): for the lobby film jumping into the middle of a scene.
     * Waits for cards still settling into their slots, so a Haywire's slot isn't covered again.
     */
    junkNow({ sp = 0, hw = 0, reg = 0 }) {
      const version = gen;
      setTimeout(() => {
        if (version !== gen) return;
        if (sp) {
          phone.classList.add('deck');
          deckTop.innerHTML = cardSvgHtml('sp');
        }
        if (hw) {
          const slot = slots[Math.max(0, Math.min(4, reg))];
          slot.className = 'locked';
          slot.innerHTML = hwBack();
          slot.dataset.hw = slot.dataset.hw ?? 'h01';
        }
      }, 460);
    },

    /** The empty slots fill at random when the timer runs out: the clock line shrinks, they flicker, they settle. */
    async timeout(pause = sleep, { filled = ['m1', 'rr', null, 'm2', null], fills = ['rl', 'm1'] } = {}) {
      phone.classList.remove('locked', 'run');
      phone.classList.add('show');
      clearSlots();
      filled.forEach((t, k) => {
        if (!t) return;
        slots[k].className = 'full';
        slots[k].innerHTML = cardSvgHtml(t);
      });
      hand.innerHTML = ['ut', 'rl', 'm1', 'bk'].map((t, n) => `<span class="lf-card" style="--n:${n}">${cardSvgHtml(t)}</span>`).join('');
      const bar = clock.firstElementChild;
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(1)';
      phone.classList.add('timing');
      await pause(150);
      bar.style.transition = 'transform 1.4s linear';
      bar.style.transform = 'scaleX(0)';
      await pause(1400);
      phone.classList.remove('timing');
      const empty = filled.map((t, k) => (t ? -1 : k)).filter((k) => k >= 0);
      const version = gen;
      for (let n = 0; n < 7; n++) {
        if (version !== gen) return;
        for (const k of empty) {
          slots[k].className = 'full dice';
          slots[k].innerHTML = cardSvgHtml(FACES[(n * 3 + k) % FACES.length]);
        }
        await pause(120);
      }
      empty.forEach((k, i) => {
        slots[k].className = 'full settled';
        slots[k].innerHTML = cardSvgHtml(fills[i % fills.length]);
      });
      phone.classList.add('locked');
      await pause(400);
    },

    /** The "?" glows, a fingertip taps it, and a card in the hand gets the pointing outline. */
    async tapAsk(pause = sleep) {
      phone.classList.add('show');
      if (!hand.children.length) {
        hand.innerHTML = ['m2', 'rr', 'sp', 'm1'].map((t, n) => `<span class="lf-card" style="--n:${n}">${cardSvgHtml(t)}</span>`).join('');
        await pause(300);
      }
      phone.classList.remove('run');
      ask.classList.add('glow');
      await pause(500);
      await tap(ask, pause, true);
      phone.classList.add('asking');
      const target = hand.children[2] ?? hand.children[0];
      target?.classList.add('ask');
      await pause(500);
      if (target) await tap(target, pause, true);
      finger.className = 'lf-finger';
    },
  };
  return api;
}
