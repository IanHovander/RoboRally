// Energy, idea 5 (The well), animator c: cinematic & graphic staging.
export const meta = {
  title: 'Edgerton drop',
  idea:
    'As Maya settles, the battery\'s arcs swirl inward and drain up into her, her ring and eye warm to amber, and the space under her opens into a black well, drawn the way Lumen draws pits. The camera leans in for a beat of "did she break it?", then tilts up into the dark as a single star of warm light kindles high above and falls as a long-exposure streak. Time drops to high-speed-photography slow motion at the splash: a crown of light droplets, a ripple running round her ring, and the battery\'s light refilling the well from where the drop landed. Time snaps back and her eye cools.',
  notes:
    'Sound: the drain is a soft rising glass swirl; then near silence (the room tone dips); a high "ting" as the star kindles, a falling whistle too quiet to notice, and a single bright "plink" stretched by the slow motion into a glassy ring; the refill is a low warm swell. After Harold Edgerton\'s milk-drop photographs: the streak shortens to a crisp bead as time slows, like a strobe freezing it. The well and the refill front are one small shader on a plane over the battery.',
};

const BAT = { x: 3, y: 1 };
const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (k) => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI);

/** The battery redrawn by us: a patch of plain glass over the painted one, our own arcs and bolt on top. */
function batteryRig(lab) {
  const { THREE, arena, PALETTE } = lab;
  const at = lab.pos(BAT.x, BAT.y);
  const c = arena.course;
  const geo = new THREE.CircleGeometry(0.47, 48).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  const ps = geo.attributes.position;
  for (let i = 0; i < ps.count; i++) uv.setXY(i, (at.x + ps.getX(i) + c.w / 2) / c.w, 1 - (at.z + ps.getZ(i) + c.h / 2) / c.h);
  const coverMat = arena.topMat.clone();
  coverMat.emissiveMap = null;
  coverMat.emissive.setRGB(0.002, 0.0022, 0.0026);
  const cover = new THREE.Mesh(geo, coverMat);
  cover.position.set(at.x, 0.0015, at.z);
  cover.receiveShadow = true;
  lab.add(cover);
  const paint = (fn) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.shadowColor = '#fff';
    g.shadowBlur = 30;
    g.strokeStyle = g.fillStyle = '#fff';
    fn(g);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const flat = (map, y) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map, color: new THREE.Color(PALETTE.energy), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.set(at.x, y, at.z);
    lab.add(m);
    return m;
  };
  const arcs = [0, 1, 2].map((i) =>
    flat(
      paint((g) => {
        g.lineWidth = 7.2;
        g.beginPath();
        g.arc(128, 128, 76.8, (i / 3) * Math.PI * 2 + 0.25, ((i + 1) / 3) * Math.PI * 2 - 0.25);
        g.stroke();
      }),
      0.005,
    ),
  );
  const bolt = flat(
    paint((g) => {
      const size = 87;
      g.translate(128 - size / 2, 128 - size / 2);
      g.scale(size / 40, size / 40);
      g.fill(new Path2D('M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z'));
    }),
    0.0052,
  );
  const rig = {
    at,
    arcs,
    bolt,
    level: [1, 1, 1], // each arc's brightness (1 = as the game draws it)
    boltLevel: 1,
    glow: 1, // the soft glow under the battery (1 = the game's breathing)
    scale: 1,
    freeze: null, // hold the glow's breathing at this time
  };
  const stop = lab.every((dt, t) => {
    arcs.forEach((m, i) => {
      m.material.color.set(PALETTE.energy).multiplyScalar(rig.level[i]);
      m.scale.setScalar(rig.scale);
    });
    bolt.material.color.set(PALETTE.energy).multiplyScalar(rig.boltLevel);
    const tt = rig.freeze ?? t;
    arena.batteryMat.color.set(PALETTE.energy).multiplyScalar((0.22 + Math.sin(tt * 2.2) * 0.1) * rig.glow);
  });
  lab.cleanup(stop);
  return rig;
}


