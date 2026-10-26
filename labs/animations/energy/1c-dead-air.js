// Energy, idea 1 (Vending machine), animator c: cinematic & graphic staging.
export const meta = {
  title: 'Dead air',
  idea:
    'Told like a sitcom beat. Maya parks on the battery and the camera snap-zooms onto her for a third of a second of dead air while the room\'s darkness creeps in like a spotlight on an awkward silence. She peers down, rises and thumps: the glass jolts, the arcs stutter like a stuck machine, then the battery coughs a gulp of amber up into her (it draws a light-painted arc in the air), the camera snaps back out and the room exhales.',
  notes:
    'Sound: a held silence (the room hum drops out), a soft glass thunk on the thump, three ticking chimes for the stutter, a low "clunk" chime and a warm rising tone as her eye goes amber. Variation: about one charge in five (lab.rand() < 0.2) it pays out the instant she starts to rise: a freeze-frame catches her hanging mid-lift with a ghost of herself, then she sinks back down sheepishly. The darkness is a radial vignette on the overlay layer (the HUD layer in the game); the battery is redrawn as meshes over a patch of plain glass so its arcs can stutter.',
};

const BAT = { x: 3, y: 1 };

// ---------- small rigs shared by this file ----------

/** The battery redrawn by us: a patch of plain glass over the painted one, our own arcs and bolt on top. */
function batteryRig(lab) {
  const { THREE, arena, PALETTE } = lab;
  const at = lab.pos(BAT.x, BAT.y);
  const c = arena.course;
  const geo = new THREE.CircleGeometry(0.47, 48).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  const ps = geo.attributes.position;
  for (let i = 0; i < ps.count; i++) uv.setXY(i, (at.x + ps.getX(i) + c.w / 2) / c.w, 1 - (at.z + ps.getZ(i) + c.h / 2) / c.h);
  const coverMat = arena.topMat.clone();
  coverMat.emissiveMap = null;
  coverMat.emissive.setRGB(0.002, 0.0022, 0.0026);
  const cover = new THREE.Mesh(geo, coverMat);
  cover.position.set(at.x, 0.0015, at.z);
  cover.receiveShadow = true;
  lab.add(cover);
  const paint = (fn) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.shadowColor = '#fff';
    g.shadowBlur = 30;
    g.strokeStyle = g.fillStyle = '#fff';
    fn(g);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const flat = (map, y) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map, color: new THREE.Color(PALETTE.energy), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.set(at.x, y, at.z);
    lab.add(m);
    return m;
  };
  const arcs = [0, 1, 2].map((i) =>
    flat(
      paint((g) => {
        g.lineWidth = 7.2;
        g.beginPath();
        g.arc(128, 128, 76.8, (i / 3) * Math.PI * 2 + 0.25, ((i + 1) / 3) * Math.PI * 2 - 0.25);
        g.stroke();
      }),
      0.005,
    ),
  );
  const bolt = flat(
    paint((g) => {
      const size = 87;
      g.translate(128 - size / 2, 128 - size / 2);
      g.scale(size / 40, size / 40);
      g.fill(new Path2D('M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z'));
    }),
    0.0052,
  );
  const rig = {
    at,
    arcs,
    bolt,
    level: [1, 1, 1], // each arc's brightness (1 = as the game draws it)
    boltLevel: 1,
    glow: 1, // the soft glow under the battery (1 = the game's breathing)
    scale: 1,
    freeze: null, // hold the glow's breathing at this time
  };
  const stop = lab.every((dt, t) => {
    arcs.forEach((m, i) => {
      m.material.color.set(PALETTE.energy).multiplyScalar(rig.level[i]);
      m.scale.setScalar(rig.scale);
    });
    bolt.material.color.set(PALETTE.energy).multiplyScalar(rig.boltLevel);
    const tt = rig.freeze ?? t;
    arena.batteryMat.color.set(PALETTE.energy).multiplyScalar((0.22 + Math.sin(tt * 2.2) * 0.1) * rig.glow);
  });
  lab.cleanup(stop);
  return rig;
}

