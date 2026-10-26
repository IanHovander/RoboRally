// Overshoot, undo, told as a tape played backwards. The plate shoots out on a telescoping arm of light and carries
// Maya far past her space to the south brink, where she teeters as the room's light drains away and the camera
// swings low to the edge. A ring of white light marks the one space the rules allow. Then the whole shot rewinds
// like a tape (her teeter, the slide, the camera and all): she is reeled up her own trail, the trail lights up and
// spools back in behind her, and she clicks into the ring as the end of the tape snaps home. The arm slinks home.
export const meta = {
  title: 'Instant replay',
  idea: 'The panel overshoots on a telescoping arm of light and leaves Maya teetering over the south edge while the room goes dark and the camera swings low to watch. A white ring marks where the rules want her; then the shot plays backwards like a tape (teeter, slide, camera and all): she is reeled up her own trail, which lights up and spools back in after her, and the tape snaps home as she clicks into the ring.',
  notes: 'Sound: a fast glass ratchet as the arm telescopes, a wobbling glass "ooh" while she teeters, then the same sounds reversed (a rising, sucked-in whoosh) during the rewind, and a bright click when she lands in the ring; the arm goes home with a sheepish little descending two-note. Real game: the overshoot only runs over empty floor (at most 2 extra spaces, never into a robot or wall) and ends at the brink when an edge or pit is within reach; the rewind is a reversed recording of whatever she did, so any overshoot works. 1.85 s.',
};

