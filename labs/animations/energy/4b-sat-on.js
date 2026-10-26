// Energy, idea 4 (the bolt hops), animator b: character acting.
export const meta = {
  title: 'Sat on',
  idea:
    'Maya parks on the battery, right on top of its bolt. The bolt squeezes out from under her like a seed from between two fingers (she gets bumped), stands up, and shakes itself off like a wet dog, indignant. Maya does a double-take down at it. It crouches, hops in a little forward flip onto her back and dives in head first: she shivers like it tickles, her eye goes amber, and she turns back pleased with herself. A fresh bolt fades back into the glass at the edge of her ring and slips under her; the arcs brighten. Ezra watches and, a beat late, copies the little shake.',
  notes:
    'Sound: a rubbery squeak as it squeezes out, a dry glass rattle for the shake, a tiny "hup", a bright plip as it dives in, then a soft rising chime as the fresh bolt fades in. ' +
    'The bolt is the board\'s own glyph (glyphs.js "bolt") extruded and lit in the battery\'s amber; the painted bolt is lifted out of the glass (the glow map is repainted for the moment, then restored). ' +
    'It stands at about 0.32 of a space, nearer her height than half of it, so it reads at TV distance.',
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

  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const bat = lab.pos(3, 1);
  const EAST = lab.facing(1);
  const LOOK = Math.atan2(2, 2);
  const BOLT_PATH = [[22.5, 6], [12.5, 22], [19.5, 22], [17.5, 34], [27.5, 17.5], [20.5, 17.5]];

  // ----- lift the painted bolt out of the glass (and put a fresh one back) -----
  const glow = lab.arena.topMat.emissiveMap;
  const cv = glow.image;
  const g = cv.getContext('2d');
  const S = cv.width / lab.arena.course.w;
  const CX = 3 * S + S / 2;
  const CY = 1 * S + S / 2;
  const saved = g.getImageData(3 * S, 1 * S, S, S);
  const paintCell = (boltAlpha) => {
    g.putImageData(saved, 3 * S, 1 * S);
    if (boltAlpha >= 1) return;
    // repaint the middle of the cell without the bolt, then blend the bolt back in by boltAlpha
    g.save();
    g.beginPath();
    g.arc(CX, CY, S * 0.25, 0, TAU);
    g.clip();
    g.globalAlpha = 1 - boltAlpha;
    g.fillStyle = 'rgb(7,8,9)';
    g.fillRect(3 * S, 1 * S, S, S);
    g.shadowColor = PALETTE.energy;
    g.shadowBlur = S * 0.12;
    g.strokeStyle = PALETTE.energy;
    g.lineWidth = S * 0.028;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(CX, CY, S * 0.3, (i / 3) * TAU + 0.25, ((i + 1) / 3) * TAU - 0.25);
      g.stroke();
    }
    g.restore();
    glow.needsUpdate = true;
  };
  const restoreCell = () => {
    g.putImageData(saved, 3 * S, 1 * S);
    glow.needsUpdate = true;
  };

  // ----- the bolt, alive: the glyph extruded, standing on its point -----
  const shape = new THREE.Shape(BOLT_PATH.map(([px, py]) => new THREE.Vector2((px - 20) / 28, (20 - py) / 28 + 0.5)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 });
  geo.translate(0, 0, -0.05);
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.5).multiplyScalar(3), transparent: true, opacity: 1 });
  const bolt = new THREE.Mesh(geo, boltMat);
  const BOLT = 0.42;
  const LEAN = 0.5; // it stands leaning back, face to the camera, looking up at her
  const boltRig = new THREE.Group(); // at the bolt's point, on the glass
  boltRig.add(bolt);
  boltRig.visible = false;
  lab.add(boltRig);
  // its light on the glass
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const gg = c.getContext('2d');
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = grad;
    gg.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const spotMat = new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(PALETTE.energy, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spotMat);
  spot.rotation.x = -Math.PI / 2;
  spot.scale.setScalar(0.5);
  lab.add(spot);
  // the fresh bolt, a glyph of light in the glass
  const freshTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const gg = c.getContext('2d');
    gg.shadowColor = PALETTE.energy;
    gg.shadowBlur = 14;
    gg.fillStyle = PALETTE.energy;
    gg.translate(64 - 22, 64 - 22);
    gg.scale(44 / 40, 44 / 40);
    gg.beginPath();
    BOLT_PATH.forEach(([px, py], i) => (i ? gg.lineTo(px, py) : gg.moveTo(px, py)));
    gg.closePath();
    gg.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const freshMat = new THREE.MeshBasicMaterial({ map: freshTex, color: hdr(0xffffff, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fresh = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * (128 / 44), 0.34 * (128 / 44)), freshMat);
  fresh.rotation.x = -Math.PI / 2;
  lab.add(fresh);

  // ----- the battery's arcs, round her -----
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
  const restore = () => {
    maya.model.ringMat.color.copy(ringBase);
    maya.model.poolMat.color.copy(poolBase);
    maya.model.body.scale.set(1, 1, 1);
    ezra.model.body.scale.set(1, 1, 1);
    restoreCell();
  };
  lab.cleanup(restore);
  const white = new THREE.Color(3.2, 3.1, 2.9);
  maya.each = (m) => {
    actBody(m, st.body);
    m.eyeMat.color.copy(white).lerp(hdr(AMBER, 4.4), st.amber).multiplyScalar(st.eyeK);
    m.ringMat.color.copy(ringBase).lerp(hdr(AMBER, 2.4), st.amber * 0.8);
    m.poolMat.color.copy(poolBase).lerp(hdr(AMBER, 1.2), st.amber * 0.8);
    m.paint.emissive.copy(RED).lerp(AMBER, st.amber * 0.45);
    m.paint.emissiveIntensity = 0.16 + st.amber * 0.6;
  };
  ezra.each = (m) => actBody(m, st.ez, 0.2, 0.2);

  // ----- timing -----
  const ARRIVE = 0.62;
  const SQUEEZE = 0.7; // the bolt starts squeezing out
  const POP = 0.86; // it pops free (she gets bumped)
  const STAND = 0.98; // stood up
  const SHAKE = 1.0;
  const CROUCH = 1.2;
  const HOP = 1.3;
  const LANDB = 1.52; // on her back
  const DIVE = 1.6; // gone into her
  const FRESH = 1.6;
  const END = 2.08;

  const x = track([[0, 1], [ARRIVE, 3, 'inOut']]);
  const drive = [[0, 0], [0.12, -0.08, 'out'], [0.45, 0, 'inOut'], [ARRIVE + 0.06, 0.2, 'out'], [ARRIVE + 0.18, -0.05, 'inOut']];
  // the bump as it squeezes out of her right side (camera side), a double-take down at it,
  // taken aback by the shake, eyes up with the hop, a ticklish shiver, turn back pleased
  const DOWN = lab.facing(1) - 0.6; // nose turned toward it (toward us)
  const rot = track([[0, EAST], [POP + 0.02, EAST, 'linear'], [POP + 0.08, EAST - 0.25, 'out'], [POP + 0.12, EAST - 0.2, 'linear'], [POP + 0.17, DOWN, 'out'], [LANDB, DOWN, 'linear'], [LANDB + 0.3, EAST + 0.05, 'inOut'], [END - 0.06, EAST, 'inOut']]);
  const pitch = track([...drive, [POP, 0, 'inOut'], [POP + 0.17, 0.36, 'out'], [SHAKE + 0.04, 0.3, 'linear'], [SHAKE + 0.1, -0.1, 'out'], [CROUCH, -0.04, 'inOut'], [HOP, 0.12, 'inOut'], [HOP + 0.14, -0.3, 'out'], [LANDB, -0.18, 'inOut'], [LANDB + 0.06, 0.1, 'out'], [DIVE + 0.1, -0.06, 'inOut'], [END, 0, 'inOut']]);
  const rollBase = track([[0, 0], [SQUEEZE, 0, 'linear'], [POP - 0.02, -0.16, 'in'], [POP + 0.05, 0.04, 'out'], [POP + 0.14, 0, 'inOut']]);
  const roll = (t) => rollBase(t) + (t > LANDB && t < LANDB + 0.26 ? Math.sin((t - LANDB) * 70) * 0.09 * (1 - (t - LANDB) / 0.26) : 0);
  const sy = track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.9, 'out'], [ARRIVE + 0.16, 1.02, 'out'], [POP, 1, 'inOut'], [POP + 0.04, 0.9, 'out'], [POP + 0.12, 1.03, 'out'], [LANDB - 0.01, 1, 'linear'], [LANDB + 0.04, 0.84, 'out'], [LANDB + 0.14, 1.06, 'out'], [DIVE + 0.04, 0.95, 'inOut'], [DIVE + 0.14, 1.04, 'out'], [END, 1, 'inOut']]);
  const amber = track([[0, 0], [DIVE - 0.03, 0, 'linear'], [DIVE + 0.03, 1, 'out'], [DIVE + 0.2, 0.85, 'linear'], [END - 0.02, 0, 'inOut']]);
  const eyeK = track([[0, 1], [POP, 1, 'linear'], [POP + 0.1, 1.7, 'out'], [SHAKE + 0.2, 1.4, 'linear'], [LANDB, 1.4, 'linear'], [LANDB + 0.03, 0.4, 'out'], [DIVE - 0.02, 0.6, 'linear'], [DIVE + 0.03, 2, 'out'], [END, 1, 'inOut']]);

  // Ezra: notices, copies the shake a beat late, leans in for the crouch, back for the hop
  const ezRot = track([[0, 0], [POP, 0, 'linear'], [POP + 0.16, LOOK, 'inOut'], [END - 0.18, LOOK, 'linear'], [END, 0, 'inOut']]);
  const ezRoll = (t) => (t > SHAKE + 0.14 && t < SHAKE + 0.32 ? Math.sin((t - SHAKE - 0.14) * 60) * 0.12 * (1 - (t - SHAKE - 0.14) / 0.18) : 0);
  const ezPitch = track([[0, 0], [CROUCH, 0, 'linear'], [HOP, 0.14, 'inOut'], [HOP + 0.12, -0.1, 'out'], [LANDB + 0.1, 0, 'inOut']]);

  // the bolt's own acting: [x, z] in spaces, lift, its tilt from lying in the glass to standing, squash, wiggle
  const P_UNDER = [3, 1.08];
  const P_OUT = [3.08, 1.8];
  const backX = 2.86; // her back (she faces east)
  const boltPose = (t) => {
    if (t < SQUEEZE || t >= DIVE) return null;
    if (t < POP) {
      // lying in the glass, squeezing out from under her: thin and wide, then a stretch as it frees itself
      const k = (t - SQUEEZE) / (POP - SQUEEZE);
      const e = E.in(k);
      return { x: P_UNDER[0] + (P_OUT[0] - P_UNDER[0]) * e, y: P_UNDER[1] + (P_OUT[1] - P_UNDER[1]) * e, lift: 0.004, tilt: -Math.PI / 2, sx: 1.35 - 0.5 * k, sy: 0.8 + 0.45 * k, spin: 0 };
    }
    if (t < STAND) {
      // sits up on its point with an overshoot
      const k = (t - POP) / (STAND - POP);
      return { x: P_OUT[0], y: P_OUT[1], lift: 0, tilt: -Math.PI / 2 + (Math.PI / 2 + LEAN) * E.outBack(k), sx: 1, sy: 1, spin: 0 };
    }
    if (t < CROUCH) {
      // shakes itself off like a wet dog, then turns its face up to her
      const k = (t - SHAKE) / (CROUCH - SHAKE);
      const w = k > 0 && k < 0.8 ? Math.sin((k / 0.8) * 2.5 * TAU) * (1 - (k / 0.8) * 0.6) : 0;
      const look = k > 0.8 ? E.out((k - 0.8) / 0.2) : 0;
      return { x: P_OUT[0], y: P_OUT[1], lift: 0, tilt: LEAN + 0.12 * look, sx: 1 + Math.abs(w) * 0.12, sy: 1 - Math.abs(w) * 0.08, spin: w * 0.75, roll: w * 0.3 };
    }
    if (t < HOP) {
      // crouch
      const k = E.out((t - CROUCH) / (HOP - CROUCH));
      return { x: P_OUT[0], y: P_OUT[1], lift: 0, tilt: LEAN + 0.12 - 0.3 * k, sx: 1 + 0.32 * k, sy: 1 - 0.38 * k, spin: 0 };
    }
    if (t < LANDB) {
      // the hop: a little forward flip in an arc onto her back
      const k = (t - HOP) / (LANDB - HOP);
      const bx = P_OUT[0] + (backX - P_OUT[0]) * k;
      const by = P_OUT[1] + (1.02 - P_OUT[1]) * k;
      const lift = 0.33 * k + Math.sin(k * Math.PI) * 0.55; // up and over, onto her back (0.33 high)
      const sq = k < 0.15 ? 1.25 - (k / 0.15) * 0.25 : 1;
      return { x: bx, y: by, lift, tilt: LEAN - 0.18 - E.inOut(k) * TAU, sx: 1 / Math.sqrt(sq), sy: sq, spin: 0 };
    }
    // on her back: squash, then dive in head first
    const k = (t - LANDB) / (DIVE - LANDB);
    const sq = k < 0.35 ? 1 - Math.sin((k / 0.35) * Math.PI) * 0.35 : 1;
    const dive = k > 0.35 ? E.in((k - 0.35) / 0.65) : 0;
    return { x: backX + 0.06 * dive, y: 1.02, lift: 0.33 + Math.sin(dive * Math.PI) * 0.08 - dive * 0.12, tilt: (LEAN - 0.18) * (1 - dive) - dive * Math.PI, sx: (1 / Math.sqrt(sq)) * (1 - dive * 0.9), sy: sq * (1 - dive * 0.9), spin: 0 };
  };

  // ----- go -----
  lab.playCard('a', ['m2']);
  lab.arena.emit('move', { id: 'a', n: 2, dur: ARRIVE });
  const t0 = lab.t;
  let lifted = false;
  let freshDone = false;
  const arcShow = track([[0, 0], [ARRIVE - 0.12, 0, 'linear'], [ARRIVE + 0.08, 1, 'out'], [END - 0.2, 1, 'linear'], [END, 0, 'inOut']]);
  const arcR = track([[0, 0.3], [ARRIVE - 0.12, 0.3, 'linear'], [ARRIVE + 0.1, 0.62, 'out'], [END - 0.2, 0.62, 'linear'], [END, 0.42, 'inOut']]);
  const arcK = track([[0, 0.7], [FRESH + 0.12, 0.7, 'linear'], [FRESH + 0.2, 3, 'out'], [END, 0.9, 'inOut']]);
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const s = sy(t);
    const side = 1 / Math.sqrt(s);
    maya.set({ x: x(t), y: 1, rot: rot(t) });
    st.body = { pitch: pitch(t), roll: roll(t), sy: s, sx: side, sz: side };
    st.amber = amber(t);
    st.eyeK = eyeK(t);
    ezra.set({ rot: ezRot(t) });
    st.ez = { roll: ezRoll(t), pitch: ezPitch(t) };

    // the painted bolt leaves the glass as the living one squeezes out; the fresh one fades back in
    if (!lifted && t >= SQUEEZE) {
      lifted = true;
      paintCell(0);
    }
    const b = boltPose(t);
    boltRig.visible = !!b;
    if (b) {
      const p = lab.pos(b.x, b.y);
      boltRig.position.set(p.x, b.lift, p.z);
      boltRig.rotation.set(b.tilt, b.spin ?? 0, b.roll ?? 0, 'YXZ');
      bolt.scale.set(BOLT * b.sx, BOLT * b.sy, BOLT * Math.min(b.sx, 1.2));
      spot.position.set(p.x, 0.007, p.z);
      spotMat.opacity = Math.max(0, 0.45 - b.lift * 1.2);
    } else spotMat.opacity = 0;
    // the fresh bolt: fades in at the edge of her ring, then slips under her into the glass
    const fk = (t - FRESH) / 0.2;
    const gk = (t - FRESH - 0.2) / 0.18;
    if (fk > 0) {
      const at = lab.pos(P_OUT[0] - 0.06, P_OUT[1] - 0.04).lerp(bat, E.in(Math.max(0, Math.min(1, gk))));
      fresh.position.set(at.x, 0.008, at.z);
      freshMat.opacity = Math.min(1, fk) * (gk > 0.6 ? Math.max(0, 1 - (gk - 0.6) / 0.4) : 1);
      if (gk > 0.5 && !freshDone) {
        freshDone = true;
        restoreCell();
      }
    }
    const a = arcShow(t);
    arcs.scale.setScalar(arcR(t));
    for (const m of arcMats) {
      m.opacity = a;
      m.color.copy(hdr(PALETTE.energy, arcK(t)));
    }
  });

  lab.at(SQUEEZE, () => lab.arena.emit('squeak'));
  lab.at(SHAKE, () => lab.arena.emit('rattle'));
  lab.at(HOP, () => {
    lab.arena.emit('hup');
    lab.particles(lab.pos(P_OUT[0], P_OUT[1]).setY(0.05), [PALETTE.energy, '#ffffff'], 5, { speed: 0.7, up: 0.8, gravity: 4, size: 0.035, dur: 0.4 });
  });
  lab.at(SHAKE + 0.06, () => lab.particles(lab.pos(P_OUT[0], P_OUT[1]).setY(0.18), [PALETTE.energy], 7, { speed: 1.1, up: 0.5, gravity: 4, size: 0.03, dur: 0.45 }));
  lab.at(DIVE - 0.02, () => {
    lab.arena.emit('energy', { id: 'a', n: 1 });
    lab.ring(bat, PALETTE.energy, 0.5, 0.012, 0.45);
  });

  await lab.wait(END);
  stop();
  boltRig.visible = false;
  freshMat.opacity = 0;
  spotMat.opacity = 0;
  actBody(maya.model, {});
  actBody(ezra.model, {});
  restore();
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
