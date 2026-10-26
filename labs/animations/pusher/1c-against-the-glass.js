// Pressed against the TV, told as a crash zoom. The plate fires, the camera dives to meet Maya as she flies at
// us, and she smacks flat onto the inside of the screen: a soft smear of red polish with her eye as one bright
// streak, the glass catching a glint across the whole picture. The smear slips down and fades while the camera
// springs back, and there she is, tiny, one space south, still facing east.
export const meta = {
  title: 'Against the glass',
  idea: 'A crash zoom: the plate fires and the camera dives to meet Maya as she flies at us, until she smacks flat against the inside of the TV, a smear of red polish with her eye as one bright streak and a glint running across the screen. It slides down and fades as the camera springs back home, where she sits tiny, one space south, still facing east.',
  notes: 'Sound: a soft thock from the plate, a rising glass whoosh during the dive, a squeaky glass "fwump" on contact, then a little descending squeak as the smear slides (a wet finger on a window), and a tiny glass tick as she lands back on the board. Only for panels that push toward the camera (south). Port: the smear lives in the HUD layer; the dive is a camera tween to the robot; the robot is hidden while it is "on the screen". 1.85 s.',
};

const mix = (a, b, e) => a + (b - a) * e;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const span = (t, a, b) => clamp01((t - a) / (b - a));

// Drive the camera from a mutable shot { tx, ty, tz, dist, el, az, fov, roll }, keeping the game's framing offset
// so the picture doesn't slide when we take it or give it back.
function director(lab) {
  const A = lab.arena;
  const h = A.camHome;
  const shot = { tx: h.target.x, ty: h.target.y, tz: h.target.z, dist: h.dist, el: h.elev, az: 0, fov: 30, roll: 0 };
  const home = { ...shot };
  const sx0 = A.camCur?.sx ?? 0;
  const sy0 = A.camCur?.sy ?? 0;
  let last = lab.t;
  const v = new lab.THREE.Vector3();
  const release = lab.camera(() => {
    const dt = Math.max(0, lab.t - last);
    last = lab.t;
    const k = Math.min(0.9, dt * 4);
    if (A.camCur) {
      A.camCur.sx = sx0 / (1 - k);
      A.camCur.sy = sy0 / (1 - k);
    }
    return { target: v.set(shot.tx, shot.ty, shot.tz).clone(), dist: shot.dist, el: shot.el, az: shot.az, fov: shot.fov, roll: shot.roll };
  });
  return { shot, home, release };
}

