// Edge, idea 4 (Skipping stone), animator a: weight & physical comedy.
export const meta = {
  title: 'Skipping stone',
  idea:
    'Maya is a Pebble, so she skims. She leaves the rim fast and flat, meets the darkness just below glass height and it turns out to be still water: ' +
    'the hard first slap sets her spinning, and she skips one, two, three, each hop shorter and lower, each touch sending wide, slow rings of light out across the black ' +
    'that overlap and cross. Beads of light thrown up by the first touches fall back and ring the water too. On the last touch she wobbles flat like a spun coin, ' +
    'the light closes over her and she sinks with one small ripple. Ava nods along to each skip, then looks back to the front, and the dark is still again.',
  notes:
    'Sound: three descending glass "plip"s (the first a real slap), tiny drips for the beads, a fast coin-rattle as she wobbles, and a soft low "bloop" as she goes under. ' +
    'The water is one shader on a plane just below the glass: every touch is a source of three expanding, slowing rings, summed so they interfere where they cross. ' +
    'The skip lengths, the spin and the beads can vary a little each time. The camera leans east so the lake is in the picture, then comes home as it stills.',
};

const PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

/** A ribbon of light like Lumen's trail: flat on the glass, turning to face the camera when it leaves it. */
function makeRibbon(lab, max) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 6);
  const col = new Float32Array(max * 6);
  const uv = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  lab.add(mesh);
  const T = new THREE.Vector3();
  const V = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const sf = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    draw(pts) {
      const n = Math.min(pts.length, max);
      if (n < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        T.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
        V.set(cam.x - p.x, cam.y - p.y, cam.z - p.z).normalize();
        sc.crossVectors(T, V).normalize();
        sf.crossVectors(T, up);
        if (sf.lengthSq() < 1e-6) sf.copy(sc);
        else sf.normalize();
        if (sc.dot(sf) < 0) sc.negate();
        const f = p.flat ?? 1;
        sf.multiplyScalar(f).addScaledVector(sc, 1 - f).normalize();
        pos.set([p.x - sf.x * p.w, p.y - sf.y * p.w, p.z - sf.z * p.w, p.x + sf.x * p.w, p.y + sf.y * p.w, p.z + sf.z * p.w], i * 6);
        col.set([p.r, p.g, p.b, p.r, p.g, p.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const RED = new THREE.Color('#ff4d6d');
  const WATER = -0.07; // the dark, just below the glass
  const ZM = -0.5;

  // ---------------- the water: a shader of summed ripples ----------------
  const MAXS = 16;
  const src = Array.from({ length: MAXS }, () => new THREE.Vector4(0, 0, -99, 1));
  const amp = new Array(MAXS).fill(0);
  let nSrc = 0;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 16),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uSrc: { value: src }, uAmp: { value: amp }, uCol: { value: new THREE.Color('#fff3ec') }, uTint: { value: RED.clone() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        #define MAXS ${MAXS}
        uniform float uTime; uniform float uFade; uniform vec4 uSrc[MAXS]; uniform float uAmp[MAXS]; uniform vec3 uCol; uniform vec3 uTint;
        varying vec3 vW;
        void main() {
          float acc = 0.0;
          float tint = 0.0;
          for (int i = 0; i < MAXS; i++) {
            float a0 = uAmp[i];
            if (a0 <= 0.0) continue;
            vec4 s = uSrc[i];
            float a = uTime - s.z;
            if (a <= 0.0) continue;
            float d = length(vW.xz - s.xy);
            for (int k = 0; k < 3; k++) {
              float ak = a - float(k) * 0.16;
              if (ak <= 0.0) continue;
              float r = s.w * (1.0 - exp(-ak * 1.5)) + 0.12 * ak;
              float w = 0.018 + 0.03 * ak + 0.012 * r;
              float x = (d - r) / w;
              float ring = exp(-x * x) * smoothstep(0.0, 0.3, r);
              float fall = exp(-ak * 1.5) / (1.0 + 0.35 * r);
              float kk = k == 0 ? 1.0 : (k == 1 ? 0.5 : 0.28);
              acc += a0 * ring * fall * kk;
              tint += a0 * ring * fall * kk * exp(-ak * 2.5);
            }
          }
          gl_FragColor = vec4((uCol * acc + uTint * tint * 2.2) * uFade, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  water.rotation.x = -PI / 2;
  water.position.set(6, WATER, -0.5);
  water.renderOrder = 1;
  lab.add(water);
  const ripple = (x, z, size, a) => {
    if (nSrc >= MAXS) return;
    src[nSrc].set(x, z, water.material.uniforms.uTime.value, size);
    amp[nSrc] = a;
    nSrc++;
  };

  // ---------------- beads of light thrown up by a touch ----------------
  const NB = 12;
  const beadPos = new Float32Array(NB * 3);
  const beadCol = new Float32Array(NB * 3);
  const beadGeo = new THREE.BufferGeometry();
  beadGeo.setAttribute('position', new THREE.BufferAttribute(beadPos, 3));
  beadGeo.setAttribute('color', new THREE.BufferAttribute(beadCol, 3));
  const beadPts = new THREE.Points(beadGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beadPts.frustumCulled = false;
  lab.add(beadPts);
  const beads = [];
  const splash = (at, n, speed) => {
    for (let i = 0; i < n && beads.length < NB; i++) {
      const c = i % 2 ? new THREE.Color('#fff4ea').multiplyScalar(2.4) : RED.clone().multiplyScalar(2.4);
      beads.push({ p: at.clone().setY(WATER + 0.02), v: new THREE.Vector3(lab.range(0.3, 1.2) * speed, lab.range(1.1, 1.9) * speed, lab.range(-0.9, 0.9) * speed), c, live: true });
    }
  };

  // ---------------- her path ----------------
  // drive (accelerating), off the rim and down to the water, then three skips and the settle
  const T_RIM = 0.9;
  const driveX = (t) => {
    if (t < 0.12) return 4 - 0.06 * ease.out(t / 0.12);
    const k = Math.min(1, (t - 0.12) / (T_RIM - 0.12));
    return 3.94 + 2.56 * k ** 1.55;
  };
  const vRim = (2.56 * 1.55) / (T_RIM - 0.12);
  const T1 = T_RIM + 0.075; // first touch: the slap
  const X1 = 6.5 + vRim * 0.075;
  const HOPS = [
    { x0: X1, x1: X1 + 0.78, t0: T1, t1: T1 + 0.43, h: 0.34, spin: 15 },
    { x0: X1 + 0.78, x1: X1 + 1.28, t0: T1 + 0.43, t1: T1 + 0.76, h: 0.18, spin: 10 },
    { x0: X1 + 1.28, x1: X1 + 1.55, t0: T1 + 0.76, t1: T1 + 0.99, h: 0.075, spin: 6 },
  ];
  const T_LAND = HOPS[2].t1;
  const X_LAND = HOPS[2].x1;
  const T_SINK = T_LAND + 0.24; // the wobble runs down and she goes under
  const T_UNDER = T_SINK + 0.24;
  const T_END = T_UNDER + 0.55;
  // spin angle: none while driving, kicked by the first slap, sapped by every touch
  const spinAt = (t) => {
    let a = 0;
    for (const h of HOPS) a += h.spin * Math.max(0, Math.min(t, h.t1) - h.t0);
    if (t > T_LAND) {
      const d = t - T_LAND;
      a += 1.5 * (1 - Math.exp(-d * 4));
    }
    return a;
  };
  function pose(t) {
    const P = { x: 4, y: 1, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, light: 1, visible: true, trail: false };
    if (t < T_RIM) {
      P.x = driveX(t);
      if (t < 0.12) {
        const k = ease.out(t / 0.12);
        P.pitch = -0.15 * k;
        P.sy = 1 - 0.06 * k;
      } else P.pitch = -0.15 * (1 - seg(t, 0.12, 0.45)) ** 2;
      return P;
    }
    if (t < T1) {
      // flat and fast off the rim, settling down onto the dark, leading edge a touch up
      const k = seg(t, T_RIM, T1);
      P.x = 6.5 + vRim * (t - T_RIM);
      P.lift = WATER * ease.in(k);
      P.pitch = -0.08 * k;
      return P;
    }
    P.rot = facing(1) + spinAt(t);
    for (const h of HOPS) {
      if (t < h.t1) {
        const k = (t - h.t0) / (h.t1 - h.t0);
        P.x = lerp(h.x0, h.x1, k);
        P.lift = WATER + 4 * h.h * k * (1 - k);
        // the touch: squash flat, then spring back; tilt as she leaves
        const sq = Math.max(0, 1 - k / 0.18);
        P.sy = 1 - 0.32 * sq * (h.h / 0.34) ** 0.5;
        P.sx = P.sz = 1 + 0.12 * sq * (h.h / 0.34) ** 0.5;
        P.pitch = -0.1 * Math.sin(k * PI);
        P.roll = 0.12 * Math.sin(k * PI) * (h.h / 0.34);
        return P;
      }
    }
    // the settle: a spun-coin wobble that runs down, faster and smaller, then under
    const d = t - T_LAND;
    P.x = X_LAND + 0.08 * (1 - Math.exp(-d * 8));
    const wob = 0.22 * Math.exp(-d * 5.5);
    const ph = 26 * d + 30 * d * d;
    P.roll = wob * Math.sin(ph);
    P.pitch = wob * Math.cos(ph);
    const sink = seg(t, T_SINK, T_UNDER);
    P.lift = WATER - 0.42 * ease.in(sink);
    P.light = 1 - ease.in(sink);
    P.visible = t < T_UNDER;
    return P;
  }

  // the dark is a mirror now: her reflection hangs under her, so every hop shows its height
  const reflMat = new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const refl = maya.model.body.clone(true);
  refl.traverse((o) => {
    if (o.isMesh) o.material = reflMat;
  });
  refl.matrixAutoUpdate = false;
  lab.add(refl);
  const mirror = new THREE.Matrix4().makeTranslation(0, WATER, 0).multiply(new THREE.Matrix4().makeScale(1, -1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -WATER, 0));
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const wobble = new THREE.Matrix4();

  // the light closing over her as she goes under
  const lip = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9df').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  lip.rotation.x = -PI / 2;
  lab.add(lip);

  lab.playCard('a', ['m3']);
  const t0 = lab.t;
  const base = maya.model.paint.emissiveIntensity;
  maya.model.paint.transparent = true;
  let light = 1;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * light, 3.1 * light, 2.9 * light);
    m.ringMat.opacity = 0.9 * light;
    m.poolMat.opacity = 0.75 * light;
    m.paint.opacity = Math.min(1, light * 1.4);
    m.paint.emissiveIntensity = base * light;
    const c = lab.bot('a').card;
    if (c) c.material.opacity *= 1 - seg(lab.t - t0, T_RIM, T1 + 0.2);
  };

  // the camera leans east so the lake is in the picture
  const aim = new THREE.Vector3(3.1, -0.05, -0.3);
  const releaseCam = lab.camera((home) => {
    const t = lab.t - t0;
    const k = ease.inOut(seg(t, 0.35, 1.05));
    return { target: home.target.clone().lerp(aim, k), el: lerp(home.el, 0.74, k), dist: lerp(home.dist, 12, k) };
  });

  // her trail, laid on the glass as she drives (it fades as it always does, through the end)
  const trail = makeRibbon(lab, 80);
  const laid = [];
  for (let t = 0.12; t <= T_RIM + 1e-6; t += 1 / 60) laid.push({ x: driveX(t) - 3, t });
  const touched = [false, false, false, false];
  let gone = false;
  lab.every((dt) => {
    const t = lab.t - t0;
    water.material.uniforms.uTime.value = t;
    water.material.uniforms.uFade.value = 1 - ease.inOut(seg(t, T_UNDER + 0.05, T_END));
    {
      const pts = [];
      let i = 0;
      for (const p of laid) {
        if (p.t > t) break;
        const age = Math.min(1, (t - p.t) / 3.2);
        const k = Math.max(0, 1 - age) ** 1.6 * 1.8 * Math.min(1, i / 3);
        pts.push({ x: p.x, y: 0.008, z: ZM, w: 0.16 + 0.06 * (1 - age), r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
        i++;
      }
      if (t < T_RIM) {
        const k = 1.8;
        pts.push({ x: driveX(t) - 3, y: 0.008, z: ZM, w: 0.22, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
      }
      trail.draw(pts);
    }

    const P = pose(t);
    light = P.light;
    if (!gone) {
      if (!P.visible) {
        gone = true;
        maya.release({ x: 8, y: 1, on: false });
        // released mid-frame: the game already placed her this frame, so hide her by hand until it catches up
        maya.group.visible = false;
        const c = lab.bot('a').card;
        if (c) c.visible = false;
      } else maya.set(P);
    }
    const at = lab.pos(P.x, 1);
    {
      // the reflection: mirrored about the water, shimmering a little
      const over = seg(P.x, 6.55, 6.75) * (P.visible ? 1 : 0) * P.light;
      reflMat.opacity = 0.42 * over;
      refl.visible = over > 0.01;
      if (refl.visible) {
        dummy.position.set(at.x, P.lift, at.z);
        dummy.rotation.set(-P.pitch, P.rot, -P.roll);
        dummy.scale.set(1.3 * P.sx, 1.3 * P.sy, 1.3 * P.sz);
        dummy.updateMatrix();
        wobble.makeScale(1 + 0.06 * Math.sin(t * 31), 1, 1 + 0.06 * Math.sin(t * 27 + 1));
        refl.matrix.copy(mirror).multiply(dummy.matrix).multiply(wobble);
      }
    }

    // the touches: rings on the water, beads thrown up
    HOPS.forEach((h, i) => {
      if (!touched[i] && t >= h.t0) {
        touched[i] = true;
        const p = lab.pos(h.x0, 1);
        ripple(p.x, p.z, [3.0, 2.3, 1.6][i], [2.3, 1.8, 1.35][i]);
        if (i < 2) splash(p, [6, 4][i], [1.0, 0.75][i]);
      }
    });
    if (!touched[3] && t >= T_UNDER - 0.06) {
      touched[3] = true;
      const p = lab.pos(X_LAND + 0.08, 1);
      ripple(p.x, p.z, 0.9, 1.0);
    }

    // beads arc, fall, and ring the water where they land
    beads.forEach((b, i) => {
      if (b.live) {
        b.v.y -= 7 * dt;
        b.p.addScaledVector(b.v, dt);
        if (b.p.y <= WATER) {
          b.live = false;
          ripple(b.p.x, b.p.z, 0.6, 0.7);
        }
      }
      beadPos.set([b.p.x, b.live ? b.p.y : -50, b.p.z], i * 3);
      beadCol.set([b.c.r, b.c.g, b.c.b], i * 3);
    });
    for (let i = beads.length; i < NB; i++) beadPos.set([0, -50, 0], i * 3);
    beadGeo.attributes.position.needsUpdate = true;
    beadGeo.attributes.color.needsUpdate = true;

    // the lip of light closing over her
    const ks = seg(t, T_SINK, T_UNDER + 0.05);
    lip.position.set(at.x, WATER + 0.005, at.z);
    lip.material.opacity = ks > 0 && ks < 1 ? Math.sin(ks * PI) * 0.9 : 0;
    lip.scale.setScalar(0.5 * (1 - ease.in(ks)) + 0.04);

    // Ava watches, nodding along to each skip, then looks back to the front
    const look = -0.55 * ease.inOut(seg(t, T_RIM - 0.25, T_RIM + 0.15)) + 0.55 * ease.inOut(seg(t, T_UNDER, T_END - 0.08));
    let nod = 0;
    for (const h of HOPS) nod += 0.14 * Math.sin(seg(t, h.t0 + 0.04, h.t0 + 0.22) * PI);
    ava.set({ x: 2, y: 3, rot: facing(0) + look, pitch: nod, lift: 0 });

    if (t > T_UNDER) releaseCam();
  });

  await lab.wait(T_END);
  ava.release({ x: 2, y: 3, d: 0 });
}
