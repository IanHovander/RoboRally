// Gear, idea 3 (lighthouse), animator c: lit like a stage. The room goes down a touch and Maya's eye throws a
// soft, hazy cone of warm light through the dark air; dust hangs in it. As she turns the cone sweeps north to
// east, its pool glides over the glass and runs along the board's rim as a glint, while the camera leans
// after the light like an operator following a spot. It comes to rest and tightens like a focus pull: the
// row she now faces lights up space by space, out to the edge (or a wall, or a pit). Then the beam folds back
// into her eye and the room comes up.
export const meta = {
  title: 'Lighthouse, followed',
  idea:
    "Maya's eye becomes a lighthouse: the room dims a touch and a wide, hazy cone of warm light (dust hanging in it) sweeps from north to east as she turns, its pool gliding over the glass and glinting along the board's rim, while the camera leans after the light like an operator following a spot. It comes to rest and pulls focus on the row she now faces: the spaces light up one by one out to the first wall, pit or edge, which answers with a glint, so the room reads her next move before she makes it. Then the beam folds back into her eye.",
  notes:
    'Sound: a low glass hum swelling as the room dims, a soft rising sweep with the beam, a quick run of three tiny chimes as the spaces light (one per space, rising), a glassy "tink" when it reaches the edge or a wall; a pit gets a hollow low note instead, and a wall laser in the row would flare. Porting: the row is computed from the board (walls, pits, edges), so it changes every time; the cone is a soft-edged additive shader cone and the spill/rim glint one shader on a plane over the glass.',
};

const DEG = Math.PI / 180;

// what the light falls on: the spaces in front of (x, y) facing d, up to a wall, a pit or the edge
function rowAhead(sc, x, y, d) {
  const grid = sc.grid.map((r) => r.trim().split(/\s+/));
  const H = grid.length;
  const W = grid[0].length;
  const walls = new Set();
  for (const w of sc.walls ?? []) {
    const [xy, sides] = w.split(':');
    for (const ch of sides) walls.add(`${xy}:${'NESW'.indexOf(ch)}`);
  }
  const dx = [0, 1, 0, -1][d];
  const dy = [-1, 0, 1, 0][d];
  const cells = [];
  let end = 'edge';
  let cx = x;
  let cy = y;
  for (;;) {
    if (walls.has(`${cx},${cy}:${d}`)) {
      end = 'wall';
      break;
    }
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
    if (walls.has(`${nx},${ny}:${(d + 2) % 4}`)) {
      end = 'wall';
      break;
    }
    if (grid[ny][nx] === 'XX') {
      cells.push({ x: nx, y: ny, pit: true });
      end = 'pit';
      break;
    }
    cells.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;
  }
  return { cells, end, W, H };
}

const CONE_GLSL = /* glsl */ `
  uniform vec3 uEye;
  uniform vec3 uAxis;
  uniform float uCosOut;
  uniform float uCosIn;
  uniform float uReach;
  float coneLight(vec3 p) {
    vec3 v = p - uEye;
    float d = length(v);
    float c = dot(v / max(d, 1e-4), uAxis);
    float cone = smoothstep(uCosOut, uCosIn, c);
    float reach = smoothstep(uReach, uReach - 0.6, d);
    return cone * reach / (1.0 + 0.09 * d * d);
  }
`;

