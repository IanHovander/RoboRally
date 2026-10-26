// Token flip, acted: Maya arrives pleased with herself, then the floor rumbles. A double take down at her feet, and
// the glass tile pops up out of the slab with her on it, squashing her flat. It turns over once like a game token:
// she clings with her eye screwed shut, then, hanging upside down under the smoked glass (her own reflection, for a
// moment), she opens it and looks around. Round she goes, the tile slaps back into the slab, and she shakes herself
// off and stands up tall over her new ring. Theo nearly jumps out of his skin.
export const meta = {
  title: 'Flipped',
  idea:
    "The glass tile under flag 1 pops out of the slab with Maya on it, leaving a square of darkness, and turns over once like a cardboard token. She clings with her eye shut, and halfway round, hanging upside down under the smoked glass like her own reflection, she opens it and has a puzzled look around. The tile slaps back in with a clack, she shakes herself off and stands proud over her red ring. Theo jumps at the pop and flinches at the clack.",
  notes:
    'Sound: a low glass rumble (the double take), a cork-like "thoop" as the tile pops, a whoosh around, a tiny bewildered chime at the upside-down beat, a flat glassy CLACK as it seats, then a bright chime for the ring. ' +
    "The tile's top face is the board's own glass and light (same textures, that cell's UVs), so when it seats it is indistinguishable from the slab. Always flips the same way (forward, over her nose), so it reads as the board's gesture, not a hazard. " +
    'Bystanders hop back at the pop and blink at the clack. ~2.7 s including the Move 2.',
};

const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));

/** A keyframed channel: keys [[t, value, ease?]], the ease shapes the segment that ends at that key. */
function track(ease, keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = 'inOut'] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return v0 + (v1 - v0) * ease[e](t1 > t0 ? (t - t0) / (t1 - t0) : 1);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Take a robot over with acting channels: body squash (sq), body lean/tip (only the body, the ring stays put), eye. */
function actor(lab, key) {
  const p = lab.puppet(key);
  const eyes = [];
  p.model.body.traverse((o) => o.isMesh && o.material === p.model.eyeMat && eyes.push(o));
  const eyeScale = eyes.map((e) => e.scale.clone());
  const a = { p, sq: 1, wide: 1, eye: 1, squint: 1, lean: 0, tip: 0 };
  p.each = (m) => {
    const w = a.wide / Math.sqrt(Math.max(0.3, a.sq));
    m.body.scale.set(w, a.sq, w);
    m.body.rotation.x = -a.lean;
    m.body.rotation.z = -a.tip;
    m.eyeMat.color.setRGB(3.2 * a.eye, 3.1 * a.eye, 2.9 * a.eye);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]).setX(eyeScale[i].x * a.squint));
  };
  a.reset = () => {
    p.model.body.scale.set(1, 1, 1);
    p.model.body.rotation.set(0, 0, 0);
    eyes.forEach((e, i) => e.scale.copy(eyeScale[i]));
  };
  return a;
}

