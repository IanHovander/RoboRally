// Reboot, idea 16 through a character-acting lens: Maya comes back as a skipping stone. She is having the time
// of her life on the first skip, the second and third bite (grey), she sticks the landing anyway, strikes a
// proud pose, and then the dizziness catches up with her. Theo is the bystander: he hears her coming, ducks as
// she whooshes past, and bobs on her ripples like a rubber duck.
export const meta = {
  title: 'Skipping stone (sticks the landing)',
  idea: 'Maya skims in out of the dark past the east edge, spinning flat like a stone, and skips three times across the glass: a happy red splash, then two grey ones that make her wince (the 2 SPAM). She slides the last half space spinning down and stops dead, nose east, rocks on the stop, puffs up proudly like a gymnast who stuck it, and then goes a little dizzy. Theo hears her whistle in, ducks as she flies past his nose, and rides each ripple like a duck on a pond.',
  notes: 'Sound: a rising whistle as she comes in, three glassy "plips" (bright, then two duller, lower ones), a soft hiss for the slide and a tiny glass "tink" on the stop. The ripples bend the light drawn in the glass (a shader patch on topMat), so the seams wobble as each wave rolls by. The number of skips can follow the distance to the edge she fell from (the last two are always the grey ones), so the room learns to count them.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const RED = new THREE.Color('#ff4d6d');
  const GREY = new THREE.Color('#9aa3ae');

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // keyframes: [[t, v, ease?], ...], the ease shapes the segment that ends at that key
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
  const bump = (t, t0, rise, fall) => (t < t0 - rise || t > t0 + fall ? 0 : t < t0 ? ease.out(1 - (t0 - t) / rise) : 1 - ease.inOut((t - t0) / fall));

  // ---------- the ripples: the glass top bends its own light around each touch ----------
  const SPEED = 2.1; // world units a ripple travels per second
  const RIPS = [
    { x: 5.85, y: 1, t: 0.62, color: RED, amp: 1 },
    { x: 4.55, y: 1, t: 0.98, color: GREY, amp: 0.8 },
    { x: 3.72, y: 1, t: 1.25, color: GREY, amp: 0.62 },
  ];
  const U = {
    uRip: { value: RIPS.map(() => new THREE.Vector4(0, 0, -1, 0)) },
    uRipCol: { value: RIPS.map((r) => r.color.clone()) },
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
uniform vec4 uRip[3]; uniform vec3 uRipCol[3]; uniform vec2 uSize;
vec3 gRipLight = vec3(0.0);
vec2 lumRipple(vec2 uv) {
  vec2 w = vec2((uv.x - 0.5) * uSize.x, (0.5 - uv.y) * uSize.y);
  vec2 off = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 r = uRip[i];
    if (r.z < 0.0) continue;
    vec2 d = w - r.xy;
    float dist = length(d);
    float R = r.z * ${SPEED.toFixed(2)};
    float fade = r.w * exp(-r.z * 3.6) * smoothstep(0.9, 0.55, r.z);
    float x = dist - R;
    float env = exp(-x * x / 0.09) * smoothstep(0.0, 0.25, dist);
    float wave = sin(x * 15.0);
    off += (d / max(dist, 0.001)) * wave * env * fade * 0.07;
    // the crest of light (two or three rings, the front one brightest)
    float crest = pow(max(0.0, wave), 3.0) * exp(-x * x / 0.025) * (x > 0.0 ? 1.0 : 0.6);
    gRipLight += uRipCol[i] * crest * fade * 2.2;
  }
  return uv + vec2(off.x / uSize.x, -off.y / uSize.y);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D(emissiveMap, lumRipple(vEmissiveMapUv));
  totalEmissiveRadiance *= emissiveColor.rgb;
  totalEmissiveRadiance += gRipLight;
#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'lab-reboot-2b-ripple';
  mat.needsUpdate = true;
  lab.cleanup(() => {
    mat.onBeforeCompile = prevCompile;
    mat.customProgramCacheKey = prevKey;
    mat.needsUpdate = true;
  });
  const ripPos = RIPS.map((r) => lab.pos(r.x, r.y));
  // how high a ripple lifts the glass at a world point (for Theo's bobbing): the crest height and its slope
  const waveAt = (t, wx, wz) => {
    let h = 0;
    let slope = 0;
    RIPS.forEach((r, i) => {
      const age = t - r.t;
      if (age < 0) return;
      const dist = Math.hypot(wx - ripPos[i].x, wz - ripPos[i].z);
      const x = dist - age * SPEED;
      const env = Math.exp((-x * x) / 0.09) * r.amp * Math.exp(-age * 1.1);
      h += Math.cos(x * 5) * env;
      slope += Math.sin(x * 5) * env;
    });
    return { h, slope };
  };

  // ---------- a glint in the dark: her eye catching the light before she arrives ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: RED.clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glint.visible = false;
  lab.add(glint);
  const motes = [0, 1, 2].map(() => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#f4efe4').multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.scale.setScalar(0.11);
    m.visible = false;
    lab.add(m);
    return m;
  });

  // ---------- the actors ----------
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const TX = 5;
  const TY = 2;
  const theoRot = facing(3);
  const theoW = lab.pos(TX, TY);
  maya.set({ x: 9.5, y: 1, lift: 0.4, rot: facing(1), visible: false, trail: false });
  theo.set({ x: TX, y: TY, rot: theoRot, trail: false });
  const eye = (() => {
    let e = null;
    maya.model.body.traverse((o) => {
      if (o.isMesh && o.material === maya.model.eyeMat) e = o;
    });
    return e;
  })();
  const eyeScale0 = eye.scale.clone();
  lab.cleanup(() => eye.scale.copy(eyeScale0));

  const st = { grey: 0, squint: 0, bright: 1, theoBright: 1, theoSquint: 0, theoTag: 1 };
  maya.each = (m) => {
    const c = new THREE.Color(3.2, 3.1, 2.9).lerp(new THREE.Color(0.75, 0.78, 0.84), st.grey);
    m.eyeMat.color.copy(c).multiplyScalar(st.bright);
    eye.scale.set(eyeScale0.x * (1 - 0.75 * st.squint), eyeScale0.y, eyeScale0.z);
    m.paint.emissive.copy(RED).lerp(GREY, st.grey * 0.8);
    m.paint.emissiveIntensity = 0.16 + 0.5 * st.grey;
  };
  const theoTag = lab.bot('b').tag;
  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(st.theoBright * (1 - 0.65 * st.theoSquint));
    if (theoTag) theoTag.material.opacity = st.theoTag;
  };

  // ---------- Maya's path ----------
  const T_IN = 0.3; // she comes out of the dark
  const T1 = RIPS[0].t;
  const T2 = RIPS[1].t;
  const T3 = RIPS[2].t;
  const T_STOP = 1.62; // stops dead on the token
  const X_IN = 7.35;
  const X1 = RIPS[0].x;
  const X2 = RIPS[1].x;
  const X3 = RIPS[2].x;
  const SPIN = 11.5;
  const PR = 1.98; // the proud pose
  const D0 = 2.24; // dizzy
  const D1 = 2.74; // radians of spin left when she comes in; it winds down to exactly nose-east at the stop
  const mayaPose = (t) => {
    let x = X_IN;
    let lift = 0.42;
    let sy = 1;
    let sxz = 1;
    let pitch = 0;
    let roll = 0;
    let trail = false;
    if (t < T1) {
      // a low, flat, fast skim in, dipping to the first touch
      const k = clamp01((t - T_IN) / (T1 - T_IN));
      x = X_IN + (X1 - X_IN) * k;
      lift = 0.42 * (1 - k) ** 1.6 + 0.05 * Math.sin(k * Math.PI) * (1 - k);
      roll = 0.12 * (1 - k); // banked, like a thrown stone
    } else if (t < T2) {
      const k = (t - T1) / (T2 - T1);
      x = X1 + (X2 - X1) * k;
      lift = 0.34 * 4 * k * (1 - k);
    } else if (t < T3) {
      const k = (t - T2) / (T3 - T2);
      x = X2 + (X3 - X2) * k;
      lift = 0.17 * 4 * k * (1 - k);
    } else if (t < T_STOP) {
      // flat on the glass, sliding the last bit, hard deceleration
      const k = (t - T3) / (T_STOP - T3);
      x = X3 + (3 - X3) * ease.out3(k);
      lift = 0;
      trail = true;
    } else {
      x = 3;
      lift = 0;
      trail = true;
    }
    // touches: a squash on each, harder for the grey ones
    sy *= 1 - 0.32 * bump(t, T1, 0.03, 0.12) - 0.4 * bump(t, T2, 0.03, 0.14) - 0.45 * bump(t, T3, 0.03, 0.18);
    sxz *= 1 + 0.16 * bump(t, T1, 0.03, 0.12) + 0.2 * bump(t, T2, 0.03, 0.14) + 0.22 * bump(t, T3, 0.03, 0.18);
    // the stop: inertia rocks her back onto her tail (she's travelling west, nose east), then forward, then still
    pitch += track(t, [[T_STOP - 0.02, 0], [T_STOP + 0.07, -0.32, 'out'], [T_STOP + 0.2, 0.12, 'inOut'], [T_STOP + 0.3, -0.04, 'inOut'], [T_STOP + 0.38, 0, 'inOut']]);
    sy *= track(t, [[T_STOP - 0.02, 1], [T_STOP + 0.06, 0.86, 'out'], [T_STOP + 0.18, 1.04, 'inOut'], [T_STOP + 0.28, 1, 'inOut']]);
    // pride: she rises tall and lifts her chin, like a gymnast who stuck it, and holds it...
    const proud = track(t, [[PR, 0], [PR + 0.1, 1, 'outBack'], [PR + 0.28, 1], [D0 + 0.12, 0.25, 'inOut'], [D1, 0, 'inOut']]);
    sy *= 1 + 0.3 * proud;
    sxz *= 1 - 0.1 * proud;
    pitch -= 0.32 * proud;
    lift += 0.03 * proud;
    // ...until the spin catches up with her: a woozy circle (the pose sags), and she settles
    let wob = 0;
    if (t > D0 && t < D1) {
      const k = (t - D0) / (D1 - D0);
      const a = k * Math.PI * 2 * 1.7;
      const amp = 0.24 * Math.sin(Math.PI * Math.min(1, k * 1.5)) * (1 - k * 0.8);
      roll += Math.sin(a) * amp;
      pitch += Math.cos(a) * amp * 0.8;
      wob = amp;
    }
    sy *= 1 - 0.08 * track(t, [[D0, 0], [D0 + 0.1, 1], [D1 - 0.08, 1], [D1 + 0.06, 0]]);
    // spin: winds down to nose-east at the stop, with a small overshoot after
    let rot = facing(1);
    if (t < T_STOP) rot += SPIN * ((T_STOP - t) / (T_STOP - T_IN)) ** 2.1;
    rot += track(t, [[T_STOP, 0], [T_STOP + 0.08, -0.16, 'out'], [T_STOP + 0.22, 0.05, 'inOut'], [T_STOP + 0.32, 0, 'inOut']]);
    rot += 0.1 * Math.sin(t * 9) * wob;
    return { x, y: 1, lift, sy, sx: sxz, sz: sxz, pitch, roll, rot, trail, visible: t >= T_IN - 0.02 };
  };

  const T0 = lab.t;
  const END = 2.84;
  // the camera leans toward the east edge to catch her coming, follows her in, and leans close for the landing
  const tokW = lab.pos(3, 1);
  const camRelease = lab.camera((home, tt) => {
    const t = tt - T0;
    const east = track(t, [[0, 0], [0.3, 1, 'out'], [0.62, 1], [1.5, 0, 'inOut']]);
    const close = track(t, [[0.9, 0], [1.7, 1, 'inOut']]);
    const target = home.target.clone().add(new THREE.Vector3(0.5 * east, 0, 0)).lerp(tokW, 0.22 * close);
    return { target, dist: home.dist * (1 - 0.09 * close) };
  });
  const update = () => {
    const t = lab.t - T0;
    for (let i = 0; i < RIPS.length; i++) {
      const age = t - RIPS[i].t;
      U.uRip.value[i].set(ripPos[i].x, ripPos[i].z, age >= 0 && age < 0.95 ? age : -1, RIPS[i].amp);
    }

    // ----- Maya -----
    maya.set(mayaPose(t));
    // the eye: wide and bright on the way in, grey and squinting on each bad skip, wide on the stop
    st.grey = Math.max(track(t, [[T2, 0], [T2 + 0.02, 1, 'out'], [T2 + 0.16, 0.9], [T2 + 0.24, 0, 'in']]), track(t, [[T3, 0], [T3 + 0.02, 1, 'out'], [T3 + 0.2, 0.9], [T3 + 0.3, 0, 'in']]));
    st.squint = Math.max(bump(t, T2 + 0.03, 0.03, 0.2), bump(t, T3 + 0.03, 0.03, 0.24), 0.6 * track(t, [[D0, 0], [D0 + 0.06, 1], [D1 - 0.04, 1], [D1 + 0.06, 0]]));
    st.bright = 1 + 0.35 * bump(t, T_STOP + 0.05, 0.04, 0.3) + 0.7 * track(t, [[PR, 0], [PR + 0.08, 1, 'out'], [PR + 0.28, 1], [D0 + 0.08, 0]]);
    // dizzy: three little motes of warm light circle over her head, then fade
    motes.forEach((m, i) => {
      const k = clamp01((t - D0 + 0.04) / (D1 - D0 + 0.04));
      m.visible = k > 0 && k < 1;
      const a = k * Math.PI * 2 * 1.8 + (i * Math.PI * 2) / 3;
      m.position.copy(tokW).add(new THREE.Vector3(Math.cos(a) * 0.24, 0.66 + 0.03 * Math.sin(a * 2), Math.sin(a) * 0.17));
      m.material.opacity = Math.sin(Math.PI * k) ** 0.6;
    });
    // the glint before she arrives
    const g = track(t, [[0, 0], [0.12, 0.5, 'out'], [0.22, 0.25], [T_IN, 1, 'in']]);
    glint.visible = t < T_IN + 0.02;
    glint.position.copy(lab.pos(X_IN, 1)).setY(0.42);
    glint.scale.setScalar(0.25 + 0.35 * g);
    glint.material.opacity = g;

    // ----- Theo -----
    const wave = waveAt(t, theoW.x, theoW.z);
    // hears the whistle behind him: looks round over his right shoulder, up on his toes; then she sails past his
    // nose and his head follows her all the way to the token
    let tRot = track(t, [[0.05, 0], [0.24, -1.1, 'out'], [0.7, -1.2], [0.86, -1.45, 'inOut'], [1.05, -1.0, 'inOut'], [1.45, -0.5, 'inOut'], [2.35, -0.46], [2.75, 0, 'inOut']]);
    const duck = track(t, [[0.74, 0], [0.82, 1, 'out'], [0.93, 1], [1.12, 0, 'inOut']]);
    let tLift = 0.045 * track(t, [[0.08, 0], [0.22, 1, 'out'], [0.6, 1], [0.74, 0]]);
    let tsy = 1 + 0.06 * track(t, [[0.08, 0], [0.22, 1, 'out'], [0.6, 1], [0.74, 0]]) - 0.22 * duck;
    let tRoll = -0.22 * duck; // leans away from her (she passes on his right, the north)
    let tPitch = 0.1 * duck;
    // the ripples: he rides them up and down, rocking with the slope
    tLift += 0.09 * Math.max(-0.4, wave.h);
    tPitch += 0.22 * wave.slope;
    tRoll += 0.12 * wave.slope;
    // impressed: a little nod at her proud pose, then back to his business (facing west again)
    tPitch += 0.18 * track(t, [[2.06, 0], [2.14, 1, 'out'], [2.24, 0, 'inOut'], [2.3, 0.6, 'out'], [2.4, 0, 'inOut']]);
    st.theoSquint = duck;
    st.theoTag = 1 - 0.85 * track(t, [[0.5, 0], [0.6, 1], [1.2, 1], [1.4, 0]]); // his name ducks out of her way too
    st.theoBright = 1 + 0.3 * track(t, [[0.05, 0], [0.18, 1, 'out'], [0.6, 1], [0.74, 0]]);
    theo.set({ rot: theoRot + tRot, lift: tLift, sy: tsy, sx: 1 / Math.sqrt(tsy), sz: 1 / Math.sqrt(tsy), roll: tRoll, pitch: tPitch });
  };
  const stop = lab.every(update);
  update();
  await lab.wait(1.95);
  camRelease();
  await lab.wait(END - 1.95);
  stop();

  maya.each = null;
  theo.each = null;
  eye.scale.copy(eyeScale0);
  for (const v of U.uRip.value) v.z = -1;
  maya.set({ x: 3, y: 1, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: facing(1) });
  theo.set({ x: TX, y: TY, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: theoRot });
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: TX, y: TY, d: 3 });
}
