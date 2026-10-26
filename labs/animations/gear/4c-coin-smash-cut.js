// Gear, idea 4 (coin on a table), animator c: cut like a film. Maya tips onto the rim of her ring of light and
// wobbles like a settling coin; the point where her ring touches the glass is a spark that runs round her,
// slow at first, then faster and faster, its long-exposure arc growing from a comet into a complete spinning
// circle while the room darkens round her and the camera creeps in and sways with her. Her heading slips a
// quarter round inside it. Then she drops flat: a smash cut. In one frame the arc is gone, the room is lit, the
// camera is home, and nothing moves.
export const meta = {
  title: 'Coin: smash cut to still',
  idea:
    "Maya tips onto the rim of her ring of light and wobbles down like a coin on a table. The point where the ring touches the glass is a spark that runs round her faster and faster, its long-exposure arc growing from a little comet into a whole spinning circle (the rising whirr, made visible), while the room closes in on her and the camera creeps in and sways with her. Her heading slips a quarter round almost by accident. Then she drops flat and the film smash-cuts: in one frame the light is gone, the room is lit again, the camera is home, the gear stops, and everything is completely still.",
  notes:
    'Sound: a glassy whirr that rises in pitch with the spark, then cut to dead silence on the drop (the cut is the punchline: no clack, no chime). Red gear: the spark runs anticlockwise. The wobble rides on the rim of the ring, so every form (Pebble, Orb, Prism, Capsule, Cube, Spire) tips the same way. Porting: the camera "cut" is just returning the camera to home in one frame; the arc is a sub-frame-sampled ribbon so it stays smooth at speed.',
};

