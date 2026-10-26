// Edge, idea 4 (Skipping stone), animator b: character acting.
// Maya sees the rim coming, and instead of panicking she gets an idea: she flattens herself into a proper skipping
// stone and launches. She skims the dark, spinning, one, two, three, each touch spreading wide slow rings of light
// over the black as if the void were a still lake. On the third touch she stops, pops back up to her full height
// with a delighted "ta-da" to the room... looks down... and sinks, eye last, with one small plip. Ava counts the
// skips with a little bounce each time, and bows her head at the end.
export const meta = {
  title: 'Skipping stone: ta-da, glub',
  idea:
    'Maya is a Pebble, so when she sees the rim coming she flattens herself and skims. She meets the darkness just ' +
    'below glass height and skips across it, spinning, one, two, three, each hop shorter; every touch spreads wide, slow ' +
    'rings of soft light over the black, as if the void were a still lake. On the third touch she stops, pops up to ' +
    'her full height and beams at the room (ta-da!), looks down, and sinks, eye last, with one small ripple. Ava ' +
    'bounces along counting the skips, then bows her head.',
  notes:
    'Sound: a soft glass "tick" as she tucks, then three water-glass "plinks" rising in pitch, each with a long, quiet ' +
    'shimmer that matches its rings; a bright little chime for the ta-da, a held hush, then a low hollow "gloop" and ' +
    'one tiny plip. The three skips echo the Move 3 card. Port: the rings are flat soft-ring sprites on a plane just ' +
    'below the glass (the slab hides them where they pass under it, which is what makes the dark read as water around ' +
    'a floating slab); she sinks behind an invisible depth-only disc at the waterline. The camera pans a little east ' +
    'for the lake and comes home on its own values (no jump when it lets go).',
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0

/** The picture's centring offset when the camera is at home (what scene.js placeCamera settles on). */
function homeOffset(lab) {
  const { THREE } = lab;
  const A = lab.arena;
  const h = A.camHome;
  const cam = A.camera.clone();
  cam.view = null;
  cam.updateProjectionMatrix();
  cam.position.set(h.target.x, h.target.y + Math.sin(h.elev) * h.dist, h.target.z + Math.cos(h.elev) * h.dist);
  cam.lookAt(h.target);
  cam.updateMatrixWorld();
  let x0 = 9;
  let x1 = -9;
  let y0 = 9;
  let y1 = -9;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const v = new THREE.Vector3((x * A.course.w) / 2, 0, (z * A.course.h) / 2).project(cam);
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  return { sx: (A.frame.left - A.frame.right) / 2 - (x0 + x1) / 2, sy: (A.frame.bottom - A.frame.top) / 2 - (y0 + y1) / 2 };
}

/**
 * Take the camera relative to its home. fn() returns { move: Vector3, zoom, el, free } where free (0..1) lets the
 * picture's centring go (0 keeps it exactly as at home, so letting go at zero is seamless).
 */
function rig(lab, fn) {
  const A = lab.arena;
  const off = homeOffset(lab);
  let sx = A.camCur?.sx ?? off.sx;
  let sy = A.camCur?.sy ?? off.sy;
  return lab.camera((home, t) => {
    const r = fn() ?? {};
    const free = r.free ?? 0;
    const dt = A.dt;
    const e = Math.min(1, dt * 6);
    sx += (off.sx * (1 - free) - sx) * e;
    sy += (off.sy * (1 - free) - sy) * e;
    const k = Math.min(1, dt * 4); // lab.js eases the centring away at this rate; hand it what we want instead
    if (A.camCur && k < 1) {
      A.camCur.sx = sx / (1 - k);
      A.camCur.sy = sy / (1 - k);
    }
    const target = home.target.clone();
    if (r.move) target.add(r.move);
    return { target, az: Math.sin(t * 0.07) * 0.03, el: home.el + (r.el ?? 0), dist: home.dist * (r.zoom ?? 1) };
  });
}

function ringTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0)');
  grad.addColorStop(0.9, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.955, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.98, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export default async function play(lab) {
  const { THREE, ease, facing, PALETTE } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  ava.set({ trail: false });
  const red = new THREE.Color(mb.color);
  const warm = new THREE.Color(PALETTE.light);
  const mayaEye = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const WATER = -0.06; // the lake's surface, just under the glass

  // ---------------- the timeline (moment seconds) ----------------
  const GO = 0.14;
  const ACC = 0.2;
  const V = 3.68;
  const RIM = 0.92; // she leaves the rim
  const TOUCH = [1.37, 1.73, 2.0]; // one, two, three
  const XS = [6.5, 7.2, 7.65, 7.9]; // where she leaves the rim, and where she touches
  const HOP = [0.24, 0.14, 0.07]; // how high each hop goes
  const STOP = [2.0, 2.12]; // she slides to a stop on the third touch
  const TADA = [2.08, 2.34]; // pops back up to her full height, beaming at the room
  const LOOKDOWN = [2.34, 2.46];
  const SINK = [2.44, 2.8];
  const UNDER = 2.66; // her eye goes under
  const END = 3.2;
  const driveX = (T) => {
    const t = Math.max(0, T - GO);
    return t < ACC ? 4 + (V * t * t) / (2 * ACC) : 4 + (V * ACC) / 2 + V * (t - ACC);
  };

  // ---------------- Maya ----------------
  let spin = 0; // accumulated spin while skimming
  const spinRate = (T) => (T < RIM - 0.04 ? 0 : T < TOUCH[2] ? lerp(19, 7, seg(T, RIM, TOUCH[2])) : T < STOP[1] ? lerp(7, 0, seg(T, TOUCH[2], STOP[1])) : 0);
  let finalRot = null;
  let finalFrom = 0;
  const mayaPose = (T) => {
    const o = { x: 4, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, eye: 1, eyeW: 1, visible: true, trail: true };
    if (T < GO) {
      const k = seg(T, 0, GO);
      o.pitch = -0.18 * bump(k);
      o.sy = 1 - 0.08 * bump(k);
      o.sx = o.sz = 1 + 0.06 * bump(k);
      o.x = 4 - 0.04 * bump(k);
    } else if (T < RIM) {
      o.x = driveX(T);
      o.pitch = 0.08 * smooth(seg(T, GO, GO + 0.2));
      o.lift = 0.02 * Math.abs(Math.sin((T - GO) * 11));
      // she spots the rim: a quick wide-eyed take...
      const take = bump(seg(T, 0.6, 0.74));
      o.eyeW = 1 + 1.2 * take;
      o.eye = 1 + 1.0 * take;
      // ...then an idea: she flattens herself into a skipping stone, eye narrowed with intent
      const tuck = smooth(seg(T, 0.72, 0.86));
      o.sy = lerp(1, 0.58, tuck) + 0.06 * bump(seg(T, 0.7, 0.76));
      o.sx = o.sz = lerp(1, 1.2, tuck);
      o.eyeW = lerp(o.eyeW, 0.45, tuck);
      o.eye = lerp(o.eye, 1.9, tuck);
      o.pitch = lerp(o.pitch, -0.1, tuck);
    } else if (T < STOP[0]) {
      // skimming: three hops, each shorter and lower, spinning flat
      const i = T < TOUCH[0] ? 0 : T < TOUCH[1] ? 1 : 2;
      const a = i === 0 ? RIM : TOUCH[i - 1];
      const k = seg(T, a, TOUCH[i]);
      o.x = lerp(XS[i], XS[i + 1], k);
      const from = i === 0 ? 0 : WATER;
      o.lift = lerp(from, WATER, k) + 4 * HOP[i] * k * (1 - k);
      o.sy = 0.58;
      o.sx = o.sz = 1.2;
      // each touch squashes her flatter for a moment
      const kiss = i > 0 ? 1 - seg(T, a, a + 0.08) : 0;
      o.sy -= 0.16 * kiss;
      o.sx = o.sz = 1.2 + 0.08 * kiss;
      o.pitch = -0.12 * (1 - k) + 0.05 * k;
      o.eyeW = 0.45 + 0.25 * kiss;
      o.eye = 1.9 + 1.2 * kiss; // glee on every touch
      o.trail = false;
    } else {
      o.trail = false;
      // the third touch: she slides to a stop, floating, and pops up: ta-da!
      o.x = lerp(XS[3], XS[3] + 0.09, ease.out(seg(T, ...STOP)));
      const up = seg(T, ...TADA);
      const pop = ease.outBack(smooth(up), 2.4);
      o.sy = lerp(0.42, 1, pop);
      o.sx = o.sz = lerp(1.28, 1, pop);
      o.lift = WATER + 0.035 * bump(up);
      o.eyeW = lerp(0.7, 1.35, smooth(seg(up, 0.2, 0.6)));
      o.eye = lerp(3.0, 2.3, smooth(up));
      o.roll = 0.1 * Math.sin(up * Math.PI * 3) * (1 - up); // a pleased little wiggle
      // looks down at the "water"...
      const ld = smooth(seg(T, ...LOOKDOWN));
      o.pitch = 0.42 * ld;
      o.eyeW = lerp(o.eyeW, 0.85, ld);
      o.eye = lerp(o.eye, 1.5, ld);
      // ...and sinks, eye last, with a small tilt and a final blink of light as it goes under
      const s = seg(T, ...SINK);
      o.lift -= 0.62 * ease.in(s);
      o.roll += 0.18 * smooth(s);
      o.pitch += 0.15 * smooth(s);
      o.eye *= 1 - smooth(seg(T, UNDER - 0.04, UNDER + 0.04));
      o.visible = T < SINK[1];
    }
    if (finalRot != null) o.rot = finalRot;
    else o.rot = facing(1) - spin;
    return o;
  };

  // ---------------- Ava counts the skips ----------------
  const avaPose = (T) => {
    const o = { rot: facing(0), pitch: 0, roll: 0, sx: 1, sy: 1, lift: 0, eye: 1 };
    o.rot = -1.15 * smooth(seg(T, 0.35, 0.7)) * (1 - smooth(seg(T, 2.72, 3.08)));
    o.pitch = 0.12 * smooth(seg(T, 0.85, 1.1)); // leans in as Maya launches
    TOUCH.forEach((t, i) => {
      const b = bump(seg(T, t + 0.03, t + 0.2));
      o.sy += (0.13 + 0.03 * i) * b;
      o.sx -= 0.05 * b;
      o.lift += (0.045 + 0.01 * i) * b;
      o.eye += 1.0 * b;
    });
    // the ta-da: she perks up too
    o.sy += 0.08 * bump(seg(T, TADA[0], TADA[1]));
    // the sink: a sag and a bowed head, then back to work
    const sag = smooth(seg(T, UNDER - 0.08, UNDER + 0.1)) * (1 - smooth(seg(T, 2.82, 3.08)));
    o.sy -= 0.08 * sag;
    o.sx += 0.03 * sag;
    o.pitch = lerp(o.pitch, 0.3, sag) * (1 - smooth(seg(T, 2.82, 3.08)));
    o.eye *= 1 - 0.45 * sag;
    return o;
  };

  // ---------------- the lake: rings of light ----------------
  const ringTex = ringTexture(THREE);
  const ripples = [];
  const ripple = (x, R, dur, gain, tint, delay = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex, color: tint.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    const at = lab.pos(x, 1);
    m.position.set(at.x, WATER + 0.004, at.z);
    m.renderOrder = 4;
    lab.add(m);
    const start = lab.t + delay;
    ripples.push({ m, t0: start, R, dur: Math.min(dur, t0 + END - 0.05 - start), gain }); // all gone by the end
  };
  const kissTex = glowTexture(THREE);
  const kisses = [];
  const kiss = (x, size, gain) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: kissTex, color: warm.clone().lerp(red, 0.35).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    const at = lab.pos(x, 1);
    m.position.set(at.x, WATER + 0.006, at.z);
    m.renderOrder = 5;
    lab.add(m);
    kisses.push({ m, t0: lab.t, size, gain });
  };
  const rippleTint = (k) => warm.clone().lerp(red, k).multiplyScalar(1.6);
  const splash = (x, n, R, gain) => {
    kiss(x, 0.7 * gain + 0.3, gain);
    for (let j = 0; j < n; j++) ripple(x, R * (1 - 0.3 * j), 1.6 - 0.2 * j, gain * (1 - 0.3 * j), rippleTint(j === 0 ? 0.4 : 0.1), 0.17 * j);
  };
  // a depth-only disc at the waterline, so she sinks INTO the dark instead of just falling through it
  const mask = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.MeshBasicMaterial({ colorWrite: false }));
  mask.rotation.x = -Math.PI / 2;
  const maskAt = lab.pos(XS[3] + 0.09, 1);
  mask.position.set(maskAt.x, WATER - 0.004, maskAt.z);
  mask.renderOrder = -5;
  mask.visible = false;
  lab.add(mask);

  // ---------------- the camera: a little east, for the lake ----------------
  const t0 = lab.t;
  let T = 0;
  const releaseCam = rig(lab, () => {
    const k = smooth(seg(T, 0.45, 1.2)) * (1 - smooth(seg(T, 2.6, END - 0.02)));
    return { move: new THREE.Vector3(0.55 * k, 0, -0.1 * k), zoom: 1 - 0.05 * k, free: k };
  });

  lab.playCard('a', ['m3']);
  let last = lab.t;
  const fired = new Set();
  const stop = lab.every(() => {
    T = lab.t - t0;
    const dt = lab.t - last;
    last = lab.t;
    spin += spinRate(T) * dt;
    if (T >= STOP[1] && finalRot == null) {
      // she comes to rest turned toward the room, for the ta-da
      const now = facing(1) - spin;
      const want = facing(2) - 0.35;
      finalRot = now + ((((want - now) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      finalFrom = now;
    }
    const m = mayaPose(T);
    if (finalRot != null) m.rot = lerp(finalFrom, finalRot, ease.out(seg(T, STOP[1] - 0.0, TADA[1])));
    maya.set({ x: m.x, y: 1, lift: m.lift, rot: m.rot, pitch: m.pitch, roll: m.roll, sx: m.sx, sy: m.sy, sz: m.sz, visible: m.visible, trail: m.trail });
    maya.look = m;
    const a = avaPose(T);
    ava.set({ x: 2, y: 3, lift: a.lift, rot: a.rot, pitch: a.pitch, roll: a.roll, sx: a.sx, sy: a.sy, sz: a.sx });
    ava.look = a;

    // the touches
    const once = (key, at, fn) => {
      if (T >= at && !fired.has(key)) {
        fired.add(key);
        fn();
      }
    };
    once('t1', TOUCH[0], () => splash(XS[1], 2, 2.5, 0.85));
    once('t2', TOUCH[1], () => splash(XS[2], 2, 1.9, 0.7));
    once('t3', TOUCH[2], () => splash(XS[3], 1, 1.2, 0.55));
    once('mask', SINK[0], () => (mask.visible = true));
    once('plip', UNDER, () => {
      kiss(XS[3] + 0.09, 0.4, 0.5);
      ripple(XS[3] + 0.09, 0.75, 0.75, 0.55, rippleTint(0.3));
    });

    for (const r of ripples) {
      const k = (lab.t - r.t0) / r.dur;
      if (k < 0 || k > 1) {
        r.m.visible = false;
        continue;
      }
      r.m.visible = true;
      const s = 0.12 + r.R * ease.out3(k);
      r.m.scale.set(s, s, 1);
      r.m.material.opacity = r.gain * smooth(clamp(k / 0.06)) * (1 - k) ** 1.6;
    }
    // her trail on the glass fades out a little early, so nothing pops at the hand-over
    const fk = seg(T, END - 0.45, END - 0.02);
    if (fk > 0) for (const p of mb.trail) p.t = Math.min(p.t, lab.t - lerp(lab.t - p.t, 3.25, ease.in(fk)));
    for (const q of kisses) {
      const k = (lab.t - q.t0) / 0.35;
      q.m.visible = k >= 0 && k <= 1;
      const s = q.size * (0.5 + ease.out(clamp(k)));
      q.m.scale.set(s, s, 1);
      q.m.material.opacity = q.gain * (1 - clamp(k)) ** 2;
    }
  });

  maya.each = (model) => {
    const look = maya.look;
    model.eyeMat.color.setRGB(3.2 * look.eye, 3.1 * look.eye, 2.9 * look.eye);
    if (mayaEye) mayaEye.scale.set(look.eyeW, 1, look.eyeW);
    if (!look.visible) model.poolMat.opacity = 0;
    // her card waits over the rim where she left the board, and goes out as she goes under
    const c = mb.card;
    if (c) {
      const at = lab.pos(Math.min(maya.pose.x, 6.5), 1);
      c.position.set(at.x, c.position.y - maya.pose.lift, at.z);
      const gone = smooth(seg(T, SINK[0], UNDER));
      c.material.opacity *= 1 - gone;
      c.visible = gone < 0.99;
    }
  };
  ava.each = (model) => {
    const e = ava.look.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };

  await lab.wait(END);
  stop();
  for (const r of ripples) r.m.visible = false;
  for (const q of kisses) q.m.visible = false;
  releaseCam();
  mb.trail = [];
  maya.release({ x: 7, y: 1, d: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
