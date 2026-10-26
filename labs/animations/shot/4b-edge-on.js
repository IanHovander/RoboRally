// Edge-on, acted. Theo deals his shot like a card sharp: a wind-up and a wrist flick. What crosses the row looks
// like an ordinary laser line, because it is a long card of light seen exactly edge-on (its plane passes through
// the camera). At Maya's flank it gathers to card size and turns to face us: the SPAM card. Maya reads it, looks
// at us, reads it again, shakes her head "no"... and it slides into her side like a slide into a projector anyway.
import { drawCard } from '/looks/three/games/robo-rally/glyphs.js';

export const meta = {
  title: 'Edge-on (dealt)',
  idea:
    'Theo deals the shot with a card sharp\'s wrist flick, and the laser line that crosses the row is really a long card of light seen exactly edge-on. At Maya\'s flank it gathers to card size and turns to face us: the SPAM card, as on the phones. Maya reads it, looks at us, reads it again and shakes her head "no"; Jun leans in to peek; Theo leans back, pleased. The card slides into her side like a slide into a projector, a slit of light marks the slot, she glows once and slumps.',
  notes:
    'Sound: a crisp "fft" of a dealt card on the flick (the glass laser sound, but papery), a soft "tink" on her flank, a bright rising glass shimmer as the card turns (the reveal), silence for the head-shake, then a projector-slide "chk-shhk" and the usual damage chime as she glows. Porting: the card plane is set each frame to pass through the beam line and the camera, so it stays a perfect line from any shooter and any direction; the card face is the game\'s own drawCard(\'sp\'). It explains the rule in one picture, so it can play every register.',
};

// ---------- small acting toolkit (kept in this file so the entry stands alone) ----------

function track(lab, list) {
  return (t) => {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [t1, v1, e] = list[i];
      if (t <= t1) {
        const [t0, v0] = list[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * lab.ease[e ?? 'inOut'](k);
      }
    }
    return list[list.length - 1][1];
  };
}
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const win = (t, a, b) => clamp01((t - a) / (b - a));

