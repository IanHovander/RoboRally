// Drive, idea 50 "Dolphin (rare)", animator b (character acting).
export const meta = {
  title: 'Dolphin',
  idea:
    'Move 2, one layer down. Maya takes a big breath (rises, puffs up, eye squeezed shut), holds it, and dives nose-first into the glass. ' +
    'For two spaces she is only a red glow gliding under the surface, the warm point of her eye leading it, the grid above her wavering through the rippling glass, while Theo leans over the spot where she vanished, peering. ' +
    'She breaches with a joyful barrel roll, gasps (eye wide), lands on (3, 2) facing east and shakes herself dry in a spray of light. Theo jumps, then turns to the room: did you see that? The rest of the program plays as normal.',
  notes:
    'Sound: a soft inhale-like rising tone, a glassy "plip" on entry, a muffled low hum with slow bubbles while she is under, a bright splash and a chime on the breach, a tiny shake rattle. ' +
    'Rare: once in a long while, for a Move 2 or 3 in a straight line over plain floor (no walls, belts or robots in the way). ' +
    'Port: the robot really sinks into the opaque top (depth does the hiding); the water is one small shader patch that re-samples the top\'s own light and glass textures with a ripple offset, plus a glow plane. No trail while she is under.',
};

const PI = Math.PI;
const TAU = PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (T, a, b) => clamp01((T - a) / (b - a));

/** A keyframed channel: keys [[t, value, ease], ...]; each key's ease shapes the stretch arriving at it. */
function track(keys, def) {
  return (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = def] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return v0 + (v1 - v0) * e(t1 > t0 ? (T - t0) / (t1 - t0) : 1);
    }
    return keys[keys.length - 1][1];
  };
}

