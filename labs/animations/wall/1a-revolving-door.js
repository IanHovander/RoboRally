// Wall, idea 28 (Revolving door), animator a: weight and physical comedy.
// Maya arrives at full speed (she was counting on three spaces). The fin is a heavy glass door on a pivot: it
// holds, then gives, and her own momentum swings her right round it. On the far side the door nearly stops
// (she is on (4,1)! her light jumps), but a heavy door doesn't stop for hope: it lurches on and slams into its
// lock back where it started. The door stops dead; Maya doesn't, so she slides on along its face and
// springs back, nose to the fin. Her trail is left as one neat ring of light round the fin.
export const meta = {
  title: 'Revolving door (heavy glass)',
  idea:
    'She hits the fin at full speed and her momentum turns it: a heavy glass door on a pivot that creaks, gives, and swings her once all the way round. On the far side it almost stops, she is on the space she wanted and her light jumps, then the door lurches on and slams into its lock. The door stops dead and she doesn\'t: she skids on along its face and springs back. A full turn is no move at all, so the rule holds, and her trail is left as one ring of light round the fin.',
  notes:
    'Sound: a glass tink at contact, a low glass creak as the door gives, a soft rising whoosh round the turn, a dip in pitch at the far side, then a solid click-clunk at the lock with a short glassy rattle as she skids and settles. ' +
    'Turns = lost steps (Move 3 stopped after one space goes round twice: LOST = 2 below, the profile just repeats with a smaller hitch). ' +
    'Porting: the wall group in arena.board is rotated about its own centre; the robot orbits it at 0.5 spaces; the trail is the game\'s own trail with sparser points so the whole ring fits in its 90 points.',
};

