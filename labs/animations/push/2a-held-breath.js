// Push, idea 44 (The Dark Gasps), animator a: weight & physical comedy.
export const meta = {
  title: 'The Dark Gasps: held breath',
  idea:
    "Maya hits Theo hard enough that the whole picture freezes for two frames, and in that freeze the black room around the slab turns out to be full: tiers of tiny warm phone lights, like an arena seen across the dark, all jolting upward at once as the impact's shock rolls out through them. They hold their breath while Theo skids, and when he stops they all let it out together, sagging a little below where they were and fading to black. Then, a beat too late, one light at the back gasps on its own, notices nobody else is, and sinks away.",
  notes:
    "Sound: a glass clink with a hit-stop, then a soft collective inhale (a breathy glass swell, many voices) that cuts off into silence while he slides, a falling exhale as they sink, then one tiny late 'oh!' chime. Physics: every light is a mass on its own spring (slightly different weight and stiffness each, so the crowd jiggles out of step like real people); the impact is an impulse that travels out from the point of contact at about 70 spaces/s (a ripple, near seats first), a held force keeps them up while the pushed robot moves, and letting it go makes them overshoot below rest (the exhale). The board's own light is never touched. Scaling: `drama` sets how many lights gasp (a share of the keenest seats). This single push on open floor is 0.42, a murmur of about a hundred; 1 robot further per chain adds 0.25, a shove toward a pit or off the board adds 0.4, and at 1 the whole arena (about 450 lights) gasps. The late gasper is always there, which is the running gag.",
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const F = (s) => Math.round(s * 30) / 30 - 0.004; // whole frames, so tweens don't drift

function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,.55)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  // a phone held up: a small lit portrait screen
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath();
  g.roundRect(26, 20, 12, 22, 3);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const SOUTH = facing(2);
  maya.set({ x: 1, y: 2, rot: EAST });
  theo.set({ x: 3, y: 2, rot: SOUTH });
  lab.playCard('a', ['m2']);

  // ----- how big a gasp this push deserves -----
  const chain = 1; // robots shoved by this move
  const danger = 0; // 1 if the shove sends someone toward a pit or off the board
  const drama = clamp01(0.42 + 0.25 * (chain - 1) + 0.4 * danger);

  // ----- the arena in the dark: tiers of seats rising around the slab -----
  const course = lab.arena.course;
  const hw = course.w / 2;
  const hh = course.h / 2;
  // judge what's in the picture from the game's home framing (the live camera may still be settling)
  const home = lab.arena.camHome;
  const cam = lab.camera3.clone();
  cam.clearViewOffset();
  cam.position.set(home.target.x, home.target.y + Math.sin(home.elev) * home.dist, home.target.z + Math.cos(home.elev) * home.dist);
  cam.lookAt(home.target);
  cam.updateMatrixWorld();
  const slab = new THREE.Box3(new THREE.Vector3(-hw, -0.4, -hh), new THREE.Vector3(hw, 0.02, hh));
  const ray = new THREE.Ray();
  const seats = [];
  for (let tier = 0; tier < 16; tier++) {
    const o = 0.7 + tier * 0.42;
    const y = -1.4 + tier * 0.26;
    const ax = hw + o;
    const az = hh + o;
    const per = 4 * (ax + az);
    const n = Math.round(per / 0.3);
    for (let i = 0; i < n; i++) {
      // walk the perimeter of a rounded rectangle
      let s = ((i + lab.rand() * 0.7) / n) * per;
      let x;
      let z;
      if (s < 2 * ax) (x = -ax + s), (z = -az);
      else if ((s -= 2 * ax) < 2 * az) (x = ax), (z = -az + s);
      else if ((s -= 2 * az) < 2 * ax) (x = ax - s), (z = az);
      else (s -= 2 * ax), (x = -ax), (z = az - s);
      // round the corners off a little, and scatter people in their row
      const r = Math.hypot(x / ax, z / az);
      const k = 1 / Math.max(1, r * 0.93);
      x = x * (0.93 + 0.07 * k) + (Math.abs(z) > az * 0.95 ? lab.range(-0.05, 0.05) : lab.range(-0.015, 0.015));
      z = z * (0.93 + 0.07 * k) + (Math.abs(z) > az * 0.95 ? lab.range(-0.015, 0.015) : lab.range(-0.05, 0.05));
      const p = new THREE.Vector3(x, y + lab.range(-0.03, 0.05), z);
      const v = p.clone().project(cam);
      if (Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98 || v.z > 1) continue; // off the picture
      ray.origin.copy(cam.position);
      ray.direction.copy(p).sub(cam.position);
      const dist = ray.direction.length();
      ray.direction.normalize();
      const hit = ray.intersectBox(slab, new THREE.Vector3());
      if (hit && hit.distanceTo(cam.position) < dist - 0.05) continue; // hidden behind the slab
      seats.push({ p, sx: v.x, sy: v.y, keen: lab.rand() });
    }
  }
  // the late one: a seat in the dark right above the board's far edge, in the middle
  let late = seats[0];
  for (const s of seats) if (Math.hypot(s.sx - 0.1, s.sy - 0.7) < Math.hypot(late.sx - 0.1, late.sy - 0.7)) late = s;
  // the crowd: the keenest share of the seats, as many as the drama says
  const want = Math.round(28 + drama * drama * 430);
  const crowd = seats.filter((s) => s !== late).sort((a, b) => b.keen - a.keen).slice(0, want);
  crowd.push(late);
  const N = crowd.length;

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ map: dotTexture(THREE), size: 0.34, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  lab.add(pts);

  // the late one is drawn on its own, a touch bigger, so the room can find it
  const lateMat = new THREE.SpriteMaterial({ map: mat.map, color: new THREE.Color('#ffe9c4').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lateDot = new THREE.Sprite(lateMat);
  lateDot.scale.set(0.34, 0.34, 1);
  lateDot.visible = false;
  lab.add(lateDot);

  const warmA = new THREE.Color('#ffe2b0');
  const warmB = new THREE.Color('#fff4e2');
  const contact = lab.pos(2.5, 2);
  const people = crowd.map((s, i) => {
    const isLate = s === late;
    const tint = warmA.clone().lerp(warmB, lab.rand());
    return {
      p: s.p,
      tint,
      late: isLate,
      w: lab.range(15, 22), // stiffness (rad/s)
      z: lab.range(0.28, 0.42), // damping ratio
      kick: lab.range(6, 8.5) * (isLate ? 1.1 : 1), // how hard they jolt (world units / s)
      hold: lab.range(0.3, 0.45), // how high they hold their breath
      delay: s.p.distanceTo(contact) / 70 + lab.range(0, 0.02),
      fadeAt: lab.range(0, 0.2),
      bright: lab.range(0.75, 1.4),
      sway: lab.range(0, Math.PI * 2),
      y: 0,
      v: 0,
      i,
    };
  });

  // crowd state: t0 = contact time, hold = holding their breath, out = the exhale started at
  const C = { t0: null, hold: false, outAt: null, lateAt: null };
  const stopCrowd = lab.every((dt, t) => {
    for (const q of people) {
      let b = 0;
      if (C.t0 != null) {
        const since = t - C.t0 - q.delay;
        const lateSince = q.late ? (C.lateAt == null ? -1 : t - C.lateAt) : since;
        const s = q.late ? lateSince : since;
        if (s >= 0) {
          if (!q.started) {
            q.started = true;
            q.v += q.kick; // the gasp: an impulse straight up
          }
          // held breath pulls them up; letting it go drops them past rest (the exhale)
          const held = q.late ? s < 0.4 : C.hold || C.outAt == null || t < C.outAt;
          const target = held ? q.hold : 0;
          const n = Math.max(1, Math.ceil(dt / (1 / 240)));
          const h = dt / n;
          for (let j = 0; j < n; j++) {
            q.v += (q.w * q.w * (target - q.y) - 2 * q.z * q.w * q.v) * h;
            q.y += q.v * h;
          }
          // brightness: on at once, a flare as they jolt, out as they sink
          const on = clamp01(s / 0.05);
          const flare = 1 + 0.9 * Math.exp(-s / 0.09);
          let off = 1;
          if (q.late) off = 1 - clamp01((s - 0.42) / 0.12);
          else if (C.outAt != null) off = 1 - ease.inOut(clamp01((t - C.outAt - 0.1 - q.fadeAt) / 0.35));
          b = on * flare * off * q.bright;
        }
      }
      let sw = Math.sin(t * 1.3 + q.sway) * 0.02;
      if (q.late) {
        // the late one looks left and right: nobody else is gasping
        const s = C.lateAt == null ? 0 : t - C.lateAt;
        sw += 0.07 * Math.sin(clamp01((s - 0.12) / 0.3) * Math.PI * 3) * Math.sin(clamp01((s - 0.12) / 0.3) * Math.PI);
        lateDot.position.set(q.p.x + sw, q.p.y + q.y, q.p.z);
        lateMat.opacity = Math.min(1, b);
        lateDot.visible = b > 0.01;
        b = 0;
      }
      pos[q.i * 3] = q.p.x + sw;
      pos[q.i * 3 + 1] = q.p.y + q.y;
      pos[q.i * 3 + 2] = q.p.z;
      col[q.i * 3] = q.tint.r * b * 2.4;
      col[q.i * 3 + 1] = q.tint.g * b * 2.4;
      col[q.i * 3 + 2] = q.tint.b * b * 2.4;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  // ----- the push itself, with weight -----
  // anticipation: Maya rocks back on her heels
  await lab.tween(F(0.14), (e) => maya.set({ x: 1 - 0.07 * e, pitch: -0.14 * e }), ease.out);
  // the charge: accelerating all the way to his flank
  const XC = 2.37;
  await lab.tween(F(0.3), (e, k) => maya.set({ x: 0.93 + (XC - 0.93) * e, pitch: -0.14 + 0.26 * k }), ease.in);

  // CONTACT: hit-stop. Two frames of nothing moving but the room catching its breath.
  C.t0 = lab.t;
  C.hold = true;
  // the viewer flinches too: the camera jolts back a little, showing more of the dark, and drifts home
  const tc = lab.t;
  const flinch = (t) => {
    const s = t - tc;
    return s < 0.09 ? ease.out(s / 0.09) : Math.max(0, 1 - ease.inOut(Math.min(1, (s - 0.09) / 1.25)));
  };
  const releaseCam = lab.camera((home, t) => ({ dist: home.dist * (1 + 0.09 * flinch(t)), el: home.el + 0.035 * flinch(t) }));
  maya.set({ sz: 0.88, sx: 1.06, pitch: 0.16 });
  theo.set({ sx: 0.8, sy: 1.08, sz: 1.04 });
  const glint = theo.model.paint.emissiveIntensity;
  theo.each = (m) => (m.paint.emissiveIntensity = glint + 1.6 * Math.max(0, 1 - theo.pose.sx) * 4);
  await lab.wait(F(0.08));

  // the shove: he shoots off and skids on the glass; she brakes behind him and nods forward
  const T = F(0.5);
  await lab.tween(T, (e, k) => {
    const t = k * T;
    // Maya: from contact speed to rest on space 3
    const mk = clamp01(t / 0.36);
    maya.set({ x: XC + (3 - XC) * (1 - (1 - mk) ** 2), sz: 0.88 + 0.12 * ease.outBack(clamp01(t / 0.2)), sx: 1.06 - 0.06 * clamp01(t / 0.2), pitch: 0.16 * Math.cos(t * 16) * Math.exp(-t * 7) });
    // Theo: launched faster than she moves, skids past 4 by a hair, eases back onto it
    const tk = clamp01(t / 0.38);
    const over = 0.07;
    const x = tk < 1 ? 3 + (1 + over) * (1 - (1 - tk) ** 2.2) : 4 + over * (1 - ease.inOut(clamp01((t - 0.38) / 0.12)));
    const un = clamp01(t / 0.16);
    theo.set({ x, sx: 0.8 + 0.2 * ease.outElastic(un), sy: 1.08 - 0.08 * un, sz: 1.04 - 0.04 * un, roll: -0.16 * Math.sin(clamp01(t / 0.45) * Math.PI) * (1 - 0.6 * k) + 0.06 * Math.sin(t * 26) * Math.exp(-t * 6) });
  }, ease.linear);
  theo.each = null;
  maya.set({ x: 3, sx: 1, sz: 1, pitch: 0 });
  theo.set({ x: 4, sx: 1, sy: 1, sz: 1, roll: 0 });

  // he's stopped: everyone breathes out together
  C.hold = false;
  C.outAt = lab.t;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  await lab.wait(F(0.72));

  // ...and one, a beat too late
  C.lateAt = lab.t;
  await lab.wait(F(0.58));
  stopCrowd();
  releaseCam();
  pts.visible = false;
  lateDot.visible = false;
}
