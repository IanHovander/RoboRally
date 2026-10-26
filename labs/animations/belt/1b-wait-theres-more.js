// Belt, idea 1 (animator b, character acting): "Wait, There's More".
// The express step carries Maya one space and the whole stream stops with her. She thinks the ride is over and
// sinks into a comfy squash, eye lidded and warm, and takes a long contented breath. Mid-sigh the all-belts step
// yanks her base out from under her: whiplash lean, eye snapped wide, and she's carried onto the corner as stiff
// as a plank, turned like a piece of furniture, and rocks to a halt still bolt upright. Jun saw it coming.
export const meta = {
  title: "Wait, There's More",
  idea:
    'Blue moves once and the stream stops dead with her, so Maya settles in: she sinks into a comfy squash, her eye lids down to a warm glow and she takes a long, happy breath. Mid-sigh the all-belts step yanks her base out from under her: whiplash, eye snapped wide, and she is carried onto the corner stiff as a plank, turned like furniture, rocking to a halt. Jun, who knew, tilts his head beforehand and snickers after. The room learns "blue means two" by watching her get caught out.',
  notes:
    'Sound: a soft two-note glass chime for the first slide, then near silence with a breathy low "hmm" on the settle; the yank is a sharp, bright glass tick (a fingernail on a wine glass) and the corner turn a stiff wooden-ish knock. Jun snickers in three tiny high ticks. The stream itself stopping and lurching (express texture offset driven by her motion) is part of the gag; in the game, drive it from the two belt beats. Her wide eye lingers into the next beat and blinks once: port as a decaying "startled" expression on the bot, not a held state. Runs on every express ride as a running gag: she never learns.',
};

