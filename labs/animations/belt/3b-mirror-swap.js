// Belt, idea 3 (animator b, character acting): "Mirror Swap".
// A pane of smoked glass rises on the corner's diagonal. Maya, parked one space short of it, catches her
// reflection in it and does the Duck Soup mirror routine: she looks, it looks; she leans in, it leans in; she
// bobs, it bobs; she wiggles... and it wiggles a beat LATE. Eyes wide. The belt shoves her into the glass, the
// two touch, and it's the reflection, facing east, that steps out onto the corner. The north-facing one is left
// inside the pane, knocking on the glass as it sinks. The new Maya glances back at the spot, and settles. Smug.
export const meta = {
  title: 'Mirror Swap',
  idea:
    'A smoked-glass pane rises on the corner\'s diagonal, the angle that turns north into east. Maya catches her reflection in it and plays the old mirror routine: she looks, it looks; she leans, it leans; she bobs, it bobs; she wiggles... and it wiggles a beat late. The belt shoves her into the glass; at the touch it is the east-facing reflection that steps out onto the corner, while the north-facing Maya is left inside the pane, knocking, as it sinks. The new Maya glances back and settles, smug. Jun double-takes between the two of them.',
  notes:
    'Sound: the pane rises with a long, soft glass shimmer; the routine is silent except for one tiny high "tink" on the late wiggle; the touch is a bright two-note chime played forwards and then mirrored (reversed); the knocks are two muffled taps on glass, the second fainter as the pane sinks. Port: the reflection is a clone of the robot with its own materials, mirrored across the pane (position, heading, and roll flipped), drawn with local clipping planes on either side of the pane, and the swap just trades the two poses. For a left-turning corner the pane stands on the other diagonal.',
};

