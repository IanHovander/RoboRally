// Refraction Kiss, staged like femto-photography (a camera fast enough to film light itself): at the kiss the
// world freezes, the camera leans in, the room irises down to the prism, and we watch the light travel: white
// into Theo's prism, a rainbow out across the glass to the exact space he will land on. Then time runs again and
// he slides along his own spectrum until the colours fold back into his ridge in one glint.
export const meta = {
  title: 'Femto Prism',
  idea:
    "The instant Maya's nose kisses Theo, time stops, the camera leans in and the dark irises down around them. In the frozen frame we watch light move: her eye flares, the warm white floods into Theo's glass prism and leaves its far side as a rainbow that spreads over the glass and paints a rainbow ring exactly on space 4, where he is about to land. Time snaps back; Theo slides along his own spectrum, the fan shrinking under him, and as he stops in the rainbow ring the colours fold into his ridge in one bright glint. The iris opens, and it is warm white and two players' colours again.",
  notes:
    "Staging: the robots freeze but the light keeps moving (it runs on real time), the camera leans in only while time is stopped, so the moment reads as a photograph of light. The iris lives in the HUD layer (a soft radial mask) and never closes all the way: the rest of the board stays faintly visible. Sound: a single sustained glass tone at the kiss that splits into a chord as the rainbow spreads, then the chord folds back into one note at the glint. Per form, when it is the one pushed: an Orb focuses the beam to a hot white point on its destination, a Cube mirrors it as a straight bright bar that ends on the destination, a Capsule draws a curved line of caustic light, a Spire a thin needle of light; only the Prism splits it into colour, so a rainbow means Theo.",
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const P = (x, y) => lab.pos(x, y);
  const R = 0.517;
  const SPECTRUM = ['#ff2a3d', '#ff7a1a', '#ffd83b', '#4dff6a', '#2fd5ff', '#4a5cff', '#b04dff'];

  // ---- the rainbow fan: a canvas wedge (red bends least, violet most) lying on the glass ----
  const fanTex = (() => {
    const W = 256;
    const H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const half = (0.04 + 0.96 * u) * (H / 2);
      const a = (0.35 + 0.65 * u ** 1.5) * Math.min(1, (1 - u) * 14); // brighter where it lands, soft end
      for (let i = 0; i < 7; i++) {
        const y0 = H / 2 - half + (2 * half * i) / 7;
        g.fillStyle = SPECTRUM[i];
        g.globalAlpha = a;
        g.fillRect(x, y0, 1, (2 * half) / 7 + 0.6);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const fanMat = new THREE.MeshBasicMaterial({ map: fanTex, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  // plane: local x 0..1 along the fan, z -0.5..0.5 across; we scale it to the fan's length and width
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), fanMat);
  fan.renderOrder = 4;
  lab.add(fan);
  // and a shorter clip of it for the travelling front (we clip by scaling the uv window)
  const ringTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createConicGradient(Math.PI, 64, 64);
    SPECTRUM.forEach((s, i) => gr.addColorStop(i / 7, s));
    gr.addColorStop(1, SPECTRUM[0]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const rainMat = new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(2.4, 2.4, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  let rainGeo = new THREE.RingGeometry(R - 0.03, R + 0.02, 96, 1, Math.PI, 0.001);
  const rain = new THREE.Mesh(rainGeo, rainMat);
  rain.rotation.x = -Math.PI / 2;
  rain.position.copy(P(4, 2)).setY(0.014);
  rain.renderOrder = 5;
  lab.add(rain);
  // the glint: a four-pointed star of warm light
  const starTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.12, 'rgba(255,250,235,.7)');
    rg.addColorStop(0.4, 'rgba(255,240,210,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[128, 5], [5, 128]]) {
      const lg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      lg.addColorStop(0, 'rgba(255,255,255,1)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(64 - w / 2, 64 - h / 2, w, h);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: new THREE.Color(3, 2.9, 2.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  star.scale.setScalar(0.01);
  lab.add(star);

  // ---- the iris (in the HUD layer) ----
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  lab.overlay.append(iris);

  // ---- the camera: leans in while time is stopped (and keeps the game's framing offset) ----
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const S = { cam: 0, iris: 0, fan: 0, fanFront: 0, rain: 0, prism: 0, eye: 0, fold: 0, glint: 0, ex: 3.36 };
  const releaseCam = lab.camera((home) => {
    const kk = Math.min(0.99, Math.min(arena.dt, 0.1) * 4);
    if (arena.camCur) {
      arena.camCur.sx = (off0.sx * (1 - S.cam)) / (1 - kk);
      arena.camCur.sy = (off0.sy * (1 - S.cam)) / (1 - kk);
    }
    const aim = P(3.4, 2).setY(0.1);
    return { target: home.target.clone().lerp(aim, S.cam), dist: home.dist * (1 - 0.34 * S.cam), el: home.el - 0.1 * S.cam };
  });

  // ---- draw the light every frame from the state S ----
  const prismMat = theo.model.paint;
  const white = new THREE.Color(1, 0.97, 0.9);
  const blue = new THREE.Color(theo.bot.color);
  const stopDraw = lab.every(() => {
    // the fan: from the prism's far face to the far side of space 4; its width grows with its length
    const end = 4 + R + 0.02;
    const L = Math.max(0.001, end - S.ex);
    const shown = L * S.fanFront;
    fan.position.copy(P(S.ex, 2)).setY(0.012);
    fan.scale.set(Math.max(0.001, shown), 1, Math.max(0.001, (2 * R + 0.04) * (L / 1.18) * S.fanFront));
    fanMat.opacity = S.fan;
    fanTex.repeat.set(1, 1);
    // the rainbow ring at the landing space draws itself around
    if (S.rain > 0) {
      rainGeo.dispose();
      rainGeo = new THREE.RingGeometry(R - 0.03, R + 0.02, 96, 1, Math.PI - S.rain * Math.PI, Math.max(0.001, S.rain * Math.PI * 2));
      rain.geometry = rainGeo;
    }
    rainMat.opacity = Math.min(1, S.rain * 1.4) * (1 - S.fold);
    rain.scale.setScalar(1 - 0.75 * ease.in(S.fold));
    rain.position.copy(P(4, 2)).setY(0.014 + 0.25 * ease.in(S.fold));
    // the iris
    const c = lab.toScreen(P(3.5, 2).setY(0.15));
    const edge = lab.toScreen(P(3.5 + 2.3, 2).setY(0.15));
    const r = Math.hypot(edge.x - c.x, edge.y - c.y) * (1 + 1.6 * (1 - S.iris));
    iris.style.opacity = String(Math.min(1, S.iris * 1.2));
    iris.style.background = `radial-gradient(ellipse ${r}px ${r * 0.72}px at ${c.x}px ${c.y}px, rgba(0,0,0,0) 55%, rgba(2,3,5,0.82) 100%)`;
    // the glint
    // (hooks run before the puppets are posed this frame, so place it from the pose, not the group)
    const ridge = P(theo.pose.x, theo.pose.y).setY(0.42 + theo.pose.lift);
    star.position.copy(ridge);
    star.material.opacity = S.glint;
    star.scale.setScalar(0.25 + 1.3 * S.glint);
    // Maya's card would be cropped by the lean-in: it steps back while the camera is close
    const card = lab.bot('a').card;
    if (card) {
      card.material.transparent = true;
      card.material.opacity = Math.max(0, 1 - 1.6 * S.cam);
    }
  });
  theo.each = (m) => {
    m.paint.emissive.copy(blue).lerp(white, Math.min(1, S.prism));
    m.paint.emissiveIntensity = 0.16 + 1.6 * S.prism + 2.4 * S.glint;
    m.eyeMat.color.setRGB(3.2 + 6 * S.glint, 3.1 + 6 * S.glint, 2.9 + 5 * S.glint);
  };
  maya.each = (m) => {
    const k = 1 + 2.5 * S.eye;
    m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
  };
  // a real-time tween (it keeps running while the scene clock is stopped)
  const rt = (dur, fn, easing = ease.inOut) =>
    new Promise((ok) => {
      const t0 = lab.real;
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(easing(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
      fn(easing(0), 0);
    });

  lab.playCard('a', ['m2']);
  // ---- 1. Maya rolls up ----
  await lab.tween(0.3, (e) => maya.set({ x: 1 + 1.22 * e, pitch: 0.1 * e }), ease.in);

  // ---- 2. the kiss: time stops; we watch the light travel ----
  lab.timeScale = 0.015;
  rt(0.22, (e) => (S.cam = e), ease.out3);
  rt(0.3, (e) => (S.iris = e), ease.out);
  await rt(0.1, (e) => (S.eye = e), ease.out);
  rt(0.3, (e, k) => (S.eye = 1 - k * 0.7), ease.linear);
  await rt(0.12, (e) => (S.prism = e), ease.in);
  S.fan = 1;
  await rt(0.27, (e) => ((S.fanFront = e), (S.prism = 1 - 0.55 * e)), ease.out);
  await rt(0.18, (e) => (S.rain = e), ease.inOut);
  await lab.waitReal(0.07);

  // ---- 3. time snaps back: Theo slides along his spectrum; the camera floats home ----
  lab.timeScale = 1;
  const t1 = lab.real;
  const camHome = rt(0.95, (e) => ((S.cam = 1 - e), (S.iris = Math.max(0, 1 - e * 1.4))), ease.inOut);
  await lab.tween(
    0.42,
    (e, k) => {
      maya.set({ x: 2.22 + 0.78 * e, pitch: 0.1 * (1 - k) });
      theo.set({ x: 3 + e, sx: 1 + 0.06 * Math.sin(k * Math.PI), sy: 1 - 0.05 * Math.sin(k * Math.PI) });
      S.ex = 3.36 + e;
      S.prism = 0.45 * (1 - k);
      S.fan = 1 - 0.4 * k;
    },
    ease.inOut,
  );
  // ---- 4. the colours fold back into his ridge: one glint ----
  S.fan = 0;
  S.eye = 0;
  await rt(0.1, (e) => ((S.fold = e), (S.glint = e)), ease.in);
  await rt(0.3, (e) => (S.glint = 1 - e), ease.out);
  S.rain = 0;
  rainMat.opacity = 0;
  await camHome;
  void t1;
  releaseCam();
  stopDraw();
  if (lab.bot('a').card) lab.bot('a').card.material.opacity = 1;
  iris.remove();
  theo.each = null;
  maya.each = null;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
