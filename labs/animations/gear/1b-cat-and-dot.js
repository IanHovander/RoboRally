// Gear, idea 1 (laser-pointer cat), animator b: character acting.
// The gear's arrowhead slips out from under Maya as a mint dot of light and sneaks round behind her to sit,
// trembling like a laser pointer in a hand, right in front of her nose. She does a startled take, then hunts
// it: stop-start snaps of her nose, a seeded feint that fools her, a freeze, a crouch with a rear wiggle and a
// pounce that lands her pointer on the dot exactly at her new heading. She puffs up, proud. Theo watched the
// whole thing, flinched at the pounce, and gives one slow, deadpan blink.
export const meta = {
  title: 'Cat and dot',
  idea:
    'The gear does not turn Maya, it teases her: its arrowhead peels off as a dot of light, sneaks round behind her and sits in front of her nose. She startles, stalks it in jerky snaps (a seeded feint fools her every time differently), crouches, wiggles her rear and pounces, landing her pointer on the dot exactly at east. Then she preens, and Theo, who saw everything, blinks once.',
  notes:
    'Sound: a tiny glass "tik" each time the dot darts, silence for the crouch, a soft glass "pff" when it goes out under her, and a two-note chime as the arrow relights. The dot trembles like a hand-held pointer while it waits. Feints are seeded (a flick back, a false start that fools her, or a long tease) but the dot always dies at her new front. Red gears run it the other way.',
};

