// The Koi (animator a: weight & physical comedy)
// Once in a while, something lives in the belt's light. A long, soft shape made of the express belt's own blue
// glides in from the edge of the slab, under the glass, and the chevrons above it are shouldered aside like
// leaves on a pond: they part over its back and spring back, wobbling, once it has passed. It slows under Maya
// and rises: it dips under her weight, then lifts her, and she rides its back with a gentle bob while it swims
// the two spaces in two strokes of its tail (blue means two). At the bend its head turns south under her; she
// carries straight on by her own inertia onto the corner, and the tail flicks and swings her round to face east
// (a little too far, then back). The koi slips away down the south leg, sinking deeper and fading into the
// stream, and she's set down on the glass with a soft bump.
export const meta = {
  title: 'The Koi',
  idea:
    'Rarely, a long fish of the belt\'s own blue light glides up the stream under the glass, the chevrons parting over its back like leaves on a pond. It rises under Maya, carries her two spaces in two strokes, flicks its tail at the bend to swing her round to face east, and slips away down the south leg into the stream.',
  notes:
    'Rare by design: on every other ride the belt runs as it does today, so after its first appearance the room watches the belts for it. The chevrons are rebuilt as loose pieces for the ride (exactly where the belt texture draws them, so the hand-over is invisible) and each half of each chevron sits on a spring: the koi\'s bow wave pushes them apart and they wobble back. Physics: the koi dips under her weight before it lifts her; she leans back with each tail stroke; at the bend she carries on straight by inertia and the tail flick spins her with overshoot; she is set down with a small bump. Sound: a deep, slow underwater swell as it arrives; soft glassy "plips" as the chevrons part; two muffled swishes for the strokes; a bright water-flick for the tail; a long sinking tone as it fades.',
};

const TAU = Math.PI * 2;
const smooth = (a, b, x) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const frac = (v) => v - Math.floor(v);

// ---- the belt's look, rebuilt (scene.js beltTexture): the dark fill and rails, and one chevron cut in halves ----
function railsTexture(THREE, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(4,6,9,.3)';
  g.fillRect(10, 0, 108, 128);
  g.shadowColor = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowBlur = 6;
  g.lineWidth = 2;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.moveTo(12, 0);
  g.lineTo(12, 128);
  g.moveTo(116, 0);
  g.lineTo(116, 128);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/** Half (0 left, 1 right) of one chevron, 64x64 px, centred where the belt texture centres it. */
function chevronHalf(THREE, color, half) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(-64 * half, 0);
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(34, 32 + 15);
  g.lineTo(64, 32 - 15);
  g.lineTo(94, 32 + 15);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/** The koi seen from above, head at the top (v = 0), drawn soft: a body, two swept pectoral fins, a forked tail. */
function koiTexture(THREE, blur, alpha) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  g.filter = `blur(${blur}px)`;
  g.fillStyle = `rgba(255,255,255,${alpha})`;
  // body
  g.beginPath();
  g.moveTo(64, 16);
  g.bezierCurveTo(96, 18, 106, 88, 102, 140);
  g.bezierCurveTo(98, 232, 76, 330, 71, 384);
  g.lineTo(57, 384);
  g.bezierCurveTo(52, 330, 30, 232, 26, 140);
  g.bezierCurveTo(22, 88, 32, 18, 64, 16);
  g.fill();
  // pectoral fins, swept back
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(64 + sd * 30, 118);
    g.quadraticCurveTo(64 + sd * 64, 140, 64 + sd * 60, 196);
    g.quadraticCurveTo(64 + sd * 44, 170, 64 + sd * 30, 158);
    g.fill();
  }
  // a forked tail fan
  g.beginPath();
  g.moveTo(57, 372);
  g.quadraticCurveTo(24, 438, 14, 504);
  g.quadraticCurveTo(44, 474, 64, 452);
  g.quadraticCurveTo(84, 474, 114, 504);
  g.quadraticCurveTo(104, 438, 71, 372);
  g.closePath();
  g.fill();
  // a brighter spine down its back
  g.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
  g.beginPath();
  g.ellipse(64, 170, 16, 150, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}
