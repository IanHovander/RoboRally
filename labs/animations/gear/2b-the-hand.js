// Gear, idea 2 (a hand in the dark), animator b: character acting.
// The light goes out at the far edge of the board. Maya notices, looks up, and shrinks. A huge soft shadow of a
// hand slides in and comes down, sharpening as it falls, and closes over her: in the dark only her eye is left,
// blinking twice. The fingers close, she is squeezed tall, her eye screws shut, and the hand twists her a quarter
// and lets go. She drops, the hand lifts away soft and huge, the light comes back, and she stares up after it,
// then puffs herself up and shakes it off, indignant. Theo, across the board, cowers the whole time and looks up
// last.
export const meta = {
  title: 'Eyes in the dark',
  idea:
    'The ghost of the cardboard game: a giant hand of darkness reaches in from the edge of the board, huge and soft while it is high up, sharp as it comes down. Maya looks up and shrinks; under the hand only her eye is left, blinking. It twists her a quarter, lets go and lifts away, and she glares up after it and shakes herself off, offended. Theo cowers until it has gone.',
  notes:
    'Sound: the room tone thins as the shadow grows (the light going out), two tiny glass blinks in the dark, a soft squeak of glass on glass for the twist, a muffled "tok" as she is dropped, then a short indignant chirp. The shadow is drawn every frame on a canvas (sharp hand, then blurred by its height) and laid on the glass as missing light, so it darkens the grid, the gear and her ring; her body, ring and glow dim by how much of the shadow is on her, but never her eye. It comes from the nearest board edge; a red gear twists the other way.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.after.a;
  const B = sc.bots.b;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });
  const gx = sc.bots.a.x;
  const gy = sc.bots.a.y;
  const gear = lab.arena.gears.get(`${gx},${gy}`);
  const spin = gear?.spin ?? 1;
  const rot0 = maya.pose.rot;
  const rot1 = rot0 + ((facing(A.d) - rot0 + 3 * Math.PI) % TAU) - Math.PI;
  const C = lab.pos(gx, gy);

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (k) => Math.sin(Math.PI * clamp(k));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ----- the nearest board edge: the arm comes in from there -----
  const W = lab.arena.course?.w ?? 7;
  const H = lab.arena.course?.h ?? 4;
  const edges = [
    { d: gy + 0.5, out: [0, -1] },
    { d: H - gy - 0.5, out: [0, 1] },
    { d: gx + 0.5, out: [-1, 0] },
    { d: W - gx - 0.5, out: [1, 0] },
  ].sort((a, b) => a.d - b.d);
  const out = edges[0].out; // (x, z) direction from Maya to the edge
  const baseAng = Math.atan2(out[0], -out[1]); // canvas rotation that points the fingers away from the edge

  // ----- the shadow: a sharp hand drawn on one canvas, blurred onto another, laid on the glass as missing light -----
  const PX = 56; // canvas pixels per space
  const N = 672; // 12 spaces across
  const shape = document.createElement('canvas');
  shape.width = shape.height = N;
  const sg = shape.getContext('2d');
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const cg = cv.getContext('2d', { willReadFrequently: true });
  const tex = new THREE.CanvasTexture(cv);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(N / PX, N / PX),
    new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, depthWrite: false }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(C.x, 0.02, C.z);
  plane.renderOrder = 8;
  lab.add(plane);
  const toCanvas = (wx, wz) => [N / 2 + (wx - C.x) * PX, N / 2 + (wz - C.z) * PX];

  /** the hand, in spaces: origin over Maya, +y toward the fingertips; open 0..1 (1 = spread), grip 0..1 */
  const drawHand = (g, cx, cy, ang, sc, open, grip) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.scale(sc * PX, sc * PX);
    g.translate(0, 0.4); // so that her centre is under the middle of the palm
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // the back of the hand, over her
    g.beginPath();
    g.moveTo(-0.34, -0.92);
    g.lineTo(0.3, -0.92);
    g.quadraticCurveTo(0.5, -0.5, 0.46, 0.06);
    g.lineTo(-0.48, 0.1);
    g.quadraticCurveTo(-0.52, -0.5, -0.34, -0.92);
    g.closePath();
    g.lineWidth = 0.16;
    g.fill();
    g.stroke();
    // four fingers: spread and long while open, curled down her far side (short from above) when gripping
    const fingers = [
      [-0.36, 0.06, -0.42, 0.56, 0.17], // little finger: knuckle x, y, spread angle, length, width
      [-0.13, 0.08, -0.16, 0.74, 0.19],
      [0.1, 0.08, 0.06, 0.8, 0.2],
      [0.32, 0.06, 0.3, 0.72, 0.19],
    ];
    for (const [kx, ky, a, len, w] of fingers) {
      const ang2 = a * (0.25 + 0.75 * open) * (1 - 0.6 * grip);
      const L = len * (0.55 + 0.45 * open) * (1 - 0.42 * grip);
      const tx = kx + Math.sin(ang2) * L;
      const ty = ky + Math.cos(ang2) * L;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(kx, ky - 0.05);
      g.quadraticCurveTo(kx + Math.sin(ang2) * L * 0.5, ky + Math.cos(ang2) * L * 0.5, tx, ty);
      g.stroke();
    }
    // the thumb: out wide while open, folded in against her side when gripping
    const tx = lerp(lerp(0.62, 0.95, open), 0.5, grip);
    const ty = lerp(lerp(0.1, -0.12, open), 0.2, grip);
    g.lineWidth = 0.24;
    g.beginPath();
    g.moveTo(0.34, -0.62);
    g.quadraticCurveTo(lerp(0.72, 0.62, grip), lerp(-0.42, -0.25, grip), tx, ty);
    g.stroke();
    g.restore();
  };

  // ----- Maya's and Theo's parts -----
  const findEye = (model) => {
    let eye = null;
    model.body.traverse((o) => {
      if (!eye && o.isMesh && o.material === model.eyeMat) eye = o;
    });
    return eye;
  };
  const mEye = findEye(maya.model);
  const tEye = findEye(theo.model);
  const mPaint = maya.model.paint.color.clone();
  const P0 = maya.model.paint;
  const mLook = { emis: P0.emissiveIntensity, coat: P0.clearcoat, spec: P0.specularIntensity, env: P0.envMapIntensity };
  const mEyeAt = mEye ? mEye.position.clone() : new THREE.Vector3();
  // Theo leans away from the hand: roll toward the side away from Maya
  const toMayaX = C.x - lab.pos(B.x, B.y).x;
  const toMayaZ = C.z - lab.pos(B.x, B.y).z;
  const tr = theo.pose.rot;
  const awayRoll = Math.sign(-Math.cos(tr) * toMayaX + Math.sin(tr) * toMayaZ) || 1;
  const toMayaL = Math.hypot(toMayaX, toMayaZ) || 1;
  const awayX = toMayaX / toMayaL; // (in spaces: x right, y toward us)
  const awayY = toMayaZ / toMayaL;
  const restore = () => {
    for (const m of [maya.model, theo.model]) {
      m.body.scale.set(1, 1, 1);
      m.body.rotation.set(0, 0, 0);
      m.body.position.x = 0;
    }
    maya.model.paint.color.copy(mPaint);
    P0.emissiveIntensity = mLook.emis;
    P0.clearcoat = mLook.coat;
    P0.specularIntensity = mLook.spec;
    P0.envMapIntensity = mLook.env;
    if (mEye) {
      mEye.scale.set(1, 1, 1);
      mEye.position.copy(mEyeAt);
    }
    if (tEye) tEye.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  // ----- the plan (seconds) -----
  const NOTICE = 0.08; // the light goes at the edge; she looks up
  const COVER = 0.45; // the hand is down over her: only her eye is left
  const GRIP = 0.8; // fingers close
  const TWIST = 0.87; // ...twist...
  const LET = 1.16; // ...let go
  const LIFT = 1.2; // the hand rises away
  const GONE = 1.5; // the light is back
  const GLARE = 1.31; // she looks up after it
  const HUFF = 1.48; // she puffs up, stamps, and shakes it off
  const STAMP = HUFF + 0.13;
  const END = 1.9;

  // the hand's path: slides in from the edge while high, then comes down onto her
  const handAt = (s) => {
    let off; // distance out toward the edge, in spaces
    let sc; // shadow size (bigger = higher)
    let blur; // px
    let op;
    let open;
    if (s < COVER) {
      const k = s / COVER;
      off = lerp(2.4, 0, ease.out(clamp(k * 1.2)));
      const down = ease.in(clamp((k - 0.1) / 0.9));
      sc = lerp(2.4, 1, down);
      blur = lerp(26, 1.5, down);
      op = lerp(0.85, 0.96, down) * ease.out(clamp(k * 4));
      open = 1;
    } else if (s < LIFT) {
      off = 0;
      sc = 1 - 0.04 * ease.inOut(seg(s, GRIP, TWIST)) + 0.04 * seg(s, LET, LIFT);
      blur = 1.5;
      op = 0.96;
      open = 1 - ease.inOut(seg(s, COVER, GRIP)) + ease.out(seg(s, LET, LIFT));
    } else {
      const k = seg(s, LIFT, GONE);
      const up = ease.in(k);
      sc = lerp(1, 2.6, up);
      blur = lerp(1.5, 34, up);
      op = 0.96 * (1 - ease.in(k));
      off = lerp(0, 2.6, ease.in(seg(s, LIFT + 0.08, GONE)));
      open = 1;
    }
    const grip = ease.out(seg(s, COVER + 0.06, GRIP + 0.04)) * (1 - ease.out(seg(s, LET, LET + 0.06)));
    // the twist, and the wrist relaxing back as it lifts away
    const tw = ease.inOut(seg(s, TWIST, LET)) * (1 - 0.7 * ease.inOut(seg(s, LIFT, GONE)));
    return { off, sc, blur, op, open, grip, tw };
  };

  const stampRing = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 72),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(sc.bots.a.color).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  stampRing.rotation.x = -Math.PI / 2;
  stampRing.position.set(C.x, 0.02, C.z);
  stampRing.visible = false;
  lab.add(stampRing);
  const t0 = lab.t;
  const stop = lab.every(() => {
    const s = lab.t - t0;
    const h = handAt(s);
    // where the hand's origin is (over Maya, or out toward the edge), and its turn
    const hx = C.x + out[0] * h.off;
    const hz = C.z + out[1] * h.off;
    const turn = rot1 - rot0; // world turn (counter-clockwise +)
    const ang = baseAng - turn * h.tw; // the canvas turns the other way round
    // draw it sharp, arm first (the arm runs back to well past the edge)
    sg.clearRect(0, 0, N, N);
    const [cx, cy] = toCanvas(hx, hz);
    const wristL = [0, -0.45];
    const wx = cx + (Math.cos(ang) * wristL[0] - Math.sin(ang) * wristL[1]) * h.sc * PX;
    const wy = cy + (Math.sin(ang) * wristL[0] + Math.cos(ang) * wristL[1]) * h.sc * PX;
    const [ex, ey] = toCanvas(hx + out[0] * 7, hz + out[1] * 7);
    sg.strokeStyle = '#000';
    sg.lineCap = 'round';
    sg.lineWidth = 0.66 * h.sc * PX;
    sg.beginPath();
    sg.moveTo(wx, wy);
    sg.quadraticCurveTo(cx + (wx - cx) * 1.8, cy + (wy - cy) * 1.8, ex, ey);
    sg.stroke();
    drawHand(sg, cx, cy, ang, h.sc, h.open, h.grip);
    // blur it by its height, and fade it by how far up it is
    cg.clearRect(0, 0, N, N);
    cg.filter = `blur(${h.blur.toFixed(1)}px)`;
    cg.globalAlpha = h.op;
    cg.drawImage(shape, 0, 0);
    cg.filter = 'none';
    cg.globalAlpha = 1;
    tex.needsUpdate = true;
    // how dark it is where Maya and Theo stand
    const cov = cg.getImageData(N / 2, N / 2, 1, 1).data[3] / 255;
    const [tcx, tcy] = toCanvas(...((p) => [p.x, p.z])(lab.pos(B.x, B.y)));
    const tcov = tcx > 0 && tcy > 0 && tcx < N && tcy < N ? cg.getImageData(tcx | 0, tcy | 0, 1, 1).data[3] / 255 : 0;

    // ----- Maya -----
    const look = ease.out(seg(s, NOTICE, NOTICE + 0.1)) * (1 - ease.inOut(seg(s, COVER - 0.12, COVER + 0.04))); // looks up at it
    const cringe = ease.out(seg(s, 0.2, 0.36)) * (1 - seg(s, GRIP - 0.02, GRIP + 0.04));
    const tremble = cringe * Math.sin(s * 95) * 0.04;
    const inDark = seg(s, COVER - 0.03, COVER + 0.03) * (1 - seg(s, GRIP - 0.03, GRIP)); // the eyes-in-the-dark beat
    const u = s - COVER; // her eye glances left... right... back
    const glance =
      u < 0.03 ? 0 : u < 0.06 ? -ease.inOut(seg(u, 0.03, 0.06)) : u < 0.1 ? -1 : u < 0.13 ? -1 + 2 * ease.inOut(seg(u, 0.1, 0.13)) : u < 0.16 ? 1 : 1 - ease.inOut(seg(u, 0.16, 0.18));
    const squeeze = ease.out(seg(s, GRIP - 0.02, GRIP + 0.06)) * (1 - ease.out(seg(s, LET, LET + 0.05)));
    const held = ease.out(seg(s, GRIP, TWIST)) * (1 - ease.in(seg(s, LET, LET + 0.07)));
    const twK = ease.inOut(seg(s, TWIST, LET));
    const swing = s < LET + 0.12 ? Math.sin(Math.PI * seg(s, TWIST, LET + 0.12)) : 0; // her body lags the twist
    const dropK = seg(s, LET + 0.07, LET + 0.32);
    const drop = s > LET + 0.07 ? Math.exp(-dropK * 4.5) * Math.cos(dropK * 11) : 0;
    const dazed = seg(s, LET + 0.05, LET + 0.1) * (1 - ease.out(seg(s, GLARE - 0.04, GLARE + 0.02)));
    const glare = ease.out(seg(s, GLARE, GLARE + 0.07)) * (1 - ease.inOut(seg(s, HUFF + 0.04, HUFF + 0.14)));
    const puff = ease.out(seg(s, HUFF, STAMP - 0.02)) * (1 - ease.in(seg(s, STAMP - 0.02, STAMP))); // up on her toes...
    const stampK = seg(s, STAMP, STAMP + 0.22);
    const stamp = s > STAMP ? Math.exp(-stampK * 5) * Math.cos(stampK * 10) : 0; // ...hmph!
    const shakeK = seg(s, STAMP + 0.08, END - 0.02);
    const shake = shakeK > 0 ? Math.sin(shakeK * Math.PI * 5) * 0.12 * (1 - shakeK) : 0;
    // the stamp sends one small ring of her colour across the glass
    const rk = seg(s, STAMP, STAMP + 0.26);
    stampRing.visible = s >= STAMP && rk < 1;
    stampRing.scale.setScalar(0.5 + 0.38 * ease.out(rk));
    stampRing.material.opacity = Math.pow(1 - rk, 1.5);
    maya.set({
      rot: lerp(rot0, rot1, twK), // her heading is the hand's
      lift: 0.07 * held + 0.05 * glare + 0.13 * puff,
    });
    const mPitch = -0.26 * look + 0.12 * cringe - 0.26 * glare - 0.12 * puff + 0.12 * stamp;
    const brightness = 1 - 0.94 * cov; // the hand's darkness on her
    maya.each = (m) => {
      m.body.rotation.x = -mPitch;
      m.body.rotation.z = tremble - spin * 0.16 * swing + shake;
      m.body.position.y += 0.25 * Math.abs(Math.sin(mPitch)) + 0.03 * puff;
      const sy = 1 - 0.2 * cringe + 0.24 * squeeze - 0.3 * drop + 0.07 * glare + 0.18 * puff - 0.3 * stamp;
      const sx = 1 + 0.1 * cringe - 0.28 * squeeze + 0.12 * drop + 0.08 * puff + 0.14 * stamp;
      const sz = 1 + 0.1 * cringe - 0.06 * squeeze + 0.12 * drop + 0.08 * puff + 0.14 * stamp;
      m.body.scale.set(sx, sy, sz);
      m.paint.color.copy(mPaint).multiplyScalar(Math.pow(brightness, 2.5));
      m.paint.emissiveIntensity = mLook.emis * brightness * brightness;
      m.paint.clearcoat = mLook.coat * brightness;
      m.paint.specularIntensity = mLook.spec * brightness;
      m.paint.envMapIntensity = mLook.env * (0.1 + 0.9 * brightness);
      m.ringMat.opacity *= 0.06 + 0.94 * brightness;
      m.poolMat.opacity *= 0.04 + 0.96 * brightness;
      // the eye is never dimmed by the dark: wide when she looks up, big and darting in the dark with a double
      // blink, screwed shut while squeezed, a dazed slit after, a narrow hot glare up after the hand
      const blink = (a) => {
        const k = seg(s, a, a + 0.055);
        return k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
      };
      const shut = Math.max(blink(COVER + 0.19), blink(COVER + 0.25), squeeze * 0.92, 0.6 * dazed, 0.45 * glare);
      const wide = 0.45 * look + 0.4 * inDark;
      if (mEye) {
        mEye.scale.set((1 + wide) * (1 - shut) + 0.05, 1 + 0.25 * wide, (1 + wide) * (1 - shut) + 0.05);
        mEye.position.x = mEyeAt.x + 0.08 * glance;
      }
      m.eyeMat.color.multiplyScalar((1 + 0.4 * look + 0.5 * inDark + 0.8 * glare + 0.6 * puff + 0.8 * Math.max(0, stamp)) * (1 - 0.6 * squeeze));
    };

    // ----- Theo: cowers away from the first moment the light goes, and looks up last -----
    const tCower = ease.out(seg(s, 0.16, 0.34)) * (1 - ease.inOut(seg(s, GONE - 0.14, GONE + 0.1)));
    const tLook = ease.out(seg(s, 0.08, 0.18)) * (1 - seg(s, 0.2, 0.32)) + ease.inOut(seg(s, GONE, GONE + 0.12)) * (1 - ease.inOut(seg(s, END - 0.18, END)));
    const tShiver = tCower * (s > 0.3 && s < LIFT ? Math.sin(s * 80) * 0.035 : 0);
    const tPitch = -0.24 * tLook;
    const tBright = 1 - 0.8 * tcov;
    // he backs away a little from the hand, and creeps back once it has gone
    const back = ease.out(seg(s, 0.18, 0.4)) * (1 - ease.inOut(seg(s, GONE - 0.05, END - 0.08)));
    theo.set({ x: B.x - awayX * 0.16 * back, y: B.y - awayY * 0.16 * back });
    theo.each = (m) => {
      m.body.rotation.x = -tPitch;
      m.body.rotation.z = -0.22 * tCower * awayRoll + tShiver;
      m.body.position.y += 0.2 * Math.abs(Math.sin(tPitch)) + 0.1 * Math.abs(Math.sin(0.22 * tCower));
      const sy = 1 - 0.26 * tCower;
      m.body.scale.set(1 + 0.1 * tCower, sy, 1 + 0.1 * tCower);
      m.eyeMat.color.multiplyScalar((1 - 0.6 * tCower) * (1 + 0.6 * tLook) * tBright);
      if (tEye) tEye.scale.set(1, 1, 1 - 0.5 * tCower);
    };
  });

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  theo.each = null;
  plane.visible = false;
  stampRing.visible = false;
  maya.release({ x: A.x, y: A.y, d: A.d });
  theo.release({ x: B.x, y: B.y, d: B.d });
}