const TAU = Math.PI * 2;
const LOST = 1; // steps the wall ate: one full turn each

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  const glowTex = maya.model.poolMat.map;
  lab.playCard('a', ['m3']);

  // ---- the fin between (3,1) and (4,1): we turn the board's own wall ----
  const fin = findFin(lab);
  const baseRot = fin.rotation.y;
  const [finMesh, capMesh] = fin.children;
  const finMat0 = finMesh.material;
  const capMat0 = capMesh.material;
  const finMat = finMat0.clone();
  const capMat = capMat0.clone();
  finMesh.material = finMat;
  capMesh.material = capMat;
  const capBase = capMat.color.clone();
  lab.cleanup(() => {
    fin.rotation.y = baseRot;
    finMesh.material = finMat0;
    capMesh.material = capMat0;
    finMat.dispose();
    capMat.dispose();
  });
  const PIV = { x: 3.5, y: 1 }; // the fin's middle, in spaces
  const R = 0.5;

  // ---- a few small lights we draw ourselves ----
  const glow = (color, size, k = 2.4) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    return lab.add(m);
  };
  // the contact glint: a point of light where her nose meets the glass
  const glint = glow('#ffffff', 0.32, 3);
  glint.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(-0.03, 0.17, 0));
  // the latch: two short bars of light on the glass at the ends of the fin, snapping in at the lock
  const latches = [-1, 1].map((s) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.05),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(0, 0.01, s * 0.52));
    return lab.add(m);
  });
  const faceCam = () => glint.quaternion.copy(lab.camera3.quaternion);

  // ---- her trail: the game's own ribbon, fed by hand with sparser points so the ring fits ----
  maya.set({ trail: false });
  bot.trail = [];
  let last = null;
  const feed = (t) => {
    const p = lab.pos(maya.pose.x, maya.pose.y);
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.075) {
      last = { x: p.x, z: p.z, t };
      bot.trail.push(last);
    }
  };

  // per-frame extras for the body: eye light, pool, glint, fin light
  const fx = { eye: 1, pool: 1, finGlow: 0, cap: 0 };
  // her card hangs over her on a soft spring: it lags round the turn and swings when the door stops
  const card = { p: null, v: new THREE.Vector3(), t: null };
  maya.each = (m, t) => {
    feed(t);
    if (bot.card) {
      const want = bot.card.position.clone();
      if (!card.p) card.p = want.clone();
      const dt = card.t == null ? 0 : Math.min(0.05, t - card.t);
      card.t = t;
      const W = 13;
      const acc = want.clone().sub(card.p).multiplyScalar(W * W).addScaledVector(card.v, -2 * 0.45 * W);
      card.v.addScaledVector(acc, dt);
      card.p.addScaledVector(card.v, dt);
      bot.card.position.set(card.p.x, want.y, card.p.z);
    }
    m.eyeMat.color.setRGB(3.2 * fx.eye, 3.1 * fx.eye, 2.9 * fx.eye);
    m.poolMat.opacity = 0.75 * fx.pool;
    finMat.emissiveIntensity = 0.12 + fx.finGlow;
    capMat.color.copy(capBase).multiplyScalar(1 + fx.cap);
    faceCam();
  };

  // ---- 1. wind-up and the run: she means to go three spaces, so she never brakes ----
  await lab.tween(0.12, (e) => maya.set({ x: 1 - 0.05 * e, pitch: -0.12 * e }), ease.out);
  const A = 0.42; // accelerate for the first part, then full speed into the fin
  const run = (k) => (k < A ? (k * k) / (2 * A) : A / 2 + (k - A)) / (1 - A / 2);
  await lab.tween(0.44, (_, k) => maya.set({ x: 0.95 + 2.05 * run(k), pitch: -0.12 + 0.2 * Math.min(1, k * 2) }), ease.linear);

  // ---- 2. contact: tink. She stops dead, squashes a hair; the glass door doesn't budge (yet) ----
  lab.tween(0.22, (e, k) => {
    glint.material.opacity = k < 0.15 ? k / 0.15 : (1 - k) ** 2;
    glint.scale.setScalar(0.6 + 0.8 * e);
    fx.cap = 1.6 * (1 - k) ** 2;
  }, ease.out);
  await lab.tween(0.1, (e, k) => maya.set({ sz: 1 - 0.12 * Math.sin(k * Math.PI), sx: 1 + 0.05 * Math.sin(k * Math.PI), pitch: 0.08 + 0.1 * Math.sin(k * Math.PI) }), ease.linear);
  // she leans into it, straining: the door creaks and gives a few degrees
  await lab.tween(0.2, (e, k) => {
    const strain = Math.sin(k * Math.PI * 6) * 0.012 * k;
    const th = 0.1 * ease.in3(k);
    setDoor(th, 0.08 + 0.06 * e, strain, 0);
    fx.finGlow = 0.12 * e;
  }, ease.out);

  // ---- 3. the turn: a heavy door with her riding on it. Simulated up front so it's repeatable ----
  // angular speed eases up (inertia), dips at the far side (the hitch), then runs into the lock
  const prof = spinProfile(0.1, TAU * LOST);
  const omax = prof.omax;
  let hopeShown = false;
  await lab.tween(prof.T, (_, k) => {
    const s = prof.at(k * prof.T);
    const w = s.w / omax; // 0..1 how fast
    const accel = s.a / omax; // lean against the push
    const lean = -0.2 * w * w; // flung outward: the pivot is in front of her, so she tips back
    const roll = -0.18 * Math.max(-1, Math.min(1, accel * 0.12));
    setDoor(s.th, 0.12 + lean, 0, roll);
    // on the far side: the space she wanted. Her light jumps with hope, then the door lurches on
    const far = Math.exp(-((((s.th % TAU) - Math.PI) / 0.4) ** 2));
    fx.eye = 1 + 1.1 * far;
    fx.pool = 1 + 0.8 * far;
    maya.set({ lift: 0.07 * far, pitch: 0.12 + lean - 0.12 * far });
    fx.finGlow = 0.12 + 0.25 * w;
    if (far > 0.9) hopeShown = true;
  }, ease.linear);
  void hopeShown;

  // ---- 4. the lock: the door stops dead, she doesn't. She skids on along its face and springs back ----
  lab.tween(0.3, (e, k) => {
    for (const l of latches) {
      l.material.opacity = k < 0.1 ? k / 0.1 : (1 - k) ** 1.5;
      l.scale.set(1 + 0.6 * e, 1, 1);
    }
    fx.cap = 1.8 * (1 - k) ** 2;
    fx.finGlow = 0.37 * (1 - e);
    fx.eye = 1;
    fx.pool = 1;
  }, ease.out);
  await lab.tween(0.48, (_, k) => {
    const t = k * 0.48;
    const fade = 1 - k * k;
    const door = 0.07 * Math.exp(-t / 0.05) * Math.sin((t / 0.09) * TAU); // the door rattles in its lock
    const slide = 0.17 * Math.exp(-t / 0.15) * Math.sin((t / 0.34) * TAU) * fade; // she skids on along its face and back
    const roll = 0.22 * Math.exp(-t / 0.12) * Math.sin((t / 0.26) * TAU) * fade; // her top tips the way she was going
    const pitch = -0.08 * Math.exp(-t / 0.1) * Math.cos((t / 0.24) * TAU) * fade; // the outward lean lets go
    setDoorOnly(TAU * LOST + door);
    maya.set({ x: 3, y: 1 + slide, rot: facing(1) + TAU * LOST + slide * 0.4, pitch, roll, lift: 0 });
  }, ease.linear);
  setDoorOnly(TAU * LOST);
  maya.set({ x: 3, y: 1, rot: facing(1) + TAU * LOST, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, lift: 0 });
  // a deadpan beat, nose to the fin, as if nothing happened
  await lab.wait(0.1);
  fin.rotation.y = baseRot;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
  for (const l of latches) l.visible = false;

  // the door and Maya, turned together by th (radians) about the fin's middle
  function setDoor(th, pitch, strain, roll) {
    setDoorOnly(th);
    maya.set({
      x: PIV.x - R * Math.cos(th) - strain,
      y: PIV.y + R * Math.sin(th),
      rot: facing(1) + th,
      pitch,
      roll,
      sx: 1,
      sz: 1,
    });
  }
  function setDoorOnly(th) {
    fin.rotation.y = baseRot + th;
  }
}

