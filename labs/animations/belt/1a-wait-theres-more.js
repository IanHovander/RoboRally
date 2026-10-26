// Wait, There's More (animator a: weight & physical comedy)
// The express step carries Maya one space and the belt stops dead. She wobbles to a stop, decides the ride is
// over and settles in like someone sinking into a sofa: a little shimmy, a big inhale, a long exhale into a
// comfortable squash, her eye dimming to a contented squint. Mid-exhale the all-belts step yanks the glass out
// from under her: her base shoots off first, her floppy, relaxed body is left behind leaning back, her eye snaps
// wide. The corner whips her round to face east and stops her hard; she lurches, shivers stiff, and stays bolt
// upright with her eye wide while the game carries on. Her body is a real spring-mass (it lags, overshoots and
// wobbles from the base's actual motion), relaxed and floppy before the yank, tense and stiff after it.
export const meta = {
  title: "Wait, There's More",
  idea:
    'Blue means two, learned the hard way. The belt stops after one space, Maya settles in for a contented sigh, and mid-exhale the all-belts step yanks her base out from under her: her relaxed body is left behind, her eye snaps wide, and she rides the corner stiff as a board.',
  notes:
    'Physics: the body is a damped spring on the base, driven by the base\'s real motion (loose while she relaxes, stiff once startled), and it tips over its own edge rather than through the glass. The belt\'s chevrons stop dead after the express step (that is what fools her) and lurch back to life on the all-belts step. Sound: a soft glass hum that stops with the belt; a two-note falling chime for the sigh; on the yank a sharp "tink" and her eye pinging up a fifth; a tight little glass rattle as she shivers. Running gag: she never learns. Ports to scene.js as a pose layer on belt moves (needs the express and all-belts beats to be separate, which they already are).',
};

const TAU = Math.PI * 2;

/** The body as a mass on a damped spring above the base: it lags when the base starts, overshoots when it stops. */
function springBody(k, c) {
  const s = { tx: null, tz: 0, vx: 0, vz: 0, bx: 0, bz: 0, k, c };
  s.step = (dt, bx, bz) => {
    if (s.tx == null) Object.assign(s, { tx: bx, tz: bz, bx, bz });
    if (dt <= 0) return;
    const n = 8;
    const h = dt / n;
    const vbx = (bx - s.bx) / dt;
    const vbz = (bz - s.bz) / dt;
    for (let i = 1; i <= n; i++) {
      const cx = s.bx + (bx - s.bx) * (i / n);
      const cz = s.bz + (bz - s.bz) * (i / n);
      s.vx += (-s.k * (s.tx - cx) - s.c * (s.vx - vbx)) * h;
      s.vz += (-s.k * (s.tz - cz) - s.c * (s.vz - vbz)) * h;
      s.tx += s.vx * h;
      s.tz += s.vz * h;
    }
    s.bx = bx;
    s.bz = bz;
  };
  return s;
}

