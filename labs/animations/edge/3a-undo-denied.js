// Edge, idea 3 (Undo, denied), animator a: weight & physical comedy.
export const meta = {
  title: 'Undo, denied',
  idea:
    'Maya drives off the rim, scrapes her belly on the edge with a spray of sparks, flips and falls. Then the whole picture runs backward: the sparks fly back into the rim, ' +
    'she somersaults up out of the dark and reverses onto (6,1), her trail is eaten back up, the Move 3 card swells back to full light and even Ava un-flinches. ' +
    'The tape settles; a breath of stillness, as if the game were offering an undo. Then it plays forward again a little faster, frame for frame the same: ' +
    'same scrape, same sparks, same flip, same flinch, and this time she falls on into the dark and goes out.',
  notes:
    'Sound: the scrape is a bright glass "tsk", the rewind a soft reversed whoosh with the scrape played backward, a held hum in the pause, then the identical scrape again ' +
    '(the identical sound sells the determinism) and a falling tone that fades. Built as a pose function of "tape time": the first pass, the rewind and the replay all ' +
    'read the same function, so the replay is exact; the sparks, Ava\'s flinch, the trail and the card\'s light are functions of tape time too, so the whole world rewinds. ' +
    'In the game it could record the beat\'s poses into a buffer and play them back the same way.',
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
  const ava = lab.puppet('b');
  maya.set({ trail: false });
  const RED = new THREE.Color('#ff4d6d');
  const ZM = -0.5;
  const RIM = 3.5;

  // ---------------- the tape: everything is a function of tape time (tau) ----------------
  const TAU_CLINK = 1.04; // her belly scrapes the rim corner
  const TAU_HOP = 1.12; // kicked off the corner, she starts to fall
  const TAU_6 = 0.83; // she is on (6, 1)
  const TAU_END = 1.9;
  const G = 14;
  const driveX = (s) => {
    if (s < 0.14) return 4 - 0.07 * ease.out(s / 0.14);
    const k = Math.min(1, (s - 0.14) / 0.81);
    return 3.93 + 2.62 * (0.5 * k + 0.5 * k * k);
  };
  const xOver = (s) => 6.55 + 1.15 * (1 - Math.exp(-3.4 * (s - 0.95)));
  const liftHop = 0.03;
  function mayaAt(s) {
    const P = { x: 4, lift: 0, rot: facing(1), pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, light: 1, visible: true };
    if (s < 0.95) {
      P.x = driveX(s);
      if (s < 0.14) {
        const k = ease.out(s / 0.14);
        P.pitch = -0.17 * k;
        P.sy = 1 - 0.07 * k;
      } else {
        const k = (s - 0.14) / 0.81;
        P.pitch = -0.17 * (1 - k) ** 3;
        P.sy = 1 - 0.07 * (1 - Math.min(1, k * 4));
      }
      P.pitch += 0.32 * seg(P.x, 6.25, 6.55) ** 2;
    } else if (s < TAU_HOP) {
      // the tip: the nose goes over, the belly scrapes the corner and kicks the tail up
      P.x = xOver(s);
      const k = seg(s, 0.95, TAU_CLINK);
      const kk = seg(s, TAU_CLINK, TAU_HOP);
      P.lift = -0.09 * ease.in(k) + (0.09 + liftHop) * ease.out(kk);
      P.pitch = 0.32 + 0.45 * ease.in(k) + 0.55 * kk;
      P.roll = 0.18 * Math.sin(kk * PI);
      P.sy = 1 - 0.12 * Math.sin(seg(s, TAU_CLINK - 0.02, TAU_CLINK + 0.05) * PI);
    } else {
      // the fall: a slow somersault into the dark
      const d = s - TAU_HOP;
      P.x = xOver(s);
      P.lift = liftHop + 0.55 * d - 0.5 * G * d * d;
      P.pitch = 1.32 + 3.6 * d + 1.2 * d * d;
      P.roll = 0.18 * Math.max(0, 1 - d * 6) * 0 + 0.25 * Math.sin(d * 4);
      P.rot = facing(1) + 0.5 * d;
      P.light = 1 - seg(s, 1.55, 1.86);
      P.visible = s < 1.86;
    }
    return P;
  }
  // sparks from the scrape, each on its own little arc
  const N_SPARK = 14;
  const sparkV = [];
  for (let i = 0; i < N_SPARK; i++) {
    const a = lab.range(-0.9, 0.9);
    const sp = lab.range(0.8, 2.2);
    sparkV.push(new THREE.Vector3(Math.cos(a) * sp, lab.range(0.5, 1.9), Math.sin(a) * sp * 0.8));
  }
  const corner = new THREE.Vector3(RIM, 0.02, ZM);
  // Ava: startled by the scrape, she flinches and turns to look; then looks back to the front
  function avaAt(s) {
    const hop = Math.sin(seg(s, TAU_CLINK + 0.01, TAU_CLINK + 0.17) * PI);
    return {
      x: 2,
      y: 3,
      lift: 0.07 * hop,
      sy: 1 + 0.08 * hop - 0.1 * Math.sin(seg(s, TAU_CLINK + 0.17, TAU_CLINK + 0.27) * PI),
      rot: facing(0) - 0.45 * ease.inOut(seg(s, TAU_CLINK + 0.04, TAU_CLINK + 0.26)) + 0.45 * ease.inOut(seg(s, 1.6, 1.86)),
      roll: 0.06 * Math.sin(seg(s, TAU_CLINK, TAU_CLINK + 0.4) * PI * 5) * (1 - seg(s, TAU_CLINK, TAU_CLINK + 0.4)),
    };
  }

  // ---------------- the playback head: real time -> tape time ----------------
  const T_STOP = 1.5; // the first fall is cut off here
  const T_REW = T_STOP + 0.07; // a hitch, then the rewind
  const D_REW = 0.5;
  const T_PAUSE = T_REW + D_REW;
  const T_PLAY = T_PAUSE + 0.2;
  const SPEED = 1.4;
  const T_END = T_PLAY + (TAU_END - TAU_6) / SPEED;
  function tapeAt(t) {
    if (t < T_STOP) return t;
    if (t < T_REW) return T_STOP;
    if (t < T_PAUSE) return T_STOP - (T_STOP - TAU_6) * ease.inOut3(seg(t, T_REW, T_PAUSE));
    if (t < T_PLAY) {
      const d = t - T_PAUSE; // the head settles with a little mechanical tremor
      return TAU_6 - 0.012 * Math.sin(d * 55) * Math.exp(-d * 22);
    }
    if (t < T_END) return TAU_6 + SPEED * (t - T_PLAY);
    return TAU_END + (t - T_END); // the trail goes on fading as the game carries on
  }

  // ---------------- drawing ----------------
  const trail = makeRibbon(lab, 80);
  const laid = [];
  for (let s = 0.14; s <= 1.0; s += 1 / 60) {
    const P = mayaAt(s);
    if (P.x <= 6.62) laid.push({ x: P.x - 3, s });
  }
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(N_SPARK * 3);
  const sparkCol = new Float32Array(N_SPARK * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparkPts.frustumCulled = false;
  lab.add(sparkPts);
  const scrape = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0d8').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scrape.rotation.x = -PI / 2;
  scrape.position.copy(corner);
  lab.add(scrape);

  // echoes for the rewind: faint copies of her a moment further along the tape, so the motion visibly runs backward
  const echoes = [0, 1, 2].map(() => {
    const e = maya.model.body.clone(true);
    const mat = new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    e.traverse((o) => {
      if (o.isMesh) o.material = mat;
    });
    e.userData.mat = mat;
    e.matrixAutoUpdate = false;
    e.visible = false;
    lab.add(e);
    return e;
  });
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const poseMatrix = (P) => {
    const at = lab.pos(P.x, 1);
    dummy.position.set(at.x, P.lift, at.z);
    dummy.rotation.set(-P.pitch, P.rot, -P.roll);
    dummy.scale.set(1.3 * P.sx, 1.3 * P.sy, 1.3 * P.sz);
    dummy.updateMatrix();
    return dummy.matrix;
  };

  lab.playCard('a', ['m3']);
  const t0 = lab.t;
  let tau = 0;
  let gone = false;
  let mayaLight = 1;
  const base = maya.model.paint.emissiveIntensity;
  maya.model.paint.transparent = true;
  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * mayaLight, 3.1 * mayaLight, 2.9 * mayaLight);
    m.ringMat.opacity = 0.9 * mayaLight;
    m.poolMat.opacity = 0.75 * mayaLight;
    m.paint.opacity = Math.min(1, mayaLight * 1.5);
    m.paint.emissiveIntensity = base * mayaLight;
    const c = lab.bot('a').card;
    if (c) c.material.opacity *= mayaLight;
  };

  lab.every(() => {
    const t = lab.t - t0;
    tau = tapeAt(t);
    const rewinding = t >= T_REW && t < T_PAUSE;

    // Maya
    const P = mayaAt(Math.min(tau, TAU_END));
    mayaLight = P.light;
    if (!gone) {
      if (t >= T_PLAY && !P.visible) {
        gone = true;
        maya.release({ x: 7, y: 1, on: false });
        // released mid-frame: the game already placed her this frame, so hide her by hand until it catches up
        maya.group.visible = false;
        const c = lab.bot('a').card;
        if (c) c.visible = false;
      } else maya.set({ x: P.x, y: 1, lift: P.lift, rot: P.rot, pitch: P.pitch, roll: P.roll, sx: P.sx, sy: P.sy, sz: P.sz, visible: P.visible });
    }
    // the rewind's echoes
    const er = rewinding ? Math.sin(seg(t, T_REW, T_PAUSE) * PI) : 0;
    echoes.forEach((e, j) => {
      e.visible = er > 0.01;
      e.userData.mat.opacity = 0.34 * er * (1 - 0.3 * j);
      if (e.visible) e.matrix.copy(poseMatrix(mayaAt(Math.min(TAU_END, tau + 0.06 * (j + 1)))));
    });

    // Ava lives on the same tape
    if (tau <= TAU_END) ava.set(avaAt(tau));

    // the Move 3 card: its light is tape time too, so it rewinds
    const c = lab.bot('a').card;
    if (c && tau <= TAU_END) {
      c.userData.played = lab.t - tau;
      c.userData.born = lab.t - tau - 0.02;

    }

    // the trail: laid, eaten back up, laid again, then it fades as it always does
    const pts = [];
    let i = 0;
    for (const p of laid) {
      if (p.s > tau) break;
      const age = Math.min(1, (tau - p.s) / 3.2);
      const k = Math.max(0, 1 - age) ** 1.6 * 1.8 * Math.min(1, i / 3);
      pts.push({ x: p.x, y: 0.008, z: ZM, w: 0.16 + 0.06 * (1 - age), r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
      i++;
    }
    // the trail's head follows her while she is on the glass
    if (tau < 1.0 && pts.length) {
      const k = 1.8;
      pts.push({ x: P.x - 3, y: 0.008, z: ZM, w: 0.22, r: RED.r * k, g: RED.g * k, b: RED.b * k, flat: 1 });
    }
    trail.draw(pts);

    // sparks and the scrape's ring of light (they fly back into the corner on the rewind)
    const ds = tau - TAU_CLINK;
    const on = ds > 0 && ds < 0.5;
    sparkPts.visible = on;
    if (on) {
      const fade = (1 - ds / 0.5) ** 1.5;
      sparkV.forEach((v, j) => {
        const p = corner.clone().addScaledVector(v, ds);
        p.y = Math.max(-1.2, p.y - 0.5 * 7 * ds * ds);
        sparkPos.set([p.x, p.y, p.z], j * 3);
        const w = j % 3 === 0 ? [2.6, 2.5, 2.4] : [RED.r * 2.6, RED.g * 2.6, RED.b * 2.6];
        sparkCol.set(w.map((x) => x * fade), j * 3);
      });
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
    }
    const kr = seg(ds, 0, 0.4);
    scrape.material.opacity = ds > 0 && ds < 0.4 ? (1 - kr) ** 1.6 : 0;
    scrape.scale.setScalar(0.12 + 0.55 * ease.out(kr));
  });

  await lab.wait(T_END + 0.02);
  if (!gone) maya.release({ x: 7, y: 1, on: false });
  ava.release({ x: 2, y: 3, d: 0 });
}
