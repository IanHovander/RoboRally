// Make a wish, staged like the birthday-cake moment: as Maya settles, the room's lights go down and the flag's
// column of light sinks into a single candle flame flickering just in front of her; the camera leans in close and
// low, the flame lighting her warmly. She leans back, puffs a breath of light, the flame bends away and goes out:
// for a beat the whole room is dark, just a thin curl of smoke drawn in light rising where the flag was. Then,
// like someone finding the switch, the column re-ignites from the glass, the lights come up and the camera pulls
// back with her red ring at the column's foot.
export const meta = {
  title: 'Make a wish, lights out',
  idea:
    "As Maya settles, the room's lights go down like at a birthday party and the flag's column of light sinks into one candle flame flickering in front of her, lighting her warmly while the camera leans in. She leans back and puffs a breath of light; the flame bends and goes out, and for a beat the whole room is dark but for a curl of light-smoke rising. Then the column relights from the glass, the lights snap up and the camera pulls back on her red ring.",
  notes:
    'Sound: the room tone drops with the lights; a soft crackle for the flame; an inhale (a rising airy glass tone) and a "foo" puff; the hush of the dark (true silence, 0.4 s); then a warm glass bloom as the column relights, maybe with the room\'s cheer. Port: needs a temporary key/hemi light dip (restored after) and the column\'s own mesh moved and scaled; the flame is a bent plane with a canvas teardrop; the candlelight is one warm point light. The win can pay this off later (the trick candle that relights itself).',
};