/** A robot as an actor: body-only lean, turn, squash and eye, so its ring and pointer stay true. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push([o, o.scale.clone()]));
  const st = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, up: 0, eye: 1, eyeS: 1, glow: 0, glowColor: null };
  const base = m.paint.emissive.clone();
  m.body.rotation.order = 'YXZ';
  p.each = (model) => {
    const b = model.body;
    b.rotation.set(-st.pitch, st.yaw, -st.roll);
    b.scale.set(st.sx, st.sy, st.sz);
    b.position.y += st.up;
    for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(st.eyeS);
    const e = st.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    if (st.glow > 0) {
      if (st.glowColor) model.paint.emissive.set(st.glowColor);
      model.paint.emissiveIntensity += st.glow;
    } else model.paint.emissive.copy(base);
  };
  const done = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    m.paint.emissive.copy(base);
    for (const [o, s] of eyes) o.scale.copy(s);
    p.release(state);
  };
  return { p, m, st, done };
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE } = lab;
  const K = (list) => track(lab, list);
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const BLUE = lab.bot('b').color;
  const SPAM = '#ff7a6b';

  // ----- the card: the game's own SPAM card on a slide of light -----
  const cv = document.createElement('canvas');
  cv.width = 300;
  cv.height = 360;
  const g = cv.getContext('2d');
  drawCard(g, 'sp', 30, 30, 240, 300);
  const cardTex = new THREE.CanvasTexture(cv);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  const CW = 0.3; // the card's width and height on the board (with the canvas margin)
  const CH = 0.36;
  const card = new THREE.Group(); // local x along the row, local y the card's height, local z its face normal
  const faceMat = new THREE.MeshBasicMaterial({ map: cardTex, color: new THREE.Color(1.25, 1.25, 1.25), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), faceMat);
  face.renderOrder = 8;
  card.add(face);
  // its edges are lines of light: seen edge-on, the top and bottom edges ARE the laser line
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sleeveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.5), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const bar = (r, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8, 1, true), mat);
    m.rotation.z = Math.PI / 2; // along local x
    m.renderOrder = 9;
    card.add(m);
    return m;
  };
  const top = bar(0.008, edgeMat);
  const bot = bar(0.008, edgeMat);
  const sleeve = bar(0.03, sleeveMat);
  card.visible = false;
  lab.add(card);
  // the slot: a slit of light on her flank where the card goes in
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(SPAM).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  slit.renderOrder = 10;
  lab.add(slit);

  // ----- geometry -----
  theo.m.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.m.muzzle.matrixWorld);
  const yb = muzzle.y;
  const zb = muzzle.z;
  const mayaC = lab.pos(1, 1);
  const xf = mayaC.x + 0.31; // her flank
  const X = new THREE.Vector3(1, 0, 0);
  const U = new THREE.Vector3();
  const N = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const qEdge = new THREE.Quaternion();
  const qFlip = new THREE.Quaternion();
  const toCam = new THREE.Vector3();
  const faceAt = new THREE.Vector3(xf + CW / 2 + 0.02, 0.27, zb + 0.14); // where the card hangs, face-on, beside her

  // ----- timing -----
  const T_FLICK = 0.22; // the wrist flick: the card leaves
  const T_ARRIVE = T_FLICK + 0.1; // its leading edge hits her flank
  const T_GATHER = 0.48; // it draws itself in
  const T_FLIP = 0.66; // and turns to face us
  const T_FACE = 0.94;
  const T_SLIDE = 1.46; // into the slot
  const T_IN = 1.66;
  const T_END = 2.2;

  // ----- the acting -----
  // Theo: wind-up (turns away, coils), the flick (snaps through with a stretch), then leans back, pleased
  const tYaw = K([[0, 0], [T_FLICK - 0.02, -0.42, 'inOut'], [T_FLICK + 0.05, 0.16, 'out'], [T_FLICK + 0.2, 0.04, 'inOut'], [T_FACE, 0], [T_FACE + 0.12, 0.1, 'inOut'], [T_IN + 0.1, 0.1], [T_END - 0.1, 0, 'inOut']]);
  const tSy = K([[0, 1], [T_FLICK - 0.02, 0.86, 'inOut'], [T_FLICK + 0.05, 1.12, 'out'], [T_FLICK + 0.25, 1, 'inOut']]);
  const tPitch = K([[0, 0], [T_FLICK - 0.02, -0.1], [T_FLICK + 0.05, 0.14, 'out'], [T_FLICK + 0.25, 0, 'inOut'], [T_FACE, 0], [T_FACE + 0.12, -0.14, 'inOut'], [T_IN + 0.1, -0.14], [T_END - 0.1, 0, 'inOut']]);
  const tRoll = K([[0, 0], [T_FACE, 0], [T_FACE + 0.12, -0.12, 'inOut'], [T_IN + 0.1, -0.12], [T_END - 0.1, 0, 'inOut']]);
  const tEye = K([[0, 1], [T_FLICK - 0.02, 1.8, 'in'], [T_FLICK + 0.1, 1.2, 'out'], [T_FACE + 0.12, 1.5], [T_END - 0.1, 1]]);
  // Jun: turns to look at the line, leans in to peek at the card, recoils as it goes in
  const jYaw = K([[0, 0], [T_ARRIVE, 0], [T_ARRIVE + 0.16, 0.62, 'outBack'], [T_END - 0.28, 0.62], [T_END - 0.04, 0, 'inOut']]);
  const jPitch = K([[0, 0], [T_FACE - 0.04, 0], [T_FACE + 0.14, 0.2, 'inOut'], [T_SLIDE + 0.1, 0.2], [T_IN, -0.16, 'out'], [T_END - 0.1, 0, 'inOut']]);
  const jSy = K([[0, 1], [T_FACE - 0.04, 1], [T_FACE + 0.14, 1.1, 'inOut'], [T_SLIDE + 0.1, 1.1], [T_IN, 0.88, 'out'], [T_END - 0.05, 1, 'outElastic']]);
  // Maya: jolt on the tink; reads the card, looks at us, reads it again (wide), shakes her head; it goes in anyway:
  // a squash and a glow, then a resigned slump
  const R = T_FACE;
  const mYaw = K([[0, 0], [R, 0], [R + 0.1, 0.7, 'out'], [R + 0.2, 0.7], [R + 0.27, 0, 'inOut'], [R + 0.34, 0], [R + 0.4, 0.78, 'outBack'], [T_SLIDE - 0.02, 0.78], [T_IN + 0.1, 0.5, 'out'], [T_END - 0.08, 0, 'inOut']]);
  const shake = (t) => win(t, R + 0.46, R + 0.5) * (1 - win(t, T_SLIDE - 0.06, T_SLIDE)) * Math.sin((t - R - 0.46) * 34) * 0.2;
  const mRoll = K([[0, 0], [T_ARRIVE, 0], [T_ARRIVE + 0.04, 0.14, 'out'], [T_ARRIVE + 0.3, 0, 'outElastic']]);
  const mPitch = K([[0, 0], [R + 0.34, 0], [R + 0.4, -0.14, 'out'], [T_SLIDE, -0.12], [T_IN, 0.04], [T_IN + 0.14, 0.2, 'inOut'], [T_END - 0.06, 0, 'inOut']]);
  const mEyeS = K([[0, 1], [R, 1], [R + 0.1, 1.35, 'out'], [R + 0.34, 1.3], [R + 0.4, 1.75, 'outBack'], [T_SLIDE, 1.7], [T_IN, 0.6, 'out'], [T_IN + 0.3, 0.75], [T_END - 0.06, 1, 'inOut']]);
  const mSx = K([[0, 1], [T_IN - 0.04, 1], [T_IN + 0.04, 1.14, 'out'], [T_IN + 0.4, 1, 'outElastic']]);
  const mSy = K([[0, 1], [T_IN - 0.04, 1], [T_IN + 0.04, 0.86, 'out'], [T_IN + 0.22, 0.94, 'inOut'], [T_END - 0.06, 1, 'inOut']]);
  const mGlow = K([[0, 0], [T_IN - 0.06, 0], [T_IN + 0.02, 0.9, 'out'], [T_IN + 0.3, 0, 'out']]);
  maya.st.glowColor = new THREE.Color(SPAM);

  const T0 = lab.t;
  let fired = false;
  let hit = false;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    // the actors
    Object.assign(theo.st, { yaw: tYaw(t), sy: tSy(t), sx: 2 - tSy(t), sz: 2 - tSy(t), pitch: tPitch(t), roll: tRoll(t), eye: tEye(t) });
    Object.assign(jun.st, { yaw: jYaw(t), pitch: jPitch(t), sy: jSy(t), sx: 1 + (1 - jSy(t)) * 0.5, sz: 1 + (1 - jSy(t)) * 0.5 });
    Object.assign(maya.st, { yaw: mYaw(t) + shake(t), roll: mRoll(t), pitch: mPitch(t), eyeS: mEyeS(t), sx: mSx(t), sz: mSx(t), sy: mSy(t), glow: mGlow(t) });

    if (!fired && t >= T_FLICK) {
      fired = true;
      lab.arena.emit('laser', { board: false, hit: true, src: 'b' });
    }
    // ----- the card -----
    card.visible = t >= T_FLICK && t < T_IN + 0.02;
    if (!card.visible) {
      slit.material.opacity = t >= T_IN ? Math.max(0, 1 - (t - T_IN) / 0.25) : 0;
      return;
    }
    // its edge-on plane: through the beam line and the camera
    const cam = lab.camera3.position;
    toCam.set(0, cam.y - yb, cam.z - zb).normalize(); // the camera from the line, across the row
    U.copy(toCam);
    N.crossVectors(X, U).normalize();
    basis.makeBasis(X, U, N);
    qEdge.setFromRotationMatrix(basis);
    // the flip: a quarter turn about the row, with a little overshoot
    const fk = win(t, T_FLIP, T_FACE);
    const flip = lab.ease.outBack(fk);
    qFlip.setFromAxisAngle(X, (-Math.PI / 2) * flip);
    card.quaternion.copy(qEdge).multiply(qFlip);

    // its two ends along the row: the leading edge races to her flank, the trailing edge gathers in after it
    const lead = Math.max(xf, muzzle.x - (muzzle.x - xf) * lab.ease.out(win(t, T_FLICK, T_ARRIVE)));
    const trail = muzzle.x + (xf + CW - muzzle.x) * lab.ease.inOut(win(t, T_GATHER, T_FLIP));
    // into the slot: it slides west into her side, shrinking to fit
    const sk = lab.ease.in(win(t, T_SLIDE, T_IN));
    const len = Math.max(0.001, trail - lead);
    const cx = (lead + trail) / 2 - (CW + 0.06) * sk;
    // where it sits: on the beam line while it's a line, lifting and coming forward a touch as it turns
    const lift = lab.ease.inOut(fk);
    card.position.set(cx, yb + (faceAt.y - yb) * lift, zb + (faceAt.z - zb) * lift);
    const h = CH * (1 - 0.3 * sk);
    face.scale.set(len, h, 1);
    for (const [b, y] of [[top, h / 2], [bot, -h / 2], [sleeve, 0]]) {
      b.scale.set(1, len, 1);
      b.position.set(0, y, 0);
    }
    // the light: a laser line until it turns, then the card's face
    const lineK = 1 - win(t, T_FLIP + 0.04, T_FACE - 0.04);
    edgeMat.opacity = lineK;
    sleeveMat.opacity = 0.45 * lineK * (1 + 0.6 * Math.exp(-Math.max(0, t - T_ARRIVE) / 0.08) * (t >= T_ARRIVE ? 1 : 0));
    const glint = Math.exp(-Math.max(0, t - T_FACE) / 0.12) * (t >= T_FACE ? 1 : 0);
    faceMat.opacity = win(t, T_FLIP, T_FLIP + 0.12) * (1 - win(t, T_IN - 0.06, T_IN));
    faceMat.color.setScalar(1.25 + 1.2 * glint);
    // the slot lights up as it goes in
    slit.position.set(xf - 0.02, faceAt.y - 0.03, faceAt.z - 0.02);
    slit.rotation.y = Math.PI / 2 - 0.35;
    slit.material.opacity = win(t, T_SLIDE - 0.02, T_SLIDE + 0.06);

    if (!hit && t >= T_IN - 0.04) {
      hit = true;
      lab.arena.emit('damage', { id: 'a', n: 1, hw: 0 });
    }
  });

  await lab.wait(T_END);
  stop();
  card.visible = false;
  slit.visible = false;
  maya.done({ x: 1, y: 1, d: 2 });
  theo.done({ x: 5, y: 1, d: 3 });
  jun.done({ x: 3, y: 3, d: 0 });
}
