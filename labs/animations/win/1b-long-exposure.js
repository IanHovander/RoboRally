// Win, idea 1 (Long exposure), animator b: character acting.
// The flash of the finish is a camera flash: every robot blinks, and the whole game's trails come back as one
// photograph. Then each robot reacts to its own line: Maya is smug about her clean one, Theo is mortified by his
// loop-the-loops (he blushes and turns away), Jun shudders at the spot where his line falls off the edge. The
// picture fades oldest first and the last ember of Maya's winning move runs home into her.
export const meta = {
  title: 'Long exposure: the photo finish',
  idea: 'Touching the last flag is a camera flash: everyone blinks, and every trail of the game relights at once as one long-exposure photograph. Each robot reacts to its own line: Maya puffs up over her clean red route, Theo double-takes at his loop-the-loops and blushes, Jun shudders at the spot where his line drops off the edge. It fades oldest first; the last ember of Maya\'s winning move runs home into her.',
  notes: 'Sound: a soft glass shutter "tchk" at the touch, a rising shimmer as the trails race in (0.5 s), then near silence so the room can laugh; a low embarrassed "bwoo" glass tone under Theo\'s blush, a quick glass rattle for Jun\'s shudder, and a single plink when the last ember reaches Maya. Port: keep a log of every robot\'s positions with the register they happened in (h = game time 0..1); the prototype invents a history. Theo\'s loops are drawn with a small outward offset per pass so repeated laps read as a coil. The reactions key off the log: whoever has the longest path gets the blush, whoever fell gets the shudder.',
};

const TAU = Math.PI * 2;

// ---------- small helpers (keyframes, wobbles) ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** keys: [[t, value, ease?], ...] (the ease shapes the segment that ends at that key) */
function kf(keys, ease) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * (e ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
}
const wob = (t, t0, amp, hz, decay) => (t < t0 ? 0 : amp * Math.sin((t - t0) * hz * TAU) * Math.exp(-(t - t0) * decay));
/** the rotation that looks from (x0,y0) toward (x1,y1), as close as possible to `near` */
function lookRot(near, x0, y0, x1, y1) {
  const r = Math.atan2(-(x1 - x0), -(y1 - y0));
  return near + ((((r - near + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** A robot as an actor: lean, roll, squash and the eye are on its body, so its ring stays flat on the glass. */
function actor(lab, key) {
  const { THREE } = lab;
  const p = lab.puppet(key);
  const b = p.bot;
  const m = p.model;
  const eyes = [];
  m.group.traverse((o) => {
    if (o.isMesh && o.material === m.eyeMat) eyes.push({ o, s: o.scale.clone(), kind: o.geometry.type, rz: Math.abs(o.rotation.z) > 1 });
  });
  const base = new THREE.Color(b.color);
  const A = { p, b, m, x: b.x, y: b.y, rot: b.rot, lift: 0, lean: 0, roll: 0, sy: 1, sw: 1, eye: 1, open: 1, blush: 0, blushColor: new THREE.Color('#ff6fa0'), glow: 0, ring: 1 };
  p.each = (model) => {
    model.body.rotation.set(-A.lean, 0, -A.roll);
    model.body.scale.set(A.sw, A.sy, A.sw);
    const o = Math.max(0.02, A.open);
    for (const e of eyes) {
      if (e.kind === 'CapsuleGeometry' && e.rz) e.o.scale.set(e.s.x * o, e.s.y * (0.7 + 0.3 * Math.min(1.4, A.open)), e.s.z * o);
      else if (e.kind === 'CylinderGeometry') e.o.scale.set(e.s.x * o, e.s.y, e.s.z * o);
      else if (e.kind === 'SphereGeometry') e.o.scale.setScalar(e.s.x * (0.3 + 0.7 * o));
      else e.o.scale.set(e.s.x, e.s.y * o, e.s.z);
    }
    const k = A.eye * (A.open < 0.15 ? A.open / 0.15 : 1);
    model.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
    model.paint.emissive.copy(base).lerp(A.blushColor, A.blush);
    model.paint.emissiveIntensity = 0.16 + A.blush * 0.85 + A.glow;
    model.ringMat.opacity = 0.9 * A.ring;
  };
  A.apply = () => p.set({ x: A.x, y: A.y, rot: A.rot, lift: A.lift });
  A.done = (d) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.set(0, 0, 0);
    for (const e of eyes) e.o.scale.copy(e.s);
    m.paint.emissive.copy(base);
    m.paint.emissiveIntensity = 0.16;
    p.release({ x: Math.round(A.x), y: Math.round(A.y), d });
  };
  return A;
}

// ---------- the photograph ----------
function crossTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.32, '#3a3a3a');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.68, '#3a3a3a');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Waypoints [[x, y, h], ...] in spaces → a dense, softly rounded line [{x, z, h}] in world units. */
function densify(lab, way, round = 0.22) {
  const raw = [];
  for (let i = 0; i < way.length - 1; i++) {
    const [x0, y0, h0] = way[i];
    const [x1, y1, h1] = way[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.025));
    for (let j = 0; j < n; j++) {
      const k = j / n;
      raw.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, h: h0 + (h1 - h0) * k });
    }
  }
  const l = way[way.length - 1];
  raw.push({ x: l[0], y: l[1], h: l[2] });
  // round the corners: a moving average along the line (twice, so it's soft), ends kept in place
  let pts = raw;
  const W = Math.round(round / 0.025);
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, i) => {
      const w = Math.min(W, i, pts.length - 1 - i);
      let sx = 0;
      let sy = 0;
      for (let j = i - w; j <= i + w; j++) {
        sx += pts[j].x;
        sy += pts[j].y;
      }
      return { x: sx / (2 * w + 1), y: sy / (2 * w + 1), h: p.h };
    });
  }
  return pts.map((p) => {
    const v = lab.pos(p.x, p.y);
    return { x: v.x, z: v.z, h: p.h };
  });
}

