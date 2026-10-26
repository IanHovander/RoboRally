// Pusher 2a: Overshoot, undo (idea 37), through the lens of weight and physical comedy.
export const meta = {
  title: 'Clack clack clack, rewind',
  idea:
    'BANG: the plate fires and Maya lands on her space. A held breath: it looks done. Then clack, clack, clack: the plate keeps telescoping out on a sagging arm of light and shoves her all the way to the south edge, where she tips over the dark drop and a speck of light falls a long way down. A beat. Then the board undoes it: the whole thing plays backwards like rewinding tape, her wobble un-wobbling, the arm un-clacking, her trail of light sucked back into her, until she clicks into the one space the rules allow. She glances back at the arm; it freezes, guilty, then slinks home.',
  notes:
    'Sound: a hard glass "tock" for the fire, then three rising clacks (glass rods locking), a creak at the brink, a tiny far-off tink when the speck lands; the rewind is the clacks played backwards and sped up with a reel whirr, ending in a crisp click and a sheepish two-note slide. In a real game the overshoot only runs over empty floor (up to 2 extra spaces, stopping short of any robot or wall) and ends at the brink only when an edge or pit is in reach; with no room to overshoot it is just the BANG and a guilty little extra clack in place. Everything is one function of time, so the rewind is literally the outward motion evaluated backwards.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  const EAST = lab.facing(1);
  const pusher = arena.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const plateMat = plate.material;
  const plateEm0 = plateMat.emissiveIntensity;
  const plateCol0 = plateMat.emissive.clone();
  lab.cleanup(() => {
    plateMat.emissiveIntensity = plateEm0;
    plateMat.emissive.copy(plateCol0);
    plate.position.z = 0.05;
  });

  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);

  // ---------- the timeline (scene seconds from the start of the moment) ----------
  const T = {
    fire: 0.14, // anticipation ends, BANG
    step1: 0.27, // she is on her space
    pause: 0.35, // ...it looks done
    step2: 0.47, // clack
    step3: 0.58, // clack
    brink: 0.71, // creep to the brink
    teeterEnd: 1.03, // a beat
    rewindEnd: 1.58, // reeled back up her trail
    click: 1.64,
    glance: 1.72,
    look: 1.8,
    end: 1.94,
  };
  const A_REST = 0;
  const A_SPACE = 1.0;
  const A_BRINK = 2.4; // her centre at y = 3.4: over half of her hangs above the drop
  const steps = [
    [T.fire, T.step1, A_REST - 0.035, A_SPACE, ease.out3],
    [T.pause, T.step2, A_SPACE, 1.7, ease.out3],
    [T.step2 + 0.005, T.step3, 1.7, 2.24, ease.out3],
    [T.step3 + 0.02, T.brink, 2.24, A_BRINK, ease.inOut],
  ];
  const clacks = [T.fire, T.pause, T.step2 + 0.005, T.step3 + 0.02];
  // the arm's reach on the outward "tape"
  function reach(u) {
    if (u < T.fire) return A_REST - 0.035 * ease.out(seg(u, 0, T.fire));
    let a = A_REST - 0.035;
    for (const [t0, t1, a0, a1, fn] of steps) if (u >= t0) a = lerp(a0, a1, fn(seg(u, t0, t1)));
    return a;
  }

  // her lean (inertia) on the tape: a damped spring driven by the arm's acceleration, simulated once
  const DT = 1 / 600;
  const N = Math.ceil(T.teeterEnd / DT) + 2;
  const rollTab = new Float32Array(N);
  const squashTab = new Float32Array(N);
  {
    let th = 0;
    let w = 0;
    let sq = 0;
    let sv = 0;
    let vPrev = 0;
    const om = Math.PI * 2 * 3.2;
    const om2 = Math.PI * 2 * 5;
    for (let i = 0; i < N; i++) {
      const u = i * DT;
      const v = (reach(u + DT) - reach(u)) / DT;
      const acc = Math.max(-400, Math.min(400, (v - vPrev) / DT));
      vPrev = v;
      // speeding up south: her top lags north (roll -); stopping: it carries on south (roll +)
      w += (-om * om * th - 2 * 0.22 * om * w - acc * 0.012) * DT;
      th += w * DT;
      sv += (-om2 * om2 * sq - 2 * 0.3 * om2 * sv + Math.max(0, acc) * 0.02) * DT;
      sq += sv * DT;
      rollTab[i] = th;
      squashTab[i] = sq;
    }
    let m = 0;
    for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(rollTab[i]));
    for (let i = 0; i < N; i++) rollTab[i] = (rollTab[i] / (m || 1)) * 0.3;
    let s = 0;
    for (let i = 0; i < N; i++) s = Math.max(s, Math.abs(squashTab[i]));
    for (let i = 0; i < N; i++) squashTab[i] = (squashTab[i] / (s || 1)) * 0.2;
  }
  const tab = (arr, u) => {
    const f = Math.max(0, Math.min(N - 1.001, u / DT));
    const i = Math.floor(f);
    return lerp(arr[i], arr[i + 1], f - i);
  };
  // the teeter at the brink: momentum tips her over the drop, she rocks, then holds right at the tipping point
  function teeter(u) {
    const k = seg(u, T.brink - 0.04, T.teeterEnd);
    if (k <= 0) return 0;
    const a = ease.out(seg(k, 0, 0.28)) * 0.58;
    const b = ease.inOut(seg(k, 0.28, 0.5)) * -0.26;
    const c = ease.inOut(seg(k, 0.5, 0.72)) * 0.09;
    const shiver = k > 0.6 ? Math.sin(u * 95) * 0.012 * seg(k, 0.6, 0.7) : 0;
    return a + b + c + shiver;
  }
  // the long arm sags under its own weight and rings after each clack
  function sag(u, a) {
    let v = 0.05 * clamp01((a - 1.2) / 1.2) ** 1.5;
    for (const tc of clacks) {
      if (u < tc) continue;
      const dt = u - tc;
      v += 0.035 * Math.exp(-dt * 7) * Math.sin(dt * Math.PI * 2 * 6.5) * clamp01(a / 1.2);
    }
    return v;
  }
  // the whole pose on the tape
  function poseAt(u) {
    const a = reach(u);
    const roll = tab(rollTab, u) * (u > T.brink ? Math.exp(-(u - T.brink) * 6) : 1) + teeter(u);
    const zc = Math.max(0, a); // her centre, in spaces south of where she started
    // pivoting on the board's edge lifts her a hair
    const lift = roll > 0 && zc > 2.0 ? Math.sin(roll) * 0.11 : 0;
    return { a, y: 1 + zc, roll, lift, squash: tab(squashTab, u), sag: sag(u, a) };
  }

  // ---------- the telescoping arm of light ----------
  const base = new THREE.Vector3(0, 0.16, -0.9); // the panel's face (world), x of space 3 = 0
  const NSEG = 4;
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.15, metalness: 0, emissive: hdr(lab.PALETTE.light, 1), emissiveIntensity: 0.25, transparent: true, opacity: 0.85 });
  const coreMat = new THREE.MeshBasicMaterial({ color: hdr(lab.PALETTE.light, 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = [];
  for (let i = 0; i < NSEG; i++) {
    const w = 0.15 - 0.024 * i;
    const h = 0.075 - 0.01 * i;
    const sg = new THREE.BoxGeometry(w, h, 1);
    sg.translate(0, 0, 0.5);
    const cg = new THREE.BoxGeometry(w * 0.32, h * 0.4, 1);
    cg.translate(0, h * 0.32, 0.5);
    const sleeve = lab.add(new THREE.Mesh(sg, sleeveMat));
    const core = lab.add(new THREE.Mesh(cg, coreMat.clone()));
    const collarMat = new THREE.MeshBasicMaterial({ color: hdr(lab.PALETTE.light, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const collar = lab.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.025, 0.035), collarMat));
    sleeve.visible = core.visible = collar.visible = false;
    segs.push({ sleeve, core, collar, collarMat, w, h });
  }
  const tipPoint = (a) => new THREE.Vector3(0, 0.16, -0.86 + a);
  const onArm = (a, f, s) => {
    // a point a fraction f along the arm, sagging in the middle (a parabola, 0 at both ends)
    const z = lerp(base.z, -0.86 + a, f);
    return new THREE.Vector3(0, 0.16 - s * 4 * f * (1 - f), z);
  };
  function drawArm(a, s, u, glow) {
    const len = a + 0.04;
    const show = len > 0.06;
    for (let i = 0; i < NSEG; i++) {
      const S = segs[i];
      // nested tubes: segment i runs from i/N to (i+1)/N of the reach, overlapping its neighbour a little
      const f0 = Math.max(0, i / NSEG - 0.03);
      const f1 = Math.min(1, (i + 1) / NSEG + 0.012);
      const p0 = onArm(a, f0, s);
      const p1 = onArm(a, f1, s);
      const L = p0.distanceTo(p1);
      for (const m of [S.sleeve, S.core]) {
        m.visible = show && L > 0.01;
        m.position.copy(p0);
        m.lookAt(p1);
        m.scale.set(1, 1, Math.max(0.001, L));
      }
      S.collar.visible = show && i < NSEG - 1 && len > 0.3;
      S.collar.position.copy(p1);
      S.collar.lookAt(onArm(a, Math.min(1, f1 + 0.05), s));
      // a collar flashes when its segment locks out
      const tc = clacks[Math.min(clacks.length - 1, i + 1)];
      const flash = u >= tc ? Math.exp(-(u - tc) * 10) : 0;
      S.collarMat.color.copy(hdr(lab.PALETTE.light, 1.4 + flash * 4 + glow));
      S.core.material.color.copy(hdr(lab.PALETTE.light, Math.max(0.35, 1.4 + glow * 1.4)));
    }
  }

  // ---------- specks of light that fall off the brink into the dark ----------
  const specks = [];
  const speckMat = new THREE.MeshBasicMaterial({ color: hdr('#ff8fa3', 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const m = lab.add(new THREE.Mesh(new THREE.SphereGeometry(0.022 - i * 0.004, 8, 6), speckMat));
    m.visible = false;
    specks.push({ m, t0: T.brink + 0.06 + i * 0.09, x: -0.12 + i * 0.13, landed: false });
  }

  // ---------- her parts ----------
  const body = { sx: 1, sy: 1, sz: 1, eye: 1, trailGlow: 1 };
  maya.each = (m) => {
    m.body.scale.set(body.sx, body.sy, body.sz);
    if (body.eye !== 1) m.eyeMat.color.multiplyScalar(body.eye);
    if (body.trailGlow !== 1 && bot.trailMesh) {
      const col = bot.trailMesh.geometry.attributes.color;
      for (let i = 0; i < col.array.length; i++) col.array[i] *= body.trailGlow;
      col.needsUpdate = true;
    }
  };

  // ---------- run it ----------
  const T0 = lab.t;
  let lastClack = -1;
  let clicked = false;
  let rewound = false;
  let tailZ = null;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    let u; // tape time
    let rewinding = false;
    if (t <= T.teeterEnd) u = t;
    else if (t <= T.rewindEnd) {
      // the tape runs backwards from the brink to the instant she first reached her space
      // first her wobble un-wobbles (fast), then the long reel back up the trail to her space
      const k = seg(t, T.teeterEnd, T.rewindEnd);
      const J = 0.22;
      if (k < J) u = lerp(T.teeterEnd, T.brink, ease.inOut(k / J));
      else u = lerp(T.brink, T.pause, ease.inOut((k - J) / (1 - J)));
      rewinding = true;
    } else u = T.pause;

    const P = poseAt(u);
    let { a, y, roll, lift, squash } = P;
    let s = P.sag;
    let rot = EAST;
    let glow = 0;

    // the plate: it IS the head of the arm
    plate.position.z = 0.05 + a;
    plateMat.emissive.set(lab.PALETTE.light);
    const fireGlow = t < T.fire ? ease.in(seg(t, 0, T.fire)) : Math.exp(-(t - T.fire) * 6);
    plateMat.emissiveIntensity = 0.35 + fireGlow * 1.8 + (rewinding ? 0.6 : 0);

    if (rewinding) {
      // reeled back: a mechanical shiver as the tape runs, and the arm and trail glow with the undo
      glow = -0.7; // the arm dims so the light on the glass leads
      roll += (lab.rand() - 0.5) * 0.05;
      body.trailGlow = 2.6;
    }

    if (t > T.rewindEnd) {
      // CLICK into place, then the arm slinks home under her look
      if (!clicked) {
        clicked = true;
        lab.ring(lab.pos(3, 2), '#ffffff', 0.22, 0.02, 0.22);
        arena.emit?.('click');
        lab.shake(0.012, 0.12);
      }
      const kc = seg(t, T.rewindEnd, T.click);
      // a tiny overshoot past her space and back: click
      y = 2 - 0.05 * Math.sin(kc * Math.PI);
      squash = 0.1 * Math.sin(kc * Math.PI);
      roll = -0.06 * Math.sin(kc * Math.PI) + 0.05 * Math.sin(seg(t, T.click, T.end) * Math.PI * 2) * (1 - seg(t, T.click, T.end));
      lift = 0;
      body.trailGlow = lerp(2.6, 1, seg(t, T.rewindEnd, T.end));
      // the arm: a timid start, frozen while she looks back at it, then it zips in
      const timid = 0.22 * ease.out(seg(t, T.click, T.glance));
      const zip = ease.in(seg(t, T.look + 0.02, T.end - 0.03));
      a = lerp(A_SPACE - timid, A_REST, zip);
      s = 0.012 + 0.03 * seg(t, T.click, T.glance) * (1 - zip); // it droops, embarrassed
      glow = -0.6 * (1 - zip);
      plate.position.z = 0.05 + a;
      plateMat.emissiveIntensity = lerp(0.2, 0.4, zip);
      // her glance back over her shoulder (left = toward the panel) and forward again
      const g1 = ease.out(seg(t, T.click + 0.02, T.glance + 0.04));
      const g2 = ease.inOut(seg(t, T.look, T.end - 0.02));
      rot = EAST + 0.5 * g1 * (1 - g2);
    }

    // clacks: a bump of light and a tiny shake each time a segment locks out
    for (let i = 0; i < clacks.length; i++) {
      if (!rewinding && t >= clacks[i] && lastClack < i) {
        lastClack = i;
        lab.shake(i === 0 ? 0.03 : 0.015, 0.15);
        arena.emit?.('push');
      }
    }

    drawArm(a, s, u, glow);
    maya.set({ y, roll, lift, rot, trail: !rewinding && t <= T.rewindEnd });
    body.sx = 1 - squash; // her body's x is the push axis (south)
    body.sy = 1 + squash * 0.35;
    body.sz = 1 + squash * 0.25;

    // the trail is the undo history: while rewinding, the light she left south of her is wound back into her
    if (rewinding || (t > T.rewindEnd && !rewound)) {
      const zNow = lab.pos(3, y).z;
      if (tailZ == null) tailZ = zNow;
      tailZ = Math.max(zNow, tailZ + (zNow - tailZ) * (t > T.rewindEnd ? 0.3 : 0.11));
      const tr = bot.trail;
      while (tr.length > 1 && tr[tr.length - 1].z > tailZ + 0.01) tr.pop();
      if (tr.length && tr[tr.length - 1].z < tailZ - 0.03) tr.push({ x: tr[tr.length - 1].x, z: tailZ, t: tr[tr.length - 1].t });
      if (t > T.end - 0.04) {
        while (tr.length > 1 && tr[tr.length - 1].z > zNow + 0.01) tr.pop();
        rewound = true;
      }
    }

    // specks falling off the brink, a long way down
    for (const sp of specks) {
      const dt = t - sp.t0;
      if (dt < 0 || dt > 0.75) {
        sp.m.visible = false;
        continue;
      }
      const yy = 0.0 - 4.9 * dt * dt;
      sp.m.visible = yy > -1.58;
      sp.m.position.set(sp.x, yy, 2.04 + dt * 0.12);
    }
  });

  await lab.wait(T.end);
  stop();
  for (const S of segs) S.sleeve.visible = S.core.visible = S.collar.visible = false;
  for (const sp of specks) sp.m.visible = false;
  plate.position.z = 0.05;
  plateMat.emissiveIntensity = plateEm0;
  plateMat.emissive.copy(plateCol0);
  body.sx = body.sy = body.sz = 1;
  body.trailGlow = 1;
  maya.each = null;
  maya.model.body.scale.set(1, 1, 1);
  maya.set({ y: 2, roll: 0, lift: 0, rot: EAST });
  maya.release({ x: 3, y: 2, d: 1 });
  void tipPoint;
}
