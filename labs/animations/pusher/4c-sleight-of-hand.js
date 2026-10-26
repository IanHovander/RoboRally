// The drawer, shot like a close-up magic trick. Light runs around the seams of Maya's tile: it was a drawer all
// along. A tray of smoked glass with bright edges and a little handle of light slides out of the wall with her on it,
// carrying her one space south, and stops with a chime while the camera leans in like a magician's close-up. A
// breath. Then the tray whips back into the wall so fast it leaves only a long-exposure streak of its edges, and the
// picture freezes: Maya hangs a hair above the glass with nothing under her, like a cartoon who hasn't looked down.
// Time starts again; she drops the last few millimetres, wobbles, and sits on her new space, still facing east.
export const meta = {
  title: 'Sleight of hand',
  idea: 'Light runs around the seams of Maya\'s tile: it was a drawer all along. A smoked-glass tray with a handle of light slides her one space south while the camera leans in like a close-up magic trick; it stops with a chime, holds a breath, then whips back into the wall so fast it leaves only a long-exposure streak, and the picture freezes with Maya hanging in the air over nothing. Time restarts; she drops, wobbles and sits there, still facing east.',
  notes: 'Sound: a soft glass tick as the seams light, a smooth glass slide and a bright till-drawer chime at the stop, silence for the breath, a very fast glass "fwip" for the whip, total silence in the freeze, then a tiny glass tock as she lands and a wobble of small chimes. Port: the tray, rails and streak are a few meshes on the robot\'s space; the freeze is a short time-scale dip. 1.85 s.',
};

const mix = (a, b, e) => a + (b - a) * e;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const WARM = '#f4efe4';

function director(lab) {
  const A = lab.arena;
  const h = A.camHome;
  const shot = { tx: h.target.x, ty: h.target.y, tz: h.target.z, dist: h.dist, el: h.elev, az: 0, fov: 30, roll: 0 };
  const home = { ...shot };
  const sx0 = A.camCur?.sx ?? 0;
  const sy0 = A.camCur?.sy ?? 0;
  let last = lab.t;
  const release = lab.camera(() => {
    const dt = Math.max(0, lab.t - last);
    last = lab.t;
    const k = Math.min(0.9, dt * 4);
    if (A.camCur) {
      A.camCur.sx = sx0 / (1 - k);
      A.camCur.sy = sy0 / (1 - k);
    }
    return { target: new lab.THREE.Vector3(shot.tx, shot.ty, shot.tz), dist: shot.dist, el: shot.el, az: shot.az, fov: shot.fov, roll: shot.roll };
  });
  return { shot, home, release };
}

