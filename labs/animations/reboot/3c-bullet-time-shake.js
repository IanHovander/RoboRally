// Reboot, idea 3 (Shakes it off), animator c: cinematic & graphic staging.
// The room dims and the token lights from below, so Maya is just there as a black, wet silhouette against it.
// The camera creeps in during a long, still pause; a drop of darkness drips off her nose. Then a snap zoom and
// she shakes like a wet dog, the darkness flinging off nose first... and time stops: bullet time, the droplets
// hanging in the air, half of her already red, while the camera swings round her. Time drops back in, the
// droplets spatter the glass as dark spots and evaporate, her ring and then her eye come on, and two drops that
// stuck to her flank blink grey twice (the 2 SPAM) and fade.
export const meta = {
  title: 'Bullet-time shake',
  idea:
    'Maya is simply there on the token as a black, wet silhouette, backlit by the token\'s light while the room dims. A long, still pause (one drop drips off her nose), then a snap zoom and she shakes like a wet dog, and time stops mid-shake: bullet time, droplets of darkness hanging in the air, her nose already red, the camera swinging round her. Time drops back in, the spatter lands as dark spots that evaporate, her ring and eye come on, and two drops stuck to her flank blink grey twice: the 2 SPAM.',
  notes:
    'Sound: silence and a single wet "plip" for the drip, a quick rattle for the shake that cuts out dead at the freeze (a held, high glass tone while time is stopped), then a scatter of soft ticks as the spatter lands, a warm chime for the eye, two muted grey blips. Porting: the coat is a clone of the body in black with a clipping plane sweeping nose to tail (renderer.localClippingEnabled); droplets are small glossy spheres, the spots flat discs that shrink. Bullet time: the scene clock nearly stops while the camera keeps moving in real time.',
};

