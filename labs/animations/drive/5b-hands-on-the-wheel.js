// Drive, idea 31 "Steering-wheel card", animator b (character acting).
export const meta = {
  title: 'Hands on the wheel',
  idea:
    'The lit card above Maya is her controls and she is the eager little car underneath, a split second behind. ' +
    'Throttle forward: she squats, then launches nose-up and nose-dives as she brakes. Wheel a quarter right: she leans into the corner like a scooter, and flinches when the wheel springs back. ' +
    'Lever back toward the room: she reverses with her glow blinking like a beeper. The U-Turn is two big hand-over-hand pulls; she whips round after them and the wheel spins back so fast she is left wobbling, dizzy. Theo leans away from the spin.',
  notes:
    'Sound: a soft glass "thunk" as each control moves, the robot\'s own move sound a hair later; two tiny high glass ticks for the reversing beeper; a rising whirr on the hand-over-hand and a quick ratchet as the wheel spins home. ' +
    'Port: the card already exists (cardSprite); swap it for a plane with the same texture so it can tip in 3D. Card leads the robot by ~0.07 s, so the whole beat is no longer than today\'s. ' +
    'The dizzy wobble only after a U-Turn; everything else is quick enough for every register.',
};

const PI = Math.PI;
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
  const { THREE, ease: E, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const t0 = lab.t;
  const back = (s) => (k) => E.outBack(k, s);
  const spring = (k) => 1 - Math.exp(-6 * k) * Math.cos(k * 3.2 * PI); // let go: overshoots and settles

  // when each card turns over
  const C = { m2: 0.0, rr: 1.0, bk: 1.82, ut: 2.72 };
  const END = 4.28;
  const tip0 = 0.62; // how far the lever tips (radians)

  // ----- the card: tip (+ toward the room, - forward) and wheel (- clockwise) -----
  const tip = track([
    [0.16, 0], [0.3, -tip0, E.out3], [0.6, -tip0 * 0.9], [0.8, 0, spring], // throttle
    [C.bk + 0.12, 0], [C.bk + 0.26, tip0 * 1.35, E.out3], [C.bk + 0.62, tip0 * 1.25], [C.bk + 0.84, 0, spring], // reverse
  ], E.inOut);
  const wheel = track([
    [C.rr + 0.16, 0], [C.rr + 0.34, -PI / 2, E.inOut], [C.rr + 0.5, -PI / 2], [C.rr + 0.78, 0, spring], // a quarter right
    [C.ut + 0.14, 0], [C.ut + 0.3, -PI / 2, E.inOut], [C.ut + 0.36, -PI / 2 - 0.06, E.out], // hand over hand: one...
    [C.ut + 0.52, -PI, E.inOut], [C.ut + 0.66, -PI], [C.ut + 1.02, 0, spring], // ...two, and let go
  ], E.inOut);

  // ----- Maya: the car, a split second behind -----
  const L = 0.07; // lag behind the controls
  const mx = track([[0.3 + L, 1], [0.86 + L, 3, (k) => E.inOut3(k)]], E.inOut);
  const my = track([[C.bk + 0.28 + L, 2], [C.bk + 0.78 + L, 1, E.inOut]], E.inOut);
  const mrot = track([
    [C.rr + 0.18 + L, facing(1)], [C.rr + 0.4 + L, facing(2), back(1.4)],
    [C.ut + 0.16 + L, facing(2)], [C.ut + 0.34 + L, facing(2) - PI / 2, E.inOut], [C.ut + 0.38 + L, facing(2) - PI / 2 - 0.05, E.out],
    [C.ut + 0.54 + L, facing(2) - PI, back(1.6)],
  ], E.inOut);
  // body: squat before the throttle, nose up as she launches, nose-dive braking; reversing the other way round
  const mpitch = track([
    [0.12, 0], [0.3, 0.07, E.out], [0.42, -0.24, E.out3], [0.78, -0.04], [0.98, 0.2, E.out], [1.14, -0.05, E.inOut], [1.28, 0, E.inOut],
    [C.bk + 0.3, 0], [C.bk + 0.44, 0.16, E.out3], [C.bk + 0.76, 0.06], [C.bk + 0.92, -0.16, E.out], [C.bk + 1.06, 0.03, E.inOut], [C.bk + 1.18, 0, E.inOut],
  ], E.inOut);
  const msy = track([
    [0.12, 1], [0.3, 0.86, E.out], [0.44, 1.08, E.out], [0.62, 1], [0.96, 0.92, E.out], [1.12, 1, E.out],
    [C.ut + 0.14, 1], [C.ut + 0.26, 0.9, E.out], [C.ut + 0.62, 1.06, E.out], [C.ut + 0.8, 1, E.inOut],
  ], E.inOut);
  // lean into the corner like a scooter; flinch when the wheel springs back
  const mroll = track([
    [C.rr + 0.18, 0], [C.rr + 0.36, 0.24, E.out], [C.rr + 0.52, 0.04, E.inOut], [C.rr + 0.6, -0.1, E.out], [C.rr + 0.76, 0, E.inOut],
    [C.ut + 0.16, 0], [C.ut + 0.4, 0.26, E.out], [C.ut + 0.58, 0.3], [C.ut + 0.7, 0, E.inOut],
  ], E.inOut);
  // dizzy: once the wheel spins home she keeps going round in her head
  const dizzyA = C.ut + 0.7;
  const dizzy = (T) => (T < dizzyA ? 0 : Math.exp(-(T - dizzyA) * 2.5) * span(T, dizzyA, dizzyA + 0.1) * (1 - span(T, END - 0.35, END)));
  const dRoll = (T) => 0.27 * dizzy(T) * Math.sin((T - dizzyA) * 2 * PI * 2.1);
  const dPitch = (T) => 0.19 * dizzy(T) * Math.cos((T - dizzyA) * 2 * PI * 2.1);
  const dYaw = (T) => 0.1 * dizzy(T) * Math.sin((T - dizzyA) * 2 * PI * 1.5 + 0.6);
  // reversing beeper: two blips of her glow
  const beep = (T) => {
    const a = C.bk + 0.3;
    const blip = (c) => Math.max(0, 1 - Math.abs(T - c) / 0.05);
    return blip(a) + blip(a + 0.22);
  };

  // ----- Theo: leans away from the spin, then cocks his head at her -----
  const tpitch = track([[C.ut + 0.3, 0], [C.ut + 0.42, -0.15, E.out], [C.ut + 0.9, -0.12], [C.ut + 1.15, 0, E.inOut]], E.inOut);
  const troll = track([[C.ut + 0.85, 0], [C.ut + 1.05, -0.2, E.out], [C.ut + 1.4, -0.18], [C.ut + 1.55, 0, E.inOut]], E.inOut);
  const trot = track([[C.ut + 0.2, facing(2)], [C.ut + 0.45, facing(2) + 0.35, E.out], [C.ut + 1.2, facing(2) + 0.3], [C.ut + 1.5, facing(2), E.inOut]], E.inOut);

  // ----- the card as a hinged plane (a sprite can't tip) -----
  const root = new THREE.Group();
  const hinge = new THREE.Group();
  const wheelG = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  plane.renderOrder = 30;
  root.add(hinge);
  hinge.add(wheelG);
  wheelG.add(plane);
  lab.add(root);
  root.visible = false;

  // three little motes of light circling over her head while she's dizzy
  const moteMat = new THREE.SpriteMaterial({ map: maya.model.poolMat.map, color: new THREE.Color(3, 2.8, 2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const motes = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(moteMat);
    s.scale.setScalar(0.13);
    lab.add(s);
    return s;
  });
  const head = new THREE.Vector3();

  maya.each = (m, t) => {
    const T = t - t0;
    const c = maya.bot.card;
    if (c) {
      c.visible = false;
      // the frame a new card is made, the game hasn't placed it yet
      root.visible = c.position.y > 1;
      if (plane.material.map !== c.material.map) {
        plane.material.map = c.material.map;
        plane.material.needsUpdate = true;
      }
      const W = c.scale.x;
      const H = c.scale.y;
      root.position.copy(c.position);
      root.quaternion.copy(lab.camera3.quaternion);
      hinge.position.set(0, -H / 2, 0);
      const tp = tip(T);
      hinge.rotation.x = tp;
      wheelG.position.set(0, H / 2, 0);
      wheelG.rotation.z = wheel(T);
      plane.scale.set(W, H, 1);
      plane.material.opacity = c.material.opacity;
      // tipped forward it goes into shadow
      const lit = 1 - 0.35 * Math.max(0, -tp / tip0);
      plane.material.color.setScalar(lit);
    }
    const bp = beep(T);
    if (bp > 0) {
      m.poolMat.color.set('#ff4d6d').multiplyScalar(0.9).lerp(new THREE.Color(2.6, 2.3, 2.0), Math.min(1, bp));
      m.poolMat.opacity = Math.min(1, m.poolMat.opacity + 0.4 * bp);
      m.ringMat.color.set('#ff4d6d').multiplyScalar(1.6).lerp(new THREE.Color(3, 2.8, 2.6), Math.min(1, bp));
    } else {
      m.poolMat.color.set('#ff4d6d').multiplyScalar(0.9);
      m.ringMat.color.set('#ff4d6d').multiplyScalar(1.6);
    }
    // dizzy eye: flickers dim and bright as she wobbles
    const dz = dizzy(T);
    moteMat.opacity = Math.min(1, dz * 1.6) * span(T, dizzyA, dizzyA + 0.15);
    maya.group.getWorldPosition(head);
    motes.forEach((s, i) => {
      const a = (T - dizzyA) * 2 * PI * 1.3 + (i * 2 * PI) / 3;
      s.position.set(head.x + Math.cos(a) * 0.3, 0.62 + Math.sin(a * 2) * 0.03, head.z + Math.sin(a) * 0.3);
    });
    if (dz > 0.02) {
      const f = 1 - 0.55 * dz * (0.5 + 0.5 * Math.sin((T - dizzyA) * 2 * PI * 4.3));
      m.eyeMat.color.setRGB(3.2 * f, 3.1 * f, 2.9 * f);
    }
  };

  const stop = lab.every((dt, t) => {
    const T = t - t0;
    maya.set({
      x: mx(T),
      y: my(T),
      rot: mrot(T) + dYaw(T),
      pitch: mpitch(T) + dPitch(T),
      roll: mroll(T) + dRoll(T),
      sy: msy(T),
      sx: 1 + (1 - msy(T)) * 0.6,
      sz: 1 + (1 - msy(T)) * 0.6,
    });
    theo.set({ pitch: tpitch(T), roll: troll(T), rot: trot(T) });
  });

  const card = (at, id, fx) =>
    lab.at(at, () => {
      lab.playCard('a', [id]);
      lab.arena.emit('play', { id: 'a', cards: [id] });
      lab.at(0.2, fx);
    });
  card(C.m2, 'm2', () => lab.arena.emit('move', { id: 'a', n: 2, dur: 0.56 }));
  card(C.rr, 'rr', () => lab.arena.emit('turn', { id: 'a', by: 1 }));
  card(C.bk, 'bk', () => lab.arena.emit('move', { id: 'a', n: 1, dur: 0.5 }));
  card(C.ut, 'ut', () => lab.arena.emit('turn', { id: 'a', by: 2 }));

  await lab.wait(END);
  stop();
  maya.each = null;
  root.visible = false;
  if (maya.bot.card) maya.bot.card.visible = true;
  maya.release({ x: 3, y: 1, d: 0 });
  theo.release({ x: 5, y: 0, d: 2 });
}
