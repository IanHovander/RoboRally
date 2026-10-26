// Evel Knievel, staged as a stunt photograph: the camera drops low for the jump, the apex freezes with a
// photographer's flash and leaves a chronophotograph of ghosts in the air; then the floor cheats.
export const meta = {
  title: 'Stunt photo',
  idea:
    'A ramp of light flicks up at the rim; the camera drops to a low stunt angle and Maya launches. At the top of the arc the picture freezes with a photographer\'s flash, and her jump is printed in the air as a strobe of faint red ghosts and a streak of eye-light: a long exposure of a perfect leap. She lands on (5,1), ring flaring. A beat. Then a crash zoom as the black square slides one space east under her, and she drops straight through. The hole slides home, its rim gives one innocent glint, the photograph fades and the camera floats back up.',
  notes:
    'Sound: a rising glass whistle up the ramp, a soft camera "click" and a held shimmer on the freeze, a bright chime on landing; the hole slides with a dry glass scrape and she drops without a sound; a tiny "ting" for the glint. Porting: the ghosts are clones of the body with one additive material; the moving hole is a black plane over a glass patch (a topMat clone with UVs from a plain cell) that covers the real hole until it is home. Name tags fade while the camera is close.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const RED = new THREE.Color('#ff4d6d');
  const LIGHT = new THREE.Color(lab.PALETTE.light);
  const arena = lab.arena;
  const W = (x, y, h = 0) => lab.pos(x, y).setY(h);
  const glow = glowTex(THREE);

  // ---------- camera: a small rig we tween between framings ----------
  const ch = arena.camHome;
  const HOME = { el: ch.elev, d: 1, tx: ch.target.x, ty: ch.target.y, tz: ch.target.z, az: 0 };
  const cam = { ...HOME };
  const camTo = (dur, to, ez = ease.inOut) => {
    const from = { ...cam };
    return lab.tween(dur, (e) => {
      for (const k of Object.keys(to)) cam[k] = from[k] + (to[k] - from[k]) * e;
    }, ez);
  };
  const releaseCam = lab.camera((home) => ({ target: new THREE.Vector3(cam.tx, cam.ty, cam.tz), el: cam.el, dist: home.dist * cam.d, az: cam.az }));
  // name tags are sized for the wide view: fade them while the camera is close
  let tagsOn = 1;
  const stopTags = lab.every(() => {
    for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity = tagsOn;
  });

  // ---------- the hole that can move: a glass patch over the real pit, and a black square ----------
  const top = arena.topMat;
  const patchMat = top.clone();
  const patchGeo = new THREE.PlaneGeometry(1, 1);
  {
    const cw = arena.course.w;
    const chh = arena.course.h;
    const uv = patchGeo.attributes.uv;
    const u0 = 4 / cw; // borrow plain glass from cell (4,2), just south of the pit
    const v0 = 1 - 3 / chh;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / cw, v0 + uv.getY(i) / chh);
  }
  const patch = new THREE.Mesh(patchGeo, patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.copy(W(4, 1, 0));
  patch.receiveShadow = true;
  patch.visible = false;
  lab.add(patch);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: holeTex(THREE), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(W(4, 1, 0.002));
  hole.visible = false;
  lab.add(hole);
  const stopPatch = lab.every(() => {
    patchMat.emissiveIntensity = top.emissiveIntensity;
  });

  // ---------- the ramp of light at the near rim ----------
  const RAMP_LEN = 0.56;
  const RAMP_ANG = 0.42;
  const rampPivot = new THREE.Group();
  rampPivot.position.copy(W(2.93, 1, 0.012));
  const rampMat = new THREE.MeshBasicMaterial({ map: rampTex(THREE), color: LIGHT.clone().multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(RAMP_LEN, 0.7), rampMat);
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.x = RAMP_LEN / 2;
  rampPivot.add(ramp);
  const lipMat = new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.72), lipMat);
  lip.position.x = RAMP_LEN;
  rampPivot.add(lip);
  lab.add(rampPivot);
  let rampAng = 0;
  let rampOn = 0;
  const stopRamp = lab.every(() => {
    rampPivot.rotation.z = rampAng;
    rampMat.opacity = rampOn * 0.8;
    lipMat.opacity = rampOn;
  });

  // ---------- the photograph: a strobe of her lights in the air, and the streak of her eye ----------
  const add = (o) => ({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, ...o });
  const ghostMat = new THREE.MeshBasicMaterial(add({ color: RED.clone().multiplyScalar(0.5) }));
  const ghostRing = new THREE.MeshBasicMaterial(add({ color: RED.clone().multiplyScalar(2.2), side: THREE.DoubleSide }));
  const ghostEye = new THREE.MeshBasicMaterial(add({ color: LIGHT.clone().multiplyScalar(2.2) }));
  const streakMat = new THREE.SpriteMaterial(add({ map: glow, color: LIGHT.clone().multiplyScalar(1.4) }));
  const photo = new THREE.Group();
  lab.add(photo);
  let photoOn = 0; // the strobe ghosts: printed by the flash, faded after the landing
  let streakOn = 0; // the eye's light painting: drawn as she flies
  let photoFlash = 0; // the flash makes the exposure burn bright
  const addGhost = (p) => {
    const g = new THREE.Group();
    g.position.copy(p.group.position);
    g.quaternion.copy(p.group.quaternion);
    g.scale.copy(p.group.scale);
    for (const child of p.group.children) {
      if (child === p.model.body) {
        const body = child.clone(true);
        body.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = false;
          o.material = o.material === p.model.eyeMat ? ghostEye : ghostMat;
        });
        g.add(body);
      } else if (child.isMesh && child.material === p.model.ringMat) {
        const r = child.clone();
        r.material = ghostRing;
        g.add(r);
      }
    }
    photo.add(g);
  };
  let lastEye = null;
  const eyeAt = new THREE.Vector3();
  const addStreak = (p) => {
    p.model.body.localToWorld(eyeAt.set(0, 0.252, -0.13));
    const from = lastEye ?? eyeAt.clone();
    const n = Math.max(1, Math.ceil(from.distanceTo(eyeAt) / 0.035));
    for (let i = 1; i <= n; i++) {
      const s = new THREE.Sprite(streakMat);
      s.position.lerpVectors(from, eyeAt, i / n);
      s.scale.setScalar(0.07);
      photo.add(s);
    }
    lastEye = eyeAt.clone();
  };
  const stopPhoto = lab.every(() => {
    ghostMat.opacity = Math.min(1, 0.1 * photoOn * (1 + 2.5 * photoFlash));
    ghostRing.opacity = Math.min(1, 0.6 * photoOn * (1 + photoFlash));
    ghostEye.opacity = Math.min(1, 0.7 * photoOn * (1 + photoFlash));
    streakMat.opacity = Math.min(1, 0.5 * streakOn * (1 + photoFlash));
  });

  // ---------- an overlay flash that runs on real time (the freeze stops scene time) ----------
  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 55% 38%,#fffaf0 0%,#fff1dc 40%,#f2dcc4 100%);opacity:0;pointer-events:none';
  lab.overlay.append(flashEl);
  const onReal = (dur, fn) => {
    const t0 = lab.real;
    const stop = lab.every(() => {
      const k = Math.min(1, (lab.real - t0) / dur);
      fn(k);
      if (k >= 1) stop();
    });
  };

  // ---------- Maya ----------
  const maya = lab.puppet('a');
  const ROT = facing(1);
  let eyeBoost = 1;
  let poolBoost = 1;
  let cardFade = 1;
  let flying = false;
  const GHOST_AT = [0.1, 0.27, 0.44, 0.63, 0.81];
  let s = 0;
  let nextGhost = 0;
  maya.each = (m) => {
    m.eyeMat.color.multiplyScalar(eyeBoost);
    m.poolMat.opacity = Math.min(1, m.poolMat.opacity * poolBoost);
    m.ringMat.opacity = Math.min(1, m.ringMat.opacity * Math.min(1.6, poolBoost));
    const card = maya.bot.card;
    if (card) card.material.opacity *= cardFade;
    if (flying) {
      addStreak(maya);
      while (nextGhost < GHOST_AT.length && s >= GHOST_AT[nextGhost]) {
        addGhost(maya);
        nextGhost++;
      }
    }
  };
  maya.set({ rot: ROT });
  lab.playCard('a', ['m3']);

  // anticipation: a little lean back, like gunning the engine
  await lab.tween(0.14, (e) => maya.set({ x: 1 - 0.07 * e, pitch: -0.16 * e }), ease.out);

  // the ramp flicks up out of the glass while she accelerates; the camera drops to the stunt angle
  lab.at(0.1, () => {
    rampOn = 1;
    lab.tween(0.18, (e) => (rampAng = RAMP_ANG * e), ease.outBack);
    lab.ring(W(3.2, 1), lab.PALETTE.light, 0.35, 0.02, 0.5);
  });
  const JUMP_VIEW = { el: 0.4, d: 0.52, tx: W(4.0, 1).x, ty: 0.5, tz: W(4.0, 1).z };
  camTo(0.6, JUMP_VIEW, ease.inOut);
  lab.tween(0.5, (e) => (tagsOn = 1 - e), ease.linear);
  await lab.tween(0.46, (e) => maya.set({ x: 0.93 + (2.95 - 0.93) * e, pitch: -0.16 + 0.22 * e }), ease.in);

  // up the ramp (fast)
  const rampLift = (x) => Math.max(0, (x - 2.93) * Math.tan(RAMP_ANG)) + 0.01;
  await lab.tween(0.1, (e) => {
    const x = 2.95 + (3.47 - 2.95) * e;
    maya.set({ x, lift: rampLift(x), pitch: -RAMP_ANG * Math.min(1, e * 2.5), trail: e < 0.3 });
  }, ease.linear);
  maya.set({ trail: false });

  // the arc: ballistic, slowing into the top
  const X0 = 3.47;
  const H0 = rampLift(X0);
  const X1 = 5;
  const APEX = 0.5;
  const arcAt = (q) => {
    const lift = H0 * (1 - q) + 4 * APEX * q * (1 - q);
    const slope = (-H0 + 4 * APEX * (1 - 2 * q)) / (X1 - X0);
    return { x: X0 + (X1 - X0) * q, lift, pitch: -Math.atan(slope) * 0.75 };
  };
  const flyTo = (s0, s1, dur) =>
    lab.tween(dur, (e) => {
      s = s0 + (s1 - s0) * e;
      maya.set(arcAt(s));
    }, ease.linear);
  flying = true;
  streakOn = 1;
  lab.tween(0.2, (e) => (cardFade = 1 - e), ease.out);
  lab.slowmo(0.4, 0.16);
  await flyTo(0, 0.47, 0.19);

  // the freeze: a photographer's flash; the exposure burns in; she hangs there
  lab.slowmo(0.03, 0.05);
  onReal(0.3, (k) => (flashEl.style.opacity = String(k >= 1 ? 0 : 0.5 * (1 - k) ** 2)));
  onReal(0.5, (k) => {
    photoFlash = 1 - k;
    eyeBoost = 1 + 1.4 * (1 - k);
  });
  photoOn = 1;
  await lab.waitReal(0.24);
  lab.slowmo(1, 0.16);
  await flyTo(0.47, 1, 0.24);
  flying = false;

  // landing: squash, ring flare, a bright chime of light
  lab.ring(W(5, 1), '#ff4d6d', 0.85, 0.03, 0.8);
  lab.ring(W(5, 1), lab.PALETTE.light, 0.55, 0.035, 0.5);
  lab.shake(0.03, 0.2);
  poolBoost = 2.2;
  lab.tween(0.6, (e) => (poolBoost = 2.2 - 1.2 * e), ease.out);
  camTo(0.4, { el: 0.62, d: 0.5, tx: W(4.5, 1).x, ty: 0.14, tz: W(4.5, 1).z }, ease.out);
  await lab.tween(0.08, (e) => maya.set({ x: 5, lift: 0, pitch: 0.2 * (1 - e), sy: 1 - 0.28 * e, sx: 1 + 0.18 * e, sz: 1 + 0.12 * e }), ease.out);
  // triumph: spring up, a proud little bob (the beat)
  await lab.tween(0.3, (e, k) => {
    const sp = ease.outElastic(k);
    maya.set({ sy: 0.72 + 0.28 * sp, sx: 1.18 - 0.18 * sp, sz: 1.12 - 0.12 * sp, pitch: -0.12 * Math.sin(k * Math.PI) });
  }, ease.linear);
  lab.tween(0.35, (e) => {
    photoOn = 1 - e;
    streakOn = 1 - 0.5 * e;
  }, ease.inOut);
  await lab.wait(0.06);

  // the rug pull: crash zoom, the black square slides one space east under her
  patch.visible = true;
  hole.visible = true;
  camTo(0.09, { d: 0.38, el: 0.7, tx: W(4.7, 1).x, ty: 0.1, tz: W(4.7, 1).z }, ease.out);
  await lab.tween(0.24, (e) => hole.position.copy(W(4 + e, 1, 0.002)), ease.inOut3);
  // the hang: she notices (looks down, eye flickers)
  await lab.tween(0.13, (e) => {
    maya.set({ pitch: 0.28 * e });
    eyeBoost = e > 0.5 ? 0.35 : 1.6;
  }, ease.out);
  eyeBoost = 1;
  // straight through
  camTo(0.7, { ...HOME }, ease.inOut);
  lab.at(0.3, () => lab.tween(0.5, (e) => (tagsOn = e), ease.in));
  await lab.tween(0.15, (e) => maya.set({ lift: -0.45 * e, sy: 1 + 0.2 * e, sx: 1 - 0.1 * e, sz: 1 - 0.1 * e, pitch: 0.28 - 0.26 * e }), ease.in);
  lab.tween(0.1, (e) => maya.set({ lift: -0.45 - 0.7 * e }), ease.in).then(() => maya.set({ visible: false }));

  // the hole slides home, innocently; the ramp sinks; the photograph fades; the camera floats back
  lab.tween(0.3, (e) => {
    rampAng = RAMP_ANG * (1 - e);
    rampOn = 1 - e;
  }, ease.in);
  lab.tween(0.4, (e) => (streakOn = 0.5 * (1 - e)), ease.in);
  await lab.tween(0.3, (e) => hole.position.copy(W(5 - e, 1, 0.002)), ease.inOut);
  patch.visible = false;
  hole.visible = false;
  // the innocent glint on the rim
  glint(lab, W(4.47, 0.53, 0.03));
  await lab.wait(0.3);
  stopPatch();
  stopRamp();
  stopPhoto();
  stopTags();
  releaseCam();
  maya.release({ on: false });
}

