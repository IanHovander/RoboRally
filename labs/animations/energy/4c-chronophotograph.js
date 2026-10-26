// Energy, idea 4 (The bolt hops), animator c: cinematic & graphic staging.
export const meta = {
  title: 'Chronophotograph',
  idea:
    'The hop, shot like a Marey chronophotograph. As Maya settles, the battery\'s bolt squeezes out from under her toward us, the camera eases in on it, and it stands up on the glass, shakes itself off and crouches. Then it hops onto her back and the hop is printed in the air as a stroboscopic multiple exposure: a fan of fading bolts tracing the arc, hanging at the top like a slow-motion replay. It dives in, her eye and ring flush amber, and a fresh bolt fades back into the glass as the arcs brighten.',
  notes:
    'Sound: a squeak of glass as it squeezes out, a tiny tinkle for the shake, a rising glass glissando through the hop (each strobe ghost a soft tick), a warm "plip" as it dives in. The strobe ghosts are copies of the bolt frozen at even steps along the arc; they fade in about half a second. The camera push is modest (20%) because this moment comes round often. Variation: the shake could become a stretch, or a look at the camera, now and then.',
};

const BAT = { x: 3, y: 1 };
const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (k) => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI);
const BOLT = 'M22.5 6 L12.5 22 H19.5 L17.5 34 L27.5 17.5 H20.5 Z';

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


