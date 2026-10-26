// Reboot, idea 17 through a character-acting lens: Maya comes back soaked in the pit's darkness and shakes it off
// like a wet dog. Theo, who leaned in to see if she was all right, takes a drop square in the face, holds a
// perfectly still deadpan for a long beat, and then does a tiny shake of his own.
export const meta = {
  title: 'Shakes it off (and Theo gets wet)',
  idea: 'The token lights up under a matte black silhouette: Maya, still dripping the pit. One drip falls. She stands there stunned, plants herself, and shakes like a wet dog: the roll starts at her nose and runs back to her tail, the darkness flies off in black drops that spatter the glass and dry up, and her polished red comes out from the nose back with a seam of light at the edge. Her ring comes on, then her eye. Two drops cling to her flank and blink grey twice (the 2 SPAM); she looks down at them, unimpressed. Theo leaned in to check on her and caught a drop right on his face: he holds very, very still... then shakes it off too.',
  notes: 'Sound: a dull wet hush when she appears (no chime), one small drip, then a fast glassy rattle for the shake with a scatter of soft taps as the drops land, a bright clean chime when her eye comes on, two muffled grey ticks for the SPAM, and silence for Theo\'s deadpan before a tiny rattle of his own. The coat is a black copy of her shell, cut away from the nose back by a shader with a thin seam of light at the edge. The spatter is random each time, and whoever is nearest gets the drop.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const RED = new THREE.Color('#ff4d6d');
  const GREY = new THREE.Color('#a9b2bd');
  const TOKEN = new THREE.Color(lab.PALETTE.reboot);
  const tok = lab.pos(3, 1);

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const track = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (ease[e ?? 'inOut'] ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };

  // ---------- textures: a soft glow, and a few splat shapes ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.5)');
    grad.addColorStop(0.7, 'rgba(255,255,255,.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const splatTex = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(32, 32, 15, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 6; i++) {
      const a = lab.range(0, Math.PI * 2);
      const d = lab.range(14, 26);
      g.beginPath();
      g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, lab.range(2, 6), 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  });

  // the token's light, rising under her: the only thing that shows her silhouette at first
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(tok.x, 0.012, tok.z);
  pool.renderOrder = 3;
  lab.add(pool);

  // ---------- the actors ----------
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const theoRot = facing(3);
  maya.set({ x: 3, y: 1, rot: facing(1), visible: true, trail: false });
  theo.set({ x: 5, y: 2, rot: theoRot, trail: false });
  const mm = maya.model;
  let shell = null;
  let eye = null;
  mm.body.traverse((o) => {
    if (o.isMesh && o.material === mm.paint) shell = o;
    if (o.isMesh && o.material === mm.eyeMat) eye = o;
  });
  const eyeScale0 = eye.scale.clone();
  lab.cleanup(() => eye.scale.copy(eyeScale0));

  // the coat of darkness: a matte black copy of her shell, eaten away from the nose back
  const U = { uCut: { value: -0.5 }, uSeam: { value: new THREE.Color(RED).multiplyScalar(2.4) } };
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.85, metalness: 0 });
  coatMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform float uCut;\nuniform vec3 uSeam;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
  float lumEdge = uCut + 0.035 * sin(vLocal.x * 38.0 + vLocal.y * 21.0) + 0.02 * sin(vLocal.x * 91.0);
  if (vLocal.z < lumEdge) discard;`,
      )
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb += uSeam * smoothstep(0.05, 0.0, vLocal.z - lumEdge);');
  };
  coatMat.customProgramCacheKey = () => 'lab-reboot-3b-coat';
  const coat = new THREE.Mesh(shell.geometry, coatMat);
  coat.scale.setScalar(1.05);
  coat.position.copy(shell.position);
  shell.parent.add(coat);
  lab.cleanup(() => coat.parent?.remove(coat));

  // two drops that cling to her right flank (the side we see), and the one that hits Theo
  const dropGeo = new THREE.SphereGeometry(1, 16, 12);
  const clingMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const cling = [
    [0.29, 0.13, 0.0, 0.065],
    [0.25, 0.12, 0.2, 0.055],
  ].map(([x, y, z, r]) => {
    const m = new THREE.Mesh(dropGeo, clingMat.clone());
    m.position.set(x, y, z);
    m.scale.set(r * 0.7, r, r);
    m.visible = false;
    mm.body.add(m);
    return m;
  });
  const splatOnTheo = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.85 }));
  splatOnTheo.position.set(0, 0.15, -0.24);
  splatOnTheo.scale.set(0.15, 0.11, 0.06);
  splatOnTheo.rotation.x = -0.65;
  splatOnTheo.visible = false;
  theo.model.body.add(splatOnTheo);
  lab.cleanup(() => {
    for (const m of cling) m.parent?.remove(m);
    splatOnTheo.parent?.remove(splatOnTheo);
  });

  // ---------- flying drops and the dark spots they leave on the glass ----------
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x030405, roughness: 0.18, metalness: 0.1 });
  const drops = [];
  const spots = [];
  const G = 7.5;
  const launch = (from, vel, r, onLand) => {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.copy(from);
    m.scale.setScalar(r);
    lab.add(m);
    drops.push({ m, v: vel.clone(), r, onLand });
  };
  const spot = (x, z, r, life) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex[spots.length % 3], color: 0x000000, transparent: true, opacity: 0.92, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = lab.range(0, Math.PI * 2);
    m.position.set(x, 0.016, z);
    m.renderOrder = 5;
    lab.add(m);
    spots.push({ m, born: lab.t, r: r * 3.4, life });
  };
  const stepDrops = (dt, now) => {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.v.y -= G * dt;
      d.m.position.addScaledVector(d.v, dt);
      const sp = d.v.length();
      // stretched along its flight
      d.m.scale.set(d.r, d.r * (1 + Math.min(0.8, sp * 0.12)), d.r);
      d.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.v.clone().normalize());
      const landed = d.onLand ? d.onLand(d) : d.m.position.y <= 0.01;
      if (landed) {
        if (!d.onLand) spot(d.m.position.x, d.m.position.z, d.r, lab.range(0.45, 0.85));
        lab.group.remove(d.m);
        drops.splice(i, 1);
      }
    }
    for (const s of spots) {
      const age = (now - s.born) / s.life;
      const splash = Math.min(1, (now - s.born) / 0.06);
      const k = clamp01(age);
      const sc = s.r * (0.6 + 0.4 * splash) * (1 - 0.65 * ease.in(k));
      s.m.scale.set(sc, sc, 1);
      s.m.material.opacity = 0.92 * (1 - ease.in(k));
      s.m.visible = k < 1;
    }
  };
  const bodyPoint = (lx, ly, lz) => {
    mm.body.updateWorldMatrix(true, false);
    return mm.body.localToWorld(new THREE.Vector3(lx, ly, lz));
  };
  const bodyDir = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(mm.body.getWorldQuaternion(new THREE.Quaternion())).normalize();

  // ---------- timeline ----------
  const SH0 = 0.86; // the shake
  const SH1 = 1.42;
  const FREQ = 7.2;
  const NOSE = -0.42;
  const TAIL = 0.47;
  const HIT = 1.44; // the drop reaches Theo
  const st = { eye: 0, eyeOpen: 0, ring: 0, theoEye: 1, cling: 0, clingGrey: 0, clingShow: false, splat: false };
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(st.eye);
    eye.scale.set(eyeScale0.x * Math.max(0.05, st.eyeOpen), eyeScale0.y, eyeScale0.z);
    m.ringMat.opacity = 0.9 * st.ring;
    m.poolMat.opacity = 0.75 * st.ring;
    m.paint.emissiveIntensity = 0.16 + 0.35 * st.ring * (1 - st.ring) * 4 * 0.5;
    for (const c of cling) {
      c.visible = st.clingShow;
      c.material.color.copy(GREY).multiplyScalar(3.2 * st.clingGrey);
    }
    cling[0].scale.set(0.045 * st.cling, 0.065 * st.cling, 0.065 * st.cling);
    cling[1].scale.set(0.038 * st.cling, 0.055 * st.cling, 0.055 * st.cling);
  };
  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(st.theoEye);
    splatOnTheo.visible = st.splat;
  };

  let shotTheo = false;
  let nextDrop = 0;
  let dripped = false;
  let theoShook = false;
  const T0 = lab.t;
  const camRelease = lab.camera((home, t) => {
    const k = track(t - T0, [[0, 0], [0.7, 1, 'inOut'], [1.5, 1], [2.3, 0, 'inOut']]);
    return { target: home.target.clone().lerp(tok, 0.18 * k), dist: home.dist * (1 - 0.06 * k) };
  });

  const update = (dt) => {
    const t = lab.t - T0;
    stepDrops(dt, lab.t);

    // the token's light comes up under her, and stays as a soft pool until her own light takes over
    const glow = track(t, [[0, 0], [0.3, 1, 'out'], [1.4, 1], [1.9, 0.0, 'inOut']]);
    pool.material.color.copy(TOKEN).multiplyScalar(1.1 * glow);
    pool.scale.setScalar(2.6 + 0.5 * glow);

    // ----- Maya -----
    let sy = 1;
    let sxz = 1;
    let roll = 0;
    let pitch = 0;
    let rot = facing(1);
    let lift = 0;
    let side = 0;
    // stunned: dead still, then one drip off the nose, then a tiny shiver at the nose (the idea arriving)
    if (!dripped && t > 0.42) {
      dripped = true;
      launch(bodyPoint(0, 0.06, NOSE + 0.03), new THREE.Vector3(0, -0.2, 0), 0.03);
    }
    sy *= 1 - 0.03 * Math.sin(clamp01((t - 0.42) / 0.1) * Math.PI); // the drip lets go
    roll += 0.03 * Math.sin((t - 0.6) * 60) * track(t, [[0.6, 0], [0.64, 1], [0.7, 0]]);
    // anticipation: plants herself, low and wide
    const plant = track(t, [[0.68, 0], [SH0, 1, 'out'], [SH0 + 0.08, 0.3, 'out'], [SH1, 0, 'inOut']]);
    sy *= 1 - 0.14 * plant;
    sxz *= 1 + 0.07 * plant;
    // the shake: a fast roll that starts at her nose and runs back to her tail (yaw lags the roll)
    let shakeK = 0;
    if (t > SH0 && t < SH1 + 0.1) {
      const k = (t - SH0) / (SH1 - SH0);
      const env = Math.min(1, k / 0.12) * Math.max(0, 1 - Math.max(0, k - 0.45) / 0.65);
      const ph = (t - SH0) * FREQ * Math.PI * 2;
      roll += 0.55 * env * Math.sin(ph);
      rot += 0.36 * env * Math.sin(ph - 1.3) * (0.4 + 0.6 * k); // the tail catches up late
      side += 0.05 * env * Math.sin(ph - 0.6);
      pitch += 0.06 * env * Math.sin(ph * 2 + 0.5);
      lift += 0.025 * env * Math.abs(Math.sin(ph));
      sy *= 1 + 0.05 * env * Math.sin(ph * 2);
      shakeK = env;
    }
    // the coat comes off from the nose back, in step with the shake
    const cut = NOSE + (TAIL - NOSE) * track(t, [[SH0 + 0.02, 0], [SH1 - 0.06, 1, 'inOut']]);
    U.uCut.value = cut;
    coat.visible = cut < TAIL;
    // drops fly off where the coat is coming away, thrown sideways by the roll
    if (t > SH0 + 0.03 && t < SH1 - 0.04 && t >= nextDrop) {
      nextDrop = t + 0.014;
      const ph = (t - SH0) * FREQ * Math.PI * 2;
      const side = Math.cos(ph) >= 0 ? 1 : -1; // the way the top of her is swinging
      const lz = cut + lab.range(-0.04, 0.06);
      const from = bodyPoint(side * lab.range(0.18, 0.3), lab.range(0.1, 0.22), lz);
      const out = bodyDir(side, 0, 0);
      const fwd = bodyDir(0, 0, lz < -0.1 ? -1 : lz > 0.2 ? 1 : 0);
      const v = out.multiplyScalar(lab.range(1.3, 2.8) * (0.5 + shakeK)).addScaledVector(fwd, lab.range(0.3, 1.1));
      v.y = lab.range(1.1, 2.2);
      launch(from, v, lab.range(0.028, 0.06));
    }
    // one big drop goes Theo's way, mid-shake (he leaned in to look)
    if (!shotTheo && t > HIT - 0.4) {
      shotTheo = true;
      theo.model.body.updateWorldMatrix(true, true);
      const from = bodyPoint(0.2, 0.18, 0.05);
      const target = theo.model.body.localToWorld(splatOnTheo.position.clone());
      const T = 0.4;
      const v = target.clone().sub(from).divideScalar(T);
      v.y += 0.5 * G * T;
      launch(from, v, 0.045, (d) => {
        if (lab.t - T0 < HIT) return false;
        st.splat = true;
        return true;
      });
    }
    // her own light, last: the ring, then the eye opens (a slow blink: "...I'm fine")
    st.ring = track(t, [[1.42, 0], [1.58, 1, 'out']]);
    st.eye = t > 1.62 ? 1 : 0;
    st.eyeOpen = track(t, [[1.62, 0], [1.7, 0.5, 'out'], [1.74, 0.5], [1.78, 0.06, 'in'], [1.86, 1.15, 'out'], [1.96, 1, 'inOut']]);
    // the two drops that cling: still black when the coat is gone, then they blink grey twice and dry up
    st.clingShow = t > 1.2 && t < 2.35;
    st.cling = track(t, [[1.2, 1], [2.1, 1], [2.32, 0, 'in']]);
    st.clingGrey = Math.max(track(t, [[1.92, 0], [1.94, 1], [2.0, 1], [2.03, 0]]), track(t, [[2.1, 0], [2.12, 1], [2.18, 1], [2.24, 0.4]]));
    // she looks down at her flank (right side, toward us), unimpressed; a huff; chin back up
    rot += track(t, [[1.86, 0], [1.98, -0.42, 'out'], [2.22, -0.42], [2.36, 0, 'inOut']]);
    pitch += track(t, [[1.86, 0], [1.98, 0.14, 'out'], [2.22, 0.14], [2.36, -0.08, 'inOut'], [2.5, 0, 'inOut']]);
    sy *= 1 - 0.07 * track(t, [[2.2, 0], [2.26, 1, 'out'], [2.4, 0, 'inOut']]);
    maya.set({ y: 1 + side, sy, sx: sxz, sz: sxz, roll, pitch, rot, lift });

    // ----- Theo -----
    // leans in to see if she's all right (toward her, a little right of west)...
    let tRot = track(t, [[0.32, 0], [0.62, -0.3, 'inOut'], [HIT, -0.3]]);
    let tPitch = track(t, [[0.32, 0], [0.62, 0.12, 'inOut'], [HIT, 0.12]]);
    let tsy = 1;
    let tRoll = 0;
    // ...splat. A small recoil, then not a single movement (the deadpan)
    if (t >= HIT) {
      tPitch = 0.12 + track(t, [[HIT, 0], [HIT + 0.05, -0.2, 'out'], [HIT + 0.14, -0.12, 'inOut']]);
      tsy *= track(t, [[HIT, 1], [HIT + 0.05, 0.9, 'out'], [HIT + 0.14, 1, 'inOut']]);
    }
    st.theoEye = t < HIT ? 1 : 0.12;
    // the blob slides slowly down his face while he doesn't move a muscle
    splatOnTheo.position.y = 0.15 - 0.05 * clamp01((t - HIT - 0.2) / 0.6);
    splatOnTheo.scale.y = 0.11 + 0.03 * clamp01((t - HIT - 0.2) / 0.6);
    // the button: his own tiny shake, and the drop flies off
    const TS0 = 2.2;
    const TS1 = 2.46;
    if (t > TS0) {
      const k = clamp01((t - TS0) / (TS1 - TS0));
      tRoll += 0.3 * Math.sin(k * Math.PI * 2 * 3.5) * Math.sin(Math.PI * k);
      tRot += 0.08 * Math.sin(k * Math.PI * 2 * 3.5 - 1.2) * Math.sin(Math.PI * k);
      if (!theoShook && k > 0.35) {
        theoShook = true;
        st.splat = false;
        const p = theo.model.body.localToWorld(splatOnTheo.position.clone());
        for (let i = 0; i < 5; i++) launch(p, new THREE.Vector3(lab.range(-1.4, 0.4), lab.range(0.8, 1.5), lab.range(-0.9, 0.9)), lab.range(0.018, 0.03));
      }
      st.theoEye = theoShook ? 1 : 0.12;
      // and he settles back to the west, as if none of this happened
      tRot += track(t, [[TS0, 0], [2.7, 0.3, 'inOut']]);
      tPitch = track(t, [[TS0, 0], [TS0 + 0.1, 0.0], [2.7, 0, 'inOut']]) + (1 - clamp01((t - TS0) / 0.1)) * tPitch;
    }
    theo.set({ rot: theoRot + tRot, pitch: tPitch, roll: tRoll, sy: tsy, sx: 1 / Math.sqrt(tsy), sz: 1 / Math.sqrt(tsy) });
  };
  const stop = lab.every(update);
  update(0);
  await lab.wait(1.8);
  camRelease();
  await lab.wait(1.0);
  stop();

  // ---------- home ----------
  maya.each = null;
  theo.each = null;
  coat.visible = false;
  for (const c of cling) c.visible = false;
  splatOnTheo.visible = false;
  eye.scale.copy(eyeScale0);
  maya.set({ x: 3, y: 1, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: facing(1) });
  theo.set({ x: 5, y: 2, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: theoRot });
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
