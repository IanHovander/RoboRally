// Euler's disk, shot as a long exposure. A hoop of Maya's light drops down the column, lands on its edge and
// spins down like a settling coin while the room's lights go down and the camera leans in low; its rim smears
// into a bowl of light (the shutter is open) and its top glint paints a spiral. Click: the shutter closes, the
// hoop is flat and sharp, a beat of stillness, then the lights snap back on and the hoop tightens into the
// game's own taken ring at the column's foot.
export const meta = {
  title: "Euler's disk, long exposure",
  idea:
    "A hoop of Maya's red light drops down the flag's column and spins down around her like a settling coin, shot like a long-exposure photo: the room goes dark and the camera leans in low, the speeding wobble smears into a glowing bowl and its glint paints a tightening spiral. Click: the blur snaps sharp and flat, one beat of stillness in the dark, then the lights cut back on and the hoop cinches into her taken ring.",
  notes:
    'Sound: a rising glass whirr whose pitch climbs with the wobble rate (it is a drumroll), a dry glass click at the end, a hush for 0.12 s, then the room tone returning with the lights. Port: the hoop and ghosts are a handful of torus meshes sharing one geometry; the spiral is a Points buffer. The camera move is moderate (a handful of claims per game). On a flag others already hold, end the hoop at y = 0.06 + 0.07 * i so it settles on top of their rings, like setTaken stacks them.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const maya = lab.bot('a');
  const RED = maya.color;
  const P = lab.pos(4, 1);
  const col = arena.columns.find((c) => c.n === 1);

  // ---------- a soft round sprite for glints and paint ----------
  const dot = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---------- the hoop, its ghosts (the open shutter), its glint and the spiral it paints ----------
  const R = 0.64;
  const hoopGeo = new THREE.TorusGeometry(R, 0.022, 8, 140).rotateX(-Math.PI / 2); // flat on the glass by default
  const mk = (k) => {
    const m = new THREE.Mesh(hoopGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.order = 'YXZ';
    m.renderOrder = 8;
    m.visible = false;
    return lab.add(m);
  };
  const hoop = mk(2.6);
  const GHOSTS = 14;
  const ghosts = Array.from({ length: GHOSTS }, () => mk(1));
  const glint = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color('#fff2e6').multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  glint.scale.setScalar(0.16);
  glint.visible = false;

  const CAP = 2000;
  const tPos = new Float32Array(CAP * 3);
  const tCol = new Float32Array(CAP * 3);
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tGeo.setDrawRange(0, 0);
  const tMat = new THREE.PointsMaterial({ size: 0.07, map: dot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const trace = lab.add(new THREE.Points(tGeo, tMat));
  trace.frustumCulled = false;
  trace.renderOrder = 9;
  let paint = []; // { t, x, y, z }
  const LIFE = 0.7;

  // ---------- Euler's disk: the tilt drops, the wobble speeds up, both reach the end together ----------
  const A0 = 1.32; // lands nearly upright
  const SPIN = 1.42; // scene seconds from landing to the click
  const W0 = 8; // wobble rate at landing (rad/s); it grows to ~5x by the click
  const state = (u) => {
    if (u < 0) return { a: A0 + 0.08, ph: 1.6 * u }; // falling: upright, turning slowly
    const s = Math.max(0, 1 - u / SPIN);
    return { a: A0 * Math.pow(s, 0.55), ph: (W0 * SPIN * (1 - Math.pow(s, 0.6))) / 0.6 };
  };
  const place = (m, a, ph, r = 1, y0 = 0) => {
    m.position.set(P.x, y0 + R * r * Math.sin(a), P.z);
    m.rotation.set(a, ph, 0);
    m.scale.setScalar(r);
  };
  const top = (a, ph, y0 = 0) => new THREE.Vector3(P.x - R * Math.cos(a) * Math.sin(ph), y0 + 2 * R * Math.sin(a), P.z - R * Math.cos(a) * Math.cos(ph));

  // ---------- the timeline ----------
  let land = Infinity; // scene time the hoop lands
  let drop = null; // { t0 } while falling
  let spinning = false;
  let shutter = 0; // how long the shutter is open (scene s)
  let lastPaint = 0;
  let hold = 0; // the column's own light, kept warm white while the room dims
  let traceGain = 1;
  let labelFade = 1; // the card over Maya and the name tags come back as the camera goes home
  const stop = lab.every((dt, t) => {
    if (labelFade < 1) {
      if (maya.card) maya.card.material.opacity *= labelFade;
      for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity *= labelFade;
    }
    // the column stays warm white whatever the room does
    if (hold > 0) {
      const breathe = 0.9 + Math.sin(t * 1.1 + 1) * 0.1;
      col.mat.color.set(lab.PALETTE.light).multiplyScalar(breathe * (0.45 + 0.55 * (1 - arena.dimCur)) * (1 - hold) + breathe * 1.05 * hold);
    }
    if (drop) {
      const k = Math.min(1, (t - drop.t0) / drop.dur);
      const y = drop.from * (1 - k * k); // accelerating down the column
      const st = state(-(drop.dur - (t - drop.t0)));
      hoop.visible = true;
      place(hoop, st.a, st.ph, 1, y);
      hoop.material.opacity = Math.min(1, k * 4);
      glint.visible = true;
      glint.position.copy(top(st.a, st.ph, y));
      if (k >= 1) drop = null;
    }
    if (spinning) {
      const u = t - land;
      const st = state(u);
      place(hoop, st.a, st.ph);
      // a small hop when it lands on its edge
      if (u < 0.22) hoop.position.y += Math.sin((u / 0.22) * Math.PI) * 0.06;
      glint.position.copy(top(st.a, st.ph));
      glint.material.opacity = 0.5 + 0.5 * Math.min(1, st.a / 0.6);
      // the shutter: ghosts at earlier moments smear the fast wobble into a bowl of light
      shutter = 0.07 + 0.06 * Math.min(1, u / SPIN);
      ghosts.forEach((g, i) => {
        const back = ((i + 1) / GHOSTS) * shutter;
        const sg = state(u - back);
        g.visible = u - back > 0;
        place(g, sg.a, sg.ph);
        g.material.opacity = 0.55 * (1 - i / GHOSTS) * Math.min(1, u / 0.3);
      });
      // light painting: the glint's path, sampled finely between frames
      for (let tt = Math.max(lastPaint, land); tt < t; tt += 1 / 1200) {
        const s2 = state(tt - land);
        const p = top(s2.a, s2.ph);
        paint.push({ t: tt, x: p.x, y: p.y, z: p.z });
      }
      lastPaint = t;
    }
    // draw the painted spiral: newest bright, older fading out
    paint = paint.filter((p) => t - p.t < LIFE);
    if (paint.length > CAP) paint = paint.slice(paint.length - CAP);
    const red = new THREE.Color(RED);
    const warm = new THREE.Color('#fff0e0');
    paint.forEach((p, i) => {
      const age = (t - p.t) / LIFE;
      const k = (1 - age) ** 2 * 1.6 * traceGain;
      const c = warm.clone().lerp(red, Math.min(1, age * 2.5));
      tPos.set([p.x, p.y, p.z], i * 3);
      tCol.set([c.r * k, c.g * k, c.b * k], i * 3);
    });
    tGeo.attributes.position.needsUpdate = true;
    tGeo.attributes.color.needsUpdate = true;
    tGeo.setDrawRange(0, paint.length);
  });
  lab.cleanup(() => {
    stop();
    hoopGeo.dispose();
    tGeo.dispose();
    dot.dispose();
  });

  // ---------- camera: leans in low as the hoop lands, drifts round with the wobble, whips home at the click ----------
  let cam = 0;
  let orbit = 0;
  const releaseCam = lab.camera((home) => {
    const k = cam;
    const tgt = home.target.clone().lerp(new THREE.Vector3(P.x, 0.3, P.z), 0.78 * k);
    return { target: tgt, dist: home.dist * (1 - 0.46 * k), el: home.el - 0.3 * k, az: orbit * k };
  });

  // 1. the game's own move: Move 2 onto the flag (0.6 s)
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.2);
  // 2. the hoop comes down the column as she arrives
  drop = { t0: lab.t, dur: 0.42, from: 2.7 };
  hold = 1;
  lab.tween(0.95, (e) => (cam = e), ease.inOut);
  await lab.wait(0.42);
  // 3. it lands on its edge: a clink of light, the room goes down, the wobble starts
  land = lab.t;
  lastPaint = land;
  spinning = true;
  lab.ring(P, lab.PALETTE.light, 0.55, 0.02, 0.45);
  arena.setDim(0.75);
  arena.focusOn = 'a'; // hides the cards and name tags in the close-up
  lab.tween(SPIN, (e) => (orbit = -0.32 * e), ease.inOut);
  await lab.wait(SPIN);

  // 4. CLICK: the shutter closes. The hoop lies flat and sharp; the paint flashes and is gone.
  spinning = false;
  place(hoop, 0, state(SPIN).ph);
  // the last exposure hangs for a moment as a ghost, then is gone
  const o0 = ghosts.map((g) => g.material.opacity);
  lab.tween(0.28, (e) => ghosts.forEach((g, i) => (g.material.opacity = o0[i] * (1 - e) ** 2)), ease.out);
  glint.visible = false;
  hoop.material.color.set(RED).multiplyScalar(4);
  arena.emit('checkpoint', { id: 'a', n: 1 });
  lab.tween(0.3, (e) => (traceGain = 2.2 * (1 - e)), ease.out);
  await lab.wait(0.12); // a held breath in the dark

  // 5. lights back on at once; the hoop cinches into the taken ring; the camera comes home
  arena.dim = 0;
  arena.dimCur = 0;
  arena.focusOn = null;
  lab.tween(0.6, (e) => (labelFade = e), ease.in);
  lab.ring(P, lab.PALETTE.light, 0.9, 0.02, 0.5);
  lab.tween(0.62, (e) => (cam = 1 - e), ease.inOut3);
  await lab.tween(
    0.24,
    (e) => {
      const r = 1 + (0.27 / R - 1) * e;
      place(hoop, 0, state(SPIN).ph, r, 0.06 * e);
      hoop.material.color.set(RED).multiplyScalar(4 - 2.2 * e);
    },
    ease.outBack,
  );
  // hand over to the game's own ring
  arena.setTaken([{ color: RED, cp: 1 }]);
  hoop.visible = false;
  lab.tween(0.3, (e) => (hold = 1 - e));
  await lab.wait(0.3);
  releaseCam();
  void TAU;
}
