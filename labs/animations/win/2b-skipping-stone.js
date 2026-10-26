// Win, idea 2 (Skipping stone), animator b: character acting.
// Maya touches the last flag so happy she can't stop. She sees the edge, brakes, skids off it anyway, hangs in the
// air like a cartoon coyote, looks down, looks at us... and instead of falling she skips across the dark like the
// pebble she is: plink, plink, plink, plink, a loop round the end of the slab and a leap back onto the glass right
// over Theo's head. She spins down on flag 2 like a stone coming to rest, plinks, and winks at Theo, who is outraged.
export const meta = {
  title: 'Skipping stone: the coyote who didn\'t fall',
  idea: 'Maya is so happy on the last flag she can\'t stop: she brakes, skids off the edge anyway and hangs over the void like a cartoon coyote, looks down, looks at us... then skips across the dark like the pebble she is, a ripple of light at every touch, loops round the slab, leaps back on over Theo\'s head (he ducks), spins down on flag 2 like a stone settling, and winks at Theo, who hops with outrage. Jun can\'t watch, then can\'t look away.',
  notes: 'Sound: her drive and a rising "wheee" glass whistle, a squeak of brakes (a glass rub), a silent hang (cut every sound for the beat she looks at us), then four plinks rising in pitch, a whoosh past Theo, the spin-down as a coin\'s quickening rattle, one clean plink at rest, and Theo\'s two indignant little thuds. Port: the moves are the rules (she ends on flag 2 facing east), the lap is pure show after the win, so it can run while the result screen comes up. Each form gets its own lap: Pebble skips flat (this one), an Orb rolls a lap of the rim, a Spire spins round it like a top, a Capsule bobs like a float, a Cube tumbles end over end on the water, a Prism skims on one edge. The bystanders key off where they stand: whoever she passes closest ducks; whoever has fallen off an edge this game is the one who can\'t watch.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
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
/** the rotation that looks from (x0,y0) toward (x1,y1), as close as possible to `near` */
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
  const A = { p, b, m, x: b.x, y: b.y, rot: b.rot, lift: 0, lean: 0, roll: 0, sy: 1, sw: 1, eye: 1, open: 1, glow: 0, trail: true };
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
    model.paint.emissiveIntensity = 0.16 + A.glow;
  };
  A.apply = () => p.set({ x: A.x, y: A.y, rot: A.rot, lift: A.lift, trail: A.trail });
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

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const RED = maya.b.color;
  const WATER = -0.1; // the still water: the dark, just under the glass
  const T0 = lab.t;

  // ---------------- Maya's course (scene seconds from the start of the moment) ----------------
  const TOUCH = 0.82; // her nose is on flag 2, at full speed
  const V0 = 4.5; // spaces/s as she crosses the flag
  const DEC = 2.4; // her brakes (not enough)
  const sEdge = (V0 - Math.sqrt(V0 * V0 - 2 * DEC * 2.5)) / DEC;
  const EDGE = TOUCH + sEdge; // over the edge
  const vEdge = V0 - DEC * sEdge;
  const COAST = 0.3;
  const xHang = 6.5 + (vEdge * COAST) / 2;
  const HANG = EDGE + COAST; // stops dead in mid-air
  const DROP = HANG + 0.56; // looks down, looks at us, gulps, drops
  const C0 = DROP + 0.1; // first touch on the water
  // the skips: touch points on the water, then a leap back up onto the glass and a slide onto the flag
  // (round the south-east corner, in front of the slab, and a last leap right over Theo's head)
  const way = [[xHang, 1], [7.75, 1.5], [8.1, 2.55], [7.65, 3.6], [6.55, 4.15], [4.35, 2.2], [4, 1]];
  const hopDur = [0.3, 0.27, 0.25, 0.23, 0.46];
  const hopH = [0.28, 0.24, 0.2, 0.16, 0.55];
  const touches = [C0];
  for (const d of hopDur) touches.push(touches[touches.length - 1] + d);
  const LAND = touches[touches.length - 1];
  const SLIDE = 0.42;
  const ON = LAND + SLIDE; // back on flag 2
  const REST = ON + 0.78; // spun down: plink
  const END = REST + 0.68;
  const curve = new THREE.CatmullRomCurve3(way.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const nSeg = way.length - 1;

  // her spin: integrate an angular speed that is fast on the water, slows on the glass and dies at rest; then
  // scale it so she stops exactly facing east after a whole number of turns
  const omega = (t) => {
    if (t < C0) return 0;
    if (t < LAND) return 17 - 5 * ((t - C0) / (LAND - C0));
    if (t < ON) return 12 - 3 * ((t - LAND) / SLIDE);
    if (t < REST) return 9 * (1 - (t - ON) / (REST - ON)) ** 1.4;
    return 0;
  };
  const STEP = 1 / 600;
  const spinTab = [0];
  for (let t = C0; t < REST; t += STEP) spinTab.push(spinTab[spinTab.length - 1] + omega(t) * STEP);
  const raw = spinTab[spinTab.length - 1];
  const turns = Math.max(1, Math.round(raw / TAU));
  const spinK = (turns * TAU) / raw;
  const spin = (t) => {
    if (t <= C0) return 0;
    const f = (t - C0) / STEP;
    const i = Math.min(spinTab.length - 2, Math.floor(f));
    const v = spinTab[i] + (spinTab[i + 1] - spinTab[i]) * (f - i);
    return t >= REST ? turns * TAU : v * spinK;
  };

  /** where she is: { x, y, lift, phase, hop } */
  function course(t) {
    if (t < 0.12) return { x: 2 - 0.05 * ease.out(t / 0.12), y: 1, lift: 0, phase: 'wind' };
    if (t < TOUCH) return { x: 1.95 + 2.05 * ((t - 0.12) / (TOUCH - 0.12)) ** 1.54, y: 1, lift: 0, phase: 'drive' };
    if (t < EDGE) {
      const s = t - TOUCH;
      return { x: 4 + V0 * s - 0.5 * DEC * s * s, y: 1, lift: 0, phase: 'skid' };
    }
    if (t < HANG) {
      const s = t - EDGE;
      return { x: 6.5 + vEdge * s - (vEdge / (2 * COAST)) * s * s, y: 1, lift: 0, phase: 'coast' };
    }
    if (t < DROP) return { x: xHang, y: 1, lift: 0, phase: 'hang' };
    if (t < C0) return { x: xHang, y: 1, lift: WATER * ease.in((t - DROP) / (C0 - DROP)), phase: 'drop' };
    for (let i = 0; i < hopDur.length; i++) {
      if (t < touches[i + 1]) {
        const k = (t - touches[i]) / hopDur[i];
        const v = curve.getPoint((i + k) / nSeg);
        const last = i === hopDur.length - 1;
        const base = last ? WATER + (0 - WATER) * k : WATER;
        return { x: v.x, y: v.y, lift: base + 4 * hopH[i] * k * (1 - k), phase: 'hop', hop: i, k };
      }
    }
    if (t < ON) {
      const k = (t - LAND) / SLIDE;
      const v = curve.getPoint((nSeg - 1 + ease.out(k)) / nSeg);
      return { x: v.x, y: v.y, lift: 0, phase: 'slide', k };
    }
    return { x: 4, y: 1, lift: 0, phase: 'rest' };
  }

  // ---------------- Maya's acting ----------------
  const mLean = kf([[0, 0], [0.12, -0.14], [0.3, 0.2, ease.out], [TOUCH - 0.05, 0.1], [TOUCH + 0.1, -0.16, ease.out], [TOUCH + 0.2, -0.12],
    // she sees the edge: brakes hard, nose up
    [TOUCH + 0.3, -0.38, ease.out], [EDGE, -0.34], [HANG, -0.1, ease.out],
    // the hang: look down... look at us... drop
    [HANG + 0.12, 0.58, ease.out], [HANG + 0.26, 0.55], [HANG + 0.34, -0.06, ease.out], [DROP, -0.04], [C0, 0.05]], ease);
  const mOpen = kf([[TOUCH + 0.18, 1], [TOUCH + 0.26, 1.55, ease.out], [EDGE, 1.45], [HANG + 0.12, 1.65], [HANG + 0.3, 1.2], [HANG + 0.38, 1.75, ease.out], [DROP, 1.7], [C0 + 0.12, 1.15], [ON, 1.1], [REST, 1]], ease);
  const mGlance = kf([[HANG + 0.27, 0], [HANG + 0.36, 1, ease.out], [DROP - 0.02, 1], [DROP + 0.08, 0, ease.in]], ease); // a look at us (south)
  const mGulp = kf([[HANG + 0.4, 0], [HANG + 0.44, -0.12, ease.out], [HANG + 0.5, 0.05], [DROP, 0]], ease);
  const mEye = kf([[0, 1], [C0, 1], [C0 + 0.06, 2.4, ease.out], [LAND, 1.7], [REST, 1.3], [REST + 0.04, 2.6, ease.out], [REST + 0.4, 1.3], [END, 1]], ease);
  // after the plink: smug nose-up, a glance at Theo and a wink
  const toTheo = lookRot(0, 4, 1, 5, 3) - facing(1);
  const mSmug = kf([[REST, 0], [REST + 0.12, 1, ease.outBack], [END - 0.18, 1], [END, 0]], ease);
  const mLook = kf([[REST + 0.06, 0], [REST + 0.2, 0.62 * wrap(toTheo), ease.out], [REST + 0.5, 0.62 * wrap(toTheo)], [END - 0.04, 0, ease.inOut]], ease);
  const mWink = (t) => {
    const s = t - (REST + 0.26);
    if (s < 0 || s > 0.2) return 1;
    return s < 0.05 ? 1 - s / 0.05 : s < 0.11 ? 0.04 : (s - 0.11) / 0.09;
  };

  // squash on every touch of the water, stretch in the air
  const contactSquash = (t) => {
    let v = 0;
    for (let i = 0; i < touches.length - 1; i++) {
      const s = t - touches[i];
      if (s >= 0 && s < 0.25) v += (s < 0.04 ? s / 0.04 : Math.exp(-(s - 0.04) * 22)) * (0.36 - 0.04 * i);
    }
    const sL = t - LAND;
    if (sL >= 0 && sL < 0.3) v += (sL < 0.04 ? sL / 0.04 : Math.exp(-(sL - 0.04) * 16)) * 0.3;
    return v;
  };

  // ---------------- the bystanders ----------------
  // Theo: watches her go, winces, follows the skips, ducks as she leaps over him, then hops with outrage
  const tWatch = kf([[TOUCH - 0.05, 0], [TOUCH + 0.25, 1, ease.out], [REST + 0.15, 1], [REST + 0.35, 0.35], [END - 0.1, 0]], ease);
  const tWince = kf([[HANG + 0.08, 0], [HANG + 0.18, 1, ease.out], [C0, 1], [C0 + 0.1, 0, ease.out]], ease);
  const tDuck = kf([[LAND - 0.3, 0], [LAND - 0.21, 1, ease.out], [LAND - 0.06, 1], [LAND + 0.2, 0, ease.outBack]], ease);
  const tHuff = kf([[REST + 0.3, 0], [REST + 0.4, 1, ease.outBack], [END - 0.14, 1], [END - 0.02, 0]], ease);
  const tHop = (t) => {
    let v = 0;
    for (const h of [REST + 0.36, REST + 0.54]) {
      const s = (t - h) / 0.15;
      if (s > 0 && s < 1) v = Math.max(v, Math.sin(s * Math.PI));
    }
    return v;
  };
  const tShake = (t) => (t > REST + 0.36 && t < END - 0.08 ? Math.sin((t - REST - 0.36) * 6.5 * TAU) * 0.3 * Math.sin(((t - REST - 0.36) / (END - 0.08 - REST - 0.36)) * Math.PI) : 0);
  // Jun: can't watch (turns away, eye shut), peeks a little more at every plink, then gapes
  const jWatch = kf([[TOUCH + 0.05, 0], [TOUCH + 0.35, 1, ease.out], [REST + 0.3, 1], [END - 0.05, 0]], ease);
  const jCant = kf([[HANG + 0.05, 0], [HANG + 0.2, 1, ease.out], [C0, 1], [touches[1], 0.55], [touches[2], 0.2], [touches[3], 0]], ease);
  const jGape = kf([[ON - 0.1, 0], [ON + 0.15, 1, ease.out], [REST + 0.3, 1], [END - 0.05, 0]], ease);
  const nod = (t, lag) => {
    let v = 0;
    for (let i = 1; i < touches.length - 1; i++) v += wob(t, touches[i] + lag, 0.045, 3.5, 12);
    return v;
  };

  // ---------------- ripples on the still water ----------------
  const ringGeo = new THREE.RingGeometry(0.92, 1, 72);
  const ripple = (x, y, big = 1) => {
    const at = lab.pos(x, y);
    for (let j = 0; j < 3; j++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(j === 0 ? RED : lab.PALETTE.light).lerp(new THREE.Color(lab.PALETTE.light), j === 0 ? 0.35 : 0).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, WATER + 0.004, at.z);
      m.renderOrder = 3;
      lab.add(m);
      const delay = j * 0.09;
      const size = (0.85 - j * 0.2) * big;
      lab.at(delay, () =>
        lab.tween(1.05 - j * 0.12, (e, k) => {
          const s = 0.06 + e * size;
          m.scale.set(s, s, s);
          mat.opacity = (k < 0.08 ? k / 0.08 : 1) * (1 - k) ** 1.6 * (j === 0 ? 1 : 0.7);
        }, ease.out).then(() => m.removeFromParent()),
      );
    }
    // a glint where she touched
    lab.particles(at.clone().setY(WATER + 0.02), [RED, lab.PALETTE.light], 7, { speed: 0.55, up: 1.3, gravity: 6, size: 0.04, dur: 0.5 });
  };
  const plink = (x, y) => {
    lab.ring(lab.pos(x, y), lab.PALETTE.light, 0.32, 0.02, 0.45);
    lab.ring(lab.pos(x, y), RED, 0.62, 0.015, 0.8);
  };

  // ---------------- camera: lean out to see the lap, then home ----------------
  const camW = kf([[TOUCH + 0.1, 0], [HANG + 0.15, 1, ease.inOut], [LAND - 0.1, 1], [REST + 0.15, 0, ease.inOut]], ease);
  const releaseCam = lab.camera((home) => {
    const w = camW(lab.t - T0);
    const target = home.target.clone().add(new THREE.Vector3(1.2 * w, 0, 0.55 * w));
    return { target, dist: home.dist * (1 + 0.22 * w), az: 0.08 * w };
  });

  // ---------------- run ----------------
  lab.playCard('a', ['m2']);
  const col = arena.columns.find((c) => c.n === 2);
  const flashFlag = () => {
    col.flash = arena.time;
    col.flashColor = new THREE.Color(RED);
  };
  const fired = new Set();
  const once = (key, t, fn) => {
    if (t && !fired.has(key)) {
      fired.add(key);
      fn();
    }
  };
  let tLook = theo.rot;
  let jLook = jun.rot;

  const stop = lab.every((dt) => {
    const t = lab.t - T0;
    const c = course(t);
    // ----- Maya -----
    maya.x = c.x;
    maya.y = c.y;
    maya.lift = c.lift;
    const sq = contactSquash(t);
    const air = c.phase === 'hop' ? Math.sin(c.k * Math.PI) : 0;
    const skid = c.phase === 'skid' && t > TOUCH + 0.24 ? Math.sin(t * 23 * TAU) * 0.045 : 0;
    // the stone coming to rest: a wobble that quickens as it dies, and a tiny circling of the contact point
    let wl = 0;
    let wr = 0;
    if (t > ON && t < REST) {
      const k = (t - ON) / (REST - ON);
      const amp = 0.24 * (1 - k) ** 1.3;
      const ph = TAU * (2.2 * k + 3.6 * k * k) * 1.8;
      wl = amp * Math.cos(ph);
      wr = amp * Math.sin(ph);
      maya.x = 4 + 0.05 * (1 - k) * Math.cos(ph);
      maya.y = 1 + 0.05 * (1 - k) * Math.sin(ph);
    }
    maya.rot = facing(1) - spin(t) + mGlance(t) * wrap(facing(2) - facing(1)) + mLook(t);
    maya.lean = mLean(t) + wl - 0.14 * mSmug(t);
    const tremble = t > HANG + 0.1 && t < DROP ? Math.sin(t * 15 * TAU) * 0.035 : 0;
    maya.roll = skid + wr + tremble;
    maya.sy = (1 - sq) * (1 + 0.1 * air) * (1 + 0.07 * mSmug(t)) * (c.phase === 'skid' ? 0.9 : 1) + wob(t, REST, 0.06, 4, 8) + mGulp(t);
    maya.sw = 1 / Math.sqrt(Math.max(0.4, maya.sy));
    maya.open = Math.min(mOpen(t), mWink(t));
    maya.eye = mEye(t);
    maya.glow = 0.25 * smooth(C0, C0 + 0.1, t) * (1 - smooth(REST, END, t));
    maya.trail = c.phase !== 'rest';

    // ----- Theo -----
    tLook = lookRot(tLook, 5, 3, maya.x, maya.y) * (1 - Math.exp(-dt * 10)) + tLook * Math.exp(-dt * 10);
    const tw = tWatch(t);
    const wince = tWince(t);
    const duck = tDuck(t);
    const huff = tHuff(t);
    theo.rot = facing(3) + tw * wrap(tLook - facing(3)) + tShake(t);
    theo.lean = 0.16 * tw * (1 - wince) - 0.22 * wince - 0.3 * duck + 0.1 * huff;
    theo.sy = (1 - 0.14 * wince - 0.42 * duck + 0.17 * huff) * (1 + nod(t, 0.05));
    theo.sw = 1 + 0.08 * wince + 0.22 * duck - 0.06 * huff;
    theo.lift = 0.17 * tHop(t);
    theo.open = Math.max(0.05, (1 + 0.35 * tw) * (1 - 0.93 * Math.max(wince, duck)));
    theo.eye = 1 + 0.9 * huff;
    theo.glow = 0.5 * huff;

    // ----- Jun -----
    jLook = lookRot(jLook, 1, 0, maya.x, maya.y) * (1 - Math.exp(-dt * 7)) + jLook * Math.exp(-dt * 7);
    const jw = jWatch(t);
    const cant = jCant(t);
    const gape = jGape(t);
    jun.rot = facing(2) + jw * wrap(jLook - facing(2)) * (1 - 0.55 * cant) + 0.6 * cant;
    jun.lean = -0.18 * cant + 0.22 * gape + 0.1 * jw * (1 - cant);
    jun.sy = (1 - 0.16 * cant - 0.06 * gape) * (1 + nod(t, 0.1));
    jun.sw = 1 + 0.08 * cant;
    jun.open = Math.max(0.05, 1 - 0.95 * cant + 0.45 * gape);

    for (const A of [maya, theo, jun]) A.apply();

    // ----- events -----
    once('touch', t >= TOUCH, () => {
      flashFlag();
      arena.clearCards();
    });
    for (let i = 0; i < touches.length - 1; i++) {
      once(`plink${i}`, t >= touches[i], () => {
        const v = i === 0 ? { x: xHang, y: 1 } : curve.getPoint(i / nSeg);
        ripple(v.x, v.y, 1 - 0.1 * i);
      });
    }
    once('on', t >= ON, flashFlag);
    once('rest', t >= REST, () => plink(4, 1));
  });

  await lab.wait(END);
  stop();
  releaseCam();
  maya.done(1);
  theo.done(3);
  jun.done(2);
}
