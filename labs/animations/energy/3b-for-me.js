// Energy, idea 3 (the banker's hand), animator b: character acting.
import { RoundedBoxGeometry } from '/looks/three/games/robo-rally/lib/rounded-box-geometry.js';

export const meta = {
  title: 'For me?',
  idea:
    'Maya parks on the battery. An amber glass cube rises into the bottom of the picture, big and soft, as if someone on the sofa just tossed it. Maya glances at it, looks away, then snaps back (a double-take), up on her toes: for me?! It arcs down and lands in front of her with a glass clack (she blinks), she leans in, it slides into her ring and melts into her; she rocks back savouring it, eye amber, and turns back proud. Ezra follows the cube with his whole body, then turns to us: where\'s mine? Nothing. Huff, back to the race.',
  notes:
    'Sound: a soft whoosh from the room side, a bright glass clack, a warm "mmm" chime as it melts in. ' +
    'Variant (one charge in four in the live stage, or ?variant=fumble): the unseen hand fumbles; the cube clips her nose (she flinches), tumbles onto the glass, sinks into the battery\'s glow and shoots up into her from below; she jumps like she\'s been goosed, and Ezra chuckles. ' +
    'Port: the cube starts at a point fixed to the camera (below the bottom of the picture, 1.6 units out), so it always comes from our side of the screen.',
};

let runs = 0;

