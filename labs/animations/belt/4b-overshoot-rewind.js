// Belt, idea 4 (animator b, character acting): "Overshoot and Rewind".
// The belt is overeager. Maya is flung east, braces for the corner, and isn't stopped: she's spun right round
// and carried halfway down the south leg, ending up facing south, which is to say facing US. Freeze. The
// chevrons stall. And Maya, deadpan, looks straight out of the screen at the room and slowly blinks. Then the
// tape rewinds: chevrons backwards, her trail reeled back up the belt like tape onto a spool, her own panic and
// Jun's flinch playing in reverse. The corner then plays properly and primly; she gives one satisfied nod.
export const meta = {
  title: 'Overshoot and Rewind',
  idea:
    'The belt overdoes it: Maya is flung through the corner, spun past east and carried halfway down the south leg, ending up facing the room. Freeze: the chevrons stall, and Maya looks straight out of the screen at us with a slow, deadpan blink. Then everything rewinds (the chevrons, her trail reeling back up the belt like tape, her panic and Jun\'s flinch playing backwards) and the corner plays properly: a prim quarter-turn to east, a soft settle, one satisfied nod.',
  notes:
    'Sound: the overshoot is the normal belt whoosh pitched up and running long; the freeze cuts it dead (a tiny tape "clunk"); silence for the deadpan look (the room fills it); the rewind is the same whoosh reversed and sped up, with a fast ticking as the trail reels in; the proper turn is the game\'s usual soft chime. Rare: once or twice a game, so the fake-out survives. Port: every pose here is a function of time, so the rewind just evaluates the overshoot backwards; the trail rewinds by dropping the points laid after that time. Facing the camera is what makes the look land; on a corner turning another way, the overshoot should still end facing the room.',
};