function boltTexture(lab) {
  const { THREE } = lab;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.shadowColor = '#fff';
  g.shadowBlur = 22;
  g.fillStyle = '#fff';
  const size = 256 * 0.86;
  g.translate(128 - size / 2, 128 - size / 2);
  g.scale(size / 40, size / 40);
  g.fill(new Path2D(BOLT));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, PALETTE, ease, facing, arena } = lab;
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  const bat = batteryRig(lab);
  const at = bat.at;
  const EL = arena.camHome?.elev ?? 0.87;

  // the living bolt: a pivot at its feet on the glass, the glyph inside it
  const tex = boltTexture(lab);
  const SIZE = 0.7; // a little bigger than the painted bolt's box (a third of a space): it stands half her height
  const geo = new THREE.PlaneGeometry(SIZE, SIZE).translate(0, SIZE / 2 - SIZE * 0.08, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(PALETTE.energy), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pivot = new THREE.Group();
  const spin = new THREE.Group(); // its own wiggle, about the glyph's centre line
  const squash = new THREE.Group();
  const glyph = new THREE.Mesh(geo, mat);
  glyph.renderOrder = 6;
  squash.add(glyph);
  spin.add(squash);
  pivot.add(spin);
  lab.add(pivot);
  pivot.rotation.order = 'YXZ';
  const ghosts = [];

  // the camera: eases in on the bolt and follows it, then home
  const cam = { k: 0, push: 0, focus: at.clone() };
  const releaseCam = lab.camera((home) => ({ target: home.target.clone().lerp(cam.focus, cam.k), dist: home.dist * (1 - cam.push) }));

  // her lights
  const WHITE = new THREE.Color(3.2, 3.1, 2.9);
  const AMBER = new THREE.Color(PALETTE.energy).multiplyScalar(4.2);
  const ring0 = maya.model.ringMat.color.clone();
  const RING = new THREE.Color(PALETTE.energy).multiplyScalar(2.3);
  const look = { warm: 0, card: 1 };
  maya.each = (m) => {
    m.eyeMat.color.copy(WHITE).lerp(AMBER, look.warm);
    m.ringMat.color.copy(ring0).lerp(RING, look.warm * 0.85);
    const card = maya.bot.card;
    if (card) card.material.opacity = Math.min(card.material.opacity, look.card);
  };
  const restore = () => maya.model.ringMat.color.copy(ring0);
  lab.cleanup(restore);

  // ---- the beats ----
  const MOVE = 0.58;
  const OUT = 0.6; // the bolt squeezes out from under her, toward us
  const STAND = 0.8; // it stands up
  const SHAKE = 0.94; // shakes itself off
  const CROUCH = 1.12; // crouches
  const HOP = 1.24; // hops (the apex hangs, like a replay)
  const DIVE = 1.72; // dives into her back
  const END = 2.28;
  const FRONT = at.clone().add(new THREE.Vector3(0.5, 0, 0.66)); // the edge of her ring, on our side
  const BACK = at.clone().add(new THREE.Vector3(-0.1, 0.3, -0.04)); // her back

  lab.playCard('a', ['m2']);
  let lastGhost = -1;
  const t0 = lab.t;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    const pose = { x: 1 + 2 * ease.inOut(seg(T, 0, MOVE)), pitch: bump(seg(T, MOVE - 0.04, MOVE + 0.2)) * 0.1, sy: 1, sx: 1, sz: 1, lift: 0 };

    // ---- the battery: its painted bolt is ours now; a fresh one fades back in after ----
    bat.boltLevel = T < OUT ? 1 : 1.4 * ease.inOut(seg(T, DIVE + 0.1, DIVE + 0.45));
    const arcs = 1 + 1.3 * bump(seg(T, DIVE + 0.1, END - 0.05));
    bat.level = [arcs, arcs, arcs];
    bat.glow = arcs;

    // ---- the bolt ----
    let pos = at.clone();
    let tilt = -Math.PI / 2; // lying in the glass
    let sx = 1;
    let sy = 1;
    let wig = 0;
    let lit = 1;
    if (T >= OUT) {
      // squeezing out: it slides toward us, pinched thin, then pops back to width
      const k = ease.inOut(seg(T, OUT, STAND));
      pos = at.clone().lerp(FRONT, k);
      const pinch = bump(seg(T, OUT, STAND + 0.04));
      sx = 1 - 0.55 * pinch + 0.18 * bump(seg(T, STAND - 0.04, STAND + 0.08));
      sy = 1 + 0.45 * pinch;
      lit = 1 + 2 * seg(T, OUT, STAND);
    }
    if (T >= STAND) {
      // stands up (facing us), with a little overshoot
      tilt = mix(-Math.PI / 2, -EL * 0.7, ease.outBack(seg(T, STAND, STAND + 0.14), 2.2));
      pos = FRONT.clone();
    }
    if (T >= SHAKE && T < CROUCH) {
      const k = seg(T, SHAKE, CROUCH);
      wig = Math.sin(k * Math.PI * 6) * 0.42 * (1 - k * 0.6);
      sy *= 1 + 0.06 * Math.sin(k * Math.PI * 12);
    }
    if (T >= CROUCH && T < HOP) {
      const k = ease.out(seg(T, CROUCH, HOP));
      sy *= 1 - 0.36 * k;
      sx *= 1 + 0.22 * k;
    }
    let hop = 0;
    if (T >= HOP) {
      // the arc hangs at its top: time runs slow through the middle of the hop
      const k = seg(T, HOP, DIVE);
      const u = k < 0.5 ? 0.5 * (2 * k) ** 0.55 : 1 - 0.5 * (2 - 2 * k) ** 0.55;
      hop = u;
      pos = FRONT.clone().lerp(BACK, u);
      pos.y = mix(0, BACK.y, u) + Math.sin(u * Math.PI) * 0.85;
      const launch = 1 - seg(T, HOP, HOP + 0.08);
      sy = mix(1.3, 1, 1 - launch) * (1 + 0.15 * Math.sin(u * Math.PI));
      sx = 1 - 0.15 * Math.sin(u * Math.PI);
      tilt = -EL * 0.7 + mix(0, 0.9, ease.in(u)); // nose over into the dive
      wig = -0.25 * Math.sin(u * Math.PI);
      lit = 2.7;
      // the multiple exposure: a frozen copy at even steps along the arc
      const n = Math.floor(u * 8);
      if (n !== lastGhost && n >= 1 && n <= 7) {
        lastGhost = n;
        glyph.updateWorldMatrix(true, false);
        const g = new THREE.Mesh(geo, mat.clone());
        g.renderOrder = 5;
        g.matrixAutoUpdate = false;
        g.matrix.copy(glyph.matrixWorld);
        g.userData.born = T;
        lab.add(g);
        ghosts.push(g);
      }
    }
    if (T >= DIVE) {
      // dives in: it shrinks into her back
      const k = seg(T, DIVE, DIVE + 0.08);
      sx *= 1 - k;
      sy *= 1 - 0.7 * k;
      pos = BACK.clone().add(new THREE.Vector3(0, -0.12 * k, 0));
    }
    pivot.position.copy(pos);
    pivot.position.y += 0.006;
    pivot.rotation.set(tilt, 0, 0);
    spin.rotation.z = wig;
    squash.scale.set(sx, sy, 1);
    glyph.visible = T >= OUT && sx > 0.02;
    mat.depthTest = T < STAND; // under her while it squeezes out; after that it's in front of her or on her back
    mat.color.set(PALETTE.energy).multiplyScalar(lit);
    for (const g of ghosts) {
      const age = T - g.userData.born;
      g.material.color.set(PALETTE.energy).multiplyScalar(1.3 * Math.max(0, 1 - age / 0.55) ** 1.3);
      g.visible = age < 0.55;
    }

    // ---- Maya: she settles onto it, then a happy shiver as it dives in ----
    if (T >= OUT && T < STAND) pose.lift = 0.03 * bump(seg(T, OUT, STAND)); // it squeezes out from under her
    if (T >= DIVE) {
      const k = seg(T, DIVE, DIVE + 0.4);
      pose.sy = 1 - 0.14 * Math.sin(k * Math.PI * 2.5) * (1 - k);
      pose.sx = pose.sz = 1 + 0.07 * Math.sin(k * Math.PI * 2.5) * (1 - k);
      pose.roll = 0.05 * Math.sin(k * Math.PI * 5) * (1 - k);
    }
    // she glances down at it as it stands and shakes, and up as it hops
    pose.pitch += 0.16 * ease.inOut(seg(T, STAND, SHAKE)) * (1 - ease.inOut(seg(T, HOP, HOP + 0.2)));
    maya.set(pose);
    // the card above her steps back while the hop is printed in the air
    look.card = 1 - 0.85 * ease.inOut(seg(T, CROUCH, HOP + 0.1)) * (1 - ease.inOut(seg(T, DIVE + 0.1, END - 0.04)));
    look.warm = ease.out(seg(T, DIVE + 0.02, DIVE + 0.12)) * (1 - ease.inOut(seg(T, DIVE + 0.3, END - 0.02)));

    // ---- the camera ----
    const inK = ease.inOut(seg(T, OUT + 0.05, STAND + 0.12));
    const outK = ease.inOut(seg(T, DIVE + 0.06, END - 0.04));
    cam.k = 0.55 * inK * (1 - outK);
    cam.push = 0.2 * inK * (1 - outK);
    cam.focus.copy(at.clone().lerp(FRONT, 0.5 * (1 - hop)).setY(0.2 + 0.15 * hop));
  });
  lab.cleanup(stop);
  lab.at(DIVE + 0.04, () => {
    lab.ring(at, PALETTE.energy, 0.42, 0.02, 0.45);
    lab.particles(BACK.clone().setY(0.42), [PALETTE.energy, '#fff4dc'], 10, { speed: 0.5, up: 0.9, gravity: 2, size: 0.035, dur: 0.45 });
  });
  lab.at(SHAKE + 0.04, () => lab.particles(FRONT.clone().setY(0.14), [PALETTE.energy], 6, { speed: 0.7, up: 0.5, gravity: 3, size: 0.03, dur: 0.35 }));

  await lab.wait(END);
  stop();
  restore();
  releaseCam();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
