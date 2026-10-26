// Gear, idea 3 (lighthouse), animator c: lit like a stage. The room goes down a touch and Maya's eye throws a
// low, wide fan of hazy warm light through the dark air, dust hanging in it. As she turns, the fan sweeps
// north to east, its pool gliding over the glass and running along the board's rim as a glint, while the camera
// leans after the light like an operator following a spot. It comes to rest and pulls focus: the row she now
// faces lights up tile by tile out to the edge (or a wall, or a pit), which answers with a star glint. Then the
// beam folds back into her eye and the room comes up.
export const meta = {
  title: 'Lighthouse, followed',
  idea:
    "Maya's eye becomes a lighthouse: the room dims a touch and a wide, hazy fan of warm light (dust hanging in it) sweeps from north to east as she turns, its pool gliding over the glass and glinting along the board's rim, while the camera leans after the light like an operator following a spot. It comes to rest and pulls focus on the row she now faces: the tiles light up one by one out to the first wall, pit or edge, which answers with a star glint, so the room reads her next move before she makes it. Then the beam folds back into her eye.",
  notes:
    'Sound: a low glass hum swelling as the room dims, a soft rising sweep with the beam, a quick run of tiny rising chimes as the tiles light (one per space), and a bright "tink" with the star glint at the edge or a wall; a pit would get a hollow low note and stay dark, a wall laser in the row would flare. Porting: the row is computed from the board (walls, pits, edges), so it changes every time; the fan is a soft-edged additive shader cone, the spill and the rim glint one shader on a plane over the glass.',
};

const DEG = Math.PI / 180;
const FLAT = 2.2; // the fan is this much flatter than it is wide

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
  return { cells, end, W, H, dx, dy, last: { x: cx, y: cy } };
}

const CONE_GLSL = /* glsl */ `
  uniform vec3 uEye;
  uniform vec3 uAxis;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform float uOut;
  uniform float uIn;
  uniform float uReach;
  float coneLight(vec3 p) {
    vec3 v = p - uEye;
    float d = length(v);
    float a = dot(v, uAxis);
    float r = length(vec2(dot(v, uRight), dot(v, uUp) * ${FLAT.toFixed(2)}));
    float ang = atan(r, max(a, 1e-4));
    float cone = smoothstep(uOut, uIn, ang) * step(0.0, a);
    float reach = smoothstep(uReach, uReach - 0.6, d);
    return cone * reach / (1.0 + 0.07 * d * d);
  }
`;

function tileTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(18, 18, 92, 92);
  g.filter = 'blur(1.5px)';
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 3;
  g.strokeRect(10, 10, 108, 108);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 60);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  for (const [w, h] of [[256, 5], [5, 256], [150, 3]]) {
    const lg = w > h ? g.createLinearGradient(128 - w / 2, 0, 128 + w / 2, 0) : g.createLinearGradient(0, 128 - h / 2, 0, 128 + h / 2);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(128 - w / 2, 128 - h / 2, w, h);
  }
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
  const OUT = 15 * DEG;
  const IN = 3 * DEG;

  // ---- shared beam uniforms ----
  const U = {
    uEye: { value: new THREE.Vector3() },
    uAxis: { value: new THREE.Vector3(0, 0, -1) },
    uRight: { value: new THREE.Vector3(1, 0, 0) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uOut: { value: OUT },
    uIn: { value: IN },
    uReach: { value: 0 },
    uColor: { value: warm.clone() },
    uI: { value: 0 },
    uT: { value: 0 },
  };
  const L = 7;
  // the fan in the air: soft at its edges, streaked like light through haze, fading with distance
  const coneGeo = new THREE.ConeGeometry(L * Math.tan(OUT), L, 72, 1, true);
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
      varying float vAng;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vAlong = -position.z;
        vAng = atan(position.y, position.x);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReach;
      uniform vec3 uColor;
      uniform float uI;
      uniform float uT;
      varying float vAlong;
      varying float vAng;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 3.0);
        float a = vAlong / ${L.toFixed(1)};
        float fall = pow(1.0 - a, 2.0) * smoothstep(0.0, 0.05, a);
        float reach = smoothstep(uReach, uReach - 0.9, vAlong);
        float streak = 0.72 + 0.28 * sin(vAng * 11.0 + 1.3 + uT * 0.6) * sin(vAng * 5.0 - 0.4);
        gl_FragColor = vec4(uColor * edge * fall * reach * streak * uI * 0.3, 1.0);
      }`,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.rotation.order = 'YXZ';
  cone.scale.y = 1 / FLAT;
  cone.renderOrder = 6;
  cone.frustumCulled = false;
  lab.add(cone);

  // the spill on the glass, and the glint where it runs along the board's rim
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uHalf: { value: new THREE.Vector2(row.W / 2, row.H / 2) } },
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
        float rim = smoothstep(0.04, 0.0, min(e.x, e.y));
        gl_FragColor = vec4(uColor * l * uI * (0.5 + 2.4 * rim), 1.0);
      }`,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(row.W, row.H), glassMat);
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.013;
  glass.renderOrder = 3;
  lab.add(glass);

  // dust hanging in the air, only seen inside the beam
  const N = 140;
  const dust = new Float32Array(N * 3);
  const dustCol = new Float32Array(N * 3);
  const home = lab.pos(start.x, start.y);
  for (let i = 0; i < N; i++) {
    const a = -r0 + s * lab.range(-0.25, 1.85);
    const r = lab.range(0.6, 5);
    dust[i * 3] = home.x + Math.sin(a) * r;
    dust[i * 3 + 1] = lab.range(0.08, 0.6);
    dust[i * 3 + 2] = home.z - Math.cos(a) * r;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const motes = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false;
  lab.add(motes);

  // the tiles of the row she will face
  const tile = tileTexture(THREE);
  const cells = row.cells.map((c, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.98, 0.98),
      new THREE.MeshBasicMaterial({ map: tile, color: c.pit ? new THREE.Color('#000000') : warm.clone().multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, blending: c.pit ? THREE.NormalBlending : THREE.AdditiveBlending }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(lab.pos(c.x, c.y)).setY(0.015);
    m.renderOrder = 4;
    lab.add(m);
    return { ...c, m, k: 0, i };
  });
  // the star glint where the row ends (the board's edge, or a wall)
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(THREE), color: warm.clone().multiplyScalar(2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const stopAt = row.end === 'pit' ? lab.pos(row.cells[row.cells.length - 1].x, row.cells[row.cells.length - 1].y) : lab.pos(row.last.x + row.dx * 0.5, row.last.y + row.dy * 0.5);
  star.position.copy(stopAt).setY(row.end === 'wall' ? 0.25 : 0.02);
  star.scale.setScalar(0.001);
  star.renderOrder = 7;
  lab.add(star);

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
  const releaseCam = lab.camera((h) => {
    const look = home.clone().add(new THREE.Vector3(-Math.sin(maya.pose.rot), 0, -Math.cos(maya.pose.rot)).multiplyScalar(1.8));
    return {
      target: h.target.clone().lerp(look, 0.16 * follow),
      az: -s * 0.025 * follow * turn,
      dist: h.dist * (1 - 0.03 * follow),
    };
  });

  const muzzle = new THREE.Vector3();
  const stop = lab.every(() => {
    const rot = r0 + (r1 - r0) * turn;
    maya.set({ rot });
    // the beam leaves her eye, aimed a little down so its pool lands on the glass ahead
    maya.model.muzzle.getWorldPosition(muzzle);
    const fwd = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
    const eyeAt = muzzle.clone().addScaledVector(fwd, 0.02);
    const tilt = Math.atan2(Math.max(0.1, eyeAt.y), 3.4);
    cone.position.copy(eyeAt);
    cone.rotation.set(-tilt, rot, 0);
    U.uEye.value.copy(eyeAt);
    U.uAxis.value.set(fwd.x * Math.cos(tilt), -Math.sin(tilt), fwd.z * Math.cos(tilt));
    U.uRight.value.set(-fwd.z, 0, fwd.x);
    U.uUp.value.crossVectors(U.uRight.value, U.uAxis.value).normalize();
    const out = OUT - 4.5 * DEG * focus;
    U.uOut.value = out;
    U.uIn.value = IN - 1.5 * DEG * focus;
    const w = Math.tan(out) / Math.tan(OUT);
    cone.scale.set(w, w / FLAT, 1);
    U.uT.value = lab.t;
    // dust glints where the beam passes
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(dust[i * 3], dust[i * 3 + 1], dust[i * 3 + 2]).sub(eyeAt);
      const d = v.length();
      const a = v.dot(U.uAxis.value);
      const r = Math.hypot(v.dot(U.uRight.value), v.dot(U.uUp.value) * FLAT);
      const ang = Math.atan2(r, Math.max(a, 1e-4));
      const k = (a > 0 ? THREE.MathUtils.smoothstep(-ang, -U.uOut.value, -U.uIn.value) : 0) * THREE.MathUtils.smoothstep(U.uReach.value - d, 0, 0.6) * U.uI.value;
      const tw = 0.55 + 0.45 * Math.sin(lab.t * 6 + i * 1.7);
      const b = (2.4 * k * tw) / (1 + 0.04 * d * d);
      dustCol[i * 3] = warm.r * b;
      dustCol[i * 3 + 1] = warm.g * b;
      dustCol[i * 3 + 2] = warm.b * b;
      dust[i * 3 + 1] += Math.sin(lab.t * 0.8 + i) * 0.0005;
    }
    dustGeo.attributes.color.needsUpdate = true;
    dustGeo.attributes.position.needsUpdate = true;
    // the room
    arena.dim = arena.dimCur = 0.6 * room;
    arena.key.intensity = key0 * (1 - 0.5 * room);
    arena.hemi.intensity = hemi0 * (1 - 0.4 * room);
    for (const c of cells) c.m.material.opacity = c.k * (c.pit ? 0.9 : 0.7);
  });
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * eye, 3.1 * eye, 2.9 * eye);

  // ---- beats ----
  // the room goes down; her eye gathers light
  lab.tween(0.24, (e) => {
    room = e;
    eye = 1 + 1.4 * e;
  }, ease.inOut);
  lab.tween(0.6, (e) => (follow = e), ease.inOut);
  await lab.wait(0.1);
  // the beam opens, pointing the way she faces
  lab.tween(0.18, (e) => (U.uI.value = e), ease.out);
  await lab.tween(0.2, (e) => (U.uReach.value = 0.3 + e * (L - 0.3)), ease.out);
  // the sweep: she turns, the beam with her
  await lab.tween(0.54, (e) => (turn = e), ease.inOut3);
  // it comes to rest: pulls focus, and the row lights up tile by tile
  lab.tween(0.18, (e) => (focus = e), ease.out);
  cells.forEach((c) => lab.at(0.03 + c.i * 0.065, () => lab.tween(0.1, (e) => (c.k = e), ease.out)));
  lab.at(0.05 + cells.length * 0.065, () =>
    lab.tween(0.34, (e, k) => {
      const f = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - ease.in(Math.max(0, (k - 0.35) / 0.65)));
      star.scale.setScalar(0.001 + 0.95 * f);
      star.material.rotation = 0.4 * k;
    }, ease.linear),
  );
  await lab.wait(0.42);
  // it folds back into her eye; the room comes up
  lab.tween(0.26, (e) => {
    room = 1 - e;
    follow = 1 - e;
  }, ease.inOut);
  cells.forEach((c) => lab.at((cells.length - 1 - c.i) * 0.03, () => lab.tween(0.1, (e) => (c.k = 1 - e), ease.in)));
  await lab.tween(0.22, (e) => {
    U.uReach.value = (1 - e) * L;
    U.uI.value = 1 - e * e;
    eye = 2.4 + 0.8 * Math.sin(e * Math.PI) - 1.4 * e;
  }, ease.in);
  await lab.wait(0.05);
  stop();
  cone.visible = glass.visible = motes.visible = star.visible = false;
  for (const c of cells) c.m.visible = false;
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.dim = arena.dimCur = 0;
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
