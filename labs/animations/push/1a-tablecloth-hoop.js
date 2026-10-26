// Push, idea 7 (Hula Hoop), animator a: weight & physical comedy.
export const meta = {
  title: 'Hula Hoop: the tablecloth trick',
  idea:
    "Maya's shove whips Theo out from under his own ring of light like a tablecloth from under the dishes: the ring has inertia, so it stays lying on space 3. Maya drives into it and it rides up onto her hips: two rings, her red one on the glass and his blue one round her waist. She shimmies, it hula-hoops round her twice, flies off, lands on its edge, rolls after Theo straight through his glass body and spins down around him like a coin on a table, wobbling faster and faster until it lies flat under him with a last bright click.",
  notes:
    "Sound: a glass clink at contact, a small 'tink' as the abandoned ring drops back on the glass, a rising whirr while it hula-hoops, a glass-hoop hum as it rolls, then the spun-coin rattle accelerating (wawawawrrrr) into one soft bright 'tk' when it lies flat. Physics: Theo's lean and Maya's nod are damped springs driven by their real acceleration; the hoop's settle is Euler's disk (tilt falls faster and faster while the wobble rate climbs as 1/sqrt(tilt)). Porting: the ring is RingGeometry inside the robot's group; hide it while a standalone torus stands in, then show it again. Works for any pushed form: the hoop always rolls to the pushed robot's new space.",
};