export default async function play(lab) {
  const { ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  const jun = lab.puppet('b');
  const M = rig(lab, maya, 'x');
  const J = rig(lab, jun, 'y');
  const junRot = jun.pose.rot;

  // the express stream: stop its own scroll and drive it from her motion, so it carries her and stops with her
  const belts = arena.belts.filter((b) => b.fast);
  const speed0 = belts.map((b) => b.speed);
  const off0 = belts.map((b) => b.tex.offset.y);
  for (const b of belts) b.speed = 0;
  const restoreBelts = () => belts.forEach((b, i) => (b.speed = speed0[i]));
  lab.cleanup(restoreBelts);

  // ----- the choreography, as keyframe tracks over the moment's clock (seconds) -----
  const YANK = 1.36;
  const x = track([[0, 1], [0.5, 2, 'inOut'], [YANK, 2], [YANK + 0.42, 3, 'out']]);
  const rot = track([[0, 0], [YANK + 0.14, 0], [YANK + 0.44, -Math.PI / 2, 'inOut']]);
  // body roll (her right +): lag on the first slide, overshoot on its stop, a wiggle into the seat, whiplash
  const roll = track([
    [0, 0], [0.12, -0.1, 'out'], [0.42, 0.02], [0.54, 0.09, 'out'], [0.68, -0.035], [0.8, 0],
    [0.9, 0.045], [1.0, -0.04], [1.1, 0],
    [YANK, 0], [YANK + 0.05, -0.52, 'out'], [YANK + 0.22, -0.08, 'inOut'], [YANK + 0.3, 0],
  ]);
  // pitch (forward +): head snaps back at the yank, and the stiff body tips like a plank when the belt stops
  const lean = track([
    [0, 0], [YANK, 0], [YANK + 0.05, -0.14, 'out'], [YANK + 0.25, 0, 'inOut'],
    [YANK + 0.42, 0], [YANK + 0.5, 0.15, 'out'], [YANK + 0.6, -0.05, 'inOut'], [YANK + 0.68, 0.02], [YANK + 0.74, 0],
  ]);
  // squash: a slight stretch for the ride, the sink, a long breath in and out, then bolt upright
  const sy = track([
    [0, 1], [0.25, 1.03], [0.5, 1], [0.72, 1], [1.02, 0.8, 'out'],
    [1.2, 0.85, 'inOut'], [YANK, 0.81, 'inOut'],
    [YANK + 0.06, 1.2, 'out'], [YANK + 0.2, 1.08, 'inOut'],
  ]);
  const eyeOpen = track([[0, 1], [0.72, 1], [1.02, 0.36, 'out'], [1.2, 0.42], [YANK, 0.34], [YANK + 0.03, 2.7, 'out'], [YANK + 0.3, 2.35]]);
  const eyeGlow = track([[0, 1], [0.72, 1], [1.02, 0.34, 'out'], [1.2, 0.42], [YANK, 0.3], [YANK + 0.03, 1.75, 'out'], [YANK + 0.5, 1.45]]);
  const warm = track([[0, 0], [0.72, 0], [1.0, 1], [YANK, 1], [YANK + 0.03, 0]]);
  const pool = track([[0, 1], [0.72, 1], [1.05, 1.22, 'out'], [YANK, 1.2], [YANK + 0.05, 0.92, 'out'], [YANK + 0.3, 1]]);
  const quiver = track([[0, 0], [YANK + 0.45, 0], [YANK + 0.5, 1], [YANK + 0.8, 0.4]]);

  // Jun: watches her, tilts his head knowingly as she settles, leans in for it, then snickers
  const junTurn = track([[0, 0], [0.5, -0.3], [YANK + 0.3, -0.3], [YANK + 0.42, -0.45], [2.05, -0.45], [2.25, 0]]);
  const junRoll = track([[0, 0], [0.86, 0], [1.04, 0.17, 'out'], [YANK, 0.15], [YANK + 0.1, 0.04], [2.0, 0], [2.2, 0]]);
  const junLean = track([[0, 0], [1.12, 0], [YANK - 0.04, 0.1, 'inOut'], [YANK + 0.1, -0.07, 'out'], [2.0, -0.03], [2.2, 0]]);
  const junSquint = track([[0, 1], [0.86, 1], [1.04, 0.5, 'out'], [YANK, 0.55], [YANK + 0.06, 1.25, 'out'], [2.0, 1.1], [2.2, 1]]);
  const SNICKER = YANK + 0.12;

  const END = 2.25;
  const t0 = lab.t;
  const crawl = (t) => (t < 0.3 ? t - (t * t) / 0.6 : 0.15) + (t > YANK + 0.42 ? ramp(t - (YANK + 0.42), 0.35) : 0);
  const apply = (t) => {
    const mx = x(t);
    maya.set({ x: mx, y: 1, rot: rot(t) });
    Object.assign(M, { roll: roll(t), lean: lean(t), sy: sy(t), open: eyeOpen(t), glow: eyeGlow(t), warm: warm(t), pool: pool(t) });
    M.sx = M.sz = 1 / Math.sqrt(M.sy);
    // a tiny stiff quiver once she's stopped, still in shock
    const q = quiver(t);
    M.shake = q ? Math.sin(t * 70) * 0.006 * q : 0;
    // the stream moves exactly as she does, and stops when she stops
    belts.forEach((b, i) => (b.tex.offset.y = (((off0[i] - (mx - 1) - crawl(t)) % 1) + 1) % 1));

    jun.set({ rot: junRot + junTurn(t) });
    const s = t - SNICKER;
    const env = s > 0 ? Math.max(0, 1 - s / 0.62) : 0;
    const shudder = Math.abs(Math.sin(s * Math.PI * 2 * 5.2)) * env;
    Object.assign(J, { roll: junRoll(t), lean: junLean(t), open: junSquint(t) * (1 - 0.35 * shudder), glow: 1 + 0.7 * env + 0.5 * shudder, sy: 1 - 0.09 * shudder, hop: 0.05 * shudder });
    J.sx = J.sz = 1 + 0.03 * shudder;
  };
  const stop = lab.every(() => apply(Math.min(END, lab.t - t0)));
  await lab.wait(END);
  apply(END);
  stop();
  restoreBelts();
  maya.release({ x: 3, y: 1, d: 1 });
  jun.release({ x: 5, y: 2, d: 3 });
  J.reset();

  // the game carries on; she stays bolt upright and wide-eyed for a moment, then blinks once and lets go
  const tail = lab.t;
  const stopTail = lab.every(() => {
    const t = lab.t - tail;
    const blink = t > 0.5 && t < 0.68 ? Math.sin(((t - 0.5) / 0.18) * Math.PI) : 0;
    const relax = Math.min(1, Math.max(0, (t - 0.55) / 0.3));
    const k = ease.inOut(relax);
    M.sy = 1.08 + (1 - 1.08) * k;
    M.sx = M.sz = 1 / Math.sqrt(M.sy);
    M.roll = M.lean = M.shake = 0;
    M.open = (2.35 + (1 - 2.35) * k) * (1 - 0.95 * blink);
    M.glow = 1.45 + (1 - 1.45) * k;
    M.warm = 0;
    M.pool = 1;
    M.applyTo(lab.bot('a').model);
    if (t > 0.9) {
      M.reset();
      stopTail();
    }
  });
  void facing;
}

// ---------- helpers (self-contained) ----------

const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) ** 2,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out3: (k) => 1 - (1 - k) ** 3,
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
};

