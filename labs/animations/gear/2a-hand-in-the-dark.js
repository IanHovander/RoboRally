// Gear, idea 2 (a hand in the dark), animator a: weight & physical comedy.
export const meta = {
  title: 'A hand in the dark',
  idea:
    "A shadow of missing light slides onto the glass from the nearest edge, huge and soft because the hand making it is far above the TV. Maya looks up. The shadow shrinks and sharpens into a hand as it comes down, the grid and her glow going out under it; finger and thumb snap shut on her and squeeze her thin, lift her a hair off the glass so she dangles, give her a heavy quarter twist (she swings a beat behind it), and plonk her down. The fingers spring open, the hand rises and slides away, the light comes back, and Maya shakes herself off like a dog.",
  notes:
    'Weight: the giant is slow and deliberate, Maya is light and floppy: she squashes in the pinch, her feet leave the glass, her body lags behind the twist and swings past it, the set-down is a thunk with a squash, and the un-pinch jiggles her back into shape. The shadow is drawn as missing light, only on the glass, and grows soft and pale as the hand rises (a real penumbra). Sound: a low glassy hum as the dark comes in, a soft rubbery squeak on the pinch, a heavy "tok" on the set-down, the light returning as a shimmer. Red gears: the twist goes the other way. Comes from whichever board edge is nearest.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);

// the hand, from above, reaching in from the top of the canvas; the pinch point is at (256, PY)
const CW = 512;
const PY = 330;
function drawHand(g, gap, blur) {
  g.clearRect(0, 0, CW, CW);
  g.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : 'none';
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const limb = (pts, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else g.lineTo(pts[1][0], pts[1][1]);
    g.stroke();
  };
  // forearm and palm
  limb([[236, -80], [246, 140]], 128);
  g.beginPath();
  g.ellipse(258, 178, 98, 84, 0.08, 0, Math.PI * 2);
  g.fill();
  // curled fingers: a row of knuckles behind the index
  for (const [x, y, r] of [[346, 236, 31], [372, 206, 28], [380, 172, 24]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // thumb (west) and index finger (east) closing round the pinch point
  limb([[188, 196], [150 - gap * 0.25, 276], [256 - gap, PY - 8]], 46);
  limb([[312, 232], [336 + gap * 0.2, 300], [256 + gap, PY + 6]], 40);
  g.filter = 'none';
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
  const cols = sc.grid[0].trim().split(/\s+/).length;
  const rows = sc.grid.length;
  const lo = lab.pos(-0.5, -0.5);
  const hi = lab.pos(cols - 0.5, rows - 0.5);

  // the nearest board edge: the hand comes in (and leaves) that way
  const edges = [
    { d: 0, dist: A.y + 0.5 },
    { d: 1, dist: cols - 0.5 - A.x },
    { d: 2, dist: rows - 0.5 - A.y },
    { d: 3, dist: A.x + 0.5 },
  ].sort((p, q) => p.dist - q.dist);
  const edge = edges[0];
  const yaw0 = facing(edge.d);
  const out = new THREE.Vector3(-Math.sin(yaw0), 0, -Math.cos(yaw0)); // toward the edge

  // ----- the shadow: a canvas hand, black, drawn only on the glass -----
  const cv = document.createElement('canvas');
  cv.width = cv.height = CW;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const S = 4.4; // world size of the canvas when the hand is down on her
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: tex }, opacity: { value: 0 }, bounds: { value: new THREE.Vector4(lo.x, lo.z, hi.x, hi.z) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:
      'uniform sampler2D map; uniform float opacity; uniform vec4 bounds; varying vec2 vUv; varying vec3 vW; void main(){ if (vW.x < bounds.x || vW.x > bounds.z || vW.z < bounds.y || vW.z > bounds.w) discard; float a = texture2D(map, vUv).a * opacity; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }',
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, 0, -((PY - CW / 2) / CW) * S); // so the pinch point is the hand's origin
  plane.renderOrder = 6;
  const hand = new THREE.Group();
  hand.add(plane);
  lab.add(hand);

  const maya = lab.puppet('a');
  maya.set({ trail: false });
  const model = maya.model;
  const paint0 = model.paint.color.clone();
  const emis0 = model.paint.emissiveIntensity;
  const ring0 = model.ringMat.color.clone();
  const pool0 = model.poolMat.opacity;
  const eye0 = new THREE.Color(3.2, 3.1, 2.9);

  // ----- timing -----
  const T_IN = 0.5; // slid in, still a little soft
  const T_GRAB = 0.62; // down and pinched
  const T_LIFT = 0.72;
  const T_TW0 = 0.74; // twist (with a tiny wind-up first)
  const T_TW1 = 1.06;
  const T_DOWN = 1.14; // set down
  const T_OPEN = 1.22; // fingers spring open
  const T_GONE = 1.6; // risen and slid off the edge
  const T_END = 1.66;
  const far = edge.dist + 2.2; // where the shadow starts, beyond the edge

  // the twist angle (0..1 of a quarter, with a wind-up and a heavy overshoot)
  const twistK = (t) => {
    if (t < T_TW0) return -0.06 * smooth(seg(t, T_LIFT, T_TW0));
    const k = seg(t, T_TW0, T_TW1);
    return -0.06 + 1.06 * ease.outBack(k);
  };

  const gearFrom = gear ? gear.extra : 0;
  let yawM = rot0; // Maya's own yaw, following the hand with some lag
  let yawV = 0;
  let last = 0;
  const t0 = lab.t;
  let thunk = false;

  await new Promise((done) => {
    const stop = lab.every(() => {
      const t = lab.t - t0;
      const dt = Math.max(0, Math.min(0.05, t - last));
      last = t;

      // ---- the hand: height h (1 = high above, 0 = at her), where its shadow is, its twist, its fingers ----
      let h;
      let along; // distance of the pinch point from her, toward the edge
      let tw = 0; // twist, 0..1 of a quarter
      let gap = 150; // fingertips from the pinch point (px)
      if (t < T_IN) {
        const k = seg(t, 0, T_IN);
        h = mix(1, 0.28, ease.inOut(k));
        along = far * (1 - ease.out(k));
      } else if (t < T_GRAB) {
        const k = seg(t, T_IN, T_GRAB);
        h = 0.28 * (1 - ease.in(k));
        along = 0;
        gap = mix(150, 158, k);
      } else if (t < T_OPEN) {
        h = 0;
        along = 0;
        // snap shut, squeeze a little past, ease off
        const c = seg(t, T_GRAB - 0.02, T_GRAB + 0.05);
        gap = mix(158, 70, ease.out(c)) + (t > T_GRAB + 0.05 ? 4 * seg(t, T_GRAB + 0.05, T_GRAB + 0.12) : 0);
        tw = twistK(t);
      } else {
        const k = seg(t, T_OPEN, T_GONE);
        // springs open, rises, untwists, slides off
        gap = mix(74, 170, ease.out(seg(t, T_OPEN, T_OPEN + 0.08)));
        h = ease.in(k) * 1.05;
        tw = 1 - ease.inOut(seg(t, T_OPEN + 0.06, T_GONE));
        along = far * ease.in(seg(t, T_OPEN + 0.08, T_GONE));
      }
      const blur = 1.2 + 34 * h * h + 6 * h;
      const size = 1 + 1.5 * h;
      const dark = t < T_OPEN ? (0.6 + 0.32 * (1 - h)) * seg(t, 0, 0.12) : (0.92 - 0.5 * h) * (1 - seg(t, T_GONE - 0.12, T_GONE));
      drawHand(g, gap, blur);
      tex.needsUpdate = true;
      mat.uniforms.opacity.value = Math.max(0, dark);
      hand.position.set(C.x + out.x * along, 0.016, C.z + out.z * along);
      hand.rotation.y = yaw0 - spin * (Math.PI / 2) * tw;
      hand.scale.setScalar(size);
      // the gear's arrow turns under her as she's twisted
      if (gear) gear.extra = gearFrom - spin * (Math.PI / 2) * clamp01(t < T_OPEN ? tw : 1);

      // ---- Maya ----
      let lift = 0;
      let sx = 1;
      let sy = 1;
      let pitch = 0;
      let roll = 0;
      // she looks up at it, shrinking a little
      const look = smooth(seg(t, 0.2, 0.42)) * (1 - smooth(seg(t, T_GRAB - 0.04, T_GRAB + 0.04)));
      pitch -= 0.28 * look;
      sy -= 0.05 * look;
      // pinched: thin across, bulging up; held through the twist
      const pinch = t < T_GRAB - 0.02 ? 0 : t < T_OPEN ? ease.out(seg(t, T_GRAB - 0.02, T_GRAB + 0.04)) : 0;
      const unp = t >= T_OPEN ? seg(t, T_OPEN, T_OPEN + 0.32) : 0;
      sx -= 0.2 * pinch;
      sy += 0.12 * pinch;
      if (t >= T_OPEN) {
        // springs back into shape, jiggling
        const j = Math.exp(-unp * 5) * Math.cos(unp * Math.PI * 4.5) * (1 - unp);
        sx -= 0.2 * j;
        sy += 0.12 * j;
      }
      // lifted a hair, dangling, then plonked down
      const up = smooth(seg(t, T_GRAB + 0.02, T_LIFT)) * (1 - ease.in(seg(t, T_TW1, T_DOWN)));
      lift += 0.09 * up;
      // her yaw follows the fingers: tight while gripped, but her weight lags and swings
      const handYaw = rot0 - spin * (Math.PI / 2) * (t < T_OPEN ? tw : 1);
      const N = 6;
      for (let s = 0; s < N; s++) {
        const w = 34;
        const z = 0.32;
        yawV += ((w * w * (handYaw - yawM) - 2 * z * w * yawV) * dt) / N;
        yawM += (yawV * dt) / N;
      }
      let rot = t < T_GRAB ? rot0 : yawM;
      // the dangle: as she's swung round, she tips outward a bit
      roll += up * Math.max(-0.25, Math.min(0.25, yawV * 0.05 * spin));
      // after the set-down she is exactly on her new heading
      const settle = smooth(seg(t, T_DOWN, T_DOWN + 0.08));
      rot = mix(rot, rot1, settle);
      // the thunk: a squash as she lands
      if (t >= T_DOWN && !thunk) {
        thunk = true;
        lab.shake(0.012, 0.15);
      }
      const th = seg(t, T_DOWN, T_DOWN + 0.14);
      if (th > 0 && th < 1) {
        const k = Math.sin(Math.PI * th) * (1 - th * 0.5);
        sy -= 0.1 * k;
        sx += 0.06 * k;
      }
      // the shake-off, once the light's back: a quick, decaying side-to-side shiver
      const sh = seg(t, T_OPEN + 0.12, T_END);
      if (sh > 0 && sh < 1) {
        const w = Math.sin(sh * Math.PI * 7) * (1 - sh) * (1 - sh);
        roll += 0.16 * w;
        rot += 0.07 * w;
      }
      maya.set({ rot, lift, sx, sy, sz: 1 + (1 - sx) * 0.4, pitch, roll });

      // how much of her is in the dark
      const cover = clamp01(mat.uniforms.opacity.value * (1 - clamp01((along - 0.4) / 1.2)) * (1 - 0.6 * h));
      maya.cover = cover;

      if (t >= T_END) {
        stop();
        done();
      }
    });

    maya.each = (m) => {
      const k = maya.cover ?? 0;
      m.paint.color.copy(paint0).multiplyScalar(1 - 0.7 * k);
      m.paint.emissiveIntensity = emis0 * (1 - 0.8 * k);
      m.ringMat.color.copy(ring0).multiplyScalar(1 - 0.85 * k);
      m.poolMat.opacity = pool0 * (1 - 0.9 * k);
      m.eyeMat.color.copy(eye0).multiplyScalar(1 - 0.75 * k);
    };
  });

  maya.each = null;
  model.paint.color.copy(paint0);
  model.paint.emissiveIntensity = emis0;
  model.ringMat.color.copy(ring0);
  model.poolMat.opacity = pool0;
  hand.visible = false;
  if (gear) gear.extra = gearFrom - spin * (Math.PI / 2);
  maya.release({ x: after.x, y: after.y, d: after.d });
}
