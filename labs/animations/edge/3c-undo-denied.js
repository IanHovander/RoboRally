// Undo, denied, staged as a chronophotograph. She drives off and starts to fall; the film freezes with a snap
// zoom; then it runs backward, the room going cool and dim, and as she rewinds she leaves a strobe of ghost
// imprints of herself hanging in the air, like a long-exposure photograph of the motion. Back on (6,1), her
// whole future is laid out in front of her in light. The replay runs a little faster and passes exactly through
// every ghost, lighting each one as she matches it: frame for frame the same, all the way down.
export const meta = {
  title: 'Undo, denied (chronophotograph)',
  idea:
    'She goes over the rim and the film freezes with a snap zoom. Then it runs backward: the room cools and dims, her trail is eaten back up, and she leaves a strobe of pale ghost imprints along her path as she flies back up onto (6,1). For a breath, her exact future hangs in front of her in light. Then it plays forward a little faster, and she passes through every ghost precisely, each one flaring as she matches it, all the way off the edge and down.',
  notes:
    'Sound: the drive and the fall, a tape-stop "thunk" on the freeze, a reversed glass shimmer for the rewind, a held breath, then the same drive and fall sounds pitched up 1.4x, with a tiny tick of glass as she passes each ghost. Her motion is a function of one clock (tau), so the rewind and the replay are exactly the same poses; this ports as "play the recorded beat backward, then forward". The tint is an overlay; the dim is arena.dim.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const RED = new THREE.Color('#ff4d6d');
  const COOL = new THREE.Color(lab.PALETTE.reboot);
  const WHITE = new THREE.Color('#fff4ea');
  const ROW = 1;
  const W = (x, lift = 0) => lab.pos(x, ROW).setY(lift);

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

  // ---------- the camera (relative to the game's; holds its picture offset so taking it doesn't jump) ----------
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

  // ---------- her motion, as one function of a clock tau: rewinding and replaying are exactly the same poses ----------
  const V = 3.3; // spaces per second
  const ACC = 0.2;
  const xAcc = 4 + (V * ACC) / 2;
  const TR = ACC + (6.5 - xAcc) / V; // tau when she reaches the rim
  const T6 = ACC + (6 - xAcc) / V; // tau when she was on (6,1)
  const TF = TR + 0.44; // where the first fall is stopped
  const rot = lab.facing(1);
  const at = (tau) => {
    if (tau < ACC) return { x: 4 + (V * tau * tau) / (2 * ACC), lift: 0, pitch: 0 };
    if (tau < TR) return { x: xAcc + V * (tau - ACC), lift: 0, pitch: 0 };
    const s = tau - TR;
    return { x: 6.5 + V * s * (1 - s / 1.1), lift: -6 * s * s - 0.4 * s * s * s * 10, pitch: 1.7 * Math.min(1, s / 0.38) ** 1.4 };
  };
  const cardAt = (tau) => 1 - Math.max(0, Math.min(1, (tau - TR - 0.05) / 0.2));
  const poolAt = (tau) => 1 - Math.max(0, Math.min(1, (tau - TR + 0.05) / 0.2));

  const maya = lab.puppet('a');
  const b = maya.bot;
  const m = maya.model;
  const S = { tau: 0, fade: 1, card: 1 };
  maya.each = (model) => {
    model.poolMat.opacity *= poolAt(S.tau) * S.fade;
    model.ringMat.opacity *= Math.max(0.3, poolAt(S.tau)) * S.fade;
    model.eyeMat.color.multiplyScalar(S.fade);
    if (b.card) b.card.material.opacity *= cardAt(S.tau) * S.card;
  };
  const pose = (tau) => {
    S.tau = tau;
    const p = at(tau);
    maya.set({ x: p.x, y: ROW, lift: p.lift, pitch: p.pitch, rot });
  };

  // ---------- 1. the first take: drive, over the rim, falling ----------
  lab.playCard('a', ['m3']);
  pose(0);
  await lab.tween(TF, (e, k) => pose(TF * k), ease.linear);

  // ---------- 2. "wait": freeze, snap zoom, the room goes cool ----------
  lab.timeScale = 0;
  const fz = at(TF);
  const zoom = { ...base, target: base.target.clone().lerp(W(fz.x - 0.6, -0.35), 0.7), dist: base.dist * 0.72, sx: base.sx * 0.3, sy: base.sy * 0.3 };
  rtween(0.1, (e) => blend(base, zoom, e), ease.out3);
  const tint = document.createElement('div');
  tint.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;background:radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 50%, rgba(90,140,255,0.26) 100%)';
  lab.overlay.append(tint);
  const ripple = lab.ring(W(fz.x, fz.lift + 0.2), lab.PALETTE.reboot, 0.9, fz.lift + 0.2, 0.45);
  void ripple;
  let dim = 0;
  const holdDim = lab.every(() => {
    A.dim = dim;
    A.dimCur = dim;
  });
  lab.cleanup(() => {
    A.dim = 0;
    A.dimCur = 0;
  });
  await rtween(0.14, (e) => {
    tint.style.opacity = String(0.75 * e);
    dim = 0.38 * e;
  }, ease.out);
  lab.timeScale = 1;

  // ---------- 3. rewind: back up over the rim and onto (6,1), leaving ghost imprints; the trail is eaten back ----------
  maya.set({ trail: false });
  // the imprints: her ring of light and her eye, strobed along the path as she rewinds (a chronophotograph),
  // and one faint ghost of her whole self where the film froze
  const ghosts = [];
  const ringGeo = new THREE.RingGeometry(0.37, 0.42, 56);
  const dotGeo = new THREE.SphereGeometry(0.04, 12, 8);
  lab.cleanup(() => {
    ringGeo.dispose();
    dotGeo.dispose();
  });
  const placeLike = (g, tau) => {
    const p = at(tau);
    g.position.copy(W(p.x, p.lift));
    g.rotation.order = 'YXZ';
    g.rotation.set(-p.pitch, rot, 0);
    g.scale.setScalar(1.3);
  };
  const imprint = (tau, whole) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: COOL.clone().multiplyScalar(1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    const dot = new THREE.Mesh(dotGeo, mat);
    dot.position.copy(m.muzzle.position).add(new THREE.Vector3(0, 0.06, 0.12));
    g.add(ring, dot);
    if (whole) {
      maya.group.updateMatrixWorld(true);
      const body = m.body.clone(true);
      body.traverse((o) => o.isMesh && (o.material = mat));
      g.add(body);
    }
    placeLike(g, tau);
    lab.add(g);
    lab.cleanup(() => mat.dispose());
    const gh = { g, mat, tau, born: lab.t, hit: null, peak: whole ? 0.5 : 0.85, flare: whole ? 1.5 : 2.6 };
    ghosts.push(gh);
    return gh;
  };
  const ghostLife = lab.every(() => {
    for (const gh of ghosts) {
      if (gh.hit == null) {
        gh.mat.opacity = gh.peak * Math.min(1, (lab.t - gh.born) / 0.1);
      } else {
        const k = Math.min(1, (lab.t - gh.hit) / 0.26);
        gh.mat.color.copy(RED).lerp(WHITE, 0.55 * (1 - k)).multiplyScalar(gh.flare);
        gh.mat.opacity = gh.peak * (1 - k) ** 1.4;
        gh.g.scale.setScalar(1.3 * (1 + 0.22 * ease.out(k)));
        if (k >= 1) gh.g.visible = false;
      }
    }
  });
  imprint(TF, true);
  const STEP = (TF - T6) / 8;
  let nextGhost = TF - STEP;
  await lab.tween(
    0.5,
    (e) => {
      const tau = TF + (T6 - TF) * e;
      pose(tau);
      const wx = W(at(tau).x).x;
      b.trail = b.trail.filter((p) => p.x <= wx + 0.02);
      while (tau <= nextGhost && nextGhost > T6 + STEP * 0.5) {
        imprint(nextGhost, false);
        nextGhost -= STEP;
      }
    },
    ease.inOut,
  );
  pose(T6);

  // ---------- 4. a breath: her exact future hangs in front of her ----------
  await rtween(0.24, (e) => {
    tint.style.opacity = String(0.9 - 0.5 * e);
    dim = 0.5 - 0.25 * e;
  }, ease.inOut);

  // ---------- 5. the replay, 1.4x: the same last space, the same tip, the same fall, through every ghost ----------
  maya.set({ trail: true });
  lab.playCard('a', ['m3']);
  const rest = lab.every(() => {
    tint.style.opacity = String(Math.max(0, Number(tint.style.opacity) - 0.04));
    dim = Math.max(0, dim - 0.02);
  });
  const TEND = TF + 0.3;
  let homing = null;
  const ebb = lab.every((dt) => {
    if (homing) for (const p of b.trail) p.t -= dt * 2.8; // once she's gone over, the trail ebbs away
  });
  await lab.tween(
    (TEND - T6) / 1.4,
    (e, k) => {
      const tau = T6 + (TEND - T6) * k;
      pose(tau);
      for (const gh of ghosts) if (gh.hit == null && tau >= gh.tau - 0.004) gh.hit = lab.t;
      S.fade = 1 - Math.max(0, Math.min(1, (tau - TF + 0.05) / 0.3));
      if (!homing && tau >= TF - 0.08) {
        const from = snapCam();
        homing = rtween(0.6, (h) => blend(from, base, h), ease.inOut);
      }
    },
    ease.linear,
  );
  maya.set({ visible: false });

  // ---------- 6. gone for good; the trail ebbs, the camera and the room come home ----------
  await homing;
  rest();
  ebb();
  ghostLife();
  holdDim();
  A.dim = 0;
  A.dimCur = 0;
  b.trail = [];
  tint.remove();
  releaseCam();
  maya.release({ x: 7, y: ROW, d: 1, on: false });
}
