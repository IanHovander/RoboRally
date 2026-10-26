// The drawer, acted: the tile under Maya was a drawer all along. It glides out of the wall with her on it
// like a till opening; by the time it stops she's enjoying it, and she turns to us with her nose up: served.
// Then the tablecloth trick: the drawer whips back into the wall in two frames and she is left hanging in her
// pose on the bare glass, drops a hair, wobbles, looks down, looks at the wall, and recovers her dignity as
// if she meant it all along. Ava is impressed, double-takes, and bounces her approval.
export const meta = {
  title: 'Served',
  idea:
    "The tile under Maya lights up at its edges: it was a drawer all along. A thin tray of smoked glass with bright rails glides out of the wall with her on it, one space south, smooth as a till drawer, and by the end of the ride she's enjoying it: she turns to us, rises and lifts her nose, presented like a dish. Then the tablecloth trick: the drawer whips back into the wall in two frames. She's left hanging in her pose on the bare glass, drops a hair, wobbles, peeks down, peeks at the wall, then puffs up as if she meant it. Ava leans in, double-takes, and gives two little approving hops.",
  notes:
    'Sound: a soft glass "tk" as the edges light, a smooth rising glide like a well-oiled drawer ending on a bright chime (ding!), a held breath, a sharp "shk-THUNK" for the whip back, then a tiny wobble wobble. No plate: the panel\'s housing stays (it still shows its 1-3-5 dots) and its slot at the floor is where the drawer lives. The drawer is drawn only where it is outside the wall, so the row behind the wall stays clear. Acting is on her body only; the pointer stays east.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
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

export default async function play(lab) {
  const { THREE, facing, PALETTE } = lab;
  const A = lab.arena;
  const maya = actor(lab, 'a', true);
  const ava = actor(lab, 'b', false);
  const pusher = A.pushers.get('3,1');
  pusher.kick = null;
  pusher.plate.visible = false; // there is no plate: the drawer is the push
  lab.cleanup(() => (pusher.plate.visible = true));

  const light = (k) => new THREE.Color(PALETTE.light).multiplyScalar(k);
  const glow = (k) => new THREE.MeshBasicMaterial({ color: light(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const unit = new THREE.BoxGeometry(1, 1, 1);

  // ---- the drawer: a tray of smoked glass with bright rails, a lit front lip with a little handle
  const cx = A.pos(3, 1).x;
  const WALL = A.pos(3, 1).z - 0.5; // the wall line the drawer slides out of
  const drawer = new THREE.Group();
  lab.add(drawer);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0, emissive: new THREE.Color(PALETTE.light), emissiveIntensity: 0.04 });
  const base = new THREE.Mesh(unit, glassMat);
  const railL = new THREE.Mesh(unit, glow(2.2));
  const railR = new THREE.Mesh(unit, railL.material);
  const front = new THREE.Mesh(unit, glow(2.6));
  const handle = new THREE.Mesh(unit, glow(4));
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow(0.5)); // light on the tray's glass
  sheen.rotation.x = -Math.PI / 2;
  drawer.add(base, railL, railR, front, handle, sheen);
  // the slot along the wall's foot
  const slot = new THREE.Mesh(unit, glow(3));
  slot.scale.set(1.0, 0.02, 0.025);
  slot.position.set(cx, 0.012, WALL);
  lab.add(slot);
  // the whip's streak: a smear of light along the tray's path for a few frames
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow(1.4));
  streak.rotation.x = -Math.PI / 2;
  lab.add(streak);

  const TH = 0.026; // tray thickness
  /** d: how far out (0 = it is the tile, 1 = one space out); lit: 0..1 */
  const setDrawer = (d, lit, glassOn) => {
    const len = 1 + d;
    const zc = WALL + len / 2;
    base.scale.set(0.94, TH, len - 0.02);
    base.position.set(cx, TH / 2, zc);
    glassMat.opacity = 0.82 * glassOn;
    for (const [r, s] of [
      [railL, -1],
      [railR, 1],
    ]) {
      r.scale.set(0.022, 0.03, len);
      r.position.set(cx + s * 0.47, 0.016, zc);
    }
    railL.material.opacity = lit;
    front.scale.set(0.96, 0.036, 0.024);
    front.position.set(cx, 0.02, WALL + len);
    front.material.opacity = lit;
    handle.scale.set(0.2, 0.026, 0.03);
    handle.position.set(cx, 0.03, WALL + len + 0.02);
    handle.material.opacity = lit;
    sheen.scale.set(0.9, len - 0.06, 1);
    sheen.position.set(cx, TH + 0.002, zc);
    sheen.material.opacity = 0.35 * lit * glassOn;
  };

  // ---- timeline
  const GLOW = 0.1;
  const OUT = GLOW + 0.7; // 0.80 fully out
  const HOLD = OUT + 0.3; // 1.10 the whip starts
  const WHIP = HOLD + 0.07; // 1.17 slammed home
  const DROP = WHIP + 0.08; // she notices the floor is gone
  const END = 1.92;
  const travel = (T) => (T < GLOW ? 0 : T < OUT ? smoother(seg(T, GLOW, OUT)) : T < HOLD ? 1 : 1 - seg(T, HOLD, WHIP) ** 1.5);

  const t0 = lab.t;
  let slammed = false;
  let chimed = false;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    const ma = maya.act;
    const aa = ava.act;
    const d = travel(T);

    // ---- the drawer and its slot
    const lit = smooth(seg(T, 0, GLOW)) * (1 - 0.35 * smooth(seg(T, OUT + 0.05, HOLD))) * (T > WHIP ? 1 - smooth(seg(T, WHIP + 0.05, WHIP + 0.45)) : 1) + (T > WHIP ? 0.9 * (1 - seg(T, WHIP, WHIP + 0.12)) : 0);
    const glassOn = smooth(seg(T, 0, GLOW)) * (T > WHIP ? 1 - smooth(seg(T, WHIP + 0.05, WHIP + 0.45)) : 1);
    setDrawer(d, Math.min(1.2, lit), glassOn);
    slot.material.opacity = 0.9 * smooth(seg(T, 0, GLOW)) * (1 - smooth(seg(T, WHIP + 0.1, WHIP + 0.5))) + (T > WHIP ? 1.5 * (1 - seg(T, WHIP, WHIP + 0.15)) : 0);
    if (T >= OUT && !chimed) {
      chimed = true;
      lab.ring(A.pos(3, 2.5).add(new THREE.Vector3(0, 0.03, 0)), PALETTE.light, 0.35, 0.03, 0.4); // ding! at the front lip
    }
    if (T >= WHIP && !slammed) {
      slammed = true;
      lab.shake(0.012, 0.15);
    }
    // the whip leaves a smear of light along the path for a few frames
    const sm = T > HOLD && T < WHIP + 0.1 ? (T < WHIP ? 1 : 1 - seg(T, WHIP, WHIP + 0.1)) : 0;
    streak.visible = sm > 0;
    if (sm > 0) {
      const fz = WALL + 1 + d;
      streak.scale.set(0.9, 2 - d * 0.9 + 0.1, 1);
      streak.position.set(cx, 0.03, fz + (2 - fz + WALL) / 2 - (2 - d * 0.9 + 0.1) / 2 + 0.6);
      streak.material.opacity = 0.35 * sm;
    }

    // ---- Maya: rides it, enjoys it, is presented; left hanging; drop, wobble, peek, peek, dignity
    const yM = T < HOLD ? 1 + d : 2;
    const riding = T < WHIP;
    const lift = riding ? TH : T < DROP ? TH : TH * (1 - out3(seg(T, DROP, DROP + 0.05)));
    maya.set({ x: 3, y: yM, lift, rot: facing(1), trail: T > GLOW && T < HOLD });
    // notices the glow under her: a look down
    const notice = smooth(seg(T, 0.02, 0.1)) * (1 - smooth(seg(T, 0.14, 0.26)));
    // the start jerks her (top lags north = her left), the stop tips her forward (south = her right)
    const acc = T > GLOW && T < OUT ? Math.sin(seg(T, GLOW, OUT) * Math.PI * 2) : 0;
    const surprised = bump(T, GLOW, GLOW + 0.25);
    const enjoy = smooth(seg(T, 0.3, 0.6)); // settles in: chin up, eye half-lidded
    const present = smooth(seg(T, OUT - 0.06, OUT + 0.1)); // turns to us: ta-da
    const keepPose = T < DROP ? 1 : 1 - smooth(seg(T, DROP, DROP + 0.12));
    const pose = present * keepPose;
    let yaw = -0.85 * pose;
    let pitch = -0.28 * notice + 0.2 * enjoy * (1 - pose) + 0.3 * pose;
    let roll = -0.14 * acc;
    let sy = 1 + 0.1 * surprised + 0.1 * pose;
    let dy = 0.03 * pose;
    let eyeH = 1 + 0.9 * surprised - 0.4 * enjoy * (1 - pose) + 0.2 * pose;
    let eyeOn = 1 + 0.6 * surprised + 0.7 * pose;
    let sx = 1;
    let sz = 1;
    if (T >= DROP) {
      const R = T - DROP;
      // the plop: a small squash as she meets the glass
      const plop = bump(R, 0.02, 0.12);
      sy -= 0.12 * plop;
      sx += 0.06 * plop;
      sz += 0.06 * plop;
      // the wobble (tiny, damped)
      roll += 0.11 * Math.exp(-R * 9) * Math.sin(R * 38);
      // the peek down... the peek at the wall... and the recovery, as if she meant it
      const down = smooth(seg(R, 0.16, 0.22)) * (1 - smooth(seg(R, 0.28, 0.33)));
      const wall = smooth(seg(R, 0.28, 0.34)) * (1 - smooth(seg(R, 0.42, 0.48)));
      const proud = smooth(seg(R, 0.44, 0.5)) * (1 - smooth(seg(R, 0.6, 0.7)));
      yaw += 1.15 * wall - 0.55 * proud;
      pitch += -0.38 * down + 0.06 * wall + 0.3 * proud;
      sy += 0.09 * proud;
      dy += 0.02 * proud;
      eyeH = lerp(eyeH, 1.7, Math.max(down, wall)) - 0.45 * proud;
      eyeOn = lerp(eyeOn, 1.5, Math.max(down, wall)) + 0.4 * proud;
      if (R < 0.12) eyeH = 1.9; // still wide in the hang
    }
    Object.assign(ma, { yaw, pitch, roll, sx, sy, sz, dy, eyeH, eye: eyeOn, eyeW: 1 });

    // ---- Ava: leans in, impressed; double-takes at the whip; two approving hops
    const ooh = smooth(seg(T, 0.45, 0.8)) * (1 - smooth(seg(T, WHIP, WHIP + 0.06)));
    const take = bump(T, WHIP + 0.02, WHIP + 0.14);
    const hop1 = bump(T, 1.5, 1.62);
    const hop2 = bump(T, 1.66, 1.78);
    const hop = Math.max(hop1, hop2);
    aa.yaw = -0.18 * ooh + 0.35 * take * (T < WHIP + 0.08 ? 1 : -1);
    aa.pitch = -0.18 * ooh + 0.16 * take + 0.1 * hop;
    aa.sy = 1 + 0.06 * ooh + 0.12 * hop - 0.1 * bump(T, 1.45, 1.5) - 0.08 * bump(T, 1.62, 1.66);
    aa.sx = aa.sz = 1 - 0.04 * hop;
    aa.dy = 0.07 * hop;
    aa.eye = 1 + 0.9 * ooh + 1.0 * take + 0.6 * hop;
    aa.roll = 0;
  });

  await lab.wait(END);
  stop();
  pusher.plate.visible = true;
  maya.finish({ x: 3, y: 2, d: 1 });
  ava.finish({ x: 5, y: 3, d: 3 });
}
