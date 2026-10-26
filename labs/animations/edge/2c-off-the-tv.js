// Off the TV, staged with a locked-off camera: the frame of the TV is the edge of the world. She drives out of
// the picture on the right, her red light leaks back in at the edge, the frame sits empty, a glow gathers at the
// top corner, and she falls past the lens, huge and slow, her eye and ring painting long-exposure streaks, out
// through the bottom of the picture. The board is never touched.
export const meta = {
  title: 'Off the TV (light leaks)',
  idea:
    'She misses the rim entirely and drives on through thin air, trailing red, straight out of the right side of the picture. Her light spills back in at the edge of the frame, then the frame sits empty. A red glow gathers in the top corner, and she drops in right in front of the lens, huge and tumbling, smearing streaks of light, and falls out of the bottom of the TV.',
  notes:
    'Sound: her drive hum pans hard right and cuts out; a beat of silence; a soft rising glass whistle from the top as the corner glows, a deep whoosh as she passes the lens (big, close, slow), nothing when she leaves. The camera never moves: the joke is that the screen wraps but the board does not. In the game the light leaks are HUD-layer gradients at the picture edge; her fall is placed relative to the camera, so it works at any framing. It becomes a running gag: out on the right, back in at the top.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const RED = new THREE.Color('#ff4d6d');
  const WHITE = new THREE.Color('#fff4ea');
  const ROW = 1;

  // ---------- helpers (self-contained) ----------
  const softTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000');
    gr.addColorStop(0.3, '#2a2a2a');
    gr.addColorStop(0.5, '#fff');
    gr.addColorStop(0.7, '#2a2a2a');
    gr.addColorStop(1, '#000');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  lab.cleanup(() => softTex.dispose());
  function ribbon(N) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 6);
    const col = new Float32Array(N * 6);
    const uv = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) uv.set([i / (N - 1), 0, i / (N - 1), 1], i * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({ map: softTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    lab.add(mesh);
    lab.cleanup(() => {
      geo.dispose();
      mat.dispose();
    });
    const tg = new THREE.Vector3();
    const vw = new THREE.Vector3();
    const sd = new THREE.Vector3();
    return {
      hide: () => geo.setDrawRange(0, 0),
      set(pts, width, color) {
        const n = Math.min(N, pts.length);
        if (n < 2) return geo.setDrawRange(0, 0);
        const cam = lab.camera3.position;
        for (let i = 0; i < n; i++) {
          const p = pts[pts.length - n + i];
          tg.subVectors(pts[pts.length - n + Math.min(n - 1, i + 1)], pts[pts.length - n + Math.max(0, i - 1)]).normalize();
          vw.subVectors(cam, p).normalize();
          sd.crossVectors(tg, vw).normalize();
          const u = i / (n - 1);
          const w = width(u);
          pos.set([p.x + sd.x * w, p.y + sd.y * w, p.z + sd.z * w, p.x - sd.x * w, p.y - sd.y * w, p.z - sd.z * w], i * 6);
          const c = color(u);
          col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.setDrawRange(0, (n - 1) * 6);
      },
    };
  }
  // light leaking into the picture at its edge (a soft glow, screen-blended over the picture)
  function leak() {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0';
    lab.overlay.append(el);
    return {
      el,
      set(xPct, yPct, wPct, hPct, a, rgb = '255,77,109') {
        el.style.opacity = String(Math.max(0, a));
        el.style.background = `radial-gradient(ellipse ${wPct}% ${hPct}% at ${xPct}% ${yPct}%, rgba(${rgb},0.9) 0%, rgba(${rgb},0.35) 35%, rgba(${rgb},0) 100%)`;
      },
    };
  }

  // ---------- the cast ----------
  const maya = lab.puppet('a');
  const b = maya.bot;
  const m = maya.model;
  const east = lab.facing(1);
  const S = { card: 1, pool: 1, ring: 1, eye: 1 };
  maya.each = (model) => {
    model.poolMat.opacity *= S.pool;
    model.ringMat.opacity = Math.min(1, model.ringMat.opacity * S.ring);
    model.eyeMat.color.multiplyScalar(S.eye);
    if (b.card) b.card.material.opacity *= S.card;
    S.after?.(); // runs after her pose is placed this frame
  };
  const W = lab.overlay.clientWidth || 960;
  const screenX = (x) => lab.toScreen(lab.pos(x, ROW).setY(0.2)).x / W;

  // ---------- 1. the drive: she never notices the rim, and drives on, out of the picture ----------
  lab.playCard('a', ['m3']);
  const side = leak();
  let x = 4;
  let v = 0;
  const VMAX = 3.5; // spaces per second: the game's own driving pace
  let gone = false;
  await new Promise((done) => {
    const stop = lab.every((dt) => {
      v = Math.min(VMAX, v + dt * VMAX * 4.5);
      x += v * dt;
      maya.set({ x, y: ROW, rot: east, lift: 0 });
      // once she is past the rim, nothing is under her: her ring and glow pool have nothing to light
      const over = Math.max(0, Math.min(1, (x - 6.55) / 0.5));
      S.pool = 1 - 0.85 * over;
      const sx = screenX(x);
      // her light spills in at the right edge as she reaches it
      const near = Math.max(0, Math.min(1, (sx - 0.82) / 0.2));
      side.set(100, lab.toScreen(lab.pos(x, ROW).setY(0.2)).y / (lab.overlay.clientHeight || 540) * 100, 14 + 10 * near, 26, near * 0.85);
      S.card = 1 - Math.max(0, Math.min(1, (sx - 0.85) / 0.12));
      if (sx > 1.12 && !gone) {
        gone = true;
        stop();
        done();
      }
    });
  });
  maya.set({ visible: false, trail: false });

  // ---------- 2. the empty frame: her light ebbs at the edge, then the room waits ----------
  const sideY = lab.toScreen(lab.pos(x, ROW).setY(0.2)).y / (lab.overlay.clientHeight || 540) * 100;
  await lab.tween(0.22, (e) => side.set(100, sideY, 24 - 6 * e, 26, 0.85 * (1 - e)), ease.out);
  side.el.remove();
  await lab.wait(0.06);

  // ---------- 3. a glow gathers at the top of the picture... ----------
  const top = leak();
  const NX = 0.42; // where she comes in: right of centre (NDC)
  const topX = ((NX + 1) / 2) * 100;
  await lab.tween(0.15, (e) => top.set(topX, 0, 10 + 14 * e, 10 + 8 * e, 0.9 * e), ease.in);

  // ---------- 4. ...and she falls past the lens, huge and slow, smearing light ----------
  const cam = lab.camera3;
  const camPos = new THREE.Vector3();
  const at = (nx, ny, D) => {
    cam.updateMatrixWorld();
    camPos.setFromMatrixPosition(cam.matrixWorld);
    const p = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
    return camPos.clone().add(p.sub(camPos).normalize().multiplyScalar(D));
  };
  const D = 3.4;
  S.card = 0;
  S.pool = 0;
  S.ring = 1.6;
  S.eye = 1.3;
  maya.set({ visible: true, trail: false });
  const eyeW = new THREE.Vector3();
  const ringA = new THREE.Vector3();
  const ringB = new THREE.Vector3();
  const hist = [];
  const smearEye = ribbon(36);
  const smearA = ribbon(36);
  const smearB = ribbon(36);
  // long exposure: her eye and the two sides of her ring paint streaks as she falls (recorded after her pose)
  const ringSide = m.ringMat.side;
  m.ringMat.side = THREE.DoubleSide; // tumbling, we see her ring from below too
  lab.cleanup(() => (m.ringMat.side = ringSide));
  S.after = () => {
    const t = lab.t;
    if (maya.group.visible) {
      maya.group.updateMatrixWorld(true);
      m.muzzle.getWorldPosition(eyeW);
      ringA.set(0.4, 0.01, 0).applyMatrix4(maya.group.matrixWorld);
      ringB.set(-0.4, 0.01, 0).applyMatrix4(maya.group.matrixWorld);
      hist.push({ e: eyeW.clone(), a: ringA.clone(), b: ringB.clone(), t });
    }
    while (hist.length && t - hist[0].t > 0.34) hist.shift();
    if (hist.length < 2) {
      smearEye.hide();
      smearA.hide();
      smearB.hide();
      return;
    }
    const fade = (u) => u * u;
    smearEye.set(hist.map((h) => h.e), (u) => 0.02 + 0.05 * u, (u) => WHITE.clone().lerp(RED, 0.5 * (1 - u)).multiplyScalar(3.2 * fade(u)));
    smearA.set(hist.map((h) => h.a), (u) => 0.018 + 0.045 * u, (u) => RED.clone().multiplyScalar(2.8 * fade(u)));
    smearB.set(hist.map((h) => h.b), (u) => 0.018 + 0.045 * u, (u) => RED.clone().multiplyScalar(2.8 * fade(u)));
  };
  const stopSmear = () => (S.after = null);
  const wash = leak(); // her light washing over the whole picture as she passes the lens
  const spin = lab.range(0.8, 1.3);
  await lab.tween(
    0.66,
    (e, k) => {
      const ny = 1.45 - 2.95 * e;
      const p = at(NX + 0.05 * Math.sin(k * 2.2), ny, D);
      maya.set({ x: p.x + 3, y: p.z + 1.5, lift: p.y, rot: east + spin * k, pitch: 0.5 + 1.6 * k, roll: -0.5 + 0.9 * k });
      top.set(topX, 0, 24, 18, 0.9 * Math.max(0, 1 - k * 2.2));
      const mid = Math.max(0, 1 - Math.abs(ny) / 1.1);
      wash.set(topX, ((1 - ny) / 2) * 100, 70, 80, 0.32 * mid * mid);
    },
    (k) => k + 0.095 * Math.sin(2 * Math.PI * k), // a speed ramp: in fast, hangs as she passes the lens, out fast
  );
  maya.set({ visible: false });
  top.el.remove();

  // ---------- 5. gone through the bottom: one last glow at the bottom edge; the trail on the glass ebbs ----------
  const bottom = leak();
  const trailAge = lab.every((dt) => {
    for (const p of b.trail) p.t -= dt * 2.2; // the trail fades out faster than usual
  });
  await lab.tween(0.36, (e) => {
    bottom.set(topX, 100, 26 - 8 * e, 16, 0.7 * (1 - e));
    wash.set(topX, 100, 70, 80, 0);
  }, ease.out);
  stopSmear();
  smearEye.hide();
  smearA.hide();
  smearB.hide();
  await lab.wait(0.12);
  trailAge();
  b.trail = [];
  bottom.el.remove();
  wash.el.remove();
  maya.release({ x: 7, y: ROW, d: 1, on: false });
}