const mix = (a, b, e) => a + (b - a) * e;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (t, a, b) => clamp01((t - a) / (b - a));

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

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

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const E = lab.facing(1);
  const RED = '#ff4d6d';
  const maya = lab.puppet('a');
  const bm = lab.bot('a');
  const panel = A.pushers.get('3,1');
  const cam = director(lab);
  const { shot, home } = cam;
  const glassLight = () => A.topMat.emissiveIntensity;
  void glassLight;

  // ---------- the telescoping arm of light ----------
  const armMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(0.55), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const collarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(2.6), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = [0.4, 0.3, 0.2].map((w, i) => {
    const h = 0.1 - i * 0.022;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), armMat);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.03), collarMat);
    lab.add(body);
    lab.add(collar);
    body.visible = collar.visible = false;
    return { body, collar };
  });
  const Z0 = -0.86; // the housing's face
  let armDroop = 0;
  const setArm = (ext) => {
    // three nested sections share the reach, the inner ones riding out of the outer ones
    const n = segs.length;
    segs.forEach((s, i) => {
      const a = Z0 + (ext * i) / n;
      const b = Z0 + (ext * (i + 1)) / n + 0.06;
      const len = Math.max(0.001, b - a);
      const on = ext > 0.04;
      s.body.visible = s.collar.visible = on;
      const y = 0.16 - armDroop * (i + 1) * 0.035;
      s.body.position.set(0, y, (a + b) / 2);
      s.body.scale.z = len;
      s.body.rotation.x = armDroop * 0.06 * (i + 1);
      s.collar.position.set(0, y, b);
    });
    panel.plate.position.z = 0.05 + ext;
  };
  let armExt = 0;
  const stopArm = lab.every(() => setArm(armExt));

  // ---------- the iris: the room's light drains while she teeters ----------
  let iris = 0;
  const vig = document.createElement('div');
  vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse 60% 60% at 50% 62%, rgba(0,0,0,0) 0%, rgba(1,2,4,0.55) 55%, rgba(1,2,4,0.9) 100%)';
  lab.overlay.append(vig);
  const stopIris = lab.every(() => {
    A.topMat.emissiveIntensity *= 1 - 0.55 * iris;
    vig.style.opacity = String(iris);
  });

  // the space the rules allow: a ring of white light
  const target = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.49, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  target.rotation.x = -Math.PI / 2;
  target.position.copy(lab.pos(3, 2)).setY(0.012);
  lab.add(target);

  // her name steps aside while the arm is out
  let tagK = 1;
  const stopTag = lab.every(() => bm.tag && (bm.tag.material.opacity = tagK));
  lab.cleanup(() => bm.tag && (bm.tag.material.opacity = 1));

  // ---------- the recording (what the rewind plays backwards) ----------
  const tape = [];
  const record = () => tape.push({ y: maya.pose.y, roll: maya.pose.roll, sy: maya.pose.sy, sx: maya.pose.sx, ext: armExt, cam: { ...shot }, iris, tag: tagK });
  const CAM = ['tx', 'ty', 'tz', 'dist', 'el', 'az'];

  // ---- 0.00-0.10 fire: the plate kicks; the first section snaps out
  maya.set({ x: 3, y: 1, rot: E });
  await lab.tween(0.1, (e) => {
    armExt = 0.05 * e;
    maya.set({ sx: 1 - 0.15 * e });
  }, ease.out);
  lab.ring(lab.pos(3, 0.62).setY(0), '#f4efe4', 0.45, 0.16, 0.3);

  // ---- 0.10-0.52 out: far too far; the arm telescopes and carries her to the brink
  const BRINK = 3.3;
  await lab.tween(0.42, (e, k) => {
    const y = 1 + (BRINK - 1) * e;
    armExt = 0.05 + (y - 1) - 0.05 * (1 - k);
    maya.set({ y, sx: mix(0.85, 1, k), sy: 1 + 0.06 * Math.sin(k * Math.PI), roll: 0.1 * Math.sin(k * Math.PI) });
    tagK = 1 - clamp01(k * 3);
    // the camera leans after her toward the edge
    shot.tz = mix(home.tz, home.tz + 0.5, ease.inOut(k));
    shot.dist = mix(home.dist, home.dist * 0.9, ease.inOut(k));
    record();
  }, ease.out3);
  const nOut = tape.length;
  const yCross = Math.max(0, tape.findIndex((f) => f.y >= 2) - 1); // the last frame before she passed her space

  // ---- 0.52-0.85 the teeter: over the dark drop; the room's light drains; the camera swings low to the edge
  const brinkAt = lab.pos(3, BRINK);
  const c0 = { ...shot };
  await lab.tween(0.32, (e, k) => {
    // she windmills: leans out over the edge (her right side, toward us), back, out again
    const lean = 0.36 * Math.sin(k * Math.PI * 2.4) * (0.55 + 0.45 * k) + 0.14 * k;
    maya.set({ y: BRINK + 0.06 * Math.sin(k * Math.PI), roll: lean, lift: 0.03 * Math.max(0, -Math.sin(k * Math.PI * 2.4)), sy: 1 - 0.04 * Math.sin(k * 18) });
    iris = ease.out(clamp01(k * 2.2));
    const c = ease.inOut(clamp01(k * 1.6));
    shot.tx = mix(c0.tx, brinkAt.x, c);
    shot.ty = mix(c0.ty, 0.15, c);
    shot.tz = mix(c0.tz, brinkAt.z - 0.3, c);
    shot.dist = mix(c0.dist, home.dist * 0.62, c);
    shot.el = mix(c0.el, Math.max(0.42, home.el - 0.35), c);
    shot.az = mix(c0.az, 0.32, c);
    target.material.opacity = ease.out(span(k, 0.45, 0.85));
    target.scale.setScalar(0.6 + 0.4 * ease.outBack(span(k, 0.45, 0.85)));
    record();
  }, ease.linear);

  // ---- 0.92-1.56 REWIND: the recording plays backwards (the teeter fast), then she is reeled up her trail to her space
  bm.trail = bm.trail.slice(); // ours to trim
  maya.set({ trail: false });
  const last = tape.length - 1;
  const lerpTape = (fi) => {
    const i0 = Math.max(0, Math.min(tape.length - 1, Math.floor(fi)));
    const i1 = Math.min(tape.length - 1, i0 + 1);
    const f = Math.max(0, Math.min(1, fi - i0));
    const a = tape[i0];
    const b = tape[i1];
    const o = { cam: {} };
    for (const key of ['y', 'roll', 'sy', 'sx', 'ext', 'iris', 'tag']) o[key] = mix(a[key], b[key], f);
    for (const key of CAM) o.cam[key] = mix(a.cam[key], b.cam[key], f);
    return o;
  };
  // the out part of the tape is monotonic in y: find the frame for a given y
  const frameAtY = (y) => {
    let i = 0;
    while (i < nOut - 2 && tape[i + 1].y < y) i++;
    const a = tape[i].y;
    const b = tape[i + 1].y;
    return i + (b > a ? Math.max(0, Math.min(1, (y - a) / (b - a))) : 0);
  };
  const apply = (o, yOverride) => {
    const y = yOverride ?? o.y;
    maya.set({ y, lift: 0, roll: o.roll, sy: o.sy, sx: o.sx });
    armExt = o.ext;
    for (const key of CAM) shot[key] = o.cam[key];
    iris = o.iris;
    tagK = o.tag;
  };
  // the tape lights up as it starts to spool: the trail is refreshed to full brightness
  for (const pt of bm.trail) pt.t = lab.t;
  const bead = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: glowTex(THREE), color: new THREE.Color('#ffd9df').multiplyScalar(3.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  bead.rotation.x = -Math.PI / 2;
  lab.add(bead);
  const trailAll = bm.trail.slice();
  // the tape itself: a bright strip of her light from her to the end being reeled in
  const tapeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9fb0').multiplyScalar(2.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1), tapeMat);
  strip.rotation.x = -Math.PI / 2;
  lab.add(strip);
  // A: the teeter, backwards and fast
  await lab.tween(0.12, (e, k) => {
    apply(lerpTape(mix(last, nOut - 1, k)));
  }, ease.linear);
  // B: reeled up her own trail; the trail spools in behind her, its end chasing her home
  await lab.tween(0.52, (e, k) => {
    // she is yanked off the brink and glides up her trail into the ring; the end of the tape lingers, then whips in after her
    const ph = ease.out(k);
    const y = mix(BRINK, 2, ph);
    const o = lerpTape(frameAtY(y));
    apply(o, y);
    maya.set({ roll: o.roll * (1 - k) - 0.16 * Math.sin(Math.min(1, k * 1.3) * Math.PI) });
    const tailY = mix(BRINK, 2, Math.pow(k, 2.6));
    const tailZ = lab.pos(3, tailY).z;
    bm.trail = trailAll.filter((pt) => pt.z <= tailZ + 0.001);
    bead.position.set(0, 0.02, tailZ);
    const herZ = lab.pos(3, y).z;
    strip.scale.y = Math.max(0.001, tailZ - herZ);
    strip.position.set(0, 0.015, (tailZ + herZ) / 2);
    tapeMat.opacity = Math.min(1, k * 5) * (1 - span(k, 0.92, 1));
    for (const pt of bm.trail) pt.t = lab.t;
    bead.material.opacity = Math.min(1, k * 6) * (1 - span(k, 0.9, 1));
    bead.scale.setScalar(1 + 0.4 * Math.sin(k * 40));
  }, ease.linear);
  bead.visible = false;
  strip.visible = false;
  bm.trail = trailAll.filter((pt) => pt.z <= lab.pos(3, 2).z + 0.001);

  // ---- 1.56 CLICK: into the ring
  lab.ring(lab.pos(3, 2).setY(0), '#f4efe4', 0.7, 0.02, 0.45);
  lab.shake(0.015, 0.12);
  const extAt = armExt;
  const c1 = { ...shot };
  await lab.tween(0.3, (e, k) => {
    const c = span(k, 0, 0.4);
    maya.set({ y: 2, roll: 0, sx: 1 + 0.12 * Math.sin(c * Math.PI) * (1 - c), sy: 1 - 0.1 * Math.sin(c * Math.PI) * (1 - c), rot: E });
    target.material.opacity = (1 - ease.out(k)) * (1 + 1.5 * Math.sin(c * Math.PI));
    target.scale.setScalar(1 + 0.25 * ease.out(k));
    // the arm slinks home: it sags, dims, and backs into the wall
    armDroop = Math.sin(span(k, 0, 0.8) * Math.PI);
    armMat.opacity = 0.55 * (1 - 0.6 * k);
    armExt = mix(extAt, 0, ease.inOut(span(k, 0.1, 1)));
    for (const key of CAM) shot[key] = mix(c1[key], home[key], ease.inOut(k));
    tagK = Math.max(tagK, ease.out(k));
    iris = 0;
  }, ease.linear);

  stopArm();
  stopIris();
  stopTag();
  setArm(0);
  panel.plate.position.z = 0.05;
  for (const sg of segs) sg.body.visible = sg.collar.visible = false;
  vig.remove();
  Object.assign(shot, home);
  cam.release();
  maya.set({ x: 3, y: 2, rot: E, roll: 0, sx: 1, sy: 1, lift: 0 });
  maya.release({ x: 3, y: 2, d: 1 });
}
