// Onto the lens, staged as a Turrell skyspace turned upside down: a hard cut to below the board, where the
// glass is a ceiling of soft light with one crisp black square in it. Maya falls out of the square at us
// and lands on the lens. Hard cut back to the calm board, as if nothing happened.
export const meta = {
  title: 'Skyspace',
  idea:
    'Maya drives into the hole and tips in. Hard cut: we are under the board, looking up, and the glass is a calm ceiling of soft light with one black square in it, like a Turrell skyspace. A beat of stillness. Then she drops out of the square, tumbling so her eye turns to face us, eye wide, growing fast, and hits the lens: her red light presses flat across the screen as a Pebble-shaped smudge with her eye-light smeared through it, slides a little, and fades to dark. Hard cut back to the board from the usual camera, the hole empty and quiet, as if nothing happened.',
  notes:
    'Sound: the drive as usual, then the cut lands in sudden room-tone silence (a high, still glass hum for the skyspace); a falling whistle rising in pitch as she grows; a soft, close "thup" on the lens; nothing on the cut back. Porting: the underside is a lit ceiling plane (canvas texture with the pit cells cut out by alphaTest) shown while the board is hidden; the camera is taken only for the underside and the game\'s camera state is restored exactly on the cut back, so the cut is clean. Name tags are hidden for the underside (they draw on top of everything).',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = (x, y, h = 0) => lab.pos(x, y).setY(h);
  const CEIL = -0.38;

  // ---------- the underside: a ceiling of soft light with the pit cut out of it ----------
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ map: ceilingTex(THREE, arena.course), alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(1.25, 1.2, 1.12) }));
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = CEIL;
  ceiling.visible = false;
  lab.add(ceiling);
  // above the hole: nothing at all (pure black, so the aperture reads as a hole into the void)
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
  voidPlane.rotation.x = Math.PI / 2;
  voidPlane.position.y = 3;
  voidPlane.visible = false;
  lab.add(voidPlane);
  const fill = new THREE.PointLight(0xfff1e0, 0, 6, 1.4);
  lab.add(fill);
  let under = false;
  const stopUnder = lab.every(() => {
    for (const b of arena.bots.values()) {
      if (b.tag && under) b.tag.visible = false;
      if (b.card && under) b.card.visible = false;
    }
  });
  lab.cleanup(() => (arena.board.visible = true));

  // the camera waits at the bottom: below the pit, looking up
  const pit = W(4, 1, CEIL);
  const UNDER = { target: pit.clone(), az: 0, el: -1.48, dist: 2.25, fov: 52 };
  const camPos = new THREE.Vector3(pit.x + Math.sin(UNDER.az) * Math.cos(UNDER.el) * UNDER.dist, pit.y + Math.sin(UNDER.el) * UNDER.dist, pit.z + Math.cos(UNDER.az) * Math.cos(UNDER.el) * UNDER.dist);
  fill.position.copy(camPos).add(new THREE.Vector3(0.7, 0.5, 0.5));

  // ---------- the lens: a smudge of her light, and the dark ----------
  const dark = document.createElement('div');
  dark.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none';
  const smudge = document.createElement('div');
  smudge.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;transform-origin:50% 50%';
  smudge.innerHTML = smudgeSvg();
  const wash = document.createElement('div');
  wash.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 50% 52%,rgba(255,77,109,.85),rgba(255,77,109,.35) 45%,rgba(120,10,30,.2) 100%);opacity:0;pointer-events:none';
  lab.overlay.append(wash, smudge, dark);

  // ---------- Maya ----------
  const maya = lab.puppet('a');
  const m0 = maya.model;
  const eye = m0.body.children.find((o) => o.isMesh && o.material === m0.eyeMat);
  const eyeScale = eye ? eye.scale.clone() : null;
  let eyeWide = 0;
  let glowUp = 0;
  maya.each = (m) => {
    m.eyeMat.color.multiplyScalar(1 + 1.4 * eyeWide);
    if (eye) eye.scale.set(eyeScale.x * (1 + 0.6 * eyeWide), eyeScale.y * (1 + 2.2 * eyeWide), eyeScale.z * (1 + 2.2 * eyeWide));
    m.paint.emissiveIntensity += 0.5 * glowUp;
    if (under) {
      m.ringMat.opacity = 0;
      m.poolMat.opacity = 0;
    }
  };
  lab.cleanup(() => eye && eye.scale.copy(eyeScale));
  maya.set({ rot: facing(1) });
  lab.playCard('a', ['m3']);

  // she drives three spaces, as the game does, and tips into the hole
  await lab.tween(0.78, (e, k) => maya.set({ x: 1 + 2.85 * (0.3 * k * k + 0.7 * k) }), ease.linear);
  await lab.tween(0.16, (e) => maya.set({ x: 3.85 + 0.17 * e, pitch: 0.7 * e, lift: -0.12 * e }), ease.in);

  // HARD CUT: underneath
  const before = arena.camCur && { az: arena.camCur.az, d: arena.camCur.d, el: arena.camCur.el, tgt: arena.camCur.tgt.clone(), sx: arena.camCur.sx, sy: arena.camCur.sy };
  under = true;
  arena.board.visible = false;
  ceiling.visible = true;
  voidPlane.visible = true;
  fill.intensity = 0.8;
  maya.bot.trail.length = 0;
  glowUp = 1;
  const releaseCam = lab.camera(() => ({ ...UNDER, target: UNDER.target.clone() }));
  maya.set({ x: 4, y: 1, lift: 0.5, pitch: 0.7, trail: false, visible: false });

  // the skyspace: a beat of stillness
  await lab.wait(0.4);

  // she drops out of the square at us, turning her eye to face us, growing fast
  maya.set({ visible: true });
  const start = W(4, 1, 1.4);
  const end = camPos.clone().add(new THREE.Vector3(0, 0.38, 0));
  await lab.tween(0.46, (e, k) => {
    const p = start.clone().lerp(end, e);
    // world -> spaces for the puppet (one space = one unit; offsets are the same)
    maya.set({ x: 4 + (p.x - start.x), y: 1 + (p.z - start.z), lift: p.y, pitch: 0.7 + (Math.PI - 0.55) * ease.out(k), roll: 0.25 * Math.sin(k * 3) });
    eyeWide = ease.in(Math.min(1, k * 1.4));
  }, ease.in3);

  // the lens: her light presses flat across the screen, slides a little, fades to dark
  maya.set({ visible: false });
  wash.style.opacity = '0.55';
  smudge.style.opacity = '1';
  await lab.tween(0.09, (e) => {
    smudge.style.transform = `scale(${0.7 + 0.45 * e}, ${0.7 + 0.36 * e}) rotate(${-6 + 4 * e}deg)`;
    wash.style.opacity = String(0.55 - 0.25 * e);
  }, ease.out);
  await lab.tween(0.55, (e, k) => {
    smudge.style.transform = `translateY(${7 * e}%) scale(${1.15 + 0.04 * e}, ${1.06 + 0.1 * e}) rotate(-2deg)`;
    smudge.style.opacity = String(1 - ease.in(k));
    wash.style.opacity = String(0.3 * (1 - k));
    dark.style.opacity = String(ease.inOut(Math.min(1, k * 1.3)));
  }, ease.out);
  dark.style.opacity = '1';
  await lab.wait(0.04);

  // HARD CUT back: the calm board from the usual camera, the hole empty
  releaseCam();
  if (before) arena.camCur = before;
  lab.camera3.fov = 30;
  lab.camera3.updateProjectionMatrix();
  maya.bot.trail.length = 0;
  under = false;
  stopUnder();
  arena.board.visible = true;
  ceiling.visible = false;
  voidPlane.visible = false;
  fill.intensity = 0;
  maya.release({ on: false });
  await lab.wait(1 / 30); // let the board draw once before the dark lifts
  dark.style.opacity = '0';
  smudge.style.opacity = '0';
  wash.style.opacity = '0';
  await lab.wait(0.35);
}

