// Wiped clean, staged as a speed ramp and a rack focus: a sliver of the beam glances off Maya in slow motion,
// then ramps up to full speed straight into the lens, opening into a disc of bokeh as it comes, and splats on the
// TV's own glass. The board behind it drifts out of focus while your eye catches on the smudge. Then a thumb
// (huge, dark and out of focus, as anything that close to a lens is) wipes it off in one curved stroke, picking
// the light up and carrying it out of the picture, and the focus racks back onto the board.
export const meta = {
  title: 'Wiped clean (speed ramp, rack focus)',
  idea: 'Theo\'s beam hits Maya and one sliver of it glances off her polish. In slow motion it tumbles up off her, then the speed ramps up and it comes straight at us, opening into a soft disc of out-of-focus light, and splats on the screen itself: a soft blue smear over the picture (the picture gives a tiny jolt, as if the TV was tapped). The board behind it drifts out of focus, the way your eye catches on a smudge on your glasses. Then a soft dark thumb sweeps in from the corner in one curved stroke: the smear drags along under it, the thumb pad lights up blue as it picks the light up, and carries it out of frame. A faint streak is left like breath on glass, evaporates, and the focus racks back onto the board.',
  notes: 'Sound: the laser zip, a bright "ting" as the sliver glances (slowed down, a deep glassy "toong"), a rising whistle as the speed ramps up, a soft wet "pap" on the glass, a held hum, then a squeaky-clean glass squeak along the stroke. Rare by design (the first hit of the night, or a 1-in-20 roll): the surprise is the screen itself. The flight is 3D (it really comes at the camera); the smear, thumb and streak are DOM over the canvas (screen-blended) and the rack focus is a CSS blur on the canvas, which the game would put in its HUD layer.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const BLUE = new THREE.Color('#4dabf7');
  const canvas = lab.renderer.domElement;
  const ov = lab.overlay;
  lab.cleanup(() => (canvas.style.filter = ''));
  const box = ov.getBoundingClientRect();
  const w = box.width;
  const h = box.height;

  // ----- the beam -----
  theo.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const hit = lab.pos(1, 1).add(new THREE.Vector3(0.42, 0.18, 0));
  const up = new THREE.Vector3(0, 1, 0);
  const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
  const mk = (color, op) => lab.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })));
  const core = mk(new THREE.Color(3.2, 3.3, 3.6), 1);
  const glow = mk(BLUE.clone().multiplyScalar(1.6), 0.5);
  const dir = hit.clone().sub(muzzle);
  const len = dir.length();
  dir.normalize();
  const setBeam = (grow, op) => {
    for (const [m, r, o] of [[core, 0.013, 1], [glow, 0.04, 0.5]]) {
      m.position.copy(muzzle);
      m.quaternion.setFromUnitVectors(up, dir);
      m.scale.set(r * (0.4 + 0.6 * op), len * grow, r * (0.4 + 0.6 * op));
      m.material.opacity = o * op;
      m.visible = op > 0.001;
    }
  };
  lab.events.push({ t: +lab.real.toFixed(2), kind: 'laser', hit: true, src: 'b' });
  await lab.tween(0.1, (e) => setBeam(e, 1), ease.in);

  // a tween on the real clock (it runs at full speed through slow motion)
  const realTween = (dur, fn, easing = ease.out) => new Promise((ok) => {
    const r0 = lab.real;
    const stop = lab.every(() => {
      const k = Math.min(1, (lab.real - r0) / dur);
      fn(easing(k), k);
      if (k >= 1) {
        stop();
        ok();
      }
    });
  });

  // ----- the hit: a glint on her polish, and a sliver glances off, in slow motion -----
  lab.slowmo(0.3, 0.04);
  lab.ring(hit.clone().setY(0.03), '#cfe6ff', 0.3, 0.03, 0.35);
  const hurt = { k: 1 };
  maya.each = (m) => {
    m.paint.emissive.lerp(new THREE.Color('#ff7a6b'), hurt.k);
    m.paint.emissiveIntensity = 0.16 + 1.1 * hurt.k;
  };
  lab.tween(0.3, (e) => (hurt.k = 1 - e), ease.out);
  realTween(0.14, (e) => setBeam(1, 1 - e), ease.in);

  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    // a bokeh disc: an even fill, a brighter rim, a soft edge
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.5)');
    gr.addColorStop(0.7, 'rgba(255,255,255,.58)');
    gr.addColorStop(0.84, 'rgba(255,255,255,.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sliver = new THREE.Group();
  const sGeo = new THREE.CapsuleGeometry(1, 1, 4, 10);
  const sCore = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.4, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const sGlow = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(2), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  sCore.scale.set(0.016, 0.1, 0.016);
  sGlow.scale.set(0.045, 0.13, 0.045);
  sliver.add(sCore, sGlow);
  lab.add(sliver);
  const bokeh = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.75, 1.15, 2.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })));
  bokeh.renderOrder = 10;

  // where it lands: a point on the screen just up and right of Maya
  const cam = lab.camera3;
  const LAND = { x: 0.36, y: 0.42 }; // fractions of the picture
  const cx = LAND.x * w;
  const cy = LAND.y * h;
  const S = h * 0.4; // the smear's radius
  const ray = new THREE.Vector3(LAND.x * 2 - 1, 1 - LAND.y * 2, 0.5).unproject(cam).sub(cam.position).normalize();
  const D_END = 0.9;
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const BOKEH = 0.9 * (S / h) * 2 * D_END * tanH; // world size whose disc, at the lens, is the smear's starting size
  const end = cam.position.clone().addScaledVector(ray, D_END);
  const ctrl = hit.clone().add(new THREE.Vector3(0.35, 0.75, 0.2));
  const bez = (a, b, c, k) => a.clone().multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * k * (1 - k)).addScaledVector(c, k * k);
  const D0 = cam.position.distanceTo(hit);
  // the glance (slow motion): it tumbles up off her polish...
  const spin = new THREE.Euler();
  // the glint where it leaves her: a soft flare on her polish
  const softTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const flare = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: new THREE.Color(3.5, 4.2, 5.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  flare.position.copy(hit);
  realTween(0.45, (e, k) => {
    flare.material.opacity = Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - e);
    flare.scale.setScalar(0.25 + 0.45 * e);
  }, ease.out).then(() => (flare.visible = false));
  await lab.tween(0.08, (e, k) => {
    sliver.position.copy(bez(hit, ctrl, end, 0.12 * e));
    spin.set(k * 2.4, 0.4, 0.6 + k * 1.6);
    sliver.quaternion.setFromEuler(spin);
  }, ease.out);
  // ...then the speed ramps up and it comes straight at us, its screen size growing steadily, opening into a disc
  lab.slowmo(1, 0.22);
  await lab.tween(0.28, (e, k) => {
    // 1/distance grows with the eased time, so its size on screen grows smoothly instead of all in the last frame
    const inv = 1 / D0 + (1 / D_END - 1 / D0) * e;
    const d = 1 / inv;
    const u = 0.12 + 0.88 * Math.min(1, Math.max(0, (D0 - d) / (D0 - D_END)));
    sliver.position.copy(bez(hit, ctrl, end, u));
    spin.set(2.4 + k * 7, 0.4 + k * 3, 2.2 + k * 5);
    sliver.quaternion.setFromEuler(spin);
    const disc = Math.min(1, Math.max(0, (k - 0.35) / 0.45));
    sCore.material.opacity = 1 - disc;
    sGlow.material.opacity = 0.45 * (1 - disc);
    bokeh.position.copy(sliver.position);
    bokeh.scale.setScalar(BOKEH * (0.15 + 0.85 * disc));
    bokeh.material.opacity = 0.9 * disc;
  }, ease.in);

  // ----- splat: it is on the TV's glass now -----
  sliver.visible = false;
  bokeh.visible = false;
  const smear = document.createElement('div');
  smear.style.cssText = `position:absolute;left:${cx - S}px;top:${cy - S}px;width:${2 * S}px;height:${2 * S}px;mix-blend-mode:screen;pointer-events:none;filter:blur(${S * 0.04}px);will-change:transform,opacity`;
  // a few soft lobes (a smudge, not a circle) and two bokeh rings
  const lobes = [
    [0.5, 0.5, 0.42, 0.3, -18, 'rgba(120,190,255,.85)'],
    [0.42, 0.56, 0.3, 0.2, 24, 'rgba(160,215,255,.7)'],
    [0.6, 0.43, 0.24, 0.15, -40, 'rgba(90,160,255,.7)'],
    [0.5, 0.5, 0.13, 0.09, -10, 'rgba(235,245,255,.95)'],
    [0.33, 0.4, 0.09, 0.09, 0, 'rgba(140,200,255,.5)'],
  ];
  for (const [x, y, rx, ry, rot, c] of lobes) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${(x - rx) * 100}%;top:${(y - ry) * 100}%;width:${rx * 200}%;height:${ry * 200}%;border-radius:50%;transform:rotate(${rot}deg);background:radial-gradient(closest-side,${c},rgba(0,0,0,0))`;
    smear.append(d);
  }
  for (const [x, y, r] of [[0.68, 0.62, 0.07], [0.27, 0.6, 0.05], [0.72, 0.36, 0.04]]) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${(x - r) * 100}%;top:${(y - r) * 100}%;width:${r * 200}%;height:${r * 200}%;border-radius:50%;box-shadow:0 0 ${S * 0.03}px rgba(150,205,255,.6), inset 0 0 ${S * 0.04}px rgba(150,205,255,.5)`;
    smear.append(d);
  }
  ov.append(smear);
  lab.shake(0.012, 0.12);
  // the splat: in fast from the bokeh's size, a little overshoot, a flash of brightness
  await lab.tween(0.14, (e, k) => {
    smear.style.transform = `scale(${0.45 + 0.55 * ease.outBack(k, 2.4)}) rotate(${-8 * (1 - e)}deg)`;
    smear.style.opacity = String(Math.min(1, 0.6 + k * 3) * (1.3 - 0.3 * e));
  }, ease.out);

  // ----- the hang: it glows on the glass; the board behind it drifts out of focus -----
  await lab.tween(0.45, (e, k) => {
    canvas.style.filter = `blur(${2.6 * ease.inOut(Math.min(1, k * 1.6))}px)`;
    smear.style.opacity = String(0.92 + 0.08 * Math.sin(k * Math.PI * 3));
  }, ease.linear);

  // ----- the wipe: a big soft thumb, one curved stroke from its base joint off the bottom right -----
  const pivot = { x: w * 1.12, y: h * 1.32 };
  const R = Math.hypot(cx - pivot.x, cy - pivot.y);
  const phiS = (Math.atan2(cy - pivot.y, cx - pivot.x) * 180) / Math.PI;
  const at = (phi, r) => ({ x: pivot.x + Math.cos((phi * Math.PI) / 180) * r, y: pivot.y + Math.sin((phi * Math.PI) / 180) * r });
  const toCss = (phi) => phi + 90; // screen angle (deg, y down) -> CSS conic angle
  const TW = h * 0.42;
  const TL = h * 1.7;
  const thumb = document.createElement('div');
  thumb.style.cssText = `position:absolute;left:0;top:0;width:${TW}px;height:${TL}px;border-radius:50% 50% 40% 40% / 15% 15% 40% 40%;background:radial-gradient(ellipse 62% 22% at 50% 15%, rgba(66,58,54,.97) 0%, rgba(30,26,26,.97) 55%, rgba(8,8,10,.95) 100%);box-shadow:inset 0 ${h * 0.02}px ${h * 0.04}px rgba(255,226,200,.14);filter:blur(${h * 0.03}px);pointer-events:none;transform-origin:50% 0%;opacity:0`;
  // the pad: lights up blue as it picks the smear up
  const pad = document.createElement('div');
  pad.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${TW * 1.2}px;border-radius:50%;background:radial-gradient(ellipse 50% 50% at 50% 45%, rgba(140,200,255,.95), rgba(60,130,255,.35) 55%, rgba(0,0,0,0) 80%);mix-blend-mode:screen;opacity:0`;
  thumb.append(pad);
  ov.append(thumb);
  const streak = document.createElement('div');
  streak.style.cssText = `position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;background:radial-gradient(circle at ${pivot.x}px ${pivot.y}px, rgba(0,0,0,0) ${R - S * 0.45}px, rgba(140,195,255,.2) ${R}px, rgba(0,0,0,0) ${R + S * 0.45}px);filter:blur(${h * 0.01}px)`;
  ov.append(streak);
  const A0 = phiS + 24; // the tip starts above the smear, at the top right
  const A1 = phiS - 34; // and sweeps down and out past the bottom left
  const CONTACT = phiS + 9; // where the tip reaches the smear
  await lab.tween(0.6, (e, k) => {
    const s = 0.5 * k + 0.5 * ease.inOut(k);
    const phi = A0 + (A1 - A0) * s;
    const tip = at(phi, R);
    thumb.style.transform = `translate(${tip.x - TW / 2}px, ${tip.y - TW * 0.25}px) rotate(${phi + 90}deg)`;
    thumb.style.opacity = String(Math.min(1, k * 6) * Math.min(1, (1 - k) * 5));
    // the smear is dragged along under the tip, lagging, stretching along the stroke and thinning out
    const dragged = Math.max(0, CONTACT - phi); // degrees since contact
    const sPhi = phiS - dragged * 0.72;
    const p = at(sPhi, R);
    const left = Math.max(0, 1 - dragged / 30);
    const tan = sPhi + 90;
    smear.style.transform = `translate(${p.x - cx}px, ${p.y - cy}px) rotate(${tan}deg) scale(${1 + dragged / 22}, ${1 - 0.45 * (1 - left)}) rotate(${-tan}deg)`;
    smear.style.opacity = String(left ** 1.3);
    pad.style.opacity = String(Math.min(1, dragged / 10) * (0.35 + 0.65 * left) * Math.min(1, (1 - k) * 4));
    // the faint streak it leaves along the arc
    const swept = Math.max(0, phiS + 6 - sPhi);
    const sm = `conic-gradient(from ${toCss(sPhi)}deg at ${pivot.x}px ${pivot.y}px, #000 0deg, #000 ${swept}deg, transparent ${swept + 2}deg)`;
    streak.style.maskImage = sm;
    streak.style.webkitMaskImage = sm;
    streak.style.opacity = String(Math.min(1, dragged / 8));
    // the focus racks back as it clears
    canvas.style.filter = `blur(${2.6 * left}px)`;
  }, ease.linear);
  smear.remove();
  thumb.remove();
  canvas.style.filter = '';
  // the streak evaporates, like breath on glass
  await lab.tween(0.28, (e) => (streak.style.opacity = String(1 - e)), ease.out);
  streak.remove();
  maya.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
