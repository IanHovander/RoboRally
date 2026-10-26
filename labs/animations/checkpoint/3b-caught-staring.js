// Heads turn, acted: Theo can't help himself. He perks up at the claim, whips round to stare, cranes in,
// even points at her, and is caught when Maya slowly turns to look back. He snaps back to his own facing far
// too fast, overshoots, and sways about innocently while she gives him a long look.
export const meta = {
  title: 'Caught staring',
  idea:
    'At the claim every other robot whips round to stare at Maya, leaning in and pointing at her. She slowly turns and looks straight back at them: they snap back to their own facings too fast, overshoot, and sway about innocently while she gives them a long look before turning back east.',
  notes:
    'Sound: one soft glass chime at the claim, a quick "fwip" for the stare, silence while they lean in, a tiny glass tick when she catches them, a sharp double "fwip-fwip" for the guilty snap back. ' +
    'Generic: every robot other than the claimer stares (each a frame or two apart, so a full table looks organic) and all of them snap back on the same frame, which is the joke; the claimer turns to look at the nearest one. ' +
    'Nobody moves off their space and everyone ends on their own facing, so the rules are untouched. ~2.5 s including the Move 2.',
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
/** The rotation.y that faces from space (x0, y0) toward (x1, y1), unwrapped to be near `near`. */
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

function spring(stiff, damp) {
  return {
    x: 0,
    v: 0,
    to: 0,
    step(dt) {
      const n = Math.max(1, Math.ceil(dt * 240));
      for (let i = 0; i < n; i++) {
        this.v += (-stiff * (this.x - this.to) - damp * this.v) * (dt / n);
        this.x += this.v * (dt / n);
      }
      return this.x;
    },
  };
}

/** Take a robot over with body-only squash, eye brightness and pointer length as extra channels. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const eyes = [];
  p.model.body.traverse((o) => o.isMesh && o.material === p.model.eyeMat && eyes.push(o));
  let tick = null;
  p.group.traverse((o) => o.isMesh && o.geometry?.type === 'ShapeGeometry' && (tick = o));
  const a = { p, sq: 1, eye: 1, squint: 1, point: 1, lean: 0, tip: 0 };
  const eyeScale = eyes.map((e) => e.scale.clone());
  const tickZ = tick?.position.z ?? 0;
  p.each = (m) => {
    const w = 1 / Math.sqrt(Math.max(0.3, a.sq));
    m.body.scale.set(w, a.sq, w);
    m.body.rotation.x = -a.lean; // lean only the body: the ring and pointer stay flat on the glass
    m.body.rotation.z = -a.tip;
    m.eyeMat.color.setRGB(3.2 * a.eye, 3.1 * a.eye, 2.9 * a.eye);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]).multiplyScalar(1).setX(eyeScale[i].x * a.squint));
    if (tick) {
      tick.scale.set(1, a.point, 1); // the pointer's shape is drawn in its xy plane: y is its length
      tick.position.z = tickZ - (a.point - 1) * 0.04;
    }
  };
  a.reset = () => {
    p.model.body.scale.set(1, 1, 1);
    p.model.body.rotation.set(0, 0, 0);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]));
    if (tick) {
      tick.scale.set(1, 1, 1);
      tick.position.z = tickZ;
    }
  };
  return a;
}

export default async function play(lab) {
  const { ease } = lab;
  const T = (keys) => track(ease, keys);
  const sc = lab.scenario;
  const flag = { x: 4, y: 1 };
  const maya = actor(lab, 'a');
  const startRot = maya.p.pose.rot;

  // everyone else on the board is a bystander (in the lab, just Theo)
  const lookers = Object.keys(sc.bots)
    .filter((k) => k !== 'a' && sc.bots[k].on !== false)
    .map((k, i) => {
      const a = actor(lab, k);
      const r = sc.bots[k];
      a.home = { x: r.x, y: r.y, rot: a.p.pose.rot };
      a.lag = i * 0.035; // a full table turns a frame or two apart
      a.stare = aim(r.x, r.y, flag.x, flag.y, a.home.rot);
      a.dist = Math.hypot(r.x - flag.x, r.y - flag.y);
      return a;
    });
  const nearest = lookers.slice().sort((p, q) => p.dist - q.dist)[0];
  const catchRot = nearest ? aim(flag.x, flag.y, nearest.home.x, nearest.home.y, startRot) : startRot - 0.9;

  lab.playCard('a', ['m2']);
  const col = lab.arena.columns.find((c) => c.n === 1);

  // ---- Maya: drive in, a proud little puff, feel the stare, look back, glare, turn away smug ----
  const glance = startRot + (catchRot - startRot) * 0.3;
  const M = {
    x: T([[0, 2], [0.6, 4, 'inOut']]),
    rot: T([[0, startRot], [1.1, startRot], [1.2, glance, 'out'], [1.34, glance], [1.5, catchRot, 'inOut'], [2.1, catchRot], [2.32, startRot - 0.08, 'inOut'], [2.44, startRot, 'inOut']]),
    pitch: T([[0.6, 0], [1.5, 0], [1.6, 0.1, 'out'], [1.86, 0.1], [1.94, 0.18, 'in'], [2.04, 0.08, 'out'], [2.12, 0.04], [2.26, -0.12, 'out'], [2.44, 0, 'inOut']]),
    sq: T([[0.6, 1], [0.68, 0.9, 'out'], [0.84, 1.08, 'out'], [1.1, 1.0, 'inOut'], [1.5, 1], [1.58, 0.94, 'out'], [2.1, 0.96], [2.26, 1.06, 'out'], [2.44, 1, 'inOut']]),
    squint: T([[1.5, 1], [1.62, 0.35, 'out'], [2.1, 0.35], [2.2, 1, 'out']]),
    eye: T([[0.62, 1], [0.7, 1.5, 'out'], [1.0, 1, 'inOut'], [1.5, 1], [1.56, 1.6, 'out'], [1.7, 1.2, 'inOut']]),
  };
  // the drive leans her back as she sets off and forward as she brakes; a spring adds the follow-through
  const lean = spring(220, 11);

  // ---- the bystanders: perk up, whip round, crane in and point, get caught, snap back, act innocent ----
  const SNAP = 1.64;
  for (const a of lookers) {
    const h = a.home.rot;
    const s = a.stare;
    const dir = Math.sign(s - h) || 1;
    const l = a.lag;
    a.ch = {
      rot: T([[0.86 + l, h], [1.0 + l, s + dir * 0.06, 'out'], [1.08 + l, s, 'inOut'], [SNAP, s], [SNAP + 0.07, h - dir * 0.36, 'out'], [SNAP + 0.2, h + dir * 0.08, 'inOut'], [SNAP + 0.34, h, 'inOut']]),
      pitch: T([[0.78 + l, 0], [0.85 + l, -0.14, 'out'], [1.0 + l, 0.24, 'out'], [SNAP, 0.46, 'inOut'], [SNAP + 0.06, -0.2, 'out'], [SNAP + 0.3, -0.04, 'inOut'], [2.36, 0, 'inOut']]),
      lift: T([[0.78 + l, 0], [0.84 + l, 0.05, 'out'], [0.92 + l, 0, 'in']]),
      sq: T([[0.78 + l, 1], [0.84 + l, 1.1, 'out'], [1.0 + l, 1.04, 'inOut'], [SNAP, 1.1, 'inOut'], [SNAP + 0.06, 0.86, 'out'], [SNAP + 0.28, 1, 'inOut']]),
      eye: T([[0.8 + l, 1], [0.85 + l, 2.0, 'out'], [1.0 + l, 1.5, 'inOut'], [SNAP - 0.12, 1.7], [SNAP - 0.08, 0.6, 'out'], [SNAP - 0.04, 1.7, 'in'], [SNAP + 0.02, 0.45, 'out'], [2.2, 0.5], [2.4, 1, 'inOut']]),
      point: T([[0.92 + l, 1], [1.08 + l, 2.6, 'outBack'], [SNAP, 2.8], [SNAP + 0.05, 0.5, 'out'], [SNAP + 0.3, 1, 'inOut']]),
    };
  }

  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const t = lab.t - t0;
    // Maya
    const drive = t < 0.3 ? -0.1 : t < 0.6 ? 0.18 : 0;
    lean.to = drive;
    lean.step(dt);
    maya.p.set({ x: M.x(t), y: 1, rot: M.rot(t) });
    maya.lean = M.pitch(t) + lean.x;
    maya.sq = M.sq(t);
    maya.squint = M.squint(t);
    maya.eye = M.eye(t);
    // bystanders
    for (const a of lookers) {
      const c = a.ch;
      // "nothing to see here": a little sway from side to side after the snap
      const w = clamp01((t - (SNAP + 0.22)) / 0.1) * clamp01((2.4 - t) / 0.15);
      const sway = Math.sin((t - SNAP - 0.22) * TAU * 2.1) * 0.08 * w;
      a.p.set({ x: a.home.x, y: a.home.y, rot: c.rot(t), lift: c.lift(t), trail: false });
      a.lean = c.pitch(t);
      a.tip = sway;
      a.sq = c.sq(t);
      a.eye = c.eye(t);
      a.point = c.point(t);
    }
    // the flag notices the claim: a gentle warm breath of the column, no colour
    if (col) {
      const k = clamp01((t - 0.6) / 0.08) * clamp01((1.3 - t) / 0.6);
      col.mat.color.multiplyScalar(1 + 0.5 * k);
    }
  });

  lab.at(0.64, () => lab.arena.setTaken([{ color: maya.p.bot.color, cp: 1 }]));
  await lab.wait(2.52);
  stop();
  maya.reset();
  maya.p.release({ x: 4, y: 1, d: 1 });
  for (const a of lookers) {
    a.reset();
    const r = sc.bots[a.p.key];
    a.p.release({ x: r.x, y: r.y, d: r.d });
  }
}
