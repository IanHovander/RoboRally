// Reboot, idea 17 "Shakes it off", animator a (weight & physical comedy).
// Maya is dumped back on the token like a sodden sack, still coated in the pit's darkness: she lands with a
// heavy, wet, bounceless flop, sags, and slowly oozes back up. A drip falls off her nose. She hunches... and
// shakes like a wet dog, the shake starting at her nose and travelling back along her body. The darkness flies
// off in glossy black drops that splat on the glass as little pits (each with the glass edge catching the light,
// like a real pit) and heal shut. Underneath, her polished red comes out from the nose back; then her ring,
// then, last, her eye. Two drops cling to her flank through it all; she gives them a last indignant twitch,
// they won't budge, they blink grey twice (the 2 SPAM) and fade.
export const meta = {
  title: 'Wet dog',
  idea: 'Maya is dumped on the token like a sodden sack, coated in the pit\'s darkness: a heavy, bounceless flop, a sag, a drip off her nose. Then she shakes like a wet dog, the shake rolling from her nose to her tail, and the darkness flies off in glossy black drops that splat on the glass as tiny pits and heal shut. Her red comes out from the nose back, then her ring, then her eye. Two drops cling to her flank; one last indignant twitch won\'t shift them, so they blink grey twice (her 2 SPAM) and fade.',
  notes: 'Sound: a wet "flump" (a muffled glass thud) on landing, a single drip "tik", then a fast rattling brrrrr of the shake with a patter of tiny glass ticks as the drops land, and a small bright chime when her eye comes on; two dull grey blips. Port: the darkness is a black shell on the robot\'s body cut away by a moving plane; the drops are a few dozen spheres and decals. The spatter is random each time.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const RED = new THREE.Color(lab.bot('a').color);
  const TOK = lab.pos(3, 1);
  const EAST = facing(1);
  const maya = lab.puppet('a');
  const model = maya.model;
  const BOT_SCALE = 1.3;

  // ---------- the coat of darkness: a black shell over her, cut away from the nose back ----------
  let pebble = null;
  let eyeMesh = null;
  model.body.traverse((o) => {
    if (o.isMesh && o.material === model.paint && !pebble) pebble = o;
    if (o.isMesh && o.material === model.eyeMat) eyeMesh = o;
  });
  lab.cleanup(() => eyeMesh && (eyeMesh.visible = true));
  const uFront = { value: -0.6 }; // local z of the cut: the nose is at -0.36, the tail at +0.36
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.55, metalness: 0.0 });
  coatMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFront = uFront;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vObj;\nvoid main() {\n  vObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uFront;\nvarying vec3 vObj;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vObj.z < uFront + 0.035 * sin(vObj.x * 38.0) + 0.02 * sin(vObj.y * 61.0)) discard;');
  };
  const coat = new THREE.Mesh(pebble.geometry, coatMat);
  coat.position.copy(pebble.position);
  coat.rotation.copy(pebble.rotation);
  coat.scale.copy(pebble.scale).multiplyScalar(1.045);
  coat.castShadow = true;
  model.body.add(coat);
  lab.cleanup(() => model.body.remove(coat));

  // two drops that cling to her right flank (toward the camera when she faces east)
  const clingMat = new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xaab2bf, emissiveIntensity: 0 });
  const clings = [
    [0.255, 0.15, -0.02, 0.06],
    [0.3, 0.12, 0.16, 0.052],
  ].map(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), clingMat);
    m.position.set(x, y, z);
    m.scale.set(0.7, 1, 1);
    model.body.add(m);
    return m;
  });
  lab.cleanup(() => clings.forEach((m) => model.body.remove(m)));

  // ---------- the glow of the token under her: the only thing she shows against ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.7, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const backMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(lab.PALETTE.reboot).multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), backMat);
  back.rotation.x = -Math.PI / 2;
  back.position.set(TOK.x, 0.005, TOK.z);
  back.renderOrder = 2;
  lab.add(back);

  // ---------- flung drops and the little pits they leave ----------
  const dropGeo = new THREE.SphereGeometry(1, 12, 8);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.15, metalness: 0.1 });
  // splat shapes: an irregular blob with a few satellite flecks, drawn once; and its faint lit edge
  const splatTex = [0, 1, 2, 3].map(() => {
    const blob = [];
    const n = 9;
    for (let i = 0; i < n; i++) blob.push(0.62 + lab.range(-0.14, 0.16));
    const flecks = [0, 1, 2].map(() => ({ a: lab.range(-0.9, 0.9), d: lab.range(0.8, 0.95), r: lab.range(0.05, 0.1) }));
    const draw = (stroke) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.translate(64, 64);
      g.scale(60, 60);
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const r0 = blob[i % n];
        if (i === 0) g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        else g.quadraticCurveTo(Math.cos(a0 - 0.35) * r0 * 1.04, Math.sin(a0 - 0.35) * r0 * 1.04, Math.cos(a0) * r0, Math.sin(a0) * r0);
      }
      g.closePath();
      for (const f of flecks) {
        g.moveTo(Math.cos(f.a) * f.d + f.r, Math.sin(f.a) * f.d);
        g.arc(Math.cos(f.a) * f.d, Math.sin(f.a) * f.d, f.r, 0, Math.PI * 2);
      }
      if (stroke) {
        g.strokeStyle = '#fff';
        g.lineWidth = 0.07;
        g.stroke();
      } else {
        g.fillStyle = '#fff';
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return { fill: draw(false), edge: draw(true) };
  });
  const spotGeo = new THREE.PlaneGeometry(2, 2);
  const drops = [];
  const spots = [];
  const G = 9.8;
  const fling = (from, vel, r) => {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.copy(from);
    m.scale.setScalar(r);
    m.castShadow = true;
    lab.add(m);
    drops.push({ m, v: vel.clone(), r });
  };
  const splat = (at, r, vel) => {
    const g = new THREE.Group();
    const tx = splatTex[Math.floor(lab.rand() * splatTex.length)];
    const black = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tx.fill, transparent: true, opacity: 0.95, depthWrite: false }));
    const rim = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(lab.PALETTE.light).multiplyScalar(0.6), map: tx.edge, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    black.renderOrder = 6;
    rim.renderOrder = 7;
    g.add(black, rim);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(-vel.z, vel.x);
    g.rotation.x = -Math.PI / 2;
    g.position.set(at.x, 0.01, at.z);
    lab.add(g);
    const stretch = 1 + Math.min(0.8, Math.hypot(vel.x, vel.z) * 0.25);
    spots.push({ g, black, rim, r: r * 2.2, stretch, t0: lab.t, life: lab.range(0.45, 0.8) });
  };
  const stopPhysics = lab.every((dt, t) => {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.v.y -= G * dt;
      d.m.position.addScaledVector(d.v, dt);
      // stretched along its flight
      const sp = d.v.length();
      d.m.scale.set(d.r, d.r, d.r * (1 + Math.min(1.4, sp * 0.18)));
      d.m.lookAt(d.m.position.clone().add(d.v));
      if (d.m.position.y <= d.r * 0.5) {
        lab.scene.remove(d.m);
        d.m.parent?.remove(d.m);
        drops.splice(i, 1);
        if (Math.abs(d.m.position.x) < 3.45 && Math.abs(d.m.position.z) < 1.95) splat(d.m.position, d.r, d.v);
      }
    }
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      const a = t - s.t0;
      // splat out fast, then heal shut from the rim inward
      const out = ease.outBack(Math.min(1, a / 0.08));
      const heal = Math.max(0, (a - s.life * 0.35) / (s.life * 0.65));
      const k = out * (1 - ease.in(Math.min(1, heal)));
      s.g.scale.set(s.r * k * s.stretch, s.r * k, 1);
      s.rim.material.opacity = 0.3 * Math.min(1, a / 0.05) * (1 - heal * 0.5);
      if (heal >= 1) {
        s.g.parent?.remove(s.g);
        spots.splice(i, 1);
      }
    }
  });
  // a point on her body in world space (local coords in the model's frame)
  const worldOf = (lx, ly, lz) => model.body.localToWorld(new THREE.Vector3(lx, ly, lz));
  const dirOf = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).transformDirection(maya.group.matrixWorld);

  // ---------- her state ----------
  let ring = 0;
  let eye = 0;
  let grey = 0;
  let clingK = 1;
  const tagBase = maya.bot.tag ? maya.bot.tag.scale.clone() : null;
  maya.set({ x: 3, y: 1, rot: EAST, visible: true, trail: false, lift: 0.75, sy: 1.12, sx: 0.94, sz: 0.94 });
  maya.each = (m) => {
    const q = maya.pose;
    m.ringMat.opacity = 0.9 * ring;
    m.poolMat.opacity = 0.75 * ring;
    m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
    if (eyeMesh) eyeMesh.visible = eye > 0.02;
    m.paint.emissive.copy(RED);
    m.paint.emissiveIntensity = 0.16;
    clingMat.emissiveIntensity = 3.5 * grey;
    for (const c of clings) c.visible = clingK > 0.01;
    if (maya.bot.tag) {
      maya.bot.tag.visible = ring > 0.5;
      if (tagBase) maya.bot.tag.scale.set(tagBase.x / q.sx, tagBase.y / q.sy, 1);
    }
  };
  coat.updateMatrixWorld();

  // ---------- 1. dumped on the token: a heavy, wet, bounceless flop ----------
  await lab.tween(0.2, (e) => {
    maya.set({ lift: 0.75 * (1 - e) });
    backMat.opacity = e;
  }, ease.in);
  // splash: a few drops squirt out sideways on impact
  maya.set({ lift: 0, sy: 0.6, sx: 1.24, sz: 1.24 });
  maya.group.updateMatrixWorld(true);
  for (let i = 0; i < 7; i++) {
    const a = lab.range(0, Math.PI * 2);
    const sp = lab.range(0.9, 1.6);
    fling(worldOf(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3), new THREE.Vector3(Math.cos(a) * sp, lab.range(0.6, 1.2), Math.sin(a) * sp), lab.range(0.018, 0.03));
  }
  // she sags, then slowly oozes back up, sodden (no spring in her at all)
  await lab.tween(0.26, (e, k) => {
    const sy = 0.6 + 0.36 * e;
    maya.set({ sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) });
  }, ease.inOut);

  // ---------- 2. the hold: a drip forms under her nose and falls off ----------
  const drip = new THREE.Mesh(dropGeo, dropMat);
  drip.scale.setScalar(0.001);
  lab.add(drip);
  await lab.tween(0.22, (e, k) => {
    const nose = worldOf(0, 0.1, -0.33);
    const grow = Math.min(1, k / 0.75);
    const r = 0.028 * grow;
    const hang = 0.02 + 0.05 * ease.in(grow);
    drip.position.set(nose.x, Math.max(0.01, nose.y - hang), nose.z);
    drip.scale.set(r, r * (1 + grow * 0.9), r);
    // a sad little sag as it gathers
    const sy = 0.96 - 0.04 * Math.sin(k * Math.PI);
    maya.set({ sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy), pitch: 0.06 * Math.sin(k * Math.PI) });
  }, ease.linear);
  // it lets go
  {
    const v = new THREE.Vector3(0.15, 0, 0);
    const at = drip.position.clone();
    drip.parent?.remove(drip);
    fling(at, v, 0.026);
  }
  await lab.wait(0.06);

  // ---------- 3. the shake: it starts at the nose and travels back along her body ----------
  // anticipation: a hunch and a slow wind-up roll the other way
  await lab.tween(0.12, (e) => {
    maya.set({ sy: 0.96 - 0.08 * e, sx: 1.04 + 0.04 * e, sz: 1.04 + 0.04 * e, roll: -0.12 * e, pitch: 0.06 * (1 - e) });
  }, ease.out);
  const tS = lab.t;
  const SHAKE = 0.56;
  const F = 8.2; // shakes per second
  let lastFlingK = -1;
  await lab.tween(SHAKE, (e, k) => {
    const a = lab.t - tS;
    // the envelope: it builds very fast and dies away
    const env = Math.min(1, k / 0.12) * (1 - ease.in(Math.max(0, (k - 0.45) / 0.55)));
    const ph = a * F * Math.PI * 2;
    // the nose leads; the tail follows a quarter-shake behind: roll from the front, yaw wag from the back
    const roll = -0.12 * (1 - Math.min(1, k * 8)) + 0.66 * env * Math.sin(ph);
    const wag = 0.32 * env * Math.sin(ph - 1.3) * Math.min(1, k * 3);
    const hop = 0.035 * env * Math.abs(Math.sin(ph));
    const sy = 0.88 + 0.12 * Math.min(1, k * 4) + 0.04 * env * Math.sin(ph * 2);
    // the body swings side to side under the roll (her sides are north and south when she faces east)
    const sway = 0.05 * env * Math.sin(ph - 0.5);
    maya.set({ y: 1 + sway, roll, rot: EAST + wag, lift: hop, sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy), pitch: 0.05 * env * Math.sin(ph * 2 + 0.6) });
    // the darkness comes off from the nose back, a bit behind the wave
    uFront.value = -0.6 + 1.05 * ease.inOut(Math.min(1, Math.max(0, (k - 0.08) / 0.8)));
    // drops fly off where the coat is coming away, at each extreme of the roll
    const half = Math.floor(a * F * 2);
    if (half !== lastFlingK && env > 0.25 && uFront.value < 0.42) {
      lastFlingK = half;
      maya.group.updateMatrixWorld(true);
      const side = Math.sin(ph) > 0 ? 1 : -1;
      const n = Math.round(4 + 5 * env);
      for (let i = 0; i < n; i++) {
        const lz = Math.min(0.32, Math.max(-0.32, uFront.value + lab.range(-0.06, 0.12)));
        const lx = side * -0.24 * lab.range(0.8, 1.1);
        const from = worldOf(lx, lab.range(0.1, 0.22), lz);
        const out = dirOf(-side, 0, 0).multiplyScalar(lab.range(1.4, 2.6) * env);
        out.y = lab.range(1.0, 2.2);
        // a bit of the travel along her body, too
        out.add(dirOf(0, 0, 1).multiplyScalar(lab.range(-0.3, 0.6)));
        fling(from, out, lab.range(0.022, 0.045));
      }
    }
  }, ease.linear);
  uFront.value = 0.6;
  coat.visible = false;

  // ---------- 4. settle, ring, then the eye; the two clingers ----------
  const tE = lab.t;
  const stopSettle = lab.every((dt, t) => {
    const a = t - tE;
    const w = Math.exp(-a * 7) * Math.sin(a * 22);
    maya.set({ y: 1, roll: 0.1 * w, rot: EAST - 0.06 * w, lift: 0, pitch: 0, sy: 1 + 0.03 * w, sx: 1 - 0.015 * w, sz: 1 - 0.015 * w });
  });
  lab.tween(0.18, (e) => (ring = e), ease.out);
  // the token's glow lingers while the spatter heals, then goes
  lab.tween(0.7, (e) => (backMat.opacity = 1 - e), ease.inOut);
  await lab.wait(0.14);
  // the eye comes on last: a sleepy flick, then awake
  await lab.tween(0.18, (e, k) => {
    eye = k < 0.3 ? k / 0.3 : k < 0.5 ? 0.15 : 1;
  }, ease.linear);
  eye = 1;
  stopSettle();
  // one indignant twitch at the clingers: they don't budge
  const tT = lab.t;
  await lab.tween(0.16, () => {
    const a = lab.t - tT;
    maya.set({ roll: -0.2 * Math.exp(-a * 14) * Math.sin(a * 48), rot: EAST, sy: 1, sx: 1, sz: 1 });
  }, ease.linear);
  maya.set({ roll: 0 });
  // they blink grey twice and fade
  await lab.tween(0.46, (e, k) => {
    grey = k < 0.22 ? Math.sin((k / 0.22) * Math.PI) : k < 0.44 ? Math.sin(((k - 0.22) / 0.22) * Math.PI) : Math.max(0, 1 - (k - 0.44) / 0.3) * 0.6;
    const fade = Math.max(0, (k - 0.5) / 0.5);
    clingK = 1 - fade;
    for (const c of clings) c.scale.set(0.7 * clingK, clingK, clingK);
  }, ease.linear);
  clingK = 0;
  grey = 0;
  stopPhysics();
  for (const s of spots) s.g.parent?.remove(s.g);
  for (const d of drops) d.m.parent?.remove(d.m);
  maya.each = null;
  if (eyeMesh) eyeMesh.visible = true;
  model.body.remove(coat);
  clings.forEach((m) => model.body.remove(m));
  maya.release({ x: 3, y: 1, d: 1, on: true });
}
