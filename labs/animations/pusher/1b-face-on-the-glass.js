// Pressed against the TV, acted: Maya flies face-first into the screen, blinks at us through the glass,
// slides down it, and is found back on the board still squashed flat, while Ava does a double-take
// between the TV (where Maya went) and the board (where Maya is).
export const meta = {
  title: 'Face on the glass',
  idea:
    'The plate fires and Maya is launched straight at us; she turns her face to the lens in horror as the camera rushes to meet her. SPLAT: she is pressed flat on the inside of the TV, a smear of red polish with her eye-light as one bright streak. The streak blinks twice, glances left and right, and she slides slowly down the screen leaving a smudge of light. The camera springs home and there she sits, one space south, still pressed flat, until she pops back into shape. Ava, revealed, is staring at the TV, then double-takes at tiny Maya and snickers.',
  notes:
    'Sound: a rising whoosh, a soft glass "thup" on contact, a rubbery squeak down the screen, a tiny "boing" when she pops back into shape. Only for panels that push toward the camera (south). Porting: the smear is a DOM layer in the HUD; the rest is the camera and the robot body (pitch, yaw, squash) on top of the game\'s own pose, so the pointer stays east throughout.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const outBack = (k, s = 1.4) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;
const inQuad = (k) => k * k;
const out3 = (k) => 1 - (1 - k) ** 3;
const damp = (t, f, d) => Math.exp(-d * t) * Math.sin(t * f);

/** Take a robot over with an "acting" layer on its body (pose stays the rules' pose: ring and pointer). */
function actor(lab, key) {
  const p = lab.puppet(key);
  const m = p.model;
  let eye = null;
  m.body.traverse((o) => {
    if (!eye && o.isMesh && o.material === m.eyeMat) eye = o;
  });
  const eyeBase = eye ? eye.scale.clone() : null;
  const act = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, dx: 0, dy: 0, dz: 0, eye: 1, eyeW: 1, eyeH: 1, glow: 0, ring: 1 };
  p.act = act;
  p.each = (model) => {
    const b = model.body;
    b.rotation.order = 'YXZ';
    b.rotation.set(act.pitch, act.yaw, -act.roll);
    b.scale.set(act.sx, act.sy, act.sz);
    b.position.x += act.dx;
    b.position.y += act.dy;
    b.position.z += act.dz;
    model.eyeMat.color.setRGB(3.2 * act.eye, 3.1 * act.eye, 2.9 * act.eye);
    if (eye) eye.scale.set(eyeBase.x * act.eyeH, eyeBase.y * act.eyeW, eyeBase.z * act.eyeH);
    model.paint.emissiveIntensity = 0.16 + act.glow;
    model.ringMat.opacity *= act.ring;
    model.poolMat.opacity *= act.ring;
  };
  p.finish = (state) => {
    p.each = null;
    const b = m.body;
    b.scale.set(1, 1, 1);
    b.rotation.order = 'XYZ';
    if (eye) eye.scale.copy(eyeBase);
    p.release(state);
  };
  return p;
}

/** Drive the camera, keeping the game's own centring offset (scaled by `keep`) so handing back is seamless. */
function driveCamera(lab, shot) {
  const A = lab.arena;
  const off = { sx: A.camCur?.sx ?? 0, sy: A.camCur?.sy ?? 0 };
  let last = null;
  return lab.camera((home, t) => {
    const dt = last == null ? 0 : t - last;
    last = t;
    const r = shot(home, t);
    const k = Math.min(0.9, dt * 4);
    if (A.camCur) {
      const keep = r.keep ?? 1;
      A.camCur.sx = (off.sx * keep) / (1 - k);
      A.camCur.sy = (off.sy * keep) / (1 - k);
    }
    return r;
  });
}

const svg = (tag, attrs = {}, parent) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
};

