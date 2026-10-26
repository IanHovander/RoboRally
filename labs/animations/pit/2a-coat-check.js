// Pit, idea 1 (Coat check), animator a: weight & physical comedy.
export const meta = {
  title: 'Coat check (her colour snags on the rim)',
  idea:
    'Light can\'t go into a pit, so Maya\'s colour won\'t either. Her ring hits the rim like a balloon hitting a ' +
    'wall and squashes flat; she keeps straining forward, the red draining out of her body, her eye light pulled ' +
    'back out of her face like taffy... until it snaps. The ring jelly-wobbles back onto (3,1) and settles into a ' +
    'bright red Pebble-shaped stain, eye and all. Her body, slingshot forward and now plain dark glass, hangs over ' +
    'the hole for a beat and drops without a sound. The stain shivers once, then seeps into the seams around its ' +
    'square and runs off along the grout lines in thin red threads, and is gone.',
  notes:
    'Sound: a rubbery glass squeak as the ring presses on the rim, a rising stretched whine, a bright "plink" for ' +
    'the snap and a jelly "wub-wub" as the ring settles; then nothing at all for the drop. A tiny shivering tremolo, ' +
    'and a soft trickle as the threads run. Port: the ring, pool and eye are drawn as copies so they can deform; ' +
    'the model\'s own are dimmed. The stain is always on the last space before the pit along the path, and threads ' +
    'never run along a pit\'s edge (light can\'t go in there either).',
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (s, a, b) => clamp01((s - a) / (b - a));
const S = 1.3; // the robots' scale in scene.js

const T = {
  windup: [0, 0.1],
  drive: [0.1, 0.7], // 0.95 -> SNAG
  snag: [0.7, 1.0], // her ring is pressed on the rim; she strains on
  snap: 1.0,
  lurch: [1.0, 1.16], // slingshot over the hole
  hang: [1.16, 1.32],
  drop: 1.32,
  shiver: [1.78, 2.02],
  seep: [2.0, 2.3], // into the seams around its square
  threads: [2.15, 3.0],
  end: 3.06,
};
const Y = 1;
const RIM = 3.5;
const R0 = 0.517; // her ring's radius
const SNAG = RIM - R0 - 0.005; // where her ring's front edge reaches the rim

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The Pebble's outline seen from above (bots3d.js), front at +y. */
function pebbleShape(THREE, s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.29 * s);
  sh.bezierCurveTo(0.11 * s, 0.29 * s, 0.31 * s, -0.12 * s, 0.29 * s, -0.22 * s);
  sh.bezierCurveTo(0.27 * s, -0.31 * s, 0.13 * s, -0.33 * s, 0, -0.29 * s);
  sh.bezierCurveTo(-0.13 * s, -0.33 * s, -0.27 * s, -0.31 * s, -0.29 * s, -0.22 * s);
  sh.bezierCurveTo(-0.31 * s, -0.12 * s, -0.11 * s, 0.29 * s, 0, 0.29 * s);
  return sh;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const b = maya.bot;
  const model = maya.model;
  const red = new THREE.Color(b.color);
  const warm = new THREE.Color(3.2, 3.1, 2.9);
  const darkGlass = new THREE.Color(0x15181e);
  const z0 = lab.pos(0, Y).z;
  const wx = (x) => lab.pos(x, Y).x;
  const eyeMesh = (() => {
    let e = null;
    model.body.traverse((o) => {
      if (o.isMesh && o.material === model.eyeMat) e = o;
    });
    return e;
  })();

  lab.playCard('a', ['m3']);

  // ---------- the pebble outline, as a radius for each direction (front = +x on the glass) ----------
  const M = 128;
  const pebR = new Float32Array(M);
  {
    const raw = pebbleShape(THREE).getSpacedPoints(400).map((p) => ({ a: Math.atan2(p.x, p.y), r: Math.hypot(p.x, p.y) }));
    raw.sort((p, q) => p.a - q.a);
    for (let j = 0; j < M; j++) {
      const a = -Math.PI + (j / M) * Math.PI * 2;
      let best = raw[0];
      for (const p of raw) if (Math.abs(p.a - a) < Math.abs(best.a - a)) best = p;
      pebR[j] = (best.r + 0.06) * S * 1.06; // its footprint, bevel included
    }
  }

  // ---------- her colour, as copies that can deform ----------
  // the ring: a closed strip whose shape we compute every frame
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((M + 1) * 6), 3));
  const ri = [];
  for (let j = 0; j < M; j++) ri.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
  ringGeo.setIndex(ri);
  const ringMat = new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.frustumCulled = false;
  ring.renderOrder = 4;
  lab.add(ring);
  // the pointer
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.085);
  tri.lineTo(0.075, -0.02);
  tri.lineTo(-0.075, -0.02);
  tri.closePath();
  const tickGeo = new THREE.ShapeGeometry(tri);
  tickGeo.rotateX(-Math.PI / 2);
  tickGeo.rotateY(-Math.PI / 2); // point east
  tickGeo.scale(S, S, S);
  const tick = new THREE.Mesh(tickGeo, ringMat);
  tick.renderOrder = 4;
  lab.add(tick);
  // the pool of light
  const glowTex = canvasTex(THREE, 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: red.clone().multiplyScalar(0.9), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.25 * S, 1.25 * S), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 2;
  lab.add(pool);
  // the stain's body: the pebble's footprint, filled with her light
  const fillGeo = new THREE.ShapeGeometry(pebbleShape(THREE, 1.25), 24);
  fillGeo.rotateX(-Math.PI / 2); // shape +y -> world -z
  fillGeo.rotateY(-Math.PI / 2); // front -> east
  fillGeo.scale(S, 1, S);
  const fillMat = new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.renderOrder = 3;
  lab.add(fill);
  // her eye light, once it's out of her: a strand, then a dash on the glass
  const strandMat = new THREE.MeshBasicMaterial({ color: warm.clone(), transparent: true, opacity: 1, depthWrite: false });
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), strandMat);
  strand.visible = false;
  strand.renderOrder = 6;
  lab.add(strand);
  const strand2 = new THREE.Mesh(strand.geometry, strandMat); // the half that zips back into her when it snaps
  strand2.visible = false;
  lab.add(strand2);
  const dashGeo = new THREE.CapsuleGeometry(0.016 * S, 0.12 * S, 4, 10);
  dashGeo.rotateX(Math.PI / 2); // lying flat, across her heading
  const dash = new THREE.Mesh(dashGeo, strandMat);
  dash.visible = false;
  dash.renderOrder = 6;
  lab.add(dash);

  // ---------- the threads: her light running off along the seams ----------
  const threadTex = canvasTex(THREE, 64, 8, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.75, 'rgba(255,255,255,.7)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const threads = [];
  // from the corners of (3,1), away from it (never along the pit's edge); [corner, direction, length, delay, speed]
  const plan = [
    [[2.5, 0.5], [-1, 0], 2.6, 0.0, 1.0],
    [[2.5, 1.5], [-1, 0], 2.2, 0.05, 0.9],
    [[2.5, 0.5], [0, -1], 1.0, 0.02, 1.1],
    [[2.5, 1.5], [0, 1], 1.9, 0.08, 0.95],
    [[3.5, 0.5], [0, -1], 1.0, 0.1, 1.05],
    [[3.5, 1.5], [0, 1], 2.0, 0.04, 1.0],
    [[2.5, 2.5], [-1, 0], 1.3, 0.3, 0.8], // branches where the seams cross
  ];
  for (const [from, dir, len, delay, speed] of plan) {
    const mat = new THREE.MeshBasicMaterial({ map: threadTex, color: red.clone().multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.045), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(-dir[1], dir[0]); // the texture's bright end leads
    m.renderOrder = 5;
    m.visible = false;
    lab.add(m);
    threads.push({ m, mat, from, dir, len, delay, speed });
  }
  // the grout around the stain's own square
  const groutMat = new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const grout = new THREE.Group();
  for (const [dx, dz, w, h] of [[0, -0.5, 1, 0.04], [0, 0.5, 1, 0.04], [-0.5, 0, 0.04, 1], [0.5, 0, 0.04, 1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), groutMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(dx, 0.007, dz);
    m.renderOrder = 5;
    grout.add(m);
  }
  grout.position.copy(lab.pos(3, Y));
  lab.add(grout);

  lab.cleanup(() => {
    glowTex.dispose();
    threadTex.dispose();
  });

  // ---------- each frame ----------
  let drain = 0; // how much of her colour has left her body (0..1)
  let eye = 1;
  let cardFade = 1;
  maya.each = (m) => {
    m.ringMat.opacity = 0; // her own ring, pointer and pool: we draw them ourselves
    m.poolMat.opacity = 0;
    m.paint.color.copy(red).lerp(darkGlass, drain);
    m.paint.emissive.copy(red).lerp(new THREE.Color(0x1b2230), drain);
    m.paint.emissiveIntensity = lerp(0.16, 0.35, drain);
    m.eyeMat.color.copy(warm).multiplyScalar(eye);
    if (eyeState) drawEye(eyeState);
    if (b.card) {
      b.card.position.y -= Math.min(0, maya.pose.lift);
      b.card.material.opacity *= cardFade;
    }
  };
  lab.cleanup(() => {
    model.paint.color.copy(red);
    model.paint.emissive.copy(red);
  });

  const t0 = lab.t;
  const eyeW = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const placeStrand = (mesh, a, c, r) => {
    const d = c.clone().sub(a);
    const len = d.length();
    mesh.visible = len > 0.01;
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(up, d.normalize());
    mesh.scale.set(r, len, r);
  };
  // her eye light: pulled out of her, snaps, lies on the glass (runs after her pose is applied)
  let eyeState = null;
  const drawEye = ({ s, ccx, wob }) => {
    eyeMesh.getWorldPosition(eyeW);
    const dashAt = lab.pos(3 + 0.17, Y).setY(0.012);
    dashAt.x = ccx + 0.17;
    if (s >= T.snag[0] && s < T.snap) {
      const k = seg(s, ...T.snag);
      // it stretches from her face back to where her colour is held, thinning as it goes
      const len = eyeW.distanceTo(dashAt);
      placeStrand(strand, dashAt, eyeW, Math.max(0.009, 0.03 / Math.sqrt(1 + len * 4)));
      strand.visible = k > 0.05;
      strandMat.color.copy(warm).multiplyScalar(1.2 + 0.8 * k);
      dash.visible = false;
    } else if (s >= T.snap) {
      const ks = s - T.snap;
      // two halves fly apart: one snaps down into the stain, one zips back into her face and goes out
      const back = clamp01(ks / 0.09);
      const mid = dashAt.clone().lerp(eyeW, 0.5);
      if (back < 1) {
        placeStrand(strand, dashAt, mid.clone().lerp(dashAt, back), 0.008);
        placeStrand(strand2, eyeW, mid.clone().lerp(eyeW, back), 0.008);
      } else {
        strand.visible = false;
        strand2.visible = false;
      }
      dash.visible = true;
      dash.position.copy(dashAt);
      const dscale = 1 + 0.4 * Math.exp(-ks * 12) + 0.15 * wob;
      dash.scale.setScalar(dscale);
      const kt = seg(s, T.seep[0], T.threads[0] + 0.3);
      strandMat.color.copy(warm).lerp(red.clone().multiplyScalar(2), clamp01((s - T.shiver[0]) / 0.3)).multiplyScalar(1 - kt);
      strandMat.opacity = 1 - kt;
    } else {
      strand.visible = false;
      dash.visible = false;
    }

  };
  const stop = lab.every((dt, now) => {
    const s = now - t0;
    const pose = { x: 1, lift: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, trail: true, visible: true };
    // ring shape this frame: centre, press against the rim, morph to the pebble, wobble
    let cx = 1;
    let press = 0; // squashed against the rim
    let morph = 0; // 0 circle .. 1 pebble outline
    let wob = 0; // jelly
    let ringA = 1; // brightness
    let fillA = 0;
    let poolA = 0.75;
    let tickA = 1;
    let shiver = 0;

    if (s < T.drive[0]) {
      const k = seg(s, ...T.windup);
      pose.x = 1 - 0.05 * Math.sin(k * Math.PI * 0.5);
      pose.pitch = -0.1 * Math.sin(k * Math.PI);
      cx = pose.x;
    } else if (s < T.snag[0]) {
      const k = seg(s, ...T.drive);
      pose.x = lerp(0.95, SNAG, 0.3 * k * k + 0.7 * k);
      cx = pose.x;
    } else if (s < T.snap) {
      // she strains on; her colour is held at the rim and squashes flat against it
      const k = seg(s, ...T.snag);
      pose.x = lerp(SNAG, 3.74, 1 - (1 - k) ** 1.7); // out over the hole, held up by her own light
      cx = SNAG + 0.22 * ease.out(k);
      press = 0.12 * ease.out(k); // the ring is shoved into the rim
      drain = k ** 0.8;
      pose.pitch = 0.16 * Math.sin(k * Math.PI * 0.5); // leaning into it
      pose.roll = 0.025 * Math.sin(s * 70) * k; // straining
      pose.sx = pose.sz = 1 + 0.04 * k;
      pose.sy = 1 - 0.04 * k;
      eye = 1 - 0.8 * k;
      tickA = 1 - k;
      pose.trail = false;
    } else {
      drain = 1;
      eye = 0.04;
      tickA = 0;
      pose.trail = false;
      const ks = s - T.snap;
      // the ring snaps back off the rim, jelly-wobbles, and becomes her stain
      cx = lerp(SNAG + 0.22, 3, 1 - Math.exp(-ks * 14));
      press = 0.12 * Math.exp(-ks * 20);
      morph = clamp01(ks / 0.3);
      morph = 1 - (1 - morph) ** 2;
      wob = Math.exp(-ks * 6) * Math.sin(ks * 34);
      fillA = 0.55 * clamp01(ks / 0.25);
      poolA = lerp(0.75, 0.5, clamp01(ks / 0.3));
      // the body: slingshot over the hole, a beat, then straight down
      if (s < T.lurch[1]) {
        const k = seg(s, ...T.lurch);
        pose.x = lerp(3.74, 4.0, 1 - (1 - k) ** 2.4);
        pose.pitch = 0.16 + 0.22 * Math.sin(k * Math.PI);
        const sq = Math.exp(-ks * 22);
        pose.sx = pose.sz = 1 - 0.12 * sq;
        pose.sy = 1 + 0.1 * sq;
      } else if (s < T.drop) {
        const k = seg(s, ...T.hang);
        pose.x = 4 + 0.02 * Math.sin(k * Math.PI);
        pose.pitch = 0.16 * (1 - k) - 0.06 * Math.sin(k * Math.PI); // settles, oblivious
      } else {
        const kd = s - T.drop;
        pose.x = 4;
        pose.lift = -0.5 * 15 * kd * kd;
        cardFade = Math.max(0, 1 - kd / 0.12);
      }
      // the shiver
      const kv = seg(s, ...T.shiver);
      if (kv > 0 && kv < 1) shiver = Math.sin(kv * Math.PI * 7) * Math.sin(kv * Math.PI);
      // seeping away
      const kp = seg(s, ...T.seep);
      const kt = seg(s, T.seep[0], T.threads[1] - 0.25);
      ringA = 1 - ease.in(kt);
      fillA *= 1 - ease.out(kp) * 0.6 - 0.4 * ease.in(kt);
      poolA *= 1 - ease.out(kt);
    }
    pose.visible = pose.lift > -0.7;
    maya.set(pose);

    // --- draw the ring ---
    const pos = ringGeo.attributes.position.array;
    const cz = z0;
    const ccx = wx(cx);
    const rimW = wx(RIM);
    const hw = 0.0165 + 0.012 * morph; // the stain's outline is a little bolder
    const sh = shiver * 0.07;
    for (let j = 0; j <= M; j++) {
      const jj = j % M;
      const a = -Math.PI + (jj / M) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      let r = lerp(R0, pebR[jj], morph);
      r *= 1 + 0.09 * wob * Math.cos(2 * a) + sh * Math.cos(3 * a + s * 40);
      // pressed into the rim: squash in x, bulge in z (it keeps its area, roughly)
      const sx = 1 - press * 1.6;
      const sz = 1 + press * 1.2;
      for (const [side, rr] of [[0, r - hw], [1, r + hw]]) {
        let x = ccx + ca * rr * sx;
        const z = cz + sa * rr * sz;
        if (morph < 0.5 && x > rimW - 0.004) x = rimW - 0.004 - (x - rimW) * 0.05; // can't cross the rim
        pos.set([x, 0.007, z], (j * 2 + side) * 3);
      }
    }
    ringGeo.attributes.position.needsUpdate = true;
    ringGeo.computeBoundingSphere();
    ringMat.opacity = 0.9 * ringA;
    ringMat.color.copy(red).multiplyScalar(1.6 + 1.6 * clamp01(press * 10) * (s < T.snap + 0.2 ? 1 : 0) + 0.8 * morph);
    // pointer
    tick.position.set(Math.min(rimW - 0.05, ccx + 0.611), 0.007, cz);
    tick.scale.set(1, 1, 1);
    tick.visible = tickA > 0.02;
    // pool
    pool.position.set(ccx, 0.004, cz);
    pool.scale.set(1 - press * 1.6, 1 + press * 1.2, 1);
    poolMat.opacity = poolA;
    // the stain's fill
    fill.position.set(ccx, 0.006, cz);
    const fs = 1 + 0.06 * wob + sh * 0.5;
    fill.scale.set(fs, 1, 1 + 0.06 * -wob - sh * 0.4);
    fillMat.opacity = fillA;

    eyeState = { s, ccx, wob }; // drawn in maya.each, once her pose for this frame is applied

    // --- the grout and the threads ---
    const kg = seg(s, ...T.seep);
    groutMat.opacity = Math.sin(kg * Math.PI * 0.5) * (1 - seg(s, T.threads[0] + 0.15, T.threads[0] + 0.6));
    for (const th of threads) {
      const k = (s - T.threads[0] - th.delay) / ((T.threads[1] - T.threads[0] - th.delay) * th.speed);
      if (k <= 0) {
        th.m.visible = false;
        continue;
      }
      // capillary: quick at first, slowing as it goes; a thin running tail
      const head = th.len * Math.min(1, Math.sqrt(Math.min(1, k)) * 1.05);
      const tail = Math.max(0, head - 0.55 - 0.3 * (1 - k));
      const a = { x: th.from[0] + th.dir[0] * tail, y: th.from[1] + th.dir[1] * tail };
      const c = { x: th.from[0] + th.dir[0] * head, y: th.from[1] + th.dir[1] * head };
      const pa = lab.pos(a.x, a.y);
      const pc = lab.pos(c.x, c.y);
      th.m.visible = true;
      th.m.position.set((pa.x + pc.x) / 2, 0.008, (pa.z + pc.z) / 2);
      th.m.scale.set(Math.max(0.001, head - tail), 1 - 0.5 * clamp01(k), 1);
      th.mat.opacity = Math.min(1, k * 6) * (1 - clamp01((k - 0.45) / 0.55)) ** 1.2;
    }
  });

  await lab.wait(T.end);
  stop();
  for (const o of [ring, tick, pool, fill, strand, strand2, dash, grout, ...threads.map((t) => t.m)]) o.visible = false;
  maya.release({ on: false });
}
