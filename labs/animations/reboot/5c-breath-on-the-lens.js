// Reboot, idea 5 (Fogged screen), animator c: cinematic & graphic staging.
// The TV is a lens too. A breath of fog blooms on the screen over the empty token: the picture behind it goes soft
// and milky, and the board's lights glow through it like streetlights through a misted windscreen. A fingertip
// wipes a quick, slightly bad doodle of her into the mist (round body, dot eye, arrow east) and the wiped lines are
// clear, sharp picture, with a bead of light along each edge, so her red already shows through. Twice the finger
// slips and leaves a grey smear (the 2 SPAM). Then the mist evaporates from its edges inward, and the real Maya is
// sitting exactly where the doodle was.
export const meta = {
  title: 'Breath on the lens',
  idea:
    'A breath of fog blooms on the TV screen over the empty token: the picture behind goes soft and milky and the board\'s lights glow through it like a misted windscreen. A fingertip wipes a quick, slightly bad doodle into the mist (round body, dot eye, arrow east); the wiped lines are clear, sharp picture with a bead of light on each edge, and through them her red already shows. Twice the finger slips into a grey smear: the 2 SPAM. The mist evaporates from its edges inward and the real Maya sits exactly where the doodle was.',
  notes:
    'Sound: a soft breath "hhh" (filtered noise), two squeaks of a fingertip on glass for the circle and the arrow, a tiny dull rub for each smear, then a high, fading glass shimmer as the fog clears. Porting: built in the HUD layer: a backdrop-filter blur (the fog) masked by a canvas (fog shape minus the strokes, sent as a mask image each frame) plus a milky canvas on top with the stroke rims and smears. The doodle can be jittered each time (wobblier circle, different arrow flourish). The board is untouched underneath, so it bends no rule.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;

  const T0 = arena.time;
  const now = () => arena.time - T0;
  // timeline (seconds)
  const FOG = [0, 0.42];
  const SHOW = 0.36; // she is there behind the fog from here on
  const DRAW0 = 0.48;
  const CLEAR = [1.82, 2.58];
  const END = 2.66;

  // ---------- Maya is already there behind the fog ----------
  const maya = lab.puppet('a');
  maya.set({ x: 3, y: 1, rot: lab.facing(1), visible: false, trail: false });

  // ---------- screen geometry ----------
  const ov = lab.overlay;
  const OW = ov.clientWidth || 960;
  const OH = ov.clientHeight || 540;
  const token = lab.pos(3, 1);
  const c0 = lab.toScreen(token.clone().setY(0.12));
  const u = Math.abs(lab.toScreen(token.clone().add(new THREE.Vector3(0.5, 0.12, 0))).x - lab.toScreen(token.clone().add(new THREE.Vector3(-0.5, 0.12, 0))).x); // px per space
  maya.group.updateMatrixWorld(true);
  const BOX = Math.round(u * 4.4);
  const bx = Math.round(c0.x - BOX / 2);
  const by = Math.round(c0.y - BOX / 2 + u * 0.05);
  const px = (x, y) => [x - bx, y - by]; // overlay px -> box px
  const C = px(c0.x, c0.y);
  const scale = OW / 960;

  // ---------- the fog layers ----------
  const blur = document.createElement('div');
  blur.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${BOX}px;height:${BOX}px;pointer-events:none;backdrop-filter:blur(${(7 * scale).toFixed(1)}px) brightness(1.6) saturate(0.6);-webkit-backdrop-filter:blur(${(7 * scale).toFixed(1)}px) brightness(1.6) saturate(0.6);-webkit-mask-size:100% 100%;mask-size:100% 100%`;
  const milk = document.createElement('canvas');
  milk.width = BOX;
  milk.height = BOX;
  milk.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${BOX}px;height:${BOX}px;pointer-events:none`;
  ov.append(blur, milk);
  const maskCv = document.createElement('canvas');
  maskCv.width = BOX;
  maskCv.height = BOX;
  const mg = maskCv.getContext('2d');
  const kg = milk.getContext('2d');

  // the breath's shape: a cluster of soft blobs, some further out (they evaporate first)
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    const a = lab.range(0, Math.PI * 2);
    const d = i === 0 ? 0 : lab.range(0.12, 0.36) * BOX * 0.5;
    blobs.push({ x: C[0] + Math.cos(a) * d, y: C[1] + Math.sin(a) * d * 0.8, r: (i === 0 ? 0.66 : lab.range(0.36, 0.52)) * BOX * 0.5, far: d / (BOX * 0.25), delay: lab.range(0, 0.1) });
  }
  // condensation grain: fine speckles, drawn once
  const grain = document.createElement('canvas');
  grain.width = BOX;
  grain.height = BOX;
  {
    const g = grain.getContext('2d');
    for (let i = 0; i < BOX * 3; i++) {
      const x = lab.range(0, BOX);
      const y = lab.range(0, BOX);
      const r = lab.range(0.4, 1.6) * scale;
      g.fillStyle = `rgba(255,255,255,${lab.range(0.08, 0.35).toFixed(2)})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ---------- the doodle: strokes in screen space, a little bit bad ----------
  const eyeW = maya.model.body.localToWorld(new THREE.Vector3(0, 0.252, -0.13));
  const bodyW = maya.group.position.clone().setY(0.16);
  // she isn't placed yet (hidden): work from the token instead
  bodyW.set(token.x, 0.16, token.z);
  eyeW.set(token.x + 0.2, 0.33, token.z);
  const B = px(lab.toScreen(bodyW).x, lab.toScreen(bodyW).y);
  const E = px(lab.toScreen(eyeW).x, lab.toScreen(eyeW).y);
  const R = u * 0.44;
  const circle = [];
  for (let i = 0; i <= 64; i++) {
    const th = -1.9 + (i / 64) * (Math.PI * 2 + 0.55); // overshoots its start: not quite closed
    const w = 1 + 0.07 * Math.sin(3 * th + 0.8) + 0.04 * Math.sin(5 * th + 2) + 0.05 * (i / 64);
    circle.push([B[0] + Math.cos(th) * R * w * 1.08, B[1] + Math.sin(th) * R * w * 0.82]);
  }
  const dot = [];
  for (let i = 0; i <= 10; i++) {
    const th = (i / 10) * Math.PI * 2.4;
    const r = u * 0.035 * (0.4 + 0.6 * (i / 10));
    dot.push([E[0] + Math.cos(th) * r, E[1] + Math.sin(th) * r]);
  }
  const ax0 = [B[0] + R * 1.12, B[1] + u * 0.02];
  const ax1 = [B[0] + R * 2.15, B[1] - u * 0.03];
  const shaft = [ax0, [lerp(ax0[0], ax1[0], 0.5), lerp(ax0[1], ax1[1], 0.5) + u * 0.03], ax1];
  const head1 = [[ax1[0] - u * 0.2, ax1[1] - u * 0.16], ax1];
  const head2 = [ax1, [ax1[0] - u * 0.19, ax1[1] + u * 0.15]];
  const smear1 = [[B[0] - R * 0.7, B[1] + R * 0.75], [B[0] - R * 0.88, B[1] + R * 1.05], [B[0] - R * 0.78, B[1] + R * 1.2]];
  const smear2 = [[ax1[0] - u * 0.05, ax1[1] + u * 0.24], [ax1[0] + u * 0.08, ax1[1] + u * 0.4]];
  const W = Math.max(5, u * 0.14); // fingertip width
  const strokes = [
    { pts: circle, t0: DRAW0, t1: DRAW0 + 0.46, w: W },
    { pts: smear1, t0: DRAW0 + 0.47, t1: DRAW0 + 0.56, w: W * 1.5, smear: true },
    { pts: dot, t0: DRAW0 + 0.64, t1: DRAW0 + 0.74, w: W * 0.9 },
    { pts: shaft, t0: DRAW0 + 0.82, t1: DRAW0 + 0.98, w: W },
    { pts: head1, t0: DRAW0 + 1.0, t1: DRAW0 + 1.08, w: W },
    { pts: head2, t0: DRAW0 + 1.08, t1: DRAW0 + 1.16, w: W },
    { pts: smear2, t0: DRAW0 + 1.18, t1: DRAW0 + 1.27, w: W * 1.5, smear: true },
  ];
  // the part of a stroke drawn by time T (a finger: quick in the middle, slow at the ends)
  const partial = (s, T) => {
    const k = ease.inOut(seg(T, s.t0, s.t1));
    if (k <= 0) return null;
    const n = s.pts.length - 1;
    const f = k * n;
    const i = Math.floor(f);
    const out = s.pts.slice(0, i + 1);
    if (i < n) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      out.push([lerp(a[0], b[0], f - i), lerp(a[1], b[1], f - i)]);
    }
    return out;
  };
  const path = (g, pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (pts.length === 1) g.lineTo(pts[0][0] + 0.1, pts[0][1]);
  };

  // ---------- draw the fog each frame ----------
  const fogShape = (g, T, color, alphaK) => {
    const grow = ease.out3(seg(T, FOG[0], FOG[1]));
    for (const b of blobs) {
      // evaporate: the far blobs go first, the whole patch shrinks to the middle
      const f = Math.min(1, b.far);
      const ev = smooth(seg(T, CLEAR[0] + 0.3 * (1 - f) + b.delay, CLEAR[1] - 0.2 * f));
      const r = b.r * (0.25 + 0.75 * grow) * (1 - 0.92 * ev ** 0.8);
      if (r <= 1) continue;
      const a = alphaK * (1 - ev ** 1.6) * Math.min(1, grow * 1.6);
      const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      gr.addColorStop(0, `rgba(${color},${a.toFixed(3)})`);
      gr.addColorStop(0.55, `rgba(${color},${(a * 0.85).toFixed(3)})`);
      gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(b.x, b.y, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  const drawStrokes = (g, T, widen, mode) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes) {
      const pts = partial(s, T);
      if (!pts) continue;
      if (mode === 'clear' && s.smear) continue;
      g.lineWidth = s.w + widen;
      path(g, pts);
      g.stroke();
    }
  };

  let lastMask = '';
  const stop = lab.every(() => {
    const T = now();
    if (T >= SHOW) maya.set({ visible: true });

    // the mask for the blur: the fog's shape with the wiped lines cut out
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, BOX, BOX);
    fogShape(mg, T, '255,255,255', 1);
    mg.globalCompositeOperation = 'destination-out';
    mg.strokeStyle = 'rgba(0,0,0,1)';
    drawStrokes(mg, T, 0, 'clear');
    const url = `url(${maskCv.toDataURL()})`;
    if (url !== lastMask) {
      blur.style.maskImage = url;
      blur.style.webkitMaskImage = url;
      lastMask = url;
    }

    // the milky layer: mist, grain, grey smears, and a bead of light along each wiped edge
    kg.globalCompositeOperation = 'source-over';
    kg.clearRect(0, 0, BOX, BOX);
    fogShape(kg, T, '214,222,234', 0.3);
    kg.globalCompositeOperation = 'source-atop';
    kg.globalAlpha = 0.6;
    kg.drawImage(grain, 0, 0);
    kg.globalAlpha = 1;
    // smears: the finger slips, the mist goes grey and thick there
    kg.globalCompositeOperation = 'source-atop';
    kg.lineCap = 'round';
    kg.lineJoin = 'round';
    for (const s of strokes) {
      if (!s.smear) continue;
      const pts = partial(s, T);
      if (!pts) continue;
      kg.strokeStyle = 'rgba(120,124,132,0.85)';
      kg.lineWidth = s.w;
      path(kg, pts);
      kg.stroke();
      kg.strokeStyle = 'rgba(90,94,100,0.6)';
      kg.lineWidth = s.w * 0.5;
      path(kg, pts);
      kg.stroke();
    }
    // the rim: a bright bead of water along each wiped line
    kg.strokeStyle = 'rgba(255,255,255,0.55)';
    drawStrokes(kg, T, 3.2 * scale, 'clear');
    kg.globalCompositeOperation = 'destination-out';
    kg.strokeStyle = 'rgba(0,0,0,1)';
    drawStrokes(kg, T, 0, 'clear');
    // a fingertip pressing at the head of the stroke being drawn
    kg.globalCompositeOperation = 'source-over';
    for (const s of strokes) {
      if (T < s.t0 || T > s.t1) continue;
      const pts = partial(s, T);
      if (!pts) continue;
      const [hx, hy] = pts[pts.length - 1];
      const gr = kg.createRadialGradient(hx, hy, 0, hx, hy, s.w * 1.4);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.0)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      kg.fillStyle = gr;
      kg.beginPath();
      kg.arc(hx, hy, s.w * 1.4, 0, Math.PI * 2);
      kg.fill();
    }
  });

  await lab.wait(END);
  stop();
  blur.remove();
  milk.remove();
  maya.release({ x: 3, y: 1, d: 1, on: true });
  void lerp;
}
