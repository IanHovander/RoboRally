// Reboot, idea 44 "Fogged screen", animator a (weight & physical comedy).
// Someone on the sofa breathes on the TV: a patch of the picture over the empty token puffs up milky. A
// fingertip wipes through it and doodles Maya, quick and a bit badly, with a finger that has momentum: the
// body loop overshoots its start, the eye is a dab, and twice the finger skids on the wet glass and leaves a
// smudge (the 2 SPAM). The water it pushes gathers at the ends of the strokes and, because the TV stands up,
// it runs DOWN the screen, not across the board: little drips that stick and slip on their way. Through the
// wiped lines the real Maya is already there in red. Then the fog evaporates from its edges inward and leaves
// her resting on the token, facing east, exactly where the doodle was.
export const meta = {
  title: 'Breath on the screen',
  idea: 'A breath fogs a patch of the TV over the empty token. A fingertip doodles Maya in it, quick and a bit badly: a loop that overshoots, a dab for an eye, an arrow east, and two skids where the finger slips on the wet glass (the 2 SPAM). The water it pushes gathers at the ends of the strokes and runs DOWN the screen in little stick-and-slip drips, because the TV is standing up. Through the wiped lines the real Maya is already there; the fog evaporates from its edges in and leaves her on the token facing east.',
  notes: 'Sound: a soft "haaah" breath, then the squeak of a fingertip on glass for each stroke (a short bright squeak for the dab, two little skid squeaks for the slips), a faint trickle for the drips, and nothing for the clearing. Port: the fog is a DOM layer over the canvas (a blurred, milky backdrop with a mask redrawn from the strokes each frame); the doodle wobbles differently each time (a different loop, arrow flourish, slips), and the drips fall wherever the strokes ended low.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const ov = lab.overlay;
  const rect = ov.getBoundingClientRect();

  // ---------- screen geometry: the token on the screen, and how big a space looks ----------
  const tok = lab.toScreen(lab.pos(3, 1).add(new THREE.Vector3(0, 0.14, 0)));
  const east = lab.toScreen(lab.pos(4, 1).add(new THREE.Vector3(0, 0.14, 0)));
  const u = Math.hypot(east.x - tok.x, east.y - tok.y); // CSS px per space here
  const FW = Math.round(u * 3.6);
  const FH = Math.round(u * 3.0);
  const fx0 = Math.round(tok.x - FW / 2);
  const fy0 = Math.round(tok.y - FH * 0.47);
  const cx = tok.x - fx0; // the token, in the fog's own pixels
  const cy = tok.y - fy0;

  // ---------- the layers: blurred milky backdrop (masked), and the water on the glass above it ----------
  const fog = document.createElement('div');
  const blurPx = Math.max(4, u * 0.11);
  fog.style.cssText = `position:absolute;left:${fx0}px;top:${fy0}px;width:${FW}px;height:${FH}px;pointer-events:none;` + `background:rgba(206,214,226,.8);backdrop-filter:blur(${blurPx}px) brightness(1.3) saturate(.5);-webkit-backdrop-filter:blur(${blurPx}px) brightness(1.3) saturate(.5);` + `-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;opacity:1`;
  ov.append(fog);
  const water = document.createElement('canvas');
  water.width = FW;
  water.height = FH;
  water.style.cssText = `position:absolute;left:${fx0}px;top:${fy0}px;width:${FW}px;height:${FH}px;pointer-events:none`;
  ov.append(water);
  const mask = document.createElement('canvas');
  mask.width = FW;
  mask.height = FH;
  const mg = mask.getContext('2d');
  const wg = water.getContext('2d');

  // the breath's shape: a soft, slightly lopsided blob, and a speckle of condensation in it
  const lobes = Array.from({ length: 7 }, () => ({ a: lab.range(0, Math.PI * 2), r: lab.range(0.18, 0.32), k: lab.range(0.25, 0.4) }));
  const speck = Array.from({ length: 260 }, () => ({ x: lab.range(-1, 1), y: lab.range(-1, 1), r: lab.range(0.4, 1.4), a: lab.range(0.08, 0.25) }));

  // ---------- the doodle: strokes in token-relative units (u), timed like a quick hand ----------
  const P = (x, y) => ({ x: cx + x * u, y: cy + y * u });
  const wob = (k, f, a, ph) => a * Math.sin(k * f + ph);
  const strokes = [];
  // the body: a loop around her, starting top, clockwise, overshooting its start (momentum)
  {
    const pts = [];
    const n = 48;
    const ph = lab.range(0, 6);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const a = -Math.PI / 2 - 0.35 + k * (Math.PI * 2 + 0.75);
      const r = 0.42 + wob(k, 9, 0.025, ph) + 0.04 * k;
      pts.push(P(Math.cos(a) * r * 1.12 - 0.04, Math.sin(a) * r * 0.86 + 0.02));
    }
    strokes.push({ pts, t0: 0.42, dur: 0.42, w: 0.12, easing: ease.inOut });
  }
  // the eye: a dab, toward the east side of the body
  {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(P(0.2 + Math.cos(a) * 0.03, -0.08 + Math.sin(a) * 0.03));
    }
    strokes.push({ pts, t0: 0.9, dur: 0.06, w: 0.1, easing: ease.out });
  }
  // slip 1: the finger skids off the eye, down and back, in a fast wobbly smear
  {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      pts.push(P(0.2 - 0.32 * k + 0.03 * Math.sin(k * 20), -0.08 + 0.22 * k * k + 0.025 * Math.sin(k * 17)));
    }
    strokes.push({ pts, t0: 0.97, dur: 0.07, w: 0.16, easing: ease.in, slip: true });
  }
  // the arrow: a shaft east, then the head in one go (up-barb, back to the tip, down-barb)
  {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      pts.push(P(0.52 + 0.5 * k, 0.02 - 0.03 * k + 0.012 * Math.sin(k * 7)));
    }
    strokes.push({ pts, t0: 1.1, dur: 0.17, w: 0.11, easing: ease.inOut });
    const tip = P(1.02, -0.01);
    const up = P(0.84, -0.17);
    const dn = P(0.85, 0.15);
    const line = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n) }));
    strokes.push({ pts: [...line(up, tip, 8), ...line(tip, dn, 8)], t0: 1.32, dur: 0.18, w: 0.11, easing: ease.inOut });
  }
  // slip 2: off the end of the down-barb, the finger skids away
  {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      pts.push(P(0.85 - 0.16 * k + 0.02 * Math.sin(k * 23), 0.15 + 0.16 * k + 0.02 * Math.sin(k * 19)));
    }
    strokes.push({ pts, t0: 1.52, dur: 0.07, w: 0.16, easing: ease.in, slip: true });
  }
  // drips: water pushed by the finger gathers at the low ends of strokes and runs down the screen
  const drips = [
    { from: P(-0.4, 0.29), t0: 0.95, w: 0.04, max: 0.6 },
    { from: P(0.72, 0.31), t0: 1.64, w: 0.045, max: 0.55 },
  ].map((d) => ({ ...d, y: 0, v: 0, stuck: 0, len: 0 }));

  // how much of a stroke is drawn at local time t
  const drawn = (s, t) => Math.max(0, Math.min(1, (t - s.t0) / s.dur));
  const pathTo = (g, s, k) => {
    const n = s.pts.length - 1;
    const upto = k * n;
    g.beginPath();
    g.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i <= Math.floor(upto); i++) g.lineTo(s.pts[i].x, s.pts[i].y);
    const f = upto - Math.floor(upto);
    if (f > 0 && Math.floor(upto) < n) {
      const a = s.pts[Math.floor(upto)];
      const b = s.pts[Math.floor(upto) + 1];
      g.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    }
  };

  // ---------- state ----------
  let breath = 0; // the fog's size 0..1(+)
  let density = 0; // its opacity
  let clear = 0; // evaporation 0..1 (from the edges in)
  let tl = 0; // the doodle's local clock

  const redraw = () => {
    // the mask: fog where it's white
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, FW, FH);
    const R = Math.max(1, breath * u * 1.45);
    // the blob: overlapping soft lobes around the token
    const shrink = 1 - ease.in(clear);
    const blob = (x, y, r, a) => {
      const gr = mg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.62, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      mg.fillStyle = gr;
      mg.beginPath();
      mg.arc(x, y, r, 0, Math.PI * 2);
      mg.fill();
    };
    if (shrink > 0.01) {
      blob(cx, cy, R * shrink, density);
      for (const l of lobes) blob(cx + Math.cos(l.a) * R * l.k * 1.3 * shrink, cy + Math.sin(l.a) * R * l.k * shrink, R * (0.55 + l.r) * shrink, density);
      // condensation speckle: a few thinner spots
      mg.globalCompositeOperation = 'destination-out';
      for (const s of speck) {
        mg.fillStyle = `rgba(0,0,0,${s.a})`;
        mg.beginPath();
        mg.arc(cx + s.x * R * 1.2 * shrink, cy + s.y * R * shrink, s.r * u * 0.02, 0, Math.PI * 2);
        mg.fill();
      }
    }
    // the strokes: wiped clear
    mg.globalCompositeOperation = 'destination-out';
    mg.lineCap = 'round';
    mg.lineJoin = 'round';
    for (const s of strokes) {
      const k = s.easing(drawn(s, tl));
      if (k <= 0) continue;
      pathTo(mg, s, k);
      mg.strokeStyle = 'rgba(0,0,0,.45)';
      mg.lineWidth = s.w * u * 1.35;
      mg.stroke();
      mg.strokeStyle = s.slip ? 'rgba(0,0,0,.8)' : 'rgba(0,0,0,1)';
      mg.lineWidth = s.w * u;
      mg.stroke();
    }
    for (const d of drips) {
      if (d.len <= 0) continue;
      mg.strokeStyle = 'rgba(0,0,0,.9)';
      mg.lineWidth = d.w * u * 0.7;
      mg.beginPath();
      mg.moveTo(d.from.x, d.from.y);
      mg.lineTo(d.from.x + Math.sin(d.len * 0.08) * 1.5, d.from.y + d.len);
      mg.stroke();
      mg.fillStyle = '#000';
      mg.beginPath();
      mg.arc(d.from.x, d.from.y + d.len, d.w * u * 0.75, 0, Math.PI * 2);
      mg.fill();
    }
    const url = mask.toDataURL();
    fog.style.webkitMaskImage = `url(${url})`;
    fog.style.maskImage = `url(${url})`;

    // the water on the glass: bright beads along the stroke edges, and the drips' heads
    wg.clearRect(0, 0, FW, FH);
    const vis = density * (1 - ease.in(clear));
    if (vis > 0.01) {
      wg.lineCap = 'round';
      wg.lineJoin = 'round';
      for (const s of strokes) {
        const k = s.easing(drawn(s, tl));
        if (k <= 0) continue;
        wg.globalCompositeOperation = 'source-over';
        pathTo(wg, s, k);
        wg.strokeStyle = `rgba(240,246,255,${0.35 * vis})`;
        wg.lineWidth = s.w * u * 1.5;
        wg.stroke();
        wg.globalCompositeOperation = 'destination-out';
        wg.strokeStyle = '#000';
        wg.lineWidth = s.w * u * 1.18;
        wg.stroke();
      }
      wg.globalCompositeOperation = 'source-over';
      // the fingertip: a little wet bulge of pushed water riding at the head of the stroke being drawn
      for (const s of strokes) {
        const raw = drawn(s, tl);
        if (raw <= 0 || raw >= 1) continue;
        const k = s.easing(raw);
        const n = s.pts.length - 1;
        const i = Math.min(n - 1, Math.floor(k * n));
        const f = k * n - i;
        const hx = s.pts[i].x + (s.pts[i + 1].x - s.pts[i].x) * f;
        const hy = s.pts[i].y + (s.pts[i + 1].y - s.pts[i].y) * f;
        wg.strokeStyle = `rgba(245,250,255,${0.7 * vis})`;
        wg.lineWidth = Math.max(1, u * 0.018);
        wg.beginPath();
        wg.arc(hx, hy, s.w * u * 0.72, 0, Math.PI * 2);
        wg.stroke();
      }
      for (const d of drips) {
        if (d.len <= 0 && tl < d.t0 - 0.15) continue;
        const r = d.w * u * (0.75 + 0.25 * Math.min(1, (tl - d.t0 + 0.15) / 0.15));
        const x = d.from.x;
        const y = d.from.y + d.len;
        // a bead of water: a dark-edged lens with a bright glint
        wg.strokeStyle = `rgba(230,238,250,${0.55 * vis})`;
        wg.lineWidth = Math.max(1, u * 0.012);
        wg.beginPath();
        wg.arc(x, y, r, 0, Math.PI * 2);
        wg.stroke();
        wg.fillStyle = `rgba(255,255,255,${0.9 * vis})`;
        wg.beginPath();
        wg.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
        wg.fill();
      }
    }
  };

  // drips: stick and slip down the screen (gravity is screen-down on a TV)
  const stepDrips = (dt) => {
    for (const d of drips) {
      if (tl < d.t0) continue;
      if (d.stuck > 0) {
        d.stuck -= dt;
        d.v = 0;
        continue;
      }
      d.v += u * 9 * dt;
      d.len += d.v * dt;
      // the head picks up a drop of fog and sticks for a moment, now and then
      if (d.v > u * 0.9 && lab.rand() < 0.22) {
        d.stuck = lab.range(0.04, 0.12);
        d.v = 0;
      }
      // it runs out of water where the fog thins out at the bottom of the patch
      d.len = Math.min(d.len, d.max * u, cy + u * 1.1 - d.from.y);
    }
  };

  maya.set({ x: 3, y: 1, rot: lab.facing(1), visible: false, trail: false });
  const stop = lab.every((dt) => {
    stepDrips(dt);
    redraw();
  });

  // ---------- 1. the breath: a puff that blooms fast and overshoots a touch ----------
  await lab.tween(0.4, (e, k) => {
    breath = ease.outBack(k, 1.3);
    density = Math.min(1, k * 2.4);
    tl = k * 0.4;
    // she's there behind the fog as soon as it's thick enough to hide her
    if (k > 0.45) maya.set({ visible: true });
  }, ease.linear);
  maya.set({ visible: true });

  // ---------- 2. the doodle ----------
  await lab.tween(1.25, (e, k) => {
    tl = 0.4 + 1.25 * k;
    // the fog breathes a little as it sits
    breath = 1 + 0.015 * Math.sin(k * 9);
  }, ease.linear);

  // ---------- 3. it evaporates from its edges inward ----------
  await lab.tween(0.75, (e, k) => {
    tl = 1.65 + 0.75 * k;
    clear = k;
    density = 1 - ease.in(Math.max(0, (k - 0.55) / 0.45));
  }, ease.linear);
  stop();
  fog.remove();
  water.remove();
  maya.release({ x: 3, y: 1, d: 1, on: true });
}
