// Edge, idea 1 (Bungee), animator a: weight & physical comedy.
export const meta = {
  title: 'Bungee',
  idea:
    'Maya drives off the rim and her own red trail peels off the glass and catches her like a bungee cord: it stretches thin and hot as it takes her weight, ' +
    'twangs, and flings her back up level with the rim, where she hangs for a breath, turned toward home with her nose over the glass. ' +
    'She starts to drop, the cord catches her once more, necks down to a hair and pops. She drops into the dark and goes out, ' +
    'while the loose cord whips back across the board, cracks down on the space she started from and is gone.',
  notes:
    'Sound: a rising rubbery creak as the cord stretches, a low glass "thoom" at the yank (the slab dips a hair under her weight), silence for the hang, ' +
    'a tiny bright "tink" for the pop, a falling whistle that fades, then a slap and a glass chime where the cord cracks down. ' +
    'The cord is the trail drawn as a ribbon (same width and cross-section as Lumen\'s trail); after the snap it contracts uniformly toward its anchor ' +
    'like a real elastic band, so the free end leads the whip. Port: the rebound height and the whip\'s wiggle can vary a little each time. ' +
    'Ava turns to watch, then flinches when the cord cracks down near her.',
};

const PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));

/** A ribbon of light like Lumen's trail: flat on the glass, turning to face the camera when it leaves it. */
function makeRibbon(lab, max) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 6);
  const col = new Float32Array(max * 6);
  const uv = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  lab.add(mesh);
  const T = new THREE.Vector3();
  const V = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const sf = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    draw(pts) {
      const n = Math.min(pts.length, max);
      if (n < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        T.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
        V.set(cam.x - p.x, cam.y - p.y, cam.z - p.z).normalize();
        sc.crossVectors(T, V).normalize();
        sf.crossVectors(T, up);
        if (sf.lengthSq() < 1e-6) sf.copy(sc);
        else sf.normalize();
        if (sc.dot(sf) < 0) sc.negate();
        const f = p.flat ?? 1;
        sf.multiplyScalar(f).addScaledVector(sc, 1 - f).normalize();
        pos.set([p.x - sf.x * p.w, p.y - sf.y * p.w, p.z - sf.z * p.w, p.x + sf.x * p.w, p.y + sf.y * p.w, p.z + sf.z * p.w], i * 6);
        col.set([p.r, p.g, p.b, p.r, p.g, p.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

/** A soft round glow (a sprite), for pops and glints. */
function makeGlow(lab, color) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  s.renderOrder = 4;
  lab.add(s);
  return s;
}

/** Sparks of light with weight: they fly, fall and fade. */
function makeSparks(lab, n) {
  const { THREE } = lab;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  lab.add(pts);
  let parts = [];
  return {
    burst(at, colors, speed, up) {
      parts = [];
      for (let i = 0; i < n; i++) {
        const a = lab.range(0, PI * 2);
        const sp = lab.range(0.3, 1) * speed;
        const c = new THREE.Color(colors[i % colors.length]).multiplyScalar(2.2);
        parts.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * sp, lab.range(0.2, 1) * up, Math.sin(a) * sp * 0.6), c });
      }
    },
    update(dt, opacity) {
      parts.forEach((q, i) => {
        q.v.y -= 6 * dt;
        q.p.addScaledVector(q.v, dt);
        pos.set([q.p.x, q.p.y, q.p.z], i * 3);
        col.set([q.c.r, q.c.g, q.c.b], i * 3);
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      pts.material.opacity = parts.length ? opacity : 0;
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  maya.set({ trail: false }); // she lays her own trail: it is about to become a cord
  const RED = new THREE.Color('#ff4d6d');
  const ZM = -0.5; // Maya's row (y = 1) in world z
  const RIM = 3.5; // the east rim in world x
  const AX = 1; // where her move starts, (4, 1), in world x
  const wx = (sx) => sx - 3;

  // ---- timeline (seconds) ----
  const T_EDGE = 0.95; // her centre is over the rim
  const T_BOT = 1.45; // bottom of the drop: the yank
  const T_TOP = 1.85; // back up level with the rim
  const T_DROP = 2.08; // she starts to fall again
  const T_CATCH = 2.29; // the cord catches her once more
  const T_SNAP = 2.44; // pop
  const T_GONE = 2.84; // her light is out
  const T_SLAP = 2.78; // the loose end cracks down on (4, 1)
  const T_END = 3.1;
  const G = 15; // cartoon gravity (world units / s²)

  const driveX = (t) => {
    if (t < 0.14) return 4 - 0.07 * ease.out(t / 0.14);
    const k = Math.min(1, (t - 0.14) / 0.81);
    return 3.93 + 2.62 * (0.5 * k + 0.5 * k * k);
  };
  // lift during the first drop: free fall, then the cord takes her like a spring
  const dropLift = (dt) => {
    const tf = 0.27;
    if (dt < tf) return -0.5 * G * dt * dt;
    const v = G * tf;
    const w = PI / (2 * 0.23);
    return -0.5 * G * tf * tf - (v / w) * Math.sin(w * (dt - tf));
  };
  const LIFT_BOT = dropLift(0.5);
  const xBot = 6.55 + 0.95 * (1 - Math.exp(-4.5 * 0.5));
  const pitchBot = Math.min(1.45, Math.atan2(-LIFT_BOT + 0.05, xBot - 3 - 3.5));
  const XTOP = 7.1; // the top of the rebound: in the air, nose a hand's width from the rim

  function mayaPose(t) {
    const P = { x: 4, y: 1, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, visible: true, light: 1 };
    if (t < T_EDGE) {
      P.x = driveX(t);
      if (t < 0.14) {
        const k = ease.out(t / 0.14);
        P.pitch = -0.17 * k;
        P.sy = 1 - 0.07 * k;
      } else {
        const k = (t - 0.14) / 0.81;
        P.pitch = -0.17 * (1 - k) ** 3 + 0.06 * Math.sin(k * PI) * k;
        P.sy = 1 - 0.07 * (1 - Math.min(1, k * 4));
      }
      // the nose starts to dip as the centre reaches the rim
      P.pitch += 0.5 * seg(P.x, 6.3, 6.55) ** 2;
    } else if (t < T_BOT) {
      const dt = t - T_EDGE;
      P.x = 6.55 + 0.95 * (1 - Math.exp(-4.5 * dt));
      P.lift = dropLift(dt);
      // she hangs along the cord, tail toward the rim, flung outward by her own speed
      const cordAngle = Math.min(1.45, Math.atan2(-P.lift + 0.05, Math.max(0.05, wx(P.x) - RIM)));
      P.pitch = lerp(0.5, cordAngle, ease.inOut(seg(dt, 0, 0.3)));
      // the yank: she stretches along the cord
      P.sz = 1 + 0.22 * bump(t, T_BOT - 0.02, 0.06);
      P.sx = 1 - 0.1 * bump(t, T_BOT - 0.02, 0.06);
    } else if (t < T_TOP) {
      const k = (t - T_BOT) / (T_TOP - T_BOT);
      P.x = lerp(xBot, XTOP, ease.out(k));
      P.lift = LIFT_BOT * (1 - k) ** 2.1 + 0.05 * k;
      // yanked up tail-first, then she flips upright and spins round toward home
      const flip = ease.inOut(seg(k, 0.4, 0.92));
      P.pitch = lerp(pitchBot + 0.25 * Math.sin(k * 9) * (1 - k), -0.2, flip);
      P.rot = facing(1) + PI * ease.inOut(seg(k, 0.25, 1));
      P.sz = 1 + 0.12 * Math.sin(k * 14) * (1 - k) ** 2;
    } else if (t < T_DROP) {
      const k = (t - T_TOP) / (T_DROP - T_TOP);
      P.x = lerp(XTOP, XTOP - 0.03, k);
      P.lift = 0.05 + 0.012 * Math.sin(k * PI);
      P.rot = facing(1) + PI;
      // the wobble of the flip settles into a lean toward home: nose over the glass
      P.pitch = lerp(-0.2, 0.24, ease.out(k)) + 0.08 * Math.sin(k * 15) * (1 - k);
      P.roll = 0.06 * Math.sin(k * 11) * (1 - k);
    } else if (t < T_SNAP) {
      P.x = XTOP - 0.03;
      P.rot = facing(1) + PI;
      if (t < T_CATCH) {
        const dt = t - T_DROP;
        P.lift = 0.062 - 0.5 * G * dt * dt;
        P.pitch = 0.24 - 0.5 * ease.out(dt / (T_CATCH - T_DROP));
      } else {
        // caught! a tiny bounce on the cord, and it holds... for a moment
        const k = (t - T_CATCH) / (T_SNAP - T_CATCH);
        const low = 0.062 - 0.5 * G * (T_CATCH - T_DROP) ** 2;
        P.lift = low + 0.04 * Math.sin(Math.min(1, k * 1.6) * PI) * (1 - k * 0.5) + 0.03 * k;
        P.pitch = -0.26 + 0.1 * Math.sin(k * 10) * (1 - k);
        P.sy = 1 - 0.1 * bump(k, 0.08, 0.15);
      }
    } else {
      // gone: she drops clean, toppling backward, and her light goes out
      const dt = t - T_SNAP;
      const low = 0.062 - 0.5 * G * (T_CATCH - T_DROP) ** 2 + 0.03;
      P.x = XTOP - 0.03 + 0.15 * dt;
      P.rot = facing(1) + PI;
      P.lift = low - 0.5 * G * dt * dt;
      P.pitch = -0.26 - 1.6 * dt * dt * 3;
      P.light = 1 - seg(dt, 0.1, 0.39);
      P.visible = t < T_GONE;
    }
    return P;
  }

  // world point of Maya's harness (just behind the middle of her base), from a pose
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const harness = (P) => {
    const at = lab.pos(P.x, P.y);
    dummy.position.set(at.x, P.lift, at.z);
    dummy.rotation.set(-P.pitch, P.rot, -P.roll);
    dummy.scale.set(1.3 * P.sx, 1.3 * P.sy, 1.3 * P.sz);
    dummy.updateMatrix();
    return new THREE.Vector3(0, 0.07, 0.1).applyMatrix4(dummy.matrix);
  };

  // her trail as she lays it: a sample every frame of the drive, with the game's fade by age
  const laid = [];
  for (let t = 0.14; t <= T_EDGE + 1e-6; t += 1 / 60) laid.push({ x: wx(driveX(t)), t });
  const trailPt = (s, age, extra = 1) => {
    const a = Math.min(1, age / 3.2);
    const k = Math.max(0, 1 - a) ** 1.6 * 1.8 * extra;
    return { x: s.x, y: 0.008, z: ZM, w: 0.16 + 0.06 * (1 - a), r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 };
  };

  // the cord's shape while it is whole
  const L0 = 0.45;
  function cord(t, P, anchor) {
    const pts = [];
    if (t < T_EDGE) {
      for (const s of laid) if (s.t <= t) pts.push(trailPt(s, t - s.t));
      const at = lab.pos(P.x, 1);
      pts.push(trailPt({ x: at.x }, 0));
      pts.forEach((p, i) => {
        const k = Math.min(1, i / 3);
        p.r *= k;
        p.g *= k;
        p.b *= k;
      });
      return { pts };
    }
    const Rp = new THREE.Vector3(RIM + 0.012, 0.03, ZM);
    const span = Rp.distanceTo(anchor);
    const tension = clamp01((span - L0) / 0.75);
    // the glass part, peeling back from the rim as it takes the weight
    const peel = 0.12 + 0.5 * Math.min(1, (t - T_EDGE) / 0.5) ** 0.7;
    const px = RIM - peel;
    const frozen = (s) => T_EDGE - s.t; // once it is holding her it stops fading
    const hot = 1 + 1.6 * tension; // stretched cord burns brighter
    laid.forEach((s, i) => {
      if (s.x >= px) return;
      const near = seg(s.x, px - 1.0, px); // brighter toward the peel
      const p = trailPt(s, frozen(s), 1 + (hot - 1) * near * 0.8);
      const k = Math.min(1, i / 3);
      p.r *= k;
      p.g *= k;
      p.b *= k;
      pts.push(p);
    });
    // thinning with tension; thicker again when slack
    const wHang = lerp(0.17, 0.045, tension ** 0.8);
    const kHang = 1.8 * hot;
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const x = lerp(px, Rp.x, u);
      const w = lerp(0.2, wHang, u);
      const k = lerp(1.6, kHang, u);
      pts.push({ x, y: 0.008 + 0.022 * u * u, z: ZM, w, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 - u });
    }
    // the hanging part: a slack cord sags, a taut one is straight and twangs after the yank
    const slack = Math.max(0, L0 + 0.12 - span);
    const mid = Rp.clone().lerp(anchor, 0.5);
    mid.y -= slack * 1.6;
    const dir = anchor.clone().sub(Rp).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0);
    const twang = 0.09 * Math.exp(-7 * Math.max(0, t - T_BOT)) * (t > T_BOT - 0.03 ? 1 : 0) * Math.sin((t - T_BOT) * 2 * PI * 11) + 0.05 * Math.exp(-12 * Math.max(0, t - T_CATCH)) * (t > T_CATCH ? 1 : 0) * Math.sin((t - T_CATCH) * 2 * PI * 13);
    const neck = t > T_CATCH ? ease.in(seg(t, T_CATCH + 0.02, T_SNAP)) : 0;
    const N = 26;
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      const p = new THREE.Vector3(a * Rp.x + b * (2 * mid.x - 0.5 * Rp.x - 0.5 * anchor.x) + c * anchor.x, a * Rp.y + b * (2 * mid.y - 0.5 * Rp.y - 0.5 * anchor.y) + c * anchor.y, ZM);
      p.addScaledVector(perp, twang * Math.sin(PI * u));
      const nk = bump(u, 0.62, 0.13) * neck;
      const w = wHang * (1 - 0.85 * nk) * (0.9 + 0.1 * (1 - u));
      const k = kHang * (1 + 1.8 * nk);
      pts.push({ x: p.x, y: p.y, z: p.z, w, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 0, u });
    }
    return { pts, tension, Rp };
  }

  const rope = makeRibbon(lab, 140);
  const stub = makeRibbon(lab, 8);
  const pop = makeGlow(lab, new THREE.Color('#ffe2e7').multiplyScalar(3));
  const glint = makeGlow(lab, RED.clone().multiplyScalar(2.2));
  const slapGlow = makeGlow(lab, RED.clone().multiplyScalar(2.6));
  const sparks = makeSparks(lab, 16);
  // her light on the floor far below: it tightens and brightens as she nears it
  const floorGlow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: RED.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -PI / 2;
    lab.add(m);
    return m;
  })();

  let snapshot = null; // the loose cord, frozen at the snap
  let snapAt = null;
  let slapped = false;
  let mayaGone = false;
  const t0 = lab.t;
  lab.playCard('a', ['m3']);
  const card = () => lab.bot('a').card;
  const baseIntensity = maya.model.paint.emissiveIntensity;
  maya.model.paint.transparent = true;
  lab.cleanup(() => {
    arena.board.position.y = 0;
  });

  // camera: drop a little lower and lean toward the rim so the fall below the glass reads
  const aim = new THREE.Vector3(2.75, -0.6, -0.4);
  const releaseCam = lab.camera((home) => {
    const t = lab.t - t0;
    const k = ease.inOut(seg(t, 0.45, 1.15));
    return { target: home.target.clone().lerp(aim, k), el: lerp(home.el, 0.5, k), dist: lerp(home.dist, 8.4, k) };
  });

  let mayaLight = 1;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * mayaLight, 3.1 * mayaLight, 2.9 * mayaLight);
    m.ringMat.opacity = 0.9 * mayaLight;
    m.poolMat.opacity = 0.75 * mayaLight;
    m.paint.opacity = Math.min(1, mayaLight * 1.6);
    m.paint.emissiveIntensity = baseIntensity * mayaLight;
    const c = card();
    if (c) c.material.opacity *= 1 - seg(lab.t - t0, T_EDGE - 0.05, T_EDGE + 0.2);
  };

  // Ava watches, and flinches when the cord cracks down near her
  let avaFlinch = null;
  ava.each = null;

  const stop = lab.every((dt) => {
    const t = lab.t - t0;

    // ---- Maya ----
    const P = mayaPose(t);
    mayaLight = P.light;
    if (!mayaGone) {
      maya.set({ x: P.x, y: P.y, lift: P.lift, rot: P.rot, pitch: P.pitch, roll: P.roll, sx: P.sx, sy: P.sy, sz: P.sz, visible: P.visible });
      if (!P.visible) {
        mayaGone = true;
        maya.release({ x: 7, y: 1, on: false });
      }
    }
    const anchor = harness(P);
    {
      const k = clamp01((-P.lift - 0.35) / 0.75) * P.light * (P.visible ? 1 : 0);
      floorGlow.position.set(anchor.x - 0.1, -1.585, ZM);
      floorGlow.material.opacity = 0.85 * k * k;
      floorGlow.scale.setScalar(2.2 - 1.1 * k);
    }
    if (t < T_EDGE + 0.15) {
      // over the rim the cord moves from her centre to her harness
      const centre = lab.pos(P.x, 1);
      centre.y = 0.03;
      anchor.lerp(centre, 1 - seg(t, T_EDGE - 0.02, T_EDGE + 0.15));
    }

    // ---- the slab gives a hair under her weight at the yank ----
    const yank = t > T_BOT - 0.04 ? Math.exp(-6 * (t - T_BOT + 0.04)) * Math.sin((t - T_BOT + 0.04) * 2 * PI * 3.2) : 0;
    arena.board.position.y = -0.035 * yank;

    // ---- the cord ----
    if (t < T_SNAP) {
      const c = cord(t, P, anchor);
      rope.draw(c.pts);
      // the rim corner glints where the cord bends over it
      if (c.Rp) {
        glint.position.copy(c.Rp);
        glint.material.opacity = clamp01(c.tension * 1.3) * 0.9;
        glint.scale.setScalar(0.35 + 0.35 * c.tension);
      }
      snapshot = c.pts;
    } else {
      if (!snapAt) {
        // POP: the neck goes, a bead of light bursts, and the cord is loose
        snapAt = t;
        const hang = snapshot.filter((p) => p.u != null);
        const iBreak = snapshot.findIndex((p) => p.u != null && p.u >= 0.62);
        const bp = snapshot[iBreak];
        pop.position.set(bp.x, bp.y, bp.z);
        sparks.burst(new THREE.Vector3(bp.x, bp.y, bp.z), ['#ff4d6d', '#ffffff', '#ff8fa3'], 1.4, 1.6);
        snapshot = snapshot.slice(0, iBreak + 1).map((p) => ({ ...p }));
        // arc length from the anchor, for the contraction
        let s = 0;
        snapshot.forEach((p, i) => {
          if (i) s += Math.hypot(p.x - snapshot[i - 1].x, p.y - snapshot[i - 1].y, p.z - snapshot[i - 1].z);
          p.s = s;
        });
        snapshot.L = s;
        snapshot.stub = hang.slice(-4).map((p) => ({ ...p }));
        glint.material.opacity = 0;
      }
      const ds = t - snapAt;
      // the pop
      pop.material.opacity = 1.2 * (1 - seg(ds, 0, 0.28)) ** 2;
      pop.scale.setScalar(0.25 + 0.9 * ease.out(seg(ds, 0, 0.28)));
      sparks.update(dt, 1 - seg(ds, 0.1, 0.55));
      // the stub on Maya falls with her and goes out
      if (!mayaGone && ds < 0.3) {
        const k = 1 - ds / 0.3;
        const up = new THREE.Vector3(0, 0.22 * k, 0);
        const a = anchor;
        const sp = [0, 0.5, 1].map((u) => ({ x: a.x - 0.04 * u, y: a.y + up.y * u, z: a.z, w: 0.05 * (1 - u * 0.5), r: RED.r * 3 * k, g: RED.g * 3 * k, b: RED.b * 3 * k, flat: 0 }));
        stub.draw(sp);
      } else stub.draw([]);
      // the loose cord contracts like released elastic toward where it began: the free end leads the whip
      const W_DUR = T_SLAP - T_SNAP;
      const w = ds < W_DUR ? ease.in(ds / W_DUR) : 1 + 0.16 * Math.exp(-9 * (ds - W_DUR)) * Math.sin((ds - W_DUR) * 2 * PI * 4.5 + PI);
      const fade = ds < W_DUR ? 1 : 1 - seg(ds - W_DUR, 0.05, 0.32);
      const cpts = snapshot.map((p) => {
        const f = snapshot.L ? p.s / snapshot.L : 0;
        const c = 1 - w;
        const x = AX + (p.x - AX) * c;
        const y0 = 0.008 + (p.y - 0.008) * Math.max(0, c);
        const arc = 0.55 * f ** 1.5 * Math.sin(PI * Math.min(1, w));
        const wave = 0.16 * Math.sin(2 * PI * (2.2 * f - 2.4 * w)) * Math.sin(PI * f) * Math.min(1, w * 3) * (1 - Math.min(1, w));
        const off = Math.max(0, Math.min(1, (y0 + arc - 0.008) * 8));
        const k = (1.8 + 1.2 * (1 - Math.min(1, w))) * fade;
        return { x, y: y0 + arc, z: ZM + wave, w: Math.min(0.22, p.w * (1 + 1.4 * Math.min(1, w))), r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 - off };
      });
      rope.draw(fade > 0 ? cpts : []);
      if (!slapped && ds >= W_DUR) {
        slapped = true;
        lab.ring(lab.pos(4, 1), '#ff4d6d', 0.55, 0.02, 0.45);
        lab.shake(0.025, 0.2);
        slapGlow.position.copy(lab.pos(4, 1)).setY(0.05);
        avaFlinch = t;
      }
      if (slapped) {
        const k = seg(t - avaFlinch, 0, 0.3);
        slapGlow.material.opacity = 1.1 * (1 - k) ** 2;
        slapGlow.scale.setScalar(0.5 + 0.6 * ease.out(k));
      }
    }

    // ---- Ava: watches Maya go, flinches at the crack, faces front again ----
    const look = -0.5 * ease.inOut(seg(t, 0.85, 1.35));
    if (avaFlinch == null) {
      ava.set({ x: 2, y: 3, rot: facing(0) + look, lift: 0, sy: 1, sx: 1 });
    } else {
      const k = seg(t - avaFlinch, 0, 0.3);
      const hop = Math.sin(Math.min(1, k * 1.7) * PI) * 0.1;
      ava.set({
        x: 2,
        y: 3,
        lift: hop,
        rot: facing(0) - 0.5 * (1 - ease.outBack(k)),
        sy: 1 + 0.12 * Math.sin(Math.min(1, k * 1.7) * PI) - 0.14 * bump(k, 0.68, 0.1),
        sx: 1 + 0.08 * bump(k, 0.68, 0.1),
        roll: 0.07 * Math.sin(k * 26) * (1 - k),
      });
    }
    if (t > T_SLAP - 0.06) releaseCam();
  });

  await lab.wait(T_END);
  stop();
  rope.draw([]);
  stub.draw([]);
  arena.board.position.y = 0;
  ava.release({ x: 2, y: 3, d: 0 });
  if (!mayaGone) maya.release({ x: 7, y: 1, on: false });
}
