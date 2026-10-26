// Gear, idea 2 (a hand in the dark), animator c: staged as a giant's entrance. The room's one light is blocked:
// a vast soft shadow slides onto the glass from the nearest edge and the picture does a slow vertigo
// (dolly-zoom) as it comes down, shrinking and sharpening into a hand. The grid goes out under it. Maya looks
// up; the fingers close (a held beat), twist her a quarter, let go; the hand lifts away, the shadow swells
// soft and slides off, and the light comes back.
export const meta = {
  title: 'The hand, in vertigo',
  idea:
    "The ghost of the cardboard game: a player's hand reaches in from above the TV, and all we see is its shadow, made of missing light. It arrives as a huge soft blur from the nearest edge while the camera does a slow vertigo (the board's perspective stretches as if something enormous were bending the room), then shrinks and sharpens into a clear hand as it comes down; the glass's light goes out under it and Maya looks up. Thumb and finger close on her (a held beat), twist her a quarter, let go, and the shadow swells and slides away as the light returns.",
  notes:
    'Sound: the room hum drops as the light is blocked (a low muffled whoosh growing as the shadow sharpens), a soft glass "tock" as the fingers close, a dry quarter-turn click, then the hum swells back as it lifts. The hand comes from whichever board edge is nearest the robot; on a red gear it twists the other way. Porting: the shadow is a canvas silhouette redrawn with a blur that grows with its height, laid on the glass with normal blending; the vertigo keeps the board centre the same size while the field of view widens.',
};

const TAU = Math.PI * 2;
const PX = 512 / 6; // canvas pixels per space: the shadow canvas spans 6 x 6 spaces round the pinch

