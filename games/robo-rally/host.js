// The big screen during a race: Lumen's glass board (scene.js) fills the screen, and a quiet layer of
// light on top says only what the room needs: whose robot is whose, who is ready, the card each robot
// is playing, the flags each has, and the time left. Sounds (sound.js) make heads turn at the big moments.
// It also teaches, without words: numerals of light show the order robots act in, the "1" badge marks
// the Priority, junk cards fly from a hit robot to its player's token, names stay up in round 1, and
// shut-down robots look shut down. When a newcomer is racing, a film plays before round 1 (phase 'brief'): the
// 23-second reel (sizzle.js), or the narrator's full Briefing (briefing.js) when the leader has "Rules tutorial"
// on; and the narrator (voice.js) calls out first-time moments in the race (teach.js). After the film,
// newcomers drive the test drive on their phones (practice.js): the roster shows how far each has got.
// When someone wins, the race gets an ending: the roster slides into finishing order, a few awards are given one
// at a time, and the race's biggest moment plays again, slowly. Then the leader races again or goes home.
import { html, raw, loadCss } from '../../js/ui.js';
import { COURSES, getCourse } from './board.js';
import { drawCourse, ringBoard } from './minimap.js';
import { robotSvg, svgGlyph, cardSvgHtml, COURSE_TITLES, LEVELS, courseTitle, GLYPHS, formOf } from './glyphs.js';
import { mountDemo, AWARDS } from './demo.js';
import { sfx, unlock, onState as onSound, setMuted, setLevel, sceneSound, state as soundState } from './sound.js';
import { voice } from './voice.js';
import { createVoiceLine, createCallouts, createExplainer, flyJunk, junkCards, topMargin } from './teach.js';
import { createMimic } from './mimic.js';
import { startBriefing } from './briefing.js';
import { startSizzle } from './sizzle.js';
import { LEADER } from './lobby.js';

const TIMERS = [0, 60, 120, 180];
const PHASE_MS = { upgrade: 60_000, brief: 90_000 }; // (brief: its practice stage)
const DROP_MS = [450, 280]; // the draw: the first robot comes down onto its pad after this long, then each next one
const END_MS = { winner: 3600, places: 2800, award: 2600 }; // the ending: how long the winner, the standings and each award are up
const REPLAY = { tempo: 0.55, before: 900, after: 1300 }; // ...and its moment again: this much slower, with a pause before and after
const RACE_FRAME = { top: 0.2, bottom: 0.4, left: 0.04, right: 0.04, headroom: 2.95 };
// the skip glyph (the phones' guide adds it to glyphs.js; drawn here too in case it isn't there)
const SKIP = () => (GLYPHS.skip ? svgGlyph('skip') : '<svg class="lm-g" viewBox="0 0 40 40" aria-hidden="true"><path d="M9.5 12 L18.5 20 L9.5 28 Z" fill="currentColor"/><path d="M19 12 L28 20 L19 28 Z" fill="currentColor"/><path d="M31 12 V28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>');
// a roster flag: a pennant on a pole (lit, outlined or dim by CSS)
const FLAG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path class="pole" d="M13 34 V7"/><path class="cloth" d="M13 8.5 H29 L24.5 14.5 L29 20.5 H13 Z"/></svg>';

