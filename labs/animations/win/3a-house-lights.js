// House lights, through weight and physical comedy: the lights clunk on like old fluorescent tubes, the losers
// flinch and squint, and when the dark comes back the light pours back into the glass like liquid in a tray.
export const meta = {
  title: 'House lights: tubes and slosh',
  idea:
    'Maya touches flag 2 and, CLUNK, the house lights come on the way old tube lights do: a stutter, a flicker, then full on. The dark room is a flat, too-bright grey studio; the smoked glass is a cheap pale tabletop, the columns wash out to nothing. Theo and Jun jump at the clunk, then cower, eyes squeezed to slits. Only Maya still glows, standing tall. Click: total dark for a heartbeat (two pairs of squinting slits hang in the black), then the light pours back into the glass from under Maya like liquid poured into a tray, sloshes out to the edges and back, and Theo\'s and Jun\'s eyes pop open wide. Flag 2\'s column stands red.',
  notes:
    'Sound: a heavy breaker CLUNK, two tube ticks and the hum of fluorescent light (the only non-glass sound in the game, on purpose), a small click, silence, then a glass pour and a soft slosh as the light settles. Everything the prototype changes (background, room lights, environment, the glass top, slab edges, floor, spill, motes, columns, eyes) is saved first and restored at the end and in cleanup. The port should drive the same values from scene.js, with the slosh as a radial reveal in the glass shader if wanted.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const scene = lab.scene;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  theo.set({ trail: false });
  jun.set({ trail: false });
  const RED = new THREE.Color(lab.bot('a').color);

  // ---------- everything the house lights touch, saved ----------
  const floor = scene.children.find((o) => o.isMesh && o.geometry?.parameters?.width === 400);
  const slab = arena.board.children.find((o) => o.isMesh && Array.isArray(o.material));
  const edgeMat = slab?.material[0];
  const top = arena.topMat;
  const O = {
    bg: scene.background,
    env: scene.environmentIntensity,
    hemiI: arena.hemi.intensity,
    hemiC: arena.hemi.color.clone(),
    hemiG: arena.hemi.groundColor.clone(),
    keyI: arena.key.intensity,
    floor: floor?.material.color.clone(),
    topColor: top.color.clone(),
    topRough: top.roughness,
    edgeColor: edgeMat?.color.clone(),
    edgeEm: edgeMat?.emissiveIntensity,
    halo: arena.columns.map((c) => c.halo.material.color.clone()),
  };
  const restore = () => {
    scene.background = O.bg;
    scene.environmentIntensity = O.env;
    arena.hemi.intensity = O.hemiI;
    arena.hemi.color.copy(O.hemiC);
    arena.hemi.groundColor.copy(O.hemiG);
    arena.key.intensity = O.keyI;
    if (floor) floor.material.color.copy(O.floor);
    top.color.copy(O.topColor);
    top.roughness = O.topRough;
    if (edgeMat) {
      edgeMat.color.copy(O.edgeColor);
      edgeMat.emissiveIntensity = O.edgeEm;
    }
    arena.columns.forEach((c, i) => c.halo.material.color.copy(O.halo[i]));
    arena.spill.visible = true;
    arena.motes.visible = true;
  };
  lab.cleanup(restore);

  // ---------- the state, applied every frame after the game's own update ----------
  // L: house lights (0 dark .. 1 full). glass: how much of Lumen's light is in the glass (0..1, can overshoot).
  // squint: Theo's and Jun's eyes (1 open, 0.2 slits, >1 wide). cower: they shrink back. proud: Maya glows.
  const st = { L: 0, glass: 1, squint: 1, cower: 0, proud: 0, hop: 0 };
  const grey = new THREE.Color(0x8e9196);
  const studioBg = new THREE.Color(0x9b9ea3);
  const floorGrey = new THREE.Color(0x7d8086);
  const tableTop = new THREE.Color(5.2, 5.1, 4.9);
  let bgIsGrey = false;
  lab.every(() => {
    const L = st.L;
    const lit = L > 0.5;
    if (lit !== bgIsGrey) {
      scene.background = lit ? studioBg.clone().multiplyScalar(0.6 + 0.4 * L) : O.bg;
      bgIsGrey = lit;
    } else if (lit) scene.background.copy(studioBg).multiplyScalar(0.6 + 0.4 * L);
    scene.environmentIntensity = O.env + 1.1 * L;
    arena.hemi.intensity = O.hemiI + 2.6 * L;
    arena.hemi.color.copy(O.hemiC).lerp(new THREE.Color(1, 1, 1), L);
    arena.hemi.groundColor.copy(O.hemiG).lerp(grey, L);
    arena.key.intensity = O.keyI + 1.6 * L;
    if (floor) floor.material.color.copy(O.floor).lerp(floorGrey, L);
    arena.spill.visible = !lit;
    arena.motes.visible = !lit;
    top.color.copy(O.topColor).lerp(tableTop, L);
    top.roughness = O.topRough + (0.8 - O.topRough) * L;
    // Lumen's light in the glass: washed out by the house lights, or pouring back after them
    const g = Math.max(0, st.glass) * (1 - L);
    top.emissiveIntensity *= g;
    if (edgeMat) {
      edgeMat.color.copy(O.edgeColor).lerp(grey, L);
      edgeMat.emissiveIntensity = O.edgeEm * g;
    }
    arena.columns.forEach((c, i) => {
      const own = c.n === 2 ? Math.max(g, 0.12 * (1 - L)) : g;
      c.mat.color.multiplyScalar(Math.max(0.04, own));
      c.halo.material.color.copy(O.halo[i]).multiplyScalar(g);
    });
  });

  // the losers: squint, flinch, cower; their light is washed out with the room's
  const eyesOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const squinters = [theo, jun].map((p) => ({ p, eyes: eyesOf(p.model), q: 1, c: 0, lit: 1, dist: lab.pos(p.pose.x, p.pose.y).distanceTo(lab.pos(4, 1)) }));
  for (const s of squinters) {
    s.p.each = (m) => {
      const q = s.q;
      for (const e of s.eyes) {
        if (e.geometry.type === 'CylinderGeometry') e.scale.set(q, 1, q);
        else if (e.geometry.type === 'CapsuleGeometry') e.scale.set(q, 1, 1);
        else e.scale.set(1, q, 1);
      }
      const washed = 1 - 0.85 * st.L;
      m.eyeMat.color.multiplyScalar(washed * (0.55 + 0.45 * Math.min(1, q)) * (q > 1 ? 1 + (q - 1) * 1.5 : 1));
      m.ringMat.opacity *= (1 - 0.9 * st.L) * (0.35 + 0.65 * s.lit);
      m.poolMat.opacity *= (1 - 0.95 * st.L) * s.lit;
      m.paint.emissiveIntensity *= 1 - st.L;
    };
  }
  maya.each = (m) => {
    const k = st.proud;
    m.eyeMat.color.multiplyScalar(1 + 0.8 * k);
    m.paint.emissiveIntensity = 0.16 + 1.3 * k;
    m.poolMat.opacity = Math.min(1, m.poolMat.opacity * (1 + 0.6 * k));
    m.ringMat.opacity = 1;
  };
  // their bodies: a startled hop, then shrinking back from the glare
  lab.every(() => {
    for (const s of squinters) {
      const c = s.c;
      s.p.set({ lift: st.hop, sy: 1 - 0.14 * c + st.hop * 0.6, sx: 1 + 0.06 * c, sz: 1 + 0.06 * c, pitch: -0.18 * c });
    }
  });

  // ---------- Move 2 with weight ----------
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  await lab.wait(0.22);
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });
  await lab.tween(0.6, (e, k) => {
    const s = k - Math.sin(TAU * k) / TAU;
    maya.set({ x: 2 + 2 * s, pitch: -0.13 * Math.sin(TAU * k) });
  }, ease.linear);
  // touch: the column flashes, she rocks to a stop
  const col = arena.columns.find((c) => c.n === 2);
  if (col) {
    col.flash = lab.t;
    col.flashColor = RED.clone();
  }
  arena.emit('checkpoint', { id: 'a', n: 2 });
  arena.emit('win', { id: 'a' });
  lab.ring(lab.pos(4, 1), RED, 1.0, 0.03, 0.5);
  lab.tween(0.6, (e, k) => {
    const u = k * 0.6;
    const w = Math.exp(-u * 6) * Math.sin(u * 17);
    maya.set({ x: 4 + 0.035 * w, pitch: 0.16 * w });
  }, ease.linear);
  const card = lab.bot('a').card;
  if (card) {
    const base = card.userData.base.clone();
    lab.tween(0.2, (e) => card.scale.set(base.x * (1 - e), base.y * (1 + 0.3 * e), 1), ease.in).then(() => arena.clearCards());
  }
  await lab.wait(0.3);

  // ---------- CLUNK: the tubes stutter on ----------
  lab.shake(0.06, 0.3);
  st.L = 1;
  lab.tween(0.28, (e, k) => (st.hop = 0.14 * Math.sin(Math.PI * k)), ease.linear);
  await lab.wait(0.07);
  st.L = 0;
  await lab.wait(0.1);
  st.L = 0.75;
  await lab.wait(0.05);
  st.L = 0;
  await lab.wait(0.13);
  st.L = 1;
  lab.shake(0.02, 0.12);
  // full on: they squint and shrink back; Maya stands tall in her own light
  lab.tween(0.18, (e) => squinters.forEach((s) => (s.q = 1 - 0.8 * e)), ease.out);
  lab.tween(0.3, (e) => squinters.forEach((s) => (s.c = e)), ease.outBack);
  lab.tween(0.5, (e) => (st.proud = e), ease.out);
  lab.tween(0.4, (e) => maya.set({ sy: 1 + 0.07 * e, sx: 1 - 0.02 * e, sz: 1 - 0.02 * e }), ease.outBack);
  // the hum: tubes settle a hair brighter
  await lab.tween(1.05, (e, k) => (st.L = 0.94 + 0.06 * Math.min(1, k * 3) + 0.012 * Math.sin(k * 90)), ease.linear);

  // ---------- click: dark, all of it (only the slits and Maya), then the light pours back ----------
  // A cover over the glass hides its light outside a wobbling radius round Maya; the radius grows like poured
  // liquid, a bright meniscus rides its edge, and a dimmer slosh rolls back to her from the edges.
  const C = lab.pos(4, 1);
  const vert = 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const U = { uC: { value: new THREE.Vector2(C.x, C.z) }, uR: { value: 0 }, uOn: { value: 1 }, uT: { value: 0 }, uR2: { value: -1 }, uA1: { value: 0 }, uA2: { value: 0 }, uCol: { value: new THREE.Color(lab.PALETTE.light).multiplyScalar(2.2) } };
  const edge = 'vec2 d = vP - uC; float dist = length(d); float ang = atan(d.y, d.x); float r = uR + 0.08 * sin(ang * 5.0 + uT * 7.0) + 0.04 * sin(ang * 11.0 - uT * 5.0);';
  const coverMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, transparent: true, depthWrite: false,
    fragmentShader: `uniform vec2 uC; uniform float uR; uniform float uOn; uniform float uT; varying vec2 vP; void main(){ ${edge} gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(r - 0.3, r + 0.04, dist) * uOn * 0.97); }` });
  const bandMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec2 uC; uniform float uR; uniform float uT; uniform float uR2; uniform float uA1; uniform float uA2; uniform vec3 uCol; varying vec2 vP; void main(){ ${edge} float b1 = exp(-pow((dist - r + 0.06) / 0.11, 2.0)) * uA1; float r2 = uR2 + 0.06 * sin(ang * 4.0 - uT * 6.0); float b2 = uR2 > 0.0 ? exp(-pow((dist - r2) / 0.16, 2.0)) * uA2 : 0.0; gl_FragColor = vec4(uCol * (b1 + b2), 1.0); }` });
  const cw = arena.course.w;
  const ch = arena.course.h;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), coverMat);
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = 0.0025;
  cover.renderOrder = -1;
  const band = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), bandMat);
  band.rotation.x = -Math.PI / 2;
  band.position.y = 0.003;
  band.renderOrder = -1;
  lab.add(cover);
  lab.add(band);
  st.L = 0;
  st.glass = 0;
  squinters.forEach((s) => (s.lit = 0));
  const colDist = arena.columns.map((c) => Math.hypot(c.col.position.x - C.x, c.col.position.z - C.z));
  let pourR = -1;
  lab.every(() => {
    // the columns come back as the light reaches them
    if (pourR < 0) return;
    arena.columns.forEach((c, i) => {
      const k = Math.max(0, Math.min(1, (pourR - colDist[i] + 0.2) / 0.5));
      if (c.n !== 2) c.mat.color.multiplyScalar(0.06 + 0.94 * k);
    });
  });
  await lab.wait(0.24);
  const MAXR = 5.4;
  const t0 = lab.t;
  const popped = new Set();
  const stopPour = lab.every(() => {
    const u = lab.t - t0;
    U.uT.value = u;
    const k1 = Math.min(1, u / 0.6);
    pourR = MAXR * ease.out(k1);
    U.uR.value = pourR;
    U.uA1.value = k1 < 1 ? 0.85 * Math.min(1, u * 8) : Math.max(0, 0.85 - (u - 0.6) * 6);
    U.uOn.value = k1 < 1 ? 1 : 0;
    // the slosh back: a dimmer band rolls in from the edges to Maya
    const k2 = Math.min(1, Math.max(0, (u - 0.5) / 0.65));
    U.uR2.value = k2 > 0 && k2 < 1 ? 4.6 - 4.3 * ease.inOut(k2) : -1;
    U.uA2.value = Math.sin(k2 * Math.PI) * 0.4;
    // the glass fills with an overshoot, like liquid settling in a tray
    st.glass = 1 + 0.35 * Math.exp(-u * 3.5) * Math.sin(u * 10);
    // each robot's eyes pop open wide when the light reaches it, and it stands back up
    for (const s of squinters) {
      if (popped.has(s) || pourR < s.dist) continue;
      popped.add(s);
      lab.tween(0.5, (e, k) => (s.q = 0.2 + 0.8 * k + 0.6 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k)), ease.out);
      lab.tween(0.55, (e) => (s.c = 1 - e), ease.outElastic);
      lab.tween(0.3, (e) => (s.lit = e), ease.out);
    }
  });
  lab.tween(0.7, (e) => (st.proud = 1 - e), ease.inOut);
  lab.tween(0.5, (e) => maya.set({ sy: 1.07 - 0.07 * e, sx: 0.98 + 0.02 * e, sz: 0.98 + 0.02 * e }), ease.inOut);
  // the slosh arrives back at Maya: a little bump in her light, and the column stands red
  lab.wait(1.12).then(() => {
    if (col) {
      col.flash = lab.t - 0.3;
      col.flashColor = RED.clone();
    }
    lab.ring(C, RED, 0.7, 0.03, 0.4);
  });
  await lab.wait(1.45);
  stopPour();
  pourR = -1;
  cover.visible = false;
  band.visible = false;
  st.glass = 1;
  squinters.forEach((s) => {
    s.q = 1;
    s.c = 0;
    s.lit = 1;
  });
  st.proud = 0;
  maya.each = null;
  for (const s of squinters) {
    s.p.each = null;
    for (const e of s.eyes) e.scale.set(1, 1, 1);
  }
  restore();
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
  jun.release({ x: 1, y: 0, d: 2 });
}
