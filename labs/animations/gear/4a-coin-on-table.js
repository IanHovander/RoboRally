// Gear, idea 4 (coin on a table), animator a: weight & physical comedy.
export const meta = {
  title: 'Coin on a table',
  idea:
    "The gear kicks and Maya pops up onto the rim of her base like a coin knocked on its edge. She wobbles round and round, slow and lazy at first, then faster and flatter, her ring of light wobbling with her while the rim's contact point scribbles a circle of light on the glass that gets brighter and quicker. Her heading creeps a quarter round to east, hidden inside the wobble. Then she slaps flat with a tiny squash and EVERYTHING stops dead: the scribble goes out in the same frame. A beat of total stillness, and she blinks.",
  notes:
    'Real Euler-disk physics: the tilt shrinks while the wobble speeds up, she rocks on the edge of her own base (each form has its own base radius, so a Cube wobbles tighter than a Pebble), and the heading turns exactly 90° with no overshoot. Sound: a glassy whirr that rises in pitch with the wobble and cuts to silence on the slap; the visual cut is the scribble of light vanishing in one frame. The deadpan blink after the stillness is the button. Red gears: the wobble circles anticlockwise. Seeded: the starting tilt side and wobble speed vary a little each time.',
};

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
// each form's base (half width across, half length along its heading), model units before the robot's scale
const BASE = [
  [0.36, 0.36], // Pebble
  [0.27, 0.27], // Orb (its dark ring)
  [0.27, 0.3], // Prism
  [0.16, 0.3], // Capsule
  [0.23, 0.23], // Cube
  [0.22, 0.22], // Spire
];
const SCALE = 1.3; // scene.js draws every robot at this size

function dotTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const sc = lab.scenario;
  const A = sc.bots.a;
  const after = sc.after.a;
  const gear = lab.arena.gears.get(`${A.x},${A.y}`);
  const spin = gear?.spin ?? 1; // 1 = right (clockwise from above), -1 = left
  const rot0 = facing(A.d);
  const rot1 = rot0 - spin * (Math.PI / 2);
  const C = lab.pos(A.x, A.y);
  const maya = lab.puppet('a');
  const model = maya.model;
  const [bw, bl] = BASE[model.form ?? 0] ?? BASE[0];
  maya.set({ trail: false });

  // ----- timing (scene seconds) -----
  const T_TIP = 0.16; // up on the rim
  const T_DROP = 1.24; // slaps flat
  const T_BLINK = 1.5;
  const T_END = 1.62;
  const theta0 = 0.34 + lab.range(-0.02, 0.03);
  const om0 = 1.5 + lab.range(0, 0.3); // wobble, turns per second, at the start...
  const om1 = 6.2; // ...and just before the slap
  const phi0 = rot0 + spin * (Math.PI / 2) + lab.range(-0.3, 0.3); // first leans to her left side
  const W = T_DROP - T_TIP;
  // the wobble's angle travelled by time tau into it (closed form of the integral of om0 + (om1 - om0) (s/W)^2.2)
  const P = 2.2;
  const travelled = (tau) => TAU * (om0 * tau + ((om1 - om0) * W * Math.pow(tau / W, P + 1)) / (P + 1));

  // ----- the scribble: where the rim touches the glass, drawn in warm light -----
  const tex = dotTex(THREE);
  const N = 70;
  const dots = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(lab.PALETTE.light).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 3;
    m.visible = false;
    lab.add(m);
    dots.push({ m, t: -9, born: 0 });
  }
  let di = 0;
  let lastContact = null;

  const red = new THREE.Color(lab.bot('a').color);
  const ringBase = red.clone().multiplyScalar(1.6);
  const eyeBase = new THREE.Color(3.2, 3.1, 2.9);
  const tag = lab.bot('a').tag;
  const tagWorld = new THREE.Vector3(C.x, 0.86 * SCALE, C.z);

  const t0 = lab.t;
  let dropped = false;
  let state = { theta: 0, phi: phi0, rot: rot0 };

  // the gear kicks: its light pulses, Maya gets a jolt from below
  if (gear) gear.pulse = lab.arena.time;
  const gearFrom = gear ? gear.extra : 0;

  await new Promise((done) => {
    const stop = lab.every(() => {
      const t = lab.t - t0;
      let theta = 0;
      let phi = phi0;
      let heading = rot0;
      let sx = 1;
      let sy = 1;
      let jx = 0;

      if (t < T_TIP) {
        // the kick: a little jolt sideways, then up on the rim with a catch (overshoot and settle)
        const k = t / T_TIP;
        theta = theta0 * ease.outBack(k);
        jx = Math.sin(Math.PI * seg(t, 0, 0.08)) * 0.03 * spin;
        sy = 1 + 0.06 * Math.sin(Math.PI * k);
        sx = 1 - 0.03 * Math.sin(Math.PI * k);
      } else if (t < T_DROP) {
        const tau = t - T_TIP;
        const k = tau / W;
        // tilt flattens (fast at the end, like a coin), wobble speeds up
        theta = theta0 * Math.pow(1 - k, 0.62) * (1 + 0.05 * Math.sin(tau * 9));
        theta = Math.max(theta, 0.035); // it never quite lies flat until the slap
        phi = phi0 - spin * travelled(tau);
        // the heading creeps round steadily, no overshoot
        const s = Math.pow(k, 1.25);
        heading = rot0 + (rot1 - rot0) * s;
      } else {
        heading = rot1;
        phi = phi0 - spin * travelled(W);
        // the slap: the last sliver of tilt goes in two frames, then a tiny squash and dead stillness
        const k = seg(t, T_DROP, T_DROP + 0.05);
        theta = 0.035 * (1 - k);
        const sq = seg(t, T_DROP + 0.03, T_DROP + 0.16);
        const squash = sq <= 0 ? 0 : sq < 0.35 ? sq / 0.35 : 1 - (sq - 0.35) / 0.65;
        sy = 1 - 0.07 * squash;
        sx = 1 + 0.035 * squash;
        if (!dropped && k >= 1) {
          dropped = true;
          // the cut: the scribble goes out all at once
          for (const d of dots) d.m.visible = false;
        }
      }

      // the pose: tip about the rim on the side she leans to
      const ux = -Math.sin(phi);
      const uz = -Math.cos(phi);
      const a = Math.cos(phi - heading); // lean forward part
      const b = -Math.sin(phi - heading); // lean right part
      const R = Math.max(0.42, SCALE * Math.hypot(bw * b, bl * a));
      const slide = R * (1 - Math.cos(theta));
      maya.set({
        x: A.x + slide * ux + jx,
        y: A.y + slide * uz,
        lift: R * Math.sin(theta),
        rot: heading,
        pitch: theta * a,
        roll: theta * b,
        sx,
        sz: sx,
        sy,
      });
      state = { theta, phi, rot: heading };

      // the gear's arrow turns with her
      if (gear) gear.extra = gearFrom - spin * (Math.PI / 2) * clamp01((heading - rot0) / (rot1 - rot0));

      // the scribble of light where the rim touches the glass
      if (t >= T_TIP * 0.6 && t < T_DROP) {
        const contact = new THREE.Vector3(C.x + (A.x - A.x) + ux * R * Math.cos(theta) * 0.98, 0.012, C.z + uz * R * Math.cos(theta) * 0.98);
        contact.x += slide * ux;
        contact.z += slide * uz;
        // fill in between frames so the circle stays a line even when the wobble is fast
        const from = lastContact ?? contact;
        const steps = Math.max(1, Math.min(6, Math.ceil(from.distanceTo(contact) / 0.07)));
        for (let s = 1; s <= steps; s++) {
          const d = dots[di++ % N];
          d.m.position.lerpVectors(from, contact, s / steps);
          d.t = t;
          d.m.visible = true;
        }
        lastContact = contact;
      }
      // brighter and shorter-lived as the wobble speeds up (the whirr rising)
      const speedK = seg(t, T_TIP, T_DROP);
      const life = 0.32 - 0.16 * speedK;
      const bright = 0.35 + 0.9 * speedK * speedK;
      if (!dropped) {
        for (const d of dots) {
          if (!d.m.visible) continue;
          const age = t - d.t;
          if (age > life) {
            d.m.visible = false;
            continue;
          }
          d.m.material.opacity = bright * (1 - age / life);
          d.m.scale.setScalar(0.8 + 0.6 * speedK);
        }
      }

      if (t >= T_END) {
        stop();
        done();
      }
    });

    maya.each = (m) => {
      const t = lab.t - t0;
      // her light hums with the wobble, then holds dead steady after the slap
      const hum = t < T_DROP ? 0.15 * seg(t, T_TIP, T_DROP) * (0.5 + 0.5 * Math.sin(t * 60)) : 0;
      const blink = t > T_BLINK && t < T_BLINK + 0.075 ? 0.04 : 1;
      m.eyeMat.color.copy(eyeBase).multiplyScalar((1 + hum) * blink);
      m.ringMat.color.copy(ringBase).multiplyScalar(1 + hum);
      // keep her name where it was, upright and unsquashed
      if (tag) {
        maya.group.updateMatrixWorld(true);
        const local = maya.group.worldToLocal(tagWorld.clone());
        tag.position.copy(local);
      }
    };
  });

  maya.each = null;
  model.eyeMat.color.copy(eyeBase);
  model.ringMat.color.copy(ringBase);
  if (tag) tag.position.set(0, 0.86, 0);
  if (gear) gear.extra = gearFrom - spin * (Math.PI / 2);
  void state;
  maya.release({ x: after.x, y: after.y, d: after.d });
}