/** The camera, as offsets from home that tweens can animate; ends exactly home. */
function cameraRig(lab, focus) {
  const s = { k: 0, push: 0, el: 0, roll: 0 };
  const release = lab.camera((home) => ({
    target: home.target.clone().lerp(focus, s.k),
    dist: home.dist * (1 - s.push),
    el: home.el + s.el,
    roll: s.roll,
  }));
  return { s, release };
}

/** The room's darkness as an iris around a point (a vignette on the overlay). */
function irisRig(lab) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  lab.overlay.append(el);
  const s = { a: 0, r: 0.5, at: null };
  const stop = lab.every(() => {
    if (s.a <= 0.002 || !s.at) {
      el.style.background = 'none';
      return;
    }
    const H = lab.overlay.clientHeight || 540;
    const p = lab.toScreen(s.at);
    const r0 = H * s.r * 0.35;
    const r1 = H * s.r * 1.25;
    el.style.background = `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(2,3,5,0) ${r0}px, rgba(2,3,5,${(s.a * 0.55).toFixed(3)}) ${(r0 + r1) / 2}px, rgba(2,3,5,${s.a.toFixed(3)}) ${r1}px)`;
  });
  lab.cleanup(stop);
  return s;
}

/** A soft round sprite of light. */
function orb(lab, color, size, k = 3) {
  const { THREE } = lab;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.75)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(size);
  lab.add(sp);
  return sp;
}

/** A light-painted stroke along points: reveal(k) draws it on, fade(a) sets its strength. */
function stroke(lab, pts, color, radius = 0.014, k = 2.6) {
  const { THREE } = lab;
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = 64;
  const radial = 6;
  const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  lab.add(m);
  geo.setDrawRange(0, 0);
  return {
    curve,
    mesh: m,
    reveal(f, from = 0) {
      const a = Math.floor(Math.max(0, Math.min(1, from)) * seg);
      const b = Math.ceil(Math.max(0, Math.min(1, f)) * seg);
      geo.setDrawRange(a * radial * 6, Math.max(0, b - a) * radial * 6);
    },
    fade(a) {
      mat.opacity = a;
    },
  };
}


const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (k) => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI);

/** Her lights: the eye, the ring and the pool can warm toward amber (restored when she's handed back). */
function warmRig(lab, p) {
  const { THREE, PALETTE } = lab;
  const m = p.model;
  const ring0 = m.ringMat.color.clone();
  const pool0 = m.poolMat.color.clone();
  const WHITE = new THREE.Color(3.2, 3.1, 2.9);
  const AMBER = new THREE.Color(PALETTE.energy).multiplyScalar(4.2);
  const RING = new THREE.Color(PALETTE.energy).multiplyScalar(2.2);
  const POOL = new THREE.Color(PALETTE.energy).multiplyScalar(1.1);
  const s = { eye: 0, ring: 0, card: 1 };
  p.each = () => {
    m.eyeMat.color.copy(WHITE).lerp(AMBER, s.eye);
    m.ringMat.color.copy(ring0).lerp(RING, s.ring);
    m.poolMat.color.copy(pool0).lerp(POOL, s.ring * 0.8);
    const card = p.bot.card;
    if (card) card.material.opacity = Math.min(card.material.opacity, s.card);
  };
  const restore = () => {
    m.ringMat.color.copy(ring0);
    m.poolMat.color.copy(pool0);
  };
  lab.cleanup(restore);
  return { s, restore };
}

// ---------- the moment ----------

