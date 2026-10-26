// Energy, idea 5 (the well), animator b: character acting.
export const meta = {
  title: "Don't look down",
  idea:
    'Maya parks on the battery and slurps its light up like a milkshake: the amber retreats into her, she swells and glows amber, and the space under her is left a black hole in the glass, drawn the way Lumen draws pits. Ahh. Then she glances down, looks away, and SNAPS back: she is sitting over a pit. She sinks a hair, Wile E. Coyote style, and freezes; Ezra leans in. A single drop of warm light falls out of the dark above the board and lands at the edge of the hole with a plink. A ripple runs round her ring, the light floods back in from where the drop landed, she pops back up onto solid glass and lets out a long relieved breath. Ezra looks up: someone up there keeps refilling them.',
  notes:
    'Sound: a rising slurp, a breathy "ahh", silence (the pit), a single high glass plink, a soft rising wash as the light refills, a relieved low exhale. ' +
    'The hole and its refill are two small canvas textures redrawn for a third of a second; the hole sits above the robot\'s glow pool (renderOrder) so it reads as a real absence of light. ' +
    'Port: the drop always lands on the camera side of the hole so it is never hidden behind the robot.',
};

export default async function play(lab) {
  const { THREE, PALETTE } = lab;
  const AMBER = new THREE.Color(1.0, 0.62, 0.22);
  const RED = new THREE.Color(lab.bot('a').color);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const E = lab.ease;
  const TAU = Math.PI * 2;
  const track = (keys) => (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = (t - t0) / (t1 - t0 || 1);
        return v0 + (v1 - v0) * (E[e] ?? E.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
  const actBody = (model, a, L = 0.3, W = 0.28) => {
    const b = model.body;
    const pitch = a.pitch ?? 0;
    const roll = a.roll ?? 0;
    b.rotation.set(-pitch, 0, -roll);
    b.scale.set(a.sx ?? 1, a.sy ?? 1, a.sz ?? 1);
    const p = new THREE.Vector3(roll > 0 ? W : roll < 0 ? -W : 0, 0, pitch > 0 ? -L : pitch < 0 ? L : 0);
    const r = p.clone().applyEuler(b.rotation);
    b.position.set(p.x - r.x, (a.lift ?? 0) + p.y - r.y, p.z - r.z);
  };
  const canvasTex = (n) => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, g: c.getContext('2d'), t };
  };

  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const bat = lab.pos(3, 1);
  const EAST = lab.facing(1);
  const LOOK = Math.atan2(2, 2);

  // ----- the hole, and the light flowing back into it (two little canvases, 1 space across) -----
  const N = 256;
  const HR = 0.6; // hole radius, in spaces: wider than her body, so it reads round her
  const px = (u) => (u * N) / 1; // spaces -> canvas px (the plane is 1 space across)
  const C = N / 2;
  const DROP = [0, HR * 0.98]; // where the drop lands: the hole's edge, camera side (dx, dz in spaces)
  const dark = canvasTex(N);
  const front = canvasTex(N);
  const darkMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dark.t, transparent: true, depthWrite: false }));
  darkMesh.rotation.x = -Math.PI / 2;
  darkMesh.position.set(bat.x, 0.011, bat.z);
  darkMesh.renderOrder = 5; // over her glow pool: a real absence of light
  const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: front.t, color: hdr(0xffffff, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  frontMesh.rotation.x = -Math.PI / 2;
  frontMesh.position.set(bat.x, 0.012, bat.z);
  frontMesh.renderOrder = 6;
  lab.add(darkMesh);
  lab.add(frontMesh);
  // drain: the light retreats from the rim into her (inner = radius of light still left, 1 -> 0)
  // fill: the light floods back from where the drop landed (fill = radius of the refill, 0 -> 1)
  const drawHole = (inner, fill) => {
    const g = dark.g;
    g.clearRect(0, 0, N, N);
    const R = px(HR);
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(C, C, R, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(244,239,228,.42)'; // the glass edge of the hole catches the light
    g.lineWidth = 2.5;
    g.stroke();
    g.globalCompositeOperation = 'destination-out';
    if (inner > 0) {
      g.beginPath();
      g.arc(C, C, R * inner + 1, 0, TAU);
      g.fill();
    }
    if (fill > 0) {
      const fx = C + px(DROP[0]);
      const fy = C + px(DROP[1]);
      const fr = px(HR * 2.15) * fill;
      const grad = g.createRadialGradient(fx, fy, Math.max(0, fr - 14), fx, fy, fr + 2);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(fx, fy, fr + 2, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    dark.t.needsUpdate = true;
    // the bright edge of the moving light
    const f = front.g;
    f.clearRect(0, 0, N, N);
    f.save();
    f.beginPath();
    f.arc(C, C, R + 3, 0, TAU);
    f.clip();
    f.shadowColor = PALETTE.energy;
    f.shadowBlur = 10;
    f.strokeStyle = PALETTE.energy;
    f.lineWidth = 4;
    if (inner > 0 && inner < 1) {
      f.globalAlpha = Math.min(1, inner * 3);
      f.beginPath();
      f.arc(C, C, R * inner, 0, TAU);
      f.stroke();
    }
    if (fill > 0 && fill < 1) {
      f.globalAlpha = Math.min(1, (1 - fill) * 3);
      f.beginPath();
      f.arc(C + px(DROP[0]), C + px(DROP[1]), px(HR * 2.15) * fill, 0, TAU);
      f.stroke();
    }
    f.restore();
    front.t.needsUpdate = true;
  };
  darkMesh.visible = frontMesh.visible = false;

  // ----- the slurp: a sleeve of amber light pulled up into her -----
  const sleeveTex = canvasTex(64);
  {
    const grad = sleeveTex.g.createLinearGradient(0, 64, 0, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sleeveTex.g.fillStyle = grad;
    sleeveTex.g.fillRect(0, 0, 64, 64);
  }
  const sleeveMat = new THREE.MeshBasicMaterial({ map: sleeveTex.t, color: hdr(AMBER, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0), sleeveMat);
  sleeve.position.set(bat.x, 0, bat.z);
  sleeve.visible = false;
  lab.add(sleeve);

  // ----- the drop: a short bright streak falling out of the dark -----
  const streakTex = canvasTex(64);
  {
    const grad = streakTex.g.createLinearGradient(0, 64, 0, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    streakTex.g.fillStyle = grad;
    streakTex.g.fillRect(20, 0, 24, 64);
  }
  const streakMat = new THREE.MeshBasicMaterial({ map: streakTex.t, color: hdr(0xffd9a0, 3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55).translate(0, 0.25, 0), streakMat);
  streak.visible = false;
  lab.add(streak);
  const headTex = canvasTex(64);
  {
    const gr = headTex.g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    headTex.g.fillStyle = gr;
    headTex.g.fillRect(0, 0, 64, 64);
  }
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex.t, color: hdr(0xffd9a0, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  head.scale.setScalar(0.22);
  head.visible = false;
  lab.add(head);
  const landAt = lab.pos(3 + DROP[0], 1 + DROP[1]);

  // ----- the ripple: two sparks running round her ring from where it landed -----
  const ripMat = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.energy, 3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const rips = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.505, 0.56, 24, 1, -0.32, 0.64), ripMat);
    m.rotation.order = 'YXZ';
    m.position.set(bat.x, 0.013, bat.z);
    m.renderOrder = 8; // over the hole
    lab.add(m);
    return m;
  });

  // ----- the battery's arcs, round her: drained dark, then back bright -----
  const arcs = new THREE.Group();
  arcs.position.set(bat.x, 0.009, bat.z);
  const arcMats = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.energy, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48, 1, -((i + 1) / 3) * TAU + 0.3, TAU / 3 - 0.6), m);
    a.rotation.x = -Math.PI / 2;
    arcs.add(a);
    arcMats.push(m);
  }
  lab.add(arcs);

  // ----- her light -----
  const st = { body: {}, ez: {}, amber: 0, eyeK: 1 };
  const ringBase = maya.model.ringMat.color.clone();
  const poolBase = maya.model.poolMat.color.clone();
  // her ring of light (and pointer) floats over the hole
  const ringMeshes = [];
  maya.group.traverse((o) => o.isMesh && o.material === maya.model.ringMat && ringMeshes.push([o, o.renderOrder]));
  for (const [o] of ringMeshes) o.renderOrder = 7;
  const restore = () => {
    for (const [o, r] of ringMeshes) o.renderOrder = r;
    maya.model.ringMat.color.copy(ringBase);
    maya.model.poolMat.color.copy(poolBase);
    maya.model.body.scale.set(1, 1, 1);
    ezra.model.body.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);
  const white = new THREE.Color(3.2, 3.1, 2.9);
  maya.each = (m) => {
    actBody(m, st.body);
    m.eyeMat.color.copy(white).lerp(hdr(AMBER, 4.4), st.amber).multiplyScalar(st.eyeK);
    m.ringMat.color.copy(ringBase).lerp(hdr(AMBER, 2.4), st.amber * 0.85);
    m.poolMat.color.copy(poolBase).lerp(hdr(AMBER, 1.2), st.amber * 0.85);
    m.paint.emissive.copy(RED).lerp(AMBER, st.amber * 0.45);
    m.paint.emissiveIntensity = 0.16 + st.amber * 0.6;
  };
  ezra.each = (m) => actBody(m, st.ez, 0.2, 0.2);

  // ----- timing -----
  const ARRIVE = 0.62;
  const SLURP = 0.7; // the light drains up into her
  const AHH = 0.98;
  const GLANCE = 1.06; // glance down, away, SNAP back
  const SNAP = 1.2;
  const FALL = 1.32; // the drop leaves the dark above
  const PLINK = 1.52;
  const FULL = PLINK + 0.3; // the light is back
  const END = 2.1;

  const x = track([[0, 1], [ARRIVE, 3, 'inOut']]);
  const drive = [[0, 0], [0.12, -0.08, 'out'], [0.45, 0, 'inOut'], [ARRIVE + 0.06, 0.2, 'out'], [ARRIVE + 0.18, -0.05, 'inOut']];
  const DOWNROT = EAST - 0.5; // nose turned a little toward us, to look down at the hole
  const rot = track([[0, EAST], [GLANCE, EAST, 'linear'], [GLANCE + 0.05, DOWNROT, 'out'], [GLANCE + 0.09, DOWNROT, 'linear'], [GLANCE + 0.13, EAST + 0.05, 'inOut'], [SNAP - 0.01, EAST + 0.05, 'linear'], [SNAP + 0.05, DOWNROT - 0.1, 'out'], [PLINK + 0.1, DOWNROT, 'linear'], [END - 0.08, EAST, 'inOut']]);
  // slurp: lean back a touch and stretch; ahh; glance (nose down), away (nose up, whistling), SNAP (nose way down)
  const pitch = track([...drive, [SLURP, 0, 'inOut'], [SLURP + 0.18, -0.16, 'inOut'], [AHH, -0.2, 'linear'], [AHH + 0.08, -0.06, 'out'], [GLANCE, -0.04, 'linear'], [GLANCE + 0.05, 0.3, 'out'], [GLANCE + 0.09, 0.3, 'linear'], [GLANCE + 0.13, -0.12, 'inOut'], [SNAP - 0.01, -0.12, 'linear'], [SNAP + 0.05, 0.55, 'out'], [PLINK, 0.5, 'linear'], [PLINK + 0.06, -0.22, 'out'], [FULL + 0.06, -0.1, 'inOut'], [END, 0, 'inOut']]);
  const sy = track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.9, 'out'], [ARRIVE + 0.16, 1.02, 'out'], [SLURP, 1, 'inOut'], [AHH - 0.04, 1.2, 'inOut'], [AHH + 0.08, 0.94, 'inOut'], [AHH + 0.16, 1, 'inOut'], [SNAP, 1, 'linear'], [SNAP + 0.05, 1.08, 'out'], [SNAP + 0.14, 0.94, 'inOut'], [PLINK, 0.95, 'linear'], [PLINK + 0.06, 1.16, 'out'], [FULL, 1.06, 'linear'], [FULL + 0.14, 0.86, 'inOut'], [END - 0.04, 1, 'inOut']]);
  const swell = track([[0, 1], [SLURP + 0.05, 1, 'linear'], [AHH - 0.04, 1.08, 'inOut'], [AHH + 0.1, 1, 'inOut']]);
  // over the hole she sinks a hair; the plink makes her jump; the refill puts her back on the glass
  const lift = track([[0, 0], [SNAP + 0.06, 0, 'linear'], [SNAP + 0.14, -0.05, 'in'], [PLINK, -0.055, 'linear'], [PLINK + 0.07, 0.07, 'out'], [PLINK + 0.17, 0, 'in']]);
  const nerves = (t) => (t > SNAP + 0.14 && t < PLINK ? Math.sin(t * 95) * 0.025 : 0); // trembling over the pit
  const amber = track([[0, 0], [SLURP, 0, 'linear'], [AHH - 0.04, 1, 'inOut'], [FULL, 0.9, 'linear'], [END - 0.04, 0, 'inOut']]);
  const eyeK = track([[0, 1], [SLURP, 1, 'linear'], [AHH, 1.7, 'inOut'], [AHH + 0.1, 0.55, 'inOut'], [GLANCE, 0.6, 'linear'], [GLANCE + 0.05, 1, 'out'], [SNAP + 0.05, 2.1, 'out'], [PLINK - 0.01, 1.8, 'linear'], [PLINK + 0.01, 0.1, 'linear'], [PLINK + 0.07, 0.15, 'linear'], [PLINK + 0.12, 1.3, 'out'], [END, 1, 'inOut']]);

  // Ezra: leans in at the hole (uh-oh), straightens and looks up after the plink (who did that?)
  const ezRot = track([[0, 0], [AHH, 0, 'linear'], [AHH + 0.18, LOOK, 'inOut'], [END - 0.2, LOOK, 'linear'], [END, 0, 'inOut']]);
  const ezPitch = track([[0, 0], [SNAP + 0.04, 0, 'linear'], [SNAP + 0.16, 0.24, 'out'], [PLINK + 0.02, 0.22, 'linear'], [PLINK + 0.14, -0.28, 'out'], [END - 0.2, -0.24, 'linear'], [END, 0, 'inOut']]);

  // the hole: drain (the light retreats from the rim into her), then refill from the drop
  const inner = track([[0, 1], [SLURP, 1, 'linear'], [AHH - 0.02, 0, 'in']]);
  const fill = track([[0, 0], [PLINK, 0, 'linear'], [FULL, 1, 'out']]);
  const sleeveK = track([[0, 0], [SLURP, 0, 'linear'], [AHH - 0.02, 1, 'linear']]);
  const arcShow = track([[0, 0], [ARRIVE - 0.12, 0, 'linear'], [ARRIVE + 0.08, 1, 'out'], [END - 0.18, 1, 'linear'], [END, 0, 'inOut']]);
  const arcR = track([[0, 0.3], [ARRIVE - 0.12, 0.3, 'linear'], [ARRIVE + 0.1, 0.62, 'out'], [END - 0.18, 0.62, 'linear'], [END, 0.42, 'inOut']]);
  const arcK = track([[0, 0.7], [SLURP, 0.7, 'linear'], [AHH - 0.1, 0.02, 'in'], [PLINK + 0.12, 0.02, 'linear'], [FULL + 0.04, 2.8, 'out'], [END, 0.8, 'inOut']]);

  // ----- go -----
  lab.playCard('a', ['m2']);
  lab.arena.emit('move', { id: 'a', n: 2, dur: ARRIVE });
  const t0 = lab.t;
  const cam = lab.camera3;
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const s = sy(t);
    const w = swell(t) / Math.sqrt(s);
    maya.set({ x: x(t), y: 1, rot: rot(t) });
    st.body = { pitch: pitch(t), roll: nerves(t), lift: lift(t), sy: s, sx: w, sz: w };
    st.amber = amber(t);
    st.eyeK = eyeK(t);
    ezra.set({ rot: ezRot(t) });
    st.ez = { pitch: ezPitch(t) };

    // the hole
    const on = t >= SLURP && t < FULL + 0.02;
    darkMesh.visible = frontMesh.visible = on;
    if (on) drawHole(inner(t), fill(t));
    // the sleeve of light pulled up into her
    const sk = sleeveK(t);
    sleeve.visible = sk > 0 && sk < 1;
    if (sleeve.visible) {
      const r = 0.46 - 0.2 * E.in(sk);
      sleeve.scale.set(r, 0.18 + 0.2 * sk, r);
      sleeve.position.y = 0.3 * E.in(sk);
      sleeveMat.opacity = Math.sin(sk * Math.PI) * 0.9;
    }
    // the drop
    const dk = (t - FALL) / (PLINK - FALL);
    streak.visible = dk > 0 && dk < 1;
    if (streak.visible) {
      const h = 3.4 * (1 - E.in(dk));
      streak.position.set(landAt.x, h, landAt.z);
      streak.rotation.y = Math.atan2(cam.position.x - landAt.x, cam.position.z - landAt.z);
      streak.scale.set(1, 0.6 + 1.2 * dk, 1); // stretches as it speeds up
      head.position.set(landAt.x, h + 0.04, landAt.z);
    }
    head.visible = streak.visible;
    // the ripple runs round her ring, both ways, to meet at the back
    const rk = (t - PLINK) / 0.34;
    ripMat.opacity = rk > 0 && rk < 1 ? Math.sin(Math.min(1, rk * 4) * Math.PI * 0.5) * (1 - rk) : 0;
    if (rk > 0 && rk < 1) {
      const base = -Math.PI / 2; // the ring's angle of the camera side (RingGeometry angles run counterclockwise seen from above)
      const a = E.out(rk) * Math.PI;
      rips[0].rotation.set(-Math.PI / 2, 0, base + a);
      rips[1].rotation.set(-Math.PI / 2, 0, base - a);
    }
    // the arcs
    const a = arcShow(t);
    arcs.scale.setScalar(arcR(t));
    for (const m of arcMats) {
      m.opacity = a;
      m.color.copy(hdr(PALETTE.energy, arcK(t)));
    }
  });

  lab.at(SLURP, () => {
    lab.arena.emit('energy', { id: 'a', n: 1 });
    lab.arena.emit('slurp');
  });
  lab.at(PLINK, () => {
    lab.arena.emit('plink');
    lab.ring(landAt, '#ffe2b8', 0.16, 0.014, 0.3);
    lab.particles(landAt.clone().setY(0.02), ['#ffe2b8', PALETTE.energy], 5, { speed: 0.6, up: 1.0, gravity: 6, size: 0.03, dur: 0.35 });
  });

  await lab.wait(END);
  stop();
  darkMesh.visible = frontMesh.visible = sleeve.visible = streak.visible = head.visible = false;
  ripMat.opacity = 0;
  actBody(maya.model, {});
  actBody(ezra.model, {});
  restore();
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
