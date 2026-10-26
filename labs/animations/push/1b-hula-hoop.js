// Hula Hoop, animator b (character acting): the ring of light is the slowest one at the scene to work out what happened.
export const meta = {
  title: 'Hula Hoop (b): the confused ring',
  idea:
    "Maya shoves Theo east, but his blue ring of light stays lying on space 3. Theo looks down at his bare feet, looks up, looks down again (no ring!). " +
    'Maya rolls straight into it, notices the extra ring, and does an embarrassed little hula shimmy: the blue hoop rises to her waist, swings round her once and she flicks it off. ' +
    'It stands up on its edge, trots east like a puppy back to its owner, hops over Theo (he ducks) and drops around him, wobbling faster and faster like a spun coin. ' +
    'Theo holds his breath; Maya and Jun lean in to watch the coin; it clicks flat, Theo exhales, and his ring is home.',
  notes:
    'Sound: a soft glass "tik" as Maya meets Theo, a small rising two-note chime for her shimmy, a light rolling tick-tick-tick as the hoop rolls, ' +
    "then the whirr of a coin settling (Euler's disk), a run of glass taps that speeds up and ends in one pure ting when it lies flat. " +
    "Theo's pointer goes with him (it shows his facing, which a push never changes); only the ring is left behind. " +
    "Porting: the hoop is a torus the size of the ring (r 0.517, tube 0.017) in the pushed robot's colour, with a small glint arc so its rolling reads; the robot's own ring is hidden until the coin lies flat, then swapped back under a glow. " +
    'Varies: the bystander who leans in is whoever is nearest; a pushed Orb could hop higher when the hoop comes back.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (T, a, b) => clamp((T - a) / (b - a));
  const bump = (T, a, b) => Math.sin(Math.PI * seg(T, a, b)); // 0 → 1 → 0 over [a, b]
  // a keyframe track: [[t, v, ease?], ...]; the ease on a key shapes the move INTO it
  const track = (keys) => (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = ease.inOut] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return lerp(v0, v1, e((T - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  };

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const eyeOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const mayaEye = eyeOf(maya.model);
  const theoRing = theo.group.children.find((o) => o.isMesh && o.geometry?.type === 'RingGeometry');
  lab.cleanup(() => theoRing && (theoRing.visible = true));

  // ----- the hoop: Theo's ring of light, as a thing -----
  const R = 0.517;
  const TUBE = 0.017;
  const blue = new THREE.Color(lab.bot('b').color);
  const hoop = new THREE.Group();
  const hoopMat = new THREE.MeshBasicMaterial({ color: blue.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 8, 96), hoopMat);
  hoop.add(torus);
  // a glint on the rim so its rolling and spinning can be seen
  const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(blue).lerp(new THREE.Color('#ffffff'), 0.6).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glint = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE * 1.5, 6, 16, 0.55), glintMat);
  hoop.add(glint);
  // the glow it throws on the glass when it lies flat again
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.72, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.8, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const haloMat = new THREE.MeshBasicMaterial({ map: poolTex, color: blue.clone().multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), haloMat);
  halo.rotation.x = -Math.PI / 2;
  lab.add(halo);
  hoop.visible = false;
  lab.add(hoop);

  const qa = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3();
  // place the hoop: centre on space (x, y), normal n, spin psi about its own axis; sits on the glass if lift is null
  const placeHoop = (x, y, nx, ny, nz, psi, lift = null) => {
    n.set(nx, ny, nz).normalize();
    if (n.z < -0.999) n.set(0.0001, n.y, n.z).normalize();
    qa.setFromUnitVectors(Z, n);
    qs.setFromAxisAngle(Z, psi);
    hoop.quaternion.copy(qa).multiply(qs);
    const p = lab.pos(x, y);
    const rest = R * Math.sqrt(Math.max(0, 1 - n.y * n.y)) + TUBE;
    hoop.position.set(p.x, lift ?? rest, p.z);
  };

  // ----- timing (play seconds) -----
  const CONTACT = 0.42;
  const THEO_STOP = 0.8;
  const HULA0 = 1.02;
  const HULA1 = 1.34;
  const FLING1 = 1.46;
  const ROLL1 = 1.62;
  const HOP1 = 1.8;
  const COIN1 = 2.3;
  const END = 2.44;

  // Maya: rolls in, shoves, stops on 3 inside the blue ring
  const mayaX = track([[0, 1], [CONTACT, 2.4, (k) => k ** 1.55], [0.74, 3, ease.out]]);
  const mayaPitch = track([[0, 0], [0.3, 0.08], [CONTACT, 0.16, ease.in], [0.74, -0.06, ease.out], [0.86, 0.02], [0.96, 0.22, ease.out], [1.02, 0.05]]);
  // Theo: shoved one space east, a lag lean while he's accelerated, then the double take
  const theoX = track([[CONTACT, 3], [THEO_STOP, 4, ease.out3]]);
  const theoRoll = track([[CONTACT, 0], [0.5, 0.16, ease.out], [THEO_STOP, -0.08], [0.9, 0.0]]);
  // look down, up, DOWN (hold), then a little lean west toward where his ring was
  const theoPitch = track([[0.8, 0], [0.86, 0.3, ease.out], [0.92, -0.04, ease.out], [1.0, 0.42, ease.out3], [1.16, 0.36], [1.26, 0.06], [HOP1 - 0.1, 0.0], [HOP1 - 0.03, 0.0]]);
  const theoLookWest = track([[1.12, 0], [1.24, 0.1, ease.out], [ROLL1, 0.08], [HOP1 - 0.12, -0.02], [HOP1, 0]]);
  // Jun: turns his visor to the noise, follows the hoop, leans in on the coin, and turns back
  const toward = (fx, fy, tx, ty) => Math.atan2(-(tx - fx), -(ty - fy));
  const unwrapNear = (a, ref) => ref + ((((a - ref + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const junHome = facing(3);
  const junLookAt = (x, y) => unwrapNear(toward(6, 0, x, y), junHome);

  // the hoop's path
  const hulaSpin = (T) => {
    const k = seg(T, HULA0, HULA1);
    return 0.35 + TAU * 1.15 * ease.inOut(k); // the angle where its centre swings out
  };

  let theoBreath = 0;
  const t0 = lab.t;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    // ---------- Maya ----------
    let mx = mayaX(T);
    let my = 2;
    let mRoll = 0;
    let mPitch = mayaPitch(T);
    let mLift = 0;
    let mSy = 1;
    // the shimmy: hips swing in a circle against the hoop, a little rise in the middle
    if (T > HULA0 - 0.04 && T < HULA1 + 0.08) {
      const a = hulaSpin(T);
      const amp = bump(T, HULA0 - 0.04, HULA1 + 0.08);
      mRoll += Math.sin(a) * 0.2 * amp;
      mPitch += -Math.cos(a) * 0.12 * amp;
      mx += -Math.cos(a) * 0.035 * amp;
      my += -Math.sin(a) * 0.035 * amp;
      mLift = 0.03 * amp;
      mSy = 1 + 0.06 * amp;
    }
    // watching the hoop go, then leaning in on the coin
    const watch = seg(T, FLING1, ROLL1) * (1 - seg(T, COIN1, END));
    mPitch += 0.1 * ease.inOut(seg(T, HOP1, COIN1 - 0.1)) * (1 - seg(T, COIN1, COIN1 + 0.1));
    mRoll += -0.06 * watch;
    maya.set({ x: mx, y: my, pitch: mPitch, roll: mRoll, lift: mLift, sy: mSy, sx: 1 / Math.sqrt(mSy), sz: 1 / Math.sqrt(mSy) });

    // ---------- Theo ----------
    const ducking = bump(T, HOP1 - 0.13, HOP1 + 0.04);
    const holding = seg(T, HOP1, HOP1 + 0.08) * (1 - seg(T, COIN1, COIN1 + 0.04));
    const exhale = bump(T, COIN1, END - 0.02);
    theoBreath = holding;
    const tSy = 1 - 0.18 * ducking - 0.05 * holding + 0.08 * exhale;
    theo.set({
      x: theoX(T),
      pitch: theoPitch(T),
      roll: theoRoll(T) + theoLookWest(T) + Math.sin(T * 70) * 0.012 * holding, // a nervous tremble while it spins
      lift: 0.05 * exhale,
      sy: tSy,
      sx: 1 + 0.08 * ducking + 0.03 * holding,
      sz: 1 + 0.08 * ducking + 0.03 * holding,
    });

    // ---------- Jun ----------
    let jr = junHome;
    const notice = seg(T, CONTACT + 0.02, CONTACT + 0.16);
    const back = ease.inOut(seg(T, COIN1 + 0.0, END - 0.02));
    let look = junLookAt(3.5, 2);
    if (T > HULA0) look = lerp(look, junLookAt(3, 2), seg(T, HULA0, HULA1));
    if (T > FLING1) look = lerp(junLookAt(3, 2), junLookAt(4, 2.3), seg(T, FLING1, HOP1));
    jr = lerp(junHome, look, ease.outBack(notice)) * (1 - back) + junHome * back;
    const junLean = 0.16 * ease.inOut(seg(T, HOP1 - 0.05, COIN1 - 0.08)) * (1 - seg(T, COIN1, COIN1 + 0.1));
    const junStartle = bump(T, CONTACT, CONTACT + 0.18);
    jun.set({ rot: jr, pitch: junLean - 0.06 * junStartle, lift: 0.03 * junStartle, sy: 1 + 0.04 * junStartle });

    // ---------- the hoop ----------
    if (T < CONTACT) {
      hoop.visible = false;
    } else {
      if (theoRing && T < COIN1 + 0.05) theoRing.visible = false;
      hoop.visible = true;
      glintMat.opacity = 0.9 * seg(T, 0.92, 1.0) * (1 - seg(T, COIN1 - 0.06, COIN1 + 0.04));
      if (T < HULA0 - 0.1) {
        // lying where Theo was, a beat behind: then a small double take of its own (a lift and a tip toward Theo)
        const look2 = bump(T, 0.9, 1.0);
        placeHoop(3, 2, 0.12 * look2, 1, 0, 0.6, 0.006 + 0.02 * look2);
        if (T > 0.9) hoopMat.opacity = 0.9;
      } else if (T < HULA1) {
        // rises to Maya's waist and swings round her
        const rise = ease.out(seg(T, HULA0 - 0.1, HULA0 + 0.06));
        const a = hulaSpin(T);
        const off = 0.17 * rise;
        const cx = mayaX(T) + Math.cos(a) * off;
        const cy = 2 + Math.sin(a) * off;
        const tilt = 0.16 * rise;
        placeHoop(cx, cy, -Math.cos(a) * tilt, 1, -Math.sin(a) * tilt, 0.6 + a * 0.4, 0.006 + 0.13 * rise);
      } else if (T < FLING1) {
        // flicked off: it swings out east-southeast and stands up on its edge
        const k = seg(T, HULA1, FLING1);
        const e = ease.out(k);
        const a = hulaSpin(HULA1);
        const sx0 = 3 + Math.cos(a) * 0.17;
        const sy0 = 2 + Math.sin(a) * 0.17;
        const cx = lerp(sx0, 3.42, e);
        const cy = lerp(sy0, 2.56, e);
        const nx = lerp(-Math.cos(a) * 0.16, 0, e);
        const ny = lerp(1, 0.02, ease.inOut(k));
        const nz = lerp(-Math.sin(a) * 0.16, 1, ease.inOut(k));
        const rest = R * Math.sqrt(Math.max(0, 1 - (ny * ny) / (nx * nx + ny * ny + nz * nz))) + TUBE;
        placeHoop(cx, cy, nx, ny, nz, 0.6 + a * 0.4 - e * 1.2, lerp(0.136, rest, e) + 0.12 * Math.sin(Math.PI * k));
      } else if (T < ROLL1) {
        // trots east on its edge, a little lean and bounce, toward its owner
        const k = seg(T, FLING1, ROLL1);
        const cx = lerp(3.42, 3.8, k);
        const cy = lerp(2.56, 2.5, k);
        const hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.04;
        const lean = -0.1 * Math.sin(k * Math.PI);
        placeHoop(cx, cy, 0, lean, 1, 0.6 + 2.3 * 0.4 - 1.2 - (cx - 3.42) / R, R + TUBE + hop);
      } else if (T < HOP1) {
        // the ring toss: up over Theo, tipping over as it falls around him
        const k = seg(T, ROLL1, HOP1);
        const a0 = 0.5; // tilt it lands with
        const tilt = lerp(Math.PI / 2 - 0.1, a0, ease.in(k));
        const cx = lerp(3.8, 4, ease.out(k));
        const cy = lerp(2.5, 2, ease.inOut(k));
        const rest0 = R + TUBE;
        const rest1 = R * Math.sin(a0) + TUBE;
        const h = lerp(rest0, rest1, k) + 0.42 * Math.sin(Math.PI * k);
        placeHoop(cx, cy, 0, Math.cos(tilt), Math.sin(tilt), 0.6 + 2.3 * 0.4 - 1.2 - 0.38 / R - k * 1.5, h);
      } else if (T < COIN1) {
        // the spun coin: the tilt dies away while the wobble goes faster and faster
        const k = seg(T, HOP1, COIN1);
        const alpha = 0.5 * (1 - k) ** 1.15;
        const D = COIN1 - HOP1;
        const w0 = 2.4 * TAU; // starting wobble, turns per second
        const c = 0.94;
        const phi = Math.PI / 2 + (-w0 * D * Math.log(1 - c * k)) / c;
        placeHoop(4, 2, Math.sin(alpha) * Math.cos(phi), Math.cos(alpha), Math.sin(alpha) * Math.sin(phi), 0.6 + 2.3 * 0.4 - 1.2 - 0.38 / R - 1.5 + phi * 0.08);
      } else {
        // flat and glowing under him; then it simply is his ring again
        placeHoop(4, 2, 0, 1, 0, 0, 0.006);
        const k = seg(T, COIN1, END);
        hoopMat.color.copy(blue).multiplyScalar(1.6 + 2.4 * (1 - k) ** 2);
        hoopMat.opacity = 0.9 * (1 - seg(T, COIN1 + 0.06, END - 0.02));
        if (theoRing && T > COIN1 + 0.05) theoRing.visible = true;
      }
      // the glow on the glass as it lands flat
      halo.position.copy(lab.pos(4, 2)).setY(0.01);
      haloMat.opacity = T > COIN1 - 0.04 ? 0.9 * (1 - seg(T, COIN1 - 0.04, END)) ** 1.5 * seg(T, COIN1 - 0.04, COIN1) : 0;
    }
  });

  // eyes and lights, after the pose each frame
  const base = [3.2, 3.1, 2.9];
  maya.each = (m) => {
    const T = lab.t - t0;
    // she notices the extra ring (eye opens wide), then a sheepish half-lid during the shimmy
    const wide = bump(T, 0.86, 1.04);
    const sheep = bump(T, HULA0, HULA1 + 0.1);
    for (const e of mayaEye) e.scale.set(1 - 0.45 * sheep + 0.3 * wide, 1, 1);
    const g = 1 + 0.6 * wide - 0.25 * sheep;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  theo.each = (m) => {
    const T = lab.t - t0;
    // ringless: his ridge dims; held breath: steady; home again: a bright happy flare
    const sad = seg(T, 0.98, 1.12) * (1 - seg(T, ROLL1 - 0.1, ROLL1));
    const hope = seg(T, ROLL1 - 0.1, ROLL1) * (1 - seg(T, HOP1 - 0.1, HOP1));
    const flare = bump(T, COIN1 - 0.02, END);
    const g = 1 - 0.55 * sad + 0.3 * hope + 0.9 * flare + 0.15 * theoBreath;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };

  lab.playCard('a', ['m2']);
  await lab.wait(END);
  stop();
  maya.each = null;
  theo.each = null;
  for (const e of mayaEye) e.scale.set(1, 1, 1);
  if (theoRing) theoRing.visible = true;
  hoop.visible = false;
  haloMat.opacity = 0;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  jun.release({ x: 6, y: 0, d: 3 });
}
