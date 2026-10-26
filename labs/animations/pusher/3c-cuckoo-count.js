// Cuckoo, cut like a montage. A cuckoo clock draws itself in light on top of the panel, its little door flips open
// and a bird of three warm strokes pops out on a stick of light. It cuckoos the register number (here 5), faster
// each time, and every cuckoo is a beat of the edit: the camera punches in a step, the room's light pulses, Maya
// flinches, and a tally mark of light hangs in the air beside the clock. The fifth cuckoo is the lunge, and its
// stroke is the slash across the four tallies: a hit-stop on the poke, then she skids one space south while the
// camera whips home and the door clacks shut.
export const meta = {
  title: 'Cuckoo, counted',
  idea: 'A cuckoo clock drawn in light pops a bird of three warm strokes out of the panel. It cuckoos the register number, faster each time, and each cuckoo is a beat of the edit: a punch-in of the camera, a pulse of the room, a flinch from Maya and a tally mark of light in the air. The fifth is the lunge, struck as the slash through the tally, with a hit-stop on the poke; she skids one space south as the camera whips home and the door clacks shut.',
  notes: 'Sound: a two-note glass "cu-ckoo" per count, each one a little higher and quicker, a soft camera "tick" on each punch-in, a glassy whip and a bright clink on the poke, a skid of glass, then the door\'s tiny clack. Varies by register: register 1 is one cuckoo that is also the lunge (a single slash), register 3 is two tallies and the slash; the count says which register it is, so the room learns the 1-3-5 timetable. Shown here on register 5. 1.85 s.',
};

const mix = (a, b, e) => a + (b - a) * e;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const WARM = '#ffe2b8';

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

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const redraw = (...a) => {
    g.clearRect(0, 0, w, h);
    draw(g, ...a);
    t.needsUpdate = true;
  };
  return { tex: t, redraw };
}

// the bird: three strokes of warm light (body and tail, head, beak) and a dot of an eye; facing right
function drawBird(g, open) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#fff4e2';
  g.shadowColor = '#ffcf8a';
  for (const [lw, blur] of [[22, 30], [13, 8]]) {
    g.lineWidth = lw;
    g.shadowBlur = blur;
    // 1: body, one sweep from the tail tip under the belly up to the chest
    g.beginPath();
    g.moveTo(26, 92);
    g.quadraticCurveTo(58, 104, 74, 128);
    g.quadraticCurveTo(110, 196, 176, 160);
    g.quadraticCurveTo(204, 140, 196, 112);
    g.stroke();
    // 2: head, an open loop
    g.beginPath();
    g.arc(170, 92, 30, Math.PI * 0.55, Math.PI * 2.12);
    g.stroke();
    // 3: beak, a hinge of two lines
    const a = open ? 0.42 : 0.07;
    g.beginPath();
    g.moveTo(198, 90);
    g.lineTo(198 + 50 * Math.cos(-a), 90 + 50 * Math.sin(-a));
    g.moveTo(198, 94);
    g.lineTo(198 + 46 * Math.cos(a), 94 + 46 * Math.sin(a));
    g.stroke();
  }
  // eye
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(176, 84, 9, 0, Math.PI * 2);
  g.fill();
}