/** A heavy door's spin: angle, speed and acceleration over time, from a small simulation. */
function spinProfile(th0, total) {
  const dt = 1 / 480;
  const omax = 11.5; // rad/s at full swing
  const tau = 0.09; // the door's inertia: how fast it answers
  const samples = [];
  let th = th0;
  let w = 1.2;
  let t = 0;
  while (th < th0 + total - 1e-4 && t < 3) {
    const phase = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const hitch = 1 - 0.86 * Math.exp(-(((phase - Math.PI) / 0.5) ** 2)); // the far side: it nearly stops
    const target = omax * hitch;
    const a = (target - w) / tau;
    samples.push({ t, th, w, a });
    w += a * dt;
    th += w * dt;
    t += dt;
  }
  samples.push({ t, th: th0 + total, w, a: 0 });
  const T = t;
  return {
    T,
    omax,
    at(time) {
      const i = Math.min(samples.length - 1, Math.max(0, Math.round(time / dt)));
      const s = samples[i];
      return { ...s, th: Math.min(th0 + total, s.th) };
    },
  };
}

function findFin(lab) {
  const want = lab.pos(3.5, 1);
  let best = null;
  let bd = Infinity;
  for (const o of lab.arena.board.children) {
    if (!o.isGroup || o.children.length !== 2) continue;
    const g = o.children[0].geometry?.parameters;
    if (!g || Math.abs(g.height - 0.26) > 1e-6) continue;
    const d = Math.hypot(o.position.x - want.x, o.position.z - want.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