function drawHand(g, blur, rc) {
  g.clearRect(0, 0, 512, 512);
  g.save();
  g.translate(256, 256);
  g.scale(PX, PX);
  g.filter = `blur(${blur.toFixed(1)}px)`;
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  // forearm, fading toward the shoulder (it is higher up, so softer and paler)
  const arm = g.createLinearGradient(0, -1.5, 0, -3.1);
  arm.addColorStop(0, 'rgba(0,0,0,1)');
  arm.addColorStop(1, 'rgba(0,0,0,0)');
  g.strokeStyle = arm;
  g.lineWidth = 0.66;
  g.beginPath();
  g.moveTo(0.06, -1.55);
  g.lineTo(0.3, -3.2);
  g.stroke();
  g.strokeStyle = '#000';
  // palm and wrist
  g.beginPath();
  g.ellipse(0.02, -1.18, 0.5, 0.52, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(0.05, -1.62, 0.34, 0.3, 0, 0, TAU);
  g.fill();
  // the other fingers, curled under: a row of knuckles
  for (const [x, y, r] of [[-0.12, -0.8, 0.18], [-0.31, -0.9, 0.16], [-0.45, -1.06, 0.14]]) {
    g.beginPath();
    g.ellipse(x, y, r, r * 1.1, 0, 0, TAU);
    g.fill();
  }
  // thumb and index finger, open round her or closed on her
  g.lineWidth = 0.23;
  g.beginPath();
  g.moveTo(0.4, -1.02);
  g.quadraticCurveTo(0.58, -0.42, rc, -0.02);
  g.stroke();
  g.lineWidth = 0.19;
  g.beginPath();
  g.moveTo(0.1, -0.78);
  g.quadraticCurveTo(-0.36, -0.5, -rc, 0.03);
  g.stroke();
  g.restore();
}

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const start = lab.scenario.bots.a;
  const end = lab.scenario.after.a;
  const gear = arena.gears.get(`${start.x},${start.y}`);
  const s = gear?.spin ?? 1;
  const centre = lab.pos(start.x, start.y);
  const W = lab.scenario.grid[0].trim().split(/\s+/).length;
  const Hh = lab.scenario.grid.length;
  // the nearest board edge: where the player is sitting
  const edges = [
    { c: 0, d: start.y + 0.5 },
    { c: 90, d: W - start.x - 0.5 },
    { c: 180, d: Hh - start.y - 0.5 },
    { c: 270, d: start.x + 0.5 },
  ].sort((a, b) => a.d - b.d);
  const edge = edges[0];
  const ec = (edge.c * Math.PI) / 180;
  const out = new THREE.Vector3(Math.sin(ec), 0, -Math.cos(ec)); // from her toward the edge
  const maya = lab.puppet('a');
  const r0 = maya.pose.rot;

  // ---- the shadow ----
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
  shadow.rotation.order = 'YXZ';
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 5;
  lab.add(shadow);

  // ---- the room: the hand blocks its one light ----
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  lab.cleanup(() => {
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    arena.dim = arena.dimCur = 0;
  });

  // state, driven by the beats below
  let h = 1; // height of the hand: 1 high up (huge, soft), 0 down on her
  let far = 1; // how far toward the edge it still is (1 = off the board)
  let rc = 0.62; // finger tips: open round her ring, or closed on her
  let twist = 0; // 0..1 of the quarter turn
  let cover = 0; // how much of her is in its shadow
  let look = 0; // Maya looking up at it
  let pinch = 0; // her squeeze between the fingers
  let vert = 0; // vertigo amount
  const releaseCam = lab.camera((home) => {
    const fov = home.fov + 9 * vert;
    const k = Math.tan(((home.fov / 2) * Math.PI) / 180) / Math.tan(((fov / 2) * Math.PI) / 180);
    return { fov, dist: home.dist * k, el: home.el + 0.05 * vert };
  });

  const stop = lab.every(() => {
    // a high hand casts a big, soft, pale shadow; low, it is small, sharp and dark
    const scale = 1 + 1.5 * h;
    drawHand(g, 2 + 30 * h ** 1.2, rc);
    tex.needsUpdate = true;
    const along = far * (edge.d + 1.6);
    shadow.position.set(centre.x + out.x * along, 0.012, centre.z + out.z * along);
    shadow.scale.setScalar(scale);
    shadow.rotation.y = -ec - s * twist * (Math.PI / 2);
    mat.opacity = Math.min(1, (0.92 - 0.55 * h) * (1 - far * 0.35)) * (h < 0.999 || far < 0.999 ? 1 : 0);
    // the room dims as the light is blocked
    const block = 1 - h * 0.7;
    const inRoom = Math.max(0, 1 - far) * block;
    arena.key.intensity = key0 * (1 - 0.42 * inRoom);
    arena.hemi.intensity = hemi0 * (1 - 0.3 * inRoom);
    arena.dim = arena.dimCur = 0.28 * inRoom;
    cover = Math.max(0, Math.min(1, (1 - far * 3) * (1 - h * 0.6)));

    const sq = pinch;
    maya.set({
      rot: r0 - s * twist * (Math.PI / 2),
      pitch: -0.3 * look,
      sx: 1 - 0.1 * sq,
      sz: 1 - 0.04 * sq,
      sy: 1 + 0.05 * sq,
    });
  });
  maya.each = (m) => {
    const d = 1 - 0.75 * cover;
    m.paint.emissiveIntensity = 0.16 * d;
    m.eyeMat.color.setRGB(3.2 * d, 3.1 * d, 2.9 * d);
    m.ringMat.opacity = 0.9 * (1 - 0.6 * cover);
    m.poolMat.opacity = 0.75 * (1 - 0.8 * cover);
  };

  // ---- beats ----
  // it arrives: slides in from the edge, coming down (shrinks and sharpens)
  lab.tween(0.5, (e) => (vert = e), ease.inOut);
  lab.at(0.24, () => lab.tween(0.24, (e) => (look = e), ease.out));
  await lab.tween(
    0.52,
    (e, k) => {
      far = 1 - ease.out(Math.min(1, k * 1.25));
      h = 1 - e;
    },
    ease.inOut,
  );
  // thumb and finger close on her: a held beat
  await lab.tween(0.07, (e) => {
    rc = 0.62 - 0.27 * e;
    pinch = e;
  }, ease.in);
  lab.shake(0.012, 0.12);
  await lab.wait(0.1);
  // the quarter twist; she turns with it
  await lab.tween(0.36, (e) => {
    twist = e;
    look = 1 - 0.6 * e;
  }, ease.inOut3);
  await lab.wait(0.05);
  // let go
  await lab.tween(0.08, (e) => {
    rc = 0.35 + 0.3 * e;
    pinch = 1 - e;
  }, ease.out);
  // the hand lifts away: the shadow swells soft and slides back off the edge, the light returns
  lab.tween(0.42, (e) => (vert = 1 - e), ease.inOut);
  lab.tween(0.3, (e) => (look = 0.4 + 0.25 * Math.sin(e * Math.PI) - 0.4 * e), ease.inOut);
  await lab.tween(
    0.42,
    (e, k) => {
      h = e;
      far = ease.in(Math.max(0, (k - 0.15) / 0.85));
    },
    ease.inOut,
  );
  stop();
  shadow.visible = false;
  arena.key.intensity = key0;
  arena.hemi.intensity = hemi0;
  arena.dim = arena.dimCur = 0;
  maya.each = null;
  releaseCam();
  maya.release({ x: end.x, y: end.y, d: end.d });
}
