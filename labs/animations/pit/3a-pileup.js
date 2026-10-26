// Pit, idea 4 (Rear-ended by her own trail), animator a: weight & physical comedy.
export const meta = {
  title: 'Pile-up (her own trail rear-ends her)',
  idea:
    'Maya brakes hard on the rim of the hole: nose dips, she rocks, settles, and lets out a sigh of relief (her eye ' +
    'closes for a blink). Behind her, her trail of light has not stopped: its far end bunches up and comes rolling ' +
    'along her path like a pile-up, gathering the ribbon into a fat, ever-brighter knot of red light. The room sees ' +
    'it coming; she glances back a split second too late. BAM: whiplash, she skids one space onto the pit and drops. ' +
    'The knot bounces off, trundles to the rim, teeters on the brink, settles, and fades the way a trail always does.',
  notes:
    'Sound: a hard glassy skid and a little rocking "tink-tink" when she stops, a soft breathy chime for the sigh, ' +
    'then a low rolling hum that rises in pitch as the knot grows (silence from Maya), a heavy glass "thunk" on the ' +
    'hit and a falling whistle down the hole; a tiny wobbling ting as the knot teeters. Port: the trail is drawn ' +
    'here as its own ribbon (same look as the game\'s) so it can be gathered; in scene.js it would reuse b.trail. ' +
    'Works for any fall where the robot stops one space short: the knot rolls along whatever path she drove.',
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (s, a, b) => clamp01((s - a) / (b - a));

// timeline, scene seconds from the start of the moment
const T = {
  windup: [0, 0.1],
  drive: [0.1, 0.58], // 0.95 -> 2.72, cruising
  brake: [0.58, 0.76], // 2.72 -> 3.0, nose dips
  rock: [0.76, 1.12],
  sigh: [1.12, 1.5],
  blink: [1.16, 1.3],
  knot: [0.9, 1.64], // the knot rolls from the tail to her
  glance: [1.47, 1.64],
  hit: 1.64,
  slide: [1.64, 1.82], // shoved to the rim
  tip: [1.82, 2.18], // over the hole and down
  kRoll: [1.8, 2.22], // the knot trundles after her to the rim
  teeter: [2.22, 2.6],
  fade: [2.42, 3.1],
  end: 3.12,
};

const Y = 1; // her row
const STOP = 3.0;
const BACK = 0.44; // her body's rear, behind her centre

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const b = maya.bot;
  const red = new THREE.Color(b.color);
  const z0 = lab.pos(0, Y).z;
  const wx = (x) => lab.pos(x, Y).x; // board x -> world x on her row

  lab.playCard('a', ['m3']);

  // ---------- her trail, as a ribbon we can gather ----------
  const N = 140;
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  tGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  tGeo.setIndex(idx);
  tGeo.setDrawRange(0, 0);
  const trailTex = canvasTex(THREE, 4, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#000');
    grad.addColorStop(0.3, '#555');
    grad.addColorStop(0.5, '#fff');
    grad.addColorStop(0.7, '#555');
    grad.addColorStop(1, '#000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
  });
  const ribbon = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ map: trailTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 3;
  lab.add(ribbon);
  const pts = []; // { x (board), t }

  // ---------- the knot: a tangle of her light ----------
  const knot = new THREE.Group();
  const knotSpin = new THREE.Group(); // rolls
  knot.add(knotSpin);
  const loopMat = new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(1.4), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const loops = [];
  for (let i = 0; i < 9; i++) {
    const ctrl = [];
    const a0 = lab.range(0, Math.PI * 2);
    const tilt = lab.range(-1.2, 1.2);
    for (let j = 0; j < 6; j++) {
      const a = a0 + (j / 6) * Math.PI * 2;
      const r = lab.range(0.62, 1.0);
      const v = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, lab.range(-0.55, 0.55));
      v.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).applyAxisAngle(new THREE.Vector3(0, 1, 0), lab.range(0, Math.PI));
      ctrl.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, true);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.085, 6, true), loopMat);
    m.renderOrder = 5;
    m.visible = false;
    knotSpin.add(m);
    loops.push(m);
  }
  const glowTex = canvasTex(THREE, 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,.5)');
    grad.addColorStop(0.6, 'rgba(255,255,255,.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: red.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.renderOrder = 6;
  knot.add(core);
  // the knot's own pool of light on the glass
  const kPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: red.clone().multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  kPool.rotation.x = -Math.PI / 2;
  kPool.renderOrder = 2;
  lab.add(kPool);
  lab.add(knot);
  knot.visible = false;

  lab.cleanup(() => {
    trailTex.dispose();
    glowTex.dispose();
    tGeo.dispose();
  });

  // ---------- Maya's light ----------
  let eye = 1;
  let cardFade = 1;
  let hitGlow = 0;
  maya.each = (model) => {
    model.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);
    model.paint.emissiveIntensity = 0.16 + 1.4 * hitGlow;
    if (b.card) {
      b.card.position.y -= Math.min(0, maya.pose.lift);
      b.card.material.opacity *= cardFade;
    }
  };

  // ---------- the moment ----------
  const t0 = lab.t;
  let kx = 1.0; // knot centre (board x)
  let kR = 0; // knot radius
  let kRoll = 0; // its roll angle
  let lastKx = kx;
  let flashed = false;
  let gathered = 0.95; // everything of the ribbon behind this board x has been rolled into the knot
  const stop = lab.every((dt, now) => {
    const s = now - t0;

    // --- Maya ---
    const pose = { x: 1, lift: 0, pitch: 0, roll: 0, rot: lab.facing(1), sx: 1, sy: 1, sz: 1, trail: false, visible: true };
    if (s < T.drive[0]) {
      const k = seg(s, ...T.windup);
      pose.x = 1 - 0.05 * Math.sin(k * Math.PI * 0.5);
      pose.pitch = -0.12 * Math.sin(k * Math.PI);
    } else if (s < T.drive[1]) {
      const k = seg(s, ...T.drive);
      pose.x = lerp(0.95, 2.72, 0.25 * k * k + 0.75 * k); // a quick start, then cruising
      pose.pitch = -0.08 * (1 - k);
    } else if (s < T.brake[1]) {
      // stamping on the brakes: the body's weight carries the nose forward
      const k = seg(s, ...T.brake);
      pose.x = lerp(2.72, STOP, 1 - (1 - k) ** 2);
      pose.pitch = 0.34 * Math.sin(k * Math.PI * 0.5);
      pose.sx = pose.sz = 1 + 0.05 * k;
      pose.sy = 1 - 0.06 * k;
      pose.roll = 0.03 * Math.sin(k * 30) * k; // a skid shimmy
    } else {
      pose.x = STOP;
      // the rock: nose over the edge, back, settle
      const kr = s - T.rock[0];
      pose.pitch = 0.34 * Math.exp(-kr * 7.5) * Math.cos(kr * 15);
      pose.sy = 1 - 0.06 * Math.exp(-kr * 9);
      pose.sx = pose.sz = 1 + 0.05 * Math.exp(-kr * 9);
      // the sigh: she deflates, then breathes in again
      const ks = seg(s, ...T.sigh);
      if (ks > 0 && ks < 1) {
        const d = Math.sin(ks * Math.PI) * (ks < 0.5 ? 1 : 1);
        pose.sy *= 1 - 0.14 * d;
        pose.sx *= 1 + 0.06 * d;
        pose.sz *= 1 + 0.06 * d;
        pose.pitch -= 0.08 * d; // sinks back on her heels, away from the edge
        pose.x -= 0.04 * d;
      }
      // a glance back over her shoulder, a split second too late
      const kg = seg(s, ...T.glance);
      if (s < T.hit) pose.rot += 0.42 * ease.out(kg);
    }
    // the blink of relief
    const kb = seg(s, ...T.blink);
    eye = kb > 0 && kb < 1 ? 1 - 0.85 * Math.sin(kb * Math.PI) : 1;

    // --- the hit and the shove ---
    if (s >= T.hit) {
      const kh = s - T.hit;
      if (!flashed) {
        flashed = true;
        lab.shake(0.05, 0.3);
        lab.ring(lab.pos(STOP - BACK - 0.05, Y).setY(0.15), '#ffe6dc', 0.32, 0.15, 0.3);
        lab.particles(lab.pos(STOP - BACK - 0.05, Y).setY(0.2), [b.color, '#ffffff'], 18, { speed: 2.2, up: 1.2, gravity: 4, size: 0.05, dur: 0.5 });
      }
      hitGlow = Math.max(0, 1 - kh / 0.25);
      if (s < T.slide[1]) {
        const k = seg(s, ...T.slide);
        pose.x = lerp(STOP, 3.62, 1 - (1 - k) ** 1.6);
        // whiplash: the base is shoved, the top lags behind, then snaps forward
        pose.pitch = -0.32 * Math.sin(Math.min(1, k * 1.6) * Math.PI) + 0.25 * k * k;
        const sq = Math.exp(-kh * 18);
        pose.sx = pose.sz = 1 - 0.18 * sq;
        pose.sy = 1 + 0.12 * sq;
        pose.rot = lab.facing(1) + 0.42 * Math.exp(-kh * 30); // the glance snaps forward
        pose.trail = false;
      } else {
        // over the hole: her nose tips in, then she drops like a stone
        const kt = s - T.tip[0];
        pose.x = 3.62 + 0.42 * (1 - Math.exp(-kt * 5));
        pose.pitch = 0.25 + 1.5 * Math.min(1, kt / 0.22) ** 1.5;
        pose.lift = -0.5 * 16 * kt * kt;
        pose.sy = 1 + Math.min(0.2, kt * 1.2);
        cardFade = Math.max(0, 1 - kt / 0.15);
      }
    }
    pose.visible = pose.lift > -0.75;
    maya.set(pose);

    // --- the ribbon: laid behind her while she drives ---
    if (s < T.slide[1] && pose.lift > -0.05) {
      const last = pts[pts.length - 1];
      if (!last || Math.abs(pose.x - last.x) > 0.035) pts.push({ x: pose.x, t: now });
    }

    // --- the knot ---
    let kOpacity = 1;
    let ksx = 1;
    let ksy = 1;
    if (s >= T.knot[0] && s < T.hit) {
      // it bunches at the tail and comes rolling, accelerating, gathering the ribbon
      const k = seg(s, ...T.knot);
      const target = STOP - BACK - 0.06; // its front, at her rear
      const startX = 0.95;
      const front = lerp(startX, target, k ** 1.7);
      gathered = front;
      const L = Math.max(0, front - startX);
      kR = 0.08 + 0.2 * Math.sqrt(L / 1.6);
      kx = front - kR;
      // concertina: every bit it swallows makes it surge
      const surge = Math.sin(L * 22);
      ksx = 1 + 0.12 * surge;
      ksy = 1 - 0.08 * surge;
    } else if (s >= T.hit) {
      const kh = s - T.hit;
      const R = 0.08 + 0.2;
      kR = R;
      const hitX = STOP - BACK - 0.06 - R;
      const rimX = 3.5 - R * 0.55; // its centre when it sits right on the brink
      if (s < T.kRoll[0]) {
        // squashed flat against her, then bounces back
        const k = seg(s, T.hit, T.kRoll[0]);
        kx = hitX - 0.16 * Math.sin(k * Math.PI * 0.5);
        const sq = Math.sin(Math.min(1, k * 2.2) * Math.PI);
        ksx = 1 - 0.38 * sq;
        ksy = 1 + 0.3 * sq;
      } else if (s < T.kRoll[1]) {
        // and trundles after her, gathering the rest of the ribbon, slowing to the rim
        const k = seg(s, ...T.kRoll);
        kx = lerp(hitX - 0.16, rimX, 1 - (1 - k) ** 2.2);
      } else {
        // teetering on the brink: rocks out over the hole, back, out, back... and stays
        const kt = s - T.teeter[0];
        kx = rimX + 0.11 * Math.sin(kt * 11) * Math.exp(-kt * 3.2);
      }
      gathered = Math.max(gathered, kx + kR);
      const kf = seg(s, ...T.fade);
      kOpacity = (1 - kf) ** 1.6;
      ksx *= 1 + 0.25 * kf; // it slackens as it fades
      ksy *= 1 - 0.15 * kf;
      void kh;
    }
    const knotOn = s >= T.knot[0];
    knot.visible = knotOn && kOpacity > 0.01;
    for (const m of loops) m.visible = knot.visible;
    if (knotOn) {
      kRoll += (kx - lastKx) / Math.max(0.05, kR);
      lastKx = kx;
      const at = lab.pos(kx, Y);
      knot.position.set(at.x, kR * ksy, at.z);
      knot.scale.set(kR * ksx, kR * ksy, kR * (0.5 * (ksx + ksy)));
      knotSpin.rotation.set(0.3, 0.2, -kRoll);
      const L = Math.min(1.6, Math.max(0, gathered - 0.95));
      const bright = 0.55 + 0.5 * (L / 1.6) + 0.9 * hitGlow;
      loopMat.color.copy(red).multiplyScalar(bright);
      loopMat.opacity = kOpacity;
      core.material.opacity = (0.12 + 0.16 * (L / 1.6) + 0.4 * hitGlow) * kOpacity;
      core.material.color.copy(red).multiplyScalar(0.6 + 0.3 * (L / 1.6));
      core.scale.setScalar(2.2);
      kPool.position.set(at.x, 0.005, at.z);
      kPool.scale.setScalar(kR * 6);
      kPool.material.opacity = Math.min(0.32, 0.1 + 0.25 * L) * kOpacity;
    }

    // --- draw the ribbon: what hasn't been gathered yet ---
    const pos = tGeo.attributes.position.array;
    const col = tGeo.attributes.color.array;
    const vis = pts.filter((p) => p.x > gathered - 0.02);
    const n = Math.min(N, vis.length);
    const life = 3.2;
    for (let i = 0; i < n; i++) {
      const p = vis[vis.length - n + i];
      const age = (now - p.t) / life;
      const fade = Math.max(0, 1 - age) ** 1.6 * Math.min(1, (i + 1) / 3);
      const w = 0.16 + 0.06 * (1 - age);
      // light piles up just ahead of the knot (a bow wave), and rucks up off the glass
      const ahead = p.x - gathered;
      const bow = knotOn && s < T.hit ? Math.exp(-Math.max(0, ahead) / 0.22) : 0;
      const k = fade * 1.8 * (1 + 1.6 * bow);
      const x = wx(p.x);
      const lift = 0.008 + 0.07 * bow;
      pos.set([x, lift, z0 + w, x, lift, z0 - w], i * 6);
      col.set([red.r * k, red.g * k, red.b * k, red.r * k, red.g * k, red.b * k], i * 6);
    }
    tGeo.attributes.position.needsUpdate = true;
    tGeo.attributes.color.needsUpdate = true;
    tGeo.setDrawRange(0, Math.max(0, n - 1) * 6);
  });

  await lab.wait(T.end);
  stop();
  knot.visible = false;
  kPool.visible = false;
  maya.release({ on: false });
}
