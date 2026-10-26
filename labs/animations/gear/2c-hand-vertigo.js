// Gear, idea 2 (a hand in the dark), animator c: staged as a giant's entrance. The room goes down and the light
// gathers in a warm pool round Maya, like a lamp over a table. Then a vast soft darkness slides into that pool
// from the nearest edge and the picture does a slow vertigo (dolly zoom) while the camera leans over the board
// like a player leaning over the table. The darkness shrinks and sharpens into a hand, fingers spread round her;
// she looks up. The fingers close (a held beat), twist her a quarter, let go; the hand lifts away, swelling soft
// and sliding off, the pool fades, and Maya gives a little shiver.
export const meta = {
  title: 'The hand, in vertigo',
  idea:
    "The ghost of the cardboard game: a player's hand reaches in from above the TV, and all we see is its shadow, cut out of the light. The room dims to a warm pool round Maya, and a huge soft darkness slides into it from the nearest edge while the camera does a slow vertigo and leans over the board, as if we were the player leaning over the table. Coming down, the darkness shrinks and sharpens into a spread hand; Maya looks up at it. Thumb and fingers close on her (a held beat), twist her a quarter, let go, and the shadow swells and slides away as the light returns; she shivers it off.",
  notes:
    'Sound: the room hum drops as the pool gathers, a low muffled whoosh growing as the shadow sharpens, a soft glass "tock" as the fingers close, a dry quarter-turn click with the twist, then the hum swells back as it lifts and a tiny glass rattle with her shiver. The hand comes from whichever board edge is nearest the robot (here: the far edge, so it reaches in from above the TV); on a red gear it twists the other way. Porting: the shadow is a canvas silhouette (palm, five digits, forearm to a fixed shoulder) redrawn with a blur that grows with its height; one plane darkens the glass with it, another adds the lamp pool with the hand cut out. The vertigo keeps the board centre the same size while the field of view widens.',
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const S = 9; // the shadow canvas spans S x S world units round her
const CPX = 1024; // canvas pixels
const PX = CPX / S; // canvas pixels per space

// the digits, as polar tips round the pinch point (0 = straight on past her, away from the wrist; + = clockwise from above)
// [angle, open reach, closed reach, width, base x, base y]
const DIGITS = [
  [100, 0.98, 0.58, 0.27, 0.42, -0.66], // thumb
  [36, 1.12, 0.57, 0.23, 0.3, -0.36],
  [5, 1.2, 0.58, 0.24, 0.09, -0.3],
  [-27, 1.12, 0.57, 0.23, -0.14, -0.34],
  [-60, 0.94, 0.58, 0.2, -0.34, -0.46], // little finger
];

// draws the hand (pointing "south" in its own space: +y is toward the pinch point from the wrist)
function drawHand(g, close) {
  g.beginPath();
  g.ellipse(0, -0.46, 0.54, 0.56, 0, 0, TAU);
  g.fill();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [a, open, shut, w, bx, by] of DIGITS) {
    const r = open + (shut - open) * close;
    const ang = a * DEG;
    const tx = Math.sin(ang) * r;
    const ty = Math.cos(ang) * r;
    // a knuckle bend: the middle of the digit bows outward a little
    const mx = (bx + tx) / 2 + Math.sin(ang) * 0.08;
    const my = (by + ty) / 2 + Math.cos(ang) * 0.08 - 0.05;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(mx, my, tx, ty);
    g.stroke();
  }
}

