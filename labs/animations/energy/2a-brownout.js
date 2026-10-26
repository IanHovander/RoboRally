// Energy, idea 46 "Brownout", animator a (weight & physical comedy).
export const meta = {
  title: 'Brownout',
  idea:
    'Maya parks on the battery, plants her weight and pulls. The instant the charge lands every light in the picture except her sags, as if the light had weight: the glass, the room, the HUD and Ezra, who wilts like a houseplant on the same circuit. Down, half back, down, while the amber pours into her eye; then the power slams back with an overshoot, Ezra jolts upright a beat late, eye stuttering, and wobbles. The opposite of a flash: she drew so much that the TV itself sagged.',
  notes:
    'Sound: a low electrical sag (a hum pitched down) on each dip, a glass tick as the lights catch, then a bright "thunk" of the power coming back with a tiny ring. When several robots charge on the same register the dip goes deeper (DEPTH grows with each one); everyone who charges stays lit. Port: arena.topMat, the slab edges, spill, motes and background intensity are scaled for a moment and restored; the HUD gets the same factor (the lab draws a stand-in strip). Ezra\'s light follows the world a couple of frames late.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const CHARGERS = 1; // robots charging on this register: the dip deepens with each one

/** Lean the body over the edge it leans toward, so it rocks on the glass rather than spinning in the air. */
function tilt(model, pitch, roll = 0) {
  const b = model.body;
  b.rotation.set(-pitch, 0, -roll);
  const pz = pitch >= 0 ? -0.34 : 0.37;
  const px = roll >= 0 ? 0.33 : -0.33;
  const py = 0.02;
  const y1 = py * Math.cos(pitch) + pz * Math.sin(pitch);
  const z1 = -py * Math.sin(pitch) + pz * Math.cos(pitch);
  const x2 = px * Math.cos(roll) + y1 * Math.sin(roll);
  const y2 = -px * Math.sin(roll) + y1 * Math.cos(roll);
  b.position.x += px - x2;
  b.position.y += py - y2;
  b.position.z += pz - z1;
}

/** Piecewise-linear keyframes [[t, v], ...] with smooth steps between. */
function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t1, v1] = list[i];
    const [t0, v0] = list[i - 1];
    if (t < t1) return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
  }
  return list[list.length - 1][1];
}

