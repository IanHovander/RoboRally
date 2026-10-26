// Edge-on, through weight and physical comedy: the beam is a heavy glass slide seen exactly edge-on, so it
// crosses the row as an ordinary laser line. Its head stops dead on Maya's flank and the rest slams in
// after it like a tape measure snapping home, overshooting and bouncing to card size. Then the slide falls
// open toward us like a hinged sign: it drops with gravity, swings past, creaks back and settles, and we
// see what it was all along: the SPAM card. A little wind-up, and it's shoved through a slot of light into
// her side like a slide into a projector; the shove rocks her and her body glows once.
export const meta = {
  title: 'Edge-on (the heavy slide)',
  idea: 'The laser line is a glass slide seen edge-on. Its head stops dead on Maya\'s flank, the rest slams in like a tape measure and bounces to card size, then it falls open toward us like a hinged sign, swinging past and creaking back: it was the SPAM card all along. A wind-up, and it\'s shoved through a slot of light into her side; the shove rocks her and she glows once.',
  notes: 'Sound: the plain laser zap, a ratcheting zip as the tail slams in with a boing at the bottom, a soft glass whump as the slide falls open and two little creaks as it swings, then a projector\'s ka-chunk as it goes in and a warm chime for the glow. Two SPAM cards would come as two slides, the second stacking behind the first and following it in. The slide is a thin box: its rim is the laser line, its face a canvas texture drawn in light.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const theoBot = lab.bot('b');
  const color = theoBot.color;
  const glowTex = lab.bot('a').model.poolMat.map;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });

  // ---------- the slide's face: a card drawn in light ----------
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 352;
  const g = cv.getContext('2d');
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  g.fillStyle = 'rgba(120,160,230,0.22)';
  rr(6, 6, 244, 340, 26);
  g.fill();
  g.strokeStyle = 'rgba(235,245,255,0.95)';
  g.lineWidth = 5;
  rr(8, 8, 240, 336, 24);
  g.stroke();
  g.strokeStyle = 'rgba(200,220,255,0.35)';
  g.lineWidth = 2;
  rr(22, 22, 212, 308, 14);
  g.stroke();
  // a thin warning triangle
  g.strokeStyle = 'rgba(255,150,130,1)';
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(128, 70);
  g.lineTo(206, 206);
  g.lineTo(50, 206);
  g.closePath();
  g.stroke();
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(128, 115);
  g.lineTo(128, 162);
  g.stroke();
  g.fillStyle = 'rgba(255,150,130,1)';
  g.beginPath();
  g.arc(128, 184, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(235,245,255,0.95)';
  g.font = '300 38px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('S P A M', 128, 290);
  const faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;

  // the slide: a thin box, its rim the laser line, its faces the card
  const slot = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const clip = [slot];
  const rimMat = new THREE.MeshBasicMaterial({ color: hdr('#e8f2ff', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, color: hdr('#ffffff', 2.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
  const backMat = new THREE.MeshBasicMaterial({ color: hdr(color, 0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
  const card = lab.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [rimMat, rimMat, rimMat, rimMat, faceMat, backMat]));
  card.renderOrder = 6;
  card.visible = false;
  // the laser's glow around the rim while it's edge-on
  const sheathMat = new THREE.MeshBasicMaterial({ color: hdr(color, 1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
  const sheath = lab.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 12, 1, true), sheathMat));
  sheath.rotation.z = Math.PI / 2;
  sheath.visible = false;
  const head = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr('#ffffff', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  head.visible = false;
  // the projector's slot: a thin bar of light on her flank
  const slit = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: hdr(color, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  slit.renderOrder = 7;
  const prevClip = lab.renderer.localClippingEnabled;
  lab.renderer.localClippingEnabled = true;
  lab.cleanup(() => (lab.renderer.localClippingEnabled = prevClip));

  // ---------- the slide's state ----------
  const row = lab.pos(1, 1).z;
  const FLANK = lab.pos(1, 1).x + 0.4;
  theo.model.muzzle.updateWorldMatrix(true, false);
  const MUZ = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const CARD_W = 0.54;
  const CARD_H = 0.74;
  const T = 0.03; // thickness
  const s = { west: MUZ.x, east: MUZ.x, y: MUZ.y, turn: 0, h: CARD_H, glow: 0 };
  const X = new THREE.Vector3(1, 0, 0);
  const Ye = new THREE.Vector3();
  const W = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const M = new THREE.Matrix4();
  const camPos = new THREE.Vector3();
  slot.constant = -(FLANK - 0.02);
  lab.every(() => {
    if (!card.visible) return;
    const cx = (s.west + s.east) / 2;
    const len = Math.max(0.002, s.east - s.west);
    const c = new THREE.Vector3(cx, s.y, row);
    // edge-on: the card's height runs exactly along the line of sight
    lab.camera3.getWorldPosition(camPos);
    Ye.set(0, camPos.y - c.y, camPos.z - c.z).normalize();
    W.set(0, Ye.z, -Ye.y); // the same, turned 90° about the beam (up and away from us)
    const a = s.turn * (Math.PI / 2);
    Y.copy(Ye).multiplyScalar(Math.cos(a)).addScaledVector(W, Math.sin(a));
    Z.crossVectors(X, Y);
    M.makeBasis(X, Y, Z);
    card.quaternion.setFromRotationMatrix(M);
    card.position.copy(c);
    card.scale.set(len, s.h, T);
    const edge = 1 - clamp01(s.turn * 1.4);
    sheath.position.copy(c);
    sheath.scale.set(1, len, 1);
    sheathMat.opacity = 0.5 * edge;
    sheath.visible = edge > 0.01;
    faceMat.opacity = clamp01(s.turn * 1.5);
    rimMat.color.copy(hdr('#e8f2ff', 3 - 1.4 * clamp01(s.turn)));
  });

  // Maya: rocked by the shove, glows once
  const my = { rock: 0, glow: 0, squash: 0 };
  maya.each = (model) => {
    maya.set({ x: 1, y: 1, rot: facing(2), roll: 0.16 * my.rock, sy: 1 - 0.1 * my.squash, sx: 1 + 0.06 * my.squash, sz: 1 + 0.06 * my.squash });
    if (my.glow > 0) {
      model.paint.emissiveIntensity = 0.16 + 1.5 * my.glow;
      const e = 1 + 2.2 * my.glow;
      model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    }
  };
  const th = { kick: 0, brace: 0 };
  theo.each = () => theo.set({ x: 5 + 0.08 * th.kick, y: 1, rot: facing(3), pitch: -0.1 * th.brace - 0.22 * th.kick, sy: 1 - 0.07 * th.brace });

  // ---------- the beats ----------
  await lab.tween(0.1, (e) => (th.brace = e), ease.out);
  // fire: an ordinary laser line, its head racing to her flank
  lab.arena.emit('laser', { hit: true, src: 'b' });
  card.visible = head.visible = true;
  lab.tween(0.25, (e, k) => {
    th.brace = 1 - e;
    th.kick = Math.sin(Math.min(1, k * 1.8) * Math.PI) * (1 - k * 0.6);
  }, ease.out);
  await lab.tween(0.17, (e) => {
    s.west = MUZ.x + (FLANK - MUZ.x) * e;
    head.position.set(s.west, s.y, row);
    head.scale.setScalar(0.34);
  }, ease.in);
  // stop dead: a hard little flare against her flank, and she takes the knock
  head.scale.setScalar(0.5);
  lab.tween(0.18, (e) => {
    head.material.opacity = 1 - e;
    head.scale.setScalar(0.5 + 0.2 * e);
  }, ease.out).then(() => (head.visible = false));
  lab.tween(0.22, (e, k) => (my.rock = Math.sin(k * Math.PI) * 0.6 * (1 - k)), ease.linear);
  // the tail slams in after it like a tape measure, overshoots past card size, and bounces back
  const e0 = s.east;
  const cardEast = FLANK + CARD_W;
  await lab.tween(0.13, (e) => (s.east = e0 + (cardEast - 0.14 - e0) * e), ease.in3);
  lab.shake(0.01, 0.1);
  await lab.tween(0.14, (e, k) => (s.east = cardEast - 0.14 * Math.cos(k * Math.PI * 1.5) * (1 - k) ** 1.4), ease.linear);
  s.east = cardEast;
  // it falls open toward us like a hinged sign: gravity, swing past, creak back, settle (and it rises
  // a little so its bottom edge clears the glass)
  const y0 = s.y;
  const yUp = 0.42;
  await lab.tween(0.15, (e) => {
    s.turn = e;
    s.y = y0 + (yUp - y0) * e;
    s.west = FLANK + 0.03 * e;
    s.east = cardEast + 0.03 * e;
  }, ease.in);
  lab.arena.emit('flip', { id: 'a' });
  await lab.tween(0.36, (e, k) => {
    s.turn = 1 + 0.32 * Math.sin(k * Math.PI * 2.5) * (1 - k) ** 1.6;
  }, ease.linear);
  s.turn = 1;
  // a breath: the card faces us; the slot of light opens on her flank
  slit.quaternion.copy(card.quaternion);
  slit.position.set(FLANK - 0.01, s.y, row);
  await lab.tween(0.1, (e) => {
    slit.material.opacity = e;
    slit.scale.set(0.03, CARD_H * 1.12 * e, 1);
  }, ease.outBack);
  // wind-up: it backs off a hair...
  await lab.tween(0.08, (e) => {
    s.west = FLANK + 0.03 + 0.07 * e;
    s.east = s.west + CARD_W;
  }, ease.out);
  // ...and is shoved in: ka-chunk
  await lab.tween(0.16, (e) => {
    s.west = FLANK + 0.1 - (CARD_W + 0.12) * e;
    s.east = s.west + CARD_W;
  }, ease.in3);
  card.visible = false;
  sheath.visible = false;
  lab.arena.emit('damage', { id: 'a', n: 1 });
  lab.ring(lab.pos(1, 1), color, 0.6, 0.02, 0.45);
  lab.tween(0.22, (e) => (slit.material.opacity = 1 - e), ease.out);
  await lab.tween(0.42, (e, k) => {
    my.rock = -Math.sin(k * Math.PI * 2.4) * 0.5 * (1 - k) ** 1.5;
    my.squash = Math.max(0, Math.cos(k * Math.PI * 2) * (1 - k) ** 2);
    my.glow = k < 0.1 ? k / 0.1 : (1 - (k - 0.1) / 0.9) ** 2;
    th.kick = 0;
  }, ease.linear);
  my.glow = 0;
  maya.each = null;
  theo.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
  void arena;
}
