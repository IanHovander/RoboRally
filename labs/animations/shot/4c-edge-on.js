// Edge-on, staged as a slide show: the beam is a card seen exactly from the side (it is built facing away from
// the camera, so it really is a line). When it reaches Maya it reels itself in, the house lights go down, and it
// turns in slow motion to face us: the SPAM card. It slides into her like a slide into a projector... and for
// one beat she is the projector, throwing the card she just took onto the glass in front of her.
export const meta = {
  title: 'Edge-on (slide show)',
  idea: 'The beam crosses the row like any laser, because it is a long card of light seen exactly edge-on. At Maya it reels itself in to card size, the house lights dip like a cinema and, in slow motion, it turns to face the camera, a band of light sweeping across it as it squares up: a lit coral slide with a thin ⚠ (SPAM). It hangs for a breath, then slides into her side through a slot of light. Ka-chunk: her body glows once, her eye becomes a projector lens and throws the card she just took onto the glass in front of her, big and readable, while the lights come back up.',
  notes: 'Sound: the usual laser zip, then a soft "fwip" as it turns (a card flicked), a held glass tone for the hang, a clean mechanical "ka-chunk" of a slide changer, and a projector-fan whirr under the projection. The card plane is computed each frame to contain the camera, so it stays a perfect line until it turns; on a bigger board the same holds from any camera. The projected card shows which damage it was (SPAM coral, Haywire violet), so it can stay on every register.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const CORAL = '#ff7a6b';

  // ----- the slide: a coral card with a thin ⚠, drawn on a canvas -----
  const CW = 0.66;
  const CH = 0.9;
  const cardTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 345;
    const g = c.getContext('2d');
    g.fillStyle = CORAL;
    g.beginPath();
    g.roundRect(10, 10, 236, 325, 34);
    g.fill();
    g.strokeStyle = 'rgba(255,240,230,.9)';
    g.lineWidth = 3;
    g.stroke();
    const s = 150 / 40; // the game's ⚠ glyph (glyphs.js), 40 units wide
    g.save();
    g.translate(128 - 20 * s, 172 - 21 * s);
    g.scale(s, s);
    g.strokeStyle = '#15181d';
    g.fillStyle = '#15181d';
    g.lineWidth = 2.6;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(20, 8);
    g.lineTo(33, 31);
    g.lineTo(7, 31);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(20, 16);
    g.lineTo(20, 23);
    g.stroke();
    g.beginPath();
    g.arc(20, 27, 1.7, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const faceMat = new THREE.MeshBasicMaterial({ map: cardTex, color: new THREE.Color(1.15, 1.15, 1.15), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const card = new THREE.Group(); // local x: along the beam; local y: across the card; local z: its face normal
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), faceMat);
  card.add(face);
  const edgeGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  edgeGeo.rotateZ(Math.PI / 2);
  const edgeCore = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.3, 3.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const edgeGlow = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#4dabf7').multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  card.add(edgeCore, edgeGlow);
  // the glint: a soft band of light that sweeps across the face as it squares up to us
  const bandTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 4;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bandTex, color: new THREE.Color(1.6, 1.5, 1.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  band.position.z = 0.003;
  card.add(band);
  const glint = { u: 0, o: 0 };
  lab.add(card);

  theo.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const Z = lab.pos(1, 1).z;
  const XF = lab.pos(1, 1).x + 0.42; // Maya's east flank
  // the card's state: its two ends along x, its height, how far it has turned, how much of it is in her
  const S = { x0: muzzle.x, x1: muzzle.x, y: 0.15, turn: 0, h: CH, inside: 0, edge: 1, scale: 1 };
  const X = new THREE.Vector3(1, 0, 0);
  const place = () => {
    // the card is the strip between x1 (west end) and x0; only the part outside her flank shows (a slot)
    const xa = Math.max(S.x1, XF);
    const len = Math.max(0.001, S.x0 - xa);
    const mid = new THREE.Vector3((S.x0 + xa) / 2, S.y, Z);
    // edge-on: the card's plane holds the line and the camera; turning rotates it about its long axis
    const C = lab.camera3.position;
    const toCam = new THREE.Vector3(0, C.y - mid.y, C.z - mid.z).normalize();
    const ang = Math.atan2(toCam.z, toCam.y) - S.turn * (Math.PI / 2);
    card.position.copy(mid);
    card.quaternion.setFromAxisAngle(X, ang);
    // with ang the card's local y points at the camera (edge-on); after the turn it points up and back
    // the face is always full size: only the turn reveals it (edge-on it would be a degenerate line, so it is hidden)
    face.scale.set(len, S.h * S.scale, 1);
    face.visible = S.turn > 0.002;
    // texture: show the visible part of the card (it slides into her from its west end)
    cardTex.repeat.set(1 - S.inside, 1);
    cardTex.offset.set(S.inside, 0);
    for (const [m, r] of [[edgeCore, 0.011], [edgeGlow, 0.034]]) m.scale.set(len, r, r);
    edgeCore.material.opacity = S.edge;
    edgeGlow.material.opacity = 0.5 * S.edge;
    faceMat.opacity = 1;
    band.visible = face.visible && glint.o > 0.001;
    band.scale.set(len * 0.35, S.h * S.scale, 1);
    band.position.x = (glint.u - 0.5) * len * 1.1;
    band.material.opacity = glint.o;
  };
  const camAt = lab.pos(1.6, 1).setY(0.3);

  // ----- house lights: dim the room for the slide show -----
  const saved = { key: A.key.intensity, hemi: A.hemi.intensity, env: lab.scene.environmentIntensity };
  let house = 0;
  const restore = () => {
    A.key.intensity = saved.key;
    A.hemi.intensity = saved.hemi;
    lab.scene.environmentIntensity = saved.env;
  };
  lab.cleanup(restore);
  const houseHook = lab.every(() => {
    A.key.intensity = saved.key * (1 - 0.55 * house);
    A.hemi.intensity = saved.hemi * (1 - 0.6 * house);
    lab.scene.environmentIntensity = saved.env * (1 - 0.5 * house);
    A.topMat.emissiveIntensity *= 1 - 0.6 * house;
  });
  const others = [theo, lab.puppet('c')];
  for (const p of others) p.each = (m) => {
    m.poolMat.opacity *= 1 - 0.6 * house;
    m.ringMat.opacity *= 1 - 0.5 * house;
  };

  // ----- camera -----
  const cam = { k: 0 };
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(camAt, 0.4 * cam.k),
    dist: home.dist * (1 - 0.2 * cam.k),
  }));

  // ----- 1. an ordinary laser crosses the row -----
  const placeHook = lab.every(place);
  await lab.tween(0.13, (e) => (S.x1 = muzzle.x + (XF - muzzle.x) * e), ease.in);
  lab.ring(lab.pos(1, 1).add(new THREE.Vector3(0.42, 0.15, 0)), '#cfe6ff', 0.2, 0.15, 0.25);
  await lab.wait(0.1);

  // ----- 2. it reels itself in to card size, rising to her side -----
  const x0a = S.x0;
  lab.tween(0.5, (e) => (cam.k = e), ease.inOut);
  await lab.tween(0.2, (e) => {
    S.x0 = x0a + (XF + CW - x0a) * e;
    S.y = 0.15 + (CH / 2 + 0.06 - 0.15) * e;
  }, ease.inOut3);

  // ----- 3. lights down, slow motion, and it turns to face us -----
  lab.slowmo(0.5, 0.05);
  lab.tween(0.25, (e) => (house = e), ease.out);
  await lab.tween(0.2, (e, k) => {
    S.turn = e;
    S.edge = 1 - Math.min(1, e * 1.5);
    // the light catches it as it squares up: a band sweeps across the face
    glint.u = k;
    glint.o = Math.sin(k * Math.PI) * 0.9;
  }, ease.inOut);
  glint.o = 0;
  lab.slowmo(1, 0.12);
  // it hangs for a breath: one bright flare as it faces us, then breathing light
  const flare = { k: 0 };
  const hang = lab.every((dt, t) => faceMat.color.setScalar(1.15 + 0.15 * Math.sin(t * 14) + flare.k));
  lab.tween(0.2, (e, k) => (flare.k = 0.9 * Math.exp(-k * 4) * Math.min(1, k * 8)), ease.linear);
  await lab.wait(0.22);
  hang();
  faceMat.color.setScalar(1.2);

  // ----- 4. into her side, through a slot of light -----
  const slot = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(0.022, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  const slotHook = lab.every(() => {
    slot.position.set(XF + 0.005, S.y, Z + 0.02);
    slot.quaternion.copy(card.quaternion);
    slot.scale.set(1, S.h * S.scale * 1.06, 1);
  });
  await lab.tween(0.06, (e) => (slot.material.opacity = e), ease.out);
  await lab.tween(0.2, (e) => {
    S.inside = e;
    S.x0 = XF + CW * (1 - e);
    S.scale = 1 - 0.25 * e;
  }, ease.in3);
  card.visible = false;
  placeHook();
  lab.tween(0.15, (e) => (slot.material.opacity = 1 - e), ease.out).then(() => {
    slotHook();
    slot.visible = false;
  });

  // ----- 5. ka-chunk: she glows once and projects the card she took onto the glass in front of her -----
  const glow = { k: 0, lens: 0 };
  maya.each = (m) => {
    m.paint.emissive.set(CORAL);
    m.paint.emissiveIntensity = 0.16 + 1.3 * glow.k;
    m.eyeMat.color.setRGB(3.2 + 6 * glow.lens, 3.1 + 4 * glow.lens, 2.9 + 3 * glow.lens);
  };
  lab.shake(0.012, 0.12);
  lab.tween(0.16, (e, k) => maya.set({ sy: 1 - 0.1 * Math.sin(k * Math.PI), sx: 1 + 0.06 * Math.sin(k * Math.PI), sz: 1 + 0.06 * Math.sin(k * Math.PI) }), ease.linear);
  lab.tween(0.5, (e) => (glow.k = Math.sin(Math.min(1, e * 1.6) * Math.PI) * (1 - e * 0.3)), ease.linear).then(() => (glow.k = 0));

  // the projection: a cone of light from her eye to an image of the card on the glass
  maya.model.body.updateWorldMatrix(true, true);
  const eye = new THREE.Vector3(0, 0.252, -0.2).applyMatrix4(maya.model.body.matrixWorld);
  const imgC = lab.pos(1, 2.05);
  const IW = 0.78;
  const IH = 1.0;
  const projTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 330;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 165, 20, 128, 165, 210);
    grd.addColorStop(0, '#ff8a7c');
    grd.addColorStop(1, '#5a1c16');
    g.fillStyle = grd;
    g.beginPath();
    g.roundRect(8, 8, 240, 314, 30);
    g.fill();
    g.strokeStyle = '#ffd2c8';
    g.lineWidth = 4;
    g.stroke();
    const s = 150 / 40;
    g.save();
    g.translate(128 - 20 * s, 165 - 21 * s);
    g.scale(s, s);
    g.strokeStyle = '#000';
    g.fillStyle = '#000';
    g.lineWidth = 2.8;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(20, 8);
    g.lineTo(33, 31);
    g.lineTo(7, 31);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(20, 16);
    g.lineTo(20, 23);
    g.stroke();
    g.beginPath();
    g.arc(20, 27, 1.8, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const img = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), new THREE.MeshBasicMaterial({ map: projTex, color: new THREE.Color(1.15, 1.15, 1.15), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  img.rotation.x = -Math.PI / 2;
  img.position.set(imgC.x, 0.014, imgC.z);
  // the cone: four triangles from the lens to the image's corners, bright at the lens and fading out
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(imgC.x + (a * IW) / 2, 0.014, imgC.z + (b * IH) / 2));
  const pos = [];
  const col = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    pos.push(eye.x, eye.y, eye.z, a.x, a.y, a.z, b.x, b.y, b.z);
    col.push(1.5, 0.92, 0.8, 0.1, 0.05, 0.045, 0.1, 0.05, 0.045);
  }
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const coneMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = lab.add(new THREE.Mesh(coneGeo, coneMat));
  await lab.wait(0.06);
  // the lamp catches with a flicker, like a projector warming up
  await lab.tween(0.16, (e, k) => {
    const flick = k < 0.25 ? 1 : k < 0.4 ? 0.15 : k < 0.55 ? 0.9 : k < 0.65 ? 0.3 : 1;
    glow.lens = e * flick;
    coneMat.opacity = 0.9 * e * flick;
    img.material.opacity = 0.8 * e * flick;
    img.scale.setScalar(0.9 + 0.1 * e);
  }, ease.out);
  await lab.wait(0.2);
  // the lights come back up and the projection washes out
  lab.tween(0.4, (e) => (house = 1 - e), ease.inOut);
  lab.tween(0.42, (e) => (cam.k = 1 - e), ease.inOut);
  await lab.tween(0.3, (e) => {
    glow.lens = 1 - e;
    coneMat.opacity = 0.9 * (1 - e);
    img.material.opacity = 0.8 * (1 - e);
  }, ease.inOut);
  cone.visible = img.visible = false;
  await lab.wait(0.13);
  houseHook();
  restore();
  releaseCam();
  maya.each = null;
  for (const p of others) p.each = null;
  maya.set({ sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
  others[1].release({ x: 3, y: 3, d: 0 });
}