// the streak a fast tray leaves on a long exposure: its two bright edges smeared out, brightest at the front
function streakTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const fill = g.createLinearGradient(0, 0, 0, 256);
  fill.addColorStop(0, 'rgba(255,255,255,0.05)');
  fill.addColorStop(1, 'rgba(255,255,255,0.28)');
  g.fillStyle = fill;
  g.fillRect(6, 0, 116, 256);
  const edge = g.createLinearGradient(0, 0, 0, 256);
  edge.addColorStop(0, 'rgba(255,255,255,0.15)');
  edge.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = edge;
  g.fillRect(2, 0, 8, 256);
  g.fillRect(118, 0, 8, 256);
  g.fillRect(2, 246, 124, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const E = lab.facing(1);
  const maya = lab.puppet('a');
  const bm = lab.bot('a');
  const panel = A.pushers.get('3,1');
  const cam = director(lab);
  const { shot, home } = cam;
  const add = (m) => lab.add(m);
  const glow = (k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  // ---------- the drawer ----------
  const WALL = lab.pos(3, 1).z - 0.5; // the north edge of her space, under the panel
  const SIZE = 0.94;
  const T = 0.09; // the tray's thickness
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.12, metalness: 0, emissive: 0x2a3140, emissiveIntensity: 0.6, transparent: true, opacity: 0 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(SIZE, T, 1).translate(0, 0, -0.5), trayMat); // anchored at its front edge
  add(tray);
  const edgeMat = glow(2.2);
  const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 1).translate(0, 0, -0.5), edgeMat);
  const edgeR = edgeL.clone();
  const edgeF = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.026, 0.03), edgeMat);
  add(edgeL);
  add(edgeR);
  add(edgeF);
  // the drawer front and its handle of light
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.15, emissive: 0x3a4252, emissiveIntensity: 0.5, transparent: true, opacity: 0 });
  const face = new THREE.Mesh(new THREE.BoxGeometry(SIZE, T + 0.03, 0.03), faceMat);
  add(face);
  const handleMat = glow(3);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.04), handleMat);
  add(handle);
  // light leaking out from under the tray onto the glass
  const underMat = new THREE.MeshBasicMaterial({
    map: (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const r = g.createRadialGradient(32, 32, 8, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    color: new THREE.Color(WARM).multiplyScalar(0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), underMat);
  under.rotation.x = -Math.PI / 2;
  add(under);
  // the rails of light it runs out on, from the wall
  const railMat = glow(1.6);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 1).translate(0, 0, 0.5), railMat);
  const railR = railL.clone();
  add(railL);
  add(railR);
  // the seam: light running round the tile, from the wall corners to the handle
  const seamMat = glow(3.4);
  const seams = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.024, 0.024), seamMat);
    add(m);
    return m;
  });
  // the slot under the panel glows
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, 0.06), glow(2.4));
  slot.position.set(0, 0.035, WALL + 0.012);
  add(slot);

  let front = WALL + SIZE + 0.03; // z of the tray's front edge
  let lift = 0;
  let shown = 0;
  const placeDrawer = () => {
    const back = Math.max(WALL, front - SIZE);
    const len = Math.max(0.0001, front - back);
    const vis = front > WALL + 0.01;
    for (const m of [tray, edgeL, edgeR, edgeF, face, handle]) m.visible = vis;
    tray.position.set(0, lift - T / 2 + 0.003, front);
    tray.scale.z = len;
    const half = SIZE / 2;
    edgeL.position.set(-half, lift + 0.004, front);
    edgeR.position.set(half, lift + 0.004, front);
    edgeL.scale.z = edgeR.scale.z = len;
    edgeF.position.set(0, lift + 0.004, front);
    face.position.set(0, lift - (T + 0.03) / 2 + 0.012, front + 0.015);
    handle.position.set(0, lift - T / 2, front + 0.04);
    under.position.set(0, 0.005, front - SIZE / 2);
    under.visible = vis;
    underMat.opacity = 0.55 * shown;
    // rails from the wall to the tray's back
    const rl = Math.max(0.0001, back - WALL);
    for (const [r, x] of [[railL, -half + 0.05], [railR, half - 0.05]]) {
      r.position.set(x, 0.012, WALL);
      r.scale.z = rl;
      r.visible = rl > 0.01;
    }
    trayMat.opacity = 0.9 * shown;
    faceMat.opacity = 0.95 * shown;
  };
  const stopDrawer = lab.every(() => placeDrawer());
  placeDrawer();

  let tagK = 1;
  const stopTag = lab.every(() => bm.tag && (bm.tag.material.opacity = tagK));
  lab.cleanup(() => bm.tag && (bm.tag.material.opacity = 1));
  const plateGlow = panel.plate.material.emissiveIntensity;
  lab.cleanup(() => (panel.plate.material.emissiveIntensity = plateGlow));

  maya.set({ x: 3, y: 1, rot: E });

  // ---- 0.00-0.18 the seams light: it was a drawer all along
  const c = lab.pos(3, 1);
  const half = SIZE / 2;
  await lab.tween(0.24, (e, k) => {
    // two runs of light from the wall's corners down the sides, meeting across the front
    const side = clamp01(k / 0.6);
    const across = span(k, 0.6, 1);
    seamMat.opacity = 1;
    const sideLen = SIZE * ease.inOut(side);
    seams[0].scale.set(0.001, 1, 1);
    for (const [m, x] of [[seams[0], -half], [seams[1], half]]) {
      m.rotation.y = Math.PI / 2;
      m.scale.x = Math.max(0.001, sideLen);
      m.position.set(c.x + x, 0.008, WALL + sideLen / 2);
    }
    for (const [m, dir] of [[seams[2], -1], [seams[3], 1]]) {
      const l = half * ease.out(across);
      m.scale.x = Math.max(0.001, l);
      m.position.set(c.x + dir * (half - l / 2), 0.008, WALL + SIZE);
      m.visible = across > 0;
    }
    slot.material.opacity = k;
    panel.plate.material.emissiveIntensity = plateGlow + 2 * k;
    handleMat.opacity = across;
  }, ease.linear);

  // ---- 0.18-0.85 the drawer slides out with her on it
  for (const m of seams) m.visible = false;
  shown = 1;
  edgeMat.opacity = 1;
  railMat.opacity = 1;
  const startFront = front;
  await lab.tween(0.6, (e, k) => {
    lift = T * ease.out(clamp01(k * 6));
    front = startFront + e;
    maya.set({ y: 1 + e, lift, pitch: 0, sy: 1 + 0.02 * Math.sin(k * Math.PI) });
    // the magician's close-up: the camera leans in
    const ck = ease.inOut(k);
    shot.tx = mix(home.tx, 0, ck);
    shot.tz = mix(home.tz, lab.pos(3, 1.7).z, ck);
    shot.ty = mix(home.ty, 0.12, ck);
    shot.dist = mix(home.dist, home.dist * 0.72, ck);
    shot.el = mix(home.el, home.el - 0.08, ck);
    tagK = 1 - clamp01(k * 3);
    slot.material.opacity = 1 - 0.5 * k;
  }, (k) => ease.outBack(k, 0.9));

  // ---- 0.85-1.12 the chime, and a breath
  lab.ring(lab.pos(3, 2.47).setY(0.03), WARM, 0.55, 0.05, 0.5);
  handleMat.opacity = 1;
  await lab.tween(0.22, (e, k) => {
    handle.scale.setScalar(1 + 0.6 * Math.sin(Math.min(1, k * 2.5) * Math.PI));
    maya.set({ lift, sy: 1 - 0.03 * Math.sin(Math.min(1, k * 3) * Math.PI) });
    shot.dist = mix(home.dist * 0.72, home.dist * 0.7, k);
  }, ease.linear);

  // ---- 1.12 the whip: back into the wall in a few frames, leaving a long-exposure streak
  const streakMat = new THREE.MeshBasicMaterial({ map: streakTexture(THREE), color: new THREE.Color(WARM).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, 1), streakMat);
  streak.rotation.x = -Math.PI / 2;
  add(streak);
  const fromFront = front;
  await lab.tween(0.07, (e) => {
    front = mix(fromFront, WALL - 0.02, e);
    const tail = Math.max(WALL, front - SIZE);
    const len = fromFront - tail;
    streak.scale.y = Math.max(0.001, len);
    streak.position.set(0, lift + 0.006, (fromFront + tail) / 2);
    streakMat.opacity = 1;
    railMat.opacity = 1 - e;
  }, ease.in);
  lab.shake(0.012, 0.08);

  // ---- the freeze: the picture holds; she hangs in the air over nothing
  for (const m of [railL, railR]) m.visible = false;
  slot.material.opacity = 1;
  lab.timeScale = 0.02;
  const frozen = lab.real;
  let eyeK = 1;
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * eyeK, 3.1 * eyeK, 2.9 * eyeK);
  const look = lab.every(() => {
    // the cartoon beat: in the frozen picture she slowly tips her nose down to look at the nothing under her
    const k = clamp01((lab.real - frozen) / 0.2);
    maya.set({ pitch: 0.2 * ease.inOut(k) });
    eyeK = 1 + 0.6 * Math.sin(k * Math.PI);
  });
  await lab.waitReal(0.24);
  look();
  lab.timeScale = 1;

  // ---- she drops the last few millimetres, wobbles, sits; the camera eases home; the streak fades
  const camFrom = { ...shot };
  let landed = false;
  await lab.tween(0.42, (e, k) => {
    const d = ease.in(clamp01(k / 0.14));
    if (k >= 0.14 && !landed) {
      landed = true;
      lab.ring(lab.pos(3, 2).setY(0), '#ff4d6d', 0.5, 0.02, 0.4);
    }
    const settle = span(k, 0.14, 1);
    maya.set({
      y: 2,
      lift: T * (1 - d),
      sy: 1 - 0.14 * Math.sin(settle * Math.PI * 3) * (1 - settle) * (k > 0.14 ? 1 : 0),
      sx: 1 + 0.08 * Math.sin(settle * Math.PI * 3) * (1 - settle) * (k > 0.14 ? 1 : 0),
      roll: 0.1 * Math.sin(settle * 14) * (1 - settle) ** 1.5,
      pitch: 0.2 * (1 - ease.out(clamp01(k / 0.3))),
      rot: E + 0.08 * Math.sin(settle * 11) * (1 - settle) ** 2,
    });
    streakMat.opacity = 1 - ease.out(clamp01(k / 0.5));
    slot.material.opacity = 1 - k;
    panel.plate.material.emissiveIntensity = plateGlow + 2 * (1 - k);
    const ck = ease.inOut(span(k, 0.1, 1));
    for (const key of ['tx', 'ty', 'tz', 'dist', 'el']) shot[key] = mix(camFrom[key], home[key], ck);
    tagK = span(k, 0.5, 1);
  }, ease.linear);

  stopDrawer();
  stopTag();
  streak.visible = false;
  slot.visible = false;
  for (const m of [tray, edgeL, edgeR, edgeF, face, handle, railL, railR, under]) m.visible = false;
  panel.plate.material.emissiveIntensity = plateGlow;
  Object.assign(shot, home);
  cam.release();
  maya.each = null;
  maya.set({ y: 2, lift: 0, sx: 1, sy: 1, roll: 0, pitch: 0, rot: E });
  maya.release({ x: 3, y: 2, d: 1 });
}