/** A keyframe track: [[t, value], [t, value, ease], ...] → f(t). The ease shapes the segment arriving at a key. */
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = 'inOut'] = keys[i];
      if (t <= t1) {
        const [ta, va] = keys[i - 1];
        const k = t1 > ta ? (t - ta) / (t1 - ta) : 1;
        return va + (v1 - va) * EASE[e](k);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Integral of a speed that ramps linearly 0 → 1 over `dur`, then stays at 1 (an idle belt crawl coming back). */
function ramp(t, dur) {
  return t < dur ? (t * t) / (2 * dur) : dur / 2 + (t - dur);
}

/**
 * Body language for a puppet: lean/roll of the body (not the ring), squash and stretch, the eye's opening and
 * glow, and the pool of light. `openAxis` is the eye mesh's local axis that opens it ('x' for the Pebble's eye,
 * which lies on its side; 'y' for the Cube's visor).
 */
function rig(lab, p, openAxis) {
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push(o));
  const eyeBase = eyes.map((e) => e.scale.clone());
  let pool = null;
  m.group.traverse((o) => o.isMesh && o.material === m.poolMat && (pool = o));
  const poolBase = pool?.scale.clone();
  const st = {
    lean: 0, roll: 0, sx: 1, sy: 1, sz: 1, hop: 0, open: 1, glow: 1, warm: 0, pool: 1, shake: 0,
    applyTo(model) {
      model.body.rotation.x = -st.lean;
      model.body.rotation.z = -st.roll;
      model.body.scale.set(st.sx, st.sy, st.sz);
      model.body.position.set(st.shake, st.hop, 0);
      eyes.forEach((e, i) => {
        e.scale.copy(eyeBase[i]);
        e.scale[openAxis] = eyeBase[i][openAxis] * st.open;
      });
      const g = st.glow;
      model.eyeMat.color.setRGB(3.2 * g * (1 + 0.12 * st.warm), 3.1 * g * (1 - 0.12 * st.warm), 2.9 * g * (1 - 0.45 * st.warm));
      if (pool) {
        pool.scale.set(poolBase.x * st.pool, poolBase.y * st.pool, poolBase.z);
        model.poolMat.opacity *= 1 / Math.max(0.6, st.pool * st.pool) ** 0.5;
      }
    },
    reset() {
      m.body.rotation.set(0, 0, 0);
      m.body.scale.set(1, 1, 1);
      m.body.position.set(0, 0, 0);
      eyes.forEach((e, i) => e.scale.copy(eyeBase[i]));
      if (pool) pool.scale.copy(poolBase);
    },
  };
  p.each = (model) => st.applyTo(model);
  lab.cleanup(() => st.reset());
  return st;
}