export default async function play(lab) {
  const { arena } = lab;
  const maya = lab.puppet('a');
  const jun = lab.puppet('b');
  const M = rig(lab, maya, 'x');
  const J = rig(lab, jun, 'y');
  const junRot = jun.pose.rot;
  const PI = Math.PI;

  // the express belts: we drive their speed (overeager, stalled, reversed)
  const belts = arena.belts.filter((b) => b.fast);
  const speed0 = belts.map((b) => b.speed);
  const restoreBelts = () => belts.forEach((b, i) => ((b.speed = speed0[i]), (b.pulse = 0)));
  lab.cleanup(restoreBelts);

  // ----- the path she's flung along: the east leg, a tight bend through the corner, down the south leg -----
  const r = 0.25;
  const s1 = 1.75; // (2.75, 1): into the bend
  const s2 = s1 + (r * PI) / 2; // (3, 1.25): out of it
  const SEND = s2 + 0.25; // (3, 1.5): halfway to (3, 2)
  const pathAt = (s) => {
    if (s <= s1) return { x: 1 + s, y: 1 };
    if (s <= s2) {
      const f = (s - s1) / r;
      return { x: 2.75 + r * Math.sin(f), y: 1.25 - r * Math.cos(f) };
    }
    return { x: 3, y: 1.25 + (s - s2) };
  };
  const SPIN0 = 1.55; // where the belt starts (over-)turning her

  // ----- the overshoot, as functions of its own clock (0 .. FWD), so the rewind can play them backwards -----
  const FWD = 0.75;
  const sOf = (t) => {
    const k = Math.min(1, Math.max(0, (t - 0.08) / (FWD - 0.08)));
    return SEND * (0.42 * k + 0.58 * k * k); // eager: speeding up all the way, then a dead stop
  };
  const rotOf = (t) => {
    const s = sOf(t);
    const k = Math.min(1, Math.max(0, (s - SPIN0) / (SEND - SPIN0)));
    return -PI * EASE.inOut(k);
  };
  const fRoll = track([[0, 0], [0.08, 0], [0.18, -0.22, 'out'], [0.45, -0.14], [0.56, 0.16, 'inOut'], [0.64, 0.05], [FWD, 0]]);
  const fLean = track([[0, 0], [0.56, 0], [0.64, 0.08], [FWD, -0.24, 'out']]);
  const fSy = track([[0, 1], [0.06, 0.9, 'out'], [0.16, 1.06, 'out'], [0.5, 1.03], [0.6, 0.96], [FWD, 1.14, 'out']]);
  const fOpen = track([[0, 1], [0.06, 0.8], [0.16, 1.5, 'out'], [0.5, 1.3], [0.58, 1.0], [0.64, 1.0], [FWD, 2.6, 'out']]);
  const fGlow = track([[0, 1], [0.16, 1.3], [0.58, 1.1], [FWD, 1.8, 'out']]);
  // Jun, watching her come round at him: flinches back
  const jfYaw = track([[0, 0], [0.1, -0.3, 'out'], [0.5, -0.22], [FWD, -0.08]]);
  const jfLean = track([[0, 0], [0.55, 0], [FWD, -0.2, 'out']]);
  const jfOpen = track([[0, 1], [0.55, 1], [FWD, 1.9, 'out']]);
  const jfSy = track([[0, 1], [0.55, 1], [FWD, 1.1, 'out']]);
  const herFwd = (t) => ({ yaw: 0, lean: fLean(t), roll: fRoll(t), sy: fSy(t), open: fOpen(t), glow: fGlow(t) });
  const junFwd = (t) => ({ yaw: jfYaw(t), lean: jfLean(t), roll: 0, sy: jfSy(t), open: jfOpen(t), glow: 0.85 + 0.25 * jfOpen(t) });

  // ----- the rest of the moment -----
  const HOLD = FWD; // freeze-frame; she looks at us
  const REW = 1.3; // the rewind
  const REW_LEN = 0.24;
  const PLAY = REW + REW_LEN + 0.08; // a beat for the tape to clunk, then the proper turn
  const END = PLAY + 0.78;
  // where the rewind stops: just before the bend, still facing north
  let tauBack = 0;
  for (let i = 0; i <= 200; i++) if (sOf((i / 200) * FWD) <= SPIN0) tauBack = (i / 200) * FWD;
  const back = pathAt(sOf(tauBack));

  // the deadpan look at the room (during the hold): blended over the frozen pose
  const dOpen = track([[0, 2.6], [0.14, 2.6], [0.3, 0.42, 'inOut'], [0.36, 0.42], [0.41, 0.06, 'in'], [0.47, 0.42, 'out'], [0.55, 0.42]]);
  const dSy = track([[0, 1.14], [0.14, 1.14], [0.32, 0.97, 'inOut']]);
  const dLean = track([[0, -0.24], [0.14, -0.24], [0.32, 0.02, 'inOut']]);
  const dRoll = track([[0, 0], [0.2, 0], [0.34, 0.09, 'inOut']]);
  const dGlow = track([[0, 1.8], [0.14, 1.8], [0.32, 0.85, 'inOut']]);
  const jdOpen = track([[0, 1.9], [0.2, 1.9], [0.36, 0.55, 'inOut']]);
  const jdLean = track([[0, -0.2], [0.2, -0.2], [0.4, -0.05, 'inOut']]);

  // the proper ending: in to the centre, a prim quarter-turn, a soft settle and a satisfied nod
  const pX = track([[0, back.x], [0.26, 3, 'out']]);
  const pRot = track([[0, 0], [0.16, 0], [0.46, -PI / 2, 'inOut']]);
  const pSy = track([[0, 1], [0.12, 1.04], [0.46, 1.03], [0.54, 0.92, 'out'], [0.64, 1.0, 'inOut'], [0.78, 1.0]]);
  const pLean = track([[0, 0], [0.56, 0], [0.64, 0.16, 'out'], [0.72, 0, 'inOut']]);
  const pOpen = track([[0, 1.1], [0.46, 1.0], [0.6, 0.55, 'inOut'], [0.78, 0.7]]);
  const pWarm = track([[0, 0], [0.5, 0], [0.64, 1], [0.78, 0.8]]);
  const jpLean = track([[0, 0], [0.6, 0], [0.68, 0.1, 'out'], [0.76, 0, 'inOut']]);

  // the camera leans in for the look, and snaps back with the rewind
  const camK = track([[0, 0], [HOLD + 0.05, 0], [HOLD + 0.45, 1, 'inOut'], [REW, 1], [REW + REW_LEN, 0, 'inOut']]);
  const focus = lab.pos(3, 1.5);
  let releaseCam = lab.camera((home, t) => {
    const k = camK(Math.min(END, t - t0));
    return { target: home.target.clone().lerp(focus, 0.35 * k), dist: home.dist * (1 - 0.12 * k) };
  });

  const t0 = lab.t;
  let phase = '';
  const blend = (a, b, k) => {
    const o = {};
    for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k;
    return o;
  };
  const setBody = (st, b) => {
    Object.assign(st, b);
    st.sx = st.sz = 1 / Math.sqrt(st.sy);
  };
  const apply = (t) => {
    let her;
    let junB;
    if (t < HOLD) {
      if (phase !== 'fwd') {
        phase = 'fwd';
        belts.forEach((b) => ((b.pulse = lab.t), (b.speed = 1.5)));
      }
      const p = pathAt(sOf(t));
      maya.set({ x: p.x, y: p.y, rot: rotOf(t), trail: true });
      her = herFwd(t);
      junB = junFwd(t);
    } else if (t < REW) {
      if (phase !== 'hold') {
        phase = 'hold';
        belts.forEach((b) => ((b.pulse = 0), (b.speed = 0)));
      }
      const u = t - HOLD;
      const p = pathAt(SEND);
      maya.set({ x: p.x, y: p.y, rot: -PI });
      her = { yaw: 0, lean: dLean(u), roll: dRoll(u), sy: dSy(u), open: dOpen(u), glow: dGlow(u) };
      junB = { ...junFwd(FWD), open: jdOpen(u), lean: jdLean(u) };
    } else if (t < PLAY) {
      if (phase !== 'rew') {
        phase = 'rew';
        belts.forEach((b) => (b.speed = -4.5));
        maya.set({ trail: false });
      }
      const k = Math.min(1, (t - REW) / REW_LEN);
      const tau = FWD - (FWD - tauBack) * EASE.inOut(k);
      const p = pathAt(sOf(tau));
      maya.set({ x: p.x, y: p.y, rot: rotOf(tau) });
      // snap from the deadpan back into the tape's pose, then play it backwards
      const snap = Math.min(1, (t - REW) / 0.05);
      const dead = { yaw: 0, lean: dLean(0.55), roll: dRoll(0.55), sy: dSy(0.55), open: dOpen(0.55), glow: dGlow(0.55) };
      her = blend(dead, herFwd(tau), snap);
      junB = blend({ ...junFwd(FWD), open: jdOpen(0.55), lean: jdLean(0.55) }, junFwd(tau), snap);
      // reel the trail in: drop what was laid after this point of the tape; the rest pulls taut and bright
      const tr = maya.bot.trail;
      const cut = t0 + tau;
      while (tr.length && tr[tr.length - 1].t > cut) tr.pop();
      for (const q of tr) q.t = Math.max(q.t, lab.t - 0.5);
      if (k >= 1) belts.forEach((b) => (b.speed = 0));
    } else {
      if (phase !== 'play') {
        phase = 'play';
        restoreBelts();
        maya.set({ trail: true });
        releaseCam?.();
        releaseCam = null;
      }
      const u = t - PLAY;
      maya.set({ x: pX(u), y: 1, rot: pRot(u) });
      her = { yaw: 0, lean: pLean(u), roll: 0, sy: pSy(u), open: pOpen(u), glow: 1.05, warm: pWarm(u) };
      const j0 = junFwd(tauBack);
      junB = { ...j0, yaw: j0.yaw - 0.1 * Math.min(1, u / 0.3), lean: jpLean(u) };
    }
    setBody(M, { warm: 0, ...her });
    jun.set({ rot: junRot });
    setBody(J, junB);
  };
  const stop = lab.every(() => apply(Math.min(END, lab.t - t0)));
  await lab.wait(END);
  apply(END);
  stop();
  restoreBelts();
  releaseCam?.();
  maya.release({ x: 3, y: 1, d: 1 });
  jun.release({ x: 5, y: 2, d: 3 });
  M.reset();
  J.reset();
}

