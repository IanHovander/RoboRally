// Win, idea 5 (Domino run), animator b: character acting.
// Maya lands on the last flag. Glass panes, lit along their top edges like Lumen's wall fins, rise out of the glass
// in a snaking line from her square... and it ends at Theo. He notices. Gulp. Maya turns round, looks at the first
// pane, and gives it a cheeky little boop. The run topples pane into pane (each one turning her colour as it lands),
// Jun nods along to every chime, Theo leans back further and further and finally braces, eye squeezed shut. The
// last pane wobbles on its tipping point... forward... back... and ever so gently taps him. He rocks, opens one
// eye, looks down at the pane, looks at Maya. The panes sink into the glass as lines of light.
export const meta = {
  title: 'Domino run: the boop',
  idea: 'Glass panes rise out of the glass in a line that snakes from Maya\'s square all the way round to Theo. He notices, and gulps. Maya turns round and gives the first pane a cheeky boop; the run topples pane into pane, each turning her colour, Jun nodding along to every chime, Theo leaning away until he braces with his eye shut. The last pane teeters, forward, back... and gives him the gentlest tap. He rocks, peeks, looks at the pane, looks at her. The panes sink away as lines of light.',
  notes: 'Sound: a soft rising shimmer as the panes grow, silence for the gulp, a tiny "boop" glass tick, then one glass chime per pane a step higher up a scale (21 steps: start low so it can climb), the last two slower, then nothing for the teeter, then a tiny "tink" an octave up for the tap, and a soft settling whoosh as the panes sink. Port: the line is a smooth curve from the winner to the nearest rival, resampled at even spacing (here 21 panes), ending one pane-height in front of the rival\'s face, so it is different every game; panes are drawn like wall fins (smoked glass + a bright cap) and are pure decoration: nobody moves by the rules.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** keys: [[t, value, ease?], ...] (the ease shapes the segment that ends at that key) */
function kf(keys, ease) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * (e ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
}
const wob = (t, t0, amp, hz, decay) => (t < t0 ? 0 : amp * Math.sin((t - t0) * hz * TAU) * Math.exp(-(t - t0) * decay));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const lookRot = (near, x0, y0, x1, y1) => near + wrap(Math.atan2(-(x1 - x0), -(y1 - y0)) - near);

/** A robot as an actor: lean, roll, squash and the eye are on its body, so its ring stays flat on the glass. */
function actor(lab, key) {
  const { THREE } = lab;
  const p = lab.puppet(key);
  const b = p.bot;
  const m = p.model;
  const eyes = [];
  m.group.traverse((o) => {
    if (o.isMesh && o.material === m.eyeMat) eyes.push({ o, s: o.scale.clone(), kind: o.geometry.type, rz: Math.abs(o.rotation.z) > 1 });
  });
  const base = new THREE.Color(b.color);
  const A = { p, b, m, x: b.x, y: b.y, rot: b.rot, lift: 0, lean: 0, roll: 0, sy: 1, sw: 1, eye: 1, open: 1, glow: 0 };
  p.each = (model) => {
    model.body.rotation.set(-A.lean, 0, -A.roll);
    model.body.scale.set(A.sw, A.sy, A.sw);
    const o = Math.max(0.02, A.open);
    for (const e of eyes) {
      if (e.kind === 'CapsuleGeometry' && e.rz) e.o.scale.set(e.s.x * o, e.s.y * (0.7 + 0.3 * Math.min(1.4, A.open)), e.s.z * o);
      else if (e.kind === 'CylinderGeometry') e.o.scale.set(e.s.x * o, e.s.y, e.s.z * o);
      else if (e.kind === 'SphereGeometry') e.o.scale.setScalar(e.s.x * (0.3 + 0.7 * o));
      else e.o.scale.set(e.s.x, e.s.y * o, e.s.z);
    }
    const k = A.eye * (A.open < 0.15 ? A.open / 0.15 : 1);
    model.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
    model.paint.emissive.copy(base);
    model.paint.emissiveIntensity = 0.16 + A.glow;
  };
  A.apply = () => p.set({ x: A.x, y: A.y, rot: A.rot, lift: A.lift });
  A.done = (d) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.set(0, 0, 0);
    for (const e of eyes) e.o.scale.copy(e.s);
    m.paint.emissive.copy(base);
    m.paint.emissiveIntensity = 0.16;
    p.release({ x: Math.round(A.x), y: Math.round(A.y), d });
  };
  return A;
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

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = actor(lab, 'a');
  const theo = actor(lab, 'b');
  const jun = actor(lab, 'c');
  const RED = new THREE.Color(maya.b.color);
  const LIGHT = new THREE.Color(lab.PALETTE.light);
  const gTex = glowTex(THREE);

  // ----- the run: a smooth line from behind Maya, round the west of the board, to Theo's face -----
  const way = [[3.45, 1.0], [2.6, 1.0], [1.9, 1.08], [1.45, 1.6], [1.5, 2.3], [1.95, 2.75], [2.8, 2.95], [3.6, 3.0], [4.3, 3.0]];
  const curve = new THREE.CatmullRomCurve3(way.map(([x, y]) => new THREE.Vector3(x, 0, y)), false, 'centripetal');
  const N = 21;
  const H = 0.5; // pane height
  const W = 0.6; // pane width
  // when each pane starts to fall: steady, then the last ones slower
  const gaps = [];
  for (let i = 0; i < N - 1; i++) gaps.push(i < N - 4 ? 0.085 : i === N - 4 ? 0.11 : i === N - 3 ? 0.14 : 0.19);

  // ----- the clock -----
  const TOUCH = 0.8;
  const RISE = 1.0; // the panes grow
  const GULP = 1.62; // Theo sees where it ends
  const TURN = 1.55; // Maya turns round to the first pane
  const BOOP = 1.9; // ...and boops it
  const starts = [BOOP + 0.06];
  for (const g of gaps) starts.push(starts[starts.length - 1] + g);
  const LASTHIT = starts[N - 1]; // the last pane is nudged...
  const TAP = LASTHIT + 0.62; // ...teeters... and taps Theo
  const SINK = TAP + 0.42;
  const END = SINK + 0.85;

  const panes = [];
  const capGeo = new THREE.BoxGeometry(W, 0.014, 0.04);
  const paneGeo = new THREE.BoxGeometry(W, H, 0.028).translate(0, H / 2, 0);
  capGeo.translate(0, H, 0);
  const lineGeo = new THREE.PlaneGeometry(W, 0.05);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const at = lab.pos(p.x, p.z);
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(tan.x, tan.z); // local +z is the way it falls
    g.position.set(at.x, 0, at.z);
    const glass = new THREE.Mesh(paneGeo, new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.15, metalness: 0, emissive: 0xdfe6f0, emissiveIntensity: 0.12, transparent: true, opacity: 0.78 }));
    const capMat = new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(1.25) });
    const cap = new THREE.Mesh(capGeo, capMat);
    g.add(glass, cap);
    g.scale.y = 0.001;
    g.visible = false;
    lab.add(g);
    // the line of light it rises out of (and sinks back into)
    const lineMat = new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.order = 'YXZ';
    line.rotation.set(-Math.PI / 2, g.rotation.y, 0);
    line.position.set(at.x, 0.012, at.z);
    lab.add(line);
    // a glint where it strikes the next one
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: LIGHT.clone().multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glint.scale.setScalar(0.45);
    lab.add(glint);
    panes.push({ g, glass, cap, capMat, line, lineMat, glint, at, sx: p.x, sy: p.z, tilt: 0, rise: RISE + i * 0.024 });
  }
  // the angle a pane rests at against the next one (and the last one against Theo)
  const spacing = curve.getLength() / (N - 1);
  const LEAN = Math.asin(Math.min(0.95, spacing / H));
  const FLAT = 1.36;
  const last = panes[N - 1];
  const theoFace = 0.33; // how far Theo's front is from his centre
  const LEANTHEO = Math.asin(clamp01((Math.hypot(5 - last.sx, 3 - last.sy) - theoFace) / H));

  /** every pane's tilt at time t (worked from the end of the run back: each one rests on the next) */
  function tilts(t) {
    const out = new Array(N).fill(0);
    for (let i = N - 1; i >= 0; i--) {
      const s = t - starts[i];
      if (s < 0) continue;
      if (i === N - 1) {
        // the last one: nudged, teeters forward, back, forward... and tips gently onto Theo
        out[i] = kf([[0, 0], [0.1, 0.22, ease.out], [0.24, 0.04, ease.inOut], [0.36, 0.3, ease.inOut], [0.46, 0.27], [TAP - LASTHIT, LEANTHEO, ease.in], [TAP - LASTHIT + 0.12, LEANTHEO - 0.05, ease.out], [TAP - LASTHIT + 0.3, LEANTHEO]], ease)(s);
        continue;
      }
      const fall = LEAN * ease.in(clamp01(s / (starts[i + 1] - starts[i]))); // gravity, until it meets the next one
      // once the next one goes, this one rides down on it
      const next = out[i + 1];
      const nextMax = i + 1 === N - 1 ? LEANTHEO : FLAT;
      const ride = next > 0 ? LEAN + (FLAT - LEAN) * clamp01(next / nextMax) ** 1.2 * (i + 1 === N - 1 ? 0.55 : 1) : 0;
      out[i] = Math.max(fall, ride);
    }
    return out;
  }

  // ----- Maya: turns round, boops the first pane, watches the run, turns back -----
  const mX = kf([[0, 2], [0.12, 1.95, ease.out], [TOUCH, 4, ease.inOut]], ease);
  const mLean = kf([[0, 0], [0.12, -0.13], [0.34, 0.18, ease.out], [0.7, 0.05], [TOUCH, -0.1, ease.out], [TOUCH + 0.25, 0],
    [BOOP - 0.14, -0.12, ease.out], [BOOP - 0.02, 0.36, ease.in], [BOOP + 0.12, -0.04, ease.out], [BOOP + 0.3, 0]], ease);
  const mPoke = kf([[BOOP - 0.14, 0], [BOOP - 0.02, 0.09, ease.in], [BOOP + 0.18, 0, ease.out]], ease); // a little shove forward (west)
  const mTrack = kf([[BOOP + 0.25, 0], [BOOP + 0.45, 1, ease.out], [TAP + 0.25, 1], [TAP + 0.55, 0, ease.inOut]], ease);
  const mBack = kf([[TAP + 0.25, 0], [TAP + 0.6, 1, ease.inOut]], ease); // and back to east
  const mTurn = kf([[TURN, 0], [TURN + 0.28, 1, ease.inOut]], ease);
  const mSmug = kf([[TAP + 0.05, 0], [TAP + 0.2, 1, ease.outBack], [END - 0.3, 1], [END, 0]], ease);

  // ----- Theo: notices, gulps, dread, braces, gets tapped, peeks, glares -----
  const tGulp = kf([[GULP, 0], [GULP + 0.06, 1, ease.out], [GULP + 0.2, 0, ease.out]], ease);
  const tDread = kf([[GULP - 0.1, 0], [GULP, 0.3, ease.out], [starts[8], 0.35], [starts[N - 4], 1, ease.in], [LASTHIT, 1]], ease);
  const tBrace = kf([[LASTHIT - 0.12, 0], [LASTHIT, 1, ease.out], [TAP + 0.06, 1], [TAP + 0.22, 0.4, ease.out], [TAP + 0.45, 0]], ease);
  const tPeek = kf([[TAP + 0.22, 0], [TAP + 0.3, 1, ease.out], [TAP + 0.42, 1], [TAP + 0.5, 0, ease.inOut]], ease); // looks down at the pane
  const tGlare = kf([[TAP + 0.5, 0], [TAP + 0.64, 1, ease.out], [END - 0.3, 1], [END - 0.05, 0, ease.inOut]], ease);
  const theoToMaya = lookRot(facing(3), 5, 3, 4, 1);
  // Jun: follows the front with his eye and nods to every chime; leans in for the teeter; flinches at the tap
  const jTrack = kf([[BOOP, 0], [BOOP + 0.25, 1, ease.out], [TAP + 0.3, 1], [END - 0.1, 0, ease.inOut]], ease);
  const jLeanIn = kf([[LASTHIT, 0], [LASTHIT + 0.25, 1, ease.out], [TAP, 1], [TAP + 0.08, -0.6, ease.out], [TAP + 0.35, 0]], ease);

  // ----- run -----
  const T0 = lab.t;
  lab.playCard('a', ['m2']);
  const col = arena.columns.find((c) => c.n === 2);
  const fired = new Set();
  const once = (key, cond, fn) => {
    if (cond && !fired.has(key)) {
      fired.add(key);
      fn();
    }
  };
  let mLook = facing(3);
  let jLook = facing(2);
  const front = new THREE.Vector3();
  const tmp = new THREE.Color();

  const stop = lab.every((dt) => {
    const t = lab.t - T0;
    const tl = tilts(t);
    // where the run has got to (for the eyes that follow it)
    let fi = 0;
    for (let i = 0; i < N; i++) if (t >= starts[i]) fi = i;
    const fk = clamp01((t - starts[fi]) / (gaps[fi] ?? 0.2));
    const pa = panes[fi];
    const pb = panes[Math.min(N - 1, fi + 1)];
    front.set(pa.sx + (pb.sx - pa.sx) * fk, 0, pa.sy + (pb.sy - pa.sy) * fk);

    // ----- the panes -----
    panes.forEach((p, i) => {
      const r = clamp01((t - p.rise) / 0.2);
      const pre = clamp01((t - p.rise + 0.12) / 0.12); // the line lights first
      const sink = clamp01((t - SINK - i * 0.018) / 0.32);
      p.g.visible = r > 0 && sink < 1;
      p.g.scale.y = Math.max(0.001, ease.outBack(r) * (1 - ease.in(sink)));
      p.g.position.y = -0.04 * sink;
      p.g.rotation.x = tl[i];
      // the cap: white while standing, a flash when struck, then her colour once it has fallen
      const struck = t - starts[i];
      const flash = struck >= 0 ? Math.exp(-struck * 9) : 0;
      const fallen = clamp01((tl[i] - LEAN * 0.5) / (FLAT - LEAN * 0.5));
      const step = 1 + i / N; // a step higher every pane
      tmp.copy(LIGHT).lerp(RED, 0.85 * fallen).multiplyScalar(1.25 + flash * 2.6 * step);
      p.capMat.color.copy(tmp);
      p.glass.material.emissiveIntensity = 0.12 + 0.5 * flash;
      // the glint where it strikes the next pane (or Theo)
      const hitT = i < N - 1 ? starts[i + 1] : TAP;
      const gk = t - hitT;
      if (gk >= 0 && gk < 0.3) {
        const tip = new THREE.Vector3(0, H, 0).applyEuler(p.g.rotation).add(p.g.position);
        p.glint.position.copy(tip);
        p.glint.material.opacity = (1 - gk / 0.3) ** 2 * (i === N - 1 ? 1.3 : 0.9);
        p.glint.scale.setScalar((0.35 + 0.25 * step) * (i === N - 1 ? 0.8 : 1));
      } else p.glint.material.opacity = 0;
      // the line of light on the glass: before it rises, and after it sinks
      const lineK = t < SINK ? pre * (1 - r) : sink * (1 - clamp01((t - SINK - i * 0.018 - 0.32) / 0.45));
      p.lineMat.opacity = lineK;
      p.lineMat.color.copy(LIGHT).lerp(RED, t < SINK ? 0 : 0.8).multiplyScalar(2);
      if (t >= SINK) {
        // it lies down into a line pointing the way it fell
        const off = new THREE.Vector3(0, 0, H * 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.g.rotation.y);
        p.line.position.set(p.at.x + off.x, 0.012, p.at.z + off.z);
        p.line.rotation.set(-Math.PI / 2, p.g.rotation.y, Math.PI / 2, 'YXZ');
        p.line.scale.set(H / W, 1, 1);
      }
    });

    // ----- Maya -----
    maya.x = mX(t) - mPoke(t);
    mLook = lookRot(mLook, 4, 1, front.x, front.z) * (1 - Math.exp(-dt * 9)) + mLook * Math.exp(-dt * 9);
    const faceRun = facing(1) + Math.PI * mTurn(t); // turns left, all the way round to face west
    const tracking = faceRun + mTrack(t) * wrap(mLook - faceRun);
    maya.rot = tracking + mBack(t) * wrap(facing(1) - tracking);
    maya.lean = mLean(t) - 0.14 * mSmug(t);
    maya.sy = 1 + 0.08 * mSmug(t) + wob(t, TOUCH, -0.05, 3, 8) + wob(t, BOOP, 0.05, 4, 9);
    maya.sw = 1 / Math.sqrt(maya.sy);
    maya.open = 1 + 0.3 * mSmug(t) - 0.55 * kf([[BOOP - 0.3, 0], [BOOP - 0.22, 1], [BOOP - 0.1, 1], [BOOP, 0]], ease)(t); // a sly squint before the boop
    maya.eye = 1 + 0.4 * mSmug(t);

    // ----- Theo -----
    const dread = tDread(t);
    const brace = tBrace(t);
    const peek = tPeek(t);
    const glare = tGlare(t);
    const jitter = dread > 0.5 && brace < 0.5 ? Math.sin(t * 19 * TAU) * 0.03 * dread : 0;
    theo.rot = facing(3) + glare * 0.8 * wrap(theoToMaya - facing(3)) + jitter;
    theo.lean = -0.3 * dread * (1 - brace) - 0.12 * brace + 0.3 * peek + wob(t, TAP, -0.2, 2.6, 4.5);
    theo.sy = 1 - 0.1 * tGulp(t) - 0.28 * brace + 0.03 * dread;
    theo.sw = 1 + 0.15 * brace;
    theo.open = Math.max(0.05, (1 + 0.6 * dread) * (1 - 0.95 * brace) * (1 - 0.35 * glare));
    theo.eye = 1 + 0.4 * glare;

    // ----- Jun -----
    jLook = lookRot(jLook, 1, 0, front.x, front.z) * (1 - Math.exp(-dt * 7)) + jLook * Math.exp(-dt * 7);
    jun.rot = facing(2) + jTrack(t) * wrap(jLook - facing(2));
    let nodV = 0;
    for (let i = 1; i < N; i++) nodV += wob(t, starts[i] + 0.02, 0.06, 5, 16);
    const lean = jLeanIn(t);
    jun.lean = nodV * 1.5 + 0.18 * lean;
    jun.sy = 1 - Math.abs(nodV) * 0.6 + (lean < 0 ? 0.06 * -lean : 0);
    jun.sw = 1 / Math.sqrt(jun.sy);
    jun.lift = lean < 0 ? 0.06 * -lean : 0;
    jun.open = 1 + 0.4 * Math.max(0, lean);
    for (const A of [maya, theo, jun]) A.apply();

    // ----- events -----
    once('touch', t >= TOUCH, () => {
      col.flash = arena.time;
      col.flashColor = RED.clone();
      arena.clearCards();
    });
    once('tap', t >= TAP, () => lab.ring(lab.pos(4.62, 3), lab.PALETTE.light, 0.35, 0.25, 0.4));
  });

  await lab.wait(END);
  stop();
  maya.done(1);
  theo.done(3);
  jun.done(2);
}
