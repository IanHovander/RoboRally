// Pile-up, acted. Theo fires like a man holding a fire hose; the head of the beam stops dead on Maya's flank and
// the rest of the light keeps coming, crumpling into a tall concertina of bright folds. Maya does a double-take
// at the pile, slurps it up like a noodle, sits there with her cheeks puffed, swallows, and hiccups once:
// a little hop and one bright blink.
export const meta = {
  title: 'Pile-up (the slurp)',
  idea:
    'Light gets weight: the head of Theo\'s beam stops dead against Maya and the rest of it piles up in bright folds like carriages into the buffers. Everyone acts it: Theo braces and fights the hose, then tilts his head at the mess; Jun cranes round to look; Maya looks, looks back at us, looks again wide-eyed, then slurps the whole heap in like a noodle, puffs up, swallows, and hiccups: one tiny hop and one bright blink.',
  notes:
    'Sound: a soft glass "tink" as the head stops, a rising crinkle of chimes while it piles (more chimes for a longer shot), a quick ascending slurp, a tiny low "gulp", and a high glass "hic" on the blink. Porting: the heap size is the arrived length (pour length minus range), so point-blank is a small pile and a cross-board shot a big one. Nobody leaves their space: all the acting is body lean, squash and the eye; the rings and pointers on the glass never move.',
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
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1, tint: null, tintK: 0, glow: 0, glowColor: null, ring: 1, pool: 1 };
  const tmp = new lab.THREE.Color();
  const base = m.paint.emissive.clone();
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
    if (st.glow > 0) {
      if (st.glowColor) model.paint.emissive.set(st.glowColor);
      model.paint.emissiveIntensity += st.glow;
    } else model.paint.emissive.copy(base);
    model.ringMat.opacity *= st.ring;
    model.poolMat.opacity *= st.pool;
  };
  const done = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    m.paint.emissive.copy(base);
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
    /** pts: Vector3[] (first N used); rad(i, N) gives each point's radius. */
    set(pts, N, rad) {
      N = Math.min(N, maxPts);
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
          pos[(i * radial + j) * 3] = tmp.x;
          pos[(i * radial + j) * 3 + 1] = tmp.y;
          pos[(i * radial + j) * 3 + 2] = tmp.z;
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
  const xf = lab.pos(1, 1).x + 0.33;
  const D = from.x - xf;

  // the hose: speed, when it fires, how long it pours (the heap is what arrives after the head stops)
  const V = 13;
  const T_FIRE = 0.2;
  const POUR = 0.62;
  const AMAX = V * POUR - D; // the length of light that ends up in the heap
  const T_ARRIVE = T_FIRE + D / V; // the head stops dead
  const T_TAILOUT = T_FIRE + POUR; // the tail leaves the muzzle
  const T_ALL = T_TAILOUT + D / V; // the tail is in
  const T_SLURP = 1.38;
  const SLURP = 0.2;
  const S1 = T_SLURP + SLURP; // gulped
  const T_HIC = S1 + 0.36; // the hiccup and the blink
  const T_END = 2.32;

  // the light: a white-hot core in a blue sleeve, a bright head, and a light on Maya's flank
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sleeveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.4), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const MAXP = 700;
  const core = lightTube(THREE, MAXP, 6, coreMat);
  const sleeve = lightTube(THREE, MAXP, 8, sleeveMat);
  core.mesh.renderOrder = 6;
  sleeve.mesh.renderOrder = 5;
  lab.add(sleeve.mesh);
  lab.add(core.mesh);
  const glowTex = glowTexture(THREE);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#dff1ff').multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  head.renderOrder = 7;
  lab.add(head);
  // the splat where the head stops dead: a flat ring of light pressed on her flank
  const splat = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f4ff').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  splat.rotation.y = Math.PI / 2;
  splat.position.set(xf + 0.01, yb, zb);
  lab.add(splat);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(BLUE).multiplyScalar(0.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(xf + 0.3, 0.012, zb);
  pool.renderOrder = 2;
  lab.add(pool);
  const lamp = new THREE.PointLight(new THREE.Color(BLUE).lerp(new THREE.Color('#ffffff'), 0.4), 0, 2.2, 1.5);
  lamp.position.set(xf + 0.25, 0.3, zb);
  lab.add(lamp);

  // ----- the heap: light u (0 = the head, at her flank) folded into tall zigzags and loops -----
  const H = 0.82; // the tallest the pile gets (the camera looks down at 50°, so it has to be tall to read as half a space)
  const FOLD = 0.95; // light per fold (up and down)
  const KAP = 0.12; // how far along the row each unit of light sits in the heap
  const heapPoint = (u, A, kap, slack, out) => {
    const behind = Math.max(0, A - u); // how much light is pressing on this bit
    const press = 1 - Math.exp(-behind / 1.0);
    const amp = H * press * slack * (0.82 + 0.18 * Math.sin(u * 1.7 + 0.4));
    const ph = (u / FOLD) * Math.PI * 2;
    // mostly sharp accordion folds (carriages riding up on each other), with the odd loop where it buckled
    const loopy = clamp01(-0.35 + 1.1 * Math.sin(u * 0.85 + 2.6));
    const tri = Math.abs(((ph / Math.PI + 1) % 2) - 1); // 0 at the bottom, 1 at the top
    const sm = 0.5 - 0.5 * Math.cos(ph);
    const wave = (1 - loopy) * tri + loopy * sm;
    const join = 1 - Math.exp(-behind / 0.3); // where it meets the incoming beam it's still straight
    out.set(
      xf + kap * u - loopy * amp * 0.5 * Math.sin(ph) - 0.05 * amp * tri,
      yb * (1 - join) + join * (0.035 + amp * wave),
      zb + 0.16 * press * slack * Math.sin(ph * 0.5 + 0.9) + 0.05 * Math.sin(u * 4.1),
    );
    return out;
  };
  const pts = [];
  for (let i = 0; i < MAXP; i++) pts.push(new THREE.Vector3());

  // ----- the acting -----
  // Theo: winds up, fires, fights the recoil like a hose, stumbles when it runs out, tilts his head at the mess,
  // and flinches back at the gulp.
  const tPitch = K([[0, 0], [0.13, -0.22, 'out'], [T_FIRE, 0.14, 'out'], [0.3, -0.1, 'out'], [T_TAILOUT, -0.12], [T_TAILOUT + 0.07, 0.22, 'out'], [1.12, 0, 'outBack'], [S1, 0], [S1 + 0.06, -0.18, 'out'], [S1 + 0.4, 0, 'inOut']]);
  const tSy = K([[0, 1], [0.13, 0.86, 'out'], [T_FIRE, 1.1, 'out'], [0.32, 1, 'inOut'], [S1, 1], [S1 + 0.06, 1.08, 'out'], [S1 + 0.35, 1, 'inOut']]);
  const tSx = K([[0, 1], [0.13, 1.08, 'out'], [T_FIRE, 0.95, 'out'], [0.32, 1, 'inOut']]);
  const tRoll = K([[0, 0], [1.05, 0], [1.22, 0.28, 'outBack'], [S1, 0.28], [S1 + 0.08, 0.04, 'out'], [S1 + 0.5, 0, 'inOut']]);
  // Jun: snaps round to look, cranes up as it piles, flinches at the gulp, shivers, turns back
  const jYaw = K([[0, 0], [T_ARRIVE + 0.04, 0], [T_ARRIVE + 0.2, 0.7, 'outBack'], [2.0, 0.7], [2.28, 0, 'inOut']]);
  const jPitch = K([[0, 0], [T_ARRIVE + 0.2, 0], [1.15, -0.14], [S1, -0.12], [S1 + 0.06, -0.3, 'out'], [2.1, 0, 'inOut']]);
  const jSy = K([[0, 1], [T_ARRIVE + 0.2, 1], [1.1, 1.14], [S1, 1.12], [S1 + 0.06, 0.8, 'out'], [2.05, 1, 'outElastic']]);
  const jSx = K([[0, 1], [T_ARRIVE + 0.2, 1], [1.1, 0.94], [S1, 0.95], [S1 + 0.06, 1.14, 'out'], [2.05, 1, 'outElastic']]);
  // Maya: jolt, glance at the pile, back at us, look again (wide-eyed), lean in, slurp, puff, swallow, hiccup
  const A0 = T_ARRIVE;
  const mRoll = K([[0, 0], [A0, 0], [A0 + 0.05, 0.18, 'out'], [A0 + 0.3, 0, 'outElastic'], [T_SLURP - 0.12, 0], [T_SLURP - 0.02, -0.2, 'out'], [S1, -0.12], [S1 + 0.1, 0.04, 'out'], [S1 + 0.3, 0, 'inOut']]);
  const mYaw = K([[0, 0], [A0 + 0.1, 0], [A0 + 0.18, 0.55, 'out'], [A0 + 0.28, 0.55], [A0 + 0.36, 0, 'inOut'], [A0 + 0.46, 0], [A0 + 0.56, 0.95, 'outBack'], [S1 + 0.04, 0.95], [S1 + 0.22, 0, 'inOut']]);
  const mPitch = K([[0, 0], [A0 + 0.46, 0], [A0 + 0.56, -0.16, 'out'], [T_SLURP - 0.04, -0.12], [T_SLURP + 0.04, 0.03, 'out'], [S1, 0.02], [S1 + 0.12, -0.06, 'out'], [S1 + 0.4, 0, 'inOut']]);
  const mSx = K([[0, 1], [A0, 1], [A0 + 0.05, 0.9, 'out'], [A0 + 0.3, 1, 'outElastic'], [T_SLURP, 1], [T_SLURP + 0.08, 0.9, 'out'], [S1, 0.9], [S1 + 0.07, 1.28, 'outBack'], [S1 + 0.22, 1.25], [S1 + 0.3, 0.92, 'inOut'], [T_HIC - 0.02, 1.02, 'out'], [T_HIC + 0.05, 0.94, 'out'], [T_HIC + 0.3, 1, 'outElastic']]);
  const mSy = K([[0, 1], [T_SLURP, 1], [T_SLURP + 0.08, 1.1, 'out'], [S1, 1.1], [S1 + 0.07, 0.86, 'outBack'], [S1 + 0.22, 0.88], [S1 + 0.3, 1.1, 'inOut'], [T_HIC - 0.02, 0.96, 'out'], [T_HIC + 0.05, 1.12, 'out'], [T_HIC + 0.3, 1, 'outElastic']]);
  const mUp = K([[0, 0], [T_HIC - 0.02, 0], [T_HIC + 0.06, 0.09, 'out'], [T_HIC + 0.17, 0, 'in']]);
  const mEyeS = K([[0, 1], [A0 + 0.46, 1], [A0 + 0.56, 1.7, 'outBack'], [T_SLURP, 1.7], [T_SLURP + 0.05, 0.5, 'out'], [S1 + 0.05, 0.5], [S1 + 0.15, 1.1, 'out'], [T_HIC - 0.02, 1.1], [T_HIC + 0.03, 1.5, 'out'], [T_HIC + 0.3, 1, 'out']]);
  const mEye = K([[0, 1], [T_HIC - 0.05, 1], [T_HIC - 0.02, 0.08, 'out'], [T_HIC + 0.02, 4.4, 'out'], [T_HIC + 0.32, 1, 'out']]);
  const mTint = K([[0, 0], [T_HIC - 0.02, 0], [T_HIC + 0.02, 1, 'out'], [T_HIC + 0.34, 0, 'in']]);
  const mGlow = K([[0, 0], [S1 - 0.02, 0], [S1 + 0.05, 0.1, 'out'], [S1 + 0.22, 0, 'out']]);
  maya.st.tint = BLUE;
  maya.st.glowColor = new THREE.Color(BLUE);

  const T0 = lab.t;
  let fired = false;
  let hit = false;
  let gulped = false;
  const muz = new THREE.Vector3();
  const stop = lab.every(() => {
    const t = lab.t - T0;
    // the actors
    Object.assign(theo.st, { pitch: tPitch(t), sy: tSy(t), sx: tSx(t), sz: tSx(t), roll: tRoll(t), eye: t > T_FIRE && t < T_TAILOUT ? 1.6 : 1 });
    if (t > T_FIRE + 0.03 && t < T_TAILOUT) {
      // the hose fights him: a fast shudder that he slowly gets under control
      const k = 1 - 0.6 * win(t, T_FIRE, T_TAILOUT);
      theo.st.roll += 0.05 * Math.sin(t * 77) * k;
      theo.st.yaw = 0.035 * Math.sin(t * 53 + 1) * k;
    } else theo.st.yaw = 0;
    Object.assign(jun.st, { yaw: jYaw(t), pitch: jPitch(t), sy: jSy(t), sx: jSx(t), sz: jSx(t) });
    const shiver = win(t, S1 + 0.1, S1 + 0.16) * (1 - win(t, S1 + 0.2, S1 + 0.5));
    jun.st.roll = 0.07 * Math.sin(t * 60) * shiver;
    Object.assign(maya.st, { roll: mRoll(t), yaw: mYaw(t), pitch: mPitch(t), sx: mSx(t), sz: mSx(t), sy: mSy(t), up: mUp(t), eyeS: mEyeS(t), eye: mEye(t), tintK: mTint(t), glow: mGlow(t) });
    // while the heap presses on her she leans away from it a little (it has weight)
    const sk = win(t, T_SLURP, T_SLURP + SLURP);

    // the light
    if (!fired && t >= T_FIRE) {
      fired = true;
      lab.arena.emit('laser', { board: false, hit: true, src: 'b' });
    }
    if (!hit && t >= T_ARRIVE) {
      hit = true;
      lab.arena.emit('damage', { id: 'a', n: 1, hw: 0 });
    }
    if (!gulped && t >= S1) {
      gulped = true;
    }
    theo.m.muzzle.updateWorldMatrix(true, false);
    muz.setFromMatrixPosition(theo.m.muzzle.matrixWorld);
    const sHead = V * (t - T_FIRE);
    const sTail = Math.max(0, V * (t - T_TAILOUT));
    const A = Math.max(0, Math.min(AMAX, sHead - D));
    // once the tail is in, the heap concertinas: squeezes tight, then springs back a little
    const after = t - T_ALL;
    let kap = KAP;
    if (after > 0) kap = KAP * (1 - 0.4 * Math.min(1, after / 0.06) + 0.3 * lab.ease.outElastic(win(after, 0.06, 0.4)));
    // the slurp: the heap runs along its own folds into her, pulled taut as it goes
    const S = AMAX * lab.ease.in(sk);
    const slack = 1 - 0.6 * sk;
    let n = 0;
    if (t >= T_FIRE && sk < 1) {
      // the straight run from the muzzle (or from the tail) to the heap's front
      const xTail = Math.min(muz.x, from.x) - sTail;
      const xFront = A > 0 ? xf + kap * A - kap * S : from.x - sHead;
      if (xTail > xFront + 0.01 && t < T_SLURP) {
        const steps = Math.max(2, Math.ceil((xTail - xFront) / 0.12));
        for (let i = 0; i <= steps; i++) {
          const x = xTail + (xFront - xTail) * (i / steps);
          // once the hose stops pushing, the last of it crinkles as it runs in
          const crinkle = sTail > 0 ? 0.06 * Math.sin((x - xTail) * 24) * Math.min(1, (x - xTail) * 3) : 0;
          pts[n++].set(x, (i === 0 && sTail === 0 ? muz.y : yb) + crinkle, zb);
        }
      }
      // the heap, from its front to her flank
      if (A > 0) {
        const step = 0.02;
        for (let u = A; u > S && n < MAXP - 2; u -= step) heapPoint(u, A, kap, slack, pts[n++]).x -= kap * S;
        heapPoint(S, A, kap, slack, pts[n++]).x -= kap * S;
      }
    }
    const fat = A === 0 ? 1.5 : 1;
    core.set(pts, n, (i, N) => (i === N - 1 ? 0.016 * fat : 0.016));
    sleeve.set(pts, n, () => 0.04);
    coreMat.opacity = sk < 0.85 ? 1 : 1 - (sk - 0.85) / 0.15;
    sleeveMat.opacity = 0.32 * coreMat.opacity;

    // the racing head, and its splat when it stops dead
    if (t >= T_FIRE && t < T_ARRIVE + 0.14) {
      head.visible = true;
      const hx = Math.max(xf, from.x - sHead);
      const stopK = win(t, T_ARRIVE, T_ARRIVE + 0.14);
      head.position.set(hx + 0.02, yb, zb);
      head.scale.set(0.32 * (1 - 0.7 * Math.min(1, stopK * 4)), 0.32 * (1 + 0.8 * Math.min(1, stopK * 2)), 1);
      head.material.opacity = 1 - stopK;
    } else head.visible = false;
    const sp = win(t, T_ARRIVE, T_ARRIVE + 0.22);
    splat.scale.setScalar(0.04 + 0.2 * lab.ease.out(sp));
    splat.material.opacity = t >= T_ARRIVE ? 1 - sp : 0;

    // the heap lights the glass and her flank
    const size = Math.max(0, A - S) / AMAX;
    pool.scale.set(0.5 + 1.1 * size, 0.6 + 0.4 * size, 1);
    pool.position.x = xf + (kap * (A - S)) / 2;
    pool.material.opacity = 0.55 * size;
    lamp.intensity = 1.4 * size;
  });

  await lab.wait(T_END);
  stop();
  core.set(pts, 0, () => 0);
  sleeve.set(pts, 0, () => 0);
  head.visible = false;
  pool.visible = false;
  lamp.intensity = 0;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
