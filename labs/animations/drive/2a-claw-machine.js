// Idea 34, "Claw machine (rare)", through the lens of weight. A thin arcade claw drawn in warm light drops out
// of the dark on its single line, bounces on the cable, opens, and closes on Maya with a glint. When it
// lifts her, her weight comes on the line (the head dips before it rises), and from then on she is a real
// pendulum hung from the claw: she lags as it carries her north, swings past when it stops, and the classic
// arcade jiggle makes her sway. She slips a hair in the grip (the room gasps), it catches her, and then it
// lets go: she drops, squashes on the glass, bounces once and settles on (3, 1), still facing south, while
// the empty claw reels up into the dark. The U-Turn plays as normal.
export const meta = {
  title: 'Claw machine',
  idea:
    'Move Back is done to the letter by an arcade claw of warm light: it bounces down on its cable, grabs Maya with a glint, strains as her weight comes on, and carries her one space north, swinging like a real pendulum (she lags, then swings past). It jiggles over the spot, she slips a hair in its grip (gasp), it catches her... then drops her: squash, a little bounce, the glass rings, and the empty claw reels up into the dark as she U-Turns.',
  notes:
    'Lens: weight. Everything hangs: the claw bounces on its line, Maya is simulated as a pendulum under the claw (driven by its acceleration), and the drop is a gravity fall with a restitution bounce and a squash spring. Rare: once or twice a game, only on Move Back. Sound: a soft electric whirr down the line, a glass "tik" as the fingers close, a strained creak as she lifts, the whirr across, a sharp intake on the slip, then a clean glass clink on the drop and a fast zip as the claw reels up. Porting: the claw is a few tubes of additive warm light; needs about 1.5 s more than the Move Back beat.',
};

const TAU = Math.PI * 2;

function starTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 64;
      const dy = (y - 64) / 64;
      const r = Math.hypot(dx, dy);
      const rays = Math.exp(-Math.abs(dx) * 40) * Math.max(0, 1 - Math.abs(dy)) ** 2 + Math.exp(-Math.abs(dy) * 40) * Math.max(0, 1 - Math.abs(dx)) ** 2;
      const core = Math.exp(-r * r * 30);
      const v = Math.min(1, rays * 0.9 + core);
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { ease, facing, THREE, PALETTE } = lab;

  // ----- Move 2 and Rotate Right, exactly as the game plays them -----
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.7);
  lab.beat(lab.scenario.beats[1]);
  await lab.wait(0.5);

  const maya = lab.puppet('a');
  const bot = lab.bot('a');
  maya.set({ x: 3, y: 2, rot: facing(2) });

  // ----- the claw: a hub, three curled fingers and one line, all warm light -----
  const warm = new THREE.Color(PALETTE.light).multiplyScalar(2.1);
  const mat = new THREE.MeshBasicMaterial({ color: warm, transparent: true, opacity: 1, depthWrite: false });
  const claw = lab.add(new THREE.Group());
  const head = new THREE.Group();
  claw.add(head);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 40), mat);
  hubRing.rotation.x = Math.PI / 2;
  head.add(hubRing);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 8, 32), mat);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.09;
  head.add(crown);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), mat);
    strut.position.set(Math.cos(a) * 0.078, 0.045, Math.sin(a) * 0.078);
    strut.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    head.add(strut);
  }
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), mat);
  cable.geometry.translate(0, 0.5, 0);
  claw.add(cable);
  const knuckles = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.17, -0.06, 0),
    new THREE.Vector3(0.35, -0.22, 0),
    new THREE.Vector3(0.37, -0.4, 0),
    new THREE.Vector3(0.29, -0.54, 0),
  ]);
  const fingerGeo = new THREE.TubeGeometry(curve, 28, 0.018, 6);
  const tipGeo = new THREE.SphereGeometry(0.026, 10, 8);
  for (const a of [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + (2 * TAU) / 3]) {
    const f = new THREE.Group();
    f.rotation.y = a;
    head.add(f);
    const kn = new THREE.Group();
    kn.position.x = 0.1;
    f.add(kn);
    kn.add(new THREE.Mesh(fingerGeo, mat));
    const tip = new THREE.Mesh(tipGeo, mat);
    tip.position.set(0.29, -0.54, 0);
    kn.add(tip);
    knuckles.push(kn);
  }
  // a soft pool of the claw's own light on the glass, so it sits in the room
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pool = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(PALETTE.light).multiplyScalar(0.25), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  pool.rotation.x = -Math.PI / 2;
  const glint = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(THREE), color: new THREE.Color('#fff6e8').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })));
  glint.renderOrder = 45;

  // ----- state, and the physics that runs every frame -----
  const L = 0.62; // hub to Maya's foot while she's held
  const st = {
    hubY: 2, // board row the claw hangs over
    hubH: 5.2, // height of the hub
    open: 0, // fingers: 0 = gripping, 1 = wide open, < 0 = shut tight
    held: false,
    phi: 0, // swing north/south (+ = her foot swings south)
    vphi: 0,
    psi: 0, // swing east/west (+ = her foot swings east)
    vpsi: 0,
    slip: 0, // how far she has slid down in the grip
    squeeze: 0,
    fall: null, // { lift, v } once dropped
    squash: 0,
    vsquash: 0,
    cardSide: 0,
    glint: 0,
  };
  let prevY = st.hubY;
  let prevV = 0;
  const w2 = 36; // pendulum stiffness (g / L): a swing of about one second
  const stop = lab.every((dt) => {
    if (dt <= 1e-5) return;
    const v = (st.hubY - prevY) / dt;
    const a = (v - prevV) / dt;
    prevY = st.hubY;
    prevV = v;
    const n = 6;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      // the claw's acceleration (spaces/s^2) drives the swing; heavier damping keeps it a breath, not a minute
      const drive = st.held ? -Math.max(-30, Math.min(30, a)) / 1.1 : 0;
      st.vphi += (-w2 * Math.sin(st.phi) - 1.6 * st.vphi + drive) * h;
      st.phi += st.vphi * h;
      st.vpsi += (-w2 * Math.sin(st.psi) - 1.6 * st.vpsi) * h;
      st.psi += st.vpsi * h;
      st.vsquash += (-520 * st.squash - 15 * st.vsquash) * h;
      st.squash += st.vsquash * h;
    }
    if (st.fall) {
      const f = st.fall;
      f.v -= 15 * dt;
      f.lift += f.v * dt;
      if (f.lift <= 0) {
        f.lift = 0;
        if (f.v < -0.6) {
          if (!f.landed) {
            lab.ring(lab.pos(3, 1), PALETTE.light, 0.85, 0.02, 0.7);
            lab.ring(lab.pos(3, 1), bot.color, 0.55, 0.015, 0.5);
            lab.shake(0.015, 0.18);
          }
          f.landed = true;
          st.vsquash += f.v * 2.2;
          f.v = -f.v * 0.28;
        } else f.v = 0;
      }
    }
  });

  const hubPos = new THREE.Vector3();
  maya.each = (model) => {
    // the claw hangs where it is; its head swings with whatever it's holding
    hubPos.copy(lab.pos(3, st.hubY)).setY(st.hubH);
    claw.position.copy(hubPos);
    head.rotation.set(-st.phi, 0, st.psi);
    cable.scale.y = Math.max(0.01, 9 - st.hubH);
    for (const kn of knuckles) kn.rotation.z = st.open * 0.78;
    // the pool of the claw's light grows as it nears the glass
    pool.position.copy(lab.pos(3, st.hubY)).setY(0.012);
    pool.material.opacity = Math.max(0, Math.min(1, (2.6 - st.hubH) / 1.6)) * 0.9;
    // Maya: held (rigidly swinging under the hub), falling, or resting
    if (st.held) {
      const len = L + st.slip;
      maya.set({
        y: st.hubY + Math.sin(st.phi) * len,
        x: 3 + Math.sin(st.psi) * len,
        lift: st.hubH - len * Math.cos(st.phi) * Math.cos(st.psi),
        pitch: -st.phi,
        roll: st.psi,
      });
    } else if (st.fall) {
      const k = Math.min(1, st.fall.t++ / 6);
      maya.set({ lift: st.fall.lift, pitch: maya.pose.pitch * (1 - k), roll: maya.pose.roll * (1 - k), x: 3 + (maya.pose.x - 3) * (1 - k), y: 1 + (maya.pose.y - 1) * (1 - k) });
    }
    const sq = Math.max(-0.35, Math.min(0.35, st.squash));
    const grip = st.squeeze;
    maya.set({ sy: 1 + sq + 0.05 * grip, sx: 1 - sq * 0.55 - 0.06 * grip, sz: 1 - sq * 0.55 - 0.06 * grip });
    // the bright card steps politely aside for the line, and comes back after
    if (bot.card) bot.card.position.x += st.cardSide;
    // the glint where a finger meets her
    glint.position.copy(lab.pos(3, st.hubY)).add(new THREE.Vector3(0.36, maya.pose.lift + 0.24, 0.26));
    glint.material.opacity = st.glint;
    glint.scale.setScalar(0.25 + 0.35 * st.glint);
    model.paint.emissiveIntensity = 0.16 + 0.5 * st.glint;
  };

  // ----- Move Back: the claw -----
  lab.playCard('a', ['bk']);
  lab.tween(0.3, (e) => (st.cardSide = -0.72 * e), ease.inOut);
  // down the line, fast, with a bounce on the cable at the bottom
  await lab.tween(
    0.34,
    (e, k) => {
      const fallK = Math.min(1, k / 0.62);
      const bob = k > 0.62 ? Math.sin(((k - 0.62) / 0.38) * Math.PI * 1.5) * Math.exp(-((k - 0.62) / 0.38) * 2.5) * 0.09 : 0;
      st.hubH = 5.2 + (1.18 - 5.2) * ease.in(fallK) - bob;
      st.open = Math.min(1, Math.max(0, (k - 0.35) / 0.5)) * 1;
    },
    ease.linear,
  );
  // ease down over her, fingers wide
  await lab.tween(0.15, (e) => (st.hubH = 1.18 + (L + 0.02 - 1.18) * e), ease.inOut);
  // close: snap, glint, she's squeezed
  await lab.tween(0.09, (e) => (st.open = 1 - e), ease.in);
  st.held = true;
  st.squeeze = 1;
  lab.tween(0.35, (e, k) => (st.glint = Math.sin(Math.min(1, k * 2.5) * Math.PI * 0.5) * (1 - k) ** 1.5 * 1.4), ease.linear);
  lab.tween(0.18, (e) => (st.squeeze = 1 - 0.55 * e), ease.out);
  await lab.wait(0.05);
  // the lift: her weight comes on the line (the head dips), then up she goes, dangling
  await lab.tween(0.08, (e) => (st.hubH = L + 0.02 - 0.035 * e), ease.out);
  await lab.tween(0.26, (e) => (st.hubH = L - 0.015 + (L + 0.33 - (L - 0.015)) * e), ease.inOut);
  // carried one space north; the pendulum does the rest
  await lab.tween(0.46, (e) => (st.hubY = 2 - e), ease.inOut);
  // the jiggle: it doesn't quite trust itself
  st.vpsi += 1.1;
  await lab.wait(0.12);
  st.vpsi -= 1.5;
  await lab.wait(0.1);
  // she slips a hair in the grip... and it catches her
  await lab.tween(0.07, (e) => {
    st.open = 0.14 * e;
    st.slip = 0.075 * e;
  }, ease.in);
  st.vphi += 0.6;
  await lab.tween(0.1, (e) => (st.open = 0.14 * (1 - e)), ease.out);
  // a breath of suspense, the swing settling
  await lab.tween(0.24, (e) => {
    st.vphi *= 0.86;
    st.vpsi *= 0.86;
    st.phi *= 0.9;
    st.psi *= 0.9;
  }, ease.linear);
  // ...and drop
  st.held = false;
  st.squeeze = 0;
  st.fall = { lift: maya.pose.lift, v: 0, t: 0, landed: false };
  await lab.tween(0.08, (e) => (st.open = e), ease.out);
  // the empty claw reels up into the dark, fingers closing
  lab.tween(0.42, (e, k) => {
    st.hubH = L + 0.33 + (6.2 - (L + 0.33)) * ease.in3(k);
    st.open = 1 - 1.2 * e;
    st.phi *= 0.9;
    st.psi *= 0.9;
  }, ease.out);
  lab.tween(0.45, (e) => (st.cardSide = -0.72 * (1 - e)), ease.inOut);
  // wait for the landing and its bounce
  while (!st.fall.landed) await lab.wait(1 / 30);
  await lab.wait(0.16);

  // ----- U-Turn, as normal (she's a little rattled: one wobble at the end) -----
  lab.playCard('a', ['ut']);
  const u0 = facing(2);
  const u1 = facing(2) - Math.PI;
  await lab.tween(0.42, (e) => maya.set({ rot: u0 + (u1 - u0) * e }), ease.inOut);
  st.fall = null;
  await lab.wait(0.06);
  stop();
  maya.each = null;
  maya.set({ sx: 1, sy: 1, sz: 1, lift: 0, pitch: 0, roll: 0 });
  claw.visible = false;
  pool.visible = false;
  maya.release({ x: 3, y: 1, d: 0 });
}