/** One line of the photograph: a ribbon of light on the glass whose vertex colours we drive every frame. */
function ribbon(lab, pts, color, halfW, tex) {
  const { THREE } = lab;
  const n = pts.length;
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)];
    const c = pts[Math.min(n - 1, i + 2)];
    let dx = c.x - a.x;
    let dz = c.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const p = pts[i];
    pos.set([p.x - dz * halfW, 0.011, p.z + dx * halfW, p.x + dz * halfW, 0.011, p.z - dx * halfW], i * 6);
    uv.set([0.5, 0, 0.5, 1], i * 4);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  lab.add(mesh);
  const c0 = new THREE.Color(color);
  return {
    pts,
    h0: pts[0].h,
    h1: pts[n - 1].h,
    /** prog: how much of the game is drawn (0..1); fade: how much has gone out, oldest first; gain: brightness */
    update(prog, fade, gain, head) {
      for (let i = 0; i < n; i++) {
        const h = pts[i].h;
        const drawn = h <= prog ? 1 : 0;
        const comet = head * Math.exp(-(((prog - h) / 0.03) ** 2)) * 2.2;
        const k = drawn * (gain + comet) * smooth(fade - 0.02, fade + 0.09, h) * Math.min(1, i / 4, (n - 1 - i) / 4 + 0.35);
        col.set([c0.r * k, c0.g * k, c0.b * k, c0.r * k, c0.g * k, c0.b * k], i * 6);
      }
      geo.attributes.color.needsUpdate = true;
    },
    at(h) {
      let best = pts[0];
      for (const p of pts) if (p.h <= h) best = p;
      return best;
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const RED = maya.b.color;
  const BLUE = theo.b.color;
  const YEL = jun.b.color;
  const crossTex = crossTexture(THREE);
  const gTex = glowTex(THREE);

  // ----- an invented history of the game (the port reads it from a log). h = game time, 0 = the start, 1 = now -----
  // Maya: clean, efficient: along the bottom through flag 1, up, and this last Move 2 onto flag 2.
  const mayaPast = [[0, 3, 0.0], [1, 3, 0.16], [2, 3, 0.3], [2, 2, 0.5], [2, 1, 0.78]];
  const mayaNow = [[2, 1, 0.9], [3, 1, 0.95], [4, 1, 1.0]];
  // Theo: down the right side, then round and round the same block (each lap a hair further out), a bump into the
  // edge, and back to where he stands, still heading for flag 1.
  const theoWay = [[6, 0, 0], [6, 1], [6, 2], [5, 2]];
  for (let lap = 0; lap < 3; lap++) {
    const o = 0.07 * lap;
    theoWay.push([4 - o, 2 - o], [4 - o, 3 + o], [5 + o, 3 + o], [5 + o, 2 - o]);
  }
  theoWay.push([5.18, 3.06], [6.38, 3.06], [6.38, 2.92], [5, 2.92]);
  const nT = theoWay.length - 1;
  theoWay.forEach((w, i) => (w[2] = 0.02 + (0.86 * i) / nT));
  // Jun: wanders down the left side, wiggles, drives straight off the west edge (the line stops dead), and picks
  // up again at a reboot point.
  const junA = [[0, 0, 0.0], [0, 1, 0.1], [1, 1, 0.2], [1, 2, 0.3], [0.05, 2, 0.42], [-0.46, 2, 0.47]];
  const junB = [[3.0, -0.04, 0.6], [2, -0.04, 0.72], [1, -0.04, 0.84]];

  const lines = [
    { who: 'a', r: ribbon(lab, densify(lab, mayaPast), RED, 0.15, crossTex) },
    { who: 'a', r: ribbon(lab, densify(lab, mayaNow, 0.05), RED, 0.15, crossTex) },
    { who: 'b', r: ribbon(lab, densify(lab, theoWay, 0.24), BLUE, 0.13, crossTex) },
    { who: 'c', r: ribbon(lab, densify(lab, junA, 0.2), YEL, 0.13, crossTex) },
    { who: 'c', r: ribbon(lab, densify(lab, junB), YEL, 0.13, crossTex) },
  ];
  // the racing heads of light
  const heads = lines.map((L) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(L.who === 'a' ? RED : L.who === 'b' ? BLUE : YEL).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(0.5);
    s.visible = false;
    lab.add(s);
    return s;
  });
  // small marks that make the photo a story: where Jun fell, where he rebooted, where Theo bumped the edge
  const flatMat = (color, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const marks = [];
  const mark = (geo, mat, x, y, h, rotZ = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotZ;
    m.position.copy(lab.pos(x, y)).setY(0.012);
    lab.add(m);
    marks.push({ m, h });
    return m;
  };
  mark(new THREE.RingGeometry(0.27, 0.31, 48), flatMat(lab.PALETTE.reboot, 1.8), 3, -0.04, 0.6); // reboot
  mark(new THREE.PlaneGeometry(0.05, 0.42), flatMat(YEL, 2.4), -0.47, 2, 0.47); // the line stops dead at the edge
  mark(new THREE.PlaneGeometry(0.05, 0.34), flatMat(BLUE, 2.4), 6.45, 3.0, 0.78); // Theo's bump into the edge

  // ----- the clock of this moment -----
  const T0 = lab.t;
  const T = () => lab.t - T0;
  const TOUCH = 0.8; // Maya's nose reaches flag 2
  const RACE = 0.5; // the whole game redraws in half a second
  const FADE0 = 3.35;
  const FADE1 = 5.05;

  // Maya: a breath of anticipation, the drive, a little brake onto the flag
  const mX = kf([[0, 2], [0.14, 1.95, ease.out], [0.78, 4, ease.inOut]], ease);
  const mLean = kf([[0, 0], [0.14, -0.13], [0.36, 0.2, ease.out], [0.7, 0.06], [0.8, -0.12, ease.out], [1.0, 0.03], [1.3, 0]], ease);
  const mSy = kf([[0, 1], [0.14, 0.9], [0.3, 1.05], [0.66, 1], [0.82, 0.92, ease.out], [1.0, 1.03], [1.2, 1]], ease);
  // pride: a glance back over her shoulder at the clean red line, then chest out, nose up
  const mRot = kf([[1.3, facing(1)], [1.55, facing(1) - 1.05, ease.out], [1.85, facing(1) - 1.05], [2.1, facing(1), ease.inOut]], ease);
  const mPride = kf([[1.9, 0], [2.15, 1, ease.outBack], [2.75, 1], [3.1, 0.25], [4.7, 0.25], [5.0, 0]], ease);
  // the end: she watches the last of her move go out behind her and takes the ember in
  const mBack = kf([[4.45, 0], [4.7, 1, ease.out], [5.0, 1], [5.18, 0, ease.inOut]], ease);
  const mSettle = (t) => wob(t, 5.12, 0.07, 3.2, 6);

  // Theo: the double take, then mortified
  const loopRot = lookRot(facing(3), 5, 3, 4.5, 2.5);
  const tRot = kf([[1.95, facing(3)], [2.12, loopRot, ease.out], [2.3, loopRot], [2.4, facing(3), ease.inOut], [2.48, facing(3)], [2.56, loopRot, ease.out], [2.85, loopRot], [3.15, facing(3) + 0.75, ease.inOut], [3.95, facing(3) + 0.75], [4.35, facing(3), ease.inOut]], ease);
  const tLean = kf([[1.95, 0], [2.12, 0.28], [2.3, 0.28], [2.4, -0.05], [2.48, -0.05], [2.56, 0.42, ease.out], [2.85, 0.4], [3.15, -0.08], [3.95, -0.08], [4.3, 0]], ease);
  const tOpen = kf([[2.48, 1], [2.56, 1.45, ease.out], [2.8, 1.4], [3.0, 0.55], [3.95, 0.55], [4.25, 1]], ease);
  const tShame = kf([[2.85, 0], [3.15, 1, ease.out], [3.9, 1], [4.3, 0, ease.inOut]], ease);
  const tShuffle = (t) => (t > 3.15 && t < 3.9 ? Math.sin((t - 3.15) * 7.5 * TAU) * 0.035 * Math.sin(((t - 3.15) / 0.75) * Math.PI) : 0);

  // Jun: follows his line to the spot where it falls off the edge, and shudders
  const edgeRot = lookRot(facing(2), 1, 0, -0.45, 2);
  const jRot = kf([[2.7, facing(2)], [2.95, edgeRot, ease.out], [3.6, edgeRot], [3.85, facing(2), ease.inOut]], ease);
  const jLean = kf([[2.7, 0], [2.95, 0.3, ease.out], [3.12, 0.33], [3.22, -0.12, ease.out], [3.6, -0.1], [3.85, 0]], ease);
  const jShudder = (t) => (t > 3.18 && t < 3.62 ? Math.sin((t - 3.18) * 15 * TAU) * 0.11 * (1 - (t - 3.18) / 0.44) : 0);
  const jOpen = kf([[3.1, 1], [3.2, 1.5, ease.out], [3.55, 1.35], [3.8, 1]], ease);
  const jShrug = kf([[3.78, 0], [3.9, 1, ease.out], [4.08, 0, ease.inOut]], ease);

  // everyone blinks at the flash, like people in a photo
  const blink = (t, delay) => {
    const s = t - TOUCH - delay;
    if (s < 0 || s > 0.26) return 1;
    return s < 0.05 ? 1 - s / 0.05 : s < 0.13 ? 0 : (s - 0.13) / 0.13;
  };

  lab.playCard('a', ['m2']);
  const col = arena.columns.find((c) => c.n === 2);
  let flashed = false;
  const dimFrom = arena.dim;
  lab.cleanup(() => arena.setDim(dimFrom));

  const stop = lab.every(() => {
    const t = T();
    // ----- Maya -----
    maya.x = mX(t);
    maya.lean = mLean(t) - 0.12 * mPride(t) + 0.16 * mBack(t);
    maya.sy = mSy(t) * (1 + 0.1 * mPride(t)) * (1 + mSettle(t));
    maya.sw = 1 / Math.sqrt(maya.sy);
    maya.rot = mRot(t) - 0.5 * mBack(t);
    maya.open = blink(t, 0);
    maya.eye = 1 + 0.5 * mPride(t) + 1.2 * smooth(5.0, 5.08, t) * (1 - smooth(5.1, 5.45, t));
    maya.p.set({ trail: t < 1.0 });
    // ----- Theo -----
    const sh = tShame(t);
    theo.rot = tRot(t) + tShuffle(t);
    theo.lean = tLean(t) + 0.06 * sh;
    theo.sy = 1 - 0.2 * sh + wob(t, TOUCH + 0.04, 0.06, 4, 7) + wob(t, 4.28, 0.05, 3, 6);
    theo.sw = 1 + 0.12 * sh;
    theo.open = Math.min(tOpen(t), blink(t, 0.03));
    theo.eye = 1 - 0.55 * sh;
    theo.blush = 0.95 * sh;
    // ----- Jun -----
    jun.rot = jRot(t);
    jun.lean = jLean(t);
    jun.roll = jShudder(t);
    jun.sy = 1 + 0.1 * jShrug(t) + wob(t, TOUCH + 0.06, 0.06, 4, 7);
    jun.lift = 0.04 * jShrug(t);
    jun.open = Math.min(jOpen(t), blink(t, 0.06));
    for (const A of [maya, theo, jun]) A.apply();

    // ----- the photograph -----
    if (t >= TOUCH && !flashed) {
      flashed = true;
      col.flash = arena.time;
      col.flashColor = new THREE.Color(RED);
      arena.clearCards();
      arena.setDim(0.32);
    }
    if (t > FADE0 + 0.4) arena.setDim(dimFrom);
    const race = clamp01((t - TOUCH) / RACE);
    const prog = t < TOUCH ? -1 : ease.out(race) * 1.0001;
    const racing = race < 1 ? 1 : Math.max(0, 1 - (t - TOUCH - RACE) / 0.25);
    const fk = clamp01((t - FADE0) / (FADE1 - FADE0));
    const fade = t < FADE0 ? -1 : -0.1 + 1.2 * (fk < 0.75 ? ease.inOut(fk / 0.75) * 0.82 : 0.82 + 0.18 * ease.out((fk - 0.75) / 0.25));
    // a breath after the race, each robot's own line brightens while it reacts to it
    const theoSpot = smooth(1.95, 2.15, t) * (1 - smooth(2.9, 3.3, t));
    const junSpot = smooth(2.75, 2.95, t) * (1 - smooth(3.5, 3.85, t));
    const mayaSpot = smooth(1.35, 1.55, t) * (1 - smooth(1.9, 2.2, t));
    const settle = 0.85 + 0.15 * (1 - clamp01((t - TOUCH - RACE) / 0.4)); // the photo settles from its flash
    lines.forEach((L, i) => {
      const spot = L.who === 'a' ? mayaSpot : L.who === 'b' ? theoSpot : junSpot;
      const gain = (L.who === 'a' ? 1.25 : 1.0) * settle * (1 + 0.7 * spot) * (t < TOUCH + RACE + 0.25 ? 1.25 : 1);
      L.r.update(prog, fade, gain, racing);
      const s = heads[i];
      const live = prog >= L.r.h0 && prog <= L.r.h1 + 0.02 && racing > 0;
      s.visible = live;
      if (live) {
        const p = L.r.at(prog);
        s.position.set(p.x, 0.06, p.z);
        s.material.opacity = racing;
      }
    });
    for (const k of marks) k.m.material.opacity = (prog >= k.h ? 1 : 0) * smooth(fade - 0.02, fade + 0.09, k.h) * (0.8 + 0.2 * Math.sin(t * 9));
  });

  await lab.wait(5.5);
  stop();
  arena.setDim(dimFrom);
  maya.done(1);
  theo.done(3);
  jun.done(2);
}
