// Belt, idea 1 (Wait, There's More), animator c: cinematic staging.
export const meta = {
  title: 'Wait, There\'s More (iris out)',
  idea:
    'The express step slides Maya one space and she settles in with a content, dimmed eye, and the picture itself agrees the moment is over: the dark room closes in on her like an old cartoon\'s iris-out while the camera eases in for the closing shot. Mid-sigh, the all-belts step yanks her clean out of the spotlight. For a beat there is only her wide eye streaking through the dark, then the iris snaps open and the camera, caught napping too, whips after her. She lands on the corner facing east, stiff, eye wide. The picture got fooled along with her: blue means two.',
  notes:
    'Sound: a soft falling two-note chime as she settles and the iris closes (the "that\'s all" cadence), cut off by a glass "tk-whoomp" when the belt yanks her, then a bright open chime as the room comes back. The iris is the room\'s darkness on the HUD layer (a canvas), with a hairline of warm light at its edge and a small hole that follows her eye in the dark. It can play on every express ride as a running gag; she never learns. The express belt glows once per step ("one... two").',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;

  const maya = lab.puppet('a');
  const m = maya.model;
  const eye = m.body.children.find((o) => o.material === m.eyeMat);
  const eyeScale = eye ? eye.scale.clone() : new THREE.Vector3(1, 1, 1);
  const express = arena.belts.filter((b) => b.fast);
  const speed0 = express.map((b) => b.speed);
  lab.cleanup(() => {
    if (eye) eye.scale.copy(eyeScale);
    express.forEach((b, i) => (b.speed = speed0[i]));
  });

  // ---- the iris: the room's darkness on the HUD layer ----
  const W = lab.overlay.clientWidth || 960;
  const H = lab.overlay.clientHeight || 540;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  lab.overlay.append(cv);
  const g = cv.getContext('2d');
  const hole = (x, y, r, soft) => {
    const gr = g.createRadialGradient(x, y, Math.max(0, r), x, y, r + soft);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r + soft, 0, Math.PI * 2);
    g.fill();
    if (r > 0) {
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  const drawIris = (at, r, a, eyeAt, eyeA) => {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    if (a <= 0.002) return;
    g.fillStyle = `rgba(3,4,7,${0.95 * a})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    hole(at.x, at.y, r, H * 0.035);
    if (eyeAt && eyeA > 0) {
      g.globalAlpha = eyeA;
      hole(eyeAt.x, eyeAt.y, H * 0.018, H * 0.06);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    // a hairline of warm light at the iris edge
    g.strokeStyle = `rgba(255,236,205,${0.5 * a})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(at.x, at.y, r + 1, 0, Math.PI * 2);
    g.stroke();
  };

  // ---- camera: one state object, eased home by the end ----
  // (the lab eases the picture's framing offset away when it takes the camera; hold it, so nothing jumps)
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
    return {
      target: home.target.clone().add(new THREE.Vector3(cam.dx, 0, cam.dz)),
      az: home.az + cam.az,
      el: home.el + cam.del,
      dist: home.dist * cam.dk,
    };
  });
  const p2 = lab.pos(2, 1);
  const p3 = lab.pos(3, 1);

  // timeline (seconds)
  const SLIDE = 0.34; // express step: (1,1) -> (2,1)
  const YANK = 1.12; // all-belts step: (2,1) -> (3,1), and the corner turns her
  const OPEN = YANK + 0.24; // the iris (and the camera) only notice a beat later
  const END = 2.32;

  const t0 = lab.t;
  let eyeK = 1;
  let eyeS = 1;
  let lean = { p: 0, r: 0 };
  let irisAt = null;
  const eyeWorld = new THREE.Vector3();
  const stop = lab.every(() => {
    const t = lab.t - t0;

    // ---- the belt: a soft glow on each step ("one", "two") ----
    const glow = Math.max(0, 1 - t / 0.5) * 0.7 + Math.max(0, 1 - Math.abs(t - YANK - 0.15) / 0.4) * 0.7 * (t > YANK ? 1 : 0);
    express.forEach((b, i) => {
      b.speed = speed0[i] * (1 + glow * 1.2);
      b.mat.color.multiplyScalar(1 + glow * 0.7);
    });

    // ---- her pose ----
    let x = 2;
    let rot = facing(0);
    let sy = 1;
    let sxz = 1;
    if (t < SLIDE) {
      const k = seg(t, 0, SLIDE);
      x = 1 + ease.inOut(k);
      lean = { p: 0, r: -0.09 * Math.sin(k * Math.PI) }; // a lean against the slide
    } else if (t < YANK) {
      // she settles into a comfortable squash; a slow sigh starts
      const s = ease.out(seg(t, SLIDE, SLIDE + 0.3));
      const sigh = Math.sin(seg(t, 0.72, YANK + 0.3) * Math.PI) * 0.04;
      sy = 1 - 0.13 * s + sigh;
      sxz = 1 + 0.06 * s - sigh * 0.4;
      lean = { p: 0, r: 0.07 * Math.sin(seg(t, SLIDE, SLIDE + 0.3) * Math.PI) };
      const d = ease.inOut(seg(t, 0.38, 0.85));
      eyeK = mix(1, 0.3, d);
      eyeS = mix(1, 0.7, d);
    } else {
      // the yank: the base goes first, the body lags back, the eye snaps wide
      const k = seg(t, YANK, YANK + 0.36);
      x = 2 + ease.out3(k);
      rot = facing(0) + (facing(1) - facing(0)) * ease.inOut(seg(t, YANK + 0.16, YANK + 0.5));
      const kk = seg(t, YANK, END - 0.15);
      const amt = -0.42 * Math.exp(-kk * 5) * Math.cos(kk * 12) * seg(t, YANK, YANK + 0.05);
      // lean west (against the motion), in her own frame
      lean = { p: amt * Math.sin(rot) * -1, r: amt * Math.cos(rot) };
      const relax = ease.inOut(seg(t, END - 0.4, END));
      const st = ease.outBack(seg(t, YANK, YANK + 0.18)) * (1 - relax);
      sy = mix(0.87, 1, ease.out(seg(t, YANK, YANK + 0.07))) + 0.08 * st;
      sxz = 1 - 0.05 * st;
      eyeK = mix(mix(2.4, 1.4, ease.out(seg(t, YANK, YANK + 0.6))), 1, relax);
      eyeS = mix(mix(1.8, 1.4, ease.out(seg(t, YANK, YANK + 0.6))), 1, relax);
    }
    maya.set({ x, y: 1, rot, sx: sxz, sz: sxz, sy });

    // ---- the iris ----
    if (t < YANK) irisAt = lab.toScreen(p2.clone().setY(0.25)); // follows the camera's slow push-in
    const full = Math.hypot(W, H);
    const closed = H * 0.095;
    if (irisAt) {
      if (t < OPEN) {
        const c = ease.inOut(seg(t, 0.38, 1.06));
        // in the dark: a hole of light around her eye, streaking out of the spotlight
        let eyeAt = null;
        let eyeA = 0;
        if (t > YANK && eye) {
          eye.getWorldPosition(eyeWorld);
          eyeAt = lab.toScreen(eyeWorld);
          eyeA = seg(t, YANK, YANK + 0.04);
        }
        drawIris(irisAt, mix(full, closed, c), Math.min(1, c * 3), eyeAt, eyeA);
      } else {
        // it snaps open like a shutter springing back
        const o = ease.in(seg(t, OPEN, OPEN + 0.16));
        drawIris(irisAt, mix(closed, full * 1.1, o), 1 - o * o, null, 0);
      }
    }

    // ---- camera: the closing shot pushes in on her; caught napping, it whips after her, then home ----
    if (t < OPEN) {
      const c = ease.inOut(seg(t, 0.38, 1.1));
      cam.dx = p2.x * 0.45 * c;
      cam.dz = p2.z * 0.45 * c;
      cam.dk = 1 - 0.14 * c;
      cam.del = -0.04 * c;
      cam.az = 0;
    } else {
      const w = ease.out3(seg(t, OPEN, OPEN + 0.26)); // whip after her
      const h = ease.inOut(seg(t, OPEN + 0.26, END - 0.04)); // and home
      const fx = mix(p2.x * 0.45, p3.x * 0.5 + 0.1, w);
      const fz = p2.z * 0.45;
      cam.dx = mix(fx, 0, h);
      cam.dz = mix(fz, 0, h);
      cam.dk = mix(0.86, 1, h);
      cam.del = mix(-0.04, 0, h);
      cam.az = 0.06 * Math.sin(seg(t, OPEN, OPEN + 0.4) * Math.PI) * (1 - h);
    }
  });

  maya.each = (model) => {
    model.body.rotation.set(-lean.p, 0, -lean.r);
    // a content glow is warmer and dimmer; wide is whiter and brighter
    const warm = eyeK < 1 ? 1 - eyeK : 0;
    model.eyeMat.color.setRGB(3.2 * eyeK, 3.1 * eyeK * (1 - 0.18 * warm), 2.9 * eyeK * (1 - 0.4 * warm));
    if (eye) eye.scale.set(eyeScale.x * Math.max(1, eyeS), eyeScale.y * eyeS, eyeScale.z * eyeS);
  };

  await lab.wait(END);
  stop();
  maya.each = null;
  if (eye) eye.scale.copy(eyeScale);
  express.forEach((b, i) => (b.speed = speed0[i]));
  m.body.rotation.set(0, 0, 0);
  cv.remove();
  releaseCam();
  maya.set({ x: 3, y: 1, rot: facing(1), sx: 1, sy: 1, sz: 1 });
  maya.release({ x: 3, y: 1, d: 1 });
}
