// The only light in the room, staged like a blackout in a theatre: the house lights go out in a breath, the
// camera rises a little to look down on the glass like a floor plan, and the beam's racing head sweeps every
// shadow across the board like headlights across a ceiling. The hit lands on Maya's shadow, which tears.
export const meta = {
  title: 'The only light in the room (blackout)',
  idea: 'As Theo fires, the house lights go out in a breath and the darkness closes in like an iris: the beam is the only light left. Its bright head races down the row and every shadow swings with it, like headlights sweeping a dark room: Jun\'s shadow sweeps across the front of the board, Theo\'s is thrown behind him, Maya\'s is flung long and thin off the end of the slab. At the hit her shadow tears and the picture holds for a heartbeat on the rip, while she stands perfectly still. Then the beam lets go, the lights rise like a sunrise, and the shadows shrink back under their robots.',
  notes: 'Sound: the room hum cuts out on the blackout (a soft glass "thup"), the beam is a thin cold whistle, the tear is a short dry rip with everything else silent, and the lights come back on a slow rising chord. Port: the lit glass and the shadows are one shader on a plane (a moving point light at the beam\'s head plus a line light along it, robots as round occluders), so it needs no shadow maps; one real point light at the head rims the robots. Several beams at once just add their lights, and the shadows cross.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const pups = [maya, theo, jun];

  // ----- the room's lights, saved so they come back exactly -----
  const scene = lab.scene;
  const saved = {
    key: A.key.intensity,
    hemi: A.hemi.intensity,
    env: scene.environmentIntensity,
    bg: scene.backgroundIntensity ?? 1,
    motes: A.motes.material.opacity,
    spill: A.spill.material.opacity,
  };
  const edges = [];
  A.board.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m !== A.topMat && m.emissiveIntensity != null && m.emissiveIntensity > 0 && !edges.some((e) => e[0] === m)) edges.push([m, m.emissiveIntensity]);
    }
  });
  let dark = 0; // 0 = the room as it is, 1 = blackout
  const applyRoom = () => {
    const lit = 1 - dark;
    A.key.intensity = saved.key * lit;
    A.hemi.intensity = saved.hemi * lit;
    scene.environmentIntensity = saved.env * lit;
    scene.backgroundIntensity = saved.bg * (1 - 0.9 * dark);
    A.motes.material.opacity = saved.motes * lit;
    A.spill.material.opacity = saved.spill * lit;
    for (const [m, v] of edges) m.emissiveIntensity = v * lit;
    if (dark > 0) A.topMat.emissiveIntensity *= lit;
  };
  const restoreRoom = () => {
    dark = 0;
    applyRoom();
  };
  lab.cleanup(restoreRoom);
  for (const p of pups) {
    p.each = (m) => {
      const lit = 1 - dark;
      m.ringMat.opacity *= lit;
      m.poolMat.opacity *= lit;
      m.eyeMat.color.multiplyScalar(1 - 0.94 * dark);
      m.paint.emissiveIntensity *= lit;
      if (p.bot.tag) p.bot.tag.material.opacity = lit;
    };
  }
  const roomHook = lab.every(applyRoom);

  // ----- the iris: the dark closing in from the edges -----
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  const setIris = (k) => {
    const r = 95 - 38 * k;
    iris.style.opacity = String(Math.min(1, k * 1.2));
    iris.style.background = `radial-gradient(ellipse ${r}% ${r * 1.1}% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,.82) 100%)`;
  };

  // ----- the geometry of the shot -----
  theo.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const Z = lab.pos(1, 1).z;
  const X0 = muzzle.x;
  const XF = lab.pos(1, 1).x + 0.44;
  const YB = 0.16;
  const COLD = new THREE.Color(0.78, 0.9, 1.0);

  // ----- the lit glass and its shadows: one shader on a plane over the board -----
  const occ = [
    { p: maya, r: 0.33, h: 0.34 },
    { p: theo, r: 0.3, h: 0.52 },
    { p: jun, r: 0.29, h: 0.46 },
  ];
  const uni = {
    uHead: { value: new THREE.Vector2(X0, Z) },
    uHeadI: { value: 0 },
    uLineI: { value: 0 },
    uX0: { value: X0 },
    uX1: { value: X0 },
    uZ: { value: Z },
    uOcc: { value: occ.map(() => new THREE.Vector3()) },
    uOccH: { value: occ.map((o) => o.h) },
    uLightH: { value: YB },
    uTear: { value: new THREE.Vector2() },
    uColor: { value: COLD.clone() },
  };
  const lightMat = new THREE.ShaderMaterial({
    uniforms: uni,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec2 uHead; uniform float uHeadI; uniform float uLineI; uniform float uX0; uniform float uX1; uniform float uZ;
      uniform vec3 uOcc[3]; uniform float uOccH[3]; uniform float uLightH; uniform vec2 uTear; uniform vec3 uColor;
      varying vec2 vXZ;
      float vis(vec2 p, vec2 L) {
        float v = 1.0;
        for (int i = 0; i < 3; i++) {
          vec2 c = uOcc[i].xy; float r = uOcc[i].z;
          if (i == 0) {
            // Maya's shadow can tear: beyond a point the far part is thrown sideways
            float along = dot(p - c, normalize(c - L + vec2(1e-4)));
            c += uTear * smoothstep(0.42, 0.5, along);
          }
          vec2 d = L - p;
          float t = clamp(dot(c - p, d) / max(dot(d, d), 1e-5), 0.0, 1.0);
          float dist = length(p + d * t - c);
          float blocked = 1.0 - smoothstep(r - 0.035, r + 0.035, dist);
          float dl = length(c - L);
          float h = uOccH[i];
          float tip = uLightH > h + 0.01 ? dl * uLightH / (uLightH - h) : 1e4;
          float within = 1.0 - smoothstep(tip - 0.12, tip + 0.12, length(p - L));
          v *= 1.0 - blocked * within;
        }
        return v;
      }
      float fall(float d, float a) { return 1.0 / (1.0 + (d * d) / (a * a)); }
      void main() {
        vec2 p = vXZ;
        float I = 0.0;
        if (uHeadI > 0.0) I += uHeadI * vis(p, uHead) * fall(length(p - uHead), 0.85);
        if (uLineI > 0.0) {
          float s = 0.0;
          for (int k = 0; k < 14; k++) {
            float f = (float(k) + 0.5) / 14.0;
            vec2 L = vec2(mix(uX1, uX0, f), uZ);
            s += vis(p, L) * fall(length(p - L), 1.25);
          }
          I += uLineI * s / 14.0;
        }
        gl_FragColor = vec4(uColor * I, 1.0);
      }`,
  });
  const c = A.course;
  const plane = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), lightMat));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.009;
  plane.renderOrder = 3;
  const syncOcc = () => {
    occ.forEach((o, i) => {
      const g = o.p.group.position;
      uni.uOcc.value[i].set(g.x, g.z, o.r);
    });
  };
  syncOcc();

  // a real light at the head, so the robots catch the beam on their faces
  const rim = new THREE.PointLight(0xd8ecff, 0, 0, 2);
  rim.position.set(X0, 0.24, Z);
  lab.add(rim);

  // ----- the beam itself -----
  const mkBeam = (r, color, op) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.z = Math.PI / 2;
    return lab.add(m);
  };
  const beamCore = mkBeam(0.011, new THREE.Color(3.4, 3.6, 4), 1);
  const beamGlow = mkBeam(0.034, new THREE.Color(0.5, 1.1, 2.2), 0.5);
  const headDot = lab.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.4, 6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const setBeam = (x1, op) => {
    const len = Math.max(0.001, X0 - x1);
    for (const m of [beamCore, beamGlow]) {
      m.scale.set(1, len, 1);
      m.position.set((X0 + x1) / 2, YB, Z);
      m.visible = op > 0.001;
    }
    beamCore.material.opacity = op;
    beamGlow.material.opacity = 0.5 * op;
    headDot.position.set(x1, YB, Z);
    headDot.material.opacity = op;
    headDot.visible = op > 0.001;
  };
  setBeam(X0, 0);

  // ----- camera: rises a little to look down on the light, eases home as the lights return -----
  const releaseCam = lab.camera((home) => ({
    dist: home.dist * (1 - 0.07 * dark),
    el: home.el + 0.11 * dark,
    target: home.target.clone().add(new THREE.Vector3(0, 0, -0.25 * dark)),
  }));

  // ----- Theo draws breath: his eye brightens -----
  const theoEye = { k: 0 };
  const theoEach = theo.each;
  theo.each = (m, t) => {
    theoEach(m, t);
    m.eyeMat.color.setRGB(3.2 + theoEye.k * 4, 3.1 + theoEye.k * 4.4, 2.9 + theoEye.k * 5);
  };
  await lab.tween(0.1, (e) => (theoEye.k = e), ease.in);

  // ----- fire, and the house lights go out in a breath -----
  lab.tween(0.2, (e) => {
    dark = e;
    setIris(e);
  }, ease.inOut);
  lab.tween(0.15, (e) => (theoEye.k = 1 - e), ease.out);
  const V = 6.6;
  let hx = X0;
  const race = lab.tween((X0 - XF) / V, (e) => {
    hx = X0 - (X0 - XF) * e;
    setBeam(hx, 1);
    uni.uHead.value.set(hx, Z);
    uni.uX1.value = hx;
    uni.uHeadI.value = 2.3 * Math.min(1, e * 6);
    uni.uLineI.value = 0.9 * Math.min(1, e * 4);
    rim.position.x = hx;
    rim.intensity = 2.2 * Math.min(1, e * 5);
  }, ease.linear);
  // the beam flickers a little, so the shadows tremble
  const flicker = lab.every((dt, t) => {
    const f = 1 + 0.05 * Math.sin(t * 83) * Math.sin(t * 31);
    uni.uColor.value.copy(COLD).multiplyScalar(f);
  });
  await race;

  // ----- the hit lands on her shadow: it tears, and the picture holds on the rip -----
  lab.ring(lab.pos(1, 1).setY(0.02).add(new THREE.Vector3(0.44, 0, 0)), '#cfe6ff', 0.25, 0.16, 0.25);
  await lab.tween(0.04, (e) => uni.uTear.value.set(0, -0.3 * e), ease.out);
  lab.timeScale = 0.03;
  await lab.waitReal(0.12);
  lab.timeScale = 1;
  await lab.tween(0.32, (e, k) => {
    const back = Math.exp(-k * 6) * Math.cos(k * 15);
    uni.uTear.value.set(0, -0.3 * back);
  }, ease.linear);
  uni.uTear.value.set(0, 0);
  await lab.wait(0.12);

  // ----- the beam lets go; the lights rise like a sunrise and the shadows shrink back under their robots -----
  const fade = lab.tween(0.42, (e) => {
    setBeam(XF, 1 - e);
    uni.uHeadI.value = 2.3 * (1 - e) * (1 - e);
    uni.uLineI.value = 0.9 * (1 - e);
    uni.uLightH.value = YB + 4 * ease.in(e);
    rim.intensity = 2.2 * (1 - e);
  }, ease.out);
  await lab.tween(0.5, (e) => {
    dark = 1 - e;
    setIris(1 - e);
  }, ease.inOut);
  await fade;
  flicker();
  plane.visible = false;
  rim.intensity = 0;
  roomHook();
  restoreRoom();
  iris.remove();
  for (const p of pups) {
    p.each = null;
    if (p.bot.tag) p.bot.tag.material.opacity = 1;
  }
  releaseCam();
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
  jun.release({ x: 3, y: 3, d: 0 });
}
