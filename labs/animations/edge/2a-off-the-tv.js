// Edge, idea 2 (Off the TV), animator a: weight & physical comedy.
export const meta = {
  title: 'Off the TV',
  idea:
    'Maya never notices the board has ended: deadpan and at full speed she drives on over thin air, laying red trail on nothing, and straight out of the right side of the TV. ' +
    'For a beat the frame is empty, and the trail she left over the void is the first to feel gravity: it droops off the rim and hangs there like a dropped ribbon. ' +
    'Then she falls in from the top of the screen, right in front of the camera and huge, tumbling with her eye and ring smearing light, and out of the bottom. ' +
    'A moment later the whole picture jolts with a thud and a glow of red light spills up from below the frame: she landed on the TV, not the board.',
  notes:
    'Sound: her usual drive hum carrying on without a hitch past the rim, then nothing for the empty beat, a soft rubbery flop as the trail drapes, ' +
    'a rising whoosh past the lens, and a low thud with a glass rattle for the jolt. The board is never touched. ' +
    'The near-camera fall is placed from the camera\'s own axes, so it works from any framing; the smears are the eye and ring drawn at sub-frame steps of her pose. ' +
    'Port: it can be a running gag (she always comes in at the top on the side she left by).',
};

const PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

/** A ribbon of light like Lumen's trail: flat on the glass, turning to face the camera when it leaves it. */
function makeRibbon(lab, max) {
  const { THREE } = lab;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#555');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.7, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 6);
  const col = new Float32Array(max * 6);
  const uv = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) uv.set([0.5, 0, 0.5, 1], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  lab.add(mesh);
  const T = new THREE.Vector3();
  const V = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const sf = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    draw(pts) {
      const n = Math.min(pts.length, max);
      if (n < 2) return geo.setDrawRange(0, 0);
      const cam = lab.camera3.position;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        T.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
        V.set(cam.x - p.x, cam.y - p.y, cam.z - p.z).normalize();
        sc.crossVectors(T, V).normalize();
        sf.crossVectors(T, up);
        if (sf.lengthSq() < 1e-6) sf.copy(sc);
        else sf.normalize();
        if (sc.dot(sf) < 0) sc.negate();
        const f = p.flat ?? 1;
        sf.multiplyScalar(f).addScaledVector(sc, 1 - f).normalize();
        pos.set([p.x - sf.x * p.w, p.y - sf.y * p.w, p.z - sf.z * p.w, p.x + sf.x * p.w, p.y + sf.y * p.w, p.z + sf.z * p.w], i * 6);
        col.set([p.r, p.g, p.b, p.r, p.g, p.b], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const maya = lab.puppet('a');
  maya.set({ trail: false }); // she lays her own trail: part of it will be laid on nothing
  const RED = new THREE.Color('#ff4d6d');
  const ZM = -0.5; // her row in world z
  const RIM = 3.5; // the east rim in world x

  // ---- timeline ----
  const V = 4.8; // spaces per second, and she never slows down
  const T_ACC = 0.55;
  const X_ACC = 3.93 + 0.5 * V * (T_ACC - 0.14);
  const T_OUT = 1.42; // past the right edge of the picture
  const T_IN = 1.74; // drops in at the top
  const T_FALL = 0.6; // through the frame
  const T_THUD = T_IN + T_FALL + 0.13;
  const T_END = T_THUD + 0.3;
  const driveX = (t) => {
    if (t < 0.14) return 4 - 0.07 * ease.out(t / 0.14);
    if (t < T_ACC) return 3.93 + 0.5 * (V / (T_ACC - 0.14)) * (t - 0.14) ** 2;
    return X_ACC + V * (t - T_ACC);
  };

  // ---- the board pose (on the glass, then on thin air at glass height) ----
  function boardPose(t) {
    const P = { x: driveX(t), y: 1, lift: 0, rot: facing(1), pitch: 0, roll: 0, sy: 1 };
    if (t < 0.14) {
      const k = ease.out(t / 0.14);
      P.pitch = -0.16 * k;
      P.sy = 1 - 0.07 * k;
    } else if (t < T_ACC + 0.15) {
      const k = seg(t, 0.14, T_ACC + 0.15);
      P.pitch = -0.16 * (1 - k) ** 2;
      P.sy = 0.93 + 0.07 * Math.min(1, k * 3);
    }
    return P;
  }

  // ---- the fall through the frame, close to the lens, placed from the camera's own axes ----
  const camM = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const upv = new THREE.Vector3();
  const back = new THREE.Vector3();
  const D = 4.1; // distance from the lens
  const SX = 0.6; // across the picture: 0 centre, 1 right edge
  function fallState(t) {
    const cam = lab.camera3;
    cam.updateMatrixWorld();
    camM.copy(cam.matrixWorld);
    right.setFromMatrixColumn(camM, 0);
    upv.setFromMatrixColumn(camM, 1);
    back.setFromMatrixColumn(camM, 2);
    const halfH = D * Math.tan((cam.fov * PI) / 360);
    const halfW = halfH * cam.aspect;
    const k = t - T_IN;
    // enters with a little speed, then gravity: 1.3 half-heights above the centre to 1.4 below
    const span = 2.75 * halfH;
    const v0 = 1.6;
    const a = (2 * (span - v0 * T_FALL)) / (T_FALL * T_FALL);
    const s = v0 * k + 0.5 * a * k * k;
    const p = cam.position.clone().addScaledVector(back, -D).addScaledVector(right, SX * halfW).addScaledVector(upv, 1.3 * halfH - s);
    return {
      x: p.x + 3,
      y: p.z + 1.5,
      lift: p.y,
      // a slow tumble, as if she is still turning over from the edge
      rot: facing(1) + 0.5 + 0.9 * k,
      pitch: 0.35 + 3.2 * k,
      roll: 0.45 - 1.3 * k,
    };
  }

  // ---- her trail: laid every frame, on glass and then on nothing ----
  const laid = [];
  for (let t = 0.14; t <= T_OUT + 0.08; t += 1 / 60) laid.push({ x: driveX(t) - 3, t });
  const trail = makeRibbon(lab, laid.length + 4);
  function trailPts(t) {
    const out = [];
    // after she is gone, the part over the void flops down over the rim like a ribbon off a table
    const dt = Math.max(0, t - T_OUT - 0.04);
    const fallAng = Math.min(1.32, 0.5 * 18 * dt * dt);
    const settle = dt > 0 ? 0.1 * Math.sin(Math.max(0, dt - 0.38) * 16) * Math.exp(-4 * Math.max(0, dt - 0.38)) * (dt > 0.38 ? 1 : 0) : 0;
    // the thud jolts the hanging ribbon too
    const dj = t - T_THUD;
    const jolt = dj > 0 ? -0.22 * Math.sin(dj * 19) * Math.exp(-dj * 5) : 0;
    const ang = fallAng + settle + jolt;
    let i = 0;
    for (const s of laid) {
      if (s.t > t) break;
      const age = Math.min(1, (t - s.t) / 3.2);
      let k = Math.max(0, 1 - age) ** 1.6 * 1.8 * Math.min(1, i / 3);
      const w = 0.16 + 0.06 * (1 - age);
      let x = s.x;
      let y = 0.008;
      let flat = 1;
      const d = s.x - RIM;
      if (d > 0) {
        // the further out, the more it bends: it hinges at the rim and curls
        const a = ang * Math.min(1, 0.35 + d * 0.9);
        x = RIM + d * Math.cos(a);
        y = 0.008 - d * Math.sin(a);
        flat = Math.cos(a);
        k *= 1 - 0.25 * Math.min(1, ang);
      }
      out.push({ x, y, z: ZM, w, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat });
      i++;
    }
    return out;
  }

  // ---- smears of light for the big fall: the eye (white) and the ring (red) at sub-frame steps ----
  const eyeSmear = makeRibbon(lab, 16);
  const ringMesh = maya.group.children.find((o) => o.isMesh && o.material === maya.model.ringMat && o.geometry.type === 'RingGeometry');
  const ghosts = [];
  for (let j = 0; j < 28; j++) {
    const m = new THREE.Mesh(ringMesh.geometry, new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.matrixAutoUpdate = false;
    m.visible = false;
    lab.add(m);
    ghosts.push(m);
  }
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const poseMatrix = (P) => {
    const at = lab.pos(P.x, P.y);
    dummy.position.set(at.x, P.lift, at.z);
    dummy.rotation.set(-P.pitch, P.rot, -P.roll);
    dummy.scale.setScalar(1.3);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  };
  const EYE = new THREE.Vector3(0, 0.252, -0.13);

  // ---- the thud: the picture jolts and red light spills up from under the frame ----
  const spillEl = document.createElement('div');
  spillEl.style.cssText =
    'position:absolute;left:38%;right:-12%;bottom:-6%;height:46%;opacity:0;pointer-events:none;mix-blend-mode:screen;' +
    'background:radial-gradient(ellipse 50% 70% at 50% 100%, rgba(255,90,120,0.75), rgba(255,77,109,0.25) 45%, rgba(255,77,109,0) 75%)';
  lab.overlay.append(spillEl);

  lab.playCard('a', ['m3']);
  let phase = 'board';
  const t0 = lab.t;
  maya.each = (m) => {
    const t = lab.t - t0;
    const c = lab.bot('a').card;
    if (c && t > T_OUT - 0.2) c.visible = false;
    void m;
  };

  lab.every(() => {
    const t = lab.t - t0;
    // Maya
    if (t < T_OUT) {
      const P = boardPose(t);
      maya.set({ x: P.x, y: 1, lift: 0, rot: P.rot, pitch: P.pitch, roll: 0, sy: P.sy, visible: true });
    } else if (t < T_IN) {
      if (phase === 'board') {
        phase = 'gone';
        maya.set({ visible: false });
      }
    } else if (t < T_IN + T_FALL) {
      phase = 'fall';
      const P = fallState(t);
      maya.set({ x: P.x, y: P.y, lift: P.lift, rot: P.rot, pitch: P.pitch, roll: P.roll, sy: 1, visible: true });
    } else if (phase === 'fall') {
      phase = 'out';
      maya.release({ x: 7, y: 1, on: false });
      // released mid-frame: the game already placed her this frame, so hide her by hand until it catches up
      maya.group.visible = false;
      const c = lab.bot('a').card;
      if (c) c.visible = false;
    }

    // smears while she falls past the lens
    if (phase === 'fall') {
      const eyePts = [];
      for (let j = 0; j < 14; j++) {
        const tj = Math.max(T_IN, t - j * 0.015);
        const M = poseMatrix(fallState(tj));
        const e = EYE.clone().applyMatrix4(M);
        const k = (1 - j / 14) ** 1.3 * 3.2;
        eyePts.push({ x: e.x, y: e.y, z: e.z, w: 0.05 * (1 - j / 16), r: k, g: k * 0.97, b: k * 0.9, flat: 0 });
      }
      eyeSmear.draw(eyePts);
      ghosts.forEach((m, j) => {
        const tj = t - (j + 1) * 0.0038;
        if (tj < T_IN) return (m.visible = false);
        m.visible = true;
        m.matrix.copy(poseMatrix(fallState(tj))).multiply(ringMesh.matrix);
        m.material.opacity = 0.16 * (1 - (j + 1) / (ghosts.length + 1)) ** 1.5;
      });
    } else {
      eyeSmear.draw([]);
      ghosts.forEach((m) => (m.visible = false));
    }

    // the trail keeps fading as it always does (this keeps running while the game carries on)
    trail.draw(trailPts(t));

    // thud
    if (t >= T_THUD && !spillEl.dataset.done) {
      spillEl.dataset.done = '1';
      lab.shake(0.06, 0.32);
    }
    const ks = t - T_THUD;
    spillEl.style.opacity = ks < 0 ? '0' : String(ks < 0.06 ? ks / 0.06 : Math.max(0, 1 - (ks - 0.06) / 0.5) ** 2);
  });

  await lab.wait(T_END);
}
