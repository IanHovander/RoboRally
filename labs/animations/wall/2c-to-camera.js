// Wall, idea 2 "To camera", animator c (cinematic & graphic staging).
export const meta = {
  title: 'To camera (the documentary zoom)',
  idea:
    'Maya stops nose to the fin. A beat. She swivels and tips her face up to look straight out of the TV, and the camera reacts like a ' +
    'documentary crew catching a look: a snap zoom from where it stands, the dark of the room irising in around her, and her eye, now ' +
    'pointed square into the lens, flares across the picture in one thin line of warm light. She holds the stare. Then one tick: she turns ' +
    'back to the wall, the flare snaps shut, the iris opens and the zoom pulls back out as if nothing happened.',
  notes:
    'Sound: nothing on the stop but the smallest glass tink, silence through the stare (the room fills it), one soft dry tick on the turn ' +
    'back and a faint zoom-motor whirr under the snap zoom if anything. The camera never moves: it pans and zooms from its tripod (az/el/' +
    'dist recomputed from the home position each frame, fov does the zoom), which is what makes it read as a camera operator reacting. The ' +
    'flare is the only thing drawn on top of the picture, and it exists only while her eye faces the lens. As a running bit it could zoom ' +
    'a little tighter each time the same player does it in one game.',
};

export default async function play(lab) {
  const { THREE, ease, facing } = lab;
  const arena = lab.arena;
  const maya = lab.puppet('a');
  const M = maya.model;
  lab.playCard('a', ['m3']);

  // ---------- the camera: a tripod that pans and zooms ----------
  const cam = lab.camera3;
  const P0 = cam.position.clone(); // where the tripod stands (home)
  const view = { aim: 0, fov: 30 }; // aim: 0 = home target, 1 = Maya's face
  const face = new THREE.Vector3();
  const sx0 = arena.camCur?.sx ?? 0;
  const sy0 = arena.camCur?.sy ?? 0;
  const keepFrame = lab.every(() => {
    // keep the game's framing offset exactly as it was (the lab would otherwise ease it away)
    const c = arena.camCur;
    if (!c) return;
    const k = Math.min(0.9, arena.dt * 4);
    c.sx = sx0 / (1 - k);
    c.sy = sy0 / (1 - k);
  });
  const releaseCam = lab.camera((home) => {
    const tgt = home.target.clone().lerp(face, view.aim);
    const d = P0.clone().sub(tgt);
    const dist = d.length();
    return { target: tgt, dist, el: Math.asin(d.y / dist), az: Math.atan2(d.x, d.z), fov: view.fov };
  });

  // ---------- the overlay: an iris of darkness and the flare ----------
  const ov = lab.overlay;
  const iris = document.createElement('div');
  iris.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  const streak = document.createElement('div');
  streak.style.cssText =
    'position:absolute;left:0;width:100%;height:2px;pointer-events:none;mix-blend-mode:screen;opacity:0;' +
    'background:linear-gradient(90deg,rgba(255,236,205,0) 0%,rgba(255,236,205,.35) 30%,rgba(255,250,240,1) 50%,rgba(255,236,205,.35) 70%,rgba(255,236,205,0) 100%);' +
    'filter:blur(0.6px)';
  const bloom = document.createElement('div');
  bloom.style.cssText =
    'position:absolute;border-radius:50%;pointer-events:none;mix-blend-mode:screen;opacity:0;' +
    'background:radial-gradient(circle,rgba(255,250,240,.9) 0%,rgba(255,236,205,.35) 18%,rgba(255,226,190,.08) 45%,rgba(255,226,190,0) 70%)';
  ov.append(iris, streak, bloom);
  const fx = { iris: 0, irisR: 1.6, flare: 0, eye: 1 };

  const eyeMesh = (() => {
    let e = null;
    M.body.traverse((o) => {
      if (o.isMesh && o.material === M.eyeMat && !e) e = o;
    });
    return e;
  })();
  const eyeAt = new THREE.Vector3();
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  maya.each = (m) => {
    m.eyeMat.color.setRGB(3.2 * fx.eye, 3.1 * fx.eye, 2.9 * fx.eye);
    // the card would hang off the top of the close-up: it steps out of the shot
    if (maya.bot.card) maya.bot.card.material.opacity *= 1 - fx.iris;
  };
  // drawn after the camera is placed each frame (lab.every hooks run before the puppets are posed)
  const drawOverlay = () => {
    const r = ov.getBoundingClientRect();
    maya.group.updateMatrixWorld(true);
    (eyeMesh ?? M.muzzle).getWorldPosition(eyeAt);
    const s = lab.toScreen(eyeAt);
    // how square her eye is on the lens
    cam.getWorldPosition(look);
    look.sub(eyeAt).normalize();
    fwd.set(0, 0, -1).applyQuaternion(maya.group.quaternion).normalize();
    const square = Math.max(0, fwd.x * look.x + fwd.z * look.z) / Math.max(1e-6, Math.hypot(look.x, look.z) * Math.hypot(fwd.x, fwd.z));
    const f = fx.flare * Math.pow(square, 4);
    const R = fx.irisR * r.height;
    iris.style.opacity = String(fx.iris);
    iris.style.background = `radial-gradient(circle at ${s.x}px ${s.y}px, rgba(0,0,0,0) ${R * 0.6}px, rgba(2,3,5,.6) ${R * 0.85}px, rgba(2,3,5,.9) ${R * 1.2}px)`;
    // the streak is centred on her eye, 1.6 screens wide, and grows from it
    const sw = r.width * 1.6;
    const sh = Math.max(2, r.height * 0.005);
    streak.style.width = `${sw}px`;
    streak.style.height = `${sh}px`;
    streak.style.left = `${s.x - sw / 2}px`;
    streak.style.top = `${s.y - sh / 2}px`;
    streak.style.opacity = String(Math.min(1, f));
    streak.style.transform = `scaleX(${0.2 + 0.8 * Math.min(1, f)})`;
    const bw = r.height * 0.42;
    bloom.style.width = bloom.style.height = `${bw}px`;
    bloom.style.left = `${s.x - bw / 2}px`;
    bloom.style.top = `${s.y - bw / 2}px`;
    bloom.style.opacity = String(Math.min(1, f * 0.9));
    bloom.style.transform = `scale(${0.5 + 0.6 * f})`;
  };
  const shakeCam = lab._shakeCamera;
  lab._shakeCamera = () => {
    shakeCam();
    drawOverlay();
  };
  lab.cleanup(() => (lab._shakeCamera = shakeCam));

  // ---------- 1. the move: Move 3, at full speed, cut short by the fin ----------
  const E = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const tHit = 0.592; // where E reaches 2/3: the third space would start
  await lab.tween(
    0.9 * tHit,
    (e, k) => {
      const kk = k * tHit;
      maya.set({ x: 1 + 3 * E(kk), pitch: 0.1 * Math.sin(Math.min(1, kk / tHit) * Math.PI * 0.5) });
    },
    ease.linear,
  );
  // stopped dead: a tiny nod into the fin and back
  maya.set({ x: 3 });
  await lab.tween(0.14, (e, k) => maya.set({ pitch: 0.1 + 0.1 * Math.sin(k * Math.PI) - 0.1 * k, x: 3 + 0.03 * Math.sin(k * Math.PI) }), ease.linear);

  // ---------- 2. a beat of nothing ----------
  await lab.wait(0.22);

  // ---------- 3. she swivels and looks up into the lens ----------
  const r0 = facing(1);
  const rCam = () => {
    // the rotation that points her front at the camera (front is -z in model space)
    const p = maya.group.position;
    return Math.atan2(-(P0.x - p.x), -(P0.z - p.z)); // rot.y such that -z points to the camera
  };
  const rotTo = (() => {
    let r = rCam();
    while (r - r0 > Math.PI) r -= Math.PI * 2;
    while (r - r0 < -Math.PI) r += Math.PI * 2;
    return r;
  })();
  face.copy(lab.pos(3, 1)).setY(0.26);
  await lab.tween(
    0.42,
    (e) => {
      maya.set({ rot: r0 + (rotTo - r0) * e, pitch: -0.32 * e });
      fx.flare = e > 0.85 ? (e - 0.85) / 0.15 : 0;
      fx.eye = 1 + 0.35 * e;
    },
    ease.inOut,
  );

  // ---------- 4. the camera catches it: a snap zoom, the iris, the stare ----------
  await lab.wait(0.06);
  lab.tween(
    0.2,
    (e) => {
      view.aim = e;
      view.fov = 30 + (10.2 - 30) * e;
      fx.iris = e;
      fx.irisR = 1.6 + (0.62 - 1.6) * e;
    },
    ease.out3,
  ).then(() =>
    // the operator corrects: a hair back out
    lab.tween(0.18, (e) => (view.fov = 10.2 + 1.0 * e), ease.inOut),
  );
  // the hold: dead still, eye a touch brighter, a slow breath of light
  await lab.tween(
    0.62,
    (e, k) => {
      fx.eye = 1.35 + 0.15 * Math.sin(k * Math.PI);
      fx.flare = 1;
    },
    ease.linear,
  );

  // ---------- 5. tick: back to the wall; flare shuts, iris opens, zoom pulls out ----------
  lab.tween(
    0.3,
    (e) => {
      view.aim = 1 - e;
      view.fov = 11.2 + (30 - 11.2) * e;
      fx.iris = 1 - e;
      fx.irisR = 0.62 + (1.6 - 0.62) * e;
    },
    ease.inOut,
  );
  await lab.tween(
    0.2,
    (e) => {
      maya.set({ rot: rotTo + (r0 - rotTo) * e, pitch: -0.32 * (1 - e) });
      fx.eye = 1.35 - 0.35 * e;
      fx.flare = 1 - e;
    },
    ease.out3,
  );
  await lab.wait(0.1);

  // ---------- home ----------
  view.aim = 0;
  view.fov = 30;
  releaseCam();
  keepFrame();
  lab._shakeCamera = shakeCam;
  iris.remove();
  streak.remove();
  bloom.remove();
  maya.each = null;
  maya.release({ x: 3, y: 1, d: 1 });
}
