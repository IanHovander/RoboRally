// Raft, staged as a long exposure of a seesaw. The camera holds still, so the frame is the horizon: the slab
// dips under Maya as she drives east, the light it spills on the floor below slides downhill, and at the rim
// time slows while the tilt tips her off. The instant she is gone, time snaps back and the slab springs up past
// level; its glowing outline strobes as it bobs, leaving a fan of fading outlines pivoting on the centre, like
// a long-exposure photograph of a seesaw, while Ava rocks like a seasick passenger and finally steadies.
export const meta = {
  title: 'Raft (long-exposure bob)',
  idea:
    'The floating slab is a raft: it dips under her weight as she drives east, the board\'s light sliding downhill on the floor below. At the rim time slows and the tilt tips her off. Then it snaps back: the slab springs past level and bobs, its glowing outline strobing into a fan of fading lines pivoting on the centre, while Ava sloshes on her space like a seasick passenger before she steadies, facing north again.',
  notes:
    'Sound: a low creak of glass as it dips, a hush in the slow motion, a deep glassy "thunk" on the springback and a soft wobble tone that fades with the bobs. The tilt is a damped spring driven by where her weight is, so it scales with how far from the centre she leaves (a robot leaving a north or south edge would tip it the other way). Ported: rotate the board, fxGroup and the robots on it together; the outline strobes are a few thin boxes.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const LIGHT = new THREE.Color(lab.PALETTE.light);
  const ROW = 1;
  const W = (x, lift = 0) => lab.pos(x, ROW).setY(lift);
  const course = A.course;

  const rtween = (dur, fn, ez = ease.inOut) =>
    new Promise((ok) => {
      const t0 = lab.real;
      fn(ez(0), 0);
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(ez(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });

  // ---------- the camera: still (it is the horizon); a breath closer while she tips it, then home ----------
  const c0 = A.camCur;
  const base = { target: c0.tgt.clone(), az: c0.az, el: c0.el, dist: c0.d, sx: c0.sx, sy: c0.sy };
  const cam = { target: base.target.clone(), az: base.az, el: base.el, dist: base.dist, sx: base.sx, sy: base.sy };
  const blend = (a, b, e) => {
    cam.target.copy(a.target).lerp(b.target, e);
    for (const k of ['az', 'el', 'dist', 'sx', 'sy']) cam[k] = a[k] + (b[k] - a[k]) * e;
  };
  const snapCam = () => ({ ...cam, target: cam.target.clone() });
  const releaseCam = lab.camera(() => {
    const k = Math.min(1, Math.min(A.dt, 0.1) * 4);
    if (A.camCur && k < 1) {
      A.camCur.sx = cam.sx / (1 - k);
      A.camCur.sy = cam.sy / (1 - k);
    }
    return { target: cam.target.clone(), az: cam.az, el: cam.el, dist: cam.dist };
  });

  // ---------- the raft: a damped spring driven by where her weight is ----------
  const T = { th: 0, v: 0, target: 0, w: 2 * Math.PI * 1.35, z: 0.17, settle: 1 };
  const spill0 = A.spill.position.clone();
  const tilt = (th) => {
    A.board.rotation.z = -th;
    A.fxGroup.rotation.z = -th;
    A.spill.position.x = spill0.x + 7 * Math.sin(th); // the light it spills below slides downhill
  };
  lab.cleanup(() => {
    A.board.rotation.z = 0;
    A.fxGroup.rotation.z = 0;
    A.spill.position.copy(spill0);
  });
  const stopRaft = lab.every((dt) => {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const acc = -T.w * T.w * (T.th - T.target) - 2 * T.z * T.w * T.v;
      T.v += acc * h;
      T.th += T.v * h;
    }
    tilt(T.th * T.settle);
  });
  // a point riding on the board: rotate around the board's centre line
  const ride = (g) => {
    const c = Math.cos(T.th * T.settle);
    const s = Math.sin(T.th * T.settle);
    const x = g.position.x;
    const y = g.position.y;
    g.position.x = x * c + y * s;
    g.position.y = -x * s + y * c;
  };

  // ---------- the strobe: the slab's glowing outline, left behind in light as it bobs ----------
  const barMat = () => new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bw = course.w;
  const bh = course.h;
  const barX = new THREE.BoxGeometry(bw, 0.025, 0.025);
  const barZ = new THREE.BoxGeometry(0.025, 0.025, bh);
  lab.cleanup(() => {
    barX.dispose();
    barZ.dispose();
  });
  const strobes = [];
  const strobe = () => {
    const g = new THREE.Group();
    const mat = barMat();
    for (const [geo, x, z] of [[barX, 0, -bh / 2], [barX, 0, bh / 2], [barZ, -bw / 2, 0], [barZ, bw / 2, 0]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 0.01, z);
      g.add(m);
    }
    g.rotation.z = -T.th * T.settle;
    lab.add(g);
    lab.cleanup(() => mat.dispose());
    strobes.push({ g, mat, t0: lab.t, peak: Math.min(0.6, 0.12 + Math.abs(T.v) * 0.9) });
  };
  const stopStrobes = lab.every(() => {
    for (const s of strobes) {
      const k = (lab.t - s.t0) / 0.6;
      s.mat.opacity = k >= 1 ? 0 : s.peak * (1 - k) ** 1.6;
      s.g.visible = k < 1;
    }
  });

  // ---------- the cast ----------
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  const east = lab.facing(1);
  const north = lab.facing(0);
  const M = { attached: true, card: 1, pool: 1, glow: 1 };
  maya.each = (model) => {
    if (M.attached) {
      ride(maya.group);
      maya.group.rotation.x = -(maya.pose.pitch + T.th * T.settle); // facing east, the tilt is a forward lean
    }
    model.poolMat.opacity *= M.pool;
    model.eyeMat.color.multiplyScalar(M.glow);
    model.ringMat.opacity *= M.glow;
    if (mb.card) mb.card.material.opacity *= M.card;
  };
  // Ava: a passenger. Her body lags behind the slab and overshoots; her ring of light sloshes on the glass.
  const am = ava.model;
  const sloshParts = ava.group.children.filter((o) => o.isMesh && (o.material === am.ringMat || o.material === am.poolMat));
  const sloshHome = sloshParts.map((o) => o.position.clone());
  lab.cleanup(() => sloshParts.forEach((o, i) => o.position.copy(sloshHome[i])));
  const P = { lag: 0, lagV: 0, slosh: 0, sloshV: 0, wob: 0, tv: 0 };
  ava.set({ x: 2, y: 3, rot: north });
  ava.each = () => {
    ride(ava.group);
    const th = T.th * T.settle;
    ava.group.rotation.z = -(th + P.lag * 2.2); // facing north, the tilt is a lean to the right
    ava.group.rotation.y = north + P.wob;
    sloshParts.forEach((o, i) => (o.position.x = sloshHome[i].x + P.slosh));
  };
  const stopAva = lab.every((dt) => {
    // her body is a pendulum hung on the slab: it lags the tilt and swings past it; her ring is a looser one
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const drive = -(T.v - P.tv) / h; // the slab's angular acceleration (all of it lands in the first sub-step)
      P.tv = T.v;
      P.lagV += (-70 * P.lag - 4 * P.lagV + 0.06 * drive) * h;
      P.lag += P.lagV * h;
      P.sloshV += (-38 * P.slosh - 2.4 * P.sloshV + 0.035 * drive) * h;
      P.slosh += P.sloshV * h;
    }
    P.lag = Math.max(-0.35, Math.min(0.35, P.lag));
    P.slosh = Math.max(-0.16, Math.min(0.16, P.slosh));
  });

  // ---------- 1. the drive: the raft dips under her as she goes east ----------
  lab.playCard('a', ['m3']);
  const V = 3.3;
  const ACC = 0.2;
  const xAcc = 4 + (V * ACC) / 2;
  const weight = (x) => 0.038 * (x - 3) * (x > 6.5 ? 1 + (x - 6.5) * 1.6 : 1); // torque about the centre (x = 3)
  const lean = { ...base, target: base.target.clone().lerp(W(6, 0), 0.25), dist: base.dist * 0.95 };
  rtween(0.9, (e) => blend(base, lean, e), ease.inOut);
  const XS = 6.25; // where time starts to slow
  const TS = ACC + (XS - xAcc) / V;
  let x = 4;
  await lab.tween(TS, (e, k) => {
    const tau = TS * k;
    x = tau < ACC ? 4 + (V * tau * tau) / (2 * ACC) : xAcc + V * (tau - ACC);
    maya.set({ x, y: ROW, rot: east });
    T.target = weight(x);
  }, ease.linear);

  // ---------- 2. at the rim, time slows: the tilt steepens and tips her off ----------
  lab.slowmo(0.3, 0.12);
  const XD = 6.85; // past here she is off the glass
  await lab.tween((XD - XS) / (V * 0.85), (e, k) => {
    x = XS + (XD - XS) * k;
    const over = Math.max(0, (x - 6.45) / (XD - 6.45));
    maya.set({ x, y: ROW, rot: east, pitch: 0.55 * over * over, lift: -0.05 * over });
    M.card = 1 - over;
    M.pool = 1 - over;
    T.target = weight(x);
  }, ease.linear);

  // ---------- 3. she's gone: time snaps back, the slab springs up past level and bobs ----------
  maya.group.updateMatrixWorld(true);
  const wp = maya.group.position.clone();
  const p0 = maya.pose.pitch + T.th;
  M.attached = false;
  maya.set({ x: wp.x + 3, y: ROW, lift: wp.y, pitch: p0, trail: false });
  lab.timeScale = 1;
  T.target = 0;
  T.v -= 0.06; // the weight leaving kicks it
  lab.shake(0.03, 0.25);
  const fall = lab.tween(0.5, (e, k) => {
    maya.set({ x: wp.x + 3 + 0.5 * k, lift: wp.y - 2.6 * e, pitch: p0 + 1.2 * k });
    M.glow = 1 - k;
  }, ease.in).then(() => maya.set({ visible: false }));
  let strobing = true;
  (async () => {
    while (strobing) {
      strobe();
      await lab.wait(0.04);
    }
  })();
  const fromLean = snapCam();
  const camHome = rtween(1.1, (e) => blend(fromLean, base, e), ease.inOut);
  // Ava's woozy little yaw while the raft rocks
  const wob = lab.every((dt, t) => (P.wob = 0.11 * Math.sin(t * 7.5) * Math.min(1, Math.abs(T.th) * 14 + Math.abs(P.lag) * 3)));
  await lab.wait(0.85);
  strobing = false;
  await fall;
  await lab.wait(0.25);

  // ---------- 4. settle: the last of the bob eases out, Ava steadies, facing north ----------
  const ebb = lab.every((dt) => {
    for (const p of mb.trail) p.t -= dt * 2.2;
  });
  const lag0 = { lag: P.lag, slosh: P.slosh, wob: P.wob };
  wob();
  stopAva();
  await lab.tween(0.42, (e) => {
    T.settle = 1 - e;
    P.lag = lag0.lag * (1 - e);
    P.slosh = lag0.slosh * (1 - e);
    P.wob = lag0.wob * (1 - e);
  }, ease.inOut);
  await camHome;
  stopRaft();
  stopStrobes();
  ebb();
  tilt(0);
  mb.trail = [];
  sloshParts.forEach((o, i) => o.position.copy(sloshHome[i]));
  releaseCam();
  ava.release({ x: 2, y: 3, d: 0 });
  maya.release({ x: 7, y: ROW, d: 1, on: false });
}
