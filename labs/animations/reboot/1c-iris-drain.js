// Reboot, idea 1 (The light drains to her), animator c: cinematic & graphic staging.
// The room's darkness closes like an iris on the empty token while every seam of light on the glass swirls into
// it like water down a drain; the camera leans in as if looking down the plughole. The pooled light beads up into
// Maya, her eye ignites with a thin lens streak, and the light runs back out along the same spirals as the iris
// reopens. Two late grey threads soak into her and each one blinks her eye (the 2 SPAM).
export const meta = {
  title: 'Iris drain',
  idea:
    'For a breath the room closes like an iris on the empty token, and the glass\'s own seams of light spiral into it like water down a drain, the camera leaning in to watch. The pool beads up into Maya, her eye ignites with a thin lens streak, and the light unwinds back out along the same spirals. Two late grey threads soak into her and blink her eye twice: the 2 SPAM.',
  notes:
    'Sound: a long inhaled glass tone that bends down as the light drains (a finger round a wine-glass rim, slowing), a soft bead "plink" as she forms, a bright chime when the eye lights, the tone unbending as the light returns, then two muted low ticks for the grey threads. Porting: the iris is a black, soft-edged disc mask over the glass top (one shader plane) plus arena.topMat dimming; the streams are one ribbon mesh. Several robots rebooting at once: split the streams between their tokens.',
};

