// Hula Hoop, staged as a long exposure: Theo's ring of light is left behind, Maya wears it for a beat, then it
// rolls after him and settles like a spun coin, and the shutter stays open: every wobble leaves a ghost, so the
// settle paints a bowl of light that flattens into his ring.
export const meta = {
  title: 'Spun Coin (long exposure)',
  idea:
    "Maya shoves Theo east, but his blue ring stays lying on space 3. Maya drives into it and it rides up to her waist: for one held beat she wears two rings. A shimmy, and the hoop flicks onto its edge, rolls after Theo and drops around him, wobbling faster and faster like a spun coin. The camera's shutter stays open on it: every wobble leaves a fading ghost, so the settle paints a glowing bowl of light that collapses flat into his ring with a click, while the point where it touches the glass spirals out in light.",
  notes:
    'Staging: a small lean-in of the camera on the two-ring beat (held in slow motion for a fraction of a second, the Edgar Wright beat), then it drifts home while the coin settles. The ring is the slowest one to understand: it blinks twice, alone, after Theo has gone. Sound: a glass ting when the ring is left behind, a soft swish for the shimmy, then the rising whirr of a spun glass coin that ends in one clean click. Porting: the hoop is a torus in the pushed robot\'s ring colour; the real ring mesh is hidden while it is away. Only the pushed robot\'s ring travels, so it works with any pair of forms; with a chain of pushes, each ring could hop along behind its owner.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const R = 0.517; // the ring of light's radius on the glass (0.3975 x the robots' scale 1.3)
  const theoCol = new THREE.Color(lab.bot('b').color);
  const P = (x, y) => lab.pos(x, y);

  // ---- the camera: keep the game's framing offset while we drive it ----
  const arena = lab.arena;
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const cam = { k: 0, tx: 3.4, lift: 0.15 }; // k: 0 home .. 1 leaned in
  const releaseCam = lab.camera((home) => {
    const kk = Math.min(0.99, Math.min(arena.dt, 0.1) * 4);
    if (arena.camCur) {
      arena.camCur.sx = off0.sx / (1 - kk);
      arena.camCur.sy = off0.sy / (1 - kk);
    }
    const aim = P(cam.tx, 2).setY(cam.lift);
    return { target: home.target.clone().lerp(aim, cam.k * 0.35), dist: home.dist * (1 - 0.1 * cam.k), el: home.el + 0.03 * cam.k };
  });

  // ---- the hoop: a torus the size of his ring, which we pose by a normal, a spin and a centre ----
  const ringMesh = lab.bot('b').model.group.children.find((o) => o.isMesh && o.geometry.type === 'RingGeometry');
  const torusGeo = new THREE.TorusGeometry(R, 0.022, 10, 96);
  const hoopMat = new THREE.MeshBasicMaterial({ color: theoCol.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false });
  const hoop = new THREE.Group();
  const hoopRing = new THREE.Mesh(torusGeo, hoopMat);
  hoop.add(hoopRing);
  // a bead of light on the hoop, so you can see it roll
  const beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.95, 2.8), transparent: true, opacity: 0, depthWrite: false });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), beadMat);
  bead.position.set(R, 0, 0);
  hoop.add(bead);
  hoop.visible = false;
  lab.add(hoop);
  const Z = new THREE.Vector3(0, 0, 1);
  const qa = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const H = { c: P(3, 2).setY(0.006), n: new THREE.Vector3(0, 1, 0), spin: 0, glow: 1 };
  const poseHoop = () => {
    qa.setFromUnitVectors(Z, H.n.clone().normalize());
    qs.setFromAxisAngle(Z, H.spin);
    hoop.quaternion.copy(qa).multiply(qs);
    hoop.position.copy(H.c);
    hoopMat.color.copy(theoCol).multiplyScalar(1.6 * H.glow);
  };

  // ---- long exposure: ghosts of the hoop (and of where it touches the glass) that fade ----
  const ghosts = [];
  const dotGeo = new THREE.CircleGeometry(0.045, 16).rotateX(-Math.PI / 2);
  const ghost = (life, peak) => {
    const m = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: theoCol.clone().multiplyScalar(1.4), transparent: true, opacity: peak, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.quaternion.copy(hoop.quaternion);
    m.position.copy(hoop.position);
    lab.add(m);
    ghosts.push({ m, t0: lab.t, life, peak });
  };
  const dot = (at, life, peak) => {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(theoCol).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(2.4), transparent: true, opacity: peak, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(at).setY(0.012);
    lab.add(m);
    ghosts.push({ m, t0: lab.t, life, peak });
  };
  const stopGhosts = lab.every(() => {
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      const k = (lab.t - g.t0) / g.life;
      if (k >= 1) {
        lab.group.remove(g.m);
        g.m.material.dispose();
        ghosts.splice(i, 1);
      } else g.m.material.opacity = g.peak * (1 - k) ** 1.6;
    }
  });

  // ---- Theo's little life: he notices his ring is gone, looks back, then down ----
  const T = { look: 0, dip: 0, hop: 0 };
  theo.each = () => {
    theo.set({ rot: facing(2) - 0.45 * T.look, pitch: 0.28 * T.dip, lift: T.hop });
  };
  // Maya's shimmy
  const M = { roll: 0, wig: 0 };
  maya.each = () => maya.set({ roll: M.roll, rot: facing(1) + M.wig });

  lab.playCard('a', ['m2']);
  await lab.wait(0.04);

  // ---- 1. Maya rolls up to Theo (nose meets him at about x = 2.2) ----
  await lab.tween(0.28, (e) => maya.set({ x: 1 + 1.2 * e, pitch: 0.12 * e }), ease.in);

  // ---- 2. contact: the shove. Theo is knocked ahead, but his ring doesn't go with him ----
  ringMesh.visible = false;
  hoop.visible = true;
  poseHoop();
  const camIn = lab.tween(0.55, (e) => (cam.k = e), ease.inOut);
  lab.tween(
    0.2,
    (e, k) => theo.set({ x: 3 + e, sx: 1 + 0.12 * Math.sin(k * Math.PI), sy: 1 - 0.1 * Math.sin(k * Math.PI) }),
    ease.out,
  ).then(() => {
    theo.set({ sx: 1, sy: 1 });
    // a double take: he glances back at where he was
    lab.tween(0.34, (e, k) => (T.look = Math.sin(k * Math.PI)), ease.inOut);
  });
  // the ring, alone on space 3, blinks twice: "...wait."
  lab.wait(0.12).then(() => lab.tween(0.16, (e, k) => ((H.glow = 1 + 1.5 * Math.max(0, Math.sin(k * Math.PI * 2)) ** 2), poseHoop()), ease.linear));
  await lab.tween(0.34, (e, k) => maya.set({ x: 2.2 + 0.8 * e, pitch: 0.12 * (1 - k) }), ease.inOut);
  H.glow = 1;

  // ---- 3. Maya drives into it, and it rides up her to her waist ----
  await lab.tween(
    0.14,
    (e) => {
      H.c = P(3, 2).setY(0.006 + 0.25 * e);
      H.n.set(-0.25 * Math.sin(e * Math.PI), 1, 0);
      H.glow = 1 + 0.9 * e;
      poseHoop();
    },
    ease.outBack,
  );
  // the two-ring beat: hold it, in slow motion
  lab.slowmo(0.22, 0.05);
  T.dip = 0;
  await lab.waitReal(0.1);
  lab.tween(0.25, (e) => (T.dip = Math.sin(e * Math.PI) * 0.9), ease.inOut); // Theo glances down at his bare spot
  await lab.slowmo(1, 0.08);

  // ---- 4. the shimmy: the hoop gyrates around her waist, faster, then she flicks it off to the east ----
  await lab.tween(
    0.27,
    (e, k) => {
      const w = k * k * 4.2 * Math.PI * 2 * 0.5 + k * 3; // accelerating gyration
      const amp = 0.07 * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5);
      M.roll = Math.sin(w) * 0.16 * Math.min(1, k * 3);
      M.wig = Math.cos(w) * 0.12 * Math.min(1, k * 3);
      const c = P(3, 2).setY(0.25 + 0.03 * Math.sin(w * 2));
      c.x += Math.cos(w + Math.PI) * amp;
      c.z += Math.sin(w + Math.PI) * amp;
      H.c = c;
      H.n.set(Math.cos(w) * 0.3, 1, Math.sin(w) * 0.3);
      poseHoop();
    },
    ease.linear,
  );
  // flick: the hoop stands up on its edge on her east side
  const from = H.c.clone();
  const n0 = H.n.clone().normalize();
  beadMat.opacity = 0;
  await lab.tween(
    0.1,
    (e, k) => {
      M.roll = M.roll * (1 - k);
      M.wig = -0.18 * Math.sin(k * Math.PI);
      H.c = from.clone().lerp(P(3.3, 2).setY(R), e);
      H.c.y += 0.08 * Math.sin(k * Math.PI);
      H.n = n0.clone().lerp(new THREE.Vector3(0, 0, 1), e).normalize();
      H.spin = 0.6 * e;
      H.glow = 1.9 - 0.4 * e;
      beadMat.opacity = e;
      poseHoop();
    },
    ease.out,
  );
  M.roll = 0;
  M.wig = 0;

  // ---- 5. it rolls east after Theo (the bead shows the roll; the shutter leaves ghosts) ----
  let gi = 0;
  await lab.tween(
    0.2,
    (e) => {
      const x = 3.3 + 0.7 * e;
      H.c = P(x, 2).setY(R);
      H.spin = 0.6 - ((x - 3.3) * 1.3) / R; // rolling east = clockwise seen from the camera
      poseHoop();
      if (gi++ % 2 === 0) ghost(0.22, 0.35);
    },
    ease.out,
  );
  T.look = 0;
  cam.tx = 4;

  // ---- 6. the spun coin: it leans and precesses faster and faster until it lies flat ----
  const D = 0.48;
  const A0 = (84 * Math.PI) / 180;
  const KREV = Math.PI * 2 * 3.2;
  const centre = P(4, 2);
  let lastContact = null;
  const camOut = lab.tween(D + 0.12, (e) => (cam.k = 1 - e), ease.inOut);
  await camIn;
  await lab.tween(
    D,
    (e, k) => {
      const u = Math.max(0, 1 - k);
      const a = A0 * u ** (2 / 3);
      const phi = Math.PI / 2 + KREV * (1 - u ** (2 / 3));
      H.n.set(Math.sin(a) * Math.cos(phi), Math.cos(a), Math.sin(a) * Math.sin(phi));
      H.c = centre.clone().setY(Math.max(0.006, R * Math.sin(a)));
      H.glow = 1.5 + 0.6 * k;
      beadMat.opacity = Math.max(0, 1 - k * 1.5);
      poseHoop();
      ghost(0.18 + 0.25 * k, 0.16 + 0.3 * k);
      // the point where it touches the glass whirls round, spiralling out to his ring
      const cp = centre.clone().add(new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)).multiplyScalar(R * Math.cos(a)));
      if (lastContact) {
        const steps = Math.min(10, Math.ceil(lastContact.distanceTo(cp) / 0.05));
        for (let i = 1; i <= steps; i++) dot(lastContact.clone().lerp(cp, i / steps), 0.45, 0.55 * (0.4 + 0.6 * k));
      }
      lastContact = cp;
      // Theo feels it buzzing round him
      theo.set({ roll: Math.sin(phi * 2) * 0.03 * k });
    },
    ease.linear,
  );

  // ---- 7. click: flat, one bright beat, and it is simply his ring again ----
  H.n.set(0, 1, 0);
  H.c = centre.clone().setY(0.006);
  theo.set({ roll: 0 });
  poseHoop();
  lab.ring(centre, theo.bot.color, 0.45, 0.02, 0.35);
  const hop = lab.tween(0.2, (e, k) => (T.hop = 0.07 * Math.sin(k * Math.PI)), ease.out);
  await lab.tween(0.12, (e) => ((H.glow = 1 + 2.4 * (1 - e)), poseHoop()), ease.out);
  hoop.visible = false;
  ringMesh.visible = true;
  await camOut;
  await hop;
  T.hop = 0;
  releaseCam();
  stopGhosts();
  for (const g of ghosts) lab.group.remove(g.m);
  theo.each = null;
  maya.each = null;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  lab.cleanup(() => (ringMesh.visible = true));
}
