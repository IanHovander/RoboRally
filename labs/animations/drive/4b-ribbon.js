// Drive, idea 25 "Ribbon", animator b (character acting).
export const meta = {
  title: 'Ribbon routine',
  idea:
    "Maya's trail is a gymnast's ribbon and she performs every card as a routine. Move 2: chin up, the ribbon streams out straight. Rotate Right: a pirouette on tiptoe that flicks a curl of ribbon out beside her (Theo leans back from it). " +
    'Move Back drags the curl out; when the ribbon snaps taut it yanks her into a little stumble and a shiver of light runs down its length. ' +
    'The U-Turn is the big finish: a spin that winds a full loop round her ring and pops a bow at her feet, then she strikes a pose. Theo, judging, nods twice. The trail still fades on its usual schedule, bow last.',
  notes:
    'Sound: a silky whoosh on the flick, a soft twang and a glassy shimmer when it goes taut, a quick rising swirl for the wind-up and a little two-note "ta-da" chime on the bow. ' +
    'Port: the trail becomes a polyline the scene owns (here a thin strip with the trail texture and the same 3.2 s fade); every turn adds a curl at the robot, the next move pulls it out, a U-Turn adds a loop and a bow. Same timing as the plain cards.',
};

const PI = Math.PI;
const TAU = PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (T, a, b) => clamp01((T - a) / (b - a));
const LIFE = 3.2; // the game's trail life

/** A keyframed channel: keys [[t, value, ease], ...]; each key's ease shapes the stretch arriving at it. */
function track(keys, def) {
  return (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = def] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return v0 + (v1 - v0) * e(t1 > t0 ? (T - t0) / (t1 - t0) : 1);
    }
    return keys[keys.length - 1][1];
  };
}