export default async function play(lab) {
  const { THREE, PALETTE } = lab;
  const q = new URLSearchParams(location.search);
  const run = runs++;
  const fumble = q.get('variant') === 'fumble' || (!lab.capture && run % 4 === 3);

  const AMBER = new THREE.Color(1.0, 0.62, 0.22);
  const RED = new THREE.Color(lab.bot('a').color);
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const E = lab.ease;
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
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const bat = lab.pos(3, 1);
  const EAST = lab.facing(1);
  const RECV = lab.facing(2) + 0.18; // nose to the cube, nearly toward us
  const LOOK = Math.atan2(2, 2);
  const TO_US = 2.25; // Ezra turned toward the room (south-west)

  // ----- the cube: amber glass with bright edges and a light inside -----
  const SIZE = 0.33;
  const cube = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffb04a, emissive: 0xff9a2e, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.7, depthWrite: false });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 3, 0.12), glassMat);
  const edgeMat = new THREE.LineBasicMaterial({ color: hdr(PALETTE.energy, 2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), edgeMat);
  const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: hdr(AMBER, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(1.3);
  cube.add(body, edges, core);
  cube.scale.setScalar(SIZE);
  cube.visible = false;
  lab.add(cube);
  // out of focus near the camera: a big soft halo that tightens as it lands
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: hdr(AMBER, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const halo = new THREE.Sprite(haloMat);
  lab.add(halo);
  // its reflection / light on the glass
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(AMBER, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat);
  pool.rotation.x = -Math.PI / 2;
  lab.add(pool);

  // where it comes from: below the bottom of the picture, on our side of the screen
  const cam = lab.camera3;
  cam.updateMatrixWorld();
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const P0 = cam.position.clone().addScaledVector(fwd, 1.6).addScaledVector(camUp, -0.78).addScaledVector(camRight, -0.25);
  const land = lab.pos(3, fumble ? 1.38 : 1.64).setY(SIZE / 2);
  const P1 = P0.clone().lerp(land, 0.55).add(new THREE.Vector3(0, 0.9, 0));
  const bez = (a, b, c, k) => a.clone().multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * k * (1 - k)).addScaledVector(c, k * k);

  // ----- her light -----
  const st = { body: {}, ez: {}, amber: 0, eyeK: 1 };
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
    m.eyeMat.color.copy(white).lerp(hdr(AMBER, 4.4), st.amber).multiplyScalar(st.eyeK);
    m.ringMat.color.copy(ringBase).lerp(hdr(AMBER, 2.4), st.amber * 0.8);
    m.poolMat.color.copy(poolBase).lerp(hdr(AMBER, 1.2), st.amber * 0.8);
    m.paint.emissive.copy(RED).lerp(AMBER, st.amber * 0.55);
    m.paint.emissiveIntensity = 0.16 + st.amber * 0.75;
  };
  ezra.each = (m) => actBody(m, st.ez, 0.2, 0.2);

  // ----- timing -----
  const ARRIVE = 0.62;
  const TOSS = 0.66; // the cube rises into the picture
  const LAND = fumble ? 1.06 : 1.12; // clack (in the fumble: it clips her nose)
  const x = track([[0, 1], [ARRIVE, 3, 'inOut']]);
  const drive = [[0, 0], [0.12, -0.08, 'out'], [0.45, 0, 'inOut'], [ARRIVE + 0.06, 0.2, 'out'], [ARRIVE + 0.18, -0.05, 'inOut']];

  let END;
  let rot, pitch, sy, lift, amber, eyeK, roll, ezRot, ezPitch, ezLift, cubeAt;
  if (!fumble) {
    const SLIDE = LAND + 0.12;
    const MELT = LAND + 0.3;
    const GONE = MELT + 0.14;
    const TURN = GONE + 0.06;
    END = TURN + 0.32;
    // glance, look away, SNAP back (the double-take), up on her toes, blink at the clack, lean in, savour, turn back proud
    rot = track([[0, EAST], [0.7, EAST, 'linear'], [0.76, EAST - 0.55, 'out'], [0.8, EAST - 0.55, 'linear'], [0.86, EAST - 0.05, 'inOut'], [0.9, EAST - 0.05, 'linear'], [0.96, RECV - 0.12, 'out'], [1.02, RECV, 'inOut'], [TURN, RECV, 'linear'], [END - 0.06, EAST + 0.06, 'inOut'], [END, EAST, 'inOut']]);
    pitch = track([...drive, [0.9, 0, 'inOut'], [0.98, -0.2, 'out'], [LAND - 0.04, 0.06, 'inOut'], [LAND + 0.03, -0.14, 'out'], [SLIDE + 0.06, 0.26, 'inOut'], [MELT, 0.22, 'linear'], [MELT + 0.1, -0.24, 'out'], [TURN + 0.1, 0.02, 'inOut'], [END - 0.12, -0.08, 'inOut'], [END, 0, 'inOut']]);
    sy = track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.9, 'out'], [ARRIVE + 0.16, 1.02, 'out'], [0.9, 1, 'inOut'], [0.94, 0.88, 'out'], [1.0, 1.16, 'out'], [LAND - 0.02, 1.1, 'linear'], [LAND + 0.03, 0.86, 'out'], [LAND + 0.12, 1, 'out'], [MELT + 0.06, 1, 'linear'], [MELT + 0.12, 1.1, 'out'], [MELT + 0.24, 0.95, 'inOut'], [END, 1, 'inOut']]);
    lift = track([[0, 0], [0.94, 0, 'linear'], [1.0, 0.06, 'out'], [LAND - 0.04, 0.04, 'linear'], [LAND + 0.02, 0, 'in']]);
    roll = (t) => (t > GONE && t < TURN + 0.06 ? Math.sin((t - GONE) * 38) * 0.12 * (1 - (t - GONE) / (TURN + 0.06 - GONE)) : 0);
    amber = track([[0, 0], [MELT + 0.02, 0, 'linear'], [GONE, 1, 'out'], [TURN + 0.1, 0.9, 'linear'], [END, 0, 'inOut']]);
    eyeK = track([[0, 1], [0.92, 1, 'linear'], [0.98, 1.8, 'out'], [LAND - 0.005, 1.6, 'linear'], [LAND + 0.01, 0.08, 'linear'], [LAND + 0.08, 0.1, 'linear'], [LAND + 0.13, 1.4, 'out'], [GONE, 1.8, 'out'], [END, 1, 'inOut']]);
    // Ezra follows the cube with his whole body, turns to us (where's mine?), then huffs back
    ezRot = track([[0, 0], [0.82, 0, 'linear'], [LAND + 0.04, LOOK, 'inOut'], [MELT + 0.04, LOOK, 'linear'], [MELT + 0.2, TO_US, 'inOut'], [END - 0.2, TO_US, 'linear'], [END - 0.03, -0.12, 'in'], [END, 0, 'out']]);
    ezPitch = track([[0, 0], [MELT + 0.12, 0, 'linear'], [MELT + 0.22, 0.14, 'out'], [END - 0.2, 0.12, 'linear'], [END - 0.08, -0.08, 'inOut'], [END, 0, 'inOut']]);
    ezLift = (t) => (t > MELT + 0.24 && t < END - 0.22 ? Math.abs(Math.sin((t - MELT - 0.24) * 22)) * 0.025 : 0); // a hopeful little bounce
    // the cube: flight, clack and a small bounce, slide into her ring, melt into her
    const slideTo = lab.pos(3, 1.3).setY(SIZE / 2);
    const into = lab.pos(3, 1.1).setY(0.2);
    cubeAt = (t) => {
      if (t < TOSS) return null;
      if (t < LAND) {
        const k = (t - TOSS) / (LAND - TOSS);
        const p = bez(P0, P1, land, k);
        return { p, s: 1.12 - 0.12 * k, spin: (1 - k) * 4.2, soft: (1 - k) ** 1.5, o: 1 };
      }
      if (t < SLIDE) {
        const k = (t - LAND) / (SLIDE - LAND);
        return { p: land.clone().setY(SIZE / 2 + Math.sin(k * Math.PI) * 0.06), s: 1 + Math.sin(k * Math.PI) * 0.04, spin: 0, soft: 0, o: 1 };
      }
      if (t < MELT) {
        const k = E.inOut((t - SLIDE) / (MELT - SLIDE));
        return { p: land.clone().lerp(slideTo, k), s: 1, spin: 0, soft: 0, o: 1, yaw: k * 0.4 };
      }
      if (t < GONE) {
        const k = (t - MELT) / (GONE - MELT);
        return { p: slideTo.clone().lerp(into, E.in(k)), s: 1 - E.in(k) * 0.85, spin: 0, soft: 0, o: 1 - k, yaw: 0.4, melt: k };
      }
      return null;
    };
  } else {
    // the fumble: it clips her nose, tumbles onto the glass, sinks into the battery glow and shoots up into her
    const BOUNCE = LAND + 0.22; // it hits the glass beside her
    const SINK = BOUNCE + 0.12;
    const GOOSE = SINK + 0.16; // it shoots up into her
    const TURN = GOOSE + 0.34;
    END = TURN + 0.26;
    rot = track([[0, EAST], [0.7, EAST, 'linear'], [0.76, EAST - 0.55, 'out'], [0.8, EAST - 0.55, 'linear'], [0.86, EAST - 0.05, 'inOut'], [0.9, EAST - 0.05, 'linear'], [0.96, RECV - 0.12, 'out'], [1.02, RECV, 'inOut'], [LAND, RECV, 'linear'], [LAND + 0.08, RECV + 0.35, 'out'], [BOUNCE, RECV + 0.5, 'inOut'], [GOOSE, RECV + 0.2, 'inOut'], [TURN, RECV + 0.2, 'linear'], [END, EAST, 'inOut']]);
    pitch = track([...drive, [0.9, 0, 'inOut'], [0.98, -0.2, 'out'], [LAND - 0.02, -0.1, 'inOut'], [LAND + 0.05, -0.42, 'out'], [BOUNCE, 0.24, 'inOut'], [SINK + 0.1, 0.34, 'inOut'], [GOOSE, 0.3, 'linear'], [GOOSE + 0.08, -0.16, 'out'], [TURN, 0, 'inOut'], [END, 0, 'linear']]);
    lift = track([[0, 0], [0.94, 0, 'linear'], [1.0, 0.06, 'out'], [LAND - 0.02, 0.04, 'linear'], [LAND + 0.04, 0, 'in'], [GOOSE, 0, 'linear'], [GOOSE + 0.11, 0.36, 'out'], [GOOSE + 0.24, 0, 'in'], [END, 0, 'linear']]);
    sy = track([[0, 1], [ARRIVE, 1, 'linear'], [ARRIVE + 0.05, 0.9, 'out'], [ARRIVE + 0.16, 1.02, 'out'], [0.9, 1, 'inOut'], [0.94, 0.88, 'out'], [1.0, 1.16, 'out'], [LAND, 1.1, 'linear'], [LAND + 0.04, 0.84, 'out'], [LAND + 0.14, 1, 'out'], [GOOSE, 1, 'linear'], [GOOSE + 0.04, 1.42, 'out'], [GOOSE + 0.2, 1.12, 'linear'], [GOOSE + 0.24, 0.72, 'in'], [GOOSE + 0.34, 1.04, 'out'], [END, 1, 'inOut']]);
    roll = (t) => (t > TURN - 0.06 && t < END ? Math.sin((t - TURN + 0.06) * 34) * 0.14 * (1 - (t - TURN + 0.06) / (END - TURN + 0.06)) : 0);
    amber = track([[0, 0], [GOOSE, 0, 'linear'], [GOOSE + 0.04, 1, 'out'], [TURN, 0.9, 'linear'], [END, 0, 'inOut']]);
    eyeK = track([[0, 1], [0.92, 1, 'linear'], [0.98, 1.8, 'out'], [LAND - 0.005, 1.6, 'linear'], [LAND + 0.01, 0.06, 'linear'], [LAND + 0.1, 0.1, 'linear'], [LAND + 0.16, 1.2, 'out'], [GOOSE, 1.1, 'linear'], [GOOSE + 0.03, 2.4, 'out'], [END, 1, 'inOut']]);
    ezRot = track([[0, 0], [0.82, 0, 'linear'], [LAND + 0.04, LOOK, 'inOut'], [TURN, LOOK, 'linear'], [END, 0, 'inOut']]);
    ezPitch = track([[0, 0], [LAND, 0, 'linear'], [LAND + 0.06, -0.18, 'out'], [LAND + 0.24, 0, 'inOut'], [GOOSE + 0.06, 0, 'linear'], [GOOSE + 0.12, -0.14, 'out'], [END - 0.08, -0.1, 'linear'], [END, 0, 'inOut']]);
    ezLift = (t) => (t > GOOSE + 0.1 && t < END - 0.08 ? Math.abs(Math.sin((t - GOOSE - 0.1) * 28)) * 0.03 : 0); // a chuckle
    const bounceAt = lab.pos(3.55, 1.5).setY(SIZE / 2);
    const nose = land.clone();
    cubeAt = (t) => {
      if (t < TOSS) return null;
      if (t < LAND) {
        const k = (t - TOSS) / (LAND - TOSS);
        return { p: bez(P0, P1, nose, k), s: 1.12 - 0.12 * k, spin: (1 - k) * 4.2, soft: (1 - k) ** 1.5, o: 1 };
      }
      if (t < BOUNCE) {
        const k = (t - LAND) / (BOUNCE - LAND);
        const p = nose.clone().lerp(bounceAt, k);
        p.y = nose.y + 0.3 * Math.sin(k * Math.PI) + (bounceAt.y - nose.y) * k;
        return { p, s: 1, spin: k * 2.6, tumble: k * 3.4, soft: 0, o: 1 };
      }
      if (t < SINK) {
        const k = (t - BOUNCE) / (SINK - BOUNCE);
        return { p: bounceAt.clone().setY(SIZE / 2 - E.in(k) * SIZE), s: 1 - k * 0.3, spin: 0, soft: 0, o: 1 - k * 0.7, sink: k };
      }
      return null;
    };
  }

  // ----- go -----
  lab.playCard('a', ['m2']);
  lab.arena.emit('move', { id: 'a', n: 2, dur: ARRIVE });
  const t0 = lab.t;
  const under = new THREE.Vector3();
  const stop = lab.every(() => {
    const t = lab.t - t0;
    const s = sy(t);
    const side = 1 / Math.sqrt(s);
    maya.set({ x: x(t), y: 1, rot: rot(t) });
    st.body = { pitch: pitch(t), roll: roll(t), lift: lift(t), sy: s, sx: side, sz: side };
    st.amber = amber(t);
    st.eyeK = eyeK(t);
    ezra.set({ rot: ezRot(t) });
    st.ez = { pitch: ezPitch(t), lift: ezLift(t) };

    const c = cubeAt(t);
    cube.visible = !!c;
    halo.visible = !!c && c.soft > 0.02;
    if (c) {
      cube.position.copy(c.p);
      cube.scale.setScalar(SIZE * c.s);
      cube.rotation.set(c.spin * 0.7 + (c.tumble ?? 0), (c.yaw ?? 0) + c.spin, c.spin * 0.4);
      glassMat.opacity = 0.72 * c.o;
      edgeMat.opacity = 0.9 * c.o * (1 - c.soft * 0.8);
      coreMat.opacity = c.o;
      glassMat.emissiveIntensity = 0.55 + (c.melt ?? 0) * 2;
      // soft and big near the lens
      halo.position.copy(c.p);
      halo.scale.setScalar(SIZE * c.s * (1.4 + c.soft * 2.4));
      haloMat.opacity = c.soft * 0.8;
      // its light and reflection on the glass, growing as it comes down
      const h = Math.max(0, c.p.y - SIZE / 2);
      pool.position.set(c.p.x, 0.007, c.p.z);
      const pk = Math.max(0, 1 - h / 0.9);
      pool.scale.setScalar(0.42 + h * 0.4);
      poolMat.opacity = pk * 0.75 * c.o;
    } else poolMat.opacity = 0;
    // fumble: the glow it sank into slides under her, then shoots up
    if (fumble) {
      const SINKEND = LAND + 0.22 + 0.12;
      const k = (t - SINKEND) / 0.16;
      if (k > 0 && k < 1.25) {
        under.copy(lab.pos(3.55, 1.5)).lerp(bat, E.inOut(Math.min(1, k)));
        pool.position.set(under.x, 0.007, under.z);
        pool.scale.setScalar(0.6 + Math.sin(Math.min(1, k) * Math.PI) * 0.2);
        poolMat.opacity = k < 1 ? 0.9 : 0.9 * (1 - (k - 1) / 0.25);
      }
    }
  });

  lab.at(TOSS, () => lab.arena.emit('whoosh'));
  lab.at(LAND, () => {
    lab.arena.emit('clack');
    if (!fumble) lab.ring(land.clone().setY(0), PALETTE.light, 0.32, 0.012, 0.3);
    else lab.ring(land.clone().setY(0.25), PALETTE.energy, 0.22, 0.25, 0.25);
  });
  if (fumble) {
    lab.at(LAND + 0.22, () => lab.ring(lab.pos(3.55, 1.5), PALETTE.light, 0.28, 0.012, 0.3));
    lab.at(LAND + 0.22 + 0.12 + 0.16, () => {
      lab.arena.emit('energy', { id: 'a', n: 1 });
      lab.pillar(bat, PALETTE.energy, 0.9, 0.35);
      lab.ring(bat, PALETTE.energy, 0.5, 0.012, 0.4);
    });
  } else {
    lab.at(LAND + 0.3 + 0.14, () => {
      lab.arena.emit('energy', { id: 'a', n: 1 });
      lab.motes(bat, PALETTE.energy, 6, 0.8);
    });
  }

  await lab.wait(END);
  stop();
  cube.visible = halo.visible = false;
  poolMat.opacity = 0;
  actBody(maya.model, {});
  actBody(ezra.model, {});
  restore();
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
