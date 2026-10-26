// Belt, idea 2 (Shape Sorter), animator c: cinematic staging.
export const meta = {
  title: 'Shape Sorter (the diagram view)',
  idea:
    'As the belts start, a thin line of Maya\'s red draws itself into the corner tile, both ways round from the notch, and the darkness inside opens into a slot: her own Pebble silhouette, already pointing east. The room\'s light dips and the camera rises toward a top-down view, so the board reads like a puzzle diagram: there is the shape, here she comes. The last few degrees of her turn play in slow motion ("will it fit?"), then time snaps back for the drop, and her light fills the gap from the rim inward like water finding its level. The room\'s light comes back up with it and the camera settles home.',
  notes:
    'Sound: a thin glass "sss" as the rim draws, a held breath of silence in the slow motion, a soft wooden-glass "tock" for the fit, then a rising, filling shimmer. The camera tilt is small (about 10 degrees) so it can play often. Every form gets its own slot (a square for the Cube, a needle for the Spire); for the Pebble the notch is its pointed nose.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;

  const maya = lab.puppet('a');
  const red = new THREE.Color(lab.bot('a').color ?? '#ff4d6d');
  const express = arena.belts.filter((b) => b.fast);
  const speed0 = express.map((b) => b.speed);
  const top0 = arena.topMat.emissiveIntensity;
  lab.cleanup(() => express.forEach((b, i) => (b.speed = speed0[i])));

  // ---- the slot: her own silhouette (bots3d's Pebble outline, a little bigger than her footprint) ----
  const S = 1.7;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.29 * S);
  shape.bezierCurveTo(0.11 * S, 0.29 * S, 0.31 * S, -0.12 * S, 0.29 * S, -0.22 * S);
  shape.bezierCurveTo(0.27 * S, -0.31 * S, 0.13 * S, -0.33 * S, 0, -0.29 * S);
  shape.bezierCurveTo(-0.13 * S, -0.33 * S, -0.27 * S, -0.31 * S, -0.29 * S, -0.22 * S);
  shape.bezierCurveTo(-0.31 * S, -0.12 * S, -0.11 * S, 0.29 * S, 0, 0.29 * S);
  const outline = shape.getSpacedPoints(240);
  const SPAN = 1.2; // world units the canvases cover
  const PX = 512;
  const toPx = (v, k = 1) => [(v.x * k) / SPAN * PX + PX / 2, PX / 2 - (v.y * k) / SPAN * PX];
  const pathOf = (g, k, from = 0, to = outline.length - 1) => {
    g.beginPath();
    for (let i = from; i <= to; i++) {
      const [x, y] = toPx(outline[i], k);
      if (i === from) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  };
  const layer = (blending, color, order) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = PX;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = order;
    return { cv, g: cv.getContext('2d'), tex, mat, mesh };
  };
  const slot = new THREE.Group();
  slot.position.copy(lab.pos(3, 1)).setY(0.012);
  slot.rotation.y = facing(1);
  lab.add(slot);

  // the darkness inside: a hole where the light is missing, a little lighter at the walls
  const dark = layer(THREE.NormalBlending, new THREE.Color(1, 1, 1), 1.5);
  {
    const { g } = dark;
    pathOf(g, 1);
    g.fillStyle = 'rgb(26,30,38)';
    g.fill();
    g.save();
    g.shadowColor = '#000';
    g.shadowBlur = 28;
    pathOf(g, 0.84);
    g.fillStyle = '#000';
    g.fill();
    g.restore();
    dark.tex.needsUpdate = true;
  }
  slot.add(dark.mesh);
  // the rim: a thin line of her colour that draws itself
  const rim = layer(THREE.AdditiveBlending, red.clone().multiplyScalar(2.6), 1.6);
  rim.mesh.position.y = 0.002;
  slot.add(rim.mesh);
  const drawRim = (k, white) => {
    const { g } = rim;
    g.clearRect(0, 0, PX, PX);
    if (k <= 0) return (rim.tex.needsUpdate = true);
    const n = outline.length - 1;
    const half = Math.round((n / 2) * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = white > 0 ? `rgb(255,${Math.round(255 - 60 * (1 - white))},${Math.round(255 - 90 * (1 - white))})` : '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 10;
    g.lineWidth = 5;
    // both ways round from the notch at the nose
    pathOf(g, 1, 0, half);
    g.stroke();
    pathOf(g, 1, n - half, n);
    g.stroke();
    rim.tex.needsUpdate = true;
  };
  // the fill: her light rising from the rim inward
  const fill = layer(THREE.AdditiveBlending, red.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(1.7), 1.7);
  fill.mesh.position.y = 0.003;
  slot.add(fill.mesh);
  const drawFill = (f) => {
    const { g } = fill;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, PX, PX);
    if (f <= 0) return (fill.tex.needsUpdate = true);
    pathOf(g, 1);
    g.fillStyle = '#fff';
    g.fill();
    if (f < 1) {
      g.globalCompositeOperation = 'destination-out';
      g.shadowColor = '#000';
      g.shadowBlur = 18;
      pathOf(g, Math.max(0.001, 1 - f));
      g.fillStyle = '#000';
      g.fill();
    }
    fill.tex.needsUpdate = true;
  };

  // ---- camera ----
  const cam = { dx: 0, dz: 0, dk: 1, del: 0 };
  let frameOff = null;
  const releaseCam = lab.camera((home) => {
    const cc = arena.camCur;
    if (cc) {
      frameOff ??= { sx: cc.sx ?? 0, sy: cc.sy ?? 0 };
      const k = Math.min(0.95, arena.dt * 4);
      cc.sx = frameOff.sx / (1 - k);
      cc.sy = frameOff.sy / (1 - k);
    }
    return { target: home.target.clone().add(new THREE.Vector3(cam.dx, 0, cam.dz)), el: home.el + cam.del, dist: home.dist * cam.dk };
  });
  const corner = lab.pos(3, 1);

  // ---- timeline (scene seconds; the slow motion stretches 0.86..1.02) ----
  const EXP = [0.1, 0.42]; // express step
  const ALL = [0.46, 0.86]; // all-belts step, most of the turn
  const ALIGN = [0.86, 1.02]; // the last few degrees, in slow motion
  const DROP = [1.02, 1.1];
  const FILL = [1.12, 1.52];
  const GONE = [1.5, 1.78];
  const END = 1.92;

  const t0 = lab.t;
  let squash = 0;
  const stop = lab.every(() => {
    const t = lab.t - t0;

    // slow motion for the fit (eased in and out, by scene time)
    lab.timeScale = 1 - 0.72 * seg(t, ALIGN[0] - 0.05, ALIGN[0] + 0.01) * (1 - seg(t, ALIGN[1] - 0.02, ALIGN[1] + 0.02));

    // the belts: a soft glow as they start
    const glow = Math.max(0, 1 - t / 0.6) * 0.6;
    express.forEach((b, i) => {
      b.speed = speed0[i] * (1 + glow);
      b.mat.color.multiplyScalar(1 + glow * 0.6);
    });

    // ---- the slot appears ----
    drawRim(ease.inOut(seg(t, 0, 0.4)), 0);
    rim.mat.opacity = 1;
    dark.mat.opacity = 0.93 * ease.out(seg(t, 0.12, 0.45));
    dark.mesh.scale.setScalar(mix(0.7, 1, ease.outBack(seg(t, 0.12, 0.45))));

    // ---- Maya ----
    let x = 1;
    let rot = facing(0);
    let lift = 0;
    if (t < ALL[0]) {
      x = 1 + ease.inOut(seg(t, EXP[0], EXP[1]));
    } else {
      x = 2 + ease.inOut(seg(t, ALL[0], ALL[1]));
      // the corner turns her most of the way during the ride...
      const a = ease.inOut(seg(t, ALL[0] + 0.08, ALL[1])) * 0.8;
      // ...and the last few degrees line up with the notch in slow motion
      const b = ease.inOut(seg(t, ALIGN[0], ALIGN[1] - 0.02)) * 0.2;
      rot = facing(0) + (facing(1) - facing(0)) * (a + b);
      lift = 0.05 * ease.out(seg(t, ALL[1] - 0.2, ALL[1])) * (1 - seg(t, DROP[0], DROP[1]) ** 2);
      // the drop: a hair into the slot
      lift -= 0.022 * ease.in(seg(t, DROP[0], DROP[1])) * (1 - ease.inOut(seg(t, GONE[0], END - 0.1)));
    }
    squash = Math.sin(seg(t, DROP[1] - 0.01, DROP[1] + 0.22) * Math.PI) * (1 - seg(t, DROP[1], DROP[1] + 0.3));
    maya.set({ x, y: 1, rot, lift, sy: 1 - 0.07 * squash, sx: 1 + 0.035 * squash, sz: 1 + 0.035 * squash });

    // ---- the click and the fill ----
    const click = t >= DROP[1] ? Math.max(0, 1 - (t - DROP[1]) / 0.3) : 0;
    if (t >= DROP[1]) drawRim(1, click);
    rim.mat.color.copy(red).multiplyScalar(2.6 + 3 * click);
    const f = ease.out(seg(t, FILL[0], FILL[1]));
    drawFill(f);
    const gone = ease.inOut(seg(t, GONE[0], GONE[1]));
    fill.mat.opacity = Math.min(1, f * 3) * (1 - gone) * 0.95;
    rim.mat.opacity = 1 - ease.inOut(seg(t, FILL[0] + 0.15, GONE[1]));
    dark.mat.opacity *= 1 - ease.inOut(seg(t, FILL[0], FILL[1]));

    // ---- the room: the light dips while the shape is shown, and comes back with the fill ----
    const dip = ease.inOut(seg(t, 0.05, 0.5)) * (1 - ease.inOut(seg(t, FILL[0], GONE[1])));
    arena.topMat.emissiveIntensity = top0 * (1 - 0.35 * dip) + 0.25 * fill.mat.opacity * (1 - gone);

    // ---- camera: up toward the diagram view, a slow creep in during the fit, then home ----
    const up = ease.inOut(seg(t, 0.0, 0.75));
    const creep = ease.inOut(seg(t, 0.6, DROP[1]));
    const home = ease.inOut(seg(t, FILL[0] + 0.05, END - 0.02));
    const k = Math.min(up, 1 - home);
    cam.del = 0.17 * k;
    cam.dk = 1 - (0.06 * up + 0.07 * creep) * (1 - home);
    cam.dx = corner.x * (0.25 * up + 0.2 * creep) * (1 - home);
    cam.dz = corner.z * (0.25 * up + 0.2 * creep) * (1 - home);
  });

  maya.each = (model) => {
    // she glows a little as her light pours into the slot
    model.poolMat.opacity = Math.min(1, model.poolMat.opacity * (1 + 0.8 * fill.mat.opacity));
  };

  await lab.wait(END);
  stop();
  lab.timeScale = 1;
  maya.each = null;
  arena.topMat.emissiveIntensity = top0;
  express.forEach((b, i) => (b.speed = speed0[i]));
  releaseCam();
  maya.set({ x: 3, y: 1, rot: facing(1), lift: 0, sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 3, y: 1, d: 1 });
}