/** A stand-in for the game's HUD strip, so the brownout can reach it too. */
function hud(lab) {
  const H = lab.overlay.clientHeight || 540;
  const fs = Math.round(H * 0.034);
  const bar = document.createElement('div');
  bar.style.cssText = `position:absolute;left:50%;bottom:${Math.round(H * 0.035)}px;transform:translateX(-50%);display:flex;gap:${fs}px;font:200 ${fs}px Lumen,system-ui,sans-serif;letter-spacing:.14em;color:#e9edf3`;
  const bolt = (c) => `<svg viewBox="0 0 40 40" width="${fs}" height="${fs}" style="vertical-align:-.15em"><path d="M22.5 6 12.5 22h7l-2 12 10-16.5h-7z" fill="${c}"/></svg>`;
  const chip = (name, color, n) => {
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:${Math.round(fs * 0.5)}px;padding:${Math.round(fs * 0.35)}px ${Math.round(fs * 0.8)}px;border-radius:${fs}px;background:rgba(14,18,24,.72);border:1px solid rgba(233,237,243,.16);box-shadow:0 0 ${fs}px rgba(0,0,0,.4)`;
    el.innerHTML = `<span style="width:${Math.round(fs * 0.55)}px;height:${Math.round(fs * 0.55)}px;border-radius:50%;background:${color};box-shadow:0 0 ${Math.round(fs * 0.5)}px ${color}"></span><span>${name}</span>${bolt('#ffc56e')}<b style="font-weight:300;color:#ffc56e;display:inline-block;min-width:1ch">${n}</b>`;
    bar.append(el);
    return { el, num: el.querySelector('b') };
  };
  const maya = chip('MAYA', '#ff4d6d', 3);
  const ezra = chip('EZRA', '#cc5de8', 5);
  lab.overlay.append(bar);
  return { bar, maya, ezra };
}

export default async function play(lab) {
  const { THREE, PALETTE, arena } = lab;
  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const amber = new THREE.Color(PALETTE.energy);
  const home = lab.pos(3, 1);
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });

  // ---- everything that will sag, with its normal strength ----
  const top = arena.topMat;
  const topBase = { color: top.color.clone(), env: top.envMapIntensity };
  const lit = [];
  arena.board.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (m === top || m === arena.batteryMat || lit.some((l) => l.m === m)) continue;
      if (m.isMeshStandardMaterial) lit.push({ m, ei: m.emissiveIntensity, c: m.color.clone() });
      else if (m.isMeshBasicMaterial) lit.push({ m, c: m.color.clone() });
    }
  });
  const spillBase = arena.spill.material.color.clone();
  const motesBase = arena.motes.material.opacity;
  const bgBase = arena.scene.backgroundIntensity ?? 1;
  const ezraPaint = ezra.model.paint;
  const ezraBase = { c: ezraPaint.color.clone() };
  const ezraTag = lab.bot('b').tag;
  const card = () => lab.bot('a').card;
  // the TV itself: the picture sags a hair with the power, like an old set on a weak supply
  const screens = [lab.renderer.domElement, lab.overlay];
  const restore = () => {
    card()?.material.color.setScalar(1);
    for (const el of screens) {
      el.style.transform = '';
      el.style.transformOrigin = '';
    }
    top.color.copy(topBase.color);
    top.envMapIntensity = topBase.env;
    for (const l of lit) {
      l.m.color.copy(l.c);
      if (l.ei != null) l.m.emissiveIntensity = l.ei;
    }
    arena.spill.material.color.copy(spillBase);
    arena.motes.material.opacity = motesBase;
    arena.scene.backgroundIntensity = bgBase;
    ezraPaint.color.copy(ezraBase.c);
  };
  lab.cleanup(restore);
  const H = hud(lab);

  // ---- the timeline (scene seconds from the start of the move) ----
  const MOVE = 0.6;
  const PLANT = MOVE + 0.12; // she plants her weight on the contact
  const TC = PLANT + 0.07; // the charge lands: the brownout
  const BACK = TC + 0.44; // the power comes back
  const END = BACK + 0.56;
  const depth = Math.min(0.85, 0.66 + 0.1 * (CHARGERS - 1)); // how far the world sags

  // the world's light: sag, half back, sag, held while she drinks, then back with a springy overshoot
  const LOW = 1 - depth;
  const sag = [
    [0, 1],
    [0.035, LOW + 0.04],
    [0.1, LOW],
    [0.13, LOW + depth * 0.55],
    [0.18, LOW + depth * 0.5],
    [0.21, LOW - 0.03],
    [0.44, LOW - 0.06],
  ];
  const world = (T) => {
    const r = T - TC;
    if (r < 0) return 1;
    if (r < BACK - TC) return keys(sag, r);
    const q = r - (BACK - TC);
    const from = LOW - 0.06;
    return 1 - (1 - from) * Math.exp(-q * 9.5) * Math.cos(q * 18);
  };
  // Ezra is on the same circuit, a couple of frames behind, and his eye catches with a stutter
  const LAG = 0.06;
  const ezraLight = (T) => {
    const f = world(T - LAG);
    const q = T - LAG - BACK;
    if (q >= 0 && q < 0.13) return [0.1, 0.1, 1.1, 0.15, 0.15, 1.15, 0.5, 1.1][Math.floor(q / (1 / 30))] ?? f;
    return f;
  };

  // Maya: her lean is a spring pushed by her acceleration; Ezra's wilt is a spring pulled by his light
  let pitch = 0;
  let pv = 0;
  let kick = false;
  const ez = { roll: 0, rv: 0, pitch: 0, pv: 0, sy: 1, sv: 0, jolt: false };
  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const T = lab.t - t0;
    const k = clamp01(T / MOVE);
    const x = 1 + 2 * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const accel = T < MOVE ? (k < 0.5 ? 1 : -1) * 22 : 0;
    const plant = smooth(seg(T, PLANT, PLANT + 0.06)) * (1 - smooth(seg(T, BACK, BACK + 0.05)));
    // pulling: she leans back a hair, like someone hauling on a rope
    const want = -0.1 * plant;
    if (T >= BACK && !kick) {
      kick = true;
      pv += 2.6; // the power slams in and rocks her forward
    }
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      const a = 260 * (want - pitch) - 13 * pv + accel * 0.11;
      pv += a * h;
      pitch += pv * h;
    }
    // squash: planted low while she draws, a pop when it lands, a wobble that dies away
    let sy = 1 - 0.1 * plant;
    if (T >= BACK) {
      const q = T - BACK;
      sy = 1 + 0.12 * Math.exp(-q * 8) * Math.sin(q * 26);
    }
    const strain = T > TC && T < BACK ? 0.006 * Math.sin(T * 260) * seg(T, TC, TC + 0.1) : 0;
    const sxz = 1 / Math.sqrt(sy);
    maya.set({ x: x + strain, y: 1, rot: lab.facing(1), sx: sxz, sz: sxz, sy });

    // the amber flows into her eye through the dip, and cools after
    const warm = smooth(seg(T, TC + 0.02, TC + 0.3)) * (1 - smooth(seg(T, BACK + 0.12, END - 0.05)));
    const flare = T >= BACK ? 1 + 0.9 * Math.exp(-(T - BACK) * 12) : 1;
    maya.each = (m) => {
      tilt(m, pitch, 0);
      m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(amber.clone().multiplyScalar(3.6), warm).multiplyScalar(flare);
      // she alone keeps her strength: her pool even reads a little stronger against the dark
      const dark = 1 - world(T);
      m.poolMat.opacity = 0.75 + 0.2 * dark;
      m.ringMat.opacity = 0.9;
      m.paint.emissiveIntensity = 0.16 + 0.12 * dark;
    };

    // ---- the world sags ----
    const f = world(T);
    top.emissiveIntensity = f;
    top.color.copy(topBase.color).multiplyScalar(Math.max(0.2, f));
    top.envMapIntensity = topBase.env * f;
    for (const l of lit) {
      if (l.ei != null) l.m.emissiveIntensity = l.ei * f;
      else l.m.color.copy(l.c).multiplyScalar(f);
    }
    arena.spill.material.color.copy(spillBase).multiplyScalar(f);
    arena.motes.material.opacity = motesBase * f;
    arena.scene.backgroundIntensity = bgBase * (0.35 + 0.65 * f);
    card()?.material.color.setScalar(Math.max(0.25, Math.min(1, f)));
    const sagK = (1 - f) / depth; // 1 at the bottom of the dip, a little negative on the overshoot
    for (const el of screens) {
      el.style.transformOrigin = '50% 100%';
      el.style.transform = `translateY(${(0.9 * sagK).toFixed(3)}%) scale(${(1 - 0.008 * sagK).toFixed(4)}, ${(1 - 0.014 * sagK).toFixed(4)})`;
    }
    // the battery: a gulp of light at the plug-in, then it sags with everything else
    const gulp = T >= PLANT && T < TC + 0.08 ? Math.sin(seg(T, PLANT, TC + 0.08) * Math.PI) : 0;
    arena.batteryMat.color.multiplyScalar(Math.min(1.4, f) + 6 * gulp);
    arena.batteries[0].scale.setScalar(1 + 0.6 * gulp);

    // the HUD on the same mains: Maya's chip keeps its light
    H.ezra.el.style.filter = `brightness(${Math.max(0.15, ezraLight(T)).toFixed(3)})`;
    if (T >= TC + 0.24 && H.maya.num.textContent === '3') H.maya.num.textContent = '4';
    const tick = T >= TC + 0.24 ? Math.exp(-(T - TC - 0.24) * 10) : 0;
    H.maya.num.style.transform = `translateY(${(-0.35 * tick).toFixed(3)}em) scale(${(1 + 0.4 * tick).toFixed(3)})`;

    // ---- Ezra wilts with his light, and jolts upright when it comes back ----
    const fe = ezraLight(T);
    const droop = clamp01((1 - world(T - LAG)) / depth);
    const tr = -0.42 * droop;
    const tp = 0.1 * droop;
    const ts = 1 - 0.12 * droop;
    const q = T - LAG - BACK;
    if (q >= 0 && !ez.jolt) {
      ez.jolt = true;
      ez.sv += 3.2; // startled: a stretch upward
      ez.rv += 2.2;
    }
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      ez.rv += (160 * (tr - ez.roll) - 6.5 * ez.rv) * h;
      ez.roll += ez.rv * h;
      ez.pv += (160 * (tp - ez.pitch) - 7 * ez.pv) * h;
      ez.pitch += ez.pv * h;
      ez.sv += (300 * (ts - ez.sy) - 11 * ez.sv) * h;
      ez.sy += ez.sv * h;
    }
    const hop = q > 0 && q < 0.16 ? 0.05 * Math.sin((q / 0.16) * Math.PI) : 0;
    const es = 1 / Math.sqrt(ez.sy);
    ezra.set({ x: 5, y: 3, rot: lab.facing(0), sy: ez.sy, sx: es, sz: es, lift: hop });
    ezra.each = (m) => {
      tilt(m, ez.pitch, ez.roll);
      const eye = Math.max(0.04, fe) ** 2.4; // a light at half power looks far dimmer than half
      m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
      m.ringMat.opacity = 0.9 * Math.min(1, fe);
      m.poolMat.opacity = 0.75 * Math.min(1, fe);
      m.paint.emissiveIntensity = 0.16 * fe;
      ezraPaint.color.copy(ezraBase.c).multiplyScalar(0.45 + 0.55 * Math.min(1.1, fe));
      if (ezraTag) ezraTag.material.opacity = Math.min(1, Math.max(0.15, fe));
    };
  });

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  ezra.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
  void home;
}
