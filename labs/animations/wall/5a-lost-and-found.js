// Wall, idea 47 (Lost and found), animator a: weight and physical comedy.
// The Move 3 card over Maya lights one chevron per space. She stops dead at the fin with the third one lit,
// the card lurches on its spring, and like a loose part off a car that brakes too hard, the third chevron flies
// off it: it drops onto the fin (tink), skips across the glass like a stone over the spaces she never reached,
// skids to the very edge of the slab and teeters there... and tips over. It tumbles down through the dark and
// lands softly on the floor far below, on a small glowing pile of other lost steps in other players' colours,
// which jostle as it lands. The board is unchanged; the room keeps the record.
export const meta = {
  title: 'Lost and found (the skipping step)',
  idea:
    'Her card lights a chevron per space. At the wall the card lurches and the third chevron, still lit, flies off it like a loose part: it bonks the fin, skips across the glass like a stone over the spaces she never reached, skids to the edge of the slab, teeters... and tips over. It tumbles through the dark and lands softly on a little glowing pile of other players\' lost steps on the floor below, which jostle as it lands. The board stays exactly as the rules say; the room keeps the score.',
  notes:
    'Sound: a chime per lit chevron (rising), a tiny tink on the fin, two light glass skips, a scrape, a held breath at the edge, a falling glassy whistle, and a soft clink on the pile. ' +
    'The pile persists all night (in the arena, not on the board): one chevron per lost step, in its player\'s colour, landing a little apart so it grows into a heap. It sits on the floor just outside the slab\'s right edge so the home camera sees it. ' +
    'Varies: a robot stopped after one space of a Move 3 loses two chevrons; the second one follows the first a beat later. The card is redrawn with the chevron missing while it flies, and put back when the game moves on.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  lab.playCard('a', ['m3']);
  const glowTex = maya.model.poolMat.map;
  const RED = new THREE.Color(bot.color);
  const FLOOR = -1.585;

  // ---- her card, redrawn by us so a chevron can light, and leave ----
  const cardCv = document.createElement('canvas');
  cardCv.width = 360;
  cardCv.height = 420;
  const cardTex = new THREE.CanvasTexture(cardCv);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  const cardMat = bot.card.material;
  const map0 = cardMat.map;
  cardMat.map = cardTex;
  cardMat.needsUpdate = true;
  lab.cleanup(() => {
    cardMat.map = map0;
    cardMat.needsUpdate = true;
    cardTex.dispose();
  });
  const drawCard = (lit, gone) => {
    const g = cardCv.getContext('2d');
    g.clearRect(0, 0, 360, 420);
    g.save();
    g.shadowColor = 'rgba(255,250,235,.85)';
    g.shadowBlur = 43;
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.roundRect(60, 60, 240, 300, 38);
    g.fill();
    g.restore();
    // the glyph's three chevrons (bottom one is the first step), as the game draws them
    g.save();
    g.translate(180 - 93.6, 210 - 93.6);
    g.scale(4.68, 4.68);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    [24, 16, 8].forEach((y, i) => {
      const path = new Path2D(`M11 ${y + 6} L20 ${y - 3} L29 ${y + 6}`);
      g.save();
      if (gone && i === 2) {
        g.strokeStyle = 'rgba(21,24,29,.13)'; // the empty slot
        g.lineWidth = 1.2;
        g.setLineDash([1.2, 2]);
      } else if (i < lit) {
        g.strokeStyle = bot.color;
        g.shadowColor = bot.color;
        g.shadowBlur = 14;
        g.lineWidth = 4.4;
      } else {
        g.strokeStyle = '#15181d';
        g.lineWidth = 3.6;
      }
      g.stroke(path);
      if (i < lit && !(gone && i === 2)) g.stroke(path); // twice: brighter
      g.restore();
    });
    g.restore();
    cardTex.needsUpdate = true;
  };
  let cardState = '';
  const showCard = (lit, gone) => {
    const key = `${lit}${gone}`;
    if (key !== cardState) drawCard(lit, gone);
    cardState = key;
  };
  showCard(0, false);

  // ---- a chevron of light (two short bars meeting at the apex, apex along local +y) ----
  const makeChevron = (color, k, size = 1) => {
    const holder = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * size, 0.055 * size, 0.03 * size), mat);
      arm.position.set(s * 0.0707 * size, -0.0707 * size + 0.05 * size, 0);
      arm.rotation.z = s * -Math.PI / 4;
      holder.add(arm);
    }
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55 * size, 0.55 * size),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(0.9), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    holder.add(halo);
    holder.userData = { mat, halo, color: new THREE.Color(color) };
    return lab.add(holder);
  };
  // flat on a surface, apex pointing east, normal up
  const QF = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  const qY = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  const qZ = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);

  // ---- the pile on the floor below: lost steps from earlier in the night, faintly glowing ----
  const pileSpots = [
    ['#4dabf7', 4.12, 0.05, 0.6],
    ['#ffd43b', 4.38, 0.3, -0.9],
    ['#51cf66', 4.05, 0.42, 2.2],
    ['#cc5de8', 4.42, -0.12, 1.3],
    ['#4dabf7', 4.26, 0.62, -2.5],
    ['#ff4d6d', 4.6, 0.18, 0.2],
  ];
  const pile = pileSpots.map(([c, x, z, yaw]) => {
    const ch = makeChevron(c, 1.15, 1.25);
    ch.position.set(x, FLOOR, z);
    ch.quaternion.copy(qY(yaw)).multiply(QF);
    ch.userData.halo.material.opacity = 0.35;
    ch.userData.base = ch.position.clone();
    ch.userData.yaw = yaw;
    return ch;
  });
  const pool = lab.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.4),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#f4efe4').multiplyScalar(0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(4.25, FLOOR + 0.004, 0.25);

  // ---- the loose chevron ----
  const loose = makeChevron(bot.color, 2.6, 1.25);
  loose.visible = false;

  // ---- small lights ----
  const glow = (c, size, k = 2.4) =>
    lab.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(c).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      ),
    );
  const tink = glow('#ffffff', 0.34, 3);
  tink.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(-0.03, 0.17, 0));
  const bonk = glow('#ffffff', 0.45, 3);
  const lights = [tink, bonk];
  // ripples on the glass where it skips, and on the floor where it lands
  const ripple = (y) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    return lab.add(m);
  };
  const ripples = [ripple(0.012), ripple(0.012), ripple(FLOOR + 0.01)];
  const rippleAt = (m, t0, t, size) => {
    const u = t - t0;
    if (u < 0 || u > 0.5) return (m.visible = false);
    m.visible = true;
    const k = u / 0.5;
    m.scale.setScalar(0.06 + size * ease.out(k));
    m.material.opacity = 0.9 * (1 - k) ** 2;
  };

  // her card hangs over her on a soft spring: it lurches when she stops dead (that's what flings the chevron)
  const card = { p: null, v: new THREE.Vector3(), t: null };
  maya.each = (m, t) => {
    if (bot.card) {
      const want = bot.card.position.clone();
      if (!card.p) card.p = want.clone();
      const dt = card.t == null ? 0 : Math.min(0.05, t - card.t);
      card.t = t;
      const W = 12;
      const acc = want.clone().sub(card.p).multiplyScalar(W * W).addScaledVector(card.v, -2 * 0.3 * W);
      card.v.addScaledVector(acc, dt);
      card.p.addScaledVector(card.v, dt);
      bot.card.position.set(card.p.x, want.y, card.p.z);
    }
    for (const l of lights) l.quaternion.copy(lab.camera3.quaternion);
  };

  const T = {
    run: 0.1,
    hit: 0.52, // stopped dead with two chevrons lit
    third: 0.56, // she strains for the third: it lights
    loose: 0.64, // the card lurches and it flies off
    bonk: 0.96, // onto the fin: tink
    skip1: 1.18, // skips across the glass
    skip2: 1.33,
    edge: 1.47, // skids to the very edge
    tip: 1.7, // teeters... and tips over
    land: 2.1, // onto the pile below
    end: 2.4,
  };
  const A = 0.42;
  const run = (k) => (k < A ? (k * k) / (2 * A) : A / 2 + (k - A)) / (1 - A / 2);
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const finTop = lab.pos(3.5, 1).add(new THREE.Vector3(-0.02, 0.3, 0));
  const S1 = new THREE.Vector3(1.2, 0.03, -0.4);
  const S2 = new THREE.Vector3(2.3, 0.03, -0.26);
  const E = new THREE.Vector3(3.44, 0.03, -0.16); // the slab's right edge is at x = 3.5
  const L = new THREE.Vector3(3.98, FLOOR + 0.02, 0.0);
  let start = null; // where it left the card
  const camUp = new THREE.Vector3();
  const qStart = new THREE.Quaternion();
  const hop = (a, b, k, h) => new THREE.Vector3(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + 4 * h * k * (1 - k), lerp(a.z, b.z, k));

  await lab.tween(T.end, (_, kk) => {
    const t = kk * T.end;
    const pose = { x: 3, y: 1, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    for (const l of lights) l.material.opacity = 0;

    // ---- 1. the run, flat out; one chevron lights per space ----
    if (t < T.run) {
      const e = ease.out(t / T.run);
      Object.assign(pose, { x: 1 - 0.05 * e, pitch: -0.1 * e });
    } else if (t < T.hit) {
      const k = seg(t, T.run, T.hit);
      Object.assign(pose, { x: 0.95 + 2.05 * run(k), pitch: -0.1 + 0.18 * Math.min(1, k * 2) });
    } else {
      // stopped dead; she strains at the fin for the third step
      const u = t - T.hit;
      tink.material.opacity = 0.6 * (u < 0.025 ? u / 0.025 : Math.max(0, 1 - (u - 0.025) / 0.12) ** 2);
      const sq = Math.exp(-u / 0.05) * Math.cos(u * 40);
      const strain = Math.sin(seg(t, T.hit, T.loose + 0.04) * Math.PI);
      Object.assign(pose, { sz: 1 - 0.1 * sq - 0.05 * strain, sx: 1 + 0.04 * sq, pitch: 0.12 * strain + 0.06 * Math.exp(-u / 0.06) });
    }
    const lit = t >= T.third ? 3 : pose.x >= 2.95 ? 2 : pose.x >= 2 ? 1 : 0;
    showCard(lit, t >= T.loose);

    // ---- 2. the third chevron flies off the card ----
    loose.visible = t >= T.loose && t < T.end;
    if (loose.visible) {
      if (!start) {
        camUp.set(0, 1, 0).applyQuaternion(lab.camera3.quaternion);
        start = bot.card.position.clone().addScaledVector(camUp, 0.117 * bot.card.scale.y);
        qStart.copy(lab.camera3.quaternion);
      }
      const P = new THREE.Vector3();
      const q = new THREE.Quaternion();
      let glowK = 1;
      let col = RED;
      if (t < T.bonk) {
        // flung forward by the card's lurch, then drops onto the fin (stylized gravity, quick)
        const T1 = T.bonk - T.loose;
        const u = t - T.loose;
        const g = 22;
        const v0 = finTop.clone().sub(start).multiplyScalar(1 / T1);
        v0.y += 0.5 * g * T1;
        P.copy(start).addScaledVector(v0, u);
        P.y -= 0.5 * g * u * u;
        // from facing us (as on the card) to tumbling
        const k = seg(t, T.loose, T.loose + 0.16);
        q.copy(qStart).slerp(qZ(-1.2 * u).multiply(qY(2 * u)).multiply(QF), ease.inOut(k));
      } else if (t < T.skip1) {
        // tink! up off the fin and over: the first skip, spinning flat like a stone
        const k = seg(t, T.bonk, T.skip1);
        P.copy(hop(finTop, S1, k, 0.42));
        q.copy(qY(-9 * (t - T.bonk))).multiply(QF);
        q.premultiply(qZ(0.5 * (1 - ease.out(k)))); // still tipped from the bonk, levels out
      } else if (t < T.skip2) {
        const k = seg(t, T.skip1, T.skip2);
        P.copy(hop(S1, S2, k, 0.18));
        q.copy(qY(-9 * (t - T.bonk))).multiply(QF);
      } else if (t < T.edge) {
        // skids, slowing, to the very edge
        const k = ease.out(seg(t, T.skip2, T.edge));
        P.copy(S2).lerp(E, k);
        const spin = -9 * (T.skip2 - T.bonk) - 2.4 * k;
        q.copy(qY(spin)).multiply(QF);
      } else {
        const spin = -9 * (T.skip2 - T.bonk) - 2.4;
        const flat = qY(spin).multiply(QF);
        if (t < T.tip) {
          // teeters on the edge: dips over, catches itself, dips... and goes
          const k = seg(t, T.edge, T.tip);
          const phi = 0.42 * Math.sin(k * Math.PI * 2.2) * (1 - 0.3 * k) + 0.55 * ease.in3(seg(k, 0.6, 1));
          q.copy(qZ(-Math.max(0, phi))).multiply(flat);
          P.copy(E).add(new THREE.Vector3(0.06 * ease.in(k), -0.03 * Math.max(0, phi), 0));
        } else if (t < T.land) {
          // tips over and tumbles down through the dark, lazily, to the floor
          const k = seg(t, T.tip, T.land);
          const from = E.clone().add(new THREE.Vector3(0.06, -0.03, 0));
          P.set(lerp(from.x, L.x, ease.out(k)) + 0.05 * Math.sin(k * 7), lerp(from.y, L.y, k * k), lerp(from.z, L.z, k));
          const phi = 0.55 + (Math.PI * 2 - 0.55) * ease.inOut(k);
          q.copy(qZ(-phi)).multiply(flat);
          glowK = 1 + 0.3 * Math.sin(k * Math.PI);
        } else {
          // lands softly on the pile: a little hop, a coin-like wobble, then lies still and glows faintly
          const u = t - T.land;
          const bounce = 0.07 * Math.max(0, Math.sin(Math.min(1, u / 0.14) * Math.PI)) * (u < 0.14 ? 1 : 0);
          P.copy(L).add(new THREE.Vector3(0, bounce, 0));
          const wob = 0.22 * Math.exp(-u / 0.08) * Math.sin(u * 48);
          q.copy(qZ(-Math.PI * 2 - wob)).multiply(flat);
          glowK = 0.45 + 0.9 * Math.exp(-u / 0.12);
          col = RED;
        }
      }
      loose.position.copy(P);
      loose.quaternion.copy(q);
      loose.userData.mat.color.copy(col).multiplyScalar(2.6 * glowK);
      loose.userData.halo.material.opacity = Math.min(1, 0.6 * glowK);
      loose.userData.halo.quaternion.copy(q.clone().invert().multiply(lab.camera3.quaternion));
      // tink on the fin
      const ub = t - T.bonk;
      if (ub > 0 && ub < 0.25) {
        bonk.position.copy(finTop).add(new THREE.Vector3(0, 0.02, 0));
        bonk.material.opacity = (ub < 0.02 ? ub / 0.02 : Math.max(0, 1 - (ub - 0.02) / 0.16) ** 2) * 0.9;
      }
    }
    // ripples where it skips and where it lands
    rippleAt(ripples[0], T.skip1, t, 0.45);
    ripples[0].position.x = S1.x;
    ripples[0].position.z = S1.z;
    rippleAt(ripples[1], T.skip2, t, 0.3);
    ripples[1].position.x = S2.x;
    ripples[1].position.z = S2.z;
    rippleAt(ripples[2], T.land, t, 0.7);
    ripples[2].position.x = L.x;
    ripples[2].position.z = L.z;

    // the pile jostles when it lands and glows up for a moment
    const ul = t - T.land;
    pile.forEach((ch, i) => {
      const d = ch.userData.base.distanceTo(L);
      const k = ul > 0 ? Math.exp(-ul / 0.15) * Math.max(0, 1 - d / 0.9) : 0;
      ch.position.copy(ch.userData.base);
      ch.position.y += 0.05 * k * Math.abs(Math.sin(ul * 30 + i));
      ch.quaternion.copy(qY(ch.userData.yaw + 0.25 * k * Math.sin(ul * 25 + i))).multiply(QF);
      const c = ch.userData.color;
      ch.userData.mat.color.copy(c).multiplyScalar(1.15 + 1.2 * (ul > 0 ? Math.exp(-ul / 0.2) : 0));
    });
    pool.material.color.set('#f4efe4').multiplyScalar(0.18 + 0.2 * (ul > 0 ? Math.exp(-ul / 0.25) : 0));

    maya.set(pose);
  }, ease.linear);

  maya.each = null;
  showCard(3, true);
  maya.release({ x: 3, y: 1, d: 1 });
}
