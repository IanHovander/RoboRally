// Wall, idea 3 (Rear-ended by her own trail), animator a: weight and physical comedy.
// Maya stops dead at the fin: tink. Her trail of light doesn't get the news. A heartbeat, a twitch at its far
// end, and then it does what a tape measure does when you let go: the tail end zips up the line, snaking and
// gathering itself into a bright knot as it comes, faster and faster, and slaps into her back. She's kicked into
// the fin a second time (tink... TINK), the fin flexes and rings, her eye pops. The spent trail springs off her
// back and drops in a limp tangle on the space behind her, like a dropped ribbon, and fades.
export const meta = {
  title: 'Rear-ended (tape measure)',
  idea:
    'She stops dead at the fin with a tiny tink, but her trail of light has momentum of its own. A heartbeat later its far end twitches and zips up the line like a tape measure let go, snaking and bunching into a bright knot as it speeds up, and smacks her in the back: she is kicked into the fin a second time, tink... TINK, the fin flexes and her eye pops. The spent trail springs off her and drops in a limp tangle behind her, then fades. She never leaves (3,1).',
  notes:
    'Sound: a tiny glass tink at contact; silence; a rising zip as the trail retracts (like a tape measure); a soft slap and a brighter, ringing TINK from the fin; then a little papery glass rustle as the tangle drops. ' +
    'Porting: the trail is the game\'s own ribbon (same texture, width and fade), taken over at the stop and drawn by a second ribbon mesh with more points; the move\'s path is a straight line here, a turn in the path would just bend the arc length. ' +
    'Varies with the move: a longer run means a longer trail, so a bigger knot and a harder slap; a Move 3 stopped after one space barely has a trail and gets a little pat.',
};

