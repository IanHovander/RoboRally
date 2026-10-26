// Drive, idea 3 (dolphin, rare), animator c: shot like a nature documentary, printed like a strobe photograph.
// Move 2 becomes a dolphin's arc. Maya coils, leaps and slips nose-first into the smoked glass; a strobe leaves
// ghost exposures of her along the arc (Marey's chronophotographs, in her own light). Under the surface she is a
// red glow gliding through the slab while the grid above her wavers like a pool floor. The camera sinks toward
// the waterline as she nears the spot, and the breach plays in slow motion against the dark room, ghosted
// frame by frame; real time snaps back as she lands on (3, 2) facing east, the ripples close, and the other
// three cards play as normal.
export const meta = {
  title: 'Dolphin: strobe breach',
  idea:
    "Once in a long while Move 2 is a dolphin's arc. Maya coils, leaps and slips nose-first into the smoked glass, leaving strobe ghosts of herself along the arc like an old chronophotograph. For two spaces she is only a red glow gliding inside the slab, the grid above her wavering like a pool floor, while the camera sinks toward the waterline. Then she breaches in slow motion against the dark room, ghosted frame by frame, and real time snaps back as she lands on (3, 2) facing east; the ripples close over and the next cards play as normal.",
  notes:
    'Rare (a seeded once-in-a-long-while roll on a Move 2 or Move 3 that ends on open glass). Sound: a soft inhale for the coil, a muffled glass "plip" on entry, a low underwater hum with a slow chime shimmer while she glides, a rising swell into the breach (slow motion stretches it), a bright glass splash on landing. Porting: the ghosts are clones of the body with one additive material; the wavering grid is a small plane with the seam texture whose UVs are displaced per vertex; the camera take is released on landing. Move 3 adds a third space of glide.',
};

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

