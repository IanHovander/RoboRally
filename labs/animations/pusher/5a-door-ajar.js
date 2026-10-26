// Pusher 5a: The door left ajar (idea 1), through the lens of weight and physical comedy.
export const meta = {
  title: 'Draught from next door',
  idea:
    'There is no plate. The wall behind the panel unlatches with a tiny jolt and its two halves swing back a crack: a much brighter room is behind it. A wedge of warm light pours out across the glass like spilled water, its front running toward us and over the slab\'s edge, dust motes lit up in it, Maya\'s long shadow stretching toward the camera, the edge of it just catching Ava\'s polish. The light leans on Maya, she gets light as a leaf and is carried one space south, swaying side to side, pointer always east. Then the doors ease shut, the light drains back into the crack, the motes go dark wherever it leaves them, and the last few settle on the glass.',
  notes:
    'Sound: a soft latch click, a low airy whoosh with a faint far-off murmur from the bright room, a slow glassy swish for each sway, then the hush as the doors meet and a tiny settle. The wedge is a grid of vertex colours computed each frame: brightness falls off with distance and toward its edges, and Maya\'s shadow is cut out of it from the crack\'s point of view, so it widens and stretches as she drifts. Motes only show where the light is, so they appear as the wedge sweeps over them and vanish when it leaves. A warm spot light from the crack adds the gleam on her and on Ava. The room dims a little while the door is open and comes back exactly as it was.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const EAST = lab.facing(1);
  const pusher = arena.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;

  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => {
    const k = clamp01((x - a) / (b - a));
    return k * k * (3 - 2 * k);
  };
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const WARM = new THREE.Color('#ffd9a8');

  // ---------- take the wall and the panel over: two door leaves ----------
  const housing = plate.parent;
  const wallZ = -1.0; // the north edge of space (3,1)
  let fin = null;
  arena.board.traverse((o) => {
    if (!fin && o.isGroup && o !== housing && Math.abs(o.position.x) < 0.01 && Math.abs(o.position.z - wallZ) < 0.01 && o.children.length === 2) fin = o;
  });
  const back = housing.children.find((c) => c !== plate);
  housing.visible = false;
  if (fin) fin.visible = false;
  lab.cleanup(() => {
    housing.visible = true;
    if (fin) fin.visible = true;
  });
  const finMat = fin?.children[0].material ?? new THREE.MeshStandardMaterial({ color: 0x1b2028 });
  const capMat = fin?.children[1].material ?? new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leaves = [-1, 1].map((side) => {
    // side -1: hinged at the west end, its free edge in the middle
    const pivot = lab.add(new THREE.Group());
    pivot.position.set(side * 0.49, 0, wallZ);
    const dir = -side; // toward the middle
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.26, 0.035), finMat);
    f.position.set(dir * 0.245, 0.13, 0);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.012, 0.038), capMat);
    c.position.set(dir * 0.245, 0.262, 0);
    const hg = new THREE.BoxGeometry(0.39, 0.26, 0.05);
    const uv = hg.attributes.uv;
    for (let i = 16; i < 20; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5); // each half shows its half of the register dots
    const h = new THREE.Mesh(hg, back?.material ?? finMat);
    h.position.set(dir * (0.49 - 0.195), 0.16, 0.07);
    // the bright edge where light gets in
    const edgeMat = new THREE.MeshBasicMaterial({ color: hdr(WARM, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.27, 0.09), edgeMat);
    edge.position.set(dir * 0.487, 0.135, 0.03);
    for (const m of [f, c, h]) m.castShadow = true;
    pivot.add(f, c, h, edge);
    return { pivot, side, edgeMat };
  });
  // the light seen through the crack: a sheet between the two free edges
  const crackMat = new THREE.MeshBasicMaterial({ color: hdr(WARM, 4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const crack = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 0.26), crackMat));

  // ---------- the wedge of light on the glass ----------
  const NU = 34;
  const NV = 41;
  const L = 3.02; // from the wall to just past the south edge
  const wedgeGeo = new THREE.BufferGeometry();
  const wPos = new Float32Array(NU * NV * 3);
  const wCol = new Float32Array(NU * NV * 3);
  wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wedgeGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
  const idx = [];
  for (let i = 0; i < NU - 1; i++)
    for (let j = 0; j < NV - 1; j++) {
      const a = i * NV + j;
      idx.push(a, a + NV, a + 1, a + 1, a + NV, a + NV + 1);
    }
  wedgeGeo.setIndex(idx);
  const wedge = lab.add(new THREE.Mesh(wedgeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  wedge.frustumCulled = false;
  wedge.renderOrder = 2;
  // light pouring over the slab's front edge
  const pourCanvas = document.createElement('canvas');
  pourCanvas.width = 8;
  pourCanvas.height = 64;
  {
    const g = pourCanvas.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 64);
  }
  const pourTex = new THREE.CanvasTexture(pourCanvas);
  pourTex.colorSpace = THREE.SRGBColorSpace;
  const pourMat = new THREE.MeshBasicMaterial({ map: pourTex, color: hdr(WARM, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pourGeo = new THREE.PlaneGeometry(1, 0.36);
  pourGeo.translate(0, -0.18, 0);
  const pour = lab.add(new THREE.Mesh(pourGeo, pourMat));
  pour.position.set(0, 0, 2.003);

  // a warm spot from the crack: the gleam on her polish, and the edge of it on Ava's
  const spot = new THREE.SpotLight(WARM, 0, 0, 0.75, 0.7, 1.0);
  spot.position.set(0, 0.24, -1.35);
  spot.target.position.set(0, 0, 1.4);
  lab.add(spot);
  lab.add(spot.target);

  // ---------- motes ----------
  const NM = 90;
  const motes = [];
  const mPos = new Float32Array(NM * 3);
  const mCol = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) {
    motes.push({ x: lab.range(-1.6, 1.6), y: lab.range(0.03, 0.42), z: lab.range(-0.95, 1.9), ph: lab.range(0, 6.28), w: lab.range(3, 9), s: lab.range(0.5, 1.2), lit: 0, settle: lab.rand() < 0.14 });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  {
    const g = dot.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  }
  const dotTex = new THREE.CanvasTexture(dot);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  const moteMesh = lab.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.075, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  moteMesh.frustumCulled = false;
  moteMesh.renderOrder = 4;

  // ---------- timeline ----------
  const T = { latch: 0.07, open: 0.42, drift0: 0.34, drift1: 1.16, close0: 1.12, close1: 1.6, end: 1.7 };
  function doorAngle(t) {
    // a tiny jolt as the latch gives, a hairline, then a heavy slow swing; easing shut, a soft bump on the latch
    const jolt = 0.035 * Math.sin(seg(t, 0, T.latch) * Math.PI);
    const swing = ease.out3(seg(t, T.latch + 0.02, T.open)) * 0.42;
    const shut = ease.inOut(seg(t, T.close0, T.close1));
    const bump = t > T.close1 ? 0.025 * Math.sin(seg(t, T.close1, T.close1 + 0.08) * Math.PI) : 0;
    return Math.max(0, (jolt + swing) * (1 - shut)) + bump;
  }

  // brightness of the light at a point on the glass (before her shadow)
  const APEX_Z = wallZ;
  let halfGap = 0;
  let tanA = 0;
  let power = 0;
  let reach = 0; // how far the light's front has run (the spill)
  function lightAt(x, z) {
    const u = (z - APEX_Z) / L;
    if (u < 0 || u > reach) return 0;
    const half = halfGap + u * L * tanA;
    if (half <= 1e-4) return 0;
    const v = Math.abs(x) / half;
    if (v >= 1) return 0;
    const front = smooth(reach, reach - 0.12, u); // the running front of the spill
    return power * (1 - smooth(0.55, 1, v)) * (0.25 + 0.75 * Math.max(0, 1 - u) ** 1.4) * front * (1 + 1.2 * Math.exp(-u * 18));
  }
  let mx = 0;
  let mz = -0.5;
  const SRC_Z = wallZ - 1.3; // the lamp in the bright room, behind the wall: her shadow is long and not too wide
  function shadowAt(x, z) {
    // she blocks the light behind her, seen from the lamp
    const dz = mz - SRC_Z;
    const dHer = Math.hypot(mx, dz);
    const th = Math.atan2(mx, dz);
    const beta = Math.asin(Math.min(0.99, 0.33 / dHer));
    const d = Math.hypot(x, z - SRC_Z);
    const a = Math.abs(Math.atan2(x, z - SRC_Z) - th);
    return smooth(beta * 1.25, beta * 0.6, a) * smooth(dHer - 0.05, dHer + 0.3, d);
  }

  // ---------- her ----------
  const her = { sx: 1, sy: 1, sz: 1, rim: 0 };
  const ava = lab.bot('b');
  let tagFade = 1;
  maya.each = (m) => {
    m.body.scale.set(her.sx, her.sy, her.sz);
    // her name steps aside while the crack is open, so the crack reads
    if (maya.bot.tag) maya.bot.tag.material.opacity *= tagFade;
  };

  // ---------- run ----------
  const T0 = lab.t;
  const dim0 = arena.dim;
  lab.cleanup(() => {
    arena.dim = dim0;
    arena.dimCur = dim0;
  });
  let prevT = 0;
  let clicked = false;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    const dt = Math.max(0, t - prevT);
    prevT = t;

    // the doors
    const ang = doorAngle(t);
    for (const lf of leaves) {
      lf.pivot.rotation.y = lf.side < 0 ? ang : -ang;
      lf.edgeMat.color.copy(hdr(WARM, Math.min(1, ang * 8) * 2.6));
    }
    const freeX = 0.49 - 0.49 * Math.cos(ang);
    const freeZ = wallZ - 0.49 * Math.sin(ang);
    crack.visible = ang > 0.002;
    crack.position.set(0, 0.13, (freeZ + wallZ) / 2 - 0.01);
    crack.scale.set(Math.max(0.004, freeX * 2 + 0.006), 1, 1);
    crackMat.opacity = Math.min(1, ang * 20);
    if (t > T.close1 && !clicked) {
      clicked = true;
      arena.emit?.('click');
    }

    // the light: its width follows the crack; it runs out across the glass like spilled water and drains back
    const openK = ang / 0.42;
    halfGap = freeX;
    tanA = 0.04 + 0.55 * clamp01(openK);
    power = 1.25 * clamp01(openK * 3) * (t < T.close0 ? 1 : 1 - 0.4 * seg(t, T.close0, T.close1));
    const runOut = ease.out(seg(t, T.latch, T.latch + 0.42));
    const drain = ease.in(seg(t, T.close0 + 0.05, T.close1 - 0.02));
    reach = 1.06 * runOut * (1 - drain); // drains from the far end back into the crack
    spot.intensity = 16 * clamp01(openK) * (1 - drain * 0.8);

    tagFade = 1 - 0.75 * Math.min(1, ang * 6);
    // the room's light goes down a little while the door is open
    const dimK = 0.3 * smooth(0, 0.35, t) * (1 - smooth(T.close0, T.end - 0.05, t));
    arena.dim = arena.dimCur = dim0 + dimK;

    // --- Maya: the light leans on her, she gets light, drifts like a leaf
    const kd = seg(t, T.drift0, T.drift1);
    let y = 1;
    let x = 3;
    let lift = 0;
    let roll = 0;
    let squash = 0;
    if (t < T.drift0) {
      // pressed by the light: leans away from it (south = her right) and scrunches, heavy
      const k = ease.inOut(seg(t, 0.12, T.drift0));
      roll = 0.07 * k;
      squash = 0.04 * k;
    } else {
      // the leaf: a smooth glide south, swaying side to side, lifting at the turn of each sway
      const prog = ease.inOut(kd);
      const phase = kd * Math.PI * 2 * 1.5;
      const env = Math.sin(kd * Math.PI) ** 0.7;
      y = 1 + prog - 0.03 * Math.sin(phase * 2) * env;
      x = 3 + 0.13 * Math.sin(phase) * env;
      lift = (0.035 + 0.035 * Math.abs(Math.cos(phase))) * env;
      roll = 0.07 * (1 - ease.out(seg(kd, 0, 0.2)));
      // tilt into the sway: she leans the way she is swinging (roll is a lean to her right = south; the sway is east-west, so pitch)
      const pitch = 0.2 * Math.cos(phase) * env;
      maya.set({ pitch });
      // a soft landing: a little settle and a breath out
      if (t > T.drift1) {
        const d = t - T.drift1;
        squash = 0.07 * Math.sin(Math.min(1, d / 0.18) * Math.PI) * Math.exp(-d * 4);
      }
    }
    mx = lab.pos(x, y).x;
    mz = lab.pos(x, y).z;
    maya.set({ x, y, lift, roll, rot: EAST, trail: true });
    her.sy = 1 - squash;
    her.sx = her.sz = 1 + squash * 0.5;

    // --- the wedge's colours
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1);
      const z = APEX_Z + u * L;
      const half = halfGap + u * L * tanA;
      for (let j = 0; j < NV; j++) {
        const v = (j / (NV - 1)) * 2 - 1;
        const xx = v * half;
        const p = (i * NV + j) * 3;
        wPos[p] = xx;
        wPos[p + 1] = 0.012;
        wPos[p + 2] = z;
        const I = lightAt(xx, z) * (1 - 0.92 * shadowAt(xx, z)) * 0.5;
        wCol[p] = WARM.r * I;
        wCol[p + 1] = WARM.g * I;
        wCol[p + 2] = WARM.b * I;
      }
    }
    wedgeGeo.attributes.position.needsUpdate = true;
    wedgeGeo.attributes.color.needsUpdate = true;
    wedge.visible = power > 0.001 && reach > 0.002;
    // pouring over the front edge once the light gets there
    const edgeHalf = halfGap + L * tanA * 0.99;
    const atEdge = lightAt(0, 1.98) / Math.max(0.001, power) > 0 ? power : 0;
    pourMat.opacity = 0.45 * atEdge * smooth(0.98, 1.04, reach) * (1 - shadowAt(0, 1.98) * 0.9);
    pour.scale.x = Math.max(0.01, edgeHalf * 1.4);
    pour.visible = pourMat.opacity > 0.005;

    // --- motes: carried by the draught, bending around her, only visible where the light is
    const flow = clamp01(openK) * (t < T.close1 ? 1 : 0.2);
    for (let i = 0; i < NM; i++) {
      const m = motes[i];
      const sp = 0.55 * flow * m.s;
      let vx = Math.sin(t * 1.7 + m.ph) * 0.08;
      let vz = sp;
      let vy = Math.sin(t * 2.3 + m.ph * 2) * 0.04;
      // around her like water round a stone
      const rx = m.x - mx;
      const rz = m.z - mz;
      const r = Math.hypot(rx, rz);
      if (r < 0.75 && r > 0.01) {
        const push = (0.75 - r) / 0.75;
        vx += (rx / r) * push * 1.1 * flow;
        vz += (rz / r) * push * 0.4 * flow;
      }
      if (t > T.close0 && m.settle) vy = -0.25; // the last few settle onto the glass
      m.x += vx * dt;
      m.y = Math.max(0.015, m.y + vy * dt);
      m.z += vz * dt;
      if (m.z > 2.05 && t < T.close0) {
        m.z = -0.95;
        m.x = lab.range(-0.3, 0.3);
      }
      const inLight = lightAt(m.x, m.z) * (1 - shadowAt(m.x, m.z));
      // a mote stays lit for a breath after the light leaves it, the last settlers glow on the glass
      m.lit = Math.max(inLight, m.lit - dt * (m.settle ? 1.2 : 6));
      const tw = 0.55 + 0.45 * Math.sin(t * m.w + m.ph);
      const b = Math.min(2.2, m.lit * 3) * tw * (t > T.end - 0.12 ? seg(T.end, T.end - 0.12, t) : 1);
      mPos[i * 3] = m.x;
      mPos[i * 3 + 1] = m.y;
      mPos[i * 3 + 2] = m.z;
      mCol[i * 3] = WARM.r * b;
      mCol[i * 3 + 1] = WARM.g * b;
      mCol[i * 3 + 2] = WARM.b * b;
    }
    moteGeo.attributes.position.needsUpdate = true;
    moteGeo.attributes.color.needsUpdate = true;
    void ava;
  });

  await lab.wait(T.end);
  stop();
  arena.dim = arena.dimCur = dim0;
  for (const lf of leaves) lf.pivot.visible = false;
  crack.visible = wedge.visible = pour.visible = moteMesh.visible = false;
  spot.intensity = 0;
  housing.visible = true;
  if (fin) fin.visible = true;
  maya.each = null;
  maya.model.body.scale.set(1, 1, 1);
  maya.set({ x: 3, y: 2, lift: 0, roll: 0, pitch: 0, rot: EAST });
  maya.release({ x: 3, y: 2, d: 1 });
}