const TAU = Math.PI * 2;
const R = 0.3975 * 1.3; // the robot's ring of light: radius in world units (RingGeometry 0.385-0.41, robots drawn at 1.3)
const TUBE = 0.017;

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a damped spring driven by the acceleration of whatever it rides on (a body leaning from inertia)
function spring(k, c) {
  return {
    x: 0,
    v: 0,
    step(dt, force) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        this.v += (force - k * this.x - c * this.v) * h;
        this.x += this.v * h;
      }
      return this.x;
    },
  };
}

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const SOUTH = facing(2);
  maya.set({ x: 1, y: 2, rot: EAST });
  theo.set({ x: 3, y: 2, rot: SOUTH });
  lab.playCard('a', ['m2']);

  const blue = new THREE.Color(lab.bot('b').color);
  const theoRing = theo.model.group.children.find((o) => o.geometry?.type === 'RingGeometry');
  lab.cleanup(() => theoRing && (theoRing.visible = true));

  // ----- the stand-in hoop: a torus of Theo's light, its plane local x-z (normal +y) -----
  const hoop = new THREE.Group();
  const geo = new THREE.TorusGeometry(R, TUBE, 10, 96);
  geo.rotateX(Math.PI / 2);
  const hoopMat = new THREE.MeshBasicMaterial({ color: blue.clone().multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const torus = new THREE.Mesh(geo, hoopMat);
  torus.renderOrder = 4;
  hoop.add(torus);
  // a bead of brighter light riding the hoop, so you can see it roll and spin
  const beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(blue).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), beadMat);
  bead.position.set(R, 0, 0);
  hoop.add(bead);
  lab.add(hoop);
  // where the hoop touches the glass, its light pools
  const glow = glowTexture(THREE);
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: blue.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const touch = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), poolMat);
  touch.rotation.x = -Math.PI / 2;
  touch.renderOrder = 3;
  lab.add(touch);
  // a soft disc of light the hoop leaves under Theo when it lands
  const landMat = new THREE.MeshBasicMaterial({ map: glow, color: blue.clone().multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), landMat);
  land.rotation.x = -Math.PI / 2;
  land.renderOrder = 2;
  lab.add(land);

  // hoop state, in board spaces for x/z and world units for height
  const H = { x: 3, z: 2, h: 0, alpha: 0, phi: 0, psi: 0, op: 0, bead: 0, touch: 0 };
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qc = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const placeHoop = () => {
    const p = lab.pos(H.x, H.z);
    hoop.position.set(p.x, H.h + 0.006, p.z);
    // tilt alpha from flat toward direction phi, then spin psi about its own axis
    qa.setFromAxisAngle(Y, Math.PI / 2 - H.phi);
    qb.setFromAxisAngle(X, H.alpha);
    qc.setFromAxisAngle(Y, H.psi);
    hoop.quaternion.copy(qa).multiply(qb).multiply(qc);
    hoopMat.opacity = H.op;
    beadMat.opacity = H.op * H.bead;
    // the lowest point of the hoop, where it meets the glass
    const lo = R * Math.cos(H.alpha);
    touch.position.set(p.x + lo * Math.cos(H.phi), 0.009, p.z + lo * Math.sin(H.phi));
    poolMat.opacity = H.touch * H.op;
  };

  // ----- bodies with weight: lean springs driven by each robot's acceleration -----
  const theoLean = spring(150, 6.5); // + = his top toward east
  const mayaNod = spring(170, 8); // + = her nose dips forward
  const motion = { mx: 1, tx: 3, mvx: 0, tvx: 0, mxPrev: 1, txPrev: 3, mvPrev: 0, tvPrev: 0, kickM: 0, kickT: 0 };
  const extra = { mx: 0, my: 0, mrot: 0, mroll: 0, mpitch: 0, tlift: 0, troll: 0 };
  const stopPhysics = lab.every((dt) => {
    if (dt <= 0) return;
    const mv = (motion.mx - motion.mxPrev) / dt;
    const tv = (motion.tx - motion.txPrev) / dt;
    const ma = (mv - motion.mvPrev) / dt + motion.kickM / dt;
    const ta = (tv - motion.tvPrev) / dt + motion.kickT / dt;
    motion.kickM = 0;
    motion.kickT = 0;
    motion.mxPrev = motion.mx;
    motion.txPrev = motion.tx;
    motion.mvPrev = mv;
    motion.tvPrev = tv;
    const lean = theoLean.step(dt, -ta * 0.42);
    const nod = mayaNod.step(dt, -ma * 0.3);
    // Theo faces south, so a lean of his top toward east is a roll to his left (negative)
    theo.set({ x: motion.tx, roll: -lean + extra.troll, lift: extra.tlift });
    maya.set({ x: motion.mx + extra.mx, y: 2 + extra.my, rot: EAST + extra.mrot, pitch: Math.max(-0.25, Math.min(0.3, nod)) + extra.mpitch, roll: extra.mroll });
    placeHoop();
  });

  // ----- 1. Maya rolls her free space and meets Theo -----
  const V1 = 4.6; // cruise speed, spaces/s
  const TA = 0.16; // getting up to speed
  const XA = 1 + 0.5 * V1 * TA;
  const XC = 2.37; // her nose meets his flank
  const TC = TA + (XC - XA) / V1;
  await lab.tween(TC, (e, k) => {
    const t = k * TC;
    motion.mx = t < TA ? 1 + 0.5 * (V1 / TA) * t * t : XA + V1 * (t - TA);
  }, ease.linear);

  // ----- 2. contact: Theo is whipped out from under his ring; the ring stays (inertia) -----
  if (theoRing) theoRing.visible = false;
  Object.assign(H, { x: 3, z: 2, h: 0, alpha: 0, phi: 0, psi: 0, op: 0.95, bead: 0, touch: 0 });
  motion.kickT = 0; // his velocity jump shows up as acceleration on its own
  const V2 = 3.1; // Maya after the shove
  const T2 = (2 * (3 - XC)) / V2; // she brakes to a stop on space 3
  const VT = 5.0; // Theo leaves faster than she arrives: he slides away from her
  const DT = 1.07; // he skids a hair past space 4...
  const TT = (2 * DT) / VT;
  const shove = lab.tween(Math.max(T2, TT) + 0.16, (e, k) => {
    const t = k * (Math.max(T2, TT) + 0.16);
    const tm = Math.min(t, T2);
    motion.mx = XC + V2 * tm - 0.5 * (V2 / T2) * tm * tm;
    if (t < TT) motion.tx = 3 + VT * t - 0.5 * (VT / TT) * t * t;
    else motion.tx = 3 + DT - (DT - 1) * ease.inOut(clamp01((t - TT) / 0.16)); // ...and eases back onto it
  }, ease.linear);
  // the ring is dragged a few centimetres by friction, then stops dead; a little 'tink' of a hop
  const left = lab.tween(0.34, (e, k) => {
    H.x = 3 + 0.06 * ease.out(clamp01(k / 0.35));
    H.h = Math.max(0, Math.sin(clamp01((k - 0.3) / 0.45) * Math.PI)) * 0.035;
    H.alpha = Math.sin(clamp01((k - 0.3) / 0.6) * Math.PI) * 0.12;
    H.phi = Math.PI; // its west edge lifts
  }, ease.linear);
  // as Maya drives through it, the ring rides up her nose onto her hips
  const scoop = lab.every(() => {
    const s = smooth(2.6, 3.0, motion.mx);
    if (s <= 0) return;
    H.x = Math.max(3.06, motion.mx + 0.2 * s);
    H.h = 0.15 * s;
    H.alpha = 0.24 * s;
    H.phi = 0;
  });
  await Promise.all([shove, left]);
  scoop();

  // ----- 3. a beat: Maya wears two rings and looks down at the wrong one -----
  await lab.tween(0.14, (e, k) => {
    H.h = 0.15 - 0.03 * Math.sin(k * Math.PI);
    extra.mpitch = 0.16 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
  }, ease.linear);

  // ----- 4. the shimmy: the hoop goes round her twice, faster and faster -----
  const TURNS = 2;
  const SHIM = 0.46;
  await lab.tween(SHIM, (e, k) => {
    const th = TAU * TURNS * (0.55 * k + 0.45 * k * k);
    const env = Math.min(1, k * 4);
    const ecc = 0.2 + 0.03 * Math.sin(th * 2);
    H.x = 3 + extra.mx + ecc * Math.cos(th);
    H.z = 2 + extra.my + ecc * Math.sin(th);
    H.h = 0.12 + 0.035 * Math.sin(th + 1);
    H.alpha = 0.24 + 0.05 * Math.sin(th);
    H.phi = th;
    H.psi = -th * 0.5;
    H.bead = env * 0.7;
    // her hips go round against the hoop
    extra.mx = -0.05 * env * Math.cos(th);
    extra.my = -0.05 * env * Math.sin(th);
    extra.mrot = 0.2 * env * Math.sin(th);
    extra.mroll = 0.09 * env * Math.sin(th + Math.PI / 2);
    extra.mpitch = 0.16 * (1 - Math.min(1, k * 3)) + 0.05 * env * Math.cos(th);
  }, ease.linear);

  // ----- 5. the fling: it flies off her east side and stands up on its edge -----
  const x0 = H.x;
  const z0 = H.z;
  const h0 = H.h;
  const a0 = H.alpha;
  const p0 = H.phi;
  const s0 = H.psi;
  const FLING = 0.16;
  await lab.tween(FLING, (e, k) => {
    const u = ease.out(k);
    H.x = x0 + (3.5 - x0) * u;
    H.z = z0 + (2 - z0) * u;
    H.alpha = a0 + (Math.PI / 2 - a0) * ease.out3(k);
    H.phi = p0 + (Math.PI / 2) * ease.out(k);
    H.h = h0 + (R - h0) * u + Math.sin(k * Math.PI) * 0.22;
    H.psi = s0 - 3.2 * k;
    H.bead = 0.7 + 0.3 * k;
    // Maya recoils from throwing it and settles back on her space
    const r = 1 - k;
    extra.mx = -0.05 * Math.sin(k * Math.PI) ;
    extra.my *= 0.7;
    extra.mrot = extra.mrot * 0.7 - 0.08 * Math.sin(k * Math.PI);
    extra.mroll *= 0.7;
    extra.mpitch = -0.1 * Math.sin(k * Math.PI) * r;
  }, ease.linear);

  // ----- 6. it rolls after Theo, right through his glass, and starts to spin -----
  const ROLL = 0.3;
  const psi1 = H.psi;
  const theoGlow = theo.model.paint.emissiveIntensity;
  theo.each = (m) => {
    // his glass catches his own ring's light as it passes through him
    const d = Math.abs(H.x - 4);
    const inside = H.op * (1 - smooth(0.2, 0.75, d)) * smooth(0.2, 1.2, H.alpha);
    m.paint.emissiveIntensity = theoGlow + 0.9 * inside;
  };
  await lab.tween(ROLL, (e, k) => {
    const u = ease.out(k);
    const x = 3.5 + 0.5 * u;
    H.x = x;
    H.h = R + Math.max(0, Math.sin(clamp01(k / 0.3) * Math.PI)) * 0.05 * (1 - k);
    H.alpha = Math.PI / 2;
    H.psi = psi1 - (x - 3.5) / R - 1.5 * k;
    // in the last part it curls into a spin about its own upright axis
    H.phi = Math.PI / 2 + 1.6 * clamp01((k - 0.55) / 0.45) ** 2;
    extra.mx *= 0.8;
    extra.mrot *= 0.8;
    extra.mpitch *= 0.8;
  }, ease.linear);
  extra.mx = 0;
  extra.my = 0;
  extra.mrot = 0;
  extra.mroll = 0;
  extra.mpitch = 0;

  // ----- 7. the spun coin: it falls, the wobble races faster and faster, and it lies flat -----
  const SPIN = 0.6;
  let phi = H.phi;
  let tPrev = 0;
  await lab.tween(SPIN, (e, k) => {
    const t = k * SPIN;
    const dt = t - tPrev;
    tPrev = t;
    // tilt: stays up for a moment, then falls faster and faster (Euler's disk)
    const alpha = (Math.PI / 2) * Math.pow(1 - k, 0.62) * (1 - 0.12 * Math.sin(k * Math.PI));
    const rate = 10 / Math.sqrt(Math.sin(alpha) + 0.07); // the wobble speeds up as it flattens
    phi += Math.min(rate, 34) * dt;
    H.alpha = alpha;
    H.phi = phi;
    H.h = R * Math.sin(alpha);
    H.x = 4;
    H.z = 2;
    H.bead = 1 - k * k;
    H.touch = smooth(0.15, 0.6, k) * (0.6 + 0.4 * k);
    // Theo rattles a little with it, then sits still
    extra.troll = Math.sin(phi) * 0.025 * smooth(0.3, 0.8, k) * (1 - smooth(0.88, 1, k));
  }, ease.linear);

  // ----- 8. flat: click, it is his ring again, glowing under him -----
  H.alpha = 0;
  H.h = 0;
  H.touch = 0;
  H.bead = 0;
  extra.troll = 0;
  if (theoRing) theoRing.visible = true;
  const ringMat = theo.model.ringMat;
  const pool = theo.model.poolMat;
  theo.each = (m) => {
    m.paint.emissiveIntensity = theoGlow + 0.5 * landMat.opacity;
  };
  const p4 = lab.pos(4, 2);
  land.position.set(p4.x, 0.007, p4.z);
  await lab.tween(0.2, (e, k) => {
    H.op = 0.95 * (1 - k);
    landMat.opacity = 0.9 * (1 - k) ** 1.5;
    ringMat.opacity = 0.9 + 0.1 * (1 - k);
    pool.opacity = 0.75 + 0.6 * (1 - k);
    extra.tlift = -0.012 * Math.sin(Math.min(1, k * 2) * Math.PI);
  }, ease.linear);
  extra.tlift = 0;
  stopPhysics();
  theo.each = null;
  hoop.visible = false;
  touch.visible = false;
  land.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