export default async function play(lab) {
  const { THREE, ease } = lab;
  const maya = lab.puppet('a');
  const bot = maya.bot;
  lab.playCard('a', ['m3']);
  const glowTex = maya.model.poolMat.map;
  const color = new THREE.Color(bot.color);

  // ---- the fin (the board's own wall between (3,1) and (4,1)), so it can flex ----
  const fin = findFin(lab);
  const fin0 = fin.position.clone();
  const [, capMesh] = fin.children;
  const capMat0 = capMesh.material;
  const capMat = capMat0.clone();
  capMesh.material = capMat;
  const capBase = capMat.color.clone();
  lab.cleanup(() => {
    fin.position.copy(fin0);
    fin.scale.set(1, 1, 1);
    capMesh.material = capMat0;
    capMat.dispose();
  });

  // ---- small lights ----
  const glow = (c, size, k = 2.4) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(c).multiplyScalar(k), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    return lab.add(m);
  };
  const tink = glow('#ffffff', 0.36, 3); // where her nose meets the fin
  tink.position.copy(lab.pos(3.5, 1)).add(new THREE.Vector3(-0.03, 0.17, 0));
  const knotGlow = glow(bot.color, 0.5, 2.2); // the gathered trail
  const slapGlow = glow('#ffffff', 0.7, 1.6); // the smack on her back
  const lights = [tink, knotGlow, slapGlow];

  // ---- a ribbon of light drawn like the game's trail (same texture, width and fade), with more points ----
  const N = 160;
  const rib = makeRibbon(THREE, N, bot.trailMesh.material.map);
  lab.add(rib.mesh);

  // her card hangs over her on a soft spring: it jolts when she's smacked
  const card = { p: null, v: new THREE.Vector3(), t: null };
  const fx = { eye: 1 };
  maya.each = (m, t) => {
    if (bot.card) {
      const want = bot.card.position.clone();
      if (!card.p) card.p = want.clone();
      const dt = card.t == null ? 0 : Math.min(0.05, t - card.t);
      card.t = t;
      const W = 12;
      const acc = want.clone().sub(card.p).multiplyScalar(W * W).addScaledVector(card.v, -2 * 0.3 * W);
      card.v.addScaledVector(acc, dt);
      card.p.addScaledVector(card.v, dt);
      bot.card.position.set(card.p.x, want.y, card.p.z);
    }
    m.eyeMat.color.setRGB(3.2 * fx.eye, 3.1 * fx.eye, 2.9 * fx.eye);
    for (const l of lights) l.quaternion.copy(lab.camera3.quaternion);
  };

  const T = {
    run: 0.1, // wind-up ends, flat out
    hit: 0.52, // nose meets the fin: tink
    twitch: 0.64, // the far end of the trail twitches and draws back
    zip: 0.8, // and zips up the line
    slap: 1.1, // into her back
    fade: 1.58, // the spent tangle fades
    end: 2.2,
  };
  const A = 0.42;
  const run = (k) => (k < A ? (k * k) / (2 * A) : A / 2 + (k - A)) / (1 - A / 2);
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const P0 = lab.pos(3, 1); // her middle, where she stops
  const BACK = 0.36; // her back, behind her middle (in spaces)
  const LIFE = 3.2; // the game's trail life

  let rope = null; // the trail, taken over at the stop: [{ s, t }] with s = distance back from her middle
  let L = 0;
  // the tangle it drops into: a coiled, loopy ribbon lying on the space behind her (three loose loops)
  const TC = lab.pos(2.1, 1);
  const LOOPS = 3 * Math.PI * 2;
  const tangle = (f, slump) => {
    const u = f * LOOPS;
    const R = (0.19 + 0.04 * Math.sin(u * 0.7 + 1)) * (1 - 0.2 * slump);
    return {
      x: TC.x + 0.62 * (f - 0.5) - R * Math.sin(u) * 0.9,
      z: TC.z + R * Math.cos(u) * (0.8 - 0.15 * slump) - 0.06 * Math.sin(u * 0.5),
    };
  };

  await lab.tween(T.end, (_, kk) => {
    const t = kk * T.end;
    const now = lab.arena.time;
    const pose = { x: 3, y: 1, pitch: 0, lift: 0, sx: 1, sy: 1, sz: 1 };
    fx.eye = 1;
    for (const l of lights) l.material.opacity = 0;
    fin.position.copy(fin0);
    capMat.color.copy(capBase);

    if (t < T.run) {
      // ---- 1. she means three spaces: a little wind-up, then flat out ----
      const e = ease.out(t / T.run);
      Object.assign(pose, { x: 1 - 0.05 * e, pitch: -0.1 * e });
    } else if (t < T.hit) {
      const k = seg(t, T.run, T.hit);
      Object.assign(pose, { x: 0.95 + 2.05 * run(k), pitch: -0.1 + 0.18 * Math.min(1, k * 2) });
    } else {
      // ---- 2. stopped dead: the smallest tink ----
      if (!rope) {
        // take the trail over from the game: same points, same look
        rope = bot.trail.map((p) => ({ s: P0.x - p.x, t: p.t }));
        L = Math.max(...rope.map((r) => r.s));
        maya.set({ trail: false });
        bot.trail = [];
      }
      const u = t - T.hit;
      tink.material.opacity = 0.55 * (u < 0.025 ? u / 0.025 : Math.max(0, 1 - (u - 0.025) / 0.12) ** 2);
      tink.scale.setScalar(0.7);
      const sq = Math.exp(-u / 0.04) * Math.cos(u * 45);
      Object.assign(pose, { sz: 1 - 0.08 * sq, sx: 1 + 0.04 * sq, pitch: 0.06 * Math.exp(-u / 0.06) });
    }

    if (rope) {
      // ---- 3. the trail: a heartbeat, a twitch, the zip, the knot ----
      const zk = seg(t, T.zip, T.slap);
      const zipE = zk ** 2.4; // accelerates all the way in, like a tape measure
      const sTip = L - (L - BACK) * zipE;
      const twitch = Math.sin(seg(t, T.twitch, T.zip) * Math.PI); // the far end flicks once before it goes
      const dropK = seg(t, T.slap, T.fade);
      const pullback = Math.sin(seg(t, T.twitch, T.zip) * Math.PI * 0.5) * (1 - seg(t, T.zip, T.zip + 0.08)); // draws back before it goes
      const fade = 1 - ease.inOut(seg(t, T.fade, T.end - 0.06));
      const pts = [];
      const n = rope.length;
      let gathered = 0;
      const inKnot = rope.filter((r) => r.s > sTip).length; // spread the knot's light over its points, so it stays a knot, not a flare
      const knotK = Math.min(1, 3.5 / Math.max(1, inKnot));
      for (let i = 0; i < (t < T.slap ? n : 0); i++) {
        const r = rope[i];
        const age = Math.min(1, (now - r.t) / LIFE);
        let b = Math.max(0, 1 - age) ** 1.6 * Math.min(1, i / 3) * 1.8;
        let w = 0.16 + 0.06 * (1 - age);
        let s = r.s;
        let lat = 0;
        if (t < T.slap) {
          // the far end twitches: a small sideways flick, only near the tail
          const nearTail = Math.max(0, 1 - (L - s) / 0.45);
          lat += 0.15 * twitch * nearTail * nearTail * Math.sin((L - s) * 8);
          if (s > sTip) {
            // gathered into the knot: crushed together and scribbled up, so it adds up bright
            gathered++;
            s = sTip + (s - sTip) * 0.1;
            lat += 0.07 * Math.sin(i * 1.9) * Math.min(1, zk * 3);
            b *= knotK;
          } else {
            // the line ahead of the tip snakes like a whip, more near the tip
            const near = Math.max(0, 1 - (sTip - s) / 0.7);
            lat += 0.11 * zk * near * near * Math.sin((sTip - s) * 13 - zk * 20);
          }
          s += 0.14 * pullback * nearTail; // the slingshot: it stretches back a hair first
          const pz = P0.z + lat;
          pts.push({ x: P0.x - s, z: pz, b, w });
        }
      }
      if (t >= T.slap) {
        // ---- 5. spent: it springs off her back and drops in a limp coil behind her ----
        const M = 150;
        const open = ease.outBack(Math.min(1, dropK * 1.7));
        const slump = ease.inOut(seg(dropK, 0.35, 1)); // and sags as it settles
        for (let j = 0; j < M; j++) {
          const f = j / (M - 1);
          const knot = { x: P0.x - BACK - 0.03 * Math.sin(j * 1.9), z: P0.z + 0.06 * Math.sin(j * 1.3) };
          const g = tangle(f, slump);
          const dense = Math.max(0.03, Math.min(1, open)) ** 1.5; // still bunched up: the same light over a smaller patch
          const b = Math.min(1, j / 4, (M - 1 - j) / 4) * (2.2 - 1.3 * ease.out(dropK)) * fade * dense;
          pts.push({ x: knot.x + (g.x - knot.x) * open, z: knot.z + (g.z - knot.z) * open, b, w: 0.15 - 0.04 * dropK });
        }
      }
      rib.update(pts, color);
      // the knot's own glow: it gets heavier the more it gathers
      if (t < T.slap && zk > 0) {
        const m = gathered / n;
        knotGlow.position.set(P0.x - sTip, 0.05, P0.z);
        knotGlow.scale.setScalar(0.45 + 1.3 * m);
        knotGlow.material.opacity = Math.min(1, zk * 4) * (0.4 + 0.4 * m);
      }
    }

    if (t >= T.slap) {
      // ---- 4. SMACK: kicked into the fin a second time. TINK. The fin flexes and rings; her eye pops ----
      const u = t - T.slap;
      slapGlow.position.set(P0.x - BACK, 0.12, P0.z);
      slapGlow.material.opacity = u < 0.02 ? u / 0.02 : Math.max(0, 1 - (u - 0.02) / 0.18) ** 2;
      slapGlow.scale.setScalar(0.6 + 0.6 * Math.min(1, u / 0.2));
      const v = u - 0.03; // the fin rings a frame later
      if (v > 0) {
        tink.scale.setScalar(1.25);
        tink.material.opacity = v < 0.02 ? v / 0.02 : Math.max(0, 1 - (v - 0.02) / 0.22) ** 2;
        fin.position.x = fin0.x + 0.035 * Math.exp(-v / 0.09) * Math.cos(v * 55);
        capMat.color.copy(capBase).multiplyScalar(1 + 1.8 * Math.exp(-v / 0.12));
      }
      const kick = u < 0.05 ? Math.sin((u / 0.05) * (Math.PI / 2)) : Math.exp(-(u - 0.05) / 0.09) * Math.cos((u - 0.05) * 22);
      const sq = Math.exp(-u / 0.06) * Math.cos(u * 38);
      const pitch = 0.3 * kick; // her tail kicks up, she pivots on her nose
      Object.assign(pose, {
        x: 3 + 0.03 * Math.exp(-u / 0.06),
        pitch,
        lift: Math.max(0, pitch) * 0.36,
        sz: 1 - 0.16 * sq,
        sx: 1 + 0.07 * sq,
        sy: 1 + 0.03 * sq,
      });
      fx.eye = 1 + 1.4 * Math.exp(-u / 0.12) * (u < 0.03 ? u / 0.03 : 1);
    }
    maya.set(pose);
  }, ease.linear);

  rib.mesh.visible = false;
  fin.position.copy(fin0);
  capMat.color.copy(capBase);
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}

/** A ribbon of light on the glass, built like the game's trail: points { x, z, b (brightness), w (half width) }. */
function makeRibbon(THREE, N, map) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  const uv = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return {
    mesh,
    update(pts, color) {
      const n = Math.min(N, pts.length);
      if (n < 2) return geo.setDrawRange(0, 0);
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let dx = q.x - o.x;
        let dz = q.z - o.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        const w = p.w;
        pos.set([p.x - dz * w, 0.009, p.z + dx * w, p.x + dz * w, 0.009, p.z - dx * w], i * 6);
        const k = Math.max(0, p.b);
        col.set([color.r * k, color.g * k, color.b * k, color.r * k, color.g * k, color.b * k], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
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
