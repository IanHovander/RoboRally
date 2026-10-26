// Overshoot and Rewind (animator a: weight & physical comedy)
// The belt is overeager. The express step is fine, but the all-belts step keeps accelerating: it whips Maya
// round the corner, too far, to face south, and on down the south leg. Then the board slams to a stop: the
// chevrons freeze and her momentum pitches her forward onto her nose, where she teeters on her front edge,
// Buster Keaton style, before rocking back. A held beat: her red trail behind her goes taut and hums like a
// plucked string. Then it rewinds: the chevrons run backwards, her trail reels back up the belt like tape onto
// a spool (a spinning ring of her light winds it in), and she's dragged backwards round the corner, unwinding
// to face north again, until the tape catches with a click. Take two: the corner plays properly, a calm
// quarter turn to face east, and she settles softly on (3,1).
export const meta = {
  title: 'Overshoot and Rewind',
  idea:
    'The belt is overeager: it whips Maya round the corner to face south and on down the south leg, then slams to a stop that pitches her onto her nose. Her trail goes taut, then rewinds like tape onto a spool, dragging her backwards round the corner; take two plays the corner properly and she settles facing east.',
  notes:
    'A brief, deliberate rule-break that corrects itself and ends on the exact rule; on the way it shows where the belt takes her next register (down the south leg). Physics: she leans back as the belt accelerates, leans out on the whip round the corner, pitches over her front edge on the stop (she pivots on her edge, not through the glass), and the rewind accelerates and decelerates like a tape transport before it catches with a small backward jolt. The trail is the tape: it is literally her trail points being reeled in. Sound: a rising belt whirr that overshoots in pitch; a dry glass "clack" on the stop and a wobbling hum while she teeters; a taut, buzzing string for the held trail; a reversed, chirping whirr for the rewind; a click; then the belt\'s normal soft hum and a gentle settle chime. Keep it rare (once or twice a game) so the fake-out stays a surprise.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { ease, facing, arena, THREE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  const bot = maya.bot;
  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];
  const speed0 = belt.speed;
  lab.cleanup(() => {
    belt.speed = speed0;
    m.body.scale.set(1, 1, 1);
    m.body.position.set(0, 0, 0);
  });
  const RED = new THREE.Color('#ff4d6d');

  // the path along the belt: s in [0, 1] is (2,1) -> (3,1) east; s in [1, 1.5] is (3,1) -> (3,1.5) south
  const at = (s) => (s <= 1 ? [2 + s, 1] : [3, 1 + (s - 1)]);
  const P0 = lab.pos(2, 1);
  const C = lab.pos(3, 1);
  const sOf = (p) => (p.z > C.z + 0.02 ? 1 + (p.z - C.z) : p.x - P0.x);
  const q = facing(1) - facing(0); // a quarter turn to the right

  const S = { x: 1, y: 1, rot: facing(0), lean: 0, roll: 0, sx: 1, sy: 1, trail: true, glow: 0 };
  const R = 0.33; // her half-length: she tips over her own edge
  maya.each = (model) => {
    const th = S.lean; // + leans back, - pitches forward
    model.body.rotation.x = th;
    model.body.rotation.z = -S.roll;
    model.body.position.set(0, R * Math.abs(Math.sin(th)) + 0.2 * Math.abs(Math.sin(S.roll)), Math.sign(th) * R * (1 - Math.cos(th)));
    model.body.scale.set(S.sx, S.sy, S.sx);
    model.ringMat.opacity = Math.min(1, model.ringMat.opacity + S.glow * 0.3);
  };
  const drive = lab.every(() => maya.set({ x: S.x, y: S.y, rot: S.rot, trail: S.trail }));

  // ---- 1. the express step: fine ----
  belt.speed = 1.6;
  await lab.tween(0.36, (e, k) => {
    S.x = 1 + e;
    S.lean = 0.1 * Math.sin(k * TAU); // back as the belt grabs her, forward as it stops
  }, ease.inOut);
  S.x = 2;
  S.lean = 0;


  // ---- 2. the all-belts step: overeager. It keeps accelerating, whips her round the corner too far, and on ----
  const sEnd = 1.5;
  await lab.tween(0.46, (e, k) => {
    const s = sEnd * e;
    [S.x, S.y] = at(s);
    // the corner turns her as she crosses it: east at its centre... and on round to south
    const turn = Math.max(0, Math.min(2, (s - 0.55) / 0.42));
    S.rot = facing(0) + q * ease.inOut(Math.min(1, turn)) + q * ease.out(Math.max(0, turn - 1));
    S.lean = 0.22 * Math.min(1, k * 3) * (1 - k * 0.4); // she leans back against the acceleration
    S.roll = s > 0.6 && s < 1.3 ? -0.16 * Math.sin(((s - 0.6) / 0.7) * Math.PI) : 0; // and out, on the whip
    belt.speed = 1.2 + 4.5 * k;
  }, (k) => k * k * (1.6 - 0.6 * k));
  [S.x, S.y] = at(sEnd);
  S.rot = facing(2);
  S.roll = 0;

  // ---- 3. SLAM: the board notices. The chevrons freeze, and her momentum pitches her over onto her nose ----
  belt.speed = 0;
  lab.shake(0.016, 0.14);
  await lab.tween(0.08, (e) => (S.lean = 0.22 - 0.72 * e), ease.out);
  // teetering on her front edge...
  await lab.tween(0.17, (e, k) => {
    S.lean = -0.5 + Math.sin(k * TAU * 1.6) * 0.07 * (1 - k);
  }, ease.linear);
  // the trail behind her goes taut and hums like a plucked string
  S.trail = false;
  const base = bot.trail.map((p) => ({ x: p.x, z: p.z }));
  const hum = (amp, t) => {
    const now = lab.t;
    bot.trail.forEach((p, i) => {
      const b = base[i];
      if (!b) return;
      const s = sOf(b);
      const nx = s > 1 ? 1 : 0; // across the belt: z on the east leg, x on the south leg
      const w = Math.sin(Math.max(0, Math.min(1, s / sEnd)) * Math.PI) * amp * Math.sin(t * 70 + s * 3);
      p.x = b.x + (nx ? w : 0);
      p.z = b.z + (nx ? 0 : w);
      p.t = Math.max(p.t, now - 0.25); // bright as new: under tension
    });
  };
  // under tension the trail burns brighter, whiter
  const trailMat = bot.trailMesh.material;
  const trailC0 = trailMat.color.clone();
  lab.cleanup(() => trailMat.color.copy(trailC0));
  const taut = (k) => trailMat.color.setRGB(1 + 1.1 * k, 1 + 1.3 * k, 1 + 1.3 * k);
  lab.tween(0.22, (e, k) => {
    hum(0.04 * Math.sin(k * Math.PI), lab.t);
    taut(Math.min(1, k * 2.5));
  }, ease.linear);
  // ...and she rocks back down
  await lab.tween(0.1, (e, k) => {
    S.lean = -0.5 * (1 - e) + 0.08 * Math.sin(k * Math.PI);
  }, ease.in);
  S.lean = 0;

  await lab.wait(0.11);

  // ---- 4. REWIND: the chevrons run backwards, the trail reels in like tape onto a spool, and she goes with it ----
  // a spool of her light winding the tape in
  const spool = lab.add(new THREE.Group());
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.66, 24, 1, (i / 5) * TAU, TAU / 10), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    arc.rotation.x = -Math.PI / 2;
    spool.add(arc);
  }
  spool.position.y = 0.012;
  const sStop = 0.5; // the rewind catches just as she's back at the corner's edge, facing north
  let spin = 0;
  await lab.tween(0.42, (e, k) => {
    const s = sEnd - (sEnd - sStop) * e;
    [S.x, S.y] = at(s);
    // unwinding: the turns come off in reverse
    const turn = Math.max(0, Math.min(2, (s - 0.55) / 0.42));
    S.rot = facing(0) + q * ease.inOut(Math.min(1, turn)) + q * ease.out(Math.max(0, turn - 1));
    // dragged backwards: she leans forward against the pull
    S.lean = -0.16 * Math.sin(k * Math.PI);
    // the tape: points she has passed back over are wound in
    const now = lab.t;
    for (let i = bot.trail.length - 1; i >= 0; i--) {
      if (sOf(bot.trail[i]) > s + 0.02) bot.trail.pop();
      else break;
    }
    bot.trail.forEach((p) => (p.t = Math.max(p.t, now - 0.2)));
    belt.speed = -5 * Math.sin(k * Math.PI) - 0.3;
    const pp = lab.pos(S.x, S.y);
    spin += 0.55 * Math.sin(k * Math.PI) + 0.05;
    spool.position.x = pp.x;
    spool.position.z = pp.z;
    spool.rotation.y = spin;
    spool.children.forEach((a) => (a.material.opacity = Math.min(1, k * 5)));
    S.glow = Math.sin(k * Math.PI);
  }, ease.inOut);
  S.glow = 0;
  belt.speed = 0;
  // the tape catches: click, a small jolt backwards, and the spool's last glint
  await lab.tween(0.08, (e, k) => {
    S.x = 2 + sStop - 0.04 * Math.sin(k * Math.PI);
    S.lean = 0.1 * Math.sin(k * Math.PI);
    spool.children.forEach((a) => (a.material.opacity = (1 - k) * 1.5));
    taut(1 - k);
    spool.scale.setScalar(1 - 0.25 * k);
  }, ease.out);
  spool.visible = false;
  taut(0);
  S.lean = 0;

  // ---- 5. take two: the corner plays properly, a calm quarter turn to face east, and a soft settle ----
  S.trail = true;
  belt.speed = speed0;
  await lab.tween(0.3, (e) => {
    S.x = 2 + sStop + (1 - sStop) * e;
    S.rot = facing(0) + q * e;
  }, ease.inOut);
  S.x = 3;
  S.rot = facing(1);
  await lab.tween(0.13, (e, k) => {
    const s = Math.sin(k * Math.PI) * (1 - k * 0.5);
    S.sy = 1 - 0.07 * s;
    S.sx = 1 + 0.035 * s;
    S.lean = -0.05 * Math.sin(k * Math.PI);
  }, ease.linear);
  S.sx = S.sy = 1;
  S.lean = 0;

  drive();
  maya.each = null;
  m.body.scale.set(1, 1, 1);
  m.body.position.set(0, 0, 0);
  maya.release({ x: 3, y: 1, d: 1 });
}
