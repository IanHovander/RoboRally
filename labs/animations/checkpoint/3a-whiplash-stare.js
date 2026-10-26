// Checkpoint, idea 3 (Heads turn), animator a: weight and physical comedy.
export const meta = {
  title: 'Whiplash stare',
  idea:
    'The instant Maya claims flag 1, Theo whips round to stare so fast his whole body leans out of the turn and overshoots, then cranes in, stretching tall. Even flag 2\'s column leans over for a look. Maya turns her head: caught. Theo snaps back so hard he spins past his own facing and wobbles on the spot like a struck bell, shrinking, and the column springs upright a beat after him. Maya holds the glare, then turns back to the east.',
  notes:
    'Sound: a soft glass swish for the whip (one per robot, slightly detuned so five robots make a chord), silence for the stare, a tiny "tink" when Maya turns, then a fast falling swish and a wobbling glass hum as they snap back. On a real board every robot that is not Maya does the same, each with its own small random delay (0-60 ms) and spring stiffness so the snap back is a ragged volley; the other flags\' columns lean too. Everyone ends on their own facing, so the rules are untouched.',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const wrap = (a) => {
  const T = Math.PI * 2;
  return ((((a + Math.PI) % T) + T) % T) - Math.PI;
};
/** A damped spring going 0 -> 1 (w: stiffness in rad/s, z: damping ratio < 1 overshoots). */
const spring = (t, w, z) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const me = lab.bot('a');
  const RED = new THREE.Color(me.color);
  const F = lab.pos(4, 1);
  const T = lab.pos(5, 3);
  const EAST = facing(1);
  const col1 = arena.columns.find((c) => c.n === 1);
  const col2 = arena.columns.find((c) => c.n === 2);

  // Theo's own facing, and the way that looks straight at Maya
  const theoBase = theo.pose.rot;
  const toMaya = Math.atan2(-(F.x - T.x), -(F.z - T.z));
  const dLook = wrap(toMaya - theoBase);
  // Maya's glance back at him
  const toTheo = Math.atan2(-(T.x - F.x), -(T.z - F.z));
  const dGlance = wrap(toTheo - EAST) * 0.8;

  // the taken ring she gets: the game's own ring, dropped in
  const ring = lab.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.8) })));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(F.x, 0.06, F.z);
  ring.visible = false;

  const MOVE = 0.6;
  const CLAIM = 0.58;
  const WHIP = 0.66;
  const LEAN2 = 0.74;
  const CAUGHT = 1.42;
  const SNAP = 1.52;
  const BACK = 2.02;
  const END = 2.5;

  lab.playCard('a', ['m2']);
  const t0 = lab.t;
  let lastTheo = theoBase;
  let roll = 0;
  const stop = lab.every((dt) => {
    const t = lab.t - t0;

    // ---------- Maya: drive in, brake (her mass carries her nose forward), then the glance ----------
    const km = seg(t, 0, MOVE);
    const brake = t - MOVE * 0.72;
    let mp = -0.08 * Math.sin(Math.PI * seg(t, 0, MOVE * 0.5));
    if (brake > 0) mp += 0.26 * Math.exp(-brake * 7) * Math.sin(brake * 15);
    let mrot = EAST;
    let msy = 1;
    if (t > CAUGHT) {
      const turnIn = spring(t - CAUGHT, 34, 0.55);
      const turnOut = ease.inOut(seg(t, BACK, BACK + 0.36));
      mrot = EAST + dGlance * turnIn * (1 - turnOut);
      // a narrow-eyed little rise as she looks
      msy = 1 + 0.06 * Math.sin(Math.PI * seg(t, CAUGHT, CAUGHT + 0.24));
    }
    maya.set({ x: 2 + 2 * ease.inOut3(km), rot: mrot, pitch: mp, sy: msy, sx: 2 - msy, sz: 2 - msy });

    // ---------- Theo ----------
    let rot = theoBase;
    let pitch = 0;
    let sy = 1;
    if (t >= WHIP && t < SNAP) {
      rot = theoBase + dLook * spring(t - WHIP, 26, 0.34);
      // craning in to see better, and creeping further the longer he looks
      const crane = ease.out(seg(t, WHIP + 0.08, WHIP + 0.4));
      const creep = seg(t, WHIP + 0.4, SNAP);
      sy = 1 + 0.12 * crane + 0.03 * creep;
      pitch = 0.14 * crane + 0.08 * creep;
    } else if (t >= SNAP) {
      // caught: snaps back far too fast, spins past his own facing and rings like a struck bell
      const s = spring(t - SNAP, 36, 0.2);
      rot = theoBase + dLook * (1 - s);
      const k = seg(t, SNAP, SNAP + 0.5);
      sy = 1 - 0.1 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k * 0.3);
      pitch = -0.12 * Math.sin(Math.PI * seg(t, SNAP, SNAP + 0.35));
      const end = seg(t, BACK, END - 0.05);
      sy += (1 - sy) * end;
      pitch *= 1 - end;
    }
    // his mass leans out of the turn (centrifugal), lagging a little behind it
    const w = dt > 0 ? wrap(rot - lastTheo) / dt : 0;
    lastTheo = rot;
    roll += (Math.max(-0.35, Math.min(0.35, w * 0.016)) - roll) * Math.min(1, dt * 22);
    if (t > END - 0.12) roll *= 0.5;
    // he creeps a hair toward her while he cranes, and is jerked home by the snap
    const creepIn = t >= WHIP && t < SNAP ? 0.16 * ease.inOut(seg(t, WHIP + 0.15, SNAP)) : t >= SNAP ? 0.16 * Math.max(0, 1 - spring(t - SNAP, 40, 0.5)) : 0;
    const len = Math.hypot(F.x - T.x, F.z - T.z);
    // caught: a startled little hop as he snaps round
    const hop = t >= SNAP - 0.03 ? Math.sin(Math.PI * seg(t, SNAP - 0.03, SNAP + 0.15)) : 0;
    theo.set({ rot, x: 5 + ((F.x - T.x) / len) * creepIn, y: 3 + ((F.z - T.z) / len) * creepIn, lift: 0.08 * hop });
    const stare = t >= WHIP && t < SNAP ? seg(t, WHIP, WHIP + 0.1) : 0;
    const guilt = t >= SNAP ? 1 - seg(t, SNAP + 0.2, END) : 0;
    // the lean, the roll and the stretch are the body's: his ring and pointer stay flat on the glass
    theo.each = (m) => {
      const g = 1 + 0.9 * stare - 0.45 * guilt;
      m.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g);
      m.body.rotation.x = -pitch;
      m.body.rotation.z = -roll;
      m.body.scale.set(1 - (sy - 1) * 0.5, sy, 1 - (sy - 1) * 0.5);
    };
    maya.each = (m) => {
      const g = 1 + 1.2 * Math.max(0, 1 - Math.abs(t - CAUGHT - 0.05) / 0.12);
      m.eyeMat.color.setRGB(3.2 * g, 3.1 * g, 2.9 * g);
    };

    // ---------- flag 1: a short claim flash in her colour, her ring drops in ----------
    if (col1) {
      const f = t > CLAIM ? Math.max(0, 1 - (t - CLAIM) / 0.9) ** 1.5 : 0;
      if (f > 0) {
        col1.mat.color.lerp(RED, f * 0.7).multiplyScalar(1 + 1.6 * f);
        col1.col.scale.x = 1 + 0.45 * f;
      }
    }
    if (t > CLAIM) {
      const kd = seg(t, CLAIM, CLAIM + 0.34);
      ring.visible = true;
      // falls from her waist and bounces once on the glass
      const h = kd < 0.55 ? 0.42 * (1 - (kd / 0.55) ** 2) : 0.07 * Math.sin(Math.PI * ((kd - 0.55) / 0.45));
      ring.position.y = 0.06 + h;
    }

    // ---------- flag 2's column leans over for a look too, and springs upright a beat after Theo ----------
    if (col2) {
      let lean = 0;
      if (t >= LEAN2 && t < SNAP + 0.1) lean = -0.3 * spring(t - LEAN2, 14, 0.5);
      else if (t >= SNAP + 0.1) lean = -0.3 * (1 - spring(t - SNAP - 0.1, 30, 0.16));
      col2.col.rotation.z = lean;
    }
  });

  // the claim itself: a ring of her light runs out over the glass (the game's own ring, smaller)
  lab.at(CLAIM + 0.02, () => lab.ring(lab.pos(4, 1), me.color, 1.3, 0.02, 0.7));

  await lab.wait(END);
  stop();
  if (col2) col2.col.rotation.z = 0;
  arena.setTaken([{ cp: 1, color: me.color }]);
  lab.cleanup(() => arena.setTaken([]));
  ring.visible = false;
  theo.each = null;
  maya.each = null;
  const tb = lab.bot('b').model.body;
  tb.rotation.z = 0;
  tb.scale.set(1, 1, 1);
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
}
