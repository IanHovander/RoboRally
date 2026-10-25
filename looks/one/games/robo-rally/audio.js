// The big screen's sound, all synthesized (nothing to download): the hum of an empty hall, servos, steel,
// lasers, a slate clap for each register, a bell for each flag. Sound pulls eyes to the big screen, so it
// plays there only; phones stay silent. Browsers need one click or key press before sound can start.
const KEY = 'lastlight.sound';
const listeners = new Set();

let ctx = null;
let master = null;
let noise = null;
let brown = null;
let ambience = null;
let wants = (() => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
})();

function ensure() {
  if (ctx || !wants) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = 0.85 * level;
  master.connect(comp).connect(ctx.destination);
  noise = makeNoise(false);
  brown = makeNoise(true);
  ctx.onstatechange = notify;
  startAmbience();
  return ctx;
}

function makeNoise(isBrown) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (isBrown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function notify() {
  for (const fn of listeners) fn(state());
}

/** 'off' (muted by choice), 'blocked' (waiting for a click), 'on'. */
export function state() {
  if (!wants) return 'off';
  return ctx && ctx.state === 'running' ? 'on' : 'blocked';
}

export function onChange(fn) {
  listeners.add(fn);
  fn(state());
  return () => listeners.delete(fn);
}

/** Call from any click or key press: starts sound if it's wanted. */
export function unlock() {
  if (!wants) return;
  ensure();
  if (ctx && ctx.state !== 'running') ctx.resume().then(notify, () => {});
  notify();
}

export function toggle() {
  if (state() === 'blocked') return unlock();
  wants = !wants;
  try { localStorage.setItem(KEY, wants ? 'on' : 'off'); } catch {}
  if (wants) unlock();
  else if (ctx) ctx.suspend().then(notify, notify);
  notify();
}

// ---------- building blocks ----------

const now = () => ctx.currentTime;

function out(pan = 0, gain = 1) {
  const g = ctx.createGain();
  g.gain.value = gain;
  if (ctx.createStereoPanner && pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master);
  } else g.connect(master);
  return g;
}

function env(param, t, a, peak, hold, rel) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  param.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
}

