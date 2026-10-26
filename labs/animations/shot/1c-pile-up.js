// Pile-up, staged like a slapstick edit: the head of light stops dead, the picture hit-stops and snap-zooms on
// the crash, the rest of the beam piles into her in folds, and a second snap-in catches the gulp and the blink.
export const meta = {
  title: 'Pile-up (snap-zoom)',
  idea: 'The beam is a hose of light with weight. Its head stops dead on Maya\'s flank (two frames of hit-stop and a snap-zoom, like an Edgar Wright cut) but the rest keeps coming and buckles into a tall zigzag heap of light against her; the tail concertinas in, the heap trembles for a beat, then she slurps the whole thing in like a noodle, swells, settles, and blinks once.',
  notes: 'Sound: a bright zip as the beam races, a dull glass "tunk" on the hit-stop, a rattling run of tiny chimes as each fold buckles, one low "gulp" chime and a tiny ting on the blink. The heap grows with range: emission time is fixed, so a cross-board shot piles more folds. Camera: two snap-ins (0.08 s each) and one ease home; on a big board scale the zoom to the pair of robots.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const theo = lab.puppet('b');
  const maya = lab.puppet('a');
  const BLUE = new THREE.Color('#4dabf7');

  // ----- drawing: a line of light rebuilt each frame from points -----
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const add = (o) => lab.add(o);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(1.7), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = add(new THREE.Mesh(new THREE.BufferGeometry(), coreMat));
  const glow = add(new THREE.Mesh(new THREE.BufferGeometry(), glowMat));
  const setLine = (pts, rCore = 0.013, rGlow = 0.034) => {
    core.geometry.dispose();
    glow.geometry.dispose();
    const clean = [];
    for (const p of pts) if (!clean.length || clean[clean.length - 1].distanceTo(p) > 0.004) clean.push(p);
    if (clean.length < 2) {
      core.geometry = new THREE.BufferGeometry();
      glow.geometry = new THREE.BufferGeometry();
      return;
    }
    const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal');
    const seg = Math.min(520, Math.max(6, Math.ceil(curve.getLength() / 0.018)));
    core.geometry = new THREE.TubeGeometry(curve, seg, rCore, 6, false);
    glow.geometry = new THREE.TubeGeometry(curve, seg, rGlow, 8, false);
  };
  const sprite = (color, size) => {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size);
    return s;
  };
  const head = sprite(new THREE.Color(4, 4.2, 4.6), 0.34);
  const mouth = sprite(BLUE.clone().multiplyScalar(3), 0.5);
  head.visible = mouth.visible = false;

  // ----- the geometry of the shot -----
  theo.model.muzzle.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3().setFromMatrixPosition(theo.model.muzzle.matrixWorld);
  const Z = lab.pos(1, 1).z;
  const X0 = muzzle.x; // where the beam leaves Theo
  const XF = lab.pos(1, 1).x + 0.42; // Maya's east flank
  const YB = 0.15; // beam height
  const V = 13; // the speed of light (units/s)
  const TE = 0.42; // how long Theo pours light: the heap is V * TE of line
  const LB = V * TE;
  const D = X0 - XF;

  // the folds: each one buckles up from the line; later ones ride higher (a pile-up), every third curls into a loop
  const folds = [];
  let acc = 0;
  for (let k = 0; acc < LB + 2; k++) {
    const h = Math.min(0.62, 0.3 + 0.07 * k) * lab.range(0.86, 1.06);
    const loop = k % 3 === 2;
    const z = lab.range(-0.06, 0.06);
    const f = loop ? Math.PI * h * 0.95 : 2.05 * h;
    folds.push({ h, loop, z, u0: acc, f, lean: lab.range(0.03, 0.08) });
    acc += f;
  }
  let W = 0.12; // spacing between folds (squeezed when the tail arrives)
  let lift = 1; // fold heights (pushed up when the heap is squeezed)
  let wobble = 0;
  // a point of fold k at phase ph (0..1), with buckle height scale s
  const foldPoint = (k, ph, s, t) => {
    const F = folds[k];
    const x0 = XF + W * k;
    const jit = 1 + wobble * Math.sin(t * 61 + k * 2.1) * 0.08;
    const H = F.h * s * jit * lift;
    if (F.loop) {
      const a = ph * Math.PI * 2;
      const r = H / 2;
      return new THREE.Vector3(x0 + W * ph - Math.sin(a) * r * 0.8, YB + r * (1 - Math.cos(a)), Z + F.z + Math.sin(a) * 0.06 * s);
    }
    const tri = 1 - Math.abs(2 * ph - 1);
    const peak = Math.pow(tri, 0.9);
    return new THREE.Vector3(x0 + W * ph - F.lean * peak * s, YB + H * peak, Z + F.z * peak);
  };
  // the whole line: pile from material sigma..P, then the straight run back toward Theo
  let squeeze = 0; // during the gulp: the heap shrinks toward her flank
  const linePoints = (t, P, straight, sigma = 0) => {
    const pts = [];
    if (P > 0) {
      for (let k = 0; k < folds.length; k++) {
        const F = folds[k];
        if (F.u0 >= P) break;
        const part = Math.min(1, (P - F.u0) / F.f); // the newest fold is still buckling up
        const n = Math.max(3, Math.ceil(F.f / 0.025));
        for (let i = 0; i <= n; i++) {
          const ph = i / n;
          if (F.u0 + ph * F.f < sigma) continue;
          const p = foldPoint(k, ph, part < 1 ? ease.outBack(part, 2.2) : 1, t);
          if (squeeze) {
            p.x = XF + (p.x - XF) * (1 - 0.65 * squeeze);
            p.y = YB + (p.y - YB) * (1 - 0.55 * squeeze);
            p.z = Z + (p.z - Z) * (1 - squeeze);
          }
          pts.push(p);
        }
      }
    }
    const from = pts.length ? pts[pts.length - 1].clone() : new THREE.Vector3(XF, YB, Z);
    if (straight > 0.01) {
      const endX = Math.min(X0, from.x + straight);
      if (!pts.length) pts.push(from);
      pts.push(new THREE.Vector3((from.x + endX) / 2, YB, Z), new THREE.Vector3(endX, endX >= X0 - 1e-3 ? muzzle.y : YB, Z));
    }
    return pts;
  };
  const pileEndX = (P) => {
    let x = XF;
    for (let k = 0; k < folds.length && folds[k].u0 < P; k++) x = XF + W * (k + 1);
    return x;
  };

  // ----- camera: home, snapped in on the crash, then tighter on the gulp -----
  const cam = { zoom: 0, toward: 0 };
  const crash = new THREE.Vector3(XF + 0.25, 0.15, Z);
  const releaseCam = lab.camera((home) => ({
    target: home.target.clone().lerp(crash, cam.toward),
    dist: home.dist * (1 - cam.zoom),
    el: home.el - cam.zoom * 0.12,
  }));

  // a tween on the real clock (it runs through hit-stops and slow motion)
  const realTween = (dur, fn) => new Promise((ok) => {
    const r0 = lab.real;
    const stop = lab.every(() => {
      const k = Math.min(1, (lab.real - r0) / dur);
      fn(ease.out3(k));
      if (k >= 1) {
        stop();
        ok();
      }
    });
  });

  // ----- Theo winds up -----
  const theoEye = { k: 0 };
  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2 + theoEye.k * 4, 3.1 + theoEye.k * 4.5, 2.9 + theoEye.k * 5);
  };
  await lab.tween(0.12, (e) => {
    theoEye.k = e;
    theo.set({ pitch: -0.1 * e, x: 5 + 0.04 * e });
  }, ease.inOut);

  // ----- fire: the head races down the row -----
  const t0 = lab.t;
  head.visible = true;
  let phase = 'race';
  let P = 0;
  const stopLine = lab.every(() => {
    const t = lab.t - t0;
    if (phase === 'race') {
      const hx = Math.max(XF, X0 - V * t);
      setLine([muzzle.clone(), new THREE.Vector3((hx + X0) / 2, YB, Z), new THREE.Vector3(hx, YB, Z)]);
      head.position.set(hx, YB, Z);
      if (hx <= XF) phase = 'pile';
    }
    if (phase === 'pile') {
      const emitted = V * Math.min(t, TE);
      P = Math.min(LB, Math.max(0, V * (t - D / V)));
      const straight = emitted - P;
      setLine(linePoints(t, P, straight));
      head.position.set(XF, YB, Z);
      head.material.opacity = 0.35;
      head.scale.setScalar(0.22);
    }
  });
  lab.tween(0.14, (e) => {
    theoEye.k = 1 - e;
    theo.set({ pitch: -0.1 + 0.16 * Math.sin(e * Math.PI) * (1 - e) + 0.1 * e * 0, x: 5.04 - 0.04 * e });
  }, ease.out).then(() => theo.set({ pitch: 0, x: 5 }));

  // the head arrives: hit-stop (time almost stops) and a snap-zoom
  await lab.wait(D / V);
  lab.timeScale = 0.04;
  lab.shake(0.025, 0.004);
  const snap = (to, toward, dur) => {
    const z0 = cam.zoom;
    const w0 = cam.toward;
    return realTween(dur, (e) => {
      cam.zoom = z0 + (to - z0) * e;
      cam.toward = w0 + (toward - w0) * e;
    });
  };
  await snap(0.2, 0.42, 0.08);
  await lab.waitReal(0.03);
  lab.timeScale = 1;

  // the rest keeps coming: folds buckle up against her; she rocks very slightly with each one (but never moves)
  const pileStart = lab.t;
  let lastK = -1;
  let kickT = -9;
  maya.each = (m, t) => {
    const k = folds.findIndex((F) => F.u0 + F.f > P);
    if (k !== lastK) {
      lastK = k;
      kickT = t;
    }
    // each fold that buckles shoves her a hair west (local +x when she faces south), and she springs back
    m.body.position.x = 0.022 * Math.exp(-(t - kickT) * 22) * Math.cos((t - kickT) * 40);
  };
  wobble = 0.5;
  await lab.wait(TE + D / V - (lab.t - t0));
  // the tail arrives: the whole heap concertinas (buffers!)
  P = LB;
  lab.shake(0.03, 0.18);
  const W0 = W;
  lab.tween(0.22, (e, k) => {
    W = W0 * (1 - 0.36 * ease.outBack(k, 2.4));
    lift = 1 + 0.14 * ease.outBack(k, 2.4);
    wobble = 0.5 + 1.5 * (1 - k);
  }, ease.linear);
  await lab.wait(0.24);
  // a held beat: the heap sits there, humming
  wobble = 0.35;
  await lab.wait(0.1);

  // ----- the gulp -----
  phase = 'gulp';
  stopLine();
  head.visible = false;
  mouth.visible = true;
  mouth.position.set(XF - 0.05, YB, Z);
  const fill = { k: 0 };
  maya.each = (m) => {
    m.paint.emissive.copy(BLUE);
    m.paint.emissiveIntensity = 0.16 + fill.k * 0.8;
  };
  snap(0.27, 0.6, 0.3);
  const t1 = lab.t;
  await lab.tween(0.3, (e, k) => {
    squeeze = ease.in(k);
    const sigma = e * (LB + 0.1);
    setLine(linePoints(lab.t - t0, LB, 0, sigma), 0.013, 0.042 + 0.02 * k);
    fill.k = e;
    mouth.material.opacity = 0.4 + 0.6 * e;
    mouth.scale.setScalar(0.4 + 0.5 * e);
    maya.set({ sx: 1 + 0.2 * e, sz: 1 + 0.2 * e, sy: 1 + 0.12 * e });
  }, ease.in3);
  void t1;
  setLine([]);
  core.visible = glow.visible = false;
  lab.shake(0.02, 0.12);

  // settle back to her shape, then one bright blink
  const blink = { k: 0 };
  maya.each = (m) => {
    m.paint.emissive.copy(BLUE);
    m.paint.emissiveIntensity = 0.16 + fill.k * 0.8;
    const b = blink.k;
    if (b < 0) m.eyeMat.color.setRGB(0.15, 0.15, 0.15);
    else m.eyeMat.color.setRGB(3.2 + b * 9, 3.1 + b * 9.5, 2.9 + b * 10);
  };
  lab.tween(0.18, (e) => {
    mouth.material.opacity = 1 - e;
    mouth.scale.setScalar(0.9 + 0.6 * e);
  }, ease.out).then(() => (mouth.visible = false));
  const settle = lab.tween(0.5, (e, k) => {
    const el = ease.outElastic(k);
    maya.set({ sx: 1.2 - 0.2 * el, sz: 1.2 - 0.2 * el, sy: 1.12 - 0.12 * el });
    fill.k = 1 - ease.out(k);
  }, ease.linear);
  await lab.wait(0.12);
  blink.k = -1; // eye shut...
  await lab.wait(0.07);
  lab.tween(0.3, (e) => (blink.k = 1 - e), ease.out); // ...and open, bright
  await lab.wait(0.08);
  // camera home
  const z0 = cam.zoom;
  const w0 = cam.toward;
  await lab.tween(0.42, (e) => {
    cam.zoom = z0 * (1 - e);
    cam.toward = w0 * (1 - e);
  }, ease.inOut3);
  await settle;
  releaseCam();
  maya.each = null;
  theo.each = null;
  maya.set({ sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 1, y: 1, d: 2 });
  theo.release({ x: 5, y: 1, d: 3 });
  void pileStart;
  void pileEndX;
}
