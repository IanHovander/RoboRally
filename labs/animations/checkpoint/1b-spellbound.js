// Euler's disk, acted: Maya hears something coming down the column, looks up, and ducks as a hoop of her own red
// light lands on its edge around her. It spins down like a coin settling and she can't take her eye off it: her whole
// body circles with the wobble, faster and faster, until the glassy click. One stunned blink, then the hoop cinches
// tight round her foot, squeezing her tall, and she pops back down proud, wearing her ring.
export const meta = {
  title: 'Spellbound',
  idea:
    "A hoop of Maya's red light drops down flag 1's column and lands on its edge around her, spinning down like Euler's disk. She is hypnotised: her head swings to follow the glint round and her body circles with the wobble, lower and faster, until a glassy click lays it flat. A stunned blink, then the hoop cinches to the size of her taken ring, squeezing her tall like a ring on a finger, and she pops back down proud. Bystanders sway along in sympathy.",
  notes:
    'Sound: a glassy "tink" as the hoop lands, then the whirr rising in pitch and speed (the drumroll), a dry glass click, silence for the blink, a soft squeak for the cinch and a warm chime as she pops. ' +
    "Generic: the hoop settles at the height of the next taken ring, so on a flag others already hold it lands on top of their rings (a tally). Every other robot sways along with the wobble, smaller and a little late, and blinks at the click. " +
    'The hoop becomes the game\'s own taken ring (setTaken) on the frame it reaches that size; the column stays warm white. ~2.8 s including the Move 2, with a gentle push in that is home by the end.',
};

const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));

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

/** Take a robot over with acting channels: body squash (sq), body lean/tip (only the body, the ring stays on the glass), eye. */
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
  /** Lean the body toward a world direction (angle on the glass, as atan2(dx, dz)) by `amt` radians. */
  a.leanToward = (ang, amt) => {
    const wx = Math.sin(ang);
    const wz = Math.cos(ang);
    const r = p.pose.rot;
    const lx = wx * Math.cos(r) - wz * Math.sin(r);
    const lz = wx * Math.sin(r) + wz * Math.cos(r);
    a.tip = amt * lx;
    a.lean = -amt * lz;
  };
  return a;
}

