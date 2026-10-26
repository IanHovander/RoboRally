// Wiped clean, staged as a rack focus: a sliver of the beam glances off Maya and flies at the lens in slow
// motion, splats on the TV's own glass as a soft blue smear, and the picture behind it goes out of focus as
// your eye catches on the smudge. A soft thumb of darkness wipes it away in one arc and the focus racks back.
export const meta = {
  title: 'Wiped clean (rack focus)',
  idea: 'Theo\'s beam hits Maya and one sliver of it glances off her polish and tumbles straight at the camera in slow motion, growing as it comes, until it lands on the screen itself: a soft, out-of-focus smear of blue light over the picture. The board behind it drifts out of focus, the way your eye catches on a smudge on your glasses. Then a soft dark thumb sweeps across in one curved stroke, pushing a bead of light ahead of it; the smear is gone, a faint streak evaporates like breath on glass, and the focus racks back onto the board.',
  notes: 'Sound: the laser zip, a bright "ting" as the sliver glances, a rising whistle as it comes at the lens (slow motion), a soft wet "pap" on the glass, a held hum while it glows, and a squeaky-clean glass squeak for the wipe. Rare by design (the first hit of the night, or a 1-in-20 roll). The smear, thumb and streak are DOM over the canvas (screen-blended), the rack focus is a CSS blur on the canvas; the game would put these in its HUD layer.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const BLUE = new THREE.Color('#4dabf7');
  const canvas = lab.renderer.domElement;
  const ov = lab.overlay;
  lab.cleanup(() => (canvas.style.filter = ''));
  const W = () => ov.getBoundingClientRect().width;
  const H = () => ov.getBoundingClientRect().height;

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

  // ----- the hit: a glint on her polish, and a sliver glances off -----
  lab.ring(hit.clone().setY(0.03), '#cfe6ff', 0.3, 0.03, 0.35);
  const hurt = { k: 0 };
  maya.each = (m) => {
    m.paint.emissive.set('#ff7a6b');
    m.paint.emissiveIntensity = 0.16 + 1.2 * hurt.k;
  };
  lab.tween(0.35, (e) => (hurt.k = 1 - e), ease.out);
  lab.tween(0.3, (e) => setBeam(1, 1 - e), ease.in);

  const sliver = new THREE.Group();
  const sGeo = new THREE.CapsuleGeometry(1, 1, 4, 10);
  const sCore = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.4, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const sGlow = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(2), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  sCore.scale.set(0.006, 0.045, 0.006);
  sGlow.scale.set(0.018, 0.055, 0.018);
  sliver.add(sCore, sGlow);
  lab.add(sliver);

  // where it lands: a point on the screen up and to the right of Maya, just in front of the lens
  const cam = lab.camera3;
  const LAND = { x: 0.37, y: 0.43 }; // fractions of the picture
  const landAt = (d) => {
    const ray = new THREE.Vector3(LAND.x * 2 - 1, 1 - LAND.y * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    return cam.position.clone().addScaledVector(ray, d);
  };
  const ctrl = hit.clone().add(new THREE.Vector3(0.55, 0.85, 0.35));
  const bez = (a, b, c, k) => a.clone().multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * k * (1 - k)).addScaledVector(c, k * k);
  // it comes at us in slow motion (a held breath), accelerating at the end
  lab.slowmo(0.4, 0.08);
  const spin = new THREE.Euler();
  await lab.tween(0.22, (e, k) => {
    const end = landAt(0.75);
    sliver.position.copy(bez(hit, ctrl, end, e));
    spin.set(k * 9, k * 4, k * 6.5);
    sliver.quaternion.setFromEuler(spin);
    const s = 1 + 1.2 * e;
    sliver.scale.setScalar(s);
  }, ease.in);
  lab.slowmo(1, 0.05);

  // ----- splat: it is on the TV's glass now -----
  sliver.visible = false;
  const smear = document.createElement('div');
  const w = W();
  const h = H();
  const cx = LAND.x * w;
  const cy = LAND.y * h;
  const S = h * 0.36; // the smear's size
  smear.style.cssText = `position:absolute;left:${cx - S}px;top:${cy - S}px;width:${2 * S}px;height:${2 * S}px;mix-blend-mode:screen;pointer-events:none;filter:blur(${S * 0.05}px);will-change:transform,opacity`;
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
  for (const [x, y, r] of [[0.68, 0.62, 0.07], [0.27, 0.6, 0.05]]) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${(x - r) * 100}%;top:${(y - r) * 100}%;width:${r * 200}%;height:${r * 200}%;border-radius:50%;box-shadow:0 0 ${S * 0.03}px rgba(150,205,255,.6), inset 0 0 ${S * 0.04}px rgba(150,205,255,.5)`;
    smear.append(d);
  }
  ov.append(smear);
  const pivot = { x: w * 1.12, y: h * 1.32 }; // the base of the thumb, off the bottom right
  const R = Math.hypot(cx - pivot.x, cy - pivot.y);
  const toCss = (phi) => phi + 90; // screen angle (deg, y down) -> CSS conic angle
  const phiSmear = (Math.atan2(cy - pivot.y, cx - pivot.x) * 180) / Math.PI;
  const A0 = phiSmear + 34; // the stroke starts up-right of the smear...
  const A1 = phiSmear - 40; // ...and ends down-left of it
  const setMask = (phi) => {
    const span = Math.max(0, toCss(A0) - toCss(phi));
    const m = `conic-gradient(from ${toCss(phi) - 5}deg at ${pivot.x - (cx - S)}px ${pivot.y - (cy - S)}px, #000 0deg, transparent 5deg, transparent ${span + 5}deg, #000 ${span + 6}deg)`;
    smear.style.maskImage = m;
    smear.style.webkitMaskImage = m;
  };
  // the splat: in fast, a little overshoot, a flash of brightness
  await lab.tween(0.14, (e, k) => {
    smear.style.transform = `scale(${0.55 + 0.45 * ease.outBack(k, 2.2)}) rotate(${-8 * (1 - e)}deg)`;
    smear.style.opacity = String(Math.min(1, k * 3) * (1.25 - 0.25 * e));
  }, ease.out);

  // ----- the hang: it glows on the glass; the board behind it drifts out of focus -----
  await lab.tween(0.5, (e, k) => {
    canvas.style.filter = `blur(${2.4 * ease.inOut(Math.min(1, k * 1.6))}px)`;
    smear.style.opacity = String(0.92 + 0.08 * Math.sin(k * Math.PI * 3));
    smear.style.filter = `blur(${S * (0.05 - 0.025 * e)}px)`;
  }, ease.linear);

  // ----- the wipe: a soft thumb of darkness, one curved stroke -----
  const thumb = document.createElement('div');
  const TW = h * 0.34;
  const TL = h * 0.95;
  thumb.style.cssText = `position:absolute;left:0;top:0;width:${TW}px;height:${TL}px;border-radius:50% 50% 46% 46% / 30% 30% 70% 70%;background:radial-gradient(ellipse 60% 48% at 50% 34%, rgba(4,5,8,.96) 0%, rgba(4,5,8,.9) 60%, rgba(4,5,8,0) 100%);box-shadow:inset 0 ${h * 0.012}px ${h * 0.03}px rgba(255,236,210,.10);filter:blur(${h * 0.035}px);pointer-events:none;transform-origin:50% 0%`;
  ov.append(thumb);
  const bead = document.createElement('div');
  bead.style.cssText = `position:absolute;left:0;top:0;width:${h * 0.05}px;height:${S * 1.5}px;border-radius:50%;background:radial-gradient(closest-side, rgba(200,230,255,.9), rgba(80,150,255,.35) 55%, rgba(0,0,0,0));mix-blend-mode:screen;filter:blur(${h * 0.008}px);pointer-events:none;transform-origin:50% 50%;opacity:0`;
  ov.append(bead);
  const at = (phi, r) => ({ x: pivot.x + Math.cos((phi * Math.PI) / 180) * r, y: pivot.y + Math.sin((phi * Math.PI) / 180) * r });
  const streak = document.createElement('div');
  streak.style.cssText = `position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;background:radial-gradient(circle at ${pivot.x}px ${pivot.y}px, rgba(0,0,0,0) ${R - S * 0.5}px, rgba(140,195,255,.16) ${R}px, rgba(0,0,0,0) ${R + S * 0.5}px);filter:blur(${h * 0.01}px)`;
  ov.append(streak);
  const setThumb = (phi, fade) => {
    // the thumb's tip rides the arc a little beyond the smear; its body points back to the pivot
    const tip = at(phi, R + TL * 0.22);
    thumb.style.transform = `translate(${tip.x - TW / 2}px, ${tip.y}px) rotate(${phi + 90}deg)`;
    thumb.style.opacity = String(fade);
    const b = at(phi - 2.5, R);
    bead.style.transform = `translate(${b.x - h * 0.025}px, ${b.y - S * 0.75}px) rotate(${phi - 90}deg)`;
  };
  setMask(A0 + 6);
  await lab.tween(0.42, (e, k) => {
    const phi = A0 + 14 - (A0 - A1 + 30) * e;
    setThumb(phi, Math.min(1, k * 5) * Math.min(1, (1 - k) * 5));
    setMask(phi);
    // the bead of pushed light lives only while the thumb is crossing the smear
    const over = Math.max(0, Math.min(1, (A0 - phi) / 10)) * Math.max(0, Math.min(1, (phi - (phiSmear - 30)) / 12));
    bead.style.opacity = String(0.85 * over);
    // focus racks back as it clears
    canvas.style.filter = `blur(${2.4 * (1 - ease.inOut(Math.min(1, Math.max(0, (k - 0.25) / 0.6))))}px)`;
    const swept = Math.max(0, toCss(A0) - toCss(Math.max(A1, phi)));
    const sm = `conic-gradient(from ${toCss(Math.max(A1, phi))}deg at ${pivot.x}px ${pivot.y}px, #000 0deg, #000 ${swept}deg, transparent ${swept + 1}deg)`;
    streak.style.maskImage = sm;
    streak.style.webkitMaskImage = sm;
    streak.style.opacity = String(Math.min(1, e * 2));
  }, ease.inOut);
  smear.remove();
  thumb.remove();
  bead.remove();
  canvas.style.filter = '';
  // the streak it left evaporates, like breath on glass
  await lab.tween(0.3, (e) => (streak.style.opacity = String(1 - e)), ease.out);
  streak.remove();
  maya.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
