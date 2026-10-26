// Make a wish, acted: Maya settles on flag 1 and its column sinks into a little candle flame right in front of her
// nose. She leans in, cross-eyed; closes her eye to make a wish; fills up with a big breath and PUFFS. The flame
// bends away and goes out, and for a beat the flag is a dark spot on the glass with a curl of light-smoke rising
// from it. Very pleased with herself, until she notices the flag is gone and Theo is glaring at her. Then it
// relights by itself, she jumps out of her skin, and her red ring is there at its foot.
export const meta = {
  title: 'Make a wish',
  idea:
    "Flag 1's column sinks into a small candle flame in front of Maya's nose. She leans in cross-eyed, shuts her eye to make a wish, takes a big breath and puffs it out. For a beat the flag is a dark spot with a curl of light-smoke rising; she is pleased with herself until she notices the flag is gone and Theo glaring. Then it relights warm white on its own, she jumps, and her red ring is at its foot.",
  notes:
    'Sound: a soft descending glass shimmer as the column sinks, silence for the wish (the room will say "make a wish!"), a breathy inhale, a puff, a tiny "fft" as it goes out, a beat of near-silence with a thin rising smoke-whistle, an "ahem" from the bystanders, then a whoomp-and-chime as it relights. ' +
    "Generic: the candle always sits in front of the claimer's nose (whatever way she faces). Every other robot turns to glare during the dark beat and turns back at the relight. The flag is only ever dark for half a second and comes back by itself, because the others still need it. " +
    'Ports: the column is the real one, scaled and slid; the flame is a bent billboard with a drawn teardrop; the dark spot is a soft disc of darkness on the glass. ~2.85 s including the Move 2.',
};

