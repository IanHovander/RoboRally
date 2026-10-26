// The laser pointer, acted. Theo glances slyly at Jun, then puts a jittery dot of light on the glass beside Maya.
// Jun is a cat: his head snaps round, follows every twitch, he crouches with his rear up and wiggles... the dot goes
// still (that's the cue), he pounces, and at that instant the dot hops up onto Maya. Jun hangs frozen in mid-air,
// droops, drops, and slides home facing north as if nothing happened. Theo bobs with silent laughter.
export const meta = {
  title: 'The laser pointer (Jun the cat)',
  idea:
    'Theo\'s shot lands first as a jittery dot of light on the glass beside Maya, on a thin line from his muzzle, and Theo makes it dance on purpose (a sly glance at Jun first). Jun is the cat: head snaps round, tracks every twitch, crouches rear-up and wiggles; the dot goes still, Jun pounces, and the dot hops up onto Maya: the hit. Jun hangs frozen in mid-air, droops, drops, and slides back to his space facing north as if nothing happened; Maya never moves, just gives Jun a look.',
  notes:
    'Sound: a tiny high "tick" when the dot appears, a faint glassy shimmer while it jitters, silence for the crouch (let the wiggle play), a soft "fff" for the pounce, the usual hit chime as the dot hops onto Maya, then one small glass "plink" when Jun lands, and nothing at all while he slides home. Porting: needs a bystander within two spaces of the target and on the shooter\'s side; otherwise play a plain hit. The dot sits on the target\'s side nearest the bystander.',
};

// ---------- small acting toolkit (kept in this file so the entry stands alone) ----------

function track(lab, list) {
  return (t) => {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [t1, v1, e] = list[i];
      if (t <= t1) {
        const [t0, v0] = list[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * lab.ease[e ?? 'inOut'](k);
      }
    }
    return list[list.length - 1][1];
  };
}
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const win = (t, a, b) => clamp01((t - a) / (b - a));

