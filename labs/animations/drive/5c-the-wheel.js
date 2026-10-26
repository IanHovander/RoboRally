// Drive, idea 5 (steering-wheel card), animator c: cut like a car commercial (the driver's hands, then the car).
// The lit card over Maya becomes her controls and always moves a beat before she does. Move 2: it tips forward
// like a throttle, a bead of light runs down a thin control line to her and she pulls away, headlight up.
// Rotate Right: it turns a quarter like a wheel and she follows. Move Back: it tips back toward the room.
// U-Turn: it is spun hand over hand through a half turn, smeared like a fast pan, and she whips round after it.
// Each time the card is let go it springs back square, like a wheel spinning back through loose hands.
export const meta = {
  title: 'The wheel',
  idea:
    "The card over Maya stops being a label and becomes her controls, always a beat ahead of her, like watching a driver's hands and then the car. A tip forward is the throttle: a bead of light runs down a thin control line into her and she pulls away. A quarter turn is the wheel and she follows. A tip back toward the room is reverse. The U-Turn is spun hand over hand through a half turn, smeared like a fast pan, and she whips round after it. Each time it's let go, the card springs back square like a wheel spinning back through loose hands.",
  notes:
    "Everyday: the game's own timing (the card leads by about 0.1 s inside each beat, so no time is added) and no camera move. Sound: a soft detent click as the card moves, a tiny glass tick when the bead reaches her, a whirr for the hand-over-hand spin and a light spring 'thrum' as it snaps square. Porting: the played card sprite is drawn as a camera-facing plane with the same texture, position and scale, so it can tip and turn; it hands back to the sprite when square. Move 1/3 tip by the same throttle; Rotate Left turns the wheel the other way.",
};

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const end = lab.scenario.after.a;
  const maya = lab.puppet('a');
  const cam = lab.camera3;

  // ---- the card as a plane that can tip and turn (same texture, place and size as the game's sprite) ----
  const cardMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  const card = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cardMat));
  card.renderOrder = 31;
  card.visible = false;
  // the smear: a few lagging copies of it while it spins fast
  const echoes = [0.32, 0.2, 0.11].map((o) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
    m.renderOrder = 30;
    m.userData.o = o;
    lab.add(m);
    return m;
  });
  // the control line and its bead of light
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1dc').multiplyScalar(1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lineGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
  lineGeo.translate(0, 0.5, 0);
  const line = lab.add(new THREE.Mesh(lineGeo, lineMat));
  line.renderOrder = 29;
  const bead = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE), color: new THREE.Color('#fff4e6').multiplyScalar(3.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })));
  bead.renderOrder = 32;

  let tip = 0; // + forward (top away from the room), - back
  let wheel = 0; // in-plane turn, - clockwise
  let lineK = 0;
  let beadK = -1; // 0 at the card .. 1 at her; < 0 hidden
  let eyeGain = 1;
  const hist = [];

  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * eyeGain, 3.1 * eyeGain, 2.9 * eyeGain);
    const sp = maya.bot.card;
    if (!sp) {
      card.visible = false;
      return;
    }
    // take the sprite's place exactly, then hide it
    card.visible = sp.visible;
    sp.visible = false;
    cardMat.map = sp.material.map;
    cardMat.opacity = sp.material.opacity;
    card.position.copy(sp.position);
    // a lever, not a sign: tipped forward it's pushed away (up the picture), tipped back it's pulled toward the room
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    card.position.addScaledVector(camUp, 0.16 * tip);
    card.quaternion.copy(cam.quaternion);
    card.rotateX(-tip);
    card.rotateZ(wheel);
    card.scale.set(sp.scale.x, sp.scale.y, 1);
    // the smear: where it was a few frames ago
    hist.unshift({ tip, wheel });
    hist.length = Math.min(hist.length, 8);
    echoes.forEach((e, i) => {
      const h = hist[(i + 1) * 2];
      if (!h) return (e.visible = false);
      const speed = Math.abs(h.wheel - wheel) + Math.abs(h.tip - tip);
      e.visible = speed > 0.15;
      e.material.map = sp.material.map;
      e.material.opacity = e.userData.o * Math.min(1, speed / 0.8);
      e.position.copy(card.position);
      e.quaternion.copy(cam.quaternion);
      e.rotateX(-h.tip);
      e.rotateZ(h.wheel);
      e.scale.copy(card.scale);
    });
    // the control line from the card's lower edge down to her
    const top = sp.position.y - sp.scale.y * 0.36;
    const low = 0.5 + (maya.pose.lift ?? 0);
    line.position.set(sp.position.x, low, sp.position.z);
    line.scale.set(1, Math.max(0.01, top - low), 1);
    lineMat.opacity = 0.55 * lineK;
    if (beadK >= 0 && beadK <= 1) {
      bead.material.opacity = 1;
      bead.position.set(sp.position.x, top + (low - top) * beadK, sp.position.z);
      bead.scale.setScalar(0.22 + 0.12 * Math.sin(beadK * Math.PI));
    } else bead.material.opacity = 0;
  };

  // a command: the line lights, a bead runs down it into her, her eye answers
  const signal = () => {
    lab.tween(0.08, (e) => (lineK = e), ease.out);
    lab.tween(0.1, (e) => (beadK = e), ease.in).then(() => {
      beadK = -1;
      eyeGain = 2.2;
      lab.tween(0.35, (e) => (eyeGain = 2.2 - 1.2 * e), ease.out);
      lab.tween(0.25, (e) => (lineK = 1 - e), ease.in);
    });
  };
  // let go: the card springs back square
  const letGo = (dur = 0.4) => {
    const t0 = tip;
    const w0 = wheel;
    return lab.tween(dur, (e) => {
      tip = t0 * (1 - e);
      wheel = w0 * (1 - e);
    }, ease.outElastic);
  };

  // ---- Move 2: throttle ----
  lab.playCard('a', ['m2']);
  await lab.wait(0.16); // it turns over
  signal();
  await lab.tween(0.1, (e) => (tip = 0.95 * e), ease.out3);
  let gone = false;
  await lab.tween(0.52, (e, k) => {
    maya.set({ x: 1 + 2 * e, pitch: -0.08 * Math.sin(Math.min(1, k * 2) * Math.PI) + 0.06 * Math.max(0, Math.sin((k - 0.5) * 2 * Math.PI)) });
    if (k > 0.55 && !gone) {
      gone = true;
      letGo(0.45);
    }
  }, ease.inOut);
  await lab.wait(0.06);

  // ---- Rotate Right: the wheel, and she follows a split second later ----
  lab.playCard('a', ['rr']);
  await lab.wait(0.12);
  signal();
  lab.tween(0.12, (e) => (wheel = (-Math.PI / 2) * e), ease.out3).then(() => letGo(0.45));
  await lab.wait(0.07);
  await lab.tween(0.3, (e) => maya.set({ rot: facing(1) + (facing(2) - facing(1)) * e, roll: 0.08 * Math.sin(e * Math.PI) }), ease.out3);
  await lab.wait(0.06);

  // ---- Move Back: reverse ----
  lab.playCard('a', ['bk']);
  await lab.wait(0.12);
  signal();
  gone = false;
  lab.tween(0.1, (e) => (tip = -1.0 * e), ease.out3);
  await lab.wait(0.06);
  await lab.tween(0.34, (e, k) => {
    maya.set({ y: 2 - e, pitch: 0.06 * Math.sin(k * Math.PI) });
    if (k > 0.5 && !gone) {
      gone = true;
      letGo(0.4);
    }
  }, ease.inOut);
  await lab.wait(0.06);

  // ---- U-Turn: hand over hand, then let go and it spins back square ----
  lab.playCard('a', ['ut']);
  await lab.wait(0.12);
  signal();
  lab.wait(0.06).then(() => lab.tween(0.4, (e) => maya.set({ rot: facing(2) - Math.PI * e }), ease.inOut));
  await lab.tween(0.1, (e) => (wheel = (-Math.PI / 2) * e), ease.out3);
  await lab.wait(0.03);
  await lab.tween(0.1, (e) => (wheel = -Math.PI / 2 - (Math.PI / 2) * e), ease.out3);
  await lab.wait(0.05);
  await lab.tween(0.38, (e) => (wheel = -Math.PI * (1 - e)), (k) => ease.outBack(k, 1.4));
  await lab.wait(0.03);

  // hand the card back to the game's sprite (same place, same size, square again)
  wheel = 0;
  tip = 0;
  maya.each = null;
  card.visible = false;
  for (const e of echoes) e.visible = false;
  if (maya.bot.card) maya.bot.card.visible = true;
  lineMat.opacity = 0;
  maya.set({ roll: 0, pitch: 0 });
  maya.release({ x: end.x, y: end.y, d: end.d });
}