/** The glow the koi throws through the smoked glass: one soft, gap-free shape, brightest at the shoulders. */
function koiGlow(THREE) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  g.filter = 'blur(16px)';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(64, 190, 40, 170, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(64, 420, 34, 70, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

export default async function play(lab) {
  const { ease, facing, arena, THREE, PALETTE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];
  const disposables = [];
  lab.cleanup(() => disposables.forEach((d) => d.dispose()));

  // ---------------- the chevrons, as loose pieces ----------------
  const rails = railsTexture(THREE, PALETTE.express);
  const halves = [chevronHalf(THREE, PALETTE.express, 0), chevronHalf(THREE, PALETTE.express, 1)];
  disposables.push(rails, ...halves);
  const map0 = belt.mat.map;
  rails.offset.copy(map0.offset);
  belt.mat.map = rails;
  const clip0 = lab.renderer.localClippingEnabled;
  lab.renderer.localClippingEnabled = true;
  let restored = false;
  const restoreBelt = () => {
    if (restored) return;
    restored = true;
    belt.mat.map = map0;
    pieces.visible = false;
  };
  lab.cleanup(() => {
    belt.mat.map = map0;
    lab.renderer.localClippingEnabled = clip0;
  });
  const pieces = lab.add(new THREE.Group());
  const halfGeo = new THREE.PlaneGeometry(0.5, 0.5);
  disposables.push(halfGeo);
  const runs = [
    { start: [0.5, 1], f: [1, 0], n: 2, d: 1 }, // (1,1) (2,1), flowing east
    { start: [3, 1.5], f: [0, 1], n: 2, d: 2 }, // (3,2) (3,3), flowing south
  ].map((r, ri) => {
    const fw = new THREE.Vector3(r.f[0], 0, r.f[1]);
    const a = lab.pos(r.start[0], r.start[1]);
    const b = lab.pos(r.start[0] + r.f[0] * r.n, r.start[1] + r.f[1] * r.n);
    const planes = [new THREE.Plane(fw.clone(), -fw.dot(a)), new THREE.Plane(fw.clone().negate(), fw.dot(b))];
    const mats = halves.map((t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, clippingPlanes: planes, color: 0xffffff }));
    disposables.push(...mats);
    const right = [-r.f[1], r.f[0]];
    const slots = [];
    for (let t = -1; t < r.n; t++) {
      for (const vt of [1 - 41 / 128, 1 - 105 / 128]) {
        const hs = [0, 1].map((h) => {
          const mesh = new THREE.Mesh(halfGeo, mats[h]);
          mesh.renderOrder = 1.1;
          pieces.add(mesh);
          return mesh;
        });
        slots.push({ t, vt, hs });
      }
    }
    return { ...r, ri, mats, right, slots };
  });
  const springs = new Map(); // a spring per chevron half, keyed by the chevron's identity as it flows

  // ---------------- the koi ----------------
  // its path in board spaces: in from the west along row 1, a tight bend at the corner, then south
  const path = [];
  for (let x = -4; x < 2.7; x += 0.05) path.push([x, 1]);
  for (let a = -Math.PI / 2; a < 0; a += 0.08) path.push([2.7 + 0.3 * Math.cos(a), 1.3 + 0.3 * Math.sin(a)]);
  for (let y = 1.3; y <= 8; y += 0.05) path.push([3, y]);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const along = (s) => {
    s = Math.max(0, Math.min(cum[cum.length - 1] - 1e-6, s));
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const k = (s - cum[lo]) / (cum[hi] - cum[lo]);
    const p = path[lo];
    const q = path[hi];
    const tx = q[0] - p[0];
    const ty = q[1] - p[1];
    const l = Math.hypot(tx, ty) || 1;
    return { x: p[0] + tx * k, y: p[1] + ty * k, tx: tx / l, ty: ty / l };
  };
  const sAtX = (x) => x + 4; // arc length of a point on the straight part of row 1

  const L = 2.0; // two spaces long
  const N = 44;
  const width = (v) => {
    // a rounded head, widest a third of the way back, a slim wrist, and a fanned tail
    const head = Math.sqrt(Math.min(1, v / 0.1));
    const body = v < 0.3 ? 1 : Math.max(0.16, 1 - ((v - 0.3) / 0.52) ** 1.4 * 0.84);
    const fan = smooth(0.8, 0.97, v) * (1 - smooth(0.97, 1, v)) * 0.75;
    return 0.4 * head * Math.max(body, fan) * (v > 0.995 ? 0 : 1);
  };
  const koiCore = koiTexture(THREE, 3, 0.85);
  const koiHalo = koiGlow(THREE);
  disposables.push(koiCore, koiHalo);
  const KW = 0.78; // the ribbon's width across (the texture draws the fish inside it)
  const ribbon = (scale, map, color, order) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 1) * 2 * 3);
    const col = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      uv.set([0, i / N, 1, i / N], i * 4);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    disposables.push(geo, mat);
    return { mesh: lab.add(mesh), pos, col, geo, scale };
  };
  const BLUE = new THREE.Color(PALETTE.express);
  const halo = ribbon(1.5, koiHalo, BLUE.clone().multiplyScalar(0.9), 0.5);
  const core = ribbon(1, koiCore, BLUE.clone().lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(1.5), 0.6);

  const K = { s: 3.0, on: 0, near: 0, wave: 0, flick: 0, flickT: 0, dip: 0 };
  const spine = []; // world-space samples of the koi's spine (for the chevrons)
  const drawKoi = (t) => {
    spine.length = 0;
    for (const r of [halo, core]) {
      for (let i = 0; i <= N; i++) {
        const v = i / N;
        const p = along(K.s - v * L);
        // swimming: a travelling wave down the body, growing toward the tail; plus the flick
        const sway = Math.sin(v * 7 - t * 9) * 0.06 * v ** 1.3 * (0.4 + 0.6 * K.wave) + K.flick * smooth(0.45, 1, v) * 0.55;
        const nx = -p.ty;
        const ny = p.tx;
        const gx = p.x + nx * sway;
        const gy = p.y + ny * sway;
        const w = KW * r.scale * (1 + 0.2 * (1 - K.near)) * (1 + K.dip * 0.25 * Math.exp(-((v - 0.27) ** 2) / 0.01));
        const cw = lab.pos(gx, gy);
        const ex = nx * w * 0.5;
        const ey = ny * w * 0.5;
        const y = 0.003;
        r.pos.set([cw.x - ex, y, cw.z - ey, cw.x + ex, y, cw.z + ey], i * 6);
        // fades where the slab ends, and toward the tail
        const edge = smooth(-0.5, -0.05, gx) * smooth(3.5, 3.05, gy);
        const k = K.on * edge * (r === core ? 0.5 + 0.7 * K.near : 1 - 0.4 * K.near);
        r.col.set([k, k, k, k, k, k], i * 6);
        if (r === core && i % 2 === 0) spine.push({ p: cw, w: width(v) * K.on * edge });
      }
      r.geo.attributes.position.needsUpdate = true;
      r.geo.attributes.color.needsUpdate = true;
    }
  };

  // ---------------- the chevrons follow the belt, and part over the koi's back ----------------
  const tmp = new THREE.Vector3();
  const placePieces = (dt) => {
    const o = map0.offset.y;
    rails.offset.y = o;
    for (const r of runs) {
      for (const mat of r.mats) mat.color.copy(belt.mat.color);
      for (const sl of r.slots) {
        const ph = sl.vt - o;
        const a = sl.t + frac(ph);
        const id = `${r.ri}:${sl.vt}:${sl.t - Math.floor(ph)}`;
        const gx = r.start[0] + r.f[0] * a;
        const gy = r.start[1] + r.f[1] * a;
        const c = lab.pos(gx, gy);
        // how hard the koi's back pushes here
        let push = 0;
        for (const sp of spine) {
          const d2 = (sp.p.x - c.x) ** 2 + (sp.p.z - c.z) ** 2;
          push = Math.max(push, (sp.w / 0.4) * Math.exp(-d2 / 0.1));
        }
        let st = springs.get(id);
        if (!st) springs.set(id, (st = { p: 0, v: 0 }));
        if (dt > 0) {
          const n = 4;
          for (let i = 0; i < n; i++) {
            const h = dt / n;
            st.v += (220 * (push - st.p) - 9 * st.v) * h;
            st.p += st.v * h;
          }
        }
        sl.hs.forEach((mesh, h) => {
          const side = h ? 1 : -1;
          const lat = side * (0.25 + 0.17 * st.p);
          tmp.copy(lab.pos(gx + r.right[0] * lat, gy + r.right[1] * lat));
          mesh.position.set(tmp.x, 0.0045, tmp.z);
          mesh.rotation.set(-Math.PI / 2, 0, -r.d * (Math.PI / 2) - side * 0.28 * st.p);
          mesh.scale.setScalar(1 - 0.12 * Math.min(1, Math.abs(st.p)));
        });
      }
    }
  };

  // ---------------- Maya, riding ----------------
  const S = { x: 1, y: 1, rot: facing(0), lift: 0, lean: 0, roll: 0, sx: 1, sy: 1 };
  maya.each = (model) => {
    model.body.rotation.x = S.lean;
    model.body.rotation.z = -S.roll;
    model.body.scale.set(S.sx, S.sy, S.sx);
  };
  lab.cleanup(() => m.body.scale.set(1, 1, 1));
  const live = lab.every((dt, t) => {
    drawKoi(t);
    if (!restored) placePieces(dt);
    maya.set({ x: S.x, y: S.y, rot: S.rot, lift: S.lift });
  });

  // ---- 1. something glides in under the glass, from the edge of the slab, and slows under Maya ----
  const back = 0.55; // she rides this far behind its nose
  belt.pulse = lab.t;
  lab.tween(0.25, (e) => (K.on = e), ease.out);
  await lab.tween(0.55, (e, k) => {
    K.s = 3.0 + (sAtX(1) + back - 3.0) * e;
    K.wave = 1 - 0.6 * k;
    K.near = 0.25 * k;
  }, ease.out3);

  // ---- 2. it rises under her: dips under her weight, then lifts her ----
  await lab.tween(0.1, (e) => {
    K.near = 0.25 + 0.75 * e;
    S.lift = 0.02 * e;
    K.dip = e;
  }, ease.out);
  await lab.tween(0.14, (e, k) => {
    S.lift = 0.02 + 0.13 * e;
    S.sy = 1 - 0.08 * Math.sin(k * Math.PI);
    S.sx = 1 + 0.04 * Math.sin(k * Math.PI);
    K.dip = 1 - e;
  }, (k) => ease.outBack(k, 2.2));
  S.sx = S.sy = 1;
  const t0 = lab.t;
  const bob = lab.every((dt, t) => {
    const u = t - t0;
    S.lift = 0.15 + 0.03 * Math.sin(u * 9) * K.on;
    S.roll = 0.08 * Math.sin(u * 9 + 1.2) * K.on;
  });

  // ---- 3. two strokes of its tail: one space each ----
  for (const [x0, x1] of [[1, 2], [2, 3]]) {
    belt.pulse = lab.t;
    K.wave = 1;
    await lab.tween(0.36, (e, k) => {
      S.x = x0 + (x1 - x0) * e;
      K.s = sAtX(S.x) + back;
      S.lean = 0.16 * Math.sin(k * TAU) * (1 - k * 0.3); // back as it surges, forward as it glides
    }, ease.inOut);
    S.lean = 0;
    K.wave = 0.5;
    if (x0 === 1) await lab.wait(0.03);
  }
  S.x = 3;

  // ---- 4. the bend: its head goes south under her, the tail flicks, and she's swung round to face east ----
  bob();
  const lift0 = S.lift;
  const roll0 = S.roll;
  lab.tween(0.36, (e, k) => {
    S.rot = facing(0) + (facing(1) - facing(0)) * e;
    S.roll = roll0 * (1 - k);
  }, (k) => ease.outBack(k, 2.6));
  lab.tween(0.3, (e, k) => {
    K.flick = Math.sin(k * Math.PI) * (1 - k * 0.3) * (k < 0.5 ? 1 : 1) - Math.sin(k * TAU) * 0.25 * k;
  }, ease.linear);

  // ---- 5. it slips away down the south leg, sinking and fading into the stream; she's set down ----
  const sTurn = K.s;
  lab.tween(0.75, (e, k) => {
    K.s = sTurn + 2.4 * e;
    K.near = 1 - k;
    K.on = 1 - ease.in(k);
    K.wave = 0.5 + 0.5 * k;
  }, ease.in);
  await lab.wait(0.16);
  await lab.tween(0.24, (e) => (S.lift = lift0 * (1 - e)), ease.in);
  S.lift = 0;
  await lab.tween(0.16, (e, k) => {
    const s = Math.sin(k * Math.PI);
    S.sy = 1 - 0.1 * s;
    S.sx = 1 + 0.05 * s;
  }, ease.out);
  S.sx = S.sy = 1;
  S.rot = facing(1);
  S.roll = 0;
  await lab.wait(0.24); // the koi is gone and the chevrons have settled
  K.on = 0;
  drawKoi(lab.t);
  restoreBelt();
  live();
  maya.each = null;
  m.body.scale.set(1, 1, 1);
  maya.release({ x: 3, y: 1, d: 1 });
}