const MAYA_RED = '#ff4d6d';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const T0 = arena.time;
  const now = () => arena.time - T0;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;

  const token = lab.pos(3, 1);
  const red = new THREE.Color(MAYA_RED);
  const warm = new THREE.Color(lab.PALETTE.light);
  const grey = new THREE.Color(0.6, 0.6, 0.62);

  // ---------- the iris: a soft black disc mask over the glass, closing on the token ----------
  const W = 7;
  const H = 4;
  const maskMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { c: { value: new THREE.Vector2(token.x, token.z) }, r: { value: 8 }, f: { value: 1.6 }, a: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:
      'uniform vec2 c; uniform float r; uniform float f; uniform float a; varying vec3 vW; void main(){ float d = distance(vW.xz, c); float m = smoothstep(r - f, r, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * m); }',
  });
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(W, H), maskMat);
  mask.rotation.x = -Math.PI / 2;
  mask.position.y = 0.003;
  mask.renderOrder = 1;
  lab.add(mask);

  // the board's shared things we dim: slab edges, spill, the room's motes
  const edgeMat = arena.board.children[0]?.material?.[0];
  const edge0 = edgeMat?.emissiveIntensity;
  const spill0 = arena.spill.material.color.clone();
  const motes0 = arena.motes.material.opacity;
  lab.cleanup(() => {
    if (edgeMat) edgeMat.emissiveIntensity = edge0;
    arena.spill.material.color.copy(spill0);
    arena.motes.material.opacity = motes0;
  });

  // ---------- a soft glow texture ----------
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glowPlane = (size, y) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0, 0, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(token.x, y, token.z);
    m.renderOrder = 3;
    lab.add(m);
    return m;
  };
  const poolWide = glowPlane(2.6, 0.014);
  const poolCore = glowPlane(0.9, 0.016);

  // ---------- the streams: ribbons of light on the glass ----------
  const M = 16; // points per ribbon
  const origins = [];
  // the threads start where the glass's light is: along the seams (grid lines), so the seams themselves break up and flow
  for (let gx = 0; gx <= W; gx++) {
    for (let gy = 0; gy <= H; gy++) {
      for (const [ox, oz] of [[0, 0], [0.5, 0], [0, 0.5]]) {
        if ((ox && gx === W) || (oz && gy === H)) continue;
        const x = gx - W / 2 + ox + lab.range(-0.06, 0.06);
        const z = gy - H / 2 + oz + lab.range(-0.06, 0.06);
        if (Math.hypot(x - token.x, z - token.z) < 1.0) continue;
        if (lab.rand() < 0.35) continue;
        origins.push({ x, z, grey: false });
      }
    }
  }
  // the two grey ones, from the far corners
  origins.push({ x: -3.45, z: 1.9, grey: true }, { x: 3.45, z: 1.95, grey: true });
  const N = origins.length;
  const SWIRL = 1.15; // radians the light turns on its way down the drain
  const rmax = Math.max(...origins.map((o) => Math.hypot(o.x - token.x, o.z - token.z)));
  for (const o of origins) {
    o.r0 = Math.hypot(o.x - token.x, o.z - token.z);
    o.a0 = Math.atan2(o.z - token.z, o.x - token.x);
    o.w = o.grey ? 0.055 : lab.range(0.022, 0.042);
    o.b = o.grey ? 1.5 : lab.range(0.45, 0.95);
    // the iris passes each origin at about this time: the light leaves just ahead of the dark
    const kR = clamp((o.r0 - 1.0) / (rmax - 1.0));
    o.start = 0.04 + (1 - kR) * 0.32 + lab.range(0, 0.08);
    o.arrive = 0.78 + lab.range(0, 0.2);
    o.back = lab.rand() < 0.45; // about half the threads carry the light back out
    o.out0 = 1.5 + lab.range(0, 0.22);
    o.out1 = o.out0 + 0.5 + 0.2 * kR;
  }
  // path of stream i at progress s (0 at its origin, 1 in the drain)
  const at = (o, s) => {
    const r = o.r0 * (1 - s) ** 1.15;
    const a = o.a0 + SWIRL * s * s;
    return [token.x + Math.cos(a) * r, token.z + Math.sin(a) * r];
  };

  const pos = new Float32Array(N * M * 2 * 3);
  const col = new Float32Array(N * M * 2 * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = (i * M + j) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const ribbons = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ribbons.frustumCulled = false;
  ribbons.renderOrder = 4;
  lab.add(ribbons);

  // draw ribbon i from s0 to s1 (s0 < s1); `lead` is the bright end (1 = toward the drain, 0 = outward)
  const draw = (i, s0, s1, lead, bright, color) => {
    const o = origins[i];
    const base = i * M * 2 * 3;
    if (s1 - s0 < 0.002 || bright <= 0.001) {
      for (let j = 0; j < M * 2 * 3; j++) col[base + j] = 0;
      return;
    }
    const pts = [];
    for (let j = 0; j < M; j++) pts.push(at(o, s0 + ((s1 - s0) * j) / (M - 1)));
    for (let j = 0; j < M; j++) {
      const p = pts[j];
      const q = pts[Math.min(M - 1, j + 1)];
      const r = pts[Math.max(0, j - 1)];
      let dx = q[0] - r[0];
      let dz = q[1] - r[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const u = j / (M - 1);
      const toward = lead === 1 ? u : 1 - u; // 0 at the tail, 1 at the bright head
      const w = o.w * (0.25 + 0.75 * toward);
      const sAt = s0 + (s1 - s0) * u;
      const k = bright * o.b * (0.1 + 0.9 * toward ** 1.5) * (o.grey ? 1 : 1 - 0.75 * sAt ** 3);
      const c = base + j * 6;
      pos[c] = p[0] - dz * w;
      pos[c + 1] = 0.012;
      pos[c + 2] = p[1] + dx * w;
      pos[c + 3] = p[0] + dz * w;
      pos[c + 4] = 0.012;
      pos[c + 5] = p[1] - dx * w;
      col[c] = col[c + 3] = color.r * k;
      col[c + 1] = col[c + 4] = color.g * k;
      col[c + 2] = col[c + 5] = color.b * k;
    }
  };

  // ---------- Maya ----------
  const maya = lab.puppet('a');
  const theo = lab.bot('b');
  maya.set({ x: 3, y: 1, rot: lab.facing(1), visible: false, trail: false, sx: 0.5, sy: 0.04, sz: 0.5 });
  const look = { emissive: 0, eye: 0, ring: 0, pool: 0, greyHit: 0, blink: 1 };
  maya.each = (m) => {
    m.paint.emissive.copy(red).lerp(grey, look.greyHit);
    m.paint.emissiveIntensity = 0.16 + look.emissive + look.greyHit * 0.9;
    const e = look.eye * look.blink;
    m.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
    m.ringMat.opacity = 0.9 * look.ring;
    m.poolMat.opacity = 0.75 * look.pool;
  };

  // ---------- the lens streak when her eye ignites (screen space) ----------
  const streak = document.createElement('div');
  streak.style.cssText =
    'position:absolute;height:2px;width:0;left:0;top:0;pointer-events:none;opacity:0;transform:translate(-50%,-50%);background:linear-gradient(90deg,rgba(255,240,225,0),rgba(255,244,232,.95) 50%,rgba(255,240,225,0));filter:blur(.4px);mix-blend-mode:screen';
  const streakCore = document.createElement('div');
  streakCore.style.cssText =
    'position:absolute;width:18px;height:18px;left:0;top:0;pointer-events:none;opacity:0;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,248,240,1),rgba(255,230,220,.35) 40%,rgba(255,220,220,0) 70%);mix-blend-mode:screen';
  lab.overlay.append(streak, streakCore);
  const eyeLocal = new THREE.Vector3(0, 0.252, -0.13);

  // ---------- the camera: leans in to look down the drain, then sits back ----------
  const cam = { k: 0 };
  const releaseCam = lab.camera((home) => {
    const k = cam.k;
    const target = home.target.clone().lerp(new THREE.Vector3(token.x, 0.1, token.z), 0.55 * k);
    return { target, dist: home.dist * (1 - 0.2 * k), el: home.el + 0.07 * k, az: 0.04 * k };
  });

  // ---------- the master timeline ----------
  const BEAD = 0.95; // the pool starts to bead up
  const IGNITE = 1.47; // her eye lights
  const GREY = [2.26, 2.5]; // the grey threads arrive
  const END = 2.82;
  let shown = false;
  const stop = lab.every(() => {
    const T = now();

    // the iris and the room
    const close = smooth(seg(T, 0, 0.95));
    const open = smooth(seg(T, 1.52, 2.25));
    maskMat.uniforms.r.value = lerp(7.5, 0.62, close);
    maskMat.uniforms.f.value = lerp(2.2, 0.55, close);
    const dark = smooth(seg(T, 0.0, 0.55)) * (1 - open);
    maskMat.uniforms.a.value = 0.9 * dark;
    const inhale = Math.sin(Math.PI * seg(T, 0, 0.32)) * (1 - dark);
    arena.topMat.emissiveIntensity *= (1 - 0.55 * dark) * (1 + 0.35 * inhale);
    if (edgeMat) edgeMat.emissiveIntensity = edge0 * (1 - 0.75 * dark);
    arena.spill.material.color.copy(spill0).multiplyScalar(1 - 0.8 * dark);
    arena.motes.material.opacity = motes0 * (1 - 0.7 * dark);
    // Theo's glow goes down and comes back with the board; nothing else of his changes
    const tg = 1 - 0.6 * dark;
    theo.model.poolMat.opacity *= tg;
    theo.model.ringMat.opacity *= lerp(1, 0.55, dark);
    theo.model.eyeMat.color.multiplyScalar(lerp(1, 0.45, dark));

    // the streams
    for (let i = 0; i < N; i++) {
      const o = origins[i];
      if (o.grey) {
        const g = GREY[i === N - 2 ? 0 : 1];
        const k = seg(T, g - 0.46, g);
        const tail = seg(T, g - 0.46 + 0.16, g + 0.08);
        if (T < g - 0.46 || T > g + 0.09) draw(i, 0, 0, 1, 0, grey);
        else draw(i, ease.inOut(tail) * 0.999, ease.inOut(k), 1, 1, grey);
        continue;
      }
      if (T < 1.4) {
        // in: head accelerates down the drain, the tail follows it in
        const L = 0.75;
        const k = (T - o.start) / (o.arrive - o.start);
        if (k <= 0) {
          draw(i, 0, 0, 1, 0, warm);
          continue;
        }
        const f = (v) => clamp(v) ** 1.5;
        const s1 = f(k);
        const s0 = f(k - L);
        const c = warm.clone().lerp(red, 0.55 * smooth(seg(T, 0.6, 1.0)));
        draw(i, s0, s1, 1, 1, c);
      } else {
        // out: the light unwinds back along the same spiral and soaks into the glass where it came from
        const k = (T - o.out0) / (o.out1 - o.out0);
        if (!o.back || k <= 0 || k >= 1.25) {
          draw(i, 0, 0, 0, 0, warm);
          continue;
        }
        const L = 0.6;
        const g = (v) => 0.86 * (1 - ease.out(clamp(v)));
        const s0 = g(k);
        const s1 = g(k - L);
        const fade = smooth(seg(k, 0, 0.2)) * (1 - smooth(seg(k, 0.7, 1.25)));
        draw(i, s0, Math.max(s0, s1), 0, 0.5 * fade, warm);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // the pool: fills as the streams arrive, warms to her red, then is drawn up into her
    const fill = smooth(seg(T, 0.5, 0.98));
    const drawnUp = smooth(seg(T, BEAD, BEAD + 0.42));
    const poolK = fill * (1 - 0.85 * drawnUp) + 0.15 * drawnUp * (1 - seg(T, 1.5, 1.9));
    const pc = warm.clone().lerp(red, smooth(seg(T, 0.62, 1.0)));
    const pulse = 1 + 0.08 * Math.sin(T * 30) * fill * (1 - drawnUp);
    poolWide.material.color.copy(pc).multiplyScalar(0.45 * poolK * pulse);
    poolCore.material.color.copy(pc).lerp(warm, 0.3).multiplyScalar(1.5 * poolK * pulse);
    poolWide.scale.setScalar(0.6 + 0.4 * fill - 0.25 * drawnUp);
    poolCore.scale.setScalar(0.5 + 0.6 * fill - 0.3 * drawnUp);
    poolWide.rotation.z = T * 2.2;

    // Maya beads up out of the pool, nose east, unwinding the last of the swirl
    if (T >= BEAD) {
      if (!shown) {
        shown = true;
        maya.set({ visible: true });
      }
      // a flat puddle of her red gathers for a moment, then surface tension pulls it up into the Pebble
      const gather = seg(T, BEAD, BEAD + 0.16);
      const k = seg(T, BEAD + 0.12, BEAD + 0.6);
      const sy = k <= 0 ? 0.05 : 1 - 0.95 * Math.exp(-5 * k) * Math.cos(8.2 * k);
      const puddle = 0.55 + 0.6 * ease.out(gather);
      const sx = k <= 0 ? puddle : lerp(puddle, 1, ease.out(clamp(k * 1.6))) * (1 + 0.32 * (1 - Math.min(1.25, Math.max(0.6, sy))));
      maya.set({ sy: Math.max(0.04, sy), sx, sz: sx, rot: lab.facing(1) + 1.1 * (1 - ease.out3(clamp(k))) });
      if (k >= 1) maya.set({ sx: 1, sy: 1, sz: 1, rot: lab.facing(1) });
      look.emissive = 1.3 * (1 - smooth(seg(T, BEAD + 0.15, BEAD + 0.62)));
      look.pool = smooth(seg(T, IGNITE - 0.05, IGNITE + 0.25));
    }

    // the eye ignites, with a thin streak across the lens
    if (T >= IGNITE) {
      const e = seg(T, IGNITE, IGNITE + 0.05);
      const settle = seg(T, IGNITE + 0.05, IGNITE + 0.4);
      look.eye = e * (1 + 1.1 * (1 - smooth(settle)));
      look.ring = smooth(seg(T, IGNITE, IGNITE + 0.22));
      const fk = seg(T, IGNITE, IGNITE + 0.5);
      maya.group.updateMatrixWorld(true);
      const p = lab.toScreen(maya.model.body.localToWorld(eyeLocal.clone()));
      const wpx = lab.overlay.clientWidth || 960;
      streak.style.left = `${p.x}px`;
      streak.style.top = `${p.y}px`;
      streak.style.width = `${wpx * (0.08 + 0.6 * ease.out(fk))}px`;
      streak.style.height = `${3 - 1.5 * fk}px`;
      streak.style.opacity = String(fk >= 1 ? 0 : 0.9 * (1 - fk) ** 1.4);
      streakCore.style.left = `${p.x}px`;
      streakCore.style.top = `${p.y}px`;
      streakCore.style.opacity = String(fk >= 1 ? 0 : 1 - fk);
      streakCore.style.transform = `translate(-50%,-50%) scale(${1 + 1.4 * (1 - fk)})`;
    }

    // the grey threads soak in: each one blinks her eye and greys her shine for a moment
    let hit = 0;
    let blink = 1;
    for (const g of GREY) {
      const k = (T - g) / 0.24;
      if (k >= 0 && k < 1) {
        hit = Math.max(hit, Math.sin(k * Math.PI));
        blink = Math.min(blink, k < 0.45 ? 0.08 : 0.08 + 0.92 * smooth(seg(k, 0.45, 1)));
      }
    }
    look.greyHit = 0.6 * hit;
    look.blink = blink;

    // the camera
    cam.k = smooth(seg(T, 0.0, 1.0)) * (1 - smooth(seg(T, 1.55, 2.45)));
  });

  await lab.wait(2.5);
  releaseCam();
  await lab.wait(END - 2.5);
  stop();
  ribbons.visible = false;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
}
