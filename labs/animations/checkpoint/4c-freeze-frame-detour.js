// The detour, cut like a comedy. Maya lands on flag 1, whips round to point at flag 2 and shoots off on a
// diagonal no card allows, the camera leading eagerly after her. A space and a half out her trail goes taut:
// freeze frame, punch-in, the room irises down to her straining at the end of a white-hot elastic of light.
// Time snaps back, the elastic twangs her home onto flag 1, spinning her round to face east, and her ring drops
// down the column into place.
export const meta = {
  title: 'The detour, freeze frame',
  idea:
    "Maya lands on flag 1, whips round to point at flag 2 and shoots off on a diagonal no card allows, the camera eagerly leading after her. A space and a half out, her trail goes taut: freeze frame, punch-in, the room irises down on her straining at the end of a white-hot elastic of light. Then time snaps back and the elastic twangs her home onto flag 1, spinning her round to face east as her red ring drops down the column into place.",
  notes:
    'Sound: a zippy glass whoosh out, a record-scratch-like glass squeak cut to silence on the freeze (a soft "nope" two-tone), then a twang (a plucked glass string) on the yank and a chime as the ring settles. The direction always aims at that robot\'s own next flag, so the gag teaches the race. Port: the elastic is one strip mesh on the glass (40 segments), the iris is a radial gradient in the HUD layer; the freeze is about 0.35 s of real time.',
};

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const rec = lab.bot('a');
  const RED = rec.color;
  const A = lab.pos(4, 1); // flag 1: the anchor
  const col = arena.columns.find((c) => c.n === 1);
  const next = arena.columns.find((c) => c.n === 2);
  const F2 = { x: 1, y: 3 };
  const dir = new THREE.Vector2(F2.x - 4, F2.y - 1).normalize();
  const OUT = 1.5;
  const lookAt = (dx, dz) => Math.atan2(-dx, -dz);
  const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

  const realTween = (dur, fn, easing = ease.inOut) =>
    new Promise((ok) => {
      const t0 = lab.real;
      fn(easing(0), 0);
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });

  // ---------- the elastic: her trail, drawn as a strip on the glass from the flag to her ----------
  const N = 40;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const colr = new Float32Array((N + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geo.setIndex(idx);
  const band = lab.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  band.frustumCulled = false;
  band.renderOrder = 6;
  const B = { tension: 0, amp: 0, wob: 0, on: 0, white: 0 }; // amp: sideways twang; on: brightness
  const red = new THREE.Color(RED);
  const hot = new THREE.Color('#fff4ea');
  const drawBand = (t) => {
    const end = lab.pos(maya.pose.x, maya.pose.y);
    const dx = end.x - A.x;
    const dz = end.z - A.z;
    const len = Math.hypot(dx, dz) || 1e-4;
    const px = -dz / len;
    const pz = dx / len;
    const w = 0.2 / (1 + 2.2 * B.tension); // thins as it stretches
    const c = red.clone().lerp(hot, B.white);
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const off = B.amp * Math.sin(Math.PI * s) * Math.cos(B.wob);
      const x = A.x + dx * s + px * off;
      const z = A.z + dz * s + pz * off;
      const ww = w * (0.55 + 0.45 * s);
      pos.set([x - px * ww, 0.012, z - pz * ww, x + px * ww, 0.012, z + pz * ww], i * 6);
      const k = B.on * (0.5 + 0.5 * s) * (1.6 + 2.2 * B.tension);
      colr.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    band.visible = B.on > 0.01 && len > 0.05;
    void t;
  };

  // the iris for the freeze frame
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  let irisK = 0;
  let irisAt = A.clone();

  let maya = null;
  let labelFade = 1; // the card over Maya and the name tags step out while she misbehaves
  const stop = lab.every((dt, t) => {
    if (maya) drawBand(t);
    if (labelFade < 1) {
      if (rec.card) rec.card.material.opacity *= labelFade;
      for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity *= labelFade;
    }
    if (irisK > 0) {
      const c = lab.toScreen(irisAt);
      const r = 1000 - 700 * irisK;
      iris.style.opacity = String(Math.min(1, irisK * 1.3));
      iris.style.background = `radial-gradient(ellipse at ${c.x}px ${c.y}px, rgba(0,0,0,0) ${r * 0.4}px, rgba(2,3,5,.9) ${r}px)`;
    } else iris.style.opacity = '0';
  });
  lab.cleanup(() => {
    stop();
    geo.dispose();
  });

  // ---------- camera: leads after her, punches in on the freeze, whips home ----------
  let lead = 0;
  let punch = 0;
  const leadAt = new THREE.Vector3(A.x + dir.x * 0.9, 0.2, A.z + dir.y * 0.9);
  const punchAt = new THREE.Vector3(A.x + dir.x * 0.8, 0.2, A.z + dir.y * 0.8);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(leadAt, 0.55 * lead).lerp(punchAt, 0.85 * punch),
    fov: 30 - 4 * lead - 8 * punch,
    el: home.el - 0.05 * punch,
  }));

  // 1. the game's move onto the flag
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.6);
  maya = lab.puppet('a');
  maya.set({ trail: false });
  const east = maya.pose.rot;
  const aim = east + wrap(lookAt(dir.x, dir.y) - east);
  arena.emit('checkpoint', { id: 'a', n: 1 });
  arena.focusOn = 'a';
  labelFade = 0;

  // 2. no pause at all: she whips round to point at flag 2, which flares like a target
  next.flash = arena.time;
  next.flashColor = new THREE.Color(RED);
  await lab.tween(0.1, (e) => maya.set({ rot: east + (aim - east) * e }), ease.out);
  // a crouch: lean back, squash
  await lab.tween(0.12, (e) => maya.set({ pitch: -0.22 * e, sy: 1 - 0.14 * e, sx: 1 + 0.06 * e, sz: 1 + 0.06 * e }), ease.out);

  // 3. ZOOM off on the diagonal; the camera leads after her; her trail streams out behind
  B.on = 1;
  lab.tween(0.42, (e) => (lead = e), ease.out);
  await lab.tween(
    0.3,
    (e, k) => {
      const d = OUT * 0.93 * e;
      maya.set({
        x: 4 + dir.x * d,
        y: 1 + dir.y * d,
        pitch: -0.22 + 0.5 * Math.min(1, k * 3),
        sz: 1 + 0.35 * Math.sin(k * Math.PI), // stretched along her travel
        sx: 1 - 0.12 * Math.sin(k * Math.PI),
        sy: 0.86 + 0.14 * Math.min(1, k * 2),
      });
      B.tension = e * 0.7;
    },
    ease.out,
  );
  // 4. the trail goes taut: she strains at the end of it
  await lab.tween(
    0.12,
    (e, k) => {
      const d = OUT * (0.93 + 0.07 * e);
      maya.set({ x: 4 + dir.x * d, y: 1 + dir.y * d, pitch: 0.28 + 0.06 * Math.sin(k * 40), sz: 1 - 0.1 * e, sx: 1 + 0.05 * e });
      B.tension = 0.7 + 0.3 * e;
      B.white = e;
    },
    ease.out,
  );

  // 5. FREEZE FRAME: punch in, iris down. The elastic hums white-hot.
  lab.slowmo(0.01, 0.04);
  irisAt = new THREE.Vector3(A.x + dir.x * OUT * 0.6, 0.15, A.z + dir.y * OUT * 0.6);
  realTween(0.1, (e) => (punch = e), ease.out3);
  realTween(0.12, (e) => (irisK = e), ease.out);
  await realTween(0.36, (e, k) => {
    B.amp = 0.03 * Math.sin(k * Math.PI);
    B.wob = k * 60;
  }, ease.linear);

  // 6. TWANG: time snaps back, she's yanked home tail-first, spinning round to face east
  lab.slowmo(1, 0.04);
  realTween(0.14, (e) => (irisK = 1 - e), ease.in);
  realTween(0.32, (e) => ((punch = 1 - e), (lead = 1 - e)), ease.inOut3);
  const from = maya.pose.rot;
  const home = east + 2 * Math.PI; // one and a bit turns, ending east
  await lab.tween(
    0.2,
    (e, k) => {
      const d = OUT * (1 - e);
      maya.set({ x: 4 + dir.x * d, y: 1 + dir.y * d, rot: from + (home - from) * ease.out(k), pitch: 0.28 * (1 - k), sz: 1 + 0.3 * Math.sin(k * Math.PI), sx: 1 - 0.1 * Math.sin(k * Math.PI), sy: 1 });
      B.tension = 1 - e;
      B.white = 1 - k;
      B.amp = 0.12 * Math.sin(k * Math.PI);
      B.wob = k * 9;
    },
    ease.in,
  );
  // 7. home: a thump, the elastic snaps away, a little overshoot and settle
  lab.shake(0.05, 0.2);
  B.on = 0;
  lab.ring(A, RED, 0.9, 0.02, 0.45);
  col.flash = arena.time;
  col.flashColor = new THREE.Color(RED);
  lab.tween(
    0.34,
    (e, k) => {
      const o = -0.14 * Math.exp(-k * 6) * Math.sin(k * Math.PI * 3);
      maya.set({ x: 4 + dir.x * o, y: 1 + dir.y * o, sy: 1 - 0.12 * Math.exp(-k * 5) * Math.cos(k * 12), sx: 1, sz: 1, pitch: 0 });
    },
    ease.linear,
  );
  // her red ring drops down the column and settles at its foot
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = lab.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 64).rotateX(Math.PI / 2), ringMat));
  ring.position.copy(A);
  await lab.tween(
    0.3,
    (e, k) => {
      ring.position.y = 1.5 * (1 - k * k) + 0.06 * k * k;
      ring.scale.setScalar(0.62 - 0.35 * k * k);
    },
    ease.linear,
  );
  arena.setTaken([{ color: RED, cp: 1 }]);
  arena.focusOn = null;
  lab.tween(0.4, (e) => (labelFade = e), ease.in);
  lab.ring(A, lab.PALETTE.light, 0.5, 0.03, 0.35);
  ring.visible = false;
  await lab.wait(0.1);
  maya.set({ x: 4, y: 1, sx: 1, sy: 1, sz: 1, pitch: 0 });
  maya.release({ x: 4, y: 1, d: 1 });
  maya = null;
  await lab.wait(0.05);
  releaseCam();
}
