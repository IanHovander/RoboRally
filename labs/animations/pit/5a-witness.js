// Pit, idea 20 (Look to camera), animator a: weight & physical comedy.
export const meta = {
  title: 'The witness (look to camera)',
  idea:
    'Maya drives off the rim and drops like a stone: no spin, no shrink, just gone. A long moment later the thud ' +
    'arrives from far below: the glass shivers and a faint ripple of light rolls out from the hole across the ' +
    'board. It reaches Theo, who had nothing to do with any of it, and jostles him. He slowly, heavily turns from ' +
    'north to face us, his light brightening as it swings toward the sofa, and the camera crash-zooms in on him ' +
    'like a documentary. He holds it. Blinks once. Then swivels back north, a little too fast, overshoots, wobbles, ' +
    'and the camera snaps back out as if nothing happened.',
  notes:
    'Sound: nothing for the drop; then, late, a deep soft "thoom" of glass from far below; a little rattle as Theo ' +
    'is jostled; a slow heavy grinding turn (a rubbed-glass groan), a tiny "tik" for the blink, and a quick squeak ' +
    'as he turns back. In the game the witness is whichever robot is nearest the pit (skip the look if nobody is ' +
    'within a few spaces); the turn goes the short way round, toward the pit side first.',
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (s, a, b) => clamp01((s - a) / (b - a));

const T = {
  windup: [0, 0.06],
  drive: [0.06, 0.66], // 0.96 -> 3.55, then off the edge
  thud: 1.1, // from far below
  jostle: [1.38, 1.62], // the ripple reaches Theo
  turn: [1.46, 2.28], // north -> facing us, slowly
  zoomIn: [2.36, 2.58],
  blink: [2.66, 2.74],
  back: [2.94, 3.24], // back north, faster
  settle: [3.24, 3.34],
  end: 3.36,
};
const Y = 1;

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const mb = maya.bot;
  const tb = theo.bot;
  const warm = new THREE.Color(3.2, 3.1, 2.9);

  lab.playCard('a', ['m3']);

  // Theo's light, seen head-on: a soft warm glow on his ridge that grows as he faces the room
  const glowTex = canvasTex(THREE, 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,.5)');
    grad.addColorStop(0.55, 'rgba(255,255,255,.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const gaze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0xfff1dc).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  gaze.renderOrder = 20;
  lab.add(gaze);
  const ridgeLocal = new THREE.Vector3(0, 0.2, -0.16); // halfway up his lit ridge, in his own space
  const rippleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2e0).multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 96), rippleMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.copy(lab.pos(4, 1)).setY(0.01);
  ripple.visible = false;
  lab.add(ripple);
  lab.cleanup(() => glowTex.dispose());

  // ---------- Maya: straight off the edge and down ----------
  let cardFade = 1;
  maya.each = () => {
    if (mb.card) {
      mb.card.position.y -= Math.min(0, maya.pose.lift);
      mb.card.material.opacity *= cardFade;
    }
  };

  // ---------- Theo ----------
  let eye = 1;
  let look = 0; // how much he faces us (0 north .. 1 south)
  theo.each = (m) => {
    const k = eye * (1 + 1.5 * look ** 3);
    m.eyeMat.color.copy(warm).multiplyScalar(k);
    m.paint.emissiveIntensity = 0.16 + 0.1 * look ** 3 * eye;
    const p = ridgeLocal.clone();
    m.group.localToWorld(p);
    gaze.position.copy(p);
    gaze.material.opacity = look ** 4 * eye;
    gaze.scale.setScalar(0.42 + 0.2 * look ** 4);
  };

  // ---------- the camera: the documentary crash zoom ----------
  const cc = arena.camCur;
  const keep = cc ? { sx: cc.sx, sy: cc.sy } : null;
  const theoAt = lab.pos(5, 3).setY(0.28);
  let zoom = 0;
  let releaseCam = null;
  const takeCamera = () =>
    lab.camera((h) => {
      // keep the picture's centring exactly as the game has it, so nothing drifts when we hand it back
      if (keep && arena.camCur) {
        const k = Math.min(1, arena.dt * 4);
        arena.camCur.sx = keep.sx / (1 - k);
        arena.camCur.sy = keep.sy / (1 - k);
      }
      return {
        target: h.target.clone().lerp(theoAt, 0.6 * zoom),
        dist: h.dist * (1 - 0.38 * zoom),
        el: h.el - 0.06 * zoom,
      };
    });

  const t0 = lab.t;
  let thudded = false;
  const glass0 = arena.topMat.emissiveIntensity;
  lab.cleanup(() => (arena.topMat.emissiveIntensity = glass0));
  const north = lab.facing(0);
  const facingUs = Math.PI; // turning left (via west, toward the pit side), half way round
  const stop = lab.every((dt, now) => {
    const s = now - t0;

    // --- Maya ---
    const mp = { x: 1, lift: 0, pitch: 0, trail: true, visible: true };
    if (s < T.drive[0]) {
      const k = seg(s, ...T.windup);
      mp.x = 1 - 0.04 * Math.sin(k * Math.PI * 0.5);
    } else if (s < T.drive[1]) {
      const k = seg(s, ...T.drive);
      mp.x = lerp(0.96, 3.55, 0.25 * k * k + 0.75 * k);
    } else {
      // the floor just isn't there: she carries on a little and falls, flat and clean
      const kd = s - T.drive[1];
      mp.x = 3.55 + 0.45 * (1 - Math.exp(-kd * 9));
      mp.lift = -0.5 * 22 * kd * kd;
      mp.trail = false;
      cardFade = Math.max(0, 1 - kd / 0.14);
    }
    mp.visible = mp.lift > -0.7;
    maya.set(mp);

    // --- the thud, late, from far below ---
    if (!thudded && s >= T.thud) {
      thudded = true;
      lab.shake(0.018, 0.35);
    }
    const kt = s - T.thud;
    // the ripple in the glass: faint, warm, just far enough to reach him
    const kr = clamp01(kt / 0.85);
    ripple.visible = kt > 0 && kr < 1;
    if (ripple.visible) {
      ripple.scale.setScalar(0.62 + 1.9 * ease.out(kr));
      rippleMat.opacity = 0.55 * (1 - kr) ** 1.4 * Math.min(1, kt / 0.05);
    }
    arena.topMat.emissiveIntensity = glass0 * (kt > 0 && kt < 0.5 ? 1 - 0.22 * Math.sin((kt / 0.5) * Math.PI) * Math.exp(-kt * 3) : 1);

    // --- Theo ---
    const tp = { x: 5, y: 3, rot: north, lift: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, trail: false };
    // jostled by the ripple: a little hop and a rattle
    const kj = seg(s, ...T.jostle);
    if (kj > 0 && kj < 1) {
      tp.lift = 0.05 * Math.sin(Math.min(1, kj * 2.2) * Math.PI);
      tp.roll = 0.07 * Math.sin(kj * Math.PI * 5) * (1 - kj);
      const sq = Math.sin(kj * Math.PI * 3) * (1 - kj);
      tp.sy = 1 - 0.08 * sq;
      tp.sx = tp.sz = 1 + 0.05 * sq;
    }
    let rot = north;
    if (s >= T.turn[0] && s < T.back[0]) {
      // heavy: slow to get going, slow to stop, a small overshoot as the weight settles
      const k = seg(s, ...T.turn);
      const e = ease.inOut3(k);
      const over = s > T.turn[1] ? 0.07 * Math.sin(clamp01((s - T.turn[1]) / 0.3) * Math.PI) * Math.exp(-(s - T.turn[1]) * 4) : 0;
      rot = north + facingUs * e + over;
      tp.pitch = -0.05 * Math.sin(k * Math.PI); // leaning back into the turn
      tp.sy *= 1 + 0.02 * Math.sin(k * Math.PI);
    } else if (s >= T.back[0]) {
      // back north, quicker, overshooting and wobbling, as if nothing happened
      const k = seg(s, ...T.back);
      const e = ease.inOut(k);
      rot = north + facingUs * (1 - e);
      if (s >= T.back[1]) {
        const ks = s - T.back[1];
        rot = north - 0.12 * Math.sin(Math.min(1, ks / 0.1) * Math.PI) * Math.exp(-ks * 8);
      }
      tp.pitch = 0.06 * Math.sin(k * Math.PI);
      tp.roll = -0.04 * Math.sin(k * Math.PI);
    }
    tp.rot = rot;
    look = (1 - Math.cos(rot - north)) / 2;
    const kb = seg(s, ...T.blink);
    eye = kb > 0 && kb < 1 ? 0.05 : 1;
    theo.set(tp);

    // --- the camera ---
    if (s >= T.zoomIn[0] && !releaseCam) releaseCam = takeCamera();
    if (s < T.back[0]) zoom = ease.outBack(seg(s, ...T.zoomIn), 2.2);
    else zoom = 1 - ease.inOut(seg(s, T.back[0], T.back[0] + 0.28));
  });

  await lab.wait(T.end);
  stop();
  zoom = 0;
  releaseCam?.();
  arena.topMat.emissiveIntensity = glass0;
  gaze.material.opacity = 0;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
  void tb;
}
