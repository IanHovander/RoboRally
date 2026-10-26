// Edge, idea 5 (Raft), animator b: character acting.
// Maya and Ava balance the floating slab like two kids on a raft, one each side of the middle. As Maya drives
// east the slab dips under her: the slope speeds her up, she notices, leans back and brakes with everything she
// has, skids to a stop with her nose over the rim, windmills... and the slab tips her off. The instant she's gone
// the slab springs back past level and bobs, and Ava, who has been gripping her space, rocks like a seasick
// passenger, her ring sloshing in her base. She settles on (2,3) facing north, and hiccups.
export const meta = {
  title: 'Raft: the see-saw that bites',
  idea:
    'The slab floats like a raft, balanced between Maya and Ava. As Maya drives east it dips under her weight; the ' +
    'slope speeds her up, she leans back and brakes with everything she has, skids to a stop at the rim, windmills, ' +
    'and the slab tips her off. The instant she is gone the slab springs back past level and bobs twice, and Ava, ' +
    'who was gripping her space, rocks like a seasick passenger, her ring sloshing, before settling facing north with ' +
    'one small hiccup. You only feel Maya\'s weight once it is gone.',
  notes:
    'Sound: a low glass creak that bends down in pitch with the tilt, a squeal of braking glass, two frantic little ' +
    'ticks for the windmill, a soft drop as she goes, then a deep "wobble" chord that beats with the bobs, and a tiny ' +
    'glass "hic". Port: arena.board and arena.fxGroup (the trails and cards) tilt together about the board\'s north-' +
    'south axis and heave a little when she lets go; robots get the matching lift and lean (pitch += θ·sin(rot), roll ' +
    '-= θ·cos(rot)), plus their own acting on top. The tilt follows the balance (Maya\'s distance east of the middle ' +
    'minus Ava\'s west of it), so on a real board it can come from every robot\'s position. Ends dead flat.',
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0

export default async function play(lab) {
  const { ease, facing } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  maya.set({ trail: false }); // drawn below, in board terms, so it lies on the tilted glass
  ava.set({ trail: false });
  mb.trail = [];
  const mayaEye = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const avaRing = ava.group.children.find((o) => o.material === ava.model.ringMat && o.geometry?.type === 'RingGeometry');
  const avaPool = ava.group.children.find((o) => o.material === ava.model.poolMat);
  const ringHome = avaRing.position.clone();
  const poolHome = avaPool.position.clone();
  const CX = (A.course.w - 1) / 2; // the board's middle, in spaces (3 here)

  // ---------------- the timeline (moment seconds) ----------------
  const GO = 0.14;
  const NOTICE = [0.56, 0.7]; // she feels the slope: a glance down, eye wide
  const BRAKE = [0.68, 1.12]; // leaning back, skidding
  const EDGE = 1.12; // stopped, nose over the rim
  const TEETER = [1.12, 1.26];
  const TIP = [1.24, 1.33]; // she pivots over the rim
  const LETGO = 1.32; // she's off the glass: the slab springs back
  const GONE = 1.6;
  const END = 2.78;

  // her slide to the rim: a velocity profile (the slope speeds her up, then she brakes), scaled to end at the rim
  const vel = (T) => {
    if (T < GO) return 0;
    if (T < 0.34) return lerp(0, 2.6, smooth(seg(T, GO, 0.34)));
    if (T < 0.62) return lerp(2.6, 3.5, seg(T, 0.34, 0.62));
    if (T < 0.72) return lerp(3.5, 2.7, seg(T, 0.62, 0.72));
    if (T < 1.02) return lerp(2.7, 0.35, ease.out(seg(T, 0.72, 1.02)));
    return lerp(0.35, 0, seg(T, 1.02, EDGE));
  };
  const DT = 1 / 600;
  const table = [];
  let acc = 0;
  for (let t = 0; t <= EDGE + 1e-9; t += DT) {
    table.push(acc);
    acc += vel(t + DT / 2) * DT;
  }
  const SCALE = 2.5 / acc;
  const slideX = (T) => 4 + SCALE * table[Math.min(table.length - 1, Math.max(0, Math.round(T / DT)))];

  // ---------------- the raft ----------------
  const K = 0.034; // tilt per space of imbalance
  const W = 10.2; // bob frequency (rad/s): a bob every ~0.6 s
  const Z = 2.0; // damping
  let θR = 0; // the tilt at the moment she lets go
  const tilt = (T, xm) => {
    if (T < LETGO) {
      const lean = -K * (xm - 4); // Maya one space east of the middle balances Ava one space west
      const tipping = -0.038 * smooth(seg(T, EDGE - 0.08, LETGO)); // her nose over the rim tips it further
      return lean + tipping;
    }
    const t = T - LETGO;
    return θR * Math.exp(-Z * t) * Math.cos(W * t) * (1 - smooth(seg(T, END - 0.35, END - 0.02)));
  };
  const heave = (T) => {
    if (T < LETGO) return -0.012 * smooth(seg(T, 0.3, 1.1)); // it settles a hair under the moving weight
    const t = T - LETGO;
    return (0.055 * Math.exp(-2.6 * t) * Math.sin(W * 1.15 * t) - 0.012 * Math.exp(-6 * t)) * (1 - smooth(seg(T, END - 0.35, END - 0.02)));
  };
  /** A pose on the board (spaces, own lift) → the world, on the tilted slab. */
  const onRaft = (x, ownLift, θ, h) => {
    const X = x - CX;
    return { x: X * Math.cos(θ) - ownLift * Math.sin(θ) + CX, lift: X * Math.sin(θ) + ownLift * Math.cos(θ) + h };
  };
  const lean = (rot, θ) => ({ pitch: θ * Math.sin(rot), roll: -θ * Math.cos(rot) });

  // ---------------- Maya ----------------
  let free = null; // her world pose when she leaves the glass
  const mayaAct = (T) => {
    const o = { x: 4, ownLift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, eye: 1, eyeW: 1, visible: true };
    if (T < GO) {
      const k = seg(T, 0, GO);
      o.x = 4 - 0.04 * bump(k);
      o.pitch = -0.18 * bump(k);
      o.sy = 1 - 0.08 * bump(k);
      o.sx = 1 + 0.06 * bump(k);
      return o;
    }
    o.x = Math.min(6.5, slideX(Math.min(T, EDGE)));
    // a happy drive...
    o.ownLift = 0.024 * Math.abs(Math.sin((T - GO) * 11)) * (1 - seg(T, ...NOTICE));
    o.pitch = 0.08 * smooth(seg(T, GO, GO + 0.2));
    o.eyeW = 0.62;
    o.eye = 1.2;
    // ...she feels it running away with her: a glance down at the slope, eye wide
    const n = seg(T, ...NOTICE);
    o.pitch += 0.2 * bump(n);
    o.eyeW = lerp(o.eyeW, 2.0, smooth(seg(n, 0.2, 0.6)));
    o.eye = lerp(o.eye, 2.3, smooth(seg(n, 0.2, 0.6)));
    // brakes: leaning back hard, squashed, chattering as she skids
    const b = seg(T, ...BRAKE);
    const hold = smooth(seg(b, 0, 0.2)) * (1 - smooth(seg(T, EDGE, EDGE + 0.06)));
    o.pitch = lerp(o.pitch, -0.34, hold);
    o.sy -= 0.14 * hold;
    o.sx += 0.08 * hold;
    o.roll += 0.035 * Math.sin(T * 95) * hold * (1 - smooth(seg(b, 0.7, 1)));
    // stopped, nose over the rim: she windmills, see-sawing over the edge
    const w = seg(T, ...TEETER);
    if (w > 0) {
      const env = bump(w) ** 0.5;
      o.roll += 0.28 * Math.sin(w * Math.PI * 4) * env;
      o.pitch = lerp(o.pitch, 0.18 * Math.sin(w * Math.PI * 3 + 0.5), env);
      o.x += 0.05 * smooth(w);
      o.eyeW = 2.3;
      o.eye = 2.6;
    }
    // tips over the rim
    const tp = seg(T, ...TIP);
    if (tp > 0) {
      o.pitch = lerp(o.pitch, 1.0, ease.in(tp));
      o.x += 0.18 * ease.in(tp);
      o.ownLift = -0.12 * ease.in(tp);
      o.sy = lerp(o.sy, 1.12, tp);
      o.sx = lerp(o.sx, 0.95, tp);
    }
    return o;
  };

  // ---------------- Ava ----------------
  const avaAct = (T, θ) => {
    const o = { rot: facing(0), pitch: 0, roll: 0, sx: 1, sy: 1, ownLift: 0, eye: 1, slosh: [0, 0] };
    const nerv = smooth(seg(T, 0.45, 0.8)) * (1 - smooth(seg(T, LETGO, LETGO + 0.1)));
    // she grips her space as the slab dips: low, leaning uphill, eye wide, watching Maya
    o.sy -= 0.12 * nerv;
    o.sx += 0.06 * nerv;
    o.roll -= 0.9 * -θ * nerv * 1.6; // leans uphill (west), against the slope
    o.rot = -0.7 * smooth(seg(T, 0.5, 0.85));
    o.eye += 0.9 * nerv;
    o.ownLift += 0;
    if (T >= LETGO) {
      const t = T - LETGO;
      const fade = 1 - smooth(seg(T, END - 0.4, END - 0.04));
      // thrown by the spring-back: she lags the slab, then rocks on her own, longer and looser than it does
      o.roll += 0.3 * Math.exp(-1.7 * t) * Math.sin(W * 0.9 * t - 0.4) * fade;
      o.pitch += 0.12 * Math.exp(-2 * t) * Math.sin(W * 0.7 * t + 1.2) * fade;
      o.ownLift += 0.06 * bump(seg(t, 0.02, 0.24)); // a little hop as the deck drops away under her
      o.sy += 0.07 * Math.exp(-2.2 * t) * Math.sin(W * 1.3 * t) * fade;
      // dazed: her head wobbles round, her light goes woozy
      o.rot = lerp(-0.7, 0, smooth(seg(t, 0.15, 1.2))) + 0.22 * Math.sin(t * 6.5) * Math.exp(-1.2 * t) * fade;
      const woozy = smooth(seg(t, 0.1, 0.3)) * fade;
      o.eye = lerp(1.9, 0.55 + 0.25 * Math.sin(t * 17), woozy) + 0.45 * (1 - fade);
      // her ring sloshes in her base like water in a bowl
      const s = 0.09 * Math.exp(-1.5 * t) * fade;
      o.slosh = [s * Math.sin(W * 0.85 * t - 0.4), s * 0.6 * Math.sin(W * 0.85 * t + 1.0)];
    }
    // and one small hiccup at the end
    const hic = bump(seg(T, END - 0.3, END - 0.18));
    o.sy += 0.09 * hic;
    o.ownLift += 0.025 * hic;
    o.eye += 0.8 * hic;
    return o;
  };

  // ---------------- every frame ----------------
  const t0 = lab.t;
  let T = 0;
  lab.playCard('a', ['m3']);
  const stop = lab.every(() => {
    T = lab.t - t0;
    const m = mayaAct(T);
    if (T < LETGO) θR = tilt(T, m.x);
    const θ = tilt(T, m.x);
    const h = heave(T);
    A.board.rotation.z = θ;
    A.board.position.y = h;
    A.fxGroup.rotation.z = θ;
    A.fxGroup.position.y = h;

    // Maya: on the raft until she lets go, then on her own in the dark
    let mp;
    if (T < LETGO) {
      const w = onRaft(m.x, m.ownLift, θ, h);
      const l = lean(m.rot, θ);
      mp = { x: w.x, lift: w.lift, rot: m.rot, pitch: m.pitch + l.pitch, roll: m.roll + l.roll, sx: m.sx, sy: m.sy, visible: true };
      free = { ...mp, T };
    } else {
      const t = T - free.T;
      mp = {
        x: free.x + 0.55 * t,
        lift: free.lift - 0.6 * t - 6.5 * t * t,
        rot: free.rot,
        pitch: free.pitch + 4.5 * t,
        roll: free.roll + 1.2 * t,
        sx: 0.95,
        sy: 1.12,
        visible: T < GONE,
      };
      m.eye = 2.6 * (1 - smooth(seg(T, GONE - 0.15, GONE)));
      m.eyeW = 2.3;
    }
    maya.set({ ...mp, y: 1, sz: mp.sx });
    if (T < TIP[0] + 0.03) {
      const p = lab.pos(Math.min(m.x, 6.5), 1);
      const last = mb.trail[mb.trail.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.04) mb.trail.push({ x: p.x, z: p.z, t: lab.t });
    }
    maya.look = { ...m, raft: T < LETGO };

    const a = avaAct(T, θ);
    const aw = onRaft(2, a.ownLift, θ, h);
    const al = lean(a.rot, θ);
    ava.set({ x: aw.x, y: 3, lift: aw.lift, rot: a.rot, pitch: a.pitch + al.pitch, roll: a.roll + al.roll, sx: a.sx, sy: a.sy, sz: a.sx });
    ava.look = a;

    // her trail, in the tilted fx layer: fade it out a little early so nothing pops at the hand-over
    const fk = seg(T, END - 0.45, END - 0.02);
    if (fk > 0) for (const p of mb.trail) p.t = Math.min(p.t, lab.t - lerp(lab.t - p.t, 3.25, ease.in(fk)));
  });
  lab.cleanup(() => {
    A.board.rotation.z = 0;
    A.board.position.y = 0;
    A.fxGroup.rotation.z = 0;
    A.fxGroup.position.y = 0;
    avaRing.position.copy(ringHome);
    avaPool.position.copy(poolHome);
  });

  maya.each = (model) => {
    const look = maya.look;
    model.eyeMat.color.setRGB(3.2 * look.eye, 3.1 * look.eye, 2.9 * look.eye);
    if (mayaEye) mayaEye.scale.set(look.eyeW, 1, look.eyeW);
    if (!look.raft) model.poolMat.opacity *= clamp(1 + maya.pose.lift * 3);
    const c = mb.card;
    if (c) {
      // the card lives in the tilted fx layer: put it back in board terms (over the rim once she's past it)
      const at = lab.pos(Math.min(look.x, 6.5), 1);
      c.position.set(at.x, c.position.y - maya.pose.lift + Math.max(0, look.ownLift), at.z);
      const gone = smooth(seg(T, LETGO, GONE));
      c.material.opacity *= 1 - gone;
      c.visible = gone < 0.99;
    }
  };
  ava.each = (model) => {
    const a = ava.look;
    model.eyeMat.color.setRGB(3.2 * a.eye, 3.1 * a.eye, 2.9 * a.eye);
    avaRing.position.set(ringHome.x + a.slosh[0], ringHome.y, ringHome.z + a.slosh[1]);
    avaPool.position.set(poolHome.x + a.slosh[0] * 1.3, poolHome.y, poolHome.z + a.slosh[1] * 1.3);
  };

  await lab.wait(END);
  stop();
  A.board.rotation.z = 0;
  A.board.position.y = 0;
  A.fxGroup.rotation.z = 0;
  A.fxGroup.position.y = 0;
  avaRing.position.copy(ringHome);
  avaPool.position.copy(poolHome);
  mb.trail = [];
  maya.release({ x: 7, y: 1, d: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
