// Lumen's sounds, synthesized with Web Audio: glass chimes, soft air, thin beams of light.
// Only the big screen plays them, so heads turn toward it. Browsers keep audio off until someone
// clicks or presses a key on the page; unlock() is called on the first gesture.

let ctx = null;
let master = null;
let wet = null;
let noiseBuf = null;
let muted = false;
let level = 1;
let duck = 1; // the narrator is speaking: everything else steps back (voice.js)
const listeners = new Set();

const C5 = 523.25;
const hz = (n) => C5 * 2 ** (n / 12);

function setup() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55 * level * duck;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  // a soft hall: decaying stereo noise as the impulse response
  const len = Math.floor(ctx.sampleRate * 3.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2 * (i < ctx.sampleRate * 0.012 ? 0 : 1);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  wet = ctx.createGain();
  wet.gain.value = 0.32;
  wet.connect(verb).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  ctx.onstatechange = () => notify();
  return ctx;
}

function notify() {
  for (const fn of listeners) fn(state());
}

/** 'on' | 'locked' (needs a click) | 'muted' | 'none' */
export function state() {
  if (muted) return 'muted';
  if (!ctx) return 'locked';
  return ctx.state === 'running' ? 'on' : 'locked';
}

export function onState(fn) {
  listeners.add(fn);
  fn(state());
  return () => listeners.delete(fn);
}

export function unlock() {
  const c = setup();
  if (c && c.state !== 'running') c.resume().then(notify, () => {});
  notify();
}

export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem('lumen.muted', muted ? '1' : ''); } catch {}
  if (master) master.gain.value = muted ? 0 : 0.55 * level * duck;
  if (!muted) unlock();
  notify();
}

/** Overall loudness (the lobby's rule film plays quieter than a race). */
export function setLevel(k) {
  level = k;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55 * level * duck, ctx.currentTime, 0.4);
}

/** Duck under the narrator's voice: 0.5 while it speaks, 1 afterwards (on top of setLevel). */
export function setDuck(k) {
  duck = k;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55 * level * duck, ctx.currentTime, 0.15);
}

const lastSound = new Map();
function once(key, ms, fn) {
  const now = performance.now();
  if (now - (lastSound.get(key) ?? 0) < ms) return;
  lastSound.set(key, now);
  fn();
}

/**
 * The 3D scene's events (scene.js emits them) as sounds. seatOf(id) gives a robot's seat (its note).
 * Only the moments worth turning a head for make a sound: nothing for a robot moving, turning, riding a belt,
 * bumping a wall or a laser beam firing (that's the whole board, all the time). What does:
 *   a robot takes damage (a card dealt to it), falls, comes back, reaches a flag, wins, shoves another robot,
 *   picks up energy, raises a shield.
 */
export function sceneSound(kind, d, seatOf = () => 0) {
  switch (kind) {
    case 'damage':
    case 'fizzle': return once('hurt', 160, () => sfx.hurt(d.n ?? 1));
    case 'fall': return once('fall', 200, () => sfx.fall());
    case 'reboot': return once('reboot', 200, () => sfx.reboot());
    case 'checkpoint': return sfx.checkpoint(seatOf(d.id));
    case 'win': return sfx.win(seatOf(d.id));
    case 'shove': return d.i ? undefined : once('shove', 250, () => sfx.shove());
    case 'yay': return once('yay', 250, () => sfx.yay(d.big));
    case 'energy': return once('energy', 150, () => sfx.energy());
    case 'shield': return once('shield', 150, () => sfx.shield());
    // silent: move, turn, bump, bonk, strain, belt, gear, push, laser, reveal, play, teeter, plunge, thud,
    // gulp, poof, land, combo, slowmo (a fall and a reboot each get one calm sound instead)
  }
}

try { muted = localStorage.getItem('lumen.muted') === '1'; } catch {}

const live = () => ctx && ctx.state === 'running' && !muted;

function out(node, dry = 1, reverb = 0.6) {
  const d = ctx.createGain();
  d.gain.value = dry;
  node.connect(d).connect(master);
  if (reverb > 0) {
    const w = ctx.createGain();
    w.gain.value = reverb;
    node.connect(w).connect(wet);
  }
}

/** A struck glass note: inharmonic partials, each fading at its own rate. */
function chime(n, { at = 0, vol = 0.18, decay = 2.2, bright = 1, reverb = 0.8 } = {}) {
  const t = ctx.currentTime + at;
  const f = hz(n);
  const bus = ctx.createGain();
  out(bus, 1, reverb);
  for (const [ratio, amp, dk] of [[1, 1, 1], [2.76, 0.32 * bright, 0.45], [5.4, 0.14 * bright, 0.25], [8.93, 0.06 * bright, 0.15]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * dk);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + decay * dk + 0.05);
  }
}

/** Filtered noise: air, paper, whirr. */
function noise({ at = 0, dur = 0.3, vol = 0.1, type = 'bandpass', f0 = 800, f1 = 1600, q = 1.2, reverb = 0.3, attack = 0.02 } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, t);
  filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g);
  out(g, 1, reverb);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

/** A tone that glides. */
function glide({ at = 0, from = 400, to = 100, dur = 1, vol = 0.12, type = 'sine', reverb = 0.5, lp = 0 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o.connect(g);
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lp, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, lp / 6), t + dur);
    node = g.connect(f);
  }
  out(node, 1, reverb);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A short knock (a wood block made of glass). */