function glowSprite(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const T = (keys) => track(ease, keys);
  const sc = lab.scenario;
  const flag = { x: 4, y: 1 };
  const fp = lab.pos(flag.x, flag.y);
  const col = lab.arena.columns.find((c) => c.n === 1);
  const below = col ? col.taken.children.length : 0; // robots that already hold this flag: settle on top of their rings
  const ringY = 0.06 + below * 0.07;
  const color = lab.bot('a').color;

  const maya = actor(lab, 'a');
  const east = maya.p.pose.rot;
  const lookers = Object.keys(sc.bots)
    .filter((k) => k !== 'a' && sc.bots[k].on !== false)
    .map((k, i) => {
      const a = actor(lab, k);
      const r = sc.bots[k];
      a.home = { x: r.x, y: r.y, rot: a.p.pose.rot };
      a.lag = 0.12 + i * 0.04;
      a.toFlag = Math.atan2(fp.x - lab.pos(r.x, r.y).x, fp.z - lab.pos(r.x, r.y).z);
      return a;
    });

  // ---- the hoop: a ring of Maya's light, its tilt and spin set every frame ----
  const R0 = 0.6;
  const RT = 0.27; // the game's taken ring
  const hoopMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tilt = new THREE.Group();
  tilt.rotation.order = 'YXZ';
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.036, 10, 128), hoopMat);
  hoop.rotation.x = Math.PI / 2;
  tilt.add(hoop);
  lab.add(tilt);
  const gTex = glowSprite(THREE);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.6).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  lab.add(glint);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gTex, color: new THREE.Color(color).multiplyScalar(0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(fp.x, 0.01, fp.z);
  lab.add(pool);

  // timeline (seconds from the start of the moment)
  const LAND = 0.84;
  const S0 = 0.9; // the spin-down starts
  const D = 1.18; // ... and lasts
  const CLICK = S0 + D;
  const CINCH = CLICK + 0.12;
  const HAND = CINCH + 0.2; // the hoop is the taken ring
  const END = 2.84;
  const A0 = 0.98; // tilt (from flat) when it starts settling
  const W0 = TAU * 1.35; // precession speed at the start (rad/s)
  const spinS = (t) => clamp01((t - S0) / D);
  const alphaOf = (s) => A0 * (1 - s) ** 0.62;
  const phiOf = (s) => 0.6 + (W0 * D * (1 - (1 - s) ** 0.7)) / 0.7;

  // ---- Maya's acting ----
  const M = {
    x: T([[0, 2], [0.6, 4, 'inOut']]),
    // looks up at the falling hoop, ducks when it lands
    look: T([[0.56, 0], [0.68, -0.5, 'out'], [0.8, -0.52], [LAND, 0.1, 'in'], [0.98, 0, 'out']]),
    sq: T([[0.58, 1], [0.64, 0.9, 'out'], [0.72, 1.06, 'out'], [LAND - 0.02, 1.02], [LAND + 0.04, 0.8, 'out'], [1.02, 1, 'outBack'], [CLICK, 1], [CLICK + 0.04, 0.9, 'out'], [CINCH, 0.94], [HAND, 1.24, 'in'], [HAND + 0.07, 0.86, 'out'], [HAND + 0.2, 1.06, 'out'], [END - 0.12, 1, 'inOut']]),
    wide: T([[CINCH, 1], [HAND, 0.8, 'in'], [HAND + 0.07, 1.06, 'out'], [END - 0.1, 1, 'inOut']]),
    lift: T([[LAND, 0], [LAND + 0.07, 0.1, 'out'], [LAND + 0.16, 0, 'in'], [HAND, 0], [HAND + 0.1, 0.08, 'out'], [HAND + 0.22, 0, 'in']]),
    eye: T([[0.62, 1], [0.68, 1.8, 'out'], [LAND, 1.6], [LAND + 0.03, 0.25, 'out'], [LAND + 0.14, 1.1, 'out'], [CLICK - 0.3, 1.25], [CLICK, 1.5], [CLICK + 0.03, 0.15, 'out'], [CLICK + 0.09, 0.15], [CLICK + 0.14, 1.2, 'out'], [HAND, 2.2, 'in'], [HAND + 0.2, 1.4, 'out'], [END, 1, 'inOut']]),
    squint: T([[CINCH, 1], [HAND, 0.5, 'in'], [HAND + 0.1, 1.15, 'out'], [END, 1, 'inOut']]),
    // how hard she follows the wobble with her body
    follow: T([[S0 + 0.05, 0], [S0 + 0.35, 0.26, 'inOut'], [CLICK, 0.32, 'inOut']]),
    // after the click: the head goes round once more on its own (dizzy), then she straightens
    dizzy: T([[CLICK, 1], [CLICK + 0.16, 0.0, 'out']]),
    proud: T([[HAND + 0.1, 0], [HAND + 0.25, -0.09, 'out'], [END, 0, 'inOut']]),
  };

  const t0 = lab.t;
  // camera: a gentle push toward the flag while the hoop spins, home again by the end
  const camK = T([[0.5, 0], [1.25, 1, 'inOut'], [HAND + 0.05, 1], [END, 0, 'inOut']]);
  const camAt = fp.clone().setY(0.25);
  const camRelease = lab.camera((home) => {
    const k = camK(lab.t - t0);
    return { target: home.target.clone().lerp(camAt, 0.42 * k), dist: home.dist * (1 - 0.24 * k), el: home.el + 0.04 * k };
  });

  lab.playCard('a', ['m2']);
  let handed = false;
  let landed = false;
  let lastLean = { ang: 0, amt: 0 };
  let flashAt = -9;
  const stop = lab.every(() => {
    const t = lab.t - t0;

    // ---- the hoop ----
    let alpha;
    let phi;
    let cy;
    let R = R0;
    let vis = 0;
    if (t < 0.3) {
      vis = 0;
    } else if (t < LAND) {
      // drops down the column, nearly upright, turning slowly; it fades in near the top
      const k = (t - 0.3) / (LAND - 0.3);
      alpha = 1.42 - 0.44 * ease.in(k);
      phi = 0.6 - 1.4 * (1 - k);
      cy = 2.3 + (R0 * Math.sin(A0) + 0.02 - 2.3) * ease.in(k);
      vis = clamp01(k / 0.25);
    } else if (t < CLICK) {
      const s = spinS(t);
      alpha = alphaOf(s);
      phi = phiOf(s);
      // a little bounce on landing
      const b = t - LAND;
      const bounce = b < 0.22 ? Math.sin((b / 0.22) * Math.PI) * 0.07 * (1 - b / 0.22) : 0;
      cy = R0 * Math.sin(alpha) + 0.02 + bounce;
      vis = 1;
    } else {
      alpha = 0;
      phi = phiOf(1);
      const k = clamp01((t - CINCH) / (HAND - CINCH));
      R = R0 + (RT - R0) * ease.in3(k);
      cy = 0.02 + (ringY - 0.02) * k;
      vis = 1;
    }
    if (t >= HAND && !handed) {
      handed = true;
      lab.arena.setTaken([{ color, cp: 1 }]); // in the game: the room's real taken list
    }
    tilt.visible = vis > 0 && !handed;
    if (tilt.visible) {
      tilt.position.set(fp.x, cy, fp.z);
      tilt.rotation.set(alpha, phi, 0);
      hoop.scale.setScalar(R);
      const flash = Math.max(0, 1 - (t - CLICK) / 0.16) * (t >= CLICK ? 1 : 0);
      // it brightens as it speeds up (the drumroll), flashes white at the click, then settles to the ring's light
      const s = spinS(t);
      const k = clamp01((t - CINCH) / (HAND - CINCH));
      hoopMat.color.set(color).lerp(new THREE.Color('#fff'), 0.25 + flash * 0.6).multiplyScalar((1.6 + 0.6 * s * (t < CLICK ? 1 : 0) + 3 * flash) * (1 - 0.15 * k));
      hoopMat.opacity = vis;
    }
    // the glint where the hoop touches the glass, and the light it spills
    if (t >= LAND && t < CLICK) {
      const s = spinS(t);
      const cr = R0 * Math.cos(alpha);
      glint.position.set(fp.x + Math.sin(phi) * cr, 0.03, fp.z + Math.cos(phi) * cr);
      const g = 0.28 + 0.12 * s + (t - LAND < 0.12 ? 0.3 * (1 - (t - LAND) / 0.12) : 0);
      glint.scale.setScalar(g);
      glint.material.opacity = 0.9;
      pool.scale.setScalar(R0 * 2.2);
      pool.material.opacity = 0.05 + 0.12 * s;
    } else if (t >= CLICK) {
      glint.material.opacity = 0;
      const k = clamp01((t - CLICK) / (HAND - CLICK + 0.2));
      pool.scale.setScalar((R0 + (RT - R0) * clamp01((t - CINCH) / (HAND - CINCH))) * 2.2);
      pool.material.opacity = 0.17 * (1 - k);
    }
    if (t >= CLICK && flashAt < 0) {
      flashAt = t;
      lab.ring(fp.clone().setY(0.02), '#ffffff', 0.45, 0.02, 0.28);
    }
    if (t >= LAND && !landed) {
      landed = true;
      lab.ring(fp.clone().setY(0.02), '#ffffff', 0.3, 0.02, 0.25);
    }

    // ---- Maya ----
    let leanAng = 0;
    let leanAmt = 0;
    if (t < CLICK) {
      if (alpha != null && t >= S0) {
        // she leans toward the point where the hoop touches the glass, a touch behind it
        leanAng = phi - 0.35 * spinS(t);
        leanAmt = M.follow(t);
      }
    } else {
      // dizzy: the head carries on round for a moment after the hoop has stopped, then straightens
      const d = M.dizzy(t);
      leanAng = lastLean.ang + (t - CLICK) * TAU * 3.2;
      leanAmt = lastLean.amt * d;
    }
    if (t < CLICK) lastLean = { ang: leanAng, amt: leanAmt };
    const look = M.look(t);
    // a small turn of the head toward the glint while she follows it
    // her head swings to follow the glint round, like watching a spinning coin: faster and faster
    const rel = leanAng - east - Math.PI;
    const side = leanAmt > 0 ? Math.sin(rel) : 0;
    const followOn = Math.min(1, leanAmt / 0.24);
    maya.p.set({ x: M.x(t), y: flag.y, rot: east + 0.75 * side * followOn, lift: M.lift(t) });
    maya.leanToward(leanAng, leanAmt);
    // the drive: rocks back as she sets off, forward as she brakes
    const drive = t < 0.6 ? (t < 0.3 ? -0.1 : 0.14) * Math.sin(((t % 0.3) / 0.3) * Math.PI) : 0;
    maya.lean += look + M.proud(t) + drive;
    maya.sq = M.sq(t);
    maya.wide = M.wide(t);
    maya.eye = M.eye(t) + (t < CLICK ? 0.8 * followOn * Math.max(0, Math.cos(rel)) ** 2 : 0); // the glint in her eye
    maya.squint = M.squint(t);

    // ---- bystanders sway along, smaller and late, and blink at the click ----
    for (const a of lookers) {
      const tl = t - a.lag;
      const s = spinS(tl);
      const on = clamp01((tl - S0) / 0.4) * (tl < CLICK ? 1 : clamp01(1 - (tl - CLICK) / 0.2));
      const perk = clamp01((t - 0.62) / 0.12) * clamp01((END - 0.1 - t) / 0.4);
      a.p.set({ x: a.home.x, y: a.home.y, rot: a.home.rot, trail: false });
      a.leanToward(phiOf(s), 0.09 * on);
      const blink = t > CLICK + 0.02 && t < CLICK + 0.1 ? 0.2 : 1;
      a.eye = (1 + 0.35 * perk) * blink;
      a.sq = 1 + 0.04 * perk;
    }
  });

  await lab.wait(END);
  stop();
  camRelease();
  maya.reset();
  maya.p.release({ x: 4, y: 1, d: 1 });
  for (const a of lookers) {
    a.reset();
    const r = sc.bots[a.p.key];
    a.p.release({ x: r.x, y: r.y, d: r.d });
  }
}
