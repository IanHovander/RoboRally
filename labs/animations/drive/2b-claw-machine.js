// Drive, idea 34 "Claw machine (rare)", animator b (character acting).
export const meta = {
  title: 'The claw',
  idea:
    'Move Back, performed by an arcade claw drawn in warm light. Maya notices it first: she looks straight up and gulps (a squash, her eye wide). Theo looks up, looks away, and looks up again. ' +
    'The claw closes on her (she flinches, eye squeezed shut), lifts her dangling, carries her one space back still facing south, and wobbles over the spot while she peers down at the drop and Theo leans in. ' +
    'It drops her with a bounce; she shakes herself off and glares up at it as it reels away, then does the U-Turn with her nose in the air. Theo is caught snickering and snaps back to looking innocent.',
  notes:
    'Sound: a thin ascending glass whine for the cable, a soft click for the fingers, a held wobbling tone over the spot, a hollow "tunk" and a tiny bounce on the drop, a ratcheting reel-up. ' +
    'Rare: the host picks it once or twice a game for a Move Back with clear air above the robot. No trail for the space she is carried (she was never driven). ' +
    'Port: the claw is a dozen thin cylinders and two glow sprites in Lumen\'s warm light; the reactions are pitch, squash and eye scale on any form.',
};

const PI = Math.PI;
const TAU = PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (T, a, b) => clamp01((T - a) / (b - a));

/** A keyframed channel: keys [[t, value, ease], ...]; each key's ease shapes the stretch arriving at it. */
function track(keys, def) {
  return (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = def] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return v0 + (v1 - v0) * e(t1 > t0 ? (T - t0) / (t1 - t0) : 1);
    }
    return keys[keys.length - 1][1];
  };
}