export default async function play(lab) {
  const { ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  let eye = null;
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && (eye = o));
  const eyeScale = eye ? eye.scale.clone() : null;

  // the express belt's chevrons: we stop and start them ourselves
  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];
  const beltSpeed0 = belt.speed;
  lab.cleanup(() => {
    belt.speed = beltSpeed0;
    if (eye) eye.scale.copy(eyeScale);
    m.body.scale.set(1, 1, 1);
  });

  // everything about her that the beats animate
  const S = {
    x: 1, y: 1, rot: facing(0),
    sx: 1, sy: 1, sz: 1, // squash of the body (not the ring)
    open: 1, glow: 1, // eye: how open, how bright (1 = the game's own)
    shimmy: 0, breathe: 0,
    G: 2.0, // how much the spring's lag becomes lean
    beltBoost: 0, // extra light in the chevrons
  };
  const spring = springBody(380, 10);
  const R = 0.36; // the Pebble's half-width: it tips over its edge, not through the glass

  const stopSim = lab.every((dt) => {
    const p = lab.pos(S.x, S.y);
    spring.step(dt, p.x, p.z);
    belt.mat.color.setScalar((1.15 + S.beltBoost) * (0.3 + 0.7 * (1 - arena.dimCur)));
  });

  maya.each = (model, t) => {
    const ox = spring.tx - spring.bx;
    const oz = spring.tz - spring.bz;
    const r = S.rot;
    // into her own frame (front is -z)
    const lx = ox * Math.cos(r) - oz * Math.sin(r);
    const lz = ox * Math.sin(r) + oz * Math.cos(r);
    const soft = (a) => 0.55 * Math.tanh(a / 0.55);
    const rx = soft(lz * S.G * 4.2); // pitch about x
    const rz = soft(-lx * S.G * 4.2); // roll about z
    model.body.rotation.x = rx;
    model.body.rotation.z = rz;
    const tip = Math.hypot(rx, rz);
    model.body.position.y = R * Math.sin(tip) * 0.85 + S.breathe;
    // her base leads: the body is also sheared back a hair along the lag
    model.body.position.x = lx * 0.35;
    model.body.position.z = lz * 0.35;
    model.body.scale.set(S.sx, S.sy, S.sz);
    if (eye) eye.scale.set(eyeScale.x * S.open, eyeScale.y * (0.9 + 0.1 * S.open), eyeScale.z * Math.min(1.6, S.open));
    const g = S.glow;
    model.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g * (g < 1 ? 0.85 : 1));
    void t;
  };
  const pose = () => maya.set({ x: S.x, y: S.y, rot: S.rot + S.shimmy });
  const drive = lab.every(pose);

  // ---- 1. the express step: one space east, and the belt stops dead ----
  S.beltBoost = 0.9;
  belt.speed = 1.8;
  await lab.tween(
    0.42,
    (e, k) => {
      S.x = 1 + e;
      belt.speed = 1.8 * Math.sin(Math.PI * Math.min(1, k * 1.05)) + 0.0001;
      S.beltBoost = 0.9 * (1 - k);
    },
    ease.inOut,
  );
  S.x = 2;
  belt.speed = 0; // the chevrons freeze: the ride is "over"
  S.beltBoost = 0;
  // the stop's wobble plays out (the spring does it)
  await lab.wait(0.26);

  // ---- 2. she settles in: a shimmy, an inhale, a long contented exhale ----
  spring.k = 220; // relaxing: her body goes soft
  spring.c = 6;
  await lab.tween(0.22, (e, k) => {
    S.shimmy = Math.sin(k * TAU * 1.5) * 0.07 * (1 - k * 0.5);
    S.sx = S.sz = 1 + 0.02 * Math.sin(k * Math.PI);
  }, ease.linear);
  S.shimmy = 0;
  // inhale: up a hair, eye starts to soften
  await lab.tween(0.2, (e) => {
    S.sy = 1 + 0.06 * e;
    S.sx = S.sz = 1 - 0.02 * e;
    S.open = 1 - 0.25 * e;
    S.glow = 1 - 0.25 * e;
  }, ease.out);
  // exhale: sinking into a comfortable squash, eye drops to a soft content squint... (interrupted)
  let exhale = true;
  lab.tween(0.6, (e) => {
    if (!exhale) return;
    S.sy = 1.06 - 0.22 * e;
    S.sx = S.sz = 0.98 + 0.1 * e;
    S.open = 0.75 - 0.4 * e;
    S.glow = 0.75 - 0.4 * e;
  }, ease.out);
  await lab.wait(0.26); // mid-sigh...
  exhale = false;

  // ---- 3. YANK: the all-belts step ----
  const sy0 = S.sy;
  const sx0 = S.sx;
  S.beltBoost = 1.4;
  belt.speed = 3.2;
  spring.k = 170; // still floppy for the first instant: the body is left behind
  spring.c = 4;
  // eye snaps wide, body snaps from slump to startled stretch
  lab.tween(0.1, (e) => {
    S.open = 0.35 + (2.7 - 0.35) * e;
    S.glow = 0.35 + (1.9 - 0.35) * e;
    S.sy = sy0 + (1.14 - sy0) * e;
    S.sx = S.sz = sx0 + (0.92 - sx0) * e;
  }, ease.out).then(() =>
    lab.tween(0.25, (e) => {
      S.open = 2.7 - 0.4 * e;
      S.glow = 1.9 - 0.4 * e;
      S.sy = 1.14 - 0.05 * e;
      S.sx = S.sz = 0.92 + 0.03 * e;
    }, ease.out),
  );
  // the corner swings her round to face east, with the overshoot of a heavy thing turned fast
  lab.at(0.12, () =>
    lab.tween(0.42, (e) => (S.rot = facing(0) + (facing(1) - facing(0)) * e), (k) => ease.outBack(k, 2.2)),
  );
  // the base goes: sudden start, carried, and stopped short on the corner
  await lab.tween(
    0.4,
    (e, k) => {
      S.x = 2 + e;
      belt.speed = 3.2 * (1 - k) + 1 * k;
      S.beltBoost = 1.4 * (1 - k);
      if (k > 0.35) {
        spring.k = 900; // she's tense now: stiff
        spring.c = 16;
      }
    },
    (k) => 1 - (1 - k) ** 1.35,
  );
  S.x = 3;
  belt.speed = beltSpeed0;
  S.beltBoost = 0;
  await lab.wait(0.12);
  // stiff: the wobble shivers out quick and small; she stays bolt upright with her eye wide
  spring.k = 1400;
  spring.c = 22;
  await lab.wait(0.3);
  S.rot = facing(1);

  // ---- hand her back, but she stays stiff and wide-eyed as the game carries on ----
  drive();
  stopSim();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
  const t0 = lab.t;
  const tail = lab.every(() => {
    const k = Math.min(1, (lab.t - t0) / 1.0);
    // she only starts to relax right at the end of the tail
    const hold = k < 0.7 ? 1 : 1 - ease.inOut((k - 0.7) / 0.3) * 0.6;
    m.body.scale.set(1 - 0.05 * hold, 1 + 0.09 * hold, 1 - 0.05 * hold);
    if (eye) eye.scale.set(eyeScale.x * (1 + 1.3 * hold), eyeScale.y, eyeScale.z * (1 + 0.5 * hold));
    const g = 1 + 0.5 * hold;
    m.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g);
    // a faint shiver now and then
    m.body.rotation.z = Math.sin(lab.t * 61) * 0.012 * hold;
    if (k >= 1) tail();
  });
}
