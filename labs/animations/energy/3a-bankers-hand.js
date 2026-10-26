// Energy, idea 32 "The banker's hand", animator a (weight & physical comedy).
export const meta = {
  title: "The banker's toss",
  idea:
    'Maya settles on the battery and turns to look at us. A cube of amber glass is lobbed in from our side of the screen, huge and soft as if it had just left a hand on the sofa. It drops onto the glass in front of her like a thrown die: clack, it rocks onto a face, clack, then skids across the glass on its own reflection and bumps into her. She rocks back, it melts in, her eye warms to amber. In the cardboard game someone hands you an energy cube; here one of us does.',
  notes:
    'Sound: a soft whoosh as it passes the camera, two glass clacks (die on a table), a dry glass skid, a bump and a warm swallow. One time in four (FUMBLE, or ?fumble) the hand fumbles: the cube clips her nose with a tink and pinwheels off, she flinches, it plops into the battery\'s glow beside her and sinks into the glass; a beat, then it shoots up through her from below and pops her off the glass. Port: the cube starts at a point unprojected from just below the bottom of the picture near the camera, so it works at any framing.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
let loops = 0;
const FUMBLE = false; // true to watch the fumble

/** Lean the body over the edge it leans toward, so it rocks on the glass. */
function tilt(model, pitch, roll = 0) {
  const b = model.body;
  b.rotation.set(-pitch, 0, -roll);
  const pz = pitch >= 0 ? -0.34 : 0.37;
  const px = roll >= 0 ? 0.33 : -0.33;
  const py = 0.02;
  const y1 = py * Math.cos(pitch) + pz * Math.sin(pitch);
  const z1 = -py * Math.sin(pitch) + pz * Math.cos(pitch);
  const x2 = px * Math.cos(roll) + y1 * Math.sin(roll);
  const y2 = -px * Math.sin(roll) + y1 * Math.cos(roll);
  b.position.x += px - x2;
  b.position.y += py - y2;
  b.position.z += pz - z1;
}

function glowTex(THREE) {
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
}

/** The robot's ring, pointer and pool: the parts that lie on the glass. */
function glassParts(group, model) {
  const out = [];
  group.traverse((o) => {
    if (o.isMesh && (o.material === model.ringMat || o.material === model.poolMat)) out.push({ o, y: o.position.y });
  });
  return out;
}

/** A cube of amber glass with light inside, its glow on the glass under it. */
function makeCube(lab, glow) {
  const { THREE, PALETTE } = lab;
  const amber = new THREE.Color(PALETTE.energy);
  const S = 0.3;
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  const box = new THREE.BoxGeometry(S, S, S);
  const glass = new THREE.MeshStandardMaterial({ color: amber.clone().multiplyScalar(0.55), emissive: amber, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8, envMapIntensity: 1.6 });
  const body = new THREE.Mesh(box, glass);
  const core = new THREE.Mesh(new THREE.BoxGeometry(S * 0.5, S * 0.5, S * 0.5), new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: amber.clone().multiplyScalar(2.4), transparent: true }));
  spin.add(body, core, edges);
  // out-of-focus shells: while it's close to us it is soft, like something just thrown past the lens
  const ghosts = [1.22, 1.5].map((k) => {
    const g = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.scale.setScalar(k);
    spin.add(g);
    return g;
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(halo);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: amber.clone().multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 2;
  lab.add(root);
  lab.add(pool);
  return { root, spin, body, core, edges, halo, pool, glass, ghosts, S };
}

export default async function play(lab) {
  const { THREE, PALETTE, arena } = lab;
  const fumble = FUMBLE || new URLSearchParams(location.search).has('fumble') || ++loops % 4 === 0;
  const maya = lab.puppet('a');
  const amber = new THREE.Color(PALETTE.energy);
  const red = new THREE.Color(lab.bot('a').color);
  const home = lab.pos(3, 1);
  const glow = glowTex(THREE);
  lab.cleanup(() => glow.dispose());
  const onGlass = glassParts(maya.group, maya.model);
  lab.cleanup(() => onGlass.forEach(({ o, y }) => (o.position.y = y)));
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });

  // a small ring of light on the glass (lab.ring starts too wide for a cube's clack)
  const ripple = (at, color, r0, r1, dur, peak = 2.2) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(peak), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at);
    m.renderOrder = 5;
    lab.add(m);
    lab.tween(dur, (e, k) => {
      m.scale.setScalar(r0 + (r1 - r0) * e);
      m.material.opacity = (1 - k) ** 1.5;
      if (k >= 1) m.visible = false;
    }, lab.ease.out);
  };
  const cube = makeCube(lab, glow);
  cube.root.visible = false;
  const half = cube.S / 2;

  // where it starts: just below the bottom of the picture, close to us
  const cam = lab.camera3;
  cam.updateMatrixWorld();
  const near = new THREE.Vector3(-0.15, -1.35, -1).unproject(cam);
  const far = new THREE.Vector3(-0.15, -1.35, 1).unproject(cam);
  const P0 = near.clone().add(far.clone().sub(near).normalize().multiplyScalar(2.6));
  // where it lands: on the glass a space in front of her (our side), a hair to the left
  const L = new THREE.Vector3(home.x - 0.12, half, home.z + 0.98);
  // the fumble aims a little long, at her nose
  const NOSE = new THREE.Vector3(home.x + 0.36, 0.42, home.z + 0.06);
  const aim = fumble ? NOSE : L;
  const FLIGHT = 0.52;
  const G = 17;
  const v0 = aim.clone().sub(P0).divideScalar(FLIGHT);
  v0.y += 0.5 * G * FLIGHT;
  const spinAxis = new THREE.Vector3(1, 0.35, 0.25).normalize();
  const flatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.42, 0));

  // ---- the timeline (scene seconds from the start of the move) ----
  const MOVE = 0.6;
  const TOSS = MOVE + 0.12; // it leaves the hand
  const LAND = TOSS + FLIGHT; // clack (normal) or tink on her nose (fumble)
  // normal
  const CLACK2 = LAND + 0.12;
  const BUMP = LAND + 0.4; // the skid reaches her
  const MELT = BUMP + 0.16;
  // fumble
  const PLOP = LAND + 0.36; // it lands in the battery's glow beside her
  const SUNK = PLOP + 0.12;
  const SHOOT = SUNK + 0.14; // and comes up through her
  const END = fumble ? SHOOT + 0.52 : MELT + 0.32;

  // her lean and turn: springs, kicked by what happens to her
  const st = { pitch: 0, pv: 0, roll: 0, rv: 0, turn: 0, tv: 0, sy: 1, sv: 0 };
  const kicks = new Set();
  const kickOnce = (name, fn) => {
    if (!kicks.has(name)) {
      kicks.add(name);
      fn();
    }
  };
  let paidAt = -1;
  const bounce = { from: null, v: null, t: 0, w: null }; // the fumble's free flight after the tink
  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const T = lab.t - t0;
    const k = clamp01(T / MOVE);
    const x = 1 + 2 * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const accel = T < MOVE ? (k < 0.5 ? 1 : -1) * 22 : 0;

    // ---- the cube ----
    let cubePos = null;
    if (T >= TOSS) {
      cube.root.visible = true;
      const tf = T - TOSS;
      if (tf < FLIGHT) {
        // the lob: a real parabola, tumbling, soft and big near us, crisp as it comes down
        const p = P0.clone().addScaledVector(v0, tf);
        p.y -= 0.5 * G * tf * tf;
        cube.root.position.copy(p);
        cube.spin.quaternion.setFromAxisAngle(spinAxis, 1.2 + tf * 9.5);
        if (!fumble && tf > FLIGHT - 0.12) cube.spin.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.42, 0.1)), seg(tf, FLIGHT - 0.12, FLIGHT));
        const soft = 1 - smooth(seg(tf, 0, FLIGHT * 0.7));
        cube.halo.scale.setScalar(0.55 + 0.25 * soft);
        cube.halo.material.opacity = 0.55 + 0.2 * soft;
        cube.glass.opacity = 0.8 - 0.4 * soft;
        cube.edges.material.opacity = 1 - 0.7 * soft;
        cube.ghosts.forEach((g, i) => (g.material.opacity = (i ? 0.16 : 0.3) * soft));
        cubePos = p;
      } else if (!fumble) {
        const tl = T - LAND;
        // the die: lands on an edge, slaps flat (clack), a tiny hop and a second clack, then skids
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.42, 0.1));
        let lift = 0;
        if (tl < 0.07) q.slerp(flatQ, seg(tl, 0, 0.07) ** 2);
        else if (tl < CLACK2 - LAND) {
          const r = seg(tl, 0.07, CLACK2 - LAND);
          lift = 0.05 * Math.sin(r * Math.PI);
          q.copy(flatQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18 * Math.sin(r * Math.PI), 0, 0)));
        } else q.copy(flatQ);
        // the skid: friction slows it, it spins a little on the glass and bumps into her
        const sk = seg(T, LAND + 0.02, BUMP);
        const dist = 1 - (1 - sk) ** 1.7;
        const to = new THREE.Vector3(home.x - 0.03, half, home.z + 0.4);
        const p = L.clone().lerp(to, dist);
        if (T > BUMP) {
          // into her: it melts down into the battery under her, nudged on by its last speed
          const m = seg(T, BUMP, MELT + 0.06);
          p.lerp(new THREE.Vector3(home.x, half * 0.2, home.z + 0.05), smooth(m));
          const s = 1 - smooth(seg(T, BUMP + 0.04, MELT + 0.06));
          cube.spin.scale.setScalar(Math.max(0.001, s));
          cube.core.material.color.copy(amber).multiplyScalar(2.6 + 3 * m);
        }
        p.y += lift;
        cube.root.position.copy(p);
        cube.spin.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.9 * dist));
        cube.halo.scale.setScalar(0.55 * (T > BUMP ? 1 - seg(T, BUMP, MELT + 0.06) : 1));
        cube.halo.material.opacity = 0.8;
        cube.glass.opacity = 0.82;
        cube.edges.material.opacity = 1;
        cube.ghosts.forEach((g) => (g.material.opacity = 0));
        cubePos = p;
        kickOnce('clack', () => {
          ripple(new THREE.Vector3(L.x, 0.012, L.z), PALETTE.energy, 0.12, 0.34, 0.3);
          arena.emit('bump', { id: 'a' });
        });
        if (T >= CLACK2) kickOnce('clack2', () => ripple(new THREE.Vector3(cube.root.position.x, 0.012, cube.root.position.z), PALETTE.light, 0.1, 0.24, 0.22, 1.6));
        if (T >= BUMP)
          kickOnce('bump', () => {
            st.rv -= 3.2; // she rocks back, away from us
            st.tv += 4; // and her nose swings back east
            st.sv -= 1.5;
          });
      } else {
        // the fumble: tink off her nose, pinwheel, plop into the battery's glow, sink
        if (!bounce.from) {
          bounce.from = NOSE.clone();
          bounce.v = new THREE.Vector3(0.9, 2.4, -0.25);
          bounce.w = new THREE.Vector3(0.3, 1, 0.6).normalize();
          ripple(NOSE.clone(), PALETTE.light, 0.04, 0.2, 0.18, 2.6);
          arena.emit('bump', { id: 'a' });
          st.pv -= 4.5; // she flinches: nose up
          st.sv -= 2;
        }
        const plopAt = new THREE.Vector3(home.x + 0.36, half, home.z + 0.36);
        if (T < PLOP) {
          const r = seg(T, LAND, PLOP);
          const p = bounce.from.clone().lerp(plopAt, r);
          p.y = lerp(bounce.from.y, plopAt.y, r) + 0.55 * 4 * r * (1 - r);
          cube.root.position.copy(p);
          cube.spin.quaternion.setFromAxisAngle(bounce.w, (T - LAND) * 22);
          cubePos = p;
        } else {
          // plop: it drops into the glow and sinks through the glass (the glass hides what's below)
          const r = seg(T, PLOP, SUNK);
          const p = plopAt.clone();
          p.y = half - (cube.S + 0.05) * r ** 1.6;
          cube.root.position.copy(p);
          cube.spin.quaternion.setFromAxisAngle(bounce.w, (PLOP - LAND) * 22 + r * 2);
          cube.halo.scale.setScalar(0.55 * (1 - r));
          if (r >= 1) cube.root.visible = false;
          cubePos = p;
          kickOnce('plop', () => {
            ripple(new THREE.Vector3(plopAt.x, 0.012, plopAt.z), PALETTE.energy, 0.1, 0.36, 0.34);
            arena.emit('bump', { id: 'a' });
          });
        }
        cube.halo.material.opacity = 0.8;
        cube.glass.opacity = 0.82;
        cube.edges.material.opacity = 1;
        cube.ghosts.forEach((g) => (g.material.opacity = 0));
      }
    }
    // its glow on the glass under it, stronger the closer it gets
    if (cubePos && cube.root.visible) {
      const h = Math.max(0, cubePos.y - half);
      cube.pool.position.set(cubePos.x, 0.007, cubePos.z);
      cube.pool.scale.setScalar(0.7 + h * 0.8);
      cube.pool.material.opacity = 0.9 * Math.exp(-h * 2.2) * (cube.spin.scale.x > 0.01 ? cube.spin.scale.x : 0);
    } else cube.pool.material.opacity = 0;

    // ---- Maya ----
    // she turns to watch it come (toward us), and gets turned back by the bump
    let wantTurn = -0.42 * smooth(seg(T, TOSS - 0.02, TOSS + 0.22));
    if (!fumble) wantTurn *= 1 - smooth(seg(T, BUMP, BUMP + 0.18));
    else wantTurn *= 1 - smooth(seg(T, LAND, LAND + 0.3));
    let wantPitch = 0;
    if (fumble) wantPitch = -0.12 * smooth(seg(T, LAND, LAND + 0.06)) * (1 - smooth(seg(T, PLOP - 0.05, PLOP + 0.1))) + 0.22 * smooth(seg(T, PLOP, PLOP + 0.08)) * (1 - smooth(seg(T, SHOOT - 0.04, SHOOT)));
    let lift = 0;
    if (fumble && T >= SHOOT) {
      // up through her from below: popped off the glass
      const r = T - SHOOT;
      lift = r < 0.3 ? 0.2 * Math.sin((r / 0.3) * Math.PI) ** 0.8 : 0;
      kickOnce('shoot', () => {
        st.sv += 3.5;
        lab.pillar(new THREE.Vector3(home.x, 0, home.z), PALETTE.energy, 1.4, 0.45);
        lab.ring(new THREE.Vector3(home.x, 0, home.z), PALETTE.energy, 0.5, 0.012, 0.4);
      });
      if (r >= 0.3) kickOnce('land', () => (st.sv -= 2.6));
    }
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      st.pv += (260 * (wantPitch - st.pitch) - 13 * st.pv + accel * 0.11) * h;
      st.pitch += st.pv * h;
      st.rv += (200 * (0 - st.roll) - 9 * st.rv) * h;
      st.roll += st.rv * h;
      st.tv += (140 * (wantTurn - st.turn) - 14 * st.tv) * h;
      st.turn += st.tv * h;
      st.sv += (320 * (1 - st.sy) - 12 * st.sv) * h;
      st.sy += st.sv * h;
    }
    const sxz = 1 / Math.sqrt(st.sy);
    maya.set({ x, y: 1, rot: lab.facing(1) + st.turn, lift, sy: st.sy, sx: sxz, sz: sxz });
    const paid = !fumble ? T >= BUMP + 0.08 : T >= SHOOT + 0.02;
    if (paid && paidAt < 0) {
      paidAt = lab.t;
      arena.emit('energy', { id: 'a', n: 1 });
    }
    maya.each = (m) => {
      tilt(m, st.pitch, st.roll);
      const s = 1.3 * maya.pose.sy;
      for (const { o, y } of onGlass) o.position.y = y - maya.pose.lift / s;
      if (paidAt >= 0) {
        const r = lab.t - paidAt;
        const warm = smooth(clamp01(r / 0.08)) * Math.exp(-Math.max(0, r - 0.22) * 4);
        const flare = 1 + 1.4 * Math.exp(-r * 8);
        m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(amber.clone().multiplyScalar(3.4 * flare), warm);
        // the light it carried fills her for a moment
        const fl = Math.exp(-r * 6);
        m.paint.emissive.copy(red).lerp(amber, fl);
        m.paint.emissiveIntensity = 0.16 + 0.55 * fl;
      }
    };
  });

  await lab.wait(END);
  stop();
  cube.root.visible = false;
  cube.pool.visible = false;
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
