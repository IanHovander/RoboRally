// The only light in the room, through weight and physical comedy: Theo's shot draws all the power. The
// room's lights sag, flicker and drop out like a tripped breaker, and the beam is the only light left: it
// rakes the glass cold blue-white and every robot throws a long shadow off the slab. The hit lands on
// Maya's shadow, not on her: it's torn off her heels and knocked away like a rug yanked from under her,
// skidding and twisting toward the edge while she stands perfectly still. When the power comes back the
// shadows reel in like tape measures, and hers, flying back from far away, snaps into her heels with a
// clack that jolts her.
export const meta = {
  title: 'The only light (shadow with weight)',
  idea: 'Theo\'s shot draws all the power: the room\'s light sags and drops out like a tripped breaker, and the beam lights the glass alone, throwing long shadows off the slab. The hit lands on Maya\'s shadow: it\'s torn off her heels and knocked skidding toward the edge while she stands still. When the power comes back the shadows reel in like tape measures, and hers snaps back into her heels with a clack that jolts her.',
  notes: 'Sound: a soft electrical sag (a falling chime) as the lights drop, the beam\'s cold hum, a dry paper rip at the hit (the only sound that lands, on the shadow), silence, then a quick rising zip of tape measures reeling in and one glassy clack as hers hits home. Shadows are computed from the beam as a line light against each robot\'s footprint, so they fall from wherever everyone stands; several shots at once would cross their shadows. The room\'s lights are multiplied down each frame and come back exactly as they were.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const COLD = '#a8c8ff';
  const theoColor = lab.bot('b').color;
  const coldColor = new THREE.Color(COLD);

  // ---------- the robots: Maya stands still, Theo braces against the shot ----------
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false, rot: facing(2) });
  theo.set({ trail: false, rot: facing(3) });
  const mayaPos = lab.pos(1, 1);
  const theoPos = lab.pos(5, 1);
  const junPos = lab.pos(3, 3);

  // ---------- the room's lights, multiplied down every frame (after the game sets them) ----------
  const light = { dark: 0, mayaOn: 0, mayaPop: 0 };
  const saved = { hemi: arena.hemi.intensity, key: arena.key.intensity, motes: arena.motes.material.opacity, spill: arena.spill.material.opacity };
  const edgeMats = new Map();
  arena.board.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) if (m.emissive && m !== arena.topMat && !edgeMats.has(m)) edgeMats.set(m, m.emissiveIntensity);
  });
  const restore = () => {
    arena.hemi.intensity = saved.hemi;
    arena.key.intensity = saved.key;
    arena.motes.material.opacity = saved.motes;
    arena.spill.material.opacity = saved.spill;
    for (const [m, v] of edgeMats) m.emissiveIntensity = v;
  };
  lab.cleanup(restore);
  const stopLights = lab.every(() => {
    const lit = 1 - light.dark;
    arena.hemi.intensity = saved.hemi * lit;
    arena.key.intensity = saved.key * lit;
    arena.motes.material.opacity = saved.motes * lit;
    arena.spill.material.opacity = saved.spill * lit;
    arena.topMat.emissiveIntensity *= lit; // the game set it this frame
    for (const [m, v] of edgeMats) m.emissiveIntensity = v * lit;
    for (const key of ['a', 'b', 'c']) {
      const b = lab.bot(key);
      const m = b.model;
      const r = key === 'a' ? Math.max(lit, light.mayaOn) : Math.max(lit, 0);
      m.ringMat.opacity *= r;
      m.poolMat.opacity *= r;
      // the beam's cold light catches every robot's polish
      const cold = shot.power * clamp01(shot.reach * 3);
      m.paint.emissive.lerp(coldColor, Math.min(1, cold));
      m.paint.emissiveIntensity = m.paint.emissiveIntensity * lit + 0.22 * cold * (key === 'c' ? 0.8 : 1);
      m.eyeMat.color.multiplyScalar(0.08 + 0.92 * (key === 'a' ? Math.max(lit, light.mayaOn) * (1 + 1.5 * light.mayaPop) : lit));
      if (b.tag) b.tag.material.opacity *= 0.25 + 0.75 * lit;
    }
  });

  // ---------- the beam's light on the glass: a line light, with soft shadows of every robot ----------
  const W = arena.course.w;
  const H = arena.course.h;
  const occ = [new THREE.Vector3(mayaPos.x, mayaPos.z, 0.33), new THREE.Vector3(theoPos.x, theoPos.z, 0.3), new THREE.Vector3(junPos.x, junPos.z, 0.29)];
  const glassMat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Vector2() },
      uB: { value: new THREE.Vector2() },
      uI: { value: 0 },
      uColor: { value: new THREE.Color(COLD) },
      uOcc: { value: occ },
      uLen: { value: [9, 9, 9] },
      uMaya: { value: new THREE.Vector3(0, 0, 0) }, // her shadow's displacement (x, z) and twist
    },
    vertexShader: 'varying vec2 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform vec2 uA; uniform vec2 uB; uniform float uI; uniform vec3 uColor;
      uniform vec3 uOcc[3]; uniform float uLen[3]; uniform vec3 uMaya;
      varying vec2 vP;
      vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
      float occ(vec2 s, vec2 p, vec2 c, float r, float len) {
        vec2 d = p - s;
        float dd = max(dot(d, d), 1e-6);
        float t = dot(c - s, d) / dd;
        if (t <= 0.0) return 0.0;
        vec2 q = s + d * min(t, 1.0);
        float m = length(q - c);
        float o = 1.0 - smoothstep(r - 0.05, r + 0.05, m);
        float beyond = max(0.0, 1.0 - t) * sqrt(dd); // how far past the robot p lies
        return o * (1.0 - smoothstep(len - 0.25, len, beyond));
      }
      void main() {
        float sum = 0.0;
        for (int i = 0; i < 24; i++) {
          float f = (float(i) + 0.5) / 24.0;
          vec2 s = mix(uA, uB, f);
          vec2 d = vP - s;
          float I = 1.0 / (1.0 + dot(d, d) * 1.5);
          float v = 1.0;
          v *= 1.0 - occ(s, vP, uOcc[1].xy, uOcc[1].z, uLen[1]);
          v *= 1.0 - occ(s, vP, uOcc[2].xy, uOcc[2].z, uLen[2]);
          vec2 c = uOcc[0].xy;
          vec2 sp = c + rot(s - uMaya.xy - c, -uMaya.z);
          vec2 pp = c + rot(vP - uMaya.xy - c, -uMaya.z);
          v *= 1.0 - occ(sp, pp, c, uOcc[0].z, uLen[0]);
          sum += I * v;
        }
        float L = sum / 24.0;
        // the line of light right under the beam
        vec2 ab = uB - uA;
        float h = clamp(dot(vP - uA, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
        float dl = length(vP - uA - ab * h);
        L += 0.9 * exp(-dl * dl * 50.0);
        gl_FragColor = vec4(uColor * L * uI, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glass = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassMat));
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.005;
  glass.renderOrder = 3;

  // the beam itself: a cold core in a sheath of Theo's blue
  const beam = new THREE.Group();
  const sheathMat = new THREE.MeshBasicMaterial({ color: hdr(theoColor, 1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: hdr(COLD, 3), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12, 1, true), sheathMat);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1, true), coreMat);
  sheath.rotation.z = core.rotation.z = Math.PI / 2;
  beam.add(sheath, core);
  beam.visible = false;
  lab.add(beam);
  const glowTex = lab.bot('a').model.poolMat.map;
  const headMat = new THREE.SpriteMaterial({ map: glowTex, color: hdr(COLD, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const head = lab.add(new THREE.Sprite(headMat));
  head.scale.setScalar(0.4);
  head.visible = false;


  // ---------- the shot's state ----------
  const theoMuzzle = () => {
    theo.model.muzzle.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  };
  const FLANK = mayaPos.x + 0.37;
  const shot = { reach: 0, power: 0 };
  const tvec = new THREE.Vector3();
  lab.every(() => {
    const m = theoMuzzle();
    const hx = m.x + (FLANK - m.x) * shot.reach;
    const on = shot.reach > 0 && shot.power > 0.001;
    beam.visible = head.visible = on;
    glassMat.uniforms.uA.value.set(m.x, m.z);
    glassMat.uniforms.uB.value.set(hx, m.z);
    glassMat.uniforms.uI.value = 0.95 * shot.power * clamp01(shot.reach * 4);
    if (on) {
      const len = Math.max(0.01, m.x - hx);
      beam.position.set((m.x + hx) / 2, m.y, m.z);
      beam.scale.set(len, 1, 1);
      sheath.scale.set(1, 1, 1);
      sheathMat.opacity = 0.5 * shot.power;
      coreMat.opacity = shot.power;
      head.position.set(hx, m.y, m.z);
      headMat.opacity = shot.power;
      head.scale.setScalar(0.42 + 0.05 * Math.sin(lab.t * 50));
    }
    void tvec;
  });

  // Maya never moves at the hit; she only jolts when her shadow slaps home
  const mayaJolt = { k: 0 };
  const mayaRing = maya.group.children.find((o) => o.material === maya.model.ringMat && o.geometry.type === 'RingGeometry');
  maya.each = () => {
    const j = mayaJolt.k;
    if (mayaRing) mayaRing.scale.setScalar(1 + 0.35 * light.mayaPop);
    maya.set({ x: 1, y: 1, rot: facing(2), sy: 1 - 0.12 * j, sx: 1 + 0.06 * j, sz: 1 + 0.06 * j, lift: 0.04 * Math.max(0, -j) });
  };
  // Theo: braces, recoils with the shot's kick, and leans into it while it pours
  const theoS = { brace: 0, kick: 0 };
  theo.each = () => {
    theo.set({ x: 5 + 0.1 * theoS.kick, y: 1, rot: facing(3), pitch: -0.12 * theoS.brace - 0.25 * theoS.kick, sy: 1 - 0.08 * theoS.brace });
  };

  // the tear: a seam of light where her shadow is ripped from her heel
  const seam = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(COLD, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  seam.rotation.x = -Math.PI / 2;
  seam.position.set(mayaPos.x - 0.42, 0.008, mayaPos.z);
  seam.renderOrder = 4;

  // ---------- the beats ----------
  // Theo plants himself
  await lab.tween(0.12, (e) => (theoS.brace = e), ease.out);
  // fire: the head races down the row while the room's power sags and drops out
  lab.arena.emit('laser', { hit: true, src: 'b' });
  shot.power = 1;
  lab.tween(0.22, (e, k) => {
    theoS.brace = 1 - e;
    theoS.kick = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.5);
  }, ease.out);
  // the breaker: a sag, a flicker back, then out
  lab.tween(0.24, (e, k) => {
    light.dark = k < 0.3 ? 0.65 * (k / 0.3) : k < 0.45 ? 0.65 - 0.3 * ((k - 0.3) / 0.15) : 0.35 + 0.65 * ease.out((k - 0.45) / 0.55);
  }, ease.linear);
  await lab.tween(0.17, (e) => (shot.reach = e), ease.in);
  // the hit lands on her shadow: ripped off her heel and knocked skidding west, twisting
  lab.arena.emit('damage', { id: 'a', n: 1 });
  const U = glassMat.uniforms.uMaya.value;
  lab.shake(0.012, 0.15);
  lab.tween(0.3, (e, k) => {
    seam.material.opacity = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85) ** 2;
    seam.scale.set(0.35 + 0.5 * e, 0.9 + 0.3 * e, 1);
  }, ease.out);
  await lab.tween(0.08, (e) => U.set(-0.75 * e, 0.03 * e, 0.2 * e), ease.out3);
  // it skids on to the very edge of the slab and teeters there (it has momentum; she doesn't move)
  await lab.tween(0.4, (e, k) => {
    const wob = Math.sin(k * Math.PI * 3) * (1 - k) ** 1.4;
    U.set(-0.75 - 0.32 * e + 0.04 * wob, 0.03 + 0.05 * e, 0.2 - 0.08 * e + 0.12 * wob);
    theoS.kick = 0;
  }, ease.out);
  // reel in: every shadow retracts like a tape measure, and hers is yanked home from the edge
  const lenFrom = 9;
  const mayaFrom = U.clone();
  await lab.tween(0.24, (e) => {
    const len = lenFrom * (1 - e);
    glassMat.uniforms.uLen.value = [Math.max(lenFrom * (1 - ease.in(e)), 0.6), len, len];
    U.set(mayaFrom.x * (1 - e), mayaFrom.y * (1 - e), mayaFrom.z * (1 - e) + Math.sin(e * Math.PI) * 0.3);
  }, ease.in3);
  // clack: it slaps into her heel, jolts her, and her own light comes back on with it
  lab.arena.emit('bump', { id: 'a' });
  U.set(0, 0, 0);
  glassMat.uniforms.uLen.value = [0, 0, 0];
  light.mayaOn = 1;
  lab.tween(0.3, (e, k) => (light.mayaPop = Math.sin(Math.min(1, k * 2.5) * Math.PI) * (1 - k)), ease.linear);
  lab.tween(0.3, (e, k) => (mayaJolt.k = Math.cos(k * Math.PI * 2.5) * (1 - k) ** 2 * (k < 0.08 ? k / 0.08 : 1)), ease.linear);
  // the beam lets go and the room's power comes back (a little surge, then exactly as it was)
  lab.tween(0.22, (e) => (shot.power = 1 - e), ease.in);
  await lab.tween(0.32, (e, k) => {
    light.dark = k < 0.75 ? 1 - 1.1 * ease.out(k / 0.75) : -0.1 * (1 - ease.inOut((k - 0.75) / 0.25));
  }, ease.linear);
  light.dark = 0;
  light.mayaPop = 0;
  mayaJolt.k = 0;
  if (mayaRing) mayaRing.scale.setScalar(1);
  // everything back exactly as it was
  shot.power = 0;
  stopLights();
  restore();
  maya.each = null;
  theo.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