function softSquare(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.filter = 'blur(9px)';
  g.fillStyle = '#fff';
  g.fillRect(22, 22, 84, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, arena, PALETTE } = lab;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1;
  const maya = lab.puppet('a');
  const r0 = maya.pose.rot;
  const r1 = r0 - s * (Math.PI / 2);
  const row = rowAhead(lab.scenario, end.x, end.y, end.d);
  const warm = new THREE.Color(PALETTE.light);

  // ---- shared beam uniforms ----
  const U = {
    uEye: { value: new THREE.Vector3() },
    uAxis: { value: new THREE.Vector3(0, 0, -1) },
    uCosOut: { value: Math.cos(17 * DEG) },
    uCosIn: { value: Math.cos(5 * DEG) },
    uReach: { value: 0 },
    uColor: { value: warm.clone() },
    uI: { value: 0 },
  };
  const L = 7;
  // the cone in the air: soft at its edges (brightest where we look through the most of it), fading out
  const coneGeo = new THREE.ConeGeometry(L * Math.tan(17 * DEG), L, 64, 1, true);
  coneGeo.translate(0, -L / 2, 0);
  coneGeo.rotateX(Math.PI / 2); // apex at the origin, opening toward -z (forward)
  const coneMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vAlong = -position.z;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReach;
      uniform vec3 uColor;
      uniform float uI;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float a = vAlong / ${L.toFixed(1)};
        float fall = pow(1.0 - a, 1.7) * smoothstep(0.0, 0.07, a);
        float reach = smoothstep(uReach, uReach - 0.8, vAlong);
        gl_FragColor = vec4(uColor * edge * fall * reach * uI * 0.55, 1.0);
      }`,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.rotation.order = 'YXZ';
  cone.renderOrder = 6;
  cone.frustumCulled = false;
  lab.add(cone);

  // the spill on the glass, and the glint where it runs off the board's rim
  const cw = row.W;
  const ch = row.H;
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uHalf: { value: new THREE.Vector2(cw / 2, ch / 2) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${CONE_GLSL}
      uniform vec3 uColor;
      uniform float uI;
      uniform vec2 uHalf;
      varying vec3 vW;
      void main() {
        float l = coneLight(vW);
        vec2 e = uHalf - abs(vW.xz);
        float rim = smoothstep(0.07, 0.0, min(e.x, e.y));
        gl_FragColor = vec4(uColor * l * uI * (0.42 + 3.2 * rim), 1.0);
      }`,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), glassMat);
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.013;
  glass.renderOrder = 3;
  lab.add(glass);

  // dust hanging in the air, only seen inside the beam
  const N = 110;
  const dust = new Float32Array(N * 3);
  const dustCol = new Float32Array(N * 3);
  const seedP = lab.pos(start.x, start.y);
  for (let i = 0; i < N; i++) {
    const a = lab.range(-1.2, 1.2) + (-s * Math.PI) / 4 + r0;
    const r = lab.range(0.7, 5.5);
    dust[i * 3] = seedP.x - Math.sin(a) * r;
    dust[i * 3 + 1] = lab.range(0.05, 0.9);
    dust[i * 3 + 2] = seedP.z - Math.cos(a) * r;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const motes = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false;
  lab.add(motes);

  // the spaces of the row she will face
  const sq = softSquare(THREE);
  const cells = row.cells.map((c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), new THREE.MeshBasicMaterial({ map: sq, color: c.pit ? new THREE.Color('#000000') : warm.clone().multiplyScalar(1.15), transparent: true, opacity: 0, depthWrite: false, blending: c.pit ? THREE.NormalBlending : THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(lab.pos(c.x, c.y)).setY(0.014);
    m.renderOrder = 4;
    lab.add(m);
    return { ...c, m, k: 0, i };
  });

  // ---- the room ----
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.dim = arena.dimCur = 0;
  });
  let room = 0; // 0 lit .. 1 dimmed
  let turn = 0; // 0..1 of her quarter turn
  let focus = 0; // the beam tightening on the row
  let eye = 1;
  let follow = 0; // the camera leaning after the light
  const releaseCam = lab.camera((home) => {
    const look = lab.pos(start.x, start.y).lerp(lab.pos(start.x + Math.sin(-maya.pose.rot) * 2.5, start.y - Math.cos(-maya.pose.rot) * 2.5), 0.5);
    return {
      target: home.target.clone().lerp(look, 0.22 * follow),
      az: -s * 0.035 * follow * Math.sin(turn * Math.PI * 0.5) * (turn > 0 ? 1 : 0),
      dist: home.dist * (1 - 0.04 * follow),
    };
  });

  const muzzle = new THREE.Vector3();
  const stop = lab.every(() => {
    const rot = r0 + (r1 - r0) * turn;
    maya.set({ rot });
    // the beam leaves her eye, aimed a little down so it lands on the glass a few spaces out
    maya.model.muzzle.getWorldPosition(muzzle);
    const eyeAt = muzzle.clone().add(new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot)).multiplyScalar(0.02));
    const tilt = Math.atan2(Math.max(0.1, eyeAt.y), 3.0);
    cone.position.copy(eyeAt);
    cone.rotation.set(-tilt, rot, 0);
    U.uEye.value.copy(eyeAt);
    U.uAxis.value.set(-Math.sin(rot) * Math.cos(tilt), -Math.sin(tilt), -Math.cos(rot) * Math.cos(tilt));
    const out = (17 - 5 * focus) * DEG;
    U.uCosOut.value = Math.cos(out);
    U.uCosIn.value = Math.cos((5 - 1.5 * focus) * DEG);
    cone.scale.set(Math.tan(out) / Math.tan(17 * DEG), Math.tan(out) / Math.tan(17 * DEG), 1);
    // dust glints where the beam passes
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(dust[i * 3], dust[i * 3 + 1], dust[i * 3 + 2]).sub(eyeAt);
      const d = v.length();
      const c = v.normalize().dot(U.uAxis.value);
      const k = THREE.MathUtils.smoothstep(c, U.uCosOut.value, U.uCosIn.value) * THREE.MathUtils.smoothstep(U.uReach.value - d, 0, 0.6) * U.uI.value;
      const tw = 0.6 + 0.4 * Math.sin(lab.t * 7 + i * 1.7);
      const b = (1.6 * k * tw) / (1 + 0.05 * d * d);
      dustCol[i * 3] = warm.r * b;
      dustCol[i * 3 + 1] = warm.g * b;
      dustCol[i * 3 + 2] = warm.b * b;
      dust[i * 3 + 1] += Math.sin(lab.t * 0.8 + i) * 0.0006;
    }
    dustGeo.attributes.color.needsUpdate = true;
    dustGeo.attributes.position.needsUpdate = true;
    // the room
    arena.dim = arena.dimCur = 0.55 * room;
    arena.key.intensity = key0 * (1 - 0.45 * room);
    arena.hemi.intensity = hemi0 * (1 - 0.35 * room);
    for (const c of cells) c.m.material.opacity = c.k * (c.pit ? 0.9 : 0.55);
  });
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);

  // ---- beats ----
  // the room goes down; her eye gathers light
  lab.tween(0.22, (e) => {
    room = e;
    eye = 1 + 1.4 * e;
  }, ease.inOut);
  lab.tween(0.5, (e) => (follow = e), ease.inOut);
  await lab.wait(0.1);
  // the beam opens, pointing north
  lab.tween(0.18, (e) => (U.uI.value = e), ease.out);
  await lab.tween(0.2, (e) => (U.uReach.value = 0.3 + e * (L - 0.3)), ease.out);
  // the sweep: she turns, the beam with her
  await lab.tween(0.56, (e) => (turn = e), ease.inOut3);
  // it comes to rest: pulls focus, and the row lights up space by space
  lab.tween(0.16, (e) => (focus = e), ease.out);
  cells.forEach((c) => lab.at(0.04 + c.i * 0.065, () => lab.tween(0.1, (e) => (c.k = e), ease.out)));
  const last = cells.length ? cells[cells.length - 1] : { x: end.x, y: end.y };
  const dx = [0, 1, 0, -1][end.d];
  const dy = [-1, 0, 1, 0][end.d];
  lab.at(0.06 + cells.length * 0.065, () => {
    const at = lab.pos(last.x + (row.end === 'pit' ? 0 : dx * 0.5), last.y + (row.end === 'pit' ? 0 : dy * 0.5));
    if (row.end === 'pit') lab.ring(at, PALETTE.light, 0.5, -0.05, 0.5);
    else lab.ring(at, PALETTE.light, 0.4, 0.05, 0.45);
  });
  await lab.wait(0.42);
  // it folds back into her eye; the room comes up
  lab.tween(0.24, (e) => {
    room = 1 - e;
    follow = 1 - e;
  }, ease.inOut);
  cells.forEach((c) => lab.at((cells.length - 1 - c.i) * 0.03, () => lab.tween(0.1, (e) => (c.k = 1 - e), ease.in)));
  await lab.tween(0.22, (e) => {
    U.uReach.value = (1 - e) * L;
    U.uI.value = 1 - e * e;
    eye = 2.4 + 0.8 * Math.sin(e * Math.PI) - 1.4 * e;
  }, ease.in);
  await lab.wait(0.04);
  stop();
  cone.visible = glass.visible = motes.visible = false;
  for (const c of cells) c.m.visible = false;
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.dim = arena.dimCur = 0;
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