export default async function play(lab) {
  const { THREE, renderer } = lab;
  const maya = lab.puppet('a');
  const jun = lab.puppet('b');
  const M = rig(lab, maya, 'x');
  const J = rig(lab, jun, 'y');
  const junRot = jun.pose.rot;

  // ----- the mirror: a plane through the corner's centre, on its south-west to north-east diagonal -----
  const C = { x: 3, y: 1 };
  const P = lab.pos(C.x, C.y);
  const n = new THREE.Vector3(1, 0, 1).normalize(); // its normal, pointing south-east (toward us)
  const keepSE = new THREE.Plane(n.clone(), -n.dot(P));
  const keepNW = new THREE.Plane(n.clone().negate(), n.dot(P));
  const clipWas = renderer.localClippingEnabled;
  renderer.localClippingEnabled = true;
  lab.cleanup(() => (renderer.localClippingEnabled = clipWas));

  // the pane: smoked glass with a bright top edge, rising out of a slit of light
  const W = 1.36;
  const H = 0.74;
  const pane = new THREE.Group();
  pane.position.copy(P);
  pane.rotation.y = Math.PI / 4;
  lab.add(pane);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d1218, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.4,
    emissive: 0x9fb2cc, emissiveIntensity: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassMat);
  glass.position.y = H / 2;
  pane.add(glass);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(2.4), transparent: true });
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.016, 0.024), edgeMat);
  top.position.y = H;
  pane.add(top);
  const sideMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(1.1), transparent: true, opacity: 0.7 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, H, 0.02), sideMat);
    e.position.set((s * W) / 2, H / 2, 0);
    pane.add(e);
  }
  // a sweep of light across the glass at the touch
  const sweepMat = new THREE.MeshBasicMaterial({ map: bandTexture(THREE), color: new THREE.Color('#f4efe4').multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(0.5, H), sweepMat);
  sweep.position.set(0, H / 2, 0.004);
  pane.add(sweep);
  // the slit in the glass it rises from
  const slitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.03), slitMat);
  slit.rotation.x = -Math.PI / 2;
  slit.position.copy(P).setY(0.008);
  slit.rotation.z = Math.PI / 4;
  slit.rotation.order = 'YXZ';
  slit.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  lab.add(slit);
  // a knock: a little ring of light on the glass where she taps it from inside
  const knockMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4d6d').multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const knock = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 32), knockMat);
  pane.add(knock);

  // ----- the reflection: a clone of her with its own materials -----
  const twin = cloneBot(lab, maya);
  lab.add(twin.group);
  const T = rig(lab, null, 'x', twin);

  // looks: k = how much of a reflection it is (0 = solid Maya, 1 = an image in smoked glass)
  const realMats = { paint: maya.model.paint, eyeMat: maya.model.eyeMat, ringMat: maya.model.ringMat, poolMat: maya.model.poolMat };
  const paintWas = { transparent: realMats.paint.transparent, opacity: realMats.paint.opacity, depthWrite: realMats.paint.depthWrite, color: realMats.paint.color.clone() };
  const RED = paintWas.color.clone();
  const setClip = (mats, planes) => {
    for (const m of Object.values(mats)) {
      m.clippingPlanes = planes;
      m.needsUpdate = true;
    }
  };
  lab.cleanup(() => {
    setClip(realMats, null);
    Object.assign(realMats.paint, { ...paintWas, color: realMats.paint.color.copy(paintWas.color) });
  });
  const look = (st, mats, k) => {
    mats.paint.transparent = k > 0.001;
    mats.paint.opacity = 1 - 0.62 * k;
    mats.paint.color.copy(RED).multiplyScalar(1 - 0.4 * k);
    mats.paint.depthWrite = k < 0.5;
    st.dim = 1 - 0.45 * k;
    st.poolA = 1 - 0.75 * k;
    st.ringA = 1 - 0.55 * k;
  };

  // ----- mirror maths, in board spaces (the line x + y = 4 through the corner) -----
  const mirrorXY = (x, y) => {
    const s = x - C.x + (y - C.y);
    return { x: x - s, y: y - s };
  };
  const mirrorRot = (rot) => {
    const fx = -Math.sin(rot);
    const fz = -Math.cos(rot);
    const s = fx + fz;
    return Math.atan2(-(fx - s), -(fz - s));
  };

  // ----- the choreography (moment clock, seconds) -----
  const TOUCH = 1.36;
  // Maya, as herself: carried one space, the routine, then shoved into the glass
  const x = track([[0, 1], [0.12, 1], [0.5, 2, 'inOut'], [1.08, 2], [TOUCH, 2.52, 'in']]);
  const yaw = track([[0, 0], [0.55, 0], [0.64, -0.95, 'out'], [0.98, -0.95], [1.06, -0.9], [1.1, -0.55, 'out'], [1.3, -0.2], [TOUCH, -0.15]]);
  const lean = track([[0, 0], [0.74, 0], [0.84, 0.16, 'inOut'], [0.98, 0.14], [1.07, -0.16, 'out'], [1.2, -0.05], [TOUCH, 0.05]]);
  const roll = track([[0, 0], [0.98, 0], [1.0, 0.12, 'out'], [1.02, -0.12], [1.04, 0.09], [1.06, 0], [1.14, 0], [1.3, -0.14, 'inOut'], [TOUCH, -0.1]]);
  const sy = track([[0, 1], [0.86, 1], [0.9, 0.84, 'out'], [0.95, 1.08, 'out'], [0.98, 1.0], [1.06, 1.0], [1.09, 1.14, 'out'], [1.2, 1.06], [TOUCH, 0.96]]);
  const open = track([[0, 1], [0.55, 1], [0.6, 1.5, 'out'], [0.74, 1.3], [0.84, 0.45, 'inOut'], [0.98, 0.45], [1.07, 2.4, 'out'], [TOUCH, 2.0]]);
  const glow = track([[0, 1], [0.55, 1], [0.6, 1.3], [0.84, 1.0], [1.07, 1.7, 'out'], [TOUCH, 1.4]]);
  // the image lags behind her, just once
  const lag = track([[0, 0], [0.97, 0], [0.985, 0.075, 'linear'], [1.075, 0.075], [1.12, 0, 'linear']]);
  const imgK = track([[0, 1], [TOUCH, 1]]);
  const imgFade = (sep) => Math.min(1, Math.max(0, (2.2 - sep) / 0.7)); // appears as she nears the glass

  // after the touch (u = seconds since): both pressed to the glass, each on its own side. The east-facing one
  // is her now; she glances back at the old her knocking inside the pane, which sinks; then she shuffles onto
  // the corner's centre and settles, smug.
  const t2 = (t) => t - TOUCH;
  const outY = track([[0, 1.48], [0.56, 1.48], [0.8, 1.0, 'inOut']]);
  const outHop = track([[0, 0], [0.58, 0], [0.68, 0.04, 'out'], [0.78, 0, 'in']]);
  const outSy = track([[0, 1.0], [0.04, 0.88, 'out'], [0.14, 1.1, 'out'], [0.26, 1.02], [0.5, 1.0], [0.58, 0.9, 'out'], [0.68, 1.04], [0.78, 0.9, 'in'], [0.86, 1.07, 'out'], [0.95, 1.04]]);
  const outYaw = track([[0, 0], [0.14, 0], [0.24, 1.05, 'out'], [0.48, 1.0], [0.62, 0, 'inOut']]);
  const outLean = track([[0, 0], [0.52, 0], [0.6, 0.1, 'out'], [0.78, 0.04], [0.86, -0.09, 'out'], [0.95, -0.07]]);
  const outRoll = track([[0, 0], [0.14, 0], [0.24, -0.08], [0.48, -0.06], [0.62, 0]]);
  const outOpen = track([[0, 1.6], [0.06, 2.4, 'out'], [0.24, 1.3], [0.38, 0.55, 'inOut'], [0.52, 0.55], [0.7, 0.9], [0.95, 0.7]]);
  const outGlow = track([[0, 1.4], [0.06, 2.4, 'out'], [0.3, 1.2], [0.86, 1.3], [0.95, 1.25]]);
  const outK = track([[0, 1], [0.04, 1], [0.16, 0, 'out']]);
  const outClip = 0.62; // when the pane is low enough to let her cross its line
  // the old her, left behind the glass: realises, turns to the new her, knocks once, sinks with the pane
  const inX = track([[0, 2.52], [0.04, 2.47, 'out'], [0.24, 2.5], [0.3, 2.6, 'in'], [0.37, 2.5, 'out']]);
  const inK = track([[0, 0], [0.04, 0], [0.18, 1, 'out']]);
  const inOpen = track([[0, 2.0], [0.08, 2.7, 'out'], [0.5, 2.3]]);
  const inYaw = track([[0, -0.15], [0.12, -0.7, 'out'], [0.5, -0.7]]);
  const sink = track([[0, 0], [0.38, 0], [0.66, -0.95, 'in']]);
  const knocks = (u) => Math.max(0, 1 - Math.abs(u - 0.3) / 0.07);
  const flare = (u) => Math.max(0, 1 - u / 0.22) * Math.min(1, u / 0.02);

  // the pane
  const rise = track([[0, -H - 0.05], [0.12, -H - 0.05], [0.5, 0, 'out3']]);
  const slitA = track([[0, 0], [0.12, 1, 'out'], [0.5, 0.25], [TOUCH + 0.6, 0.25], [TOUCH + 0.7, 0]]);

  // Jun: double-takes between the two of them, startles at the swap, then peers at where the pane went
  const jYaw = track([[0, 0], [0.1, 0], [0.25, -0.3, 'out'], [0.6, -0.3], [0.66, 0.02, 'out'], [0.74, -0.3, 'out'], [0.84, 0.06, 'out'], [1.0, 0.02], [1.15, -0.15], [TOUCH, -0.2], [TOUCH + 0.3, -0.2], [TOUCH + 0.4, -0.3], [TOUCH + 0.95, -0.3]]);
  const jLean = track([[0, 0], [0.84, 0], [0.9, -0.1, 'out'], [1.1, 0.06], [TOUCH, 0.06], [TOUCH + 0.06, -0.16, 'out'], [TOUCH + 0.35, 0], [TOUCH + 0.7, 0.22]]);
  const jOpen = track([[0, 1], [0.8, 1], [0.86, 1.8, 'out'], [1.2, 1.3], [TOUCH, 1.3], [TOUCH + 0.06, 2.0, 'out'], [TOUCH + 0.5, 1.4]]);
  const jSy = track([[0, 1], [0.8, 1], [0.86, 1.1, 'out'], [1.0, 1.0], [TOUCH, 1], [TOUCH + 0.06, 1.1, 'out'], [TOUCH + 0.3, 1.0]]);

  const END = TOUCH + 0.95;
  let swapped = false;
  let unclipped = false;
  setClip(realMats, [keepNW]);
  setClip(twin.mats, [keepSE]);
  const t0 = lab.t;
  const herAt = (t) => ({ yaw: yaw(t), lean: lean(t), roll: roll(t), sy: sy(t), open: open(t), glow: glow(t) });
  const setBody = (st, b, mirrored) => {
    Object.assign(st, b);
    if (mirrored) {
      st.yaw = -b.yaw;
      st.roll = -b.roll;
    }
    st.sx = st.sz = 1 / Math.sqrt(st.sy);
  };
  const placeTwin = (x, y, rot, lift = 0) => {
    const at = lab.pos(x, y);
    twin.group.position.set(at.x, lift, at.z);
    twin.group.rotation.set(0, rot, 0, 'YXZ');
    twin.group.scale.setScalar(1.3);
  };

  const apply = (t) => {
    pane.position.y = rise(t) + (t > TOUCH ? sink(t2(t)) : 0);
    slitMat.opacity = slitA(t);
    if (!swapped && t >= TOUCH) {
      swapped = true;
      setClip(realMats, [keepSE]);
      setClip(twin.mats, [keepNW]);
      maya.set({ trail: false });
    }
    if (!swapped) {
      // Maya is herself; the twin is her reflection
      const mx = x(t);
      maya.set({ x: mx, y: 1, rot: 0 });
      setBody(M, herAt(t), false);
      look(M, realMats, 0);
      const m = mirrorXY(mx, 1);
      placeTwin(m.x, m.y, mirrorRot(0));
      setBody(T, herAt(t - lag(t)), true);
      const k = imgK(t);
      look(T, twin.mats, k);
      const vis = imgFade(2 * (3 - mx) / Math.SQRT2) * Math.min(1, Math.max(0, (pane.position.y + H) / H));
      twin.mats.paint.opacity *= vis;
      T.dim *= vis;
      T.poolA *= vis;
      T.ringA *= vis;
      twin.group.visible = vis > 0.01;
    } else {
      const u = t2(t);
      // the reflection is her now: pressed to the glass on our side, facing east
      maya.set({ x: 3, y: outY(u), rot: -Math.PI / 2, lift: outHop(u) });
      setBody(M, { yaw: outYaw(u), lean: outLean(u), roll: outRoll(u), sy: outSy(u), open: outOpen(u), glow: outGlow(u) }, false);
      look(M, realMats, outK(u));
      if (u >= outClip && !unclipped) (unclipped = true), setClip(realMats, null);
      // the old her, left behind the glass
      placeTwin(inX(u), 1, 0, sink(u));
      const kn = knocks(u);
      const inside = u < 0.06 ? herAt(TOUCH) : { yaw: inYaw(u), lean: 0.12 * kn, roll: 0, sy: 1.05 - 0.1 * kn, open: inOpen(u), glow: 1.4 };
      setBody(T, inside, false);
      look(T, twin.mats, inK(u));
      twin.group.visible = sink(u) > -0.9;
      // her knocks light up the glass from inside
      const kk = kn;
      knockMat.opacity = kk;
      knock.scale.setScalar(1.4 + 2.2 * (1 - kk));
      knock.position.set(-0.08, 0.3, -0.012);
      // the sweep of light at the touch
      const sw = Math.min(1, u / 0.22);
      sweep.position.x = -W / 2 + W * sw;
      sweepMat.opacity = Math.sin(Math.PI * sw) * 0.9;
    }
    const fl = t > TOUCH ? flare(t2(t)) : 0;
    edgeMat.color.set('#f4efe4').multiplyScalar(2.4 + 3.5 * fl);
    glassMat.emissiveIntensity = 0.05 + 0.5 * fl;
    jun.set({ rot: junRot });
    Object.assign(J, { yaw: jYaw(t), lean: jLean(t), open: jOpen(t), glow: 0.85 + 0.25 * jOpen(t), sy: jSy(t) });
    J.sx = J.sz = 1 / Math.sqrt(J.sy);
    T.base(twin);
    T.applyTo(twin);
  };
  const stop = lab.every(() => apply(Math.min(END, lab.t - t0)));
  await lab.wait(END);
  apply(END);
  stop();
  pane.visible = slit.visible = twin.group.visible = false;
  maya.release({ x: 3, y: 1, d: 1 });
  jun.release({ x: 5, y: 2, d: 3 });
  M.reset();
  setClip(realMats, null);
  Object.assign(realMats.paint, { ...paintWas, color: realMats.paint.color.copy(paintWas.color) });

  // the game carries on: Jun keeps peering at the spot where the glass went down, then lets it go
  const tail = lab.t;
  const jl = track([[0, 0.22], [0.5, 0.22], [0.8, 0, 'inOut']]);
  const jy = track([[0, -0.3], [0.5, -0.3], [0.8, 0, 'inOut']]);
  const stopTail = lab.every(() => {
    const t = lab.t - tail;
    Object.assign(J, { yaw: jy(t), lean: jl(t), roll: 0, sy: 1, sx: 1, sz: 1, open: 1.4 - 0.4 * Math.min(1, t / 0.8), glow: 1.1 });
    J.applyTo(lab.bot('b').model);
    if (t > 0.85) {
      J.reset();
      stopTail();
    }
  });
}