const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const aim = (x0, y0, x1, y1, near) => near + wrap(Math.atan2(-(x1 - x0), -(y1 - y0)) - near);

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

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const T = (keys) => track(ease, keys);
  const sc = lab.scenario;
  const arena = lab.arena;
  const flag = { x: 4, y: 1 };
  const fp = lab.pos(flag.x, flag.y);
  const col = arena.columns.find((c) => c.n === 1);
  const color = lab.bot('a').color;
  const cam = lab.camera3;

  const maya = actor(lab, 'a');
  const east = maya.p.pose.rot;
  const lookers = Object.keys(sc.bots)
    .filter((k) => k !== 'a' && sc.bots[k].on !== false)
    .map((k, i) => {
      const a = actor(lab, k);
      const r = sc.bots[k];
      a.home = { x: r.x, y: r.y, rot: a.p.pose.rot };
      a.glare = aim(r.x, r.y, flag.x, flag.y, a.home.rot);
      a.lag = i * 0.05;
      return a;
    });

  // where the candle stands: just in front of her nose
  const fwd = { x: -Math.sin(east), z: -Math.cos(east) };
  const wick = new THREE.Vector3(fp.x + fwd.x * 0.56, 0.02, fp.z + fwd.z * 0.56);

  // ---- the flame: a teardrop of warm light on a plane that can bend ----
  const flameTex = canvasTex(THREE, 64, 128, (g, w, h) => {
    for (let i = 0; i <= 48; i++) {
      const k = i / 48;
      const y = h * (0.9 - 0.82 * k);
      const r = w * 0.36 * Math.pow(1 - k, 0.7) * (0.75 + 0.25 * Math.sin(Math.min(1, k * 3) * Math.PI * 0.5));
      const grad = g.createRadialGradient(w / 2, y, 0, w / 2, y, Math.max(1, r));
      grad.addColorStop(0, `rgba(255,255,255,${0.16 * (1 - 0.5 * k)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
  });
  const flameGeo = new THREE.PlaneGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
  const base = flameGeo.attributes.position.array.slice();
  const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color('#f4efe4').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.renderOrder = 6;
  flame.position.copy(wick);
  lab.add(flame);
  const shapeFlame = (wd, ht, bend) => {
    const p = flameGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const v = base[i + 1]; // 0 at the wick, 1 at the tip
      p[i] = base[i] * wd + bend * v * v;
      p[i + 1] = v * ht;
    }
    flameGeo.attributes.position.needsUpdate = true;
  };

  // ---- the dark spot where the flag's light is missing ----
  const darkTex = canvasTex(THREE, 64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: darkTex, transparent: true, opacity: 0, depthWrite: false }));
  dark.rotation.x = -Math.PI / 2;
  dark.position.set(fp.x, 0.012, fp.z);
  dark.renderOrder = 3;
  lab.add(dark);

  // ---- light-smoke and breath: little soft dots ----
  const dotTex = canvasTex(THREE, 32, 32, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });
  const dot = (c, k) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(c).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.renderOrder = 7;
    lab.add(s);
    return s;
  };
  const smoke = Array.from({ length: 46 }, () => dot('#dfe6f2', 1.4));
  const breath = Array.from({ length: 9 }, () => dot('#f4efe4', 1.6));
  const breathSeed = breath.map(() => ({ a: lab.range(-0.5, 0.5), b: lab.range(-0.25, 0.35), s: lab.range(0.75, 1.25), d: lab.range(0, 0.05) }));

  lab.cleanup(() => {
    if (!col) return;
    col.col.position.x = fp.x;
    col.col.position.z = fp.z;
    col.col.visible = true;
    col.halo.visible = true;
  });

  // timeline (seconds from the start of the moment)
  const ARRIVE = 0.6;
  const SINK0 = 0.62;
  const SINK1 = 0.92; // the column is a candle
  const NOTICE = 0.94;
  const WISH0 = 1.12;
  const WISH1 = 1.36;
  const INHALE = 1.38;
  const PUFF = 1.6;
  const OUT = 1.78; // the flame is out
  const RELIGHT = 2.3;
  const END = 2.84;

  const M = {
    x: T([[0, 2], [ARRIVE, 4, 'inOut']]),
    // notices the candle, leans in cross-eyed; wish (eye shut); inhale (leans back, fills up); PUFF
    lean: T([[0.54, 0.14], [ARRIVE + 0.06, -0.04, 'out'], [NOTICE, 0], [NOTICE + 0.1, 0.3, 'out'], [WISH0, 0.26], [WISH1, 0.16, 'inOut'], [PUFF - 0.02, -0.34, 'inOut'], [PUFF + 0.05, 0.36, 'out'], [PUFF + 0.2, 0.2, 'inOut'], [OUT + 0.12, 0.04, 'inOut'], [RELIGHT, 0.04], [RELIGHT + 0.05, -0.32, 'out'], [RELIGHT + 0.3, 0.06, 'inOut'], [END, 0, 'inOut']]),
    sq: T([[ARRIVE, 1], [ARRIVE + 0.05, 0.92, 'out'], [NOTICE, 1], [NOTICE + 0.06, 1.08, 'out'], [WISH0, 1], [WISH1, 0.97], [PUFF - 0.02, 1.16, 'inOut'], [PUFF + 0.04, 0.84, 'out'], [PUFF + 0.2, 1.0, 'inOut'], [OUT + 0.1, 1.04], [OUT + 0.3, 1.06], [RELIGHT - 0.1, 0.94, 'inOut'], [RELIGHT, 0.94], [RELIGHT + 0.04, 1.26, 'out'], [RELIGHT + 0.16, 0.86, 'inOut'], [RELIGHT + 0.3, 1.04, 'inOut'], [END, 1, 'inOut']]),
    wide: T([[INHALE, 1], [PUFF - 0.02, 1.14, 'inOut'], [PUFF + 0.04, 1.0, 'out']]),
    lift: T([[RELIGHT, 0], [RELIGHT + 0.08, 0.14, 'out'], [RELIGHT + 0.2, 0, 'in']]),
    eye: T([[NOTICE, 1], [NOTICE + 0.05, 1.8, 'out'], [WISH0, 1.6], [WISH0 + 0.06, 0.12, 'out'], [WISH1, 0.12], [INHALE + 0.04, 1.4, 'out'], [PUFF, 1.6], [PUFF + 0.03, 2.8, 'out'], [PUFF + 0.15, 1.3, 'inOut'], [OUT + 0.15, 1.4], [OUT + 0.25, 0.7, 'inOut'], [RELIGHT, 0.7], [RELIGHT + 0.03, 2.6, 'out'], [RELIGHT + 0.25, 1.4, 'inOut'], [END, 1, 'inOut']]),
    squint: T([[NOTICE, 1], [NOTICE + 0.08, 0.6, 'out'], [WISH0, 0.6], [WISH0 + 0.06, 0.2, 'out'], [WISH1, 0.2], [INHALE + 0.04, 1.2, 'out'], [PUFF + 0.1, 0.5, 'out'], [OUT + 0.15, 0.7], [OUT + 0.24, 1.25, 'out'], [RELIGHT + 0.25, 1.25], [END, 1, 'inOut']]),
    // the dark beat: smug little nod, then "where did it go?" glances
    rot: T([[OUT + 0.18, east], [OUT + 0.26, east + 0.42, 'out'], [OUT + 0.36, east + 0.42], [OUT + 0.44, east - 0.36, 'inOut'], [RELIGHT - 0.04, east - 0.3], [RELIGHT + 0.06, east + 0.08, 'out'], [RELIGHT + 0.2, east, 'inOut']]),
    // the wish: a tiny hopeful sway
    sway: T([[WISH0 + 0.04, 0], [WISH0 + 0.1, 1], [WISH1 - 0.04, 1], [WISH1 + 0.02, 0]]),
  };
  // the column: sinks into a candle in front of her nose, gone, then back
  const sink = T([[SINK0, 0], [SINK1, 1, 'inOut3']]);
  const relight = T([[RELIGHT, 0], [RELIGHT + 0.16, 1, 'outBack']]);

  // a gentle push toward the candle, home again by the end
  const t0 = lab.t;
  const camK = T([[0.6, 0], [1.1, 1, 'inOut'], [RELIGHT, 1], [END, 0, 'inOut']]);
  const camAt = lab.pos(flag.x + 0.35, flag.y + 0.5).setY(0.3); // her and the candle, with room for the bystanders
  const camRelease = lab.camera((home) => {
    const k = camK(lab.t - t0);
    return { target: home.target.clone().lerp(camAt, 0.55 * k), dist: home.dist * (1 - 0.27 * k) };
  });
  // lights out: the whole room dips while the flag is dark, and comes back up with it
  const dimK = T([[OUT - 0.02, 0], [OUT + 0.08, 0.5, 'out'], [RELIGHT, 0.5], [RELIGHT + 0.22, 0, 'out']]);
  lab.cleanup(() => {
    arena.dim = 0;
    arena.dimCur = 0;
  });

  lab.playCard('a', ['m2']);
  let lit = false;
  let blown = false;
  const stop = lab.every(() => {
    const t = lab.t - t0;

    arena.dim = arena.dimCur = dimK(t);

    // ---- the column / candle ----
    const s = sink(t);
    const flick = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23 + 1);
    if (col) {
      if (t < OUT) {
        // shrink and slide toward her nose; it flickers as it goes
        col.col.visible = s < 0.98;
        col.col.position.set(fp.x + (wick.x - fp.x) * s, 0, fp.z + (wick.z - fp.z) * s);
        col.col.scale.set(1 - 0.73 * s, 1 - 0.852 * s, 1);
        col.mat.color.multiplyScalar(1 + (flick - 1) * s * 2);
        col.halo.visible = true;
      } else if (t < RELIGHT) {
        col.col.visible = false;
        col.halo.visible = false;
      } else {
        const r = relight(t);
        col.col.visible = true;
        col.halo.visible = true;
        col.col.position.set(fp.x, 0, fp.z);
        col.col.scale.set(1 + 0.6 * (1 - clamp01((t - RELIGHT) / 0.4)), Math.max(0.001, r), 1);
        col.mat.color.multiplyScalar(1 + 1.6 * (1 - clamp01((t - RELIGHT) / 0.35)));
      }
    }
    // the flame takes over from the shrunken column, bends away from the puff, gutters and goes out
    let fo = 0;
    let fh = 0.62;
    let fw = 0.3;
    let bend = 0;
    if (t >= SINK1 - 0.08 && t < OUT) {
      fo = clamp01((t - (SINK1 - 0.08)) / 0.08);
      const sway = Math.sin(t * 9) * 0.02 + Math.sin(t * 23) * 0.01;
      bend = sway;
      fh = 0.62 * (0.94 + 0.06 * Math.sin(t * 31));
      if (t > PUFF + 0.02) {
        const k = clamp01((t - PUFF - 0.02) / (OUT - PUFF - 0.02));
        bend = fwd.x * (0.08 + 0.4 * ease.out(Math.min(1, k * 2))) * (1 - 0.4 * k) + Math.sin(t * 60) * 0.03 * k;
        fh = 0.62 * (1 - 0.55 * k) * (0.7 + 0.3 * Math.sin(t * 70));
        fw = 0.3 * (1 - 0.3 * k);
        fo = 1 - ease.in(k) * (Math.sin(t * 90) > 0 ? 1 : 0.6);
      }
    }
    flame.visible = fo > 0.01;
    if (flame.visible) {
      shapeFlame(fw, fh, bend);
      flame.rotation.y = Math.atan2(cam.position.x - flame.position.x, cam.position.z - flame.position.z);
      flameMat.opacity = fo;
    }
    if (t >= OUT && !blown) blown = true;

    // the dark spot (the flag's light is missing), and the curl of light-smoke from the wick
    dark.material.opacity = 0.75 * clamp01((t - OUT + 0.04) / 0.08) * clamp01(1 - (t - RELIGHT) / 0.12);
    smoke.forEach((sp, i) => {
      const u = i / (smoke.length - 1); // along the curl, 0 at the wick
      const age = t - OUT - u * 0.32; // the curl draws itself upward
      const on = age > 0 ? clamp01(age / 0.06) * clamp01(1 - (t - OUT) / (RELIGHT - OUT + 0.15)) * (1 - u) ** 0.6 : 0;
      sp.material.opacity = 0.7 * on;
      if (on > 0) {
        const h = 0.3 + u * 1.0 + age * 0.12;
        const curl = Math.sin(u * 7 + t * 2.4) * 0.09 * u + Math.sin(u * 3.1) * 0.05;
        sp.position.set(wick.x + curl + fwd.x * u * 0.1, h, wick.z + Math.cos(u * 6 + t * 2) * 0.05 * u);
        sp.scale.setScalar(0.045 + 0.05 * u);
      }
    });

    // her breath: a few soft puffs of light from her front toward the flame and on past it
    const muzzle = lab.pos(M.x(t), flag.y).add(new THREE.Vector3(fwd.x * 0.36, 0.26, fwd.z * 0.36));
    breath.forEach((sp, i) => {
      const b = breathSeed[i];
      const k = (t - PUFF - b.d) / 0.34;
      if (k <= 0 || k >= 1) return (sp.material.opacity = 0);
      const dist = ease.out(k) * 0.95 * b.s;
      sp.position.set(muzzle.x + fwd.x * dist + fwd.z * b.a * dist * 0.5, muzzle.y + 0.02 + b.b * dist * 0.4, muzzle.z + fwd.z * dist + fwd.x * b.a * dist * 0.5);
      sp.scale.setScalar(0.06 + 0.16 * k);
      sp.material.opacity = 0.75 * (1 - k) ** 1.5;
    });

    if (t >= RELIGHT && !lit) {
      lit = true;
      lab.ring(fp.clone().setY(0.02), '#f4efe4', 0.6, 0.02, 0.35);
      arena.setTaken([{ color, cp: 1 }]); // in the game: the room's real taken list
    }

    // ---- Maya ----
    const sway = M.sway(t) * Math.sin((t - WISH0) * TAU * 2.2) * 0.07;
    maya.p.set({ x: M.x(t), y: flag.y, rot: M.rot(t), lift: M.lift(t) });
    maya.lean = M.lean(t);
    maya.tip = sway;
    maya.sq = M.sq(t);
    maya.wide = M.wide(t);
    maya.eye = M.eye(t);
    maya.squint = M.squint(t);

    // ---- bystanders: turn and glare in the dark ("we need that!"), snap back at the relight ----
    for (const a of lookers) {
      const tl = t - a.lag;
      const g = T([[OUT + 0.05, 0], [OUT + 0.14, 1, 'out'], [RELIGHT, 1], [RELIGHT + 0.08, -0.12, 'out'], [RELIGHT + 0.26, 0, 'inOut']])(tl);
      const huff = tl > OUT + 0.2 && tl < RELIGHT ? Math.max(0, Math.sin(((tl - OUT - 0.2) / 0.26) * TAU)) : 0;
      a.p.set({ x: a.home.x, y: a.home.y, rot: a.home.rot + (a.glare - a.home.rot) * g, lift: huff * 0.05, trail: false });
      a.lean = 0.22 * clamp01(g) - 0.18 * (tl > RELIGHT && tl < RELIGHT + 0.3 ? Math.sin(((tl - RELIGHT) / 0.3) * Math.PI) : 0);
      a.sq = 1 + 0.12 * clamp01(g) + 0.08 * huff;
      a.eye = 1 + 0.9 * clamp01(g);
      a.squint = 1 - 0.45 * clamp01(g);
    }
  });

  await lab.wait(END);
  stop();
  camRelease();
  arena.dim = arena.dimCur = 0;
  if (col) {
    col.col.position.set(fp.x, 0, fp.z);
    col.col.visible = true;
    col.halo.visible = true;
  }
  maya.reset();
  maya.p.release({ x: 4, y: 1, d: 1 });
  for (const a of lookers) {
    a.reset();
    const r = sc.bots[a.p.key];
    a.p.release({ x: r.x, y: r.y, d: r.d });
  }
}
