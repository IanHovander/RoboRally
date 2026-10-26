// Gear, idea 5 (singing glass), animator a: weight & physical comedy.
export const meta = {
  title: 'Singing glass',
  idea:
    "A bead of light rubs round Maya's ring like a wet finger round a wine glass, faster and faster, and the glass starts to sing: the slab around her shivers with restless grains of light hopping between half-found patterns, and Maya buzzes on it like a phone on a table. Then the tone finds its note: the grains snap onto the still lines and draw a compass, the east petal longest, and Maya, set free like a compass needle, swings round to east, overshoots, swings back and settles. The figure glows a moment and sinks back into the glass.",
  notes:
    'Weight: the vibration is physical (she trembles and hops a hair on the singing glass, the grains bounce like sand on a drum skin), and her turn is a real damped needle: slow start, fast through the middle, a big overshoot, two smaller swings, stillness. The shimmer is seeded (a different run of half-patterns each time) but the figure always settles into the same compass, with the long petal on her new heading. Sound: the wet-glass hum rises with the rubbing bead, wavers while the pattern hunts, locks into one pure tone as the compass appears, then fades. Red gears: the bead rubs anticlockwise and she swings the other way.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);

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

const FRAG = `
uniform float uT; uniform float uSettle; uniform float uInten; uniform float uR; uniform float uMix; uniform float uSink; uniform float uEastA;
uniform vec4 uA; uniform vec4 uB; uniform vec3 uColor;
varying vec2 vP;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float chladni(vec2 p, vec4 m){ vec2 q = p / uR * 3.14159; return cos(m.x * q.x + m.w) * cos(m.y * q.y) + m.z * cos(m.y * q.x) * cos(m.x * q.y + m.w); }
void main(){
  float r = length(vP);
  if (r > uR) discard;
  float rim = 1.0 - smoothstep(uR * 0.62, uR, r);
  float hole = smoothstep(0.36, 0.52, r);
  // the restless standing wave: two half-found modes, crossfading
  float f = mix(chladni(vP, uA), chladni(vP, uB), uMix);
  f += 0.18 * sin(r * 26.0 - uT * 46.0) * (1.0 - uSettle);
  float w = 0.2 + 0.25 * uSink;
  float wave = exp(-f * f / (w * w));
  // grains of light hopping on it (sand on a drum skin)
  vec2 cell = floor(vP * 34.0);
  float g = hash(cell + floor(uT * 24.0) * vec2(1.7, 9.2));
  float grain = step(0.5, g);
  float shimmer = wave * (0.25 + 0.95 * grain);
  // the figure it finds: a compass star, its long point on her new heading (uEastA)
  float lw = 0.04 + 0.12 * uSink;
  float k = uR / 1.6;
  float d = 9.0;
  float ax = 9.0;
  for (int i = 0; i < 4; i++) {
    float a = uEastA + float(i) * 1.5708;
    float L = (i == 0 ? 1.45 : 0.95) * k;
    vec2 tip = vec2(cos(a), sin(a)) * L;
    vec2 in1 = vec2(cos(a + 0.7854), sin(a + 0.7854)) * 0.62 * k;
    vec2 in2 = vec2(cos(a - 0.7854), sin(a - 0.7854)) * 0.62 * k;
    vec2 pa = vP - in1; vec2 ba = tip - in1; d = min(d, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
    pa = vP - in2; ba = tip - in2; d = min(d, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
    ba = tip; ax = min(ax, length(vP - ba * clamp(dot(vP, ba) / dot(ba, ba), 0.0, 1.0)));
  }
  float th = atan(vP.y, vP.x) - uEastA;
  float longW = pow(max(0.0, cos(th)), 8.0);
  float outline = exp(-pow(d / lw, 2.0));
  float axis = exp(-pow(ax / (lw * 0.8), 2.0)) * 0.9;
  float ringN = exp(-pow((r - 1.12 * k) / (0.025 + 0.1 * uSink), 2.0)) * 0.3;
  float g2 = 0.8 + 0.35 * step(0.45, hash(cell + vec2(3.1, 7.7)));
  float compass = max(max(outline, axis), ringN) * g2 * (1.0 + 0.5 * longW);
  float v = mix(shimmer, compass, uSettle) * rim * hole * uInten;
  gl_FragColor = vec4(uColor, v);
}`;

// a ring of light on the glass that spreads and fades (lab.ring shows its first frame at full size, so a local one)
function ringFx(lab, at, color, from, to, dur, k = 1.8) {
  const { THREE } = lab;
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at);
  m.scale.setScalar(from);
  lab.add(m);
  const t0 = lab.t;
  const stop = lab.every(() => {
    const e = Math.min(1, (lab.t - t0) / dur);
    m.scale.setScalar(from + (to - from) * (1 - (1 - e) ** 2));
    m.material.opacity = (1 - e) ** 1.5;
    if (e >= 1) {
      m.visible = false;
      stop();
    }
  });
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.bots.a;
  const after = sc.after.a;
  const gear = lab.arena.gears.get(`${A.x},${A.y}`);
  const spin = gear?.spin ?? 1;
  const rot0 = facing(A.d);
  const rot1 = rot0 - spin * (Math.PI / 2);
  const C = lab.pos(A.x, A.y);
  const warm = new THREE.Color(lab.PALETTE.light);

  // ----- the singing glass: a disc of light about three spaces across -----
  const R = 1.6;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uT: { value: 0 },
      uSettle: { value: 0 },
      uInten: { value: 0 },
      uR: { value: R },
      uMix: { value: 0 },
      uSink: { value: 0 },
      uEastA: { value: (Math.PI / 2) * (1 - after.d) }, // angle of her new heading, anticlockwise from east
      uA: { value: new THREE.Vector4(2, 3, 1, 0) },
      uB: { value: new THREE.Vector4(3, 2, -1, 0) },
      uColor: { value: warm.clone().multiplyScalar(1.7) },
    },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: FRAG,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 96), mat);
  disc.rotation.x = -Math.PI / 2; // local +y = north, +x = east
  disc.position.set(C.x, 0.013, C.z);
  disc.renderOrder = 5;
  lab.add(disc);

  // the seeded run of half-found patterns
  const modes = [];
  let mt = 0;
  while (mt < 1.2) {
    const n = 1 + Math.floor(lab.rand() * 5);
    let m = 1 + Math.floor(lab.rand() * 5);
    if (m === n) m = (m % 5) + 1;
    modes.push({ t: mt, v: new THREE.Vector4(n, m, lab.rand() < 0.5 ? 1 : -1, lab.range(0, 1.2)) });
    mt += lab.range(0.09, 0.15);
  }

  // ----- the wet finger: a bead of light rubbing round her ring -----
  const tex = glowTex(THREE);
  const beads = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: warm.clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lab.add(s);
    beads.push(s);
  }

  const maya = lab.puppet('a');
  maya.set({ trail: false });
  const model = maya.model;
  const ring0 = model.ringMat.color.clone();
  const eye0 = new THREE.Color(3.2, 3.1, 2.9);

  // ----- timing -----
  const T_HUM = 0.12; // the glass starts to shimmer
  const T_BUZZ = 0.22;
  const T_LOCK = 0.86; // the figure snaps into place, the needle is let go
  const T_FADE = 1.42;
  const T_END = 1.8;
  // the needle: a damped swing from her old heading to the new one
  const wN = Math.PI * 2 * 2.1;
  const zN = 0.36;
  const wd = wN * Math.sqrt(1 - zN * zN);
  const needle = (s) => {
    if (s <= 0) return 1;
    const e = Math.exp(-zN * wN * s);
    return e * (Math.cos(wd * s) + ((zN * wN) / wd) * Math.sin(wd * s));
  };

  const t0 = lab.t;
  const gearFrom = gear ? gear.extra : 0;
  let prevRot = rot0;
  let beadA = 0;
  let last = 0;
  let flashed = false;
  await new Promise((done) => {
    const stop = lab.every(() => {
      const t = lab.t - t0;
      const dt = Math.max(0, Math.min(0.05, t - last));
      last = t;

      // ---- the bead rubbing round her ring, speeding up ----
      const rub = seg(t, 0, T_LOCK);
      const revs = 0.9 + 3.6 * rub * rub; // turns per second
      beadA -= spin * revs * Math.PI * 2 * dt;
      const beadOn = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, T_LOCK - 0.1, T_LOCK + 0.05)));
      beads.forEach((s, i) => {
        const a = beadA + spin * i * 0.11 * (0.6 + rub);
        const rr = 0.52;
        s.position.set(C.x - Math.sin(a) * rr, 0.03, C.z - Math.cos(a) * rr);
        s.material.opacity = beadOn * (i === 0 ? 1 : 0.55 * (1 - i / beads.length));
        s.scale.setScalar(i === 0 ? 0.42 : 0.28);
      });

      // ---- the glass: shimmer, lock, glow, sink ----
      const swell = smooth(seg(t, T_HUM, T_LOCK));
      const settle = ease.out3(seg(t, T_LOCK, T_LOCK + 0.22));
      const sink = smooth(seg(t, T_FADE, T_END));
      let inten = 0.25 + 0.75 * swell;
      if (t < T_HUM) inten = 0.25 * seg(t, 0.02, T_HUM);
      if (t >= T_LOCK) inten = 1 + 0.45 * Math.exp(-(t - T_LOCK) * 7) + 0.05 * Math.sin((t - T_LOCK) * 14);
      inten *= 1 - sink;
      let i = 0;
      while (i < modes.length - 1 && modes[i + 1].t <= t) i++;
      const cur = modes[i];
      const nxt = modes[Math.min(modes.length - 1, i + 1)];
      const span = Math.max(0.01, nxt.t - cur.t);
      mat.uniforms.uA.value.copy(cur.v);
      mat.uniforms.uB.value.copy(nxt.v);
      mat.uniforms.uMix.value = ease.in3(clamp01((t - cur.t) / span));
      mat.uniforms.uT.value = t;
      mat.uniforms.uSettle.value = settle;
      mat.uniforms.uInten.value = Math.max(0, inten);
      mat.uniforms.uSink.value = sink;
      disc.scale.setScalar(1 + 0.06 * sink);
      if (t >= T_LOCK && !flashed) {
        flashed = true;
        ringFx(lab, C.clone().setY(0.02), lab.PALETTE.light, 0.55, 1.75, 0.45, 1.4);
      }

      // ---- Maya: buzzing on the singing glass, then a compass needle let go ----
      const buzz = smooth(seg(t, T_BUZZ, T_LOCK)) * (t < T_LOCK ? 1 : 0);
      const jx = (lab.rand() - 0.5) * 0.03 * buzz;
      const jz = (lab.rand() - 0.5) * 0.03 * buzz;
      const hop = lab.rand() * 0.025 * buzz;
      const jr = (lab.rand() - 0.5) * 0.07 * buzz;
      // she creeps a little the wrong way while buzzing (stick-slip), then is let go from there
      const creep = spin * 0.1 * smooth(seg(t, T_BUZZ, T_LOCK));
      const from = rot0 + creep;
      let rot = t < T_LOCK ? from + jr : rot1 + (from - rot1) * needle(t - T_LOCK);
      // ends exactly on her heading
      rot += (rot1 - rot) * smooth(seg(t, T_FADE, T_END - 0.05));
      // she leans out of the swing (her body lags the needle)
      const vel = t >= T_LOCK && dt > 0 ? (rot - prevRot) / dt : 0;
      prevRot = rot;
      const roll = Math.max(-0.22, Math.min(0.22, vel * 0.03));
      maya.set({ x: A.x + jx, y: A.y + jz, lift: hop, rot, roll, sy: 1 + (lab.rand() - 0.5) * 0.04 * buzz });
      if (gear) gear.extra = gearFrom + (rot - rot0);

      if (t >= T_END) {
        stop();
        done();
      }
    });

    maya.each = (m) => {
      const t = lab.t - t0;
      const rubK = smooth(seg(t, 0, T_LOCK)) * (1 - smooth(seg(t, T_LOCK, T_FADE)));
      m.ringMat.color.copy(ring0).lerp(warm, 0.35 * rubK).multiplyScalar(1 + 0.8 * rubK);
      m.eyeMat.color.copy(eye0).multiplyScalar(1 + 0.4 * rubK);
    };
  });

  maya.each = null;
  model.ringMat.color.copy(ring0);
  if (gear) gear.extra = gearFrom + (rot1 - rot0);
  maya.release({ x: after.x, y: after.y, d: after.d });
}
