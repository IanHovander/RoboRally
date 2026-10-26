// Wall, idea 18 (Prism), animator a: weight and physical comedy.
// Light has weight here. Maya hits the fin at full speed and her eye light keeps going: it spills out of her
// in a few heavy drops, pours into the fin and fills it like a glass, sloshing. The full fin gulps, flares, and
// the light comes out of the far side split: a soft, wide fan of spectrum floods across the glass over the
// spaces she didn't reach, spreading like spilled liquid and slowing to a stop (white near the fin, where the
// colours haven't parted yet). It holds, breathing. Then it folds shut like a hand fan, clack, the colours
// recombine into one white line, and the line is slurped back into the fin and poured back into her eye,
// which blinks on with a hiccup. Maya never leaves (3,1).
export const meta = {
  title: 'Prism (spilled light)',
  idea:
    'Her eye light has momentum: when she slams into the fin it spills out of her in heavy drops and fills the fin like a glass, sloshing. The full fin gulps and the light floods out of the far side split into a soft fan of spectrum across the spaces she didn\'t reach, spreading like spilled liquid. It holds a beat, then folds shut like a hand fan into one white line, which is slurped back through the fin into her dark eye: it blinks back on with a hiccup. The only rainbow of the night, made by a mistake.',
  notes:
    'Sound: a glass tink; a few soft drips and a rising glass-filling tone; a gentle glassy chord that blooms as the fan opens (one note per colour); a crisp little fan clack as it folds; a short slurp and a ping as her eye relights. ' +
    'Drawn with: a few glow drops; two quads of light on the fin\'s faces whose top edge sloshes; one polar mesh with vertex colours (additive) for the fan, re-shaped each frame (angle, reach, how white). ' +
    'Porting: the fan opens from the wall\'s far side along the robot\'s facing and is clipped to the board; on a wall at the board edge it would spill over the edge into the dark (and drip).',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  lab.playCard('a', ['m3']);
  const glowTex = maya.model.poolMat.map;
  const WARM = new THREE.Color('#fff1dc');

  // ---- the fin (the board's own wall between (3,1) and (4,1)) ----
  const fin = findFin(lab);
  const [finMesh, capMesh] = fin.children;
  const finMat0 = finMesh.material;
  const capMat0 = capMesh.material;
  const finMat = finMat0.clone();
  const capMat = capMat0.clone();
  finMesh.material = finMat;
  capMesh.material = capMat;
  const capBase = capMat.color.clone();
  const finE0 = finMat.emissiveIntensity;
  lab.cleanup(() => {
    fin.scale.set(1, 1, 1);
    finMesh.material = finMat0;
    capMesh.material = capMat0;
    finMat.dispose();
    capMat.dispose();
  });

  // ---- light inside the fin: two quads on its faces whose top edge sloshes ----
  const fillMat = new THREE.MeshBasicMaterial({ color: WARM.clone().multiplyScalar(2.6), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fills = [-1, 1].map((side) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, fillMat);
    m.frustumCulled = false;
    m.userData.z = side * 0.021;
    fin.add(m);
    return m;
  });
  lab.cleanup(() => {
    for (const m of fills) {
      fin.remove(m);
      m.geometry.dispose();
    }
    fillMat.dispose();
  });
  const setFill = (h, slosh) => {
    for (const m of fills) {
      const p = m.geometry.attributes.position.array;
      const z = m.userData.z;
      const hl = Math.max(0, Math.min(0.26, h - slosh));
      const hr = Math.max(0, Math.min(0.26, h + slosh));
      p.set([-0.48, 0.003, z, 0.48, 0.003, z, 0.48, hr, z, -0.48, hl, z]);
      m.geometry.attributes.position.needsUpdate = true;
      m.visible = h > 0.004;
    }
  };
  setFill(0, 0);

  // ---- small lights ----
  const glow = (c, size, k = 2.4) =>
    lab.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(c).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      ),
    );
  const tink = glow('#ffffff', 0.34, 3);
  tink.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(-0.03, 0.17, 0));
  const drops = Array.from({ length: 5 }, () => glow('#fff1dc', 0.24, 3));
  const finFlare = glow('#fff1dc', 1.1, 1.4);
  finFlare.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(0, 0.14, 0));
  const relight = glow('#fff1dc', 0.5, 2.4);
  const lights = [tink, ...drops, finFlare, relight];

  // ---- the fan: a polar mesh on the glass, opening from the fin's far side ----
  const NA = 48;
  const NR = 16;
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NA + 1) * (NR + 1) * 3), 3));
  fanGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((NA + 1) * (NR + 1) * 3), 3));
  const fidx = [];
  for (let j = 0; j < NA; j++)
    for (let i = 0; i < NR; i++) {
      const a = j * (NR + 1) + i;
      const b = (j + 1) * (NR + 1) + i;
      fidx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  fanGeo.setIndex(fidx);
  const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  fan.frustumCulled = false;
  fan.renderOrder = 4;
  lab.add(fan);
  const O = lab.pos(3.5, 1).add(new THREE.Vector3(0.03, 0.012, 0)); // the far face of the fin
  const hues = Array.from({ length: NA + 1 }, (_, j) => new THREE.Color().setHSL(0.0 + 0.78 * (j / NA), 0.9, 0.55).lerp(WARM, 0.12)); // red (far) to violet (near us)
  const c = new THREE.Color();
  /** reach R (spaces), half-angle A (rad), gain, white (0 colours, 1 recombined), wobble time */
  const setFan = (R, A, gain, white, tt) => {
    const pos = fanGeo.attributes.position.array;
    const col = fanGeo.attributes.color.array;
    const conc = Math.min(3, 0.6 / Math.max(0.02, A)) ** 0.7; // folding concentrates the light
    for (let j = 0; j <= NA; j++) {
      const f = j / NA;
      const a = A * (2 * f - 1);
      const edge = Math.sin(Math.PI * f) ** 1.4; // soft sides
      for (let i = 0; i <= NR; i++) {
        const q = i / NR;
        const rr = R * q * (1 + 0.02 * Math.sin(a * 6 + tt * 2.3) * q); // a liquid, slightly wavy front
        pos.set([O.x + rr * Math.cos(a), O.y, O.z + rr * Math.sin(a)], (j * (NR + 1) + i) * 3);
        const sep = Math.min(1, (rr / 1.1) ** 0.8) * (1 - white); // white at the fin, colours part as they travel
        c.copy(WARM).lerp(hues[j], sep);
        const near = Math.min(1, q / 0.08); // fades in from the fin
        const body = (1 - q ** 2.6) * (1 - 0.3 * q); // falls off with distance, soft at the front
        const lip = 0.2 * Math.exp(-(((q - 0.9) / 0.08) ** 2)); // the spill's slightly brighter lip
        const k = gain * edge * near * (body + lip) * conc * 0.62;
        col.set([c.r * k, c.g * k, c.b * k], (j * (NR + 1) + i) * 3);
      }
    }
    fanGeo.attributes.position.needsUpdate = true;
    fanGeo.attributes.color.needsUpdate = true;
    fan.visible = gain > 0.001 && R > 0.01;
  };
  setFan(0, 0.1, 0, 0, 0);

  // her card hangs over her on a soft spring
  const card = { p: null, v: new THREE.Vector3(), t: null };
  const fx = { eye: 1 };
  const eyeMesh = maya.model.body.children.find((o) => o.isMesh && o.material === maya.model.eyeMat);
  const eyeW = new THREE.Vector3();
  maya.each = (m, t) => {
    if (bot.card) {
      const want = bot.card.position.clone();
      if (!card.p) card.p = want.clone();
      const dt = card.t == null ? 0 : Math.min(0.05, t - card.t);
      card.t = t;
      const W = 12;
      const acc = want.clone().sub(card.p).multiplyScalar(W * W).addScaledVector(card.v, -2 * 0.35 * W);
      card.v.addScaledVector(acc, dt);
      card.p.addScaledVector(card.v, dt);
      bot.card.position.set(card.p.x, want.y, card.p.z);
    }
    m.eyeMat.color.setRGB(3.2 * fx.eye, 3.1 * fx.eye, 2.9 * fx.eye);
    eyeMesh?.getWorldPosition(eyeW);
    for (const l of lights) l.quaternion.copy(lab.camera3.quaternion);
  };

  const T = {
    run: 0.1,
    hit: 0.52, // nose meets the fin: tink
    pour: 0.55, // her light spills out of her eye...
    fill: 0.6, // ...and fills the fin
    full: 0.86,
    gulp: 0.9, // the full fin gulps
    spill: 0.98, // and the spectrum floods out of the far side
    held: 1.4,
    fold: 1.68, // it folds shut like a hand fan
    line: 1.86, // one white line
    slurp: 1.92, // slurped back through the fin
    home: 2.08, // into her eye: it blinks back on
    end: 2.34,
  };
  const A = 0.42;
  const run = (k) => (k < A ? (k * k) / (2 * A) : A / 2 + (k - A)) / (1 - A / 2);
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const RMAX = 2.95; // to the board's far edge
  const AMAX = 0.5; // half-angle of the open fan (stays on the glass)
  const finTop = lab.pos(3.5, 1);

  await lab.tween(T.end, (_, kk) => {
    const t = kk * T.end;
    const pose = { x: 3, y: 1, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    for (const l of lights) l.material.opacity = 0;
    fx.eye = 1;

    if (t < T.run) {
      const e = ease.out(t / T.run);
      Object.assign(pose, { x: 1 - 0.05 * e, pitch: -0.1 * e });
    } else if (t < T.hit) {
      const k = seg(t, T.run, T.hit);
      Object.assign(pose, { x: 0.95 + 2.05 * run(k), pitch: -0.1 + 0.18 * Math.min(1, k * 2) });
    } else {
      // stopped dead: tink, squash, a little nose-dive
      const u = t - T.hit;
      tink.material.opacity = 0.8 * (u < 0.025 ? u / 0.025 : Math.max(0, 1 - (u - 0.025) / 0.14) ** 2);
      const sq = Math.exp(-u / 0.05) * Math.cos(u * 40);
      const rock = 0.14 * Math.exp(-u / 0.08) * Math.sin(u * 22 + 0.3);
      Object.assign(pose, { sz: 1 - 0.12 * sq, sx: 1 + 0.05 * sq, pitch: rock, lift: Math.max(0, rock) * 0.12 });
    }

    // ---- her eye light keeps going: it spills out of her in heavy drops and pours into the fin ----
    const drain = ease.inOut(seg(t, T.pour, T.full - 0.04));
    if (t >= T.pour && t < T.home) fx.eye = Math.max(0.04, 1 - 1.1 * drain);
    drops.forEach((d, i) => {
      const k = seg(t, T.pour + i * 0.045, T.pour + i * 0.045 + 0.16);
      if (k <= 0 || k >= 1) return;
      // from her eye, forward and down into the fin (a short heavy arc)
      const to = finTop.clone().add(new THREE.Vector3(-0.03, 0.06 + 0.05 * (1 - i / 5), (i - 2) * 0.08));
      d.position.copy(eyeW).lerp(to, k);
      d.position.y += 0.07 * Math.sin(k * Math.PI) - 0.02 * k * k;
      d.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - k * 0.3);
      d.scale.set(1 - 0.25 * k, 1 + 0.6 * Math.sin(k * Math.PI), 1); // stretched as it falls
    });

    // ---- the fin fills like a glass, sloshing, then gulps; it empties as the light floods out ----
    const fill = ease.out(seg(t, T.fill, T.full)) * (1 - ease.in(seg(t, T.spill, T.spill + 0.3)));
    const sl = t - T.fill;
    const slosh = sl > 0 ? 0.05 * Math.exp(-sl / 0.18) * Math.sin(sl * 26) : 0;
    setFill(0.27 * fill, slosh * fill);
    const g = seg(t, T.gulp, T.spill + 0.06);
    const gulp = Math.sin(g * Math.PI) * (g > 0 && g < 1 ? 1 : 0);
    const retk = seg(t, T.slurp + 0.1, T.home + 0.04); // the line arriving back in the fin
    fin.scale.set(1 + 0.03 * gulp, 1 + 0.12 * gulp + 0.06 * Math.sin(retk * Math.PI), 1 + 1.6 * gulp);
    finMat.emissiveIntensity = finE0 + 0.5 * fill + 0.8 * gulp;
    capMat.color.copy(capBase).multiplyScalar(1 + 0.8 * fill + 2.2 * gulp + 1.8 * Math.sin(retk * Math.PI));
    finFlare.material.opacity = 0.6 * gulp + 0.25 * fill + 0.5 * Math.sin(retk * Math.PI);

    // ---- the spectrum: floods out like a spill, holds and breathes, folds shut, is slurped home ----
    if (t >= T.spill && t < T.home) {
      const sp = seg(t, T.spill, T.held);
      let R = RMAX * (1 - (1 - sp) ** 3.2); // fast, then viscous: it slows to a stop
      let Ang = 0.12 + (AMAX - 0.12) * ease.out3(seg(t, T.spill + 0.03, T.held));
      const breathe = 1 + 0.06 * Math.sin((t - T.held) * 9) * seg(t, T.held, T.held + 0.1) * (1 - seg(t, T.fold - 0.05, T.fold));
      let gain = Math.min(1, sp * 5) * breathe;
      let white = 0;
      const fk = seg(t, T.fold, T.line);
      if (fk > 0) {
        // folds like a hand fan: slow to start, then snaps, with a little clack (rebound) at the end
        const close = ease.in3(fk);
        Ang = AMAX - (AMAX - 0.012) * close;
        const cl = seg(t, T.line, T.slurp);
        Ang += 0.05 * Math.sin(cl * Math.PI) * (1 - cl);
        white = ease.in(fk);
      }
      if (t >= T.line) white = 1;
      const rk = seg(t, T.slurp, T.home);
      if (rk > 0) {
        R *= 1 - ease.in3(rk); // slurped back, faster and faster
        gain *= 1 + 0.6 * rk;
      }
      setFan(R, Ang, gain, white, t);
    } else setFan(0, 0.1, 0, 0, t);

    // ---- home: the light pours back into her eye, which blinks on with a hiccup ----
    if (t >= T.home) {
      const u = t - T.home;
      fx.eye = u < 0.04 ? 0.05 + 2.45 * (u / 0.04) : 1 + 1.5 * Math.exp(-(u - 0.04) / 0.09); // on, a flare, settles
      relight.position.copy(eyeW);
      relight.material.opacity = Math.min(1, u / 0.03) * Math.exp(-u / 0.09);
      const hic = Math.exp(-u / 0.07) * Math.sin(Math.min(u * 30, Math.PI)); // a little hop
      Object.assign(pose, { lift: 0.07 * Math.max(0, hic), sy: 1 + 0.08 * hic, sx: 1 - 0.03 * hic, sz: 1 - 0.03 * hic });
    }
    maya.set(pose);
  }, ease.linear);

  setFan(0, 0.1, 0, 0, 0);
  setFill(0, 0);
  fin.scale.set(1, 1, 1);
  finMat.emissiveIntensity = finE0;
  capMat.color.copy(capBase);
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}

function findFin(lab) {
  const want = lab.pos(3.5, 1);
  let best = null;
  let bd = Infinity;
  for (const o of lab.arena.board.children) {
    if (!o.isGroup || o.children.length !== 2) continue;
    const g = o.children[0].geometry?.parameters;
    if (!g || Math.abs(g.height - 0.26) > 1e-6) continue;
    const d = Math.hypot(o.position.x - want.x, o.position.z - want.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
