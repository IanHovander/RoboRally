// Push, idea 46 (No Dodging), animator a: weight & physical comedy.
export const meta = {
  title: 'No Dodging: the bungee',
  idea:
    "Maya rolls on at an unhurried, deadpan pace. Theo sees her, crouches and leaps out of her lane toward the room, and the lane appears: a rail of warm light from her nose to a little stop on space 4, with a line of light from the rail to Theo like a bungee. It pays out, goes taut, and he hangs in the air at the end of it for a beat (the rail bent toward him like a plucked string), then it yanks him back down into line. He lands, unsquashes, has one moment of relief, and Maya arrives. Bonk: his runner slides along the rail and clacks into the stop on space 4, the string still humming, and he wobbles there facing south while the lane fades.",
  notes:
    "Sound: a curious glass 'tink' as he looks, a rising zip as the rail draws itself, a rubbery twang when the leash goes taut, a descending 'thwip' on the yank, a flat glass 'pok' as he lands, a soft bonk, a clack at the stop, and the rail humming down. Physics: the rail is a plucked string (the leash pulls it into a V toward him, and letting go sets it vibrating with a decaying standing wave); his body stretches on the launch and the yank, squashes on landing, and wobbles like a weeble after. Varies with the direction and the victim: the leap goes toward whichever side has more room (toward the room, away from it, or straight up for a duck-and-pop), always ending on the legal space; for a chain push every pushed robot gets its own runner on the same rail, and the stop sits on the first robot's landing space.",
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const F = (s) => Math.round(s * 30) / 30 - 0.004; // whole frames

function lineTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.36, 'rgba(255,255,255,.25)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(0.64, 'rgba(255,255,255,.25)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const EAST = facing(1);
  const SOUTH = facing(2);
  maya.set({ x: 1, y: 2, rot: EAST });
  theo.set({ x: 3, y: 2, rot: SOUTH });
  lab.playCard('a', ['m2']);

  const row = lab.pos(0, 2).z;
  const X = (sx) => lab.pos(sx, 2).x;
  const Z = (sy) => lab.pos(0, sy).z;
  const warm = new THREE.Color(lab.PALETTE.light);

  // ----- the rail: a strip of light lying along the row, a string that can be plucked -----
  const NR = 60;
  const lineTex = lineTexture(THREE);
  const railGeo = new THREE.PlaneGeometry(1, 1, NR, 1);
  const railMat = new THREE.MeshBasicMaterial({ map: lineTex, color: warm.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.frustumCulled = false;
  rail.renderOrder = 4;
  lab.add(rail);
  const railPos = railGeo.attributes.position.array;
  // the stop on space 4: a short bar across the row
  const capMat = new THREE.MeshBasicMaterial({ map: lineTex, color: warm.clone().multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), capMat);
  cap.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  cap.position.set(X(4), 0.012, row);
  cap.renderOrder = 4;
  lab.add(cap);
  // the runner: a bead of light on the rail where the leash is tied
  const beadMat = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), beadMat);
  lab.add(bead);
  // the leash: a tube of light, rebuilt every frame along a curve
  const leashMat = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const leash = new THREE.Mesh(new THREE.BufferGeometry(), leashMat);
  leash.frustumCulled = false;
  leash.renderOrder = 5;
  lab.add(leash);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());

  // rail state: a (west end), b (east end), grow 0..1, pluck: the V toward him (world z), at: where it's plucked (world x),
  // twang: the time it was let go
  const R = { a: 0, b: X(4), grow: 0, op: 0, pluck: 0, at: X(3), twangAt: null, twangAmp: 0 };
  const drawRail = (t) => {
    const xa = R.a;
    const xb = xa + (R.b - xa) * R.grow;
    for (let i = 0; i <= NR; i++) {
      const u = i / NR;
      const x = xa + (xb - xa) * u;
      // shape of a string pulled at R.at: a tent
      const ua = clamp01((R.at - xa) / Math.max(0.01, xb - xa));
      const tent = u < ua ? u / Math.max(0.01, ua) : (1 - u) / Math.max(0.01, 1 - ua);
      let dz = R.pluck * tent;
      if (R.twangAt != null) {
        const s = t - R.twangAt;
        dz += R.twangAmp * tent * Math.cos(s * 52) * Math.exp(-s / 0.2);
      }
      for (let j = 0; j < 2; j++) {
        const idx = (j * (NR + 1) + i) * 3;
        railPos[idx] = x;
        railPos[idx + 1] = 0.011;
        railPos[idx + 2] = row + dz + (j ? 0.05 : -0.05);
      }
    }
    railGeo.attributes.position.needsUpdate = true;
    railMat.opacity = R.op;
  };
  // the rail's z at a world x (for the runner riding it)
  const railZ = (x, t) => {
    const xa = R.a;
    const xb = xa + (R.b - xa) * R.grow;
    const u = clamp01((x - xa) / Math.max(0.01, xb - xa));
    const ua = clamp01((R.at - xa) / Math.max(0.01, xb - xa));
    const tent = u < ua ? u / Math.max(0.01, ua) : (1 - u) / Math.max(0.01, 1 - ua);
    let dz = R.pluck * tent;
    if (R.twangAt != null) {
      const s = t - R.twangAt;
      dz += R.twangAmp * tent * Math.cos(s * 52) * Math.exp(-s / 0.2);
    }
    return row + dz;
  };
  const L = { op: 0, sag: 0, r: 0.013 };
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const drawLeash = () => {
    leash.geometry.dispose();
    curve.v0.copy(A);
    curve.v2.copy(B);
    curve.v1.copy(A).lerp(B, 0.5);
    curve.v1.y -= L.sag;
    curve.v1.y = Math.max(0.012, curve.v1.y);
    leash.geometry = new THREE.TubeGeometry(curve, 24, L.r, 6, false);
    leashMat.opacity = L.op;
    leash.visible = L.op > 0.01 && A.distanceTo(B) > 0.02;
  };

  // ----- the whole moment on one clock -----
  const TC = 0.92; // Maya's nose meets Theo
  const XC = 2.37;
  const V = (XC - 1) / (TC - 0.075); // her deadpan cruise speed (after a short start)
  const TOTAL = F(1.95);
  const glint = theo.model.paint.emissiveIntensity;
  let bonked = false;
  let clacked = false;
  const hangY = 2.8;
  const hangLift = 0.48;

  await lab.tween(TOTAL, (e, k) => {
    const t = k * TOTAL;

    // --- Maya: inexorable. A short start, a steady roll, the shove, a stop on 3 ---
    let mx;
    if (t < 0.15) mx = 1 + (V * t * t) / (2 * 0.15);
    else if (t < TC) mx = 1 + V * (t - 0.075);
    else {
      const s = clamp01((t - TC) / 0.42);
      mx = XC + (3 - XC) * (1 - (1 - s) ** 2);
    }
    const nod = t > TC ? 0.14 * Math.sin(clamp01((t - TC) / 0.5) * Math.PI * 2) * Math.exp(-(t - TC) * 4) : 0;
    maya.set({ x: mx, pitch: nod });

    // --- Theo ---
    let tx = 3;
    let ty = 2;
    let lift = 0;
    let rot = SOUTH;
    let roll = 0;
    let pitch = 0;
    let sx = 1;
    let sy = 1;
    let sz = 1;
    // the take: he glances west at her, flinches, looks back
    const look = smooth(0.04, 0.1, t) * (1 - smooth(0.2, 0.26, t));
    rot += -0.65 * look;
    lift += 0.04 * Math.sin(clamp01((t - 0.18) / 0.1) * Math.PI);
    // crouch
    const crouch = smooth(0.24, 0.36, t) * (1 - smooth(0.36, 0.4, t));
    sy -= 0.3 * crouch;
    sx += 0.14 * crouch;
    sz += 0.14 * crouch;
    if (t >= 0.36 && t < 0.6) {
      // the leap toward the room, decelerating as the leash pays out
      const s = (t - 0.36) / 0.24;
      ty = 2 + (hangY - 2) * (1 - (1 - s) ** 2);
      lift = hangLift * Math.sin(s * Math.PI * 0.5) ** 0.8;
      const st = Math.exp(-s * 4);
      sy = 1 + 0.32 * st;
      sx = sz = 1 - 0.12 * st;
      pitch = -0.25 * s; // leaning back, looking pleased with himself
    } else if (t >= 0.6 && t < 0.74) {
      // taut: he stops dead at the end of the leash and hangs there, bobbing
      const s = t - 0.6;
      const bob = Math.exp(-s / 0.05) * Math.sin(s * 70);
      ty = hangY + 0.06 * bob;
      lift = hangLift + 0.02 * bob;
      sz = 1 + 0.22 * Math.exp(-s / 0.04); // his body keeps going a moment
      sy = 1 - 0.1 * Math.exp(-s / 0.04);
      pitch = -0.25 + 0.1 * smooth(0, 0.08, s);
      rot += 0.45 * smooth(0.03, 0.09, s); // he looks back at the leash: uh-oh
    } else if (t >= 0.74 && t < 0.84) {
      // the yank: back down into line, accelerating
      const s = (t - 0.74) / 0.1;
      const p = s * s * s;
      ty = hangY + (2 - hangY) * p;
      lift = hangLift * (1 - p) + 0.12 * Math.sin(s * Math.PI) * (1 - s);
      sz = 1 + 0.3 * s; // stretched along the yank
      sy = 1 - 0.1 * s;
      sx = 1 - 0.1 * s;
      pitch = 0.15 + 0.2 * s;
      rot += 0.45 * (1 - s);
    } else if (t >= 0.84 && t < TC) {
      // landed: flattened, then a breath of relief
      const s = (t - 0.84) / (TC - 0.84);
      sy = 0.6 + 0.42 * ease.out(s);
      sx = sz = 1.25 - 0.25 * ease.out(s);
    } else if (t >= TC) {
      // bonk: the runner slides to the stop on space 4 and clacks into it
      const s = t - TC;
      const p = clamp01(s / 0.3);
      tx = 3 + (1 - (1 - p) ** 2.5);
      // his top keeps going east when the stop catches him, and he wobbles like a weeble
      const w = s > 0.3 ? s - 0.3 : 0;
      const wob = s > 0.3 ? Math.exp(-w / 0.22) : 0;
      roll = s < 0.3 ? 0.12 * p : -0.3 * wob * Math.cos(w * 26);
      rot += s < 0.3 ? 0 : 0.28 * wob * Math.sin(w * 19);
      sx = 0.85 + 0.15 * ease.outElastic(clamp01(s / 0.35));
      sy = 1.06 - 0.06 * clamp01(s / 0.2);
    }
    theo.set({ x: tx, y: ty, lift, rot, roll, pitch, sx, sy, sz, trail: lift < 0.05 });

    // --- the rail: drawn from her nose to the stop just as he crouches ---
    R.a = X(mx) + 0.3;
    R.grow = smooth(0.18, 0.34, t) ** 0.7;
    R.op = smooth(0.18, 0.22, t) * (1 - smooth(1.55, 1.95, t)) * (1 + 0.35 * Math.exp(-Math.max(0, t - 0.34) / 0.08) * (t > 0.34 ? 1 : 0));
    capMat.opacity = smooth(0.3, 0.36, t) * (1 - smooth(1.6, 1.95, t)) * (1 + (clacked ? 1.6 * Math.exp(-(t - TC - 0.3) / 0.1) : 0));
    cap.scale.set(1 + (clacked ? 0.5 * Math.exp(-(t - TC - 0.3) / 0.1) : 0), 1, 1);
    // plucked toward him while he hangs; let go on the yank
    if (t >= 0.6 && t < 0.74) R.pluck = 0.24 * smooth(0, 0.05, t - 0.6) * (1 + 0.15 * Math.sin((t - 0.6) * 70) * Math.exp(-(t - 0.6) / 0.05));
    else if (t >= 0.74 && t < 0.78) R.pluck = 0.24 * (1 - (t - 0.74) / 0.04);
    else R.pluck = 0;
    if (t >= 0.78 && R.twangAt == null) {
      R.twangAt = lab.t;
      R.twangAmp = 0.16;
    }
    if (t >= TC + 0.3 && !clacked) {
      clacked = true;
      R.twangAt = lab.t;
      R.twangAmp = 0.06;
      R.at = X(4) - 0.4;
      lab.ring(lab.pos(4, 2), lab.PALETTE.light, 0.22, 0.03, 0.3);
    }
    if (t >= 0.84 && !bonked) {
      bonked = true;
      lab.ring(lab.pos(3, 2), lab.PALETTE.light, 0.28, 0.02, 0.3);
    }
    drawRail(lab.t);

    // --- the leash: from the runner on the rail to his body ---
    const theoW = lab.pos(tx, ty);
    const runX = theoW.x;
    A.set(runX, 0.014, railZ(runX, lab.t));
    B.set(theoW.x, lift + 0.2 * sy, theoW.z);
    if (t < 0.6) {
      // paying out: a little slack, drawn as he goes
      L.op = smooth(0.36, 0.4, t);
      L.sag = 0.12 * smooth(0.4, 0.5, t);
      L.r = 0.016;
    } else if (t < 0.74) {
      L.op = 1.4;
      L.sag = 0;
      L.r = 0.024 - 0.006 * smooth(0, 0.06, t - 0.6);
    } else {
      L.op = 1.2 * (1 - smooth(TC + 0.32, TC + 0.7, t));
      L.sag = 0;
      L.r = 0.016;
    }
    drawLeash();
    bead.position.copy(A);
    beadMat.opacity = smooth(0.36, 0.4, t) * (1 - smooth(1.55, 1.95, t));
    bead.scale.setScalar(1 + (t > 0.6 && t < 0.74 ? 0.6 : 0));

    // a flash of his glass when he's bonked
    theo.model.paint.emissiveIntensity = glint + (t > TC ? 1.4 * Math.exp(-(t - TC) / 0.08) : 0);
  }, ease.linear);

  theo.model.paint.emissiveIntensity = glint;
  rail.visible = false;
  cap.visible = false;
  bead.visible = false;
  leash.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