// ---------- helpers (self-contained) ----------

const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) ** 2,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out3: (k) => 1 - (1 - k) ** 3,
};

/** A keyframe track: [[t, value], [t, value, ease], ...] → f(t). The ease shapes the segment arriving at a key. */
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = 'inOut'] = keys[i];
      if (t <= t1) {
        const [ta, va] = keys[i - 1];
        const k = t1 > ta ? (t - ta) / (t1 - ta) : 1;
        return va + (v1 - va) * EASE[e](k);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** A copy of a robot's model with its own materials (no name tag), as { group, body, paint, eyeMat, ringMat, poolMat, mats }. */
function cloneBot(lab, p) {
  const src = p.model;
  const group = src.group.clone(true);
  const body = group.children[src.group.children.indexOf(src.body)];
  const tagAt = src.group.children.indexOf(p.bot.tag);
  if (tagAt >= 0) group.remove(group.children[tagAt]);
  const map = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!map.has(o.material)) map.set(o.material, o.material.clone());
    o.material = map.get(o.material);
  });
  const mats = { paint: map.get(src.paint), eyeMat: map.get(src.eyeMat), ringMat: map.get(src.ringMat), poolMat: map.get(src.poolMat) };
  return { group, body, ...mats, mats };
}

/**
 * Body language for a puppet (or a clone), on the body only (the ring and pointer stay put, so they still say
 * where it faces): yaw (a glance, right is -), lean (forward +), roll (right +), squash/stretch, hop, the eye's
 * opening and glow, and the ring and pool of light. `openAxis` is the eye mesh's local axis that opens it
 * ('x' for the Pebble's eye, which lies on its side; 'y' for the Cube's visor).
 */
