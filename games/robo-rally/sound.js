// Lumen's sounds, synthesized with Web Audio: glass chimes, soft air, thin beams of light.
// Only the big screen plays them, so heads turn toward it. Browsers keep audio off until someone
// clicks or presses a key on the page; unlock() is called on the first gesture.

let ctx = null;
let master = null;
let wet = null;
let noiseBuf = null;
let muted = false;
let level = 1;
const listeners = new Set();

const C5 = 523.25;
const hz = (n) => C5 * 2 ** (n / 12);

function setup() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55 * level;
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
  if (master) master.gain.value = muted ? 0 : 0.55 * level;
  if (!muted) unlock();
  notify();
}

/** Overall loudness (the lobby's rule film plays quieter than a race). */
export function setLevel(k) {
  level = k;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55 * level, ctx.currentTime, 0.4);
}

const lastSound = new Map();
function once(key, ms, fn) {
  const now = performance.now();
  if (now - (lastSound.get(key) ?? 0) < ms) return;
  lastSound.set(key, now);
  fn();
}

/** The 3D scene's events (scene.js emits them) as sounds. seatOf(id) gives a robot's seat (its note). */
export function sceneSound(kind, d, seatOf = () => 0) {
  switch (kind) {
    case 'move': return once('move', 90, () => sfx.move(d.n, d.dur));
    case 'turn': return once('turn', 60, () => sfx.turn());
    case 'bump': return once('bump', 120, () => sfx.bump());
    case 'laser': return once('laser', 70, () => sfx.laser(d.board));
    case 'damage': return once('damage', 80, () => sfx.damage(d.n));
    case 'fall': return; // the fall's own sounds follow: uh-oh, then a slide whistle or a gulp
    case 'reboot': return sfx.reboot();
    // the comic moments
    case 'shove': return once(`shove${d.i}`, 100, () => sfx.shove(d.i ?? 0, d.stuck));
    case 'strain': return once('strain', 300, () => sfx.strain());
    case 'bonk': return once('bonk', 120, () => sfx.bonk(d.n ?? 0));
    case 'teeter': return once('teeter', 200, () => sfx.uhoh(d.big));
    case 'plunge': return once('plunge', 150, () => sfx.slide());
    case 'thud': return once('thud', 150, () => sfx.thud());
    case 'gulp': return once('gulp', 150, () => sfx.gulp());
    case 'poof': return once('poof', 150, () => sfx.poof());
    case 'fizzle': return once('fizzle', 90, () => sfx.fizzle(d.n ?? 1));
    case 'yay': return once('yay', 200, () => sfx.yay(d.big));
    case 'combo': return once('combo', 250, () => sfx.dizzy(d.n ?? 2));
    case 'slowmo': return once('slowmo', 400, () => sfx.slowmo());
    case 'land': return once('land', 150, () => sfx.land());
    case 'checkpoint': return sfx.checkpoint(seatOf(d.id));
    case 'win': return sfx.win(seatOf(d.id));
    case 'belt': return once('belt', 200, () => sfx.belt(d.fast));
    case 'gear': return once('gear', 200, () => sfx.gear());
    case 'push': return once('push', 150, () => sfx.push());
    case 'reveal': return sfx.reveal(d.reg ?? 0);
    case 'play': return once(`play${d.id}`, 100, () => sfx.play(seatOf(d.id)));
    case 'energy': return once('energy', 100, () => sfx.energy());
    case 'shield': return sfx.shield();
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

/** A cartoon spring: a tone that bends (up, or down for a slide whistle) with a wobble that dies away. */
function boing({ at = 0, f = 220, to = 1.7, dur = 0.42, vol = 0.1, rate = 22, depth = 0.22, type = 'sine', reverb = 0.25 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * to, t + dur * 0.75);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(f * depth, t);
  lg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * depth * 0.08), t + dur);
  lfo.connect(lg).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.setValueAtTime(vol, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  out(g, 1, reverb);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
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

/** A sung syllable: a buzzy tone through a vowel's resonance ("uh", "oh"). */
function syllable({ at = 0, from = 400, to = 380, dur = 0.2, vol = 0.08, formant = 800, reverb = 0.3 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = formant;
  f1.Q.value = 5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.025);
  g.gain.setValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f1).connect(lp).connect(g);
  out(g, 1.6, reverb);
  o.start(t);
  o.stop(t + dur + 0.05);
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
  reveal(reg) {
    if (!live()) return;
    noise({ dur: 0.18, vol: 0.06, type: 'highpass', f0: 3000, f1: 6000, reverb: 0.2 });
    chime(-12 + reg * 2, { at: 0.02, vol: 0.1, decay: 1.4, bright: 0.4 });
  },
  play(seat) {
    if (!live()) return;
    chime(NOTES[seat % NOTES.length], { vol: 0.07, decay: 0.9, bright: 0.5, reverb: 0.4 });
  },
  move(n = 1, dur = 0.4) {
    if (!live()) return;
    noise({ dur: Math.max(0.25, dur + 0.1), vol: 0.05 + 0.012 * n, f0: 380, f1: 900 + 200 * n, q: 0.9, attack: dur * 0.4, reverb: 0.25 });
  },
  turn() {
    if (!live()) return;
    noise({ dur: 0.12, vol: 0.05, f0: 2400, f1: 1800, q: 4, reverb: 0.15, attack: 0.005 });
  },
  bump() {
    if (!live()) return;
    glide({ from: 140, to: 70, dur: 0.18, vol: 0.12, reverb: 0.2 });
  },
  belt(fast) {
    if (!live()) return;
    glide({ from: fast ? 120 : 90, to: fast ? 150 : 100, dur: 0.9, vol: 0.07, type: 'triangle', reverb: 0.3 });
    noise({ dur: 0.9, vol: 0.03, f0: 600, f1: 900, q: 6, attack: 0.3, reverb: 0.2 });
  },
  gear() {
    if (!live()) return;
    for (let i = 0; i < 4; i++) noise({ at: i * 0.09, dur: 0.05, vol: 0.05, f0: 3200, f1: 2600, q: 6, reverb: 0.1, attack: 0.003 });
  },
  push() {
    if (!live()) return;
    glide({ from: 180, to: 60, dur: 0.25, vol: 0.14, reverb: 0.2 });
    noise({ dur: 0.12, vol: 0.05, f0: 1200, f1: 400, attack: 0.004 });
  },
  laser(board) {
    if (!live()) return;
    glide({ from: board ? 1900 : 2600, to: board ? 700 : 900, dur: 0.32, vol: 0.06, type: 'sawtooth', reverb: 0.4, lp: 5000 });
    glide({ from: board ? 3800 : 5200, to: 2000, dur: 0.2, vol: 0.03, reverb: 0.5 });
  },
  damage(n = 1) {
    if (!live()) return;
    glide({ from: 160, to: 55, dur: 0.3, vol: 0.16, reverb: 0.2 });
    for (let i = 0; i < Math.min(4, n + 1); i++) noise({ at: 0.03 + i * 0.05, dur: 0.06, vol: 0.06, f0: 4200, f1: 2500, q: 2, attack: 0.002, reverb: 0.2 });
  },
  fall() {
    if (!live()) return;
    glide({ from: 620, to: 55, dur: 1.2, vol: 0.13, reverb: 0.7, lp: 4000 });
  },
  reboot() {
    if (!live()) return;
    glide({ from: 180, to: 880, dur: 0.6, vol: 0.06, reverb: 0.6 });
    chime(12, { at: 0.5, vol: 0.1, decay: 1.8 });
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
  // ----- the comic moments -----
  /** Robot hits robot: a whomp and a boing (higher for each robot down a chain). */
  shove(i = 0, stuck = false) {
    if (!live()) return;
    glide({ from: 150, to: 48, dur: 0.22, vol: 0.17, reverb: 0.15 });
    noise({ dur: 0.08, vol: 0.06, type: 'lowpass', f0: 1200, f1: 250, q: 0.7, attack: 0.003, reverb: 0.1 });
    if (!stuck) boing({ at: 0.02, f: 190 * 1.26 ** i, to: 1.65, dur: 0.4, vol: 0.075 });
  },
  /** Pushing with everything it has, and nothing moves. */
  strain() {
    if (!live()) return;
    boing({ f: 520, to: 1.3, dur: 0.5, vol: 0.045, rate: 11, depth: 0.05, type: 'triangle', reverb: 0.2 });
    noise({ dur: 0.45, vol: 0.025, f0: 1800, f1: 2600, q: 8, attack: 0.1, reverb: 0.1 });
  },
  /** Into a wall: a knock, and a boing if it was going fast. */
  bonk(n = 0) {
    if (!live()) return;
    knock({ f: 620 - n * 60, vol: 0.15 + n * 0.03 });
    glide({ from: 130, to: 55, dur: 0.14, vol: 0.12, reverb: 0.1 });
    if (n > 0) boing({ at: 0.03, f: 260, to: 1.4, dur: 0.38, vol: 0.05 + n * 0.02 });
  },
  /** Over the edge (or on the rim of a pit): uh-oh. */
  uhoh(big = false) {
    if (!live()) return;
    syllable({ from: 415, to: 405, dur: 0.15, vol: big ? 0.1 : 0.08, formant: 720 });
    syllable({ at: 0.19, from: 340, to: 300, dur: 0.3, vol: big ? 0.1 : 0.08, formant: 520 });
  },
  /** A slide whistle, all the way down. */
  slide() {
    if (!live()) return;
    boing({ f: 1700, to: 0.13, dur: 0.66, vol: 0.075, rate: 7, depth: 0.025, reverb: 0.35 });
    noise({ dur: 0.62, vol: 0.02, f0: 3200, f1: 500, q: 3, attack: 0.05, reverb: 0.2 });
  },
  /** ...and the far-off thud at the bottom. */
  thud() {
    if (!live()) return;
    glide({ from: 95, to: 36, dur: 0.32, vol: 0.2, reverb: 0.55, lp: 600 });
    noise({ dur: 0.18, vol: 0.05, type: 'lowpass', f0: 500, f1: 120, q: 0.7, attack: 0.004, reverb: 0.6 });
    knock({ at: 0.03, f: 180, vol: 0.06, decay: 0.12, reverb: 0.6 });
  },
  /** Sucked into a pit: gloop. */
  gulp() {
    if (!live()) return;
    noise({ dur: 0.42, vol: 0.06, f0: 2400, f1: 260, q: 4, attack: 0.04, reverb: 0.3 });
    glide({ from: 640, to: 95, dur: 0.3, vol: 0.12, reverb: 0.3 });
    glide({ at: 0.3, from: 120, to: 320, dur: 0.09, vol: 0.09, reverb: 0.25 });
  },
  /** The little ghost puffs out of the pit. */
  poof() {
    if (!live()) return;
    noise({ dur: 0.32, vol: 0.05, type: 'highpass', f0: 1600, f1: 5200, q: 0.7, attack: 0.01, reverb: 0.5 });
    chime(19, { at: 0.05, vol: 0.05, decay: 1.4, bright: 0.4 });
    chime(15, { at: 0.2, vol: 0.04, decay: 1.6, bright: 0.3 });
  },
  /** A laser hit sizzles: crackles, then a fizz. */
  fizzle(n = 1) {
    if (!live()) return;
    const count = 4 + 3 * Math.min(3, n);
    for (let i = 0; i < count; i++) {
      const at = Math.random() * 0.4 * (i / count) + i * 0.025;
      noise({ at, dur: 0.012 + Math.random() * 0.02, vol: 0.06 * (1 - i / count / 1.5), f0: 3000 + Math.random() * 3000, f1: 2400, q: 3, attack: 0.001, reverb: 0.15 });
    }
    noise({ at: 0.05, dur: 0.55, vol: 0.025, type: 'highpass', f0: 5200, f1: 7000, q: 0.5, attack: 0.02, reverb: 0.2 });
    glide({ from: 150, to: 60, dur: 0.22, vol: 0.09, reverb: 0.15 });
  },
  /** Pushed somewhere it wanted to go. */
  yay(big = false) {
    if (!live()) return;
    (big ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]).forEach((k, i) => chime(k + 7, { at: i * 0.055, vol: 0.075, decay: 1.2, bright: 0.7 }));
    boing({ at: 0.02, f: 330, to: 1.5, dur: 0.25, vol: 0.04, rate: 18, depth: 0.08 });
  },
  /** Dizzy: little birds tweeting round its head. */
  dizzy(n = 2) {
    if (!live()) return;
    for (let i = 0; i < Math.min(5, n + 1); i++) {
      glide({ at: i * 0.12, from: 2500 + i * 120, to: 3700 + i * 160, dur: 0.055, vol: 0.035, reverb: 0.3 });
      glide({ at: i * 0.12 + 0.055, from: 3700 + i * 160, to: 3000, dur: 0.045, vol: 0.03, reverb: 0.3 });
    }
  },
  /** Time slows down: a deep whoosh. */
  slowmo() {
    if (!live()) return;
    noise({ dur: 0.95, vol: 0.07, type: 'lowpass', f0: 3200, f1: 180, q: 1.4, attack: 0.08, reverb: 0.5 });
    glide({ from: 260, to: 55, dur: 0.95, vol: 0.07, reverb: 0.5 });
  },
  /** Back in: it lands on the reboot space with a boing. */
  land() {
    if (!live()) return;
    glide({ from: 120, to: 50, dur: 0.16, vol: 0.12, reverb: 0.15 });
    boing({ at: 0.01, f: 150, to: 1.6, dur: 0.36, vol: 0.08 });
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
