// Dragging a card into the five slots. The race's programming screen (player.js) and the test drive (practice.js)
// both use this, so a drag does the same thing on both. (A tap still drops a card in the next free slot.)
//   onto an empty slot    the card goes there
//   onto a card           it takes that card's place: from the hand, that card goes back to the hand; from another
//                         slot, the two swap
//   between two cards     it goes in between, and the cards on one side move along a slot to make room: toward the
//                         nearest empty slot, or (no slot empty) the later cards move along and the last one goes
//                         back to the hand
//   off the slots         a card from a slot goes back to the hand; one from the hand stays there
// While a card is held, the slots show what letting go would do: the slot it would land in lights, cards slide
// aside, a card that would go back to the hand sinks and its place in the hand lights. On letting go, every card
// slides from where it is to where it belongs.
// dropAt and dropPlan have no DOM in them, so tests can read them.

const START = 10; // px a press moves before it's a drag (the Guide's long press gives up at the same distance)
const ON = 0.5; // the middle of a card, this much of its width, is "onto it"; nearer an edge is "beside it"
const REACH = 0.6; // how far off the row of slots (in slot widths and heights) a held card still counts as over it
const SLIDE_MS = 200;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

/**
 * Where a held card is over the slots. (x, y): its middle; rects: the slots' boxes, left to right; { regs, locked }:
 * the slots now; from: the slot it was picked up from (null: the hand). Returns { on: i } (over slot i),
 * { gap: b } (between slot b - 1 and slot b; 0 and rects.length are the two ends) or null (off the slots).
 * Only the edge of a card with no empty slot beside it is a gap: next to an empty slot there is nothing to move.
 */
export function dropAt(x, y, rects, { regs, locked }, from = null) {
  const first = rects[0];
  const last = rects.at(-1);
  if (!first) return null;
  const w = first.right - first.left;
  const h = first.bottom - first.top;
  if (y < first.top - h * REACH || y > first.bottom + h * REACH || x < first.left - w * REACH || x > last.right + w * REACH) return null;
  const i = rects.findIndex((r, k) => k === rects.length - 1 || x < (r.right + rects[k + 1].left) / 2);
  const r = rects[i];
  const open = (k) => k === from || (!locked[k] && !regs[k].length); // nothing in it, once the held card is up
  if (locked[i] || open(i)) return { on: i };
  const off = (x - (r.left + r.right) / 2) / (r.right - r.left);
  if (Math.abs(off) <= ON / 2) return { on: i };
  const beside = off < 0 ? i - 1 : i + 1;
  if (beside >= 0 && beside < rects.length && open(beside)) return { on: i };
  return { gap: off < 0 ? i : i + 1 };
}

/**
 * What letting go would do. { regs: [[id…] × 5], locked: [bool × 5] }: the slots now (a locked slot's list is
 * empty: its card isn't the player's to move); { id, from }: the held card and the slot it was picked up from
 * (null: the hand); at: where it is (dropAt). Returns null (nothing changes), or
 *   { regs (the slots as they would be), land (the slot the held card goes in; null: back to the hand),
 *     out: [ids that go back to the hand] }
 */
export function dropPlan({ regs, locked }, { id, from = null }, at) {
  const next = regs.map((l) => [...l]);
  if (from != null) next[from] = [];
  const held = [id];
  if (!at) return from == null ? null : { regs: next, land: null, out: held };
  if (at.on != null) {
    const i = at.on;
    if (locked[i] || i === from) return null;
    const was = next[i];
    next[i] = held;
    if (from == null) return { regs: next, land: i, out: was };
    next[from] = was; // from another slot: the two swap
    return { regs: next, land: i, out: [] };
  }
  // between two cards: the cards on one side move along (over a locked slot), toward the nearest empty slot
  const free = next.map((_, i) => i).filter((i) => !locked[i]);
  const side = (path) => ({ path, n: path.findIndex((i) => !next[i].length) });
  const right = side(free.filter((i) => i >= at.gap));
  const left = side(free.filter((i) => i < at.gap).reverse());
  let go = right.n >= 0 && (left.n < 0 || right.n <= left.n) ? right : left.n >= 0 ? left : null;
  let out = [];
  if (!go) {
    // no slot is empty: the later cards move along and the last goes back to the hand (after the last card: it is replaced)
    go = right.path.length ? { path: right.path, n: right.path.length - 1 } : { path: left.path.slice(0, 1), n: 0 };
    if (!go.path.length) return null;
    out = next[go.path[go.n]];
  }
  if (go.n === 0 && go.path[0] === from) return null; // back where it was
  for (let k = go.n; k > 0; k--) next[go.path[k]] = next[go.path[k - 1]];
  next[go.path[0]] = held;
  return { regs: next, land: go.path[0], out };
}

