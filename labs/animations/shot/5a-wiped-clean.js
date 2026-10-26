// Wiped clean, through weight and physical comedy: the beam hits Maya and a sliver of it ricochets off her
// polish: it pings up, tumbling end over end, and comes at us faster and faster until it splats on the
// TV's own glass. The splat spreads with a wobble, flecks fly, and the blob of liquid light hangs there
// glowing, blurring the picture behind it, while gravity slowly pulls a drip out of its bottom edge. Then
// one curved thumb-swipe: the light is pushed ahead of the stroke into a bright bead, like water in front
// of a squeegee, and flicked off the edge of the screen, leaving the picture clean.
export const meta = {
  title: 'Wiped clean (splat, drip, squeegee)',
  idea: 'A sliver of the beam ricochets off Maya\'s polish, tumbles end over end and accelerates straight at us, splatting on the TV\'s own glass as a soft blob of blue light that blurs the picture behind it. It wobbles, sags and starts to drip, until one curved thumb-swipe pushes all the light into a bead ahead of the stroke and flicks it off the edge of the screen.',
  notes: 'Sound: the laser zap, a high ricochet ping, a rising whistle as it comes at us, a soft wet splat right on the speakers, the faint creak of the drip, then a squeaky glass squeegee swipe ending in a tiny flick. The picture behind never reacts: only the glass does. Rare by design (first hit of the night, or a small chance), so it stays a surprise. The smear lives in the HUD layer (a canvas with a backdrop blur for the lens), drawn in screen pixels.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const theoBot = lab.bot('b');
  const color = theoBot.color; // #4dabf7
  const glowTex = lab.bot('a').model.poolMat.map;

  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  maya.set({ trail: false });
  theo.set({ trail: false });

  // ---------- the beam ----------
  const row = lab.pos(1, 1).z;
  const FLANK = lab.pos(1, 1).x + 0.38;
  theo.model.muzzle.updateWorldMatrix(true, false);
  const MUZ = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const beamMat = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamGlow = new THREE.MeshBasicMaterial({ color: hdr(color, 1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Group();
  const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1, true), beamMat);
  const bg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 12, 1, true), beamGlow);
  bc.rotation.z = bg.rotation.z = Math.PI / 2;
  beam.add(bc, bg);
  beam.visible = false;
  lab.add(beam);
  const setBeam = (x0, x1, k) => {
    beam.visible = k > 0.001;
    beam.position.set((x0 + x1) / 2, MUZ.y, row);
    beam.scale.set(Math.max(0.001, Math.abs(x1 - x0)), 1, 1);
    beam.scale.y = beam.scale.z = 0.6 + 0.4 * k;
    beamMat.opacity = k;
    beamGlow.opacity = 0.5 * k;
  };
  const sprite = (c, k, size) => {
    const s = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr(c, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size);
    s.visible = false;
    return s;
  };
  const glint = sprite('#ffffff', 3.2, 0.5);

  // ---------- the sliver: a drop of liquid light that ricochets at us ----------
  const sliverMat = new THREE.MeshBasicMaterial({ color: hdr('#dcecff', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sliver = lab.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.08, 4, 8), sliverMat));
  sliver.visible = false;
  const sliverGlow = sprite(color, 2, 0.16);

  // where it will land on the glass: a point just in front of the camera, on the ray through the picture
  // a little right of centre, over the row between them
  const cam = lab.camera3;
  const TARGET_NDC = new THREE.Vector2(0.1, 0.12);
  const landing = () => {
    cam.updateMatrixWorld();
    const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const dir = new THREE.Vector3(TARGET_NDC.x, TARGET_NDC.y, 0.5).unproject(cam).sub(eye).normalize();
    return eye.addScaledVector(dir, 0.9);
  };

  // ---------- the TV's glass: a canvas over the picture, plus a lens that blurs what's behind ----------
  const ov = lab.overlay;
  const box = lab.renderer.domElement.getBoundingClientRect();
  const W = Math.round(box.width) || 960;
  const H = Math.round(box.height) || 540;
  const glass = document.createElement('canvas');
  glass.width = W;
  glass.height = H;
  glass.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen';
  const lens = document.createElement('div');
  lens.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;backdrop-filter:blur(5px) saturate(1.25);-webkit-backdrop-filter:blur(5px) saturate(1.25);-webkit-mask-image:radial-gradient(closest-side,#000 45%,transparent 100%);mask-image:radial-gradient(closest-side,#000 45%,transparent 100%);opacity:0';
  ov.append(lens, glass);
  const g = glass.getContext('2d');
  const R = H * 0.22; // the smear's radius in pixels
  const sm = { ripple: 0, lobes: [], on: false, x: 0, y: 0, spread: 0, alpha: 0, drip: 0, wipe: -1, wobble: 0, dirX: 1, dirY: 0, flecks: [] };
  const blob = (x, y, rx, ry, a, rot = 0) => {
    if (a <= 0.003 || rx <= 0.5 || ry <= 0.5) return;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(200,228,255,${0.75 * a})`);
    gr.addColorStop(0.55, `rgba(110,180,250,${0.56 * a})`);
    gr.addColorStop(0.8, `rgba(140,200,255,${0.48 * a})`);
    gr.addColorStop(1, 'rgba(77,150,247,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  // the swipe: one curved stroke, under the smear and up off the right of the screen
  const wipeAt = (t) => {
    const p0 = { x: sm.x - 2.6 * R, y: sm.y + 1.0 * R };
    const p1 = { x: sm.x + 0.2 * R, y: sm.y + 1.6 * R };
    const p2 = { x: sm.x + 4.6 * R, y: sm.y - 2.6 * R };
    const u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  };
  const drawGlass = () => {
    g.clearRect(0, 0, W, H);
    if (!sm.on) return;
    const a = sm.alpha;
    const sp = sm.spread;
    const wob = sm.wobble;
    const ang = Math.atan2(sm.dirY, sm.dirX);
    g.globalCompositeOperation = 'lighter';
    g.filter = `blur(${Math.round(H * 0.035)}px)`;
    // the body of the splat, a bit longer along the way it was flying, wobbling as it spreads, its edge
    // lumpy where the drop burst
    blob(sm.x, sm.y, R * sp * (1.0 + 0.12 * wob), R * sp * (0.86 - 0.1 * wob), a, ang);
    for (const l of sm.lobes) blob(sm.x + Math.cos(l.a) * l.d * R * sp, sm.y + Math.sin(l.a) * l.d * R * sp * 0.9, l.r * R * sp, l.r * R * sp * 0.85, a * 0.4);
    blob(sm.x, sm.y, R * sp * 0.3, R * sp * 0.27, a * 0.8, ang);
    // the glass rings from the impact: one soft ripple running out
    if (sm.ripple > 0 && sm.ripple < 1) {
      g.filter = `blur(${Math.round(H * 0.006)}px)`;
      g.strokeStyle = `rgba(170,210,255,${0.35 * (1 - sm.ripple)})`;
      g.lineWidth = H * 0.012;
      g.beginPath();
      g.ellipse(sm.x, sm.y, R * (0.6 + 2.2 * sm.ripple), R * (0.55 + 2.0 * sm.ripple), 0, 0, Math.PI * 2);
      g.stroke();
      g.filter = `blur(${Math.round(H * 0.035)}px)`;
    }
    // flecks thrown out by the impact
    for (const f of sm.flecks) {
      const d = f.d * R * (0.4 + 0.8 * sp);
      blob(sm.x + Math.cos(f.a) * d, sm.y + Math.sin(f.a) * d, f.r * R * sp, f.r * R * sp * 0.8, a * f.k);
    }
    // the drip: gravity pulling a tongue of light out of its bottom edge, with a bead at the end
    if (sm.drip > 0) {
      const top = sm.y + R * sp * 0.55;
      const len = sm.drip * R;
      blob(sm.x + R * 0.18, top + len * 0.5, R * 0.16, len * 0.55 + R * 0.1, a * 0.75);
      blob(sm.x + R * 0.18, top + len, R * 0.2, R * 0.22, a * 0.95);
    }
    // the wipe: everything the thumb has passed over is gone; the light it collected rides ahead as a bead
    if (sm.wipe >= 0) {
      g.globalCompositeOperation = 'destination-out';
      g.filter = 'blur(10px)';
      g.strokeStyle = '#000';
      g.lineCap = 'round';
      g.lineWidth = R * 3.6;
      g.beginPath();
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const p = wipeAt((i / n) * sm.wipe);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.filter = 'blur(4px)';
      // a thin streak left behind, already evaporating
      for (let i = 0; i < 14; i++) {
        const t0 = sm.wipe - 0.3 + (i / 14) * 0.3;
        if (t0 < 0.12) continue;
        const p = wipeAt(t0);
        blob(p.x + R * 0.6, p.y - R * 0.9, R * 0.12, R * 0.06, a * 0.25 * (i / 14), -0.6);
      }
      // the bead of collected light, pushed ahead of the stroke's leading edge
      const collected = clamp01((sm.wipe - 0.18) / 0.35);
      const lead = wipeAt(Math.min(1, sm.wipe + 0.05));
      const back = wipeAt(Math.max(0, sm.wipe - 0.02));
      const la = Math.atan2(lead.y - back.y, lead.x - back.x);
      const off = R * 1.55;
      const bx = lead.x + Math.cos(la - Math.PI / 2) * off * 0.25 + Math.cos(la) * R * 0.35;
      const by = lead.y + Math.sin(la - Math.PI / 2) * off;
      blob(bx, by, R * (0.25 + 0.55 * collected), R * (0.18 + 0.32 * collected), a * collected, la);
    }
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
  };
  lab.every(() => {
    drawGlass();
    const show = sm.on && sm.wipe < 0.5;
    const size = 2.2 * R * Math.max(0.01, sm.spread);
    lens.style.left = `${sm.x - size / 2}px`;
    lens.style.top = `${sm.y - size / 2}px`;
    lens.style.width = lens.style.height = `${size}px`;
    lens.style.opacity = String(show ? sm.alpha * (sm.wipe < 0 ? 1 : 1 - sm.wipe * 2) : 0);
  });

  // Maya never moves; her polish takes a glint
  const my = { glint: 0 };
  maya.each = (model) => {
    maya.set({ x: 1, y: 1, rot: facing(2) });
    if (my.glint > 0) model.paint.emissiveIntensity = 0.16 + 1.2 * my.glint;
  };
  const th = { kick: 0, brace: 0 };
  theo.each = () => theo.set({ x: 5 + 0.08 * th.kick, y: 1, rot: facing(3), pitch: -0.1 * th.brace - 0.22 * th.kick, sy: 1 - 0.07 * th.brace });

  // ---------- the beats ----------
  await lab.tween(0.1, (e) => (th.brace = e), ease.out);
  lab.arena.emit('laser', { hit: true, src: 'b' });
  lab.tween(0.25, (e, k) => {
    th.brace = 1 - e;
    th.kick = Math.sin(Math.min(1, k * 1.8) * Math.PI) * (1 - k * 0.6);
  }, ease.out);
  await lab.tween(0.15, (e) => setBeam(MUZ.x, MUZ.x + (FLANK - MUZ.x) * e, 1), ease.in);
  // the hit: a glint on her polish, and a sliver ricochets off it
  lab.arena.emit('damage', { id: 'a', n: 1 });
  const H0 = new THREE.Vector3(FLANK - 0.02, MUZ.y + 0.05, row);
  glint.position.copy(H0);
  glint.visible = true;
  lab.tween(0.25, (e) => {
    glint.material.opacity = 1 - e;
    glint.scale.setScalar(0.5 + 0.4 * e);
    my.glint = 1 - e;
  }, ease.out).then(() => (glint.visible = false));
  lab.tween(0.4, (e) => setBeam(MUZ.x, FLANK, 1 - e), ease.in).then(() => (beam.visible = false));
  // the flight: up off her polish, tumbling, then accelerating straight at us
  const E = landing();
  const C = H0.clone().add(new THREE.Vector3(0.5, 1.1, 0.3));
  sliver.visible = sliverGlow.visible = true;
  const bez = (t) => {
    const u = 1 - t;
    return H0.clone().multiplyScalar(u * u).addScaledVector(C, 2 * u * t).addScaledVector(E, t * t);
  };
  const axis = new THREE.Vector3(1, 0.3, 0.2).normalize();
  await lab.tween(0.34, (e, k) => {
    const p = bez(e);
    sliver.position.copy(p);
    sliverGlow.position.copy(p);
    sliver.quaternion.setFromAxisAngle(axis, k * Math.PI * 5);
  }, ease.in);
  sliver.visible = sliverGlow.visible = false;
  // SPLAT on the glass
  const at = lab.toScreen(E);
  const from = lab.toScreen(H0);
  sm.on = true;
  sm.x = at.x;
  sm.y = at.y;
  const dl = Math.hypot(at.x - from.x, at.y - from.y) || 1;
  sm.dirX = (at.x - from.x) / dl;
  sm.dirY = (at.y - from.y) / dl;
  sm.lobes = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2 + lab.range(-0.3, 0.3), d: lab.range(0.45, 0.62), r: lab.range(0.32, 0.45) }));
  lab.tween(0.4, (e) => (sm.ripple = e), ease.out).then(() => (sm.ripple = 0));
  sm.flecks = Array.from({ length: 6 }, () => ({ a: lab.range(0, Math.PI * 2), d: lab.range(1.0, 1.6), r: lab.range(0.08, 0.16), k: lab.range(0.4, 0.8) }));
  lab.arena.emit('splat', {});
  sm.alpha = 1;
  await lab.tween(0.14, (e, k) => {
    sm.spread = e;
    sm.wobble = 0;
  }, ease.outBack);
  // it hangs there, glowing; it wobbles to rest and gravity starts pulling a drip out of it
  await lab.tween(0.62, (e, k) => {
    sm.wobble = Math.sin(k * Math.PI * 5) * (1 - k) ** 2 * 0.8;
    sm.alpha = 1 - 0.12 * k + 0.05 * Math.sin(k * 9);
    sm.drip = k < 0.25 ? 0 : 0.95 * ease.in((k - 0.25) / 0.75);
  }, ease.linear);
  // the swipe
  lab.arena.emit('wipe', {});
  await lab.tween(0.42, (e) => (sm.wipe = e), ease.inOut);
  sm.on = false;
  drawGlass();
  lens.style.opacity = '0';
  await lab.wait(0.08);
  glass.remove();
  lens.remove();
  maya.each = null;
  theo.each = null;
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
}
