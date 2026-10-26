// Pusher 4a: The drawer (idea 17), through the lens of weight and physical comedy.
export const meta = {
  title: 'Till drawer, tablecloth trick',
  idea:
    'There is no plate. The slot under the panel glows, the latch goes chk, and the tile Maya stands on turns out to be a spring-loaded till drawer of smoked glass: it shoots out of the wall with her on it, she rocks back with the jolt, then lurches forward as it hits its stop with a bright DING that rings through her ring of light like a bell. She sits there, served. A tiny tug... then the drawer is yanked back into the wall in three frames. She hangs in the air for a frame where the tray was, drops its thickness onto the glass with a plink, and rocks on the spot, still facing east: the tablecloth trick.',
  notes:
    'Sound: a soft latch "chk", a smooth glass roll, a bright till "ding!" at the stop, a held breath, a "fwip" as it whips back, a tiny "plink" as she lands, and a wobbly glassy "wub-wub-wub" as she rocks. Porting: the tray is one thin box whose length grows out of the wall slot, with lines of light (the compartment around her and a divider) that move with it so it reads as a sliding drawer, not a stretching one. Works for any panel direction: the drawer always slides out of the panel\'s wall.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const EAST = lab.facing(1);
  const pusher = arena.pushers.get('3,1');
  const plate = pusher.plate;
  pusher.kick = null;
  const housing = plate.parent;
  // there is no plate: hide it for the moment
  plate.visible = false;
  lab.cleanup(() => (plate.visible = true));

  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const LIGHT = lab.PALETTE.light;

  // ---------- timeline (scene seconds) ----------
  const T = {
    glow: 0.1, // the slot glows, the latch lifts the tray
    stop: 0.66, // the drawer hits its stop: DING
    out: 0.8, // settled out
    tug: 1.02, // a tiny tug forward (the magician's anticipation)
    whip: 1.1, // yanked back
    whipEnd: 1.2,
    land: 1.23,
    end: 1.62,
  };
  const BACK = -0.95; // the wall slot
  const FRONT0 = -0.04; // the tray's front edge when it is her tile
  const FRONT1 = 0.96; // one space out
  const TOP = 0.04; // tray thickness

  // the drawer's front edge over time (before the whip)
  function front(t) {
    if (t < T.glow) return FRONT0;
    if (t < T.stop) {
      // spring-loaded: fast out of the latch, still moving when it hits the stop
      const x = seg(t, T.glow, T.stop);
      const f = 0.72 * x * (2 - x) + 0.28 * x;
      return lerp(FRONT0, FRONT1 + 0.035, f);
    }
    // hits the stop, rebounds a little, settles
    const d = t - T.stop;
    let f = FRONT1 + 0.035 * Math.cos(d * Math.PI * 2 * 4.5) * Math.exp(-d * 14);
    // the tug: a hair forward, then...
    f += 0.018 * Math.sin(seg(t, T.tug, T.whip) * Math.PI * 0.5) * (t < T.whip ? 1 : 0);
    return f;
  }

  // her lean and slip on the tray, from the drawer's acceleration (a damped spring, simulated once)
  const DT = 1 / 600;
  const N = Math.ceil(T.whip / DT) + 2;
  const rollTab = new Float32Array(N);
  const slipTab = new Float32Array(N);
  {
    let th = 0, w = 0, sl = 0, sv = 0, vPrev = 0;
    const om = Math.PI * 2 * 3.4;
    const om2 = Math.PI * 2 * 2.6;
    for (let i = 0; i < N; i++) {
      const t = i * DT;
      const v = (front(t + DT) - front(t)) / DT;
      const acc = Math.max(-300, Math.min(300, (v - vPrev) / DT));
      vPrev = v;
      w += (-om * om * th - 2 * 0.2 * om * w - acc * 0.01) * DT;
      th += w * DT;
      sv += (-om2 * om2 * sl - 2 * 0.45 * om2 * sv - acc * 0.01) * DT;
      sl += sv * DT;
      rollTab[i] = th;
      slipTab[i] = sl;
    }
    const norm = (arr, to) => {
      let m = 0;
      for (const v of arr) m = Math.max(m, Math.abs(v));
      for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] / (m || 1)) * to;
    };
    norm(rollTab, 0.2);
    norm(slipTab, 0.045);
  }
  const tab = (arr, t) => {
    const f = Math.max(0, Math.min(N - 1.001, t / DT));
    const i = Math.floor(f);
    return lerp(arr[i], arr[i + 1], f - i);
  };

  // ---------- the drawer ----------
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x141920, roughness: 0.1, metalness: 0, emissive: hdr(LIGHT, 1), emissiveIntensity: 0.16, transparent: true, opacity: 0.8 });
  const trayGeo = new THREE.BoxGeometry(0.9, TOP, 1);
  trayGeo.translate(0, -TOP / 2, 0.5);
  const tray = lab.add(new THREE.Mesh(trayGeo, trayMat));
  tray.receiveShadow = true;
  const lineMat = (k) => new THREE.MeshBasicMaterial({ color: hdr(LIGHT, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const bar = (w, h, d, mat) => {
    const g = new THREE.BoxGeometry(w, h, d);
    return lab.add(new THREE.Mesh(g, mat));
  };
  const lipMat = lineMat(2.4);
  const lip = bar(0.92, 0.014, 0.016, lipMat); // the bright front edge, the drawer's handle
  const railMat = lineMat(1.9);
  const railGeo = new THREE.BoxGeometry(0.01, 0.01, 1);
  railGeo.translate(0, 0, 0.5);
  const rails = [-0.45, 0.45].map((x) => {
    const m = lab.add(new THREE.Mesh(railGeo, railMat));
    m.position.x = x;
    return m;
  });
  // the compartment around her and the divider behind it: they ride with the drawer
  const compMat = lineMat(1.0);
  const comp = new THREE.Group();
  for (const [w, d, x, z] of [[0.78, 0.008, 0, -0.39], [0.78, 0.008, 0, 0.39], [0.008, 0.78, -0.39, 0], [0.008, 0.78, 0.39, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), compMat);
    m.position.set(x, 0, z);
    comp.add(m);
  }
  lab.add(comp);
  const divider = bar(0.88, 0.006, 0.01, lineMat(1.1));
  const cupMat = lineMat(0.8);
  const cupGeo = new THREE.BoxGeometry(0.006, 0.004, 1);
  cupGeo.translate(0, 0, 0.5);
  const cups = [-0.22, 0, 0.22].map((x) => {
    const m = lab.add(new THREE.Mesh(cupGeo, cupMat));
    m.position.x = x;
    return m;
  });
  // the slot in the wall
  const slotMat = lineMat(0.5);
  const slot = bar(0.9, 0.012, 0.02, slotMat);
  slot.position.set(0, 0.006, BACK + 0.04);
  // the whip's motion smear
  const smearMat = new THREE.MeshBasicMaterial({ color: hdr(LIGHT, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const smearGeo = new THREE.PlaneGeometry(0.9, 1);
  smearGeo.rotateX(-Math.PI / 2);
  smearGeo.translate(0, 0, 0.5);
  const smear = lab.add(new THREE.Mesh(smearGeo, smearMat));

  function placeDrawer(fr, top, show) {
    const len = Math.max(0.001, fr - BACK);
    tray.visible = show;
    tray.position.set(0, top, BACK);
    tray.scale.z = len;
    lip.visible = show;
    lip.position.set(0, top - 0.004, fr);
    for (const r of rails) {
      r.visible = show;
      r.position.set(r.position.x, top + 0.001, BACK);
      r.scale.z = len;
    }
    comp.visible = show && fr - 0.46 > BACK + 0.3;
    comp.position.set(0, top + 0.002, fr - 0.46);
    const dz = fr - 0.93;
    divider.visible = show && dz > BACK + 0.03;
    divider.position.set(0, top + 0.002, dz);
    const c0 = Math.max(BACK + 0.02, fr - 1.84);
    for (const c of cups) {
      c.visible = show && dz - c0 > 0.04;
      c.position.set(c.position.x, top + 0.002, c0);
      c.scale.z = Math.max(0.001, dz - c0 - 0.02);
    }
  }

  // ---------- her parts ----------
  const bodyK = { sx: 1, sy: 1, sz: 1, eye: 1 };
  maya.each = (m) => {
    m.body.scale.set(bodyK.sx, bodyK.sy, bodyK.sz);
    if (bodyK.eye !== 1) m.eyeMat.color.multiplyScalar(bodyK.eye);
    m.ringMat.color.set(maya.bot.color).multiplyScalar(1.6).lerp(hdr(LIGHT, 3), ding);
  };

  // ---------- run ----------
  const T0 = lab.t;
  let dinged = false;
  let landed = false;
  let prevFront = FRONT1;
  let yHold = 2;
  let ding = 0;
  const stop = lab.every(() => {
    const t = lab.t - T0;
    let y = 1;
    let lift = 0;
    let roll = 0;
    let rot = EAST;
    let squash = 0;

    // the slot glows before anything moves, and flares when the drawer is swallowed
    const preGlow = ease.out(seg(t, 0, T.glow));
    const swallow = t > T.whipEnd ? Math.exp(-(t - T.whipEnd) * 7) : 0;
    slotMat.color.copy(hdr(LIGHT, 0.4 + 2.2 * preGlow * (t < T.out ? 1 : 0.4) + 3 * swallow));
    slot.visible = t < T.end - 0.15 || swallow > 0.05;

    if (t < T.whip) {
      // unlatch: the tray rises out of the glass with a little pop, carrying her
      const up = t < T.glow ? ease.outBack(seg(t, 0.02, T.glow)) : 1;
      const top = TOP * up;
      const fr = front(t);
      placeDrawer(fr, top, true);
      lipMat.color.copy(hdr(LIGHT, 1.2 + 1.4 * preGlow));
      railMat.color.copy(hdr(LIGHT, 0.6 + 1.0 * preGlow));
      compMat.color.copy(hdr(LIGHT, 0.3 + 0.8 * preGlow));
      y = 1 + (fr - FRONT0) + tab(slipTab, t);
      lift = top;
      roll = tab(rollTab, t);
      prevFront = fr;
      yHold = y;
      if (t >= T.stop && !dinged) {
        dinged = true;
        arena.emit?.('push');
      }
      if (dinged) {
        // DING: the lip and the rails flare and her ring of light rings like a bell
        const fl = Math.exp(-(t - T.stop) * 8);
        lipMat.color.copy(hdr(LIGHT, 2.4 + 5 * fl));
        railMat.color.copy(hdr(LIGHT, 1.9 + 3 * fl));
        compMat.color.copy(hdr(LIGHT, 1.1 + 2.5 * fl));
        ding = fl;
      }
    } else {
      ding = 0;
      // the whip: three frames back into the wall
      const kw = seg(t, T.whip, T.whipEnd);
      const fr = lerp(prevFront, BACK, ease.in(kw));
      const gone = kw >= 1;
      placeDrawer(fr, TOP, !gone);
      railMat.color.copy(hdr(LIGHT, 1.6));
      lipMat.color.copy(hdr(LIGHT, 2.6));
      // a smear of light where it just was
      smear.position.set(0, TOP + 0.004, fr);
      smear.scale.z = Math.max(0.001, (FRONT1 + 0.02 - fr) * 0.95);
      smearMat.opacity = kw < 1 ? 0.22 * (1 - kw * 0.3) : 0.22 * Math.max(0, 1 - (t - T.whipEnd) / 0.08);
      smear.visible = smearMat.opacity > 0.01;
      // she hangs in the air where the tray was for a frame, then drops its thickness: plink
      y = lerp(yHold, 2, ease.out(seg(t, T.whip, T.whipEnd + 0.04))); // the tray's drag pulls her back onto her space
      const kd = seg(t, T.whipEnd - 0.02, T.land);
      lift = TOP * (1 - kd * kd);
      if (t >= T.land && !landed) {
        landed = true;
        lab.ring(lab.pos(3, 2), LIGHT, 0.36, 0.015, 0.4);
        lab.shake(0.008, 0.1);
      }
      // the yank drags her base north, so her top tips south (right), then she rocks it out
      const d = Math.max(0, t - T.whip);
      const settle = seg(t, T.end - 0.12, T.end);
      roll = (0.2 * Math.sin(d * Math.PI * 2 * 3.1) * Math.exp(-d * 5.5) + 0.06 * Math.exp(-d * 30)) * (1 - settle);
      rot = EAST + 0.13 * Math.sin(d * Math.PI * 2 * 2.3) * Math.exp(-d * 6) * (1 - settle);
      const dl = Math.max(0, t - T.land);
      squash = t >= T.land ? 0.16 * Math.sin(dl * Math.PI * 2 * 5) * Math.exp(-dl * 9) : 0;
    }

    maya.set({ y, lift, roll, rot, trail: false });
    bodyK.sy = 1 - squash;
    bodyK.sx = 1 + squash * 0.5;
    bodyK.sz = 1 + squash * 0.5;
  });

  await lab.wait(T.end);
  stop();
  for (const o of [tray, lip, divider, comp, slot, smear, ...rails, ...cups]) o.visible = false;
  ding = 0;
  plate.visible = true;
  maya.each = null;
  maya.model.body.scale.set(1, 1, 1);
  maya.model.ringMat.color.set(maya.bot.color).multiplyScalar(1.6);
  maya.set({ y: 2, lift: 0, roll: 0, rot: EAST });
  maya.release({ x: 3, y: 2, d: 1 });
  void housing;
}
