// Belt, idea 5 (The Koi), animator c: cinematic staging.
export const meta = {
  title: 'The Koi (the deep glass)',
  idea:
    'Once in a while the room\'s lights sink and the camera leans over the board to look down into the slab, as if someone noticed something under the glass. A long, soft shape made of the belt\'s own light, two spaces long, glides up the stream inside the glass, blurred and deep. The chevrons part over its back. It rises under Maya and carries her along with a gentle bob. At the bend the world slows, its tail sweeps under her, and she swings round to face east, the swing left behind as a long-exposure arc of light. Then it slips away down the south leg, faster and fainter, into the stream, and the lights come back as if nothing happened.',
  notes:
    'Sound: the room\'s hum drops a little, a low, slow glassy "whoom" as it passes under the board, a gentle water-glass bob under her, a soft bright swish for the tail, and the belt\'s normal chime returning. Its glow is drawn about 0.12 below the glass with real parallax as the camera moves: it renders in the opaque pass with additive blending, after the glass and before Maya, so the belt\'s chevrons sit over it and Maya rides on top. Rare: it does not appear on every ride, so every belt ride might be the one.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);

  const maya = lab.puppet('a');
  const blue = new THREE.Color(lab.PALETTE.express);
  const express = arena.belts.filter((b) => b.fast);
  const key0 = arena.key.intensity;
  const hemi0 = arena.hemi.intensity;
  // Maya draws after the koi's deep glow (so she rides on top of it)
  const order0 = [];
  maya.group.traverse((o) => {
    if (o.isMesh && !o.material.transparent) {
      order0.push([o, o.renderOrder]);
      o.renderOrder = 1;
    }
  });
  const restore = () => {
    for (const [o, r] of order0) o.renderOrder = r;
    arena.key.intensity = key0;
    arena.hemi.intensity = hemi0;
    lab.timeScale = 1;
  };
  lab.cleanup(restore);

  // ---- the koi's path (spaces): east along row 1, a soft bend at the corner, then south ----
  const R = 0.35;
  const A0 = 3 - R; // where the bend starts
  const A1 = A0 + (Math.PI / 2) * R; // where it ends
  const path = (s) => {
    if (s <= A0) return { x: s, y: 1, tx: 1, ty: 0 };
    if (s <= A1) {
      const a = -Math.PI / 2 + (s - A0) / R; // around the centre (A0, 1 + R)
      return { x: A0 + R * Math.cos(a), y: 1 + R + R * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
    }
    return { x: 3, y: 1 + R + (s - A1), tx: 0, ty: 1 };
  };
  const LK = 2.0; // two spaces long

  // ---- textures: the body glow, the dark that parts the chevrons, the light on its back ----
  const canvasTex = (draw) => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    draw(cv.getContext('2d'));
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  };
  // head at u = 0 (left), tail at u = 1 (right)
  const koiPath = (g, k = 1) => {
    const c = 64;
    const w = (v) => c + (v - c) * k;
    g.beginPath();
    g.moveTo(14, c);
    g.bezierCurveTo(24, w(26), 90, w(14), 170, w(18));
    g.bezierCurveTo(260, w(24), 330, w(46), 385, w(56));
    g.bezierCurveTo(410, w(52), 440, w(18), 500, w(10));
    g.bezierCurveTo(470, w(40), 468, w(56), 476, c);
    g.bezierCurveTo(468, w(72), 470, w(88), 500, w(118));
    g.bezierCurveTo(440, w(110), 410, w(76), 385, w(72));
    g.bezierCurveTo(330, w(82), 260, w(104), 170, w(110));
    g.bezierCurveTo(90, w(114), 24, w(102), 14, c);
    g.closePath();
  };
  const bodyTex = canvasTex((g) => {
    g.shadowColor = '#fff';
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.shadowBlur = 34;
    koiPath(g, 1.05);
    g.fill();
    g.shadowBlur = 16;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    koiPath(g, 0.85);
    g.fill();
    // pectoral fins
    g.shadowBlur = 12;
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(150, 64 + s * 50, 34, 12, s * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    // a brighter spine
    g.shadowBlur = 10;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(40, 64);
    g.quadraticCurveTo(250, 64, 400, 64);
    g.stroke();
  });
  const partTex = canvasTex((g) => {
    g.shadowColor = '#000';
    g.shadowBlur = 18;
    g.fillStyle = '#000';
    koiPath(g, 0.7);
    g.fill();
  });
  const backTex = canvasTex((g) => {
    // the chevrons' light pushed aside, along its flanks (front two-thirds)
    g.shadowColor = '#fff';
    g.shadowBlur = 8;
    g.lineWidth = 4;
    const grad = g.createLinearGradient(0, 0, 360, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(20, 64 + s * 30);
      g.bezierCurveTo(80, 64 + s * 56, 200, 64 + s * 58, 360, 64 + s * 40);
      g.stroke();
    }
  });

  // ---- ribbons that follow the path, with a swimming wave ----
  const N = 40;
  const ribbon = (map, mat, y, widthK) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 1) * 2 * 3);
    const col = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      uv.set([i / N, 1, i / N, 0], i * 4);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    mat.map = map;
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    lab.add(mesh);
    return { mesh, geo, pos, col, y, widthK };
  };
  const deep = ribbon(bodyTex, new THREE.MeshBasicMaterial({ color: blue.clone().multiplyScalar(2.7), blending: THREE.AdditiveBlending, transparent: false, depthTest: false, depthWrite: false }), -0.12, 1);
  deep.mesh.renderOrder = 0.5;
  const part = ribbon(partTex, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), 0.0055, 1);
  part.mesh.renderOrder = 1.05;
  const back = ribbon(backTex, new THREE.MeshBasicMaterial({ color: blue.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0.0065, 1.25);
  back.mesh.renderOrder = 1.1;
  const W = 0.78; // its width (world)

  const onBoard = (x, y) => smooth(seg(x, -0.55, -0.05)) * smooth(seg(y, 3.55, 3.05)) * smooth(seg(x, 6.55, 6.05));
  const placeRibbons = (head, t, swim, tailFlick, bright, partK) => {
    for (const r of [deep, part, back]) {
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const s = head - u * LK;
        const p = path(s);
        // the swimming wave grows toward the tail; the flick is a big sweep of the tail
        const amp = 0.035 + 0.11 * u * u;
        let off = amp * Math.sin(u * 5.5 - t * swim) * (1 - 0.6 * tailFlick);
        off += tailFlick * 0.42 * u ** 2.2 * Math.sin(tailFlick * Math.PI * 1.0);
        const nx = -p.ty;
        const ny = p.tx;
        const cx = p.x + nx * off;
        const cy = p.y + ny * off;
        const w = (W * r.widthK) / 2;
        const a = lab.pos(cx + nx * w, cy + ny * w);
        const b = lab.pos(cx - nx * w, cy - ny * w);
        r.pos.set([a.x, r.y, a.z, b.x, r.y, b.z], i * 6);
        const f = onBoard(cx, cy) * (r === part ? partK : bright);
        r.col.set([f, f, f, f, f, f], i * 6);
      }
      r.geo.attributes.position.needsUpdate = true;
      r.geo.attributes.color.needsUpdate = true;
    }
  };

  // ---- the swing, left behind as a long-exposure arc ----
  const arcMat = new THREE.MeshBasicMaterial({ color: blue.clone().lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.copy(lab.pos(3, 1)).setY(0.014);
  arc.renderOrder = 3;
  lab.add(arc);
  const setArc = (k) => {
    arc.geometry.dispose();
    // from her nose pointing north (theta 90 deg) clockwise toward east (theta 0)
    arc.geometry = new THREE.RingGeometry(0.6, 0.68, 32, 1, Math.PI / 2 - (Math.PI / 2) * k, Math.max(0.001, (Math.PI / 2) * k));
  };

  // ---- camera ----
  const cam = { dx: 0, dz: 0, dk: 1, del: 0, az: 0 };
  let frameOff = null;
  const releaseCam = lab.camera((home) => {
    const cc = arena.camCur;
    if (cc) {
      frameOff ??= { sx: cc.sx ?? 0, sy: cc.sy ?? 0 };
      const k = Math.min(0.95, arena.dt * 4);
      cc.sx = frameOff.sx / (1 - k);
      cc.sy = frameOff.sy / (1 - k);
    }
    return { target: home.target.clone().add(new THREE.Vector3(cam.dx, 0, cam.dz)), az: home.az + cam.az, el: home.el + cam.del, dist: home.dist * cam.dk };
  });

  // ---- timeline (scene seconds; the flick is in slow motion) ----
  const GLIDE = [0, 0.42]; // it glides in and rises under her
  const CARRY = [0.42, 1.1]; // carries her two spaces
  const FLICK = [1.16, 1.46]; // the tail sweeps under her at the bend
  const AWAY = [1.4, 1.98]; // slips away down the south leg, into the stream
  const END = 2.04;
  const H0 = -0.2; // where its head starts
  const H1 = 1.75; // its head when its back is under her
  const H2 = H1 + 2; // after carrying her two spaces
  const H3 = 5.0; // its tail under her at the bend
  const H4 = 8.2; // gone

  const t0 = lab.t;
  let lean = { p: 0, r: 0 };
  const stop = lab.every(() => {
    const t = lab.t - t0;
    lab.timeScale = 1 - 0.5 * seg(t, FLICK[0] - 0.04, FLICK[0] + 0.02) * (1 - seg(t, FLICK[1] - 0.06, FLICK[1]));

    // ---- where the koi is ----
    let head;
    if (t < GLIDE[1]) head = mix(H0, H1, ease.out(seg(t, GLIDE[0], GLIDE[1])));
    else if (t < CARRY[1]) head = mix(H1, H2, ease.inOut(seg(t, CARRY[0], CARRY[1])));
    else if (t < AWAY[0]) head = mix(H2, H3, seg(t, CARRY[1], AWAY[0]));
    else head = mix(H3, H4, ease.in(seg(t, AWAY[0], AWAY[1])));
    const flick = seg(t, FLICK[0], FLICK[1]);
    const tailFlick = t > FLICK[0] && t < FLICK[1] + 0.2 ? Math.sin(Math.min(1, flick) * Math.PI) : 0;
    const rise = ease.inOut(seg(t, 0.05, GLIDE[1]));
    const fade = 1 - ease.in(seg(t, AWAY[0] + 0.1, AWAY[1]));
    deep.y = mix(-0.3, -0.12, rise);
    placeRibbons(head, t, 9, tailFlick, mix(0.35, 1, rise) * fade, 0.6 * rise * fade);
    back.mesh.material.opacity = rise * fade;
    part.mesh.material.opacity = 0.6 * rise * fade;

    // ---- Maya: lifted onto its back, carried with a gentle bob, swung round by the tail ----
    let x = 1;
    let rot = facing(0);
    if (t >= CARRY[0]) x = Math.min(3, 1 + (head - H1));
    const riding = rise * (1 - ease.inOut(seg(t, FLICK[1], AWAY[0] + 0.25)));
    const bob = Math.sin(t * 7.5) * 0.5 + 0.5;
    const lift = riding * (0.02 + 0.025 * bob);
    if (t >= FLICK[0]) rot = facing(0) + (facing(1) - facing(0)) * ease.outBack(seg(t, FLICK[0] + 0.04, FLICK[1] + 0.02), 1.6);
    const sway = riding * 0.06 * Math.sin(t * 7.5 + 1.2);
    // the swing leans her outward a touch
    const swing = Math.sin(seg(t, FLICK[0], FLICK[1] + 0.1) * Math.PI) * 0.18;
    lean = { p: 0.03 * riding * Math.sin(t * 7.5), r: sway - swing };
    maya.set({ x, y: 1, rot, lift });

    // ---- the long-exposure arc of the swing ----
    const sweep = ease.outBack(seg(t, FLICK[0] + 0.04, FLICK[1] + 0.02), 1.6);
    if (t >= FLICK[0]) setArc(Math.min(1, sweep));
    arcMat.opacity = t >= FLICK[0] ? Math.min(1, seg(t, FLICK[0], FLICK[0] + 0.06)) * (1 - ease.in(seg(t, FLICK[1], FLICK[1] + 0.5))) : 0;

    // ---- the room: lights sink while it's here ----
    const dim = ease.inOut(seg(t, 0, 0.35)) * (1 - ease.inOut(seg(t, AWAY[0] + 0.1, END)));
    arena.topMat.emissiveIntensity *= 1 - 0.6 * dim;
    for (const b of express) b.mat.color.multiplyScalar(1 - 0.5 * dim);
    arena.key.intensity = key0 * (1 - 0.4 * dim);
    arena.hemi.intensity = hemi0 * (1 - 0.45 * dim);

    // ---- camera: lower, closer, looking into the slab, tracking along; then home ----
    const look = ease.inOut(seg(t, 0, 0.5)) * (1 - ease.inOut(seg(t, AWAY[0] + 0.05, END - 0.02)));
    const track = lab.pos(mix(1.6, 3, seg(x, 1, 3)), 1.3);
    cam.del = 0.13 * look; // leaning over the pond, to look down into the slab
    cam.dk = 1 - 0.16 * look;
    cam.dx = track.x * 0.5 * look;
    cam.dz = track.z * 0.5 * look;
    cam.az = 0.05 * look * Math.sin(t * 1.5);
  });

  maya.each = (model) => {
    model.body.rotation.set(-lean.p, 0, -lean.r);
  };

  await lab.wait(END);
  stop();
  maya.each = null;
  maya.model.body.rotation.set(0, 0, 0);
  restore();
  deep.mesh.visible = part.mesh.visible = back.mesh.visible = false;
  arc.visible = false;
  releaseCam();
  maya.set({ x: 3, y: 1, rot: facing(1), lift: 0 });
  maya.release({ x: 3, y: 1, d: 1 });
}
