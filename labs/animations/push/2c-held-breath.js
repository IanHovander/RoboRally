// The Dark Gasps, staged as a stop-time reveal: at the instant of contact the board freezes, the dark room turns
// out to be a grandstand of phones, and they jump in real time while the robots hang in the air of the moment.
export const meta = {
  title: 'Stop-Time Gasp',
  idea:
    "Somewhere in the dark, one phone is already up (someone saw it coming). At the instant Maya's nose meets Theo the board stops dead, and the black room turns out to be full: tiers of tiny warm phone lights all around and below the slab appear at once and jolt upward together, each leaving a streak like a long exposure, a few popping a camera flash. The camera breathes back to take it in. Then time starts again, Theo slides to rest and the crowd sinks and goes dark again, phone by phone, the front rows last.",
  notes:
    "The freeze is the staging: the board holds still for a fifth of a second while the crowd moves in real time, so the gasp lands on the exact frame of contact. The crowd's size follows the drama (computed from the beat: robots pushed, a pit next to where the victim lands): a single shove like this one lights the nearer tiers and leaves the far ones as faint glimmers; a chain of pushes or a shove toward a pit lights the whole arena, jumps higher, pulls the camera further back and fires more flashes. The board's own light is never touched. Sound: a soft intake of breath made of glass (a rising swell of many tiny chimes), then a ripple of quiet clicks as the phones go down.",
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');

  // ---- how dramatic is this push? ----
  const fx = lab.scenario.beats.flat();
  const pushed = fx.filter((f) => f.k === 'move' && f.id !== 'a').length;
  const grid = lab.scenario.grid.map((row) => row.split(' '));
  const [tx, ty] = [4, 2];
  const pitNear = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => grid[ty + dy]?.[tx + dx] === 'XX');
  const drama = Math.min(3, pushed + (pitNear ? 1.5 : 0)); // 1: a single shove .. 3: the full arena
  const reach = 3.2 + drama * 2.4; // how far from the shove the crowd really reacts
  const jump = 0.2 + 0.08 * drama;

  // ---- the crowd: tiers of phones in a rounded bowl around and below the slab ----
  const W = 3.5;
  const Hh = 2;
  const phones = [];
  for (let r = 0; r < 7; r++) {
    const o = 0.65 + r * 0.6;
    const y = -1.4 + r * 0.26;
    const a = W + o;
    const b = Hh + o;
    const per = 2 * (2 * (W + Hh)) + 2 * Math.PI * o;
    const n = Math.floor(per / (0.36 + r * 0.03));
    for (let i = 0; i < n; i++) {
      if (lab.rand() < 0.18) continue; // empty seats: loose tiers, not a grid
      const s = ((i + lab.rand() * 0.8) / n) * per;
      // walk the rounded rectangle
      const segs = [2 * W, Math.PI * o * 0.5, 2 * Hh, Math.PI * o * 0.5, 2 * W, Math.PI * o * 0.5, 2 * Hh, Math.PI * o * 0.5];
      let d = s;
      let k = 0;
      while (k < 7 && d > segs[k]) d -= segs[k++];
      let p;
      const arc = (cx, cz, a0) => [cx + Math.cos(a0 + d / o) * o, cz + Math.sin(a0 + d / o) * o];
      if (k === 0) p = [-W + d, -b];
      else if (k === 1) p = arc(W, -Hh, -Math.PI / 2);
      else if (k === 2) p = [a, -Hh + d];
      else if (k === 3) p = arc(W, Hh, 0);
      else if (k === 4) p = [W - d, b];
      else if (k === 5) p = arc(-W, Hh, Math.PI / 2);
      else if (k === 6) p = [-a, Hh - d];
      else p = arc(-W, -Hh, Math.PI);
      const jitter = lab.range(-0.22, 0.22);
      const len = Math.hypot(p[0], p[1]) || 1;
      phones.push({
        base: new THREE.Vector3(p[0] + (p[0] / len) * jitter, y + lab.range(-0.12, 0.12) + 0.1 * Math.sin(s * 1.7 + r), p[1] + (p[1] / len) * jitter),
        row: r,
        amp: lab.range(0.7, 1.25),
        lag: lab.range(0, 0.06),
        sway: lab.range(-1, 1),
        warm: lab.rand(),
        down: lab.range(0.35, 1.05), // when this one lowers its phone (after the slide starts)
        flash: lab.rand() < 0.012 * (1 + drama) ? lab.range(0.03, 0.4) : -1,
        y: 0,
        hist: [],
      });
    }
  }
  const impact = lab.pos(2.6, 2);
  for (const p of phones) {
    const dist = Math.hypot(p.base.x - impact.x, p.base.z - impact.z);
    p.str = Math.max(0.12, Math.min(1, (reach - dist) / 2.5));
  }
  // the early one: someone had their phone up already (in the far stand, up and to the left of the shove)
  const vw = lab.overlay.clientWidth || 960;
  const vh = lab.overlay.clientHeight || 540;
  const early = phones.reduce((best, p) => {
    const sp = lab.toScreen(p.base);
    const score = Math.hypot(sp.x / vw - 0.3, sp.y / vh - 0.17);
    return !best || score < best.score ? { p, score } : best;
  }, null).p;

  const phoneTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 48;
    const g = c.getContext('2d');
    g.filter = 'blur(1.5px)';
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(8, 8, 16, 32, 5);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const streakTex = (() => {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(2, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const N = phones.length;
  const mk = (geo, map) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), N);
    m.frustumCulled = false;
    for (let i = 0; i < N; i++) m.setColorAt(i, new THREE.Color(0, 0, 0));
    lab.add(m);
    return m;
  };
  const dots = mk(new THREE.PlaneGeometry(0.095, 0.14), phoneTex);
  const streaks = mk(new THREE.PlaneGeometry(0.04, 1).translate(0, -0.5, 0), streakTex);

  // the crowd runs on REAL time, so it keeps moving while the board is frozen
  const C = { on: -1, earlyOn: -1, down: -1, gone: false };
  const warmA = new THREE.Color(1, 0.84, 0.62);
  const warmB = new THREE.Color(0.86, 0.9, 1);
  const tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const stopCrowd = lab.every(() => {
    const now = lab.real;
    const q = arena.camera.quaternion;
    for (let i = 0; i < N; i++) {
      const p = phones[i];
      let bright = 0;
      let y = 0;
      let size = 1;
      if (p === early && C.earlyOn >= 0) {
        const k = Math.min(1, (now - C.earlyOn) / 0.35);
        bright = 0.9 * ease.out(k);
        y = 0.06 * ease.inOut(k);
      }
      if (C.on >= 0) {
        const s = now - C.on - p.lag;
        if (s >= 0) {
          // appear at once, jolt up (fast), hang, then sink as they go dark
          const up = Math.min(1, s / 0.09);
          const jolt = ease.out(up) * (1 + 0.15 * Math.sin(Math.min(1, s / 0.3) * Math.PI));
          y = Math.max(y, jump * p.amp * p.str * jolt);
          bright = Math.max(bright, Math.min(1, s / 0.03) * (0.35 + 0.95 * p.str));
          if (p.flash >= 0 && s > p.flash && s < p.flash + 0.09) {
            const f = 1 - (s - p.flash) / 0.09;
            bright += 5 * f;
            size = 1 + 2.2 * f;
          }
        }
        if (C.down >= 0) {
          const d = (now - C.down - p.down * (0.6 + 0.4 * (1 - p.str))) / 0.32;
          const k = Math.max(0, Math.min(1, d));
          y = y * (1 - 0.8 * ease.inOut(Math.min(1, (now - C.down) / 1.1))) - 0.08 * k;
          bright *= 1 - k;
        }
      }
      if (p === early && C.down >= 0) bright *= Math.max(0, 1 - (now - C.down - 1.0) / 0.25);
      // the long-exposure streak: how far it rose in the last tenth of a second
      p.hist.push({ t: now, y });
      while (p.hist.length > 2 && now - p.hist[0].t > 0.12) p.hist.shift();
      const rise = Math.max(0, y - p.hist[0].y);
      pos.copy(p.base);
      pos.y += y;
      pos.x += p.sway * 0.02 * y * 6;
      sc.set(size, size, 1);
      m4.compose(pos, q, sc);
      dots.setMatrixAt(i, m4);
      tmpC.copy(warmA).lerp(warmB, p.warm * 0.6).multiplyScalar(bright * 1.6);
      dots.setColorAt(i, tmpC);
      sc.set(1, Math.max(0.001, rise * 1.6), 1);
      m4.compose(pos, q, sc);
      streaks.setMatrixAt(i, m4);
      tmpC.multiplyScalar(rise > 0.005 ? 0.7 : 0);
      streaks.setColorAt(i, tmpC);
    }
    dots.instanceMatrix.needsUpdate = true;
    dots.instanceColor.needsUpdate = true;
    streaks.instanceMatrix.needsUpdate = true;
    streaks.instanceColor.needsUpdate = true;
  });

  // ---- the camera breathes back with the crowd (and keeps the game's framing offset) ----
  const off0 = { sx: arena.camCur?.sx ?? 0, sy: arena.camCur?.sy ?? 0 };
  const breath = { k: 0, hop: 0 };
  const releaseCam = lab.camera((home) => {
    const kk = Math.min(0.99, Math.min(arena.dt, 0.1) * 4);
    if (arena.camCur) {
      arena.camCur.sx = off0.sx / (1 - kk);
      arena.camCur.sy = off0.sy / (1 - kk);
    }
    const target = home.target.clone();
    target.y += -0.35 * breath.k + 0.05 * breath.hop;
    target.z += -0.25 * breath.k;
    return { target, dist: home.dist * (1 + (0.1 + 0.05 * drama) * breath.k), el: home.el - 0.03 * breath.k };
  });

  lab.playCard('a', ['m2']);
  // ---- 1. Maya rolls up; one phone in the dark is already raised ----
  C.earlyOn = lab.real + 0.05;
  await lab.tween(0.34, (e) => maya.set({ x: 1 + 1.2 * e, pitch: 0.1 * e }), ease.in);

  // ---- 2. contact: the board stops dead, the room gasps ----
  lab.timeScale = 0.02;
  C.on = lab.real;
  theo.set({ sx: 1.08, sy: 0.92 });
  // the camera's breath runs on real time too
  const t0 = lab.real;
  const stopBreath = lab.every(() => {
    const s = lab.real - t0;
    breath.hop = Math.sin(Math.min(1, s / 0.2) * Math.PI);
    breath.k = s < 0.3 ? ease.out(s / 0.3) : Math.max(0, 1 - ease.inOut(Math.min(1, (s - 0.45) / 1.0)));
  });
  await lab.waitReal(0.24);

  // ---- 3. time comes back with a snap; Theo slides to rest; the crowd sinks ----
  lab.timeScale = 1;
  C.down = lab.real + 0.05;
  await lab.tween(
    0.42,
    (e, k) => {
      maya.set({ x: 2.2 + 0.8 * e, pitch: 0.1 * (1 - k) });
      theo.set({ x: 3 + e, sx: 1.08 - 0.08 * k, sy: 0.92 + 0.08 * ease.outElastic(k), roll: Math.sin(k * 11) * 0.08 * (1 - k) });
    },
    ease.out,
  );
  theo.set({ sx: 1, sy: 1, roll: 0 });
  // wait for the camera to come home and the last phones to go down
  while (lab.real - t0 < 1.5) await lab.wait(1 / 30);
  stopBreath();
  releaseCam();
  stopCrowd();
  dots.visible = false;
  streaks.visible = false;
  maya.release({ x: 3, y: 2, d: 1 });
  theo.release({ x: 4, y: 2, d: 2 });
}
