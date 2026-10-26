// Look to camera, staged as a mockumentary: Maya is simply gone; the camera operator notices Theo turning
// and crash-zooms in (in two jerks, finding the shot); Theo's eye-light lands in the lens as an anamorphic
// flare across the whole picture; he holds it, blinks once, and turns back as the camera snaps out.
export const meta = {
  title: 'Documentary',
  idea:
    'Maya drops cleanly into the hole: no spin, no shrink, just gone. A beat of silence. Across the board Theo slowly turns, his gaze passing over the hole, until he faces us; a handheld documentary camera notices and crash-zooms in on him in two jerks, finding the shot. As his eye-light swings into the lens it flares: a thin anamorphic streak of warm light across the whole picture, the room dimming around it. He holds the look, blinks once, then turns back north a little faster than he turned away, and the camera snaps back out to the board as if nothing happened.',
  notes:
    'Sound: nothing for the drop; a faint room tone; a tiny lens-motor whirr on each zoom jerk; a soft rising glass shimmer as the flare blooms, cut dead when he turns back. Porting: the zoom is a real focal-length change from a fixed tripod position (fov 30 to 12, panning to the witness), with a little handheld wobble; the flare is DOM in the HUD layer at the projected eye position, strength = how squarely the eye faces the lens. In the game the witness is the robot nearest the pit.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = (x, y, h = 0) => lab.pos(x, y).setY(h);
  const BLUE = '#4dabf7';

  // ---------- Maya: drives in, and is simply gone ----------
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  lab.playCard('a', ['m3']);
  await lab.tween(0.84, (e, k) => maya.set({ x: 1 + 3 * (0.25 * k * k + 0.75 * k) }), ease.linear);
  await lab.tween(0.1, (e) => maya.set({ lift: -0.7 * e, trail: false }), ease.in);
  maya.set({ visible: false });
  maya.release({ on: false });

  // a beat of silence
  await lab.wait(0.3);

  // ---------- the documentary camera: a fixed tripod that pans and zooms ----------
  const home = arena.camHome;
  const tripod = home.target.clone().add(new THREE.Vector3(0, Math.sin(home.elev) * home.dist, Math.cos(home.elev) * home.dist));
  const saved = arena.camCur ? { sx: arena.camCur.sx, sy: arena.camCur.sy } : null;
  const theoAt = W(5, 3, 0.3);
  const rig = { aim: 0, fov: 30, shake: 0, offX: 0, offZ: 0 };
  const aimTarget = new THREE.Vector3();
  const releaseCam = lab.camera((h, t) => {
    aimTarget.copy(home.target).lerp(theoAt, rig.aim);
    aimTarget.x += rig.offX;
    aimTarget.z += rig.offZ;
    const v = tripod.clone().sub(aimTarget);
    const dist = v.length();
    const wob = rig.shake;
    // keep the game's framing offset, so handing the camera back is seamless
    if (saved && arena.camCur) {
      const k = Math.min(1, arena.dt * 4);
      arena.camCur.sx = saved.sx / (1 - k);
      arena.camCur.sy = saved.sy / (1 - k);
    }
    return {
      target: aimTarget.clone(),
      dist,
      el: Math.asin(v.y / dist) + wob * 0.004 * Math.sin(t * 7.3),
      az: Math.atan2(v.x, v.z) + wob * 0.005 * Math.sin(t * 5.1 + 1),
      fov: rig.fov,
    };
  });

  // ---------- the lens flare (HUD layer) ----------
  const flare = document.createElement('div');
  flare.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;opacity:0';
  flare.innerHTML = `
    <div style="position:absolute;left:-90vw;top:-2px;width:180vw;height:4px;background:linear-gradient(90deg,transparent,rgba(255,244,228,.65) 25%,#fffaf2 50%,rgba(255,244,228,.65) 75%,transparent);filter:blur(.8px)"></div>
    <div style="position:absolute;left:-80vw;top:-14px;width:160vw;height:28px;background:linear-gradient(90deg,transparent,rgba(77,171,247,.35) 25%,rgba(150,205,255,.6) 50%,rgba(77,171,247,.35) 75%,transparent);filter:blur(7px)"></div>
    <div style="position:absolute;left:-60px;top:-60px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(255,250,240,.95) 0,rgba(255,240,220,.45) 18%,rgba(255,230,200,.12) 45%,transparent 70%)"></div>`;
  const ghosts = [0.55, 1.35, 1.8].map((f, i) => {
    const g = document.createElement('div');
    const r = [26, 46, 16][i];
    g.style.cssText = `position:absolute;width:${r * 2}px;height:${r * 2}px;margin:-${r}px 0 0 -${r}px;border-radius:50%;pointer-events:none;opacity:0;background:radial-gradient(circle,${['rgba(255,240,220,.18)', 'rgba(77,171,247,.12)', 'rgba(255,240,220,.22)'][i]} 0,transparent 70%);border:1px solid ${['rgba(255,240,220,.12)', 'rgba(140,200,255,.12)', 'rgba(255,240,220,.1)'][i]}`;
    lab.overlay.append(g);
    return { g, f };
  });
  lab.overlay.append(flare);
  // the documentary's lower third: his name, in Lumen's thin type
  const third = document.createElement('div');
  third.style.cssText = 'position:absolute;left:7%;bottom:11%;pointer-events:none;opacity:0;font-family:Lumen,system-ui,sans-serif;color:#f4efe4;text-shadow:0 0 12px rgba(0,0,0,.6)';
  third.innerHTML = '<div style="font-weight:300;font-size:min(4.4vw,7.8vh);letter-spacing:.06em;line-height:1">Theo</div><div style="height:1px;width:0;background:#4dabf7;box-shadow:0 0 8px #4dabf7;margin:.5em 0 .45em" class="rule"></div><div style="font-weight:300;font-size:min(1.7vw,3vh);letter-spacing:.32em;opacity:.75">WITNESS</div>';
  lab.overlay.append(third);
  const rule = third.querySelector('.rule');
  let thirdOn = 0;
  const stopThird = lab.every(() => {
    third.style.opacity = String(thirdOn);
    third.style.transform = `translateX(${(1 - thirdOn) * -12}px)`;
    rule.style.width = `${(thirdOn * 4.2).toFixed(2)}em`;
    const tag = arena.bots.get('b')?.tag;
    if (tag) tag.material.opacity = Math.max(0, 1 - rig.aim * 1.6);
  });

  // ---------- Theo ----------
  const theo = lab.puppet('b');
  const tm = theo.model;
  const eyeLocal = new THREE.Vector3(0, 0.19, -0.16);
  const eyeWorld = new THREE.Vector3();
  let blink = 1;
  let roomDim = 0;
  let flareK = 0;
  theo.set({ rot: facing(0) });
  theo.each = (m) => {
    // how squarely his eye faces the lens (south, toward the sofa)
    const look = Math.max(0, Math.cos(theo.pose.rot - Math.PI));
    m.eyeMat.color.multiplyScalar((1 + 1.6 * look ** 2) * blink);
    m.poolMat.opacity = Math.min(1, m.poolMat.opacity * (1 + 0.5 * look));
    flareK = look ** 10 * blink;
    tm.body.localToWorld(eyeWorld.copy(eyeLocal));
    const s = lab.toScreen(eyeWorld);
    flare.style.left = `${s.x}px`;
    flare.style.top = `${s.y}px`;
    flare.style.opacity = String(flareK);
    const r = lab.overlay.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    for (const { g, f } of ghosts) {
      g.style.left = `${s.x + (cx - s.x) * f}px`;
      g.style.top = `${s.y + (cy - s.y) * f}px`;
      g.style.opacity = String(flareK);
    }
    // the room dims around the look
    arena.dim = arena.dimCur = roomDim * 0.32;
  };
  lab.cleanup(() => {
    arena.dim = 0;
    arena.dimCur = 0;
  });

  // he turns slowly (via west, his gaze passing over the hole) to face us
  const turn = lab.tween(0.85, (e) => theo.set({ rot: Math.PI * e }), ease.inOut);
  // the operator notices: a fast zoom in, slightly off, then a correction onto him
  lab.at(0.18, async () => {
    rig.shake = 1;
    await lab.tween(0.16, (e) => {
      rig.aim = 0.85 * e;
      rig.fov = 30 - 13 * e;
      rig.offX = -0.25 * e;
    }, ease.out);
    await lab.wait(0.14);
    await lab.tween(0.14, (e) => {
      rig.aim = 0.85 + 0.15 * e;
      rig.fov = 17 - 5 * e;
      rig.offX = -0.25 * (1 - e);
    }, ease.outBack);
  });
  lab.at(0.45, () => lab.tween(0.45, (e) => (roomDim = e), ease.inOut));
  await turn;

  // the look: hold it... blink once... hold
  lab.tween(0.25, (e) => (thirdOn = e), ease.out);
  await lab.wait(0.3);
  await lab.tween(0.16, (e, k) => (blink = 1 - 0.92 * Math.sin(k * Math.PI)), ease.linear);
  blink = 1;
  await lab.wait(0.2);

  // back to work: he turns back north, a little faster; the camera snaps back out
  lab.tween(0.24, (e) => {
    rig.aim = 1 - e;
    rig.fov = 12 + 18 * e;
    rig.shake = 1 - e;
  }, ease.inOut);
  lab.tween(0.3, (e) => (roomDim = 1 - e), ease.out);
  lab.tween(0.12, (e) => (thirdOn = 1 - e), ease.linear);
  await lab.tween(0.38, (e) => theo.set({ rot: Math.PI * (1 - e) }), ease.inOut);
  rig.aim = 0;
  rig.fov = 30;
  rig.shake = 0;
  roomDim = 0;
  await lab.wait(1 / 30);
  theo.each = null;
  stopThird();
  third.style.opacity = '0';
  const tag = arena.bots.get('b')?.tag;
  if (tag) tag.material.opacity = 1;
  arena.dim = arena.dimCur = 0;
  flare.style.opacity = '0';
  for (const { g } of ghosts) g.style.opacity = '0';
  releaseCam();
  theo.release({ x: 5, y: 3, d: 0 });
}