// ---------- helpers (self-contained) ----------

const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) ** 2,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out3: (k) => 1 - (1 - k) ** 3,
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

/**
 * Body language for a puppet, on the body only (the ring and pointer stay put, so they still say where it
 * faces): yaw (a glance, right is -), lean (forward +), roll (right +), squash/stretch, the eye's opening, glow
 * and warmth. `openAxis` is the eye mesh's local axis that opens it ('x' for the Pebble's eye, which lies on
 * its side; 'y' for the Cube's visor).
 */
function rig(lab, p, openAxis) {
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push(o));
  const eyeBase = eyes.map((e) => e.scale.clone());
  const st = {
    yaw: 0, lean: 0, roll: 0, sx: 1, sy: 1, sz: 1, open: 1, glow: 1, warm: 0,
    applyTo(model) {
      model.body.rotation.order = 'YXZ';
      model.body.rotation.set(-st.lean, st.yaw, -st.roll);
      model.body.scale.set(st.sx, st.sy, st.sz);
      eyes.forEach((e, i) => {
        e.scale.copy(eyeBase[i]);
        e.scale[openAxis] = eyeBase[i][openAxis] * Math.max(0.05, st.open);
      });
      const g = st.glow;
      model.eyeMat.color.setRGB(3.2 * g * (1 + 0.12 * st.warm), 3.1 * g * (1 - 0.12 * st.warm), 2.9 * g * (1 - 0.45 * st.warm));
    },
    reset() {
      m.body.rotation.set(0, 0, 0);
      m.body.rotation.order = 'XYZ';
      m.body.scale.set(1, 1, 1);
      eyes.forEach((e, i) => e.scale.copy(eyeBase[i]));
    },
  };
  p.each = (model) => st.applyTo(model);
  lab.cleanup(() => st.reset());
  return st;
}
