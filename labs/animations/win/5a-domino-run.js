// Domino run, through weight and physical comedy: panes of glass pop up out of the grid lines, Maya boops the first
// one (it teeters and refuses), boops it again, and the run topples with real hinged geometry all the way to Theo.
export const meta = {
  title: 'Domino run: the second boop',
  idea:
    'Maya lands on flag 2 and a line of thin glass panes, lit along their tops like Lumen\'s wall fins, pops up out of the glass in a ripple from her square, wobbling like jelly as they settle, snaking round the board toward Theo. Stillness. Maya leans in and boops the first pane with her nose: it teeters... and rocks back upright. She looks at it. Second, tinier boop: it tips, and the run goes, slow at first then faster and faster, each pane resting on the next as it falls (real hinge geometry, so the fallen run lies shingled), each struck top edge ringing brighter, a chime a step higher. The last pane taps Theo on the nose and rests against him: he rocks back, wobbles and settles, still facing west. Then the fallen panes sink into the glass, leaving lines of light that fade.',
  notes:
    'Sound: a glassy rising pop as the panes come up, a tiny tink for the failed boop (and its wobble), then a run of chimes climbing a scale, quickening with the run; a soft clonk on Theo\'s nose; a hush as the lines fade. Port: the run\'s path goes from the winner toward the nearest rival, turning at grid lines, so it changes every game; the angles of fallen panes come from the hinge formula theta = phi + asin((s cos phi - t) / h).',
};

const TAU = Math.PI * 2;

function rounded(lab, way, r) {
  const P = way.map(([x, y]) => lab.pos(x, y));
  const out = [P[0].clone()];
  const line = (a, b) => {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.02));
    for (let i = 1; i <= n; i++) out.push(a.clone().lerp(b, i / n));
  };
  let from = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const d1 = b.clone().sub(a);
    const d2 = c.clone().sub(b);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    const p0 = b.clone().addScaledVector(d1.normalize(), -rr);
    const p1 = b.clone().addScaledVector(d2.normalize(), rr);
    line(from, p0);
    for (let k = 1; k <= 24; k++) {
      const u = k / 24;
      out.push(p0.clone().multiplyScalar((1 - u) ** 2).addScaledVector(b, 2 * u * (1 - u)).addScaledVector(p1, u * u));
    }
    from = p1;
  }
  line(from, P[P.length - 1]);
  let s = 0;
  return out.map((p, i) => {
    if (i) s += p.distanceTo(out[i - 1]);
    return { p, s };
  });
}

