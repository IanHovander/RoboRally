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

/** A ribbon of light like Lumen's trail: flat on the glass, turning to face the camera when it leaves it. */
function makeRibbon(lab, max) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 6);
  const col = new Float32Array(max * 6);
  const uv = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  lab.add(mesh);
  const T = new THREE.Vector3();
  const V = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const sf = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    draw(pts) {
      const n = Math.min(pts.length, max);
      if (n < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        T.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
        V.set(cam.x - p.x, cam.y - p.y, cam.z - p.z).normalize();
        sc.crossVectors(T, V).normalize();
        sf.crossVectors(T, up);
        if (sf.lengthSq() < 1e-6) sf.copy(sc);
        else sf.normalize();
        if (sc.dot(sf) < 0) sc.negate();
        const f = p.flat ?? 1;
        sf.multiplyScalar(f).addScaledVector(sc, 1 - f).normalize();
        pos.set([p.x - sf.x * p.w, p.y - sf.y * p.w, p.z - sf.z * p.w, p.x + sf.x * p.w, p.y + sf.y * p.w, p.z + sf.z * p.w], i * 6);
        col.set([p.r, p.g, p.b, p.r, p.g, p.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const board = arena.board;
  const fx = arena.fxGroup;
  const spill0 = arena.spill.position.x;
  const reset = () => {
    lab.group.rotation.z = 0;
    lab.group.position.y = 0;
    board.rotation.z = 0;
    board.position.y = 0;
    fx.rotation.z = 0;
    fx.position.y = 0;
    arena.spill.position.x = spill0;
  };
  lab.cleanup(reset);
  const pool = ava.group.children.find((o) => o.material === ava.model.poolMat);
  const ring = ava.group.children.find((o) => o.material === ava.model.ringMat && o.geometry.type === 'RingGeometry');

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
  const K_TORQUE = 0.036; // radians of tilt per unit of off-centre weight
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
    const c = lab.bot('a').card;
    if (c) c.material.opacity *= light;
  };
  let gone = false;
  // her trail, drawn on the slab itself so it tilts with it (and fades as it always does, through the end)
  const RED = new THREE.Color('#ff4d6d');
  const trail = makeRibbon(lab, 80);
  const laid = [];
  for (let t = 0.13; t <= T_RIM + 1e-6; t += 1 / 60) laid.push({ x: driveS(t) - 3, t });

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
    const z = onBoard ? 0.55 : 0.13;
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
      const aa = -wa * wa * st.phi - 2 * 0.1 * wa * st.phiv - 1.9 * a;
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
    lab.group.rotation.z = -th;
    lab.group.position.y = hh;
    arena.spill.position.x = spill0 + th * 5;

    {
      const pts = [];
      let i = 0;
      for (const p of laid) {
        if (p.t > t) break;
        const age = Math.min(1, (t - p.t) / 3.2);
        const k = Math.max(0, 1 - age) ** 1.6 * 1.8 * Math.min(1, i / 3);
        pts.push({ x: p.x, y: 0.008, z: -0.5, w: 0.16 + 0.06 * (1 - age), r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
        i++;
      }
      if (t < T_RIM) {
        const k = 1.8;
        pts.push({ x: driveS(t) - 3, y: 0.008, z: -0.5, w: 0.22, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
      }
      trail.draw(pts);
    }

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
        maya.set({ x: p.x, y: 1, lift: p.lift, rot: facing(1), pitch, sy, trail: false });
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
          maya.release({ x: 7, y: 1, on: false });
          // released mid-frame: the game already placed her this frame, so hide her by hand until it catches up
          maya.group.visible = false;
          const c = lab.bot('a').card;
          if (c) c.visible = false;
        }
      }
    }

    // ---- Ava: a passenger on the high side ----
    const pa = onSlab(-1);
    let shiver = 0;
    const ks = seg(t, T_SETTLE - 0.12, T_SETTLE + 0.12);
    if (ks > 0 && ks < 1) shiver = 0.07 * Math.sin(ks * PI * 6) * Math.sin(ks * PI);
    ava.set({ x: pa.x, y: 3, lift: pa.lift, rot: facing(0), roll: th + phi + shiver, pitch: 0.25 * phi * Math.sin(t * 9) });
    // her light sloshes toward the low side like liquid in a tray
    if (pool) pool.position.x = sl * 1.1;
    if (ring) ring.position.x = sl * 0.45;
  });

  await lab.wait(T_END);
  reset();
  if (pool) pool.position.x = 0;
  if (ring) ring.position.x = 0;
  ava.release({ x: 2, y: 3, d: 0 });
  if (!gone) maya.release({ x: 7, y: 1, on: false });
}
