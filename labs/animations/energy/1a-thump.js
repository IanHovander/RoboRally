// Energy, idea 24 "Vending machine", animator a (weight & physical comedy).
export const meta = {
  title: 'Thump',
  idea:
    'Maya brakes onto the battery and nothing happens. She tips her nose down to look at it, heaves herself up off the glass and slams down. The glass rings, the thud runs across the slab and bounces Ezra, and the battery stutters like a stuck machine before it coughs a gulp of amber light out of its slot, which arcs up and lands on her back with a clunk. Energy is paid at the end of the register, not on arrival, so the beat of nothing is true to the rules, and everyone has thumped a vending machine.',
  notes:
    'Sound: tyres of glass braking, a third of a second of silence, a low glass thud with a ring, two dry clicks (the stutter), a hollow cough, then a deep clunk. Every fourth time (and with ?early in the stage URL) the machine pays the instant she starts to rise: the gulp catches her in mid-lift, she hangs there, then lowers herself back down sheepishly. Port: drive the battery from the board texture as here, or give batteries their own meshes.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
let loops = 0; // the stage replays the moment; every fourth time the machine pays early
const EARLY = false; // true to watch the early payout

/** A soft round glow texture (white middle, clear edge). */
function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Lean the body (not its ring of light) over the edge it leans toward, so it rocks on the glass. */
function tilt(model, pitch, roll = 0) {
  const b = model.body;
  b.rotation.set(-pitch, 0, -roll);
  const pz = pitch >= 0 ? -0.34 : 0.37; // front edge for a nose-down lean, back edge for nose-up
  const px = roll >= 0 ? 0.33 : -0.33;
  const py = 0.02;
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  // where the pivot goes under the rotation, then shift so it stays put
  const y1 = py * cx + pz * sx; // rotation about x by -pitch
  const z1 = -py * sx + pz * cx;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const x2 = px * cr + y1 * sr; // rotation about z by -roll
  const y2 = -px * sr + y1 * cr;
  b.position.x += px - x2;
  b.position.y += py - y2;
  b.position.z += pz - z1;
}

/** The robot's ring, pointer and pool: the parts that lie on the glass. */
function glassParts(group, model) {
  const out = [];
  group.traverse((o) => {
    if (o.isMesh && (o.material === model.ringMat || o.material === model.poolMat)) out.push({ o, y: o.position.y });
  });
  return out;
}

/** Keep the ring of light on the glass while the body lifts (it is light on the glass, like a shadow). */
function keepOnGlass(parts, pose) {
  const s = 1.3 * (pose.sy ?? 1); // BOT_SCALE
  for (const { o, y } of parts) o.position.y = y - (pose.lift ?? 0) / s;
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

export default async function play(lab) {
  const { THREE, PALETTE, arena } = lab;
  const early = EARLY || new URLSearchParams(location.search).has('early') || ++loops % 4 === 0;
  const maya = lab.puppet('a');
  const ezra = lab.puppet('b');
  const bat = takeBattery(lab, 3, 1);
  const amber = new THREE.Color(PALETTE.energy);
  const red = new THREE.Color(lab.bot('a').color);
  const onGlass = glassParts(maya.group, maya.model);
  lab.cleanup(() => onGlass.forEach(({ o, y }) => (o.position.y = y)));
  const home = lab.pos(3, 1);
  const glow = glowTex(THREE);
  lab.cleanup(() => glow.dispose());
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });

  // the gulp of light the battery coughs up
  const gulp = new THREE.Group();
  const gulpCore = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(3.4), transparent: true, depthWrite: false }));
  const gulpHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: amber.clone().multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  gulp.add(gulpCore, gulpHalo);
  gulp.visible = false;
  lab.add(gulp);
  // the slot it comes out of: a bright slit in the glass at the near edge of her ring
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.05), new THREE.MeshBasicMaterial({ color: amber.clone().multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  slot.rotation.x = -Math.PI / 2;
  slot.position.set(home.x, 0.01, home.z + 0.52);
  lab.add(slot);
  // the glass rings where she lands
  const thudRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.light).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  thudRing.rotation.x = -Math.PI / 2;
  thudRing.position.set(home.x, 0.012, home.z);
  lab.add(thudRing);

  // ---- the timeline (scene seconds from the start of the move) ----
  const MOVE = 0.6;
  const A = MOVE; // arrival: then nothing at all for a beat
  const LOOK = A + 0.2; // nose tips down to look at it, head cocked
  const RISE = A + 0.44; // a little crouch, then she heaves herself up
  const UP = RISE + 0.07;
  const TOP = UP + 0.19;
  const SLAM = early ? Infinity : TOP + 0.08; // hangs there, then drops
  const HIT = early ? Infinity : SLAM + 0.06; // impact
  const STUT = early ? Infinity : HIT + 0.06; // the battery stutters
  const COUGH = early ? UP + 0.07 : STUT + 0.24; // the gulp leaves the slot
  const FLY = 0.28; // its flight up onto her back
  const CLUNK = COUGH + FLY;
  const END = early ? CLUNK + 0.62 : CLUNK + 0.4;

  // her lean is a spring pushed by her acceleration (inertia), plus whatever she does on purpose
  let pitch = 0;
  let pv = 0;
  let kicked = false;
  let paidAt = -1;
  const t0 = lab.t;
  const stop = lab.every((dt) => {
    const T = lab.t - t0;
    // drive: the game's own ease, two spaces in 0.6 s
    const k = clamp01(T / MOVE);
    const x = 1 + 2 * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const accel = T < MOVE ? (k < 0.5 ? 1 : -1) * 22 : 0;
    // what she means to do with her nose: look down; while heaving up, nose up a hair
    const look = smooth(seg(T, LOOK, LOOK + 0.1));
    let want = 0.34 * look * (1 - smooth(seg(T, RISE, RISE + 0.08)));
    if (!early) want += -0.1 * smooth(seg(T, UP, TOP)) * (1 - seg(T, SLAM, HIT));
    else want += -0.08 * smooth(seg(T, UP, COUGH)) * (1 - smooth(seg(T, CLUNK + 0.25, END)));
    if (T >= HIT && !kicked) {
      kicked = true;
      pv += 3.2; // the slam rocks her nose down and back
    }
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      const a = 260 * (want - pitch) - 13 * pv + accel * 0.11;
      pv += a * h;
      pitch += pv * h;
    }
    // a curious tilt of the head while she looks
    let roll = 0.16 * smooth(seg(T, LOOK + 0.08, LOOK + 0.2)) * (1 - smooth(seg(T, RISE, RISE + 0.07)));
    // lift and squash
    let lift = 0;
    let sy = 1;
    const crouch = T >= RISE && T < UP ? Math.sin(seg(T, RISE, UP) * Math.PI * 0.5) : 0;
    if (!early) {
      if (T >= RISE && T < UP) sy = 1 - 0.14 * crouch;
      else if (T >= UP && T < TOP) {
        const r = seg(T, UP, TOP);
        lift = 0.3 * (1 - (1 - r) ** 2.2);
        sy = lerp(0.86, 1.1, smooth(seg(r, 0, 0.3))) - 0.07 * smooth(seg(r, 0.4, 1));
      } else if (T >= TOP && T < SLAM) {
        lift = 0.3 + 0.012 * smooth(seg(T, TOP, SLAM));
        sy = 1.03;
      } else if (T >= SLAM && T < HIT) {
        const r = seg(T, SLAM, HIT);
        lift = 0.312 * (1 - r * r);
        sy = 1.14;
      } else if (T >= HIT) {
        const r = T - HIT;
        // a flat squash for a frame, then a little rebound and a wobble that dies away
        sy = r < 0.034 ? 0.58 : 1 - 0.3 * Math.exp(-r * 16) * Math.cos(r * 34);
        lift = r > 0.03 && r < 0.17 ? 0.04 * Math.sin(((r - 0.03) / 0.14) * Math.PI) : 0;
      }
    } else if (T >= RISE) {
      if (T < UP) sy = 1 - 0.14 * crouch;
      else {
        // early payout: caught in mid-lift, held there, then lowered down sheepishly
        const up = 0.11 * (1 - (1 - seg(T, UP, COUGH + 0.05)) ** 2.4);
        const down = smooth(seg(T, CLUNK + 0.24, END - 0.04));
        lift = up * (1 - down);
        sy = lerp(0.86, 1.06, smooth(seg(T, UP, UP + 0.06))) - 0.06 * seg(T, CLUNK, CLUNK + 0.1);
        // a guilty little look around while she lowers herself
        roll = 0.1 * Math.sin(seg(T, CLUNK + 0.1, END) * Math.PI);
      }
    }
    // the clunk: the gulp's weight pushes her down
    if (T >= CLUNK) {
      const r = T - CLUNK;
      sy *= 1 - 0.2 * Math.exp(-r * 13) * Math.cos(r * 30);
    }
    const sxz = 1 / Math.sqrt(sy);
    // after the payout she swings a hair toward the room, pleased, and back (her pointer stays east)
    const pleased = T > CLUNK && !early ? Math.sin(seg(T, CLUNK + 0.06, END - 0.02) * Math.PI) : 0;
    maya.set({ x, y: 1, rot: lab.facing(1) + 0.12 * pleased, lift, sx: sxz, sz: sxz, sy });

    // the battery: low and steady, then it stutters like a stuck machine, then coughs.
    // She sits on it, so the stutter shows as amber light from below on her polish and in her pool.
    let v = -1;
    if (T >= STUT && T < COUGH) {
      const r = T - STUT;
      // on, off, on-on, off, on, off
      const pattern = [[0, 0.04, 2.6], [0.04, 0.09, 0], [0.09, 0.12, 3], [0.12, 0.14, 0.4], [0.14, 0.17, 2.4], [0.17, 0.24, 0]];
      v = 1;
      for (const [a, b, val] of pattern) if (r >= a && r < b) v = val;
    } else if (T >= COUGH && T < CLUNK + 0.4) v = lerp(3.2, 1, smooth(seg(T, COUGH, COUGH + 0.16)));
    if (v >= 0) {
      bat.set({ arcs: [v, v, v], bolt: Math.min(v, 1.6) });
      arena.batteryMat.color.copy(amber).multiplyScalar(0.3 * v);
      arena.batteries[0].scale.setScalar(1 + 0.45 * Math.max(0, v - 1));
    } else if (T >= CLUNK + 0.4) {
      bat.restore();
      arena.batteries[0].scale.setScalar(1);
    }
    const under = v >= 0 && T < COUGH + 0.1 ? Math.max(0, v - 0.2) / 2.8 : 0; // light from below on her

    maya.each = (m) => {
      tilt(m, pitch, roll);
      keepOnGlass(onGlass, maya.pose);
      m.paint.emissive.copy(red).lerp(amber, Math.min(1, under * 1.4));
      m.paint.emissiveIntensity = 0.16 + 0.55 * under;
      m.poolMat.color.copy(red).multiplyScalar(0.9).lerp(amber.clone().multiplyScalar(1.6), Math.min(1, under * 1.2));
      if (paidAt >= 0) {
        const r = lab.t - paidAt;
        const warm = 1 - smooth(seg(r, 0.16, END - CLUNK - 0.02));
        const flare = 1 + 2.2 * Math.exp(-r * 9);
        m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(amber.clone().multiplyScalar(3.4 * flare), warm);
        m.poolMat.color.copy(red).multiplyScalar(0.9).lerp(amber.clone().multiplyScalar(1.3), 0.8 * (1 - smooth(seg(r, 0.05, END - CLUNK - 0.02))));
      }
    };

    // Ezra: the thud runs through the glass a few frames later and bounces him
    const er = T - HIT - 0.08;
    if (er > 0) {
      const hop = er < 0.16 ? 0.06 * Math.sin((er / 0.16) * Math.PI) : 0;
      ezra.set({ lift: hop, roll: 0.1 * Math.exp(-er * 6) * Math.sin(er * 26), pitch: 0.06 * Math.exp(-er * 6) * Math.sin(er * 21 + 1), sy: 1 - (er < 0.05 ? 0.12 : 0) });
    }

    // the glass rings at the thud
    if (T >= HIT) {
      const r = clamp01((T - HIT) / 0.42);
      thudRing.scale.setScalar(0.45 + (1 - (1 - r) ** 2) * 0.85);
      thudRing.material.opacity = 1 * (1 - r) ** 1.6;
    }

    // the slot opens and the gulp pops out, arcs up high and drops onto her back
    slot.material.opacity = T >= COUGH - 0.04 ? Math.sin(seg(T, COUGH - 0.04, COUGH + 0.16) * Math.PI) : 0;
    if (T >= COUGH && T < CLUNK + 0.08) {
      const r = clamp01((T - COUGH) / FLY);
      gulp.visible = true;
      const from = new THREE.Vector3(home.x, 0.02, home.z + 0.52);
      const to = new THREE.Vector3(home.x - 0.05, 0.36 + lift * 1.3, home.z + 0.02);
      const p = from.clone().lerp(to, r);
      // a real arc: up fast, hang, down fast
      p.y = from.y + (to.y - from.y) * r + 0.72 * 4 * r * (1 - r);
      gulp.position.copy(p);
      // squash and stretch along its path: squeezed out of the slot, round at the top, stretched coming down
      const vy = 1 - 2 * r;
      const st = 1 + 0.6 * Math.abs(vy);
      const born = smooth(seg(T, COUGH, COUGH + 0.05));
      gulpCore.scale.set(born / Math.sqrt(st), born * st, born / Math.sqrt(st));
      gulpHalo.scale.setScalar(0.5 * born);
      if (T >= CLUNK) {
        const s = 1 - seg(T, CLUNK, CLUNK + 0.08);
        gulpCore.scale.set(1.6 * s, 0.35 * s, 1.6 * s);
        gulpHalo.scale.setScalar(0.6 * s);
      }
    } else gulp.visible = false;
    if (T >= CLUNK && paidAt < 0) {
      paidAt = lab.t;
      arena.emit('energy', { id: 'a', n: 1 });
      lab.ring(new THREE.Vector3(home.x, 0, home.z), PALETTE.energy, 0.36, 0.015, 0.4);
    }
  });

  await lab.wait(END);
  stop();
  bat.restore();
  arena.batteries[0].scale.setScalar(1);
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
  ezra.release({ x: 5, y: 3, d: 0 });
}
