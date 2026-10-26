// Cuckoo, acted: the panel is a clock and its bird is a heckler. It pops out at Maya's ear and cuckoos the
// register number at her, faster and faster. Maya startles, looks up, tilts her head, gets annoyed, then
// pointedly turns her nose up and ignores it... and the last cuckoo is a peck that sends her sliding a space.
// The bird bows, ducks in, the doors snap shut; Maya glares at them. Ava, across the board, nods along to
// every cuckoo and snickers at the end.
export const meta = {
  title: 'Cuckoo heckler',
  idea:
    "The panel's plate splits into two little clock doors and a bird drawn in three strokes of warm light pops out on a stick of light, right at Maya's ear. It cuckoos once per register number (5 here), faster each time, a ring of light leaving its beak on each. Maya startles and looks up, tilts her head, gets annoyed, then turns her nose up to ignore it; the fifth cuckoo is a peck that shoves her one space south. The bird takes a little bow, ducks in, and the doors snap shut while Maya glares at them. Ava nods along to the count and snickers.",
  notes:
    'Sound: a wooden-glass door click, then "cu-ckoo" on two soft glass chimes per call (each a little higher and quicker), the fifth cut off by a "pik!" and a glassy slide; a tiny bell as the doors snap shut. Register 1 and 3 play 1 and 3 calls with the same lunge at the end, so they have room for longer looks (REGISTER below). The bird is a camera-facing drawing (three tubes of light and an eye), mounted on a stick of light from the panel; nothing is left behind. Maya\'s acting is on her body only, so her pointer stays east.',
};

const REGISTER = 5; // how many cuckoos (the panel fires on 1, 3 and 5)

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);
const out3 = (k) => 1 - (1 - k) ** 3;
const outBack = (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;

/** A robot with an acting layer on its body (the rules' pose, ring and pointer stay put). */
function actor(lab, key, shapeEye) {
  const p = lab.puppet(key);
  const m = p.model;
  let eye = null;
  m.body.traverse((o) => {
    if (!eye && o.isMesh && o.material === m.eyeMat) eye = o;
  });
  const eyeBase = eye ? eye.scale.clone() : null;
  const act = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, dy: 0, eye: 1, eyeH: 1, eyeW: 1 };
  p.act = act;
  p.each = (model) => {
    const b = model.body;
    b.rotation.order = 'YXZ';
    b.rotation.set(act.pitch, act.yaw, -act.roll);
    b.scale.set(act.sx, act.sy, act.sz);
    b.position.y += act.dy;
    model.eyeMat.color.setRGB(3.2 * act.eye, 3.1 * act.eye, 2.9 * act.eye);
    if (eye && shapeEye) eye.scale.set(eyeBase.x * act.eyeH, eyeBase.y * act.eyeW, eyeBase.z * act.eyeH);
  };
  p.finish = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    if (eye) eye.scale.copy(eyeBase);
    p.release(state);
  };
  return p;
}

/** Drive the camera, keeping the game's own centring offset (scaled by `keep`) so handing back is seamless. */
function driveCamera(lab, shot) {
  const A = lab.arena;
  const off = { sx: A.camCur?.sx ?? 0, sy: A.camCur?.sy ?? 0 };
  let last = null;
  return lab.camera((home, t) => {
    const dt = last == null ? 0 : t - last;
    last = t;
    const r = shot(home, t);
    const k = Math.min(0.9, dt * 4);
    if (A.camCur) {
      const keep = r.keep ?? 1;
      A.camCur.sx = (off.sx * keep) / (1 - k);
      A.camCur.sy = (off.sy * keep) / (1 - k);
    }
    return r;
  });
}

