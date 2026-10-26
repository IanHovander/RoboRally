// Coat check, staged as a light installation: the moment her colour stays behind, time slows and the room's
// light goes down, so the red stain she leaves is the only lamp in the room; then it drains into the
// board's seams like water into grout and the room comes back up.
export const meta = {
  title: 'Colour field',
  idea:
    'At the rim, time slows and Maya\'s colour comes off like a coat: her ring, glow and eye stay on (3,1) as a red Pebble-shaped stain, stretched to her by one strand of red light until it snaps. The room\'s light goes down and the stain becomes the only lamp: it tints the glass, Theo and the floor far below red. Her body, now plain dark glass, glides over the hole and drops in without a sound. The stain shivers once, then drains into the board\'s seams: thin red threads race along the grout lines, skirt around the pit (light can\'t go in), and drip off the edges of the slab into the dark, while the camera rises to show the pattern and the room\'s light comes back.',
  notes:
    'Sound: the drive as usual, then all sound drops out with the light (a held, airy glass tone); no sound at all for the drop; a tiny glass shiver; the threads as a fast trickle of high glass ticks running away to the edges. Porting: one stain mesh set (ring, pool, a canvas Pebble glow, eye dash), one PointLight, the spill tinted; threads are vertex-colored ribbons along integer grid lines, so any board works (paths are random walks to the nearest edges that avoid pit cells).',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const RED = new THREE.Color('#ff4d6d');
  const LIGHT = new THREE.Color(lab.PALETTE.light);
  const W = (x, y, h = 0) => lab.pos(x, y).setY(h);
  const glow = glowTex(THREE);
  const addMat = (o) => ({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...o });

  // ---------- camera rig ----------
  const ch = arena.camHome;
  const HOME = { el: ch.elev, d: 1, tx: ch.target.x, ty: ch.target.y, tz: ch.target.z, az: 0 };
  const cam = { ...HOME };
  const camTo = (dur, to, ez = ease.inOut) => {
    const from = { ...cam };
    return lab.tween(dur, (e) => {
      for (const k of Object.keys(to)) cam[k] = from[k] + (to[k] - from[k]) * e;
    }, ez);
  };
  const releaseCam = lab.camera((home) => ({ target: new THREE.Vector3(cam.tx, cam.ty, cam.tz), el: cam.el, dist: home.dist * cam.d, az: cam.az }));
  let tagsOn = 1;
  const stopTags = lab.every(() => {
    for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity = tagsOn;
  });

  // ---------- the room: its light can go down, and the stain becomes a lamp ----------
  const spillColor = arena.spill.material.color.clone();
  const lamp = new THREE.PointLight(RED, 0, 4.5, 1.6);
  lamp.position.copy(W(3, 1, 0.45));
  lab.add(lamp);
  let redRoom = 0; // 0..1: how much the stain lights the room
  const stopRoom = lab.every(() => {
    lamp.intensity = 7 * redRoom;
    arena.spill.material.color.copy(spillColor).lerp(RED.clone().multiplyScalar(0.55), redRoom);
  });
  lab.cleanup(() => {
    arena.spill.material.color.copy(spillColor);
    arena.setDim(0);
  });

  // ---------- the stain: her ring, glow and eye, left on the glass ----------
  const stain = new THREE.Group();
  stain.position.copy(W(3, 1, 0));
  stain.rotation.y = facing(1);
  stain.visible = false;
  lab.add(stain);
  const S = 1.3; // robots are drawn at this size
  const stainRingMat = new THREE.MeshBasicMaterial(addMat({ color: RED.clone().multiplyScalar(2.2), side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.385 * S, 0.41 * S, 64), stainRingMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  stain.add(ring);
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.085);
  tri.lineTo(0.075, -0.02);
  tri.lineTo(-0.075, -0.02);
  tri.closePath();
  const tick = new THREE.Mesh(new THREE.ShapeGeometry(tri), stainRingMat);
  tick.scale.setScalar(S);
  tick.rotation.x = -Math.PI / 2;
  tick.position.set(0, 0.012, -0.47 * S);
  stain.add(tick);
  const poolMat = new THREE.MeshBasicMaterial(addMat({ map: glow, color: RED.clone().multiplyScalar(1.1) }));
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.01;
  stain.add(pool);
  const shapeMat = new THREE.MeshBasicMaterial(addMat({ map: pebbleTex(THREE), color: RED.clone().multiplyScalar(1.9) }));
  const shape = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * S, 0.8 * S), shapeMat);
  shape.rotation.x = -Math.PI / 2;
  shape.position.y = 0.014;
  stain.add(shape);
  const eyeMat = new THREE.MeshBasicMaterial(addMat({ map: glow, color: LIGHT.clone().multiplyScalar(2.6) }));
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), eyeMat);
  eye.rotation.x = -Math.PI / 2;
  eye.position.set(0, 0.016, -0.13 * S);
  stain.add(eye);
  let stainOn = 0;
  let stainShiver = 0;
  const stopStain = lab.every((dt, t) => {
    const flick = 1 + 0.05 * Math.sin(t * 23) * stainOn;
    stainRingMat.opacity = 0.95 * stainOn * flick;
    poolMat.opacity = 0.8 * stainOn;
    shapeMat.opacity = 0.9 * stainOn * flick;
    eyeMat.opacity = Math.min(1, 1.2 * stainOn);
    const j = stainShiver;
    stain.scale.set(1 + 0.09 * j * Math.sin(t * 90), 1, 1 + 0.09 * j * Math.cos(t * 77));
    stain.rotation.y = facing(1) + 0.06 * j * Math.sin(t * 60);
  });

  // the rim of the pit: a membrane her colour can't cross (clipping planes at the rim's world x)
  const rimX = W(3.5, 1).x;
  const keepWest = new THREE.Plane(new THREE.Vector3(-1, 0, 0), rimX);
  const keepEast = new THREE.Plane(new THREE.Vector3(1, 0, 0), -rimX);
  const wasClipping = lab.renderer.localClippingEnabled;
  lab.renderer.localClippingEnabled = true;
  lab.cleanup(() => (lab.renderer.localClippingEnabled = wasClipping));
  // the rim lights up red where her colour is scraped off
  const rimMat = new THREE.MeshBasicMaterial(addMat({ map: lineTex(THREE), color: RED.clone().multiplyScalar(2.6), opacity: 0, side: THREE.DoubleSide }));
  const rimLine = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.98), rimMat);
  rimLine.rotation.x = -Math.PI / 2;
  rimLine.position.copy(W(3.5, 1, 0.018));
  lab.add(rimLine);

  // ---------- Maya ----------
  const maya = lab.puppet('a');
  const m0 = maya.model;
  const lit = [m0.paint, m0.eyeMat, m0.ringMat, m0.poolMat];
  for (const mat of lit) mat.clippingPlanes = [keepWest];
  lab.cleanup(() => {
    for (const mat of lit) mat.clippingPlanes = null;
  });
  // her body without its colour: plain dark glass, the part of her past the rim
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0d11, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, clippingPlanes: [keepEast] });
  const darkRoot = new THREE.Group();
  const darkBody = m0.body.clone(true);
  darkBody.traverse((o) => {
    if (o.isMesh) o.material = darkMat;
  });
  darkRoot.add(darkBody);
  lab.add(darkRoot);
  let cardOn = 1;
  maya.each = () => {
    darkRoot.visible = maya.group.visible;
    darkRoot.position.copy(maya.group.position);
    darkRoot.quaternion.copy(maya.group.quaternion);
    darkRoot.scale.copy(maya.group.scale);
    darkBody.position.copy(m0.body.position);
    darkBody.quaternion.copy(m0.body.quaternion);
    const card = maya.bot.card;
    if (card) card.material.opacity *= cardOn;
  };
  maya.set({ rot: facing(1) });
  lab.playCard('a', ['m3']);

  // she drives as usual
  const SPEED = 4.4;
  await lab.tween(0.5, (e, k) => maya.set({ x: 1 + 1.7 * (0.4 * k * k + 0.6 * k) }), ease.linear);

  // nearing the rim: time slows, the room goes down
  lab.slowmo(0.36, 0.2);
  arena.setDim(0.6);
  camTo(0.4, { d: 0.62, el: HOME.el - 0.1, tx: W(3.5, 1).x, ty: 0.05, tz: W(3.5, 1).z }, ease.inOut);
  lab.tween(0.2, (e) => (tagsOn = 1 - e), ease.linear);
  await lab.tween(0.42 / SPEED, (e) => maya.set({ x: 2.7 + 0.42 * e }), ease.linear);

  // the crossing: everything of her that passes the rim goes dark; her colour piles up as the stain behind
  maya.set({ trail: false });
  stain.visible = true;
  const X0 = 3.12;
  const X1 = 3.88;
  await lab.tween((X1 - X0) / SPEED, (e, k) => {
    maya.set({ x: X0 + (X1 - X0) * k });
    const f = ease.inOut(k);
    stainOn = f;
    redRoom = f;
    cardOn = 1 - f;
    rimMat.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.95 + 0.05;
  }, ease.linear);
  lab.tween(0.2, (e) => (rimMat.opacity = 0.05 * (1 - e)), ease.out);
  lab.ring(W(3, 1, 0.02), '#ff4d6d', 0.25, 0.03, 0.3);
  // the dark glass body glides on over the hole, then drops: no light, no sound
  await lab.tween(0.1, (e) => maya.set({ x: X1 + (4 - X1) * e }), ease.out);
  lab.slowmo(1, 0.3);
  await lab.tween(0.28, (e) => maya.set({ lift: -0.85 * e, pitch: 0.12 * e }), ease.in);
  maya.set({ visible: false });
  maya.release({ on: false });

  // the stain notices: it shivers once
  await lab.tween(0.2, (e, k) => (stainShiver = Math.sin(k * Math.PI)), ease.linear);
  stainShiver = 0;

  // ...and drains into the seams: threads run out along the grout to the edges and drip off
  const threads = buildThreads(lab, arena, W, RED, glow);
  camTo(0.75, { d: 1.04, el: HOME.el + 0.22, tx: HOME.tx, ty: HOME.ty, tz: HOME.tz }, ease.inOut);
  const drain = 0.85;
  lab.tween(drain, (e) => {
    stainOn = 1 - ease.inOut(e);
    redRoom = 1 - ease.in(e);
    stain.scale.multiplyScalar(1 - 0.25 * e);
  }, ease.linear);
  lab.at(0.45, () => arena.setDim(0));
  await threads.run(drain + 0.02);

  // the room is back; the camera settles home
  lab.tween(0.4, (e) => (tagsOn = e), ease.in);
  await camTo(0.4, { ...HOME }, ease.inOut);
  threads.stop();
  stopStain();
  stopRoom();
  stopTags();
  releaseCam();
}

