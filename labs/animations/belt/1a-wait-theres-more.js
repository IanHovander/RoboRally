// Wait, There's More (animator a: weight & physical comedy)
// The express step carries Maya one space and the belt stops dead. She wobbles to a stop, decides the ride is
// over and settles in like someone sinking into a sofa: a little shimmy to get comfy, a big inhale, a long
// exhale into a heavy squash, her eye dimming to a warm, content ember and her pool of light spreading out
// under her. Mid-exhale the all-belts step yanks the glass out from under her: her base shoots off first, her
// floppy, relaxed body is left behind leaning back, her eye flares wide with a little ring of alarm. The corner
// whips her round to face east and stops her hard; she lurches, shivers stiff, and stays bolt upright with her
// eye wide while the game carries on. Her body is a real spring-mass (it lags, overshoots and wobbles from the
// base's actual motion), loose and floppy while she relaxes, tense and stiff once she's startled.
export const meta = {
  title: "Wait, There's More",
  idea:
    'Blue means two, learned the hard way. The belt stops after one space, Maya sinks into a contented sigh, and mid-exhale the all-belts step yanks her base out from under her: her relaxed body is left behind, her eye flares wide, and she rides the corner stiff as a board.',
  notes:
    'Physics: the body is a damped spring on the base, driven by the base\'s real motion (loose while she relaxes, stiff once startled); it tips over its own edge rather than through the glass. The belt\'s chevrons stop dead after the express step (that is what fools her) and lurch back to life on the all-belts step. Her eye gets a soft halo so its mood reads from across the room: a small warm ember when content, a big white flare when startled. Sound: a soft glass hum that stops with the belt; a two-note falling chime for the sigh; on the yank a sharp "tink" and her eye pinging up a fifth; a tight little glass rattle as she shivers. Running gag: she never learns. Ports to scene.js as a pose layer on express-belt moves (the express and all-belts beats are already separate).',
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

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,.6)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.13)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { ease, facing, arena, THREE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  let eye = null;
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && (eye = o));
  const eyeScale = eye ? eye.scale.clone() : null;
  const RED = new THREE.Color('#ff4d6d');

  // the express belt's chevrons: we stop and start them ourselves
  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];
  const beltSpeed0 = belt.speed;
  lab.cleanup(() => {
    belt.speed = beltSpeed0;
    if (eye) eye.scale.copy(eyeScale);
    m.body.scale.set(1, 1, 1);
    m.body.position.x = 0;
  });

  // a soft halo on her eye, so its mood reads from across the room
  const glow = glowTexture(THREE);
  lab.cleanup(() => glow.dispose());
  const halo = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.renderOrder = 5;
  const WARM = new THREE.Color(1.0, 0.62, 0.32);
  const WHITE = new THREE.Color(1, 0.98, 0.94);
  const tmp = new THREE.Vector3();

  // everything about her that the beats animate
  const S = {
    x: 1, y: 1, rot: facing(0),
    sx: 1, sy: 1, sz: 1, // squash of the body (not the ring)
    open: 1, glow: 1, // eye: how open, how bright (1 = the game's own)
    haloS: 0.32, haloK: 0, warm: 0, // the eye's halo: size, brightness, how warm (0 white, 1 ember)
    pool: 1, // her pool of light on the glass (1 = the game's own)
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

  const placeHalo = () => {
    if (!eye) return;
    eye.getWorldPosition(tmp);
    halo.position.set(tmp.x, tmp.y + 0.06, tmp.z + 0.04);
    halo.scale.setScalar(S.haloS);
    halo.material.color.copy(WHITE).lerp(WARM, S.warm).multiplyScalar(S.haloK);
  };

  maya.each = (model) => {
    const ox = spring.tx - spring.bx;
    const oz = spring.tz - spring.bz;
    const r = S.rot;
    // into her own frame (front is -z)
    const lx = ox * Math.cos(r) - oz * Math.sin(r);
    const lz = ox * Math.sin(r) + oz * Math.cos(r);
    const soft = (a) => 0.6 * Math.tanh(a / 0.6);
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
    const w = S.warm;
    model.eyeMat.color.setRGB(3.2 * g, 3.1 * g * (1 - 0.25 * w), 2.9 * g * (1 - 0.5 * w));
    model.poolMat.opacity = 0.75 * S.pool;
    model.poolMat.color.copy(RED).multiplyScalar(0.9 * (0.8 + 0.2 * S.pool));
    placeHalo();
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
  await lab.wait(0.24);

  // ---- 2. she settles in: a shimmy to get comfy, an inhale, a long contented exhale ----
  spring.k = 200; // relaxing: her body goes soft
  spring.c = 5;
  await lab.tween(0.24, (e, k) => {
    S.shimmy = Math.sin(k * TAU * 1.5) * 0.09 * (1 - k * 0.5);
    S.sx = S.sz = 1 + 0.03 * Math.sin(k * Math.PI);
    S.sy = 1 - 0.04 * Math.sin(k * Math.PI * 3) * (1 - k);
  }, ease.linear);
  S.shimmy = 0;
  S.sy = 1;
  // inhale: up and narrow, the eye starts to soften and warm
  await lab.tween(0.2, (e) => {
    S.sy = 1 + 0.1 * e;
    S.sx = S.sz = 1 - 0.04 * e;
    S.open = 1 - 0.2 * e;
    S.warm = 0.4 * e;
    S.haloS = 0.32 + 0.04 * e;
    S.haloK = 0.45 * e;
  }, ease.out);
  // exhale: sinking into a heavy, comfortable squash, the eye an ember, her light pooling out... (interrupted)
  let exhale = true;
  lab.tween(0.62, (e) => {
    if (!exhale) return;
    S.sy = 1.1 - 0.36 * e;
    S.sx = S.sz = 0.96 + 0.2 * e;
    S.open = 0.8 - 0.5 * e;
    S.glow = 1 - 0.62 * e;
    S.warm = 0.4 + 0.6 * e;
    S.haloS = 0.36 + 0.2 * e;
    S.haloK = 0.45 + 0.35 * e;
    S.pool = 1 + 0.45 * e;
  }, ease.out);
  await lab.wait(0.36); // mid-sigh...
  exhale = false;

  // ---- 3. YANK: the all-belts step ----
  const sy0 = S.sy;
  const sx0 = S.sx;
  const pool0 = S.pool;
  S.beltBoost = 1.6;
  belt.speed = 3.4;
  spring.k = 150; // still floppy for the first instant: the body is left behind
  spring.c = 4;
  // a little ring of alarm around her eye, riding with her
  const alarm = lab.add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.05), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  alarm.rotation.x = -Math.PI / 2;
  lab.tween(0.32, (e, k) => {
    const at = lab.pos(S.x, S.y);
    alarm.position.set(at.x, 0.4 + 0.08 * e, at.z);
    alarm.scale.setScalar(0.12 + 0.34 * e);
    alarm.material.opacity = (1 - k) ** 1.5;
  }, ease.out).then(() => (alarm.visible = false));
  // the dent she left in the cushion: her warm, spread-out light stays behind on (2,1) for a moment
  const dent = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1.0, 0.42, 0.36).multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  dent.rotation.x = -Math.PI / 2;
  dent.position.copy(lab.pos(2, 1)).setY(0.005);
  dent.renderOrder = 2;
  lab.tween(0.9, (e) => {
    dent.material.opacity = 0.85 * (1 - e);
    dent.scale.set(1 - 0.35 * e, 1 - 0.35 * e, 1);
  }, ease.in).then(() => (dent.visible = false));
  // eye snaps wide and white, body snaps from slump to startled stretch
  lab.tween(0.09, (e) => {
    S.open = 0.3 + (2.8 - 0.3) * e;
    S.glow = 0.38 + (2.0 - 0.38) * e;
    S.warm = 1 - e;
    S.haloS = 0.5 + 0.55 * e;
    S.haloK = 0.45 + 0.75 * e;
    S.sy = sy0 + (1.16 - sy0) * e;
    S.sx = S.sz = sx0 + (0.9 - sx0) * e;
    S.pool = pool0 + (0.8 - pool0) * e;
  }, ease.out).then(() =>
    lab.tween(0.3, (e) => {
      S.open = 2.8 - 0.4 * e;
      S.glow = 2.0 - 0.45 * e;
      S.haloS = 1.05 - 0.45 * e;
      S.haloK = 1.2 - 0.6 * e;
      S.sy = 1.16 - 0.06 * e;
      S.sx = S.sz = 0.9 + 0.04 * e;
      S.pool = 0.8 + 0.2 * e;
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
      belt.speed = 3.4 * (1 - k) + 1 * k;
      S.beltBoost = 1.6 * (1 - k);
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
  m.body.position.x = 0;
  maya.release({ x: 3, y: 1, d: 1 });
  const t0 = lab.t;
  const tail = lab.every(() => {
    const k = Math.min(1, (lab.t - t0) / 1.0);
    // she only starts to relax right at the end of the tail
    const hold = k < 0.7 ? 1 : 1 - ease.inOut((k - 0.7) / 0.3) * 0.6;
    m.body.scale.set(1 - 0.06 * hold, 1 + 0.1 * hold, 1 - 0.06 * hold);
    if (eye) eye.scale.set(eyeScale.x * (1 + 1.4 * hold), eyeScale.y, eyeScale.z * (1 + 0.5 * hold));
    const g = 1 + 0.55 * hold;
    m.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g);
    S.haloS = 0.32 + 0.28 * hold;
    S.haloK = 0.6 * hold * (1 - ease.in(k));
    S.warm = 0;
    placeHalo();
    // a faint shiver now and then
    m.body.rotation.z = Math.sin(lab.t * 61) * 0.012 * hold;
    if (k >= 1) tail();
  });
}
