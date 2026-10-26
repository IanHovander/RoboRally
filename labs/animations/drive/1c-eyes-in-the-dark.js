// Drive, idea 1 (backing away slowly), animator c: told with the camera and the room's darkness.
// Rotate Right swings Maya round to face the TV and the picture snaps in on her like a sitcom crash zoom; her
// eye flares with a long anamorphic streak of light, and she rocks back a hair. Move Back plays slowly while the
// room's darkness closes in round her like an old film iris, until only her eye is left glowing in the dark
// (she blinks). The U-Turn snaps her round to face north, the iris and the zoom snap open in the same instant,
// and she is just a robot on a board again, as if nothing happened.
export const meta = {
  title: 'Eyes in the dark',
  idea:
    "Rotate Right turns Maya to face the room and the picture crash-zooms in on her: caught. Her eye flares into a wide streak of light and she rocks back a hair. Move Back plays slowly, her eye locked on the sofa, while the room's darkness closes round her like an old film iris until only her eye is left glowing in the dark, and it blinks. Then the U-Turn whips her round to face north and the iris and the zoom snap open together, as if nothing happened.",
  notes:
    'Trigger (as the idea says): only when a robot already facing the camera plays Move Back. Everyday version, no added time: any robot that turns to face the camera gets the flare streak and the tiny rock back, no zoom, no iris. Sound: a soft glass "tink" on the crash zoom, silence while she backs off (one low glass hum under the iris), a tiny click for the blink, a quick bright swish for the U-Turn with the iris. Porting: the iris is a HUD-layer radial mask centred on the robot\'s eye (screen position), the zoom is a camera take on the robot that is released on the snap.',
};

const TAU = Math.PI * 2;

