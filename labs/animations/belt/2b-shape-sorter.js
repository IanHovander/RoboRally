// Belt, idea 2 (animator b, character acting): "Shape Sorter".
// A slot in Maya's own shape opens in the corner. She glances at it, looks away, then does a full double-take:
// that's ME. She cranes at it the whole ride, parks herself into it with three fussy little nudges, drops in
// with a snug wiggle, and her light fills the slot from the rim inward and floats her back up flush. Proud puff.
// Jun, who watched the whole thing, looks down at his own floor for a square slot. Nothing. Tiny sag.
export const meta = {
  title: 'Shape Sorter',
  idea:
    "As the belts start, a slot in Maya's exact shape (notch already pointing east, red rim, darker than the glass) opens in the corner. She glances, looks away, and does a full double-take: that's her! She cranes at it all the way there, parks into it with three fussy nudges, drops in with a snug wiggle, and her light fills it from the rim inward and floats her back up flush. Jun looks down at his own floor, hoping for a square one. Nothing.",
  notes:
    'Sound: the slot opens with a soft, low glass "whoomp" (air into a hole), the double-take is a tiny rising two-note glint, each parking nudge a muted tick, the drop a deep wooden "tock" (a peg in a hole), and the fill a rising glass hum that resolves as the slot closes. Port: the slot is one plane with a small shader over a distance field of the form\'s silhouette (built once per form from its outline: square for the Cube, a needle for the Spire...). Opening grows the hole from its spine out, the fill runs from the rim inward. Jun\'s look-down is a bystander detail; any robot within a few spaces can do it.',
};