function canvasTex(THREE, draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const T = (keys) => track(ease, keys);
  const sc = lab.scenario;
  const arena = lab.arena;
  const flag = { x: 4, y: 1 };
  const fp = lab.pos(flag.x, flag.y);
  const col = arena.columns.find((c) => c.n === 1);
  const color = lab.bot('a').color;
  const HALF = 0.18; // half the slab's thickness

  // ---- the tile: the board's own top for that cell, smoked glass sides and underside, bright edges ----
  const W = arena.course.w;
  const H = arena.course.h;
  const topGeo = new THREE.PlaneGeometry(0.995, 0.995);
  const uv = topGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (flag.x + uv.getX(i)) / W, 1 - (flag.y + 1 - uv.getY(i)) / H);
  const topMat = arena.topMat.clone();
  const top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = HALF + 0.001;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3140, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, emissive: 0x9aa8bc, emissiveIntensity: 0.06 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const sides = new THREE.Mesh(new THREE.BoxGeometry(0.995, HALF * 2, 0.995), [glassMat, glassMat, hidden, hidden, glassMat, glassMat]);
  const underTex = canvasTex(THREE, (g, S) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(244,239,228,.7)';
    g.lineWidth = S * 0.025;
    g.strokeRect(S * 0.05, S * 0.05, S * 0.9, S * 0.9);
  });
  const underMat = new THREE.MeshPhysicalMaterial({ color: 0x1c222c, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.5, depthWrite: false, emissive: 0xffffff, emissiveMap: underTex, emissiveIntensity: 0.5 });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(0.995, 0.995), underMat);
  under.rotation.x = Math.PI / 2;
  under.position.y = -HALF - 0.001;
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(1.6), transparent: true, opacity: 0.8 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.995, HALF * 2, 0.995)), edgeMat);
  const tile = new THREE.Group();
  tile.add(top, sides, under, edges);
  tile.visible = false;
  lab.add(tile);

  // ---- the hole it leaves: darkness, with the cut edge catching a little light ----
  const holeTex = canvasTex(THREE, (g, S) => {
    g.fillStyle = '#020305';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(244,239,228,.45)';
    g.lineWidth = S * 0.02;
    g.strokeRect(S * 0.01, S * 0.01, S * 0.98, S * 0.98);
  });
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: holeTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(fp.x, 0.004, fp.z);
  hole.visible = false;
  lab.add(hole);
  lab.cleanup(() => col && (col.halo.visible = true));

  // ---- the actors ----
  const maya = actor(lab, 'a');
  const east = maya.p.pose.rot;
  const lookers = Object.keys(sc.bots)
    .filter((k) => k !== 'a' && sc.bots[k].on !== false)
    .map((k, i) => {
      const a = actor(lab, k);
      const r = sc.bots[k];
      a.home = { x: r.x, y: r.y, rot: a.p.pose.rot };
      a.lag = i * 0.03;
      return a;
    });

  // timeline (seconds from the start of the moment)
  const ARRIVE = 0.6;
  const RUMBLE = 0.72;
  const POP = 0.84;
  const UP = POP + 0.16;
  const F0 = 0.92; // the turn starts while it is still rising
  const F1 = 1.7; // ... and is done
  const SLAP = 1.8;
  const END = 2.72;
  // the turn: fast off the start, drifting slowly through upside down (the hang), fast into the landing
  const psiOf = (t) => {
    const k = clamp01((t - F0) / (F1 - F0));
    const u = 2 * k - 1;
    return Math.PI * (1 + 0.78 * Math.sign(u) * u * u + 0.22 * u);
  };
  const L = T([[POP, 0], [UP, 1.08, 'out3'], [F1 - 0.08, 1.0, 'inOut'], [SLAP, 0, 'in']]);
  const rumble = (t) => (t > RUMBLE && t < POP ? Math.sin(t * 120) * 0.008 * Math.sin(((t - RUMBLE) / (POP - RUMBLE)) * Math.PI) : 0);

  const M = {
    x: T([[0, 2], [ARRIVE, 4, 'inOut']]),
    // arrives and puffs up, pleased; the rumble: a double take down at her feet; the pop squashes her flat
    lean: T([[0.56, 0.12], [0.66, -0.1, 'out'], [RUMBLE, -0.06], [RUMBLE + 0.05, 0.34, 'out'], [POP - 0.02, 0.3], [POP + 0.06, -0.05, 'out'], [F0 + 0.1, 0, 'inOut'], [SLAP, 0], [SLAP + 0.08, 0.12, 'out'], [SLAP + 0.2, -0.04, 'inOut'], [END - 0.3, -0.12, 'out'], [END, 0, 'inOut']]),
    sq: T([[ARRIVE, 1], [0.66, 1.1, 'out'], [RUMBLE, 1.04], [POP, 0.96], [POP + 0.06, 0.66, 'out'], [UP + 0.08, 0.86, 'out'], [F1, 0.82], [SLAP, 0.86], [SLAP + 0.04, 0.6, 'out'], [SLAP + 0.16, 1.18, 'out'], [SLAP + 0.3, 0.94, 'inOut'], [SLAP + 0.42, 1.0, 'inOut'], [END - 0.3, 1.12, 'out'], [END, 1, 'inOut']]),
    eye: T([[ARRIVE, 1], [0.66, 1.5, 'out'], [RUMBLE, 1.3], [RUMBLE + 0.04, 2.2, 'out'], [POP + 0.1, 2.0], [F0 + 0.12, 0.25, 'out'], [1.24, 0.25], [1.29, 2.2, 'out'], [1.42, 1.9], [1.5, 0.25, 'out'], [SLAP + 0.02, 0.25], [SLAP + 0.08, 1.6, 'out'], [SLAP + 0.4, 0.9, 'inOut'], [END - 0.3, 2.0, 'out'], [END, 1, 'inOut']]),
    squint: T([[F0, 1], [F0 + 0.12, 0.3, 'out'], [1.24, 0.3], [1.29, 1.25, 'out'], [1.42, 1.1], [1.5, 0.3, 'out'], [SLAP + 0.02, 0.3], [SLAP + 0.1, 1, 'out']]),
    // upside down: a puzzled look one way, then the other
    look: T([[1.27, 0], [1.33, 0.45, 'out'], [1.4, 0.45], [1.46, -0.35, 'inOut'], [1.54, 0, 'inOut']]),
    // after the clack: shakes herself off
    shake: T([[SLAP + 0.34, 0], [SLAP + 0.38, 1, 'out'], [SLAP + 0.58, 1], [SLAP + 0.64, 0, 'out']]),
  };

  // a gentle push in for the gesture, home again by the end
  const t0 = lab.t;
  const camK = T([[0.6, 0], [1.1, 1, 'inOut'], [SLAP + 0.15, 1], [END, 0, 'inOut']]);
  const camAt = fp.clone().setY(0.55);
  const camRelease = lab.camera((home) => {
    const k = camK(lab.t - t0);
    return { target: home.target.clone().lerp(camAt, 0.4 * k), dist: home.dist * (1 - 0.2 * k) };
  });

  lab.playCard('a', ['m2']);
  let popped = false;
  let slapped = false;
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const lift = L(t);
    const flipping = t >= POP && t < SLAP;
    const psi = t < F0 ? 0 : psiOf(t);

    // ---- the tile and its hole ----
    if (flipping && !popped) {
      popped = true;
      lab.shake(0.025, 0.2);
      if (col) col.halo.visible = false;
    }
    if (t >= SLAP && !slapped) {
      slapped = true;
      lab.shake(0.05, 0.3);
      lab.ring(fp.clone().setY(0.02), '#ffffff', 0.7, 0.02, 0.3);
      lab.ring(fp.clone().setY(0.03), color, 0.5, 0.03, 0.55);
      arena.setTaken([{ color, cp: 1 }]); // in the game: the room's real taken list
      if (col) col.halo.visible = true;
    }
    tile.visible = flipping;
    hole.visible = flipping;
    tile.position.set(fp.x, -HALF + lift + rumble(t), fp.z);
    tile.rotation.set(0, 0, -psi);
    // the edges catch the light while it is out of the slab
    edgeMat.opacity = flipping ? 0.35 + 0.5 * clamp01(lift) : 0;

    // ---- Maya, stuck to the tile's face ----
    const shake = M.shake(t);
    const jiggle = shake * Math.sin((t - SLAP - 0.34) * TAU * 7) * 0.22;
    maya.p.set({
      x: M.x(t) + (t >= F0 && t < SLAP ? HALF * Math.sin(psi) : 0),
      y: flag.y,
      lift: t >= POP && t < SLAP ? lift - HALF + HALF * Math.cos(psi) + rumble(t) : rumble(t),
      pitch: t >= F0 && t < SLAP ? psi : 0,
      rot: east + M.look(t) + jiggle * 0.5,
      trail: t < ARRIVE + 0.05,
    });
    maya.lean = M.lean(t);
    maya.tip = jiggle;
    maya.sq = M.sq(t);
    maya.eye = M.eye(t);
    maya.squint = M.squint(t);

    // ---- bystanders: hop back at the pop, watch it go round, flinch at the clack ----
    for (const a of lookers) {
      const tl = t - a.lag;
      const hop = tl > POP && tl < POP + 0.2 ? Math.sin(((tl - POP) / 0.2) * Math.PI) * 0.1 : 0;
      const back = T([[POP, 0], [POP + 0.06, -0.32, 'out'], [F1, -0.2, 'inOut'], [SLAP, -0.18], [SLAP + 0.05, 0.1, 'out'], [END, 0, 'inOut']])(tl);
      a.p.set({ x: a.home.x, y: a.home.y, rot: a.home.rot, lift: hop, trail: false });
      a.lean = back;
      a.sq = T([[POP, 1], [POP + 0.04, 1.18, 'out'], [POP + 0.24, 1, 'inOut'], [SLAP, 1], [SLAP + 0.04, 0.82, 'out'], [SLAP + 0.3, 1, 'inOut']])(tl);
      a.eye = T([[POP, 1], [POP + 0.04, 2.2, 'out'], [F1, 1.6, 'inOut'], [SLAP, 1.6], [SLAP + 0.02, 0.2, 'out'], [SLAP + 0.12, 0.2], [SLAP + 0.25, 1, 'out']])(tl);
    }
  });

  await lab.wait(END);
  stop();
  camRelease();
  maya.reset();
  maya.p.release({ x: 4, y: 1, d: 1 });
  for (const a of lookers) {
    a.reset();
    const r = sc.bots[a.p.key];
    a.p.release({ x: r.x, y: r.y, d: r.d });
  }
}
