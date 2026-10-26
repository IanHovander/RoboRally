// Long exposure, through weight and physical comedy: the whole game's trails crack in like whips, hang as one
// photograph, then reel back into their robots like tape measures, oldest end first, each one slamming home.
export const meta = {
  title: 'Long exposure: tape measure',
  idea:
    'The instant Maya touches flag 2, every trail drawn this game cracks back onto the glass like a whip: each head races from its start to its robot in half a second, the ribbon still wobbling behind it, and snaps taut with a jolt that rocks its robot. The long-exposure photograph hangs (Theo\'s loop-the-loops, Jun\'s line running off the front edge and dangling, one drop of light dripping to the floor far below), then every trail reels back in like a tape measure, oldest end first, whipping round the loops and slamming into its robot. Maya\'s last two spaces go out last, with the biggest clack.',
  notes:
    'Sound: a glass whip-crack (soft, high) as the heads land; a single water plink when the drip hits the floor; the reel-in is a rising zip per trail ending in a glass clack, Jun, Theo, then Maya lowest and loudest. Port: keep a per-robot log of moves (path points, with a gap for falls and a restart at the reboot token); draw each log as one ribbon. Ribbon speed is per robot (all heads land together), so a messy game whips faster. Robots never change space or facing; they only rock on their springs.',
};

const TAU = Math.PI * 2;

/** Grid waypoints [x, y, h?] to a dense list of world points along the glass, corners rounded. */
function rounded(lab, way, r = 0.34) {
  const P = way.map(([x, y, h = 0.012]) => lab.pos(x, y).setY(h));
  const out = [];
  const line = (a, b) => {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.04));
    for (let i = 1; i <= n; i++) out.push(a.clone().lerp(b, i / n));
  };
  out.push(P[0].clone());
  let from = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const d1 = b.clone().sub(a);
    const d2 = c.clone().sub(b);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    const p0 = b.clone().addScaledVector(d1.normalize(), -rr);
    const p1 = b.clone().addScaledVector(d2.normalize(), rr);
    line(from, p0);
    for (let k = 1; k <= 10; k++) {
      const u = k / 10;
      out.push(p0.clone().multiplyScalar((1 - u) ** 2).addScaledVector(b, 2 * u * (1 - u)).addScaledVector(p1, u * u));
    }
    from = p1;
  }
  line(from, P[P.length - 1]);
  return out;
}

let crossTex = null;
function crossTexture(THREE) {
  if (crossTex) return crossTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.32, '#444');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.68, '#444');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  crossTex = new THREE.CanvasTexture(c);
  crossTex.colorSpace = THREE.SRGBColorSpace;
  return crossTex;
}

