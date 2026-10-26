// Push, idea 36 (Theo-Cam), animator a: weight & physical comedy.
export const meta = {
  title: 'Theo-Cam: the knocked camera',
  idea:
    "On a rare push the camera drops out of its high view like something with weight: a little lift, a swooping fall, and a soft bob as it lands at glass level right beside Theo, looking back along the row. Maya comes at us out of the dark, her eye growing into a headlight with a gleam stretched across the smoked glass under it. At the bonk the camera is shoved one space east with Theo: the whole picture lurches, lags behind him on its springs, tips over and rocks back level. Then it floats back up to the usual view as everyone settles.",
  notes:
    "Rare: about one push in ten, or the first push of a game, so the room never knows which one will dive. Sound: a soft whoosh down, a muffled glass 'thup' as the camera lands, Maya's approach growing loud and close, a big low clonk at contact with everything else ducking for a beat, then a long airy rise. Physics: the camera is a heavy rig on a spring tied to Theo, so the shove arrives a frame late, overshoots and rocks (roll and nod are damped springs driven by the lurch); the dive falls faster and faster and bobs on landing. Porting: lab.camera's params are az/el/dist around a target; in the game this is arena.focusOn plus a custom camWish. Facing other ways, the rig sits on the pushed robot's side away from the board's nearer edge.",
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const F = (s) => Math.round(s * 30) / 30 - 0.004; // whole frames
const lerp = (a, b, k) => a + (b - a) * k;

function glowTexture(THREE, stretch = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(stretch ? 0.15 : 0.1, 'rgba(255,255,255,.6)');
  gr.addColorStop(0.4, 'rgba(255,255,255,.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a damped spring you can kick
function spring(k, c) {
  return {
    x: 0,
    v: 0,
    step(dt, target = 0, force = 0) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        this.v += (force + k * (target - this.x) - c * this.v) * h;
        this.x += this.v * h;
      }
      return this.x;
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const SOUTH = facing(2);
  maya.set({ x: 1, y: 2, rot: EAST });
  theo.set({ x: 3, y: 2, rot: SOUTH });
  lab.playCard('a', ['m2']);

  const row = lab.pos(0, 2).z;
  const X = (sx) => lab.pos(sx, 2).x;

  // ----- Maya's headlight: a glare at her eye and its gleam stretched along the glass toward us -----
  const warm = new THREE.Color('#fff2dc');
  const eyeMesh = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const glareMat = new THREE.SpriteMaterial({ map: glowTexture(THREE), color: warm.clone().multiplyScalar(2.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const glare = new THREE.Sprite(glareMat);
  glare.renderOrder = 10;
  lab.add(glare);
  const gleamMat = new THREE.MeshBasicMaterial({ map: glowTexture(THREE, true), color: warm.clone().multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const gleam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gleamMat);
  gleam.rotation.x = -Math.PI / 2;
  gleam.renderOrder = 3;
  lab.add(gleam);
  const eyeW = new THREE.Vector3();
  // her eye flares toward high beams as she comes at the lens (the game sets its colour each frame)
  const H = { beam: 0 };
  maya.each = (m) => m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 + 2.2 * H.beam);

  // ----- the camera rig -----
  const lowFor = (tx) => ({
    // glass level just beside Theo (south-east of him), looking back west along the row
    // over his shoulder: the lens sits a little east and south of him, just above his ridge, so his glass back
    // fills the bottom of the picture and Maya comes at us head-on, straight down the row
    target: new THREE.Vector3(X(tx) - 1.8, 0.1, row - 0.05),
    az: 1.388,
    el: 0.267,
    dist: 2.846,
    fov: 38,
    roll: 0,
  });
  const rigX = spring(110, 8); // the rig's lag behind Theo when he's shoved (spaces)
  const rigRoll = spring(210, 9); // it tips over from the knock and rocks back
  const rigNod = spring(260, 12);
  const C = { blend: 0, bobY: 0, extraDist: 0, tx: 3, rig: 3, roll: 0, nod: 0 };
  const releaseCam = lab.camera((home) => {
    const low = lowFor(C.tx);
    low.target.y += C.bobY;
    low.el += C.nod;
    low.roll = C.roll;
    const k = C.blend;
    return {
      target: home.target.clone().lerp(low.target, k),
      az: lerp(home.az, low.az, k),
      el: lerp(home.el, low.el, k),
      dist: lerp(home.dist * (1 + C.extraDist), low.dist, k),
      fov: lerp(home.fov, low.fov, k),
      roll: lerp(0, low.roll, k),
    };
  });

  // ----- the whole moment on one clock -----
  const TC = 0.98; // Maya's nose meets Theo
  const XC = 2.37;
  const M0 = 0.26; // she sets off while the camera is still falling
  const TOTAL = F(2.42);
  const glint = theo.model.paint.emissiveIntensity;
  // we're looking over his shoulder: his ridge light dims a little so it doesn't glare in the foreground
  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 - 0.75 * C.blend);
    // his name tag would hang right in front of the lens: it steps aside while we're down here
    if (theo.bot.tag) theo.bot.tag.material.opacity = 1 - smooth(0.1, 0.4, C.blend);
  };
  let kicked = false;
  let tPrev = 0;
  await lab.tween(TOTAL, (e, k) => {
    const t = k * TOTAL;
    const dt = Math.max(0, t - tPrev);
    tPrev = t;

    // --- the dive: a small lift, then a fall that speeds up, then a soft bob on the glass ---
    C.extraDist = 0.04 * Math.sin(clamp01(t / 0.14) * Math.PI) * (t < 0.14 ? 1 : 0);
    const dive = clamp01((t - 0.06) / 0.5);
    const fall = dive < 0.8 ? 0.8 * (dive / 0.8) ** 2.2 : 0.8 + 0.2 * ease.out((dive - 0.8) / 0.2);
    const up = smooth(1.42, TOTAL, t); // the float home
    C.blend = fall * (1 - ease.inOut(up));
    C.bobY = t > 0.56 ? -0.05 * Math.sin(clamp01((t - 0.56) / 0.18) * Math.PI) * Math.exp(-(t - 0.56) * 5) : 0;

    // --- Maya: sets off, speeds up straight at us ---
    let mx;
    if (t < M0) mx = 1;
    else if (t < TC) mx = 1 + (XC - 1) * ((t - M0) / (TC - M0)) ** 1.8;
    else mx = XC + (3 - XC) * (1 - (1 - clamp01((t - TC) / 0.4)) ** 2);
    const nod = t > TC ? 0.16 * Math.sin(clamp01((t - TC) / 0.45) * Math.PI * 2) * Math.exp(-(t - TC) * 4) : 0;
    maya.set({ x: mx, pitch: nod - (t > M0 && t < TC ? 0.06 : 0), sz: t > TC ? 1 - 0.1 * Math.exp(-(t - TC) / 0.06) : 1 });

    // --- Theo: bonked one space east, his glass flashing, a wobble to rest ---
    let tx = 3;
    let roll = 0;
    let sx = 1;
    if (t >= TC) {
      const s = t - TC;
      const p = clamp01(s / 0.4);
      tx = 3 + (1 - (1 - p) ** 2.6);
      roll = -0.2 * Math.sin(clamp01(s / 0.5) * Math.PI) * Math.exp(-s * 2) + 0.05 * Math.sin(s * 24) * Math.exp(-s * 5);
      sx = 0.84 + 0.16 * ease.outElastic(clamp01(s / 0.4));
    }
    theo.set({ x: tx, roll, sx });
    theo.model.paint.emissiveIntensity = glint + (t >= TC ? 1.5 * Math.exp(-(t - TC) / 0.08) : 0);

    // --- the rig is tied to Theo by a spring: it lags the shove, overshoots, tips and rocks ---
    if (t >= TC && !kicked) {
      kicked = true;
      rigRoll.v -= 4.6; // knocked over to the left
      rigNod.v += 1.6;
      lab.shake(0.03, 0.2);
    }
    // the rig is a heavy mass on a spring tied to Theo: it lags the shove, then overshoots
    rigX.x = C.rig - tx;
    rigX.step(dt);
    C.rig = tx + rigX.x;
    C.tx = C.rig;
    C.roll = rigRoll.step(dt);
    C.nod = rigNod.step(dt);

    // --- her headlight, growing as she nears us ---
    eyeMesh.getWorldPosition(eyeW);
    const cam = lab.camera3.position;
    const near = clamp01((3.2 - eyeW.distanceTo(cam)) / 2.4) * smooth(0.3, 0.5, C.blend);
    const beam = near * (1 - 0.75 * smooth(TC, TC + 0.4, t));
    H.beam = beam;
    glare.position.copy(eyeW);
    glareMat.opacity = Math.min(1, 1.3 * beam);
    glare.scale.setScalar(0.3 + 1.5 * beam * beam);
    // the gleam lies on the glass between her eye and us, stretched toward the lens
    const gx = cam.x - eyeW.x;
    const gz = cam.z - eyeW.z;
    const gl = Math.hypot(gx, gz) || 1;
    const len = 0.5 + 0.9 * beam;
    gleam.position.set(eyeW.x + (gx / gl) * (0.2 + len / 2), 0.009, eyeW.z + (gz / gl) * (0.2 + len / 2));
    gleam.rotation.set(-Math.PI / 2, 0, Math.atan2(-gz, gx));
    gleam.scale.set(len, 0.1 + 0.08 * beam, 1);
    gleamMat.opacity = smooth(0.25, 0.5, C.blend) * (0.3 + 0.7 * beam) * (1 - smooth(TC + 0.1, TC + 0.6, t));
  }, ease.linear);

  releaseCam();
  maya.each = null;
  theo.each = null;
  if (theo.bot.tag) theo.bot.tag.material.opacity = 1;
  glare.visible = false;
  gleam.visible = false;
  theo.model.paint.emissiveIntensity = glint;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
