// Shape Sorter (animator a: weight & physical comedy)
// As the belts start, the glass of the corner tile gives way and a slot drops open: Maya's own Pebble
// silhouette, pointer notch and all, already facing east, dark inside with a thin line of her red round the
// rim. The room can see where she's going and which way she'll end up facing. The belts carry her two spaces;
// the corner turns her, but not quite enough: she arrives a few degrees off and jams on the rim, like a
// toddler's block that won't go in. A determined little wiggle, one, two, then she lines up, gravity takes
// over and she drops a hair into the slot with a solid THUNK, a squash and a ring through the glass. Then her
// light runs in from the rim like water finding its level, sloshes once, floats her back up flush, and the
// slot is gone.
export const meta = {
  title: 'Shape Sorter',
  idea:
    'A slot shaped exactly like Maya (pointer notch facing east) drops open in the corner tile before she gets there. She arrives a few degrees off, jams on the rim, wiggles, lines up and drops in with a satisfying thunk; then her light fills the slot from the rim like water, floats her back up flush, and the slot is gone.',
  notes:
    'The slot is her own silhouette, so the room reads her destination and heading before she arrives; the rim of her colour and the curved outline tell it apart from a square, rimless pit. Physics: her body lags and overshoots on a spring as the belt starts and stops; she rides up on the rim while misaligned; the drop is gravity (ease-in) into a squash and a small rebound; the fill sloshes once before it levels, and the rising light buoys her back to the surface. Sound: a soft hollow "pok" as the slot opens; a dry glass scrape for each wiggle; a deep, woody glass "thunk" on the drop; then a rising watery chime as the light fills. Each form gets its own slot (a square for the Cube, a needle for the Spire). Ports to scene.js as a decal on the destination tile during belt beats.',
};

const TAU = Math.PI * 2;

/** The body as a mass on a damped spring above the base: it lags when the base starts, overshoots when it stops. */
function springBody(k, c) {
  const s = { tx: null, tz: 0, vx: 0, vz: 0, bx: 0, bz: 0, k, c };
  s.step = (dt, bx, bz) => {
    if (s.tx == null) Object.assign(s, { tx: bx, tz: bz, bx, bz });
    if (dt <= 0) return;
    const n = 8;
    const h = dt / n;
    const vbx = (bx - s.bx) / dt;
    const vbz = (bz - s.bz) / dt;
    for (let i = 1; i <= n; i++) {
      const cx = s.bx + (bx - s.bx) * (i / n);
      const cz = s.bz + (bz - s.bz) * (i / n);
      s.vx += (-s.k * (s.tx - cx) - s.c * (s.vx - vbx)) * h;
      s.vz += (-s.k * (s.tz - cz) - s.c * (s.vz - vbz)) * h;
      s.tx += s.vx * h;
      s.tz += s.vz * h;
    }
    s.bx = bx;
    s.bz = bz;
  };
  return s;
}

// ---- the slot: Maya's footprint (the Pebble outline and her pointer), drawn on a canvas laid on the tile ----
const SPAN = 1.7; // world units the slot's canvas covers
const PX = 320; // canvas pixels
const K = PX / SPAN; // pixels per world unit
const BODY = 1.3 * 1.32; // pebble shape units -> world (the robot's scale, plus a hair of clearance)

