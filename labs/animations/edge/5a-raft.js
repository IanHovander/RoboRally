// Edge, idea 5 (Raft), animator a: weight & physical comedy.
export const meta = {
  title: 'Raft',
  idea:
    'The slab really is floating. As Maya drives east it sinks and tilts under her like a raft, steeper the further out she gets, and Ava, riding the high side, leans with it. ' +
    'At the rim the edge sags under her like a diving board, she tips over it, and the instant her weight leaves, the slab springs back and the rising edge flicks her tail up: ' +
    'she somersaults off into the dark and goes out. The slab overshoots past level, bobs twice and settles, while Ava wobbles on her space like a seasick passenger, ' +
    'the pool of her light sloshing from side to side, then gives a little shake and faces front.',
  notes:
    'Sound: a low glass creak that rises in pitch with the tilt, a "boing" of the edge as it springs back, two soft sloshing glass tones for the bobs, a tiny shiver chime for Ava. ' +
    'The tilt is a spring-damper chasing the robots\' torque about the slab\'s centre (so it lags and overshoots by itself, and it scales with where on the board she leaves); ' +
    'Ava\'s lean and the slosh of her light are two softer springs riding on it. arena.board and arena.fxGroup (her trail, the card) tilt together; robots get the matching lift and lean.',
};

const PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const board = arena.board;
  const fx = arena.fxGroup;
  const spill0 = arena.spill.position.x;
  const reset = () => {
    board.rotation.z = 0;
    board.position.y = 0;
    fx.rotation.z = 0;
    fx.position.y = 0;
    arena.spill.position.x = spill0;
  };
  lab.cleanup(reset);
  const pool = ava.group.children.find((o) => o.material === ava.model.poolMat);

  // ---------------- timeline ----------------
  const T_RIM = 0.95; // her centre reaches the rim
  const T_LEAVE = 1.09; // her tail leaves the edge
  const T_GONE = 1.45; // her light is out in the dark below
  const T_SETTLE = 2.42; // everything forced exactly level by here
  const T_END = 2.66;
  const driveS = (t) => {
    if (t < 0.13) return 4 - 0.07 * ease.out(t / 0.13);
    const k = Math.min(1, (t - 0.13) / (T_RIM - 0.13));
    return 3.93 + 2.57 * (0.42 * k + 0.58 * k * k); // downhill: she picks up speed
  };

  // ---------------- the springs ----------------
  const st = { th: 0, thv: 0, h: 0, hv: 0, phi: 0, phiv: 0, sl: 0, slv: 0 };
  const K_TORQUE = 0.031; // radians of tilt per unit of off-centre weight
  let flick = null; // when the edge springs up under her tail
  const t0 = lab.t;
  lab.playCard('a', ['m3']);

  // Maya on the slab: s along the slab (spaces), then free in the world
  let free = null; // her state once the edge lets go
  const base = maya.model.paint.emissiveIntensity;
  maya.model.paint.transparent = true;
  let light = 1;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * light, 3.1 * light, 2.9 * light);
    m.ringMat.opacity = 0.9 * light;
    m.poolMat.opacity = 0.75 * light;
    m.paint.opacity = Math.min(1, light * 1.4);
    m.paint.emissiveIntensity = base * light;
  };
  let gone = false;

  lab.every((dt) => {
    const t = lab.t - t0;
    // ---- what the slab feels: Maya's weight off-centre (Ava's is balanced by Maya's at the start) ----
    let xm = driveS(Math.min(t, T_RIM)) - 3;
    if (t > T_RIM) xm = 3.5; // pressing on the very edge
    const onBoard = t < T_LEAVE;
    const thTarget = onBoard ? K_TORQUE * (xm - 1) * (1 + 0.6 * seg(t, T_RIM - 0.05, T_LEAVE)) : 0;
    const hTarget = onBoard ? -0.035 * seg(xm, 1, 3.5) : 0;
    // loaded, the slab is heavy and slow; let go, it is a lively spring
    const w = onBoard ? 8 : 10.5;
    const z = onBoard ? 0.55 : 0.17;
    const N = 6;
    const h = dt / N;
    let thAcc = 0;
    for (let i = 0; i < N; i++) {
      const a = w * w * (thTarget - st.th) - 2 * z * w * st.thv;
      st.thv += a * h;
      st.th += st.thv * h;
      thAcc = a;
      const ah = 11 * 11 * (hTarget - st.h) - 2 * (onBoard ? 0.6 : 0.2) * 11 * st.hv;
      st.hv += ah * h;
      st.h += st.hv * h;
      // Ava's body lags the slab and wobbles back (a softer spring, pushed by the slab's angular acceleration)
      const wa = 8.5;
      const aa = -wa * wa * st.phi - 2 * 0.11 * wa * st.phiv - 0.9 * a;
      st.phiv += aa * h;
      st.phi += st.phiv * h;
      // the pool of her light sloshes like liquid in a tray: it chases the tilt, late and loose
      const ws = 6;
      const as = ws * ws * (st.th * 3.2 - st.sl) - 2 * 0.12 * ws * st.slv;
      st.slv += as * h;
      st.sl += st.slv * h;
    }
    void thAcc;
    // everything comes exactly to rest at the end
    const calm = 1 - ease.inOut(seg(t, T_SETTLE - 0.35, T_SETTLE));
    const th = st.th * calm;
    const hh = st.h * calm;
    const phi = st.phi * calm;
    const sl = st.sl * calm;
    board.rotation.z = -th;
    board.position.y = hh;
    fx.rotation.z = -th;
    fx.position.y = hh;
    arena.spill.position.x = spill0 + th * 5;

    // a point on the slab at world x, carried by the tilt and heave
    const onSlab = (x) => ({ x: x * Math.cos(th) + 3, lift: -x * Math.sin(th) + hh });

    // ---- Maya ----
    if (!gone) {
      if (t < T_RIM) {
        const s = driveS(t);
        const p = onSlab(s - 3);
        let pitch = th;
        let sy = 1;
        if (t < 0.13) {
          const k = ease.out(t / 0.13);
          pitch -= 0.16 * k;
          sy = 1 - 0.07 * k;
        } else pitch -= 0.16 * (1 - seg(t, 0.13, 0.45)) ** 2;
        maya.set({ x: p.x, y: 1, lift: p.lift, rot: facing(1), pitch, sy, trail: true });
      } else if (t < T_LEAVE) {
        // the tip: her nose goes over the sagging edge
        const k = seg(t, T_RIM, T_LEAVE);
        const s = 6.5 + 0.32 * k;
        const p = onSlab(Math.min(3.5, s - 3));
        const over = s - 6.5;
        maya.set({ x: p.x + over, y: 1, lift: p.lift - over * Math.sin(th) - 0.05 * k * k, rot: facing(1), pitch: th + 0.55 * ease.in(k), sy: 1, trail: false });
      } else {
        if (!free) {
          // the edge springs up under her tail: a flick that flips her forward
          flick = t;
          free = { x: maya.pose.x, lift: maya.pose.lift, pitch: maya.pose.pitch, vx: 2.2, vy: 1.3, w: 9.5 };
        }
        const d = t - flick;
        const x = free.x + free.vx * d;
        const lift = free.lift + free.vy * d - 0.5 * 13 * d * d;
        light = 1 - seg(t, T_LEAVE + 0.12, T_GONE);
        maya.set({ x, y: 1, lift, rot: facing(1) + 0.4 * d, pitch: free.pitch + free.w * d, roll: 0.3 * d, trail: false, visible: t < T_GONE });
        if (t >= T_GONE) {
          gone = true;
          // hidden, and handed back near her trail's end so the game lets the trail fade by itself
          maya.release({ x: 6, y: 1, on: false });
        }
      }
    }

    // ---- Ava: a passenger on the high side ----
    const pa = onSlab(-1);
    let shiver = 0;
    const ks = seg(t, T_SETTLE - 0.12, T_SETTLE + 0.12);
    if (ks > 0 && ks < 1) shiver = 0.07 * Math.sin(ks * PI * 6) * Math.sin(ks * PI);
    ava.set({ x: pa.x, y: 3, lift: pa.lift, rot: facing(0), roll: th + phi + shiver, pitch: 0.25 * phi * Math.sin(t * 9) });
    if (pool) pool.position.x = sl * 0.18;
  });

  await lab.wait(T_END);
  reset();
  if (pool) pool.position.x = 0;
  ava.release({ x: 2, y: 3, d: 0 });
  if (!gone) maya.release({ x: 6, y: 1, on: false });
}
