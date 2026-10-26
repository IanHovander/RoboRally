// Gear, idea 3 (lighthouse), animator a: weight & physical comedy.
export const meta = {
  title: 'Lighthouse',
  idea:
    "The room dims and Maya's eye spurts a hazy cone of warm light out into the dark air, like a hose turned on. She heaves round toward east and the beam has weight: its far end lags behind her, then whips past and wags like a fishing rod, its spill sliding over the spaces and glinting off the board's edge. It settles on the row she now faces and the light POURS down it like water down a gutter, sloshes against the board's edge and drips off into the dark room below. Then the beam snaps back into her eye like a tape measure, knocking her back a step, and the room comes up.",
  notes:
    'Weight: a wind-up before the heave, the beam lags and overshoots on a spring, the poured light accelerates down the row, hits the edge (or the first wall, or drains into a pit) and sloshes back, a few drops fall the 1.6 units to the floor and make tiny rings there, and the retraction recoils her. It shows her next move: the row lights up to whatever stops her before she moves. Sound: a soft glassy "fwoom" as the beam opens, a rising swish on the sweep, a liquid glassy run and a little splash at the edge, faint drips far below, and a zippy "zzzip-tok" as it snaps home. Red gears: she heaves the other way.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const N = 48; // points along the beam

function ribbon(THREE, n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const u = new Float32Array(n * 2);
  const v = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i < n; i++) {
    u[i * 2] = u[i * 2 + 1] = i / (n - 1);
    v[i * 2] = -1;
    v[i * 2 + 1] = 1;
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  geo.setAttribute('aV', new THREE.BufferAttribute(v, 1));
  geo.setIndex(idx);
  return geo;
}

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

const VERT = `attribute float aU; attribute float aV; varying float vU; varying float vV; varying vec3 vW;
void main(){ vU = aU; vV = aV; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const sc = lab.scenario;
  const A = sc.bots.a;
  const after = sc.after.a;
  const gear = lab.arena.gears.get(`${A.x},${A.y}`);
  const spin = gear?.spin ?? 1;
  const rot0 = facing(A.d);
  const rot1 = rot0 - spin * (Math.PI / 2);
  const C = lab.pos(A.x, A.y);
  const cells = sc.grid.map((r) => r.trim().split(/\s+/));
  const cols = cells[0].length;
  const rows = cells.length;
  const lo = lab.pos(-0.5, -0.5);
  const hi = lab.pos(cols - 0.5, rows - 0.5);
  const warm = new THREE.Color(lab.PALETTE.light);

  // ----- what the beam lands on: the row ahead, up to the first wall, pit or the edge -----
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const [dx, dy] = dirs[after.d];
  const walls = new Set();
  for (const w of sc.walls ?? []) {
    const [xy, sides] = w.split(':');
    const [wx, wy] = xy.split(',').map(Number);
    for (const s of sides) {
      const d = 'NESW'.indexOf(s);
      walls.add(`${wx},${wy},${d}`);
      walls.add(`${wx + dirs[d][0]},${wy + dirs[d][1]},${(d + 2) % 4}`);
    }
  }
  let run = 0; // spaces of floor ahead
  let ends = 'edge';
  for (let x = A.x, y = A.y; ; ) {
    if (walls.has(`${x},${y},${after.d}`)) {
      ends = 'wall';
      break;
    }
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) break;
    if (cells[y][x] === 'XX') {
      ends = 'pit';
      run += 0.5;
      break;
    }
    run += 1;
  }
  const fwd = new THREE.Vector3(dx, 0, dy);
  const runStart = 0.5; // the poured light starts at her ring
  const runEnd = run + 0.5 - (ends === 'pit' ? 0.5 : 0); // the edge / wall face / pit's lip, from her centre

  // ----- the beam: a hazy ribbon in the air (flat + upright) and its spill on the glass -----
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: warm.clone().multiplyScalar(1.1) }, inten: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 color; uniform float inten; varying float vU; varying float vV;
      void main(){ float a = smoothstep(0.0, 0.05, vU) * pow(1.0 - vU, 1.15) * exp(-2.6 * vV * vV) * inten; gl_FragColor = vec4(color, a); }`,
  });
  const spillMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: warm.clone().multiplyScalar(1.0) }, inten: { value: 0 }, bounds: { value: new THREE.Vector4(lo.x, lo.z, hi.x, hi.z) } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 color; uniform float inten; uniform vec4 bounds; varying float vU; varying float vV; varying vec3 vW;
      void main(){
        if (vW.x < bounds.x || vW.x > bounds.z || vW.z < bounds.y || vW.z > bounds.w) discard;
        vec2 c = vW.xz - bounds.xy; vec2 f = abs(fract(c) - 0.5); float edge = 0.5 - max(f.x, f.y);
        float grid = 1.0 - smoothstep(0.0, 0.035, edge);
        float a = smoothstep(0.1, 0.22, vU) * pow(1.0 - vU, 0.7) * exp(-2.2 * vV * vV) * inten;
        gl_FragColor = vec4(color * (1.0 + 2.2 * grid), a * (0.55 + 0.9 * grid));
      }`,
  });
  const tallMat = hazeMat.clone();
  const flat = new THREE.Mesh(ribbon(THREE, N), hazeMat);
  const tall = new THREE.Mesh(ribbon(THREE, N), tallMat);
  const spill = new THREE.Mesh(ribbon(THREE, N), spillMat);
  for (const m of [flat, tall, spill]) {
    m.frustumCulled = false;
    lab.add(m);
  }
  flat.renderOrder = tall.renderOrder = 7;
  spill.renderOrder = 5;

  // ----- the poured light in the row -----
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: warm.clone().multiplyScalar(1.05) }, front: { value: 0 }, back: { value: 0 }, inten: { value: 0 }, splash: { value: 0 }, len: { value: runEnd } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float front; uniform float back; uniform float inten; uniform float splash; uniform float len; varying vec2 vP;
      void main(){
        float x = vP.x; float y = vP.y;
        if (x > front || x < back) discard;
        float side = exp(-pow(abs(y) / 0.42, 6.0));
        float lip = exp(-(front - x) * 9.0);
        float gx = abs(fract(x) - 0.5); float grid = 1.0 - smoothstep(0.0, 0.04, min(gx, abs(abs(y) - 0.5)));
        float tail = smoothstep(back, back + 0.25, x);
        float wall = exp(-(len - x) * 6.0) * splash;
        float a = side * tail * (0.42 + 0.9 * lip + 0.4 * grid + 1.6 * wall) * inten;
        gl_FragColor = vec4(color, a);
      }`,
  });
  const poolGeo = new THREE.PlaneGeometry(runEnd + 0.2, 1.0, 1, 1).translate((runEnd + 0.2) / 2, 0, 0);
  const pour = new THREE.Mesh(poolGeo, poolMat);
  pour.rotation.order = 'YXZ';
  pour.rotation.set(-Math.PI / 2, Math.atan2(-dy, dx), 0);
  pour.position.set(C.x, 0.014, C.z);
  pour.renderOrder = 5;
  lab.add(pour);

  // ----- glints, drops -----
  const tex = glowTex(THREE);
  const sprite = (scale, k = 2.5) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: warm.clone().multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(scale);
    lab.add(s);
    return s;
  };
  const glint = sprite(0.3, 2);
  const edgeGlow = sprite(0.7, 1.6);
  const drops = [];

  // ----- the room -----
  const dim0 = arena.dim;
  lab.cleanup(() => {
    arena.dim = dim0;
  });

  const maya = lab.puppet('a');
  maya.set({ trail: false });
  const model = maya.model;
  const eye0 = new THREE.Color(3.2, 3.1, 2.9);

  // ----- timing -----
  const T_WIND = 0.16;
  const T_OPEN = 0.12; // beam spurts out
  const T_TURN0 = 0.22;
  const T_TURN1 = 0.62;
  const T_POUR = 0.86;
  const T_HIT = 1.08; // the light reaches the edge
  const T_RET = 1.3; // tape measure
  const T_HOME = 1.4;
  const T_END = 1.72;
  const L = 4.4; // beam length (into the air past the edge)

  const gearFrom = gear ? gear.extra : 0;
  let tip = rot0;
  let tipV = 0;
  let last = 0;
  let hit = false;
  const t0 = lab.t;
  const eye = new THREE.Vector3();
  const P = Array.from({ length: N }, () => new THREE.Vector3());

  await new Promise((done) => {
    const stop = lab.every(() => {
      const t = lab.t - t0;
      const dt = Math.max(0, Math.min(0.05, t - last));
      last = t;

      // the room dims a touch, and comes up as the beam snaps home
      const dimK = 0.42 * smooth(seg(t, 0, 0.14)) * (1 - smooth(seg(t, T_RET, T_END)));
      arena.dim = arena.dimCur = dimK;

      // ---- Maya: wind-up, heave, tugged by the whip, knocked back by the snap ----
      let rot;
      if (t < T_TURN0) rot = rot0 + spin * 0.12 * smooth(seg(t, 0, T_WIND));
      else rot = mix(rot0 + spin * 0.12, rot1, ease.inOut(seg(t, T_TURN0, T_TURN1)));
      // the beam's far end on a spring: it lags behind her, then whips past and wags
      for (let s = 0; s < 6; s++) {
        const w = 15;
        const z = 0.26;
        tipV += ((w * w * (rot - tip) - 2 * z * w * tipV) * dt) / 6;
        tip += (tipV * dt) / 6;
      }
      const tug = t < T_RET ? (tip - rot) * 0.1 * (1 - seg(t, 1.0, 1.25)) : 0;
      let pitch = -0.12 * smooth(seg(t, 0, T_WIND)) * (1 - smooth(seg(t, T_TURN0, T_TURN0 + 0.2)));
      let back = 0;
      // the snap home: knocked back, rocks forward, settles
      const kb = seg(t, T_HOME - 0.02, T_END);
      if (kb > 0) {
        const r = Math.exp(-kb * 4) * Math.sin(kb * Math.PI * 3.2) * (1 - kb);
        pitch -= 0.28 * r;
        back = 0.07 * r;
      }
      // the beam opening shoves her back a hair too
      const open = seg(t, T_OPEN, T_OPEN + 0.14);
      if (open > 0 && open < 1) pitch -= 0.08 * Math.sin(Math.PI * open);
      const fx = -Math.sin(rot);
      const fz = -Math.cos(rot);
      if (gear) gear.extra = gearFrom + (rot - rot0);
      maya.set({ rot: rot + tug, pitch, x: A.x - fx * back, y: A.y - fz * back, roll: -tug * 1.5 });

      // ---- the beam ----
      model.muzzle.getWorldPosition(eye);
      const grow = t < T_RET ? ease.outBack(seg(t, T_OPEN, T_OPEN + 0.16)) : 1 - ease.in(seg(t, T_RET, T_HOME));
      const len = Math.max(0.001, L * grow);
      const inten = t < T_RET ? smooth(seg(t, T_OPEN, T_OPEN + 0.08)) : 1 - 0.3 * seg(t, T_RET, T_HOME);
      const base = rot + tug;
      // centreline, bending from her heading to the lagging tip; during the snap, the tip whips round
      let p = eye.clone();
      p.y = Math.max(0.16, eye.y);
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const a = base + (tip - base) * Math.pow(s, 1.6);
        P[i].copy(p);
        const step = len / (N - 1);
        p = p.clone().add(new THREE.Vector3(-Math.sin(a) * step, -0.03 * step, -Math.cos(a) * step));
      }
      const writeRibbon = (mesh, halfW, vertical, y) => {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < N; i++) {
          const q = P[i];
          const r = P[Math.min(N - 1, i + 1)];
          const pv = P[Math.max(0, i - 1)];
          let tx = r.x - pv.x;
          let tz = r.z - pv.z;
          const tl = Math.hypot(tx, tz) || 1;
          tx /= tl;
          tz /= tl;
          const w = halfW(i / (N - 1));
          const yy = y ?? q.y;
          if (vertical) {
            pos.setXYZ(i * 2, q.x, yy - w * 0.6, q.z);
            pos.setXYZ(i * 2 + 1, q.x, yy + w * 0.6, q.z);
          } else {
            pos.setXYZ(i * 2, q.x + tz * w, yy, q.z - tx * w);
            pos.setXYZ(i * 2 + 1, q.x - tz * w, yy, q.z + tx * w);
          }
        }
        pos.needsUpdate = true;
      };
      const cone = (s) => 0.08 + 0.3 * s * len; // a wide, soft cone
      writeRibbon(flat, cone, false);
      writeRibbon(tall, cone, true);
      writeRibbon(spill, (s) => 0.12 + 0.3 * s * len, false, 0.013);
      hazeMat.uniforms.inten.value = 0.22 * inten;
      tallMat.uniforms.inten.value = 0.12 * inten;
      spillMat.uniforms.inten.value = 0.42 * inten * (1 - 0.5 * seg(t, T_POUR + 0.1, T_RET));

      // the glint where the spill crosses the board's edge
      let g = null;
      for (let i = 1; i < N; i++) {
        const q = P[i];
        const inside = q.x > lo.x && q.x < hi.x && q.z > lo.z && q.z < hi.z;
        if (!inside && i > 4) {
          g = q;
          break;
        }
      }
      if (g) {
        glint.position.set(Math.max(lo.x, Math.min(hi.x, g.x)), 0.02, Math.max(lo.z, Math.min(hi.z, g.z)));
        glint.material.opacity = 0.7 * inten * (1 + 0.3 * Math.sin(t * 50));
        glint.scale.set(0.5, 0.16, 1);
      } else glint.material.opacity = 0;

      // ---- the pour: the light runs down the row, sloshes on the edge, drips off ----
      let front = 0;
      let backEdge = 0;
      let splash = 0;
      if (t >= T_POUR) {
        const k = seg(t, T_POUR, T_HIT);
        front = mix(runStart, runEnd, ease.in3(k) * 0.75 + ease.in(k) * 0.25);
        if (t >= T_HIT) {
          const s = t - T_HIT;
          front = runEnd - 0.32 * Math.exp(-s * 9) * Math.sin(Math.min(Math.PI, s * 14)) * (s < 0.23 ? 1 : 0);
          front = Math.min(runEnd, front);
          splash = Math.exp(-s * 6);
          if (!hit) {
            hit = true;
            const at = C.clone().addScaledVector(fwd, runEnd);
            // drops of light off the edge, falling to the floor of the room
            for (let i = 0; i < 7; i++) {
              const s2 = sprite(0.12, 3);
              const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(lab.range(-0.35, 0.35));
              drops.push({
                s: s2,
                p: at.clone().add(side).setY(0.03),
                v: fwd.clone().multiplyScalar(ends === 'edge' ? lab.range(0.5, 1.1) : ends === 'pit' ? lab.range(-0.1, 0.25) : lab.range(-0.7, -0.3)).setY(lab.range(0.35, 0.9)),
                floor: ends === 'wall' ? 0.02 : -1.58,
                landed: false,
              });
            }
          }
        }
        if (t >= T_RET) {
          // sucked back up the beam
          const k2 = ease.in(seg(t, T_RET - 0.04, T_HOME));
          front = mix(runEnd, runStart, k2);
          backEdge = mix(runStart, runStart, k2);
        }
      }
      const pourOn = t >= T_POUR ? (t < T_HOME ? 1 : 1 - seg(t, T_HOME, T_HOME + 0.06)) : 0;
      poolMat.uniforms.front.value = front;
      poolMat.uniforms.back.value = backEdge;
      poolMat.uniforms.inten.value = 0.75 * pourOn;
      poolMat.uniforms.splash.value = splash;
      const edgeAt = C.clone().addScaledVector(fwd, runEnd);
      edgeGlow.position.set(edgeAt.x, 0.05, edgeAt.z);
      edgeGlow.material.opacity = 0.9 * splash * pourOn;
      edgeGlow.scale.set(0.6 + 0.6 * splash, 0.6 + 0.6 * splash, 1);

      for (const d of drops) {
        if (d.landed) continue;
        d.v.y -= 12 * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y <= d.floor) {
          // a tiny plink of light where it lands, far below
          d.landed = true;
          d.p.y = d.floor;
          d.s.position.copy(d.p);
          const tl = lab.t;
          const off = lab.every(() => {
            const k = (lab.t - tl) / 0.3;
            d.s.material.opacity = 0.7 * Math.max(0, 1 - k);
            d.s.scale.set(0.12 + 0.3 * k, 0.05 + 0.1 * k, 1);
            if (k >= 1) off();
          });
          continue;
        }
        d.s.position.copy(d.p);
        d.s.material.opacity = 0.9;
        d.s.scale.set(0.1, 0.1 + Math.min(0.25, Math.abs(d.v.y) * 0.04), 1);
      }

      // hide the beam once home
      flat.visible = tall.visible = spill.visible = t < T_HOME + 0.01;
      if (t >= T_HOME) glint.material.opacity = 0;

      if (t >= T_END) {
        stop();
        done();
      }
    });

    maya.each = (m) => {
      const t = lab.t - t0;
      const charge = smooth(seg(t, 0, T_OPEN + 0.04)) * (1 - seg(t, T_RET, T_HOME));
      const flash = t >= T_HOME ? Math.exp(-(t - T_HOME) * 14) * 2.2 : 0;
      m.eyeMat.color.copy(eye0).multiplyScalar(1 + 0.7 * charge + flash);
    };
  });

  maya.each = null;
  arena.dim = arena.dimCur = dim0;
  if (gear) gear.extra = gearFrom + (rot1 - rot0);
  maya.release({ x: after.x, y: after.y, d: after.d });
}