const TAU = Math.PI * 2;

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.after.a;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });
  const gx = sc.bots.a.x;
  const gy = sc.bots.a.y;
  const gear = lab.arena.gears.get(`${gx},${gy}`);
  const spin = gear?.spin ?? 1;
  const rot0 = maya.pose.rot;
  const rot1 = rot0 + ((facing(A.d) - rot0 + 3 * Math.PI) % TAU) - Math.PI; // the nearest way to her new heading
  const turn = Math.abs(rot1 - rot0) || Math.PI / 2;
  const theoRot0 = theo.pose.rot;
  const C = lab.pos(gx, gy);
  const T = lab.pos(sc.bots.b.x, sc.bots.b.y);
  const mint = new THREE.Color(spin > 0 ? lab.PALETTE.right : lab.PALETTE.left);

  // ----- small helpers -----
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (k) => Math.sin(Math.PI * clamp(k)); // 0 → 1 → 0
  /** piecewise keys [[t, v, ease?], ...]: the value at time t, eased into each key */
  const keys = (list, t) => {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      const [t1, v1, e = ease.inOut] = list[i];
      const [t0, v0] = list[i - 1];
      if (t <= t1) return v0 + (v1 - v0) * e(seg(t, t0, t1));
    }
    return list[list.length - 1][1];
  };
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,255,255,.6)');
    gr.addColorStop(0.55, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const add = (o) => lab.add(o);
  const glowMat = (color, k, opacity = 1) =>
    new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const flat = (size, mat, y = 0.012) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 6;
    return add(m);
  };
  const findEye = (model) => {
    let eye = null;
    model.body.traverse((o) => {
      if (!eye && o.isMesh && o.material === model.eyeMat) eye = o;
    });
    return eye;
  };

  // where the gear's arrowhead is now (it turns slowly with the gear), in world space
  const tipLocal = new THREE.Vector3((Math.cos(Math.PI * 0.55) * 70 * 0.92) / 256, (-Math.sin(Math.PI * 0.55) * 70 * 0.92) / 256, 0);
  const tipWorld = () => (gear ? gear.mesh.localToWorld(tipLocal.clone()) : C.clone().add(new THREE.Vector3(0, 0, 0.25)));

  // a patch of dark over the arrowhead while its light is away
  const hole = flat(0.16, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }), 0.007);
  hole.renderOrder = 3;

  // ----- the dot: a bright core, a halo, a pool of mint on the glass and a short comet tail -----
  const core = add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: mint.clone().multiplyScalar(5), transparent: true, depthWrite: false })));
  const halo = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: mint.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.setScalar(0.42);
  const pool = flat(0.7, glowMat(mint, 1.6));
  const tail = [];
  for (let i = 0; i < 7; i++) {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: mint.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.visible = false;
    tail.push(s);
  }
  const history = [];
  const R = 0.86; // just outside her ring and pointer, so her body never hides it
  const at = (psi, r) => {
    const phi = rot0 - spin * psi; // psi: clockwise progress for a green gear; 0 = her nose, turn = her new nose
    return new THREE.Vector3(C.x - Math.sin(phi) * r, 0.03, C.z - Math.cos(phi) * r);
  };

  // the death of the dot: a small ring of mint
  const pop = flat(0.5, new THREE.MeshBasicMaterial({ map: (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = '#fff';
    g.lineWidth = 7;
    g.shadowColor = '#fff';
    g.shadowBlur = 10;
    g.beginPath();
    g.arc(64, 64, 46, 0, TAU);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })(), color: mint.clone().multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));

  // ----- the plan (seconds from the start of the moment) -----
  const P = 0.3; // the dot arrives in front of her nose
  const SPOT = 0.38; // she notices
  const HUNT = 0.5; // the chase begins
  // the chase: the dot darts in stop-start hops; she snaps after each one a beat late
  const feint = Math.floor(lab.rand() * 3); // 0: it flicks back, 1: a false start fools her, 2: a long tease
  const dart = () => lab.range(0.055, 0.075);
  const hold = () => lab.range(0.06, 0.11);
  const dotKeys = [[0, 0], [HUNT, 0]];
  const herKeys = [[0, 0], [HUNT + 0.05, 0]];
  let t = HUNT;
  const LAG = 0.05;
  const SNAP = 0.075;
  const go = (to, { follow = true, lagMore = 0 } = {}) => {
    const d = dart();
    dotKeys.push([t + d, to, ease.out]);
    if (follow) herKeys.push([t + LAG + lagMore + SNAP, to, ease.outBack]);
    t += d;
  };
  const wait = (s = hold()) => {
    dotKeys.push([t + s, dotKeys[dotKeys.length - 1][1]]);
    t += s;
  };
  const q = turn / 4;
  let falseAt = -9;
  go(q * lab.range(1.1, 1.4));
  wait();
  if (feint === 0) {
    go(q * lab.range(2.4, 2.7));
    wait(0.05);
    go(q * lab.range(1.6, 1.9)); // a flick back: she flicks back with it
    wait();
  } else if (feint === 1) {
    falseAt = t;
    // a false start: the dot twitches forward and straight back; she commits to the twitch and has to sheepishly come back
    const here = dotKeys[dotKeys.length - 1][1];
    dotKeys.push([t + 0.04, here + q * 0.35, ease.out], [t + 0.09, here, ease.inOut]);
    herKeys.push([t + 0.04 + LAG + SNAP, here + q * 1.3, ease.outBack], [t + 0.33, here, ease.inOut]);
    t += 0.24;
  } else {
    wait(lab.range(0.14, 0.18)); // a long tease: nothing, nothing...
  }
  go(q * lab.range(2.6, 2.9));
  wait(lab.range(0.05, 0.08));
  // the last dart: she doesn't follow this one, she freezes and stalks it
  const lastAt = herKeys[herKeys.length - 1][0];
  const STALK = Math.max(t, lastAt) + 0.03;
  t = STALK;
  dotKeys.push([STALK + 0.06, turn, ease.out]);
  const herStalk = q * 3.15; // where she freezes: a little short of the dot
  herKeys.push([STALK + 0.12, herStalk, ease.out]);
  const CROUCH = STALK + 0.1;
  const POUNCE = CROUCH + 0.24;
  const LAND = POUNCE + 0.17;
  const END = LAND + 0.26;
  herKeys.push([POUNCE, herStalk - q * 0.12, ease.inOut], [LAND, turn, ease.inOut]); // a tiny wind-up the other way, then the leap
  dotKeys.push([LAND, turn]);

  const mEye = findEye(maya.model);
  const tEye = findEye(theo.model);
  const mBody = maya.model.body;
  const tBody = theo.model.body;
  const restore = () => {
    mBody.scale.set(1, 1, 1);
    mBody.position.x = 0;
    tBody.scale.set(1, 1, 1);
    tBody.position.x = 0;
    if (mEye) mEye.scale.set(1, 1, 1);
    if (tEye) tEye.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);

  // Theo's head turns to watch, a little late and a little less (a bystander)
  const toMaya = Math.atan2(-(C.x - T.x), -(C.z - T.z));
  const theoLook = theoRot0 + 0.45 * (((toMaya - theoRot0 + 3 * Math.PI) % TAU) - Math.PI);

  let relit = false;
  const t0 = lab.t;
  const stop = lab.every(() => {
    const s = lab.t - t0;
    // ----- the dot -----
    let pos;
    let alive = s < LAND;
    const tremble = alive && s > P ? new THREE.Vector3(Math.sin(s * 71) * 0.012 + Math.sin(s * 43) * 0.008, 0, Math.cos(s * 59) * 0.012) : new THREE.Vector3();
    if (s < P) {
      // peel off the arrowhead, out from under her back, and sneak round behind her to her nose
      const k = s / P;
      const tip = tipWorld();
      const outK = ease.out3(clamp(k * 2.4));
      const psi = -Math.PI + Math.PI * ease.inOut(k);
      const ring = at(psi, R);
      pos = tip.clone().lerp(ring, outK);
      pos.y = 0.03 + bump(k * 1.5) * 0.04;
    } else {
      pos = at(keys(dotKeys, s), R);
    }
    pos.add(tremble);
    const dying = seg(s, LAND - 0.02, LAND + 0.07);
    const appear = ease.out(seg(s, 0, 0.08));
    const size = alive ? appear * (1 + 0.15 * Math.sin(s * 40)) : 1 - dying;
    core.position.copy(pos);
    core.scale.setScalar(Math.max(0.001, size));
    halo.position.copy(pos);
    halo.scale.setScalar(0.42 * Math.max(0.001, size));
    pool.position.set(pos.x, 0.012, pos.z);
    pool.material.opacity = Math.max(0, size) * 0.9;
    core.visible = halo.visible = size > 0.01;
    history.push(pos.clone());
    if (history.length > 14) history.shift();
    tail.forEach((sp, i) => {
      const h = history[history.length - 2 - i * 2];
      const speed = h ? h.distanceTo(pos) : 0;
      sp.visible = !!h && size > 0.01 && speed > 0.05;
      if (!sp.visible) return;
      sp.position.copy(h);
      sp.scale.setScalar(0.22 * (1 - i / tail.length) * size);
      sp.material.opacity = 0.8 * (1 - i / tail.length);
    });
    // the dark spot where the arrowhead was; it relights once she has caught the light
    const tip = tipWorld();
    hole.position.set(tip.x, 0.007, tip.z);
    hole.material.opacity = 0.9 * ease.out(seg(s, 0, 0.06)) * (1 - seg(s, LAND + 0.1, LAND + 0.2));
    if (!relit && s > LAND + 0.1) {
      relit = true;
      if (gear) gear.pulse = lab.t;
    }
    const popK = seg(s, LAND, LAND + 0.32);
    pop.position.set(pos.x, 0.013, pos.z);
    pop.scale.setScalar(0.25 + 1.1 * ease.out(popK));
    pop.material.opacity = s > LAND ? 0.9 * (1 - popK) : 0;

    // ----- Maya -----
    const h = keys(herKeys, s);
    const spotK = seg(s, SPOT, SPOT + 0.15);
    const startle = s > SPOT ? bump(seg(s, SPOT, SPOT + 0.1)) * (1 - seg(s, SPOT + 0.1, SPOT + 0.15)) : 0;
    const hunting = seg(s, SPOT + 0.08, SPOT + 0.18) * (1 - seg(s, LAND + 0.1, END));
    const crouch = ease.out(seg(s, CROUCH, CROUCH + 0.08)) * (1 - seg(s, POUNCE - 0.02, POUNCE + 0.03));
    const air = seg(s, POUNCE, LAND);
    const hop = s > POUNCE && s < LAND ? Math.sin(Math.PI * air) : 0;
    const landK = seg(s, LAND, LAND + 0.16);
    const squashLand = s > LAND ? Math.exp(-landK * 4) * Math.cos(landK * 9) : 0;
    const proud = bump(seg(s, LAND + 0.1, END));
    const sheep = bump(seg(s, falseAt + 0.14, falseAt + 0.38)); // caught out by the false start: nose down, eye dim
    // the wiggle of her rear before the leap: she yaws about her nose, so her back end swings
    const wig = crouch * Math.sin((s - CROUCH) * 44) * 0.16 * seg(s, CROUCH + 0.05, CROUCH + 0.09);
    const fwd = new THREE.Vector2(-Math.sin(rot0 - spin * h), -Math.cos(rot0 - spin * h));
    const lunge = 0.1 * hop + 0.08 * (s > LAND ? 1 - ease.out(landK) : 0) - 0.03 * crouch; // nose out to the dot, then back to her space
    maya.set({
      x: gx + fwd.x * lunge,
      y: gy + fwd.y * lunge,
      rot: rot0 - spin * h,
      lift: 0.07 * startle + 0.2 * hop,
    });
    // she leans with her body only, so her ring of light stays flat on the glass
    const mPitch = -0.35 * startle + 0.12 * hunting + 0.14 * crouch - 0.22 * hop * (air < 0.5 ? 1 : -0.6) - 0.16 * proud - 0.12 * sheep;
    maya.each = (m) => {
      m.body.rotation.x = -mPitch;
      m.body.position.y += 0.3 * Math.abs(Math.sin(mPitch));
      const sy = 1 + 0.16 * startle - 0.06 * hunting - 0.16 * crouch + 0.18 * hop * (air < 0.6 ? 1 : 0.3) - 0.3 * squashLand + 0.06 * proud;
      const sxz = 1 / Math.sqrt(Math.max(0.4, sy));
      m.body.scale.set(sxz, sy, sxz);
      m.body.rotation.y = wig;
      m.body.position.x = Math.sin(wig) * 0.26;
      // her eye: wide and bright when she spots it, a narrow hot slit while she stalks, a sparkle when proud
      const glow = 1 + 1.4 * spotK * hunting + 0.9 * crouch + 1.2 * proud - 0.5 * sheep;
      m.eyeMat.color.multiplyScalar(glow);
      if (mEye) {
        const open = 1 + 0.6 * startle - 0.45 * crouch;
        mEye.scale.set(open, 1 + 0.25 * startle, open);
      }
    };

    // ----- Theo, the bystander -----
    const look = ease.inOut(seg(s, SPOT + 0.15, SPOT + 0.55)) * (1 - ease.inOut(seg(s, LAND + 0.16, END)));
    const flinchK = s > LAND ? bump(seg(s, LAND + 0.01, LAND + 0.2)) : 0;
    const back = new THREE.Vector2(Math.sin(theoRot0), Math.cos(theoRot0)); // behind him
    theo.set({
      x: sc.bots.b.x + back.x * 0.06 * flinchK,
      y: sc.bots.b.y + back.y * 0.06 * flinchK,
      rot: theoRot0 + (theoLook - theoRot0) * look,
      lift: 0.06 * flinchK,
    });
    const tPitch = -0.25 * flinchK + 0.05 * look * (1 - flinchK);
    theo.each = (m) => {
      m.body.rotation.x = -tPitch;
      m.body.position.y += 0.3 * Math.abs(Math.sin(tPitch));
      const sy = 1 + 0.12 * flinchK;
      m.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      // one slow, deadpan blink after she lands
      const b = seg(s, LAND + 0.17, LAND + 0.29);
      const shut = b > 0 && b < 1 ? Math.sin(Math.PI * b) : 0;
      m.eyeMat.color.multiplyScalar(1 - 0.92 * shut + 0.6 * flinchK);
      if (tEye) tEye.scale.set(1, 1, 1 - 0.85 * shut);
    };
  });

  await lab.wait(END);
  stop();
  restore();
  for (const o of [...lab.group.children]) lab.group.remove(o); // nothing of the dot is left over
  maya.each = null;
  theo.each = null;
  maya.release({ x: A.x, y: A.y, d: A.d });
  theo.release({ x: sc.bots.b.x, y: sc.bots.b.y, d: sc.bots.b.d });
}
