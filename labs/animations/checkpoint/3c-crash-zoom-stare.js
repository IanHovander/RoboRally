// Heads turn, cut like an Edgar Wright scene. Maya lands on the flag; every other robot whips round at once
// and their stares become beams of light that converge on her, the room's lights drop and the camera
// crash-zooms in on her, lit by everyone's gaze. She holds it, squirms, then whips her own head round to look
// back: hard cut to wide, lights up, and every starer snaps back to its own facing a little too fast, with a
// guilty overshoot and a wobble.
export const meta = {
  title: 'Heads turn, crash zoom',
  idea:
    "The moment Maya claims the flag, every other robot whips round at once and their stares become soft beams of light in their own colours, converging on her; the room's lights drop and the camera crash-zooms in on her, bathed in everyone's gaze. She squirms, then whips round to look back. Hard cut to wide: lights up, beams gone, and every starer snaps back to its own facing a little too fast, with a guilty overshoot.",
  notes:
    'Sound: a tiny "whip" per head on the turn and a low hum while the beams hold; on the catch, a dry glass tick (the cut) and the room tone back at once. On a real board every robot does it in the same frame, each beam in its own colour, so the gaze-light pooling on the claimer gets brighter with more players. The crash zooms are fast (0.14 s) and land on the claimer, so the board is readable before and after. Everyone ends on their own facing.',
};

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const mayaRec = lab.bot('a');
  const theoRec = lab.bot('b');
  const P = lab.pos(4, 1);
  const col = arena.columns.find((c) => c.n === 1);
  const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const lookAt = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)); // rotation.y that faces `to`

  const glow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---------- one stare: a soft cone of the starer's light from its eye to Maya, a bright core, a pool on her ----------
  const starers = [...arena.bots.values()].filter((b) => b.id !== 'a' && b.visible);
  const stares = starers.map((b) => {
    const color = new THREE.Color(b.color);
    const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0); // apex at the origin, opening along -y
    const cone = lab.add(new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    const coreGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 6).translate(0, -0.5, 0);
    const core = lab.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    const pool = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glow, color: color.clone().multiplyScalar(1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    pool.position.set(P.x, 0.012, P.z);
    for (const m of [cone, core, pool]) m.renderOrder = 9;
    return { b, cone, core, pool, k: 0, reach: 0 };
  });
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const drawStares = () => {
    for (const s of stares) {
      s.b.model.muzzle.updateWorldMatrix(true, false);
      tmpA.setFromMatrixPosition(s.b.model.muzzle.matrixWorld);
      tmpB.copy(mayaRec.group.position).setY(0.28);
      const d = tmpB.clone().sub(tmpA);
      const len = d.length() * s.reach;
      d.normalize();
      for (const m of [s.cone, s.core]) {
        m.position.copy(tmpA);
        m.quaternion.setFromUnitVectors(down, d);
      }
      s.cone.scale.set(0.42 * s.reach, Math.max(0.001, len), 0.42 * s.reach);
      s.core.scale.set(1, Math.max(0.001, len), 1);
      s.cone.material.opacity = 0.3 * s.k;
      s.core.material.opacity = 0.9 * s.k;
      s.pool.material.opacity = 0.75 * s.k * s.reach;
      s.cone.visible = s.core.visible = s.k > 0.01;
    }
  };

  // ---------- the starers: puppets that whip round, hold, and snap back guiltily ----------
  const puppets = stares.map((s) => {
    const p = lab.puppet(s.b.id);
    const home = s.b.rot;
    const at = lookAt(s.b.group.position, P);
    const stareRot = home + wrap(at - home);
    p.set({ trail: false });
    const eye = { k: 1 };
    p.each = (m) => m.eyeMat.color.setRGB(3.2 * eye.k, 3.1 * eye.k, 2.9 * eye.k);
    return { p, home, stareRot, eye, s };
  });

  // ---------- the camera: crash zoom in on Maya, hard cut back ----------
  let zoom = 0;
  let creep = 0;
  // the close-up is a two-shot weighted to Maya: the starers' beams come in from the side
  const shot = new THREE.Vector3(P.x, 0.25, P.z).multiplyScalar(0.7);
  for (const b of starers) shot.add(b.group.position.clone().multiplyScalar(0.3 / starers.length));
  // the hold is a dolly zoom (the Jaws shot): the lens tightens while the camera backs off, so Maya stays the
  // same size and the board behind her flattens and slides
  const rad = (d) => (d * Math.PI) / 180;
  const releaseCam = lab.camera((home) => {
    const fov = 30 - 9 * zoom - 9 * creep;
    const base = 30 - 9 * zoom;
    return {
      target: home.target.clone().lerp(shot, 0.95 * zoom),
      fov,
      dist: home.dist * (Math.tan(rad(base / 2)) / Math.tan(rad(fov / 2))),
      el: home.el - 0.06 * zoom,
    };
  });

  // 1. the game's move onto the flag; the column takes her colour as she lands
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.6);
  col.flash = arena.time;
  col.flashColor = new THREE.Color(mayaRec.color);
  lab.ring(P, mayaRec.color, 0.9, 0.02, 0.5);
  arena.emit('checkpoint', { id: 'a', n: 1 });
  const maya = lab.puppet('a');
  maya.set({ trail: false });
  const east = maya.pose.rot;
  await lab.wait(0.12);

  // 2. WHIP: every head turns at once; the stares shoot out; lights down; crash zoom
  for (const q of puppets) {
    lab.tween(
      0.09,
      (e, k) => {
        // a tiny overshoot past her, then on her
        const over = Math.sin(Math.min(1, k * 1.0) * Math.PI) * 0.08;
        q.p.set({ rot: q.home + (q.stareRot - q.home) * e + over * Math.sign(q.stareRot - q.home) });
      },
      ease.out,
    );
    lab.tween(0.12, (e) => (q.eye.k = 1 + 1.4 * e), ease.out);
  }
  for (const s of stares) {
    lab.tween(0.1, (e) => ((s.reach = e), (s.k = e)), ease.out);
  }
  arena.dim = 0.7;
  arena.dimCur = 0.55;
  arena.focusOn = 'a'; // the card and name tags stay out of the close-up
  lab.tween(0.14, (e) => (zoom = e), ease.out3);
  const stop = lab.every(() => drawStares());
  lab.cleanup(stop);
  await lab.wait(0.16);

  // 3. HOLD: Maya under everyone's gaze. She shrinks a little and squirms; the dolly zoom closes in on her.
  lab.tween(0.75, (e) => (creep = e), ease.inOut);
  await lab.tween(
    0.5,
    (e, k) => {
      maya.set({ sy: 1 - 0.07 * e, sx: 1 + 0.03 * e, sz: 1 + 0.03 * e, rot: east + Math.sin(k * Math.PI * 3) * 0.05 * e });
    },
    ease.out,
  );
  await lab.wait(0.12);
  // she whips round to look straight back at Theo
  const atTheo = east + wrap(lookAt(P, theoRec.group.position) - east);
  await lab.tween(0.08, (e) => maya.set({ rot: east + (atTheo - east) * e, sy: 0.93 + 0.07 * e, sx: 1.03 - 0.03 * e, sz: 1.03 - 0.03 * e }), ease.out);
  await lab.wait(0.1);

  // 4. CAUGHT. Hard cut to wide: for a beat the whole room is seen staring...
  zoom = 0;
  creep = 0;
  await lab.wait(0.16);
  // ...then lights up, beams gone, and every starer snaps back too fast and overshoots.
  arena.dim = 0;
  arena.dimCur = 0;
  arena.focusOn = null;
  for (const s of stares) s.k = 0;
  for (const q of puppets) {
    const dir = Math.sign(q.home - q.stareRot);
    lab.tween(
      0.42,
      (e, k) => {
        // there in 0.06 s, swung 24 degrees too far, then a guilty wobble home
        const snap = Math.min(1, k / 0.14);
        const base = q.stareRot + (q.home - q.stareRot) * ease.out(snap);
        const wob = k < 0.14 ? 0.42 * snap * snap : 0.42 * Math.exp(-(k - 0.14) * 7) * Math.cos((k - 0.14) * 20);
        const shrink = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.08; // ducks a little, guiltily
        q.p.set({ rot: base + dir * wob, sy: 1 - shrink, sx: 1 + shrink * 0.4, sz: 1 + shrink * 0.4 });
      },
      ease.linear,
    );
    // its eye goes shifty: a dim, then back
    lab.tween(0.42, (e, k) => (q.eye.k = 1 - 0.55 * Math.sin(k * Math.PI)), ease.linear);
  }
  // Maya, satisfied, turns back to face east
  await lab.wait(0.14);
  await lab.tween(0.16, (e) => maya.set({ rot: atTheo + (east - atTheo) * e }), ease.inOut);
  await lab.wait(0.16);

  maya.release({ x: 4, y: 1, d: 1 });
  for (const q of puppets) {
    q.p.set({ rot: q.home, sx: 1, sy: 1, sz: 1 });
    q.p.each = null;
    q.p.release({ x: q.s.b.x, y: q.s.b.y }); // its own facing, as it was
  }
  arena.setTaken([{ color: mayaRec.color, cp: 1 }]);
  releaseCam();
}
