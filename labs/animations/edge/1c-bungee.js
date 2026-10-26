// Bungee, staged as a film: the camera leans in as she goes over, the room closes to an iris on the held
// breath at the top of the rebound (time all but stops), the snap leaves a freeze-frame ghost of her hanging
// there, and the camera whip-pans home riding the loose end of the trail as it lashes back across the glass.
export const meta = {
  title: 'Bungee (held breath)',
  idea:
    'Her trail peels off the glass at the rim and catches her like elastic, flaring as it takes her weight. It yanks her back to rim level and the film all but stops: the room irises in on her, the strand thins to a thread. Snap. A ghost of her stays hanging in the air while she drops away, and the camera whip-pans home on the loose end lashing back to where she started.',
  notes:
    'Sound: a glass string tightening (rising pitch) on the stretch, silence in the hold, a bright glass "tink" on the snap, then a quick descending whoosh as the end whips home. The camera moves are relative to wherever the game camera is, so it ports as a camera wish. The iris is an overlay (a vignette pass in the game). Varies: the rebound height and the whip path can wobble a little each time.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const RED = new THREE.Color('#ff4d6d');
  const WHITE = new THREE.Color('#fff4ea');
  const ROW = 1;
  const W = (x, lift = 0) => lab.pos(x, ROW).setY(lift);
  const RIM = 6.5; // the east edge, in space units

  // ---------- helpers (self-contained) ----------
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
  const softTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000');
    gr.addColorStop(0.3, '#2a2a2a');
    gr.addColorStop(0.5, '#fff');
    gr.addColorStop(0.7, '#2a2a2a');
    gr.addColorStop(1, '#000');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  lab.cleanup(() => softTex.dispose());
  // a camera-facing ribbon of light through a list of points
  function ribbon(N) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 6);
    const col = new Float32Array(N * 6);
    const uv = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) uv.set([i / (N - 1), 0, i / (N - 1), 1], i * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({ map: softTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    lab.add(mesh);
    lab.cleanup(() => {
      geo.dispose();
      mat.dispose();
    });
    const tg = new THREE.Vector3();
    const vw = new THREE.Vector3();
    const sd = new THREE.Vector3();
    return {
      hide: () => geo.setDrawRange(0, 0),
      // pts: Vector3[]; width(u) world units; color(u) -> THREE.Color (HDR ok)
      set(pts, width, color) {
        const n = Math.min(N, pts.length);
        if (n < 2) return geo.setDrawRange(0, 0);
        const cam = lab.camera3.position;
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          tg.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
          vw.subVectors(cam, p).normalize();
          sd.crossVectors(tg, vw).normalize();
          const u = i / (n - 1);
          const w = width(u);
          pos.set([p.x + sd.x * w, p.y + sd.y * w, p.z + sd.z * w, p.x - sd.x * w, p.y - sd.y * w, p.z - sd.z * w], i * 6);
          const c = color(u);
          col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.setDrawRange(0, (n - 1) * 6);
      },
    };
  }
  // the camera, relative to wherever the game has it now; holds the game's picture offset so taking it doesn't jump
  const c0 = A.camCur;
  const base = { target: c0.tgt.clone(), az: c0.az, el: c0.el, dist: c0.d, sx: c0.sx, sy: c0.sy };
  const cam = { target: base.target.clone(), az: base.az, el: base.el, dist: base.dist, sx: base.sx, sy: base.sy };
  const shot = (o) => ({ ...base, target: base.target.clone(), ...o });
  const blend = (a, b, e) => {
    cam.target.copy(a.target).lerp(b.target, e);
    for (const k of ['az', 'el', 'dist', 'sx', 'sy']) cam[k] = a[k] + (b[k] - a[k]) * e;
  };
  const snap = () => ({ ...cam, target: cam.target.clone() });
  const releaseCam = lab.camera(() => {
    const k = Math.min(1, Math.min(A.dt, 0.1) * 4);
    if (A.camCur && k < 1) {
      A.camCur.sx = cam.sx / (1 - k);
      A.camCur.sy = cam.sy / (1 - k);
    }
    return { target: cam.target.clone(), az: cam.az, el: cam.el, dist: cam.dist };
  });
  // the iris: the dark of the room closing in around a point
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  lab.overlay.append(iris);
  const irisState = { at: new THREE.Vector3(), r: 1.6, dark: 0 };
  const stopIris = lab.every(() => {
    const s = lab.toScreen(irisState.at);
    const Wd = lab.overlay.clientWidth || 960;
    const r0 = irisState.r * Wd;
    iris.style.background = irisState.dark <= 0.001 ? 'none' : `radial-gradient(circle at ${s.x}px ${s.y}px, rgba(0,0,0,0) ${r0 * 0.55}px, rgba(2,3,5,${irisState.dark}) ${r0}px)`;
  });

  // ---------- the cast ----------
  const maya = lab.puppet('a');
  const b = maya.bot;
  const m = maya.model;
  const rot = lab.facing(1);
  const S = { x: 4, lift: 0, pitch: 0, roll: 0, glow: 1, card: 1, pool: 1 };
  maya.set({ x: 4, y: ROW, rot });
  maya.each = (model) => {
    model.poolMat.opacity *= S.pool;
    model.ringMat.opacity *= Math.max(0.25, S.pool);
    model.eyeMat.color.multiplyScalar(S.glow);
    if (b.card) b.card.material.opacity *= S.card;
    S.after?.(); // runs after her pose is placed this frame
  };
  const pose = () => maya.set({ x: S.x, y: ROW, lift: S.lift, pitch: S.pitch, roll: S.roll, rot });

  const strand = ribbon(40);
  const whip = ribbon(40);
  const streak = ribbon(40);
  const ST = { on: false, anchor: RIM, thin: 1, heat: 0, sag: 0, buzz: 0 };
  const attach = () => {
    // where the strand meets her: low at her tail, pitched with her
    const back = 0.28;
    const ang = S.pitch;
    return W(S.x - back * Math.cos(ang), S.lift + 0.12 + back * Math.sin(ang));
  };
  const strandPts = () => {
    const A0 = W(ST.anchor, 0.012);
    const R = W(RIM, 0.0);
    const P = attach();
    const pts = [];
    const below = P.y < -0.03 && P.x > R.x;
    if (below) {
      for (let i = 0; i <= 5; i++) pts.push(A0.clone().lerp(R, i / 5).setY(0.012 + 0.02 * (i / 5)));
      for (let i = 1; i <= 24; i++) {
        const u = i / 24;
        const q = R.clone().lerp(P, u);
        q.y -= ST.sag * Math.sin(Math.PI * u);
        q.x += ST.buzz * Math.sin(u * Math.PI * 5 + lab.t * 70) * Math.sin(Math.PI * u) * 0.04;
        pts.push(q);
      }
    } else {
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const q = A0.clone().lerp(P, u);
        q.y -= ST.sag * Math.sin(Math.PI * u);
        q.y += ST.buzz * Math.sin(u * Math.PI * 5 + lab.t * 70) * Math.sin(Math.PI * u) * 0.03;
        if (q.y < 0.012 && q.x < R.x) q.y = 0.012;
        pts.push(q);
      }
    }
    return pts;
  };
  const stopStrand = lab.every(() => {
    if (!ST.on) return strand.hide();
    const pts = strandPts();
    const L = pts[pts.length - 1].distanceTo(W(RIM));
    const stretch = Math.min(1, L / 1.4);
    // as wide as the trail where it leaves the glass, thinning as it stretches; brighter the harder it pulls
    const w = (0.17 - 0.1 * stretch) * ST.thin;
    const k = (1.5 + 2.4 * stretch + ST.heat) * (0.7 + 0.3 * ST.thin);
    strand.set(pts, (u) => w * (1 - 0.35 * u), (u) => RED.clone().lerp(WHITE, 0.1 + 0.4 * stretch * u).multiplyScalar(k));
    // the trail on the glass takes her weight: it brightens and peels back toward the anchor
    const ax = W(ST.anchor).x;
    b.trail = b.trail.filter((p) => p.x <= ax + 0.01);
    for (const p of b.trail) p.t = Math.max(p.t, lab.t - 1.1 + 0.9 * stretch);
  });

  // ---------- 1. the drive (0.8 s): the camera already knows, and sinks to the rim ----------
  lab.playCard('a', ['m3']);
  // the bungee shot: low and side-on at the rim, so the drop below the glass reads as a drop
  const rimShot = shot({ target: W(RIM + 0.35, -0.68), dist: base.dist * 0.8, el: 0.38, sx: 0, sy: 0 });
  const camIn = lab.waitReal(0.22).then(() => rtween(1.05, (e) => blend(base, rimShot, e), ease.inOut));
  await lab.tween(
    0.8,
    (e, k) => {
      S.x = 4 + (RIM - 4) * (0.45 * k + 0.55 * k * k); // gathers speed: no idea what's coming
      pose();
    },
    ease.linear,
  );

  // ---------- 2. over the rim: the trail peels up off the glass and takes her (0.5 s) ----------
  maya.set({ trail: false });
  ST.on = true;
  await lab.tween(
    0.5,
    (e, k) => {
      const f = k < 0.5 ? 0.62 * (k / 0.5) ** 2 : 0.62 + 0.38 * (1 - (1 - (k - 0.5) / 0.5) ** 2);
      S.x = RIM + 0.8 * (1 - (1 - k) ** 2);
      S.lift = -1.5 * f;
      S.pitch = 1.25 * ease.out(Math.min(1, k * 1.6));
      S.pool = 1 - k;
      S.card = 1 - Math.min(1, k * 2.5);
      ST.anchor = RIM - 0.55 * ease.inOut(k); // peels back like tape
      pose();
    },
    ease.linear,
  );
  lab.shake(0.025, 0.22);

  // ---------- 3. yanked back up, almost home (0.4 s) ----------
  const r0 = { x: S.x, lift: S.lift, pitch: S.pitch };
  const peak = 0.04 + lab.range(-0.02, 0.05);
  await lab.tween(
    0.36,
    (e) => {
      S.x = r0.x + (RIM + 0.42 - r0.x) * e;
      S.lift = r0.lift + (peak - r0.lift) * e;
      S.pitch = r0.pitch + (0.1 - r0.pitch) * ease.out(e);
      ST.sag = 0.1 * e * e;
      pose();
    },
    ease.out,
  );
  await camIn;

  // ---------- 4. the held breath: the film all but stops, the room irises in on her ----------
  lab.timeScale = 0.05;
  irisState.at.copy(W(S.x - 0.2, 0.1));
  const hang = snap();
  const creep = shot({ target: rimShot.target.clone().lerp(W(S.x - 0.2, 0.05), 0.6), dist: rimShot.dist * 0.88, el: rimShot.el, sx: 0, sy: 0 });
  await rtween(
    0.34,
    (e, k) => {
      irisState.r = 1.7 - 1.5 * ease.out(Math.min(1, k * 1.8));
      irisState.dark = 0.94 * ease.out(Math.min(1, k * 2));
      blend(hang, creep, ease.out(k));
      ST.thin = 1 - 0.82 * ease.in(k); // thinning to a thread
      ST.buzz = k > 0.5 ? (k - 0.5) * 2.4 : 0;
      ST.heat = 1.4 * k;
      S.glow = k > 0.62 && k < 0.72 ? 0.12 : 1; // one blink
    },
    ease.linear,
  );

  // ---------- 5. snap ----------
  lab.timeScale = 1;
  S.glow = 1;
  const at = attach();
  const breakAt = W(ST.anchor).lerp(at, 0.6);
  ST.on = false;
  strand.hide();
  lab.particles(breakAt, ['#ffffff', '#ff4d6d', '#ffd0d8'], 18, { speed: 1.6, up: 0.6, gravity: 1.2, size: 0.045, dur: 0.55 });
  const pop = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.spill.material.map, color: WHITE.clone().multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pop.position.copy(breakAt);
  lab.add(pop);
  lab.cleanup(() => pop.material.dispose());
  lab.tween(0.3, (e) => {
    pop.scale.setScalar(0.25 + 1.2 * e);
    pop.material.opacity = 1 - e;
  }, ease.out).then(() => (pop.visible = false));
  // the freeze-frame ghost: she stays hanging there a moment, made of light
  maya.group.updateMatrixWorld(true);
  const ghost = maya.group.clone(true);
  const ghostMat = new THREE.MeshBasicMaterial({ color: RED.clone().lerp(WHITE, 0.35).multiplyScalar(2.2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  ghost.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material === m.poolMat) o.visible = false;
    else o.material = ghostMat;
  });
  lab.add(ghost);
  lab.cleanup(() => ghostMat.dispose());
  const g0 = ghost.scale.clone();
  const ghostFade = lab.tween(0.5, (e) => {
    ghostMat.opacity = 0.7 * (1 - e);
    ghost.scale.copy(g0).multiplyScalar(1 + 0.1 * e);
  }, ease.out).then(() => (ghost.visible = false));

  // she drops out of the iris, her light smearing into a streak
  const eyeTrail = [];
  const eyeW = new THREE.Vector3();
  S.after = () => {
    const t = lab.t;
    if (maya.group.visible) {
      maya.group.updateMatrixWorld(true);
      m.muzzle.getWorldPosition(eyeW);
      eyeTrail.push({ p: eyeW.clone(), t });
    }
    while (eyeTrail.length && t - eyeTrail[0].t > 0.3) eyeTrail.shift();
    if (eyeTrail.length < 2) return streak.hide();
    streak.set(eyeTrail.map((q) => q.p), (u) => 0.03 + 0.06 * u, (u) => RED.clone().lerp(WHITE, 0.5 * u).multiplyScalar(3.2 * u * u));
  };
  const stopStreak = () => (S.after = null);
  const d0 = { x: S.x, pitch: S.pitch };
  const fall = lab.tween(
    0.42,
    (e, k) => {
      S.lift = peak - 3.0 * e;
      S.x = d0.x + 0.12 * k;
      S.pitch = d0.pitch + 1.2 * k;
      S.glow = 1 - 0.8 * k;
      pose();
    },
    ease.in,
  ).then(() => maya.set({ visible: false }));

  // ---------- 6. the loose end lashes home along the glass; the camera rides it back ----------
  const rimX = W(RIM).x;
  const homeX = W(4).x;
  const z = W(4).z;
  const head = { x: rimX, rise: 0, amp: 0, fade: 1 };
  const stopWhip = lab.every(() => {
    const x0 = homeX;
    const x1 = head.x;
    if (x1 - x0 < 0.02) return whip.hide();
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const u = i / 36;
      const x = x0 + (x1 - x0) * u;
      // a hump of the wave rides just behind the head; the head itself flicks up off the glass
      const hump = head.amp * Math.exp(-1.5 * (((1 - u) * (x1 - x0)) / 0.45) ** 2) * Math.sin(Math.PI * Math.min(1, u * 1.02));
      pts.push(new THREE.Vector3(x, 0.014 + hump + head.rise * u ** 8, z));
    }
    whip.set(pts, (u) => 0.06 + 0.1 * u ** 4, (u) => RED.clone().lerp(WHITE, 0.75 * u ** 5).multiplyScalar((1.3 + 4 * u ** 4) * head.fade));
    b.trail = b.trail.filter((p) => p.x <= x1 + 0.01);
  });
  // the free end flicks up out of the dark and over the rim...
  await lab.tween(0.12, (e) => {
    head.rise = 0.4 * Math.sin(Math.PI * e);
    head.amp = 0.28 * e;
  }, ease.out);
  // ...and lashes home like released elastic, gathering speed and eating the trail; the camera pulls back with it
  const whipFrom = snap();
  rtween(0.62, (e, k) => {
    blend(whipFrom, base, e);
    irisState.r = 0.2 + 1.7 * ease.in(k);
    irisState.dark = 0.94 * (1 - ease.out(k));
  }, ease.inOut);
  await lab.tween(
    0.42,
    (e, k) => {
      head.x = rimX + (homeX - 0.3 - rimX) * e;
      head.amp = 0.28 * (1 - k * 0.5);
      head.rise = 0;
    },
    (k) => k ** 1.7,
  );
  // it slams into her starting space, overshoots, snaps back, and the line goes out
  b.trail = [];
  lab.ring(W(4, 0.02), '#ff4d6d', 0.55, 0.02, 0.5);
  await lab.tween(0.18, (e) => {
    head.x = homeX - 0.3 + 0.32 * e;
    head.amp = 0.14 * (1 - e);
  }, ease.outBack);
  await lab.tween(0.24, (e) => (head.fade = 1 - e), ease.out);
  whip.hide();
  stopWhip();
  await fall;
  await ghostFade;
  stopStreak();
  streak.hide();
  stopStrand();
  stopIris();
  iris.remove();
  releaseCam();
  maya.release({ x: 7, y: ROW, d: 1, on: false });
}