/** A robot as an actor: body-only lean, turn, squash and eye, so its ring and pointer stay true. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push([o, o.scale.clone()]));
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1 };
  m.body.rotation.order = 'YXZ';
  p.each = (model) => {
    const b = model.body;
    b.rotation.set(-st.pitch, st.yaw, -st.roll);
    b.scale.set(st.sx, st.sy, st.sz);
    b.position.y += st.up;
    for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(st.eyeS);
    const e = st.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };
  const done = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    for (const [o, s] of eyes) o.scale.copy(s);
    p.release(state);
  };
  return { p, m, st, done };
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE, facing } = lab;
  const K = (list) => track(lab, list);
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const BLUE = lab.bot('b').color;

  // ----- places (world) -----
  const mayaC = lab.pos(1, 1);
  const junC = lab.pos(3, 3);
  const dotHome = lab.pos(1.78, 1.6); // on the glass just beside Maya, on Jun's side
  const onMaya = new THREE.Vector3(mayaC.x + 0.24, 0.2, mayaC.z + 0.12); // her flank, facing Jun and Theo

  // ----- the light: a thin line from Theo's muzzle, a dot on the glass -----
  const glowTex = glowTexture(THREE);
  const lineCore = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const lineGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#e9f4ff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dotPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(BLUE).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dotPool.rotation.x = -Math.PI / 2;
  for (const o of [lineGlow, lineCore, dotPool, dot]) {
    o.visible = false;
    o.renderOrder = 6;
    lab.add(o);
  }
  const up = new THREE.Vector3(0, 1, 0);
  const muz = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const dotAt = new THREE.Vector3();

  // ----- timing -----
  const T_AIM = 0.2; // the dot appears
  const T_LOCK = 0.36; // Jun's head snaps round
  const T_CROUCH = 0.56;
  const T_STILL = 0.98; // the dot goes still: the cue
  const T_POUNCE = 1.1; // launch
  const T_HOP = 1.2; // the dot hops onto Maya
  const T_HIT = 1.29;
  const T_DROP = 1.66; // the freeze ends
  const T_LAND = 1.76;
  const T_HOME = 2.26;
  const T_END = 2.3;

  // the dot's shaky hand: smooth wobble, a couple of teasing darts, then dead still before the pounce
  const dartX = K([[0, 0], [0.5, 0], [0.56, -0.2, 'out'], [0.68, -0.2], [0.76, 0.06, 'inOut'], [0.84, 0.16, 'out'], [0.96, 0.08, 'inOut']]);
  const dartZ = K([[0, 0], [0.5, 0], [0.56, 0.12, 'out'], [0.68, 0.12], [0.76, -0.05, 'inOut'], [0.84, 0.12, 'out'], [0.96, 0.1, 'inOut']]);
  const shake = (t) => (t < T_STILL ? 1 : Math.max(0, 1 - (t - T_STILL) / 0.04));
  const dotPos = (t, out) => {
    const s = shake(t);
    out.set(
      dotHome.x + dartX(t) + s * (0.045 * Math.sin(t * 19 + 1) + 0.03 * Math.sin(t * 33 + 2) + 0.018 * Math.sin(t * 57)),
      0.012,
      dotHome.z + dartZ(t) + s * (0.04 * Math.sin(t * 23 + 3) + 0.025 * Math.sin(t * 37) + 0.015 * Math.sin(t * 61 + 1)),
    );
    // the hop: a little arc up onto her flank
    const h = win(t, T_HOP, T_HIT);
    if (h > 0) {
      const e = lab.ease.inOut(h);
      out.lerp(onMaya, e);
      out.y += Math.sin(h * Math.PI) * 0.32;
    }
    return out;
  };

  // ----- the acting -----
  // Jun's whole body turns to face the dot (so his pointer follows), then home to north at the end
  const angTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)); // rotation.y that faces "to"
  const aimDot = angTo(junC, dotHome);
  const pounceTo = junC.clone().lerp(dotHome, 0.5 / junC.distanceTo(dotHome)); // half a space toward it
  const jRot = K([[0, facing(0)], [T_LOCK, facing(0)], [T_LOCK + 0.1, aimDot + 0.12, 'out'], [T_LOCK + 0.2, aimDot, 'inOut'], [T_LAND + 0.08, aimDot], [T_HOME - 0.06, facing(0), 'inOut']]);
  // crouch: low, wide, front down (rear up); launch: stretch; freeze: hang in the stretch; land: squash
  const jSy = K([[0, 1], [T_CROUCH, 1], [T_CROUCH + 0.14, 0.7, 'out'], [T_POUNCE - 0.05, 0.66], [T_POUNCE, 0.6, 'in'], [T_POUNCE + 0.07, 1.26, 'out'], [T_HIT, 1.18], [T_HIT + 0.1, 1.1, 'out'], [T_DROP, 1.08], [T_LAND, 1.05, 'in'], [T_LAND + 0.05, 0.8, 'out'], [T_LAND + 0.3, 1, 'outElastic']]);
  const jPitch = K([[0, 0], [T_CROUCH, 0], [T_CROUCH + 0.14, 0.13, 'out'], [T_POUNCE, 0.16], [T_POUNCE + 0.07, -0.3, 'out'], [T_HIT, -0.22], [T_HIT + 0.12, 0.08, 'inOut'], [T_DROP, 0.22, 'inOut'], [T_LAND, 0.1], [T_LAND + 0.2, 0, 'inOut']]);
  const jUp = K([[0, 0], [T_POUNCE, 0], [T_POUNCE + 0.13, 0.3, 'out'], [T_HIT, 0.32, 'out'], [T_DROP, 0.31], [T_LAND, 0, 'in']]);
  const jTravel = K([[0, 0], [T_POUNCE, 0], [T_HIT, 1, 'out'], [T_LAND + 0.1, 1], [T_HOME, 0, 'inOut']]);
  // eye: locks (big and bright), then droops (dim, small) in the freeze, and comes back as he slides home
  const jEyeS = K([[0, 1], [T_LOCK, 1], [T_LOCK + 0.08, 1.55, 'outBack'], [T_HIT + 0.08, 1.55], [T_HIT + 0.2, 0.55, 'out'], [T_LAND + 0.3, 0.6], [T_HOME, 1, 'inOut']]);
  const jEye = K([[0, 1], [T_LOCK, 1], [T_LOCK + 0.08, 1.8, 'out'], [T_HIT + 0.08, 1.8], [T_HIT + 0.2, 0.45, 'out'], [T_LAND + 0.3, 0.5], [T_HOME, 1, 'inOut']]);

  // Theo: a sly glance at Jun, then he aims (the dot's jitter is his body's), a flick for the hop, silent laughter
  const tYawBase = K([[0, 0], [0.1, 0.42, 'out'], [0.16, 0.42], [T_AIM, 0.12, 'inOut'], [T_HOP - 0.03, 0.12], [T_HOP + 0.03, -0.1, 'out'], [T_HIT + 0.2, 0, 'inOut']]);
  const tPitch = K([[0, 0], [T_AIM, 0.1, 'inOut'], [T_HOP - 0.03, 0.1], [T_HOP + 0.03, -0.12, 'out'], [T_HIT + 0.2, 0, 'inOut']]);
  const tGiggle = (t) => win(t, T_HIT + 0.15, T_HIT + 0.2) * (1 - win(t, T_HOME - 0.25, T_HOME)) * Math.abs(Math.sin((t - T_HIT) * 26));

  // Maya: glances down at the dot, gives Jun a flat look through the crouch, takes the hit (still in her space)
  const mYaw = K([[0, 0], [T_AIM + 0.06, 0], [T_AIM + 0.18, 0.4, 'out'], [T_CROUCH + 0.04, 0.4], [T_CROUCH + 0.18, 0.72, 'inOut'], [T_HIT, 0.72], [T_HIT + 0.04, 0.6, 'out'], [T_DROP + 0.1, 0.62], [T_HOME - 0.04, 0, 'inOut']]);
  const mPitch = K([[0, 0], [T_AIM + 0.06, 0], [T_AIM + 0.18, 0.16, 'out'], [T_CROUCH + 0.04, 0.16], [T_CROUCH + 0.18, 0, 'inOut']]);
  const mEyeS = K([[0, 1], [T_CROUCH + 0.18, 1], [T_CROUCH + 0.28, 0.72, 'inOut'], [T_HIT, 0.72], [T_HIT + 0.04, 1.4, 'out'], [T_HIT + 0.3, 0.75, 'inOut'], [T_HOME - 0.04, 1, 'inOut']]);
  const mRoll = K([[0, 0], [T_HIT, 0], [T_HIT + 0.04, -0.16, 'out'], [T_HIT + 0.34, 0, 'outElastic']]);

  const T0 = lab.t;
  let hit = false;
  let tick = false;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    // the dot
    dotPos(t, dotAt);
    const on = t >= T_AIM ? 1 - win(t, T_HIT + 0.04, T_HIT + 0.24) : 0;
    if (!tick && t >= T_AIM) {
      tick = true;
      lab.arena.emit('laser', { board: false, hit: true, src: 'b' });
    }

    // Theo
    const shk = shake(t) * (t > T_AIM ? 1 : 0);
    theo.st.yaw = tYawBase(t) + shk * (0.012 * Math.sin(t * 19 + 1) + 0.008 * Math.sin(t * 33 + 2));
    theo.st.pitch = tPitch(t);
    const gg = tGiggle(t);
    theo.st.sy = 1 - 0.06 * gg;
    theo.st.sx = theo.st.sz = 1 + 0.03 * gg;
    theo.st.eye = t > T_HIT + 0.15 && t < T_HOME ? 1.5 : 1;

    // Jun: whole-body turn, head tracking the dot with a little lag, the crouch and the wiggle
    const j = jTravel(t);
    jun.p.set({ x: 3 + (pounceTo.x - junC.x) * j, y: 3 + (pounceTo.z - junC.z) * j, rot: jRot(t) });
    const track = t > T_LOCK + 0.2 && t < T_POUNCE ? clamp01((angTo(junC, dotAt) - aimDot) * 1.6) : 0;
    const wig = win(t, T_CROUCH + 0.12, T_CROUCH + 0.32) * (1 - win(t, T_POUNCE - 0.06, T_POUNCE));
    const wf = 9 + 10 * win(t, T_CROUCH + 0.1, T_POUNCE); // the wiggle speeds up
    const wPh = (t - T_CROUCH) * wf;
    const sy = jSy(t);
    Object.assign(jun.st, {
      yaw: track * 0.5 + (angTo(junC, dotAt) - aimDot) * (t > T_LOCK + 0.2 && t < T_POUNCE ? 0.8 : 0) + wig * 0.16 * Math.sin(wPh),
      roll: wig * 0.12 * Math.sin(wPh + 0.6),
      pitch: jPitch(t),
      sy,
      sx: 1 + (1 - sy) * 0.55,
      sz: 1 + (1 - sy) * 0.55,
      up: jUp(t),
      eyeS: jEyeS(t),
      eye: jEye(t),
    });
    // in the freeze, a tiny embarrassed tremble
    if (t > T_HIT + 0.06 && t < T_DROP) jun.st.roll += 0.015 * Math.sin(t * 70);

    // Maya
    Object.assign(maya.st, { yaw: mYaw(t), pitch: mPitch(t), eyeS: mEyeS(t), roll: mRoll(t) });

    // the hit: the dot lands on her
    if (!hit && t >= T_HIT) {
      hit = true;
      lab.glitch('a', '#ff7a6b');
      lab.shards(onMaya.clone(), '#ff7a6b', 12);
      lab.arena.emit('damage', { id: 'a', n: 1, hw: 0 });
    }

    // draw the line and the dot
    theo.m.muzzle.updateWorldMatrix(true, false);
    muz.setFromMatrixPosition(theo.m.muzzle.matrixWorld);
    const vis = on > 0.001;
    for (const o of [lineCore, lineGlow, dot, dotPool]) o.visible = vis;
    if (vis) {
      dir.subVectors(dotAt, muz);
      const len = dir.length();
      dir.normalize();
      for (const l of [lineCore, lineGlow]) {
        l.position.copy(muz).addScaledVector(dir, len / 2);
        l.quaternion.setFromUnitVectors(up, dir);
        l.scale.set(1, len, 1);
      }
      lineCore.material.opacity = 0.85 * on;
      lineGlow.material.opacity = 0.3 * on;
      const pop = win(t, T_AIM, T_AIM + 0.08);
      const flare = t > T_HIT ? Math.exp(-(t - T_HIT) / 0.08) : 0;
      dot.position.copy(dotAt);
      dot.position.y += 0.02;
      dot.scale.setScalar((0.16 + 0.08 * (1 - pop) + 0.4 * flare) * on);
      dotPool.position.set(dotAt.x, 0.008, dotAt.z);
      dotPool.scale.setScalar(0.45 * on * (1 - win(t, T_HOP, T_HOP + 0.05)));
    }
  });

  await lab.wait(T_END);
  stop();
  for (const o of [lineCore, lineGlow, dot, dotPool]) o.visible = false;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
