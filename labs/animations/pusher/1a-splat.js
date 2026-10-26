// Pusher 1a: Pressed against the TV (idea 22), through the lens of weight and physical comedy.
export const meta = {
  title: 'Splat on the TV',
  idea:
    'The plate winds up and fires, Maya is launched straight at us and the camera dives to meet her: SPLAT, she is pressed flat on the inside of the TV, a soft smear of red polish with her eye-light as one bright streak. The TV glass thumps and the smear jiggles, sticks, then gives and slides down with a few drips. The camera springs back home on a rubber band and there she is, tiny, one space south and flat as a coin, until she pops back into shape with a boing, blinks twice, still facing east.',
  notes:
    'Sound: a dull glass "tock" for the plate, a rising whoosh, a fat wet glass "splat" with a low thump of the TV glass, a long rubbery squeak as the smear slides, a springy "boing" (a glass rod plucked) as she re-inflates. Only for panels that push toward the camera; other directions play another pick. Porting: the smear is a canvas in the HUD layer, drawn where she was on screen; the camera is a rush in, a hold and a damped spring back to home.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const EAST = lab.facing(1);
  const pusher = arena.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (k) => Math.max(0, Math.min(1, k));

  // ---------- state the hooks read ----------
  let plateZ = 0.05;
  const sq = { x: 1, y: 1, z: 1 }; // her body's squash: x is world z (the push axis), y up, z world x
  let eye = 1; // her eye-light (1 = as the game draws it)
  let camMix = 0; // 0 home .. 1 nose to nose with her
  let distMul = 1;
  let fovOff = 0;
  const closeTarget = new THREE.Vector3();
  const CLOSE = { el: 0.2, dist: 1.6 };

  const stopPlate = lab.every(() => (plate.position.z = plateZ));
  maya.each = (m) => {
    m.body.scale.set(sq.x, sq.y, sq.z);
    if (eye !== 1) m.eyeMat.color.multiplyScalar(eye);
  };

  // the camera; hold the game's centring offset as it was, so home really is home when we let go
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  let offMix = 1; // 1 = the game's offset, 0 = centred on her
  const stopOff = lab.every(() => {
    if (!arena.camCur) return;
    const k = Math.min(1, arena.dt * 4);
    arena.camCur.sx = (off0.sx * offMix) / (1 - k);
    arena.camCur.sy = (off0.sy * offMix) / (1 - k);
  });
  const releaseCam = lab.camera((home) => {
    const m = camMix;
    const target = home.target.clone().lerp(closeTarget, m);
    const dist = Math.exp(lerp(Math.log(home.dist), Math.log(CLOSE.dist), m)) * distMul;
    return { target, dist, el: lerp(home.el, CLOSE.el, m), az: 0, fov: home.fov + fovOff };
  });

  // ---------- the smear, on the TV's own glass (the overlay) ----------
  const W = lab.overlay.clientWidth || 960;
  const H = lab.overlay.clientHeight || 540;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  lab.overlay.append(cv);
  const g = cv.getContext('2d');
  const smear = { on: false, t0: 0, spread: 0, slide: 0, alpha: 1, drip: 0, cx: W / 2, cy: H / 2 };
  const DRIPS = [[-0.5, 1, 0.032], [-0.08, 0.62, 0.026], [0.36, 0.85, 0.03], [0.68, 0.4, 0.022]];

  function blob(cx, cy, rx, ry, age, inset = 1) {
    // her side, flattened on the glass: a wide soft dome, flatter and fuller at the bottom
    g.beginPath();
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const px = Math.sign(c) * Math.abs(c) ** 0.62;
      const py = Math.sign(s) * Math.abs(s) ** (s > 0 ? 0.45 : 0.9);
      const bulge = s > 0 ? 1 + 0.06 * Math.abs(c) : 1; // it sags a little
      const bump = 1 + (0.03 * Math.sin(a * 5 + 1.3) + 0.02 * Math.sin(a * 11 + age * 2)) * inset;
      const x = cx + px * rx * bump * bulge;
      const y = cy + py * ry * bump;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  function drawSmear(t) {
    g.clearRect(0, 0, W, H);
    if (!smear.on || smear.alpha <= 0.01) return;
    const age = t - smear.t0;
    const s = smear.spread;
    const wob = Math.sin(age * 30) * Math.exp(-age * 6) * 0.07; // jelly
    const rx = W * 0.4 * s * (1 + wob);
    const ry = H * 0.3 * s * (1 - wob * 1.4);
    const cx = smear.cx;
    const cy0 = smear.cy;
    const cy = cy0 + smear.slide * H;
    g.save();
    g.globalAlpha = smear.alpha;
    // the trail it leaves as it slides: a squeegee mark of thin polish
    if (smear.slide > 0.003) {
      const top = cy0 - ry * 0.7;
      const grad = g.createLinearGradient(0, top, 0, cy);
      grad.addColorStop(0, 'rgba(255,77,109,0.0)');
      grad.addColorStop(0.6, 'rgba(255,77,109,0.22)');
      grad.addColorStop(1, 'rgba(255,77,109,0.4)');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(cx - rx * 0.86, top, rx * 1.72, cy - top, ry * 0.5);
      g.fill();
      g.strokeStyle = 'rgba(255,170,185,0.18)';
      g.lineWidth = Math.max(1, H * 0.004);
      for (let i = -5; i <= 5; i++) {
        const x = cx + (i / 5.6) * rx * 0.8;
        g.beginPath();
        g.moveTo(x, top + ry * 0.2 + Math.abs(i) * 3);
        g.lineTo(x, cy);
        g.stroke();
      }
    }
    // drips running down ahead of it
    for (const [dx, len, wd] of DRIPS) {
      const L = smear.drip * len * H * 0.2;
      if (L < 1) continue;
      const x = cx + dx * rx;
      const y = cy + ry * 0.86;
      const w = wd * H;
      g.fillStyle = 'rgba(232,48,85,0.92)';
      g.beginPath();
      g.moveTo(x - w * 0.6, y - w);
      g.quadraticCurveTo(x - w * 0.35, y + L * 0.5, x - w * 0.42, y + L);
      g.arc(x, y + L, w * 0.42, Math.PI, 0, true);
      g.quadraticCurveTo(x + w * 0.35, y + L * 0.5, x + w * 0.6, y - w);
      g.closePath();
      g.fill();
    }
    // a soft halo of polish where it squished outward
    g.filter = `blur(${Math.round(H * 0.018)}px)`;
    g.fillStyle = 'rgba(255,60,95,0.55)';
    blob(cx, cy, rx * 1.06, ry * 1.08, age);
    g.fill();
    g.filter = 'none';
    // the body pressed flat
    const body = g.createRadialGradient(cx - rx * 0.1, cy - ry * 0.25, ry * 0.1, cx, cy + ry * 0.1, rx * 1.05);
    body.addColorStop(0, 'rgba(255,128,150,0.96)');
    body.addColorStop(0.4, 'rgba(255,77,109,0.95)');
    body.addColorStop(0.8, 'rgba(222,36,76,0.92)');
    body.addColorStop(1, 'rgba(170,16,52,0.85)');
    g.fillStyle = body;
    blob(cx, cy, rx, ry, age);
    g.fill();
    // the patch flattened right against the glass: a little paler, with a crisp wet edge
    g.fillStyle = 'rgba(255,150,170,0.18)';
    blob(cx, cy + ry * 0.04, rx * 0.8, ry * 0.7, age, 1.8);
    g.fill();
    g.strokeStyle = 'rgba(255,215,222,0.55)';
    g.lineWidth = Math.max(1, H * 0.005);
    g.stroke();
    // the TV glass's own reflection across her
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.ellipse(cx - rx * 0.28, cy - ry * 0.52, rx * 0.42, ry * 0.07, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.ellipse(cx + rx * 0.1, cy + ry * 0.46, rx * 0.62, ry * 0.06, 0.03, 0, Math.PI * 2);
    g.fill();
    // her eye-light, smeared into one bright streak (she faces east: the right of the screen)
    const ex = cx + rx * 0.4;
    const ey = cy - ry * 0.3;
    const smearUp = Math.min(ry * 0.6, smear.slide * H * 1.4);
    if (smearUp > 1) {
      const sg = g.createLinearGradient(0, ey - smearUp, 0, ey);
      sg.addColorStop(0, 'rgba(255,245,225,0)');
      sg.addColorStop(1, 'rgba(255,245,225,0.35)');
      g.fillStyle = sg;
      g.fillRect(ex - rx * 0.3, ey - smearUp, rx * 0.6, smearUp);
    }
    // her pointer, squashed flat against the glass just off her nose (she faces east: screen right)
    {
      const px = cx + rx * 1.02;
      const py = cy + ry * 0.12;
      const pw = rx * 0.16;
      const ph = ry * 0.16;
      g.save();
      g.shadowColor = 'rgba(255,90,120,1)';
      g.shadowBlur = H * 0.03;
      g.fillStyle = 'rgba(255,130,155,0.95)';
      g.beginPath();
      g.moveTo(px + pw, py);
      g.lineTo(px, py - ph);
      g.lineTo(px + pw * 0.12, py);
      g.lineTo(px, py + ph);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.shadowColor = 'rgba(255,238,205,1)';
    g.shadowBlur = H * 0.06;
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.ellipse(ex, ey, rx * 0.34, ry * 0.065, -0.02, 0, Math.PI * 2);
    g.fill();
    g.fill();
    g.restore();
    // the TV's glass rings from the hit
    if (age < 0.5) {
      const k = age / 0.5;
      g.strokeStyle = `rgba(255,236,226,${0.4 * (1 - k) ** 2})`;
      g.lineWidth = Math.max(1, H * 0.005);
      for (const r of [0.5, 0.8, 1.1]) {
        g.beginPath();
        g.ellipse(cx, cy0, W * (0.3 + k * r * 0.7), H * (0.24 + k * r * 0.5), 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  const stopDraw = lab.every((dt, t) => drawSmear(t));

  // ---------- 0.00-0.16 the plate winds up and fires ----------
  await lab.tween(0.1, (e) => (plateZ = 0.05 - 0.05 * e), ease.out);
  await lab.tween(0.06, (e) => {
    plateZ = 0.3 * e;
    sq.x = 1 - 0.22 * e; // she squashes where it hits
    sq.y = 1 + 0.08 * e;
    sq.z = 1 + 0.05 * e;
  }, ease.in);
  arena.emit('push');

  // ---------- 0.16-0.56 launched at us; the camera dives to meet her ----------
  lab.tween(0.3, (e) => (plateZ = 0.3 - 0.25 * e), ease.inOut);
  await lab.tween(0.4, (e, k) => {
    const y = 1 + ease.out3(k);
    maya.set({ y, lift: Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.2, rot: EAST });
    sq.x = lerp(0.78, 1.06, ease.out(k)); // she stretches out of the squash as she flies
    sq.y = lerp(1.08, 0.96, k);
    sq.z = lerp(1.05, 1, k);
    const p = lab.pos(3, y);
    closeTarget.set(p.x, 0.22 + maya.pose.lift, p.z);
    const c = ease.in3(clamp01((k - 0.04) / 0.96));
    camMix = c;
    offMix = 1 - c;
  }, ease.linear);

  // ---------- 0.56 SPLAT: she is on the TV's glass now ----------
  const sp = lab.toScreen(new THREE.Vector3(closeTarget.x, 0.2, closeTarget.z));
  smear.cx = Math.max(W * 0.35, Math.min(W * 0.65, sp.x));
  smear.cy = Math.max(H * 0.35, Math.min(H * 0.6, sp.y));
  smear.on = true;
  smear.t0 = lab.t;
  maya.set({ y: 2, lift: 0, visible: false });
  sq.x = 1.5;
  sq.y = 0.1;
  sq.z = 1.45;
  lab.tween(0.16, (e) => (smear.spread = lerp(0.9, 1.05, e)), ease.outBack);
  lab.tween(0.5, (e, k) => {
    fovOff = Math.sin(k * Math.PI * 3) * Math.exp(-k * 5) * 2.4; // the TV glass thumps
    distMul = 1 - Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.05;
  }, ease.linear);
  // stuck... stuck... then it gives
  await lab.tween(0.42, (e, k) => {
    smear.slide = Math.max(0, k - 0.45) ** 2 * 0.14;
    smear.drip = ease.out(clamp01((k - 0.35) / 0.65)) * 0.55;
  }, ease.linear);

  // ---------- the camera springs home; the smear lets go; she is still flat as a coin... boing ----------
  const s0 = smear.slide;
  const d0 = smear.drip;
  lab.tween(0.24, (e, k) => {
    smear.slide = s0 + 0.06 * k + 0.1 * k * k;
    smear.drip = d0 + 0.4 * k;
    smear.alpha = 1 - ease.in(k);
  }, ease.linear);
  lab.at(0.04, () => maya.set({ visible: true }));
  lab.at(0.36, async () => {
    // the pop: up and too tall, a little hop, then a wobble that dies away
    await lab.tween(0.36, (e, k) => {
      const b = ease.outElastic(Math.min(1, k * 1.05));
      sq.y = lerp(0.1, 1, b);
      sq.x = lerp(1.5, 1, b);
      sq.z = lerp(1.45, 1, b);
      maya.set({ lift: Math.max(0, Math.sin(Math.min(1, k * 2.4) * Math.PI)) * 0.12 });
    }, ease.linear);
    sq.x = sq.y = sq.z = 1;
    maya.set({ lift: 0 });
  });
  lab.at(0.72, async () => {
    // two dazed blinks
    await lab.tween(0.16, (e, k) => (eye = k < 0.25 || (k > 0.5 && k < 0.75) ? 0.08 : 1), ease.linear);
    eye = 1;
  });
  await lab.tween(0.48, (e, k) => {
    const spring = 1 - (1 - k) ** 3 * Math.cos(k * Math.PI * 2.3);
    camMix = 1 - spring;
    offMix = clamp01(spring);
  }, ease.linear);
  camMix = 0;
  offMix = 1;
  await lab.wait(0.41);

  stopDraw();
  g.clearRect(0, 0, W, H);
  stopPlate();
  stopOff();
  plate.position.z = 0.05;
  sq.x = sq.y = sq.z = 1;
  eye = 1;
  maya.each = null;
  maya.model.body.scale.set(1, 1, 1);
  releaseCam();
  maya.release({ x: 3, y: 2, d: 1 });
}
