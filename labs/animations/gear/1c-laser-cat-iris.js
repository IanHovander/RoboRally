// Gear, idea 1 (laser-pointer cat), animator c: told like a cartoon chase. The gear's arrow tip peels off as a
// trembling mint dot and paints a long-exposure scribble on the glass while Maya snaps after it; when she
// freezes to stalk it the camera crash-zooms and the room's darkness closes in like an old film iris; the
// pounce hangs in slow motion, and as she lands on it the iris snaps open and the arrow tip relights.
export const meta = {
  title: 'Laser cat: iris in',
  idea:
    "The gear doesn't turn her, it lures her. Its arrow tip peels off as a trembling mint dot (a hand holds this pointer) that draws a long-exposure scribble as it skitters round her front, and Maya's nose snaps after it in jerky stops. When she freezes to stalk it the camera crash-zooms and the dark room closes in like a cartoon iris on her and the dot; the wiggle, a pounce that hangs in slow motion, and she lands on it facing east: the dot dies under her nose, the iris snaps open, the arrow tip relights on the gear.",
  notes:
    'Sound: a tiny glass tick for each of her head snaps, silence during the stalk (the iris), a soft glass "pip" as the dot goes out under her and a low chime as the arrow tip relights. The feints (a flick back, a false start, a longer pause) are seeded per robot and register, but the dot always dies at her new front. Red gear: everything mirrors and the dot runs anticlockwise. Porting: the iris is a HUD-layer radial mask centred on the robot; the dot reuses the gear texture without its arrowhead while it is away.',
};

const TAU = Math.PI * 2;
const MINT = '#7fe3c3';

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

