// Drive, idea 45 "Backing away slowly", animator b (character acting).
export const meta = {
  title: 'Caught looking',
  idea:
    'Rotate Right swings Maya round to face the room; a beat later it registers and she freezes mid-breath: her eye flares wide, she rocks back and stands up a hair taller, like someone who has just noticed the whole sofa watching. ' +
    'Move Back becomes a two-step tiptoe retreat with her eye locked on us, her ring dimming as she tries to take up less room; then the U-Turn snaps her round to face north and she sways, whistling, as if nothing happened. ' +
    'Theo, who has faced the camera all along, slowly turns to watch her go, and when she snaps away he turns back and gives the room a long flat look.',
  notes:
    'Sound: a held glass tone that cuts dead on the freeze; two soft muted taps for the tiptoe steps; a bright little flick on the snap. ' +
    'Port: the take (flare, recoil, stand-tall) plays whenever a turn ends facing the camera, inside the turn beat. The held freeze and the slow two-step retreat play only when the next card of a robot facing the camera is Move Back (the host can see the next beat), costing about 0.8 s. ' +
    "Theo's flat look is the bystander rule: any robot facing the camera within 2 spaces gives the look after the snap.",
};

const PI = Math.PI;
const TAU = PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (T, a, b) => clamp01((T - a) / (b - a));

