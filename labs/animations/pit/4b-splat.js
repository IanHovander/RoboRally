// Onto the lens, played as character acting. Maya cruises along, swaying happily, and tips nose-first over
// the rim. Cut: we are under the board, looking up at a ceiling of soft light (Theo's blue glow and her own
// red trail shine through it) with the pit as a black square. Maya drops out of the square straight at us,
// squeezing her eye shut, then pops it wide open when she sees the camera. SPLAT: she hits the lens, presses
// flat across the screen as a Pebble-shaped smudge of red light, wobbles, and slowly slides down the glass
// like a cartoon on a window, fading to dark. Cut back: the calm board, the hole empty. A faint ghost of the
// smudge is still on the TV for a moment, and Theo is caught peering at it; he snaps back north.
export const meta = {
  title: 'Splat',
  idea: 'Maya sways along, oblivious, and tips nose-first over the rim. Cut to a view from under the board: a ceiling of soft light with the pit a black square in it, and Maya drops out of it straight at us, eye squeezed shut, then wide open as she sees the camera. She hits the lens, squashes flat across the screen as a Pebble-shaped smudge of red light, wobbles, and slowly slides down the glass, fading to dark. Cut back to the calm board as if nothing happened, except a faint ghost of her on the TV glass, and Theo caught peering at it before he snaps back north.',
  notes: 'Sound: a happy glass hum as she sways; on the cut, the room tone drops out; a rising whoosh with a tiny squeak as her eye pops open; a soft wet glass "thup" on the lens and a long rubbery squeak as she slides down it; silence on the cut back. Port: the under-view hides the board and draws its own lit ceiling (with the trail and the other robots\' glow pools shining through); the smudge is a canvas in the HUD layer. Keep the cut short: about 1.3 s from tipping to back.',
};

