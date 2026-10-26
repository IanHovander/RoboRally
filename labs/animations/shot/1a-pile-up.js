// Pile-up, through weight and physical comedy: the beam is a heavy hose of light. Theo braces against its
// kick; the head slams into Maya's flank and stops dead, the rest keeps coming and folds up into a heap of
// light taller than she is, which shoves her a little with every fold. When the hose runs dry Theo stumbles
// forward, the tail concertinas in, and Maya slurps the whole heap through its own folds like a noodle.
export const meta = {
  title: 'Pile-up (heavy light)',
  idea: 'The beam is a heavy hose of light. Its head stops dead on Maya\'s flank, the rest keeps coming and folds into a heap taller than she is, shoving her with every fold; Theo braces against the kick and stumbles when it runs dry. Then she slurps the whole heap through its own folds like a noodle, the end flicks, and gulp: she swells, wobbles back to her shape and blinks.',
  notes: 'Sound: a soft hiss of air while the hose runs, a glassy tink for each fold landing (rising in pitch as the heap grows), a quick rising slurp of chimes, and one round low chime for the gulp. The heap grows with range (folded length = the distance shot), so a point-blank shot makes a little curl and a cross-board shot a real pile-up. Built from one tube of light whose shape is a function of arc length, so it ports as one effect.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
  const theoBot = lab.bot('b');
  const color = theoBot.color;
  const glowTex = lab.bot('a').model.poolMat.map;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });
  const MAYA_ROT = facing(2);
  const THEO_ROT = facing(3);

  // ---------- geometry of the shot ----------
  const row = lab.pos(1, 1).z; // the row's z
  const FLANK = lab.pos(1, 1).x + 0.36; // Maya's east flank, where the head stops dead
  const MUZ_DX = -0.43; // Theo's muzzle, ahead of his centre
  const MUZ_Y = 0.13;
  const muzzleX = () => lab.pos(theo.pose.x, 1).x + MUZ_DX;
  const D0 = muzzleX() - FLANK; // how far the head travels
  const L = D0 * 1.5; // the whole beam's length: it all ends up in the heap (longer shot, bigger heap)
  const V = 13; // the light's speed (world units / s)

  // ---------- the heap's path: a crumpled ribbon of folds, a function of arc length ----------
  // the cars jackknife: zigzags across the row (readable from above), stacking up in layers, a curl on top
  const ctrl = [];
  ctrl.push(new THREE.Vector3(FLANK, 0.14, row)); // the head, against her flank at beam height
  ctrl.push(new THREE.Vector3(FLANK + 0.02, 0.07, row + 0.05)); // it slumps to the glass
  const LAYERS = [
    { y: 0.05, amp: 0.3, n: 4, w: 0.64 },
    { y: 0.17, amp: 0.27, n: 4, w: 0.56 },
    { y: 0.3, amp: 0.22, n: 3, w: 0.46 },
    { y: 0.42, amp: 0.17, n: 3, w: 0.36 },
    { y: 0.53, amp: 0.12, n: 2, w: 0.26 },
  ];
  LAYERS.forEach((ly, li) => {
    const east = li % 2 === 0;
    for (let i = 0; i <= ly.n; i++) {
      const f = i / ly.n;
      const x = FLANK + 0.05 + (east ? f : 1 - f) * ly.w + lab.range(-0.02, 0.02);
      const z = row + ly.amp * ((i + li) % 2 ? 1 : -1) + lab.range(-0.025, 0.025);
      ctrl.push(new THREE.Vector3(x, ly.y + lab.range(-0.015, 0.015) + (i === 0 && li ? -0.04 : 0), z));
    }
  });
  // the last carriage: a curl on top of the heap
  const top = ctrl[ctrl.length - 1].clone();
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 1.6;
    ctrl.push(new THREE.Vector3(top.x + Math.sin(a) * 0.12, top.y + 0.05 + (1 - Math.cos(a)) * 0.06, top.z - (1 - Math.cos(a)) * 0.05));
  }
  const pileCurve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const pileLen = pileCurve.getLength();
  const PILE_N = 600;
  const pilePts = pileCurve.getSpacedPoints(PILE_N);
  const pileAt = (s, out) => {
    const f = clamp01(s / L) * PILE_N;
    const i = Math.min(PILE_N - 1, Math.floor(f));
    return out.copy(pilePts[i]).lerp(pilePts[i + 1], f - i);
  };
  // the heap's own body: it squashes toward her with every fold landing, sags with its weight, wobbles
  const heap = { push: 0, pushV: 0, sag: 0, wob: 0, wobV: 0, up: 0, suck: 0 };
  const MOUTH = new THREE.Vector3(FLANK - 0.12, 0.17, row);
  const shapeHeap = (p, s) => {
    const dx = p.x - FLANK;
    const h = p.y;
    const sq = 1 - heap.push; // squashed toward her flank
    p.x = FLANK + dx * sq + Math.sin(h * 9 + heap.wob * 2) * heap.wob * 0.03;
    p.y = h * (1 - heap.sag + heap.push * 0.25) * (1 + heap.up) + 0.004;
    p.z += Math.sin(s * 3 + heap.wob) * heap.wob * 0.01;
    if (heap.suck > 0) p.lerp(MOUTH, heap.suck);
    return p;
  };

  // ---------- the tube of light ----------
  const MAXP = 900;
  const makeTube = (mat, radial = 8) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAXP * radial * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = [];
    for (let i = 0; i < MAXP - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        idx.push(a, a + radial, b, b, a + radial, b + radial);
      }
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const B = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    mesh.update = (pts, radius) => {
      const n = Math.min(pts.length, MAXP);
      if (n < 2) return geo.setDrawRange(0, 0);
      for (let i = 0; i < n; i++) {
        T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
        if (T.lengthSq() < 1e-12) T.set(1, 0, 0);
        T.normalize();
        if (i === 0) N.set(0, 0, 1);
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T)));
        if (N.lengthSq() < 1e-8) N.set(0, 1, 0).sub(tmp.copy(T).multiplyScalar(T.y));
        N.normalize();
        B.crossVectors(T, N);
        const r = typeof radius === 'function' ? radius(i, n) : radius;
        for (let j = 0; j < radial; j++) {
          const a = (j / radial) * Math.PI * 2;
          const c = Math.cos(a) * r;
          const s = Math.sin(a) * r;
          const o = (i * radial + j) * 3;
          pos[o] = pts[i].x + N.x * c + B.x * s;
          pos[o + 1] = pts[i].y + N.y * c + B.y * s;
          pos[o + 2] = pts[i].z + N.z * c + B.z * s;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * radial * 6);
    };
    return mesh;
  };
  const add = (c, k, op) => new THREE.MeshBasicMaterial({ color: hdr(c, k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = add('#ffffff', 1.9, 1);
  const sheathMat = add(color, 1.5, 0.24);
  const core = lab.add(makeTube(coreMat, 6));
  const sheath = lab.add(makeTube(sheathMat, 10));
  core.renderOrder = 6;
  sheath.renderOrder = 5;
  // the bright head
  const headMat = new THREE.SpriteMaterial({ map: glowTex, color: hdr('#ffffff', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const head = lab.add(new THREE.Sprite(headMat));
  head.scale.setScalar(0.32);
  head.visible = false;
  head.renderOrder = 7;
  const headHalo = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr(color, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  headHalo.scale.setScalar(0.75);
  headHalo.visible = false;
  // the heap's light pooled on the glass, and the line's light on the glass under it
  const pool = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(color, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(FLANK + 0.2, 0.006, row);
  pool.renderOrder = 2;
  const streak = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(color, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  streak.rotation.x = -Math.PI / 2;
  streak.position.set(0, 0.005, row);
  streak.renderOrder = 2;

  // ---------- the state of the shot, evaluated every frame ----------
  const st = { tau: -1, slurp: 0, end: 0, whip: 0, done: false };
  const pts = [];
  for (let i = 0; i < MAXP; i++) pts.push(new THREE.Vector3());
  const STEP = 0.018; // spacing of points along the light
  let folds = 0;
  const kick = (k) => {
    heap.pushV += k;
    heap.wobV += k * 22;
  };

  const draw = (dt) => {
    // springs: the heap's squash and wobble
    heap.pushV += (-heap.push * 260 - heap.pushV * 16) * dt;
    heap.push += heap.pushV * dt;
    heap.wobV += (-heap.wob * 300 - heap.wobV * 10) * dt;
    heap.wob += heap.wobV * dt;
    if (st.tau < 0 || st.done) {
      core.geometry.setDrawRange(0, 0);
      sheath.geometry.setDrawRange(0, 0);
      head.visible = headHalo.visible = false;
      return;
    }
    const tau = st.tau;
    const mx = muzzleX();
    const travelled = V * tau; // how far the light has come out of the muzzle, in total
    const U = Math.max(0, Math.min(L, travelled - D0)); // how much is in the heap
    const tailD = Math.max(0, travelled - L); // the tail's distance from the muzzle
    const n0 = Math.floor(U / STEP);
    let n = 0;
    // 1) the heap (minus what has been slurped), from the head along the folds
    const sl = st.slurp; // slurped length
    const visibleHeap = Math.max(0, U - sl);
    const nh = Math.floor(visibleHeap / STEP);
    for (let i = 0; U > 0 && i <= nh && n < MAXP - 2; i++) {
      const s = Math.min(visibleHeap, i * STEP);
      shapeHeap(pileAt(s, pts[n]), s);
      // the free end whips as it's slurped
      if (sl > 0 && visibleHeap - s < 0.35) {
        const f = 1 - (visibleHeap - s) / 0.35;
        pts[n].y += Math.sin(st.whip * 30) * 0.06 * f * f * Math.min(1, sl * 3);
        pts[n].x += Math.cos(st.whip * 24) * 0.05 * f * f * Math.min(1, sl * 3);
      }
      n++;
    }
    // 2) the straight run from the heap (or the head) back to the tail, concertinaing when it's free
    const heapEnd = n ? pts[n - 1].clone() : null;
    if (sl <= 0) {
      const ahead = U > 0 ? heapEnd : new THREE.Vector3(mx - Math.min(travelled, D0), MUZ_Y, row);
      const tailX = mx - tailD;
      const runLen = Math.max(0, tailX - ahead.x);
      const m = Math.floor(runLen / STEP);
      const free = tailD > 0;
      for (let i = 1; i <= m && n < MAXP - 1; i++) {
        const f = i / m; // 0 at the heap, 1 at the tail
        const p = pts[n];
        const tailward = runLen * (1 - f); // distance from the tail
        p.set(ahead.x + (tailX - ahead.x) * f, ahead.y + (MUZ_Y - ahead.y) * smooth(f * 3), row);
        if (free) {
          // the concertina: the tail's last stretch crumples into zigzags as it comes in
          const a = Math.max(0, 1 - tailward / 0.9) ** 1.5 * 0.07;
          p.y += Math.abs(Math.sin(tailward * 26)) * a;
          p.z += Math.sin(tailward * 26 + 1.2) * a * 0.8;
        }
        n++;
      }
      // the head (before it lands) or the muzzle's bright mouth
      if (U <= 0) {
        head.visible = headHalo.visible = true;
        head.position.copy(ahead);
        headHalo.position.copy(ahead);
        headMat.opacity = 1;
      } else {
        // after the stop the head is a squashed glow against her flank, fading as the heap covers it
        head.position.set(FLANK + 0.02, 0.1, row);
        headHalo.position.copy(head.position);
        const k = clamp01(U / 0.6);
        headMat.opacity = 1 - k * 0.7;
        head.scale.set(0.32 * (1 - 0.4 * k), 0.32 * (1 + 0.3 * k), 1);
      }
      void n0;
    } else {
      head.visible = headHalo.visible = false;
    }
    // reverse so the tube starts at the tail (just a nicer frame to start from)
    core.update(pts.slice(0, n), 0.013);
    sheath.update(pts.slice(0, n), 0.042);
    // light on the glass: under the run, and pooled under the heap
    const runK = st.slurp > 0 ? 0 : clamp01(travelled / D0) * (tailD > 0 ? clamp01(1 - tailD / D0) : 1);
    streak.material.opacity = 0.6 * runK;
    const a = Math.max(FLANK, mx - tailD);
    const b = U > 0 ? FLANK : mx - Math.min(travelled, D0);
    streak.scale.set(Math.max(0.01, Math.abs(a - b) + 0.6), 1, 1);
    streak.position.x = (a + b) / 2;
    const hk = clamp01((U - sl) / L);
    pool.material.opacity = 0.12 + 0.3 * hk;
    pool.scale.setScalar(0.35 + 0.6 * hk);
    if (U <= 0 && st.slurp <= 0) pool.material.opacity = 0;
    // count folds landing: each one shoves the heap (and Maya) a little
    const f = Math.floor((U - 0.25) / 0.55);
    if (f > folds && sl <= 0) {
      folds = f;
      kick(0.8 + folds * 0.12);
      lab.arena.emit('fold', { n: folds });
    }
  };
  lab.every((dt) => draw(dt));

  // Maya: braced against the heap, then the gulp
  const mayaState = { lean: 0, leanV: 0, swell: 0, blink: 0 };
  lab.every((dt) => {
    const m = mayaState;
    // she's shoved west by the heap's squash, and springs back
    const shove = heap.push * 3.2;
    m.leanV += (-(m.lean - shove) * 180 - m.leanV * 12) * dt;
    m.lean += m.leanV * dt;
  });
  maya.each = (model) => {
    const m = mayaState;
    const s = m.swell;
    maya.set({ x: 1, y: 1, rot: MAYA_ROT, roll: m.lean * 0.12, sx: 1 + 0.2 * s, sz: 1 + 0.2 * s, sy: 1 + 0.1 * s - 0.06 * Math.max(0, m.lean) });
    if (m.blink > 0) {
      const b = m.blink;
      const k = b < 0.25 ? 0.05 : 1 + 4 * Math.sin(((b - 0.25) / 0.75) * Math.PI);
      model.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
      // the swallowed light flushes through her polish once
      model.paint.emissiveIntensity = 0.16 + 0.9 * Math.max(0, 1 - b * 1.6);
    }
  };
  maya.set({ x: 1, y: 1, rot: MAYA_ROT });

  // Theo: braces against the hose's kick, and stumbles forward when it runs dry
  const theoState = { x: 0, v: 0, lean: 0, thrust: 0, crouch: 0 };
  lab.every((dt) => {
    const s = theoState;
    // a spring holding him to his space, pushed east by the thrust
    const force = -s.x * 140 - s.v * 9 + s.thrust * 22;
    s.v += force * dt;
    s.x += s.v * dt;
  });
  theo.each = () => {
    const s = theoState;
    const shudder = s.thrust > 0 ? Math.sin(lab.t * 70) * 0.012 * s.thrust : 0;
    theo.set({ x: 5 + s.x + shudder, y: 1, rot: THEO_ROT, pitch: -s.x * 1.6 - 0.15 * s.crouch, sy: 1 - 0.1 * s.crouch + Math.min(0, s.x) * 0.3, sx: 1 + 0.06 * s.crouch, sz: 1 + 0.06 * s.crouch });
  };
  theo.set({ x: 5, y: 1, rot: THEO_ROT });

  // ---------- the beats ----------
  // a breath of anticipation: Theo plants himself
  await lab.tween(0.14, (e) => (theoState.crouch = e), ease.out);
  // fire: the hose opens
  lab.arena.emit('laser', { hit: true, src: 'b' });
  st.tau = 0;
  theoState.thrust = 1;
  theoState.v += 1.5; // the kick
  const tStart = lab.t;
  let landed = false;
  const stopTau = lab.every(() => {
    st.tau = lab.t - tStart;
    theoState.crouch = Math.max(0, 1 - st.tau * 4);
    // the head stops dead: a hard shove into her flank
    if (!landed && V * st.tau >= D0) {
      landed = true;
      kick(2.2);
      mayaState.leanV += 6;
    }
    // the hose runs dry: the thrust is gone and Theo lurches forward
    if (V * st.tau >= L && theoState.thrust > 0) {
      theoState.thrust = 0;
      theoState.v -= 2.4;
    }
  });
  // until the tail has concertinaed into the heap
  await lab.wait((L + D0) / V);
  stopTau();
  st.tau = (L + D0) / V;
  kick(1.6); // the last carriage
  // the heap jiggles and settles under its own weight
  await lab.tween(0.16, (e) => (heap.sag = 0.08 * e), ease.out);
  // anticipation: the heap lifts a hair, as if something inside her took a breath
  await lab.tween(0.08, (e) => (heap.up = 0.06 * e), ease.out);
  // the slurp: the strand runs back through its own folds into her, faster and faster; the end whips
  const total = L;
  await lab.tween(0.26, (e, k) => {
    st.slurp = total * e;
    st.whip = k;
    heap.up = 0.06 * (1 - k);
    heap.suck = 0.8 * ease.in(k);
    mayaState.swell = 0.25 * e;
  }, ease.in3);
  st.done = true;
  pool.material.opacity = 0;
  // gulp: she swells, then wobbles back to her shape and blinks
  lab.arena.emit('damage', { id: 'a', n: 1 });
  await lab.tween(0.08, (e) => (mayaState.swell = 0.25 + 0.75 * e), ease.out);
  mayaState.blink = 0.001;
  await lab.tween(0.42, (e, k) => {
    mayaState.swell = Math.cos(k * Math.PI * 3.2) * (1 - k) ** 1.6;
    mayaState.blink = Math.min(1, k / 0.55);
  }, ease.linear);
  mayaState.swell = 0;
  mayaState.blink = 0;
  maya.each = null;
  theo.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
