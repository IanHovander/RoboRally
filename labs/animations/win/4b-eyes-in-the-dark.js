// Win, idea 4 (Eyes in the dark), animator b: character acting.
// Maya lands on the last flag. Somewhere in the dark, one eye opens. Maya does a double-take. A second eye opens
// beside it, then dozens: an audience of robots standing on the floor far below, each eye throwing a faint ring at
// its feet. Their applause is blinking, a wave that runs round the room and swells as it passes behind her. Maya
// bows to us, then turns and bows to them. Jun blinks along like mad; Theo folds his arms (as much as a prism can)
// and refuses. The crowd closes its eyes in a scatter... and one latecomer is still clapping, notices it is alone,
// looks left, looks right, and shuts its eye. The room is empty again.
export const meta = {
  title: 'Eyes in the dark: the audience',
  idea: 'One eye opens in the dark. Maya double-takes. Then dozens: robots standing in the dark far below the slab, each eye throwing a faint ring at its feet, applauding by blinking in a wave that swells as it passes behind her. Maya bows to us, then turns and bows to them; Jun blinks along like mad, Theo turns his back and refuses. The eyes close in a scatter, and one latecomer keeps clapping, notices it\'s alone, glances left and right, and shuts its eye.',
  notes: 'Sound: silence for the first eye (a tiny glass "tik" as it opens), a second "tik", then a patter of tiks becoming a soft rain of glass clicks for the applause, swelling with the wave behind her; a warm low chime for each bow; the scatter of closing eyes as a fading patter, and the latecomer\'s two lonely clicks. Port: the audience is drawn at the floor (sprites + flat rings), seeded so every game seats a different crowd; the wave starts on the side nearest the winner\'s first flag and swells at the winner\'s bearing. Ring colours hint at a crowd of every player colour. The latecomer is placed where the home camera still sees it (behind the slab), so the gag lands after the camera is home.',
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
/** a blink shape: 1 open, dipping to 0 and back over `dur` from t0 */
const blinkAt = (t, t0, dur = 0.12) => {
  const s = (t - t0) / dur;
  return s < 0 || s > 1 ? 1 : Math.abs(1 - 2 * s) ** 0.7;
};

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

/** a soft pill of light (an eye), drawn once on a canvas */
function eyeTex(THREE) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.shadowColor = '#fff';
  g.shadowBlur = 14;
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(22, 22, 84, 20, 10);
  g.fill();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function dotTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
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
  const RED = maya.b.color;
  const FLOOR = -1.6;

  // ----- the clock -----
  const TOUCH = 0.8;
  const FIRST = 1.3; // one eye opens
  const SECOND = 1.62; // its neighbour
  const CROWD = 1.8; // and then everyone
  const WAVE0 = 2.45; // the applause runs round the room
  const WAVE1 = 3.75;
  const CLOSE0 = 3.8; // eyes close in a scatter
  const CLOSE1 = 4.25;
  const LATE = 4.45; // ...except one
  const END = 5.45;

  // ----- the audience -----
  const eTex = eyeTex(THREE);
  const dTex = dotTex(THREE);
  const ringGeo = new THREE.RingGeometry(0.26, 0.3, 40);
  const hues = ['#ff4d6d', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8', '#ff922b', '#22b8cf', '#f4efe4'];
  const crowd = [];
  const seat = (x, z, opts = {}) => {
    const kind = opts.kind ?? (lab.rand() < 0.22 ? 'dot' : lab.rand() < 0.5 ? 'bar' : 'pill');
    const h = opts.h ?? lab.range(0.22, 0.62);
    const mat = new THREE.SpriteMaterial({ map: kind === 'dot' ? dTex : eTex, color: new THREE.Color(lab.PALETTE.light).multiplyScalar(3.4), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const w = kind === 'dot' ? 0.12 : kind === 'bar' ? 0.42 : 0.3;
    const hh = kind === 'dot' ? 0.12 : kind === 'bar' ? 0.12 : 0.15;
    s.position.set(x, FLOOR + h, z);
    s.scale.set(w, 0.001, 1);
    s.visible = false;
    lab.add(s);
    const rmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.hue ?? hues[Math.floor(lab.rand() * hues.length)]).multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, rmat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, FLOOR + 0.004, z);
    ring.scale.setScalar(0.8 + h);
    lab.add(ring);
    const e = {
      s, ring, w, hh, x, z, h,
      ang: Math.atan2(-z, -x), // 0 west, π/2 behind the board (north), π east
      open: 0, // the lid: 0..1
      tOpen: opts.tOpen ?? 0,
      tClose: opts.tClose ?? 99,
      clapHz: lab.range(5.5, 8.5),
      clapPh: lab.rand(),
      idle: lab.range(0, 1),
      look: 0,
    };
    crowd.push(e);
    return e;
  };
  // the first two, behind the board up and left of Maya, where the eye goes first
  const first = seat(-1.3, -5.0, { kind: 'pill', h: 0.42, tOpen: FIRST, hue: '#4dabf7' });
  const second = seat(-0.6, -5.3, { kind: 'dot', h: 0.3, tOpen: SECOND, hue: '#ffd43b' });
  // everyone else: standing on the floor behind the slab and round its sides (where the camera can see the dark)
  for (let i = 0; i < 48; i++) {
    let x;
    let z;
    for (let tries = 0; tries < 60; tries++) {
      z = -4.0 - 4.4 * lab.rand() ** 0.85;
      const half = 4.9 + 0.75 * (-z - 4.0);
      x = lab.range(-half, half);
      if (crowd.every((c) => Math.hypot((c.x - x) * 0.8, c.z - z) > 0.82)) break;
    }
    const e = seat(x, z);
    // they open spreading out from the first one, quickly
    const d = Math.hypot(x - first.x, z - first.z);
    e.tOpen = CROWD + 0.55 * clamp01(d / 14) ** 0.8 + lab.range(0, 0.22);
    e.tClose = lab.range(CLOSE0, CLOSE1);
  }
  first.tClose = CLOSE1 - 0.05;
  second.tClose = CLOSE0 + 0.12;
  // the latecomer: behind the slab, right of centre, where the home camera still sees it
  const late = seat(2.1, -4.3, { kind: 'pill', h: 0.36, tOpen: 99, hue: '#51cf66' });

  // the wave of applause: a front sweeping round the room (west → behind → east), swelling behind Maya
  const mayaAng = Math.atan2(-lab.pos(4, 1).z, -lab.pos(4, 1).x);
  const front = (t) => -0.7 + (Math.PI + 1.6) * ease.inOut(clamp01((t - WAVE0) / (WAVE1 - WAVE0)));
  const waveAt = (t, ang) => {
    if (t < WAVE0 - 0.1 || t > WAVE1 + 0.25) return 0;
    const d = wrap(ang - front(t));
    const swell = 1 + 1.3 * Math.exp(-((wrap(front(t) - mayaAng) / 0.55) ** 2));
    return Math.exp(-((d / 0.55) ** 2)) * swell;
  };

  // ----- the players -----
  // Maya: double-take at the first eye, then bows: to us, then to them
  const toFirst = lookRot(facing(1), 4, 1, 4 + (first.x - lab.pos(4, 1).x), 1 + (first.z - lab.pos(4, 1).z));
  const mRot = kf([
    [FIRST + 0.08, facing(1)], [FIRST + 0.2, toFirst, ease.out], [FIRST + 0.3, toFirst], [FIRST + 0.38, facing(1), ease.inOut], [FIRST + 0.46, facing(1)], [FIRST + 0.54, toFirst, ease.out],
    [CROWD + 0.45, toFirst], [WAVE0 - 0.1, facing(2), ease.inOut], // turns to us
    [WAVE0 + 0.62, facing(2)], [WAVE0 + 0.92, facing(0) - TAU, ease.inOut], // turns round to them
    [WAVE1 - 0.05, facing(0) - TAU], [WAVE1 + 0.3, facing(1) - TAU, ease.inOut]], ease);
  const mBow = kf([[WAVE0, 0], [WAVE0 + 0.16, 1, ease.out], [WAVE0 + 0.38, 1], [WAVE0 + 0.56, 0, ease.inOut],
    [WAVE0 + 0.98, 0], [WAVE0 + 1.14, 1.15, ease.out], [WAVE0 + 1.4, 1.15], [WAVE1 - 0.05, 0, ease.inOut]], ease);
  const mLean = kf([[0, 0], [0.12, -0.13], [0.34, 0.18, ease.out], [0.7, 0.05], [TOUCH, -0.1, ease.out], [TOUCH + 0.25, 0]], ease);
  const mOpen = kf([[FIRST + 0.5, 1], [FIRST + 0.56, 1.6, ease.out], [CROWD + 0.5, 1.45], [WAVE0, 1.1], [WAVE1 + 0.3, 1]], ease);

  // Theo: a double-take at the crowd, then he turns his back and won't clap; at the latecomer, he looks
  const theoOut = lookRot(facing(3), 5, 3, 7.5, 0); // the dark beyond the north-east corner
  const tRot = kf([[CROWD + 0.12, facing(3)], [CROWD + 0.24, theoOut, ease.out], [CROWD + 0.34, theoOut], [CROWD + 0.42, facing(3), ease.inOut], [CROWD + 0.5, facing(3)], [CROWD + 0.6, theoOut, ease.out],
    [WAVE0 - 0.05, theoOut], [WAVE0 + 0.25, facing(2) - 0.4, ease.inOut], [WAVE1 + 0.2, facing(2) - 0.4], [WAVE1 + 0.5, facing(3), ease.inOut]], ease);
  const tSulk = kf([[WAVE0 - 0.05, 0], [WAVE0 + 0.25, 1, ease.out], [WAVE1 + 0.2, 1], [WAVE1 + 0.5, 0]], ease);
  const tOpen = kf([[CROWD + 0.5, 1], [CROWD + 0.58, 1.6, ease.out], [WAVE0, 1.3], [WAVE0 + 0.25, 0.38], [WAVE1 + 0.2, 0.38], [WAVE1 + 0.5, 1]], ease);
  // Jun: double-take, then claps along like mad (blinks and little hops)
  const junOut = lookRot(facing(2), 1, 0, 0.5, -3);
  const jRot = kf([[CROWD + 0.2, facing(2)], [CROWD + 0.32, junOut, ease.out], [CROWD + 0.42, junOut], [CROWD + 0.5, facing(2), ease.inOut], [CROWD + 0.58, facing(2)], [CROWD + 0.68, junOut, ease.out],
    [WAVE0 + 0.1, junOut], [WAVE1 + 0.3, junOut], [WAVE1 + 0.6, facing(2), ease.inOut]], ease);
  const jClap = kf([[WAVE0 + 0.05, 0], [WAVE0 + 0.15, 1], [WAVE1 + 0.1, 1], [WAVE1 + 0.25, 0]], ease);

  // ----- camera: ease back a little to show the dark around the slab, then home -----
  const camW = kf([[TOUCH + 0.1, 0], [CROWD + 0.3, 1, ease.inOut], [CLOSE0 - 0.1, 1], [LATE + 0.1, 0, ease.inOut]], ease);
  const T0 = lab.t;
  const releaseCam = lab.camera((home) => {
    const w = camW(lab.t - T0);
    return { target: home.target.clone().add(new THREE.Vector3(0, -0.3 * w, -0.7 * w)), dist: home.dist * (1 + 0.2 * w), el: home.el - 0.05 * w };
  });

  // ----- run -----
  lab.playCard('a', ['m2']);
  const col = arena.columns.find((c) => c.n === 2);
  const dimFrom = arena.dim;
  lab.cleanup(() => arena.setDim(dimFrom));
  const fired = new Set();
  const once = (key, cond, fn) => {
    if (cond && !fired.has(key)) {
      fired.add(key);
      fn();
    }
  };

  const stop = lab.every((dt) => {
    const t = lab.t - T0;
    // ----- the crowd -----
    for (const e of crowd) {
      let lid;
      if (e === late) {
        // opens alone, claps twice, looks left, looks right, and snaps shut
        const s = t - LATE;
        lid = s < 0 ? 0 : s < 0.12 ? ease.outBack(s / 0.12) : s < 0.74 ? 1 : Math.max(0, 1 - (s - 0.74) / 0.05);
        lid *= blinkAt(t, LATE + 0.18, 0.1) * blinkAt(t, LATE + 0.31, 0.1);
        e.look = kf([[LATE + 0.42, 0], [LATE + 0.48, -0.09, ease.out], [LATE + 0.56, -0.09], [LATE + 0.62, 0.09, ease.inOut], [LATE + 0.7, 0.09]], ease)(t);
      } else {
        const o = t < e.tOpen ? 0 : ease.outBack(clamp01((t - e.tOpen) / 0.14));
        const c = t < e.tClose ? 1 : 1 - clamp01((t - e.tClose) / 0.07);
        lid = Math.max(0, o * c);
        // idle blinks, and the applause: rapid blinking where the wave is
        const wv = waveAt(t, e.ang);
        if (wv > 0.25) {
          const ph = (t * e.clapHz + e.clapPh) % 1;
          lid *= ph < 0.42 ? Math.abs(1 - ph / 0.21) ** 0.6 : 1;
        } else lid *= blinkAt(t, e.tOpen + 0.5 + e.idle * 1.4, 0.13);
        e.wave = wv;
      }
      e.open = lid;
      const wv = e.wave ?? 0;
      e.s.visible = lid > 0.01;
      e.s.scale.set(e.w * (1 + 0.15 * Math.min(2, wv)), e.hh * lid * (1 + 0.25 * Math.min(2, wv)), 1);
      e.s.position.x = e.x + e.look;
      e.s.material.color.set(lab.PALETTE.light).multiplyScalar(3.0 * (1 + 0.3 * Math.min(2, wv)));
      e.ring.material.opacity = 0.13 * clamp01(lid * 1.5) * (1 + 0.5 * Math.min(2, wv));
    }

    // ----- Maya -----
    maya.x = kf([[0, 2], [0.12, 1.95, ease.out], [TOUCH, 4, ease.inOut]], ease)(t);
    maya.rot = mRot(t);
    maya.lean = mLean(t) + 0.62 * mBow(t);
    maya.sy = 1 - 0.08 * mBow(t) + wob(t, FIRST + 0.54, 0.05, 4, 8) + wob(t, TOUCH, -0.05, 3, 8);
    maya.sw = 1 / Math.sqrt(maya.sy);
    maya.open = mOpen(t) * blinkAt(t, WAVE0 + 0.12, 0.16) * blinkAt(t, WAVE0 + 1.1, 0.18);
    maya.eye = 1 + 0.5 * clamp01((t - WAVE0) * 3) * (1 - clamp01((t - WAVE1) * 3));
    maya.glow = 0.4 * mBow(t);
    // ----- Theo -----
    const sulk = tSulk(t);
    theo.rot = tRot(t) + (sulk > 0.5 ? Math.sin(t * 2.2) * 0.04 : 0);
    theo.lean = -0.08 * sulk + wob(t, CROWD + 0.6, 0.12, 3, 7);
    theo.sy = 1 - 0.06 * sulk;
    theo.sw = 1 + 0.1 * sulk;
    theo.open = tOpen(t);
    // ----- Jun -----
    const clap = jClap(t);
    const jph = (t * 6.5) % 1;
    jun.rot = jRot(t);
    jun.lean = wob(t, CROWD + 0.68, 0.14, 3, 7) + 0.08 * clap;
    jun.open = clap > 0.5 ? (jph < 0.4 ? Math.abs(1 - jph / 0.2) ** 0.6 : 1) * 1.2 : kf([[CROWD + 0.6, 1], [CROWD + 0.68, 1.55, ease.out], [WAVE0, 1.2], [WAVE1 + 0.3, 1]], ease)(t);
    jun.lift = clap * 0.07 * Math.abs(Math.sin(t * 3.25 * TAU));
    jun.sy = 1 + clap * 0.06 * Math.sin(t * 6.5 * TAU);
    jun.sw = 1 / Math.sqrt(jun.sy);
    for (const A of [maya, theo, jun]) A.apply();

    // ----- events -----
    once('touch', t >= TOUCH, () => {
      col.flash = arena.time;
      col.flashColor = new THREE.Color(RED);
      arena.clearCards();
      arena.setDim(0.42);
    });
    once('close', t >= CLOSE1, () => arena.setDim(dimFrom));
    once('bow1', t >= WAVE0 + 0.16, () => lab.ring(lab.pos(4, 1), RED, 1.1, 0.02, 0.8));
    once('bow2', t >= WAVE0 + 1.14, () => lab.ring(lab.pos(4, 1), RED, 1.4, 0.02, 0.9));
  });

  await lab.wait(END);
  stop();
  releaseCam();
  arena.setDim(dimFrom);
  maya.done(1);
  theo.done(3);
  jun.done(2);
}