const TAU = Math.PI * 2;

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,.6)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a flat ribbon of light on the glass along a list of points, fading toward its tail
function ribbon(THREE, n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  // pts: [{ x, z, a }] from tail to head, a = brightness 0..1
  mesh.draw = (pts, color, width) => {
    const m = Math.min(n, pts.length);
    if (m < 2) return geo.setDrawRange(0, 0);
    for (let i = 0; i < m; i++) {
      const p = pts[i];
      const q = pts[Math.min(m - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const w = width * (0.35 + 0.65 * p.a);
      pos.set([p.x - dz * w, 0.012, p.z + dx * w, p.x + dz * w, 0.012, p.z - dx * w], i * 6);
      col.set([color.r * p.a, color.g * p.a, color.b * p.a, color.r * p.a, color.g * p.a, color.b * p.a], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, (m - 1) * 6);
  };
  return mesh;
}

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1;
  const sgn = s < 0 ? -1 : 1;
  const centre = lab.pos(start.x, start.y);
  const maya = lab.puppet('a');
  const color = new THREE.Color(maya.bot.color);
  const h0 = (start.d * Math.PI) / 2; // compass heading (radians, clockwise from north)
  const R = 0.41 * 1.3; // her ring: the rim she wobbles on

  // ---- the wobble, as functions of time ----
  const TIP = 0.16; // tipping onto the rim
  const T = 1.08; // the wobble
  const A0 = 0.36; // first tilt (radians)
  const tilt = (u) => A0 * (1 - u) ** 1.35 + 0.012;
  const f0 = 1.15; // revolutions per second at the start ...
  const f1 = 7.0; // ... and at the end
  const P = 2.6;
  const spin = (u) => s * TAU * (f0 * u * T + ((f1 - f0) * T * u ** (P + 1)) / (P + 1)); // integral of the rate
  const rate = (u) => f0 + (f1 - f0) * u ** P;
  const psi0 = h0 + Math.PI * 1.15; // she first leans back-left, toward us
  const headAt = (u) => h0 + s * (Math.PI / 2) * (u * u * (3 - 2 * u)); // creeps round, no overshoot

  // ---- the spark where the rim touches the glass, and its long exposure ----
  const glow = glowTexture(THREE);
  const spark = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color('#fff4e6').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  spark.rotation.x = -Math.PI / 2;
  spark.renderOrder = 5;
  spark.visible = false;
  lab.add(spark);
  const arc = lab.add(ribbon(THREE, 220));
  const hot = color.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.2);
  const contact = (u, rr = R + 0.03) => {
    const p = psi0 + spin(u);
    return { x: centre.x + Math.sin(p) * rr, z: centre.z - Math.cos(p) * rr };
  };

  // ---- camera: creeps in and sways with her, then cuts ----
  let push = 0;
  let sway = 0;
  let swayPsi = 0;
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(centre, 0.45 * push),
    dist: home.dist * (1 - 0.13 * push),
    roll: 0.018 * sway * Math.sin(swayPsi),
  }));

  // the gear under her turns with her (its own slow idle spin stops dead with her)
  const g0 = gear ? gear.mesh.rotation.z : 0;
  let gearRot = g0;

  const t0 = lab.t;
  let phase = 'tip';
  let prevU = 0;
  const stop = lab.every(() => {
    const k = lab.t - t0;
    let alpha = 0;
    let psi = psi0;
    let head = h0;
    let u = 0;
    if (k < TIP) {
      // tips up onto the rim, with a little catch
      alpha = tilt(0) * ease.outBack(k / TIP, 2.2);
    } else if (k < TIP + T) {
      u = (k - TIP) / T;
      alpha = tilt(u);
      psi = psi0 + spin(u);
      head = headAt(u);
    } else {
      u = 1;
      alpha = 0;
      head = headAt(1);
      psi = psi0 + spin(1);
    }
    if (phase !== 'still') {
      const rel = psi - head;
      maya.set({
        rot: -head,
        pitch: alpha * Math.cos(rel),
        roll: alpha * Math.sin(rel),
        lift: R * Math.sin(alpha),
      });
      if (gear) gearRot = g0 - sgn * s * (head - h0) * 1.0;
    }
    if (gear) gear.mesh.rotation.z = gearRot;
    // the spark and its arc
    if (phase === 'wobble' && k >= TIP) {
      const c = contact(u);
      spark.visible = true;
      spark.position.set(c.x, 0.014, c.z);
      const r = rate(u) / f1;
      spark.scale.setScalar(0.8 + 0.9 * r);
      spark.material.opacity = 0.55 + 0.45 * r;
      // the exposure: the last 0.2 s of the spark's path, sampled finely
      const pts = [];
      const span = 0.2 / T;
      const N = 120;
      for (let i = 0; i <= N; i++) {
        const uu = u - span + (span * i) / N;
        if (uu < 0) continue;
        const q = contact(uu);
        const a = (i / N) ** 1.2 * (0.45 + 0.95 * r);
        pts.push({ x: q.x, z: q.z, a });
      }
      arc.draw(pts, hot, 0.035 + 0.045 * r);
    }
    push = phase === 'still' ? 0 : ease.in(Math.min(1, k / (TIP + T)));
    // the room closes in on her as the whirr builds; the cut brings it all back at once
    arena.dim = arena.dimCur = phase === 'still' ? 0 : 0.65 * Math.min(1, k / (TIP + T));
    sway = phase === 'still' ? 0 : Math.min(1, k / 0.3) * (1 - u * 0.5);
    swayPsi = psi;
    prevU = u;
  });
  void prevU;
  maya.each = (m) => {
    // the rim scraping the glass: her ring brightens as the whirr rises
    const k = lab.t - t0;
    const u = Math.max(0, Math.min(1, (k - TIP) / T));
    if (phase === 'wobble') m.ringMat.opacity = Math.min(1, 0.9 + 0.3 * u);
  };

  lab.cleanup(() => (arena.dim = arena.dimCur = 0));

  // ---- beats ----
  if (gear) gear.pulse = lab.t;
  phase = 'wobble';
  await lab.wait(TIP + T);
  // the drop and the cut, in one frame: she is flat, the light is gone, the camera is home, the room is back
  phase = 'still';
  spark.visible = false;
  arc.visible = false;
  push = 0;
  sway = 0;
  maya.set({ rot: -headAt(1), pitch: 0, roll: 0, lift: 0, sy: 0.92, sx: 1.05, sz: 1.05 });
  // a tiny squash settles with no bounce, then nothing moves
  await lab.tween(0.1, (e) => maya.set({ sy: 0.92 + 0.08 * e, sx: 1.05 - 0.05 * e, sz: 1.05 - 0.05 * e }), ease.out);
  await lab.wait(0.3);
  stop();
  if (gear) {
    // hand the gear back so its idle spin carries on from where it stopped
    gear.extra = (gearRot + lab.t * 0.12 * gear.spin * sgn) / sgn;
    gear.kick = null;
  }
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
