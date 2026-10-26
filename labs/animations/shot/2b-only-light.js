// The only light in the room, acted. Theo fires and the room's light goes out with the shot: the beam is the only
// light left, and it throws real shadows (computed per pixel from the line of light, so they swing as the head
// travels and Jun gets two of them, one from each bright end). The hit lands on Maya's shadow, which rips and
// jerks while Maya stands perfectly still... then she slowly looks round at it, looks back at us, and looks again.
export const meta = {
  title: 'The only light in the room (whose shadow?)',
  idea:
    'The lights die as Theo fires and his beam becomes the only light: it rakes the glass cold blue-white and throws real, long shadows that swing as its head races down the row. The hit lands on Maya\'s shadow: it rips and jerks while she stands perfectly still. A beat later she slowly turns to look at it, looks back at us, and does a double-take; Jun flinches at the rip, Theo cocks his head. The room\'s light comes back, the shadows creep home under their owners, and Maya gives a small relieved settle.',
  notes:
    'Sound: the room hum cuts with the shot (a soft "thup", like a big switch), a thin cold glass whine while the beam is the only light, a dry papery rip at the hit (the only harsh sound), silence for the double-take, and a warm swell as the lights return. Porting: the shadows are a small canvas lit per pixel from the beam (samples along the line plus the muzzle and the impact), with every robot as a disc, so they fall from wherever everyone stands and several beams would cross their shadows. Every light is put back exactly as it was (and again in cleanup).',
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
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1, emis: 1, ring: 1, pool: 1, tag: 1 };
  m.body.rotation.order = 'YXZ';
  const tag = lab.bot(key).tag;
  p.each = (model) => {
    const b = model.body;
    b.rotation.set(-st.pitch, st.yaw, -st.roll);
    b.scale.set(st.sx, st.sy, st.sz);
    b.position.y += st.up;
    for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(st.eyeS);
    const e = st.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    model.paint.emissiveIntensity *= st.emis;
    model.ringMat.opacity *= st.ring;
    model.poolMat.opacity *= st.pool;
    if (tag) tag.material.opacity *= st.tag;
  };
  const done = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    for (const [o, s] of eyes) o.scale.copy(s);
    if (tag) tag.material.opacity = 1;
    p.release(state);
  };
  return { p, m, st, done };
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE, arena } = lab;
  const K = (list) => track(lab, list);
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const all = [maya, theo, jun];
  const COLD = new THREE.Color('#bcd6ff');

  // ----- the room's lights, saved so they come back exactly -----
  const scene = arena.scene;
  const saved = {
    key: arena.key.intensity,
    hemi: arena.hemi.intensity,
    env: scene.environmentIntensity,
    bg: scene.backgroundIntensity ?? 1,
    spill: arena.spill.material.opacity,
    motes: arena.motes?.material.opacity,
  };
  const boardMats = [];
  arena.board.traverse((o) => {
    if (!o.isMesh) return;
    for (const mt of [].concat(o.material)) if (mt && mt !== arena.topMat && mt.emissiveIntensity != null && !boardMats.some((b) => b.m === mt)) boardMats.push({ m: mt, v: mt.emissiveIntensity });
  });
  const setRoom = (lit) => {
    arena.key.intensity = saved.key * lit;
    arena.hemi.intensity = saved.hemi * lit;
    scene.environmentIntensity = saved.env * (0.04 + 0.96 * lit);
    scene.backgroundIntensity = saved.bg * (0.12 + 0.88 * lit);
    arena.spill.material.opacity = saved.spill * lit;
    if (arena.motes) arena.motes.material.opacity = saved.motes * lit;
    for (const b of boardMats) b.m.emissiveIntensity = b.v * (0.05 + 0.95 * lit);
  };
  lab.cleanup(() => setRoom(1));

  // ----- geometry of the shot -----
  theo.m.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.m.muzzle.matrixWorld);
  const yb = muzzle.y;
  const zb = muzzle.z;
  const mayaC = lab.pos(1, 1);
  const theoC = lab.pos(5, 1);
  const junC = lab.pos(3, 3);
  const xHit = mayaC.x + 0.31; // her flank
  const corner = lab.pos(0, 0);
  const X0 = corner.x - 0.5;
  const Z0 = corner.z - 0.5;
  const BW = 7;
  const BH = 4;

  // ----- the light on the glass: a small canvas lit per pixel from the beam, with every robot as a disc -----
  const PX = 22; // pixels per space
  const CW = BW * PX;
  const CH = BH * PX;
  const data = new Uint8Array(CW * CH * 4);
  const washTex = new THREE.DataTexture(data, CW, CH, THREE.RGBAFormat);
  washTex.magFilter = THREE.LinearFilter;
  washTex.minFilter = THREE.LinearFilter;
  washTex.needsUpdate = true;
  const washMat = new THREE.MeshBasicMaterial({ map: washTex, color: COLD.clone().multiplyScalar(0.8), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), washMat);
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(X0 + BW / 2, 0.004, Z0 + BH / 2);
  wash.renderOrder = 3;
  lab.add(wash);
  // the occluders (discs on the glass), live each frame
  const occ = [
    { c: mayaC, r: 0.25, h: 0.42 },
    { c: theoC, r: 0.25, h: 0.42 },
    { c: junC, r: 0.27, h: 0.46 },
  ];
  // blocked? the ray from the glass at P up to the light at L (height yl) passes through a robot (a disc of
  // height h): while the light is low every shadow runs off into the dark; as it rises they shrink home
  let yl = 0.13;
  const blocks = (px, pz, lx, lz, cx, cz, r, h) => {
    const dx = lx - px;
    const dz = lz - pz;
    const L2 = dx * dx + dz * dz;
    let k = ((cx - px) * dx + (cz - pz) * dz) / L2;
    if (k <= 0 || k >= 1 || k * yl > h) return false;
    const qx = px + dx * k - cx;
    const qz = pz + dz * k - cz;
    return qx * qx + qz * qz < r * r;
  };
  const lights = []; // { x, z, w }
  // Maya's shadow can be torn: pixels past the tear see her disc moved (a swing and a sideways jerk)
  const tear = { x: mayaC.x - 0.78, ang: 0, dz: 0, gap: 0 };
  const paint = (gain) => {
    let o = 0;
    const cosA = Math.cos(tear.ang);
    const sinA = Math.sin(tear.ang);
    for (let j = 0; j < CH; j++) {
      const pz = Z0 + BH - (j + 0.5) / PX;
      for (let i = 0; i < CW; i++) {
        const px = X0 + (i + 0.5) / PX;
        // where this pixel "sees" Maya from: past the tear, her shadow has been yanked
        let mx = mayaC.x;
        let mz = mayaC.z;
        if (px < tear.x && (tear.ang || tear.dz)) {
          // rotate the pixel back about the tear point instead of moving the shadow
          const rx = px - tear.x;
          const rz = pz - zb;
          const qx = tear.x + rx * cosA + rz * sinA;
          const qz = zb - rx * sinA + rz * cosA - tear.dz;
          mx += px - qx;
          mz += pz - qz;
        }
        let I = 0;
        for (const L of lights) {
          const dx = px - L.x;
          const dz = pz - L.z;
          const f = L.w / (1 + (dx * dx + dz * dz) * L.k);
          if (f < 0.004) continue;
          if (blocks(px, pz, L.x, L.z, mx, mz, occ[0].r, occ[0].h)) continue;
          if (blocks(px, pz, L.x, L.z, theoC.x, theoC.z, occ[1].r, occ[1].h)) continue;
          if (blocks(px, pz, L.x, L.z, junC.x, junC.z, occ[2].r, occ[2].h)) continue;
          I += f;
        }
        // the torn seam: a thin bright line across her shadow while it's ripped
        if (tear.gap > 0 && Math.abs(px - tear.x) < 0.035 && Math.abs(pz - zb) < 0.3) I += 0.9 * tear.gap;
        const v = Math.min(255, 255 * I * gain);
        data[o] = v;
        data[o + 1] = v;
        data[o + 2] = v;
        data[o + 3] = 255;
        o += 4;
      }
    }
    washTex.needsUpdate = true;
  };
  // the seam's warm sting (the damage) drawn as a thin bar of light
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.62), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a6b').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  seam.rotation.x = -Math.PI / 2;
  seam.position.set(tear.x, 0.01, zb);
  seam.renderOrder = 5;
  lab.add(seam);

  // the beam itself: a white core in a cold sleeve, its head a bright point
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beamSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: COLD.clone().multiplyScalar(1.6), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const b of [beamCore, beamSleeve]) {
    b.rotation.z = Math.PI / 2;
    b.renderOrder = 6;
    b.visible = false;
    lab.add(b);
  }
  const glowC = document.createElement('canvas');
  glowC.width = glowC.height = 64;
  const gg = glowC.getContext('2d');
  const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gg.fillStyle = grad;
  gg.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glowC);
  const spark = (s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: COLD.clone().multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(s);
    sp.renderOrder = 7;
    sp.visible = false;
    lab.add(sp);
    return sp;
  };
  const headSpark = spark(0.3);
  const muzzleSpark = spark(0.26);
  // the beam lights the robots' near sides (key and fill are out)
  const lampM = new THREE.PointLight(COLD, 0, 5, 1.2);
  const lampH = new THREE.PointLight(COLD, 0, 5, 1.2);
  const lampMid = new THREE.PointLight(COLD, 0, 5, 1.2);
  lab.add(lampM);
  lab.add(lampH);
  lab.add(lampMid);

  // ----- timing -----
  const T_FIRE = 0.16;
  const SPEED = 9; // the head's speed: slow enough to watch the shadows swing
  const T_HIT = T_FIRE + (muzzle.x - xHit) / SPEED;
  const T_OFF = 1.2; // the beam lets go; its light lingers and rises, and the shadows shrink home
  const T_UP = 1.26; // the room's light starts back
  const T_END = 2.05;

  // ----- the acting -----
  // the room: out in a breath with the shot, back up gently after
  const dark = K([[0, 0], [T_FIRE, 0], [T_FIRE + 0.2, 1, 'in'], [T_UP, 1], [T_UP + 0.5, 0, 'inOut']]);
  // Theo: charges (leans back, eye bright), fires and leans into it, cocks his head at the rip
  const tPitch = K([[0, 0], [T_FIRE - 0.02, -0.2, 'out'], [T_FIRE + 0.06, 0.12, 'out'], [T_OFF, 0.1], [T_OFF + 0.2, 0, 'inOut']]);
  const tSy = K([[0, 1], [T_FIRE - 0.02, 0.88, 'out'], [T_FIRE + 0.06, 1.06, 'out'], [T_FIRE + 0.25, 1, 'inOut']]);
  const tRoll = K([[0, 0], [T_HIT + 0.22, 0], [T_HIT + 0.38, -0.26, 'outBack'], [T_UP + 0.1, -0.26], [T_UP + 0.4, 0, 'inOut']]);
  const tEye = K([[0, 1], [T_FIRE - 0.02, 2.2, 'in'], [T_FIRE + 0.1, 1.2, 'out'], [T_OFF, 1.2], [T_OFF + 0.2, 1]]);
  // Jun: startles as the lights die, flinches at the rip, then peeks round at his own (double) shadow
  const jUp = K([[0, 0], [T_FIRE + 0.06, 0], [T_FIRE + 0.13, 0.07, 'out'], [T_FIRE + 0.24, 0, 'in']]);
  const jSy = K([[0, 1], [T_FIRE + 0.04, 1], [T_FIRE + 0.08, 0.86, 'out'], [T_FIRE + 0.14, 1.1, 'out'], [T_FIRE + 0.34, 1, 'inOut'], [T_HIT, 1], [T_HIT + 0.05, 0.84, 'out'], [T_HIT + 0.4, 1, 'outElastic']]);
  const jYaw = K([[0, 0], [T_HIT + 0.35, 0], [T_HIT + 0.6, 0.9, 'inOut'], [T_UP + 0.25, 0.9], [T_UP + 0.55, 0, 'inOut']]);
  const jPitch = K([[0, 0], [T_HIT + 0.35, 0], [T_HIT + 0.6, 0.18, 'inOut'], [T_UP + 0.25, 0.18], [T_UP + 0.5, 0, 'inOut']]);
  // Maya: perfectly still through the hit (that's the joke), then a slow look round at her shadow (to her right,
  // the west), back at us, and a snap double-take with a wide eye; at the end a small relieved settle
  const Q = T_HIT + 0.3;
  const mYaw = K([[0, 0], [Q, 0], [Q + 0.24, -0.85, 'inOut'], [Q + 0.38, -0.85], [Q + 0.5, 0, 'inOut'], [Q + 0.58, 0], [Q + 0.66, -1.15, 'outBack'], [T_UP + 0.25, -1.15], [T_UP + 0.5, -0.3, 'inOut'], [T_END - 0.08, 0, 'inOut']]);
  const mEyeS = K([[0, 1], [Q + 0.58, 1], [Q + 0.66, 1.7, 'outBack'], [T_UP + 0.25, 1.6], [T_UP + 0.45, 1, 'inOut']]);
  const mSy = K([[0, 1], [Q + 0.58, 1], [Q + 0.66, 1.08, 'out'], [T_UP + 0.4, 1.06], [T_UP + 0.52, 0.92, 'out'], [T_END - 0.05, 1, 'outElastic']]);
  const mPitch = K([[0, 0], [Q + 0.58, 0], [Q + 0.66, -0.12, 'out'], [T_UP + 0.4, -0.1], [T_UP + 0.52, 0.06, 'out'], [T_END - 0.05, 0, 'inOut']]);

  const T0 = lab.t;
  let fired = false;
  let hit = false;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    const dk = dark(t);
    setRoom(1 - dk);
    // every robot's ring and pool and own glow go dark; the eyes stay on, a little dimmer
    for (const a of all) Object.assign(a.st, { ring: 1 - dk, pool: 1 - dk, emis: 1 - dk, tag: 1 - 0.75 * dk, eye: 1 - 0.35 * dk });
    arena.topMat.emissiveIntensity *= 1 - 0.96 * dk;

    Object.assign(theo.st, { pitch: tPitch(t), sy: tSy(t), sx: 2 - tSy(t), sz: 2 - tSy(t), roll: tRoll(t) });
    theo.st.eye *= tEye(t);
    Object.assign(jun.st, { up: jUp(t), sy: jSy(t), sx: 1 + (1 - jSy(t)) * 0.6, sz: 1 + (1 - jSy(t)) * 0.6, yaw: jYaw(t), pitch: jPitch(t) });
    Object.assign(maya.st, { yaw: mYaw(t), eyeS: mEyeS(t), sy: mSy(t), sx: 1 + (1 - mSy(t)) * 0.7, sz: 1 + (1 - mSy(t)) * 0.7, pitch: mPitch(t) });

    // the beam: the head races west, the whole line lets go at T_OFF
    if (!fired && t >= T_FIRE) {
      fired = true;
      arena.emit('laser', { board: false, hit: true, src: 'b' });
    }
    const on = t >= T_FIRE ? 1 - win(t, T_OFF, T_OFF + 0.14) : 0;
    const linger = t >= T_FIRE ? 1 - lab.ease.in(win(t, T_OFF, T_OFF + 0.55)) : 0;
    yl = 0.13 + 2.2 * lab.ease.inOut(win(t, T_OFF, T_OFF + 0.5));
    const xHead = Math.max(xHit, muzzle.x - SPEED * Math.max(0, t - T_FIRE));
    const flare = t >= T_HIT ? Math.exp(-(t - T_HIT) / 0.12) : 0;
    const vis = on > 0.001;
    for (const b of [beamCore, beamSleeve]) {
      b.visible = vis;
      b.scale.y = Math.max(0.001, muzzle.x - xHead);
      b.position.set((muzzle.x + xHead) / 2, yb, zb);
    }
    beamCore.material.opacity = on;
    beamSleeve.material.opacity = 0.45 * on * (1 + flare);
    beamSleeve.scale.x = beamSleeve.scale.z = 1 + 0.8 * flare;
    headSpark.visible = muzzleSpark.visible = vis;
    headSpark.position.set(xHead, yb, zb);
    headSpark.scale.setScalar((0.28 + 0.4 * flare) * on);
    muzzleSpark.position.copy(muzzle);
    muzzleSpark.scale.setScalar(0.24 * on);

    // the lights the shadows are cast by: the muzzle, the head (or the impact), and the line between
    lights.length = 0;
    if (linger > 0.001) {
      const len = muzzle.x - xHead;
      lights.push({ x: muzzle.x - 0.02, z: zb, w: 0.6, k: 2.4 });
      lights.push({ x: xHead + 0.02, z: zb, w: 0.6 + 0.9 * flare, k: 2.4 });
      const n = Math.max(1, Math.round(len / 0.4));
      for (let i = 0; i < n; i++) lights.push({ x: xHead + (len * (i + 0.5)) / n, z: zb, w: (1.1 / n) * Math.min(1, len), k: 1.3 });
    }

    // the hit lands on her shadow: it rips and swings, while she stands still
    if (!hit && t >= T_HIT) {
      hit = true;
      arena.emit('damage', { id: 'a', n: 1, hw: 0 });
      lab.shake(0.012, 0.15);
    }
    const h = t - T_HIT;
    if (h >= 0) {
      const jerk = h < 0.05 ? lab.ease.out(h / 0.05) : Math.exp(-(h - 0.05) / 0.14) * Math.cos((h - 0.05) * 26);
      tear.ang = 0.32 * jerk;
      tear.dz = 0.1 * jerk;
      tear.gap = Math.max(0, 1 - h / 0.4);
      seam.material.opacity = Math.max(0, 1 - h / 0.3) * on;
      seam.rotation.z = -tear.ang * 0.5;
    }
    paint(linger * (0.55 + 0.3 * flare));
    washMat.opacity = 1;

    lampM.position.set(muzzle.x - 0.1, yb + 0.1, zb);
    lampH.position.set(xHead + 0.1, yb + 0.1, zb);
    lampMid.position.set((muzzle.x + xHead) / 2, yb + 0.15, zb + 0.15);
    lampM.intensity = 2.2 * on;
    lampH.intensity = (2.2 + 4 * flare) * on;
    lampMid.intensity = 2.5 * linger;
  });

  await lab.wait(T_END);
  stop();
  setRoom(1);
  for (const l of [lampM, lampH, lampMid]) l.intensity = 0;
  wash.visible = false;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
