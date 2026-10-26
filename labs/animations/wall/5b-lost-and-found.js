// Lost and found, played as character acting: the Move 3 card above Maya lights a chevron per space. At the wall
// the third one lights anyway, works loose like a wobbly tooth, bonks the fin and sails off over the edge of the
// slab. Maya watches it all the way down, on tiptoe, and sags when it lands on the floor far below, in a little
// glowing pile of every step the walls have eaten tonight. Ava, whose green ones are in that pile, nods.
export const meta = {
  title: 'Lost and found (the wobbly tooth)',
  idea:
    'As Maya rolls, the Move 3 card above her lights one chevron per space. At the wall the third lights anyway (she tried), then wobbles like a loose tooth while she looks up at it, pops off, darts down and bonks the fin (tink), and sails away in a lazy arc over the edge of the slab, turning her colour as it goes. Maya follows it with her whole body: up on tiptoe to see over the fin, leaning out to watch it fall. It lands softly on the dark floor far below in a small glowing pile of other lost steps from tonight, green, blue, gold and red. Maya sags. Across the board Ava, two of whose steps are down there, gives a slow, knowing nod.',
  notes:
    'Sound: chevrons light with three rising glass ticks (the third a little sour), a tiny tink off the fin, a soft descending whistle as it sails, and a muffled glass "pat" when it lands. The pile is persistent: in the game it would live under the board for the whole night (one chevron per lost step, in the player\'s colour, a small random offset so it heaps up), and it never touches the board, so the rules are untouched. The lit chevrons on the card go back to normal as the card settles.',
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
/** 0 outside [a, b], a smooth hump of height 1 inside */
const hump = (k, a, b) => (k <= a || k >= b ? 0 : Math.sin(((k - a) / (b - a)) * Math.PI));

/** A timeline on absolute seconds from the start, so sequential steps never drift. */
function timeline(lab) {
  const T0 = lab.t;
  const now = () => lab.t - T0;
  const span = (a, b, fn, easing = lab.ease.inOut) =>
    new Promise((ok) => {
      const stop = lab.every(() => {
        const t = now();
        if (t < a) return;
        const k = b <= a ? 1 : Math.min(1, (t - a) / (b - a));
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });
  const until = (T) => lab.wait(Math.max(0, T - now()));
  return { now, span, until };
}

/** One chevron of light (the card's glyph), drawn on a 128px canvas: 4px per glyph unit, centred. */
function chevronTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 15;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = '#fff';
  g.shadowBlur = 14;
  g.beginPath();
  g.moveTo(64 - 36, 64 + 18);
  g.lineTo(64, 64 - 18);
  g.lineTo(64 + 36, 64 + 18);
  g.stroke();
  g.shadowBlur = 0;
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft round pool of light (canvas texture). */
function poolTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export default async function play(lab) {
  const { ease, THREE } = lab;
  const { span, until } = timeline(lab);
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const bot = maya.bot;

  const fx = lab.scenario.beats[0];
  const move = fx.find((f) => f.k === 'move');
  const cardId = fx.find((f) => f.k === 'play')?.cards?.[0] ?? 'm3';
  const planned = Number(cardId.slice(1)) || 3;
  const start = move.path[0];
  const [ex, ey] = move.path[move.path.length - 1];
  const steps = move.path.length - 1;
  const W = lab.scenario.grid[0].split(' ').length;
  const H = lab.scenario.grid.length;

  const red = new THREE.Color(bot.color);
  const warm = new THREE.Color(1, 0.93, 0.8);
  const chevTex = chevronTexture(THREE);
  const poolTex = poolTexture(THREE);

  // ----- the pile under the board: every step the walls ate tonight -----
  const FLOOR = -1.585;
  const pileAt = new THREE.Vector3(W / 2 + 0.85, FLOOR, -H / 2 - 1.0); // past the far right corner, in the board's spill
  const pile = new THREE.Group();
  lab.add(pile);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0.5, 0.48, 0.55), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(pileAt).add(new THREE.Vector3(0, 0.002, 0));
  pile.add(pool);
  const PIECE = 0.46; // world size of a chevron's 128px square (matches the card's glyph when the card is at full size)
  const flatChevron = (color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PIECE, PIECE), new THREE.MeshBasicMaterial({ map: chevTex, color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 6;
    return m;
  };
  const earlier = [
    ['#51cf66', -0.22, 0.05, 0.4],
    ['#4dabf7', 0.12, -0.12, 2.2],
    ['#ffd43b', 0.02, 0.2, -0.9],
    ['#51cf66', 0.28, 0.12, 1.1],
    ['#ff4d6d', -0.1, -0.2, 2.9],
    ['#cc5de8', 0.3, -0.26, -0.3],
  ];
  for (const [c, dx, dz, yaw] of earlier) {
    const m = flatChevron(c, 1.4);
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, yaw, 0);
    m.position.set(pileAt.x + dx, FLOOR + 0.004, pileAt.z + dz);
    pile.add(m);
  }

  // ----- the card's chevrons, lit one per space -----
  // card canvas: 180 x 210 px, glyph 93.6px for a 40-unit box (2.34 px per unit), centred. m3's chevrons sit at
  // glyph y 8, 16, 24 (the top one is the step furthest forward); their middles are 10.5, 2.5 and -5.5 units above centre.
  const UNIT = 2.34 / 210; // card heights per glyph unit
  const rows = planned === 3 ? [-5.5, 2.5, 10.5] : planned === 2 ? [-1.5, 7.5] : [1.5]; // bottom (first step) to top
  const lit = rows.map((up) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: chevTex, color: warm.clone().multiplyScalar(2.3), transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    s.renderOrder = 31;
    lab.add(s);
    return { s, up, on: 0, wob: 0, free: false };
  });
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  /** Where chevron i sits on the card right now (world), and the card's height. */
  const onCard = (i) => {
    const card = bot.card;
    if (!card) return null;
    lab.camera3.updateMatrixWorld();
    camRight.setFromMatrixColumn(lab.camera3.matrixWorld, 0);
    camUp.setFromMatrixColumn(lab.camera3.matrixWorld, 1);
    const h = card.scale.y;
    return { at: card.position.clone().addScaledVector(camUp, lit[i].up * UNIT * h), h, visible: card.visible, opacity: card.material.opacity };
  };
  const placeLit = () => {
    lit.forEach((c, i) => {
      if (c.free) return;
      const p = onCard(i);
      if (!p) return void (c.s.visible = false);
      c.s.visible = p.visible;
      c.s.position.copy(p.at);
      c.s.scale.setScalar(32 * UNIT * p.h);
      c.s.material.opacity = c.on * p.opacity;
      c.s.material.rotation = c.wob;
    });
  };

  // the flying one: a flat chevron that starts facing the camera, exactly over the card's
  const flyer = flatChevron(warm, 2.3);
  flyer.material.depthTest = true;
  flyer.visible = false;
  lab.add(flyer);

  // ----- faces -----
  const face = { eye: 1 };
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * face.eye, 3.1 * face.eye, 2.9 * face.eye);
    placeLit();
  };
  const avaFace = { eye: 1 };
  ava.each = (m) => m.eyeMat.color.setRGB(3.2 * avaFace.eye, 3.1 * avaFace.eye, 2.9 * avaFace.eye);

  // the fin
  const finAt = lab.pos(ex + 0.5, ey);
  const fin = lab.arena.board.children.find((o) => o.isGroup && o.children.length === 2 && Math.hypot(o.position.x - finAt.x, o.position.z - finAt.z) < 0.05);
  const capMat = fin?.children[1].material;
  const cap0 = capMat?.color.clone();
  lab.cleanup(() => cap0 && capMat.color.copy(cap0));

  const rot0 = maya.pose.rot; // east
  const avaRot0 = ava.pose.rot;
  const avaAt = { x: ava.pose.x, y: ava.pose.y };
  const avaW = lab.pos(avaAt.x, avaAt.y);
  const avaLook = (wx, wz) => avaRot0 + wrap(Math.atan2(-(wx - avaW.x), -(wz - avaW.z)) - avaRot0);
  const here = lab.pos(ex, ey);
  // Maya's look toward the pile (a yaw offset from east, + = left)
  const toPile = wrap(Math.atan2(-(pileAt.x - here.x), -(pileAt.z - here.z)) - rot0);

  // the beats
  const T_GO = 0.08;
  const T_HIT = 0.5;
  const T_WOB = 0.56; // the third chevron lights anyway, and wobbles
  const T_POP = 0.78; // pops off
  const T_BONK = 0.9; // bonks the fin
  const T_LAND = 1.86; // lands far below
  const T_END = 2.4;

  lab.playCard('a', [cardId]);

  // ----- the chevrons -----
  const chevShow = (async () => {
    // one per space as she rolls; the last one at the wall, a little late
    const litAt = (i, T) => span(T, T + 0.1, (e) => (lit[i].on = e), ease.out);
    const spaceT = (n) => {
      // when her centre passes space n of the path (she starts at x0, arrives at T_HIT)
      const k = n / steps;
      const s = (-0.6 + Math.sqrt(0.36 + 1.6 * k)) / 0.8; // inverse of 0.4k^2 + 0.6k
      return T_GO + (T_HIT - T_GO) * s;
    };
    for (let i = 0; i < steps && i < lit.length; i++) litAt(i, spaceT(i + 1) - 0.04);
    const lost = lit.slice(steps);
    if (!lost.length) return;
    const c = lost[lost.length - 1]; // the step that never happened
    for (const o of lost.slice(0, -1)) litAt(lit.indexOf(o), T_WOB);
    await litAt(lit.indexOf(c), T_WOB - 0.02);
    // the wobbly tooth
    await span(T_WOB + 0.08, T_POP, (e, k) => (c.wob = Math.sin(k * TAU * 2.5) * 0.35 * (0.3 + 0.7 * k)), ease.linear);
    // pops off: swap to the flying chevron, exactly where it was
    const p = onCard(lit.indexOf(c));
    c.free = true;
    c.s.visible = false;
    flyer.visible = true;
    const from = p.at.clone();
    const sizeK = (32 * UNIT * p.h) / PIECE;
    const qCam = lab.camera3.quaternion.clone();
    const spin = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    // a little hop up off the card, then a dart down to the top of the fin
    const finTop = finAt.clone().add(new THREE.Vector3(-0.06, 0.34, 0));
    await span(T_POP, T_BONK, (e, k) => {
      const hop = new THREE.Vector3(0, 0.18 * hump(k, 0, 0.6), 0);
      flyer.position.copy(from).lerp(finTop, ease.in(k)).add(hop);
      spin.setFromAxisAngle(zAxis, c.wob * (1 - k) - 1.2 * ease.in(k));
      flyer.quaternion.copy(qCam).multiply(spin);
      flyer.scale.setScalar(lerp(sizeK, 0.8, k));
    }, ease.linear);
    // bonk
    if (capMat && cap0) {
      span(T_BONK, T_BONK + 0.25, (e, k) => capMat.color.copy(cap0).multiplyScalar(1 + 2.5 * (1 - k) ** 2), ease.linear);
    }
    // the lazy arc: up and away over the far right corner of the slab, then a long fall in the dark.
    // It turns her colour as it goes and tumbles slowly until it lies flat on the floor.
    const land = pileAt.clone().add(new THREE.Vector3(-0.05, 0.006, 0.08));
    const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0.9, 0, 'YXZ'));
    const dur = T_LAND - T_BONK;
    const peak = 0.95; // how far above the fin it rises
    const g = ((Math.sqrt(2 * peak) + Math.sqrt(2 * (peak + finTop.y - land.y))) / dur) ** 2;
    const vy = Math.sqrt(2 * g * peak);
    await span(T_BONK, T_LAND, (e, k) => {
      const t = k * dur;
      const across = ease.out(k) * 0.35 + k * 0.65; // a touch of drag: quick off the fin, floating at the top
      flyer.position.set(lerp(finTop.x, land.x, across), finTop.y + vy * t - 0.5 * g * t * t, lerp(finTop.z, land.z, across));
      flyer.material.color.copy(warm).lerp(red, ease.out(clamp01(k * 1.6))).multiplyScalar(lerp(2.3, 1.7, k));
      spin.setFromAxisAngle(zAxis, -1.2 - 2.6 * k + 0.4 * Math.sin(k * TAU * 1.5));
      flyer.quaternion.copy(qCam).multiply(spin).slerp(qFlat, ease.inOut(clamp01((k - 0.3) / 0.7)));
      flyer.scale.setScalar(lerp(0.8, 1, k));
    }, ease.linear);
    flyer.position.copy(land);
    flyer.quaternion.copy(qFlat);
    // the soft landing: a little puff of her colour, the pool brightens, and it settles to a faint glow
    lab.ring(land.clone().setY(FLOOR + 0.01), bot.color, 0.7, FLOOR + 0.01, 0.6);
    await span(T_LAND, T_END, (e, k) => {
      flyer.material.color.copy(red).multiplyScalar(lerp(1.7, 1.4, e) + 1.2 * (1 - k) ** 3);
      pool.material.opacity = 0.55 + 0.4 * (1 - k) ** 2;
    }, ease.out);
  })();
  // the card's lights go back to normal as the card settles
  const cardBack = (async () => {
    await until(T_LAND - 0.2);
    const from = lit.map((c) => c.on);
    await span(T_LAND - 0.2, T_END, (e) => lit.forEach((c, i) => (c.on = from[i] * (1 - e))), ease.inOut);
  })();

  // ----- Ava: watches it go, then a slow, knowing nod -----
  const avaShow = (async () => {
    const towardFin = avaLook(finAt.x, finAt.z);
    await span(T_BONK - 0.02, T_BONK + 0.2, (e) => ava.set({ rot: lerp(avaRot0, towardFin, e) }), ease.out);
    const towardPile = avaLook(pileAt.x, pileAt.z);
    await span(T_BONK + 0.3, T_LAND - 0.1, (e) => ava.set({ rot: lerp(towardFin, towardPile, e), pitch: -0.12 * hump(e, 0, 0.8) + 0.1 * clamp01((e - 0.7) / 0.3) }), ease.inOut);
    // the nod: she knows exactly where that went
    await span(T_LAND + 0.06, T_END - 0.12, (e, k) => {
      const nod = hump(k, 0, 0.5) + 0.6 * hump(k, 0.5, 1);
      ava.set({ pitch: 0.1 + 0.18 * nod, rot: lerp(towardPile, avaRot0, ease.inOut(clamp01((k - 0.55) / 0.45))) });
      avaFace.eye = 1 - 0.25 * nod;
    }, ease.linear);
    await span(T_END - 0.12, T_END, (e) => ava.set({ pitch: 0.1 * (1 - e), rot: avaRot0 }), ease.out);
  })();

  // ----- Maya -----
  await span(0, T_GO, (e) => maya.set({ x: start[0] - 0.04 * e, pitch: -0.1 * e, sy: 1 - 0.05 * e }), ease.out);
  const x0 = start[0] - 0.04;
  await span(T_GO, T_HIT, (e, k) => {
    const s = 0.4 * k * k + 0.6 * k;
    maya.set({ x: x0 + (ex + 0.04 - x0) * s, pitch: -0.1 + 0.22 * clamp01(k * 3), sy: 0.95 + 0.05 * clamp01(k * 4), sz: 1 + 0.05 * clamp01(k * 3) });
  }, ease.linear);
  // tink: a little squash; then she looks up at the card: "hm?"
  await span(T_HIT, T_WOB + 0.06, (e, k) => {
    const sq = hump(k, 0, 0.6);
    maya.set({ x: ex + 0.04 * (1 - e), sz: 1 - 0.12 * sq, sx: 1 + 0.05 * sq, pitch: 0.12 * (1 - e) });
    face.eye = 1 + 0.3 * hump(k, 0, 0.4);
  }, ease.out);
  await span(T_WOB + 0.06, T_POP, (e) => {
    maya.set({ pitch: -0.42 * e, sy: 1 + 0.06 * e, roll: 0.12 * Math.sin(e * Math.PI) });
    face.eye = 1 + 0.2 * e;
  }, ease.out);
  // her head follows it down to the fin: a quick nod... and flinches at the bonk
  await span(T_POP, T_BONK, (e) => maya.set({ pitch: lerp(-0.42, 0.22, e), roll: 0 }), ease.in);
  await span(T_BONK, T_BONK + 0.1, (e, k) => {
    maya.set({ pitch: 0.22 - 0.1 * e, sy: 1.06 - 0.12 * hump(k, 0, 1), sx: 1 + 0.04 * hump(k, 0, 1) });
    face.eye = 1.2 - 0.6 * hump(k, 0, 1);
  }, ease.linear);
  // tracks it up and away: rising on tiptoe to see over the fin, turning after it
  const T_PEAK = T_BONK + 0.36;
  await span(T_BONK + 0.1, T_PEAK, (e) => {
    maya.set({ pitch: lerp(0.12, -0.38, e), rot: rot0 + toPile * 0.45 * e, sy: lerp(1.06, 1.16, e), sx: lerp(1, 0.95, e), lift: 0.06 * e });
    face.eye = lerp(1.2, 1.35, e);
  }, ease.out);
  // ...and leans right out over the fin to watch it fall
  await span(T_PEAK, T_LAND, (e) => {
    maya.set({ pitch: lerp(-0.38, 0.3, e), rot: rot0 + toPile * lerp(0.45, 0.85, e), sy: lerp(1.16, 1.1, e), x: ex + 0.05 * e, lift: lerp(0.06, 0.03, e) });
  }, ease.inOut);
  // it lands. The sag.
  await span(T_LAND, T_LAND + 0.26, (e) => {
    maya.set({ pitch: lerp(0.3, 0.2, e), sy: lerp(1.1, 0.86, e), sx: lerp(0.95, 1.05, e), lift: 0.03 * (1 - e), x: ex + 0.05 * (1 - e) });
    face.eye = lerp(1.35, 0.55, e);
  }, ease.inOut);
  // and a resigned turn back to the wall
  await span(T_LAND + 0.26, T_END, (e) => {
    maya.set({ pitch: 0.2 * (1 - e), rot: rot0 + toPile * 0.85 * (1 - e), sy: lerp(0.86, 1, e), sx: lerp(1.05, 1, e), x: ex, lift: 0 });
    face.eye = lerp(0.55, 1, e);
  }, ease.inOut);

  await chevShow;
  await cardBack;
  await avaShow;
  await until(T_END);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0, rot: rot0, x: ex });
  ava.set({ sy: 1, lift: 0, pitch: 0, roll: 0, rot: avaRot0 });
  for (const c of lit) c.s.visible = false;
  maya.each = null;
  ava.each = null;
  maya.release({ x: ex, y: ey, d: 1 });
  ava.release({ x: avaAt.x, y: avaAt.y, d: 3 });
}
