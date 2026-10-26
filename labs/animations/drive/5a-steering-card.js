// Idea 31, "Steering-wheel card", through the lens of weight. The lit card over Maya is her controls, and it
// is a real, sprung control: a hand works it a split second before she moves, and when the hand lets go it
// springs back square on its own, overshooting and wobbling like a wheel let go. Maya is heavy and
// answers it like a little car: she squats back and pulls away when the throttle is punched, noses down
// when it eases off, swings round with momentum when the wheel turns (overshoot, settle), and on the U-turn
// the wheel goes over hand over hand in two shoves, then unwinds on its own in one fast, springy spin while
// she, quite still, has already done the turning.
export const meta = {
  title: 'Steering-wheel card',
  idea:
    'The card over Maya is her controls, a split second ahead of her. Move 2: it tips forward like a throttle punched and she squats back and pulls away, nosing down as it eases. Rotate Right: it turns a quarter like a wheel and she swings round after it with momentum. Move Back: it tips back toward the room and she reverses. U-Turn: shoved round hand over hand, then let go, it unwinds itself in one fast springy spin, boing, back to square.',
  notes:
    'Lens: weight. The card is a damped spring (it overshoots and wobbles when let go); Maya\'s body rocks on its foot from her real acceleration (ring and pointer stay exact). A sheen of warm light slides over the card glass as it tilts. Sound: a soft glass "click" as each card is gripped, a rising glassy hum with the throttle, a quick ratchet tick per hand-over-hand shove, a "wub-wub" as the wheel unwinds. Porting: the sprite card becomes a camera-facing plane with the same texture, so it can tilt in 3D; adds no time.',
};

const TAU = Math.PI * 2;

/** A spring-damper on the body: it rocks on its foot from the base's acceleration (forward, sideways, turning). */
function suspension(lab, p, { k = 210, c = 10, lean = 0.03, side = 0.02, twist = 0.05 } = {}) {
  const s = { pitch: 0, vp: 0, roll: 0, vr: 0, yaw: 0, vyaw: 0 };
  let prev = null;
  s.stop = lab.every((dt) => {
    if (dt <= 1e-5) return;
    const q = p.pose;
    const cur = { x: q.x, y: q.y, r: q.rot };
    if (!prev) {
      prev = { ...cur, vx: 0, vy: 0, w: 0 };
      return;
    }
    const vx = (cur.x - prev.x) / dt;
    const vy = (cur.y - prev.y) / dt;
    const w = (cur.r - prev.r) / dt;
    const ax = (vx - prev.vx) / dt;
    const ay = (vy - prev.vy) / dt;
    const aw = (w - prev.w) / dt;
    prev = { ...cur, vx, vy, w };
    const fx = -Math.sin(cur.r);
    const fy = -Math.cos(cur.r);
    const aF = ax * fx + ay * fy;
    const aR = ax * -fy + ay * fx;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    const drive = { p: clamp(-aF * lean, 6), r: clamp(-aR * side, 6), y: clamp(-aw * twist * 0.02, 8) };
    const n = 6;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.vp += (-k * s.pitch - c * s.vp + drive.p * k * 0.06) * h;
      s.pitch += s.vp * h;
      s.vr += (-k * s.roll - c * s.vr + drive.r * k * 0.06) * h;
      s.roll += s.vr * h;
      s.vyaw += (-k * 0.8 * s.yaw - c * 0.8 * s.vyaw + drive.y * k) * h;
      s.yaw += s.vyaw * h;
    }
  });
  return s;
}

