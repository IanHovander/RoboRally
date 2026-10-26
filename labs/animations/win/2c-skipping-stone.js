// Skipping stone, staged like a sports shot: the camera drops to water level and rides along with her,
// a freeze-frame at the lip of the board, then the dark turns out to be still water.
export const meta = {
  title: 'Skipping stone',
  idea:
    'Maya plays Move 2, flashes through flag 2 and keeps going, straight off the east edge. Freeze: she hangs over the void, nose down, the camera punched in at water level. Then she touches the dark and it rings like water: four skips, each shorter and lower, every touch blooming rings of light with her reflection under her, curving round the end of the slab. She skims back up onto the glass past a flinching Theo, spins down onto flag 2 like a stone wobbling to rest, and the column fills red.',
  notes:
    'Sound: the move, a held breath (all sound drops out on the freeze), then four bright water-glass plinks rising in pitch as the skips get shorter, a soft hiss on the skim, a whirr that speeds up as she wobbles down and one clean chime when she stops. The camera is the show: it pans with her, drops to water level so the ripples read as ellipses and her reflection appears, then eases home during the slide back. Port: it is a win-only flourish (the winner is safe); per form, an Orb rolls a lap of the rim, a Spire spins round like a top, a Capsule bobs like a float.',
};

const RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const W = (x, y) => lab.pos(x, y);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const red = new THREE.Color(RED);
  const warm = new THREE.Color('#fff1dc');

  // ---------- water: rings of light where she touches the dark ----------
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.955, 1, 96);
  function ripple(x, y, { size = 0.8, n = 3, gap = 0.1, dur = 1.1, peak = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: warm.clone().lerp(red, 0.25 + i * 0.25).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      const p = W(x, y);
      m.position.set(p.x, 0.004, p.z);
      m.scale.setScalar(0.01);
      lab.add(m);
      rings.push({ m, t0: A.time + i * gap, dur: dur * (1 - i * 0.12), size: size * (1 - i * 0.22), peak: peak * (1 - i * 0.25) });
    }
  }
  // a soft glint on the water at each touch
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glints = [];
  function glint(x, y, k = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: warm.clone().lerp(red, 0.4).multiplyScalar(1.6 * k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    const p = W(x, y);
    m.position.set(p.x, 0.006, p.z);
    lab.add(m);
    glints.push({ m, t0: A.time, dur: 0.5 });
  }
  const stopFx = lab.every(() => {
    const t = A.time;
    for (const r of rings) {
      const k = (t - r.t0) / r.dur;
      if (k < 0) continue;
      if (k >= 1) {
        r.m.visible = false;
        continue;
      }
      r.m.scale.setScalar(0.04 + (1 - (1 - k) ** 3) * r.size);
      r.m.material.opacity = r.peak * Math.min(1, k * 12) * (1 - k) ** 1.4;
    }
    for (const gl of glints) {
      const k = (t - gl.t0) / gl.dur;
      gl.m.visible = k < 1;
      const s = 0.35 + 0.5 * k;
      gl.m.scale.set(s, s, 1);
      gl.m.material.opacity = Math.max(0, 1 - k) ** 2;
    }
  });

  // ---------- her reflection in the water (only while she's off the glass) ----------
  const refl = maya.model.body.clone(true);
  const reflMats = [];
  refl.traverse((o) => {
    if (o.isMesh) {
      const m = o.material.clone();
      m.transparent = true;
      m.depthWrite = false;
      m.opacity = 0;
      o.material = m;
      o.castShadow = false;
      reflMats.push(m);
    }
  });
  const reflG = new THREE.Group();
  reflG.rotation.order = 'YXZ';
  reflG.add(refl);
  lab.add(reflG);
  // (in maya.each: the pose has been applied by then)
  maya.each = () => {
    const g = maya.group;
    const q = maya.pose;
    reflG.position.set(g.position.x, -g.position.y, g.position.z);
    reflG.rotation.set(-g.rotation.x, g.rotation.y, -g.rotation.z);
    reflG.scale.set(g.scale.x, -g.scale.y, g.scale.z);
    refl.position.copy(maya.model.body.position);
    const off = clamp((q.x - 6.55) / 0.25) * clamp((9.5 - q.x) / 1);
    for (const m of reflMats) m.opacity = 0.3 * off;
    reflG.visible = off > 0.01;
  };

  // ---------- the camera: follows her down to water level ----------
  const cam = { w: 0, fov: 0, punch: 0, az: 0 };
  const focus = W(2, 1).clone();
  let lastT = A.time;
  const releaseCam = lab.camera((home, t) => {
    const dt = Math.max(0, t - lastT);
    lastT = t;
    const q = maya.pose;
    focus.lerp(W(q.x, q.y), 1 - Math.exp(-dt * 3.2));
    const w = cam.w;
    const target = home.target.clone().lerp(focus, 0.62 * w).add(new THREE.Vector3(0, 0, 0.35 * w));
    return {
      target,
      el: home.el - 0.5 * w - 0.06 * cam.punch,
      dist: home.dist * (1 - 0.3 * w - 0.12 * cam.punch),
      az: cam.az * w,
      fov: home.fov - 7 * cam.punch,
    };
  });

  const col2 = A.columns.find((c) => c.n === 2);
  const flashCol = (k = 1) => {
    if (!col2) return;
    col2.flash = A.time - (1 - k) * 2.4;
    col2.flashColor = new THREE.Color(RED);
  };

  // real-time tween (for things that must keep moving while the scene is frozen)
  const realTween = (dur, fn, ez = ease.inOut) =>
    new Promise((ok) => {
      const r0 = lab.real;
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - r0) / dur);
        fn(ez(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });

  // ---------- 1. Move 2 ... and she doesn't stop ----------
  lab.playCard('a', ['m2']);
  await lab.tween(0.16, (e) => maya.set({ pitch: -0.12 * e }), ease.out);
  let passed = false;
  lab.tween(1.0, (e) => (cam.w = e * 0.85), ease.inOut);
  await lab.tween(0.95, (e, k) => {
    const x = 2 + 4.5 * k ** 1.25;
    maya.set({ x, pitch: -0.12 + 0.2 * Math.min(1, k * 3) });
    if (!passed && x >= 4) {
      passed = true;
      flashCol(0.5); // she touched it: the column catches, but she's gone
      lab.ring(W(4, 1), RED, 1.2, 0.02, 0.5);
    }
  }, ease.linear);
  A.clearCards();

  // ---------- 2. over the lip: freeze-frame, the gasp ----------
  let frozen = false;
  let thaw = null;
  await lab.tween(0.14, (e, k) => {
    const x = 6.5 + 0.75 * k;
    maya.set({ x, lift: 0, pitch: 0.08 + 0.42 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - k * 0.6) });
    if (!frozen && x > 6.66) {
      frozen = true;
      lab.timeScale = 0.03; // a hard freeze, not a ramp
      realTween(0.07, (e2) => (cam.punch = e2), ease.out);
      thaw = lab.waitReal(0.5).then(() => {
        lab.slowmo(1, 0.14);
        realTween(0.3, (e2) => (cam.punch = 1 - e2), ease.inOut);
      });
    }
  }, ease.linear);
  await thaw;

  // ---------- 3. the dark is water: four skips, each shorter and lower ----------
  const touches = [
    // [x, y, height of the hop that ends here, duration]
    [8.0, 1.5, 0.34, 0.32],
    [8.45, 2.2, 0.24, 0.26],
    [8.35, 2.9, 0.15, 0.21],
    [7.85, 3.3, 0.08, 0.17],
  ];
  // spin: the stone spins clockwise from the first touch until it rests (5 turns, slowing)
  const spin = { u: 0 };
  const SPIN = -Math.PI * 2 * 5;
  const spinRot = () => facing(1) + SPIN * (1 - (1 - spin.u) ** 2.2);
  const touch = (tx, ty, big) => {
    ripple(tx, ty, { size: 0.95 * big, n: 3, peak: 1 });
    glint(tx, ty, big);
    lab.particles(W(tx, ty).setY(0.02), [RED, '#fff1dc'], 10, { speed: 0.9, up: 1.4, gravity: 5, size: 0.035, dur: 0.5 });
    lab.tween(0.1, (e, k) => maya.set({ sy: 1 - 0.28 * Math.sin(k * Math.PI), sx: 1 + 0.16 * Math.sin(k * Math.PI), sz: 1 + 0.16 * Math.sin(k * Math.PI) }), ease.linear);
  };
  touch(7.25, 1.0, 1.25);
  let from = { x: 7.25, y: 1.0 };
  const skipDur = touches.reduce((a, t) => a + t[3], 0);
  lab.tween(skipDur, (e, k) => (spin.u = k * 0.72), ease.linear);
  for (let i = 0; i < touches.length; i++) {
    const [tx, ty, h, d] = touches[i];
    const f = { ...from };
    await lab.tween(d, (e, k) => {
      const x = f.x + (tx - f.x) * k;
      const y = f.y + (ty - f.y) * k;
      maya.set({ x, y, lift: 4 * h * k * (1 - k), pitch: 0.05, roll: 0, rot: spinRot() });
    }, ease.linear);
    touch(tx, ty, 1 - i * 0.14);
    from = { x: tx, y: ty };
  }

  // ---------- 4. skim back up onto the glass, past Theo ----------
  // a skim on the water (little rings in her wake), then the glass, curving into flag 2
  const pts = [
    [7.85, 3.3],
    [7.1, 3.25],
    [6.4, 2.85],
    [5.55, 2.2],
    [4.7, 1.45],
    [4.0, 1.0],
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, 0, y)), false, 'centripetal');
  lab.tween(1.25, (e) => (spin.u = 0.72 + 0.28 * e), ease.out);
  // Theo flinches as she whips past his nose
  lab.at(0.22, () =>
    lab.tween(0.75, (e, k) => {
      const s = Math.sin(k * Math.PI);
      theo.set({ pitch: -0.28 * s * (1 - 0.3 * k), rot: facing(3) + 0.55 * Math.sin(k * Math.PI * 0.9) * (1 - k * 0.4), roll: 0.08 * Math.sin(k * Math.PI * 2) * (1 - k) });
    }, ease.linear).then(() => theo.set({ pitch: 0, roll: 0, rot: facing(3) })),
  );
  let lastWake = 0;
  lab.tween(1.0, (e) => (cam.w = 0.85 * (1 - e)), ease.inOut);
  await lab.tween(1.15, (e, k) => {
    const p = curve.getPointAt(e);
    maya.set({ x: p.x, y: p.z, lift: 0, rot: spinRot(), pitch: 0.04 * (1 - k), sx: 1, sy: 1, sz: 1 });
    if (p.x > 6.55 && A.time - lastWake > 0.05) {
      lastWake = A.time;
      ripple(p.x, p.z, { size: 0.32, n: 1, dur: 0.6, peak: 0.6 });
    }
    if (p.x < 6.6 && p.x > 6.3 && !maya.landed) {
      maya.landed = true;
      lab.ring(W(6.5, 2.85), RED, 0.5, 0.02, 0.35); // back onto the glass
    }
  }, ease.out);

  // ---------- 5. spin down like a stone wobbling to rest, then the column fills ----------
  flashCol(1);
  lab.ring(W(4, 1), RED, 3.2, 0.02, 1.4);
  lab.ring(W(4, 1), '#fff1dc', 1.6, 0.03, 0.9);
  A.emit('checkpoint', { id: 'a', n: 2 });
  await lab.tween(0.55, (e, k) => {
    // Euler's disk: the wobble gets faster and smaller until it stops dead
    const ph = 34 * k + 30 * k * k;
    const amp = 0.16 * (1 - k) ** 1.3;
    maya.set({ x: 4, y: 1, rot: spinRot(), roll: amp * Math.sin(ph), pitch: amp * Math.cos(ph) });
  }, ease.linear);
  maya.set({ roll: 0, pitch: 0, rot: facing(1) + SPIN });
  A.emit('win', { id: 'a' });
  lab.ring(W(4, 1), '#fff1dc', 0.7, 0.03, 0.5);
  await lab.tween(0.25, (e, k) => maya.set({ sy: 1 - 0.08 * Math.sin(k * Math.PI) }), ease.linear);
  await lab.wait(0.3);

  stopFx();
  maya.each = null;
  releaseCam();
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
}
