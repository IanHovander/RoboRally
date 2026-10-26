// Belt, idea 5 (animator b, character acting): "The Koi".
// Something long and soft made of the belt's own light glides up the stream inside the slab. Its head passes
// under Maya and she jumps and peers down: what was that? Then its back rises under her and she's lifted,
// wobbles, finds her balance, and melts into the ride: bobbing along with it, eye soft and happy. At the bend
// it flicks its tail and swings her round to face east, wheee. It slips away down the south leg, right past
// Jun, who flinches, and fades into the stream. Maya watches it go. Jun keeps staring at the belt.
export const meta = {
  title: 'The Koi',
  idea:
    'Once in a while, a long soft koi made of the belt\'s own light glides up the stream inside the glass, the chevrons parting over its back. Its head slides under Maya and she jumps and peers down; then its back lifts her, she wobbles, finds her balance and melts into the ride, bobbing along with it, eye soft and happy. At the bend it flicks its tail and swings her round to face east. It slips away down the south leg past Jun, who flinches, and fades into the stream. She watches it go; Jun is still staring at the belt as the game carries on.',
  notes:
    'Sound: under everything, a low, slow, watery glass drone while it is there (felt more than heard); a soft "bloop" when it lifts her, a quick bright swish for the tail flick, and the drone sinking away as it fades. Rare by design (say one belt ride in fifteen), so the room starts watching belts for it. Port: the koi is one additive plane drawn by a shader from a 12-point spine that follows the belt\'s path, and the express belt\'s material is swapped for one that parts its chevrons around the same spine. The rider sits about 1.0 behind the head, so its head and fins show ahead of her and its tail behind; on a corner it slides off to the corner\'s centre as the koi turns underneath.',
};

const SP = 12; // spine points

const KOI_GLSL = /* glsl */ `
  uniform vec3 uSp[${SP}];
  float koiSeg(vec2 p, vec2 a, vec2 b, out float h) {
    vec2 pa = p - a, ba = b - a;
    h = clamp(dot(pa, ba) / max(1e-5, dot(ba, ba)), 0.0, 1.0);
    return length(pa - ba * h);
  }
  // distance from p to the koi's body, divided by its width there; along: 0 at the head, 1 at the tail
  float koiDist(vec2 p, out float along) {
    float best = 1e3;
    along = 0.0;
    for (int i = 0; i < ${SP - 1}; i++) {
      float h;
      float d = koiSeg(p, uSp[i].xy, uSp[i + 1].xy, h);
      float nd = d / mix(uSp[i].z, uSp[i + 1].z, h);
      if (nd < best) { best = nd; along = (float(i) + h) / ${(SP - 1).toFixed(1)}; }
    }
    return best;
  }
`;

