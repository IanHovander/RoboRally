// Idea 25, "Ribbon", through the lens of weight. Maya's trail of light is a real ribbon with mass, tied to
// the back of her ring: a rope simulation lying on the glass (friction, a little stiffness, it can't pass
// through her ring). Moving pays it out behind her as usual. Turning lays it too, so the trail records
// turns: Rotate Right whips round past the turn and back, and the flick flings a quarter curl of ribbon
// out beside her. Move Back lays nothing: she reverses on a short leash, the curl is dragged taut and
// straight, and when it snaps tight a shiver of light runs down it (and the tug rocks her). The U-Turn spins
// her with a whip: fresh ribbon winds round her ring, the old line hugs the other side, and the loop
// cinches closed at her feet like a tied bow, then fades on the trail's own schedule.
export const meta = {
  title: 'Ribbon',
  idea:
    'Her trail is a gymnast\'s ribbon with real weight, tied to her ring. Move 2 pays it out straight. Rotate Right whips past the turn and back, flinging a quarter curl of ribbon out beside her. Move Back drags the curl until it snaps taut, a shiver of light running down it (the tug rocks her). The U-Turn winds a loop round her ring that cinches like a bow at her feet, then fades on schedule.',
  notes:
    'Lens: weight. A verlet rope on the glass (friction, bending stiffness, collision with her ring), so drags, whips and tugs come from physics rather than keyframes. The ribbon is drawn like Lumen\'s trail (same soft cross-section, her colour, additive, same 3.2 s fade by when each bit was laid); crossings glow brighter. Sound: a soft silk swish on the flick, a taut glassy "thrum" when the line snaps tight, a little bell-like tink when the bow cinches. Adds no time.',
};

const TAU = Math.PI * 2;

/** A spring-damper on the body: it rocks on its foot from the base's acceleration (forward, sideways, turning). */
function suspension(lab, p, { k = 200, c = 10, lean = 0.028, side = 0.02, twist = 0.05 } = {}) {
  const s = { pitch: 0, vp: 0, roll: 0, vr: 0, yaw: 0, vyaw: 0 };
  let prev = null;
  s.stop = lab.every((dt) => {
    if (dt <= 1e-5) return;
    const q = p.pose;
    const cur = { x: q.x, y: q.y, r: q.rot };
    if (!prev) {
      prev = { ...cur, vx: 0, vy: 0, w: 0 };
      return;
    }
    const vx = (cur.x - prev.x) / dt;
    const vy = (cur.y - prev.y) / dt;
    const w = (cur.r - prev.r) / dt;
    const ax = (vx - prev.vx) / dt;
    const ay = (vy - prev.vy) / dt;
    const aw = (w - prev.w) / dt;
    prev = { ...cur, vx, vy, w };
    const fx = -Math.sin(cur.r);
    const fy = -Math.cos(cur.r);
    const aF = ax * fx + ay * fy;
    const aR = ax * -fy + ay * fx;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    const drive = { p: clamp(-aF * lean, 6), r: clamp(-aR * side, 6), y: clamp(-aw * twist * 0.02, 8) };
    const n = 6;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.vp += (-k * s.pitch - c * s.vp + drive.p * k * 0.06) * h;
      s.pitch += s.vp * h;
      s.vr += (-k * s.roll - c * s.vr + drive.r * k * 0.06) * h;
      s.roll += s.vr * h;
      s.vyaw += (-k * 0.8 * s.yaw - c * 0.8 * s.vyaw + drive.y * k) * h;
      s.yaw += s.vyaw * h;
    }
  });
  return s;
}