/** Red threads of light that run along the board's seams from the stain's cell to the edges. */
function buildThreads(lab, arena, W, RED, glow) {
  const { THREE } = lab;
  const course = arena.course;
  const isPit = (x, y) => course.cells[y * course.w + x]?.k === 'pit';
  // grid corners are at half-integers; a step runs along a seam between two cells
  // paths: hand-picked so the pattern reads (and skirts the pit), each ending at an edge
  const paths = [
    [[2.5, 0.5], [2.5, -0.5]],
    [[2.5, 0.5], [-0.5, 0.5]],
    [[2.5, 1.5], [0.5, 1.5], [0.5, 3.5]],
    [[2.5, 1.5], [2.5, 3.5]],
    [[3.5, 1.5], [3.5, 2.5], [6.5, 2.5]],
    [[3.5, 0.5], [3.5, -0.5]],
    [[3.5, 0.5], [6.5, 0.5]],
    [[3.5, 1.5], [4.5, 1.5], [4.5, -0.5]],
  ];
  void isPit;
  const group = new THREE.Group();
  lab.add(group);
  const items = [];
  const STEP = 0.04;
  for (const path of paths) {
    const pts = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.ceil(len / STEP);
      for (let j = i ? 1 : 0; j <= n; j++) pts.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
    }
    const n = pts.length;
    const pos = new Float32Array(n * 2 * 3);
    const col = new Float32Array(n * 2 * 3);
    const idx = [];
    const w = 0.036;
    for (let i = 0; i < n; i++) {
      const p = W(pts[i][0], pts[i][1], 0.012);
      const q = W(...pts[Math.min(n - 1, i + 1)]);
      const o = W(...pts[Math.max(0, i - 1)]);
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      pos.set([p.x - dz * w, p.y, p.z + dx * w, p.x + dz * w, p.y, p.z - dx * w], i * 6);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    group.add(mesh);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: RED.clone().multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    head.scale.setScalar(0.15);
    group.add(head);
    const end = pts[n - 1];
    items.push({ pts, mesh, col, head, len: (n - 1) * STEP, end, dripped: false });
  }
  const drips = [];
  const r = RED.clone();
  let stopFn = null;
  return {
    run(dur) {
      const t0 = lab.t;
      // each thread arrives at its edge at its own time, fast at first and slowing, like water finding its way
      for (const it of items) it.T = 0.26 + 0.12 * it.len + lab.range(0, 0.1);
      stopFn = lab.every(() => {
        const t = lab.t - t0;
        const fadeAll = Math.max(0, 1 - Math.max(0, t - 0.85) / 0.5);
        for (const it of items) {
          const kk = Math.min(1, t / it.T);
          const travel = it.len * (1 - (1 - kk) ** 2);
          const n = it.pts.length;
          for (let i = 0; i < n; i++) {
            const sAt = i * STEP;
            let k = 0;
            if (sAt <= travel) {
              const ts = it.T * (1 - Math.sqrt(Math.max(0, 1 - sAt / it.len))); // when the head passed here
              const age = t - ts;
              k = (0.6 + 1.9 * Math.exp(-age / 0.16)) * Math.exp(-Math.max(0, age - 0.22) / 0.4);
            }
            k *= fadeAll;
            it.col.set([r.r * k, r.g * k, r.b * k, r.r * k, r.g * k, r.b * k], i * 6);
          }
          it.mesh.geometry.attributes.color.needsUpdate = true;
          const hi = Math.min(n - 1, Math.round(travel / STEP));
          it.head.position.copy(W(it.pts[hi][0], it.pts[hi][1], 0.03));
          it.head.material.opacity = (travel < it.len - 0.001 ? 1 : 0) * fadeAll;
          if (!it.dripped && travel >= it.len - 0.001) {
            it.dripped = true;
            const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: RED.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            d.scale.set(0.12, 0.22, 1);
            const at = W(it.end[0], it.end[1], 0);
            // nudge it just outside the slab's edge so it falls down the side
            const cx = arena.course.w / 2 - 0.5;
            const cy = arena.course.h / 2 - 0.5;
            const out = W(it.end[0] + Math.sign(it.end[0] - cx) * (Math.abs(it.end[0] - cx) > cx ? 0.06 : 0), it.end[1] + Math.sign(it.end[1] - cy) * (Math.abs(it.end[1] - cy) > cy ? 0.06 : 0), 0);
            d.position.copy(out.lerp(at, 0));
            group.add(d);
            drips.push({ d, t0: lab.t });
          }
        }
        for (const dp of drips) {
          const a = lab.t - dp.t0;
          dp.d.position.y = -2.4 * a * a - 0.05;
          dp.d.material.opacity = Math.max(0, 1 - a / 0.7);
        }
      });
      return lab.wait(dur);
    },
    stop() {
      stopFn?.();
      group.visible = false;
    },
  };
}

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Her outline as a soft glow (front toward the top of the canvas = north before turning). */
function pebbleTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const s = 128 / 0.8; // canvas px per unit (the plane is 0.8 units before the robot scale)
  const P = (x, y) => [64 + x * s, 64 - y * s];
  const path = () => {
    g.beginPath();
    g.moveTo(...P(0, 0.29));
    g.bezierCurveTo(...P(0.11, 0.29), ...P(0.31, -0.12), ...P(0.29, -0.22));
    g.bezierCurveTo(...P(0.27, -0.31), ...P(0.13, -0.33), ...P(0, -0.29));
    g.bezierCurveTo(...P(-0.13, -0.33), ...P(-0.27, -0.31), ...P(-0.29, -0.22));
    g.bezierCurveTo(...P(-0.31, -0.12), ...P(-0.11, 0.29), ...P(0, 0.29));
    g.closePath();
  };
  g.filter = 'blur(5px)';
  path();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.fill();
  g.filter = 'blur(1.5px)';
  path();
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A thin line of light: bright core, soft sides (across x). */
function lineTex(THREE) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.35)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