export default async function play(lab) {
  const { THREE, ease: E, facing, PALETTE } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const t0 = lab.t;
  const back = (s) => (k) => E.outBack(k, s);
  const RED = '#ff4d6d';

  const C = { m2: 0.0, rr: 2.0, bk: 2.5, ut: 3.0 };
  const END = 3.56;
  const DIVE = 0.36; // she tips over
  const IN = 0.47; // her nose meets the glass
  const UP = 1.22; // she breaks the surface again
  const LAND = 1.62;

  // ----- Maya -----
  const mx = track([[DIVE, 1], [0.58, 1.55, E.in], [UP, 2.72, E.inOut], [LAND, 3, E.out]], E.inOut);
  const swim = (T) => (T > 0.58 && T < UP ? Math.sin(PI * span(T, 0.58, UP)) * Math.sin(span(T, 0.58, UP) * TAU) * 0.1 : 0);
  const mlift = track([
    [0.06, 0], [0.26, 0.14, E.out], [DIVE, 0.15], [0.6, -0.55, E.in], // breath, hold, dive
    [UP - 0.04, -0.55], [1.43, 0.46, E.out], [LAND, 0, E.in], // breach, apex, splash down
    [LAND + 0.02, 0], [LAND + 0.12, 0.05, E.out], [LAND + 0.22, 0, E.in],
  ], E.inOut);
  const mpitch = track([
    [0.06, 0], [0.26, -0.24, E.out], [DIVE, -0.26], [0.56, 1.1, E.in], // nose up for the breath, nose down to dive
    [UP - 0.04, -1.05], [1.43, -0.15, E.out], [LAND, 0.28, E.in], [LAND + 0.16, -0.06, E.out], [LAND + 0.32, 0, E.inOut],
  ], E.inOut);
  const mroll = track([[1.27, 0], [1.56, -TAU, E.inOut]], E.inOut); // the joyful barrel roll
  const shakeOff = (T) => Math.sin((T - 1.74) * TAU * 8) * 0.16 * Math.sin(PI * span(T, 1.74, 1.98));
  const msy = track([
    [0.06, 1], [0.26, 1.14, E.out], [DIVE, 1.12], [0.5, 1.22, E.in], [0.6, 1.0],
    [UP, 1.22], [1.4, 1.05, E.out], [LAND - 0.03, 1.14], [LAND + 0.04, 0.72, E.out], [LAND + 0.3, 1, (k) => E.outElastic(k)],
  ], E.inOut);
  const msx = track([
    [0.06, 1], [0.26, 1.07, E.out], [DIVE, 1.07], [0.5, 0.86, E.in], [0.6, 1.0],
    [UP, 0.86], [1.4, 1, E.out], [LAND - 0.03, 0.92], [LAND + 0.04, 1.24, E.out], [LAND + 0.3, 1, E.out],
  ], E.inOut);
  const mrot = track([
    [C.rr + 0.08, facing(1)], [C.rr + 0.36, facing(2), back(1.2)],
    [C.ut + 0.08, facing(2)], [C.ut + 0.42, facing(2) - PI, back(1.1)],
  ], E.inOut);
  const my = track([[C.bk + 0.08, 2], [C.bk + 0.42, 1, E.inOut]], E.inOut);
  // her eye: squeezed shut holding her breath, wide open on the gasp
  const eyeH = track([[0.08, 1], [0.24, 0.22, E.out], [0.6, 0.22], [UP + 0.06, 0.22], [UP + 0.14, 1.9, E.out3], [LAND + 0.3, 1.6], [LAND + 0.7, 1, E.inOut]], E.inOut);
  const eyeW = track([[0.08, 1], [0.24, 1.15, E.out], [UP + 0.06, 1.15], [UP + 0.14, 1.6, E.out3], [LAND + 0.3, 1.4], [LAND + 0.7, 1, E.inOut]], E.inOut);
  const eyeB = track([[UP + 0.06, 1], [UP + 0.12, 2.4, E.out], [LAND + 0.6, 1, E.inOut]], E.inOut);

  // ----- the glow under the glass, and the water -----
  const under = (T) => span(T, IN - 0.02, 0.62) * (1 - span(T, UP - 0.06, UP + 0.1));
  const lensK = (T) => span(T, IN - 0.04, IN + 0.16) * (1 - span(T, LAND + 0.05, LAND + 0.55));
  const lensX = track([[IN, 1.4], [UP, 2.72, E.inOut], [LAND, 2.85, E.out]], E.inOut);

  // ----- Theo: where did she go? -----
  const tF = facing(2);
  const glowX = (T) => mx(T);
  const lookAt = (x, y) => Math.atan2(-(x - 5), -(y - 0)); // rotation.y that faces (x, y) from Theo's space
  const theoLook = (T) => {
    const k = span(T, IN + 0.05, IN + 0.25) * (1 - span(T, LAND + 0.25, LAND + 0.5));
    let target = lookAt(glowX(T), 2.4);
    while (target - tF > PI) target -= TAU;
    while (target - tF < -PI) target += TAU;
    return tF + (target - tF) * E.inOut(k);
  };
  const tpitch = track([
    [IN, 0], [IN + 0.06, -0.08, E.out], [IN + 0.3, 0.28, E.inOut], [UP, 0.3], // flinch at the plip, then peers over
    [UP + 0.05, -0.28, E.out3], [UP + 0.4, -0.2], [LAND + 0.3, 0, E.inOut],
    [LAND + 0.5, 0], [LAND + 0.6, -0.12, E.out], [C.rr + 0.5, -0.12], [C.rr + 0.7, 0, E.inOut], // looks at us
  ], E.inOut);
  const tlift = track([[UP, 0], [UP + 0.08, 0.1, E.out], [UP + 0.24, 0, E.in]], E.inOut);
  const tsy = track([[IN, 1], [IN + 0.06, 0.93, E.out], [IN + 0.2, 1], [UP, 1], [UP + 0.06, 1.12, E.out], [UP + 0.3, 1, E.inOut]], E.inOut);

  // the water: a patch of the glass re-drawn from the top's own textures, refracted by ripples
  const arena = lab.arena;
  const top = arena.topMat;
  const course = arena.course;
  const uniforms = {
    uLight: { value: top.emissiveMap },
    uSize: { value: new THREE.Vector2(course.w, course.h) },
    uC: { value: new THREE.Vector2() },
    uT: { value: 0 },
    uK: { value: 0 },
    uEI: { value: 1 },
    uR: { value: 1.25 },
  };
  const vertexShader = 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const head = `
    uniform sampler2D uLight; uniform vec2 uSize; uniform vec2 uC; uniform float uT; uniform float uK; uniform float uEI; uniform float uR;
    varying vec2 vW;
    vec2 boardUV(vec2 q) { return vec2((q.x + uSize.x * 0.5) / uSize.x, (uSize.y * 0.5 - q.y) / uSize.y); }`;
  // the glass's own drawing (its grid) is taken out here...
  const lensOut = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: `${head}
      void main() {
        float k = uK * smoothstep(uR, uR * 0.25, length(vW - uC));
        gl_FragColor = vec4(texture2D(uLight, boardUV(vW)).rgb * uEI * k, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.ReverseSubtractEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  // ...and drawn back in, refracted by the ripples, with a little light caught on the wave crests
  const lensIn = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: `${head}
      void main() {
        vec2 d = vW - uC;
        float r = length(d);
        float k = uK * smoothstep(uR, uR * 0.25, r);
        vec2 n = d / max(r, 1e-3);
        float wave = sin(r * 15.0 - uT * 8.0);
        vec2 off = n * wave * 0.1 * k + vec2(sin(vW.y * 6.0 + uT * 4.0), sin(vW.x * 6.0 - uT * 3.3)) * 0.07 * k;
        vec3 col = texture2D(uLight, boardUV(vW + off)).rgb * uEI * k;
        col += vec3(1.0, 0.95, 0.88) * pow(max(0.0, wave), 3.0) * 0.06 * k * smoothstep(0.1, 0.5, r);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lensGeo = new THREE.PlaneGeometry(2.8, 2.8);
  const lens = new THREE.Group();
  for (const [mat, order] of [[lensOut, 1], [lensIn, 2]]) {
    const m = new THREE.Mesh(lensGeo, mat);
    m.rotation.x = -PI / 2;
    m.renderOrder = order;
    lens.add(m);
  }
  lens.position.y = 0.002;
  lab.add(lens);
  const glowMat = new THREE.MeshBasicMaterial({ map: maya.model.poolMat.map, color: new THREE.Color(RED).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  glow.rotation.x = -PI / 2;
  glow.position.y = 0.01;
  glow.renderOrder = 2;
  lab.add(glow);
  const coreMat = glowMat.clone();
  coreMat.color = new THREE.Color(RED).lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.6);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coreMat);
  core.rotation.x = -PI / 2;
  core.position.y = 0.011;
  core.renderOrder = 2;
  lab.add(core);
  // her eye light, seen through the glass at the front of the glow
  const eyeUMat = glowMat.clone();
  eyeUMat.color = new THREE.Color(3, 2.8, 2.5);
  const eyeU = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), eyeUMat);
  eyeU.rotation.x = -PI / 2;
  eyeU.renderOrder = 2;
  lab.add(eyeU);

  const eye = maya.model.body.children.find((o) => o.isMesh && o.material === maya.model.eyeMat);
  const eyeScale0 = eye ? eye.scale.clone() : null;
  const restore = () => eye && eyeScale0 && eye.scale.copy(eyeScale0);
  lab.cleanup(restore);

  let wentUnder = false;
  let bridged = false;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    const x = mx(T);
    const y = 2 + swim(T);
    const lift = mlift(T);
    // her trail stops where she went in and starts again where she came out
    if (lift < -0.15) wentUnder = true;
    if (wentUnder && !bridged && lift > -0.15) {
      bridged = true;
      const tr = maya.bot.trail;
      const last = tr[tr.length - 1];
      const here = lab.pos(x, y);
      if (last) tr.push({ x: last.x, z: last.z, t: -100 }, { x: here.x, z: here.z, t: -100 });
    }
    maya.set({
      x,
      y: T < C.bk ? y : my(T),
      lift,
      visible: lift > -0.5,
      rot: T < C.rr ? facing(1) : mrot(T),
      pitch: mpitch(T),
      roll: mroll(T) + shakeOff(T),
      sy: msy(T),
      sx: msx(T),
      sz: msx(T),
    });
    theo.set({ rot: theoLook(T), pitch: tpitch(T), lift: tlift(T), sy: tsy(T), sx: 2 - tsy(T), sz: 2 - tsy(T) });

    // under the glass
    const u = under(T);
    const at = lab.pos(x, y);
    const pulse = 0.85 + 0.15 * Math.sin(T * TAU * 2.6);
    glowMat.opacity = 0.9 * u * pulse;
    coreMat.opacity = 0.75 * u * pulse;
    glow.position.set(at.x, 0.01, at.z);
    core.position.set(at.x, 0.011, at.z);
    const kick = 1 + 0.08 * Math.sin(T * TAU * 2.6); // swimming strokes
    glow.scale.set(1.5 * kick, 0.9 / kick, 1);
    core.scale.set(0.62 * kick, 0.34 / kick, 1);
    eyeUMat.opacity = 0.8 * u * (0.8 + 0.2 * Math.sin(T * TAU * 5.2));
    eyeU.position.set(at.x + 0.3, 0.012, at.z);
    eyeU.scale.set(0.24, 0.16, 1);
    const lk = lensK(T);
    lens.visible = lk > 0.001;
    const lc = lab.pos(lensX(T), 2);
    lens.position.set(lc.x, 0.002, lc.z);
    uniforms.uC.value.set(lc.x, lc.z);
    uniforms.uT.value = T;
    uniforms.uK.value = lk;
    uniforms.uEI.value = top.emissiveIntensity;
  });

  maya.each = (m, t) => {
    const T = t - t0;
    if (maya.bot.card && maya.bot.card.position.y < 1) maya.bot.card.visible = false; // a new card isn't placed until the next frame
    if (T < LAND + 0.3) m.body.position.y = 0;
    const b = eyeB(T);
    m.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
    if (eye) eye.scale.set(eyeScale0.x * eyeH(T), eyeScale0.y * eyeW(T), eyeScale0.z * eyeH(T));
  };

  // splashes of light
  const splash = (x, big) => {
    const p = lab.pos(x, 2);
    lab.ring(p, '#c23a55', big ? 0.6 : 0.4, 0.02, big ? 0.6 : 0.45);
    lab.at(0.07, () => lab.ring(p, '#8f8a80', big ? 0.8 : 0.5, 0.02, big ? 0.7 : 0.5));
    p.y = 0.05;
    lab.particles(p, [RED, PALETTE.light], big ? 14 : 8, { speed: 0.8, up: big ? 1.6 : 1.1, gravity: 5, size: 0.045, dur: 0.6 });
  };
  lab.at(IN, () => splash(1.4, false));
  lab.at(UP, () => splash(2.72, true));
  lab.at(LAND + 0.02, () => lab.ring(lab.pos(3, 2), '#c23a55', 0.3, 0.02, 0.35));
  lab.at(1.8, () => {
    const p = lab.pos(3, 2);
    p.y = 0.25;
    lab.particles(p, [RED, PALETTE.light], 10, { speed: 1.4, up: 0.6, gravity: 4, size: 0.035, dur: 0.5 });
  });

  const card = (at, id, fx, d = 0.08) =>
    lab.at(at, () => {
      lab.playCard('a', [id]);
      lab.arena.emit('play', { id: 'a', cards: [id] });
      lab.at(d, fx);
    });
  card(C.m2, 'm2', () => lab.arena.emit('move', { id: 'a', n: 2, dur: 1.5 }), 0.3);
  card(C.rr, 'rr', () => lab.arena.emit('turn', { id: 'a', by: 1 }));
  card(C.bk, 'bk', () => lab.arena.emit('move', { id: 'a', n: 1, dur: 0.34 }));
  card(C.ut, 'ut', () => lab.arena.emit('turn', { id: 'a', by: 2 }));

  await lab.wait(END);
  stop();
  restore();
  maya.each = null;
  lens.visible = false;
  glowMat.opacity = 0;
  coreMat.opacity = 0;
  eyeUMat.opacity = 0;
  maya.release({ x: 3, y: 1, d: 0 });
  theo.release({ x: 5, y: 0, d: 2 });
}
