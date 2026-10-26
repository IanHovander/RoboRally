// The detour, acted: Maya lands on flag 1, spots flag 2, and simply cannot wait. A wind-up, and she bolts straight
// for it on a diagonal no card allows. Her own trail goes taut behind her; she strains against it, legs-spinning,
// and it twangs her back onto flag 1 backwards. She spins round to face east, lands a little too hard, and stands
// there sheepish while her red ring drops down the column around her. Theo, who watched the whole thing, shakes
// his head.
export const meta = {
  title: 'On a leash',
  idea:
    "Maya lands on flag 1, spots flag 2 and bolts for it on a diagonal no card allows. A space and a half out her own trail goes taut like an elastic band: she strains against it, it hums, and it twangs her back onto flag 1 backwards. She spins round to face east, sheepish, as her red ring drops down the column around her; Theo shakes his head.",
  notes:
    'Sound: a bright "ooh" chime when she spots flag 2, a scrabble on the wind-up, a whoosh, a rising glass hum as the trail stretches, a soft two-note glass "nope", a rubber-band TWANG and a little spin whirr, then a small sheepish clink as the ring lands. ' +
    'Generic: she always bolts toward her own next flag (from the course), so the direction changes and the gag keeps teaching the race; the leash is her real trail (its points are pulled straight and shaken), with a thin bright core added while it is taut. ' +
    'Bystanders follow her with their eyes and shake their heads after. ~2.6 s including the Move 2.',
};

const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** A keyframed channel: keys [[t, value, ease?]], the ease shapes the segment that ends at that key. */
function track(ease, keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = 'inOut'] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return v0 + (v1 - v0) * ease[e](t1 > t0 ? (t - t0) / (t1 - t0) : 1);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Take a robot over with acting channels: body squash (sq), body lean/tip (only the body, the ring stays put), eye. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const eyes = [];
  p.model.body.traverse((o) => o.isMesh && o.material === p.model.eyeMat && eyes.push(o));
  const eyeScale = eyes.map((e) => e.scale.clone());
  const a = { p, sq: 1, wide: 1, eye: 1, squint: 1, lean: 0, tip: 0 };
  p.each = (m) => {
    const w = a.wide / Math.sqrt(Math.max(0.3, a.sq));
    m.body.scale.set(w, a.sq, w);
    m.body.rotation.x = -a.lean;
    m.body.rotation.z = -a.tip;
    m.eyeMat.color.setRGB(3.2 * a.eye, 3.1 * a.eye, 2.9 * a.eye);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]).setX(eyeScale[i].x * a.squint));
  };
  a.reset = () => {
    p.model.body.scale.set(1, 1, 1);
    p.model.body.rotation.set(0, 0, 0);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]));
  };
  return a;
}

/** The rotation.y that faces from space (x0, y0) toward (x1, y1), unwrapped to be near `near`. */
const aim = (x0, y0, x1, y1, near) => near + wrap(Math.atan2(-(x1 - x0), -(y1 - y0)) - near);

