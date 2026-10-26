// Wall, idea 10 (To camera), animator a: weight and physical comedy.
// Maya was sure of three spaces, so she never brakes: she hits the fin at full speed, her nose dives and her
// tail kicks up like a car stopping too hard, and she rocks to rest. A beat. Then the heavy, deliberate swivel:
// she turns to face straight out of the TV and rocks back onto her heel to look up into the lens, the way you
// crane up at someone tall. Her eye light lands square on the room and flares in the lens. A dead-still stare,
// one slow blink. Then she drops off her heel with a clunk and turns back to the wall, nose to the fin.
export const meta = {
  title: 'To camera (deadpan)',
  idea:
    'She slams into the fin at full speed, nose-dives and rocks to rest. A beat. Then she turns, slowly and heavily, to face straight out of the TV and tips back on her heel to look up into the lens: her eye light lands square on the room and flares. She holds a dead-still stare at whoever programmed her, blinks once, then drops off her heel and turns back to the wall. The joke is on the person on the sofa.',
  notes:
    'Sound: one muffled glass thunk at the impact is the game\'s own bump; then silence through the swivel and the stare, and one soft tick as she turns back. ' +
    'All of it is pose: rot, pitch, lift (to pivot on her heel) and the eye light; the glare is one camera-facing glow at her eye. ' +
    'Porting: the stare points at the camera, so at a far end of a wide board the swivel aims at the camera\'s position (atan2 of the camera from her space), not plain south.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  lab.playCard('a', ['m3']);
  const glowTex = maya.model.poolMat.map;

  // the glare: a soft glow at her eye that only shows when the eye points into the lens
  const glare = lab.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#fff3e2').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
    ),
  );
  glare.renderOrder = 40;
  const eyeMesh = maya.model.body.children.find((o) => o.isMesh && o.material === maya.model.eyeMat);
  const tmp = new THREE.Vector3();

  const fx = { eye: 1, glare: 0, blink: 1 };
  // her card hangs over her on a soft spring: it swings when she stops dead
  const card = { p: null, v: new THREE.Vector3(), t: null };
  maya.each = (m, t) => {
    if (bot.card) {
      const want = bot.card.position.clone();
      if (!card.p) card.p = want.clone();
      const dt = card.t == null ? 0 : Math.min(0.05, t - card.t);
      card.t = t;
      const W = 12;
      const acc = want.clone().sub(card.p).multiplyScalar(W * W).addScaledVector(card.v, -2 * 0.35 * W);
      card.v.addScaledVector(acc, dt);
      card.p.addScaledVector(card.v, dt);
      bot.card.position.set(card.p.x, want.y, card.p.z);
    }
    const k = fx.eye * fx.blink;
    m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
    if (eyeMesh) {
      eyeMesh.getWorldPosition(tmp);
      glare.position.copy(tmp);
      glare.quaternion.copy(lab.camera3.quaternion);
      glare.scale.set(0.42 + 0.12 * fx.glare, 0.16 + 0.05 * fx.glare, 1); // the shape of her eye slit, square on
      glare.material.opacity = 0.9 * fx.glare * fx.blink;
    }
  };

  const glint = lab.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#ffffff').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
  );
  glint.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(-0.03, 0.16, 0));

  // one timeline (seconds from the start of the moment), so the beats land exactly where they're written
  const T = {
    run: 0.1, // wind-up ends, flat out
    hit: 0.52, // nose meets the fin
    still: 0.82, // rocked to rest: the beat
    turn: 0.98, // the swivel
    stare: 1.44, // square on the room
    blink: 1.72,
    drop: 2.12, // off her heel
    back: 2.21, // and back to the wall
    end: 2.42,
  };
  const R0 = facing(1);
  const R1 = facing(2); // straight out of the TV (the camera sits due south of her space)
  const TIP = -0.48; // rocked back on her heel to look up into the lens
  const HEEL = 0.38; // her heel, from her middle: tipping about it lifts her middle
  const tipPose = (p) => ({ pitch: TIP * p, lift: HEEL * Math.sin(-TIP * p) * 0.9 });
  const A = 0.42;
  const run = (k) => (k < A ? (k * k) / (2 * A) : A / 2 + (k - A)) / (1 - A / 2);
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

  await lab.tween(T.end, (_, kk) => {
    const t = kk * T.end;
    const pose = { x: 3, y: 1, rot: R0, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    fx.eye = 1;
    fx.glare = 0;
    fx.blink = 1;
    glint.quaternion.copy(lab.camera3.quaternion);
    glint.material.opacity = 0;
    if (t < T.run) {
      // ---- 1. she means three spaces: a little wind-up... ----
      const e = ease.out(t / T.run);
      Object.assign(pose, { x: 1 - 0.05 * e, pitch: -0.1 * e });
    } else if (t < T.hit) {
      // ...then flat out, no braking
      const k = seg(t, T.run, T.hit);
      Object.assign(pose, { x: 0.95 + 2.05 * run(k), pitch: -0.1 + 0.18 * Math.min(1, k * 2) });
    } else if (t < T.still) {
      // ---- 2. stopped dead: squash, nose-dive with the tail kicking up, rock back, settle ----
      const u = t - T.hit;
      glint.material.opacity = u < 0.03 ? u / 0.03 : Math.max(0, 1 - (u - 0.03) / 0.16) ** 2;
      const sq = Math.exp(-u / 0.05) * Math.cos(u * 40);
      const rock = 0.2 * Math.exp(-u / 0.09) * Math.sin(u * 21 + 0.35);
      Object.assign(pose, {
        x: 3 - 0.025 * Math.sin(Math.min(1, u / 0.12) * Math.PI),
        sz: 1 - 0.13 * sq,
        sx: 1 + 0.06 * sq,
        sy: 1 - 0.04 * sq,
        pitch: rock,
        lift: Math.max(0, rock) * 0.12,
      });
    } else if (t < T.turn) {
      // ---- 3. a beat. Perfectly still. ----
    } else if (t < T.stare) {
      // ---- 4. the swivel: heavy, slow to start, overshoots a hair; and back onto her heel ----
      const k = seg(t, T.turn, T.stare);
      // a small counter-turn first (she gathers herself), then the slow heavy sweep, a hair too far, back
      const q = seg(k, 0.2, 1);
      const turn = k < 0.2 ? -0.05 * Math.sin((Math.PI * k) / 0.2) : q < 0.78 ? 1.05 * ease.inOut3(q / 0.78) : 1.05 - 0.05 * ease.inOut((q - 0.78) / 0.22);
      const tip = ease.inOut(seg(k, 0.45, 1));
      Object.assign(pose, { rot: R0 + (R1 - R0) * turn, ...tipPose(tip + 0.06 * Math.sin(seg(k, 0.75, 1) * Math.PI)) });
      fx.eye = 1 + 0.7 * tip;
      fx.glare = tip ** 2;
    } else if (t < T.drop) {
      // ---- 5. the stare: dead still, square on the room. One slow blink. ----
      Object.assign(pose, { rot: R1, ...tipPose(1) });
      fx.eye = 1.7;
      fx.glare = 1;
      const b = seg(t, T.blink, T.blink + 0.16);
      fx.blink = 1 - Math.sin(b * Math.PI) ** 0.6;
    } else if (t < T.back) {
      // ---- 6. she drops off her heel: clunk ----
      const d = ease.in(seg(t, T.drop, T.back));
      Object.assign(pose, { rot: R1, ...tipPose(1 - d) });
      fx.eye = 1 + 0.7 * (1 - d);
      fx.glare = (1 - d) ** 2;
    } else {
      // ---- 7. and turns back to the wall, nose to the fin: tick ----
      const u = t - T.back;
      const k = seg(t, T.back, T.end);
      const turn = ease.out3(Math.min(1, k * 1.3));
      const thunk = Math.exp(-u / 0.04) * Math.cos(u * 50); // the landing rings through her
      Object.assign(pose, { rot: R1 + (R0 - R1) * turn, pitch: 0.05 * thunk, sy: 1 - 0.06 * thunk, sx: 1 + 0.03 * thunk, sz: 1 + 0.03 * thunk });
    }
    maya.set(pose);
  }, ease.linear);
  maya.set({ x: 3, y: 1, rot: R0, pitch: 0, sx: 1, sy: 1, sz: 1, lift: 0 });
  maya.each = null;
  glare.visible = false;
  maya.release({ x: 3, y: 1, d: 1 });
}
