// Pile-up, acted. Theo fires like a man holding a fire hose; the beam's head stops dead on Maya's flank and
// the rest of the light keeps coming, crumpling into a heap of bright folds. Maya does a double-take at the
// pile, then slurps it up like a noodle, sits there with her cheeks puffed, swallows, and blinks Theo-blue.
export const meta = {
  title: 'Pile-up (the slurp)',
  idea:
    'Light gets weight: the head of Theo\'s beam stops dead against Maya and the rest of it piles up in bright folds like carriages into the buffers. Everyone acts it: Theo braces and fights the recoil like a hose, then tilts his head at the mess; Jun cranes to look; Maya looks, looks away, looks again, then slurps the whole heap in like a noodle, puffs up, swallows, and her eye blinks once in Theo\'s blue.',
  notes:
    'Sound: a soft glass "tink" as the head stops, a rising crinkle of chimes while it piles (more chimes for a longer shot), a quick ascending slurp, a tiny low "gulp", and a high glass ping on the blue blink. Porting: the heap size is the arrived length (shot length minus distance), so point-blank is a small pile and a cross-board shot a big one. Nobody leaves their space: all the acting is body lean, squash and the eye; the pointers on the glass never move.',
};

// ---------- small acting toolkit (kept in this file so the entry stands alone) ----------

