// Wall, idea 4 "Prism", animator c (cinematic & graphic staging).
export const meta = {
  title: 'Prism (house lights down)',
  idea:
    'Maya meets the fin and the house lights go down, like a theatre before the show. The warm white of her eye pours into the fin in ' +
    'one thread of light; the fin flares; and out of its far side a soft fan of spectrum opens across the dark glass over the spaces she ' +
    'never reached, while the camera rises a little to look down on it like sunlight on a table. A held breath. Then the fan folds shut ' +
    'like a hand fan into one white line, the line slides back into the fin, her eye lights again and the room comes back up.',
  notes:
    'Sound: the glass hum of the room dropping a fifth as the lights go down, one long soft chord that opens with the fan (each colour ' +
    'a voice), and a single clean "fwip" as it folds, then the room tone back. The only rainbow in the game, so it stays soft (a wash, ' +
    'not a beam) and the dimming stays gentle: the board never quite goes dark, Ava keeps her ring. Light is conserved for the eye: ' +
    'what leaves her eye is what comes back. Porting: the fan is one polar mesh with vertex colours, rebuilt each frame (64 x 24).',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  lab.playCard('a', ['m3']);

  // ---------- the fin ----------
  const C = lab.pos(3.5, 1);
  let finG = null;
  arena.board.traverse((o) => {
    if (o.isGroup && o.children.length === 2 && Math.abs(o.position.x - C.x) < 0.05 && Math.abs(o.position.z - C.z) < 0.05) finG = o;
  });
  const [fin, cap] = finG ? finG.children : [null, null];
  const finMat0 = fin?.material;
  const capMat0 = cap?.material;
  const finMat = finMat0?.clone();
  const capMat = capMat0?.clone();
  if (fin) fin.material = finMat;
  if (cap) cap.material = capMat;
  const capBase = capMat?.color.clone();
  const finEI = finMat?.emissiveIntensity ?? 0.12;
  lab.cleanup(() => {
    if (fin) fin.material = finMat0;
    if (cap) cap.material = capMat0;
  });
  const S = { room: 0, pour: 0, eye: 1, flare: 0, open: 0, radius: 0, fold: 0, gain: 0, shimmer: 0 };
  const setFin = () => {
    if (finMat) {
      finMat.emissive.set('#fff3e0');
      finMat.emissiveIntensity = finEI + 2.4 * S.flare;
    }
    if (capMat) capMat.color.copy(capBase).multiplyScalar(1 + 1.6 * S.flare);
  };

  // ---------- the house lights ----------
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const spill0 = arena.spill.material.opacity;
  const ava = lab.bot('b');
  const roomHook = lab.every(() => {
    const d = S.room;
    arena.topMat.emissiveIntensity *= 1 - 0.72 * d;
    arena.key.intensity = key0 * (1 - 0.62 * d);
    arena.hemi.intensity = hemi0 * (1 - 0.6 * d);
    arena.spill.material.opacity = spill0 * (1 - 0.8 * d);
    if (ava) ava.model.poolMat.opacity *= 1 - 0.5 * d;
    setFin();
  });
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.spill.material.opacity = spill0;
  });

  // ---------- the thread of light from her eye into the fin ----------
  const warm = new THREE.Color('#fff1dc');
  const threadMat = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 1, 12, 1, true), threadMat);
  thread.rotation.z = Math.PI / 2; // along x
  lab.add(thread);
  const eyeAt = new THREE.Vector3();

  // ---------- the fan of spectrum on the glass ----------
  const NA = 64;
  const NR = 24;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((NA + 1) * (NR + 1) * 3);
  const col = new Float32Array((NA + 1) * (NR + 1) * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = [];
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j;
      const b = a + NA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  geo.setIndex(idx);
  const fanMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  fanMesh.frustumCulled = false;
  fanMesh.renderOrder = 4;
  lab.add(fanMesh);
  const O = new THREE.Vector3(C.x + 0.03, 0.012, C.z); // where the light leaves the fin
  const hue = new THREE.Color();
  const white = new THREE.Color(1, 0.97, 0.92);
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const drawFan = (t) => {
    const A = 0.028 + 0.6 * S.open * (1 - S.fold); // half-angle (radians)
    const Rm = Math.max(0.001, S.radius);
    const conserve = Math.min(2.6, 0.4 / Math.max(0.12, A)); // a narrow fan is a brighter one
    const sat = (1 - S.fold) ** 1.5;
    for (let i = 0; i <= NR; i++) {
      const rr = i / NR;
      const r = rr * Rm;
      // soft from the fin out to the far edge; whitest close to the fin, where the colours still overlap
      const radial = smooth(0, 0.18, r) * (1 - smooth(0.3, 1, rr)) * Math.exp(-r * 0.3);
      const sep = smooth(0.05, 0.9, r);
      for (let j = 0; j <= NA; j++) {
        const v = (j / NA) * 2 - 1; // -1 (north, red) .. +1 (south, violet)
        const ang = v * A + Math.sin(t * 1.3 + v * 2) * 0.01 * S.shimmer;
        const k = (i * (NA + 1) + j) * 3;
        pos[k] = O.x + Math.cos(ang) * r;
        pos[k + 1] = O.y;
        pos[k + 2] = O.z + Math.sin(ang) * r;
        const edge = 1 - smooth(0.45, 1, Math.abs(v));
        const breathe = 1 + 0.06 * Math.sin(t * 2.1 + v * 3 + rr * 4) * S.shimmer;
        hue.setHSL(Math.max(0, Math.min(0.78, ((v + 1) / 2) * 0.8 - 0.01)), 1, 0.55);
        const m = sat * sep;
        const I = S.gain * radial * edge * breathe * conserve * 1.3;
        col[k] = (white.r + (hue.r - white.r) * m) * I;
        col[k + 1] = (white.g + (hue.g - white.g) * m) * I;
        col[k + 2] = (white.b + (hue.b - white.b) * m) * I;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  const fanHook = lab.every((dt, t) => drawFan(t));

  // ---------- the camera rises a little to look down on the fan ----------
  const cv = { k: 0 };
  const sx0 = arena.camCur?.sx ?? 0;
  const sy0 = arena.camCur?.sy ?? 0;
  const keepFrame = lab.every(() => {
    const c = arena.camCur;
    if (!c) return;
    const k = Math.min(0.9, arena.dt * 4);
    c.sx = sx0 / (1 - k);
    c.sy = sy0 / (1 - k);
  });
  const look = lab.pos(4.6, 1);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(look, 0.45 * cv.k),
    dist: home.dist * (1 - 0.16 * cv.k),
    el: home.el + 0.13 * cv.k,
    az: -0.03 * cv.k,
  }));

  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * S.eye, 3.1 * S.eye, 2.9 * S.eye);
    m.muzzle.getWorldPosition(eyeAt);
    // the thread runs from her eye to the fin's face, as far as it has poured
    const x0 = eyeAt.x - 0.05;
    const x1 = C.x;
    const len = Math.max(0.001, (x1 - x0) * Math.min(1, S.pour));
    thread.position.set(x0 + len / 2, eyeAt.y, C.z);
    thread.scale.set(1, len, 1);
    threadMat.opacity = Math.min(1, S.pour) * (1 - S.fold * 0.0) * (S.pour > 1 ? 2 - S.pour : 1);
  };

  // ---------- 1. Move 3 at full speed, cut off by the fin ----------
  const E = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const tHit = 0.592;
  await lab.tween(0.9 * tHit, (e, k) => maya.set({ x: 1 + 3 * E(k * tHit), pitch: 0.12 * k }), ease.linear);
  // tink: the smallest nod
  await lab.tween(0.12, (e, k) => maya.set({ pitch: 0.12 + 0.06 * Math.sin(k * Math.PI) - 0.12 * k }), ease.linear);

  // ---------- 2. house lights down; her light pours into the fin; the fin flares ----------
  lab.tween(0.35, (e) => (S.room = e), ease.inOut);
  lab.tween(0.5, (e) => (cv.k = e), ease.inOut);
  await lab.tween(
    0.2,
    (e) => {
      S.pour = e;
      S.eye = 1 - 0.65 * e;
      S.flare = e;
    },
    ease.in,
  );

  // ---------- 3. the fan opens over the spaces she never reached ----------
  lab.tween(0.25, (e) => (S.flare = 1 - 0.6 * e), ease.out);
  await lab.tween(
    0.42,
    (e, k) => {
      S.open = e;
      S.radius = 0.3 + 2.75 * ease.out3(k);
      S.gain = Math.min(1, k * 2.5);
      S.shimmer = k;
    },
    ease.outBack,
  );

  // ---------- 4. a held breath ----------
  await lab.wait(0.36);

  // ---------- 5. it folds shut like a hand fan, into one white line ----------
  await lab.tween(0.26, (e) => (S.fold = e), ease.in3);
  // a beat as a line ... then it slides back into the fin; her eye lights again
  await lab.wait(0.06);
  lab.tween(0.42, (e) => (cv.k = 1 - e), ease.inOut);
  await lab.tween(
    0.16,
    (e) => {
      S.radius = 3.05 * (1 - e);
      S.gain = 1 - 0.3 * e;
      S.flare = 0.4 + 0.8 * Math.sin(e * Math.PI * 0.5);
      S.pour = 1 + e; // the thread goes out
    },
    ease.in,
  );
  S.gain = 0;
  lab.tween(0.3, (e) => (S.room = 1 - e), ease.inOut);
  await lab.tween(
    0.26,
    (e) => {
      S.eye = 0.35 + 0.75 * e - 0.1 * Math.max(0, e - 0.6) * 2.5;
      S.flare = 1.2 * (1 - e);
    },
    ease.out,
  );

  // ---------- home ----------
  S.room = 0;
  S.flare = 0;
  S.eye = 1;
  setFin();
  fanHook();
  fanMesh.visible = false;
  thread.visible = false;
  cv.k = 0;
  releaseCam();
  keepFrame();
  roomHook();
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.spill.material.opacity = spill0;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
