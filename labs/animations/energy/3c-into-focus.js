// Energy, idea 3 (The banker's hand), animator c: cinematic & graphic staging.
export const meta = {
  title: 'Into focus',
  idea:
    'A rack focus across the fourth wall. Maya settles and a big, soft, out-of-focus amber cube rises into the bottom of the picture, as if it just left a hand on the sofa: it is on our side of the screen, too close to be sharp. It lobs away from us, shrinking and coming into focus as it crosses into the board, then clacks down on the glass just in front of her with its reflection pooling under it. It slides into her ring, she rocks back a hair, and it melts into her as amber light.',
  notes:
    'Sound: a soft whoosh close to the speakers (our side), a bright glass clack on the landing, a short glassy slide, then a warm chime as it melts. The out-of-focus part lives on the overlay (the HUD layer, i.e. our side of the screen) as a blurred glass square; it hands over to a 3D glass cube where the two match in size and place. Variation: about one charge in four (lab.rand() < 0.25) the hand fumbles: the cube clips her nose, tumbles, drops into the battery\'s glow under her and shoots up into her from below.',
};

const BAT = { x: 3, y: 1 };
const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (k) => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI);

function softSprite(lab, color, size, k, square = false) {
  const { THREE } = lab;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  if (square) {
    g.filter = 'blur(10px)';
    g.fillStyle = '#fff';
    g.fillRect(34, 34, 60, 60);
  } else {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(cv);
  return { tex: t, mat: new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), size };
}

/** A glass cube of amber light: a translucent body, bright edges, a glow inside. */
function glassCube(lab, size) {
  const { THREE, PALETTE } = lab;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(PALETTE.energy), emissive: new THREE.Color(PALETTE.energy), emissiveIntensity: 0.75, roughness: 0.06, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.62, depthWrite: false }),
  );
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(4), transparent: true }));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(lab, '#fff', 1, 1).tex, color: new THREE.Color(PALETTE.energy).multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.setScalar(size * 1.5);
  g.add(body, edges, core);
  lab.add(g);
  return {
    group: g,
    set fade(a) {
      body.material.opacity = 0.62 * a;
      edges.material.opacity = a;
      core.material.opacity = a;
      g.visible = a > 0.003;
    },
    set heat(k) {
      body.material.emissiveIntensity = 0.75 + k * 2;
      core.material.color.set(PALETTE.energy).multiplyScalar(1.1 + k * 3);
    },
  };
}