export default async function play(lab) {
  const { ease, facing, THREE } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  lab.playCard('a', ['m3']);
  const b = maya.bot;
  const RED = new THREE.Color(b.color);

  const lerp = (a, c, k) => a + (c - a) * k;
  const clamp = (k) => Math.max(0, Math.min(1, k));
  const key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (fn ?? ease.inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
    return keys[keys.length - 1][1];
  };
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

  // ---------- timing ----------
  const T = {
    rim: 0.78, // her nose reaches the rim
    cut: 1.0, // cut to under the board
    take: 1.24, // she sees us
    splat: 1.5,
    slide: 1.78, // starts sliding down the glass
    dark: 2.02, // fading to dark
    back: 2.36, // cut back to the board
    end: 2.75,
  };

  // ---------- the board part ----------
  const mayaX = [[0, 1], [0.3, 2, ease.in], [T.rim - 0.08, 3.5, ease.linear], [T.cut, 3.98, ease.out]];
  const tip = [[T.rim - 0.06, 0], [T.cut, 1.15, ease.in]];
  const tipLift = [[T.rim, 0], [T.cut, -0.28, ease.in]];

  // ---------- the view from under the board ----------
  const W = arena.course.w;
  const H = arena.course.h;
  const S = 96;
  const ceilTex = (() => {
    const c = canvas(W * S, H * S);
    const g = c.getContext('2d');
    // the plane faces down: canvas rows run south to north (row 0 of the canvas is the board's last row)
    const X = (x) => x * S;
    const Y = (y) => (H - y) * S;
    const grad = g.createRadialGradient(X(4.5), Y(1.5), 0, X(4.5), Y(1.5), S * 5);
    grad.addColorStop(0, '#5a6578');
    grad.addColorStop(0.5, '#3a4354');
    grad.addColorStop(1, '#232a36');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(230,236,248,.22)';
    g.lineWidth = 2;
    for (let x = 0; x <= W; x++) {
      g.beginPath();
      g.moveTo(X(x), 0);
      g.lineTo(X(x), c.height);
      g.stroke();
    }
    for (let y = 0; y <= H; y++) {
      g.beginPath();
      g.moveTo(0, Y(y));
      g.lineTo(c.width, Y(y));
      g.stroke();
    }
    // light that shines through from above: Theo's glow pool, and her own trail
    const blob = (x, y, r, col) => {
      const gr = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * S);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(X(x) - r * S, Y(y) - r * S, 2 * r * S, 2 * r * S);
    };
    blob(5.5, 3.5, 0.75, 'rgba(90,170,255,.85)');
    const tr = g.createLinearGradient(X(1.5), 0, X(4), 0);
    tr.addColorStop(0, 'rgba(255,77,109,0)');
    tr.addColorStop(1, 'rgba(255,90,120,.95)');
    g.strokeStyle = tr;
    g.lineWidth = S * 0.22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(1.5), Y(1.5));
    g.lineTo(X(4), Y(1.5));
    g.stroke();
    // the pit: where the light is missing
    g.fillStyle = '#000';
    g.fillRect(X(4), Y(2), S, S);
    g.strokeStyle = 'rgba(255,250,240,.6)';
    g.lineWidth = 3;
    g.strokeRect(X(4), Y(2), S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ceiling = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: ceilTex, color: new THREE.Color(1.35, 1.35, 1.35) })));
  ceiling.rotation.x = Math.PI / 2; // faces down
  ceiling.position.y = 0;
  ceiling.visible = false;
  const fill = lab.add(new THREE.PointLight(0xfff1e0, 0, 6, 1.5));
  const hidden = [arena.board, arena.fxGroup, arena.spill, ...lab.scene.children.filter((o) => o.isMesh && o.geometry?.parameters?.width === 400)];
  const shown = hidden.map((o) => o.visible);
  const restore = () => hidden.forEach((o, i) => (o.visible = shown[i]));
  lab.cleanup(restore);

  const HOLE = lab.pos(4, 1).setY(-0.05);
  const UNDER = { el: -1.32, dist: 2.5, fov: 56 };
  const camPos = HOLE.clone().add(new THREE.Vector3(0, Math.sin(UNDER.el) * UNDER.dist, Math.cos(UNDER.el) * UNDER.dist));
  const fallK = (t) => clamp((t - T.cut) / (T.splat - T.cut));
  const START = HOLE.clone().setY(0.42); // she starts inside the hole, above the ceiling
  const fallS = (k) => 0.93 * k ** 2.2; // accelerating straight at us
  const eyeOpen = [[T.cut, 0.25], [T.take - 0.02, 0.2], [T.take + 0.04, 3.4, ease.outBack], [T.splat, 3]];

  // ---------- the smudge on the lens (the HUD layer) ----------
  const ov = lab.overlay;
  const OW = ov.clientWidth || 960;
  const OH = ov.clientHeight || 540;
  const smudgeCanvas = (() => {
    const c = canvas(512, 512);
    const g = c.getContext('2d');
    const k = 760;
    const P = (x, y) => [256 + x * k, 270 - y * k];
    const path = () => {
      g.beginPath();
      g.moveTo(...P(0, 0.29));
      g.bezierCurveTo(...P(0.11, 0.29), ...P(0.31, -0.12), ...P(0.29, -0.22));
      g.bezierCurveTo(...P(0.27, -0.31), ...P(0.13, -0.33), ...P(0, -0.29));
      g.bezierCurveTo(...P(-0.13, -0.33), ...P(-0.27, -0.31), ...P(-0.29, -0.22));
      g.bezierCurveTo(...P(-0.31, -0.12), ...P(-0.11, 0.29), ...P(0, 0.29));
      g.closePath();
    };
    g.save();
    g.shadowColor = 'rgba(255,50,90,1)';
    g.shadowBlur = 60;
    const grad = g.createRadialGradient(256, 300, 10, 256, 280, 250);
    grad.addColorStop(0, 'rgba(255,95,125,.62)');
    grad.addColorStop(0.6, 'rgba(240,45,85,.4)');
    grad.addColorStop(1, 'rgba(190,25,60,.34)');
    g.fillStyle = grad;
    path();
    g.fill();
    g.restore();
    // where she pressed hardest: a brighter contact patch
    g.save();
    g.translate(256, 300);
    g.scale(0.72, 0.68);
    g.translate(-256, -300);
    const core = g.createRadialGradient(256, 300, 0, 256, 300, 200);
    core.addColorStop(0, 'rgba(255,200,210,.6)');
    core.addColorStop(1, 'rgba(255,120,145,.15)');
    g.fillStyle = core;
    g.shadowColor = 'rgba(255,140,165,.8)';
    g.shadowBlur = 30;
    path();
    g.fill();
    g.restore();
    // her ring pressed into the glass
    g.strokeStyle = 'rgba(255,190,200,.95)';
    g.lineWidth = 7;
    g.shadowColor = 'rgba(255,120,150,1)';
    g.shadowBlur = 18;
    path();
    g.stroke();
    // her eye light, smeared flat
    g.shadowColor = 'rgba(255,250,235,1)';
    g.shadowBlur = 24;
    g.fillStyle = 'rgba(255,252,242,1)';
    g.beginPath();
    g.roundRect(256 - 82, 270 - 0.13 * k - 12, 164, 24, 12);
    g.fill();
    // ...and smeared sideways across the glass
    const sm = g.createLinearGradient(256 - 200, 0, 256 + 200, 0);
    sm.addColorStop(0, 'rgba(255,250,240,0)');
    sm.addColorStop(0.5, 'rgba(255,250,240,.55)');
    sm.addColorStop(1, 'rgba(255,250,240,0)');
    g.fillStyle = sm;
    g.shadowBlur = 0;
    g.fillRect(256 - 200, 270 - 0.13 * k - 5, 400, 10);
    return c;
  })();
  const mk = (css) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;pointer-events:none;${css}`;
    ov.append(el);
    return el;
  };
  const SZ = OH * 0.8;
  const dim = mk(`left:0;top:0;width:${OW}px;height:${OH}px;opacity:0;background:#000`); // her light covers the lens
  const smudge = mk(`left:${OW / 2 - SZ / 2}px;top:${OH / 2 - SZ / 2}px;width:${SZ}px;height:${SZ}px;opacity:0;mix-blend-mode:screen`);
  const img = smudgeCanvas;
  img.style.cssText = 'width:100%;height:100%;display:block';
  smudge.append(img);
  const streak = mk(`left:${OW / 2 - SZ * 0.32}px;width:${SZ * 0.64}px;top:0;height:0;opacity:0;mix-blend-mode:screen;background:linear-gradient(rgba(255,77,109,0),rgba(255,90,120,.4));filter:blur(8px);border-radius:30%`);
  const flash = mk(`left:0;top:0;width:${OW}px;height:${OH}px;opacity:0;background:radial-gradient(circle at 50% 52%, rgba(255,240,240,.9), rgba(255,120,140,.25) 30%, rgba(0,0,0,0) 60%)`);
  const vignette = mk(`left:0;top:0;width:${OW}px;height:${OH}px;opacity:0;background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75) 100%)`);
  const black = mk(`left:0;top:0;width:${OW}px;height:${OH}px;opacity:0;background:#000`);
  const ghost = mk(`left:${OW / 2 - SZ * 0.35}px;top:${OH / 2 - SZ * 0.35 + OH * 0.4}px;width:${SZ * 0.7}px;height:${SZ * 0.7}px;opacity:0;mix-blend-mode:screen;filter:blur(4px)`);
  const ghostImg = canvas(512, 512);
  ghostImg.getContext('2d').drawImage(smudgeCanvas, 0, 0);
  ghostImg.style.cssText = 'width:100%;height:100%;display:block';
  ghost.append(ghostImg);

  // ---------- Theo, caught peering at the TV ----------
  const theoRot = [[T.back, -2.55], [T.back + 0.26, 0, ease.inOut3]];
  const theoPitch = [[T.back, 0.22], [T.back + 0.2, 0, ease.out]];

  // ---------- run ----------
  const t0 = lab.t;
  let now = 0;
  let mode = 'board';
  let savedCam = null;
  let camRelease = null;
  const eyeBase = new THREE.Color(3.2, 3.1, 2.9);
  const eyeMesh = maya.model.body.children.find((o) => o.material === maya.model.eyeMat);

  const stop = lab.every((dt, t) => {
    now = t - t0;
    vignette.style.opacity = mode === 'under' ? '1' : '0';
    if (mode === 'board' && now >= T.cut) {
      // hard cut: under the board
      mode = 'under';
      savedCam = arena.camCur ? { ...arena.camCur, tgt: arena.camCur.tgt.clone() } : null;
      arena.camCur = savedCam ? { ...savedCam, tgt: savedCam.tgt.clone(), sx: 0, sy: 0 } : null;
      hidden.forEach((o) => (o.visible = false));
      ceiling.visible = true;
      camRelease = lab.camera(() => ({ target: HOLE.clone(), az: 0, el: UNDER.el, dist: UNDER.dist, fov: UNDER.fov }));
    }
    if (mode === 'under' && now >= T.back) {
      // hard cut back: the calm board, exactly as the game frames it
      mode = 'back';
      restore();
      ceiling.visible = false;
      camRelease();
      arena.camCur = savedCam;
      lab.camera3.fov = 30;
      lab.camera3.updateProjectionMatrix();
      b.trail.length = 0;
    }

    if (mode === 'board') {
      // cruising along, swaying happily, oblivious
      const happy = clamp((T.rim - 0.08 - now) / 0.15);
      const sway = Math.sin(now * 12) * 0.12 * happy;
      maya.set({ x: key(now, mayaX), pitch: key(now, tip), lift: key(now, tipLift) + Math.abs(Math.sin(now * 12)) * 0.03 * happy, roll: sway, rot: facing(1) + sway * 0.5 });
    } else if (mode === 'under') {
      const k = fallK(now);
      const p = START.clone().lerp(camPos, fallS(k));
      const wob = Math.sin(now * 17) * 0.12 * (1 - k);
      // nose first, belly and eye toward the lens; keep the middle of her body on the line to the lens
      const pitch = Math.PI / 2 + 0.55 + wob;
      const off = new THREE.Vector3(0, 0.22, 0).applyEuler(new THREE.Euler(-pitch, facing(2), -wob * 0.6, 'YXZ'));
      p.sub(off);
      maya.set({ x: p.x + W / 2 - 0.5, y: p.z + H / 2 - 0.5, lift: p.y, rot: facing(2), pitch, roll: wob * 0.6, trail: false, visible: now < T.splat });
      fill.intensity = 2.5;
      fill.position.copy(camPos).lerp(p, 0.4);
    } else {
      fill.intensity = 0;
    }
    theo.set({ visible: mode !== 'under' });
    if (mode === 'back') theo.set({ rot: key(now, theoRot) });

    // the smudge
    const s = now - T.splat;
    if (s >= 0 && mode === 'under') {
      const hit = ease.outBack(clamp(s / 0.09), 2.2);
      const wob = Math.sin(s * 38) * 0.07 * Math.exp(-s * 9);
      const slide = ease.in(clamp((now - T.slide) / (T.back - T.slide)));
      const sc = 0.92 + 0.22 * hit; // starts as big as she was, then spreads
      smudge.style.opacity = String(1 - 0.35 * slide);
      // pressed flat: wider than she is tall, then dragged down the glass
      smudge.style.transform = `translateY(${slide * OH * 0.38}px) scale(${sc * 1.22 * (1 + wob)}, ${sc * 0.9 * (1 - wob) * (1 + 0.14 * slide)})`;
      streak.style.opacity = String(clamp(slide * 3) * (1 - clamp((now - T.dark) / 0.3)));
      streak.style.top = `${OH / 2 - SZ * 0.36}px`;
      streak.style.height = `${slide * OH * 0.38 + 10}px`;
      flash.style.opacity = String(clamp(1 - s / 0.18) * 0.9);
      dim.style.opacity = String(0.45 * clamp(s / 0.08));
      black.style.opacity = String(ease.in(clamp((now - T.dark) / (T.back - T.dark - 0.04))));
    } else if (mode === 'back') {
      smudge.style.opacity = '0';
      streak.style.opacity = '0';
      flash.style.opacity = '0';
      black.style.opacity = '0';
      dim.style.opacity = '0';
      ghost.style.opacity = String(0.2 * (1 - clamp((now - T.back) / 0.34)));
      vignette.style.opacity = '0';
    }
  });

  maya.each = (m) => {
    if (b.card) b.card.visible = mode === 'board';
    if (mode === 'under') {
      m.paint.emissiveIntensity = 0.85;
      m.eyeMat.color.copy(eyeBase).multiplyScalar(now > T.take ? 2.4 : 1.2);
      if (eyeMesh) eyeMesh.scale.set(key(now, eyeOpen), 1.15, 1);
      m.ringMat.opacity = 0.5;
      m.poolMat.opacity = 0;
    } else if (mode === 'board') {
      const k = clamp((now - T.rim + 0.05) / 0.15);
      if (eyeMesh) eyeMesh.scale.set(1 + 1.2 * k, 1, 1);
      m.eyeMat.color.copy(eyeBase).multiplyScalar(1 + 0.8 * k);
    }
  };
  theo.each = (m) => {
    if (mode === 'back') m.body.rotation.x = -key(now, theoPitch);
  };
  lab.cleanup(() => {
    if (eyeMesh) eyeMesh.scale.set(1, 1, 1);
    ceilTex.dispose();
  });

  await lab.wait(T.end);
  stop();
  ghost.remove();
  smudge.remove();
  streak.remove();
  flash.remove();
  black.remove();
  dim.remove();
  vignette.remove();
  if (eyeMesh) eyeMesh.scale.set(1, 1, 1);
  maya.each = null;
  theo.each = null;
  maya.release({ on: false });
  theo.release({ x: 5, y: 3, d: 0 });
}
