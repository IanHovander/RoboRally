// Sound for the big screen, all synthesized with Web Audio (nothing to download): paper foley
// (card flicks, slides, pop-ups, a ticket punch) and a kalimba for the happy moments.
// Browsers start sound only after someone clicks or presses a key on the page; unlock() is wired
// to that, and the speaker button (soundButton) shows when sound is waiting for a click.

const KEY = 'robo-rally.sound';
let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let sfxGain = 1;
let noise = null;
let muted = (() => {
  try { return localStorage.getItem(KEY) === 'off'; } catch { return false; }
})();
const listeners = new Set();

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxGain;
  sfxBus.connect(master);
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  ctx.onstatechange = () => notify();
  return ctx;
}

function notify() {
  for (const fn of listeners) fn();
}

/** Call from any click / key press: browsers only allow sound after one. */
export function unlock() {
  const c = ac();
  if (c && c.state !== 'running') c.resume().then(notify, () => {});
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true, passive: true });

export const soundState = () => (muted ? 'off' : !ctx || ctx.state !== 'running' ? 'waiting' : 'on');
export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch {}
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  notify();
}
/** How loud the sound effects are (the lobby's lessons play quieter than a race). */
export function sfxLevel(v) {
  sfxGain = v;
  if (sfxBus) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
}
export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const live = () => {
  const c = ac();
  return c && c.state === 'running' && !muted ? c : null;
};

// ---------- building blocks ----------

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(c, { type = 'sine', f = 440, to = null, t = 0, dur = 0.3, gain = 0.2, attack = 0.005, out = sfxBus }) {
  const at = c.currentTime + t;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  env(g, at, gain, attack, dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + attack + dur + 0.05);
}

function hiss(c, { t = 0, dur = 0.1, gain = 0.2, type = 'bandpass', f = 2000, to = null, q = 1, attack = 0.003, out = sfxBus }) {
  const at = c.currentTime + t;
  const s = c.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(f, at);
  if (to) filt.frequency.exponentialRampToValueAtTime(to, at + dur);
  filt.Q.value = q;
  const g = c.createGain();
  env(g, at, gain, attack, dur);
  s.connect(filt).connect(g).connect(out);
  const offset = Math.random() * 1.5;
  s.start(at, offset);
  s.stop(at + attack + dur + 0.05);
}

/** A kalimba tine: a sine with a bright, fast-fading overtone and a little click. */
function kalimba(c, f, t = 0, gain = 0.22, out = sfxBus) {
  tone(c, { f, t, dur: 1.4, gain, attack: 0.004, out });
  tone(c, { f: f * 5.95, t, dur: 0.12, gain: gain * 0.25, attack: 0.002, out });
  tone(c, { f: f * 2.01, t, dur: 0.35, gain: gain * 0.18, attack: 0.003, out });
  hiss(c, { t, dur: 0.012, gain: gain * 0.25, f: 3500, q: 2, out });
}

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note number -> Hz
const PENTA = [0, 2, 4, 7, 9];
const scale = (i, root = 67) => NOTE(root + PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5));

// ---------- the sounds ----------