/** The underside of the glass: soft light where the board is, crisp holes where the pits are. */
function ceilingTex(THREE, course) {
  const PX = 64; // px per unit; the plane is 14 x 10 units, centred on the board
  const c = document.createElement('canvas');
  c.width = 14 * PX;
  c.height = 10 * PX;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  const ox = (14 - course.w) / 2;
  const oy = (10 - course.h) / 2;
  const bx = ox * PX;
  const by = oy * PX;
  const bw = course.w * PX;
  const bh = course.h * PX;
  // the glass seen from below: a calm field of warm light, brightest in the middle, soft at the edges
  g.save();
  g.filter = 'blur(10px)';
  const grad = g.createRadialGradient(bx + bw / 2, by + bh / 2, 0, bx + bw / 2, by + bh / 2, bw * 0.62);
  grad.addColorStop(0, 'rgba(250,244,232,.8)');
  grad.addColorStop(0.45, 'rgba(226,218,204,.5)');
  grad.addColorStop(1, 'rgba(120,124,132,.16)');
  g.fillStyle = grad;
  g.fillRect(bx + 4, by + 4, bw - 8, bh - 8);
  g.restore();
  // faint seams, like a light table seen from underneath
  g.strokeStyle = 'rgba(255,250,240,.08)';
  g.lineWidth = 1.5;
  for (let x = 0; x <= course.w; x++) {
    g.beginPath();
    g.moveTo(bx + x * PX, by);
    g.lineTo(bx + x * PX, by + bh);
    g.stroke();
  }
  for (let y = 0; y <= course.h; y++) {
    g.beginPath();
    g.moveTo(bx, by + y * PX);
    g.lineTo(bx + bw, by + y * PX);
    g.stroke();
  }
  // the slab's edge glows
  g.strokeStyle = 'rgba(200,215,235,.5)';
  g.lineWidth = 3;
  g.strokeRect(bx, by, bw, bh);
  // the pits: crisp black squares (cut out), each with a thin bright edge of glass
  for (let y = 0; y < course.h; y++) {
    for (let x = 0; x < course.w; x++) {
      if (course.cells[y * course.w + x]?.k !== 'pit') continue;
      g.strokeStyle = 'rgba(255,252,245,.95)';
      g.lineWidth = 3;
      g.strokeRect(bx + x * PX - 1.5, by + y * PX - 1.5, PX + 3, PX + 3);
      g.clearRect(bx + x * PX, by + y * PX, PX, PX);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Her light pressed flat on the lens: a Pebble outline of red light, an eye smeared through it. */
function smudgeSvg() {
  // pebbleShape from bots3d.js, front up; units * 1000 around (500, 500)
  const P = (x, y) => `${(500 + x * 1000).toFixed(1)} ${(500 - y * 1000).toFixed(1)}`;
  const d = `M ${P(0, 0.29)} C ${P(0.11, 0.29)} ${P(0.31, -0.12)} ${P(0.29, -0.22)} C ${P(0.27, -0.31)} ${P(0.13, -0.33)} ${P(0, -0.29)} C ${P(-0.13, -0.33)} ${P(-0.27, -0.31)} ${P(-0.29, -0.22)} C ${P(-0.31, -0.12)} ${P(-0.11, 0.29)} ${P(0, 0.29)} Z`;
  return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style="position:absolute;inset:0">
  <defs>
    <radialGradient id="lab4c-r" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#ff8aa0" stop-opacity=".95"/><stop offset=".55" stop-color="#ff4d6d" stop-opacity=".8"/><stop offset="1" stop-color="#b0183a" stop-opacity=".55"/></radialGradient>
    <filter id="lab4c-b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="lab4c-s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="lab4c-e" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9 5"/></filter>
  </defs>
  <g transform="translate(500 520) scale(1.3 1.05) translate(-500 -500)">
    <path d="${d}" fill="url(#lab4c-r)" fill-opacity=".75" filter="url(#lab4c-b)"/>
    <path d="${d}" fill="none" stroke="#ffd0d8" stroke-opacity=".9" stroke-width="9" filter="url(#lab4c-s)"/>
    <rect x="430" y="${(500 - 0.155 * 1000).toFixed(0)}" width="140" height="26" rx="13" fill="#fff6ea" filter="url(#lab4c-e)"/>
    <rect x="455" y="${(500 - 0.148 * 1000).toFixed(0)}" width="90" height="10" rx="5" fill="#ffffff"/>
  </g>
</svg>`;
}