export default async function play(lab) {
  const { THREE, ease: E, facing, PALETTE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const t0 = lab.t;
  const back = (s) => (k) => E.outBack(k, s);

  const C = { m2: 0.0, rr: 0.8, bk: 1.2, ut: 3.48 };
  const END = 4.12;
  const GRAB = 0.6; // hub height while it holds her
  const LIFT = 0.5; // how high she is carried

  // ----- the claw: hub height, fingers' spread and curl, sway -----
  const hubY = track([
    [1.22, 5.2], [1.6, 1.95, E.out3], [1.68, 2.05, E.inOut], [1.76, 1.95, E.inOut], // the cable lowers and bobs
    [1.84, 1.95], [2.0, GRAB, E.in3], // plunges down over her
    [2.1, GRAB], [2.32, GRAB + LIFT, E.inOut], // up she goes
    [3.04, GRAB + LIFT], [3.16, GRAB + LIFT + 0.12, E.out], [3.74, 5.6, E.in3], // let go, and reel up
  ], E.inOut);
  const hubYk = track([[2.32, 2], [2.72, 1, E.inOut]], E.inOut); // carried one space back
  const spread = track([[1.8, 0.55], [1.98, 1.35, back(1.6)], [2.03, 1.35], [2.1, 0.95, E.in], [3.0, 0.95], [3.07, 1.4, E.out], [3.4, 1.0], [3.7, 0.55]], E.inOut);
  const curl = track([[1.8, 0.9], [1.98, 0.3, E.out], [2.03, 0.3], [2.1, 1.2, E.in], [3.0, 1.2], [3.07, 0.3, E.out], [3.7, 0.9]], E.inOut);
  // wobbling over the spot: suspense
  const wob = (T) => Math.sin((T - 2.72) * TAU * 3.2) * Math.sin(PI * span(T, 2.72, 3.04)) * 0.075;
  const carryAcc = (T) => Math.sin(TAU * span(T, 2.32, 2.72)); // + speeding up, - slowing down

  // ----- Maya -----
  const mx = track([[0.08, 1], [0.7, 3, E.inOut]], E.inOut);
  const mrot = track([[0.86, facing(1)], [0.94, facing(1) + 0.12, E.out], [1.12, facing(2), back(1.5)], [C.ut + 0.1, facing(2)], [C.ut + 0.34, facing(2) - PI, back(1.3)]], E.inOut);
  const mpitch = track([
    [0.04, 0], [0.16, 0.1, E.out], [0.64, 0.06], [0.78, 0.13, E.out], [0.9, -0.03, E.inOut], [1.0, 0, E.inOut], // drive, a little rock on arrival
    [1.4, 0], [1.52, -0.36, E.out3], [1.9, -0.32], // looks straight up
    [2.04, -0.12, E.out], [2.3, 0.02], // grabbed
    [2.72, 0.02], [2.84, 0.34, E.out], [3.02, 0.36], // peers down at the drop
    [3.14, 0.0, E.out], [3.34, 0], [3.44, -0.26, E.out], [C.ut + 0.34, -0.2], [C.ut + 0.56, 0, E.inOut], // glares up, nose in the air
  ], E.inOut);
  const msy = track([
    [1.4, 1], [1.46, 0.88, E.out], [1.56, 1.06, E.out], [1.7, 1], [1.86, 0.93], // gulp
    [2.04, 0.93], [2.1, 1.12, E.out], [2.3, 1.04], [3.0, 1.04], // squeezed by the fingers
    [3.13, 1.12, E.in], [3.17, 0.7, E.out], [3.36, 1, (k) => E.outElastic(k)], // stretched as she falls, squashed on the glass
  ], E.inOut);
  const msq = track([[2.04, 1], [2.1, 0.86, E.out], [3.0, 0.88], [3.13, 0.9], [3.17, 1.26, E.out], [3.36, 1, E.out]], E.inOut); // sideways
  const fall = (T) => {
    if (T < 3.04) return 0;
    const k = span(T, 3.04, 3.15);
    const bounce = T > 3.15 ? Math.sin(PI * span(T, 3.17, 3.33)) * 0.07 : 0;
    return -LIFT * E.in(k) * 1 + bounce;
  };
  // eye: wide when she sees it, squeezed shut on the grab, wide again over the drop
  const eyeW = track([[1.42, 1], [1.48, 1.7, E.out3], [1.94, 1.6], [2.04, 1.1], [2.9, 1.1], [2.96, 1.6, E.out], [3.14, 1.6], [3.3, 1, E.inOut], [3.44, 1.15], [C.ut + 0.5, 1]], E.inOut);
  const eyeH = track([[1.42, 1], [1.48, 1.7, E.out3], [1.94, 1.6], [2.02, 0.25, E.out], [2.5, 0.3], [2.62, 1.0, E.out], [2.9, 1.0], [2.96, 1.7, E.out], [3.14, 1.7], [3.18, 0.2, E.out], [3.3, 1, E.out], [3.44, 0.55, E.out], [C.ut + 0.5, 1]], E.inOut);
  const eyeB = track([[1.42, 1], [1.48, 2.2, E.out], [1.9, 1.7], [2.02, 1.0], [3.0, 1.3], [3.3, 1]], E.inOut);
  // shaking herself off after the drop
  const shake = (T) => Math.sin((T - 3.3) * TAU * 7) * 0.13 * Math.sin(PI * span(T, 3.3, 3.48));

  // ----- Theo: a double-take, suspense, a snicker, innocence -----
  const tF = facing(2);
  const trot = track([
    [1.44, tF], [1.52, tF - 0.32, E.out], [1.58, tF - 0.3], [1.64, tF, E.inOut], [1.7, tF], [1.76, tF - 0.5, E.out3], // look, away, LOOK
    [2.3, tF - 0.5], [2.74, tF - 0.95, E.inOut], [3.6, tF - 0.95], [3.7, tF, E.out3], // follow her; snap back innocent
  ], E.inOut);
  const tpitch = track([
    [1.44, 0], [1.52, -0.14, E.out], [1.64, 0, E.inOut], [1.7, 0], [1.76, -0.3, E.out3], [2.3, -0.24], [2.72, 0.04], [2.86, 0.16, E.out], [3.06, 0.16], [3.16, -0.08, E.out], [3.26, 0],
    [3.62, 0], [3.7, -0.05, E.out], [3.86, 0, E.inOut],
  ], E.inOut);
  const tsy = track([[1.7, 1], [1.76, 1.1, E.out3], [1.92, 1, E.inOut], [3.14, 1], [3.18, 0.92, E.out], [3.3, 1]], E.inOut);
  const snicker = (T) => Math.sin((T - 3.26) * TAU * 7.5) * 0.06 * Math.sin(PI * span(T, 3.26, 3.62));

  // ----- build the claw in warm light -----
  const glow = (k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.light).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const lineMat = glow(2.4);
  const cableMat = glow(1.8);
  const seg = (len, r, mat) => {
    const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
    g.translate(0, -len / 2, 0);
    return new THREE.Mesh(g, mat);
  };
  const claw = new THREE.Group();
  const cable = seg(8, 0.008, cableMat);
  cable.position.y = 8.08;
  claw.add(cable);
  const headG = new THREE.Group(); // what wobbles; the cable hangs straight from far above
  claw.add(headG);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.015, 6, 28), lineMat);
  collar.rotation.x = PI / 2;
  headG.add(collar);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), glow(3));
  headG.add(knob);
  const fingers = [];
  const UP = 0.36;
  const LO = 0.24;
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Group();
    f.rotation.y = (i * TAU) / 3 + PI / 2;
    const k = new THREE.Group();
    k.position.x = 0.06;
    f.add(k);
    k.add(seg(UP, 0.016, lineMat));
    const j = new THREE.Group();
    j.position.y = -UP;
    k.add(j);
    j.add(seg(LO, 0.016, lineMat));
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), lineMat);
    tipBall.position.y = -LO;
    j.add(tipBall);
    headG.add(f);
    fingers.push({ k, j });
  }
  lab.add(claw);
  claw.visible = false;
  // a soft glint where it closes, and the warm light it throws down on her
  const glintMat = new THREE.SpriteMaterial({ map: maya.model.poolMat.map, color: new THREE.Color(PALETTE.light).multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const glint = new THREE.Sprite(glintMat);
  glint.renderOrder = 20;
  lab.add(glint);
  const glintK = (T) => (T < 2.08 ? 0 : Math.exp(-(T - 2.08) * 9) * span(T, 2.08, 2.1));
  const spotMat = new THREE.MeshBasicMaterial({ map: maya.model.poolMat.map, color: new THREE.Color(PALETTE.light).multiplyScalar(0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), spotMat);
  spot.rotation.x = -PI / 2;
  spot.position.y = 0.01;
  lab.add(spot);

  const eye = maya.model.body.children.find((o) => o.isMesh && o.material === maya.model.eyeMat);
  const eyeScale0 = eye ? eye.scale.clone() : null;
  const restore = () => {
    if (eye && eyeScale0) eye.scale.copy(eyeScale0);
    for (const o of maya.group.children) if (o.material === maya.model.ringMat || o.material === maya.model.poolMat) o.visible = true;
  };
  lab.cleanup(restore);

  let bridged = false;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    // claw
    const hy = hubY(T);
    const cy = hubYk(T);
    const sway = wob(T);
    const at = lab.pos(3 + sway, cy);
    claw.visible = T > 1.22 && T < 3.76;
    claw.position.set(at.x, hy, at.z);
    headG.rotation.z = -sway * 1.6;
    headG.rotation.x = -carryAcc(T) * 0.1;
    const sp = spread(T);
    const cu = curl(T);
    for (const f of fingers) {
      f.k.rotation.z = sp;
      f.j.rotation.z = -cu - (sp - 0.55) * 0.4;
    }
    spotMat.opacity = 0.3 * span(T, 1.3, 1.66) * (1 - span(T, 3.1, 3.5));
    spot.position.x = at.x;
    spot.position.z = at.z;
    glintMat.opacity = glintK(T);
    glint.position.set(at.x, GRAB - 0.08, at.z + 0.18);
    glint.scale.setScalar(0.5 + 0.6 * (1 - glintK(T)));

    // Maya: on the glass until grabbed, then hanging from the claw until dropped
    const held = T >= 2.1 && T < 3.04;
    const carried = T >= 2.1;
    const lift = carried ? Math.max(0, hy - GRAB) * (T < 3.04 ? 1 : 0) + (T >= 3.04 ? LIFT + fall(T) : 0) : 0;
    const swingP = held ? -carryAcc(T) * 0.22 : 0;
    const swingR = held ? -wob(T - 0.06) * 2.6 : 0;
    maya.set({
      x: held ? 3 + wob(T - 0.06) : mx(T),
      y: carried ? (T < 3.04 ? cy : 1) : 2,
      lift: Math.max(0, lift),
      rot: mrot(T),
      pitch: mpitch(T) + swingP,
      roll: swingR + shake(T),
      sy: msy(T),
      sx: msq(T),
      sz: msq(T),
      trail: T < 2.06, // carried, not driven: no trail
    });
    if (T >= 3.15 && !bridged) {
      // end her trail where she landed without drawing the stretch she flew (dead points, already faded),
      // so the game doesn't wipe the trail as if she had jumped
      bridged = true;
      const tr = maya.bot.trail;
      const last = tr[tr.length - 1];
      const here = lab.pos(3, 1);
      if (last) tr.push({ x: last.x, z: last.z, t: -100 }, { x: here.x, z: here.z, t: -100 });
    }
    theo.set({ rot: trot(T), pitch: tpitch(T) + snicker(T), sy: tsy(T), sx: 2 - tsy(T), sz: 2 - tsy(T) });
  });

  // the card steps aside to make room for the claw
  const cardSlide = track([[1.16, 0], [1.42, -0.85, back(1.4)], [3.5, -0.85], [3.78, 0, E.inOut]], E.inOut);
  // while she's in the air her ring and pool stay on the glass, a shadow made of light
  const onGlass = new THREE.Group();
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.385 * 1.3, 0.41 * 1.3, 64), maya.model.ringMat.clone());
  ring2.rotation.x = -PI / 2;
  ring2.position.y = 0.008;
  const pool2 = new THREE.Mesh(new THREE.PlaneGeometry(1.25 * 1.3, 1.25 * 1.3), maya.model.poolMat.clone());
  pool2.rotation.x = -PI / 2;
  pool2.position.y = 0.006;
  onGlass.add(pool2, ring2);
  lab.add(onGlass);
  onGlass.visible = false;
  const own = maya.group.children.filter((o) => o.material === maya.model.ringMat || o.material === maya.model.poolMat);

  maya.each = (m, t) => {
    const T = t - t0;
    const c = maya.bot.card;
    if (c) {
      if (c.position.y < 1) c.visible = false; // a new card isn't placed until the next frame
      c.position.x += cardSlide(T);
    }
    const up = maya.group.position.y;
    const air = up > 0.015;
    for (const o of own) o.visible = !air;
    onGlass.visible = air;
    onGlass.position.set(maya.group.position.x, 0, maya.group.position.z);
    ring2.material.opacity = 0.9 * Math.max(0.35, 1 - up * 1.2);
    pool2.material.opacity = 0.75 * Math.max(0.3, 1 - up * 1.4);
    const sc = 1 + up * 0.5;
    onGlass.scale.set(sc, 1, sc);
    if (T > 1.4 && T < 3.3) m.body.position.y = 0; // no idle bob while she's frozen or hanging
    const b = eyeB(T);
    m.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
    if (eye) eye.scale.set(eyeScale0.x * eyeH(T), eyeScale0.y * eyeW(T), eyeScale0.z * eyeH(T));
  };

  const card = (at, id, fx, d = 0.08) =>
    lab.at(at, () => {
      lab.playCard('a', [id]);
      lab.arena.emit('play', { id: 'a', cards: [id] });
      lab.at(d, fx);
    });
  card(C.m2, 'm2', () => lab.arena.emit('move', { id: 'a', n: 2, dur: 0.62 }));
  card(C.rr, 'rr', () => lab.arena.emit('turn', { id: 'a', by: 1 }));
  card(C.bk, 'bk', () => {});
  card(C.ut, 'ut', () => lab.arena.emit('turn', { id: 'a', by: 2 }));
  lab.at(3.17, () => lab.ring(lab.pos(3, 1), '#ff8fa3', 0.42, 0.02, 0.4));

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  for (const o of own) o.visible = true;
  onGlass.visible = false;
  claw.visible = false;
  spotMat.opacity = 0;
  glintMat.opacity = 0;
  maya.release({ x: 3, y: 1, d: 0 });
  theo.release({ x: 5, y: 0, d: 2 });
}
