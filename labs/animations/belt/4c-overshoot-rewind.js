// Belt, idea 4 (Overshoot and Rewind), animator c: cinematic staging.
export const meta = {
  title: 'Overshoot and Rewind (the replay)',
  idea:
    'The belt is overeager: it carries Maya through the corner and on down the south leg, turning her south. Then the picture freezes like a sports replay. Time stops dead (chevrons, trail, everything), the room drops into shadow, black bars slide in, and the camera crash-zooms onto the mistake with a slight dutch tilt. Then it rewinds: the chevrons run backwards, her red trail winds back up the belt under her like tape onto a spool, and she slides backwards in strobed afterimages of light, a long exposure played in reverse. The corner\'s turn to east then plays properly, softly, and the frame opens back up.',
  notes:
    'Sound: the belt whirr running a little too long, a hard cut to silence with a soft camera-shutter "tk" on the freeze, a reversed glass shimmer (tape rewinding) during the rewind, then the normal soft belt chime and a settled two-note "there". The freeze is real: the scene\'s clock stops (lab.timeScale 0), so everything on the board holds. Keep it rare (once or twice a game) so the fake-out keeps working. On the way back it also shows where the belt will take her next register.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;

  const maya = lab.puppet('a');
  const bot = lab.bot('a');
  const red = new THREE.Color(bot.color ?? '#ff4d6d');
  const express = arena.belts.filter((b) => b.fast);
  const speed0 = express.map((b) => b.speed);
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  lab.cleanup(() => {
    express.forEach((b, i) => (b.speed = speed0[i]));
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    lab.timeScale = 1;
  });

  // ---- the path: east along row 1 to the corner, then south down the leg (s = spaces from (2,1)) ----
  const at = (s) => (s <= 1 ? { x: 2 + s, y: 1 } : { x: 3, y: 1 + (s - 1) });
  const rotWrong = (s) => facing(0) + (facing(2) - facing(0)) * ease.inOut(seg(s, 0.62, 1.38)); // north -> east -> south
  const p2 = lab.pos(2, 1);
  const pc = lab.pos(3, 1);
  const sOf = (pt) => (pt.z <= pc.z + 0.02 ? pt.x - p2.x : 1 + (pt.z - pc.z));

  // ---- letterbox bars and a snapshot flash on the HUD layer ----
  const bars = ['top', 'bottom'].map((side) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:0;right:0;${side}:0;height:0;background:#020304;pointer-events:none;`;
    lab.overlay.append(el);
    return el;
  });
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:#f4efe4;opacity:0;pointer-events:none;';
  lab.overlay.append(flash);

  // ---- afterimages: her ring and pointer, left behind in light as she rewinds ----
  const ghostGeo = new THREE.RingGeometry(0.385 * 1.3, 0.41 * 1.3, 48);
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.085 * 1.3);
  tri.lineTo(0.075 * 1.3, -0.02 * 1.3);
  tri.lineTo(-0.075 * 1.3, -0.02 * 1.3);
  tri.closePath();
  const tickGeo = new THREE.ShapeGeometry(tri);
  const ghosts = [];
  const addGhost = (x, y, rot, born) => {
    const mat = new THREE.MeshBasicMaterial({ color: red.clone().lerp(new THREE.Color(1, 1, 1), 0.45).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(ghostGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    const tick = new THREE.Mesh(tickGeo, mat);
    tick.rotation.x = -Math.PI / 2;
    tick.position.set(0, 0, -0.47 * 1.3);
    g.add(ring, tick);
    const p = lab.pos(x, y);
    g.position.set(p.x, 0.012, p.z);
    g.rotation.y = rot;
    lab.add(g);
    ghosts.push({ g, mat, born });
  };

  // ---- camera ----
  const cam = { dx: 0, dz: 0, dk: 1, del: 0, roll: 0, az: 0 };
  let frameOff = null;
  const releaseCam = lab.camera((home) => {
    const cc = arena.camCur;
    if (cc) {
      frameOff ??= { sx: cc.sx ?? 0, sy: cc.sy ?? 0 };
      const k = Math.min(0.95, arena.dt * 4);
      cc.sx = frameOff.sx / (1 - k);
      cc.sy = frameOff.sy / (1 - k);
    }
    return { target: home.target.clone().add(new THREE.Vector3(cam.dx, 0, cam.dz)), az: home.az + cam.az, el: home.el + cam.del, dist: home.dist * cam.dk, roll: cam.roll };
  });

  // ---- timeline (REAL seconds: the scene's clock stops during the freeze) ----
  const EXP = [0, 0.3]; // express step
  const OVER = [0.32, 0.8]; // overeager: through the corner and halfway down the south leg
  const FREEZE = 0.8;
  const REW = [1.1, 1.62]; // rewind, back to before the corner
  const PROPER = [1.68, 2.08]; // the corner's turn, played properly
  const END = 2.4;
  const S_OVER = 1.5;
  const S_BACK = 0.52;

  const r0 = lab.real;
  let lastGhost = -1;
  let s = 0;
  let rot = facing(0);
  let squash = 0;
  const stop = lab.every(() => {
    const t = lab.real - r0;

    // ---- the world's clock: running, frozen, running ----
    lab.timeScale = t < FREEZE ? 1 : t < REW[0] - 0.02 ? 0 : 1;

    // ---- the belt ----
    let speedK = 1;
    if (t < FREEZE) speedK = 1.6; // overeager
    else if (t < REW[0]) speedK = 0;
    else if (t < REW[1]) speedK = -4.5 * Math.sin(seg(t, REW[0], REW[1]) * Math.PI) - 0.5; // backwards, fast
    else speedK = mix(0, 1, seg(t, REW[1], PROPER[0]));
    express.forEach((b, i) => (b.speed = speed0[i] * speedK));

    // ---- Maya ----
    let x;
    let y;
    let lift = 0;
    let trail = true;
    if (t < EXP[1]) {
      ({ x, y } = { x: 1 + ease.inOut(seg(t, EXP[0], EXP[1])), y: 1 });
      rot = facing(0);
    } else if (t < FREEZE) {
      s = S_OVER * ease.inOut(seg(t, OVER[0], OVER[1]));
      ({ x, y } = at(s));
      rot = rotWrong(s);
    } else if (t < REW[0]) {
      ({ x, y } = at(s)); // frozen where she went wrong
    } else if (t < PROPER[0]) {
      // rewind: an accelerating, then braking pull back up the belt
      s = mix(S_OVER, S_BACK, ease.inOut3(seg(t, REW[0], REW[1])));
      ({ x, y } = at(s));
      rot = rotWrong(s);
      trail = false;
      // wind the trail back up under her, like tape onto a spool
      const tr = bot.trail;
      while (tr.length > 1 && sOf(tr[tr.length - 1]) > s + 0.04) tr.pop();
      // strobed afterimages, a long exposure in reverse
      if (t < REW[1] - 0.04 && t - lastGhost > 0.05) {
        lastGhost = t;
        addGhost(x, y, rot, t);
      }
    } else {
      // the turn, played properly, with a soft settle
      const k = seg(t, PROPER[0], PROPER[1]);
      s = mix(S_BACK, 1, ease.inOut(k));
      ({ x, y } = at(s));
      rot = facing(0) + (facing(1) - facing(0)) * ease.outBack(seg(t, PROPER[0] + 0.08, PROPER[1] + 0.12), 1.3);
      squash = Math.sin(seg(t, PROPER[1] - 0.05, PROPER[1] + 0.25) * Math.PI);
    }
    maya.set({ x, y, rot, lift, trail, sy: 1 - 0.07 * squash, sx: 1 + 0.035 * squash, sz: 1 + 0.035 * squash });

    // ---- ghosts fade (real time, so they fade even though the world is paused) ----
    for (const gh of ghosts) gh.mat.opacity = Math.max(0, 1 - (t - gh.born) / 0.42) ** 1.4 * 0.85;

    // ---- the room: dark for the replay, back with the proper turn ----
    const dark = ease.out3(seg(t, FREEZE, FREEZE + 0.12)) * (1 - ease.inOut(seg(t, PROPER[0], PROPER[1] + 0.2)));
    arena.topMat.emissiveIntensity *= 1 - 0.55 * dark;
    express.forEach((b) => b.mat.color.multiplyScalar(1 - 0.25 * dark + (t > REW[0] && t < REW[1] ? 0.6 * Math.sin(seg(t, REW[0], REW[1]) * Math.PI) : 0)));
    arena.key.intensity = key0 * (1 - 0.45 * dark);
    arena.hemi.intensity = hemi0 * (1 - 0.5 * dark);

    // ---- letterbox and the snapshot flash ----
    const box = ease.out3(seg(t, FREEZE, FREEZE + 0.14)) * (1 - ease.inOut(seg(t, PROPER[1] - 0.1, END - 0.12)));
    for (const b of bars) b.style.height = `${(box * 9).toFixed(2)}%`;
    flash.style.opacity = String(t >= FREEZE ? 0.22 * Math.max(0, 1 - (t - FREEZE) / 0.16) : 0);

    // ---- camera: a crash-zoom onto the mistake, a dutch tilt, then it follows her back and goes home ----
    const wrong = lab.pos(3, 1 + (S_OVER - 1));
    const her = lab.pos(x, y);
    const zoom = ease.out3(seg(t, FREEZE, FREEZE + 0.11));
    const back = ease.inOut(seg(t, REW[0], REW[1]));
    const home = ease.inOut(seg(t, PROPER[0] - 0.05, END - 0.03));
    const focus = new THREE.Vector3().lerpVectors(wrong, her, back);
    const f = zoom * (1 - home);
    cam.dx = focus.x * 0.6 * f;
    cam.dz = focus.z * 0.6 * f;
    cam.dk = 1 - f * mix(0.36, 0.24, back);
    cam.del = -0.06 * f;
    cam.roll = 0.045 * zoom * (1 - back);
    cam.az = -0.06 * f * (1 - back);
  });

  await lab.waitReal(END);
  stop();
  lab.timeScale = 1;
  express.forEach((b, i) => (b.speed = speed0[i]));
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  for (const b of bars) b.remove();
  flash.remove();
  for (const gh of ghosts) gh.g.visible = false;
  releaseCam();
  maya.set({ x: 3, y: 1, rot: facing(1), sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 3, y: 1, d: 1 });
}
