// Win, idea 3 (House lights), animator b: character acting.
// Maya lands on the last flag and leaps into a victory twirl. At the top of the twirl: CLUNK, the house lights come
// on (with a fluorescent stutter) and she's caught mid-air, facing us, like someone caught dancing when the party
// ends. Theo and Jun squint and cringe away from the glare; the glass is a cheap grey tabletop. Maya's eye darts
// left, right; she drops, sheepishly finishes her twirl... then decides she doesn't care: she stands tall and glows,
// the only light in the room. Theo and Jun side-eye her through their squints. Click: the dark is back, the glow
// floods into the glass, flag 2 stands in red, and the others blink like people walking out of a cinema.
export const meta = {
  title: 'House lights: caught dancing',
  idea: 'Maya leaps into a victory twirl and, at the very top, CLUNK: the house lights stutter on. She\'s caught mid-air facing us, the glass is a cheap grey tabletop, Theo and Jun squint and cringe from the glare. Her eye darts left, right; she drops, sheepishly finishes the twirl... then stands tall and glows anyway, the only light in the room, while the others side-eye her. Click: the dark comes back, the glow floods into the glass, and they blink like people leaving a cinema.',
  notes: 'Sound: the twirl\'s rising chime cut dead by a heavy relay CLUNK and a fluorescent "tik-tik-bzzzt" hum under the whole lit second (no music, no reverb: a flat room), a tiny squeak as she drops, a single warm swell as she glows, then a soft "click" and Lumen\'s room tone and glass shimmer flooding back. Port: everything the moment changes (background, lights, exposure, bloom, the glass top\'s map, colour and glow, the slab edges, every additive light on the board, the motes, the spill, the floor, the eyes) is saved first and restored on the click and in cleanup. The two flicker frames before the lights stay on are part of the joke; keep them short. With more players, every non-winner squints; the winner\'s halo is a sprite because the bloom is off while the lights are on.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** keys: [[t, value, ease?], ...] (the ease shapes the segment that ends at that key) */
function kf(keys, ease) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * (e ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
}
const wob = (t, t0, amp, hz, decay) => (t < t0 ? 0 : amp * Math.sin((t - t0) * hz * TAU) * Math.exp(-(t - t0) * decay));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const lookRot = (near, x0, y0, x1, y1) => near + wrap(Math.atan2(-(x1 - x0), -(y1 - y0)) - near);

/** A robot as an actor: lean, roll, squash and the eye are on its body, so its ring stays flat on the glass. */
function actor(lab, key) {
  const { THREE } = lab;
  const p = lab.puppet(key);
  const b = p.bot;
  const m = p.model;
  const eyes = [];
  m.group.traverse((o) => {
    if (o.isMesh && o.material === m.eyeMat) eyes.push({ o, s: o.scale.clone(), kind: o.geometry.type, rz: Math.abs(o.rotation.z) > 1 });
  });
  const base = new THREE.Color(b.color);
  const A = { p, b, m, x: b.x, y: b.y, rot: b.rot, lift: 0, lean: 0, roll: 0, sy: 1, sw: 1, eye: 1, open: 1, emiss: 0.16, ring: 1 };
  p.each = (model) => {
    model.body.rotation.set(-A.lean, 0, -A.roll);
    model.body.scale.set(A.sw, A.sy, A.sw);
    const o = Math.max(0.02, A.open);
    for (const e of eyes) {
      if (e.kind === 'CapsuleGeometry' && e.rz) e.o.scale.set(e.s.x * o, e.s.y * (0.7 + 0.3 * Math.min(1.4, A.open)), e.s.z * o);
      else if (e.kind === 'CylinderGeometry') e.o.scale.set(e.s.x * o, e.s.y, e.s.z * o);
      else if (e.kind === 'SphereGeometry') e.o.scale.setScalar(e.s.x * (0.3 + 0.7 * o));
      else e.o.scale.set(e.s.x, e.s.y * o, e.s.z);
    }
    const k = A.eye * (A.open < 0.15 ? A.open / 0.15 : 1);
    model.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
    model.paint.emissive.copy(base);
    model.paint.emissiveIntensity = A.emiss;
    model.ringMat.opacity *= A.ring;
    model.poolMat.opacity *= A.ring;
  };
  A.apply = () => p.set({ x: A.x, y: A.y, rot: A.rot, lift: A.lift });
  A.done = (d) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.set(0, 0, 0);
    for (const e of eyes) e.o.scale.copy(e.s);
    m.paint.emissive.copy(base);
    m.paint.emissiveIntensity = 0.16;
    p.release({ x: Math.round(A.x), y: Math.round(A.y), d });
  };
  return A;
}