// Maya flattened against the screen: her Pebble silhouette from above (pointing east, the way she faces),
// pressed wide, pale where it touches the glass, ringed by her own ring of light.
function paintSmear(g, cx, cy, W, H, slide, fade) {
  g.save();
  g.globalAlpha = fade;
  // the smudge she leaves above as she slides
  if (slide > 1) {
    for (let i = 0; i < 5; i++) {
      const x = cx + (-0.75 + i * 0.36) * W;
      const w = W * (0.14 + 0.05 * Math.sin(i * 2.3));
      const top = cy - H * (0.75 - 0.25 * Math.abs(i - 2) / 2);
      const gr = g.createLinearGradient(0, top, 0, top + slide);
      gr.addColorStop(0, 'rgba(255,77,109,0)');
      gr.addColorStop(1, `rgba(255,120,140,${0.18 + 0.05 * (i % 2)})`);
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(x - w / 2, top, w, slide, w / 2);
      g.fill();
    }
  }
  g.translate(cx, cy + slide);
  // her ring of light, squashed flat around her
  g.lineWidth = Math.max(1.5, H * 0.022);
  g.strokeStyle = 'rgba(255,120,145,0.9)';
  g.shadowColor = 'rgba(255,77,109,1)';
  g.shadowBlur = H * 0.12;
  g.beginPath();
  g.ellipse(-0.04 * W, 0, 1.38 * W, 1.28 * H, 0, 0, Math.PI * 2);
  g.stroke();
  // and its pointer, still showing east
  g.fillStyle = 'rgba(255,140,160,0.95)';
  g.beginPath();
  g.moveTo(1.56 * W, 0);
  g.lineTo(1.42 * W, -0.12 * H);
  g.lineTo(1.42 * W, 0.12 * H);
  g.closePath();
  g.fill();
  // the Pebble (bots3d pebbleShape, seen from above, nose to the right)
  const path = new Path2D();
  path.moveTo(W, 0);
  path.bezierCurveTo(W, 0.36 * H, -0.41 * W, H, -0.76 * W, 0.94 * H);
  path.bezierCurveTo(-1.07 * W, 0.87 * H, -1.14 * W, 0.42 * H, -1.0 * W, 0);
  path.bezierCurveTo(-1.14 * W, -0.42 * H, -1.07 * W, -0.87 * H, -0.76 * W, -0.94 * H);
  path.bezierCurveTo(-0.41 * W, -H, W, -0.36 * H, W, 0);
  g.shadowColor = 'rgba(255,77,109,0.95)';
  g.shadowBlur = H * 0.5;
  const grad = g.createRadialGradient(-0.25 * W, -0.05 * H, 0, -0.2 * W, 0, W * 1.15);
  grad.addColorStop(0, 'rgba(255,218,226,0.96)');
  grad.addColorStop(0.32, 'rgba(255,128,150,0.94)');
  grad.addColorStop(0.75, 'rgba(232,46,80,0.93)');
  grad.addColorStop(1, 'rgba(120,14,34,0.92)');
  g.fillStyle = grad;
  g.fill(path);
  g.shadowBlur = 0;
  g.lineWidth = Math.max(1.5, H * 0.03);
  g.strokeStyle = 'rgba(255,196,205,0.9)';
  g.stroke(path);
  // where the glass presses hardest: soft highlights
  g.globalCompositeOperation = 'lighter';
  const spec = (x, y, rx, ry, a) => {
    const s = g.createRadialGradient(x, y, 0, x, y, rx);
    s.addColorStop(0, `rgba(255,240,235,${a})`);
    s.addColorStop(1, 'rgba(255,240,235,0)');
    g.fillStyle = s;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.translate(-x, -y);
    g.beginPath();
    g.arc(x, y, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  spec(-0.45 * W, -0.45 * H, 0.42 * W, 0.2 * H, 0.32);
  spec(-0.2 * W, 0.35 * H, 0.55 * W, 0.18 * H, 0.16);
  // her eye, smeared into one bright streak across her nose
  g.shadowColor = '#fff6e8';
  g.shadowBlur = H * 0.3;
  g.fillStyle = 'rgba(255,250,240,1)';
  g.save();
  g.translate(0.36 * W, 0);
  g.rotate(-0.08);
  g.beginPath();
  g.roundRect(-0.045 * W, -0.42 * H, 0.09 * W, 0.84 * H, 0.045 * W);
  g.fill();
  g.shadowBlur = H * 0.12;
  g.fill();
  g.restore();
  g.restore();
}

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const E = lab.facing(1);
  const maya = lab.puppet('a');
  const bm = lab.bot('a');
  const ava = lab.bot('b');
  const panel = A.pushers.get('3,1');
  const start = lab.t;
  const T = () => lab.t - start;

  // the plate: our own timing (frameLoop sets it every frame, we set it after)
  let plateZ = 0.05;
  const plateGlow = panel.plate.material.emissiveIntensity;
  let glowK = 0;
  const stopPlate = lab.every(() => {
    panel.plate.position.z = plateZ;
    panel.plate.material.emissiveIntensity = plateGlow + glowK * 3;
  });
  lab.cleanup(() => (panel.plate.material.emissiveIntensity = plateGlow));

  // names fade while the camera is in close
  let tagK = 1;
  const stopTags = lab.every(() => {
    for (const b of [bm, ava]) if (b.tag) b.tag.material.opacity = tagK;
  });
  lab.cleanup(() => {
    for (const b of [bm, ava]) if (b.tag) b.tag.material.opacity = 1;
  });

  const cam = director(lab);
  const { shot, home } = cam;
  const p1 = lab.pos(3, 1);
  const p2 = lab.pos(3, 2);

  // the overlay: the TV's own glass
  const ov = lab.overlay;
  const W0 = ov.clientWidth || 960;
  const H0 = ov.clientHeight || 540;
  const cv = document.createElement('canvas');
  cv.width = W0;
  cv.height = H0;
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  const g = cv.getContext('2d');
  const vig = document.createElement('div');
  vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 50%, rgba(2,3,5,0.55) 0%, rgba(2,3,5,0.92) 75%)';
  const glint = document.createElement('div');
  glint.style.cssText = 'position:absolute;top:-30%;height:160%;width:22%;left:-40%;pointer-events:none;opacity:0;transform:rotate(18deg);background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,250,240,0.16) 42%, rgba(255,250,240,0.32) 50%, rgba(255,250,240,0.16) 58%, rgba(255,255,255,0) 100%)';
  ov.append(vig, cv, glint);

  // ---- 0.00-0.10 anticipation: the panel draws breath, the plate sinks back
  await lab.tween(0.1, (e) => {
    plateZ = 0.05 - 0.05 * e;
    glowK = e;
    maya.set({ x: 3, y: 1, rot: E, sy: 1 - 0.03 * e });
  }, ease.inOut);

  // ---- 0.10-0.18 fire: the plate shoots out and catches her
  await lab.tween(0.08, (e) => {
    plateZ = mix(0.0, 0.42, e);
    glowK = 1;
    maya.set({ sx: 1 - 0.22 * e, sy: 0.97 + 0.06 * e });
  }, ease.out3);
  lab.ring(lab.pos(3, 0.72).setY(0), '#f4efe4', 0.5, 0.18, 0.35);

  // ---- 0.18-0.58 the dive: she flies at us, the camera rushes down to meet her
  const lift0 = 0;
  await lab.tween(0.4, (e, k) => {
    const m = ease.in(k);
    glowK = 1 - k;
    tagK = 1 - clamp01(k * 3);
    const y = mix(1, 2.05, ease.out(k));
    const lift = lift0 + 0.42 * ease.inOut(k);
    maya.set({ y, lift, sx: mix(0.78, 1.18, k), sy: mix(1.03, 0.92, k), sz: 1 + 0.08 * k, roll: 0.28 * k });
    const at = lab.pos(3, y);
    shot.tx = mix(home.tx, at.x, ease.inOut(k));
    shot.ty = mix(home.ty, lift + 0.12, ease.inOut(k));
    shot.tz = mix(home.tz, at.z, ease.inOut(k));
    shot.dist = home.dist * Math.pow(0.95 / home.dist, m);
    shot.el = mix(home.el, 0.22, ease.inOut(k));
    shot.fov = mix(30, 44, m);
    void e;
  }, ease.linear);

  // ---- 0.58 SMACK: she's on the screen now
  const sc = lab.toScreen(maya.group.position.clone().setY(maya.pose.lift + 0.2));
  const cx = Math.max(W0 * 0.4, Math.min(W0 * 0.55, sc.x));
  const cy = Math.max(H0 * 0.4, Math.min(H0 * 0.52, sc.y));
  maya.set({ visible: false });
  lab.rest('a', { x: 3, y: 2, d: 1 });
  lab.flash('#ffe3e8', 0.14, 0.55);
  lab.shake(0.03, 0.2);
  let plateBack = 0;
  const smearW = W0 * 0.19;
  const smearH = H0 * 0.3;
  const tSmack = T();
  let landed = false;
  // the pressed beat (0.5 s) and the spring home (0.7 s), on one clock
  await lab.tween(1.22, (e, k) => {
    const t = k * 1.22;
    // squash on: it splats wider for a few frames, then relaxes a touch
    const splat = t < 0.07 ? ease.out3(t / 0.07) : 1;
    const settle = 1 + 0.07 * Math.exp(-t * 14) * Math.cos(t * 40);
    const pressed = span(t, 0.5, 1.0); // slide + fade while the camera springs back
    const slide = H0 * 0.11 * ease.in(pressed) + H0 * 0.012 * span(t, 0.08, 0.5);
    const fade = 1 - ease.in(span(t, 0.52, 0.98));
    g.clearRect(0, 0, W0, H0);
    if (fade > 0) paintSmear(g, cx, cy, smearW * mix(0.8, 1, splat) * settle, smearH * mix(1.15, 1, splat) / settle, slide, fade);
    vig.style.opacity = String(0.85 * Math.min(1, t / 0.06) * (1 - span(t, 0.5, 0.9)));
    // the glass catches the light: one glint sweeps across the screen
    const gk = span(t, 0.02, 0.4);
    glint.style.opacity = String(gk > 0 && gk < 1 ? Math.sin(gk * Math.PI) : 0);
    glint.style.left = `${mix(-30, 115, ease.inOut(gk))}%`;
    // the camera: a tiny recoil while she's pressed, then a spring back home
    const recoil = 1 + 0.05 * span(t, 0, 0.5);
    const back = ease.outBack(span(t, 0.5, 1.2), 1.4);
    const at = lab.pos(3, 2.05);
    shot.tx = mix(at.x, home.tx, back);
    shot.ty = mix(0.54, home.ty, back);
    shot.tz = mix(at.z, home.tz, back);
    shot.dist = Math.exp(mix(Math.log(0.95 * recoil), Math.log(home.dist), back));
    shot.el = mix(0.22, home.el, back);
    shot.fov = mix(44, 30, back);
    tagK = span(t, 0.95, 1.2);
    // the plate eases back into its housing while nobody looks
    plateBack = span(t, 0.1, 0.5);
    plateZ = mix(0.42, 0.05, ease.inOut(plateBack));
    // Maya: back on the board once the camera has left her; she drops the last few centimetres and wobbles
    const land = span(t, 0.62, 0.92);
    if (t >= 0.74 && !landed) {
      landed = true;
      lab.ring(lab.pos(3, 2).setY(0), '#ff4d6d', 0.75, 0.02, 0.5);
    }
    if (t >= 0.62) {
      const drop = 0.28 * (1 - ease.outBounce(land));
      const wob = span(t, 0.8, 1.22);
      maya.set({
        visible: true, trail: false, x: 3, y: 2, lift: drop, sx: 1, sz: 1,
        sy: 1 - 0.12 * Math.sin(land * Math.PI) * (land < 1 ? 1 : 0),
        roll: 0.1 * Math.sin(wob * 18) * (1 - wob),
        rot: E + 0.14 * Math.sin(wob * 13) * (1 - wob) ** 2,
        pitch: 0,
      });
    }
    void e;
  }, ease.linear);
  void tSmack;
  void p1;
  void p2;
  stopPlate();
  stopTags();
  panel.plate.position.z = 0.05;
  g.clearRect(0, 0, W0, H0);
  Object.assign(shot, home);
  cam.release();
  maya.set({ x: 3, y: 2, lift: 0, rot: E, roll: 0, pitch: 0, sx: 1, sy: 1, sz: 1, visible: true });
  maya.release({ x: 3, y: 2, d: 1 });
}