export default async function play(lab) {
  const { THREE, facing, PALETTE } = lab;
  const A = lab.arena;
  const cam = lab.camera3;
  const maya = actor(lab, 'a', true);
  const ava = actor(lab, 'b', false);
  const pusher = A.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const housing = plate.parent;
  housing.updateWorldMatrix(true, false);
  const H = housing.matrixWorld.clone();
  const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(H); // panel frame: +z into the board
  plate.visible = false;
  lab.cleanup(() => (plate.visible = true));

  const warm = (k) => new THREE.Color(PALETTE.light).multiplyScalar(k);
  const glow = (k, op = 1) => new THREE.MeshBasicMaterial({ color: warm(k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });

  // ---- the clock: the plate split into two doors hinged at its ends, and a warm room behind them
  const clock = new THREE.Group();
  clock.matrixAutoUpdate = false;
  clock.matrix.copy(H);
  lab.add(clock);
  const doorMat = plate.material.clone();
  const doors = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.33, 0, 0.05);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.2, 0.04).translate(-side * 0.165, 0, 0), doorMat);
    hinge.add(leaf);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.18, 0.012).translate(-side * 0.32, 0, 0.024), glow(2.4, 0));
    hinge.add(edge);
    clock.add(hinge);
    return { hinge, side, edge };
  });
  const room = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.18), glow(1.6, 0));
  room.position.z = 0.032;
  clock.add(room);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ map: radial(THREE), color: warm(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, -0.15, 0.25);
  clock.add(spill);

  // ---- the bird: three strokes of warm light (body, beak, tail) and an eye, always facing the camera
  const R = 0.019;
  const BS = 1.9; // the bird's size
  const stroke = (pts, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))), 32, R, 6), mat);
  const lineMat = glow(1.7);
  const bird = new THREE.Group();
  const birdInner = new THREE.Group(); // bobs and leans about its feet
  bird.add(birdInner);
  const body = stroke(
    [
      [-0.1, 0.03],
      [-0.06, -0.035],
      [0.0, -0.055],
      [0.055, -0.03],
      [0.08, 0.03],
      [0.075, 0.085],
      [0.04, 0.105],
      [0.012, 0.085],
    ],
    lineMat,
  );
  const tail = stroke(
    [
      [-0.1, 0.03],
      [-0.14, 0.06],
      [-0.175, 0.105],
    ],
    lineMat,
  );
  birdInner.add(body, tail);
  // the beak: one bent stroke whose two halves open on each call
  const beak = new THREE.Group();
  beak.position.set(0.082, 0.072, 0);
  const half = () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.6, 0.07, 6).rotateZ(-Math.PI / 2).translate(0.035, 0, 0), lineMat);
    g.add(m);
    beak.add(g);
    return g;
  };
  const upper = half();
  const lower = half();
  birdInner.add(beak);
  const eyeMat = new THREE.MeshBasicMaterial({ color: warm(4.5) });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), eyeMat);
  eye.position.set(0.05, 0.075, 0.005);
  birdInner.add(eye);
  // its calls: arcs of light leaving the beak
  const calls = [];
  const callGeo = new THREE.RingGeometry(0.92, 1, 24, 1, -0.55, 1.1);
  const addCall = (big) => {
    for (let i = 0; i < (big ? 1 : 2); i++) {
      const m = new THREE.Mesh(callGeo, glow(big ? 3 : 2.2, 0));
      lab.add(m);
      calls.push({ m, t: lab.t + i * 0.05, big });
    }
  };
  bird.scale.setScalar(BS);
  bird.visible = false;
  lab.add(bird);
  // the stick of light it rides on
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6).translate(0, 0.5, 0), glow(2, 0.85));
  stick.visible = false;
  lab.add(stick);
  const setStick = (a, b) => {
    const d = b.clone().sub(a);
    stick.position.copy(a);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    stick.scale.set(1, Math.max(0.001, d.length()), 1);
  };

  // ---- timeline (scene seconds)
  const n = REGISTER;
  // call times: accelerating (the last one is the peck)
  const gaps = [0.28, 0.24, 0.2, 0.24].slice(0, Math.max(0, n - 1));
  const DOOR = 0.12;
  const FIRST = 0.3;
  const times = [];
  {
    let t = FIRST;
    for (let i = 0; i < n - 1; i++) {
      times.push(t);
      t += gaps[i] ?? 0.17;
    }
    times.push(t); // the peck's moment of contact, after a wind-up
  }
  const PECK = times[n - 1] + 0.05;
  const WIND = PECK - 0.12;
  const SLIDE = 0.34;
  const BACK = PECK + 0.1; // the bird springs back
  const SHUT = BACK + 0.24; // doors snap shut
  const END = Math.max(SHUT + 0.3, 1.9);

  const door = A.pos(3, 1).add(new THREE.Vector3(0, 0, 0)); // unused anchor (kept for clarity)
  void door;
  const doorPt = local(0, 0.02, 0.06);
  const perch = local(0.24, 0.5, 0.06); // where the bird sits: up and to her right, leaning over her head
  const mayaAt = (y) => A.pos(3, y);
  const contact = (y) => mayaAt(y).add(new THREE.Vector3(0.02, 0.33, -0.2)); // the back of her head
  const tmpQ = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);

  const t0 = lab.t;
  let fired = 0;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    const ma = maya.act;
    const aa = ava.act;

    // ---- doors: fly open, slam shut at the end
    const open = out3(seg(T, 0, DOOR)) * (1 - outBack(seg(T, SHUT, SHUT + 0.1), 2.2));
    for (const d of doors) {
      d.hinge.rotation.y = d.side * 1.9 * open;
      d.edge.material.opacity = open;
    }
    room.material.opacity = 0.8 * open;
    spill.material.opacity = 0.35 * open;

    // ---- the bird
    const pop = T < BACK ? outBack(seg(T, 0.04, 0.2), 2.6) : 1 - smooth(seg(T, BACK + 0.08, SHUT));
    bird.visible = stick.visible = T > 0.04 && T < SHUT + 0.01;
    let at = doorPt.clone().lerp(perch, pop);
    let lean = 0; // in-plane rotation (+ = beak up)
    let beakOpen = 0;
    let squint = 0;
    let birdSy = 1;
    // faces left, down at Maya; just after popping out it glances the other way first ("where is she?")
    const face = T > 0.15 && T < 0.23 ? 1 : -1;
    // the calls: a bob forward and a beak opening on each
    for (let i = 0; i < n - 1; i++) {
      const tc = times[i];
      const w = Math.min(0.17, (gaps[i] ?? 0.17) * 0.8);
      const k = seg(T, tc - w * 0.45, tc + w * 0.55);
      if (k > 0 && k < 1) {
        const b = Math.sin(k * Math.PI);
        lean -= 0.55 * b;
        beakOpen = Math.max(beakOpen, b);
        birdSy = 1 + 0.12 * b;
        at = at.clone().add(new THREE.Vector3(0, 0.03 * b, 0.05 * b));
      }
      if (T >= tc && fired <= i) {
        fired = i + 1;
        addCall(false);
      }
    }
    // the wind-up and the peck
    if (T > WIND - 0.1 && T < BACK + 0.12) {
      const wind = smooth(seg(T, WIND - 0.1, WIND));
      lean += 0.5 * wind; // leans back, beak up...
      squint = wind;
      if (T >= WIND) {
        const k = seg(T, WIND, PECK);
        const lunge = k * k; // ...and lunges, beak down at the back of her head
        const yM = T < PECK ? 1 : 1 + out3(seg(T, PECK, PECK + SLIDE));
        const target = contact(Math.min(yM, 1.2));
        lean = lerp(0.5, -1.25, out3(k));
        beakOpen = T < PECK ? 0.3 : bump(T, PECK, PECK + 0.1);
        // put the beak tip on the target
        bird.updateMatrixWorld();
        tmpQ.copy(cam.quaternion);
        const tip = new THREE.Vector3(0.155, 0.07, 0).applyAxisAngle(zAxis, lean);
        tip.x *= face;
        tip.multiplyScalar(BS).applyQuaternion(tmpQ);
        const strike = target.clone().sub(tip);
        const hold = T < PECK ? lunge : 1 - out3(seg(T, PECK + 0.04, BACK + 0.12));
        at = at.lerp(strike, hold);
        if (T >= PECK && fired < n) {
          fired = n;
          addCall(true);
          lab.ring(A.pos(3, 1).add(new THREE.Vector3(0, 0.02, -0.3)), PALETTE.light, 0.25, 0.25, 0.3);
          lab.shake(0.025, 0.2);
        }
      }
    }
    // after: a little bow (a deep nod), then it ducks in
    if (T > BACK + 0.1) {
      const bow = bump(T, BACK + 0.1, BACK + 0.24);
      lean = -0.7 * bow;
      squint = 0.6;
    }
    bird.position.copy(at);
    bird.quaternion.copy(cam.quaternion);
    bird.scale.set(BS * face, BS * birdSy, BS);
    birdInner.rotation.z = lean;
    upper.rotation.z = 0.5 * beakOpen;
    lower.rotation.z = -0.45 * beakOpen;
    eye.scale.set(1, 1 - 0.75 * squint, 1);
    setStick(doorPt, at);
    // the calls drift out from the beak and fade
    for (const c of calls) {
      const k = (lab.t - c.t) / (c.big ? 0.35 : 0.28);
      c.m.visible = k >= 0 && k < 1;
      if (!c.m.visible) continue;
      const tip = new THREE.Vector3(0.18 * face, 0.07, 0).multiplyScalar(BS);
      c.m.position.copy(bird.position).add(tip.applyQuaternion(cam.quaternion));
      c.m.quaternion.copy(cam.quaternion);
      c.m.rotateZ(face < 0 ? Math.PI : 0);
      const r = (c.big ? 0.08 : 0.05) + (c.big ? 0.28 : 0.16) * out3(k);
      c.m.scale.setScalar(r);
      c.m.material.opacity = (1 - k) ** 1.5;
    }

    // ---- Maya: startle, look up, head tilt, annoyed, nose up and ignoring it... PECK. Slide. Glare.
    const yM = T < PECK ? 1 : 1 + out3(seg(T, PECK, PECK + SLIDE)) + 0.04 * Math.sin(seg(T, PECK + SLIDE * 0.7, PECK + SLIDE + 0.12) * Math.PI);
    maya.set({ x: 3, y: yM, rot: facing(1), trail: T >= PECK });
    const c1 = times[0];
    const startle = bump(T, 0.05, 0.2);
    const lookUp = smooth(seg(T, 0.1, 0.2)) * (1 - smooth(seg(T, times[Math.min(2, n - 1)] + 0.04, times[Math.min(2, n - 1)] + 0.12)));
    const tilt = n >= 2 ? smooth(seg(T, times[1] - 0.05, times[1] + 0.03)) * (1 - smooth(seg(T, times[1] + 0.12, times[1] + 0.2))) : 0;
    const annoyed = n >= 3 ? smooth(seg(T, times[2] - 0.04, times[2] + 0.04)) : 0;
    const ignore = n >= 4 ? smooth(seg(T, times[3] - 0.08, times[3])) : smooth(seg(T, WIND - 0.15, WIND));
    let yaw = 1.0 * lookUp; // her left is north; the bird is north-east of her and high
    yaw = lerp(yaw, -0.45, ignore); // turns her back on it
    let pitch = 0.45 * lookUp + 0.28 * ignore; // looks up / nose in the air
    let roll = -0.22 * tilt;
    let eyeH = 1 + 0.6 * startle - 0.45 * annoyed * (1 - ignore) - 0.5 * ignore;
    let eyeOn = 1 + 0.6 * startle;
    let sx = 1;
    let sz = 1;
    let sy = 1 + 0.14 * startle;
    let dy = 0.05 * startle;
    // flinch on every call (smaller as she gets used to it, then a twitch of annoyance)
    for (let i = 1; i < n - 1; i++) {
      const f = bump(T, times[i], times[i] + 0.08);
      sy -= 0.05 * f;
      roll += 0.06 * f * (i % 2 ? 1 : -1);
    }
    if (T >= PECK) {
      // pecked: eye pops, squashed from the north, skids south with her top lagging, wobbling
      const k = seg(T, PECK, PECK + SLIDE);
      const hit = bump(T, PECK, PECK + 0.14);
      const settle = smooth(seg(T, PECK + 0.05, PECK + 0.2));
      yaw = lerp(-0.45, 0, settle) + 0.35 * Math.sin(k * Math.PI * 3) * (1 - k);
      pitch = lerp(0.25, 0, settle);
      roll = -0.3 * Math.sin(k * Math.PI) * (1 - k * 0.3);
      sx = 1 - 0.3 * hit;
      sz = 1 + 0.1 * hit;
      sy = 1 + 0.12 * hit;
      dy = 0.04 * hit;
      eyeH = 1 + 1.4 * hit + 0.3 * (1 - settle);
      eyeOn = 1 + 1.6 * hit;
      // indignant: whips round to glare at the panel as its doors shut, puffs up, huffs, turns back east
      const glare = smooth(seg(T, PECK + SLIDE - 0.06, PECK + SLIDE + 0.06)) * (1 - smooth(seg(T, END - 0.16, END - 0.03)));
      const huff = bump(T, SHUT, SHUT + 0.14);
      yaw += 1.25 * glare;
      pitch += -0.12 * glare; // chin down, glowering
      eyeH = lerp(eyeH, 0.42, glare);
      eyeOn = lerp(eyeOn, 1.6, glare);
      sy += 0.1 * glare - 0.12 * huff;
      sx += 0.08 * huff;
      sz += 0.08 * huff;
    }
    Object.assign(ma, { yaw, pitch, roll, sx, sy, sz, dy, eyeH, eye: eyeOn, eyeW: 1 });

    // ---- Ava: nods along to every call (counting), then snickers at the peck
    let nod = 0;
    for (let i = 0; i < n - 1; i++) nod = Math.max(nod, bump(T, times[i] - 0.02, times[i] + 0.12));
    const watch = smooth(seg(T, 0.1, 0.3));
    const snicker = T > PECK + 0.08 && T < END - 0.08 ? Math.abs(Math.sin((T - PECK) * 38)) * bump(T, PECK + 0.08, END - 0.08) : 0;
    aa.yaw = -0.22 * watch * (1 - smooth(seg(T, END - 0.2, END - 0.05))); // faces west; a little right turns her toward the panel
    aa.pitch = -0.2 * nod * watch + 0.1 * snicker;
    aa.sy = 1 - 0.04 * nod - 0.07 * snicker;
    aa.roll = 0.06 * snicker;
    aa.eye = 1 + 0.3 * watch + 0.5 * snicker;
    void c1;
  });

  // Maya's name tag steps aside while the bird performs (the game re-shows it every frame, so hide it after)
  const mayaBot = lab.bot('a');
  const inner = maya.each;
  maya.each = (m, t) => {
    inner(m, t);
    const T = lab.t - t0;
    if (mayaBot.tag && T > 0.02 && T < SHUT + 0.05) mayaBot.tag.visible = false;
  };
  // a gentle lean in toward the clock for the show, and home again once she's been pecked
  const focus = A.pos(3.4, 1.5).add(new THREE.Vector3(0, 0.3, 0));
  const releaseCam = driveCamera(lab, (home, t) => {
    const T = t - t0;
    const c = smooth(seg(T, 0.05, 0.45)) * (1 - smooth(seg(T, PECK + 0.15, END - 0.05)));
    return { target: home.target.clone().lerp(focus, c), dist: home.dist * (1 - 0.26 * c), el: home.el - 0.1 * c, keep: 1 - c };
  });

  await lab.wait(END);
  stop();
  releaseCam();
  plate.visible = true;
  maya.finish({ x: 3, y: 2, d: 1 });
  ava.finish({ x: 5, y: 3, d: 3 });
}

function radial(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
