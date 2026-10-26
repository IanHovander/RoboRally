// Eyes in the dark, through weight and physical comedy: the audience in the dark does a stadium wave. Every eye
// crouches, blinks and hops on a real arc as the wave reaches it, landing with a pulse of its ring on the floor.
export const meta = {
  title: 'Eyes in the dark: the wave',
  idea:
    'As flag 2 flashes, the camera eases back and dozens of tiny eye-lights open one by one in the dark around and below the slab, each throwing a faint ring on the floor far below: an audience of robots that was there all along. Then they do the wave. Each eye crouches, blinks and hops as the wave reaches it, landing with a pulse of its ring, a band of jumping, blinking light running round the room like applause, the hops swelling as it passes behind Maya (who hops along with them, once). The eyes close in a scatter... and one latecomer opens, looks around, does a solitary hop for nobody, and blinks out. The room is empty and dark again.',
  notes:
    'Sound: the soft glass ticks of eyes opening, then the wave as a travelling shimmer of tiny chimes (one per landing, panned round the room), louder behind the winner; silence for the scatter; one lonely tick for the latecomer. Nobody on the board changes space or facing. The audience size could scale with the number of players or the length of the game; the latecomer could sit where the last-placed robot started.',
};

const TAU = Math.PI * 2;

function eyeTexture(THREE, kind) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  g.filter = 'blur(2px)';
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  if (kind === 'dot') g.arc(32, 16, 9, 0, TAU);
  else g.roundRect(kind === 'visor' ? 6 : 12, 10, kind === 'visor' ? 52 : 40, 12, 6);
  g.fill();
  g.filter = 'none';
  g.fillStyle = '#fff';
  g.beginPath();
  if (kind === 'dot') g.arc(32, 16, 5, 0, TAU);
  else g.roundRect(kind === 'visor' ? 9 : 15, 13, kind === 'visor' ? 46 : 34, 6, 3);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const RED = new THREE.Color(lab.bot('a').color);
  const FLOOR = -1.6;
  const G = 9; // gravity for the hops

  // ---------- the audience: where they stand ----------
  const spots = [];
  const put = (n, fn) => {
    for (let i = 0; i < n; i++) spots.push(fn(i, n));
  };
  // far side (rows behind the slab), the two sides, and the front corners
  put(18, (i, n) => [-5.4 + (10.8 * (i + lab.range(0.15, 0.85))) / n, lab.range(-5.3, -3.6)]);
  put(9, (i, n) => [-5.6 + (10.6 * (i + lab.range(0.2, 0.8))) / n, lab.range(-6.6, -5.6)]);
  put(7, (i, n) => [lab.range(-4.9, -4.0), -3.2 + (6.2 * (i + lab.range(0.2, 0.8))) / n]);
  put(7, (i, n) => [lab.range(4.0, 4.9), -3.2 + (6.2 * (i + lab.range(0.2, 0.8))) / n]);
  put(3, () => [lab.range(-5.2, -4.2), lab.range(3.2, 3.9)]);
  put(3, () => [lab.range(4.2, 5.2), lab.range(3.2, 3.9)]);
  const kinds = ['bar', 'bar', 'visor', 'dot'];
  const tex = Object.fromEntries(['bar', 'visor', 'dot'].map((k) => [k, eyeTexture(THREE, k)]));
  const behind = Math.atan2(-4.2, 1.2); // the stretch of audience right behind Maya, as seen from the camera
  const angDist = (a, b) => Math.abs(((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI);

  const WAVE = 1.6; // one lap
  const eyes = spots.map(([x, z], i) => {
    const kind = kinds[Math.floor(lab.rand() * kinds.length)];
    const warm = new THREE.Color(lab.PALETTE.light).lerp(new THREE.Color(0xffe2b8), lab.rand() * 0.5);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[kind], color: warm.clone().multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const h = lab.range(0.28, 0.5); // how tall this robot is: its eye's height off the floor
    sp.position.set(x, FLOOR + h, z);
    lab.add(sp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, FLOOR + 0.006, z);
    lab.add(ring);
    const theta = Math.atan2(z, x);
    const swell = Math.exp(-(angDist(theta, behind) ** 2) / 0.3);
    const hop = 0.1 + 0.42 * swell + lab.range(0, 0.04);
    const v = Math.sqrt(2 * G * hop);
    return {
      sp, ring, x, z, h, kind, swell,
      w: (kind === 'visor' ? 0.34 : kind === 'dot' ? 0.16 : 0.26) * lab.range(0.85, 1.1),
      hop, v, flight: (2 * v) / G,
      open: 0, // set later: when it opens
      hit: (((Math.PI / 2 - theta) % TAU) + TAU) % TAU / TAU * WAVE, // when the wave reaches it, after the wave starts
      close: 0,
    };
  });
  // the order they open in: random, one after another
  const order = eyes.map((e, i) => i).sort(() => lab.rand() - 0.5);
  order.forEach((idx, j) => (eyes[idx].open = 0.04 + (j / eyes.length) * 0.85 + lab.range(-0.02, 0.02)));
  for (const e of eyes) e.close = lab.range(0, 0.38);
  // the latecomer: a front-left eye that wasn't paying attention
  const late = eyes.reduce((best, e) => (!best || Math.hypot(e.x + 2.2, e.z + 4.3) < Math.hypot(best.x + 2.2, best.z + 4.3) ? e : best), null);

  // ---------- one function draws every eye from the clock ----------
  let T0 = Infinity; // eyes start opening
  let TW = Infinity; // the wave starts
  let TC = Infinity; // the scatter close
  let TL = Infinity; // the latecomer
  const blink = (t, at, w = 0.035) => 1 - 0.92 * Math.exp(-(((t - at) / w) ** 2));
  lab.every(() => {
    const t = lab.t;
    for (const e of eyes) {
      const isLate = e === late;
      // openness
      let o = 0;
      const uo = t - T0 - e.open;
      if (uo > 0) o = Math.min(1.25, ease.outBack(Math.min(1, uo / 0.16)));
      // the wave: crouch-blink, launch, blink at the top, land-blink
      let y = 0;
      let stretch = 0;
      let landPulse = 0;
      const th = TW + e.hit;
      const u = t - th;
      if (!isLate) {
        o *= blink(t, th - 0.06) * blink(t, th + e.flight * 0.5, 0.03) * blink(t, th + e.flight + 0.02);
        if (u > -0.12 && u < 0) y = -0.035 * Math.sin((Math.PI * (u + 0.12)) / 0.12);
        else if (u >= 0 && u <= e.flight) {
          y = e.v * u - 0.5 * G * u * u;
          stretch = 0.35 * Math.max(0, 1 - u / (e.flight * 0.4));
        } else if (u > e.flight && u < e.flight + 0.4) {
          const k = (u - e.flight) / 0.4;
          landPulse = (1 - k) ** 2;
          y = -0.03 * Math.sin(k * Math.PI) * (1 - k);
        }
      }
      // closing in a scatter
      const uc = t - TC - e.close;
      if (!isLate && uc > 0) o *= Math.max(0, 1 - ease.in(Math.min(1, uc / 0.12)));
      if (isLate) {
        // late: opens after everyone has closed, glances left and right, hops alone, blinks out
        const ul = t - TL;
        o = 0;
        let dx = 0;
        if (ul > 0) {
          o = Math.min(1, ease.outBack(Math.min(1, ul / 0.12)));
          dx = ul > 0.15 && ul < 0.55 ? Math.sin(((ul - 0.15) / 0.4) * TAU) * 0.05 : 0;
          o *= blink(t, TL + 0.6) * (ul > 1.18 ? Math.max(0, 1 - (ul - 1.18) / 0.06) : 1);
          const uh = ul - 0.68;
          const fl = (2 * 1.5) / G;
          if (uh > 0 && uh < fl) {
            y = 1.5 * uh - 0.5 * G * uh * uh;
            stretch = 0.3 * Math.max(0, 1 - uh / (fl * 0.4));
          } else if (uh >= fl && uh < fl + 0.3) landPulse = (1 - (uh - fl) / 0.3) ** 2;
        }
        e.sp.position.x = e.x + dx;
      }
      const glow = 1 + e.swell * 0.9 * (u > -0.1 && u < e.flight + 0.2 && !isLate ? 1 : 0);
      e.sp.position.y = FLOOR + e.h + y;
      e.sp.scale.set(e.w * (1 - stretch * 0.25), Math.max(0.0001, e.w * 0.36 * Math.max(0, o) * (1 + stretch)), 1);
      e.sp.material.opacity = Math.min(1, Math.max(0, o) * 1.2);
      e.sp.material.color.set(lab.PALETTE.light).multiplyScalar(2.2 * glow);
      // its ring on the floor: faint while the eye is open, a pulse when it lands
      const rr = 0.2 + 0.1 * landPulse + y * 0.15;
      e.ring.scale.set(rr, rr, rr);
      e.ring.material.opacity = Math.min(1, Math.max(0, o)) * (0.22 + 0.5 * landPulse) * (1 - Math.min(0.8, y * 1.2));
    }
  });

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
  lab.tween(0.6, (e, k) => {
    const u = k * 0.6;
    const w = Math.exp(-u * 6) * Math.sin(u * 17);
    maya.set({ x: 4 + 0.035 * w, pitch: 0.16 * w });
  }, ease.linear);
  const card = lab.bot('a').card;
  if (card) {
    const base = card.userData.base.clone();
    lab.tween(0.2, (e) => card.scale.set(base.x * (1 - e), base.y * (1 + 0.3 * e), 1), ease.in).then(() => arena.clearCards());
  }

  // ---------- the camera eases back; the room's light dips so the eyes can be seen ----------
  let back = 0;
  const releaseCam = lab.camera((home) => {
    const tg = home.target.clone();
    tg.y -= 0.5 * back;
    tg.z -= 0.35 * back;
    return { target: tg, dist: home.dist * (1 + 0.32 * back), el: home.el - 0.05 * back };
  });
  lab.tween(0.9, (e) => (back = e), ease.inOut);
  arena.setDim(0.35);
  await lab.wait(0.15);
  T0 = lab.t;
  await lab.wait(0.88);

  // ---------- the wave ----------
  TW = lab.t;
  // Maya hops once, with the swell behind her
  const mayaHit = eyes.filter((e) => e.swell > 0.8).reduce((a, e) => a + e.hit, 0) / Math.max(1, eyes.filter((e) => e.swell > 0.8).length);
  lab.wait(mayaHit - 0.05).then(async () => {
    await lab.tween(0.1, (e) => maya.set({ sy: 1 - 0.12 * e, sx: 1 + 0.06 * e, sz: 1 + 0.06 * e }), ease.out);
    const v = Math.sqrt(2 * G * 0.16);
    const fl = (2 * v) / G;
    await lab.tween(fl, (e, k) => {
      const u = k * fl;
      maya.set({ lift: v * u - 0.5 * G * u * u, sy: 1 + 0.12 * (1 - k * 2.5 > 0 ? 1 - k * 2.5 : 0), sx: 1, sz: 1 });
    }, ease.linear);
    lab.ring(lab.pos(4, 1), RED, 0.5, 0.03, 0.35);
    await lab.tween(0.25, (e, k) => {
      const w = Math.exp(-k * 4) * Math.cos(k * 12);
      maya.set({ lift: 0, sy: 1 - 0.13 * w, sx: 1 + 0.06 * w, sz: 1 + 0.06 * w });
    }, ease.linear);
    maya.set({ sy: 1, sx: 1, sz: 1 });
  });
  await lab.wait(WAVE + 0.25);

  // ---------- they close in a scatter; then the latecomer ----------
  TC = lab.t;
  await lab.wait(0.4);
  TL = lab.t;
  lab.wait(0.3).then(() => {
    arena.setDim(0);
    lab.tween(0.95, (e) => (back = 1 - e), ease.inOut);
  });
  await lab.wait(1.3);
  releaseCam();
  maya.release({ x: 4, y: 1, d: 1 });
}