export default async function play(lab) {
  const { THREE, arena } = lab;
  const maya = lab.puppet('a');
  const jun = lab.puppet('b');
  const M = rig(lab, maya, 'x');
  const J = rig(lab, jun, 'y');
  const junRot = jun.pose.rot;
  const RED = new THREE.Color('#ff4d6d');

  // ----- the slot: a plane with a distance field of her silhouette, facing east -----
  const SPAN = 1.8;
  const field = slotField(THREE, 160, SPAN);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uField: { value: field },
      uOpen: { value: 0 },
      uLevel: { value: 0 },
      uFade: { value: 1 },
      uRim: { value: 0 },
      uClick: { value: 0 },
      uColor: { value: new THREE.Vector3(RED.r, RED.g, RED.b) },
      uWall: { value: 0.11 / SPAN },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uField; uniform float uOpen, uLevel, uFade, uRim, uClick, uWall; uniform vec3 uColor;
      varying vec2 vUv;
      float sd(vec2 p){ return (texture2D(uField, p).r - 0.5) * 2.0; }   // >0 inside, 1 at the deepest point
      void main(){
        float d = sd(vUv);
        float edge = 1.0 - uOpen;                                          // the hole grows from its spine out
        float aa = 0.025;
        float inside = smoothstep(edge - aa, edge + aa, d);
        // the far (north) wall of the hole: inside here, but the floor seen through here is outside
        float floorIn = smoothstep(edge - aa, edge + aa, sd(vUv + vec2(0.0, uWall)));
        float wall = inside * (1.0 - floorIn);
        vec3 col = vec3(0.0);
        float a = inside * 0.94;
        col += wall * vec3(0.16, 0.19, 0.25) * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.3, d - edge)));
        // the rim: a thin line of her colour on the hole's edge (it draws itself outward as the hole opens)
        float rim = 1.0 - smoothstep(0.0, 0.07, abs(d - edge));
        float notch = smoothstep(0.78, 0.82, vUv.x);                        // the notch end flashes on the click
        float rimK = rim * (0.45 + 0.55 * uRim + 1.6 * uClick * notch) * step(0.001, uOpen);
        // her light filling from the rim inward, with a brighter meniscus at the front
        float L = uLevel * 1.08;
        float filled = 1.0 - smoothstep(L - 0.05, L + 0.01, d);
        float front = (1.0 - smoothstep(0.0, 0.06, abs(d - L))) * step(0.001, uLevel) * (1.0 - smoothstep(0.85, 1.0, uLevel));
        float fillK = inside * filled * step(0.001, uLevel) * (1.1 + 0.6 * (1.0 - d));
        col += uColor * (fillK * 1.25 + front * 2.0 + rimK * 1.9);
        a = max(a, clamp(rimK, 0.0, 1.0));
        a = max(a * (1.0 - 0.35 * fillK), clamp(fillK * 0.9 + front, 0.0, 1.0));
        gl_FragColor = vec4(col, a * uFade);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), mat);
  slot.rotation.x = -Math.PI / 2;
  slot.position.copy(lab.pos(3, 1)).setY(0.0055);
  slot.renderOrder = 1.5;
  lab.add(slot);

  // the belts give their usual surge on each step (express first, then all of them)
  const surge = (fast) => arena.belts.forEach((b) => (!fast || b.fast) && (b.pulse = lab.t));

  // ----- the choreography (moment clock, seconds) -----
  const R = Math.PI / 2;
  const x = track([[0, 1], [0.36, 1], [0.78, 2, 'inOut'], [0.86, 2], [1.36, 3, 'inOut']]);
  // the corner turns her most of the way; she parks the last few degrees herself in three fussy nudges
  const rot = track([[0, 0], [1.06, 0], [1.4, -1.3, 'inOut'], [1.5, -1.7, 'out'], [1.58, -1.5, 'inOut'], [1.64, -R, 'inOut']]);
  // glance, look away, double-take; then she cranes at it all the way there
  const yaw = track([[0, 0], [0.12, 0], [0.2, -0.32, 'out'], [0.3, -0.05, 'inOut'], [0.4, 0], [0.45, -0.72, 'out'], [0.62, -0.6], [0.9, -0.55], [1.25, -0.08, 'inOut'], [1.4, 0]]);
  const lean = track([[0, 0], [0.45, 0], [0.5, -0.2, 'out'], [0.62, 0.1], [0.78, 0.2], [0.86, 0.06, 'out'], [0.95, 0.18], [1.25, 0.12], [1.42, 0], [1.66, 0], [1.72, 0.08, 'out'], [1.82, 0]]);
  const roll = track([[0, 0], [0.45, 0], [0.5, 0.08], [0.62, 0], [1.42, 0], [1.5, 0.07], [1.58, -0.06], [1.64, 0], [1.78, 0], [1.82, 0.05], [1.88, -0.045], [1.94, 0.03], [2.0, 0]]);
  const sy = track([
    [0, 1], [0.44, 1], [0.48, 1.16, 'out'], [0.62, 1.08], [0.78, 1.0], [0.82, 0.88, 'out'], [0.9, 1.06], [0.98, 1.0],
    [1.66, 1], [1.73, 0.84, 'in'], [1.8, 0.94, 'out'], [1.88, 0.9], [2.1, 0.96], [2.3, 1.07, 'out'], [2.44, 1.0],
  ]);
  const lift = track([[0, 0], [1.65, 0], [1.73, -0.065, 'in'], [2.02, -0.065], [2.3, 0, 'inOut']]);
  const open = track([[0, 1], [0.12, 1], [0.15, 0.5, 'out'], [0.45, 2.1, 'out'], [0.62, 1.7], [1.42, 1.5], [1.5, 0.6, 'out'], [1.64, 0.7], [1.66, 1.2], [1.8, 0.85], [2.0, 0.55], [2.3, 0.7], [2.44, 1]]);
  const glow = track([[0, 1], [0.45, 1], [0.5, 1.7, 'out'], [0.9, 1.3], [1.42, 1.0], [1.66, 1.0], [1.8, 1.25], [2.05, 0.9], [2.3, 1.4], [2.44, 1.1]]);
  const warm = track([[0, 0], [1.8, 0], [2.05, 1], [2.3, 0.6], [2.44, 0.2]]);

  // the slot
  const sOpen = track([[0, 0], [0.05, 0], [0.42, 1, 'out3']]);
  const sRim = track([[0, 0], [0.3, 0], [0.48, 1, 'out'], [1.36, 0.6], [1.64, 0.8], [1.8, 0.5], [2.1, 0]]);
  const sClick = track([[0, 0], [1.635, 0], [1.66, 1, 'out'], [1.85, 0]]);
  const sLevel = track([[0, 0], [1.76, 0], [2.24, 1, 'inOut']]);
  const sFade = track([[0, 1], [2.2, 1], [2.42, 0, 'out']]);

  // Jun: notices the slot, watches her park, then checks his own floor for a square one
  const jYaw = track([[0, 0], [0.18, 0], [0.32, -0.42, 'out'], [0.9, -0.36], [1.3, -0.46], [1.95, -0.46], [2.1, 0, 'inOut']]);
  const jLean = track([[0, 0], [0.18, 0], [0.34, 0.1], [1.4, 0.12], [1.68, -0.04, 'out'], [1.95, 0], [2.14, 0.36, 'inOut']]);
  const jOpen = track([[0, 1], [0.18, 1], [0.3, 1.45, 'out'], [0.6, 1.2], [1.66, 1.2], [1.72, 1.6, 'out'], [1.95, 1.2], [2.2, 1.0]]);

  const END = 2.44;
  const t0 = lab.t;
  let stepped = 0;
  const apply = (t) => {
    if (stepped === 0 && t >= 0.36) (stepped = 1), surge(true);
    if (stepped === 1 && t >= 0.86) (stepped = 2), surge(false);
    maya.set({ x: x(t), y: 1, rot: rot(t), lift: lift(t) });
    Object.assign(M, { yaw: yaw(t), lean: lean(t), roll: roll(t), sy: sy(t), open: open(t), glow: glow(t), warm: warm(t) });
    M.sx = M.sz = 1 / Math.sqrt(M.sy);
    const fill = sLevel(t) * sFade(t);
    M.pool = 1 + 0.3 * fill;
    M.poolA = 1 + 0.35 * fill;
    M.emit = 0.3 * Math.sin(Math.PI * Math.min(1, sLevel(t))) * sFade(t);
    mat.uniforms.uOpen.value = sOpen(t);
    mat.uniforms.uRim.value = sRim(t);
    mat.uniforms.uClick.value = sClick(t);
    mat.uniforms.uLevel.value = sLevel(t);
    mat.uniforms.uFade.value = sFade(t);
    jun.set({ rot: junRot });
    Object.assign(J, { yaw: jYaw(t), lean: jLean(t), open: jOpen(t), glow: 0.9 + 0.3 * jOpen(t) });
  };
  const stop = lab.every(() => apply(Math.min(END, lab.t - t0)));
  await lab.wait(END);
  apply(END);
  stop();
  slot.visible = false;
  maya.release({ x: 3, y: 1, d: 1 });
  jun.release({ x: 5, y: 2, d: 3 });
  M.reset();

  // the game carries on: Jun is still peering at his floor. Nothing. A tiny sag, and he gives up.
  const tail = lab.t;
  const jl = track([[0, 0.36], [0.25, 0.36], [0.55, 0.06, 'inOut'], [0.8, 0]]);
  const js = track([[0, 1], [0.22, 1], [0.36, 0.9, 'out'], [0.6, 0.94], [0.85, 1]]);
  const jo = track([[0, 1], [0.2, 1], [0.34, 0.45, 'out'], [0.6, 0.55], [0.85, 1]]);
  const stopTail = lab.every(() => {
    const t = lab.t - tail;
    Object.assign(J, { yaw: 0, roll: 0, lean: jl(t), sy: js(t), open: jo(t), glow: 0.75 + 0.25 * jo(t) });
    J.sx = J.sz = 1 / Math.sqrt(J.sy);
    J.applyTo(lab.bot('b').model);
    if (t > 0.9) {
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
 * opening and glow, warmth, and the pool of light. `openAxis` is the eye mesh's local axis that opens it
 * ('x' for the Pebble's eye, which lies on its side; 'y' for the Cube's visor).
 */
function rig(lab, p, openAxis) {
  const m = p.model;
  const eyes = [];
  m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && eyes.push(o));
  const eyeBase = eyes.map((e) => e.scale.clone());
  let pool = null;
  m.group.traverse((o) => o.isMesh && o.material === m.poolMat && (pool = o));
  const poolBase = pool?.scale.clone();
  const st = {
    yaw: 0, lean: 0, roll: 0, sx: 1, sy: 1, sz: 1, hop: 0, open: 1, glow: 1, warm: 0, pool: 1, poolA: 1, emit: 0, shake: 0,
    applyTo(model) {
      model.body.rotation.order = 'YXZ';
      model.body.rotation.set(-st.lean, st.yaw, -st.roll);
      model.body.scale.set(st.sx, st.sy, st.sz);
      model.body.position.set(st.shake, st.hop, 0);
      eyes.forEach((e, i) => {
        e.scale.copy(eyeBase[i]);
        e.scale[openAxis] = eyeBase[i][openAxis] * Math.max(0.05, st.open);
      });
      const g = st.glow;
      model.eyeMat.color.setRGB(3.2 * g * (1 + 0.12 * st.warm), 3.1 * g * (1 - 0.12 * st.warm), 2.9 * g * (1 - 0.45 * st.warm));
      if (pool) pool.scale.set(poolBase.x * st.pool, poolBase.y * st.pool, poolBase.z);
      model.poolMat.opacity *= st.poolA;
      if (st.emit) model.paint.emissiveIntensity = 0.16 + st.emit;
    },
    reset() {
      m.body.rotation.set(0, 0, 0);
      m.body.rotation.order = 'XYZ';
      m.body.scale.set(1, 1, 1);
      m.body.position.set(0, 0, 0);
      eyes.forEach((e, i) => e.scale.copy(eyeBase[i]));
      if (pool) pool.scale.copy(poolBase);
    },
  };
  p.each = (model) => st.applyTo(model);
  lab.cleanup(() => st.reset());
  return st;
}

/** The outline of a pebble seen from above, front at +y (as bots3d.js draws it). */
function pebblePath(g, s = 1) {
  g.moveTo(0, 0.29 * s);
  g.bezierCurveTo(0.11 * s, 0.29 * s, 0.31 * s, -0.12 * s, 0.29 * s, -0.22 * s);
  g.bezierCurveTo(0.27 * s, -0.31 * s, 0.13 * s, -0.33 * s, 0, -0.29 * s);
  g.bezierCurveTo(-0.13 * s, -0.33 * s, -0.27 * s, -0.31 * s, -0.29 * s, -0.22 * s);
  g.bezierCurveTo(-0.31 * s, -0.12 * s, -0.11 * s, 0.29 * s, 0, 0.29 * s);
}

/**
 * A signed distance field (0.5 = the edge, 1 = the deepest point inside) of her Pebble's footprint plus its
 * pointer notch, facing east, over a SPAN x SPAN world square centred on the tile. Row 0 is the south edge.
 */
function slotField(THREE, N, SPAN) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const k = 1.3 * 1.1; // the robot's scale, and a little room to drop into
  g.translate(N / 2, N / 2);
  g.scale(N / SPAN, N / SPAN);
  g.scale(k, k);
  g.transform(0, 1, 1, 0, 0, 0); // shape (x, y=front) → canvas (east = front, south = shape x)
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineJoin = 'round';
  g.lineWidth = 0.12; // the bevel the model's extrusion adds round the outline
  g.beginPath();
  pebblePath(g);
  g.closePath();
  g.fill();
  g.stroke();
  // the pointer notch: a separate little triangle where her pointer will land (the pointer sits at 0.45-0.56)
  g.beginPath();
  g.moveTo(-0.1, 0.415);
  g.lineTo(0, 0.6);
  g.lineTo(0.1, 0.415);
  g.closePath();
  g.lineWidth = 0.02;
  g.fill();
  g.stroke();
  const img = g.getImageData(0, 0, N, N).data;
  const inside = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) inside[i] = img[i * 4 + 3] > 127 ? 1 : 0;
  const edge = []; // pixels on either side of the outline
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const v = inside[i];
      if (inside[i - 1] !== v || inside[i + 1] !== v || inside[i - N] !== v || inside[i + N] !== v) edge.push(x, y);
    }
  const dist = new Float32Array(N * N);
  let maxIn = 1e-6;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let best = 1e9;
      for (let e = 0; e < edge.length; e += 2) {
        const dx = edge[e] - x;
        const dy = edge[e + 1] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
      }
      const d = (Math.sqrt(best) + 0.5) * (inside[y * N + x] ? 1 : -1);
      dist[y * N + x] = d;
      if (d > maxIn) maxIn = d;
    }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = Math.round(255 * (0.5 + 0.5 * Math.max(-1, Math.min(1, dist[y * N + x] / maxIn))));
      const o = ((N - 1 - y) * N + x) * 4; // canvas row 0 is north; the texture's row 0 is south
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
