// Gear, idea 5 (singing glass), animator c: shot like a Busby Berkeley number. Maya's ring rubs the glass like
// a wet finger on a wine glass; the room goes down and the camera cranes up overhead as the glass around her
// starts to sing: grains of light jump restlessly where it vibrates, hunting through shapes, then gather on
// the still lines and lock into a compass rose (a real Chladni figure) whose longest petal points where she
// will face. She turns into it, and the figure sinks back into the glass as the camera comes down.
export const meta = {
  title: 'Chladni, from above',
  idea:
    "The glass sings: Maya's ring rubs it like a wet finger round a wine glass, the room dims and the camera cranes up overhead, Busby Berkeley style. Around her, grains of light dance where the glass vibrates, hunting restlessly through shapes, then gather on the still lines and lock into a Chladni figure: a compass rose in a circle, its east petal longest, the needle of her new heading. She turns smoothly into it, then the grains sink back into the glass and the camera comes down.",
  notes:
    'Sound: a glass-harp tone that wavers while the grains hunt (beating between two near pitches), settles into one pure note as the figure locks, and fades as the grains sink. The hunting shapes are seeded square-plate modes, so the shimmer differs every time, but the figure it finds is always the compass, with the long petal toward her new facing (red gear: west-pointing petals mirror). Porting: about 2000 points moved on the CPU by the plate\'s vibration (jitter where it moves, a drift toward where it is still).',
};

const TAU = Math.PI * 2;