/** The slot's outline, facing east: shape +y (the front) -> world +x, shape +x (her right) -> world +z (south). */
function slotPath(g, dz = 0, grow = 1) {
  const c = PX / 2;
  const P = (x, y, s) => [c + y * s * K * grow, c + x * s * K * grow + dz * K];
  const s = BODY;
  g.moveTo(...P(0, 0.29, s));
  g.bezierCurveTo(...P(0.11, 0.29, s), ...P(0.31, -0.12, s), ...P(0.29, -0.22, s));
  g.bezierCurveTo(...P(0.27, -0.31, s), ...P(0.13, -0.33, s), ...P(0, -0.29, s));
  g.bezierCurveTo(...P(-0.13, -0.33, s), ...P(-0.27, -0.31, s), ...P(-0.29, -0.22, s));
  g.bezierCurveTo(...P(-0.31, -0.12, s), ...P(-0.11, 0.29, s), ...P(0, 0.29, s));
  g.closePath();
  // the pointer's notch, in front (the tick sits 0.47 ahead of the robot's centre), with a hair of clearance
  const tc = 0.485;
  const T = (x, y) => P(x * 1.3, tc + (y + 0.47 - tc) * 1.3, 1.3);
  g.moveTo(...T(0, 0.085));
  g.lineTo(...T(0.075, -0.02));
  g.lineTo(...T(-0.075, -0.02));
  g.closePath();
}

function canvasTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = PX;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

