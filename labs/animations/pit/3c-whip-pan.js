// Rear-ended by her own trail, staged with Edgar Wright's grammar: a snap zoom on the near miss, a beat of
// relief, a whip pan back along her path to find the trail piling up, a whip pan forward with it, an impact
// frame, and the punchline in the wide.
export const meta = {
  title: 'Whip pan',
  idea:
    'Maya brakes hard on (3,1) and teeters over the rim; the camera snap-zooms onto her and she sags with relief. Then a whip pan back along her path (a real horizontal motion blur) finds the far end of her trail flaring up and concertinaing forward into a crumpled knot of red light, like cars piling up. Whip pan forward with it: the knot rear-ends her, the picture flips to a two-frame negative impact frame, and she lurches one space onto the pit and drops. The camera eases back out; the knot sits on the rim for a moment and fades the way a trail always does.',
  notes:
    'Sound: tyre-squeak glass chirp on the brake, a soft sigh, a whoosh on each whip, a rising accordion wheeze as the trail bunches, a glassy crunch on the impact frame, then silence for the drop. Porting: the knot is her real trail (bot.trail points swept into a zigzag behind a moving front); the whip blur is an SVG feGaussianBlur with stdDeviation "N 0" on the canvas; the impact frame is an overlay with mix-blend-mode: difference. Name tags fade while the camera is close.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const RED = new THREE.Color('#ff4d6d');
  const LIGHT = new THREE.Color(lab.PALETTE.light);
  const W = (x, y, h = 0) => lab.pos(x, y).setY(h);
  const glow = glowTex(THREE);

  // ---------- camera rig, with a motion blur that follows how fast it pans ----------
  const ch = arena.camHome;
  const HOME = { el: ch.elev, d: 1, tx: ch.target.x, ty: ch.target.y, tz: ch.target.z, az: 0 };
  const cam = { ...HOME };
  const camTo = (dur, to, ez = ease.inOut) => {
    const from = { ...cam };
    return lab.tween(dur, (e) => {
      for (const k of Object.keys(to)) cam[k] = from[k] + (to[k] - from[k]) * e;
    }, ez);
  };
  const releaseCam = lab.camera((home) => ({ target: new THREE.Vector3(cam.tx, cam.ty, cam.tz), el: cam.el, dist: home.dist * cam.d, az: cam.az }));
  const canvas = lab.renderer.domElement;
  const oldFilter = canvas.style.filter;
  lab.cleanup(() => (canvas.style.filter = oldFilter));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = '<filter id="lab3c-whip" x="-5%" y="0" width="110%" height="100%"><feGaussianBlur id="lab3c-blur" stdDeviation="0 0"/></filter>';
  lab.overlay.append(svg);
  const blurNode = svg.querySelector('#lab3c-blur');
  let lastTx = cam.tx;
  let tagsOn = 1;
  const stopRig = lab.every((dt) => {
    // the blur follows the pan speed (world units per scene second, scaled by how close the camera is)
    const v = dt > 0 ? Math.abs(cam.tx - lastTx) / dt / cam.d : 0;
    lastTx = cam.tx;
    const px = Math.min(40, v * 2.2);
    if (px > 0.6) {
      blurNode.setAttribute('stdDeviation', `${px.toFixed(1)} 0`);
      canvas.style.filter = 'url(#lab3c-whip)';
    } else canvas.style.filter = oldFilter;
    for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity = tagsOn;
  });

  // impact frame: the picture flips to its negative for two frames
  const neg = document.createElement('div');
  neg.style.cssText = 'position:absolute;inset:0;background:#fff;mix-blend-mode:difference;opacity:0;pointer-events:none';
  lab.overlay.append(neg);

  // ---------- Maya ----------
  const maya = lab.puppet('a');
  const bot = maya.bot;
  let eyeBoost = 1;
  let cardOn = 1;
  maya.each = (m) => {
    m.eyeMat.color.multiplyScalar(eyeBoost);
    if (bot.card) bot.card.material.opacity *= cardOn;
  };
  maya.set({ rot: facing(1) });
  lab.playCard('a', ['m3']);

  // she drives two spaces and brakes hard at the rim
  await lab.tween(0.46, (e, k) => maya.set({ x: 1 + 2.08 * (1 - (1 - k) ** 2.2) }), ease.linear);
  // snap zoom: she teeters over the edge, rocks back... and holds
  camTo(0.09, { d: 0.42, el: HOME.el - 0.16, tx: W(2.8, 1).x, ty: 0.15, tz: W(2.8, 1).z }, ease.out);
  lab.tween(0.12, (e) => (tagsOn = 1 - e), ease.linear);
  lab.tween(0.25, (e) => (cardOn = 1 - e), ease.linear);
  await lab.tween(0.42, (e, k) => {
    const rock = Math.exp(-k * 4.2) * Math.cos(k * 14);
    maya.set({ x: 3 + 0.08 * Math.exp(-k * 6), pitch: 0.42 * rock, sy: 1 - 0.05 * Math.max(0, rock) });
    eyeBoost = 1 + 0.6 * Math.max(0, rock);
  }, ease.linear);
  // relief: she sags, her eye softens
  await lab.tween(0.22, (e, k) => {
    maya.set({ pitch: -0.05 * Math.sin(k * Math.PI), sy: 1 - 0.07 * Math.sin(k * Math.PI), sx: 1 + 0.04 * Math.sin(k * Math.PI) });
    eyeBoost = 1 - 0.45 * Math.sin(k * Math.PI);
  }, ease.linear);
  eyeBoost = 1;
  maya.set({ trail: false });

  // ---------- the trail piles up: it folds up off the glass like a rug being shoved ----------
  const pts = bot.trail;
  for (const p of pts) p.ox = p.x;
  const tailX = pts.length ? pts[0].x : W(1, 1).x;
  const rearX = W(3, 1).x - 0.45;
  const rimX = W(3.45, 1).x;
  const z0 = W(3, 1).z;
  let K = tailX; // the front of the pile-up (world x)
  let piling = false;
  let knotOn = 1;
  let knotPulse = 0;
  const FOLDS = 30;
  const fpos = new Float32Array((FOLDS + 1) * 2 * 3);
  const fcol = new Float32Array((FOLDS + 1) * 2 * 3);
  const fidx = [];
  for (let i = 0; i < FOLDS; i++) {
    const v = i * 2;
    fidx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  fgeo.setIndex(fidx);
  fgeo.setDrawRange(0, 0);
  const folds = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ map: stripTex(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  folds.frustumCulled = false;
  folds.renderOrder = 5;
  {
    const uv = new Float32Array((FOLDS + 1) * 2 * 2);
    for (let i = 0; i <= FOLDS; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
    fgeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  lab.add(folds);
  const knot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: RED.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  knot.renderOrder = 6;
  lab.add(knot);
  let gathered = 0;
  const stopPile = lab.every(() => {
    if (!piling) return;
    const now = lab.t;
    // the flat trail behind the front is eaten into the pile (aged out so the game drops it)
    for (const p of pts) {
      if (p.ox <= K) p.t = now - 10;
      else p.t = Math.max(p.t, now - 0.6); // the rest of the trail is lit up again, ominously
    }
    gathered = Math.max(0, K - tailX);
    const m = Math.min(FOLDS, Math.max(1, Math.round(gathered / 0.055)));
    const h = 0.22 + 0.16 * Math.min(1, m / FOLDS);
    const w = 0.22;
    const step = 0.03;
    const c = RED.clone().multiplyScalar(1.9 * knotOn * (1 + 0.8 * knotPulse));
    for (let i = 0; i <= FOLDS; i++) {
      const j = Math.min(i, m);
      const x = K - j * step;
      const y = j % 2 ? h * (0.85 + 0.15 * Math.sin(j * 2.1)) : 0.012;
      fpos.set([x, y, z0 - w, x, y, z0 + w], i * 6);
      const k = i <= m ? 1 - 0.35 * (j / Math.max(1, m)) : 0;
      fcol.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    fgeo.attributes.position.needsUpdate = true;
    fgeo.attributes.color.needsUpdate = true;
    fgeo.setDrawRange(0, m * 6);
    knot.position.set(K - (m * step) / 2, 0.12, z0);
    knot.scale.setScalar((0.5 + 0.5 * (m / FOLDS)) * (1 + 0.6 * knotPulse));
    knot.material.opacity = 0.8 * knotOn * Math.min(1, m / 4);
  });

  // whip pan back along her path: the faded trail lights up again and its far end starts to fold up
  await camTo(0.12, { tx: W(2.05, 1).x, d: 0.55, el: HOME.el - 0.3 }, ease.inOut);
  piling = true;
  lab.ring(new THREE.Vector3(tailX, 0, z0), '#ff4d6d', 0.3, 0.03, 0.35);
  await lab.tween(0.44, (e, k) => (K = tailX + (W(2.15, 1).x - tailX) * (0.55 * k + 0.45 * k * k * k)), ease.linear);
  // whip pan forward with it, the pile-up accelerating into her
  camTo(0.12, { tx: W(2.75, 1).x, d: 0.47 }, ease.inOut);
  await lab.tween(0.1, (e) => (K = W(2.15, 1).x + (rearX - W(2.15, 1).x) * e), ease.linear);

  // IMPACT: negative frame, freeze, shake
  K = rearX;
  knotPulse = 1;
  neg.style.opacity = '1';
  lab.timeScale = 0.02;
  await lab.waitReal(2 / 30);
  neg.style.opacity = '0';
  await lab.waitReal(0.1);
  lab.timeScale = 1;
  lab.shake(0.07, 0.3);
  lab.ring(W(2.55, 1, 0.03), '#ff4d6d', 0.5, 0.03, 0.4);
  lab.ring(W(2.55, 1, 0.03), lab.PALETTE.light, 0.3, 0.035, 0.3);
  eyeBoost = 2.2;
  lab.tween(0.45, (e) => (knotPulse = 1 - e), ease.out);
  camTo(0.7, { ...HOME }, ease.inOut);
  lab.at(0.35, () => lab.tween(0.4, (e) => (tagsOn = e), ease.in));
  // she lurches one space onto the pit (whiplash: head snaps back, then pitches forward) and drops
  lab.tween(0.16, (e) => (K = rearX + (rimX - rearX) * e), ease.out);
  await lab.tween(0.16, (e, k) => {
    maya.set({ x: 3 + e, pitch: -0.35 * Math.sin(k * Math.PI) + 0.25 * k, sy: 1 + 0.08 * Math.sin(k * Math.PI) });
  }, ease.out);
  eyeBoost = 1.4;
  await lab.tween(0.28, (e) => maya.set({ lift: -0.9 * e, pitch: 0.25 + 0.5 * e, sx: 1 - 0.15 * e, sz: 1 - 0.15 * e }), ease.in);
  maya.set({ visible: false });
  eyeBoost = 1;

  // the pile sits on the rim a moment, then fades the way a trail always does
  await lab.wait(0.2);
  await lab.tween(0.55, (e) => (knotOn = 1 - e), ease.in);
  stopPile();
  folds.visible = false;
  knot.visible = false;
  stopRig();
  canvas.style.filter = oldFilter;
  for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity = 1;
  releaseCam();
  maya.release({ on: false });
}

/** Across the strip: soft edges, bright rims, like the game's trail. */
function stripTex(THREE) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.15, 'rgba(255,255,255,.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.45)');
  grad.addColorStop(0.85, 'rgba(255,255,255,.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