function knock({ at = 0, f = 700, vol = 0.14, decay = 0.08, reverb = 0.25 } = {}) {
  const t = ctx.currentTime + at;
  for (const [ratio, amp] of [[1, 1], [1.69, 0.5], [2.9, 0.18]]) {
    const o = ctx.createOscillator();
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / ratio ** 0.3);
    o.connect(g);
    out(g, 1, reverb);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

// ---------- the sounds ----------

export const sfx = {
  /** Someone joined, picked a start space or locked in: their own note. */
  note(seat, vol = 0.16) {
    if (!live()) return;
    chime(NOTES[seat % NOTES.length], { vol });
  },
  join(seat) {
    if (!live()) return;
    const n = NOTES[seat % NOTES.length];
    chime(n, { vol: 0.15 });
    chime(n + 12, { at: 0.09, vol: 0.08, decay: 1.6 });
  },
  ready(seat) {
    if (!live()) return;
    chime(NOTES[seat % NOTES.length] + 12, { vol: 0.09, decay: 1.4, bright: 0.6 });
  },
  /** A new round of programming. */
  round() {
    if (!live()) return;
    [0, 7, 12].forEach((n, i) => chime(n - 12, { at: i * 0.07, vol: 0.09, decay: 3, bright: 0.5 }));
  },
  /** The cards are about to run. */
  go() {
    if (!live()) return;
    [0, 4, 7, 12].forEach((n, i) => chime(n, { at: i * 0.06, vol: 0.08, decay: 2, bright: 0.7 }));
  },
  /** Off the board or down a pit: one soft falling tone, fading out. */
  fall() {
    if (!live()) return;
    glide({ from: 520, to: 130, dur: 0.9, vol: 0.07, reverb: 0.6, lp: 2400 });
    chime(-5, { at: 0.05, vol: 0.06, decay: 1.6, bright: 0.3 });
  },
  /** Back on the board: a gentle rise and a bell. */
  reboot() {
    if (!live()) return;
    glide({ from: 260, to: 620, dur: 0.5, vol: 0.04, reverb: 0.6 });
    chime(12, { at: 0.42, vol: 0.08, decay: 1.6, bright: 0.5 });
  },
  /** A damage card dealt to a robot: a soft card flick and two low notes stepping down (more damage, a little fuller). */
  hurt(n = 1) {
    if (!live()) return;
    noise({ dur: 0.1, vol: 0.035, f0: 2600, f1: 1400, q: 1.5, attack: 0.004, reverb: 0.2 });
    chime(-9, { at: 0.03, vol: 0.09, decay: 1.2, bright: 0.35, reverb: 0.5 });
    chime(-12, { at: 0.16, vol: 0.08 + 0.01 * Math.min(3, n), decay: 1.5, bright: 0.3, reverb: 0.5 });
  },
  energy() {
    if (!live()) return;
    chime(19, { vol: 0.07, decay: 1, bright: 0.4 });
    chime(24, { at: 0.07, vol: 0.05, decay: 1, bright: 0.4 });
  },
  shield() {
    if (!live()) return;
    glide({ from: 900, to: 1400, dur: 0.4, vol: 0.05, type: 'triangle', reverb: 0.6 });
  },
  checkpoint(seat) {
    if (!live()) return;
    const n = NOTES[seat % NOTES.length];
    [0, 4, 7, 12].forEach((k, i) => chime(n + k, { at: i * 0.08, vol: 0.14, decay: 3.2 }));
  },
  win(seat) {
    if (!live()) return;
    const n = NOTES[seat % NOTES.length] - 12;
    const steps = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
    steps.forEach((k, i) => chime(n + k, { at: i * 0.11, vol: 0.13, decay: 3.6 }));
    [0, 7, 12, 16].forEach((k) => chime(n + k - 12, { at: 1.3, vol: 0.12, decay: 5, bright: 0.3 }));
  },
  // ----- robots meeting -----
  /** Robot pushes robot: a soft, round knock. */
  shove() {
    if (!live()) return;
    knock({ f: 300, vol: 0.09, decay: 0.12, reverb: 0.3 });
    glide({ from: 120, to: 60, dur: 0.16, vol: 0.06, reverb: 0.15 });
  },
  /** Pushed somewhere it wanted to go. */
  yay(big = false) {
    if (!live()) return;
    (big ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]).forEach((k, i) => chime(k + 7, { at: i * 0.055, vol: 0.06, decay: 1.2, bright: 0.6 }));
  },
  /** Someone has a decision to make on their phone. */
  ask() {
    if (!live()) return;
    chime(7, { vol: 0.08, decay: 1.2, bright: 0.5 });
    chime(12, { at: 0.16, vol: 0.08, decay: 1.4, bright: 0.5 });
  },
  tick(last) {
    if (!live()) return;
    noise({ dur: 0.05, vol: last ? 0.06 : 0.035, f0: 5000, f1: 4000, q: 3, attack: 0.002, reverb: 0.1 });
  },
};

// each seat's note: a major pentatonic scale, so any mix of robots sounds good together
const NOTES = [0, 4, 7, 9, 12, 2, 16, 14];