/** The soft cross-section of Lumen's trail (bright in the middle). */
function trailTexture(THREE) {
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const bot = lab.bot('a');
  const sus = suspension(lab, maya);
  maya.set({ trail: false }); // the ribbon is her trail now
  const color = new THREE.Color(bot.color);
  const origin = lab.pos(0, 0);

  // ----- the rope -----
  const SEG = 0.05; // rest length between nodes (spaces)
  const R = 0.5; // her ring's radius on the glass
  const LIFE = 3.2; // the game's trail life
  const MAX = 260;
  const FLING = 0.015; // the flick's speed per sub-step
  const rope = []; // nodes from the knot (0) to the tail: { x, y, px, py, t }
  const st = { mode: 'payout', clock: 0, friction: 7, shiver: null, cinch: 0, knot: { x: 1, y: 2 }, center: { x: 1, y: 2 }, taut: 0, onTaut: null, bow: null };

  const knotAt = () => {
    const q = maya.pose;
    // the back of her ring (opposite the pointer)
    return { x: q.x + Math.sin(q.rot) * R, y: q.y + Math.cos(q.rot) * R };
  };
  {
    const k = knotAt();
    rope.push({ x: k.x, y: k.y, px: k.x, py: k.y, t: 0 }, { x: k.x, y: k.y, px: k.x, py: k.y, t: 0 });
  }
  st.knot = knotAt();
  /** The bow's shape at her feet (she faces north, so her back and the knot are south): two loops either side of the knot. */
  function bowPoints(cx, cy) {
    const kx = cx;
    const ky = cy + R; // the knot
    const dense = [];
    const a = 0.56; // how far each loop reaches sideways
    const b = 0.26; // how fat the loops are
    const c = 0.22; // the loops droop toward us
    for (let j = 0; j <= 400; j++) {
      const s = (j / 400) * TAU;
      const u = a * Math.sin(s);
      const v = b * Math.sin(2 * s) * 0.5 * Math.sign(Math.sin(s) || 1) + c * Math.abs(Math.sin(s)) + 0.03;
      dense.push({ x: kx + u, y: ky + v });
    }
    const out = [];
    let acc = 0;
    let want = SEG;
    for (let j = 1; j < dense.length; j++) {
      const d = Math.hypot(dense[j].x - dense[j - 1].x, dense[j].y - dense[j - 1].y);
      acc += d;
      while (acc >= want) {
        out.push(dense[j]);
        want += SEG;
      }
    }
    return out;
  }

  let released = false;
  const final = { x: 3, y: 1, rot: facing(0) };

  const stopSim = lab.every((dt) => {
    if (dt <= 1e-5) return;
    st.clock += dt;
    const q = released ? final : maya.pose;
    const cx = q.x;
    const cy = q.y;
    st.center = { x: cx, y: cy };
    const kx = cx + Math.sin(q.rot) * R;
    const ky = cy + Math.cos(q.rot) * R;
    const steps = 4;
    const h = dt / steps;
    const k0 = { x: st.knot.x, y: st.knot.y };
    let maxPull = 0;
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const knx = k0.x + (kx - k0.x) * f;
      const kny = k0.y + (ky - k0.y) * f;
      // integrate (verlet) with glass friction
      const keep = Math.exp(-st.friction * h);
      for (let i = 1; i < rope.length; i++) {
        const n = rope[i];
        let vx = (n.x - n.px) * keep;
        let vy = (n.y - n.py) * keep;
        // tying the bow: the freshest ribbon is pulled (springily) into two loops at her feet
        if (st.bow && i <= st.bow.pts.length) {
          const T = st.bow.pts[i - 1];
          vx += (T.x - n.x) * st.bow.k * h * h;
          vy += (T.y - n.y) * st.bow.k * h * h;
        }
        n.px = n.x;
        n.py = n.y;
        n.x += vx;
        n.y += vy;
      }
      // the knot
      const n0 = rope[0];
      n0.px = n0.x;
      n0.py = n0.y;
      n0.x = knx;
      n0.y = kny;
      // paying out: new ribbon comes off the knot, laid on the glass
      if (st.mode === 'payout' && rope.length > 1) {
        let guard = 0;
        while (guard++ < 20 && rope.length < MAX) {
          const a = rope[1];
          const dx = n0.x - a.x;
          const dy = n0.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d <= SEG) break;
          const nx = a.x + (dx / d) * SEG;
          const ny = a.y + (dy / d) * SEG;
          rope.splice(1, 0, { x: nx, y: ny, px: nx, py: ny, t: st.clock });
        }
      }
      // constraints
      for (let it = 0; it < 10; it++) {
        for (let i = 0; i < rope.length - 1; i++) {
          if (i === 0 && st.mode === 'payout') continue;
          const a = rope[i];
          const b = rope[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d <= SEG || d < 1e-9) continue; // a rope: it only resists stretching
          const over = d - SEG;
          if (i === 0) {
            b.x -= (dx / d) * over;
            b.y -= (dy / d) * over;
            if (it === 0) maxPull = Math.max(maxPull, over);
          } else {
            b.x -= (dx / d) * over * 0.5;
            b.y -= (dy / d) * over * 0.5;
            a.x += (dx / d) * over * 0.5;
            a.y += (dy / d) * over * 0.5;
          }
        }
        // a little stiffness: no sharp kinks
        for (let i = 1; i < rope.length - 2; i++) {
          const a = rope[i];
          const b = rope[i + 2];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const min = SEG * 1.86;
          if (d >= min || d < 1e-9) continue;
          const push = (min - d) * 0.25;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
        // her ring is solid: the ribbon wraps round it, never through
        for (let i = 2; i < rope.length; i++) {
          const n = rope[i];
          const dx = n.x - cx;
          const dy = n.y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= R + 0.03 || d < 1e-9) continue;
          n.x = cx + (dx / d) * (R + 0.03);
          n.y = cy + (dy / d) * (R + 0.03);
        }
      }
    }
    st.knot = { x: kx, y: ky };
    st.taut = maxPull;
    if (st.onTaut && maxPull > 0.004) {
      const fn = st.onTaut;
      st.onTaut = null;
      fn();
    }
    // the faded tail is gone
    while (rope.length > 2 && st.clock - rope[rope.length - 1].t > LIFE) rope.pop();
    draw();
  });

  // ----- drawing it like Lumen's trail -----
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 2 * 3);
  const col = new Float32Array(MAX * 2 * 3);
  const uv = new Float32Array(MAX * 2 * 2);
  for (let i = 0; i < MAX; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < MAX - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = lab.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: trailTexture(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;

  function draw() {
    const n = rope.length;
    if (n < 2) {
      geo.setDrawRange(0, 0);
      return;
    }
    const t = st.clock;
    // the shiver: a pulse of light and a ripple running from the knot down the line
    const sh = st.shiver;
    const shK = sh ? (t - sh.t0) / sh.dur : 2;
    if (sh && shK > 1.2) st.shiver = null;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const p = rope[i];
      const qn = rope[Math.min(n - 1, i + 1)];
      const o = rope[Math.max(0, i - 1)];
      let dx = qn.x - o.x;
      let dy = qn.y - o.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      if (i > 0) along += Math.hypot(p.x - o.x, p.y - o.y);
      const age = (t - p.t) / LIFE;
      const fromTail = n - 1 - i;
      let fade = Math.max(0, 1 - age) ** 1.6 * Math.min(1, fromTail / 3) * Math.min(1, 0.35 + i / 4);
      let ripple = 0;
      if (sh && shK <= 1.2) {
        const front = shK * sh.reach;
        const dd = along - front;
        const env = Math.exp(-(dd * dd) / 0.05);
        fade = fade * (1 + 2.2 * env) + 0.35 * env;
        ripple = Math.sin(along * 38 - t * 40) * 0.035 * env;
      }
      const w = 0.12 + 0.05 * Math.max(0, 1 - age);
      const wx = p.x + origin.x - dy * ripple;
      const wz = p.y + origin.z + dx * ripple;
      pos.set([wx - dy * w, 0.008, wz + dx * w, wx + dy * w, 0.008, wz - dx * w], i * 6);
      // the knot flares as the bow cinches
      const nearKnot = Math.exp(-((p.x - st.knot.x) ** 2 + (p.y - st.knot.y) ** 2) / 0.015);
      const k = fade * 1.8 * (1 + 1.5 * st.cinch * nearKnot);
      col.set([color.r * k, color.g * k, color.b * k, color.r * k, color.g * k, color.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, (n - 1) * 6);
  }

  maya.each = (model) => {
    model.body.rotation.set(-sus.pitch, sus.yaw, -sus.roll);
  };

  // ================= Move 2: paid out straight behind her =================
  lab.playCard('a', ['m2']);
  await lab.wait(0.14);
  await lab.tween(0.62, (e) => maya.set({ x: 1 + 2 * e }), ease.inOut);
  await lab.wait(0.12);

  // ================= Rotate Right: a whip past the turn, and the flick flings a curl out =================
  lab.playCard('a', ['rr']);
  await lab.wait(0.14);
  const r0 = facing(1);
  const r1 = facing(2);
  await lab.tween(0.2, (e) => maya.set({ rot: r0 + (r1 - 0.45 - r0) * e }), ease.in);
  // she checks the swing: the knot reverses and the freshly laid ribbon flies on, outward
  st.friction = 3.2;
  {
    const c = st.center;
    let m = 0;
    while (m + 1 < rope.length && st.clock - rope[m + 1].t < 0.3) m++;
    for (let i = 1; i <= m; i++) {
      const n = rope[i];
      const dx = n.x - c.x;
      const dy = n.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      // outward and onward (clockwise round her), strongest in the middle of the fresh curl
      const w = Math.sin((Math.PI * i) / (m + 1)) * FLING;
      n.px = n.x - (dx / d) * w - (-dy / d) * w * 0.6;
      n.py = n.y - (dy / d) * w - (dx / d) * w * 0.6;
    }
  }
  await lab.tween(0.2, (e) => maya.set({ rot: r1 - 0.45 + 0.45 * e }), ease.outBack);
  maya.set({ rot: r1 });
  await lab.wait(0.08);
  st.friction = 7;

  // ================= Move Back: on a short leash, the curl is dragged taut =================
  lab.playCard('a', ['bk']);
  await lab.wait(0.14);
  st.mode = 'tied';
  st.friction = 9;
  let tugged = false;
  st.onTaut = () => {
    tugged = true;
    // it snaps tight: a shiver of light down the line, and the tug rocks her
    let reach = 0;
    for (let i = 1; i < rope.length; i++) reach += Math.hypot(rope[i].x - rope[i - 1].x, rope[i].y - rope[i - 1].y);
    st.shiver = { t0: st.clock, dur: 0.45, reach: Math.min(reach, 3) };
    sus.vp += 3.2;
  };
  await lab.tween(0.5, (e) => maya.set({ y: 2 - e }), ease.inOut);
  maya.set({ y: 1 });
  if (!tugged) st.onTaut?.();
  st.onTaut = null;
  await lab.wait(0.1);

  // ================= U-Turn: she whips round, fresh ribbon winds round her ring, and the bow cinches =================
  lab.playCard('a', ['ut']);
  await lab.wait(0.14);
  st.mode = 'payout';
  st.friction = 6;
  const u0 = facing(2);
  const u1 = facing(2) - Math.PI;
  await lab.tween(0.34, (e) => maya.set({ rot: u0 + (u1 - 0.4 - u0) * e }), ease.inOut);
  st.mode = 'tied';
  await lab.tween(0.2, (e) => maya.set({ rot: u1 - 0.4 + 0.4 * e }), ease.outBack);
  maya.set({ rot: u1 });
  // the momentum carries the fresh ribbon on, and it flops into a bow at her feet (springy, then still)
  st.bow = { pts: bowPoints(final.x, final.y), k: 0 };
  st.friction = 2.5;
  await lab.tween(0.3, (e) => (st.bow.k = 420 * e), ease.out);
  // the cinch: the knot pulls tight with a little flare
  st.friction = 8;
  lab.tween(0.32, (e, k) => (st.cinch = Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (1 - k) ** 1.3), ease.linear);
  await lab.wait(0.1);

  sus.stop();
  maya.each = null;
  maya.model.body.rotation.set(0, 0, 0);
  released = true;
  maya.release({ x: 3, y: 1, d: 0 });
  void stopSim;
  void TAU;
}
