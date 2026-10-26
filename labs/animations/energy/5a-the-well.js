// Energy, idea 1 "The well", animator a (weight & physical comedy).
export const meta = {
  title: 'Glug, glug, plink',
  idea:
    'Maya parks on the battery and drinks it in three gulps: glug, glug, glug, swelling a little with each, her eye and ring going amber, while the light under her drains away and leaves a black hole in the glass, drawn the way Lumen draws pits. She looks down. The floor is gone, and like a cartoon character who has just noticed, she sinks a hair and freezes. Then one drop of warm light falls out of the dark above, plink, at the edge of the hole: a ripple runs round her ring, the battery fills back in from where it landed, and she bobs back up, relieved. Someone up there keeps the batteries topped up.',
  notes:
    'Sound: three soft glass glugs rising in pitch, a hollow silence, a tiny downward "tk" as she sinks, then a high clean plink with a short glassy ring and a warm swell as it fills. The hole is a shader disc over the glass (dark spreading out from her in steps with the gulps; light filling back in from the drop) so the board\'s own battery drawing is what comes back.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);

/** Lean the body over the edge it leans toward, so it rocks on the glass. */
function tilt(model, pitch, roll = 0) {
  const b = model.body;
  b.rotation.set(-pitch, 0, -roll);
  const pz = pitch >= 0 ? -0.34 : 0.37;
  const px = roll >= 0 ? 0.33 : -0.33;
  const py = 0.02;
  const y1 = py * Math.cos(pitch) + pz * Math.sin(pitch);
  const z1 = -py * Math.sin(pitch) + pz * Math.cos(pitch);
  const x2 = px * Math.cos(roll) + y1 * Math.sin(roll);
  const y2 = -px * Math.sin(roll) + y1 * Math.cos(roll);
  b.position.x += px - x2;
  b.position.y += py - y2;
  b.position.z += pz - z1;
}

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The robot's ring, pointer and pool: the parts that lie on the glass. */
function glassParts(group, model) {
  const out = [];
  group.traverse((o) => {
    if (o.isMesh && (o.material === model.ringMat || o.material === model.poolMat)) out.push({ o, y: o.position.y, ring: o.material === model.ringMat, order: o.renderOrder });
  });
  return out;
}

/** The hole: a disc of dark over the glass. Dark spreads out from the middle (open), light fills back from a point (fill). */
function makeWell(THREE, R) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uOpen: { value: 0 }, uFill: { value: 0 }, uDrop: { value: new THREE.Vector2(0, 1) }, uRim: { value: new THREE.Color(0x46526a) }, uFront: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy / ${R.toFixed(3)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uOpen; uniform float uFill; uniform vec2 uDrop; uniform vec3 uRim; uniform float uFront;
      varying vec2 vP;
      void main(){
        float r = length(vP);
        float disc = 1.0 - smoothstep(0.9, 1.0, r);
        float open = 1.0 - smoothstep(uOpen - 0.14, uOpen, r);
        float dd = length(vP - uDrop);
        float fill = smoothstep(uFill - 0.3, uFill, dd);
        float a = disc * open * fill;
        // the top of the hole's wall catching a little light, like Lumen's pits
        float rim = smoothstep(0.84, 0.94, r) * (1.0 - smoothstep(0.95, 1.0, r)) * open * fill;
        // the edge of the light as it floods back in
        float front = (1.0 - smoothstep(0.0, 0.22, abs(dd - uFill + 0.12))) * disc * uFront;
        vec3 c = uRim * rim * 1.7 + vec3(1.0, 0.77, 0.43) * front * 1.6;
        gl_FragColor = vec4(c, max(a, front * 0.6));
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 3;
  return m;
}

export default async function play(lab) {
  const { THREE, PALETTE, arena } = lab;
  const maya = lab.puppet('a');
  const amber = new THREE.Color(PALETTE.energy);
  const red = new THREE.Color(lab.bot('a').color);
  const home = lab.pos(3, 1);
  const glow = glowTex(THREE);
  lab.cleanup(() => glow.dispose());
  const onGlass = glassParts(maya.group, maya.model);
  lab.cleanup(() => onGlass.forEach(({ o, y, order }) => ((o.position.y = y), (o.renderOrder = order))));
  for (const g of onGlass) if (g.ring) g.o.renderOrder = 4; // her ring draws over the hole
  lab.cleanup(() => {
    maya.model.ringMat.color.copy(red).multiplyScalar(1.6);
    maya.model.poolMat.color.copy(red).multiplyScalar(0.9);
    onGlass.forEach(({ o }) => o.scale.setScalar(1));
  });
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });

  const R = 0.66;
  const well = makeWell(THREE, R);
  well.position.set(home.x, 0.007, home.z);
  well.visible = false;
  lab.add(well);
  // the hole's lip: a thin edge of the glass's own light, as Lumen's pits have
  const lip = new THREE.Mesh(new THREE.RingGeometry(R * 0.94, R, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8696b0).multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  lip.rotation.x = -Math.PI / 2;
  lip.position.set(home.x, 0.009, home.z);
  lip.renderOrder = 4;
  lab.add(lip);
  // where the drop lands: the near edge of the hole, a little left (in disc units: x right, y toward us)
  const dropUV = new THREE.Vector2(-0.8, 0.6).normalize().multiplyScalar(0.93); // clear of her card, which hangs over her
  well.material.uniforms.uDrop.value.set(dropUV.x, -dropUV.y); // plane's y is the board's -z
  const landAt = new THREE.Vector3(home.x + dropUV.x * R, 0, home.z + dropUV.y * R);

  // the drop: a bright point with a streak of its own speed behind it
  const drop = new THREE.Group();
  const dropCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dropStreak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dropStreak.center.set(0.5, 0.15);
  drop.add(dropStreak, dropCore);
  drop.visible = false;
  lab.add(drop);
  // how high it starts: just above the top of the picture
  const cam = lab.camera3;
  cam.updateMatrixWorld();
  let H0 = 0.5;
  // where it forms: in the dark above the board, near the top of the picture
  for (; H0 < 12; H0 += 0.05) if (new THREE.Vector3(landAt.x, H0, landAt.z).project(cam).y > 0.66) break;
  // the splash: a few droplets that jump and fall back
  const splash = Array.from({ length: 5 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.visible = false;
    lab.add(s);
    const a = Math.atan2(dropUV.y, dropUV.x) + ((i - 2) / 2) * 1.1 + lab.range(-0.15, 0.15);
    return { s, v: new THREE.Vector3(Math.cos(a) * lab.range(0.35, 0.6), lab.range(0.9, 1.4), Math.sin(a) * lab.range(0.35, 0.6)), p: new THREE.Vector3(), done: false };
  });
  // the ripple round her ring: two bright beads running round it from the drop, meeting behind her
  // the plink: a small bright ring where it lands
  const plink = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  plink.rotation.x = -Math.PI / 2;
  plink.renderOrder = 5;
  plink.position.copy(landAt).setY(0.012);
  lab.add(plink);
  let plinkAt = -1;
  const beads = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.visible = false;
    lab.add(s);
    return s;
  });

  // ---- the timeline (scene seconds from the start of the move) ----
  const MOVE = 0.6;
  const GULP = [MOVE + 0.06, MOVE + 0.17, MOVE + 0.28]; // glug, glug, glug
  const DRUNK = MOVE + 0.42;
  const LOOK = DRUNK + 0.02; // she looks down
  const SINK = LOOK + 0.14; // the floor's gone: she sinks a hair and freezes
  const FALL = 0.24;
  const SWELL = 0.2; // the drop gathers and hangs before it lets go
  const PLINK = SINK + 0.3; // the drop lands
  const FILL = PLINK + 0.03;
  const BOB = PLINK + 0.12; // she bobs back up
  const END = PLINK + 0.5;
  const G = (2 * (H0 - 0.04)) / (FALL * FALL);

  const st = { pitch: 0, pv: 0, roll: 0, rv: 0, sy: 1, sv: 0, lift: 0, lv: 0 };
  const kicks = new Set();
  const once = (name, fn) => !kicks.has(name) && (kicks.add(name), fn());
  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const T = lab.t - t0;
    const k = clamp01(T / MOVE);
    const x = 1 + 2 * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const accel = T < MOVE ? (k < 0.5 ? 1 : -1) * 22 : 0;

    // ---- drinking: three gulps, each one swells her and pulls the dark out a step further ----
    let drunk = 0; // 0..3
    GULP.forEach((g, i) => {
      drunk += smooth(seg(T, g, g + 0.07));
      if (T >= g) once('gulp' + i, () => (st.sv += 1.6 + 0.5 * i));
    });
    const open = [0, 0.42, 0.72, 1.12];
    const di = Math.min(2, Math.floor(drunk));
    const uOpen = lerp(open[di], open[di + 1], drunk - di);
    well.visible = T >= GULP[0] - 0.01;
    const U = well.material.uniforms;
    U.uOpen.value = uOpen;
    // the battery's own glow shrinks into her as she drinks, and floods back after the plink
    const refill = T >= FILL ? seg(T, FILL, END - 0.05) : 0;
    if (T >= MOVE - 0.06) {
      // it wells up to meet her, then each gulp pulls it in toward her
      const pre = smooth(seg(T, MOVE - 0.06, GULP[0] + 0.02));
      const left = 1 - drunk / 3;
      const back = refill > 0 ? Math.sin(Math.min(1, refill * 1.4) * Math.PI) * (1 - refill * 0.5) : 0;
      const scale = refill > 0 ? lerp(0.3, 1, smooth(Math.min(1, refill * 1.6))) * (1 + 0.3 * back) : (1 + 0.9 * pre) * left;
      arena.batteries[0].scale.setScalar(Math.max(0.001, scale));
      arena.batteryMat.color.multiplyScalar(refill > 0 ? 1 + 4 * back : 1 + 4.5 * pre * left);
    }
    // the light floods back in from where the drop landed
    U.uFill.value = T >= FILL ? 2.3 * (1 - (1 - seg(T, FILL, FILL + 0.34)) ** 2) : 0;
    U.uFront.value = T >= FILL ? 1 - seg(T, FILL + 0.15, FILL + 0.4) : 0;
    if (T >= FILL + 0.36) well.visible = false;
    // the lip shows once the dark reaches it, and goes as the light floods back
    lip.material.opacity = 0.8 * smooth(seg(uOpen, 0.8, 1.1)) * (1 - smooth(seg(T, FILL, FILL + 0.25)));

    // ---- the drop ----
    const tf = T - (PLINK - FALL);
    const ts = T - (PLINK - FALL - SWELL);
    if (ts >= 0 && tf < 0) {
      // it gathers out of the dark: swells, sags under its own weight, necks...
      const r = ts / SWELL;
      drop.visible = true;
      const grow = smooth(clamp01(r * 1.4));
      const sag = r > 0.55 ? (r - 0.55) / 0.45 : 0;
      drop.position.set(landAt.x, H0 - 0.04 * sag * sag, landAt.z);
      dropCore.scale.set(0.15 * grow * (1 - 0.15 * sag), 0.15 * grow * (1 + 0.5 * sag), 1);
      dropStreak.scale.set(0.05 * grow, 0.05 * grow * (1 + 1.2 * sag), 1);
      dropCore.material.opacity = 0.4 + 0.6 * grow;
    } else if (tf >= 0 && T < PLINK) {
      // ...and lets go: a streak of its own speed
      drop.visible = true;
      const h = H0 - 0.04 - 0.5 * G * tf * tf;
      const v = G * tf;
      drop.position.set(landAt.x, Math.max(0.02, h), landAt.z);
      dropCore.scale.set(0.11, 0.13, 1);
      dropCore.material.opacity = 1;
      dropStreak.scale.set(0.08, 0.08 + v * 0.035, 1);
    } else drop.visible = false;
    if (T >= PLINK)
      once('plink', () => {
        plinkAt = lab.t;
        arena.emit('bump', { id: 'a' });
        for (const s of splash) {
          s.p.copy(landAt).setY(0.02);
          s.s.visible = true;
        }
        for (const b of beads) b.visible = true;
      });
    if (plinkAt >= 0) {
      const r = clamp01((lab.t - plinkAt) / 0.32);
      plink.scale.setScalar(0.04 + 0.16 * (1 - (1 - r) ** 3));
      plink.material.opacity = (1 - r) ** 1.5;
    }
    for (const s of splash) {
      if (!s.s.visible) continue;
      s.v.y -= 7 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.01) s.s.visible = false;
      s.s.position.copy(s.p);
      s.s.scale.setScalar(0.05);
    }
    if (T >= PLINK) {
      const r = seg(T, PLINK, PLINK + 0.36);
      const a0 = Math.atan2(dropUV.y, dropUV.x);
      beads.forEach((b, i) => {
        const a = a0 + (i ? 1 : -1) * Math.PI * smooth(r);
        b.position.set(home.x + Math.cos(a) * 0.505, 0.02, home.z + Math.sin(a) * 0.505);
        b.scale.setScalar(0.16 * (1 - r * 0.6));
        b.material.opacity = 1 - r ** 2;
        if (r >= 1) b.visible = false;
      });
    }

    // ---- Maya ----
    // looks down; the floor's gone: a little drop and a freeze, a nervous shiver; bobs back up when it fills
    const wantPitch = 0.3 * smooth(seg(T, LOOK, LOOK + 0.1)) * (1 - smooth(seg(T, BOB, BOB + 0.12)));
    let wantLift = 0;
    if (T >= SINK && T < BOB) wantLift = -0.1;
    if (T >= SINK) once('sink', () => (st.lv -= 0.6));
    if (T >= BOB)
      once('bob', () => {
        st.lv += 1.4;
        st.sv += 1.8;
      });
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      st.pv += (260 * (wantPitch - st.pitch) - 13 * st.pv + accel * 0.11) * h;
      st.pitch += st.pv * h;
      st.rv += (220 * (0 - st.roll) - 10 * st.rv) * h;
      st.roll += st.rv * h;
      st.sv += (320 * (1 - st.sy) - 12 * st.sv) * h;
      st.sy += st.sv * h;
      st.lv += (500 * (wantLift - st.lift) - 22 * st.lv) * h;
      st.lift += st.lv * h;
    }
    const shiver = T >= SINK + 0.06 && T < PLINK ? 0.05 * Math.sin(T * 95) * seg(T, SINK + 0.06, SINK + 0.12) : 0;
    const sw = 1 + 0.03 * Math.min(3, drunk) * (1 - seg(T, BOB, END)); // a little fuller for the drink
    const sxz = sw / Math.sqrt(st.sy);
    maya.set({ x, y: 1, rot: lab.facing(1), lift: T >= END - 0.04 ? 0 : st.lift, sy: st.sy, sx: sxz, sz: sxz });
    const warm = Math.min(1, drunk / 3) * (1 - smooth(seg(T, BOB, END)));
    maya.each = (m) => {
      tilt(m, st.pitch, st.roll + shiver);
      const s = 1.3 * maya.pose.sy;
      for (const { o, y } of onGlass) o.position.y = y - maya.pose.lift / s;
      m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(amber.clone().multiplyScalar(3.4), warm);
      m.ringMat.color.copy(red).multiplyScalar(1.6).lerp(amber.clone().multiplyScalar(2), warm);
      // the ring rings when the ripple runs round it
      const rr = T >= PLINK ? T - PLINK : -1;
      const ringS = rr >= 0 ? 1 + 0.05 * Math.exp(-rr * 7) * Math.sin(rr * 40) : 1;
      for (const g of onGlass) if (g.ring) g.o.scale.setScalar(ringS);
      m.poolMat.color.copy(red).multiplyScalar(0.9).lerp(amber.clone().multiplyScalar(0.9), warm * 0.6);
    };
  });

  await lab.wait(END);
  stop();
  well.visible = false;
  drop.visible = false;
  for (const b of beads) b.visible = false;
  for (const s of splash) s.s.visible = false;
  arena.batteries[0].scale.setScalar(1);
  for (const g of onGlass) {
    g.o.scale.setScalar(1);
    g.o.renderOrder = g.order;
    g.o.position.y = g.y;
  }
  maya.model.ringMat.color.copy(red).multiplyScalar(1.6);
  maya.model.poolMat.color.copy(red).multiplyScalar(0.9);
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
  void TAU;
}
