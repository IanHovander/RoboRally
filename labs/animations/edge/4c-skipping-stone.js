// Skipping stone, staged as a long exposure on a night lake. As she leaves the rim the camera sinks to water
// level and glides along with her; the dark turns out to be still water: her reflection appears under her, each
// touch blooms wide rings of soft light, and every hop is painted in the air as an arc of light, like a
// long-exposure photograph of a skimming stone. On the last touch she sinks, her light going down under the
// water; the camera cranes up and home, and from above the crossing ripples spread and settle into black.
export const meta = {
  title: 'Skipping stone (night lake)',
  idea:
    'She is a Pebble, so she skims. Off the rim the camera drops to water level: the darkness is a still lake that mirrors her, and she skips three times, each hop shorter, each touch blooming wide rings of light, each arc painted in the air like a long exposure. Time slows on the first touch. On the last she sinks, her light going down into the black, and the camera cranes up to show the crossing ripples settling to stillness.',
  notes:
    'Sound: soft glass "plinks" rising in pitch with each shorter skip, a low glassy "bloop" as she sinks, and the ripples as a faint shimmering hum that fades. The camera moves are relative to the game camera. The ripples are textured planes just below the glass top, so the slab hides them where they pass under it (it floats on the lake). Varies: the hop lengths and the ripple sizes can change a little each time.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const RED = new THREE.Color('#ff4d6d');
  const WHITE = new THREE.Color('#fff4ea');
  const ROW = 1;
  const LAKE = -0.07; // the surface of the dark, just below the glass top
  const W = (x, lift = 0) => lab.pos(x, ROW).setY(lift);

  // ---------- helpers (self-contained) ----------
  const rtween = (dur, fn, ez = ease.inOut) =>
    new Promise((ok) => {
      const t0 = lab.real;
      fn(ez(0), 0);
      const stop = lab.every(() => {
        const k = Math.min(1, (lab.real - t0) / dur);
        fn(ez(k), k);
        if (k >= 1) {
          stop();
          ok();
        }
      });
    });
  const canvasTex = (draw, w = 256, h = 256) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    lab.cleanup(() => t.dispose());
    return t;
  };
  const softTex = canvasTex((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#000');
    gr.addColorStop(0.3, '#2a2a2a');
    gr.addColorStop(0.5, '#fff');
    gr.addColorStop(0.7, '#2a2a2a');
    gr.addColorStop(1, '#000');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, 4, 64);
  // a ripple: one soft ring of light near the edge of the texture, with a fainter one inside
  const rippleTex = canvasTex((g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.62, 'rgba(0,0,0,1)');
    gr.addColorStop(0.7, 'rgba(40,40,40,1)');
    gr.addColorStop(0.75, 'rgba(0,0,0,1)');
    gr.addColorStop(0.86, 'rgba(0,0,0,1)');
    gr.addColorStop(0.94, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
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
        const o = pts.length - n;
        const cam = lab.camera3.position;
        for (let i = 0; i < n; i++) {
          const p = pts[o + i];
          tg.subVectors(pts[o + Math.min(n - 1, i + 1)], pts[o + Math.max(0, i - 1)]).normalize();
          vw.subVectors(cam, p).normalize();
          sd.crossVectors(tg, vw).normalize();
          const w = width(o + i);
          pos.set([p.x + sd.x * w, p.y + sd.y * w, p.z + sd.z * w, p.x - sd.x * w, p.y - sd.y * w, p.z - sd.z * w], i * 6);
          const c = color(o + i);
          col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.setDrawRange(0, (n - 1) * 6);
      },
    };
  }

  // ---------- the camera (relative to the game's; holds its picture offset so taking it doesn't jump) ----------
  const c0 = A.camCur;
  const base = { target: c0.tgt.clone(), az: c0.az, el: c0.el, dist: c0.d, sx: c0.sx, sy: c0.sy };
  const cam = { target: base.target.clone(), az: base.az, el: base.el, dist: base.dist, sx: base.sx, sy: base.sy };
  const blend = (a, b, e) => {
    cam.target.copy(a.target).lerp(b.target, e);
    for (const k of ['az', 'el', 'dist', 'sx', 'sy']) cam[k] = a[k] + (b[k] - a[k]) * e;
  };
  const snapCam = () => ({ ...cam, target: cam.target.clone() });
  const releaseCam = lab.camera(() => {
    const k = Math.min(1, Math.min(A.dt, 0.1) * 4);
    if (A.camCur && k < 1) {
      A.camCur.sx = cam.sx / (1 - k);
      A.camCur.sy = cam.sy / (1 - k);
    }
    return { target: cam.target.clone(), az: cam.az, el: cam.el, dist: cam.dist };
  });

  // ---------- ripples on the lake ----------
  const rippleColor = RED.clone().lerp(WHITE, 0.5);
  const ripples = [];
  const ripple = (x, size, delay = 0, life = 1.7, bright = 1) => {
    const mat = new THREE.MeshBasicMaterial({ map: rippleTex, color: rippleColor.clone().multiplyScalar(1.7 * bright), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(W(x, LAKE));
    mesh.renderOrder = 2;
    mesh.visible = false;
    lab.add(mesh);
    lab.cleanup(() => {
      mesh.geometry.dispose();
      mat.dispose();
    });
    ripples.push({ mesh, mat, t0: lab.t + delay, life, size });
  };
  const splash = (x, n, size, bright = 1) => {
    for (let i = 0; i < n; i++) ripple(x, size * (1 - i * 0.22), i * 0.13, 1.7 - i * 0.15, bright * (1 - i * 0.2));
    lab.particles(W(x, LAKE + 0.02), ['#ffffff', '#ff8fa3'], Math.round(8 * bright), { speed: 0.7, up: 0.9, gravity: 3.5, size: 0.03, dur: 0.45 });
  };
  const stopRipples = lab.every(() => {
    for (const r of ripples) {
      const k = (lab.t - r.t0) / r.life;
      r.mesh.visible = k >= 0 && k < 1;
      if (!r.mesh.visible) continue;
      const s = 0.12 + r.size * ease.out3(k);
      r.mesh.scale.set(s, s, 1);
      r.mat.opacity = Math.min(1, k * 8) * (1 - k) ** 1.3;
    }
  });

  // ---------- the cast ----------
  const maya = lab.puppet('a');
  const b = maya.bot;
  const m = maya.model;
  const S = { card: 1, pool: 1, glow: 1, mirror: 0, after: null };
  maya.each = (model) => {
    model.poolMat.opacity *= S.pool;
    model.eyeMat.color.multiplyScalar(S.glow);
    model.ringMat.opacity *= Math.max(0, S.glow);
    if (b.card) b.card.material.opacity *= S.card;
    S.after?.();
  };
  // her reflection in the still dark: a mirrored copy of her, made of her own light
  maya.group.updateMatrixWorld(true);
  const mirror = maya.group.clone(true);
  const mirrorMat = new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(0.75), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mirror.traverse((o) => {
    if (o.isSprite) o.visible = false; // no name tag in the water
    if (!o.isMesh) return;
    if (o.material === m.poolMat) o.visible = false;
    else o.material = mirrorMat;
  });
  mirror.matrixAutoUpdate = false;
  lab.add(mirror);
  lab.cleanup(() => mirrorMat.dispose());
  const flip = new THREE.Matrix4().makeTranslation(0, 2 * LAKE, 0).multiply(new THREE.Matrix4().makeScale(1, -1, 1));
  // the long exposure: her path over the water, painted in light
  const arc = ribbon(160);
  const path = [];
  const ctr = new THREE.Vector3();
  S.after = () => {
    maya.group.updateMatrixWorld(true);
    mirror.matrix.multiplyMatrices(flip, maya.group.matrixWorld);
    mirrorMat.opacity = S.mirror;
    mirror.visible = S.mirror > 0.01 && maya.group.visible;
    if (S.paint && maya.group.visible) {
      ctr.set(0, 0.12, 0).applyMatrix4(maya.group.matrixWorld);
      const last = path[path.length - 1];
      if (!last || last.p.distanceTo(ctr) > 0.02) path.push({ p: ctr.clone(), t: lab.t });
    }
    if (path.length > 1) {
      const life = 1.5;
      arc.set(
        path.map((q) => q.p),
        (i) => 0.05 * (1 - Math.min(1, (lab.t - path[i].t) / life)) + 0.015,
        (i) => {
          const a = Math.max(0, 1 - (lab.t - path[i].t) / life);
          return RED.clone().lerp(WHITE, 0.4 * a).multiplyScalar(3 * a * a * S.arc);
        },
      );
    } else arc.hide();
  };
  S.arc = 1;

  // ---------- 1. the drive; the camera starts to sink toward the water ----------
  lab.playCard('a', ['m3']);
  const V = 3.3;
  const ACC = 0.2;
  const xAcc = 4 + (V * ACC) / 2;
  const TR = ACC + (6.5 - xAcc) / V;
  const east = lab.facing(1);
  const lake = { ...base, target: W(7.55, -0.2), az: -0.2, el: 0.27, dist: base.dist * 0.6, sx: 0, sy: 0.04 };
  const camIn = lab.waitReal(0.35).then(() => rtween(1.15, (e) => blend(base, lake, e), ease.inOut));
  await lab.tween(TR, (e, k) => {
    const tau = TR * k;
    const x = tau < ACC ? 4 + (V * tau * tau) / (2 * ACC) : xAcc + V * (tau - ACC);
    maya.set({ x, y: ROW, rot: east });
  }, ease.linear);

  // ---------- 2. off the rim, she settles flat onto the dark ----------
  maya.set({ trail: false });
  S.paint = true;
  const x1 = 6.95 + lab.range(-0.05, 0.05);
  await lab.tween(0.15, (e, k) => {
    maya.set({ x: 6.5 + (x1 - 6.5) * k, lift: LAKE * k * k, pitch: -0.08 * k });
    S.card = 1 - k;
    S.pool = 1 - k;
    S.mirror = 0.26 * k;
  }, ease.linear);

  // ---------- 3. one, two, three: each hop shorter and lower, each touch blooms rings of light ----------
  const hops = [
    { len: 0.75, h: 0.34, dur: 0.38 },
    { len: 0.48, h: 0.19, dur: 0.29 },
    { len: 0.27, h: 0.08, dur: 0.2 },
  ].map((hp) => ({ ...hp, len: hp.len * lab.range(0.92, 1.08) }));
  let x = x1;
  let spin = 0;
  const sizes = [2.6, 2.0, 1.45];
  for (let i = 0; i < hops.length; i++) {
    const hp = hops[i];
    splash(x, 3, sizes[i], 1 - i * 0.12);
    lab.shake(0.012, 0.15);
    if (i === 0) {
      // the first touch: time slows while the first rings bloom
      lab.timeScale = 0.45;
      lab.waitReal(0.32).then(() => lab.slowmo(1, 0.18));
    }
    const xs = x;
    const sp0 = spin;
    await lab.tween(hp.dur, (e, k) => {
      const xx = xs + hp.len * k;
      const up = 4 * hp.h * k * (1 - k);
      // a squash on the touch, a slight nose-up lean in the air, and the spin of a skimming stone
      const squash = k < 0.18 ? 1 - 0.16 * Math.sin((k / 0.18) * Math.PI) : 1;
      spin = sp0 + (1.1 - i * 0.3) * k;
      maya.set({ x: xx, lift: LAKE + up, pitch: -0.12 * Math.sin(Math.PI * k), rot: east + spin, sx: 1 + (1 - squash) * 0.6, sy: squash, sz: 1 + (1 - squash) * 0.6 });
      S.mirror = 0.26 - 0.2 * Math.min(1, up / 0.3);
    }, ease.linear);
    x = xs + hp.len;
  }

  // ---------- 4. the last touch: no more skip in her; she sinks, her light going down into the black ----------
  splash(x, 2, 0.9, 0.55);
  S.paint = false;
  const sinkRot = east + spin;
  const ebb = lab.every((dt) => {
    for (const p of b.trail) p.t -= dt * 2.4;
    S.arc = Math.max(0, S.arc - dt * 1.4);
  });
  // ---------- 5. as she goes under, the camera cranes up and home over the spreading rings ----------
  const homing = lab.waitReal(0.24).then(() => {
    const from = snapCam();
    return rtween(0.66, (e) => blend(from, base, e), ease.inOut);
  });
  await lab.tween(0.42, (e, k) => {
    maya.set({ x: x + 0.06 * e, lift: LAKE - 0.55 * e, rot: sinkRot + 0.25 * e, pitch: 0.15 * e, sx: 1, sy: 1, sz: 1 });
    S.glow = 1 - e;
    S.mirror = 0.26 * (1 - e);
  }, ease.in);
  maya.set({ visible: false });
  await homing;
  ebb();
  stopRipples();
  for (const r of ripples) r.mesh.visible = false;
  arc.hide();
  b.trail = [];
  releaseCam();
  maya.release({ x: 7, y: ROW, d: 1, on: false });
}
