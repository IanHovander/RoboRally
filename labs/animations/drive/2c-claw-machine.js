// Drive, idea 2 (claw machine, rare), animator c: staged like the inside of an arcade cabinet.
// Move Back isn't driven. The room dims to the cabinet's own lamp, a plumb line of warm light drops out of the
// dark and a claw drawn in light rides down it; the camera leans in like a player with their nose on the glass.
// The claw grips (a star glint), lifts, carries her one space back on its swinging cable, and over the spot the
// picture drops into slow motion while the claw wobbles and a finger slips: the suspense of every arcade claw.
// Then real time snaps back, she drops onto (3, 1) with a bounce, the claw zips up into the dark, the lamp
// goes out, and the U-Turn plays as normal.
export const meta = {
  title: 'Claw machine: nose on the glass',
  idea:
    "Once or twice a game, Move Back isn't driven. The room dims to a single warm lamp, a plumb line of light drops out of the dark and an arcade claw drawn in light rides down it while the camera leans in, like a player with their nose on the glass. It grips her with a glint, lifts her, carries her one space back on its swinging cable (pointer never turning), and over the spot everything drops into slow motion: the claw wobbles, a finger slips... and it drops her exactly on (3, 1) with a bounce. Real time snaps back and the claw zips up into the dark before the U-Turn ends.",
  notes:
    'Rare by design (a seeded once-or-twice-a-game roll on a Move Back). Sound: a soft electric hum as the lamp comes up, a descending glass glissando for the line, a click-clack for the grip, a thin creak loop on the carry, a held breath of silence in the slow motion, a muffled glass "plunk" on the drop and a quick rising zip as the claw leaves. Porting: the claw is a small group of additive light sticks; the cable sway is a damped spring driven by the carriage\'s acceleration, so it works for any direction of Move Back.',
};