/** A keyframed channel: keys [[t, value, ease], ...]; each key's ease shapes the stretch arriving at it. */
function track(keys, inOut) {
  return (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = inOut] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return v0 + (v1 - v0) * e(t1 > t0 ? (T - t0) / (t1 - t0) : 1);
    }
    return keys[keys.length - 1][1];
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const E = ease;
  const outBack = (k) => ease.outBack(k, 1.3);
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const t0 = lab.t;

  // ----- Maya's acting, on one clock -----
  const C = { m2: 0.0, rr: 0.84, bk: 1.92, ut: 3.16 }; // when each card turns over
  const END = 4.3;

  // Move 2: an ordinary drive (the contrast is the point)
  const mx = track([[0.1, 1], [0.78, 3, E.inOut]], E.inOut);
  // Move Back: two careful tiptoe steps, a breath between
  const my = track([[2.0, 2], [2.5, 1.53, E.inOut], [2.6, 1.53], [3.08, 1, E.inOut]], E.inOut);
  const tip = (T) => 0.014 * (Math.sin(PI * span(T, 2.0, 2.5)) + Math.sin(PI * span(T, 2.6, 3.08)));
  const mrot = track([[0.92, facing(1)], [1.2, facing(2), E.out3], [3.24, facing(2)], [3.4, facing(2) - PI, outBack]], E.inOut);
  const mpitch = track([
    [0.1, 0], [0.24, -0.05, E.out], [0.62, 0], [0.8, 0.06, E.out], [0.98, 0, E.inOut], // drive: settle
    [1.3, 0], [1.4, -0.23, E.out3], [1.94, -0.19], [2.2, -0.13], [3.2, -0.13], // the take, eye on the room
    [3.3, 0, E.out], // snap
  ], E.inOut);
  const msy = track([[1.3, 1], [1.37, 1.08, E.out3], [1.52, 1.04], [2.0, 1.04], [2.45, 0.95], [3.2, 0.95], [3.3, 1, E.out]], E.inOut);
  const msx = track([[1.3, 1], [1.37, 0.95, E.out3], [1.52, 0.975], [2.0, 0.975], [2.45, 1.02], [3.2, 1.02], [3.3, 1, E.out]], E.inOut);
  const mlift = track([[3.26, 0], [3.4, 0.03, E.out], [3.58, 0, E.in]], E.inOut);
  // her eye: wide and bright on the take, narrowing a little as she sneaks off, normal on the snap
  const eyeW = track([[1.3, 1], [1.35, 1.95, E.out3], [1.94, 1.8], [3.1, 1.5], [3.28, 1, E.out]], E.inOut);
  const eyeH = track([[1.3, 1], [1.35, 1.8, E.out3], [1.94, 1.65], [3.1, 1.3], [3.28, 1, E.out]], E.inOut);
  const eyeB = track([[1.29, 1], [1.34, 3.2, E.out], [1.6, 2.3], [3.1, 2.0], [3.28, 1, E.out]], E.inOut);
  // her presence: ring and pool dim while she tries to be small
  const glowK = track([[1.95, 1], [2.7, 0.42], [3.24, 0.42], [3.4, 1, E.out]], E.inOut);
  // whistling innocently after the snap
  const sway = (T) => (T < 3.42 ? 0 : 0.05 * Math.sin(TAU * (T - 3.42) / 0.46) * (1 - span(T, 3.42, 4.25)) ** 1.3);

  // ----- Theo: watches her sneak off, then gives the room a look -----
  const trot = track([
    [0, facing(2)], [2.15, facing(2)], [2.5, facing(2) - 0.42, E.inOut], [3.1, facing(2) - 0.5],
    [3.5, facing(2) - 0.5], [3.7, facing(2), E.inOut],
  ], E.inOut);
  const tpitch = track([[3.62, 0], [3.76, -0.13, E.out], [4.08, -0.13], [4.28, 0, E.inOut]], E.inOut);
  const teye = track([[3.62, 1], [3.76, 1.7, E.out], [4.08, 1.7], [4.28, 1, E.inOut]], E.inOut);

  // ----- the eye's flare -----
  const eye = maya.model.body.children.find((o) => o.isMesh && o.material === maya.model.eyeMat);
  const eyeScale0 = eye ? eye.scale.clone() : null;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: maya.model.poolMat.map, color: new THREE.Color('#fff4e6').multiplyScalar(3.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  flare.renderOrder = 25;
  lab.add(flare);
  const flareK = (T) => (T < 1.3 ? 0 : Math.exp(-(T - 1.31) * 5.5) * span(T, 1.3, 1.33));
  const eyeAt = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const restore = () => eye && eyeScale0 && eye.scale.copy(eyeScale0);
  lab.cleanup(restore);

  maya.each = (m, t) => {
    const T = t - t0;
    m.body.position.y = T > 1.28 && T < 3.24 ? 0 : m.body.position.y; // frozen: no idle bob
    if (maya.bot.card && maya.bot.card.position.y < 1) maya.bot.card.visible = false; // a new card isn't placed until the next frame
    const b = eyeB(T);
    m.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
    if (eye) eye.scale.set(eyeScale0.x * eyeH(T), eyeScale0.y * eyeW(T), eyeScale0.z * eyeH(T));
    const g = glowK(T);
    m.ringMat.opacity *= g;
    m.poolMat.opacity *= 0.35 + 0.65 * g;
    if (eye) {
      eye.getWorldPosition(eyeAt);
      toCam.copy(lab.camera3.position).sub(eyeAt).normalize().multiplyScalar(0.08);
      flare.position.copy(eyeAt).add(toCam);
      const f = flareK(T);
      flare.material.opacity = f;
      const s = 0.35 + 0.5 * (1 - f);
      flare.scale.set(s * 1.5, s, 1);
    }
  };
  theo.each = (m, t) => {
    const b = teye(t - t0);
    m.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
  };

  const stop = lab.every((dt, t) => {
    const T = t - t0;
    maya.set({
      x: mx(T),
      y: my(T),
      rot: mrot(T),
      pitch: mpitch(T),
      roll: sway(T),
      lift: mlift(T) + tip(T),
      sx: msx(T),
      sz: msx(T),
      sy: msy(T),
    });
    theo.set({ rot: trot(T), pitch: tpitch(T) });
  });

  const card = (at, id, extra) =>
    lab.at(at, () => {
      lab.playCard('a', [id]);
      lab.arena.emit('play', { id: 'a', cards: [id] });
      extra?.();
    });
  card(C.m2, 'm2', () => lab.at(0.1, () => lab.arena.emit('move', { id: 'a', n: 2, dur: 0.68 })));
  card(C.rr, 'rr', () => lab.at(0.08, () => lab.arena.emit('turn', { id: 'a', by: 1 })));
  card(C.bk, 'bk', () => lab.at(0.08, () => lab.arena.emit('move', { id: 'a', n: 1, dur: 1.08 })));
  card(C.ut, 'ut', () => lab.at(0.08, () => lab.arena.emit('turn', { id: 'a', by: 2 })));

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  theo.each = null;
  flare.visible = false;
  maya.release({ x: 3, y: 1, d: 0 });
  theo.release({ x: 5, y: 0, d: 2 });
}
