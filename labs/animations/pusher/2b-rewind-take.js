// Overshoot, undo, acted: the panel's arm of light overreaches and carries Maya to the brink, where she
// teeters over the drop and Ava gasps. Then the board rewinds the take: everyone's acting plays backwards
// (Maya un-teeters, Ava un-gasps, the camera un-pushes) as Maya is reeled up her own trail, which is
// eaten like tape, until she clicks into the one space the rules allow. The arm slinks home ashamed;
// Maya peeks at the edge she almost went over and shivers; Ava squints: did that just happen?
export const meta = {
  title: 'Rewind the take',
  idea:
    "The arm of light shoots out far too long and carries Maya past her space, to the south edge, where she teeters over the dark drop and Ava gasps. A frozen beat. Then the board rewinds: Maya is reeled backwards up her own trail of light, eating it like tape, and every reaction plays in reverse too (her teeter, Ava's gasp, the camera's push-in), until she clicks into the one space the rules allow. The arm slinks home in two embarrassed stutters, its plate hanging; Maya peeks at the edge and shivers; Ava squints at her.",
  notes:
    'Sound: a glassy whoosh that keeps going a little too long, a creak at the brink, a held breath, then a rising reversed "whooo-op" (the whoosh played backwards) ending on a crisp glass click; two small sheepish clicks as the arm retracts. Rules: the overshoot runs only over empty floor (up to 2 extra spaces, stopping short of robots and walls) and ends at the brink only when an edge or pit is within reach. Porting: all acting is on the body over the rules\' pose (the pointer stays east); the whole forward take is a function of one story clock, so the rewind is just running that clock backwards.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);
const out3 = (k) => 1 - (1 - k) ** 3;

/** A robot with an acting layer on its body (the rules' pose, ring and pointer stay put). */
function actor(lab, key, shapeEye) {
  const p = lab.puppet(key);
  const m = p.model;
  let eye = null;
  m.body.traverse((o) => {
    if (!eye && o.isMesh && o.material === m.eyeMat) eye = o;
  });
  const eyeBase = eye ? eye.scale.clone() : null;
  const act = { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, dy: 0, eye: 1, eyeH: 1, eyeW: 1 };
  p.act = act;
  p.reset = () => Object.assign(act, { yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, dy: 0, eye: 1, eyeH: 1, eyeW: 1 });
  p.each = (model) => {
    const b = model.body;
    b.rotation.order = 'YXZ';
    b.rotation.set(act.pitch, act.yaw, -act.roll);
    b.scale.set(act.sx, act.sy, act.sz);
    b.position.y += act.dy;
    model.eyeMat.color.setRGB(3.2 * act.eye, 3.1 * act.eye, 2.9 * act.eye);
    if (eye && shapeEye) eye.scale.set(eyeBase.x * act.eyeH, eyeBase.y * act.eyeW, eyeBase.z * act.eyeH);
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
  const mayaBot = lab.bot('a');
  const pusher = A.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const plateMat = plate.material;
  const plateGlow0 = plateMat.emissiveIntensity;
  const plateEm0 = plateMat.emissive.clone();
  lab.cleanup(() => {
    A.dim = A.dimCur = 0;
    plate.position.z = 0.05;
    plate.rotation.x = 0;
    plateMat.emissiveIntensity = plateGlow0;
    plateMat.emissive.copy(plateEm0);
  });

  // ---- the telescoping arm of light, built in the panel's own frame (local +z points into the board)
  const housing = plate.parent;
  housing.updateWorldMatrix(true, false);
  const arm = new THREE.Group();
  arm.matrixAutoUpdate = false;
  arm.matrix.copy(housing.matrixWorld);
  lab.add(arm);
  const glowMat = (k, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.light).multiplyScalar(k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const SLEEVES = [
    { w: 0.2, h: 0.07 },
    { w: 0.14, h: 0.05 },
    { w: 0.09, h: 0.035 },
  ];
  const sleeves = SLEEVES.map((s, i) => {
    const mat = glowMat(1.1 - i * 0.15, 0.3);
    const m = new THREE.Mesh(unit, mat);
    m.scale.set(s.w, s.h, 0.001);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.04, s.h + 0.03, 0.02), glowMat(2.2, 1));
    arm.add(m, collar);
    return { m, collar, mat, cmat: collar.material, ...s };
  });
  const core = new THREE.Mesh(unit, glowMat(2, 0.8));
  core.scale.set(0.012, 0.012, 0.001);
  arm.add(core);
  /** pz: where the plate is (local z); bright: 0..1 */
  const setArm = (pz, bright) => {
    const L = Math.max(0, pz - 0.04);
    const n = sleeves.length;
    sleeves.forEach((s, i) => {
      const a = 0.04 + (L * i) / n;
      const b = 0.04 + (L * (i + 1)) / n;
      const len = b - a + (i < n - 1 ? 0.04 : 0);
      s.m.visible = s.collar.visible = L > 0.06;
      s.m.position.z = a;
      s.m.scale.z = Math.max(0.001, len);
      s.collar.position.z = b;
      s.mat.opacity = 0.3 * bright;
      s.cmat.opacity = bright;
    });
    core.visible = L > 0.06;
    core.position.z = 0.04;
    core.scale.z = Math.max(0.001, L);
    core.material.opacity = 0.8 * bright;
  };
  setArm(0, 0);

  // the tape head: a bead of light where the trail is wound back into her
  const headTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,.5)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const head = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: headTex, color: new THREE.Color(mayaBot.color).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  head.rotation.x = -Math.PI / 2;
  head.position.y = 0.012;
  lab.add(head);

  // the tape: while the board rewinds, her trail runs back toward the panel in bright dashes, reeling her in
  const tapeCanvas = document.createElement('canvas');
  tapeCanvas.width = 8;
  tapeCanvas.height = 64;
  {
    const g = tapeCanvas.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 64);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.35, 'rgba(255,255,255,1)');
    lg.addColorStop(0.6, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, 8, 64);
  }
  const tapeTex = new THREE.CanvasTexture(tapeCanvas);
  tapeTex.wrapT = THREE.RepeatWrapping;
  const tape = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ map: tapeTex, color: new THREE.Color(mayaBot.color).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  tape.rotation.x = -Math.PI / 2; // local +y now runs north (-z)
  tape.position.y = 0.014;
  lab.add(tape);

  // ---- the forward take, as a function of one story clock (tau). The rewind runs it backwards.
  const GO = 0.13; // the plate meets her
  const BRINK = 0.68; // she reaches the brink
  const FREEZE = 0.98; // the held beat at the worst moment
  const END_TAKE = 1.08;
  const Y_BRINK = 3.36;
  const runK = (tau) => seg(tau, GO, BRINK);
  const runE = (k) => 1 - (1 - k) ** 2.2; // slammed off fast, decelerating into the brink
  const yAt = (tau) => (tau < GO ? 1 : 1 + (Y_BRINK - 1) * runE(runK(tau)) + 0.05 * smooth(seg(tau, BRINK + 0.1, FREEZE - 0.05)));
  // the story moment she passes her rightful space (y = 2): the rewind stops there
  const TAU_CLICK = GO + (BRINK - GO) * (1 - (1 - 1 / (Y_BRINK - 1)) ** (1 / 2.2));
  const plateZ = (tau) => (tau < 0.08 ? 0.05 - 0.04 * smooth(seg(tau, 0, 0.08)) : tau < GO ? lerp(0.01, 0.11, out3(seg(tau, 0.08, GO))) : yAt(tau) - 0.89);

  function mayaPose(tau) {
    const a = {};
    const y = yAt(tau);
    const speed = tau > GO && tau < BRINK ? (1 - runK(tau)) ** 1.2 : 0;
    // glance at the panel as it winds up (her left is north)
    let yaw = 0.4 * smooth(seg(tau, 0.01, 0.08));
    yaw = lerp(yaw, 0.1, out3(seg(tau, GO, GO + 0.06))); // smack: snapped forward
    yaw = lerp(yaw, 1.15, smooth(seg(tau, 0.27, 0.37))); // "wait, that was my stop!" (looks back at it)
    yaw = lerp(yaw, -1.35, out3(seg(tau, 0.47, 0.56))); // whips round to the drop
    a.yaw = yaw;
    // impact squash (pushed on her north side: local x runs south)
    const hit = bump(tau, GO, GO + 0.15);
    a.sx = 1 - 0.28 * hit;
    a.sz = 1 + 0.12 * hit;
    a.sy = 1 + 0.08 * hit + 0.12 * smooth(seg(tau, 0.5, 0.6)) * (1 - seg(tau, FREEZE, END_TAKE) * 0.3);
    // top lags behind the shove (leans north = her left), then the brink throws her forward over the drop
    a.roll = -0.28 * speed * (1 - smooth(seg(tau, 0.47, 0.56)));
    // teeter: she faces the drop now, so pitching her nose down tips her out over it, and rolling is a
    // side-to-side windmill (reads across the room). Lurch out, pull back, lurch further... and hold.
    const w = seg(tau, BRINK - 0.06, FREEZE);
    let tip = 0;
    tip = lerp(tip, -0.55, out3(seg(w, 0, 0.25)));
    tip = lerp(tip, -0.12, smooth(seg(w, 0.25, 0.5)));
    tip = lerp(tip, -0.95, out3(seg(w, 0.5, 0.85)));
    const tremble = tau > FREEZE ? 0.025 * Math.sin(tau * 95) : 0;
    a.pitch = tip + tremble - 0.12 * smooth(seg(tau, 0.5, 0.6)) * (1 - seg(w, 0, 0.1));
    a.roll += tau > BRINK - 0.06 ? 0.38 * Math.sin(w * Math.PI * 5.5) * (1 - 0.6 * w) + tremble : 0;
    a.dy = 0.09 * Math.abs(tip); // she pivots on her front edge, so her body rises a little as she tips
    // the eye: wide from the smack on, widest at the brink
    a.eye = tau < GO ? 1 + 0.4 * smooth(seg(tau, 0.01, 0.08)) : 2.2 + 0.6 * smooth(seg(tau, 0.5, 0.6));
    a.eyeH = tau < GO ? 1 : 1.9 + 0.7 * smooth(seg(tau, 0.5, 0.6));
    a.eyeW = tau < GO ? 1 : 0.85;
    return { y, a };
  }
  function avaPose(tau) {
    // Ava (facing west, on Maya's destination row) sees her coming and gasps
    const see = smooth(seg(tau, 0.32, 0.5));
    const gasp = out3(seg(tau, 0.6, 0.72));
    return {
      yaw: -0.2 * see,
      pitch: 0.3 * gasp + 0.06 * see, // rears back (nose up)
      sy: 1 + 0.16 * gasp,
      sx: 1 - 0.06 * gasp,
      sz: 1 - 0.06 * gasp,
      eye: 1 + 0.6 * see + 1.4 * gasp,
      roll: 0.05 * Math.sin(tau * 60) * gasp * seg(tau, FREEZE - 0.1, FREEZE),
    };
  }
  const camK = (tau) => smooth(seg(tau, 0.42, 0.8));

  // ---- the real-time schedule
  const REW0 = END_TAKE; // the rewind starts
  const REW1 = REW0 + 0.46; // and clicks home
  const END = 1.96;
  const tauAt = (T) => {
    if (T < REW0) return T;
    const k = seg(T, REW0, REW1);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    return lerp(END_TAKE, TAU_CLICK, e);
  };
  const origin = A.pos(0, 0);
  const brinkPt = A.pos(3.7, 2.9).add(new THREE.Vector3(0, 0.05, 0));

  const t0 = lab.t;
  let clicked = false;
  let clickPose = null;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    const tau = tauAt(T);
    const rewinding = T >= REW0 && T < REW1;
    const ma = maya.act;
    const aa = ava.act;

    if (T < REW1) {
      // ---- the take (forward, or rewinding)
      const { y, a } = mayaPose(tau);
      Object.assign(ma, a);
      maya.set({ x: 3, y, rot: facing(1), trail: !rewinding && T < REW0 });
      if (rewinding) {
        // tape: the light she left south of her is wound back in
        const z = A.pos(3, y).z + 0.02;
        const tr = mayaBot.trail;
        while (tr.length && tr[tr.length - 1].z > z) tr.pop();
        for (const p of tr) p.t = Math.max(p.t, lab.t - 0.6); // the remaining tape glows fresh
        // a little VHS shiver in her eye
        ma.eye *= 0.75 + 0.25 * Math.sign(Math.sin(T * 120));
      }
      const head0 = A.pos(3, y);
      head.position.x = head0.x;
      head.position.z = head0.z + 0.05;
      head.material.opacity = rewinding ? 0.9 * Math.sin(seg(T, REW0, REW1) * Math.PI) ** 0.5 : 0;
      head.scale.setScalar(rewinding ? 0.8 + 0.25 * Math.sin(T * 50) : 1);
      // the tape from her back to where she started, dashes streaming north
      const from = A.pos(3, y);
      const len = Math.max(0.001, from.z - A.pos(3, 1).z);
      tape.position.x = from.x;
      tape.position.z = from.z;
      tape.scale.set(0.07, len, 1);
      tapeTex.repeat.set(1, len * 3.5);
      tapeTex.offset.y = -T * 9;
      const tapeOn = smooth(seg(T, FREEZE + 0.02, REW0 + 0.05)) * (1 - smooth(seg(T, REW1 - 0.08, REW1)));
      tape.material.opacity = 0.85 * tapeOn;

      Object.assign(aa, avaPose(tau));
      const pz = plateZ(tau);
      plate.position.z = pz;
      // the board holds its breath at the worst moment (its light dips), and stays dim while it edits
      const hold = smooth(seg(T, FREEZE, FREEZE + 0.06));
      A.dim = A.dimCur = 0.5 * hold;
      setArm(pz, (tau < GO ? smooth(seg(tau, 0.08, GO)) : 1) * (1 - 0.55 * hold));
      plateMat.emissive.set(PALETTE.light);
      plateMat.emissiveIntensity = tau < GO ? plateGlow0 + 1.5 * smooth(seg(tau, 0.04, GO)) : 1.4;
    } else {
      // ---- clicked into place: the take is over, now the actors react for real
      if (!clicked) {
        clicked = true;
        clickPose = { ...ma };
        lab.ring(A.pos(3, 2), '#ffffff', 0.45, 0.02, 0.35);
        maya.set({ x: 3, y: 2, rot: facing(1), trail: false });
        head.material.opacity = 0;
        tape.material.opacity = 0;
      }
      const R = T - REW1;
      const into = smooth(seg(R, 0, 0.1));
      A.dim = A.dimCur = 0.5 * (1 - smooth(seg(R, 0, 0.12)));
      // the click: a little hop-squash into her space
      const sq = bump(R, 0, 0.12);
      ma.sx = lerp(clickPose.sx, 1, into) + 0.06 * sq;
      ma.sz = lerp(clickPose.sz, 1, into) + 0.06 * sq;
      ma.sy = lerp(clickPose.sy, 1, into) - 0.16 * sq;
      ma.roll = lerp(clickPose.roll, 0, into);
      // blink, blink ("...huh?"), a peek at the edge she nearly went over, back, and a shiver
      const blink = Math.max(bump(R, 0.05, 0.1), bump(R, 0.13, 0.18));
      const peek = smooth(seg(R, 0.17, 0.24)) * (1 - smooth(seg(R, 0.32, 0.4)));
      ma.yaw = lerp(clickPose.yaw, 0, into) * (1 - peek) + -0.95 * peek;
      ma.pitch = lerp(clickPose.pitch, 0, into) - 0.22 * peek;
      ma.roll += 0.09 * Math.sin(R * 75) * bump(R, 0.36, 0.48);
      ma.eye = lerp(clickPose.eye, 1.2, into) * (1 - 0.9 * blink) + 0.8 * peek;
      ma.eyeH = lerp(clickPose.eyeH, 1, into) * (1 - 0.92 * blink) + 0.9 * peek;
      ma.eyeW = lerp(clickPose.eyeW, 1, into);

      // the arm slinks home in two embarrassed stutters, plate hanging, light dimming
      const pz1 = 2 - 0.89;
      const s1 = out3(seg(R, 0.07, 0.13));
      const s2 = out3(seg(R, 0.2, 0.3));
      const pz = lerp(lerp(pz1, 0.62, s1), 0.05, s2);
      plate.position.z = pz;
      const droop = smooth(seg(R, 0.02, 0.1)) * (1 - smooth(seg(R, 0.32, 0.4)));
      plate.rotation.x = 0.45 * droop;
      const dim = 1 - 0.6 * smooth(seg(R, 0, 0.12));
      setArm(pz, dim * (1 - seg(R, 0.26, 0.3)));
      plateMat.emissiveIntensity = lerp(plateGlow0, 1.4 * dim, 1 - smooth(seg(R, 0.28, 0.4)));
      if (R > 0.4) plateMat.emissive.copy(plateEm0);

      // Ava: the take un-gasped her; now she squints at Maya (west and a bit north: a small turn right)
      const sus = smooth(seg(R, 0.1, 0.2)) * (1 - smooth(seg(R, 0.36, 0.42)));
      aa.yaw = -0.35 * sus;
      aa.pitch = -0.14 * sus; // leans in
      aa.sy = 1 - 0.05 * sus;
      aa.sx = aa.sz = 1;
      aa.eye = 1 - 0.65 * sus;
      aa.roll = 0.12 * sus;
    }
  });

  // name tags step aside while the camera swings in (the game re-shows them every frame, so hide them after)
  const avaBot = lab.bot('b');
  let tagsOff = false;
  for (const [who, bot] of [[maya, mayaBot], [ava, avaBot]]) {
    const inner = who.each;
    who.each = (m, t) => {
      inner(m, t);
      if (tagsOff && bot.tag) bot.tag.visible = false;
    };
  }
  const tagHook = lab.every(() => {
    const T = lab.t - t0;
    tagsOff = T > 0.4 && T < REW1 + 0.05;
  });

  const releaseCam = driveCamera(lab, (home, t) => {
    const c = camK(tauAt(t - t0));
    // a swing round to the west and down to the glass: her lean over the drop reads in silhouette
    return { target: home.target.clone().lerp(brinkPt, c), az: -0.85 * c, dist: home.dist * (1 - 0.42 * c), el: home.el - 0.3 * c, keep: 1 - c };
  });
  await lab.wait(END);
  stop();
  tagHook();
  A.dim = A.dimCur = 0;
  releaseCam();
  plate.position.z = 0.05;
  plate.rotation.x = 0;
  plateMat.emissiveIntensity = plateGlow0;
  plateMat.emissive.copy(plateEm0);
  maya.finish({ x: 3, y: 2, d: 1 });
  ava.finish({ x: 5, y: 3, d: 3 });
  void origin;
}
