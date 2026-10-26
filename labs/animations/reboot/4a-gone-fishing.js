// Reboot, idea 26 "Theo goes fishing", animator a (weight & physical comedy).
// Theo winds up (leans right back) and flicks: his laser leaves the muzzle as a slack, sagging line with a bead
// of light on the end. It's a real rope here (simulated, with gravity): it sails in a lazy arc over the token,
// lands on the glass and slithers over the west edge, and the bead drops into the dark and bobs. A tug yanks
// the bead down and nearly yanks Theo off his feet. He braces, leans back and hauls: Maya comes up the side of
// the slab nose-first on the end of the line, catches on the lip, and with one big heave she flies out of the
// dark like a fish out of water, sails over the glass and lands on the token facing east. She flops twice,
// eye dimming grey each time (the 2 SPAM); the line unhooks and zips back into his muzzle, and Theo looks
// away as if nothing happened.
export const meta = {
  title: 'Gone fishing',
  idea: 'Theo leans back and casts: his laser leaves the muzzle as a slack, sagging line (a real rope, with gravity) with a bead of light on the end. It drapes over the token and slithers off the west edge; the bead bobs in the dark. A tug nearly pulls Theo off his feet; he braces and hauls Maya up the side of the slab nose-first, then heaves her out of the dark like a fish: she sails over the glass, lands on the token facing east and flops twice, her eye dimming grey with each flop (the 2 SPAM). The line zips back into his muzzle and Theo glances away, whistling.',
  notes: 'Sound: a soft whip-whoosh for the cast, a little "plip" as the bead drops off the edge, a reel ratchet (glassy ticks) while he hauls, a "whoop" for the heave, a wet glass slap on landing and two smaller slaps for the flops, a quick zip as the line retracts. Port: the nearest robot to the token fishes, whichever way it faces (the cast arcs toward the token whatever its heading); the line is a 40-node Verlet rope drawn as two tubes. Only light and poses move: Theo never leaves his space or changes facing.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const W = arena.course.w;
  const H = arena.course.h;
  const HX = W / 2;
  const HZ = H / 2;
  const BLUE = lab.bot('b').color;
  const RED = new THREE.Color(lab.bot('a').color);
  const WEST = facing(3);
  const EAST = facing(1);
  const BOT_SCALE = 1.3;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const toSpace = (v) => ({ x: v.x + HX - 0.5, y: v.z + HZ - 0.5 });
  const TOK = lab.pos(3, 1);

  // ---------- poses in world space, worked out from a pose (the puppets apply theirs after this frame) ----------
  const eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const pointOn = (pose, local) => {
    eul.set(-(pose.pitch ?? 0), pose.rot, -(pose.roll ?? 0), 'YXZ');
    const at = lab.pos(pose.x, pose.y);
    return local.clone().multiplyScalar(BOT_SCALE).applyEuler(eul).add(new THREE.Vector3(at.x, pose.lift ?? 0, at.z));
  };
  const MUZZLE = new THREE.Vector3(0, 0.1, -0.33); // the Prism's muzzle
  const NOSE = new THREE.Vector3(0, 0.12, -0.3); // where Maya is hooked

  // ---------- the line: a Verlet rope ----------
  const N = 40;
  const P = Array.from({ length: N }, () => new THREE.Vector3());
  const O = Array.from({ length: N }, () => new THREE.Vector3());
  let rest = 0.01; // total length
  let endPinned = null; // a Vector3 the last node follows, or null (free, heavy bead)
  let lineOn = false;
  let zip = 0; // 0..1: how much of the line has retracted into the muzzle
  const G = 7.5;
  const onBoard = (p) => Math.abs(p.x) < HX && Math.abs(p.z) < HZ;
  const resetRope = (at) => {
    for (let i = 0; i < N; i++) {
      P[i].copy(at);
      O[i].copy(at);
    }
  };
  const stepRope = (dt, muzzle) => {
    const sub = 4;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let i = 1; i < N; i++) {
        const vx = (P[i].x - O[i].x) * 0.985;
        const vy = (P[i].y - O[i].y) * 0.985;
        const vz = (P[i].z - O[i].z) * 0.985;
        O[i].copy(P[i]);
        P[i].x += vx;
        P[i].y += vy - G * h * h;
        P[i].z += vz;
      }
      P[0].copy(muzzle);
      if (endPinned) P[N - 1].copy(endPinned);
      const seg = rest / (N - 1);
      for (let it = 0; it < 14; it++) {
        for (let i = 0; i < N - 1; i++) {
          const a = P[i];
          const b = P[i + 1];
          const wa = i === 0 ? 0 : 1;
          const wb = i + 1 === N - 1 ? (endPinned ? 0 : 0.35) : 1; // the bead is heavier
          if (wa + wb === 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dy, dz) || 1e-6;
          if (len <= seg) continue; // a rope only pulls
          const k = (len - seg) / len / (wa + wb);
          a.x += dx * k * wa;
          a.y += dy * k * wa;
          a.z += dz * k * wa;
          b.x -= dx * k * wb;
          b.y -= dy * k * wb;
          b.z -= dz * k * wb;
        }
        // the glass: the line lies on it, and drapes over its edges
        for (let i = 1; i < N; i++) {
          const p = P[i];
          if (onBoard(p) && p.y < 0.012) {
            if (O[i].y >= -0.03) {
              p.y = 0.012;
              // friction on the glass
              O[i].x += (p.x - O[i].x) * 0.25;
              O[i].z += (p.z - O[i].z) * 0.25;
            } else p.x = -HX - 0.012; // came from below, beside the west face: stay outside it
          }
        }
      }
    }
  };
  // drawing: a blue glow tube with a white-hot core, rebuilt each frame from the rope
  const outerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const outer = new THREE.Mesh(new THREE.BufferGeometry(), outerMat);
  const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
  outer.frustumCulled = core.frustumCulled = false;
  outer.renderOrder = core.renderOrder = 5;
  lab.add(outer);
  lab.add(core);
  const beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), beadMat);
  const haloTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(BLUE).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.42);
  bead.add(halo);
  bead.visible = false;
  lab.add(bead);
  let beadOn = false;
  const drawRope = () => {
    outer.geometry.dispose();
    core.geometry.dispose();
    const keep = Math.max(2, Math.round((N - 1) * (1 - zip)) + 1);
    if (!lineOn || zip >= 0.999) {
      outer.visible = core.visible = false;
      bead.visible = false;
      outer.geometry = new THREE.BufferGeometry();
      core.geometry = new THREE.BufferGeometry();
      return;
    }
    const pts = P.slice(0, keep).map((p) => p.clone());
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.max(8, keep * 2);
    outer.geometry = new THREE.TubeGeometry(curve, seg, 0.022, 6, false);
    core.geometry = new THREE.TubeGeometry(curve, seg, 0.0075, 5, false);
    outer.visible = core.visible = true;
    bead.visible = beadOn;
    bead.position.copy(P[N - 1]);
  };

  // ---------- Theo ----------
  const T = { x: 5, y: 2, rot: WEST, pitch: 0, roll: 0, lift: 0 };
  let theoDrive = (t) => T; // what he does this frame
  let lastT = lab.t;
  const stopRope = lab.every((dt, t) => {
    const pose = theoDrive(t);
    theo.set(pose);
    const muzzle = pointOn(pose, MUZZLE);
    if (lineOn) stepRope(Math.max(1 / 240, dt), muzzle);
    drawRope();
    lastT = t;
  });
  void lastT;

  // ---------- 1. the cast: lean back, flick ----------
  maya.set({ visible: false, trail: false });
  await lab.tween(0.18, (e) => {
    theoDrive = () => ({ ...T, pitch: -0.34 * e, lift: 0.02 * e });
  }, ease.out);
  // the flick: forward fast, past upright; the line leaves the muzzle limp, with the bead on the end
  const launch = pointOn({ ...T, pitch: 0.2 }, MUZZLE);
  resetRope(launch);
  lineOn = true;
  beadOn = true;
  // the bead's flight: a lazy, floaty arc over the token toward the far end of the west edge
  const LAND = new THREE.Vector3(-HX - 0.15, 0, -1.72);
  const FLIGHT = 0.46;
  const tC = lab.t;
  const beadPos = new THREE.Vector3();
  endPinned = beadPos;
  const flick = lab.tween(0.16, (e, k) => {
    theoDrive = () => ({ ...T, pitch: -0.34 + 0.62 * e, lift: 0.02 * (1 - e) });
  }, ease.out3);
  const flight = lab.tween(FLIGHT, (e, k) => {
    // horizontal: fast out, easing off; vertical: up to a high apex, down onto the far edge
    const hk = ease.out(k) * 0.55 + k * 0.45;
    beadPos.lerpVectors(launch, LAND, hk);
    beadPos.y = launch.y * (1 - k) + 1.05 * 4 * k * (1 - k) + LAND.y * k;
    rest = launch.distanceTo(beadPos) * 1.12 + 0.15;
  }, ease.linear);
  await flick;
  // Theo follows through and wobbles back to upright
  const tF = lab.t;
  theoDrive = (t) => {
    const a = t - tF;
    return { ...T, pitch: 0.28 * Math.exp(-a * 7) * Math.cos(a * 16) };
  };
  await flight;
  // past the edge the bead falls free into the dark, paying out line
  endPinned = null;
  {
    // give it the velocity it had
    const v = new THREE.Vector3(-1.4, -1.2, -0.35).multiplyScalar(1 / 30);
    O[N - 1].copy(P[N - 1]).sub(v);
  }
  const L0 = rest;
  await lab.tween(0.16, (e) => {
    rest = L0 + 0.62 * e;
  }, ease.out);
  // it bobs, hanging in the dark
  await lab.wait(0.05);

  // ---------- 2. the tug ----------
  // the bead is yanked down; the line snaps taut and nearly pulls Theo off his feet
  const ropeLen = () => {
    let l = 0;
    for (let i = 0; i < N - 1; i++) l += P[i].distanceTo(P[i + 1]);
    return l;
  };
  const tug = async (depth, jolt, dur) => {
    const from = P[N - 1].clone();
    const pin = from.clone();
    endPinned = pin;
    const tT = lab.t;
    theoDrive = (t) => {
      const a = t - tT;
      return { ...T, pitch: jolt * Math.exp(-a * 9) * Math.sin(Math.min(Math.PI / 2, a * 40)) + 0.05 * Math.exp(-a * 5), x: 5 - 0.12 * (jolt / 0.42) * Math.exp(-a * 7) * Math.sin(Math.min(Math.PI, a * 26)) };
    };
    await lab.tween(dur, (e) => {
      pin.y = from.y - depth * e;
      rest = Math.min(rest, ropeLen());
    }, ease.in);
    await lab.tween(dur * 0.85, (e) => (pin.y = from.y - depth * (1 - 0.6 * e)), ease.out);
  };
  // a nibble... then the bite
  await tug(0.06, 0.08, 0.05);
  await lab.wait(0.03);
  await tug(0.34, 0.42, 0.08);

  // ---------- 3. the haul: Maya comes up the side of the slab, nose first, hooked by the nose ----------
  beadOn = false;
  const hang = P[N - 1].clone();
  // she hangs nose-up, just outside the west face, facing east toward the line
  const M = { x: toSpace(hang).x - 0.05, y: toSpace(hang).y, lift: hang.y - 0.42, rot: EAST, pitch: -1.25, roll: 0, sx: 1, sy: 1, sz: 1, visible: true, trail: false };
  maya.set(M);
  const hook = new THREE.Vector3();
  endPinned = hook;
  const mayaEach = { eye: 1, grey: 0, ring: 0, tag: false };
  const GREYC = new THREE.Color('#9aa3b0');
  const tagBase = maya.bot.tag ? maya.bot.tag.scale.clone() : null;
  maya.each = (m) => {
    const q = maya.pose;
    m.eyeMat.color.setRGB(3.2, 3.1, 2.9).lerp(new THREE.Color(0.5, 0.53, 0.58), mayaEach.grey).multiplyScalar(mayaEach.eye);
    m.ringMat.opacity = 0.9 * mayaEach.ring;
    // each flop drains her a little grey
    m.paint.emissive.copy(RED).lerp(GREYC, mayaEach.grey);
    m.paint.emissiveIntensity = 0.16 + 0.45 * mayaEach.grey;
    m.poolMat.opacity = 0.75 * Math.max(0.3, mayaEach.ring);
    if (maya.bot.tag) {
      maya.bot.tag.visible = mayaEach.tag;
      if (tagBase) maya.bot.tag.scale.set(tagBase.x / q.sx, tagBase.y / q.sy, 1);
    }
  };
  const setHook = () => hook.copy(pointOn(maya.pose, NOSE));
  // Theo braces and leans back; he strains (a fast tremble) as he hauls
  const tH = lab.t;
  theoDrive = (t) => {
    const a = t - tH;
    const lean = -0.3 * ease.out(Math.min(1, a / 0.15));
    return { ...T, pitch: lean + 0.03 * Math.sin(a * 70), roll: 0.02 * Math.sin(a * 53) };
  };
  const lipX = toSpace(new THREE.Vector3(-HX, 0, 0)).x; // the west edge, in spaces
  const yHang = M.y;
  await lab.tween(0.26, (e, k) => {
    // up the face of the slab, scraping against it, in little jerks (each pull of the reel)
    const jerk = k + 0.05 * Math.sin(k * Math.PI * 6);
    maya.set({ lift: M.lift + (0.02 - M.lift) * Math.min(1, jerk), x: lipX - 0.24, pitch: -1.25 + 0.15 * Math.sin(k * 19), roll: 0.12 * Math.sin(k * 13) });
    setHook();
    rest = ropeLen() * 0.995;
  }, ease.in);
  // ---------- the heave: out of the dark like a fish, over the glass, onto the token ----------
  const tY = lab.t;
  theoDrive = (t) => {
    const a = t - tY;
    // a big heave back, then he rocks forward and settles (still on his space, still facing west)
    return { ...T, pitch: -0.46 * Math.sin(Math.min(1, a / 0.14) * Math.PI / 2) * Math.exp(-Math.max(0, a - 0.14) * 4) + 0.12 * Math.max(0, Math.sin((a - 0.3) * 9)) * Math.exp(-Math.max(0, a - 0.3) * 5), lift: 0.03 * Math.exp(-a * 6) };
  };
  const A = { x: lipX - 0.24, y: yHang, lift: 0.02 };
  const B = { x: 3, y: 1, lift: 0 };
  const ARC = 0.44;
  await lab.tween(ARC, (e, k) => {
    // a ballistic arc (linear across, parabolic up), turning from nose-up to level, a little sideways spin
    const x = A.x + (B.x - A.x) * k;
    const y = A.y + (B.y - A.y) * k;
    const lift = A.lift * (1 - k) + 1.15 * 4 * k * (1 - k);
    const pitch = -1.25 * (1 - ease.inOut(k)) + 0.35 * Math.sin(k * Math.PI) * k;
    maya.set({ x, y, lift, pitch, roll: 0.5 * Math.sin(k * Math.PI * 2) * (1 - k), rot: EAST + 0.25 * Math.sin(k * Math.PI) , trail: false });
    setHook();
    // the line goes slack behind her as she flies toward him
    rest = pointOn(theoDrive(lab.t), MUZZLE).distanceTo(hook) * (1.02 + 0.25 * k);
  }, ease.linear);

  // ---------- 4. landed: splat, flop, flop ----------
  // unhook: the line zips back into his muzzle
  endPinned = null;
  lab.tween(0.3, (e) => (zip = e), ease.in).then(() => (lineOn = false));
  const flop = async (dir, hop, dur) => {
    const t0 = lab.t;
    await lab.tween(dur, (e, k) => {
      const lift = hop * 4 * k * (1 - k);
      // a fish's flop: it arches and flips over onto the other side
      const roll = dir * 0.75 * Math.sin(k * Math.PI);
      const pitch = -0.3 * Math.sin(k * Math.PI * 2);
      maya.set({ lift, roll, pitch, rot: EAST + dir * 0.18 * Math.sin(k * Math.PI), sy: 1 + 0.12 * Math.sin(k * Math.PI), sx: 1, sz: 1 });
      // her eye dims grey with each flop
      mayaEach.grey = Math.sin(Math.min(1, k * 1.2) * Math.PI);
      mayaEach.eye = 1 - 0.75 * mayaEach.grey;
    }, ease.linear);
    // slap: squash on the glass
    const t1 = lab.t;
    await lab.tween(0.09, () => {
      const a = lab.t - t1;
      const sq = Math.exp(-a * 30);
      maya.set({ lift: 0, roll: 0, pitch: 0, rot: EAST, sy: 1 - 0.28 * sq, sx: 1 + 0.16 * sq, sz: 1 + 0.16 * sq });
    }, ease.linear);
    void t0;
  };
  // land
  maya.set({ trail: true });
  {
    const t1 = lab.t;
    await lab.tween(0.1, () => {
      const a = lab.t - t1;
      const sq = Math.exp(-a * 22);
      maya.set({ x: 3, y: 1, lift: 0, pitch: 0, roll: 0, rot: EAST, sy: 1 - 0.38 * sq, sx: 1 + 0.2 * sq, sz: 1 + 0.2 * sq });
    }, ease.linear);
  }
  mayaEach.ring = 1;
  await flop(1, 0.2, 0.18);
  // Theo, line home, looks away as if nothing happened
  const tG = lab.t;
  theoDrive = (t) => {
    const a = t - tG;
    const glance = a < 0.1 ? ease.out(a / 0.1) : a < 0.28 ? 1 : Math.max(0, 1 - ease.inOut(Math.min(1, (a - 0.28) / 0.15)));
    return { ...T, rot: WEST - 0.42 * glance, pitch: 0 };
  };
  await flop(-1, 0.13, 0.15);
  mayaEach.grey = 0;
  mayaEach.eye = 1;
  maya.set({ sx: 1, sy: 1, sz: 1, roll: 0, pitch: 0, lift: 0, rot: EAST });
  mayaEach.tag = true;
  await lab.wait(0.12);
  stopRope();
  lineOn = false;
  drawRope();
  theo.set({ ...T });
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1, on: true });
  theo.release({ x: 5, y: 2, d: 3 });
  void TOK;
}