/** A keyframed channel: [[t, value], [t, value, easeName], ...] -> f(t). */
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
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1, tint: null, tintK: 0, glow: 0, ring: 1, pool: 1 };
  const tmp = new lab.THREE.Color();
  m.body.rotation.order = 'YXZ';
  p.each = (model) => {
    const b = model.body;
    b.rotation.set(-st.pitch, st.yaw, -st.roll);
    b.scale.set(st.sx, st.sy, st.sz);
    b.position.y += st.up;
    for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(st.eyeS);
    const e = st.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    if (st.tint && st.tintK > 0) model.eyeMat.color.lerp(tmp.set(st.tint).multiplyScalar(3.2 * e), st.tintK);
    if (st.glow > 0) model.paint.emissiveIntensity += st.glow;
    model.ringMat.opacity *= st.ring;
    model.poolMat.opacity *= st.pool;
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

/** A tube of light along a polyline, rebuilt every frame (parallel-transport frames, fixed buffers). */
function lightTube(THREE, maxPts, radial, material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxPts * radial * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < maxPts - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, a + radial, b, b, a + radial, b + radial);
    }
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const t = new THREE.Vector3();
  const n = new THREE.Vector3(0, 1, 0);
  const bn = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  return {
    mesh,
    /** pts: Vector3[]; rad(i) gives each point's radius. */
    set(pts, rad) {
      const N = Math.min(pts.length, maxPts);
      if (N < 2) return geo.setDrawRange(0, 0);
      n.set(0, 1, 0);
      for (let i = 0; i < N; i++) {
        const a = pts[Math.max(0, i - 1)];
        const c = pts[Math.min(N - 1, i + 1)];
        t.subVectors(c, a);
        if (t.lengthSq() < 1e-10) t.set(1, 0, 0);
        t.normalize();
        n.addScaledVector(t, -n.dot(t));
        if (n.lengthSq() < 1e-6) n.set(0, 0, 1).addScaledVector(t, -t.z);
        n.normalize();
        bn.crossVectors(t, n);
        const r = rad(i, N);
        for (let j = 0; j < radial; j++) {
          const ang = (j / radial) * Math.PI * 2;
          tmp.copy(pts[i]).addScaledVector(n, Math.cos(ang) * r).addScaledVector(bn, Math.sin(ang) * r);
          pos.set([tmp.x, tmp.y, tmp.z], (i * radial + j) * 3);
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, (N - 1) * radial * 6);
    },
  };
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,.6)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE } = lab;
  const K = (list) => track(lab, list);
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const BLUE = lab.bot('b').color;

  // where the light leaves Theo and where it meets Maya's flank
  theo.m.muzzle.updateWorldMatrix(true, false);
  const from = new THREE.Vector3().setFromMatrixPosition(theo.m.muzzle.matrixWorld);
  const yb = from.y;
  const zb = from.z;
  const xf = lab.pos(1, 1).x + 0.34;
  const D = from.x - xf;

  // the hose: speed, when it fires, how long it pours
  const V = 11;
  const T_FIRE = 0.18;
  const POUR = 0.6;
  const AMAX = V * POUR - D; // the length of light that ends up in the heap
  const T_ARRIVE = T_FIRE + D / V; // the head stops dead
  const T_ALL = T_FIRE + POUR + D / V; // the tail is in
  const T_SLURP = 1.32;
  const SLURP = 0.2;
  const T_END = 2.2;

  // the light: a white-hot core in a blue sleeve, a bright head, a pool on the glass, a light on Maya
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sleeveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.5), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = lightTube(THREE, 420, 6, coreMat);
  const sleeve = lightTube(THREE, 420, 8, sleeveMat);
  core.mesh.renderOrder = 6;
  sleeve.mesh.renderOrder = 5;
  lab.add(sleeve.mesh);
  lab.add(core.mesh);
  const glowTex = glowTexture(THREE);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#dff1ff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  head.renderOrder = 7;
  lab.add(head);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(BLUE).multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(xf + 0.2, 0.01, zb);
  pool.renderOrder = 2;
  lab.add(pool);
  const lamp = new THREE.PointLight(new THREE.Color(BLUE).lerp(new THREE.Color('#ffffff'), 0.4), 0, 2.2, 1.5);
  lamp.position.set(xf + 0.2, 0.25, zb);
  lab.add(lamp);

  // ----- the heap: material u (0 = the head, at her flank) folded into loops and zigzags -----
  const FOLD = 0.4; // light per fold
  const H = 0.46; // the tallest the pile gets
  const heapPoint = (u, A, kap, slack, out) => {
    const behind = Math.max(0, A - u); // how much light is pressing on this bit
    const press = 1 - Math.exp(-behind / 1.0);
    const amp = H * press * slack;
    const ph = (u / FOLD) * Math.PI * 2;
    // half the folds loop over, half zigzag, so it reads as a crumpled tangle rather than a spring
    const loopy = 0.5 + 0.5 * Math.sin(u * 2.1 + 0.6);
    const zig = Math.abs(((ph / Math.PI) % 2) - 1); // 1..0..1 triangle
    const wave = (1 - loopy) * zig + loopy * (0.5 + 0.5 * Math.cos(ph));
    const join = 1 - Math.exp(-behind / 0.35); // where it meets the incoming beam it's still straight
    out.set(
      xf + kap * u + loopy * amp * 0.34 * Math.sin(ph) + 0.015 * Math.sin(ph * 2.7) * press,
      yb * (1 - join) + join * (0.03 + amp * (1 - wave)),
      zb + 0.13 * press * slack * Math.sin(ph * 0.5 + 0.9) + 0.05 * Math.sin(ph * 1.3),
    );
    return out;
  };
  const pts = [];
  for (let i = 0; i < 420; i++) pts.push(new THREE.Vector3());

  // ----- the acting -----
  // Theo: brace, fire, fight the recoil like a hose, stumble when it runs out, then tilt his head at the mess
  const tPitch = K([[0, 0], [0.14, -0.2, 'out'], [0.2, 0.16, 'out'], [0.3, -0.08, 'out'], [T_FIRE + POUR, -0.1], [T_FIRE + POUR + 0.07, 0.2, 'out'], [1.08, 0, 'outBack'], [1.52, 0], [1.58, -0.16, 'out'], [1.95, 0, 'inOut']]);
  const tSy = K([[0, 1], [0.14, 0.86, 'out'], [0.2, 1.1, 'out'], [0.32, 1, 'inOut'], [1.52, 1], [1.58, 1.08, 'out'], [1.9, 1, 'inOut']]);
  const tSx = K([[0, 1], [0.14, 1.08, 'out'], [0.2, 0.95, 'out'], [0.32, 1, 'inOut']]);
  const tRoll = K([[0, 0], [1.0, 0], [1.2, 0.26, 'outBack'], [1.5, 0.26], [1.6, 0.05, 'out'], [1.95, 0, 'inOut']]);
  // Jun: snaps round to look, cranes up as it piles, flinches at the gulp, shivers, turns back
  const jYaw = K([[0, 0], [T_ARRIVE + 0.04, 0], [T_ARRIVE + 0.2, 0.72, 'outBack'], [1.92, 0.72], [2.16, 0, 'inOut']]);
  const jPitch = K([[0, 0], [T_ARRIVE + 0.2, 0], [1.1, -0.12], [T_SLURP + SLURP, -0.1], [T_SLURP + SLURP + 0.06, -0.3, 'out'], [2.0, 0, 'inOut']]);
  const jSy = K([[0, 1], [T_ARRIVE + 0.2, 1], [1.0, 1.12], [T_SLURP + SLURP, 1.1], [T_SLURP + SLURP + 0.06, 0.8, 'out'], [1.95, 1, 'outElastic']]);
  const jSx = K([[0, 1], [T_ARRIVE + 0.2, 1], [1.0, 0.94], [T_SLURP + SLURP, 0.95], [T_SLURP + SLURP + 0.06, 1.14, 'out'], [1.95, 1, 'outElastic']]);
  // Maya: jolt, glance, look away, look back (wide-eyed), slurp it up, puff, swallow, blink blue
  const A0 = T_ARRIVE;
  const S1 = T_SLURP + SLURP;
  const mRoll = K([[0, 0], [A0, 0], [A0 + 0.05, 0.16, 'out'], [A0 + 0.32, 0, 'outElastic']]);
  const mYaw = K([[0, 0], [A0 + 0.08, 0], [A0 + 0.16, 0.4, 'out'], [A0 + 0.24, 0.4], [A0 + 0.34, 0, 'inOut'], [A0 + 0.42, 0], [A0 + 0.54, 0.8, 'outBack'], [S1 + 0.03, 0.8], [S1 + 0.2, 0, 'inOut']]);
  const mPitch = K([[0, 0], [A0 + 0.42, 0], [A0 + 0.54, -0.14, 'out'], [T_SLURP - 0.04, -0.12], [T_SLURP + 0.04, 0.16, 'out'], [S1, 0.12], [S1 + 0.12, -0.05, 'out'], [S1 + 0.4, 0, 'inOut']]);
  const mSx = K([[0, 1], [A0, 1], [A0 + 0.05, 0.9, 'out'], [A0 + 0.3, 1, 'outElastic'], [T_SLURP, 1], [T_SLURP + 0.08, 0.9, 'out'], [S1, 0.9], [S1 + 0.08, 1.26, 'outBack'], [S1 + 0.28, 1.24], [S1 + 0.36, 0.94, 'inOut'], [S1 + 0.62, 1, 'outElastic']]);
  const mSy = K([[0, 1], [T_SLURP, 1], [T_SLURP + 0.08, 1.1, 'out'], [S1, 1.1], [S1 + 0.08, 0.88, 'outBack'], [S1 + 0.28, 0.9], [S1 + 0.36, 1.12, 'inOut'], [S1 + 0.62, 1, 'outElastic']]);
  const mEyeS = K([[0, 1], [A0 + 0.42, 1], [A0 + 0.54, 1.6, 'outBack'], [T_SLURP, 1.6], [T_SLURP + 0.05, 0.5, 'out'], [S1 + 0.05, 0.5], [S1 + 0.15, 1.15, 'out'], [S1 + 0.5, 1.15], [S1 + 0.56, 1, 'out']]);
  const T_BLINK = S1 + 0.52;
  const mEye = K([[0, 1], [T_BLINK - 0.04, 1], [T_BLINK - 0.01, 0.1, 'out'], [T_BLINK + 0.03, 4.2, 'out'], [T_BLINK + 0.26, 1, 'out']]);
  const mTint = K([[0, 0], [T_BLINK - 0.01, 0], [T_BLINK + 0.03, 1, 'out'], [T_BLINK + 0.3, 0, 'in']]);
  const mGlow = K([[0, 0], [S1, 0], [S1 + 0.06, 0.5, 'out'], [S1 + 0.45, 0.15], [T_BLINK + 0.3, 0, 'out']]);
  maya.st.tint = BLUE;

  const T0 = lab.t;
  let fired = false;
  let hit = false;
  const tmpTheo = new THREE.Vector3();
  const stop = lab.every(() => {
    const t = lab.t - T0;
    // the actors
    Object.assign(theo.st, { pitch: tPitch(t), sy: tSy(t), sx: tSx(t), sz: tSx(t), roll: tRoll(t), eye: t > T_FIRE && t < T_FIRE + POUR ? 1.5 : 1 });
    if (t > T_FIRE + 0.04 && t < T_FIRE + POUR) {
      // the hose fights him: a fast shudder
      theo.st.roll += 0.045 * Math.sin(t * 77) * (1 - 0.5 * win(t, T_FIRE, T_FIRE + POUR));
      theo.st.yaw = 0.03 * Math.sin(t * 53 + 1);
    } else theo.st.yaw = 0;
    Object.assign(jun.st, { yaw: jYaw(t), pitch: jPitch(t), sy: jSy(t), sx: jSx(t), sz: jSx(t), eyeS: 1 + 0.3 * win(t, A0, A0 + 0.2) * (1 - win(t, 1.95, 2.1)) });
    const shiver = win(t, S1 + 0.1, S1 + 0.16) * (1 - win(t, S1 + 0.2, S1 + 0.5));
    jun.st.roll = 0.07 * Math.sin(t * 60) * shiver;
    Object.assign(maya.st, { roll: mRoll(t), yaw: mYaw(t), pitch: mPitch(t), sx: mSx(t), sz: mSx(t), sy: mSy(t), eyeS: mEyeS(t), eye: mEye(t), tintK: mTint(t), glow: mGlow(t) });

    // the light
    if (!fired && t >= T_FIRE) {
      fired = true;
      lab.arena.emit('laser', { board: false, hit: true, src: 'b' });
    }
    if (!hit && t >= T_ARRIVE) {
      hit = true;
      lab.arena.emit('damage', { id: 'a', n: 1, hw: 0 });
    }
    theo.m.muzzle.updateWorldMatrix(true, false);
    tmpTheo.setFromMatrixPosition(theo.m.muzzle.matrixWorld);
    const mx = tmpTheo.x;
    const sHead = V * (t - T_FIRE);
    const sTail = Math.max(0, V * (t - T_FIRE - POUR));
    let A = Math.max(0, Math.min(AMAX, sHead - D));
    // after the tail is in, the heap concertinas: squeezes tight, then springs back a little
    const after = t - T_ALL;
    let kap = 0.12;
    if (after > 0) kap = 0.12 * (1 - 0.45 * Math.min(1, after / 0.07) + 0.3 * lab.ease.outElastic(Math.min(1, Math.max(0, (after - 0.07) / 0.35))));
    // the slurp: the heap runs along its own folds into her
    const sk = win(t, T_SLURP, T_SLURP + SLURP);
    const S = AMAX * lab.ease.in3(sk);
    const slack = 1 - 0.55 * sk; // pulled taut as it goes in
    let n = 0;
    if (t >= T_FIRE && sk < 1) {
      // the straight run from the muzzle (or the tail) to the heap's front
      const xTail = Math.min(mx, from.x) - sTail;
      const xFront = A > 0 ? xf + kap * (A - S) : from.x - sHead;
      if (xTail > xFront + 0.01 && t < T_SLURP) {
        const steps = Math.max(2, Math.ceil((xTail - xFront) / 0.2));
        for (let i = 0; i <= steps; i++) {
          const x = xTail + (xFront - xTail) * (i / steps);
          // once the hose stops pushing, the last of it crinkles as it runs in
          const crinkle = sTail > 0 ? 0.05 * Math.sin((x - xTail) * 26) * Math.min(1, (x - xTail) * 3) : 0;
          pts[n++].set(x, (i === 0 ? tmpTheo.y : yb) + crinkle, zb);
        }
      }
      // the heap, from its front to her flank
      if (A > 0) {
        const Ar = A - S;
        const step = 0.022;
        for (let u = Ar; u >= 0 && n < 418; u -= step) heapPoint(u + S, A, kap, slack, pts[n++]).x -= kap * S;
        heapPoint(S, A, kap, slack, pts[n++]).x -= kap * S;
      }
    }
    const thick = (i, N) => (i === N - 1 && A === 0 ? 1.6 : 1);
    core.set(pts.slice(0, n), (i, N) => 0.012 * thick(i, N));
    sleeve.set(pts.slice(0, n), (i, N) => 0.045 * thick(i, N));
    // fading only at the very end of the slurp
    coreMat.opacity = sk < 0.85 ? 1 : 1 - (sk - 0.85) / 0.15;
    sleeveMat.opacity = 0.42 * coreMat.opacity;

    // the racing head, and its splat when it stops dead
    if (t >= T_FIRE && t < T_ARRIVE + 0.16) {
      head.visible = true;
      const hx = Math.max(xf, from.x - sHead);
      const stopK = win(t, T_ARRIVE, T_ARRIVE + 0.16);
      head.position.set(hx + 0.02, yb, zb);
      head.scale.set(0.34 * (1 - 0.7 * Math.min(1, stopK * 4)), 0.34 * (1 + 0.9 * Math.sin(Math.min(1, stopK * 2) * Math.PI * 0.5)), 1);
      head.material.opacity = 1 - stopK;
    } else head.visible = false;

    // the heap lights the glass and her flank
    const size = (A - S) / AMAX;
    pool.scale.setScalar(0.5 + 0.9 * size);
    pool.position.x = xf + 0.15 + kap * (A - S) * 0.5;
    pool.material.opacity = 0.9 * size * (t < T_SLURP + SLURP ? 1 : 0);
    lamp.intensity = 1.6 * size;
  });

  await lab.wait(T_END);
  stop();
  core.set([], () => 0);
  sleeve.set([], () => 0);
  head.visible = false;
  pool.visible = false;
  lamp.intensity = 0;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
