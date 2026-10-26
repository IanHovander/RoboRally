// The door left ajar, acted: a crack of warm light opens behind the panel and spills a wedge of sunbeam
// across the glass, motes drifting in it. Maya turns to it and melts like a cat in a sunbeam: eye closing,
// face tipped up. The draught lifts her and carries her one space south like a leaf, swaying, blissed out,
// her pointer steady east. Then the crack eases shut; she lands, turns, leans after the light ("wait..."),
// and sighs. Ava, across the board, is drawn to the light too, and is left blinking at the dark wall.
export const meta = {
  title: 'Sunbeam',
  idea:
    "A crack of warm light opens in the dark behind the panel and a wedge of sunbeam spills across the glass toward us, with motes drifting in it and Maya's long shadow stretching our way. Maya turns into it and melts like a cat in a sunbeam, eye closing, face tipped up; the draught lifts her and she drifts one space south like a leaf, swaying, blissed out, her pointer steady east. As the crack eases shut she lands, turns after the light, leans toward it as if to say 'wait', and sighs. Ava is drawn to it too, her polish gleaming, and is left blinking at the dark wall.",
  notes:
    "Sound: a soft airy swell, like a door opening onto a summer room (warm pad, a faint far-off birdsong-like glass shimmer), a gentle breath for the drift, a low contented hum from Maya, then the swell closing to a tiny latch and her small sigh. Made of Lumen's one light: a warm spotlight from the crack (it is what makes the robots' polish gleam), an additive wedge on the glass, motes, a fake long shadow and a hint of the light on the room's floor. No plate: the push is the light. Everything shared (the light) is removed at the end.",
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);

/** A robot with an acting layer on its body (the rules' pose, ring and pointer stay put). */
function actor(lab, key, shapeEye) {
  const p = lab.puppet(key);
  const m = p.model;
  let eye = null;
  m.body.traverse((o) => {
    if (!eye && o.isMesh && o.material === m.eyeMat) eye = o;
  });
  const eyeBase = eye ? eye.scale.clone() : null;
  const warmEye = new lab.THREE.Color(3.3, 2.6, 1.6);
  const act = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, dy: 0, eye: 1, eyeH: 1, eyeW: 1, warm: 0, gleam: 0 };
  p.act = act;
  p.each = (model) => {
    const b = model.body;
    b.rotation.order = 'YXZ';
    b.rotation.set(act.pitch, act.yaw, -act.roll);
    b.scale.set(act.sx, act.sy, act.sz);
    b.position.y += act.dy;
    model.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(warmEye, act.warm).multiplyScalar(act.eye);
    if (eye && shapeEye) eye.scale.set(eyeBase.x * act.eyeH, eyeBase.y * act.eyeW, eyeBase.z * act.eyeH);
    model.paint.emissiveIntensity = 0.16 + 0.35 * act.gleam;
  };
  p.finish = (state) => {
    p.each = null;
    m.body.scale.set(1, 1, 1);
    m.body.rotation.order = 'XYZ';
    if (eye) eye.scale.copy(eyeBase);
    p.release(state);
  };
  return p;
}

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

