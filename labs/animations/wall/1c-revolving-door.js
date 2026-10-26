// Wall, idea 1 "Revolving door", animator c (cinematic & graphic staging).
export const meta = {
  title: 'Revolving door (long exposure)',
  idea:
    'Maya hits the fin at full speed and it gives: it pivots on its middle like a secret bookcase door and carries her round. The room ' +
    'dims and the turn is shot like a long-exposure photograph: the fin\'s bright edge sweeps a disc of light and her trail draws a clean ' +
    'circle. Exactly half way, with her on the space she wanted, the picture freezes for a heartbeat and a pale ghost of her is left ' +
    'standing there; the door snaps on, sets her back nose to the fin, and locks with a click while the ghost fades.',
  notes:
    'Sound: a soft glass "unlatch" on contact, a rising airy whoosh through the turn that drops out entirely on the freeze (a held ' +
    'shimmer, like a camera shutter held open), whoosh resumes, then a small dry click as it locks. One turn per lost step: a Move 3 ' +
    'stopped after one space goes round twice (the second turn could be faster, the freeze only on the first). Porting: the fin is the ' +
    'wall group in arena.board; the light painting is a set of short-lived copies of its cap; the ghost is a clone of the robot with one ' +
    'additive material.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const M = maya.model;
  const color = new THREE.Color(maya.bot.color);
  lab.playCard('a', ['m3']);

  // ---------- the fin (the wall on the east side of (3,1)) ----------
  const C = lab.pos(3.5, 1); // its middle: the pivot
  let finG = null;
  arena.board.traverse((o) => {
    if (o.isGroup && o.children.length === 2 && Math.abs(o.position.x - C.x) < 0.05 && Math.abs(o.position.z - C.z) < 0.05) finG = o;
  });
  const rot0 = finG ? finG.rotation.y : Math.PI / 2;
  const cap = finG?.children[1];
  const capMat0 = cap?.material;
  const capMat = capMat0 ? capMat0.clone() : null;
  if (cap) cap.material = capMat;
  const capBase = capMat ? capMat.color.clone() : null;
  lab.cleanup(() => {
    if (finG) finG.rotation.y = rot0;
    if (cap) cap.material = capMat0;
  });
  const door = { th: 0, glow: 0 };
  const setDoor = () => {
    if (finG) finG.rotation.y = rot0 + door.th;
    if (capMat) capMat.color.copy(capBase).multiplyScalar(1 + door.glow * 2.2);
  };

  // ---------- the room: lights down for the exposure ----------
  const room = { dim: 0 };
  const top0 = arena.topMat.emissiveIntensity;
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const roomHook = lab.every(() => {
    arena.topMat.emissiveIntensity *= 1 - 0.55 * room.dim;
    arena.key.intensity = key0 * (1 - 0.45 * room.dim);
    arena.hemi.intensity = hemi0 * (1 - 0.45 * room.dim);
  });
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    void top0;
  });

  // ---------- the camera: a small dolly that leans with the door ----------
  const cv = { k: 0, az: 0 };
  const sx0 = arena.camCur?.sx ?? 0;
  const sy0 = arena.camCur?.sy ?? 0;
  const keepFrame = lab.every(() => {
    const c = arena.camCur;
    if (!c) return;
    const k = Math.min(0.9, arena.dt * 4);
    c.sx = sx0 / (1 - k);
    c.sy = sy0 / (1 - k);
  });
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(C, 0.35 * cv.k),
    dist: home.dist * (1 - 0.14 * cv.k),
    el: home.el - 0.05 * cv.k,
    az: cv.az,
  }));

  // ---------- her trail, laid by hand (sparser than the game's, so the whole circle fits in it) ----------
  maya.set({ trail: false });
  const trail = maya.bot.trail;
  const lay = (t) => {
    const p = maya.group.position;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.075) trail.push({ x: p.x, z: p.z, t });
  };

  // ---------- light painting: the fin's bright edge, long-exposed ----------
  const streakGeo = new THREE.BoxGeometry(0.98, 0.01, 0.012);
  const streaks = [];
  let lastStreak = -1;
  const paint = (t) => {
    if (!finG) return;
    const step = 0.035; // radians between copies
    while (lastStreak < 0 || door.th - lastStreak >= step) {
      const th = lastStreak < 0 ? door.th : lastStreak + step;
      lastStreak = th;
      const m = new THREE.Mesh(
        streakGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe4').multiplyScalar(1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.position.set(C.x, 0.262, C.z);
      m.rotation.y = rot0 + th;
      m.userData.t = t;
      lab.add(m);
      streaks.push(m);
      if (door.th - lastStreak < step) break;
    }
  };
  const fadeStreaks = (t) => {
    for (const m of streaks) {
      const age = t - m.userData.t;
      m.material.opacity = 0.2 * Math.max(0, 1 - age / 0.45) ** 1.5;
      m.visible = m.material.opacity > 0.003;
    }
  };

  // ---------- the ghost left by the freeze-frame ----------
  let ghost = null;
  const ghostMat = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.45).multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const makeGhost = () => {
    ghost = maya.group.clone(true);
    const drop = [];
    ghost.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === M.poolMat || o.material === M.ringMat) drop.push(o);
      else o.material = ghostMat;
    });
    drop.forEach((o) => o.parent.remove(o));
    // (hooks run before the puppet is posed, so place it by hand: on (4,1), nose to the fin)
    ghost.position.copy(lab.pos(4, 1));
    ghost.rotation.set(0, facing(3), 0, 'YXZ');
    ghost.scale.setScalar(1.3);
    lab.add(ghost);
  };
  const gfx = { ghost: 0 };

  // ---------- the shutter: the room's dark closes on her for the freeze-frame, like a camera iris ----------
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);
  const sh = { k: 0 };
  const drawIris = () => {
    if (sh.k <= 0.001) return void (iris.style.opacity = '0');
    const r = lab.overlay.getBoundingClientRect();
    const at = lab.toScreen(lab.pos(4, 1).setY(0.2));
    const R = r.height * (1.3 + (0.17 - 1.3) * sh.k);
    iris.style.opacity = String(Math.min(1, sh.k * 1.4));
    iris.style.background = `radial-gradient(circle at ${at.x}px ${at.y}px, rgba(0,0,0,0) ${R}px, rgba(3,4,6,.88) ${R * 1.25 + 4}px)`;
  };
  const shakeCam = lab._shakeCamera;
  lab._shakeCamera = () => {
    shakeCam();
    drawIris(); // after the camera is placed this frame
  };
  lab.cleanup(() => (lab._shakeCamera = shakeCam));
  const realTween = (dur, fn) =>
    new Promise((ok) => {
      const t0 = lab.real;
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });
  const freeze = async () => {
    lab.timeScale = 0.03; // hard freeze at full speed
    await realTween(0.09, (k) => (sh.k = ease.out(k)));
    await lab.waitReal(0.16);
    makeGhost();
    gfx.ghost = 0.55;
    lab.slowmo(1, 0.1);
    lab.tween(0.8, (e) => (gfx.ghost = 0.55 * (1 - e)), ease.out);
    await realTween(0.14, (k) => (sh.k = 1 - ease.inOut(k)));
  };

  // where the door puts her: on a circle round the pivot, nose to the fin
  const onDoor = (th, extra = {}) =>
    maya.set({ x: 3.5 - 0.5 * Math.cos(th), y: 1 + 0.5 * Math.sin(th), rot: facing(1) + th, ...extra });

  const lightHook = lab.every((dt, t) => {
    setDoor();
    paint(t);
    fadeStreaks(t);
  });
  void lightHook;
  maya.each = (m, t) => {
    lay(t);
    ghostMat.opacity = gfx.ghost;
    if (ghost) ghost.visible = gfx.ghost > 0.003;
    m.eyeMat.color.setRGB(3.2 * (1 + room.dim * 0.3), 3.1 * (1 + room.dim * 0.3), 2.9 * (1 + room.dim * 0.3));
  };

  // ---------- 1. Move 3 at full speed, cut off by the fin ----------
  const E = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const tHit = 0.592;
  await lab.tween(0.9 * tHit, (e, k) => maya.set({ x: 1 + 3 * E(k * tHit), pitch: 0.12 * k }), ease.linear);

  // ---------- 2. she presses; the fin gives (a hair the wrong way first) ----------
  await lab.tween(
    0.12,
    (e, k) => {
      onDoor(-0.07 * Math.sin(k * Math.PI), { pitch: 0.12 + 0.06 * Math.sin(k * Math.PI), sx: 1 - 0.05 * Math.sin(k * Math.PI) });
      door.th = -0.07 * Math.sin(k * Math.PI);
      door.glow = Math.sin(k * Math.PI) * 0.8;
    },
    ease.linear,
  );
  lastStreak = -1;

  // ---------- 3. round she goes: lights down, the camera leans in ----------
  const T = 0.9; // one full turn, in scene seconds
  const spinE = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2); // slow off, fast through the middle, slow in
  let frozen = false;
  await lab.tween(
    T,
    (e, k) => {
      const th = Math.PI * 2 * spinE(k);
      door.th = th;
      door.glow = 0.4;
      onDoor(th, { pitch: 0.06 * (1 - k), sx: 1 });
      room.dim = Math.min(1, k * 4) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      cv.k = Math.sin(Math.min(1, k * 1.1) * Math.PI * 0.5) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.5 : 1);
      if (!frozen && th >= Math.PI) {
        // half way: she is on (4,1), the space she wanted. Freeze, and leave a ghost there.
        frozen = true;
        onDoor(Math.PI, { pitch: 0.06 * (1 - k) });
        freeze();
      }
    },
    ease.linear,
  );

  // ---------- 4. click: a hair past, and back, locked ----------
  room.dim = 0;
  await lab.tween(
    0.14,
    (e, k) => {
      const th = Math.PI * 2 + 0.05 * Math.sin(k * Math.PI);
      door.th = th;
      door.glow = 1.2 * (1 - k);
      onDoor(th, { pitch: -0.05 * Math.sin(k * Math.PI) });
    },
    ease.linear,
  );
  door.th = 0;
  door.glow = 0;
  onDoor(0, { pitch: 0 });

  // ---------- 5. settle; camera home ----------
  const ck = cv.k;
  const caz = cv.az;
  await lab.tween(
    0.32,
    (e) => {
      cv.k = ck * (1 - e);
      cv.az = caz * (1 - e);
    },
    ease.inOut,
  );
  gfx.ghost = 0;
  cv.k = 0;
  cv.az = 0;
  releaseCam();
  keepFrame();
  roomHook();
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  setDoor();
  maya.each = null;
  lab._shakeCamera = shakeCam;
  iris.remove();
  maya.release({ x: 3, y: 1, d: 1 });
}
