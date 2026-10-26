// Wall, idea 5 "Lost and found", animator c (cinematic & graphic staging).
export const meta = {
  title: 'Lost and found (the camera follows it down)',
  idea:
    'As Maya rolls, her Move 3 card lights one chevron per space. At the wall the third chevron, still lit, shakes loose, darts at the ' +
    'fin, bonks it (tink) and ricochets off in a lazy arc toward us, blushing into her colour. It sails over the near edge of the slab ' +
    'and the camera does what nobody expects of a board game: it tilts down past the edge and follows it into the dark, where it lands ' +
    'softly on the floor among a little glowing pile of every other step the walls have eaten tonight, in everyone\'s colours. A beat to ' +
    'take in the pile, then the camera cranes back up to the game, which never changed.',
  notes:
    'Sound: one soft chime per lit chevron (rising), a tiny tink on the fin, a slow descending glass whistle through the fall and a ' +
    'muffled "tk" as it lands, like a bead on felt. The camera only goes down for the first lost step of a round (or the first per ' +
    'player); later ones just fall out of shot and you hear them land. The pile is real state for the night: each lost step adds one ' +
    'chevron in its player\'s colour, so by round 6 the room can see whose steps the walls ate. Porting: the lit chevrons are a second ' +
    'sprite the same size as the card, the loose one is a V of two capsules, the pile lives on the floor in the board\'s spill.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const red = new THREE.Color(maya.bot.color);
  lab.playCard('a', ['m3']);
  const cam = lab.camera3;

  // ---------- lit chevrons: a sprite laid exactly over the card ----------
  const SC = 4;
  const cv = document.createElement('canvas');
  cv.width = 180 * SC;
  cv.height = 210 * SC;
  const g2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const litSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  litSprite.renderOrder = 31;
  lab.add(litSprite);
  const lit = [0, 0, 0]; // bottom, middle, top: how lit each chevron is
  const gone = [0, 0, 0]; // 1 = this chevron has left the card
  const chevY = [24, 16, 8];
  const drawLit = () => {
    g2.clearRect(0, 0, cv.width, cv.height);
    g2.save();
    g2.scale(SC, SC);
    g2.translate(43.2, 58.2);
    g2.scale(2.34, 2.34);
    g2.lineCap = 'round';
    g2.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const y = chevY[i];
      const path = new Path2D(`M11 ${y + 6} L20 ${y - 3} L29 ${y + 6}`);
      if (gone[i]) {
        // the hole it left: the card's own ink shows through faintly as an empty slot
        g2.strokeStyle = 'rgba(244,241,234,1)';
        g2.lineWidth = 5.2;
        g2.globalAlpha = gone[i];
        g2.stroke(path);
        g2.strokeStyle = 'rgba(21,24,29,.18)';
        g2.lineWidth = 3.6;
        g2.setLineDash([1, 3.2]);
        g2.stroke(path);
        g2.setLineDash([]);
        g2.globalAlpha = 1;
        continue;
      }
      if (lit[i] <= 0.001) continue;
      g2.globalAlpha = lit[i];
      g2.shadowColor = 'rgba(255,190,120,.95)';
      g2.shadowBlur = 6;
      g2.strokeStyle = '#ffb25e';
      g2.lineWidth = 4.2;
      g2.stroke(path);
      g2.shadowBlur = 0;
      g2.strokeStyle = '#fff6e6';
      g2.lineWidth = 1.6;
      g2.stroke(path);
      g2.globalAlpha = 1;
    }
    g2.restore();
    tex.needsUpdate = true;
  };
  let litDirty = true;
  const setLit = (i, v) => {
    if (lit[i] !== v) litDirty = true;
    lit[i] = v;
  };
  const camUp = new THREE.Vector3();
  const topChev = new THREE.Vector3(); // where the top chevron sits in the world, this frame
  maya.each = () => {
    const card = maya.bot.card;
    if (!card) return;
    litSprite.position.copy(card.position);
    litSprite.scale.copy(card.scale);
    litSprite.material.opacity = card.material.opacity * litFade.k;
    litSprite.visible = card.visible;
    if (litDirty) {
      drawLit();
      litDirty = false;
    }
    camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
    topChev.copy(card.position).addScaledVector(camUp, (24.6 / 210) * card.scale.y);
  };
  const litFade = { k: 1 };

  // ---------- the loose chevron: a V of light ----------
  const vMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a8').multiplyScalar(2.2), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const makeV = (mat, s = 1) => {
    const v = new THREE.Group();
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.022 * s, 0.17 * s, 4, 8), mat);
      // arms meet at the tip (+x is where it points) and spread back in the x-y plane
      arm.rotation.z = Math.PI / 2;
      const a = new THREE.Group();
      a.add(arm);
      arm.position.x = -0.085 * s;
      a.rotation.z = side * 0.72;
      v.add(a);
    }
    return v;
  };
  const chev = makeV(vMat, 1.5);
  chev.visible = false;
  lab.add(chev);

  // ---------- the floor: the pile of the night's lost steps ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const FLOOR = -1.585;
  const land = new THREE.Vector3(-0.05, FLOOR, 2.62);
  const pile = [
    ['#4dabf7', -0.55, 2.78, 0.6],
    ['#ffd43b', 0.42, 2.92, -1.9],
    ['#51cf66', 0.2, 2.45, 2.6],
    ['#ff4d6d', -0.42, 2.38, 1.1],
    ['#cc5de8', 0.62, 2.6, -0.4],
    ['#4dabf7', -0.12, 3.05, -2.5],
  ];
  const addResting = (hex, x, z, rot, k = 0.55) => {
    const c = new THREE.Color(hex);
    const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.25 * k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const v = makeV(m, 1.25);
    v.position.set(x, FLOOR + 0.03, z);
    v.rotation.set(Math.PI / 2, rot, 0, 'YXZ'); // lying flat
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, color: c.clone().multiplyScalar(0.3 * k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, FLOOR + 0.005, z);
    lab.add(v);
    lab.add(pool);
    return { v, m, pool, c, k };
  };
  for (const [hex, x, z, r] of pile) addResting(hex, x, z, r, 0.5 + 0.1 * Math.sin(x * 9));

  // ---------- the camera ----------
  const cvw = { k: 0 };
  const sx0 = arena.camCur?.sx ?? 0;
  const sy0 = arena.camCur?.sy ?? 0;
  const keepFrame = lab.every(() => {
    const c = arena.camCur;
    if (!c) return;
    const k = Math.min(0.9, arena.dt * 4);
    c.sx = sx0 / (1 - k);
    c.sy = sy0 / (1 - k);
  });
  const down = new THREE.Vector3(0.0, -1.2, 2.45);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(down, cvw.k),
    dist: home.dist * (1 - 0.42 * cvw.k),
    el: home.el - 0.12 * cvw.k,
  }));

  // the fin's edge, for the tink
  const C = lab.pos(3.5, 1);
  let cap = null;
  arena.board.traverse((o) => {
    if (o.isGroup && o.children.length === 2 && Math.abs(o.position.x - C.x) < 0.05 && Math.abs(o.position.z - C.z) < 0.05) cap = o.children[1];
  });
  const capMat0 = cap?.material;
  const capMat = capMat0?.clone();
  if (cap) cap.material = capMat;
  const capBase = capMat?.color.clone();
  lab.cleanup(() => cap && (cap.material = capMat0));

  // ---------- 1. Move 3: one chevron lights per space ----------
  const E = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const tHit = 0.592;
  await lab.tween(
    0.9 * tHit,
    (e, k) => {
      const x = 1 + 3 * E(k * tHit);
      maya.set({ x, pitch: 0.12 * k });
      setLit(0, Math.min(1, Math.max(0, (x - 1.25) / 0.2)));
      setLit(1, Math.min(1, Math.max(0, (x - 2.25) / 0.2)));
      setLit(2, Math.min(1, Math.max(0, (x - 2.85) / 0.15)));
    },
    ease.linear,
  );
  setLit(2, 1);
  // the stop: a small nod
  lab.tween(0.12, (e, k) => maya.set({ pitch: 0.12 + 0.06 * Math.sin(k * Math.PI) - 0.12 * k }), ease.linear);

  // ---------- 2. the third chevron, still lit, shakes loose ----------
  await lab.wait(0.06);
  const from = new THREE.Vector3();
  await lab.tween(
    0.12,
    (e, k) => {
      // it rattles in its slot (drawn as the loose V over the card)
      from.copy(topChev);
      chev.visible = true;
      gone[2] = 1;
      litDirty = true;
      chev.position.copy(from).add(new THREE.Vector3(Math.sin(k * 40) * 0.02 * k, 0, 0));
      chev.rotation.set(0, 0, Math.PI / 2 + Math.sin(k * 33) * 0.25 * k, 'YXZ'); // points up, like on the card
      chev.scale.setScalar(0.52);
    },
    ease.linear,
  );

  // ---------- 3. it darts at the fin: bonk ----------
  const finHit = new THREE.Vector3(C.x - 0.08, 0.3, C.z);
  const p0 = chev.position.clone();
  await lab.tween(
    0.2,
    (e, k) => {
      chev.position.lerpVectors(p0, finHit, e);
      chev.position.y += Math.sin(k * Math.PI) * 0.12;
      // swings from pointing up (on the card) to pointing east (the way it wanted to go)
      chev.rotation.set(0, 0, (Math.PI / 2) * (1 - e), 'YXZ');
      chev.scale.setScalar(0.52 + 0.48 * e);
    },
    ease.in,
  );
  // tink
  if (capMat) lab.tween(0.3, (e) => capMat.color.copy(capBase).multiplyScalar(1 + 1.8 * (1 - e)), ease.out);
  lab.ring(new THREE.Vector3(C.x, 0.3, C.z), '#fff3e0', 0.18, 0.3, 0.3);

  // ---------- 4. the lazy ricochet over the edge, and the fall into the dark (the camera follows) ----------
  const P1 = finHit.clone();
  const T = 0.9;
  const g = 8.2;
  const vy = (land.y + 0.03 - P1.y + 0.5 * g * T * T) / T;
  const cA = new THREE.Color('#ffd9a8');
  lab.tween(0.7, (e) => (cvw.k = e), ease.inOut);
  lab.at(0.15, () => lab.tween(0.3, (e) => (litFade.k = 1 - e), ease.inOut));
  let spin = 0;
  await lab.tween(
    T,
    (e, k) => {
      const s = 1 - (1 - k) ** 2; // fast off the fin, then mostly falling
      chev.position.set(P1.x + (land.x - P1.x) * s, P1.y + vy * k * T - 0.5 * g * (k * T) ** 2, P1.z + (land.z - P1.z) * s);
      spin = k;
      chev.rotation.set((Math.PI / 2 + Math.PI * 2) * ease.inOut(k), Math.PI * 0.95 * ease.out(k), 0.4 * Math.sin(k * 5) * (1 - k), 'YXZ');
      vMat.color.copy(cA).lerp(red, Math.min(1, k * 1.6)).multiplyScalar(2.2 - 0.6 * k);
    },
    ease.linear,
  );
  void spin;

  // ---------- 5. lands softly among the others, and keeps glowing ----------
  chev.position.copy(land).setY(FLOOR + 0.03);
  chev.rotation.set(Math.PI / 2, Math.PI * 0.95, 0, 'YXZ');
  const mine = addResting('#ff4d6d', land.x, land.z, Math.PI * 0.95, 0.9);
  mine.v.visible = false;
  lab.ring(new THREE.Vector3(land.x, FLOOR + 0.01, land.z), maya.bot.color, 0.22, FLOOR + 0.01, 0.45);
  await lab.tween(
    0.12,
    (e, k) => {
      chev.position.y = FLOOR + 0.03 + Math.sin(k * Math.PI) * 0.05;
      mine.pool.material.color.copy(red).multiplyScalar(0.3 * (0.9 + 1.2 * (1 - k)));
    },
    ease.out,
  );
  await lab.wait(0.12);

  // ---------- 6. back up to the game ----------
  await lab.tween(0.36, (e) => (cvw.k = 1 - e), ease.inOut);
  cvw.k = 0;
  releaseCam();
  keepFrame();
  maya.each = null;
  litSprite.visible = false;
  maya.release({ x: 3, y: 1, d: 1 });
}
