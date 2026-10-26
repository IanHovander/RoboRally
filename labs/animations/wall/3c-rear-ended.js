// Wall, idea 3 "Rear-ended by her own trail", animator c (cinematic & graphic staging).
export const meta = {
  title: 'Rear-ended (impact frame)',
  idea:
    'Maya stops dead at the fin: tink. Her trail has not heard. A heartbeat later its light is still pouring forward, then its tail lets go ' +
    'and cracks up the line like a whip, squeezing into one hot slug of light. On the slap the picture cuts to an impact frame: for three ' +
    'frames the room goes black and only light is left, the camera punches in, and she is shoved into the fin a second time: tink. The ' +
    'spent light drops behind her in a crumpled heap and goes out, and she glances back at it over her shoulder.',
  notes:
    'Sound: tink (tiny, high) ... a rising zip as the tail whips ... a soft glassy slap with the second tink right on top of it, then a ' +
    'faint fizz as the heap goes out. The impact frame is the comic-book trick played in Lumen\'s own terms: the room\'s light, not ink, ' +
    'drops out, so it stays calm but lands the beat. The trail is drawn by hand here (a ribbon like updateTrail\'s) so it can move on ' +
    'its own; porting means letting the game\'s trail points keep their momentum for a beat after a blocked move.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const color = new THREE.Color(maya.bot.color);
  lab.playCard('a', ['m3']);
  maya.set({ trail: false });

  // ---------- the ribbon of light (her trail, drawn by hand) ----------
  const N = 72;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  const uv = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.35)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(0.7, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ribbon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 3;
  lab.add(ribbon);

  // the ribbon's state: from tail to head along row 1 (space x), plus how it moves
  const R = {
    tail: 1, // space x of its tail
    head: 1, // space x of its head (under her)
    gain: 1.9, // overall brightness
    width: 0.2, // half width
    wave: 0, // the whip's sideways wave: amplitude
    phase: 0, // and where along the ribbon it is (0 tail .. 1 head)
    flow: 0, // light still pouring forward inside it (a moving shimmer)
    crumple: 0, // 0 a straight line .. 1 a crumpled heap on (2,1)
    sink: 0, // the heap going out
  };
  const cx = new Float32Array(N);
  const cz = new Float32Array(N);
  const drawRibbon = (t) => {
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    const L = Math.max(0.001, R.head - R.tail);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1); // 0 tail .. 1 head
      let x = R.tail + L * u;
      let z = 0;
      // the whip: a sideways S travelling toward the head, growing as it goes
      if (R.wave) {
        const d = u - R.phase;
        z += R.wave * Math.exp(-(d * d) / 0.02) * Math.sin(d * 28) * (0.4 + u);
      }
      // the crumple: folds like a dropped ribbon, heaped on the space behind her
      if (R.crumple) {
        const c = R.crumple;
        // loose loops, like a dropped ribbon
        const a = u * Math.PI * 2 * 3.2;
        const hx = 2.1 + (u - 0.5) * 0.66 - 0.15 * Math.sin(a);
        const hz = 0.15 * Math.cos(a) - 0.15 + 0.03 * Math.sin(u * 9);
        x = x + (hx - x) * c;
        z = z + (hz - z) * c;
      }
      const p = lab.pos(x, 1 + z);
      cx[i] = p.x;
      cz[i] = p.z;
    }
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const a = Math.max(0, i - 1);
      const b = Math.min(N - 1, i + 1);
      let tx = cx[b] - cx[a];
      let tz = cz[b] - cz[a];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const w = R.width * (0.35 + 0.65 * Math.min(1, u * 3)) * (1 - 0.62 * R.crumple);
      pos.set([cx[i] - tz * w, 0.009, cz[i] + tx * w, cx[i] + tz * w, 0.009, cz[i] - tx * w], i * 6);
      // newest light brightest, like Lumen's own trail; the flow shimmers forward inside it
      let k = R.gain * (0.3 + 0.7 * u ** 1.2);
      if (R.flow) k *= 1 + R.flow * 2.2 * Math.max(0, Math.sin((u * 3 - t * 7) * Math.PI)) ** 4;
      k *= 1 - R.sink;
      col.set([color.r * k, color.g * k, color.b * k, color.r * k, color.g * k, color.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  const ribbonHook = lab.every((dt, t) => drawRibbon(t));

  // ---------- the camera: a punch-in on the slap ----------
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
  const focus = lab.pos(2.7, 1);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(focus, 0.5 * cv.k),
    dist: home.dist * (1 - 0.2 * cv.k),
  }));

  // ---------- the impact frame: the room's light drops out, only light is left ----------
  const dark = { k: 0 };
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const spill0 = arena.spill.material.opacity;
  const darkHook = lab.every(() => {
    arena.topMat.emissiveIntensity *= 1 - 0.93 * dark.k;
    arena.key.intensity = key0 * (1 - 0.92 * dark.k);
    arena.hemi.intensity = hemi0 * (1 - 0.92 * dark.k);
    arena.spill.material.opacity = spill0 * (1 - dark.k);
  });
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.spill.material.opacity = spill0;
  });

  // the fin's bright edge answers each tink
  const C = lab.pos(3.5, 1);
  let cap = null;
  arena.board.traverse((o) => {
    if (o.isGroup && o.children.length === 2 && Math.abs(o.position.x - C.x) < 0.05 && Math.abs(o.position.z - C.z) < 0.05) cap = o.children[1];
  });
  const capMat0 = cap?.material;
  const capMat = capMat0?.clone();
  if (cap) cap.material = capMat;
  const capBase = capMat?.color.clone();
  lab.cleanup(() => cap && (cap.material = capMat0));
  const tink = (amt) => {
    if (!capMat) return;
    lab.tween(0.35, (e) => capMat.color.copy(capBase).multiplyScalar(1 + amt * (1 - e)), ease.out);
  };

  // ---------- 1. Move 3 at full speed, cut off by the fin ----------
  const E = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const tHit = 0.592;
  await lab.tween(
    0.9 * tHit,
    (e, k) => {
      const x = 1 + 3 * E(k * tHit);
      maya.set({ x, pitch: 0.12 * k });
      R.head = x;
    },
    ease.linear,
  );
  // stopped dead: tink (small)
  tink(1.2);
  await lab.tween(0.12, (e, k) => maya.set({ pitch: 0.12 + 0.08 * Math.sin(k * Math.PI) - 0.12 * k }), ease.linear);

  // ---------- 2. a heartbeat: the light in the trail is still pouring forward ----------
  R.flow = 0;
  await lab.tween(
    0.22,
    (e) => {
      R.flow = e;
      R.head = 3 - 0.5 * e; // its end shows at her back
    },
    ease.in,
  );

  // ---------- 3. the tail lets go and whips up the line, squeezing into a hot slug ----------
  const tail0 = R.tail;
  await lab.tween(
    0.2,
    (e, k) => {
      R.tail = tail0 + (2.02 - tail0) * e;
      const L = R.head - R.tail;
      R.gain = Math.min(2.8, 2.1 / Math.max(0.3, L) ** 0.9);
      R.width = 0.2 + 0.12 * k;
      R.wave = 0.22 * Math.sin(k * Math.PI);
      R.phase = k;
      R.flow = 1 - k;
    },
    ease.in3,
  );

  // ---------- 4. SLAP: the impact frame ----------
  R.wave = 0;
  dark.k = 1;
  cv.k = 1;
  tink(2.4);
  lab.timeScale = 0.04;
  await lab.waitReal(0.1);
  lab.timeScale = 1;
  dark.k = 0;
  // shoved into the fin again: a lurch forward and a nod, tink
  lab.tween(0.5, (e) => (cv.k = 1 - e), ease.inOut);
  await lab.tween(
    0.16,
    (e, k) => {
      maya.set({ x: 3 + 0.05 * Math.sin(k * Math.PI), pitch: 0.2 * Math.sin(k * Math.PI), sy: 1 - 0.06 * Math.sin(k * Math.PI) });
      R.head = 2.5 + 0.16 * Math.sin(k * Math.PI);
      R.tail = 2.02 + 0.1 * Math.sin(k * Math.PI);
    },
    ease.linear,
  );

  // ---------- 5. the spent light drops in a heap behind her; she glances back at it ----------
  lab.tween(0.28, (e) => (R.crumple = e), ease.out3);
  lab.tween(0.5, (e) => (R.gain = 1.7 * (1 - 0.4 * e)), ease.out);
  await lab.tween(
    0.26,
    (e) => maya.set({ rot: facing(1) - 0.8 * e, pitch: -0.04 * e }),
    ease.out3,
  );
  lab.tween(0.5, (e) => (R.sink = e), ease.in);
  await lab.wait(0.16);
  await lab.tween(0.22, (e) => maya.set({ rot: facing(1) - 0.8 * (1 - e), pitch: -0.04 * (1 - e) }), ease.inOut);
  await lab.wait(0.14);

  // ---------- home ----------
  R.sink = 1;
  drawRibbon(lab.t);
  ribbonHook();
  ribbon.visible = false;
  cv.k = 0;
  releaseCam();
  keepFrame();
  darkHook();
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.spill.material.opacity = spill0;
  maya.release({ x: 3, y: 1, d: 1 });
}