export default async function play(lab) {
  const { THREE, ease, arena } = lab;
  const rec = lab.bot('a');
  const RED = rec.color;
  const P = lab.pos(4, 1);
  const col = arena.columns.find((c) => c.n === 1);
  const other = arena.columns.filter((c) => c !== col);
  const WARM = new THREE.Color(lab.PALETTE.energy);

  // ---------- shared lights we dim (restored after) ----------
  const keyI = arena.key.intensity;
  const hemiI = arena.hemi.intensity;
  lab.cleanup(() => {
    arena.key.intensity = keyI;
    arena.hemi.intensity = hemiI;
    col.col.position.y = 0;
    col.col.position.x = P.x;
    col.halo.visible = true;
  });

  // ---------- textures: a soft dot and a candle flame ----------
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const dot = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
  const flameTex = canvasTex(128, 256, (g, w, h) => {
    // a teardrop: white core low down, warm edges, soft halo
    g.filter = 'blur(6px)';
    const path = () => {
      g.beginPath();
      g.moveTo(w / 2, 18);
      g.bezierCurveTo(w * 0.62, 90, w * 0.86, 150, w * 0.78, 196);
      g.bezierCurveTo(w * 0.7, 244, w * 0.3, 244, w * 0.22, 196);
      g.bezierCurveTo(w * 0.14, 150, w * 0.38, 90, w / 2, 18);
      g.closePath();
    };
    path();
    const gr = g.createRadialGradient(w / 2, 190, 4, w / 2, 170, 150);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,236,200,1)');
    gr.addColorStop(0.7, 'rgba(255,190,110,.85)');
    gr.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = gr;
    g.fill();
    g.filter = 'none';
  });
  lab.cleanup(() => {
    dot.dispose();
    flameTex.dispose();
  });

  // ---------- the flame: a plane facing the camera, bent at the top by the breath ----------
  const FW = 0.3;
  const FH = 0.58;
  const fGeo = new THREE.PlaneGeometry(FW, FH, 1, 10).translate(0, FH / 2, 0);
  const fBase = Float32Array.from(fGeo.attributes.position.array);
  const flame = lab.add(new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color(1, 1, 1).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  flame.renderOrder = 9;
  const halo = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: WARM.clone().multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.setScalar(1.1);
  const candle = new THREE.PointLight(WARM, 0, 3.2, 1.6);
  lab.add(candle);
  const pool = lab.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dot, color: WARM.clone().multiplyScalar(0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  const F = new THREE.Vector3(P.x + 0.6, 0.5, P.z + 0.04); // the wick: in front of her face, a little up
  pool.position.set(F.x, 0.012, F.z);
  const flameS = { on: 0, bend: 0, stretch: 1, flick: 1 };

  // ---------- the smoke: a thin curl of light rising from the wick ----------
  const SN = 36;
  const sPos = new Float32Array((SN + 1) * 2 * 3);
  const sCol = new Float32Array((SN + 1) * 2 * 3);
  const sIdx = [];
  for (let i = 0; i < SN; i++) sIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  sGeo.setIndex(sIdx);
  const smoke = lab.add(new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  smoke.frustumCulled = false;
  smoke.visible = false;
  let smokeT0 = 0;
  const pos3 = (arr, i, ax, ay, az, bx, by, bz) => arr.set([ax, ay, az, bx, by, bz], i * 6);

  // ---------- the breath: a few motes of light from her front to the flame ----------
  const motes = Array.from({ length: 16 }, () => {
    const s = lab.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color('#fff6ec').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(0.09);
    return { s, d: lab.rand() * 0.12, spread: lab.range(-0.12, 0.12), up: lab.range(-0.05, 0.1) };
  });
  let breathT0 = -1;

  // ---------- the room ----------
  let dark = 0; // 0 lit .. 1 lights out
  let colMode = 'game'; // 'game' | 'condense' | 'out' | 'relight'
  let condense = 0;
  let relight = 0;
  let labelFade = 1;
  const camQ = new THREE.Quaternion();
  const camR = new THREE.Vector3();
  const stop = lab.every((dt, t) => {
    // lights in the room
    arena.key.intensity = keyI * (1 - 0.9 * dark);
    arena.hemi.intensity = hemiI * (1 - 0.88 * dark);
    if (arena.topMat) arena.topMat.emissiveIntensity *= 1 - 0.85 * dark;
    for (const c of other) c.mat.color.multiplyScalar(1 - 0.8 * dark);
    if (labelFade < 1) {
      if (rec.card) rec.card.material.opacity *= labelFade;
      for (const b of arena.bots.values()) if (b.tag) b.tag.material.opacity *= labelFade;
    }
    // the column: the game's own, then sinking into the flame, gone, and relighting from the glass
    if (colMode === 'condense') {
      const k = condense;
      col.col.position.set(P.x + (F.x - P.x) * k, F.y * 0.9 * k, P.z);
      col.col.scale.set(1 - 0.75 * k, Math.max(0.02, 1 - 0.9 * k), 1);
      col.mat.color.set(lab.PALETTE.light).lerp(WARM, k).multiplyScalar(0.95 * (1 - k * 0.9));
      col.halo.visible = k < 0.6;
    } else if (colMode === 'out') {
      col.col.scale.set(0, 0, 1);
      col.halo.visible = false;
    } else if (colMode === 'relight') {
      col.col.position.set(P.x, 0, P.z);
      col.col.scale.set(1 + 0.6 * (1 - relight), Math.max(0.01, ease.out3(relight)), 1);
      col.mat.color.set(lab.PALETTE.light).multiplyScalar(0.95 + 2.2 * (1 - relight));
      col.halo.visible = true;
    }
    // the flame: faces the camera, flickers, bends away from the breath
    camQ.copy(lab.camera3.quaternion);
    flame.quaternion.copy(camQ);
    camR.set(1, 0, 0).applyQuaternion(camQ);
    const fl = flameS.flick * (1 + 0.07 * Math.sin(t * 23) + 0.05 * Math.sin(t * 41 + 1));
    const p = flame.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const v = fBase[i + 1] / FH; // 0 at the wick, 1 at the tip
      p[i] = fBase[i] * (1 - 0.25 * flameS.bend * v) + flameS.bend * 0.32 * v * v + Math.sin(t * 17 + v * 3) * 0.012 * v;
      p[i + 1] = fBase[i + 1] * fl * flameS.stretch;
      p[i + 2] = 0;
    }
    flame.geometry.attributes.position.needsUpdate = true;
    flame.position.copy(F);
    flame.material.opacity = flameS.on;
    halo.position.copy(F).add(new THREE.Vector3(0, 0.2, 0));
    halo.material.opacity = 0.75 * flameS.on * fl;
    candle.position.copy(F).add(new THREE.Vector3(-0.05, 0.25, 0.1));
    candle.intensity = 6 * flameS.on * fl;
    pool.material.opacity = 0.9 * flameS.on * fl;
    // the breath
    if (breathT0 >= 0) {
      const mouth = new THREE.Vector3();
      rec.model.muzzle.updateWorldMatrix(true, false);
      mouth.setFromMatrixPosition(rec.model.muzzle.matrixWorld);
      for (const m of motes) {
        const k = (t - breathT0 - m.d) / 0.26;
        if (k < 0 || k > 1) {
          m.s.material.opacity = 0;
          continue;
        }
        const target = F.clone().add(new THREE.Vector3(0.42 + m.up, 0.42 + m.up, m.spread)); // through the flame and on
        m.s.position.copy(mouth).lerp(target, ease.out(k));
        m.s.position.y += Math.sin(k * Math.PI) * 0.08;
        m.s.material.opacity = Math.sin(k * Math.PI) * 0.9;
      }
    }
    // the smoke: a curl that rises and fades
    if (smoke.visible) {
      const age = t - smokeT0;
      const H = 0.25 + 1.1 * Math.min(1, age / 0.7);
      for (let i = 0; i <= SN; i++) {
        const s = i / SN;
        const y = F.y + 0.05 + s * H;
        const sway = (0.05 + 0.16 * s) * Math.sin(s * 7.5 - age * 5) + 0.12 * s * s;
        const cx = F.x + camR.x * sway;
        const cz = F.z + camR.z * sway;
        const w = 0.012 + 0.02 * s;
        pos3(sPos, i, cx - camR.x * w, y, cz - camR.z * w, cx + camR.x * w, y, cz + camR.z * w);
        const fade = Math.max(0, 1 - age / 0.9) * (s < 0.1 ? s / 0.1 : 1) * (1 - s) ** 0.7;
        const k = 1.4 * fade;
        sCol.set([0.85 * k, 0.88 * k, 0.95 * k, 0.85 * k, 0.88 * k, 0.95 * k], i * 6);
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.color.needsUpdate = true;
    }
  });
  lab.cleanup(() => {
    stop();
    fGeo.dispose();
    sGeo.dispose();
  });

  // ---------- camera: close and low for the candle, back for the relight ----------
  let close = 0;
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(new THREE.Vector3(P.x + 0.3, 0.42, P.z), 0.85 * close),
    dist: home.dist * (1 - 0.5 * close),
    el: home.el - 0.36 * close,
    az: -0.12 * close,
  }));

  // 1. the game's move onto the flag
  lab.beat(lab.scenario.beats[0]);
  await lab.wait(0.5);
  arena.focusOn = 'a';
  lab.tween(0.15, (e) => (labelFade = 1 - e));
  lab.tween(0.75, (e) => (close = e), ease.inOut);
  // 2. lights down; the column sinks into a candle flame in front of her
  lab.tween(0.45, (e) => (dark = 0.72 * e), ease.inOut);
  colMode = 'condense';
  lab.tween(0.42, (e) => (flameS.on = Math.max(0, (e - 0.45) / 0.55)), ease.linear);
  await lab.tween(0.42, (e) => (condense = e), ease.inOut);
  colMode = 'out';
  const maya = lab.puppet('a');
  maya.set({ trail: false });
  await lab.wait(0.12);

  // 3. she leans back and draws breath (her eye brightens)...
  const eyeK = { v: 1 };
  maya.each = (m) => {
    const k = eyeK.v;
    m.eyeMat.color.setRGB(3.2 * k, 3.1 * k, 2.9 * k);
  };
  await lab.tween(
    0.32,
    (e) => {
      maya.set({ pitch: -0.32 * e, sy: 1 + 0.1 * e, sx: 1 - 0.04 * e, sz: 1 - 0.04 * e });
      eyeK.v = 1 + 0.6 * e;
    },
    ease.inOut,
  );
  // 4. ...and PUFFS: a snap forward, a breath of light; the flame bends away, gutters and goes out
  breathT0 = lab.t;
  lab.tween(0.1, (e) => maya.set({ pitch: -0.32 + 0.5 * e, sy: 1.1 - 0.2 * e, sx: 0.96 + 0.1 * e, sz: 0.96 + 0.1 * e }), ease.out);
  lab.tween(0.14, (e) => (eyeK.v = 1.6 + 1.8 * Math.sin(e * Math.PI)), ease.linear);
  await lab.wait(0.08);
  await lab.tween(
    0.2,
    (e, k) => {
      flameS.bend = Math.min(1, k * 2.2);
      flameS.stretch = 1 + 0.35 * Math.sin(Math.min(1, k * 1.6) * Math.PI) - 0.9 * Math.max(0, (k - 0.55) / 0.45);
      flameS.flick = k > 0.5 ? (Math.sin(k * 90) > 0 ? 1 : 0.6) : 1;
      flameS.on = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    },
    ease.linear,
  );
  // 5. OUT. The room goes dark for a beat; a thin curl of light-smoke rises from the wick
  flameS.on = 0;
  dark = 1;
  smoke.visible = true;
  smokeT0 = lab.t;
  arena.emit('checkpoint', { id: 'a', n: 1 });
  lab.tween(0.2, (e) => maya.set({ pitch: 0.18 * (1 - e), sy: 0.9 + 0.1 * e, sx: 1.06 - 0.06 * e, sz: 1.06 - 0.06 * e }), ease.out);
  lab.tween(0.3, (e) => (eyeK.v = 1 - 0.5 * e), ease.out);
  await lab.wait(0.46);

  // 6. RELIGHT: the column re-ignites from the glass, the lights snap up, her ring at its foot
  colMode = 'relight';
  dark = 0.25;
  lab.tween(0.3, (e) => (dark = 0.25 * (1 - e)), ease.out);
  lab.ring(P, lab.PALETTE.light, 1.2, 0.02, 0.5);
  arena.setTaken([{ color: RED, cp: 1 }]);
  lab.tween(0.3, (e) => (eyeK.v = 0.5 + 0.5 * e), ease.out);
  lab.tween(0.55, (e) => (close = 1 - e), ease.inOut3);
  await lab.tween(0.3, (e) => (relight = e), ease.linear);
  smoke.visible = false;
  colMode = 'game';
  col.col.position.set(P.x, 0, P.z);
  arena.focusOn = null;
  lab.tween(0.35, (e) => (labelFade = e), ease.in);
  maya.each = null;
  maya.set({ pitch: 0, sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 4, y: 1, d: 1 });
  await lab.wait(0.27);
  releaseCam();
}
