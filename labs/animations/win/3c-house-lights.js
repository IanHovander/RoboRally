// House lights, cut like a comedy: a clunk, a hard cut to the wide shot of the cheap set (the floating slab
// is a folding table, with a power cable), a snap zoom on the one thing still shining, and an iris that
// closes on her and opens again on Lumen.
export const meta = {
  title: 'House lights',
  idea:
    'Maya lands on flag 2, the column starts to flash, and CLUNK: the house lights come on, bank by bank with a fluorescent stutter. Hard cut to the wide shot: a flat grey studio, and the floating slab of smoked glass is a cheap folding table on four legs, with a power cable. Theo and Jun squint, eyes down to slits, leaning away. Only Maya still glows. Snap zoom on her; she gives a tiny proud bounce. Click: an iris of darkness closes on her like the end of an old cartoon, and when it opens again the dark room is back, the light floods out of her into the glass and flag 2\'s column rises in her colour.',
  notes:
    'Sound: a heavy contactor clunk, the tick and hum of fluorescent tubes (two stutters), dead room tone for the wide shot, a camera-zoom whip, then one small click and silence on the black, and Lumen\'s glass swell as the iris opens. Everything changed (lights, background, floor, glass, bloom, eyes) is restored in cleanup. Port: the legs and cable exist only for this moment; the iris is a CSS radial-gradient on the HUD layer, centred on the winner each frame.',
};

const RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const W = (x, y) => lab.pos(x, y);
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- the set, as it really is (only visible with the lights on) ----------
  const set = new THREE.Group();
  set.visible = false;
  lab.add(set);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.35, metalness: 0.7 });
  const c = A.course;
  const legH = 1.6 - 0.36;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, legH, 12), legMat);
    leg.position.set(sx * (c.w / 2 - 0.35), -0.36 - legH / 2, sz * (c.h / 2 - 0.3));
    set.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.8 }));
    foot.position.set(leg.position.x, -1.585, leg.position.z);
    set.add(foot);
  }
  // a crossbar between the far legs, and the power cable sagging to the floor and away
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, c.w - 0.7, 10), legMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, -1.1, -(c.h / 2 - 0.3));
  set.add(bar);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(c.w / 2 - 0.9, -0.37, -0.4),
    new THREE.Vector3(c.w / 2 - 0.6, -0.9, -0.2),
    new THREE.Vector3(c.w / 2 - 0.1, -1.56, 0.3),
    new THREE.Vector3(c.w / 2 + 1.4, -1.58, 0.9),
    new THREE.Vector3(c.w / 2 + 3.5, -1.58, 0.4),
    new THREE.Vector3(c.w / 2 + 7, -1.58, 1.2),
  ]);
  set.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 80, 0.022, 8, false), new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.5 })));

  // ---------- what the house lights touch, and how to put it all back ----------
  const floor = A.scene.children.find((o) => o.isMesh && o.geometry?.parameters?.width === 400);
  const slabMats = new Set();
  A.board.traverse((o) => {
    if (o.isMesh && Array.isArray(o.material)) for (const m of o.material) if (m.isMeshStandardMaterial) slabMats.add(m);
  });
  const saved = {
    bg: A.scene.background,
    env: A.scene.environmentIntensity,
    floor: floor?.material.color.clone(),
    hemi: A.hemi.intensity,
    hemiSky: A.hemi.color.clone(),
    hemiGround: A.hemi.groundColor.clone(),
    key: A.key.intensity,
    bloom: A.useBloom,
    topColor: A.topMat.color.clone(),
    topRough: A.topMat.roughness,
    topEnv: A.topMat.envMapIntensity,
    slab: [...slabMats].map((m) => [m, m.color.clone(), m.emissiveIntensity]),
    halos: A.columns.map((col) => [col.halo.material, col.halo.material.opacity]),
  };
  const grey = new THREE.Color('#8e9399');
  const floorGrey = new THREE.Color('#6d7176');
  const tube = new THREE.Color('#eef4ee');
  const house = { h: 0 };
  const apply = () => {
    const h = house.h;
    A.scene.background = h > 0.02 ? grey.clone().multiplyScalar(0.3 + 0.7 * h) : saved.bg;
    A.scene.environmentIntensity = lerp(saved.env, 1.5, h);
    if (floor) floor.material.color.copy(saved.floor).lerp(floorGrey, h);
    A.hemi.intensity = lerp(saved.hemi, 2.6, h);
    A.hemi.color.copy(saved.hemiSky).lerp(tube, h);
    A.hemi.groundColor.copy(saved.hemiGround).lerp(new THREE.Color('#8d8f92'), h);
    A.key.intensity = lerp(saved.key, 2.4, h);
    A.useBloom = h < 0.5 ? saved.bloom : false;
    A.topMat.emissiveIntensity *= 1 - h; // the light in the glass washes out (the arena sets it each frame)
    A.topMat.color.copy(saved.topColor).multiplyScalar(1 + 3.2 * h);
    A.topMat.roughness = lerp(saved.topRough, 0.65, h);
    A.topMat.envMapIntensity = lerp(saved.topEnv, 0.25, h);
    for (const [m, col, ei] of saved.slab) {
      m.color.copy(col).lerp(new THREE.Color('#7b8087'), h);
      m.emissiveIntensity = ei * (1 - h);
    }
    for (const col of A.columns) col.mat.color.multiplyScalar(1 - 0.97 * h);
    for (const [m, o] of saved.halos) m.opacity = o * (1 - h);
    A.motes.visible = A.spill.visible = h < 0.5;
    set.visible = h > 0.02;
  };
  const stopHouse = lab.every(apply);
  lab.cleanup(() => {
    A.showNames = true;
    house.h = 0;
    apply();
    A.topMat.roughness = saved.topRough;
    A.topMat.envMapIntensity = saved.topEnv;
    A.topMat.color.copy(saved.topColor);
    A.motes.visible = A.spill.visible = true;
    A.useBloom = saved.bloom;
  });

  // ---------- the rivals squint; the winner keeps shining ----------
  const eyes = (p) => {
    const list = [];
    p.model.body.traverse((o) => o.isMesh && o.material === p.model.eyeMat && list.push({ o, s: o.scale.clone() }));
    return list;
  };
  const squint = { k: 0 };
  for (const p of [theo, jun]) {
    const list = eyes(p);
    p.each = (m) => {
      const k = squint.k;
      m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 - 0.75 * k);
      for (const { o, s } of list) o.scale.set(s.x * (1 - 0.35 * k), s.y * (1 - 0.8 * k), s.z * (1 - 0.35 * k));
      m.ringMat.opacity = 0.9 * (1 - 0.8 * k);
      m.poolMat.opacity *= 1 - 0.9 * k;
    };
  }
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(RED).multiplyScalar(1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(1.5, 1.5, 1);
  lab.add(halo);
  maya.each = (m) => {
    const h = house.h;
    m.paint.emissiveIntensity = 0.16 + 0.75 * h;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 + 0.6 * h);
    m.ringMat.opacity = 0.95;
    m.ringMat.color.set(RED).multiplyScalar(1.6 + 2 * h);
    m.poolMat.opacity = 0.75 + 0.25 * h;
    halo.position.copy(maya.group.position).setY(maya.group.position.y + 0.25);
    halo.material.opacity = 0.75 * h;
  };

  // ---------- the camera: home, a hard cut to the wide, a snap zoom, home again ----------
  const cam = { shot: 'home', zoom: 0 };
  const wideShot = (home) => ({ target: home.target.clone().add(new THREE.Vector3(0.3, -0.6, 0.1)), az: 0.32, el: 0.3, dist: home.dist * 1.13 });
  const releaseCam = lab.camera((home) => {
    if (cam.shot === 'wide') return wideShot(home);
    if (cam.shot === 'zoom') {
      const z = cam.zoom;
      const wide = wideShot(home);
      // a medium shot: Maya in the middle, a squinting Theo at the edge of frame
      const m = maya.group.position.clone().lerp(W(5, 3), 0.22).setY(0.15);
      return { target: wide.target.clone().lerp(m, z), az: lerp(wide.az, 0.22, z), el: lerp(wide.el, 0.5, z), dist: lerp(wide.dist, home.dist * 0.56, z) };
    }
    return {};
  });

  // ---------- the iris (the HUD layer): a hole of picture round the winner ----------
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  lab.overlay.append(iris);
  const ir = { r: -1 };
  const stopIris = lab.every(() => {
    if (ir.r < 0) {
      iris.style.background = 'none';
      return;
    }
    const s = lab.toScreen(W(maya.pose.x, maya.pose.y).setY(0.18 + maya.pose.lift)); // (hooks run before the pose is applied)
    const H = lab.overlay.clientHeight || 540;
    const r = ir.r * H;
    const soft = Math.max(1, 0.012 * H);
    iris.style.background = `radial-gradient(circle at ${s.x}px ${s.y}px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,1) ${r + soft}px)`;
  });

  // ---------- 1. Move 2 onto flag 2, the celebration starts ----------
  lab.playCard('a', ['m2']);
  await lab.wait(0.15);
  await lab.tween(0.66, (e) => maya.set({ x: 2 + 2 * e }), ease.inOut);
  A.clearCards();
  const col2 = A.columns.find((cc) => cc.n === 2);
  if (col2) {
    col2.flash = A.time;
    col2.flashColor = new THREE.Color(RED);
  }
  lab.ring(W(4, 1), RED, 3, 0.02, 1.6);
  A.emit('checkpoint', { id: 'a', n: 2 });
  await lab.wait(0.2);

  // ---------- 2. CLUNK: the house lights, bank by bank ----------
  A.emit('win', { id: 'a' });
  cam.shot = 'wide';
  house.h = 0.55;
  lab.shake(0.03, 0.2);
  await lab.wait(0.07);
  house.h = 0.18; // the tubes stutter
  await lab.wait(0.05);
  house.h = 0.8;
  await lab.wait(0.06);
  house.h = 0.5;
  await lab.wait(0.04);
  house.h = 1;
  // the rivals squint and lean away from the glare
  lab.tween(0.12, (e) => (squint.k = e), ease.out);
  lab.tween(0.35, (e) => {
    theo.set({ pitch: -0.2 * e, rot: facing(3) + 0.35 * e });
    jun.set({ pitch: -0.2 * e, rot: facing(2) - 0.3 * e, sy: 1 - 0.06 * e });
  }, ease.outBack);
  await lab.wait(0.5);

  // ---------- 3. snap zoom: the one thing still shining ----------
  cam.shot = 'zoom';
  A.showNames = false;
  await lab.tween(0.14, (e) => (cam.zoom = e), ease.outBack);
  await lab.wait(0.06);
  // a tiny proud bounce
  await lab.tween(0.3, (e, k) => maya.set({ lift: 0.09 * Math.sin(k * Math.PI), sy: 1 + 0.08 * Math.sin(k * Math.PI) - (k > 0.85 ? 0.1 * Math.sin(((k - 0.85) / 0.15) * Math.PI) : 0) }), ease.linear);
  maya.set({ lift: 0, sy: 1 });
  await lab.wait(0.06);

  // ---------- 4. click: the iris closes on her ----------
  const H = 1;
  await lab.tween(0.22, (e) => (ir.r = lerp(1.2 * H, 0.13, e)), ease.in);
  await lab.wait(0.3);
  await lab.tween(0.09, (e) => (ir.r = 0.13 * (1 - e)), ease.in);
  ir.r = 0;
  // in the black: everything back to Lumen, the camera home, the rivals straight
  house.h = 0;
  squint.k = 0;
  theo.set({ pitch: 0, rot: facing(3) });
  jun.set({ pitch: 0, rot: facing(2), sy: 1 });
  cam.shot = 'home';
  A.showNames = true;
  A.topMat.emissiveIntensity = 0;
  const flood = { k: 0 };
  const stopFlood = lab.every(() => {
    A.topMat.emissiveIntensity *= flood.k;
    for (const s of saved.slab) s[0].emissiveIntensity = s[2] * flood.k;
  });
  await lab.wait(0.12);

  // ---------- 5. the iris opens on the dark, the light floods back out of her ----------
  lab.pillar(W(4, 1), RED, 6, 0.6);
  lab.ring(W(4, 1), RED, 5, 0.02, 1.1);
  if (col2) {
    col2.flash = A.time;
    col2.flashColor = new THREE.Color(RED);
  }
  lab.tween(0.9, (e) => (flood.k = e), ease.inOut);
  await lab.tween(0.75, (e) => (ir.r = 1.3 * e), ease.out);
  ir.r = -1;
  await lab.wait(0.25);
  stopFlood();
  stopIris();
  stopHouse();
  releaseCam();
  maya.each = theo.each = jun.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
  jun.release({ x: 1, y: 0, d: 2 });
}
