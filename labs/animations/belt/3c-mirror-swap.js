// Belt, idea 3 (Mirror Swap), animator c: cinematic staging.
export const meta = {
  title: 'Mirror Swap (the glass trick)',
  idea:
    'A pane of smoked glass with bright edges rises out of the corner tile on its diagonal, the angle at which a mirror turns north into east, and the camera eases round to look into it. Maya is carried in still facing north, and the glass swallows her: she slides into it, the pane ripples where she touched and takes on her red, and the world slows for a beat. Then her reflection, already facing east, steps out toward us, and as the pane sinks back into the board it unveils the rest of her. Only the east-facing Maya is left. Did the real one just go into the glass?',
  notes:
    'Sound: a rising glass "shhing" for the pane, a soft liquid "plip" as she touches it, a held, slightly detuned chord while she is inside, then a bright chime as the reflection steps out and a low glass slide as the pane sinks. Built with clipping planes: the real Maya is only drawn on the far side of the pane, her reflection (a copy of her model, facing east) only on the near side or above the sinking pane, so the swap is seamless. For a left turn the pane stands on the other diagonal. Short enough to come round often as a variant.',
};

export default async function play(lab) {
  const { THREE, ease, facing, arena } = lab;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;

  const maya = lab.puppet('a');
  const red = new THREE.Color(lab.bot('a').color ?? '#ff4d6d');
  const tag = lab.bot('a').tag;
  const C = lab.pos(3, 1);
  const n = new THREE.Vector3(1, 0, 1).normalize(); // the pane's near (south-east) face
  const u = new THREE.Vector3(1, 0, -1).normalize(); // along the pane, toward its north-east end
  const L = 1.22; // the pane's length
  const PH = 0.86; // and height

  // ---- clipping: the real Maya lives on the far side of the pane, her reflection on the near side ----
  const renderer = lab.renderer;
  const clip0 = renderer.localClippingEnabled;
  renderer.localClippingEnabled = true;
  const keepFar = new THREE.Plane(n.clone().negate(), n.dot(C));
  const keepNear = new THREE.Plane(n.clone(), -n.dot(C));
  const keepAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PH);
  const realMats = [];
  maya.group.traverse((o) => {
    if (o.isMesh && o.material && o !== tag) realMats.push(o.material);
  });
  const setClip = (on) => {
    for (const mat of realMats) {
      mat.clippingPlanes = on ? [keepFar] : null;
      mat.clipIntersection = false;
      mat.needsUpdate = true;
    }
  };
  lab.cleanup(() => {
    setClip(false);
    renderer.localClippingEnabled = clip0;
    if (tag) tag.material.opacity = 1;
  });

  // her reflection: a copy of her model with its own materials, facing east
  const twin = maya.group.clone(true);
  if (tag) {
    const i = maya.group.children.indexOf(tag);
    if (i >= 0) twin.remove(twin.children[i]);
  }
  const twinEye = [];
  twin.traverse((o) => {
    if (o.isMesh && o.material) {
      const wasEye = o.material === maya.model.eyeMat;
      o.material = o.material.clone();
      o.material.clippingPlanes = [keepNear, keepAbove];
      o.material.clipIntersection = true; // drawn where it's on the near side OR above the pane
      if (wasEye) twinEye.push(o.material);
    }
  });
  const twinBody = twin.children.find((o) => o.isGroup) ?? null;
  twin.visible = false;
  twin.rotation.order = 'YXZ';
  lab.add(twin);

  // ---- the pane: smoked glass, bright edges, a sheen ----
  const pane = new THREE.Group();
  pane.position.copy(C);
  pane.rotation.y = Math.atan2(n.x, n.z);
  lab.add(pane);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1015, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.62, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(L, PH), glassMat);
  glass.position.y = PH / 2;
  glass.renderOrder = 3;
  pane.add(glass);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e6').multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const edgeTop = new THREE.Mesh(new THREE.BoxGeometry(L, 0.018, 0.018), edgeMat);
  edgeTop.position.y = PH;
  const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.014, PH, 0.014), edgeMat);
  edgeL.position.set(-L / 2, PH / 2, 0);
  const edgeR = edgeL.clone();
  edgeR.position.x = L / 2;
  pane.add(edgeTop, edgeL, edgeR);
  // light caught in the glass: brightest under the top edge, fading down, with a faint vertical grain
  const catchTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.08, 'rgba(255,255,255,0.32)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 128);
    const sides = g.createLinearGradient(0, 0, 64, 0);
    sides.addColorStop(0, 'rgba(255,255,255,0.25)');
    sides.addColorStop(0.06, 'rgba(255,255,255,0)');
    sides.addColorStop(0.94, 'rgba(255,255,255,0)');
    sides.addColorStop(1, 'rgba(255,255,255,0.25)');
    g.fillStyle = sides;
    g.fillRect(0, 0, 64, 128);
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  const catchMat = new THREE.MeshBasicMaterial({ map: catchTex, color: new THREE.Color('#cfe0ff').multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const catchLight = new THREE.Mesh(new THREE.PlaneGeometry(L, PH), catchMat);
  catchLight.position.set(0, PH / 2, 0.002);
  catchLight.renderOrder = 3;
  pane.add(catchLight);
  // her red, held inside the glass
  const soft = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  const insideMat = new THREE.MeshBasicMaterial({ map: soft, color: red.clone().multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.75), insideMat);
  inside.position.set(0, 0.3, 0.005);
  inside.renderOrder = 4;
  pane.add(inside);
  // a sheen that sweeps across the glass
  const sheenMat = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color('#fff4e6').multiplyScalar(1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, PH * 1.6), sheenMat);
  sheen.rotation.z = 0.5;
  sheen.position.set(0, PH / 2, 0.008);
  sheen.renderOrder = 4;
  pane.add(sheen);
  // a ripple where she touches
  const rippleMat = new THREE.MeshBasicMaterial({ color: red.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), rippleMat);
  ripple.renderOrder = 5;
  pane.add(ripple);
  // the sheen and ripple belong to the glass: clip them to the pane as it sinks
  const paneClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), PH);
  for (const mat of [insideMat, sheenMat, rippleMat]) mat.clippingPlanes = [paneClip, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];

  // ---- camera ----
  const cam = { dx: 0, dz: 0, dk: 1, az: 0, del: 0 };
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

  // ---- timeline (scene seconds) ----
  const EXP = [0, 0.32]; // express step: (1,1) -> (2,1)
  const RISE = [0.06, 0.42];
  const IN = [0.42, 0.92]; // into the glass
  const TOUCH = 0.52;
  const OUT = [1.0, 1.36]; // the reflection steps out
  const SINK = [1.12, 1.48];
  const SWAP = 1.5;
  const END = 1.98;
  const DX0 = -1;
  const DX1 = 0.74; // fully inside: past the pane

  setClip(true);
  const t0 = lab.t;
  let swapped = false;
  let lean = { p: 0, r: 0 };
  const stop = lab.every(() => {
    const t = lab.t - t0;

    // slow motion while the glass swallows her
    lab.timeScale = 1 - 0.45 * seg(t, TOUCH - 0.04, TOUCH + 0.04) * (1 - seg(t, IN[1] - 0.04, IN[1] + 0.06));

    // ---- the pane ----
    const rise = ease.outBack(seg(t, RISE[0], RISE[1]), 1.2);
    const sink = ease.in(seg(t, SINK[0], SINK[1]));
    const h = PH * (rise - sink); // how much of it stands above the glass
    pane.position.y = h - PH;
    keepAbove.constant = -Math.max(0, h);
    paneClip.constant = Math.max(0, h);
    pane.visible = h > 0.005;
    const edgeGlow = 2.4 + 2.5 * Math.max(0, 1 - Math.abs(t - TOUCH) / 0.2) + 1.5 * Math.max(0, 1 - Math.abs(t - OUT[0] - 0.1) / 0.25);
    edgeMat.color.set('#fff4e6').multiplyScalar(edgeGlow);

    // ---- the real Maya: carried into the glass ----
    let realDx = DX0;
    if (t < EXP[1]) realDx = mix(-2, -1, ease.inOut(seg(t, EXP[0], EXP[1])));
    else realDx = mix(DX0, DX1, ease.inOut(seg(t, IN[0], IN[1])));
    const inGlass = clamp((realDx + 0.62) / 1.3); // 0 = touching, 1 = gone
    if (!swapped) maya.set({ x: 3 + realDx, y: 1, rot: facing(0), trail: realDx < -0.55, visible: inGlass < 1 });
    if (tag && !swapped) tag.material.opacity = 1 - seg(inGlass, 0, 0.5);

    // the glass takes on her red while she's inside, and ripples where she touched
    insideMat.opacity = 1.0 * seg(inGlass, 0.05, 0.7) * (1 - seg(t, OUT[0] + 0.05, OUT[1]));
    const along = THREE.MathUtils.clamp(u.dot(new THREE.Vector3(realDx, 0, 0)), -L / 2 + 0.25, L / 2 - 0.25);
    inside.position.x = mix(along, 0, seg(t, IN[1] - 0.2, IN[1]));
    const rk = seg(t, TOUCH, TOUCH + 0.55);
    ripple.position.set(-0.32, 0.2, 0.006);
    ripple.scale.setScalar(0.02 + 0.5 * ease.out(rk));
    rippleMat.opacity = t > TOUCH ? (1 - rk) ** 1.5 : 0;
    const sk = seg(t, TOUCH + 0.05, OUT[0] + 0.15);
    sheen.position.x = mix(-L * 0.75, L * 0.75, ease.inOut(sk));
    sheenMat.opacity = 0.7 * Math.sin(sk * Math.PI);

    // ---- her reflection steps out, facing east ----
    if (t >= OUT[0] && !swapped) {
      const k = seg(t, OUT[0], OUT[1]);
      const d = mix(-0.66, 0, ease.out3(k));
      const p = C.clone().addScaledVector(n, d);
      twin.visible = true;
      twin.position.set(p.x, 0, p.z);
      twin.rotation.set(0, facing(1), 0);
      // a lean into the step (toward the south-east, in her own frame), settling as she arrives
      const amt = 0.22 * Math.sin(Math.min(1, k * 1.25) * Math.PI) * (1 - k * 0.6);
      const r = facing(1);
      lean = { p: amt * (n.x * -Math.sin(r) + n.z * -Math.cos(r)), r: amt * (n.x * Math.cos(r) + n.z * -Math.sin(r)) };
      if (twinBody) twinBody.rotation.set(-lean.p, 0, -lean.r);
      for (const m of twinEye) m.color.setRGB(3.2, 3.1, 2.9).multiplyScalar(1 + 0.6 * Math.max(0, 1 - Math.abs(k - 0.5) / 0.5));
    }

    // ---- the swap: once the pane is down, the reflection is the real Maya ----
    if (t >= SWAP && !swapped) {
      swapped = true;
      setClip(false);
      twin.visible = false;
      maya.set({ x: 3, y: 1, rot: facing(1), trail: false, visible: true });
    }
    if (tag && swapped) tag.material.opacity = ease.inOut(seg(t, SWAP, SWAP + 0.25));

    // ---- camera: eases round to look into the glass, then home ----
    const look = ease.inOut(seg(t, 0.05, 0.6)) * (1 - ease.inOut(seg(t, SINK[0], END - 0.03)));
    cam.az = 0.16 * look;
    cam.dk = 1 - 0.13 * look;
    cam.del = -0.05 * look;
    cam.dx = C.x * 0.45 * look;
    cam.dz = C.z * 0.45 * look;
  });

  await lab.wait(END);
  stop();
  lab.timeScale = 1;
  setClip(false);
  renderer.localClippingEnabled = clip0;
  if (tag) tag.material.opacity = 1;
  twin.visible = false;
  pane.visible = false;
  releaseCam();
  maya.set({ x: 3, y: 1, rot: facing(1), visible: true });
  maya.release({ x: 3, y: 1, d: 1 });
}
