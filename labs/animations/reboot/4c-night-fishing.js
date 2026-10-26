// Reboot, idea 4 (Theo goes fishing), animator c: cinematic & graphic staging.
// Shot like night fishing on a black lake. The camera eases back and west to take in the dark beyond the board's
// edge; the room's floor becomes the water. Theo leans back and casts: his laser leaves the muzzle as a slack line
// of light that unrolls over the token and drops off the west edge, a bead of light bobbing at its end, its glow
// pooling on the black floor below. Hold... the bead dips, a ring spreads on the dark water, a jolt. Theo reels:
// Maya comes up out of the dark hanging nose-first on the line, swings over the edge and across the glass, and
// slaps down on the token facing east. She flops twice like a landed fish, eye greying each time (the 2 SPAM);
// the line whips back into Theo's muzzle and he looks away, all innocence, settling facing west.
export const meta = {
  title: 'Night fishing',
  idea:
    'The camera eases back to take in the dark beyond the west edge, and the room\'s black floor becomes a lake. Theo leans back and casts his laser as a slack line of light that unrolls over the token and drops off the edge, a bead bobbing at its end, its glow pooled on the black water. The bead dips with a ring on the water; Theo reels Maya up out of the dark nose-first, swings her over the edge and slaps her down on the token facing east, where she flops twice like a landed fish (eye greying each time: the 2 SPAM). The line whips home and Theo looks away, all innocence.',
  notes:
    'Sound: a soft whirr of glass for the cast, a quiet "plip" as the bead touches the dark, a held hush while it bobs, a low "plunk" and a tick of tension for the bite, a fast ratcheting reel of tiny chimes, a wet glass slap on landing, two muted flops, a zip for the line going home. Porting: the line is a tube along the bead\'s flight that relaxes into a drape over the board edge; the fisher is the robot nearest the token, the bead drops off the edge nearest where she fell.',
};