let dotTex = null;
function glowTexture(THREE) {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  theo.set({ trail: false });
  const RED = new THREE.Color(lab.bot('a').color);
  const LIGHT = new THREE.Color(lab.PALETTE.light);

  // ---------- the run: panes along a path that snakes from Maya round to Theo ----------
  const H = 0.42; // pane height
  const TH = 0.03; // thickness
  const W = 0.5; // width
  const GAP = 0.29; // pivot to pivot
  const path = rounded(lab, [[4.52, 1], [5.75, 1], [5.75, 2.05], [2.5, 2.05], [2.5, 3], [4.8, 3]], 0.42);
  const sAt = (s) => {
    let i = path.findIndex((q) => q.s >= s);
    if (i <= 0) i = Math.max(1, i < 0 ? path.length - 1 : 1);
    const a = path[i - 1];
    const b = path[i];
    const k = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return { p: a.p.clone().lerp(b.p, Math.max(0, Math.min(1, k))), t: b.p.clone().sub(a.p).normalize() };
  };
  const theoNose = lab.pos(5, 3).x - 0.42;
  const finMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.2, metalness: 0, emissive: 0xdfe6f0, emissiveIntensity: 0.14, transparent: true, opacity: 0.82 });
  const paneGeo = new THREE.BoxGeometry(W, H, TH).translate(0, H / 2, -TH / 2);
  const capGeo = new THREE.BoxGeometry(W, 0.014, TH + 0.008).translate(0, H, -TH / 2);
  const panes = [];
  for (let s = 0.03; ; s += GAP) {
    const { p, t } = sAt(s);
    if (panes.length > 4 && p.x > theoNose - H * 0.55 && p.z > lab.pos(0, 2.6).z) break;
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.position.copy(p);
    g.rotation.y = Math.atan2(t.x, t.z);
    const pane = new THREE.Mesh(paneGeo, finMat);
    pane.castShadow = true;
    const capMat = new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(1.25) });
    const cap = new THREE.Mesh(capGeo, capMat);
    g.add(pane, cap);
    g.visible = false;
    lab.add(g);
    // a slit of light in the glass where it rises
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, 0.05), new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    slit.rotation.order = 'YXZ';
    slit.rotation.set(-Math.PI / 2, g.rotation.y, 0);
    slit.position.copy(p).setY(0.012).addScaledVector(t, -TH / 2);
    lab.add(slit);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.03), new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.rotation.order = 'YXZ';
    line.rotation.set(-Math.PI / 2, g.rotation.y, 0);
    lab.add(line);
    panes.push({ g, cap, capMat, slit, p, t, s, rise: Infinity, tau: Infinity, Tf: 0, theta: 0, ring: -1, sink: Infinity, line });
  }
  const n = panes.length;
  // the last one hits Theo's nose at this angle
  const last = panes[n - 1];
  const reach = Math.max(0.12, Math.min(H * 0.95, theoNose - last.p.x));
  const thetaT = Math.asin(reach / H);
  const thetaC = Math.asin((GAP - TH) / H); // where a falling pane meets the next
  const hinge = (phi) => phi + Math.asin(Math.max(-1, Math.min(1, (GAP * Math.cos(phi) - TH) / H)));

  // ---------- every frame: rise, fall (solved from the end of the run back), ring, sink ----------
  let boop = 0; // the first pane's own wobble from Maya's boops (radians)
  let theoTap = Infinity;
  const glowTex = glowTexture(THREE);
  lab.every(() => {
    const t = lab.t;
    for (let i = n - 1; i >= 0; i--) {
      const P = panes[i];
      // rising out of the glass with an overshoot and a jelly wobble
      const ur = t - P.rise;
      let y = -H - 0.02;
      let wob = 0;
      if (ur >= 0) {
        P.g.visible = true;
        const k = Math.min(1, ur / 0.24);
        y = (-H - 0.02) * (1 - ease.outBack(k, 2.2));
        wob = 0.12 * Math.exp(-ur * 7) * Math.sin(ur * 30) * Math.min(1, ur * 8);
        P.slit.material.opacity = Math.max(0, 1 - ur / 0.5) * Math.min(1, ur * 12);
      }
      // falling
      const u = t - P.tau;
      let th = 0;
      if (u >= 0) {
        if (i === n - 1) {
          if (u < P.Tf) th = thetaT * (u / P.Tf) ** 1.7;
          else {
            const v = u - P.Tf;
            th = thetaT - 0.1 * Math.exp(-v * 9) * Math.abs(Math.sin(v * 20));
          }
        } else if (u < P.Tf) th = thetaC * (u / P.Tf) ** 1.6;
        else th = Math.max(thetaC, hinge(panes[i + 1].theta));
      }
      if (i === 0 && u < 0) th = boop;
      P.theta = th;
      // sinking into the glass at the end
      const us = t - P.sink;
      if (us >= 0) {
        y -= 0.22 * ease.in(Math.min(1, us / 0.22));
        if (us < 0.02) P.line.position.copy(P.p).addScaledVector(P.t, H * Math.sin(P.theta) * 0.9).setY(0.011);
        const v = us - 0.05;
        P.line.material.opacity = v < 0 ? 0 : Math.min(1, v * 10) * Math.max(0, 1 - v / 0.5);
      }
      P.g.position.y = y;
      P.g.rotation.x = th + wob;
      // the struck top edge rings bright, a step brighter along the run
      const ring = P.ring >= 0 ? Math.exp(-(t - P.ring) * 5) : 0;
      P.capMat.color.copy(LIGHT).multiplyScalar(1.25 + ring * (2 + 2 * (i / n)));
    }
  });
  // a contact flash where one pane's top meets the next
  const spark = (P) => {
    const top = P.p.clone().addScaledVector(P.t, H * Math.sin(thetaC)).setY(H * Math.cos(thetaC));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: LIGHT.clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.copy(top);
    lab.add(sp);
    lab.tween(0.22, (e, k) => {
      sp.scale.setScalar(0.12 + 0.2 * k);
      sp.material.opacity = (1 - k) ** 2;
    }, ease.linear).then(() => (sp.visible = false));
  };

  // ---------- Move 2 with weight ----------
  lab.playCard('a', ['m2']);
  arena.emit('play', { id: 'a', cards: ['m2'] });
  await lab.wait(0.22);
  arena.emit('move', { id: 'a', n: 2, dur: 0.6 });
  await lab.tween(0.6, (e, k) => {
    const s = k - Math.sin(TAU * k) / TAU;
    maya.set({ x: 2 + 2 * s, pitch: -0.13 * Math.sin(TAU * k) });
  }, ease.linear);
  const col = arena.columns.find((c) => c.n === 2);
  if (col) {
    col.flash = lab.t;
    col.flashColor = RED.clone();
  }
  arena.emit('checkpoint', { id: 'a', n: 2 });
  arena.emit('win', { id: 'a' });
  lab.ring(lab.pos(4, 1), RED, 1.0, 0.03, 0.5);
  lab.tween(0.5, (e, k) => {
    const u = k * 0.5;
    const w = Math.exp(-u * 6) * Math.sin(u * 17);
    maya.set({ x: 4 + 0.035 * w, pitch: 0.16 * w });
  }, ease.linear);
  const card = lab.bot('a').card;
  if (card) {
    const base = card.userData.base.clone();
    lab.tween(0.2, (e) => card.scale.set(base.x * (1 - e), base.y * (1 + 0.3 * e), 1), ease.in).then(() => arena.clearCards());
  }
  await lab.wait(0.2);

  // ---------- the panes pop up, rippling out from Maya ----------
  const t0 = lab.t;
  panes.forEach((P, i) => (P.rise = t0 + i * 0.014));
  await lab.wait(0.014 * n + 0.3);

  // ---------- boop #1: she leans in, taps it; it teeters... and rocks back ----------
  const nose = (k) => maya.set({ x: 4 + 0.1 * k, pitch: 0.28 * k });
  await lab.tween(0.12, (e) => maya.set({ x: 4 - 0.03 * e, pitch: -0.12 * e }), ease.out); // wind up
  await lab.tween(0.1, (e) => nose(e), ease.in);
  panes[0].ring = lab.t;
  lab.tween(0.5, (e, k) => {
    const u = k * 0.5;
    boop = 0.26 * Math.exp(-u * 4.5) * Math.sin(u * 10.5 + 0.05);
  }, ease.linear).then(() => (boop = 0));
  await lab.tween(0.18, (e) => nose(1 - e), ease.out);
  // she looks at it (a little tilt of the head), then boop #2: barely a touch
  await lab.tween(0.18, (e) => maya.set({ roll: 0.1 * Math.sin(Math.PI * e) }), ease.inOut);
  await lab.tween(0.1, (e) => nose(0.75 * e), ease.in);
  panes[0].ring = lab.t;
  // the run goes: slow at first, then faster and faster
  let tau = lab.t;
  panes.forEach((P, i) => {
    P.tau = tau;
    P.Tf = i === n - 1 ? 0.15 : 0.055 + 0.2 * Math.exp(-i / 2.2);
    if (i > 0) lab.at(tau - lab.t, () => {
      P.ring = lab.t;
      spark(panes[i - 1]);
    });
    tau += P.Tf;
  });
  theoTap = tau;
  lab.tween(0.25, (e) => nose(0.75 * (1 - e)), ease.out);
  await lab.wait(theoTap - lab.t);

  // ---------- tap: Theo rocks back on his square and settles, still facing west ----------
  spark(last);
  await lab.tween(0.7, (e, k) => {
    const u = k * 0.7;
    const w = Math.exp(-u * 6) * Math.sin(u * 19);
    theo.set({ pitch: -0.32 * w, x: 5 + 0.03 * w, sy: 1 - 0.1 * Math.exp(-u * 16) });
    if (u > 0.3 && panes[0].sink === Infinity) panes.forEach((P, i) => (P.sink = lab.t + i * 0.012));
  }, ease.linear);
  theo.set({ pitch: 0, x: 5, sy: 1 });

  // ---------- the fallen run has sunk into the glass; its lines of light fade ----------
  await lab.wait(Math.max(0, panes[n - 1].sink + 0.58 - lab.t));
  for (const P of panes) {
    P.g.visible = false;
    P.line.visible = false;
  }
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
}
