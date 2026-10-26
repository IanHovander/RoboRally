// Reboot, idea 2 (Skipping stone), animator c: cinematic & graphic staging.
// Shot like a stroboscopic photograph: the camera drops to water level, side-on, as Maya skims in out of the dark
// beyond the east edge, spinning flat like a stone. Every touch is a strobe: the frame freezes for a blink, a
// flash, and a frozen ghost of her stays on the glass with its ripple (red, then grey, grey: the 2 SPAM). Her
// eye paints the arcs in the air like a long exposure. She drops flat, slides the last half space and stops
// dead; for a beat the whole skip hangs there as one picture, then the camera rises home and it fades.
export const meta = {
  title: 'Strobe skip',
  idea:
    'Maya skims in out of the dark beyond the east edge, spinning flat like a stone, shot side-on from water level. Each touch is a strobe: a blink of freeze-frame and a flash that leaves a frozen ghost of her on the glass with a ripple (red, then grey, grey: the 2 SPAM), while her eye paints the arcs in the air like a long exposure. She slides the last half space and stops dead, and for a beat the whole skip hangs there as one photograph before the camera rises home.',
  notes:
    'Sound: a soft glass "tik" per touch, each lower and duller (the grey ones muted), a camera-shutter click of glass on each strobe, a long smooth slide, then a little settle chime. The room counts the ghosts: one red, two grey. Porting: the number of skips can follow the distance to the edge; ghosts are clones of the body with an additive material; the arcs are a tube along her eye\'s path; the strobe is a short overlay flash plus a 0.1 s time freeze.',
};

