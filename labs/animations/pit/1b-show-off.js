// Evel Knievel, played as character acting. Maya is a show-off: a little "ooh!" when the ramp of light flicks
// up, a crouch and a full-throttle charge, a barrel roll over the hole, a slam landing and a proud ta-da pose
// turned to the sofa. The hole is the culprit: it creeps back a hair (anticipation), whips east under her, and
// she goes down still frozen mid-pose. Then it slides home, gives an innocent "ting", and the ramp sinks away.
// Theo watches the whole thing: leans back to follow the jump, nods, does a double-take, flinches, and
// keeps a suspicious eye on the hole as it tiptoes home.
export const meta = {
  title: 'Show-off',
  idea: 'A ramp of light flicks up at the rim; Maya perks up ("ooh!"), crouches and floors it, barrel-rolls over the hole and slams down on (5,1) with her ring flaring, then strikes a proud pose turned to the sofa. The hole creeps back a hair, then whips east under her like a rug, and she sinks straight through, still frozen mid-pose. The hole tiptoes home, gives one innocent glint, the ramp sinks back into the glass. Theo follows the jump with his whole body, nods, double-takes, flinches, and eyes the hole all the way home.',
  notes: 'Sound: a rising glass glide up the ramp, a bright chime on the landing, a held major chord under the pose that is cut dead (no fall sound at all: the cut is the joke), a soft sliding hush for the hole and a tiny high "ting" on the glint. Port: the moving hole is a glass patch over the real pit plus a black square that slides; the trail breaks over the jump (the gap reads as air).',
};

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  lab.playCard('a', ['m3']);

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (k) => Math.max(0, Math.min(1, k));
  const key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (fn ?? ease.inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
    return keys[keys.length - 1][1];
  };
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const texOf = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // ---------- timing ----------
  const T = {
    ramp: 0.2, // the ramp flicks up
    ooh: 0.3, // Maya perks up
    charge: 0.44, // crouch and floor it
    rampFoot: 0.8, // reaches the foot of the ramp
    lip: 0.9, // leaves the lip
    land: 1.36, // slams down on (5,1)
    pose: 1.5, // ta-da
    creep: 1.86, // the hole creeps back a hair
    whip: 1.98, // ...then whips east
    drop: 2.13, // the floor is gone: she sinks, still posing
    gone: 2.42,
    home0: 2.5, // the hole tiptoes home
    home1: 2.92,
    ting: 2.96,
    end: 3.28,
  };

  // ---------- the ramp of light ----------
  const RAMP_FOOT = 2.92; // x where it is hinged on the glass
  const RIM = 3.5;
  const ANG = 0.62; // ~35 degrees
  const run = RIM - RAMP_FOOT;
  const L = run / Math.cos(ANG);
  const rampTex = (() => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.02)');
    grad.addColorStop(1, 'rgba(255,255,255,0.14)');
    g.fillStyle = grad;
    g.fillRect(0, 10, 128, 108);
    g.fillStyle = '#fff';
    g.fillRect(0, 8, 128, 5); // rails
    g.fillRect(0, 115, 128, 5);
    g.fillRect(118, 8, 10, 112); // the lip, brightest
    for (let i = 1; i < 4; i++) {
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(i * 30, 13, 2, 102);
    }
    return texOf(c);
  })();
  const rampMat = new THREE.MeshBasicMaterial({ map: rampTex, color: hdr(lab.PALETTE.light, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rampPivot = lab.add(new THREE.Group());
  rampPivot.position.copy(lab.pos(RAMP_FOOT, 1)).setY(0.01);
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.66), rampMat);
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.x = L / 2;
  rampPivot.add(ramp);
  // a fin of light under the lip, so it reads as a ramp from the sofa
  const finMat = new THREE.MeshBasicMaterial({ color: hdr(lab.PALETTE.light, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fin = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(0.012, 1), finMat));
  // the slit of light the ramp rises out of
  const slitMat = new THREE.MeshBasicMaterial({ color: hdr(lab.PALETTE.light, 2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const slit = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(L, 0.04), slitMat));
  slit.rotation.x = -Math.PI / 2;
  slit.position.copy(lab.pos(RAMP_FOOT + L / 2, 1)).setY(0.012);
  const rampAng = [[T.ramp, 0], [T.ramp + 0.16, ANG, ease.outBack], [T.home0 + 0.1, ANG], [T.home1 + 0.12, 0, ease.inOut]];
  const rampOn = [[T.ramp - 0.08, 0], [T.ramp, 1, ease.out], [T.home1, 1], [T.home1 + 0.2, 0, ease.in]];

  // ---------- the hole: a glass patch over the real pit, and a black square that can move ----------
  const W = arena.course.w;
  const H = arena.course.h;
  const patchGeo = new THREE.PlaneGeometry(1, 1);
  {
    // borrow the look of the space below the pit (4,2): same glass, same seams
    const uv = patchGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, (4 + u) / W, 1 - (2 + (1 - v)) / H);
    }
  }
  const patchMat = arena.topMat.clone();
  const patch = lab.add(new THREE.Mesh(patchGeo, patchMat));
  patch.rotation.x = -Math.PI / 2;
  patch.position.copy(lab.pos(4, 1)).setY(0.0015);
  patch.receiveShadow = true;
  patch.visible = false;
  const hole = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000 })));
  hole.rotation.x = -Math.PI / 2;
  hole.visible = false;
  // a "ting": a little four-point star of light on the rim
  const starTex = (() => {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(255,255,255,.6)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(64, 0);
    g.quadraticCurveTo(68, 60, 128, 64);
    g.quadraticCurveTo(68, 68, 64, 128);
    g.quadraticCurveTo(60, 68, 0, 64);
    g.quadraticCurveTo(60, 60, 64, 0);
    g.fill();
    return texOf(c);
  })();
  const star = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: hdr(lab.PALETTE.light, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  star.position.copy(lab.pos(4.44, 0.56)).setY(0.05);
  const holeX = [[T.creep, 4], [T.whip, 3.93, ease.out], [T.whip + 0.22, 5.04, ease.inOut3], [T.whip + 0.32, 5, ease.inOut], [T.home0, 5], [T.home0 + 0.08, 5.03, ease.out], [T.home1, 4, ease.inOut]];

  // ---------- Maya ----------
  const flightK = (t) => clamp((t - T.lip) / (T.land - T.lip));
  const h0 = run * Math.tan(ANG);
  const sl = Math.tan(ANG) * 1.5; // the take-off slope carries on into the arc
  const arcA = sl + h0; // lift(k) = h0 (1-k) + arcA k (1-k)
  const mayaX = (t) => {
    if (t < T.charge) return key(t, [[0, 1], [T.charge, 1.75, ease.in]]);
    if (t < T.rampFoot) return key(t, [[T.charge, 1.75], [T.rampFoot, RAMP_FOOT, (k) => 0.35 * k + 0.65 * k * k]]);
    if (t < T.lip) return lerp(RAMP_FOOT, RIM, (t - T.rampFoot) / (T.lip - T.rampFoot));
    if (t < T.land) return lerp(RIM, 5, flightK(t));
    return 5;
  };
  const mayaLift = (t) => {
    if (t < T.rampFoot) return 0;
    if (t < T.lip) return ((mayaX(t) - RAMP_FOOT) / run) * h0;
    if (t < T.land) {
      const k = flightK(t);
      return h0 * (1 - k) + arcA * k * (1 - k);
    }
    if (t < T.drop) return 0;
    return -1.25 * ease.in((t - T.drop) / (T.gone - T.drop));
  };
  const mayaPitch = (t) => {
    // the whole robot follows the ramp and the arc
    if (t < T.rampFoot) return 0;
    if (t < T.lip) return -ANG * clamp((t - T.rampFoot) / 0.05);
    if (t < T.land) {
      const k = flightK(t);
      return -Math.atan((-h0 + arcA * (1 - 2 * k)) / 1.5);
    }
    return 0;
  };
  // body acting on top (body only, so the ring stays flat when she is on the glass)
  const bodyPitch = [[0, 0], [T.ooh, 0], [T.ooh + 0.07, -0.22, ease.out], [T.charge, -0.08], [T.charge + 0.1, 0.2, ease.out], [T.rampFoot, 0.16], [T.rampFoot + 0.05, 0],
    [T.land, 0], [T.land + 0.05, 0.3, ease.out], [T.pose, -0.05, ease.inOut], [T.pose + 0.16, -0.26, ease.outBack], [T.drop + 0.2, -0.26]];
  const stretch = [[0, 1], [T.ooh, 1], [T.ooh + 0.07, 1.13, ease.out], [T.charge, 1], [T.charge + 0.1, 0.84, ease.out], [T.rampFoot, 0.86], [T.lip, 1.16, ease.out], [T.lip + 0.2, 1, ease.inOut],
    [T.land, 1], [T.land + 0.06, 0.6, ease.out], [T.land + 0.18, 1.14, ease.out], [T.pose, 1, ease.inOut], [T.pose + 0.16, 1.14, ease.outBack], [T.drop, 1.12], [T.gone, 1.26, ease.in]];
  const roll = [[T.lip + 0.08, 0], [T.land - 0.08, -Math.PI * 2, ease.inOut]];
  const turn = [[T.pose, 0], [T.pose + 0.18, -0.62, ease.outBack]]; // toward the sofa: ta-da
  const shimmy = (t) => (t > T.pose + 0.16 && t < T.creep ? Math.sin((t - T.pose) * 40) * 0.07 * (1 - (t - T.pose - 0.16) / (T.creep - T.pose - 0.16)) : 0);
  const eyeK = [[0, 1], [T.ooh, 1], [T.ooh + 0.05, 2.4, ease.out], [T.charge + 0.2, 1.3], [T.land, 1.3], [T.pose + 0.1, 2.3, ease.out], [T.drop, 2.3]];

  // ---------- Theo, the audience of one ----------
  const theoAt = new THREE.Vector2(5, 3);
  const aim = (x, y) => Math.atan2(-(x - theoAt.x), -(y - theoAt.y)); // rot that faces the point (north = 0)
  const theoBodyPitch = [[T.lip - 0.05, 0], [T.lip + 0.15, -0.3, ease.out], [T.land, -0.2], [T.land + 0.1, 0.16, ease.out], [T.land + 0.2, -0.04], [T.land + 0.3, 0.12], [T.pose + 0.25, 0],
    [T.whip + 0.1, 0], [T.whip + 0.16, 0.26, ease.out], [T.drop + 0.04, 0.2], [T.drop + 0.12, -0.3, ease.out], [T.home0, -0.22], [T.home1, -0.1], [T.end, 0]];
  const theoSy = [[T.drop + 0.04, 1], [T.drop + 0.12, 0.8, ease.out], [T.home0 + 0.1, 0.92], [T.end, 1]];
  const theoEye = [[T.whip + 0.08, 1], [T.whip + 0.14, 2.4, ease.out], [T.drop + 0.3, 1.5], [T.end, 1]];

  // ---------- run it ----------
  const t0 = lab.t;
  let now = 0;
  let flying = false;
  let trailCut = false;
  const b = maya.bot;
  const ring = maya.model.group.children.find((o) => o.geometry?.type === 'RingGeometry');
  const eyeBase = new THREE.Color(3.2, 3.1, 2.9);

  const stop = lab.every((dt, t) => {
    now = t - t0;
    // ramp
    const a = key(now, rampAng);
    const on = key(now, rampOn);
    rampPivot.rotation.z = a;
    rampMat.opacity = on;
    slitMat.opacity = clamp(1 - Math.abs(now - T.ramp) / 0.12) * 0.9;
    const lipX = RAMP_FOOT + L * Math.cos(a);
    const lipY = L * Math.sin(a);
    fin.position.copy(lab.pos(lipX, 1)).setY(lipY / 2 + 0.005);
    fin.scale.y = Math.max(0.001, lipY);
    fin.lookAt(lab.camera3.position.x, fin.position.y, lab.camera3.position.z);
    finMat.opacity = on * 0.8;
    // hole
    if (now >= T.creep && now < T.home1 + 0.02) {
      patch.visible = true;
      hole.visible = true;
      hole.position.copy(lab.pos(key(now, holeX), 1)).setY(0.003);
    } else {
      patch.visible = false;
      hole.visible = false;
    }
    const tk = (now - T.ting) / 0.3;
    star.material.opacity = tk > 0 && tk < 1 ? Math.sin(tk * Math.PI) : 0;
    star.scale.setScalar(0.05 + 0.4 * Math.sin(clamp(tk) * Math.PI));
    star.material.rotation = tk * 1.2;

    // Maya: no trail over the jump (a gap is what reads as air)
    const airborne = now >= T.rampFoot && now < T.land;
    if (airborne && !flying) {
      flying = true;
      const p = lab.pos(mayaX(now), 1);
      b.trail.push({ x: p.x, z: p.z, t: t - 3.19 }); // an invisible link: the gap reads as air
    }
    if (!airborne && flying) {
      flying = false;
      const p = lab.pos(5, 1);
      b.trail.push({ x: p.x, z: p.z, t: t - 3.19 });
    }
    if (now > T.drop && !trailCut) trailCut = true;
    const s = key(now, stretch);
    maya.set({
      x: mayaX(now),
      lift: mayaLift(now),
      pitch: mayaPitch(now),
      roll: key(now, roll),
      rot: facing(1) + key(now, turn),
      sy: s,
      sx: 1 / Math.sqrt(s),
      sz: 1 / Math.sqrt(s),
      trail: !airborne && now < T.land + 0.01,
      visible: now < T.gone,
    });
    // Theo follows her through the air, then watches the hole go home
    let look = 0;
    if (now > T.lip - 0.1 && now < T.land + 0.25) look = aim(mayaX(Math.min(now + 0.06, T.land)), 1);
    else if (now >= T.land + 0.25 && now < T.home0) look = aim(5, 1) * 1;
    else if (now >= T.home0) look = aim(key(now, holeX), 1);
    const lookW = key(now, [[T.lip - 0.12, 0], [T.lip, 1, ease.out], [T.land + 0.3, 1], [T.land + 0.45, 0.35], [T.whip, 0.35], [T.whip + 0.1, 1, ease.out], [T.home1 + 0.05, 1], [T.end, 0, ease.inOut]]);
    const ts = key(now, theoSy);
    theo.set({ rot: look * lookW, sy: ts, sx: 1 / Math.sqrt(ts), sz: 1 / Math.sqrt(ts) });
  });

  maya.each = (m) => {
    m.body.rotation.x = -(key(now, bodyPitch));
    m.body.rotation.z = -shimmy(now);
    m.eyeMat.color.copy(eyeBase).multiplyScalar(key(now, eyeK));
    // her ring flares on the landing, and stays proud through the pose
    const g = now >= T.land ? clamp((now - T.land) / 0.4) : 0;
    const f = now >= T.land && g < 1 ? Math.sin(Math.sqrt(g) * Math.PI) : 0;
    const proud = clamp((now - T.pose) / 0.15) * (now < T.drop + 0.3 ? 1 : 0);
    ring.scale.setScalar(1 + 0.42 * f + 0.07 * proud);
    m.ringMat.color.set(b.color).multiplyScalar(1.6 * (1 + 0.9 * f + 0.25 * proud));
    m.ringMat.opacity = 0.9;
    if (b.card) b.card.visible = maya.pose.lift > -0.2;
  };
  theo.each = (m) => {
    m.body.rotation.x = -key(now, theoBodyPitch);
    m.eyeMat.color.copy(eyeBase).multiplyScalar(key(now, theoEye));
  };

  lab.cleanup(() => {
    rampTex.dispose();
    starTex.dispose();
    patchMat.dispose();
  });

  await lab.wait(T.end);
  stop();
  ring.scale.setScalar(1);
  maya.model.ringMat.color.set(b.color).multiplyScalar(1.6);
  maya.each = null;
  theo.each = null;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
}