const MAYA_RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);

  const token = lab.pos(3, 1);
  const T0 = arena.time;
  const now = () => arena.time - T0;

  // timeline (scene seconds; the freeze adds real time on top)
  const SHAKE0 = 0.62;
  const SHAKE1 = 1.08;
  const FREEZE_AT = 0.84;
  const FREEZE_REAL = 0.4;
  const RING_ON = 1.16;
  const EYE_ON = 1.36;
  const BLINKS = [1.5, 1.68];
  const END = 2.3;

  // ---------- the token's light from below: the backlight that makes her a silhouette ----------
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.65, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0, 0, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  back.rotation.x = -Math.PI / 2;
  back.position.set(token.x, 0.006, token.z);
  back.renderOrder = 2;
  lab.add(back);
  const backColor = new THREE.Color('#cfe3ff');

  // ---------- Maya, coated in darkness ----------
  const maya = lab.puppet('a');
  maya.set({ x: 3, y: 1, rot: lab.facing(1), visible: true, trail: false });
  const renderer = lab.renderer;
  const clip0 = renderer.localClippingEnabled;
  renderer.localClippingEnabled = true;
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 99);
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.32, metalness: 0, clippingPlanes: [plane] });
  const coat = maya.model.body.clone(true);
  coat.position.set(0, 0, 0);
  coat.rotation.set(0, 0, 0);
  coat.scale.setScalar(1.045);
  coat.traverse((o) => {
    if (o.isMesh) {
      o.material = coatMat;
      o.castShadow = false;
    }
  });
  maya.model.body.add(coat);
  // two drops that will stick to her flank (the side we see)
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.2, emissive: new THREE.Color(0.7, 0.72, 0.76), emissiveIntensity: 0 });
  const sticks = [
    [0.29, 0.15, 0.0, 0.058],
    [0.26, 0.11, 0.2, 0.048],
  ].map(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), stickMat);
    m.position.set(x, y, z);
    m.scale.set(1, 0.8, 1);
    m.visible = false;
    maya.model.body.add(m);
    return m;
  });
  const removeExtras = () => {
    maya.model.body.remove(coat);
    for (const s of sticks) maya.model.body.remove(s);
  };
  lab.cleanup(() => {
    removeExtras();
    renderer.localClippingEnabled = clip0;
  });
  const red = new THREE.Color(MAYA_RED);
  const look = { eye: 0, ring: 0, pool: 0, glint: 0 };
  maya.each = (m) => {
    const e = look.eye;
    m.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    m.ringMat.opacity = 0.9 * look.ring;
    m.poolMat.opacity = 0.75 * look.pool;
    m.paint.emissive.copy(red);
    m.paint.emissiveIntensity = 0.16 + look.glint;
  };

  // ---------- droplets and spots ----------
  const dropGeo = new THREE.SphereGeometry(1, 12, 9);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x040405, roughness: 0.18, metalness: 0 });
  const spotGeo = new THREE.CircleGeometry(1, 20);
  const drops = [];
  const spots = [];
  const spot = (x, z, r, vx, vz, t) => {
    const m = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.88, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    const sp = Math.hypot(vx, vz);
    m.rotation.z = -Math.atan2(vz, vx);
    m.position.set(x, 0.012, z);
    m.renderOrder = 6;
    lab.add(m);
    spots.push({ m, r, stretch: 1 + Math.min(1.2, sp * 0.35), t, life: lab.range(0.55, 0.9) });
  };
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = i / (N - 1); // 0 nose .. 1 tail
    const side = i % 2 ? 1 : -1;
    drops.push({
      a,
      side,
      te: SHAKE0 + 0.02 + a * 0.28 + lab.range(0, 0.05),
      r: lab.range(0.018, 0.05),
      sp: lab.range(1.1, 2.6),
      up: lab.range(0.7, 1.9),
      fw: lab.range(-0.4, 0.4),
      y: lab.range(0.1, 0.24),
      m: null,
      v: null,
      landed: false,
    });
  }
  // the drip off her nose during the pause
  const drip = { m: new THREE.Mesh(dropGeo, dropMat), born: 0.12, fall: 0.42, landed: false };
  drip.m.visible = false;
  lab.add(drip.m);

  // ---------- Theo, two spaces off, gets a flinch ----------
  const theo = lab.puppet('b');

  // ---------- the camera ----------
  const cam = { creep: 0, snap: 0, orbit: 0, home: 0 };
  const releaseCam = lab.camera((home) => {
    const inK = Math.max(cam.creep * 0.35, cam.snap) * (1 - cam.home);
    const target = home.target.clone().lerp(new THREE.Vector3(token.x, 0.18, token.z), Math.min(1, inK * 1.15));
    return {
      target,
      dist: home.dist * (1 - 0.6 * inK),
      el: home.el - 0.16 * cam.snap * (1 - cam.home),
      az: cam.orbit * (1 - cam.home),
    };
  });

  // ---------- the master timeline ----------
  const tmp = new THREE.Vector3();
  let frozen = false;
  let freezeStart = 0;
  let orbitAtThaw = 0;
  const stop = lab.every((dt) => {
    const T = now();

    // the room dims and the token lights her from below
    const appear = smooth(seg(T, 0, 0.12));
    const lightsBack = smooth(seg(T, SHAKE1 - 0.05, SHAKE1 + 0.4));
    back.material.color.copy(backColor).multiplyScalar((0.85 * appear + 0.25 * Math.max(0, 1 - T / 0.12) * (T < 0.12 ? 1 : 0)) * (1 - 0.85 * lightsBack));
    arena.topMat.emissiveIntensity *= 1 - 0.5 * appear * (1 - lightsBack);
    theo.model.poolMat.opacity *= 1 - 0.4 * appear * (1 - lightsBack);

    // the pause: a tiny sink and lean back, gathering; then the shake
    const gather = smooth(seg(T, 0.3, SHAKE0));
    const S = seg(T, SHAKE0, SHAKE1);
    const env = Math.sin(Math.PI * S) ** 0.6;
    const ph = (T - SHAKE0) * 2 * Math.PI * 7.5;
    const shaking = T >= SHAKE0 && T < SHAKE1;
    maya.set({
      roll: shaking ? 0.4 * env * Math.sin(ph) : 0,
      rot: lab.facing(1) + (shaking ? 0.24 * env * Math.sin(ph - 1.4) : 0),
      pitch: shaking ? 0.05 * env * Math.sin(ph * 0.5) : -0.07 * gather,
      sy: shaking ? 1 + 0.05 * env * Math.sin(ph * 2) : 1 - 0.05 * gather,
      x: 3 + (shaking ? 0.025 * env * Math.sin(ph + 0.6) : 0),
    });
    if (T >= SHAKE1) maya.set({ roll: 0, pitch: 0, sy: 1, x: 3, rot: lab.facing(1) });

    // the coat comes off from the nose back, riding the shake
    maya.group.updateMatrixWorld(true);
    const nose = maya.group.position.x + 0.55;
    const tail = maya.group.position.x - 0.6;
    plane.constant = lerp(nose, tail, ease.inOut(seg(T, SHAKE0 + 0.03, SHAKE1 - 0.06)));
    coat.visible = T < SHAKE1;

    // the drip: a bead swells under her nose and falls
    if (!drip.landed) {
      const k = seg(T, drip.born, drip.fall);
      if (T >= drip.born) {
        drip.m.visible = true;
        const p = maya.model.body.localToWorld(tmp.set(0, 0.07, -0.37));
        const fallK = seg(T, drip.fall, drip.fall + 0.14);
        drip.m.position.set(p.x, p.y * (1 - fallK * fallK), p.z);
        const r = 0.014 + 0.03 * smooth(k);
        drip.m.scale.set(r, r * (1 + 0.6 * k), r);
        if (fallK >= 1) {
          drip.landed = true;
          drip.m.visible = false;
          spot(p.x, p.z, 0.05, 0, 0, T);
        }
      }
    }

    // the shake throws the darkness off
    for (const d of drops) {
      if (d.landed || T < d.te) continue;
      if (!d.m) {
        d.m = new THREE.Mesh(dropGeo, dropMat);
        d.m.scale.setScalar(d.r);
        lab.add(d.m);
        const local = tmp.set(0.3 * d.side, d.y, lerp(-0.3, 0.36, d.a));
        const p = maya.model.body.localToWorld(local.clone());
        d.m.position.copy(p);
        // flung sideways (across her length), a little up
        const sideW = new THREE.Vector3(0, 0, 1).applyQuaternion(maya.group.quaternion);
        const fwdW = new THREE.Vector3(0, 0, -1).applyQuaternion(maya.group.quaternion);
        const sideDir = new THREE.Vector3(1, 0, 0).applyQuaternion(maya.group.quaternion).multiplyScalar(d.side);
        d.v = sideDir.multiplyScalar(d.sp).add(fwdW.multiplyScalar(d.fw)).add(new THREE.Vector3(0, d.up, 0));
        void sideW;
      }
      d.v.y -= 7 * dt;
      d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y <= 0.01 && d.v.y < 0) {
        d.landed = true;
        d.m.visible = false;
        spot(d.m.position.x, d.m.position.z, d.r * 1.9, d.v.x, d.v.z, T);
      }
    }
    // spots splat, then evaporate
    for (const s of spots) {
      const age = T - s.t;
      const splat = ease.outBack(clamp(age / 0.08));
      const evap = smooth(seg(age, s.life * 0.35, s.life));
      const r = s.r * splat * (1 - 0.85 * evap);
      s.m.scale.set(r * s.stretch, r, 1);
      s.m.material.opacity = 0.88 * (1 - evap);
    }

    // ring, then eye; the stuck drops blink grey twice and fade
    look.ring = smooth(seg(T, RING_ON, RING_ON + 0.18));
    look.pool = look.ring * smooth(seg(T, SHAKE1 + 0.35, SHAKE1 + 0.7));
    look.eye = smooth(seg(T, EYE_ON, EYE_ON + 0.05)) * (1 + 0.4 * (1 - smooth(seg(T, EYE_ON + 0.05, EYE_ON + 0.3))));
    look.glint = 0.5 * Math.max(0, 1 - Math.abs(T - SHAKE1) / 0.18) * 0;
    for (const s of sticks) s.visible = T >= SHAKE1 - 0.02 && T < BLINKS[1] + 0.5;
    let blink = 0;
    for (const b of BLINKS) blink = Math.max(blink, Math.sin(Math.PI * seg(T, b, b + 0.12)));
    stickMat.emissiveIntensity = 2.6 * blink;
    const shrink = 1 - smooth(seg(T, BLINKS[1] + 0.14, BLINKS[1] + 0.45));
    sticks[0].scale.set(shrink, 0.8 * shrink, shrink);
    sticks[1].scale.set(shrink, 0.8 * shrink, shrink);

    // Theo leans away from the spray, then settles
    const fl = Math.sin(Math.PI * seg(T, SHAKE0 + 0.1, SHAKE1 + 0.35));
    theo.set({ pitch: -0.18 * fl, sy: 1 - 0.07 * fl, roll: 0.06 * fl });

    // camera
    cam.creep = smooth(seg(T, 0.05, SHAKE0));
    cam.snap = ease.out3(seg(T, SHAKE0 - 0.02, SHAKE0 + 0.08));
    if (frozen) cam.orbit = 0.62 * smooth(clamp((lab.real - freezeStart) / FREEZE_REAL));
    else if (T > FREEZE_AT) cam.orbit = orbitAtThaw;
    cam.home = smooth(seg(T, SHAKE1 + 0.1, END - 0.2));
    // name tags would be huge in the close-up: hide them while the camera is in close
    const close = cam.snap * (1 - cam.home) > 0.25;
    for (const key of ['a', 'b']) {
      const tag = lab.bot(key).tag;
      if (tag && close) tag.visible = false;
    }
  });

  // bullet time
  await lab.wait(FREEZE_AT);
  frozen = true;
  freezeStart = lab.real;
  lab.timeScale = 0.025;
  await lab.waitReal(FREEZE_REAL);
  orbitAtThaw = cam.orbit;
  frozen = false;
  lab.timeScale = 1;

  await lab.wait(END - 0.2 - now());
  releaseCam();
  await lab.wait(END - now());
  stop();
  removeExtras();
  for (const d of drops) if (d.m) d.m.visible = false;
  for (const s of spots) s.m.visible = false;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