function rig(lab, p, openAxis, model = p.model) {
  const m = model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push(o));
  const eyeBase = eyes.map((e) => e.scale.clone());
  let pool = null;
  m.group.traverse((o) => o.isMesh && o.material === m.poolMat && (pool = o));
  const poolBase = pool?.scale.clone();
  const st = {
    yaw: 0, lean: 0, roll: 0, sx: 1, sy: 1, sz: 1, hop: 0, open: 1, glow: 1, warm: 0, dim: 1, pool: 1, poolA: 1, ringA: 1, emit: 0, shake: 0,
    /** For a clone, which the game doesn't light: put its lights at the game's resting values first. */
    base(model) {
      model.poolMat.opacity = 0.75;
      model.ringMat.opacity = 0.9;
      model.paint.emissiveIntensity = 0.16;
    },
    applyTo(model) {
      model.body.rotation.order = 'YXZ';
      model.body.rotation.set(-st.lean, st.yaw, -st.roll);
      model.body.scale.set(st.sx, st.sy, st.sz);
      model.body.position.set(st.shake, st.hop, 0);
      eyes.forEach((e, i) => {
        e.scale.copy(eyeBase[i]);
        e.scale[openAxis] = eyeBase[i][openAxis] * Math.max(0.05, st.open);
      });
      const g = st.glow * st.dim;
      model.eyeMat.color.setRGB(3.2 * g * (1 + 0.12 * st.warm), 3.1 * g * (1 - 0.12 * st.warm), 2.9 * g * (1 - 0.45 * st.warm));
      if (pool) pool.scale.set(poolBase.x * st.pool, poolBase.y * st.pool, poolBase.z);
      model.poolMat.opacity *= st.poolA;
      model.ringMat.opacity *= st.ringA;
      if (st.emit) model.paint.emissiveIntensity = 0.16 + st.emit;
    },
    reset() {
      m.body.rotation.set(0, 0, 0);
      m.body.rotation.order = 'XYZ';
      m.body.scale.set(1, 1, 1);
      m.body.position.set(0, 0, 0);
      eyes.forEach((e, i) => e.scale.copy(eyeBase[i]));
      if (pool) pool.scale.copy(poolBase);
    },
  };
  if (p) {
    p.each = (mm) => st.applyTo(mm);
    lab.cleanup(() => st.reset());
  }
  return st;
}

/** A soft vertical band of light (bright in the middle, clear at the sides). */
function bandTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