export default async function play(lab) {
  const { THREE, PALETTE, ease, facing } = lab;
  const early = lab.rand() < 0.2; // now and then it pays out the instant she starts to rise
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  const bat = batteryRig(lab);
  const at = bat.at;
  const cam = cameraRig(lab, at.clone().setY(0.25));
  const iris = irisRig(lab);
  iris.at = at.clone().setY(0.2);
  const warm = warmRig(lab, maya);
  const top = lab.arena.topMat;
  const top0 = top.emissiveIntensity;
  lab.cleanup(() => (top.emissiveIntensity = top0));

  // ---- the beats (scene seconds from the start of the move) ----
  const MOVE = 0.58; // Move 2: drive on and stop
  const HUSH = 0.62; // dead air: snap-zoom in, the darkness creeps in, the battery stops breathing
  const PEER = 0.9; // she peers down at it
  const RISE = 1.08; // she rises a hair...
  const HIT = early ? null : 1.24; // ...and thumps down
  const PAY = early ? 1.15 : 1.58; // the battery coughs
  const GOT = PAY + 0.2; // the gulp reaches her
  const END = early ? 2.32 : 2.36;

  lab.playCard('a', ['m2']);
  let flick = null;
  let ghost = null;
  let path = null;
  let gulp = null;
  const t0 = lab.t;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    // ---- Maya ----
    const pose = { x: 1 + 2 * ease.inOut(seg(T, 0, MOVE)), lift: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1 };
    pose.pitch += bump(seg(T, MOVE - 0.04, MOVE + 0.2)) * 0.12; // the braking nod
    const peer = ease.out(seg(T, PEER, PEER + 0.12));
    pose.pitch += 0.34 * peer;
    if (!early) {
      const up = ease.out(seg(T, RISE, HIT - 0.05));
      const down = ease.in3(seg(T, HIT - 0.05, HIT));
      const h = 0.17 * up * (1 - down);
      pose.lift = h;
      pose.pitch += (-0.44 * up) * (1 - down) - 0.34 * peer * down;
      const st = 0.07 * up * (1 - down);
      pose.sy += st;
      pose.sx -= st * 0.4;
      pose.sz -= st * 0.4;
      if (T >= HIT) {
        // flat for a frame, then a springy wobble back
        const k = seg(T, HIT, HIT + 0.32);
        const w = T < HIT + 1 / 30 ? 1 : Math.cos(k * 14) * (1 - k) ** 2;
        pose.sy = 1 - 0.4 * w;
        pose.sx = pose.sz = 1 + 0.24 * w;
      }
      // swallowing the gulp: a little clunk
      const cl = bump(seg(T, GOT, GOT + 0.26)) * 0.13;
      pose.sy -= cl;
      pose.sx += cl * 0.45;
      pose.sz += cl * 0.45;
    } else {
      // the variant: caught hanging mid-lift (freeze-frame), then a sheepish sink
      const up = ease.out(seg(T, RISE, PAY));
      const sink = ease.inOut(seg(T, PAY + 0.36, PAY + 0.74));
      pose.lift = 0.07 * up * (1 - sink);
      pose.pitch = 0.34 * (1 - up) + 0.04 * up * (1 - sink);
      pose.roll = Math.sin(seg(T, PAY + 0.36, PAY + 0.9) * 9) * 0.05 * (1 - seg(T, PAY + 0.36, PAY + 0.9));
    }
    maya.set(pose);

    // ---- the camera and the room ----
    const snapIn = ease.out3(seg(T, HUSH, HUSH + 0.09));
    const snapOut = ease.out3(seg(T, GOT, GOT + 0.12));
    const home = ease.inOut(seg(T, GOT + 0.12, END - 0.06));
    const c = snapIn * (1 - 0.75 * snapOut) * (1 - home);
    cam.s.push = 0.17 * c;
    cam.s.k = 0.45 * c;
    iris.a = 0.62 * ease.out(seg(T, HUSH, HUSH + 0.34)) * (1 - ease.out(seg(T, GOT, GOT + 0.14)));
    iris.r = mix(0.9, 0.5, ease.out(seg(T, HUSH, HUSH + 0.34)));
    warm.s.card = 1 - 0.75 * seg(T, HUSH, HUSH + 0.3) * (1 - seg(T, END - 0.3, END - 0.04));
    if (HIT) top.emissiveIntensity = top0 + 0.9 * (T >= HIT ? (1 - seg(T, HIT, HIT + 0.18)) ** 2 : 0);

    // ---- the battery ----
    bat.freeze = T >= HUSH && T < GOT ? t0 + HUSH : null;
    if (!early && T >= HIT + 1 / 30 && T < PAY) {
      // stutter like a stuck machine, swollen past her so the room can see it
      const pattern = [1, 0, 1, 1, 0, 0, 1, 0, 1];
      const f = pattern[Math.min(pattern.length - 1, Math.floor((T - HIT - 1 / 30) * 30))];
      bat.scale = 1.5;
      bat.level = [f * 3.8, f * 3.4, f * 4];
      bat.boltLevel = f * 0.6;
      bat.glow = f ? 2.2 : 0.15;
    } else if (T >= PAY) {
      // it sucks in to give, goes dark, then its usual light comes back
      const suck = ease.in(seg(T, PAY, PAY + 0.08));
      const back = ease.inOut(seg(T, GOT, GOT + 0.4));
      const from = early ? 1 : 3;
      bat.scale = mix(early ? 1 : 1.5, 0.4, suck) * (1 - back) + back;
      const lv = from * (1 - suck) * (1 - back) + back;
      bat.level = [lv, lv, lv];
      bat.boltLevel = (early ? 1 : 1.6) * (1 - suck) * (1 - back) + back;
      bat.glow = (early ? 1 : 2.2) * (1 - suck) * (1 - back) + back;
    } else {
      bat.scale = 1;
      bat.level = [1, 1, 1];
      bat.boltLevel = bat.glow = 1;
    }

    // ---- the gulp, and the light it paints in the air ----
    if (path) {
      const g = ease.inOut(seg(T, PAY, GOT));
      // after it lands, the painted stroke runs out like a comet's tail
      path.reveal(g, ease.out(seg(T, GOT - 0.04, GOT + 0.3)));
      path.fade(1 - ease.in(seg(T, GOT, GOT + 0.32)));
      gulp.visible = T < GOT;
      gulp.position.copy(path.curve.getPoint(g));
      gulp.scale.setScalar(0.16 + bump(seg(T, PAY, GOT)) * 0.2);
    }
    warm.s.eye = ease.out(seg(T, GOT, GOT + 0.1)) * (1 - ease.inOut(seg(T, GOT + 0.22, END - 0.02)));
    warm.s.ring = 0.85 * ease.out(seg(T, GOT, GOT + 0.1)) * (1 - ease.inOut(seg(T, GOT + 0.16, END - 0.08)));
    if (ghost) {
      const a = 0.38 * (1 - seg(T, PAY + 0.36, PAY + 0.7));
      ghost.traverse((o) => o.isMesh && (o.material.opacity = a));
      ghost.visible = a > 0.005;
    }
  });
  lab.cleanup(stop);

  // ---- one-off moments ----
  if (HIT) {
    lab.at(HIT, () => {
      lab.shake(0.045, 0.2);
      lab.ring(at, '#f4efe4', 0.42, 0.02, 0.22);
    });
  }
  lab.at(PAY, () => {
    const lift = early ? 0.07 : 0;
    const from = new THREE.Vector3(at.x + 0.36, 0.03, at.z + 0.06);
    const peak = new THREE.Vector3(at.x + 0.46, 0.8 + lift, at.z + 0.04);
    const into = new THREE.Vector3(at.x + 0.12, 0.34 + lift, at.z);
    path = stroke(lab, [from, peak, into], PALETTE.energy, 0.014, 2.6);
    lab.particles(from, [PALETTE.energy, '#fff4dc'], 8, { speed: 0.7, up: 1.1, gravity: 4, size: 0.04, dur: 0.4 });
    gulp = orb(lab, PALETTE.energy, 0.2, 3.4);
    gulp.position.copy(from);
    if (early) {
      // freeze-frame: a ghost of her hangs where she was caught
      ghost = new THREE.Group();
      const q = maya.pose; // (the group itself still sits where the game placed it until the pose is applied)
      ghost.position.copy(lab.pos(q.x, q.y)).setY(q.lift);
      ghost.rotation.order = 'YXZ';
      ghost.rotation.set(-q.pitch, q.rot, -q.roll);
      ghost.scale.setScalar(1.3 * 1.04);
      ghost.add(maya.model.body.clone(true));
      ghost.traverse((o) => {
        if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4d6d').multiplyScalar(0.7), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
      });
      lab.add(ghost);
    }
  });
  lab.at(GOT, () => lab.ring(at, PALETTE.energy, 0.42, 0.02, 0.45));

  await lab.wait(END);
  stop();
  warm.restore();
  cam.release();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
