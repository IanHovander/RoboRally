// Gear, idea 3 (lighthouse), animator b: character acting.
// Maya is the lookout. The room dims; she draws herself up and her eye opens into a wide, hazy cone of warm
// light that makes the dark room's air visible. She pans it slowly from north across the right of the board,
// leaning in to peer, sweeps a little PAST east, stops dead... and snaps back: a double-take with a searchlight.
// The beam settles on the row she now faces and the spaces in front of her light up one by one to the first wall
// or the board's edge, which glints. She gives a small satisfied nod; Theo leans in to look down the lit row too.
// Then she blinks the beam shut and the room comes up.
export const meta = {
  title: 'The lookout',
  idea:
    'Maya turns into a lighthouse keeper: a soft cone of warm light from her eye makes the air of the dark room visible as she pans it across the board. She overshoots east, stops, and snaps back for a searchlight double-take, then the row she will drive down lights up space by space to the edge, which glints. A satisfied nod, a blink, and the room comes back up.',
  notes:
    'Sound: a low glass hum while the beam pans, a tiny tick as it stops past east, a bright "ting" on the snap back, then soft rising chimes as each space of the row lights, and a hush as the beam folds back into her eye. The cone is a shader (brighter where you look through more of it, fading along its length); the spill on the glass is computed per pixel inside the board only; the row is walked like a laser (walls stop it; pits stay dark, as light that falls through). The overshoot is seeded (how far past, how long the pause). Red gears pan the other way.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.after.a;
  const B = sc.bots.b;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });
  const arena = lab.arena;
  const gx = sc.bots.a.x;
  const gy = sc.bots.a.y;
  const gear = arena.gears.get(`${gx},${gy}`);
  const spin = gear?.spin ?? 1;
  const rot0 = maya.pose.rot;
  const rot1 = rot0 + ((facing(A.d) - rot0 + 3 * Math.PI) % TAU) - Math.PI;
  const turnDir = Math.sign(rot1 - rot0) || -1;
  const C = lab.pos(gx, gy);
  const warm = new THREE.Color(lab.PALETTE.light);

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (k) => Math.sin(Math.PI * clamp(k));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ----- the board, for the spill and the row -----
  const course = arena.course;
  const CW = course?.w ?? 7;
  const CH = course?.h ?? 4;
  const corner0 = lab.pos(0, 0);
  const bx0 = corner0.x - 0.5;
  const bz0 = corner0.z - 0.5;
  const bx1 = bx0 + CW;
  const bz1 = bz0 + CH;
  const cellAt = (x, y) => (x >= 0 && y >= 0 && x < CW && y < CH ? course?.cells?.[y * CW + x] : null);
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const wallBetween = (x, y, d) => {
    const a = cellAt(x, y);
    if (a && a.walls & (1 << d)) return true;
    const b = cellAt(x + DX[d], y + DY[d]);
    return !!(b && b.walls & (1 << ((d + 2) % 4)));
  };
  // the row she will face, up to the first wall or the edge
  const row = [];
  let stopBy = 'edge';
  {
    let x = gx;
    let y = gy;
    for (let i = 0; i < 32; i++) {
      if (wallBetween(x, y, A.d)) {
        stopBy = 'wall';
        break;
      }
      x += DX[A.d];
      y += DY[A.d];
      if (x < 0 || y < 0 || x >= CW || y >= CH) break;
      row.push({ x, y, pit: cellAt(x, y)?.k === 'pit' });
    }
  }
  const last = row.length ? row[row.length - 1] : { x: gx, y: gy };
  const endAt = lab.pos(last.x + DX[A.d] * 0.5, last.y + DY[A.d] * 0.5); // the edge or wall at the end of the row

  // ----- the room dims a touch (undone at the end) -----
  const hemi0 = arena.hemi?.intensity ?? 0;
  const key0 = arena.key?.intensity ?? 0;
  let dim = 0;
  const unDim = () => {
    if (arena.hemi) arena.hemi.intensity = hemi0;
    if (arena.key) arena.key.intensity = key0;
  };
  lab.cleanup(unDim);

  // ----- the beam: a hazy cone in the air -----
  const LEN = 4.6;
  const HALF = 0.25; // half-angle, radians: wide, never a laser
  const coneGeo = new THREE.ConeGeometry(Math.tan(HALF) * LEN, LEN, 64, 1, true);
  coneGeo.translate(0, -LEN / 2, 0);
  coneGeo.rotateX(Math.PI / 2); // apex at the origin, opening toward -z (her front)
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: warm.clone().multiplyScalar(1.0) }, uOpacity: { value: 0 }, uReach: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vL; varying vec3 vP;
      void main() {
        vL = -position.z / ${LEN.toFixed(2)};
        vP = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uReach; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vL; varying vec3 vP;
      void main() {
        if (vL > uReach) discard;
        float f = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(f, 3.2);
        float along = pow(1.0 - vL, 1.6) * smoothstep(0.0, 0.06, vL) * smoothstep(uReach, uReach - 0.08, vL);
        float dust = 0.85 + 0.15 * sin(vP.x * 9.0 + uTime * 0.7) * sin(vP.y * 11.0 - uTime * 0.5) * sin(vP.z * 7.0);
        float a = core * along * dust * uOpacity;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.renderOrder = 9;
  cone.frustumCulled = false;
  const beam = new THREE.Group();
  beam.add(cone);
  lab.add(beam);

  // ----- the spill on the glass: worked out per pixel, inside the board only -----
  const spillMat = new THREE.ShaderMaterial({
    uniforms: {
      uO: { value: new THREE.Vector2(C.x, C.z) },
      uD: { value: new THREE.Vector2(0, -1) },
      uOpacity: { value: 0 },
      uReach: { value: 1 },
      uColor: { value: warm.clone() },
      uB: { value: new THREE.Vector4(bx0, bz0, bx1, bz1) },
    },
    vertexShader: `
      varying vec2 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec2 uO; uniform vec2 uD; uniform float uOpacity; uniform float uReach; uniform vec3 uColor; uniform vec4 uB;
      varying vec2 vW;
      void main() {
        if (vW.x < uB.x || vW.y < uB.y || vW.x > uB.z || vW.y > uB.w) discard;
        vec2 r = vW - uO;
        float d = length(r);
        float along = dot(r, uD);
        if (along <= 0.0) discard;
        float ang = acos(clamp(along / max(d, 1e-4), -1.0, 1.0));
        float cone = smoothstep(${(HALF * 1.15).toFixed(3)}, ${(HALF * 0.05).toFixed(3)}, ang);
        float fall = smoothstep(0.35, 0.95, d) * smoothstep(${LEN.toFixed(2)} * uReach, ${LEN.toFixed(2)} * uReach * 0.55, d);
        float edge = min(min(vW.x - uB.x, uB.z - vW.x), min(vW.y - uB.y, uB.w - vW.y));
        float rim = 1.0 + 1.4 * smoothstep(0.07, 0.0, edge); // the light catches the board's edge
        float a = cone * cone * fall * rim * uOpacity * 0.3;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(CW + 2, CH + 2), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set((bx0 + bx1) / 2, 0.012, (bz0 + bz1) / 2);
  spill.renderOrder = 7;
  lab.add(spill);

  // a glint where the beam's centre leaves the board
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glint.scale.setScalar(0.5);
  lab.add(glint);
  const exitPoint = (o, d) => {
    // where a ray from o (x, z) along d leaves the board
    let t = 99;
    if (d.x > 1e-6) t = Math.min(t, (bx1 - o.x) / d.x);
    if (d.x < -1e-6) t = Math.min(t, (bx0 - o.x) / d.x);
    if (d.y > 1e-6) t = Math.min(t, (bz1 - o.y) / d.y);
    if (d.y < -1e-6) t = Math.min(t, (bz0 - o.y) / d.y);
    return { x: o.x + d.x * t, z: o.y + d.y * t, t };
  };

  // the row lighting up, space by space
  const tileTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    // a soft warm square of light under the glass, no outline
    g.filter = 'blur(9px)';
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath();
    g.roundRect(26, 26, 76, 76, 18);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const tiles = row.map((c) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tileTex, color: warm.clone().multiplyScalar(0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    const p = lab.pos(c.x, c.y);
    m.position.set(p.x, 0.014, p.z);
    m.renderOrder = 7;
    m.visible = !c.pit;
    lab.add(m);
    return m;
  });
  // the edge (or wall) at the end of the row: a bar of light along it
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.08),
    new THREE.MeshBasicMaterial({ map: glowTex, color: warm.clone().multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  bar.position.set(endAt.x, stopBy === 'wall' ? 0.12 : 0.0, endAt.z);
  bar.rotation.y = A.d % 2 === 1 ? Math.PI / 2 : 0;
  bar.renderOrder = 9;
  lab.add(bar);

  // ----- the parts -----
  const findEye = (model) => {
    let eye = null;
    model.body.traverse((o) => {
      if (!eye && o.isMesh && o.material === model.eyeMat) eye = o;
    });
    return eye;
  };
  const mEye = findEye(maya.model);
  const tEye = findEye(theo.model);
  const restore = () => {
    for (const m of [maya.model, theo.model]) {
      m.body.scale.set(1, 1, 1);
      m.body.rotation.set(0, 0, 0);
    }
    if (mEye) mEye.scale.set(1, 1, 1);
    if (tEye) tEye.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  // ----- the plan -----
  const OPEN = 0.08; // the beam opens out of her eye
  const PAN = 0.24; // she starts to pan
  const over = lab.range(0.3, 0.42); // how far past east she sweeps (radians)
  const PAST = 0.72; // ...past east, stop dead
  const BACK = PAST + lab.range(0.09, 0.13); // the snap back
  const REST = BACK + 0.09; // on the row
  const NOD = REST + 0.12;
  const FOLD = REST + 0.42; // the beam folds back into her eye
  const END = FOLD + 0.2;
  // she pans like someone searching with a torch: look... look... look... (a little past)... THERE
  const far = rot1 + turnDir * over;
  const stops = [
    [PAN, PAN + 0.12, 0, 0.36],
    [PAN + 0.17, PAN + 0.29, 0.36, 0.7],
    [PAN + 0.34, PAST, 0.7, 1],
  ];
  const headingAt = (s) => {
    if (s < PAN) return rot0;
    if (s < PAST) {
      for (const [a, b, f0, f1] of stops) if (s <= b) return lerp(rot0, far, s < a ? f0 : lerp(f0, f1, ease.inOut(seg(s, a, b))));
      return far;
    }
    if (s < BACK) return far;
    return lerp(far, rot1, ease.outBack(seg(s, BACK, REST)));
  };
  // a small peering dip of the head at each stop of the pan
  const peerDip = (s) => stops.reduce((acc, [, b]) => acc + bump(seg(s, b - 0.02, b + 0.07)), 0);

  const eyeW = new THREE.Vector3();
  const t0 = lab.t;
  let prevHead = rot0;
  const stop = lab.every((dt) => {
    const s = lab.t - t0;
    const head = headingAt(s);
    const speed = Math.abs(head - prevHead) / Math.max(dt, 1e-3);
    prevHead = head;

    // the room: down a touch while the beam is out
    dim = ease.inOut(seg(s, 0, 0.22)) * (1 - ease.inOut(seg(s, FOLD, END)));
    if (arena.hemi) arena.hemi.intensity = hemi0 * (1 - 0.45 * dim);
    if (arena.key) arena.key.intensity = key0 * (1 - 0.4 * dim);
    if (arena.topMat) arena.topMat.emissiveIntensity *= 1 - 0.55 * dim;

    // ----- Maya -----
    const tall = ease.out(seg(s, 0, OPEN + 0.08)) * (1 - ease.inOut(seg(s, FOLD + 0.05, END)));
    const peer = ease.inOut(seg(s, PAN, PAN + 0.2)) * (1 - ease.inOut(seg(s, PAST, PAST + 0.06)));
    const take = bump(seg(s, PAST + 0.01, BACK + 0.02)); // stops dead: a little rise of surprise
    const snap = s > BACK ? Math.exp(-seg(s, BACK, BACK + 0.3) * 5) * Math.sin(seg(s, BACK, BACK + 0.3) * 14) : 0;
    const nod = bump(seg(s, NOD, NOD + 0.1)) + 0.8 * bump(seg(s, NOD + 0.12, NOD + 0.22)); // yes, yes: that way
    const shutK = seg(s, FOLD + 0.1, FOLD + 0.2);
    const shut = shutK > 0 && shutK < 1 ? Math.sin(Math.PI * shutK) : 0;
    maya.set({ rot: head, lift: 0.04 * tall + 0.08 * take });
    const mPitch = 0.1 * peer + 0.1 * peerDip(s) - 0.3 * take + 0.24 * nod;
    maya.each = (m) => {
      m.body.rotation.x = -mPitch;
      m.body.rotation.z = -turnDir * 0.1 * snap; // the body rocks with the snap back
      m.body.position.y += 0.2 * Math.abs(Math.sin(mPitch));
      const sy = 1 + 0.1 * tall - 0.05 * peer + 0.16 * take;
      const sxz = 1 / Math.sqrt(sy);
      m.body.scale.set(sxz, sy, sxz);
      // the eye: bright as a lamp while the beam is out, narrowed to peer, wide on the take, a blink to shut it
      const lamp = ease.out(seg(s, OPEN - 0.04, OPEN + 0.06)) * (1 - seg(s, FOLD, FOLD + 0.14));
      m.eyeMat.color.multiplyScalar(1 + 1.6 * lamp + 1.6 * bump(seg(s, FOLD + 0.04, FOLD + 0.16)));
      if (mEye) {
        const open = (1 - 0.4 * peer + 0.6 * take) * (1 - 0.9 * shut);
        mEye.scale.set(open, 1 + 0.2 * take, open);
      }
    };

    // ----- the beam, from her eye along her heading, tipped a little down to the glass -----
    if (mEye) mEye.getWorldPosition(eyeW);
    else eyeW.set(C.x, 0.3, C.z);
    beam.position.copy(eyeW);
    beam.rotation.set(0, 0, 0);
    beam.rotation.order = 'YXZ';
    beam.rotation.y = head;
    beam.rotation.x = -0.075;
    const reachOut = ease.out(seg(s, OPEN, OPEN + 0.2));
    const reachIn = ease.in(seg(s, FOLD, FOLD + 0.14));
    const reach = Math.max(0.001, reachOut * (1 - reachIn));
    const width = 0.3 + 0.7 * ease.out(seg(s, OPEN, OPEN + 0.24));
    cone.scale.set(width * (1 - 0.6 * reachIn), width * (1 - 0.6 * reachIn), 1);
    const flicker = s > PAST && s < BACK ? 0.85 + 0.15 * Math.sin(s * 90) : 1;
    coneMat.uniforms.uReach.value = reach;
    coneMat.uniforms.uOpacity.value = 0.34 * reachOut * flicker * (1 - 0.5 * reachIn);
    coneMat.uniforms.uTime.value = s;
    const dir = new THREE.Vector2(-Math.sin(head), -Math.cos(head));
    spillMat.uniforms.uO.value.set(eyeW.x, eyeW.z);
    spillMat.uniforms.uD.value.copy(dir);
    spillMat.uniforms.uReach.value = reach;
    spillMat.uniforms.uOpacity.value = reachOut * flicker * (1 - reachIn) * (1 + 0.6 * bump(seg(s, BACK, REST + 0.1)));
    // the glint where the centre of the beam leaves the board: brighter while it moves
    const ex = exitPoint({ x: eyeW.x, y: eyeW.z }, dir);
    glint.position.set(ex.x, 0.0, ex.z);
    const inReach = ex.t < LEN * reach ? 1 : 0;
    glint.material.opacity = inReach * reachOut * (1 - reachIn) * clamp(0.35 + speed * 0.25) * (0.9 + 0.1 * Math.sin(s * 40));
    glint.scale.setScalar(0.35 + 0.25 * clamp(speed * 0.3));

    // ----- the row lights up, space by space, then the edge -----
    tiles.forEach((m, i) => {
      const k = seg(s, REST - 0.02 + i * 0.06, REST + 0.1 + i * 0.06);
      const fade = 1 - ease.in(seg(s, FOLD, FOLD + 0.2));
      m.material.opacity = ease.out(k) * fade * (0.9 - 0.08 * i);
      m.scale.setScalar(0.86 + 0.08 * ease.outBack(k));
    });
    const kb = seg(s, REST + row.length * 0.06, REST + row.length * 0.06 + 0.1);
    bar.material.opacity = ease.out(kb) * (1 - ease.in(seg(s, FOLD, FOLD + 0.2))) * (1 + 0.5 * bump(kb));
    bar.scale.set(1, 1 + 2 * bump(kb), 1);

    // ----- Theo: the curious onlooker, leaning in down the lit row -----
    const jolt = s > BACK ? bump(seg(s, BACK, BACK + 0.12)) : 0;
    const lean = ease.inOut(seg(s, REST, REST + 0.2)) * (1 - ease.inOut(seg(s, FOLD, END)));
    theo.set({ x: B.x, y: B.y, lift: 0.05 * jolt });
    const tPitch = 0.28 * lean - 0.14 * jolt;
    theo.each = (m) => {
      m.body.rotation.x = -tPitch;
      m.body.position.y += 0.15 * Math.abs(Math.sin(tPitch));
      const sy = 1 + 0.08 * jolt;
      m.body.scale.set(1, sy, 1);
      m.eyeMat.color.multiplyScalar((1 - 0.25 * dim) * (1 + 0.6 * jolt + 0.4 * lean));
    };
  });

  await lab.wait(END);
  stop();
  restore();
  unDim();
  maya.each = null;
  theo.each = null;
  beam.visible = false;
  spill.visible = false;
  glint.visible = false;
  bar.visible = false;
  tiles.forEach((m) => (m.visible = false));
  maya.release({ x: A.x, y: A.y, d: A.d });
  theo.release({ x: B.x, y: B.y, d: B.d });
}