// the clock: a little house of light lines on top of the panel; k draws it on (0..1)
function drawClock(g, k) {
  const W = 256;
  const pts = [[40, 236], [40, 104], [128, 30], [216, 104], [216, 236], [40, 236]];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#fff1dc';
  g.shadowColor = '#ffcf8a';
  // the dark doorway
  g.fillStyle = 'rgba(0,0,0,0.92)';
  g.fillRect(96, 116, 64, 70);
  for (const [lw, blur] of [[10, 18], [5, 4]]) {
    g.lineWidth = lw;
    g.shadowBlur = blur;
    g.setLineDash([total * k, total]);
    g.beginPath();
    g.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
    g.stroke();
    g.setLineDash([]);
    // the doorframe
    if (k > 0.6) {
      g.globalAlpha = span(k, 0.6, 1);
      g.strokeRect(96, 116, 64, 70);
      g.globalAlpha = 1;
    }
  }
  void W;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const E = lab.facing(1);
  const maya = lab.puppet('a');
  const bm = lab.bot('a');
  const cam = director(lab);
  const { shot, home } = cam;
  const add = (m) => lab.add(m);
  const lightMat = (map, k = 1.6, color = '#ffffff') => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // ---------- the clock, drawn in light on top of the panel ----------
  const FACE_Z = -0.9;
  const clock = canvasTex(THREE, 256, 256, drawClock);
  const CLOCK = 0.95;
  const clockMesh = new THREE.Mesh(new THREE.PlaneGeometry(CLOCK, CLOCK), lightMat(clock.tex, 1.5));
  clockMesh.material.blending = THREE.NormalBlending; // the dark doorway has to read as dark
  clockMesh.position.set(0, 0.24 + CLOCK / 2, FACE_Z);
  add(clockMesh);
  // doorway in world terms (canvas 96..160 x 116..186 on a 256 texture over CLOCK)
  const S = CLOCK / 256;
  const doorW = 64 * S;
  const doorH = 70 * S;
  const doorCX = (128 - 128) * S;
  const doorCY = clockMesh.position.y + (128 - 151) * S;
  const hinge = new THREE.Group();
  hinge.position.set(doorCX - doorW / 2, doorCY, FACE_Z + 0.01);
  add(hinge);
  const doorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), doorMat);
  door.position.x = doorW / 2;
  hinge.add(door);

  // ---------- the bird on its stick ----------
  const birdOpen = canvasTex(THREE, 256, 256, drawBird);
  const birdShut = canvasTex(THREE, 256, 256, drawBird);
  birdOpen.redraw(true);
  birdShut.redraw(false);
  const birdMat = lightMat(birdShut.tex, 1.7);
  const bird = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), birdMat);
  const birdPivot = new THREE.Group(); // the bird turns about its chest
  birdPivot.add(bird);
  bird.position.set(-0.04, 0.02, 0);
  add(birdPivot);
  const stickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8), stickMat);
  add(stick);
  const doorAt = new THREE.Vector3(doorCX, doorCY - 0.02, FACE_Z);
  const placeBird = (p, rotZ = 0) => {
    birdPivot.position.copy(p);
    birdPivot.rotation.z = rotZ;
    // the stick from the doorway to the bird's chest
    const a = doorAt;
    const b = p.clone().add(new THREE.Vector3(-0.02, -0.06, 0));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    stick.position.copy(mid);
    stick.scale.y = Math.max(0.001, len);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const OUT = new THREE.Vector3(-0.5, doorCY + 0.2, FACE_Z + 0.3); // where it sits, popped out: up and to the side, clear of Maya
  placeBird(doorAt.clone());

  // ---------- tallies of light in the air beside the clock ----------
  const tallyMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tallies = [0, 1, 2, 3].map((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4), tallyMat());
    m.position.set(0.66 + i * 0.13, 0.8, FACE_Z);
    add(m);
    return m;
  });
  const slash = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 1), tallyMat());
  slash.position.set(0.855, 0.8, FACE_Z + 0.01);
  slash.rotation.z = -1.0;
  slash.scale.y = 0.001;
  add(slash);

  // ---------- the room breathes with each cuckoo ----------
  let pulse = 0;
  const stopPulse = lab.every((dt) => {
    pulse = Math.max(0, pulse - dt * 5);
    A.topMat.emissiveIntensity *= 1 + 0.9 * pulse;
  });

  let maskTag = 1;
  const stopTag = lab.every(() => bm.tag && (bm.tag.material.opacity = maskTag));
  lab.cleanup(() => bm.tag && (bm.tag.material.opacity = 1));

  const birdTarget = new THREE.Vector3(-0.2, 0.52, -0.72);
  maya.set({ x: 3, y: 1, rot: E });
  let flinch = 0; // Maya's cringe, building with the count
  let lean = 0;
  let eyeK = 1;
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * eyeK, 3.1 * eyeK, 2.9 * eyeK);

  // ---- 0.00-0.16 the clock draws itself in light; the door flips open
  await lab.tween(0.16, (e, k) => {
    clock.redraw(ease.out(k));
    clockMesh.material.opacity = 1;
    doorMat.opacity = 0.5 * clamp01(k * 3);
    hinge.rotation.y = -1.9 * ease.outBack(span(k, 0.5, 1));
    maskTag = 1 - k;
  }, ease.linear);

  // ---- the count: cuckoos at quickening intervals; each one is a cut
  const beats = [0.0, 0.28, 0.52, 0.72, 0.88]; // from now; the last is the lunge
  const punch = [0.8, 0.67, 0.57, 0.49];
  const t0 = lab.t;
  let shotFrom = { ...shot };
  let shotTo = { ...shot };
  let shotAt = t0;
  const camTo = (dist, ty, tz, el) => {
    shotFrom = { ...shot };
    shotTo = { ...shot, dist, ty, tz, el };
    shotAt = lab.t;
  };
  const stopCam = lab.every(() => {
    const k = ease.out3(clamp01((lab.t - shotAt) / 0.07));
    for (const key of ['dist', 'ty', 'tz', 'el', 'tx']) shot[key] = mix(shotFrom[key], shotTo[key], k);
  });
  // the bird pops out on its stick
  const popAt = lab.t;
  const birdNow = new THREE.Vector3();
  let birdRot = 0;
  let open = false;
  let count = 0;
  const stopBird = lab.every(() => {
    const k = clamp01((lab.t - popAt) / 0.12);
    birdMat.opacity = Math.min(1, k * 3);
    stickMat.opacity = Math.min(1, k * 3);
    birdMat.map = open ? birdOpen.tex : birdShut.tex;
  });
  const bob = async (i) => {
    count = i + 1;
    // the cut: punch in a step, the room's light pulses, Maya flinches, a tally hangs in the air
    const f = punch[Math.min(i, punch.length - 1)];
    const w = Math.min(1, (1 - f) * 2.2);
    camTo(home.dist * f, mix(home.ty, 0.5, w), mix(home.tz, -0.75, w), home.el - 0.12 * w);
    pulse = 0.8;
    open = true;
    flinch = 1;
    lean = 0.05 * i;
    if (tallies[i]) tallies[i].material.opacity = 1;
    await lab.tween(0.07, (e) => {
      birdNow.copy(OUT).add(new THREE.Vector3(0, 0.07 * e, 0.03 * e));
      birdRot = 0.28 * e;
    }, ease.out);
    await lab.tween(0.08, (e) => {
      birdNow.copy(OUT).add(new THREE.Vector3(0, 0.07 * (1 - e), 0.03 * (1 - e)));
      birdRot = 0.28 * (1 - e);
    }, ease.inOut);
    open = false;
  };
  const stopMaya = lab.every((dt) => {
    flinch = Math.max(0, flinch - dt * 7);
    maya.set({ sy: 1 - 0.1 * flinch, sx: 1 + 0.05 * flinch, roll: lean + 0.04 * flinch });
    eyeK = 1 + 0.8 * flinch;
    placeBird(birdNow, birdRot);
  });
  await lab.tween(0.1, (e) => birdNow.lerpVectors(doorAt, OUT, e), ease.outBack);
  for (let i = 0; i < 4; i++) {
    const wait = t0 + beats[i] + 0.1 - lab.t;
    if (wait > 0) await lab.wait(wait);
    bob(i);
  }
  await lab.wait(Math.max(0, t0 + beats[4] + 0.1 - lab.t));

  // ---- the fifth: rear back, lunge, poke (and the slash through the tallies)
  open = true;
  pulse = 0.5;
  camTo(home.dist * 0.42, 0.45, -0.72, home.el - 0.16);
  await lab.tween(0.09, (e) => {
    birdNow.copy(OUT).add(new THREE.Vector3(-0.05 * e, 0.06 * e, -0.06 * e));
    birdRot = 0.35 * e;
    lean = 0.15 + 0.05 * e;
  }, ease.out);
  const fromP = birdNow.clone();
  await lab.tween(0.07, (e) => {
    birdNow.lerpVectors(fromP, birdTarget, e);
    birdRot = mix(0.35, -0.95, e);
    slash.scale.y = Math.max(0.001, 0.66 * e);
    slash.material.opacity = 1;
  }, ease.in);
  // hit-stop
  stopMaya();
  const stopBird2 = lab.every(() => placeBird(birdNow, birdRot));
  lab.ring(lab.pos(3, 1).setY(0.34), '#ffe2b8', 0.5, 0.34, 0.3);
  lab.shake(0.03, 0.15);
  maya.set({ sx: 0.72, sy: 1.05, roll: 0.25 });
  pulse = 1;
  eyeK = 2.2;
  lab.timeScale = 0.06;
  await lab.waitReal(0.09);
  lab.timeScale = 1;

  // ---- 0.4 s: she skids one space south; the camera whips home; the bird springs back; the door clacks shut
  const camFrom = { ...shot };
  stopCam();
  const birdFrom = birdNow.clone();
  await lab.tween(0.45, (e, k) => {
    const s = ease.out3(clamp01(k / 0.75));
    const wob = clamp01(k / 0.8);
    maya.set({
      y: 1 + s,
      sx: mix(0.72, 1, ease.outElastic(clamp01(k * 1.6))),
      sy: mix(1.05, 1, clamp01(k * 2)),
      roll: 0.25 * (1 - s) + 0.06 * Math.sin(wob * 16) * (1 - wob),
      rot: E + 0.18 * Math.sin(wob * 12) * (1 - wob) ** 2,
    });
    eyeK = mix(2.2, 1, clamp01(k * 2));
    const c = ease.inOut3(clamp01(k / 0.85));
    for (const key of ['dist', 'ty', 'tz', 'el', 'tx']) shot[key] = mix(camFrom[key], home[key], c);
    // the bird springs back in, the door clacks shut, the drawing fades
    const back = ease.inBack(span(k, 0.05, 0.35));
    birdNow.lerpVectors(birdFrom, doorAt, back);
    birdRot = mix(-0.95, 0, back);
    birdMat.opacity = stickMat.opacity = 1 - span(k, 0.3, 0.38);
    hinge.rotation.y = -1.9 * (1 - ease.in(span(k, 0.36, 0.5)));
    const fade = 1 - span(k, 0.55, 1);
    clockMesh.material.opacity = fade;
    doorMat.opacity = 0.5 * fade + 0.8 * (span(k, 0.5, 0.52) > 0 ? Math.max(0, 1 - (k - 0.5) * 8) : 0);
    for (const tm of tallies) tm.material.opacity = 1 - span(k, 0.2, 0.75);
    slash.material.opacity = 1 - span(k, 0.3, 0.85);
    maskTag = span(k, 0.6, 1);
  }, ease.linear);
  open = false;
  stopBird();
  stopBird2();
  stopPulse();
  stopTag();
  void count;
  Object.assign(shot, home);
  cam.release();
  maya.each = null;
  maya.set({ y: 2, sx: 1, sy: 1, roll: 0, rot: E });
  maya.release({ x: 3, y: 2, d: 1 });
}