export default async function play(lab) {
  const { THREE, ease, arena, PALETTE } = lab;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1;
  const centre = lab.pos(start.x, start.y);
  const W = lab.scenario.grid[0].trim().split(/\s+/).length;
  const H = lab.scenario.grid.length;
  // the nearest board edge: where the player reaches in from
  const edge = [
    { c: 0, d: start.y + 0.5 },
    { c: 90, d: W - start.x - 0.5 },
    { c: 180, d: H - start.y - 0.5 },
    { c: 270, d: start.x + 0.5 },
  ].sort((a, b) => a.d - b.d)[0];
  const ec = edge.c * DEG;
  const out = { x: Math.sin(ec), z: -Math.cos(ec) }; // from her toward that edge
  const maya = lab.puppet('a');
  const r0 = maya.pose.rot;

  // ---- canvases: the hand's darkness, and the lamp pool with the hand cut out of it ----
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = CPX;
    return c;
  };
  const handCv = mk();
  const hg = handCv.getContext('2d');
  const lampCv = mk();
  const lg = lampCv.getContext('2d');
  const handTex = new THREE.CanvasTexture(handCv);
  const lampTex = new THREE.CanvasTexture(lampCv);
  lampTex.colorSpace = THREE.SRGBColorSpace;
  const plane = (map, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(centre.x, 0.012, centre.z);
    return lab.add(m);
  };
  const lampMat = new THREE.MeshBasicMaterial({ map: lampTex, color: new THREE.Color(PALETTE.light).lerp(new THREE.Color('#ffc890'), 0.35).multiplyScalar(0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamp = plane(lampTex, lampMat);
  lamp.renderOrder = 3;
  const shadowMat = new THREE.MeshBasicMaterial({ map: handTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
  const shadow = plane(handTex, shadowMat);
  shadow.position.y = 0.013;
  shadow.renderOrder = 5;
  // world → canvas
  const cx = (wx) => CPX / 2 + (wx - centre.x) * PX;
  const cz = (wz) => CPX / 2 + (wz - centre.z) * PX;
  const shoulder = { x: centre.x + out.x * (edge.d + 3.2) - out.z * 0.6, z: centre.z + out.z * (edge.d + 3.2) + out.x * 0.6 };

  // ---- the room ----
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  const g0 = gear?.extra ?? 0;
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.dim = arena.dimCur = 0;
  });

  // state, driven by the beats below
  let h = 1; // height of the hand: 1 high up (huge, soft), 0 down on her
  let far = 1; // how far toward the edge it still is (1 = off the board)
  let close = 0; // fingers: 0 spread, 1 closed on her
  let twist = 0; // 0..1 of the quarter turn
  let pool = 0; // the warm pool of light round her
  let look = 0; // Maya looking up at it
  let pinch = 0; // her squeeze between the fingers
  let shiver = 0; // her shiver after it lets go
  let vert = 0; // vertigo amount
  const releaseCam = lab.camera((home) => {
    const fov = home.fov + 11 * vert;
    const k = Math.tan((home.fov / 2) * DEG) / Math.tan((fov / 2) * DEG);
    return { fov, dist: home.dist * k, el: home.el + 0.27 * vert, target: home.target.clone().lerp(centre, 0.25 * vert) };
  });

  const stop = lab.every(() => {
    // ---- the hand's shadow: high = big, soft, pale; low = small, sharp, dark ----
    const scale = 1 + 1.9 * h;
    const blur = 3 + 46 * h ** 1.15;
    const along = far * (edge.d + 2.2);
    const pivot = { x: centre.x + out.x * along, z: centre.z + out.z * along };
    const ang = ec + s * twist * (Math.PI / 2); // hand space: the wrist is at -y, toward the edge it came from
    hg.setTransform(1, 0, 0, 1, 0, 0);
    hg.clearRect(0, 0, CPX, CPX);
    hg.filter = `blur(${blur.toFixed(1)}px)`;
    hg.fillStyle = '#000';
    hg.strokeStyle = '#000';
    // the forearm: from the wrist to a shoulder that stays put (so the wrist turns, not the whole arm)
    const wristL = { x: 0, y: -0.86 * scale };
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const wrist = { x: pivot.x + (wristL.x * ca - wristL.y * sa), z: pivot.z + (wristL.x * sa + wristL.y * ca) };
    const sh = { x: shoulder.x + (pivot.x - centre.x) * 0.6, z: shoulder.z + (pivot.z - centre.z) * 0.6 };
    const arm = hg.createLinearGradient(cx(wrist.x), cz(wrist.z), cx(sh.x), cz(sh.z));
    arm.addColorStop(0, 'rgba(0,0,0,1)');
    arm.addColorStop(0.55, 'rgba(0,0,0,.85)');
    arm.addColorStop(1, 'rgba(0,0,0,0)');
    hg.strokeStyle = arm;
    hg.lineCap = 'round';
    hg.lineWidth = 0.62 * scale * PX;
    hg.beginPath();
    hg.moveTo(cx(wrist.x), cz(wrist.z));
    hg.lineTo(cx(sh.x), cz(sh.z));
    hg.stroke();
    hg.strokeStyle = '#000';
    // the hand itself
    hg.setTransform(1, 0, 0, 1, cx(pivot.x), cz(pivot.z));
    hg.rotate(ang);
    hg.scale(PX * scale, PX * scale);
    drawHand(hg, close);
    handTex.needsUpdate = true;
    const dark = Math.min(1, 0.95 - 0.6 * h) * Math.min(1, (1 - far) * 2.2 + 0.25);
    shadowMat.opacity = h > 0.999 && far > 0.999 ? 0 : dark;

    // ---- the lamp pool on the glass, the hand cut out of it ----
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, CPX, CPX);
    if (pool > 0.001) {
      lg.save();
      lg.beginPath();
      lg.rect(cx(-W / 2), cz(-H / 2), W * PX, H * PX); // only the glass catches it
      lg.clip();
      const R = 2.7 * PX;
      const grd = lg.createRadialGradient(CPX / 2, CPX / 2, 0, CPX / 2, CPX / 2, R);
      grd.addColorStop(0, `rgba(255,255,255,${0.95 * pool})`);
      grd.addColorStop(0.45, `rgba(255,255,255,${0.5 * pool})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      lg.fillStyle = grd;
      lg.fillRect(0, 0, CPX, CPX);
      lg.restore();
      lg.globalCompositeOperation = 'destination-out';
      lg.globalAlpha = Math.min(1, dark * 1.15);
      lg.drawImage(handCv, 0, 0);
      lg.globalAlpha = 1;
    }
    lampTex.needsUpdate = true;

    // ---- the room: the light gathers on her ----
    arena.dim = arena.dimCur = 0.5 * pool;
    arena.key.intensity = key0 * (1 - 0.35 * pool);
    arena.hemi.intensity = hemi0 * (1 - 0.3 * pool);

    // ---- the gear turns with the hand, as the game's own gear does ----
    if (gear) gear.extra = g0 - s * (Math.PI / 2) * twist;

    // ---- Maya ----
    const shv = Math.sin(shiver * TAU * 3.5) * 0.09 * Math.sin(shiver * Math.PI);
    const sq = pinch;
    maya.set({
      rot: r0 - s * twist * (Math.PI / 2) + shv * 0.5,
      pitch: -0.22 * look,
      roll: shv,
      sx: 1 - 0.09 * sq,
      sz: 1 - 0.09 * sq,
      sy: 1 + 0.07 * sq - 0.04 * look,
    });
  });
  // how much of her is in the hand's shadow
  const coverNow = () => Math.max(0, Math.min(1, (1 - far * 2.5) * (1 - h * 0.8)));
  maya.each = (m) => {
    const cv = coverNow();
    const d = 1 - 0.7 * cv;
    const alarm = 1 + 0.6 * look * (1 - cv * 0.5);
    m.paint.emissiveIntensity = 0.16 * d;
    m.eyeMat.color.setRGB(3.2 * d * alarm, 3.1 * d * alarm, 2.9 * d * alarm);
    m.ringMat.opacity = 0.9 * (1 - 0.65 * cv);
    m.poolMat.opacity = 0.75 * (1 - 0.85 * cv);
  };

  // ---- beats ----
  // the room goes down and the light gathers on her; the camera starts its slow vertigo
  lab.tween(0.3, (e) => (pool = e), ease.out);
  lab.tween(0.62, (e) => (vert = e), ease.inOut);
  // she notices, and looks up
  lab.at(0.28, () => lab.tween(0.18, (e) => (look = e), ease.outBack));
  // the darkness slides in from the edge and comes down: shrinks and sharpens into a hand
  await lab.tween(
    0.6,
    (e, k) => {
      far = 1 - ease.out(Math.min(1, k * 1.35));
      h = 1 - e;
    },
    ease.inOut,
  );
  // thumb and fingers close on her: a held beat
  await lab.tween(
    0.08,
    (e) => {
      close = e;
      pinch = e;
    },
    ease.in,
  );
  lab.shake(0.01, 0.1);
  await lab.wait(0.1);
  // the quarter twist; she turns with it
  await lab.tween(
    0.34,
    (e) => {
      twist = e;
      look = 1 - 0.7 * e;
    },
    ease.inOut3,
  );
  await lab.wait(0.04);
  // let go
  await lab.tween(
    0.08,
    (e) => {
      close = 1 - e;
      pinch = 1 - e;
    },
    ease.out,
  );
  // the hand lifts away: the shadow swells soft and slides back off the edge; the light returns
  lab.tween(0.44, (e) => (vert = 1 - e), ease.inOut);
  lab.tween(0.2, (e) => (look = 0.3 * (1 - e)), ease.out);
  lab.at(0.12, () => lab.tween(0.24, (e) => (shiver = e), ease.linear));
  lab.at(0.1, () => lab.tween(0.34, (e) => (pool = 1 - e), ease.inOut));
  await lab.tween(
    0.44,
    (e, k) => {
      h = e;
      far = ease.in(Math.max(0, (k - 0.12) / 0.88));
    },
    ease.inOut,
  );
  stop();
  lamp.visible = shadow.visible = false;
  if (gear) gear.extra = g0 - s * (Math.PI / 2);
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.dim = arena.dimCur = 0;
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