// one cell of the glass's seams and registration crosses, a little brighter (seen through the water)
function seamTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(200,215,235,.35)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  g.strokeStyle = 'rgba(244,239,228,1)';
  g.lineWidth = 3;
  g.beginPath();
  for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128]]) {
    g.moveTo(x - 12, y);
    g.lineTo(x + 12, y);
    g.moveTo(x, y - 12);
    g.lineTo(x, y + 12);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const end = lab.scenario.after.a;
  const maya = lab.puppet('a');
  const red = new THREE.Color(maya.bot.color);
  const course = lab.arena.course;

  // ---- strobe ghosts: frozen copies of her body in her own light, fading ----
  const ghosts = [];
  const ghost = (gain = 1) => {
    const body = maya.model.body;
    body.updateWorldMatrix(true, false);
    const g = body.clone(true);
    // a strobe exposure: the body faint, its light (the eye) printed bright
    const mat = new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(0.28 * gain), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1e0').multiplyScalar(1.6 * gain), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material === maya.model.eyeMat ? eyeMat : mat;
        o.castShadow = false;
      }
    });
    mat.userData.eye = eyeMat;
    g.matrixAutoUpdate = false;
    g.matrix.copy(body.matrixWorld);
    lab.add(g);
    ghosts.push({ g, mat, t: lab.t });
  };

  // ---- under the glass: her glow and the wavering grid ----
  const glowTex = glowTexture(THREE);
  const glow = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: red.clone().multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.014;
  glow.renderOrder = 4;
  const core = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: red.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.016;
  core.renderOrder = 4;
  // the grid patch: a fine plane whose UVs bend like light through moving water
  const PW = 2.6;
  const PH = 1.8;
  const SEG = 36;
  const patchGeo = new THREE.PlaneGeometry(PW, PH, SEG, SEG);
  patchGeo.rotateX(-Math.PI / 2);
  const nv = patchGeo.attributes.position.count;
  patchGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const patchMat = new THREE.MeshBasicMaterial({ map: seamTexture(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const patch = lab.add(new THREE.Mesh(patchGeo, patchMat));
  patch.position.y = 0.01;
  patch.renderOrder = 3;
  patch.frustumCulled = false;
  const base = patchGeo.attributes.position.array.slice();
  let water = 0; // how strongly the glass behaves like water (0..1)
  let wx = 0; // centre of the disturbance (world)
  let wz = 0;
  let glowK = 0;
  let stretch = 1;
  const tint = new THREE.Color('#f4efe4').lerp(red, 0.35);

  const stopFrame = lab.every(() => {
    const t = lab.t;
    // ghosts fade
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const gh = ghosts[i];
      const k = (t - gh.t) / 0.8;
      gh.mat.opacity = gh.mat.userData.eye.opacity = Math.max(0, 1 - k) ** 1.5;
      if (k >= 1) {
        lab.group.remove(gh.g);
        gh.mat.userData.eye.dispose();
        gh.mat.dispose();
        ghosts.splice(i, 1);
      }
    }
    // the glow under the glass
    glow.position.x = core.position.x = wx;
    glow.position.z = core.position.z = wz;
    glow.scale.set(1.5 * stretch, 1.0, 1);
    core.scale.set(0.7 * stretch, 0.42, 1);
    const shimmer = 0.9 + 0.1 * Math.sin(t * 23);
    glow.material.opacity = glowK * shimmer;
    core.material.opacity = glowK * 0.9;
    // the wavering grid: UVs in world cells, bent by travelling ripples round the disturbance
    patch.position.x = wx;
    patch.position.z = wz;
    const pos = patchGeo.attributes.position.array;
    const uv = patchGeo.attributes.uv.array;
    const col = patchGeo.attributes.color.array;
    for (let i = 0; i < nv; i++) {
      const lx = base[i * 3];
      const lz = base[i * 3 + 2];
      pos[i * 3] = lx;
      pos[i * 3 + 2] = lz;
      const X = wx + lx + course.w / 2;
      const Z = wz + lz + course.h / 2;
      const r = Math.hypot(lx / (PW / 2), lz / (PH / 2));
      const fall = Math.max(0, 1 - r) ** 1.4;
      const d = Math.hypot(lx, lz);
      const amp = 0.07 * water * fall;
      const bend = amp * Math.sin(d * 9 - t * 9) + amp * 0.6 * Math.sin(lx * 6 + t * 5.3);
      uv[i * 2] = X + bend * (lx / (d + 0.2));
      uv[i * 2 + 1] = -(Z + bend * (lz / (d + 0.2)) + amp * 0.5 * Math.cos(lz * 7 - t * 6));
      const k = 0.9 * water * fall;
      col[i * 3] = tint.r * k;
      col[i * 3 + 1] = tint.g * k;
      col[i * 3 + 2] = tint.b * k;
    }
    patchGeo.attributes.uv.needsUpdate = true;
    patchGeo.attributes.color.needsUpdate = true;
  });
  lab.cleanup(() => {
    for (const gh of ghosts) gh.mat.dispose();
  });

  // per frame, after her pose is placed: take any strobe exposure asked for, and keep her card at its height
  // over her while she's under (it says where she is)
  let wantGhost = 0;
  maya.each = () => {
    if (wantGhost) {
      ghost(wantGhost);
      wantGhost = 0;
    }
    const card = maya.bot.card;
    if (card) card.position.y -= Math.min(0, maya.pose.lift);
  };

  // the camera: sinks toward the waterline for the breach
  let low = 0;
  const breachAt = lab.pos(2.75, 2).setY(0.35);
  const camRelease = lab.camera((home) => ({
    target: home.target.clone().lerp(breachAt, 0.75 * low),
    el: home.el - 0.32 * low,
    dist: home.dist * (1 - 0.3 * low),
    fov: home.fov - 2 * low,
  }));

  const P = (x) => lab.pos(x, 2);
  // the strobe fires every so much of her path (so the exposures are evenly spaced, like a real strobe photo)
  let strobeLast = null;
  const strobe = (spacing, gain) => {
    const q = maya.pose;
    const here = new THREE.Vector3(q.x, q.lift, q.y);
    if (!strobeLast || here.distanceTo(strobeLast) >= spacing) {
      wantGhost = gain;
      strobeLast = here;
    }
  };

  // ---- Move 2: the dive ----
  lab.playCard('a', ['m2']);
  await lab.wait(0.06);
  maya.set({ trail: false });
  // coil
  await lab.tween(0.16, (e) => maya.set({ x: 1 - 0.06 * e, pitch: -0.28 * e, sy: 1 - 0.1 * e, sx: 1 + 0.04 * e, sz: 1 + 0.04 * e }), ease.out);
  // leap and tip nose-down into the glass
  strobeLast = null;
  await lab.tween(0.3, (e, k) => {
    const x = 0.94 + (1.72 - 0.94) * k;
    const lift = 0.42 * Math.sin(Math.min(1, k / 0.92) * Math.PI) - (k > 0.92 ? ((k - 0.92) / 0.08) * 0.04 : 0);
    maya.set({ x, lift, pitch: -0.5 + 1.75 * ease.inOut(k), sy: 1.08 - 0.08 * Math.abs(1 - 2 * k), sx: 1, sz: 1 });
    if (k > 0.05) strobe(0.2, 1);
  }, ease.linear);
  // entry: rings and a splash of light; she slips under
  const entry = P(1.82);
  lab.ring(entry.clone().setY(0.02), '#f4efe4', 0.5, 0.02, 0.7);
  lab.ring(entry.clone().setY(0.02), maya.bot.color, 0.9, 0.02, 1.0);
  lab.particles(entry.clone().setY(0.05), ['#f4efe4', maya.bot.color], 14, { speed: 0.9, up: 1.4, gravity: 6, size: 0.04, dur: 0.5 });
  wx = entry.x;
  wz = entry.z;
  lab.tween(0.2, (e) => (water = e), ease.out);
  lab.tween(0.14, (e) => (glowK = e), ease.out);
  await lab.tween(0.1, (e) => maya.set({ x: 1.72 + 0.2 * e, lift: -0.04 - 0.5 * e }), ease.in);
  maya.set({ visible: false });

  // ---- under the glass: a red glow gliding, the grid wavering above her; the camera sinks ----
  lab.tween(0.55, (e) => (low = e), ease.inOut);
  await lab.tween(0.52, (e, k) => {
    const x = 1.92 + (2.5 - 1.92) * e;
    const p = P(x);
    wx = p.x;
    wz = p.z;
    stretch = 1 + 0.25 * Math.sin(k * Math.PI);
    maya.set({ x });
  }, ease.inOut);

  // ---- the breach: slow motion, ghosted frame by frame ----
  const out = P(2.5);
  lab.particles(out.clone().setY(0.05), ['#f4efe4', maya.bot.color], 18, { speed: 0.7, up: 2.2, gravity: 4, size: 0.045, dur: 0.8 });
  lab.ring(out.clone().setY(0.02), '#f4efe4', 0.6, 0.02, 0.8);
  lab.slowmo(0.34, 0.08);
  maya.set({ visible: true });
  strobeLast = null;
  let snapped = false;
  lab.tween(0.3, (e) => (glowK = 1 - e), ease.out);
  await lab.tween(0.42, (e, k) => {
    const x = 2.5 + 0.5 * k;
    // up out of the glass, over the top, down onto the spot
    const arc = k < 0.5 ? -0.3 + 0.95 * Math.sin((k / 0.5) * Math.PI * 0.5) : 0.65 * Math.cos(((k - 0.5) / 0.5) * Math.PI * 0.5);
    maya.set({ x, lift: arc, pitch: -1.15 + 1.6 * k, sy: 1.1, sx: 0.96, sz: 0.96 });
    if (k > 0.12 && k < 0.95) strobe(0.17, 1.3);
    if (k > 0.55 && !snapped) {
      snapped = true;
      lab.slowmo(1, 0.06);
    }
  }, ease.linear);
  // landing on (3, 2): real time, a squash, the ripples close over
  lab.ring(P(3).setY(0.02), maya.bot.color, 0.5, 0.02, 0.5);
  lab.shake(0.015, 0.12);
  lab.tween(0.35, (e) => (water = 1 - e), ease.inOut);
  lab.tween(0.45, (e) => (low = 1 - e), ease.inOut);
  await lab.tween(0.2, (e, k) => {
    const sq = Math.sin(k * Math.PI);
    maya.set({ x: 3, lift: 0, pitch: 0.45 * (1 - e), sy: 1 - 0.16 * sq, sx: 1 + 0.07 * sq, sz: 1 + 0.07 * sq });
  }, ease.out);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, trail: true });

  // ---- the other three cards, as the game plays them ----
  lab.playCard('a', ['rr']);
  await lab.wait(0.05);
  await lab.tween(0.32, (e) => maya.set({ rot: facing(1) + (facing(2) - facing(1)) * e }), ease.inOut);
  await lab.wait(0.04);
  lab.playCard('a', ['bk']);
  await lab.wait(0.05);
  await lab.tween(0.32, (e) => maya.set({ y: 2 - e }), ease.inOut);
  await lab.wait(0.04);
  lab.playCard('a', ['ut']);
  await lab.wait(0.05);
  await lab.tween(0.4, (e) => maya.set({ rot: facing(2) - Math.PI * e }), ease.inOut);
  await lab.wait(0.05);

  stopFrame();
  camRelease();
  maya.each = null;
  maya.release({ x: end.x, y: end.y, d: end.d });
}