function glint(lab, at) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,.5)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath();
  g.moveTo(64, 2); g.lineTo(67, 61); g.lineTo(126, 64); g.lineTo(67, 67); g.lineTo(64, 126); g.lineTo(61, 67); g.lineTo(2, 64); g.lineTo(61, 61); g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(lab.PALETTE.light).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.position.copy(at);
  lab.add(s);
  lab.tween(0.42, (e, k) => {
    const a = Math.sin(k * Math.PI);
    s.scale.setScalar(0.05 + 0.75 * a);
    s.material.rotation = k * 0.8;
    mat.opacity = a;
  }, lab.ease.linear);
}

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function holeTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 64);
  // the far wall of the hole catches a little light, like the real pit
  const grad = g.createLinearGradient(0, 3, 0, 18);
  grad.addColorStop(0, 'rgba(70,82,100,.9)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(3, 3, 58, 15);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rampTex(THREE) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  // along x: nothing at the hinge, bright toward the lip; soft edges across
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,255,255,.22)');
  grad.addColorStop(1, 'rgba(255,255,255,.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, 0, 64);
  side.addColorStop(0, 'rgba(0,0,0,.6)');
  side.addColorStop(0.15, 'rgba(0,0,0,1)');
  side.addColorStop(0.85, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = side;
  g.fillRect(0, 0, 128, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
