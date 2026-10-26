// Eyes in the dark, staged as a reveal: the camera pulls back and down like the last shot of a film, the
// house goes darker, and the darkness turns out to be full of eyes. Their applause is a wave of blinks
// that swells behind the winner and backlights her; then the eyes close, and one stays to wink.
export const meta = {
  title: 'Eyes in the dark',
  idea:
    'Maya lands on flag 2 and the column flashes red. The camera starts a slow pull-back and the room goes a shade darker; far below, one eye-light opens in the dark behind her. Then two, then four, then dozens: an audience of robots standing on the floor around the slab, each a single eye like a Lumen robot\'s, each throwing a faint ring of light on the floor. Their applause is blinking: a wave of quick triple blinks runs round the room and swells as it passes behind Maya, backlighting her in a halo. The eyes close in a scatter, all but one near the front, which blinks twice; Maya\'s eye blinks back, it closes, and the camera settles home on an empty dark room.',
  notes:
    'Sound: near silence, a soft glassy tick for each eye opening (sparse, then a patter like the first claps), the wave as a rolling shimmer of ticks that swells behind her, then the scatter of closings, and two last ticks for the wink and the one she sends back. Port: the audience is a few dozen sprites and floor rings around the slab, built once; the wave runs round the room by angle and swells at the winner\'s back.',
};

const RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const W = (x, y) => lab.pos(x, y);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const c = A.course;
  const FLOOR = -1.6;
  const TAU = Math.PI * 2;

  // ---------- textures: an eye (a soft bar of light) and a glow ----------
  const eyeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 32;
    const g = cv.getContext('2d');
    g.filter = 'blur(3px)';
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(10, 11, 44, 10, 5);
    g.fill();
    g.filter = 'none';
    g.beginPath();
    g.roundRect(14, 13, 36, 6, 3);
    g.fill();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---------- the audience: eyes on the floor all round the slab ----------
  const tints = ['#ff4d6d', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b', '#f4efe4'];
  const eyes = [];
  const ringGeo = new THREE.RingGeometry(0.27, 0.3, 40);
  const mayaW = W(4, 1);
  const behindMaya = Math.atan2(mayaW.x - 0.0, -4.5 - 0); // the direction of the back wall, behind her
  const add = (x, z, size, kind) => {
    const tint = new THREE.Color(tints[Math.floor(lab.rand() * tints.length)]).lerp(new THREE.Color('#ffffff'), 0.35);
    const h = 0.32 + lab.rand() * 0.22; // eye height: the audience are different forms
    const mat = new THREE.SpriteMaterial({ map: kind === 'dot' ? glowTex : eyeTex, color: new THREE.Color(3.0, 2.9, 2.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const w = kind === 'dot' ? 0.15 : 0.32;
    s.position.set(x, FLOOR + h, z);
    s.scale.set(w * size, (kind === 'dot' ? 0.15 : 0.16) * size, 1);
    lab.add(s);
    const rmat = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, rmat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, FLOOR + 0.004, z);
    ring.scale.setScalar(size);
    lab.add(ring);
    const pmat = new THREE.MeshBasicMaterial({ map: glowTex, color: tint.clone().multiplyScalar(0.35), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pmat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, FLOOR + 0.003, z);
    pool.scale.setScalar(size);
    lab.add(pool);
    const ang = Math.atan2(x, z); // 0 toward the camera, ±π behind the slab
    const e = { s, mat, ring, rmat, pmat, w, hgt: s.scale.y, open: 0, openAt: 99, closeAt: 99, ang, x, z, wave: 99, phase: lab.rand() * TAU, jit: lab.rand() };
    eyes.push(e);
    return e;
  };
  // rows round the slab (a rounded rectangle, a little further out each row), denser behind
  for (let row = 0; row < 3; row++) {
    const out = 0.9 + row * 1.15;
    const hx = c.w / 2 + out;
    const hz = c.h / 2 + out;
    const per = 2 * (hx + hz) * 2;
    const n = Math.round(per / (1.05 + row * 0.15));
    for (let i = 0; i < n; i++) {
      const a = ((i + lab.rand() * 0.6) / n) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // superellipse: a rounded rectangle around the slab
      const r = 1 / Math.pow(Math.pow(Math.abs(ca) / hx, 4) + Math.pow(Math.abs(sa) / hz, 4), 1 / 4);
      const x = ca * r + lab.range(-0.25, 0.25);
      const z = sa * r + lab.range(-0.25, 0.25);
      if (z > c.h / 2 + 2.6) continue; // too close to the camera
      add(x, z, 1 + row * 0.12, lab.rand() < 0.3 ? 'dot' : 'bar');
    }
  }
  // the first eye: straight behind Maya, a little off her shoulder
  let first = eyes[0];
  let best = 1e9;
  for (const e of eyes) {
    const d = Math.hypot(e.x - (mayaW.x + 0.3), e.z - (-c.h / 2 - 2.05));
    if (d < best) {
      best = d;
      first = e;
    }
  }
  // the last eye (the one that winks): front left, close to the camera
  let wink = eyes[0];
  best = 1e9;
  for (const e of eyes) {
    const d = Math.hypot(e.x - -2.6, e.z - (c.h / 2 + 1.0));
    if (d < best) {
      best = d;
      wink = e;
    }
  }

  // ---------- the wave: runs round the room (from the left, behind, to the right) ----------
  // s: how far round the wave has to go to reach an eye; it passes behind Maya about halfway
  const sOf = (ang) => ((-ang + TAU * 2 - 0.9) % TAU);
  const sMaya = sOf(behindMaya);
  const wave = { s: -1, on: false };
  const room = { dim: 0 };
  const backlight = { k: 0 };

  const stopEyes = lab.every((dt, t) => {
    for (const e of eyes) {
      // opening and closing (the lid)
      let open = 0;
      if (t > e.openAt) open = clamp((t - e.openAt) / 0.16);
      if (t > e.closeAt) open = Math.min(open, 1 - clamp((t - e.closeAt) / 0.1));
      // the wave: three quick blinks as it passes, brighter where it swells (behind Maya)
      let lid = 0;
      let boost = 0;
      if (wave.on) {
        const p = (wave.s - sOf(e.ang) + e.jit * 0.2) / 1.7;
        if (p > 0 && p < 1) {
          lid = Math.abs(Math.sin(p * Math.PI * 3)) ** 0.7 * 0.95;
          const near = Math.exp(-(((sOf(e.ang) - sMaya) / 0.5) ** 2));
          boost = Math.sin(p * Math.PI) * (0.6 + 2.4 * near);
        }
      }
      // a lazy idle blink now and then
      const idle = Math.max(0, Math.sin(t * 1.3 + e.phase * 7) - 0.985) * 60;
      const lidOpen = open * (1 - Math.max(lid, clamp(idle)));
      e.s.scale.y = e.hgt * Math.max(0.02, lidOpen);
      e.mat.opacity = open > 0 ? 1 : 0;
      e.mat.color.setRGB(3.0, 2.9, 2.7).multiplyScalar(0.75 + boost);
      e.rmat.opacity = 0.32 * open * (1 + boost * 0.6);
      e.pmat.opacity = 0.5 * open * (1 + boost);
    }
  });

  // the room goes a shade darker (undone at the end)
  const motes0 = A.motes.material.opacity;
  const spill0 = A.spill.material.opacity ?? 1;
  const stopRoom = lab.every(() => {
    A.motes.material.opacity = motes0 * (1 - 0.8 * room.dim);
    A.spill.material.opacity = spill0 * (1 - 0.7 * room.dim);
  });
  lab.cleanup(() => {
    A.motes.material.opacity = motes0;
    A.spill.material.opacity = spill0;
  });

  // Maya's backlight: a halo of the audience's light behind her, and the rim of it on her
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#fff1dc').multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.4, 2.4, 1);
  lab.add(halo);
  const eyeBlink = { k: 0 };
  maya.each = (m) => {
    const p = maya.group.position;
    halo.position.set(p.x, 0.35, p.z - 0.55);
    halo.material.opacity = 0.55 * backlight.k;
    m.paint.emissiveIntensity = 0.16 + 0.5 * backlight.k;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar((1 + 0.5 * backlight.k) * (1 - 0.9 * eyeBlink.k));
    m.body.traverse((o) => {
      if (o.isMesh && o.material === m.eyeMat) o.scale.y = 1 - 0.85 * eyeBlink.k;
    });
  };

  // ---------- the camera: the pull-back reveal ----------
  const cam = { back: 0, push: 0 };
  const releaseCam = lab.camera((home) => {
    const b = cam.back;
    const target = home.target.clone().add(new THREE.Vector3(0.25 * b, -0.55 * b, -0.35 * b)).lerp(mayaW.clone().setY(0.1), 0.35 * cam.push);
    return {
      target,
      el: home.el - 0.3 * b + 0.04 * cam.push,
      dist: home.dist * (1 + 0.55 * b - 0.3 * cam.push),
      az: 0.06 * b,
    };
  });

  // ---------- 1. Move 2 onto flag 2 ----------
  lab.playCard('a', ['m2']);
  await lab.wait(0.12);
  await lab.tween(0.66, (e) => maya.set({ x: 2 + 2 * e }), ease.inOut);
  A.clearCards();
  const col2 = A.columns.find((cc) => cc.n === 2);
  if (col2) {
    col2.flash = A.time;
    col2.flashColor = new THREE.Color(RED);
  }
  lab.ring(W(4, 1), RED, 2.4, 0.02, 1.2);
  A.emit('checkpoint', { id: 'a', n: 2 });
  A.emit('win', { id: 'a' });

  // ---------- 2. the pull-back; one eye opens, then two, then four, then dozens ----------
  lab.tween(1.6, (e) => {
    cam.back = e;
    room.dim = e;
    A.dim = A.dimCur = 0.45 * e;
  }, ease.inOut);
  await lab.wait(0.35);
  const T0 = A.time;
  first.openAt = T0;
  const rest = eyes.filter((e) => e !== first);
  // order: spreading out from behind Maya, with some randomness
  rest.sort((a, b) => Math.abs(sOf(a.ang) - sMaya) + a.jit * 1.4 - (Math.abs(sOf(b.ang) - sMaya) + b.jit * 1.4));
  rest.forEach((e, i) => (e.openAt = T0 + 0.45 + 0.85 * Math.pow(i / rest.length, 0.55)));
  await lab.wait(1.35);

  // ---------- 3. the applause: a wave of blinks round the room, swelling behind her ----------
  wave.on = true;
  lab.tween(1.5, (e) => (cam.push = Math.sin(e * Math.PI) * 0.7), ease.inOut);
  await lab.tween(1.5, (e) => {
    wave.s = -0.6 + 5.6 * e;
    backlight.k = Math.exp(-(((wave.s - sMaya) / 0.75) ** 2));
  }, ease.inOut);
  wave.on = false;
  backlight.k = 0;

  // ---------- 4. the eyes close in a scatter; one stays and winks ----------
  const t1 = A.time;
  for (const e of eyes) if (e !== wink) e.closeAt = t1 + lab.rand() * 0.38;
  lab.tween(1.3, (e) => {
    cam.back = 1 - e;
    room.dim = 1 - e;
    A.dim = A.dimCur = 0.45 * (1 - e);
  }, ease.inOut);
  await lab.wait(0.5);
  // the last eye blinks twice at her...
  const blinkEye = (e, dur) => lab.tween(dur, (q, k) => (e.hgtK = 1 - Math.sin(k * Math.PI)), ease.linear);
  const h0 = wink.hgt;
  const stopWink = lab.every(() => (wink.s.scale.y = h0 * Math.max(0.02, wink.hgtK ?? 1)));
  await blinkEye(wink, 0.14);
  await blinkEye(wink, 0.14);
  // ...she blinks back
  await lab.wait(0.08);
  await lab.tween(0.18, (q, k) => (eyeBlink.k = Math.sin(k * Math.PI)), ease.linear);
  eyeBlink.k = 0;
  await lab.wait(0.1);
  wink.closeAt = A.time;
  wink.hgtK = 1;
  await lab.wait(0.3);
  stopWink();
  stopEyes();
  stopRoom();
  for (const e of eyes) e.s.visible = e.ring.visible = false;
  A.dim = A.dimCur = 0;
  halo.visible = false;
  releaseCam();
  maya.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
}
