// Reboot, idea 26 through a character-acting lens: Theo the angler. A proper wind-up and cast, a patient wait,
// a double-take when the bead dips, a strike, and a lot of leaning back to reel. Maya dangles from her nose in
// limp, dignified embarrassment, flops twice like a landed fish, and then gives him a look; he glances away and
// pretends none of it happened.
export const meta = {
  title: 'Theo goes fishing (and pretends he didn\'t)',
  idea: 'Theo leans back and flicks his laser out as a slack line of light that sails in a long arc over the token and drops off the west edge, a little bead bobbing at its end. He waits, leaning in. The bead dips; he jolts (double-take), it dips again, and he strikes, leaning back and cranking. Maya comes up out of the dark hanging by her nose, swings over the edge and sways across the glass, limp and mortified, and drops onto the token facing east. She flops twice like a fish, her eye greying each time (the 2 SPAM). The line zips home. She turns and glares at him; he glances the other way, as if nothing happened.',
  notes: 'Sound: a soft glassy whip for the cast, a high thin "zzz" of line paying out, a tiny plip as the bead hits the dark, two bubbly "bloop" dips, a ratchet-click reel (glass beads), a wet slap per flop with a dull grey tick, a quick "zip" back into the muzzle. The only time a line of light curves in Lumen. Whoever is nearest to the token does the fishing, from wherever they stand; the line drops off the edge nearest to where she fell.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const BLUE = new THREE.Color('#4dabf7');
  const RED = new THREE.Color('#ff4d6d');
  const GREY = new THREE.Color('#9aa3ae');
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const onBoard = (p) => Math.abs(p.x) < W / 2 - 0.02 && Math.abs(p.z) < H / 2 - 0.02;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const track = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (ease[e ?? 'inOut'] ?? ease.inOut)(k);
      }
    }
    return keys[keys.length - 1][1];
  };
  const bump = (t, t0, rise, fall) => (t < t0 - rise || t > t0 + fall ? 0 : t < t0 ? ease.out(1 - (t0 - t) / rise) : 1 - ease.inOut((t - t0) / fall));

  // ---------- the line of light ----------
  const outerMat = new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(2.2), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.0), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const outer = new THREE.Mesh(new THREE.BufferGeometry(), outerMat);
  const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
  outer.frustumCulled = core.frustumCulled = false;
  lab.add(outer);
  lab.add(core);
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: BLUE.clone().lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  bead.scale.setScalar(0.22);
  bead.visible = false;
  lab.add(bead);
  const setLine = (pts, width = 1) => {
    if (!pts || pts.length < 2) {
      outer.visible = core.visible = false;
      return;
    }
    outer.visible = core.visible = true;
    const curve = new THREE.CatmullRomCurve3(pts);
    outer.geometry.dispose();
    core.geometry.dispose();
    outer.geometry = new THREE.TubeGeometry(curve, 64, 0.024 * width, 6, false);
    core.geometry = new THREE.TubeGeometry(curve, 64, 0.0055 * width, 5, false);
  };
  // a line from a to b: plan view bends through `bend` (xz), height = straight + arc, and it lies on the glass
  // wherever it would sink into it
  const linePts = (a, b, arc, bendX, bendZ, upto = 1, n = 36, wig = 0) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * upto;
      const u = 1 - s;
      const x = u * u * a.x + 2 * u * s * bendX + s * s * b.x;
      const z = u * u * a.z + 2 * u * s * bendZ + s * s * b.z + wig * Math.sin(s * Math.PI * 3.2) * Math.sin(Math.PI * Math.min(1, s * 1.08));
      let y = a.y + (b.y - a.y) * s + arc * 4 * s * (1 - s);
      const p = new THREE.Vector3(x, y, z);
      if (onBoard(p)) y = Math.max(0.016, y);
      p.y = y;
      out.push(p);
    }
    return out;
  };

  // ---------- the actors (Theo first, so Maya's hook runs after both poses are placed) ----------
  const theo = lab.puppet('b');
  const maya = lab.puppet('a');
  const theoRot = facing(3);
  theo.set({ x: 5, y: 2, rot: theoRot, trail: false });
  maya.set({ x: -0.9, y: 1, lift: -1, rot: facing(1), visible: false, trail: false });
  const mm = maya.model;
  let eye = null;
  mm.body.traverse((o) => {
    if (o.isMesh && o.material === mm.eyeMat) eye = o;
  });
  const eyeScale0 = eye.scale.clone();
  lab.cleanup(() => eye.scale.copy(eyeScale0));

  const B = lab.pos(-0.8, 1).setY(-0.3); // where the bead hangs, just past the west edge
  const tokW = lab.pos(3, 1);
  const muzzleOf = (p) => {
    p.group.updateWorldMatrix(true, true);
    return new THREE.Vector3().setFromMatrixPosition(p.model.muzzle.matrixWorld);
  };

  // ---------- timeline ----------
  const CAST = 0.2; // the flick
  const LAND = 0.56; // the bead drops into the dark
  const DIP1 = 0.84;
  const DIP2 = 0.98; // strike
  const R0 = 1.04; // reeling
  const R1 = 1.78; // she is over the token
  const DROP = 1.86; // she's on the glass
  const FLOP1 = 1.98;
  const FLOP2 = 2.24;
  const ZIP0 = 1.86;
  const ZIP1 = 2.0;
  const END = 2.86;
  const st = { t: 0, mayaEye: 1, mayaOpen: 1, mayaGrey: 0, theoEye: 1 };

  // where Maya is while she's on the line (base position, lift, and how she hangs)
  const mayaOnLine = (t) => {
    const k = clamp01((t - R0) / (R1 - R0));
    // up out of the dark and over the edge (first 30%), then across the glass, swaying
    const up = clamp01(k / 0.32);
    const across = clamp01((k - 0.22) / 0.78);
    const x = -0.95 + 0.55 * ease.out(up) + (3 - -0.4) * ease.inOut(across);
    const lift = -0.75 + 1.22 * ease.out(up) - 0.06 * Math.sin(across * Math.PI);
    const sway = Math.sin(k * Math.PI * 3.2) * (1 - 0.6 * k);
    return { x: x + 0.12 * sway * across, y: 1 + 0.05 * sway, lift, pitch: -1.2 + 0.12 * sway, roll: 0.22 * sway, rot: facing(1) + 0.35 * Math.sin(k * Math.PI * 2.1 + 0.4) };
  };

  theo.each = (m) => {
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(st.theoEye);
  };
  maya.each = (m) => {
    const t = st.t;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(GREY.clone().multiplyScalar(0.9), st.mayaGrey).multiplyScalar(st.mayaEye);
    eye.scale.set(eyeScale0.x * Math.max(0.06, st.mayaOpen), eyeScale0.y, eyeScale0.z);
    m.paint.emissive.copy(RED).lerp(GREY, 0.7 * st.mayaGrey);
    m.paint.emissiveIntensity = 0.16 + 0.45 * st.mayaGrey;

    // the line, from Theo's muzzle to wherever its end is now
    const M = muzzleOf(theo);
    bead.visible = false;
    if (t < CAST) return setLine(null);
    if (t < LAND) {
      // the cast: the end sails out on a high arc and the line unrolls behind it
      const k = ease.out((t - CAST) / (LAND - CAST));
      setLine(linePts(M, B, 1.15, 2.6, 0.75, k), 0.9);
      const tip = linePts(M, B, 1.15, 2.6, 0.75, k, 1)[1];
      bead.visible = true;
      bead.position.copy(tip);
      return;
    }
    if (t < DIP2) {
      // slack: the line settles down onto the glass, the bead bobs in the dark past the edge
      const settle = ease.out(clamp01((t - LAND) / 0.2));
      const bob = 0.025 * Math.sin((t - LAND) * 13) * (1 - settle * 0.5);
      const dip = 0.11 * bump(t, DIP1 + 0.03, 0.03, 0.08);
      const b = B.clone().add(new THREE.Vector3(0, bob - dip - 0.05 * settle, 0));
      setLine(linePts(M, b, 1.15 * (1 - settle) - 0.35 * settle, 2.6 - 0.9 * settle, 0.75 + 0.35 * settle, 1, 36, 0.16 * settle * (1 - 0.6 * dip / 0.11)), 0.9);
      bead.visible = true;
      bead.position.copy(b);
      return;
    }
    if (t < ZIP0) {
      // taut: on the strike, then while reeling her in by the nose
      const tip = t < R0 ? B.clone().add(new THREE.Vector3(0, -0.16 * bump(t, DIP2 + 0.02, 0.02, 0.06), 0)) : muzzleOf(maya);
      const taut = ease.out(clamp01((t - DIP2) / 0.06));
      const mid = M.clone().lerp(tip, 0.5);
      setLine(linePts(M, tip, -0.35 * (1 - taut) + 0.25 * taut, mid.x * taut + 1.7 * (1 - taut), mid.z * taut + 1.1 * (1 - taut)), 1);
      bead.visible = t < R0 + 0.12;
      bead.position.copy(tip);
      bead.material.opacity = 1 - clamp01((t - R0) / 0.12);
      return;
    }
    if (t < ZIP1) {
      // let go: the line zips back into his muzzle
      const k = ease.in((t - ZIP0) / (ZIP1 - ZIP0));
      const tip = muzzleOf(maya).lerp(M, k);
      setLine(linePts(M, tip, 0.18 * (1 - k), (M.x + tip.x) / 2, (M.z + tip.z) / 2), 1 - 0.5 * k);
      return;
    }
    setLine(null);
  };

  const T0 = lab.t;
  const camRelease = lab.camera((home, t) => {
    const k = track(t - T0, [[0.1, 0], [0.6, 1, 'inOut'], [1.1, 1], [1.8, 0, 'inOut']]);
    return { target: home.target.clone().add(new THREE.Vector3(-0.4 * k, 0, 0)) };
  });

  const update = () => {
    const t = lab.t - T0;
    st.t = t;

    // ----- Theo, the angler -----
    // wind-up (lean back), flick (forward), follow-through
    let tPitch = track(t, [[0, 0], [CAST - 0.02, -0.3, 'inOut'], [CAST + 0.08, 0.26, 'out'], [LAND, 0.1, 'inOut'], [LAND + 0.12, 0.08, 'inOut']]);
    let tsy = track(t, [[0, 1], [CAST - 0.02, 1.08, 'inOut'], [CAST + 0.06, 0.92, 'out'], [LAND, 1, 'inOut']]);
    let tLift = 0;
    let tRot = 0;
    // the wait: leaning in, watching the bead; the first dip yanks him forward and he jolts (the double-take)
    tPitch += 0.06 * track(t, [[LAND + 0.1, 0], [DIP1, 1]]);
    tPitch += 0.14 * bump(t, DIP1 + 0.03, 0.02, 0.06);
    tLift += 0.06 * bump(t, DIP1 + 0.09, 0.03, 0.09);
    tsy *= 1 + 0.1 * bump(t, DIP1 + 0.09, 0.03, 0.09);
    st.theoEye = 1 + 0.9 * track(t, [[DIP1 + 0.05, 0], [DIP1 + 0.08, 1], [1.5, 1], [1.7, 0]]);
    // the strike, and reeling: leaning right back, cranking in little rhythmic heaves
    if (t >= DIP2) {
      const reel = track(t, [[DIP2, 0], [DIP2 + 0.06, 1, 'out'], [R1, 1], [DROP + 0.1, 0, 'inOut']]);
      const crank = t < R1 ? Math.sin((t - DIP2) * Math.PI * 2 * 5.5) : 0;
      tPitch = tPitch * (1 - reel) + reel * (-0.32 + 0.07 * crank);
      tsy *= 1 - 0.06 * reel + 0.04 * crank * reel;
    }
    // the glance away: she looks at him, he looks anywhere else (to his left, south), then back to business
    tRot += track(t, [[2.47, 0], [2.53, 0.6, 'out'], [2.7, 0.6], [END - 0.03, 0, 'inOut']]) + 0.06 * Math.sin((t - 2.53) * 22) * track(t, [[2.53, 0], [2.58, 1], [2.68, 1], [2.72, 0]]);
    tPitch += track(t, [[2.47, 0], [2.53, -0.12, 'out'], [2.7, -0.12], [END - 0.03, 0, 'inOut']]);
    theo.set({ pitch: tPitch, sy: tsy, sx: 1 / Math.sqrt(tsy), sz: 1 / Math.sqrt(tsy), lift: tLift, rot: theoRot + tRot });

    // ----- Maya -----
    if (t < R0) {
      maya.set({ visible: false });
    } else if (t < DROP) {
      const p = mayaOnLine(t);
      if (t > R1) {
        // let go: she drops flat onto the token
        const k = ease.in(clamp01((t - R1) / (DROP - R1)));
        const q = mayaOnLine(R1);
        maya.set({ visible: true, x: q.x + (3 - q.x) * k, y: q.y + (1 - q.y) * k, lift: q.lift * (1 - k), pitch: q.pitch * (1 - k), roll: q.roll * (1 - k), rot: q.rot + (facing(1) - q.rot) * k });
      } else maya.set({ visible: true, ...p });
      // limp and mortified: eye half-shut
      st.mayaOpen = 0.35;
      st.mayaEye = 0.7;
    } else {
      const s = t - DROP;
      // the landing squash, then two fish flops, the second smaller
      let sy = track(s, [[0, 0.72], [0.08, 1.05, 'out'], [0.12, 1, 'inOut']]);
      let lift = 0;
      let roll = 0;
      let rot = facing(1);
      let pitch = 0;
      const f1 = clamp01((t - FLOP1) / 0.2);
      const f2 = clamp01((t - FLOP2) / 0.17);
      if (t > FLOP1 && f1 < 1) {
        lift += 0.24 * Math.sin(f1 * Math.PI);
        roll += 1.3 * Math.sin(f1 * Math.PI);
        pitch -= 0.35 * Math.sin(f1 * Math.PI * 2);
        rot += 0.25 * Math.sin(f1 * Math.PI);
        sy *= 1 - 0.1 * Math.sin(f1 * Math.PI * 2);
      }
      if (t > FLOP2 && f2 < 1) {
        lift += 0.14 * Math.sin(f2 * Math.PI);
        roll -= 1.0 * Math.sin(f2 * Math.PI);
        pitch += 0.25 * Math.sin(f2 * Math.PI * 2);
        rot -= 0.18 * Math.sin(f2 * Math.PI);
      }
      sy *= 1 - 0.25 * bump(t, FLOP1 + 0.2, 0.02, 0.09) - 0.18 * bump(t, FLOP2 + 0.17, 0.02, 0.09);
      // the glare: she turns toward Theo (south-east), eye narrowed; then a huff and nose east again
      rot += track(t, [[2.36, 0], [2.46, -0.5, 'out'], [2.68, -0.5], [2.82, 0, 'inOut']]);
      pitch += track(t, [[2.36, 0], [2.46, 0.12, 'out'], [2.68, 0.12], [2.82, 0, 'inOut']]);
      sy *= 1 - 0.05 * bump(t, 2.72, 0.04, 0.1);
      maya.set({ visible: true, x: 3, y: 1, lift, roll, pitch, sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy), rot });
      st.mayaGrey = Math.max(bump(t, FLOP1 + 0.08, 0.03, 0.18), bump(t, FLOP2 + 0.07, 0.03, 0.18));
      st.mayaEye = 1;
      st.mayaOpen = track(t, [[DROP, 0.35], [FLOP1, 0.35], [FLOP1 + 0.04, 1.2, 'out'], [FLOP1 + 0.2, 0.6], [FLOP2 + 0.04, 1.2, 'out'], [FLOP2 + 0.2, 1], [2.38, 1], [2.46, 0.4, 'inOut'], [2.7, 0.4], [2.8, 1, 'inOut']]);
    }
  };
  const stop = lab.every(update);
  update();
  await lab.wait(1.75);
  camRelease();
  await lab.wait(END - 1.75);
  stop();

  setLine(null);
  bead.visible = false;
  maya.each = null;
  theo.each = null;
  eye.scale.copy(eyeScale0);
  maya.set({ x: 3, y: 1, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: facing(1), visible: true });
  theo.set({ x: 5, y: 2, lift: 0, sx: 1, sy: 1, sz: 1, pitch: 0, roll: 0, rot: theoRot });
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
  void tokW;
}
