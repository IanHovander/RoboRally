// Skipping stone, through weight and physical comedy: Maya comes in too hot, can't stop, teeters over the edge in
// slow motion... and skips off the dark like a pebble on still water, clinks up the slab's lip and spins down.
export const meta = {
  title: 'Skipping stone: too hot to stop',
  idea:
    'Maya comes in hot, tags flag 2 (the column flashes) and slams on the brakes, but the glass is slick: she skids, fishtailing, sparks of light spraying off her rim, and sails off the east edge. Slow motion: she hangs over the void, nose tipping down like a cartoon character who has just looked down. Then her nose kisses the dark and she skips: five low hops round a loop beyond the slab, each touch blooming small water rings on the black, faster and lower each time, spinning like a thrown stone. The last skim clinks against the slab\'s lip, she hops up onto the glass, glides back onto flag 2 and spins down like a coin on a table (the wobble getting faster and faster) until she settles facing east with a plink.',
  notes:
    'Sound: a rising engine whoosh, a glass squeal for the skid, silence in the slow motion, then a plip per skip (pitch rising as they shorten), a bright clink on the lip, and the classic coin-spin-down whirr accelerating into a single plink. Per form: a Pebble skips (this one); an Orb rolls a lap of the rim and drops back in like a marble in a bowl; a Spire spins round it like a top; a Capsule bobs and floats back; a Cube tumbles end over end on the water; a Prism skips on its point. The water level sits just below the glass top so the trail stays on the black.',
};

const TAU = Math.PI * 2;
const WATER = -0.07;