/** The well: a black disc in the glass (like a pit) with the glass edge catching the light, and the refill front. */
function wellRig(lab, at) {
  const { THREE, PALETTE } = lab;
  const SPAN = 1.5;
  const uniforms = {
    uR: { value: 0 },
    uFill: { value: 0 },
    uP: { value: new THREE.Vector2(0, 0) },
    uA: { value: 1 },
    uWave: { value: 0 },
    uRim: { value: new THREE.Color(PALETTE.light).multiplyScalar(1.1) },
    uAmber: { value: new THREE.Color(PALETTE.energy).multiplyScalar(2.6) },
  };
  const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const common = `uniform float uR, uFill, uA, uWave; uniform vec2 uP; uniform vec3 uRim, uAmber; varying vec2 vUv;
    float d0(){ return length((vUv - 0.5) * ${SPAN.toFixed(2)}); }
    float dp(){ return length((vUv - 0.5) * ${SPAN.toFixed(2)} - uP); }`;
  const dark = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: `${common}
      void main(){
        float inDisc = 1.0 - smoothstep(uR - 0.014, uR, d0());
        float filled = 1.0 - smoothstep(uFill - 0.05, uFill, dp());
        gl_FragColor = vec4(0.0, 0.0, 0.0, inDisc * (1.0 - filled) * uA);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const light = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: `${common}
      void main(){
        float d = d0();
        float inDisc = 1.0 - smoothstep(uR - 0.014, uR, d);
        float filled = 1.0 - smoothstep(uFill - 0.05, uFill, dp());
        float rim = exp(-pow((d - uR) / 0.012, 2.0)) * (1.0 - filled) * uA * step(0.02, uR);
        float wave = exp(-pow((dp() - uFill) / 0.04, 2.0)) * inDisc * uWave;
        gl_FragColor = vec4(uRim * rim + uAmber * wave, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geo = new THREE.PlaneGeometry(SPAN, SPAN).rotateX(-Math.PI / 2);
  const m1 = new THREE.Mesh(geo, dark);
  const m2 = new THREE.Mesh(geo, light);
  m1.position.set(at.x, 0.0056, at.z);
  m2.position.set(at.x, 0.0058, at.z);
  m1.renderOrder = 3;
  m2.renderOrder = 4;
  lab.add(m1);
  lab.add(m2);
  return {
    u: uniforms,
    /** where the refill starts, as an offset on the glass from the battery's centre */
    from(dx, dz) {
      uniforms.uP.value.set(dx, -dz);
    },
  };
}

function bead(lab, color, size, k) {
  const { THREE } = lab;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(size);
  lab.add(sp);
  return sp;
}

export default async function play(lab) {
  const { THREE, PALETTE, ease, facing } = lab;
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  const bat = batteryRig(lab);
  const at = bat.at;
  const well = wellRig(lab, at);
  const R = 0.58; // the well: a little wider than her ring, so her ring floats over the hole
  const LAND = new THREE.Vector3(0.2, 0, 0.5); // the drop lands at the well's edge, on our side
  well.from(LAND.x, LAND.z);
  const landAt = at.clone().add(LAND);

  // her lights
  const WHITE = new THREE.Color(3.2, 3.1, 2.9);
  const AMBER = new THREE.Color(PALETTE.energy).multiplyScalar(4.2);
  const ring0 = maya.model.ringMat.color.clone();
  const RING = new THREE.Color(PALETTE.energy).multiplyScalar(2.3);
  const look = { warm: 0, pool: 1 };
  maya.each = (m) => {
    m.eyeMat.color.copy(WHITE).lerp(AMBER, look.warm);
    m.ringMat.color.copy(ring0).lerp(RING, look.warm * 0.9);
    m.poolMat.opacity *= look.pool;
  };
  const restore = () => maya.model.ringMat.color.copy(ring0);
  lab.cleanup(restore);

  // the camera
  const cam = { k: 0, push: 0, up: 0 };
  const releaseCam = lab.camera((home) => {
    const target = home.target.clone().lerp(at, cam.k);
    target.y += cam.up;
    return { target, dist: home.dist * (1 - cam.push) };
  });

  // ---- the beats (scene seconds; the splash runs in slow motion) ----
  const MOVE = 0.58;
  const DRAIN = 0.6; // the light swirls in and up into her; the well opens
  const HOLD = 0.86; // "did she break it?"
  const STAR = 1.02; // a point of light kindles in the dark above
  const FALL = 1.14; // it falls
  const SPLASH = 1.36; // plink (slow motion)
  const END = 1.98;
  const TOP = landAt.clone().setY(2.1);

  const star = bead(lab, '#fff1d6', 0.16, 3.4);
  star.visible = false;
  // the long-exposure streak behind the falling drop
  const streakGeo = new THREE.CylinderGeometry(0.022, 0.006, 1, 8, 1, true).translate(0, 0.5, 0);
  const streak = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.energy).multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.visible = false;
  lab.add(streak);
  // the crown: droplets thrown up in a ring at the splash
  const crown = [];
  for (let i = 0; i < 11; i++) {
    const s = bead(lab, i % 3 ? PALETTE.energy : '#fff1d6', 0.05, 2.6);
    s.visible = false;
    const a = (i / 11) * Math.PI * 2 + 0.2;
    crown.push({ s, a, v: 0.55 + (i % 3) * 0.12, up: 1.25 + ((i * 7) % 5) * 0.12 });
  }
  // a ripple of light running round her ring both ways from where the drop landed
  const ripples = [-1, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.49, 0.56, 48, 1, 0, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.energy).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, 0.009, at.z);
    m.visible = false;
    lab.add(m);
    return m;
  });
  const landAngle = Math.atan2(-LAND.z, LAND.x); // the ring's angle (in its own plane) where the drop lands
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2;
  splash.position.copy(landAt).setY(0.01);
  splash.visible = false;
  lab.add(splash);

  lab.playCard('a', ['m2']);
  let slow = false;
  const t0 = lab.t;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    const pose = { x: 1 + 2 * ease.inOut(seg(T, 0, MOVE)), pitch: bump(seg(T, MOVE - 0.04, MOVE + 0.2)) * 0.1, lift: 0, sy: 1, sx: 1, sz: 1, roll: 0 };

    // ---- the drain: the arcs swirl in and up, the glow goes, the well opens under her ----
    const dr = ease.inOut(seg(T, DRAIN, HOLD));
    const back = seg(T, SPLASH, SPLASH + 0.01); // under the well again from the splash on, revealed by the refill
    bat.scale = back ? 1 : 1 - 0.75 * dr;
    bat.arcs.forEach((m, i) => (m.rotation.y = back ? 0 : -dr * (2.2 + i * 0.3)));
    const lv = back ? 1.25 : 1 + 1.2 * bump(dr * 0.8) - 2.2 * ease.in(dr);
    bat.level = [lv, lv, lv].map((v) => Math.max(0, v));
    bat.boltLevel = back ? 1.25 : Math.max(0, 1 - 1.3 * dr);
    bat.glow = back ? mix(0, 1.6, seg(T, SPLASH, SPLASH + 0.25)) : Math.max(0, 1 - dr);
    well.u.uR.value = R * ease.out(seg(T, DRAIN + 0.08, HOLD + 0.04));
    // her: a little lift as it pours up into her, eye and ring amber
    pose.sy += 0.07 * bump(seg(T, DRAIN + 0.05, HOLD + 0.05));
    pose.sx = pose.sz = 1 - 0.03 * bump(seg(T, DRAIN + 0.05, HOLD + 0.05));
    look.warm = ease.out(seg(T, DRAIN + 0.1, HOLD)) * (1 - ease.inOut(seg(T, SPLASH + 0.2, END - 0.02)));
    look.pool = 1 - 0.8 * ease.inOut(seg(T, DRAIN, HOLD)) * (1 - seg(T, SPLASH + 0.05, SPLASH + 0.4));
    // "did she break it?": she peers down into the hole, then looks up at the star
    pose.pitch += 0.28 * ease.inOut(seg(T, HOLD, HOLD + 0.12)) * (1 - ease.inOut(seg(T, STAR + 0.02, STAR + 0.14)));
    pose.pitch -= 0.2 * ease.inOut(seg(T, STAR + 0.02, STAR + 0.14)) * (1 - ease.inOut(seg(T, SPLASH, SPLASH + 0.2)));

    // ---- the star, the fall, the splash ----
    star.visible = T >= STAR && T < SPLASH;
    if (star.visible) {
      const kin = ease.out(seg(T, STAR, STAR + 0.08));
      const f = ease.in(seg(T, FALL, SPLASH));
      star.position.lerpVectors(TOP, landAt, f);
      star.scale.setScalar(0.06 + 0.12 * kin + 0.1 * bump(seg(T, STAR, STAR + 0.12)));
      // the streak: long while it's fast, shrinking to a bead as time slows
      const speed = f > 0 ? (2 * seg(T, FALL, SPLASH)) * TOP.y / (SPLASH - FALL) : 0;
      const len = Math.min(0.9, speed * 0.075 * lab.timeScale);
      streak.visible = len > 0.02;
      streak.position.copy(star.position);
      streak.scale.set(1, len, 1);
    } else streak.visible = false;
    for (const c of crown) {
      const k = T - SPLASH;
      c.s.visible = k > 0 && k < 0.36;
      if (!c.s.visible) continue;
      const r = 0.03 + c.v * k;
      c.s.position.set(landAt.x + Math.cos(c.a) * r, Math.max(0, c.up * k - 4.2 * k * k), landAt.z + Math.sin(c.a) * r * 0.8);
      c.s.material.opacity = 1 - (k / 0.36) ** 2;
    }
    ripples.forEach((m, i) => {
      const k = seg(T, SPLASH + 0.02, SPLASH + 0.4);
      m.visible = k > 0 && k < 1;
      const dir = i ? 1 : -1;
      m.rotation.z = landAngle - 0.35 + dir * k * Math.PI;
      m.material.opacity = (1 - k) ** 1.2;
    });
    {
      const k = seg(T, SPLASH, SPLASH + 0.32);
      splash.visible = k > 0 && k < 1;
      splash.scale.setScalar(0.03 + 0.22 * ease.out(k));
      splash.material.opacity = (1 - k) ** 1.5;
    }
    // the refill runs across the well from where the drop landed
    const fill = ease.out(seg(T, SPLASH + 0.02, SPLASH + 0.42));
    well.u.uFill.value = fill * 1.2;
    well.u.uWave.value = T >= SPLASH ? 1 - seg(T, SPLASH + 0.3, SPLASH + 0.45) : 0;
    well.u.uA.value = 1 - seg(T, SPLASH + 0.38, SPLASH + 0.46);
    if (T >= SPLASH && !slow) {
      slow = true;
      lab.slowmo(0.24, 0.04).then(() => lab.waitReal(0.2)).then(() => lab.slowmo(1, 0.24));
    }
    // she flinches at the plink, a tiny hop
    pose.lift += 0.035 * bump(seg(T, SPLASH, SPLASH + 0.18));
    maya.set(pose);

    // ---- the camera: leans in, tilts up into the dark for the star, follows it down, home ----
    const lean = ease.inOut(seg(T, DRAIN, STAR)) * (1 - ease.inOut(seg(T, SPLASH + 0.1, END - 0.04)));
    cam.k = 0.4 * lean;
    cam.push = 0.12 * lean;
    cam.up = 0.55 * ease.inOut(seg(T, STAR - 0.04, FALL + 0.02)) * (1 - ease.inOut(seg(T, FALL + 0.04, SPLASH + 0.04)));
  });
  lab.cleanup(stop);

  await lab.wait(END);
  stop();
  restore();
  releaseCam();
  lab.timeScale = 1;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
