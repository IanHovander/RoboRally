// Edge, idea 2 (Off the TV), animator b: character acting.
// Maya never looks down. She struts off the rim on thin air, still drawing her trail, and drives right out of the
// TV picture. Ava does the double take for her, then cranes at the edge of the screen. A beat of nothing. Then Maya
// drops in from the top of the screen, huge, right in front of us, still in her driving pose... stops dead, sees
// US, and plummets out of the bottom of the picture. Ava, who saw none of that, shrugs and gets back to work.
export const meta = {
  title: 'Off the TV: she never looked down',
  idea:
    'Maya struts off the rim without noticing and keeps driving on thin air, trailing red, straight out of the right ' +
    'side of the TV. Ava does the double take for her and cranes after her at the edge of the screen. A beat of empty ' +
    'frame. Then Maya drops in from the top of the screen, big and right in front of the camera, still level as if ' +
    'driving: she stops in mid-air, her eye pops, she turns and looks straight at us, and plummets out of the bottom ' +
    'of the picture, her eye and ring smearing red light. The board is never touched. Ava, who missed all of it, shrugs.',
  notes:
    'Sound: her usual drive hum carries on over the rim with no change at all (the joke), and is cut off by the right ' +
    'edge of the screen like a car driving out of earshot. Silence for the empty frame. A soft glass "fwip" as she drops ' +
    'in, nothing during the stare (one tiny tick when her eye pops), then a falling glass whistle that Doppler-drops as ' +
    'she leaves the bottom of the picture. Ava gets a quizzical two-note chirp for the shrug. Port: the close fall is ' +
    'placed in screen space (a ray from the camera, about a third of the way to the board), so it works with any ' +
    'board size and camera; the trail over the void is just the normal trail drawn while the robot is still at glass ' +
    'height; it fades early at the end so nothing pops when the game takes over.',
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0

/** A camera-facing ribbon of light through points (for the eye's smear). */
function makeRibbon(lab, N) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.35, '#666');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.65, '#666');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const map = new THREE.CanvasTexture(c);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6);
  const col = new Float32Array(N * 6);
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  lab.add(mesh);
  const t = new THREE.Vector3();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    /** pts: [{ p, w, r, g, b }] */
    draw(pts) {
      const m = Math.min(N, pts.length);
      if (m < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < m; i++) {
        const P = pts[i].p;
        t.subVectors(pts[Math.min(m - 1, i + 1)].p, pts[Math.max(0, i - 1)].p);
        if (t.lengthSq() < 1e-9) t.set(0, 1, 0);
        v.subVectors(cam, P);
        s.crossVectors(t, v).normalize().multiplyScalar(pts[i].w);
        pos.set([P.x - s.x, P.y - s.y, P.z - s.z, P.x + s.x, P.y + s.y, P.z + s.z], i * 6);
        const q = pts[i];
        col.set([q.r, q.g, q.b, q.r, q.g, q.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (m - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  ava.set({ trail: false });
  const red = new THREE.Color(mb.color);
  const mayaEye = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const ring = maya.group.children.find((o) => o.material === maya.model.ringMat && o.geometry?.type === 'RingGeometry');

  // ---------------- the timeline (moment seconds) ----------------
  const P = {
    ant: [0.0, 0.14], // a little rock back: here we go
    go: 0.14, // she sets off
    rim: 0.875, // her centre passes the rim (computed from the drive below)
    gone: 1.5, // fully out of the right side of the picture
    fall: [1.76, 2.66], // the close fall through the frame
    shrug: [2.62, 2.98], // Ava gives up and turns back
    end: 3.02,
  };
  const V = 4; // cruise speed, spaces per second
  const ACC = 0.22; // seconds to reach it
  const driveX = (T) => {
    const t = Math.max(0, T - P.go);
    return t < ACC ? 4 + (V * t * t) / (2 * ACC) : 4 + (V * ACC) / 2 + V * (t - ACC);
  };

  // ---------------- the close fall: placed along rays from the camera, in screen space ----------------
  const D = 4.7; // distance from the camera (the board is ~10.8 away): she's two and a half times her size
  const cam = lab.camera3;
  const ray = (nx, ny) => {
    cam.updateMatrixWorld();
    const p = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
    return p.sub(cam.position).normalize().multiplyScalar(D).add(cam.position);
  };
  const toPose = (w) => ({ x: w.x + 3, y: w.z + 1.5, lift: w.y }); // world → puppet (this board is 7 x 4)
  // her screen height over the fall: in, stop dead (she notices), then plummet
  const F = { stop: 0.2, pop: [0.22, 0.26], look: [0.26, 0.4], drop: 0.58 }; // fractions of the fall
  const fallNY = (k) => {
    if (k < F.stop) return lerp(1.45, 0.28, ease.out(k / F.stop));
    if (k < F.drop) return 0.28 + 0.02 * Math.sin(seg(k, F.stop, F.drop) * Math.PI); // the hang
    return lerp(0.28, -1.6, ease.in(seg(k, F.drop, 1)));
  };
  const NX = 0.42;
  // the turn that points her face at the camera from where she hangs (the short way round from facing east)
  const hangAt = ray(NX, 0.3);
  let camFacing = Math.atan2(-(cam.position.x - hangAt.x), -(cam.position.z - hangAt.z));
  while (camFacing - facing(1) > Math.PI) camFacing -= Math.PI * 2;
  while (camFacing - facing(1) < -Math.PI) camFacing += Math.PI * 2;

  // ---------------- Maya ----------------
  const mayaPose = (T) => {
    const o = { x: 4, y: 1, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, eye: 1, eyeW: 1, visible: true, trail: true, pool: 1 };
    if (T < P.ant[1]) {
      const k = seg(T, ...P.ant);
      o.pitch = -0.18 * bump(k);
      o.sy = 1 - 0.08 * bump(k);
      o.sx = 1 + 0.06 * bump(k);
      o.x = 4 - 0.04 * bump(k);
      o.eye = 1 + 0.4 * bump(k);
    } else if (T < P.gone + 0.02) {
      // the strut: a bounce in her step, a sway like she's humming, eye half-closed with contentment
      o.x = driveX(T);
      const ph = (T - P.go) * 11;
      o.lift = 0.03 * Math.abs(Math.sin(ph));
      o.roll = 0.07 * Math.sin(ph * 0.5);
      o.pitch = 0.08 * smooth(seg(T, P.go, P.go + 0.2));
      o.sy = 1 + 0.035 * Math.sin(ph * 2);
      o.eyeW = 0.62;
      o.eye = 1.25;
      // over the void there is no glass for her glow to land on: the pool goes, she doesn't notice
      o.pool = 1 - smooth(seg(o.x, 6.4, 6.9));
    } else if (T < P.fall[0]) {
      o.visible = false;
      o.trail = false;
      o.x = 9.5;
    } else if (T < P.fall[1]) {
      const k = seg(T, ...P.fall);
      const ny = fallNY(k);
      Object.assign(o, toPose(ray(NX - 0.06 * seg(k, F.drop, 1), ny)));
      o.trail = false;
      o.pool = 0.25;
      // entering: still level and driving east, perfectly content
      o.rot = facing(1);
      o.eyeW = 0.62;
      o.eye = 1.25;
      o.pitch = 0.08;
      // the hang: her eye pops, then she turns and looks straight up the ray at us
      const pop = smooth(seg(k, ...F.pop));
      o.eyeW = lerp(0.62, 2.3, pop);
      o.eye = lerp(1.25, 2.6, pop);
      o.sy = 1 + 0.16 * bump(seg(k, F.pop[0], F.look[0] + 0.06)) - 0.12 * bump(seg(k, F.stop - 0.06, F.pop[0])); // the stop squashes her, the jolt stretches her
      o.sx = 1 - 0.06 * bump(seg(k, F.pop[0], F.look[0] + 0.06)) + 0.08 * bump(seg(k, F.stop - 0.06, F.pop[0]));
      const look = smooth(seg(k, ...F.look));
      o.rot = lerp(facing(1), camFacing, look);
      o.pitch = lerp(0.08, -0.85, look); // tipped back to face the camera, which is above her
      // the plummet: stretched, tumbling slowly backward and over
      o.eyeW *= 1 + 0.12 * bump(seg(k, F.look[1], F.drop)); // a tiny hopeful widening while she stares
      o.eyeW *= 1 - 0.93 * bump(seg(k, F.drop - 0.12, F.drop - 0.05)); // one slow deadpan blink at us
      const fk = seg(k, F.drop, 1);
      o.pitch -= 2.6 * ease.in(fk);
      o.roll = 0.9 * ease.in(fk);
      o.sy *= 1 + 0.3 * smooth(seg(fk, 0, 0.4));
      o.sx *= 1 - 0.1 * smooth(seg(fk, 0, 0.4));
      o.eye *= 1 - 0.35 * fk;
    } else {
      o.visible = false;
      o.trail = false;
      o.x = 9.5;
    }
    return o;
  };

  // ---------------- Ava: the double take, the crane, the head tilt, the shrug ----------------
  const LOOK_RIM = -1.15; // toward the rim near Maya's row
  const LOOK_EDGE = -1.42; // toward the right edge of the screen
  const avaPose = (T) => {
    const o = { x: 2, y: 3, lift: 0, rot: facing(0), pitch: 0, roll: 0, sx: 1, sy: 1, eye: 1 };
    // she follows Maya with her eyes as she drives past
    let rot = LOOK_RIM * 0.75 * smooth(seg(T, 0.4, 0.75));
    // the double take: a glance back to her own business... then snap!
    rot += 0.45 * bump(seg(T, 0.86, 1.04));
    const take = smooth(seg(T, 1.0, 1.08));
    rot = lerp(rot, LOOK_RIM, take);
    o.sy += 0.2 * bump(seg(T, 1.0, 1.22));
    o.sx -= 0.07 * bump(seg(T, 1.0, 1.22));
    o.lift += 0.05 * bump(seg(T, 1.0, 1.16));
    o.eye += 1.6 * smooth(seg(T, 1.0, 1.05)) * (1 - smooth(seg(T, 1.3, 1.6)));
    // she cranes after her toward the edge of the screen
    rot = lerp(rot, LOOK_EDGE, smooth(seg(T, 1.15, 1.5)));
    o.pitch += 0.22 * smooth(seg(T, 1.2, 1.5));
    o.x += 0.06 * smooth(seg(T, 1.2, 1.5));
    // the empty frame: a slow, puzzled head tilt
    o.roll += 0.24 * smooth(seg(T, 1.56, 1.85));
    // the shrug: up, down, and back to work (facing north)
    const s = seg(T, ...P.shrug);
    const back = smooth(seg(s, 0.35, 1));
    o.sy += 0.13 * bump(seg(s, 0, 0.3)) - 0.05 * bump(seg(s, 0.3, 0.55));
    o.lift += 0.03 * bump(seg(s, 0, 0.3));
    o.roll *= 1 - back;
    o.pitch *= 1 - back;
    o.x = lerp(o.x, 2, back);
    rot = lerp(rot, facing(0), back);
    rot += 0.05 * Math.sin(s * Math.PI * 3) * (1 - s) * (s > 0 ? 1 : 0); // a little settling waggle
    o.rot = rot;
    return o;
  };

  // ---------------- her smear while she falls: ghost rings and a ribbon behind her eye ----------------
  const GH = 5;
  const ghosts = [];
  for (let i = 0; i < GH; i++) {
    const m = new THREE.Mesh(ring.geometry, new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.matrixAutoUpdate = false;
    m.renderOrder = 6;
    lab.add(m);
    ghosts.push(m);
  }
  const eyeTrail = [];
  const ribbon = makeRibbon(lab, 24);
  const eyeAt = new THREE.Vector3();

  lab.playCard('a', ['m3']);
  const t0 = lab.t;
  let T = 0;
  const stop = lab.every(() => {
    T = lab.t - t0;
    const m = mayaPose(T);
    maya.set({ x: m.x, y: m.y, lift: m.lift, rot: m.rot, pitch: m.pitch, roll: m.roll, sx: m.sx, sy: m.sy, sz: m.sx, visible: m.visible, trail: m.trail });
    maya.look = m;
    const a = avaPose(T);
    ava.set({ x: a.x, y: a.y, lift: a.lift, rot: a.rot, pitch: a.pitch, roll: a.roll, sx: a.sx, sy: a.sy, sz: a.sx });
    ava.look = a;
  });

  maya.each = (model) => {
    const look = maya.look;
    model.eyeMat.color.setRGB(3.2 * look.eye, 3.1 * look.eye, 2.9 * look.eye);
    if (mayaEye) mayaEye.scale.set(look.eyeW, 1, look.eyeW);
    model.poolMat.opacity *= look.pool;
    // her card rides out of the picture with her, and is gone when she comes back in
    if (mb.card) {
      mb.card.visible = look.visible && T < P.gone;
    }
    // smears, only while she falls through the frame
    const falling = T > P.fall[0] && T < P.fall[1] + 0.3;
    maya.group.updateMatrixWorld(true);
    for (let i = GH - 1; i > 0; i--) ghosts[i].matrix.copy(ghosts[i - 1].matrix);
    ghosts[0].matrix.copy(ring.matrixWorld);
    const speed = falling && look.visible ? clamp(Math.abs(look._vy ?? 0) * 6) : 0;
    for (let i = 0; i < GH; i++) ghosts[i].material.opacity = falling ? (1 - i / GH) ** 1.5 * 0.45 * speed : 0;
    if (mayaEye && look.visible && falling) {
      mayaEye.getWorldPosition(eyeAt);
      eyeTrail.push({ p: eyeAt.clone(), t: lab.t });
    }
    while (eyeTrail.length && lab.t - eyeTrail[0].t > 0.22) eyeTrail.shift();
    ribbon.draw(
      eyeTrail.map((e, i) => {
        const age = (lab.t - e.t) / 0.22;
        const k = (1 - age) ** 1.4 * Math.min(1, i / 2);
        return { p: e.p, w: 0.05 * (1 - 0.5 * age), r: lerp(red.r, 1, 1 - age) * 3 * k, g: lerp(red.g, 0.9, 1 - age) * 3 * k, b: lerp(red.b, 0.85, 1 - age) * 3 * k };
      }),
    );
  };
  // vertical speed for the smear (in screen units per second)
  let lastNY = null;
  const stopV = lab.every((dt) => {
    const k = seg(T, ...P.fall);
    const ny = fallNY(k);
    if (maya.look) maya.look._vy = lastNY == null || dt <= 0 ? 0 : (ny - lastNY) / dt / 4;
    lastNY = ny;
  });
  ava.each = (model) => {
    const e = ava.look.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };

  // her trail (on the glass and over the void) fades a little early, so nothing pops when the game takes over
  const fadeFrom = new Map();
  lab.at(P.end - 0.45, () => {
    for (const p of mb.trail) fadeFrom.set(p, p.t);
  });
  const stopFade = lab.every(() => {
    const k = seg(T, P.end - 0.45, P.end - 0.02);
    if (k <= 0) return;
    for (const p of mb.trail) {
      const t0p = fadeFrom.get(p) ?? p.t;
      const age = lab.t - t0p;
      p.t = lab.t - lerp(age, 3.25, ease.in(k));
    }
  });

  await lab.wait(P.end);
  stop();
  stopV();
  stopFade();
  mb.trail = [];
  maya.release({ x: 7, y: 1, d: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
