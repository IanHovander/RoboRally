// Prism, played as character acting: Maya's eye light pours into the fin and comes out the far side as a fan of
// colour. She is enchanted, discovers the rainbow follows her gaze, and sweeps it across the board like a child
// with a torch. It washes over Ava, who is thrilled. Then the fan folds shut into one white line and goes out.
export const meta = {
  title: 'Prism (the torch)',
  idea:
    'Maya bonks the fin and her eye light pours into it: her eye goes dim, the fin flares, and on the far side a soft fan of spectrum opens across the glass over the spaces she never reached. She rears back, amazed. She tilts her head and the fan tilts with her; she realises the rainbow follows her gaze and, delighted, sweeps it slowly across the board until it washes over Ava, who lights up in colour, looks down at herself and does a happy little twirl. Maya looks back to the wall, the fan folds shut like a hand fan into one white line and goes out, and her eye light comes home. A contented sigh.',
  notes:
    'Sound: a soft glass tink, then a rising, airy shimmer as the fan opens (a glass harmonica chord, one note per colour), detuning gently as she sweeps it, and a quiet fan-snap as it folds. The fan is one vertex-coloured mesh on the glass (additive, dimmer at the board edge so no colour spills over the void); its colours sum to white as it folds. The only rainbow in the game; everything is back to Lumen within the beat.',
};

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => {
  const x = clamp01(k);
  return x * x * (3 - 2 * x);
};
/** 0 outside [a, b], a smooth hump of height 1 inside */
const hump = (k, a, b) => (k <= a || k >= b ? 0 : Math.sin(((k - a) / (b - a)) * Math.PI));

