// Reboot, idea 16 "Skipping stone", animator a (weight & physical comedy).
// Maya is flung back in from the dark past the east edge, tail first, still looking back at where she fell.
// She skips three times on the glass like a stone on a lake: each touch squashes her, kicks her into a smaller,
// slower hop and sends a ripple across the glass that really bends the light drawn in it (a refraction in the
// glass top's shader) and bobs Theo like a moored boat. One red ripple, then two grey ones: the count is the damage.
// After the third touch she drops flat, slides the last half space with her trail and stops dead on the token.
export const meta = {
  title: 'Skipping stone',
  idea: 'Maya comes back flung in from the dark past the east edge, tail first, and skips across the glass like a stone: three touches, each hop lower and slower, each touch a ripple that bends the light in the glass and bobs Theo like a moored boat. The first ripple is red, the next two grey (her 2 SPAM), so counting the skips counts the damage. Then she drops flat, slides the last half space and stops dead on the token, nose east, with a little backward rock of inertia.',
  notes: 'Sound: three wet glass "tik" taps, each lower and softer, the last two dull (grey); a hiss of the slide; a soft clunk at the stop. Port: the number of skips can follow the distance to the edge she fell off (always ending on the token); the ripple is a uv offset in the glass top\'s map and emissiveMap plus thin rings. Theo only bobs and tilts on his space.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const RED = lab.bot('a').color;
  const GREY = '#b4bac4';
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const WEST = facing(3);

  // ---------- ripples: a wave in the glass that bends the light painted into it ----------
  const SPEED = 2.3; // world units / s
  const WIDTH = 0.2;
  const DECAY = 1.35;
  const rips = [0, 1, 2].map(() => new THREE.Vector4(0, 0, -99, 0));
  const uRipT = { value: 0 };
  const top = arena.topMat;
  const prevCompile = top.onBeforeCompile;
  const prevKey = top.customProgramCacheKey;
  top.onBeforeCompile = (sh) => {
    sh.uniforms.uRip = { value: rips };
    sh.uniforms.uRipT = uRipT;
    const head = `uniform vec4 uRip[3];
uniform float uRipT;
vec2 ripOff(vec2 uv) {
  vec2 p = vec2((uv.x - 0.5) * ${W.toFixed(1)}, (0.5 - uv.y) * ${H.toFixed(1)});
  vec2 off = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    float age = uRipT - uRip[i].z;
    if (age <= 0.0 || uRip[i].w <= 0.0) continue;
    vec2 d = p - uRip[i].xy;
    float r = length(d) + 1e-4;
    float x = (r - age * ${SPEED.toFixed(2)}) / ${WIDTH.toFixed(2)};
    float w = x * exp(-x * x) * 2.33 + 0.5 * (x + 1.6) * exp(-(x + 1.6) * (x + 1.6)) * 2.33;
    off += d / r * w * uRip[i].w * exp(-age * ${DECAY.toFixed(2)});
  }
  return vec2(off.x / ${W.toFixed(1)}, -off.y / ${H.toFixed(1)});
}
void main() {`;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', head)
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv + ripOff( vMapUv ) )'))
      .replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'texture2D( emissiveMap, vEmissiveMapUv + ripOff( vEmissiveMapUv ) )'));
  };
  top.customProgramCacheKey = () => 'lab-reboot-2a-ripple';
  top.needsUpdate = true;
  lab.cleanup(() => {
    top.onBeforeCompile = prevCompile;
    top.customProgramCacheKey = prevKey;
    top.needsUpdate = true;
  });

  // the same wave, sampled in JS, for what floats on it (Theo)
  const waveAt = (wx, wz, t) => {
    let lift = 0;
    let tx = 0;
    let tz = 0;
    for (const r of rips) {
      const age = t - r.z;
      if (age <= 0 || r.w <= 0) continue;
      const dx = wx - r.x;
      const dz = wz - r.y;
      const d = Math.hypot(dx, dz) + 1e-4;
      const x = (d - age * SPEED) / 0.34;
      const env = Math.exp(-age * DECAY) * (r.w / 0.07);
      const h = Math.exp(-x * x) * env; // crest height
      const s = -2 * x * Math.exp(-x * x) * env; // slope along the wave's travel
      lift += h;
      tx += (dx / d) * s;
      tz += (dz / d) * s;
    }
    return { lift, tx, tz };
  };

  // rings of light riding the wave crests, drawn on a sheet the size of the glass (so they stop at its edge)
  const ripCol = [0, 1, 2].map(() => new THREE.Vector3());
  const uRingT = { value: 0 };
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uRip: { value: rips }, uCol: { value: ripCol }, uT: uRingT },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec4 uRip[3]; uniform vec3 uCol[3]; uniform float uT; varying vec2 vUv;
void main() {
  vec2 p = vec2((vUv.x - 0.5) * ${W.toFixed(1)}, (0.5 - vUv.y) * ${H.toFixed(1)});
  vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float age = uT - uRip[i].z;
    if (age <= 0.0 || uRip[i].w <= 0.0) continue;
    float r = length(p - uRip[i].xy);
    float R = 0.1 + age * ${SPEED.toFixed(2)};
    float a = (r - R) / 0.03;
    float b = (r - (R - 0.2)) / 0.026;
    float ring = exp(-a * a) + 0.45 * exp(-b * b);
    float fade = exp(-age * 2.9) * min(1.0, age * 14.0) * (uRip[i].w / 0.07);
    c += uCol[i] * ring * fade;
  }
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, H), ringMat);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 0.012;
  sheet.renderOrder = 4;
  lab.add(sheet);
  const ripple = (sx, color, amp, k) => {
    const at = lab.pos(sx, 1);
    rips[k].set(at.x, at.z, lab.t, amp);
    const c = new THREE.Color(color).multiplyScalar(1.9);
    ripCol[k].set(c.r, c.g, c.b);
  };
  const stopRings = lab.every((dt, t) => {
    uRipT.value = t;
    uRingT.value = t;
  });

  // ---------- Theo floats on the glass while the waves pass ----------
  const T_HOME = lab.pos(5, 2);
  theo.set({ x: 5, y: 2, rot: WEST });
  let theoGlance = 0;
  const stopTheo = lab.every((dt, t) => {
    const w = waveAt(T_HOME.x, T_HOME.z, t);
    // leaning toward -x is his forward (pitch +), toward -z his right (roll +)
    theo.set({ lift: 0.05 * Math.max(0, w.lift), pitch: 0.16 * w.tx, roll: 0.16 * w.tz, rot: WEST + theoGlance });
  });

  // ---------- Maya's flight ----------
  const X0 = 8.9; // out in the dark past the east edge (6.5)
  const X1 = 5.8; // touch 1 (red): far enough in that its whole ripple shows
  const X2 = 4.45; // touch 2 (grey)
  const X3 = 3.55; // touch 3 (grey)
  const XE = 3.0; // the token
  let eyeK = 1;
  let greyK = 0;
  let glow = 1.4;
  let hideTag = true;
  maya.set({ x: X0, y: 1, lift: 0.36, rot: EAST, visible: true, trail: false, pitch: 0.1 });
  const tagBase = maya.bot.tag ? maya.bot.tag.scale.clone() : null;
  const greyCol = new THREE.Color(GREY);
  const redCol = new THREE.Color(RED);
  maya.each = (m) => {
    const q = maya.pose;
    const e = eyeK;
    const c = new THREE.Color(3.2, 3.1, 2.9).lerp(new THREE.Color(0.9, 0.95, 1.0), greyK).multiplyScalar(e);
    m.eyeMat.color.copy(c);
    m.paint.emissive.copy(redCol).lerp(greyCol, greyK);
    m.paint.emissiveIntensity = 0.16 * glow + greyK * 0.5;
    const ground = Math.max(0, 1 - q.lift / 0.35); // the ring and pool live on the glass: they fade with height
    m.ringMat.opacity = 0.9 * ground;
    m.poolMat.opacity = 0.75 * (0.35 + 0.65 * ground);
    if (maya.bot.tag) {
      maya.bot.tag.visible = !hideTag;
      if (tagBase) maya.bot.tag.scale.set(tagBase.x / q.sx, tagBase.y / q.sy, 1);
    }
  };

  // a touch: squash, a rebound wobble, a ripple; grey touches dim her eye for a blink
  let wob = null;
  const touch = (x, color, amp, k, grey) => {
    ripple(x, color, amp, k);
    wob = { t0: lab.t, k: grey ? 1 : 0.8 };
    if (grey) {
      lab.tween(0.32, (e, kk) => {
        const b = Math.sin(Math.min(1, kk * 1.6) * Math.PI);
        greyK = b;
        eyeK = 1 - 0.85 * b;
      }, ease.linear);
    }
  };
  const wobble = (t) => {
    if (!wob) return { sy: 1, roll: 0 };
    const a = t - wob.t0;
    const sq = Math.exp(-a * 16) * Math.cos(a * 34); // spring: squash then a ring of wobbles
    return { sy: 1 - 0.3 * wob.k * sq, roll: 0.22 * wob.k * Math.exp(-a * 7) * Math.sin(a * 26) };
  };

  // in from the dark: low, fast, a shallow glide down to the first touch
  await lab.tween(0.4, (e, k) => {
    const lift = 0.36 * (1 - k * k);
    maya.set({ x: X0 + (X1 - X0) * k, lift, pitch: 0.1 + 0.08 * k, sx: 1, sy: 1.06, sz: 1 });
  }, ease.linear);
  touch(X1, RED, 0.075, 0, false);

  // hop 1: long and high
  const hop = (dur, xa, xb, h, spin) => lab.tween(dur, (e, k) => {
    const t = lab.t;
    const w = wobble(t);
    const lift = 4 * h * k * (1 - k);
    const vy = 1 - 2 * k; // up, then down
    const stretch = 1 + 0.08 * Math.abs(vy) * (k > 0.08 ? 1 : 0);
    const sy = k < 0.12 ? w.sy : stretch;
    maya.set({ x: xa + (xb - xa) * k, lift, sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy), roll: w.roll, pitch: 0.14 * vy + 0.05, rot: EAST + spin * Math.sin(k * Math.PI) });
  }, ease.linear);
  await hop(0.42, X1, X2, 0.3, 0.12);
  touch(X2, GREY, 0.06, 1, true);
  await hop(0.33, X2, X3, 0.17, -0.08);
  touch(X3, GREY, 0.05, 2, true);

  // the last touch: she drops flat and slides the last half space with her trail, then stops dead
  maya.set({ trail: true });
  hideTag = false;
  await lab.tween(0.42, (e, k) => {
    const t = lab.t;
    const w = wobble(t);
    maya.set({ x: X3 + (XE - X3) * e, lift: 0, sy: w.sy, sx: 1 / Math.sqrt(w.sy), sz: 1 / Math.sqrt(w.sy), roll: w.roll * (1 - k), pitch: 0.04 * (1 - k), rot: EAST });
  }, (k) => 1 - (1 - k) ** 2.2);
  // stopped dead; a beat later inertia rocks her back onto her tail (she was travelling west, tail first)
  const tStop = lab.t;
  await lab.tween(0.42, (e, k) => {
    const a = lab.t - tStop;
    const rock = -0.16 * Math.exp(-a * 7) * Math.sin(a * 17);
    maya.set({ x: XE, lift: 0, pitch: rock, roll: 0, sx: 1, sy: 1, sz: 1 });
    glow = 1.4 - 0.4 * k;
  }, ease.linear);
  // a slow blink: "made it"
  await lab.tween(0.2, (e, k) => {
    eyeK = 1 - 0.9 * Math.sin(k * Math.PI);
  }, ease.linear);
  eyeK = 1;
  glow = 1;

  // let the last ripples run out; Theo settles
  await lab.wait(0.05);
  stopTheo();
  stopRings();
  theo.set({ lift: 0, pitch: 0, roll: 0, rot: WEST });
  for (const r of rips) r.w = 0;
  sheet.visible = false;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
  void TAU;
}
