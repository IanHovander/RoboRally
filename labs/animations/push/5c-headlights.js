// Theo-Cam, staged like a car commercial gone wrong: the camera swoops down to the glass beside Theo, Maya's eye
// comes at it like headlights on a wet road (its reflection streaking across the glass toward us), the light
// blows out the lens at the hit, the camera itself is shoved a space east with Theo, and it cranes back up home.
export const meta = {
  title: 'Headlights',
  idea:
    "On a rare push the camera swoops down from its high view to glass level just beside Theo, looking back west along the row. Theo trembles in the corner of the frame. Maya's eye is a pair of oncoming headlights: a long horizontal flare across the picture, and its reflection streaking over the smoked glass toward us like headlights on a wet road, her trail of light pouring out behind her. At contact the light blows out the lens for a frame, and the camera is shoved a space east along with Theo: the whole picture lurches and tilts. Then it cranes back up to the game's framing as everyone settles.",
  notes:
    "Rare on purpose (about one push in ten, or the first push of a game), so the room never knows which push will dive. Dive 0.5 s, charge 0.35 s, shove 0.4 s, home about 1 s. The low camera is placed from the pushed robot's position and the push direction, so it works for any row and any direction; the name tags fade out while the camera is low. Sound: the room tone drops as the camera dives, a rising glass whine as the headlights come, a dull thud and a lurch, then an airy swoop back up.",
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const P = (x, y) => lab.pos(x, y);
  const warm = new THREE.Color(lab.PALETTE.light);

  // ---- textures: an anamorphic streak and a soft glow, both drawn on canvas ----
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const streakTex = canvasTex(256, 32, (g, w, h) => {
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)');
    gx.addColorStop(0.5, 'rgba(255,255,255,1)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx;
    g.fillRect(0, h / 2 - 1.5, w, 3);
    g.globalAlpha = 0.35;
    g.fillRect(0, h / 2 - 5, w, 10);
  });
  const glowTex = canvasTex(64, 64, (g) => {
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.3, 'rgba(255,255,255,.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
  });
  const reflTex = canvasTex(32, 128, (g, w, h) => {
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(255,255,255,1)');
    gy.addColorStop(0.25, 'rgba(255,255,255,.45)');
    gy.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gy;
    const gx = g.createLinearGradient(0, 0, w, 0);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    gx.addColorStop(0, 'rgba(0,0,0,0)');
    gx.addColorStop(0.5, 'rgba(0,0,0,1)');
    gx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
  });
  const sprite = (map, color) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    lab.add(s);
    return s;
  };
  const flare = sprite(streakTex, warm.clone().multiplyScalar(2.2));
  const halo = sprite(glowTex, warm.clone().multiplyScalar(1.6));
  // the reflection on the glass: a strip from under Maya toward the camera
  const reflMat = new THREE.MeshBasicMaterial({ map: reflTex, color: warm.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), reflMat);
  refl.renderOrder = 4;
  lab.add(refl);
  const eyeMesh = (() => {
    let found = null;
    maya.model.body.traverse((o) => {
      if (o.isMesh && o.material === maya.model.eyeMat) found = o;
    });
    return found;
  })();

  // ---- the camera: home <-> low beside Theo, plus the shove ----
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const C = { low: 0, shove: 0, roll: 0, bump: 0 };
  // a camera strapped to Theo's south side, low on the glass, looking back west along the row at Maya
  const lowCam = (() => {
    const eye = P(3.62, 2.72).setY(0.3);
    const look = P(1.3, 2.0).setY(0.2);
    const d = eye.clone().sub(look);
    const dist = d.length();
    return { target: look, az: Math.atan2(d.x, d.z), el: Math.asin(d.y / dist), dist, fov: 40 };
  })();
  const lerp = (a, b, k) => a + (b - a) * k;
  const releaseCam = lab.camera((home) => {
    const kk = Math.min(0.99, Math.min(arena.dt, 0.1) * 4);
    const w = 1 - Math.min(1, C.low * 1.5);
    if (arena.camCur) {
      arena.camCur.sx = (off0.sx * w) / (1 - kk);
      arena.camCur.sy = (off0.sy * w) / (1 - kk);
    }
    const k = C.low;
    const lt = lowCam.target.clone();
    lt.x += C.shove;
    lt.y += C.bump;
    // swoop: dist and elevation lead, the swing round trails a little
    const kd = ease.inOut(Math.min(1, k * 1.15));
    return {
      target: home.target.clone().lerp(lt, k),
      az: lerp(0, lowCam.az, ease.inOut(k)),
      el: lerp(home.el, lowCam.el, kd),
      dist: lerp(home.dist, lowCam.dist, kd),
      fov: lerp(home.fov, lowCam.fov, k),
      roll: C.roll,
    };
  });

  // ---- headlights: the flare, the halo and the reflection follow Maya's eye ----
  const eyeAt = new THREE.Vector3();
  const L = { on: 0 };
  const stopLights = lab.every(() => {
    eyeMesh.getWorldPosition(eyeAt);
    const cam = arena.camera.position;
    const d = eyeAt.distanceTo(cam);
    const near = Math.min(1.6, 2.2 / Math.max(0.6, d)); // closer = brighter and wider
    const k = L.on * C.low;
    flare.position.copy(eyeAt);
    flare.scale.set(2.6 * near, 0.18 * near, 1);
    flare.material.opacity = k * Math.min(1, near);
    halo.position.copy(eyeAt);
    halo.scale.setScalar(0.5 * near);
    halo.material.opacity = k;
    // reflection: a streak on the glass from under her eye toward the camera
    const base = new THREE.Vector3(eyeAt.x, 0.011, eyeAt.z);
    const toCam = new THREE.Vector3(cam.x - base.x, 0, cam.z - base.z);
    const len = Math.max(0.01, toCam.length() * 0.85);
    refl.position.copy(base);
    refl.rotation.set(0, Math.atan2(toCam.x, toCam.z), 0);
    refl.scale.set(0.16 * (0.7 + 0.3 * near), 1, len);
    reflMat.opacity = k * 0.55 * near;
  });
  // the name tags step out of the way while the camera is low
  const tags = ['a', 'b', 'c'].map((id) => lab.bot(id).tag).filter(Boolean);
  const stopTags = lab.every(() => {
    for (const t of tags) t.material.opacity = 1 - Math.min(1, C.low * 2);
  });
  // Theo's nerves (in the corner of the frame) and Maya's revving eye
  const T = { tremble: 0, brace: 0 };
  theo.each = (m) => {
    theo.set({ roll: Math.sin(lab.t * 61) * 0.035 * T.tremble, sy: 1 - 0.08 * T.brace, sx: 1 + 0.05 * T.brace });
    const k = 1 - 0.7 * Math.min(1, C.low * 1.4); // his ridge light is right by the lens: keep it from blowing out
    m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
  };
  maya.each = (m) => {
    const k = 1 + 1.2 * L.on;
    m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
  };

  lab.playCard('a', ['m2']);
  // ---- 1. the dive (0.5 s); Maya revs: leans back, her eye brightening ----
  lab.tween(0.5, (e) => (L.on = e), ease.in);
  lab.tween(0.5, (e) => maya.set({ x: 1 - 0.08 * Math.sin(e * Math.PI * 0.5), pitch: -0.18 * e }), ease.inOut);
  lab.tween(0.5, (e) => (T.tremble = e), ease.in);
  await lab.tween(0.5, (e) => (C.low = e), ease.inOut);

  // ---- 2. the charge: headlights coming straight at us ----
  T.brace = 1;
  await lab.tween(0.36, (e, k) => maya.set({ x: 0.92 + (2.22 - 0.92) * e, pitch: -0.18 + 0.32 * k }), ease.in3);

  // ---- 3. contact: the lens blows out, the camera is shoved east with Theo ----
  lab.flash('rgba(255,246,228,1)', 0.14, 0.4);
  T.tremble = 0;
  T.brace = 0;
  lab.tween(0.4, (e, k) => {
    C.shove = 1 * ease.outBack(k, 1.4);
    C.roll = 0.11 * Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k * 0.4) + -0.03 * Math.sin(k * Math.PI * 3) * k;
    C.bump = 0.06 * Math.sin(k * Math.PI) * (1 - k);
  }, ease.linear);
  lab.tween(0.25, (e) => (L.on = 1 - 0.8 * e), ease.out);
  await lab.tween(
    0.4,
    (e, k) => {
      maya.set({ x: 2.22 + 0.78 * e, pitch: 0.14 * (1 - k) });
      theo.set({ x: 3 + e, sx: 1.12 - 0.12 * k, sy: 0.88 + 0.12 * ease.outElastic(k), roll: Math.sin(k * 13) * 0.07 * (1 - k) });
    },
    ease.out,
  );
  T.tremble = 0;
  theo.set({ sx: 1, sy: 1, roll: 0 });
  C.roll = 0;

  // ---- 4. crane back up to the game's framing ----
  await lab.tween(1.0, (e) => ((C.low = 1 - e), (L.on = 0.2 * (1 - e))), ease.inOut);
  stopLights();
  stopTags();
  theo.each = null;
  for (const t of tags) t.material.opacity = 1;
  releaseCam();
  maya.each = null;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