/** A flat ribbon on the glass along a list of points (world x, z), rebuilt each frame. */
function ribbon(THREE, n, mat) {
  const pos = new Float32Array(n * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.update = (pts, w, y = 0.02) => {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[Math.min(n - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const ww = w * (0.6 + 0.4 * Math.sin((i / (n - 1)) * Math.PI));
      pos.set([p.x - dz * ww, y, p.z + dx * ww, p.x + dz * ww, y, p.z - dx * ww], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return mesh;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const T = (keys) => track(ease, keys);
  const sc = lab.scenario;
  const flag = { x: 4, y: 1 };
  const next = sc.checkpoints?.[1] ?? [1, 3]; // flag 2: where she wants to go
  const color = lab.bot('a').color;
  const col = lab.arena.columns.find((c) => c.n === 1);
  const below = col ? col.taken.children.length : 0;
  const ringY = 0.06 + below * 0.07;

  const maya = actor(lab, 'a');
  const east = maya.p.pose.rot;
  const toward = aim(flag.x, flag.y, next[0], next[1], east); // her rotation aimed at flag 2
  const ux = next[0] - flag.x;
  const uy = next[1] - flag.y;
  const ul = Math.hypot(ux, uy) || 1;
  const dir = { x: ux / ul, y: uy / ul };
  const REACH = 1.5; // how far the leash lets her get (spaces)

  const lookers = Object.keys(sc.bots)
    .filter((k) => k !== 'a' && sc.bots[k].on !== false)
    .map((k, i) => {
      const a = actor(lab, k);
      const r = sc.bots[k];
      a.home = { x: r.x, y: r.y, rot: a.p.pose.rot };
      a.lag = 0.06 + i * 0.04;
      return a;
    });

  // the taut core of the leash, laid over her real trail while it is stretched
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.45).multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const NP = 24;
  const core = ribbon(THREE, NP, coreMat);
  lab.add(core);

  // her ring, tossed down the column like a quoit
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) });
  const quoit = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.014, 8, 64), ringMat);
  quoit.rotation.x = Math.PI / 2;
  quoit.visible = false;
  lab.add(quoit);

  // timeline (seconds from the start of the moment)
  const ARRIVE = 0.6;
  const SPOT = 0.7; // she sees flag 2
  const WIND = 0.86; // the wind-up
  const GO = 1.0; // she bolts
  const TAUT = 1.2; // the leash takes her weight
  const LOOK = 1.33; // she looks back over her shoulder at the leash
  const TWANG = 1.46; // and it lets go
  const HOME = 1.64; // she is back on the flag (backwards)
  const FACE = 1.84; // spun round to face east
  const RING0 = 1.78;
  const RING1 = 2.12;
  const END = 2.68;

  // distance out along the diagonal
  const out = T([[WIND, 0], [GO - 0.02, -0.1, 'out'], [GO + 0.14, REACH * 0.9, 'out'], [TAUT, REACH, 'out'], [TWANG - 0.02, REACH + 0.06, 'inOut'], [HOME, -0.16, 'in'], [HOME + 0.1, 0.04, 'out'], [FACE, 0, 'inOut']]);
  const M = {
    x: T([[0, 2], [ARRIVE, 4, 'inOut']]),
    // the glance: east... flag 2! ...east... FLAG 2. then the spin home after the twang
    rot: T([[SPOT, east], [SPOT + 0.06, toward + 0.1, 'out'], [SPOT + 0.1, toward], [WIND - 0.04, toward], [WIND + 0.04, toward - 0.05, 'out'], [LOOK, toward], [LOOK + 0.06, toward + 1.25, 'out'], [TWANG - 0.02, toward + 1.2], [TWANG + 0.08, toward, 'inOut'], [HOME, toward], [FACE - 0.04, east + 0.3, 'out'], [FACE + 0.1, east - 0.08, 'inOut'], [FACE + 0.22, east, 'inOut']]),
    lean: T([[0.54, 0.14], [ARRIVE + 0.06, -0.04, 'out'], [SPOT, 0], [SPOT + 0.06, -0.12, 'out'], [WIND, -0.06], [GO - 0.02, -0.28, 'out'], [GO + 0.05, 0.36, 'out'], [TAUT, 0.42], [TWANG, 0.5, 'inOut'], [TWANG + 0.06, -0.38, 'out'], [HOME, -0.3], [FACE, 0.06, 'out'], [FACE + 0.14, 0.18, 'inOut'], [RING1, 0.22], [RING1 + 0.1, -0.08, 'out'], [END, 0, 'inOut']]),
    sq: T([[ARRIVE, 1], [ARRIVE + 0.05, 0.92, 'out'], [SPOT, 1], [SPOT + 0.06, 1.14, 'out'], [WIND, 1.06], [GO - 0.02, 0.78, 'out'], [GO + 0.06, 1.12, 'out'], [TAUT, 0.96], [TWANG, 0.9], [TWANG + 0.05, 1.16, 'out'], [HOME, 1.0], [FACE + 0.02, 0.72, 'out'], [FACE + 0.14, 0.94, 'out'], [RING1, 0.9], [RING1 + 0.06, 1.1, 'out'], [END, 1, 'inOut']]),
    eye: T([[SPOT, 1], [SPOT + 0.05, 2.4, 'out'], [WIND, 1.8], [GO, 2.2], [TAUT, 1.8], [TAUT + 0.05, 2.4, 'out'], [TWANG, 2.4], [TWANG + 0.04, 2.6, 'out'], [HOME, 2.0], [FACE + 0.04, 0.3, 'out'], [FACE + 0.12, 0.3], [FACE + 0.2, 0.7, 'out'], [RING1, 0.7], [RING1 + 0.06, 1.6, 'out'], [END, 1, 'inOut']]),
    squint: T([[WIND, 1], [WIND + 0.05, 0.45, 'out'], [TAUT, 0.45], [TAUT + 0.04, 1.3, 'out'], [HOME, 1.3], [FACE, 0.55, 'out'], [RING1, 0.55], [RING1 + 0.08, 1, 'out']]),
  };

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  let k0 = -1; // where her detour starts in her trail
  let rung = false;
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const bot = maya.p.bot;

    // ---- Maya ----
    const d = t < WIND ? 0 : out(t);
    let px = M.x(t) + dir.x * d;
    let py = flag.y + dir.y * d;
    // straining at the end of the leash: scrabbling in place, creeping, shaking
    const strain = t > TAUT && t < TWANG ? Math.sin(((t - TAUT) / (TWANG - TAUT)) * Math.PI) : 0;
    const tremble = strain * Math.sin(t * TAU * 18) * 0.025;
    px += -dir.y * tremble;
    py += dir.x * tremble;
    if (t >= GO - 0.03 && k0 < 0) k0 = bot.trail.length;
    const leashOn = t >= TAUT - 0.02 && t < HOME + 0.04;
    maya.p.set({ x: px, y: py, rot: M.rot(t), trail: t < ARRIVE + 0.05 || (t >= GO - 0.03 && !leashOn && t < HOME) });
    maya.lean = M.lean(t) + strain * Math.sin(t * TAU * 11) * 0.06;
    maya.tip = tremble * 3;
    maya.sq = M.sq(t);
    maya.eye = M.eye(t) * (strain > 0.2 && Math.sin(t * TAU * 9) > 0.6 ? 0.7 : 1);
    maya.squint = M.squint(t);

    // ---- the leash: her trail from the flag to her, pulled straight, humming, then twanging ----
    const a = lab.pos(flag.x, flag.y);
    const b = lab.pos(px, py);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (leashOn && k0 >= 0 && len > 0.02) {
      // the hum while it holds her, a big wobble when it lets go
      const hum = strain * 0.035 * Math.sin(t * TAU * 21);
      const twang = t > TWANG ? Math.exp(-(t - TWANG) * 9) * 0.16 * Math.sin((t - TWANG) * TAU * 7) : 0;
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      const pts = [];
      for (let i = 0; i < NP; i++) {
        const s = i / (NP - 1);
        const off = Math.sin(s * Math.PI) * (hum + twang) + Math.sin(s * TAU) * twang * 0.4;
        pts.push({ x: a.x + (b.x - a.x) * s + nx * off, z: a.z + (b.z - a.z) * s + nz * off });
      }
      // her real trail becomes the leash: fresh light along the taut line
      bot.trail.length = k0;
      const now = lab.t;
      for (const p of pts) bot.trail.push({ x: p.x, z: p.z, t: now - 0.15 });
      core.update(pts, 0.012 + 0.012 * strain);
      const pull = clamp01((t - (TAUT - 0.02)) / 0.06);
      coreMat.opacity = pull * (t < TWANG ? 0.55 + 0.45 * strain : clamp01(1 - (t - TWANG) / 0.2));
    } else {
      coreMat.opacity = 0;
      if (t >= HOME + 0.04 && k0 >= 0 && bot.trail.length > k0) bot.trail.length = k0; // the leash is reeled in
    }

    // the flag tugs: its column flares as the leash snaps her back ("nope")
    if (col && t > LOOK && t < TWANG + 0.4) {
      const k = t < TWANG ? (t - LOOK) / (TWANG - LOOK) : 1 - (t - TWANG) / 0.4;
      col.mat.color.multiplyScalar(1 + 1.4 * clamp01(k));
    }

    // ---- the ring drops down the column around her ----
    if (t >= RING0 && t < RING1) {
      const k = (t - RING0) / (RING1 - RING0);
      quoit.visible = true;
      const y = 1.5 + (ringY - 1.5) * ease.outBounce(k);
      quoit.position.set(a.x, y, a.z);
      quoit.rotation.set(Math.PI / 2 + Math.sin(k * 9) * 0.25 * (1 - k), 0, 0);
      quoit.scale.setScalar(1.25 - 0.25 * k);
    } else quoit.visible = false;
    if (t >= RING1 && !rung) {
      rung = true;
      lab.arena.setTaken([{ color, cp: 1 }]); // in the game: the room's real taken list
      lab.ring(a.clone().setY(0.02), color, 0.45, 0.02, 0.35);
    }

    // ---- bystanders: eyes follow her out, flinch at the twang, shake their heads ----
    for (const o of lookers) {
      const tl = t - o.lag;
      const watch = clamp01((tl - GO) / 0.12) * clamp01((FACE + 0.1 - tl) / 0.15);
      const target = aim(o.home.x, o.home.y, px, py, o.home.rot);
      const tsk = tl > FACE + 0.12 && tl < END - 0.08 ? Math.sin(((tl - FACE - 0.12) / (END - 0.08 - FACE - 0.12)) * TAU * 2) * 0.28 : 0;
      o.p.set({ x: o.home.x, y: o.home.y, rot: o.home.rot + (target - o.home.rot) * 0.8 * watch + tsk, trail: false });
      o.lean = T([[GO, 0], [GO + 0.08, 0.16, 'out'], [TWANG, 0.18], [TWANG + 0.05, -0.2, 'out'], [FACE + 0.1, -0.06, 'inOut'], [END, 0, 'inOut']])(tl);
      o.eye = T([[GO, 1], [GO + 0.05, 1.8, 'out'], [TWANG, 1.8], [TWANG + 0.03, 0.3, 'out'], [TWANG + 0.1, 1.5, 'out'], [FACE + 0.1, 1.2], [FACE + 0.2, 0.9, 'inOut'], [END, 1, 'inOut']])(tl);
      o.squint = T([[FACE + 0.1, 1], [FACE + 0.2, 0.5, 'out'], [END - 0.1, 0.5], [END, 1, 'out']])(tl);
    }
  });

  await lab.wait(END);
  stop();
  maya.reset();
  maya.p.release({ x: 4, y: 1, d: 1 });
  for (const o of lookers) {
    o.reset();
    const r = sc.bots[o.p.key];
    o.p.release({ x: r.x, y: r.y, d: r.d });
  }
}