const THEO_BLUE = '#4dabf7';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const token = lab.pos(3, 1);
  const ROWZ = token.z;
  const LIP = V(-3.5, 0.03, ROWZ); // the west edge of the glass, on her row
  const BEAD_REST = V(-4.25, -1.02, ROWZ);
  const FLOOR = -1.6;

  // timeline (scene seconds = real here; no slow motion)
  const LEAN = [0, 0.26];
  const FLICK = [0.26, 0.36];
  const CAST = [0.3, 0.86];
  const TUG = 1.24;
  const RISE = [1.36, 1.7];
  const ACROSS = [1.7, 2.08];
  const DROP = [2.08, 2.2];
  const FLOPS = [2.26, 2.48];
  const ZIP = [2.14, 2.3];
  const GLANCE = [2.36, 2.72];
  const END = 2.82;

  const T0 = arena.time;
  const now = () => arena.time - T0;

  // ---------- light textures ----------
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---------- the line: a tube of light ----------
  const lineCol = hdr(THEO_BLUE, 1.6).lerp(hdr('#ffffff', 1.6), 0.45);
  const lineMat = new THREE.MeshBasicMaterial({ color: lineCol, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const line = new THREE.Mesh(new THREE.BufferGeometry(), lineMat);
  line.frustumCulled = false;
  lab.add(line);
  const setLine = (pts) => {
    const old = line.geometry;
    if (pts.length < 2) {
      line.visible = false;
      return;
    }
    line.visible = true;
    line.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.011, 5, false);
    old.dispose();
  };
  const K = 40;
  const resample = (pts) => {
    // resample a polyline to K points by length
    const d = [0];
    for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const L = d[d.length - 1] || 1;
    const out = [];
    let j = 0;
    for (let i = 0; i < K; i++) {
      const s = (L * i) / (K - 1);
      while (j < pts.length - 2 && d[j + 1] < s) j++;
      const f = (s - d[j]) / (d[j + 1] - d[j] || 1);
      out.push(pts[j].clone().lerp(pts[j + 1], clamp(f)));
    }
    return out;
  };
  const bez = (a, b, c, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      out.push(V((1 - u) ** 2 * a.x + 2 * (1 - u) * u * b.x + u * u * c.x, (1 - u) ** 2 * a.y + 2 * (1 - u) * u * b.y + u * u * c.y, (1 - u) ** 2 * a.z + 2 * (1 - u) * u * b.z + u * u * c.z));
    }
    return out;
  };
  // the line at rest: a slack drape from the muzzle, over the token, over the lip, down to the end
  const drape = (from, end, sag) => {
    if (end.x < LIP.x + 0.05 && end.y < 0.1) {
      const mid = from.clone().lerp(LIP, 0.5);
      mid.y = 0.2 - 2.2 * sag;
      const a = bez(from, mid, LIP, 24);
      a.push(...bez(LIP, V(lerp(LIP.x, end.x, 0.4), LIP.y - 0.05, ROWZ), end, 10).slice(1));
      return a;
    }
    const mid = from.clone().lerp(end, 0.5);
    mid.y -= sag;
    return bez(from, mid, end, 24);
  };

  // ---------- the bead, its glow on the dark water, and a ring on the water ----------
  const beadCol = hdr('#d9ecff', 3);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: beadCol }));
  const beadHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr(THEO_BLUE, 1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  beadHalo.scale.setScalar(0.5);
  bead.add(beadHalo);
  bead.visible = false;
  lab.add(bead);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0, 0, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(BEAD_REST.x, FLOOR + 0.012, BEAD_REST.z);
  lab.add(pool);
  const waterRings = [];
  const waterRing = (at, delay, size, k0) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), new THREE.MeshBasicMaterial({ color: hdr(THEO_BLUE, 1.2).lerp(hdr('#ffffff', 1.2), 0.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, FLOOR + 0.015, at.z);
    lab.add(m);
    waterRings.push({ m, t0: now() + delay, size, k0 });
  };

  // ---------- puppets ----------
  const theo = lab.puppet('b');
  const maya = lab.puppet('a');
  maya.set({ visible: false, trail: false });
  const theoRot = lab.facing(3);
  const look = { eye: 0.5, grey: 0 };
  maya.each = (m) => {
    const e = look.eye;
    const g = look.grey;
    m.eyeMat.color.setRGB(lerp(3.2 * e, 0.9, g), lerp(3.1 * e, 0.92, g), lerp(2.9 * e, 1.0, g));
    m.ringMat.opacity = 0.9 * look.ring;
    m.poolMat.opacity = 0.75 * look.ring;
  };
  look.ring = 0;
  const theoEye = { k: 1 };
  theo.each = (m) => m.eyeMat.color.multiplyScalar(theoEye.k);

  // world <-> spaces
  const toSpace = (w) => ({ x: w.x + 3, y: w.z + 1.5 });
  const NOSE = V(0, 0.13, -0.36).multiplyScalar(1.3);
  // hang Maya from her nose at world point `hook`, with her body pitched `pitch` (nose up is negative)
  const hang = (hook, pitch, rot) => {
    const off = NOSE.clone().applyEuler(new THREE.Euler(-pitch, rot, 0, 'YXZ'));
    const g = hook.clone().sub(off);
    const s = toSpace(g);
    maya.set({ x: s.x, y: s.y, lift: g.y, pitch, rot, roll: 0 });
  };

  // ---------- camera: back and west to take in the dark water, then home ----------
  const cam = { wide: 0, follow: 0, fx: 0 };
  const releaseCam = lab.camera((home) => {
    const k = cam.wide;
    const target = home.target.clone().add(V(-1.25 * k + cam.fx * cam.follow, -0.35 * k, 0.1 * k));
    return { target, dist: home.dist * (1 + 0.1 * k), el: home.el - 0.05 * k, az: -0.1 * k };
  });

  // ---------- the master timeline ----------
  const traj = []; // the bead's flight, which the line follows as it unrolls
  const muzzleW = () => {
    theo.group.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  };
  // where the bead flies: up from the muzzle, over the token, off the edge, down into the dark
  const beadFlight = (k, from) => {
    const end = BEAD_REST.clone().add(V(0, 0.18, 0));
    const p = from.clone().lerp(end, k);
    p.y = lerp(from.y, end.y, k * k) + 1.9 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (k < 0.87 ? 1 : 1 - (k - 0.87) / 0.13);
    return p;
  };
  let castFrom = null;
  let hooked = false;
  const stop = lab.every(() => {
    const T = now();

    // Theo's body: lean back, flick, a jolt at the bite, lean back reeling, settle; then the innocent glance
    let pitch = 0;
    pitch -= 0.32 * ease.out(seg(T, LEAN[0], LEAN[1])) * (1 - seg(T, FLICK[0], FLICK[1]));
    pitch += 0.26 * Math.sin(Math.PI * seg(T, FLICK[0], FLICK[1] + 0.22));
    pitch += 0.2 * Math.sin(Math.PI * seg(T, TUG, TUG + 0.12));
    const reel = Math.sin(Math.PI * seg(T, TUG + 0.08, DROP[1]));
    pitch -= 0.42 * reel + 0.06 * Math.sin(T * 60) * reel;
    const glance = Math.sin(Math.PI * seg(T, GLANCE[0], GLANCE[1]));
    theo.set({ pitch, rot: theoRot + 0.5 * ease.out(glance > 0 ? glance : 0) * (T < GLANCE[1] ? 1 : 0), sy: 1 - 0.05 * reel });
    theoEye.k = 1 - 0.7 * Math.max(0, Math.sin(Math.PI * seg(T, GLANCE[0] + 0.08, GLANCE[0] + 0.18)));

    const mz = muzzleW();
    // the cast: the bead flies, the line unrolls along its path then relaxes into a drape
    if (T >= CAST[0] && T < RISE[0]) {
      if (!castFrom) castFrom = mz.clone();
      const k = seg(T, CAST[0], CAST[1]);
      let bp = beadFlight(ease.out(k) * 0.35 + k * 0.65, castFrom);
      if (T >= CAST[1]) {
        // bob on the line: a spring settling, then the bite pulls it down hard
        const s = T - CAST[1];
        bp = BEAD_REST.clone().add(V(0, 0.18 * Math.exp(-6 * s) * Math.cos(15 * s) + 0.02 * Math.sin(T * 9), 0));
        const tug = seg(T, TUG, TUG + 0.07);
        bp.y -= 0.36 * tug;
      }
      bead.visible = true;
      bead.position.copy(bp);
      traj.push(bp.clone());
      const unrolled = resample([mz, ...traj]);
      const relax = smooth(seg(T, CAST[1] - 0.15, CAST[1] + 0.3));
      const dr = resample(drape(mz, bp, 0.1 * (1 - seg(T, TUG, TUG + 0.06))));
      setLine(unrolled.map((p, i) => p.lerp(dr[i], relax)));
      // the glow of the bead on the dark water: brighter the closer it hangs
      const near = clamp(1 - (bp.y - FLOOR) / 1.4);
      pool.material.color.copy(hdr(THEO_BLUE, 1)).multiplyScalar(0.9 * near * near);
      pool.scale.setScalar(0.9 + 0.4 * near);
      pool.position.x = bp.x;
      if (T >= TUG && !hooked) {
        hooked = true;
        waterRing(bp, 0, 1.2, 0);
        waterRing(bp, 0.1, 0.75, 0);
        lab.shake(0.035, 0.22);
      }
    }

    // the reel: she comes up out of the dark hanging nose-first, over the edge, across the glass
    if (T >= RISE[0] && T < DROP[0]) {
      bead.visible = false;
      maya.set({ visible: true });
      let hook;
      let swing;
      if (T < RISE[1]) {
        const k = ease.out(seg(T, RISE[0], RISE[1]));
        const a = BEAD_REST.clone().add(V(0, -0.3, 0));
        hook = V(lerp(a.x, -3.2, k), lerp(a.y, 1.15, k) + 0.25 * Math.sin(Math.PI * k), ROWZ);
        swing = -0.35 * k;
      } else {
        const k = seg(T, ACROSS[0], ACROSS[1]);
        hook = V(lerp(-3.2, token.x, ease.inOut(k)), 1.15 + 0.12 * Math.sin(Math.PI * k), ROWZ);
        swing = -0.35 + 0.65 * Math.sin(k * Math.PI * 1.5) * (1 - 0.4 * k);
      }
      // nose up (pitch about -1.3) with the pendulum swing on top; a slow twist
      hang(hook, -1.05 + swing, lab.facing(1) + 0.5 * Math.sin((T - RISE[0]) * 7) * (1 - seg(T, ACROSS[0], ACROSS[1])));
      look.eye = 0.45;
      setLine(resample(drape(mz, hook, -0.08)));
      // the room watches her come out of the dark
      const out = smooth(seg(T, RISE[0], RISE[0] + 0.25));
      maya.model.paint.emissiveIntensity = 0.16 * out;
    }

    // drop and slap down on the token, flat, nose east; the line lets go and whips home
    if (T >= DROP[0]) {
      const k = seg(T, DROP[0], DROP[1]);
      const lift0 = 0.62;
      const lift = lift0 * (1 - ease.in(k));
      maya.set({ x: 3, y: 1, lift, pitch: -1.05 * (1 - ease.in(k)), rot: lab.facing(1), roll: 0 });
      const landed = seg(T, DROP[1], DROP[1] + 0.14);
      if (T >= DROP[1]) maya.set({ sy: 1 - 0.28 * Math.sin(Math.PI * landed), sx: 1 + 0.16 * Math.sin(Math.PI * landed), sz: 1 + 0.16 * Math.sin(Math.PI * landed), lift: 0, pitch: 0 });
      look.ring = smooth(seg(T, DROP[1], DROP[1] + 0.2));
      look.eye = lerp(0.35, 1, smooth(seg(T, DROP[1], DROP[1] + 0.1)));
      // two flops like a landed fish, eye greying each time
      let grey = 0;
      for (const f of FLOPS) {
        const q = seg(T, f, f + 0.2);
        if (q > 0 && q < 1) {
          const side = f === FLOPS[0] ? 1 : -1;
          maya.set({ lift: 0.16 * Math.sin(Math.PI * q), roll: side * 0.75 * Math.sin(Math.PI * q), pitch: 0.12 * Math.sin(2 * Math.PI * q) });
        }
        grey = Math.max(grey, Math.sin(Math.PI * seg(T, f, f + 0.28)));
      }
      look.grey = grey;
      if (T > FLOPS[1] + 0.2) maya.set({ lift: 0, roll: 0, pitch: 0, sx: 1, sy: 1, sz: 1 });
      // the line: from her nose back into Theo's muzzle, fast
      const zk = ease.in(seg(T, ZIP[0], ZIP[1]));
      if (zk < 1) {
        const hook = V(token.x, lerp(1.15, lift * 0.5 + 0.2, k), ROWZ);
        const end = hook.clone().lerp(mz, zk);
        setLine(resample(drape(mz, end, -0.08 * (1 - zk))));
      } else line.visible = false;
    }

    // rings on the dark water
    for (const r of waterRings) {
      const q = clamp((T - r.t0) / 0.75);
      r.m.scale.setScalar(0.05 + r.size * ease.out3(q));
      r.m.material.opacity = q <= 0 ? 0 : (1 - q) ** 1.5;
    }
    if (T >= RISE[0]) pool.material.color.multiplyScalar(0.85);

    // camera: wide over the water for the cast and the bite, back home with her
    cam.wide = smooth(seg(T, 0.1, 0.8)) * (1 - smooth(seg(T, ACROSS[0] - 0.05, END - 0.25)));
  });

  await lab.wait(END - 0.24);
  releaseCam();
  await lab.wait(END - now());
  stop();
  line.visible = false;
  maya.each = null;
  theo.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