// a horizontal streak of light (an anamorphic lens flare)
function streakTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 512, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.15, 'rgba(255,255,255,.12)');
  h.addColorStop(0.4, 'rgba(255,255,255,.45)');
  h.addColorStop(0.49, 'rgba(255,255,255,.9)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(0.51, 'rgba(255,255,255,.9)');
  h.addColorStop(0.6, 'rgba(255,255,255,.45)');
  h.addColorStop(0.85, 'rgba(255,255,255,.12)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 512, 64);
  // fade top and bottom
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const end = lab.scenario.after.a;
  const maya = lab.puppet('a');
  const model = maya.model;

  // her eye: found among her parts, so it can widen and blink
  let eye = null;
  model.body.traverse((o) => {
    if (!eye && o.isMesh && o.material === model.eyeMat) eye = o;
  });
  const eyeS0 = eye ? eye.scale.clone() : null;
  lab.cleanup(() => eye && eye.scale.copy(eyeS0));
  let eyeGain = 1;
  let eyeW = 1;
  let eyeH = 1;
  let drawFxHook = null;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * eyeGain, 3.1 * eyeGain, 2.9 * eyeGain);
    if (eye) eye.scale.set(eyeS0.x * eyeH, eyeS0.y * eyeW, eyeS0.z * eyeH);
    drawFxHook?.();
  };
  const eyeAt = () => {
    const v = new THREE.Vector3();
    if (eye) eye.getWorldPosition(v);
    else v.copy(maya.group.position).setY(0.3);
    return v;
  };

  // the flare: a long streak and a soft bloom through her eye, drawn over everything
  const streakMat = new THREE.SpriteMaterial({ map: streakTexture(THREE), color: new THREE.Color('#fff1dc').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const streak = new THREE.Sprite(streakMat);
  streak.renderOrder = 40;
  const bloomMat = new THREE.SpriteMaterial({ map: glowTexture(THREE), color: new THREE.Color('#fff1dc').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const bloom = new THREE.Sprite(bloomMat);
  bloom.renderOrder = 40;
  lab.add(streak);
  lab.add(bloom);
  let flare = 0;

  // the iris: the room's darkness closing on her eye (a HUD-layer mask)
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  let irisK = 0; // 0 open .. 1 closed to her ring
  let pinch = 0; // 0 .. 1 closed down to just her eye

  // the camera: a crash zoom onto her that follows her back
  let zoom = 0;
  const camRelease = lab.camera((home) => {
    const focus = maya.group.position.clone().setY(0.55);
    return {
      target: home.target.clone().lerp(focus, 0.9 * zoom),
      fov: home.fov - 11 * zoom,
      el: home.el - 0.05 * zoom,
    };
  });

  // (drawn from her per-frame hook: it runs after her pose is placed, so the eye is where we see it)
  let fxOn = true;
  const drawFx = () => {
    if (!fxOn) return;
    const p = eyeAt();
    streak.position.copy(p);
    bloom.position.copy(p);
    streak.scale.set(0.3 + 5.2 * flare, 0.07 + 0.03 * flare, 1);
    streakMat.opacity = Math.min(1, flare * 1.3);
    bloom.scale.setScalar(0.2 + 0.3 * flare);
    bloomMat.opacity = Math.min(1, flare * 1.2);
    // the card above her goes into the dark with the room
    const card = maya.bot.card;
    if (card) card.material.opacity *= 1 - Math.min(1, Math.max(0, (irisK - 0.5) * 2.5));
    if (irisK > 0.001) {
      const s = lab.toScreen(p);
      const o = lab.toScreen(maya.group.position);
      const u = lab.toScreen(maya.group.position.clone().add(new THREE.Vector3(1, 0, 0)));
      const unit = Math.hypot(u.x - o.x, u.y - o.y); // pixels per space, at her
      const big = 2400;
      // round her, then pinched to a slot the shape of her eye
      const rx = big + (unit * (0.62 - 0.3 * pinch) - big) * irisK;
      const ry = big + (unit * (0.62 - 0.48 * pinch) - big) * irisK;
      const dark = 0.97 * Math.min(1, irisK * 1.5);
      iris.style.opacity = '1';
      iris.style.background = `radial-gradient(ellipse ${rx}px ${ry}px at ${s.x}px ${s.y}px, rgba(4,5,8,0) ${45 + 10 * (1 - pinch)}%, rgba(4,5,8,${dark}) 100%)`;
    } else iris.style.opacity = '0';
  };

  drawFxHook = drawFx;

  // ---- Move 2: an ordinary drive east ----
  lab.playCard('a', ['m2']);
  await lab.wait(0.08);
  await lab.tween(0.6, (e, k) => maya.set({ x: 1 + 2 * e, pitch: 0.07 * Math.sin(k * Math.PI) }), ease.inOut);
  await lab.wait(0.06);

  // ---- Rotate Right: she turns to face the room ----
  lab.playCard('a', ['rr']);
  await lab.wait(0.06);
  await lab.tween(0.3, (e) => maya.set({ rot: facing(1) + (facing(2) - facing(1)) * e }), ease.out3);

  // caught: crash zoom, the eye flares, she rocks back a hair
  lab.shake(0.012, 0.15);
  lab.tween(0.08, (e) => (zoom = e), ease.out3);
  lab.tween(0.08, (e) => {
    flare = e;
    eyeGain = 1 + 2.4 * e;
    eyeW = 1 + 0.9 * e;
    eyeH = 1 + 0.5 * e;
  }, ease.out);
  await lab.tween(0.1, (e) => maya.set({ pitch: -0.16 * e, sy: 1 + 0.05 * e }), ease.out);
  // the flare dies away while she holds, frozen, rocked back
  lab.tween(0.45, (e) => (flare = 1 - e), ease.out);
  await lab.tween(0.36, (e) => maya.set({ pitch: -0.16 + 0.09 * e, sy: 1.05 - 0.03 * e }), ease.inOut);

  // ---- Move Back: slowly, her eye never leaving the room, the dark closing in ----
  lab.playCard('a', ['bk']);
  lab.tween(1.0, (e) => (irisK = e), ease.inOut);
  await lab.tween(
    1.05,
    (e, k) => {
      // three careful tiptoe steps backward
      const step = Math.abs(Math.sin(k * Math.PI * 3));
      maya.set({ y: 2 - e, lift: 0.022 * step, sy: 1.02 - 0.03 * (1 - step), pitch: -0.07 + 0.03 * step });
      eyeGain = 2.2 - 0.4 * k;
      eyeW = 1.5 - 0.2 * k;
    },
    (k) => ease.inOut(k) * 0.85 + 0.15 * k,
  );
  maya.set({ lift: 0, sy: 1 });

  // ---- in the dark: only her eye. It blinks ----
  await lab.tween(0.16, (e) => (pinch = e), ease.inOut);
  await lab.tween(0.07, (e) => (eyeH = 1.5 * (1 - e) + 0.08 * e), ease.in);
  await lab.tween(0.08, (e) => (eyeH = 0.08 + 1.42 * e), ease.out);
  await lab.wait(0.16);

  // ---- U-Turn: snap round, the room snaps back, as if nothing happened ----
  lab.playCard('a', ['ut']);
  lab.tween(0.15, (e) => {
    irisK = 1 - e;
    pinch = 1 - e;
  }, ease.out);
  lab.tween(0.2, (e) => (zoom = 1 - e), ease.out3);
  lab.tween(0.2, (e) => {
    eyeGain = 1.8 - 0.8 * e;
    eyeW = 1.3 - 0.3 * e;
    eyeH = 1.5 - 0.5 * e;
  }, ease.out);
  await lab.tween(0.24, (e) => maya.set({ rot: facing(2) - Math.PI * e, pitch: -0.05 * (1 - e) }), (k) => ease.outBack(k, 1.2));
  // a tiny innocent settle
  await lab.tween(0.24, (e, k) => maya.set({ sy: 1 - 0.04 * Math.sin(k * Math.PI), rot: facing(2) - Math.PI }), ease.out);
  await lab.wait(0.1);

  fxOn = false;
  iris.remove();
  camRelease();
  maya.each = null;
  if (eye) eye.scale.copy(eyeS0);
  maya.release({ x: end.x, y: end.y, d: end.d });
  void TAU;
}
