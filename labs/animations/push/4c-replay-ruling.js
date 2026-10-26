// No Dodging, staged as a sports-replay ruling: Theo's dodge is frozen mid-air like a disputed frame, the lane is
// drawn under the glass like a telestrator line, a leash of light reaches up to him, and when time snaps back he
// is yanked into line, leaving his illegal escape behind as a glass ghost.
export const meta = {
  title: 'Replay Ruling',
  idea:
    "As Maya rolls in, Theo crouches and hops up and sideways toward the room. The picture freezes on him mid-air, like a disputed frame in a replay, and the camera punches in a touch. A thin rail of warm light draws itself under the glass along the row from Maya's nose to space 4, a short leash of light shoots from the rail up to Theo, and time snaps back: he is yanked down into the lane so hard he squashes, leaving his dodge hanging in the air as a fading ghost of light. Maya's nose arrives on that exact beat and shoves him one space east along the rail, still facing south. The rail fades as they settle.",
  notes:
    "Edgar Wright timing: rolling, crouch, hop, a dead stop, the line drawn at speed, then everything at once (the yank, the landing, the hit). The freeze lasts a third of a second and the punch-in is small, so it survives being seen several times a game; the ghost and the rail are made of light and are gone within a second. Variations, chosen per push: hop north, hop south (toward the room, as here), or a duck-and-roll; the ruling is always the same. Sound: a rising boing for the hop cut dead by the freeze (silence), a ruler-on-glass zip for the rail, a twang for the leash, then the clunk of the shove.",
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const P = (x, y) => lab.pos(x, y);
  const warm = new THREE.Color(lab.PALETTE.light);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);

  // ---- the rail (under the glass: drawn just on it, additive) and its end mark ----
  const railMat = new THREE.MeshBasicMaterial({ color: hdr(warm, 1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.026).rotateX(-Math.PI / 2).translate(0.5, 0, 0), railMat);
  rail.renderOrder = 4;
  lab.add(rail);
  const haloMat = new THREE.MeshBasicMaterial({ color: hdr(warm, 0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22).rotateX(-Math.PI / 2).translate(0.5, 0, 0), haloMat);
  lab.add(halo);
  const capMat = new THREE.MeshBasicMaterial({ color: hdr(warm, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.42).rotateX(-Math.PI / 2), capMat);
  cap.position.copy(P(4, 2)).setY(0.012);
  cap.position.x += 0.5;
  lab.add(cap);
  const RAIL0 = 2.35; // Maya's nose when it is drawn (spaces)
  const RAIL1 = 4.5; // the far edge of space 4
  const S = { rail: 0, railA: 0, leash: 0, leashA: 0, punch: 0 };
  // ---- the leash: a thin line of light from the rail to Theo (a stretched box) ----
  const leashMat = new THREE.MeshBasicMaterial({ color: hdr(warm, 2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const leash = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8).translate(0, 0.5, 0), leashMat);
  lab.add(leash);
  const anchor = P(3, 2).setY(0.012);
  const up = new THREE.Vector3(0, 1, 0);
  const stopDraw = lab.every(() => {
    const a = P(RAIL0, 2).setY(0.012);
    rail.position.copy(a);
    halo.position.copy(a).setY(0.01);
    const len = (RAIL1 - RAIL0) * S.rail;
    rail.scale.set(Math.max(0.001, len), 1, 1);
    halo.scale.set(Math.max(0.001, len), 1, 1);
    railMat.opacity = S.railA;
    haloMat.opacity = S.railA * 0.6;
    capMat.opacity = S.railA * Math.max(0, (S.rail - 0.9) / 0.1);
    // leash: from the anchor on the rail toward Theo's body (drawn out by S.leash)
    const to = theo.group.position.clone().add(new THREE.Vector3(0, 0.22, 0));
    const d = to.clone().sub(anchor);
    const L = d.length() * S.leash;
    leash.position.copy(anchor);
    leash.quaternion.setFromUnitVectors(up, d.normalize());
    leash.scale.set(1, Math.max(0.001, L), 1);
    leashMat.opacity = S.leashA;
  });

  // ---- the camera: a small punch-in on the frozen frame (keeps the game's framing offset) ----
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const releaseCam = lab.camera((home) => {
    const kk = Math.min(0.99, Math.min(arena.dt, 0.1) * 4);
    if (arena.camCur) {
      arena.camCur.sx = off0.sx / (1 - kk);
      arena.camCur.sy = off0.sy / (1 - kk);
    }
    const aim = P(3, 2.5).setY(0.2);
    return { target: home.target.clone().lerp(aim, 0.3 * S.punch), dist: home.dist * (1 - 0.1 * S.punch) };
  });
  // real-time tweens (they keep running while the scene clock is frozen)
  const rt = (dur, fn, easing = ease.inOut) =>
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

  // ---- the ghost: a copy of Theo's body made of light, left where he tried to go ----
  const makeGhost = () => {
    const g = new THREE.Group();
    g.position.copy(theo.group.position);
    g.quaternion.copy(theo.group.quaternion);
    g.scale.copy(theo.group.scale);
    const body = theo.model.body.clone(true);
    const mats = [];
    body.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshBasicMaterial({ color: hdr(theo.bot.color, 1.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        o.castShadow = false;
        mats.push(o.material);
      }
    });
    g.add(body);
    lab.add(g);
    return { g, mats };
  };

  lab.playCard('a', ['m2']);
  // ---- 1. Maya rolls; Theo sees her coming and crouches ----
  lab.tween(0.4, (e) => maya.set({ x: 1 + 0.8 * e, pitch: 0.08 * e }), ease.in);
  await lab.wait(0.08);
  await lab.tween(0.12, (e) => theo.set({ sy: 1 - 0.18 * e, sx: 1 + 0.1 * e, rot: facing(2) + 0.25 * e }), ease.out);
  // ---- 2. the hop: up and sideways toward the room ----
  await lab.tween(
    0.2,
    (e, k) => {
      theo.set({ y: 2 + 0.75 * e, lift: 0.42 * Math.sin(Math.min(1, k * 1.1) * Math.PI * 0.5), sy: 0.82 + 0.33 * Math.min(1, k * 2) - 0.15 * Math.max(0, k * 2 - 1), sx: 1.1 - 0.15 * Math.min(1, k * 2), roll: 0.35 * e, rot: facing(2) + 0.25 - 0.4 * e, trail: false });
    },
    ease.out,
  );
  // ---- 3. FREEZE: the ruling is drawn (a shutter click, the room cools a little) ----
  lab.timeScale = 0.01;
  lab.flash('rgba(255,255,255,1)', 0.07, 0.22);
  const dim0 = arena.dimCur;
  rt(0.12, (e) => (arena.dimCur = dim0 + 0.45 * e), ease.out);
  lab.cleanup(() => (arena.dimCur = 0));
  rt(0.1, (e) => (S.punch = e), ease.out3);
  rt(0.08, (e) => (S.railA = e), ease.out);
  await rt(0.17, (e) => (S.rail = e), ease.inOut);
  await lab.waitReal(0.03);
  S.leashA = 1;
  await rt(0.08, (e) => (S.leash = e), ease.out);
  await lab.waitReal(0.12);

  // ---- 4. SNAP: time back; yanked into the lane, a ghost left behind ----
  const ghost = makeGhost();
  lab.timeScale = 1;
  rt(0.25, (e) => (arena.dimCur = (dim0 + 0.45) * (1 - e)), ease.inOut);
  // Maya's nose lands right on the beat of his landing
  const roll2 = lab.tween(0.14, (e) => maya.set({ x: 1.8 + 0.42 * e, pitch: 0.08 }), ease.linear);
  rt(0.3, (e) => (S.punch = 1 - e), ease.inOut);
  const y0 = theo.pose.y;
  const l0 = theo.pose.lift;
  const r0 = theo.pose.roll;
  const rot0 = theo.pose.rot;
  rt(0.6, (e) => ghost.mats.forEach((m) => (m.opacity = 0.9 * (1 - e))), ease.in).then(() => lab.group.remove(ghost.g));
  await lab.tween(
    0.1,
    (e) => {
      theo.set({ y: y0 + (2 - y0) * e, lift: l0 * (1 - e), roll: r0 * (1 - e), rot: rot0 + (facing(2) - rot0) * e, sx: 0.95 + 0.25 * e, sy: 1 - 0.3 * e });
      S.leash = 1 - 0.85 * e;
    },
    ease.in,
  );
  theo.set({ trail: true });
  S.leashA = 0;
  lab.ring(P(3, 2), lab.PALETTE.light, 0.55, 0.03, 0.35);
  lab.shake(0.03, 0.15);
  await roll2;

  // ---- 5. the shove, along the rail; it fades as they settle ----
  const railOff = rt(0.55, (e) => (S.railA = 1 - e), ease.in);
  await lab.tween(
    0.32,
    (e, k) => {
      maya.set({ x: 2.22 + 0.78 * e, pitch: 0.08 * (1 - k) });
      theo.set({ x: 3 + e, sx: 1.2 - 0.2 * ease.out(k), sy: 0.7 + 0.3 * ease.outElastic(k), roll: Math.sin(k * 12) * 0.06 * (1 - k) });
    },
    ease.out,
  );
  theo.set({ sx: 1, sy: 1, roll: 0, rot: facing(2) });
  await railOff;
  stopDraw();
  for (const m of [rail, halo, cap, leash]) m.visible = false;
  releaseCam();
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
