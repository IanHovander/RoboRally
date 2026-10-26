// Coat check, played as character acting. Maya's light is the one with the feelings: at the rim it digs its
// heels in and stretches like a leash while her body strains on toward the hole, until it snaps. The body,
// now plain dark glass with no light in it, lurches on, oblivious, and drops in without a sound. Her light,
// left on the glass as a red Pebble-shaped stain, peers after her, shivers once, and bolts: it runs off along
// the board's seams in thin red threads like water into grout. One thread runs right under Theo's front edge,
// and he hops like someone lifting their feet for a mouse, then shivers too.
export const meta = {
  title: 'Coat check',
  idea: 'A pit is where light is missing, so her light refuses to go in. At the rim her ring, glow and eye dig in and stretch back like a leash while her body strains forward; it snaps, and her body (now plain dark glass, no light in it) lurches on and drops in without a sound. The red Pebble-shaped stain she left peers at the hole, shivers once, and bolts along the seams in thin red threads. One runs under Theo\'s nose and he hops out of its way, then shivers himself.',
  notes: 'Sound: a rising glassy stretch (a wet finger on a glass rim) that snaps with a bright "tink"; then nothing at all for the dark body\'s drop; a tiny shiver chime, and a quick trickle of high notes as the threads run (one passing under Theo gets his own little hop "pip"). Port: the stain is a copy of her ring, pointer, glow pool and eye laid on the glass; her real model is dimmed to dark glass for the fall. The threads follow the real seams (half-space lines) and never cross the pit.',
};

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  lab.playCard('a', ['m3']);
  const b = maya.bot;
  const RED = new THREE.Color(b.color);

  const lerp = (a, c, k) => a + (c - a) * k;
  const clamp = (k) => Math.max(0, Math.min(1, k));
  const key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (fn ?? ease.inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
    return keys[keys.length - 1][1];
  };
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const texOf = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const glowTex = (() => {
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return texOf(c);
  })();
  const add = (mat) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...mat });

  // ---------- timing ----------
  const T = {
    rim: 0.56, // her light stops at the rim (her centre at x = 3); her body keeps going
    snap: 1.02, // the leash snaps (her body is over the hole)
    dropStart: 1.08,
    gone: 1.34,
    peer: 1.26, // the stain peers after her
    shiver: 1.56,
    bolt: 1.74, // runs off along the seams
    end: 3.1,
  };

  // ---------- the stain: a copy of her ring, pointer, glow pool and eye, plus a Pebble of red light ----------
  const coat = lab.add(new THREE.Group());
  coat.visible = false;
  const S = 1.3; // the arena's robot scale
  const inner = new THREE.Group(); // squash and wobble live here
  inner.scale.setScalar(S);
  coat.add(inner);
  const copies = [];
  for (const o of maya.model.group.children) {
    if (!o.isMesh || o === maya.model.body) continue;
    const c = o.clone();
    c.material = o.material.clone();
    c.material.opacity = o.material.opacity;
    inner.add(c);
    copies.push(c);
  }
  const pebble = (s = 1) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.29 * s);
    sh.bezierCurveTo(0.11 * s, 0.29 * s, 0.31 * s, -0.12 * s, 0.29 * s, -0.22 * s);
    sh.bezierCurveTo(0.27 * s, -0.31 * s, 0.13 * s, -0.33 * s, 0, -0.29 * s);
    sh.bezierCurveTo(-0.13 * s, -0.33 * s, -0.27 * s, -0.31 * s, -0.29 * s, -0.22 * s);
    sh.bezierCurveTo(-0.31 * s, -0.12 * s, -0.11 * s, 0.29 * s, 0, 0.29 * s);
    return sh;
  };
  const stainMat = new THREE.MeshBasicMaterial(add({ color: RED.clone().multiplyScalar(1.4), opacity: 0.0 }));
  const stain = new THREE.Mesh(new THREE.ShapeGeometry(pebble(1.12), 24), stainMat);
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = 0.007;
  inner.add(stain);
  const coreMat = new THREE.MeshBasicMaterial(add({ map: glowTex, color: RED.clone().multiplyScalar(2.2), opacity: 0 }));
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.008;
  inner.add(core);
  const eyeMat = new THREE.MeshBasicMaterial(add({ map: glowTex, color: new THREE.Color(3.2, 3.1, 2.9), opacity: 0 }));
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), eyeMat);
  eye.rotation.x = -Math.PI / 2;
  eye.position.set(0, 0.01, -0.15);
  inner.add(eye);
  // the leash: a band of red light from the stain to her body while it stretches
  const leashMat = new THREE.MeshBasicMaterial(add({ map: glowTex, color: RED.clone().multiplyScalar(2), opacity: 0 }));
  const leash = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), leashMat));
  leash.rotation.x = -Math.PI / 2;
  leash.visible = false;

  // ---------- threads: thin red light running along the seams, away from the hole ----------
  const P = (x, y) => lab.pos(x, y);
  const paths = [
    { pts: [[2.5, 0.5], [-0.8, 0.5]], delay: 0.0 },
    { pts: [[2.5, 1.5], [-0.8, 1.5]], delay: 0.05 },
    { pts: [[3.5, 0.5], [3.5, -0.8]], delay: 0.1 }, // it reaches the pit's corner and goes the other way
    { pts: [[2.5, 0.5], [2.5, -0.8]], delay: 0.07 },
    { pts: [[3.5, 1.5], [3.5, 2.5], [6.8, 2.5]], delay: 0.0 }, // under Theo's nose
    { pts: [[2.5, 1.5], [2.5, 3.8]], delay: 0.12 },
  ];
  const head = (tau) => (tau <= 0 ? 0 : 0.7 * tau + 3.6 * tau * tau); // water finding the grout: it speeds up
  const threads = paths.map(({ pts, delay }) => {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = P(...pts[i - 1]);
      const c = P(...pts[i]);
      const len = a.distanceTo(c);
      segs.push({ a, c, s0: total, len });
      total += len;
    }
    const at = (s) => {
      s = Math.max(0, Math.min(total, s));
      const sg = segs.find((g) => s <= g.s0 + g.len) ?? segs[segs.length - 1];
      return sg.a.clone().lerp(sg.c, (s - sg.s0) / sg.len);
    };
    const N = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    const mesh = lab.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    const tip = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial(add({ map: glowTex, color: RED.clone().multiplyScalar(2.6), opacity: 0 }))));
    tip.rotation.x = -Math.PI / 2;
    return { at, total, delay, mesh, pos, col, N, tip };
  });
  const drawThread = (th, now) => {
    const tau = now - T.bolt - th.delay;
    const h = head(tau);
    // a wet line from the stain to the running head; it dries from the back once the stain is empty
    const from = Math.max(0, h - 1.5);
    const fade = 1 - clamp((tau - 0.8) / 0.36);
    for (let i = 0; i < th.N; i++) {
      const s = from + ((h - from) * i) / (th.N - 1);
      const p = th.at(s);
      const q = th.at(s + 0.05);
      let dx = q.x - p.x;
      let dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const w = 0.02 + 0.016 * (i / (th.N - 1));
      th.pos.set([p.x - dz * w, 0.011, p.z + dx * w, p.x + dz * w, 0.011, p.z - dx * w], i * 6);
      const k = tau > 0.01 ? (0.3 + 0.7 * (i / (th.N - 1)) ** 2) * 2.2 * fade : 0;
      th.col.set([RED.r * k, RED.g * k, RED.b * k, RED.r * k, RED.g * k, RED.b * k], i * 6);
    }
    th.mesh.geometry.attributes.position.needsUpdate = true;
    th.mesh.geometry.attributes.color.needsUpdate = true;
    const hp = th.at(h);
    th.tip.position.set(hp.x, 0.012, hp.z);
    th.tip.material.opacity = tau > 0.02 && h < th.total ? 0.8 * fade : 0;
  };
  // when the thread under Theo reaches his front edge
  const underTheo = (() => {
    for (let t = 0; t < 2; t += 0.005) if (head(t) >= 1 + 0.95) return T.bolt + paths[4].delay + t; // 1 down the seam, then east to his front edge (x = 4.45)
    return T.bolt + 0.6;
  })();
  const passTheo = (() => {
    for (let t = 0; t < 2; t += 0.005) if (head(t) >= 1 + 2.1) return T.bolt + paths[4].delay + t;
    return underTheo + 0.2;
  })();

  // ---------- Maya's body ----------
  // her body keeps going, slowed by the leash, until it's over the hole; the snap lets it lurch on
  const bodyX = [[0, 1], [0.3, 2, ease.in], [T.rim, 3, ease.linear], [T.snap, 3.86, (k) => Math.sin((k * Math.PI) / 2)], [T.snap + 0.14, 4.02, ease.out]];
  const bodyLift = [[T.dropStart, 0], [T.gone, -1.1, ease.in]];
  const strain = [[T.rim, 0], [T.snap - 0.02, 1, ease.in], [T.snap + 0.04, 0, ease.out]]; // leaning into the leash
  const drain = [[T.rim, 0], [T.snap, 0.94, ease.inOut], [T.snap + 0.06, 1, ease.out]]; // her colour leaving her

  // ---------- the stain's life ----------
  const coatX = [[T.rim, 3], [T.snap - 0.02, 3.16, ease.inOut], [T.snap + 0.08, 2.92, ease.out], [T.snap + 0.32, 3, ease.inOut]]; // dragged a little, digging in
  const coatOn = [[T.rim - 0.02, 0], [T.rim + 0.02, 1]];
  const drainCoat = [[T.bolt - 0.02, 1], [T.bolt + 0.5, 0, ease.inOut]];

  // ---------- Theo ----------
  const aim = (x, y) => Math.atan2(-(x - 5), -(y - 3));
  const theoLook = [[T.snap - 0.05, 0], [T.snap + 0.25, aim(3, 1), ease.inOut], [T.shiver + 0.1, aim(3, 1)], [underTheo - 0.12, aim(3.6, 2.4), ease.inOut], [passTheo + 0.25, 0.25, ease.inOut], [T.end - 0.2, 0, ease.inOut]];
  const theoBodyPitch = [[T.snap + 0.1, 0], [T.snap + 0.4, 0.14, ease.inOut], [T.shiver, 0.14], [T.shiver + 0.1, -0.12, ease.out], [underTheo - 0.1, -0.05], [underTheo, -0.25, ease.out], [passTheo + 0.1, 0.05], [T.end, 0]];
  const theoLift = [[underTheo - 0.1, 0], [underTheo - 0.02, 0.34, ease.out], [passTheo, 0.36], [passTheo + 0.1, 0, ease.in]];
  const theoSy = [[underTheo - 0.14, 1], [underTheo - 0.1, 0.86, ease.out], [underTheo - 0.02, 1.16, ease.out], [passTheo, 1.05], [passTheo + 0.1, 1], [passTheo + 0.15, 0.84, ease.out], [passTheo + 0.32, 1, ease.out]];
  const theoShiver = passTheo + 0.3; // he shivers too, the same little shiver

  // ---------- run ----------
  const t0 = lab.t;
  let now = 0;
  const eyeBase = new THREE.Color(3.2, 3.1, 2.9);
  const dark = new THREE.Color(0x14171c);
  const shiver = (t, t1) => (t > t1 && t < t1 + 0.18 ? Math.sin((t - t1) * 70) * (1 - (t - t1) / 0.18) : 0);

  const stop = lab.every((dt, t) => {
    now = t - t0;
    const x = key(now, bodyX);
    const st = key(now, strain);
    maya.set({ x, lift: key(now, bodyLift), visible: now < T.gone, trail: now < T.rim });

    // the stain
    const on = key(now, coatOn);
    coat.visible = on > 0 && now < T.end;
    const cx = key(now, coatX);
    coat.position.copy(lab.pos(now < T.rim ? x : cx, 1));
    coat.rotation.y = facing(1);
    // stretch toward the body while the leash holds; jelly after the snap
    const pull = now < T.snap ? Math.max(0, x - cx) : 0;
    const jelly = now > T.snap ? Math.sin((now - T.snap) * 34) * Math.exp(-(now - T.snap) * 7) * 0.22 : 0;
    const sh = shiver(now, T.shiver) * 0.17;
    const dr = key(now, drainCoat);
    // local z is "forward" (she faces east): stretch forward, squash sideways
    inner.scale.set(S * (1 - 0.16 * pull + jelly * 0.6 + sh) * (0.35 + 0.65 * dr), S, S * (1 + 0.42 * pull - jelly + sh) * (0.35 + 0.65 * dr));
    inner.position.z = -0.2 * pull;
    const lit = on * dr;
    for (const c of copies) c.material.opacity = (c.material.map ? 0.75 : 0.9) * lit * (1 + 0.4 * st);
    stainMat.opacity = 0.7 * lit * (now < T.rim ? 0 : clamp((now - T.rim) / 0.15));
    coreMat.opacity = 0.5 * lit * clamp((now - T.rim) / 0.2) + 0.5 * clamp(1 - Math.abs(now - T.shiver - 0.08) / 0.12);
    const peer = key(now, [[T.peer, 0], [T.peer + 0.12, 1, ease.out], [T.shiver, 1], [T.shiver + 0.1, 0.4]]);
    eye.position.z = -0.15 - 0.08 * peer; // the eye light leans after her
    eye.scale.set(1 + 0.4 * peer, 1 + 0.6 * peer, 1);
    eyeMat.opacity = lit * (now < T.rim ? 0 : 1) * (1 + 0.6 * peer);

    // the leash
    if (now >= T.rim && now < T.snap + 0.1) {
      // taut while it holds; after the snap it whips back into the stain
      const a = coat.position.x + 0.25;
      const back = lab.pos(x - 0.28, 1).x;
      const c = now < T.snap ? back : lerp(back, a, ease.out(clamp((now - T.snap) / 0.1)));
      leash.visible = true;
      leash.position.set((a + c) / 2, 0.009, coat.position.z);
      const len = Math.max(0.01, c - a);
      leash.scale.set(len + 0.35, 0.36 * (1 - 0.7 * st) + 0.04, 1);
      leashMat.opacity = 1.2 * clamp(len / 0.12);
    } else leash.visible = false;

    // threads
    for (const th of threads) drawThread(th, now);

    // Theo
    const ts = key(now, theoSy);
    const tsh = shiver(now, theoShiver) * 0.08;
    theo.set({ rot: key(now, theoLook), lift: key(now, theoLift), sy: ts, sx: 1 / Math.sqrt(ts) + tsh, sz: 1 / Math.sqrt(ts) - tsh });
  });

  maya.each = (m) => {
    const d = key(now, drain);
    m.paint.color.copy(RED).lerp(dark, d);
    m.paint.emissiveIntensity = 0.16 * (1 - d);
    m.eyeMat.color.copy(eyeBase).multiplyScalar(1 - d);
    m.ringMat.opacity = 0.9 * (1 - d);
    m.poolMat.opacity = 0.75 * (1 - d);
    m.body.rotation.x = -(0.2 * key(now, strain) + (now > T.snap && now < T.dropStart + 0.1 ? 0.25 * Math.sin(clamp((now - T.snap) / 0.25) * Math.PI) : 0));
    if (b.card) b.card.visible = maya.pose.lift > -0.2;
  };
  theo.each = (m) => {
    m.body.rotation.x = -key(now, theoBodyPitch);
  };
  lab.cleanup(() => {
    maya.model.paint.color.copy(RED);
    glowTex.dispose();
  });

  await lab.wait(T.end);
  stop();
  coat.visible = false;
  maya.model.paint.color.copy(RED);
  maya.each = null;
  theo.each = null;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
}