const WARM = '#ffd9a8';

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.5)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a four-point star (the glint a camera's star filter makes)
function starTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const arm = (horizontal) => {
    const grad = horizontal ? g.createLinearGradient(0, 0, 256, 0) : g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    if (horizontal) g.fillRect(0, 124, 256, 8);
    else g.fillRect(124, 0, 8, 256);
  };
  arm(true);
  arm(false);
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 40);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(88, 88, 80, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The claw, drawn in light: a hub and three two-jointed fingers. setOpen(a) spreads them (radians). */
function makeClaw(THREE) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stick = (len, r = 0.014) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 6);
    geo.translate(0, -len / 2, 0);
    return new THREE.Mesh(geo, mat);
  };
  const dot = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), dotMat);
  const claw = new THREE.Group();
  // the housing: a short collar and a ring
  const collar = stick(0.16, 0.035);
  collar.position.y = 0.16;
  claw.add(collar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.013, 8, 28), mat);
  ring.rotation.x = Math.PI / 2;
  claw.add(ring);
  claw.add(dot(0.03));
  const knuckles = [];
  const pivots = [];
  for (let i = 0; i < 3; i++) {
    const root = new THREE.Group();
    root.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const pivot = new THREE.Group();
    pivot.position.x = 0.07;
    const upper = stick(0.3);
    pivot.add(upper);
    const knuckle = new THREE.Group();
    knuckle.position.y = -0.3;
    knuckle.add(dot(0.022));
    const lower = stick(0.2, 0.012);
    knuckle.add(lower);
    const tip = dot(0.018);
    tip.position.y = -0.2;
    knuckle.add(tip);
    pivot.add(knuckle);
    root.add(pivot);
    claw.add(root);
    pivots.push(pivot);
    knuckles.push(knuckle);
  }
  claw.mat = mat;
  claw.setOpen = (a, curl = 1.15) => {
    for (const p of pivots) p.rotation.z = a;
    for (const k of knuckles) k.rotation.z = -curl;
  };
  claw.slip = (i, a) => (pivots[i].rotation.z += a);
  claw.renderOrder = 6;
  return claw;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const end = lab.scenario.after.a;
  const maya = lab.puppet('a');

  // ---- the light: a plumb line, the claw, the lamp's pool on the glass ----
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const lineGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 6);
  lineGeo.translate(0, 0.5, 0);
  const line = lab.add(new THREE.Mesh(lineGeo, lineMat));
  line.visible = false;
  const claw = lab.add(makeClaw(THREE));
  claw.scale.setScalar(1.3);
  claw.visible = false;
  const pool = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: glowTexture(THREE), color: new THREE.Color(WARM).multiplyScalar(0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  pool.renderOrder = 2;
  const star = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(THREE), color: new THREE.Color('#fff4e2').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })));
  star.renderOrder = 40;

  // ---- state the frame hook draws from ----
  const TOP = 9; // where the line hangs from, far up in the dark
  const GRIP = 0.74; // hub height above her base when she's held
  const LIFT = 0.72; // how high it lifts her
  const car = lab.pos(3, 2); // the carriage (above), on the glass plane
  let hubY = TOP; // hub height
  let lineLow = TOP; // how far down the line has reached (it drops ahead of the claw)
  let lineToHub = false; // once the claw is down, the line ends at the claw
  let open = 1.35;
  let held = false;
  let poolK = 0;
  let starK = 0;
  let mayaLift = 0;
  const sway = { x: 0, z: 0, vx: 0, vz: 0 };
  let prev = null;
  let prevV = { x: 0, z: 0 };
  let swayGain = 0.3;
  let eyeGain = 1;
  let aside = 0; // her card steps aside to make room for the claw
  let dimK = 0; // the room going down to the cabinet's lamp
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * eyeGain, 3.1 * eyeGain, 2.9 * eyeGain);
    const card = maya.bot.card;
    if (card) {
      card.position.x -= 1.0 * aside;
      card.position.y -= (maya.pose.lift ?? 0) * aside;
    }
  };

  const up = new THREE.Vector3(0, 1, 0);
  const stopFrame = lab.every((dt) => {
    // the cable swings: a damped spring pushed by the carriage's acceleration
    if (dt > 0) {
      const v = prev ? { x: (car.x - prev.x) / dt, z: (car.z - prev.z) / dt } : { x: 0, z: 0 };
      const a = { x: (v.x - prevV.x) / dt, z: (v.z - prevV.z) / dt };
      prev = car.clone();
      prevV = v;
      const W = 9;
      const Z = 0.22;
      for (const ax of ['x', 'z']) {
        const vk = ax === 'x' ? 'vx' : 'vz';
        const acc = -W * W * sway[ax] - 2 * Z * W * sway[vk] - a[ax] * swayGain;
        sway[vk] += acc * dt;
        sway[ax] += sway[vk] * dt;
      }
    }
    lab.arena.dim = lab.arena.dimCur = dimK;
    const hub = new THREE.Vector3(car.x + sway.x, hubY, car.z + sway.z);
    claw.position.copy(hub);
    claw.rotation.set(sway.z * 0.9, 0, -sway.x * 0.9);
    claw.setOpen(open);
    // the line from far above to the hub (or as far as it has dropped)
    const topP = new THREE.Vector3(car.x, TOP, car.z);
    const low = new THREE.Vector3(car.x + sway.x, lineToHub ? hubY + 0.24 : lineLow, car.z + sway.z);
    const dir = low.clone().sub(topP);
    const len = dir.length();
    line.visible = len > 0.01 && low.y < TOP - 0.01;
    line.position.copy(low);
    line.quaternion.setFromUnitVectors(up, dir.clone().negate().normalize());
    line.scale.set(1, len, 1);
    pool.position.x = hub.x;
    pool.position.z = hub.z;
    pool.material.opacity = poolK;
    star.material.opacity = starK;
    star.scale.setScalar(0.25 + 0.9 * starK);
    star.material.rotation = starK * 0.6;
    if (held) {
      // she hangs from the claw: her place is the claw's, her pointer never turns
      const g = lab.arena.course;
      const sx = hub.x + g.w / 2 - 0.5;
      const sy = hub.z + g.h / 2 - 0.5;
      maya.set({ x: sx, y: sy, lift: hubY - GRIP + mayaLift, pitch: sway.z * 1.1, roll: -sway.x * 1.1 });
    }
  });
  lab.cleanup(() => lab.arena.setDim(0));

  // the camera: a lean in toward the glass, and a slow push during the wobble
  let lean = 0;
  let push = 0;
  const focus = lab.pos(3, 1.5).setY(0.95);
  const camRelease = lab.camera((home) => ({
    target: home.target.clone().lerp(focus, 0.8 * lean),
    dist: home.dist * (1 - 0.26 * lean - 0.1 * push),
    el: home.el - 0.1 * lean,
    fov: home.fov - 3 * push,
  }));

  // ---- Move 2 and Rotate Right, as the game plays them ----
  lab.playCard('a', ['m2']);
  await lab.wait(0.05);
  await lab.tween(0.52, (e, k) => maya.set({ x: 1 + 2 * e, pitch: 0.07 * Math.sin(k * Math.PI) }), ease.inOut);
  await lab.wait(0.03);
  lab.playCard('a', ['rr']);
  await lab.wait(0.04);
  await lab.tween(0.28, (e) => maya.set({ rot: facing(1) + (facing(2) - facing(1)) * e }), ease.out3);

  // ---- Move Back: the lamp comes up, the line drops, the claw rides down ----
  lab.playCard('a', ['bk']);
  await lab.wait(0.12); // the card reads
  lab.tween(0.35, (e) => (dimK = 0.85 * e), ease.inOut);
  lab.tween(0.4, (e) => (lean = e), ease.inOut);
  lab.tween(0.3, (e) => (aside = e), ease.inOut);
  lab.tween(0.3, (e) => (poolK = 0.7 * e), ease.out);
  claw.visible = true;
  await lab.tween(0.13, (e) => (lineLow = TOP + (GRIP + 0.4 - TOP) * e), ease.in);
  // she looks up at it
  lab.tween(0.22, (e) => maya.set({ pitch: -0.24 * e }), ease.out);
  await lab.tween(0.28, (e) => {
    hubY = 4.2 + (GRIP + 0.16 - 4.2) * e;
    open = 0.9 + 0.55 * e; // it opens as it arrives
  }, ease.out3);
  // settle down onto her and grip
  lineToHub = true;
  await lab.tween(0.08, (e) => (hubY = GRIP + 0.16 - 0.16 * e), ease.inOut);
  await lab.tween(0.08, (e) => (open = 1.45 - 0.45 * e), ease.in3);
  held = true;
  starK = 1;
  lab.tween(0.4, (e) => (starK = 1 - e), ease.out);
  star.position.copy(lab.pos(3, 2)).add(new THREE.Vector3(0.3, 0.3, 0.15));
  eyeGain = 2.4;
  lab.tween(0.3, (e) => (eyeGain = 2.4 - 0.6 * e), ease.out);
  maya.set({ pitch: 0, trail: false }); // in the air she draws no trail (and she isn't driving)
  // lift (a little stretch, as if dangling)
  await lab.tween(0.22, (e) => {
    hubY = GRIP + LIFT * e;
    maya.set({ sy: 1 + 0.07 * e, sx: 1 - 0.035 * e, sz: 1 - 0.035 * e });
  }, ease.inOut);
  // ---- carry one space back on the swinging cable ----
  const z0 = lab.pos(3, 2).z;
  const z1 = lab.pos(3, 1).z;
  swayGain = 0.34;
  await lab.tween(0.36, (e) => (car.z = z0 + (z1 - z0) * e), ease.inOut);
  // ---- over the spot: slow motion, it wobbles, a finger slips ----
  lab.slowmo(0.36, 0.06);
  lab.tween(0.36, (e) => (push = e), ease.inOut);
  sway.vx += 0.8;
  await lab.tween(0.12, (e, k) => (open = 1.0 + 0.03 * Math.sin(k * 30)), ease.linear);
  // a slip: she sags a hair, the fingers twitch open... and catch
  await lab.tween(0.07, (e) => {
    open = 1.0 + 0.14 * e;
    mayaLift = -0.08 * e;
  }, ease.out);
  await lab.tween(0.06, (e) => (open = 1.14 - 0.12 * e), ease.out);
  await lab.wait(0.05);
  // ---- the drop: real time snaps back ----
  lab.slowmo(1, 0.03);
  lab.tween(0.1, (e) => (open = 1.02 + 0.45 * e), ease.out3);
  held = false;
  lab.tween(0.25, (e) => (dimK = 0.85 * (1 - e)), ease.out);
  const dropFrom = hubY - GRIP + mayaLift;
  const at = lab.pos(3, 1);
  const sx0 = sway.x;
  const sz0 = sway.z;
  lab.tween(0.3, (e) => (push = 1 - e), ease.out);
  await lab.tween(0.17, (e) => maya.set({ x: 3 + sx0 * (1 - e), y: 1 + sz0 * (1 - e), lift: dropFrom * (1 - e), sy: 1.07 - 0.07 * e, sx: 1, sz: 1, pitch: 0, roll: 0 }), ease.in);
  lab.ring(at.clone().setY(0.02), WARM, 0.6, 0.02, 0.5);
  lab.shake(0.02, 0.15);
  // the claw zips up into the dark, the lamp goes out
  lab.tween(0.24, (e) => {
    hubY = GRIP + LIFT + (TOP + 1 - GRIP - LIFT) * e;
    poolK = 0.7 * (1 - e);
  }, ease.in3);
  // a small bounce, still facing south; her card comes home
  lab.tween(0.3, (e) => (aside = 1 - e), ease.inOut);
  await lab.tween(0.22, (e, k) => {
    const sq = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0;
    maya.set({ lift: k < 0.2 ? 0 : 0.07 * Math.sin(((k - 0.2) / 0.8) * Math.PI), sy: 1 - 0.2 * sq, sx: 1 + 0.08 * sq, sz: 1 + 0.08 * sq });
  }, ease.linear);
  maya.set({ lift: 0, sx: 1, sy: 1, sz: 1 });

  // ---- U-Turn, as normal; the camera comes home ----
  lab.playCard('a', ['ut']);
  lab.tween(0.42, (e) => (lean = 1 - e), ease.inOut);
  eyeGain = 1;
  await lab.tween(0.4, (e) => maya.set({ rot: facing(2) - Math.PI * e }), ease.inOut);
  await lab.wait(0.04);
  claw.visible = false;
  line.visible = false;
  stopFrame();
  lab.arena.dim = lab.arena.dimCur = 0;
  camRelease();
  maya.each = null;
  maya.release({ x: end.x, y: end.y, d: end.d });
}
