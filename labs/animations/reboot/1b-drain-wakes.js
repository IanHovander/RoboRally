// Reboot, idea 3 through a character-acting lens: the board's light drains into the token, beads up into Maya,
// and both robots act it out. Theo feels the floor's light slide out from under him (and lifts his feet the
// second time, because now he knows it's coming); Maya wakes up blinking, looks around, gets ambushed by the
// first grey drop and sees the second one coming.
export const meta = {
  title: 'The light drains to her (and she wakes up)',
  idea: 'The glass dims from its edges inward while its light slides down into the empty token like water into a drain, swirling a little, and pools there warming to red. The pool beads up like mercury into Maya, who wakes with a slow blink and a "where am I?" look. The light seeps back out along the same fingers; Theo, who was startled when it slid out from under him, lifts onto his toes before it comes back. Two late grey trickles crawl in: the first catches Maya from behind (she jumps), she looks over her shoulder, sees the second coming, braces, and it soaks in anyway.',
  notes: 'Sound: a low glassy hush as the light drains (a long downward glass glide), one round wet "plink" as the bead forms, two dull muted ticks for the grey drops. The board itself is the drain: the glass top samples its own light along a sink flow (a shader patch on topMat), so the seams, crosses and the board edge visibly slide in and the dark follows them from the edges. Several robots rebooting would split the flow between their tokens.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const tok = lab.pos(3, 1);
  const RED = new THREE.Color('#ff4d6d');
  const WARM = new THREE.Color('#f4efe4');

  // ---------- keyframe helper: [[t, v, easeName?], ...] (ease applies to the segment ending at that key) ----------
  const track = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (ease[e ?? 'inOut'] ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => {
    const k = clamp01((v - a) / (b - a));
    return k * k * (3 - 2 * k);
  };

  // ---------- the drain: the glass top samples its own light along a sink flow ----------
  const FING = 0.3; // how much the drain front breaks into fingers (streams)
  const FING_R = 0.55; // the return seeps out even more along the fingers
  const SWIRL = 0.035;
  const R2MAX = (W / 2) ** 2 + (H / 2 + 0.5) ** 2 + 0.6; // farthest corner from the token, squared
  const PMAX = R2MAX / (1 - FING * 0.75);
  const U = {
    uP: { value: 0 },
    uR: { value: -1 },
    uFing: { value: FING },
    uFingR: { value: FING_R },
    uSwirl: { value: SWIRL },
    uFloor: { value: 0.16 },
    uTok: { value: new THREE.Vector2(tok.x, tok.z) },
    uSize: { value: new THREE.Vector2(W, H) },
  };
  const mat = arena.topMat;
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uP; uniform float uR; uniform float uFing; uniform float uFingR; uniform float uSwirl; uniform float uFloor;
uniform vec2 uTok; uniform vec2 uSize;
float gPresent = 1.0;
float lumFingers(float a) { return 0.6 * sin(5.0 * a + 1.3) + 0.3 * sin(3.0 * a - 0.7) + 0.1 * sin(11.0 * a + 2.0); }
vec2 lumDrain(vec2 uv) {
  vec2 w = vec2((uv.x - 0.5) * uSize.x, (0.5 - uv.y) * uSize.y);
  vec2 d = w - uTok;
  float r2 = dot(d, d);
  float r = sqrt(r2);
  float a = atan(d.y, d.x);
  if (uR >= 0.0) {
    float R = uR * (1.0 + uFingR * lumFingers(a));
    gPresent = 1.0 - smoothstep(R - 0.7, R + 0.05, r);
    return uv;
  }
  float P = uP * (1.0 + uFing * lumFingers(a));
  float r0 = sqrt(r2 + P);
  float a0 = a + uSwirl * P / (r2 + 0.8);
  vec2 w0 = uTok + r0 * vec2(cos(a0), sin(a0));
  vec2 uv0 = vec2(w0.x / uSize.x + 0.5, 0.5 - w0.y / uSize.y);
  vec2 o = max(-uv0, uv0 - 1.0);
  float e = max(o.x, o.y);
  gPresent = 1.0 - smoothstep(-0.03, 0.01, e);
  return uv0;
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
  vec2 lumUv = lumDrain(vEmissiveMapUv);
  vec4 emissiveColor = texture2D(emissiveMap, lumUv);
  totalEmissiveRadiance *= emissiveColor.rgb * gPresent;
#endif`,
      )
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= mix(uFloor, 1.0, gPresent);');
  };
  mat.customProgramCacheKey = () => 'lab-reboot-1b-drain';
  mat.needsUpdate = true;

  // the same flow in JS, to know when the dark reaches a robot
  const fingers = (a) => 0.6 * Math.sin(5 * a + 1.3) + 0.3 * Math.sin(3 * a - 0.7) + 0.1 * Math.sin(11 * a + 2);
  const presentAt = (wx, wz) => {
    const dx = wx - tok.x;
    const dz = wz - tok.z;
    const r2 = dx * dx + dz * dz;
    const r = Math.sqrt(r2);
    const a = Math.atan2(dz, dx);
    if (U.uR.value >= 0) {
      const R = U.uR.value * (1 + FING_R * fingers(a));
      return 1 - smooth(R - 0.7, R + 0.05, r);
    }
    const P = U.uP.value * (1 + FING * fingers(a));
    const r0 = Math.sqrt(r2 + P);
    const a0 = a + (SWIRL * P) / (r2 + 0.8);
    const x0 = tok.x + r0 * Math.cos(a0);
    const z0 = tok.z + r0 * Math.sin(a0);
    const e = Math.max(Math.abs(x0) - W / 2, Math.abs(z0) - H / 2);
    return 1 - smooth(-0.03 * W, 0.01 * W, e);
  };

  // the rest of the room dims with the board
  const slab = arena.board.children.find((o) => Array.isArray(o.material));
  const edgeMat = slab?.material[0];
  const edge0 = edgeMat?.emissiveIntensity ?? 0.32;
  const spillMat = arena.spill.material;
  const spill0 = spillMat.opacity;
  lab.cleanup(() => {
    mat.onBeforeCompile = prevCompile;
    mat.customProgramCacheKey = prevKey;
    mat.needsUpdate = true;
    if (edgeMat) edgeMat.emissiveIntensity = edge0;
    spillMat.opacity = spill0;
  });

  // ---------- the pool of gathered light on the token ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.6)');
    grad.addColorStop(0.65, 'rgba(255,255,255,.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glowMat = (color) => new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(new THREE.Color()));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(tok.x, 0.012, tok.z);
  pool.renderOrder = 4;
  lab.add(pool);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(new THREE.Color()));
  core.rotation.x = -Math.PI / 2;
  core.position.set(tok.x, 0.014, tok.z);
  core.renderOrder = 4;
  lab.add(core);

  // ---------- two late grey trickles ----------
  const GREY = new THREE.Color('#aab3bf');
  const makeTrickle = (from, ctrl, to) => {
    const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
    const beads = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(GREY.clone()));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 4;
      m.visible = false;
      lab.add(m);
      beads.push(m);
    }
    return { curve, beads };
  };
  const toWorld = (x, y) => lab.pos(x, y).setY(0.016);
  // from behind her (west), and from the south-west, curling in like water finding its way
  const drip1 = makeTrickle(toWorld(-0.2, 0.2), toWorld(1.4, 2.0), toWorld(2.55, 1.05));
  const drip2 = makeTrickle(toWorld(0.6, 3.3), toWorld(2.6, 3.2), toWorld(2.75, 1.4));
  const showTrickle = (tr, k, brightness) => {
    // k: 0 = at its start, 1 = arrived; the head leads, the tail follows a little behind
    tr.beads.forEach((m, i) => {
      const kk = k - i * 0.016;
      m.visible = kk > 0 && kk < 1 && brightness > 0.01;
      if (!m.visible) return;
      const p = tr.curve.getPoint(kk);
      m.position.copy(p);
      const s = (0.26 - i * 0.011) * (0.6 + 0.4 * brightness);
      m.scale.set(s, s, 1);
      m.material.color.copy(GREY).multiplyScalar(1.1 * brightness * (1 - i / 19));
    });
  };

  // ---------- the actors ----------
  const maya = lab.puppet('a');
  maya.set({ x: 3, y: 1, rot: facing(1), visible: false, trail: false });
  const theo = lab.puppet('b');
  const theoRot = facing(3);
  theo.set({ x: 5, y: 2, rot: theoRot, trail: false });
  const mm = maya.model;
  const eye = (() => {
    let e = null;
    mm.body.traverse((o) => {
      if (o.isMesh && o.material === mm.eyeMat) e = o;
    });
    return e;
  })();
  const eyeScale0 = eye.scale.clone();
  const eyePos0 = eye.position.clone();
  const paint = mm.paint;
  const metal0 = paint.metalness;
  const rough0 = paint.roughness;
  lab.cleanup(() => {
    eye.scale.copy(eyeScale0);
    eye.position.copy(eyePos0);
    paint.metalness = metal0;
    paint.roughness = rough0;
  });
  const theoWorld = lab.pos(5, 2);

  // per-frame state the 'each' hooks read
  const st = { mayaEye: 0, mayaEyeGrey: 0, mayaEyeOpen: 0, mayaGlow: 0, mayaMetal: 0, mayaRing: 0, mayaGreyFlash: 0, theoLit: 1, theoSquint: 0, glance: 0 };
  maya.each = (m) => {
    const eyeK = st.mayaEye;
    const grey = st.mayaEyeGrey;
    const c = new THREE.Color(3.2, 3.1, 2.9).lerp(new THREE.Color(0.55, 0.58, 0.62), grey);
    m.eyeMat.color.copy(c).multiplyScalar(eyeK);
    eye.scale.set(eyeScale0.x * Math.max(0.05, st.mayaEyeOpen), eyeScale0.y, eyeScale0.z);
    eye.position.set(eyePos0.x + st.glance * 0.045, eyePos0.y, eyePos0.z);
    m.paint.metalness = st.mayaMetal;
    m.paint.roughness = rough0 * (1 - st.mayaMetal) + 0.04 * st.mayaMetal;
    m.paint.emissive.copy(RED).lerp(GREY, st.mayaGreyFlash);
    m.paint.emissiveIntensity = 0.16 + st.mayaGlow + st.mayaGreyFlash * 0.5;
    m.ringMat.opacity = 0.9 * st.mayaRing;
    m.poolMat.opacity = 0.75 * st.mayaRing;
  };
  theo.each = (m) => {
    const lit = 0.18 + 0.82 * st.theoLit;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(lit * (1 - 0.6 * st.theoSquint));
    m.poolMat.opacity = 0.75 * lit;
    m.ringMat.opacity = 0.9 * lit;
    m.paint.emissiveIntensity = 0.16 * lit;
  };

  const T0 = lab.t;
  // a gentle lean of the camera toward the token while the light drains
  const camRelease = lab.camera((home, t) => {
    const k = track(t - T0, [[0, 0], [0.9, 1, 'inOut'], [1.6, 1], [2.2, 0, 'inOut']]);
    const target = home.target.clone().lerp(tok, 0.25 * k);
    return { target, dist: home.dist * (1 - 0.07 * k), el: home.el + 0.03 * k };
  });

  // ---------- the timeline ----------
  const END = 2.84;
  const DRAIN = 0.9;
  const RET0 = 1.42; // the light starts to seep back
  const RET1 = 2.12;
  const RMAX = 6.4;
  const update = () => {
    const t = lab.t - T0;

    // the board's light: drains in, then seeps back out
    if (t < RET0) {
      U.uR.value = -1;
      U.uP.value = PMAX * ease.inOut(clamp01(t / DRAIN)) ** 1.15;
    } else {
      U.uP.value = 0;
      U.uR.value = RMAX * ease.inOut(clamp01((t - RET0) / (RET1 - RET0)));
    }
    const drained = t < RET0 ? clamp01(U.uP.value / PMAX) : 1 - clamp01((t - RET0) / (RET1 - RET0));
    if (edgeMat) edgeMat.emissiveIntensity = edge0 * (1 - 0.8 * drained);
    spillMat.opacity = spill0 * (1 - 0.85 * drained);

    // the pool fills with what the drain swallowed, warming to her red, then becomes her
    const fill = t < DRAIN + 0.05 ? clamp01(U.uP.value / (R2MAX * 0.9)) ** 0.9 : 1;
    const bead = smooth(DRAIN - 0.02, DRAIN + 0.32, t); // 0 = pool on the glass, 1 = it's her
    const warm = smooth(0.35, DRAIN, t);
    const poolI = fill * (1 - 0.85 * bead) * (1 - smooth(1.3, 1.7, t));
    pool.material.color.copy(WARM).lerp(RED, warm).multiplyScalar(1.5 * poolI);
    const ps = 0.6 + 0.9 * fill - 0.5 * bead;
    pool.scale.set(ps, ps, 1);
    core.material.color.copy(WARM).lerp(RED, warm * 0.8).multiplyScalar(2.6 * fill * (1 - bead));
    const cs = (0.22 + 0.3 * fill) * (1 - 0.6 * bead);
    core.scale.set(cs, cs, 1);

    // ----- Maya -----
    const vis = t >= DRAIN;
    const sy = track(t, [[DRAIN, 0.04], [DRAIN + 0.2, 1.24, 'out'], [DRAIN + 0.33, 0.88, 'inOut'], [DRAIN + 0.45, 1.05, 'inOut'], [DRAIN + 0.56, 1, 'inOut']]);
    const sxz = track(t, [[DRAIN, 1.4], [DRAIN + 0.2, 0.84, 'out'], [DRAIN + 0.33, 1.1, 'inOut'], [DRAIN + 0.45, 0.97, 'inOut'], [DRAIN + 0.56, 1, 'inOut']]);
    st.mayaMetal = 1 - smooth(DRAIN + 0.25, DRAIN + 0.55, t);
    st.mayaGlow = 1.3 * (1 - smooth(DRAIN + 0.1, DRAIN + 0.6, t));
    st.mayaRing = smooth(DRAIN + 0.2, DRAIN + 0.6, t);
    // waking: eye opens halfway, closes, opens (1.30-1.52)
    st.mayaEye = t < 1.3 ? 0 : 1;
    st.mayaEyeOpen = track(t, [[1.3, 0], [1.37, 0.45, 'out'], [1.41, 0.45], [1.45, 0.05, 'in'], [1.53, 1, 'out']]);
    // "where am I?": glance left, glance right, front (eye slides, head follows a little)
    st.glance = track(t, [[1.54, 0], [1.6, 1, 'out'], [1.68, 1], [1.76, -1, 'inOut'], [1.84, -1], [1.92, 0, 'inOut']]);
    let rotOff = track(t, [[1.54, 0], [1.62, 0.32, 'out'], [1.7, 0.32], [1.79, -0.26, 'inOut'], [1.86, -0.26], [1.95, 0, 'inOut']]);
    let pitch = track(t, [[1.5, 0], [1.6, -0.08, 'out'], [1.9, -0.08], [2.0, 0, 'inOut']]);
    let lift = 0;
    let sy2 = 1;
    let sx2 = 1;
    let roll = 0;

    // grey trickle 1: crawls in from behind; she never sees it
    const D1A = 1.68;
    const D1B = 2.08;
    showTrickle(drip1, clamp01((t - D1A) / (D1B - D1A)) ** 0.9, t < D1B ? smooth(D1A, D1A + 0.12, t) : 0);
    // grey trickle 2: from the south-west; she sees this one coming
    const D2A = 1.96;
    const D2B = 2.43;
    showTrickle(drip2, ease.inOut(clamp01((t - D2A) / (D2B - D2A))), t < D2B ? smooth(D2A, D2A + 0.12, t) : 0);

    // soak 1: she jumps (eyes wide, grey for a blink)
    const s1 = t - D1B;
    if (s1 >= 0) {
      lift += track(s1, [[0, 0], [0.06, 0.09, 'out'], [0.16, 0, 'in']]);
      sy2 *= track(s1, [[0, 1], [0.05, 1.16, 'out'], [0.16, 0.92, 'in'], [0.24, 1, 'out']]);
      sx2 *= track(s1, [[0, 1], [0.05, 0.9, 'out'], [0.16, 1.07, 'in'], [0.24, 1, 'out']]);
    }
    st.mayaEyeGrey = Math.max(track(t, [[D1B, 0], [D1B + 0.02, 1, 'out'], [D1B + 0.14, 1], [D1B + 0.2, 0, 'in']]), track(t, [[D2B, 0], [D2B + 0.02, 1, 'out'], [D2B + 0.16, 1], [D2B + 0.24, 0, 'in']]));
    st.mayaGreyFlash = Math.max(track(t, [[D1B, 0], [D1B + 0.03, 1, 'out'], [D1B + 0.25, 0, 'in']]), track(t, [[D2B, 0], [D2B + 0.03, 1, 'out'], [D2B + 0.3, 0, 'in']]));
    // the startle opens her eye wide; then she looks back over her right shoulder and narrows it
    st.mayaEyeOpen *= track(t, [[D1B, 1], [D1B + 0.04, 1.5, 'out'], [D1B + 0.18, 1, 'inOut'], [2.24, 1], [2.3, 0.55, 'inOut'], [D2B, 0.55], [D2B + 0.03, 0.25, 'out'], [D2B + 0.18, 1, 'inOut']]);
    rotOff += track(t, [[2.14, 0], [2.26, -0.75, 'out'], [D2B - 0.03, -0.62, 'inOut'], [2.62, -0.5], [2.8, 0, 'inOut']]);
    st.glance += track(t, [[2.14, 0], [2.24, -1, 'out'], [2.6, -1], [2.74, 0, 'inOut']]);
    // braces (hunches down), the drop soaks in, a shudder, then a resigned breath out
    sy2 *= track(t, [[2.3, 1], [D2B - 0.01, 0.88, 'out'], [D2B + 0.08, 0.95, 'inOut'], [2.64, 0.93], [2.78, 1, 'inOut']]);
    sx2 *= track(t, [[2.3, 1], [D2B - 0.01, 1.06, 'out'], [D2B + 0.08, 1.03, 'inOut'], [2.64, 1.04], [2.78, 1, 'inOut']]);
    pitch += track(t, [[2.3, 0], [D2B - 0.01, 0.1, 'out'], [2.62, 0.14, 'inOut'], [2.8, 0, 'inOut']]);
    const s2 = t - D2B;
    if (s2 >= 0 && s2 < 0.3) roll += Math.sin(s2 * 55) * 0.07 * (1 - s2 / 0.3);
    maya.set({ visible: vis, sx: sxz * sx2, sz: sxz * sx2, sy: sy * sy2, lift, pitch, roll, rot: facing(1) + rotOff });

    // ----- Theo -----
    const lit = presentAt(theoWorld.x, theoWorld.z);
    st.theoLit = lit;
    // the floor's light starts sliding away under him: he looks down at it, then after it
    let tRot = track(t, [[0.22, 0], [0.4, -0.28, 'out'], [0.62, -0.38, 'inOut'], [0.9, -0.5, 'inOut'], [1.3, -0.5], [1.5, -0.42, 'inOut'], [1.95, -0.42], [2.2, -0.3, 'inOut'], [2.7, 0, 'inOut']]);
    let tPitch = track(t, [[0.22, 0], [0.42, 0.16, 'out'], [0.6, 0.16], [0.68, -0.12, 'out'], [0.82, 0.02, 'inOut'], [1.0, 0.1, 'inOut'], [1.15, -0.06, 'out'], [1.3, 0, 'inOut']]);
    // the dark reaches him: a little hop, as if the floor dropped
    let tLift = track(t, [[0.6, 0], [0.66, 0.07, 'out'], [0.78, 0, 'in'], [0.82, 0]]);
    let tsy = track(t, [[0.6, 1], [0.65, 1.1, 'out'], [0.78, 0.94, 'in'], [0.88, 1, 'out']]);
    // the light is coming back: this time he gets onto his toes before it arrives
    tLift += track(t, [[1.52, 0], [1.66, 0.06, 'out'], [1.86, 0.06], [1.98, 0, 'inOut']]);
    tsy *= track(t, [[1.52, 1], [1.66, 1.08, 'out'], [1.86, 1.08], [1.98, 0.97, 'inOut'], [2.08, 1, 'out']]);
    tPitch += track(t, [[1.52, 0], [1.66, -0.1, 'out'], [1.86, -0.1], [1.98, 0, 'inOut']]);
    // a sympathetic wince when the second drop lands
    st.theoSquint = track(t, [[D2B, 0], [D2B + 0.04, 1, 'out'], [D2B + 0.3, 0, 'inOut']]);
    tsy *= track(t, [[D2B, 1], [D2B + 0.05, 0.95, 'out'], [D2B + 0.3, 1, 'inOut']]);
    theo.set({ rot: theoRot + tRot, pitch: tPitch, lift: tLift, sy: tsy, sx: 1 / Math.sqrt(tsy), sz: 1 / Math.sqrt(tsy) });
    void tRot;
  };
  const stop = lab.every(update);
  update();
  await lab.wait(2.2);
  camRelease();
  await lab.wait(END - 2.2);
  stop();

  // ---------- home ----------
  U.uR.value = 50;
  if (edgeMat) edgeMat.emissiveIntensity = edge0;
  spillMat.opacity = spill0;
  eye.scale.copy(eyeScale0);
  eye.position.copy(eyePos0);
  paint.metalness = metal0;
  paint.roughness = rough0;
  maya.each = null;
  theo.each = null;
  maya.set({ sx: 1, sy: 1, sz: 1, lift: 0, pitch: 0, roll: 0, rot: facing(1) });
  theo.set({ sx: 1, sy: 1, sz: 1, lift: 0, pitch: 0, roll: 0, rot: theoRot });
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
}
