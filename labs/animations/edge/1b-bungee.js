// Edge, idea 1 (Bungee), animator b: character acting.
// Maya struts off the rim, her own trail catches her like a bungee cord and hauls her back up, level with the
// glass. She turns to the room, eye wide with hope... looks up at the cord as it thins to a thread... and it
// snaps. The loose end whips back along the glass and cracks right in front of Ava, who flinches.
export const meta = {
  title: 'Bungee: the hopeful dangle',
  idea:
    'Maya drives off the rim and her own trail of light peels up off the glass and catches her like a bungee cord. ' +
    'It hauls her back up level with the glass, almost home: she turns to the room with her eye wide, beaming. Then she ' +
    'looks up at the cord, it thins to a thread, her eye drops, and it snaps with a soft pop. She falls into the dark ' +
    'and the loose end whips back along the glass like a released rubber band, cracking beside Ava, who flinches.',
  notes:
    'Sound: a rising glassy stretch as the cord takes her weight (pitch follows the stretch), a hollow "boing" on the ' +
    'rebound, a held hush, one thin creak as the cord thins, then a bright little glass "tink" for the snap, a falling ' +
    'whistle that drops out, and a sharp light "crack" when the loose end lands. Port: the band is drawn by its own ' +
    'ribbon (the game trail is hidden for the moment), built from the trail points the move just drew; the rebound ' +
    'height and the whip path can take a little randomness. Ava only reacts where she stands: she ends exactly as she started.',
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0

function bandTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A ribbon of light through points: flat on the glass where it touches it, facing the camera in the air. */
function makeBand(lab, N) {
  const { THREE } = lab;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6);
  const col = new Float32Array(N * 6);
  const uv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({ map: bandTexture(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  lab.add(mesh);
  const up = new THREE.Vector3(0, 1, 0);
  const t = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    /** pts: [{ p: Vector3, w: half width, k: brightness }], color: THREE.Color */
    draw(pts, color) {
      const m = Math.min(N, pts.length);
      if (m < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < m; i++) {
        const P = pts[i].p;
        const Q = pts[Math.min(m - 1, i + 1)].p;
        const O = pts[Math.max(0, i - 1)].p;
        t.subVectors(Q, O);
        if (t.lengthSq() < 1e-8) t.set(1, 0, 0);
        t.normalize();
        c.subVectors(cam, P).normalize();
        n.copy(up).lerp(c, clamp(Math.abs(P.y - 0.008) / 0.1)).normalize();
        s.crossVectors(t, n);
        if (s.lengthSq() < 1e-6) s.crossVectors(t, c);
        s.normalize().multiplyScalar(pts[i].w);
        pos.set([P.x - s.x, P.y - s.y, P.z - s.z, P.x + s.x, P.y + s.y, P.z + s.z], i * 6);
        const k = pts[i].k;
        col.set([color.r * k, color.g * k, color.b * k, color.r * k, color.g * k, color.b * k], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (m - 1) * 6);
    },
    hide() {
      geo.setDrawRange(0, 0);
    },
  };
}

/** A soft round glow (for pops of light). */
function glowSprite(lab, color, size) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(size);
  sp.renderOrder = 6;
  lab.add(sp);
  return sp;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const ava = lab.puppet('b');
  const mb = maya.bot;
  maya.set({ trail: false });
  ava.set({ trail: false });
  mb.trail = [];

  const ROW = 1;
  const RIM = 6.5; // the east rim, in spaces
  const W = (x, lift = 0) => {
    const v = lab.pos(x, ROW);
    v.y = lift;
    return v;
  };
  const X0 = lab.pos(0, ROW).x; // world x of space 0
  const red = new THREE.Color(mb.color);
  const band = makeBand(lab, 140);
  const low = makeBand(lab, 8); // the short piece below the snap
  const pop = glowSprite(lab, '#ffd0d8', 0.9);
  const crack = glowSprite(lab, '#ffe6ea', 0.7);
  const tipGlow = glowSprite(lab, '#ff8a9c', 0.35);
  const mayaEye = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);
  const towardRim = Math.atan2(-(RIM - 2), -(ROW - 3)) * 0.8; // Ava's head turned toward the rim

  // ---------------- the timeline (scene seconds from the start) ----------------
  const P = {
    ant: [0.0, 0.16], // she rocks back, eager
    drive: [0.16, 0.96], // 4 → the rim, with a strut
    drop: [0.96, 1.42], // over the rim: she falls, the cord stretches
    rebound: [1.42, 1.8], // yanked back up, level with the rim
    hope: [1.8, 2.02], // she turns to the room, beaming
    doubt: [2.02, 2.3], // she looks up at the cord as it thins
    snap: 2.3,
    fall: [2.3, 2.75],
    whip: [2.32, 2.9], // the loose end races home
    flinch: [2.88, 3.06],
    settle: [3.06, 3.38],
  };
  const HANG = { x: RIM + 0.42, lift: -0.2 };
  const BOTTOM = { x: RIM + 0.85, lift: -1.38 };

  const mayaPose = (T) => {
    let x = 4;
    let lift = 0;
    let rot = facing(1);
    let pitch = 0;
    let roll = 0;
    let sx = 1;
    let sy = 1;
    let eye = 1;
    let eyeW = 1; // eye height (wide eyes > 1, a squint < 1)
    let visible = true;
    if (T < P.ant[1]) {
      const k = seg(T, ...P.ant);
      x = 4 - 0.05 * Math.sin(k * Math.PI * 0.5);
      pitch = -0.16 * Math.sin(k * Math.PI * 0.5);
      sy = 1 - 0.07 * bump(k);
      sx = 1 + 0.05 * bump(k);
    } else if (T < P.drive[1]) {
      const k = seg(T, ...P.drive);
      x = 3.95 + (RIM - 3.95) * (0.45 * k * k + 0.55 * k);
      pitch = -0.16 * (1 - smooth(seg(k, 0, 0.25))) + 0.1 * smooth(seg(k, 0.1, 0.4));
      lift = 0.035 * Math.abs(Math.sin(k * Math.PI * 2.5)); // a jaunty little strut
      sy = 1 + 0.04 * Math.sin(k * Math.PI * 5);
      eye = 1.15;
    } else if (T < P.drop[1]) {
      const k = seg(T, ...P.drop);
      x = RIM + (BOTTOM.x - RIM) * (1 - (1 - k) ** 3);
      lift = BOTTOM.lift * ease.inOut(k);
      pitch = 0.1 + 1.0 * smooth(seg(k, 0, 0.7));
      // stretched as she falls, squashed as the cord catches her
      sy = 1 + 0.25 * bump(seg(k, 0.1, 0.8)) - 0.2 * bump(seg(k, 0.8, 1.2));
      sx = 1 - 0.08 * bump(seg(k, 0.1, 0.8)) + 0.14 * bump(seg(k, 0.8, 1.2));
      eyeW = 1 + 1.0 * smooth(seg(k, 0.0, 0.2));
      eye = 1.4;
    } else if (T < P.rebound[1]) {
      const k = seg(T, ...P.rebound);
      x = lerp(BOTTOM.x, HANG.x, ease.out(k));
      lift = lerp(BOTTOM.lift, HANG.lift, ease.out3(k));
      pitch = lerp(1.1, -0.05, smooth(seg(k, 0.05, 0.9)));
      rot = facing(1) - 1.35 * smooth(seg(k, 0.3, 1)); // she spins on the cord to face the room
      sy = 1 + 0.2 * bump(seg(k, 0, 0.6)) - 0.06 * bump(seg(k, 0.7, 1));
      sx = 1 - 0.08 * bump(seg(k, 0, 0.6));
      eyeW = 2 - smooth(k);
      eye = 1.4;
    } else if (T < P.doubt[1]) {
      const kh = seg(T, ...P.hope);
      const kd = seg(T, ...P.doubt);
      x = HANG.x;
      lift = HANG.lift + 0.03 * Math.sin(kh * Math.PI) - 0.05 * smooth(kd);
      rot = facing(1) - 1.35;
      // hope: eye wide and bright, a happy little wiggle
      roll = 0.13 * Math.sin(kh * Math.PI * 4) * (1 - smooth(kd));
      eye = 1 + 1.4 * smooth(seg(kh, 0, 0.4));
      eyeW = 1 + 0.6 * smooth(seg(kh, 0, 0.4));
      sy = 1 + 0.07 * bump(kh);
      // doubt: she looks up at the cord; her light sinks; a gulp
      rot = lerp(rot, facing(1) - 0.35, smooth(seg(kd, 0, 0.45)));
      pitch = -0.45 * smooth(seg(kd, 0, 0.45));
      eye = lerp(eye, 0.4, smooth(seg(kd, 0.35, 0.8)));
      eyeW = lerp(eyeW, 0.45, smooth(seg(kd, 0.35, 0.8)));
      sy -= 0.1 * bump(seg(kd, 0.6, 0.95));
      sx = 1 + 0.06 * bump(seg(kd, 0.6, 0.95));
    } else if (T < P.fall[1]) {
      const k = seg(T, ...P.fall);
      x = HANG.x + 0.15 * k;
      lift = HANG.lift - 0.05 - 1.7 * k * k;
      rot = facing(1) - 0.35 + 0.6 * k;
      pitch = -0.45 + 1.7 * smooth(seg(k, 0.05, 1));
      roll = 0.4 * k;
      sy = 1 + 0.25 * smooth(seg(k, 0.0, 0.35));
      sx = 1 - 0.1 * smooth(seg(k, 0.0, 0.35));
      eye = 2.2 * (1 - seg(k, 0.5, 1));
      eyeW = 2.1; // one last wide-eyed look
    } else {
      visible = false;
      x = HANG.x + 0.15;
      lift = -2.4;
    }
    return { x, lift, rot, pitch, roll, sx, sy, eye, eyeW, visible };
  };

  const avaPose = (T) => {
    let rot = facing(0);
    let pitch = 0;
    let roll = 0;
    let sx = 1;
    let sy = 1;
    let eye = 1;
    let x = 2;
    // she turns to watch Maya go
    const watch = smooth(seg(T, 0.45, 0.85)) * (1 - smooth(seg(T, P.settle[0], P.settle[1])));
    rot += towardRim * watch;
    // a gasp as Maya goes over: she stretches up and rocks back
    const gasp = bump(seg(T, 0.98, 1.4));
    sy += 0.14 * gasp;
    sx -= 0.05 * gasp;
    pitch -= 0.18 * gasp;
    eye += 0.8 * gasp;
    // during the hope she leans in, willing her home
    const will = smooth(seg(T, 1.6, 1.95)) * (1 - smooth(seg(T, P.snap - 0.02, P.snap + 0.12)));
    pitch += 0.22 * will;
    x += 0.05 * will;
    // the snap: a little jolt
    sy += 0.1 * bump(seg(T, P.snap, P.snap + 0.16));
    // the whip cracks right in front of her: flinch, squeeze shut, turn away
    const flinch = smooth(seg(T, P.flinch[0], P.flinch[0] + 0.07)) * (1 - smooth(seg(T, P.flinch[1], P.settle[1] - 0.05)));
    sy -= 0.26 * flinch;
    sx += 0.13 * flinch;
    pitch -= 0.28 * flinch;
    x -= 0.09 * flinch;
    rot += 0.6 * flinch;
    eye *= 1 - 0.85 * flinch;
    // and a shudder as she comes back
    const sh = seg(T, P.flinch[1], P.settle[1]);
    roll += 0.09 * Math.sin(sh * Math.PI * 6) * (sh > 0 && sh < 1 ? (1 - sh) ** 1.5 : 0);
    return { x, rot, pitch, roll, sx, sy, eye };
  };

  // ---------------- the camera leans in on the rim for the drop, and lets go after the crack ----------------
  const focus = W(5.35, -0.35);
  focus.z += 0.15;
  const camIn = [0.5, 1.1];
  const camOut = [2.62, 3.4];
  const t0 = lab.t;
  const releaseCam = lab.camera((home) => {
    const T = lab.t - t0;
    const k = smooth(seg(T, ...camIn)) * (1 - smooth(seg(T, ...camOut)));
    return { target: home.target.clone().lerp(focus, k), dist: home.dist * lerp(1, 0.64, k), el: lerp(home.el, 0.66, k), az: 0.06 * k };
  });

  // ---------------- every frame ----------------
  const trail = []; // the trail she draws: our own copy of Lumen's trail, so it can stretch
  const LIFE = 3.2;
  let T = 0;
  let last = null;
  let snapped = false;
  lab.playCard('a', ['m3']);
  const stop = lab.every(() => {
    T = lab.t - t0;
    const m = mayaPose(T);
    maya.set({ x: m.x, y: ROW, lift: m.lift, rot: m.rot, pitch: m.pitch, roll: m.roll, sx: m.sx, sy: m.sy, sz: m.sx, visible: m.visible });
    maya.look = m;
    const a = avaPose(T);
    ava.set({ x: a.x, y: 3, rot: a.rot, pitch: a.pitch, roll: a.roll, sx: a.sx, sy: a.sy, sz: a.sx });
    ava.look = a;
    if (T < P.drive[1] + 0.02) {
      const p = W(Math.min(m.x, RIM));
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.04) trail.push((last = { x: p.x, z: p.z, t: lab.t }));
    }
    if (T >= P.snap && !snapped) {
      snapped = true;
      lab.shake(0.02, 0.2);
    }
  });

  // ---------------- the band, drawn once Maya's pose is in place ----------------
  const attach = new THREE.Vector3();
  const quad = (a, c, b, k) => new THREE.Vector3((1 - k) ** 2 * a.x + 2 * (1 - k) * k * c.x + k * k * b.x, (1 - k) ** 2 * a.y + 2 * (1 - k) * k * c.y + k * k * b.y, (1 - k) ** 2 * a.z + 2 * (1 - k) * k * c.z + k * k * b.z);
  const back = () => {
    attach.set(0, 0.16, 0.22);
    maya.group.updateMatrixWorld(true);
    return maya.group.localToWorld(attach);
  };
  const glowAt = (sp, at, k, size) => {
    if (k <= 0 || k >= 1) return (sp.material.opacity = 0);
    sp.position.copy(at);
    sp.material.opacity = (1 - k) ** 2 * 1.3;
    sp.scale.setScalar(size * (0.3 + ease.out(k)));
  };
  maya.each = (model) => {
    const look = maya.look;
    model.eyeMat.color.setRGB(3.2 * look.eye, 3.1 * look.eye, 2.9 * look.eye);
    if (mayaEye) mayaEye.scale.set(look.eyeW, 1, look.eyeW);
    if (!look.visible) model.poolMat.opacity = 0;
    // her card stays up over the rim where she left it; it goes out when the cord snaps
    if (mb.card) {
      const c = W(Math.min(maya.pose.x, RIM + 0.1));
      mb.card.position.set(c.x, mb.card.position.y - maya.pose.lift, c.z);
      const cardFade = 1 - seg(T, P.snap, P.snap + 0.3);
      mb.card.material.opacity *= cardFade;
      mb.card.visible = cardFade > 0.01;
    }

    const kd = seg(T, ...P.drop);
    const kr = seg(T, ...P.rebound);
    const kdb = seg(T, ...P.doubt);
    const kw = seg(T, ...P.whip);
    // tension: the band holds its light (and gains some) while it holds her
    const tension = smooth(seg(kd, 0.15, 0.95)) * (1 - 0.35 * smooth(kr)) + 0.6 * smooth(kdb);
    const thin = lerp(lerp(lerp(1, 0.5, smooth(seg(kd, 0.2, 1))), 0.8, smooth(seg(kr, 0, 0.7))), 0.16, smooth(seg(kdb, 0.15, 1)));
    const anchorX = RIM - 0.6 * smooth(seg(kd, 0.1, 1)) + 0.25 * smooth(kr); // where it peels off the glass
    const creak = kdb > 0.55 && kdb < 1 ? 0.55 + 0.45 * Math.sin(T * 120) : 1;
    // the whip: the loose end races home along the glass, its tip overtaking at the end, and cracks
    const endX = lerp(anchorX, 3.95, ease.inOut(kw)); // the end of what's left lying on the glass
    const tipX = lerp(RIM + 0.15, 3.5, ease.in3(kw) * 0.7 + kw * 0.3);
    const tipLift = lerp(-0.25, 0, kw) + 0.95 * bump(seg(kw, 0, 0.95)) ** 0.8;
    const fade = 1 - seg(T, P.whip[1], P.whip[1] + 0.16);

    const pts = [];
    const ageNow = T < P.drop[0] ? lab.t : t0 + P.drop[0];
    const wMul = lerp(1, thin, 0.5);
    const glow = 1 + 1.1 * tension;
    const flatEnd = snapped ? endX : anchorX;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      if (p.x - X0 > flatEnd) break;
      const age = clamp((ageNow - p.t) / LIFE);
      const f = (1 - age) ** 1.6 * Math.min(1, i / 3);
      pts.push({ p: new THREE.Vector3(p.x, 0.008, p.z), w: (0.16 + 0.06 * (1 - age)) * wMul, k: f * 1.8 * glow * fade });
    }
    const lastK = pts.length ? pts[pts.length - 1].k : 1.8;
    if (!snapped && T >= P.drive[1] - 0.02 && look.visible) {
      // peeled up at the anchor, bent over the rim, down to her back
      const A = W(anchorX, 0.008);
      const R = W(RIM + 0.03, 0.01);
      const B = back();
      const n = 30;
      const kb = (1 / Math.max(0.3, thin)) ** 0.7 * creak;
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        const q = quad(A, R, B, k);
        if (q.x < R.x) q.y = Math.max(0.008, q.y);
        pts.push({ p: q, w: 0.2 * thin * (1 - 0.3 * k), k: lerp(lastK, 2.4 * glow * kb, Math.min(1, k * 4)) });
      }
    } else if (snapped && fade > 0) {
      // the loose end: it lifts off the glass behind the end and arcs to its flying tip
      const E = W(endX, 0.008);
      const tip = W(tipX, tipLift);
      const C = W((endX + tipX) / 2 + 0.25 * (1 - kw), Math.max(tipLift, 0.1) * 1.25 + 0.05);
      const n = 18;
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        pts.push({ p: quad(E, C, tip, k), w: lerp(0.13, 0.045, k), k: lerp(lastK, 3.2 * fade, Math.min(1, k * 3)) });
      }
      glowAt(tipGlow, tip, kw < 1 ? 0.15 : seg(T, P.whip[1], P.whip[1] + 0.16), 0.5);
      // the lower piece snaps back into her and goes out
      const kl = seg(T, P.snap, P.snap + 0.12);
      if (kl < 1 && look.visible) {
        const B = back();
        const S = W(RIM + 0.06, -0.02).lerp(B, ease.out(kl));
        const lp = [];
        for (let i = 0; i <= 6; i++) lp.push({ p: S.clone().lerp(B, i / 6), w: 0.035, k: 3.2 * (1 - kl) });
        low.draw(lp, red);
      } else low.hide();
    } else low.hide();
    if (fade <= 0) tipGlow.material.opacity = 0;
    band.draw(pts, red);
    glowAt(pop, W(RIM + 0.06, 0.0), seg(T, P.snap, P.snap + 0.35), 1.2);
    glowAt(crack, W(3.5, 0.06), seg(T, P.whip[1] - 0.02, P.whip[1] + 0.32), 1.1);
  };
  ava.each = (model) => {
    const e = ava.look.eye;
    model.eyeMat.color.setRGB(3.2 * e, 3.1 * e, 2.9 * e);
  };

  // the crack: a small ring of light where the loose end lands
  lab.at(P.whip[1], () => lab.ring(W(3.5, 0), '#ff8a9c', 0.7, 0.03, 0.5));
  lab.at(camOut[0], () => {});
  await lab.wait(P.settle[1]);
  stop();
  releaseCam();
  band.hide();
  low.hide();
  mb.trail = [];
  maya.release({ x: 7, y: ROW, d: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