export default async function play(lab) {
  const { THREE, ease: E, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const t0 = lab.t;
  const back = (s) => (k) => E.outBack(k, s);
  const RED = new THREE.Color('#ff4d6d');

  const C = { m2: 0.0, rr: 0.84, bk: 1.6, ut: 2.42 };
  const END = 3.64;
  const R = 0.7; // the loop round her ring

  // ----- Maya, the gymnast -----
  const mx = track([[0.08, 1], [0.72, 3, E.inOut]], E.inOut);
  const my = track([[C.bk + 0.08, 2], [C.bk + 0.5, 1, E.inOut]], E.inOut);
  const mrot = track([
    [C.rr + 0.1, facing(1)], [C.rr + 0.36, facing(2), back(1.8)],
    [C.ut + 0.08, facing(2)], [C.ut + 0.44, facing(2) - PI, back(1.3)],
  ], E.inOut);
  const mlift = track([
    [C.rr + 0.04, 0], [C.rr + 0.14, 0.07, E.out], [C.rr + 0.4, 0.06], [C.rr + 0.52, 0, E.in], // up on tiptoe for the pirouette
    [C.ut + 0.02, 0], [C.ut + 0.14, 0.09, E.out], [C.ut + 0.46, 0.08], [C.ut + 0.56, 0, E.in],
  ], E.inOut);
  const mpitch = track([
    [0.08, 0], [0.3, -0.08, E.out], [0.72, -0.06], [0.84, 0.06, E.out], [0.96, -0.1, E.inOut], // chin up
    [C.rr + 0.36, -0.12], [C.rr + 0.6, -0.04, E.inOut],
    [C.bk + 0.44, -0.04], [C.bk + 0.52, 0.22, E.out], [C.bk + 0.64, -0.05, E.inOut], [C.bk + 0.76, 0, E.inOut], // yanked by the taut ribbon
    [C.ut + 0.56, 0], [C.ut + 0.68, -0.22, E.out3], [C.ut + 1.0, -0.2], [C.ut + 1.18, 0, E.inOut], // ta-da
  ], E.inOut);
  const msy = track([
    [C.rr + 0.02, 1], [C.rr + 0.14, 1.1, E.out], [C.rr + 0.4, 1.08], [C.rr + 0.52, 0.94, E.in], [C.rr + 0.64, 1, E.out],
    [C.bk + 0.48, 1], [C.bk + 0.54, 0.9, E.out], [C.bk + 0.7, 1, E.inOut],
    [C.ut + 0.02, 1], [C.ut + 0.14, 1.1, E.out], [C.ut + 0.5, 1.06], [C.ut + 0.58, 0.92, E.in], [C.ut + 0.7, 1.14, E.out], [C.ut + 1.0, 1.12], [C.ut + 1.18, 1, E.inOut],
  ], E.inOut);
  const stumble = (T) => Math.sin((T - C.bk - 0.52) * TAU * 6) * 0.12 * Math.sin(PI * span(T, C.bk + 0.52, C.bk + 0.8));
  const eyeB = track([[C.ut + 0.6, 1], [C.ut + 0.68, 2.1, E.out], [C.ut + 1.0, 1.9], [C.ut + 1.18, 1, E.inOut]], E.inOut);
  const blink = (T) => 1 - 0.8 * Math.sin(PI * span(T, C.bk + 0.5, C.bk + 0.62));

  // ----- Theo: leans back from the flick, follows the routine, nods twice at the finish -----
  const tF = facing(2);
  const tpitch = track([
    [C.rr + 0.16, 0], [C.rr + 0.26, -0.13, E.out], [C.rr + 0.6, 0, E.inOut],
    [C.ut + 0.7, 0], [C.ut + 0.8, 0.2, E.out], [C.ut + 0.9, 0, E.inOut], [C.ut + 1.0, 0.2, E.out], [C.ut + 1.12, 0, E.inOut],
  ], E.inOut);
  const trot = track([[0.2, tF], [0.7, tF - 0.4, E.inOut], [C.rr + 0.4, tF - 0.5], [C.bk + 0.6, tF - 0.75, E.inOut], [C.ut + 1.15, tF - 0.75], [C.ut + 1.3, tF, E.inOut]], E.inOut);

  // ----- the ribbon -----
  // points in spaces { x, y, t (born), b (brightness), w (width) }; drawn as a thin additive strip
  const path = [{ x: 1, y: 2, t: lab.t }]; // where she has driven
  let pathAtFlick = -1; // where the curl hangs off
  const flickT = C.rr + 0.12;
  const curlG = track([[flickT, 0], [C.rr + 0.36, 1, back(2.4)]], E.inOut);
  const curlA = track([[flickT, -1.5], [C.rr + 0.42, -0.25, back(1.6)]], E.inOut); // flung round from behind her
  const pullK = (T) => span(T, C.bk + 0.08, C.bk + 0.5);
  const wrapA = track([[C.ut + 0.08, 0], [C.ut + 0.46, TAU, E.inOut]], E.inOut);
  const bowG = track([[C.ut + 0.44, 0], [C.ut + 0.66, 1, back(2.6)]], E.inOut);
  const shiverT = C.bk + 0.48;

  const petal = (out, cx, cy, ang, len, spread, n, born) => {
    for (let j = 1; j < n; j++) {
      const s = j / n;
      const a = ang + spread * (s - 0.5);
      const r = len * Math.sin(PI * s);
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, t: born + j * 0.004 });
    }
    out.push({ x: cx, y: cy, t: born + n * 0.004 });
  };

  const build = (T, now) => {
    const pts = [];
    const hx = mx(T);
    const hy = T < C.bk ? 2 : my(T);
    const wrapping = T > C.ut + 0.08;
    const sY = 1 + R; // where the loop starts, just in front of her
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (wrapping && i > pathAtFlick && p.y < sY) break;
      pts.push(p);
    }
    if (!wrapping) {
      const last = pts[pts.length - 1];
      if (Math.hypot(last.x - hx, last.y - hy) > 0.01) pts.push({ x: hx, y: hy, t: now });
      if (T > flickT && T < C.bk + 0.5) {
        // the curl: flicked out where she turned, dragged along and pulled out as she backs away
        const k = pullK(T);
        const g = curlG(T) * (1 - E.inOut(k)) ** 1.2;
        if (g > 0.01) petal(pts, hx, hy, curlA(T) - k * 0.6, 0.78 * g, 1.5, 18, t0 + flickT);
      }
      return pts;
    }
    // the loop round her ring, wound clockwise as she spins
    const th = wrapA(T);
    const n = Math.max(2, Math.ceil((th / TAU) * 40));
    const wrapBorn = (f) => t0 + C.ut + 0.08 + f * 0.38;
    for (let j = 0; j <= n; j++) {
      const ph = (th * j) / n;
      pts.push({ x: 3 - Math.sin(ph) * R, y: 1 + Math.cos(ph) * R, t: wrapBorn(ph / TAU) });
    }
    // and the bow at her feet
    const g = bowG(T);
    if (g > 0.01) {
      const born = t0 + C.ut + 0.5;
      petal(pts, 3, sY, PI - 0.5, 0.38 * g, 1.35, 14, born);
      petal(pts, 3, sY, 0.5, 0.38 * g, 1.35, 14, born);
      pts.push({ x: 3 - 0.06 * g, y: sY + 0.14 * g, t: born + 0.1 }, { x: 3 - 0.12 * g, y: sY + 0.3 * g, t: born + 0.1 });
    }
    return pts;
  };

  const NMAX = 200;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NMAX * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NMAX * 6), 3));
  const uv = new Float32Array(NMAX * 4);
  for (let i = 0; i < NMAX; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < NMAX - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const ribbon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: maya.bot.trailMesh.material.map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 3;
  lab.add(ribbon);

  const draw = (raw, now, T) => {
    const pts = raw.filter((p) => now - p.t < LIFE).slice(-NMAX);
    const n = pts.length;
    if (n < 2) return geo.setDrawRange(0, 0);
    const W = pts.map((p) => lab.pos(p.x, p.y));
    // arc length from her end, for the shiver that runs down the ribbon
    const sFromHead = new Array(n).fill(0);
    for (let i = n - 2; i >= 0; i--) sFromHead[i] = sFromHead[i + 1] + W[i].distanceTo(W[i + 1]);
    const front = (T - shiverT) * 7;
    const shiverOn = T > shiverT && T < shiverT + 0.7;
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    for (let i = 0; i < n; i++) {
      const p = W[i];
      const q = W[Math.min(n - 1, i + 1)];
      const o = W[Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const age = (now - pts[i].t) / LIFE;
      let fade = Math.max(0, 1 - age) ** 1.6 * Math.min(1, i / 3);
      let disp = 0;
      if (shiverOn) {
        const u = sFromHead[i] - front;
        const env = Math.exp(-((u / 0.45) ** 2)) * (1 - span(T, shiverT + 0.4, shiverT + 0.7));
        disp = Math.sin(u * 16) * 0.05 * env;
        fade *= 1 + 1.6 * env;
      }
      const w = 0.1 + 0.04 * Math.max(0, 1 - age);
      const cx = p.x - dz * disp;
      const cz = p.z + dx * disp;
      pos.set([cx - dz * w, 0.009, cz + dx * w, cx + dz * w, 0.009, cz - dx * w], i * 6);
      const k = fade * 1.9;
      col.set([RED.r * k, RED.g * k, RED.b * k, RED.r * k, RED.g * k, RED.b * k], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, (n - 1) * 6);
  };

  // the ribbon keeps fading on the game's schedule after the moment, so it runs on past the end
  let done = false;
  const stopRibbon = lab.every((dt, t) => {
    const T = done ? END : t - t0;
    if (!done) {
      const hx = mx(T);
      const hy = T < C.bk ? 2 : my(T);
      const last = path[path.length - 1];
      if (Math.hypot(last.x - hx, last.y - hy) > 0.08) path.push({ x: hx, y: hy, t });
      if (T >= flickT && pathAtFlick < 0) {
        if (Math.hypot(last.x - hx, last.y - hy) > 0.001) path.push({ x: hx, y: hy, t });
        pathAtFlick = path.length - 1;
      }
    }
    draw(build(T, t), t, T);
  });
  lab.cleanup(stopRibbon);

  const stop = lab.every((dt, t) => {
    const T = t - t0;
    maya.set({
      x: mx(T),
      y: T < C.bk ? 2 : my(T),
      rot: T < C.rr ? facing(1) : mrot(T),
      lift: mlift(T),
      pitch: mpitch(T),
      roll: stumble(T),
      sy: msy(T),
      sx: 1 + (1 - msy(T)) * 0.5,
      sz: 1 + (1 - msy(T)) * 0.5,
      trail: false, // the ribbon is her trail
    });
    theo.set({ pitch: tpitch(T), rot: trot(T) });
  });

  maya.each = (m, t) => {
    const T = t - t0;
    if (maya.bot.card && maya.bot.card.position.y < 1) maya.bot.card.visible = false; // a new card isn't placed until the next frame
    const b = eyeB(T) * blink(T);
    m.eyeMat.color.setRGB(3.2 * b, 3.1 * b, 2.9 * b);
  };

  const card = (at, id, fx, d = 0.08) =>
    lab.at(at, () => {
      lab.playCard('a', [id]);
      lab.arena.emit('play', { id: 'a', cards: [id] });
      lab.at(d, fx);
    });
  card(C.m2, 'm2', () => lab.arena.emit('move', { id: 'a', n: 2, dur: 0.64 }));
  card(C.rr, 'rr', () => lab.arena.emit('turn', { id: 'a', by: 1 }));
  card(C.bk, 'bk', () => lab.arena.emit('move', { id: 'a', n: 1, dur: 0.42 }));
  card(C.ut, 'ut', () => lab.arena.emit('turn', { id: 'a', by: 2 }));

  await lab.wait(END);
  stop();
  done = true;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 0 });
  theo.release({ x: 5, y: 0, d: 2 });
}
