// Energy, idea 30 "The bolt hops", animator a (weight & physical comedy).
export const meta = {
  title: 'Squeezed out',
  idea:
    'Maya parks on the battery and sits down hard, and the bolt she was sitting on squirts out from under her like a bar of soap. It skids across the glass, stands up teetering on its point, shakes itself off like a wet dog (drops of light fly), crouches, and hops in a little arc onto her back, diving in head first. She sags under its weight, her eye warms to amber, and behind it a fresh bolt slides back under her like a drawer closing while the three arcs brighten: the battery is still there for the next robot.',
  notes:
    'Sound: a wet glass squeak as it squirts out, a tiny tick as it stands, a brisk rattle for the shake (the drops plink), a little "hup", and a soft glass gulp when it dives in. The bolt is the board\'s own icon (same outline, same amber), so it reads as the battery come alive. Port: the battery\'s light is lifted out of the glass texture into meshes for the moment and painted back at the end.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
// the battery's bolt outline (scene.js drawGlyph 'bolt', in a 40-unit box)
const BOLT = [[22.5, 6], [12.5, 22], [19.5, 22], [17.5, 34], [27.5, 17.5], [20.5, 17.5]];

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

/** The bolt's outline as a shape, `h` tall, with its bottom point at the origin. */
function boltShape(THREE, h) {
  const k = h / 28;
  const sh = new THREE.Shape();
  BOLT.forEach(([px, py], i) => (i ? sh.lineTo((px - 17.5) * k, (34 - py) * k) : sh.moveTo((px - 17.5) * k, (34 - py) * k)));
  sh.closePath();
  return sh;
}

/**
 * The battery at (bx, by): its light lives in the board's glow texture; this lifts it out so it can be driven
 * (3D copies of the three arcs, the bolt and the glow), and puts it back.
 */
function takeBattery(lab, bx, by) {
  const { THREE, arena, PALETTE } = lab;
  const map = arena.topMat.emissiveMap;
  const g = map.image.getContext('2d');
  const S = map.image.width / arena.course.w;
  const X = bx * S;
  const Y = by * S;
  const orig = g.getImageData(X, Y, S, S);
  const clean = g.getImageData(X - S, Y, S, S); // the floor next door: same seams and corner marks, no battery
  let painted = true;
  const paint = (on) => {
    if (on === painted) return;
    painted = on;
    g.putImageData(on ? orig : clean, X, Y);
    map.needsUpdate = true;
  };
  lab.cleanup(() => paint(true));
  const at = lab.pos(bx, by);
  const grp = new THREE.Group();
  grp.position.set(at.x, 0.007, at.z);
  grp.visible = false;
  lab.add(grp);
  const amber = new THREE.Color(PALETTE.energy);
  const flat = (geo, op) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: amber.clone(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    grp.add(m);
    return m;
  };
  const arcs = [0, 1, 2].map((i) => {
    const a0 = (i / 3) * TAU + 0.25;
    const a1 = ((i + 1) / 3) * TAU - 0.25;
    return {
      core: flat(new THREE.RingGeometry(0.286, 0.314, 40, 1, -a1, a1 - a0), 1),
      halo: flat(new THREE.RingGeometry(0.25, 0.35, 40, 1, -a1 - 0.04, a1 - a0 + 0.08), 0.25),
    };
  });
  const sh = new THREE.Shape();
  const k = 0.34 / 40;
  [[22.5, 6], [12.5, 22], [19.5, 22], [17.5, 34], [27.5, 17.5], [20.5, 17.5]].forEach(([px, py], i) => (i ? sh.lineTo((px - 20) * k, -(py - 20) * k) : sh.moveTo((px - 20) * k, -(py - 20) * k)));
  sh.closePath();
  const bolt = flat(new THREE.ShapeGeometry(sh), 1);
  return {
    paint,
    grp,
    /** arcs: brightness of each arc (1 = as painted), bolt: brightness of the bolt. */
    set({ arcs: a = [1, 1, 1], bolt: b = 1 } = {}) {
      paint(false);
      grp.visible = true;
      arcs.forEach((arc, i) => {
        const v = a[i];
        arc.core.material.color.copy(amber).multiplyScalar(Math.max(0, v));
        arc.halo.material.color.copy(amber).multiplyScalar(Math.max(0, v) * (v > 1 ? 1.6 : 1));
      });
      bolt.material.color.copy(amber).multiplyScalar(Math.max(0, b));
    },
    restore() {
      paint(true);
      grp.visible = false;
    },
  };
}

/** The robot's ring, pointer and pool: the parts that lie on the glass. */
function glassParts(group, model) {
  const out = [];
  group.traverse((o) => {
    if (o.isMesh && (o.material === model.ringMat || o.material === model.poolMat)) out.push({ o, y: o.position.y });
  });
  return out;
}

export default async function play(lab) {
  const { THREE, PALETTE, arena } = lab;
  const maya = lab.puppet('a');
  const amber = new THREE.Color(PALETTE.energy);
  const red = new THREE.Color(lab.bot('a').color);
  const home = lab.pos(3, 1);
  const glow = glowTex(THREE);
  lab.cleanup(() => glow.dispose());
  const onGlass = glassParts(maya.group, maya.model);
  lab.cleanup(() => onGlass.forEach(({ o, y }) => (o.position.y = y)));
  const bat = takeBattery(lab, 3, 1);
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });

  // ---- the bolt, alive: root (where it stands, its yaw) > lean (stand up, teeter, dive) > squash > mesh ----
  const BH = 0.3;
  const kk = BH / 28;
  const shape = boltShape(THREE, BH);
  const boltMat = new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(1.35) });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  geo.translate(-2.5 * kk, 0, -0.011);
  const root = new THREE.Group();
  const lean = new THREE.Group();
  const squash = new THREE.Group();
  const boltMesh = new THREE.Mesh(geo, boltMat);
  squash.add(boltMesh);
  lean.add(squash);
  root.add(lean);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(0.22), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.5);
  root.add(halo);
  // its own little pool of light on the glass
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: glow, color: amber.clone().multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 2;
  root.visible = false;
  lab.add(root);
  lab.add(pool);
  // the fresh bolt that slides back in under her (flat, like the one drawn in the glass)
  const freshGeo = new THREE.ShapeGeometry(boltShape(THREE, 0.238));
  freshGeo.translate(-2.5 * (0.238 / 28), -0.119, 0);
  const fresh = new THREE.Mesh(freshGeo, new THREE.MeshBasicMaterial({ color: amber.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fresh.rotation.x = -Math.PI / 2;
  fresh.renderOrder = 1;
  fresh.visible = false;
  lab.add(fresh);
  // drops of light it shakes off
  const drops = Array.from({ length: 7 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(0.07);
    s.visible = false;
    lab.add(s);
    const a = (i / 7) * TAU + lab.range(-0.3, 0.3);
    return { s, v: new THREE.Vector3(Math.cos(a) * lab.range(0.7, 1.2), lab.range(0.7, 1.3), Math.sin(a) * lab.range(0.4, 0.8)), p: new THREE.Vector3(), landed: -1 };
  });

  // ---- the timeline (scene seconds from the start of the move) ----
  const MOVE = 0.6;
  const SIT = MOVE + 0.04; // she settles her weight on it
  const SQUIRT = SIT + 0.04; // and it shoots out from under her
  const STAND = SQUIRT + 0.2; // it stands up on its point
  const SHAKE = STAND + 0.2; // shakes itself off
  const CROUCH = SHAKE + 0.2; // crouches
  const HOP = CROUCH + 0.09; // hops
  const FLY = 0.3;
  const DIVE = HOP + FLY; // dives into her back
  const END = DIVE + 0.3;

  const startZ = home.z + 0.119; // its point, where the drawn bolt's point is
  const standAt = new THREE.Vector3(home.x - 0.06, 0, home.z + 0.8);
  const back = new THREE.Vector3(home.x - 0.04, 0.36, home.z + 0.02);

  const st = { pitch: 0, pv: 0, roll: 0, rv: 0, turn: 0, tv: 0, sy: 1, sv: 0 };
  const kicks = new Set();
  const once = (name, fn) => !kicks.has(name) && (kicks.add(name), fn());
  let paidAt = -1;
  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const T = lab.t - t0;
    const k = clamp01(T / MOVE);
    const x = 1 + 2 * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const accel = T < MOVE ? (k < 0.5 ? 1 : -1) * 22 : 0;

    // the battery: the drawn bolt lies under her until it squirts out
    if (T >= SIT - 0.02 && T < END) {
      const fill = T >= HOP ? 1 + 1.6 * Math.sin(seg(T, HOP + 0.05, END) * Math.PI) : 1;
      bat.set({ arcs: [fill, fill, fill], bolt: T < SQUIRT ? 1 : 0 });
    }

    // ---- the bolt ----
    let lift = 0;
    if (T >= SQUIRT && T < DIVE + 0.08) {
      root.visible = true;
      let yaw = 0;
      let lx = -Math.PI / 2;
      let lz = 0;
      let sy = 1;
      let sxz = 1;
      const p = new THREE.Vector3(standAt.x, 0.004, startZ);
      if (T < STAND) {
        // squirted out: fast, then the glass's friction stops it; it skews as it goes
        const r = seg(T, SQUIRT, STAND);
        const d = r < 0.35 ? 0.7 * (1 - (1 - r / 0.35) ** 2) : 0.7 + 0.3 * (1 - (1 - (r - 0.35) / 0.65) ** 2);
        p.z = lerp(startZ, standAt.z, d);
        yaw = 0.5 * Math.sin(d * Math.PI) + 0.08 * d;
        sy = 1 + 0.35 * Math.max(0, 1 - r * 3); // stretched by the squeeze
        sxz = 1 / Math.sqrt(sy);
      } else if (T < HOP) {
        p.z = standAt.z;
        // stand up on its point with an overshoot, then teeter
        const r = seg(T, STAND, STAND + 0.13);
        const e = r < 1 ? 1 + 2.4 * (r - 1) ** 3 + 1.4 * (r - 1) ** 2 : 1; // outBack
        lx = -Math.PI / 2 * (1 - e);
        const ts = T - STAND - 0.1;
        if (ts > 0) lz = 0.2 * Math.exp(-ts * 5) * Math.sin(ts * 15);
        yaw = 0.08;
        if (T >= SHAKE && T < CROUCH) {
          // the wet-dog shake: fast, then it peters out
          const q = T - SHAKE;
          const amp = Math.sin(seg(T, SHAKE, CROUCH) * Math.PI) ** 0.6;
          yaw += 0.75 * amp * Math.sin(q * TAU * 10);
          lz += 0.1 * amp * Math.sin(q * TAU * 10 + 1.2);
          sy = 1 + 0.06 * amp * Math.sin(q * TAU * 20);
          once('shake', () => {
            drops.forEach((d) => {
              d.p.set(p.x, 0.15, p.z);
              d.s.visible = true;
            });
          });
        }
        if (T >= CROUCH) {
          // crouch, leaning back away from where it's going
          const c = smooth(seg(T, CROUCH, HOP));
          sy = 1 - 0.38 * c;
          lx = 0.22 * c;
        }
        sxz = 1 / Math.sqrt(Math.max(0.3, sy));
      } else {
        // the hop: a real arc onto her back, diving in head first
        const r = seg(T, HOP, DIVE);
        p.lerpVectors(standAt, back, r);
        p.y = lerp(0, back.y, r) + 0.58 * 4 * r * (1 - r);
        lx = lerp(0.22, -1.5, smooth(r));
        const v = Math.abs(1 - 2 * r);
        sy = 1 + 0.4 * v * (r < 0.5 ? 1 : 0.6);
        sxz = 1 / Math.sqrt(sy);
        if (T >= DIVE) {
          // in it goes
          const d = seg(T, DIVE, DIVE + 0.08);
          p.y = back.y - 0.12 * d;
          sxz *= 1 - d;
          sy *= 1 - d;
        }
        yaw = 0.08 * (1 - r);
      }
      root.position.copy(p);
      root.rotation.y = yaw;
      lean.rotation.set(lx, 0, lz);
      squash.scale.set(Math.max(0.001, sxz), Math.max(0.001, sy), Math.max(0.001, sxz));
      // the halo sits at its middle
      const up = new THREE.Vector3(0, BH * 0.5 * sy, 0).applyEuler(lean.rotation);
      halo.position.copy(up);
      halo.scale.setScalar(0.5 * Math.min(1, sxz * 1.2));
      pool.position.set(p.x, 0.006, p.z - (T < HOP ? 0.05 : 0));
      pool.material.opacity = 0.8 * Math.exp(-p.y * 3) * (T < DIVE ? 1 : 0);
    } else {
      root.visible = false;
      pool.material.opacity = 0;
    }
    // drops: flung off, they fall and land on the glass and fade
    if (T >= SHAKE)
      for (const d of drops) {
        if (!d.s.visible) continue;
        if (d.landed < 0) {
          d.v.y -= 7 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y <= 0.01) {
            d.p.y = 0.01;
            d.landed = T;
          }
        }
        d.s.position.copy(d.p);
        const f = d.landed < 0 ? 1 : 1 - seg(T, d.landed, d.landed + 0.25);
        d.s.scale.setScalar(0.07 * f);
        if (f <= 0) d.s.visible = false;
      }
    // the fresh bolt: fades into the glass at the edge of her ring and slides back under her
    if (T >= HOP + 0.04) {
      fresh.visible = true;
      const r = seg(T, HOP + 0.04, END - 0.04);
      const z = lerp(home.z + 0.66, home.z, smooth(seg(r, 0.25, 1)));
      fresh.position.set(home.x, 0.008, z);
      fresh.material.opacity = smooth(seg(r, 0, 0.3));
      fresh.material.color.copy(amber).multiplyScalar(1 + 0.8 * Math.sin(seg(r, 0, 0.6) * Math.PI));
    }

    // ---- Maya ----
    // sits down hard, gets popped as it squirts out, watches it, sags under it when it lands
    if (T >= SIT) once('sit', () => (st.sv -= 2.6));
    if (T >= SQUIRT) {
      const q = T - SQUIRT;
      lift = q < 0.12 ? 0.045 * Math.sin((q / 0.12) * Math.PI) : 0;
      once('squirt', () => {
        st.sv += 3.2;
        st.rv -= 2.2;
        arena.emit('bump', { id: 'a' });
      });
    }
    if (T >= DIVE)
      once('dive', () => {
        st.sv -= 3.4;
        st.pv += 1.6;
        paidAt = lab.t;
        arena.emit('energy', { id: 'a', n: 1 });
      });
    let wantTurn = -0.5 * smooth(seg(T, SQUIRT + 0.06, SQUIRT + 0.24)) * (1 - smooth(seg(T, HOP + 0.06, DIVE + 0.06)));
    const wantPitch = 0.1 * smooth(seg(T, STAND, STAND + 0.1)) * (1 - smooth(seg(T, CROUCH, HOP + 0.1)));
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      st.pv += (260 * (wantPitch - st.pitch) - 13 * st.pv + accel * 0.11) * h;
      st.pitch += st.pv * h;
      st.rv += (200 * (0 - st.roll) - 9 * st.rv) * h;
      st.roll += st.rv * h;
      st.tv += (140 * (wantTurn - st.turn) - 15 * st.tv) * h;
      st.turn += st.tv * h;
      st.sv += (320 * (1 - st.sy) - 11 * st.sv) * h;
      st.sy += st.sv * h;
    }
    const sxz = 1 / Math.sqrt(st.sy);
    maya.set({ x, y: 1, rot: lab.facing(1) + st.turn, lift, sy: st.sy, sx: sxz, sz: sxz });
    maya.each = (m) => {
      tilt(m, st.pitch, st.roll);
      const s = 1.3 * maya.pose.sy;
      for (const { o, y } of onGlass) o.position.y = y - maya.pose.lift / s;
      if (paidAt >= 0) {
        const r = lab.t - paidAt;
        const warm = Math.exp(-Math.max(0, r - 0.2) * 4);
        const flare = 1 + 1.6 * Math.exp(-r * 9);
        m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(amber.clone().multiplyScalar(3.4 * flare), warm);
        const fl = Math.exp(-r * 7);
        m.paint.emissive.copy(red).lerp(amber, fl);
        m.paint.emissiveIntensity = 0.16 + 0.5 * fl;
      }
    };
  });

  await lab.wait(END);
  stop();
  root.visible = false;
  fresh.visible = false;
  for (const d of drops) d.s.visible = false;
  bat.restore();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