export default async function play(lab) {
  const { THREE, facing, PALETTE } = lab;
  const A = lab.arena;
  const maya = actor(lab, 'a', true);
  const ava = actor(lab, 'b', false);
  const pusher = A.pushers.get('3,1');
  pusher.kick = null;
  pusher.plate.visible = false; // no plate: the push is the light
  lab.cleanup(() => (pusher.plate.visible = true));

  const SUN = new THREE.Color('#ffd9a8'); // Lumen's warm white, a touch warmer: late sun
  const cx = A.pos(3, 1).x;
  const WALL = A.pos(3, 1).z - 0.5;
  const add = (o) => lab.add(o);

  // ---- the crack: a standing sliver of light in the dark behind the panel, with a soft halo
  const crackTex = canvasTex(THREE, 64, 128, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.15, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const additive = (map, color, k) => new THREE.MeshBasicMaterial({ map, color: color.clone().multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const DOOR_W = 0.5;
  const DOOR_H = 1.0;
  const CRACK_X = cx + DOOR_W / 2; // the door is hinged on its west side; the light comes round its east edge
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), additive(crackTex, SUN, 3.2));
  crack.position.set(CRACK_X, 0, WALL - 0.02);
  add(crack);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), additive(crackTex, SUN, 0.6));
  halo.position.set(CRACK_X, 0, WALL - 0.03);
  add(halo);
  // the door's outline, drawn by the light leaking round it: a line along the top, one under it, a faint hinge side
  const leakMat = (k) => new THREE.MeshBasicMaterial({ color: SUN.clone().multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const leakTop = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 0.007), leakMat(2.2));
  leakTop.position.set(cx, DOOR_H, WALL - 0.02);
  const leakSill = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 0.012), leakMat(3));
  leakSill.position.set(cx, 0.008, WALL - 0.01);
  const leakHinge = new THREE.Mesh(new THREE.PlaneGeometry(0.006, DOOR_H), leakMat(1.6));
  leakHinge.position.set(cx - DOOR_W / 2, DOOR_H / 2, WALL - 0.02);
  for (const m of [leakTop, leakSill, leakHinge]) add(m);

  // ---- the wedge of sunbeam across the glass (apex at the crack, opening toward us)
  const wedgeTex = canvasTex(THREE, 256, 512, (g, w, h) => {
    g.filter = 'blur(10px)';
    const rg = g.createLinearGradient(0, 0, 0, h);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(w * 0.47, 6);
    g.lineTo(w * 0.53, 6);
    g.lineTo(w * 0.94, h - 6);
    g.lineTo(w * 0.06, h - 6);
    g.closePath();
    g.fill();
  });
  const wedge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), additive(wedgeTex, SUN, 0.75));
  wedge.rotation.x = -Math.PI / 2; // local -y (down the texture) now runs south (+z)
  wedge.position.set(cx + 0.1, 0.006, WALL);
  wedge.renderOrder = 3;
  add(wedge);
  // a faint upright sheet of the beam, so it hangs in the air a little (where the motes live)
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), additive(wedgeTex, SUN, 0.16));
  sheet.rotation.x = -Math.PI / 2 + 0.22;
  sheet.position.set(cx + 0.1, 0.32, WALL);
  add(sheet);
  // the room's floor, far below, catches some of it
  const blobTex = canvasTex(THREE, 64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), additive(blobTex, SUN, 0.45));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(cx, -1.58, WALL + 1.2);
  add(floorGlow);
  // Maya's long shadow, cut out of the beam (drawn over it), stretching toward us
  const shadowTex = canvasTex(THREE, 64, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * 0.22, 2, w / 2, h * 0.4, h * 0.62);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 4;
  add(shadow);

  // ---- a warm spotlight from the crack: the robots' polish catches it
  const spot = new THREE.SpotLight(SUN, 0, 0, 0.62, 0.85, 0);
  spot.position.set(CRACK_X - 0.05, 0.36, WALL - 0.05);
  spot.target.position.set(cx, 0, WALL + 3);
  A.scene.add(spot, spot.target);
  lab.cleanup(() => {
    A.scene.remove(spot, spot.target);
    spot.dispose();
  });

  // ---- motes drifting in the beam
  const N = 46;
  const motePos = new Float32Array(N * 3);
  const moteCol = new Float32Array(N * 3);
  const motes = [];
  for (let i = 0; i < N; i++) {
    const along = lab.range(0.15, 2.6);
    motes.push({ along, side: lab.range(-1, 1), h: lab.range(0.03, 0.5), ph: lab.range(0, 6.28), sp: lab.range(0.6, 1.4), tw: lab.range(3, 7) });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  const moteMat = new THREE.PointsMaterial({ size: 0.045, map: blobTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const motePts = new THREE.Points(moteGeo, moteMat);
  add(motePts);

  // ---- timeline
  const OPEN = 0.4; // crack open
  const DRIFT1 = OPEN + 0.82; // carried one space south
  const SHUT = DRIFT1 + 0.5; // crack shut
  const END = SHUT + 0.08;

  const t0 = lab.t;
  let lastT = 0;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    const dt = T - lastT;
    lastT = T;
    const ma = maya.act;
    const aa = ava.act;

    // ---- the light: opens with an ease (a door swinging a little), widens as it pushes, eases shut
    const open = smooth(seg(T, 0, OPEN)) * 0.7 + 0.3 * smooth(seg(T, OPEN - 0.05, OPEN + 0.35));
    const shut = smoother(seg(T, DRIFT1, SHUT));
    const L = open * (1 - shut); // how much light there is (0..1)
    const width = 0.012 + 0.13 * L;
    crack.scale.set(width, DOOR_H, 1);
    crack.position.x = CRACK_X - width / 2;
    crack.material.opacity = Math.min(1, L * 3);
    halo.scale.set(width * 3 + 0.08, DOOR_H + 0.08, 1);
    halo.position.x = crack.position.x;
    halo.material.opacity = 0.5 * L;
    leakTop.material.opacity = 0.8 * Math.min(1, L * 1.6);
    leakSill.material.opacity = Math.min(1, L * 1.6);
    leakHinge.material.opacity = 0.5 * Math.min(1, L * 1.6);
    const spread = 0.35 + 1.7 * L; // the wedge's far width
    wedge.scale.set(spread, 3.05, 1);
    wedge.material.opacity = 0.95 * L;
    sheet.scale.set(spread * 0.9, 2.6, 1);
    sheet.material.opacity = 0.8 * L;
    floorGlow.material.opacity = 0.5 * L;
    spot.intensity = 9 * L;
    spot.angle = 0.25 + 0.4 * L;

    // ---- Maya: turns into the light and melts; floats south like a leaf; lands; wistful; sighs
    const drift = smoother(seg(T, OPEN - 0.04, DRIFT1));
    const sway = Math.sin(seg(T, OPEN - 0.04, DRIFT1) * Math.PI * 2.5);
    const float = bump(T, OPEN - 0.1, DRIFT1 + 0.04) ** 0.7;
    const yM = 1 + drift;
    const xM = 3 + 0.07 * sway * float;
    maya.set({ x: xM, y: yM, lift: 0.07 * float, rot: facing(1), trail: true });
    const turn = smooth(seg(T, 0.08, 0.32)); // looks back into the light (north is her left)
    const bliss = smooth(seg(T, 0.26, 0.5)) * (1 - smooth(seg(T, DRIFT1 - 0.05, DRIFT1 + 0.08)));
    const land = bump(T, DRIFT1 - 0.02, DRIFT1 + 0.14);
    const wait = smooth(seg(T, DRIFT1 + 0.08, DRIFT1 + 0.22)) * (1 - smooth(seg(T, SHUT - 0.05, SHUT + 0.05)));
    const sigh = bump(T, SHUT - 0.1, END + 0.02);
    const back = smooth(seg(T, SHUT - 0.08, END)); // home to facing east
    // a look at the light, then she basks: the sun on her back, her face turned up our way, eye closed
    let yaw = lerp(1.05 * turn, -0.6, bliss) + 0.1 * Math.sin(T * 4) * bliss;
    yaw = lerp(yaw, 1.15, wait);
    yaw = lerp(yaw, 0, back);
    ma.yaw = yaw;
    ma.pitch = lerp(0.32 * turn, 0.36, bliss) * (1 - back) * (1 - wait) + 0.22 * wait - 0.3 * sigh; // face up; reaching after it; head drops
    ma.roll = 0.2 * sway * float;
    ma.sy = 1 + 0.05 * bliss + 0.13 * wait - 0.1 * land - 0.12 * sigh;
    ma.sx = ma.sz = 1 + 0.05 * land + 0.03 * sigh;
    ma.dy = 0.05 * wait;
    ma.eyeH = lerp(1, 0.22, bliss) + 0.5 * wait - 0.4 * sigh;
    ma.eye = 1 + 0.5 * turn * (1 - back) + 0.5 * bliss - 0.35 * sigh;
    ma.eyeW = 1;
    ma.warm = Math.min(1, 1.3 * L);
    ma.gleam = 0;

    // ---- the shadow: long, from her base toward us; leaves her a little as she floats
    const mp = A.pos(xM, yM);
    shadow.position.set(mp.x, 0.008, mp.z + 0.12 + 0.12 * float);
    shadow.rotation.z = -0.05 * sway * float;
    shadow.scale.set(0.5 - 0.08 * float, 0.5 + 1.1 * L, 1);
    shadow.material.opacity = 0.85 * L * (1 - 0.35 * float);

    // ---- Ava: drawn to the light too; gleams; leans toward it; left blinking at the dark wall
    const curious = smooth(seg(T, 0.18, 0.5));
    const blink = Math.max(bump(T, SHUT - 0.04, SHUT + 0.02), bump(T, SHUT + 0.03, END));
    aa.yaw = -0.5 * curious * (1 - smooth(seg(T, SHUT - 0.02, END))); // faces west; a right turn looks toward the crack
    aa.pitch = 0.12 * curious * (1 - shut) - 0.08 * curious * L;
    aa.sy = 1 + 0.05 * curious * L;
    aa.sx = aa.sz = 1;
    aa.dy = 0;
    aa.eye = (1 + 0.5 * curious * L) * (1 - 0.85 * blink);
    aa.warm = Math.min(1, L);
    aa.gleam = L;

    // ---- the motes: drift south on the draught while it's open, then slow and settle
    const draught = L;
    for (let i = 0; i < N; i++) {
      const m = motes[i];
      m.along += dt * (0.12 + 0.55 * draught) * m.sp * (0.4 + 0.6 * draught);
      if (m.along > 2.9) m.along -= 2.75;
      m.h = Math.max(0.02, m.h - dt * 0.08 * shut);
      const half = (0.06 + 0.35 * L) * (m.along / 2.9) + 0.04;
      const x = cx + 0.1 + m.side * half + 0.03 * Math.sin(T * 1.7 + m.ph);
      const z = WALL + m.along;
      const y = m.h + 0.03 * Math.sin(T * 2.3 + m.ph * 2);
      motePos.set([x, y, z], i * 3);
      const fadeEnds = Math.min(1, m.along / 0.4) * Math.min(1, (2.9 - m.along) / 0.5);
      const b = (0.55 + 0.45 * Math.sin(T * m.tw + m.ph)) * fadeEnds * (0.15 + 0.85 * L) * (1 - smooth(seg(T, SHUT - 0.1, END)));
      moteCol.set([SUN.r * 1.6 * b, SUN.g * 1.6 * b, SUN.b * 1.6 * b], i * 3);
    }
    moteGeo.attributes.position.needsUpdate = true;
    moteGeo.attributes.color.needsUpdate = true;
  });

  // her name tag steps aside for the moment (the game re-shows it every frame, so hide it after)
  const mayaBot = lab.bot('a');
  const inner = maya.each;
  maya.each = (m, t) => {
    inner(m, t);
    const T = lab.t - t0;
    if (mayaBot.tag && T > 0.05 && T < END - 0.12) mayaBot.tag.visible = false;
  };
  // a slow, gentle lean in, the way you'd step closer to a sunbeam; home as the door shuts
  const focus = A.pos(3.4, 1.7).add(new THREE.Vector3(0, 0.2, 0));
  const releaseCam = driveCamera(lab, (home, t) => {
    const T = t - t0;
    const c = smooth(seg(T, 0.05, 0.75)) * (1 - smooth(seg(T, DRIFT1, END - 0.02)));
    return { target: home.target.clone().lerp(focus, c), dist: home.dist * (1 - 0.2 * c), el: home.el - 0.06 * c, keep: 1 - c };
  });

  await lab.wait(END);
  stop();
  releaseCam();
  spot.intensity = 0;
  maya.finish({ x: 3, y: 2, d: 1 });
  ava.finish({ x: 5, y: 3, d: 3 });
  void PALETTE;
}