function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, arena, PALETTE } = lab;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1;
  const centre = lab.pos(start.x, start.y);
  const maya = lab.puppet('a');
  const r0 = maya.pose.rot;
  const r1 = r0 - s * (Math.PI / 2);
  const thE = (end.d * Math.PI) / 2; // compass angle of her new facing
  const RAD = 1.5; // the singing patch: about three spaces across

  // ---- the plate's vibration ----
  // hunting: square-plate modes, seeded, cross-fading from one to the next
  const modes = [];
  for (let i = 0; i < 6; i++) {
    let n = 1 + Math.floor(lab.rand() * 5);
    let m = 1 + Math.floor(lab.rand() * 5);
    if (n === m) m = (m % 5) + 1;
    modes.push({ n, m, a: lab.rand() * TAU });
  }
  const mode = (md, x, z) => {
    const c = Math.cos(md.a);
    const sn = Math.sin(md.a);
    const u = ((x * c - z * sn) / RAD) * Math.PI * 0.5;
    const v = ((x * sn + z * c) / RAD) * Math.PI * 0.5;
    return (Math.cos(md.n * u) * Math.cos(md.m * v) - Math.cos(md.m * u) * Math.cos(md.n * v)) * 0.5;
  };
  // the figure it finds: a four-petal rose (N, E, S, W) inside a circle, the petal toward her new facing longest
  const rose = (x, z) => {
    const r = Math.hypot(x, z);
    const th = Math.atan2(x, -z);
    const lean = Math.max(0, Math.cos(th - thE)) ** 10;
    const Rp = 0.9 * (1 + 0.55 * lean);
    const F = r - Rp * Math.abs(Math.cos(2 * th));
    return F * (r - RAD) * 1.2;
  };
  let mix = 0; // 0 hunting .. 1 the figure
  let mi = 0; // which hunting modes
  let mf = 0; // cross-fade between them
  const field = (x, z) => {
    const h = mode(modes[mi % modes.length], x, z) * (1 - mf) + mode(modes[(mi + 1) % modes.length], x, z) * mf;
    return h * (1 - mix) + rose(x, z) * mix;
  };

  // ---- grains of light on the glass ----
  const N = 3200;
  const P = new Float32Array(N * 3);
  const C = new Float32Array(N * 3);
  const gx = new Float32Array(N);
  const gz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = RAD * 1.06 * Math.sqrt(lab.rand());
    const a = lab.rand() * TAU;
    gx[i] = Math.sin(a) * r;
    gz[i] = -Math.cos(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const grains = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, map: dotTexture(THREE), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  grains.frustumCulled = false;
  grains.renderOrder = 4;
  lab.add(grains);
  const warm = new THREE.Color(PALETTE.light);
  const tint = new THREE.Color(maya.bot.color);

  // the wet finger: a soft glint running round her ring
  const finger = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(THREE), color: warm.clone().multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  finger.scale.setScalar(0.22);
  lab.add(finger);
  const ring = maya.model.group?.children?.find((o) => o.geometry?.type === 'RingGeometry') ?? maya.group.children.find((o) => o.geometry?.type === 'RingGeometry');

  // ---- the room and the camera ----
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.dim = arena.dimCur = 0;
    if (ring) ring.scale.setScalar(1);
  });
  let tone = 0; // the note's loudness 0..1
  let room = 0;
  let crane = 0;
  let show = 0; // grains visible
  let sink = 0; // sinking back into the glass
  let turn = 0;
  let flash = 0; // the instant the figure locks: the note rings true
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(centre, 0.7 * crane),
    el: home.el + 0.4 * crane,
    dist: home.dist * (1 - 0.2 * crane),
  }));

  let lastT = lab.t;
  const stop = lab.every(() => {
    const dt = Math.min(0.05, lab.t - lastT);
    lastT = lab.t;
    // grains: thrown about where the glass moves, drifting to where it is still
    const jit = 0.9 * (1 - mix * 0.85) * tone;
    const pull = 2.4 + 9 * mix;
    for (let i = 0; i < N; i++) {
      let x = gx[i];
      let z = gz[i];
      const e = 0.01;
      const f = field(x, z);
      const fx = (field(x + e, z) - f) / e;
      const fz = (field(x, z + e) - f) / e;
      const g2 = fx * fx + fz * fz + 1e-4;
      // a Newton step toward the still line (f = 0)
      const k = Math.min(0.9, pull * dt);
      x -= (f * fx * k) / g2;
      z -= (f * fz * k) / g2;
      // and a random kick, as big as the vibration here
      const amp = Math.min(1, Math.abs(f) * 2.2) * jit * Math.sqrt(dt) * 0.55;
      x += (lab.rand() - 0.5) * amp;
      z += (lab.rand() - 0.5) * amp;
      const r = Math.hypot(x, z);
      if (r > RAD * 1.08) {
        x *= (RAD * 1.08) / r;
        z *= (RAD * 1.08) / r;
      }
      gx[i] = x;
      gz[i] = z;
      P[i * 3] = centre.x + x;
      P[i * 3 + 1] = 0.014 - 0.06 * sink * (0.5 + 0.5 * Math.min(1, r / RAD));
      P[i * 3 + 2] = centre.z + z;
      // bright where still; the needle petal takes her colour
      const still = Math.exp(-Math.abs(f) * 14);
      const th = Math.atan2(x, -z);
      const needle = mix * Math.max(0, Math.cos(th - thE)) ** 16 * Math.min(1, r / 0.6);
      const b = (1 + 1.1 * flash * still) * show * (0.45 + 0.75 * (0.4 + 0.6 * mix) * still) * (1 - sink) * (0.8 + 0.4 * Math.sin(lab.t * 31 + i));
      const col = warm.clone().lerp(tint, 0.55 * needle);
      C[i * 3] = col.r * b * 2;
      C[i * 3 + 1] = col.g * b * 2;
      C[i * 3 + 2] = col.b * b * 2;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    // the room goes down; the camera cranes overhead
    arena.dim = arena.dimCur = 0.5 * room;
    arena.key.intensity = key0 * (1 - 0.4 * room);
    arena.hemi.intensity = hemi0 * (1 - 0.3 * room);
    // the wet finger on her ring
    const fa = lab.t * TAU * 2.1 * s;
    finger.position.set(centre.x + Math.sin(fa) * 0.53, 0.02, centre.z - Math.cos(fa) * 0.53);
    finger.material.opacity = tone * (1 - mix * 0.6);
    maya.set({ rot: r0 + (r1 - r0) * turn });
  });
  maya.each = (m) => {
    m.ringMat.opacity = Math.min(1, 0.9 + 0.3 * tone);
    if (ring) ring.scale.setScalar(1 + tone * 0.012 * Math.sin(lab.t * 120));
  };

  // ---- beats ----
  if (gear) gear.pulse = lab.t;
  lab.tween(0.5, (e) => (crane = e), ease.inOut);
  lab.tween(0.3, (e) => (room = e), ease.inOut);
  lab.tween(0.25, (e) => (tone = e), ease.in);
  lab.tween(0.3, (e) => (show = e), ease.out);
  // hunting: the modes keep changing
  const cyc = 0.21;
  const tH = lab.t;
  const stopHunt = lab.every(() => {
    const k = (lab.t - tH) / cyc;
    mi = Math.floor(k);
    mf = ease.inOut(k - mi);
  });
  await lab.wait(0.62);
  // it finds the figure
  await lab.tween(0.32, (e) => (mix = e), ease.inOut);
  stopHunt();
  lab.tween(0.4, (e) => (flash = (1 - e) ** 2), ease.linear);
  // she turns into it; as she settles the camera starts down
  lab.at(0.32, () =>
    lab.tween(0.44, (e) => {
      crane = 1 - e;
      room = 1 - e;
    }, ease.inOut),
  );
  await lab.tween(0.42, (e) => (turn = e), ease.inOut);
  await lab.wait(0.04);
  // the note fades and the grains sink back into the glass
  await lab.tween(0.34, (e) => {
    sink = e;
    tone = 1 - e;
  }, ease.in);
  stop();
  grains.visible = false;
  finger.visible = false;
  if (ring) ring.scale.setScalar(1);
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.dim = arena.dimCur = 0;
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