export default async function play(lab) {
  const { THREE, arena } = lab;
  const maya = lab.puppet('a');
  const jun = lab.puppet('b');
  const M = rig(lab, maya, 'x');
  const J = rig(lab, jun, 'y');
  const junRot = jun.pose.rot;
  const BLUE = new THREE.Color('#7aa8ff');

  // ----- the path it swims: the belt's centre line, round the drawn bend (radius 0.5 about (2.5, 1.5)) -----
  const ARC0 = 2.5;
  const ARC1 = ARC0 + Math.PI / 4;
  const pathAt = (L) => {
    if (L <= ARC0) return { x: L, y: 1, tx: 1, ty: 0 };
    if (L <= ARC1) {
      const f = (L - ARC0) / 0.5;
      return { x: 2.5 + 0.5 * Math.sin(f), y: 1.5 - 0.5 * Math.cos(f), tx: Math.cos(f), ty: Math.sin(f) };
    }
    return { x: 3, y: 1.5 + (L - ARC1), tx: 0, ty: 1 };
  };
  const WIDTH = [0.26, 0.34, 0.4, 0.42, 0.41, 0.38, 0.33, 0.27, 0.21, 0.16, 0.12, 0.09];
  const STEP = 0.18;

  // ----- the koi: one additive plane, drawn from its spine -----
  const sp = Array.from({ length: SP }, () => new THREE.Vector3());
  const fins = Array.from({ length: 8 }, () => new THREE.Vector2());
  const koiMat = new THREE.ShaderMaterial({
    uniforms: {
      uSp: { value: sp },
      uFin: { value: fins },
      uColor: { value: new THREE.Vector3(BLUE.r, BLUE.g, BLUE.b) },
      uAlpha: { value: 0 },
      uTime: { value: 0 },
      uEye: { value: 0 },
      uEyeL: { value: new THREE.Vector2() },
      uEyeR: { value: new THREE.Vector2() },
      uFadeX: { value: 0 },
      uEdgeZ: { value: 0 },
      uRise: { value: 0 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${KOI_GLSL}
      uniform vec2 uFin[8];
      uniform vec3 uColor; uniform float uAlpha, uTime, uEye, uFadeX, uEdgeZ, uRise; uniform vec2 uEyeL, uEyeR;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz;
        float along;
        float nd = koiDist(p, along);
        // deep in the slab it is wide and blurred; near the top it sharpens and brightens
        float body = exp(-mix(1.1, 2.4, uRise) * nd * nd);
        float core = exp(-mix(4.0, 9.0, uRise) * nd * nd) * (1.0 - 0.7 * along);
        float scales = 0.82 + 0.18 * sin(along * 40.0 - uTime * 6.0);
        // fins: a tail fan and two little side fins
        float fin = 0.0;
        for (int i = 0; i < 8; i += 2) {
          float h;
          float d = koiSeg(p, uFin[i], uFin[i + 1], h);
          float w = i >= 4 ? 0.06 : 0.1;
          fin += exp(-2.5 * (d / w) * (d / w)) * (i >= 4 ? 0.5 : 0.75) * (1.0 - 0.5 * h);
        }
        float eye = (exp(-pow(length(p - uEyeL) / 0.036, 2.0)) + exp(-pow(length(p - uEyeR) / 0.036, 2.0))) * uEye;
        float mask = smoothstep(uFadeX - 0.2, uFadeX + 0.45, p.x) * (1.0 - smoothstep(uEdgeZ - 0.9, uEdgeZ, p.y));
        float lit = 0.55 + 0.45 * uRise;
        vec3 col = (uColor * (body * 1.35 * scales + fin * 1.4) + mix(uColor, vec3(1.0), 0.45) * core * 1.1) * lit * mask;
        col += vec3(1.0, 0.98, 0.92) * eye * 4.0 * mask;
        gl_FragColor = vec4(col * uAlpha, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const area = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), koiMat);
  area.rotation.x = -Math.PI / 2;
  area.position.copy(lab.pos(2, 2)).setY(0.003);
  area.renderOrder = 0.5;
  lab.add(area);
  koiMat.uniforms.uFadeX.value = lab.pos(-0.3, 1).x;
  koiMat.uniforms.uEdgeZ.value = lab.pos(3, 3.45).z;

  // ----- the express belt parts its chevrons over the koi's back (same texture, same scroll) -----
  const belt = arena.belts.find((b) => b.fast);
  const beltMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: belt.tex }, uOff: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uPart: { value: 0 }, uSp: { value: sp } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${KOI_GLSL}
      uniform sampler2D uMap; uniform float uOff, uPart; uniform vec3 uTint;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        float along;
        float nd = koiDist(vW.xz, along);
        float infl = exp(-1.4 * nd * nd) * uPart;
        float du = vUv.x - 0.5;
        float ad = abs(du);
        float shift = 0.13 * infl;
        float u = vUv.x;
        float keep = 1.0;
        if (ad < 0.36) {
          float d2 = (ad - shift) * 0.36 / (0.36 - shift);
          keep = smoothstep(-0.02, 0.01, d2);
          u = 0.5 + sign(du) * max(d2, 0.0);
        }
        vec4 c = texture2D(uMap, vec2(u, vUv.y + uOff));
        gl_FragColor = vec4(c.rgb * uTint * (1.0 - 0.25 * infl), c.a * keep);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const plates = [];
  arena.board.traverse((o) => o.isMesh && o.material === belt.mat && plates.push(o));
  plates.forEach((o) => (o.material = beltMat));
  lab.cleanup(() => plates.forEach((o) => (o.material = belt.mat)));

  // ----- its swim (moment clock, seconds) -----
  const head = track([[0, -0.5], [0.4, 1.0, 'linear'], [0.68, 2.0, 'linear'], [1.38, 3.6, 'linear'], [1.65, 4.3, 'linear'], [2.3, 6.7, 'in']]);
  const alpha = track([[0, 0], [0.25, 1, 'out'], [1.85, 1], [2.3, 0, 'out']]);
  const rise = track([[0, 0], [0.7, 1, 'inOut']]);
  const flick = track([[0, 0], [1.4, 0], [1.5, -1, 'out'], [1.62, 0.7, 'inOut'], [1.78, 0, 'inOut']]);
  const part = track([[0, 0], [0.45, 1], [1.95, 1], [2.3, 0]]);
  const eyeGlint = track([[0, 0.45], [1.66, 0.45], [1.76, 1.2, 'out'], [2.0, 0.5]]);

  // Maya: a jump, a peer, lifted, wobble, bliss; swung round at the bend; watches it go
  const mx = track([[0, 1], [0.68, 1], [1.38, 2.6, 'linear'], [1.62, 3, 'out']]);
  const lift = track([[0, 0], [0.4, 0], [0.46, 0.05, 'out'], [0.56, 0, 'in'], [0.64, 0], [0.76, 0.095, 'out'], [1.42, 0.095], [1.6, 0.11, 'out'], [1.92, 0, 'inOut']]);
  const bobAmp = track([[0, 0], [0.76, 0], [0.92, 1], [1.42, 1], [1.6, 0]]);
  const rot = track([[0, 0], [1.42, 0], [1.6, -Math.PI / 2 - 0.42, 'out'], [1.78, -Math.PI / 2 + 0.08, 'inOut'], [1.9, -Math.PI / 2, 'inOut']]);
  const lean = track([[0, 0], [0.4, 0], [0.47, -0.12, 'out'], [0.56, 0.32, 'inOut'], [0.68, 0.3], [0.76, -0.08, 'out'], [0.92, 0.04], [1.38, 0.04], [1.62, -0.06], [1.85, 0], [1.98, 0.14, 'inOut'], [2.2, 0.12], [2.38, 0]]);
  const roll = track([[0, 0], [0.7, 0], [0.76, 0.17, 'out'], [0.83, -0.15], [0.9, 0.09], [0.97, -0.03], [1.03, 0]]);
  const yaw = track([[0, 0], [1.88, 0], [2.02, -0.85, 'inOut'], [2.22, -0.85], [2.38, 0, 'inOut']]);
  const sy = track([[0, 1], [0.4, 1], [0.43, 1.16, 'out'], [0.56, 0.9, 'in'], [0.62, 1.0], [0.72, 0.88, 'out'], [0.8, 1.08], [0.9, 1.0], [1.4, 1.0], [1.48, 1.12, 'out'], [1.7, 1.03], [1.88, 0.94, 'inOut'], [2.0, 1.0], [2.38, 1.0]]);
  const open = track([[0, 1], [0.4, 1], [0.43, 2.4, 'out'], [0.66, 1.8], [0.74, 2.5, 'out'], [0.92, 1.4], [1.08, 0.45, 'inOut'], [1.42, 0.45], [1.48, 1.9, 'out'], [1.75, 1.6], [2.0, 1.2], [2.22, 0.7, 'inOut'], [2.38, 0.85]]);
  const glow = track([[0, 1], [0.4, 1], [0.43, 1.6, 'out'], [0.74, 1.4], [1.08, 1.1], [1.48, 1.7, 'out'], [1.9, 1.3], [2.22, 0.85], [2.38, 0.95]]);
  const warm = track([[0, 0], [0.92, 0], [1.08, 1], [1.45, 1], [1.6, 0.3], [2.0, 0.8], [2.38, 0.5]]);

  // Jun: glances at her jump; the koi slides right past him: he flinches, then stares at the belt
  const jYaw = track([[0, 0], [0.42, 0], [0.52, -0.26, 'out'], [1.4, -0.2], [1.62, 0.06], [2.38, 0.04]]);
  const jLean = track([[0, 0], [1.7, 0], [1.77, -0.24, 'out'], [1.95, -0.1], [2.2, 0.26, 'inOut'], [2.38, 0.28]]);
  const jOpen = track([[0, 1], [0.42, 1], [0.5, 1.4, 'out'], [0.9, 1.1], [1.7, 1.1], [1.76, 2.3, 'out'], [2.1, 1.7], [2.38, 1.5]]);
  const jSy = track([[0, 1], [1.7, 1], [1.76, 1.12, 'out'], [1.94, 1.0]]);
  const jHop = track([[0, 0], [1.7, 0], [1.76, 0.035, 'out'], [1.86, 0, 'in']]);

  const END = 2.38;
  const t0 = lab.t;
  const P = new THREE.Vector3();
  const apply = (t) => {
    // the spine: along the path, with a swimming wave that grows toward the tail, and the flick
    const L0 = head(t);
    const wave = 0.05 + 0.03 * Math.min(1, t / 0.4);
    for (let i = 0; i < SP; i++) {
      const L = L0 - i * STEP;
      const q = pathAt(L);
      const f = i / (SP - 1);
      const side = wave * Math.sin(i * 0.95 - t * 9.0) * (0.2 + 0.8 * f) + flick(t) * 0.42 * f * f;
      P.copy(lab.pos(q.x - q.ty * side, q.y + q.tx * side));
      sp[i].set(P.x, P.z, WIDTH[i]);
    }
    // fins: the tail fan (swinging with the flick) and two small fins behind the head
    const tail = sp[SP - 1];
    const pre = sp[SP - 2];
    const bx = tail.x - pre.x;
    const bz = tail.y - pre.y;
    const bl = Math.hypot(bx, bz) || 1;
    const ang = Math.atan2(bz, bx) + flick(t) * 0.5;
    for (const [j, s] of [[0, 1], [2, -1]]) {
      fins[j].set(tail.x, tail.y);
      fins[j + 1].set(tail.x + Math.cos(ang + s * 0.6) * 0.38, tail.y + Math.sin(ang + s * 0.6) * 0.38);
    }
    const h0 = sp[1];
    const h1 = sp[2];
    const nx = -(h1.y - h0.y);
    const nz = h1.x - h0.x;
    const nl = Math.hypot(nx, nz) || 1;
    const fin = 0.2 + 0.04 * Math.sin(t * 11);
    for (const [j, s] of [[4, 1], [6, -1]]) {
      fins[j].set(h1.x + ((s * nx) / nl) * 0.16, h1.y + ((s * nz) / nl) * 0.16);
      fins[j + 1].set(h1.x + ((s * nx) / nl) * (0.16 + fin) + (h1.x - h0.x) * 0.7, h1.y + ((s * nz) / nl) * (0.16 + fin) + (h1.y - h0.y) * 0.7);
    }
    void bl;
    // its eyes, either side of the head
    const e0 = sp[0];
    koiMat.uniforms.uEyeL.value.set(e0.x + ((h1.x - e0.x) * 0.2) + (nx / nl) * 0.1, e0.y + (h1.y - e0.y) * 0.2 + (nz / nl) * 0.1);
    koiMat.uniforms.uEyeR.value.set(e0.x + ((h1.x - e0.x) * 0.2) - (nx / nl) * 0.1, e0.y + (h1.y - e0.y) * 0.2 - (nz / nl) * 0.1);
    koiMat.uniforms.uEye.value = eyeGlint(t);
    koiMat.uniforms.uAlpha.value = alpha(t);
    koiMat.uniforms.uRise.value = rise(t);
    koiMat.uniforms.uTime.value = t;
    beltMat.uniforms.uOff.value = belt.tex.offset.y;
    beltMat.uniforms.uTint.value.copy(belt.mat.color);
    beltMat.uniforms.uPart.value = part(t);

    // Maya rides it
    const bob = Math.sin((t - 0.76) * 7.5) * 0.02 * bobAmp(t);
    maya.set({ x: mx(t), y: 1, lift: lift(t) + bob, rot: rot(t) });
    Object.assign(M, {
      yaw: yaw(t), lean: lean(t), roll: roll(t) + Math.sin((t - 0.76) * 7.5 - 0.8) * 0.05 * bobAmp(t), sy: sy(t) - bob * 1.5, open: open(t), glow: glow(t), warm: warm(t),
    });
    M.sx = M.sz = 1 / Math.sqrt(M.sy);
    jun.set({ rot: junRot });
    Object.assign(J, { yaw: jYaw(t), lean: jLean(t), open: jOpen(t), glow: 0.85 + 0.25 * jOpen(t), sy: jSy(t), hop: jHop(t) });
    J.sx = J.sz = 1 / Math.sqrt(J.sy);
  };
  const stop = lab.every(() => apply(Math.min(END, lab.t - t0)));
  await lab.wait(END);
  apply(END);
  stop();
  area.visible = false;
  plates.forEach((o) => (o.material = belt.mat));
  maya.release({ x: 3, y: 1, d: 1 });
  jun.release({ x: 5, y: 2, d: 3 });
  M.reset();

  // the game carries on; Jun is still staring at the belt where it vanished... then shakes it off
  const tail = lab.t;
  const jl = track([[0, 0.28], [0.6, 0.28], [0.85, 0, 'inOut']]);
  const jr = track([[0, 0], [0.6, 0], [0.68, 0.08], [0.76, -0.08], [0.84, 0.04], [0.9, 0]]);
  const stopTail = lab.every(() => {
    const t = lab.t - tail;
    Object.assign(J, { yaw: 0.04 * (1 - Math.min(1, t / 0.85)), lean: jl(t), roll: jr(t), sy: 1, sx: 1, sz: 1, hop: 0, open: 1.5 - 0.5 * Math.min(1, t / 0.9), glow: 1.1 });
    J.applyTo(lab.bot('b').model);
    if (t > 0.92) {
      J.reset();
      stopTail();
    }
  });
}

// ---------- helpers (self-contained) ----------

const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) ** 2,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out3: (k) => 1 - (1 - k) ** 3,
};