/**
 * Make the cards of a programming screen draggable. root: the screen's element (it takes the pointer while a card
 * is held, so a drag that leaves the page still ends). o: {
 *   scope       a selector in root for the screen's box: its slots are .pl-regs .pl-slot, its hand .pl-hand .pl-card
 *   attr        the data attribute of a hand card that holds its id ('arg': data-arg)
 *   can()       may a card be picked up (or put down) now?
 *   state()     { regs, locked } as dropPlan takes them (ids are strings)
 *   commit(p)   take the new slots (p.regs) and draw the screen, before returning
 *   vibrate(pattern)
 * }
 * Returns { refresh() (the screen was drawn again: a held card's hints are put back), destroy() }.
 */
export function mountCardDrag(root, o) {
  let drag = null; // { id, from, pointerId, x0, y0, ghost (the picture under the finger), box (where it was picked up), at, key, plan }
  let endedAt = 0;
  const scope = () => root.querySelector(o.scope);
  const slotEls = () => [...(scope()?.querySelectorAll('.pl-regs .pl-slot') ?? [])];
  const handEls = () => [...(scope()?.querySelectorAll('.pl-hand .pl-card') ?? [])];
  const idOf = (el) => el.dataset[o.attr];
  const pics = (el) => [...el.querySelectorAll(':scope > .lm-card')];
  const boxOf = (el) => el.getBoundingClientRect();

  /** The picture of a card where the screen shows it now: in its slot, else in the hand. */
  function picOf(id, st) {
    const i = st.regs.findIndex((l) => l.includes(id));
    if (i >= 0) {
      const el = slotEls()[i];
      return (el && pics(el)[st.regs[i].indexOf(id)]) ?? null;
    }
    return handEls().find((c) => idOf(c) === id)?.querySelector('.lm-card') ?? null;
  }

  const onDown = (e) => {
    if (e.button > 0 || drag || !o.can()) return;
    const box = e.target.closest?.(o.scope);
    if (!box || !root.contains(box) || e.target.closest('.pl-crab')) return;
    const slot = e.target.closest('.pl-regs .pl-slot.full:not(.locked)');
    const card = slot ? null : e.target.closest('.pl-hand .pl-card:not(:disabled):not(.used)');
    if (!slot && !card) return;
    const st = o.state();
    const from = slot ? slotEls().indexOf(slot) : null;
    if (slot && (from < 0 || st.locked[from] || st.regs[from].length !== 1)) return; // (a Crab Legs pair stays put)
    const id = slot ? st.regs[from][0] : idOf(card);
    if (id == null) return;
    drag = { id: String(id), from, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, ghost: null, box: null, at: null, key: null, plan: null };
  };

  /** The press has become a drag: the card's picture comes up under the finger. */
  function lift() {
    const pic = picOf(drag.id, o.state());
    if (!pic) return false;
    const r = pic.getBoundingClientRect();
    const ghost = pic.cloneNode(true);
    ghost.classList.add('pl-drag');
    Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.box = r;
    root.classList.add('pl-dragging');
    try {
      root.setPointerCapture(drag.pointerId);
    } catch {}
    o.vibrate?.(6);
    return true;
  }

  /** Show what letting go now would do (drag.plan), or nothing (no card is held). */
  function show() {
    const held = drag?.ghost ? drag : null;
    const plan = held?.plan ?? null;
    const st = o.state();
    const els = slotEls();
    const boxes = els.map(boxOf);
    els.forEach((el, i) => {
      const first = st.regs[i]?.[0];
      // where this slot's cards would be: another slot, here, or back in the hand (-1)
      let to = i;
      if (plan && first != null && first !== held.id) to = plan.out.includes(first) ? -1 : plan.regs.findIndex((l) => l.includes(first));
      const shift = to >= 0 && to !== i ? `translate(${(boxes[to].left - boxes[i].left).toFixed(1)}px, ${(boxes[to].top - boxes[i].top).toFixed(1)}px)` : '';
      for (const p of pics(el)) p.style.transform = shift;
      el.classList.toggle('leaving', to < 0);
      el.classList.toggle('drop', plan?.land === i);
      el.classList.toggle('dragging', held?.from === i);
    });
    for (const c of handEls()) {
      const id = idOf(c);
      c.classList.toggle('dragging', !!held && held.from == null && id === held.id);
      c.classList.toggle('returning', !!plan?.out.includes(id));
    }
    root.classList.toggle('pl-dragging', !!held);
  }

  /** Where the held card is over the slots now (its middle, not the finger), and what letting go there would do. Returns whether that changed. */
  function aim(e) {
    const st = o.state();
    const b = drag.box;
    drag.at = dropAt(b.left + b.width / 2 + e.clientX - drag.x0, b.top + b.height / 2 + e.clientY - drag.y0, slotEls().map(boxOf), st, drag.from);
    const key = JSON.stringify(drag.at);
    if (key === drag.key) return false;
    drag.key = key;
    drag.plan = dropPlan(st, drag, drag.at);
    return true;
  }

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.ghost) {
      if (Math.hypot(dx, dy) < START) return;
      if (!o.can() || !lift()) return (drag = null);
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    if (aim(e)) show();
  };

  /** Put the held card down without doing anything (the screen moved on under it). */
  function drop() {
    const d = drag;
    drag = null;
    d?.ghost?.remove();
    show();
    try {
      if (d) root.releasePointerCapture(d.pointerId);
    } catch {}
  }

  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    if (!d.ghost) return (drag = null); // a press that never moved: a tap, and the click does the rest
    endedAt = performance.now();
    const letGo = e.type === 'pointerup' && o.can(); // (not a touch the browser took away, or a screen that moved on)
    if (letGo) aim(e);
    const plan = letGo ? d.plan : null;
    // where every card is on the screen now: the held one under the finger, others perhaps slid aside
    const st = o.state();
    const was = new Map([[d.id, d.ghost.getBoundingClientRect()]]);
    slotEls().forEach((el, i) => pics(el).forEach((p, k) => {
      const id = st.regs[i]?.[k];
      if (id != null && id !== d.id) was.set(id, p.getBoundingClientRect());
    }));
    drop();
    if (plan) {
      o.vibrate?.(8);
      o.commit(plan);
    }
    // ...and each slides from there to where it belongs now
    const now = o.state();
    for (const [id, a] of was) {
      const pic = picOf(id, now);
      if (!pic) continue;
      const b = pic.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const s = b.width ? a.width / b.width : 1;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) continue;
      pic.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: SLIDE_MS, easing: EASE });
    }
  };

  // a drag ends with a click where it started (or on root, which held the pointer): that isn't a tap
  const onClick = (e) => {
    if (performance.now() - endedAt > 400 || !(e.target === root || e.target.closest?.(o.scope))) return;
    e.stopPropagation();
    e.preventDefault();
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('click', onClick, true);
  // (on the window, so a drag that leaves the screen's box still moves and ends)
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  return {
    refresh() {
      if (!drag?.ghost) return;
      const st = o.state();
      // the screen moved on (locked in, time ran out, the card is gone): the card goes back
      if (!o.can() || !picOf(drag.id, st) || (drag.from != null && st.regs[drag.from]?.[0] !== drag.id)) return drop();
      drag.plan = dropPlan(st, drag, drag.at);
      show();
    },
    destroy() {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('click', onClick, true);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      drag?.ghost?.remove();
      drag = null;
    },
  };
}