/** The smear on the TV's glass: her polish pressed flat, her eye-light one bright streak. */
function makeSmear(lab, color) {
  const root = svg('svg', { viewBox: '0 0 160 90', preserveAspectRatio: 'none', style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible' });
  const defs = svg('defs', {}, root);
  const grad = (id, stops, attrs = {}, kind = 'radialGradient') => {
    const g = svg(kind, { id, ...attrs }, defs);
    for (const [o, c, a = 1] of stops) svg('stop', { offset: String(o), 'stop-color': c, 'stop-opacity': String(a) }, g);
  };
  const blur = (id, sd, pad = 60) => svg('feGaussianBlur', { stdDeviation: String(sd) }, svg('filter', { id, x: `-${pad}%`, y: `-${pad * 2}%`, width: `${100 + pad * 2}%`, height: `${100 + pad * 4}%` }, defs));
  // the parts of her that curve away from the glass: deep, out of focus
  grad('smBody', [[0, color], [0.55, '#9d1634'], [1, '#2a0410', 0]], { cx: '0.5', cy: '0.45', r: '0.55' });
  // the flat patch pressed on the glass: brighter, even, a sheen toward the top
  grad('smPatch', [[0, '#ffd1da'], [0.18, '#ff8fa4'], [0.55, color], [1, '#d42a4d']], { x1: '0', y1: '0', x2: '0', y2: '1' }, 'linearGradient');
  grad('smTrail', [[0, color, 0.5], [1, color, 0]], { x1: '0', y1: '1', x2: '0', y2: '0' }, 'linearGradient');
  grad('smEye', [[0, '#fff', 0], [0.12, '#fffaf2'], [0.88, '#fffaf2'], [1, '#fff', 0]], { x1: '0', y1: '0', x2: '1', y2: '0' }, 'linearGradient');
  blur('smHalo', 9);
  blur('smOut', 3.2);
  blur('smEdge', 0.35);
  blur('smSoft', 1.1);
  blur('smGlow', 2.4, 80);

  const trail = svg('rect', { x: '30', y: '20', width: '100', height: '0', rx: '24', fill: 'url(#smTrail)', filter: 'url(#smSoft)', opacity: '0' }, root);
  const all = svg('g', {}, root);
  svg('ellipse', { cx: '80', cy: '47', rx: '78', ry: '44', fill: color, opacity: '0.35', filter: 'url(#smHalo)' }, all);
  svg('ellipse', { cx: '80', cy: '48', rx: '71', ry: '38', fill: 'url(#smBody)', filter: 'url(#smOut)' }, all);
  // the contact patch, crisp where polish meets glass, a little lopsided like a face on a window
  const patch = 'M 17 50 C 15 31, 44 18, 80 19 C 117 18, 146 31, 143 51 C 141 67, 114 75, 80 74 C 46 75, 19 67, 17 50 Z';
  svg('path', { d: patch, fill: 'url(#smPatch)', filter: 'url(#smEdge)' }, all);
  svg('path', { d: patch, fill: 'none', stroke: '#ffe3e8', 'stroke-opacity': '0.75', 'stroke-width': '0.7', filter: 'url(#smEdge)' }, all);
  // the softbox reflected in the flattened polish, and little squeezed glints along the rim
  svg('path', { d: 'M 36 30 C 50 23, 84 21, 108 24 C 92 27, 60 29, 38 34 Z', fill: '#fff', opacity: '0.7', filter: 'url(#smSoft)' }, all);
  svg('ellipse', { cx: '131', cy: '57', rx: '5', ry: '1.4', fill: '#fff', opacity: '0.55', filter: 'url(#smEdge)', transform: 'rotate(-38 131 57)' }, all);
  svg('ellipse', { cx: '27', cy: '60', rx: '3.5', ry: '1.1', fill: '#fff', opacity: '0.45', filter: 'url(#smEdge)', transform: 'rotate(35 27 60)' }, all);
  // the eye: one bright streak, its halo and its white-hot core
  const eye = svg('g', {}, all);
  svg('rect', { x: '32', y: '40', width: '96', height: '9', rx: '4.5', fill: '#ffd9cf', opacity: '0.9', filter: 'url(#smGlow)' }, eye);
  const core = svg('rect', { x: '36', y: '42.6', width: '88', height: '3.8', rx: '1.9', fill: 'url(#smEye)' }, eye);
  const ripple = svg('ellipse', { cx: '80', cy: '47', rx: '10', ry: '6', fill: 'none', stroke: '#fff', 'stroke-width': '0.8', opacity: '0', filter: 'url(#smEdge)' }, root);
  lab.overlay.append(root);

  return {
    root,
    /** slip (viewBox units down), squash, open (eye 0..1), look (-1..1), opacity, trailH, rip (0..1 ripple) */
    set({ slip = 0, sx = 1, sy = 1, open = 1, look = 0, down = 0, opacity = 1, trailH = 0, rip = -1 }) {
      all.setAttribute('transform', `translate(80 ${47 + slip}) scale(${sx} ${sy}) translate(-80 -47)`);
      root.style.opacity = String(opacity);
      eye.setAttribute('transform', `translate(${80 + look * 12} ${44.5 + down * 9}) scale(${(1 - Math.abs(look) * 0.25) * (1 - 0.3 * Math.abs(down))} ${Math.max(0.06, open)}) translate(-80 -44.5)`);
      core.setAttribute('opacity', String(0.5 + 0.5 * open));
      trail.setAttribute('y', String(47 + slip - 26 - trailH));
      trail.setAttribute('height', String(Math.max(0, trailH + 16)));
      trail.setAttribute('opacity', trailH > 0 ? String(Math.min(1, trailH / 8)) : '0');
      if (rip >= 0) {
        ripple.setAttribute('rx', String(70 + rip * 50));
        ripple.setAttribute('ry', String(38 + rip * 30));
        ripple.setAttribute('opacity', String(0.7 * (1 - rip) ** 2));
      } else ripple.setAttribute('opacity', '0');
    },
  };
}

export default async function play(lab) {
  const { THREE, facing } = lab;
  const A = lab.arena;
  const maya = actor(lab, 'a');
  const ava = actor(lab, 'b');
  const mayaBot = lab.bot('a');
  const pusher = A.pushers.get('3,1');
  const plateZ = 0.05;
  if (pusher) pusher.kick = null;
  const smear = makeSmear(lab, mayaBot.color);
  smear.set({ opacity: 0 });

  // timing (scene seconds; no slow motion, so these are real seconds too)
  const WIND = 0.1; // the plate draws back while Maya glances round at it
  const HIT = 0.13; // ...and slams into her
  const FIRE = 0.2; // launched
  const RUSH = 0.6; // she reaches the glass
  const PEEL = 1.1; // pressed until here, then the camera springs home
  const HOME = 1.8; // camera home
  const END = 1.9;

  const start = A.pos(3, 1.1);
  const origin = A.pos(0, 0);
  const EL = A.camHome.elev - 0.18;
  const camDir = new THREE.Vector3(0, Math.sin(EL), Math.cos(EL)); // board -> lens, the way she flies
  const FLY = 2.4; // how far toward the lens she flies (world units)
  const D0 = A.camHome.dist;
  const D1 = 0.95; // camera-to-Maya when she hits the glass
  const rushK = (k) => k ** 1.6; // her progress toward the lens
  const flyPos = (k) => start.clone().addScaledVector(camDir, FLY * rushK(k));
  const camDist = (k) => 1 / lerp(1 / D0, 1 / D1, k ** 1.5); // she swells steadily, then fills the screen

  let pressCam = null;
  const camAt = (T, home) => {
    if (T < FIRE) return { ...home, keep: 1 };
    if (T < RUSH) {
      const k = seg(T, FIRE, RUSH);
      const mp = flyPos(k).add(new THREE.Vector3(0, 0.2 * k, 0));
      const aim = smooth(Math.min(1, k * 1.6));
      return { target: home.target.clone().lerp(mp, aim), dist: camDist(k), el: lerp(home.el, EL, aim), fov: lerp(30, 40, k * k), roll: 0.07 * k * k, keep: 1 - aim };
    }
    if (!pressCam) pressCam = { target: flyPos(1).add(new THREE.Vector3(0, 0.2, 0)), dist: D1, el: EL, fov: 40, roll: 0.07 };
    if (T < PEEL) {
      // pressed: the glass gives a hair, then holds
      const k = seg(T, RUSH, RUSH + 0.12);
      return { ...pressCam, dist: D1 - 0.06 * Math.sin(k * Math.PI), keep: 0 };
    }
    const k = seg(T, PEEL, HOME);
    const e = outBack(k, 1.0);
    return {
      target: pressCam.target.clone().lerp(home.target, e),
      dist: lerp(D1, home.dist, e),
      el: lerp(EL, home.el, e),
      fov: lerp(40, 30, Math.min(1, e)),
      roll: lerp(0.07, 0, Math.min(1, e)),
      keep: clamp01(e),
    };
  };

  const t0 = lab.t;
  let landed = false;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    const ma = maya.act;
    const aa = ava.act;

    // ---- the plate: draws back, slams out, and eases home after she's gone
    if (pusher) {
      const out = T < WIND ? -0.05 * smooth(seg(T, 0, WIND)) : T < HIT ? lerp(-0.05, 0.36, out3(seg(T, WIND, HIT))) : lerp(0.36, 0, smooth(seg(T, 0.5, 1.2)));
      pusher.plate.position.z = plateZ + out;
    }

    // ---- Maya
    mayaBot.tag && (mayaBot.tag.userData.hide = T > FIRE && T < HOME - 0.2);
    if (T < HIT) {
      // "hm?" she glances over her left shoulder at the panel just as it winds up
      const k = seg(T, 0.02, WIND);
      maya.set({ x: 3, y: 1, rot: facing(1), lift: 0, trail: false });
      ma.yaw = 0.7 * smooth(k);
      ma.pitch = 0.06 * smooth(k);
    } else if (T < FIRE) {
      // smack, in the face: squashed sideways, eye pops wide
      const k = seg(T, HIT, FIRE);
      maya.set({ x: 3, y: 1 + 0.1 * out3(k), rot: facing(1), lift: 0, trail: false });
      ma.yaw = lerp(0.7, 0.2, out3(k));
      ma.sx = 1 - 0.4 * Math.sin(Math.min(1, k * 1.4) * Math.PI) ** 0.5;
      ma.sy = 1 + 0.2 * Math.sin(k * Math.PI);
      ma.roll = -0.3 * Math.sin(k * Math.PI);
      ma.eye = 1 + 1.5 * k;
      ma.eyeH = 1 + 1.8 * k;
    } else if (T < RUSH) {
      // launched at the lens: she turns her face to us in horror and stretches with the speed
      const k = seg(T, FIRE, RUSH);
      const mp = flyPos(k);
      maya.set({ x: mp.x - origin.x, y: mp.z - origin.z, lift: mp.y, rot: facing(1), trail: false });
      const face = smooth(Math.min(1, k * 2.2));
      ma.yaw = lerp(0.2, -Math.PI / 2, face); // body turns to face us (south); her pointer stays east
      ma.pitch = -0.3 * face; // and tips her top toward the lens, so her wide eye stares right at us
      ma.roll = 0.3 * Math.sin(k * 11) * (1 - k);
      ma.sx = 1;
      ma.sy = 1 + 0.15 * Math.sin(k * Math.PI);
      ma.sz = 1 + 0.2 * Math.sin(k * Math.PI);
      ma.eye = 2.6;
      ma.eyeH = 2.8;
      ma.ring = 1 - smooth(Math.min(1, k * 3));
    } else {
      // SPLAT: she's on the TV now. On the board she already sits one space south (shown once we pull back).
      if (!landed) {
        landed = true;
        const a = A.pos(3, 1);
        const b = A.pos(3, 2);
        for (let i = 0; i <= 12; i++) mayaBot.trail.push({ x: lerp(a.x, b.x, i / 12), z: lerp(a.z, b.z, i / 12), t: lab.t - 0.4 + (i / 12) * 0.3 });
      }
      maya.set({ x: 3, y: 2, lift: 0, rot: facing(1), trail: false, visible: T > PEEL + 0.1 });
      ma.ring = 1;
      ma.pitch = 0;
      ma.yaw = 0;
      ma.roll = 0;
      // still pressed flat, face-first toward us like a coin on the glass, then BOING back into shape
      // (local x is south, toward the TV; local z runs along her heading)
      const pop = seg(T, 1.5, 1.86);
      const flat = 1 - outElastic(pop);
      ma.sx = 1 - 0.55 * flat;
      ma.sz = 1 + 0.35 * flat;
      ma.sy = 1 - 0.3 * flat;
      // dazed: a woozy roll and a flickering eye, until the boing wakes her up
      const daze = 1 - seg(T, 1.5, 1.62);
      ma.roll = 0.2 * Math.sin(T * 10) * daze;
      ma.eye = T < 1.5 ? (Math.sin(T * 45) > 0.2 ? 0.3 : 1) : 1 + 1.2 * Math.sin(seg(T, 1.5, 1.8) * Math.PI);
      ma.eyeH = T < 1.5 ? 0.5 : 1 + 1.5 * Math.sin(seg(T, 1.5, 1.8) * Math.PI);
    }

    // ---- the smear on the TV's glass
    if (T >= RUSH) {
      const p = T - RUSH;
      const hit = seg(p, 0, 0.1);
      const wob = damp(p, 34, 10);
      const grow = lerp(0.62, 1, out3(hit));
      // blink ... blink ... a sheepish glance left, right ... then down: "uh-oh"
      const b1 = Math.sin(seg(p, 0.08, 0.13) * Math.PI);
      const b2 = Math.sin(seg(p, 0.17, 0.22) * Math.PI);
      const open = 1 - 0.95 * Math.max(b1, b2);
      const look = -Math.sin(seg(p, 0.24, 0.3) * Math.PI) + Math.sin(seg(p, 0.3, 0.36) * Math.PI);
      const down = smooth(seg(p, 0.36, 0.41));
      // then she slips: a creep, then gravity wins and she slides off the bottom of the screen
      const s = seg(T, PEEL - 0.12, PEEL + 0.32);
      const slip = 4 * smooth(Math.min(1, s * 3)) + 96 * Math.max(0, s - 0.2) ** 2 / 0.64;
      const fade = 1 - smooth(seg(T, PEEL + 0.1, PEEL + 0.4));
      smear.set({
        slip,
        sx: grow * (1 + 0.14 * wob) * (1 - 0.1 * s),
        sy: grow * (1 - 0.14 * wob) * (1 + 0.22 * s),
        open: open * (1 - 0.25 * down) + 0.6 * s,
        look: look * 0.9,
        down: down * (1 - s) - 1.2 * s,
        opacity: fade,
        trailH: slip * 0.8,
        rip: seg(p, 0, 0.3),
      });
    }

    // ---- Ava, the witness. Watches Maya fly at the TV; revealed still staring at it, double-takes, snickers.
    if (T < PEEL) {
      const k = seg(T, 0.14, RUSH);
      aa.yaw = 0.95 * smooth(k); // she faces west, so turning left (+) looks at the camera
      aa.pitch = -0.3 * smooth(k);
      aa.sy = 1 + 0.1 * smooth(k);
      aa.eye = 1 + 1.4 * smooth(k);
    } else {
      const look = seg(T, 1.34, 1.42); // whip to tiny Maya
      const back = seg(T, 1.48, 1.53); // double-take back at the TV ...
      const again = seg(T, 1.58, 1.65); // ... and back to Maya
      let yaw = 0.95;
      yaw = lerp(yaw, -0.5, out3(look));
      yaw = lerp(yaw, 0.7, out3(back));
      yaw = lerp(yaw, -0.45, out3(again));
      yaw = lerp(yaw, 0, smooth(seg(T, 1.78, END)));
      aa.yaw = yaw;
      const giggle = T > 1.64 && T < 1.84 ? Math.abs(Math.sin((T - 1.64) * 40)) * (1 - seg(T, 1.64, 1.84)) : 0;
      aa.pitch = lerp(-0.3, 0, smooth(seg(T, 1.34, 1.46))) + 0.12 * giggle;
      aa.sy = lerp(1.1, 1, smooth(seg(T, 1.34, 1.46))) + 0.14 * Math.sin(seg(T, 1.48, 1.56) * Math.PI) - 0.05 * giggle;
      aa.eye = T < 1.64 ? 2.4 : lerp(2.4, 1, seg(T, 1.64, END));
    }
  });
  // the name tag hides while she's in flight (the game re-shows it every frame, so hide it after)
  const prevEach = maya.each;
  maya.each = (m, t) => {
    prevEach(m, t);
    if (mayaBot.tag?.userData.hide) mayaBot.tag.visible = false;
  };

  const releaseCam = driveCamera(lab, (home, t) => camAt(t - t0, home));
  await lab.wait(END);
  stop();
  releaseCam();
  if (pusher) pusher.plate.position.z = plateZ;
  smear.root.remove();
  if (mayaBot.tag) mayaBot.tag.userData.hide = false;
  maya.finish({ x: 3, y: 2, d: 1 });
  ava.finish({ x: 5, y: 3, d: 3 });
}

function outElastic(k) {
  return k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((Math.PI * 2) / 3)) + 1;
}
