// Energy, idea 1 (vending machine), animator b: character acting.
export const meta = {
  title: 'Thump it',
  idea:
    'Maya parks on the battery and waits, perky, for her energy. Nothing. She tips her nose down to peer at it, crouches, rises right up on her toes and THUMPS the glass flat. The battery\'s arcs stutter like a stuck machine, then it coughs: a ring of amber is swallowed up her body like a gulp (she bulges as it passes), her eye flares amber with a clunk and she gives a smug little wiggle. Ezra watches the whole thing, flinches at the thump and nods at the payout. Accurate to the rules (energy is paid at the end of the register), and everyone has thumped a vending machine.',
  notes:
    'Sound: a hopeful tick as she parks, then silence (the joke), a dull glass thump, a buzzing relay stutter, a "glonk" and a rising glass gulp. ' +
    'Variant (one charge in four in the live stage, or ?variant=early): it pays out the instant she starts to rise; she is caught hanging in mid-lift, then sinks back down sheepishly, glancing away, while Ezra chuckles. ' +
    'Acting is done on the body (it rocks on its nose or tail, squashes from the glass up) so the ring of light stays flat on the glass. ' +
    'Port: the arcs are drawn round the robot (r 0.62) because the painted ones are hidden under her body.',
};

let runs = 0;

