// The laser pointer, staged like a sitcom: a slow suspense push-in on the cat, a freeze frame at the worst
// possible moment, and a ghost of that moment left hanging in the air while Jun slides home.
export const meta = {
  title: 'The laser pointer (freeze frame)',
  idea: 'Theo\'s beam lands as a jittery dot on the glass beside Maya. Jun\'s eye narrows and locks on; the camera creeps in like a nature documentary while he crouches and wiggles. He pounces, and at that very instant the dot hops up onto Maya: the hit. The picture freezes with Jun hanging mid-air (a shutter click, the room dims around him, the camera snaps in, his eye blinks once in the frozen world). When time starts again he drops, slides back to his space facing north as if nothing happened, and his frozen pounce stays in the air as a fading ghost of light.',
  notes: 'Sound: a tiny high whine for the pointer, soft ticks as the dot darts, a rising purr-chime on the wiggle, a "zip" on the pounce, then a record-scratch-ish glass squeak and dead silence for the freeze; one small "ting" for the blink; a quiet whoosh as he slides back. Needs a bystander within two spaces of the target, so it is an occasional treat. The ghost is the cat\'s model drawn once more in additive light, so no extra assets.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const BLUE = new THREE.Color('#4dabf7');

  // ----- the pointer: a thin line from Theo's muzzle to a dot on the glass -----
  theo.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const lineGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0);
  const add = (o) => lab.add(o);
  const lineCore = add(new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.2, 3.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const lineGlow = add(new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(1.6), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // the dot: a hot point plus a soft pool of light on the glass
  const dot = add(new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.5, 6.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const pool = add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: glowTex, color: BLUE.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  pool.rotation.x = -Math.PI / 2;
  const up = new THREE.Vector3(0, 1, 0);
  let lineOn = 0;
  const setLine = (to, grow = 1) => {
    const end = muzzle.clone().lerp(to, grow);
    const dir = end.clone().sub(muzzle);
    const len = Math.max(0.001, dir.length());
    for (const [m, r] of [[lineCore, 0.006], [lineGlow, 0.02]]) {
      m.position.copy(muzzle);
      m.quaternion.setFromUnitVectors(up, dir.normalize());
      m.scale.set(r, len, r);
      m.visible = lineOn > 0;
    }
    lineCore.material.opacity = lineOn;
    lineGlow.material.opacity = 0.4 * lineOn;
    dot.position.copy(end);
    dot.visible = grow >= 1 && lineOn > 0;
    pool.position.set(end.x, 0.012, end.z);
    pool.visible = dot.visible && end.y < 0.08;
    pool.material.opacity = lineOn;
  };

  // where the dot wanders: on the glass just beside Maya, toward Jun; a shaky hand, with a couple of darts
  const base = lab.pos(1.62, 1.58);
  const darts = [
    { t: 0.26, to: new THREE.Vector3(0.24, 0, -0.14) },
    { t: 0.5, to: new THREE.Vector3(-0.12, 0, 0.18) },
    { t: 0.74, to: new THREE.Vector3(0.08, 0, 0.02) },
  ];
  const dotAt = (t) => {
    const p = base.clone();
    let off = new THREE.Vector3();
    for (const d of darts) if (t > d.t) off.lerp(d.to, Math.min(1, (t - d.t) / 0.05));
    p.add(off);
    p.x += Math.sin(t * 9.1) * 0.05 + Math.sin(t * 23.7) * 0.02 + Math.sin(t * 41) * 0.01;
    p.z += Math.sin(t * 7.3 + 1) * 0.05 + Math.sin(t * 19.3) * 0.02 + Math.sin(t * 37) * 0.01;
    p.y = 0.012;
    return p;
  };

  // ----- Jun, the cat -----
  const J = { x: 3, y: 3, rot: facing(0), lift: 0, sx: 1, sy: 1, pitch: 0, roll: 0 };
  const visor = [];
  jun.model.body.traverse((o) => o.isMesh && o.material === jun.model.eyeMat && visor.push([o, o.scale.y]));
  const eye = { lock: 0, blink: 0 };
  jun.set({ trail: false });
  jun.each = (m) => {
    const b = 1 + eye.lock * 1.4;
    const shut = eye.blink;
    m.eyeMat.color.setRGB(3.2 * b * (1 - shut * 0.9), 3.1 * b * (1 - shut * 0.9), 2.6 * b * (1 - shut * 0.9));
    for (const [o, s] of visor) o.scale.y = s * (1 - 0.55 * eye.lock) * (1 - 0.85 * shut);
    // airborne, his ring and glow stay down on the glass, dimmer and wider the higher he is: that is what reads as height
    const air = Math.min(1, J.lift / 0.12);
    m.ringMat.opacity *= 1 - air;
    m.poolMat.opacity *= 1 - air;
    const at = lab.pos(J.x, J.y);
    floor.position.set(at.x, 0.013, at.z);
    floor.scale.setScalar(0.95 + 1.2 * J.lift);
    floor.material.opacity = air * (0.75 - 0.6 * J.lift);
    floor.visible = air > 0.001;
  };
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#ffd43b').multiplyScalar(1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  floor.rotation.x = -Math.PI / 2;
  floor.visible = false;
  const poseJun = () => jun.set({ x: J.x, y: J.y, rot: J.rot, lift: J.lift, sx: J.sx, sz: J.sx, sy: J.sy, pitch: J.pitch, roll: J.roll });
  const aimAt = (p) => {
    const at = lab.pos(J.x, J.y);
    return Math.atan2(-(p.x - at.x), -(p.z - at.z));
  };

  // ----- camera: a creeping documentary push-in, then a snap on the freeze -----
  const cam = { push: 0, snap: 0, roll: 0 };
  const junAt = lab.pos(2.4, 2.4).setY(0.25);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(junAt, 0.35 * cam.push + 0.3 * cam.snap),
    dist: home.dist * (1 - 0.12 * cam.push - 0.16 * cam.snap),
    el: home.el - 0.05 * cam.push,
    roll: cam.roll,
  }));

  // ----- the pointer lands beside Maya -----
  const t0 = lab.t;
  lineOn = 1;
  await lab.tween(0.1, (e) => setLine(dotAt(lab.t - t0), e), ease.out);
  let following = true;
  let dotPos = dotAt(0);
  const stopDot = lab.every(() => {
    if (!following) return;
    dotPos = dotAt(lab.t - t0);
    setLine(dotPos);
  });

  // Jun notices: a snap of the head toward the dot, the eye narrows and locks on
  const camPush = lab.tween(0.85, (e) => (cam.push = e), ease.inOut);
  await lab.wait(0.12);
  const rot0 = J.rot;
  await lab.tween(0.12, (e) => {
    J.rot = rot0 + (aimAt(dotPos) - rot0) * e;
    eye.lock = e;
    poseJun();
  }, ease.outBack);
  // tracking: his whole body follows the jitter a beat late
  let crouch = 0;
  let wig = 0;
  const track = lab.every((dt, t) => {
    const want = aimAt(dotPos);
    J.rot += (want - J.rot) * Math.min(1, dt * 14);
    J.sy = 1 - 0.3 * crouch;
    J.sx = 1 + 0.16 * crouch;
    J.roll = Math.sin(t * 26) * 0.1 * wig;
    J.rot += Math.sin(t * 26 + 1) * 0.06 * wig;
    J.pitch = 0.12 * crouch;
    poseJun();
  });
  // the crouch, then the wiggle
  await lab.tween(0.22, (e) => (crouch = e), ease.out);
  await lab.tween(0.34, (e) => (wig = e), ease.in);
  await camPush;
  track();

  // ----- the pounce -----
  const from = lab.pos(J.x, J.y);
  const aim = dotPos.clone().sub(from).setY(0).normalize();
  const jump = (e) => {
    J.x = 3 + aim.x * 0.5 * e;
    J.y = 3 + aim.z * 0.5 * e;
  };
  // launch: unsquash into a stretch
  const rotP = J.rot;
  await lab.tween(0.06, (e) => {
    J.sy = 0.7 + 0.55 * e;
    J.sx = 1.16 - 0.26 * e;
    J.pitch = 0.12 - 0.3 * e;
    J.roll = 0;
    J.rot = rotP;
    poseJun();
  }, ease.out);
  await lab.tween(0.13, (e) => {
    jump(e * 0.62);
    J.lift = 0.5 * Math.sin((e * Math.PI) / 2);
    J.pitch = -0.18 + 0.45 * e;
    poseJun();
  }, ease.out);

  // ----- the dot hops onto Maya: the hit. Freeze frame. -----
  following = false;
  stopDot();
  const onMaya = lab.pos(1, 1).add(new THREE.Vector3(0.36, 0.18, 0.28));
  const dot0 = dotPos.clone();
  await lab.tween(0.05, (e) => setLine(dot0.clone().lerp(onMaya, e).setY(0.012 + (onMaya.y - 0.012) * e + Math.sin(e * Math.PI) * 0.15)), ease.out);
  lab.ring(onMaya.clone().setY(0.03), '#cfe6ff', 0.35, 0.03, 0.4);
  lab.shards(onMaya, '#4dabf7', 10);
  // the ghost: Jun's frozen pose, drawn again in his colour of light
  const ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd43b').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ghost = jun.model.body.clone(true);
  ghost.traverse((o) => {
    if (o.isMesh) o.material = ghostMat;
  });
  jun.group.updateMatrixWorld(true);
  ghost.matrixAutoUpdate = false;
  ghost.matrix.copy(jun.model.body.matrixWorld);
  add(ghost);

  lab.timeScale = 0.0001; // the world stops
  const shutter = document.createElement('div');
  shutter.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 42% 52% at 50% 55%,rgba(0,0,0,0) 60%,rgba(0,0,0,.6) 100%);opacity:0';
  lab.overlay.append(shutter);
  // the still: a shutter flash on the picture itself, then it holds, a little drained of colour, like a photo
  const canvas = lab.renderer.domElement;
  lab.cleanup(() => (canvas.style.filter = ''));
  const still = (flashK, drain) => (canvas.style.filter = `brightness(${1 + 0.9 * flashK}) saturate(${1 - 0.45 * drain}) contrast(${1 + 0.08 * drain})`);
  const real = (dur, fn) => new Promise((ok) => {
    const r0 = lab.real;
    const stop = lab.every(() => {
      const k = Math.min(1, (lab.real - r0) / dur);
      fn(k);
      if (k >= 1) {
        stop();
        ok();
      }
    });
  });
  // the freeze: a snap in, a slight dutch angle, the room drops away around him... and he blinks
  await real(0.08, (k) => {
    const e = ease.out3(k);
    cam.snap = e;
    cam.roll = 0.035 * e;
    still(1 - k, e);
    shutter.style.opacity = String(e);
  });
  await real(0.1, () => {});
  await real(0.16, (k) => (eye.blink = Math.sin(k * Math.PI)));
  eye.blink = 0;
  await real(0.08, () => {});

  // ----- time starts again: he drops, and slides home as if nothing happened -----
  lab.timeScale = 1;
  lab.glitch('a', '#ff7a6b');
  // the ghost of the pounce stays hanging in the air as he drops out from under it, then rises away like breath
  const g0 = ghost.matrix.clone();
  lab.tween(0.55, (e, k) => {
    ghostMat.opacity = 0.36 * Math.min(1, k * 3) * (1 - ease.in(k));
    ghost.matrix.copy(g0).premultiply(new THREE.Matrix4().makeTranslation(0, 0.08 * ease.out(k), 0));
  }, ease.linear).then(() => (ghost.visible = false));
  lab.tween(0.3, (e) => {
    shutter.style.opacity = String(1 - e);
    still(0, 1 - e);
  }, ease.out).then(() => {
    shutter.remove();
    canvas.style.filter = '';
  });
  lab.tween(0.3, (e) => (lineOn = 1 - e), ease.out).then(() => {
    lineCore.visible = lineGlow.visible = dot.visible = pool.visible = false;
  });
  const keep = lab.every(() => lineOn > 0 && setLine(onMaya));
  const xm = J.x;
  const ym = J.y;
  const l0 = J.lift;
  await lab.tween(0.12, (e) => {
    J.lift = l0 * (1 - e);
    J.pitch = 0.27 * (1 - e);
    J.sy = 1.25 - 0.4 * e;
    J.sx = 0.9 + 0.22 * e;
    eye.lock = 1 - e;
    poseJun();
  }, ease.in);
  // a tiny landing squash, then the nonchalant slide back (no trail: no evidence)
  const r1 = J.rot;
  const cs = cam.snap;
  const cr = cam.roll;
  lab.tween(0.46, (e) => {
    cam.snap = cs * (1 - e);
    cam.roll = cr * (1 - e);
    cam.push = 1 - e;
  }, ease.inOut);
  await lab.tween(0.42, (e, k) => {
    J.x = xm + (3 - xm) * e;
    J.y = ym + (3 - ym) * e;
    J.rot = r1 + (facing(0) - r1) * e;
    J.sy = 0.85 + 0.15 * ease.outBack(Math.min(1, k * 2.5));
    J.sx = 1.12 - 0.12 * ease.outBack(Math.min(1, k * 2.5));
    J.lift = 0;
    J.pitch = -0.06 * Math.sin(k * Math.PI);
    poseJun();
  }, ease.inOut);
  await lab.wait(0.03);
  keep();
  releaseCam();
  jun.each = null;
  for (const [o, s] of visor) o.scale.y = s;
  jun.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0, x: 3, y: 3, rot: facing(0) });
  jun.release({ x: 3, y: 3, d: 0 });
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
