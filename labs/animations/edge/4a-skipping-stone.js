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
      uniforms: { uTime: { value: 0 }, uSrc: { value: src }, uAmp: { value: amp }, uCol: { value: new THREE.Color('#ffe9df') }, uTint: { value: RED.clone() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        #define MAXS ${MAXS}
        uniform float uTime; uniform vec4 uSrc[MAXS]; uniform float uAmp[MAXS]; uniform vec3 uCol; uniform vec3 uTint;
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
              float r = s.w * (1.0 - exp(-ak * 1.6)) + 0.1 * ak;
              float w = 0.03 + 0.06 * ak + 0.025 * r;
              float x = (d - r) / w;
              float ring = exp(-x * x);
              float fall = exp(-ak * 1.35) / (1.0 + 0.55 * r);
              float kk = k == 0 ? 1.0 : (k == 1 ? 0.55 : 0.3);
              acc += a0 * ring * fall * kk;
              tint += a0 * ring * fall * kk * exp(-ak * 2.5);
            }
          }
          gl_FragColor = vec4(uCol * acc + uTint * tint * 1.4, 1.0);
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
  const beadPts = new THREE.Points(beadGeo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    { x0: X1, x1: X1 + 0.66, t0: T1, t1: T1 + 0.43, h: 0.24, spin: 15 },
    { x0: X1 + 0.66, x1: X1 + 1.1, t0: T1 + 0.43, t1: T1 + 0.76, h: 0.13, spin: 10 },
    { x0: X1 + 1.1, x1: X1 + 1.34, t0: T1 + 0.76, t1: T1 + 0.99, h: 0.055, spin: 6 },
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
    const P = { x: 4, y: 1, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, light: 1, visible: true, trail: true };
    if (t < T_RIM) {
      P.x = driveX(t);
      if (t < 0.12) {
        const k = ease.out(t / 0.12);
        P.pitch = -0.15 * k;
        P.sy = 1 - 0.06 * k;
      } else P.pitch = -0.15 * (1 - seg(t, 0.12, 0.45)) ** 2;
      return P;
    }
    P.trail = false;
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
        P.sy = 1 - 0.32 * sq * (h.h / 0.24) ** 0.5;
        P.sx = P.sz = 1 + 0.12 * sq * (h.h / 0.24) ** 0.5;
        P.pitch = -0.1 * Math.sin(k * PI);
        P.roll = 0.12 * Math.sin(k * PI) * (h.h / 0.24);
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
  const aim = new THREE.Vector3(2.5, -0.05, -0.15);
  const releaseCam = lab.camera((home) => {
    const t = lab.t - t0;
    const k = ease.inOut(seg(t, 0.35, 1.05));
    return { target: home.target.clone().lerp(aim, k), el: lerp(home.el, 0.8, k), dist: lerp(home.dist, 10.6, k) };
  });

  const touched = [false, false, false, false];
  let gone = false;
  lab.every((dt) => {
    const t = lab.t - t0;
    water.material.uniforms.uTime.value = t;

    const P = pose(t);
    light = P.light;
    if (!gone) {
      if (!P.visible) {
        gone = true;
        // hand her back hidden, near her trail's end so the game lets the trail fade on its own
        maya.release({ x: 6, y: 1, on: false });
      } else maya.set(P);
    }
    const at = lab.pos(P.x, 1);

    // the touches: rings on the water, beads thrown up
    HOPS.forEach((h, i) => {
      if (!touched[i] && t >= h.t0) {
        touched[i] = true;
        const p = lab.pos(h.x0, 1);
        ripple(p.x, p.z, [2.9, 2.2, 1.55][i], [2.3, 1.75, 1.3][i]);
        if (i < 2) splash(p, [6, 4][i], [1.0, 0.75][i]);
      }
    });
    if (!touched[3] && t >= T_UNDER - 0.06) {
      touched[3] = true;
      const p = lab.pos(X_LAND + 0.08, 1);
      ripple(p.x, p.z, 0.95, 1.0);
    }

    // beads arc, fall, and ring the water where they land
    beads.forEach((b, i) => {
      if (b.live) {
        b.v.y -= 7 * dt;
        b.p.addScaledVector(b.v, dt);
        if (b.p.y <= WATER) {
          b.live = false;
          ripple(b.p.x, b.p.z, 0.55, 0.75);
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