export default async function play(lab) {
  const { THREE, PALETTE, ease, facing } = lab;
  const fumble = lab.rand() < 0.25; // one time in four the unseen hand fumbles
  const maya = lab.puppet('a');
  maya.set({ rot: facing(1) });
  const at = lab.pos(BAT.x, BAT.y);
  const SIZE = 0.3;
  const H = () => lab.overlay.clientHeight || 540;
  const W = () => lab.overlay.clientWidth || 960;

  // ---- the beats ----
  const MOVE = 0.58;
  const IN = 0.66; // the soft cube rises into the bottom of the picture (our side)
  const HAND = 0.95; // it crosses into the board: the overlay hands over to the 3D cube
  const LAND = 1.14; // clack
  const SLIDE = 1.24; // it slides into her ring...
  const TOUCH = 1.42; // ...touches her, and melts in
  const END = 2.12;

  // where it flies: from high over the camera side of the board down to just in front of her
  const P1 = lab.pos(3.25, 2.55).setY(1.05);
  const P2 = lab.pos(3.04, 1.8).setY(SIZE / 2);
  const P3 = lab.pos(3.0, 1.38).setY(SIZE / 2);
  const NOSE = lab.pos(3.28, 1.32).setY(0.35); // the fumble clips her nose here

  // the out-of-focus cube on our side of the screen
  const soft = document.createElement('div');
  soft.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;border-radius:12%;opacity:0;will-change:transform,filter;' +
    'background:radial-gradient(circle at 38% 34%, rgba(255,236,200,.95), rgba(255,197,110,.85) 38%, rgba(214,130,40,.7) 100%);' +
    'box-shadow:0 0 40px rgba(255,197,110,.55), inset 0 0 0 3px rgba(255,236,200,.7)';
  lab.overlay.append(soft);

  const cube = glassCube(lab, SIZE);
  cube.fade = 0;
  // its reflection pooling on the glass, and a soft contact glow
  const refl = softSprite(lab, PALETTE.energy, 1, 1.4, true);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2), refl.mat);
  pool.position.y = 0.007;
  lab.add(pool);
  pool.visible = false;

  const top = lab.arena.batteryMat;
  const WHITE = new THREE.Color(3.2, 3.1, 2.9);
  const AMBER = new THREE.Color(PALETTE.energy).multiplyScalar(4.2);
  const ring0 = maya.model.ringMat.color.clone();
  const RING = new THREE.Color(PALETTE.energy).multiplyScalar(2.3);
  const look = { warm: 0 };
  maya.each = (m) => {
    m.eyeMat.color.copy(WHITE).lerp(AMBER, look.warm);
    m.ringMat.color.copy(ring0).lerp(RING, look.warm * 0.85);
  };
  const restore = () => maya.model.ringMat.color.copy(ring0);
  lab.cleanup(restore);

  const cam = { push: 0, k: 0 };
  const releaseCam = lab.camera((home) => ({ target: home.target.clone().lerp(at, cam.k), dist: home.dist * (1 - cam.push) }));

  // a point's screen position and the screen size of the cube there
  const screenOf = (p) => {
    const a = lab.toScreen(p);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(lab.camera3.quaternion).multiplyScalar(SIZE);
    const b = lab.toScreen(p.clone().add(right));
    return { x: a.x, y: a.y, s: Math.hypot(b.x - a.x, b.y - a.y) };
  };

  lab.playCard('a', ['m2']);
  let landed = false;
  let touched = false;
  const t0 = lab.t;
  const stop = lab.every((dt, t) => {
    const T = t - t0;
    const pose = { x: 1 + 2 * ease.inOut(seg(T, 0, MOVE)), pitch: bump(seg(T, MOVE - 0.04, MOVE + 0.2)) * 0.1, lift: 0, sy: 1, sx: 1, sz: 1, roll: 0 };

    // ---- phase A: soft, huge, on our side of the screen ----
    if (T >= IN && T < HAND + 0.07) {
      const k = seg(T, IN, HAND);
      const e = ease.out(k);
      const end = screenOf(P1);
      const x0 = W() * 0.44;
      const y0 = H() * 1.32;
      // an arc: up out of the bottom, curving in toward the board
      const x = mix(x0, end.x, e) - Math.sin(k * Math.PI) * W() * 0.03;
      const y = mix(y0, end.y, ease.out3(k)) - Math.sin(k * Math.PI) * H() * 0.08;
      const s = mix(H() * 0.95, end.s, ease.out(k));
      const blur = mix(26, 0.5, ease.in(k));
      const rot = mix(-28, 12, e);
      soft.style.width = soft.style.height = `${s.toFixed(1)}px`;
      soft.style.transform = `translate(${(x - s / 2).toFixed(1)}px, ${(y - s / 2).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
      soft.style.filter = `blur(${blur.toFixed(1)}px)`;
      soft.style.opacity = String(Math.min(1, seg(T, IN, IN + 0.05)) * (1 - seg(T, HAND, HAND + 0.07)));
    } else soft.style.opacity = '0';

    // ---- phase B: the 3D cube lobs down onto the glass ----
    if (T >= HAND) {
      cube.fade = seg(T, HAND - 0.01, HAND + 0.05) * (1 - seg(T, TOUCH + 0.04, TOUCH + 0.26));
      const g = cube.group;
      if (T < LAND) {
        const k = seg(T, HAND, LAND);
        const target = fumble ? NOSE : P2;
        g.position.lerpVectors(P1, target, k);
        g.position.y = mix(P1.y, target.y, ease.in(k)) + bump(k * 0.5) * 0.12;
        g.rotation.set(mix(0.5, 0.0, k) + (1 - k) * 2.2, mix(0.9, 0.25, k), mix(0.6, 0, k));
      } else if (!fumble) {
        if (!landed) {
          landed = true;
          lab.ring(P2.clone().setY(0), '#ffe2b0', 0.18, 0.01, 0.26);
          lab.shake(0.012, 0.12);
        }
        // a small bounce on the clack, then it slides into her ring
        const hop = T < SLIDE ? bump(seg(T, LAND, SLIDE)) * 0.045 : 0;
        const sl = ease.out(seg(T, SLIDE, TOUCH));
        g.position.lerpVectors(P2, P3, sl);
        g.position.y = SIZE / 2 + hop;
        g.rotation.set(0, 0.25 * (1 - sl), 0);
        // melting into her: it shrinks, heats up and rises into her body
        const melt = ease.in(seg(T, TOUCH, TOUCH + 0.24));
        g.scale.set(1 - 0.75 * melt, 1 - 0.6 * melt, 1 - 0.75 * melt);
        g.position.lerp(at.clone().setY(0.3), melt);
        cube.heat = melt;
      } else {
        // the fumble: it clips her nose, tumbles off, drops into the battery's glow, then shoots up into her
        const k = seg(T, LAND, LAND + 0.3);
        if (!landed) {
          landed = true;
          lab.ring(NOSE.clone().setY(0), '#ffe2b0', 0.2, 0.01, 0.25);
        }
        const fall = lab.pos(3.15, 1.15);
        g.position.set(mix(NOSE.x, fall.x, k), mix(NOSE.y, 0.02, ease.in(k)) + bump(k) * 0.18, mix(NOSE.z, fall.z, k));
        g.rotation.set(k * 6, 0.4 + k * 3, k * 4);
        g.scale.setScalar(1 - 0.6 * seg(T, LAND + 0.22, LAND + 0.32));
        cube.heat = seg(T, LAND + 0.2, LAND + 0.32);
      }
    }

    // ---- the reflection on the glass under it ----
    if (T >= HAND && !fumble) {
      const g = cube.group;
      const h = Math.max(0, g.position.y - SIZE / 2);
      pool.visible = T < TOUCH + 0.3;
      pool.position.x = g.position.x;
      pool.position.z = g.position.z;
      const near = Math.max(0, 1 - h / 0.9);
      pool.scale.setScalar((0.5 + h * 0.8) * g.scale.x);
      refl.mat.color.set(PALETTE.energy).multiplyScalar(0.8 * near * near * (1 - seg(T, TOUCH, TOUCH + 0.26)) + (T >= LAND && T < LAND + 0.12 ? 1.2 * (1 - seg(T, LAND, LAND + 0.12)) : 0));
    }

    // ---- Maya: she rocks back a hair as it melts in; the glow climbs into her ----
    const hitT = fumble ? LAND + 0.32 : TOUCH;
    const rock = T >= hitT ? Math.sin(seg(T, hitT, hitT + 0.45) * Math.PI * 2) * (1 - seg(T, hitT, hitT + 0.45)) : 0;
    pose.pitch += -0.16 * rock;
    if (fumble && T >= LAND && T < hitT + 0.05) pose.roll = Math.sin(seg(T, LAND, LAND + 0.2) * Math.PI) * -0.12;
    if (fumble) {
      const up = bump(seg(T, hitT, hitT + 0.22));
      pose.lift = up * 0.08;
      pose.sy = 1 + up * 0.1;
    } else {
      const gulp = bump(seg(T, TOUCH + 0.04, TOUCH + 0.3)) * 0.08;
      pose.sy = 1 + gulp;
      pose.sx = pose.sz = 1 - gulp * 0.4;
    }
    maya.set(pose);
    look.warm = ease.out(seg(T, hitT + 0.08, hitT + 0.2)) * (1 - ease.inOut(seg(T, hitT + 0.32, END - 0.02)));

    // ---- the camera: leans in with the throw, home again by the end ----
    const lean = ease.inOut(seg(T, IN, LAND)) * (1 - ease.inOut(seg(T, TOUCH + 0.1, END - 0.04)));
    cam.push = 0.07 * lean;
    cam.k = 0.28 * lean;
    void top;
  });
  lab.cleanup(stop);

  // the fumble's shot up from below: a column of amber through her
  if (fumble) {
    lab.at(LAND + 0.3, () => {
      const geo = new THREE.CylinderGeometry(0.05, 0.09, 1.3, 16, 1, true).translate(0, 0.65, 0);
      const col = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.energy).multiplyScalar(2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      col.position.copy(at);
      lab.add(col);
      lab.tween(0.4, (e, k) => {
        col.scale.set(1 - 0.6 * k, 0.05 + ease.out3(Math.min(1, k * 3)), 1 - 0.6 * k);
        col.material.opacity = 1 - ease.in(k);
      }, ease.linear).then(() => col.removeFromParent());
    });
  }
  lab.at(fumble ? LAND + 0.34 : TOUCH + 0.1, () => lab.ring(at, PALETTE.energy, 0.4, 0.02, 0.45));

  await lab.wait(END);
  stop();
  restore();
  releaseCam();
  soft.remove();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