export default async function play(lab) {
  const { THREE, PALETTE } = lab;
  const q = new URLSearchParams(location.search);
  const run = runs++;
  const early = q.get('variant') === 'early' || (!lab.capture && run % 4 === 3);

  const AMBER = new THREE.Color(1.0, 0.62, 0.22);
  const RED = new THREE.Color(lab.bot('a').color);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const E = lab.ease;
  // keyframe tracks: [[t, value, ease]] (the ease shapes the segment that ends at that key)
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
  // body acting: lift, pitch (rocks on its nose or tail), roll (on a side), squash from the glass up.
  // The ring and pool stay flat on the glass.
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
  const LOOK = Math.atan2(2, 2) * 0.85; // Ezra's tip turned toward Maya

  // ----- the battery's arcs, drawn round her (the painted ones are under her body) -----
  const arcs = new THREE.Group();
  arcs.position.set(bat.x, 0.009, bat.z);
  const arcMats = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: hdr(PALETTE.energy, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48, 1, -((i + 1) / 3) * Math.PI * 2 + 0.3, (Math.PI * 2) / 3 - 0.6), m);
    a.rotation.x = -Math.PI / 2;
    arcs.add(a);
    arcMats.push(m);
  }
  lab.add(arcs);

  // ----- the gulp: a ring of amber swallowed up her body -----
  const gulp = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 10, 48), new THREE.MeshBasicMaterial({ color: hdr(AMBER, 3.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  gulp.rotation.x = -Math.PI / 2;
  gulp.visible = false;
  lab.add(gulp);

  // ----- her light: eye, ring and pool warm to amber -----
  const st = { eye: 0, eyeK: 1, ring: 0, glow: 0, body: {}, ez: {} };
  const ringBase = maya.model.ringMat.color.clone();
  const poolBase = maya.model.poolMat.color.clone();
  const restore = () => {
    maya.model.ringMat.color.copy(ringBase);
    maya.model.poolMat.color.copy(poolBase);
    maya.model.body.scale.set(1, 1, 1);
    ezra.model.body.scale.set(1, 1, 1);
  };
  lab.cleanup(restore);
  const white = new THREE.Color(3.2, 3.1, 2.9);
  maya.each = (m) => {
    actBody(m, st.body);
    m.eyeMat.color.copy(white).lerp(hdr(AMBER, 4.2), st.eye).multiplyScalar(st.eyeK);
    m.ringMat.color.copy(ringBase).lerp(hdr(AMBER, 2.2), st.ring);
    m.poolMat.color.copy(poolBase).lerp(hdr(AMBER, 1.1), st.ring);
    m.paint.emissive.copy(RED).lerp(AMBER, st.glow * 0.6);
    m.paint.emissiveIntensity = 0.16 + st.glow * 0.9;
  };
  ezra.each = (m) => actBody(m, st.ez, 0.2, 0.2);

  // ----- timing (scene seconds from the start of the moment) -----
  const ARRIVE = 0.62;
  const LOOKDN = 0.95; // she tips her nose down to look
  const RISE = 1.15; // crouch, then up on her toes
  const TOP = 1.34;
  const HIT = 1.44; // the thump lands
  const COUGH = 1.7; // the battery coughs (after a held breath)
  const PAY = early ? RISE + 0.12 : COUGH + 0.2; // the gulp reaches her eye
  const GULP = PAY - 0.2; // the gulp starts rising
  const END = early ? 2.22 : 2.32;

  const x = track([[0, 1], [ARRIVE, 3, 'inOut']]);
  // arrival: lean back on the launch, nose dips on the brake, rocks back, settles
  const drive = [[0, 0], [0.12, -0.08, 'out'], [0.45, 0, 'inOut'], [ARRIVE + 0.06, 0.22, 'out'], [ARRIVE + 0.2, -0.1, 'inOut'], [ARRIVE + 0.3, -0.06, 'inOut']];
  const pitch = early
    ? track([...drive, [LOOKDN, -0.08, 'linear'], [LOOKDN + 0.12, 0.5, 'out'], [RISE, 0.46, 'linear'], [PAY, -0.1, 'out'], [PAY + 0.3, -0.1, 'linear'], [PAY + 0.62, 0.14, 'inOut'], [END - 0.12, 0.12, 'linear'], [END, 0, 'inOut']])
    : track([...drive, [LOOKDN, -0.08, 'linear'], [LOOKDN + 0.12, 0.5, 'out'], [RISE, 0.46, 'linear'], [RISE + 0.07, 0.2, 'inOut'], [TOP, -0.12, 'out'], [HIT - 0.02, -0.02, 'in'], [HIT, 0, 'linear'], [HIT + 0.14, 0.24, 'out'], [COUGH, 0.2, 'linear'], [GULP, 0.12, 'inOut'], [PAY + 0.02, -0.26, 'out'], [PAY + 0.18, 0.06, 'inOut'], [END, 0, 'inOut']]);
  const lift = early
    ? track([[0, 0], [RISE + 0.07, 0, 'linear'], [PAY, 0.17, 'out'], [PAY + 0.3, 0.18, 'linear'], [PAY + 0.66, 0, 'inOut3'], [END, 0, 'linear']])
    : track([[0, 0], [RISE + 0.07, 0, 'linear'], [TOP, 0.3, 'out'], [TOP + 0.05, 0.31, 'linear'], [HIT, 0, 'in'], [PAY - 0.02, 0, 'linear'], [PAY + 0.05, 0.09, 'out'], [PAY + 0.16, 0, 'in'], [END, 0, 'linear']]);
  const sy = early
    ? track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.88, 'out'], [ARRIVE + 0.18, 1.04, 'out'], [ARRIVE + 0.3, 1, 'inOut'], [RISE, 1, 'linear'], [RISE + 0.07, 0.8, 'out'], [PAY, 1.2, 'out'], [PAY + 0.06, 1.26, 'out'], [PAY + 0.3, 1.18, 'linear'], [PAY + 0.66, 0.86, 'inOut'], [END - 0.1, 0.95, 'out'], [END, 1, 'inOut']])
    : track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.88, 'out'], [ARRIVE + 0.18, 1.04, 'out'], [ARRIVE + 0.3, 1, 'inOut'], [RISE, 1, 'linear'], [RISE + 0.07, 0.8, 'out'], [TOP - 0.06, 1.28, 'out'], [TOP + 0.05, 1.22, 'linear'], [HIT - 0.01, 1.3, 'in'], [HIT, 0.56, 'linear'], [HIT + 0.07, 0.6, 'linear'], [HIT + 0.2, 1.08, 'out'], [HIT + 0.3, 1, 'inOut'], [GULP, 1, 'linear'], [PAY, 1.06, 'linear'], [PAY + 0.05, 1.2, 'out'], [PAY + 0.17, 0.9, 'inOut'], [PAY + 0.3, 1.03, 'inOut'], [END, 1, 'inOut']]);
  // a smug wiggle after the payout
  const roll = (t) => (early || t < PAY + 0.1 ? 0 : Math.sin((t - PAY - 0.1) * 30) * 0.22 * Math.max(0, 1 - (t - PAY - 0.1) / 0.3));
  // in the early variant she glances away from Ezra, embarrassed
  const rot = early ? track([[0, EAST], [PAY + 0.3, EAST, 'linear'], [PAY + 0.48, EAST + 0.45, 'inOut'], [END - 0.14, EAST + 0.38, 'linear'], [END, EAST, 'inOut']]) : () => EAST;
  const eye = track([[0, 0], [PAY - 0.01, 0, 'linear'], [PAY + 0.03, 1, 'out'], [PAY + 0.25, 0.85, 'linear'], [END - 0.02, 0, 'inOut']]);
  // eye: brightens hopefully on arrival, squeezes shut at the thump, flares at the payout
  const eyeK = early
    ? track([[0, 1], [ARRIVE + 0.1, 1, 'linear'], [ARRIVE + 0.2, 1.45, 'out'], [LOOKDN, 1.35, 'linear'], [LOOKDN + 0.1, 1, 'out'], [PAY - 0.01, 1, 'linear'], [PAY + 0.03, 1.8, 'out'], [PAY + 0.4, 0.6, 'inOut'], [END, 1, 'inOut']])
    : track([[0, 1], [ARRIVE + 0.1, 1, 'linear'], [ARRIVE + 0.2, 1.45, 'out'], [LOOKDN, 1.35, 'linear'], [LOOKDN + 0.1, 1, 'out'], [TOP, 1, 'linear'], [HIT, 0.2, 'in'], [HIT + 0.12, 0.25, 'linear'], [HIT + 0.22, 1, 'out'], [PAY - 0.01, 1, 'linear'], [PAY + 0.03, 1.9, 'out'], [END, 1, 'inOut']]);
  const glow = track([[0, 0], [PAY - 0.01, 0, 'linear'], [PAY + 0.03, 1, 'out'], [END, 0, 'inOut']]);

  // the arcs: peek out from under her as she parks, sit at a low glow, stutter after the thump, cough
  const stutter = [1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0];
  const arcLight = (t) => {
    const show = track([[0, 0], [ARRIVE - 0.12, 0, 'linear'], [ARRIVE + 0.08, 1, 'out'], [END - 0.18, 1, 'linear'], [END, 0, 'inOut']])(t); // tuck back under her at the end
    let k = 0.7 + Math.sin(t * 5) * 0.1; // the battery's usual low glow
    if (!early && t >= HIT + 0.02 && t < COUGH - 0.1) {
      const i = Math.floor((t - HIT - 0.02) * 30);
      k = stutter[i % stutter.length] ? 3.2 : 0.05;
    }
    if (!early && t >= COUGH - 0.1 && t < GULP) k = 0.04; // a held breath: dark
    if (t >= GULP && t < PAY + 0.3) {
      const c = (t - GULP) / (PAY + 0.3 - GULP);
      k = 0.7 + 3.6 * (1 - c) ** 2;
    }
    return { show, k };
  };
  const arcR = (t) => {
    const r = track([[0, 0.3], [ARRIVE - 0.12, 0.3, 'linear'], [ARRIVE + 0.1, 0.62, 'out'], [END - 0.18, 0.62, 'linear'], [END, 0.42, 'inOut']])(t);
    const cough = t >= GULP && t < GULP + 0.2 ? Math.sin(((t - GULP) / 0.2) * Math.PI) * -0.08 : 0; // it draws in
    const thump = !early && t >= HIT && t < HIT + 0.22 ? Math.sin(((t - HIT) / 0.22) * Math.PI) * 0.07 : 0;
    return r + cough + thump;
  };

  // Ezra: watches her park, flinches at the thump, nods (or chuckles) at the payout, looks back
  const ezRot = track([[0, 0], [0.68, 0, 'linear'], [0.95, LOOK, 'inOut'], [END - 0.2, LOOK, 'linear'], [END, 0, 'inOut']]);
  const ezPitch = early
    ? track([[0, 0], [PAY + 0.32, 0, 'linear'], [PAY + 0.4, -0.16, 'out'], [END - 0.16, -0.12, 'linear'], [END, 0, 'inOut']])
    : track([[0, 0], [HIT, 0, 'linear'], [HIT + 0.05, -0.26, 'out'], [HIT + 0.26, 0, 'inOut'], [PAY + 0.04, 0, 'linear'], [PAY + 0.12, 0.2, 'inOut'], [PAY + 0.22, 0, 'inOut'], [END, 0, 'linear']]);
  const ezLift = (t) => {
    if (!early && t > HIT && t < HIT + 0.2) return Math.sin(((t - HIT) / 0.2) * Math.PI) * 0.07; // a startled hop
    if (early && t > PAY + 0.32 && t < END - 0.14) return Math.abs(Math.sin((t - PAY - 0.32) * 28)) * 0.03; // a chuckle
    return 0;
  };

  // ----- go -----
  lab.playCard('a', ['m2']);
  lab.arena.emit('move', { id: 'a', n: 2, dur: ARRIVE });
  const t0 = lab.t;
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const s = sy(t);
    const side = 1 / Math.sqrt(s);
    // the gulp passing up her body bulges her
    const g = (t - GULP) / (PAY - GULP);
    const bulge = g > 0 && g < 1.15 ? 1 + Math.sin(Math.min(1, g / 1.15) * Math.PI) * 0.1 : 1;
    maya.set({ x: x(t), y: 1, rot: rot(t) });
    st.body = { lift: lift(t), pitch: pitch(t), roll: roll(t), sy: s, sx: side * bulge, sz: side * bulge };
    st.eye = eye(t);
    st.eyeK = eyeK(t);
    st.ring = eye(t) * 0.9;
    st.glow = glow(t);
    ezra.set({ rot: ezRot(t) });
    st.ez = { pitch: ezPitch(t), lift: ezLift(t) };
    const a = arcLight(t);
    arcs.scale.setScalar(arcR(t));
    for (const m of arcMats) {
      m.opacity = a.show;
      m.color.copy(hdr(PALETTE.energy, a.k));
    }
    // the gulp: a ring rising from the glass up through her, narrowing with her shape, into her eye
    gulp.visible = g > 0 && g < 1;
    if (gulp.visible) {
      const h = E.in(g);
      gulp.position.set(bat.x, 0.03 + h * 0.36 + lift(t), bat.z);
      gulp.scale.setScalar((0.5 - h * 0.18) * bulge + 0.08);
      gulp.material.opacity = Math.min(1, g * 6) * (1 - g * 0.5);
    }
  });

  // what the game would play a sound for, and small touches of light
  lab.at(ARRIVE, () => lab.arena.emit('energy-wait', { id: 'a' }));
  if (!early) {
    lab.at(HIT, () => {
      lab.shake(0.035, 0.22);
      lab.ring(bat, PALETTE.light, 0.6, 0.012, 0.35);
      lab.arena.emit('thump', { id: 'a' });
    });
  }
  lab.at(GULP, () => lab.arena.emit('cough', { id: 'a' }));
  lab.at(PAY, () => {
    lab.arena.emit('energy', { id: 'a', n: 1 });
    lab.motes(bat, PALETTE.energy, 6, 0.9);
  });

  await lab.wait(END);
  stop();
  st.body = {};
  st.ez = {};
  actBody(maya.model, {});
  actBody(ezra.model, {});
  restore();
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