let dotTex = null;
function glowTexture(THREE) {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

/** A ribbon of light along one robot's whole history (segments = pieces between falls). */
function makeRibbon(lab, segs, color, width = 0.13) {
  const { THREE } = lab;
  const pts = [];
  let s = 0;
  segs.forEach((seg, j) => seg.forEach((p, i) => {
    if (i) s += p.distanceTo(seg[i - 1]);
    pts.push({ p, s, j });
  }));
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const a = pts[i - 1]?.j === pts[i].j ? pts[i - 1] : pts[i];
    const b = pts[i + 1]?.j === pts[i].j ? pts[i + 1] : pts[i];
    const t = b.p.clone().sub(a.p).normalize();
    pts[i].t = t;
    pts[i].w = Math.abs(t.y) > 0.6 ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(-t.z, 0, t.x).normalize();
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6);
  const col = new Float32Array(N * 6);
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    if (pts[i].j !== pts[i + 1].j) continue;
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: crossTexture(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  lab.add(mesh);
  const base = new THREE.Color(color);
  const white = new THREE.Color(1, 0.97, 0.92);
  const c = new THREE.Color();
  return {
    L: s,
    pts,
    /** head/tail in arc length; off(i, s) = sideways wobble; tips 0..1 = how hot the moving ends are. */
    draw(head, tail, off, { bright = 1, headHot = 1, tailHot = 0 } = {}) {
      for (let i = 0; i < N; i++) {
        const q = pts[i];
        const on = q.s <= head + 1e-4 && q.s >= tail - 1e-4 ? 1 : 0;
        const hot = Math.max(headHot * Math.exp(-(head - q.s) / 0.22), tailHot * Math.exp(-(q.s - tail) / 0.22));
        const o = off ? off(i, q.s) : 0;
        const wd = width * (1 + hot * 0.6);
        const x = q.p.x + q.w.x * o;
        const z = q.p.z + q.w.z * o;
        pos[i * 6] = x - q.w.x * wd;
        pos[i * 6 + 1] = q.p.y;
        pos[i * 6 + 2] = z - q.w.z * wd;
        pos[i * 6 + 3] = x + q.w.x * wd;
        pos[i * 6 + 4] = q.p.y;
        pos[i * 6 + 5] = z + q.w.z * wd;
        c.copy(base).lerp(white, Math.min(0.85, hot)).multiplyScalar(on * bright * (1.55 + hot * 2.2));
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    /** world position + tangent at arc length s */
    at(s0) {
      let i = pts.findIndex((q) => q.s >= s0);
      if (i < 0) i = N - 1;
      return pts[i];
    },
  };
}

/** A robot on springs: kicks push its base a little and rock it; it always comes back to rest. */
function springs(lab, p, rest) {
  const kicks = [];
  const fwd = [[0, -1], [1, 0], [0, 1], [-1, 0]][rest.d];
  const right = [[1, 0], [0, 1], [-1, 0], [0, -1]][rest.d];
  const extra = { pitch: 0, sy: 0, ox: 0 };
  lab.every((dt, t) => {
    let ox = extra.ox * fwd[0];
    let oy = extra.ox * fwd[1];
    let pitch = extra.pitch;
    let roll = 0;
    let sq = extra.sy;
    for (const k of kicks) {
      const u = t - k.t0;
      if (u < 0) continue;
      const env = Math.exp(-u * 6.5);
      const move = env * Math.sin(u * 17) * k.amp;
      ox += k.dx * move;
      oy += k.dy * move;
      const lean = env * Math.cos(u * 17) * (1 - Math.exp(-u * 60)) * k.amp * 4.2;
      const f = k.dx * fwd[0] + k.dy * fwd[1];
      const r = k.dx * right[0] + k.dy * right[1];
      pitch -= f * lean;
      roll -= r * lean;
      sq += Math.exp(-u * 14) * k.amp * 2.2;
    }
    p.set({ x: rest.x + ox, y: rest.y + oy, pitch, roll, sy: 1 - sq, sx: 1 + sq * 0.6, sz: 1 + sq * 0.6 });
  });
  return {
    extra,
    kick(dir, amp, t0 = lab.t) {
      const l = Math.hypot(dir[0], dir[1]) || 1;
      kicks.push({ dx: dir[0] / l, dy: dir[1] / l, amp, t0 });
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  theo.set({ trail: false });
  jun.set({ trail: false });
  const RED = lab.bot('a').color;
  const BLUE = lab.bot('b').color;
  const YEL = lab.bot('c').color;

  // ---- Move 2, with weight: lean back as she pulls away, lean in as she brakes, overshoot and settle ----
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  await lab.wait(0.22);
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });
  await lab.tween(0.6, (e, k) => {
    const s = k - Math.sin(TAU * k) / TAU; // smooth start and stop; acceleration ~ sin(2πk)
    maya.set({ x: 2 + 2 * s, pitch: -0.13 * Math.sin(TAU * k) });
  }, ease.linear);

  // ---- touch: the column flashes red, and the game's whole history cracks back onto the glass ----
  const touch = lab.t;
  const col = arena.columns.find((c) => c.n === 2);
  if (col) {
    col.flash = lab.t;
    col.flashColor = new THREE.Color(RED);
  }
  arena.emit('checkpoint', { id: 'a', n: 2 });
  arena.emit('win', { id: 'a' });
  lab.ring(lab.pos(4, 1), RED, 1.1, 0.03, 0.6);
  // Maya's own arrival: a nose-heavy rock forward that settles
  const mayaRest = { x: 4, y: 1, d: 1 };
  const mayaS = springs(lab, maya, mayaRest);
  lab.tween(0.7, (e, k) => {
    const u = k * 0.7;
    const env = Math.exp(-u * 6) * Math.sin(u * 17);
    mayaS.extra.ox = 0.035 * env;
    mayaS.extra.pitch = 0.16 * env;
  }, ease.linear);
  // the card pops away
  const card = lab.bot('a').card;
  if (card) {
    const base = card.userData.base.clone();
    lab.tween(0.25, (e) => card.scale.set(base.x * (1 - e), base.y * (1 + 0.3 * e), 1), ease.in).then(() => arena.clearCards());
  }
  arena.setDim(0.55);
  const theoS = springs(lab, theo, { x: 5, y: 3, d: 3 });
  const junS = springs(lab, jun, { x: 1, y: 0, d: 2 });

  // the invented history (the port keeps a log of every move)
  const histories = [
    { p: maya, s: mayaS, color: RED, segs: [rounded(lab, [[0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [4, 1]])] },
    {
      p: theo,
      s: theoS,
      color: BLUE,
      // two loop-the-loops round the same block, a dead end at (3,0), then wandering home
      segs: [rounded(lab, [[6, -0.1], [6, 0.7], [5, 0.7], [5, -0.1], [6, 0.12], [6, 0.95], [5, 0.95], [5, 0.15], [6, 0.4], [6, 1.2], [5, 1.2], [5, 0.45], [6.1, 0.7], [6.1, 2], [4, 2], [4, 2.22], [5, 2.22], [5, 3]], 0.5)],
    },
    {
      p: jun,
      s: junS,
      color: YEL,
      // wanders, runs off the front edge (the line dangles over it), picks up again at the reboot
      segs: [
        [...rounded(lab, [[3, 3], [3, 2], [2, 2], [2, 3], [2, 3.48]]), lab.pos(2, 3.5).setY(-0.02).add(new THREE.Vector3(0, 0, 0.012)), lab.pos(2, 3.5).setY(-0.12).add(new THREE.Vector3(0, 0, 0.014)), lab.pos(2, 3.5).setY(-0.22).add(new THREE.Vector3(0, 0, 0.014))],
        rounded(lab, [[0, 1], [0, 0], [1, 0]]),
      ],
    },
  ];
  const ribbons = histories.map((h) => ({ ...h, r: makeRibbon(lab, h.segs, h.color) }));
  // a small reboot ring where Jun's line picks up again
  const rebootRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(lab.PALETTE.reboot).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  rebootRing.rotation.x = -Math.PI / 2;
  rebootRing.position.copy(lab.pos(0, 1)).setY(0.014);
  lab.add(rebootRing);

  // ---- state for each ribbon, drawn every frame ----
  const DRAW = 0.55; // seconds for every head to land
  for (const h of ribbons) {
    h.head = 0;
    h.tail = 0;
    h.wob = 0.13;
    h.landed = null;
    h.reel = null;
  }
  lab.every((dt, t) => {
    for (const h of ribbons) {
      const u = t - touch;
      const k = Math.min(1, Math.max(0, u / DRAW));
      h.head = h.r.L * ease.in(k) * 0.82 + h.r.L * k * 0.18; // accelerating: a whip's tip is fastest at the end
      // a travelling wave behind the head while drawing; after landing it rings down
      const ring = h.landed != null ? Math.exp(-(t - h.landed) * 5.5) : 1;
      const reelWob = h.reel ? Math.min(1, (t - h.reel.t0) * 3) : 0;
      const off = (i, s) => {
        const behind = h.head - s;
        let o = h.wob * ring * Math.sin(behind * 7.5 - u * 26) * Math.exp(-behind / 1.4) * Math.min(1, behind * 4);
        if (h.reel) {
          const ahead = s - h.tail;
          o += 0.1 * reelWob * Math.sin(ahead * 8 + u * 30) * Math.exp(-ahead / 0.9) * Math.min(1, ahead * 5);
        }
        return o;
      };
      const tailHot = h.reel ? Math.min(1, (t - h.reel.t0) * 2.5) : 0;
      const headHot = h.landed != null ? Math.exp(-(t - h.landed) * 4) : 1;
      h.r.draw(h.head, h.tail, off, { headHot, tailHot });
      if (h.landed == null && k >= 1) {
        h.landed = t;
        // the whip cracks: the robot it lands on gets jolted along the line's last direction
        const end = h.r.pts[h.r.pts.length - 1];
        const prev = h.r.pts[h.r.pts.length - 8];
        const d = end.p.clone().sub(prev.p);
        h.s.kick([d.x, d.z], 0.04);
        lab.ring(end.p, h.color, 0.55, 0.03, 0.35);
        lab.particles(end.p.clone().setY(0.1), [h.color, '#ffffff'], 10, { speed: 1.2, up: 0.9, gravity: 4, size: 0.04, dur: 0.45 });
      }
    }
    // the reboot ring blinks on as Jun's head jumps the gap
    const jh = ribbons[2];
    const gapS = jh.r.pts.find((q) => q.j === 1).s;
    rebootRing.material.opacity = jh.head >= gapS && jh.tail < gapS + 0.3 ? Math.min(1, (jh.head - gapS) * 3) : Math.max(0, rebootRing.material.opacity - dt * 4);
  });

  // camera: lift a little to look down on the photograph
  let camK = 0;
  const releaseCam = lab.camera((home) => ({ el: home.el + 0.14 * camK, dist: home.dist * (1 + 0.05 * camK) }));
  lab.tween(0.7, (e) => (camK = e), ease.inOut);

  await lab.wait(DRAW);
  lab.shake(0.025, 0.2);

  // ---- the photograph hangs; Jun's dangling end swells into a drop that falls to the floor ----
  const drip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE), color: new THREE.Color(YEL).multiplyScalar(3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dripAt = lab.pos(2, 3.5).setY(-0.22).add(new THREE.Vector3(0, 0, 0.02));
  drip.position.copy(dripAt);
  drip.scale.setScalar(0.001);
  lab.add(drip);
  // swell (the tip of the line bulges) ...
  await lab.tween(0.42, (e, k) => {
    drip.scale.set(0.06 + 0.16 * e, 0.06 + 0.2 * e, 1);
    drip.position.y = dripAt.y - 0.05 * e;
  }, ease.inOut);
  // ... lets go, stretches as it falls, and plinks on the floor far below
  const fallFrom = drip.position.y;
  await lab.tween(0.42, (e, k) => {
    drip.position.y = fallFrom + (-1.58 - fallFrom) * k * k;
    drip.scale.set(0.2 - 0.06 * k, 0.26 + 0.22 * k, 1);
  }, ease.linear);
  drip.position.y = -1.58;
  lab.ring(drip.position.clone(), YEL, 0.5, -1.585, 0.6);
  lab.ring(drip.position.clone(), '#ffffff', 0.28, -1.585, 0.45);
  lab.tween(0.25, (e) => drip.scale.set(0.3 * (1 + e), 0.08 * (1 - e), 1), ease.out).then(() => (drip.visible = false));

  // Theo, caught out by his own loops, sags a little
  lab.tween(0.35, (e) => {
    theoS.extra.pitch = 0.3 * e;
    theoS.extra.sy = 0.14 * e;
  }, ease.out);
  await lab.wait(0.35);

  // ---- reel in: every tail chases its head, oldest end first, and slams into its robot ----
  const REEL = [
    { h: ribbons[2], dur: 0.7, amp: 0.05 },
    { h: ribbons[1], dur: 0.95, amp: 0.065 },
    { h: ribbons[0], dur: 1.3, amp: 0.085 },
  ];
  const reels = REEL.map(({ h, dur, amp }) => {
    h.reel = { t0: lab.t };
    return lab.tween(dur, (e) => (h.tail = h.r.L * e), ease.in3).then(() => {
      // clack: the tape end slams home and shoves the robot along its last direction
      const end = h.r.pts[h.r.pts.length - 1];
      const prev = h.r.pts[h.r.pts.length - 8];
      const d = end.p.clone().sub(prev.p);
      h.s.kick([d.x, d.z], amp);
      lab.ring(end.p, h.color, 0.8, 0.03, 0.45);
      lab.particles(end.p.clone().setY(0.12), [h.color, '#ffffff'], 16, { speed: 1.6, up: 1.1, gravity: 5, size: 0.045, dur: 0.5 });
      if (h === ribbons[1]) lab.tween(0.3, (e) => {
        theoS.extra.pitch = 0.3 * (1 - e);
        theoS.extra.sy = 0.14 * (1 - e);
      }, ease.out);
      h.tail = h.r.L + 1;
    });
  });
  // the room's light comes back as the photograph is put away; the camera starts home with Maya's reel
  lab.wait(0.55).then(() => arena.setDim(0));
  lab.wait(0.6).then(() => lab.tween(0.75, (e) => (camK = 1 - e), ease.inOut));
  await Promise.all(reels);
  lab.shake(0.02, 0.18);
  // the column answers Maya's clack
  if (col) {
    col.flash = lab.t - 0.6;
    col.flashColor = new THREE.Color(RED);
  }
  await lab.wait(0.55);
  releaseCam();
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
  jun.release({ x: 1, y: 0, d: 2 });
  void facing;
}