let dotTex = null;
function glowTexture(THREE) {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const RED = new THREE.Color(lab.bot('a').color);
  const EAST = facing(1);

  // ---------- Maya's pose, composed every frame ----------
  // S.tilt is a lean in world space (toward tx, tz); it is turned into pitch/roll for whatever way she faces.
  const S = { x: 2, y: 1, lift: 0, rot: EAST, tx: 0, tz: 0, sq: 0, spin: 0, spinRate: 0 };
  lab.every((dt) => {
    S.spin += S.spinRate * dt;
    const rot = S.rot + S.spin;
    const fx = -Math.sin(rot);
    const fz = -Math.cos(rot);
    const rx = Math.cos(rot);
    const rz = -Math.sin(rot);
    maya.set({
      x: S.x, y: S.y, lift: S.lift, rot,
      pitch: S.tx * fx + S.tz * fz,
      roll: S.tx * rx + S.tz * rz,
      sy: 1 - S.sq, sx: 1 + S.sq * 0.55, sz: 1 + S.sq * 0.55,
    });
  });

  // ---------- small physical effects ----------
  const glowTex = glowTexture(THREE);
  const fx = (dur, update, end) => lab.tween(dur, update, ease.linear).then(end);
  /** Water rings: three thin rings where she touched, like a pebble on a still pond. */
  function ripple(gx, gy, strength = 1) {
    const at = lab.pos(gx, gy).setY(WATER + 0.002);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 72), new THREE.MeshBasicMaterial({ color: RED.clone().lerp(new THREE.Color(1, 1, 1), 0.35 + i * 0.2).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(at);
      lab.add(m);
      const size = (0.36 + i * 0.2) * (0.6 + 0.4 * strength);
      lab.wait(i * 0.07).then(() => fx(0.95, (e, k) => {
        const s = 0.06 + size * ease.out3(k);
        m.scale.set(s, s, s);
        m.material.opacity = (1 - k) ** 1.4 * (1 - i * 0.18);
      }, () => (m.visible = false)));
    }
    // light pooling on the water where she touched
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: RED.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(at);
    lab.add(pool);
    fx(0.5, (e, k) => {
      pool.scale.setScalar(0.4 + 0.5 * k);
      pool.material.opacity = (1 - k) ** 2 * strength;
    }, () => (pool.visible = false));
    // a few drops of light thrown up, falling back
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1, 0.8, 0.82).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      d.scale.setScalar(0.07);
      lab.add(d);
      const a = lab.range(0, TAU);
      const sp = lab.range(0.3, 0.7);
      const up = lab.range(1.1, 1.7) * strength;
      fx(0.36, (e, k) => {
        const t = k * 0.36;
        d.position.set(at.x + Math.cos(a) * sp * t, at.y + up * t - 9 * t * t, at.z + Math.sin(a) * sp * t);
        d.material.opacity = 1 - k;
      }, () => (d.visible = false));
    }
  }
  /** Sparks of light shaved off her rim by the brakes. */
  function sparks(n) {
    const at = maya.group.position;
    for (let i = 0; i < n; i++) {
      const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.6, 2.4, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      d.scale.setScalar(0.05);
      lab.add(d);
      const p0 = at.clone().add(new THREE.Vector3(0.28, 0.03, lab.range(-0.22, 0.22)));
      const vx = lab.range(1.2, 2.4);
      const vz = lab.range(-0.9, 0.9);
      const vy = lab.range(0.4, 1.0);
      fx(0.3, (e, k) => {
        const t = k * 0.3;
        d.position.set(p0.x + vx * t, Math.max(0.02, p0.y + vy * t - 6 * t * t), p0.z + vz * t);
        d.material.opacity = 1 - k;
      }, () => (d.visible = false));
    }
  }
  const col = arena.columns.find((c) => c.n === 2);
  const flashCol = (strength = 1) => {
    if (!col) return;
    col.flash = lab.t - (1 - strength) * 2.4;
    col.flashColor = RED.clone();
  };

  // ---------- camera: a surprised operator, panning right after her ----------
  let follow = 0;
  const releaseCam = lab.camera((home) => {
    const t = home.target.clone();
    t.x += 1.7 * follow;
    t.z += 0.15 * follow;
    return { target: t, dist: home.dist * (1 + 0.17 * follow), el: home.el + 0.04 * follow };
  });

  // ---------- Move 2, but she comes in hot ----------
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  await lab.wait(0.22);
  arena.emit('move', { id: 'a', n: 2, dur: 0.55 });
  await lab.tween(0.55, (e, k) => {
    S.x = 2 + 2 * (0.5 * k * k + 0.5 * k);
    S.tx = -0.12 * (1 - k * 0.6); // leaning back: she's accelerating
  }, ease.linear);
  // she tags the flag at speed
  flashCol(1);
  arena.emit('checkpoint', { id: 'a', n: 2 });
  arena.emit('win', { id: 'a' });
  lab.ring(lab.pos(4, 1), RED, 1.0, 0.03, 0.5);
  const card = lab.bot('a').card;
  if (card) {
    const base = card.userData.base.clone();
    lab.tween(0.2, (e) => card.scale.set(base.x * (1 - e), base.y * (1 + 0.3 * e), 1), ease.in).then(() => arena.clearCards());
  }
  // brakes! the glass is slick: she skids on, fishtailing, sparks flying
  lab.tween(0.9, (e) => (follow = e), ease.inOut);
  const v0 = 2 * 1.5 / 0.55;
  const T = 0.5;
  const acc = (v0 * T - 2.5) / (0.5 * T * T) ;
  let sparkT = 0;
  await lab.tween(T, (e, k) => {
    const t = k * T;
    S.x = 4 + v0 * t - 0.5 * acc * t * t;
    S.tx = 0.3 * Math.min(1, k * 6); // nose down, braking hard
    S.rot = EAST + Math.sin(k * 15) * 0.28 * Math.min(1, k * 4);
    if (k > sparkT) {
      sparks(3);
      sparkT += 0.18;
    }
  }, ease.linear);
  const vEdge = v0 - acc * T; // ~2.9 spaces/s

  // over the edge: slow motion, she hangs, her nose tips down... (the gasp)
  lab.slowmo(0.25, 0.08);
  await lab.tween(0.09, (e, k) => {
    S.x = 6.5 + vEdge * 0.09 * k;
    S.tx = 0.3 + 0.32 * ease.in(k);
    S.rot = EAST + Math.sin(15 + k * 2) * 0.28 * (1 - k);
    S.lift = -0.02 * k;
  }, ease.linear);
  lab.slowmo(1, 0.1);
  // ...and drops nose-first onto the dark
  const xHang = S.x;
  await lab.tween(0.08, (e, k) => {
    S.x = xHang + vEdge * 0.08 * k;
    S.lift = -0.02 + (WATER + 0.02) * k * k;
  }, ease.linear);

  // ---------- the skips: a loop beyond the end of the slab ----------
  const C = { x: 7.95, y: 1.4 };
  const R = 0.55;
  const A = C.x - S.x; // straight run to the top of the loop
  const L = A + Math.PI * R + (C.x - 6.5);
  const along = (s) => {
    if (s <= A) return { x: S0x + s, y: 1, hx: 1, hy: 0 };
    if (s <= A + Math.PI * R) {
      const th = -Math.PI / 2 + (s - A) / R;
      return { x: C.x + R * Math.cos(th), y: C.y + R * Math.sin(th), hx: -Math.sin(th), hy: Math.cos(th) };
    }
    const u = s - A - Math.PI * R;
    return { x: C.x - u, y: C.y + R, hx: -1, hy: 0 };
  };
  const S0x = S.x;
  const hops = [
    { len: 1.2, dur: 0.3, h: 0.26 },
    { len: 1.0, dur: 0.26, h: 0.19 },
    { len: 0.82, dur: 0.22, h: 0.13 },
    { len: 0.64, dur: 0.18, h: 0.08 },
    { len: 0.46, dur: 0.15, h: 0.045 },
    { len: 0.3, dur: 0.12, h: 0.02 },
  ];
  const scale = L / hops.reduce((a, h) => a + h.len, 0);
  // first touch: the impact squashes her, sets her spinning like a thrown stone, and she's off
  ripple(S.x, 1, 1.1);
  lab.shake(0.02, 0.15);
  S.spinRate = -19;
  let s = 0;
  for (let i = 0; i < hops.length; i++) {
    const h = hops[i];
    const s0 = s;
    const s1 = s + h.len * scale;
    await lab.tween(h.dur, (e, k) => {
      const p = along(s0 + (s1 - s0) * k);
      S.x = p.x;
      S.y = p.y;
      S.lift = WATER + 4 * h.h * k * (1 - k);
      // nose up a touch against the way she's going, squash at the touch
      S.tx = -p.hx * 0.16;
      S.tz = -p.hy * 0.16;
      S.sq = 0.22 * Math.max(0, 1 - k * 7) * (1 - i * 0.12);
    }, ease.linear);
    s = s1;
    S.spinRate *= 0.9;
    if (i < hops.length - 1) ripple(S.x, S.y, 1 - i * 0.16);
  }

  // ---------- clink! the lip of the slab; a hop up onto the glass ----------
  // from here on, her spin is one smooth slow-down that comes to rest exactly facing east
  const D = 0.8;
  const GLIDE = 0.75;
  const yaw0 = S.rot + S.spin;
  const rateNow = Math.abs(S.spinRate);
  S.spin = 0;
  S.spinRate = 0;
  const TT = 0.24 + GLIDE + D;
  const nat = (rateNow * TT) / 2;
  const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const travel = nat + wrapPi(yaw0 - nat - EAST);
  const tYaw = lab.t;
  const stopYaw = lab.every(() => {
    const k = Math.min(1, (lab.t - tYaw) / TT);
    S.rot = yaw0 - travel * (1 - (1 - k) ** 2);
  });
  const lipY = C.y + R;
  lab.ring(lab.pos(6.5, lipY).setY(-0.03), '#ffffff', 0.35, -0.03, 0.3);
  ripple(6.55, lipY, 0.5);
  lab.shake(0.025, 0.15);
  const land = { x: 5.85, y: 1.8 };
  await lab.tween(0.24, (e, k) => {
    S.x = 6.5 + (land.x - 6.5) * k;
    S.y = lipY + (land.y - lipY) * k;
    S.lift = WATER * (1 - k) + 0.32 * 4 * k * (1 - k);
    S.tx = -0.25 * Math.sin(k * Math.PI); // tumbles forward (west) a little over the lip
    S.tz = 0;
    S.sq = 0.25 * Math.max(0, 1 - k * 6);
  }, ease.linear);
  S.lift = 0;
  S.sq = 0.18;
  lab.ring(lab.pos(land.x, land.y), RED, 0.6, 0.03, 0.35);

  // ---------- glide home across the glass, still spinning ----------
  const P0 = land;
  const P1 = { x: 4.45, y: 1.75 };
  const P2 = { x: 4, y: 1 };
  const bez = (u) => ({
    x: (1 - u) ** 2 * P0.x + 2 * u * (1 - u) * P1.x + u * u * P2.x,
    y: (1 - u) ** 2 * P0.y + 2 * u * (1 - u) * P1.y + u * u * P2.y,
  });
  lab.wait(0.15).then(() => lab.tween(1.5, (e) => (follow = 1 - e), ease.inOut));
  await lab.tween(GLIDE, (e, k) => {
    const u = 1 - (1 - k) ** 1.6;
    const p = bez(u);
    S.x = p.x;
    S.y = p.y;
    S.sq = 0.18 * Math.max(0, 1 - k * 5);
    S.tx = 0;
    S.tz = 0;
  }, ease.linear);

  // ---------- the spin-down: a coin on a table ----------
  // the wobble flattens while its precession speeds up (whirr...), then it lies still
  flashCol(0.55);
  await lab.tween(D, (e, k) => {
    const a = 0.38 * (1 - k) ** 1.2;
    const phi = TAU * (1.0 * k + 1.6 * k * k * k);
    S.tx = a * Math.cos(phi);
    S.tz = a * Math.sin(phi);
    S.lift = 0.09 * a;
  }, ease.linear);
  stopYaw();
  // plink
  S.tx = 0;
  S.tz = 0;
  S.rot = EAST;
  S.lift = 0;
  flashCol(0.8);
  lab.ring(lab.pos(4, 1), '#ffffff', 0.45, 0.03, 0.4);
  await lab.tween(0.28, (e, k) => {
    S.lift = 0.04 * Math.sin(k * Math.PI) * (1 - k);
    S.sq = -0.04 * Math.sin(k * Math.PI * 2) * (1 - k);
  }, ease.linear);
  S.lift = 0;
  S.sq = 0;
  releaseCam();
  maya.release({ x: 4, y: 1, d: 1 });
}
