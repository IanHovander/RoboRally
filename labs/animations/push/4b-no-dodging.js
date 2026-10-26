// No Dodging, animator b (character acting): Theo tries to slip out of the lane, and the rules keep him on a leash.
export const meta = {
  title: 'No Dodging (b): on a leash',
  idea:
    "Theo glances at Maya rolling his way, looks away, then does a double take. Panic: he crouches and leaps backward out of the lane, like a startled cat. " +
    'Maya slows to watch, unimpressed. The row lights up under the glass as a thin rail of light from her to space 4, a little leash of light whips up out of it, goes taut at the top of his hop ' +
    'and yanks him back into line with a thump. He looks at her, sheepish; she gives a slow tut-tut shake of the head, revs, and shoves him the one space east anyway. ' +
    'He slides like a sulking child, slumped and dim, still facing south; Jun, watching from the corner, doubles over laughing. The rail fades as they settle.',
  notes:
    'He hops away from the room (north) so the leash is drawn in front of him and reads from the sofa. Sound: a nervous two-note "uh-oh" chime on the double take, a springy glass "boing" for the hop, a taut twang as the leash catches, a soft thud on the landing, ' +
    "a deflated descending slide for Theo, and a tinkly giggle (fast tiny taps) from Jun. The dodge can vary each time (hop toward the room, hop away, a duck, a sidestep) " +
    "while the leash always brings him home: 'you can't dodge a push' in one look, and a running gag once the room knows it's coming. " +
    'Porting: the rail is two flat additive strips on the glass along the row (core and glow) with a cap on the landing space; the leash is a short tube rebuilt each frame along a curve that goes from slack to taut.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (T, a, b) => clamp((T - a) / (b - a));
  const bump = (T, a, b) => Math.sin(Math.PI * seg(T, a, b));
  const track = (keys) => (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = ease.inOut] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (T <= t1) return lerp(v0, v1, e((T - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  };
  const toward = (fx, fy, tx, ty) => Math.atan2(-(tx - fx), -(ty - fy));
  const unwrapNear = (a, ref) => ref + ((((a - ref + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const eyesOf = (m) => {
    const out = [];
    m.body.traverse((o) => o.isMesh && o.material === m.eyeMat && out.push(o));
    return out;
  };
  const mayaEyes = eyesOf(maya.model);
  const junEyes = eyesOf(jun.model);

  // ----- timing (play seconds) -----
  const GLANCE = 0.06;
  const TAKE = 0.3; // the double take
  const CROUCH = 0.4;
  const HOP = 0.5;
  const RAIL = 0.52;
  const TAUT = 0.7; // top of the hop: the leash catches
  const LAND = 0.84;
  const TUT = 1.0;
  const REV = 1.18;
  const CONTACT = 1.32;
  const STOP = 1.68;
  const END = 2.2;

  // ----- light -----
  const warm = (k) => new THREE.Color(1.0, 0.84, 0.62).multiplyScalar(k);
  const strip = (w, color, op) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, w), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    lab.add(mesh);
    return mesh;
  };
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const railCore = strip(0.022, warm(1.5), 0);
  const railGlow = strip(0.26, warm(0.55), 0);
  railGlow.material.map = glowTex;
  const cap = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.125, 40), new THREE.MeshBasicMaterial({ color: warm(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  cap.rotation.x = -Math.PI / 2;
  cap.position.copy(lab.pos(4, 2)).setY(0.012);
  lab.add(cap);
  // place the rail from x0 to x1 along row 2 (spaces)
  const setRail = (x0, x1, op) => {
    const a = lab.pos(x0, 2);
    const b = lab.pos(x1, 2);
    for (const m of [railCore, railGlow]) {
      m.position.set((a.x + b.x) / 2, 0.01, a.z);
      m.scale.set(Math.max(0.001, b.x - a.x), 1, 1);
    }
    railCore.material.opacity = op;
    railGlow.material.opacity = op * 0.7;
  };
  // the leash: a little tube along a curve from the rail to Theo, slack → taut
  const leashMat = new THREE.MeshBasicMaterial({ color: warm(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const leash = new THREE.Mesh(new THREE.BufferGeometry(), leashMat);
  leash.renderOrder = 4;
  lab.add(leash);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  const setLeash = (from, to, slack, grow) => {
    curve.v0.copy(from);
    curve.v2.copy(from).lerp(to, grow);
    const mid = from.clone().lerp(curve.v2, 0.5);
    mid.y -= slack * 0.35; // sags toward the glass when slack
    mid.x += slack * 0.18;
    curve.v1.copy(mid);
    leash.geometry.dispose();
    leash.geometry = new THREE.TubeGeometry(curve, 16, 0.02, 6, false);
  };
  lab.cleanup(() => leash.geometry.dispose());

  // ----- the robots -----
  // Maya: rolls, slows to a stop to watch his attempt, tut-tuts, revs and shoves
  const mayaX = track([[0, 1], [0.5, 1.75, ease.inOut], [0.8, 1.92, ease.out], [REV, 1.86, ease.inOut], [CONTACT, 2.4, ease.in], [STOP, 3, ease.out]]);
  // Theo: the hop toward the room and the yank back
  const theoY = (T) => {
    if (T < HOP) return 2;
    if (T < TAUT) return lerp(2, 1.18, ease.out(seg(T, HOP, TAUT)));
    if (T < LAND) return lerp(1.18, 2, ease.in3(seg(T, TAUT, LAND)));
    return 2 + 0.06 * bump(T, LAND, LAND + 0.1); // a little overshoot south
  };
  const theoLift = (T) => {
    if (T < HOP || T > LAND) return 0;
    if (T < TAUT) return 0.62 * Math.sin((Math.PI / 2) * ease.out(seg(T, HOP, TAUT)));
    return 0.62 * (1 - ease.in(seg(T, TAUT, LAND)));
  };
  const theoX = track([[CONTACT, 3], [STOP, 4, ease.out]]);
  const south = facing(2);
  const atMaya = south - 0.75; // turning his front west, toward her
  const theoRot = track([
    [GLANCE, south],
    [GLANCE + 0.08, atMaya + 0.25, ease.out],
    [0.2, atMaya + 0.25],
    [0.26, south, ease.inOut],
    [TAKE, south],
    [TAKE + 0.05, atMaya, ease.out],
    [CROUCH + 0.04, atMaya],
    [HOP + 0.06, south + 0.08, ease.out],
    [LAND, south],
    [LAND + 0.1, south],
    [LAND + 0.18, atMaya + 0.15, ease.out], // looks at her, sheepish
    [REV, atMaya + 0.15],
    [CONTACT - 0.06, south, ease.inOut],
  ]);
  const junHome = facing(3);
  const junAt = unwrapNear(toward(6, 0, 3, 1.5), junHome);

  const t0 = lab.t;
  let landed = 0;
  const stop = lab.every(() => {
    const T = lab.t - t0;
    // ---------- Theo ----------
    const crouch = seg(T, CROUCH, HOP) * (1 - seg(T, HOP, HOP + 0.05));
    const air = T > HOP && T < LAND ? 1 : 0;
    const stretch = air * (T < TAUT ? bump(T, HOP, TAUT + 0.06) : 0.3 * bump(T, TAUT, LAND));
    const thump = bump(T, LAND, LAND + 0.14);
    const startle = bump(T, TAKE, TAKE + 0.14);
    const yanked = T > TAUT && T < LAND ? seg(T, TAUT, TAUT + 0.05) : 0;
    const sulk = seg(T, CONTACT, CONTACT + 0.08) * (1 - seg(T, STOP + 0.1, END - 0.05));
    const sigh = bump(T, STOP + 0.04, STOP + 0.36);
    landed = thump;
    theo.set({
      x: theoX(T),
      y: theoY(T),
      lift: theoLift(T) + 0.04 * startle,
      rot: theoRot(T),
      pitch: -0.22 * crouch + 0.35 * yanked * (1 - seg(T, LAND - 0.04, LAND)) - 0.08 * startle, // yanked backwards by the scruff, then slumped
      roll: 0.1 * Math.sin(seg(T, HOP, TAUT) * Math.PI) * air,
      trail: !air, // no light trail while he's off the glass
      sy: 1 - 0.22 * crouch + 0.2 * stretch - 0.28 * thump + 0.1 * startle - 0.1 * sulk - 0.08 * sigh,
      sx: 1 + 0.14 * crouch - 0.08 * stretch + 0.18 * thump + 0.05 * sulk,
      sz: 1 + 0.14 * crouch - 0.08 * stretch + 0.18 * thump + 0.05 * sulk,
    });

    // ---------- Maya ----------
    const watching = seg(T, 0.5, 0.65) * (1 - seg(T, REV - 0.04, REV));
    const tut = seg(T, TUT, REV - 0.02);
    const tutShake = Math.sin(tut * TAU * 2) * 0.2 * Math.sin(Math.PI * tut);
    const rev = bump(T, REV - 0.04, CONTACT - 0.02);
    const proud = seg(T, STOP, STOP + 0.12) * (1 - seg(T, END - 0.2, END));
    maya.set({
      x: mayaX(T),
      rot: facing(1) + tutShake + 0.12 * watching, // head tilted toward his hop (toward the room)
      roll: -0.08 * watching,
      pitch: -0.18 * rev + 0.2 * seg(T, REV + 0.06, CONTACT) * (1 - seg(T, CONTACT, STOP)) - 0.12 * proud,
      sy: 1 - 0.06 * rev + 0.05 * proud,
    });

    // ---------- Jun ----------
    const look = seg(T, HOP, HOP + 0.15) * (1 - seg(T, END - 0.3, END - 0.04));
    const giggle = seg(T, LAND + 0.04, LAND + 0.1) * (1 - seg(T, STOP + 0.1, STOP + 0.35));
    const shake = Math.abs(Math.sin((T - LAND) * 34)) * giggle;
    jun.set({
      rot: lerp(junHome, junAt, ease.inOut(look)),
      pitch: 0.24 * giggle + 0.04 * shake,
      lift: 0.035 * shake,
      sy: 1 - 0.06 * giggle + 0.05 * shake,
    });

    // ---------- the rail and the leash ----------
    const mx = mayaX(T) + 0.35;
    const railIn = ease.out(seg(T, RAIL, RAIL + 0.1));
    const railOut = seg(T, STOP + 0.05, END - 0.02);
    // it fades from her end toward his: the lane is "used up" behind them
    const rx0 = lerp(mx, 4.3, ease.in(railOut));
    const rx1 = lerp(mx, 4.3, railIn);
    const flare = bump(T, TAUT - 0.02, LAND + 0.1);
    setRail(Math.min(rx0, rx1), rx1, T < RAIL ? 0 : (0.75 + 0.25 * flare) * (1 - railOut));
    cap.material.opacity = T < RAIL + 0.06 ? 0 : (0.7 + 0.3 * bump(T, RAIL + 0.06, RAIL + 0.25)) * (1 - railOut);
    cap.scale.setScalar(1 + 0.6 * bump(T, RAIL + 0.06, RAIL + 0.3));

    if (T > RAIL + 0.08 && T < LAND + 0.2) {
      const anchor = lab.pos(3, 2).setY(0.012);
      const tp = lab.pos(theo.pose.x, theo.pose.y).setY(theo.pose.lift + 0.24);
      const grow = ease.out(seg(T, RAIL + 0.08, TAUT - 0.03));
      const slack = 1 - seg(T, TAUT - 0.06, TAUT);
      setLeash(anchor, tp, slack, grow);
      leashMat.opacity = Math.min(1, seg(T, RAIL + 0.08, RAIL + 0.12) * (1 - seg(T, LAND, LAND + 0.18)));
      leashMat.color.copy(warm(2.2 + 2.5 * bump(T, TAUT - 0.03, TAUT + 0.12)));
    } else {
      leashMat.opacity = 0;
    }
  });

  // parts: eyes
  const base = [3.2, 3.1, 2.9];
  theo.each = (m) => {
    const T = lab.t - t0;
    const wide = bump(T, TAKE, HOP + 0.2);
    const dim = seg(T, LAND + 0.1, LAND + 0.2) * (1 - seg(T, STOP + 0.2, END));
    const g = 1 + 1.1 * wide - 0.6 * dim;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  maya.each = (m) => {
    const T = lab.t - t0;
    const lid = seg(T, 0.6, 0.72) * (1 - seg(T, REV - 0.06, REV)); // half-lidded: really?
    for (const e of mayaEyes) e.scale.set(1 - 0.5 * lid + 0.3 * bump(T, REV - 0.04, CONTACT), 1, 1);
    const g = 1 + 0.6 * bump(T, REV - 0.04, CONTACT + 0.1);
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };
  jun.each = (m) => {
    const T = lab.t - t0;
    const giggle = seg(T, LAND + 0.04, LAND + 0.1) * (1 - seg(T, STOP + 0.1, STOP + 0.35));
    for (const e of junEyes) e.scale.set(1, 1 - 0.65 * giggle, 1);
    const g = 1 + 0.4 * giggle;
    m.eyeMat.color.setRGB(base[0] * g, base[1] * g, base[2] * g);
  };

  // the landing: a small thump on the glass
  lab.at(LAND, () => {
    lab.ring(lab.pos(3, 2), '#ffd9a8', 0.36, 0.02, 0.3);
    lab.shake(0.025, 0.18);
  });
  void landed;

  lab.playCard('a', ['m2']);
  await lab.wait(END);
  stop();
  theo.each = null;
  maya.each = null;
  jun.each = null;
  for (const e of [...mayaEyes, ...junEyes]) e.scale.set(1, 1, 1);
  railCore.visible = railGlow.visible = cap.visible = leash.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
  jun.release({ x: 6, y: 0, d: 3 });
}