export const sfx = {
  /** A robot lands on the next space. */
  step(i = 0) {
    const c = live();
    if (!c) return;
    hiss(c, { t: i, dur: 0.05, gain: 0.16, f: 700 + Math.random() * 200, q: 3 });
    tone(c, { t: i, f: 150, to: 90, dur: 0.07, gain: 0.12 });
  },
  /** Something slides on paper (belts). */
  slide(t = 0, fast = false) {
    const c = live();
    if (!c) return;
    hiss(c, { t, dur: fast ? 0.22 : 0.32, gain: 0.12, f: 900, to: fast ? 2600 : 1800, q: 1.2, attack: 0.04 });
  },
  /** A cutout swivels. */
  turn(t = 0) {
    const c = live();
    if (!c) return;
    hiss(c, { t, dur: 0.16, gain: 0.1, f: 2500, to: 5000, q: 0.8, attack: 0.03 });
  },
  /** A card is flicked face up. */
  flip(t = 0) {
    const c = live();
    if (!c) return;
    hiss(c, { t, dur: 0.018, gain: 0.3, type: 'highpass', f: 3000, q: 0.7 });
    hiss(c, { t: t + 0.01, dur: 0.07, gain: 0.12, f: 4200, q: 1.5 });
  },
  /** A paper piece pops up. */
  pop(t = 0, pitch = 1) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 210 * pitch, to: 80 * pitch, dur: 0.12, gain: 0.22 });
    hiss(c, { t, dur: 0.08, gain: 0.12, f: 3000, to: 1200, q: 1 });
  },
  laser(t = 0, big = false) {
    const c = live();
    if (!c) return;
    tone(c, { type: 'sawtooth', t, f: big ? 1500 : 2200, to: 260, dur: 0.28, gain: 0.07 });
    tone(c, { type: 'square', t, f: big ? 900 : 1300, to: 180, dur: 0.22, gain: 0.04 });
    hiss(c, { t, dur: 0.25, gain: 0.06, type: 'highpass', f: 5000, q: 0.5 });
  },
  hit(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 120, to: 50, dur: 0.18, gain: 0.3 });
    hiss(c, { t, dur: 0.16, gain: 0.25, type: 'lowpass', f: 1600, to: 400, q: 0.7 });
  },
  /** Two robots bump (a push). */
  bump(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 170, to: 70, dur: 0.12, gain: 0.25 });
    hiss(c, { t, dur: 0.06, gain: 0.18, f: 1200, q: 1.5 });
  },
  /** Falling down a hole: a whistle down, then a crumple. */
  fall(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 900, to: 140, dur: 0.75, gain: 0.08, attack: 0.02 });
    for (let i = 0; i < 9; i++) hiss(c, { t: t + 0.65 + i * 0.03 + Math.random() * 0.02, dur: 0.04, gain: 0.12 * (1 - i / 10), f: 1500 + Math.random() * 2500, q: 2 });
  },
  reboot(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 220, to: 660, dur: 0.3, gain: 0.1, attack: 0.02 });
    kalimba(c, scale(5), t + 0.28, 0.16);
    kalimba(c, scale(7), t + 0.4, 0.16);
  },
  /** A checkpoint: the ticket is punched and the kalimba runs up. */
  flag(n = 1, t = 0) {
    const c = live();
    if (!c) return;
    sfx.punch(t);
    for (let i = 0; i < 4; i++) kalimba(c, scale(5 + i + (n - 1)), t + 0.12 + i * 0.09, 0.2);
  },
  punch(t = 0) {
    const c = live();
    if (!c) return;
    hiss(c, { t, dur: 0.012, gain: 0.35, type: 'highpass', f: 2500, q: 0.7 });
    tone(c, { t: t + 0.005, f: 160, to: 90, dur: 0.06, gain: 0.2 });
  },
  energy(t = 0) {
    const c = live();
    if (!c) return;
    kalimba(c, scale(12), t, 0.13);
    kalimba(c, scale(14), t + 0.07, 0.11);
  },
  gear(dir = 1, t = 0) {
    const c = live();
    if (!c) return;
    for (let i = 0; i < 5; i++) hiss(c, { t: t + i * 0.06, dur: 0.02, gain: 0.14, f: dir > 0 ? 2400 + i * 150 : 3000 - i * 150, q: 6 });
  },
  pusher(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 260, to: 520, dur: 0.15, gain: 0.08, type: 'triangle' });
    sfx.bump(t + 0.08);
  },
  shield(t = 0) {
    const c = live();
    if (!c) return;
    tone(c, { t, f: 600, to: 1200, dur: 0.3, gain: 0.06, type: 'triangle' });
  },
  /** A robot's card is shown over it. */
  card(t = 0) {
    sfx.flip(t);
  },
  win() {
    const c = live();
    if (!c) return;
    const tune = [0, 2, 4, 5, 7, 9, 10];
    tune.forEach((n, i) => kalimba(c, scale(n), i * 0.11, 0.2));
    [10, 12, 14].forEach((n) => kalimba(c, scale(n), 0.95, 0.16));
    for (let i = 0; i < 14; i++) hiss(c, { t: 0.9 + Math.random() * 0.8, dur: 0.03, gain: 0.08, f: 4000 + Math.random() * 3000, q: 4 });
  },
  /** Someone joined the lobby. */
  join(i = 0) {
    const c = live();
    if (!c) return;
    sfx.pop(0, 1.2);
    kalimba(c, scale(5 + (i % 7)), 0.08, 0.16);
  },
  /** The race starts / a new phase. */
  start() {
    const c = live();
    if (!c) return;
    [0, 4, 7].forEach((n, i) => kalimba(c, scale(n + 5), i * 0.08, 0.18));
  },
  /** A player locked in their program. */
  lock() {
    const c = live();
    if (!c) return;
    tone(c, { f: 140, to: 70, dur: 0.1, gain: 0.22 });
    hiss(c, { dur: 0.05, gain: 0.12, type: 'lowpass', f: 900, q: 0.8 });
    kalimba(c, scale(9), 0.05, 0.08);
  },
  /** The clock in the last seconds. */
  tick(urgent = false) {
    const c = live();
    if (!c) return;
    hiss(c, { dur: 0.025, gain: urgent ? 0.22 : 0.1, f: urgent ? 2600 : 1900, q: 9 });
  },
  /** Somebody has a choice to make. */
  ask() {
    const c = live();
    if (!c) return;
    kalimba(c, scale(7), 0, 0.14);
    kalimba(c, scale(9), 0.12, 0.14);
  },
};

// ---------- music: a soft kalimba pattern in the lobby, a clock while programming ----------

let musicTimer = null;
let musicMode = null;
let beatN = 0;

export function music(mode) {
  if (mode === musicMode) return;
  musicMode = mode;
  clearInterval(musicTimer);
  musicTimer = null;
  beatN = 0;
  if (!mode) return;
  const ms = mode === 'lobby' ? 330 : 500;
  musicTimer = setInterval(() => playMusic(), ms);
}

const PATTERN = [0, null, 4, 2, null, 4, 7, null, 5, null, 4, 2, 0, null, 2, null];
function playMusic() {
  const c = live();
  beatN++;
  if (!c) return;
  if (musicMode === 'lobby') {
    const step = beatN % PATTERN.length;
    const bar = Math.floor(beatN / PATTERN.length) % 4;
    const n = PATTERN[step];
    if (n != null) kalimba(c, scale(n + [0, 0, 3, -2][bar], 60), 0, 0.12 + (step % 4 === 0 ? 0.04 : 0), musicBus);
    if (step === 0) tone(c, { f: scale([0, 0, 3, -2][bar], 36), dur: 2.2, gain: 0.09, attack: 0.08, out: musicBus });
  } else if (musicMode === 'think') {
    hiss(c, { dur: 0.02, gain: beatN % 2 ? 0.05 : 0.08, f: beatN % 2 ? 1800 : 1400, q: 9, out: musicBus });
    if (beatN % 8 === 0) kalimba(c, scale([0, 2, 4, 2][(beatN / 8) % 4], 55), 0, 0.1, musicBus);
  }
}
