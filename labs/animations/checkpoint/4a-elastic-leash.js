// Checkpoint, idea 4 (The detour), animator a: weight and physical comedy.
export const meta = {
  title: 'Elastic leash',
  idea:
    'Maya lands on flag 1, whips round to aim at flag 2, crouches and launches off on a diagonal no card allows. Her trail stays tied to the flag: it stretches thin and bright like an elastic band, stops her dead a space and a half out, and holds her there scrabbling with her nose down. Then it twangs. She is yanked home backwards, spinning like a yo-yo, overshoots the flag, bounces on the band and clicks round to face east as her red ring drops in at the column\'s foot.',
  notes:
    'Sound: a squeaky glass zip as she launches, the band\'s pitch rising as it stretches, a soft two-note glass "nope" (high-low) at full stretch, then a big rubbery twang and a fast falling whirr as she spins home, a click when she faces east, a little tick as the ring lands. The direction changes every time: she always aims at her own next flag, so the gag teaches the race. Porting: draw the leash from the checkpoint to the robot with the trail\'s own ribbon; the robot never leaves its space in the rules.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const wrap = (a) => {
  const T = Math.PI * 2;
  return ((((a + Math.PI) % T) + T) % T) - Math.PI;
};
const spring = (t, w, z) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

function softLine(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.12, '#555');
  grad.addColorStop(0.32, '#ddd');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.68, '#ddd');
  grad.addColorStop(0.88, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A ribbon of light lying on the glass: update([{x, z, w, k}], color) */
function glassRibbon(lab, N) {
  const { THREE } = lab;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: softLine(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  lab.add(mesh);
  return {
    mesh,
    update(pts, color, y = 0.014) {
      const n = Math.min(N, pts.length);
      if (n < 2) return geo.setDrawRange(0, 0);
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let dx = q.x - o.x;
        let dz = q.z - o.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        pos.set([p.x - dz * p.w, y, p.z + dx * p.w, p.x + dz * p.w, y, p.z - dx * p.w], i * 6);
        const c = p.c ?? color;
        col.set([c.r * p.k, c.g * p.k, c.b * p.k, c.r * p.k, c.g * p.k, c.b * p.k], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const me = lab.bot('a');
  const maya = lab.puppet('a');
  const RED = new THREE.Color(me.color);
  const WHITE = new THREE.Color('#f4efe4');
  const F = lab.pos(4, 1);
  const F2 = lab.pos(1, 3);
  const EAST = facing(1);
  const col1 = arena.columns.find((c) => c.n === 1);
  const col2 = arena.columns.find((c) => c.n === 2);

  // straight at flag 2: a diagonal no card allows
  const ux = (F2.x - F.x) / Math.hypot(F2.x - F.x, F2.z - F.z);
  const uz = (F2.z - F.z) / Math.hypot(F2.x - F.x, F2.z - F.z);
  const AIM = EAST + wrap(Math.atan2(-ux, -uz) - EAST);
  const L = 1.5; // how far the band lets her get
  // home again, spun once more for good measure (the yank twirls her like a yo-yo)
  const HOME = EAST + Math.sign(EAST - AIM) * Math.PI * 2;

  const leash = glassRibbon(lab, 64);
  const hist = [];
  const knot = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: me.model.poolMat.map, color: RED.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  knot.rotation.x = -Math.PI / 2;
  knot.renderOrder = 4;
  const ring = lab.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.8) })));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(F.x, 0.06, F.z);
  ring.visible = false;

  const MOVE = 0.6;
  const TURN = 0.7;
  const CROUCH = 0.86;
  const GO = 0.98;
  const OUT = 0.3; // time to full stretch
  const TAUT = GO + OUT;
  const NOPE = TAUT + 0.12;
  const TWANG = TAUT + 0.34;
  const RING = TWANG + 0.5;
  const END = TWANG + 0.86;

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  const stop = lab.every(() => {
    const now = lab.t;
    const t = now - t0;

    // ---------- Maya ----------
    let s = 0; // how far out along the diagonal she is
    const pose = { x: 4, y: 1, rot: EAST, pitch: 0, roll: 0, lift: 0, sx: 1, sy: 1, sz: 1, trail: true };
    if (t < TURN) {
      const km = seg(t, 0, MOVE);
      pose.x = 2 + 2 * ease.inOut3(km);
      pose.pitch = -0.08 * Math.sin(Math.PI * seg(t, 0, MOVE * 0.5));
      const b = t - MOVE * 0.72;
      if (b > 0) pose.pitch += 0.24 * Math.exp(-b * 8) * Math.sin(b * 15);
    } else {
      pose.trail = false;
      // eager: whips round to face flag 2
      pose.rot = EAST + (AIM - EAST) * spring(t - TURN, 30, 0.5);
      if (t >= CROUCH && t < GO) {
        // anticipation: squash down and rock back
        const c = ease.out(seg(t, CROUCH, GO));
        pose.sy = 1 - 0.2 * c;
        pose.sx = pose.sz = 1 + 0.12 * c;
        pose.pitch = -0.2 * c;
      } else if (t >= GO && t < TAUT) {
        // launch: fast, then the band bites and slows her like a spring
        const k = seg(t, GO, TAUT);
        s = L * Math.sin((Math.PI / 2) * k);
        const v = Math.cos((Math.PI / 2) * k); // her speed, 1 -> 0
        pose.sz = 1 + 0.3 * v;
        pose.sy = 1 - 0.12 * v;
        pose.sx = 1 - 0.08 * v;
        pose.pitch = 0.1 + 0.25 * (1 - v);
      } else if (t >= TAUT && t < TWANG) {
        // held at full stretch, nose down, scrabbling against it
        const k = seg(t, TAUT, TWANG);
        s = L - 0.04 * ease.in(k) + 0.012 * Math.sin(t * 70);
        pose.pitch = 0.36 + 0.04 * Math.sin(t * 50);
        pose.roll = 0.05 * Math.sin(t * 43);
        pose.sz = 1.06;
      } else if (t >= TWANG) {
        // twang: yanked home backwards, over the flag and back, spinning
        const tt = t - TWANG;
        const wd = 12.5;
        const z = 0.3;
        const s0 = L - 0.04;
        s = s0 * Math.exp(-z * (wd / Math.sqrt(1 - z * z)) * tt) * Math.cos(wd * tt);
        s *= 1 - seg(t, END - 0.2, END - 0.02);
        const spin = spring(tt - 0.02, 15, 0.72);
        pose.rot = AIM + (HOME - AIM) * spin;
        // whiplash: her top lags behind the yank, then flops forward
        pose.pitch = 0.36 * Math.exp(-tt * 9) * Math.cos(tt * 20);
        pose.lift = 0.08 * Math.sin(Math.PI * seg(tt, 0, 0.2));
        pose.sy = 1 + 0.08 * Math.exp(-tt * 6) * Math.sin(tt * 26);
        pose.sx = pose.sz = 1 - (pose.sy - 1) * 0.6;
        // the ring lands: a little settle
        if (t > RING + 0.1) pose.sy *= 1 - 0.05 * Math.sin(Math.PI * seg(t, RING + 0.1, RING + 0.3));
      }
      pose.x = 4 + ux * s;
      pose.y = 1 + uz * s;
    }
    maya.set(pose);
    const eager = t > TURN && t < TWANG ? 1 : 0;
    maya.each = (m) => {
      const g = 1 + 0.8 * eager;
      m.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g);
    };

    // ---------- the leash: her trail stays tied to the flag ----------
    const P = lab.pos(pose.x, pose.y);
    const dx = P.x - F.x;
    const dz = P.z - F.z;
    const len = Math.hypot(dx, dz);
    if (t > TURN) hist.push({ x: P.x, z: P.z, t });
    const show = t < TURN + 0.05 ? 0 : 1;
    if (t >= TWANG) {
      // released: the band snaps back after her like a ribbon, whipping, shortening and fading
      const after = t - TWANG;
      const span = 0.2;
      const recent = hist.filter((h) => t - h.t <= span);
      const nx = -uz;
      const nz = ux;
      const fadeAll = 1 - seg(after, 0.35, 0.6);
      const pts = [];
      const n = recent.length;
      for (let j = 0; n > 1 && j <= 32; j++) {
        const f = j / 32; // 0 tail .. 1 at her
        const q = f * (n - 1);
        const i = Math.min(n - 2, Math.floor(q));
        const u = q - i;
        const a = recent[i];
        const b = recent[i + 1];
        const age = (t - (a.t + (b.t - a.t) * u)) / span;
        const off = 0.16 * Math.exp(-after * 5) * Math.sin(Math.PI * f) * Math.sin(f * 9 - after * 40);
        pts.push({ x: a.x + (b.x - a.x) * u + nx * off, z: a.z + (b.z - a.z) * u + nz * off, w: 0.12 * (0.4 + 0.6 * f), k: 2.2 * Math.max(0, 1 - age) ** 1.3 * fadeAll });
      }
      leash.update(pts, RED);
    } else if (show > 0 && len > 0.02) {
      const tension = clamp01((Math.abs(s) - 0.35) / (L - 0.35));
      const nx = -dz / len;
      const nz = dx / len;
      const nope = Math.max(0, 1 - Math.abs(t - NOPE - 0.04) / 0.08);
      const after = t > TWANG ? t - TWANG : -1;
      const pts = [];
      const M = 48;
      for (let i = 0; i <= M; i++) {
        const f = i / M;
        // slack: a lazy curve; taut: straight, humming; released: a big decaying twang
        let off = 0.18 * (1 - tension) * Math.sin(Math.PI * f) * (t < TWANG ? 1 : 0);
        if (t >= TAUT && t < TWANG) off += 0.025 * Math.sin(Math.PI * f) * Math.sin(t * 90);
        if (after >= 0) off += 0.22 * Math.exp(-after * 7) * Math.sin(Math.PI * 2 * f) * Math.sin(after * 48);
        const w = (0.17 - 0.07 * tension) * (after >= 0 ? 1 + 0.4 * Math.exp(-after * 6) : 1);
        const k = (1.2 + 1.1 * tension + 1.8 * nope) * show * (0.6 + 0.4 * f);
        pts.push({ x: F.x + dx * f + nx * off, z: F.z + dz * f + nz * off, w, k, c: nope > 0 ? RED.clone().lerp(WHITE, nope * 0.8) : RED });
      }
      leash.update(pts, RED);
    } else leash.update([], RED);

    // ---------- the flags ----------
    if (col2) {
      // flag 2 brightens while she has her eye on it, and is snuffed back to normal by the "nope"
      const want = t > TURN ? seg(t, TURN, TURN + 0.15) * (1 - seg(t, NOPE, NOPE + 0.2)) : 0;
      col2.mat.color.multiplyScalar(1 + 1.6 * want);
      col2.col.scale.x = 1 + 0.35 * want;
    }
    // the knot: where the band is tied to the flag
    knot.position.set(F.x, 0.05, F.z);
    knot.material.opacity = show * (t > TURN ? 0.9 : 0);
    knot.scale.setScalar(0.3 + 0.25 * clamp01((Math.abs(s) - 0.35) / (L - 0.35)));
    if (col1) {
      // the column is the post the band is tied to: it leans toward her as she pulls, and wobbles when she lets go
      const pull = t < TWANG ? clamp01((s - 0.6) / (L - 0.6)) : 0;
      const wob = t >= TWANG ? Math.exp(-(t - TWANG) * 6) * Math.sin((t - TWANG) * 26) : 0;
      col1.col.rotation.z = 0.1 * pull - 0.08 * wob;
      // a white glint as she lands on it, then the real claim when she is home: her colour
      const glint = t > MOVE - 0.02 ? Math.max(0, 1 - (t - MOVE + 0.02) / 0.35) : 0;
      const claim = t > RING ? Math.max(0, 1 - (t - RING) / 0.7) ** 1.4 : 0;
      col1.mat.color.lerp(RED, claim * 0.7).multiplyScalar(1 + 0.8 * glint + 1.6 * claim);
      col1.col.scale.x = 1 + 0.4 * claim;
    }
    if (t > RING) {
      ring.visible = true;
      const kd = seg(t, RING, RING + 0.3);
      const h = kd < 0.55 ? 0.45 * (1 - (kd / 0.55) ** 2) : 0.07 * Math.sin(Math.PI * ((kd - 0.55) / 0.45));
      ring.position.y = 0.06 + h;
    }
  });

  await lab.wait(END);
  stop();
  leash.mesh.visible = false;
  knot.visible = false;
  if (col1) col1.col.rotation.z = 0;
  ring.visible = false;
  arena.setTaken([{ cp: 1, color: me.color }]);
  lab.cleanup(() => arena.setTaken([]));
  maya.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
}