/** A keyframe track: [[t, value], [t, value, ease], ...] → f(t). The ease shapes the segment arriving at a key. */
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = 'inOut'] = keys[i];
      if (t <= t1) {
        const [ta, va] = keys[i - 1];
        const k = t1 > ta ? (t - ta) / (t1 - ta) : 1;
        return va + (v1 - va) * EASE[e](k);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/**
 * Body language for a puppet, on the body only (the ring and pointer stay put, so they still say where it
 * faces): yaw (a glance, right is -), lean (forward +), roll (right +), squash/stretch, hop, the eye's
 * opening, glow and warmth. `openAxis` is the eye mesh's local axis that opens it ('x' for the Pebble's eye,
 * which lies on its side; 'y' for the Cube's visor).
 */
function rig(lab, p, openAxis) {
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push(o));
  const eyeBase = eyes.map((e) => e.scale.clone());
  const st = {
    yaw: 0, lean: 0, roll: 0, sx: 1, sy: 1, sz: 1, hop: 0, open: 1, glow: 1, warm: 0,
    applyTo(model) {
      model.body.rotation.order = 'YXZ';
      model.body.rotation.set(-st.lean, st.yaw, -st.roll);
      model.body.scale.set(st.sx, st.sy, st.sz);
      model.body.position.set(0, st.hop, 0);
      eyes.forEach((e, i) => {
        e.scale.copy(eyeBase[i]);
        e.scale[openAxis] = eyeBase[i][openAxis] * Math.max(0.05, st.open);
      });
      const g = st.glow;
      model.eyeMat.color.setRGB(3.2 * g * (1 + 0.12 * st.warm), 3.1 * g * (1 - 0.12 * st.warm), 2.9 * g * (1 - 0.45 * st.warm));
    },
    reset() {
      m.body.rotation.set(0, 0, 0);
      m.body.rotation.order = 'XYZ';
      m.body.scale.set(1, 1, 1);
      m.body.position.set(0, 0, 0);
      eyes.forEach((e, i) => e.scale.copy(eyeBase[i]));
    },
  };
  p.each = (model) => st.applyTo(model);
  lab.cleanup(() => st.reset());
  return st;
}