/** A timeline on absolute seconds from the start, so sequential steps never drift. */
function timeline(lab) {
  const T0 = lab.t;
  const now = () => lab.t - T0;
  const span = (a, b, fn, easing = lab.ease.inOut) =>
    new Promise((ok) => {
      const stop = lab.every(() => {
        const t = now();
        if (t < a) return;
        const k = b <= a ? 1 : Math.min(1, (t - a) / (b - a));
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });
  const until = (T) => lab.wait(Math.max(0, T - now()));
  return { now, span, until };
}

/** The fan of colour: a sector on the glass, rebuilt every frame from { aim, half, open, fold, reach, power }. */
function makeFan(THREE, apex, board) {
  const A = 48; // across
  const R = 18; // along
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A * R * 3);
  const col = new Float32Array(A * R * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = [];
  for (let i = 0; i < A - 1; i++)
    for (let j = 0; j < R - 1; j++) {
      const a = i * R + j;
      idx.push(a, a + R, a + 1, a + 1, a + R, a + R + 1);
    }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  const c = new THREE.Color();
  const white = new THREE.Color(1, 0.97, 0.9);
  mesh.userData.update = ({ aim, half, open, reach, power }) => {
    for (let i = 0; i < A; i++) {
      const u = i / (A - 1);
      // a hand fan opens from its closed edge: the ribs slide out across the angle
      const ang = aim - half + 2 * half * open * u;
      const side = Math.min(u, 1 - u);
      const edge = smooth(side / 0.12); // soft angular edges
      c.setHSL(0.83 * u, 0.9, 0.58); // red ... violet
      const split = clamp01(open * 1.25); // folded shut, the colours add back up to white
      for (let j = 0; j < R; j++) {
        const v = j / (R - 1);
        const r = v * reach;
        const x = apex.x + Math.cos(ang) * r;
        const z = apex.z + Math.sin(ang) * r;
        const k = (i * R + j) * 3;
        pos[k] = x;
        pos[k + 1] = 0.012;
        pos[k + 2] = z;
        // brightest a little way out, fading to nothing at the far end; white close to the fin
        const along = smooth(v / 0.12) * (1 - smooth((v - 0.45) / 0.55)) * 0.85 + 0.12 * (1 - v);
        const inside = smooth((board.x1 - x) / 0.35) * smooth((board.z1 - Math.abs(z - board.zc)) / 0.35);
        const mixW = Math.max(1 - split, 1 - smooth(v / 0.25));
        const w = power * along * inside * lerp(edge, 1, 1 - split) * (0.6 + 0.4 * split);
        col[k] = lerp(c.r, white.r, mixW) * w;
        col[k + 1] = lerp(c.g, white.g, mixW) * w;
        col[k + 2] = lerp(c.b, white.b, mixW) * w;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return mesh;
}

export default async function play(lab) {
  const { ease, THREE } = lab;
  const { span, until } = timeline(lab);
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');

  const fx = lab.scenario.beats[0];
  const move = fx.find((f) => f.k === 'move');
  const cardId = fx.find((f) => f.k === 'play')?.cards?.[0] ?? 'm3';
  const start = move.path[0];
  const [ex, ey] = move.path[move.path.length - 1];
  const sc = lab.scenario;
  const W = sc.grid[0].split(' ').length;
  const H = sc.grid.length;

  // the fin in front of her
  const apex = lab.pos(ex + 0.5, ey);
  const fin = lab.arena.board.children.find((o) => o.isGroup && o.children.length === 2 && Math.hypot(o.position.x - apex.x, o.position.z - apex.z) < 0.05);
  const finMat = fin?.children[0].material;
  const capMat = fin?.children[1].material;
  const finGlow0 = finMat?.emissiveIntensity ?? 0.12;
  const cap0 = capMat?.color.clone();
  const finLight = (glow, cap) => {
    if (finMat) finMat.emissiveIntensity = glow;
    if (capMat && cap0) capMat.color.copy(cap0).multiplyScalar(cap);
  };
  lab.cleanup(() => finLight(finGlow0, 1));

  // the fan, just past the fin
  const fanAt = apex.clone().add(new THREE.Vector3(0.03, 0, 0));
  const fan = lab.add(makeFan(THREE, fanAt, { x1: W / 2, z1: H / 2, zc: 0 }));
  const F = { aim: 0, half: 0.62, open: 0, reach: 0, power: 0 };
  fan.visible = false;

  // eyes and paint, driven by the acting
  const face = { eye: 1 };
  maya.each = (m) => m.eyeMat.color.setRGB(3.2 * face.eye, 3.1 * face.eye, 2.9 * face.eye);
  const avaFace = { eye: 1, wash: 0, hue: 0 };
  const tint = new THREE.Color();
  ava.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * avaFace.eye, 3.1 * avaFace.eye, 2.9 * avaFace.eye);
    if (avaFace.wash > 0.01) {
      tint.setHSL(avaFace.hue, 1, 0.6);
      m.paint.emissive.lerp(tint, avaFace.wash);
      m.paint.emissiveIntensity = 0.16 + 0.7 * avaFace.wash;
    }
  };

  const rot0 = maya.pose.rot; // east
  const avaRot0 = ava.pose.rot;
  const avaAt = { x: ava.pose.x, y: ava.pose.y };
  const lookFrom = (x, y) => avaRot0 + wrap(Math.atan2(-(x - avaAt.x), -(y - avaAt.y)) - avaRot0);
  const avaToMaya = lookFrom(ex, ey);
  // where Ava is, seen from the fin (angle on the glass: 0 = east, + = toward us)
  const avaW = lab.pos(avaAt.x, avaAt.y);
  const avaAng = Math.atan2(avaW.z - fanAt.z, avaW.x - fanAt.x);

  // the beats
  const T_GO = 0.08;
  const T_HIT = 0.5;
  const T_POUR = 0.62; // her light goes into the fin
  const T_FAN = 0.78; // and comes out in colour
  const T_TILT = 1.06; // she tilts her head: the fan tilts
  const T_SWEEP = 1.3; // she sweeps it over Ava
  const T_HOME = 1.74; // back to the wall
  const T_FOLD = 1.92; // the fan folds shut
  const T_OUT = 2.14;
  const T_END = 2.36;

  lab.playCard('a', [cardId]);

  // her gaze (yaw offset from east, + = left/north) aims the fan: light goes where she looks
  const gaze = { yaw: 0 };
  const aimOf = () => -gaze.yaw; // on the glass, + angle is toward us (south): a right turn

  // ----- the fan -----
  const fanShow = (async () => {
    await until(T_FAN);
    fan.visible = true;
    // opens like a hand fan: the light runs out across the glass, the ribs spread
    await span(T_FAN, T_FAN + 0.32, (e, k) => {
      F.reach = 2.8 * ease.out(clamp01(k * 1.4));
      F.open = ease.outBack(clamp01((k - 0.15) / 0.85));
      F.power = 0.6 * clamp01(k * 2.5);
      F.aim = aimOf();
      fan.userData.update(F);
    }, ease.linear);
    // it holds while she plays with it, breathing a little
    await span(T_FAN + 0.32, T_FOLD, (e, k) => {
      F.aim = aimOf();
      F.open = 1 + 0.03 * Math.sin(k * TAU * 1.5);
      fan.userData.update(F);
    }, ease.linear);
    // folds shut, ribs sliding onto one edge, the colours adding back up to white...
    await span(T_FOLD, T_OUT, (e) => {
      F.aim = aimOf(); // folding onto its north edge
      F.open = 1 - e;
      F.power = 0.6 + 0.6 * e;
      fan.userData.update(F);
    }, ease.inOut);
    // ...one white line, which goes out from the far end back into the fin
    await span(T_OUT, T_OUT + 0.14, (e) => {
      F.open = 0.0;
      F.reach = 2.8 * (1 - e);
      F.power = 1.2 * (1 - e * 0.7);
      fan.userData.update(F);
    }, ease.in);
    fan.visible = false;
  })();

  // ----- the fin: flares as her light pours in, holds, settles -----
  const finShow = (async () => {
    await span(T_POUR, T_FAN + 0.1, (e) => finLight(finGlow0 + 1.3 * e, 1 + 2.5 * e), ease.in);
    await span(T_FAN + 0.1, T_FAN + 0.4, (e) => finLight(finGlow0 + 1.3 - 0.8 * e, 3.5 - 1.5 * e), ease.out);
    await span(T_FOLD, T_OUT + 0.14, (e, k) => finLight(finGlow0 + 0.5 + 0.6 * hump(k, 0.5, 1), 2 + 1.5 * hump(k, 0.5, 1)), ease.linear);
    await span(T_OUT + 0.14, T_END, (e) => finLight(finGlow0 + 0.5 * (1 - e), 1 + 1 * (1 - e)), ease.out);
    finLight(finGlow0, 1);
  })();

  // ----- Ava -----
  const avaShow = (async () => {
    // the colour opens: she turns to look
    await span(T_FAN + 0.1, T_FAN + 0.34, (e) => ava.set({ rot: lerp(avaRot0, avaToMaya, e) }), ease.inOut);
    // the fan sweeps over her: she lights up, looks down at herself, and twirls with joy
    const twirlA = T_SWEEP + 0.32;
    lab.every(() => {
      const d = Math.abs(wrap(avaAng - F.aim));
      const lit = fan.visible ? smooth((F.half * F.open + 0.1 - d) / 0.25) * clamp01(F.power / 0.6) : 0;
      avaFace.wash = lit * 0.9;
      avaFace.hue = 0.83 * clamp01((avaAng - (F.aim - F.half)) / (2 * F.half));
    });
    await span(T_SWEEP + 0.2, twirlA, (e) => {
      ava.set({ pitch: 0.28 * e, sy: 1 - 0.04 * e });
      avaFace.eye = 1 + 0.3 * e;
    }, ease.out);
    await span(twirlA, twirlA + 0.38, (e, k) => {
      ava.set({ rot: avaToMaya + TAU * e, pitch: 0.28 * (1 - clamp01(k * 3)), lift: 0.09 * hump(k, 0, 1), sy: 1 + 0.08 * hump(k, 0, 1), roll: 0.12 * hump(k, 0.1, 0.9) });
      avaFace.eye = 1.3 + 0.3 * hump(k, 0, 1);
    }, ease.inOut);
    // back to the way she was facing
    await span(Math.max(T_FOLD + 0.06, twirlA + 0.4), T_END - 0.02, (e) => {
      ava.set({ rot: lerp(avaToMaya + TAU, avaRot0 + TAU, e), lift: 0, sy: 1, roll: 0, pitch: 0 });
      avaFace.eye = 1.6 - 0.6 * e;
    }, ease.inOut);
  })();

  // ----- Maya -----
  await span(0, T_GO, (e) => maya.set({ x: start[0] - 0.04 * e, pitch: -0.1 * e, sy: 1 - 0.05 * e }), ease.out);
  const x0 = start[0] - 0.04;
  await span(T_GO, T_HIT, (e, k) => {
    const s = 0.4 * k * k + 0.6 * k;
    maya.set({ x: x0 + (ex + 0.04 - x0) * s, pitch: -0.1 + 0.22 * clamp01(k * 3), sy: 0.95 + 0.05 * clamp01(k * 4), sz: 1 + 0.05 * clamp01(k * 3) });
  }, ease.linear);
  // tink, and she stays pressed to the fin
  await span(T_HIT, T_POUR, (e, k) => {
    const sq = hump(k, 0, 0.7);
    maya.set({ x: ex + 0.04 - 0.04 * e, sz: 1 - 0.13 * sq, sx: 1 + 0.05 * sq, pitch: 0.12 * (1 - e) + 0.06 * e });
    face.eye = 1 + 0.4 * hump(k, 0, 0.4);
  }, ease.out);
  // her light pours into the fin: the eye drains, she leans in a little as if it's pulling
  await span(T_POUR, T_FAN, (e) => {
    maya.set({ pitch: 0.06 + 0.06 * e, sy: 1 - 0.03 * e });
    face.eye = 1 - 0.75 * e;
  }, ease.in);
  // the colour opens on the far side: she rears back, amazed
  await span(T_FAN, T_TILT, (e, k) => {
    maya.set({ pitch: lerp(0.12, -0.2, ease.outBack(k)), sy: 0.97 + 0.11 * ease.out(k), sx: 1 - 0.03 * k, lift: 0.04 * hump(k, 0, 1) });
    face.eye = 0.25 + 0.2 * ease.out(k);
  }, ease.linear);
  // a curious head tilt to the left... and the fan tilts with her
  await span(T_TILT, T_SWEEP, (e, k) => {
    gaze.yaw = 0.3 * e;
    maya.set({ rot: rot0 + gaze.yaw, roll: -0.18 * e, pitch: -0.2 + 0.06 * e, sy: 1.08 - 0.03 * e });
  }, ease.inOut);
  // she gets it: a delighted hop, and she sweeps the rainbow slowly over to Ava
  await span(T_SWEEP, T_HOME, (e, k) => {
    gaze.yaw = lerp(0.3, -(avaAng - 0.15), e);
    const hop = hump(k, 0, 0.3);
    maya.set({ rot: rot0 + gaze.yaw, roll: lerp(-0.18, 0.14, e), lift: 0.06 * hop, sy: 1.05 + 0.06 * hop, pitch: -0.14 });
    face.eye = 0.45 + 0.1 * hop;
  }, ease.inOut);
  // satisfied, she looks back to the wall
  await span(T_HOME, T_FOLD + 0.06, (e) => {
    gaze.yaw = lerp(-(avaAng - 0.15), 0, e);
    maya.set({ rot: rot0 + gaze.yaw, roll: 0.14 * (1 - e), pitch: lerp(-0.14, 0, e), sy: lerp(1.05, 1, e), lift: 0 });
  }, ease.inOut);
  // the light comes home to her eye as the fan folds, and a contented sigh
  await span(T_FOLD + 0.06, T_END, (e, k) => {
    gaze.yaw = 0;
    face.eye = lerp(0.45, 1, smooth((k - 0.45) / 0.45)) + 0.25 * hump(k, 0.75, 1);
    const sigh = hump(k, 0.55, 1);
    maya.set({ rot: rot0, roll: 0, sy: 1 - 0.06 * sigh, sx: 1 + 0.03 * sigh, pitch: 0.05 * sigh, x: ex });
  }, ease.linear);

  await fanShow;
  await finShow;
  await avaShow;
  await until(T_END);
  maya.set({ sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, lift: 0, rot: rot0, x: ex });
  ava.set({ sy: 1, lift: 0, pitch: 0, roll: 0 });
  maya.each = null;
  ava.each = null;
  maya.release({ x: ex, y: ey, d: 1 });
  ava.release({ x: avaAt.x, y: avaAt.y, d: 3 });
}
