// Reboot, idea 3 "The light drains to her", animator a (weight & physical comedy).
// Light has weight. For a breath the empty token becomes the lowest point of the board: the glass sags there
// (the seams bend toward it like a lens), and the board's light runs downhill into it in streams that
// accelerate as they fall, stretching with speed. The light pools, sloshes from the weight of it, then surface
// tension pulls it up into a trembling bead of mercury that firms into Maya. The glass springs back, and the
// light seeps back out along the same streams, decelerating as it climbs. Two heavy grey drops arrive late
// and roll in: each one lands on her with a little weight (she dips and rocks), soaks in, and her eye blinks.
export const meta = {
  title: 'Light runs downhill',
  idea: 'For a breath the token is the lowest point of the board: the glass sags there, and every bit of the board\'s light runs downhill into it in accelerating streams, pools and sloshes, then beads up like mercury, trembling, into Maya, nose east. The glass springs back, the light climbs back out along the same streams, and two heavy grey drops trundle in late; each one lands on her with a little weight, makes her dip and rock, and dims her eye for a blink (the 2 SPAM).',
  notes: 'Sound: a low glass hum dropping in pitch as the light drains, a liquid "glunk" as the pool fills, a rising wet chime as she beads up, a soft breath as the light returns, and two dull "plok"s for the grey drops. Port: the glass shader gets three uniforms (drain centre, pull, reach); the streams are one instanced mesh; several reboots at once split the streams between the tokens. Theo only dims and brightens with the board.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const RED = new THREE.Color(lab.bot('a').color);
  const WARM = new THREE.Color(lab.PALETTE.light);
  const GREY = new THREE.Color('#aab2bf');
  const TOK = lab.pos(3, 1);
  const EAST = facing(1);
  const maya = lab.puppet('a');
  const theoBot = lab.bot('b');

  // ---------- the glass: its painted light slides toward the drain, and goes dark from the edges in ----------
  const U = { tok: { value: new THREE.Vector2(TOK.x, TOK.z) }, pull: { value: 0 }, reach: { value: 99 }, soft: { value: 0.8 }, sag: { value: 0 }, floor: { value: 0 } };
  const top = arena.topMat;
  const prevCompile = top.onBeforeCompile;
  const prevKey = top.customProgramCacheKey;
  top.onBeforeCompile = (sh) => {
    sh.uniforms.uTok = U.tok;
    sh.uniforms.uPull = U.pull;
    sh.uniforms.uReach = U.reach;
    sh.uniforms.uSoft = U.soft;
    sh.uniforms.uSag = U.sag;
    sh.uniforms.uFloor = U.floor;
    sh.fragmentShader = sh.fragmentShader.replace(
      'void main() {',
      `uniform vec2 uTok; uniform float uPull, uReach, uSoft, uSag, uFloor;
void main() {`,
    ).replace(
      '#include <emissivemap_fragment>',
      `#ifdef USE_EMISSIVEMAP
  vec2 lp = vec2((vEmissiveMapUv.x - 0.5) * ${W.toFixed(1)}, (0.5 - vEmissiveMapUv.y) * ${H.toFixed(1)});
  vec2 ld = lp - uTok;
  float lr = length(ld);
  // the drain: the pattern is pulled toward it (more the further out), and the sag bends it like a lens
  float k = 1.0 + uPull * smoothstep(0.0, 2.5, lr) - uSag * exp(-lr * lr / 0.9);
  vec2 sp = uTok + ld * k;
  vec2 suv = vec2(sp.x / ${W.toFixed(1)} + 0.5, 0.5 - sp.y / ${H.toFixed(1)});
  float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
  vec4 emissiveColor = texture2D( emissiveMap, suv ) * inside;
  float mask = 1.0 - smoothstep(uReach - uSoft, uReach + 0.15, lr);
  totalEmissiveRadiance *= emissiveColor.rgb * max(mask, uFloor);
#endif`,
    );
  };
  top.customProgramCacheKey = () => 'lab-reboot-1a-drain';
  top.needsUpdate = true;
  // the room's light follows the board's (key, sky, the slab's edges, the spill on the floor)
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const spill0 = arena.spill.material.color.clone();
  const edges = new Set();
  arena.board.traverse((o) => {
    if (o.isMesh && Array.isArray(o.material)) for (const m of o.material) if (m.emissiveIntensity != null && m.emissiveIntensity > 0) edges.add(m);
  });
  const edge0 = new Map([...edges].map((m) => [m, m.emissiveIntensity]));
  lab.cleanup(() => {
    top.onBeforeCompile = prevCompile;
    top.customProgramCacheKey = prevKey;
    top.needsUpdate = true;
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.spill.material.color.copy(spill0);
    for (const [m, v] of edge0) m.emissiveIntensity = v;
  });
  let lit = 1; // the board's light, 0..1
  const stopRoom = lab.every(() => {
    arena.key.intensity = key0 * (0.28 + 0.72 * lit);
    arena.hemi.intensity = hemi0 * (0.3 + 0.7 * lit);
    arena.spill.material.color.copy(spill0).multiplyScalar(0.15 + 0.85 * lit);
    for (const [m, v] of edge0) m.emissiveIntensity = v * (0.25 + 0.75 * lit);
    // Theo's glow goes down and comes back with the board; nothing else of his changes
    const g = 0.3 + 0.7 * lit;
    theoBot.model.ringMat.opacity *= g;
    theoBot.model.poolMat.opacity *= g;
    theoBot.model.eyeMat.color.multiplyScalar(0.35 + 0.65 * lit);
    theoBot.model.paint.emissiveIntensity *= g;
  });

  // ---------- the streams: drops of the board's light running downhill to the drain ----------
  const streakTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    const g = c.getContext('2d');
    const gx = g.createLinearGradient(0, 0, 128, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)');
    gx.addColorStop(0.75, 'rgba(255,255,255,.55)');
    gx.addColorStop(0.92, 'rgba(255,255,255,1)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx;
    g.fillRect(0, 0, 128, 32);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, 32);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(0.5, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy;
    g.fillRect(0, 0, 128, 32);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const blobTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.7)');
    gr.addColorStop(0.65, 'rgba(255,255,255,.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // stream paths: from all round the board into the token, each bending the same way (water spirals into a drain)
  const half = { x: W / 2 - 0.12, z: H / 2 - 0.12 };
  const streams = [];
  const NS = 18;
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2 + lab.range(-0.12, 0.12);
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    // where the ray from the token meets the board's edge
    const tx = dx > 0 ? (half.x - TOK.x) / dx : dx < 0 ? (-half.x - TOK.x) / dx : 99;
    const tz = dz > 0 ? (half.z - TOK.z) / dz : dz < 0 ? (-half.z - TOK.z) / dz : 99;
    const len = Math.min(tx, tz) * lab.range(0.9, 1);
    const S = new THREE.Vector2(TOK.x + dx * len, TOK.z + dz * len);
    const T = new THREE.Vector2(TOK.x, TOK.z);
    const mid = S.clone().lerp(T, 0.5);
    const swirl = 0.16 * len * lab.range(0.6, 1.4);
    const C = mid.add(new THREE.Vector2(-dz, dx).multiplyScalar(swirl));
    streams.push({ S, C, T, len, mf: lab.range(7, 12), mp: lab.range(0, 6.3), ma: lab.range(0.05, 0.1) });
  }
  const bez = (st, s, out) => {
    const u = 1 - s;
    out.set(u * u * st.S.x + 2 * u * s * st.C.x + s * s * st.T.x, u * u * st.S.y + 2 * u * s * st.C.y + s * s * st.T.y);
    return out;
  };
  const bezD = (st, s, out) => {
    out.set(2 * (1 - s) * (st.C.x - st.S.x) + 2 * s * (st.T.x - st.C.x), 2 * (1 - s) * (st.C.y - st.S.y) + 2 * s * (st.T.y - st.C.y));
    return out;
  };
  const drops = [];
  for (const [j, st] of streams.entries()) {
    const n = 60;
    // drops come in little clumps, like beads of water running down a pane
    let s0 = lab.range(0, 0.05);
    for (let i = 0; i < n && s0 < 0.9; i++) {
      drops.push({ st, j, s0, side: lab.range(-0.03, 0.03), b: lab.range(0.6, 1.2) });
      s0 += lab.rand() < 0.65 ? lab.range(0.015, 0.03) : lab.range(0.08, 0.16);
    }
  }
  const dropGeo = new THREE.PlaneGeometry(1, 1);
  dropGeo.rotateX(-Math.PI / 2);
  const dropMat = new THREE.MeshBasicMaterial({ map: streakTex, color: new THREE.Color(1, 1, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, drops.length);
  dropMesh.renderOrder = 3;
  dropMesh.frustumCulled = false;
  lab.add(dropMesh);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const P = new THREE.Vector2();
  const D = new THREE.Vector2();

  // flow: 'in' with u (0..1, accelerating), or 'out' with v (0..1, decelerating)
  let mode = 'in';
  let u = 0;
  let v = 0;
  let arrived = 0;
  const placeDrops = () => {
    arrived = 0;
    for (const [i, d] of drops.entries()) {
      let s;
      let speed;
      let alpha;
      if (mode === 'in') {
        s = d.s0 + u * 1.15;
        speed = 1.15; // d s / d u
        alpha = Math.min(1, u * 5) * (s >= 1 ? 0 : 1) * Math.min(1, (1 - s) * 6);
        if (s >= 1) arrived++;
      } else {
        // the light slides back out to where it came from (it starts partway out, never bursting from her)
        // only the outer half of each stream carries light back: nothing leaves her body, the light just
        // slides back out to the edges it came from
        s = d.s0 + 0.28 * (1 - v);
        speed = 0.28;
        alpha = v <= 0 || d.s0 > 0.36 ? 0 : Math.min(1, v * 4) * Math.max(0, 1 - Math.max(0, v - 0.5) / 0.5) * Math.min(1, Math.max(0, (0.5 - s) / 0.2));
      }
      s = Math.min(1, Math.max(0, s));
      bez(d.st, s, P);
      bezD(d.st, s, D);
      const dl = D.length() || 1;
      const nx = -D.y / dl;
      const nz = D.x / dl;
      const narrow = 1 - s; // the streams narrow as they gather
      // the streams meander a little, like water finding its way across a pane
      const mea = d.side + d.st.ma * Math.sin(s * d.st.mf + d.st.mp) * narrow;
      dummy.position.set(P.x + nx * mea * narrow, 0.014, P.y + nz * mea * narrow);
      // pointing the way it moves: inward when draining, outward when seeping back
      const dir = mode === 'in' ? 1 : -1;
      dummy.rotation.set(0, Math.atan2(-D.y * dir, D.x * dir), 0);
      // stretched by speed: the faster a drop runs, the longer its streak
      const vel = mode === 'in' ? dl * speed * 3.4 * u : dl * speed * 1.6 * (1 - v);
      dummy.scale.set(0.1 + Math.min(0.34, vel * 0.14), 1, 0.045 + 0.02 * narrow);
      dummy.updateMatrix();
      dropMesh.setMatrixAt(i, dummy.matrix);
      // warm white, warming to her red as it nears the drain
      col.copy(WARM).lerp(RED, Math.max(0, s - 0.55) / 0.45 * (mode === 'in' ? 1 : 0.6)).multiplyScalar((mode === 'in' ? 0.95 : 0.3) * d.b * alpha);
      dropMesh.setColorAt(i, col);
    }
    dropMesh.instanceMatrix.needsUpdate = true;
    if (dropMesh.instanceColor) dropMesh.instanceColor.needsUpdate = true;
  };
  placeDrops();

  // ---------- the pool on the token ----------
  const poolMat = new THREE.MeshBasicMaterial({ map: blobTex, color: new THREE.Color(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(TOK.x, 0.016, TOK.z);
  pool.renderOrder = 3;
  lab.add(pool);
  const coreMat = poolMat.clone();
  const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.set(TOK.x, 0.018, TOK.z);
  core.renderOrder = 3;
  lab.add(core);
  let fill = 0; // how much light has gathered (0..1)
  let slosh = 0; // the pool rocking with the weight that just arrived
  let sloshV = 0;
  let poolGone = 0; // 1 when it has all gone up into her
  let lastArrived = 0;
  const totalDrops = drops.length;
  const stopPool = lab.every((dt) => {
    // each arriving drop shoves the pool (a damped spring): it sloshes
    const newly = mode === 'in' ? Math.max(0, arrived - lastArrived) : 0;
    lastArrived = arrived;
    sloshV += newly * 0.09 - slosh * 260 * dt - sloshV * 9 * dt;
    slosh += sloshV * dt;
    const f = fill * (1 - poolGone);
    const r = 0.16 + 0.36 * Math.sqrt(fill) * (1 - 0.75 * poolGone);
    const sl = Math.max(-0.3, Math.min(0.3, slosh));
    pool.scale.set(r * 2 * (1 + sl), r * 2 * (1 - sl * 0.7), 1);
    core.scale.set(r * 0.9 * (1 - sl * 0.6), r * 0.9 * (1 + sl), 1);
    const warm = Math.min(1, fill * 1.3);
    poolMat.color.copy(WARM).lerp(RED, warm).multiplyScalar(0.85 * f);
    coreMat.color.copy(WARM).lerp(RED, warm * 0.6).multiplyScalar(1.5 * f);
  });

  // ---------- Maya ----------
  maya.set({ x: 3, y: 1, rot: EAST, visible: false, trail: false, sx: 1, sy: 1, sz: 1 });
  let molten = 0; // how much she is still liquid light
  let eye = 0; // her eye, 0..1
  let eyeGrey = 0;
  let ring = 0;
  const tagBase = maya.bot.tag ? maya.bot.tag.scale.clone() : null;
  let eyeMesh = null;
  maya.model.body.traverse((o) => {
    if (o.isMesh && o.material === maya.model.eyeMat) eyeMesh = o;
  });
  lab.cleanup(() => eyeMesh && (eyeMesh.visible = true));
  maya.each = (m) => {
    const q = maya.pose;
    m.paint.emissive.copy(RED);
    m.paint.emissiveIntensity = 0.16 + 0.8 * molten;
    if (eyeMesh) eyeMesh.visible = eye > 0.02;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(new THREE.Color(0.55, 0.58, 0.62), eyeGrey).multiplyScalar(eye);
    m.ringMat.opacity = 0.9 * ring;
    m.poolMat.opacity = 0.75 * Math.max(ring, molten * 0.8);
    if (maya.bot.tag) {
      maya.bot.tag.visible = ring > 0.5;
      if (tagBase) maya.bot.tag.scale.set(tagBase.x / q.sx, tagBase.y / q.sy, 1);
    }
  };

  // ---------- 1. the drain (0.9 s): the light runs downhill, faster and faster ----------
  await lab.tween(0.9, (e, k) => {
    u = e;
    U.pull.value = 2.6 * e;
    U.sag.value = 0.32 * ease.out(k);
    U.reach.value = 0.55 + 7.5 * (1 - e);
    U.soft.value = 1.4;
    lit = 1 - 0.85 * ease.inOut(Math.min(1, k * 1.25));
    placeDrops();
    fill = Math.min(1, arrived / totalDrops);
  }, ease.in);
  fill = 1;
  mode = 'out';
  v = 0;
  placeDrops();

  // ---------- 2. bead-up (0.6 s): surface tension gathers the pool into a trembling bead, then into her ----------
  maya.set({ visible: true, sy: 0.08, sx: 1.2, sz: 1.2 });
  molten = 1;
  const tB = lab.t;
  await lab.tween(0.62, (e, k) => {
    const a = lab.t - tB;
    // gather: the puddle pulls in (quick), then a damped jelly bounce on the way up
    const gather = ease.out3(Math.min(1, k * 1.6));
    const sy = 1 - 0.92 * Math.exp(-a * 7.5) * Math.cos(a * 13.5);
    const wide = 1 + 0.2 * (1 - gather);
    const sxz = wide * Math.min(1.12, Math.max(0.88, 1 / Math.sqrt(Math.max(0.3, sy))));
    // a tremble in the mercury: she shivers sideways as she firms up
    const tremble = 0.06 * Math.exp(-a * 6) * Math.sin(a * 41);
    maya.set({ sy: Math.max(0.06, sy * (0.25 + 0.75 * gather)), sx: sxz * (1 + tremble), sz: sxz * (1 - tremble), roll: tremble * 0.6 });
    poolGone = gather;
    molten = Math.max(0, 1 - k * 1.25);
    // the glass springs back from the weight, overshooting into a little bulge before it settles
    U.sag.value = 0.32 * Math.exp(-a * 5) * Math.cos(a * 11);
    // her eye catches at the end: a flicker, then on
    eye = k < 0.6 ? 0 : k < 0.68 ? 0.8 : k < 0.74 ? 0.15 : 1;
    ring = Math.max(0, (k - 0.55) / 0.45);
  }, ease.linear);
  maya.set({ sx: 1, sy: 1, sz: 1, roll: 0 });
  molten = 0;
  eye = 1;
  ring = 1;
  poolGone = 1;
  stopPool();
  pool.visible = false;
  core.visible = false;

  // ---------- 3. the light seeps back out along the same streams, slowing as it climbs ----------
  // two heavy grey drops come late, along two of the streams, rolling and wobbling
  const greyMat = new THREE.MeshBasicMaterial({ map: blobTex, color: GREY.clone().multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const greyBodyMat = new THREE.MeshPhysicalMaterial({ color: 0x8a919c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x6b7280, emissiveIntensity: 0.6 });
  const makeGrey = () => {
    const g = new THREE.Group();
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), greyBodyMat);
    bead.position.y = 0.085;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), greyMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    g.add(bead, glow);
    g.visible = false;
    lab.add(g);
    return { g, bead };
  };
  const greys = [makeGrey(), makeGrey()];
  // drop 1 along a stream from the west, drop 2 from the south-east (it hesitates at the end)
  const pick = (ang) => streams.reduce((best, st) => {
    const a = Math.atan2(st.S.y - TOK.z, st.S.x - TOK.x);
    const diff = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
    return !best || diff < best.diff ? { st, diff } : best;
  }, null).st;
  const gStreams = [pick(Math.PI), pick(0.35)];
  let rock = { pitch: 0, roll: 0 };
  let sink = 0;
  const hit = (st) => {
    // a drop lands on her: she dips under its weight and rocks away from where it came from
    bezD(st, 1, D);
    const dx = D.x;
    const dz = D.y;
    const l = Math.hypot(dx, dz) || 1;
    // she faces east (+x): moving +x pushes her nose down (pitch +), moving +z pushes her right side down (roll -)
    const t0 = lab.t;
    const kick = { px: (dx / l) * 0.2, rz: -(dz / l) * 0.2 };
    const stop = lab.every((dt, t) => {
      const a = t - t0;
      if (a > 0.6) return stop();
      const w = Math.exp(-a * 8) * Math.sin(a * 24);
      rock = { pitch: kick.px * w, roll: kick.rz * w };
      sink = 0.12 * Math.exp(-a * 10) * Math.cos(a * 20);
      eyeGrey = Math.max(0, Math.sin(Math.min(1, a / 0.34) * Math.PI));
      eye = 1 - 0.8 * eyeGrey;
    });
  };
  const rollGrey = async (gi, delay, dur, hesitate) => {
    await lab.wait(delay);
    const { g, bead } = greys[gi];
    const st = gStreams[gi];
    g.visible = true;
    const from = 0.45;
    await lab.tween(dur, (e, k) => {
      // it rolls, heavy; the second one dawdles at the brink, then tips in
      let s = from + (1 - from) * e;
      if (hesitate) {
        const h = Math.min(1, k / 0.7);
        s = k < 0.7 ? from + (0.86 - from) * ease.out(h) : 0.86 + 0.14 * ease.in((k - 0.7) / 0.3);
      }
      bez(st, s, P);
      g.position.set(P.x, 0, P.y);
      const wob = Math.sin(k * 30) * 0.12;
      bead.scale.set(1 + wob, 1 - wob, 1 + wob);
      // it soaks into her as it arrives
      const soak = Math.max(0, (s - 0.92) / 0.08);
      g.scale.setScalar(1 - soak * 0.9);
      greyMat.opacity = 1 - soak;
    }, ease.in);
    g.visible = false;
    hit(st);
  };
  const greyDone = Promise.all([rollGrey(0, 0.12, 0.42, false), rollGrey(1, 0.26, 0.56, true)]);
  const stopMaya = lab.every(() => {
    maya.set({ pitch: rock.pitch, roll: rock.roll, sy: 1 - sink, sx: 1 + sink * 0.5, sz: 1 + sink * 0.5 });
  });
  await lab.tween(0.72, (e, k) => {
    v = e;
    U.pull.value = 2.6 * (1 - e);
    U.sag.value = 0;
    U.floor.value = ease.inOut(k) ** 1.3; // the glass lights again all over, evenly: no ring from her
    lit = 0.15 + 0.85 * ease.inOut(k);
    placeDrops();
  }, ease.out);
  U.reach.value = 99;
  U.pull.value = 0;
  lit = 1;
  v = 1;
  placeDrops();
  dropMesh.visible = false;
  await greyDone;
  await lab.wait(0.22);
  stopMaya();
  stopRoom();
  if (eyeMesh) eyeMesh.visible = true;
  maya.set({ pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1 });
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
}