export default function (root, api) {
  loadCss(new URL('./teach.css', import.meta.url).href); // the teaching layer's styles, after style.css
  root.innerHTML = `
    <div class="lm-host">
      <div class="lm-3d"></div>
      <div class="lm-veil"></div>
      <div class="tc-black"></div>
      <div class="lm-timer"><i></i><b></b></div>
      <div class="lm-regs"></div>
      <div class="lm-title"></div>
      <div class="lm-center"></div>
      <div class="lm-roster"></div>
      <div class="lm-rules" hidden title="SPAM in hand discards: each round, unplayed SPAM leaves your hand">${cardSvgHtml('sp')}${svgGlyph('right')}${svgGlyph('deck')}</div>
      <div class="tc-layer"></div>
      <div class="lm-corner">
        <div class="tc-tally" hidden></div>
        <button class="lm-icon-btn tc-skip" data-skip title="Skip" hidden>${SKIP()}</button>
        <button class="lm-icon-btn lm-hurry" data-hurry title="Hurry up" hidden>${svgGlyph('play')}${svgGlyph('play')}</button>
        <button class="lm-icon-btn lm-sound" data-sound title="Sound"></button>
      </div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const host = $('.lm-host');
  const box3d = $('.lm-3d');
  const timerEl = $('.lm-timer');
  const regsEl = $('.lm-regs');
  const titleEl = $('.lm-title');
  const centerEl = $('.lm-center');
  const rosterEl = $('.lm-roster');
  const soundBtn = $('[data-sound]');
  const hurryBtn = $('[data-hurry]');
  const skipBtn = $('[data-skip]');
  const tallyEl = $('.tc-tally');
  const layer = $('.tc-layer');
  const blackEl = $('.tc-black');

  let view = null;
  let arena = null;
  let flat = null;
  let lastBeat = -1;
  let lastReg = -2;
  let prev = null; // the view before this one (to notice changes worth a sound)
  const thumbs = new Map();
  const shown = new Map();
  const set = (el, content) => {
    const text = String(content ?? '');
    if (shown.get(el) === text) return false;
    shown.set(el, text);
    el.innerHTML = text;
    return true;
  };

  // ----- sound -----
  setLevel(1);
  const offSound = onSound((st) => {
    setTimeout(() => refreshFrame()); // (later: this runs once right away, before refreshFrame exists)
    soundBtn.innerHTML = svgGlyph(st === 'on' ? 'sound' : 'mute');
    soundBtn.classList.toggle('off', st !== 'on');
    soundBtn.title = st === 'locked' ? 'Click for sound' : st === 'muted' ? 'Sound off' : 'Sound on';
  });
  const gesture = () => unlock();
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
  const onResize = () => refreshFrame();
  window.addEventListener('resize', onResize); // turning the phone changes the room the board has
  soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // this button decides for itself
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const st = soundState();
    if (st === 'locked') unlock();
    else setMuted(st === 'on');
  });
  hurryBtn.addEventListener('click', () => api.send('hurry'));
  const seatOf = (id) => view?.robots.find((r) => r.id === id)?.seat ?? 0;
  const tokenOf = (id) => rosterEl.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
  const onArena = (kind, d) => {
    if (kind === 'broken') return rebuild3d(d.arena);
    // a mishap on the board: that player's token at the bottom flinches too, so the room sees whose it was
    if (kind === 'mishap' || kind === 'fall') flinch(d.id, kind === 'fall' || d.n > 1);
    // junk cards: from the robot (or where it fell) to that player's token, every time
    if (kind === 'junk' && !briefing && !replay && tokenOf(d.id)) {
      const from = d.src === 'reboot' ? arena.cellScreenPos(d.x, d.y, 0.3) : arena.screenPos(d.id);
      flyJunk(layer, junkCards(d), from, tokenOf(d.id), { big: callouts.bigJunk(d.id), onLand: () => flinch(d.id, d.sp + d.hw > 1) });
    }
    sceneSound(kind, d, seatOf);
  };
  function flinch(id, big) {
    const el = tokenOf(id);
    if (!el) return;
    el.classList.remove('flinch', 'flinch-big');
    void el.offsetWidth; // restart the animation
    el.classList.add(big ? 'flinch-big' : 'flinch');
  }

  // ----- the narrator: its line of light, subtitles, the first-time callouts -----
  const line = createVoiceLine(host);
  const offCaption = voice.onCaption((text) => line.caption(text));
  const callouts = createCallouts({
    voice,
    line,
    send: (type, payload) => api.send(type, payload),
    arena: () => arena,
    course: () => (view ? getCourse(view.opts.course) : null),
  });
  const mimic = createMimic(host);
  // press and hold the mouse on a square, a robot or a token: what it is, as the phone's Guide shows it
  const explainer = createExplainer(host, {
    getView: () => view,
    course: () => (view ? getCourse(view.opts.course) : null),
    pick: (x, y) => (arena && !briefing ? arena.pick(x, y) : null),
    tokenAt: (x, y) => [...rosterEl.querySelectorAll('.lm-tok')].find((el) => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    })?.dataset.id ?? null,
    // asking about a reboot ring (or the dock) lights the whole ground it serves
    onShow: (found) => {
      const c = view ? getCourse(view.opts.course) : null;
      if (!arena || !c || !found.cell) return;
      const ring = found.ids[0] === 'reboot-ring' ? ringBoard(c, found.cell.x, found.cell.y) : -1;
      const dock = found.ids[0] === 'dock' ? c.boards.findIndex((b) => b.dock) : -1;
      arena.highlightArea(ring >= 0 ? ring : dock >= 0 ? dock : null);
    },
    onClose: () => arena?.highlightArea(null),
  });

  // ----- the film before round 1 (phase 'brief'): it borrows the arena, then hands it back. It is the reel
  // (sizzle.js: the game in 23 seconds), or the narrator's Briefing when the leader asked for the full rules.
  // Both take the same things and give back { stop(), next() }, so the rest of this file calls either "the Briefing" -----
  /** The Briefing's second stage: newcomers' phones have the test drive, and the room waits for them. */
  const practising = (v) => v?.phase === 'brief' && v.brief?.stage === 'practice';
  let briefing = null;
  let briefOver = false; // this Briefing has ended here (played out or skipped): don't start it again
  let prioHold = false; // the Briefing is moving the "1" badge itself
  function maybeBrief(v) {
    if (v.phase !== 'brief') {
      briefOver = false;
      if (briefing) stopBriefing();
      return;
    }
    if (briefing || briefOver || !arena) return;
    if (practising(v)) return; // (the film is over: the phones have the test drive)
    host.classList.add('briefing');
    briefing = (v.opts.brief ? startBriefing : startSizzle)({
      arena,
      view: () => view,
      robots: () => sceneRobots(view),
      voice,
      line,
      mimic,
      layer,
      box3d,
      blackout(on, ms) {
        blackEl.style.transition = ms ? `opacity ${ms}ms ease` : 'none';
        blackEl.classList.toggle('on', on);
      },
      regs(n) {
        regsEl.innerHTML = n == null ? '' : String(html`${[0, 1, 2, 3, 4].map((i) => html`<i class="${i === n && 'now'} ${i < n && 'done'}">${i + 1}</i>`)}`);
        shown.delete(regsEl);
      },
      roster: {
        /** The roll call: the others wait dimmed; the one being named lights up, and stays lit. */
        rollCall(on) {
          rosterEl.classList.toggle('tc-rollcall', on);
        },
        light(id) {
          for (const tok of rosterEl.querySelectorAll('.tc-now')) tok.classList.remove('tc-now');
          tokenOf(id)?.classList.add('tc-lit', 'tc-now');
        },
        prioPulse() {
          prioHold = true;
          prioEl.classList.remove('pulse');
          void prioEl.offsetWidth;
          prioEl.classList.add('pulse');
        },
        prioTo(id) {
          prioHold = true;
          placePrio(id);
        },
        shop() {
          for (const tok of rosterEl.querySelectorAll('.lm-tok')) {
            const el = document.createElement('span');
            el.className = 'tc-shopfloat';
            el.innerHTML = svgGlyph('shop');
            tok.append(el);
            setTimeout(() => el.remove(), 2200);
          }
        },
      },
      done() {
        api.send('briefDone');
        endBriefing();
      },
    });
  }
  /** Skip it from the big screen: Esc, Space, Enter, or the skip button. */
  function skipBriefing() {
    if (view?.phase !== 'brief') return;
    api.send('briefSkip');
    endBriefing();
  }
  function endBriefing() {
    briefOver = true;
    stopBriefing();
  }
  /** The Briefing is over: everything it changed goes back, and the arena shows the race again. */
  function stopBriefing() {
    const b = briefing;
    briefing = null;
    host.classList.remove('briefing');
    b?.stop();
    prioHold = false;
    mimic.reset();
    regsEl.innerHTML = '';
    shown.delete(regsEl);
    blackEl.style.transition = 'opacity .4s';
    blackEl.classList.remove('on');
    box3d.style.opacity = '';
    for (const tok of rosterEl.querySelectorAll('.tc-lit')) tok.classList.remove('tc-lit', 'tc-now');
    rosterEl.classList.remove('tc-rollcall');
    if (arena) {
      arena.tagsOnly = null;
      arena.calmWin = false;
      arena.tempo = 1;
      arena.trace = null;
      for (const id of arena.bots.keys()) arena.raise(id, false);
      arena.clearGhost();
      arena.setDim(0);
      if (view) {
        arena.reset(getCourse(view.opts.course));
        apply(view, true);
        render(view);
      }
    }
  }
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, dialog')) return;
    if (e.key === 'c' || e.key === 'C') {
      voice.toggleCaptions();
      refreshFrame();
      if (!briefing && !voice.busy) {
        line.show({ progress: null });
        line.hide(700); // a flash of the line: captions switched
      }
      return;
    }
    const skips = e.key === 'Escape' || e.key === ' ' || e.key === 'Enter';
    if (view?.phase === 'over' && skips && ending && ending.stage !== 'rest' && !e.target.closest?.('button')) {
      e.preventDefault();
      return skipEnding();
    }
    if (view?.phase !== 'brief') return;
    if (skips) {
      e.preventDefault();
      skipBriefing();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      briefing?.next();
    }
  };
  window.addEventListener('keydown', onKey);
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skipBriefing();
  });

  // ----- the Priority: a "1" badge on its holder's token; it slides to the next one each round -----
  const prioEl = document.createElement('div');
  prioEl.className = 'tc-prio';
  prioEl.textContent = '1';
  function placePrio(id) {
    const spot = id && tokenOf(id)?.querySelector('.lm-tok-bot');
    if (!spot) {
      prioEl.remove();
      return;
    }
    if (prioEl.parentElement === spot) return;
    const before = prioEl.isConnected ? prioEl.getBoundingClientRect() : null;
    spot.append(prioEl);
    if (before) {
      const after = prioEl.getBoundingClientRect();
      prioEl.animate([{ transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` }, { transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,.7,.2,1)' });
    }
  }

  // ----- the 3D scene (it's big: load it once the font its labels use is ready) -----
  async function make3d() {
    try {
      await Promise.race([Promise.all([document.fonts.load('200 64px Lumen'), document.fonts.load('500 64px Lumen')]), new Promise((r) => setTimeout(r, 1500))]);
      const { Arena } = await import('./scene.js');
      if (!root.isConnected) return;
      arena = new Arena(box3d);
      arena.on(onArena);
      if (view) {
        lastBeat = view.beat.n;
        apply(view, true);
      }
    } catch (err) {
      console.warn('3D view unavailable, using the flat map:', err);
      useFlat();
    }
  }
  function useFlat() {
    flat = document.createElement('canvas');
    flat.className = 'lm-flat';
    box3d.append(flat);
    if (view) apply(view);
  }
  make3d();
  // the 3D view's picture went wrong (Arena.broke): a fresh one, as at the start; if it keeps breaking, the flat map
  let rebuilt = [];
  function rebuild3d(old) {
    if (arena !== old || !old) return;
    arena = null;
    if (briefing) stopBriefing(); // (it has the old view; it starts again on the new one)
    old.destroy();
    const now = performance.now();
    rebuilt = rebuilt.filter((t) => now - t < 120_000);
    rebuilt.push(now);
    if (rebuilt.length > 3) useFlat();
    else make3d();
  }

  // setup: drag across the big screen (not on a button or the strip) to slide to the next map, as on the phone
  let drag = null;
  let draggedAt = 0;
  root.addEventListener('pointerdown', (e) => {
    if (view?.phase !== 'setup' || !slide.course || e.button > 0) return;
    if (e.target.closest('button, [data-host], .lm-courses, .lm-opts, .lm-corner, a, input')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, from: slide.o, trail: [] };
  });
  const onDragMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y)) {
      drag.on = true;
      drag.x = e.clientX; // (moves from here, so it doesn't hop)
      slide.mode = 'drag';
      slide.glide = null;
      slide.live = false;
      slide.buf = [];
    }
    if (!drag.on) return;
    const now = performance.now();
    drag.trail.push([now, e.clientX]);
    while (drag.trail.length > 2 && now - drag.trail[0][0] > 100) drag.trail.shift();
    const per = slide.px || innerWidth * 0.6; // screen px per map
    slide.o = Math.max(-1.4, Math.min(1.4, drag.from + (e.clientX - drag.x) / per));
  };
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    draggedAt = performance.now();
    const [t0, x0] = d.trail[0] ?? [0, 0];
    const [t1, x1] = d.trail.at(-1) ?? [1, 0];
    const v = (x1 - x0) / Math.max(16, t1 - t0); // px per ms, + to the right
    const flick = Math.abs(v) > 0.5 && Math.sign(v) === -Math.sign(slide.o || -v);
    if (Math.abs(slide.o) > 0.25 || (flick && Math.abs(slide.o) > 0.04)) {
      // far enough (or flicked): the map it was moving toward is chosen, and glides home from here
      const step = slide.o < 0 ? 1 : -1;
      slide.mode = 'hold'; // stays put until the room has the new map (then glides home from here)
      slide.holdUntil = performance.now() + 1200;
      slide.ov = 0;
      api.send('setOpt', { key: 'course', value: courseAt(slide.course, step) });
    } else {
      // not far enough: it springs back
      slide.mode = 'follow';
      slide.ov = 0;
    }
  };
  // (on the window, so a drag that leaves the big screen's layer still ends; taken off again in destroy)
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  root.addEventListener('click', (e) => {
    if (performance.now() - draggedAt < 300) return; // (the end of a drag isn't a click)
    const el = e.target.closest('[data-host]');
    if (!el) return;
    const [key, rawValue] = el.dataset.host.split('=');
    const value = rawValue === 'true' ? true : rawValue === 'false' ? false : /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue;
    api.send('setOpt', { key, value });
  });

  // ----- the draw (phase 'start'): nobody picks a pad; the robots come down onto theirs one at a time, in seat order -----
  let dropped = 0; // how many have come down
  let dropTimer = 0;
  const landed = (v, r) => v.robots.indexOf(r) < dropped;
  function startDrop() {
    clearTimeout(dropTimer);
    dropped = 0;
    const next = () => {
      const v = view;
      if (v?.phase !== 'start') return;
      dropTimer = setTimeout(next, DROP_MS[1]); // (it keeps going: a phone may still join during the draw)
      const r = v.robots[dropped];
      if (!r) return;
      dropped++;
      sfx.join(r.seat);
      apply(v);
      render(v);
    };
    dropTimer = setTimeout(next, DROP_MS[0]);
  }

  // ----- the ending (phase 'over'): the winner; then the roster slides into finishing order; then the awards, one at
  // a time; then the race's biggest moment again, slowly; then it rests there until the leader races again or goes
  // home. Esc, Space or Enter skips to the rest -----
  let ending = null; // { stage: 'winner' | 'places' | 'awards' | 'replay' | 'rest', award: how many awards are given so far, timer }
  let replay = null; // the moment is playing again (the arena is its, not the view's): { timer }
  /** The award being given now, or null. */
  const awardNow = (v) => (ending?.stage === 'awards' ? v.result?.awards[ending.award - 1] ?? null : null);
  function startEnding() {
    stopEnding();
    ending = { stage: 'winner', award: 0, timer: setTimeout(endNext, END_MS.winner) };
  }
  /** The ending's next step. */
  function endNext() {
    const v = view;
    const e = ending;
    if (!e || v?.phase !== 'over') return;
    clearTimeout(e.timer);
    const res = v.result;
    if (!res || e.stage === 'replay') e.stage = 'rest';
    else if (e.stage === 'winner') e.stage = 'places';
    else if (e.award < res.awards.length) {
      e.stage = 'awards';
      e.award++;
    } else e.stage = res.play && arena ? 'replay' : 'rest';
    if (e.stage === 'places') sfx.go();
    if (e.stage === 'awards') sfx.yay(true);
    if (replay) stopReplay();
    if (e.stage === 'replay') startReplay(res.play);
    else if (e.stage !== 'rest') e.timer = setTimeout(endNext, e.stage === 'places' ? END_MS.places : END_MS.award);
    apply(v);
    render(v);
  }
  function skipEnding() {
    const e = ending;
    if (!e || e.stage === 'rest' || view?.phase !== 'over') return;
    clearTimeout(e.timer);
    e.stage = 'rest';
    e.award = view.result?.awards.length ?? 0;
    if (replay) stopReplay();
    apply(view);
    render(view);
  }
  function stopEnding() {
    if (!ending) return;
    clearTimeout(ending.timer);
    ending = null;
    if (replay) stopReplay();
  }
  /** For test scripts: hold the ending at one stage (with this many awards given). */
  function holdEnding(stage, award = 0) {
    if (!ending || view?.phase !== 'over') return;
    clearTimeout(ending.timer);
    if (replay) stopReplay();
    Object.assign(ending, { stage, award });
    if (stage === 'replay' && view.result?.play && arena) startReplay(view.result.play);
    apply(view);
    render(view);
  }
  /** The race's biggest moment again: the robots back where they stood, then that beat, slowed down. */
  function startReplay(play) {
    const v = view;
    const c = getCourse(v.opts.course);
    const cast = (list) => list.map((q) => ({ ...robotById(v, q.id), ...q })).filter((r) => r.name != null);
    host.classList.add('replaying');
    arena.reset(c);
    arena.setPerimeter(v.opts.lessDeadly ? c : null);
    arena.syncRobots(cast(play.before));
    arena.setFrame(frameFor('activate'));
    arena.camMode = 'race';
    arena.showNames = arena.namesAlways = true;
    arena.setTargets(null);
    arena.tempo = REPLAY.tempo;
    replay = {
      timer: setTimeout(() => {
        arena.playBeat({ n: 0, cap: '', ...play.beat }, cast(play.after));
        replay.timer = setTimeout(endNext, play.beat.dur / REPLAY.tempo + REPLAY.after);
      }, REPLAY.before),
    };
  }
  /** The moment is over (or skipped): the arena shows the end of the race again. */
  function stopReplay() {
    if (!replay) return;
    clearTimeout(replay.timer);
    replay = null;
    host.classList.remove('replaying');
    if (!arena) return;
    arena.tempo = 1;
    if (view) {
      arena.reset(getCourse(view.opts.course));
      apply(view, true);
    }
  }

  /** The roster in this order (ids; null: by seat), every token sliding to its new place. */
  function orderRoster(ids) {
    const key = ids ? ids.join() : '';
    if ((rosterEl.dataset.order ?? '') === key) return;
    rosterEl.dataset.order = key;
    const toks = [...rosterEl.querySelectorAll('.lm-tok')];
    const from = new Map(toks.map((el) => [el, el.getBoundingClientRect()]));
    for (const el of toks) el.style.order = ids ? String(Math.max(0, ids.indexOf(el.dataset.id))) : '';
    for (const el of toks) {
      const a = from.get(el);
      const b = el.getBoundingClientRect();
      if (a.left === b.left && a.top === b.top) continue;
      el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'translate(0, 0)' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)', composite: 'add' });
    }
  }

  /** Robots as the scene should show them; in the draw, the ones that have come down stand on their start spaces. */
  function sceneRobots(v) {
    const c = getCourse(v.opts.course);
    return v.robots
      .map((r) => {
        if (r.x != null) return r;
        if (v.phase !== 'start' || r.pick == null || !landed(v, r)) return null;
        const st = c.starts.find((s) => s.n === r.pick);
        return st ? { ...r, x: st.x, y: st.y, d: st.d, on: true } : null;
      })
      .filter(Boolean);
  }

  // During the race the board leaves the top tenth of the screen to the 1-5 strip and the narrator's line,
  // and a card (with its name above it, in round 1) over a robot on the far row still fits under them.
  const frameFor = (phase) =>
    phase === 'setup' ? { top: 0.12, bottom: 0.8, left: 0.1, right: 0.1, headroom: null }
      : phase === 'over' ? { top: 0.1, bottom: 0.3, left: 0.05, right: 0.05, headroom: null }
        : phase === 'start' ? { top: 0.34, bottom: 0.4, left: 0.04, right: 0.04, headroom: null }
        : { ...RACE_FRAME, top: topMargin(!!view?.teach) + (tall() ? 0.1 : 0), bottom: tall() && (view?.robots.length ?? 0) > 4 ? 0.8 : RACE_FRAME.bottom };
  // a phone held upright as the big screen: the 1-5 strip sits lower, and more than four robots take two rows
  const tall = () => innerWidth < innerHeight;
  /** Subtitles came or went (sound on or off, C): the board makes room for them, or takes it back. */
  const refreshFrame = () => {
    if (arena && view && !briefing) arena.setFrame(frameFor(view.phase));
  };

  /** The order robots act in this register: from the Priority holder round the seats, skipping robots that are out or shut down. */
  function priorityOrder(v) {
    const list = v.robots;
    const k = Math.max(0, list.findIndex((r) => r.id === v.prio));
    return list.map((_, i) => list[(k + i) % list.length]).filter((r) => r.x != null && r.on !== false && !r.sd);
  }

  /**
   * The flag each robot is heading for (its next one), for the board to breathe: lead marks the race leader's
   * (the most flags; on a tie, every tied robot's). Only while racing: not in setup, the Briefing or the win.
   */
  function flagTargets(v) {
    if (!['start', 'upgrade', 'program', 'activate'].includes(v.phase)) return null;
    if (v.ctf) return v.robots.filter((r) => r.hunt && !r.cp).map((r) => ({ id: r.id, color: r.color, n: r.hunt, lead: false })); // carriers head home
    const racing = v.robots.filter((r) => (r.cp ?? 0) < v.cps);
    const most = Math.max(0, ...v.robots.map((r) => r.cp ?? 0));
    return racing.map((r) => ({ id: r.id, color: r.color, n: (r.cp ?? 0) + 1, lead: (r.cp ?? 0) === most }));
  }

  function apply(v, first = false) {
    // a rule that changes how the race plays, shown the whole race: SPAM left in your hand is discarded each round
    $('.lm-rules').hidden = !(v.opts?.lessSpam && v.phase !== 'setup');
    if (briefing) {
      // the Briefing has the arena; when the phase moves on (or the phones skipped its film), it hands it back
      // (and that redraws all this)
      if (v.phase === 'brief' && !practising(v)) {
        lastBeat = v.beat.n;
        return;
      }
      if (v.phase === 'brief') briefOver = true;
      return stopBriefing();
    }
    if (v.phase !== 'brief') briefOver = false;
    if (replay) {
      // the ending's moment has the arena; it hands it back when it's over (or the race has moved on: now)
      if (v.phase === 'over') return;
      stopEnding();
    }
    const robots = sceneRobots(v);
    if (arena) {
      // no upgrades: batteries do nothing (drawn inert); "Map perimeter": a wall right round the course
      arena.setBatteriesInert(!v.opts.upgrades);
      // setting up: the maps either side of this one are built ahead, out of sight, so they can slide straight in
      // (and the one a glide is leaving stays until it's gone); the race doesn't need them
      arena.preload(v.phase === 'setup' ? slideSpares() : [], { perimeter: !!v.opts.lessDeadly });
      arena.setCourse(v.opts.course);
      arena.setPerimeter(v.opts.lessDeadly ? getCourse(v.opts.course) : null);
      arena.setFrame(frameFor(v.phase));
      arena.camMode = v.phase === 'setup' ? 'orbit' : ['start', 'brief', 'upgrade', 'program'].includes(v.phase) ? 'drift' : 'race';
      if (!first && prev && prev.phase !== v.phase && (v.phase === 'program' || v.phase === 'activate')) arena.pulse();
      if (v.phase === 'activate' && v.reg !== lastReg) {
        lastReg = v.reg;
        arena.clearCards();
      }
      if (v.phase !== 'activate' && v.phase !== 'over' && lastReg !== -2) {
        lastReg = -2;
        arena.clearCards();
      }
      if (v.beat.n !== lastBeat) {
        lastBeat = v.beat.n;
        if (!first && (v.phase === 'activate' || v.phase === 'over')) {
          // the cards turn over above the robots, so everyone sees what's coming (alone, it would only repeat)
          if (v.beat.what?.k === 'reveal' && v.robots.length > 1) {
            arena.showCards(v.robots.filter((r) => Array.isArray(r.regs?.[v.reg]) && r.regs[v.reg].length).map((r) => ({ id: r.id, types: r.regs[v.reg] })));
            // ...and numerals of light at their feet say who goes first, second, third
            const order = priorityOrder(v);
            if (order.length > 1) arena.orderMarks(order.map((r) => r.id));
          }
          callouts.beat(v); // first-time moments (before the beat plays: a callout may make a beam linger)
          arena.playBeat(v.beat, robots);
        }
      }
      arena.syncRobots(robots);
      // the draw: a pad lights in its robot's color as the robot comes down onto it
      const picks = {};
      for (const r of v.robots) if (r.pick != null && landed(v, r)) picks[r.pick] = r.color;
      arena.showStarts(v.phase === 'start' ? picks : null);
      arena.setReady(['program', 'upgrade'].includes(v.phase) ? new Set(v.robots.filter((r) => r.ready).map((r) => r.id)) : practising(v) ? new Set(v.robots.filter((r) => doneOf(v, r)).map((r) => r.id)) : null);
      arena.setDeciding(v.prompt?.id ?? null);
      if (v.ctf) arena.setCtf(v.robots);
      else arena.setTaken(v.robots);
      arena.setTargets(flagTargets(v));
      arena.showNames = v.phase !== 'setup';
      arena.namesAlways = v.phase === 'start' || (v.round === 1 && ['brief', 'program', 'activate'].includes(v.phase)); // the draw and round 1: whose robot is whose
      arena.setShutdown(v.robots.filter((r) => r.sd && r.on !== false).map((r) => r.id));
      if (v.phase === 'over') {
        // the camera stays on the winner, but goes to the robot getting an award (if it's on the board)
        const star = awardNow(v)?.ids.find((id) => robots.some((r) => r.id === id && r.on !== false));
        arena.focusOn = star ?? v.winner;
        arena.setDim(0.72);
      } else {
        arena.focusOn = null;
        arena.setDim(v.phase === 'setup' ? 0.15 : 0);
      }
      if (v.phase === 'brief' && !briefOver) maybeBrief(v);
    } else if (flat) {
      drawFlat(v, robots);
      // no 3D here, so no Briefing to show: let the race begin
      if (v.phase === 'brief' && !briefOver) {
        briefOver = true;
        api.send('briefDone');
      }
    }
  }

  function drawFlat(v, robots) {
    const c = getCourse(v.opts.course);
    const w = box3d.clientWidth;
    const h = box3d.clientHeight;
    const tile = Math.floor(Math.min((w - 80) / c.w, (h * 0.62) / c.h));
    const dpr = window.devicePixelRatio || 1;
    flat.width = w * dpr;
    flat.height = h * dpr;
    flat.style.width = `${w}px`;
    flat.style.height = `${h}px`;
    const g = flat.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#06080b';
    g.fillRect(0, 0, w, h);
    drawCourse(g, c, { tile, ox: (w - tile * c.w) / 2, oy: h * 0.16, robots });
  }

  // ----- sounds for things that aren't beats -----
  function noticeChanges(v, p) {
    if (!p) return;
    if (v.phase !== p.phase) {
      if (v.phase === 'program') sfx.round();
      if (v.phase === 'activate') sfx.go();
    }
    for (const r of v.robots) {
      const before = p.robots.find((x) => x.id === r.id);
      if (!before) continue;
      // the test drive: a drill done (a flag pops over that robot), or all of them (a check)
      if (practising(v) && practising(p) && r.id in p.brief.practice) {
        const done = !(r.id in v.brief.practice);
        if (done || v.brief.practice[r.id] > p.brief.practice[r.id]) {
          sfx.ready(r.seat);
          if (r.x != null) arena?.popAt(r.x, r.y, done ? 'check' : 'flag', r.color, '', { height: 0.5 });
        }
      }
      if (v.phase === p.phase && ['program', 'upgrade'].includes(v.phase) && r.ready && !before.ready) sfx.ready(r.seat);
    }
    if (v.prompt && v.prompt.deadline !== p.prompt?.deadline) sfx.ask();
  }

  // ----- the layer of light on top -----

  const robotById = (v, id) => v.robots.find((r) => r.id === id);
  const G = (name) => raw(svgGlyph(name));
  // flags: the ones taken lit in the player's color, the next one outlined
  const flagBars = (v, r) => html`<span class="lm-flags tc-flags">${Array.from({ length: v.cps }, (_, i) => html`<i class="${i < (r.cp ?? 0) ? 'on' : i === (r.cp ?? 0) && 'next'}">${raw(FLAG)}</i>`)}</span>`;

  /** What a robot's token shows above its name, by phase. */
  function tokenTop(v, r) {
    if (r.away) return html`<span class="lm-zz">${G('dots')}</span>`;
    switch (v.phase) {
      case 'brief': {
        // the test drive: a pip a drill, lit as each is done
        const n = practising(v) ? v.brief.practice[r.id] : null;
        return n == null ? '' : html`<span class="tc-drive">${Array.from({ length: v.brief.drills }, (_, i) => html`<i class="${i < n && 'on'}"></i>`)}</span>`;
      }
      case 'start':
        // the draw: its pad's number, once it has come down onto it
        return r.pick != null && landed(v, r) ? html`<span class="lm-pad">${r.pick}</span>` : '';
      case 'upgrade':
        return r.ready ? html`<span class="lm-ok">${G('check')}</span>` : html`<span class="lm-shop">${G('shop')}</span>`;
      case 'program': {
        if (r.ready && r.wantSd) return html`<span class="lm-ok">${G('power')}</span>`;
        const regs = r.regs ?? [0, 0, 0, 0, 0];
        return html`<span class="lm-slots ${r.ready && 'ready'}">${regs.map((x, i) => html`<i class="${(x || r.hw?.[i]) && 'on'}"></i>`)}</span>`;
      }
      case 'activate': {
        if (r.sd) return html`<span class="lm-state">${G('power')}</span>`;
        if (r.rb || r.on === false) return html`<span class="lm-state">${G('reboot')}</span>`;
        const now = r.regs?.[v.reg];
        if (Array.isArray(now) && now.length) return html`${now.map((t) => raw(cardSvgHtml(t, 'xs')))}`;
        return html`<span class="lm-card-back"></span>`;
      }
      case 'over': {
        // the ending: its place, once the roster is in finishing order, and over it a star for each award it has been given
        const place = ending && ending.stage !== 'winner' ? v.result?.places[r.id] : null;
        if (place == null) return '';
        const now = awardNow(v);
        const given = v.result.awards.slice(0, ending.award).filter((a) => a.ids.includes(r.id));
        return html`<span class="lm-awards">${given.map((a) => html`<i class="${a === now && 'new'}">${G('star')}</i>`)}</span><span class="lm-place ${place <= 3 && 'lit'}">${place}</span>`;
      }
    }
    return '';
  }

  /** Has this robot's player done what the phase waits for (driven the test drive, finished shopping, locked in)? null: not a waiting phase. */
  function doneOf(v, r) {
    if (practising(v)) return !(r.id in v.brief.practice);
    if (v.phase === 'upgrade' || v.phase === 'program') return !!r.ready;
    return null;
  }

  function renderRoster(v) {
    const ids = v.robots.map((r) => r.id).join();
    if (rosterEl.dataset.ids !== ids) {
      rosterEl.dataset.ids = ids;
      rosterEl.innerHTML = v.robots.map((r) => `<div class="lm-tok" data-id="${r.id}"><div class="lm-tok-top"></div><div class="lm-tok-bot"></div><div class="lm-tok-name"></div><div class="lm-tok-meta"></div></div>`).join('');
      rosterEl.style.setProperty('--n', v.robots.length);
      delete rosterEl.dataset.order;
    }
    // the ending: its stage (the roster is in finishing order from the standings on), and who is getting an award
    const end = v.phase === 'over' ? ending : null;
    rosterEl.dataset.end = end?.stage ?? '';
    const awarded = end ? awardNow(v)?.ids ?? [] : [];
    const acting = v.phase === 'activate' ? v.beat.what?.id : null;
    const leader = api.players?.find((p) => p.isVip)?.id ?? null;
    // who the room is waiting on: they pulse; once only one or two are left (and someone is done), they rise
    // and the ones who are done step back, so the room sees whose phone it is
    const waitPhase = !briefing && (['upgrade', 'program'].includes(v.phase) || practising(v));
    const waiting = waitPhase ? v.robots.filter((r) => !doneOf(v, r) && !r.away) : [];
    const doneCount = waitPhase ? v.robots.filter((r) => doneOf(v, r)).length : 0;
    rosterEl.classList.toggle('waiting', waiting.length > 0);
    rosterEl.classList.toggle('few', waiting.length > 0 && waiting.length <= 2 && doneCount > 0);
    for (const r of v.robots) {
      const el = rosterEl.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      if (!el) continue;
      el.style.setProperty('--c', r.color);
      el.classList.toggle('away', !!r.away);
      el.classList.toggle('ready', !!r.ready && ['program', 'upgrade'].includes(v.phase));
      el.classList.toggle('deciding', v.prompt?.id === r.id);
      el.classList.toggle('acting', acting === r.id);
      el.classList.toggle('prio', r.id === v.prio && !['setup', 'start', 'over'].includes(v.phase));
      el.classList.toggle('winner', v.phase === 'over' && r.id === v.winner);
      el.classList.toggle('awarded', awarded.includes(r.id));
      el.classList.toggle('leader', r.id === leader);
      const done = waitPhase ? doneOf(v, r) : null;
      el.classList.toggle('wait', done === false && !r.away);
      el.classList.toggle('done', done === true);
      set(el.children[0], tokenTop(v, r));
      set(el.children[1], `${robotSvg(r, { dim: r.away })}${r.id === leader ? `<span class="lm-leader" title="Leader">${LEADER}</span>` : ''}${done ? `<span class="lm-done">${svgGlyph('check')}</span>` : ''}`);
      set(el.children[2], html`${r.name}`);
      const ups = (r.perm?.length ?? 0) + (r.temp ?? 0);
      set(el.children[3], html`${flagBars(v, r)}${v.opts.upgrades && r.en != null && html`<span class="lm-en">${G('bolt')}${r.en}</span>`}${ups > 0 && html`<span class="lm-ups">${(r.perm ?? []).map(() => html`<i></i>`)}${Array.from({ length: r.temp ?? 0 }, () => html`<i class="t"></i>`)}</span>`}`);
    }
    orderRoster(end && end.stage !== 'winner' ? v.result?.order ?? null : null);
  }

  function renderRegs(v) {
    if (briefing) return; // the Briefing shows its own strip
    if (v.phase !== 'activate') return set(regsEl, '');
    set(regsEl, html`${[0, 1, 2, 3, 4].map((i) => html`<i class="${i === v.reg && 'now'} ${i < v.reg && 'done'}">${i + 1}</i>`)}`);
  }

  function renderTitle(v) {
    if (v.phase === 'setup' || v.phase === 'over') return set(titleEl, '');
    // the course's name, briefly, when the race begins; then nothing
    set(titleEl, v.phase === 'start' ? html`<h1>${courseTitle(v.opts.course)}</h1>` : '');
  }

  function renderCenter(v) {
    switch (v.phase) {
      case 'setup': {
        const o = v.opts;
        // a hover says what the option does, in a few words (the phones' "?" says more)
        const TIPS = {
          upgrades: 'Upgrade shop: spend energy on upgrades',
          lessDeadly: 'Map perimeter: a wall all round, no falling off the edge',
          lessSpam: 'SPAM in hand discards: each round, unplayed SPAM leaves your hand',
          brief: 'Rules tutorial: the full narrated rules before round 1, for everyone (off: a short reel and a test drive on the phones, when someone is new)',
        };
        const toggle = (key, glyph) => html`<button class="lm-opt ${o[key] && 'on'}" data-host="${key}=${String(!o[key])}" title="${TIPS[key] ?? key}">${raw(svgGlyph(glyph))}</button>`;
        // the frame is made once (the map strip's pictures don't change); the titles, the strip's highlight and the
        // options change in place, so a map sliding in (slideTick) never has the page rebuilt under it
        if (set(centerEl, setupFrame()) || !setupEls) {
          const q = (sel) => centerEl.querySelector(sel);
          setupEls = { heads: q('.lm-heads'), strip: q('.lm-courses'), hl: [...centerEl.querySelectorAll('.lm-course-hl')], opts: q('.lm-opts'), boxes: null };
          setupEls.strip.addEventListener('transitionend', (e) => e.target.matches('.lm-course') && onResizeStrip());
        }
        for (const b of setupEls.strip.querySelectorAll('.lm-course')) b.classList.toggle('on', b.dataset.course === o.course);
        renderHeads();
        set(setupEls.opts, html`
              ${toggle('upgrades', 'bolt')}
              ${toggle('lessDeadly', 'wall')}
              ${toggle('lessSpam', 'sp')}
              ${toggle('brief', 'tutorial')}
              <span class="lm-seg-cap" aria-hidden="true">${raw(svgGlyph('timer'))}</span>
              <span class="lm-seg">${TIMERS.map((t) => html`<button class="${o.timer === t && 'on'}" data-host="timer=${t}">${t ? t / 60 : raw(svgGlyph('inf'))}</button>`)}</span>
              <button class="lm-go" data-action="begin" title="Start">${raw(svgGlyph('play'))}</button>`);
        placeSlide(slide.o);
        return;
      }
      case 'over': {
        const w = robotById(v, v.winner);
        // the frame is made once (the winner's name comes in once); the ending's stage and its award change in place
        set(centerEl, html`
          <div class="lm-over" style="--c:${w?.color ?? '#f4efe4'}">
            <div class="lm-over-win">${w && html`<div class="lm-over-name">${w.name}</div><div class="lm-over-flags">${Array.from({ length: v.cps }, () => html`<i></i>`)}</div>`}</div>
            <div class="lm-over-award"></div>
            <div class="lm-over-replay">${raw(svgGlyph('rewind'))}</div>
            <div class="lm-over-btns">
              <button class="lm-again" data-action="rematch" title="Race again">${raw(svgGlyph('rematch'))}</button>
              <button class="lm-home" data-action="finish" title="Back to the lobby">${raw(svgGlyph('home'))}</button>
            </div>
          </div>`);
        const box = centerEl.querySelector('.lm-over');
        box.dataset.stage = ending?.stage ?? 'rest';
        // an award: a looping clip of what it counts (played by the robot that got it), its name, how many, and whose it is
        const a = awardNow(v);
        const who = a ? a.ids.map((id) => robotById(v, id)).filter(Boolean) : [];
        const fresh = set(box.querySelector('.lm-over-award'), a && html`
          <div class="lm-award-now">
            <canvas class="lm-award-clip" data-demo="${AWARDS[a.k].clip}"></canvas>
            <div class="lm-award-text">
              <span class="lm-award-title">${AWARDS[a.k].title}</span>
              <b class="lm-award-n">${a.n}</b>
              <span class="lm-award-who">${who.map((r) => html`<i style="--c:${r.color}">${r.name}</i>`)}</span>
            </div>
          </div>`);
        const clip = fresh && box.querySelector('.lm-award-clip');
        if (clip) mountDemo(clip, clip.dataset.demo, who[0]?.color, { safeEdges: !!v.opts.lessDeadly, form: formOf(who[0] ?? {}) });
        return;
      }
      case 'brief':
      case 'program':
        // round one (and the test drive before it): a reminder of what the phones are for (cards dropping into five slots)
        return set(centerEl, (v.phase === 'program' ? v.round === 1 : practising(v) && !briefing) ? html`<div class="lm-hint"><span class="lm-hint-slots"><i></i><i></i><i></i><i></i><i></i></span><span class="lm-hint-card">${raw(cardSvgHtml('m1', 'xs'))}</span></div>` : '');
    }
    return set(centerEl, '');
  }

  // ----- setup: the map carousel. The leader's phone slides it (view.browse), or a map is chosen here: the board, the
  // title and the strip's highlight all slide with it, the next map coming in from the side as on the phone -----
  const courseAt = (id, step) => COURSES[(Math.max(0, COURSES.findIndex((x) => x.id === id)) + step + COURSES.length) % COURSES.length].id;
  const courseIndex = (id) => COURSES.findIndex((x) => x.id === id);
  const slide = {
    o: 0, // how far it has slid, in maps (negative: moved left, the right-hand map coming in)
    course: null, // the map on stage
    left: null, // the maps shown either side (the neighbours; while a jump glides in, the one it left)
    right: null,
    mode: 'rest', // 'follow' (the leader's finger), 'drag' (a drag here), 'hold' (waiting for the chosen map), 'glide' (a timed slide home), 'rest'
    glide: null, // { from, t (ms so far), dur }
    live: false, // the leader is sliding it now
    buf: [], // the leader's slide, as the phone sent it: { t (the phone's clock, ms), o }, oldest first
    skew: 0, // this screen's clock less the phone's, for the quickest sample yet (skewUsed: eased toward it)
    ov: 0, // the slide's speed, maps per second
    t: 0, // (the last frame)
    px: 0, // how far a board moves on screen per map, in CSS px (the arena's measure; the titles move with it)
  };
  let setupEls = null;
  let setupHtml = null;

  /** The maps whose boards the arena keeps ready: the ones either side (and the one a glide is leaving), nearest first. */
  function slideSpares() {
    if (!slide.course) return [];
    return [...new Set([slide.o < 0 ? slide.right : slide.left, slide.left, slide.right, courseAt(slide.course, 1), courseAt(slide.course, -1)])].filter((id) => id && id !== slide.course);
  }

  // following the leader's phone (slideTick): its slide replayed this far behind the phone's own clock, so a sample
  // that's a little late still arrives in time, through a critically damped follow this tight (rad/s)
  const PLAY_DELAY = 60;
  const FOLLOW_W = 22;

  /** A view in setup: if the map changed, the slide carries on from where the new one already was (or glides it in). */
  function courseSlide(v) {
    const id = v.opts.course;
    if (slide.course === id) return;
    const from = slide.course;
    slide.course = id;
    slide.live = false;
    if (!from) {
      Object.assign(slide, { o: 0, ov: 0, mode: 'rest', glide: null, buf: [], left: courseAt(id, -1), right: courseAt(id, 1) });
      return;
    }
    // which way: a step round the carousel, or (a jump, from the strip here) toward where it sits in the strip
    const step = id === courseAt(from, 1) ? 1 : id === courseAt(from, -1) ? -1 : Math.sign(courseIndex(id) - courseIndex(from)) || 1;
    // the new map is where the old one's neighbour was a moment ago (it may have slid most of the way in already)
    slide.o += step;
    slide.left = step > 0 ? from : courseAt(id, -1);
    slide.right = step < 0 ? from : courseAt(id, 1);
    if (slide.mode === 'follow' && slide.buf.length && (id === courseAt(from, 1) || id === courseAt(from, -1))) {
      // the phone landed on its neighbour while its slide is still being replayed: it plays on, in the new map's terms
      for (const s of slide.buf) s.o += step;
      return;
    }
    slide.buf = [];
    if (Math.abs(slide.o) > 0.08) {
      const d = Math.min(1.5, Math.abs(slide.o));
      slide.mode = 'glide';
      slide.glide = { from: slide.o, t: 0, dur: 140 + 300 * d };
    } else slide.mode = 'follow';
  }

  /**
   * The leader's phone: where its carousel is now (or null: let go, and what's been sent plays out). Each sample
   * carries the phone's own clock, so the slide can be replayed here just as it moved there, however the network
   * bunched or delayed the samples on the way.
   */
  function noteBrowse(v) {
    const b = v.phase === 'setup' ? v.browse : null;
    if (!b || b.course !== slide.course) {
      slide.live = false;
      return;
    }
    const t = b.t ?? b.at; // (a phone that doesn't send its clock: the room's)
    const now = performance.now();
    const buf = slide.buf;
    const L = buf.at(-1);
    if (L && t <= L.t) return; // (seen already)
    const playedOut = !L || (!slide.live && now - slide.skewUsed - PLAY_DELAY > L.t);
    if (slide.mode !== 'follow' || playedOut) {
      // a new slide: it starts from where the board is now
      slide.buf = [{ t: t - 17, o: slide.o }];
      slide.skew = slide.skewUsed = now - t;
    } else if (t - L.t > 50) buf.push({ t: t - 17, o: L.o }); // (the finger was still until a frame before this)
    slide.skew = Math.min(slide.skew, now - t); // the quickest a sample has come: the clocks' difference
    slide.buf.push({ t, o: Math.max(-1.5, Math.min(1.5, b.offset)) });
    slide.live = true;
    slide.mode = 'follow';
    slide.glide = null;
  }
  /** Where the phone's slide was at phone time t (between the samples either side). */
  function slideAt(buf, t) {
    let i = 0;
    while (i < buf.length - 1 && buf[i + 1].t <= t) i++;
    const a = buf[i];
    const b = buf[i + 1];
    return !b || t <= a.t ? a.o : a.o + ((b.o - a.o) * (t - a.t)) / (b.t - a.t);
  }

  /**
   * Every frame: where the slide is now, and everything placed to match. Following the leader's phone, its slide is
   * replayed a moment behind (PLAY_DELAY) through a critically damped follow: a weighted average of where the slide
   * has just been, so it's smooth, and it never goes past where the slide stops (no overshoot, no bounce back).
   */
  function slideTick() {
    const now = performance.now();
    const dt = Math.min(100, now - (slide.t || now));
    slide.t = now;
    if (view?.phase !== 'setup' || !slide.course) return;
    let o = slide.o;
    if (slide.mode === 'hold' && now > slide.holdUntil) slide.mode = 'follow'; // (the change never came: home)
    if (slide.mode === 'glide') {
      slide.ov = 0;
      const G = slide.glide;
      G.t += Math.min(dt, 34); // (a slow frame doesn't skip part of the glide)
      const k = Math.min(1, G.t / G.dur);
      o = G.from * (1 - k) ** 3; // eases to a stop, as the phone's glide does
      if (k >= 1) {
        o = 0;
        slide.mode = 'rest';
      }
    } else if (slide.mode === 'follow') {
      const buf = slide.buf;
      let target = 0; // (let go and played out: home)
      let played = true;
      if (buf.length) {
        slide.skewUsed += (slide.skew - slide.skewUsed) * (1 - Math.exp(-dt / 150)); // (a quicker sample: eased in)
        const pt = now - slide.skewUsed - PLAY_DELAY; // the phone's time being shown now
        played = pt >= buf.at(-1).t;
        if (!played) target = slideAt(buf, pt);
        else if (slide.live) target = buf.at(-1).o; // (the finger is still)
        while (buf.length > 2 && buf[1].t < pt - 200) buf.shift(); // (what's long been played)
      }
      // the follow, in exact steps (toward this frame's target): e = (e0 + c·t)·e^(-wt), c = v0 + w·e0
      const w = FOLLOW_W;
      for (let left = dt / 1000; left > 1e-6; ) {
        const h = Math.min(left, 0.008);
        left -= h;
        const e = o - target;
        const c = slide.ov + w * e;
        const k = Math.exp(-w * h);
        o = target + (e + c * h) * k;
        slide.ov = (slide.ov - w * c * h) * k;
      }
      if (!slide.live && played && Math.abs(o) < 0.001 && Math.abs(slide.ov) < 0.02) {
        o = 0;
        slide.ov = 0;
        slide.mode = 'rest';
        slide.buf = [];
      }
    }
    if (slide.mode === 'rest' && !slide.live) {
      o = 0;
      // at rest: the true neighbours either side again (a jump's leftover is let go)
      const l = courseAt(slide.course, -1);
      const r = courseAt(slide.course, 1);
      if (slide.left !== l || slide.right !== r) {
        slide.left = l;
        slide.right = r;
        arena?.preload(slideSpares(), { perimeter: !!view.opts.lessDeadly });
        renderHeads();
      }
    }
    const moved = o !== slide.o;
    slide.o = o;
    arena?.setSlide(o, slide.left, slide.right);
    if (arena?.slidePx > 0) slide.px = arena.slidePx;
    if (!moved && o === 0 && !slide.placed) return;
    slide.placed = o !== 0;
    placeSlide(o);
  }

  /** The titles and the strip's highlight, where the slide has them. */
  function placeSlide(o) {
    if (!setupEls?.heads.isConnected) return;
    const px = slide.px || innerWidth * 0.8;
    for (const el of setupEls.heads.children) {
      const k = Number(el.dataset.k);
      const at = o + k;
      el.style.transform = at ? `translateX(${(at * px).toFixed(1)}px)` : '';
      el.style.visibility = Math.abs(at) < 1.15 && (k === 0 || o !== 0) ? '' : 'hidden';
    }
    const strip = setupEls.strip;
    const boxes = (setupEls.boxes ??= new Map([...strip.querySelectorAll('.lm-course')].map((b) => [b.dataset.course, { el: b, x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight }])));
    const cur = boxes.get(slide.course);
    if (!cur || !cur.w) {
      setupEls.boxes = null; // (not laid out yet)
      return;
    }
    const nb = boxes.get(o < 0 ? slide.right : o > 0 ? slide.left : null);
    const u = Math.min(1, Math.abs(o));
    const [h1, h2] = setupEls.hl;
    const put = (el, b, op) => {
      el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
      el.style.width = `${b.w.toFixed(1)}px`;
      el.style.height = `${b.h.toFixed(1)}px`;
      el.style.opacity = op;
    };
    const sliding = !!nb && u > 0;
    strip.classList.toggle('sliding', sliding);
    for (const b of boxes.values()) {
      if (sliding) b.el.style.setProperty('--sel', b === cur ? 1 - u : b === nb ? u : 0);
      else b.el.style.removeProperty('--sel');
    }
    if (!sliding) {
      put(h1, cur, 1);
      h2.style.opacity = 0;
      return;
    }
    const dir = o < 0 ? 1 : -1; // the highlight heads for the incoming map
    const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
    if (Math.sign(courseIndex(nb.el.dataset.course) - courseIndex(slide.course)) === dir) {
      put(h1, mix(cur, nb, u), 1);
      h2.style.opacity = 0;
    } else {
      // round the end of the strip: it slides off this end as the other comes in at the far end
      const pitch = boxes.size > 1 ? Math.abs([...boxes.values()][1].x - [...boxes.values()][0].x) : cur.w;
      put(h1, { ...cur, x: cur.x + dir * pitch * u }, 1 - u);
      put(h2, { ...nb, x: nb.x - dir * pitch * (1 - u) }, u);
    }
  }

  /** The setup screen's frame: titles (filled by renderHeads), the strip of maps with its highlight, the options. */
  function setupFrame() {
    setupHtml ??= String(html`
          <div class="lm-setup">
            <div class="lm-heads"></div>
            <div class="lm-courses">
              ${COURSES.map((x) => html`
                <button class="lm-course" data-host="course=${x.id}" data-course="${x.id}">
                  <img alt="" src="${thumb(x.id)}">
                  <span>${COURSE_TITLES[x.id] ?? x.name}</span>
                </button>`)}
              <i class="lm-course-hl" aria-hidden="true"></i><i class="lm-course-hl" aria-hidden="true"></i>
            </div>
            <div class="lm-opts"></div>
          </div>`);
    return setupHtml;
  }

  /** The titles: the map on stage, and the ones either side, ready to slide in with their boards. */
  function renderHeads() {
    const heads = setupEls?.heads;
    if (!heads?.isConnected || !slide.course) return;
    // the titles already showing move up a place (as the phone's slides do); only a new one is made
    const have = new Map([...heads.children].map((el) => [el.dataset.id, el]));
    const nodes = [[slide.left, -1], [slide.course, 0], [slide.right, 1]].map(([id, k]) => {
      let el = have.get(id);
      have.delete(id);
      if (!el) {
        const sel = COURSES.find((x) => x.id === id) ?? COURSES[0];
        const lvl = LEVELS[sel.level] ?? 1;
        const t = document.createElement('template');
        t.innerHTML = String(html`<div class="lm-head" data-id="${sel.id}">
              <h1 class="lm-course-name">${courseTitle(sel.id)}</h1>
              <div class="lm-course-meta"><span class="lm-level"><span class="pl-meter">${[1, 2, 3, 4].map((i) => html`<i class="${i <= lvl && 'on'}"></i>`)}</span>${sel.level ?? ''}</span><span class="lm-flagcount">${raw(svgGlyph('flag'))}${sel.checkpoints.length}</span></div>
            </div>`).trim();
        el = t.content.firstElementChild;
      }
      el.dataset.k = k;
      return el;
    });
    if (nodes.some((el, i) => heads.children[i] !== el) || heads.children.length !== nodes.length) heads.replaceChildren(...nodes);
    placeSlide(slide.o);
  }

  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const c = getCourse(id);
    const tile = Math.max(6, Math.floor(260 / Math.max(c.w, c.h * 1.5)));
    const cv = document.createElement('canvas');
    cv.width = c.w * tile;
    cv.height = c.h * tile;
    drawCourse(cv.getContext('2d'), c, { tile, glow: true });
    const url = cv.toDataURL();
    thumbs.set(id, url);
    return url;
  }

  // ----- the timer: a thin line of light across the top that shrinks to nothing -----
  let timerTotal = 0;
  let timerDeadline = 0;
  let lastTick = -1;
  let raf = 0;
  function timerLoop() {
    raf = requestAnimationFrame(timerLoop);
    slideTick();
    const v = view;
    const timed = v && (['upgrade', 'program'].includes(v.phase) || practising(v)) && v.deadline;
    const left = timed ? v.deadline - api.now() : 0;
    const relaxed = v?.phase === 'program' && !v.opts.timer;
    const visible = timed && (!relaxed || left < 30_000) && left > 0;
    if (v?.phase === 'program') callouts.tick(v, left);
    timerEl.classList.toggle('on', !!visible);
    if (!visible) return;
    if (v.deadline !== timerDeadline) {
      timerDeadline = v.deadline;
      timerTotal = Math.max(left, 1000);
      const planned = v.phase === 'program' ? (v.opts.timer || 0) * 1000 : PHASE_MS[v.phase];
      if (planned && Math.abs(planned - left) < 3000) timerTotal = planned;
    }
    const frac = Math.max(0, Math.min(1, left / timerTotal));
    timerEl.firstElementChild.style.transform = `scaleX(${frac})`;
    const secs = Math.ceil(left / 1000);
    timerEl.lastElementChild.textContent = secs;
    timerEl.classList.toggle('low', secs <= 10);
    if (secs <= 5 && secs !== lastTick && secs > 0) {
      lastTick = secs;
      sfx.tick(secs <= 2);
    }
  }
  timerLoop();

  /** The Briefing's skip tally: the skip mark, a small robot for each vote, an empty ring for each still needed. */
  function renderTally(v) {
    const votes = v.phase === 'brief' ? v.brief?.votes ?? [] : [];
    tallyEl.hidden = !votes.length;
    skipBtn.hidden = v.phase !== 'brief';
    if (!votes.length) return set(tallyEl, '');
    const need = Math.max(0, (v.brief?.need ?? 0) - votes.length);
    set(tallyEl, html`${raw(SKIP())}${votes.map((id) => {
      const r = robotById(v, id);
      return r ? html`<span class="tc-voter" style="--c:${r.color}">${raw(robotSvg(r))}</span>` : '';
    })}${Array.from({ length: need }, () => html`<i class="tc-need"></i>`)}`);
  }

  function render(v) {
    host.dataset.phase = v.phase;
    host.classList.toggle('upgrades', !!v.opts.upgrades);
    renderRoster(v);
    renderRegs(v);
    renderTitle(v);
    renderCenter(v);
    renderTally(v);
    if (!prioHold) placePrio(['setup', 'start', 'over'].includes(v.phase) ? null : v.prio);
    hurryBtn.hidden = !['upgrade', 'program'].includes(v.phase);
  }

  /** Setup is over: the slide stops, and the boards built ahead are let go. */
  function endSlide() {
    Object.assign(slide, { o: 0, course: null, left: null, right: null, mode: 'rest', glide: null, live: false, buf: [], ov: 0, placed: false });
    setupEls = null;
    arena?.setSlide(0);
  }
  // a resize (or the browser zoomed): the strip's cards are measured again and the highlight put back on its map,
  // straight away and again as the cards finish easing to their new size (the strip's transitionend, below)
  const remeasureStrip = () => {
    if (!setupEls) return;
    setupEls.boxes = null;
    if (slide.course) placeSlide(slide.o);
  };
  const onResizeStrip = () => requestAnimationFrame(remeasureStrip);
  window.addEventListener('resize', onResizeStrip);

  // for test scripts: what the big screen sees
  window.lumenHost = { view: () => view, arena: () => arena, voice, briefing: () => briefing, callouts, slide: () => ({ ...slide }), ending: () => ending && { stage: ending.stage, award: ending.award, replay: !!replay }, holdEnding, skipEnding };

  return {
    update(next) {
      if (!next?.opts) return; // no view yet (the game is starting)
      prev = view;
      view = next;
      if (next.phase === 'brief' && prev && prev.phase !== 'brief') callouts.again(); // someone is new: the race teaches from the start
      if (next.phase === 'start' && prev?.phase !== 'start') startDrop();
      if (next.phase === 'over' && prev?.phase !== 'over') startEnding();
      else if (next.phase !== 'over' && ending) stopEnding(); // (a rematch)
      if (next.phase === 'setup') courseSlide(next);
      else if (slide.course) endSlide();
      apply(next);
      render(next);
      noteBrowse(next);
      noticeChanges(next, prev);
      callouts.view(next, prev);
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(dropTimer);
      clearTimeout(ending?.timer);
      clearTimeout(replay?.timer);
      offSound();
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResizeStrip);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      explainer.destroy();
      briefing?.stop();
      briefing = null;
      callouts.stop();
      voice.cancel();
      offCaption();
      line.destroy();
      arena?.destroy();
    },
  };
}