// the game's gear drawing (scene.js gearTexture), optionally without its arrowhead
function gearTexture(THREE, color, tip) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.shadowColor = color;
  g.shadowBlur = 16;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 7;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
    g.lineTo(Math.cos(a) * 108, Math.sin(a) * 108);
    g.stroke();
  }
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 70, -Math.PI * 0.9, Math.PI * (tip ? 0.55 : 0.47));
  g.stroke();
  if (tip) {
    const a = Math.PI * 0.55;
    const ex = Math.cos(a) * 70;
    const ey = Math.sin(a) * 70;
    g.beginPath();
    g.moveTo(ex + 18, ey - 6);
    g.lineTo(ex, ey);
    g.lineTo(ex + 4, ey - 20);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// a flat ribbon of light on the glass that fades along its length (a long exposure of a moving point)
function ribbon(THREE, n, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  const c = new THREE.Color(color);
  mesh.draw = (pts, now, life, width, gain = 1) => {
    const live = pts.filter((p) => now - p.t < life).slice(-n);
    if (live.length < 2) return geo.setDrawRange(0, 0);
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      const q = live[Math.min(live.length - 1, i + 1)];
      const o = live[Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const age = (now - p.t) / life;
      const w = width * (0.45 + 0.55 * (1 - age));
      pos.set([p.x - dz * w, 0.011, p.z + dx * w, p.x + dz * w, 0.011, p.z - dx * w], i * 6);
      const k = gain * (1 - age) ** 1.4;
      col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, (live.length - 1) * 6);
  };
  return mesh;
}

// piecewise keyframes: [{ t, v, e }] reaches v at time t (easing e from the previous key)
function track(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return a.v + (b.v - a.v) * (b.e ?? ((x) => x))(k);
    }
  }
  return keys[keys.length - 1].v;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const DEG = Math.PI / 180;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = lab.arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1; // 1 green (clockwise), -1 red
  const centre = lab.pos(start.x, start.y);
  const c0 = start.d * 90; // compass degrees, clockwise from north
  const c1 = c0 + s * 90; // where she will face
  const maya = lab.puppet('a');
  const t0 = lab.t;

  // ---- the dot: peeled off the gear's arrow tip ----
  const glow = glowTexture(THREE);
  const dot = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(MINT).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(MINT).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const m of [halo, core]) {
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 4;
    dot.add(m);
  }
  dot.position.y = 0.014;
  lab.add(dot);
  const scribble = lab.add(ribbon(THREE, 400, MINT));
  const pts = [];

  // where the arrow tip is on the glass right now
  let tipC = c0 + 190;
  let tipR = 0.25;
  const oldMap = gear?.mesh.material.map;
  if (gear) {
    gear.mesh.updateWorldMatrix(true, false);
    const a = Math.PI * 0.55;
    const local = new THREE.Vector3((Math.cos(a) * 70 * 0.92) / 256, (-Math.sin(a) * 70 * 0.92) / 256, 0);
    const w = gear.mesh.localToWorld(local);
    tipC = Math.atan2(w.x - centre.x, -(w.z - centre.z)) / DEG;
    tipR = Math.hypot(w.x - centre.x, w.z - centre.z);
    // the lure always runs the gear's way round: unwrap the tip's angle behind her start
    while (s * (tipC - c0) < 120) tipC += s * 360;
    while (s * (tipC - c0) > 300) tipC -= s * 360;
    gear.mesh.material.map = gearTexture(THREE, s > 0 ? lab.PALETTE.right : lab.PALETTE.left, false);
    gear.pulse = lab.t;
    lab.cleanup(() => (gear.mesh.material.map = oldMap));
  }

  // ---- the chase, in scene seconds from the start (seeded feints) ----
  const R = 0.74; // just outside her ring, so her body never hides it
  const lure = c0 + s * 360 - s * 4; // it stops right in front of her nose
  const dotC = [{ t: 0, v: tipC }, { t: 0.1, v: tipC }, { t: 0.32, v: lure, e: ease.inOut }];
  const dotR = [{ t: 0, v: tipR }, { t: 0.1, v: R, e: ease.out3 }];
  const head = [{ t: 0, v: c0 }];
  let t = 0.4; // she has spotted it
  let dc = -4; // the dot's angle, measured from her start
  const at = (k) => c0 + s * k; // her heading
  const atD = (k) => c0 + s * (360 + k); // the dot's angle (it has already been once round)
  const dart = (to, dur, react = 0.05, snap = 0.06) => {
    dotC.push({ t, v: dotC[dotC.length - 1].v }, { t: t + dur, v: atD(to), e: ease.out3 });
    t += dur;
    head.push({ t: t + react, v: head[head.length - 1].v }, { t: t + react + snap, v: at(to), e: ease.out });
    dc = to;
  };
  const hold = (d) => (t += d);
  dart(26, 0.07);
  hold(0.08);
  const feints = [0, 1, 2].sort(() => lab.rand() - 0.5).slice(0, 2);
  for (const f of feints) {
    if (f === 0) {
      // a flick back a few degrees
      dart(dc - 9, 0.05, 0.04, 0.05);
      hold(0.05);
    } else if (f === 1) {
      // a false start: it twitches on, she twitches with it, it comes back
      const from = dc;
      dotC.push({ t, v: atD(from) }, { t: t + 0.04, v: atD(from + 7), e: ease.out }, { t: t + 0.09, v: atD(from), e: ease.inOut });
      head.push({ t: t + 0.05, v: head[head.length - 1].v }, { t: t + 0.08, v: at(from + 5), e: ease.out }, { t: t + 0.14, v: at(from), e: ease.inOut });
      t += 0.14;
    } else {
      dart(dc + 20, 0.06);
      hold(0.07);
    }
  }
  dart(64, 0.06);
  hold(0.06);
  dart(90, 0.06, 0.05, 0.07);
  const tc = t + 0.1; // the stalk: frozen on it
  const tw = tc + 0.07; // wiggle
  const tp = tw + 0.18; // pounce
  const H = 0.22; // hop (scene seconds)
  const tl = tp + H; // landing
  const tEnd = tl + 0.2;
  // while she wiggles, the dot creeps in to where her pointer will land
  dotR.push({ t: tw, v: R }, { t: tp + 0.02, v: 0.6, e: ease.inOut });

  // ---- the iris (the room's darkness closing on her and the dot) ----
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  let irisK = 0; // 0 open, 1 closed
  let zoom = 0; // crash zoom
  const camRelease = lab.camera((home) => ({
    target: home.target.clone().lerp(centre, 0.85 * zoom),
    fov: home.fov - 6 * zoom,
    dist: home.dist * (1 - 0.06 * zoom),
  }));

  let dotOn = 1;
  let lastK = 0;
  const dotAt = (k) => {
    const c = track(dotC, k) * DEG;
    const r = track(dotR, k);
    // the tremble of the hand holding the pointer
    const jx = (Math.sin(k * 71) + Math.sin(k * 43.7)) * 0.006;
    const jz = (Math.sin(k * 59.3) + Math.cos(k * 37.1)) * 0.006;
    return { x: centre.x + Math.sin(c) * r + jx, z: centre.z - Math.cos(c) * r + jz };
  };
  let eyeK = 1;
  const stop = lab.every(() => {
    const k = lab.t - t0;
    // the dot: polar round her, plus the tremble of the hand holding the pointer
    const p = dotAt(k);
    dot.position.x = p.x;
    dot.position.z = p.z;
    const born = Math.min(1, k / 0.1);
    const sc = (0.3 + 0.7 * ease.outBack(born)) * dotOn;
    dot.scale.setScalar(Math.max(0.001, sc));
    halo.material.opacity = (0.85 + 0.15 * Math.sin(k * 90)) * dotOn;
    dot.visible = dotOn > 0.01;
    // sub-frame samples, so the long exposure stays a smooth curve when the dot darts
    if (dotOn > 0.5 && k > 0.03) {
      for (let i = 1; i <= 6; i++) {
        const kk = lastK + ((k - lastK) * i) / 6;
        const q = dotAt(kk);
        pts.push({ x: q.x, z: q.z, t: t0 + kk });
      }
    }
    lastK = k;
    scribble.draw(pts, lab.t, 0.75, 0.022, 1.7);

    // Maya: heading, perk, stalk, wiggle, pounce
    let heading = track(head, k);
    let px = 0;
    let pz = 0;
    let sy = 1;
    let sxz = 1;
    let pitch = 0;
    let lift = 0;
    const perk = k > 0.33 && k < 0.47 ? Math.sin(((k - 0.33) / 0.14) * Math.PI) : 0;
    sy += 0.1 * perk;
    eyeK = 1 + 0.8 * perk;
    if (k >= tc) {
      const crouch = ease.out(Math.min(1, (k - tc) / 0.1));
      const up = k >= tp ? Math.min(1, (k - tp) / 0.05) : 0;
      sy = 1 - 0.2 * crouch * (1 - up);
      sxz = 1 + 0.08 * crouch * (1 - up);
      pitch = 0.1 * crouch * (1 - up);
      eyeK = 1 + 1.2 * crouch;
    }
    if (k >= tw && k < tp) {
      // the rear wiggles side to side; the nose stays locked on the dot
      const w = ((k - tw) / (tp - tw));
      const yaw = Math.sin(w * TAU * 2.5) * 0.13 * Math.sin(w * Math.PI) ** 0.5;
      heading += yaw / DEG;
      const L = 0.22;
      const hr = (heading - yaw / DEG) * DEG;
      px -= Math.cos(hr) * L * yaw;
      pz -= Math.sin(hr) * L * yaw;
    }
    if (k >= tp && k < tl + 0.2) {
      const h = Math.min(1, (k - tp) / H);
      lift = 0.26 * Math.sin(h * Math.PI) * (k < tl ? 1 : 0);
      pitch = k < tl ? -0.28 * Math.sin(h * Math.PI * 0.9) + 0.32 * Math.max(0, h - 0.55) / 0.45 : 0;
      sy = k < tl ? 1 + 0.14 * Math.sin(h * Math.PI) : 1;
      sxz = k < tl ? 1 - 0.05 * Math.sin(h * Math.PI) : 1;
      if (k >= tl) {
        const l = (k - tl) / 0.2;
        sy = 1 - 0.16 * (1 - ease.outBack(Math.min(1, l))) * 1;
        sy = Math.min(1.04, Math.max(0.84, sy));
        sxz = 1 + 0.06 * (1 - Math.min(1, l));
        pitch = 0.18 * (1 - ease.out(Math.min(1, l * 1.3)));
      }
      eyeK = 2.2;
    }
    if (k >= tl + 0.2) eyeK = 1 + 1.2 * Math.max(0, 1 - (k - tl - 0.2) / 0.1);
    maya.set({ x: start.x + px, y: start.y + pz, rot: -heading * DEG, sy, sx: sxz, sz: sxz, pitch, lift });

    // the iris: a soft circle of the room's darkness round her and the dot
    if (irisK > 0.001) {
      const m = lab.toScreen(centre.clone().lerp(dot.position, 0.35).setY(0.15));
      const edge = lab.toScreen(centre.clone().add(new THREE.Vector3(1, 0, 0)));
      const unit = Math.hypot(edge.x - lab.toScreen(centre).x, edge.y - lab.toScreen(centre).y);
      const big = 2200;
      const r0 = big + (unit * 1.05 - big) * irisK;
      iris.style.opacity = '1';
      iris.style.background = `radial-gradient(circle at ${m.x}px ${m.y}px, rgba(3,4,6,0) ${r0 * 0.8}px, rgba(3,4,6,${0.9 * Math.min(1, irisK * 1.6)}) ${r0}px)`;
    } else iris.style.opacity = '0';
  });
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * eyeK, 3.1 * eyeK, 2.9 * eyeK);
  };

  // ---- the beats ----
  lab.at(tc, () => {
    lab.tween(0.09, (e) => (zoom = e), ease.out3);
    lab.tween(0.22, (e) => (irisK = e), ease.inOut);
  });
  lab.at(tp + H * 0.35, () => lab.slowmo(0.35, 0.04));
  lab.at(tp + H * 0.72, () => lab.slowmo(1, 0.03));
  lab.at(tl, () => {
    // she lands on it: the dot goes out under her nose, the arrow tip relights on the gear
    dotOn = 0;
    lab.ring(dot.position.clone().setY(0.02), MINT, 0.14, 0.02, 0.3);
    lab.particles(dot.position.clone().setY(0.03), [MINT, '#ffffff'], 10, { speed: 0.7, up: 0.6, gravity: 2.5, size: 0.03, dur: 0.35 });
    if (gear) {
      gear.mesh.material.map = oldMap;
      gear.pulse = lab.t;
    }
    lab.tween(0.18, (e) => (irisK = 1 - e), ease.out);
    lab.tween(0.26, (e) => (zoom = 1 - e), ease.inOut);
  });

  await lab.wait(tEnd);
  stop();
  iris.remove();
  camRelease();
  maya.each = null;
  maya.release({ x: end.x, y: end.y, d: end.d });
  void c1;
}
