// Mirror Swap (animator a: weight & physical comedy)
// As the belts start, a heavy pane of smoked glass shoots up out of the corner tile along its SW-NE diagonal
// (the angle at which a mirror turns north into east), overshoots and settles with a wobble. Maya rides the
// belt in, still facing north, and in the glass's face her reflection rides in to meet her, already facing
// east. They meet at the glass with a bonk: both squash against it, the pane bulges and rings with a ripple
// of light. Then the swap: a glint runs across the pane, the real Maya goes pale and sinks into the glass, and
// her reflection is the solid one. The pane drops back into the board (taking the old Maya with it), the
// reflection hops sideways onto the centre of the corner, lands with a wobble, and does a quick double take
// over her shoulder at the spot where the glass was. Only the east-facing Maya is left.
export const meta = {
  title: 'Mirror Swap',
  idea:
    'A pane of smoked glass shoots up on the corner\'s diagonal; Maya rides in facing north while her reflection, facing east, rides in to meet her. Bonk: the pane flexes and rings, a glint runs across it, and the reflection is the one that hops out onto the corner as the pane sinks with the original inside. She does a double take at where the glass was.',
  notes:
    'Geometry is a real mirror: the pane stands on the SW-NE diagonal, so her reflection faces east and comes up the south leg exactly as she comes along the east leg; they touch the glass at the same point. Physics: the pane has mass (overshoot and wobble as it rises, a bulge and ripple when she hits it, a gulp as it sinks); both Mayas squash on contact; the hop out lands with a squash and a settle. For a left-turning corner the pane stands on the other diagonal. Sound: a deep glass slide-and-clunk as the pane rises; a bright "bonk" with a ringing tail; a rising shimmer for the glint; a soft "gulp" as the pane sinks; a tiny "tik" for the double take.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { ease, facing, arena, THREE, PALETTE } = lab;
  const maya = lab.puppet('a');
  const m = maya.model;
  const C = lab.pos(3, 1);
  const belt = arena.belts.find((b) => b.fast) ?? arena.belts[0];

  // ---- the pane: smoked glass on the diagonal, bright edges, a seam of light where it meets the board ----
  const W = Math.SQRT2 * 0.96;
  const H = 0.82;
  const pane = lab.add(new THREE.Group());
  pane.position.set(C.x, -H - 0.02, C.z);
  pane.rotation.y = Math.PI / 4; // local +x runs SW -> NE, local +z (its front) faces south-east, toward us
  const geo = new THREE.PlaneGeometry(W, H, 30, 12);
  geo.translate(0, H / 2, 0);
  const base = geo.attributes.position.array.slice();
  const sheetMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d1219, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false, emissive: 0x6c7a90, emissiveIntensity: 0.07, envMapIntensity: 1.4,
  });
  const sheet = new THREE.Mesh(geo, sheetMat);
  sheet.renderOrder = 4;
  pane.add(sheet);
  const LIGHT = new THREE.Color(PALETTE.light);
  const edgeMat = new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.016, 0.016), edgeMat);
  top.position.y = H;
  pane.add(top);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.012, H, 0.012), edgeMat);
    side.position.set((sx * W) / 2, H / 2, 0);
    pane.add(side);
  }
  // the glint that runs across the pane at the swap
  const glintTex = (() => {
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
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.34, H), new THREE.MeshBasicMaterial({ map: glintTex, color: LIGHT.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glint.position.set(0, H / 2, 0.012);
  glint.renderOrder = 5;
  pane.add(glint);
  // the seam on the glass where the pane comes out
  const seam = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(W, 0.05), new THREE.MeshBasicMaterial({ map: glintTex, color: LIGHT.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  seam.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  seam.position.set(C.x, 0.009, C.z);
  // ripples of light on the pane where they bonk
  const ripples = [];
  const clip0 = lab.renderer.localClippingEnabled;
  lab.renderer.localClippingEnabled = true;
  lab.cleanup(() => (lab.renderer.localClippingEnabled = clip0));
  const paneClip = () => {
    // the pane's side edges, in the world, as it stands now
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(pane.quaternion);
    const c = pane.position;
    return [new THREE.Plane(u.clone(), -u.dot(c) + W / 2), new THREE.Plane(u.clone().negate(), u.dot(c) + W / 2), new THREE.Plane(new THREE.Vector3(0, -1, 0), c.y + H)];
  };
  const ripple = (lx, ly, color, size, dur) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: paneClip() }));
    r.position.set(lx, ly, 0.014);
    pane.add(r);
    ripples.push(r);
    lab.tween(dur, (e, k) => {
      const s = 0.04 + size * e;
      r.scale.set(s, s, 1);
      r.material.opacity = (1 - k) ** 1.6;
    }, ease.out).then(() => (r.visible = false));
  };
  lab.cleanup(() => {
    glintTex.dispose();
    geo.dispose();
  });

  // the pane's flex: a bulge at the contact point (pushed away from Maya), plus rings travelling out from it
  const flex = { cx: -0.4, cy: 0.16, bulge: 0, ring: 0, t0: 0 };
  const posAttr = geo.attributes.position;
  const bend = () => {
    const a = posAttr.array;
    const tt = lab.t - flex.t0;
    for (let i = 0; i < a.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      const r = Math.hypot(x - flex.cx, y - flex.cy);
      const bump = flex.bulge * Math.exp(-(r * r) / 0.06);
      const wave = flex.ring * Math.sin(r * 26 - tt * 34) * Math.exp(-r * 2.2) * Math.min(1, r * 6);
      a[i + 2] = bump + wave * 0.022;
    }
    posAttr.needsUpdate = true;
  };

  // ---- the reflection: a copy of Maya, the same polished form, that can be glass or solid ----
  const ghost = lab.add(maya.group.clone(true));
  for (const o of [...ghost.children]) if (o.isSprite) ghost.remove(o); // not her name tag
  ghost.traverse((o) => o.isMesh && (o.material = o.material.clone()));
  const [gBody, gRing, gTick, gPool] = ghost.children;
  let gPaint = null;
  let gEye = null;
  gBody.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isMeshPhysicalMaterial) gPaint = o.material;
    else gEye = o.material;
  });
  gBody.position.set(0, 0, 0);
  gBody.rotation.set(0, 0, 0);
  ghost.rotation.order = 'YXZ';
  // both Mayas' paint can go glassy
  const paint0 = { transparent: m.paint.transparent, opacity: m.paint.opacity, emissive: m.paint.emissiveIntensity };
  m.paint.transparent = true;
  m.paint.needsUpdate = true;
  gPaint.transparent = true;
  gPaint.needsUpdate = true;
  lab.cleanup(() => {
    m.paint.transparent = paint0.transparent;
    m.paint.opacity = paint0.opacity;
    m.paint.emissiveIntensity = paint0.emissive;
    m.paint.depthWrite = true;
    m.paint.needsUpdate = true;
    m.body.scale.set(1, 1, 1);
  });
  /** k: 1 solid, 0 a reflection in glass. */
  const glassy = (paint, k) => {
    paint.opacity = 0.36 + 0.64 * k;
    paint.depthWrite = k > 0.6;
    paint.emissiveIntensity = 0.16 + 0.75 * (1 - k);
  };
  const G = { x: 3, y: 3, rot: facing(1), lift: 0, k: 0, vis: 0, sx: 1, sy: 1, sz: 1 };
  const placeGhost = () => {
    const p = lab.pos(G.x, G.y);
    ghost.visible = G.vis > 0.01;
    ghost.position.set(p.x, G.lift, p.z);
    ghost.rotation.set(0, G.rot, 0);
    ghost.scale.set(1.3, 1.3, 1.3);
    gBody.scale.set(G.sx, G.sy, G.sz);
    glassy(gPaint, G.k);
    gPaint.opacity *= G.vis;
    gEye.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(0.25 + 0.75 * G.k * G.vis);
    gRing.material.opacity = 0.9 * G.vis * (0.25 + 0.75 * G.k);
    gTick.material.opacity = gRing.material.opacity;
    gPool.material.opacity = 0.75 * G.vis * G.k;
  };

  // Maya herself
  const S = { x: 1, y: 1, rot: facing(0), lift: 0, k: 1, sx: 1, sy: 1, sz: 1, trail: true };
  maya.each = (model) => {
    model.body.scale.set(S.sx, S.sy, S.sz);
    glassy(model.paint, S.k);
    model.eyeMat.color.multiplyScalar(0.25 + 0.75 * S.k);
    model.ringMat.opacity *= 0.25 + 0.75 * S.k;
    model.poolMat.opacity *= S.k;
  };
  // the mirror: across the SW-NE diagonal through the corner's centre, (3 - d, 1) <-> (3, 1 + d)
  const mirror = () => {
    G.x = 3 + (S.y - 1);
    G.y = 1 + (3 - S.x);
    G.lift = S.lift;
    G.sx = S.sx;
    G.sy = S.sy;
    G.sz = S.sz;
  };
  let mirroring = true;
  const drive = lab.every(() => {
    if (mirroring) mirror();
    maya.set({ x: S.x, y: S.y, rot: S.rot, lift: S.lift, trail: S.trail });
    placeGhost();
    bend();
  });

  // ---- 1. the belts start; the pane shoots up out of the corner, overshoots and settles ----
  belt.pulse = lab.t;
  lab.tween(0.36, (e, k) => {
    pane.position.y = -H - 0.02 + (H + 0.02) * e;
    seam.material.opacity = Math.min(1, k * 3) * 0.9;
    edgeMat.opacity = 0.4 + 0.6 * k;
    G.vis = 0.55 * Math.max(0, Math.min(1, k * 1.4 - 0.2)); // her reflection appears in its face
  }, (k) => ease.outBack(k, 1.6)).then(() =>
    // it lands heavy: a rocking wobble about its long edge
    lab.tween(0.4, (e, k) => {
      pane.rotation.x = Math.sin(k * TAU * 1.5) * 0.06 * (1 - k) ** 1.5;
      flex.ring = 0.6 * (1 - k);
      if (k === 0) flex.t0 = lab.t;
      seam.material.opacity = 0.9 - 0.4 * k;
    }, ease.linear),
  );
  flex.t0 = lab.t;
  flex.cx = 0;
  flex.cy = 0;
  // the express step: one space east
  await lab.tween(0.42, (e) => (S.x = 1 + e), ease.inOut);
  S.x = 2;
  await lab.wait(0.05);

  // ---- 2. the all-belts step: she rides in still facing north; her reflection rides up to meet her ----
  belt.pulse = lab.t;
  const touch = 3 - 0.56; // her side meets the glass here (and so does her reflection's)
  await lab.tween(0.34, (e, k) => {
    S.x = 2 + (touch - 2) * e;
    G.vis = 0.55 + 0.45 * k;
  }, ease.in);
  S.x = touch;
  G.vis = 1;

  // ---- 3. BONK: both squash against the glass, the pane bulges and rings ----
  flex.cx = -0.4;
  flex.cy = 0.16;
  flex.t0 = lab.t;
  ripple(-0.4, 0.16, PALETTE.light, 0.55, 0.45);
  ripple(-0.4, 0.16, '#ff4d6d', 0.85, 0.6);
  lab.shake(0.01, 0.12);
  await lab.tween(0.16, (e, k) => {
    const s = Math.sin(k * Math.PI);
    // squash flat along the direction of travel (her local x, east-west)
    S.sx = 1 - 0.2 * s;
    S.sz = 1 + 0.08 * s;
    S.sy = 1 + 0.06 * s;
    S.x = touch + 0.04 * s;
    flex.bulge = 0.09 * s;
    flex.ring = 1 - k * 0.3;
  }, ease.out);
  S.sx = S.sy = S.sz = 1;
  flex.bulge = 0;

  // ---- 4. the swap: a glint runs across the glass; the real one goes pale and in, the reflection goes solid ----
  lab.tween(0.24, (e, k) => {
    glint.position.x = -W / 2 + W * e;
    glint.material.opacity = Math.sin(k * Math.PI);
    edgeMat.color.copy(LIGHT).multiplyScalar(2.2 + 2.5 * Math.sin(k * Math.PI));
  }, ease.inOut);
  await lab.tween(0.18, (e) => {
    S.k = 1 - e;
    G.k = e;
    S.x = touch + 0.12 * e; // drawn into the glass
  }, ease.inOut);
  // (the two swap places: the solid one is Maya now, the pale one inside the glass is the copy)
  mirroring = false;
  const old = { x: S.x, y: S.y, rot: S.rot };
  Object.assign(S, { x: G.x, y: G.y, rot: facing(1), k: 1, trail: false });
  Object.assign(G, { x: old.x, y: old.y, rot: old.rot, k: 0, vis: 1 });
  S.lift = G.lift = 0;
  flex.ring = 0.5;

  // ---- 5. the pane drops back into the board, taking the old Maya with it; the reflection hops out ----
  lab.tween(0.3, (e, k) => {
    pane.position.y = -(H + 0.05) * e;
    G.lift = -(H + 0.05) * e * 0.9;
    G.vis = 1 - k;
    seam.material.opacity = 0.5 * (1 - k);
    flex.ring = 0.5 * (1 - k);
  }, ease.in).then(() => {
    pane.visible = false;
    ghost.visible = false;
  });
  const y0 = S.y;
  await lab.wait(0.04);
  // a sideways hop, north onto the centre of the corner
  await lab.tween(0.26, (e, k) => {
    S.y = y0 + (1 - y0) * e;
    S.lift = Math.sin(k * Math.PI) * 0.16;
    S.sy = 1 + 0.08 * Math.sin(k * Math.PI);
    S.sx = S.sz = 1 - 0.04 * Math.sin(k * Math.PI);
  }, ease.inOut);
  S.y = 1;
  S.lift = 0;
  // landing: squash and a little wobble
  await lab.tween(0.2, (e, k) => {
    const s = Math.sin(Math.min(1, k * 2) * Math.PI) * (k < 0.5 ? 1 : 0);
    S.sy = 1 - 0.15 * s + 0.04 * Math.sin(k * TAU * 1.5) * (1 - k);
    S.sx = S.sz = 1 + 0.07 * s;
  }, ease.linear);
  S.sx = S.sy = S.sz = 1;

  // ---- 6. the double take: a glance back over her shoulder at where the glass was... and front again ----
  await lab.wait(0.08);
  await lab.tween(0.1, (e) => (S.rot = facing(1) + 0.75 * e), ease.out);
  await lab.wait(0.16);
  await lab.tween(0.12, (e, k) => {
    S.rot = facing(1) + 0.75 * (1 - e) + Math.sin(k * Math.PI) * -0.08;
  }, (k) => ease.outBack(k, 2));
  S.rot = facing(1);
  await lab.wait(0.12);

  drive();
  maya.each = null;
  m.body.scale.set(1, 1, 1);
  glassy(m.paint, 1);
  m.paint.transparent = paint0.transparent;
  m.paint.depthWrite = true;
  m.paint.needsUpdate = true;
  maya.release({ x: 3, y: 1, d: 1 });
}