/** A diagonal band of light for the sheen on the card's glass. */
function sheenTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const maya = lab.puppet('a');
  const bot = lab.bot('a');
  const sus = suspension(lab, maya);

  // ----- the card as a real object: a camera-facing plane that can tilt (pivot on its bottom edge) and steer -----
  const rig = lab.add(new THREE.Group());
  const steerG = new THREE.Group();
  rig.add(steerG);
  const tipG = new THREE.Group();
  steerG.add(tipG);
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.translate(0, 0.5, 0);
  const cardMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const cardMesh = new THREE.Mesh(plane, cardMat);
  cardMesh.renderOrder = 30;
  tipG.add(cardMesh);
  // the sheen: a band of warm light that slides over the card's glass as it tilts or turns
  const sheenTex = sheenTexture(THREE);
  const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTex, color: new THREE.Color('#fff4e2').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const sheen = new THREE.Mesh(plane, sheenMat);
  sheen.renderOrder = 31;
  tipG.add(sheen);
  rig.visible = false;

  // the card's state: driven by the hand, or free (a damped spring back to square)
  const card = { tip: 0, vtip: 0, steer: 0, vsteer: 0, free: true, sheen: 0, sheenX: 0 };
  let last = { tip: 0, steer: 0 };
  const springK = 300;
  const springC = 11;
  const stopCard = lab.every((dt) => {
    if (dt <= 1e-5) return;
    if (card.free) {
      const n = 6;
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        card.vtip += (-springK * card.tip - springC * card.vtip) * h;
        card.tip += card.vtip * h;
        card.vsteer += (-springK * card.steer - springC * card.vsteer) * h;
        card.steer += card.vsteer * h;
      }
    } else {
      card.vtip = (card.tip - last.tip) / dt;
      card.vsteer = (card.steer - last.steer) / dt;
    }
    last = { tip: card.tip, steer: card.steer };
    // light catches the glass while it moves
    const motion = Math.min(1, Math.abs(card.vtip) * 0.12 + Math.abs(card.vsteer) * 0.06);
    card.sheen += (Math.max(motion, Math.min(1, Math.abs(card.tip) * 1.1)) - card.sheen) * Math.min(1, dt * 14);
  });
  const grip = () => (card.free = false);
  const letGo = () => (card.free = true);

  maya.each = (model) => {
    // the body rocks on its foot (ring and pointer stay exact: they're the rules)
    model.body.rotation.set(-sus.pitch, sus.yaw, -sus.roll);
    const sp = bot.card;
    if (!sp) {
      rig.visible = false;
      return;
    }
    // take the sprite's place: same spot, same size, same picture... but now it can move like an object
    rig.visible = sp.visible !== false;
    sp.visible = false;
    if (cardMat.map !== sp.material.map) {
      cardMat.map = sp.material.map;
      cardMat.needsUpdate = true;
    }
    cardMat.opacity = sp.material.opacity;
    rig.position.copy(sp.position);
    rig.quaternion.copy(lab.camera3.quaternion);
    const w = sp.scale.x;
    const h = sp.scale.y;
    steerG.rotation.z = card.steer;
    tipG.position.y = -h / 2;
    tipG.rotation.x = card.tip;
    cardMesh.scale.set(w, h, 1);
    // the sheen sits on the card's face (inside the canvas padding)
    sheen.scale.set(w * 0.64, h * 0.68, 1);
    sheen.position.set(0, h * 0.15, 0.001);
    sheenTex.offset.x = 0.5 * Math.sin(card.tip * 2.2 + card.steer * 0.9);
    sheenMat.opacity = 0.55 * card.sheen * sp.material.opacity;
  };

  const r0 = facing(1);

  // a heavy start and stop: speed builds to a peak a third of the way, then she brakes the rest
  const launch = (a) => (k) => (k < a ? (k * k) / a : 1 - ((1 - k) * (1 - k)) / (1 - a));
  // a new card arrives square (the old one, still wobbling, is gone)
  const newCard = (types) => {
    lab.playCard('a', types);
    card.tip = card.steer = card.vtip = card.vsteer = 0;
    last = { tip: 0, steer: 0 };
  };

  // ================= Move 2: the throttle =================
  newCard(['m2']);
  await lab.wait(0.18); // the card turns over
  // a hand punches it forward (top away from us)...
  grip();
  await lab.tween(0.08, (e) => (card.tip = -1.0 * e), ease.out);
  // ...and a split second later she rears back and pulls away
  await lab.wait(0.03);
  sus.vp -= 5.5;
  lab.tween(0.18, (e, k) => maya.set({ sy: 1 - 0.07 * Math.sin(k * Math.PI), sx: 1 + 0.03 * Math.sin(k * Math.PI), sz: 1 + 0.03 * Math.sin(k * Math.PI) }), ease.linear);
  // the throttle eases off as she arrives
  lab.at(0.24, () => lab.tween(0.18, (e) => (card.tip = -1.0 + 0.8 * e), ease.inOut));
  await lab.tween(0.5, (e) => maya.set({ x: 1 + 2 * e }), launch(0.35));
  maya.set({ x: 3 });
  // let go: the lever springs back square and wobbles; she noses down as she brakes and rocks back
  letGo();
  sus.vp += 4.5;
  await lab.wait(0.14);

  // ================= Rotate Right: the wheel =================
  newCard(['rr']);
  await lab.wait(0.16);
  grip();
  // the wheel goes over a quarter, clockwise
  lab.tween(0.15, (e) => (card.steer = -(Math.PI / 2) * e), ease.inOut);
  await lab.wait(0.06);
  // she follows with real momentum: overshoots the turn and settles back onto it
  const r1 = facing(2);
  await lab.tween(0.26, (e) => maya.set({ rot: r0 + (r1 - r0) * e }), ease.outBack);
  maya.set({ rot: r1 });
  // let go: the wheel spins back on its own
  letGo();
  await lab.wait(0.2);

  // ================= Move Back: tipped back toward us =================
  newCard(['bk']);
  await lab.wait(0.16);
  grip();
  await lab.tween(0.09, (e) => (card.tip = 0.95 * e), ease.out);
  await lab.wait(0.03);
  sus.vp += 3.5;
  lab.at(0.2, () => lab.tween(0.16, (e) => (card.tip = 0.95 - 0.75 * e), ease.inOut));
  await lab.tween(0.42, (e) => maya.set({ y: 2 - e }), launch(0.4));
  maya.set({ y: 1 });
  letGo();
  sus.vp -= 3.5;
  await lab.wait(0.12);

  // ================= U-Turn: hand over hand, then let go =================
  newCard(['ut']);
  await lab.wait(0.16);
  grip();
  const u0 = facing(2);
  const u1 = facing(2) - Math.PI;
  const Q = Math.PI / 2;
  // first shove (a hair too far, and the wheel eases back as the hand lets go)...
  await lab.tween(0.1, (e) => (card.steer = -(Q + 0.2) * e), ease.out);
  // she starts round after it
  lab.tween(0.42, (e) => maya.set({ rot: u0 + (u1 - u0) * e }), ease.outBack);
  await lab.tween(0.06, (e) => (card.steer = -(Q + 0.2) + 0.2 * e), ease.inOut);
  await lab.wait(0.03);
  // ...the other hand comes over: second shove
  await lab.tween(0.1, (e) => (card.steer = -Q - (Q + 0.2) * e), ease.out);
  await lab.tween(0.06, (e) => (card.steer = -2 * Q - 0.2 + 0.2 * e), ease.inOut);
  await lab.wait(0.08);
  // let go: it unwinds on its own, fast, past square and back (boing)
  letGo();
  await lab.wait(0.42);
  maya.set({ rot: u1 });

  // hand back: the card is square again, the sprite takes over
  await lab.tween(0.06, () => {
    card.tip *= 0.5;
    card.steer *= 0.5;
  }, ease.linear);
  card.tip = card.steer = card.vtip = card.vsteer = 0;
  stopCard();
  sus.stop();
  maya.each = null;
  maya.model.body.rotation.set(0, 0, 0);
  rig.visible = false;
  if (bot.card) bot.card.visible = true;
  maya.release({ x: 3, y: 1, d: 0 });
  void TAU;
}
