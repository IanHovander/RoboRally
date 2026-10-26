// Domino run, filmed like a sports replay: a plan view of the setup, a low rail-cam riding the falling front,
// each falling pane painting its arc in light (a long exposure), slow motion on the last few, a freeze on
// the tap, and the whole run sinking back into the glass as a ladder of light.
export const meta = {
  title: 'Domino run',
  idea:
    'Maya lands on flag 2. The camera rises to a plan view as thin panes of glass, lit along their top edges, rise out of the glass in a curve from her square, round the board and up to Theo. Stillness. Maya backs a hair and taps the first pane with her tail: the run topples, each falling edge painting a quarter-arc of light like a long exposure, while the camera drops to the glass and rides the front. Theo sees it coming and leans away; the last panes go into slow motion, freeze on the tap on his nose, and he rocks and settles, still facing west. The panes lie flat and sink into the glass as rungs of light that fade back to Maya.',
  notes:
    'Sound: a glass chime a step higher for every pane (a rising scale), the first few spaced, then quickening; on the slow motion the chimes stretch into long tones, silence on the freeze, a soft bonk on Theo, then a descending shimmer as the rungs go out. Port: the run snakes toward the nearest rival, panes 0.33 apart on a smooth curve; the light arcs are ribbons drawn by each pane\'s top edge as it falls.',
};

const RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const A = lab.arena;
  lab.cleanup(() => (A.showNames = true));
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const W = (x, y) => lab.pos(x, y);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const warm = new THREE.Color('#fff1dc');

  // ---------- the run: a smooth curve from Maya's tail round to Theo's nose ----------
  const curve = new THREE.CatmullRomCurve3(
    [[3.5, 1.0], [2.7, 1.2], [2.2, 1.95], [2.5, 2.8], [3.4, 3.15], [4.3, 3.0]].map(([x, y]) => W(x, y)),
    false,
    'centripetal',
  );
  const H = 0.5; // pane height
  const PW = 0.5; // pane width
  const T = 0.03; // thickness
  const GAP = 0.39;
  const L = curve.getLength();
  const N = Math.floor(L / GAP) + 1;
  const panes = [];
  const edgeGeo = new THREE.BoxGeometry(PW, 0.022, 0.034);
  const sideGeo = new THREE.BoxGeometry(0.014, H, 0.03);
  const glassGeo = new THREE.BoxGeometry(PW, H, T);
  for (let i = 0; i < N; i++) {
    const u = Math.min(1, (i * GAP) / L);
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const g = new THREE.Group();
    g.position.set(p.x, -H - 0.05, p.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(tan.x, tan.z);
    const tilt = new THREE.Group(); // pivots on the front edge of its foot
    tilt.position.z = T / 2;
    g.add(tilt);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c222c, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.55, emissive: 0x6c7a90, emissiveIntensity: 0.32 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, H / 2, -T / 2);
    tilt.add(glass);
    const edgeMat = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, H, -T / 2);
    tilt.add(edge);
    const sideMat = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(0.16), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(sideGeo, sideMat);
      side.position.set((sx * PW) / 2, H / 2, -T / 2);
      tilt.add(side);
    }
    lab.add(g);
    panes.push({ g, tilt, glassMat, edgeMat, sideMat, p, tan, theta: 0, fell: false, flash: -9, u });
  }
  // the last pane leans on Theo's nose
  const theoNose = W(5, 3).x - 0.42;
  const last = panes[N - 1];
  const reach = clamp((theoNose - last.p.x) / H, 0.2, 0.98);
  const LAST_REST = Math.asin(reach);
  const HIT = Math.asin(Math.min(0.98, GAP / H));
  const REST = 1.2;

  // ---------- light painting: each falling top edge draws its arc ----------
  const arcs = [];
  const ARC_N = 18;
  function makeArc(pn) {
    const pos = new Float32Array(ARC_N * 2 * 3);
    const col = new Float32Array(ARC_N * 2 * 3);
    const idx = [];
    for (let j = 0; j < ARC_N - 1; j++) idx.push(2 * j, 2 * j + 1, 2 * j + 2, 2 * j + 1, 2 * j + 3, 2 * j + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    lab.add(mesh);
    const a = { pn, mesh, pos, col, born: A.time, maxTheta: 0 };
    arcs.push(a);
    return a;
  }
  const across = new THREE.Vector3();
  const paintArcs = () => {
    for (const a of arcs) {
      const pn = a.pn;
      a.maxTheta = Math.max(a.maxTheta, pn.theta);
      const fwd = pn.tan.clone().setY(0).normalize();
      across.set(-fwd.z, 0, fwd.x);
      const age = A.time - a.born;
      const fade = clamp(1 - (age - 0.2) / 0.5) * arcFade.k;
      for (let j = 0; j < ARC_N; j++) {
        const th = (a.maxTheta * j) / (ARC_N - 1);
        const r = H + 0.005;
        const c = pn.p.clone().add(fwd.clone().multiplyScalar(Math.sin(th) * r + T / 2)).setY(Math.cos(th) * r + pn.g.position.y);
        const w = 0.012 + 0.03 * (j / (ARC_N - 1));
        a.pos.set([c.x - across.x * w, c.y, c.z - across.z * w, c.x + across.x * w, c.y, c.z + across.z * w], j * 6);
        const k = 1.0 * fade * (0.1 + 0.9 * (j / (ARC_N - 1)) ** 2);
        a.col.set([warm.r * k, warm.g * k, warm.b * k, warm.r * k, warm.g * k, warm.b * k], j * 6);
      }
      a.mesh.geometry.attributes.position.needsUpdate = true;
      a.mesh.geometry.attributes.color.needsUpdate = true;
    }
  };
  const arcFade = { k: 1 };

  // every frame: pose the panes, their impact flashes
  const stopPanes = lab.every(() => {
    for (const pn of panes) {
      pn.tilt.rotation.x = pn.theta;
      const f = clamp(1 - (A.time - pn.flash) / 0.3);
      const lit = pn.done ? 1.3 : 1.0 + 1.6 * clamp(pn.theta / 0.6);
      pn.edgeMat.color.copy(warm).multiplyScalar(lit + 3.5 * f);
    }
    paintArcs();
  });

  // ---------- the camera ----------
  const cam = { plan: 0, ride: 0, push: 0 };
  const front = W(3.5, 1).clone();
  let frontWant = W(3.5, 1).clone();
  let lastT = A.time;
  const releaseCam = lab.camera((home, t) => {
    const dt = Math.max(0, t - lastT);
    lastT = t;
    front.lerp(frontWant, 1 - Math.exp(-dt * 4));
    const target = home.target.clone().lerp(front, 0.45 * cam.ride + 0.5 * cam.push).add(new THREE.Vector3(0, 0, -0.1 * cam.plan));
    A.showNames = cam.ride + cam.push < 0.15;
    return {
      target,
      el: home.el + 0.42 * cam.plan - 0.3 * cam.ride - 0.04 * cam.push,
      dist: home.dist * (1 + 0.04 * cam.plan - 0.22 * cam.ride - 0.26 * cam.push),
      az: -0.18 * cam.ride + 0.08 * cam.push,
    };
  });

  // ---------- 1. Move 2 onto flag 2 ----------
  lab.playCard('a', ['m2']);
  await lab.wait(0.12);
  await lab.tween(0.66, (e) => maya.set({ x: 2 + 2 * e }), ease.inOut);
  A.clearCards();
  const col2 = A.columns.find((c) => c.n === 2);
  if (col2) {
    col2.flash = A.time;
    col2.flashColor = new THREE.Color(RED);
  }
  lab.ring(W(4, 1), RED, 1.3, 0.02, 0.8);
  A.emit('checkpoint', { id: 'a', n: 2 });
  A.emit('win', { id: 'a' });

  // ---------- 2. plan view: the panes rise out of the glass, from her square outward ----------
  lab.tween(0.6, (e) => (cam.plan = e), ease.inOut);
  await lab.tween(0.5, (e, k) => {
    for (let i = 0; i < N; i++) {
      const kk = clamp((k - (i / N) * 0.55) / 0.45);
      panes[i].g.position.y = -H - 0.05 + (H + 0.05) * ease.outBack(kk);
    }
  }, ease.linear);
  await lab.wait(0.18); // stillness

  // ---------- 3. Maya taps the first pane with her tail; the run goes ----------
  lab.tween(0.6, (e) => {
    cam.plan = 1 - e;
    cam.ride = e;
  }, ease.inOut);
  await lab.tween(0.1, (e) => maya.set({ x: 4 - 0.1 * e, pitch: 0.06 * e }), ease.in);
  lab.tween(0.25, (e) => maya.set({ x: 3.9 + 0.1 * e, pitch: 0.06 * (1 - e) }), ease.out);

  // theta of each pane over time: falls to HIT (gravity), then settles onto the next
  const fall = (pn, dur, to = HIT, then = REST) => {
    pn.fell = true;
    makeArc(pn);
    return lab.tween(dur, (e) => (pn.theta = to * e), ease.in).then(() => {
      pn.flash = A.time;
      pn.done = true;
      lab.tween(0.25, (e) => (pn.theta = to + (then - to) * e), ease.out);
    });
  };
  for (let i = 0; i < N - 1; i++) {
    frontWant = panes[Math.min(N - 1, i + 1)].p.clone();
    // quickening: the first panes are spaced, then the run gathers speed
    const dur = 0.13 - 0.06 * clamp(i / 6);
    if (i === N - 4) lab.slowmo(0.35, 0.15); // the last few in slow motion
    if (i === N - 4) {
      // Theo sees it coming and leans away
      lab.tween(0.45, (e) => theo.set({ pitch: -0.2 * e, sy: 1 - 0.05 * e }), ease.out);
      lab.tween(0.5, (e) => (cam.push = e), ease.inOut);
    }
    await fall(panes[i], dur);
  }
  // the last pane: onto Theo's nose; freeze on the tap
  await lab.tween(0.13, (e) => (last.theta = LAST_REST * e), ease.in);
  makeArc(last).maxTheta = LAST_REST;
  last.flash = A.time;
  lab.timeScale = 0.03;
  lab.ring(W(4.6, 3).setY(0.3), '#fff1dc', 0.25, 0.3, 0.3);
  await lab.waitReal(0.32);
  lab.slowmo(1, 0.16);
  // Theo rocks back and settles, still facing west
  await lab.tween(0.55, (e, k) => {
    const s = Math.sin(k * Math.PI * 3.2) * (1 - k) ** 1.6;
    theo.set({ pitch: -0.2 * (1 - Math.min(1, k * 3)) - 0.16 * s, sy: 1 - 0.05 * (1 - Math.min(1, k * 3)) + 0.04 * Math.abs(s), rot: facing(3) });
    last.theta = LAST_REST - 0.12 * s;
  }, ease.linear);
  theo.set({ pitch: 0, sy: 1 });

  // ---------- 4. the run lies flat and sinks into the glass as rungs of light ----------
  lab.tween(0.8, (e) => (cam.ride = 1 - e, cam.push = 1 - e), ease.inOut);
  await lab.tween(0.3, (e, k) => {
    for (let i = 0; i < N; i++) {
      const kk = clamp((k - (i / N) * 0.5) / 0.5);
      const from = i === N - 1 ? LAST_REST : REST;
      panes[i].theta = from + (Math.PI / 2 - from) * ease.in(kk);
    }
  }, ease.linear);
  for (const pn of panes) pn.flash = A.time - 0.15;
  await lab.tween(0.5, (e, k) => {
    for (let i = 0; i < N; i++) {
      // the glass goes first, the rung of light lingers, fading back toward Maya
      const j = N - 1 - i;
      const kk = clamp((k - (j / N) * 0.45) / 0.55);
      panes[i].glassMat.opacity = 0.55 * (1 - Math.min(1, kk * 2.5));
      panes[i].sideMat.opacity = 1 - Math.min(1, kk * 2.5);
      panes[i].edgeMat.opacity = 1 - kk;
      panes[i].g.position.y = -0.02 * kk;
    }
    arcFade.k = 1 - k;
  }, ease.linear);
  for (const pn of panes) pn.g.visible = false;
  for (const a of arcs) a.mesh.visible = false;
  stopPanes();
  A.showNames = true;
  releaseCam();
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
}
