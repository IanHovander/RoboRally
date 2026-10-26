// The Dark Gasps, animator b (character acting): the victim discovers he has an audience, and milks it.
export const meta = {
  title: 'The Dark Gasps (b): playing to the crowd',
  idea:
    'Maya shoves Theo, and the dark room turns out to be full: a few dozen warm phone-lights blink on below the slab and jolt up, a murmur. ' +
    'Theo slides to rest, notices them, and has an idea: he rises on tiptoe, swoons and keels over like a footballer taking a dive. ' +
    'The whole arena (hundreds of lights, in tiers all round the slab) gasps upward at once. Maya spins to the crowd, outraged ("I barely touched him!"), Jun lifts an unimpressed visor. ' +
    'The crowd sees through it and sinks back into the dark; Theo peeks, pops upright as if nothing happened, and bows to the faithful few lights that were there from the start, which flicker a little applause and go out.',
  notes:
    'Sound: a soft breathy shimmer of a few chimes for the murmur, a big rising "ooh" made of many tiny glass tones for the gasp, a falling sigh as the lights sink, ' +
    "one small tink for Theo's bow. The crowd's size follows the drama: a plain shove gets only the murmur; a dive like this (or a chain push, or a shove toward a pit) gets the full arena. " +
    "Porting: one THREE.Points cloud (about 750 warm points, vertex colours, additive) in tiers on rounded rectangles around and below the slab; nothing on the board is touched. " +
    'The flop rotates only the body (model.body), so the ring and pointer stay flat and still say where he is and which way he faces.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (T, a, b) => clamp((T - a) / (b - a));
  const bump = (T, a, b) => Math.sin(Math.PI * seg(T, a, b));
  const track = (keys) => (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = ease.inOut] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return lerp(v0, v1, e((T - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  };
  const toward = (fx, fy, tx, ty) => Math.atan2(-(tx - fx), -(ty - fy));
  const unwrapNear = (a, ref) => ref + ((((a - ref + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const eyesOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const mayaEyes = eyesOf(maya.model);
  const junEyes = eyesOf(jun.model);

  // ----- timing (play seconds) -----
  const CONTACT = 0.42;
  const STOP = 0.78;
  const NOTICE = 0.84;
  const TIPTOE = 0.98;
  const DIVE = 1.12;
  const DOWN = 1.32;
  const PEEK = 1.74;
  const UP = 1.9;
  const BOW = 2.04;
  const END = 2.36;
  const SWELL = 1.17; // the whole arena gasps as he goes down
  const SINK = 1.66; // ...and sees through it

  // ----- the crowd: tiers of warm points around and below the slab -----
  const W = 7;
  const H = 4;
  // rows of seats in a bowl: the inner rows lowest, each row a rounded rectangle round the slab
  const tiers = [];
  for (let i = 0; i < 8; i++) {
    const o = 0.95 + 0.42 * i;
    tiers.push({ o, y: -1.55 + 0.15 * i, n: Math.round((22 + 7.2 * o) * 2.1) });
  }
  const pts = [];
  for (const tr of tiers) {
    const hx = W / 2 + tr.o;
    const hz = H / 2 + tr.o;
    const r = tr.o * 0.9;
    // sample a rounded rectangle by its perimeter
    const sx = hx - r;
    const sz = hz - r;
    const per = 4 * sx + 4 * sz + TAU * r;
    for (let i = 0; i < tr.n; i++) {
      let s = ((i + lab.rand() * 0.8) / tr.n) * per;
      let px;
      let pz;
      const sides = [
        [2 * sx, (u) => [-sx + u, -hz]],
        [(Math.PI / 2) * r, (u) => [sx + Math.sin(u / r) * r, -sz - Math.cos(u / r) * r]],
        [2 * sz, (u) => [hx, -sz + u]],
        [(Math.PI / 2) * r, (u) => [sx + Math.cos(u / r) * r, sz + Math.sin(u / r) * r]],
        [2 * sx, (u) => [sx - u, hz]],
        [(Math.PI / 2) * r, (u) => [-sx - Math.sin(u / r) * r, sz + Math.cos(u / r) * r]],
        [2 * sz, (u) => [-hx, sz - u]],
        [(Math.PI / 2) * r, (u) => [-sx - Math.cos(u / r) * r, -sz - Math.sin(u / r) * r]],
      ];
      for (const [len, f] of sides) {
        if (s <= len) {
          [px, pz] = f(s);
          break;
        }
        s -= len;
      }
      if (px == null) [px, pz] = [-sx, -hz];
      const jit = 0.1;
      pts.push({
        x: px + (lab.rand() - 0.5) * jit,
        y: tr.y + (lab.rand() - 0.5) * 0.05,
        z: pz + (lab.rand() - 0.5) * jit,
        b: 0.55 + lab.rand() * 0.75,
        tint: lab.rand(),
        tw: lab.rand() * TAU,
        tws: 5 + lab.rand() * 9,
        early: false,
        lag: lab.rand() * 0.07,
        sinkLag: lab.rand() * 0.22,
        hand: lab.rand(), // how high this one jumps
      });
    }
  }
  // the murmur: a few dozen of them, spread all round, who were already watching
  // (picked from the rows the camera sees: behind the slab and along its sides; a touch brighter, they're closer to their phones)
  const order = pts.map((_, i) => i).filter((i) => pts[i].z < 0.6).sort(() => lab.rand() - 0.5);
  for (const i of order.slice(0, 44)) Object.assign(pts[i], { early: true, b: 1.25 + 0.4 * lab.rand() });

  const N = pts.length;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const crowdMat = new THREE.PointsMaterial({ size: 0.3, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const crowd = new THREE.Points(geo, crowdMat);
  crowd.frustumCulled = false;
  lab.add(crowd);
  const warm = new THREE.Color(1.0, 0.82, 0.6);
  const cool = new THREE.Color(0.86, 0.88, 1.0); // the odd phone on a cold screen

  // ----- the robots' acting -----
  const mayaX = track([[0, 1], [CONTACT, 2.4, (k) => k ** 1.6], [STOP, 3, ease.out]]);
  const theoX = track([[CONTACT, 3], [STOP, 4, ease.out3]]);
  const mayaHome = facing(1);
  const toCrowd = mayaHome - 0.95; // turned toward us, the room
  const mayaRot = track([[SWELL + 0.06, mayaHome], [SWELL + 0.2, toCrowd, ease.outBack], [PEEK - 0.02, toCrowd], [UP + 0.05, mayaHome, ease.inOut]]);
  const junHome = facing(3);
  const junAtCrowd = unwrapNear(facing(2) + 0.2, junHome);
  const junAtTheo = unwrapNear(toward(6, 0, 4, 2), junHome);
  const junRot = track([
    [CONTACT + 0.02, junHome],
    [CONTACT + 0.16, junAtCrowd, ease.outBack],
    [DIVE - 0.02, junAtCrowd],
    [DIVE + 0.12, junAtTheo, ease.out],
    [UP + 0.08, junAtTheo],
    [END - 0.04, junHome, ease.inOut],
  ]);

  let flop = 0; // Theo's body tip (radians), applied to model.body in each()
  let flopLift = 0;
  let theoBow = 0;
  const t0 = lab.t;
  const stop = lab.every(() => {
    const T = lab.t - t0;

    // ---------- Maya ----------
    const recoil = bump(T, SWELL - 0.02, SWELL + 0.22); // "WHAT?"
    const shrug = seg(T, SWELL + 0.22, PEEK - 0.04);
    const shrugRoll = Math.sin(shrug * TAU * 2) * 0.17 * Math.sin(Math.PI * shrug);
    const mPitch = track([[0, 0], [0.3, 0.1], [CONTACT, 0.18, ease.in], [STOP, -0.04, ease.out], [STOP + 0.12, 0.0]])(T) - 0.26 * recoil + 0.08 * bump(T, UP, END);
    maya.set({
      x: mayaX(T) - 0.06 * recoil,
      rot: mayaRot(T),
      pitch: mPitch,
      roll: shrugRoll,
      lift: 0.05 * recoil,
      sy: 1 + 0.1 * recoil - 0.06 * bump(T, SWELL + 0.25, PEEK),
    });

    // ---------- Theo ----------
    // slide, notice, tiptoe, dive, lie there, peek, pop up, bow
    const slideLean = track([[CONTACT, 0], [CONTACT + 0.08, 0.14, ease.out], [STOP, -0.1], [STOP + 0.12, 0]])(T); // lag, then inertia
    const lookUp = bump(T, NOTICE, TIPTOE + 0.06);
    const tiptoe = seg(T, TIPTOE, DIVE) * (1 - seg(T, DIVE, DIVE + 0.06));
    const tipBack = ease.inOut(seg(T, TIPTOE, DIVE)) * (1 - seg(T, DIVE, DIVE + 0.08));
    // the dive: tip east over the right edge, a bounce as he lands, then lying there
    let tip = 0;
    if (T >= DIVE && T < DOWN) tip = 1.38 * ease.outBounce(seg(T, DIVE, DOWN));
    else if (T >= DOWN && T < PEEK) tip = 1.38 + Math.sin(seg(T, 1.46, 1.56) * TAU) * 0.08 * (T < 1.56 ? 1 : 0); // a dying-swan twitch
    else if (T >= PEEK && T < UP) tip = 1.38 - 0.32 * bump(T, PEEK, UP + 0.08); // peeks: is anyone still watching?
    else if (T >= UP) tip = 1.38 * (1 - ease.outBack(seg(T, UP, UP + 0.13)));
    flop = tip;
    flopLift = 0;
    const bow = bump(T, BOW, END - 0.02);
    theoBow = bow;
    const proud = seg(T, UP + 0.1, BOW) * (1 - seg(T, BOW, BOW + 0.06));
    theo.set({
      x: theoX(T),
      pitch: -0.14 * lookUp - 0.2 * tipBack,
      roll: slideLean,
      lift: 0.045 * tiptoe,
      sy: 1 + 0.2 * tiptoe + 0.06 * proud - 0.08 * bump(T, DOWN - 0.12, DOWN),
      sx: 1 - 0.04 * tiptoe,
      sz: 1 - 0.04 * tiptoe,
    });

    // ---------- Jun ----------
    const startle = bump(T, CONTACT, CONTACT + 0.16);
    const pff = bump(T, UP - 0.12, UP + 0.12);
    jun.set({ rot: junRot(T), lift: 0.04 * startle, sy: 1 + 0.06 * startle - 0.07 * pff, pitch: -0.08 * startle + 0.1 * seg(T, DIVE + 0.1, DOWN) * (1 - seg(T, UP, UP + 0.2)) });

    // ---------- the crowd ----------
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const on = p.early ? CONTACT + p.lag * 0.4 : SWELL + p.lag;
      let a = 0;
      let dy = 0;
      if (T >= on) {
        a = seg(T, on, on + 0.05);
        // the jolt: everyone catches their breath together
        const j1 = p.early ? 0.13 * ease.out(seg(T, on, on + 0.11)) : 0;
        const j2 = (0.18 + 0.16 * p.hand) * ease.out(seg(T, SWELL + p.lag * 0.3, SWELL + 0.12 + p.lag * 0.3));
        const hold = Math.sin(T * 31 + p.tw) * 0.008 * seg(T, SWELL + 0.1, SWELL + 0.2); // a trembling held breath
        dy = j1 + j2 + hold;
        // sink back into the dark (the early ones a touch later: the faithful)
        // (the faithful few who were there from the start stay for his bow, and applaud: a quick flicker, then out)
        const sk = p.early ? ease.inOut(seg(T, BOW + 0.1 + p.sinkLag * 0.4, END - 0.01)) : ease.inOut(seg(T, SINK + p.sinkLag, END - 0.08));
        dy -= sk * (0.45 + 0.2 * p.hand);
        a *= 1 - sk;
        if (p.early) a *= 1 - 0.65 * bump(T, BOW - 0.06, END) * (0.5 + 0.5 * Math.sin(T * 70 + p.tw * 3));
        if (!p.early && T < SWELL + 0.02) a = 0;
        a *= 0.82 + 0.18 * Math.sin(T * p.tws + p.tw); // phones twinkle
      }
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y + dy;
      pos[i * 3 + 2] = p.z;
      const c = p.tint > 0.88 ? cool : warm;
      const g = a * p.b * 3.4;
      col[i * 3] = c.r * g;
      col[i * 3 + 1] = c.g * g;
      col[i * 3 + 2] = c.b * g;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  // parts: Theo's body tips over its east edge (the ring stays flat), eyes act
  const base = [3.2, 3.1, 2.9];
  theo.each = (m) => {
    const T = lab.t - t0;
    // facing south, his local -x is east: tip over the edge at local x = -0.27
    const th = flop;
    const bw = 0.42 * theoBow; // the bow tips forward over his nose (his tip, local z = -0.33)
    if (bw > 0.001) {
      m.body.rotation.set(-bw, 0, 0);
      m.body.position.set(0, 0.33 * Math.sin(bw), -0.33 + 0.33 * Math.cos(bw));
    } else {
      m.body.rotation.set(0, 0, th);
      m.body.position.set(-0.27 * (1 - Math.cos(th)) + 0.17 * (th / 1.38), 0.27 * Math.sin(th) + flopLift, 0); // ...and lands back over his ring
    }
    const notice = bump(T, NOTICE, TIPTOE + 0.1);
    const lying = seg(T, DOWN, DOWN + 0.05) * (1 - seg(T, PEEK, PEEK + 0.05));
    const peek = bump(T, PEEK, UP);
    const g = 1 + 0.7 * notice - 0.7 * lying + 0.5 * peek + 0.6 * bump(T, BOW, END);
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  maya.each = (m) => {
    const T = lab.t - t0;
    const wide = bump(T, SWELL - 0.02, SWELL + 0.3);
    const glare = seg(T, SWELL + 0.25, SWELL + 0.35) * (1 - seg(T, PEEK, UP));
    for (const e of mayaEyes) e.scale.set(1 + 0.35 * wide - 0.15 * glare, 1, 1 + 0.6 * wide);
    const g = 1 + 0.8 * wide + 0.2 * glare;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  jun.each = (m) => {
    const T = lab.t - t0;
    // the visor narrows: not buying it
    const lid = seg(T, DOWN, DOWN + 0.12) * (1 - seg(T, UP + 0.15, END));
    for (const e of junEyes) e.scale.set(1, 1 - 0.6 * lid, 1);
    const g = 1 + 0.5 * bump(T, CONTACT, CONTACT + 0.2) - 0.35 * lid;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };

  lab.playCard('a', ['m2']);
  await lab.wait(END);
  stop();
  theo.each = null;
  maya.each = null;
  jun.each = null;
  theo.model.body.position.set(0, 0, 0);
  for (const e of [...mayaEyes, ...junEyes]) e.scale.set(1, 1, 1);
  crowd.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  jun.release({ x: 6, y: 0, d: 3 });
}