export default async function play(lab) {
  const { ease, facing, arena, THREE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  const C = lab.pos(3, 1);
  const RED = '#ff4d6d';

  // ---- the slot's three layers: the hole (dark, with a lit far wall), the rim (her red), the fill (her light) ----
  const hole = canvasTex(THREE);
  const rim = canvasTex(THREE);
  const fill = canvasTex(THREE);
  const layer = (tx, blending, y, order) => {
    const mat = new THREE.MeshBasicMaterial({ map: tx.t, transparent: true, depthWrite: false, blending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(C.x, y, C.z);
    mesh.renderOrder = order;
    return lab.add(mesh);
  };
  const holeMesh = layer(hole, THREE.NormalBlending, 0.006, 1.5);
  const rimMesh = layer(rim, THREE.AdditiveBlending, 0.007, 1.6);
  const fillMesh = layer(fill, THREE.AdditiveBlending, 0.0075, 1.7);
  rimMesh.material.color.setScalar(1.8);
  fillMesh.material.color.setScalar(1.6);
  lab.cleanup(() => [hole, rim, fill].forEach((l) => l.t.dispose()));

  const WALL = 0.13; // how much of the far inner wall shows, in world units
  /** level: 0 = empty (deep, the far wall shows), 1 = full to the brim. */
  const drawHole = (level) => {
    const { g, t } = hole;
    g.clearRect(0, 0, PX, PX);
    g.save();
    g.beginPath();
    slotPath(g);
    g.fillStyle = 'rgb(70,82,100)';
    g.fill();
    g.clip();
    // the far (north) inner wall, fading into the dark as it goes down; a rising level hides it
    const w = WALL * (1 - level);
    const N = 10;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      const v = Math.round(70 * (1 - k) ** 2.2);
      g.fillStyle = `rgb(${Math.round(v * 0.75)},${Math.round(v * 0.87)},${v + 2})`;
      g.beginPath();
      slotPath(g, w * k);
      g.fill();
    }
    g.fillStyle = 'rgb(1,2,3)';
    g.beginPath();
    slotPath(g, w + 0.004);
    g.fill();
    g.restore();
    t.needsUpdate = true;
  };
  const drawRim = () => {
    const { g, t } = rim;
    g.clearRect(0, 0, PX, PX);
    g.strokeStyle = RED;
    g.shadowColor = RED;
    g.shadowBlur = 9;
    g.lineWidth = 4.5;
    g.lineJoin = 'round';
    g.beginPath();
    slotPath(g);
    g.stroke();
    g.shadowBlur = 0;
    g.lineWidth = 1.6;
    g.strokeStyle = '#ffd0d8';
    g.stroke();
    t.needsUpdate = true;
  };
  /** f: how far her light has run in from the rim (0..1); slosh: the surface swinging across (world units). */
  const drawFill = (f, slosh) => {
    const { g, t } = fill;
    g.clearRect(0, 0, PX, PX);
    if (f <= 0) return void (t.needsUpdate = true);
    g.save();
    g.beginPath();
    slotPath(g);
    g.clip();
    g.fillStyle = `rgba(255,77,109,${0.55 * f ** 2})`;
    g.fill();
    g.translate(slosh * K, slosh * 0.35 * K);
    g.strokeStyle = `rgba(255,96,124,${0.85})`;
    g.shadowColor = RED;
    g.shadowBlur = 18;
    g.lineWidth = 2 * f * 0.5 * K;
    g.lineJoin = 'round';
    g.beginPath();
    slotPath(g);
    g.stroke();
    g.restore();
    t.needsUpdate = true;
  };
  drawHole(0);
  drawRim();
  drawFill(0, 0);
  const slot = { open: 0, rim: 0, fade: 1 };
  const applySlot = () => {
    const s = Math.max(0.001, slot.open);
    holeMesh.scale.set(s, s, 1);
    rimMesh.scale.set(s, s, 1);
    fillMesh.scale.set(s, s, 1);
    holeMesh.material.opacity = Math.min(1, slot.open * 1.6) * slot.fade;
    rimMesh.material.opacity = slot.rim * slot.fade;
    fillMesh.material.opacity = slot.fade;
  };
  const stopSlot = lab.every(applySlot);

  // the meniscus: the slot's own shape (east-facing: pebble +y -> world east, +x -> south), extruded upward
  const shapeOf = (pts) => {
    const sh = new THREE.Shape();
    // shape coords (X, Y) lie flat as world (x, -z): a pebble point (px, py) facing east sits at (py, -px)
    const P = (x, y) => [y, -x];
    sh.moveTo(...P(pts[0][0], pts[0][1]));
    for (let i = 1; i < pts.length; i += 3) sh.bezierCurveTo(...P(...pts[i]), ...P(...pts[i + 1]), ...P(...pts[i + 2]));
    return sh;
  };
  const b = BODY;
  const peb = shapeOf([[0, 0.29], [0.11, 0.29], [0.31, -0.12], [0.29, -0.22], [0.27, -0.31], [0.13, -0.33], [0, -0.29], [-0.13, -0.33], [-0.27, -0.31], [-0.29, -0.22], [-0.31, -0.12], [-0.11, 0.29], [0, 0.29]].map(([x, y]) => [x * b, y * b]));
  const tc = 0.485;
  const tri = new THREE.Shape();
  const T = (x, y) => [(tc + (y + 0.47 - tc) * 1.3) * 1.3, -(x * 1.3) * 1.3];
  tri.moveTo(...T(0, 0.085));
  tri.lineTo(...T(0.075, -0.02));
  tri.lineTo(...T(-0.075, -0.02));
  tri.closePath();
  const mGeo = new THREE.ExtrudeGeometry([peb, tri], { depth: 1, bevelEnabled: false, curveSegments: 24 });
  mGeo.rotateX(-Math.PI / 2);
  const menisc = lab.add(new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  menisc.position.set(C.x, 0.004, C.z);
  menisc.scale.y = 0.001;
  menisc.renderOrder = 2.5;
  menisc.visible = false;
  lab.cleanup(() => mGeo.dispose());

  // ---- her parts on the glass (ring, pointer, pool) stay on the glass when she sinks, and draw over the slot ----
  const flat = m.group.children.filter((o) => o.isMesh); // ring, pointer, pool (not the body, not the name tag)
  const flatY = flat.map((o) => o.position.y);
  const flatOrder = flat.map((o) => o.renderOrder);
  flat.forEach((o) => o.renderOrder !== 2 && (o.renderOrder = 3));
  lab.cleanup(() => flat.forEach((o, i) => ((o.position.y = flatY[i]), (o.renderOrder = flatOrder[i]))));

  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];

  // her pose, driven by the beats below
  const S = { x: 1, y: 1, rot: facing(0), lift: 0, pitch: 0, roll: 0, sx: 1, sy: 1, glow: 0, pool: 1 };
  const emissive0 = m.paint.emissiveIntensity;
  lab.cleanup(() => (m.paint.emissiveIntensity = emissive0));
  const spring = springBody(420, 11);
  const stopSim = lab.every((dt) => {
    const p = lab.pos(S.x, S.y);
    spring.step(dt, p.x, p.z);
  });
  maya.each = (model) => {
    const ox = spring.tx - spring.bx;
    const oz = spring.tz - spring.bz;
    const r = S.rot;
    const lx = ox * Math.cos(r) - oz * Math.sin(r);
    const lz = ox * Math.sin(r) + oz * Math.cos(r);
    const soft = (a) => 0.5 * Math.tanh(a / 0.5);
    model.body.rotation.x = soft(lz * 8) + S.pitch;
    model.body.rotation.z = soft(-lx * 8) - S.roll;
    model.body.position.y = 0.3 * Math.sin(Math.hypot(model.body.rotation.x, model.body.rotation.z)) * 0.8;
    model.body.scale.set(S.sx, S.sy, S.sx);
    model.paint.emissiveIntensity = emissive0 + 0.4 * S.glow;
    model.poolMat.opacity *= S.pool;
    flat.forEach((o, i) => (o.position.y = flatY[i] - S.lift / 1.3));
  };
  const drive = lab.every(() => maya.set({ x: S.x, y: S.y, rot: S.rot, lift: S.lift }));
  lab.cleanup(() => m.body.scale.set(1, 1, 1));

  // ---- 1. the belts start; the glass of the corner tile gives way and the slot drops open ----
  belt.pulse = lab.t;
  // the plug of glass in her shape falls away into the dark
  const plug = canvasTex(THREE);
  plug.g.fillStyle = 'rgba(150,170,205,0.55)';
  plug.g.beginPath();
  slotPath(plug.g);
  plug.g.fill();
  plug.t.needsUpdate = true;
  lab.cleanup(() => plug.t.dispose());
  const plugMesh = layer(plug, THREE.AdditiveBlending, 0.0068, 1.55);
  lab.tween(0.4, (e, k) => {
    const s = 1 - 0.55 * e;
    plugMesh.scale.set(s, s, 1);
    plugMesh.position.z = C.z - 0.06 * e; // falling away from us, seen from above
    plugMesh.material.opacity = (1 - k) ** 1.3;
  }, ease.in).then(() => (plugMesh.visible = false));
  lab.tween(0.3, (e, k) => {
    slot.open = 0.7 + 0.3 * e;
    slot.rim = Math.min(1, k * 1.4);
  }, (k) => ease.outBack(k, 2.6));
  // the express step: one space east (her body lags as the belt grabs her, and swings on as it stops)
  await lab.tween(0.42, (e) => (S.x = 1 + e), ease.inOut);
  S.x = 2;
  await lab.wait(0.05);

  // ---- 2. the all-belts step: onto the corner, which turns her... not quite far enough ----
  belt.pulse = lab.t;
  const short = 0.6; // of the quarter turn she makes on the way in
  const q = facing(1) - facing(0);
  await lab.tween(0.42, (e, k) => {
    S.x = 2 + e;
    const kt = Math.max(0, (k - 0.3) / 0.7);
    S.rot = facing(0) + q * short * ease.inOut(kt);
    // she rides up onto the rim as she arrives (she doesn't fit like this)
    S.lift = 0.05 * ease.out(Math.max(0, (k - 0.72) / 0.28));
  }, (k) => 1 - (1 - k) ** 2.2);
  S.x = 3;

  // ---- 3. jammed on the rim: a determined wiggle, then she lines up ----
  const wig = [short, 0.42, 0.88, 0.74];
  for (let i = 1; i < wig.length; i++) {
    const a = wig[i - 1];
    const b = wig[i];
    await lab.tween(0.1, (e, k) => {
      S.rot = facing(0) + q * (a + (b - a) * e);
      // each push rocks her on the rim
      S.roll = Math.sin(k * Math.PI) * 0.14 * (i % 2 ? -1 : 1);
      S.lift = 0.05 + 0.016 * Math.sin(k * Math.PI);
    }, ease.inOut);
  }
  S.roll = 0;
  // the last few degrees... and the fit
  await lab.tween(0.07, (e) => (S.rot = facing(0) + q * (0.74 + 0.26 * e)), ease.out);
  S.rot = facing(1);

  // ---- 4. the drop: gravity, a THUNK, a squash, the rim flares and the glass jolts ----
  await lab.tween(0.09, (e) => (S.lift = 0.05 - 0.15 * e), ease.in);
  S.lift = -0.1;
  lab.shake(0.014, 0.16);
  lab.tween(0.3, (e, k) => (slot.rim = 1 + 1.6 * (1 - k) ** 2), ease.linear);
  await lab.tween(0.15, (e, k) => {
    const s = Math.sin(k * Math.PI) * (1 - k * 0.4);
    S.sy = 1 - 0.22 * s;
    S.sx = 1 + 0.11 * s;
    S.lift = -0.1 + 0.025 * Math.sin(k * Math.PI * 1.6) * (1 - k);
    S.rot = facing(1) + Math.sin(k * TAU * 1.5) * 0.04 * (1 - k);
  }, ease.linear);
  S.sy = S.sx = 1;
  S.rot = facing(1);

  // ---- 5. her light runs in from the rim like water and the level rises, sloshing; it wells up over the
  // brim in a soft meniscus that floats her back up, wobbles, and settles flush ----
  await lab.tween(0.26, (e, k) => {
    const slosh = Math.sin(k * TAU * 0.8) * 0.06 * (1 - k);
    drawFill(e, slosh);
    drawHole(e);
    S.glow = 0.6 * e;
    S.pool = 1 - 0.6 * e;
    S.lift = -0.1 + 0.05 * e;
    S.roll = slosh * 0.6;
    slot.rim = 1 - 0.2 * e;
  }, ease.out);
  // the meniscus: a slab of her light standing proud of the glass for a moment
  menisc.visible = true;
  await lab.tween(0.36, (e, k) => {
    const h = 0.06 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - 0.75 * ease.inOut(Math.max(0, (k - 0.35) / 0.65))) + 0.004 * Math.sin(k * TAU * 2) * (1 - k);
    menisc.scale.y = Math.max(0.001, h);
    menisc.material.opacity = 0.75;
    const wob = Math.sin(k * TAU * 1.5) * (1 - k) ** 1.5;
    menisc.scale.x = 1 + 0.03 * wob;
    menisc.scale.z = 1 - 0.03 * wob;
    S.glow = 0.6 + 0.4 * Math.sin(k * Math.PI);
    S.lift = -0.05 + 0.05 * ease.out(Math.min(1, k * 1.5)) + 0.02 * Math.sin(Math.min(1, k * 1.25) * Math.PI);
    S.roll = 0.03 * wob;
    S.pool = 0.4 + 0.2 * k;
  }, ease.linear);
  S.lift = 0;
  S.roll = 0;
  // full to the brim: the light settles into the glass and the slot is gone
  const h0 = menisc.scale.y;
  await lab.tween(0.2, (e) => {
    slot.fade = 1 - e;
    S.glow = 0.6 * (1 - e);
    S.pool = 0.6 + 0.4 * e;
    menisc.material.opacity = 0.75 * (1 - e);
    menisc.scale.y = h0 * (1 - e) + 0.001;
  }, ease.inOut);
  menisc.visible = false;
  slot.fade = 0;
  S.glow = 0;
  stopSlot();
  applySlot();

  drive();
  stopSim();
  maya.each = null;
  flat.forEach((o, i) => (o.position.y = flatY[i]));
  m.body.scale.set(1, 1, 1);
  m.paint.emissiveIntensity = emissive0;
  maya.release({ x: 3, y: 1, d: 1 });
}