const MAYA_RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;
  const red = new THREE.Color(MAYA_RED);
  const grey = new THREE.Color(0.66, 0.67, 0.7);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);

  const ROW = 1;
  // the flight, in scene seconds from the start of the moment
  const legs = [
    { t0: 0.16, t1: 0.5, x0: 9.4, x1: 6.1, l0: 0.42, l1: 0, h: 0.08 }, // in out of the dark, low and fast
    { t0: 0.5, t1: 0.9, x0: 6.1, x1: 4.15, l0: 0, l1: 0, h: 0.48 }, // hop one
    { t0: 0.9, t1: 1.18, x0: 4.15, x1: 3.45, l0: 0, l1: 0, h: 0.2 }, // hop two, shorter and slower
  ];
  const SLIDE = { t0: 1.18, t1: 1.52, x0: 3.45, x1: 3 };
  const TOUCHES = [
    { t: 0.5, x: 6.1, color: red, freeze: 0.12, big: 1.4 },
    { t: 0.9, x: 4.15, color: grey, freeze: 0.08, big: 1.1 },
    { t: 1.18, x: 3.45, color: grey, freeze: 0.08, big: 0.9 },
  ];
  const SPIN = Math.PI * 2 * 3; // three whole turns, unwinding to nose east at the stop

  const T0 = arena.time;
  const now = () => arena.time - T0;

  // where she is at scene time T
  const pose = (T) => {
    let x = legs[0].x0;
    let lift = legs[0].l0;
    for (const L of legs) {
      if (T >= L.t0 && T < L.t1) {
        const u = (T - L.t0) / (L.t1 - L.t0);
        x = lerp(L.x0, L.x1, u);
        lift = lerp(L.l0, L.l1, u) + L.h * 4 * u * (1 - u);
      }
    }
    if (T >= SLIDE.t0) {
      const u = seg(T, SLIDE.t0, SLIDE.t1);
      x = lerp(SLIDE.x0, SLIDE.x1, ease.out3(u));
      lift = 0;
    }
    const p = clamp(T / SLIDE.t1);
    const spin = SPIN * (1 - p) ** 1.5;
    return { x, lift, spin };
  };

  // ---------- the long-exposure arcs her eye paints ----------
  const pathPts = [];
  const arcMat = new THREE.MeshBasicMaterial({ color: hdr(MAYA_RED, 1.7).lerp(hdr('#ffffff', 1.7), 0.35), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat);
  arc.frustumCulled = false;
  lab.add(arc);
  const rebuildArc = () => {
    if (pathPts.length < 4) return;
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const old = arc.geometry;
    arc.geometry = new THREE.TubeGeometry(curve, Math.min(220, pathPts.length * 3), 0.02, 6, false);
    old.dispose();
  };

  // ---------- ripples: a bright crest with a dark trough inside it, then two smaller ones ----------
  const ripples = [];
  const ripple = (x, color, size) => {
    const at = lab.pos(x, ROW);
    const make = (inner, blending, col, opacity) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, 1, 96), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, 0.01, at.z);
      lab.add(m);
      return m;
    };
    const t0 = now();
    const rings = [
      { crest: make(0.955, THREE.AdditiveBlending, hdr(color, 2.2), 1), trough: make(0.82, THREE.NormalBlending, new THREE.Color(0, 0, 0), 0.55), lag: 0, s: 1 },
      { crest: make(0.94, THREE.AdditiveBlending, hdr(color, 1.4), 1), trough: null, lag: 0.12, s: 0.72 },
      { crest: make(0.93, THREE.AdditiveBlending, hdr(color, 1.0), 1), trough: null, lag: 0.24, s: 0.48 },
    ];
    ripples.push({ t0, rings, size, dur: 1.1 });
  };
  const stepRipples = (T) => {
    for (const r of ripples) {
      for (const ring of r.rings) {
        const k = clamp((T - r.t0 - ring.lag) / r.dur);
        const s = 0.08 + ease.out3(k) * r.size * ring.s;
        const o = k <= 0 ? 0 : (1 - k) ** 1.6;
        ring.crest.scale.setScalar(s);
        ring.crest.material.opacity = o;
        if (ring.trough) {
          ring.trough.scale.setScalar(s * 0.985);
          ring.trough.material.opacity = 0.5 * o;
        }
      }
    }
  };

  // ---------- frozen ghosts left by the strobe ----------
  const ghosts = [];
  const ghost = (color) => {
    // place the group now (the lab applies poses after this hook runs)
    const q = maya.pose;
    const g0 = maya.group;
    const at0 = lab.pos(q.x, q.y);
    g0.position.set(at0.x, q.lift, at0.z);
    g0.rotation.set(-(q.pitch || 0), q.rot, -(q.roll || 0));
    g0.updateMatrixWorld(true);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { col: { value: hdr(color, 1) }, a: { value: 1 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 col; uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(col * (0.12 + 2.2 * rim) * a, 1.0); }',
    });
    const body = maya.model.body.clone(true);
    body.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = false;
      }
    });
    body.matrixAutoUpdate = false;
    body.matrix.copy(maya.model.body.matrixWorld);
    lab.add(body);
    const ring = null;
    ghosts.push({ mat, ring, born: now() });
  };

  // ---------- puppets ----------
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const p0 = pose(0);
  maya.set({ x: p0.x, y: ROW, lift: p0.lift, rot: lab.facing(1) + p0.spin, visible: false, trail: false });
  const look = { glow: 0 };
  maya.each = (m) => {
    // out in the dark beyond the edge only her eye and a faint sheen show, so she comes out of the dark
    m.paint.emissiveIntensity = 0.16 + look.glow;
  };

  // ---------- the camera: water level, side-on, tracking her ----------
  const cam = { low: 0, x: 5.3, punch: 0, hold: 0 };
  const releaseCam = lab.camera((home) => {
    const k = cam.low;
    const tx = lab.pos(cam.x, ROW).x;
    const target = home.target.clone().lerp(new THREE.Vector3(tx * 0.8, 0.15, lab.pos(0, ROW).z - 0.2), k);
    return { target, el: lerp(home.el, 0.66, k), dist: home.dist * lerp(1, lerp(0.72, 0.86, cam.hold), k) * (1 - 0.04 * cam.punch), az: -0.2 * k };
  });

  // ---------- the strobe: one bright frame, gone in a tenth of a second (real time, even while frozen) ----------
  const strobeDiv = document.createElement('div');
  strobeDiv.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen';
  lab.overlay.append(strobeDiv);
  let strobeAt = -9;
  let strobePeak = 0;

  // ---------- the timeline ----------
  const pending = TOUCHES.slice();
  let freezing = false;
  let stopped = false;
  const strobe = async (tc) => {
    freezing = true;
    lab.timeScale = 0.04;
    ghost(tc.color);
    ripple(tc.x, tc.color, tc.big);
    const sp = lab.toScreen(lab.pos(tc.x, ROW).setY(0.2));
    const tint = tc.color === red ? '255,214,222' : '236,240,248';
    strobeDiv.style.background = `radial-gradient(circle at ${sp.x}px ${sp.y}px, rgba(${tint},1), rgba(${tint},.35) 9%, rgba(${tint},.08) 26%, rgba(${tint},0) 48%)`;
    strobeAt = lab.real;
    strobePeak = tc.color === red ? 0.85 : 0.6;
    cam.punch = 1;
    await lab.waitReal(tc.freeze);
    lab.timeScale = 1;
    freezing = false;
  };

  const stop = lab.every((dt) => {
    const T = now();
    // touches: freeze exactly on the frame she meets the glass
    while (pending.length && T >= pending[0].t && !freezing) {
      const tc = pending.shift();
      const p = pose(tc.t);
      maya.set({ x: p.x, lift: 0, rot: lab.facing(1) + p.spin, roll: 0, pitch: 0, visible: true });
      strobe(tc);
    }
    if (!freezing) {
      const p = pose(T);
      const inAir = T < SLIDE.t0;
      // a slight forward lean while flying, a wobble after each touch
      let wob = 0;
      for (const tc of TOUCHES) if (T > tc.t) wob += Math.sin((T - tc.t) * 26) * Math.exp(-(T - tc.t) * 9) * 0.22;
      maya.set({ x: p.x, lift: p.lift, rot: lab.facing(1) + p.spin, roll: wob, pitch: inAir ? 0.06 : 0, visible: T >= 0.1, trail: T >= SLIDE.t0 });
      look.glow = 0.5 * (1 - smooth(seg(T, 0.2, 0.55)));
      // the dead stop: a little rock forward onto her nose and back
      if (T >= SLIDE.t1) {
        const k = seg(T, SLIDE.t1, SLIDE.t1 + 0.32);
        maya.set({ pitch: Math.sin(k * Math.PI * 2) * 0.14 * (1 - k), roll: 0, sy: 1 - 0.06 * Math.sin(k * Math.PI) });
        if (!stopped && k >= 1) stopped = true;
      }
      if (T > 0.1 && T < SLIDE.t0 + 0.02) {
        maya.group.updateMatrixWorld(true);
        const eye = maya.model.body.localToWorld(new THREE.Vector3(0, 0.2, 0));
        const last = pathPts[pathPts.length - 1];
        if (!last || last.distanceTo(eye) > 0.035) {
          pathPts.push(eye);
          rebuildArc();
        }
      }
    }
    // Theo flinches as she skims past him
    const fk = seg(T, 0.6, 1.05);
    const flinch = Math.sin(fk * Math.PI) * (1 - fk * 0.3);
    theo.set({ sy: 1 - 0.14 * flinch, sx: 1 + 0.06 * flinch, sz: 1 + 0.06 * flinch, pitch: -0.16 * flinch, roll: Math.sin(fk * Math.PI * 3) * 0.05 * (1 - fk) });

    stepRipples(T);
    const sk = (lab.real - strobeAt) / 0.1;
    strobeDiv.style.opacity = String(sk >= 1 || sk < 0 ? 0 : strobePeak * (1 - sk) ** 2);
    // the photograph: the ghosts and arcs hang on for a beat after she stops, then fade
    const fade = 1 - smooth(seg(T, 1.74, 2.18));
    for (const g of ghosts) {
      const age = T - g.born;
      const born = 1 + 1.4 * Math.max(0, 1 - age / 0.18); // a strobe-bright pop when it's made
      g.mat.uniforms.a.value = 0.85 * born * fade;
    }
    arcMat.opacity = 0.85 * fade;

    // camera: down to water level as she comes, tracking her, up and home after the stop
    cam.low = smooth(seg(T, 0, 0.32)) * (1 - smooth(seg(T, 1.66, 2.3)));
    const px = pose(T).x;
    // once she stops, pull back to take in the whole skip as one picture
    cam.hold = smooth(seg(T, SLIDE.t1 - 0.1, SLIDE.t1 + 0.35));
    cam.x = lerp(cam.x, lerp(Math.min(5.3, px), 4.5, cam.hold), 1 - Math.exp(-dt * 7));
    cam.punch *= freezing ? 1 : 0.8;
  });

  await lab.wait(2.3);
  releaseCam();
  await lab.wait(0.12);
  stop();
  arc.visible = false;
  maya.each = null;
  maya.release({ x: 3, y: ROW, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