/** The house lights: everything Lumen's dark room is made of, saved, switchable, and restored. */
function houseLights(lab) {
  const { THREE } = lab;
  const arena = lab.arena;
  const scene = arena.scene;
  const save = {
    bg: scene.background,
    env: scene.environmentIntensity,
    hemiI: arena.hemi.intensity,
    hemiC: arena.hemi.color.clone(),
    hemiG: arena.hemi.groundColor.clone(),
    keyI: arena.key.intensity,
    keyC: arena.key.color.clone(),
    bloom: arena.bloom.strength,
    expo: lab.renderer.toneMappingExposure,
    motes: arena.motes.material.opacity,
    spill: arena.spill.material.opacity,
  };
  const top = arena.topMat;
  const topSave = { map: top.map, color: top.color.clone(), rough: top.roughness, env: top.envMapIntensity };
  let floor = null;
  scene.traverse((o) => {
    if (o.isMesh && o.geometry?.parameters?.width === 400) floor = o;
  });
  const floorC = floor?.material.color.clone();
  // the slab's glowing edges, and every additive light drawn on the board (columns, halos, numbers...)
  const edges = [];
  const glows = [];
  arena.board.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (Array.isArray(o.material) && m.emissive && !edges.some((e) => e.m === m)) edges.push({ m, c: m.color.clone(), e: m.emissiveIntensity });
      else if (m.blending === THREE.AdditiveBlending && !glows.some((g) => g.m === m)) glows.push({ m, o: m.opacity, tr: m.transparent });
    }
  });
  const amb = new THREE.AmbientLight(0xffffff, 0);
  scene.add(amb);
  let on = false;
  const L = {
    gain: 1, // the board's own light (0 = washed out)
    bloomGain: 1,
    /** flip the house lights (instant, like a switch) */
    set(v) {
      if (v === on) return;
      on = v;
      scene.background = on ? new THREE.Color(0x8b8e93) : save.bg;
      scene.environmentIntensity = on ? 1.2 : save.env;
      arena.hemi.intensity = on ? 1.25 : save.hemiI;
      arena.hemi.color.set(on ? 0xf6f8ff : save.hemiC);
      arena.hemi.groundColor.set(on ? 0xa5a7ab : save.hemiG);
      arena.key.intensity = on ? 1.5 : save.keyI;
      arena.key.color.set(on ? 0xf2f6ff : save.keyC);
      amb.intensity = on ? 0.35 : 0;
      lab.renderer.toneMappingExposure = on ? 1.0 : save.expo;
      if (floor) floor.material.color.set(on ? 0x8f9196 : floorC);
      // the smoked glass becomes a plain, cheap-looking tabletop
      top.map = on ? null : topSave.map;
      top.color.set(on ? 0x8f8c86 : topSave.color);
      top.roughness = on ? 0.62 : topSave.rough;
      top.envMapIntensity = on ? 0.35 : topSave.env;
      top.needsUpdate = true;
      for (const e of edges) e.m.color.set(on ? 0x9d9fa3 : e.c);
    },
    get on() {
      return on;
    },
    /** every frame, after the arena has set its own values */
    apply() {
      const g = on ? 0 : L.gain;
      top.emissiveIntensity *= g;
      for (const e of edges) e.m.emissiveIntensity = e.e * Math.min(1.3, g);
      for (const x of glows) {
        x.m.transparent = x.tr || g < 1;
        x.m.opacity = x.o * clamp01(g);
      }
      arena.motes.material.opacity = save.motes * clamp01(g);
      arena.spill.material.opacity = save.spill * clamp01(g);
      arena.bloom.strength = on ? 0 : save.bloom * L.bloomGain;
    },
    restore() {
      L.set(false);
      for (const e of edges) e.m.emissiveIntensity = e.e;
      for (const x of glows) {
        x.m.opacity = x.o;
        x.m.transparent = x.tr;
      }
      arena.motes.material.opacity = save.motes;
      arena.spill.material.opacity = save.spill;
      arena.bloom.strength = save.bloom;
      scene.remove(amb);
    },
  };
  return L;
}

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const RED = maya.b.color;
  const lights = houseLights(lab);
  lab.cleanup(() => lights.restore());

  // ----- the clock -----
  const TOUCH = 0.8; // on flag 2
  const UP = 0.96; // she springs into her twirl
  const CLUNK = 1.16; // the top of the twirl: house lights
  const DROP = 1.68; // gravity remembers her
  const LANDED = 1.8;
  const PROUD = 2.12; // she decides she doesn't care
  const CLICK = 2.56; // the dark comes back
  const END = 3.3;
  const lightsOn = (t) => t >= CLICK || t < CLUNK ? false : !((t >= 1.2 && t < 1.245) || (t >= 1.28 && t < 1.31));

  // ----- Maya -----
  const mX = kf([[0, 2], [0.12, 1.95, ease.out], [TOUCH, 4, ease.inOut]], ease);
  const mLift = kf([[UP, 0], [CLUNK, 0.46, ease.out], [DROP, 0.46], [LANDED, 0, ease.in]], ease);
  // the twirl turns left: east → north → west → south (facing us) at the top, and finishes after the drop
  const mTwirl = kf([[UP, 0], [CLUNK, 1.5 * Math.PI, ease.out], [LANDED + 0.06, 1.5 * Math.PI], [PROUD - 0.04, 2 * Math.PI, ease.inOut]], ease);
  const mDart = kf([[1.34, 0], [1.39, 0.42, ease.out], [1.47, 0.42], [1.53, -0.42, ease.inOut], [1.61, -0.42], [1.66, 0, ease.inOut]], ease);
  const mLean = kf([[0, 0], [0.12, -0.13], [0.34, 0.18, ease.out], [0.7, 0.05], [TOUCH, -0.1, ease.out],
    [UP - 0.05, 0.14], [UP + 0.08, -0.3, ease.out], [CLUNK, -0.24], [LANDED, 0.05], [LANDED + 0.1, 0.16], [PROUD, 0.12], [PROUD + 0.16, -0.18, ease.outBack], [CLICK, -0.16], [END - 0.25, 0]], ease);
  const mSy = kf([[0, 1], [0.12, 0.92], [0.3, 1.04], [TOUCH, 1], [TOUCH + 0.04, 0.9], [UP, 0.76, ease.out], [UP + 0.07, 1.2, ease.out], [CLUNK, 1.14], [DROP, 1.12], [LANDED, 1.06, ease.in], [LANDED + 0.05, 0.78, ease.out], [LANDED + 0.16, 0.93], [PROUD, 0.92], [PROUD + 0.16, 1.13, ease.outBack], [CLICK, 1.1], [END - 0.2, 1]], ease);
  const mOpen = kf([[CLUNK - 0.02, 1], [CLUNK + 0.04, 1.7, ease.out], [1.66, 1.6], [LANDED, 1.2], [LANDED + 0.1, 0.55], [PROUD, 0.6], [PROUD + 0.12, 1.15, ease.out], [END, 1]], ease);
  const mGlow = kf([[PROUD, 0], [PROUD + 0.22, 1, ease.out], [CLICK, 1], [CLICK + 0.15, 0.6], [END, 0]], ease);

  // ----- Theo and Jun: the glare -----
  const squint = kf([[CLUNK, 0], [CLUNK + 0.05, 1, ease.out], [CLICK, 1], [CLICK + 0.06, 0, ease.out]], ease);
  const cringe = kf([[CLUNK, 0], [CLUNK + 0.08, 1, ease.out], [PROUD + 0.05, 0.75], [CLICK, 0.7], [CLICK + 0.25, 0, ease.out]], ease);
  const sideEye = kf([[PROUD + 0.08, 0], [PROUD + 0.3, 1, ease.inOut], [CLICK + 0.05, 1], [END - 0.12, 0, ease.inOut]], ease);
  const blinkOut = (t, d) => {
    // walking out of a cinema: two quick blinks after the click
    const s = t - CLICK - d;
    if (s < 0.06 || s > 0.42) return 1;
    const b = (u) => (u < 0 || u > 0.12 ? 1 : Math.abs(1 - u / 0.06));
    return Math.min(b(s - 0.06), b(s - 0.26));
  };
  const theoAway = facing(3) + 0.55; // turns from the glare
  const junAway = facing(2) - 0.5;
  const theoToMaya = lookRot(facing(3), 5, 3, 4, 1);
  const junToMaya = lookRot(facing(2), 1, 0, 4, 1);

  // Maya's own halo: the bloom is off while the lights are on, so the one thing still shining needs its own glow
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE), color: new THREE.Color(RED).multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.7);
  lab.add(halo);

  // ----- run -----
  const T0 = lab.t;
  lab.playCard('a', ['m2']);
  const col = arena.columns.find((c) => c.n === 2);
  const fired = new Set();
  const once = (key, cond, fn) => {
    if (cond && !fired.has(key)) {
      fired.add(key);
      fn();
    }
  };

  const stop = lab.every(() => {
    const t = lab.t - T0;
    // ----- the room -----
    lights.set(lightsOn(t));
    lights.gain = t < CLICK ? 1 : clamp01(ease.out((t - CLICK) / 0.5));
    lights.bloomGain = t < CLICK ? 1 : 1 + 0.9 * Math.sin(clamp01((t - CLICK) / 0.7) * Math.PI) * (t < CLICK + 0.7 ? 1 : 0);
    lights.apply();

    // ----- Maya -----
    maya.x = mX(t);
    maya.lift = mLift(t);
    maya.rot = facing(1) + mTwirl(t) + mDart(t);
    maya.lean = mLean(t);
    maya.sy = mSy(t) + wob(t, LANDED + 0.16, 0.04, 4, 9) + wob(t, CLICK, 0.035, 3.5, 7);
    maya.sw = 1 / Math.sqrt(maya.sy);
    maya.open = mOpen(t);
    const glow = mGlow(t);
    maya.eye = 1 + 1.7 * glow + (lights.on ? 0.4 : 0);
    maya.emiss = 0.16 + (lights.on ? 0.55 : 0) + 0.85 * glow;
    halo.material.opacity = (lights.on ? 0.55 + 0.45 * glow : 0.15 * glow) * (0.95 + 0.05 * Math.sin(t * 9));
    const at = lab.pos(maya.x, maya.y);
    halo.position.set(at.x, maya.lift + 0.28, at.z);

    // ----- Theo -----
    const sq = squint(t);
    const cr = cringe(t);
    const se = sideEye(t);
    const shiver = (t > CLUNK && t < CLUNK + 0.3 ? Math.sin((t - CLUNK) * 16 * TAU) * 0.06 * (1 - (t - CLUNK) / 0.3) : 0);
    theo.rot = facing(3) + cr * (1 - se) * wrap(theoAway - facing(3)) + se * 0.75 * wrap(theoToMaya - facing(3)) + shiver;
    theo.lean = -0.26 * cr + 0.04 * se;
    theo.roll = 0.1 * cr * (1 - se);
    theo.sy = 1 - 0.16 * cr + wob(t, CLICK + 0.1, 0.05, 3, 7);
    theo.sw = 1 + 0.08 * cr;
    theo.open = Math.min(1 - 0.9 * sq + 0.15 * (t > CLICK ? 1 - clamp01((t - CLICK - 0.4) / 0.3) : 0), blinkOut(t, 0));
    theo.emiss = lights.on ? 0.02 : 0.16;
    theo.ring = lights.on ? 0.18 : 1;
    // ----- Jun -----
    jun.rot = facing(2) + cr * (1 - se) * wrap(junAway - facing(2)) + se * 0.8 * wrap(junToMaya - facing(2)) - shiver;
    jun.lean = -0.2 * cr + 0.03 * se;
    jun.roll = -0.08 * cr * (1 - se);
    jun.sy = 1 - 0.2 * cr + wob(t, CLICK + 0.14, 0.05, 3, 7);
    jun.sw = 1 + 0.1 * cr;
    jun.open = Math.min(1 - 0.92 * sq, blinkOut(t, 0.07));
    jun.emiss = lights.on ? 0.02 : 0.16;
    jun.ring = lights.on ? 0.18 : 1;
    for (const A of [maya, theo, jun]) A.apply();

    // ----- events -----
    once('touch', t >= TOUCH, () => {
      col.flash = arena.time;
      col.flashColor = new THREE.Color(RED);
      arena.clearCards();
    });
    once('clunk', t >= CLUNK, () => lab.shake(0.035, 0.22));
    once('click', t >= CLICK, () => {
      // the glow floods back, and flag 2 stands in her colour
      col.flash = arena.time;
      col.flashColor = new THREE.Color(RED);
      lab.ring(lab.pos(4, 1), RED, 1.3, 0.02, 0.8);
    });
  });

  await lab.wait(END);
  stop();
  lights.restore();
  maya.done(1);
  theo.done(3);
  jun.done(2);
}
