// Long exposure, staged as a photo finish: the shutter opens, the camera cranes overhead and the whole race
// develops on the glass like a long-exposure photograph, then it fades oldest part first.
export const meta = {
  title: 'Photo finish',
  idea:
    'Maya slows into flag 2 like a photo finish; on contact the column flashes red and the room\'s light drains away as the camera cranes straight overhead. A soft shutter flash, and every trail of the game races back onto the glass in half a second, each in its player\'s colour: Maya\'s clean line through flag 1, Theo\'s loop-the-loops and dead ends, Jun\'s wander that stops dead at the edge and picks up again at a reboot ring. The slab\'s rim brightens like the border of a print and the picture hangs for a breath, then fades oldest first while the camera comes home, Maya\'s last two spaces going out last.',
  notes:
    'Sound: a soft camera-shutter tick made of glass (a chime with a short click), then a rising whoosh as the trails race in, silence for the hold, and a long airy decay as it fades. Port: keep a log of every robot\'s moves (grid steps, spins as loops, falls as a break that resumes at the reboot token); here the history is invented. The crane is the only big camera move, so it reads as "this is the photo of the whole game".',
};

const RED = '#ff4d6d';
const BLUE = '#4dabf7';
const GOLD = '#ffd43b';

export default async function play(lab) {
  const { THREE, ease } = lab;
  const A = lab.arena;
  const maya = lab.puppet('a');
  const theo = lab.puppet('b');
  const jun = lab.puppet('c');
  const W = (x, y) => lab.pos(x, y);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // ---------- the history, as strands of points on the glass ----------
  // ops: [x, y] straight to that space; { loop: r, side } a spin drawn as a little loop;
  // { edge: [x, y] } drive to a point and stop dead there; { cut: [x, y] } start again there (reboot)
  function history(ops, lane) {
    const strands = [];
    let cur = [];
    let last = null;
    let dir = new THREE.Vector2(1, 0);
    const marks = [];
    const push = (x, z) => cur.push({ x, z });
    const lineTo = (p) => {
      if (!last) {
        push(p.x, p.z);
        last = p;
        return;
      }
      const dx = p.x - last.x;
      const dz = p.z - last.z;
      const L = Math.hypot(dx, dz);
      const n = Math.max(1, Math.ceil(L / 0.04));
      for (let i = 1; i <= n; i++) push(last.x + (dx * i) / n, last.z + (dz * i) / n);
      dir.set(dx / L, dz / L);
      last = p;
    };
    for (const op of ops) {
      if (Array.isArray(op)) lineTo(W(op[0], op[1]));
      else if (op.loop) {
        const s = op.side ?? 1;
        const perp = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(s * op.loop);
        const c = { x: last.x + perp.x, z: last.z + perp.y };
        const a0 = Math.atan2(last.z - c.z, last.x - c.x);
        const turns = op.turns ?? 1;
        const N = 40 * turns;
        for (let i = 1; i <= N; i++) {
          const a = a0 + (s * Math.PI * 2 * turns * i) / N;
          // a slightly drifting spiral, so stacked loops read as loops
          const r = op.loop * (1 + 0.12 * Math.sin((i / N) * Math.PI));
          push(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
        }
      } else if (op.edge) {
        lineTo(W(op.edge[0], op.edge[1]));
        marks.push({ kind: 'drop', at: last.clone() });
      } else if (op.cut) {
        strands.push(cur);
        cur = [];
        last = null;
        const p = W(op.cut[0], op.cut[1]);
        marks.push({ kind: 'reboot', at: p });
        lineTo(p);
      }
    }
    strands.push(cur);
    // lane offset, so robots that shared a road draw parallel strands
    for (const st of strands) {
      for (let i = 0; i < st.length; i++) {
        const q = st[Math.min(st.length - 1, i + 1)];
        const o = st[Math.max(0, i - 1)];
        const dx = q.x - o.x;
        const dz = q.z - o.z;
        const L = Math.hypot(dx, dz) || 1;
        st[i].ox = st[i].x - (dz / L) * lane;
        st[i].oz = st[i].z + (dx / L) * lane;
      }
    }
    // u: how far through this robot's game (for the race in); s: length so far
    let total = 0;
    for (const st of strands) for (let i = 0; i < st.length; i++) {
      if (i > 0) total += Math.hypot(st[i].x - st[i - 1].x, st[i].z - st[i - 1].z);
      st[i].s = total;
    }
    for (const st of strands) for (const p of st) p.u = p.s / total;
    return { strands, marks, total };
  }

  const hist = {
    // Maya: a clean line from her start through flag 1 (1,3) to here
    a: history([[0, 2], [1, 2], [1, 3], [2, 3], [2, 1], [4, 1]], 0),
    // Theo: loops, a dead end, back again
    b: history([[6, 0], [6, 1], { loop: 0.24, side: 1 }, [5, 1], [5, 2], { loop: 0.2, side: -1, turns: 2 }, [3, 2], [3, 3], [2, 3], [3, 3], [6, 3], { loop: 0.22, side: 1 }, [5, 3]], 0.085),
    // Jun: wanders, drives off the north edge, reboots and wanders back
    c: history([[0, 3], [0, 2], [2, 2], [2, 0], [4, 0], { edge: [4, -0.46] }, { cut: [0, 1] }, [0, 0], [1, 0]], -0.085),
  };
  // fade order (g): the whole game is 0..1, Maya's last two spaces fade after everything else
  for (const [key, h] of Object.entries(hist)) {
    for (const st of h.strands) for (const p of st) {
      if (key === 'a') p.g = p.s < h.total - 2 ? (p.s / (h.total - 2)) * 0.92 : 1.0 + ((p.s - (h.total - 2)) / 2) * 0.35;
      else p.g = p.u * 0.92;
    }
  }

  // ---------- ribbons of light ----------
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
  const ribbons = [];
  function ribbon(st, color, width, gain, y) {
    const n = st.length;
    const pos = new Float32Array(n * 6);
    const col = new Float32Array(n * 6);
    const idx = [];
    for (let i = 0; i < n; i++) {
      const q = st[Math.min(n - 1, i + 1)];
      const o = st[Math.max(0, i - 1)];
      let dx = q.ox - o.ox;
      let dz = q.oz - o.oz;
      const L = Math.hypot(dx, dz) || 1;
      dx /= L;
      dz /= L;
      const p = st[i];
      pos.set([p.ox - dz * width, y, p.oz + dx * width, p.ox + dz * width, y, p.oz - dx * width], i * 6);
      if (i < n - 1) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    lab.add(mesh);
    const c = new THREE.Color(color);
    const r = { st, mesh, col, c, gain };
    ribbons.push(r);
    return r;
  }
  const heads = [];
  for (const [key, color] of [['a', RED], ['b', BLUE], ['c', GOLD]]) {
    for (const st of hist[key].strands) {
      ribbon(st, color, 0.085, 0.085, 0.011); // soft halo
      ribbon(st, color, 0.02, 1.05, 0.013); // the bright core
      const head = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.5).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      head.rotation.x = -Math.PI / 2;
      head.position.y = 0.02;
      head.renderOrder = 4;
      lab.add(head);
      heads.push({ st, head });
    }
  }
  // marks: where Jun's line stopped dead (a small burst) and the reboot ring where it picked up again
  const markMats = [];
  for (const m of hist.c.marks) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(m.kind === 'drop' ? GOLD : '#9cc8ff').multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const geo = m.kind === 'drop' ? new THREE.RingGeometry(0.0, 0.07, 24) : new THREE.RingGeometry(0.17, 0.2, 40);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(m.at.x, 0.014, m.at.z);
    lab.add(mesh);
    markMats.push({ mat, u: m.kind === 'drop' ? 0.62 : 0.66, mesh, kind: m.kind });
  }
  // where the strands sit in u (the race-in) for the marks
  {
    const st0 = hist.c.strands[0];
    markMats[0].u = st0[st0.length - 1].u;
    markMats[1].u = hist.c.strands[1][0].u;
  }

  const state = { r: 0, f: -0.2, show: 0 };
  const paint = () => {
    for (const rb of ribbons) {
      const { st, col, c, gain } = rb;
      for (let i = 0; i < st.length; i++) {
        const p = st[i];
        const rev = clamp((state.r - p.u) / 0.015 + 1);
        const tip = Math.exp(-(((state.r - p.u) / 0.035) ** 2)) * (state.r < 1 ? 1.6 : 0);
        const fade = clamp((p.g - state.f) / 0.14);
        const k = gain * rev * fade * state.show * (1 + tip);
        col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
      }
      rb.mesh.geometry.attributes.color.needsUpdate = true;
    }
    for (const h of heads) {
      const st = h.st;
      const u0 = st[0].u;
      const u1 = st[st.length - 1].u;
      const on = state.r > u0 && state.r < u1 + 0.02 && state.r < 1;
      h.head.material.opacity = on ? 1 : 0;
      if (on) {
        let j = 0;
        while (j < st.length - 1 && st[j].u < state.r) j++;
        h.head.position.set(st[j].ox, 0.02, st[j].oz);
      }
    }
    for (const m of markMats) {
      const rev = clamp((state.r - m.u) / 0.02 + 1);
      const fade = clamp((0.62 - state.f) / 0.14);
      m.mat.opacity = rev * fade * state.show * (m.kind === 'drop' ? 1 : 0.8);
    }
  };
  const stopPaint = lab.every(paint);

  // ---------- the room: shared things we change (undone in cleanup) ----------
  const slabs = [];
  A.board.traverse((o) => {
    if (o.isMesh && Array.isArray(o.material) && o.geometry.type === 'BoxGeometry') slabs.push(o.material[0]);
  });
  const edge0 = slabs[0]?.emissiveIntensity ?? 0.32;
  const setRoom = (k) => {
    // k: 0 the game's room, 1 the darkroom of the exposure
    room.k = k;
    A.dim = A.dimCur = 0.92 * k;
    for (const m of new Set(slabs)) m.emissiveIntensity = edge0 + k * 1.1;
  };
  const room = { k: 0 };
  // the other columns sink into the dark too (runs after the arena sets their light each frame)
  const stopCols = lab.every(() => {
    for (const c of A.columns) if (c.n !== 2) c.mat.color.multiplyScalar(1 - 0.85 * room.k);
  });
  lab.cleanup(() => {
    A.dim = A.dimCur = 0;
    for (const m of new Set(slabs)) m.emissiveIntensity = edge0;
  });

  // ---------- the camera ----------
  const cam = { k: 0, push: 0 };
  const releaseCam = lab.camera((home) => {
    const el = home.el + (1.3 - home.el) * cam.k;
    const dist = home.dist * (1 - 0.06 * cam.k) * (1 - 0.05 * cam.push);
    const target = home.target.clone().add(new THREE.Vector3(0, 0, -0.15 * cam.k));
    return { el, dist, target };
  });

  // ---------- 1. the move, slowing into the line like a photo finish ----------
  lab.playCard('a', ['m2']);
  await lab.wait(0.12);
  lab.at(0.42, () => lab.slowmo(0.28, 0.12));
  await lab.tween(0.6, (e) => maya.set({ x: 2 + 2 * e }), ease.inOut);
  // contact: the shutter
  const col2 = A.columns.find((c) => c.n === 2);
  if (col2) {
    col2.flash = A.time;
    col2.flashColor = new THREE.Color(RED);
  }
  lab.slowmo(1, 0.12);
  lab.flash('#fff6ea', 0.22, 0.3);
  A.clearCards();
  lab.ring(W(4, 1), RED, 0.8, 0.02, 0.45);

  // ---------- 2. the room drains, the camera cranes overhead ----------
  await lab.tween(0.72, (e) => {
    cam.k = e;
    setRoom(e);
  }, ease.inOut);

  // ---------- 3. a shutter flash, and the whole race develops in half a second ----------
  lab.flash('#ffffff', 0.18, 0.22);
  state.show = 1;
  await lab.tween(0.55, (e) => (state.r = e), ease.inOut);
  state.r = 1.01;
  // each robot's light answers as its line arrives home
  const flare = { k: 1 };
  const glowRing = (p, color) => {
    p.each = (m) => {
      m.ringMat.opacity = 0.9 + flare.k * 0.1;
      m.ringMat.color.set(color).multiplyScalar(1.6 + flare.k * 2.5);
      m.poolMat.opacity = 0.45 + flare.k * 0.5;
    };
  };
  glowRing(maya, RED);
  glowRing(theo, BLUE);
  glowRing(jun, GOLD);
  lab.tween(0.7, (e) => (flare.k = 1 - e), ease.out);

  // ---------- 4. the photograph hangs for a breath (Theo glances back at his loops) ----------
  lab.tween(1.4, (e) => (cam.push = e), ease.inOut);
  await lab.wait(0.4);
  await lab.tween(0.3, (e) => theo.set({ rot: lab.facing(3) - 0.75 * e }), ease.inOut);
  await lab.wait(0.3);
  await lab.tween(0.3, (e) => theo.set({ rot: lab.facing(3) - 0.75 * (1 - e) }), ease.inOut);
  await lab.wait(0.1);

  // ---------- 5. it fades oldest part first, the room comes back, the camera comes home ----------
  const fadeDur = 1.45;
  lab.tween(fadeDur, (e) => (state.f = -0.2 + 1.55 * e), ease.inOut);
  await lab.tween(fadeDur, (e) => {
    cam.k = 1 - e;
    cam.push = 1 - e;
    setRoom(1 - e);
  }, ease.inOut);
  state.show = 0;
  stopPaint();
  for (const h of heads) h.head.visible = false;
  releaseCam();
  setRoom(0);
  stopCols();
  maya.each = theo.each = jun.each = null;
  maya.release({ x: 4, y: 1, d: 1 });
  theo.release({ x: 5, y: 3, d: 3 });
  jun.release({ x: 1, y: 0, d: 2 });
}