function osc(type, freq, t, dur, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseSrc(t, dur, dest, { buf = noise, rate = 1 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.playbackRate.value = rate;
  s.connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
  return s;
}

function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function voice(gain, pan) {
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.connect(out(pan, gain));
  return g;
}

// ---------- the room ----------

function startAmbience() {
  if (ambience) return;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  g.connect(master);
  const lp = filter('lowpass', 170, 0.4);
  lp.connect(g);
  const s = ctx.createBufferSource();
  s.buffer = brown;
  s.loop = true;
  s.connect(lp);
  s.start();
  // a faint electrical hum from the lamps
  const hum = ctx.createGain();
  hum.gain.value = 0.006;
  hum.connect(master);
  const h = ctx.createOscillator();
  h.frequency.value = 100;
  h.connect(hum);
  h.start();
  ambience = { g, hum };
  const creak = () => {
    if (!ctx) return;
    if (ctx.state === 'running') {
      const t = now();
      const v = voice(0.05, Math.random() * 1.6 - 0.8);
      const bp = filter('bandpass', 300 + Math.random() * 400, 12);
      bp.connect(v);
      bp.frequency.exponentialRampToValueAtTime(150 + Math.random() * 200, t + 1.6);
      noiseSrc(t, 2, bp);
      env(v.gain, t, 0.4, 1, 0.3, 1.2);
    }
    setTimeout(creak, 18000 + Math.random() * 30000);
  };
  setTimeout(creak, 9000);
}

let level = 1;
/** Overall loudness: the lobby's trailer plays quietly underneath; the race plays at full level. */
export function setLevel(k) {
  level = k;
  if (master) master.gain.setTargetAtTime(0.85 * k, now(), 0.4);
}

/** The lamps' hum gets louder when they're on. */
export function setLamps(k) {
  if (ambience) ambience.hum.gain.setTargetAtTime(0.006 + k * 0.012, now(), 0.5);
}

// ---------- the sounds ----------

const SOUNDS = {
  servo({ steps = 1, pan = 0 } = {}) {
    const t = now();
    const dur = Math.max(0.22, steps * 0.31);
    const v = voice(0.05, pan);
    const bp = filter('bandpass', 520, 3);
    bp.connect(v);
    const o = osc('sawtooth', 110, t, dur, bp);
    o.frequency.linearRampToValueAtTime(150, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(120, t + dur);
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.linearRampToValueAtTime(720, t + dur * 0.4);
    bp.frequency.linearRampToValueAtTime(420, t + dur);
    env(v.gain, t, 0.05, 1, dur - 0.12, 0.09);
    const r = voice(0.06, pan);
    const lp = filter('lowpass', 260);
    lp.connect(r);
    noiseSrc(t, dur, lp, { buf: brown });
    env(r.gain, t, 0.05, 1, dur - 0.1, 0.1);
  },
  turn({ pan = 0 } = {}) {
    const t = now();
    const v = voice(0.045, pan);
    const bp = filter('bandpass', 700, 4);
    bp.connect(v);
    const o = osc('sawtooth', 160, t, 0.45, bp);
    o.frequency.linearRampToValueAtTime(210, t + 0.2);
    o.frequency.linearRampToValueAtTime(150, t + 0.45);
    env(v.gain, t, 0.04, 1, 0.3, 0.1);
  },
  clunk({ pan = 0 } = {}) {
    const t = now();
    const v = voice(0.35, pan);
    const o = osc('sine', 110, t, 0.25, v);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    env(v.gain, t, 0.005, 1, 0.02, 0.2);
    const n = voice(0.12, pan);
    const lp = filter('lowpass', 1400);
    lp.connect(n);
    noiseSrc(t, 0.08, lp);
    env(n.gain, t, 0.002, 1, 0.01, 0.06);
  },
  slate() {
    const t = now();
    const n = voice(0.32);
    const hp = filter('highpass', 1800);
    hp.connect(n);
    noiseSrc(t, 0.05, hp);
    env(n.gain, t, 0.001, 1, 0.004, 0.035);
    const k = voice(0.18);
    const o = osc('sine', 1650, t, 0.12, k);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
    env(k.gain, t, 0.001, 1, 0.005, 0.07);
    const b = voice(0.2);
    osc('triangle', 220, t, 0.15, b);
    env(b.gain, t, 0.002, 1, 0.01, 0.1);
  },
  laser({ pan = 0, hit = false } = {}) {
    const t = now();
    const v = voice(0.1, pan);
    const o = osc('sine', 2600, t, 0.32, v);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.28);
    const lfo = osc('sine', 38, t, 0.32, ctx.createGain());
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.disconnect();
    lfo.connect(lg).connect(o.frequency);
    env(v.gain, t, 0.004, 1, 0.08, 0.22);
    const n = voice(0.05, pan);
    const hp = filter('highpass', 4000);
    hp.connect(n);
    noiseSrc(t, 0.3, hp);
    env(n.gain, t, 0.002, 1, 0.05, 0.2);
    if (hit) setTimeout(() => SOUNDS.spark({ pan }), 120);
  },
  boardLaser({ hit = false } = {}) {
    const t = now();
    const v = voice(0.06);
    const bp = filter('bandpass', 900, 6);
    bp.connect(v);
    const o = osc('sawtooth', 96, t, 0.75, bp);
    o.frequency.linearRampToValueAtTime(104, t + 0.7);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.15);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.7);
    env(v.gain, t, 0.03, 1, 0.45, 0.25);
    const z = voice(0.05);
    const o2 = osc('sine', 1800, t, 0.6, z);
    o2.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    env(z.gain, t, 0.01, 1, 0.3, 0.25);
    if (hit) setTimeout(() => SOUNDS.spark({}), 150);
  },
  spark({ pan = 0 } = {}) {
    const t = now();
    for (let i = 0; i < 7; i++) {
      const at = t + Math.random() * 0.35;
      const n = voice(0.1 + Math.random() * 0.1, pan);
      const hp = filter('highpass', 2500 + Math.random() * 3000);
      hp.connect(n);
      noiseSrc(at, 0.03, hp);
      env(n.gain, at, 0.001, 1, 0.003, 0.02 + Math.random() * 0.03);
    }
  },
  bell({ n = 1 } = {}) {
    const t = now();
    const base = [523.25, 659.25, 783.99, 1046.5][(n - 1) % 4];
    for (const [ratio, amp, dec] of [[1, 1, 2.6], [2, 0.5, 1.6], [2.76, 0.35, 1.2], [5.4, 0.18, 0.6], [8.93, 0.08, 0.35]]) {
      const v = voice(0.075 * amp);
      osc('sine', base * ratio, t, dec + 0.1, v);
      env(v.gain, t, 0.003, 1, 0.01, dec);
    }
  },
  gear() {
    const t = now();
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.075;
      const n = voice(0.12);
      const bp = filter('bandpass', 2600, 5);
      bp.connect(n);
      noiseSrc(at, 0.03, bp);
      env(n.gain, at, 0.001, 1, 0.004, 0.025);
    }
    const c = voice(0.04);
    const o = osc('sawtooth', 70, t, 0.5, filter('lowpass', 400));
    o.disconnect();
    const lp = filter('lowpass', 380);
    o.connect(lp).connect(c);
    env(c.gain, t, 0.05, 1, 0.3, 0.12);
  },
  pusher() {
    const t = now();
    const n = voice(0.16);
    const bp = filter('bandpass', 1100, 1.4);
    bp.connect(n);
    noiseSrc(t, 0.35, bp);
    env(n.gain, t, 0.004, 1, 0.04, 0.26);
    setTimeout(() => SOUNDS.clunk({}), 90);
  },
  belt({ fast = false } = {}) {
    const t = now();
    const v = voice(fast ? 0.1 : 0.075);
    const lp = filter('lowpass', fast ? 420 : 300);
    const am = ctx.createGain();
    lp.connect(am).connect(v);
    noiseSrc(t, 0.85, lp, { buf: brown });
    const lfo = osc('square', fast ? 16 : 11, t, 0.85, ctx.createGain());
    lfo.disconnect();
    const depth = ctx.createGain();
    depth.gain.value = 0.35;
    am.gain.value = 0.65;
    lfo.connect(depth).connect(am.gain);
    env(v.gain, t, 0.08, 1, 0.55, 0.2);
  },
  fall() {
    const t = now();
    const v = voice(0.05);
    const o = osc('sine', 900, t, 0.9, v);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.85);
    env(v.gain, t, 0.02, 1, 0.5, 0.35);
  },
  drop() {
    const t = now();
    const v = voice(0.3);
    const o = osc('sine', 70, t, 0.4, v);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    env(v.gain, t, 0.004, 1, 0.03, 0.35);
    const n = voice(0.08);
    const lp = filter('lowpass', 600);
    lp.connect(n);
    noiseSrc(t, 0.3, lp);
    env(n.gain, t, 0.004, 1, 0.02, 0.25);
  },
  crash() {
    const t = now();
    for (const f of [312, 527, 811, 1233, 1745]) {
      const v = voice(0.045);
      osc('triangle', f * (0.98 + Math.random() * 0.04), t, 0.9, v);
      env(v.gain, t, 0.002, 1, 0.01, 0.4 + Math.random() * 0.5);
    }
    SOUNDS.drop();
    SOUNDS.spark({});
  },
  reboot() {
    const t = now();
    const v = voice(0.06);
    const o = osc('sine', 180, t, 0.7, v);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.55);
    env(v.gain, t, 0.05, 1, 0.4, 0.2);
    for (const [i, f] of [[0, 1320], [1, 1760]]) {
      const b = voice(0.05);
      osc('sine', f, t + 0.6 + i * 0.12, 0.1, b);
      env(b.gain, t + 0.6 + i * 0.12, 0.003, 1, 0.03, 0.06);
    }
  },
  charge() {
    const t = now();
    [660, 880, 1320].forEach((f, i) => {
      const v = voice(0.05);
      osc('sine', f, t + i * 0.07, 0.2, v);
      env(v.gain, t + i * 0.07, 0.004, 1, 0.03, 0.12);
    });
  },
  shield() {
    const t = now();
    for (const f of [1400, 1412, 2100]) {
      const v = voice(0.03);
      osc('sine', f, t, 0.6, v);
      env(v.gain, t, 0.02, 1, 0.2, 0.35);
    }
  },
  emp() {
    const t = now();
    const v = voice(0.3);
    const o = osc('sine', 90, t, 0.6, v);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    env(v.gain, t, 0.005, 1, 0.05, 0.45);
    SOUNDS.spark({});
  },
  lamp() {
    const t = now();
    const n = voice(0.22);
    const lp = filter('lowpass', 2200);
    lp.connect(n);
    noiseSrc(t, 0.06, lp);
    env(n.gain, t, 0.001, 1, 0.01, 0.05);
    const v = voice(0.12);
    const o = osc('sine', 140, t, 0.2, v);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    env(v.gain, t, 0.002, 1, 0.01, 0.15);
    const h = voice(0.015);
    osc('sawtooth', 100, t + 0.05, 0.6, h);
    env(h.gain, t + 0.05, 0.05, 1, 0.2, 0.3);
  },
  tick({ last = false } = {}) {
    const t = now();
    const v = voice(last ? 0.06 : 0.035);
    osc('sine', last ? 1500 : 1200, t, 0.06, v);
    env(v.gain, t, 0.001, 1, 0.005, 0.04);
  },
  lock() {
    const t = now();
    [880, 1318.5].forEach((f, i) => {
      const v = voice(0.035);
      osc('sine', f, t + i * 0.06, 0.25, v);
      env(v.gain, t + i * 0.06, 0.003, 1, 0.02, 0.2);
    });
  },
  join() {
    const t = now();
    SOUNDS.servo({ steps: 1.4 });
    const b = voice(0.05);
    osc('sine', 1046.5, t + 0.48, 0.12, b);
    env(b.gain, t + 0.48, 0.003, 1, 0.04, 0.08);
  },
  cue() {
    const t = now();
    for (const f of [110, 164.8, 220]) {
      const v = voice(0.03);
      const lp = filter('lowpass', 300);
      lp.connect(v);
      osc('sawtooth', f, t, 2.2, lp);
      lp.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
      lp.frequency.exponentialRampToValueAtTime(300, t + 2.1);
      env(v.gain, t, 0.5, 1, 0.6, 1.0);
    }
  },
  win() {
    const t = now();
    const chord = [220, 277.18, 329.63, 440, 554.37];
    for (const f of chord) {
      for (const det of [-4, 4]) {
        const v = voice(0.022);
        const lp = filter('lowpass', 300);
        lp.connect(v);
        const o = osc('sawtooth', f, t, 5.5, lp);
        o.detune.value = det;
        lp.frequency.exponentialRampToValueAtTime(2600, t + 2.2);
        lp.frequency.exponentialRampToValueAtTime(600, t + 5.2);
        env(v.gain, t, 1.2, 1, 2.2, 2);
      }
    }
    setTimeout(() => SOUNDS.bell({ n: 4 }), 300);
  },
};

/** Play a sound by name (does nothing until sound is on). */
export function play(name, opts) {
  if (!wants || !ctx || ctx.state !== 'running') return;
  try {
    SOUNDS[name]?.(opts);
  } catch (err) {
    console.warn('sound', name, err);
  }
}
