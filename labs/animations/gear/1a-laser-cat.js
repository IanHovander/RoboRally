// Gear, idea 1 (laser-pointer cat), animator a: weight & physical comedy.
export const meta = {
  title: 'Laser-pointer cat',
  idea:
    "The gear's light squirts out from under Maya as a bright mint dot and zips round her ring to sit right under her nose. She jumps like a startled cat, then stalks it: her nose snaps after it in jerky, overshooting turns, a feint fools her, she freezes, crouches, wiggles her rear and pounces with a hop, slamming down on the dot facing east. It splats into a puddle of mint light that soaks into her pointer.",
  notes:
    'Weight: every snap of her head overshoots and has to be caught (she has inertia, the dot has none); the pounce has a stretch on take-off and a big squash on landing that the glass answers with a ring and a few drops of light. Sounds: a dry glass tick per dash of the dot, a soft "mrrp" chime on the startle, a glassy thud and splash on the landing. Feints are seeded (lab.rand), and the dot always dies exactly at her new front. Red gears: the dot runs anticlockwise and the dot is the left-turn colour.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,.6)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a ring of light on the glass that spreads and fades (lab.ring shows its first frame at full size, so a local one)
function ringFx(lab, at, color, from, to, dur, k = 1.8) {
  const { THREE } = lab;
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at);
  m.scale.setScalar(from);
  lab.add(m);
  const t0 = lab.t;
  const stop = lab.every(() => {
    const e = Math.min(1, (lab.t - t0) / dur);
    m.scale.setScalar(from + (to - from) * (1 - (1 - e) ** 2));
    m.material.opacity = (1 - e) ** 1.5;
    if (e >= 1) {
      m.visible = false;
      stop();
    }
  });
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.bots.a;
  const after = sc.after.a;
  const gear = lab.arena.gears.get(`${A.x},${A.y}`);
  const spin = gear?.spin ?? 1; // 1 = right (clockwise), -1 = left
  const rot0 = facing(A.d);
  const rot1 = facing(after.d);
  const C = lab.pos(A.x, A.y);
  const mint = spin > 0 ? lab.PALETTE.right : lab.PALETTE.left;
  const maya = lab.puppet('a');
  maya.set({ trail: false });
  const red = new THREE.Color(lab.bot('a').color);

  // world point at heading h (same convention as rot), radius r from her centre
  const at = (h, r, y = 0) => new THREE.Vector3(C.x - Math.sin(h) * r, y, C.z - Math.cos(h) * r);

  // ----- the dot: a bright core, a halo, a pool on the glass, and a short streak behind it -----
  const tex = glowTex(THREE);
  const hot = (k) => new THREE.Color(mint).multiplyScalar(k);
  const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const dot = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3.5) }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: hot(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.5);
  dot.add(core, halo);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), additive(hot(1.4), 0.9));
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 4;
  lab.add(dot);
  lab.add(pool);
  const streak = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: hot(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lab.add(s);
    streak.push(s);
  }
  const hist = [];
  dot.visible = pool.visible = false;

  // ----- the choreography of the dot (angles in quarter turns from her old heading, clockwise for a right gear) -----
  // a list of keys: [time, angle (deg, in the gear's direction from her old front), radius, ease]
  const keys = [];
  const key = (t, a, r = 0.7, e = ease.out3) => keys.push({ t, a, r, e });
  // squirts out from under her, toward us, then zips round the far side to sit under her nose
  key(0.0, 180 * spin, 0.25);
  key(0.12, 180 * spin, 0.74, ease.out);
  key(0.32, 360 * spin, 0.84, ease.inOut);
  // the stalk, with seeded feints
  let t = 0.54;
  const r1 = lab.rand();
  const r2 = lab.rand();
  const r3 = lab.rand();
  const first = 18 + r1 * 14; // first dash
  key(t, 360 * spin, 0.84);
  t += 0.06;
  key(t, (360 + first) * spin, 0.84);
  t += 0.08 + r2 * 0.05;
  key(t, (360 + first) * spin, 0.84);
  if (r3 < 0.5) {
    // a flick back: she falls for it
    t += 0.05;
    key(t, (360 + first - 9) * spin, 0.84);
    t += 0.09;
    key(t, (360 + first - 9) * spin, 0.84);
  } else {
    // a false start: a twitch forward and straight back
    t += 0.04;
    key(t, (360 + first + 6) * spin, 0.84);
    t += 0.05;
    key(t, (360 + first) * spin, 0.84);
    t += 0.06;
    key(t, (360 + first) * spin, 0.84);
  }
  t += 0.07;
  key(t, (360 + 58 + r1 * 8) * spin, 0.76);
  t += 0.05 + r2 * 0.03;
  key(t, (360 + 58 + r1 * 8) * spin, 0.76);
  t += 0.08;
  key(t, (360 + 90) * spin, 0.72);
  const tStop = t; // the dot sits at her new front from here
  const tCrouch = tStop + 0.1;
  const tPounce = tCrouch + 0.27;
  const tLand = tPounce + 0.19;
  const tEnd = tLand + 0.16;
  key(tPounce, 450 * spin, 0.62, ease.inOut); // it shrinks in toward her pointer while she winds up

  const dotAt = (tt) => {
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= tt) i++;
    const a = keys[i];
    const b = keys[Math.min(keys.length - 1, i + 1)];
    if (b === a || tt <= a.t) return { a: a.a, r: a.r };
    const k = b.e(seg(tt, a.t, b.t));
    return { a: a.a + (b.a - a.a) * k, r: a.r + (b.r - a.r) * k };
  };
  const degToH = (deg) => rot0 - (deg * Math.PI) / 180; // clockwise from north is negative rot

  // ----- Maya: a heavy head that chases the dot with a spring (overshoots), then exact keys for the pounce -----
  let head = rot0;
  let vel = 0;
  const startle = 0.34;
  const tag = lab.bot('a').tag;
  const tagWorld = new THREE.Vector3(C.x, 0.86 * 1.3, C.z);
  const tagScale0 = tag ? tag.scale.clone() : null;
  // the gear: its arrow's light leaves with the dot, and relights (with its quarter turn) when she lands
  const gearFrom = gear ? gear.extra : 0;
  let gearScale = 1;
  const stopGear = lab.every(() => {
    if (gear) gear.mesh.material.color.multiplyScalar(gearScale);
  });
  const t0 = lab.t;
  let splashed = false;
  let last = 0;

  await new Promise((done) => {
    const stop = lab.every(() => {
      const tt = lab.t - t0;
      const dt = Math.min(0.05, tt - last);
      last = tt;

      // the dot
      const d = dotAt(tt);
      const h = degToH(d.a);
      const hop = Math.sin(Math.PI * seg(tt, 0.0, 0.14)) * 0.12; // it pops out with a little bounce
      const quiver = tt > tStop && tt < tLand ? Math.sin(tt * 90) * 0.012 : 0;
      const p = at(h + quiver, d.r, 0.03 + hop);
      const alive = tt < tLand;
      gearScale = alive ? 1 - 0.6 * seg(tt, 0, 0.1) : 1;
      dot.visible = pool.visible = alive;
      dot.position.copy(p);
      pool.position.set(p.x, 0.012, p.z);
      const born = seg(tt, 0, 0.08);
      const flick = 1 + 0.25 * Math.sin(tt * 55);
      halo.scale.setScalar(0.5 * born * flick);
      core.scale.setScalar(born);
      pool.scale.setScalar(0.6 + 0.4 * born);
      // streak: where it was the last few frames
      hist.unshift(p.clone());
      if (hist.length > streak.length) hist.pop();
      streak.forEach((s, i) => {
        const q = hist[i];
        s.visible = alive && !!q;
        if (!q) return;
        s.position.copy(q);
        s.material.opacity = 0.55 * (1 - i / streak.length);
        s.scale.setScalar(0.2 * (1 - i / streak.length));
      });

      // Maya's head: aims at the dot (with a reaction lag) once she has noticed it
      const seen = tt >= startle;
      const lagged = dotAt(Math.max(0, tt - 0.05));
      // (the dot has already been round her once: she only chases where it is now, she doesn't unwind)
      const want = seen ? degToH(lagged.a - 360 * spin) : rot0;
      const N = 8;
      for (let s = 0; s < N; s++) {
        const w = 46;
        const z = 0.42; // underdamped: she overshoots every snap and has to catch herself
        const acc = w * w * (want - head) - 2 * z * w * vel;
        vel += (acc * dt) / N;
        head += (vel * dt) / N;
      }
      // from the crouch on she is locked on exactly
      const lock = ease.inOut(seg(tt, tStop, tCrouch));
      let rot = head + (rot1 - head) * lock;
      if (tt >= tCrouch) rot = rot1;

      // pose
      let sx = 1;
      let sy = 1;
      let sz = 1;
      let lift = 0;
      let pitch = 0;
      let roll = 0;
      let ox = 0;
      let oz = 0;
      // the startle: a jolt up and a stretch
      const st = seg(tt, startle - 0.04, startle + 0.18);
      if (st > 0 && st < 1) {
        const j = Math.sin(Math.PI * st) * (1 - st);
        sy += 0.32 * j;
        sx -= 0.12 * j;
        lift += 0.08 * Math.sin(Math.PI * Math.min(1, st * 1.6));
      }
      // body leans into each snap (roll against the turn speed)
      if (tt < tCrouch) roll += Math.max(-0.25, Math.min(0.25, -vel * 0.018));
      // the crouch: squash low, head down, rear wiggles side to side (pivoting on her nose)
      const cr = ease.out(seg(tt, tCrouch - 0.04, tCrouch + 0.1));
      const unc = seg(tt, tPounce, tPounce + 0.05);
      const crouch = cr * (1 - unc);
      sy -= 0.2 * crouch;
      sx += 0.1 * crouch;
      sz += 0.04 * crouch;
      pitch += 0.16 * crouch;
      if (tt > tCrouch && tt < tPounce) {
        const k = seg(tt, tCrouch + 0.04, tPounce);
        const wig = Math.sin(k * TAU * 2.5) * Math.sin(Math.PI * k) * 0.13;
        // rotate about the nose: the rear swings, the nose stays on the dot
        const L = 0.45;
        const nose = at(rot1, L);
        const c2 = new THREE.Vector3(nose.x + Math.sin(rot1 + wig) * L, 0, nose.z + Math.cos(rot1 + wig) * L);
        ox = c2.x - C.x;
        oz = c2.z - C.z;
        rot = rot1 + wig;
        roll += wig * 0.6;
      }
      // the pounce: stretch on take-off, nose up then down, a short hop in place
      if (tt >= tPounce && tt < tLand) {
        const k = seg(tt, tPounce, tLand);
        lift += Math.sin(Math.PI * k) * 0.3;
        const str = Math.sin(Math.PI * Math.min(1, k * 1.4));
        sy += 0.2 * str;
        sz += 0.18 * str;
        sx -= 0.1 * str;
        pitch += -0.35 * Math.cos(Math.PI * k) * (1 - k * 0.2) + 0.05;
      }
      // the landing: a big squash that bounces out
      if (tt >= tLand) {
        const k = seg(tt, tLand, tEnd);
        const sq = Math.exp(-k * 4.2) * Math.cos(k * Math.PI * 2.4) * (1 - k);
        sy -= 0.3 * sq;
        sx += 0.18 * sq;
        sz += 0.14 * sq;
        pitch += 0.12 * sq;
        if (!splashed) {
          splashed = true;
          if (gear) gear.kick = { t0: lab.arena.time, from: gearFrom, to: gearFrom - spin * (Math.PI / 2) };
          if (gear) gear.pulse = lab.arena.time;
          const where = at(rot1, 0.62);
          ringFx(lab, where.clone().setY(0.02), mint, 0.12, 0.46, 0.32);
          lab.particles(where.clone().setY(0.04), [mint, '#ffffff'], 12, { speed: 1.0, up: 1.1, gravity: 7, size: 0.04, dur: 0.45 });
        }
      }
      maya.set({ x: A.x + ox, y: A.y + oz, rot, sx, sy, sz, lift, pitch, roll });

      if (tt >= tEnd) {
        stop();
        done();
      }
    });
    // the parts: her eye focuses as she stalks, her pointer drinks the dot's light after the splat
    maya.each = (m) => {
      const tt = lab.t - t0;
      const focus = seg(tt, startle, startle + 0.1) * (1 - seg(tt, tLand, tLand + 0.1));
      const k = 1 + 0.8 * focus;
      m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
      const drink = tt >= tLand ? Math.exp(-(tt - tLand) * 6) * seg(tt, tLand, tLand + 0.05) : 0;
      m.ringMat.color.copy(red).lerp(new THREE.Color(mint), drink).multiplyScalar(1.6 + 1.1 * drink);
      // her name stays put while she jumps about
      if (tag) {
        maya.group.updateMatrixWorld(true);
        tag.position.copy(maya.group.worldToLocal(tagWorld.clone()));
        tag.scale.set(tagScale0.x / maya.pose.sx, tagScale0.y / maya.pose.sy, 1);
      }
    };
  });

  maya.each = null;
  stopGear();
  if (tag) {
    tag.position.set(0, 0.86, 0);
    tag.scale.copy(tagScale0);
  }
  maya.model.ringMat.color.copy(red).multiplyScalar(1.6);
  maya.release({ x: after.x, y: after.y, d: after.d });
}
